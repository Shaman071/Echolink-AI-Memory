const mongoose = require('mongoose');
const { User, Link } = require('./src/models');
const { getLinks } = require('./src/controllers/link.controller');
require('dotenv').config();

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne();
    if (!user) {
        console.log('No user found');
        return;
    }

    console.log('Testing getLinks for user:', user._id);

    // Create a dummy link if none exists
    const linkCount = await Link.countDocuments({ user: user._id });
    if (linkCount === 0) {
        console.log('No links found, skipping verification or create one?');
        // We can't easily create one without fragments.
    }

    const links = await getLinks(user, { page: 1, limit: 5 });
    console.log('Links found:', links.results.length);
    console.log('Total results:', links.totalResults);
    if (links.results.length > 0) {
        console.log('First link type:', links.results[0].type);
    }

    await mongoose.disconnect();
}

main();
