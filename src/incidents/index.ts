import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Report, Triage } from '../triage/index.js';

export interface ReportRecord {
  id: string;
  projectId: string;
  receivedAt: string;
  message: string;
  email?: string;
  triage: Triage;
  incidentId?: string;
}

export type IncidentStatus = 'open' | 'fixing' | 'pr_opened' | 'needs_human' | 'merged';

export interface IncidentRecord {
  id: string;
  projectId: string;
  title: string;
  description: string;
  /** Console errors from the reports; the fix engine reads file references out of them. */
  stackTrace?: string;
  feature?: string;
  reportIds: string[];
  status: IncidentStatus;
  prUrl?: string;
  issueUrl?: string;
  failureReason?: string;
  updatedAt: string;
}

/** Statuses a new matching report still joins. After a merge, the same bug reported again is a new incident. */
const JOINABLE: IncidentStatus[] = ['open', 'fixing', 'pr_opened', 'needs_human'];

const newId = (prefix: string) => `${prefix}_${randomBytes(5).toString('hex')}`;
const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Reports and incidents, two JSON files. Reports about the same feature (or with the same summary) in one project
 * share an incident, so ten customers hitting one bug produce one fix.
 * ponytail: whole-file rewrites and matching on the triage's feature/summary text; SQLite and error-signature grouping later.
 */
export class IncidentStore {
  private reportsFile: string;
  private incidentsFile: string;

  constructor(dir = process.env.BLAZE_DATA_DIR || '.blazeresolver') {
    this.reportsFile = join(dir, 'reports.json');
    this.incidentsFile = join(dir, 'incidents.json');
  }

  private read<T>(file: string): T[] {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  }
  private write(file: string, items: unknown[]) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(items, null, 2));
  }

  reports = () => this.read<ReportRecord>(this.reportsFile);
  incidents = () => this.read<IncidentRecord>(this.incidentsFile);
  incident = (id: string) => this.incidents().find((i) => i.id === id);

  /** Stores the report; bug candidates are attached to an incident, created if none matches. */
  addReport(projectId: string, report: Report, triage: Triage): { record: ReportRecord; incident?: IncidentRecord; isNew: boolean } {
    const record: ReportRecord = {
      id: newId('rep'),
      projectId,
      receivedAt: new Date().toISOString(),
      message: report.message,
      email: report.email,
      triage
    };

    let incident: IncidentRecord | undefined;
    let isNew = false;
    if (triage.enterFixLoop) {
      const incidents = this.incidents();
      const key = norm(triage.feature) || norm(triage.summary);
      incident = incidents.find(
        (i) => i.projectId === projectId && JOINABLE.includes(i.status) && (norm(i.feature) || norm(i.title)) === key
      );
      if (incident) {
        incident.reportIds.push(record.id);
        incident.updatedAt = record.receivedAt;
      } else {
        isNew = true;
        incident = {
          id: newId('inc'),
          projectId,
          title: triage.summary,
          description: [
            triage.summary,
            triage.steps.length && `Steps: ${triage.steps.join('; ')}`,
            triage.expected && `Expected: ${triage.expected}`,
            triage.actual && `Actual: ${triage.actual}`,
            report.pageUrl && `Page: ${report.pageUrl}`,
            report.appVersion && `App version: ${report.appVersion}`
          ].filter(Boolean).join('\n'),
          stackTrace: report.consoleErrors?.join('\n') || undefined,
          feature: triage.feature,
          reportIds: [record.id],
          status: 'open',
          updatedAt: record.receivedAt
        };
        incidents.push(incident);
      }
      record.incidentId = incident.id;
      this.write(this.incidentsFile, incidents);
    }

    this.write(this.reportsFile, [...this.reports(), record]);
    return { record, incident, isNew };
  }

  update(id: string, patch: Partial<Omit<IncidentRecord, 'id'>>): IncidentRecord | undefined {
    const incidents = this.incidents();
    const incident = incidents.find((i) => i.id === id);
    if (!incident) return undefined;
    Object.assign(incident, patch, { updatedAt: new Date().toISOString() });
    this.write(this.incidentsFile, incidents);
    return incident;
  }

  byPullRequest(url: string) {
    return this.incidents().find((i) => i.prUrl === url);
  }
}
