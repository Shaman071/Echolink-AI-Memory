const winston = require('winston');
try {
    console.log('winston version:', require('winston/package.json').version);
} catch (e) {
    console.log('winston version check failed');
}
console.log('winston.format.splat type:', typeof winston.format.splat);
try {
    const { splat } = winston.format;
    console.log('splat variable type:', typeof splat);
    if (typeof splat === 'function') {
        splat();
        console.log('splat() called successfully');
    }
} catch (error) {
    console.error('Error calling splat:', error.message);
}
