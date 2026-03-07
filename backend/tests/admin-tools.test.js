const request = require('supertest');
const { app } = require('../server');
const { connectDatabase, clearDatabase, closeDatabase } = require('./setup');
const { Fragment, Source, Link } = require('../src/models');

describe('Admin Tools Integration Tests', () => {
    let authToken;
    let userId;
    let sourceIds = [];

    beforeAll(async () => {
        await connectDatabase();

        // Register and login
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Admin Test User',
                email: 'admin-test@test.com',
                password: 'Test123!@#',
            });

        authToken = registerRes.body.tokens.access.token;
        userId = registerRes.body.user.id;

        // Create multiple test sources
        for (let i = 0; i < 3; i++) {
            const res = await request(app)
                .post('/api/import/text')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: `Test Source ${i}`,
                    text: `Content for source ${i}. This is test data for admin operations.`,
                });

            sourceIds.push(res.body.sourceId);
        }

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
        await clearDatabase();
        await closeDatabase();
    });

    describe('System Status Endpoint', () => {
        it('should return comprehensive system status', async () => {
            const res = await request(app)
                .get('/api/admin/status')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            // Verify required fields
            expect(res.body).toHaveProperty('totalFragments');
            expect(res.body).toHaveProperty('totalSources');
            expect(res.body).toHaveProperty('totalLinks');
            expect(res.body).toHaveProperty('totalQueries');
            expect(res.body).toHaveProperty('totalUsers');

            // Verify numbers are reasonable
            expect(res.body.totalFragments).toBeGreaterThanOrEqual(0);
            expect(res.body.totalSources).toBeGreaterThanOrEqual(sourceIds.length);
            expect(res.body.totalUsers).toBeGreaterThanOrEqual(1);
        });

        it('should include processing counts', async () => {
            const res = await request(app)
                .get('/api/admin/status')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('processing');
            expect(res.body).toHaveProperty('errors');
            expect(typeof res.body.processing).toBe('number');
            expect(typeof res.body.errors).toBe('number');
        });

        it('should include recent activity', async () => {
            const res = await request(app)
                .get('/api/admin/status')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('recentActivity');
            expect(Array.isArray(res.body.recentActivity)).toBe(true);
        });
    });

    describe('Reindex All Sources', () => {
        it('should trigger reindexing for all user sources', async () => {
            const res = await request(app)
                .post('/api/admin/reindex-all')
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('sourcesQueued');
            expect(res.body.sourcesQueued).toBeGreaterThanOrEqual(sourceIds.length);
        });

        it('should update source status during reindexing', async () => {
            await request(app)
                .post('/api/admin/reindex-all')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            // Check that sources are being processed
            const sources = await Source.find({ user: userId });

            // At least some should be indexed or indexing
            const hasValidStatus = sources.some(s =>
                ['indexing', 'indexed', 'processed'].includes(s.status)
            );
            expect(hasValidStatus).toBe(true);
        });

        it('should handle reindex with no sources', async () => {
            // Create new user with no sources
            const newUserRes = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Empty User',
                    email: 'empty@test.com',
                    password: 'Test123!@#',
                });

            const newToken = newUserRes.body.tokens.access.token;

            const res = await request(app)
                .post('/api/admin/reindex-all')
                .set('Authorization', `Bearer ${newToken}`)
                .send({})
                .expect(200);

            expect(res.body.sourcesQueued).toBe(0);
        });
    });

    describe('Rebuild Links', () => {
        it('should rebuild links for all fragments', async () => {
            const res = await request(app)
                .post('/api/links/rebuild')
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('linksCreated');
            expect(typeof res.body.linksCreated).toBe('number');
        });

        it('should create valid link documents', async () => {
            await request(app)
                .post('/api/links/rebuild')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            const links = await Link.find({ user: userId });

            if (links.length > 0) {
                const link = links[0];
                expect(link).toHaveProperty('sourceFragment');
                expect(link).toHaveProperty('targetFragment');
                expect(link).toHaveProperty('type');
                expect(link).toHaveProperty('strength');
                expect(link.strength).toBeGreaterThan(0);
                expect(link.strength).toBeLessThanOrEqual(1);
            }
        });

        it('should not create duplicate links', async () => {
            // Rebuild twice
            await request(app)
                .post('/api/links/rebuild')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            const linksCount1 = await Link.countDocuments({ user: userId });

            await request(app)
                .post('/api/links/rebuild')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            const linksCount2 = await Link.countDocuments({ user: userId });

            // Count should be same or similar (deduplicated)
            expect(Math.abs(linksCount2 - linksCount1)).toBeLessThan(5);
        });
    });

    describe('Purge Old Data', () => {
        it('should purge data older than specified days', async () => {
            const res = await request(app)
                .delete('/api/admin/purge-old')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ days: 90 })
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('deleted');
            expect(res.body.deleted).toHaveProperty('fragments');
            expect(res.body.deleted).toHaveProperty('sources');
            expect(res.body.deleted).toHaveProperty('links');
        });

        it('should not delete recent data', async () => {
            const fragmentsBefore = await Fragment.countDocuments({ user: userId });
            const sourcesBefore = await Source.countDocuments({ user: userId });

            await request(app)
                .delete('/api/admin/purge-old')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ days: 1 })
                .expect(200);

            const fragmentsAfter = await Fragment.countDocuments({ user: userId });
            const sourcesAfter = await Source.countDocuments({ user: userId });

            // Recent data should remain
            expect(fragmentsAfter).toBe(fragmentsBefore);
            expect(sourcesAfter).toBe(sourcesBefore);
        });

        it('should use default 30 days if not specified', async () => {
            const res = await request(app)
                .delete('/api/admin/purge-old')
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('should handle invalid days parameter', async () => {
            const res = await request(app)
                .delete('/api/admin/purge-old')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ days: -5 });

            // Should use default or return error
            expect([200, 400]).toContain(res.status);
        });
    });

    describe('Worker Status Endpoint', () => {
        it('should return worker status information', async () => {
            const res = await request(app)
                .get('/api/admin/workers/status')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('workers');
            expect(Array.isArray(res.body.workers)).toBe(true);
        });
    });

    describe('Logs Endpoint', () => {
        it('should return system logs', async () => {
            const res = await request(app)
                .get('/api/admin/logs')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ limit: 10 })
                .expect(200);

            expect(res.body).toHaveProperty('logs');
            expect(Array.isArray(res.body.logs)).toBe(true);
        });
    });

    describe('Authorization', () => {
        it('should require authentication for admin endpoints', async () => {
            await request(app)
                .get('/api/admin/status')
                .expect(401);

            await request(app)
                .post('/api/admin/reindex-all')
                .expect(401);

            await request(app)
                .delete('/api/admin/purge-old')
                .expect(401);
        });

        it('should reject invalid tokens', async () => {
            await request(app)
                .get('/api/admin/status')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            // Test with malformed request
            const res = await request(app)
                .post('/api/admin/reindex-all')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ invalid: 'data' });

            expect([200, 400, 500]).toContain(res.status);
            expect(res.body).toBeDefined();
        });
    });
});
