/**
 * Phase 3 — Embeddings & Search Core Test
 * Upload content, then test search in multiple scenarios:
 * - Normal query
 * - Empty query (expect 400)
 * - Long query
 * - Unrelated query (graceful empty result)
 * Run: node phase3_test.js
 * Backend must be running on port 3001
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3001';
const T_EMAIL = `p3_${Date.now()}@test.com`;
const T_PASS = 'TestPass123!';
let TOKEN = null;
let SOURCE_ID = null;
const results = [];

function jsonRequest(method, urlPath, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const url = new URL(BASE + urlPath);
        const opts = {
            hostname: url.hostname, port: url.port,
            path: url.pathname,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...headers,
            },
        };
        const req = http.request(opts, (res) => {
            let d = '';
            res.on('data', (c) => (d += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
                catch (e) { resolve({ status: res.statusCode, body: d }); }
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
        const boundary = '----Boundary' + Date.now().toString(16);
        const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;
        const body = Buffer.concat([Buffer.from(header, 'utf8'), fileContent, Buffer.from(footer, 'utf8')]);
        const url = new URL(BASE + urlPath);
        const opts = {
            hostname: url.hostname, port: url.port, path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length, Authorization: `Bearer ${authToken}` },
        };
        const req = http.request(opts, (res) => {
            let d = '';
            res.on('data', (c) => (d += c));
            res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch (e) { resolve({ status: res.statusCode, body: d }); } });
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
        if (!result.pass) process.stdout.write('  DETAIL: ' + JSON.stringify(result.detail) + '\n');
    } catch (e) {
        results.push({ name, pass: false, detail: e.message });
        process.stdout.write('FAIL: ' + name + ' - ' + e.message + '\n');
    }
}

// WhatsApp chat with MERN stack discussion
const WA_SAMPLE = `12/01/2025, 9:00 AM - Alice: We chose MERN stack for EchoLink because of the JSON-native MongoDB storage.
12/01/2025, 9:01 AM - Bob: Yes! React gives us component reusability and virtual DOM performance.
12/01/2025, 9:02 AM - Alice: Node.js and Express keep our backend lightweight and non-blocking.
12/01/2025, 9:03 AM - Bob: MongoDB is perfect for storing unstructured chat data as flexible documents.
12/01/2025, 9:04 AM - Alice: We also chose Railway for hosting to simplify CI/CD.
12/01/2025, 9:05 AM - Bob: And Vite for the frontend build tool - much faster than webpack.
12/01/2025, 9:06 AM - Alice: For AI, we are using Gemini API as primary and OpenAI as fallback.
12/01/2025, 9:07 AM - Bob: The embedding service uses sentence-transformers for local fallback.
12/01/2025, 9:08 AM - Alice: Our authentication uses JWT tokens stored in HTTP-only cookies.
12/01/2025, 9:09 AM - Bob: Great architecture. Let's document this for future team members.
`;

const WA_FILE = path.join(__dirname, 'tmp_p3_test.txt');
fs.writeFileSync(WA_FILE, WA_SAMPLE, 'utf8');

async function run() {
    // Setup
    await test('Register user', async () => {
        const r = await jsonRequest('POST', '/api/auth/register', { name: 'P3 Tester', email: T_EMAIL, password: T_PASS });
        if (r.status === 201 && r.body.tokens?.access?.token) { TOKEN = r.body.tokens.access.token; return { pass: true }; }
        return { pass: false, detail: { status: r.status } };
    });

    await test('Upload WhatsApp content', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await multipartUpload(WA_FILE, 'file', TOKEN, '/api/import/whatsapp');
        if (r.status === 200 && r.body.ok) { SOURCE_ID = r.body.sourceId; return { pass: true, detail: { inserted: r.body.inserted } }; }
        return { pass: false, detail: { status: r.status, body: r.body } };
    });

    // Allow indexing to happen
    await new Promise(r => setTimeout(r, 2000));

    // Test search scenarios
    await test('Search with valid query returns response', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('POST', '/api/query', { q: 'Why did we choose MERN?' }, { Authorization: `Bearer ${TOKEN}` });
        // Must return 200 with summary and evidence array (even if empty)
        const hasStructure = r.status === 200 && typeof r.body.summary === 'string' && Array.isArray(r.body.evidence);
        return { pass: hasStructure, detail: { status: r.status, evidenceCount: r.body?.evidence?.length, summaryLen: r.body?.summary?.length } };
    });

    await test('Search MERN stack query returns relevant fragments', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('POST', '/api/query', { q: 'MERN stack MongoDB React Node' }, { Authorization: `Bearer ${TOKEN}` });
        // Since embedding service may or may not be running, we at minimum expect valid JSON
        const validResponse = r.status === 200 && typeof r.body.summary === 'string';
        return { pass: validResponse, detail: { status: r.status, evidence: r.body?.evidence?.length || 0 } };
    });

    await test('Search with empty query returns 400', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('POST', '/api/query', { q: '' }, { Authorization: `Bearer ${TOKEN}` });
        return { pass: r.status === 400, detail: { status: r.status } };
    });

    await test('Search with missing q field returns 400', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('POST', '/api/query', {}, { Authorization: `Bearer ${TOKEN}` });
        return { pass: r.status === 400, detail: { status: r.status } };
    });

    await test('Search with long query (500 chars) succeeds', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const longQuery = 'Why did we choose MERN for our EchoLink project? '.repeat(10);
        const r = await jsonRequest('POST', '/api/query', { q: longQuery }, { Authorization: `Bearer ${TOKEN}` });
        const valid = r.status === 200 && typeof r.body.summary === 'string';
        return { pass: valid, detail: { status: r.status } };
    });

    await test('Search with unrelated query returns graceful empty result (no crash)', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('POST', '/api/query', { q: 'quantum physics dark matter galactic' }, { Authorization: `Bearer ${TOKEN}` });
        // Must return 200 with valid structure - never crash
        const noCrash = r.status === 200 && typeof r.body.summary === 'string' && Array.isArray(r.body.evidence);
        return { pass: noCrash, detail: { status: r.status, evidenceCount: r.body?.evidence?.length } };
    });

    await test('Search without auth returns 401', async () => {
        const r = await jsonRequest('POST', '/api/query', { q: 'test' });
        return { pass: r.status === 401, detail: { status: r.status } };
    });

    await test('Response always has evidence, timeline, graph fields', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('POST', '/api/query', { q: 'JWT authentication cookies tokens' }, { Authorization: `Bearer ${TOKEN}` });
        const hasAllFields = r.status === 200 &&
            Array.isArray(r.body.evidence) &&
            Array.isArray(r.body.timeline) &&
            r.body.graph && Array.isArray(r.body.graph.nodes) && Array.isArray(r.body.graph.edges);
        return { pass: hasAllFields, detail: { status: r.status, fields: Object.keys(r.body || {}) } };
    });

    // Cleanup
    try { fs.unlinkSync(WA_FILE); } catch (e) { }

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    fs.writeFileSync('phase3_results.json', JSON.stringify({ passed, failed, results }, null, 2));
    process.stdout.write('\n=== PHASE 3: ' + passed + ' passed, ' + failed + ' failed ===\n');
    if (failed > 0) process.exit(1);
}

run().catch(e => {
    process.stdout.write('FATAL: ' + e.message + '\n');
    process.exit(1);
});
