#!/usr/bin/env node
/**
 * Registers the current project with a BlazeResolver server and prints the widget snippet.
 *   npx blazeresolver init
 * Repo and branch come from git; server from BLAZE_SERVER (default http://localhost:3001); token (only for closed servers) from BLAZE_ADMIN_TOKEN.
 * Any of them can be overridden: --server --repo --branch --admin-token --test --build.
 * Writes blazeresolver.config.json (commit it) and appends BLAZE_KEY to .env (do not commit it).
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  allowPositionals: true, // the word "init"
  options: {
    server: { type: 'string' },
    repo: { type: 'string' },
    branch: { type: 'string' },
    test: { type: 'string', default: 'npm ci && npm test' },
    build: { type: 'string', default: 'npm run build --if-present' },
    'admin-token': { type: 'string', default: process.env.BLAZE_ADMIN_TOKEN }
  }
});

// ponytail: set to the hosted URL once deployed, so `npx blazeresolver init` needs no configuration.
const DEFAULT_SERVER = 'http://localhost:3001';

const git = (...args: string[]) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
// git@github.com:owner/name.git and https://github.com/owner/name(.git) both end in owner/name
const repo = values.repo ?? git('remote', 'get-url', 'origin').match(/([\w.-]+\/[\w.-]+?)(?:\.git)?$/)?.[1];
const branch = values.branch ?? (git('symbolic-ref', '--short', 'HEAD') || 'main');
const server = (values.server ?? process.env.BLAZE_SERVER ?? DEFAULT_SERVER).replace(/\/$/, '');

if (!repo) {
  console.error('Could not find a git remote. Run inside your repo, or pass --repo owner/name.');
  process.exit(1);
}

const res = await fetch(`${server}/api/projects`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(values['admin-token'] && { authorization: `Bearer ${values['admin-token']}` }) },
  body: JSON.stringify({ repo, defaultBranch: branch, testCommand: values.test, buildCommand: values.build })
}).catch(() => {
  console.error(`Could not reach ${server}. Set BLAZE_SERVER or pass --server <url>.`);
  process.exit(1);
});
if (!res.ok) {
  console.error(`registration failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const { project, key } = (await res.json()) as { project: { id: string }; key: string };

writeFileSync('blazeresolver.config.json', JSON.stringify({ server, projectId: project.id, repo, defaultBranch: branch }, null, 2) + '\n');
appendFileSync('.env', `\nBLAZE_KEY=${key}\n`);

console.log(`Registered ${repo} as ${project.id}. Paste this before </body> in your app:\n`);
console.log(`<script src="${server}/widget.js" data-key="${key}" data-app-version="YOUR_VERSION"></script>\n`);
console.log('Custom UI instead? POST {message, pageUrl, appVersion, userId, consoleErrors} to /api/report with header x-blaze-key.');
