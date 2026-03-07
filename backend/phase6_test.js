/**
 * Phase 6 — Dashboard Stats Test
 * Tests admin dashboard stats endpoint, isolation per user, and response shape.
 * Run: node phase6_test.js
 * Backend must be running on port 3001
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3001';
const T1_EMAIL = `p6_a_${Date.now()}@test.com`;
const T2_EMAIL = `p6_b_${Date.now() + 1}@test.com`;
const T_PASS = 'TestPass123!';
let TOKEN1 = null;
let TOKEN2 = null;
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

const WA_SAMPLE = `12/01/2025, 9:00 AM - Alice: MERN stack chosen for EchoLink.
12/01/2025, 9:01 AM - Bob: React for the frontend.
12/01/2025, 9:02 AM - Alice: MongoDB for flexible storage.
`;
const WA_FILE = path.join(__dirname, 'tmp_p6.txt');
fs.writeFileSync(WA_FILE, WA_SAMPLE, 'utf8');

async function run() {
    await test('Register user 1', async () => {
        const r = await jsonRequest('POST', '/api/auth/register', { name: 'P6 UserA', email: T1_EMAIL, password: T_PASS });
        if (r.status === 201 && r.body.tokens?.access?.token) { TOKEN1 = r.body.tokens.access.token; return { pass: true }; }
        return { pass: false, detail: { status: r.status } };
    });

    await test('Register user 2', async () => {
        const r = await jsonRequest('POST', '/api/auth/register', { name: 'P6 UserB', email: T2_EMAIL, password: T_PASS });
        if (r.status === 201 && r.body.tokens?.access?.token) { TOKEN2 = r.body.tokens.access.token; return { pass: true }; }
        return { pass: false, detail: { status: r.status } };
    });

    // Upload content for user1 only
    await test('Upload content for user 1', async () => {
        if (!TOKEN1) return { pass: false, detail: 'No token1' };
        const r = await multipartUpload(WA_FILE, 'file', TOKEN1, '/api/import/whatsapp');
        return { pass: r.status === 200 && r.body.ok, detail: { inserted: r.body?.inserted } };
    });

    await new Promise(r => setTimeout(r, 1000));

    // Test admin/status shape
    await test('GET /api/admin/status has correct shape', async () => {
        if (!TOKEN1) return { pass: false, detail: 'No token1' };
        const r = await jsonRequest('GET', '/api/admin/status', null, { Authorization: `Bearer ${TOKEN1}` });
        const validShape = r.status === 200 &&
            typeof r.body.totalFragments === 'number' &&
            typeof r.body.totalSources === 'number' &&
            typeof r.body.totalLinks === 'number' &&
            typeof r.body.totalQueries === 'number' &&
            Array.isArray(r.body.recentActivity) &&
            r.body.status === 'healthy';
        return { pass: validShape, detail: { status: r.status, shape: Object.keys(r.body || {}) } };
    });

    // After uploading for user1, user1 should have > 0 sources
    await test('User 1 stats show sources count > 0', async () => {
        if (!TOKEN1) return { pass: false, detail: 'No token1' };
        const r = await jsonRequest('GET', '/api/admin/status', null, { Authorization: `Bearer ${TOKEN1}` });
        const hasData = r.status === 200 && r.body.totalSources > 0;
        return { pass: hasData, detail: { totalSources: r.body?.totalSources, totalFragments: r.body?.totalFragments } };
    });

    // User2 had no uploads, so their counts should be 0 (per-user isolation)
    await test('User 2 stats isolated (0 sources, 0 fragments)', async () => {
        if (!TOKEN2) return { pass: false, detail: 'No token2' };
        const r = await jsonRequest('GET', '/api/admin/status', null, { Authorization: `Bearer ${TOKEN2}` });
        const isolated = r.status === 200 && r.body.totalSources === 0 && r.body.totalFragments === 0;
        return { pass: isolated, detail: { totalSources: r.body?.totalSources, totalFragments: r.body?.totalFragments } };
    });

    // Auth guard
    await test('GET /api/admin/status without auth returns 401', async () => {
        const r = await jsonRequest('GET', '/api/admin/status');
        return { pass: r.status === 401, detail: { status: r.status } };
    });

    // recentActivity items have required fields
    await test('recentActivity items have type, description, timestamp fields', async () => {
        if (!TOKEN1) return { pass: false, detail: 'No token1' };
        const r = await jsonRequest('GET', '/api/admin/status', null, { Authorization: `Bearer ${TOKEN1}` });
        if (r.status !== 200 || !Array.isArray(r.body.recentActivity)) return { pass: false };
        const valid = r.body.recentActivity.length === 0 ||
            r.body.recentActivity.every(a => a.type && a.description && a.timestamp);
        return { pass: valid, detail: { count: r.body.recentActivity.length } };
    });

    // Cleanup
    try { fs.unlinkSync(WA_FILE); } catch (e) { }

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    fs.writeFileSync('phase6_results.json', JSON.stringify({ passed, failed, results }, null, 2));
    process.stdout.write('\n=== PHASE 6: ' + passed + ' passed, ' + failed + ' failed ===\n');
    if (failed > 0) process.exit(1);
}

run().catch(e => {
    process.stdout.write('FATAL: ' + e.message + '\n');
    process.exit(1);
});
