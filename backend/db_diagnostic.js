const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Fragment, Source, Link, User } = require('./src/models');

async function diagnostic() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/echolink');
        console.log('Connected to MongoDB');

        const users = await User.find({});
        console.log(`Total users: ${users.length}`);

        for (const user of users) {
            const fragmentCount = await Fragment.countDocuments({ user: user._id });
            const sourceCount = await Source.countDocuments({ user: user._id });
            const linkCount = await Link.countDocuments({ user: user._id });

            if (fragmentCount > 0 || sourceCount > 0 || linkCount > 0) {
                console.log(`User: ${user.email} (${user._id})`);
                console.log(`  Fragments: ${fragmentCount}`);
                console.log(`  Sources: ${sourceCount}`);
                console.log(`  Links: ${linkCount}`);
            }
        }

        const allFragments = await Fragment.countDocuments({});
        const allSources = await Source.countDocuments({});
        const allLinks = await Link.countDocuments({});

        console.log(`\nTotal Fragments in DB: ${allFragments}`);
        console.log(`Total Sources in DB: ${allSources}`);
        console.log(`Total Links in DB: ${allLinks}`);

        // Check for orphan data
        const orphanFragments = await Fragment.countDocuments({ user: { $exists: false } });
        console.log(`Orphan fragments (no user): ${orphanFragments}`);

        await mongoose.disconnect();
    } catch (err) {
        console.error('Diagnostic failed:', err);
    }
}

diagnostic();
