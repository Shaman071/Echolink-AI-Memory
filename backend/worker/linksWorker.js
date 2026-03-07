#!/usr/bin/env node
// Worker to process background jobs (link rebuild etc.) using BullMQ
require('dotenv').config();
const { Worker } = require('bullmq');
const config = require('../src/config/config');
const logger = require('../src/utils/logger');

if (!config.redis || !config.redis.url) {
  logger.error('linksWorker: REDIS_URL not configured. Set REDIS_URL to enable BullMQ worker.');
  process.exit(1);
}

const worker = new Worker('echolink-jobs', async (job) => {
  logger.info(`linksWorker: processing job ${job.id} type=${job.name}`);
  const { type, args } = job.data || {};
  if (type === 'rebuildLinksForSource') {
    const { rebuildLinksForSource } = require('../src/services/link-builder.service');
    const { sourceId, options } = args || {};
    if (!sourceId) throw new Error('sourceId missing for rebuildLinksForSource');
    return await rebuildLinksForSource(sourceId, options || {});
  }
  throw new Error(`Unrecognized job type: ${type}`);
}, { connection: { url: config.redis.url } });

worker.on('completed', (job) => {
  logger.info(`linksWorker: job completed ${job.id}`);
});

worker.on('failed', (job, err) => {
  logger.error(`linksWorker: job failed ${job.id}`, err);
});

process.on('SIGINT', async () => {
  logger.info('linksWorker: shutting down...');
  await worker.close();
  process.exit(0);
});

logger.info('linksWorker: started and listening for jobs');
