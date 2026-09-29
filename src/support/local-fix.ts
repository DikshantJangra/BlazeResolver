/**
 * Runs the fix engine on this machine for a bug a customer reported in the support chat: the same `blazeresolver try`
 * a developer would run by hand (real AI, the project's tests and build, a local branch, nothing pushed). For local
 * development only, so it is off unless BLAZE_LOCAL_FIX=true. It runs as its own process, so the fix engine (CodeGraph,
 * git, Docker) is never bundled into the app's server code, and a crash in it can't take the app down.
 */
import { builtin } from '../answer/runtime.js';

// Loaded at run time, not imported: the support handler also runs on serverless and edge hosts, whose bundlers must
// never see child_process. There this module does nothing, since BLAZE_LOCAL_FIX is off.
type ChildProcess = typeof import('node:child_process');
type Readline = typeof import('node:readline');

export interface LocalFixRequest {
  title: string;
  description: string;
}

export interface LocalFixOutcome {
  status: 'READY_FOR_REVIEW' | 'FAILED';
  /** The local branch holding the committed fix, when one passed. */
  branch?: string;
  reason?: string;
}

/** Starts one fix and reports each progress line; resolves when it ends. Tests inject their own. */
export type LocalFixRunner = (request: LocalFixRequest, onProgress: (event: string) => void) => Promise<LocalFixOutcome>;

/**
 * The CLI in a child process. `npx --no-install` finds the app's own blazeresolver, so the engine is the version the app
 * installed. Arguments are passed as an array, never through a shell, since the description is the customer's text.
 */
export const cliLocalFix =
  (cwd: string = process.cwd(), env: NodeJS.ProcessEnv = engineEnv(process.env)): LocalFixRunner =>
  (request, onProgress) =>
    new Promise((resolve) => {
      const cp = builtin<ChildProcess>('node:child_process');
      const readline = builtin<Readline>('node:readline');
      if (!cp || !readline) return resolve({ status: 'FAILED', reason: 'the local fix pipeline needs Node.js (it runs the fix engine as a process)' });
      const createInterface = readline.createInterface;
      const file = suspectFile(cp, cwd, request.description);
      if (file) onProgress(`the report's wording points to ${file}; starting there`);
      const args = ['--no-install', 'blazeresolver', 'try', '--title', request.title, '--description', request.description, ...(file ? ['--file', file] : [])];
      const child = cp.spawn('npx', args, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let status: LocalFixOutcome['status'] | undefined;
      let branch: string | undefined;
      let reason: string | undefined;
      let tail = '';
      const read = (line: string) => {
        tail = `${tail}\n${line}`.slice(-2000);
        const progress = /^\[[\d:]+\]\s+(.+)$/.exec(line);
        if (progress) return onProgress(progress[1]);
        const s = /^STATUS: (\S+)/.exec(line);
        if (s) status = s[1] === 'READY_FOR_REVIEW' ? 'READY_FOR_REVIEW' : 'FAILED';
        const r = /^REASON: (.+)$/.exec(line);
        if (r) reason = r[1];
        const b = /^Committed to local branch '([^']+)'/.exec(line);
        if (b) branch = b[1];
      };
      createInterface({ input: child.stdout }).on('line', read);
      createInterface({ input: child.stderr }).on('line', (line) => (tail = `${tail}\n${line}`.slice(-2000)));
      child.on('error', (err) => resolve({ status: 'FAILED', reason: `could not start the fix engine: ${err.message}` }));
      child.on('close', (code) => {
        if (status === 'READY_FOR_REVIEW' && branch) return resolve({ status, branch });
        const last = tail.trim().split('\n').filter(Boolean).pop();
        resolve({ status: 'FAILED', reason: reason ?? (code ? `the fix engine exited with code ${code}: ${last ?? ''}`.trim() : 'no fix passed') });
      });
    });

/**
 * The file a customer's words point to, found by plain text search: the code-structure search the engine starts from
 * finds functions and symbols, not a misspelled label or message in markup. Takes the report's rarest word (camelCase
 * split too, since "BlazeReslover" may be written as Blaze + Reslover) found in 1 to 3 source files; tests and docs
 * don't count. Undefined when no word is that distinctive.
 */
export function suspectFile(cp: Pick<ChildProcess, 'execFileSync'>, cwd: string, text: string): string | undefined {
  const git = (...args: string[]) => {
    try {
      return String(cp.execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    } catch {
      return ''; // git grep exits 1 when nothing matches
    }
  };
  // Only words that name something: compounds (BlazeReslover, checkoutButton) and their parts, or quoted text. Plain
  // English words ("spelled", "header") match some file by chance, and a wrong lead is worse than none.
  const quoted = [...text.matchAll(/["'“‘`]([^"'”’`]{3,60})["'”’`]/g)].map((m) => m[1]);
  const words = new Set<string>();
  for (const word of [...(text.match(/[A-Za-z][A-Za-z0-9_]{4,}/g) ?? []), ...quoted.flatMap((q) => q.match(/[A-Za-z][A-Za-z0-9_]{4,}/g) ?? [])]) {
    const parts = word.split(/(?<=[a-z0-9])(?=[A-Z])|_/);
    if (parts.length < 2 && !quoted.some((q) => q.includes(word))) continue;
    words.add(word);
    for (const part of parts) if (part.length >= 5) words.add(part);
  }
  let best: { word: string; files: string[] } | undefined;
  for (const word of words) {
    // ':/' searches the whole repository, not just the app's folder (cwd may be web/).
    const files = git('grep', '-l', '-I', '-w', '-F', '--full-name', '-e', word, '--', ':/')
      .split('\n')
      .filter((f) => f && !/(^|\/)(tests?|__tests__|docs?|content)\/|\.(test|spec)\.|\.mdx?$|\.json$/.test(f));
    if (files.length && files.length <= 3 && (!best || files.length < best.files.length)) best = { word, files };
  }
  return best?.files[0];
}

/**
 * The app server's environment minus what belongs to the server itself. A dev server runs with NODE_ENV=development,
 * which the engine hands to the project's build, and `next build` under it fails prerendering ("reading 'useContext'");
 * the rest (NODE_OPTIONS, NEXT_*, TURBOPACK) is the server's own runtime, not the project's.
 */
export function engineEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([k]) => !['NODE_ENV', 'NODE_OPTIONS', 'NEXT_RUNTIME', 'TURBOPACK'].includes(k) && !k.startsWith('__NEXT') && !k.startsWith('NEXT_PRIVATE'))
  );
}

/** One fix at a time: each one installs, tests and builds the whole project. */
let queue: Promise<unknown> = Promise.resolve();
export function enqueueLocalFix(run: LocalFixRunner, request: LocalFixRequest, onProgress: (event: string) => void): Promise<LocalFixOutcome> {
  const next = queue.then(() => run(request, onProgress));
  queue = next.catch(() => undefined);
  return next.catch((err) => ({ status: 'FAILED' as const, reason: err instanceof Error ? err.message : String(err) }));
}
