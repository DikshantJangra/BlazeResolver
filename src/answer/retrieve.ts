/**
 * Retrieval over a product's help docs: split into sections, ranked against a question.
 * `retrieve` is keyword ranking (BM25): no API, same result every time. `search` adds semantic ranking when an
 * embedder is configured, fused with the keyword ranking (reciprocal rank fusion), so "delete my account" also finds
 * a section that only says "close". Section vectors are computed once and kept in memory; any failure or slowness
 * in the embeddings provider falls back to keyword ranking alone.
 */
import type { Embedder } from './embed.js';
import type { VectorStore } from './vector-store.js';


export interface Chunk {
  /** The headings the chunk sits under, outermost first. */
  headings: string[];
  text: string;
}

const MAX_CHUNK = 1200;

/** Splits Markdown or plain text into sections of at most ~MAX_CHUNK characters, each tagged with its headings. */
export function chunkDocs(docs: string): Chunk[] {
  const chunks: Chunk[] = [];
  const headings: string[] = [];
  let buffer: string[] = [];
  let size = 0;
  const flush = () => {
    const text = buffer.join('\n\n').trim();
    // Docs that skip a level (## with no #) leave holes in the heading path.
    if (text) chunks.push({ headings: headings.filter(Boolean), text });
    buffer = [];
    size = 0;
  };

  for (const block of docs.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(block.trim().split('\n')[0]);
    let body = block.trim();
    if (heading) {
      flush();
      headings.length = Math.min(headings.length, heading[1].length - 1);
      headings[heading[1].length - 1] = heading[2];
      body = body.split('\n').slice(1).join('\n').trim();
      if (!body) continue;
    }
    // A single paragraph longer than a chunk is cut at a line break, else a space, else mid-word.
    for (let rest = body; rest; ) {
      let piece = rest;
      if (piece.length > MAX_CHUNK) {
        const line = piece.lastIndexOf('\n', MAX_CHUNK);
        const space = piece.lastIndexOf(' ', MAX_CHUNK);
        const cut = line > MAX_CHUNK / 2 ? line : space > MAX_CHUNK / 2 ? space : MAX_CHUNK;
        piece = piece.slice(0, cut);
      }
      rest = rest.slice(piece.length).trim();
      if (size + piece.length > MAX_CHUNK) flush();
      buffer.push(piece.trim());
      size += piece.length;
    }
  }
  flush();
  return chunks;
}

const STOPWORDS = new Set(
  ('a an and are as at be by can could do does for from get got have how i if in into is it its me my of on or our so ' +
    'that the their them then there these this to was we what when where which who why will with would you your ' +
    'please hi hello thanks thank want need way able').split(' ')
);

/** Crude suffix stripping, so "exporting", "exports" and "exported" all match "export". */
function stem(word: string): string {
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOPWORDS.has(w)).map(stem);
}

interface Index {
  chunks: Chunk[];
  terms: Map<string, number>[];
  lengths: number[];
  avgLength: number;
  docFreq: Map<string, number>;
}

function buildIndex(docs: string): Index {
  return indexChunks(chunkDocs(docs));
}

function indexChunks(chunks: Chunk[]): Index {
  const terms = chunks.map((c) => {
    const counts = new Map<string, number>();
    // Headings count twice: they say what a section is about.
    for (const t of [...tokenize(c.headings.join(' ')), ...tokenize(c.headings.join(' ')), ...tokenize(c.text)]) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return counts;
  });
  const lengths = terms.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
  const docFreq = new Map<string, number>();
  for (const m of terms) for (const t of m.keys()) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  return { chunks, terms, lengths, avgLength: lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1), docFreq };
}

/** The same docs arrive with every question, so their index is kept. */
const indexes = new Map<string, Index>();
function indexFor(docs: string): Index {
  let index = indexes.get(docs);
  if (!index) {
    if (indexes.size >= 20) indexes.delete(indexes.keys().next().value!);
    index = buildIndex(docs);
    indexes.set(docs, index);
  }
  return index;
}

interface Ranked {
  i: number;
  score: number;
}

