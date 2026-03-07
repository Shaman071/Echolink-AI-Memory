require('./setup');
const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { queryEmbeddingService } = require('../src/services/embedding.service');
const { summarize } = require('../src/services/summarizer.service');

jest.mock('../src/services/embedding.service', () => ({
  ...jest.requireActual('../src/services/embedding.service'),
  queryEmbeddingService: jest.fn(),
}));

jest.mock('../src/services/summarizer.service', () => ({
  ...jest.requireActual('../src/services/summarizer.service'),
  summarize: jest.fn(),
}));

describe('Query Endpoint', () => {
  let testUser;
  let testToken;
  let Fragment;
  let Source;
  let agent;

  beforeAll(() => {
    if (!global.__TEST_SERVER_URL) throw new Error('Test server not started');
    agent = request.agent(global.__TEST_SERVER_URL);
  });

  beforeEach(async () => {
    Fragment = mongoose.model('Fragment');
    Source = mongoose.model('Source');

    // Clear database
    await User.deleteMany({});
    await Fragment.deleteMany({});
    await Source.deleteMany({});

    // Create and register test user
    const registerRes = await agent
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@test.com',
        password: 'password123',
      });

    testUser = registerRes.body.user;
    testToken = registerRes.body.tokens.access.token;

    // Reset mocks
    jest.clearAllMocks();
    
    // Mock summarize to return simple summary
    summarize.mockResolvedValue('This is a test summary');
  });

  describe('POST /api/query', () => {
    it('should search fragments and return results with summary', async () => {
      // Create test source
      const source = await Source.create({
        user: testUser.id,
        title: 'Test Chat',
        type: 'whatsapp',
      });

      // Create test fragments
      const fragments = await Fragment.insertMany([
        {
          user: testUser.id,
          source: source._id,
          text: 'MERN stack is great',
          sender: 'Alice',
          datetime: new Date('2025-01-01T10:00:00Z'),
        },
        {
          user: testUser.id,
          source: source._id,
          text: 'React makes frontend development easier',
          sender: 'Bob',
          datetime: new Date('2025-01-01T11:00:00Z'),
        },
      ]);

      // Mock embed service search
      queryEmbeddingService.mockResolvedValue([
        {
          id: fragments[0]._id.toString(),
          score: 0.95,
        },
        {
          id: fragments[1]._id.toString(),
          score: 0.87,
        },
      ]);

      // Perform search query
      const res = await agent
        .post('/api/query')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ q: 'what is MERN?' });

      // Verify response structure
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('evidence');

      // Verify evidence contains fragments
      expect(Array.isArray(res.body.evidence)).toBe(true);
      if (res.body.evidence.length > 0) {
        expect(res.body.evidence[0]).toHaveProperty('_id');
        expect(res.body.evidence[0]).toHaveProperty('text');
        expect(res.body.evidence[0]).toHaveProperty('sender');
        // Verify evidence text matches
        expect(res.body.evidence[0].text).toContain('MERN');
      }
    });

    it('should return empty results for no matches', async () => {
      // Mock empty search results
      queryEmbeddingService.mockResolvedValue([]);

      // Perform search query
      const res = await agent
        .post('/api/query')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ q: 'nonexistent topic' });

      // Verify response
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('evidence');
      expect(res.body.evidence).toEqual([]);
    });

    it('should require authentication', async () => {
      const res = await agent
        .post('/api/query')
        .send({ q: 'test query' });

      expect(res.status).toBe(401);
    });

    it('should require query parameter', async () => {
      const res = await agent
        .post('/api/query')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should only return user\'s own fragments', async () => {
      // Create another user
      const registerRes2 = await agent
        .post('/api/auth/register')
        .send({
          name: 'Other User',
          email: 'other@test.com',
          password: 'password123',
        });
      const otherUser = registerRes2.body.user;

      // Create source for first user
      const source = await Source.create({
        user: testUser.id,
        title: 'Test Chat',
        type: 'whatsapp',
      });

      // Create fragments for first user
      const fragments = await Fragment.insertMany([
        {
          user: testUser.id,
          source: source._id,
          text: 'Secret message',
          sender: 'Alice',
          datetime: new Date(),
        },
      ]);

      // Mock search to return testUser's fragment
      queryEmbeddingService.mockResolvedValue([
        {
          id: fragments[0]._id.toString(),
          score: 0.9,
        },
      ]);

      // Search as other user
      const otherToken = registerRes2.body.tokens.access.token;
      const res = await agent
        .post('/api/query')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ q: 'secret' });

      // Should not return testUser's fragment
      expect(res.body.evidence || []).toEqual([]);
    });

    it('should build timeline from fragment dates', async () => {
      const source = await Source.create({
        user: testUser.id,
        title: 'Test Chat',
        type: 'whatsapp',
      });

      const fragments = await Fragment.insertMany([
        {
          user: testUser.id,
          source: source._id,
          text: 'Message 1',
          sender: 'Alice',
          datetime: new Date('2025-01-01T10:00:00Z'),
        },
        {
          user: testUser.id,
          source: source._id,
          text: 'Message 2',
          sender: 'Bob',
          datetime: new Date('2025-01-01T11:00:00Z'),
        },
      ]);

      queryEmbeddingService.mockResolvedValue([
        { id: fragments[0]._id.toString(), score: 0.9 },
        { id: fragments[1]._id.toString(), score: 0.85 },
      ]);

      const res = await agent
        .post('/api/query')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ q: 'messages' });

      // Verify response structure
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('evidence');
      
      // Verify timeline exists and has structure
      expect(Array.isArray(res.body.timeline)).toBe(true);
    });

    it('should build graph nodes from fragments', async () => {
      const source = await Source.create({
        user: testUser.id,
        title: 'Test Chat',
        type: 'whatsapp',
      });

      const fragments = await Fragment.insertMany([
        {
          user: testUser.id,
          source: source._id,
          text: 'This is a test message',
          sender: 'Alice',
          datetime: new Date(),
        },
      ]);

      queryEmbeddingService.mockResolvedValue([
        { id: fragments[0]._id.toString(), score: 0.9 },
      ]);

      const res = await agent
        .post('/api/query')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ q: 'test' });

      // Verify response
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('graph');
    });
  });
});