#!/usr/bin/env -S node --experimental-strip-types
// S4's landscape metrics, measured in Node on exactly what the builder lays out (assets/site-planting.ts, the planting
// generator; assets/site-geom.ts, the curves) — no browser, deterministic:
// @check-house quick
//
//   node --experimental-strip-types scripts/test-site.mts [--house id,…] [--json]      (any cwd; run `pnpm run build` first)
//
// For every S4 fixture (test/fixtures/houses/s4-site-*.json), or the houses named:
//   axis-aligned   the share of bed, planting and path edges (by length) that runs straight along the x or z axis, as
//                  an eye judges it — 1.5 m chords within 3° of an axis that are also straight (assets/site-geom.ts
//                  axisAlignedRuns; not 1° between the 0.25 m samples a curve is resampled to, which a centimetre of
//                  wobble beats) — target ≤ 20 % over ALL the fixtures AND over the six lots built on real houses
//                  (`s4-site-lot-*`) alone: the real layouts are the ones that matter, and the synthetic region lots
//                  must not carry them
//   bare mulch     each planting's share of its beds that no plant hides, seen from above — each plant hides its
//                  measured silhouette (assets/site-species-masks.ts), not the disc of its crown: a grass tuft hides
//                  5 % of its disc — target ≤ 10 %, or the mix's own (a formal bed shows gravel, a desert bed sand:
//                  its `bare` + 6.5 points); the drip strip along a wall and the 0.16 m along the lot line not counted
//   layers         height classes in each bed of a three-layer planting: under 0.45 m, to 1.1 m, over — target 3 — and
//                  in a bed 4 m long or more at least 0.3 plants over 1.1 m and 0.3 to 1.1 m for every metre of its run
//                  (a token plant of each height is not a layered bed)
//   in the house   no plant whose crown reaches into the ground storey (it must stop at its walls)
//   on the lot     no plant or bed reaches past the lot line (the pavement starts there)
//   determinism    every planting laid out twice is the same, number for number
//   variety        a bed of 20 plants or more (not a formal mix) holds at least 4 species, no one of them over 45 % of
//                  the plants (30 or more of them), and another `seed` lays the SAME outline out with other plants
//   facade cover   a foundation planting's beds over the facade it names, outside the metre kept clear each side of a
//                  door — target ≥ 80 % (sampled every 0.1 m, 0.4 m out from the wall)
//   triangles      a planting's plants cost under 900 000 triangles (assets/site-species-masks.ts, measured per species)
//   species        (over every fixture) every planting species is planted, or stands as a tree, shrub or flower, in some fixture
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

