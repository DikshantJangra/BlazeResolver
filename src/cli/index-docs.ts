import { readFileSync } from 'node:fs';
import { loadDocs } from '../answer/index.js';
import { resolveEmbedder, type Embedder } from '../answer/embed.js';
import { indexDocs } from '../answer/retrieve.js';
import { localVectorStore, type VectorStore } from '../answer/vector-store.js';

export interface IndexOptions {
  /** owner/name, from blazeresolver.config.json: the README is fetched from GitHub when none is on disk. */
  repo?: string;
  /** Extra docs files to index along with the README (the same text you pass the handlers as helpDocs). */
  docs?: string[];
  env?: Record<string, string | undefined>;
  /** For tests: an embedder and store instead of the ones the environment configures. */
  embedder?: Embedder;
  store?: VectorStore;
  fetch?: typeof fetch;
}

/**
 * `blazeresolver index`: builds the product's vector database now, from its README (on disk, else GitHub) and any docs
 * files, so the first question doesn't wait for embeddings. Safe to re-run: only new or changed sections are embedded.
 */
export async function runIndexCommand(opts: IndexOptions = {}): Promise<string> {
  const env = opts.env ?? process.env;
  const embedder = opts.embedder ?? resolveEmbedder({ env });
  if (!embedder) {
    throw new Error(
      'No embeddings provider is configured, so there are no vectors to store. Add a key for one that has embeddings ' +
        '(OPENAI_API_KEY, GEMINI_API_KEY, VOYAGE_API_KEY, MISTRAL_API_KEY, COHERE_API_KEY or NVIDIA_API_KEY, or any of ' +
        'those in API_KEYS), or point BLAZE_EMBED_BASE_URL at an OpenAI-compatible endpoint. Anthropic and Groq have no ' +
        'embeddings API. `npx blazeresolver providers` shows what your keys were recognized as.'
    );
  }
  const store = opts.store ?? localVectorStore();
  if (!store) {
    throw new Error(
      "Could not open the vector database: it needs Node's built-in SQLite (Node 22.5 or later) and a writable folder. " +
        'Set BLAZE_VECTOR_DB to a writable path, or pass a store over your own database to the handlers (vectorStore).'
    );
  }

  const helpDocs = (opts.docs ?? []).map((file) => readFileSync(file, 'utf8')).join('\n\n') || undefined;
  const docs = await loadDocs({
    helpDocs,
    readme: opts.repo ? { repo: opts.repo, token: env.BLAZE_GITHUB_TOKEN, fetch: opts.fetch } : undefined
  });
  if (!docs) {
    throw new Error(
      'Found nothing to index: no README at the root of this repo' +
        (opts.repo ? `, none readable on GitHub for ${opts.repo}` : '') +
        ', and no --docs files. Write a README.md for your product, or pass --docs <file>.'
    );
  }

  const r = await indexDocs(docs, { embedder, store });
  return [
    `Vector database: ${store.location ?? 'your vector store'}`,
    `  ${r.sections} sections of your docs: ${r.embedded} embedded now, ${r.reused} already stored`,
    `  embeddings: ${embedder.id}`,
    r.embedded ? '  Blazzy now finds these by meaning as well as by keywords.' : '  Nothing changed since the last index.'
  ].join('\n');
}
