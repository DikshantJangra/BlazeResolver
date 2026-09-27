import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

export const git = (cwd: string, ...args: string[]) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

/** The repository root, however deep in it the command was run. GitHub only reads workflows from here. */
export const repoRoot = (cwd: string) => git(cwd, 'rev-parse', '--show-toplevel') || cwd;

/** owner/name from the origin remote, or the first GitHub remote. Handles ssh, https, .git and trailing slashes. */
export function detectRepo(root: string): string | undefined {
  const names = git(root, 'remote').split('\n').filter(Boolean);
  for (const name of [...names.filter((n) => n === 'origin'), ...names]) {
    const url = git(root, 'remote', 'get-url', name);
    const m = url.match(/github\.com[:/]+([\w.-]+)\/([\w.-]+?)(?:\.git)?\/*$/);
    if (m) return `${m[1]}/${m[2]}`;
  }
  return undefined;
}

export interface Pkg {
  /** Relative to the repo root, posix separators. '' is the root. */
  dir: string;
  name: string;
  scripts: Record<string, string>;
  deps: Set<string>;
  esm: boolean;
  workspaces: boolean;
  main?: string;
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.turbo', '.cache', 'vendor', '.output', '.nuxt', '.svelte-kit', 'target', '.vercel']);

/** Every package.json in the repo down to `maxDepth` folders, whatever the folders are called. */
export function findPackages(root: string, maxDepth = 3): Pkg[] {
  const found: Pkg[] = [];
  const walk = (dir: string, depth: number) => {
    const file = join(root, dir, 'package.json');
    if (existsSync(file)) {
      try {
        const json = JSON.parse(readFileSync(file, 'utf8'));
        found.push({
          dir,
          name: json.name ?? (dir || 'root'),
          scripts: json.scripts ?? {},
          deps: new Set(Object.keys({ ...json.dependencies, ...json.devDependencies })),
          esm: json.type === 'module',
          workspaces: !!json.workspaces || existsSync(join(root, dir, 'pnpm-workspace.yaml')),
          main: json.main
        });
      } catch {
        // an unparsable package.json is not a package we can work with
      }
    }
    if (depth >= maxDepth) return;
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (entry.isDirectory() && !SKIP.has(entry.name) && !entry.name.startsWith('.')) walk(posix.join(dir, entry.name), depth + 1);
    }
  };
  walk('', 0);
  return found;
}

const FRONT = ['react', 'react-dom', 'vue', 'svelte', '@sveltejs/kit', 'solid-js', '@angular/core', 'nuxt', 'preact', 'vite', 'react-scripts', '@remix-run/react', 'astro'];
const BACK = ['express', 'fastify', 'koa', 'hono', '@nestjs/core', '@hapi/hapi', 'restify', 'polka'];

export const isNext = (p: Pkg) => p.deps.has('next');
export const isFrontend = (p: Pkg) => isNext(p) || FRONT.some((d) => p.deps.has(d));
export const isBackend = (p: Pkg) => !isNext(p) && BACK.some((d) => p.deps.has(d));
export const backendFramework = (p: Pkg) => BACK.find((d) => p.deps.has(d));

/** How much a folder's own name (not its parents') looks like the role, so `apps/docs` is not a frontend just for living in `apps`. */
const score = (dir: string, hint: RegExp) => (hint.test(posix.basename(dir)) ? 1 : 0);

export interface Layout {
  frontend?: Pkg;
  backend?: Pkg;
  /** Where the report endpoint goes. */
  handler: 'next' | 'express' | 'other' | 'none';
  /** The package that gets the dependency and the endpoint. */
  handlerPkg?: Pkg;
  /** Other packages that could equally be the backend, so the user can be asked. */
  alternatives: Pkg[];
}

/**
 * Works out which package is the frontend and which the backend, by what they depend on and not by what they are named.
 * A Next.js frontend hosts its own endpoint (same origin, no CORS). Otherwise the endpoint goes in the backend.
 */
export function pickLayout(packages: Pkg[], flags: { backend?: string; frontend?: string } = {}): Layout {
  const byDir = (d: string) => packages.find((p) => p.dir === d.replace(/^\.?\/+|\/+$/g, ''));
  const real = packages.filter((p) => !(p.workspaces && !isFrontend(p) && !isBackend(p)));

  const fronts = real.filter(isFrontend).sort((a, b) => Number(isNext(b)) - Number(isNext(a)) || score(b.dir, /client|front|web|ui/i) - score(a.dir, /client|front|web|ui/i));
  const backs = real.filter(isBackend).sort((a, b) => score(b.dir, /server|back|api/i) - score(a.dir, /server|back|api/i));

  const frontend = flags.frontend ? byDir(flags.frontend) : fronts[0];
  let backend = flags.backend ? byDir(flags.backend) : undefined;

  if (!backend && !(frontend && isNext(frontend) && !flags.backend)) backend = backs[0];
  const alternatives = flags.backend ? [] : backs.slice(1);

  if (backend && isNext(backend)) return { frontend: frontend ?? backend, backend, handler: 'next', handlerPkg: backend, alternatives };
  if (!backend && frontend && isNext(frontend)) return { frontend, handler: 'next', handlerPkg: frontend, alternatives };
  if (backend) {
    return { frontend, backend, handler: backendFramework(backend) === 'express' ? 'express' : 'other', handlerPkg: backend, alternatives };
  }
  return { frontend, handler: 'none', alternatives };
}

const tsconfigOf = (root: string, pkg: Pkg): string => {
  const file = join(root, pkg.dir, 'tsconfig.json');
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};
export const usesTypeScript = (root: string, pkg: Pkg) => existsSync(join(root, pkg.dir, 'tsconfig.json'));
/** TypeScript's node16/nodenext resolution needs a `.js` on relative imports; other modes don't want one. */
export const needsJsExtension = (root: string, pkg: Pkg) => /"(?:module|moduleResolution)"\s*:\s*"node(?:16|next)"/i.test(tsconfigOf(root, pkg));

const APP_DECL = /\b(?:const|let|var)\s+(\w+)\s*(?::[^=\n]+)?=\s*express\s*\(\s*\)/;
const SOURCE = /\.(?:[cm]?js|[cm]?ts)$/;

export interface Entry {
  /** Relative to the repo root. */
  file: string;
  appVar: string;
  /** Zero-based line of the `const app = express()` statement. */
  line: number;
}

/** The file that creates the Express app: from the start/dev scripts and `main` first, then a scan of the source folder. */
export function findExpressEntry(root: string, pkg: Pkg): Entry | undefined {
  const inPkg = (f: string) => posix.normalize(posix.join(pkg.dir, f.replace(/^\.\//, '')));
  const fromScripts = Object.entries(pkg.scripts)
    .filter(([name]) => /^(start|dev|serve|server|watch)/.test(name))
    .flatMap(([, cmd]) => [...cmd.matchAll(/([\w./-]+\.(?:[cm]?[jt]s))\b/g)].map((m) => m[1]))
    .map(inPkg);
  const conventional = ['src/index', 'src/server', 'src/app', 'src/main', 'index', 'server', 'app', 'main']
    .flatMap((b) => ['js', 'ts', 'mjs', 'cjs'].map((e) => inPkg(`${b}.${e}`)));
  const preferred = [...(pkg.main ? [inPkg(pkg.main)] : []), ...fromScripts, ...conventional];

  const scan = (files: string[]) => {
    const hits: Entry[] = [];
    for (const file of new Set(files)) {
      const path = join(root, file);
      if (!existsSync(path) || !SOURCE.test(file)) continue;
      const lines = readFileSync(path, 'utf8').split('\n');
      const line = lines.findIndex((l) => APP_DECL.test(l) && !/^\s*(\/\/|\*)/.test(l));
      if (line !== -1) hits.push({ file, appVar: lines[line].match(APP_DECL)![1], line });
    }
    return hits;
  };

  const first = scan(preferred);
  if (first.length) return first[0];

  // Not where the scripts point: scan the source folders, and accept only an unambiguous answer.
  const all: string[] = [];
  const walk = (dir: string, depth: number) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = posix.join(dir, e.name);
      if (e.isDirectory() && depth < 3 && !SKIP.has(e.name) && !e.name.startsWith('.')) walk(rel, depth + 1);
      else if (e.isFile() && SOURCE.test(e.name) && !/\.(test|spec)\./.test(e.name)) all.push(rel);
    }
  };
  walk(pkg.dir, 0);
  const found = scan(all.slice(0, 400));
  return found.length === 1 ? found[0] : undefined;
}

/** The port the backend listens on, for pointing a separate frontend at it. */
export function detectPort(root: string, pkg: Pkg, entry?: Entry): number {
  const sources = [entry && join(root, entry.file), join(root, pkg.dir, '.env'), join(root, pkg.dir, '.env.example')].filter((f): f is string => !!f && existsSync(f));
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    const m = text.match(/^\s*PORT\s*=\s*(\d{3,5})/m) ?? text.match(/\bPORT\b[^;\n]*?(\d{3,5})/) ?? text.match(/\.listen\(\s*(\d{3,5})/);
    if (m) return Number(m[1]);
  }
  return 3000;
}

/** True when the frontend's dev server already forwards /api to the backend, so a relative endpoint works. */
export function frontendProxiesApi(root: string, pkg: Pkg): boolean {
  const dir = join(root, pkg.dir);
  try {
    if (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).proxy) return true;
  } catch {
    // no package.json proxy
  }
  return ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vue.config.js'].some((f) => {
    const file = join(dir, f);
    return existsSync(file) && /proxy/.test(readFileSync(file, 'utf8')) && /['"`]\/api/.test(readFileSync(file, 'utf8'));
  });
}

export function findHtmlEntry(root: string, pkg: Pkg): string | undefined {
  return ['index.html', 'public/index.html', 'src/index.html', 'src/app.html', 'static/index.html']
    .map((f) => posix.join(pkg.dir, f))
    .find((f) => existsSync(join(root, f)) && /<\/body>/i.test(readFileSync(join(root, f), 'utf8')));
}

export function findNext(root: string, pkg: Pkg): { kind: 'app' | 'pages'; dir: string; layout?: string } | undefined {
  const at = (d: string) => posix.join(pkg.dir, d);
  const app = ['src/app', 'app'].find((d) => existsSync(join(root, at(d))));
  if (app) {
    const layout = ['layout.tsx', 'layout.jsx', 'layout.js'].map((f) => posix.join(at(app), f)).find((f) => existsSync(join(root, f)));
    return { kind: 'app', dir: at(app), layout };
  }
  const pages = ['src/pages', 'pages'].find((d) => existsSync(join(root, at(d))));
  return pages ? { kind: 'pages', dir: at(pages) } : undefined;
}

export type PackageManager = 'npm' | 'pnpm' | 'yarn';

/** The package manager for a package: its own lockfile first, then the repo root's. */
export function detectPm(root: string, pkg: Pkg): { pm: PackageManager; locked: boolean } {
  for (const dir of [pkg.dir, '']) {
    const at = (f: string) => existsSync(join(root, dir, f));
    if (at('pnpm-lock.yaml')) return { pm: 'pnpm', locked: true };
    if (at('yarn.lock')) return { pm: 'yarn', locked: true };
    if (at('package-lock.json') || at('npm-shrinkwrap.json')) return { pm: 'npm', locked: true };
  }
  return { pm: 'npm', locked: false };
}

const installCommand = (pm: PackageManager, locked: boolean) =>
  pm === 'pnpm' ? `pnpm install${locked ? ' --frozen-lockfile' : ''}` : pm === 'yarn' ? `yarn install${locked ? ' --frozen-lockfile' : ''}` : locked ? 'npm ci' : 'npm install';

/** The Node major a project targets: .nvmrc, .node-version, then engines.node. Undefined when it says nothing usable. */
export function detectNodeMajor(root: string, packages: Pkg[]): number | undefined {
  for (const dir of [...packages.map((p) => p.dir), '']) {
    for (const file of ['.nvmrc', '.node-version']) {
      const path = join(root, dir, file);
      if (existsSync(path)) {
        const major = Number(readFileSync(path, 'utf8').trim().replace(/^v/, '').split('.')[0]);
        if (Number.isInteger(major) && major >= 16) return major;
      }
    }
    try {
      const engines = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')).engines?.node as string | undefined;
      const range = engines?.match(/\d+/);
      const major = range ? Number(range[0]) : NaN;
      // ">=18" means 18 or newer: the oldest is what it was written for, and works on the newer ones we default to.
      if (Number.isInteger(major) && major >= 16 && !/[<]/.test(engines ?? '')) return major;
    } catch {
      // no package.json here
    }
  }
  return undefined;
}

/**
 * The commands the fix engine runs in a fresh clone, split so tests can run offline: `install` needs network and runs
 * first, `test` and `build` then need none. In a monorepo with workspaces they are the root's own scripts. Otherwise they
 * are the install, tests and build of each package that has them, each run from its own folder.
 */
export function buildCommands(root: string, packages: Pkg[], chosen: Pkg[]): { install: string; test: string; build: string; hasTests: boolean; nodeMajor?: number } {
  const rootPkg = packages.find((p) => p.dir === '');
  const targets = rootPkg?.workspaces ? [rootPkg] : [...new Set(chosen)];
  const cd = (p: Pkg, cmd: string) => (p.dir ? `(cd ${p.dir} && ${cmd})` : cmd);

  const withTests = targets.filter((p) => p.scripts.test);
  const withBuild = targets.filter((p) => p.scripts.build);
  const needInstall = [...new Set([...withTests, ...withBuild])];
  const installs = needInstall.map((p) => {
    const { pm, locked } = detectPm(root, p);
    return cd(p, installCommand(pm, locked));
  });
  const tests = withTests.map((p) => cd(p, `${detectPm(root, p).pm} test`));
  const builds = withBuild.map((p) => cd(p, `${detectPm(root, p).pm} run build`));

  const fallback = targets[0] ?? rootPkg;
  const fb = fallback ? detectPm(root, fallback) : { pm: 'npm' as const, locked: false };
  return {
    install: installs.length ? installs.join(' && ') : installCommand(fb.pm, fb.locked),
    // With no test script this fails on purpose: BlazeResolver only opens a fix that passes real tests.
    test: tests.length ? tests.join(' && ') : `${fb.pm} test`,
    build: builds.length ? builds.join(' && ') : 'true',
    hasTests: tests.length > 0,
    nodeMajor: detectNodeMajor(root, targets)
  };
}
