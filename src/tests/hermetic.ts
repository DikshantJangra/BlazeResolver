// Loaded before every test file (`npm test`). Tests never use embeddings keys from the shell running them: that would
// send test data to a real provider and write a vector database into this repo. Tests that exercise embeddings pass
// their own embedder or environment.
process.env.BLAZE_EMBED_PROVIDER = 'off';
