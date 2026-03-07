const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { app } = require('../backend/server');
const { User, Source, Fragment } = require('../backend/src/models');
const config = require('../backend/src/config/config');

describe('Import API Tests', () => {
  let token;
  let userId;
  const testFilePath = path.join(__dirname, 'fixtures', 'sample_whatsapp.txt');

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

    expect(token).toBeDefined();
    expect(userId).toBeDefined();
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

  test('POST /api/import/upload - upload WhatsApp .txt file', async () => {
    // Create a sample WhatsApp file if it doesn't exist
    const sampleContent = `12/31/2023, 11:45 AM - Alice: Hey everyone!
12/31/2023, 11:46 AM - Bob: Hi Alice! 
12/31/2023, 11:47 AM - Charlie: Hey team, MERN will be easier than expected
12/31/2023, 11:48 AM - Alice: Why choose MERN?
12/31/2023, 11:49 AM - Charlie: Because it's JavaScript everywhere
12/31/2023, 11:50 AM - Bob: And it has great tooling
12/31/2023, 11:51 AM - Alice: I agree, React is super popular
12/31/2023, 11:52 AM - Charlie: MongoDB is flexible too
12/31/2023, 11:53 AM - Bob: Express makes routing simple
12/31/2023, 11:54 AM - Alice: Node.js performance is great
12/31/2023, 11:55 AM - Charlie: This stack is perfect for modern web apps`;

    // Create temp file
    const tempDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `test-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, sampleContent);

    try {
      const res = await request(app)
        .post('/api/import/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', tempFile);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.sourceId).toBeDefined();
      expect(res.body.inserted).toBeGreaterThanOrEqual(10);
      expect(Array.isArray(res.body.fragments)).toBe(true);

      // Verify fragments in database
      const fragments = await Fragment.find({
        user: userId,
        source: res.body.sourceId,
      });

      expect(fragments.length).toBeGreaterThanOrEqual(10);
      expect(fragments.some(f => f.content.includes('MERN will be easier'))).toBe(true);
    } finally {
      // Cleanup temp file
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  test('POST /api/import/text - upload plain text', async () => {
    const res = await request(app)
      .post('/api/import/text')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Document',
        text: 'This is a test document. It contains multiple sentences. Each sentence is important. The system should parse them correctly.',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.sourceId).toBeDefined();
    expect(res.body.inserted).toBeGreaterThan(0);
  });

  test('GET /api/import/sources - list sources for user', async () => {
    const res = await request(app)
      .get('/api/import/sources')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results || res.body)).toBe(true);
  });
});
