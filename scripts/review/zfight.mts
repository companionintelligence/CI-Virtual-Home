#!/usr/bin/env -S node --experimental-strip-types
// Z-fighting detector: finds two surfaces drawn at (nearly) the same depth by EXPERIMENT, names them, and cross-checks the finding against
// the geometry. Two surfaces at the same depth quantise differently under a different depth-buffer mapping, so one frame drawn twice with a
// different near / far plane is the same picture except where the depth test is a coin toss.
//
//   node --experimental-strip-types scripts/review/zfight.mts --house aurora[,seraphine] [--out dir] [--gl default|software]
//        [--only rooms,orbit,track,overview] [--corners NW,SE] [--max-spots N] [--near 0.2] [--room-near 0.05] [--far 160]
//        [--res 720] [--thr 10] [--images 6] [--no-geom] [--selftest]
//   needs the repo built (pnpm run build) and Chromium: PLAYWRIGHT_BROWSERS_PATH=<dir> where Playwright's pinned build is missing.
//
// Per camera spot (the rig's corner cameras of every room at 1.5 m eye height via cornerCam, n samples of the orbit shot and of the
// door-to-core shot, four cutaway overviews) the page renders, with the camera fixed and nothing else changed:
//   beauty   the composer path the goldens use, at depth setting A and B   (what a viewer would see flip, and by how much)
//   ID pass  every mesh as one flat colour with its own depth state, no lights / fog / antialiasing, at settings A, B and C
// A pixel is a candidate when its mesh id differs between the settings; the two ids are the two surfaces that meet there. Candidates are
// grouped by (meshA, meshB), counted, and measured: the gap along a few of their pixel rays against the depth buffer's quantum at that
// distance. `vis` counts the candidate pixels where the beauty frames differ by more than --thr (a flip between two surfaces of one
// colour is a candidate and not a flicker). Output: <out>/zfight/<house>.json, spot contact images <out>/zfight/<house>/*.png for the
// worst, and a ranked table on stdout.
//
// Thresholds and why: far x0.94 and x1.07 (the mapping z_ndc = f/(f-n) (1 - n/z) moves by about n/f of full scale, a million 24-bit steps, so every tie is
// re-rolled, while x, y and the near plane do not move); a pixel is a candidate at any id difference (the ID pass has no antialiasing and no tone, so there is
// no noise floor to cut); `vis` needs 10/255 in some channel (--thr; GTAO and the grade move the beauty frames by less); near 0.2 and far 160 are the page's
// persCamera, 0.05 the rig's corner cameras (--near, --room-near); the coplanar mode takes planes within 2 mm, normals within 1.1 degrees, and overlaps of 1 cm2. --geom (default on) also finds coplanar overlap geometrically (scripts/review/geom-lib.mts
// coplanarPairs: triangle planes within 2 mm, same facing, overlapping extents) and marks which side saw the other.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUT_DEFAULT, clearImages, parseArgs, writeJson, writePng, label, classOf, pairScope, decodeF32, decodeIdx, fmtSec, round, type MeshInfo } from './geom-report.mts';
import { startGeoSession, type GeoPage } from './geom-page.mts';
import { cornerCam, type Corner } from './cameras.mts';
import { roomsOf } from './page.mts';
import { coplanarPairs, flickerBeyond, boxHull, meshHull, inside, type Hull, type SoupMesh, type CoplanarPair } from './geom-lib.mts';

// the depth settings of the experiment: A is the camera as the product has it, B and C move the far plane (a different quantisation of every
// depth in the frame: z_ndc = f/(f-n) (1 - n/z) shifts by about n/f of full scale, a million depth steps) without moving one pixel of the
// geometry (x and y of the projection do not depend on near or far) and without moving the near plane, so a prop a few centimetres from the
// camera is clipped the same way in every setting
export const PERTURB = [{ kn: 1, kf: 1 }, { kn: 1, kf: 0.94 }, { kn: 1, kf: 1.07 }];

export interface Spot { key: string; kind: 'room' | 'orbit' | 'track' | 'overview'; room?: string; level?: string; cam: { pos: number[]; target: number[]; fov: number }; near: number; far: number; dressing: { walls: string; roof: string } }
export interface Opts { near: number; roomNear: number; far: number; res: string; thr: number; only: Set<string>; corners: Corner[]; maxSpots: number; images: number; geom: boolean; tod: string; top: number }

