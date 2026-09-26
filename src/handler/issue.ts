import type { Report, Triage } from '../triage/index.js';

/** Customer text goes in fenced blocks, so it can't render as markdown, @mentions or HTML in the issue. */
const fence = (text: string) => '````text\n' + text.replace(/`{4,}/g, '```') + '\n````';

const CONSOLE_HEADING = '### Console errors';

/** Lowercase slug that identifies "the same bug" across reports. Stored in the issue as a hidden marker. */
export function groupKey(triage: Triage): string {
  return (triage.feature || triage.summary).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'unknown';
}

export const keyMarker = (key: string) => `<!-- blaze:key=${key} -->`;

/** Hidden marker holding an address to tell when the fix ships. Only written when the site owner opts in. */
export const emailMarker = (email: string) => `<!-- blaze:notify=${btoa(email)} -->`;

export function emailsIn(texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const m of text.matchAll(/<!-- blaze:notify=([A-Za-z0-9+/=]+) -->/g)) {
      try {
        found.add(atob(m[1]));
      } catch {
        // a mangled marker is skipped
      }
    }
  }
  return [...found];
}

export function renderReport(report: Report, triage: Triage): string {
  return [
    `**Summary:** ${triage.summary.replace(/[\r\n]+/g, ' ')}`,
    `**Kind:** ${triage.kind} | **Severity:** ${triage.severity} | **Triaged by:** ${triage.source}`,
    report.pageUrl && `**Page:** \`${report.pageUrl.replace(/`/g, '')}\``,
    report.appVersion && `**App version:** \`${report.appVersion.replace(/`/g, '')}\``,
    triage.steps.length ? `**Steps to reproduce:**\n${triage.steps.map((s, i) => `${i + 1}. ${s.replace(/[\r\n]+/g, ' ')}`).join('\n')}` : '',
    triage.expected && `**Expected:** ${triage.expected.replace(/[\r\n]+/g, ' ')}`,
    triage.actual && `**Actual:** ${triage.actual.replace(/[\r\n]+/g, ' ')}`,
    `### Customer report\n${fence(report.message)}`,
    report.consoleErrors?.length ? `${CONSOLE_HEADING}\n${fence(report.consoleErrors.join('\n'))}` : ''
  ].filter(Boolean).join('\n\n');
}

export const renderIssueBody = (report: Report, triage: Triage, key: string, email?: string) =>
  `${renderReport(report, triage)}\n\n${keyMarker(key)}${email ? `\n${emailMarker(email)}` : ''}\n`;

/** The incident the fix engine works from, read back out of an issue body. Markers are dropped; the text stays data. */
export function parseIssueBody(title: string, body: string): { title: string; description: string; stackTrace?: string } {
  const clean = body.replace(/<!--[\s\S]*?-->/g, '').trim();
  const idx = clean.indexOf(CONSOLE_HEADING);
  const errors = idx === -1 ? undefined : clean.slice(idx + CONSOLE_HEADING.length).replace(/`{4}text\n?|`{4}/g, '').trim();
  return {
    title: title.replace(/^\[[^\]]*\]\s*/, ''),
    description: (idx === -1 ? clean : clean.slice(0, idx)).trim(),
    stackTrace: errors || undefined
  };
}
