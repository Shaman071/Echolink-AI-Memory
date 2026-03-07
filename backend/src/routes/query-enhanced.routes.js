const express = require('express');
const { auth } = require('../middleware/auth.middleware');
const { Fragment, Link } = require('../models');
const { generateEmbeddings, cosineSimilarity, queryEmbeddingService } = require('../services/embedding.service');
const { summarize } = require('../services/summarizer.service');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/query
 * Semantic search with summary, evidence, timeline, and graph
 * Body: { q: "query text", topK: 5 }
 * 
 * GUARANTEES:
 * - Never returns 500 error
 * - Always returns valid JSON response
 * - Always provides user feedback
 */
router.post('/', auth(), async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { q, topK = 5 } = req.body;

    // Validate input
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({
        summary: 'Please provide a valid search query.',
        evidence: [],
        timeline: [],
        graph: { nodes: [], edges: [] }
      });
    }

    const userId = req.user._id;
    logger.info(`[Query] User ${userId} searching for: "${q}"`);

    // PHASE 1: Retrieve fragments with multi-tier fallback
    let scored = [];
    let searchMethod = 'none';

    // Try external embedding service first
    try {
      const results = await queryEmbeddingService(q, topK);
      if (Array.isArray(results) && results.length > 0) {
        const ids = results.map(r => r.id).filter(Boolean);
        logger.info(`[Query] External embedding service returned ${ids.length} IDs`);

        const fragments = await Fragment.find({ _id: { $in: ids }, user: userId })
          .select('_id content sender datetime keywords topics source')
          .populate('source', 'title type _id')
          .lean();

        const fragMap = new Map(fragments.map(f => [f._id.toString(), f]));
        scored = results
          .map(r => {
            const frag = fragMap.get(r.id);
            return frag ? { ...frag, score: parseFloat((r.score || 0).toFixed(2)) } : null;
          })
          .filter(Boolean)
          .slice(0, topK);

        searchMethod = 'external_embedding';
        logger.info(`[Query] Mapped to ${scored.length} valid fragments`);
      }
    } catch (err) {
      logger.warn(`[Query] External embedding failed: ${err.message}, trying local`);
    }

    // Fallback to local embedding search
    if (scored.length === 0) {
      try {
        const queryEmbedding = await generateEmbeddings(q);
        const fragments = await Fragment.find({
          user: userId,
          embedding: { $exists: true },
          status: { $in: ['indexed', 'processed'] },
        })
          .select('_id content sender datetime keywords topics source embedding')
          .limit(500)
          .lean();

        logger.info(`[Query] Local search found ${fragments.length} fragments with embeddings`);

        scored = fragments
          .map(f => ({ ...f, score: cosineSimilarity(queryEmbedding, f.embedding) }))
          .filter(f => f.score >= 0.5)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
          .map(f => ({ ...f, score: parseFloat(f.score.toFixed(2)) }));

        searchMethod = 'local_embedding';
        logger.info(`[Query] Local embedding returned ${scored.length} results`);
      } catch (err) {
        logger.warn(`[Query] Local embedding failed: ${err.message}, trying text search`);
      }
    }

    // Final fallback to text search
    if (scored.length === 0) {
      try {
        const textFragments = await Fragment.find(
          { $text: { $search: q }, user: userId },
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(topK)
          .populate('source', 'title type _id')
          .lean();

        scored = textFragments.map(f => ({
          ...f,
          score: parseFloat((f.score || 0.5).toFixed(2))
        }));

        searchMethod = 'text_search';
        logger.info(`[Query] Text search returned ${scored.length} results`);
      } catch (err) {
        logger.warn(`[Query] Text search failed: ${err.message}`);
        searchMethod = 'failed';
      }
    }

    // PHASE 2: Build evidence array with null-safe mapping
    const evidence = scored
      .filter(f => f._id && f.content) // Only include valid fragments
      .map(f => ({
        _id: f._id,
        text: f.content || '',
        sender: f.sender || 'Unknown',
        datetime: f.datetime || null,
        score: f.score || 0,
        sourceId: f.source?._id || null,
      }));

    const droppedCount = scored.length - evidence.length;
    if (droppedCount > 0) {
      logger.warn(`[Query] Dropped ${droppedCount} invalid fragments (missing _id or content)`);
    }

    logger.info(`[Query] Final evidence count: ${evidence.length} (method: ${searchMethod})`);

    // PHASE 3: Generate summary with multi-tier fallback
    let summary = '';
    let summaryMethod = 'none';

    if (evidence.length > 0) {
      try {
        // Convert evidence to format expected by summarizer
        const fragmentsForSummary = evidence.map(e => ({
          text: e.text,
          sender: e.sender,
          datetime: e.datetime
        }));

        summary = await summarize(fragmentsForSummary, q, { maxLength: 300 });
        summaryMethod = 'ai_generated';
        logger.info(`[Query] AI summary generated successfully`);
      } catch (error) {
        logger.warn(`[Query] AI summary failed: ${error.message}, using fallback`);

        // Fallback summary with safe text access
        const topEvidence = evidence[0];
        const previewText = topEvidence.text
          ? (topEvidence.text.substring(0, 150) + (topEvidence.text.length > 150 ? '...' : ''))
          : 'Content unavailable';

        summary = `Found ${evidence.length} relevant fragment${evidence.length > 1 ? 's' : ''}. Top result from ${topEvidence.sender}: ${previewText}`;
        summaryMethod = 'fallback';
      }
    } else {
      summary = `No relevant fragments found for "${q}". This could mean:\n• No documents have been uploaded yet\n• The uploaded content doesn't contain this information\n• Try uploading documents or using different keywords`;
      summaryMethod = 'no_results';
      logger.info(`[Query] No results found for query`);
    }

    // PHASE 4: Build timeline (null-safe)
    const timelineMap = {};
    evidence.forEach(e => {
      if (e.datetime) {
        try {
          const date = new Date(e.datetime).toISOString().split('T')[0];
          timelineMap[date] = (timelineMap[date] || 0) + 1;
        } catch (err) {
          // Invalid date, skip
        }
      }
    });

    const timeline = Object.entries(timelineMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // PHASE 5: Build graph (null-safe)
    const evidenceIds = evidence.map(e => e._id).filter(Boolean);
    let links = [];

    try {
      links = await Link.find({
        user: userId,
        $or: [
          { sourceFragment: { $in: evidenceIds } },
          { targetFragment: { $in: evidenceIds } },
        ],
      }).lean();
    } catch (err) {
      logger.warn(`[Query] Failed to fetch links: ${err.message}`);
    }

    const nodes = evidence
      .filter(e => e._id)
      .map(e => ({
        id: e._id.toString(),
        label: e.text ? (e.text.substring(0, 50) + (e.text.length > 50 ? '...' : '')) : '...',
        topic: (e.topics && e.topics[0]) || 'general',
        datetime: e.datetime,
      }));

    const edges = links
      .filter(l => l.sourceFragment && l.targetFragment)
      .filter(l => evidenceIds.some(id => id && id.equals(l.sourceFragment)) &&
        evidenceIds.some(id => id && id.equals(l.targetFragment)))
      .map(l => ({
        from: l.sourceFragment.toString(),
        target: l.targetFragment.toString(),
        relation: l.type || 'related',
        weight: l.strength || 0.5,
      }));

    const graph = { nodes, edges };

    // PHASE 6: Log final stats
    const duration = Date.now() - startTime;
    logger.info(`[Query] Completed in ${duration}ms | Evidence: ${evidence.length} | Timeline: ${timeline.length} | Graph: ${nodes.length} nodes, ${edges.length} edges | Summary: ${summaryMethod}`);

    // PHASE 7: Return guaranteed valid response
    return res.status(200).json({
      summary,
      evidence,
      timeline,
      graph,
    });

  } catch (error) {
    // Absolute last resort: return valid empty response
    logger.error(`[Query] Critical error: ${error.message}`, { stack: error.stack });

    return res.status(200).json({
      summary: 'An unexpected error occurred while searching. Please try again or contact support if the issue persists.',
      evidence: [],
      timeline: [],
      graph: { nodes: [], edges: [] },
      _error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
