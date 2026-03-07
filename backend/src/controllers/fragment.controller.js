const { Fragment, Source, Query, Link } = require('../models');

/**
 * Build dashboard and system status snapshot for a user
 */
const getStatus = async (userId) => {
  const [fragmentCount, sourceCount, queryCount, linkCount, processingCount, indexingCount] = await Promise.all([
    Fragment.countDocuments({ user: userId }),
    Source.countDocuments({ user: userId }),
    Query.countDocuments({ user: userId }),
    Link.countDocuments({ user: userId }),
    Source.countDocuments({ user: userId, status: 'processing' }),
    Source.countDocuments({ user: userId, status: { $in: ['processing', 'indexing'] } }),
  ]);

  const lastIndexedSource = await Source.findOne({ user: userId, indexedAt: { $exists: true } })
    .sort('-indexedAt')
    .select('indexedAt')
    .lean();

  const [recentSources, recentQueries] = await Promise.all([
    Source.find({ user: userId }).sort('-createdAt').limit(5).select('title type status createdAt').lean(),
    Query.find({ user: userId }).sort('-createdAt').limit(5).select('queryText status createdAt').lean(),
  ]);

  const avgLinksPerFragment = fragmentCount > 0 ? (linkCount / fragmentCount).toFixed(2) : 0;

  return {
    counts: {
      fragments: fragmentCount,
      sources: sourceCount,
      queries: queryCount,
      processing: processingCount,
    },
    indexing: indexingCount > 0,
    lastIndexedAt: lastIndexedSource?.indexedAt || null,
    queueLength: indexingCount,
    totalLinks: linkCount,
    avgLinksPerFragment: parseFloat(avgLinksPerFragment),
    recent: {
      sources: recentSources,
      queries: recentQueries,
    },
    status: 'healthy',
    timestamp: new Date(),
  };
};

/**
 * List fragments for a user with optional filters
 */
const listFragments = async (userId, filters) => {
  const { page = 1, limit = 20, sourceId, sender, startDate, endDate, keywords } = filters;
  const filterQuery = { user: userId };

  if (sourceId) filterQuery.source = sourceId;
  if (sender) filterQuery.sender = new RegExp(sender, 'i');
  if (startDate || endDate) {
    filterQuery.datetime = {};
    if (startDate) filterQuery.datetime.$gte = new Date(startDate);
    if (endDate) filterQuery.datetime.$lte = new Date(endDate);
  }
  if (keywords) {
    filterQuery.keywords = { $in: keywords.split(',') };
  }

  return Fragment.paginate(filterQuery, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: '-datetime',
    populate: 'source',
    lean: true,
  });
};

/**
 * Update fragment fields (content/keywords/topics/sender)
 */
const updateFragment = async (fragmentId, userId, updates) => {
  const fragment = await Fragment.findOne({ _id: fragmentId, user: userId });

  if (!fragment) {
    return null;
  }

  const { content, keywords, topics, sender } = updates;
  if (content !== undefined) fragment.content = content;
  if (keywords !== undefined) fragment.keywords = keywords;
  if (topics !== undefined) fragment.topics = topics;
  if (sender !== undefined) fragment.sender = sender;

  await fragment.save();
  return fragment;
};

/**
 * Delete a fragment and related links
 */
const deleteFragment = async (fragmentId, userId) => {
  const fragment = await Fragment.findOne({ _id: fragmentId, user: userId });

  if (!fragment) {
    return false;
  }

  await Link.deleteMany({
    user: userId,
    $or: [{ sourceFragment: fragmentId }, { targetFragment: fragmentId }],
  });

  await Fragment.deleteOne({ _id: fragmentId, user: userId });
  return true;
};

/**
 * Produce graph nodes/edges for fragments and links
 */
/**
 * Produce graph nodes/edges for fragments and links
 */
const getGraph = async (userId, { rootId, depth = 2, limit = 100 }) => {
  let fragmentIds = new Set();
  let links = [];

  if (rootId) {
    const queue = [{ id: rootId, currentDepth: 0 }];
    const visited = new Set([rootId]);
    fragmentIds.add(rootId);

    // Increase limit for BFS exploration
    const explorationLimit = limit * 2;

    while (queue.length > 0 && fragmentIds.size < explorationLimit) {
      const { id, currentDepth } = queue.shift();
      if (currentDepth >= depth) continue;

      // Find links where this node is source OR target
      const fragmentLinks = await Link.find({
        $or: [{ sourceFragment: id }, { targetFragment: id }],
        user: userId,
      }).limit(50); // limit per node to avoid explosion

      for (const link of fragmentLinks) {
        if (!link.sourceFragment || !link.targetFragment) continue;

        const sourceIdStr = link.sourceFragment.toString();
        const targetIdStr = link.targetFragment.toString();
        const nextId = sourceIdStr === id ? targetIdStr : sourceIdStr;

        if (!visited.has(nextId)) {
          visited.add(nextId);
          fragmentIds.add(nextId);
          queue.push({ id: nextId, currentDepth: currentDepth + 1 });
        }

        // Add edge
        links.push({
          source: sourceIdStr,
          target: targetIdStr,
          type: link.type,
          strength: link.strength,
        });
      }
    }
  } else {
    // No root - get most recent fragments
    const allFragments = await Fragment.find({ user: userId })
      .sort('-datetime')
      .limit(limit)
      .select('_id')
      .lean();

    fragmentIds = new Set(allFragments.map((f) => f._id.toString()));

    // Get all links between these fragments
    const allLinks = await Link.find({
      user: userId,
      sourceFragment: { $in: Array.from(fragmentIds) },
      targetFragment: { $in: Array.from(fragmentIds) },
    });

    links = allLinks.map((link) => {
      const source = link.sourceFragment ? link.sourceFragment.toString() : null;
      const target = link.targetFragment ? link.targetFragment.toString() : null;

      if (!source || !target) return null;

      return {
        source,
        target,
        type: link.type,
        strength: link.strength,
      };
    }).filter(l => l !== null);
  }

  // Hydrate fragments
  const fragments = await Fragment.find({ _id: { $in: Array.from(fragmentIds) } })
    .populate('source', 'title type')
    .lean();

  const nodes = fragments.map((f) => ({
    id: f._id.toString(),
    content: f.content ? f.content.substring(0, 100) : '...',
    sender: f.sender,
    datetime: f.datetime,
    topics: f.topics || [],
    keywords: f.keywords || [],
    source: f.source,
    // Add group based on first topic or source type for visualization clustering
    group: f.topics && f.topics.length > 0 ? f.topics[0] : (f.source?.type || 'other')
  }));

  return {
    nodes,
    edges: links,
    count: nodes.length,
  };
};

/**
 * Timeline aggregation data
 */
const getTimeline = async (userId, { sourceId, startDate, endDate }) => {
  const matchQuery = { user: userId };
  if (sourceId) matchQuery.source = sourceId;
  if (startDate || endDate) {
    matchQuery.datetime = {};
    if (startDate) matchQuery.datetime.$gte = new Date(startDate);
    if (endDate) matchQuery.datetime.$lte = new Date(endDate);
  }

  return Fragment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$datetime' } },
        count: { $sum: 1 },
        topics: { $push: '$topics' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: '$_id',
        count: 1,
        topics: {
          $reduce: {
            input: '$topics',
            initialValue: [],
            in: { $setUnion: ['$$value', '$$this'] },
          },
        },
      },
    },
  ]);
};

module.exports = {
  getStatus,
  listFragments,
  updateFragment,
  deleteFragment,
  getGraph,
  getTimeline,
};

