import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitWorkspace, dockerAvailable, dockerRunArgs, installContainer } from '../codebase/git-workspace.js';
import { addedLines, findSecrets, guardEdits, secretValuesFromEnv } from '../resolver/guards.js';
import { DEFAULT_FORBIDDEN_PATHS } from '../resolver/bug-resolver.js';

const read = (files: Record<string, string>) => async (p: string) => files[p] ?? null;

describe('secret scanning', () => {
  it('finds credential formats and reports only their names, never the values', () => {
    const text = [
      'const a = "AKIAABCDEFGHIJKLMNOP";',
      'const b = "ghp_' + 'a'.repeat(36) + '";',
      'const c = "sk-ant-api03-' + 'x'.repeat(30) + '";',
      '-----BEGIN RSA PRIVATE KEY-----',
      'const password = "hunter2hunter2hunter2hunter2";'
    ].join('\n');
    const found = findSecrets(text);
    assert.deepEqual(found.sort(), ['AWS access key', 'Anthropic key', 'GitHub token', 'hard-coded credential', 'private key'].sort());
    assert.ok(!found.join(' ').includes('AKIA'), 'no value in the report');
  });

  it('leaves ordinary code alone', () => {
    assert.deepEqual(findSecrets('const total = price * (1 - percent / 100);\nconst token = getToken();\n// sk- is a prefix'), []);
  });

  it("catches this job's own secrets even in a format nobody has a pattern for", () => {
    const own = secretValuesFromEnv({ API_KEYS: 'weirdprovider-key-12345,other-key-67890abc', GITHUB_TOKEN: 'tok_abcdefgh1234', PATH: '/usr/bin', SHORT_SECRET: 'abc' });
    assert.ok(own.includes('weirdprovider-key-12345') && own.includes('other-key-67890abc') && own.includes('tok_abcdefgh1234'));
    assert.ok(!own.includes('/usr/bin') && !own.includes('abc'));
    assert.deepEqual(findSecrets('fetch(url, { headers: { x: "weirdprovider-key-12345" } })', own), ["one of this job's own secrets"]);
  });

  it('only looks at lines the patch adds', () => {
    const patch = '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-const k = "AKIAABCDEFGHIJKLMNOP";\n+const k = process.env.K;\n context\n';
    assert.deepEqual(findSecrets(addedLines(patch)), [], 'removing a leaked key is welcome');
  });
});

describe('edit guards', () => {
  const pkg = (o: object) => JSON.stringify(o, null, 2);
  const base = { name: 'shop', version: '1.0.0', scripts: { test: 'node --test' }, dependencies: { express: '4' } };

  it('refuses dependency, script and other install-time changes to package.json', async () => {
    const files = { 'package.json': pkg(base) };
    for (const [search, replace, key] of [
      ['"express": "4"', '"express": "4",\n    "evil-pkg": "1"', 'dependencies'],
      ['"test": "node --test"', '"test": "true"', 'scripts'],
      ['"version": "1.0.0"', '"version": "1.0.0",\n  "packageManager": "npm@1"', 'packageManager']
    ]) {
      const reason = await guardEdits([{ kind: 'replace', path: 'package.json', search, replace }], read(files));
      assert.match(reason ?? '', new RegExp(`changing "${key}"`));
    }
  });

  it('allows harmless manifest edits, and refuses creating one', async () => {
    const files = { 'package.json': pkg(base) };
    assert.equal(await guardEdits([{ kind: 'replace', path: 'package.json', search: '"version": "1.0.0"', replace: '"version": "1.0.1"' }], read(files)), undefined);
    assert.match((await guardEdits([{ kind: 'create', path: 'tools/package.json', content: '{}' }], read(files))) ?? '', /creating a package\.json/);
  });

  it('catches the path spelled another way', async () => {
    const files = { 'api/package.json': pkg(base) };
    const reason = await guardEdits([{ kind: 'replace', path: 'api/../api/package.json', search: '"express": "4"', replace: '"express": "5"' }], read(files));
    assert.match(reason ?? '', /dependencies/);
  });

  it('refuses edits that make a test check less, and allows adding tests', async () => {
    const files = { 'test/cart.test.js': "it('a', () => { assert.equal(1, 1); });\nit('b', () => { assert.equal(2, 2); });\n" };
    const weaker = await guardEdits([{ kind: 'replace', path: 'test/cart.test.js', search: "it('b', () => { assert.equal(2, 2); });\n", replace: '' }], read(files));
    assert.match(weaker ?? '', /removes assertions or tests/);
    const stronger = await guardEdits([{ kind: 'replace', path: 'test/cart.test.js', search: "it('a', () => { assert.equal(1, 1); });", replace: "it('a', () => { assert.equal(1, 1); assert.equal(3, 3); });" }], read(files));
    assert.equal(stronger, undefined);
    assert.equal(await guardEdits([{ kind: 'create', path: 'test/new.test.js', content: "it('x', () => { assert.ok(1); });" }], read(files)), undefined);
  });

  it('keeps install config and test runner config off limits', () => {
    for (const path of ['.npmrc', 'app/.yarnrc.yml', 'pnpm-workspace.yaml', 'jest.config.js', 'web/vitest.config.ts', '.mocharc.json', '.github/workflows/ci.yml', 'package-lock.json']) {
      assert.ok(DEFAULT_FORBIDDEN_PATHS.some((re) => re.test(path)), `${path} should be forbidden`);
    }
    assert.ok(!DEFAULT_FORBIDDEN_PATHS.some((re) => re.test('src/cart.js')));
  });
});

