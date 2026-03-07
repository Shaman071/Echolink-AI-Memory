const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

/**
 * Error converter middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorConverter = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    error = new ApiError(statusCode, message, false, err.stack);
  }

  next(error);
};

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  if (!statusCode) {
    statusCode = 500;
  }

  if (!message) {
    message = 'Internal server error';
  }

  const response = {
    ok: false,
    code: statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    ...(err.errors && { errors: err.errors }),
  };

  logger.error(`[${req.method} ${req.originalUrl}] ${statusCode}: ${message}`);
  if (err.stack && process.env.NODE_ENV === 'development') {
    logger.error(err.stack);
  }

  res.status(statusCode).json(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};
