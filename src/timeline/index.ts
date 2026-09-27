import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

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

let detectedRepoCache: string | null = null;

export function autoDetectGitRepo(): string {
  if (detectedRepoCache) return detectedRepoCache;

  const envRepo = process.env.BLAZE_REPO || process.env.GITHUB_REPOSITORY || process.env.NEXT_PUBLIC_GITHUB_REPO;
  if (envRepo && envRepo.includes('/')) {
    detectedRepoCache = envRepo.trim();
    return detectedRepoCache;
  }

  // Auto-parse git config remote origin URL via git CLI
  try {
    const { execSync } = require('node:child_process');
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const match = remoteUrl.match(/github\.com[:/]([^/\s]+\/[^/\s.]+?)(\.git)?$/i);
    if (match && match[1]) {
      detectedRepoCache = match[1];
      return match[1];
    }
  } catch {}

  detectedRepoCache = 'DikshantJangra/BlazeResolver';
  return 'DikshantJangra/BlazeResolver';
}

export function getDynamicGithubConfig(): { repo: string; token?: string } {
  const repo = autoDetectGitRepo();
  const token =
    process.env.BLAZE_GITHUB_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_PAT ||
    process.env.BLAZE_RESOLVER_GITHUB_TOKEN;

  return { repo, token: token ? token.trim() : undefined };
}

// In-memory cache for timeline events
let cachedEvents: TimelineEvent[] = [];
let lastSyncTime = 0;
const CACHE_TTL_MS = 60_000;

export async function fetchTimelineEvents(limit = 50, force = false, full = false): Promise<TimelineEvent[]> {
  const now = Date.now();
  if (!force && cachedEvents.length > 0 && now - lastSyncTime < CACHE_TTL_MS && !full) {
    return cachedEvents.slice(0, limit);
  }

  const gh = getDynamicGithubConfig();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'BlazeResolver-Timeline/1.0',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (gh.token) {
    headers.Authorization = `Bearer ${gh.token}`;
  }

  // 1. Fetch live commits from GitHub API
  try {
    const perPage = Math.min(full ? 100 : limit, 100);
    const url = `https://api.github.com/repos/${gh.repo}/commits?per_page=${perPage}`;

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const rawCommits = await res.json();
      if (Array.isArray(rawCommits) && rawCommits.length > 0) {
        const events: TimelineEvent[] = rawCommits.map((item: any) => {
          const commitDate = item.commit?.author?.date || item.commit?.committer?.date;
          const unixMs = commitDate ? new Date(commitDate).getTime() : now;
          const message = item.commit?.message || 'Git commit';
          const firstLine = message.split('\n')[0] || 'Git commit';
          const author = item.commit?.author?.name || item.author?.login || 'Blaze Engineer';
          const sha = item.sha || 'head';

          return {
            id: `git_${sha.slice(0, 12)}`,
            source: 'github_push',
            title: firstLine,
            actor: author,
            repo: gh.repo,
            refUrl: item.html_url || `https://github.com/${gh.repo}/commit/${sha}`,
            status: 'success',
            sha: sha.slice(0, 7),
            occurredAt: unixMs,
            createdAt: unixMs,
            rawPayload: {
              author: item.author ? { avatar_url: item.author.avatar_url, login: item.author.login } : undefined,
              commit: { message },
              stats: item.stats ? { additions: item.stats.additions, deletions: item.stats.deletions } : undefined
            }
          };
        });

        cachedEvents = events.sort((a, b) => b.occurredAt - a.occurredAt);
        lastSyncTime = now;
        return cachedEvents.slice(0, limit);
      }
    }
  } catch (err) {
    console.warn('[BlazeTimeline] GitHub API fetch error, falling back to local git log:', err);
  }

  // 2. Fallback: Local Git Log
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', `-n`, String(Math.max(limit, 50)), `--pretty=format:%H|%an|%ae|%at|%s`],
      { timeout: 5000, cwd: process.cwd() }
    );

    const lines = stdout.trim().split('\n').filter(Boolean);
    const events: TimelineEvent[] = [];

    for (const line of lines) {
      const [hash, author, _email, timestampStr, subject] = line.split('|');
      if (!hash || !subject) continue;
      const unixMs = parseInt(timestampStr, 10) * 1000 || now;

      events.push({
        id: `local_git_${hash.slice(0, 12)}`,
        source: 'github_push',
        title: subject,
        actor: author || 'Blaze Developer',
        repo: gh.repo,
        refUrl: `https://github.com/${gh.repo}/commit/${hash}`,
        status: 'success',
        sha: hash.slice(0, 7),
        occurredAt: unixMs,
        createdAt: unixMs,
        rawPayload: {
          commit: { message: subject }
        }
      });
    }

    if (events.length > 0) {
      cachedEvents = events.sort((a, b) => b.occurredAt - a.occurredAt);
      lastSyncTime = now;
      return cachedEvents.slice(0, limit);
    }
  } catch {}

  return cachedEvents.slice(0, limit);
}

export * from './handler.js';
