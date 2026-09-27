/**
 * Retrieval over a product's help docs: split into sections, ranked against a question.
 * `retrieve` is keyword ranking (BM25): no API, same result every time. `search` adds semantic ranking when an
 * embedder is configured, fused with the keyword ranking (reciprocal rank fusion), so "delete my account" also finds
 * a section that only says "close". Section vectors are computed once and kept in memory; any failure or slowness
 * in the embeddings provider falls back to keyword ranking alone.
 */
import type { Embedder } from './embed.js';


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
  const chunks = chunkDocs(docs);
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
// Semantic ranking
// ---------------------------------------------------------------------------------------------------------------

/**
 * Section vectors, by embedder and section text, so editing one section of the docs only embeds that section again.
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

/** Vectors for every chunk; the missing ones are embedded in one call. */
function chunkVectors(chunks: Chunk[], embedder: Embedder): Promise<number[][]> {
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

/** Sections at least `minSimilarity` like the question, most alike first. */
async function rankSemantic(index: Index, question: string, embedder: Embedder, minSimilarity: number): Promise<Ranked[]> {
  const [docVectors, [query]] = await Promise.all([chunkVectors(index.chunks, embedder), embedder.embed([question], 'query')]);
  const q = unit(query);
  return docVectors
    .map((v, i) => ({ i, score: dot(q, v) }))
    .filter((r) => r.score >= minSimilarity)
    .sort((a, b) => b.score - a.score);
}

export interface SearchOptions {
  /** How many sections to return. Default 4. */
  k?: number;
  /** Adds semantic ranking. Without one, `search` is `retrieve`. */
  embedder?: Embedder;
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

/**
 * The `k` sections that best match the question, best first: keyword and semantic rankings fused, or keywords alone
 * without an embedder or when it fails. Empty when nothing matches either way.
 */
export async function search(docs: string, question: string, options: SearchOptions = {}): Promise<Chunk[]> {
  const k = options.k ?? 4;
  const index = indexFor(docs);
  const lexical = rankLexical(index, question);
  const embedder = options.embedder;
  if (!embedder || !index.chunks.length || (downUntil.get(embedder.id) ?? 0) > Date.now()) {
    return lexical.slice(0, k).map((r) => index.chunks[r.i]);
  }

  const envMin = Number((globalThis as any).process?.env?.BLAZE_EMBED_MIN_SIMILARITY);
  const minSimilarity = options.minSimilarity ?? (Number.isFinite(envMin) && envMin > 0 ? envMin : 0.25);
  let semantic: Ranked[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('embeddings timed out')), options.timeoutMs ?? 4_000);
    });
    semantic = await Promise.race([rankSemantic(index, question, embedder, minSimilarity), timeout]);
  } catch (err) {
    // A timeout only means the docs are still being embedded; anything else is the provider failing.
    if (!(err instanceof Error && err.message === 'embeddings timed out')) markDown(embedder, err);
  } finally {
    clearTimeout(timer);
  }

  const fused = new Map<number, number>();
  for (const ranking of [lexical, semantic]) {
    ranking.slice(0, k * 3).forEach((r, rank) => fused.set(r.i, (fused.get(r.i) ?? 0) + 1 / (RRF_K + rank + 1)));
  }
  return [...fused]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([i]) => index.chunks[i]);
}
