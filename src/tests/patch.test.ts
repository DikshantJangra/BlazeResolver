import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PatchError, renderPatch } from '../resolver/patch.js';
import type { FileEdit } from '../resolver/types.js';

const LONG_FILE = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';

describe('renderPatch', () => {
  let root: string;
  let count = 0;

  before(() => {
    root = mkdtempSync(join(tmpdir(), 'blaze-patch-test-'));
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  /** Renders edits against `files`, applies the patch with real git, and returns the resulting contents. */
  async function applyWithGit(files: Record<string, string>, edits: FileEdit[]): Promise<Record<string, string>> {
    const repo = join(root, `repo-${count++}`);
    mkdirSync(repo);
    execFileSync('git', ['init', '--quiet', repo]);
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), content);
    }
    execFileSync('git', ['add', '.'], { cwd: repo });

    const patch = await renderPatch(edits, async (path) => files[path] ?? null);
    execFileSync('git', ['apply', '--index', '-'], { cwd: repo, input: patch });

    const out: Record<string, string> = {};
    for (const path of new Set([...Object.keys(files), ...edits.map((e) => e.path)])) {
      out[path] = readFileSync(join(repo, path), 'utf-8');
    }
    return out;
  }

  const replace = (path: string, search: string, replacement: string): FileEdit => ({
    kind: 'replace',
    path,
    search,
    replace: replacement
  });

  it('patches a change in the middle of a file with three lines of context', async () => {
    const patch = await renderPatch([replace('a.txt', 'line 10\n', 'line ten\n')], async () => LONG_FILE);
    assert.match(patch, /^@@ -7,7 \+7,7 @@$/m);

    const out = await applyWithGit({ 'a.txt': LONG_FILE }, [replace('a.txt', 'line 10\n', 'line ten\n')]);
    assert.strictEqual(out['a.txt'], LONG_FILE.replace('line 10\n', 'line ten\n'));
  });

  it('patches the first and last lines, and inserts and deletes lines', async () => {
    const edits = [
      replace('a.txt', 'line 1\n', 'first\n'),
      replace('a.txt', 'line 20\n', 'last\nextra\n'),
      replace('a.txt', 'line 5\nline 6\n', '')
    ];
    const expected = LONG_FILE.replace('line 1\n', 'first\n')
      .replace('line 20\n', 'last\nextra\n')
      .replace('line 5\nline 6\n', '');
    assert.deepStrictEqual(await applyWithGit({ 'a.txt': LONG_FILE }, edits), { 'a.txt': expected });
  });

  it('handles files without a trailing newline, and adding or removing one', async () => {
    const noNewline = 'one\ntwo\nthree';
    assert.deepStrictEqual(
      await applyWithGit({ 'a.txt': noNewline }, [replace('a.txt', 'three', 'THREE')]),
      { 'a.txt': 'one\ntwo\nTHREE' }
    );
    assert.deepStrictEqual(
      await applyWithGit({ 'a.txt': noNewline }, [replace('a.txt', 'three', 'three\n')]),
      { 'a.txt': 'one\ntwo\nthree\n' }
    );
    assert.deepStrictEqual(
      await applyWithGit({ 'a.txt': 'one\ntwo\n' }, [replace('a.txt', 'two\n', 'two')]),
      { 'a.txt': 'one\ntwo' }
    );
    assert.deepStrictEqual(
      await applyWithGit({ 'a.txt': noNewline }, [replace('a.txt', 'one', 'ONE')]),
      { 'a.txt': 'ONE\ntwo\nthree' }
    );
  });

  it('creates files and edits several files in one patch', async () => {
    const out = await applyWithGit({ 'src/a.js': 'const a = 1;\n', 'src/b.js': 'const b = 2;\n' }, [
      replace('src/a.js', '1', '10'),
      replace('src/b.js', '2', '20'),
      { kind: 'create', path: 'test/new.test.js', content: 'test();\n' },
      replace('test/new.test.js', 'test()', 'test(1)')
    ]);
    assert.deepStrictEqual(out, {
      'src/a.js': 'const a = 10;\n',
      'src/b.js': 'const b = 20;\n',
      'test/new.test.js': 'test(1);\n'
    });
  });

  it('rejects edits that cannot be applied unambiguously', async () => {
    const read = async (path: string) => (path === 'a.txt' ? 'x\nx\ny\n' : null);
    const cases: Array<[FileEdit[], RegExp]> = [
      [[], /no edits/],
      [[replace('a.txt', 'z', 'Z')], /not found/],
      [[replace('a.txt', 'x', 'X')], /more than once/],
      [[replace('a.txt', '', 'X')], /empty search/],
      [[replace('missing.txt', 'x', 'X')], /does not exist/],
      [[{ kind: 'create', path: 'a.txt', content: 'x' }], /already exists/],
      [[replace('a.txt', 'y', 'y')], /unchanged/]
    ];
    for (const [edits, message] of cases) {
      await assert.rejects(renderPatch(edits, read), (err: Error) => err instanceof PatchError && message.test(err.message));
    }
  });

  it('refuses paths outside the repository or inside .git', async () => {
    for (const path of ['../escape.js', '/etc/passwd', 'src/../../escape.js', '.git/config', 'has space.js', '']) {
      await assert.rejects(
        renderPatch([{ kind: 'create', path, content: 'x' }], async () => null),
        /not a plain repository-relative path/,
        path
      );
    }
  });
});
