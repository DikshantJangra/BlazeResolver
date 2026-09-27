import { after, describe, it } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDocs } from '../answer/index.js';
import { clearVectorCache, search } from '../answer/retrieve.js';
import { localVectorStore, postgresVectorStore, sqliteVectorStore, type SqliteDatabase, type VectorStore } from '../answer/vector-store.js';
import type { Embedder } from '../answer/embed.js';
import { createSupportHandler, SupportStore } from '../support/index.js';
import { GITIGNORE_BLOCK, gitignoreAddition } from '../answer/gitignore.js';
import { runInit } from '../cli/init.js';
import { runRemove } from '../cli/remove.js';
import { execFileSync } from 'node:child_process';

const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as { DatabaseSync: new (file: string) => SqliteDatabase & { close(): void } };

const home = process.cwd();
const dirs: string[] = [];
after(() => {
  process.chdir(home);
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A product's checkout: a README at its root, and a .git whose origin is `remote` (none when omitted: a deployed copy). */
function product(readme: string, remote?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'blaze-product-'));
  dirs.push(root);
  writeFileSync(join(root, 'README.md'), readme);
  if (remote) {
    mkdirSync(join(root, '.git'));
    writeFileSync(join(root, '.git', 'config'), `[remote "origin"]\n\turl = https://github.com/${remote}.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`);
  }
  return root;
}

/** A GitHub that serves `text` as every README, and counts how often it's asked. */
function github(text = '# From GitHub') {
  let calls = 0;
  const f = (async () => (calls++, new Response(text, { status: 200 }))) as unknown as typeof fetch;
  return { f, calls: () => calls };
}

describe("the product's README, read from its own checkout", () => {
  it('reads the README at the root of the checkout, without asking GitHub', async () => {
    const root = product('# Shop\n\n## Returns\n\nReturns are free within 30 days.', 'acme/shop');
    mkdirSync(join(root, 'apps', 'web'), { recursive: true });
    writeFileSync(join(root, 'apps', 'web', 'README.md'), '# create-next-app boilerplate');
    process.chdir(join(root, 'apps', 'web'));
    const gh = github();
    const docs = await loadDocs({ readme: { repo: 'acme/shop', fetch: gh.f } });
    assert.match(docs, /Returns are free within 30 days/, "the repo root's README, not the app folder's");
    assert.equal(gh.calls(), 0);
  });

  it('uses the working directory when deployed without .git, and needs no repo', async () => {
    process.chdir(product('# Deployed\n\nAll plans include support.'));
    assert.match(await loadDocs({}), /All plans include support/);
  });

  it("never answers one repo's questions from another checkout's README", async () => {
    process.chdir(product('# Some other product', 'acme/other'));
    const gh = github('# Shop from GitHub');
    assert.equal(await loadDocs({ readme: { repo: 'acme/shop', fetch: gh.f } }), '# Shop from GitHub');
    assert.equal(gh.calls(), 1);
  });

  it('picks up edits to the README, and can be pointed at a file or turned off', async () => {
    const root = product('# v1', 'acme/edits');
    process.chdir(root);
    assert.equal(await loadDocs({ readme: { repo: 'acme/edits' } }), '# v1');
    writeFileSync(join(root, 'README.md'), '# v2');
    utimesSync(join(root, 'README.md'), new Date(), new Date(Date.now() + 5_000));
    assert.equal(await loadDocs({ readme: { repo: 'acme/edits' } }), '# v2');

    writeFileSync(join(root, 'HELP.md'), '# Help file');
    assert.equal(await loadDocs({ readmePath: join(root, 'HELP.md') }), '# Help file');
    const gh = github('# GitHub copy');
    assert.equal(await loadDocs({ readme: { repo: 'acme/edits', fetch: gh.f }, readmePath: false }), '# GitHub copy');
  });
});

/** Embeds by counting a few concept words; records every document it embeds. */
function countingEmbedder(id: string) {
  const documents: string[] = [];
  const embedder: Embedder = {
    id,
    async embed(texts, kind) {
      if (kind === 'document') documents.push(...texts);
      return texts.map((t) => [/refund|return/gi, /ship|deliver/gi, /password|login/gi].map((re) => (t.match(re) ?? []).length + 0.01));
    }
  };
  return { embedder, documents };
}

