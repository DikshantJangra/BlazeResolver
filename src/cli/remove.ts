import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { detectPm, findPackages, repoRoot } from './detect.js';
import { stripManaged } from './edit.js';
import { gh, type Gh } from './app.js';
import { CONFIG_FILE, uninstallArgs, type Manifest } from './init.js';

export interface RemoveOptions {
  cwd: string;
  /** Skip the confirmation. */
  yes?: boolean;
  /** Leave the blazeresolver package in package.json. */
  noUninstall?: boolean;
  log?: (line: string) => void;
  /** Asked before anything is deleted. Omit to go ahead (scripts, tests). */
  confirm?: (question: string) => Promise<boolean>;
  /** Runs the GitHub CLI, to delete the repo secrets `blazeresolver app` created. */
  run?: Gh;
}

export interface RemoveResult {
  cancelled?: boolean;
  removed: string[];
  stripped: string[];
  /** Files init created that were changed by hand since, so they were left alone. */
  kept: string[];
  /** Repo secrets deleted (the ones `blazeresolver app` set). */
  secretsDeleted?: string[];
  /** .env handling: what happened to the variables init added. */
  env?: 'deleted' | 'cleaned' | 'kept';
  uninstalled: boolean;
}

/** What an older `init` (no manifest) is known to have written: the workflow, a Next route, and the dependency. */
function legacyManifest(root: string): Manifest {
  const manifest: Manifest = { files: [], edits: [] };
  const workflow = '.github/workflows/blazeresolver.yml';
  if (existsSync(join(root, workflow))) manifest.files.push(workflow);
  const packages = findPackages(root);
  for (const pkg of packages) {
    for (const base of ['src/app', 'app']) for (const ext of ['ts', 'js']) {
      const rel = posix.join(pkg.dir, base, 'api/blaze/route.' + ext);
      if (existsSync(join(root, rel))) manifest.files.push(rel);
    }
    for (const base of ['src/pages', 'pages']) for (const ext of ['ts', 'js']) {
      const rel = posix.join(pkg.dir, base, 'api/blaze.' + ext);
      if (existsSync(join(root, rel))) manifest.files.push(rel);
    }
  }
  const holder = packages.find((p) => p.deps.has('blazeresolver'));
  if (holder) manifest.dependency = { dir: holder.dir, pm: detectPm(root, holder).pm };
  return manifest;
}

/**
 * Undoes `init`: deletes the files it created, takes its marked lines back out of files it edited, and uninstalls the
 * package. It only touches what the manifest in blazeresolver.config.json lists, so your own code is never removed.
 */
const CACHE_DIR = '.blazeresolver';
/** Everything BlazeResolver keeps in CACHE_DIR: the SQLite vector store, its WAL files, and the .gitignore for them. */
const CACHE_FILES = /^(vectors\.db(-wal|-shm|-journal)?|\.gitignore)$/;

/** Whether CACHE_DIR exists and holds only what BlazeResolver put there, so it can go without losing anything of yours. */
function ownCache(root: string): boolean {
  const dir = join(root, CACHE_DIR);
  if (!existsSync(dir)) return false;
  const entries = readdirSync(dir);
  return entries.length > 0 && entries.every((f) => CACHE_FILES.test(f));
}

