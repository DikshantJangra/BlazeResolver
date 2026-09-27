/**
 * The vector database a product's help docs are retrieved from (RAG). It holds every section of the docs: its source
 * (`readme`, `help-docs`, `saved-replies`, `file:docs/guide.md`), headings, text and embedding, and answers
 * nearest-neighbour queries itself: the similarity is computed inside the database, and the best sections come back.
 *
 * By default each product gets its own SQLite file, `.blazeresolver/vectors.db` at the root of its repo, through
 * Node's built-in SQLite: nothing to install or run. Or keep it in a database the product already has:
 * `sqliteVectorStore(db)` (better-sqlite3, node:sqlite) or `postgresVectorStore(query)` (postgres.js, node-postgres).
 *
 * Each section's id is a hash of the embeddings model and its text, so a changed section gets a new vector and an
 * unchanged one is never embedded again. Search is exact (every section is scored): help docs are hundreds of
 * sections, where an approximate index would only lose matches.
 */
import { builtin } from './runtime.js';
import { VECTOR_DIR, gitignoreAddition } from './gitignore.js';

/** A section of the docs, as the vector database keeps it. */
export interface StoredSection {
  /** Hash of the embeddings model and the section's headings and text. */
  id: string;
  /** Where the section came from: `readme`, `help-docs`, `saved-replies`, `file:<path>`. */
  source: string;
  /** The embeddings model that made the vector, e.g. `openai:text-embedding-3-small`. */
  embedder: string;
  headings: string[];
  text: string;
  /** Unit length, so the dot product of two vectors is their cosine similarity. */
  vector: number[];
}

/** A section a query found, most alike first. */
export interface SectionMatch {
  id: string;
  source: string;
  headings: string[];
  text: string;
  /** Cosine similarity to the query, -1 to 1. */
  score: number;
}

export interface QueryOptions {
  /** Only sections embedded by this model: vectors of different models can't be compared. */
  embedder: string;
  /** How many sections to return. */
  k: number;
  /** Sections less alike than this are left out. */
  minScore?: number;
  /** Sources to leave out (the widget doesn't answer from the desk's saved replies). */
  exclude?: string[];
}

export interface VectorStore {
  /** Vectors already stored for these ids, in any source: a section is embedded once, wherever it appears. */
  get(ids: string[]): Promise<Map<string, number[]>>;
  /** Adds sections, or replaces those with the same source and id. */
  upsert(rows: StoredSection[]): Promise<void>;
  /** Deletes the sections of `source` whose id isn't in `keep` (the docs changed); returns how many went. */
  prune(source: string, keep: string[]): Promise<number>;
  /** Every source the database holds sections of. */
  sources(): Promise<string[]>;
  /** The `k` stored sections most like `vector`, computed in the database. */
  query(vector: number[], options: QueryOptions): Promise<SectionMatch[]>;
  /** Where it keeps them, for messages (a file path, or a description). */
  location?: string;
}

const DEFAULT_TABLE = 'blazeresolver_sections';
/** Most ids per IN (...) list; SQLite's default limit on bound parameters is far above this. */
const BATCH = 500;

function tableName(table: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error(`invalid table name: ${table}`);
  return table;
}

/** Vectors are kept as float32 bytes: compact, and read back without parsing. */
function toBytes(vector: number[]): Uint8Array {
  const bytes = new Uint8Array(new Float32Array(vector).buffer);
  const B = (globalThis as any).Buffer;
  // better-sqlite3 binds a Buffer as a BLOB; node:sqlite takes any Uint8Array.
  return B ? B.from(bytes.buffer, bytes.byteOffset, bytes.byteLength) : bytes;
}

function floats(value: unknown): Float32Array | undefined {
  if (!(value instanceof Uint8Array) || value.byteLength % 4) return undefined;
  // Copied when a driver's Buffer starts at an offset that isn't a multiple of 4.
  return value.byteOffset % 4 ? new Float32Array(new Uint8Array(value).buffer) : new Float32Array(value.buffer, value.byteOffset, value.byteLength / 4);
}

/** The similarity function the database runs: the dot product of two float32 vectors (cosine, as both are unit length). */
function dotBytes(a: unknown, b: unknown): number | null {
  const x = floats(a);
  const y = floats(b);
  if (!x || !y || x.length !== y.length) return null;
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * y[i];
  return s;
}

const parseHeadings = (value: unknown): string[] => {
  try {
    const h = JSON.parse(String(value ?? '[]'));
    return Array.isArray(h) ? h.map(String) : [];
  } catch {
    return [];
  }
};

