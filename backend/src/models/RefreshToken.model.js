const mongoose = require('mongoose');

const refreshTokenSchema = mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expires: {
      type: Date,
      required: true,
    },
    createdByIp: String,
    revokedAt: Date,
    revokedByIp: String,
    replacedByToken: String,
    reason: String,
  },
  {
    timestamps: true,
  }
);

refreshTokenSchema.virtual('isExpired').get(function () {
  return Date.now() >= this.expires.getTime();
});

refreshTokenSchema.virtual('isActive').get(function () {
  return !this.revokedAt && !this.isExpired;
});

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
