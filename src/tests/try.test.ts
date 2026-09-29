import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withBusyRetry, withMalformedRetry, workingTreePatch } from '../cli/try.js';

describe('blazeresolver try', () => {
  it('carries the whole working tree into the workspace, new files too, but nothing git-ignored', () => {
    const repo = mkdtempSync(join(tmpdir(), 'blaze-try-'));
    const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
    git('init', '--quiet', '-b', 'main');
    writeFileSync(join(repo, '.gitignore'), '.env\n');
    writeFileSync(join(repo, 'a.ts'), 'export const a = 1;\n');
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '-m', 'init');

    writeFileSync(join(repo, 'a.ts'), "export { b as a } from './b.js';\n");
    writeFileSync(join(repo, 'b.ts'), 'export const b = 2;\n');
    writeFileSync(join(repo, '.env'), 'API_KEYS=secret-value\n');

    const patch = workingTreePatch(repo);
    assert.match(patch, /b\/a\.ts/);
    assert.match(patch, /b\/b\.ts/);
    assert.ok(!patch.includes('secret-value'));
    // The repo's own index is left alone: the new file is still untracked.
    assert.equal(git('status', '--porcelain', 'b.ts').trim(), '?? b.ts');
  });
});

describe('blazeresolver try model calls', () => {
  it('retries a busy provider, but not other errors', async () => {
    let calls = 0;
    const events: string[] = [];
    const busyTwice = withBusyRetry(async () => {
      if (++calls < 3) throw new Error('gemini 503');
      return 'ok';
    }, (e) => events.push(e), [1, 1, 1]);
    assert.equal(await busyTwice('s', 'u'), 'ok');
    assert.equal(calls, 3);
    assert.equal(events.length, 2);

    let badKeyCalls = 0;
    const badKey = withBusyRetry(async () => {
      badKeyCalls++;
      throw new Error('gemini 401');
    }, undefined, [1, 1, 1]);
    await assert.rejects(badKey('s', 'u'), /401/);
    assert.equal(badKeyCalls, 1);

    const alwaysBusy = withBusyRetry(async () => { throw new Error('gemini 429'); }, undefined, [1, 1]);
    await assert.rejects(alwaysBusy('s', 'u'), /429/);
  });
});

describe('blazeresolver try model replies', () => {
  it('asks again when the reply is not valid JSON, but not for other failures', async () => {
    let calls = 0;
    const flaky = {
      investigate: async () => {
        if (++calls < 3) JSON.parse("{\n    rootCause: 'x'\n}");
        return { rootCause: 'typo', confidence: 'high', suspectedFiles: ['a.ts'] } as any;
      },
      proposeFix: async () => { throw new Error('gemini 401'); }
    };
    const events: string[] = [];
    const ai = withMalformedRetry(flaky, (e) => events.push(e));
    assert.equal((await ai.investigate({} as any)).rootCause, 'typo');
    assert.equal(calls, 3);
    assert.equal(events.length, 2);
    await assert.rejects(ai.proposeFix({} as any), /401/);

    const alwaysBroken = withMalformedRetry({ investigate: async () => JSON.parse('{ bad'), proposeFix: async () => ({}) as any }, undefined, 1);
    await assert.rejects(alwaysBroken.investigate({} as any), SyntaxError);
  });
});
