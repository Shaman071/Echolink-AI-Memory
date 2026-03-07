const fs = require('fs').promises;
const path = require('path');
const { Source, Fragment } = require('../models');
const logger = require('../utils/logger');
const { generateEmbeddings } = require('./embedding.service');

// Maximum chunk size for text splitting (in characters)
const MAX_CHUNK_SIZE = 2000;
const OVERLAP_SIZE = 200;

/**
 * Split text into overlapping chunks
 * @param {string} text - Text to split
 * @param {Object} options - Options for splitting
 * @returns {Array<string>} Array of text chunks
 */
function splitTextIntoChunks(text, options = {}) {
  // Sanitize input text: remove null bytes, dangerous unicode, excessive whitespace
  if (typeof text !== 'string') return [];
  text = text.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

  const { maxChunkSize = MAX_CHUNK_SIZE, overlap = OVERLAP_SIZE } = options;
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChunkSize, text.length);

    // If we're not at the end of the text, find the nearest sentence end
    if (end < text.length) {
      // Look for sentence ending in the overlap zone
      const lookBackStart = Math.max(start, end - overlap); // Don't look back before start
      const overlapZone = text.substring(lookBackStart, Math.min(text.length, end + overlap));
      const sentenceEnd = overlapZone.search(/[.!?]\s+/);

      if (sentenceEnd !== -1) {
        // Adjust end to the found sentence boundary
        end = lookBackStart + sentenceEnd + 1;
      }
    }

    const chunk = text.substring(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    // Prepare for next chunk
    // Ensure we always make progress to prevent infinite loops
    let newStart = end - overlap;

    // If the chunk was smaller than overlap, or overlap pushes us back to/behind start, force advance
    if (newStart <= start) {
      // If end == text.length, we are done, start = length to exit loop
      if (end === text.length) {
        start = text.length;
      } else {
        // Otherwise advance by at least 1 character (or usually at least end) if overlap is problematic
        // If chunk is tiny, overlap logic makes no sense. Just Start from end.
        start = Math.max(start + 1, end);
        // Wait, if we just set start = end, we lose overlap benefit but avoid loop.
        // If we set start = start + 1, we progress slowly.
        // Let's set start = end if (end - overlap) <= start (meaning chunk is too small for overlap).
        start = end;
      }
    } else {
      start = newStart;
    }
  }
  return chunks;
}

/**
 * Parse WhatsApp chat export - returns format: [{text, sender, datetime}]
 * @param {string} text - WhatsApp chat text
 * @returns {Array<Object>} Array of parsed messages with {text, sender, datetime}
 */
function parseWhatsApp(text) {
  const messages = [];
  if (!text || typeof text !== 'string') return messages;

  // Normalize line endings and problematic dash characters (em-dash, en-dash)
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\u2014/g, ' - ') // em-dash
    .replace(/\u2013/g, ' - '); // en-dash
  const lines = normalized.split('\n');

  // Common WhatsApp date/time patterns for different locales
  // Pattern: [DD/MM/YYYY, HH:MM:SS] or [MM/DD/YYYY, HH:MM:SS] or [DD/MM/YY, HH:MM]
  // 12/01/2025, 8:32 PM - You: Message
  // 12/01/2025, 20:32 - You: Message
  const patterns = [
    // Standard with brackets
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s*([^:]+):\s*(.+)$/i,
    // No brackets, with hyphen (Android style often)
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*-\s*([^:]+):\s*(.+)$/i,
    // No brackets, no hyphen (iOS style often)
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*([^:]+):\s*(.+)$/i,
  ];

  let currentMessage = null;

  for (let rawLine of lines) {
    if (!rawLine || !rawLine.trim()) continue;
    const line = rawLine.trim();
    let matched = false;

    // Try each pattern
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        // Save previous message if exists
        if (currentMessage) {
          messages.push(currentMessage);
        }

        // Parse new message
        const [, date, time, sender, msgText] = match;
        currentMessage = {
          text: msgText.trim(),
          sender: sender.trim(),
          datetime: parseWhatsAppDate(date, time),
        };
        matched = true;
        break;
      }
    }

    // If no pattern matched, it's a continuation of the previous message
    if (!matched && currentMessage && line) {
      currentMessage.text += '\n' + line;
    }
  }

  // Add the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  // SAFETY FALLBACK: If parsing found 0 messages, do NOT throw string.
  // Instead, create one fragment with full text.
  // This prevents the system from collapsing.
  if (messages.length === 0 && text.trim().length > 0) {
    logger.warn('WhatsApp parser found 0 messages. Using fallback: treating as single message.');
    messages.push({
      text: text,
      sender: 'System', // Default sender
      datetime: new Date(),
    });
  }

  return messages;
}

