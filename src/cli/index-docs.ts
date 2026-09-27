import { readFileSync, realpathSync } from 'node:fs';
import { relative } from 'node:path';
import { loadSources } from '../answer/index.js';
import { repoRoot } from './detect.js';
import { resolveEmbedder, type Embedder } from '../answer/embed.js';
import { syncSources, type DocSource } from '../answer/retrieve.js';
import { localVectorStore, type VectorStore } from '../answer/vector-store.js';

export interface IndexOptions {
  /** owner/name, from blazeresolver.config.json: the README is fetched from GitHub when none is on disk. */
  repo?: string;
  /** Extra docs files to put in the vector database, each as its own source (`file:<path>`). */
  docs?: string[];
  /** Also delete `file:` sources from earlier runs that this run wasn't given. */
  prune?: boolean;
  env?: Record<string, string | undefined>;
  /** For tests: an embedder and store instead of the ones the environment configures. */
  embedder?: Embedder;
  store?: VectorStore;
  fetch?: typeof fetch;
}

/**
 * `blazeresolver index`: puts the product's docs in its vector database now: the README (on disk, else GitHub) and any
 * docs files, each file its own source. Blazzy retrieves from all of them, including files no handler was given.
 * Safe to re-run: only new or changed sections are embedded, and sections a source no longer has are deleted.
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

  // Named by their path from the repo root (real paths, so symlinks can't make two names for one file), the same
  // whichever folder this is run from.
  const root = realpathSync(repoRoot(process.cwd()));
  const files: DocSource[] = (opts.docs ?? []).map((file) => ({
    name: `file:${relative(root, realpathSync(file)).split('\\').join('/')}`,
    text: readFileSync(file, 'utf8')
  }));
  // Only the README: the handlers' help docs are theirs to keep in sync.
  const readme = (await loadSources({ readme: opts.repo ? { repo: opts.repo, token: env.BLAZE_GITHUB_TOKEN, fetch: opts.fetch } : undefined })).filter((s) => s.name === 'readme');
  const sources = [...readme, ...files].filter((s) => s.text.trim());
  if (!sources.length) {
    throw new Error(
      'Found nothing to index: no README at the root of this repo' +
        (opts.repo ? `, none readable on GitHub for ${opts.repo}` : '') +
        ', and no --docs files. Write a README.md for your product, or pass --docs <file>.'
    );
  }

  const r = await syncSources(sources, { embedder, store });
  let dropped: string[] = [];
  if (opts.prune) {
    const given = new Set(sources.map((s) => s.name));
    dropped = (await store.sources()).filter((name) => name.startsWith('file:') && !given.has(name));
    for (const name of dropped) r.removed += await store.prune(name, []);
  }
  const all = await store.sources();
  return [
    `Vector database: ${store.location ?? 'your vector store'}`,
    `  indexed ${sources.map((s) => s.name).join(', ')}: ${r.sections} sections, ${r.embedded} embedded now, ${r.reused} already stored` +
      (r.removed ? `, ${r.removed} removed` : ''),
    ...(dropped.length ? [`  dropped ${dropped.join(', ')}`] : []),
    `  sources Blazzy retrieves from: ${all.join(', ')}`,
    `  embeddings: ${embedder.id}`,
    r.embedded || r.removed ? '  Blazzy now retrieves these by meaning as well as by keywords.' : '  Nothing changed since the last index.'
  ].join('\n');
}