export async function buildSpots(h: GeoPage, o: Opts): Promise<Spot[]> {
  const spots: Spot[] = [];
  if (o.only.has('rooms')) {
    for (const r of await roomsOf(h.page)) {
      if (r.program === 'outdoor' || r.b.w * r.b.d < 2.2 || r.b.w < 1.1 || r.b.d < 1.1) continue;
      for (const c of o.corners) {
        const cam = cornerCam(r.b, r.y, c);
        spots.push({ key: `room/${r.lv}/${r.name}/${c}`, kind: 'room', room: r.name, level: r.lv, cam: { pos: cam.pos, target: cam.target, fov: cam.fov }, near: o.roomNear, far: o.far, dressing: { walls: 'up', roof: 'on' } });
      }
    }
  }
  const track = async (shot: string, n: number, kind: 'orbit' | 'track') => {
    let samples: any[] = [];
    try { samples = await h.page.evaluate(([s, k]: [string, number]) => (window as any).__geo.trackSamples(s, k), [shot, n] as [string, number]); } catch (e: any) { console.error(`  (no ${shot} track: ${String(e.message).split('\n')[0]})`); }
    for (const s of samples) spots.push({ key: `${kind}/${shot}/${String(s.k).padStart(2, '0')}@${s.t}`, kind, cam: { pos: s.pos, target: s.target, fov: s.fov }, near: o.near, far: o.far, dressing: { walls: 'up', roof: s.roof > 0.5 ? 'on' : 'off' } });
  };
  if (o.only.has('orbit')) await track('orbit', 12, 'orbit');
  if (o.only.has('track')) await track('door-to-core', 14, 'track');
  if (o.only.has('overview')) {
    const cams: any[] = await h.page.evaluate(() => (window as any).__geo.overviewCams());
    for (const c of cams) spots.push({ key: `overview/cutaway/${c.az}`, kind: 'overview', cam: { pos: c.pos, target: c.target, fov: c.fov }, near: o.near, far: o.far, dressing: { walls: 'cutaway', roof: 'off' } });
  }
  return o.maxSpots > 0 ? spots.slice(0, o.maxSpots) : spots;
}

const cfgOf = (s: Spot, o: Opts, extra: any = {}) => ({ cam: s.cam, near: s.near, far: s.far, perturb: PERTURB, dressing: s.dressing, res: o.res, thr: o.thr, top: o.top, rays: 10, ...extra });

export interface PairRow {
  a: number; b: number; a_label: string; b_label: string; classA: string; classB: string; scope: string;
  pixels: number; visible: number; spots: number; worstSpot: string; worstSpotVisible: number;
  gap_mm: number | null; perp_mm: number | null; quantum_mm: number | null; dist_m: number | null; ndot: number | null; normal: number[] | null; at: number[] | null;
  verdict: string; geom: { area_m2: number; gap_mm: number } | null; samples: any[]; colour_delta_pct: number | null; score: number;
  a_info?: any; b_info?: any;
}
/** what the report says about one mesh of a pair: its class (userData role, item type, room, storey), the chain of groups it hangs in, its materials, where it is */
const infoOf = (m?: MeshInfo) => m ? ({ id: m.id, role: m.role, itemType: m.itemType, room: m.room, level: m.level, top: m.top, chain: m.chain, geometry: m.geom, size: m.size, materials: m.mats.map(x => `${x.n || '(unnamed)'} ${x.t} #${x.c ?? '-'}${x.tr ? ' transparent' : ''}${x.po ? ' polygonOffset' : ''}`), at: m.at, unit: m.unit, wallPart: m.wallPart }) : null;

/** how different the two meshes' base colours are, as a percent of full scale (the largest channel difference of the first material of each) */
function colourDelta(a?: MeshInfo, b?: MeshInfo): number | null {
  const ca = a?.mats?.[0]?.c, cb = b?.mats?.[0]?.c;
  if (!ca || !cb) return null;
  const d = [0, 2, 4].map(i => Math.abs(parseInt(ca.slice(i, i + 2), 16) - parseInt(cb.slice(i, i + 2), 16)));
  return round((Math.max(...d) / 255) * 100, 1);
}

