const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const API_URL = 'http://localhost:3001/api';

async function testRebuild() {
    try {
        // 1. Get credentials from .env or use a known test user if possible
        // For this test, we might need a real token.
        // Let's try to get the status first
        console.log('Testing /api/status (should now return fragment counts)...');
        // Note: This requires auth. In a real scenario I'd login first.
        // But I can check the logs of the running server if I can't easily auth here.

        console.log('Renamed endpoint check: /api/system/status');
        const systemStatus = await axios.get(`${API_URL}/system/status`);
        console.log('System Status OK:', systemStatus.data.ok);

    } catch (err) {
        console.error('Test failed:', err.message);
        if (err.response) console.error('Response:', err.response.data);
    }
}

testRebuild();
