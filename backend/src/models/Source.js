const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    sourceType: {
      type: String,
      required: true,
      enum: ['whatsapp', 'pdf', 'docx', 'text', 'screenshot', 'note'],
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'processed', 'failed'],
      default: 'pending',
    },
    fragmentCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Source = mongoose.models.Source || mongoose.model('Source', sourceSchema);

module.exports = Source;