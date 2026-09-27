export interface TimelineEvent {
  id: string;
  source: string; // 'github_push' | 'github_pr' | 'github_issue' | 'deployment' | 'system';
  title: string;
  actor: string;
  repo: string | null;
  refUrl: string | null;
  status: string | null;
  sha: string | null;
  occurredAt: number;
  createdAt: number;
  rawPayload?: {
    author?: { avatar_url?: string; login?: string };
    commit?: { message?: string };
    stats?: { additions: number; deletions: number; total?: number };
    files?: Array<{ filename: string }>;
  };
}

export type DevEvent = TimelineEvent;
