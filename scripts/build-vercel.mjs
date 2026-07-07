// Vercel build step. Produces dist/ — a copy of the static front-end with the
// hard-coded API base rewritten to same-origin, so the deployed site calls THIS
// project's own /api serverless function instead of the external
// api.bullrunn.fun. The committed source files are never modified (they stay a
// byte-exact 1:1 mirror); only the build output differs, by exactly one string.

import { cpSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// The front-end files that make up the static site (everything the browser loads).
const ITEMS = [
  'index.html', 'assets', 'archive', 'bg', 'frames', 'tex', 'sounds',
  'bull.png', 'lighttext.png', 'text.png', 'origin.png', 'herobg.png',
  'dex.webp', 'lightbg.jpeg',
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const item of ITEMS) {
  const from = join(root, item);
  if (!existsSync(from)) throw new Error(`missing front-end file: ${item}`);
  cpSync(from, join(dist, item), { recursive: true });
}

// Point the front-end at same-origin /api.
const bundle = join(dist, 'assets', 'index-e2y_TuZg.js');
const before = readFileSync(bundle, 'utf8');
const after = before.split('https://api.bullrunn.fun').join('');
writeFileSync(bundle, after);

const rewrites = (before.length - after.length) / 'https://api.bullrunn.fun'.length;
console.log(`build-vercel: dist ready (${ITEMS.length} items); rewrote ${rewrites} API-base occurrence(s) to same-origin /api`);
if (rewrites < 1) throw new Error('expected to rewrite the API base at least once — aborting');
