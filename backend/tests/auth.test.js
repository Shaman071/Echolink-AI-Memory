const request = require('supertest');
const mongoose = require('mongoose');
const { User, RefreshToken } = require('../src/models');

let agent;

beforeAll(() => {
  if (!global.__TEST_SERVER_URL) throw new Error('Test server not started');
  agent = request.agent(global.__TEST_SERVER_URL);
});

afterAll(() => {
  // Server and DB teardown handled by tests/setup.js
});

describe('Auth flows', () => {
  // `agent` is initialized in beforeAll once the server is listening
  const testUser = { name: 'Jest User', email: 'jest@example.com', password: 'JestPass123!' };
  let userId;
  let currentUser;

  // Clear users before all tests and verify db connection
  beforeAll(async () => {
    console.log('Setting up test database...');
    console.log('Mongoose connection state:', mongoose.connection.readyState);
    console.log('Mongoose models registered:', Object.keys(mongoose.models));

    await User.deleteMany({});
    await RefreshToken.deleteMany({});
    await new Promise(resolve => setTimeout(resolve, 1000)); // Ensure DB operations complete

    // Create test user that will be used by all tests
    currentUser = await User.create(testUser);
    userId = currentUser._id;

    console.log('Test user created:', {
      id: userId.toString(),
      email: currentUser.email,
      passwordLength: currentUser.password?.length
    });
  });

  // Clean up after each test
  afterEach(async () => {
    console.log('Checking test user after test...');
    const user = await User.findById(userId);
    if (user) {
      console.log('Test user exists:', {
        email: user.email,
        passwordLength: user.password?.length,
        hasPasswordMethod: !!user.isPasswordMatch,
      });
    } else {
      console.log('Test user not found!');
    }
  });

  // Clean up after all tests
  afterAll(async () => {
    console.log('Final cleanup...');
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
    await new Promise(resolve => setTimeout(resolve, 1000)); // Ensure DB operations complete
  });

  describe('registration and login', () => {
    test('existing user returns tokens on register', async () => {
      jest.setTimeout(30000);
      const res = await agent
        .post('/api/auth/register')
        .send(testUser);

      expect(res.statusCode).toBe(200); // Expect 200 for existing user
      expect(res.body.user).toBeDefined();
      expect(res.body.tokens).toBeDefined();
      expect(res.body.tokens.access).toBeDefined();
      expect(res.body.user.id).toBe(userId.toString());

      // Verify tokens are stored
      await new Promise(resolve => setTimeout(resolve, 1000));
      const tokens = await RefreshToken.find({ user: userId });
      expect(tokens.length).toBeGreaterThanOrEqual(1);
    });

    test('login returns access token and sets refresh cookie', async () => {
      jest.setTimeout(30000);
      const res = await agent
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(res.statusCode).toBe(200);
      expect(res.body.tokens.access).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'].some(c => c.startsWith('refreshToken='))).toBeTruthy();
    });
  });

  describe('token refresh', () => {
    test('refresh rotates token and returns new access token', async () => {
      jest.setTimeout(30000);

      // First login to get a fresh token
      const loginRes = await agent
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.headers['set-cookie']).toBeDefined();

      // Call refresh-tokens endpoint (agent will handle the cookie)
      const res = await agent
        .post('/api/auth/refresh-tokens')
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body.tokens.access).toBeDefined();

      // Wait for token rotation to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify token in DB
      const refreshDocs = await RefreshToken.find({
        user: userId,
        revokedAt: { $exists: false }
      }).sort({ createdAt: -1 });

      expect(refreshDocs.length).toBeGreaterThanOrEqual(1);
    });
  }); describe('password reset', () => {
    test('request password reset returns token (demo behaviour) and reset works', async () => {
      jest.setTimeout(30000);

      // Request password reset
      const resetReq = await agent
        .post('/api/auth/request-password-reset')
        .send({ email: testUser.email });
      expect(resetReq.statusCode).toBe(200);
      expect(resetReq.body.token).toBeDefined();
      const resetToken = resetReq.body.token;

      // Reset password
      const reset = await agent
        .post('/api/auth/reset-password')
        .send({ token: resetToken, newPassword: 'NewJestPass123!' });
      expect(reset.statusCode).toBe(200);

      // Verify new password works with login
      const login = await agent
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'NewJestPass123!' });
      expect(login.statusCode).toBe(200);
      expect(login.body.tokens.access).toBeDefined();

      testUser.password = 'NewJestPass123!'; // Update test user password for subsequent tests
    });
  });

  describe('email verification', () => {
    test('email verification demo flow', async () => {
      jest.setTimeout(30000);

      // First ensure user exists and is not verified
      await User.findByIdAndUpdate(userId, { isEmailVerified: false });

      // Request verification
      const verifyReq = await agent
        .post('/api/auth/request-email-verification')
        .send({ email: testUser.email });
      expect(verifyReq.statusCode).toBe(200);
      expect(verifyReq.body.token).toBeDefined();
      const verifyToken = verifyReq.body.token;

      // Verify email
      const verify = await agent
        .post('/api/auth/verify-email')
        .send({ token: verifyToken });
      expect(verify.statusCode).toBe(200);

      // Check user is now verified
      const verifiedUser = await User.findById(userId);
      expect(verifiedUser.isEmailVerified).toBeTruthy();
    });
  });

  describe('logout', () => {
    test('logout revokes refresh token and clears cookie', async () => {
      jest.setTimeout(30000);

      // First login to get a fresh token
      const loginRes = await agent
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.headers['set-cookie']).toBeDefined();
      const cookie = loginRes.headers['set-cookie'];

      // Get the refresh token from the cookie for verification
      const refreshToken = cookie
        .find(c => c.startsWith('refreshToken='))
        ?.split(';')[0]
        .split('=')[1];
      expect(refreshToken).toBeDefined();

      // Wait for token to be saved
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the token document before logout
      const tokenBefore = await RefreshToken.findOne({
        user: userId,
        revokedAt: { $exists: false }
      }).sort({ createdAt: -1 });

      expect(tokenBefore).toBeDefined();
      expect(tokenBefore.isActive).toBeTruthy();

      // Get the access token from login response
      const accessToken = loginRes.body.tokens.access.token;

      // Logout with access token and refresh token
      const res = await agent
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });
      expect(res.statusCode).toBe(200);

      // Verify cookie is cleared (set to expire)
      console.log('Logout headers:', res.headers);
      const logoutCookie = res.headers['set-cookie'];
      expect(logoutCookie).toBeDefined();
      expect(logoutCookie.some(c => c.startsWith('refreshToken=') && c.includes('Expires'))).toBeTruthy();

      // Verify token is revoked in DB
      const tokenAfter = await RefreshToken.findById(tokenBefore._id);
      expect(tokenAfter.revokedAt).toBeDefined();
      expect(tokenAfter.isActive).toBeFalsy();

      // Verify refresh token no longer works
      const refreshRes = await agent
        .post('/api/auth/refresh-tokens')
        .send({ refreshToken }); // Send the revoked token
      expect(refreshRes.statusCode).toBe(401);
    });
  });
});
