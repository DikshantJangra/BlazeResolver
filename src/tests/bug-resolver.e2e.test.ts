import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodeGraphAdapter } from '../codebase/codegraph-adapter.js';
import { GitWorkspace } from '../codebase/git-workspace.js';
import { BugResolver } from '../resolver/bug-resolver.js';
import type { ResolutionResult } from '../resolver/types.js';
import {
  CHECKOUT_BUILD_COMMAND,
  CHECKOUT_INCIDENT,
  CHECKOUT_TEST_COMMAND,
  CheckoutFixAI,
  createCheckoutRepo
} from '../examples/bug-fix/checkout-discount.js';

/**
 * The whole loop on a real repository: real git workspaces, real CodeGraph, real test and build commands.
 * Only the model is scripted, so the run is deterministic.
 */
describe('BugResolver end to end: checkout discount bug', () => {
  let root: string;
  let repo: string;
  let codebase: CodeGraphAdapter;
  let ai: CheckoutFixAI;
  let result: ResolutionResult;
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd }).toString().trim();

  before(async () => {
    root = mkdtempSync(join(tmpdir(), 'blaze-e2e-'));
    repo = createCheckoutRepo(join(root, 'checkout-service'));
    codebase = new CodeGraphAdapter({ root: repo });
    ai = new CheckoutFixAI();

    const resolver = new BugResolver({
      codebase,
      workspaces: new GitWorkspace({
        repo,
        baseRef: 'main',
        workspacesDir: join(root, 'workspaces'),
        testCommand: CHECKOUT_TEST_COMMAND,
        buildCommand: CHECKOUT_BUILD_COMMAND,
        commandTimeoutMs: 60_000
      }),
      ai,
      maxAttempts: 3
    });
    result = await resolver.resolve(CHECKOUT_INCIDENT);
  });

  after(async () => {
    await codebase?.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('ends READY_FOR_REVIEW', () => {
    assert.strictEqual(result.status, 'READY_FOR_REVIEW', result.failureReason);
  });

  it('reproduces the bug before changing anything', () => {
    assert.strictEqual(result.baseline?.success, false);
    assert.match(result.baseline!.output, /990 !== 900/);
  });

  it('investigates from CodeGraph context and the stack trace', () => {
    const { context } = ai.investigations[0];
    assert.deepStrictEqual(context.notes, []);
    assert.ok(context.exploration?.files?.includes('src/pricing.js'), 'CodeGraph exploration found the pricing module');
    // /srv/checkout-service/src/cart.js from the stack trace is mapped onto the repository.
    assert.deepStrictEqual(context.files.map((f) => f.path).slice(0, 2), ['src/cart.js', 'src/pricing.js']);

    assert.deepStrictEqual(result.investigation?.suspectedFiles, ['src/pricing.js']);
    assert.match(result.investigation!.rootCause, /subtracts `percent`/);
    assert.ok(result.investigation!.evidence!.some((e) => e.includes('990 !== 900')));
  });

  it('retries a fix that fails the tests, then one that fails the build, then passes', () => {
    assert.deepStrictEqual(
      result.attempts.map((a) => a.failure?.stage),
      ['test', 'build', undefined]
    );
    const [first, second, third] = result.attempts;
    assert.match(first.failure!.output, /-9000 !== 900/);
    assert.strictEqual(second.tests?.success, true);
    assert.match(second.failure!.output, /console\.log in production code: src\/pricing\.js/);
    assert.strictEqual(third.tests?.success, true);
    assert.strictEqual(third.build?.success, true);

    // Each retry was told why the previous attempt failed.
    assert.deepStrictEqual(ai.fixes.map((f) => f.previousAttempts.length), [0, 1, 2]);
    assert.strictEqual(ai.fixes[2].previousAttempts[1].failure?.stage, 'build');

    // Every attempt ran in its own workspace, all distinct from the baseline's.
    const ids = new Set(result.attempts.map((a) => a.workspace.id));
    assert.strictEqual(ids.size, 3);
    assert.deepStrictEqual(result.workspace, third.workspace);
  });

  it('produces a reviewable diff of the source change and regression test only', () => {
    const diff = result.diff!;
    assert.match(diff, /^diff --git a\/src\/pricing\.js b\/src\/pricing\.js$/m);
    assert.match(diff, /^-  return total - percent;$/m);
    assert.match(diff, /^\+  return Math\.round\(\(total \* \(100 - percent\)\) \/ 100\);$/m);
    assert.match(diff, /^diff --git a\/test\/discount\.test\.js b\/test\/discount\.test\.js$/m);
    assert.doesNotMatch(diff, /console\.log/);
    assert.doesNotMatch(diff, /dist\//, 'build output is not part of the fix');
    assert.match(result.summary!, /Adds a regression test/);
  });

  it('leaves the source repository untouched and commits nothing', () => {
    assert.strictEqual(git(repo, 'status', '--porcelain'), '');
    assert.strictEqual(git(repo, 'branch', '--list'), '* main');
    assert.strictEqual(git(repo, 'rev-list', '--count', 'HEAD'), '1');

    const ws = result.workspace!.path;
    assert.strictEqual(git(ws, 'rev-parse', 'HEAD'), git(repo, 'rev-parse', 'main'), 'the fix is staged, not committed');
    assert.strictEqual(git(ws, 'rev-parse', '--abbrev-ref', 'HEAD'), result.workspace!.branch);
  });
});
