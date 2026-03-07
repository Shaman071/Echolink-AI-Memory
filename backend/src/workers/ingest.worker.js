const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const { processDocument } = require('../services/parser.service');
const logger = require('../utils/logger');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function processDocumentJob(sourceId, userId) {
  try {
    logger.info(`Starting document processing for source: ${sourceId}`);
    await processDocument(sourceId, userId);
    logger.info(`Completed processing for source: ${sourceId}`);
    return { success: true, sourceId };
  } catch (error) {
    logger.error(`Error processing document ${sourceId}:`, error);
    return { success: false, sourceId, error: error.message };
  }
}

// Handle messages from the main thread
parentPort.on('message', async (message) => {
  if (message.type === 'process') {
    const { sourceId, userId } = message.data;
    const result = await processDocumentJob(sourceId, userId);
    parentPort.postMessage({ type: 'complete', data: result });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// For testing with worker_threads
if (workerData) {
  const { sourceId, userId } = workerData;
  processDocumentJob(sourceId, userId)
    .then((result) => {
      if (parentPort) {
        parentPort.postMessage({ type: 'complete', data: result });
      }
    })
    .catch((error) => {
      if (parentPort) {
        parentPort.postMessage({ type: 'error', error: error.message });
      }
    });
}
