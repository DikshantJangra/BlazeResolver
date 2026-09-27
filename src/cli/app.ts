import { execFile } from 'node:child_process';
import { createSign, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { REPO_PATTERN } from '../github/index.js';
import { CONFIG_FILE, type Manifest } from './init.js';
import { workflow } from './templates.js';

const WORKFLOW_FILE = '.github/workflows/blazeresolver.yml';

export interface AppCredentials {
  id: number;
  slug: string;
  /** The app's private key. Only ever held in memory, then handed to `gh secret set` on stdin. */
  pem: string;
  htmlUrl: string;
}

/** What the GitHub App may do: exactly what the fix job needs on this one repo, nothing else. */
export function buildManifest(o: { name: string; redirectUrl: string; repo: string }) {
  return {
    name: o.name,
    url: 'https://github.com/DikshantJangra/BlazeResolver',
    redirect_url: o.redirectUrl,
    description: `Opens fix pull requests for customer-reported bugs in ${o.repo}. Created by \`npx blazeresolver app\`. It can create branches and pull requests and comment on issues; it cannot merge, change settings or touch workflows.`,
    public: false,
    default_permissions: { contents: 'write', pull_requests: 'write', issues: 'write' },
    default_events: []
  };
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A page that posts the manifest to GitHub, which is how GitHub's manifest flow starts. Needs no dependencies. */
export function manifestPage(actionUrl: string, manifest: object): string {
  return `<!doctype html><meta charset="utf-8"><title>Create the BlazeResolver GitHub App</title>
<body style="font:16px system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">
<p>Taking you to GitHub to create your app. If nothing happens, press the button.</p>
<form id="f" method="post" action="${escapeAttr(actionUrl)}"><input type="hidden" name="manifest" value="${escapeAttr(JSON.stringify(manifest))}"><button>Create the GitHub App</button></form>
<script>document.getElementById('f').submit()</script></body>`;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

/** The short-lived token an app uses to prove who it is to GitHub, before it can ask for an installation token. */
export function appJwt(appId: number | string, privateKeyPem: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 9 * 60, iss: String(appId) }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKeyPem);
  return `${header}.${payload}.${b64url(signature)}`;
}

/** Trades the one-time code GitHub redirected back with for the app's credentials. GitHub needs no other authentication here. */
export async function exchangeManifestCode(code: string, f: typeof fetch = fetch): Promise<AppCredentials> {
  const res = await f(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`, {
    method: 'POST',
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'blazeresolver' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!res.ok) throw new Error(`GitHub would not turn the code into an app (${res.status}). The code is single use and expires after an hour: run \`npx blazeresolver app\` again.`);
  const body = (await res.json()) as { id: number; slug: string; pem: string; html_url: string };
  return { id: body.id, slug: body.slug, pem: body.pem, htmlUrl: body.html_url };
}

/** Whether the app is installed on the repo, asked as the app itself (so it also proves the key works). */
export async function isInstalled(creds: AppCredentials, repo: string, f: typeof fetch = fetch): Promise<boolean> {
  const res = await f(`https://api.github.com/repos/${repo}/installation`, {
    headers: { authorization: `Bearer ${appJwt(creds.id, creds.pem)}`, accept: 'application/vnd.github+json', 'user-agent': 'blazeresolver' },
    signal: AbortSignal.timeout(20_000)
  });
  return res.ok;
}

export interface ManifestServer {
  /** Where to send the user's browser. */
  url: string;
  credentials: Promise<AppCredentials>;
  close: () => void;
}

/**
 * A one-shot local server for GitHub to redirect back to. It listens on 127.0.0.1 only, on a random port, checks the
 * Host header (against DNS rebinding) and a random `state` (against a stranger's page posting to it), and accepts one
 * callback: then it closes.
 */
export async function startManifestServer(o: { repo: string; ownerType: 'Organization' | 'User'; fetch?: typeof fetch; timeoutMs?: number; name?: string }): Promise<ManifestServer> {
  const state = randomBytes(16).toString('hex');
  const owner = o.repo.split('/')[0];
  let resolve!: (c: AppCredentials) => void;
  let reject!: (e: Error) => void;
  const credentials = new Promise<AppCredentials>((res, rej) => ((resolve = res), (reject = rej)));
  credentials.catch(() => {}); // the caller awaits it; this keeps an unawaited rejection from crashing the process
  let done = false;
  let host = '';

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.headers.host !== host) return void res.writeHead(400).end('bad host');

    if (url.pathname === '/') {
      const manifest = buildManifest({ name: o.name ?? `blazeresolver-${owner}-${randomBytes(2).toString('hex')}`.slice(0, 34), redirectUrl: `http://${host}/callback`, repo: o.repo });
      const action = o.ownerType === 'Organization'
        ? `https://github.com/organizations/${owner}/settings/apps/new?state=${state}`
        : `https://github.com/settings/apps/new?state=${state}`;
      return void res.writeHead(200, { 'content-type': 'text/html' }).end(manifestPage(action, manifest));
    }

    if (url.pathname === '/callback') {
      const given = Buffer.from(url.searchParams.get('state') ?? '');
      const expected = Buffer.from(state);
      const code = url.searchParams.get('code');
      if (done || !code || given.length !== expected.length || !timingSafeEqual(given, expected)) return void res.writeHead(400).end('bad request');
      done = true;
      try {
        resolve(await exchangeManifestCode(code, o.fetch));
        res.writeHead(200, { 'content-type': 'text/html' }).end('<body style="font:16px system-ui;max-width:32rem;margin:4rem auto">The app is created. Go back to your terminal: the next step is installing it on your repo.</body>');
      } catch (err) {
        reject(err as Error);
        res.writeHead(500).end('could not create the app; see your terminal');
      } finally {
        setTimeout(close, 200);
      }
      return;
    }
    res.writeHead(404).end();
  });

  const close = () => server.close();
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const port = (server.address() as { port: number }).port;
  host = `127.0.0.1:${port}`;
  const timer = setTimeout(() => {
    if (!done) {
      done = true;
      reject(new Error('Timed out waiting for you to create the app on GitHub (10 minutes). Run `npx blazeresolver app` again.'));
      close();
    }
  }, o.timeoutMs ?? 600_000);
  timer.unref();
  credentials.finally(() => clearTimeout(timer)).catch(() => {});
  return { url: `http://${host}/`, credentials, close };
}