const DOCS = '# Shop\n\n## Returns\n\nReturns and refunds within 30 days.\n\n## Shipping\n\nWe deliver in 2 days.\n\n## Account\n\nReset your password from the login page.';

describe('vector stores', () => {
  it('SQLite keeps vectors as float32 and gives them back by id', async () => {
    const store = sqliteVectorStore(new DatabaseSync(':memory:'));
    await store.set([{ id: 'a', embedder: 'e', text: 't', vector: [0.5, -0.25, 1] }]);
    await store.set([{ id: 'a', embedder: 'e', text: 't', vector: [1, 0, 0] }]);
    const found = await store.get(['a', 'missing']);
    assert.deepEqual([...found.keys()], ['a']);
    assert.deepEqual(found.get('a'), [1, 0, 0]);
  });

  it('embeds each section once, ever: after a restart the vectors come from the store', async () => {
    const store = sqliteVectorStore(new DatabaseSync(':memory:'));
    const { embedder, documents } = countingEmbedder('count-1');
    const [first] = await search(DOCS, 'how do I get a refund', { embedder, store, k: 1 });
    assert.match(first.text, /refunds within 30 days/);
    assert.equal(documents.length, 3);

    clearVectorCache();
    const [again] = await search(DOCS, 'when will you deliver', { embedder, store, k: 1 });
    assert.match(again.text, /deliver in 2 days/);
    assert.equal(documents.length, 3, 'nothing embedded again');

    clearVectorCache();
    await search(`${DOCS}\n\n## Gift cards\n\nGift cards never expire.`, 'gift card', { embedder, store });
    assert.deepEqual(documents.slice(3), ['Shop > Gift cards\nGift cards never expire.'], 'only the new section');
  });

  it('still answers when the store fails', async () => {
    const broken: VectorStore = {
      get: async () => { throw new Error('disk full'); },
      set: async () => { throw new Error('disk full'); }
    };
    const { embedder } = countingEmbedder('count-2');
    const [best] = await search(DOCS, 'reset my password', { embedder, store: broken, k: 1 });
    assert.match(best.text, /Reset your password/);
  });

  it('Postgres keeps them in a real[] column through any client', async () => {
    const calls: { text: string; params: unknown[] }[] = [];
    const store = postgresVectorStore(async (text, params) => {
      calls.push({ text, params });
      return text.startsWith('SELECT') ? [{ id: 'a', vector: ['1', '0.5'] }] : [];
    });
    await store.set([{ id: 'a', embedder: 'e', text: 't', vector: [1, 0.5] }]);
    assert.deepEqual(await store.get(['a']), new Map([['a', [1, 0.5]]]));
    assert.match(calls[0].text, /CREATE TABLE IF NOT EXISTS blazeresolver_vectors .*vector REAL\[\]/);
    assert.match(calls[1].text, /ON CONFLICT \(id\) DO UPDATE/);
    assert.equal(calls.filter((c) => c.text.startsWith('CREATE')).length, 1, 'the table is created once');
  });

  it("the default store is a file in the product, kept out of the product's git", () => {
    const root = product('# P', 'acme/p');
    mkdirSync(join(root, 'src'));
    process.chdir(join(root, 'src'));
    assert.ok(localVectorStore());
    assert.ok(existsSync(join(root, '.blazeresolver', 'vectors.db')));
    assert.equal(readFileSync(join(root, '.blazeresolver', '.gitignore'), 'utf8'), '*\n');
  });
});

describe('installed in a product, Blazzy learns from that product', () => {
  it('creating a handler (as a framework build does) writes nothing to the product', () => {
    const root = product('# Built', 'acme/built');
    process.chdir(root);
    createSupportHandler({ repo: 'acme/built', embed: countingEmbedder('count-4').embedder });
    assert.equal(existsSync(join(root, '.blazeresolver')), false);
  });

  it("answers from the product's README and builds the product's own vector DB, with no configuration", async () => {
    const root = product('# Acme Shop\n\n## Returns\n\nReturns and refunds are free within 30 days of delivery.', 'acme/shop');
    process.chdir(root);
    const prompts: string[] = [];
    const handler = createSupportHandler({
      store: new SupportStore(),
      repo: 'acme/shop',
      embed: countingEmbedder('count-3').embedder,
      complete: async (_system, user) => (prompts.push(user), '{"reply": "ok"}')
    });
    await handler(new Request('http://localhost/api/support/tickets/create', { method: 'POST', body: JSON.stringify({ rawText: 'Can I get my money back?' }) }));

    assert.match(prompts[0], /<knowledge>[\s\S]*Returns and refunds are free within 30 days/);
    const db = new DatabaseSync(join(root, '.blazeresolver', 'vectors.db'));
    // The vectors are written just after the reply; give that write a moment.
    await new Promise((r) => setTimeout(r, 50));
    const rows = db.prepare('SELECT embedder, text FROM blazeresolver_vectors').all() as { embedder: string; text: string }[];
    db.close();
    assert.ok(rows.some((r) => r.embedder === 'count-3' && /Returns and refunds are free/.test(r.text)));
  });
});

