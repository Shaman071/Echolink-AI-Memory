const express = require('express');
const { body, query, param } = require('express-validator');
const { auth } = require('../middleware/auth.middleware');
const { userRateLimit } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const queryController = require('../controllers/query.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Query
 *   description: Document query and search
 */

/**
 * @swagger
 * /query:
 *   post:
 *     summary: Search for fragments
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *               sourceId:
 *                 type: string
 *                 description: Filter by source ID
 *               limit:
 *                 type: integer
 *                 default: 10
 *                 description: Maximum number of results to return
 *               threshold:
 *                 type: number
 *                 default: 0.7
 *                 description: Minimum similarity threshold (0-1)
 *     responses:
 *       "200":
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Fragment'
 *                 count:
 *                   type: integer
 */
// Rate limit queries: 60 per user per 10 minutes
const queryRateLimit = userRateLimit({ windowMs: 10 * 60 * 1000, max: 60 });

/**
 * POST /api/query - New semantic search using embed service
 * Returns summary, evidence, timeline, graph
 */
router.post(
  '/',
  auth(),
  queryRateLimit,
  [
    body('query')
      .not().isEmpty().withMessage('Query is required')
      .isString().withMessage('Query must be a string')
      .trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { query: searchQuery, k } = req.body;
      const results = await queryController.searchQuery(searchQuery, req.user, { k });
      res.json(results);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /query/fragments/{id}:
 *   get:
 *     summary: Get a fragment by ID
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Fragment ID
 *     responses:
 *       "200":
 *         description: Fragment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fragment'
 */
router.get(
  '/fragments/:id',
  auth(),
  [
    param('id').isMongoId(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const fragment = await queryController.getFragment(req.params.id, req.user);
      res.json(fragment);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /query/fragments/{id}/related:
 *   get:
 *     summary: Get related fragments
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Fragment ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Maximum number of related fragments to return
 *       - in: query
 *         name: minScore
 *         schema:
 *           type: number
 *           default: 0.6
 *         description: Minimum similarity score (0-1)
 *     responses:
 *       "200":
 *         description: Related fragments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fragment:
 *                   $ref: '#/components/schemas/Fragment'
 *                 related:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Fragment'
 */
router.get(
  '/fragments/:id/related',
  auth(),
  [
    param('id').isMongoId(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('minScore').optional().isFloat({ min: 0, max: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { limit, minScore } = req.query;
      const results = await queryController.getRelatedFragments(
        req.params.id,
        req.user,
        { limit: parseInt(limit) || 5, threshold: parseFloat(minScore) || 0.6 }
      );
      res.json(results);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /query/history:
 *   get:
 *     summary: Get query history
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       "200":
 *         description: Query history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/QueryHistory'
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalResults:
 *                   type: integer
 */
router.get(
  '/history',
  auth(),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const history = await queryController.getQueryHistory(req.user, { page, limit });
      res.json(history);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
