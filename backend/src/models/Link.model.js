const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const linkSchema = mongoose.Schema(
  {
    sourceFragment: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Fragment',
      required: true,
    },
    targetFragment: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Fragment',
      required: true,
    },
    user: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['same_topic', 'followup', 'supports', 'contradicts', 'reference', 'elaboration', 'example', 'related', 'similar', 'same_author'],
      required: true,
      alias: 'relation', // Support both 'type' and 'relation'
    },
    strength: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
      alias: 'weight', // Support both 'strength' and 'weight'
    },
    metadata: {
      context: String,
      notes: String,
      tags: [String],
    },
  },
  {
    timestamps: true,
  }
);

// Add plugins
linkSchema.plugin(toJSON);
linkSchema.plugin(paginate);

// Ensure no duplicate links between the same fragments
linkSchema.index(
  { sourceFragment: 1, targetFragment: 1, type: 1, user: 1 },
  { unique: true }
);

/**
 * @typedef Link
 */
const Link = mongoose.model('Link', linkSchema);

module.exports = Link;
