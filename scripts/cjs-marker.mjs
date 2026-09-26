// dist/cjs holds a CommonJS build of blazeresolver/handler; this tells Node its .js files are CommonJS.
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('dist/cjs', { recursive: true });
writeFileSync('dist/cjs/package.json', '{"type":"commonjs"}\n');