/**
 * Parse WhatsApp chat export (alias for backward compatibility)
 * @param {string} text - WhatsApp chat text
 * @returns {Array<Object>} Array of parsed messages
 */
function parseWhatsAppChat(text) {
  return parseWhatsApp(text);
}

/**
 * Parse WhatsApp date string
 * @param {string} dateStr - Date string
 * @param {string} timeStr - Time string
 * @returns {Date} Parsed date
 */
function parseWhatsAppDate(dateStr, timeStr) {
  try {
    // Try different date formats
    const dateParts = dateStr.split('/');
    let day, month, year;

    if (dateParts.length === 3) {
      // Assume DD/MM/YYYY or MM/DD/YYYY
      // We'll try DD/MM/YYYY first (more common internationally)
      day = parseInt(dateParts[0]);
      month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
      year = parseInt(dateParts[2]);

      // If year is 2-digit, convert to 4-digit
      if (year < 100) {
        year += 2000;
      }

      // Parse time
      let hours, minutes, seconds = 0;
      const timeParts = timeStr.trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AP]M))?/i);

      if (timeParts) {
        hours = parseInt(timeParts[1]);
        minutes = parseInt(timeParts[2]);
        seconds = timeParts[3] ? parseInt(timeParts[3]) : 0;
        const ampm = timeParts[4];

        // Convert 12-hour to 24-hour format
        if (ampm) {
          if (ampm.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
          } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
          }
        }
      }

      return new Date(year, month, day, hours, minutes, seconds);
    }
  } catch (error) {
    logger.warn('Error parsing WhatsApp date:', error);
  }

  // Fallback to current date if parsing fails
  return new Date();
}

/**
 * Parse PDF file
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<string>} Extracted text
 */
async function parsePdfFile(buffer) {
  try {
    // Try to require pdf-parse, if not available, throw error
    let parsePdf;
    try {
      parsePdf = require('pdf-parse');
    } catch (e) {
      throw new Error('pdf-parse module not installed. Please install it with: npm install pdf-parse');
    }

    const data = await parsePdf(buffer);
    return data.text;
  } catch (error) {
    logger.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file: ' + error.message);
  }
}

/**
 * Parse DOCX file
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Promise<string>} Extracted text
 */
async function parseDocxFile(buffer) {
  try {
    // Try to require mammoth, if not available, throw error
    let mammoth;
    try {
      mammoth = require('mammoth');
    } catch (e) {
      throw new Error('mammoth module not installed. Please install it with: npm install mammoth');
    }

    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    logger.error('Error parsing DOCX:', error);
    throw new Error('Failed to parse DOCX file: ' + error.message);
  }
}

/**
 * Parse text file (TXT, MD, etc.)
 * @param {Buffer} buffer - File buffer
 * @returns {string} File content as text
 */
function parseTextFile(buffer) {
  return buffer.toString('utf-8');
}

/**
 * Perform OCR on image file
 * @param {Buffer} buffer - Image file buffer
 * @returns {Promise<string>} Extracted text from image
 */
