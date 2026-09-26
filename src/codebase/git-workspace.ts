import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve, isAbsolute, posix } from 'node:path';
import type { BuildResult, CommitResult, TestResult, Workspace, WorkspaceInterface } from './contracts.js';

export interface GitWorkspaceOptions {
  /** Repository to clone: a local path or a remote URL. */
  repo: string;
  /** Branch, tag or commit each workspace starts from. Defaults to the clone's checked-out HEAD. */
  baseRef?: string;
  /** Shell command that runs the project's tests inside a workspace. */
  testCommand: string;
  /** Shell command that builds the project inside a workspace. */
  buildCommand: string;
  /** Directory that holds one clone per workspace. */
  workspacesDir?: string;
  /** Prefix for the branch created in each workspace; the workspace id is appended. */
  branchPrefix?: string;
  /** Timeout for each test or build run. */
  commandTimeoutMs?: number;
  /** Committer identity, so commits don't depend on the host's git config. */
  author?: { name: string; email: string };
}

export class GitWorkspaceError extends Error {
  constructor(
    public readonly operation: string,
    message: string
  ) {
    super(`workspace ${operation}: ${message}`);
    this.name = 'GitWorkspaceError';
  }
}

/** Test and build output is kept to its tail; failures are reported at the end. */
const OUTPUT_TAIL_BYTES = 64 * 1024;

const DEFAULT_AUTHOR = { name: 'BlazeResolver', email: 'blazeresolver@users.noreply.github.com' };

/**
 * Gives each fix its own clone of the repository on a fresh branch.
 *
 * Patches are applied to both the working tree and the index, so the index is the exact record of what
 * the fix changed: `gitDiff` and `commit` use it, and files that tests or builds write are left out.
 */
export class GitWorkspace implements WorkspaceInterface {
  private readonly workspacesDir: string;

  constructor(private options: GitWorkspaceOptions) {
    this.workspacesDir = resolve(options.workspacesDir ?? join(tmpdir(), 'blazeresolver-workspaces'));
  }

  public async createWorkspace(): Promise<Workspace> {
    const id = randomUUID().slice(0, 8);
    const path = join(this.workspacesDir, id);
    const branch = `${this.options.branchPrefix ?? 'blazeresolver/fix-'}${id}`;

    await mkdir(this.workspacesDir, { recursive: true });
    await git('create', this.workspacesDir, ['clone', '--quiet', this.options.repo, path]);

    const base = this.options.baseRef ? await resolveBaseRef(path, this.options.baseRef) : 'HEAD';
    await git('create', path, ['checkout', '--quiet', '-b', branch, base]);

    return { id, path, branch };
  }

  /** Reads from the index, which holds exactly the base plus applied patches, not files that tests or builds wrote. */
  public async readFile(workspace: Workspace, file: string): Promise<string | null> {
    const path = this.ownedPath(workspace);
    const normalized = posix.normalize(file.replace(/\\/g, '/'));
    if (!normalized || normalized === '.' || posix.isAbsolute(normalized) || normalized.startsWith('../')) {
      throw new GitWorkspaceError('readFile', `${file} is not a path inside the workspace`);
    }
    try {
      await git('readFile', path, ['cat-file', '-e', `:${normalized}`]);
    } catch {
      return null;
    }
    return git('readFile', path, ['cat-file', 'blob', `:${normalized}`]);
  }

  public async applyPatch(workspace: Workspace, patch: string): Promise<void> {
    const path = this.ownedPath(workspace);
    if (!patch.trim()) {
      throw new GitWorkspaceError('applyPatch', 'patch is empty');
    }
    // git apply is all-or-nothing: if any hunk fails, no file is changed.
    await git('applyPatch', path, ['apply', '--index', '--whitespace=nowarn', '-'], patch);
  }

  public async gitDiff(workspace: Workspace): Promise<string> {
    return git('gitDiff', this.ownedPath(workspace), ['diff', '--cached', '--no-color']);
  }

  public async runTests(workspace: Workspace): Promise<TestResult> {
    return this.runCommand(this.ownedPath(workspace), this.options.testCommand);
  }

  public async runBuild(workspace: Workspace): Promise<BuildResult> {
    return this.runCommand(this.ownedPath(workspace), this.options.buildCommand);
  }

  public async commit(workspace: Workspace, message: string): Promise<CommitResult> {
    const path = this.ownedPath(workspace);
    if (!message.trim()) {
      throw new GitWorkspaceError('commit', 'commit message is empty');
    }
    const staged = await git('commit', path, ['diff', '--cached', '--name-only']);
    if (!staged.trim()) {
      throw new GitWorkspaceError('commit', 'no patch has been applied, nothing to commit');
    }

    const author = this.options.author ?? DEFAULT_AUTHOR;
    await git('commit', path, [
      '-c', `user.name=${author.name}`,
      '-c', `user.email=${author.email}`,
      'commit', '--quiet', '--no-verify', '-m', message
    ]);
    const hash = (await git('commit', path, ['rev-parse', 'HEAD'])).trim();
    return { hash, message };
  }

  /** Rejects workspaces this instance didn't create, so a caller can't point git at an arbitrary directory. */
  private ownedPath(workspace: Workspace): string {
    const path = resolve(workspace.path);
    const rel = relative(this.workspacesDir, path);
    if (!rel || rel !== workspace.id || rel.startsWith('..') || isAbsolute(rel)) {
      throw new GitWorkspaceError('access', `${workspace.path} is not a workspace under ${this.workspacesDir}`);
    }
    return path;
  }

  private runCommand(cwd: string, command: string): Promise<TestResult> {
    const timeoutMs = this.options.commandTimeoutMs ?? 15 * 60 * 1000;
    return new Promise((resolvePromise) => {
      // Inherited from a node --test parent, NODE_TEST_CONTEXT makes the project's own `node --test`
      // report to that parent and exit 0 even when its tests fail.
      const { NODE_TEST_CONTEXT, ...env } = process.env;
      const child = spawn(command, { cwd, shell: true, env });
      let output = '';
      const append = (chunk: Buffer) => {
        output = (output + chunk.toString('utf-8')).slice(-OUTPUT_TAIL_BYTES);
      };
      child.stdout.on('data', append);
      child.stderr.on('data', append);

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.on('error', (err) => {
        clearTimeout(timer);
        resolvePromise({ success: false, output: `${output}\nFailed to start "${command}": ${err.message}` });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          resolvePromise({ success: false, output: `${output}\n"${command}" timed out after ${timeoutMs}ms` });
        } else {
          resolvePromise({ success: code === 0, output });
        }
      });
    });
  }
}

/** Accepts a local ref, commit or tag, falling back to the remote-tracking branch of the same name. */
async function resolveBaseRef(path: string, ref: string): Promise<string> {
  for (const candidate of [ref, `origin/${ref}`]) {
    try {
      return (await git('create', path, ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`])).trim();
    } catch {
      // try the next candidate
    }
  }
  throw new GitWorkspaceError('create', `base ref "${ref}" not found in ${path}`);
}

function git(operation: string, cwd: string, args: string[], stdin?: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = execFile(
      'git',
      args,
      // Never block on a credential prompt; fail instead.
      { cwd, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (err, stdout, stderr) => {
        if (err) {
          reject(new GitWorkspaceError(operation, stderr.trim() || err.message));
        } else {
          resolvePromise(stdout);
        }
      }
    );
    if (stdin !== undefined) {
      child.stdin?.end(stdin);
    }
  });
}
