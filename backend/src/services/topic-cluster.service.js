const { Fragment, Link } = require('../models');
const { cosineSimilarity } = require('./embedding.service');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');
const logger = require('../utils/logger');

// Initialize Gemini for labeling
let geminiModel;
if (config.openai.apiKey && config.openai.apiKey.startsWith('AIza')) {
    const genAI = new GoogleGenerativeAI(config.openai.apiKey);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
}

/**
 * Create topic clusters based on embedding similarity
 * Groups fragments with similar embeddings into topic clusters
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Clustering options
 * @param {number} options.similarityThreshold - Minimum similarity score (0-1) to cluster together
 * @param {number} options.minClusterSize - Minimum fragments required to form a cluster
 * @returns {Promise<Array>} Array of clusters: [{ topicId, fragments, representativeFragment, avgSimilarity }]
 */
const { findSimilarFragments } = require('./search.service');

/**
 * Create topic clusters based on embedding similarity
 * Uses vector search to find clusters efficiently
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Clustering options
 * @param {number} options.similarityThreshold - Minimum similarity score (0-1) to cluster together
 * @param {number} options.minClusterSize - Minimum fragments required to form a cluster
 * @returns {Promise<Array>} Array of clusters
 */
async function createTopicClusters(userId, options = {}) {
    const {
        similarityThreshold = 0.8,
        minClusterSize = 2,
    } = options;

    try {
        // Limit to recent fragments to form *new* clusters or augment existing ones (sliding window)
        // We can't process ALL fragments every time due to performance
        const recentFragments = await Fragment.find({
            user: userId,
            embedding: { $exists: true, $ne: null },
            status: { $in: ['indexed', 'processed'] }
        })
            .sort('-createdAt')
            .limit(100) // Process last 100 items for clustering
            .populate('source', 'title type')
            .lean();

        logger.info(`[Clustering] Processing ${recentFragments.length} recent fragments for user ${userId}`);

        if (recentFragments.length === 0) return [];

        const clusters = [];
        const processedIds = new Set();

        for (const fragment of recentFragments) {
            if (processedIds.has(fragment._id.toString())) continue;

            // Find global neighbors using vector search
            // This leverages the Python service (via search.service.js refactor) to find OLDER matches too
            const neighbors = await findSimilarFragments(
                fragment.embedding,
                { user: userId, _id: { $ne: fragment._id } },
                { limit: 20, minScore: similarityThreshold }
            );

            if (neighbors.length + 1 >= minClusterSize) {
                // Determine if better to join an existing cluster or make a new one?
                // For simplicity, we create a new cluster snapshot
                const clusterFragments = [fragment, ...neighbors];

                // Mark these as processed for this run to avoid duplicates
                processedIds.add(fragment._id.toString());
                neighbors.forEach(n => processedIds.add(n._id.toString()));

                const avgSim = neighbors.reduce((sum, n) => sum + n.score, 0) / neighbors.length;

                // Use Gemini to generate a descriptive name for the topic
                let topicLabel = `Topic ${clusters.length + 1}`;
                if (geminiModel) {
                    try {
                        const clusterDocs = clusterFragments.map(f => f.content).join('\n---\n').substring(0, 3000);
                        const prompt = `Based on the following document fragments, generate a clear, concise topic label (3-5 words) that describes the common theme. Only return the label.\n\n${clusterDocs}`;
                        const result = await geminiModel.generateContent(prompt);
                        const response = await result.response;
                        const label = response.text().trim().replace(/^["']|["']$/g, '');
                        if (label) topicLabel = label;
                    } catch (labelError) {
                        logger.warn(`Failed to generate Gemini label for cluster: ${labelError.message}`);
                    }
                }

                const topicId = `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                clusters.push({
                    topicId,
                    label: topicLabel,
                    fragments: clusterFragments,
                    representativeFragment: fragment,
                    avgSimilarity: parseFloat(avgSim.toFixed(3)),
                    size: clusterFragments.length
                });
            }
        }

        logger.info(`[Clustering] Created ${clusters.length} topic clusters`);
        return clusters;

    } catch (error) {
        logger.error(`[Clustering] Error creating topic clusters: ${error.message}`, { error });
        throw error;
    }
}

/**
 * Create links for topic clusters
 * Creates a "same_topic" link from each fragment to the representative fragment
 * 
 * @param {string} userId - User ID
 * @param {Array} clusters - Output from createTopicClusters
 * @returns {Promise<number>} Number of links created
 */
async function createClusterLinks(userId, clusters) {
    let linksCreated = 0;

    try {
        for (const cluster of clusters) {
            const { topicId, fragments, representativeFragment, avgSimilarity } = cluster;

            // Create links from each fragment to the representative
            for (const fragment of fragments) {
                if (!fragment || !fragment._id || !representativeFragment || !representativeFragment._id) {
                    continue;
                }

                // Skip the representative itself
                if (fragment._id.toString() === representativeFragment._id.toString()) {
                    continue;
                }

                // Check if link already exists
                const existingLink = await Link.findOne({
                    user: userId,
                    sourceFragment: fragment._id,
                    targetFragment: representativeFragment._id,
                    type: 'same_topic'
                });

                if (!existingLink) {
                    await Link.create({
                        user: userId,
                        sourceFragment: fragment._id,
                        targetFragment: representativeFragment._id,
                        type: 'same_topic',
                        strength: avgSimilarity,
                        metadata: {
                            topicId,
                            topicLabel: cluster.label,
                            clusterSize: cluster.size,
                            createdBy: 'topic_clustering',
                            clusterFragments: fragments.map(f => f._id)
                        }
                    });
                    linksCreated++;
                }
            }

            logger.info(`[Clustering] Created ${linksCreated} links for cluster ${topicId}`);
        }

        logger.info(`[Clustering] Total ${linksCreated} topic links created for user ${userId}`);
        return linksCreated;

    } catch (error) {
        logger.error(`[Clustering] Error creating cluster links: ${error.message}`, { error });
        throw error;
    }
}

/**
 * Build topic clusters and create links in one operation
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Options for clustering
 * @returns {Promise<Object>} Result with clusters and links created
 */
async function buildTopicClusters(userId, options = {}) {
    try {
        logger.info(`[Clustering] Building topic clusters for user ${userId}`);

        // Create clusters
        const clusters = await createTopicClusters(userId, options);

        // Create links for clusters
        const linksCreated = await createClusterLinks(userId, clusters);

        return {
            clustersCreated: clusters.length,
            linksCreated,
            clusters: clusters.filter(c => c && c.representativeFragment).map(c => ({
                topicId: c.topicId,
                label: c.label,
                size: c.size,
                avgSimilarity: c.avgSimilarity,
                representative: {
                    _id: c.representativeFragment._id,
                    content: c.representativeFragment.content?.substring(0, 100) + '...'
                }
            }))
        };

    } catch (error) {
        logger.error(`[Clustering] Error building topic clusters: ${error.message}`, { error });
        throw error;
    }
}

module.exports = {
    createTopicClusters,
    createClusterLinks,
    buildTopicClusters
};
