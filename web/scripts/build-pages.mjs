// Static build for GitHub Pages: `npm run build:pages` → out/.
// Pages has no server, so the site's own report endpoint (src/app/api/blaze) can't be exported: it is set aside for the
// build and always put back. The docs, search, llms.txt and the Markdown pages are all static and ship as usual.
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, writeFileSync } from 'node:fs';

const route = 'src/app/api/blaze';
const aside = '.api-blaze.build-pages';
const moved = existsSync(route);
if (moved) renameSync(route, aside);

let status = 1;
try {
  status = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env: { ...process.env, GITHUB_PAGES: 'true' } }).status ?? 1;
} finally {
  if (moved) renameSync(aside, route);
}
if (status === 0) writeFileSync('out/.nojekyll', ''); // serve _next/ as-is, no Jekyll processing
process.exit(status);
