const { Fragment, Link } = require('../models');
const { generateEmbeddings, cosineSimilarity } = require('./embedding.service');
const { buildTopicClusters } = require('./topic-cluster.service');
const logger = require('../utils/logger');

/**
 * Build links between fragments for a user
 * @param {string} userId - User ID
 * @param {Object} options - Options for link building
 * @returns {Promise<number>} Number of links created
 */
async function buildLinksForUser(userId, options = {}) {
  const {
    similarityThreshold = options.similarityThreshold || 0.70, // Lowered slightly to catch more
    maxLinksPerFragment = options.maxLinksPerFragment || 15,
    batchSize = options.batchSize || 50, // Increased batch size
    enableTopicClustering = options.enableTopicClustering !== false, // Enabled by default
    topicThreshold = options.topicThreshold || 0.8,
  } = options;

  try {
    logger.info(`Building links for user ${userId}`);

    // Get count first to avoid loading all at once
    const totalFragments = await Fragment.countDocuments({
      user: userId,
      status: { $in: ['processed', 'indexed', 'pending'] },
      embedding: { $exists: true },
    });

    if (totalFragments < 2) {
      logger.info(`[LinkBuilder] Not enough fragments for user ${userId} (Found: ${totalFragments})`);
      return 0;
    }

    // Process most recent fragments first as they are most likely to need linking
    const maxFragments = options.maxFragments || 1000; // Increased limit
    const fragments = await Fragment.find({
      user: userId,
      status: { $in: ['processed', 'indexed', 'pending'] },
      embedding: { $exists: true },
    })
      .select('_id content topics keywords datetime sender embedding')
      .sort('-createdAt')
      .limit(maxFragments)
      .lean();

    logger.info(`[LinkBuilder] Processing ${fragments.length} fragments for linking (Total matching in DB: ${totalFragments})`);

    let linksCreated = 0;
    const { findSimilarFragments } = require('./search.service');

    // PHASE 1: Create similarity-based links using Vector Search
    // Instead of sliding window (which only finds neighbors in time), we use vector search
    // to find semantic neighbors regardless of time.
    for (let i = 0; i < fragments.length; i++) {
      try {
        const fragment = fragments[i];
        if (!fragment || typeof fragment !== 'object') {
          logger.error(`[LinkBuilder] Fragment at index ${i} is invalid! Type: ${typeof fragment}`);
          continue;
        }

        if (!fragment.embedding || !Array.isArray(fragment.embedding)) {
          logger.debug(`[LinkBuilder] Fragment ${fragment._id || i} has no valid embedding, skipping.`);
          continue;
        }

        // Find similar fragments using the search service
        const similarFragments = await findSimilarFragments(
          fragment.embedding,
          {
            user: userId,
            _id: { $ne: fragment._id },
            embedding: { $exists: true }
          },
          { limit: 20, minScore: similarityThreshold }
        );

        if (!Array.isArray(similarFragments)) {
          logger.warn(`[LinkBuilder] findSimilarFragments returned non-array for ${fragment._id}`);
          continue;
        }

        // Process top matches
        const topMatches = similarFragments.slice(0, maxLinksPerFragment);

        for (const match of topMatches) {
          if (!match || typeof match !== 'object' || !match._id) {
            continue;
          }

          // Check if link already exists
          const existingLink = await Link.findOne({
            user: userId,
            $or: [
              { sourceFragment: fragment._id, targetFragment: match._id },
              { sourceFragment: match._id, targetFragment: fragment._id }
            ]
          });

          if (existingLink) continue;

          // Determine relationship type
          const relationType = determineRelationType(fragment, match, match.score || 0);

          try {
            await Link.create({
              sourceFragment: fragment._id,
              targetFragment: match._id,
              type: relationType,
              strength: Math.min(match.score || 0.5, 1),
              user: userId,
            });
            linksCreated++;
          } catch (createError) {
            if (createError.code !== 11000) {
              logger.error(`[LinkBuilder] Error creating link: ${createError.message}`);
            }
          }
        }
      } catch (itemError) {
        logger.error(`[LinkBuilder] Error processing fragment index ${i}: ${itemError.message}`);
      }

      if ((i + 1) % 10 === 0) {
        logger.info(`Processed ${i + 1}/${fragments.length} fragments for linking`);
      }
    }

    logger.info(`Created ${linksCreated} similarity links for user ${userId}`);

    // PHASE 2: Create topic clusters
    if (enableTopicClustering) {
      try {
        logger.info(`Building topic clusters for user ${userId}`);
        const clusterResult = await buildTopicClusters(userId, {
          similarityThreshold: topicThreshold,
          minClusterSize: 2
        });

        logger.info(`Topic clustering complete: ${clusterResult.clustersCreated} clusters, ${clusterResult.linksCreated} cluster links`);
        linksCreated += clusterResult.linksCreated;
      } catch (clusterError) {
        logger.error(`Topic clustering failed: ${clusterError.message}`);
        // Don't fail the entire operation if clustering fails
      }
    }

    logger.info(`Total links created for user ${userId}: ${linksCreated}`);
    return linksCreated;
  } catch (error) {
    logger.error('Error building links:', error);
    throw error;
  }
}

