#!/usr/bin/env -S node --experimental-strip-types
// The publish-day re-check of content/story/catalog-apps.json. Run by hand; it is never part of CI, and the network step
// is explicit (--fetch). The catalog is a curated snapshot (2026-10-01): the live store and the manifests move, and a
// story that names an app which has left the store must not ship.
//
//   node --experimental-strip-types scripts/story/build-catalog-snapshot.mts --fetch                 report only
//   node --experimental-strip-types scripts/story/build-catalog-snapshot.mts --fetch --write         also refresh inLiveStore + the date
//   node --experimental-strip-types scripts/story/build-catalog-snapshot.mts --live saved.json        no network: a saved GET /api/store
//
//   --fetch                 GET https://hub.ci.computer/api/store (the full published catalog; an array, or {apps:[...]})
//   --save-live <file>      keep the fetched response (for --live later, or for the record)
//   --repo <dir>            the CI-Marketplace clone (default: ../HUB/CI-Marketplace, ../CI-Marketplace, $CI_MARKETPLACE_DIR)
//   --ref <ref>             which commit's manifests to read (default origin/main; run `git fetch` there first). Read with
//                           `git cat-file`, so the clone's working tree and checked-out branch do not matter
//   --manifests-dir <dir>   read apps/<id>/config.json from a directory instead of git
//   --write                 write content/story/catalog-apps.json (only inLiveStore and the meta date change)
//
// Exit 1 when a story could be wrong today: an app in the catalog is gone from the store, or a manifest dropped a
// `replaces` name a chip may claim. New store apps and renames are printed and do not fail. After --write, run
// `pnpm run story:validate -- --complete` (apps that left the store now fail `app-not-in-store`).
//
// What this does NOT do: curate. storySafe, caveats, the agent link and QA status are judgements from reading each
// manifest (CI-Common / r-catalog notes); a new store app is listed for a human to curate, never added.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, type CatalogFile } from './lib/context.mts';
import { applyDiff, diffBlocks, diffCatalog, renderDiff, type LiveApp, type Manifest } from './lib/catalog-diff.mts';

const argv = process.argv.slice(2);
const flag = (n: string): boolean => argv.includes(`--${n}`);
const val = (n: string): string | null => { const i = argv.indexOf(`--${n}`); return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const STORE_URL = 'https://hub.ci.computer/api/store';
const CATALOG = path.join(ROOT, 'content', 'story', 'catalog-apps.json');

if (!flag('fetch') && !val('live')) {
  console.error('Pass --fetch (GET https://hub.ci.computer/api/store) or --live <saved response>. The network step is explicit; see the header of this file.');
  process.exit(2);
}

// ---- 1. the live store listing
let liveRaw: unknown;
if (val('live')) liveRaw = JSON.parse(fs.readFileSync(path.resolve(val('live')!), 'utf8'));
else {
  const res = await fetch(STORE_URL, { signal: AbortSignal.timeout(60_000), headers: { accept: 'application/json' } });
  if (!res.ok) { console.error(`${STORE_URL} answered ${res.status}`); process.exit(2); }
  liveRaw = await res.json();
  if (val('save-live')) fs.writeFileSync(path.resolve(val('save-live')!), JSON.stringify(liveRaw));
}
const liveList: any[] = Array.isArray(liveRaw) ? liveRaw : Array.isArray((liveRaw as any)?.apps) ? (liveRaw as any).apps : [];
const live: LiveApp[] = liveList.filter((a) => a && typeof a.id === 'string').map((a) => ({ id: a.id, title: a.title, name: a.name, available: a.available }));
if (live.length < 100) { console.error(`the live listing has ${live.length} apps; the production store has about 579, so this is not the full catalog (refusing to compare)`); process.exit(2); }

// ---- 2. the manifests
const manifests = new Map<string, Manifest>();
const dir = val('manifests-dir');
if (dir) {
  for (const id of fs.readdirSync(path.resolve(dir))) {
    const f = path.join(path.resolve(dir), id, 'config.json');
    if (fs.existsSync(f)) manifests.set(id, JSON.parse(fs.readFileSync(f, 'utf8')));
  }
} else {
  const candidates = [val('repo'), process.env.CI_MARKETPLACE_DIR, path.join(ROOT, '..', 'HUB', 'CI-Marketplace'), path.join(ROOT, '..', 'CI-Marketplace'), path.join(ROOT, '..', '..', 'HUB', 'CI-Marketplace')].filter((x): x is string => !!x);
  const repo = candidates.find((c) => fs.existsSync(path.join(c, '.git')));
  if (!repo) { console.error(`no CI-Marketplace clone found (tried ${candidates.join(', ')}); pass --repo <dir> or --manifests-dir <dir>`); process.exit(2); }
  const ref = val('ref') ?? 'origin/main';
  const git = (args: string[], input?: string) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', input, maxBuffer: 1 << 28 });
  const ls = git(['ls-tree', '-r', '--name-only', ref, 'apps/']);
  if (ls.status !== 0) { console.error(`git ls-tree ${ref} failed in ${repo}: ${ls.stderr}`); process.exit(2); }
  const ids = ls.stdout.split('\n').map((l) => l.match(/^apps\/([^/]+)\/config\.json$/)?.[1]).filter((x): x is string => !!x);
  const blobs = git(['cat-file', '--batch'], ids.map((id) => `${ref}:apps/${id}/config.json`).join('\n') + '\n');
  // `cat-file --batch` prints "<sha> blob <size>\n<bytes>\n" per object, in order
  const buf = Buffer.from(blobs.stdout, 'utf8');
  let pos = 0;
  for (const id of ids) {
    const eol = buf.indexOf(10, pos);
    const header = buf.subarray(pos, eol).toString('utf8').split(' ');
    const size = Number(header[2]);
    if (header[1] !== 'blob' || !Number.isFinite(size)) { pos = eol + 1; continue; }
    const body = buf.subarray(eol + 1, eol + 1 + size).toString('utf8');
    try { manifests.set(id, JSON.parse(body)); } catch { /* a manifest that is not JSON is a manifest problem, reported as "no manifest" */ }
    pos = eol + 1 + size + 1;
  }
  console.log(`Read ${manifests.size} manifests from ${repo} at ${ref} (${git(['rev-parse', '--short', ref]).stdout.trim()}).`);
}

// ---- 3. compare and report
const catalog: CatalogFile = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const diff = diffCatalog(catalog, live, manifests);
console.log(renderDiff(diff));

if (flag('write')) {
  const date = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(CATALOG, JSON.stringify(applyDiff(catalog, live, date), null, 2) + '\n');
  console.log(`\nWrote ${path.relative(ROOT, CATALOG)} (inLiveStore refreshed, snapshot date ${date}). Next: pnpm run story:validate -- --complete`);
}
process.exit(diffBlocks(diff) ? 1 : 0);
