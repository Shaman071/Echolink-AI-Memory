const httpStatus = require('http-status');
const { Link, Fragment } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Create a link between two fragments
 * @param {string} sourceFragmentId - Source fragment ID
 * @param {string} targetFragmentId - Target fragment ID
 * @param {string} type - Link type
 * @param {Object} user - User object
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Link>}
 */
const createLink = async (sourceFragmentId, targetFragmentId, type, user, metadata = {}) => {
  // Check if fragments exist and belong to user
  const [sourceFragment, targetFragment] = await Promise.all([
    Fragment.findOne({ _id: sourceFragmentId, user: user._id }),
    Fragment.findOne({ _id: targetFragmentId, user: user._id }),
  ]);

  if (!sourceFragment || !targetFragment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'One or both fragments not found');
  }

  // Check if link already exists
  const existingLink = await Link.findOne({
    sourceFragment: sourceFragmentId,
    targetFragment: targetFragmentId,
    type,
    user: user._id,
  });

  if (existingLink) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Link already exists');
  }

  // Create the link
  const link = await Link.create({
    sourceFragment: sourceFragmentId,
    targetFragment: targetFragmentId,
    type,
    user: user._id,
    metadata,
  });

  return link;
};

/**
 * Get links for a fragment
 * @param {string} fragmentId - Fragment ID
 * @param {Object} user - User object
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
const getFragmentLinks = async (fragmentId, user, options = {}) => {
  const { direction = 'both', type } = options;

  const query = {
    user: user._id,
    $or: [],
  };

  if (direction === 'both' || direction === 'outgoing') {
    query.$or.push({ sourceFragment: fragmentId });
  }
  if (direction === 'both' || direction === 'incoming') {
    query.$or.push({ targetFragment: fragmentId });
  }

  if (type) {
    query.type = type;
  }

  const links = await Link.find(query)
    .populate('sourceFragment', 'content')
    .populate('targetFragment', 'content');

  return links;
};

/**
 * Update a link
 * @param {string} linkId - Link ID
 * @param {Object} updateBody - Update data
 * @param {Object} user - User object
 * @returns {Promise<Link>}
 */
const updateLink = async (linkId, updateBody, user) => {
  const link = await Link.findOne({ _id: linkId, user: user._id });

  if (!link) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Link not found');
  }

  Object.assign(link, updateBody);
  await link.save();

  return link;
};

/**
 * Delete a link
 * @param {string} linkId - Link ID
 * @param {Object} user - User object
 * @returns {Promise<Object>}
 */
const deleteLink = async (linkId, user) => {
  const link = await Link.findOneAndDelete({ _id: linkId, user: user._id });

  if (!link) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Link not found');
  }

  return { success: true };
};

/**
 * Suggest potential links for a fragment
 * @param {string} fragmentId - Fragment ID
 * @param {Object} user - User object
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
const suggestLinks = async (fragmentId, user, options = {}) => {
  const { limit = 10, minScore = 0.7 } = options;

  // Get the fragment
  // Include embedding which is select: false by default on the schema
  // Check if fragment has embedding
  // Include embedding which is select: false by default on the schema
  const fragment = await Fragment.findOne({ _id: fragmentId, user: user._id }).select('+embedding');

  if (!fragment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Fragment not found');
  }

  // Find IDs of already linked fragments to exclude them
  const existingLinks = await Link.find({
    $or: [
      { sourceFragment: fragmentId },
      { targetFragment: fragmentId },
    ],
    user: user._id,
  });

  const linkedFragmentIds = [
    ...new Set(
      existingLinks.flatMap(link => [
        link.sourceFragment.toString(),
        link.targetFragment.toString(),
      ])
    ),
  ];

  // Common exclusion criteria
  const exclusionQuery = {
    _id: {
      $ne: fragment._id,
      $nin: linkedFragmentIds,
    },
    user: user._id,
  };

  // 1. Try Vector Search if embedding exists
  if (fragment.embedding && fragment.embedding.length > 0) {
    try {
      const results = await Fragment.aggregate([
        {
          $search: {
            index: 'vector_index',
            knnBeta: {
              vector: fragment.embedding,
              path: 'embedding',
              k: limit,
              filter: exclusionQuery,
            },
          },
        },
        {
          $project: {
            _id: 1,
            content: 1,
            source: 1,
            score: { $meta: 'searchScore' },
          },
        },
        {
          $match: {
            score: { $gte: minScore },
          },
        },
        {
          $lookup: {
            from: 'sources',
            localField: 'source',
            foreignField: '_id',
            as: 'source',
          },
        },
        {
          $unwind: '$source',
        },
      ]);

      if (results.length > 0) return results;

    } catch (error) {
      logger.warn('Vector search for links failed, falling back to keywords:', error.message);
    }
  }

  // 2. Fallback: Keyword/Text Similarity
  // Use MongoDB text search with the fragment's keywords or content
  let fallbackQuery = { ...exclusionQuery };
  let searchTerm = '';

  if (fragment.keywords && fragment.keywords.length > 0) {
    searchTerm = fragment.keywords.join(' ');
  } else {
    // Take first 200 chars as search term if no keywords
    searchTerm = fragment.content.substring(0, 200);
  }

  if (!searchTerm) return [];

  try {
    const textResults = await Fragment.find(
      {
        ...fallbackQuery,
        $text: { $search: searchTerm }
      },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .populate('source', 'title type')
      .lean();

    return textResults.map(f => ({
      ...f,
      score: f.score || 0 // Normalizing score might be needed, but raw textScore is fine for now
    }));

  } catch (error) {
    logger.error('Keyword fallback for links failed:', error);
    return [];
  }
};

/**
 * Get topic clusters for user
 * @param {Object} user - User object
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
const getClusters = async (user, options = {}) => {
  const { createTopicClusters } = require('../services/topic-cluster.service');
  return await createTopicClusters(user._id, options);
};

/**
 * Get all links for user with pagination and filtering
 * @param {Object} user - User object
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
const getLinks = async (user, options = {}) => {
  const { page = 1, limit = 20, type } = options;
  const skip = (page - 1) * limit;

  const query = { user: user._id };
  if (type) {
    query.type = type;
  }

  const [links, total] = await Promise.all([
    Link.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sourceFragment', 'content source')
      .populate('targetFragment', 'content source')
      .lean(),
    Link.countDocuments(query)
  ]);

  // Populate source titles (nested populate not always reliable with lean)
  // We need to fetch sources separately or rely on deep populate if schema supports it
  // For now, let's just return what we have, frontend can handle missing titles or we populate

  return {
    results: links,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    totalResults: total,
  };
};

module.exports = {
  createLink,
  getFragmentLinks,
  updateLink,
  deleteLink,
  suggestLinks,
  getClusters,
  getLinks,
};
