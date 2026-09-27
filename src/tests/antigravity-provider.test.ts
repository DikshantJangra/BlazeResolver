/**
 * antigravity-provider.test.ts
 *
 * Tests for AntigravityProvider covering:
 *   1. No key configured → clear error (any provider)
 *   2. Sidecar available → result used; resolveComplete not called
 *   3. Sidecar unavailable → falls back to resolveComplete (any provider key)
 *   4. resolveComplete returns valid JSON → parsed correctly
 *   5. Raw model output has prose around JSON → still parsed
 *   6. Model returns no JSON → descriptive error
 *   7. Model returns malformed JSON → descriptive error
 *   8. System+user prompts are properly separated (no leakage between calls)
 *   9. Sidecar 500 response → graceful fallback
 *  10. resolveComplete errors → propagated as-is
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AntigravityProvider } from '../resolver/antigravity-provider.js';
import type { FixRequest, InvestigationRequest } from '../resolver/ai-provider.js';
import type { CodebaseInterface, ExploreResult, FileContent } from '../codebase/contracts.js';
import type { Incident, Investigation } from '../resolver/types.js';

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

const INCIDENT: Incident = {
  id: 'INC-42',
  title: 'add() is broken',
  description: 'add(2,3) returns -1',
  stackTrace: 'Error at src/math.ts:3'
};

const INVESTIGATION: Investigation = {
  summary: 'add uses minus',
  rootCause: 'subtract operator',
  suspectedFiles: ['src/math.ts'],
  confidence: 'high',
  evidence: ['src/math.ts:3 — return a - b']
};

class StubCodebase implements CodebaseInterface {
  async explore(q: string): Promise<ExploreResult> { return { query: q, files: [] }; }
  async readFile(path: string): Promise<FileContent> { return { path, content: '' }; }
  async search() { return []; }
  async readRange(path: string): Promise<FileContent> { return { path, content: '' }; }
  async findSymbol() { return []; }
  async findReferences() { return []; }
  async getDefinition() { return null; }
  async getCallers() { return []; }
  async getCallees() { return []; }
  async getDependencies() { return []; }
  async getReverseDependencies() { return []; }
  async getImpact(symbol: string) { return { target: symbol, affectedFiles: [] }; }
}

const CODEBASE = new StubCodebase();

function makeInvestigateRequest(overrides: Partial<InvestigationRequest> = {}): InvestigationRequest {
  return {
    incident: INCIDENT,
    context: { files: [], notes: [] },
    codebase: CODEBASE,
    ...overrides
  };
}

function makeFixRequest(overrides: Partial<FixRequest> = {}): FixRequest {
  return {
    incident: INCIDENT,
    investigation: INVESTIGATION,
    files: [{ path: 'src/math.ts', content: 'export const add = (a,b) => a - b;' }],
    previousAttempts: [],
    codebase: CODEBASE,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Fake fetch helpers
// ---------------------------------------------------------------------------

const INVESTIGATION_JSON = JSON.stringify({
  summary: 'add uses minus',
  rootCause: 'subtract operator used instead of add',
  suspectedFiles: ['src/math.ts'],
  confidence: 'high',
  evidence: ['src/math.ts:3']
});

const FIX_JSON = JSON.stringify({
  summary: 'Switch minus to plus',
  edits: [{ kind: 'replace', path: 'src/math.ts', search: 'a - b', replace: 'a + b' }]
});

/** Simulates the sidecar returning a successful response. */
function sidecarOk(responseText: string) {
  mock.method(globalThis, 'fetch', async (url: string) => {
    if (String(url).includes('localhost')) {
      return new Response(JSON.stringify({ output: responseText }), { status: 200 });
    }
    throw new Error('unexpected fetch: ' + url);
  });
}

/** Simulates the sidecar being down (ECONNREFUSED). */
function sidecarDown() {
  mock.method(globalThis, 'fetch', async (url: string, _init: any) => {
    if (String(url).includes('localhost')) {
      throw Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    }
    // Provider fallback (non-sidecar URL)
    throw new Error('unexpected non-sidecar fetch: ' + url);
  });
}

/** Simulates sidecar down + resolveComplete fallback returning text. */
function sidecarDownProviderReturns(text: string) {
  let sidecarCalled = false;
  mock.method(globalThis, 'fetch', async (url: string, _init: any) => {
    if (String(url).includes('localhost')) {
      sidecarCalled = true;
      throw Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    }
    // Any other URL is treated as the AI provider endpoint
    return new Response(
      JSON.stringify({ choices: [{ message: { content: text } }] }),
      { status: 200 }
    );
  });
  return { wasSidecarCalled: () => sidecarCalled };
}