/** The part of a better-sqlite3 or node:sqlite database this uses. */
export interface SqliteDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): { run(...params: unknown[]): unknown; all(...params: unknown[]): unknown[] };
  /** Registers a SQL function; both drivers have it. Without it, similarity is computed after reading the rows. */
  function?(name: string, options: { deterministic?: boolean }, fn: (...args: any[]) => unknown): unknown;
}

const SQL_DOT = 'blazeresolver_dot';

/** A vector database in a SQLite database: better-sqlite3's `Database`, or node:sqlite's `DatabaseSync`. */
export function sqliteVectorStore(db: SqliteDatabase, options: { table?: string } = {}): VectorStore {
  const table = tableName(options.table ?? DEFAULT_TABLE);
  db.exec(
    `CREATE TABLE IF NOT EXISTS ${table} (source TEXT NOT NULL, id TEXT NOT NULL, embedder TEXT NOT NULL, ` +
      'headings TEXT NOT NULL, text TEXT NOT NULL, dims INTEGER NOT NULL, vector BLOB NOT NULL, updated_at INTEGER NOT NULL, ' +
      'PRIMARY KEY (source, id))'
  );
  db.exec(`CREATE INDEX IF NOT EXISTS ${table}_by_embedder ON ${table} (embedder, dims)`);
  db.exec(`CREATE INDEX IF NOT EXISTS ${table}_by_id ON ${table} (id)`);
  let inDatabase = false;
  try {
    db.function?.(SQL_DOT, { deterministic: true }, dotBytes);
    inDatabase = typeof db.function === 'function';
  } catch {
    // an older driver: scored after reading the rows
  }
  const upsert = db.prepare(
    `INSERT OR REPLACE INTO ${table} (source, id, embedder, headings, text, dims, vector, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const transaction = (run: () => void) => {
    db.exec('BEGIN');
    try {
      run();
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  return {
    async get(ids) {
      const found = new Map<string, number[]>();
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const rows = db.prepare(`SELECT id, vector FROM ${table} WHERE id IN (${batch.map(() => '?').join(', ')})`).all(...batch) as {
          id: string;
          vector: unknown;
        }[];
        for (const row of rows) {
          const v = floats(row.vector);
          if (v && !found.has(row.id)) found.set(row.id, [...v]);
        }
      }
      return found;
    },
    async upsert(rows) {
      if (!rows.length) return;
      const now = Date.now();
      transaction(() => {
        for (const r of rows) upsert.run(r.source, r.id, r.embedder, JSON.stringify(r.headings), r.text, r.vector.length, toBytes(r.vector), now);
      });
    },
    async prune(source, keep) {
      const stored = (db.prepare(`SELECT id FROM ${table} WHERE source = ?`).all(source) as { id: string }[]).map((r) => r.id);
      const keepSet = new Set(keep);
      const stale = stored.filter((id) => !keepSet.has(id));
      if (stale.length) {
        const del = db.prepare(`DELETE FROM ${table} WHERE source = ? AND id = ?`);
        transaction(() => {
          for (const id of stale) del.run(source, id);
        });
      }
      return stale.length;
    },
    async sources() {
      return (db.prepare(`SELECT DISTINCT source FROM ${table} ORDER BY source`).all() as { source: string }[]).map((r) => r.source);
    },
    async query(vector, { embedder, k, minScore = -1, exclude = [] }) {
      const q = toBytes(vector);
      const notIn = exclude.length ? ` AND source NOT IN (${exclude.map(() => '?').join(', ')})` : '';
      let rows: { id: string; source: string; headings: string; text: string; score: number | null }[];
      if (inDatabase) {
        // The database scores every section and returns the best: exact nearest neighbours.
        rows = db
          .prepare(
            `SELECT id, source, headings, text, score FROM (SELECT id, source, headings, text, ${SQL_DOT}(vector, ?) AS score ` +
              `FROM ${table} WHERE embedder = ? AND dims = ?${notIn}) WHERE score >= ? ORDER BY score DESC LIMIT ?`
          )
          .all(q, embedder, vector.length, ...exclude, minScore, k * 2) as typeof rows;
      } else {
        rows = (
          db.prepare(`SELECT id, source, headings, text, vector FROM ${table} WHERE embedder = ? AND dims = ?${notIn}`).all(embedder, vector.length, ...exclude) as {
            id: string;
            source: string;
            headings: string;
            text: string;
            vector: unknown;
          }[]
        )
          .map((r) => ({ ...r, score: dotBytes(r.vector, q) }))
          .filter((r) => r.score !== null && r.score >= minScore)
          .sort((a, b) => b.score! - a.score!)
          .slice(0, k * 2);
      }
      return distinct(rows.map((r) => ({ id: r.id, source: r.source, headings: parseHeadings(r.headings), text: r.text, score: Number(r.score) })), k);
    }
  };
}

/** The same section can sit in two sources (a README pasted into helpDocs): it's returned once. */
function distinct(matches: SectionMatch[], k: number): SectionMatch[] {
  const seen = new Set<string>();
  return matches.filter((m) => !seen.has(m.id) && seen.add(m.id)).slice(0, k);
}

/**
 * A vector database in Postgres, through any client's query function: `(text, params) => rows`.
 *   postgres.js:    postgresVectorStore((text, params) => sql.unsafe(text, params))
 *   node-postgres:  postgresVectorStore((text, params) => pool.query(text, params).then((r) => r.rows))
 * Vectors are a `real[]` column and scored in SQL, so no extension (such as pgvector) is needed.
 */
export function postgresVectorStore(query: (text: string, params: unknown[]) => Promise<any[]>, options: { table?: string } = {}): VectorStore {
  const table = tableName(options.table ?? DEFAULT_TABLE);
  let ready: Promise<unknown> | undefined;
  const ensure = () =>
    (ready ??= (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS ${table} (source TEXT NOT NULL, id TEXT NOT NULL, embedder TEXT NOT NULL, headings TEXT NOT NULL, ` +
          'text TEXT NOT NULL, dims INTEGER NOT NULL, vector REAL[] NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
          'PRIMARY KEY (source, id))',
        []
      );
      await query(`CREATE INDEX IF NOT EXISTS ${table}_by_embedder ON ${table} (embedder, dims)`, []);
    })().catch((err) => {
      ready = undefined;
      throw err;
    }));
  return {
    async get(ids) {
      await ensure();
      const found = new Map<string, number[]>();
      for (let i = 0; i < ids.length; i += BATCH) {
        const rows = await query(`SELECT DISTINCT ON (id) id, vector FROM ${table} WHERE id = ANY($1::text[])`, [ids.slice(i, i + BATCH)]);
        for (const row of rows) if (Array.isArray(row.vector)) found.set(row.id, row.vector.map(Number));
      }
      return found;
    },
    async upsert(rows) {
      if (!rows.length) return;
      await ensure();
      for (const r of rows) {
        await query(
          `INSERT INTO ${table} (source, id, embedder, headings, text, dims, vector) VALUES ($1, $2, $3, $4, $5, $6, $7::real[]) ` +
            'ON CONFLICT (source, id) DO UPDATE SET embedder = EXCLUDED.embedder, headings = EXCLUDED.headings, text = EXCLUDED.text, ' +
            'dims = EXCLUDED.dims, vector = EXCLUDED.vector, updated_at = now()',
          [r.source, r.id, r.embedder, JSON.stringify(r.headings), r.text, r.vector.length, r.vector]
        );
      }
    },
    async prune(source, keep) {
      await ensure();
      const rows = await query(`DELETE FROM ${table} WHERE source = $1 AND NOT (id = ANY($2::text[])) RETURNING id`, [source, keep]);
      return rows.length;
    },
    async sources() {
      await ensure();
      return (await query(`SELECT DISTINCT source FROM ${table} ORDER BY source`, [])).map((r) => String(r.source));
    },
    async query(vector, { embedder, k, minScore = -1, exclude = [] }) {
      await ensure();
      // Scored in SQL: the dot product of the stored and the query vector, element by element.
      const rows = await query(
        `SELECT t.id, t.source, t.headings, t.text, s.score FROM ${table} t, ` +
          'LATERAL (SELECT sum(a * b) AS score FROM unnest(t.vector, $1::real[]) AS u(a, b)) s ' +
          'WHERE t.embedder = $2 AND t.dims = $3 AND NOT (t.source = ANY($4::text[])) AND s.score >= $5 ORDER BY s.score DESC LIMIT $6',
        [vector, embedder, vector.length, exclude, minScore, k * 2]
      );
      return distinct(
        rows.map((r) => ({ id: String(r.id), source: String(r.source), headings: parseHeadings(r.headings), text: String(r.text), score: Number(r.score) })),
        k
      );
    }
  };
}

