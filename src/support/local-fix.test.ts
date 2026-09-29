import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as cp from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { engineEnv, suspectFile } from './local-fix.js';

describe('local fix runner', () => {
  test("points the engine at the file a report's distinctive words are in, and nowhere on a vague report", () => {
    const repo = mkdtempSync(join(tmpdir(), 'blaze-suspect-'));
    const git = (...args: string[]) => cp.execFileSync('git', ['-C', repo, ...args]);
    git('init', '--quiet');
    mkdirSync(join(repo, 'web/src'), { recursive: true });
    mkdirSync(join(repo, 'web/src/tests'), { recursive: true });
    writeFileSync(join(repo, 'web/src/Header.tsx'), 'export const Logo = () => <b>Blaze<span>Reslover</span></b>; // spelled\n');
    writeFileSync(join(repo, 'web/src/tests/Header.test.tsx'), '// Reslover\n');
    writeFileSync(join(repo, 'web/src/Footer.tsx'), 'export const Footer = () => <p>Blaze<span>Resolver</span> is broken? no, it works</p>;\n');
    git('add', '-A');

    // From the app's folder, like a dev server in web/: the whole repo is searched, and paths are repo-relative.
    const cwd = join(repo, 'web');
    assert.equal(suspectFile(cp, cwd, 'The header logo is spelled wrong: it says BlazeReslover.'), 'web/src/Header.tsx');
    assert.equal(suspectFile(cp, cwd, 'The site says "Reslover" at the top.'), 'web/src/Header.tsx');
    assert.equal(suspectFile(cp, cwd, 'The page is broken and nothing works.'), undefined);
  });

  test("doesn't hand the dev server's own runtime settings to the engine", () => {
    const env = engineEnv({ PATH: '/bin', API_KEYS: 'k', NODE_ENV: 'development', NODE_OPTIONS: '--max-old-space-size=4096', TURBOPACK: '1', __NEXT_DEV_SERVER: '1', NEXT_RUNTIME: 'nodejs' });
    assert.deepEqual(env, { PATH: '/bin', API_KEYS: 'k' });
  });
});
