const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth.middleware');
const { userRateLimit } = require('../middleware/rateLimit');
const importController = require('../controllers/import.controller');
const { splitTextIntoChunks } = require('../services/parser.service');
const { indexSourceFragments } = require('../services/indexer.service');
const { Source, Fragment } = require('../models');

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Rate limit uploads: 10 per user per 10 minutes
const uploadRateLimit = userRateLimit({ windowMs: 10 * 60 * 1000, max: 10 });
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize file name: remove dangerous chars, allow only safe
    let safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    safeName = safeName.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Accept only specific file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, TXT, MD, PNG, and JPG files are allowed.'), false);
  }
};

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * @swagger
 * tags:
 *   name: Import
 *   description: Document import and management
 */

/**
 * @swagger
 * /import/upload:
 *   post:
 *     summary: Upload a document
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       "201":
 *         description: Document uploaded and processing started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Source'
 */
router.post(
  '/upload',
  auth(),
  uploadRateLimit,
  uploadMiddleware.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Fallback: create source and process in background
      const source = await importController.uploadDocument(req.file, req.user);
      res.status(201).json(source);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /import/text
 * Accepts JSON { title, text } and creates a Source + Fragments
 */
router.post('/text', auth(), uploadRateLimit, async (req, res, next) => {
  try {
    const { title, text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'text is required' });
    }

    const userId = req.user._id;

    // Create source document
    const source = await Source.create({
      user: userId,
      title: title || 'Text import',
      type: 'text',
      filePath: null,
      fileType: 'text/plain',
      fileSize: Buffer.byteLength(text, 'utf-8'),
      status: 'processing',
    });

    // Split into chunks and create fragments
    const chunks = splitTextIntoChunks(text);
    const fragmentDocs = chunks.map((chunk, idx) => ({
      user: userId,
      source: source._id,
      content: chunk,
      datetime: new Date(),
      status: 'pending',
      metadata: { chunkIndex: idx, totalChunks: chunks.length },
    }));

    const insertedFragments = await Fragment.insertMany(fragmentDocs);

    source.status = 'processed';
    await source.save();

    // Trigger background indexing
    indexSourceFragments(source._id).catch(err => {
      console.error('Background indexing failed for text source', source._id, err);
    });

    res.status(200).json({
      ok: true,
      sourceId: source._id,
      inserted: insertedFragments.length,
      fragments: insertedFragments.map(f => ({ _id: f._id, text: f.content, sender: f.sender || null, datetime: f.datetime })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /import/sources:
 *   get:
 *     summary: Get all sources
 *     tags: [Import]
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
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [document, webpage, video, audio, other]
 *         description: Filter by source type
 *     responses:
 *       "200":
 *         description: List of sources
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Source'
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalResults:
 *                   type: integer
 */
router.get('/sources', auth(), async (req, res, next) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const sources = await importController.getSources(req.user, { page, limit, type });
    res.json(sources);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /import/sources/{id}:
 *   get:
 *     summary: Get a source by ID
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Source ID
 *     responses:
 *       "200":
 *         description: Source details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Source'
 */
router.get('/sources/:id', auth(), async (req, res, next) => {
  try {
    const source = await importController.getSource(req.params.id, req.user);
    res.json(source);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /import/sources/{id}:
 *   delete:
 *     summary: Delete a source
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Source ID
 *     responses:
 *       "200":
 *         description: Source deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
router.delete('/sources/:id', auth(), async (req, res, next) => {
  try {
    await importController.deleteSource(req.params.id, req.user);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /import/sources/{id}/reprocess:
 *   post:
 *     summary: Reprocess a source
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Source ID
 *     responses:
 *       "200":
 *         description: Source reprocessing started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Source'
 */
router.post('/sources/:id/reprocess', auth(), async (req, res, next) => {
  try {
    const source = await importController.reprocessSource(req.params.id, req.user);
    res.json(source);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /import/sources/{id}/index
 * Trigger indexing for a source (manual)
 */
router.post('/sources/:id/index', auth(), async (req, res, next) => {
  try {
    const sourceId = req.params.id;
    const batchSize = parseInt(req.body.batchSize, 10) || 5;
    const force = req.body.force === true || req.query.force === 'true';

    const results = await indexSourceFragments(sourceId, { batchSize, force });
    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /import/whatsapp
 * Upload and import WhatsApp chat export
 * Returns: { ok: true, sourceId, inserted, fragments: [{_id, text, sender, datetime}] }
 */
router.post(
  '/whatsapp',
  auth(),
  uploadRateLimit,
  uploadMiddleware.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'No file uploaded' });
      }

      const result = await importController.importWhatsApp(req.file, req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
