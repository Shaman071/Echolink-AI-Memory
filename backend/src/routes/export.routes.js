const express = require('express');
const { auth } = require('../middleware/auth.middleware');
const { User, Source, Fragment, Link, Query } = require('../models');
const logger = require('../utils/logger');
const archiver = require('archiver');
const { Readable } = require('stream');

const router = express.Router();

/**
 * GET /api/export/data
 * Export all user data as JSON or ZIP
 */
router.get('/data', auth(), async (req, res, next) => {
    try {
        const userId = req.user._id;
        const format = req.query.format || 'json'; // json or zip

        logger.info(`Exporting data for user ${userId} in ${format} format`);

        // Fetch all user data
        const [user, sources, fragments, links, queries] = await Promise.all([
            User.findById(userId).select('-password').lean(),
            Source.find({ user: userId }).lean(),
            Fragment.find({ user: userId }).lean(),
            Link.find({ user: userId }).lean(),
            Query.find({ user: userId }).limit(100).lean(), // Limit queries to last 100
        ]);

        const exportData = {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
                preferences: user.preferences,
            },
            sources: sources.map(s => ({
                id: s._id,
                title: s.title,
                type: s.type,
                status: s.status,
                fileType: s.fileType,
                fileSize: s.fileSize,
                fragmentCount: s.fragmentCount,
                createdAt: s.createdAt,
            })),
            fragments: fragments.map(f => ({
                id: f._id,
                sourceId: f.source,
                content: f.content,
                sender: f.sender,
                datetime: f.datetime,
                keywords: f.keywords,
                topics: f.topics,
                sentiment: f.sentiment,
                summary: f.summary,
                metadata: f.metadata,
                createdAt: f.createdAt,
            })),
            links: links.map(l => ({
                id: l._id,
                sourceFragmentId: l.sourceFragment,
                targetFragmentId: l.targetFragment,
                type: l.type,
                strength: l.strength,
                metadata: l.metadata,
                createdAt: l.createdAt,
            })),
            queries: queries.map(q => ({
                id: q._id,
                query: q.query,
                results: q.results,
                createdAt: q.createdAt,
            })),
            stats: {
                totalSources: sources.length,
                totalFragments: fragments.length,
                totalLinks: links.length,
                totalQueries: queries.length,
            },
        };

        if (format === 'zip') {
            // Create ZIP archive
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="echolink-export-${Date.now()}.zip"`);

            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('error', (err) => {
                logger.error('Archive error:', err);
                throw err;
            });

            archive.pipe(res);

            // Add main export file
            archive.append(JSON.stringify(exportData, null, 2), { name: 'export.json' });

            // Add README
            const readme = `# EchoLink Data Export
      
Exported: ${exportData.exportedAt}
User: ${user.name} (${user.email})

## Contents
- export.json: Complete data export
- sources.json: All uploaded sources
- fragments.json: All text fragments
- links.json: Knowledge graph links
- queries.json: Search history

## Restore
To restore this data, use the import feature in Settings > Data Management.

Version: ${exportData.version}
`;

            archive.append(readme, { name: 'README.txt' });

            // Add separate files for each data type
            archive.append(JSON.stringify(exportData.sources, null, 2), { name: 'sources.json' });
            archive.append(JSON.stringify(exportData.fragments, null, 2), { name: 'fragments.json' });
            archive.append(JSON.stringify(exportData.links, null, 2), { name: 'links.json' });
            archive.append(JSON.stringify(exportData.queries, null, 2), { name: 'queries.json' });

            await archive.finalize();
        } else {
            // Return JSON
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="echolink-export-${Date.now()}.json"`);
            res.json(exportData);
        }

        logger.info(`Data export completed for user ${userId}`);
    } catch (error) {
        logger.error('Error exporting data:', error);
        next(error);
    }
});

/**
 * GET /api/export/source/:sourceId
 * Export data for a specific source
 */
