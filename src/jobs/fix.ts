import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { CodeGraphAdapter } from '../codebase/codegraph-adapter.js';
import { GitWorkspace, dockerAvailable, type SandboxUser } from '../codebase/git-workspace.js';
import { authedUrl, commentOnIssue, openIssue, openPullRequest, plainUrl, pushBranch, redactPersonalData } from '../github/index.js';
import type { Project } from '../projects/index.js';
import type { AIProvider } from '../resolver/ai-provider.js';
import { BugResolver } from '../resolver/bug-resolver.js';
import { addedLines, findSecrets, secretValuesFromEnv } from '../resolver/guards.js';
import { engineVersion } from '../version.js';
import type { Incident, ResolutionResult } from '../resolver/types.js';

/** How the repo's tests run. `docker` (the default for new setups) installs with network, then tests offline in a container. */
export type SandboxMode = 'docker' | 'none';

export interface FixProject extends Pick<Project, 'repo' | 'defaultBranch' | 'testCommand' | 'buildCommand'> {
  /** Installs dependencies (with network). Without it the whole testCommand runs with network, as before offline tests existed. */
  installCommand?: string;
  sandbox?: SandboxMode;
  /** Container image for offline tests; must have the project's toolchain. */
  sandboxImage?: string;
}

/** What the audit comment on the PR records besides the run itself. */
export interface AuditContext {
  /** AI providers configured, in failover order. Names only. */
  providers?: string[];
  /** Calls made to the model during this job. */
  modelCalls?: () => number;
  /** Fix attempts allowed. */
  maxAttempts?: number;
}

export interface FixJobOptions {
  project: FixProject;
  incident: Incident;
  /** How many customers reported it. Customers are never identified on GitHub, only counted. */
  reportCount: number;
  token: string;
  ai: AIProvider;
  /** Overrides github.com for clone and push (tests use a local bare repo). */
  remoteUrl?: string;
  fetch?: typeof fetch;
  /** The GitHub issue this incident lives in: the PR closes it, and a failure is reported on it instead of a new issue. */
  issueNumber?: number;
  /** Unprivileged user the repo's tests and builds run as (see resolveFixSandbox). */
  sandbox?: SandboxUser;
  /** Exact secret values a fix must never contain. Defaults to every secret-looking variable in this process's environment. */
  secretValues?: string[];
  audit?: AuditContext;
  /** Whether Docker is usable. Tests set this; by default it is checked for real. */
  dockerUp?: () => boolean;
}

export type FixSandbox = { ok: true; sandbox?: SandboxUser } | { ok: false; problem: string };