/** Run the experiment over the spots of one open house. */
export async function runExperiment(h: GeoPage, spots: Spot[], o: Opts, log: (s: string) => void = () => {}) {
  const reg: MeshInfo[] = await h.page.evaluate(() => (window as any).__geo.registry());
  const rows = new Map<string, PairRow>(), perSpot: any[] = [];
  // a throwaway frame first: the first frame after a load or a scene change is a hair different (cold shaders, the shadow map), and it would
  // read as a depth-setting difference on the first spot
  if (spots.length) await h.page.evaluate((cfg: any) => (window as any).__geo.captureSpot(cfg), cfgOf(spots[0], o, { top: 0, rays: 0 }));
  let i = 0;
  for (const s of spots) {
    const t0 = Date.now();
    const r = await h.page.evaluate((cfg: any) => (window as any).__geo.captureSpot(cfg), cfgOf(s, o));
    perSpot.push({ key: s.key, kind: s.kind, flagged: r.flagged, bdiff: r.bdiff, unexplained: r.bdiffUnexplained, pairs: r.nPairs, cam: s.cam, near: s.near, far: s.far, dressing: s.dressing, ms: Date.now() - t0,
      top: r.pairs.slice(0, 8).map((p: any) => ({ a: p.a, b: p.b, pixels: p.count, visible: p.vis, bbox: p.bbox, a_label: p.a ? label(reg[p.a - 1]) : '(background)', b_label: label(reg[p.b - 1]) })) });
    for (const p of r.pairs) {
      const A = reg[p.a - 1], B = reg[p.b - 1], k = `${p.a}:${p.b}`;
      let row = rows.get(k);
      if (!row) rows.set(k, row = { a: p.a, b: p.b, a_label: p.a ? label(A) : '(background)', b_label: label(B), classA: classOf(A), classB: classOf(B), scope: p.a ? pairScope(A, B) : 'crack', pixels: 0, visible: 0, spots: 0, worstSpot: s.key, worstSpotVisible: -1, gap_mm: null, perp_mm: null, quantum_mm: null, dist_m: null, ndot: null, normal: null, at: null, verdict: '', geom: null, samples: [], colour_delta_pct: null, score: 0 });
      row.pixels += p.count; row.visible += p.vis; row.spots++;
      if (p.vis > row.worstSpotVisible || (p.vis === row.worstSpotVisible && p.count > 0 && row.samples.length === 0)) { row.worstSpot = s.key; row.worstSpotVisible = p.vis; }
      for (const m of p.samples) if (m.gap !== undefined && row.samples.length < 6 && (row.worstSpot === s.key)) row.samples.push({ spot: s.key, ...m });
    }
    log(`  ${String(++i).padStart(3)}/${spots.length} ${s.key.padEnd(46)} flagged ${String(r.flagged).padStart(6)}  beauty diff ${String(r.bdiff).padStart(5)}  pairs ${String(r.nPairs).padStart(3)}  ${Date.now() - t0} ms`);
  }
  // measurements: from each pair's own samples at its worst spot
  for (const row of rows.values()) {
    const m = row.samples.filter(x => x.gap !== undefined);
    if (m.length) {
      const g = [...m].sort((p, q) => p.perp - q.perp)[Math.floor(m.length / 2)];
      row.gap_mm = round(g.gap * 1000, 4); row.perp_mm = round(g.perp * 1000, 4); row.quantum_mm = round(g.quantum * 1000, 4); row.dist_m = round(((g.tA ?? 0) + (g.tB ?? 0)) / 2, 2); row.ndot = g.ndot ?? null; row.normal = g.nA ?? null; row.at = g.pA ?? g.pB ?? null;
    }
    row.a_info = infoOf(reg[row.a - 1]); row.b_info = infoOf(reg[row.b - 1]);
    row.colour_delta_pct = colourDelta(reg[row.a - 1], reg[row.b - 1]);
    row.score = round(row.visible + row.pixels * ((row.colour_delta_pct ?? 100) >= 6 ? 0.25 : 0.02), 1);
    row.verdict = row.perp_mm === null ? 'unmeasured' : row.perp_mm <= 0.01 ? 'coplanar' : row.perp_mm <= (row.quantum_mm ?? 0) * 3 ? 'inside the depth quantum' : 'gap above the quantum: a rasteriser tie (an edge, a seam)';
  }
  const order = [...rows.values()].sort((p, q) => q.score - p.score || q.pixels - p.pixels || p.a - q.a || p.b - q.b);
  return { reg, rows: order, perSpot };
}

