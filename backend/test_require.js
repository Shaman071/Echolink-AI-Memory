const service = require('./src/services/embedding.service');
console.log('Keys:', Object.keys(service));
console.log('removeDocumentsFromService type:', typeof service.removeDocumentsFromService);
if (typeof service.removeDocumentsFromService !== 'function') {
    console.error('FAIL: removeDocumentsFromService is not a function');
    process.exit(1);
} else {
    console.log('PASS: Export looks correct');
}
