const request = require('supertest');
const { app } = require('../server');
const { connectDatabase, clearDatabase, closeDatabase } = require('./setup');

describe('Query Error Conditions', () => {
    let authToken;
    let sourceId;

    beforeAll(async () => {
        await connectDatabase();

        // Register and login
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Query Test User',
                email: 'query-errors@test.com',
                password: 'Test123!@#',
            });

        authToken = registerRes.body.tokens.access.token;

        // Create test data
        const uploadRes = await request(app)
            .post('/api/import/text')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                title: 'Query Test Document',
                text: 'This is test content for query validation',
            });

        sourceId = uploadRes.body.sourceId;
    });

    afterAll(async () => {
        await clearDatabase();
        await closeDatabase();
    });

    describe('Query Length Validation', () => {
        it('should reject empty queries', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: '' })
                .expect(400);

            expect(res.body.error).toMatch(/required|empty/i);
        });

        it('should reject queries with only whitespace', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: '   ' })
                .expect(400);

            expect(res.body.error).toBeDefined();
        });

        it('should handle very long queries', async () => {
            const longQuery = 'test '.repeat(200); // ~1000 characters

            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: longQuery });

            // Should either succeed or return proper error
            expect([200, 400]).toContain(res.status);

            if (res.status === 200) {
                expect(res.body).toHaveProperty('summary');
                expect(res.body).toHaveProperty('evidence');
            }
        });

        it('should truncate extremely long queries gracefully', async () => {
            const extremelyLongQuery = 'a'.repeat(10000);

            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: extremelyLongQuery });

            // Should handle gracefully
            expect([200, 400, 413]).toContain(res.status);
        });
    });

    describe('Special Characters and Injection', () => {
        it('should handle queries with special characters', async () => {
            const specialChars = ['<script>alert("xss")</script>', '"; DROP TABLE users; --', '../../../etc/passwd'];

            for (const query of specialChars) {
                const res = await request(app)
                    .post('/api/query')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ q: query });

                // Should sanitize and handle safely
                expect([200, 400]).toContain(res.status);

                if (res.status === 200) {
                    expect(res.body).toHaveProperty('summary');
                    expect(res.body).toHaveProperty('evidence');
                }
            }
        });

        it('should handle Unicode and emoji characters', async () => {
            const unicodeQuery = '你好世界 🚀 🎉 ñoño';

            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: unicodeQuery })
                .expect(200);

            expect(res.body).toHaveProperty('summary');
            expect(res.body).toHaveProperty('evidence');
        });

        it('should handle queries with newlines and tabs', async () => {
            const formattedQuery = 'test\nquery\twith\r\nformatting';

            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: formattedQuery })
                .expect(200);

            expect(res.body).toHaveProperty('summary');
        });
    });

    describe('Parameter Validation', () => {
        it('should validate topK parameter', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: 'test', topK: -1 });

            // Should use default or return error
            expect([200, 400]).toContain(res.status);
        });

        it('should handle very large topK values', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: 'test', topK: 1000 })
                .expect(200);

            expect(res.body.evidence.length).toBeLessThanOrEqual(1000);
        });

        it('should handle non-numeric topK', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: 'test', topK: 'invalid' });

            // Should use default or return error
            expect([200, 400]).toContain(res.status);
        });
    });

    describe('Backend Failure Scenarios', () => {
        it('should return proper error for invalid auth token', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', 'Bearer invalid-token')
                .send({ q: 'test' })
                .expect(401);

            expect(res.body).toHaveProperty('message');
        });

        it('should handle missing authorization header', async () => {
            const res = await request(app)
                .post('/api/query')
                .send({ q: 'test' })
                .expect(401);

            expect(res.body).toHaveProperty('message');
        });

        it('should return empty results for queries with no matches', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: 'completely-nonexistent-unique-term-xyz123' })
                .expect(200);

            expect(res.body.evidence).toHaveLength(0);
            expect(res.body.summary).toBeDefined();
        });
    });

    describe('Response Format Validation', () => {
        it('should always return correct response structure', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: 'test' })
                .expect(200);

            // Verify response structure
            expect(res.body).toHaveProperty('summary');
            expect(res.body).toHaveProperty('evidence');
            expect(res.body).toHaveProperty('timeline');
            expect(res.body).toHaveProperty('graph');

            expect(Array.isArray(res.body.evidence)).toBe(true);
            expect(Array.isArray(res.body.timeline)).toBe(true);
            expect(res.body.graph).toHaveProperty('nodes');
            expect(res.body.graph).toHaveProperty('edges');
        });

        it('should include all required evidence fields', async () => {
            const res = await request(app)
                .post('/api/query')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ q: 'content' })
                .expect(200);

            if (res.body.evidence.length > 0) {
                const evidence = res.body.evidence[0];
                expect(evidence).toHaveProperty('_id');
                expect(evidence).toHaveProperty('text');
                expect(evidence).toHaveProperty('score');
                expect(evidence).toHaveProperty('sender');
                expect(evidence).toHaveProperty('datetime');

                // Validate score is between 0 and 1
                expect(evidence.score).toBeGreaterThanOrEqual(0);
                expect(evidence.score).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('Rate Limiting', () => {
        it('should handle rapid successive queries', async () => {
            const queries = [];

            for (let i = 0; i < 10; i++) {
                queries.push(
                    request(app)
                        .post('/api/query')
                        .set('Authorization', `Bearer ${authToken}`)
                        .send({ q: `query ${i}` })
                );
            }

            const results = await Promise.all(queries);

            // Most should succeed, some might be rate-limited
            const successCount = results.filter(r => r.status === 200).length;
            expect(successCount).toBeGreaterThan(0);
        });
    });
});
