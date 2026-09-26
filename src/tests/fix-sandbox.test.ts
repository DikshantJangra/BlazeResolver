import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lockDownServerFiles, resolveFixSandbox } from '../jobs/fix.js';

const users: Record<string, { uid: number; gid: number }> = {
  'blaze-sandbox': { uid: 999, gid: 999 },
  root: { uid: 0, gid: 0 },
  server: { uid: 1000, gid: 1000 }
};
const lookup = (name: string) => users[name];

describe('Fix engine sandbox policy', () => {
  it('runs fixes as a dedicated unprivileged user when the server is root', () => {
    assert.deepStrictEqual(resolveFixSandbox({ BLAZE_SANDBOX_USER: 'blaze-sandbox' }, 0, lookup), {
      ok: true,
      sandbox: { uid: 999, gid: 999 }
    });
  });

  it('refuses to run fixes without a sandbox user unless explicitly allowed', () => {
    const refused = resolveFixSandbox({}, 1000, lookup);
    assert.strictEqual(refused.ok, false);
    assert.match(!refused.ok ? refused.problem : '', /BLAZE_SANDBOX_USER/);

    assert.deepStrictEqual(resolveFixSandbox({ BLAZE_ALLOW_UNSANDBOXED_FIXES: 'true' }, 1000, lookup), { ok: true });
    assert.strictEqual(resolveFixSandbox({ BLAZE_ALLOW_UNSANDBOXED_FIXES: 'yes' }, 1000, lookup).ok, false);
  });

  it('refuses sandbox users that would not isolate anything', () => {
    const problem = (env: NodeJS.ProcessEnv, serverUid: number) => {
      const result = resolveFixSandbox(env, serverUid, lookup);
      return result.ok ? undefined : result.problem;
    };
    assert.match(problem({ BLAZE_SANDBOX_USER: 'blaze-sandbox' }, 1000)!, /run as root/);
    assert.match(problem({ BLAZE_SANDBOX_USER: 'nobody-here' }, 0)!, /does not exist/);
    assert.match(problem({ BLAZE_SANDBOX_USER: 'root' }, 0)!, /dedicated unprivileged user/);
    // A configured sandbox user wins over the unsandboxed opt-in, so a mistake there can't silently drop the sandbox.
    assert.match(problem({ BLAZE_SANDBOX_USER: 'nobody-here', BLAZE_ALLOW_UNSANDBOXED_FIXES: 'true' }, 0)!, /does not exist/);
  });

  it('locks the data directories and .env against other users', () => {
    const dir = mkdtempSync(join(tmpdir(), 'blaze-lock-'));
    const cwd = process.cwd();
    try {
      process.chdir(dir);
      writeFileSync('.env', 'SECRET=1\n', { mode: 0o644 });
      lockDownServerFiles({ BLAZE_DATA_DIR: join(dir, 'data'), BLAZE_PROJECTS_FILE: join(dir, 'projects', 'projects.json') });

      const mode = (path: string) => statSync(path).mode & 0o777;
      assert.strictEqual(mode(join(dir, 'data')), 0o700);
      assert.strictEqual(mode(join(dir, 'projects')), 0o700);
      assert.strictEqual(mode(join(dir, '.env')), 0o600);
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
