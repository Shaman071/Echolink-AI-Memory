const axios = require('axios');

async function verifySystem() {
    console.log('Starting System Verification...');
    const embedUrl = 'http://localhost:5000';

    // 1. Verify /delete endpoint exists
    try {
        console.log('Testing /delete endpoint existence...');
        // Sending empty ID list to see if we get proper 400 or 404
        await axios.post(`${embedUrl}/delete`, { ids: [] }, {
            validateStatus: (status) => status === 400 || status === 200
        });
        console.log('✅ /delete endpoint is reachable');
    } catch (e) {
        if (e.response && e.response.status === 404) {
            console.error('❌ /delete endpoint NOT found (404)');
        } else {
            console.error(`❌ Connection failed: ${e.message}`);
        }
    }

    // 2. Verify Search Logic (via backend if possible, or direct to embed service)
    // We'll emulate what the backend does: /query
    try {
        console.log('Testing /query endpoint...');
        const res = await axios.post(`${embedUrl}/query`, {
            q: "test",
            k: 1
        });
        if (res.status === 200 && Array.isArray(res.data.results)) {
            console.log('✅ /query endpoint works');
        } else {
            console.error('❌ /query returned unexpected format');
        }
    } catch (e) {
        console.error(`❌ Query failed: ${e.message}`);
    }

    console.log('Verification Complete.');
}

verifySystem();
