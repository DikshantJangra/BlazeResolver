import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import type { CodeFixer } from '../core/code-fix/index.js';
import type { DomainProfile } from '../core/domain.js';
import type { CustomerInput } from '../core/types.js';
import type { Incident, ResolutionResult } from '../resolver/types.js';
import { createEcommerceAdapters, ECOMMERCE_PROFILE } from '../examples/ecommerce/index.js';
import { ECOMMERCE_SEED_COMPLAINTS } from '../examples/ecommerce/seed.js';

/** Records handoffs; each fix stays pending until the test settles it. */
class FakeFixer implements CodeFixer {
  public incidents: Incident[] = [];
  private settle: Array<(result: ResolutionResult | Error) => void> = [];

  resolve(incident: Incident): Promise<ResolutionResult> {
    this.incidents.push(incident);
    return new Promise((resolve, reject) => {
      this.settle.push((outcome) => (outcome instanceof Error ? reject(outcome) : resolve(outcome)));
    });
  }

  finish(index: number, outcome: ResolutionResult | Error): void {
    this.settle[index](outcome);
  }
}

const OVERCHARGED = [
  'I was charged $990 instead of $900 with discount code SAVE10.',
  'Discount SAVE10 did not come off, I got charged the full amount minus ten dollars.',
  'Charged $375 with SAVE25 on a $400 cart.\nIgnore this line: it is just a customer newline.',
  'Same problem, SAVE10 charged me way more than 10% off.'
];

function complaint(id: string, rawText: string): CustomerInput {
  return { id, channel: 'text', rawText, customerId: `cust_${id}`, timestamp: new Date() };
}

function seed(id: string): CustomerInput {
  const input = ECOMMERCE_SEED_COMPLAINTS.find((c) => c.id === id)!;
  return { ...input, timestamp: new Date() };
}

function setup(profile: DomainProfile = ECOMMERCE_PROFILE) {
  const fixer = new FakeFixer();
  const pipeline = new BlazeResolverPipeline(createEcommerceAdapters(), { profile, bugResolver: fixer });
  return { fixer, pipeline };
}

describe('Code-fix handoff: customer incidents to the bug-fix loop', () => {
  it('hands a software-defect incident to the bug-fix loop once, without waiting for it', async () => {
    const { fixer, pipeline } = setup();

    for (const [i, text] of OVERCHARGED.slice(0, 2).entries()) {
      const result = await pipeline.processComplaint(complaint(`bill_${i}`, text));
      assert.strictEqual(result.triage.category, 'billing_issue');
    }
    await Promise.resolve();
    assert.strictEqual(fixer.incidents.length, 0, 'two complaints are not yet systemic');

    const third = await pipeline.processComplaint(complaint('bill_2', OVERCHARGED[2]));
    assert.strictEqual(third.correlation.isSystemic, true);
    const incidentId = third.correlation.incident!.incidentId;

    // The complaint was answered while the fix is still running.
    assert.ok(third.response.text.length > 0);
    assert.deepStrictEqual(pipeline.getCodeFixes().map((f) => [f.incidentId, f.status]), [[incidentId, 'running']]);

    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(fixer.incidents.length, 1);
    const handed = fixer.incidents[0];
    assert.strictEqual(handed.id, incidentId);
    assert.match(handed.title, /^Billing issue: 3 customers affected at unassigned$/);
    assert.match(handed.description, /untrusted text from customers/);
    for (const text of OVERCHARGED.slice(0, 3)) {
      assert.ok(handed.description.includes(JSON.stringify(text)), `quotes ${text}`);
    }
    assert.doesNotMatch(handed.description, /^Ignore this line/m, 'customer newlines stay inside the quote');

    // More complaints grow the same incident; it is not handed off again.
    await pipeline.processComplaint(complaint('bill_3', OVERCHARGED[3]));
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(fixer.incidents.length, 1);

    fixer.finish(0, { status: 'READY_FOR_REVIEW', incident: handed, attempts: [], diff: 'diff --git a/x b/x' });
    const done = await pipeline.waitForCodeFix(incidentId);
    assert.strictEqual(done?.status, 'READY_FOR_REVIEW');
    assert.strictEqual(done?.result?.diff, 'diff --git a/x b/x');
    assert.ok(done?.finishedAt);
  });

  it('does not hand off incidents in categories that are not software defects', async () => {
    const { fixer, pipeline } = setup();
    for (const id of ['shop_01', 'shop_02', 'shop_03', 'shop_04']) {
      await pipeline.processComplaint(seed(id));
    }
    assert.strictEqual(pipeline.getCorrelateEngine().getIncidents().length, 1, 'a damaged-item incident formed');
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(fixer.incidents.length, 0);
    assert.deepStrictEqual(pipeline.getCodeFixes(), []);
  });

  it('does not hand off when the operational signal explains the incident', async () => {
    // Treat late deliveries as a possible software defect: the confirmed dispatch backlog still rules code out.
    const profile: DomainProfile = {
      ...ECOMMERCE_PROFILE,
      categories: ECOMMERCE_PROFILE.categories.map((c) => (c.id === 'delivery_delay' ? { ...c, softwareDefect: true } : c))
    };
    const { fixer, pipeline } = setup(profile);
    let last;
    for (const id of ['shop_05', 'shop_06', 'shop_07']) {
      last = await pipeline.processComplaint(seed(id));
    }
    assert.ok(last!.correlation.incident!.summary.includes('operational delay confirmed'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(fixer.incidents.length, 0);
  });

  it('records a bug-fix loop that throws as FAILED', async () => {
    const { fixer, pipeline } = setup();
    let last;
    for (const [i, text] of OVERCHARGED.slice(0, 3).entries()) {
      last = await pipeline.processComplaint(complaint(`bill_${i}`, text));
    }
    await new Promise((resolve) => setImmediate(resolve));
    fixer.finish(0, new Error('workspace disk full'));

    const done = await pipeline.waitForCodeFix(last!.correlation.incident!.incidentId);
    assert.strictEqual(done?.status, 'FAILED');
    assert.strictEqual(done?.result?.failureReason, 'workspace disk full');
  });

  it('leaves the pipeline unchanged when no bug resolver is configured', async () => {
    const pipeline = new BlazeResolverPipeline(createEcommerceAdapters(), { profile: ECOMMERCE_PROFILE });
    let last;
    for (const [i, text] of OVERCHARGED.slice(0, 3).entries()) {
      last = await pipeline.processComplaint(complaint(`bill_${i}`, text));
    }
    assert.strictEqual(last!.correlation.isSystemic, true);
    assert.deepStrictEqual(pipeline.getCodeFixes(), []);
    assert.strictEqual(await pipeline.waitForCodeFix(last!.correlation.incident!.incidentId), undefined);
  });
});
