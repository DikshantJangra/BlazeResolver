#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { repoRoot } from './detect.js';
import { runFixCommand, type ProjectConfig } from './fix.js';
import { runInit } from './init.js';
import { runNotifyCommand } from './notify.js';
import { runRemove } from './remove.js';
import { describeProviders } from '../triage/providers.js';

const HELP = `blazeresolver: turn customer bug reports into reviewed GitHub pull requests

  npx blazeresolver init      set up this repo (finds your frontend and backend, adds the workflow, endpoint, widget and .env)
  npx blazeresolver remove    undo init: delete what it created, clean the lines it added, uninstall the package
  npx blazeresolver providers show which AI providers your keys were recognized as, in failover order
  blazeresolver fix           run by the workflow: fix the issue that triggered it
  blazeresolver notify        run by the workflow: tell customers a merged fix shipped

init options:   --repo owner/name  --branch main  --backend <folder>  --frontend <folder>
                --test "<cmd>"  --build "<cmd>"  --yes (accept what was detected)  --force  --no-install
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
        yes: { type: 'boolean', short: 'y' }, force: { type: 'boolean' }, 'no-install': { type: 'boolean' }
      }
    });
    const { yes, 'no-install': noInstall, ...flags } = values;
    await runInit({
      cwd: process.cwd(),
      ...flags,
      noInstall,
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