function lookupUser(name: string): SandboxUser | undefined {
  try {
    const id = (flag: string) => Number(execFileSync('id', [flag, name], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim());
    return { uid: id('-u'), gid: id('-g') };
  } catch {
    return undefined;
  }
}

/**
 * Whether the fix engine may run, and as whom. Each fix's tests execute code no human has reviewed (the AI's patch,
 * which a crafted customer report can influence), so they must not run as the server's user: that user can read the
 * server's API keys and GitHub token (e.g. /proc/1/environ) and every customer report.
 * - BLAZE_SANDBOX_USER: a dedicated unprivileged user; the server must run as root to start tests as it.
 * - Otherwise BLAZE_ALLOW_UNSANDBOXED_FIXES=true is an explicit opt-in for a trusted local setup.
 */
export function resolveFixSandbox(
  env: NodeJS.ProcessEnv = process.env,
  serverUid: number | undefined = process.getuid?.(),
  lookup: (name: string) => SandboxUser | undefined = lookupUser
): FixSandbox {
  const name = env.BLAZE_SANDBOX_USER;
  if (name) {
    if (serverUid !== 0) return { ok: false, problem: 'BLAZE_SANDBOX_USER needs the server to run as root, to start tests as that user.' };
    const user = lookup(name);
    if (!user) return { ok: false, problem: `sandbox user "${name}" does not exist.` };
    if (user.uid === 0 || user.uid === serverUid) {
      return { ok: false, problem: `sandbox user "${name}" must be a dedicated unprivileged user, not root or the server's user.` };
    }
    return { ok: true, sandbox: user };
  }
  if (env.BLAZE_ALLOW_UNSANDBOXED_FIXES === 'true') return { ok: true };
  return {
    ok: false,
    problem:
      "fixes run AI-written code in the repo's tests. Set BLAZE_SANDBOX_USER to a dedicated unprivileged user " +
      '(the Docker image has blaze-sandbox), or BLAZE_ALLOW_UNSANDBOXED_FIXES=true for a trusted local setup.'
  };
}

export type FixOutcome =
  | { status: 'pr_opened'; url: string }
  | { status: 'needs_human'; url?: string; reason: string };

const DEFAULT_IMAGE = 'node:22-bookworm-slim';

/** Offline container settings for a project, or undefined when tests run with network. Fails closed if Docker was asked for and is missing. */
export function resolveOffline(project: FixProject, dockerUp: () => boolean = dockerAvailable): { image: string } | undefined {
  if (!project.installCommand || project.sandbox === 'none') return undefined;
  if (!dockerUp()) {
    throw new Error('Tests are set to run offline in a container ("sandbox": "docker" in blazeresolver.config.json) but Docker is not available here. Use a runner with Docker, or set "sandbox": "none" to run tests with network access.');
  }
  return { image: project.sandboxImage || DEFAULT_IMAGE };
}

/** One line for the audit comment on how isolated the tests were. */
function describeSandbox(project: FixProject, offline: { image: string } | undefined, unprivileged: boolean): string {
  if (offline) return `offline: dependencies installed with network from the lockfile, then tests and build ran in a \`${offline.image}\` container with no network, no capabilities and no privilege escalation`;
  if (!project.installCommand) return 'NOT offline: this config predates offline tests, so tests ran with network access (re-run `npx blazeresolver init --force`)';
  return `NOT offline: "sandbox": "none", so tests ran with network access${unprivileged ? ' as an unprivileged user' : ''}`;
}

function diffSummary(diff: string): { files: string[]; added: number; removed: number } {
  const files = [...diff.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]);
  let added = 0;
  let removed = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) added++;
    else if (line.startsWith('-') && !line.startsWith('---')) removed++;
  }
  return { files, added, removed };
}

