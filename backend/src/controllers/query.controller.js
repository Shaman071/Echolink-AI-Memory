const httpStatus = require('http-status');
const { Fragment, Source, Link } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { generateEmbeddings } = require('../services/embedding.service');
const { searchSimilarFragments } = require('../services/search.service');
const { generateSummary } = require('../services/summarizer.service');
const { search: searchEmbeddings } = require('../services/indexer.service');
const { summarize } = require('../services/summarizer.service');

/**
 * Search query using embed service (semantic search)
 * @param {string} query - Search query
 * @param {Object} user - User object
 * @param {Object} options - Query options  
 * @returns {Promise<Object>} Results with summary, evidence, timeline, graph
 */
const searchQuery = async (query, user, options = {}) => {
  try {
    const { k = 30 } = options;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Query text is required');
    }

    logger.info(`User ${user._id} searching for: "${query}"`);

    // Search using embed service (returns fragment IDs with scores)
    let searchResults = [];
    try {
      searchResults = await searchEmbeddings(query, k);
    } catch (embedError) {
      logger.warn(`Embedding search failed: ${embedError.message}. Falling back to text search.`);
      // searchResults remains empty, triggering the fallback below
    }

    let fragments = [];

    // Fallback to text search if no semantic results
    if (!searchResults || searchResults.length === 0) {
      logger.info(`No semantic results found for query: "${query}". Falling back to text search.`);

      const textFragments = await Fragment.find(
        { $text: { $search: query }, user: user._id },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(k)
        .populate('source', 'title type')
        .lean();

      if (textFragments && textFragments.length > 0) {
        // Use text fragments directly
        fragments = textFragments.map(f => ({
          ...f,
          score: f.score || 0
        }));
      }
    } else {
      // Fetch full documents for semantic results
      const fragmentIds = searchResults.map(r => r.id);
      const docs = await Fragment.find({
        _id: { $in: fragmentIds },
        user: user._id,
      })
        .populate('source', 'title type')
        .lean();

      // Map scores and sort
      fragments = docs.map(frag => {
        const result = searchResults.find(r => r.id === (frag._id ? frag._id.toString() : ''));
        return {
          ...frag,
          score: result?.score || 0,
        };
      });

      fragments.sort((a, b) => b.score - a.score);
    }

    // Fallback for Meta-Queries (summary, overview, etc.) if no results found
    const metaQueryPatterns = [/summary/i, /overview/i, /key points/i, /decisions/i, /patterns/i, /insights/i];
    const isMetaQuery = metaQueryPatterns.some(p => p.test(query));

    if ((!fragments || fragments.length === 0) && isMetaQuery) {
      logger.info(`Meta-query detected ("${query}") with no direct matches. Fetching recent context.`);

      // Fetch recent fragments to provide a general summary
      // Use a broader text search or just recent items
      const recentFragments = await Fragment.find({ user: user._id })
        .sort({ createdAt: -1 }) // Most recent first
        .limit(15)
        .populate('source', 'title type')
        .lean();

      if (recentFragments && recentFragments.length > 0) {
        fragments = recentFragments.map(f => ({ ...f, score: 0.5 })); // Assign arbitrary score
        logger.info(`Using ${fragments.length} recent fragments for meta-summary.`);
      }
    }

    if (!fragments || fragments.length === 0) {
      logger.info(`No results found for query: "${query}"`);
      return {
        ok: true,
        query,
        summary: 'No results found for your query. Try asking about specific topics in your documents.',
        evidence: [],
        timeline: [],
        graph: { nodes: [], edges: [] },
      };
    }

    // Generate summary from top fragments
    let summary = '';
    try {
      const topFragments = fragments.slice(0, 15); // Use up to 15 fragments for better synthesis
      summary = await summarize(topFragments, query);
    } catch (error) {
      logger.warn('Failed to generate summary:', error);
      summary = 'Summary generation failed. See evidence fragments below.';
    }

    // Build evidence array: [{id, text, sender, datetime, source}]
    const evidence = fragments.map(f => ({
      id: f._id ? f._id.toString() : null,
      text: f.text,
      sender: f.sender,
      datetime: f.datetime,
      source: f.source?.title || 'Unknown',
      score: f.score,
    }));

    // Build timeline data
    const timeline = fragments.reduce((acc, frag) => {
      const date = frag.datetime ? new Date(frag.datetime).toISOString().split('T')[0] : null;
      if (!date) return acc;

      const existing = acc.find(t => t.date === date);
      if (existing) {
        existing.count += 1;
      } else {
        acc.push({ date, count: 1 });
      }
      return acc;
    }, []);

    // Build graph data (links between result fragments)
    const resultFragmentIds = fragments.map(f => f._id);
    const links = await Link.find({
      user: user._id,
      sourceFragment: { $in: resultFragmentIds },
      targetFragment: { $in: resultFragmentIds },
    }).lean();

    const graph = {
      nodes: fragments.map((f, idx) => ({
        id: f._id ? f._id.toString() : `node-${idx}`,
        label: f.sender || 'Unknown',
        content: f.text ? (f.text.substring(0, 50) + '...') : '',
        score: f.score,
        datetime: f.datetime,
      })),
      edges: links.map(l => ({
        source: l.sourceFragment ? l.sourceFragment.toString() : null,
        target: l.targetFragment ? l.targetFragment.toString() : null,
        type: l.type || 'related',
        weight: l.strength || 1,
      })).filter(e => e.source && e.target &&
        fragments.some(f => f._id.toString() === e.source) &&
        fragments.some(f => f._id.toString() === e.target)
      ),
    };

    return {
      ok: true,
      query,
      summary,
      evidence,
      timeline,
      graph,
      count: fragments.length,
    };
  } catch (error) {
    logger.error('Error in searchQuery:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error performing search: ' + error.message
    );
  }
};

