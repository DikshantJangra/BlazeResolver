import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IncidentStore } from '../incidents/index.js';
import { triage, type Report } from '../triage/index.js';
import { ClaudeProvider } from '../resolver/claude-provider.js';
import type { AIProvider } from '../resolver/ai-provider.js';
import { runFix } from '../jobs/fix.js';
import {
  CHECKOUT_BUILD_COMMAND,
  CHECKOUT_INCIDENT,
  CHECKOUT_TEST_COMMAND,
  CheckoutFixAI,
  createCheckoutRepo
} from '../examples/bug-fix/checkout-discount.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'blaze-t-'));

/** A fake GitHub: records requests and answers like the real API. */
function fakeGithub() {
  const calls: { url: string; body: any }[] = [];
  const f = (async (url: string, init: any) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    const html_url = url.endsWith('/pulls') ? 'https://github.com/acme/shop/pull/7' : 'https://github.com/acme/shop/issues/8';
    return new Response(JSON.stringify({ html_url, number: 7 }), { status: 201 });
  }) as unknown as typeof fetch;
  return { calls, f };
}

function bareRemote() {
  const root = tmp();
  const repo = createCheckoutRepo(join(root, 'checkout'));
  const remote = join(root, 'remote.git');
  execFileSync('git', ['clone', '--quiet', '--bare', repo, remote]);
  return remote;
}

const project = { repo: 'acme/shop', defaultBranch: 'main', testCommand: CHECKOUT_TEST_COMMAND, buildCommand: CHECKOUT_BUILD_COMMAND };

describe('incident grouping', () => {
  it('turns duplicate bug reports into one incident and keeps non-bugs out', async () => {
    const store = new IncidentStore(tmp());
    const bug = (message: string): Report => ({ message });
    const verdict = (feature: string) =>
      triage(bug('checkout crashes with an error'), async () => JSON.stringify({ kind: 'bug', severity: 'high', summary: 'Checkout crashes', feature }));

    const first = store.addReport('prj_1', bug('a'), await verdict('Checkout'));
    const second = store.addReport('prj_1', bug('b'), await verdict('checkout '));
    const other = store.addReport('prj_2', bug('c'), await verdict('Checkout'));
    const question = store.addReport('prj_1', bug('d'), await triage({ message: 'How do I export?' }, undefined));

    assert.equal(first.isNew, true);
    assert.equal(second.isNew, false);
    assert.equal(second.incident!.id, first.incident!.id);
    assert.equal(store.incident(first.incident!.id)!.reportIds.length, 2);
    assert.notEqual(other.incident!.id, first.incident!.id);
    assert.equal(question.incident, undefined);
    assert.equal(store.reports().length, 4);
  });
});

describe('grouping without a model', () => {
  it('groups rule-triaged bugs from the same page into one incident', async () => {
    const store = new IncidentStore(tmp());
    const at = (message: string): Report => ({ message, pageUrl: 'https://shop.test/checkout?x=1' });
    const a = store.addReport('p', at('checkout crashes with an error'), await triage(at('checkout crashes with an error'), undefined));
    const b = store.addReport('p', at('page is broken, error shown'), await triage(at('page is broken, error shown'), undefined));
    assert.equal(b.incident!.id, a.incident!.id);
  });
});

describe('ClaudeProvider', () => {
  it('parses the model JSON and rejects edits it cannot use', async () => {
    const ok = new ClaudeProvider(async () =>
      'Sure!\n{"summary":"s","edits":[{"kind":"replace","path":"a.js","search":"x","replace":"y"}]}'
    );
    const fix = await ok.proposeFix({ incident: CHECKOUT_INCIDENT, investigation: { summary: '', rootCause: 'r', suspectedFiles: [], confidence: 'high' }, files: [], previousAttempts: [], codebase: {} as never });
    assert.equal(fix.edits.length, 1);

    const bad = new ClaudeProvider(async () => '{"summary":"s","edits":[]}');
    await assert.rejects(bad.proposeFix({ incident: CHECKOUT_INCIDENT, investigation: { summary: '', rootCause: 'r', suspectedFiles: [], confidence: 'high' }, files: [], previousAttempts: [], codebase: {} as never }));
  });

  it('sends the customer text as data under a system prompt that says so', async () => {
    let system = '';
    let user = '';
    const p = new ClaudeProvider(async (s, u) => ((system = s), (user = u), '{"summary":"s","rootCause":"r","suspectedFiles":[],"confidence":"low"}'));
    await p.investigate({ incident: CHECKOUT_INCIDENT, context: { files: [], notes: [] }, codebase: {} as never });
    assert.match(system, /DATA/);
    assert.match(user, /<incident>/);
  });
});

describe('runFix: incident to pull request', () => {
  it('never lets the GitHub token into an error message', async () => {
    const token = 'SECRETTOKEN123';
    await assert.rejects(
      runFix({ project, incident: CHECKOUT_INCIDENT, reportCount: 1, token, ai: new CheckoutFixAI(), remoteUrl: `http://x-access-token:${token}@127.0.0.1:1/x.git` }),
      (err: Error) => err.message.length > 0 && !err.message.includes(token)
    );
  });

  it('pushes a branch and opens a PR with the evidence, never touching the default branch', async () => {
    const remote = bareRemote();
    const gh = fakeGithub();
    const out = await runFix({ project, incident: { ...CHECKOUT_INCIDENT, id: 'inc_test1' }, reportCount: 3, token: 'tok', ai: new CheckoutFixAI(), remoteUrl: remote, fetch: gh.f });

    assert.deepEqual(out, { status: 'pr_opened', url: 'https://github.com/acme/shop/pull/7' });
    const branches = execFileSync('git', ['--git-dir', remote, 'branch', '--list'], { encoding: 'utf8' });
    assert.match(branches, /blazeresolver\/fix-inc_test1/);

    const pr = gh.calls.find((c) => c.url.endsWith('/pulls'))!.body;
    assert.equal(pr.head, 'blazeresolver/fix-inc_test1');
    assert.equal(pr.base, 'main');
    assert.match(pr.body, /Reported by 3 customer/);
    assert.match(pr.body, /Root cause/);
    assert.ok(gh.calls.some((c) => c.url.endsWith('/labels')));

    const mainLog = execFileSync('git', ['--git-dir', remote, 'log', '--oneline', 'main'], { encoding: 'utf8' });
    assert.doesNotMatch(mainLog, /fix:/);
  });

  it('opens an issue for a human when no fix passes, and refuses forbidden paths', async () => {
    const remote = bareRemote();
    const gh = fakeGithub();
    const ai: AIProvider = {
      investigate: async () => ({ summary: 's', rootCause: 'in CI', suspectedFiles: ['src/pricing.js'], confidence: 'medium' }),
      proposeFix: async () => ({ summary: 'edit ci', edits: [{ kind: 'create', path: '.github/workflows/ci.yml', content: 'x' }] })
    };
    const out = await runFix({ project, incident: { ...CHECKOUT_INCIDENT, id: 'inc_test2' }, reportCount: 1, token: 'tok', ai, remoteUrl: remote, fetch: gh.f });

    assert.equal(out.status, 'needs_human');
    assert.match((out as any).reason, /failed at patch/);
    assert.ok(gh.calls.some((c) => c.url.endsWith('/issues')));
    assert.ok(!gh.calls.some((c) => c.url.endsWith('/pulls')));
    const branches = execFileSync('git', ['--git-dir', remote, 'branch', '--list'], { encoding: 'utf8' });
    assert.doesNotMatch(branches, /blazeresolver/);
  });
});
