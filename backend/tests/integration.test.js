const request = require('supertest');
const { app } = require('../server');
const { connectDatabase, clearDatabase, closeDatabase } = require('./setup');

describe('Full Integration Test: Upload → Index → Search → Graph', () => {
    let authToken;
    let userId;
    let sourceId;
    let fragmentIds = [];

    beforeAll(async () => {
        await connectDatabase();
    });

    afterAll(async () => {
        await clearDatabase();
        await closeDatabase();
    });

    describe('Phase 1: Authentication', () => {
        it('should register a new user', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'integration@test.com',
                    password: 'Test123!@#',
                })
                .expect(201);

            expect(res.body).toHaveProperty('user');
            expect(res.body).toHaveProperty('tokens');
            expect(res.body.tokens).toHaveProperty('access');

            authToken = res.body.tokens.access.token;
            userId = res.body.user.id;
        });

        it('should login with credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'integration@test.com',
                    password: 'Test123!@#',
                })
                .expect(200);

            expect(res.body).toHaveProperty('tokens');
            authToken = res.body.tokens.access.token;
        });
    });

    describe('Phase 2: Upload & Parse', () => {
        it('should upload plain text', async () => {
            const testText = `This is a test document about artificial intelligence and machine learning.
      Machine learning is a subset of AI that focuses on training models.
      Deep learning uses neural networks with multiple layers.`;

            const res = await request(app)
                .post('/api/import/text')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'AI Test Document',
                    text: testText,
                })
                .expect(200);

            expect(res.body).toHaveProperty('ok', true);
            expect(res.body).toHaveProperty('sourceId');
            expect(res.body).toHaveProperty('inserted');
            expect(res.body.inserted).toBeGreaterThan(0);

            sourceId = res.body.sourceId;
            fragmentIds = res.body.fragments.map(f => f._id);
        });

        it('should retrieve uploaded source', async () => {
            const res = await request(app)
                .get(`/api/import/sources/${sourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('_id', sourceId);
            expect(res.body).toHaveProperty('status');
            expect(['processing', 'processed', 'indexed']).toContain(res.body.status);
        });
    });

    describe('Phase 3: Indexing & Embeddings', () => {
        it('should trigger manual indexing', async () => {
            const res = await request(app)
                .post(`/api/import/sources/${sourceId}/index`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ force: true })
                .expect(200);

            expect(res.body).toHaveProperty('success');

            // Wait for indexing to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
        });

        it('should have indexed fragments', async () => {
            const res = await request(app)
                .get('/api/fragments')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ sourceId, limit: 10 })
                .expect(200);

            expect(res.body).toHaveProperty('results');
            expect(Array.isArray(res.body.results)).toBe(true);
            expect(res.body.results.length).toBeGreaterThan(0);

            // Check if at least one fragment has been indexed
            const indexed = res.body.results.some(f => f.status === 'indexed');
            expect(indexed).toBe(true);
        });
    });

    describe('Phase 4: Semantic Search', () => {
        it('should perform semantic search', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    q: 'machine learning and AI',
                    topK: 5,
                })
                .expect(200);

            // Verify response format matches spec
            expect(res.body).toHaveProperty('summary');
            expect(res.body).toHaveProperty('evidence');
            expect(res.body).toHaveProperty('timeline');
            expect(res.body).toHaveProperty('graph');

            // Evidence should be array
            expect(Array.isArray(res.body.evidence)).toBe(true);

            // Each evidence item should have required fields
            if (res.body.evidence.length > 0) {
                const evidence = res.body.evidence[0];
                expect(evidence).toHaveProperty('_id');
                expect(evidence).toHaveProperty('text');
                expect(evidence).toHaveProperty('score');
                expect(evidence.score).toBeGreaterThan(0);
                expect(evidence.score).toBeLessThanOrEqual(1);
            }

            // Timeline should be array of {date, count}
            expect(Array.isArray(res.body.timeline)).toBe(true);

            // Graph should have nodes and edges
            expect(res.body.graph).toHaveProperty('nodes');
            expect(res.body.graph).toHaveProperty('edges');
            expect(Array.isArray(res.body.graph.nodes)).toBe(true);
            expect(Array.isArray(res.body.graph.edges)).toBe(true);
        });

        it('should return empty results for irrelevant query', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    q: 'quantum physics thermodynamics', // Unrelated to uploaded content
                    topK: 5,
                })
                .expect(200);

            expect(res.body).toHaveProperty('summary');
            expect(res.body.evidence.length).toBe(0);
        });
    });

    describe('Phase 5: Knowledge Graph & Links', () => {
        it('should rebuild links', async () => {
            const res = await request(app)
                .post('/api/links/rebuild')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('linksCreated');
        });

        it('should get graph data', async () => {
            const res = await request(app)
                .get('/api/graph')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ limit: 50 })
                .expect(200);

            expect(res.body).toHaveProperty('nodes');
            expect(res.body).toHaveProperty('edges');
            expect(Array.isArray(res.body.nodes)).toBe(true);
            expect(Array.isArray(res.body.edges)).toBe(true);
        });

        it('should get timeline data', async () => {
            const res = await request(app)
                .get('/api/timeline')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('Phase 6: Admin Functions', () => {
        it('should get system status', async () => {
            const res = await request(app)
                .get('/api/status')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('counts');
            expect(res.body.counts).toHaveProperty('fragments');
            expect(res.body.counts).toHaveProperty('sources');
            expect(res.body.counts.fragments).toBeGreaterThan(0);
        });

        it('should get admin status', async () => {
            const res = await request(app)
                .get('/api/admin/status')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('totalFragments');
            expect(res.body).toHaveProperty('totalSources');
            expect(res.body).toHaveProperty('totalLinks');
        });
    });

    describe('Phase 7: Data Management', () => {
        it('should delete source and fragments', async () => {
            const res = await request(app)
                .delete(`/api/import/sources/${sourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
        });

        it('should verify source is deleted', async () => {
            await request(app)
                .get(`/api/import/sources/${sourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });
});
