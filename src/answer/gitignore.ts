/**
 * Keeping the vector database out of a product's git: `.blazeresolver/` in the root .gitignore. `init` adds it, and so
 * does the handler when it first creates the database inside a checkout, for products installed without `init`.
 */

/** The folder the vector database lives in, relative to the repo root. */
export const VECTOR_DIR = '.blazeresolver';

export const GITIGNORE_BLOCK = `# BlazeResolver: the vector database of your docs. Rebuilt on demand, never commit it.\n${VECTOR_DIR}/\n`;

/** Lines that already ignore the folder, however they're written. */
const IGNORES = new RegExp(`^\\s*(\\*\\*/|/)?${VECTOR_DIR.replace('.', '\\.')}(/\\**)?\\s*$`);

export function ignoresVectorDir(gitignore: string): boolean {
  let ignored = false;
  for (const line of gitignore.split(/\r?\n/)) {
    if (IGNORES.test(line)) ignored = true;
    // A later negation ("!.blazeresolver/") takes it back.
    else if (/^\s*!/.test(line) && IGNORES.test(line.replace(/^\s*!/, ''))) ignored = false;
  }
  return ignored;
}

/**
 * The text to append to a .gitignore (undefined when there is none yet) so it ignores the vector database, including
 * the separator it needs; undefined when it already does.
 */
export function gitignoreAddition(existing: string | undefined): string | undefined {
  if (existing !== undefined && ignoresVectorDir(existing)) return undefined;
  if (!existing) return GITIGNORE_BLOCK;
  return (existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n') + GITIGNORE_BLOCK;
}
