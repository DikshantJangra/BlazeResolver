import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitWorkspace, type SandboxUser } from '../codebase/git-workspace.js';

/**
 * The real isolation: code under test runs as a different, unprivileged user and cannot reach the server's secrets.
 * Needs Linux and root (as in the Docker image). Set BLAZE_TEST_SANDBOX_USER to the user to run as (default: nobody).
 */
const name = process.env.BLAZE_TEST_SANDBOX_USER || 'nobody';
const canRun = process.platform === 'linux' && process.getuid?.() === 0;

function lookup(user: string): SandboxUser {
  const id = (flag: string) => Number(execFileSync('id', [flag, user]).toString().trim());
  return { uid: id('-u'), gid: id('-g') };
}

function processesOf(uid: number): number[] {
  return readdirSync('/proc')
    .filter((entry) => /^\d+$/.test(entry))
    .filter((pid) => {
      try {
        return readFileSync(`/proc/${pid}/status`, 'utf8').match(/^Uid:\s+(\d+)/m)?.[1] === String(uid);
      } catch {
        return false;
      }
    })
    .map(Number);
}

describe('Sandbox isolation (Linux, root)', { skip: !canRun && 'needs Linux and root, as in the Docker image' }, () => {
  let root: string;
  let secretFile: string;
  let sandbox: SandboxUser;

  before(() => {
    sandbox = lookup(name);
    root = mkdtempSync(join(tmpdir(), 'blaze-isolation-'));
    // Stands in for /data: root-only, like the server's customer reports.
    const data = join(root, 'data');
    mkdirSync(data);
    chmodSync(data, 0o700);
    secretFile = join(data, 'reports.json');
    writeFileSync(secretFile, 'customer data');

    const repo = join(root, 'repo');
    mkdirSync(repo);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
    writeFileSync(join(repo, 'a.txt'), 'a\n');
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init'], { cwd: repo });
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it("runs as the sandbox user, can't read the server's environment or files, and leaves no processes behind", async () => {
    // Root, the server here, can read its own environment: the control for the check below.
    assert.ok(readFileSync(`/proc/${process.pid}/environ`).length > 0);

    const workspaces = new GitWorkspace({
      repo: join(root, 'repo'),
      workspacesDir: join(root, 'workspaces'),
      sandbox,
      env: { PATH: process.env.PATH },
      testCommand: [
        'echo "UID=$(id -u)"',
        `cat /proc/${process.pid}/environ >/dev/null 2>&1 && echo SERVER_ENV_READABLE`,
        `cat ${secretFile} >/dev/null 2>&1 && echo SERVER_FILE_READABLE`,
        '(sleep 300 >/dev/null 2>&1 &)',
        'exit 0'
      ].join('; '),
      buildCommand: 'true'
    });
    const ws = await workspaces.createWorkspace();
    const result = await workspaces.runTests(ws);

    assert.match(result.output, new RegExp(`UID=${sandbox.uid}\\b`));
    assert.doesNotMatch(result.output, /SERVER_ENV_READABLE/);
    assert.doesNotMatch(result.output, /SERVER_FILE_READABLE/);
    assert.deepStrictEqual(processesOf(sandbox.uid), [], 'the background sleep was killed');
    await workspaces.dispose();
  });
});
