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
import { resolveEmbedder } from '../answer/embed.js';
import { engineVersion } from '../version.js';

const HELP = `blazeresolver: turn customer bug reports into reviewed GitHub pull requests

Usage: npx blazeresolver@latest <command> [options]

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
remove options: --yes (no confirmation)  --no-uninstall

Help for one command: blazeresolver <command> --help     Version: blazeresolver --version
Docs: https://github.com/DikshantJangra/BlazeResolver#readme`;

/** `blazeresolver <command> --help`. Checked before a command runs, so asking for help never changes anything. */
const COMMAND_HELP: Record<string, string> = {
  init: `blazeresolver init: set up BlazeResolver in this repo

Usage: npx blazeresolver@latest init [options]

Finds your frontend and backend by their dependencies, then adds the fix workflow, the report endpoint (/api/blaze),
the widget tag, blazeresolver.config.json and .env, and installs the package (npm, pnpm or yarn). Records every change,
so \`remove\` can undo exactly that. Run it from anywhere inside the repo.

Options:
  --backend <folder>       the package that serves the endpoint (skips detection)
  --frontend <folder>      the package whose page gets the widget
  --yes, -y                accept what was detected, no questions
  --repo owner/name        the GitHub repo (default: the origin remote)
  --branch <name>          branch fixes start from (default: the current branch)
  --install "<cmd>"        install command, run with network before offline tests
  --test "<cmd>"           test command a fix must pass
  --build "<cmd>"          build command run after the tests
  --no-sandbox             run tests with network instead of offline in a container
  --sandbox-image <image>  container image for offline tests (default: node:<major>-bookworm-slim)
  --pin <version>          lock the workflow and widget to one release instead of @latest
  --app                    write the workflow for a GitHub App token (then run \`blazeresolver app\`)
  --no-install             don't install the package
  --force                  overwrite files that already exist, or re-run over an existing install`,
  remove: `blazeresolver remove: undo init

Usage: npx blazeresolver remove [options]

Deletes the files init created (a file you have rewritten since is kept), removes the lines it added, uninstalls
the package and deletes the config. Values you typed into .env are never deleted.

Options:
  --yes, -y        don't ask for confirmation
  --no-uninstall   leave the package installed`,
  app: `blazeresolver app: create a GitHub App for the fix job

Usage: npx blazeresolver app

Creates and installs a GitHub App on this repo in your browser, then stores its id and private key as repo secrets
(needs the GitHub CLI, gh, logged in). The fix job then writes with short-lived, one-repo tokens, and the pull
requests it opens trigger your CI. Takes no options.`,
  harden: `blazeresolver harden: protect the repo on GitHub

Usage: npx blazeresolver harden [options]

Adds a branch ruleset (pull request plus one approval, no force pushes or deletion), a CODEOWNERS block for sensitive
paths, read-only Actions defaults and secret scanning. Asks before each change unless --yes.

Options:
  --owner @you   code owner for the sensitive paths (default: you)
  --strict       no admin bypass of the ruleset
  --dry-run      show what would change, change nothing
  --yes, -y      don't ask for confirmation`,
  providers: `blazeresolver providers: show the AI keys that were recognized

Usage: npx blazeresolver providers

Reads .env and the environment, and lists each recognized provider in failover order, keys masked. Takes no options.`,
  fix: `blazeresolver fix: run by the workflow, not by hand

Usage: blazeresolver fix

Fixes the issue that triggered the workflow and opens a pull request. Needs GITHUB_TOKEN and GITHUB_EVENT_PATH,
which GitHub Actions provides, and blazeresolver.config.json at the repo root. Takes no options.`,
  notify: `blazeresolver notify: run by the workflow, not by hand

Usage: blazeresolver notify

When a BlazeResolver pull request merges, emails the customers who asked to be told (needs RESEND_API_KEY and
BLAZE_FROM_EMAIL). Takes no options.`
};

const wantsHelp = (args: string[]) => args.includes('--help') || args.includes('-h');

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
  if (command === '--version' || command === '-v' || command === 'version') {
    console.log(engineVersion());
  } else if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    // `blazeresolver help init` works like `blazeresolver init --help`.
    console.log((command === 'help' && rest[0] && COMMAND_HELP[rest[0]]) || HELP);
  } else if (COMMAND_HELP[command] && wantsHelp(rest)) {
    console.log(COMMAND_HELP[command]);
  } else if (command === 'init') {
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
    const embedder = resolveEmbedder();
    console.log(`\nHelp-doc search: ${embedder ? `keywords + semantic (${embedder.id})` : 'keywords only. For semantic search too, add a key for a provider with embeddings (OpenAI, Voyage, Gemini, Mistral, Cohere) or set BLAZE_EMBED_BASE_URL.'}`);
  } else if (command === 'fix') {
    console.log(await runFixCommand({ env: process.env, config: config() }));
  } else if (command === 'notify') {
    console.log(await runNotifyCommand({ env: process.env, repo: config().repo }));
  } else {
    console.error(`Unknown command: ${command}\n`);
    console.log(HELP);
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
