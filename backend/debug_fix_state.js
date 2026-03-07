const mongoose = require('mongoose');
const { Source, Fragment, User } = require('./src/models');
require('dotenv').config();

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Check stuck sources
        const stuckSources = await Source.find({ status: 'processing' });
        console.log(`Found ${stuckSources.length} sources stuck in 'processing'`);

        for (const source of stuckSources) {
            console.log(`- Stuck: ${source.title} (${source._id}) - Created: ${source.createdAt}`);
            // FIX: Reset to error so they can be seen/deleted/retried
            source.status = 'error';
            source.error = { message: 'Processing interrupted (server restart or crash)' };
            await source.save();
            console.log(`  -> Reset to 'error'`);
        }

        // 2. Check Admin Stats consistency
        const users = await User.find();
        console.log(`\nFound ${users.length} users`);

        for (const user of users) {
            console.log(`User: ${user.email} (${user._id})`);
            const distinctFragmentUsers = await Fragment.distinct('user');
            console.log(`Distinct Users in Fragments: ${distinctFragmentUsers}`);

            const fragCount = await Fragment.countDocuments({ user: user._id });
            const sourceCount = await Source.countDocuments({ user: user._id });
            console.log(`  - Fragments: ${fragCount}`);
            console.log(`  - Sources: ${sourceCount}`);
        }

        // 3. Check for unlinked fragments (valid fragments but no links)
        const totalFragments = await Fragment.countDocuments();
        const processedFragments = await Fragment.countDocuments({ status: { $in: ['processed', 'indexed'] } });
        console.log(`\nTotal Fragments: ${totalFragments}`);
        console.log(`Processed/Indexed Fragments: ${processedFragments}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
