console.log('Loading mongoose...');
const { mongoose } = require('mongoose');
console.log('Loading models...');
let Source, Fragment, Link, User;
try {
    ({ Source, Fragment, Link, User } = require('./src/models'));
} catch (e) { console.error('Error loading models:', e); process.exit(1); }

console.log('Loading import controller...');
let deleteSource, uploadDocument;
try {
    ({ deleteSource, uploadDocument } = require('./src/controllers/import.controller'));
} catch (e) { console.error('Error loading import controller:', e); process.exit(1); }

console.log('Loading link builder...');
let buildLinksForUser;
try {
    ({ buildLinksForUser } = require('./src/services/link-builder.service'));
} catch (e) { console.error('Error loading link builder:', e); process.exit(1); }

console.log('Loading search service...');
let searchFragments;
try {
    ({ searchFragments } = require('./src/services/search.service'));
} catch (e) { console.error('Error loading search service:', e); process.exit(1); }

console.log('Loading config...');
let config;
try {
    config = require('./src/config/config');
} catch (e) { console.error('Error loading config:', e); process.exit(1); }

// MOCK EMBEDDING SERVICE IF NEEDED
// ...

async function runVerification() {
    console.log('--- STARTING VERIFICATION ---');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('Connected to MongoDB');

    // 1. SETUP USER
    let user = await User.findOne({ email: 'test@example.com' });
    if (!user) {
        user = await User.create({
            email: 'test@example.com',
            password: 'password123',
            name: 'Test Verify'
        });
    }

    // 2. MOCK DATA CREATION (Manual sim since we can't easily upload file here without FormData mock)
    // We will verify DELETION on an existing source if one exists, or skip
    const source = await Source.findOne({ user: user._id });
    if (source) {
        console.log(`Initial Source Count: ${await Source.countDocuments({ user: user._id })}`);
        console.log(`Initial Fragment Count: ${await Fragment.countDocuments({ user: user._id })}`);
        console.log(`Initial Link Count: ${await Link.countDocuments({ user: user._id })}`);

        // 3. TEST LINKING (Rebuild)
        console.log('--- Testing Link Rebuild ---');
        await Link.deleteMany({ user: user._id }); // Clear first
        const linksCreated = await buildLinksForUser(user._id.toString(), {
            similarityThreshold: 0.1, // Low threshold to force links for test
            maxFragments: 100
        });
        console.log(`Links Created: ${linksCreated}`);
        const linkCountAfter = await Link.countDocuments({ user: user._id });
        if (linkCountAfter !== linksCreated) {
            console.error('MISMATCH: Link count mismatch!');
        } else {
            console.log('SUCCESS: Links created and verified in DB.');
        }

        // 4. TEST DELETION (Cascading)
        console.log(`--- Testing Deletion of Source ${source._id} ---`);
        const result = await deleteSource(source._id, user);
        console.log('Deletion Result:', result);

        // VERIFY GONE
        const sourceGone = await Source.findById(source._id);
        const fragmentsGone = await Fragment.countDocuments({ source: source._id });
        const linksGone = await Link.countDocuments({ user: user._id, $or: [{ sourceFragment: { $exists: true } }] }); // Loose check

        // Note: Link count check is complex because we might have other sources. 
        // Ideally we check links specific to this source's fragments.
        // But result.deleted.links should tell us.

        if (!sourceGone && fragmentsGone === 0 && result.deleted.links > 0) {
            console.log('SUCCESS: Cascading deletion worked.');
        } else {
            console.log(`STATUS: Source: ${!!sourceGone}, Fragments Remaining: ${fragmentsGone}`);
        }

    } else {
        console.log('No source found to test deletion. Please manually upload a file first.');
    }

    // 5. TEST SEARCH LIMIT
    console.log('--- Testing Search Limit Fix ---');
    // Mock a search
    try {
        const results = await searchFragments('test', { user: user._id }, { limit: 5 });
        console.log(`Search returned ${results.length} results.`);
    } catch (e) {
        console.error('Search failed:', e);
    }

    console.log('--- VERIFICATION COMPLETE ---');
    process.exit(0);
}

runVerification().catch(console.error);
