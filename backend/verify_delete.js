const mongoose = require('mongoose');
const { User, Source, Fragment, Link } = require('./src/models');
const { deleteSource } = require('./src/controllers/import.controller');
require('dotenv').config();

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne();
    if (!user) {
        console.log('No user found');
        return;
    }

    // Create a dummy source to delete
    const source = await Source.create({
        user: user._id,
        title: 'Delete Test',
        type: 'text',
        status: 'processed'
    });

    console.log(`Created test source: ${source._id}`);

    // Create a dummy fragment
    const fragment = await Fragment.create({
        user: user._id,
        source: source._id,
        content: 'Test content',
        status: 'indexed'
    });
    console.log(`Created test fragment: ${fragment._id}`);

    // Create a dummy link
    await Link.create({
        user: user._id,
        sourceFragment: fragment._id,
        targetFragment: fragment._id, // Self link for test
        type: 'related',
        strength: 0.5
    });
    console.log('Created test link');

    // Attempt deletion
    console.log('Deleting source...');
    try {
        const result = await deleteSource(source._id, user);
        console.log('Deletion result:', result);
    } catch (err) {
        console.error('Deletion failed:', err);
    }

    // Verify cleanup
    const sCount = await Source.countDocuments({ _id: source._id });
    const fCount = await Fragment.countDocuments({ source: source._id });
    const lCount = await Link.countDocuments({ sourceFragment: fragment._id });

    console.log(`Remaining Sources: ${sCount}`);
    console.log(`Remaining Fragments: ${fCount}`);
    console.log(`Remaining Links: ${lCount}`);

    if (sCount === 0 && fCount === 0 && lCount === 0) {
        console.log('SUCCESS: All data cleaned up.');
    } else {
        console.log('FAILURE: Some data remains.');
    }

    await mongoose.disconnect();
}

main();
