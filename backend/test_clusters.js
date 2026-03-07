const axios = require('axios');
const userId = '690ecb6786df9477b618c0cb';
const API_URL = 'http://localhost:3001/api/links';

async function testClusters() {
    try {
        console.log(`Fetching clusters for user: ${userId}`);
        const response = await axios.get(`${API_URL}/clusters`, {
            params: { userId },
            timeout: 30000
        });

        console.log('SUCCESS: Clusters fetched');
        console.log(`Found ${response.data.length} clusters`);
        if (response.data.length > 0) {
            console.log('Sample Cluster:', JSON.stringify(response.data[0], null, 2));
        }
    } catch (error) {
        console.error('FAILED: Cluster fetch failed');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

testClusters();
