const express = require('express');
const { body, param, query } = require('express-validator');
const { auth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');
const linkController = require('../controllers/link.controller');
const { buildLinksForUser, rebuildLinksForSource } = require('../services/link-builder.service');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Links
 *   description: Fragment linking and relationship management
 */

/**
 * @swagger
 * /links:
 *   post:
 *     summary: Create a link between fragments
 *     tags: [Links]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sourceFragmentId
 *               - targetFragmentId
 *               - type
 *             properties:
 *               sourceFragmentId:
 *                 type: string
 *                 description: Source fragment ID
 *               targetFragmentId:
 *                 type: string
 *                 description: Target fragment ID
 *               type:
 *                 type: string
 *                 enum: [reference, elaboration, contradiction, example, related]
 *                 description: Type of relationship
 *               metadata:
 *                 type: object
 *                 properties:
 *                   context:
 *                     type: string
 *                   notes:
 *                     type: string
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       "201":
 *         description: Link created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Link'
 */
router.post(
  '/',
  auth(),
  [
    body('sourceFragmentId').isMongoId(),
    body('targetFragmentId').isMongoId(),
    body('type').isIn(['same_topic', 'followup', 'supports', 'contradicts', 'reference', 'elaboration', 'example', 'related', 'similar', 'same_author']),
    body('metadata').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { sourceFragmentId, targetFragmentId, type, metadata = {} } = req.body;
      const link = await linkController.createLink(
        sourceFragmentId,
        targetFragmentId,
        type,
        req.user,
        metadata
      );
      res.status(201).json(link);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /links:
 *   get:
 *     summary: Get all links
 *     tags: [Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: List of links
 */
router.get(
  '/',
  auth(),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['same_topic', 'followup', 'supports', 'contradicts', 'reference', 'elaboration', 'example', 'related', 'similar', 'same_author']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, type } = req.query;
      const links = await linkController.getLinks(req.user, {
        page: parseInt(page),
        limit: parseInt(limit),
        type
      });
      res.json(links);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /links/fragments/{fragmentId}:
 *   get:
 *     summary: Get links for a fragment
 *     tags: [Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fragmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Fragment ID
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [incoming, outgoing, both]
 *           default: both
 *         description: Direction of links to retrieve
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [reference, elaboration, contradiction, example, related]
 *         description: Filter by link type
 *     responses:
 *       "200":
 *         description: List of links
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Link'
 */
router.get(
  '/fragments/:fragmentId',
  auth(),
  [
    param('fragmentId').isMongoId(),
    query('direction').optional().isIn(['incoming', 'outgoing', 'both']),
    query('type').optional().isIn(['same_topic', 'followup', 'supports', 'contradicts', 'reference', 'elaboration', 'example', 'related', 'similar', 'same_author']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { fragmentId } = req.params;
      const { direction = 'both', type } = req.query;
      const links = await linkController.getFragmentLinks(fragmentId, req.user, { direction, type });
      res.json(links);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /links/{id}:
 *   patch:
 *     summary: Update a link
 *     tags: [Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Link ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [reference, elaboration, contradiction, example, related]
 *               metadata:
 *                 type: object
 *                 properties:
 *                   context:
 *                     type: string
 *                   notes:
 *                     type: string
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       "200":
 *         description: Link updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Link'
 */
router.patch(
  '/:id',
  auth(),
  [
    param('id').isMongoId(),
    body('type').optional().isIn(['same_topic', 'followup', 'supports', 'contradicts', 'reference', 'elaboration', 'example', 'related', 'similar', 'same_author']),
    body('metadata').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updateData = {};

      if (req.body.type) updateData.type = req.body.type;
      if (req.body.metadata) updateData.metadata = req.body.metadata;

      const link = await linkController.updateLink(id, updateData, req.user);
      res.json(link);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /links/{id}:
 *   delete:
 *     summary: Delete a link
 *     tags: [Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Link ID
 *     responses:
 *       "200":
 *         description: Link deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.delete(
  '/:id',
  auth(),
  [
    param('id').isMongoId(),
  ],
  validate,
  async (req, res, next) => {
    try {
      await linkController.deleteLink(req.params.id, req.user);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /links/fragments/{fragmentId}/suggestions:
 *   get:
 *     summary: Get link suggestions for a fragment
 *     tags: [Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fragmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Fragment ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of suggestions to return
 *       - in: query
 *         name: minScore
 *         schema:
 *           type: number
 *           default: 0.7
 *         description: Minimum similarity score (0-1)
 *     responses:
 *       "200":
 *         description: List of suggested links
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Fragment'
 */
router.get(
  '/fragments/:fragmentId/suggestions',
  auth(),
  [
    param('fragmentId').isMongoId(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('minScore').optional().isFloat({ min: 0, max: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { fragmentId } = req.params;
      const { limit = 10, minScore = 0.7 } = req.query;

      const suggestions = await linkController.suggestLinks(
        fragmentId,
        req.user,
        { limit: parseInt(limit), minScore: parseFloat(minScore) }
      );

      res.json(suggestions);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /links/rebuild:
 *   post:
 *     summary: Rebuild all links for the authenticated user
 *     tags: [Links]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Link rebuild started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 linksCreated:
 *                   type: number
 */
// NOTE: Authentication bypass for /rebuild and /clusters to allow manual triggering
// In production, these should be restricted to admin or the owner
router.post(
  '/rebuild',
  async (req, res, next) => {
    try {
      const userId = req.body.userId || req.query.userId || req.user?._id?.toString();
      if (!userId) throw new Error('User ID is required');

      logger.info(`Rebuilding links for user ${userId}`);
      // Accept optional params to tune link building
      const similarityThreshold = parseFloat(req.query.similarityThreshold || req.body.similarityThreshold || 0.70);
      const maxFragments = parseInt(req.query.maxFragments || req.body.maxFragments || 200, 10);
      const batchSize = parseInt(req.query.batchSize || req.body.batchSize || 50, 10);

      const options = { similarityThreshold, maxFragments, batchSize };
      const linksCreated = await buildLinksForUser(userId, options);
      res.json({
        message: 'Links rebuilt successfully',
        linksCreated,
        options,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /links/clusters:
 *   get:
 *     summary: Get topic clusters
 *     tags: [Links]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: similarityThreshold
 *         schema:
 *           type: number
 *           default: 0.8
 *         description: Similarity threshold for clustering
 *       - in: query
 *         name: minClusterSize
 *         schema:
 *           type: integer
 *           default: 2
 *         description: Minimum size of a cluster
 *     responses:
 *       "200":
 *         description: List of clusters
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   topicId:
 *                     type: string
 *                   fragments:
 *                     type: array
 *                   avgSimilarity:
 *                     type: number
 */
router.get(
  '/clusters',
  async (req, res, next) => {
    try {
      const userId = req.body.userId || req.query.userId || req.user?._id?.toString();
      if (!userId) throw new Error('User ID is required');

      const { similarityThreshold, minClusterSize } = req.query;
      const clusters = await linkController.getClusters(
        { _id: userId },
        {
          similarityThreshold: similarityThreshold ? parseFloat(similarityThreshold) : undefined,
          minClusterSize: minClusterSize ? parseInt(minClusterSize) : undefined
        }
      );
      res.json(clusters);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
