import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectRepo, findPackages, pickLayout } from '../cli/detect.js';
import { insertAfter, stripManaged } from '../cli/edit.js';
import { runInit } from '../cli/init.js';
import { runRemove } from '../cli/remove.js';

const pj = (o: object) => JSON.stringify(o, null, 2) + '\n';

/** A throwaway git repo with a GitHub remote and the given files. */
function repo(files: Record<string, string>, remote = 'git@github.com:acme/shop.git') {
  const dir = mkdtempSync(join(tmpdir(), 'blaze-l-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  if (remote) execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: dir });
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

/** Every file and its content, so a test can prove remove puts the repo back exactly. */
function snapshot(dir: string, base = dir, out: Record<string, string> = {}) {
  for (const e of readdirSync(dir)) {
    if (e === '.git' || e === 'node_modules') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) snapshot(p, base, out);
    else out[p.slice(base.length + 1)] = readFileSync(p, 'utf8');
  }
  return out;
}

const quiet = { log: () => {}, noInstall: true };
const read = (dir: string, f: string) => readFileSync(join(dir, f), 'utf8');

const EXPRESS_ESM = `import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.get('/health', (req, res) => res.json({ ok: true }));
app.listen(process.env.PORT || 4000);
`;
const EXPRESS_CJS = `'use strict';
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.listen(5000);
`;

describe('init finds frontend and backend by what they are, not what they are called', () => {
  it('api/ + ui/, run from inside the frontend folder: everything lands in the right place', async () => {
    const dir = repo({
      'api/package.json': pj({ name: 'api', type: 'module', scripts: { start: 'node src/server.js', test: 'node --test' }, dependencies: { express: '4', cors: '2' } }),
      'api/package-lock.json': '{}',
      'api/src/server.js': EXPRESS_ESM,
      'api/.env.example': 'PORT=4000\n',
      'ui/package.json': pj({ name: 'ui', scripts: { build: 'vite build' }, dependencies: { react: '19', vite: '6' } }),
      'ui/index.html': '<html>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n',
      'ui/vite.config.js': 'export default {}\n'
    });
    const before = snapshot(dir);
    const r = await runInit({ cwd: join(dir, 'ui'), ...quiet });

    assert.equal(r.root.endsWith(dir.split('/').pop()!), true);
    assert.deepEqual(r.layout, { frontend: 'ui', backend: 'api', handler: 'express' });
    // GitHub only reads workflows at the repo root, never in the folder the command ran from
    assert.ok(existsSync(join(dir, '.github/workflows/blazeresolver.yml')));
    assert.ok(!existsSync(join(dir, 'ui/.github')));
    assert.ok(existsSync(join(dir, 'blazeresolver.config.json')));

    assert.match(read(dir, 'api/src/blazeresolver.js'), /export default nodeHandler\(createHandler\(\{ repo: 'acme\/shop', allowOrigin/);
    const server = read(dir, 'api/src/server.js');
    assert.match(server, /import blazeresolver from '\.\/blazeresolver\.js'; \/\/ blazeresolver:managed/);
    assert.match(server, /const app = express\(\);\napp\.all\('\/api\/blaze', blazeresolver\); \/\/ blazeresolver:managed/);
    assert.ok(server.indexOf("import blazeresolver") < server.indexOf('const app'), 'import comes before use');
    assert.match(read(dir, 'api/.env.example'), /BLAZE_GITHUB_TOKEN= # blazeresolver:managed/);

    // separate origins: the widget must call the backend's port, and the user is told to change it for production
    assert.match(read(dir, 'ui/index.html'), /data-endpoint="http:\/\/localhost:4000\/api\/blaze"><\/script><!-- blazeresolver:managed -->\n  <\/body>/);
    assert.ok(r.manual.some((m) => m.includes('production API URL')));
    assert.equal(r.manifest.dependency?.dir, 'api');

    const config = JSON.parse(read(dir, 'blazeresolver.config.json'));
    // install needs network and runs first; tests and build then run offline in a container
    assert.equal(config.installCommand, '(cd api && npm ci) && (cd ui && npm install)');
    assert.equal(config.testCommand, '(cd api && npm test)');
    assert.equal(config.buildCommand, '(cd ui && npm run build)');
    assert.equal(config.sandbox, 'docker');
    assert.equal(config.sandboxImage, 'node:22-bookworm-slim');
    execFileSync('node', ['--check', join(dir, 'api/src/server.js')]);

    await runRemove({ cwd: dir, yes: true, noUninstall: true, log: () => {} });
    assert.deepEqual(snapshot(dir), before, 'remove leaves the repo exactly as it was');
  });

  it('CommonJS backend + CRA frontend with a dev proxy: require before use, relative endpoint', async () => {
    const dir = repo({
      'backend/package.json': pj({ name: 'be', main: 'index.js', dependencies: { express: '4' } }),
      'backend/index.js': EXPRESS_CJS,
      'frontend/package.json': pj({ name: 'fe', proxy: 'http://localhost:5000', dependencies: { react: '19', 'react-scripts': '5' } }),
      'frontend/public/index.html': '<body>\n<div id="root"></div>\n</body>\n'
    });
    const before = snapshot(dir);
    const r = await runInit({ cwd: dir, ...quiet });

    assert.equal(r.endpoint, '/api/blaze');
    assert.ok(!r.manual.some((m) => m.includes('production API URL')));
    assert.match(read(dir, 'backend/blazeresolver.js'), /module\.exports = nodeHandler/);
    const entry = read(dir, 'backend/index.js');
    assert.match(entry, /const cors = require\('cors'\);\nconst blazeresolver = require\('\.\/blazeresolver'\); \/\/ blazeresolver:managed/);
    assert.match(entry, /const app = express\(\);\napp\.all\('\/api\/blaze', blazeresolver\); \/\/ blazeresolver:managed/);
    execFileSync('node', ['--check', join(dir, 'backend/index.js')]);
    assert.match(read(dir, 'frontend/public/index.html'), /data-endpoint="\/api\/blaze"/);

    await runRemove({ cwd: dir, yes: true, noUninstall: true, log: () => {} });
    assert.deepEqual(snapshot(dir), before);
  });

  it('TypeScript backend under node16 resolution gets the .js extension; other TS setups do not', async () => {
    const files = (moduleResolution: string) => ({
      'server/package.json': pj({ name: 's', scripts: { dev: 'tsx watch src/index.ts' }, dependencies: { express: '4' } }),
      'server/tsconfig.json': `{ "compilerOptions": { "module": "${moduleResolution}", "moduleResolution": "${moduleResolution}" } }\n`,
      'server/src/index.ts': "import express from 'express';\n\nconst app = express();\napp.listen(3000);\n",
      'client/package.json': pj({ name: 'c', dependencies: { vue: '3', vite: '6' } }),
      'client/index.html': '<body></body>\n'
    });
    const a = repo(files('nodenext'));
    await runInit({ cwd: a, ...quiet });
    assert.match(read(a, 'server/src/index.ts'), /import blazeresolver from '\.\/blazeresolver\.js'/);
    assert.ok(existsSync(join(a, 'server/src/blazeresolver.ts')));

    const b = repo(files('bundler'));
    await runInit({ cwd: b, ...quiet });
    assert.match(read(b, 'server/src/index.ts'), /import blazeresolver from '\.\/blazeresolver';/);
  });

  it('Next.js App Router: endpoint and widget in the same app, nothing else edited', async () => {
    const layout = `import type { ReactNode } from 'react';\nimport './globals.css';\n\nexport default function Root({ children }: { children: ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`;
    const dir = repo({
      'package.json': pj({ name: 'shop', dependencies: { next: '15', react: '19' }, scripts: { test: 'vitest', build: 'next build' } }),
      'package-lock.json': '{}',
      'tsconfig.json': '{}',
      'src/app/layout.tsx': layout,
      'src/app/page.tsx': 'export default function P() { return null }\n'
    });
    const before = snapshot(dir);
    const r = await runInit({ cwd: dir, ...quiet });

    assert.equal(r.layout.handler, 'next');
    assert.ok(existsSync(join(dir, 'src/app/api/blaze/route.ts')));
    const l = read(dir, 'src/app/layout.tsx');
    assert.match(l, /import '\.\/globals\.css';\nimport Script from 'next\/script'; \/\/ blazeresolver:managed/);
    // <body>{children}</body> shares a line, so the widget goes inside the body on that line, fenced for remove
    assert.match(l, /<body>\{children\}\{\/\* blazeresolver:inline-start \*\/\}<Script src="https:\/\/cdn\.jsdelivr\.net\/npm\/blazeresolver@latest\/widget\/widget\.js" data-endpoint="\/api\/blaze" strategy="afterInteractive" \/>\{\/\* blazeresolver:inline-end \*\/\}<\/body>/);
    assert.ok(l.indexOf('<Script') > l.indexOf('<body>'), 'the widget is inside <body>');
    assert.equal(r.endpoint, '/api/blaze');

    await runRemove({ cwd: dir, yes: true, noUninstall: true, log: () => {} });
    assert.deepEqual(snapshot(dir), before);
  });

  it('Next.js Pages Router gets a pages/api route', async () => {
    const dir = repo({ 'package.json': pj({ dependencies: { next: '14', react: '18' } }), 'pages/index.js': '', 'pages/_document.js': '' });
    const r = await runInit({ cwd: dir, ...quiet });
    assert.ok(existsSync(join(dir, 'pages/api/blaze.js')));
    assert.match(read(dir, 'pages/api/blaze.js'), /export default nodeHandler\(createHandler/);
    assert.equal(r.layout.handler, 'next');
  });

  it('monorepo with workspaces: apps/web is found, and the fix runs the root scripts once', async () => {
    const dir = repo({
      'package.json': pj({ name: 'mono', workspaces: ['apps/*'], scripts: { test: 'turbo test', build: 'turbo build' } }),
      'package-lock.json': '{}',
      'apps/web/package.json': pj({ name: 'web', dependencies: { next: '15' } }),
      'apps/web/app/layout.jsx': '<html><body>{children}</body></html>\n',
      'apps/docs/package.json': pj({ name: 'docs', dependencies: { astro: '4' } })
    });
    const r = await runInit({ cwd: join(dir, 'apps/docs'), ...quiet });
    assert.equal(r.layout.frontend, 'apps/web');
    assert.ok(existsSync(join(dir, 'apps/web/app/api/blaze/route.js')));
    assert.ok(existsSync(join(dir, '.github/workflows/blazeresolver.yml')));
    const config = JSON.parse(read(dir, 'blazeresolver.config.json'));
    assert.equal(config.installCommand, 'npm ci');
    assert.equal(config.testCommand, 'npm test');
    assert.equal(config.buildCommand, 'npm run build');
    assert.deepEqual(r.manifest.dependency, { dir: 'apps/web', pm: 'npm', workspace: 'apps/web' });
  });

  it('never edits code it cannot place with certainty; writes the router and says what to add', async () => {
    const dir = repo({
      'server/package.json': pj({ dependencies: { express: '4' } }),
      'server/index.js': "const express = require('express');\nconst app = express()\n  .use(require('cors')());\napp.listen(3000);\n"
    });
    const before = read(dir, 'server/index.js');
    const r = await runInit({ cwd: dir, ...quiet });
    assert.equal(read(dir, 'server/index.js'), before, 'entry file untouched');
    assert.ok(existsSync(join(dir, 'server/blazeresolver.js')));
    assert.ok(r.manual.some((m) => m.includes("app.all('/api/blaze'")));
  });

  it('a non-Express backend gets a snippet, not a guess', async () => {
    const dir = repo({ 'api/package.json': pj({ dependencies: { fastify: '5' } }) });
    const r = await runInit({ cwd: dir, ...quiet });
    assert.ok(r.manual.some((m) => m.includes('does not use Express')));
    assert.deepEqual(r.manifest.files.sort(), [
      '.github/workflows/blazeresolver.yml',
      'agents/blaze_resolver_agent.py',
      'agents/blaze_triage_agent.py',
      'agents/requirements.txt',
      'blazeresolver.config.json'
    ]);
  });

  it('a repo with no Node app still gets the workflow and clear guidance instead of a crash', async () => {
    const dir = repo({ 'README.md': 'hi\n' });
    const r = await runInit({ cwd: dir, ...quiet });
    assert.equal(r.layout.handler, 'none');
    assert.ok(r.manual.some((m) => m.includes('No Node backend')));
  });

  it('honors --backend/--frontend and what the user types at the prompt', async () => {
    const files = {
      'services/a/package.json': pj({ dependencies: { express: '4' } }), 'services/a/index.js': EXPRESS_CJS,
      'services/b/package.json': pj({ dependencies: { express: '4' } }), 'services/b/index.js': EXPRESS_CJS,
      'web/package.json': pj({ dependencies: { vite: '6' } }), 'web/index.html': '<body></body>\n'
    };
    assert.equal(pickLayout(findPackages(repo(files))).alternatives.length, 1, 'two backends: the user can be asked');

    const flagged = repo(files);
    await runInit({ cwd: flagged, backend: 'services/b', ...quiet });
    assert.ok(existsSync(join(flagged, 'services/b/blazeresolver.js')));
    assert.ok(!existsSync(join(flagged, 'services/a/blazeresolver.js')));

    const asked = repo(files);
    const questions: string[] = [];
    await runInit({ cwd: asked, ...quiet, ask: async (q, d) => (questions.push(q), q.startsWith('Backend') ? 'services/b' : d) });
    assert.equal(questions.length, 2);
    assert.ok(existsSync(join(asked, 'services/b/blazeresolver.js')));
  });
});

describe('init safety', () => {
  it('refuses to run twice, and treats a config from the old init as ours to redo', async () => {
    const dir = repo({ 'package.json': pj({ dependencies: { next: '15' } }), 'app/layout.js': '<body></body>\n' });
    await runInit({ cwd: dir, ...quiet });
    await assert.rejects(runInit({ cwd: dir, ...quiet }), /already set up/);

    const old = repo({ 'package.json': pj({ dependencies: { next: '15' } }), 'app/layout.js': '<body></body>\n', 'blazeresolver.config.json': '{"repo":"acme/shop"}' });
    const r = await runInit({ cwd: old, ...quiet });
    assert.ok(r.manifest.files.includes('.github/workflows/blazeresolver.yml'));
  });

  it('finds the repo through trailing slashes and non-origin remotes, and explains when it cannot', () => {
    assert.equal(detectRepo(repo({}, 'https://github.com/acme/shop/')), 'acme/shop');
    assert.equal(detectRepo(repo({}, 'https://github.com/acme/shop.git')), 'acme/shop');
    const dir = repo({}, '');
    execFileSync('git', ['remote', 'add', 'upstream', 'git@github.com:acme/other.git'], { cwd: dir });
    assert.equal(detectRepo(dir), 'acme/other');
    assert.equal(detectRepo(repo({}, 'https://gitlab.com/acme/shop.git')), undefined);
  });

  it('preserves CRLF files, and remove restores them byte for byte', async () => {
    const html = '<html>\r\n<body>\r\n</body>\r\n</html>\r\n';
    const dir = repo({ 'web/package.json': pj({ dependencies: { vite: '6' } }), 'web/index.html': html });
    await runInit({ cwd: dir, ...quiet });
    assert.match(read(dir, 'web/index.html'), /<!-- blazeresolver:managed -->\r\n<\/body>\r\n/);
    assert.ok(!/[^\r]\n/.test(read(dir, 'web/index.html')), 'no bare LF introduced');
    await runRemove({ cwd: dir, yes: true, noUninstall: true, log: () => {} });
    assert.equal(read(dir, 'web/index.html'), html);
  });

  it('edit helpers round-trip text with and without a trailing newline', () => {
    for (const text of ['a\nb\n', 'a\nb', 'a', '', 'a\r\nb\r\n']) {
      const idx = Math.max(0, text.split('\n').length - 2);
      assert.equal(stripManaged(insertAfter(text, idx, '// blazeresolver:managed')), text);
    }
  });
});

describe('sandbox, pin and app options', () => {
  const next = (extra: Record<string, string> = {}, pkg: object = {}) =>
    repo({ 'package.json': pj({ dependencies: { next: '15' }, scripts: { test: 'vitest' }, ...pkg }), 'app/layout.jsx': '<html><body>{children}</body></html>\n', ...extra });

  it('picks the container image from the Node version the project declares', async () => {
    const image = async (dir: string) => JSON.parse(read(dir, 'blazeresolver.config.json')).sandboxImage;
    const nvm = next({ '.nvmrc': 'v20.11.1\n' });
    await runInit({ cwd: nvm, ...quiet });
    assert.equal(await image(nvm), 'node:20-bookworm-slim');
    const engines = next({}, { engines: { node: '>=18.17' } });
    await runInit({ cwd: engines, ...quiet });
    assert.equal(await image(engines), 'node:18-bookworm-slim');
    const custom = next();
    await runInit({ cwd: custom, ...quiet, sandboxImage: 'my/image:1' });
    assert.equal(await image(custom), 'my/image:1');
  });

  it('--no-sandbox is an explicit opt-out, recorded in the config', async () => {
    const dir = next();
    await runInit({ cwd: dir, ...quiet, noSandbox: true });
    const config = JSON.parse(read(dir, 'blazeresolver.config.json'));
    assert.equal(config.sandbox, 'none');
    assert.equal(config.sandboxImage, undefined);
  });

  it('--pin locks the workflow and the widget to one version instead of latest', async () => {
    const dir = next();
    await runInit({ cwd: dir, ...quiet, pin: '0.5.0' });
    const wf = read(dir, '.github/workflows/blazeresolver.yml');
    assert.match(wf, /blazeresolver@0\.5\.0 fix/);
    assert.match(wf, /blazeresolver@0\.5\.0 notify/);
    assert.doesNotMatch(wf, /blazeresolver@latest/);
    assert.match(read(dir, 'app/layout.jsx'), /blazeresolver@0\.5\.0\/widget\/widget\.js/);
    assert.equal(JSON.parse(read(dir, 'blazeresolver.config.json')).pin, '0.5.0');
  });

  it('the default workflow pins every third-party action to a commit, with least-privilege permissions per job', async () => {
    const dir = next();
    await runInit({ cwd: dir, ...quiet });
    const wf = read(dir, '.github/workflows/blazeresolver.yml');
    const uses = [...wf.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
    assert.ok(uses.length >= 4);
    for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${u} must be pinned to a full commit SHA`);
    assert.match(wf, /^permissions:\n  contents: read$/m, 'read-only by default');
    assert.match(wf, /persist-credentials: false/);
  });

  it('--app gives the fix job a short-lived App token, and the built-in token can then only read', async () => {
    const dir = next();
    await runInit({ cwd: dir, ...quiet, app: true });
    const wf = read(dir, '.github/workflows/blazeresolver.yml');
    assert.match(wf, /uses: actions\/create-github-app-token@[0-9a-f]{40}/);
    assert.match(wf, /GITHUB_TOKEN: \$\{\{ steps\.app\.outputs\.token \}\}/);
    assert.match(wf, /permission-pull-requests: write/);
    const fixPerms = wf.slice(wf.indexOf('  fix:'), wf.indexOf('  notify:')).match(/permissions:\n((?: {6}.+\n)+)/)![1];
    assert.equal(fixPerms.trim(), 'contents: read');
    // re-running init keeps App mode
    await runInit({ cwd: dir, ...quiet, force: true });
    assert.match(read(dir, '.github/workflows/blazeresolver.yml'), /create-github-app-token/);
  });
});

describe('one-line pages and re-runs', () => {
  it('a minified one-line index.html gets the widget inside the body, and remove restores it exactly', async () => {
    const html = '<!doctype html><html><head></head><body><div id="root"></div></body></html>\n';
    const dir = repo({ 'package.json': pj({ dependencies: { vite: '6', react: '19' } }), 'index.html': html });
    await runInit({ cwd: dir, ...quiet });
    const out = read(dir, 'index.html');
    assert.ok(out.indexOf('<script src=') > out.indexOf('<body>'), 'script is inside <body>');
    assert.ok(out.indexOf('<script src=') < out.indexOf('</body>'));
    await runRemove({ cwd: dir, yes: true, noUninstall: true, log: () => {} });
    assert.equal(read(dir, 'index.html'), html);
  });

  it('--force re-runs never wire the same file twice', async () => {
    const dir = repo({ 'package.json': pj({ dependencies: { next: '15' } }), 'app/layout.jsx': '<html><body>{children}</body></html>\n' });
    await runInit({ cwd: dir, ...quiet });
    const once = read(dir, 'app/layout.jsx');
    await runInit({ cwd: dir, ...quiet, force: true });
    assert.equal(read(dir, 'app/layout.jsx'), once);
    assert.equal((once.match(/<Script/g) ?? []).length, 1);
  });
});

describe('remove', () => {
  it('keeps a file you have since rewritten, and refuses when nothing is set up', async () => {
    const dir = repo({ 'package.json': pj({ dependencies: { next: '15' } }), 'app/layout.js': '<body></body>\n' });
    await runInit({ cwd: dir, ...quiet });
    writeFileSync(join(dir, 'app/api/blaze/route.js'), 'export const POST = () => new Response("mine")\n');
    const r = await runRemove({ cwd: dir, yes: true, noUninstall: true, log: () => {} });
    assert.deepEqual(r.kept, ['app/api/blaze/route.js']);
    assert.ok(existsSync(join(dir, 'app/api/blaze/route.js')));
    assert.ok(!existsSync(join(dir, '.github/workflows/blazeresolver.yml')));

    await assert.rejects(runRemove({ cwd: repo({}), yes: true, log: () => {} }), /not set up/);
  });

  it('asks first, and does nothing when declined', async () => {
    const dir = repo({ 'package.json': pj({ dependencies: { next: '15' } }), 'app/layout.js': '<body></body>\n' });
    await runInit({ cwd: dir, ...quiet });
    const after = snapshot(dir);
    const r = await runRemove({ cwd: dir, log: () => {}, confirm: async () => false });
    assert.equal(r.cancelled, true);
    assert.deepEqual(snapshot(dir), after);
  });

  it('cleans up after a config written by the previous version of init', async () => {
    const dir = repo({
      'package.json': pj({ dependencies: { next: '15', blazeresolver: '^0.2.0' } }),
      'src/app/api/blaze/route.ts': "import { createHandler } from 'blazeresolver/handler';\n",
      '.github/workflows/blazeresolver.yml': 'name: BlazeResolver\n',
      'blazeresolver.config.json': '{"repo":"acme/shop"}'
    });
    const r = await runRemove({ cwd: dir, yes: true, noUninstall: true, log: () => {} });
    assert.deepEqual(r.removed.sort(), ['.github/workflows/blazeresolver.yml', 'src/app/api/blaze/route.ts']);
    assert.ok(!existsSync(join(dir, 'src/app')), 'folders init created are removed once empty');
  });
});

describe('.env handling', () => {
  it('creates .env with one universal API_KEYS line and the GitHub token when none exists', async () => {
    const dir = repo({ 'package.json': '{}' });
    await runInit({ cwd: dir, ...quiet });
    const env = read(dir, '.env');
    assert.match(env, /^API_KEYS=$/m);
    assert.match(env, /^BLAZE_GITHUB_TOKEN=$/m);
    assert.doesNotMatch(env, /^OPENAI_API_KEY=/m, 'no per-provider variables to fill in');
  });

  it('appends only the missing variables to an existing .env, leaving the rest untouched', async () => {
    const original = 'API_KEYS=sk-ant-mine\nMY_OWN_VAR=keep-me\n';
    const dir = repo({ 'package.json': '{}', '.env': original });
    const out: string[] = [];
    await runInit({ cwd: dir, noInstall: true, log: (l) => out.push(l) });
    const env = read(dir, '.env');
    assert.match(env, /^API_KEYS=sk-ant-mine$/m);
    assert.match(env, /MY_OWN_VAR=keep-me/);
    assert.match(env, /^BLAZE_GITHUB_TOKEN=$/m);
    assert.equal((env.match(/^API_KEYS=/gm) ?? []).length, 1, 'does not duplicate an existing key');
    assert.match(out.join('\n'), /edited .env/);

    await runRemove({ cwd: dir, yes: true, noUninstall: true, log: () => {} });
    assert.equal(read(dir, '.env'), original, 'remove takes back exactly what was appended');
  });

  it('leaves .env alone when it already has every variable, and says so', async () => {
    const dir = repo({ 'package.json': '{}' });
    await runInit({ cwd: dir, ...quiet });
    const before = read(dir, '.env');
    const out: string[] = [];
    await runInit({ cwd: dir, force: true, noInstall: true, log: (l) => out.push(l) });
    assert.equal(read(dir, '.env'), before);
    assert.match(out.join('\n'), /kept   \.env/);
  });

  it('puts .env next to the backend that reads it, not at the repo root', async () => {
    const dir = repo({
      'api/package.json': pj({ dependencies: { express: '4' } }), 'api/index.js': EXPRESS_CJS,
      'ui/package.json': pj({ dependencies: { vite: '6' } }), 'ui/index.html': '<body></body>\n'
    });
    await runInit({ cwd: dir, ...quiet });
    assert.ok(existsSync(join(dir, 'api/.env')));
    assert.ok(!existsSync(join(dir, '.env')));
  });

  it('warns when the new .env is not gitignored, and stays quiet when it is', async () => {
    const loose = repo({ 'package.json': '{}' });
    assert.ok((await runInit({ cwd: loose, ...quiet })).manual.some((m) => m.includes('not in .gitignore')));
    const safe = repo({ 'package.json': '{}', '.gitignore': '.env\n' });
    assert.ok(!(await runInit({ cwd: safe, ...quiet })).manual.some((m) => m.includes('not in .gitignore')));
  });

  it('remove deletes an untouched .env, but never a value you typed', async () => {
    const untouched = repo({ 'package.json': '{}' });
    await runInit({ cwd: untouched, ...quiet });
    assert.equal((await runRemove({ cwd: untouched, yes: true, noUninstall: true, log: () => {} })).env, 'deleted');
    assert.ok(!existsSync(join(untouched, '.env')));

    const filled = repo({ 'package.json': '{}' });
    await runInit({ cwd: filled, ...quiet });
    writeFileSync(join(filled, '.env'), read(filled, '.env').replace('API_KEYS=', 'API_KEYS=sk-ant-secret'));
    const r = await runRemove({ cwd: filled, yes: true, noUninstall: true, log: () => {} });
    assert.equal(r.env, 'kept');
    assert.match(read(filled, '.env'), /API_KEYS=sk-ant-secret/);
  });

  it('remove still restores everything after a --force re-run (earlier edits are not forgotten)', async () => {
    const dir = repo({
      'api/package.json': pj({ type: 'module', dependencies: { express: '4' } }), 'api/server.js': EXPRESS_ESM,
      'ui/package.json': pj({ dependencies: { vite: '6' } }), 'ui/index.html': '<html>\n<body>\n</body>\n</html>\n'
    });
    const before = snapshot(dir);
    await runInit({ cwd: dir, ...quiet });
    await runInit({ cwd: dir, ...quiet, force: true });
    await runRemove({ cwd: dir, yes: true, noUninstall: true, log: () => {} });
    assert.deepEqual(snapshot(dir), before);
  });
});
