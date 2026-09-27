import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, posix } from 'node:path';
import { REPO_PATTERN } from '../github/index.js';
import {
  type Entry, type Layout, type Pkg, type PackageManager,
  buildCommands, detectPm, detectPort, detectRepo, findExpressEntry, findHtmlEntry, findNext, findPackages, frontendProxiesApi,
  git, isNext, needsJsExtension, pickLayout, repoRoot, usesTypeScript
} from './detect.js';
import { MARK, hasManaged, indentOf, insertAfter, insertBefore, insertInline, lastImportLine } from './edit.js';
import { expressRouterFile, pagesFile, routeFile, supportRouteFile, supportPagesFile, widgetTag, workflow, agentsRequirements, blazeTriageAgent, blazeResolverAgent, type ModuleStyle } from './templates.js';

/** Everything `init` changed, so `remove` can undo exactly that and nothing else. */
export interface Manifest {
  /** Files init created. Relative to the repo root, posix separators. */
  files: string[];
  /** Existing files where init inserted marked lines. */
  edits: string[];
  dependency?: { dir: string; pm: PackageManager; workspace?: string };
  /** The exact text init put in a .env file, so remove can take back precisely that and never a value you typed. */
  env?: { file: string; created: boolean; added: string };
  /** Text appended to other files (CODEOWNERS), same idea: exact text, so remove takes back precisely that. */
  appended?: { file: string; created: boolean; added: string }[];
  /** Repo secrets set by `blazeresolver app` (BLAZE_APP_ID and the private key), so remove can delete them. */
  secrets?: string[];
}

export const CONFIG_FILE = 'blazeresolver.config.json';

export interface InitOptions {
  cwd: string;
  repo?: string;
  branch?: string;
  test?: string;
  build?: string;
  /** Installs dependencies (with network) before tests, which then run offline. Detected when omitted. */
  install?: string;
  /** Run tests with network access instead of offline in a container. */
  noSandbox?: boolean;
  /** Container image for offline tests. Defaults to node:<your Node major>-bookworm-slim. */
  sandboxImage?: string;
  /** Run this blazeresolver version in the workflow and widget instead of `latest`. */
  pin?: string;
  /** The fix job uses a GitHub App token (run `blazeresolver app` to create one). */
  app?: boolean;
  /** Folder of the backend / frontend, relative to the repo root. Detected when omitted. */
  backend?: string;
  frontend?: string;
  /** Overwrite files that already exist. */
  force?: boolean;
  /** Skip installing the blazeresolver dependency. */
  noInstall?: boolean;
  log?: (line: string) => void;
  /** Confirms or corrects what was detected. Omit to accept the detection (scripts, CI). */
  ask?: (question: string, fallback: string) => Promise<string>;
}

export interface InitResult {
  root: string;
  repo: string;
  layout: { frontend?: string; backend?: string; handler: Layout['handler'] };
  manifest: Manifest;
  endpoint: string;
  /** Steps init could not do safely and printed for the user instead. */
  manual: string[];
}

interface EnvVar { key: string; comment?: string }
interface EnvSection { header: string; vars: EnvVar[] }

const ENV_SECTIONS: EnvSection[] = [
  {
    header:
      '# --- BlazeResolver: Universal AI Keys (auto-picked for all agents & triage) ---\n' +
      '# Paste ANY key(s). Provider is auto-detected across Gemini, Claude, OpenAI, Groq, NVIDIA, DeepSeek, xAI.\n' +
      '# Set multiple comma-separated keys or numbered keys (API_KEY_1, API_KEY_2) for instant failover:\n' +
      '#   API_KEYS=sk-ant-...,AIzaSy...,gsk_...\n' +
      '# Free tier keys: Gemini (https://aistudio.google.com/apikey) | Groq (https://console.groq.com/keys)\n' +
      '# Verify recognized keys anytime: npx blazeresolver providers',
    vars: [{ key: 'API_KEYS' }]
  },
  {
    header: '# --- BlazeResolver: GitHub Token -----------------------------------------------\n' +
      '# Fine-grained token: Issues read and write permissions on this repo.',
    vars: [{ key: 'BLAZE_GITHUB_TOKEN', comment: '# gh auth token or fine-grained PAT' }]
  },
];

