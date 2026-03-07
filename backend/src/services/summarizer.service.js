const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const config = require('../config/config');

// Initialize Clients
let openai;
let geminiModel;

if (config.openai.apiKey) {
  if (config.openai.apiKey.startsWith('AIza')) {
    logger.info('Detected Google Gemini API Key. Initializing Google Generative AI.');
    const genAI = new GoogleGenerativeAI(config.openai.apiKey);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
  } else {
    openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
}

/**
 * Summarize a set of fragments for a query response
 */
async function summarize(fragments, query, options = {}) {
  try {
    if (!Array.isArray(fragments) || fragments.length === 0) {
      return 'No fragments to summarize.';
    }

    const { maxLength = 300 } = options;

    // Build context from fragments
    const contextText = fragments
      .slice(0, 5)
      .map((f, idx) => {
        const sender = f.sender ? `${f.sender}: ` : '';
        const text = f.text ? f.text.substring(0, 200) : 'No text';
        return `[${idx + 1}] ${sender}${text}`;
      })
      .join('\n\n');

    if (!contextText || contextText.trim().length === 0) {
      return 'Unable to generate summary from fragments.';
    }

    const prompt = `Based on the following evidence fragments, provide a concise answer to the query: "${query}"

Evidence:
${contextText}

Provide a direct answer in ${maxLength} characters or less, citing evidence fragment numbers where relevant.`;

    // 1. Try Gemini if configured
    if (geminiModel) {
      try {
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return text.trim() || 'Summary generation failed.';
      } catch (error) {
        logger.warn('Gemini summarization failed:', error.message);
      }
    }

    // 2. Try OpenAI if configured
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that summarizes information from multiple sources to answer questions.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: Math.floor(maxLength / 4),
        });

        const summary = response.choices[0]?.message?.content?.trim();
        return summary || 'Summary generation failed.';
      } catch (error) {
        logger.warn('OpenAI summarization failed, using fallback:', error.message);
      }
    }

    // Fallback: simple concatenation with truncation
    let fallbackSummary = `Based on the search for "${query}", here are the key findings:\n\n${contextText}`;

    if (fallbackSummary.length > maxLength) {
      fallbackSummary = fallbackSummary.substring(0, maxLength) + '...';
    }

    return fallbackSummary;
  } catch (error) {
    logger.error('Error in summarize:', error);
    return 'Unable to generate summary at this time.';
  }
}

/**
 * Generate a summary for the given text
 */
async function generateSummary(text, options = {}) {
  const { maxLength = 250 } = options;

  try {
    if (!openai && !geminiModel) {
      // Allow fallback if no API key
      throw new Error('No AI API key configured');
    }

    const prompt = `Please provide a concise summary of the following text, focusing on the key points and main ideas. The summary should be no more than ${maxLength} characters.

Text: ${text}

Summary:`;

    // 1. Try Gemini
    if (geminiModel) {
      const result = await geminiModel.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    }

    // 2. Try OpenAI
    if (openai) {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes text concisely.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: Math.floor(maxLength / 4),
      });

      const summary = response.choices[0]?.message?.content.trim();
      if (!summary) throw new Error('No summary generated');
      return summary;
    }

  } catch (error) {
    logger.error('Error generating summary:', error);

    // Fallback to a simple truncation if there's an error
    if (text.length <= maxLength) {
      return text;
    }

    // Find the last sentence end within the max length
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');

    const lastPunctuation = Math.max(lastPeriod, lastExclamation, lastQuestion);

    if (lastPunctuation > 0) {
      return truncated.substring(0, lastPunctuation + 1);
    }

    return truncated + '...';
  }
}

/**
 * Generate a title for the given text
 * @param {string} text - Text to generate title for
 * @returns {Promise<string>} Generated title
 */
async function generateTitle(text) {
  try {
    if (!openai && !geminiModel) {
      throw new Error('No AI API key configured');
    }

    const prompt = `Generate a short, descriptive title (max 10 words) for the following text. Only return the title, nothing else.\n\n${text.substring(0, 2000)}`;

    // 1. Try Gemini
    if (geminiModel) {
      const result = await geminiModel.generateContent(prompt);
      const response = await result.response;
      const title = response.text().trim().replace(/^["']|["']$/g, '');
      return title || 'Untitled';
    }

    // 2. Try OpenAI
    if (openai) {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates concise, descriptive titles for text.'
          },
          {
            role: 'user',
            content: prompt
          },
        ],
        temperature: 0.3,
        max_tokens: 20,
      });

      const title = response.choices[0]?.message?.content
        .trim()
        .replace(/^["']|["']$/g, ''); // Remove surrounding quotes if any

      return title || 'Untitled';
    }

    throw new Error('No AI provider available');
  } catch (error) {
    logger.error('Error generating title:', error);

    // Fallback to first sentence or first few words
    const firstSentence = text.split(/[.!?]+/)[0];
    if (firstSentence && firstSentence.length > 10) {
      return firstSentence.substring(0, 100);
    }

    return text.substring(0, 50) + (text.length > 50 ? '...' : '');
  }
}

/**
 * Extract key points from the given text
 * @param {string} text - Text to extract key points from
 * @param {number} maxPoints - Maximum number of key points to return
 * @returns {Promise<Array<string>>} Array of key points
 */
async function extractKeyPoints(text, maxPoints = 5) {
  try {
    if (!openai && !geminiModel) {
      throw new Error('No AI API key configured');
    }

    const prompt = `Extract up to ${maxPoints} key points from the following text. Format each point as a short, clear sentence.\n\n${text.substring(0, 4000)}`;

    let content = '';

    // 1. Try Gemini
    if (geminiModel) {
      const result = await geminiModel.generateContent(prompt);
      const response = await result.response;
      content = response.text();
    }

    // 2. Try OpenAI
    else if (openai) {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts key points from text.'
          },
          {
            role: 'user',
            content: prompt
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });
      content = response.choices[0]?.message?.content;
    }

    if (!content) {
      throw new Error('No key points generated');
    }

    // Parse the response into an array of points
    const points = content
      .split('\n')
      .map(line => line.replace(/^\s*[\d•-]\s*/, '').trim())
      .filter(line => line.length > 0);

    return points.slice(0, maxPoints);
  } catch (error) {
    logger.error('Error extracting key points:', error);

    // Fallback to simple sentence splitting
    return text
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 10)
      .slice(0, maxPoints)
      .map(s => s.trim() + '.');
  }
}

module.exports = {
  summarize,
  generateSummary,
  generateTitle,
  extractKeyPoints,
};
