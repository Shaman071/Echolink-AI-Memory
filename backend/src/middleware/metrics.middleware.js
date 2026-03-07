const metrics = {
  requests: 0,
  errors: 0,
  lastError: null,
};

function metricsMiddleware(req, res, next) {
  metrics.requests++;
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      metrics.errors++;
      metrics.lastError = {
        url: req.originalUrl,
        status: res.statusCode,
        time: new Date(),
      };
    }
  });
  next();
}

function getMetrics() {
  return {
    requests: metrics.requests,
    errors: metrics.errors,
    lastError: metrics.lastError,
  };
}

module.exports = { metricsMiddleware, getMetrics };
