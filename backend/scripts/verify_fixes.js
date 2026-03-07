const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'http://localhost:3001/api'; // Assuming backend port 3001
let authToken = '';
let userId = '';
let sourceId = '';
let fragmentIds = [];

// Helper to log steps
const step = (msg) => console.log(`\n[STEP] ${msg}`);
const success = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { console.error(`  ❌ ${msg}`); process.exit(1); };

async function runVerification() {
    try {
        // 1. Register/Login
        step('Authenticating...');
        const email = `test_${Date.now()}@example.com`;
        const password = 'password123';

        try {
            await axios.post(`${API_URL}/auth/register`, {
                name: 'Test User',
                email,
                password
            });
            success(`Registered user ${email}`);
        } catch (e) {
            fail(`Registration failed: ${e.message}`);
        }

        const loginRes = await axios.post(`${API_URL}/auth/login`, { email, password });
        authToken = loginRes.data.tokens.access.token;
        userId = loginRes.data.user.id;
        success('Logged in successfully');

        const authHeaders = { headers: { Authorization: `Bearer ${authToken}` } };

        // 2. Upload File
        step('Uploading test file...');
        const testContent = "This is a unique test file for verification. It contains specific keywords like QUANTUM phasing and NEURAL bridging.";
        const filePath = path.join(__dirname, 'test_upload.txt');
        fs.writeFileSync(filePath, testContent);

        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        const uploadRes = await axios.post(`${API_URL}/import/upload`, form, {
            headers: { ...authHeaders.headers, ...form.getHeaders() }
        });
        sourceId = uploadRes.data.id || uploadRes.data._id; // Adjust based on actual response
        success(`Uploaded file (Source ID: ${sourceId})`);

        // Wait for processing
        step('Waiting for processing...');
        await new Promise(r => setTimeout(r, 2000));

        // 3. Rebuild Links
        step('Triggering Link Rebuild...');
        const rebuildRes = await axios.post(`${API_URL}/links/rebuild`, {}, authHeaders);
        success(`Rebuild triggered: ${rebuildRes.data.message} (Links created: ${rebuildRes.data.linksCreated})`);

        // 4. Verify Fragments & Search
        step('Verifying Search...');
        // Give a moment for indexing if async
        await new Promise(r => setTimeout(r, 1000));

        const searchRes = await axios.post(`${API_URL}/query`, { k: 30, q: "QUANTUM phasing" }, authHeaders); // Using k=30 as updated
        const found = searchRes.data.evidence.some(e => e.text.includes("QUANTUM"));

        if (found) {
            success('Search found the uploaded content');
            fragmentIds = searchRes.data.evidence.map(e => e.id);
        } else {
            console.log('Search response:', JSON.stringify(searchRes.data, null, 2));
            fail('Search failed to find content');
        }

        // 5. Verify Graph
        step('Verifying Graph...');
        const graphRes = await axios.get(`${API_URL}/graph`, authHeaders);
        const nodes = graphRes.data.nodes;
        const hasNodes = nodes.length > 0;
        if (hasNodes) {
            success(`Graph returned ${nodes.length} nodes`);
        } else {
            fail('Graph returned 0 nodes');
        }

        // 6. Delete Source
        step('Deleting Source...');
        const deleteRes = await axios.delete(`${API_URL}/import/sources/${sourceId}`, authHeaders);
        if (deleteRes.data.success) {
            success('Source deleted successfully');
        } else {
            fail('Delete returned false/failure');
        }

        // 7. Verify Deletion
        step('Verifying Deletion (Search & Graph)...');

        // Check Search
        const searchAfterRes = await axios.post(`${API_URL}/query`, { k: 30, q: "QUANTUM phasing" }, authHeaders);
        const foundAfter = searchAfterRes.data.evidence.some(e => e.text.includes("QUANTUM"));

        if (!foundAfter) {
            success('Search correctly returns NO results for deleted content');
        } else {
            fail('Search STILL finds deleted content (Zombie Data!)');
        }

        // Check Graph
        const graphAfterRes = await axios.get(`${API_URL}/graph`, authHeaders);
        const nodesAfter = graphAfterRes.data.nodes;
        const deletedNodeStillExists = nodesAfter.some(n => fragmentIds.includes(n.id));

        if (!deletedNodeStillExists) {
            success('Graph correctly removed deleted nodes');
        } else {
            fail('Graph STILL contains deleted nodes');
        }

        console.log('\n✨ ALL VERIFICATION CHECKS PASSED ✨');

        // Cleanup
        fs.unlinkSync(filePath);

    } catch (err) {
        console.error('\n❌ UNEXPECTED ERROR:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}

runVerification();
