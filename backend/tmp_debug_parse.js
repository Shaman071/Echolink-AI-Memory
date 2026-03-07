const fs = require('fs');
const path = require('path');
const parser = require('./src/services/parser.service');

const sample = fs.readFileSync(path.join(__dirname, '..', 'sample_data', 'sample_whatsapp.txt'), 'utf-8');
const lines = sample.split('\n');
console.log('Total lines:', lines.length);
const patterns = [
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s*([^:]+):\s*(.+)$/i,
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*-\s*([^:]+):\s*(.+)$/i,
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*([^:]+):\s*(.+)$/i,
];

for (let i = 0; i < Math.min(lines.length, 20); i++) {
  const line = lines[i];
  console.log(`\nLine ${i+1}: '${line}'`);
  console.log('Chars:', Array.from(line).map(c => c.charCodeAt(0)).join(','));
  let matchedAny = false;
  for (let j = 0; j < patterns.length; j++) {
    const p = patterns[j];
    const m = line.match(p);
    console.log(` pattern ${j+1}: ${m ? 'MATCH' : 'no'}`);
    if (m) {
      console.log(' match groups:', m.slice(1));
      matchedAny = true;
    }
  }
}
