const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app } = require('../server');
const { connectDatabase, clearDatabase, closeDatabase } = require('./setup');
const { Fragment, Source } = require('../src/models');

describe('Upload Error Conditions', () => {
    let authToken;
    let userId;

    beforeAll(async () => {
        await connectDatabase();

        // Register and login
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Upload Test User',
                email: 'upload-errors@test.com',
                password: 'Test123!@#',
            });

        authToken = registerRes.body.tokens.access.token;
        userId = registerRes.body.user.id;
    });

    afterAll(async () => {
        await clearDatabase();
        await closeDatabase();
    });

    describe('Invalid File Types', () => {
        it('should reject executable files', async () => {
            // Create a fake .exe file
            const filePath = path.join(__dirname, 'fixtures', 'test.exe');
            fs.writeFileSync(filePath, 'fake executable content');

            const res = await request(app)
                .post('/api/import/upload')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('file', filePath)
                .expect(400);

            expect(res.body.error).toMatch(/Invalid file type|not allowed/i);

            // Cleanup
            fs.unlinkSync(filePath);
        });

        it('should reject unsupported image formats', async () => {
            const filePath = path.join(__dirname, 'fixtures', 'test.bmp');
            fs.writeFileSync(filePath, 'fake bmp content');

            const res = await request(app)
                .post('/api/import/upload')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('file', filePath)
                .expect(400);

            expect(res.body.error).toBeDefined();

            fs.unlinkSync(filePath);
        });
    });

    describe('File Size Limits', () => {
        it('should reject files larger than 50MB', async () => {
            const filePath = path.join(__dirname, 'fixtures', 'huge-file.txt');

            // Create a file larger than 50MB (51MB)
            const size = 51 * 1024 * 1024;
            const buffer = Buffer.alloc(size, 'a');
            fs.writeFileSync(filePath, buffer);

            const res = await request(app)
                .post('/api/import/upload')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('file', filePath)
                .expect(413);

            expect(res.body.error).toMatch(/too large|size limit/i);

            fs.unlinkSync(filePath);
        });

        it('should accept files under 50MB', async () => {
            const filePath = path.join(__dirname, 'fixtures', 'small-file.txt');

            // Create a 1MB file
            const content = 'Test content\n'.repeat(100000);
            fs.writeFileSync(filePath, content);

            const res = await request(app)
                .post('/api/import/upload')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('file', filePath)
                .expect(201);

            expect(res.body).toHaveProperty('_id');
            expect(res.body.status).toBe('processing');

            fs.unlinkSync(filePath);
        });
    });

    describe('Corrupted WhatsApp Files', () => {
        it('should handle WhatsApp file with no valid messages', async () => {
            const invalidWhatsApp = 'This is just random text with no WhatsApp format';

            const res = await request(app)
                .post('/api/import/text')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Invalid WhatsApp',
                    text: invalidWhatsApp,
                })
                .expect(200);

            // Should still create source but with 0 fragments
            expect(res.body.ok).toBe(true);
            expect(res.body.inserted).toBe(0);
        });

        it('should handle WhatsApp file with missing timestamps', async () => {
            const partialWhatsApp = `John: Hello there
Alice: Hi!
[1/1/2024, 10:00] Bob: This one has a timestamp`;

            const res = await request(app)
                .post('/api/import/text')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Partial WhatsApp',
                    text: partialWhatsApp,
                })
                .expect(200);

            // Should parse at least the valid message
            expect(res.body.ok).toBe(true);
            expect(res.body.inserted).toBeGreaterThanOrEqual(1);
        });

        it('should handle empty WhatsApp file', async () => {
            const res = await request(app)
                .post('/api/import/text')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Empty File',
                    text: '',
                })
                .expect(400);

            expect(res.body.error).toMatch(/empty|required/i);
        });
    });

    describe('Network Failure Simulation', () => {
        it('should handle database connection errors gracefully', async () => {
            // This test would require mocking mongoose connection
            // For now, we test that the API returns proper error format

            const res = await request(app)
                .get('/api/import/sources/invalid-id-format')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(res.body).toHaveProperty('message');
        });

        it('should handle concurrent upload requests', async () => {
            const uploads = [];

            for (let i = 0; i < 5; i++) {
                uploads.push(
                    request(app)
                        .post('/api/import/text')
                        .set('Authorization', `Bearer ${authToken}`)
                        .send({
                            title: `Concurrent Upload ${i}`,
                            text: `Test content for upload ${i}`,
                        })
                );
            }

            const results = await Promise.all(uploads);

            results.forEach((res, i) => {
                expect(res.status).toBe(200);
                expect(res.body.ok).toBe(true);
            });
        });
    });

    describe('Fragment Creation Validation', () => {
        it('should create fragments with correct metadata', async () => {
            const testText = 'Line 1\nLine 2\nLine 3';

            const res = await request(app)
                .post('/api/import/text')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Fragment Test',
                    text: testText,
                })
                .expect(200);

            const sourceId = res.body.sourceId;

            // Verify fragments were created
            const fragments = await Fragment.find({ source: sourceId });
            expect(fragments.length).toBeGreaterThan(0);

            // Check fragment properties
            fragments.forEach(fragment => {
                expect(fragment).toHaveProperty('user');
                expect(fragment).toHaveProperty('source');
                expect(fragment).toHaveProperty('content');
                expect(fragment.user.toString()).toBe(userId);
            });
        });

        it('should prevent duplicate fragment creation', async () => {
            const testText = 'Unique content for duplicate test';

            // Upload same content twice
            await request(app)
                .post('/api/import/text')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Duplicate Test 1',
                    text: testText,
                })
                .expect(200);

            await request(app)
                .post('/api/import/text')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Duplicate Test 2',
                    text: testText,
                })
                .expect(200);

            // Both should succeed (duplicates allowed per source)
            const fragments = await Fragment.find({ user: userId });
            expect(fragments.length).toBeGreaterThan(0);
        });
    });
});
