Advanced Runtime Extensions
===========================

This file documents optional production extensions implemented in the codebase.

1) Redis-backed job queue (BullMQ)
----------------------------------
- If `REDIS_URL` is set in your environment and `bullmq` is installed, the server will
  use BullMQ to enqueue/background job types (currently `rebuildLinksForSource`).
- Otherwise the server falls back to a single-process in-memory job queue.

2) Circuit-breaker persistence
------------------------------
- The embedding fallback has an in-memory circuit-breaker. If you provide Redis
  and adapt the code to persist CB state, it can be cluster-wide. The current
  implementation will attempt to use Redis when `REDIS_URL` is provided.

3) Server-Sent Events (SSE) and WebSocket plans
-----------------------------------------------
- SSE endpoint available at: `/api/stream/updates?token=<jwt>` (development convenience)
- For production, prefer using WebSockets with header auth or using cookies for SSE.

How to enable Redis features
----------------------------
1. Install Redis and set `REDIS_URL` in `backend/.env`:

   REDIS_URL=redis://localhost:6379

2. Install dependencies (if not already):

   npm install bullmq ioredis

3. Restart backend. The job queue will log that it's using BullMQ.

Notes
-----
- The code is defensive: when Redis or bullmq is not available it will log warnings and
  fall back to in-process implementations so development is smooth.
