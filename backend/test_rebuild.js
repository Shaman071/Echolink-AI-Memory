const axios = require('axios');
const userId = '690ecb6786df9477b618c0cb';
const API_URL = 'http://localhost:3001/api/links';

async function testRebuild() {
    try {
        console.log(`Triggering rebuild for user: ${userId}...`);
        const response = await axios.post(`${API_URL}/rebuild`, { userId }, { timeout: 60000 });
        console.log('Rebuild Success:', response.data);
    } catch (error) {
        if (error.response) {
            console.error('Rebuild Error Response:', error.response.status, error.response.data);
        } else {
            console.error('Rebuild Error:', error.message);
        }
    }
}

async function testClusters() {
    try {
        console.log(`Fetching clusters for user: ${userId}...`);
        const response = await axios.get(`${API_URL}/clusters`, { params: { userId }, timeout: 60000 });
        console.log(`Found ${response.data.length} clusters.`);
        if (response.data.length > 0) {
            console.log('Sample Cluster Label:', response.data[0].label);
        }
    } catch (error) {
        if (error.response) {
            console.error('Clusters Error Response:', error.response.status, error.response.data);
        } else {
            console.error('Clusters Error:', error.message);
        }
    }
}

async function run() {
    await testRebuild();
    console.log('---');
    await testClusters();
}

run();
