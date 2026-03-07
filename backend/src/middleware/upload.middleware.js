const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure temp directory exists
const tempDir = path.resolve(__dirname, '..', 'tmp/uploads');
fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: process.env.MAX_FILE_SIZE || 50 * 1024 * 1024,
  },
});

module.exports = upload;
