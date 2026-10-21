#!/usr/bin/env -S node --experimental-strip-types
// Collision detector: finds props that intersect other props or the building, in the meshes a house really builds, and ranks them by how
// deep they go.
//
//   node --experimental-strip-types scripts/review/collide.mts --house aurora[,seraphine] [--out dir] [--gl default|software]
//        [--min-depth 1] [--images 6] [--show-allowed] [--site] [--selftest]
//   needs the repo built (pnpm run build) and Chromium: PLAYWRIGHT_BROWSERS_PATH=<dir> where Playwright's pinned build is missing.
//
// The page hands over every visible mesh of the built house (walls up, roof on) as a world-space box or triangle soup, grouped under the
// object the builder `put` into the scene: an item (userData.itemType, .room, .onSurface, .mounted, .foliage, .dress), a wall
// (userData.isWall: its full-height group, its window and door units, its leaves), a wall finish overlay, a stair run (userData.stair), a rail,
// a floor, a site piece. scripts/review/collide-lib.mts (pure Node, unit-tested) does the rest:
//   prop vs prop, prop vs wall (body / trim / finish), prop vs window (frame, pane, stool) or door (jamb, leaf), prop vs stair or rail:
//       SAT on convex hulls, the minimum translation distance in centimetres and the shared volume in cm3
//   door swing: the leaf's boxes at eight poses from closed to open against every item of the storey
//   slab void: an item whose feet stand over a stairwell or an authored opening;  floor: an item under its room's floor (raised platforms and
//       pits move it: rooms[].floorOffset);  ceiling: an item through its storey's ceiling (not a column, not in an outdoor room)
// What is let through is the placement metadata (content/house-catalog.json `place`) and structure: standing on / resting in (a vertical push
// under 4 cm), onSurface hosts, wall-mounted, against a wall (2 cm), trim boards, tucks under tables, foliage. `allowed` in the JSON lists
// each rule, how many contacts it let through and the deepest, with an example.
// --site also tests the lot's hard pieces (cars, garden walls, fences, loungers, benches; not planting, paving or the pool) against the house's walls.
// Thresholds: a finding needs 1 cm of penetration (--min-depth, cm); legitimate relations may overlap by 1 cm (contact), 4 cm (resting: a vertical push),
// 8 cm (a rug's pile), 5 cm (an on-surface item's foot), 4 cm (wall-mounted), 2 cm (against a wall), 3 cm (trim), 12 cm (tucks, foliage), 10 cm (a cord's plug).
// Output: <out>/collide/<house>.json, an image of the worst pairs (the two things tinted, the shared box in magenta) and a table on stdout.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUT_DEFAULT, clearImages, parseArgs, writeJson, writePng, fmtSec, round } from './geom-report.mts';
import { startGeoSession, type GeoPage } from './geom-page.mts';
import { findCollisions, type Finding } from './collide-lib.mts';
import { loadCatalog, extractDump } from './collide-io.mts';

const where = (f: Finding) => `${f.a.room ? f.a.room + ', ' : ''}L${f.a.level}`;
const nameOf = (r: { type: string | null; name: string }) => r.type || r.name;