const seconds = (ms: number) => (ms < 90_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60_000)}m`);

/**
 * The comment left on every PR: what produced it, what it touched, how it was verified, and which checks it passed.
 * A record a reviewer can trust more than the PR description, because it is written by the harness and not by the model.
 */
export function auditComment(a: {
  result: ResolutionResult;
  project: FixProject;
  offline: { image: string } | undefined;
  unprivileged: boolean;
  durationMs: number;
  reportCount: number;
  issueNumber?: number;
  audit?: AuditContext;
}): string {
  const { result, project, audit } = a;
  const d = diffSummary(result.diff ?? '');
  const last = result.attempts[result.attempts.length - 1];
  const failedBefore = result.attempts.slice(0, -1).map((x) => `#${x.number}: ${x.failure?.stage}`).join(', ');
  const rows: [string, string][] = [
    ['Engine', `blazeresolver ${engineVersion()}`],
    ['Trigger', `${a.issueNumber ? `issue #${a.issueNumber}, ` : ''}${a.reportCount} customer report(s)`],
    ['Model', `${audit?.providers?.length ? `providers in failover order: ${audit.providers.join(', ')}` : 'not recorded'}${audit?.modelCalls ? `; ${audit.modelCalls()} model call(s)` : ''}`],
    ['Attempts', `${result.attempts.length} of ${audit?.maxAttempts ?? 3} allowed${failedBefore ? ` (earlier attempts failed at: ${failedBefore})` : ''}`],
    ['Files changed', `${d.files.length} (+${d.added} -${d.removed}): ${d.files.map((f) => `\`${f}\``).join(', ') || 'none'}`],
    ['Tests before the fix', result.baseline?.success ? 'passing (the bug was not covered by an existing test)' : 'failing'],
    ['Tests after the fix', last?.tests?.success ? 'passing' : 'not run'],
    ['Build after the fix', last?.build?.success ? 'passing' : 'not run'],
    ['Isolation', describeSandbox(project, a.offline, a.unprivileged)],
    ['Checks passed', 'no forbidden paths (CI, secrets, lockfiles, auth, payments, migrations, install and test config); no dependency, script or install-time changes; no removed assertions; no secrets in the diff; patch within the size limit'],
    ['Duration', seconds(a.durationMs)]
  ];
  return [
    '## BlazeResolver audit',
    '| | |\n| :--- | :--- |\n' + rows.map(([k, v]) => `| ${k} | ${v.replace(/\|/g, '\\|')} |`).join('\n'),
    'Written by the harness, not the model. A human still has to review the diff and merge.'
  ].join('\n\n');
}

const tail = (text: string | undefined, n = 1500) => (text ?? '').trim().slice(-n);

function prBody(result: ResolutionResult, reportCount: number, issueNumber?: number): string {
  const inv = result.investigation!;
  const last = result.attempts[result.attempts.length - 1];
  return [
    `## Incident\n${result.incident.title}\n\nReported by ${reportCount} customer(s).`,
    `## Root cause\n${inv.rootCause}`,
    inv.evidence?.length ? `## Evidence\n${inv.evidence.map((e) => `- ${e}`).join('\n')}` : '',
    `## Fix\n${result.summary}`,
    `## Verification\nTests before the fix: ${result.baseline?.success ? 'passing (the bug was not covered)' : 'failing'}\n` +
      `Tests and build after the fix: passing, attempt ${last.number} of ${result.attempts.length}.\n\n` +
      `<details><summary>Test output after the fix</summary>\n\n\`\`\`\n${tail(last.tests?.output)}\n\`\`\`\n</details>`,
    `## Risk\nGenerated by BlazeResolver (${inv.confidence} confidence). Review the diff. Nothing merges without a human.`,
    issueNumber ? `Closes #${issueNumber}` : ''
  ].filter(Boolean).join('\n\n');
}

/**
 * Keeps the server's customer data and secrets on disk out of the sandbox user's reach: no access for other users.
 * Paths match IncidentStore's and ProjectRegistry's defaults.
 */
export function lockDownServerFiles(env: NodeJS.ProcessEnv = process.env): void {
  const dirs = new Set([env.BLAZE_DATA_DIR || '.blazeresolver', dirname(env.BLAZE_PROJECTS_FILE || '.blazeresolver/projects.json')]);
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
    chmodSync(dir, 0o700);
  }
  if (existsSync('.env')) chmodSync('.env', 0o600);
}

/**
 * One incident, start to a GitHub pull request: clone, resolve in isolated workspaces, push a branch, open the PR.
 * When no fix passes, it opens an issue with the findings instead of a PR. It never merges or pushes to the default branch.
 *
 * Tests and builds get a minimal environment and, with `sandbox`, run as an unprivileged user in a copy without .git.
 * They still have network access, so the repo's own source is what unreviewed code could send out.
 */
