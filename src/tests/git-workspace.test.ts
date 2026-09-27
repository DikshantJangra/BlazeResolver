import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

  it('stages the local working-tree snapshot before baseline checks', async () => {
    const local = new GitWorkspace({
      repo,
      baseRef: 'main',
      basePatch: PATCH,
      workspacesDir: join(root, 'workspaces'),
      testCommand: `node -e "import('./math.js').then(m => process.exit(m.add(2, 3) === 5 ? 0 : 1))"`,
      buildCommand: 'true'
    });
    const ws = await local.createWorkspace();
    assert.strictEqual((await local.runTests(ws)).success, true);
    assert.match(await local.gitDiff(ws), /\+export const add = \(a, b\) => a \+ b;/);
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

  it('with a sandbox user, runs tests and build in a copy without .git that a new patch replaces', async () => {
    // This process's own user stands in for the sandbox user: the copy, HOME and lifecycle are the same.
    // The separate-user isolation itself is checked in sandbox-isolation.test.ts, which needs root on Linux.
    const sandboxed = new GitWorkspace({
      repo,
      workspacesDir: join(root, 'workspaces'),
      sandbox: { uid: process.getuid!(), gid: process.getgid!() },
      testCommand:
        `test ! -e .git && echo "PWD=$(pwd) HOME=$HOME" && touch tests-ran.txt && ` +
        `node -e "import('./math.js').then(m => process.exit(m.add(2, 3) === 5 ? 0 : 1))"`,
      buildCommand: 'test -e tests-ran.txt'
    });
    const ws = await sandboxed.createWorkspace();

    await sandboxed.applyPatch(ws, PATCH);
    const tests = await sandboxed.runTests(ws);
    assert.strictEqual(tests.success, true, tests.output);
    const pwd = tests.output.match(/PWD=(\S+)/)![1];
    const home = tests.output.match(/HOME=(\S+)/)![1];
    assert.notStrictEqual(pwd, ws.path, 'tests do not run in the git workspace');
    assert.match(pwd, /\/repo$/);
    assert.strictEqual(realpathSync(home), realpathSync(join(pwd, '..', 'home')), 'HOME is the sandbox home next to the copy');

    // The build runs where the tests ran; files the tests wrote never reach the diff.
    assert.strictEqual((await sandboxed.runBuild(ws)).success, true);
    assert.doesNotMatch(await sandboxed.gitDiff(ws), /tests-ran/);

    // A new patch discards the copy, so the next run sees exactly the new index.
    await sandboxed.applyPatch(ws, `diff --git a/extra.js b/extra.js\nnew file mode 100644\n--- /dev/null\n+++ b/extra.js\n@@ -0,0 +1 @@\n+export const extra = 1;\n`);
    assert.strictEqual((await sandboxed.runBuild(ws)).success, false, 'the tests-ran marker went with the old copy');

    await sandboxed.dispose();
    assert.strictEqual(existsSync(join(pwd, '..')), false, 'dispose removes sandbox copies');
  });

  it('refuses root as the sandbox user', () => {
    assert.throws(
      () => new GitWorkspace({ repo, testCommand: 'true', buildCommand: 'true', sandbox: { uid: 0, gid: 0 } }),
      /must not be root/
    );
  });

  it('refuses workspaces it did not create', async () => {
    await assert.rejects(workspaces.gitDiff({ id: 'repo', path: repo }), /not a workspace/);
  });
});
