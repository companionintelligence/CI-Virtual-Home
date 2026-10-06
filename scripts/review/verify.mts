#!/usr/bin/env -S node --experimental-strip-types
// Check a captured set against its manifest, or two manifests against each other (the determinism check: capture twice, compare).
//
//   node --experimental-strip-types scripts/review/verify.mts --dir <set dir> [--manifest <file>]     files exist and hash to what the manifest says (default manifest: test/review/baselines/before.manifest.json)
//   node --experimental-strip-types scripts/review/verify.mts --a <manifest> --b <manifest>           same frames, same hashes, same cameras?
//   node --experimental-strip-types scripts/review/verify.mts --audit                                  the audit's 199 jpgs (the independent second BEFORE, copied to <REVIEW_DIR>/audit-before) still hash as pinned
//   node --experimental-strip-types scripts/review/verify.mts --audit-write [--from <dir>]             pin them (copies <dir>, default the audit's interior-look folder, into <REVIEW_DIR>/audit-before)
// Exit 0 when everything agrees, 1 otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, REVIEW_DIR, BASELINES, sha256File, stableJson, writeText, readJson, rel } from './lib.mts';
import { BEFORE_MANIFEST, diffManifests, loadManifest, verifyFiles } from './manifest.mts';

const args = parseArgs(process.argv.slice(2));
const AUDIT_SRC = '/Users/liam/devel/_staging/3dinside/_audit/repo-recon/interior-look';
const AUDIT_DIR = path.join(REVIEW_DIR, 'audit-before'), AUDIT_FILE = path.join(BASELINES, 'audit-before.manifest.json');
if (args['audit-write'] === 'true') {
  const from = path.resolve(args.from && args.from !== 'true' ? args.from : AUDIT_SRC);
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  const files = fs.readdirSync(from).filter(f => f.endsWith('.jpg')).sort();
  for (const f of files) if (!fs.existsSync(path.join(AUDIT_DIR, f))) fs.copyFileSync(path.join(from, f), path.join(AUDIT_DIR, f));
  const frames = files.map(f => ({ file: f, sha256: sha256File(path.join(AUDIT_DIR, f)), bytes: fs.statSync(path.join(AUDIT_DIR, f)).size }));
  writeText(AUDIT_FILE, stableJson({ schema: 1, what: 'the audit\'s 199 interior jpgs (repo-recon/interior-look): the independent second BEFORE. 1280x720 composer path, eye-level corner views NW and SE (+ dusk, night, style variants, dollhouse cutaways), taken at the audit\'s detached commit 46c514a (origin/main before Stage 0a). Copied to <REVIEW_DIR>/audit-before and pinned by hash; the files are never committed.', source: from, count: frames.length, frames }));
  console.log(`${frames.length} audit frames pinned → ${rel(AUDIT_FILE)} (copied to ${AUDIT_DIR})`);
  process.exit(0);
}
if (args.audit === 'true') {
  const m = readJson(AUDIT_FILE); const bad: string[] = [];
  for (const f of m.frames) { const p = path.join(AUDIT_DIR, f.file); if (!fs.existsSync(p)) bad.push(`${f.file} is missing`); else if (sha256File(p) !== f.sha256) bad.push(`${f.file} changed`); }
  for (const b of bad) console.log(`  ✗ ${b}`);
  console.log(bad.length ? `✗ ${bad.length} problem(s)` : `✓ all ${m.frames.length} audit frames in ${AUDIT_DIR} match ${path.basename(AUDIT_FILE)}`);
  process.exit(bad.length ? 1 : 0);
}
if (args.a && args.b) {
  const a = loadManifest(path.resolve(args.a)), b = loadManifest(path.resolve(args.b));
  const d = diffManifests(a, b);
  console.log(`${a.shots.length} frames in ${a.set}, ${b.shots.length} in ${b.set}: ${d.moved.length} hash(es) differ, ${d.onlyA.length} only in a, ${d.onlyB.length} only in b, ${d.camera.length} camera(s) differ`);
  for (const id of d.moved) console.log(`  ✗ ${id}`);
  console.log(d.same ? '✓ the two captures are identical frame for frame' : '✗ the captures differ');
  process.exit(d.same ? 0 : 1);
}
const mf = path.resolve(args.manifest && args.manifest !== 'true' ? args.manifest : BEFORE_MANIFEST);
const dir = path.resolve(args.dir && args.dir !== 'true' ? args.dir : path.join(REVIEW_DIR, 'before'));
const m = loadManifest(mf), bad = verifyFiles(m, dir);
for (const b of bad) console.log(`  ✗ ${b}`);
console.log(bad.length ? `✗ ${bad.length} problem(s) in ${dir}` : `✓ all ${m.shots.length} frames in ${dir} match ${path.basename(mf)}`);
process.exit(bad.length ? 1 : 0);
