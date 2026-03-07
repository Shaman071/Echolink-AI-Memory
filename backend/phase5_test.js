/**
 * Phase 5 — Knowledge Graph Test
 * Tests link listing, rebuild endpoint, and empty state handling.
 * Run: node phase5_test.js
 * Backend must be running on port 3001
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3001';
const T_EMAIL = `p5_${Date.now()}@test.com`;
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
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch (e) { resolve({ status: res.statusCode, body: d }); } });
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
            res.on('data', c => d += c);
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

const WA_CONTENT = `12/01/2025, 9:00 AM - Alice: MERN stack chosen for EchoLink for flexibility and performance.
12/01/2025, 9:01 AM - Bob: React gives us component reusability.
12/01/2025, 9:02 AM - Alice: MongoDB stores flexible JSON documents natively.
12/01/2025, 9:03 AM - Bob: Node.js and Express build the REST API.
12/01/2025, 9:04 AM - Alice: Railway is our CI/CD deployment platform.
12/01/2025, 9:05 AM - Bob: We use JWT for stateless authentication tokens.
`;
const WA_FILE = path.join(__dirname, 'tmp_p5_test.txt');
fs.writeFileSync(WA_FILE, WA_CONTENT, 'utf8');

async function run() {
    await test('Register user', async () => {
        const r = await jsonRequest('POST', '/api/auth/register', { name: 'P5 Tester', email: T_EMAIL, password: T_PASS });
        if (r.status === 201 && r.body.tokens?.access?.token) { TOKEN = r.body.tokens.access.token; return { pass: true }; }
        return { pass: false, detail: { status: r.status } };
    });

    await test('Upload content', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await multipartUpload(WA_FILE, 'file', TOKEN, '/api/import/whatsapp');
        if (r.status === 200 && r.body.ok) { SOURCE_ID = r.body.sourceId; return { pass: true, detail: { inserted: r.body.inserted } }; }
        return { pass: false, detail: { status: r.status, body: r.body } };
    });

    await new Promise(r => setTimeout(r, 1000));

    // Test GET /api/links (initially empty)
    await test('GET /api/links returns valid response (no links yet)', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('GET', '/api/links', null, { Authorization: `Bearer ${TOKEN}` });
        // Expect 200 with array or pagination object
        const validEmpty = r.status === 200 && (Array.isArray(r.body) || r.body.results !== undefined);
        return { pass: validEmpty, detail: { status: r.status, type: typeof r.body } };
    });

    // Test rebuild (it will skip if no embedded fragments but should not crash)
    await test('POST /api/links/rebuild returns success (even if 0 links, no crash)', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('POST', '/api/links/rebuild', {}, { Authorization: `Bearer ${TOKEN}` });
        // Should return 200 with linksCreated (may be 0 if embedding service not running)
        const validResponse = r.status === 200 && (r.body.linksCreated !== undefined || r.body.message);
        return { pass: validResponse, detail: { status: r.status, linksCreated: r.body?.linksCreated } };
    });

    // Test auth guard on links
    await test('GET /api/links without auth returns 401', async () => {
        const r = await jsonRequest('GET', '/api/links');
        return { pass: r.status === 401, detail: { status: r.status } };
    });

    await test('POST /api/links/rebuild without auth returns 401', async () => {
        const r = await jsonRequest('POST', '/api/links/rebuild', {});
        return { pass: r.status === 401, detail: { status: r.status } };
    });

    // Test query graph response (nodes/edges structure)
    await test('POST /api/query graph field is always valid {nodes, edges}', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('POST', '/api/query', { q: 'MERN stack' }, { Authorization: `Bearer ${TOKEN}` });
        const validGraph = r.status === 200 &&
            r.body.graph &&
            Array.isArray(r.body.graph.nodes) &&
            Array.isArray(r.body.graph.edges);
        return { pass: validGraph, detail: { nodes: r.body?.graph?.nodes?.length, edges: r.body?.graph?.edges?.length } };
    });

    // Test GET /api/links/graph endpoint if it exists  
    await test('GET /api/links/graph returns nodes/edges or 404 (not 500)', async () => {
        if (!TOKEN) return { pass: false, detail: 'No token' };
        const r = await jsonRequest('GET', '/api/links/graph', null, { Authorization: `Bearer ${TOKEN}` });
        const noCrash = r.status !== 500;
        return { pass: noCrash, detail: { status: r.status } };
    });

    // Cleanup
    try { fs.unlinkSync(WA_FILE); } catch (e) { }

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    fs.writeFileSync('phase5_results.json', JSON.stringify({ passed, failed, results }, null, 2));
    process.stdout.write('\n=== PHASE 5: ' + passed + ' passed, ' + failed + ' failed ===\n');
    if (failed > 0) process.exit(1);
}

run().catch(e => {
    process.stdout.write('FATAL: ' + e.message + '\n');
    process.exit(1);
});
