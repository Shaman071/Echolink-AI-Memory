// Job queue: use BullMQ (Redis) when available, otherwise fall back to in-process queue
const logger = require('../utils/logger');
const config = require('../config/config');

let queueImpl = null;

if (config && config.redis && config.redis.url) {
  try {
    const { Queue, Worker } = require('bullmq');
    const queue = new Queue('echolink-jobs', { connection: { url: config.redis.url } });

    // Simple worker that executes JS functions stored in job.data.fnName - not secure
    // We'll only use BullMQ to schedule a wrapper job that calls a local handler
    const worker = new Worker('echolink-jobs', async job => {
      const { type, args } = job.data || {};
      // For now support 'rebuildLinksForSource' type
      if (type === 'rebuildLinksForSource') {
        const { rebuildLinksForSource } = require('../services/link-builder.service');
        return await rebuildLinksForSource(args.sourceId);
      }
      throw new Error(`Unknown job type: ${type}`);
    }, { connection: { url: config.redis.url } });

    queueImpl = {
      enqueue: async (fn, meta = {}) => {
        // If meta.type is provided, schedule that job
        if (meta && meta.type) {
          const job = await queue.add(meta.type, { type: meta.type, args: meta.args || {} });
          return job.id;
        }
        // If no type, fallback to immediate execution
        return await fn();
      },
    };
    logger.info('JobQueue: using BullMQ (Redis) backend');
  } catch (err) {
    logger.warn('JobQueue: BullMQ not available or failed to init, falling back to in-memory queue:', err.message || err);
  }
}

// Fallback in-process queue
if (!queueImpl) {
  class JobQueue {
    constructor() {
      this.queue = [];
      this.running = false;
    }

    enqueue(fn, meta = {}) {
      return new Promise((resolve, reject) => {
        this.queue.push({ fn, resolve, reject, meta });
        this._run();
      });
    }

    async _run() {
      if (this.running) return;
      this.running = true;
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        try {
          const result = await job.fn();
          job.resolve(result);
        } catch (err) {
          logger.error('Job failed:', err);
          job.reject(err);
        }
      }
      this.running = false;
    }
  }

  queueImpl = new JobQueue();
}

module.exports = queueImpl;
