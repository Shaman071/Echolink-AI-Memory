const request = require('supertest');
let agent;

beforeAll(() => {
  if (!global.__TEST_SERVER_URL) throw new Error('Test server not started');
  agent = request.agent(global.__TEST_SERVER_URL);
});


const { User, Source, Fragment } = require('../src/models');
const fs = require('fs').promises;
const path = require('path');

describe('WhatsApp Import API', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    jest.setTimeout(30000);

    // Clear any existing data
    await User.deleteMany({});
    await Source.deleteMany({});
    await Fragment.deleteMany({});

    // Create test user
    const testUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test1234!',
    };

    // Register and get auth token
    const registerRes = await agent
      .post('/api/auth/register')
      .send(testUser);

    expect(registerRes.statusCode).toBe(201);
    expect(registerRes.body.user).toBeDefined();
    expect(registerRes.body.tokens).toBeDefined();
    userId = registerRes.body.user.id;

    authToken = registerRes.body.tokens.access.token;

    // Wait for user creation to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify user exists
    const user = await User.findById(userId);
    expect(user).toBeDefined();
    expect(user.email).toBe(testUser.email);
  });

  afterAll(async () => {
    // Cleanup: delete test data
    await Fragment.deleteMany({ user: userId });
    await Source.deleteMany({ user: userId });
    await User.findByIdAndDelete(userId);
  });

  describe('POST /api/import/whatsapp', () => {
    it('should upload, parse, and import a WhatsApp chat file', async () => {
      // Read sample WhatsApp file
      const samplePath = path.join(__dirname, '../../sample_data/sample_whatsapp.txt');
      const fileBuffer = await fs.readFile(samplePath);

      const res = await agent
        .post('/api/import/whatsapp')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', fileBuffer, 'sample_whatsapp.txt');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.sourceId).toBeDefined();
      expect(res.body.inserted).toBeGreaterThanOrEqual(10);
      expect(Array.isArray(res.body.fragments)).toBe(true);
      expect(res.body.fragments.length).toBe(res.body.inserted);

      // Verify fragment structure
      res.body.fragments.forEach(fragment => {
        expect(fragment._id).toBeDefined();
        expect(fragment.text).toBeDefined();
        expect(typeof fragment.text).toBe('string');
        expect(fragment.sender).toBeDefined();
        expect(fragment.datetime).toBeDefined();
      });

      // Verify fragments in database
      const dbFragments = await Fragment.find({ user: userId });
      expect(dbFragments.length).toBe(res.body.inserted);

      // Verify fragments have correct sender and datetime
      dbFragments.forEach(fragment => {
        expect(fragment.text).toBeDefined();
        expect(fragment.sender).toBeDefined();
        expect(fragment.datetime).toBeDefined();
        expect(fragment.datetime instanceof Date).toBe(true);
      });

      // Verify presence of a specific message
      const specificFragment = await Fragment.findOne({ user: userId, text: /MERN will be easier/i });
      expect(specificFragment).toBeDefined();
      if (specificFragment) {
        expect(specificFragment.sender).toBe('Ravi');
        expect(specificFragment.datetime).toBeInstanceOf(Date);
      }

      // Verify source record
      const source = await Source.findById(res.body.sourceId);
      expect(source).toBeDefined();
      expect(source.type).toBe('whatsapp');
      // Status might be 'processed' or 'indexing' depending on async indexing
      expect(['processed', 'indexing']).toContain(source.status);
      expect(source.user.toString()).toBe(userId.toString());
    });

    it('should return error for empty file', async () => {
      const res = await agent
        .post('/api/import/whatsapp')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(''), 'empty.txt');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('should require authentication', async () => {
      const res = await agent
        .post('/api/import/whatsapp')
        .send({});

      expect(res.status).toBe(401);
    });

    it('should handle file with no valid WhatsApp messages', async () => {
      const invalidContent = Buffer.from('This is just plain text\nwith no WhatsApp format');
      
      const res = await agent
        .post('/api/import/whatsapp')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', invalidContent, 'invalid.txt');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });
});
