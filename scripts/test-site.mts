#!/usr/bin/env -S node --experimental-strip-types
// S4's landscape metrics, measured in Node on exactly what the builder lays out (assets/site-planting.ts, the planting
// generator; assets/site-geom.ts, the curves) — no browser, deterministic:
// @check-house quick
//
//   node --experimental-strip-types scripts/test-site.mts [--house id,…] [--json]      (any cwd; run `pnpm run build` first)
//
// For every S4 fixture (test/fixtures/houses/s4-site-*.json), or the houses named:
//   axis-aligned   the share of bed, planting and path edges (by length) within 1° of the x or z axis, as built (curves
//                  resolved; a bed's straight edge against the house left out) — target ≤ 20 % over the fixtures
//   bare mulch     each planting's share of its beds no crown covers (the drip strip along a wall not counted) —
//                  target ≤ 10 % a planting (a formal mix's gravel between its clipped shapes is its design)
//   layers         height classes in each bed of a three-layer planting: under 0.45 m, to 1.1 m, over — target 3
//   in the house   no plant whose crown reaches into the ground storey (it must stop at its walls)
//   determinism    every planting laid out twice is the same, number for number
// Exit 0 when every target holds; 1 otherwise (2: nothing to measure, or the compiled assets are missing).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, [] as string[][]));
if (!fs.existsSync(path.join(ROOT, 'assets', 'site-planting.js'))) { console.error('assets/site-planting.js is missing: pnpm run build first'); process.exit(2); }
const P = await import(path.join(ROOT, 'assets', 'site-planting.js'));
const G = await import(path.join(ROOT, 'assets', 'site-geom.js'));

const FIX = path.join(ROOT, 'test', 'fixtures', 'houses'), HOUSES = path.join(ROOT, 'content', 'houses');
const files: string[] = args.house
  ? args.house.split(',').map(id => fs.existsSync(path.join(FIX, `${id}.json`)) ? path.join(FIX, `${id}.json`) : path.join(HOUSES, `${id}.json`))
  : fs.readdirSync(FIX).filter(f => /^s4-site-.+\.json$/.test(f)).sort().map(f => path.join(FIX, f));
if (!files.length) { console.error('no S4 fixtures (test/fixtures/houses/s4-site-*.json)'); process.exit(2); }

const T = { axis: 0.2, bare: 0.1, classes: 3 };
let fails = 0, allAxis = 0, allLen = 0;
const report = [];
for (const file of files) {
  const spec = JSON.parse(fs.readFileSync(file, 'utf8')), ctx = P.createSiteContext(spec), site = spec.site || [];
  const segs: Array<[number[], number[]]> = [], rows = [];
  let houseClash = 0;
  for (const [i, s] of site.entries()) {
    if (s.type === 'bed' && (Array.isArray(s.poly) || Array.isArray(s.at))) {
      const p0 = s.poly || [[s.at[0] - (s.w || 2) / 2, s.at[1] - (s.d || 1) / 2], [s.at[0] + (s.w || 2) / 2, s.at[1] - (s.d || 1) / 2], [s.at[0] + (s.w || 2) / 2, s.at[1] + (s.d || 1) / 2], [s.at[0] - (s.w || 2) / 2, s.at[1] + (s.d || 1) / 2]];
      const t = G.tensionOf(s.smooth); segs.push(...G.segmentsOf(t === null ? p0 : G.smoothLoop(p0, t, 0.25), true));
    }
    if (s.type === 'path' && Array.isArray(s.path)) segs.push(...G.segmentsOf(ctx.pathLine(s), false));
    if (s.type !== 'planting') continue;
    const a = P.planPlanting(s, i, ctx), b = P.planPlanting(s, i, ctx);
    const hash = (x: unknown) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 12);
    const same = hash(a) === hash(b);
    segs.push(...P.bedSegments(a));
    const bare = a.beds.some(bd => bd.soil) ? P.bareShare(a, ctx) : null;
    const classes = P.heightClasses(a);
    // a crown into the house: a plant whose reach passes the wall line (the walls stand 0.12 m proud of the footprint)
    const clash = a.plants.filter(p => ctx.houseGap(p.x, p.z) - 0.12 < p.r - 1e-6).length;
    houseClash += clash;
    const formal = a.mix === 'formal', layered = (s.layers ?? 3) >= 3 && a.beds.length > 0;
    const okBare = bare === null || formal || bare <= T.bare, okClasses = !layered || formal || classes.every(c => c >= T.classes), okDet = same, okClash = clash === 0;
    if (!(okBare && okClasses && okDet && okClash)) fails++;
    rows.push({ i, kind: s.kind || 'border', mix: a.mix, beds: a.beds.length, plants: a.plants.length + a.trees.length, bare, classes, clash, hash: hash(a), ok: okBare && okClasses && okDet && okClash });
  }
  const ax = G.axisAligned(segs);
  allAxis += ax.axis; allLen += ax.total;
  report.push({ id: spec.id, axis: ax.total ? ax.axis / ax.total : 0, len: ax.total, rows, houseClash });
}
const share = allLen ? allAxis / allLen : 0;
if (share > T.axis) fails++;
if (args.json === 'true') console.log(JSON.stringify({ share, report }, null, 1));
else {
  for (const r of report) {
    console.log(`${r.rows.every(x => x.ok) ? '✓' : '✗'} ${r.id}: edges ${r.len.toFixed(1)} m, ${(r.axis * 100).toFixed(0)} % axis-aligned`);
    for (const x of r.rows) console.log(`    ${x.ok ? '✓' : '✗'} site[${x.i}] planting ${x.kind} · ${x.mix}: ${x.beds} beds, ${x.plants} plants, bare mulch ${x.bare === null ? '—' : (x.bare * 100).toFixed(1) + ' %'}${x.mix === 'formal' ? ' (formal: not judged)' : ''}, height classes ${x.classes.length ? x.classes.join('/') : '—'}${x.clash ? `, ${x.clash} reaching into the house` : ''}  [${x.hash}]`);
  }
  console.log(`\n${share <= T.axis ? '✓' : '✗'} axis-aligned bed, planting and path edges over ${report.length} lot(s): ${(share * 100).toFixed(1)} % of ${allLen.toFixed(0)} m (target ≤ ${T.axis * 100} %)`);
  console.log(fails ? `${fails} failed` : 'all targets hold');
}
process.exit(fails ? 1 : 0);
