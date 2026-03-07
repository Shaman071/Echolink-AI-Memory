const axios = require('axios');

async function test() {
  try {
    const url = 'http://127.0.0.1:5000/embed';
    console.log('Posting to', url);
    const resp = await axios.post(url, { text: 'hello from node test' }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
    console.log('Status:', resp.status);
    console.log('Data keys:', Object.keys(resp.data));
    if (resp.data.embedding) console.log('Embedding length:', resp.data.embedding.length);
  } catch (err) {
    console.error('Error message:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
    if (err.request) {
      console.error('No response received. Request details:', err.request._header ? err.request._header : '[raw request]');
    }
    console.error(err.stack);
  }
}

test();
