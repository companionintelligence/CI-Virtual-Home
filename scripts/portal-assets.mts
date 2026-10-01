// The portal's rules for binary assets (scripts/build-portal.mts runs them, scripts/test-binary-guard.mts proves them).
//
// Why: the import map fingerprints every .js module, but a binary (a model, a texture, a baked volume) is fetched by a
// URL the page's code builds, so a file served under a stable name can be cached stale, and a stale binary against new
// code is an outage (the first pass-4 deploy, README → Deploying → Caching). So every binary has its content in its name:
//
//   assets/media/<key>/…   (models, textures)     listed in assets/media/<key>/files.json
//   content/ao/…           (baked AO volumes)     listed in content/ao/manifest.json
//
// A file's name ends in `-<h>.<ext>` or `.<h>.<ext>`, <h> being the first 8 hex digits of the sha256 of its bytes. The
// manifest names its files as strings anywhere in its JSON (relative to the manifest's own directory), so each package
// keeps the shape it wants. The build fails on: a file that is not listed, a listed file that is missing, a name without
// the hash or with the wrong one, more than MEDIA_LIMIT bytes under assets/media, and an eager realism module over
// EAGER_LIMIT bytes (the modules every visitor downloads before the first frame; the heavy parts are imported lazily).
// It ships exactly the listed files and content/ao/manifest.json, nothing else under those directories.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MEDIA_LIMIT = 12 * 1024 * 1024;
export const EAGER_LIMIT = 20 * 1024;
const HASHED = /[-.]([0-9a-f]{8})\.[A-Za-z0-9]+$/;
const MANIFEST_NAMES = new Set(['files.json', 'manifest.json']);

export type BinaryReport = { problems: string[]; ship: string[]; mediaBytes: number; files: number };

function walkAll(root: string, dirRel: string): string[] {
  const dir = path.join(root, dirRel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().flatMap(name => {
    const r = path.posix.join(dirRel.split(path.sep).join('/'), name);
    return fs.statSync(path.join(root, r)).isDirectory() ? walkAll(root, r) : [r];
  });
}
function stringsIn(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) stringsIn(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) stringsIn(x, out);
  return out;
}

/** Check assets/media/** and content/ao/** under `root` (the repo); `ship` is the list of repo-relative files to copy. */
export function checkBinaryAssets(root: string): BinaryReport {
  const problems: string[] = [];
  const ship: string[] = [];
  let mediaBytes = 0;
  const onDisk = [...walkAll(root, 'assets/media'), ...walkAll(root, 'content/ao')];
  const isManifest = (f: string): boolean => MANIFEST_NAMES.has(path.posix.basename(f)) && (f === 'content/ao/manifest.json' || /^assets\/media\/[^/]+\/files\.json$/.test(f));
  const manifests = onDisk.filter(isManifest);

  // what the manifests list
  const listed = new Map<string, string>();   // file → the manifest that lists it
  for (const m of manifests) {
    let json: unknown;
    try { json = JSON.parse(fs.readFileSync(path.join(root, m), 'utf8')); } catch (e) { problems.push(`${m}: not valid JSON (${(e as Error).message})`); continue; }
    for (const s of stringsIn(json)) {
      if (!HASHED.test(path.posix.basename(s))) continue;
      const dir = path.posix.dirname(m), f = path.posix.normalize(path.posix.join(dir, s));
      if (f.startsWith(`${dir}/`)) listed.set(f, m);   // (a manifest lists files in its own directory, never ../ out of it)
    }
  }
  for (const [f, m] of listed) if (!fs.existsSync(path.join(root, f))) problems.push(`${f} is listed in ${m} but missing`);

  for (const f of onDisk) {
    if (isManifest(f)) { if (f === 'content/ao/manifest.json') ship.push(f); continue; }
    const base = path.posix.basename(f);
    const m = HASHED.exec(base);
    if (!m) problems.push(`${f}: a binary under assets/media or content/ao needs a content hash in its name (…-<8 hex>.<ext>, the first 8 hex of its sha256)`);
    else {
      const want = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex').slice(0, 8);
      if (want !== m[1]) problems.push(`${f}: the name says ${m[1]} but the content hashes to ${want} (rename it, or re-run the script that wrote it)`);
    }
    if (!listed.has(f)) problems.push(`${f} is not listed in ${f.startsWith('content/ao/') ? 'content/ao/manifest.json' : `${path.posix.dirname(f).split('/').slice(0, 3).join('/')}/files.json`}`);
    else {
      ship.push(f);
      if (f.startsWith('assets/media/')) mediaBytes += fs.statSync(path.join(root, f)).size;
    }
  }
  if (mediaBytes > MEDIA_LIMIT) problems.push(`assets/media ships ${(mediaBytes / 1048576).toFixed(1)} MB; the limit is ${MEDIA_LIMIT / 1048576} MB`);

  // eager modules: realism.js, viewer-quality.js and realism-<key>.js are fetched by every visitor before the first frame
  for (const f of walkAll(root, 'assets')) {
    if (!/^assets\/(realism\.js|viewer-quality\.js|realism-[a-z]+\.js)$/.test(f)) continue;
    const size = fs.statSync(path.join(root, f)).size;
    if (size > EAGER_LIMIT) problems.push(`${f} is ${(size / 1024).toFixed(1)} KB; an eager realism module may be ${EAGER_LIMIT / 1024} KB (put the weight in a viewer-<x>.ts the feature imports lazily)`);
  }
  return { problems, ship, mediaBytes, files: ship.length };
}
