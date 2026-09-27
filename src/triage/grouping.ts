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
  /** The affected feature (as the model named it) or page, normalized. */
  feature?: string;
  /** The path of the page the report came from, normalized. */
  page?: string;
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

/** Crude, but enough that "applied"/"apply", "charges"/"charging" and "incorrectly"/"incorrect" compare equal. */
function stem(word: string): string {
  const cut = (w: string, suffixes: string[]) => {
    for (const suffix of suffixes) if (w.endsWith(suffix) && w.length - suffix.length >= 3) return w.slice(0, -suffix.length);
    return w;
  };
  let w = cut(cut(word, ['ly']), ['ing', 'ed', 'es', 's']);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('i')) w = `${w.slice(0, -1)}y`;
  return w;
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
  triage: Pick<Triage, 'feature' | 'summary' | 'actual'> & Partial<Pick<Triage, 'source' | 'page'>>,
  consoleErrors?: string[]
): Symptom {
  const error = consoleErrors?.map(normalizeError).find(Boolean);
  return {
    feature: normalizeFeature(triage.feature),
    ...(triage.page && { page: normalizeFeature(triage.page) }),
    error,
    words: symptomWords([triage.summary, triage.actual].filter(Boolean).join(' ')),
    normalized: triage.source === 'llm'
  };
}

/**
 * Whether two features can be the same one. Names are compared by their words, so "cart" and "cart / checkout" agree
 * and "checkout" and "settings" don't. A feature with no distinctive words (the home page "/") rules nothing out.
 */
function sameFeature(a: string, b: string): boolean {
  if (a === b) return true;
  const wa = symptomWords(a);
  const wb = symptomWords(b);
  return !wa.length || !wb.length || wa.some((w) => wb.includes(w));
}

/**
 * Whether two reports describe the same bug. `samePageIsEnough` (the default) lets reports whose wording can't be
 * compared, because no model wrote it, join on the feature alone; pass false when only a real match should count.
 */
export function sameSymptom(a: Symptom, b: Symptom, samePageIsEnough = true): boolean {
  // Pages when both reports have one: a model names the same feature differently from one report to the next
  // ("cart", "cart/checkout", "cart discount calculation"), the page path doesn't change.
  const [wa, wb] = a.page && b.page ? [a.page, b.page] : [a.feature, b.feature];
  if (wa && wb && !sameFeature(wa, wb)) return false;
  if (a.error && b.error) return a.error === b.error;
  // Customer wording can't be compared reliably: on the same feature, treat it as the same bug.
  if (samePageIsEnough && !(a.normalized && b.normalized) && wa && wb) return true;
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