/** The visible meshes of the house as a triangle soup, and a lazy convex hull of each (for the buried test). */
async function extractSoup(h: GeoPage, dressing = { walls: 'up', roof: 'on' }) {
  const ex = await h.page.evaluate((d: any) => (window as any).__geo.extract({ tris: true, dressing: d }), dressing);
  const soup: SoupMesh[] = [], recs = new Map<number, any>();
  for (const m of ex.meshes) {
    if (!m.pos) continue;
    const pos = decodeF32(m.pos), index = m.idx ? decodeIdx(m.idx, m.idxBits) : null;
    const sides: number[] = m.sides || [0];
    soup.push({ id: m.id, pos, index, side: (sides.includes(2) ? 2 : sides.every((v: number) => v === 1) ? 1 : 0) as 0 | 1 | 2, resolved: !!m.po });
    recs.set(m.id, { ...m, posF: pos });
  }
  return { soup, recs };
}
/** A coplanar overlap is only a fight where it can be seen: a point 4 mm off the surface, on the side it shows to, inside another solid
 *  means it is buried (the underside of a wall in the floor slab, the back of a board in a wall). */
export function buriedPairs(pairs: CoplanarPair[], recs: Map<number, any>): Set<string> {
  const hulls = new Map<number, Hull | null>();
  const hullOf = (id: number): Hull | null => {
    if (hulls.has(id)) return hulls.get(id)!;
    const r = recs.get(id); let hl: Hull | null = null;
    if (r) hl = r.box ? boxHull(r.box.m, r.box.h, r.box.c) : meshHull(r.posF);
    hulls.set(id, hl); return hl;
  };
  const ids = [...recs.keys()];
  const out = new Set<string>();
  for (const p of pairs) {
    const sides = p.opposed ? [1, -1] : [1];
    let hidden = true;
    for (const sg of sides) {
      const q = [p.at[0] + p.normal[0] * 0.004 * sg, p.at[1] + p.normal[1] * 0.004 * sg, p.at[2] + p.normal[2] * 0.004 * sg];
      let inSolid = false;
      for (const id of ids) {
        if (id === p.a || id === p.b) continue;
        const h = hullOf(id); if (!h || h.flat) continue;
        if (q[0] < h.min[0] || q[0] > h.max[0] || q[1] < h.min[1] || q[1] > h.max[1] || q[2] < h.min[2] || q[2] > h.max[2]) continue;
        if (inside(h, q)) { inSolid = true; break; }
      }
      if (!inSolid) hidden = false;
    }
    if (hidden) out.add(`${p.a}:${p.b}`);
  }
  return out;
}

/** The geometric cross-check: every pair of visible meshes with triangles within 2 mm of one plane, facing the same way, overlapping, and not buried. */
export async function runGeom(h: GeoPage, reg: MeshInfo[], o: Opts) {
  const { soup, recs } = await extractSoup(h);
  const pairs = coplanarPairs(soup, { tol: 0.002, minArea: 1e-4 });
  const buried = buriedPairs(pairs, recs);
  const resolved = new Map(soup.map(s => [s.id, !!s.resolved]));
  const rows = pairs.map(p => {
    const A = reg[p.a - 1], B = reg[p.b - 1];
    const gap = p.gapMax;
    return {
      a: p.a, b: p.b, a_label: label(A), b_label: label(B), classA: classOf(A), classB: classOf(B), scope: pairScope(A, B),
      area_m2: round(p.area, 5), tri_pairs: p.tris, gap_mm: round(gap * 1000, 4), gap_min_mm: round(p.gapMin * 1000, 4), at: p.at.map(v => round(v, 3)), normal: p.normal.map(v => round(v, 3)), opposed: p.opposed,
      buried: buried.has(`${p.a}:${p.b}`),
      resolved_by: resolved.get(p.a) || resolved.get(p.b) ? 'polygonOffset' : null,
      fights_beyond_m_near02: round(flickerBeyond(gap, 0.2, o.far), 1), fights_beyond_m_near005: round(flickerBeyond(gap, 0.05, o.far), 1),
    };
  });
  return rows;
}

