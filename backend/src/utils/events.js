const EventEmitter = require('events');

// Single global emitter for server-side events
const emitter = new EventEmitter();

// Increase the default max listeners to avoid warnings in dev with many clients
emitter.setMaxListeners(1000);

module.exports = emitter;
