import { posix } from 'node:path';
import type { FileEdit } from './types.js';

/** An edit that cannot be turned into a patch: its target text is missing, ambiguous, or its path is unsafe. */
export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchError';
  }
}

/** Lines of unchanged context around each change, as git produces by default. */
const CONTEXT_LINES = 3;

/**
 * Applies edits in memory to the files `read` returns and renders the result as one unified diff
 * that `git apply` accepts. Nothing is written; the diff is the only output.
 */
export async function renderPatch(edits: FileEdit[], read: (path: string) => Promise<string | null>): Promise<string> {
  if (edits.length === 0) {
    throw new PatchError('the proposal contains no edits');
  }

  const originals = new Map<string, string | null>();
  const current = new Map<string, string | null>();

  for (const edit of edits) {
    const path = checkPath(edit.path);
    if (!originals.has(path)) {
      const content = await read(path);
      originals.set(path, content);
      current.set(path, content);
    }
    const content = current.get(path)!;

    if (edit.kind === 'create') {
      if (content !== null) {
        throw new PatchError(`cannot create ${path}: it already exists`);
      }
      current.set(path, edit.content);
      continue;
    }

    if (content === null) {
      throw new PatchError(`cannot edit ${path}: it does not exist`);
    }
    if (!edit.search) {
      throw new PatchError(`edit to ${path} has an empty search text`);
    }
    const first = content.indexOf(edit.search);
    if (first === -1) {
      throw new PatchError(`search text not found in ${path}:\n${edit.search}`);
    }
    if (content.indexOf(edit.search, first + 1) !== -1) {
      throw new PatchError(`search text occurs more than once in ${path}; include more surrounding lines:\n${edit.search}`);
    }
    current.set(path, content.slice(0, first) + edit.replace + content.slice(first + edit.search.length));
  }

  const diffs: string[] = [];
  for (const [path, original] of originals) {
    const updated = current.get(path)!;
    if (updated !== original) {
      diffs.push(createUnifiedDiff(path, original, updated!));
    }
  }
  if (diffs.length === 0) {
    throw new PatchError('the edits leave every file unchanged');
  }
  return diffs.join('');
}

/** A single-hunk git diff from `before` (null for a new file) to `after`. */
export function createUnifiedDiff(path: string, before: string | null, after: string): string {
  const header = before === null
    ? `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n`
    : `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n`;

  // Lines keep their terminator, so a changed end-of-file newline counts as a changed line.
  const a = splitLines(before ?? '');
  const b = splitLines(after);
  if (a.length === 0 && b.length === 0) return header;

  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < Math.min(a.length, b.length) - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) suffix++;

  const start = Math.max(0, prefix - CONTEXT_LINES);
  const oldChangeEnd = a.length - suffix;
  const newChangeEnd = b.length - suffix;
  const trailing = Math.min(suffix, CONTEXT_LINES);

  const body = [
    ...a.slice(start, prefix).map((line) => hunkLine(' ', line)),
    ...a.slice(prefix, oldChangeEnd).map((line) => hunkLine('-', line)),
    ...b.slice(prefix, newChangeEnd).map((line) => hunkLine('+', line)),
    ...a.slice(oldChangeEnd, oldChangeEnd + trailing).map((line) => hunkLine(' ', line))
  ];
  const oldCount = oldChangeEnd + trailing - start;
  const newCount = newChangeEnd + trailing - start;

  return `${header}@@ -${range(start, oldCount)} +${range(start, newCount)} @@\n${body.join('')}`;
}

function splitLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function hunkLine(marker: string, line: string): string {
  return line.endsWith('\n') ? `${marker}${line}` : `${marker}${line}\n\\ No newline at end of file\n`;
}

/** Hunk ranges are 1-based; an empty range names the line before it. */
function range(start: number, count: number): string {
  return count === 0 ? `${start},0` : `${start + 1},${count}`;
}

/**
 * The path an edit actually writes to: `src/../.env` writes `.env`. Every check on an edit's path must use this,
 * or a path spelled differently slips past the check while the patch still lands on the normalized file.
 */
export function normalizeEditPath(path: string): string {
  return posix.normalize(path);
}

/** Keeps edits inside the repository and to paths that need no quoting in a diff header. */
function checkPath(path: string): string {
  const normalized = normalizeEditPath(path);
  if (
    !path ||
    posix.isAbsolute(normalized) ||
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized === '..' ||
    normalized === '.git' ||
    normalized.startsWith('.git/') ||
    /[\s"'\\\x00-\x1f\x7f]/.test(normalized)
  ) {
    throw new PatchError(`refusing to edit "${path}": not a plain repository-relative path`);
  }
  return normalized;
}