const T = { axis: 0.2, bare: 0.1, bareSlack: 0.065, classes: 3, tallPerM: 0.3, midPerM: 0.3, facade: 0.8, species: 4, top: 0.45, tris: 900_000 };
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
const hash = (x: unknown) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 12);
let fails = 0;
// ---- the axis-aligned measure itself: a centimetre of wobble does not hide a straight edge, a curve is not one
{
  const line = (f: (x: number) => number, dx = 0.25) => Array.from({ length: Math.round(12 / dx) + 1 }, (_, i) => [i * dx, f(i * dx)] as [number, number]);
  const share = (pts: Array<[number, number]>) => { const r = G.axisAlignedRuns(pts, false); return r.axis / r.total; };
  const wobble = share(line(x => 0.015 * Math.sin(x * 17.3))), fine = (() => { const r = G.axisAligned(G.segmentsOf(line(x => 0.015 * Math.sin(x * 17.3)), false), 1); return r.axis / r.total; })();
  const curve = share(line(x => 0.4 * Math.sin(x * 2 * Math.PI / 3.4))), diag = share(line(x => x));
  const checks: Array<[boolean, string]> = [
    [wobble > 0.95, `a 12 m straight edge with a centimetre of wobble reads ${(wobble * 100).toFixed(0)} % axis-aligned (must read 100: the 1° per-segment measure reads ${(fine * 100).toFixed(0)} %)`],
    [curve < 0.25, `a sine (0.4 m over 3.4 m) reads ${(curve * 100).toFixed(0)} % axis-aligned (must read under 25)`],
    [diag === 0, `a 45° line reads ${(diag * 100).toFixed(0)} % axis-aligned (must read 0)`],
  ];
  // `meander` bends a two-point path (which `smooth` cannot): its ends stay, and it reads as a curve
  const mctx = P.createSiteContext({ id: 'measure', levels: [], site: [] }), mp = { type: 'path', path: [[0, 0], [0, 12]], w: 1.2, meander: 0.5 }, ml = mctx.pathLine(mp);
  const mshare = share(ml.map((q: number[]) => [q[1], q[0]] as [number, number]));
  checks.push([Math.hypot(ml[0][0], ml[0][1]) < 1e-6 && Math.hypot(ml[ml.length - 1][0], ml[ml.length - 1][1] - 12) < 1e-6, 'a meandering path does not keep its ends']);
  checks.push([mshare < 0.35 && Math.max(...ml.map((q: number[]) => Math.abs(q[0]))) > 0.3, `a two-point path with meander 0.5 reads ${(mshare * 100).toFixed(0)} % axis-aligned (must read under 35)`]);
  for (const [ok, msg] of checks) if (!ok) { fails++; console.log(`✗ measure: ${msg}`); }
}
const totals = { all: { axis: 0, len: 0 }, real: { axis: 0, len: 0 } };
const report: any[] = [];
const used = new Set<string>();   // every species some fixture shows
for (const file of files) {
  const spec = JSON.parse(fs.readFileSync(file, 'utf8')), ctx = P.createSiteContext(spec), site = spec.site || [];
  const rows: any[] = [];
  const axis = { axis: 0, total: 0 };
  const edge = (pts: number[][], closed: boolean, wall: boolean[] | null) => { const r = G.axisAlignedRuns(pts, closed, wall); axis.axis += r.axis; axis.total += r.total; };
  let houseClash = 0, lotOver = 0;
  for (const [i, s] of site.entries()) {
    if (s.type === 'bed' && (Array.isArray(s.poly) || Array.isArray(s.at))) {
      const p0 = s.poly || [[s.at[0] - (s.w || 2) / 2, s.at[1] - (s.d || 1) / 2], [s.at[0] + (s.w || 2) / 2, s.at[1] - (s.d || 1) / 2], [s.at[0] + (s.w || 2) / 2, s.at[1] + (s.d || 1) / 2], [s.at[0] - (s.w || 2) / 2, s.at[1] + (s.d || 1) / 2]];
      const t = G.tensionOf(s.smooth); edge(t === null ? p0 : G.smoothLoop(p0, t, 0.25), true, null);
    }
    if (s.type === 'path' && Array.isArray(s.path) && !(s.y > 0.3)) edge(ctx.pathLine(s), false, null);   // (a raised `path` is a trim on a facade, not a garden path)
    if (s.type === 'tree' && s.species) used.add(s.species === 'round' ? 'broad' : s.species);
    if (s.type === 'shrub' && s.form) used.add(s.form);
    if (s.type === 'flowers' && s.kind) used.add(s.kind);
    if (s.type !== 'planting') continue;
    const a = P.planPlanting(s, i, ctx), b = P.planPlanting(s, i, ctx);
    for (const p of [...a.plants, ...a.trees]) used.add(p.sp);
    const same = hash(a) === hash(b);
    for (const bd of a.beds) edge(bd.poly, true, bd.wall);
    const bare = a.beds.some((bd: any) => bd.soil) ? P.bareShare(a, ctx, 0.05, i) : null;
    const classes = P.heightClasses(a), density = P.layerDensity(a);
    const species = new Set([...a.plants, ...a.trees].map((p: any) => p.sp)).size, all = a.plants.length + a.trees.length;
    // another seed: the same beds, other plants
    const other = P.planPlanting({ ...s, seed: 'another' }, i, ctx);
    const okSeed = hash(other) !== hash(a) && hash(other.beds) === hash(a.beds);
    const facade = s.kind === 'foundation' ? facadeCover(spec, s, a, ctx, i) : null;
    // a crown into the house: a plant whose reach passes the wall line (the walls stand 0.12 m proud of the footprint)
    const clash = a.plants.filter((p: any) => ctx.houseGap(p.x, p.z) - 0.12 < p.r - 1e-6).length;
    houseClash += clash;
    // past the lot line: a plant's crown, a bed's corner (2 cm of rounding allowed)
    const over = a.plants.filter((p: any) => ctx.lotRoom(p.x, p.z) < p.r - 1e-3).length + a.beds.reduce((n: number, bd: any) => n + bd.poly.filter((q: number[]) => ctx.lotRoom(q[0], q[1]) < -0.02).length, 0);
    lotOver += over;
    const formal = a.mix === 'formal', layered = (s.layers ?? 3) >= 3 && a.beds.length > 0;
    const counts = new Map<string, number>(); for (const p of [...a.plants, ...a.trees]) counts.set(p.sp, (counts.get(p.sp) || 0) + 1);
    const topShare = all ? Math.max(0, ...counts.values()) / all : 0;
    const tris = P.plantingTriangles(a);
    const okVariety = all < 20 || formal || species >= T.species, okTop = all < 30 || formal || topShare <= T.top;
    const okFacade = facade === null || facade >= T.facade, okBare = bare === null || bare <= Math.max(T.bare, a.bareTarget + T.bareSlack);
    const okClasses = !layered || formal || classes.every((c: number) => c >= T.classes);
    const okLayers = !layered || formal || density.every((d: any) => d.run < 4 || (d.tall / d.run >= T.tallPerM && d.mid / d.run >= T.midPerM));
    const okDet = same, okClash = clash === 0, okLot = over === 0, okTris = tris <= T.tris;
    const ok = okBare && okClasses && okLayers && okDet && okClash && okFacade && okVariety && okTop && okSeed && okLot && okTris;
    if (!ok) fails++;
    const why = [!okBare && 'bare', !okClasses && 'classes', !okLayers && 'layers', !okDet && 'nondeterministic', !okClash && 'in the house', !okFacade && 'facade', !okVariety && 'variety', !okTop && 'one species', !okSeed && 'seed', !okLot && 'off the lot', !okTris && 'triangles'].filter(Boolean).join(', ');
    rows.push({ i, kind: s.kind || 'border', mix: a.mix, beds: a.beds.length, plants: all, bare, classes, layers: density.filter((d: any) => d.run >= 4).map((d: any) => `${(d.tall / d.run).toFixed(1)}/${(d.mid / d.run).toFixed(1)}`).join(' '), top: `${[...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? '—'} ${(topShare * 100).toFixed(0)} %`, clash, over, facade, species, seed: okSeed, tris, hash: hash(a), ok, why });
  }
  const isLot = /s4-site-lot-/.test(path.basename(file));
  totals.all.axis += axis.axis; totals.all.len += axis.total;
  if (isLot) { totals.real.axis += axis.axis; totals.real.len += axis.total; }
  report.push({ id: spec.id, axis: axis.total ? axis.axis / axis.total : 0, len: axis.total, rows, houseClash, lotOver });
}
const share = totals.all.len ? totals.all.axis / totals.all.len : 0, realShare = totals.real.len ? totals.real.axis / totals.real.len : null;
if (share > T.axis) fails++;
if (realShare !== null && realShare > T.axis) fails++;
const unused = args.house ? [] : Object.keys(P.SPECIES).filter(k => !used.has(k));
if (unused.length) fails++;
if (args.json === 'true') console.log(JSON.stringify({ share, realShare, report }, null, 1));
else {
  for (const r of report) {
    console.log(`${r.rows.every((x: any) => x.ok) ? '✓' : '✗'} ${r.id}: edges ${r.len.toFixed(1)} m, ${(r.axis * 100).toFixed(0)} % axis-aligned`);
    for (const x of r.rows) console.log(`    ${x.ok ? '✓' : '✗'} site[${x.i}] planting ${x.kind} · ${x.mix}: ${x.beds} beds, ${x.plants} plants (${(x.tris / 1000).toFixed(0)}k tris), bare mulch ${x.bare === null ? '—' : (x.bare * 100).toFixed(1) + ' %'}${x.mix === 'formal' ? ' (formal: gravel is the design)' : ''}, height classes ${x.classes.length ? x.classes.join('/') : '—'}${x.layers ? ` (tall/mid per m ${x.layers})` : ''}${x.facade === null ? '' : `, facade ${(x.facade * 100).toFixed(0)} % covered`}, ${x.species} species (${x.top})${x.seed ? '' : ', the seed changes the beds or nothing'}${x.clash ? `, ${x.clash} reaching into the house` : ''}${x.over ? `, ${x.over} past the lot line` : ''}  [${x.hash}]${x.ok ? '' : `  ← ${x.why}`}`);
  }
  console.log(`\n${share <= T.axis ? '✓' : '✗'} axis-aligned bed, planting and path edges over ${report.length} lot(s): ${(share * 100).toFixed(1)} % of ${totals.all.len.toFixed(0)} m (target ≤ ${T.axis * 100} %)`);
  if (realShare !== null) console.log(`${realShare <= T.axis ? '✓' : '✗'}   … over the lots built on real houses alone: ${(realShare * 100).toFixed(1)} % of ${totals.real.len.toFixed(0)} m (target ≤ ${T.axis * 100} %)`);
  if (unused.length) console.log(`✗ species no fixture shows: ${unused.join(', ')}`);
  console.log(fails ? `${fails} failed` : 'all targets hold');
}
process.exit(fails ? 1 : 0);
