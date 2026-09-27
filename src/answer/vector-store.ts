/**
 * Where the vectors of a product's docs are kept, so they're embedded once, not on every restart or cold start, and
 * shared by every instance using the same store. Keyed by a hash of the embedder and the section's text, so a changed
 * section gets a new vector and unchanged ones are reused.
 *
 * By default each product gets its own SQLite file, `.blazeresolver/vectors.db` at the root of its repo, through
 * Node's built-in SQLite: nothing to install or run. Or pass a store over a database the product already has:
 * `sqliteVectorStore(db)` (better-sqlite3, node:sqlite) or `postgresVectorStore(query)` (postgres.js, node-postgres).
 *
 * Similarity is computed in memory over the product's own sections, exactly; help docs are small enough (hundreds of
 * sections) that an approximate index would gain nothing. A store only has to keep vectors and give them back.
 */
import { builtin } from './runtime.js';
import { VECTOR_DIR, gitignoreAddition } from './gitignore.js';

export interface StoredVector {
  /** Hash of the embedder id and the section text. */
  id: string;
  /** The embedder that made it, e.g. `openai:text-embedding-3-small`. */
  embedder: string;
  /** The section it's the vector of, for inspecting the store. */
  text: string;
  vector: number[];
}

export interface VectorStore {
  /** The stored vectors among `ids`, by id. Ids it doesn't have are left out. */
  get(ids: string[]): Promise<Map<string, number[]>>;
  /** Stores vectors, replacing any with the same id. */
  set(rows: StoredVector[]): Promise<void>;
}

const DEFAULT_TABLE = 'blazeresolver_vectors';
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

function fromBytes(value: unknown): number[] | undefined {
  if (!(value instanceof Uint8Array) || value.byteLength % 4) return undefined;
  // Copied, since a Buffer from a driver may start at an offset that isn't a multiple of 4.
  return [...new Float32Array(new Uint8Array(value).buffer)];
}

/** The part of a better-sqlite3 or node:sqlite database this uses. */
export interface SqliteDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): { run(...params: unknown[]): unknown; all(...params: unknown[]): unknown[] };
}

/** A store in a SQLite database the product already has (better-sqlite3's `Database`, or node:sqlite's `DatabaseSync`). */
export function sqliteVectorStore(db: SqliteDatabase, options: { table?: string } = {}): VectorStore {
  const table = tableName(options.table ?? DEFAULT_TABLE);
  db.exec(
    `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, embedder TEXT NOT NULL, text TEXT NOT NULL, ` +
      'dims INTEGER NOT NULL, vector BLOB NOT NULL, created_at INTEGER NOT NULL)'
  );
  const insert = db.prepare(`INSERT OR REPLACE INTO ${table} (id, embedder, text, dims, vector, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
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
          const vector = fromBytes(row.vector);
          if (vector) found.set(row.id, vector);
        }
      }
      return found;
    },
    async set(rows) {
      if (!rows.length) return;
      db.exec('BEGIN');
      try {
        const now = Date.now();
        for (const r of rows) insert.run(r.id, r.embedder, r.text, r.vector.length, toBytes(r.vector), now);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    }
  };
}

/**
 * A store in Postgres, through any client's query function: `(text, params) => rows`.
 *   postgres.js:    postgresVectorStore((text, params) => sql.unsafe(text, params))
 *   node-postgres:  postgresVectorStore((text, params) => pool.query(text, params).then((r) => r.rows))
 * Vectors are a `real[]` column, so no extension (such as pgvector) is needed.
 */
export function postgresVectorStore(query: (text: string, params: unknown[]) => Promise<any[]>, options: { table?: string } = {}): VectorStore {
  const table = tableName(options.table ?? DEFAULT_TABLE);
  let ready: Promise<unknown> | undefined;
  const ensure = () =>
    (ready ??= query(
      `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, embedder TEXT NOT NULL, text TEXT NOT NULL, ` +
        'dims INTEGER NOT NULL, vector REAL[] NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())',
      []
    ).catch((err) => {
      ready = undefined;
      throw err;
    }));
  return {
    async get(ids) {
      await ensure();
      const found = new Map<string, number[]>();
      for (let i = 0; i < ids.length; i += BATCH) {
        const rows = await query(`SELECT id, vector FROM ${table} WHERE id = ANY($1::text[])`, [ids.slice(i, i + BATCH)]);
        for (const row of rows) if (Array.isArray(row.vector)) found.set(row.id, row.vector.map(Number));
      }
      return found;
    },
    async set(rows) {
      if (!rows.length) return;
      await ensure();
      for (const r of rows) {
        await query(
          `INSERT INTO ${table} (id, embedder, text, dims, vector) VALUES ($1, $2, $3, $4, $5::real[]) ` +
            'ON CONFLICT (id) DO UPDATE SET vector = EXCLUDED.vector, dims = EXCLUDED.dims',
          [r.id, r.embedder, r.text, r.vector.length, r.vector]
        );
      }
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
  return {
    get: async (ids) => (await open()?.get(ids)) ?? new Map(),
    set: async (rows) => {
      await open()?.set(rows);
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
    return sqliteVectorStore(db);
  } catch {
    return undefined;
  }
}
