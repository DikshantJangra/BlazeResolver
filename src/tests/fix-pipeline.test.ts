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
import { redactPersonalData } from '../github/index.js';
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

describe('personal data never reaches GitHub', () => {
  it('masks emails, phone and card numbers, IPs and URL query strings', () => {
    assert.equal(
      redactPersonalData('Checkout fails for jane.doe+shop@example.co.uk on https://shop.example.com/checkout?email=jane%40x.com&t=abc#pay'),
      'Checkout fails for [email] on https://shop.example.com/checkout'
    );
    assert.equal(redactPersonalData('call +1 (415) 555-0100 or card 4111 1111 1111 1111 from 203.0.113.9'), 'call [number] or card [number] from [ip]');
    // A title cut at 200 characters can end mid-address.
    assert.equal(redactPersonalData('fix: broken for jane@gmai'), 'fix: broken for [email]');
    // Code-level text survives: versions, dates, durations, line numbers.
    const code = 'v1.2.3 on 2026-09-27, 180.448917ms at src/pricing.js:42:7';
    assert.equal(redactPersonalData(code), code);
  });

  const leaky = {
    ...CHECKOUT_INCIDENT,
    title: 'jane.doe@example.com here, checkout total is wrong, call me on +44 7700 900123',
    description: `${CHECKOUT_INCIDENT.description}\nPage: https://shop.example.com/checkout?email=jane.doe%40example.com&session=s3cr3t`
  };
  const leaks = (text: string) => /jane|example\.com\b(?!\/)|7700|s3cr3t|session=/.test(text);

  it('keeps it out of the PR title, body and commit message', async () => {
    const remote = bareRemote();
    const gh = fakeGithub();
    await runFix({ project, incident: { ...leaky, id: 'inc_pii1' }, reportCount: 1, token: 'tok', ai: new CheckoutFixAI(), remoteUrl: remote, fetch: gh.f });

    const pr = gh.calls.find((c) => c.url.endsWith('/pulls'))!.body;
    assert.ok(!leaks(pr.title), pr.title);
    assert.ok(!leaks(pr.body), pr.body);
    const commit = execFileSync('git', ['--git-dir', remote, 'log', '-1', '--format=%B', 'blazeresolver/fix-inc_pii1'], { encoding: 'utf8' });
    assert.ok(!leaks(commit), commit);
  });

  it('keeps it out of the issue title and body', async () => {
    const gh = fakeGithub();
    const ai: AIProvider = {
      investigate: async () => ({ summary: 's', rootCause: 'in CI', suspectedFiles: ['src/pricing.js'], confidence: 'medium' }),
      proposeFix: async () => ({ summary: 'edit ci', edits: [{ kind: 'create', path: '.github/workflows/ci.yml', content: 'x' }] })
    };
    await runFix({ project, incident: { ...leaky, id: 'inc_pii2' }, reportCount: 1, token: 'tok', ai, remoteUrl: bareRemote(), fetch: gh.f });

    const issue = gh.calls.find((c) => c.url.endsWith('/issues'))!.body;
    assert.ok(!leaks(issue.title), issue.title);
    assert.ok(!leaks(issue.body), issue.body);
    assert.match(issue.body, /Page: https:\/\/shop\.example\.com\/checkout\n/);
  });
});
