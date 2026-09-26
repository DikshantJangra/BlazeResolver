#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { runFixCommand, type ProjectConfig } from './fix.js';
import { runInit } from './init.js';
import { runNotifyCommand } from './notify.js';

const HELP = `blazeresolver: turn customer bug reports into reviewed GitHub pull requests

  npx blazeresolver init      set up this repo (config, GitHub workflow, report handler)
  blazeresolver fix           run by the workflow: fix the issue that triggered it
  blazeresolver notify        run by the workflow: tell customers a merged fix shipped

init options: --repo owner/name  --branch main  --test "<cmd>"  --build "<cmd>"  --force  --no-install`;

const [command, ...rest] = process.argv.slice(2);
const config = (): ProjectConfig => JSON.parse(readFileSync('blazeresolver.config.json', 'utf8'));

try {
  if (command === 'init') {
    const { values } = parseArgs({
      args: rest,
      options: {
        repo: { type: 'string' },
        branch: { type: 'string' },
        test: { type: 'string' },
        build: { type: 'string' },
        force: { type: 'boolean' },
        'no-install': { type: 'boolean' }
      }
    });
    runInit({ cwd: process.cwd(), ...values, noInstall: values['no-install'] });
  } else if (command === 'fix') {
    console.log(await runFixCommand({ env: process.env, config: config() }));
  } else if (command === 'notify') {
    console.log(await runNotifyCommand({ env: process.env, repo: config().repo }));
  } else {
    console.log(HELP);
    process.exitCode = command ? 1 : 0;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
