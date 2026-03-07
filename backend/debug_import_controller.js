try {
    console.log('Requiring import.controller...');
    const controller = require('./src/controllers/import.controller');
    console.log('Loaded successfully.');
    console.log('Exports:', Object.keys(controller));
    if (typeof controller.deleteSource === 'function') {
        console.log('deleteSource is a function');
    } else {
        console.error('deleteSource is missing or not a function');
    }
} catch (err) {
    console.error('Failed to require import.controller:', err);
}