const docker = dockerAvailable();

describe('offline test sandbox', () => {
  const repo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'blaze-off-'));
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    writeFileSync(join(dir, 'a.txt'), 'hi\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init'], { cwd: dir });
    return dir;
  };
  const workspaces = (dir: string, over: Record<string, unknown> = {}) =>
    new GitWorkspace({
      repo: dir, baseRef: 'main', testCommand: 'true', buildCommand: 'true', workspacesDir: mkdtempSync(join(tmpdir(), 'blaze-ws-')),
      env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true', NODE_ENV: 'test', MY_SECRET_KEY: 'host-secret-value-123' },
      offline: { image: 'busybox' }, ...over
    });

  it('builds a docker command with no network, no capabilities, and none of the host environment', () => {
    const args = dockerRunArgs({ name: 'n', image: 'img', cwd: '/w', command: 'npm test', user: { uid: 1000, gid: 1000 }, env: { CI: 'true', NODE_ENV: 'test', SECRET_TOKEN: 'leak-me-123456' } });
    const joined = args.join(' ');
    assert.match(joined, /--network none/);
    assert.match(joined, /--cap-drop ALL/);
    assert.match(joined, /--security-opt no-new-privileges/);
    assert.match(joined, /--user 1000:1000/);
    assert.match(joined, /-e CI=true/);
    assert.ok(!joined.includes('leak-me-123456') && !joined.includes('SECRET_TOKEN'));
    assert.deepEqual(args.slice(-3), ['sh', '-c', 'npm test']);
  });

  it('installs on a Linux host as before, and in the test image (with network) elsewhere, so native modules match', () => {
    assert.equal(installContainer({ image: 'img' }, 'linux'), undefined);
    assert.deepEqual(installContainer({ image: 'img' }, 'darwin'), { image: 'img', network: true });
    assert.equal(installContainer(undefined, 'darwin'), undefined);
    const args = dockerRunArgs({ name: 'n', image: 'img', network: true, cwd: '/w', command: 'npm ci', env: {} }).join(' ');
    assert.ok(!args.includes('--network'));
    assert.match(args, /--cap-drop ALL/);
  });

  it('runs tests in a container that has no network, no root, and none of the host secrets', { skip: !docker && 'docker is not available' }, async () => {
    const ws = workspaces(repo());
    const w = await ws.createWorkspace();
    // one command proves four things: only the loopback interface exists, not root, the mounted repo is visible, and host secrets are absent
    const r = await (ws as any).runInDir(w.path, 'cat /proc/net/dev; id -u; cat a.txt; env', { CI: 'true', NODE_ENV: 'test', MY_SECRET_KEY: 'host-secret-value-123' }, undefined);
    assert.equal(r.success, true, r.output);
    assert.match(r.output, /lo:/);
    assert.doesNotMatch(r.output, /eth0|en0|wlan/, 'no real network interface');
    if (process.getuid && process.getuid() !== 0) assert.ok(r.output.split('\n').includes(String(process.getuid())), 'runs as the caller, not root');
    assert.match(r.output, /^hi$/m);
    assert.doesNotMatch(r.output, /host-secret-value-123/);
  });

  it('installs with the network once per checkout, then tests and build both see the result', { skip: !docker && 'docker is not available' }, async () => {
    const ws = workspaces(repo(), { installCommand: 'echo installed >> installs.log', testCommand: 'test -f installs.log && cat installs.log', buildCommand: 'test -f installs.log' });
    const w = await ws.createWorkspace();
    const tests = await ws.runTests(w);
    const build = await ws.runBuild(w);
    assert.equal(tests.success, true, tests.output);
    assert.equal(build.success, true, build.output);
    assert.equal((tests.output.match(/installed/g) ?? []).length, 1, 'install ran exactly once');
  });

  it('reports a failed install without running the tests', async () => {
    const ws = workspaces(repo(), { installCommand: 'echo no-such-registry >&2; exit 3', offline: undefined, testCommand: 'echo should-not-run' });
    const r = await ws.runTests(await ws.createWorkspace());
    assert.equal(r.success, false);
    assert.match(r.output, /dependency install failed/);
    assert.doesNotMatch(r.output, /should-not-run/);
  });

  it('kills the container when a run times out, so nothing keeps running', { skip: !docker && 'docker is not available' }, async () => {
    const ws = workspaces(repo(), { testCommand: 'sleep 60', commandTimeoutMs: 2500 });
    const r = await ws.runTests(await ws.createWorkspace());
    assert.equal(r.success, false);
    assert.match(r.output, /timed out/);
    await new Promise((res) => setTimeout(res, 1500));
    assert.equal(execFileSync('docker', ['ps', '-q', '--filter', 'name=blaze-']).toString().trim(), '', 'no container left');
  });
});

