/**
 * Performance Optimizations for EchoLink
 * 
 * This file contains utilities and middleware for improving performance
 * when dealing with large datasets.
 */

const NodeCache = require('node-cache');
const logger = require('./logger');

// Create cache instances
const queryCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 min TTL
const statsCache = new NodeCache({ stdTTL: 60, checkperiod: 10 }); // 1 min TTL

/**
 * Cache middleware for queries
 * @param {number} ttl - Time to live in seconds
 */
function cacheQuery(ttl = 300) {
    return (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'POST') {
            return next();
        }

        const key = `query:${req.user?._id}:${JSON.stringify(req.body || req.query)}`;
        const cached = queryCache.get(key);

        if (cached) {
            logger.debug(`Cache hit for key: ${key}`);
            return res.json(cached);
        }

        // Store original send function
        const originalSend = res.json.bind(res);

        // Override send to cache response
        res.json = (data) => {
            queryCache.set(key, data, ttl);
            logger.debug(`Cached response for key: ${key}`);
            return originalSend(data);
        };

        next();
    };
}

/**
 * Cache middleware for stats
 */
function cacheStats(ttl = 60) {
    return (req, res, next) => {
        const key = `stats:${req.user?._id}`;
        const cached = statsCache.get(key);

        if (cached) {
            return res.json(cached);
        }

        const originalSend = res.json.bind(res);

        res.json = (data) => {
            statsCache.set(key, data, ttl);
            return originalSend(data);
        };

        next();
    };
}

/**
 * Clear cache for a user
 * @param {string} userId - User ID
 */
function clearUserCache(userId) {
    const keys = queryCache.keys();
    const userKeys = keys.filter(k => k.includes(userId));

    userKeys.forEach(key => {
        queryCache.del(key);
        statsCache.del(key);
    });

    logger.info(`Cleared cache for user: ${userId}`);
}

/**
 * Pagination helper
 * @param {Object} query - Mongoose query
 * @param {Object} options - Pagination options
 */
function paginate(query, options = {}) {
    const page = parseInt(options.page) || 1;
    const limit = parseInt(options.limit) || 20;
    const skip = (page - 1) * limit;

    return {
        skip,
        limit: Math.min(limit, 100), // Max 100 per page
        page,
    };
}

/**
 * Graph optimization: Limit nodes and edges for large graphs
 * @param {Object} graphData - Graph data with nodes and edges
 * @param {Object} options - Optimization options
 */
function optimizeGraph(graphData, options = {}) {
    const { maxNodes = 100, maxEdges = 200, priorityThreshold = 0.5 } = options;

    let { nodes, edges } = graphData;

    // If graph is too large, filter by priority
    if (nodes.length > maxNodes) {
        // Sort nodes by priority (e.g., number of connections)
        const nodeConnections = new Map();
        edges.forEach(edge => {
            nodeConnections.set(edge.from, (nodeConnections.get(edge.from) || 0) + 1);
            nodeConnections.set(edge.to, (nodeConnections.get(edge.to) || 0) + 1);
        });

        nodes = nodes
            .map(node => ({
                ...node,
                connections: nodeConnections.get(node.id) || 0,
            }))
            .sort((a, b) => b.connections - a.connections)
            .slice(0, maxNodes);

        const nodeIds = new Set(nodes.map(n => n.id));
        edges = edges.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to));
    }

    // Limit edges
    if (edges.length > maxEdges) {
        edges = edges
            .sort((a, b) => (b.weight || 0) - (a.weight || 0))
            .slice(0, maxEdges);
    }

    return { nodes, edges };
}

/**
 * Debounce function for rate limiting
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 */
function debounce(func, wait = 500) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Batch process items for better performance
 * @param {Array} items - Items to process
 * @param {Function} processor - Processing function
 * @param {number} batchSize - Batch size
 */
async function batchProcess(items, processor, batchSize = 10) {
    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processor));
        results.push(...batchResults);

        // Log progress
        logger.debug(`Processed ${Math.min(i + batchSize, items.length)}/${items.length} items`);
    }

    return results;
}

/**
 * MongoDB index recommendations
 */
const RECOMMENDED_INDEXES = [
    // Fragment indexes
    { collection: 'fragments', fields: { user: 1, datetime: -1 } },
    { collection: 'fragments', fields: { user: 1, source: 1 } },
    { collection: 'fragments', fields: { user: 1, status: 1 } },
    { collection: 'fragments', fields: { content: 'text', summary: 'text' } },

    // Source indexes
    { collection: 'sources', fields: { user: 1, createdAt: -1 } },
    { collection: 'sources', fields: { user: 1, status: 1 } },

    // Link indexes
    { collection: 'links', fields: { user: 1, sourceFragment: 1 } },
    { collection: 'links', fields: { user: 1, targetFragment: 1 } },
    { collection: 'links', fields: { user: 1, type: 1 } },

    // Query indexes
    { collection: 'queries', fields: { user: 1, createdAt: -1 } },
];

/**
 * Create recommended indexes
 * @param {Object} db - MongoDB database instance
 */
async function createRecommendedIndexes(db) {
    for (const index of RECOMMENDED_INDEXES) {
        try {
            await db.collection(index.collection).createIndex(index.fields);
            logger.info(`Created index on ${index.collection}:`, index.fields);
        } catch (error) {
            logger.warn(`Failed to create index on ${index.collection}:`, error.message);
        }
    }
}

module.exports = {
    cacheQuery,
    cacheStats,
    clearUserCache,
    paginate,
    optimizeGraph,
    debounce,
    batchProcess,
    createRecommendedIndexes,
    RECOMMENDED_INDEXES,
};