type Fs = typeof import('node:fs');
type Path = typeof import('node:path');

/** Stores already opened, by file, so every handler in a process shares one connection per file. */
const opened = new Map<string, VectorStore | null>();

/**
 * The default store: a SQLite file through Node's built-in SQLite. `path` defaults to BLAZE_VECTOR_DB, else
 * `.blazeresolver/vectors.db` at the root of the enclosing git repo (or the working directory), falling back to the
 * temp directory where that can't be written (read-only serverless filesystems). Undefined when there's no disk or no
 * built-in SQLite; search then keeps vectors in memory only.
 */
export function localVectorStore(options: { path?: string } = {}): VectorStore | undefined {
  const fs = builtin<Fs>('node:fs');
  const path = builtin<Path>('node:path');
  const os = builtin<typeof import('node:os')>('node:os');
  const proc = (globalThis as any).process;
  if (!fs || !path || !proc?.cwd) return undefined;

  const configured = options.path ?? proc.env?.BLAZE_VECTOR_DB;
  const candidates = configured
    ? [path.resolve(configured)]
    : [path.join(projectRoot(fs, path, proc.cwd()), '.blazeresolver', 'vectors.db'), ...(os ? [path.join(os.tmpdir(), 'blazeresolver', 'vectors.db')] : [])];

  for (const file of candidates) {
    if (opened.has(file)) {
      const store = opened.get(file);
      if (store) return store;
      continue;
    }
    const store = openSqliteFile(fs, path, file);
    opened.set(file, store ?? null);
    if (store) return store;
  }
  return undefined;
}

