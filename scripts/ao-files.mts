// The AO volumes the portal ships (content/ao/): exactly the files content/ao/manifest.json lists, each one the bytes its
// name says it is. Shared by build-portal.mts (which fails the build on a problem) and scripts/live-checks/ao.mts (which
// proves the guard catches an unlisted, a missing and a mis-hashed file). The binaries are not covered by the import-map
// fingerprinting that protects the modules, so their NAME is their version: <id>.<first 8 hex of sha256 of the file>.bin.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** problems with the AO directory `dir` against the house ids that must have a volume ([] when it is as shipped) */
export function aoProblems(dir: string, houseIds: string[]): string[] {
  const out: string[] = [];
  const mp = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mp)) return [`no ${mp}: pnpm run ao`];
  let manifest: { houses?: Record<string, { file: string; bytes: number }> };
  try { manifest = JSON.parse(fs.readFileSync(mp, 'utf8')); } catch (e) { return [`${mp} is not JSON (${(e as Error).message})`]; }
  const listed = manifest.houses || {};
  for (const id of houseIds) if (!listed[id]) out.push(`no AO volume for ${id}: pnpm run ao --house ${id}`);
  const names = new Set<string>();
  for (const [id, e] of Object.entries(listed)) {
    names.add(e.file);
    const fp = path.join(dir, e.file);
    if (!fs.existsSync(fp)) { out.push(`${id}: ${e.file} is listed in the manifest and missing`); continue; }
    const buf = fs.readFileSync(fp);
    const sha8 = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
    if (e.file !== `${id}.${sha8}.bin`) out.push(`${id}: ${e.file} holds the hash ${sha8}, not the one in its name (a changed volume must change its name)`);
    if (buf.length !== e.bytes) out.push(`${id}: ${e.file} is ${buf.length} bytes, the manifest says ${e.bytes}`);
  }
  for (const f of fs.readdirSync(dir)) if (f !== 'manifest.json' && !names.has(f)) out.push(`${f} is in content/ao and not in the manifest (it would ship unused, or be mistaken for current)`);
  return out;
}

/** the files to ship: the manifest and the volumes it lists */
export function aoShipList(dir: string): string[] {
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  return ['manifest.json', ...Object.values<{ file: string }>(m.houses || {}).map(e => e.file)];
}
