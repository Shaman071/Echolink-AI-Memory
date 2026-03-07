const mongoose = require('mongoose');
const { RefreshToken } = require('./src/models');
const config = require('./src/config/env');
const fs = require('fs');

mongoose.connect(config.mongoose.url, config.mongoose.options).then(async () => {
    const tokens = await RefreshToken.find({}).sort({ createdAt: -1 }).limit(5);
    const out = tokens.map(t => ({
        id: t._id,
        expires: t.expires,
        revokedAt: t.revokedAt,
        isExpired: t.isExpired,
        isActive: t.isActive,
        now: new Date()
    }));
    fs.writeFileSync('tokens.json', JSON.stringify(out, null, 2));
    process.exit(0);
});