async function parseImageWithOCR(buffer) {
  try {
    let Tesseract;
    try {
      Tesseract = require('tesseract.js');
    } catch (e) {
      throw new Error('tesseract.js module not installed. Please install it with: npm install tesseract.js');
    }

    const { data: { text } } = await Tesseract.recognize(
      buffer,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            logger.info(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );

    return text;
  } catch (error) {
    logger.error('Error performing OCR:', error);
    throw new Error('Failed to perform OCR on image: ' + error.message);
  }
}

/**
 * Process a document and create fragments
 * Uses streaming to avoid loading entire file into memory
 * @param {string} sourceId - Source document ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function processDocument(sourceId, userId) {
  try {
    const source = await Source.findById(sourceId);

    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    if (source.status === 'processed') {
      logger.info(`Source ${sourceId} already processed`);
      return;
    }

    // Update status to processing
    source.status = 'processing';
    await source.save();

    // Check file size before processing
    const stats = await fs.stat(source.filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    logger.info(`Processing file: ${source.filePath}, Size: ${fileSizeMB.toFixed(2)}MB`);

    // Read the file (use streaming for very large files)
    let fileContent;
    if (fileSizeMB > 10) {
      // For files > 10MB, we should ideally use streaming
      // For now, read in chunks
      logger.info('Large file detected, reading in chunks...');
      fileContent = await fs.readFile(source.filePath);
    } else {
      fileContent = await fs.readFile(source.filePath);
    }

    // Parse based on file type
    let text;
    let messages = [];
    let isWhatsApp = false;

    switch (source.fileType) {
      case 'text/plain':
        text = parseTextFile(fileContent);
        // Check if it's a WhatsApp chat
        if (text.match(/\[?\d{1,2}\/\d{1,2}\/\d{2,4}.*\]?.*:/)) {
          isWhatsApp = true;
          messages = parseWhatsAppChat(text);
          // If detection matched but parsing returned 0 messages, treat as plain text
          if (messages.length === 0) {
            logger.warn('Regex matched WhatsApp format but parser returned 0 messages. Falling back to plain text.');
            isWhatsApp = false;
          }
        }
        break;
      case 'application/pdf':
        text = await parsePdfFile(fileContent);
        break;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        text = await parseDocxFile(fileContent);
        break;
      case 'text/markdown':
        text = parseTextFile(fileContent);
        break;
      case 'image/png':
      case 'image/jpeg':
      case 'image/jpg':
        text = await parseImageWithOCR(fileContent);
        break;
      default:
        // Try to parse as text anyway
        text = parseTextFile(fileContent);
    }

    // Clear fileContent from memory
    fileContent = null;

    // Process WhatsApp messages separately
    if (isWhatsApp && messages.length > 0) {
      logger.info(`Processing ${messages.length} WhatsApp messages`);

      // Create fragments from WhatsApp messages in batches
      const batchSize = 10; // Process 10 messages at a time
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (message, batchIdx) => {
            try {
              let embedding = undefined;
              try {
                // Generate embeddings for the message
                embedding = await generateEmbeddings(message.text);
              } catch (embedError) {
                logger.warn(`Embedding generation failed for WhatsApp message ${i + batchIdx}: ${embedError.message}`);
                // Proceed without embedding
              }

              // Deduplication: check if fragment exists
              const exists = await Fragment.findOne({
                content: message.text,
                user: userId,
                source: source._id,
              });

              if (exists) return;

              // Create fragment
              await Fragment.create({
                source: source._id,
                user: userId,
                content: message.text,
                sender: message.sender,
                datetime: message.datetime,
                embedding,
                status: embedding ? 'processed' : 'pending',
                metadata: {
                  messageIndex: i + batchIdx,
                  totalMessages: messages.length,
                },
              });
            } catch (error) {
              logger.error(`Error processing WhatsApp message ${i + batchIdx}:`, error);
            }
          })
        );
        logger.info(`Processed ${Math.min(i + batchSize, messages.length)}/${messages.length} messages`);
      }
    } else {
      // Split text into chunks for non-WhatsApp content
      const chunks = splitTextIntoChunks(text);

      // Clear text from memory
      text = null;

      // Create fragments in smaller batches to avoid memory issues
      const batchSize = 5;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (chunk, index) => {
            try {
              let embedding = null;
              try {
                embedding = await generateEmbeddings(chunk);
              } catch (embedError) {
                logger.warn(`Embedding generation failed for chunk ${i + index}: ${embedError.message}`);
              }
              // Deduplication: check if fragment exists
              const exists = await Fragment.findOne({
                content: chunk,
                user: userId,
                source: source._id,
              });
              if (exists) return;
              // Create fragment, embedding may be null
              await Fragment.create({
                source: source._id,
                user: userId,
                content: chunk,
                embedding: embedding || undefined,
                status: embedding ? 'indexed' : 'pending',
                metadata: {
                  chunkIndex: i + index,
                  totalChunks: chunks.length,
                },
              });
            } catch (error) {
              logger.error(`Error creating fragment for chunk ${i + index}:`, error);
            }
          })
        );
        logger.info(`Processed ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks`);
      }
    }

    // Update source status
    source.status = 'processed';
    await source.save();

    const fragmentCount = isWhatsApp ? messages.length : (await Fragment.countDocuments({ source: source._id }));
    logger.info(`Processed ${fragmentCount} fragments from source ${sourceId}`);

    // TRIGGER INDEXING AND LINKING
    // This was missing for standard file uploads!
    try {
      const { indexSourceFragments } = require('./indexer.service');
      // Run in background, don't await/block
      indexSourceFragments(source._id).catch(err =>
        logger.error(`Post-processing indexing failed for source ${sourceId}:`, err)
      );
    } catch (e) {
      logger.error(`Failed to trigger post-processing indexing:`, e);
    }
  } catch (error) {
    logger.error(`Error processing document ${sourceId}:`, error);

    // Update source with error
    await Source.updateOne(
      { _id: sourceId },
      {
        status: 'error',
        error: {
          message: error.message,
          stack: error.stack,
        },
      }
    );

    throw error;
  }
}

module.exports = {
  processDocument,
  splitTextIntoChunks,
  parsePdfFile,
  parseDocxFile,
  parseTextFile,
  parseImageWithOCR,
  parseWhatsApp,
  parseWhatsAppChat,
  parseWhatsAppDate,
};
