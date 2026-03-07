const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const fragmentSchema = mongoose.Schema(
  {
    source: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Source',
      required: true,
    },
    user: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      alias: 'text', // Support both 'content' and 'text'
    },
    sender: {
      type: String,
      trim: true,
    },
    datetime: {
      type: Date,
      default: Date.now,
    },
    keywords: [String],
    topics: [String],
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral', 'mixed'],
      default: 'neutral',
    },
    embedding: {
      type: [Number],
      select: false,
    },
    metadata: {
      pageNumber: Number,
      section: String,
      tags: [String],
      startTime: Number, // For audio/video
      endTime: Number,   // For audio/video
      coordinates: {
        x: Number,
        y: Number,
        width: Number,
        height: Number,
      },
    },
    summary: String,
    status: {
      type: String,
      enum: ['pending', 'processing', 'processed', 'indexed', 'error'],
      default: 'pending',
    },
    error: {
      message: String,
      stack: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual getter for 'text' to ensure consistency
fragmentSchema.virtual('text').get(function () {
  return this.content;
});

// Add plugins
fragmentSchema.plugin(toJSON);
fragmentSchema.plugin(paginate);

// Index for text search
fragmentSchema.index({ content: 'text', summary: 'text' });

// Index for user and datetime
fragmentSchema.index({ user: 1, datetime: -1 });
fragmentSchema.index({ user: 1, status: 1 });
fragmentSchema.index({ source: 1 });

// Deduplication index: content, user, source
fragmentSchema.index({ content: 1, user: 1, source: 1 }, { unique: true, sparse: true });

/**
 * @typedef Fragment
 */
const Fragment = mongoose.model('Fragment', fragmentSchema);

module.exports = Fragment;