// ---- runFix end to end ---------------------------------------------------------------------------------------------

import { auditComment, resolveOffline, runFix, type FixProject } from '../jobs/fix.js';
import type { AIProvider } from '../resolver/ai-provider.js';
import { CHECKOUT_BUILD_COMMAND, CHECKOUT_INCIDENT, CHECKOUT_TEST_COMMAND, CheckoutFixAI, createCheckoutRepo } from '../examples/bug-fix/checkout-discount.js';

function fakeGithub() {
  const calls: { url: string; body: any }[] = [];
  const f = (async (url: string, init: any) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const html_url = url.endsWith('/pulls') ? 'https://github.com/acme/shop/pull/7' : 'https://github.com/acme/shop/issues/8';
    return new Response(JSON.stringify({ html_url, number: 7 }), { status: 201 });
  }) as unknown as typeof fetch;
  return { calls, f };
}

function bareRemote() {
  const root = mkdtempSync(join(tmpdir(), 'blaze-h-'));
  const repo = createCheckoutRepo(join(root, 'checkout'));
  const remote = join(root, 'remote.git');
  execFileSync('git', ['clone', '--quiet', '--bare', repo, remote]);
  return remote;
}

const project: FixProject = { repo: 'acme/shop', defaultBranch: 'main', testCommand: CHECKOUT_TEST_COMMAND, buildCommand: CHECKOUT_BUILD_COMMAND };

describe('offline mode is chosen safely', () => {
  it('fails closed when Docker was asked for and is missing, and opts out only when told to', () => {
    const cfg = { ...project, installCommand: 'npm ci' };
    assert.throws(() => resolveOffline(cfg, () => false), /Docker is not available/);
    assert.deepEqual(resolveOffline({ ...cfg, sandboxImage: 'node:20' }, () => true), { image: 'node:20' });
    assert.deepEqual(resolveOffline(cfg, () => true), { image: 'node:22-bookworm-slim' });
    assert.equal(resolveOffline({ ...cfg, sandbox: 'none' }, () => false), undefined, 'explicit opt-out');
    assert.equal(resolveOffline(project, () => false), undefined, 'configs from before offline tests keep working');
  });
});

