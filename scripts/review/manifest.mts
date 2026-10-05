// The review manifest: what a captured set IS, so a set can be re-checked and a later set can be taken from the same cameras.
// before.manifest.json is committed under test/review/baselines/ (hashes and camera parameters only, never an image);
// the images it hashes live outside git under REVIEW_DIR.
import fs from 'node:fs';
import path from 'node:path';
import { BASELINES, readJson, sha256File, stableJson } from './lib.mts';
import type { Cam, Tod } from './cameras.mts';

export interface ManifestShot {
  id: string; file: string; house: string; room: string; roomName: string; level: string; program: string | null;
  tod: Tod; corner: string; kind: 'eye' | 'scale'; camera: Cam; res: string;
  sha256: string; bytes: number;
  /** a scale frame: where the 1.7 m mannequin stands (x, z), the yaw it faces, its clearance from the nearest floor item (m), the tier of the search that found it */
  mannequin?: { at: [number, number]; yaw: number; clearance: number; tier: number } | null;
}
export interface Manifest {
  schema: 1; set: string; tag: string;
  product: { tree: Record<string, string> };   // content only: the commit it was taken from is informational (provenance.json)
  renderer: { profile: string; chromium: string; supersample: number; res: string; quality: number; dressing: { walls: string; roof: string }; size: { w: number; h: number } };
  shots: ManifestShot[];
}

export const BEFORE_MANIFEST = path.join(BASELINES, 'before.manifest.json');
export const ADDENDUM_MANIFEST = path.join(BASELINES, 'before-addendum.manifest.json');
export const loadManifest = (f: string): Manifest => readJson<Manifest>(f);
export const manifestText = (m: Manifest) => stableJson(m, 1);

/** the manifest of a set directory: <dir>/<set>.manifest.json */
export const manifestIn = (dir: string, set: string) => path.join(dir, `${set}.manifest.json`);

/** Check a manifest against the files it describes: missing files, wrong bytes. Returns the problems found. */
export function verifyFiles(m: Manifest, dir: string): string[] {
  const bad: string[] = [];
  for (const s of m.shots) {
    const f = path.join(dir, s.file);
    if (!fs.existsSync(f)) { bad.push(`${s.id}: ${s.file} is missing`); continue; }
    const h = sha256File(f);
    if (h !== s.sha256) bad.push(`${s.id}: ${s.file} hashes to ${h.slice(0, 12)}, the manifest says ${s.sha256.slice(0, 12)}`);
  }
  return bad;
}

/** two manifests of the same cameras: shots whose hash differs, shots in one only, and cameras that moved */
export function diffManifests(a: Manifest, b: Manifest) {
  const A = new Map(a.shots.map(s => [s.id, s])), B = new Map(b.shots.map(s => [s.id, s]));
  const moved: string[] = [], onlyA: string[] = [], onlyB: string[] = [], camera: string[] = [];
  for (const [id, s] of A) { const t = B.get(id); if (!t) { onlyA.push(id); continue; } if (s.sha256 !== t.sha256) moved.push(id); if (JSON.stringify(s.camera) !== JSON.stringify(t.camera)) camera.push(id); }
  for (const id of B.keys()) if (!A.has(id)) onlyB.push(id);
  return { moved, onlyA, onlyB, camera, same: !moved.length && !onlyA.length && !onlyB.length && !camera.length };
}