async function runHouse(sess: any, house: string, args: Record<string, string>, o: Opts, outDir: string) {
  const t0 = Date.now();
  console.log(`\n== ${house}`);
  clearImages(path.join(outDir, house), 'zfight');
  const h: GeoPage = await sess.open(house, { res: o.res, tod: o.tod });
  const tOpen = Date.now() - t0;
  try {
    const spots = await buildSpots(h, o);
    console.log(`  ${spots.length} camera spots (${['room', 'orbit', 'track', 'overview'].map(k => `${spots.filter(s => s.kind === k).length} ${k}`).join(', ')}), depth settings ${PERTURB.map(p => `near x${p.kn} far x${p.kf}`).join(' | ')}`);
    const t1 = Date.now();
    const ex = await runExperiment(h, spots, o, s => process.stdout.write(s + '\n'));
    const tExp = Date.now() - t1;
    let geom: any[] = [], tGeom = 0, geomHidden = 0;
    if (o.geom) {
      const t2 = Date.now(); geom = await runGeom(h, ex.reg, o); tGeom = Date.now() - t2;
      geomHidden = geom.filter(g => g.buried).length; geom = geom.filter(g => !g.buried);
      // mark each side with what the other found
      const gk = new Map(geom.map(g => [`${g.a}:${g.b}`, g]));
      for (const r of ex.rows) { const g = gk.get(`${r.a}:${r.b}`); if (g) r.geom = { area_m2: g.area_m2, gap_mm: g.gap_mm }; }
      const rk = new Set(ex.rows.map(r => `${r.a}:${r.b}`));
      for (const g of geom) g.seen_in_renders = rk.has(`${g.a}:${g.b}`);
      // the pairs a camera saw first; then those that fight within the distances a camera can have (a 1 mm gap is lost only beyond 58 m); then by area
      const reach = (g: any) => Number(g.fights_beyond_m_near02 <= 40);
      geom.sort((p, q) => Number(q.seen_in_renders) - Number(p.seen_in_renders) || reach(q) - reach(p) || q.area_m2 - p.area_m2);
    }
    // images for the worst spots
    const worst = [...ex.perSpot].filter(s => s.flagged > 0).map(s => ({ s, score: ex.rows.filter(r => r.worstSpot === s.key).reduce((t, r) => t + r.worstSpotVisible, 0) })).sort((p, q) => q.score - p.score || q.s.flagged - p.s.flagged).slice(0, o.images);
    const images: string[] = [];
    for (const { s: ps, score } of worst) {
      const sp = spots.find(x => x.key === ps.key)!;
      const r = await h.page.evaluate((cfg: any) => (window as any).__geo.captureSpot(cfg), cfgOf(sp, o, { image: true, label: `${house}  ${sp.key}  near ${sp.near}  flagged ${ps.flagged}  visible-diff ${score}` }));
      const f = path.join(outDir, house, `zfight-${String(images.length + 1).padStart(2, '0')}-${sp.key.replace(/[^A-Za-z0-9@.]+/g, '_')}.png`);
      writePng(f, r.image); images.push(f);
    }
    const near = ex.rows.filter(r => r.a !== 0);
    const doc = {
      schema: 1, tool: 'zfight', house,
      settings: { near: o.near, roomNear: o.roomNear, far: o.far, res: o.res, thr: o.thr, perturb: PERTURB, tod: o.tod, depthBits: 24, gpu: sess.gpu, chromium: sess.version },
      timing_s: { open: round(tOpen / 1000, 1), experiment: round(tExp / 1000, 1), geom: round(tGeom / 1000, 1), total: round((Date.now() - t0) / 1000, 1) },
      spots: ex.perSpot, pairs: ex.rows.slice(0, 200), pairs_total: ex.rows.length,
      by_class: byClass(ex.rows), geom: geom.slice(0, 300), geom_total: geom.length, geom_seen_in_renders: geom.filter(g => g.seen_in_renders).length, geom_buried_dropped: geomHidden, images, page_errors: h.errors,
      note: near.length ? undefined : 'no candidate pairs',
    };
    const file = path.join(outDir, `${house}.json`);
    writeJson(file, doc);
    report(house, doc, o);
    console.log(`  wrote ${file}\n  ${images.length} images in ${path.join(outDir, house)}\n  time: open ${fmtSec(tOpen / 1000)}, experiment ${fmtSec(tExp / 1000)}, geometry ${fmtSec(tGeom / 1000)}, total ${fmtSec((Date.now() - t0) / 1000)}`);
    return doc;
  } finally { await h.close(); }
}

