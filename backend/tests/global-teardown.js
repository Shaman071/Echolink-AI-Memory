module.exports = async () => {
  const mongoose = require('mongoose');
  try {
    await mongoose.disconnect();
  } catch (e) {
    // ignore
  }
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
};
