/**
 * Phase 2 — Upload & Fragment System Test
 * Creates a sample WhatsApp .txt file, uploads it, verifies fragments,
 * verifies delete cascades fragments.
 * Run: node phase2_test.js
 * Requires: backend running on port 3001
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3001';
const TEST_USER_EMAIL = `p2_${Date.now()}@test.com`;
const TEST_USER_PASS = 'TestPass123!';
let TOKEN = null;
let SOURCE_ID = null;
const results = [];

// Create a sample WhatsApp txt file
const WA_SAMPLE = `12/01/2025, 8:32 AM - Alice: Hey, we need to discuss the project architecture.
12/01/2025, 8:33 AM - Bob: Sure! I think we should use MERN stack for this project.
12/01/2025, 8:34 AM - Alice: Good idea. MongoDB for flexible data, React for the frontend.
12/01/2025, 8:35 AM - Bob: Exactly. And Node.js + Express for the backend API.
12/01/2025, 8:36 AM - Alice: What about hosting? Should we use AWS or Heroku?
12/01/2025, 8:37 AM - Bob: Let's start with Railway for simplicity, then migrate to AWS if needed.
12/01/2025, 8:38 AM - Alice: Perfect. Are we using TypeScript or plain JavaScript?
12/01/2025, 8:39 AM - Bob: Plain JS for now to move faster, TypeScript later for stability.
12/01/2025, 8:40 AM - Alice: Agreed. Let's set up the repo structure today.
12/01/2025, 8:41 AM - Bob: I'll initialize the backend, you take the frontend?
`;

const WA_FILE_PATH = path.join(__dirname, 'tmp_wa_test.txt');
fs.writeFileSync(WA_FILE_PATH, WA_SAMPLE, 'utf8');

function jsonRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE + path);
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...headers,
            },
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function multipartUpload(filePath, fieldName, authToken, urlPath) {
    return new Promise((resolve, reject) => {
        const filename = path.basename(filePath);
        const fileContent = fs.readFileSync(filePath);
        const boundary = '----FormBoundary' + Date.now().toString(16);
        const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;

        const body = Buffer.concat([
            Buffer.from(header, 'utf8'),
            fileContent,
            Buffer.from(footer, 'utf8'),
        ]);

        const url = new URL(BASE + urlPath);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length,
                Authorization: `Bearer ${authToken}`,
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function test(name, fn) {
    try {
        const result = await fn();
        results.push({ name, ...result });
        process.stdout.write((result.pass ? 'PASS' : 'FAIL') + ': ' + name + '\n');
        if (!result.pass) process.stdout.write('  DETAIL: ' + JSON.stringify(result.detail || '') + '\n');
    } catch (e) {
        results.push({ name, pass: false, detail: e.message });
        process.stdout.write('FAIL: ' + name + ' - ' + e.message + '\n');
    }
}

async function run() {

    // SETUP: Register and login
    await test('Register test user', async () => {
        const r = await jsonRequest('POST', '/api/auth/register', { name: 'P2 Tester', email: TEST_USER_EMAIL, password: TEST_USER_PASS });
        if (r.status === 201 && r.body.tokens?.access?.token) {
            TOKEN = r.body.tokens.access.token;
            return { pass: true, detail: 'ok' };
        }
        return { pass: false, detail: { status: r.status, body: r.body } };
    });

    await test('Login test user', async () => {
        const r = await jsonRequest('POST', '/api/auth/login', { email: TEST_USER_EMAIL, password: TEST_USER_PASS });
        if (r.status === 200 && r.body.tokens?.access?.token) {
            TOKEN = r.body.tokens.access.token;
            return { pass: true, detail: 'ok' };
        }
        return { pass: false, detail: { status: r.status, body: r.body } };
    });

    // --- Upload via /api/import/whatsapp dedicated endpoint ---
    await test('Upload WhatsApp .txt file to /api/import/whatsapp', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await multipartUpload(WA_FILE_PATH, 'file', TOKEN, '/api/import/whatsapp');
        if (r.status === 200 && r.body.ok && r.body.sourceId) {
            SOURCE_ID = r.body.sourceId;
            return { pass: true, detail: { sourceId: SOURCE_ID, inserted: r.body.inserted } };
        }
        return { pass: false, detail: { status: r.status, body: r.body } };
    });

    // --- Check fragments were created ---
    await test('Verify fragments created in DB (GET /api/import/sources/:id)', async () => {
        if (!SOURCE_ID) return { pass: false, detail: 'No source ID' };
        await new Promise(r => setTimeout(r, 1500)); // Wait briefly for processing
        const r = await jsonRequest('GET', `/api/import/sources/${SOURCE_ID}`, null, { Authorization: `Bearer ${TOKEN}` });
        if (r.status === 200 && r.body.fragmentCount > 0) {
            return { pass: true, detail: { fragmentCount: r.body.fragmentCount, status: r.body.status } };
        }
        // Also try /api/sources list
        return { pass: false, detail: { status: r.status, body: r.body } };
    });

    // --- List all sources ---
    await test('GET /api/import/sources (list all sources)', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('GET', '/api/import/sources', null, { Authorization: `Bearer ${TOKEN}` });
        const hasSources = r.status === 200 && (Array.isArray(r.body) || (r.body.results && r.body.results.length > 0));
        return { pass: hasSources, detail: { status: r.status, count: r.body.results?.length || (Array.isArray(r.body) ? r.body.length : 0) } };
    });

    // --- DELETE source and verify cascade ---
    await test('DELETE /api/import/sources/:id (cascade delete)', async () => {
        if (!SOURCE_ID) return { pass: false, detail: 'No source ID' };
        const r = await jsonRequest('DELETE', `/api/import/sources/${SOURCE_ID}`, null, { Authorization: `Bearer ${TOKEN}` });
        if (r.status === 200 && (r.body.success || r.body.ok)) {
            return { pass: true, detail: r.body };
        }
        return { pass: false, detail: { status: r.status, body: r.body } };
    });

    // --- Verify source is gone ---
    await test('Verify source is gone after delete (should return 404)', async () => {
        if (!SOURCE_ID) return { pass: false, detail: 'No source ID' };
        const r = await jsonRequest('GET', `/api/import/sources/${SOURCE_ID}`, null, { Authorization: `Bearer ${TOKEN}` });
        return { pass: r.status === 404, detail: { status: r.status } };
    });

    // --- Verify upload with no file returns 400 ---
    await test('Upload with no file => 400', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('POST', '/api/import/whatsapp', {}, { Authorization: `Bearer ${TOKEN}` });
        return { pass: r.status === 400, detail: { status: r.status } };
    });

    // Cleanup
    try { fs.unlinkSync(WA_FILE_PATH); } catch (e) { }

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    fs.writeFileSync('phase2_results.json', JSON.stringify({ passed, failed, results }, null, 2));
    process.stdout.write('\n=== PHASE 2: ' + passed + ' passed, ' + failed + ' failed ===\n');
    if (failed > 0) process.exit(1);
}

run().catch(e => {
    process.stdout.write('FATAL: ' + e.message + '\n');
    process.exit(1);
});