/** the same two kinds of thing across many meshes: pairs by (class A, class B), summed */
function byClass(rows: PairRow[]) {
  const m = new Map<string, { classA: string; classB: string; scope: string; meshPairs: number; pixels: number; visible: number; example: string }>();
  for (const r of rows) {
    const [x, y] = [r.classA, r.classB].sort(), k = `${x} | ${y}`;
    let e = m.get(k); if (!e) m.set(k, e = { classA: x, classB: y, scope: r.scope, meshPairs: 0, pixels: 0, visible: 0, example: `${r.a_label}  <->  ${r.b_label}` });
    e.meshPairs++; e.pixels += r.pixels; e.visible += r.visible;
  }
  return [...m.values()].sort((p, q) => q.visible - p.visible || q.pixels - p.pixels).slice(0, 60);
}

function report(house: string, doc: any, o: Opts) {
  const flagged = doc.spots.reduce((t: number, s: any) => t + s.flagged, 0), bd = doc.spots.reduce((t: number, s: any) => t + s.bdiff, 0), un = doc.spots.reduce((t: number, s: any) => t + s.unexplained, 0);
  console.log(`  ${doc.spots.length} spots: ${flagged} candidate pixels, ${bd} pixels where the beauty frames differ > ${o.thr}/255 (${un} of them with no id flip: post-process noise, not a depth tie); ${doc.pairs_total} mesh pairs`);
  const show = (title: string, rows: PairRow[]) => {
    if (!rows.length) return;
    console.log(`  ${title}`);
    rows.slice(0, 10).forEach((r, i) => {
      console.log(`   ${String(i + 1).padStart(2)}. vis ${String(r.visible).padStart(5)}  px ${String(r.pixels).padStart(6)}  in ${String(r.spots).padStart(2)} spots  colour delta ${r.colour_delta_pct ?? '?'}%  ${r.verdict}${r.geom ? `  [geom: ${r.geom.area_m2} m2 @ ${r.geom.gap_mm} mm]` : ''}  gap ${r.perp_mm ?? '?'} mm / quantum ${r.quantum_mm ?? '?'} mm @ ${r.dist_m ?? '?'} m`);
      console.log(`        A ${r.a_label}\n        B ${r.b_label}`);
    });
  };
  const bc = doc.by_class.filter((c: any) => c.scope === 'house').slice(0, 10);
  if (bc.length) { console.log('  the same defect across many meshes (house, by kind of pair)'); bc.forEach((c: any, i: number) => console.log(`   ${String(i + 1).padStart(2)}. ${String(c.meshPairs).padStart(3)} pairs  vis ${String(c.visible).padStart(5)}  px ${String(c.pixels).padStart(6)}  ${c.classA}  <->  ${c.classB}`)); }
  show('top house pairs (visible flicker first)', doc.pairs.filter((r: PairRow) => r.scope === 'house'));
  show('top house-vs-site pairs', doc.pairs.filter((r: PairRow) => r.scope === 'house-site'));
  show('top site / world pairs', doc.pairs.filter((r: PairRow) => r.scope === 'site'));
  const g = doc.geom.filter((x: any) => x.scope !== 'site').slice(0, 8);
  if (g.length) { console.log('  top geometric coplanar overlaps (house), area first'); g.forEach((x: any, i: number) => console.log(`   ${String(i + 1).padStart(2)}. ${String(x.area_m2).padStart(8)} m2  gap ${x.gap_mm} mm (fights beyond ${x.fights_beyond_m_near02} m at near 0.2)  ${x.seen_in_renders ? 'SEEN in renders' : 'not seen'}  ${x.resolved_by ? '[' + x.resolved_by + ']' : ''}\n        A ${x.a_label}\n        B ${x.b_label}`)); }
}

