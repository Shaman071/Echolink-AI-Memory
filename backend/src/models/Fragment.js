const mongoose = require('mongoose');

const fragmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Source',
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    sender: {
      type: String,
      default: 'System',
    },
    datetime: {
      type: Date,
      required: true,
      index: true,
    },
    embedding: {
      type: [Number],
      select: false, // Don't return embeddings by default
    },
  },
  { timestamps: true }
);

fragmentSchema.index({ text: 'text' }); // For text search fallback

const Fragment = mongoose.model('Fragment', fragmentSchema);

module.exports = Fragment;