/**
 * What to add to a .env so it has BlazeResolver's variables: only the ones it is missing, never touching a line that is
 * already there. Returns undefined when nothing is missing.
 */
export function envAddition(existing: string | undefined): string | undefined {
  const existingKeys = new Set((existing ?? '').split('\n').map((l) => l.match(/^([A-Z0-9_]+)=/)?.[1]).filter((k): k is string => !!k));
  const blocks = ENV_SECTIONS.map(({ header, vars }) => {
    const missing = vars.filter((v) => !existingKeys.has(v.key));
    return missing.length ? [header, ...missing.map((v) => (v.comment ? `${v.comment}\n${v.key}=` : `${v.key}=`))].join('\n') : undefined;
  }).filter((b): b is string => !!b);
  return blocks.length ? blocks.join('\n\n') + '\n' : undefined;
}

export async function runInit(opts: InitOptions): Promise<InitResult> {
  const log = opts.log ?? console.log;
  const root = repoRoot(opts.cwd);
  const repo = opts.repo ?? detectRepo(root);
  if (!repo || !REPO_PATTERN.test(repo)) {
    throw new Error('Could not find a GitHub remote (looked at every remote in this repo). Add one with `git remote add origin https://github.com/OWNER/NAME.git`, or pass --repo OWNER/NAME.');
  }
  const branch = opts.branch ?? (git(root, 'symbolic-ref', '--short', 'HEAD') || 'main');

  const configPath = join(root, CONFIG_FILE);
  const existing = existsSync(configPath) ? (JSON.parse(readFileSync(configPath, 'utf8')) as { installed?: Manifest; app?: boolean; pin?: string }) : undefined;
  if (existing?.installed && !opts.force) {
    throw new Error('BlazeResolver is already set up in this repo. Run `npx blazeresolver remove` first, or use --force to set it up again.');
  }
  // A config from an older init has no record of what was written; those files are ours, so redo them.
  const force = opts.force || (!!existing && !existing.installed);

  const packages = findPackages(root);
  let layout = pickLayout(packages, { backend: opts.backend, frontend: opts.frontend });

  if (opts.ask) {
    const fe = await opts.ask('Frontend folder, where the widget goes ("none" to skip)', layout.frontend?.dir || 'none');
    const be = layout.handler === 'next' ? undefined : await opts.ask('Backend folder, where the report endpoint goes ("none" to skip)', layout.backend?.dir || 'none');
    layout = pickLayout(packages, { frontend: fe && fe !== 'none' ? fe : undefined, backend: be && be !== 'none' ? be : undefined });
    if (fe === 'none') layout = { ...layout, frontend: undefined };
    if (be === 'none' && layout.handler !== 'next') layout = { ...layout, backend: undefined, handler: 'none', handlerPkg: undefined };
  }

  const manifest: Manifest = existing?.installed ? structuredClone(existing.installed) : { files: [], edits: [] };
  const manual: string[] = [];
  const cmds = buildCommands(root, packages, [layout.backend, layout.frontend].filter((p): p is Pkg => !!p));
  let installTarget: Pkg | undefined;
  const say = (l: string) => log(l);

  const createFile = (rel: string, content: string): boolean => {
    const path = join(root, rel);
    if (existsSync(path) && !force) {
      say(`  kept    ${rel} (already exists, use --force to overwrite)`);
      return false;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    if (!manifest.files.includes(rel)) manifest.files.push(rel);
    say(`  wrote   ${rel}`);
    return true;
  };
  const editFile = (rel: string, change: (text: string) => string | undefined): boolean => {
    const path = join(root, rel);
    const text = readFileSync(path, 'utf8');
    if (hasManaged(text)) {
      say(`  kept    ${rel} (already wired)`);
      return false;
    }
    const next = change(text);
    if (next === undefined) return false;
    writeFileSync(path, next);
    if (!manifest.edits.includes(rel)) manifest.edits.push(rel);
    say(`  edited  ${rel}`);
    return true;
  };
  const writeConfig = () => {
    if (!manifest.files.includes(CONFIG_FILE)) manifest.files.push(CONFIG_FILE);
    const config = {
      repo,
      defaultBranch: branch,
      installCommand: opts.install ?? cmds.install,
      testCommand: opts.test ?? cmds.test,
      buildCommand: opts.build ?? cmds.build,
      // Tests run offline in a container by default; the only code that ever had network is the lockfile's own.
      sandbox: opts.noSandbox ? 'none' : 'docker',
      ...(opts.noSandbox ? {} : { sandboxImage: opts.sandboxImage ?? `node:${cmds.nodeMajor ?? 22}-bookworm-slim` }),
      ...(opts.pin ? { pin: opts.pin } : {}),
      ...(opts.app || existing?.app ? { app: true } : {}),
      layout: { frontend: layout.frontend?.dir, backend: layout.backend?.dir, handler: layout.handler },
      installed: manifest
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  };

  function ensureEnv(dir: string) {
    const rel = posix.join(dir, '.env');
    const path = join(root, rel);
    const existingText = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
    const addition = envAddition(existingText);
    if (!addition) {
      if (existingText !== undefined) say(`  kept   ${rel} (already has BlazeResolver's variables)`);
      return;
    }
    if (existingText === undefined) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, addition);
      manifest.env = { file: rel, created: true, added: addition };
      say(`  wrote  ${rel}`);
    } else {
      const sep = existingText.endsWith('\n\n') ? '' : existingText.endsWith('\n') ? '\n' : '\n\n';
      writeFileSync(path, existingText + sep + addition);
      manifest.env = { file: rel, created: false, added: sep + addition };
      say(`  edited ${rel} (appended missing BlazeResolver variables)`);
    }
    try {
      execFileSync('git', ['check-ignore', '-q', rel], { cwd: root, stdio: 'ignore' });
    } catch {
      manual.push(`${rel} holds secrets but is not in .gitignore. Add it before you commit.`);
    }
  }

  // --- the report endpoint --------------------------------------------------------------------------------------

  function placeHandler() {
    const pkg = layout.handlerPkg;
    if (layout.handler === 'next' && pkg) {
      const next = findNext(root, pkg);
      if (!next) {
        manual.push(`Your Next.js app in ${pkg.dir || '.'} has no app/ or pages/ folder, so add an API route for blazeresolver/handler by hand.`);
        return;
      }
      const ext = usesTypeScript(root, pkg) ? 'ts' : 'js';
      if (next.kind === 'app') {
        createFile(`${next.dir}/api/blaze/route.${ext}`, routeFile(repo!));
        createFile(`${next.dir}/api/support/[...slug]/route.${ext}`, supportRouteFile(repo!));
      } else {
        createFile(`${next.dir}/api/blaze.${ext}`, pagesFile(repo!));
        createFile(`${next.dir}/api/support/[...slug].${ext}`, supportPagesFile(repo!));
      }
      addEnvExample(pkg);
      return;
    }

    if (layout.handler === 'express' && pkg) {
      const entry = findExpressEntry(root, pkg);
      if (entry && wireExpress(pkg, entry)) {
        addEnvExample(pkg);
        return;
      }
      const dir = existsSync(join(root, pkg.dir, 'src')) ? posix.join(pkg.dir, 'src') : pkg.dir;
      const ts = usesTypeScript(root, pkg);
      createFile(posix.join(dir, ts ? 'blazeresolver.ts' : 'blazeresolver.js'), expressRouterFile(repo!, pkg.esm || ts ? 'esm' : 'cjs'));
      manual.push(`Could not tell where your Express app is created in ${pkg.dir || '.'}, so nothing there was edited. Add two lines where the app is created: import the file above and \`app.all('/api/blaze', blazeresolver)\`.`);
      addEnvExample(pkg);
      return;
    }

    if (layout.handler === 'other' && pkg) {
      manual.push(
        `Your backend in ${pkg.dir || '.'} does not use Express, so add the endpoint by hand. The handler takes a standard Request and returns a Response:\n\n` +
          `       import { createHandler } from 'blazeresolver/handler';\n       const blaze = createHandler({ repo: '${repo}', allowOrigin: '*' });\n       // route POST and OPTIONS /api/blaze to blaze(request)   (Node req/res? use nodeHandler(blaze))`
      );
      installTarget = pkg;
      return;
    }

    manual.push("No Node backend or Next.js app found. BlazeResolver needs an endpoint that receives the widget's reports: add a Next.js API route, or deploy the handler as a serverless function (blazeresolver/handler works on Cloudflare, Vercel, Deno and Bun).");
  }

  function wireExpress(pkg: Pkg, entry: Entry): boolean {
    const ext = extname(entry.file);
    const ts = /^\.[cm]?tsx?$/.test(ext);
    const style: ModuleStyle = ts || ext === '.mjs' || (ext === '.js' && pkg.esm) ? 'esm' : 'cjs';
    const routerExt = ts ? '.ts' : ext;
    const routerRel = posix.join(posix.dirname(entry.file), `blazeresolver${routerExt}`);
    const text = readFileSync(join(root, entry.file), 'utf8');
    if (hasManaged(text)) return true;

    // A chained statement (`express()` then `.use(...)` on the next line) can't take a line after it safely.
    const all = text.split('\n');
    const appLine = all[entry.line];
    if (!/express\s*\(\s*\)\s*;?\s*(\/\/.*)?\r?$/.test(appLine) || /^\s*\??\./.test(all[entry.line + 1] ?? '')) return false;

    const spec = ts
      ? needsJsExtension(root, pkg) ? './blazeresolver.js' : './blazeresolver'
      : style === 'esm' || ext === '.cjs' ? `./blazeresolver${routerExt}` : './blazeresolver';
    const importLine = style === 'esm' ? `import blazeresolver from '${spec}'; // ${MARK}` : `const blazeresolver = require('${spec}'); // ${MARK}`;
    const indent = indentOf(appLine);

    createFile(routerRel, expressRouterFile(repo!, style));
    editFile(entry.file, (t) => {
      let next = t;
      let app = entry.line;
      const last = lastImportLine(next);
      if (last !== -1 && last < app) {
        next = insertAfter(next, last, importLine);
        app += 1;
      } else if (style === 'cjs' || last === -1) {
        next = insertBefore(next, app, importLine); // a require must come before its use
        app += 1;
      } else {
        next = insertAfter(next, last, importLine); // ESM imports are hoisted, so one after the app line is fine
      }
      return insertAfter(next, app, `${indent}${entry.appVar}.all('/api/blaze', blazeresolver); // ${MARK}`);
    });
    installTarget = pkg;
    return true;
  }

  function addEnvExample(pkg: Pkg) {
    installTarget = pkg;
    const rel = [posix.join(pkg.dir, '.env.example'), '.env.example'].find((f) => existsSync(join(root, f)));
    if (!rel) return;
    editFile(rel, (text) => {
      const parts = text.split('\n');
      let last = parts.length - 1;
      while (last > 0 && parts[last].trim() === '') last--;
      const add = ['BLAZE_GITHUB_TOKEN=', ...(/^ANTHROPIC_API_KEY=/m.test(text) ? [] : ['ANTHROPIC_API_KEY='])].map((l) => `${l} # ${MARK}`);
      return add.reduceRight((acc, l) => insertAfter(acc, last, l), text);
    });
  }

  // --- the widget -----------------------------------------------------------------------------------------------

  function placeWidget(): string {
    const fe = layout.frontend;
    const be = layout.backend;
    const sameOrigin = !!fe && (fe === layout.handlerPkg || (!!be && fe.dir === be.dir) || frontendProxiesApi(root, fe));
    let endpoint = '/api/blaze';
    if (!sameOrigin) {
      const port = be ? detectPort(root, be, findExpressEntry(root, be)) : 3000;
      endpoint = `http://localhost:${port}/api/blaze`;
      manual.push(`The widget points at ${endpoint}, your backend in development. Before you deploy, change data-endpoint to your production API URL (or proxy /api from your frontend host).`);
    }
    if (!fe) return endpoint;

    if (isNext(fe)) {
      const next = findNext(root, fe);
      if (next?.layout && wireNextLayout(next.layout, endpoint)) return endpoint;
    } else {
      const html = findHtmlEntry(root, fe);
      if (html) {
        editFile(html, (text) => {
          const parts = text.split('\n');
          const i = parts.findIndex((l) => /<\/body>/i.test(l));
          // </body> alone on its line: add a line before it. Sharing a line with other markup: insert inline.
          return /^\s*<\/body>\s*\r?$/i.test(parts[i])
            ? insertBefore(text, i, `${indentOf(parts[i])}${widgetTag(endpoint, opts.pin)}<!-- ${MARK} -->`)
            : insertInline(text, i, parts[i].match(/<\/body>/i)![0], widgetTag(endpoint, opts.pin), 'html');
        });
        return endpoint;
      }
    }
    manual.push(`Could not find where your page HTML ends in ${fe.dir || '.'}. Paste this before </body>:\n\n       ${widgetTag(endpoint, opts.pin)}`);
    return endpoint;
  }

  function wireNextLayout(rel: string, endpoint: string): boolean {
    const text = readFileSync(join(root, rel), 'utf8');
    if (text.split('\n').filter((l) => /<\/body>/.test(l)).length !== 1) return false;
    const bound = text.match(/import\s+(\w+)\s+from\s+['"]next\/script['"]/)?.[1];
    if (!bound && /\bScript\b/.test(text)) return false; // the name is taken by something else
    const name = bound ?? 'Script';
    if (hasManaged(text)) return true;
    return editFile(rel, (t) => {
      const parts = t.split('\n');
      const body = parts.findIndex((l) => /<\/body>/.test(l));
      const element = `<${name} src="https://cdn.jsdelivr.net/npm/blazeresolver@${opts.pin ?? 'latest'}/widget/widget.js" data-endpoint="${endpoint}" strategy="afterInteractive" />`;
      let next = /^\s*<\/body>\s*\r?$/.test(parts[body])
        ? insertBefore(t, body, `${indentOf(parts[body])}  ${element} {/* ${MARK} */}`)
        : insertInline(t, body, '</body>', element, 'jsx'); // <body>{children}</body> on one line
      if (!bound) {
        const last = lastImportLine(next);
        const importLine = `import Script from 'next/script'; // ${MARK}`;
        next = last === -1 ? insertBefore(next, 0, importLine) : insertAfter(next, last, importLine);
      }
      return next;
    });
  }

  // --- the dependency -------------------------------------------------------------------------------------------

  function installDependency() {
    const pkg = installTarget;
    if (!pkg) return;
    const { pm } = detectPm(root, pkg);
    const rootPkg = packages.find((p) => p.dir === '');
    const workspace = !!rootPkg?.workspaces && pkg.dir !== '' && pm === 'npm';
    manifest.dependency = { dir: pkg.dir, pm, ...(workspace ? { workspace: pkg.dir } : {}) };
    if (opts.noInstall) return;

    const [cmd, args, cwd] = installArgs(pm, pkg, workspace, root);
    say(`  running ${cmd} ${args.join(' ')} in ${pkg.dir || '.'} ...`);
    try {
      execFileSync(cmd, args, { cwd, stdio: 'ignore' });
    } catch {
      manual.push(`Could not install blazeresolver automatically. Run \`${cmd} ${args.join(' ')}\` in ${pkg.dir || 'the repo root'}.`);
    }
  }

  function printNextSteps(endpoint: string) {
    say('\nNext steps:');
    let step = 1;
    for (const m of manual) say(`  ${step++}. ${m}`);
    say(`  ${step++}. Create a fine-grained GitHub token with Issues: read and write on ${repo} only.`);
    say('     Give it to your backend as BLAZE_GITHUB_TOKEN in .env (just created/updated for you).');
    say(`  ${step++}. Paste any AI key into .env as API_KEYS= (or API_KEY_1, API_KEY_2).`);
    say('     Universal auto-detection works with Gemini, Claude, OpenAI, Groq, NVIDIA, DeepSeek, xAI, etc.');
    say('     Check recognized providers anytime: npx blazeresolver providers');
    say(`  ${step++}. Give the GitHub Actions workflow the same keys:   gh secret set API_KEYS`);
    say(`  ${step++}. GitHub, Settings, Actions, General: turn on "Allow GitHub Actions to create and approve pull requests".`);
    say(`  ${step++}. Run npx blazeresolver harden to require human review on ${branch}.`);
    if (!layout.frontend) say(`  ${step++}. Widget tag for your page: ${widgetTag(endpoint, opts.pin)}`);
    say('\nRun `npx blazeresolver doctor`, then commit the new files (not .env). Undo everything with `npx blazeresolver remove`.');
    say(opts.pin ? `Pinned to blazeresolver@${opts.pin}: nothing changes until you re-run init with a newer --pin.` : 'Updates are automatic: the widget loads from a CDN and the workflow runs blazeresolver@latest (use --pin <version> to lock it).');
  }

  // --- the agents and schema -------------------------------------------------------------------------------

  function placeAgents() {
    createFile('agents/blaze_triage_agent.py', blazeTriageAgent);
    createFile('agents/blaze_resolver_agent.py', blazeResolverAgent);
    createFile('agents/requirements.txt', agentsRequirements);
  }

  say(`\nBlazeResolver for ${repo} (default branch ${branch})`);
  if (root !== opts.cwd) say(`Using the repo root ${root}, because GitHub only reads workflows from there.`);
  say('Detected:');
  say(`  frontend  ${layout.frontend ? `${layout.frontend.dir || '.'} (${isNext(layout.frontend) ? 'Next.js' : 'web app'})` : 'none found'}`);
  say(`  backend   ${layout.handler === 'next' ? 'the Next.js app itself' : layout.backend ? layout.backend.dir || '.' : 'none found'}\n`);

  try {
    placeHandler();
    ensureEnv((installTarget ?? layout.handlerPkg)?.dir ?? '');
    const endpoint = placeWidget();
    placeAgents();
    createFile('.github/workflows/blazeresolver.yml', workflow({ pin: opts.pin ?? existing?.pin, app: opts.app || existing?.app }));
    installDependency();
    if (!cmds.hasTests && !opts.test) {
      manual.push('No "test" script found. BlazeResolver only opens a fix that passes your tests, so add tests (or pass --test "<command>"), or every fix will go to a human.');
    }
    writeConfig();
    say(`  wrote   ${CONFIG_FILE}`);
    printNextSteps(endpoint);
    return { root, repo, layout: { frontend: layout.frontend?.dir, backend: layout.backend?.dir, handler: layout.handler }, manifest, endpoint, manual };
  } catch (err) {
    writeConfig(); // so `remove` can still clean up whatever was written before the failure
    throw err;
  }
}

export function installArgs(pm: PackageManager, pkg: Pkg, workspace: boolean, root: string): [string, string[], string] {
  if (pm === 'npm') return workspace ? ['npm', ['install', 'blazeresolver', '--workspace', pkg.dir], root] : ['npm', ['install', 'blazeresolver'], join(root, pkg.dir)];
  if (pm === 'pnpm') return ['pnpm', pkg.dir === '' && existsSync(join(root, 'pnpm-workspace.yaml')) ? ['add', '-w', 'blazeresolver'] : ['add', 'blazeresolver'], join(root, pkg.dir)];
  return ['yarn', ['add', 'blazeresolver'], join(root, pkg.dir)];
}

export function uninstallArgs(pm: PackageManager, dir: string, workspace: string | undefined, root: string): [string, string[], string] {
  if (pm === 'npm') return workspace ? ['npm', ['uninstall', 'blazeresolver', '--workspace', workspace], root] : ['npm', ['uninstall', 'blazeresolver'], join(root, dir)];
  if (pm === 'pnpm') return ['pnpm', dir === '' && existsSync(join(root, 'pnpm-workspace.yaml')) ? ['remove', '-w', 'blazeresolver'] : ['remove', 'blazeresolver'], join(root, dir)];
  return ['yarn', ['remove', 'blazeresolver'], join(root, dir)];
}
