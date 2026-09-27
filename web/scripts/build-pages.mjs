// Static build for GitHub Pages: `npm run build:pages` → out/.
// Pages has no server, so the site's own report endpoint (src/app/api/blaze) can't be exported: it is set aside for the
// build and always put back. The docs, search, llms.txt and the Markdown pages are all static and ship as usual.
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, writeFileSync } from 'node:fs';

const dynamicRoutes = ['src/app/api/blaze', 'src/app/api/support', 'src/app/api/pulse', 'src/app/api/timeline'];
const movedRoutes = [];

for (const route of dynamicRoutes) {
  if (existsSync(route)) {
    const aside = `.aside-${route.replace(/[\/\\]/g, '_')}`;
    renameSync(route, aside);
    movedRoutes.push({ route, aside });
  }
}

let status = 1;
try {
  status = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env: { ...process.env, GITHUB_PAGES: 'true' } }).status ?? 1;
} finally {
  for (const { route, aside } of movedRoutes) {
    if (existsSync(aside)) renameSync(aside, route);
  }
}
if (status === 0) writeFileSync('out/.nojekyll', ''); // serve _next/ as-is, no Jekyll processing
process.exit(status);
