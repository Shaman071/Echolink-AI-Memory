const express = require('express');
const { Fragment, Source, Query, User, Link } = require('../models');
const { param, query } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * Get system status
 * GET /api/fragments
 * Get all fragments for the user
 */
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get counts
    const [fragmentCount, sourceCount, queryCount, linkCount, processingCount, indexingCount] = await Promise.all([
      Fragment.countDocuments({ user: userId }),
      Source.countDocuments({ user: userId }),
      Query.countDocuments({ user: userId }),
      Link.countDocuments({ user: userId }),
      Source.countDocuments({ user: userId, status: 'processing' }),
      Source.countDocuments({ user: userId, status: { $in: ['processing', 'indexing'] } }),
    ]);

    // Get last indexed timestamp
    const lastIndexedSource = await Source.findOne(
      { user: userId, indexedAt: { $exists: true } }
    )
      .sort('-indexedAt')
      .select('indexedAt')
      .lean();

    // Get recent activity with lean
    const recentSources = await Source.find({ user: userId })
      .sort('-createdAt')
      .limit(5)
      .select('title type status createdAt')
      .lean();

    const recentQueries = await Query.find({ user: userId })
      .sort('-createdAt')
      .limit(5)
      .select('queryText status createdAt')
      .lean();

    // Calculate average links per fragment
    const avgLinksPerFragment = fragmentCount > 0 ? (linkCount / fragmentCount).toFixed(2) : 0;

    res.json({
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
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get fragments with filters
 */
router.get(
  '/fragments',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sourceId').optional().isMongoId(),
    query('sender').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('keywords').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, sourceId, sender, startDate, endDate, keywords } = req.query;
      const filterQuery = { user: req.user._id };

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

      const fragments = await Fragment.paginate(filterQuery, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: '-datetime',
        populate: 'source',
        lean: true,
      });

      res.json(fragments);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update a fragment
 */
router.patch('/fragments/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, keywords, topics, sender } = req.body;

    const fragment = await Fragment.findOne({ _id: id, user: req.user._id });

    if (!fragment) {
      return res.status(404).json({ message: 'Fragment not found' });
    }

    if (content !== undefined) fragment.content = content;
    if (keywords !== undefined) fragment.keywords = keywords;
    if (topics !== undefined) fragment.topics = topics;
    if (sender !== undefined) fragment.sender = sender;

    await fragment.save();

    res.json(fragment);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/fragments/:id
 * Delete a fragment
 */
router.delete(
  '/fragments/:id',
  authenticate,
  [
    param('id').isMongoId(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const fragment = await Fragment.findOne({ _id: id, user: req.user._id });

      if (!fragment) {
        return res.status(404).json({ message: 'Fragment not found' });
      }

      // Delete associated links
      await Link.deleteMany({
        user: req.user._id,
        $or: [{ sourceFragment: id }, { targetFragment: id }],
      });

      await Fragment.deleteOne({ _id: id, user: req.user._id });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get graph data for visualization
 */
router.get('/graph', authenticate, async (req, res, next) => {
  try {
    const { rootId, depth = 2, limit = 50 } = req.query;
    const { Link, Fragment } = require('../models');

    let fragmentIds = new Set();
    let links = [];

    if (rootId) {
      // BFS to find connected fragments
      let queue = [{ id: rootId, currentDepth: 0 }];
      let visited = new Set([rootId]);
      fragmentIds.add(rootId);

      while (queue.length > 0 && fragmentIds.size < limit) {
        const { id, currentDepth } = queue.shift();

        if (currentDepth >= depth) continue;

        const fragmentLinks = await Link.find({
          $or: [{ sourceFragment: id }, { targetFragment: id }],
          user: req.user._id,
        });

        for (const link of fragmentLinks) {
          const nextId = link.sourceFragment.toString() === id
            ? link.targetFragment.toString()
            : link.sourceFragment.toString();

          if (!visited.has(nextId)) {
            visited.add(nextId);
            fragmentIds.add(nextId);
            queue.push({ id: nextId, currentDepth: currentDepth + 1 });
          }

          links.push({
            source: link.sourceFragment.toString(),
            target: link.targetFragment.toString(),
            type: link.type,
            strength: link.strength,
          });
        }
      }
    } else {
      // Get all fragments and links for user with lean
      const allFragments = await Fragment.find({ user: req.user._id })
        .sort('-datetime')
        .limit(limit)
        .select('_id')
        .lean();

      fragmentIds = new Set(allFragments.map(f => f._id.toString()));

      const allLinks = await Link.find({
        user: req.user._id,
        sourceFragment: { $in: Array.from(fragmentIds) },
        targetFragment: { $in: Array.from(fragmentIds) },
      });

      links = allLinks.map(link => ({
        source: link.sourceFragment.toString(),
        target: link.targetFragment.toString(),
        type: link.type,
        strength: link.strength,
      }));
    }

    // Get fragment details
    const fragments = await Fragment.find({
      _id: { $in: Array.from(fragmentIds) },
    })
      .populate('source', 'title type')
      .lean();

    const nodes = fragments.map(f => ({
      id: f._id.toString(),
      content: f.content.substring(0, 100),
      sender: f.sender,
      datetime: f.datetime,
      topics: f.topics || [],
      keywords: f.keywords || [],
      source: f.source,
    }));

    // Filter edges to ensure they connect existing nodes
    const validNodeIds = new Set(nodes.map(n => n.id));
    const validEdges = links
      .filter(l => validNodeIds.has(l.source) && validNodeIds.has(l.target))
      .map(edge => ({
        ...edge,
        id: `${edge.source}-${edge.target}` // Add stable ID for React keys
      }));

    res.json({
      nodes,
      edges: validEdges,
      count: nodes.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get timeline data
 */
router.get('/timeline', authenticate, async (req, res, next) => {
  try {
    const { sourceId, startDate, endDate } = req.query;

    const matchQuery = { user: req.user._id };
    if (sourceId) matchQuery.source = sourceId;
    if (startDate || endDate) {
      matchQuery.datetime = {};
      if (startDate) matchQuery.datetime.$gte = new Date(startDate);
      if (endDate) matchQuery.datetime.$lte = new Date(endDate);
    }

    const timeline = await Fragment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$datetime' },
          },
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

    res.json(timeline);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