/**
 * The store handlers use by default: `localVectorStore()`, opened on first use rather than when the handler is created,
 * so building or importing an app (Next.js evaluates route modules while it builds) never touches the disk.
 */
export function defaultVectorStore(): VectorStore {
  let store: VectorStore | undefined | null = null;
  const open = () => (store === null ? (store = localVectorStore()) : store);
  const none = () => new Error("the vector database couldn't be opened (no writable disk, or no node:sqlite)");
  const use = <T>(run: (s: VectorStore) => Promise<T>): Promise<T> => {
    const s = open();
    return s ? run(s) : Promise.reject(none());
  };
  return {
    get: (ids) => use((s) => s.get(ids)),
    upsert: (rows) => use((s) => s.upsert(rows)),
    prune: (source, keep) => use((s) => s.prune(source, keep)),
    sources: () => use((s) => s.sources()),
    query: (vector, options) => use((s) => s.query(vector, options)),
    get location() {
      return open()?.location;
    }
  };
}

/**
 * Keeps the vector database out of the product's commits: `.blazeresolver/` in the repo's root .gitignore (added here
 * for products installed without `init`), and a `*` .gitignore inside the folder, which holds even if that line is
 * later removed. Never fails the store: a read-only checkout just keeps what it has.
 */
function keepOutOfGit(fs: Fs, path: Path, dir: string) {
  try {
    const inner = path.join(dir, '.gitignore');
    if (!fs.existsSync(inner)) fs.writeFileSync(inner, '*\n');
    const root = path.dirname(dir);
    // Only in a git checkout: a deployed copy has no commits to keep it out of.
    if (!fs.existsSync(path.join(root, '.git'))) return;
    const gitignore = path.join(root, '.gitignore');
    const existing = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : undefined;
    const addition = gitignoreAddition(existing);
    if (!addition) return;
    fs.appendFileSync(gitignore, addition);
    console.warn(`[blazeresolver] added ${VECTOR_DIR}/ to ${gitignore}, so the docs' vector database is never committed.`);
  } catch {
    // read-only, or not ours to change
  }
}

function projectRoot(fs: Fs, path: Path, from: string): string {
  let dir = from;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return from;
}

function openSqliteFile(fs: Fs, path: Path, file: string): VectorStore | undefined {
  // Loaded only when a store is actually opened: node:sqlite prints an experimental warning on some Node versions.
  const sqlite = builtin<{ DatabaseSync: new (file: string) => SqliteDatabase }>('node:sqlite');
  if (!sqlite) return undefined;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new sqlite.DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 2000');
    if (path.basename(path.dirname(file)) === VECTOR_DIR) keepOutOfGit(fs, path, path.dirname(file));
    // The first layout kept only vectors, in a table the sections table replaces; in our own file it can simply go.
    db.exec('DROP TABLE IF EXISTS blazeresolver_vectors');
    return { ...sqliteVectorStore(db), location: file };
  } catch {
    return undefined;
  }
}
