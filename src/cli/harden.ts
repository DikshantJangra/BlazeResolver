import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gh, type Gh } from './app.js';
import { CONFIG_FILE, type Manifest } from './init.js';

export const RULESET_NAME = 'BlazeResolver: protect the default branch';
const CODEOWNERS_FILE = '.github/CODEOWNERS';

/** Paths where a wrong change costs the most. A human owner must review any PR that touches them. */
const SENSITIVE = ['/.github/', 'auth/', 'payments/', 'billing/', 'migrations/', 'package.json', '/package-lock.json', '.npmrc'];

export const codeownersBlock = (owner: string) =>
  `# BlazeResolver: a human owner must review anything that touches these paths.\n${SENSITIVE.map((p) => `${p} ${owner}`).join('\n')}\n`;

/** The branch ruleset: no deleting, no force pushes, and every change through a PR that a human approved. */
export function rulesetBody(strict: boolean) {
  return {
    name: RULESET_NAME,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 1,
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: true,
          require_last_push_approval: false,
          required_review_thread_resolution: false
        }
      }
    ],
    // Admins (you) can still merge, through a PR. Nothing else can: the BlazeResolver App or token is not an admin.
    bypass_actors: strict ? [] : [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'pull_request' }]
  };
}

export interface Step {
  name: string;
  status: 'done' | 'skipped' | 'failed' | 'planned';
  detail: string;
}

export interface HardenOptions {
  root: string;
  repo: string;
  /** Who reviews the sensitive paths, e.g. @you or @org/team. Defaults to the logged-in gh user. */
  owner?: string;
  /** No admin bypass: not even you can merge without an approval from someone else. */
  strict?: boolean;
  /** Show what would change and change nothing. */
  dryRun?: boolean;
  log?: (line: string) => void;
  run?: Gh;
  /** Asked before anything is changed on GitHub. Omit to go ahead. */
  confirm?: (question: string) => Promise<boolean>;
}

const asJson = <T>(text: string): T | undefined => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
};

/**
 * Applies the repo settings that make "a human always approves" true on GitHub's side, not just in BlazeResolver's:
 * a branch ruleset, CODEOWNERS for the sensitive paths, read-only Actions by default, and secret-scanning push
 * protection. Each step reports on its own, because free private repos cannot use rulesets and that must not block the rest.
 */
