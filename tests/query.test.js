const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../backend/server');
const { User, Source, Fragment } = require('../backend/src/models');
const config = require('../backend/src/config/config');

describe('Query API Tests', () => {
  let token;
  let userId;
  let sourceId;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(config.mongoose.url);

    // Create test user
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      password: 'Test123!',
    });

    token = res.body.tokens?.access?.token || res.body.access_token;
    userId = res.body.user?._id || res.body.userId;

    // Create test source and fragments
    const source = await Source.create({
      user: userId,
      title: 'Test Source',
      type: 'text',
      status: 'indexed',
    });
    sourceId = source._id;

    // Create test fragments with embeddings (using simple mock embeddings)
    const mockEmbedding = Array(384).fill(0).map(() => Math.random());
    
    await Fragment.insertMany([
      {
        user: userId,
        source: sourceId,
        content: 'Why choose React for frontend development? React is a powerful library for building user interfaces.',
        sender: 'System',
        datetime: new Date(),
        embedding: mockEmbedding,
        status: 'indexed',
      },
      {
        user: userId,
        source: sourceId,
        content: 'MERN stack includes MongoDB, Express, React, and Node.js. MERN will be easier than expected.',
        sender: 'System',
        datetime: new Date(),
        embedding: mockEmbedding,
        status: 'indexed',
      },
      {
        user: userId,
        source: sourceId,
        content: 'Express is a minimalist web framework for Node.js. It simplifies routing and middleware management.',
        sender: 'System',
        datetime: new Date(),
        embedding: mockEmbedding,
        status: 'indexed',
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup
    if (userId) {
      await User.deleteOne({ _id: userId });
      await Source.deleteMany({ user: userId });
      await Fragment.deleteMany({ user: userId });
    }
    await mongoose.disconnect();
  });

  test('POST /api/query - search with query', async () => {
    const res = await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ q: 'Why choose React?', topK: 5 });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(Array.isArray(res.body.evidence)).toBe(true);
    expect(Array.isArray(res.body.timeline)).toBe(true);
    expect(res.body.graph).toBeDefined();
    expect(Array.isArray(res.body.graph.nodes)).toBe(true);
    expect(Array.isArray(res.body.graph.edges)).toBe(true);
  });

  test('POST /api/query - MERN query returns relevant evidence', async () => {
    const res = await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ q: 'Why choose MERN?', topK: 5 });

    expect(res.status).toBe(200);
    expect(res.body.evidence.length).toBeGreaterThan(0);
    
    // Check if evidence contains MERN-related fragments
    const evidenceText = res.body.evidence.map(e => e.text).join(' ');
    expect(evidenceText.toLowerCase()).toMatch(/mern|react|express|mongodb|node/i);
  });

  test('POST /api/query - invalid query returns 400', async () => {
    const res = await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ q: '' });

    expect(res.status).toBe(400);
  });

  test('GET /api/graph - fetch knowledge graph', async () => {
    const res = await request(app)
      .get('/api/graph')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nodes).toBeDefined();
    expect(res.body.edges).toBeDefined();
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
  });
});
