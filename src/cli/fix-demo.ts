/**
 * Runs BugResolver on the checkout discount bug and prints each step:
 * real git workspaces, real CodeGraph, real tests and build; the model is scripted.
 *
 *   npm run demo:fix
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodeGraphAdapter } from '../codebase/codegraph-adapter.js';
import { GitWorkspace } from '../codebase/git-workspace.js';
import { BugResolver } from '../resolver/bug-resolver.js';
import {
  CHECKOUT_BUILD_COMMAND,
  CHECKOUT_INCIDENT,
  CHECKOUT_TEST_COMMAND,
  CheckoutFixAI,
  createCheckoutRepo
} from '../examples/bug-fix/checkout-discount.js';

const root = mkdtempSync(join(tmpdir(), 'blaze-fix-demo-'));
const repo = createCheckoutRepo(join(root, 'checkout-service'));
const codebase = new CodeGraphAdapter({ root: repo });

const resolver = new BugResolver({
  codebase,
  workspaces: new GitWorkspace({
    repo,
    baseRef: 'main',
    workspacesDir: join(root, 'workspaces'),
    testCommand: CHECKOUT_TEST_COMMAND,
    buildCommand: CHECKOUT_BUILD_COMMAND
  }),
  ai: new CheckoutFixAI(),
  maxAttempts: 3
});

const firstLine = (text: string, pattern: RegExp) => text.split('\n').find((l) => pattern.test(l))?.trim() ?? '';

try {
  const incident = CHECKOUT_INCIDENT;
  console.log(`\nINCIDENT ${incident.id}: ${incident.title}\n  ${incident.description}\n`);

  const result = await resolver.resolve(incident);

  console.log(`REPRODUCE  tests on the untouched code ${result.baseline?.success ? 'PASS (bug not covered by tests)' : 'FAIL'}`);
  if (result.baseline && !result.baseline.success) console.log(`           ${firstLine(result.baseline.output, /!==/)}`);

  if (result.investigation) {
    const inv = result.investigation;
    console.log(`\nUNDERSTAND (${inv.confidence} confidence)\n  ${inv.rootCause}`);
    for (const e of inv.evidence ?? []) console.log(`  - ${e}`);
  }

  for (const attempt of result.attempts) {
    const outcome = attempt.failure
      ? `FAILED at ${attempt.failure.stage}: ${firstLine(attempt.failure.output, /!==|failed|not found|Error/) || attempt.failure.output.split('\n')[0]}`
      : 'tests PASS, build PASS';
    console.log(`\nATTEMPT ${attempt.number} in workspace ${attempt.workspace.id}\n  fix: ${attempt.proposal.summary}\n  ${outcome}`);
  }

  console.log(`\n${result.status}${result.failureReason ? `: ${result.failureReason}` : ''}`);
  if (result.status === 'READY_FOR_REVIEW') {
    console.log(`  branch ${result.workspace!.branch} at ${result.workspace!.path} (staged, not committed)\n`);
    console.log(result.diff);
  }
  process.exitCode = result.status === 'READY_FOR_REVIEW' ? 0 : 1;
} finally {
  await codebase.close();
}
