const mongoose = require('mongoose');
const { Source, Fragment, User } = require('./src/models');
const { processDocument } = require('./src/services/parser.service');
require('dotenv').config();

async function main() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Find sources that we marked as 'error' in the previous step (originally 'processing')
        // Or just find 'error' sources that have "Processing interrupted" message
        const sourcesToRetry = await Source.find({
            $or: [
                { status: 'error' },
                { status: 'processing' } // In case any were missed or new ones stuck
            ]
        });

        console.log(`Found ${sourcesToRetry.length} sources to retry`);

        for (const source of sourcesToRetry) {
            console.log(`Processing: ${source.title} (${source._id})...`);

            // Reset status to processing to pass checks
            source.status = 'processing';
            await source.save();

            try {
                await processDocument(source._id, source.user);
                console.log(`  -> Success!`);
            } catch (err) {
                console.error(`  -> Failed: ${err.message}`);
            }
        }

        console.log('Done reprocessing.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
