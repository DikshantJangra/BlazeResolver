import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The installed blazeresolver version, for audit trails. The layout differs between tsx (src/) and the build (dist/server/src/). */
export function engineVersion(): string {
  for (const rel of ['../package.json', '../../../package.json']) {
    try {
      const file = fileURLToPath(new URL(rel, import.meta.url));
      if (!existsSync(file)) continue;
      const pkg = JSON.parse(readFileSync(file, 'utf8'));
      if (pkg.name === 'blazeresolver') return pkg.version;
    } catch {
      // try the next location
    }
  }
  return 'unknown';
}
