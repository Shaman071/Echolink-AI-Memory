const axios = require('axios');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const config = require('../config/config');
const { Fragment } = require('../models');
const { GoogleGenerativeAI } = require('@google/generative-ai');
// Simple in-memory circuit breaker for the fallback embedding service
const circuit = {
  state: 'CLOSED', // CLOSED | OPEN | HALF_OPEN
  failures: 0,
  lastFailureAt: null,
  openUntil: null,
};
const CB_MAX_FAILURES = 5;
const CB_OPEN_MS = 30 * 1000; // 30s

// Initialize OpenAI client
let openai;
let geminiAI;

// Initialize clients based on API key type
if (config.openai.apiKey) {
  if (config.openai.apiKey.startsWith('AIza')) {
    logger.info('Detected Gemini API Key for embeddings. Initializing Google Generative AI.');
    geminiAI = new GoogleGenerativeAI(config.openai.apiKey);
  } else {
    openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
}

/**
 * Generate embeddings for a text using OpenAI
 * @param {string} text - Text to generate embeddings for
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbeddings(text) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for embedding generation');
    }

    // Try Gemini if configured
    if (geminiAI) {
      try {
        return await generateGeminiEmbeddings(text);
      } catch (geminiError) {
        logger.warn('Gemini embedding failed, trying fallback service:', geminiError.message);
      }
    }

    // Try OpenAI if configured
    if (openai) {
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: text,
        });

        if (!response.data || !response.data[0]) {
          throw new Error('Invalid response from OpenAI API');
        }

        return response.data[0].embedding;
      } catch (openaiError) {
        logger.warn('OpenAI embedding failed, trying fallback service:', openaiError.message);
        // Fall through to fallback service
      }
    }

    // Use fallback embedding service
    if (config.embeddingService && config.embeddingService.url) {
      logger.info('Using custom embedding service');
      return generateEmbeddingsFallback(text);
    }

    throw new Error('No embedding service configured');
  } catch (error) {
    logger.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings: ' + error.message);
  }
}

/**
 * Generate embeddings using Google Gemini API
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>}
 */
async function generateGeminiEmbeddings(text) {
  try {
    const model = geminiAI.getGenerativeModel({ model: "embedding-001" });
    const result = await model.embedContent(text);
    const embedding = result.embedding;

    if (!embedding || !Array.isArray(embedding.values)) {
      throw new Error('Invalid embedding response from Gemini');
    }

    return embedding.values;
  } catch (error) {
    logger.error('Error in Gemini embeddings:', error.message);
    throw error;
  }
}

/**
 * Fallback function to generate embeddings using a custom service
 * @param {string} text - Text to generate embeddings for
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbeddingsFallback(text) {
  try {
    // Circuit breaker: short-circuit when open
    if (circuit.state === 'OPEN') {
      if (Date.now() < circuit.openUntil) {
        throw new Error('Embedding fallback circuit open');
      }
      // move to half-open and allow a try
      circuit.state = 'HALF_OPEN';
    }
    // Retry a couple times for transient network/model-loading errors
    const maxAttempts = 3;
    let attempt = 0;
    let lastErr;

    while (attempt < maxAttempts) {
      try {
        const response = await axios.post(
          `${config.embeddingService.url.replace(/\/$/, '')}/embed`,
          { text },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 seconds timeout
          }
        );

        if (!response.data || !Array.isArray(response.data.embedding)) {
          throw new Error('Invalid response from embedding service');
        }

        return response.data.embedding;
      } catch (err) {
        lastErr = err;
        attempt += 1;
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        logger.warn(`Embedding fallback attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${backoffMs}ms`);
        if (attempt < maxAttempts) {
          // small sleep
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }
    }

    // If we reach here, all attempts failed
    throw lastErr || new Error('Failed to call embedding fallback service');
  } catch (error) {
    // On error, update circuit-breaker state
    try {
      circuit.failures = (circuit.failures || 0) + 1;
      circuit.lastFailureAt = Date.now();
      if (circuit.failures >= CB_MAX_FAILURES) {
        circuit.state = 'OPEN';
        circuit.openUntil = Date.now() + CB_OPEN_MS;
        logger.warn(`Embedding fallback circuit OPEN until ${new Date(circuit.openUntil).toISOString()}`);
      }
    } catch (cbErr) {
      // ignore
    }

    // Log useful diagnostics from axios error objects (message, response body, code)
    try {
      const respData = error && error.response ? error.response.data : undefined;
      logger.error('Error in fallback embedding service: message=%s, code=%s, response=%o', error && error.message, error && error.code, respData);
    } catch (logErr) {
      logger.error('Error in fallback embedding service:', error);
    }

    throw new Error('Failed to generate embeddings using fallback service');
  }
}

/**
 * Generate embeddings for multiple texts using the fallback embedding service's batch endpoint
 * @param {string[]} texts - Array of texts
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function generateEmbeddingsBatch(texts) {
  try {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('texts must be a non-empty array');
    }

    // Prefer the batch endpoint if available
    if (config.embeddingService && config.embeddingService.url) {
      const url = `${config.embeddingService.url.replace(/\/$/, '')}/embed/batch`;
      const response = await axios.post(
        url,
        { texts },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );

      if (!response.data || !Array.isArray(response.data.embeddings)) {
        throw new Error('Invalid response from embedding batch service');
      }

      return response.data.embeddings;
    }

    // Fallback: call single endpoint iteratively (slower)
    const embeddings = [];
    for (const t of texts) {
      embeddings.push(await generateEmbeddings(t));
    }
    return embeddings;
  } catch (error) {
    logger.error('Error in generateEmbeddingsBatch:', error.message || error);
    throw error;
  }
}

/**
 * Register documents with the external embedding service
 * @param {Array<{id: string, text: string, meta?: Object}>} docs
 * @returns {Promise<Object>} service response
 */
async function addDocumentsToService(docs) {
  try {
    if (!config.embeddingService || !config.embeddingService.url) {
      throw new Error('Embedding service URL not configured');
    }

    const url = `${config.embeddingService.url.replace(/\/$/, '')}/add`;
    const response = await axios.post(url, docs, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    return response.data;
  } catch (error) {
    logger.error('Error adding documents to embedding service:', error.message || error);
    throw error;
  }
}

/**
 * Query the embedding service for similar documents
 * @param {string} q - Query text
 * @param {number} k - Number of results
 * @returns {Promise<Array<{id:string,text:string,score:number}>>}
 */
async function queryEmbeddingService(q, k = 5) {
  try {
    // If an external embedding/query service exposes a /query endpoint, prefer it.
    if (config.embeddingService && config.embeddingService.url) {
      try {
        const url = `${config.embeddingService.url.replace(/\/$/, '')}/query`;
        const response = await axios.post(url, { q, k }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        });

        if (response.data && Array.isArray(response.data.results)) {
          return response.data.results;
        }
        // If response format unexpected, fall through to local computation
        logger.warn('Embedding query service returned unexpected format, falling back to local search');
      } catch (err) {
        logger.warn('External embedding query failed, falling back to local search:', err.message || err);
      }
    }

    // Fallback: compute embedding locally (via OpenAI or fallback) and run local vector search
    const queryEmbedding = await generateEmbeddings(q);
    const results = await findSimilarFragments(queryEmbedding, {}, { limit: k, minScore: 0.0 });
    // Map to expected shape: [{ id, text, score }]
    return results.map(r => ({ id: r._id.toString(), text: r.content, score: r.score }));
  } catch (error) {
    logger.error('Error querying embedding service:', error.message || error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} Similarity score between 0 and 1
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  const dotProduct = vecA.reduce((sum, val, i) => sum + val * (vecB[i] || 0), 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Find similar fragments using vector search
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {Object} filter - MongoDB filter
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of matching fragments with scores
 */
async function findSimilarFragments(queryEmbedding, filter = {}, options = {}) {
  const { limit = 10, minScore = 0.7 } = options;

  // In a production environment, you would use a vector database like Pinecone, Weaviate, or Milvus
  // For MongoDB with vector search, you would use the $vectorSearch aggregation

  // This is a simplified implementation that loads all fragments into memory
  // and calculates similarity scores - not suitable for production with large datasets
  // Ensure we include the stored embedding field (it's defined with select: false on the schema)
  // Use lean() for faster iteration and to avoid mongoose document overhead
  const fragments = await Fragment.find({
    ...filter,
    embedding: { $exists: true },
  }).select('+embedding').lean();

  // Calculate similarity scores
  const results = fragments
    .map(fragment => ({
      ...fragment,
      score: cosineSimilarity(queryEmbedding, fragment.embedding),
    }))
    .filter(result => result.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}

module.exports = {
  generateEmbeddings,
  cosineSimilarity,
  findSimilarFragments,
  generateEmbeddingsBatch,
  addDocumentsToService,
  queryEmbeddingService,
};

// Expose circuit-breaker state for diagnostics/metrics
module.exports.getCircuitState = () => ({
  state: circuit.state,
  failures: circuit.failures,
  lastFailureAt: circuit.lastFailureAt,
  openUntil: circuit.openUntil,
});

/**
 * Remove documents from the external embedding service
 * @param {string[]} ids - Array of document IDs to remove
 * @returns {Promise<Object>} service response
 */
async function removeDocumentsFromService(ids) {
  try {
    if (!ids || ids.length === 0) return { success: true };

    if (!config.embeddingService || !config.embeddingService.url) {
      // If no service configured, nothing to delete externally
      return { success: true, skipped: true };
    }

    const url = `${config.embeddingService.url.replace(/\/$/, '')}/delete`;

    // Check if the service supports delete (some might not)
    try {
      const response = await axios.post(url, { ids }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      return response.data;
    } catch (err) {
      // If 404, endpoint might not exist, which is fine
      if (err.response && err.response.status === 404) {
        logger.warn('Embedding service does not support /delete endpoint');
        return { success: false, notSupported: true };
      }
      throw err;
    }
  } catch (error) {
    logger.warn('Error removing documents from embedding service:', error.message || error);
    // Don't throw, just log. We don't want to block local deletion.
    return { success: false, error: error.message };
  }
}

module.exports.removeDocumentsFromService = removeDocumentsFromService;
