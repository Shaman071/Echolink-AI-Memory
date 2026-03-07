const express = require('express');
const { param } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');
const { Fragment } = require('../models');

const router = express.Router();

const config = require('../config/config');
const logger = require('../utils/logger');

// GET /debug/queue - return job queue stats (if Redis/BullMQ configured)
router.get('/queue', async (req, res) => {
  try {
    if (!config.redis || !config.redis.url) {
      return res.json({ ok: true, message: 'Redis not configured', redis: false });
    }
    try {
      const { Queue } = require('bullmq');
      const queue = new Queue('echolink-jobs', { connection: { url: config.redis.url } });
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      return res.json({ ok: true, redis: true, counts });
    } catch (err) {
      logger.error('Debug /queue error', err);
      return res.status(500).json({ ok: false, error: 'Failed to read BullMQ queue' });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /debug/embedding/circuit - return circuit-breaker state
router.get('/embedding/circuit', async (req, res) => {
  try {
    const embeddingSvc = require('../services/embedding.service');
    const state = embeddingSvc.getCircuitState ? embeddingSvc.getCircuitState() : { available: false };
    res.json({ ok: true, circuit: state });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /debug/fragment/:id
 * Return a fragment including its embedding for debugging
 */
router.get('/fragment/:id', authenticate, [param('id').isMongoId()], validate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const fragment = await Fragment.findOne({ _id: id, user: req.user._id }).select('+embedding').populate('source', 'title type').lean();
    if (!fragment) return res.status(404).json({ message: 'Fragment not found' });
    res.json(fragment);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

