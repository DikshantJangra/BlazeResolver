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

  it('warns when installCommand never installs a package the tests or build use', async () => {
    const installWarning = async (commands: { install: string; test: string; build: string }, files: Record<string, string>) => {
      const root = mkdtempSync(join(tmpdir(), 'blaze-doctor-'));
      for (const [file, content] of Object.entries(files)) {
        mkdirSync(join(root, file, '..'), { recursive: true });
        writeFileSync(join(root, file), content);
      }
      writeFileSync(join(root, 'blazeresolver.config.json'), JSON.stringify({
        repo: 'acme/shop', defaultBranch: 'main', installCommand: commands.install, testCommand: commands.test,
        buildCommand: commands.build, sandbox: 'docker'
      }));
      const checks = await runDoctor({ cwd: root, env: {}, run: async () => ({ ok: false, out: '' }), dockerAvailable: () => true });
      return checks.find((check) => check.name === 'install command');
    };
    const rootAndWeb = { 'package.json': '{}', 'web/package.json': '{}' };

    const warning = await installWarning({ install: '(cd web && npm ci)', test: 'npm test', build: '(cd web && npm run build)' }, rootAndWeb);
    assert.equal(warning?.status, 'warn');
    assert.match(warning!.detail, /in the repo root, which installCommand never installs/);

    assert.equal(await installWarning({ install: 'npm ci && (cd web && npm ci)', test: 'npm test', build: '(cd web && npm run build)' }, rootAndWeb), undefined);
    assert.equal(
      await installWarning({ install: 'npm ci', test: '(cd web && npm test)', build: 'true' }, { 'package.json': '{"workspaces":["web"]}', 'web/package.json': '{}' }),
      undefined,
      "a workspace root's install covers its workspaces"
    );
    assert.equal(
      await installWarning(
        { install: '(cd api && pnpm install --frozen-lockfile) && (cd web && npm ci)', test: '(cd api && pnpm test)', build: '(cd web && npm run build)' },
        { 'api/package.json': '{}', 'web/package.json': '{}' }
      ),
      undefined,
      'the shape init writes for two packages'
    );
    assert.equal(await installWarning({ install: 'CI=1 npm ci', test: 'npm test', build: 'npm run build' }, rootAndWeb), undefined);
    assert.equal(await installWarning({ install: 'cd $APP_DIR && npm ci', test: 'npm test', build: 'true' }, rootAndWeb), undefined, 'no guessing');
  });

  it('reports missing and invalid setup config as a blocking failure', async () => {
    const root = mkdtempSync(join(tmpdir(), 'blaze-doctor-'));
    writeFileSync(join(root, 'blazeresolver.config.json'), '{');
    const checks = await runDoctor({ cwd: root });
    assert.equal(checks.length, 1);
    assert.equal(checks[0].status, 'fail');
  });
});
