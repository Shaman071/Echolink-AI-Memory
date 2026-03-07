const httpStatus = require('http-status');
const { Source, Fragment } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { processDocument } = require('../services/parser.service');
const embeddingService = require('../services/embedding.service');

/**
 * Upload and process a new document
 * @param {Object} file - Uploaded file
 * @param {Object} user - User object
 * @returns {Promise<Source>}
 */
const uploadDocument = async (file, user) => {
  try {
    // Create source record
    const source = await Source.create({
      user: user._id,
      title: file.originalname,
      type: 'document',
      filePath: file.path,
      fileType: file.mimetype,
      fileSize: file.size,
      status: 'processing',
    });

    // Process document in background
    processDocument(source._id, user._id)
      .then(async () => {
        // Move file to permanent storage after processing
        const { moveToPermanentStorage } = require('../services/storage.service');
        await moveToPermanentStorage(source);
      })
      .catch((error) => {
        logger.error(`Error processing document ${source._id}:`, error);
        source.status = 'error';
        source.error = {
          message: error.message,
          stack: error.stack,
        };
        source.save();
      });

    return source;
  } catch (error) {
    logger.error('Error in uploadDocument:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error uploading document');
  }
};

/**
 * Get all sources for a user
 * @param {Object} user - User object
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const getSources = async (user, options) => {
  const { page = 1, limit = 10, type } = options;
  const query = { user: user._id };

  if (type) {
    query.type = type;
  }

  const sources = await Source.paginate(query, {
    page,
    limit,
    sort: '-createdAt',
    lean: true, // Use lean for better performance
  });

  // Count fragments for each source using lean queries
  if (sources.results) {
    const sourcesWithCounts = await Promise.all(
      sources.results.map(async (source) => {
        const fragmentCount = await Fragment.countDocuments({ source: source._id });
        return { ...source, fragmentCount };
      })
    );
    sources.results = sourcesWithCounts;
  }

  return sources;
};

/**
 * Get a single source by ID
 * @param {string} sourceId - Source ID
 * @param {Object} user - User object
 * @returns {Promise<Source>}
 */
const getSource = async (sourceId, user) => {
  const source = await Source.findOne({ _id: sourceId, user: user._id }).lean();

  if (!source) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Source not found');
  }

  // Count fragments
  source.fragmentCount = await Fragment.countDocuments({ source: source._id });

  return source;
};

/**
 * Delete a source and its fragments
 * @param {string} sourceId - Source ID
 * @param {Object} user - User object
 * @returns {Promise<Object>}
 */
const deleteSource = async (sourceId, user) => {
  const source = await Source.findOne({ _id: sourceId, user: user._id });

  if (!source) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Source not found');
  }

  // PHASE 1: Get all fragment IDs for this source
  const fragments = await Fragment.find({ source: source._id })
    .select('_id')
    .lean();

  const fragmentIds = fragments.map(f => f._id);
  const fragmentIdStrings = fragmentIds.map(id => id.toString());

  logger.info(`[Delete] Source ${source._id}: Found ${fragmentIds.length} fragments to delete`);

  // PHASE 2: CASCADE DELETE - Remove all links referencing these fragments
  let linksDeletedCount = 0;
  if (fragmentIds.length > 0) {
    const { Link } = require('../models');

    // Delete links where source OR target is in the deleted fragments list
    const linksDeleted = await Link.deleteMany({
      user: user._id,
      $or: [
        { sourceFragment: { $in: fragmentIds } },
        { targetFragment: { $in: fragmentIds } }
      ]
    });

    linksDeletedCount = linksDeleted.deletedCount;
    logger.info(`[Delete] Source ${source._id}: Deleted ${linksDeletedCount} links`);
  }

  // PHASE 3: Delete all fragments & embeddings
  let fragmentsDeletedCount = 0;
  if (fragmentIds.length > 0) {
    // First, remove from external embedding service
    if (embeddingService.removeDocumentsFromService) {
      try {
        await embeddingService.removeDocumentsFromService(fragmentIdStrings);
        logger.info(`[Delete] Source ${source._id}: Removed fragments from embedding service`);
      } catch (embError) {
        logger.error(`[Delete] Source ${source._id}: Failed to remove from embedding service: ${embError.message}`);
        // Continue deletion locally even if remote fails
      }
    } else {
      logger.warn(`[Delete] Source ${source._id}: removeDocumentsFromService not found on embeddingService`);
    }

    try {
      const fragmentsDeleted = await Fragment.deleteMany({ source: source._id });
      fragmentsDeletedCount = fragmentsDeleted.deletedCount;
      logger.info(`[Delete] Source ${source._id}: Deleted ${fragmentsDeletedCount} fragments from database`);
    } catch (fragError) {
      logger.error(`[Delete] Source ${source._id}: Failed to delete fragments: ${fragError.message}`);
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to delete fragments: ${fragError.message}`);
    }
  }

  // PHASE 4: Delete the source itself
  try {
    await Source.deleteOne({ _id: source._id });
    logger.info(`[Delete] Source ${source._id}: Deleted source record`);
  } catch (sourceError) {
    logger.error(`[Delete] Source ${source._id}: Failed to delete source record: ${sourceError.message}`);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to delete source record: ${sourceError.message}`);
  }

  // PHASE 5: Clean up file if it exists
  if (source.filePath) {
    const fs = require('fs');
    try {
      if (fs.existsSync(source.filePath)) {
        fs.unlinkSync(source.filePath);
        logger.info(`[Delete] Source ${source._id}: Deleted physical file ${source.filePath}`);
      } else {
        logger.info(`[Delete] Source ${source._id}: Physical file not found at ${source.filePath}`);
      }
    } catch (fileError) {
      logger.warn(`[Delete] Source ${source._id}: Could not delete physical file: ${fileError.message}`);
      // Don't throw here, the record is already gone
    }
  }

  return {
    success: true,
    deleted: {
      source: 1,
      fragments: fragmentsDeletedCount,
      links: linksDeletedCount
    }
  };
};

