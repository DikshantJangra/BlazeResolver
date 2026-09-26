/**
 * A deterministic bug for exercising BugResolver end to end: a checkout service that charges ₹990
 * instead of ₹900 for 10% off ₹1000, because the discount percentage is subtracted as a rupee amount.
 *
 * CheckoutFixAI stands in for a model. It is rule-based but only works from what the resolver gives it:
 * it finds the bug in the CodeGraph context and revises its fix from the test and build failures.
 * Its first fix fails the tests and its second fails the build, so one run covers the whole retry loop.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AIProvider, FixRequest, InvestigationRequest } from '../../resolver/ai-provider.js';
import type { FixProposal, Incident, Investigation } from '../../resolver/types.js';

export const CHECKOUT_TEST_COMMAND = 'node --test';
export const CHECKOUT_BUILD_COMMAND = 'node scripts/build.js';

const PRICING_PATH = 'src/pricing.js';
const BUGGY_LINE = '  return total - percent;\n';

const REPO_FILES: Record<string, string> = {
  'package.json': '{ "name": "checkout-service", "private": true, "type": "module" }\n',
  '.gitignore': 'dist/\n.codegraph/\nnode_modules/\n',
  [PRICING_PATH]: `/**
 * Takes a percentage discount off an order total.
 * @param {number} total order total in rupees
 * @param {number} percent discount percentage, e.g. 10 for 10% off
 */
export function applyDiscount(total, percent) {
  if (percent <= 0) return total;
${BUGGY_LINE}}
`,
  'src/cart.js': `import { applyDiscount } from './pricing.js';

const DISCOUNT_CODES = { SAVE10: 10, SAVE25: 25 };

export function checkoutTotal(items, code) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return applyDiscount(subtotal, DISCOUNT_CODES[code] ?? 0);
}
`,
  'test/cart.test.js': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutTotal } from '../src/cart.js';

test('no code charges the subtotal', () => {
  assert.equal(checkoutTotal([{ price: 500, qty: 2 }]), 1000);
});

test('SAVE10 takes 10% off', () => {
  assert.equal(checkoutTotal([{ price: 500, qty: 2 }], 'SAVE10'), 900);
});

test('SAVE25 takes 25% off', () => {
  assert.equal(checkoutTotal([{ price: 400, qty: 1 }], 'SAVE25'), 300);
});
`,
  'scripts/build.js': `// Syntax-checks src/ and bundles it into dist/. Production code may not contain debug logging.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const files = readdirSync('src').filter((f) => f.endsWith('.js')).sort();
for (const file of files) execFileSync(process.execPath, ['--check', \`src/\${file}\`]);

const offenders = files.filter((f) => /console\\.log\\(/.test(readFileSync(\`src/\${f}\`, 'utf8')));
if (offenders.length) {
  console.error(\`build failed: console.log in production code: \${offenders.map((f) => 'src/' + f).join(', ')}\`);
  process.exit(1);
}

mkdirSync('dist', { recursive: true });
writeFileSync('dist/bundle.js', files.map((f) => readFileSync(\`src/\${f}\`, 'utf8')).join('\\n'));
console.log(\`built dist/bundle.js from \${files.length} files\`);
`
};

export const CHECKOUT_INCIDENT: Incident = {
  id: 'INC-4521',
  title: 'Customers overcharged when a discount code is applied',
  description:
    'Orders using SAVE10 (10% off) on a ₹1000 cart are charged ₹990 instead of ₹900. ' +
    'SAVE25 is affected too. Payment reconciliation flagged the mismatch.',
  stackTrace: [
    'AmountMismatchError: expected charge 900, got 990 (order ord-7781, code SAVE10)',
    '    at checkoutTotal (/srv/checkout-service/src/cart.js:7:10)',
    '    at processTicksAndRejections (node:internal/process/task_queues:95:5)'
  ].join('\n'),
  logs: ['2026-09-27T10:14:03Z payment-reconciler mismatch order=ord-7781 expected=900 charged=990']
};