describe('the vector database is never committed', () => {
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  /** A real git repo: the proof is what git itself ignores. */
  function gitRepo(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'blaze-git-'));
    dirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'remote', 'add', 'origin', 'https://github.com/acme/shop.git');
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    return dir;
  }
  const ignored = (dir: string, file: string) => {
    try {
      git(dir, 'check-ignore', '-q', file);
      return true;
    } catch {
      return false;
    }
  };

  it('recognizes the ways a .gitignore already ignores it, and adds exactly one line otherwise', () => {
    for (const text of ['.blazeresolver/\n', '/.blazeresolver\n', '**/.blazeresolver/\n', 'dist\n.blazeresolver/*\n']) {
      assert.equal(gitignoreAddition(text), undefined, text);
    }
    assert.equal(gitignoreAddition(undefined), GITIGNORE_BLOCK);
    assert.equal(gitignoreAddition('node_modules'), `\n\n${GITIGNORE_BLOCK}`);
    assert.equal(gitignoreAddition('node_modules\n'), `\n${GITIGNORE_BLOCK}`);
    assert.equal(gitignoreAddition('.blazeresolver/\n!.blazeresolver/\n'), `\n${GITIGNORE_BLOCK}`, 'a negation un-ignores it');
  });

  it("the handler adds it to the product's .gitignore when it creates the database", async () => {
    const dir = gitRepo({ '.gitignore': 'node_modules/\n', 'README.md': '# Shop\n\nFree returns.' });
    process.chdir(dir);
    const handler = createSupportHandler({ repo: 'acme/shop', embed: countingEmbedder('count-5').embedder, complete: async () => '{"reply":"ok"}' });
    await handler(new Request('http://localhost/api/support/tickets/create', { method: 'POST', body: JSON.stringify({ rawText: 'returns?' }) }));
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(existsSync(join(dir, '.blazeresolver', 'vectors.db')));
    assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), `node_modules/\n\n${GITIGNORE_BLOCK}`);
    assert.ok(ignored(dir, '.blazeresolver/vectors.db'));
    git(dir, 'add', '-A');
    assert.doesNotMatch(git(dir, 'status', '--porcelain'), /blazeresolver\//, 'nothing of the database can be committed');
  });

  it('leaves a deployed copy (no .git) alone', () => {
    const root = product('# Deployed');
    process.chdir(root);
    assert.ok(localVectorStore());
    assert.equal(existsSync(join(root, '.gitignore')), false);
  });

  it('init adds it to .gitignore, and remove takes back exactly that', async () => {
    const dir = gitRepo({
      '.gitignore': 'node_modules\n.env\n',
      'package.json': JSON.stringify({ name: 'shop', dependencies: { next: '15', react: '19' }, scripts: { test: 'vitest' } }),
      'package-lock.json': '{}'
    });
    mkdirSync(join(dir, 'app'));
    writeFileSync(join(dir, 'app', 'layout.tsx'), 'export default function R({ children }: any) {\n  return (\n    <html>\n      <body>\n        {children}\n      </body>\n    </html>\n  );\n}\n');
    await runInit({ cwd: dir, log: () => {}, noInstall: true });
    assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), `node_modules\n.env\n\n${GITIGNORE_BLOCK}`);
    assert.ok(ignored(dir, '.blazeresolver/vectors.db'));

    await runRemove({ cwd: dir, yes: true, noUninstall: true, log: () => {} });
    assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), 'node_modules\n.env\n');
  });
});
