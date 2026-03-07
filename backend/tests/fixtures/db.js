const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Source, Fragment } = require('../../src/models');

// Test user data
exports.userOne = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'TestPass123!',
  role: 'user'
};

exports.userTwo = {
  name: 'Another User',
  email: 'another@example.com',
  password: 'AnotherPass123!',
  role: 'user'
};

// Setup database with test data
exports.setupDatabase = async () => {
  // Clear all test data
  await User.deleteMany({});
  await Source.deleteMany({});
  await Fragment.deleteMany({});
  
  // Create test users with hashed passwords
  const hashedPasswordOne = await bcrypt.hash(exports.userOne.password, 10);
  const hashedPasswordTwo = await bcrypt.hash(exports.userTwo.password, 10);
  
  const userOneDoc = await User.create({
    ...exports.userOne,
    password: hashedPasswordOne,
    isEmailVerified: true
  });
  
  const userTwoDoc = await User.create({
    ...exports.userTwo,
    password: hashedPasswordTwo,
    isEmailVerified: true
  });
  
  // Store the created user IDs
  exports.userOne.id = userOneDoc._id;
  exports.userTwo.id = userTwoDoc._id;
  
  // Create some test sources
  const sourceOne = await Source.create({
    title: 'Test Source 1',
    type: 'text',
    user: userOneDoc._id,
    status: 'processed',
    metadata: {
      language: 'en',
      wordCount: 100
    }
  });
  
  const sourceTwo = await Source.create({
    title: 'Test Source 2',
    type: 'url',
    url: 'https://example.com/document',
    user: userOneDoc._id,
    status: 'processed',
    metadata: {
      domain: 'example.com',
      wordCount: 200
    }
  });
  
  // Create some test fragments
  await Fragment.create([
    {
      content: 'This is a test fragment about artificial intelligence.',
      source: sourceOne._id,
      user: userOneDoc._id,
      embedding: Array(1536).fill(0.1),
      metadata: {
        position: 1,
        wordCount: 10
      }
    },
    {
      content: 'Machine learning is a subset of AI that focuses on building systems that learn from data.',
      source: sourceTwo._id,
      user: userOneDoc._id,
      embedding: Array(1536).fill(0.2),
      metadata: {
        position: 2,
        wordCount: 15
      }
    },
    {
      content: 'Deep learning uses neural networks with many layers to model complex patterns in data.',
      source: sourceOne._id,
      user: userOneDoc._id,
      embedding: Array(1536).fill(0.3),
      metadata: {
        position: 3,
        wordCount: 12
      }
    },
    {
      content: 'This is another user\'s private fragment.',
      source: sourceTwo._id,
      user: userTwoDoc._id, // Belongs to userTwo
      embedding: Array(1536).fill(0.4),
      metadata: {
        position: 1,
        wordCount: 8
      }
    }
  ]);
  
  return {
    userOne: userOneDoc,
    userTwo: userTwoDoc,
    sources: [sourceOne, sourceTwo]
  };
};
