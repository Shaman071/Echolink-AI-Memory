require('./setup');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../src/models/User');
// Fragment is already loaded by server.js
const { indexFragments, search } = require('../src/services/indexer.service');
const { addDocumentsToService, queryEmbeddingService } = require('../src/services/embedding.service');

jest.mock('../src/services/embedding.service');

describe('Indexer Service', () => {
  let testUser;
  let Fragment;

  beforeEach(async () => {
    // Get Fragment model (already compiled by app/server.js)
    Fragment = mongoose.model('Fragment');

    // Clear database
    await User.deleteMany({});
    await Fragment.deleteMany({});

    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@test.com',
      password: 'hashedPassword123',
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('indexFragments', () => {
    it('should map fragments to embed service format and post to /add', async () => {
      // Create test source first
      const Source = mongoose.model('Source');
      const source = await Source.create({
        user: testUser._id,
        title: 'Test Source',
        type: 'whatsapp',
      });

      // Create test fragments
      const fragments = [
        {
          _id: new mongoose.Types.ObjectId(),
          text: 'This is a test message',
          sender: 'John',
          datetime: new Date(),
          user: testUser._id,
          source: source._id,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          text: 'Another message here',
          sender: 'Jane',
          datetime: new Date(),
          user: testUser._id,
          source: source._id,
        },
      ];

      // Mock successful response
      addDocumentsToService.mockResolvedValue({
        success: 2,
        failed: 0,
        total: 2,
      });

      // Call indexFragments
      const result = await indexFragments(fragments);

      // Verify mapping - addDocumentsToService receives array
      expect(addDocumentsToService).toHaveBeenCalled();
      const callArgs = addDocumentsToService.mock.calls[0][0];
      expect(Array.isArray(callArgs)).toBe(true);
      expect(callArgs[0]).toMatchObject({
        id: fragments[0]._id.toString(),
        text: 'This is a test message',
        meta: expect.objectContaining({
          sender: 'John',
        }),
      });

      // Verify result
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle embedding service errors gracefully', async () => {
      const Source = mongoose.model('Source');
      const source = await Source.create({
        user: testUser._id,
        title: 'Test Source',
        type: 'whatsapp',
      });

      const fragments = [
        {
          _id: new mongoose.Types.ObjectId(),
          text: 'Test message',
          sender: 'Test',
          datetime: new Date(),
          user: testUser._id,
          source: source._id,
        },
      ];

      // Mock error response
      addDocumentsToService.mockRejectedValue(new Error('Service unavailable'));

      // Should not throw, should return error result
      const result = await indexFragments(fragments);
      
      expect(result.error).toBeDefined();
    });

    it('should handle empty fragment list', async () => {
      addDocumentsToService.mockResolvedValue({
        success: 0,
        failed: 0,
        total: 0,
      });

      const result = await indexFragments([]);

      expect(result.total).toBe(0);
    });
  });

  describe('search', () => {
    it('should query embed service and return results with fragment IDs', async () => {
      // Mock embed service response
      queryEmbeddingService.mockResolvedValue([
        {
          id: new mongoose.Types.ObjectId().toString(),
          score: 0.95,
        },
        {
          id: new mongoose.Types.ObjectId().toString(),
          score: 0.87,
        },
      ]);

      // Perform search
      const results = await search('test query', 5);

      // Verify embed service was called
      expect(queryEmbeddingService).toHaveBeenCalled();

      // Verify results format
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('score');
      expect(results[0].score).toBe(0.95);
    });

    it('should use default k parameter', async () => {
      queryEmbeddingService.mockResolvedValue([]);

      await search('test query');

      // Verify service was called
      expect(queryEmbeddingService).toHaveBeenCalled();
    });

    it('should handle embed service errors', async () => {
      queryEmbeddingService.mockRejectedValue(new Error('Service error'));

      const results = await search('test query', 5);

      // Should return empty array on error (graceful degradation)
      expect(Array.isArray(results)).toBe(true);
      // Can be empty or contain partial results
      expect(results).toBeDefined();
    });

    it('should preserve fragment ID format (string)', async () => {
      const fragmentId = new mongoose.Types.ObjectId().toString();
      
      queryEmbeddingService.mockResolvedValue([
        {
          id: fragmentId,
          score: 0.92,
        },
      ]);

      const results = await search('test', 5);

      expect(results[0].id).toBe(fragmentId);
      expect(typeof results[0].id).toBe('string');
    });
  });

  describe('Integration: import → indexing flow', () => {
    it('should index fragments after import', async () => {
      // This test verifies the async indexing trigger works
      // Create a source first
      const Source = mongoose.model('Source');
      const source = await Source.create({
        user: testUser._id,
        title: 'Test Source',
        type: 'whatsapp',
        status: 'processed',
      });

      // Create a fragment to mimic what importWhatsApp does
      const fragment = await Fragment.create({
        user: testUser._id,
        source: source._id,
        text: 'Integration test message',
        sender: 'TestSender',
        datetime: new Date(),
      });

      addDocumentsToService.mockResolvedValue({
        success: 1,
        failed: 0,
        total: 1,
      });

      // Call indexFragments as import controller would
      const result = await indexFragments([fragment]);

      // Verify indexing occurred
      expect(addDocumentsToService).toHaveBeenCalled();
      expect(result.success).toBe(1);
    });
  });
});
