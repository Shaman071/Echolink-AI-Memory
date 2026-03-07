const fs = require('fs');
const path = require('path');
const parser = require('./src/services/parser.service');

const sample = fs.readFileSync(path.join(__dirname, '..', 'sample_data', 'sample_whatsapp.txt'), 'utf-8');
console.log('Sample length:', sample.length);
const msgs = parser.parseWhatsAppChat(sample);
console.log('Parsed messages count:', msgs.length);
console.log(msgs);
