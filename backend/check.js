const mongoose = require('mongoose');
const { Source } = require('./src/models');
require('dotenv').config();

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const pending = await Source.countDocuments({ status: 'processing' });
        const error = await Source.countDocuments({ status: 'error' });
        const processed = await Source.countDocuments({ status: { $in: ['processed', 'indexed'] } });
        console.log(`Pending: ${pending}, Error: ${error}, Processed: ${processed}`);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}
main();
