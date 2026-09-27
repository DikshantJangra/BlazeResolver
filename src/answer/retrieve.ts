/**
 * Retrieval over a product's help docs: split into sections, ranked against a question with BM25.
 * Keyword ranking needs no embeddings API or vector store, so it runs anywhere the handler does and gives the same
 * result every time. ponytail: lexical only, so "delete my account" won't find a section that only says "close";
 * add embeddings (hybrid ranking) when docs use very different words from customers.
 */

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

/** The `k` sections that best match the question, best first. Sections sharing no term with it are never returned. */
export function retrieve(docs: string, question: string, k = 4): Chunk[] {
  const index = indexFor(docs);
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
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => index.chunks[r.i]);
}