// ------------------------------------------------------------------------------------------------------------------------------------
// the self-test: plant a known defect, prove the detector finds it, and that a clean plan does not
// ------------------------------------------------------------------------------------------------------------------------------------
export async function selftest(sess: any, o: Opts): Promise<boolean> {
  let ok = true; const check = (name: string, pass: boolean, detail = '') => { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!pass) ok = false; };
  console.log('\n== zfight self-test');
  // A. the sandbox: a clean room of boxes with no two surfaces in one plane, then the same room with a quad planted on the floor
  const h = await sess.open('aurora', { res: o.res, tod: o.tod });
  try {
    const pg = h.page;
    const cam = { pos: [0, 1.5, -2.8], target: [0, 0.4, 1.5], fov: 60 };
    const spot: Spot = { key: 'sandbox', kind: 'room', cam, near: o.roomNear, far: o.far, dressing: { walls: 'up', roof: 'off' } };
    const build = (planted: boolean) => pg.evaluate((p: boolean) => {
      const g = (window as any).__geo; g.sandboxOn();
      const add = (d: any) => g.sandboxAdd(d);
      add({ kind: 'box', size: [8, 0.2, 8], pos: [0, -0.1, 0], color: 0xb08a5a, name: 'floor', userData: { role: 'floor' } });
      add({ kind: 'box', size: [8, 2.8, 0.16], pos: [0, 1.4, 4.08], color: 0xe8e4dc, name: 'wall', userData: { role: 'wall', isWall: true } });
      add({ kind: 'box', size: [8, 0.09, 0.016], pos: [0, 0.045, 3.992], color: 0xffffff, name: 'baseboard 8 mm proud', userData: { role: 'wall', isWall: true } });
      add({ kind: 'box', size: [2, 0.02, 2], pos: [0, 0.01, 1.5], color: 0x335577, name: 'rug', userData: { role: 'item', itemType: 'area-rug', room: 'S' } });
      add({ kind: 'plane', size: [1.4, 1.0], pos: [-2, 1.5, 3.995], color: 0x884422, name: 'art 5 mm off the wall', userData: { role: 'item', itemType: 'wall-art', room: 'S' } });
      let id: any = null;
      if (p) id = add({ kind: 'plane', size: [1.6, 1.6], rot: [-Math.PI / 2, 0, 0], pos: [1.4, 0, 0.8], color: 0xff2020, name: 'PLANTED coplanar quad on the floor', userData: { role: 'item', itemType: 'planted-quad', room: 'S' } });
      return g.rebuildRegistry();
    }, planted);
    const run = async () => {
      const r = await pg.evaluate((cfg: any) => (window as any).__geo.captureSpot(cfg), cfgOf(spot, o));
      const reg: MeshInfo[] = await pg.evaluate(() => (window as any).__geo.registry());
      return { r, reg };
    };
    await build(false);
    const clean = await run();
    check('clean sandbox room: no candidate pixel', clean.r.flagged === 0, `flagged ${clean.r.flagged}, beauty diff ${clean.r.bdiff}`);
    await pg.evaluate(() => (window as any).__geo.sandboxOff());
    await build(true);
    const dirty = await run();
    const hit = dirty.r.pairs.find((p: any) => /PLANTED/.test(dirty.reg[p.a - 1]?.name || '') || /PLANTED/.test(dirty.reg[p.b - 1]?.name || ''));
    check('planted coplanar quad: found by the render experiment', !!hit && hit.count > 50, hit ? `${hit.count} px, ${hit.vis} visible; ${label(dirty.reg[hit.a - 1])} <-> ${label(dirty.reg[hit.b - 1])}; gap ${hit.samples[0]?.perp ?? '?'} m` : 'not found');
    check('planted quad: it fights the floor', !!hit && [dirty.reg[hit.a - 1], dirty.reg[hit.b - 1]].some(m => m && m.name === 'floor'));
    check('planted quad: nothing else flagged (baseboard 8 mm, art 5 mm are stable)', dirty.r.pairs.every((p: any) => p === hit || p.count < 4), `other pairs: ${dirty.r.pairs.filter((p: any) => p !== hit).map((p: any) => `${p.count}px`).join(',') || 'none'}`);
    const gd = await runGeomOn(pg, o);
    check('planted coplanar quad: found by the geometric mode', gd.some((p: any) => p.names.includes('PLANTED') && p.names.includes('floor')), `${gd.length} pair(s): ${gd.map((p: any) => `${p.names} ${p.area}m2 gap ${p.gap}mm`).join('; ')}`);
    await pg.evaluate(() => (window as any).__geo.sandboxOff());
    await build(false);
    const gc = await runGeomOn(pg, o);
    check('clean sandbox room: no coplanar pair', gc.length === 0, `${gc.length} found`);
    await pg.evaluate(() => (window as any).__geo.sandboxOff());
    // B. the real plan (one throwaway frame first: the first frame after the scene was put back is a hair different): aurora's living room with a quad planted on its floor, then the same spots without it
    const rooms = await roomsOf(pg);
    const lr = rooms.find(r => /Living/.test(r.name))!;
    const cc = cornerCam(lr.b, lr.y, 'NW'), sp2: Spot = { key: 'living/NW', kind: 'room', cam: { pos: cc.pos, target: cc.target, fov: cc.fov }, near: o.roomNear, far: o.far, dressing: { walls: 'up', roof: 'on' } };
    await pg.evaluate((cfg: any) => (window as any).__geo.captureSpot(cfg), cfgOf(sp2, o, { top: 0, rays: 0 }));
    const before = await pg.evaluate((cfg: any) => (window as any).__geo.captureSpot(cfg), cfgOf(sp2, o));
    const pl = await pg.evaluate((c: any) => (window as any).__geo.plantVisible(c, 0.9), { pos: cc.pos, target: cc.target, fov: cc.fov, near: o.roomNear, far: o.far });
    check('real plan: a bare floor spot to plant on was found', !!pl, pl ? `on ${pl.under} at y ${pl.y}` : '');
    const reg2: MeshInfo[] = await pg.evaluate(() => (window as any).__geo.registry());
    const after = await pg.evaluate((cfg: any) => (window as any).__geo.captureSpot(cfg), cfgOf(sp2, o));
    const found = after.pairs.find((p: any) => p.a === pl.id || p.b === pl.id);
    check('real plan, planted quad in aurora Living: found', !!found && found.count > 30, found ? `${found.count} px (${found.vis} visible) against ${label(reg2[(found.a === pl.id ? found.b : found.a) - 1])}` : 'not found');
    check('real plan, without the quad: it is not there', !before.pairs.some((p: any) => p.a >= pl.id || p.b >= pl.id));
    await pg.evaluate(() => (window as any).__geo.removePlanted());
    const gone = await pg.evaluate((cfg: any) => (window as any).__geo.captureSpot(cfg), cfgOf(sp2, o));
    check('real plan, quad removed: the frame is the one before', gone.flagged === before.flagged && gone.bdiff === before.bdiff, `flagged ${before.flagged} -> ${after.flagged} -> ${gone.flagged}, beauty diff ${before.bdiff} -> ${after.bdiff} -> ${gone.bdiff}`);
  } finally { await h.close(); }
  console.log(ok ? 'zfight self-test: PASS' : 'zfight self-test: FAIL');
  return ok;
}
async function runGeomOn(pg: any, o: Opts) {
  const regNow: MeshInfo[] = await pg.evaluate(() => (window as any).__geo.registry());
  const { soup, recs } = await extractSoup({ page: pg } as any, { walls: 'up', roof: 'off' });
  const pairs = coplanarPairs(soup, { tol: 0.002, minArea: 1e-3 }), buried = buriedPairs(pairs, recs);
  void o;
  return pairs.filter(p => !buried.has(`${p.a}:${p.b}`)).map(p => ({ names: `${regNow[p.a - 1].name}|${regNow[p.b - 1].name}`, area: round(p.area, 3), gap: round(p.gapMax * 1000, 3) }));
}

