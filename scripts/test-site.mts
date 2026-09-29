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
//   facade cover  a foundation planting's beds over the facade it names, outside the metre kept clear each side of a
//                 door — target ≥ 80 % (sampled every 0.1 m, 0.4 m out from the wall)
// Exit 0 when every target holds; 1 otherwise (2: nothing to measure, or the compiled assets are missing).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, [] as string[][]));
if (!fs.existsSync(path.join(ROOT, 'assets', 'site-planting.js'))) { console.error('assets/site-planting.js is missing: pnpm run build first'); process.exit(2); }
const P = await import(path.join(ROOT, 'assets', 'site-planting.js'));
const G = await import(path.join(ROOT, 'assets', 'site-geom.js'));
const HG = await import(path.join(ROOT, 'assets', 'house-geometry.js'));

const FIX = path.join(ROOT, 'test', 'fixtures', 'houses'), HOUSES = path.join(ROOT, 'content', 'houses');
const files: string[] = args.house
  ? args.house.split(',').map(id => fs.existsSync(path.join(FIX, `${id}.json`)) ? path.join(FIX, `${id}.json`) : path.join(HOUSES, `${id}.json`))
  : fs.readdirSync(FIX).filter(f => /^s4-site-.+\.json$/.test(f)).sort().map(f => path.join(FIX, f));
if (!files.length) { console.error('no S4 fixtures (test/fixtures/houses/s4-site-*.json)'); process.exit(2); }

const T = { axis: 0.2, bare: 0.1, classes: 3, facade: 0.8 };
// the share of the named facade (the ground storey's perimeter on those sides, less each door's leaf and a metre each side)
// that a bed of the planting covers, 0.4 m out from the wall
function facadeCover(spec: any, s: any, plan: any, ctx: any, index: number): number | null {
  const along = typeof s.along === 'string' && s.along.startsWith('facade:') ? s.along.slice(7) : 'S';
  const sides = along === 'all' ? ['S', 'N', 'E', 'W'] : along.split(',').map((x: string) => x.trim().toUpperCase());
  const lv = (spec.levels || []).filter((l: any) => (l.y || 0) <= 0.001), rects = lv.flatMap((l: any) => l.footprint || []);
  if (!rects.length) return null;
  const doors = lv.flatMap((l: any) => (l.openings || []).filter((o: any) => ['door', 'slider', 'garage', 'glass'].includes(o.type) && (o.type !== 'glass' || (o.sill ?? 0) < 0.3)).map((o: any) => ({ side: o.side, lo: o.at - o.w / 2 - 0.9, hi: o.at + o.w / 2 + 0.9 })));
  const nOut: Record<string, number[]> = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
  let total = 0, cov = 0;
  for (const e of HG.perimeterEdges(rects)) {
    if (!sides.includes(e.side)) continue;
    const n = nOut[e.side], len = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
    // the samples along this edge a bed could take, in runs (the generator drops a run under 1.6 m: a bed that short is a smudge)
    let run: boolean[] = [];
    const flush = () => { if (run.length * 0.1 >= 1.6) { total += run.length; cov += run.filter(Boolean).length; } run = []; };
    for (let t = 0.05; t < len; t += 0.1) {
      const px = e.a[0] + (e.b[0] - e.a[0]) * t / len, pz = e.a[1] + (e.b[1] - e.a[1]) * t / len, u = e.side === 'S' || e.side === 'N' ? px : pz;
      const qx = px + n[0] * 0.4, qz = pz + n[1] * 0.4;
      // a door (its leaf and a metre each side), or a walk, porch, step, patio or pool (the generator keeps 0.15 m off them)
      const blocked = doors.some((d: any) => d.side === e.side && u > d.lo && u < d.hi) || ctx.hard.some((h: any) => h.i !== index && (G.inPoly(qx, qz, h.poly) || G.lineDist(qx, qz, h.poly, true) < 0.15));
      if (blocked) { flush(); continue; }
      run.push(plan.beds.some((b: any) => G.inPoly(qx, qz, b.poly)));
    }
    flush();
  }
  return total ? cov / total : null;
}
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
    const facade = s.kind === 'foundation' ? facadeCover(spec, s, a, ctx, i) : null;
    const clash = a.plants.filter(p => ctx.houseGap(p.x, p.z) - 0.12 < p.r - 1e-6).length;
    houseClash += clash;
    const formal = a.mix === 'formal', layered = (s.layers ?? 3) >= 3 && a.beds.length > 0;
    const okFacade = facade === null || facade >= T.facade, okBare = bare === null || formal || bare <= T.bare, okClasses = !layered || formal || classes.every(c => c >= T.classes), okDet = same, okClash = clash === 0;
    if (!(okBare && okClasses && okDet && okClash && okFacade)) fails++;
    rows.push({ i, kind: s.kind || 'border', mix: a.mix, beds: a.beds.length, plants: a.plants.length + a.trees.length, bare, classes, clash, facade, hash: hash(a), ok: okBare && okClasses && okDet && okClash && okFacade });
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
    for (const x of r.rows) console.log(`    ${x.ok ? '✓' : '✗'} site[${x.i}] planting ${x.kind} · ${x.mix}: ${x.beds} beds, ${x.plants} plants, bare mulch ${x.bare === null ? '—' : (x.bare * 100).toFixed(1) + ' %'}${x.mix === 'formal' ? ' (formal: not judged)' : ''}, height classes ${x.classes.length ? x.classes.join('/') : '—'}${x.facade === null ? '' : `, facade ${(x.facade * 100).toFixed(0)} % covered`}${x.clash ? `, ${x.clash} reaching into the house` : ''}  [${x.hash}]`);
  }
  console.log(`\n${share <= T.axis ? '✓' : '✗'} axis-aligned bed, planting and path edges over ${report.length} lot(s): ${(share * 100).toFixed(1)} % of ${allLen.toFixed(0)} m (target ≤ ${T.axis * 100} %)`);
  console.log(fails ? `${fails} failed` : 'all targets hold');
}
process.exit(fails ? 1 : 0);