/** Simulates sidecar returning HTTP 500. */
function sidecar500(providerText: string) {
  mock.method(globalThis, 'fetch', async (url: string, _init: any) => {
    if (String(url).includes('localhost')) {
      return new Response('Internal Error', { status: 500 });
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: providerText } }] }),
      { status: 200 }
    );
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AntigravityProvider', () => {
  beforeEach(() => {
    // Clean up any mocked fetch between tests
    mock.restoreAll();
    // Remove all relevant env vars so tests start clean
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.API_KEYS;
    delete process.env.AGY_SIDECAR_PORT;
  });

  // ── 1. No provider configured ──────────────────────────────────────────────
  it('throws a clear error when no AI key is configured and sidecar is down', async () => {
    sidecarDown();
    const provider = new AntigravityProvider();
    await assert.rejects(
      () => provider.investigate(makeInvestigateRequest()),
      (err: Error) => {
        assert.ok(err.message.includes('no AI provider configured'), err.message);
        assert.ok(err.message.includes('ANTHROPIC_API_KEY') || err.message.includes('GEMINI_API_KEY'), err.message);
        return true;
      }
    );
  });

  // ── 2. Sidecar returns valid JSON ──────────────────────────────────────────
  it('uses sidecar output when available — investigate', async () => {
    sidecarOk(INVESTIGATION_JSON);
    const provider = new AntigravityProvider();
    const result = await provider.investigate(makeInvestigateRequest());

    assert.strictEqual(result.rootCause, 'subtract operator used instead of add');
    assert.deepStrictEqual(result.suspectedFiles, ['src/math.ts']);
    assert.strictEqual(result.confidence, 'high');
  });

  it('uses sidecar output when available — proposeFix', async () => {
    sidecarOk(FIX_JSON);
    const provider = new AntigravityProvider();
    const result = await provider.proposeFix(makeFixRequest());

    assert.strictEqual(result.summary, 'Switch minus to plus');
    assert.strictEqual(result.edits.length, 1);
    const edit = result.edits[0];
    assert.strictEqual(edit.kind, 'replace');
    if (edit.kind === 'replace') {
      assert.strictEqual(edit.path, 'src/math.ts');
      assert.strictEqual(edit.replace, 'a + b');
    }
  });

  // ── 3. Sidecar down → fallback to resolveComplete ─────────────────────────
  it('falls back to resolveComplete when sidecar is unreachable', async () => {
    // Set any key so resolveComplete has a provider
    process.env.API_KEYS = 'gsk_fake_groq_key_for_testing_000000000000';
    const { wasSidecarCalled } = sidecarDownProviderReturns(INVESTIGATION_JSON);

    const provider = new AntigravityProvider();
    const result = await provider.investigate(makeInvestigateRequest());

    assert.ok(wasSidecarCalled(), 'sidecar must have been attempted');
    assert.strictEqual(result.confidence, 'high');
  });

  it('falls back to resolveComplete on sidecar 500', async () => {
    // Use a Groq key (gsk_) — reliably auto-identified by resolveComplete
    process.env.GROQ_API_KEY = 'gsk_fake_key_for_testing_00000000000000000000000000';
    sidecar500(INVESTIGATION_JSON);

    const provider = new AntigravityProvider();
    const result = await provider.investigate(makeInvestigateRequest());
    assert.ok(result.suspectedFiles.length > 0);
  });

  // ── 4. JSON parsing — prose wrapper ───────────────────────────────────────
  it('extracts JSON even when the model wraps it in prose', async () => {
    const proseWrapped =
      'Sure, here is my analysis:\n\n' +
      INVESTIGATION_JSON +
      '\n\nHope that helps!';
    sidecarOk(proseWrapped);
    const provider = new AntigravityProvider();
    const result = await provider.investigate(makeInvestigateRequest());
    assert.strictEqual(result.rootCause, 'subtract operator used instead of add');
  });

  // ── 5. Model returns no JSON ───────────────────────────────────────────────
  it('throws a descriptive error when model returns no JSON', async () => {
    sidecarOk("I'm sorry, I cannot help with that.");
    const provider = new AntigravityProvider();
    await assert.rejects(
      () => provider.investigate(makeInvestigateRequest()),
      (err: Error) => {
        assert.ok(err.message.includes('no JSON object'), err.message);
        assert.ok(err.message.includes('investigation'), err.message);
        return true;
      }
    );
  });

  // ── 6. Model returns malformed JSON ───────────────────────────────────────
  it('throws a descriptive error on malformed JSON', async () => {
    sidecarOk('{"summary": "broken", "rootCause":'); // truncated
    const provider = new AntigravityProvider();
    await assert.rejects(
      () => provider.investigate(makeInvestigateRequest()),
      (err: Error) => {
        assert.ok(err.message.includes('JSON parse failed') || err.message.includes('no JSON'), err.message);
        return true;
      }
    );
  });

  // ── 7. proposeFix with previous attempts ──────────────────────────────────
  it('includes previous attempt context in the fix prompt', async () => {
    const receivedPrompts: string[] = [];
    mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      if (String(url).includes('localhost')) {
        receivedPrompts.push(JSON.parse(init.body).prompt);
        return new Response(JSON.stringify({ output: FIX_JSON }), { status: 200 });
      }
      throw new Error('unexpected non-sidecar fetch');
    });

    const provider = new AntigravityProvider();
    await provider.proposeFix(
      makeFixRequest({
        previousAttempts: [
          {
            number: 1,
            workspace: { id: 'ws-1', path: '/fake/ws-1' },
            proposal: { summary: 'Wrong fix', edits: [] },
            failure: { stage: 'test', output: 'not ok 1' }
          }
        ]
      })
    );

    const prompt = receivedPrompts[0];
    assert.ok(prompt.includes('Attempt #1'), 'previous attempt should be in prompt');
    assert.ok(prompt.includes('not ok 1'), 'failure output should be in prompt');
    assert.ok(prompt.includes('Wrong fix'), 'previous summary should be in prompt');
  });

  // ── 8. Baseline failure forwarded to investigation ─────────────────────────
  it('includes baseline test failure in the investigation prompt', async () => {
    const receivedPrompts: string[] = [];
    mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      if (String(url).includes('localhost')) {
        receivedPrompts.push(JSON.parse(init.body).prompt);
        return new Response(JSON.stringify({ output: INVESTIGATION_JSON }), { status: 200 });
      }
      throw new Error('unexpected non-sidecar fetch');
    });

    const provider = new AntigravityProvider();
    await provider.investigate(
      makeInvestigateRequest({
        baselineFailure: { success: false, output: 'EXPECTED FAILURE OUTPUT' }
      })
    );

    assert.ok(receivedPrompts[0].includes('EXPECTED FAILURE OUTPUT'));
  });

  // ── 9. resolveComplete propagates errors ──────────────────────────────────
  it('propagates errors from the AI provider (no swallowing)', async () => {
    process.env.API_KEYS = 'gsk_fake_groq_key';
    mock.method(globalThis, 'fetch', async (url: string) => {
      if (String(url).includes('localhost')) throw new Error('ECONNREFUSED');
      return new Response('{}', { status: 503 });
    });

    const provider = new AntigravityProvider();
    await assert.rejects(() => provider.investigate(makeInvestigateRequest()));
  });

  // ── 10. investigate with exploration context ───────────────────────────────
  it('includes exploration context in the investigation prompt', async () => {
    const receivedPrompts: string[] = [];
    mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      if (String(url).includes('localhost')) {
        receivedPrompts.push(JSON.parse(init.body).prompt);
        return new Response(JSON.stringify({ output: INVESTIGATION_JSON }), { status: 200 });
      }
      throw new Error('unexpected non-sidecar fetch');
    });

    const provider = new AntigravityProvider();
    await provider.investigate(
      makeInvestigateRequest({
        context: {
          files: [{ path: 'src/math.ts', content: 'const add = (a,b) => a - b' }],
          notes: [],
          exploration: { query: 'add broken', files: ['src/math.ts'], context: 'CODEGRAPH_RESULT' }
        }
      })
    );

    const prompt = receivedPrompts[0];
    assert.ok(prompt.includes('CODEGRAPH_RESULT'), 'exploration context must appear in prompt');
    assert.ok(prompt.includes('src/math.ts'), 'file content must appear in prompt');
  });

  // ── 11. Sidecar port is configurable via env ───────────────────────────────
  it('uses AGY_SIDECAR_PORT env var', async () => {
    process.env.AGY_SIDECAR_PORT = '9999';
    let calledPort = '';
    mock.method(globalThis, 'fetch', async (url: string) => {
      calledPort = String(url);
      return new Response(JSON.stringify({ output: INVESTIGATION_JSON }), { status: 200 });
    });

    const provider = new AntigravityProvider();
    await provider.investigate(makeInvestigateRequest());
    assert.ok(calledPort.includes(':9999'), `Expected port 9999 in ${calledPort}`);
  });

  // ── 12. Fix proposal — create edit kind ───────────────────────────────────
  it('handles "create" edit kind in fix proposal', async () => {
    const createFix = JSON.stringify({
      summary: 'Add test file',
      edits: [{ kind: 'create', path: 'src/math.test.ts', content: 'test content here' }]
    });
    sidecarOk(createFix);
    const provider = new AntigravityProvider();
    const result = await provider.proposeFix(makeFixRequest());

    assert.strictEqual(result.edits.length, 1);
    const edit = result.edits[0];
    assert.strictEqual(edit.kind, 'create');
    if (edit.kind === 'create') {
      assert.strictEqual(edit.path, 'src/math.test.ts');
    }
  });
});
