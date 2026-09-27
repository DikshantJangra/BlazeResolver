#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { repoRoot } from './detect.js';
import { runFixCommand, type ProjectConfig } from './fix.js';
import { runApp } from './app.js';
import { runHarden } from './harden.js';
import { detectRepo } from './detect.js';
import { runInit } from './init.js';
import { runNotifyCommand } from './notify.js';
import { runRemove } from './remove.js';
import { describeProviders } from '../triage/providers.js';

const HELP = `blazeresolver: turn customer bug reports into reviewed GitHub pull requests

  npx blazeresolver init      set up this repo (finds your frontend and backend, adds the workflow, endpoint, widget and .env)
  npx blazeresolver remove    undo init: delete what it created, clean the lines it added, uninstall the package
  npx blazeresolver app       create a GitHub App for the fix job: short-lived, one-repo tokens, and PRs that trigger your CI
  npx blazeresolver harden    set up branch protection, CODEOWNERS, safe Actions defaults and secret scanning on GitHub
  npx blazeresolver providers show which AI providers your keys were recognized as, in failover order
  blazeresolver fix           run by the workflow: fix the issue that triggered it
  blazeresolver notify        run by the workflow: tell customers a merged fix shipped

init options:   --repo owner/name  --branch main  --backend <folder>  --frontend <folder>
                --install "<cmd>"  --test "<cmd>"  --build "<cmd>"  --yes (accept what was detected)  --force  --no-install
                --no-sandbox (run tests with network instead of offline in a container)  --sandbox-image <image>
                --pin <version> (lock the workflow and widget instead of @latest)  --app (use a GitHub App token)
harden options: --owner @you  --strict (no admin bypass)  --dry-run  --yes
remove options: --yes (no confirmation)  --no-uninstall`;

const [command, ...rest] = process.argv.slice(2);
const interactive = !!process.stdin.isTTY && !!process.stdout.isTTY;

async function prompt(question: string, fallback?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(fallback === undefined ? `${question} ` : `${question} [${fallback}] `)).trim() || fallback || '';
  } finally {
    rl.close();
  }
}

const config = (): ProjectConfig => JSON.parse(readFileSync(`${repoRoot(process.cwd())}/blazeresolver.config.json`, 'utf8'));

try {
  if (command === 'init') {
    const { values } = parseArgs({
      args: rest,
      options: {
        repo: { type: 'string' }, branch: { type: 'string' }, test: { type: 'string' }, build: { type: 'string' },
        backend: { type: 'string' }, frontend: { type: 'string' },
        install: { type: 'string' }, 'sandbox-image': { type: 'string' }, pin: { type: 'string' },
        'no-sandbox': { type: 'boolean' }, app: { type: 'boolean' },
        yes: { type: 'boolean', short: 'y' }, force: { type: 'boolean' }, 'no-install': { type: 'boolean' }
      }
    });
    const { yes, 'no-install': noInstall, 'no-sandbox': noSandbox, 'sandbox-image': sandboxImage, app, ...flags } = values;
    await runInit({
      cwd: process.cwd(),
      ...flags,
      noInstall,
      noSandbox,
      sandboxImage,
      app,
      // Ask only when someone is at the terminal and didn't already say where things are.
      ask: interactive && !yes && !(values.backend && values.frontend) ? prompt : undefined
    });
  } else if (command === 'remove') {
    const { values } = parseArgs({ args: rest, options: { yes: { type: 'boolean', short: 'y' }, 'no-uninstall': { type: 'boolean' } } });
    await runRemove({
      cwd: process.cwd(),
      yes: values.yes,
      noUninstall: values['no-uninstall'],
      confirm: interactive ? async (q) => /^y/i.test(await prompt(`${q} (y/N)`, 'n')) : undefined
    });
  } else if (command === 'app') {
    const root = repoRoot(process.cwd());
    const repo = detectRepo(root);
    if (!repo) throw new Error('Could not find a GitHub remote. Run this inside your repo.');
    await runApp({ root, repo });
  } else if (command === 'harden') {
    const { values } = parseArgs({ args: rest, options: { owner: { type: 'string' }, strict: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, yes: { type: 'boolean', short: 'y' } } });
    const root = repoRoot(process.cwd());
    const repo = detectRepo(root);
    if (!repo) throw new Error('Could not find a GitHub remote. Run this inside your repo.');
    const steps = await runHarden({ root, repo, owner: values.owner, strict: values.strict, dryRun: values['dry-run'], confirm: interactive && !values.yes ? async (q) => /^y/i.test(await prompt(`${q} (y/N)`, 'n')) : undefined });
    if (steps.some((s) => s.status === 'failed')) process.exitCode = 1;
  } else if (command === 'providers') {
    (await import('dotenv')).config({ quiet: true });
    const lines = describeProviders();
    console.log(lines.length ? lines.map((l, i) => `${i + 1}. ${l}`).join('\n') : 'No AI keys found. Put any provider key in .env as API_KEYS=...');
  } else if (command === 'fix') {
    console.log(await runFixCommand({ env: process.env, config: config() }));
  } else if (command === 'notify') {
    console.log(await runNotifyCommand({ env: process.env, repo: config().repo }));
  } else {
    console.log(HELP);
    process.exitCode = command && command !== 'help' && command !== '--help' ? 1 : 0;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