/** Runs `gh` with optional stdin. Resolves ok=false (never throws) when gh is missing or refuses. */
export type Gh = (args: string[], input?: string) => Promise<{ ok: boolean; out: string }>;

export const gh: Gh = (args, input) =>
  new Promise((resolve) => {
    const child = execFile('gh', args, { maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => resolve({ ok: !err, out: (stdout || stderr || err?.message || '').toString() }));
    child.on('error', () => resolve({ ok: false, out: 'gh is not installed' }));
    if (input !== undefined) child.stdin?.end(input);
  });

/** Sets a repo secret. The value goes through gh's stdin, never a command line, a file or a log. */
export async function setRepoSecret(name: string, value: string, repo: string, run: Gh = gh): Promise<boolean> {
  return (await run(['secret', 'set', name, '--repo', repo], value)).ok;
}

export const openInBrowser = (url: string) => {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  execFile(cmd, args as string[], () => {});
};

export interface AppOptions {
  root: string;
  repo: string;
  log?: (line: string) => void;
  open?: (url: string) => void;
  fetch?: typeof fetch;
  run?: Gh;
  /** Where the key goes when `gh` can't store it. Defaults to ~/.blazeresolver. */
  keyDir?: string;
  /** How long to wait for the app to be installed, and how often to check. */
  installTimeoutMs?: number;
  pollMs?: number;
  serverTimeoutMs?: number;
}

export interface AppResult {
  slug: string;
  appId: number;
  installed: boolean;
  /** Names of the repo secrets that were set. */
  secrets: string[];
  /** Where the private key was saved because gh could not store it, if it could not. */
  keyFile?: string;
  workflowUpdated: boolean;
}

/**
 * Creates a GitHub App for this repo through GitHub's manifest flow, stores its credentials as repo secrets, and
 * switches the workflow to use it. After this the fix job's token is short-lived and scoped to the one repo, and the
 * pull requests it opens trigger your CI (the built-in token's PRs do not).
 */
export async function runApp(opts: AppOptions): Promise<AppResult> {
  const log = opts.log ?? console.log;
  const f = opts.fetch ?? fetch;
  const run = opts.run ?? gh;
  const { repo, root } = opts;
  if (!REPO_PATTERN.test(repo)) throw new Error(`"${repo}" is not owner/name`);

  const owner = repo.split('/')[0];
  const ownerType = await f(`https://api.github.com/users/${owner}`, { headers: { 'user-agent': 'blazeresolver' }, signal: AbortSignal.timeout(15_000) })
    .then(async (r) => (r.ok ? (((await r.json()) as { type?: string }).type === 'Organization' ? 'Organization' : 'User') : 'User'))
    .catch(() => 'User' as const);

  const server = await startManifestServer({ repo, ownerType, fetch: f, timeoutMs: opts.serverTimeoutMs });
  log(`\nOpening GitHub to create your app for ${repo}${ownerType === 'Organization' ? ` (in the ${owner} organization)` : ''}.`);
  log(`If the browser does not open, go to: ${server.url}`);
  log('On GitHub, click "Create GitHub App". You can leave every setting as it is.\n');
  (opts.open ?? openInBrowser)(server.url);

  const creds = await server.credentials;
  log(`Created the app "${creds.slug}".`);

  const secrets: string[] = [];
  let keyFile: string | undefined;
  const idOk = await setRepoSecret('BLAZE_APP_ID', String(creds.id), repo, run);
  const keyOk = idOk && (await setRepoSecret('BLAZE_APP_PRIVATE_KEY', creds.pem, repo, run));
  if (idOk) secrets.push('BLAZE_APP_ID');
  if (keyOk) secrets.push('BLAZE_APP_PRIVATE_KEY');
  if (!keyOk) {
    // gh is missing or not logged in: keep the key somewhere only the user can read, and say exactly what to do with it.
    const dir = opts.keyDir ?? join(homedir(), '.blazeresolver');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    keyFile = join(dir, `${creds.slug}.private-key.pem`);
    writeFileSync(keyFile, creds.pem, { mode: 0o600 });
    chmodSync(keyFile, 0o600);
    log('\nCould not store the secrets with the GitHub CLI. Add them yourself (GitHub, Settings, Secrets and variables, Actions):');
    log(`  BLAZE_APP_ID = ${creds.id}`);
    log(`  BLAZE_APP_PRIVATE_KEY = the contents of ${keyFile}`);
    log(`  or:  gh secret set BLAZE_APP_PRIVATE_KEY --repo ${repo} < "${keyFile}"   then delete that file.`);
  } else {
    log('Stored BLAZE_APP_ID and BLAZE_APP_PRIVATE_KEY as repo secrets. The private key was not written to disk.');
  }

  const installUrl = `https://github.com/apps/${creds.slug}/installations/new`;
  log(`\nNow install it on ${repo} (choose "Only select repositories", then ${repo}):\n  ${installUrl}`);
  (opts.open ?? openInBrowser)(installUrl);

  let installed = false;
  const deadline = Date.now() + (opts.installTimeoutMs ?? 300_000);
  while (Date.now() < deadline) {
    if (await isInstalled(creds, repo, f).catch(() => false)) {
      installed = true;
      break;
    }
    await new Promise((r) => setTimeout(r, opts.pollMs ?? 3000));
  }
  log(installed ? `Confirmed: the app is installed on ${repo}.` : `Not installed yet. Do it at ${installUrl}, then you are done.`);

  const workflowUpdated = useAppInWorkflow(root, secrets, log);
  log('\nDone. You can now turn OFF "Allow GitHub Actions to create and approve pull requests" (Settings, Actions, General): the App opens the PRs, so Actions no longer needs it.');
  return { slug: creds.slug, appId: creds.id, installed, secrets, keyFile, workflowUpdated };
}

/** Switches the workflow to the App variant if it is still exactly what init wrote, and records the secrets for `remove`. */
function useAppInWorkflow(root: string, secrets: string[], log: (l: string) => void): boolean {
  const configPath = join(root, CONFIG_FILE);
  if (!existsSync(configPath)) {
    log('No blazeresolver.config.json here, so the workflow was not changed. Run `npx blazeresolver init --app` in your repo.');
    return false;
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { pin?: string; app?: boolean; installed?: Manifest };
  const file = join(root, WORKFLOW_FILE);
  let updated = false;
  if (existsSync(file)) {
    if (readFileSync(file, 'utf8') === workflow({ pin: config.pin, app: config.app })) {
      writeFileSync(file, workflow({ pin: config.pin, app: true }));
      log(`Updated ${WORKFLOW_FILE} to use the App token.`);
      updated = true;
    } else {
      log(`${WORKFLOW_FILE} has been edited, so it was left alone. Re-run \`npx blazeresolver init --force --app\` to regenerate it, or copy the App step from the docs.`);
    }
  }
  config.app = true;
  config.installed = { ...(config.installed ?? { files: [], edits: [] }), secrets: [...new Set([...(config.installed?.secrets ?? []), ...secrets])] };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  return updated;
}
