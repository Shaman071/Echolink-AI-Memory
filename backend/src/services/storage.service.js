const fs = require('fs');
const path = require('path');
const { Source } = require('../models');
const logger = require('../utils/logger');

const permanentDir = path.join(process.cwd(), 'uploads', 'permanent');
if (!fs.existsSync(permanentDir)) {
  fs.mkdirSync(permanentDir, { recursive: true });
}

/**
 * Move source file to permanent storage
 * @param {Source} source - Source document
 * @returns {Promise<string>} New file path
 */
async function moveToPermanentStorage(source) {
  if (!source.filePath) return null;
  const fileName = path.basename(source.filePath);
  const newPath = path.join(permanentDir, fileName);
  try {
    fs.renameSync(source.filePath, newPath);
    source.filePath = newPath;
    await source.save();
    logger.info(`Moved file to permanent storage: ${newPath}`);
    return newPath;
  } catch (err) {
    logger.error('Error moving file to permanent storage:', err);
    return null;
  }
}

/**
 * Cleanup old files in uploads directory
 * @param {number} maxAgeDays - Max age in days before deletion
 */
function cleanupOldUploads(maxAgeDays = 30) {
  const uploadDir = path.join(process.cwd(), 'uploads');
  const now = Date.now();
  fs.readdirSync(uploadDir).forEach(file => {
    const filePath = path.join(uploadDir, file);
    if (fs.statSync(filePath).isFile()) {
      const ageDays = (now - fs.statSync(filePath).mtimeMs) / (1000 * 60 * 60 * 24);
      if (ageDays > maxAgeDays) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted old upload: ${filePath}`);
      }
    }
  });
}

module.exports = { moveToPermanentStorage, cleanupOldUploads };
