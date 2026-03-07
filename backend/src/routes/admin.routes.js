const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { Source, Fragment, Link, Query, User } = require('../models');
const { indexSourceFragments } = require('../services/indexer.service');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/admin/status
 * Get comprehensive system status for admin dashboard
 */
router.get('/status', authenticate, async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Get comprehensive counts
        const [
            totalFragments,
            totalSources,
            totalLinks,
            totalQueries,
            totalUsers,
            processingCount,
            errorCount,
        ] = await Promise.all([
            Fragment.countDocuments({ user: userId }),
            Source.countDocuments({ user: userId }),
            Link.countDocuments({ user: userId }),
            Query.countDocuments({ user: userId }),
            User.countDocuments(),
            Source.countDocuments({ user: userId, status: 'processing' }),
            Source.countDocuments({ user: userId, status: 'error' }),
        ]);

        // Get recent activity
        const recentSources = await Source.find({ user: userId })
            .sort('-createdAt')
            .limit(10)
            .select('title type status createdAt')
            .lean();

        const recentQueries = await Query.find({ user: userId })
            .sort('-createdAt')
            .limit(10)
            .select('queryText status createdAt')
            .lean();

        const recentActivity = [
            ...recentSources.map(s => ({
                type: 'Upload',
                description: `${s.title || 'Untitled'} (${s.type})`,
                timestamp: s.createdAt,
                status: s.status,
            })),
            ...recentQueries.map(q => ({
                type: 'Query',
                description: q.queryText,
                timestamp: q.createdAt,
                status: q.status,
            })),
        ]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 20);

        res.json({
            totalFragments,
            totalSources,
            totalLinks,
            totalQueries,
            totalUsers,
            processingCount,
            errorCount,
            recentActivity,
            status: 'healthy',
            timestamp: new Date(),
        });
    } catch (error) {
        logger.error('Error fetching admin status:', error);
        next(error);
    }
});

/**
 * POST /api/admin/reindex-all
 * Reindex all sources for the user
 */
router.post('/reindex-all', authenticate, async (req, res, next) => {
    try {
        const userId = req.user._id;
        const sources = await Source.find({ user: userId });

        let reindexed = 0;
        let failed = 0;

        for (const source of sources) {
            try {
                await indexSourceFragments(source._id, { force: true });
                reindexed++;
            } catch (error) {
                logger.error(`Failed to reindex source ${source._id}:`, error);
                failed++;
            }
        }

        res.json({
            success: true,
            totalSources: sources.length,
            reindexed,
            failed,
            message: `Reindexed ${reindexed} sources successfully, ${failed} failed`,
        });
    } catch (error) {
        logger.error('Error reindexing all sources:', error);
        next(error);
    }
});

/**
 * DELETE /api/admin/purge-old
 * Delete data older than specified days
 */
router.delete('/purge-old', authenticate, async (req, res, next) => {
    try {
        const { days = 30 } = req.query;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

        const userId = req.user._id;

        // Delete old fragments
        const fragmentsDeleted = await Fragment.deleteMany({
            user: userId,
            createdAt: { $lt: cutoffDate },
        });

        // Delete old sources
        const sourcesDeleted = await Source.deleteMany({
            user: userId,
            createdAt: { $lt: cutoffDate },
        });

        // Delete orphaned links
        const linksDeleted = await Link.deleteMany({
            user: userId,
            $or: [
                { sourceFragment: { $exists: false } },
                { targetFragment: { $exists: false } },
            ],
        });

        res.json({
            success: true,
            deleted: {
                fragments: fragmentsDeleted.deletedCount,
                sources: sourcesDeleted.deletedCount,
                links: linksDeleted.deletedCount,
            },
            cutoffDate,
            message: `Deleted data older than ${days} days`,
        });
    } catch (error) {
        logger.error('Error purging old data:', error);
        next(error);
    }
});

/**
 * GET /api/admin/logs
 * Get recent system logs (placeholder - would need log aggregation)
 */
router.get('/logs', authenticate, async (req, res, next) => {
    try {
        // This is a placeholder - in production, you'd read from log files or a logging service
        res.json({
            logs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'System running normally',
                },
            ],
            message: 'Log aggregation not yet implemented',
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/workers/status
 * Get worker status (placeholder)
 */
router.get('/workers/status', authenticate, async (req, res, next) => {
    try {
        res.json({
            workers: [
                {
                    name: 'ingest-worker',
                    status: 'idle',
                    lastRun: new Date(),
                },
                {
                    name: 'link-worker',
                    status: 'idle',
                    lastRun: new Date(),
                },
            ],
            message: 'Worker monitoring not yet fully implemented',
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