export async function runHarden(opts: HardenOptions): Promise<Step[]> {
  const log = opts.log ?? console.log;
  const run = opts.run ?? gh;
  const { repo, root } = opts;
  const steps: Step[] = [];
  const configPath = join(root, CONFIG_FILE);
  const config = existsSync(configPath) ? (JSON.parse(readFileSync(configPath, 'utf8')) as { app?: boolean; installed?: Manifest }) : undefined;

  const login = opts.owner ?? (await run(['api', 'user', '--jq', '.login'])).out.trim();
  const owner = login ? (login.startsWith('@') ? login : `@${login}`) : undefined;

  if (!opts.dryRun && opts.confirm) {
    const plan = [
      `Ruleset "${RULESET_NAME}" on the default branch: no deletion, no force push, PRs need 1 approval and a code owner's review${opts.strict ? '' : '; repo admins can still merge through a PR'}`,
      `${CODEOWNERS_FILE}: ${owner ?? '(no owner found)'} owns ${SENSITIVE.join(', ')}`,
      `Actions: read-only token by default${config?.app ? ', and Actions can no longer approve PRs' : ''}`,
      'Secret scanning with push protection'
    ];
    if (!(await opts.confirm(`These changes will be made to ${repo} on GitHub:\n  - ${plan.join('\n  - ')}\nContinue?`))) {
      log('Cancelled. Nothing was changed.');
      return [];
    }
  }
  const step = (s: Step) => (steps.push(s), log(`  ${s.status === 'done' ? 'done   ' : s.status === 'planned' ? 'would  ' : s.status === 'skipped' ? 'skipped' : 'FAILED '} ${s.name}${s.detail ? `: ${s.detail}` : ''}`));

  // 1. Branch ruleset (updated in place if a previous run made it)
  if (opts.dryRun) step({ name: 'branch ruleset', status: 'planned', detail: RULESET_NAME });
  else {
    const list = asJson<{ id: number; name: string }[]>((await run(['api', `repos/${repo}/rulesets`])).out) ?? [];
    const existing = list.find((r) => r.name === RULESET_NAME);
    const call = existing
      ? await run(['api', '-X', 'PUT', `repos/${repo}/rulesets/${existing.id}`, '--input', '-'], JSON.stringify(rulesetBody(!!opts.strict)))
      : await run(['api', '-X', 'POST', `repos/${repo}/rulesets`, '--input', '-'], JSON.stringify(rulesetBody(!!opts.strict)));
    step(call.ok
      ? { name: 'branch ruleset', status: 'done', detail: existing ? 'updated' : 'created' }
      : { name: 'branch ruleset', status: 'failed', detail: `${firstLine(call.out)}. Private repos need GitHub Pro, Team or Enterprise for rulesets: set "Require a pull request, 1 approval" in Settings, Branches by hand.` });
  }

  // 2. CODEOWNERS, appended as exact text so remove can take back precisely that
  if (!owner) step({ name: 'CODEOWNERS', status: 'skipped', detail: 'could not tell who you are; pass --owner @you' });
  else if (opts.dryRun) step({ name: 'CODEOWNERS', status: 'planned', detail: `${owner} owns ${SENSITIVE.join(', ')}` });
  else step(writeCodeowners(root, owner, config !== undefined));

  // 3. Actions defaults
  if (opts.dryRun) step({ name: 'Actions permissions', status: 'planned', detail: 'read-only by default' });
  else {
    const body: Record<string, unknown> = { default_workflow_permissions: 'read' };
    // With a GitHub App, Actions no longer needs to create PRs, so it should not be able to approve them either.
    if (config?.app) body.can_approve_pull_request_reviews = false;
    const call = await run(['api', '-X', 'PUT', `repos/${repo}/actions/permissions/workflow`, '--input', '-'], JSON.stringify(body));
    step(call.ok
      ? { name: 'Actions permissions', status: 'done', detail: config?.app ? 'read-only default, Actions cannot approve PRs' : 'read-only default (Actions must keep creating PRs until you run `blazeresolver app`)' }
      : { name: 'Actions permissions', status: 'failed', detail: firstLine(call.out) });
  }

  // 4. Secret scanning + push protection
  if (opts.dryRun) step({ name: 'secret scanning', status: 'planned', detail: 'with push protection' });
  else {
    const call = await run(['api', '-X', 'PATCH', `repos/${repo}`, '--input', '-'], JSON.stringify({ security_and_analysis: { secret_scanning: { status: 'enabled' }, secret_scanning_push_protection: { status: 'enabled' } } }));
    step(call.ok
      ? { name: 'secret scanning', status: 'done', detail: 'with push protection' }
      : { name: 'secret scanning', status: 'skipped', detail: `${firstLine(call.out)} (private repos need GitHub Secret Protection)` });
  }

  log('\nStill up to you (GitHub cannot be told these):');
  log('  - Add your CI job as a required status check (Settings, Rules, the ruleset): only you know its name.');
  log('  - Commit .github/CODEOWNERS; the code-owner rule takes effect once it is on the default branch.');
  log('  - Never use self-hosted runners for this workflow on a public repo. Turn on 2FA for everyone with write access.');
  return steps;
}

const firstLine = (t: string) => t.trim().split('\n')[0].slice(0, 200);

function writeCodeowners(root: string, owner: string, hasConfig: boolean): Step {
  const path = join(root, CODEOWNERS_FILE);
  const block = codeownersBlock(owner);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  if (existing?.includes('# BlazeResolver: a human owner')) return { name: 'CODEOWNERS', status: 'skipped', detail: 'already has the BlazeResolver block' };

  const sep = existing === undefined ? '' : existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, (existing ?? '') + sep + block);

  if (hasConfig) {
    const configPath = join(root, CONFIG_FILE);
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { installed?: Manifest };
    config.installed = { ...(config.installed ?? { files: [], edits: [] }) };
    config.installed.appended = [...(config.installed.appended ?? []), { file: CODEOWNERS_FILE, created: existing === undefined, added: sep + block }];
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  }
  return { name: 'CODEOWNERS', status: 'done', detail: `${owner} owns ${SENSITIVE.length} sensitive paths (commit ${CODEOWNERS_FILE})` };
}
