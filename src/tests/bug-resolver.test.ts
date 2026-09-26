import { describe, it } from 'node:test';
import assert from 'node:assert';
import type {
  BuildResult,
  CodebaseInterface,
  CommitResult,
  ExploreResult,
  FileContent,
  TestResult,
  Workspace,
  WorkspaceInterface
} from '../codebase/contracts.js';
import { BugResolver, HARD_MAX_ATTEMPTS } from '../resolver/bug-resolver.js';
import type { AIProvider, FixRequest, InvestigationRequest } from '../resolver/ai-provider.js';
import type { FixProposal, Incident, Investigation } from '../resolver/types.js';

const BASE_FILES: Record<string, string> = {
  'src/math.js': 'export const add = (a, b) => a - b;\n',
  'src/index.js': "import { add } from './math.js';\n"
};

/**
 * Workspaces that record patches instead of applying them. Tests and builds judge the patches applied to
 * their workspace, so each fake run sees only that workspace's changes.
 */
class FakeWorkspaces implements WorkspaceInterface {
  public created: Workspace[] = [];
  public patches = new Map<string, string[]>();
  public committed = false;

  constructor(
    private judge: { test?: (patches: string[]) => TestResult; build?: (patches: string[]) => BuildResult } = {}
  ) {}

  async createWorkspace(): Promise<Workspace> {
    const ws = { id: `ws-${this.created.length + 1}`, path: `/fake/ws-${this.created.length + 1}` };
    this.created.push(ws);
    this.patches.set(ws.id, []);
    return ws;
  }

  async readFile(ws: Workspace, path: string): Promise<string | null> {
    // Patches are never applied to file contents here, so every read sees the base.
    this.owned(ws);
    return BASE_FILES[path] ?? null;
  }

  async applyPatch(ws: Workspace, patch: string): Promise<void> {
    this.owned(ws).push(patch);
  }

  async gitDiff(ws: Workspace): Promise<string> {
    return this.owned(ws).join('');
  }

  async runTests(ws: Workspace): Promise<TestResult> {
    return (this.judge.test ?? defaultTest)(this.owned(ws));
  }

  async runBuild(ws: Workspace): Promise<BuildResult> {
    return (this.judge.build ?? (() => ({ success: true, output: 'built' })))(this.owned(ws));
  }

  async commit(): Promise<CommitResult> {
    this.committed = true;
    throw new Error('the resolver must not commit');
  }

  private owned(ws: Workspace): string[] {
    const patches = this.patches.get(ws.id);
    if (!patches) throw new Error(`unknown workspace ${ws.id}`);
    return patches;
  }
}

/** Tests pass once a patch makes `add` add. */
function defaultTest(patches: string[]): TestResult {
  return patches.some((p) => p.includes('+export const add = (a, b) => a + b;'))
    ? { success: true, output: 'ok 1 - add' }
    : { success: false, output: 'not ok 1 - add\n  expected: 5\n  actual: -1' };
}

class FakeCodebase implements CodebaseInterface {
  public explored: string[] = [];
  public read: string[] = [];

  constructor(private exploration: ExploreResult | Error = { query: '', files: ['src/math.js'] }) {}

  async explore(query: string): Promise<ExploreResult> {
    this.explored.push(query);
    if (this.exploration instanceof Error) throw this.exploration;
    return { ...this.exploration, query };
  }

  async readFile(path: string): Promise<FileContent> {
    this.read.push(path);
    const content = BASE_FILES[path];
    if (content === undefined) throw new Error(`no such file ${path}`);
    return { path, content };
  }

  async search() { return []; }
  async readRange(path: string): Promise<FileContent> { return this.readFile(path); }
  async findSymbol() { return []; }
  async findReferences() { return []; }
  async getDefinition() { return null; }
  async getCallers() { return []; }
  async getCallees() { return []; }
  async getDependencies() { return []; }
  async getReverseDependencies() { return []; }
  async getImpact(symbol: string) { return { target: symbol, affectedFiles: [] }; }
}

const INVESTIGATION: Investigation = {
  summary: 'add returns the difference',
  rootCause: 'add uses - instead of +',
  suspectedFiles: ['src/math.js'],
  confidence: 'high'
};

/** Replays one proposal per fix request, in order, and records every request. */
class ScriptedAI implements AIProvider {
  public investigations: InvestigationRequest[] = [];
  public fixes: FixRequest[] = [];

  constructor(
    private proposals: FixProposal[],
    private investigation: Investigation | Error = INVESTIGATION
  ) {}

