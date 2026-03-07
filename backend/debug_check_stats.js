const mongoose = require('mongoose');
const { Source, Fragment, Link, User } = require('./src/models');
require('dotenv').config();

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const users = await User.find();
        console.log(`\nUsers Report:`);
        for (const user of users) {
            const sourceCount = await Source.countDocuments({ user: user._id });
            const fragmentCount = await Fragment.countDocuments({ user: user._id });
            const linkCount = await Link.countDocuments({ user: user._id });
            const processingCount = await Source.countDocuments({ user: user._id, status: 'processing' });
            const errorCount = await Source.countDocuments({ user: user._id, status: 'error' });

            console.log(`User: ${user.email} (${user._id})`);
            console.log(`  - Sources: ${sourceCount} (Processing: ${processingCount}, Error: ${errorCount})`);
            console.log(`  - Fragments: ${fragmentCount}`);
            console.log(`  - Links: ${linkCount}`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
