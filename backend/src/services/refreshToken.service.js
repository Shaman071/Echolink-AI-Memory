const crypto = require('crypto');
const { RefreshToken } = require('../models');

/**
 * Hash token with sha256
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Create and persist a refresh token record
 * @param {ObjectId} userId
 * @param {string} tokenPlain - the raw token string
 * @param {Date} expires
 * @param {string} createdByIp
 */
const create = async (userId, tokenPlain, expires, createdByIp = '') => {
  const tokenHash = hashToken(tokenPlain);
  const doc = await RefreshToken.create({
    tokenHash,
    user: userId,
    expires,
    createdByIp,
  });
  return doc;
};

/**
 * Find refresh token document by raw token
 */
const findByToken = async (tokenPlain) => {
  const tokenHash = hashToken(tokenPlain);
  console.log('Looking up token by hash:', { tokenHash });
  const doc = await RefreshToken.findOne({ tokenHash });
  console.log('Found token document:', { found: !!doc, isActive: doc?.isActive });
  return doc;
};

/**
 * Revoke a refresh token
 */
const revoke = async (tokenDoc, ip, reason = 'revoked') => {
  console.log('Revoking token:', { tokenId: tokenDoc._id, reason });
  tokenDoc.revokedAt = new Date();
  tokenDoc.revokedByIp = ip;
  tokenDoc.reason = reason;
  await tokenDoc.save();
  console.log('Token revoked:', { tokenId: tokenDoc._id, revokedAt: tokenDoc.revokedAt });
  return tokenDoc;
};

/**
 * Rotate: revoke old and create new token record
 */
const rotate = async (oldTokenDoc, newTokenPlain, newExpires, ip) => {
  oldTokenDoc.revokedAt = new Date();
  oldTokenDoc.revokedByIp = ip;
  oldTokenDoc.replacedByToken = crypto.createHash('sha256').update(newTokenPlain).digest('hex');
  await oldTokenDoc.save();
  const created = await create(oldTokenDoc.user, newTokenPlain, newExpires, ip);
  return created;
};

/**
 * Remove expired tokens (maintenance)
 */
const removeExpired = async () => {
  await RefreshToken.deleteMany({ expires: { $lt: new Date() } });
};

module.exports = {
  create,
  findByToken,
  revoke,
  rotate,
  removeExpired,
};