/** Creates the checkout-service repository in `dir` with its bug committed on main. */
export function createCheckoutRepo(dir: string): string {
  mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init', '--quiet', '-b', 'main', dir]);
  for (const [path, content] of Object.entries(REPO_FILES)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=dev', '-c', 'user.email=dev@example.com', 'commit', '--quiet', '-m', 'checkout service'], {
    cwd: dir
  });
  return dir;
}

export class CheckoutFixAI implements AIProvider {
  public investigations: InvestigationRequest[] = [];
  public fixes: FixRequest[] = [];

  async investigate(request: InvestigationRequest): Promise<Investigation> {
    this.investigations.push(request);

    const pricing = request.context.files.find((f) => /function applyDiscount\(/.test(f.content));
    if (!pricing) {
      throw new Error('could not find the discount logic in the codebase context');
    }
    const caller = request.context.files.find((f) => f.content.includes('applyDiscount(subtotal'));
    const failures = (request.baselineFailure?.output ?? '')
      .split('\n')
      .filter((line) => /!==/.test(line))
      .map((line) => `failing test: ${line.trim()}`);

    return {
      summary: 'Discounted orders are charged the total minus the discount percentage, e.g. ₹1000 − 10 = ₹990.',
      rootCause:
        `applyDiscount in ${pricing.path} subtracts \`percent\` from the total as if it were a rupee amount, ` +
        'instead of taking that percentage of the total off.',
      suspectedFiles: [pricing.path],
      confidence: 'high',
      evidence: [
        `${pricing.path}: ${BUGGY_LINE.trim()}`,
        ...(caller ? [`${caller.path} passes the discount code's percentage straight to applyDiscount`] : []),
        ...failures
      ]
    };
  }

  async proposeFix(request: FixRequest): Promise<FixProposal> {
    this.fixes.push(request);
    const pricing = request.files.find((f) => f.path === request.investigation.suspectedFiles[0]);
    if (!pricing?.content.includes(BUGGY_LINE)) {
      throw new Error(`expected the buggy line in ${request.investigation.suspectedFiles[0]}`);
    }

    const last = request.previousAttempts[request.previousAttempts.length - 1];
    const fix = (summary: string, replacement: string, extra: FixProposal['edits'] = []): FixProposal => ({
      summary,
      edits: [{ kind: 'replace', path: pricing.path, search: BUGGY_LINE, replace: replacement }, ...extra]
    });

    if (!last) {
      return fix('Apply the discount as a multiplier on the total.', '  return total * (1 - percent);\n');
    }
    if (last.failure?.stage === 'test' && /-9000/.test(last.failure.output)) {
      // The totals went negative: percent is a whole-number percentage, not a fraction.
      return fix(
        'Treat percent as a whole-number percentage and round to whole rupees.',
        "  console.log('applyDiscount', { total, percent });\n  return Math.round((total * (100 - percent)) / 100);\n"
      );
    }
    if (last.failure?.stage === 'build' && /console\.log in production code/.test(last.failure.output)) {
      return fix(
        'Take `percent`% off the total, rounded to whole rupees, instead of subtracting `percent` rupees. ' +
          'Adds a regression test for applyDiscount.',
        '  return Math.round((total * (100 - percent)) / 100);\n',
        [
          {
            kind: 'create',
            path: 'test/discount.test.js',
            content: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDiscount } from '../src/pricing.js';

test('applyDiscount takes a percentage off, rounded to whole rupees', () => {
  assert.equal(applyDiscount(1000, 10), 900);
  assert.equal(applyDiscount(999, 15), 849);
  assert.equal(applyDiscount(1000, 0), 1000);
});
`
          }
        ]
      );
    }
    throw new Error(`no rule for the previous failure at ${last.failure?.stage}`);
  }
}
