const { generateEmbeddings } = require('./src/services/embedding.service');

(async () => {
  try {
    const emb = await generateEmbeddings('test embedding from module');
    console.log('Embedding length:', emb.length);
  } catch (err) {
    console.error('Error from module call:', err.message);
    if (err.stack) console.error(err.stack);
  }
})();
