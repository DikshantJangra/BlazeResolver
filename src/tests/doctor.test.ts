import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDoctor } from '../cli/doctor.js';
import type { Gh } from '../cli/app.js';

describe('doctor', () => {
  it('checks a configured install without exposing its token', async () => {
    const root = mkdtempSync(join(tmpdir(), 'blaze-doctor-'));
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(join(root, 'blazeresolver.config.json'), JSON.stringify({
      repo: 'acme/shop', defaultBranch: 'main', installCommand: 'npm ci', testCommand: 'npm test',
      buildCommand: 'npm run build', sandbox: 'docker'
    }));
    writeFileSync(join(root, '.github/workflows/blazeresolver.yml'), 'name: BlazeResolver\n');
    const run: Gh = async (args) => {
      if (args[1] === 'repos/acme/shop/rulesets') return { ok: true, out: JSON.stringify([{ id: 1, name: 'BlazeResolver: protect the default branch' }]) };
      if (args[1] === 'repos/acme/shop/rulesets/1') return { ok: true, out: JSON.stringify({ rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 1, require_code_owner_review: true } }] }) };
      if (args[0] === 'secret') return { ok: true, out: 'NAME UPDATED\nAPI_KEYS yesterday\n' };
      return { ok: true, out: '{}' };
    };
    const checks = await runDoctor({
      cwd: root,
      env: { BLAZE_GITHUB_TOKEN: 'never-print-me', ANTHROPIC_API_KEY: 'sk-ant-test' },
      fetch: (async () => new Response('{}', { status: 200 })) as typeof fetch,
      run,
      dockerAvailable: () => true
    });
    assert.equal(checks.some((check) => check.status === 'fail'), false);
    assert.match(checks.find((check) => check.name === 'branch protection')!.detail, /review required/);
    assert.ok(!JSON.stringify(checks).includes('never-print-me'));
  });

  it('reports missing and invalid setup config as a blocking failure', async () => {
    const root = mkdtempSync(join(tmpdir(), 'blaze-doctor-'));
    writeFileSync(join(root, 'blazeresolver.config.json'), '{');
    const checks = await runDoctor({ cwd: root });
    assert.equal(checks.length, 1);
    assert.equal(checks[0].status, 'fail');
  });
});
