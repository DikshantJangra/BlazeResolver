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

interface EnvVar { key: string; comment?: string }
interface EnvSection { header: string; vars: EnvVar[] }

const ENV_SECTIONS: EnvSection[] = [
  {
    header:
      '# --- BlazeResolver: AI (triage & the fix engine) ------------------------------\n' +
      '# Paste any AI provider key; the provider is recognized from the key itself.\n' +
      '# Several keys, even from different providers, give automatic failover and rotation:\n' +
      '#   API_KEYS=sk-ant-...,gsk_...,nvapi-...\n' +
      '# Recognized: Anthropic, OpenAI, Gemini, Groq, NVIDIA NIM, DeepSeek, xAI, Cerebras, Fireworks,\n' +
      '# Perplexity, OpenRouter, Hugging Face, Zhipu, GitHub Models. Keys that look like nothing in particular\n' +
      '# (Mistral, Together, Cohere, ...) go in a named variable instead, e.g. MISTRAL_API_KEY=...\n' +
      '# Get a key (free tiers marked *):\n' +
      '#   Groq*        https://console.groq.com/keys\n' +
      '#   Gemini*      https://aistudio.google.com/apikey\n' +
      '#   NVIDIA NIM*  https://build.nvidia.com\n' +
      '#   OpenRouter*  https://openrouter.ai/keys\n' +
      '#   Anthropic    https://console.anthropic.com/settings/keys\n' +
      '#   OpenAI       https://platform.openai.com/api-keys\n' +
      '#   DeepSeek     https://platform.deepseek.com/api_keys\n' +
      '# Check what was recognized: npx blazeresolver providers\n' +
      '# Optional: BLAZE_MODEL=<model>, BLAZE_PROVIDER=<name> to pin one, OLLAMA_BASE_URL for a local\n' +
      '# Ollama, AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT for Azure OpenAI.',
    vars: [{ key: 'API_KEYS' }]
  },
  {
    header: '# --- BlazeResolver: GitHub -----------------------------------------------------',
    vars: [{ key: 'BLAZE_GITHUB_TOKEN', comment: '# Fine-grained token: Issues read and write on this repo only.' }]
  }
];

/**
 * Creates `.env` with BlazeResolver's variables, or appends only the ones an existing file is missing.
 * Never touches a line that's already there, so it's safe to run on every `init`.
 */
function ensureEnvFile(cwd: string, log: (l: string) => void): void {
  const path = join(cwd, '.env');
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  const existingKeys = new Set(
    (existing ?? '')
      .split('\n')
      .map((l) => l.match(/^([A-Z0-9_]+)=/)?.[1])
      .filter((k): k is string => !!k)
  );

  const blocks = ENV_SECTIONS.map(({ header, vars }) => {
    const missing = vars.filter((v) => !existingKeys.has(v.key));
    if (!missing.length) return undefined;
    const lines = missing.map((v) => (v.comment ? `${v.comment}\n${v.key}=` : `${v.key}=`));
    return [header, ...lines].join('\n');
  }).filter((b): b is string => !!b);

  if (!blocks.length) {
    if (existing !== undefined) log("  kept   .env (already has BlazeResolver's variables)");
    return;
  }

  const addition = blocks.join('\n\n') + '\n';
  if (existing === undefined) {
    writeFileSync(path, addition);
    log('  wrote  .env');
  } else {
    const sep = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
    writeFileSync(path, existing + sep + addition);
    log('  edited .env (appended missing BlazeResolver variables)');
  }
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

  ensureEnvFile(cwd, log);

  log('\nNext steps:');
  let step = 1;
  if (!cmds.hasTests) log(`  ${step++}. This project has no "test" script. BlazeResolver verifies every fix with your tests, so add some or fixes will go to a human.`);
  if (!handlerFile) {
    log(`  ${step++}. Add the report endpoint to your backend (Express shown; any Request/Response runtime can use createHandler directly):\n`);
    log(`       import { createHandler, nodeHandler } from 'blazeresolver/handler';`);
    log(`       app.post('/api/blaze', nodeHandler(createHandler({ repo: '${repo}' })));\n`);
  }
  log(`  ${step++}. Create a fine-grained GitHub token with Issues: read and write on ${repo} only.`);
  log(`     Give it to your backend as BLAZE_GITHUB_TOKEN in .env (just created/updated for you).`);
  log(`  ${step++}. Paste any AI key into .env as API_KEYS= (any provider; it's recognized automatically; several = failover).`);
  log(`     Optional: without one, triage uses keyword rules. Check with: npx blazeresolver providers`);
  log(`  ${step++}. Give the fix workflow the same keys:   gh secret set API_KEYS`);
  log(`  ${step++}. GitHub, Settings, Actions, General: turn on "Allow GitHub Actions to create and approve pull requests".`);
  log(`  ${step++}. Protect ${branch} (Settings, Branches) so every fix needs a human review.`);
  log(`  ${step++}. Paste this before </body> in your app:\n\n       ${widgetTag('/api/blaze')}\n`);
  log('Then commit the new files (not .env). Updates are automatic: the widget loads from a CDN and the workflow runs blazeresolver@latest.');
  return { repo, handlerFile };
}
