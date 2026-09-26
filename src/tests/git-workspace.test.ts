import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitWorkspace, GitWorkspaceError } from '../codebase/git-workspace.js';

const PATCH = `diff --git a/math.js b/math.js
--- a/math.js
+++ b/math.js
@@ -1 +1 @@
-export const add = (a, b) => a - b;
+export const add = (a, b) => a + b;
`;

describe('GitWorkspace', () => {
  let root: string;
  let repo: string;
  let workspaces: GitWorkspace;

  before(() => {
    root = mkdtempSync(join(tmpdir(), 'blaze-ws-test-'));
    repo = join(root, 'repo');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repo });
    execFileSync('git', ['init', '--quiet', '-b', 'main', repo]);
    writeFileSync(join(repo, 'math.js'), 'export const add = (a, b) => a - b;\n');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', 'init');

    workspaces = new GitWorkspace({
      repo,
      baseRef: 'main',
      workspacesDir: join(root, 'workspaces'),
      testCommand: `node -e "import('./math.js').then(m => process.exit(m.add(2, 3) === 5 ? 0 : 1))"`,
      buildCommand: 'echo built > build.txt'
    });
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it('runs the fix loop: create, test, patch, diff, build, commit', async () => {
    const ws = await workspaces.createWorkspace();
    assert.strictEqual(ws.branch, `blazeresolver/fix-${ws.id}`);

    assert.strictEqual((await workspaces.runTests(ws)).success, false);

    await workspaces.applyPatch(ws, PATCH);
    assert.strictEqual((await workspaces.runTests(ws)).success, true);
    assert.strictEqual((await workspaces.runBuild(ws)).success, true);

    const diff = await workspaces.gitDiff(ws);
    assert.match(diff, /\+export const add = \(a, b\) => a \+ b;/);
    assert.doesNotMatch(diff, /build\.txt/);

    const commit = await workspaces.commit(ws, 'fix: add should add');
    assert.match(commit.hash, /^[0-9a-f]{40}$/);
    const committed = execFileSync('git', ['show', '--name-only', '--format=%s', 'HEAD'], { cwd: ws.path }).toString();
    assert.strictEqual(committed.trim(), 'fix: add should add\n\nmath.js');

    // The source repository is untouched.
    assert.match(readFileSync(join(repo, 'math.js'), 'utf-8'), /a - b/);
  });

  it('rejects a patch that does not apply, leaving files unchanged', async () => {
    const ws = await workspaces.createWorkspace();
    await assert.rejects(workspaces.applyPatch(ws, PATCH.replace('a - b', 'a * b')), GitWorkspaceError);
    assert.strictEqual(await workspaces.gitDiff(ws), '');
    await assert.rejects(workspaces.commit(ws, 'nothing'), /nothing to commit/);
  });

  it('reads files as the index has them: base plus applied patches, not build output', async () => {
    const ws = await workspaces.createWorkspace();
    assert.strictEqual(await workspaces.readFile(ws, 'math.js'), 'export const add = (a, b) => a - b;\n');

    await workspaces.applyPatch(ws, PATCH);
    await workspaces.runBuild(ws);
    assert.strictEqual(await workspaces.readFile(ws, './math.js'), 'export const add = (a, b) => a + b;\n');
    assert.strictEqual(await workspaces.readFile(ws, 'build.txt'), null);
    assert.strictEqual(await workspaces.readFile(ws, 'missing.js'), null);

    await assert.rejects(workspaces.readFile(ws, '../repo/math.js'), /not a path inside the workspace/);
    await assert.rejects(workspaces.readFile(ws, '/etc/passwd'), /not a path inside the workspace/);
  });

  it("reports the project's failing node --test run as a failure, even when run under node --test", async () => {
    const nodeTests = new GitWorkspace({
      repo,
      workspacesDir: join(root, 'workspaces'),
      testCommand: `node --test --test-reporter=tap`,
      buildCommand: 'true'
    });
    const ws = await nodeTests.createWorkspace();
    writeFileSync(
      join(ws.path, 'math.test.mjs'),
      `import { test } from 'node:test';\nimport assert from 'node:assert';\nimport { add } from './math.js';\ntest('adds', () => assert.strictEqual(add(2, 3), 5));\n`
    );
    const result = await nodeTests.runTests(ws);
    assert.strictEqual(result.success, false, result.output);
    assert.match(result.output, /not ok 1 - adds/);
  });

  it('refuses workspaces it did not create', async () => {
    await assert.rejects(workspaces.gitDiff({ id: 'repo', path: repo }), /not a workspace/);
  });
});