  async investigate(request: InvestigationRequest): Promise<Investigation> {
    this.investigations.push(request);
    if (this.investigation instanceof Error) throw this.investigation;
    return this.investigation;
  }

  async proposeFix(request: FixRequest): Promise<FixProposal> {
    this.fixes.push(request);
    const proposal = this.proposals[this.fixes.length - 1];
    if (!proposal) throw new Error('script exhausted');
    return proposal;
  }
}

const fixTo = (expression: string): FixProposal => ({
  summary: `add returns ${expression}`,
  edits: [{ kind: 'replace', path: 'src/math.js', search: 'a - b', replace: expression }]
});
const CORRECT = fixTo('a + b');
const WRONG = fixTo('a * b');

const INCIDENT: Incident = {
  id: 'INC-1',
  title: 'Totals are wrong',
  description: 'add(2, 3) returns -1',
  stackTrace: 'Error: bad total\n    at total (/srv/app/src/index.js:1:10)\n    at node:internal/main:1:1'
};

describe('BugResolver', () => {
  it('fixes on the first attempt and hands off for review without committing', async () => {
    const workspaces = new FakeWorkspaces();
    const codebase = new FakeCodebase();
    const ai = new ScriptedAI([CORRECT]);
    const result = await new BugResolver({ codebase, workspaces, ai }).resolve(INCIDENT);

    assert.strictEqual(result.status, 'READY_FOR_REVIEW');
    assert.strictEqual(result.failureReason, undefined);
    assert.strictEqual(result.baseline?.success, false);
    assert.strictEqual(result.attempts.length, 1);
    assert.strictEqual(result.summary, 'add returns a + b');
    assert.match(result.diff!, /^-export const add = \(a, b\) => a - b;$/m);
    assert.match(result.diff!, /^\+export const add = \(a, b\) => a \+ b;$/m);

    // The baseline runs in its own workspace; the fix lands in a fresh one.
    assert.strictEqual(workspaces.created.length, 2);
    assert.deepStrictEqual(result.workspace, workspaces.created[1]);
    assert.deepStrictEqual(workspaces.patches.get('ws-1'), []);
    assert.strictEqual(workspaces.committed, false);

    // The AI saw the reproduction, the codebase context, and the file exactly as the workspace has it.
    const investigation = ai.investigations[0];
    assert.match(investigation.baselineFailure!.output, /actual: -1/);
    assert.deepStrictEqual(
      investigation.context.files.map((f) => f.path),
      ['src/index.js', 'src/math.js'],
      'stack-trace file first (mapped from /srv/app/...), then explored files'
    );
    assert.deepStrictEqual(ai.fixes[0].files, [{ path: 'src/math.js', content: BASE_FILES['src/math.js'] }]);
    assert.deepStrictEqual(ai.fixes[0].previousAttempts, []);
  });

  it('retries after failing tests, giving the AI the failure, in a fresh workspace', async () => {
    const workspaces = new FakeWorkspaces();
    const ai = new ScriptedAI([WRONG, CORRECT]);
    const result = await new BugResolver({ codebase: new FakeCodebase(), workspaces, ai }).resolve(INCIDENT);

    assert.strictEqual(result.status, 'READY_FOR_REVIEW');
    assert.deepStrictEqual(result.attempts.map((a) => a.failure?.stage), ['test', undefined]);
    assert.match(result.attempts[0].failure!.output, /not ok 1 - add/);

    const [, second] = ai.fixes;
    assert.strictEqual(second.previousAttempts.length, 1);
    assert.strictEqual(second.previousAttempts[0].failure?.stage, 'test');
    assert.match(second.previousAttempts[0].patch!, /a \* b/);

    // The failed patch stays in its own workspace; the passing one does not contain it.
    assert.notStrictEqual(result.attempts[0].workspace.id, result.attempts[1].workspace.id);
    assert.doesNotMatch(result.diff!, /a \* b/);
  });

  it('retries after a failing build', async () => {
    let builds = 0;
    const workspaces = new FakeWorkspaces({
      build: () => (++builds === 1 ? { success: false, output: 'SyntaxError: bad token' } : { success: true, output: 'ok' })
    });
    const ai = new ScriptedAI([CORRECT, CORRECT]);
    const result = await new BugResolver({ codebase: new FakeCodebase(), workspaces, ai }).resolve(INCIDENT);

    assert.strictEqual(result.status, 'READY_FOR_REVIEW');
    assert.deepStrictEqual(result.attempts.map((a) => a.failure?.stage), ['build', undefined]);
    assert.strictEqual(result.attempts[0].tests?.success, true);
    assert.match(ai.fixes[1].previousAttempts[0].failure!.output, /SyntaxError/);
  });

  it('retries when the proposed edits do not match the file', async () => {
    const stale: FixProposal = {
      summary: 'stale',
      edits: [{ kind: 'replace', path: 'src/math.js', search: 'a - c', replace: 'a + b' }]
    };
    const ai = new ScriptedAI([stale, CORRECT]);
    const result = await new BugResolver({ codebase: new FakeCodebase(), workspaces: new FakeWorkspaces(), ai }).resolve(INCIDENT);

    assert.strictEqual(result.status, 'READY_FOR_REVIEW');
    assert.strictEqual(result.attempts[0].failure?.stage, 'patch');
    assert.match(result.attempts[0].failure!.output, /search text not found in src\/math\.js/);
    assert.strictEqual(result.attempts[0].tests, undefined, 'tests do not run on a patch that did not apply');
  });

  it('stops at maxAttempts and reports FAILED', async () => {
    const workspaces = new FakeWorkspaces();
    const ai = new ScriptedAI([WRONG, WRONG, WRONG, WRONG]);
    const result = await new BugResolver({ codebase: new FakeCodebase(), workspaces, ai, maxAttempts: 2 }).resolve(INCIDENT);

    assert.strictEqual(result.status, 'FAILED');
    assert.strictEqual(result.attempts.length, 2);
    assert.strictEqual(ai.fixes.length, 2);
    assert.match(result.failureReason!, /no fix passed within 2 attempt\(s\); the last one failed at test/);
    assert.strictEqual(result.diff, undefined);
    assert.strictEqual(result.workspace, undefined);
  });

  it('enforces the hard attempt ceiling', () => {
    const options = { codebase: new FakeCodebase(), workspaces: new FakeWorkspaces(), ai: new ScriptedAI([]) };
    for (const maxAttempts of [0, -1, 1.5, HARD_MAX_ATTEMPTS + 1, Infinity, NaN]) {
      assert.throws(() => new BugResolver({ ...options, maxAttempts }), RangeError, String(maxAttempts));
    }
    assert.doesNotThrow(() => new BugResolver({ ...options, maxAttempts: HARD_MAX_ATTEMPTS }));
  });

  it('fails without attempting a fix when investigation fails', async () => {
    const workspaces = new FakeWorkspaces();
    const ai = new ScriptedAI([CORRECT], new Error('model unavailable'));
    const result = await new BugResolver({ codebase: new FakeCodebase(), workspaces, ai }).resolve(INCIDENT);

    assert.strictEqual(result.status, 'FAILED');
    assert.strictEqual(result.failureReason, 'investigation failed: model unavailable');
    assert.strictEqual(result.attempts.length, 0);
    assert.strictEqual(workspaces.created.length, 1, 'only the baseline workspace');
  });

  it('fails without spending further attempts when the AI provider errors', async () => {
    const ai = new ScriptedAI([WRONG]);
    const result = await new BugResolver({ codebase: new FakeCodebase(), workspaces: new FakeWorkspaces(), ai }).resolve(INCIDENT);

    assert.strictEqual(result.status, 'FAILED');
    assert.strictEqual(result.failureReason, 'fix proposal 2 failed: script exhausted');
    assert.strictEqual(result.attempts.length, 1);
  });

  it('investigates without codebase exploration when it fails', async () => {
    const codebase = new FakeCodebase(new Error('index unavailable'));
    const ai = new ScriptedAI([CORRECT]);
    const result = await new BugResolver({ codebase, workspaces: new FakeWorkspaces(), ai }).resolve(INCIDENT);

    assert.strictEqual(result.status, 'READY_FOR_REVIEW');
    const { context } = ai.investigations[0];
    assert.deepStrictEqual(context.notes, ['explore failed: index unavailable']);
    assert.deepStrictEqual(context.files.map((f) => f.path), ['src/index.js']);
  });

  it('truncates long failure output sent to the AI but keeps it in the result', async () => {
    const longOutput = 'x'.repeat(50_000) + 'FINAL LINE';
    const workspaces = new FakeWorkspaces({ test: (patches) => (patches.some((p) => p.includes('a + b')) ? { success: true, output: '' } : { success: false, output: longOutput }) });
    const ai = new ScriptedAI([WRONG, CORRECT]);
    const result = await new BugResolver({ codebase: new FakeCodebase(), workspaces, ai }).resolve(INCIDENT);

    assert.strictEqual(result.attempts[0].failure!.output, longOutput);
    const sent = ai.fixes[1].previousAttempts[0].failure!.output;
    assert.ok(sent.length < longOutput.length);
    assert.ok(sent.endsWith('FINAL LINE'));
  });
});
