import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Project {
  id: string;
  repo: string;
  defaultBranch: string;
  /** Run in a fresh clone by the fix engine. */
  testCommand: string;
  buildCommand: string;
  /** The product's help docs; customer questions are answered from these. */
  helpDocs?: string;
  /** sha256 of the project key. The key itself is shown once at registration and never stored. */
  keyHash: string;
  createdAt: string;
}

const hash = (key: string) => createHash('sha256').update(key).digest('hex');

/**
 * Registered projects, one JSON file. Each project gets a secret key that the widget sends with every report.
 * ponytail: JSON file, whole-file rewrite; move to SQLite with the rest of the state (Phase 0).
 */
export class ProjectRegistry {
  constructor(private file = process.env.BLAZE_PROJECTS_FILE || '.blazeresolver/projects.json') {}

  private load(): Project[] {
    return existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) : [];
  }

  register(
    repo: string,
    defaultBranch = 'main',
    testCommand = 'npm ci && npm test',
    buildCommand = 'npm run build --if-present',
    helpDocs?: string
  ): { project: Project; key: string } {
    const key = `blz_${randomBytes(24).toString('hex')}`;
    const project: Project = {
      id: `prj_${randomBytes(6).toString('hex')}`,
      repo,
      defaultBranch,
      testCommand,
      buildCommand,
      helpDocs,
      keyHash: hash(key),
      createdAt: new Date().toISOString()
    };
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify([...this.load(), project], null, 2));
    return { project, key };
  }

  /** The project a key belongs to, or undefined. */
  verify(key: string | undefined): Project | undefined {
    if (!key) return undefined;
    const h = hash(key);
    return this.load().find((p) => p.keyHash === h);
  }

  /** List all registered projects. */
  list(): Project[] {
    return this.load();
  }
}