/**
 * Reprocess a source
 * @param {string} sourceId - Source ID
 * @param {Object} user - User object
 * @returns {Promise<Source>}
 */
const reprocessSource = async (sourceId, user) => {
  // Get source WITHOUT lean to allow saving
  const source = await Source.findOne({ _id: sourceId, user: user._id });

  if (!source) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Source not found');
  }

  // Update status to processing
  source.status = 'processing';
  source.error = undefined;
  await source.save();

  // Process document in background
  processDocument(source._id, user._id).catch((error) => {
    logger.error(`Error reprocessing document ${source._id}:`, error);
    source.status = 'error';
    source.error = {
      message: error.message,
      stack: error.stack,
    };
    source.save();
  });

  return source;
};

const { indexSourceFragments } = require('../services/indexer.service');
const { indexFragments } = require('../services/indexer.service');
const { parseWhatsApp } = require('../services/parser.service');
const fs = require('fs');

/**
 * Import WhatsApp chat export
 * @param {Object} file - Uploaded file
 * @param {Object} user - User object
 * @returns {Promise<Object>} Result with sourceId, inserted count, and fragments
 */
const importWhatsApp = async (file, user) => {
  if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
  }

  try {
    const { path: filePath, originalname, mimetype, size } = file;

    // Read file with utf-8 encoding
    const text = fs.readFileSync(filePath, 'utf-8');

    if (!text || text.trim().length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'File is empty');
    }

    // Parse WhatsApp chat
    const messages = parseWhatsApp(text);

    if (!messages || messages.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No valid WhatsApp messages found in file');
    }

    // Create source record
    const source = await Source.create({
      user: user._id,
      title: originalname || 'WhatsApp Chat Export',
      type: 'whatsapp',
      filePath,
      fileType: mimetype,
      fileSize: size,
      status: 'processing',
    });

    // Create fragment documents from messages
    // Using the format returned by parseWhatsApp: {text, sender, datetime}
    const fragmentDocs = messages.map((message, idx) => ({
      user: user._id,
      source: source._id,
      content: message.text,
      sender: message.sender || 'Unknown',
      datetime: message.datetime || new Date(),
    }));

    // Insert all fragments
    const insertedFragments = await Fragment.insertMany(fragmentDocs);

    // Update source status
    source.status = 'processed';
    source.fragmentCount = insertedFragments.length;
    await source.save();

    // Trigger indexing asynchronously (do not block response)
    // First try to index with embed service
    indexFragments(insertedFragments).catch(err => {
      logger.error(`Background fragment indexing failed for source ${source._id}:`, err);
    });

    // Also trigger source-level indexing for metadata enrichment
    indexSourceFragments(source._id).catch(err => {
      logger.error(`Background source indexing failed for source ${source._id}:`, err);
    });

    // Return response with required format
    return {
      ok: true,
      sourceId: source._id,
      inserted: insertedFragments.length,
      fragments: insertedFragments.map(f => ({
        _id: f._id,
        text: f.text,
        sender: f.sender,
        datetime: f.datetime,
      })),
    };
  } catch (error) {
    logger.error('Error in importWhatsApp:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error importing WhatsApp chat: ' + error.message);
  }
};

// Backward compatibility alias
const importWhatsAppChat = importWhatsApp;

// Export functions individually to avoid circular dependency issues
exports.uploadDocument = uploadDocument;
exports.getSources = getSources;
exports.getSource = getSource;
exports.deleteSource = deleteSource;
exports.reprocessSource = reprocessSource;
exports.importWhatsApp = importWhatsApp;
exports.importWhatsAppChat = importWhatsAppChat;
