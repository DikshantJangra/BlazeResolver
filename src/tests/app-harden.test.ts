import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appJwt, buildManifest, runApp, startManifestServer, type Gh } from '../cli/app.js';
import { codeownersBlock, rulesetBody, runHarden, RULESET_NAME } from '../cli/harden.js';
import { runInit } from '../cli/init.js';
import { runRemove } from '../cli/remove.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'blaze-a-'));
const keys = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });

function repo(files: Record<string, string> = {}) {
  const dir = tmp();
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:acme/shop.git'], { cwd: dir });
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}
const snapshot = (dir: string, base = dir, out: Record<string, string> = {}) => {
  for (const e of readdirSync(dir)) {
    if (e === '.git') continue;
    const p = join(dir, e);
    statSync(p).isDirectory() ? snapshot(p, base, out) : (out[p.slice(base.length + 1)] = readFileSync(p, 'utf8'));
  }
  return out;
};
const nextApp = () => repo({ 'package.json': JSON.stringify({ dependencies: { next: '15' }, scripts: { test: 'vitest' } }), 'app/layout.jsx': '<html><body>{children}</body></html>\n' });

/** GitHub as far as the app flow can see it. */
function fakeGithub(o: { ownerType?: string; installedAfter?: number } = {}) {
  let installChecks = 0;
  const seen: { url: string; auth?: string }[] = [];
  const f = (async (url: string, init: any = {}) => {
    seen.push({ url, auth: init.headers?.authorization });
    if (url.includes('/users/acme')) return new Response(JSON.stringify({ type: o.ownerType ?? 'Organization' }));
    if (url.includes('/app-manifests/CODE123/conversions')) return new Response(JSON.stringify({ id: 4242, slug: 'blazeresolver-acme-ab12', pem: keys.privateKey, html_url: 'https://github.com/apps/blazeresolver-acme-ab12' }), { status: 201 });
    if (url.endsWith('/repos/acme/shop/installation')) return new Response('{}', { status: ++installChecks > (o.installedAfter ?? 1) ? 200 : 404 });
    return new Response('nope', { status: 404 });
  }) as unknown as typeof fetch;
  return { f, seen };
}

/** The user's browser: loads our page, then does what GitHub would (redirect back with a code and our state). */
async function browser(url: string, code = 'CODE123') {
  const html = await (await fetch(url)).text();
  const action = html.match(/action="([^"]+)"/)![1].replace(/&amp;/g, '&');
  const manifest = JSON.parse(html.match(/name="manifest" value="([^"]*)"/)![1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  const state = new URL(action).searchParams.get('state')!;
  const back = await fetch(`${manifest.redirect_url}?code=${code}&state=${state}`);
  return { action, manifest, state, status: back.status };
}

const gh = (over: Partial<Record<string, { ok: boolean; out: string }>> = {}) => {
  const calls: { args: string[]; input?: string }[] = [];
  const run: Gh = async (args, input) => {
    calls.push({ args, input });
    const key = args.join(' ');
    // overrides match the command line or the request body, like a real API would see both
    for (const [pattern, result] of Object.entries(over)) if (`${key} ${input ?? ''}`.includes(pattern)) return result!;
    if (key === 'api user --jq .login') return { ok: true, out: 'octocat\n' };
    if (key === 'api repos/acme/shop/rulesets') return { ok: true, out: '[]' };
    return { ok: true, out: '{}' };
  };
  return { run, calls };
};

