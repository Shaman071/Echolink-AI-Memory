const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');
const tokenService = require('../services/token.service');

/**
 * Authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    const tokenType = req.headers['x-token-type'] || 'access';
    const payload = await tokenService.verifyToken(token, tokenType);
    const user = await User.findById(payload.sub);

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError(401, 'Invalid token'));
    }
    next(error);
  }
};

/**
 * Extract token from request
 * @param {Object} req - Express request object
 * @returns {string|null} JWT token
 */
const extractToken = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.split(' ')[0] === 'Bearer'
  ) {
    return req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    return req.query.token;
  } else if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
};

/**
 * Authorization middleware - check user roles
 * @param {...string} roles - Allowed roles
 * @returns {Function} Middleware function
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (!roles.includes(req.user.role)) {
    return next(
      new ApiError(403, 'You do not have permission to perform this action')
    );
  }

  next();
};

/**
 * Optional authentication - doesn't fail if no token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const payload = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(payload.sub);

      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  auth: () => authenticate, // For compatibility with routes
};
