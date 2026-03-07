const axios = require('axios');
const { User } = require('./src/models');
const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne();
    if (!user) {
        console.log('No user found');
        return;
    }

    // Login to get token
    // Actually we can just query database directly or mock the request if we want to test the controller logic
    // But let's just use the controller logic directly to see what it returns

    const { getSources } = require('./src/controllers/import.controller');
    const sources = await getSources(user, { page: 1, limit: 1 });
    const fs = require('fs');
    fs.writeFileSync('debug_sources.json', JSON.stringify(sources, null, 2));
    console.log('Wrote to debug_sources.json');

    await mongoose.disconnect();
}

main();
