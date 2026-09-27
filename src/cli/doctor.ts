import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { parse } from 'dotenv';
import { REPO_PATTERN } from '../github/index.js';
import { describeProviders } from '../triage/providers.js';
import { gh, type Gh } from './app.js';
import { repoRoot } from './detect.js';
import { RULESET_NAME } from './harden.js';
import { CONFIG_FILE } from './init.js';

export interface DoctorCheck {
  status: 'ok' | 'warn' | 'fail';
  name: string;
  detail: string;
}

export interface DoctorOptions {
  cwd: string;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  run?: Gh;
  dockerAvailable?: () => boolean;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Checks the local install and GitHub settings without printing secrets or changing the repository. */
export async function runDoctor(opts: DoctorOptions): Promise<DoctorCheck[]> {
  const root = repoRoot(opts.cwd);
  const configPath = join(root, CONFIG_FILE);
  const checks: DoctorCheck[] = [];
  const add = (status: DoctorCheck['status'], name: string, detail: string) => checks.push({ status, name, detail });
  if (!existsSync(configPath)) {
    add('fail', 'config', `${CONFIG_FILE} is missing; run npx blazeresolver init`);
    return checks;
  }

  let config: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
    if (!record(parsed)) throw new Error('expected a JSON object');
    config = parsed;
  } catch (error) {
    add('fail', 'config', error instanceof Error ? error.message : 'invalid JSON');
    return checks;
  }

  const repo = config.repo;
  const branch = config.defaultBranch;
  const installCommand = config.installCommand;
  const sandbox = config.sandbox;
  const layout = record(config.layout) ? config.layout : {};
  if (typeof repo !== 'string' || !REPO_PATTERN.test(repo) || typeof branch !== 'string' || !branch.trim()) {
    add('fail', 'config', 'repo or defaultBranch is invalid');
    return checks;
  }
  if (typeof config.testCommand !== 'string' || !config.testCommand.trim() || typeof config.buildCommand !== 'string' || !config.buildCommand.trim()) {
    add('fail', 'commands', 'testCommand and buildCommand must both be set');
    return checks;
  }
  add('ok', 'config', `${repo} · ${branch}`);

  const envDir = layout.handler === 'next' ? layout.frontend : layout.backend;
  const candidateDir = typeof envDir === 'string' ? resolve(root, envDir) : root;
  const envPath = candidateDir === root || candidateDir.startsWith(`${root}${sep}`) ? join(candidateDir, '.env') : join(root, '.env');
  let fileEnv: Record<string, string> = {};
  if (existsSync(envPath)) {
    try { fileEnv = parse(readFileSync(envPath)); } catch { /* the explicit process environment can still work */ }
  }
  const env = { ...fileEnv, ...(opts.env ?? process.env) };
  const token = env.BLAZE_GITHUB_TOKEN;
  if (!token) add('fail', 'endpoint token', `BLAZE_GITHUB_TOKEN is missing from ${dirname(envPath)}/.env or the environment`);
  else {
    try {
      const res = await (opts.fetch ?? fetch)(`https://api.github.com/repos/${repo}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'blazeresolver' },
        signal: AbortSignal.timeout(15_000)
      });
      add(res.ok ? 'ok' : 'fail', 'GitHub access', res.ok ? 'endpoint token can read the configured repository' : `GitHub returned ${res.status}; check token access and expiry`);
    } catch {
      add('fail', 'GitHub access', 'could not reach GitHub API');
    }
  }

  const workflow = join(root, '.github/workflows/blazeresolver.yml');
  add(existsSync(workflow) ? 'ok' : 'fail', 'workflow', existsSync(workflow) ? 'GitHub Actions workflow is present' : 'missing .github/workflows/blazeresolver.yml; rerun init --force');
  if (installCommand && sandbox !== 'none') {
    const docker = opts.dockerAvailable ?? (() => {
      try { execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 5_000 }); return true; } catch { return false; }
    });
    const available = docker();
    add(available ? 'ok' : 'fail', 'offline sandbox', available ? 'Docker is available' : 'Docker is required by this config; install/start Docker or rerun init --no-sandbox');
  } else {
    add('warn', 'offline sandbox', 'tests will have network access; use init with Docker for offline verification');
  }

  const providers = describeProviders(env as NodeJS.ProcessEnv);
  add(providers.length ? 'ok' : 'warn', 'AI provider', providers.length ? providers.map((p) => p.split(':')[0]).join(', ') : 'no key recognized; triage uses rules and the fix job cannot run');

  const run = opts.run ?? gh;
  const listed = await run(['api', `repos/${repo}/rulesets`]);
  if (!listed.ok) add('warn', 'branch protection', 'could not inspect rulesets with gh; run npx blazeresolver harden and check GitHub settings');
  else {
    try {
      const rulesets = JSON.parse(listed.out) as { id: number; name: string }[];
      const managed = rulesets.find((item) => item.name === RULESET_NAME);
      if (!managed) add('warn', 'branch protection', 'BlazeResolver review ruleset is missing; run npx blazeresolver harden');
      else {
        const detail = await run(['api', `repos/${repo}/rulesets/${managed.id}`]);
        const rules = detail.ok ? (JSON.parse(detail.out) as { rules?: { type: string; parameters?: { required_approving_review_count?: number; require_code_owner_review?: boolean } }[] }).rules ?? [] : [];
        const review = rules.find((rule) => rule.type === 'pull_request')?.parameters;
        const protectedBranch = typeof review?.required_approving_review_count === 'number' && review.required_approving_review_count >= 1 && review.require_code_owner_review === true;
        add(protectedBranch ? 'ok' : 'warn', 'branch protection', protectedBranch ? 'review required on default branch' : 'ruleset exists but approval requirements could not be confirmed');
      }
    } catch {
      add('warn', 'branch protection', 'GitHub returned an unreadable ruleset response; verify required PR approval manually');
    }
  }

  const secrets = await run(['secret', 'list', '--repo', repo]);
  if (!secrets.ok) add('warn', 'Actions secrets', 'could not inspect repo secrets with gh');
  else {
    const names = new Set(secrets.out.split(/\r?\n/).map((line) => line.trim().split(/\s+/)[0]).filter(Boolean));
    const aiSecret = ['API_KEYS', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'].some((name) => names.has(name));
    add(aiSecret ? 'ok' : 'warn', 'Actions AI key', aiSecret ? 'a supported provider secret is present' : 'no API_KEYS, ANTHROPIC_API_KEY, or GEMINI_API_KEY repo secret found');
    if (config.app === true) {
      const appReady = names.has('BLAZE_APP_ID') && names.has('BLAZE_APP_PRIVATE_KEY');
      add(appReady ? 'ok' : 'fail', 'GitHub App secrets', appReady ? 'App id and private key are present' : 'BLAZE_APP_ID or BLAZE_APP_PRIVATE_KEY is missing');
    }
  }
  return checks;
}
