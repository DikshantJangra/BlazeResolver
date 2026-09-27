/**
 * Finds attempts to instruct the AI inside a bug report.
 *
 * A bug report may legitimately talk about admins, verification, SQL or scripts: those are symptoms, and the product's
 * own security bugs are exactly what customers should report. What a report must never do is address the model that
 * reads it ("ignore your instructions", fake role tags) or steer the code it writes ("when you fix this, also add...").
 * Only that is flagged. The model is told the report is data regardless; this check keeps obvious attempts away from
 * it entirely, and out of the fix loop.
 */

const PATTERNS: RegExp[] = [
  // "ignore all previous instructions", "disregard your guidelines". The qualifier is what separates this from a
  // symptom like "the app ignores my delivery instructions".
  /\b(ignore|disregard|forget|override)\s+(all\s+|any\s+)?(of\s+)?(the\s+|your\s+|my\s+)?(previous|prior|above|earlier|preceding|original|initial|system|developer|all|any|these|those)\s+(instructions?|prompts?|guidelines|directives|rules)\b/,
  /\b(ignore|disregard|forget|override)\s+(your|the\s+system'?s?)\s+(instructions?|prompts?|guidelines|directives|rules|programming)\b/,
  /\b(ignore|disregard|forget)\s+(everything|anything|all)\s+(above|before|previously\s+said)\b/,
  /\b(ignore|disregard)\s+the\s+(above|foregoing)\b/,
  // a new persona ("you are now charging me twice" is a symptom, so only AI personas count)
  /\byou\s+are\s+now\s+(an?\s+|in\s+)?(unrestricted|jailbroken|dan|evil|free\s+from|no\s+longer\s+(bound|restricted)|(different|new)\s+(ai|assistant|model))\b/,
  /\byou\s+are\s+no\s+longer\s+(bound|restricted|an?\s+(ai|assistant|model))\b/,
  /\b(act|behave|respond)\s+(as|like)\s+(an?\s+)?(unrestricted|jailbroken|evil|dan\b|(different|new)\s+(ai|assistant|model))/,
  /\bpretend\s+(to\s+be|you\s+are)\s+(an?\s+)?(unrestricted|jailbroken|evil|different|another|new)\s+(ai|assistant|model)\b/,
  // new instructions, or asking for the hidden ones
  /\bnew\s+(instructions|task|rules|system\s+prompt)\s*:/,
  /\b(reveal|print|show|repeat|output|leak|display|tell\s+me)\b[^.\n]{0,30}\b(system\s+prompt|your\s+(instructions|prompt|rules|guidelines))\b/,
  /\bsystem\s+prompt\s*:/,
  // messages addressed to the model
  /\b(note|message|instructions?)\s+(to|for)\s+(the\s+)?(ai|assistant|model|llm|claude|chatgpt|gpt)\b/,
  /\b(dear|hey|hi)\s+(ai|claude|chatgpt|gpt)\b/,
  // prompt-format spoofing: our own <report> wrapper, chat-template tokens, instruction tags
  /<\/\s*report\s*>/,
  /<\/?\s*(system|assistant|instructions?)\s*>/,
  /<\|\s*(im_start|im_end|system|endoftext)\s*\|>/,
  /\[\s*\/?\s*inst\s*\]/,
  // steering the code the fix engine writes
  /\b(when|while|once)\s+(you\s+)?(fix|patch|writ\w*|generat\w*|chang\w*)\s+(this|it|the\s+(code|bug|issue))\b[^.\n]{0,60}\balso\s+(add|insert|include|remove|delete|disable|create|grant|send|upload|install)\b/,
  /\b(in|with)\s+your\s+(fix|patch|pull\s+request|pr|commit)\b[^.\n]{0,40}\b(add|remove|include|insert|disable|delete)\b/
];

/** Zero-width and invisible characters that split words without showing: "ig\u200Bnore" reads as "ignore". */
const INVISIBLE = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF]/g;

/** Lowercase, compatibility-normalized ("ｉｇｎｏｒｅ" is "ignore"), invisible characters removed, whitespace collapsed. */
export function normalizeForDetection(text: string): string {
  return text.normalize('NFKC').replace(INVISIBLE, '').replace(/[^\S\n]+/g, ' ').toLowerCase();
}

/** URLs arrive percent-encoded; an instruction can hide in a query string. */
function decodeUrl(url: string): string {
  try {
    return decodeURIComponent(url.replace(/\+/g, ' '));
  } catch {
    return url;
  }
}

export interface InjectionField {
  text: string | undefined;
  /** Decode percent-encoding before checking. */
  url?: boolean;
}

/** The first injection pattern found in any field, or undefined. */
export function findInjection(fields: InjectionField[]): RegExp | undefined {
  for (const field of fields) {
    if (!field.text) continue;
    const text = normalizeForDetection(field.url ? decodeUrl(field.text) : field.text);
    const hit = PATTERNS.find((pattern) => pattern.test(text));
    if (hit) return hit;
  }
  return undefined;
}
