/** Every line `init` inserts into one of your files carries this token, so `remove` can take exactly those lines back out. */
export const MARK = 'blazeresolver:managed';
const INLINE_START = 'blazeresolver:inline-start';
const INLINE_END = 'blazeresolver:inline-end';

const lines = (text: string) => text.split('\n');
const join = (parts: string[]) => parts.join('\n');
const eol = (text: string) => (text.includes('\r\n') ? '\r' : '');

/** Inserts `line` after the zero-based line `index`, keeping the file's line endings. Everything else is untouched. */
export function insertAfter(text: string, index: number, line: string): string {
  const parts = lines(text);
  parts.splice(index + 1, 0, line + eol(text));
  return join(parts);
}

export function insertBefore(text: string, index: number, line: string): string {
  const parts = lines(text);
  parts.splice(index, 0, line + eol(text));
  return join(parts);
}

/**
 * Inserts `insertion` in the middle of a line, just before the first `needle`, for lines that also hold your own code
 * (`<body>{children}</body>`). The insertion is fenced by comments so `remove` can cut out exactly it.
 */
export function insertInline(text: string, index: number, needle: string, insertion: string, style: 'jsx' | 'html'): string {
  const parts = lines(text);
  const at = parts[index].indexOf(needle);
  const [open, close] = style === 'jsx' ? ['{/* ', ' */}'] : ['<!-- ', ' -->'];
  parts[index] = `${parts[index].slice(0, at)}${open}${INLINE_START}${close}${insertion}${open}${INLINE_END}${close}${parts[index].slice(at)}`;
  return join(parts);
}

/** Removes everything `init` inserted: whole marked lines, and fenced inline insertions. Other text comes back byte for byte. */
export function stripManaged(text: string): string {
  const withoutLines = join(lines(text).filter((l) => !l.includes(MARK)));
  return withoutLines.replace(/(?:\{\/\* |<!-- )blazeresolver:inline-start(?: \*\/\}| -->)[\s\S]*?(?:\{\/\* |<!-- )blazeresolver:inline-end(?: \*\/\}| -->)/g, '');
}

export const hasManaged = (text: string) => text.includes(MARK) || text.includes(INLINE_START);

/** Index of the last line that ends a top-level import (or require), or -1. Handles multi-line imports. */
export function lastImportLine(text: string): number {
  const parts = lines(text);
  let last = -1;
  parts.forEach((l, i) => {
    if (/^import\s+['"][^'"]+['"]\s*;?\s*(\/\/.*)?\r?$/.test(l)) last = i;
    else if (/^(?:import\b.*|\}.*)\bfrom\s+['"][^'"]+['"]\s*;?\s*(\/\/.*)?\r?$/.test(l)) last = i;
    else if (/^(?:const|let|var)\s+.*=\s*require\(\s*['"][^'"]+['"]\s*\)\s*(\.\w+)?\s*;?\s*(\/\/.*)?\r?$/.test(l)) last = i;
  });
  return last;
}

export const indentOf = (line: string) => line.match(/^\s*/)![0];
