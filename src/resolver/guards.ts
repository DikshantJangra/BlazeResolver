import { posix } from 'node:path';
import { normalizeEditPath } from './patch.js';
import type { FileEdit } from './types.js';

// ---- Secrets -------------------------------------------------------------------------------------------------------

/** Formats of credentials that have no business in a bug fix. Values are never returned, only the labels. */
const SECRET_PATTERNS: [string, RegExp][] = [
  ['private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-style key', /\bsk-(?!ant-)(?:proj-|or-)?[A-Za-z0-9_-]{32,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe key', /\b[sr]k_live_[0-9A-Za-z]{16,}/],
  ['Groq or NVIDIA key', /\b(?:gsk_|nvapi-)[A-Za-z0-9_-]{20,}/],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['JSON web token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['hard-coded credential', /\b(?:api[_-]?key|secret|passw(?:or)?d|token|private[_-]?key)\b["']?\s*[:=]\s*["'][^"'\s]{20,}["']/i]
];

/** The lines a patch adds, without the leading +. Context and removed lines are not the fix's doing. */
export function addedLines(patch: string): string {
  return patch
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1))
    .join('\n');
}

/**
 * Names of the secrets found in `text`: known credential formats, and any exact value of `secretValues`
 * (the server's own keys and token, so a fix can't smuggle them out through the PR). Never returns the values.
 */
export function findSecrets(text: string, secretValues: string[] = []): string[] {
  const found = new Set<string>();
  for (const [label, re] of SECRET_PATTERNS) if (re.test(text)) found.add(label);
  for (const value of secretValues) if (value.length >= 8 && text.includes(value)) found.add('one of this job\'s own secrets');
  return [...found];
}

const SECRET_NAME = /(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE|CREDENTIAL)/i;

/** The values of every secret-looking environment variable, split on commas so an `API_KEYS` list is covered key by key. */
export function secretValuesFromEnv(env: Record<string, string | undefined> = process.env, extra: string[] = []): string[] {
  const values = new Set<string>(extra.filter((v) => v.length >= 8));
  for (const [name, value] of Object.entries(env)) {
    if (!value || !SECRET_NAME.test(name)) continue;
    for (const part of [value, ...value.split(/[,\s]+/)]) if (part.length >= 8) values.add(part);
  }
  return [...values];
}

// ---- What a fix must not touch ---------------------------------------------------------------------------------------

/** Fields of package.json that decide what code runs at install or test time. A fix may not change any of them. */
const PROTECTED_MANIFEST_KEYS = [
  'dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'bundledDependencies', 'bundleDependencies',
  'overrides', 'resolutions', 'pnpm', 'workspaces', 'packageManager', 'scripts', 'bin', 'main', 'exports', 'type', 'engines'
];

const isTestFile = (path: string) => /(?:^|\/)(?:__tests__|tests?|spec)\//i.test(path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path);
const ASSERTIONS = /\b(?:assert(?:\.\w+)?|expect|it|test|describe|should)\s*[.(]/g;
const count = (text: string) => (text.match(ASSERTIONS) ?? []).length;

const isManifest = (path: string) => posix.basename(path) === 'package.json';

/**
 * Why a fix's edits are refused, or undefined when they are fine. Three shortcuts an AI (or a crafted customer report
 * steering it) could take that a passing test run would never reveal:
 * - changing dependencies, scripts or other install-time fields in package.json, which is how code gets smuggled in;
 * - deleting assertions from an existing test, so a failing test passes because it checks less;
 * - creating a new package.json.
 * `read` returns a file's current content or null.
 */
export async function guardEdits(edits: FileEdit[], read: (path: string) => Promise<string | null>): Promise<string | undefined> {
  for (const edit of edits) {
    const path = normalizeEditPath(edit.path);

    if (isManifest(path)) {
      if (edit.kind === 'create') return `${path}: creating a package.json is not allowed. A human must add packages.`;
      const original = await read(path);
      if (original === null || !original.includes(edit.search)) continue; // renderPatch reports a missing target
      const changed = original.replace(edit.search, () => edit.replace);
      try {
        const before = JSON.parse(original);
        const after = JSON.parse(changed);
        const key = PROTECTED_MANIFEST_KEYS.find((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
        if (key) return `${path}: changing "${key}" is not allowed. Dependencies, scripts and other install-time fields need a human.`;
      } catch {
        return `${path}: the edit leaves invalid JSON.`;
      }
    }

    if (edit.kind === 'replace' && isTestFile(path) && count(edit.replace) < count(edit.search)) {
      return `${path}: the edit removes assertions or tests (${count(edit.search)} before, ${count(edit.replace)} after). A fix must not make a test check less; change the code instead, or add a test.`;
    }
  }
  return undefined;
}
