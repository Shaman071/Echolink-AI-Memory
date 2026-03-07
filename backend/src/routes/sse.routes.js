const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const events = require('../utils/events');
const User = require('../models/User.model');

const router = express.Router();

// SSE endpoint for streaming updates (uploads/indexing status) to the client
// This SSE endpoint prefers cookie-based auth (accessToken cookie). It falls back to
// Authorization header or ?token= query param for backwards compatibility.
router.get('/stream/updates', async (req, res) => {
  try {
    // Read token from cookie first
    const token = req.cookies?.accessToken || req.headers?.authorization?.split?.(' ')[1] || req.query?.token;
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }

    const userId = payload.sub || payload.userId || payload.id;
    if (!userId) return res.status(401).json({ ok: false, error: 'Invalid token payload' });

    // Setup SSE response headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // allow credentialed cross-origin requests; CORS middleware also applied globally
      'Access-Control-Allow-Credentials': 'true',
    });

    // Send a ping to establish connection
    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ ok: true, userId })}\n\n`);

    const handler = (payload) => {
      try {
        // Only send events that match this user
        if (payload.userId && payload.userId.toString() === userId.toString()) {
          res.write(`event: sourceStatus\n`);
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
      } catch (err) {
        // swallow
      }
    };

    events.on('sourceStatus', handler);

    // Remove listener on close
    req.on('close', () => {
      events.removeListener('sourceStatus', handler);
      try { res.end(); } catch (e) {}
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
