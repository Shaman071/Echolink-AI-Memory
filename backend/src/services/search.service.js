const { Fragment } = require('../models');
const { generateEmbeddings, cosineSimilarity } = require('./embedding.service');
const logger = require('../utils/logger');

/**
 * Search for fragments similar to the query
 * @param {string} query - Search query
 * @param {Object} filter - Additional filters for the search
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of matching fragments with scores
 */
async function searchFragments(query, filter = {}, options = {}) {
  const { limit = 10, minScore = 0.7 } = options;

  try {
    const { queryEmbeddingService } = require('./embedding.service');
    const config = require('../config/config');

    // Prefer external search service if configured
    // This allows searching the entire vector store (Python/FAISS) instead of just
    // the fragments currently loaded in memory or limited by Node.js
    if (config.embeddingService && config.embeddingService.url) {
      try {
        // Query the external service
        const searchResults = await queryEmbeddingService(query, limit * 2); // Get more candidates

        if (searchResults && searchResults.length > 0) {
          // Filter by score
          const validResults = searchResults.filter(r => r.score >= minScore);

          if (validResults.length > 0) {
            // Fetch full fragment details from MongoDB
            const ids = validResults.map(r => r.id);

            // Apply MongoDB context filters (like user ID)
            const mongoFilter = { ...filter, _id: { $in: ids } };

            const fragments = await Fragment.find(mongoFilter)
              .populate('source', 'title type')
              .lean();

            // Map scores back and sort
            return fragments.map(f => {
              const result = validResults.find(r => r.id === f._id.toString());
              return {
                ...f,
                score: result ? result.score : 0
              };
            }).sort((a, b) => b.score - a.score).slice(0, limit);
          }
        }
      } catch (externalError) {
        logger.warn('External search failed, falling back to local:', externalError.message);
        // Fall back to local execution below
      }
    }

    // Fallback: Local execution (generate embedding -> internal vector search)
    // Generate embeddings for the query
    const queryEmbedding = await generateEmbeddings(query);

    // Find similar fragments
    const results = await findSimilarFragments(queryEmbedding, filter, { limit, minScore });

    return results;
  } catch (error) {
    logger.error('Error in searchFragments:', error);
    throw new Error('Search failed');
  }
}

/**
 * Find similar fragments using vector search
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {Object} filter - MongoDB filter
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of matching fragments with scores
 */
/**
 * Find similar fragments using vector search
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {Object} filter - MongoDB filter
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of matching fragments with scores
 */
async function findSimilarFragments(queryEmbedding, filter = {}, options = {}) {
  const { limit = 10, minScore = 0.7 } = options;

  // Limit to prevent memory issues - increased from 500 to 2000 to improve recall
  const maxFragments = 2000;

  try {
    // Optimization: Select ONLY the fields needed for similarity calculation first
    // This significantly reduces memory usage when loading thousands of fragments
    const fragments = await Fragment.find({
      ...filter,
      embedding: { $exists: true },
    })
      .sort('-createdAt')
      .limit(maxFragments)
      .select('_id source embedding') // Only need these for calculation
      .lean();

    if (!fragments || fragments.length === 0) {
      return [];
    }

    // Calculate similarity scores
    const scoredFragments = fragments
      .map(fragment => ({
        _id: fragment._id,
        score: cosineSimilarity(queryEmbedding, fragment.embedding),
        source: fragment.source
      }))
      .filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scoredFragments.length === 0) {
      return [];
    }

    // Hydrate the top results with full content
    const topIds = scoredFragments.map(f => f._id);
    const fullFragments = await Fragment.find({ _id: { $in: topIds } })
      .populate('source', 'title type')
      .lean();

    // Map back to preserve order and score
    const results = scoredFragments.map(scored => {
      const full = fullFragments.find(f => f._id.toString() === scored._id.toString());
      if (!full) return null;
      return {
        ...full,
        score: scored.score
      };
    }).filter(f => f !== null);

    return results;
  } catch (error) {
    logger.error('Error in findSimilarFragments:', error);
    return [];
  }
}

/**
 * Full-text search using MongoDB text index
 * @param {string} query - Search query
 * @param {Object} filter - Additional filters for the search
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of matching fragments with scores
 */
async function textSearch(query, filter = {}, options = {}) {
  const { limit = 10, skip = 0 } = options;

  try {
    const results = await Fragment.find(
      {
        ...filter,
        $text: { $search: query }
      },
      {
        score: { $meta: 'textScore' }
      }
    )
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .lean();

    return results;
  } catch (error) {
    logger.error('Error in textSearch:', error);
    throw new Error('Text search failed');
  }
}

/**
 * Hybrid search combining vector and text search
 * @param {string} query - Search query
 * @param {Object} filter - Additional filters for the search
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Combined search results
 */
async function hybridSearch(query, filter = {}, options = {}) {
  const { limit = 10 } = options;

  try {
    // Run both searches in parallel
    const [vectorResults, textResults] = await Promise.all([
      searchFragments(query, filter, { limit }),
      textSearch(query, filter, { limit }),
    ]);

    // Combine and deduplicate results
    const resultMap = new Map();

    // Add vector results with higher weight
    vectorResults.forEach(result => {
      resultMap.set(result._id.toString(), {
        ...result,
        combinedScore: result.score * 0.7, // Higher weight for vector results
      });
    });

    // Add text results with lower weight, or update existing results
    textResults.forEach(result => {
      const existing = resultMap.get(result._id.toString()) || {};
      resultMap.set(result._id.toString(), {
        ...existing,
        ...result,
        combinedScore: (existing.combinedScore || 0) + (result.score * 0.3), // Lower weight for text results
      });
    });

    // Convert to array and sort by combined score
    const combinedResults = Array.from(resultMap.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);

    return {
      results: combinedResults,
      vectorCount: vectorResults.length,
      textCount: textResults.length,
      combinedCount: combinedResults.length,
    };
  } catch (error) {
    logger.error('Error in hybridSearch:', error);
    throw new Error('Hybrid search failed');
  }
}

module.exports = {
  searchFragments,
  findSimilarFragments,
  searchSimilarFragments: findSimilarFragments, // Alias for compatibility
  textSearch,
  hybridSearch,
};
