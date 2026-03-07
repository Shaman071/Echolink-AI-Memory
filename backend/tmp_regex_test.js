const s = "12/01/2025, 8:32 PM - You: Let's use React for frontend";
const p = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*-\s*([^:]+):\s*(.+)$/i;
console.log('test:', p.test(s));
console.log('match:', s.match(p));
