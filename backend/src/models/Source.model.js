const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const sourceSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      alias: 'name', // Support both 'title' and 'name'
    },
    type: {
      type: String,
      enum: ['whatsapp', 'pdf', 'docx', 'screenshot', 'note', 'text', 'document', 'webpage', 'video', 'audio', 'other'],
      required: true,
    },
    url: {
      type: String,
      trim: true,
    },
    filePath: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
    },
    metadata: {
      type: Map,
      of: String,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'processed', 'indexed', 'indexing', 'error'],
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
sourceSchema.plugin(toJSON);
sourceSchema.plugin(paginate);

// Virtual for fragments
sourceSchema.virtual('fragments', {
  ref: 'Fragment',
  localField: '_id',
  foreignField: 'source',
});

// Ensure virtuals are included in JSON
sourceSchema.set('toJSON', { virtuals: true });
sourceSchema.set('toObject', { virtuals: true });

/**
 * @typedef Source
 */
const Source = mongoose.models.Source || mongoose.model('Source', sourceSchema);

module.exports = Source;