describe('runFix with the hardening on', () => {
  it('opens a PR whose tests ran in an offline container, and records an audit comment', { skip: !docker && 'docker is not available' }, async () => {
    const remote = bareRemote();
    const gh = fakeGithub();
    const out = await runFix({
      project: { ...project, installCommand: 'true', sandbox: 'docker', sandboxImage: 'node:22-bookworm-slim' },
      incident: { ...CHECKOUT_INCIDENT, id: 'issue-9' }, reportCount: 3, token: 'tok', ai: new CheckoutFixAI(), remoteUrl: remote, fetch: gh.f,
      issueNumber: 9, audit: { providers: ['anthropic', 'groq'], modelCalls: () => 4, maxAttempts: 3 }
    });
    assert.equal(out.status, 'pr_opened');

    const audit = gh.calls.find((c) => c.url.endsWith('/issues/7/comments'))?.body.body as string;
    assert.ok(audit, 'an audit comment was posted on the PR');
    assert.match(audit, /## BlazeResolver audit/);
    assert.match(audit, /offline: dependencies installed with network from the lockfile, then tests and build ran in a `node:22-bookworm-slim` container with no network/);
    assert.match(audit, /providers in failover order: anthropic, groq; 4 model call/);
    assert.match(audit, /Attempts \| \d of 3 allowed/);
    assert.match(audit, /src\/pricing\.js/);
    assert.match(audit, /Tests before the fix \| failing/);
    assert.match(audit, /Tests after the fix \| passing/);
    assert.match(audit, /Written by the harness, not the model/);
    assert.ok(!/tok\b/.test(audit.replace(/token|took|stock/gi, '')), 'no secrets in the audit');
  });

  it('records honestly when tests were not offline', async () => {
    const remote = bareRemote();
    const gh = fakeGithub();
    await runFix({ project, incident: { ...CHECKOUT_INCIDENT, id: 'issue-10' }, reportCount: 1, token: 'tok', ai: new CheckoutFixAI(), remoteUrl: remote, fetch: gh.f });
    const audit = gh.calls.find((c) => c.url.endsWith('/comments'))?.body.body as string;
    assert.match(audit, /NOT offline: this config predates offline tests/);
  });

  const cheater = (edit: object): AIProvider => ({
    investigate: async () => ({ summary: 's', rootCause: 'r', suspectedFiles: ['package.json', 'src/pricing.js'], confidence: 'medium' }),
    proposeFix: async () => ({ summary: 'sneaky', edits: [edit as never] })
  });

  for (const [name, edit, expected] of [
    ['adding a dependency', { kind: 'replace', path: 'package.json', search: '"private": true', replace: '"private": true, "dependencies": { "evil": "1" }' }, /changing "dependencies" is not allowed/],
    ['planting a credential', { kind: 'create', path: 'src/leak.js', content: 'export const key = "sk-ant-api03-' + 'a'.repeat(40) + '";\n' }, /secret/],
    ['pointing npm at another registry', { kind: 'create', path: '.npmrc', content: 'registry=https://evil.example\n' }, /forbidden path/],
    ['smuggling out the job\'s own token', { kind: 'create', path: 'src/x.js', content: 'export const t = "the-job-token-value-9876";\n' }, /secret/]
  ] as [string, object, RegExp][]) {
    it(`goes to a human instead of ${name}`, async () => {
      const remote = bareRemote();
      const gh = fakeGithub();
      const out = await runFix({ project, incident: { ...CHECKOUT_INCIDENT, id: 'issue-11' }, reportCount: 1, token: 'the-job-token-value-9876', ai: cheater(edit), remoteUrl: remote, fetch: gh.f, issueNumber: 11 });
      assert.equal(out.status, 'needs_human');
      assert.ok(!gh.calls.some((c) => c.url.endsWith('/pulls')), 'no PR');
      assert.doesNotMatch(execFileSync('git', ['--git-dir', remote, 'branch', '--list'], { encoding: 'utf8' }), /blazeresolver/, 'nothing pushed');
      const findings = gh.calls.find((c) => c.url.endsWith('/issues/11/comments'))?.body.body as string;
      assert.match(findings, expected);
      assert.ok(!findings.includes('the-job-token-value-9876') && !findings.includes('a'.repeat(40)), 'the secret is never echoed');
    });
  }
});

describe('audit comment', () => {
  it('escapes table separators in model-written text', () => {
    const md = auditComment({
      result: { status: 'READY_FOR_REVIEW', incident: CHECKOUT_INCIDENT, attempts: [{ number: 1, workspace: { id: 'a', path: '/x' }, proposal: { summary: 's', edits: [] }, tests: { success: true, output: '' }, build: { success: true, output: '' } }], diff: 'diff --git a/a|b.js b/a|b.js\n+x\n', baseline: { success: false, output: '' } },
      project, offline: undefined, unprivileged: false, durationMs: 200_000, reportCount: 1
    });
    assert.match(md, /Duration \| 3m/);
    assert.equal(md.split('\n').filter((l) => l.startsWith('| Files changed')).length, 1);
  });
});
