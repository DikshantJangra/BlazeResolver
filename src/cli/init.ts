import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { REPO_PATTERN } from '../github/index.js';
import { WORKFLOW, routeFile, widgetTag } from './templates.js';

export interface InitOptions {
  cwd: string;
  repo?: string;
  branch?: string;
  test?: string;
  build?: string;
  /** Overwrite files that already exist. */
  force?: boolean;
  /** Skip `npm install blazeresolver`. */
  noInstall?: boolean;
  log?: (line: string) => void;
}

const git = (cwd: string, ...args: string[]) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

/** The package manager and the commands that install, test and build this project. */
export function detectCommands(cwd: string): { install: string; test: string; build: string; hasTests: boolean } {
  const pkg = existsSync(join(cwd, 'package.json')) ? JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) : {};
  const scripts = pkg.scripts ?? {};
  const [pm, install] = existsSync(join(cwd, 'pnpm-lock.yaml'))
    ? ['pnpm', 'pnpm install --frozen-lockfile']
    : existsSync(join(cwd, 'yarn.lock'))
      ? ['yarn', 'yarn install --frozen-lockfile']
      : ['npm', 'npm ci'];
  return {
    install,
    test: `${install} && ${pm} test`,
    build: scripts.build ? `${pm} run build` : 'true',
    hasTests: !!scripts.test
  };
}

/** Where a Next.js App Router project keeps its routes, or undefined for any other project. */
function nextRouteDir(cwd: string): string | undefined {
  const pkgFile = join(cwd, 'package.json');
  if (!existsSync(pkgFile)) return undefined;
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
  if (!{ ...pkg.dependencies, ...pkg.devDependencies }.next) return undefined;
  return ['src/app', 'app'].find((d) => existsSync(join(cwd, d)));
}

function write(cwd: string, file: string, content: string, force: boolean | undefined, log: (l: string) => void): boolean {
  const path = join(cwd, file);
  if (existsSync(path) && !force) {
    log(`  kept   ${file} (already exists, use --force to overwrite)`);
    return false;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  log(`  wrote  ${file}`);
  return true;
}

/**
 * Sets a project up: config, the GitHub workflow that fixes bugs, and the handler that receives widget reports.
 * Everything lands in the user's own repo. Nothing is registered anywhere and nothing is hosted by us.
 */
export function runInit(opts: InitOptions): { repo: string; handlerFile?: string } {
  const { cwd } = opts;
  const log = opts.log ?? console.log;

  const repo = opts.repo ?? git(cwd, 'remote', 'get-url', 'origin').match(/([\w.-]+\/[\w.-]+?)(?:\.git)?$/)?.[1];
  if (!repo || !REPO_PATTERN.test(repo)) throw new Error('Could not find a GitHub remote. Run inside your repo, or pass --repo owner/name.');
  const branch = opts.branch ?? (git(cwd, 'symbolic-ref', '--short', 'HEAD') || 'main');
  const cmds = detectCommands(cwd);

  log(`\nBlazeResolver for ${repo} (default branch ${branch})\n`);
  write(cwd, 'blazeresolver.config.json', JSON.stringify({ repo, defaultBranch: branch, testCommand: opts.test ?? cmds.test, buildCommand: opts.build ?? cmds.build }, null, 2) + '\n', opts.force, log);
  write(cwd, '.github/workflows/blazeresolver.yml', WORKFLOW, opts.force, log);

  let handlerFile: string | undefined;
  const routeDir = nextRouteDir(cwd);
  if (routeDir) {
    handlerFile = `${routeDir}/api/blaze/route.${existsSync(join(cwd, 'tsconfig.json')) ? 'ts' : 'js'}`;
    write(cwd, handlerFile, routeFile(repo), opts.force, log);
  }

  if (existsSync(join(cwd, 'package.json')) && !opts.noInstall) {
    log('  running npm install blazeresolver ...');
    try {
      execFileSync('npm', ['install', 'blazeresolver'], { cwd, stdio: 'ignore' });
    } catch {
      log('  could not install blazeresolver; run `npm install blazeresolver` yourself');
    }
  }

  log('\nNext steps:');
  let step = 1;
  if (!cmds.hasTests) log(`  ${step++}. This project has no "test" script. BlazeResolver verifies every fix with your tests, so add some or fixes will go to a human.`);
  if (!handlerFile) {
    log(`  ${step++}. Add the report endpoint to your backend (Express shown; any Request/Response runtime can use createHandler directly):\n`);
    log(`       import { createHandler, nodeHandler } from 'blazeresolver/handler';`);
    log(`       app.post('/api/blaze', nodeHandler(createHandler({ repo: '${repo}' })));\n`);
  }
  log(`  ${step++}. Create a fine-grained GitHub token with Issues: read and write on ${repo} only.`);
  log(`     Give it to your backend as BLAZE_GITHUB_TOKEN, along with ANTHROPIC_API_KEY (optional; without it triage uses keyword rules).`);
  log(`  ${step++}. Add the repo secret the fix workflow needs:   gh secret set ANTHROPIC_API_KEY`);
  log(`  ${step++}. GitHub, Settings, Actions, General: turn on "Allow GitHub Actions to create and approve pull requests".`);
  log(`  ${step++}. Protect ${branch} (Settings, Branches) so every fix needs a human review.`);
  log(`  ${step++}. Paste this before </body> in your app:\n\n       ${widgetTag('/api/blaze')}\n`);
  log('Then commit the new files. Updates are automatic: the widget loads from a CDN and the workflow runs blazeresolver@latest.');
  return { repo, handlerFile };
}
