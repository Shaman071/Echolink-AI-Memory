const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate JWT token
 * @param {string} userId - User ID
 * @param {string} type - Token type (access or refresh)
 * @returns {string} JWT token
 */
const generateToken = (userId, type = 'access') => {
  const payload = {
    sub: userId,
    type,
    iat: Math.floor(Date.now() / 1000),
  };

  const expiresIn = type === 'refresh' ? config.jwt.refreshExpire || '30d' : config.jwt.expire;

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn,
  });
};

/**
 * Generate auth tokens
 * @param {Object} user - User object
 * @returns {Object} Auth tokens
 */
const generateAuthTokens = (user) => {
  const accessToken = generateToken(user._id, 'access');
  const refreshToken = generateToken(user._id, 'refresh');

  return {
    access: {
      token: accessToken,
      expires: new Date(Date.now() + (config.jwt.expireNumDays || 7) * 24 * 60 * 60 * 1000),
    },
    refresh: {
      token: refreshToken,
      expires: new Date(Date.now() + (config.jwt.refreshExpireNumDays || 30) * 24 * 60 * 60 * 1000),
    },
  };
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @param {string} type - Token type (access or refresh)
 * @returns {Object} Token payload
 */
const verifyToken = (token, type = 'access') => {
  const payload = jwt.verify(token, config.jwt.secret);
  
  if (payload.type !== type) {
    throw new Error('Invalid token type');
  }
  
  return payload;
};

module.exports = {
  generateToken,
  generateAuthTokens,
  verifyToken,
};