/**
 * Search for fragments by query
 * @param {string} query - Search query
 * @param {Object} user - User object
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
const searchFragments = async (query, user, options = {}) => {
  try {
    const { limit = 10, threshold = 0.7, sourceId } = options;

    // Generate embeddings for the query
    const queryEmbedding = await generateEmbeddings(query);

    // Build query
    const queryObj = { user: user._id };
    if (sourceId) {
      queryObj.source = sourceId;
    }

    // Perform vector search
    const results = await searchSimilarFragments(queryEmbedding, queryObj, {
      limit,
      minScore: threshold,
    });

    // Populate source information
    const fragmentIds = results.map(r => r._id);
    const fragments = await Fragment.find({ _id: { $in: fragmentIds } })
      .populate('source', 'title type')
      .lean();

    // Map scores back to fragments
    const fragmentsWithScores = fragments.map(fragment => ({
      ...fragment,
      score: results.find(r => r._id.equals(fragment._id))?.score || 0,
    }));

    // Sort by score (descending)
    fragmentsWithScores.sort((a, b) => b.score - a.score);

    // Generate summary if we have results
    let summary = '';
    if (fragmentsWithScores.length > 0) {
      try {
        const contextText = fragmentsWithScores
          .slice(0, 5)
          .map((f, i) => `[Fragment ${i + 1} - ID: ${f._id}] ${f.content}`)
          .join('\n\n');

        const promptText = `Based on the following evidence fragments, provide a concise answer to: "${query}"

Evidence:
${contextText}

Provide a direct answer citing the fragment IDs (e.g., [Fragment 1]) in your response. Keep it under 200 words.`;

        summary = await generateSummary(promptText, { maxLength: 500 });
      } catch (error) {
        logger.warn('Failed to generate summary:', error);
        summary = 'Answer based on the evidence below:';
      }
    }

    // Build timeline data
    const timeline = await Fragment.aggregate([
      { $match: { _id: { $in: fragmentIds }, user: user._id } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$datetime' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
    ]);

    // Build graph data (links between result fragments)
    const links = await Link.find({
      user: user._id,
      sourceFragment: { $in: fragmentIds },
      targetFragment: { $in: fragmentIds },
    }).lean();

    const graph = {
      nodes: fragmentsWithScores.map(f => ({
        id: f._id.toString(),
        content: f.content ? f.content.substring(0, 100) : '',
        topics: f.topics || [],
      })),
      edges: links.map(l => ({
        source: l.sourceFragment.toString(),
        target: l.targetFragment.toString(),
        type: l.type,
        weight: l.strength,
      })),
    };

    return {
      query,
      summary,
      results: fragmentsWithScores,
      count: fragmentsWithScores.length,
      timeline,
      graph,
    };
  } catch (error) {
    logger.error('Error in searchFragments:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error performing search'
    );
  }
};

/**
 * Get a single fragment by ID
 * @param {string} fragmentId - Fragment ID
 * @param {Object} user - User object
 * @returns {Promise<Fragment>}
 */
const getFragment = async (fragmentId, user) => {
  // Include embedding which is stored with select:false in the Fragment schema
  const fragment = await Fragment.findOne({ _id: fragmentId, user: user._id })
    .select('+embedding')
    .populate('source', 'title type');

  if (!fragment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Fragment not found');
  }

  return fragment;
};

/**
 * Get related fragments
 * @param {string} fragmentId - Fragment ID
 * @param {Object} user - User object
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
const getRelatedFragments = async (fragmentId, user, options = {}) => {
  const { limit = 5, threshold = 0.6 } = options;

  // Get the source fragment
  const sourceFragment = await getFragment(fragmentId, user);

  if (!sourceFragment.embedding) {
    return {
      fragment: sourceFragment,
      related: [],
    };
  }

  // Find similar fragments (excluding the source fragment)
  const results = await searchSimilarFragments(
    sourceFragment.embedding,
    {
      user: user._id,
      _id: { $ne: sourceFragment._id },
    },
    { limit, minScore: threshold }
  );

  // Get full fragment details
  const fragmentIds = results.map(r => r._id);
  const fragments = await Fragment.find({ _id: { $in: fragmentIds } })
    .populate('source', 'title type')
    .lean();

  // Map scores back to fragments
  const fragmentsWithScores = fragments.map(fragment => ({
    ...fragment,
    score: results.find(r => r._id.equals(fragment._id))?.score || 0,
  }));

  return {
    fragment: sourceFragment,
    related: fragmentsWithScores,
  };
};

/**
 * Get query history for a user
 * @param {Object} user - User object
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const getQueryHistory = async (user, options) => {
  const { page = 1, limit = 20 } = options;

  // In a real implementation, you would have a QueryHistory model
  // This is a simplified version
  return {
    results: [],
    page,
    limit,
    totalPages: 0,
    totalResults: 0,
  };
};

module.exports = {
  searchQuery,
  searchFragments,
  getFragment,
  getRelatedFragments,
  getQueryHistory,
};
