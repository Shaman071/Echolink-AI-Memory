const { Fragment, Source } = require('../models');
const { generateEmbeddings, generateEmbeddingsBatch, addDocumentsToService, queryEmbeddingService } = require('./embedding.service');
const { rebuildLinksForSource } = require('./link-builder.service');
const { generateSummary, extractKeyPoints } = require('./summarizer.service');
const logger = require('../utils/logger');

/**
 * Index a single fragment
 * @param {string} fragmentId - ID of the fragment to index
 * @returns {Promise<Object>} Indexing result
 */
async function indexFragment(fragmentId) {
  try {
    const fragment = await Fragment.findById(fragmentId);
    if (!fragment) {
      throw new Error(`Fragment not found: ${fragmentId}`);
    }

    // Generate embeddings for the fragment content
    const embedding = await generateEmbeddings(fragment.content);
    
    // Generate a summary if not already present
    let { summary } = fragment;
    if (!summary) {
      summary = await generateSummary(fragment.content);
    }
    
    // Extract key points if not already present
    let { keyPoints } = fragment.metadata || {};
    if (!keyPoints || keyPoints.length === 0) {
      keyPoints = await extractKeyPoints(fragment.content);
    }

    // Update the fragment with the generated data
    const updates = {
      embedding,
      summary,
      'metadata.keyPoints': keyPoints,
      indexedAt: new Date(),
      status: 'indexed',
    };

    await Fragment.findByIdAndUpdate(fragmentId, { $set: updates });

    // Register this fragment with external embedding service if available
    try {
      await addDocumentsToService([{ id: fragment._id.toString(), text: fragment.content, meta: { source: fragment.source, user: fragment.user } }]);
    } catch (err) {
      logger.warn(`Failed to register fragment ${fragment._id} with embedding service: ${err.message}`);
    }

    return {
      success: true,
      fragmentId: fragment._id,
      summary,
      keyPoints,
      embeddingLength: embedding ? embedding.length : 0,
    };
  } catch (error) {
    logger.error(`Error indexing fragment ${fragmentId}:`, error);
    
    // Update fragment with error status
    await Fragment.findByIdAndUpdate(fragmentId, {
      $set: {
        status: 'error',
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
    });
    
    return {
      success: false,
      fragmentId,
      error: error.message,
    };
  }
}

/**
 * Index all fragments for a source
 * @param {string} sourceId - ID of the source
 * @param {Object} options - Indexing options
 * @returns {Promise<Object>} Indexing results
 */
async function indexSourceFragments(sourceId, options = {}) {
  const { batchSize = 5, force = false } = options;
  
  try {
    const source = await Source.findById(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }
    
    // Update source status
    source.status = 'indexing';
    await source.save();
    
    // Find fragments that need indexing
    const query = { source: sourceId };
    if (!force) {
      // Only index fragments that haven't been indexed or had errors
      query.$or = [
        { status: { $exists: false } },
        { status: 'pending' },
        { status: 'error' },
      ];
    }
    
    const fragmentIds = await Fragment.find(query).distinct('_id');
    const results = {
      total: fragmentIds.length,
      success: 0,
      failed: 0,
      details: [],
    };
    
    // Process fragments in batches
    for (let i = 0; i < fragmentIds.length; i += batchSize) {
      const batch = fragmentIds.slice(i, i + batchSize);

      // Fetch fragment docs for this batch
      const fragments = await Fragment.find({ _id: { $in: batch } }).lean();

      // Identify fragments lacking embeddings and attempt batch embedding
      const toEmbed = fragments.filter(f => !f.embedding).map(f => f.content);
      try {
        if (toEmbed.length > 0) {
          const embeddings = await generateEmbeddingsBatch(toEmbed);

          // Map back embeddings to fragment ids and update documents
          let embIdx = 0;
          const bulkOps = [];
          for (const f of fragments) {
            if (!f.embedding) {
              const emb = embeddings[embIdx++];
              bulkOps.push({
                updateOne: {
                  filter: { _id: f._id },
                  update: { $set: { embedding: emb, status: 'indexed', indexedAt: new Date() } },
                },
              });
            }
          }

          if (bulkOps.length > 0) {
            await Fragment.bulkWrite(bulkOps);

            // Prepare documents to register with external embedding service
            const docsToAdd = [];
            for (const f of fragments) {
              if (!f.embedding) {
                docsToAdd.push({ id: f._id.toString(), text: f.content, meta: { source: f.source, user: f.user } });
              }
            }

            if (docsToAdd.length > 0) {
              try {
                await addDocumentsToService(docsToAdd);
              } catch (err) {
                logger.warn('Failed to register documents with embedding service:', err.message);
              }
            }
          }
        }
      } catch (embedErr) {
        logger.warn('Batch embedding failed for some fragments, falling back to per-fragment embedding:', embedErr.message);
      }

      // Now index each fragment (this will compute summaries/keypoints if missing)
      const batchResults = await Promise.all(batch.map(fragmentId => indexFragment(fragmentId)));

      // Update results
      batchResults.forEach(result => {
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
        }
        results.details.push(result);
      });

      logger.info(`Processed batch ${i / batchSize + 1}/${Math.ceil(fragmentIds.length / batchSize)}`);
    }
    
    // Update source status
    source.status = 'indexed';
    source.indexedAt = new Date();
    await source.save();

    // Emit SSE/internal event about source indexing completion
    try {
      const events = require('../utils/events');
      events.emit('sourceStatus', { userId: source.user, sourceId: source._id, status: 'indexed', indexedAt: source.indexedAt });
    } catch (e) {
      logger.warn('Failed to emit sourceStatus event:', e.message || e);
    }

    // Enqueue link rebuilding for this source (do not block indexer caller)
    try {
      const jobQueue = require('../utils/jobQueue');
      jobQueue.enqueue(() => rebuildLinksForSource(source._id))
        .then((linksCreated) => logger.info(`Auto link rebuild (queued) for source ${source._id} created ${linksCreated} links`))
        .catch((err) => logger.warn(`Auto link rebuild (queued) failed for source ${source._id}: ${err.message}`));
    } catch (err) {
      logger.warn(`Failed to enqueue link rebuild for source ${source._id}: ${err.message}`);
    }
    
    return results;
  } catch (error) {
    logger.error(`Error indexing source ${sourceId}:`, error);
    
    // Update source with error status
    await Source.findByIdAndUpdate(sourceId, {
      $set: {
        status: 'error',
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
    });
    
    return {
      success: false,
      sourceId,
      error: error.message,
    };
  }
}

/**
 * Rebuild the search index
 * @param {Object} options - Indexing options
 * @returns {Promise<Object>} Indexing results
 */
async function rebuildIndex(options = {}) {
  const { batchSize = 5, force = false } = options;
  
  try {
    // Find all sources that need indexing
    const query = {};
    if (!force) {
      // Only index sources that haven't been indexed or had errors
      query.$or = [
        { status: { $exists: false } },
        { status: 'pending' },
        { status: 'error' },
      ];
    }
    
    const sources = await Source.find(query).select('_id title status');
    const results = {
      total: sources.length,
      success: 0,
      failed: 0,
      details: [],
    };
    
    // Process each source
    for (const source of sources) {
      try {
        logger.info(`Indexing source: ${source.title} (${source._id})`);
        
        const sourceResults = await indexSourceFragments(source._id, { batchSize, force });
        
        results.details.push({
          sourceId: source._id,
          sourceTitle: source.title,
          ...sourceResults,
        });
        
        if (sourceResults.success) {
          results.success++;
        } else {
          results.failed++;
        }
      } catch (error) {
        logger.error(`Error processing source ${source._id}:`, error);
        results.failed++;
        results.details.push({
          sourceId: source._id,
          sourceTitle: source.title,
          error: error.message,
          success: false,
        });
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Error rebuilding index:', error);
    throw error;
  }
}

module.exports = {
  indexFragment,
  indexSourceFragments,
  rebuildIndex,
  indexFragments,
  search,
};

/**
 * Index fragments by posting to embed service
 * Maps fragment._id.toString() as id for stable mapping
 * @param {Object[]} fragments - Array of fragment documents
 * @returns {Promise<Object>} Result of indexing operation
 */
async function indexFragments(fragments) {
  try {
    if (!Array.isArray(fragments) || fragments.length === 0) {
      logger.warn('indexFragments called with empty array');
      return { success: 0, failed: 0, total: 0 };
    }

    // Map fragments to format expected by embed service
    const docsToAdd = fragments.map(frag => ({
      id: frag._id.toString(), // Use stringified ObjectId as stable id
      text: frag.text,
      meta: {
        sender: frag.sender,
        datetime: frag.datetime,
        source: frag.source.toString(),
        user: frag.user.toString(),
      },
    }));

    logger.info(`Indexing ${docsToAdd.length} fragments with embed service`);

    try {
      const result = await addDocumentsToService(docsToAdd);
      logger.info(`Successfully indexed ${docsToAdd.length} fragments`, result);
      return {
        success: docsToAdd.length,
        failed: 0,
        total: docsToAdd.length,
        result,
      };
    } catch (error) {
      logger.error('Failed to index fragments with embed service:', error.message);
      // Don't throw - allow indexing to fail gracefully
      return {
        success: 0,
        failed: docsToAdd.length,
        total: docsToAdd.length,
        error: error.message,
      };
    }
  } catch (error) {
    logger.error('Error in indexFragments:', error);
    throw error;
  }
}

/**
 * Search for fragments in embed service by query
 * Returns mapping of fragment IDs with scores
 * @param {string} q - Query text
 * @param {number} k - Number of results to return
 * @returns {Promise<Array<{id: string, score: number}>>} Array of fragment ids with scores
 */
async function search(q, k = 5) {
  try {
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      logger.warn('Search query is empty');
      return [];
    }

    logger.info(`Searching for query: "${q}" with k=${k}`);

    // Query the embedding service
    const results = await queryEmbeddingService(q, k);

    if (!Array.isArray(results)) {
      logger.warn('Invalid response from embedding service');
      return [];
    }

    // Map results to expected format: [{ id, score }]
    const mapped = results.map(r => ({
      id: r.id,
      score: r.score || 0,
    }));

    logger.info(`Search returned ${mapped.length} results`);
    return mapped;
  } catch (error) {
    logger.error('Error in search:', error);
    // Return empty array on error instead of throwing (graceful degradation)
    return [];
  }
}