/**
 * Determine the type of relationship between two fragments
 * @param {Object} fragment1 - First fragment
 * @param {Object} fragment2 - Second fragment
 * @param {number} similarity - Similarity score
 * @returns {string} Relationship type
 */
function determineRelationType(fragment1, fragment2, similarity) {
  // Check for temporal relationships
  if (fragment1.datetime && fragment2.datetime) {
    const timeDiff = Math.abs(fragment1.datetime - fragment2.datetime);
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // If fragments are close in time (within 1 hour), it's likely a followup
    if (hoursDiff < 1 && fragment1.datetime < fragment2.datetime) {
      return 'followup';
    }
  }

  // Check for same sender (conversation continuation)
  if (fragment1.sender && fragment2.sender && fragment1.sender === fragment2.sender) {
    return 'same_author';
  }

  // Check for topic overlap
  const topics1 = new Set(fragment1.topics || []);
  const topics2 = new Set(fragment2.topics || []);
  const topicOverlap = [...topics1].filter(t => topics2.has(t)).length;

  if (topicOverlap > 0) {
    return 'same_topic';
  }

  // Check for keyword overlap
  const keywords1 = new Set(fragment1.keywords || []);
  const keywords2 = new Set(fragment2.keywords || []);
  const keywordOverlap = [...keywords1].filter(k => keywords2.has(k)).length;

  if (keywordOverlap > 2) {
    return 'related';
  }

  // High similarity but no clear relationship
  if (similarity > 0.9) {
    return 'supports'; // Use 'supports' as a strong similarity indicator for UI
  }

  return 'related';
}

/**
 * Rebuild all links for a source
 * @param {string} sourceId - Source ID
 * @returns {Promise<number>} Number of links created
 */
async function rebuildLinksForSource(sourceId) {
  try {
    // Fetch all fragments for this source (we need _id and user)
    const fragments = await Fragment.find({ source: sourceId }).select('_id user').lean();

    if (!fragments || fragments.length === 0) {
      return 0;
    }

    // Determine the user to run buildLinksForUser against (assume fragments belong to same user)
    const userId = fragments[0].user;

    const fragmentIds = fragments.map(f => f._id);

    // Delete existing links that reference any fragment from this source
    await Link.deleteMany({
      $or: [
        { sourceFragment: { $in: fragmentIds } },
        { targetFragment: { $in: fragmentIds } },
      ],
    });

    // Rebuild links for the user (this will process recent fragments for the user)
    return await buildLinksForUser(userId);
  } catch (error) {
    logger.error('Error rebuilding links for source:', error);
    throw error;
  }
}

module.exports = {
  buildLinksForUser,
  rebuildLinksForSource,
  determineRelationType,
};
