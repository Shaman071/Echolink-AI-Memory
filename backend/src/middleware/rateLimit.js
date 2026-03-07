const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// Per-user rate limiting middleware
function userRateLimit(options) {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000, // 1 minute
    max: options.max || 20, // max requests per window
    keyGenerator: (req) => {
      // Use user ID if authenticated, else use express-rate-limit's ipKeyGenerator helper for IPv6 safety
      if (req.user && req.user._id) return req.user._id.toString();
      return ipKeyGenerator(req);
    },
    handler: (req, res) => {
      res.status(429).json({
        ok: false,
        message: 'Too many requests. Please try again later.',
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

module.exports = { userRateLimit };