// ------------------------------------------------------------------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const o: Opts = {
    near: Number(args.near ?? 0.2), roomNear: Number(args['room-near'] ?? 0.05), far: Number(args.far ?? 160), res: args.res ?? '720', thr: Number(args.thr ?? 10),
    only: new Set((args.only ?? 'rooms,orbit,track,overview').split(',')), corners: (args.corners ?? 'NW,SE').split(',') as Corner[], maxSpots: Number(args['max-spots'] ?? 0),
    images: Number(args.images ?? 6), geom: args['no-geom'] !== 'true', tod: args.tod ?? 'day', top: 24,
  };
  const out = path.resolve(args.out && args.out !== 'true' ? args.out : OUT_DEFAULT);
  const gl = args.gl === 'software' ? 'software' : 'default';
  const sess = await startGeoSession({ gl });
  console.log(`zfight: ${sess.version} on ${gl}; output ${path.join(out, 'zfight')}`);
  let code = 0;
  try {
    if (args.selftest === 'true') { code = (await selftest(sess, o)) ? 0 : 1; process.exitCode = code; return; }
    if (!args.house) { console.error('--house <id[,id]> is required'); process.exit(2); }
    for (const house of args.house.split(',')) await runHouse(sess, house, args, o, path.join(out, 'zfight'));
  } finally { await sess.close(); }
  process.exit(code);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