export async function runRemove(opts: RemoveOptions): Promise<RemoveResult> {
  const log = opts.log ?? console.log;
  const root = repoRoot(opts.cwd);
  const configPath = join(root, CONFIG_FILE);
  if (!existsSync(configPath)) throw new Error(`BlazeResolver is not set up here: there is no ${CONFIG_FILE} in ${root}.`);

  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { installed?: Manifest };
  const manifest = config.installed ?? legacyManifest(root);
  const files = manifest.files.filter((f) => f !== CONFIG_FILE);

  if (!opts.yes && opts.confirm) {
    const what = [...files, ...(manifest.appended ?? []).map((a) => `${a.file} (only the block init added)`), ...(manifest.secrets ?? []).map((n) => `repo secret ${n}`), ...(manifest.env ? [`${manifest.env.file} (only the variables init added)`] : []), ...manifest.edits.map((f) => `${f} (marked lines only)`), ...(manifest.dependency && !opts.noUninstall ? ['the blazeresolver package'] : []), ...(ownCache(root) ? [`${CACHE_DIR}/ (the docs' vector store)`] : []), CONFIG_FILE];
    if (!(await opts.confirm(`Remove BlazeResolver? This deletes:\n  ${what.join('\n  ')}\nContinue?`))) {
      log('Cancelled. Nothing was changed.');
      return { cancelled: true, removed: [], stripped: [], kept: [], uninstalled: false };
    }
  }

  const result: RemoveResult = { removed: [], stripped: [], kept: [], uninstalled: false };

  for (const rel of files) {
    const path = join(root, rel);
    if (!existsSync(path)) continue;
    // Something init wrote always mentions BlazeResolver; a file that no longer does was replaced by you.
    if (!/blazeresolver/i.test(readFileSync(path, 'utf8'))) {
      result.kept.push(rel);
      log(`  kept     ${rel} (it no longer looks like the file init wrote)`);
      continue;
    }
    rmSync(path);
    result.removed.push(rel);
    log(`  removed  ${rel}`);
    // Take the folders init created with it, but never a folder that still holds something.
    for (let dir = dirname(path); dir !== root && dir.startsWith(root); dir = dirname(dir)) {
      if (readdirSync(dir).length) break;
      rmdirSync(dir);
    }
  }

  // The vector store the handlers created at runtime: only a cache of the docs' embeddings.
  if (ownCache(root)) {
    rmSync(join(root, CACHE_DIR), { recursive: true, force: true });
    result.removed.push(`${CACHE_DIR}/`);
    log(`  removed  ${CACHE_DIR}/ (the docs' vector store)`);
  }

  for (const rel of manifest.edits) {
    const path = join(root, rel);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    const stripped = stripManaged(text);
    if (stripped !== text) {
      writeFileSync(path, stripped);
      result.stripped.push(rel);
      log(`  cleaned  ${rel}`);
    }
  }

  // .env: take back exactly the text init added. If you have filled in a value since, leave the file and say so.
  if (manifest.env) {
    const { file, created, added } = manifest.env;
    const path = join(root, file);
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8');
      if (created && text === added) {
        rmSync(path);
        result.env = 'deleted';
        log(`  removed  ${file}`);
      } else if (text.includes(added)) {
        writeFileSync(path, text.replace(added, ''));
        result.env = 'cleaned';
        log(`  cleaned  ${file}`);
      } else {
        result.env = 'kept';
        log(`  kept     ${file} (you have edited the variables init added; delete API_KEYS and BLAZE_GITHUB_TOKEN by hand if you no longer need them)`);
      }
    }
  }

  // Text appended to other files (CODEOWNERS): exactly that text, or the whole file if init created it.
  for (const { file, created, added } of manifest.appended ?? []) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    if (created && text === added) {
      rmSync(path);
      log(`  removed  ${file}`);
      for (let dir = dirname(path); dir !== root && dir.startsWith(root); dir = dirname(dir)) {
        if (readdirSync(dir).length) break;
        rmdirSync(dir);
      }
    } else if (text.includes(added)) {
      writeFileSync(path, text.replace(added, ''));
      log(`  cleaned  ${file}`);
    } else {
      log(`  kept     ${file} (it has changed since; delete the BlazeResolver block by hand)`);
    }
  }

  const dep = manifest.dependency;
  if (dep && !opts.noUninstall) {
    const [cmd, args, cwd] = uninstallArgs(dep.pm, dep.dir, dep.workspace, root);
    log(`  running  ${cmd} ${args.join(' ')}`);
    try {
      execFileSync(cmd, args, { cwd, stdio: 'ignore' });
      result.uninstalled = true;
    } catch {
      log(`  could not uninstall automatically; run \`${cmd} ${args.join(' ')}\` in ${dep.dir || 'the repo root'}`);
    }
  }

  // Repo secrets that `blazeresolver app` stored. They only make sense with BlazeResolver, so they go with it.
  if (manifest.secrets?.length) {
    const repo = (config as { repo?: string }).repo;
    const run = opts.run ?? gh;
    result.secretsDeleted = [];
    for (const name of manifest.secrets) {
      if (repo && (await run(['secret', 'delete', name, '--repo', repo])).ok) {
        result.secretsDeleted.push(name);
        log(`  deleted  repo secret ${name}`);
      } else {
        log(`  could not delete repo secret ${name}; remove it in Settings, Secrets and variables, Actions`);
      }
    }
  }

  rmSync(configPath);
  log(`  removed  ${CONFIG_FILE}`);
  log('\nBlazeResolver is removed from this repo. On GitHub you may also want to delete:');
  log('  - the repo secrets API_KEYS (or ANTHROPIC_API_KEY) and BLAZE_GITHUB_TOKEN, and BLAZE_GITHUB_TOKEN from your backend host');
  log('  - the fine-grained token you created for it');
  if (manifest.secrets?.length) log('  - the GitHub App itself (GitHub, Settings, Developer settings, GitHub Apps): uninstall it and delete it');
  log('  - the branch ruleset "BlazeResolver: protect the default branch", if `blazeresolver harden` created it (left in place: it protects your branch)');
  log('  - issues labeled "blazeresolver" and branches named blazeresolver/fix-* (left alone)');
  return result;
}
