import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import type { CodeFixHandoff } from '../core/code-fix/index.js';
import { CodeGraphAdapter } from '../codebase/codegraph-adapter.js';
import { GitWorkspace } from '../codebase/git-workspace.js';
import { BugResolver } from '../resolver/bug-resolver.js';
import { createEcommerceAdapters, ECOMMERCE_PROFILE } from '../examples/ecommerce/index.js';
import {
  CHECKOUT_BUILD_COMMAND,
  CHECKOUT_TEST_COMMAND,
  CheckoutFixAI,
  createCheckoutRepo
} from '../examples/bug-fix/checkout-discount.js';

/**
 * Customer complaints to a reviewable fix: the pipeline clusters overcharge complaints into one incident,
 * recognises it as a software defect, and hands it to the real bug-fix loop (real git workspaces, CodeGraph,
 * tests and build; scripted model).
 */
describe('End to end: customer complaints to a fix awaiting review', () => {
  let root: string;
  let repo: string;
  let codebase: CodeGraphAdapter;
  let ai: CheckoutFixAI;
  let fix: CodeFixHandoff | undefined;

  before(async () => {
    root = mkdtempSync(join(tmpdir(), 'blaze-complaint-e2e-'));
    repo = createCheckoutRepo(join(root, 'checkout-service'));
    codebase = new CodeGraphAdapter({ root: repo });
    ai = new CheckoutFixAI();

    const pipeline = new BlazeResolverPipeline(createEcommerceAdapters(), {
      profile: ECOMMERCE_PROFILE,
      bugResolver: new BugResolver({
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
      })
    });

    const complaints = [
      'I was charged $990 instead of $900 when I used the SAVE10 discount code.',
      'The SAVE10 discount only took $10 off my $1000 cart, I was charged $990.',
      'Discount code SAVE25 on a $400 cart charged me $375, should be $300.'
    ];
    let last;
    for (const [i, rawText] of complaints.entries()) {
      last = await pipeline.processComplaint({
        id: `checkout_${i}`,
        channel: 'text',
        rawText,
        customerId: `cust_${i}`,
        timestamp: new Date()
      });
    }
    fix = await pipeline.waitForCodeFix(last!.correlation.incident!.incidentId);
  });

  after(async () => {
    await codebase?.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('hands the correlated incident to the bug-fix loop', () => {
    assert.ok(fix, 'the incident was handed off');
    assert.match(fix!.incident.title, /^Billing issue: 3 customers affected/);
    assert.ok(fix!.incident.description.includes('SAVE25 on a $400 cart charged me $375'));
  });

  it('investigates from the customer reports and CodeGraph', () => {
    const { context } = ai.investigations[0];
    assert.ok(context.exploration?.files?.includes('src/pricing.js'), 'CodeGraph found the pricing module from the complaints');
    assert.deepStrictEqual(fix!.result?.investigation?.suspectedFiles, ['src/pricing.js']);
  });

  it('ends READY_FOR_REVIEW with the fix staged, not committed', () => {
    const result = fix!.result!;
    assert.strictEqual(fix!.status, 'READY_FOR_REVIEW', result.failureReason);
    assert.deepStrictEqual(result.attempts.map((a) => a.failure?.stage), ['test', 'build', undefined]);
    assert.match(result.diff!, /^\+  return Math\.round\(\(total \* \(100 - percent\)\) \/ 100\);$/m);

    const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd }).toString().trim();
    assert.strictEqual(git(repo, 'status', '--porcelain'), '');
    assert.strictEqual(git(result.workspace!.path, 'rev-parse', 'HEAD'), git(repo, 'rev-parse', 'main'));
  });
});