describe('GitHub App creation', () => {
  it('asks for exactly the permissions the fix job needs, on a private app', () => {
    const m = buildManifest({ name: 'x', redirectUrl: 'http://127.0.0.1:1/callback', repo: 'acme/shop' });
    assert.deepEqual(m.default_permissions, { contents: 'write', pull_requests: 'write', issues: 'write' });
    assert.equal(m.public, false);
    assert.deepEqual(m.default_events, []);
    assert.equal(m.redirect_url, 'http://127.0.0.1:1/callback');
  });

  it('signs a JWT GitHub can verify: RS256, the app id as issuer, expiring within 10 minutes', () => {
    const jwt = appJwt(4242, keys.privateKey, 1_700_000_000);
    const [h, p, sig] = jwt.split('.');
    assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { alg: 'RS256', typ: 'JWT' });
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    assert.equal(payload.iss, '4242');
    assert.ok(payload.exp - payload.iat <= 10 * 60);
    assert.ok(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(keys.publicKey, Buffer.from(sig, 'base64url')));
  });

  it('runs the whole flow: create, store secrets without touching disk, confirm the install, switch the workflow', async () => {
    const root = nextApp();
    await runInit({ cwd: root, noInstall: true, log: () => {} });
    const github = fakeGithub({ installedAfter: 1 });
    const g = gh();
    const keyDir = tmp();
    const out: string[] = [];
    let installUrl = '';
    let seenForm: Awaited<ReturnType<typeof browser>> | undefined;

    const result = await runApp({
      root, repo: 'acme/shop', fetch: github.f, run: g.run, keyDir, pollMs: 10, installTimeoutMs: 3000, log: (l) => out.push(l),
      open: (url) => (url.startsWith('http://127.0.0.1') ? void browser(url).then((r) => (seenForm = r)) : void (installUrl = url))
    });

    assert.equal(result.appId, 4242);
    assert.equal(result.installed, true, 'the app is confirmed installed, which also proves its key works');
    assert.deepEqual(result.secrets, ['BLAZE_APP_ID', 'BLAZE_APP_PRIVATE_KEY']);
    assert.equal(installUrl, 'https://github.com/apps/blazeresolver-acme-ab12/installations/new');

    // the org's settings page, with our random state; the manifest points back at our loopback port only
    assert.match(seenForm!.action, /^https:\/\/github\.com\/organizations\/acme\/settings\/apps\/new\?state=[0-9a-f]{32}$/);
    assert.match(seenForm!.manifest.redirect_url, /^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    assert.equal(seenForm!.status, 200);

    // secrets went through gh's stdin; the key was not written anywhere and is not in any log line
    const idCall = g.calls.find((c) => c.args.join(' ') === 'secret set BLAZE_APP_ID --repo acme/shop');
    const keyCall = g.calls.find((c) => c.args.join(' ') === 'secret set BLAZE_APP_PRIVATE_KEY --repo acme/shop');
    assert.equal(idCall?.input, '4242');
    assert.equal(keyCall?.input, keys.privateKey);
    assert.ok(!g.calls.some((c) => c.args.join(' ').includes('BEGIN')), 'never on a command line');
    assert.equal(readdirSync(keyDir).length, 0);
    assert.ok(!out.join('\n').includes('BEGIN') && !out.join('\n').includes(keys.privateKey.slice(40, 80)));

    // the install check was made as the app, with a JWT
    const asApp = github.seen.find((s) => s.url.endsWith('/installation'));
    assert.match(asApp!.auth!, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);

    // workflow now uses the App token, config and manifest remember it
    assert.equal(result.workflowUpdated, true);
    assert.match(readFileSync(join(root, '.github/workflows/blazeresolver.yml'), 'utf8'), /create-github-app-token@[0-9a-f]{40}/);
    const config = JSON.parse(readFileSync(join(root, 'blazeresolver.config.json'), 'utf8'));
    assert.equal(config.app, true);
    assert.deepEqual(config.installed.secrets, ['BLAZE_APP_ID', 'BLAZE_APP_PRIVATE_KEY']);
  });

  it('uses a personal account settings page for a user repo', async () => {
    const server = await startManifestServer({ repo: 'acme/shop', ownerType: 'User', fetch: fakeGithub().f });
    const page = await (await fetch(server.url)).text();
    assert.match(page, /action="https:\/\/github\.com\/settings\/apps\/new\?state=/);
    server.close();
  });

  it('keeps the key in a private file, and says what to do, when gh cannot store it', async () => {
    const root = nextApp();
    const keyDir = tmp();
    const out: string[] = [];
    const result = await runApp({
      root, repo: 'acme/shop', fetch: fakeGithub().f, run: async () => ({ ok: false, out: 'gh is not installed' }), keyDir, pollMs: 5, installTimeoutMs: 50, log: (l) => out.push(l),
      open: (url) => void (url.startsWith('http://127.0.0.1') && browser(url))
    });
    assert.deepEqual(result.secrets, []);
    assert.ok(result.keyFile?.startsWith(keyDir));
    assert.equal(readFileSync(result.keyFile!, 'utf8'), keys.privateKey);
    if (process.platform !== 'win32') assert.equal(statSync(result.keyFile!).mode & 0o777, 0o600, 'only the user can read it');
    assert.match(out.join('\n'), /BLAZE_APP_ID = 4242/);
    assert.ok(!out.join('\n').includes('BEGIN'), 'the key is never printed');
  });

  it('refuses a callback with the wrong state, the wrong host, or a replay', async () => {
    const github = fakeGithub();
    const server = await startManifestServer({ repo: 'acme/shop', ownerType: 'User', fetch: github.f, timeoutMs: 5000 });
    const base = server.url.replace(/\/$/, '');

    assert.equal((await fetch(`${base}/callback?code=CODE123&state=${'0'.repeat(32)}`)).status, 400, 'a stranger without our state');
    assert.equal((await fetch(`${base}/callback?state=x`)).status, 400, 'no code');
    // DNS rebinding: right port, wrong Host header
    const rebinding = await new Promise<number>((res) => {
      const port = new URL(server.url).port;
      request({ host: '127.0.0.1', port, path: '/', headers: { host: 'evil.example' } }, (r) => res(r.statusCode!)).end();
    });
    assert.equal(rebinding, 400);
    assert.ok(!github.seen.some((s) => s.url.includes('/app-manifests/')), 'nothing was exchanged for any of those');

    const first = await browser(server.url);
    assert.equal(first.status, 200);
    assert.equal((await server.credentials).id, 4242);
    const replay = await fetch(`${base}/callback?code=CODE123&state=${first.state}`).then((r) => r.status).catch(() => 'closed');
    assert.ok(replay === 400 || replay === 'closed', 'a second callback is not accepted');
  });
});

describe('harden', () => {
  it('builds a ruleset that needs a human: no deletion, no force push, an approval, code owners', () => {
    const b = rulesetBody(false);
    assert.equal(b.name, RULESET_NAME);
    assert.deepEqual(b.rules.map((r) => r.type), ['deletion', 'non_fast_forward', 'pull_request']);
    const pr = b.rules[2].parameters as any;
    assert.equal(pr.required_approving_review_count, 1);
    assert.equal(pr.require_code_owner_review, true);
    assert.equal(pr.dismiss_stale_reviews_on_push, true);
    assert.deepEqual(b.conditions.ref_name.include, ['~DEFAULT_BRANCH']);
    assert.deepEqual(b.bypass_actors, [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'pull_request' }], 'admins only, and only through a PR');
    assert.deepEqual(rulesetBody(true).bypass_actors, [], '--strict: not even admins');
  });

  it('applies everything, and only through the calls it should make', async () => {
    const root = nextApp();
    await runInit({ cwd: root, noInstall: true, log: () => {} });
    const g = gh();
    const steps = await runHarden({ root, repo: 'acme/shop', run: g.run, log: () => {} });

    assert.deepEqual(steps.map((s) => `${s.name}:${s.status}`), ['branch ruleset:done', 'CODEOWNERS:done', 'Actions permissions:done', 'secret scanning:done']);
    const post = g.calls.find((c) => c.args.join(' ') === 'api -X POST repos/acme/shop/rulesets --input -')!;
    assert.equal(JSON.parse(post.input!).name, RULESET_NAME);
    const perms = g.calls.find((c) => c.args.includes('repos/acme/shop/actions/permissions/workflow'))!;
    assert.deepEqual(JSON.parse(perms.input!), { default_workflow_permissions: 'read' }, 'without an App, Actions must keep creating PRs');
    const patch = JSON.parse(g.calls.find((c) => c.args.join(' ') === 'api -X PATCH repos/acme/shop --input -')!.input!);
    assert.equal(patch.security_and_analysis.secret_scanning_push_protection.status, 'enabled');
    assert.equal(readFileSync(join(root, '.github/CODEOWNERS'), 'utf8'), codeownersBlock('@octocat'));
  });

  it('updates its own ruleset in place instead of making a second one', async () => {
    const g = gh({ 'api repos/acme/shop/rulesets': { ok: true, out: JSON.stringify([{ id: 77, name: RULESET_NAME }]) } });
    await runHarden({ root: repo(), repo: 'acme/shop', owner: '@me', run: g.run, log: () => {} });
    assert.ok(g.calls.some((c) => c.args.join(' ') === 'api -X PUT repos/acme/shop/rulesets/77 --input -'));
    assert.ok(!g.calls.some((c) => c.args.join(' ') === 'api -X POST repos/acme/shop/rulesets --input -'));
  });

  it('with a GitHub App, Actions can no longer approve PRs', async () => {
    const root = nextApp();
    await runInit({ cwd: root, noInstall: true, log: () => {}, app: true });
    const g = gh();
    await runHarden({ root, repo: 'acme/shop', run: g.run, log: () => {} });
    const perms = g.calls.find((c) => c.args.includes('repos/acme/shop/actions/permissions/workflow'))!;
    assert.deepEqual(JSON.parse(perms.input!), { default_workflow_permissions: 'read', can_approve_pull_request_reviews: false });
  });

  it('carries on past a step GitHub refuses, and says why', async () => {
    const g = gh({ 'rulesets': { ok: false, out: 'HTTP 403: Upgrade to GitHub Pro or make this repository public to enable this feature.' }, 'security_and_analysis': { ok: false, out: 'HTTP 422' } });
    const out: string[] = [];
    const steps = await runHarden({ root: repo(), repo: 'acme/shop', owner: '@me', run: g.run, log: (l) => out.push(l) });
    assert.equal(steps.find((s) => s.name === 'branch ruleset')!.status, 'failed');
    assert.match(steps.find((s) => s.name === 'branch ruleset')!.detail, /Upgrade to GitHub Pro/);
    assert.equal(steps.find((s) => s.name === 'CODEOWNERS')!.status, 'done', 'the other steps still ran');
    assert.equal(steps.find((s) => s.name === 'Actions permissions')!.status, 'done');
    assert.equal(steps.find((s) => s.name === 'secret scanning')!.status, 'skipped');
  });

  it('changes nothing on --dry-run or when you decline', async () => {
    const root = repo();
    const before = snapshot(root);
    const dry = gh();
    const planned = await runHarden({ root, repo: 'acme/shop', owner: '@me', dryRun: true, run: dry.run, log: () => {} });
    assert.ok(planned.every((s) => s.status === 'planned'));
    assert.equal(dry.calls.length, 0, 'not a single call to GitHub');

    const declined = gh();
    const steps = await runHarden({ root, repo: 'acme/shop', owner: '@me', run: declined.run, log: () => {}, confirm: async () => false });
    assert.deepEqual(steps, []);
    assert.ok(!declined.calls.some((c) => c.args.includes('POST') || c.args.includes('PUT') || c.args.includes('PATCH')));
    assert.deepEqual(snapshot(root), before);
  });

  it('appends to an existing CODEOWNERS and never twice', async () => {
    const root = repo({ '.github/CODEOWNERS': '* @team\n' });
    const g = gh();
    await runHarden({ root, repo: 'acme/shop', owner: '@me', run: g.run, log: () => {} });
    const after = readFileSync(join(root, '.github/CODEOWNERS'), 'utf8');
    assert.ok(after.startsWith('* @team\n\n# BlazeResolver: a human owner'));
    const again = await runHarden({ root, repo: 'acme/shop', owner: '@me', run: g.run, log: () => {} });
    assert.equal(again.find((s) => s.name === 'CODEOWNERS')!.status, 'skipped');
    assert.equal(readFileSync(join(root, '.github/CODEOWNERS'), 'utf8'), after);
  });
});

