const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-1234567890';
  process.env.JWT_ACCESS_EXPIRATION_MINUTES = '15';
  process.env.JWT_REFRESH_EXPIRATION_DAYS = '7';
  process.env.JWT_RESET_PASSWORD_EXPIRATION_MINUTES = '10';
  process.env.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES = '10';

  // Create and setup MongoDB memory server (no mongoose.connect here - that must run in test worker)
  const mongod = await MongoMemoryServer.create({ instance: { dbName: 'echolink-test' } });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;

  // Store mongod instance for teardown
  global.__MONGOD__ = mongod;
};