router.get('/source/:sourceId', auth(), async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { sourceId } = req.params;

        const source = await Source.findOne({ _id: sourceId, user: userId }).lean();

        if (!source) {
            return res.status(404).json({ error: 'Source not found' });
        }

        const fragments = await Fragment.find({ source: sourceId, user: userId }).lean();

        const exportData = {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            source: {
                id: source._id,
                title: source.title,
                type: source.type,
                status: source.status,
                createdAt: source.createdAt,
            },
            fragments: fragments.map(f => ({
                content: f.content,
                sender: f.sender,
                datetime: f.datetime,
                keywords: f.keywords,
                topics: f.topics,
            })),
            stats: {
                fragmentCount: fragments.length,
            },
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="source-${sourceId}-${Date.now()}.json"`);
        res.json(exportData);

        logger.info(`Source ${sourceId} exported for user ${userId}`);
    } catch (error) {
        logger.error('Error exporting source:', error);
        next(error);
    }
});

/**
 * POST /api/export/import
 * Import previously exported data
 */
router.post('/import', auth(), async (req, res, next) => {
    try {
        const userId = req.user._id;
        const importData = req.body;

        // Validate import data structure
        if (!importData.version || !importData.exportedAt) {
            return res.status(400).json({ error: 'Invalid import data format' });
        }

        // Version compatibility check
        const supportedVersions = ['1.0.0'];
        if (!supportedVersions.includes(importData.version)) {
            return res.status(400).json({
                error: `Unsupported export version: ${importData.version}. Supported versions: ${supportedVersions.join(', ')}`
            });
        }

        const stats = {
            sourcesImported: 0,
            fragmentsImported: 0,
            linksImported: 0,
            queriesImported: 0,
            errors: [],
        };

        // Import sources
        if (importData.sources && Array.isArray(importData.sources)) {
            for (const sourceData of importData.sources) {
                try {
                    // Check if source already exists (by title and type)
                    const existing = await Source.findOne({
                        user: userId,
                        title: sourceData.title,
                        type: sourceData.type,
                    });

                    if (!existing) {
                        const oldId = sourceData.id;
                        delete sourceData.id;
                        delete sourceData._id;

                        const newSource = await Source.create({
                            ...sourceData,
                            user: userId,
                            status: 'pending', // Reset status
                        });

                        // Store mapping for fragments
                        sourceData.newId = newSource._id;
                        sourceData.oldId = oldId;
                        stats.sourcesImported++;
                    } else {
                        sourceData.newId = existing._id;
                        sourceData.oldId = sourceData.id;
                    }
                } catch (error) {
                    stats.errors.push(`Source import error: ${error.message}`);
                }
            }
        }

        // Create ID mapping for sources
        const sourceIdMap = new Map();
        if (importData.sources) {
            importData.sources.forEach(s => {
                if (s.oldId && s.newId) {
                    sourceIdMap.set(s.oldId.toString(), s.newId);
                }
            });
        }

        // Import fragments
        if (importData.fragments && Array.isArray(importData.fragments)) {
            for (const fragmentData of importData.fragments) {
                try {
                    // Check if fragment already exists
                    const existing = await Fragment.findOne({
                        user: userId,
                        content: fragmentData.content,
                        source: sourceIdMap.get(fragmentData.sourceId?.toString()) || fragmentData.sourceId,
                    });

                    if (!existing) {
                        const oldId = fragmentData.id;
                        delete fragmentData.id;
                        delete fragmentData._id;

                        const newFragment = await Fragment.create({
                            ...fragmentData,
                            user: userId,
                            source: sourceIdMap.get(fragmentData.sourceId?.toString()) || fragmentData.sourceId,
                            status: 'pending', // Reset status
                        });

                        fragmentData.newId = newFragment._id;
                        fragmentData.oldId = oldId;
                        stats.fragmentsImported++;
                    } else {
                        fragmentData.newId = existing._id;
                        fragmentData.oldId = fragmentData.id;
                    }
                } catch (error) {
                    stats.errors.push(`Fragment import error: ${error.message}`);
                }
            }
        }

        // Create ID mapping for fragments
        const fragmentIdMap = new Map();
        if (importData.fragments) {
            importData.fragments.forEach(f => {
                if (f.oldId && f.newId) {
                    fragmentIdMap.set(f.oldId.toString(), f.newId);
                }
            });
        }

        // Import links
        if (importData.links && Array.isArray(importData.links)) {
            for (const linkData of importData.links) {
                try {
                    const sourceFragmentId = fragmentIdMap.get(linkData.sourceFragmentId?.toString());
                    const targetFragmentId = fragmentIdMap.get(linkData.targetFragmentId?.toString());

                    if (sourceFragmentId && targetFragmentId) {
                        // Check if link already exists
                        const existing = await Link.findOne({
                            user: userId,
                            sourceFragment: sourceFragmentId,
                            targetFragment: targetFragmentId,
                        });

                        if (!existing) {
                            delete linkData.id;
                            delete linkData._id;

                            await Link.create({
                                ...linkData,
                                user: userId,
                                sourceFragment: sourceFragmentId,
                                targetFragment: targetFragmentId,
                            });

                            stats.linksImported++;
                        }
                    }
                } catch (error) {
                    stats.errors.push(`Link import error: ${error.message}`);
                }
            }
        }

        res.json({
            success: true,
            message: ' Data imported successfully',
            stats,
        });

        logger.info(`Data import completed for user ${userId}:`, stats);
    } catch (error) {
        logger.error('Error importing data:', error);
        next(error);
    }
});

module.exports = router;
