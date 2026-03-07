const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:3001/api';
// We need a valid token to test since the route is protected
// For testing purposes, we might need to bypass auth or use a test user
// But let's first check if the endpoint is reachable (401 is better than 404)

async function testStatus() {
    try {
        console.log(`Checking status endpoint: ${API_URL}/status`);
        const response = await axios.get(`${API_URL}/status`);
        console.log('Status Response:', response.data);
    } catch (error) {
        if (error.response) {
            console.log(`Status returned ${error.response.status}: ${error.response.statusText}`);
            if (error.response.status === 401) {
                console.log('Endpoint exists but requires authentication (expected).');
            }
        } else {
            console.error('Status Error:', error.message);
        }
    }
}

async function testSystemStatus() {
    try {
        console.log(`Checking system status: ${API_URL}/system/status`);
        const response = await axios.get(`${API_URL}/system/status`);
        console.log('System Status Response:', response.data);
    } catch (error) {
        console.error('System Status Error:', error.message);
    }
}

async function runTests() {
    await testSystemStatus();
    console.log('---');
    await testStatus();
}

runTests();