export async function runFix(opts: FixJobOptions): Promise<FixOutcome> {
  const { project, incident, token, ai } = opts;
  const startedAt = Date.now();
  const offline = resolveOffline(project, opts.dockerUp);
  const secrets = opts.secretValues ?? secretValuesFromEnv(process.env, [token]);
  const root = mkdtempSync(join(tmpdir(), 'blaze-job-'));
  const repoDir = join(root, 'repo');
  const remote = opts.remoteUrl ?? authedUrl(project.repo, token);
  let codebase: CodeGraphAdapter | undefined;
  let workspaces: GitWorkspace | undefined;

  try {
    // Latest commit of the default branch only: big histories would make every fix slow to start.
    execFileSync('git', ['clone', '--quiet', '--depth', '1', '--single-branch', '--branch', project.defaultBranch, remote, repoDir], { stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    // Keep the token out of the clone's config, where the repo's own tests could read it.
    execFileSync('git', ['remote', 'set-url', 'origin', opts.remoteUrl ?? plainUrl(project.repo)], { cwd: repoDir });

    codebase = new CodeGraphAdapter({ root: repoDir });
    workspaces = new GitWorkspace({
      repo: repoDir,
      baseRef: project.defaultBranch,
      testCommand: project.testCommand,
      buildCommand: project.buildCommand,
      installCommand: offline ? project.installCommand : undefined,
      offline,
      workspacesDir: join(root, 'workspaces'),
      env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true', NODE_ENV: 'test' },
      sandbox: opts.sandbox
    });
    const result = await new BugResolver({ codebase, workspaces, ai, secretValues: secrets, maxAttempts: opts.audit?.maxAttempts }).resolve(incident);

    // Last line of defense: the diff that would actually be pushed, checked again after everything else passed.
    if (result.status === 'READY_FOR_REVIEW') {
      const leaked = findSecrets(addedLines(result.diff ?? ''), secrets);
      if (leaked.length) {
        result.status = 'FAILED';
        result.failureReason = `the final diff contains what looks like a secret (${leaked.join(', ')}); nothing was pushed`;
      }
    }

    if (result.status === 'READY_FOR_REVIEW') {
      const branch = `blazeresolver/fix-${incident.id}`;
      await workspaces.commit(result.workspace!, redactPersonalData(`fix: ${incident.title}`).slice(0, 200));
      await pushBranch(result.workspace!.path, remote, branch, token);
      const pr = await openPullRequest(
        { token, repo: project.repo, head: branch, base: project.defaultBranch, title: `fix: ${incident.title}`.slice(0, 200), body: prBody(result, opts.reportCount, opts.issueNumber) },
        opts.fetch
      );
      try {
        await commentOnIssue(
          token, project.repo, pr.number,
          auditComment({ result, project, offline, unprivileged: !!opts.sandbox, durationMs: Date.now() - startedAt, reportCount: opts.reportCount, issueNumber: opts.issueNumber, audit: opts.audit }),
          opts.fetch
        );
      } catch {
        // the audit is a record, not a gate: a failed comment must not undo an opened PR
      }
      return { status: 'pr_opened', url: pr.url };
    }

    const reason = result.failureReason ?? 'no passing fix';
    // Why the last attempt was refused or failed, so a human knows which guard stopped it. Secrets are scrubbed first.
    const last = result.attempts[result.attempts.length - 1]?.failure;
    const scrubbed = last ? secrets.reduce((text, secret) => text.split(secret).join('***'), tail(last.output, 800)).replace(/`{3,}/g, "'''") : '';
    const findings =
      `BlazeResolver could not produce a passing fix.\n\n**Incident:** ${incident.title}\n${incident.description}\n\n` +
      `**Reported by:** ${opts.reportCount} customer(s)\n**Why it stopped:** ${reason}\n` +
      (last ? `\n**Last attempt failed at ${last.stage}:**\n\`\`\`\n${scrubbed}\n\`\`\`\n` : '') +
      (result.investigation ? `\n**Best guess at the cause (${result.investigation.confidence} confidence):** ${result.investigation.rootCause}\n` : '');

    if (opts.issueNumber) {
      await commentOnIssue(token, project.repo, opts.issueNumber, findings, opts.fetch);
      return { status: 'needs_human', url: `https://github.com/${project.repo}/issues/${opts.issueNumber}`, reason };
    }
    const issue = await openIssue(
      { token, repo: project.repo, title: `Customer-reported bug needs a human: ${incident.title}`.slice(0, 200), body: findings },
      opts.fetch
    );
    return { status: 'needs_human', url: issue.url, reason };
  } catch (err) {
    // execFileSync errors quote the whole command, clone URL and token included.
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(token ? message.split(token).join('***') : message);
  } finally {
    await codebase?.close().catch(() => {});
    await workspaces?.dispose().catch(() => {});
    rmSync(root, { recursive: true, force: true });
  }
}
