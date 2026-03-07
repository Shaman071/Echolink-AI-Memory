const mongoose = require('mongoose');
const { User, RefreshToken } = require('../src/models');

// Set longer timeout for slower test environments
jest.setTimeout(120000);

// Connect mongoose for this test worker
let mongooseConnected = false;
let serverStarted = false;

// Handle mongoose connection
async function connectMongoose() {
  if (mongooseConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set by globalSetup');

  // Connect with retries
  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
      });

      // Wait for mongoose connection to be ready
      await new Promise((resolve, reject) => {
        mongoose.connection.once('connected', resolve);
        mongoose.connection.on('error', reject);
        if (mongoose.connection.readyState === 1) resolve();
      });

      mongooseConnected = true;
      break;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}// Handle server startup
async function startServer() {
  if (serverStarted) return;

  try {
    // Ensure mongoose is connected before starting server
    await connectMongoose();

    const serverModule = require('../server');
    const httpServer = serverModule.httpServer;
    if (!httpServer) {
      throw new Error('httpServer not exported from server.js');
    }
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;
    global.__TEST_SERVER_URL = `http://127.0.0.1:${port}`;
    global.__TEST_HTTP_SERVER = httpServer;
    serverStarted = true;
  } catch (e) {
    console.error('Failed to start test HTTP server in setup:', e);
    throw e;
  }
}

// Run setup before all tests
beforeAll(async () => {
  await startServer();
});

// We'll handle collection cleanup in individual test suites

// Ensure all models are properly defined
const models = { User, RefreshToken };
Object.values(models).forEach((model) => {
  if (!model) throw new Error(`Model not properly initialized: ${model}`);
});

// Disconnect mongoose and stop http server when worker finishes
afterAll(async () => {
  try {
    if (global.__TEST_HTTP_SERVER) {
      await new Promise((resolve) => global.__TEST_HTTP_SERVER.close(resolve));
    }
  } catch (e) {
    // ignore
  }
  try {
    await mongoose.disconnect();
  } catch (e) {
    // ignore
  }
});

// Helper functions for integration tests
async function connectDatabase() {
  await connectMongoose();
}

async function clearDatabase() {
  if (!mongoose.connection.db) return;
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

async function closeDatabase() {
  await mongoose.disconnect();
}

module.exports = {
  connectDatabase,
  clearDatabase,
  closeDatabase,
  connectMongoose,
  startServer,
};
