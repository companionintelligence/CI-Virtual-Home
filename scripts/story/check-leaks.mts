#!/usr/bin/env -S node --experimental-strip-types
// T1, the leak scan. The public site names no home, no builder and no Sims build, and shows no internal house id. This reads
// every text file in the built site (and every file NAME) and reports each place one appears.
//
//   node --experimental-strip-types scripts/story/check-leaks.mts [dist]      (portal:test runs it as well, and in a browser)
//
// What it looks for: the twelve builders and the `source` strings of content/houses/index.json; `SimsTree`, `Sims 4`,
// `The Sims`, `Virtual homes`, `Base Game`; every spec `name`; every hand-picked display name of assets/home-names.ts; an
// internal house id as a path segment, a file name, a query value (`house=<id>`) or a quoted value in a data file;
// `/homes/` (the old share pages) and `content/houses/`.
//
// What it lets through, by design and by name: the `id` value inside content/homes/<slug>.<hash>.json (it seeds the
// geometry, so it cannot change; STORY-BIBLE 15.6) and `_redirects` (the 301 lines for the old links). room-creator.html is
// the one page that is also the editor, so its CODE may say `house=` and `content/houses/` (the parameter and the checkout
// path it still reads) but never a builder, a Sims reference, a name or an id in a URL.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT as REPO, readJson } from './site-lib.mts';

const TEXT = /\.(html|js|mjs|css|json|svg|vtt|txt|xml|webmanifest|md)$/i;
const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Needles = { names: string[]; ids: string[]; phrases: RegExp[]; fragmentIds: string[] };
export function needles(root = REPO): Needles {
  const index = readJson(path.join(root, 'content', 'houses', 'index.json'));
  const houses: { id: string; name?: string; author?: string; source?: string }[] = index.houses;
  const homeNames = fs.readFileSync(path.join(root, 'assets', 'home-names.ts'), 'utf8');
  const picked = [...homeNames.matchAll(/^\s*'[a-z0-9-]+':\s*'([^']+)'/gm)].map(m => m[1]);
  const specNames = houses.map(h => h.name).filter(Boolean) as string[];
  const names = [...new Set([...houses.map(h => h.author).filter(Boolean) as string[], ...houses.map(h => h.source).filter(Boolean) as string[], ...specNames, ...picked])];
  const ids = houses.map(h => h.id);
  return {
    names, ids,
    // (an id that is also an English word is only a leak in a URL, a file name or a data value, never in a sentence)
    fragmentIds: ids.filter(i => /nora|olcia/.test(i)),
    phrases: [/SimsTree/i, /Sims 4/i, /The Sims/i, /Virtual homes/i, /Base Game/i],
  };
}

export function walkFiles(dir: string, rel = ''): string[] {
  return fs.readdirSync(path.join(dir, rel)).flatMap(n => {
    const r = rel ? `${rel}/${n}` : n;
    return fs.statSync(path.join(dir, r)).isDirectory() ? walkFiles(dir, r) : [r];
  });
}

/** Everything the scan can say about one chunk of text. `where` names it; `code` loosens the path strings (room-creator.html). */
export function scanText(text: string, where: string, n: Needles, opts: { code?: boolean } = {}): string[] {
  const out: string[] = [];
  const hit = (what: string): void => { out.push(`${where}: ${what}`); };
  for (const name of n.names) if (new RegExp(escRe(name), 'i').test(text)) hit(`names "${name}"`);
  for (const re of n.phrases) if (re.test(text)) hit(`says ${re}`);
  for (const id of n.fragmentIds) if (text.includes(id)) hit(`has the internal id "${id}"`);
  const idAlt = n.ids.map(escRe).join('|');
  // an id where a URL or a data value is: after house=, as a path segment of a file, or alone in quotes
  const urlish = new RegExp(`(?:house=|/|\\bhomes/|thumbs/|previews/)(${idAlt})(?:[./?&"'\\s)]|$)`, 'g');
  for (const m of text.matchAll(urlish)) { if (opts.code && /^\//.test(m[0]) === false) continue; hit(`has the internal id "${m[1]}" in a URL (${m[0].trim()})`); break; }
  if (!opts.code) {
    if (/house=/.test(text)) hit('has "house=" (the old query)');
    if (/content\/houses\//.test(text)) hit('has "content/houses/"');
    if (/(?<!content)\/homes\//.test(text)) hit('has "/homes/" (the old share pages)');
    const quoted = new RegExp(`"(${idAlt})"`).exec(text);
    if (quoted && /\.json$/.test(where)) hit(`has the internal id ${quoted[0]} as a value`);
  }
  return out;
}

export function leakScan(dir: string, root = REPO): string[] {
  const n = needles(root);
  const found: string[] = [];
  for (const f of walkFiles(dir)) {
    const segs = f.split('/');
    for (const seg of segs) {
      const stem = seg.split('.')[0];
      if (n.ids.includes(stem) || n.fragmentIds.some(i => seg.includes(i))) found.push(`${f}: the file name has the internal id "${stem}"`);
    }
    if (f === '_redirects' || !TEXT.test(f)) continue;
    let text = fs.readFileSync(path.join(dir, f), 'utf8');
    // the one allowed residual: the sanitised spec's own `id`
    if (/^content\/homes\/[^/]+\.json$/.test(f)) text = text.replace(/^ {2}"id": "[^"]*",?\n/m, '');
    found.push(...scanText(text, f, n, { code: f === 'room-creator.html' }));
  }
  return found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.resolve(process.argv[2] || path.join(REPO, 'dist'));
  const found = leakScan(dir);
  if (found.length) { console.error(found.map(x => `  ✗ ${x}`).join('\n')); process.exit(1); }
  console.log(`leak scan: ${walkFiles(dir).length} files in ${path.relative(REPO, dir) || dir}, nothing that names a home, a builder or an id`);
}
