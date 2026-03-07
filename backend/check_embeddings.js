const mongoose = require('mongoose');
require('dotenv').config();

const FragmentSchema = new mongoose.Schema({
    content: String,
    embedding: { type: [Number], select: true },
    user: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const Fragment = mongoose.model('Fragment', FragmentSchema);

async function checkEmbeddings() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const fragments = await Fragment.find({ embedding: { $exists: true } }).limit(20).lean();

        if (fragments.length === 0) {
            console.log('No fragments with embeddings found.');
            return;
        }

        console.log(`Found ${fragments.length} fragments with embeddings.\n`);

        fragments.forEach((f, i) => {
            const emb = f.embedding;
            const length = emb ? emb.length : 'N/A';
            const type = Array.isArray(emb) ? 'Array' : typeof emb;
            console.log(`Fragment ${i + 1}: ID=${f._id}, Dim=${length}, Type=${type}, Content Preview="${f.content?.substring(0, 50)}..."`);
        });

        // Check for mismatches
        const dims = new Set(fragments.map(f => f.embedding ? f.embedding.length : 0));
        if (dims.size > 1) {
            console.log(`\n!!! DIMENSION MISMATCH DETECTED: Found dimensions ${Array.from(dims).join(', ')}`);
            console.log('This will cause cosineSimilarity to return 0 and link rebuilding to fail.');
        } else {
            console.log(`\nAll checked fragments have dimension ${Array.from(dims)[0]}`);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkEmbeddings();
