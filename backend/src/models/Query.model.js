const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const querySchema = mongoose.Schema(
  {
    user: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    queryText: {
      type: String,
      required: true,
      trim: true,
    },
    results: [
      {
        fragmentId: {
          type: mongoose.SchemaTypes.ObjectId,
          ref: 'Fragment',
        },
        score: {
          type: Number,
          min: 0,
          max: 1,
        },
      },
    ],
    summary: {
      type: String,
    },
    metadata: {
      totalResults: Number,
      searchTime: Number, // in milliseconds
      filters: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'error'],
      default: 'pending',
    },
    error: {
      message: String,
      stack: String,
    },
  },
  {
    timestamps: true,
  }
);

// Add plugins
querySchema.plugin(toJSON);
querySchema.plugin(paginate);

// Index for user queries
querySchema.index({ user: 1, createdAt: -1 });

/**
 * @typedef Query
 */
const Query = mongoose.model('Query', querySchema);

module.exports = Query;