async function runHouse(sess: any, house: string, o: { minDepth: number; images: number; showAllowed: boolean; site: boolean }, outDir: string) {
  const t0 = Date.now();
  console.log(`\n== ${house}`);
  clearImages(path.join(outDir, house), 'collide');
  const h: GeoPage = await sess.open(house);
  const tOpen = Date.now() - t0;
  try {
    const t1 = Date.now();
    const { dump } = await extractDump(h);
    const tExtract = Date.now() - t1, t2 = Date.now();
    const res = findCollisions(dump, loadCatalog(), { minDepth: o.minDepth, site: o.site });
    const tAnalyse = Date.now() - t2;
    // images of the worst: distinct pairs, one image per finding
    const images: string[] = [], shots: any[] = [];
    const pick = res.findings.filter(f => f.a).slice(0, o.images);
    let n = 0;
    for (const f of pick) {
      const r = await h.page.evaluate((cfg: any) => (window as any).__geo.pairShot(cfg), {
        ea: f.a.i, eb: f.b ? f.b.i : null, at: f.at, size: f.size || [0.1, 0.1, 0.1], level: f.a.level, res: '720',
        label: `${house}  ${f.kind}  depth ${f.depth_cm} cm  volume ${f.volume_cm3} cm3  ${where(f)}`, nameA: `${nameOf(f.a)}`, nameB: f.b ? nameOf(f.b) : (f.kind === 'door-swing' ? 'door leaf' : f.kind),
      });
      const file = path.join(outDir, house, `collide-${String(++n).padStart(2, '0')}-${f.kind}-${(f.a.type || f.a.name).replace(/[^A-Za-z0-9]+/g, '_')}${f.b ? '-' + (f.b.type || f.b.name).replace(/[^A-Za-z0-9]+/g, '_').slice(0, 24) : ''}.png`);
      writePng(file, r.image); images.push(file); shots.push({ file, camera: r.cam, overhead: r.overhead });
    }
    const byKind: Record<string, number> = {};
    for (const f of res.findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
    const byRoom: Record<string, number> = {};
    for (const f of res.findings) { const k = `L${f.a.level}/${f.a.room ?? '-'}`; byRoom[k] = (byRoom[k] || 0) + 1; }
    // a pattern, not a one-off: props that are in a wall by about half its thickness stand on the wall's centre line instead of its face
    const half = res.findings.filter(f => f.kind === 'prop-wall' && f.thickness_cm !== undefined && Math.abs(f.depth_cm - f.thickness_cm / 2) <= 1.2);
    const doc = {
      schema: 1, tool: 'collide', house,
      settings: { minDepth_cm: o.minDepth * 100, site: o.site, dressing: { walls: 'up', roof: 'on' }, resting_cm: 4, contact_cm: 1, gpu: sess.gpu, chromium: sess.version },
      timing_s: { open: round(tOpen / 1000, 1), extract: round(tExtract / 1000, 1), analyse: round(tAnalyse / 1000, 1), total: round((Date.now() - t0) / 1000, 1) },
      stats: { entities: dump.entities.length, ...res.stats, findings: res.findings.length }, by_kind: byKind, by_room: byRoom,
      patterns: half.length ? { 'embedded by half the wall thickness (placed on the wall centre line?)': half.map(f => `${f.a.id} in ${f.b!.name}: ${f.depth_cm} cm of ${f.thickness_cm} cm`) } : {},
      findings: res.findings, allowed: res.allowed, images: shots, page_errors: h.errors,
    };
    const file = path.join(outDir, `${house}.json`);
    writeJson(file, doc);
    report(house, doc, o.showAllowed);
    console.log(`  wrote ${file}\n  ${images.length} images in ${path.join(outDir, house)}\n  time: open ${fmtSec(tOpen / 1000)}, extract ${fmtSec(tExtract / 1000)}, analyse ${fmtSec(tAnalyse / 1000)}, total ${fmtSec((Date.now() - t0) / 1000)}`);
    return doc;
  } finally { await h.close(); }
}

function report(house: string, doc: any, showAllowed: boolean) {
  console.log(`  ${doc.stats.entities} entities, ${doc.stats.parts} parts, ${doc.stats.pairsTested} pairs tested, ${doc.stats.overlaps} overlapping, ${doc.stats.findings} findings (${Object.entries(doc.by_kind).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'})`);
  doc.findings.slice(0, 15).forEach((f: Finding, i: number) => {
    console.log(`   ${String(i + 1).padStart(2)}. ${f.kind.padEnd(11)} depth ${String(f.depth_cm).padStart(6)} cm  vol ${String(f.volume_cm3).padStart(7)} cm3  ${where(f)}  at (${f.at.join(', ')})`);
    console.log(`        ${nameOf(f.a)} [${f.a.id}]${f.b ? `  x  ${nameOf(f.b)} [${f.b.id}]` : ''}`);
    console.log(`        ${f.parts ? `${f.parts.a}  <->  ${f.parts.b}${f.parts.n > 1 ? `  (+${f.parts.n - 1} more part pairs)` : ''}` : f.rule}`);
  });
  const pat = Object.entries(doc.patterns || {});
  for (const [k, v] of pat) console.log(`  pattern: ${(v as string[]).length} props ${k}`);
  if (showAllowed) { console.log('  let through by the whitelist'); for (const a of doc.allowed) console.log(`   ${String(a.count).padStart(5)} x ${a.rule.padEnd(14)} deepest ${a.maxDepth_cm} cm   ${a.example}`); }
  else if (doc.allowed.length) console.log(`  let through: ${doc.allowed.map((a: any) => `${a.count} ${a.rule}`).join(', ')} (--show-allowed)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = path.resolve(args.out && args.out !== 'true' ? args.out : OUT_DEFAULT);
  const gl = args.gl === 'software' ? 'software' : 'default';
  const sess = await startGeoSession({ gl });
  console.log(`collide: ${sess.version} on ${gl}; output ${path.join(out, 'collide')}`);
  let code = 0;
  try {
    if (args.selftest === 'true') { const { selftest } = await import('./collide-selftest.mts'); code = (await selftest(sess)) ? 0 : 1; process.exitCode = code; return; }
    if (!args.house) { console.error('--house <id[,id]> is required'); process.exit(2); }
    for (const house of args.house.split(',')) await runHouse(sess, house, { minDepth: Number(args['min-depth'] ?? 1) / 100, images: Number(args.images ?? 6), showAllowed: args['show-allowed'] === 'true', site: args.site === 'true' }, path.join(out, 'collide'));
  } finally { await sess.close(); }
  process.exit(code);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