describe('remove undoes the App and hardening', () => {
  it('takes back the CODEOWNERS block exactly, deletes the app secrets, and leaves the ruleset alone', async () => {
    const root = repo({ 'package.json': JSON.stringify({ dependencies: { next: '15' } }), 'app/layout.jsx': '<html><body>{children}</body></html>\n', '.github/CODEOWNERS': '* @team\n' });
    const before = snapshot(root);
    await runInit({ cwd: root, noInstall: true, log: () => {} });
    await runHarden({ root, repo: 'acme/shop', owner: '@me', run: gh().run, log: () => {} });
    await runApp({
      root, repo: 'acme/shop', fetch: fakeGithub().f, run: gh().run, keyDir: tmp(), pollMs: 5, installTimeoutMs: 500, log: () => {},
      open: (url) => void (url.startsWith('http://127.0.0.1') && browser(url))
    });

    const deleter = gh();
    const out: string[] = [];
    const result = await runRemove({ cwd: root, yes: true, noUninstall: true, log: (l) => out.push(l), run: deleter.run });
    assert.deepEqual(result.secretsDeleted, ['BLAZE_APP_ID', 'BLAZE_APP_PRIVATE_KEY']);
    assert.ok(deleter.calls.some((c) => c.args.join(' ') === 'secret delete BLAZE_APP_ID --repo acme/shop'));
    assert.ok(!deleter.calls.some((c) => c.args.includes('rulesets')), 'the ruleset protects your branch, so it stays');
    assert.match(out.join('\n'), /branch ruleset "BlazeResolver: protect the default branch"/);
    assert.deepEqual(snapshot(root), before, 'every file is back exactly as it was');
  });

  it('deletes a CODEOWNERS that harden created, and only that', async () => {
    const root = nextApp();
    await runInit({ cwd: root, noInstall: true, log: () => {} });
    await runHarden({ root, repo: 'acme/shop', owner: '@me', run: gh().run, log: () => {} });
    assert.ok(existsSync(join(root, '.github/CODEOWNERS')));
    await runRemove({ cwd: root, yes: true, noUninstall: true, log: () => {} });
    assert.ok(!existsSync(join(root, '.github/CODEOWNERS')));
    assert.ok(!existsSync(join(root, '.github')), 'and the folder, once empty');
  });
});
