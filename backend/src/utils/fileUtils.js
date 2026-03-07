const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const logger = require('./logger');

const UPLOAD_DIR = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');

// Ensure upload directory exists
const ensureUploadDir = async () => {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    logger.error(`Error creating upload directory: ${error.message}`);
    throw new Error('Failed to initialize upload directory');
  }
};

/**
 * Save an uploaded file to the uploads directory
 * @param {Object} file - Multer file object
 * @returns {Promise<{filename: string, path: string, mimetype: string, size: number}>}
 */
const saveFile = async (file) => {
  await ensureUploadDir();
  
  const fileExt = path.extname(file.originalname);
  const filename = `${uuidv4()}${fileExt}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  
  try {
    await fs.rename(file.path, filepath);
    
    return {
      filename,
      originalname: file.originalname,
      path: filepath,
      mimetype: file.mimetype,
      size: file.size,
    };
  } catch (error) {
    // Clean up if there's an error
    try {
      await fs.unlink(file.path);
    } catch (cleanupError) {
      logger.error('Error cleaning up file:', cleanupError);
    }
    
    throw new Error(`Failed to save file: ${error.message}`);
  }
};

/**
 * Delete a file from the uploads directory
 * @param {string} filepath - Path to the file
 */
const deleteFile = async (filepath) => {
  try {
    await fs.unlink(filepath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.error(`Error deleting file ${filepath}:`, error);
      throw error;
    }
    // File doesn't exist, which is fine
  }
};

/**
 * Get file information
 * @param {string} filepath - Path to the file
 * @returns {Promise<{size: number, mimetype: string, extension: string}>}
 */
const getFileInfo = async (filepath) => {
  try {
    const stats = await fs.stat(filepath);
    const mimetype = mime.lookup(filepath) || 'application/octet-stream';
    const extension = path.extname(filepath).toLowerCase();
    
    return {
      size: stats.size,
      mimetype,
      extension,
      lastModified: stats.mtime,
      created: stats.birthtime,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

/**
 * Check if a file exists
 * @param {string} filepath - Path to the file
 * @returns {Promise<boolean>}
 */
const fileExists = async (filepath) => {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  UPLOAD_DIR,
  saveFile,
  deleteFile,
  getFileInfo,
  fileExists,
  ensureUploadDir,
};
