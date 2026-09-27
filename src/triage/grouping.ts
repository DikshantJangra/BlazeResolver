import type { Triage } from './index.js';

/**
 * What a bug looks like from outside, for deciding whether two reports are the same bug.
 *
 * The feature (or page) alone is too coarse: a broken discount code and a rejected postcode are both on /checkout but
 * need separate fixes. The exact wording is too fine: "Pay button does nothing" and "clicking pay does nothing" are one
 * bug. So reports match when they are about the same feature and either raise the same error or, when a model wrote
 * the summaries, describe the symptom in largely the same words.
 *
 * Without a model the summary is the customer's own wording, which varies too much to compare: those reports group by
 * feature/page, as one bug reported many ways, unless their console errors show they are different bugs. Splitting one
 * bug into several incidents would mean duplicate fixes; a second bug on the page is reported again after the first
 * one's fix merges.
 */
export interface Symptom {
  /** The affected feature or page, normalized. */
  feature?: string;
  /** The first console error with volatile parts (URLs, file positions, numbers, ids) removed. */
  error?: string;
  /** Distinctive words of the symptom description, stemmed, sorted. */
  words: string[];
  /** The words come from a model's normalized summary, so comparing them is meaningful. */
  normalized?: boolean;
}

/** Share of distinctive words two descriptions need in common to be the same bug. */
const MIN_WORD_OVERLAP = 1 / 3;

const STOPWORDS = new Set(
  (
    'the and for are but not you your with this that have has had was were when what where which who why how can cant could ' +
    'would should will wont just get got from into after before then than there their they them its our out all any some ' +
    'does did doing done dont doesnt didnt isnt wasnt arent also very really please thanks thank still again every each ' +
    'time now only even here about being been because while like able unable keep keeps kept seems seem trying tried try ' +
    'page screen app site website user users customer customers one two use using used anymore any more want need via'
  ).split(' ')
);

function stem(word: string): string {
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
  }
  return word;
}

export function symptomWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map(stem);
  return [...new Set(words)].sort().slice(0, 24);
}

/** "TypeError: x is undefined at https://a.b/c.js:10:4" and the same error from another build or line read the same. */
export function normalizeError(error: string): string {
  return (error.split('\n')[0] ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/[\w./@-]+\.(m?js|cjs|jsx?|tsx?|vue|svelte)(:\d+){0,2}/g, '<file>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, '#')
    .replace(/\b0x[0-9a-f]+\b|\b[0-9a-f]{12,}\b/g, '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

const normalizeFeature = (feature: string | undefined) => feature?.toLowerCase().replace(/[^a-z0-9/]+/g, ' ').replace(/\s+/g, ' ').trim() || undefined;

export function symptomOf(
  triage: Pick<Triage, 'feature' | 'summary' | 'actual'> & { source?: Triage['source'] },
  consoleErrors?: string[]
): Symptom {
  const error = consoleErrors?.map(normalizeError).find(Boolean);
  return {
    feature: normalizeFeature(triage.feature),
    error,
    words: symptomWords([triage.summary, triage.actual].filter(Boolean).join(' ')),
    normalized: triage.source === 'llm'
  };
}

export function sameSymptom(a: Symptom, b: Symptom): boolean {
  if (a.feature && b.feature && a.feature !== b.feature) return false;
  if (a.error && b.error) return a.error === b.error;
  // Customer wording can't be compared reliably: on the same feature, treat it as the same bug.
  if (!(a.normalized && b.normalized) && a.feature && b.feature) return true;
  if (!a.words.length || !b.words.length) return false;
  const shared = a.words.filter((w) => b.words.includes(w)).length;
  const union = new Set([...a.words, ...b.words]).size;
  return shared / union >= MIN_WORD_OVERLAP;
}

/** For storing a symptom in a GitHub issue as a hidden marker: no characters that could end an HTML comment. */
export const encodeSymptom = (symptom: Symptom) => encodeURIComponent(JSON.stringify(symptom)).replace(/-/g, '%2D');

export function decodeSymptom(encoded: string): Symptom | undefined {
  try {
    const value = JSON.parse(decodeURIComponent(encoded)) as Symptom;
    return Array.isArray(value?.words) ? value : undefined;
  } catch {
    return undefined;
  }
}