/** BM25 over the index; only sections sharing a term with the question. Best first. */
function rankLexical(index: Index, question: string): Ranked[] {
  const query = [...new Set(tokenize(question))];
  const n = index.chunks.length;
  const K1 = 1.2;
  const B = 0.75;

  return index.terms
    .map((counts, i) => {
      let score = 0;
      for (const term of query) {
        const tf = counts.get(term);
        if (!tf) continue;
        const df = index.docFreq.get(term)!;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * index.lengths[i]) / index.avgLength));
      }
      return { i, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** The `k` sections that best match the question by keywords, best first. Sections sharing no term with it are never returned. */
export function retrieve(docs: string, question: string, k = 4): Chunk[] {
  const index = indexFor(docs);
  return rankLexical(index, question)
    .slice(0, k)
    .map((r) => index.chunks[r.i]);
}

// ---------------------------------------------------------------------------------------------------------------
// Sources: the docs, by where they came from
// ---------------------------------------------------------------------------------------------------------------

/** Docs from one place: `readme`, `help-docs`, `saved-replies`, `file:docs/guide.md`. */
export interface DocSource {
  name: string;
  text: string;
}

/** A section, with the source it came from. */
export interface SourcedChunk extends Chunk {
  source: string;
}

/**
 * Each source is split on its own, so a README's headings never nest under the help docs' last one, and every section
 * knows where it came from.
 */
function sourceChunks(sources: DocSource[]): SourcedChunk[] {
  return sources.flatMap((s) => chunkDocs(s.text).map((c) => ({ ...c, source: s.name })));
}

const sourceIndexes = new Map<string, { index: Index; chunks: SourcedChunk[] }>();
function indexForSources(sources: DocSource[]): { index: Index; chunks: SourcedChunk[] } {
  const key = sources.map((s) => `${s.name}\u0000${s.text}`).join('\u0001');
  let hit = sourceIndexes.get(key);
  if (!hit) {
    if (sourceIndexes.size >= 20) sourceIndexes.delete(sourceIndexes.keys().next().value!);
    const chunks = sourceChunks(sources);
    hit = { index: indexChunks(chunks), chunks };
    sourceIndexes.set(key, hit);
  }
  return hit;
}

// An empty source is kept: syncing it clears that source from the vector database (every saved reply was deleted).
const asSources = (docs: string | DocSource[]): DocSource[] => (typeof docs === 'string' ? [{ name: 'docs', text: docs }] : docs);

// ---------------------------------------------------------------------------------------------------------------
// Semantic ranking
// ---------------------------------------------------------------------------------------------------------------

/**
 * Section vectors kept in memory when there's no vector database (no writable disk): by embedder and section text.
 * Unit length, so cosine similarity is a dot product. A failed embedding is dropped, to be tried again.
 */
const vectors = new Map<string, Promise<number[]>>();
const MAX_VECTORS = 10_000;
/** An embedder that just failed is left alone for a minute, so every question doesn't wait on it. */
const downUntil = new Map<string, number>();
const DOWN_MS = 60_000;

const chunkText = (c: Chunk) => (c.headings.length ? `${c.headings.join(' > ')}\n${c.text}` : c.text);

function unit(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
}

function markDown(embedder: Embedder, err: unknown) {
  if (!downUntil.has(embedder.id) || downUntil.get(embedder.id)! < Date.now()) {
    console.warn(`[blazeresolver] embeddings (${embedder.id}) failed, using keyword search for a minute: ${err instanceof Error ? err.message : err}`);
  }
  downUntil.set(embedder.id, Date.now() + DOWN_MS);
}

/** Forgets what's kept in memory (vectors, and which sources are in sync), as a restart would. The database keeps its own. */
export function clearVectorCache(): void {
  vectors.clear();
  downUntil.clear();
  synced = new WeakMap();
}

/** A stable id for a section: a hash of the embeddings model and the section, so any change gets a new one. */
async function sectionId(embedder: Embedder, c: Chunk): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${embedder.id}\u0000${chunkText(c)}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** In memory, without a vector database: every section's vector, embedding those not yet embedded in one call. */
function memoryVectors(chunks: Chunk[], embedder: Embedder): Promise<number[][]> {
  const keys = chunks.map((c) => `${embedder.id}\u0000${chunkText(c)}`);
  const missing = [...new Set(keys.filter((key) => !vectors.has(key)))];
  if (missing.length) {
    const batch = embedder.embed(missing.map((key) => key.slice(key.indexOf('\u0000') + 1)), 'document');
    missing.forEach((key, n) => {
      const vector = batch.then((all) => unit(all[n]));
      vector.catch(() => {
        if (vectors.get(key) === vector) vectors.delete(key);
      });
      if (vectors.size >= MAX_VECTORS) vectors.delete(vectors.keys().next().value!);
      vectors.set(key, vector);
    });
  }
  return Promise.all(keys.map((key) => vectors.get(key)!));
}

// ---------------------------------------------------------------------------------------------------------------
// The vector database
// ---------------------------------------------------------------------------------------------------------------

export interface SyncResult {
  /** Sections the sources hold. */
  sections: number;
  /** Sections embedded now: new, or changed since they were last embedded. */
  embedded: number;
  /** Sections whose vectors the database already had. */
  reused: number;
  /** Sections the database dropped because the docs no longer have them. */
  removed: number;
}

/** Which version of each source every store is in sync with, and syncs in progress, so each happens once. */
let synced = new WeakMap<VectorStore, Map<string, { signature: string; done: Promise<SyncResult> }>>();

/**
 * Puts the sources into the vector database: every section is stored under its source, with a vector reused from the
 * database or embedded now, and sections a source no longer has are deleted. A source already in sync is skipped, so
 * this is cheap to call before every query. Throws when the embedder or the store fails.
 */
export async function syncSources(sources: DocSource[], options: { embedder: Embedder; store: VectorStore }): Promise<SyncResult> {
  const { embedder, store } = options;
  let perStore = synced.get(store);
  if (!perStore) synced.set(store, (perStore = new Map()));
  const results = await Promise.all(
    sources.map(async (source) => {
      const chunks = chunkDocs(source.text);
      const ids = await Promise.all(chunks.map((c) => sectionId(embedder, c)));
      const signature = `${embedder.id}\u0000${ids.join(',')}`;
      const current = perStore!.get(source.name);
      if (current?.signature === signature) {
        await current.done;
        return { sections: chunks.length, embedded: 0, reused: chunks.length, removed: 0 };
      }
      const done = syncSource(source.name, chunks, ids, embedder, store);
      perStore!.set(source.name, { signature, done });
      done.catch(() => {
        if (perStore!.get(source.name)?.done === done) perStore!.delete(source.name);
      });
      return done;
    })
  );
  return results.reduce((a, r) => ({ sections: a.sections + r.sections, embedded: a.embedded + r.embedded, reused: a.reused + r.reused, removed: a.removed + r.removed }), {
    sections: 0,
    embedded: 0,
    reused: 0,
    removed: 0
  });
}

async function syncSource(source: string, chunks: Chunk[], ids: string[], embedder: Embedder, store: VectorStore): Promise<SyncResult> {
  const unique = [...new Map(ids.map((id, n) => [id, chunks[n]])).entries()];
  const stored = await store.get(unique.map(([id]) => id));
  const todo = unique.filter(([id]) => !stored.has(id));
  const embedded = todo.length ? await embedder.embed(todo.map(([, c]) => chunkText(c)), 'document') : [];
  const fresh = new Map(todo.map(([id], j) => [id, unit(embedded[j])]));
  await store.upsert(
    unique.map(([id, c]) => ({ id, source, embedder: embedder.id, headings: c.headings, text: c.text, vector: stored.get(id) ?? fresh.get(id)! }))
  );
  const removed = await store.prune(source, unique.map(([id]) => id));
  return { sections: unique.length, embedded: todo.length, reused: unique.length - todo.length, removed };
}

export interface SearchOptions {
  /** How many sections to return. Default 4. */
  k?: number;
  /** Adds semantic ranking. Without one, `search` is keyword ranking alone. */
  embedder?: Embedder;
  /**
   * The vector database: sections are kept in it and retrieved from it by similarity, including sections of sources
   * this call wasn't given (docs indexed with `blazeresolver index --docs`). Without one, sections are embedded and
   * ranked in memory.
   */
  store?: VectorStore;
  /** Sources in the database to leave out of this search. */
  exclude?: string[];
  /**
   * How long to wait for embeddings before answering from keywords alone. Default 4s. The docs keep being embedded
   * in the background, so the next question gets the semantic ranking.
   */
  timeoutMs?: number;
  /** Cosine similarity below which a section doesn't count as a semantic match. Default 0.25, or BLAZE_EMBED_MIN_SIMILARITY. */
  minSimilarity?: number;
}

/** Reciprocal rank fusion's constant: how much the top few places count over the rest. */
const RRF_K = 60;

/** A section's identity across rankings: its headings and text. */
const keyOf = (c: Chunk) => chunkText(c);

/** Semantic matches, best first: from the vector database when there is one, else ranked in memory. */
async function semanticMatches(chunks: SourcedChunk[], sources: DocSource[], question: string, embedder: Embedder, options: SearchOptions, k: number, minSimilarity: number): Promise<SourcedChunk[]> {
  const queryVector = embedder.embed([question], 'query').then(([v]) => unit(v));
  const store = options.store;
  if (store) {
    // RAG over the vector database: the sources are brought in sync, then the database finds the nearest sections.
    const [q] = await Promise.all([queryVector, syncSources(sources, { embedder, store })]);
    const matches = await store.query(q, { embedder: embedder.id, k: k * 3, minScore: minSimilarity, exclude: options.exclude });
    return matches.map((m) => ({ headings: m.headings, text: m.text, source: m.source }));
  }
  const [q, docVectors] = await Promise.all([queryVector, memoryVectors(chunks, embedder)]);
  return docVectors
    .map((v, i) => ({ i, score: dot(q, v) }))
    .filter((r) => r.score >= minSimilarity)
    .sort((a, b) => b.score - a.score)
    .map((r) => chunks[r.i]);
}

/**
 * The `k` sections that best match the question, best first: keyword and semantic rankings fused (reciprocal rank
 * fusion), or keywords alone without an embedder or when it fails. With a vector database, the semantic ranking is the
 * database's nearest neighbours. Empty when nothing matches either way.
 */
export async function search(docs: string | DocSource[], question: string, options: SearchOptions = {}): Promise<Chunk[]> {
  const k = options.k ?? 4;
  const sources = asSources(docs);
  const { index, chunks } = indexForSources(sources);
  const lexical = rankLexical(index, question).map((r) => chunks[r.i]);
  const embedder = options.embedder;
  const plain = (c: SourcedChunk): Chunk => ({ headings: c.headings, text: c.text });
  if (!embedder || (!chunks.length && !options.store) || (downUntil.get(embedder.id) ?? 0) > Date.now()) {
    return lexical.slice(0, k).map(plain);
  }

  const envMin = Number((globalThis as any).process?.env?.BLAZE_EMBED_MIN_SIMILARITY);
  const minSimilarity = options.minSimilarity ?? (Number.isFinite(envMin) && envMin > 0 ? envMin : 0.25);
  let semantic: SourcedChunk[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('embeddings timed out')), options.timeoutMs ?? 4_000);
    });
    semantic = await Promise.race([semanticMatches(chunks, sources, question, embedder, options, k, minSimilarity), timeout]);
  } catch (err) {
    // A timeout only means the docs are still being embedded; anything else is the provider (or database) failing.
    if (!(err instanceof Error && err.message === 'embeddings timed out')) markDown(embedder, err);
  } finally {
    clearTimeout(timer);
  }

  const fused = new Map<string, { chunk: SourcedChunk; score: number }>();
  for (const ranking of [lexical, semantic]) {
    ranking.slice(0, k * 3).forEach((c, rank) => {
      const key = keyOf(c);
      const hit = fused.get(key);
      fused.set(key, { chunk: hit?.chunk ?? c, score: (hit?.score ?? 0) + 1 / (RRF_K + rank + 1) });
    });
  }
  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((f) => plain(f.chunk));
}
