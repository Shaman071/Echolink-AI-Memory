const http = require('http');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const TEST_EMAIL = `p1_${Date.now()}@test.com`;
const TEST_PASS = 'TestPass123!';
let accessToken = null;
const results = [];

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
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
        if (body) req.write(JSON.stringify(body));
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

async function run() {
    await test('GET /api/status', async () => {
        const r = await request('GET', '/api/status');
        return { pass: r.status === 200 && r.body.ok, detail: r.body };
    });

    await test('GET /health', async () => {
        const r = await request('GET', '/health');
        return { pass: r.status === 200 && r.body.status === 'ok', detail: r.body };
    });

    await test('POST /api/auth/register', async () => {
        const r = await request('POST', '/api/auth/register', {
            name: 'Phase1 Tester',
            email: TEST_EMAIL,
            password: TEST_PASS,
        });
        if (r.status === 201 && r.body.tokens?.access?.token) {
            accessToken = r.body.tokens.access.token;
            return { pass: true, detail: { email: TEST_EMAIL } };
        }
        return { pass: false, detail: { status: r.status, body: r.body } };
    });

    await test('POST /api/auth/login', async () => {
        const r = await request('POST', '/api/auth/login', {
            email: TEST_EMAIL,
            password: TEST_PASS,
        });
        if (r.status === 200 && r.body.tokens?.access?.token) {
            accessToken = r.body.tokens.access.token;
            return { pass: true, detail: 'ok' };
        }
        return { pass: false, detail: { status: r.status, body: r.body } };
    });

    await test('GET /api/auth/me (with token)', async () => {
        if (!accessToken) return { pass: false, detail: 'No token' };
        const r = await request('GET', '/api/auth/me', null, {
            Authorization: 'Bearer ' + accessToken,
        });
        return { pass: r.status === 200, detail: { status: r.status, body: r.body } };
    });

    await test('GET /api/auth/me (no token) => 401', async () => {
        const r = await request('GET', '/api/auth/me');
        return { pass: r.status === 401, detail: { status: r.status, body: r.body } };
    });

    await test('POST /api/auth/login wrong password => 40x', async () => {
        const r = await request('POST', '/api/auth/login', { email: TEST_EMAIL, password: 'wrongpwd' });
        return { pass: r.status >= 400, detail: { status: r.status } };
    });

    await test('POST /api/auth/register missing fields => 400', async () => {
        const r = await request('POST', '/api/auth/register', { email: 'x@x.com' });
        return { pass: r.status === 400, detail: { status: r.status, body: r.body } };
    });

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    fs.writeFileSync('phase1_results.json', JSON.stringify({ passed, failed, results }, null, 2));
    process.stdout.write('\n=== PHASE 1: ' + passed + ' passed, ' + failed + ' failed ===\n');
    if (failed > 0) process.exit(1);
}

run().catch(e => {
    process.stdout.write('FATAL: ' + e.message + '\n');
    process.exit(1);
});
