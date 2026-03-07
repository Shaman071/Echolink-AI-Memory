const Joi = require('@hapi/joi');
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const winston = require('winston'); // Added winston import
const { combine, timestamp, printf, colorize, align, splat } = winston.format; // Added winston format components

// Import routes
const authRoutes = require('./src/routes/auth.routes');
const importRoutes = require('./src/routes/import.routes');
const queryRoutes = require('./src/routes/query-enhanced.routes');
const linkRoutes = require('./src/routes/link.routes');
const fragmentsRoutes = require('./src/routes/fragments.routes');
const sseRoutes = require('./src/routes/sse.routes');
const debugRoutes = require('./src/routes/debug.routes');
const adminRoutes = require('./src/routes/admin.routes');

// Import middleware
const { errorHandler } = require('./src/middleware/error.middleware');
const { authenticate } = require('./src/middleware/auth.middleware');
// Initialize express app
const app = express();
const httpServer = createServer(app);

// Socket.io setup
const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:5173'];
const io = new Server(httpServer, {
  cors: {
    origin: function (origin, callback) {
      // allow requests with no origin (like curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      const msg = 'The CORS policy for this site does not allow access from the specified Origin: ' + origin;
      return callback(new Error(msg), false);
    },
    methods: ['GET', 'POST'],
  },
});

// Middleware
// Allow multiple dev origins and credentialed requests
app.use(
  cors({
    origin: (origin, callback) => {
      // allow non-browser tools
      if (!origin) return callback(null, true);
      const allowed = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ];
      if (process.env.FRONTEND_URL) allowed.push(process.env.FRONTEND_URL);

      if (allowed.includes(origin) || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      console.log('Blocked by CORS:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(require('./src/middleware/metrics.middleware').metricsMiddleware);

// Database connection
if (process.env.NODE_ENV === 'test') {
  console.log('Skipping mongoose.connect in test environment (tests should connect their own DB)');
} else {
  mongoose
    .connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));
}

// Health check and metrics endpoint
const { getMetrics } = require('./src/middleware/metrics.middleware');
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date(), metrics: getMetrics() });
});

// Public API status endpoint (no auth required) — must be before all other route mounts
app.get('/api/system/status', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const dbStateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    res.status(200).json({
      ok: true,
      status: 'running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      db: dbStateMap[dbState] || 'unknown',
    });
  } catch (err) {
    res.status(503).json({ ok: false, status: 'error', error: err.message });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/import', importRoutes);
// SSE stream (must be before other middleware that might end the response)
app.use('/api', sseRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/links', linkRoutes);
app.use('/api', fragmentsRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/admin', adminRoutes);

// Export/Import routes
const exportRoutes = require('./src/routes/export.routes');
app.use('/api/export', exportRoutes);

// OAuth Connectors routes
const connectorsRoutes = require('./src/routes/connectors.routes');
app.use('/api/connectors', connectorsRoutes);


// Error handling middleware
app.use((err, req, res, next) => {
  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      ok: false,
      error: 'File too large. Maximum size is 50MB.'
    });
  }
  if (err instanceof require('multer').MulterError) {
    return res.status(400).json({
      ok: false,
      error: err.message
    });
  }
  // Pass to default error handler
  next(err);
});

// Process-level error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log the error using winston if a logger is available
  if (winston.loggers.has('default')) {
    winston.loggers.get('default').error('Uncaught Exception:', error);
  }
  // Consider graceful shutdown here
  // process.exit(1); // Exit with a 'failure' code
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log the error using winston if a logger is available
  if (winston.loggers.has('default')) {
    winston.loggers.get('default').error('Unhandled Rejection:', reason);
  }
  // Consider graceful shutdown here
  // process.exit(1); // Exit with a 'failure' code
});

// Example winston logger setup (assuming this is where splat() should be used)
// This part is inferred from the instruction "Add `winston.format.splat()` to `logger.js`"
// but placed here as no `logger.js` content was provided.
winston.loggers.add('default', {
  level: 'info',
  format: combine(
    colorize(),
    timestamp({
      format: 'YYYY-MM-DD hh:mm:ss.SSS A',
    }),
    align(),
    splat(), // Support for %s string interpolation
    printf((info) => `[${info.timestamp}] ${info.level}: ${info.message} `)
  ),
  transports: [
    new winston.transports.Console(),
  ],
});


app.use(errorHandler);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });

  // Handle real-time events here
});

// Start server (avoid listening during test runs to prevent EADDRINUSE)
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, httpServer, io };
