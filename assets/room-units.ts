// Room units — the fitted rooms' packers for the composer (assets/room-composer.ts): a kitchen's cabinet runs (single,
// galley, L, U, turning its corners with a corner-run), its appliances, wall cabinets and hood, and an island or
// peninsula with stools; and a bathroom's fixtures (tub, shower, vanity, toilet, rails, mat). THREE-free.
//
// Kitchen rules (plan S3, layout canon §4.3): the sink under a window where the run has one (else the middle of the
// longest leg), the dishwasher beside it, the range on the other leg (or ≥ 0.6 m along the same one), tall units (the
// fridge, a pantry) at a run's END, never in front of a window; wall cabinets over the counters but not over windows,
// tall units or the range (a hood goes there); an island parallel to the main leg across a 1.05 m aisle with stools at
// a 0.6 m pitch on the room side. rooms[].kitchen overrides the layout, island / peninsula, sink wall, window over
// sink, worktop (`top`), glass-fronted uppers and cabinet colour.
// Bath rules: a freestanding tub centred on a wall or its window (0.15 m off it), a built-in tub into a corner, a
// shower in a corner, a single / double / pedestal vanity on a wall other than the door's, the toilet with 0.2 m each
// side and 0.6 m in front, a towel rail by the tub or shower, a mat in front of it. rooms[].bath overrides them.
//
// Owner: S3 (compose).
import { PLACEMENT } from './props/placement.js';
import { INWARD, OPPOSITE, ROT_OF_WALL, alongX, mm, obb, turn, aabb, paramsOf, rotToward, type Run, type Side } from './room-geo.js';
import { wallGroup, cornerGroup, type Composer, type CItem, type Group, type Pose } from './room-composer.js';

const GAP = 0.015;         // an item's back off the wall face
const PEN = 1.15;          // a run that carries a peninsula stops this short of its wall: the bar's stools and a lane past them
const PEN_D = 0.95;        // the peninsula bar's depth
const DEPTH = 0.64;        // a base unit's depth off the wall (0.62, and a hair)
const AISLE = 1.05;        // the working aisle in front of a run (1.0–1.2)
const TRAD = ['farmhouse', 'cottage', 'craftsman', 'traditional', 'mediterranean'];

// ---- kitchens -------------------------------------------------------------------------------------------------------
interface Leg { run: Run; s0: number; s1: number; corner0: boolean; corner1: boolean }
interface Layout { key: string; kind: 'single' | 'galley' | 'L' | 'U'; legs: Leg[]; corners: Array<{ a: Run; b: Run; x: number; z: number }> }

/** the stretches of the room's wall runs a base cabinet can stand on: a run less its low windows (glass, sliders)
 *  and less whatever must stay clear in front of it (a door's swing, a stair's run-in, a stair, a void) */
function baseRuns(c: Composer): Run[] {
  const out: Run[] = [];
  for (const r of c.geo.runs) {
    let parts: Array<[number, number]> = [[r.a, r.b]];
    const cut = (a0: number, b0: number) => { parts = parts.flatMap(([a, b]) => (b0 <= a || a0 >= b) ? [[a, b] as [number, number]] : [[a, a0] as [number, number], [b0, b] as [number, number]].filter(([p, q]) => q - p > 0.3)); };
    for (const w of r.windows) if (w.sill < 0.85) cut(w.a - 0.05, w.b + 0.05);
    const sign = alongX(r.side) ? INWARD[r.side][1] : INWARD[r.side][0], n0 = Math.min(r.face, r.face + sign * DEPTH), n1 = Math.max(r.face, r.face + sign * DEPTH);
    for (const o of [...c.geo.keepouts, ...c.geo.obstacles]) {
      const A = aabb(o), m0 = alongX(r.side) ? A.z0 : A.x0, m1 = alongX(r.side) ? A.z1 : A.x1;
      if (m1 <= n0 + 0.01 || m0 >= n1 - 0.01) continue;
      cut(alongX(r.side) ? A.x0 : A.z0, alongX(r.side) ? A.x1 : A.z1);
    }
    for (const [a, b] of parts) if (b - a >= 0.9) out.push({ ...r, a, b });
  }
  return out;
}
/** do two perpendicular runs meet at a corner of the room? (the corner point, and which end of each it is) */
function meet(A: Run, B: Run) {
  if (alongX(A.side) === alongX(B.side)) return null;
  const [h, v] = alongX(A.side) ? [A, B] : [B, A];
  const x = v.face, z = h.face;
  const hEnd = Math.abs(x - h.a) < 0.2 ? 0 : Math.abs(x - h.b) < 0.2 ? 1 : -1, vEnd = Math.abs(z - v.a) < 0.2 ? 0 : Math.abs(z - v.b) < 0.2 ? 1 : -1;
  if (hEnd < 0 || vEnd < 0) return null;
  return { h, v, x, z, hEnd, vEnd };
}
function layouts(c: Composer, plan: any): Layout[] {
  const runs = baseRuns(c), out: Layout[] = [];
  const leg = (run: Run, cornerAt: number[] = []): Leg => {
    const s0 = run.a + (cornerAt.includes(0) ? DEPTH : 0), s1 = run.b - (cornerAt.includes(1) ? DEPTH : 0);
    return { run, s0, s1, corner0: cornerAt.includes(0), corner1: cornerAt.includes(1) };
  };
  runs.forEach((r, i) => { if (r.b - r.a >= 1.9) out.push({ key: `single:${i}`, kind: 'single', legs: [leg(r)], corners: [] }); });
  runs.forEach((A, i) => runs.forEach((B, j) => {
    if (j <= i) return;
    if (alongX(A.side) === alongX(B.side) && A.side === OPPOSITE[B.side]) {
      const gap = Math.abs(A.face - B.face), lo = Math.max(A.a, B.a), hi = Math.min(A.b, B.b);
      if (gap >= 2.2 && gap <= 3.4 && hi - lo >= 1.8) out.push({ key: `galley:${i}:${j}`, kind: 'galley', legs: [leg({ ...A, a: lo, b: hi }), leg({ ...B, a: lo, b: hi })], corners: [] });
      return;
    }
    const m = meet(A, B); if (!m) return;
    const lh = leg(m.h, [m.hEnd]), lv = leg(m.v, [m.vEnd]);
    if (lh.s1 - lh.s0 >= 1.1 && lv.s1 - lv.s0 >= 1.1) out.push({ key: `L:${i}:${j}`, kind: 'L', legs: [lh, lv], corners: [{ a: m.h, b: m.v, x: m.x, z: m.z }] });
    // a U: a third run meeting this one's other end
    runs.forEach((E, k) => {
      if (k === i || k === j) return;
      const m2 = meet(m.h, E); if (!m2 || m2.hEnd === m.hEnd || E.side === m.v.side) return;
      const lh2 = leg(m.h, [m.hEnd, m2.hEnd]), le = leg(m2.v, [m2.vEnd]);
      if (lh2.s1 - lh2.s0 >= 0.9 && le.s1 - le.s0 >= 1.1) out.push({ key: `U:${i}:${j}:${k}`, kind: 'U', legs: [lh2, lv, le], corners: [{ a: m.h, b: m.v, x: m.x, z: m.z }, { a: m2.h, b: m2.v, x: m2.x, z: m2.z }] });
    });
  }));
  const want = plan.layout;
  return want ? out.filter(l => l.kind === want).concat(out.filter(l => l.kind !== want)) : out;
}

/** lay the units out along one leg: the fixed pieces at their wanted centres, then counter runs in every gap */
function packLeg(lg: Leg, fixed: Array<{ type: string; w: number; t: number; params?: any; tall?: boolean }>): Array<{ type: string; w: number; t: number; params?: any; tall?: boolean }> {
  const out: typeof fixed = [];
  const units = fixed.slice().sort((a, b) => a.t - b.t);
  let cur = lg.s0;
  units.forEach((u, i) => {
    const rest = units.slice(i + 1).reduce((a, v) => a + v.w, 0);
    let start = Math.max(cur, u.t - u.w / 2); start = Math.min(start, lg.s1 - rest - u.w);
    if (start < cur - 1e-6) return;   // does not fit
    out.push({ ...u, t: start + u.w / 2 }); cur = start + u.w;
  });
  // counter runs in the gaps (≥ 0.3 m), in pieces of at most 2 m; a sliver under 0.3 m widens its neighbour
  const filled: typeof fixed = [];
  let at = lg.s0;
  const fill = (a: number, b: number) => { let len = b - a; if (len < 0.3) return; const n = Math.ceil(len / 2.0), w = len / n; for (let k = 0; k < n; k++) filled.push({ type: 'counter-run', w: mm(w), t: a + w * (k + 0.5) }); };
  for (const u of out) { fill(at, u.t - u.w / 2); filled.push(u); at = u.t + u.w / 2; }
  fill(at, lg.s1);
  return filled;
}

export function kitchenGroups(c: Composer, { dining = false, diningGroup }: { dining?: boolean; diningGroup: (r: any) => Group | null }): Array<(attempt?: number) => Group | null> {
  const plan = c.room.kitchen || {};
  const cab = plan.color || null, top = plan.top || (c.rng() < 0.6 ? c.style.finish.kitchenTop : undefined);
  const glassUppers = plan.glassUppers ?? (c.style.tags.some(t => ['farmhouse', 'scandi', 'cottage'].includes(t)) && c.rng() < 0.35);
  const ceiling = c.lv.height || 2.7;
  const fitted = (type: string, extra: any = {}) => { const p: any = { ...extra }; const P: string[] = PLACEMENT[type]?.colorRole === 'cabinet' ? ['color'] : []; if (cab && P.includes('color')) p.color = cab; if (top && ['counter-run', 'sink-run', 'corner-run', 'breakfast-bar'].includes(type) && top !== 'stone') p.top = top; return p; };
  const main = c.mainPortal();
  const kitchen = (): Group | null => {
    const ls = layouts(c, plan).filter(l => !dining || l.kind !== 'U');
    if (!ls.length) return null;
    // each layout in its variants: which leg takes the sink, the range and the fridge, and which end the fridge takes
    const cands: Pose[] = [];
    // a peninsula plan: the layout's runs are also tried with one open end held back, so a bar can come off it
    const wantPen = !!plan.peninsula && !plan.island;
    const variants: Array<{ l: Layout; pe: { li: number; end: number } | null }> = [];
    for (const l of ls) {
      if (!wantPen) { variants.push({ l, pe: null }); continue; }
      l.legs.forEach((lg, li) => {
        for (const end of [0, 1]) {
          if (end ? lg.corner1 : lg.corner0) continue;
          const s0 = end ? lg.s0 : Math.max(lg.s0, lg.run.a + PEN), s1 = end ? Math.min(lg.s1, lg.run.b - PEN) : lg.s1;
          if (s1 - s0 < 1.6) continue;
          variants.push({ l: { ...l, key: `${l.key}:pe${li}${end}`, legs: l.legs.map((g, i) => (i === li ? { ...g, s0, s1 } : g)) }, pe: { li, end } });
        }
      });
    }
    for (const { l, pe } of variants) {
      const n = l.legs.length;
      for (let si = 0; si < n; si++) for (let ri = 0; ri < n; ri++) for (let fi = 0; fi < n; fi++) for (const fe of [0, 1]) {
        if (n > 1 && ri === si && l.legs.length > 1 && fi !== si && fi !== ri) continue;
        if (n === 3 && (si === ri || ri === fi || si === fi)) continue;
        if (n === 2 && si === ri) continue;
        cands.push({ key: `${l.key}:s${si}r${ri}f${fi}e${fe}`, l, si, ri, fi, fe, pe });
      }
    }
    return {
      name: 'kitchen', gid: 0, movable: false, cands,
      build: p => {
        const L: Layout = p.l, out: CItem[] = [];
        const legLen = (lg: Leg) => lg.s1 - lg.s0;
        const winOf = (lg: Leg) => lg.run.windows.find(w => w.sill >= 0.85 && w.a >= lg.s0 - 0.1 && w.b <= lg.s1 + 0.1 && plan.windowOverSink !== false);
        const sinkLeg = L.legs[p.si], rangeLeg = L.legs[p.ri], fridgeLeg = L.legs[p.fi];
        if (plan.sinkWall && sinkLeg.run.side !== plan.sinkWall && L.legs.some(lg => lg.run.side === plan.sinkWall)) return null;
        const compact = L.legs.reduce((a, lg) => a + legLen(lg), 0) < 3.2;   // a small kitchen: narrow sink, slim fridge, no dishwasher
        const plans = new Map<Leg, Array<{ type: string; w: number; t: number; params?: any; tall?: boolean }>>();
        for (const lg of L.legs) plans.set(lg, []);
        const w = winOf(sinkLeg), sw = compact ? 0.8 : mm(Math.max(1.0, Math.min(1.6, legLen(sinkLeg) * 0.35)));
        const st = w ? (w.a + w.b) / 2 : (sinkLeg.s0 + sinkLeg.s1) / 2;
        plans.get(sinkLeg)!.push({ type: 'sink-run', w: sw, t: st, params: fitted('sink-run', { w: sw }) });
        // a peninsula's bar hangs off the run's last 0.95 m: a plain cabinet is fixed there, so the sink, range and fridge
        // are packed round it
        if (p.pe) { const pl = L.legs[p.pe.li]; plans.get(pl)!.push({ type: 'counter-run', w: PEN_D, t: p.pe.end ? pl.s1 - PEN_D / 2 : pl.s0 + PEN_D / 2, params: fitted('counter-run', { w: PEN_D }) }); }
        // the dishwasher beside the sink, toward the corner (or the leg's start)
        const dwSide = sinkLeg.corner1 ? 1 : -1;
        if (!compact && legLen(sinkLeg) >= sw + 1.2) plans.get(sinkLeg)!.push({ type: 'dishwasher', w: 0.6, t: st + dwSide * (sw / 2 + 0.3) });
        // the range: the other leg's middle, or 0.6 m past the sink on a single run
        const rw = legLen(rangeLeg) >= 3.2 ? 0.76 : 0.6;
        const rt = rangeLeg === sinkLeg ? (st < (sinkLeg.s0 + sinkLeg.s1) / 2 ? st + sw / 2 + (compact ? 0.3 : 0.9) + rw / 2 : st - sw / 2 - (compact ? 0.3 : 0.9) - rw / 2) : (rangeLeg.s0 + rangeLeg.s1) / 2;
        plans.get(rangeLeg)!.push({ type: 'range', w: rw, t: rt, params: { w: rw } });
        // the fridge at a run END (never a corner end, never in front of a window), a pantry beside it when there is room
        const fw = compact ? 0.6 : 0.9, fEnd = p.fe;
        if (fEnd ? fridgeLeg.corner1 : fridgeLeg.corner0) return null;
        if (c.attempt < 1 && fridgeLeg.run.windows.some(win => fEnd ? win.b > fridgeLeg.s1 - fw - 0.05 : win.a < fridgeLeg.s0 + fw + 0.05)) return null;
        const ft = fEnd ? fridgeLeg.s1 - fw / 2 : fridgeLeg.s0 + fw / 2;
        plans.get(fridgeLeg)!.push({ type: 'fridge', w: fw, t: ft, tall: true, params: { ...(compact ? { w: 0.6 } : {}), ...(c.rng() < 0.3 ? { finish: 'cabinet' } : {}) } });
        if (c.density >= 0.55 && legLen(fridgeLeg) >= 3.6) plans.get(fridgeLeg)!.push({ type: 'pantry', w: 0.6, t: ft + (fEnd ? -(fw / 2 + 0.3) : fw / 2 + 0.3), tall: true, params: fitted('pantry', { w: 0.6 }) });
        // lay out every leg (a layout that cannot fit its sink, range and fridge is not a kitchen), then the wall
        // cabinets and the hood
        const packed = new Map(L.legs.map(lg => [lg, packLeg(lg, plans.get(lg)!)]));
        const got = [...packed.values()].flat().map(u => u.type);
        if (!['sink-run', 'range', 'fridge'].every(t => got.includes(t))) return null;
        for (const lg of L.legs) {
          for (const u of packed.get(lg)!) {
            const params = u.type === 'counter-run' ? fitted('counter-run', { w: u.w }) : u.params || {};
            const it = c.onWall(u.type, lg.run, u.t, params); it.access = []; out.push(it);
            // under the peninsula's bar the run's front is the bar: no aisle to keep there
            if (p.pe && lg === L.legs[p.pe.li] && Math.abs(u.t - (p.pe.end ? lg.s1 : lg.s0)) < PEN_D / 2 + u.w / 2) { it.clear = []; it.peninsulaEnd = true; }
            if (u.tall || u.type === 'fridge') continue;
            if (ceiling < 2.35) continue;
            const t0 = u.t - u.w / 2, t1 = u.t + u.w / 2;
            if (lg.run.windows.some(win => win.b > t0 - 0.05 && win.a < t1 + 0.05)) continue;
            if (u.type === 'range') { const h = c.mount('range-hood', lg.run, u.t, 1.5, { w: u.w }); h.opt = true; out.push(h); continue; }
            if (u.type === 'sink-run' || u.w < 0.45) continue;
            const up = c.mount('upper-cabinets', lg.run, u.t, 1.45, fitted('upper-cabinets', { w: mm(u.w), ...(glassUppers ? { glass: true } : {}) })); up.opt = true; out.push(up);
          }
        }
        for (const k of L.corners) {
          const [ax, az] = INWARD[k.a.side], [bx, bz] = INWARD[k.b.side];
          const cx = k.x + bx * (0.31 + 0.015), cz = k.z + az * (0.31 + 0.015);
          // hand: the corner unit's side wall is to its left (−x local) or right, as it faces out along run a
          const rot = ROT_OF_WALL[k.a.side], [lx] = turn(bx, bz, -rot);
          out.push(c.item('corner-run', cx, cz, rot, fitted('corner-run', { hand: lx > 0 ? 'left' : 'right' })));
        }
        // the working aisle in front of every leg must stay free (it is the unit's front clearance) and reachable
        for (const it of out) if (it.layer === 'body' && it.type !== 'corner-run' && !it.peninsulaEnd) { const [dx, dz] = turn(0, it.d / 2 + 0.45, it.rot); it.access = [[it.cx + dx, it.cz + dz]]; }
        // a little life on the counters
        const counters = out.filter(it => it.type === 'counter-run');
        if (counters.length) { const k0 = counters[0], t = c.pick('counter-appliance'); if (t) out.push(c.on(t, k0, -k0.w / 2 + 0.3, -0.05)); }
        if (counters.length > 1) { const t = c.pick('plant-surface-kitchen'); if (t) out.push(c.on(t, counters[counters.length - 1], 0, -0.15)); }
        return out;
      },
      score: (p, items) => {
        const L: Layout = p.l;
        let v = items.filter(i => i.layer === 'body').length * 0.1 + (L.kind === 'L' ? 1.2 : L.kind === 'U' ? (dining ? -1 : 0.9) : L.kind === 'galley' ? 0.6 : 0);
        const sink = items.find(i => i.type === 'sink-run'), sl = L.legs[p.si];
        if (sink && sl.run.windows.some(w => w.sill >= 0.85 && Math.abs((alongX(sl.run.side) ? sink.cx : sink.cz) - (w.a + w.b) / 2) < 0.3)) v += 0.8;   // the sink under the window
        v -= p.si === p.ri ? 0.3 : 0;
        if (plan.layout && L.kind === plan.layout) v += 10;
        if (main) for (const lg of L.legs) if (lg.run.side === main.side) v -= 0.4;
        return v;
      },
    };
  };
  // the island (or a peninsula) across the aisle from the longest leg, with its stools on the room side
  const island = (): Group | null => {
    if (plan.island === false) return null;
    const k = c.groups.find(g => g.name === 'kitchen'); if (!k || !k.items) return null;
    const legs: Leg[] = k.pose!.l.legs, mainLeg = legs.slice().sort((a, b) => (b.s1 - b.s0) - (a.s1 - a.s0))[0];
    const want = typeof plan.island === 'object' ? plan.island : null;
    const iw = mm(want ? want.w : Math.max(1.4, Math.min(2.4, (mainLeg.s1 - mainLeg.s0) - 0.8))), id = mm(want ? want.d : 0.95);
    if (!want && plan.island !== true && c.geo.area < (dining ? 14 : 10)) return null;
    const run = mainLeg.run, [nx, nz] = INWARD[run.side];
    const onLeg = k.items.filter(it => it.layer === 'body' && it.rot === ROT_OF_WALL[run.side]);
    const deepest = Math.max(DEPTH, ...onLeg.map(it => Math.abs((alongX(run.side) ? it.cz : it.cx) - run.face) + it.d / 2));
    const off = deepest + AISLE + id / 2;
    const rot = ROT_OF_WALL[OPPOSITE[run.side]] + 180;   // its seating side (+z local) faces away from the leg
    const cands: Pose[] = [];
    for (let t = mainLeg.s0 + iw / 2; t <= mainLeg.s1 - iw / 2 + 1e-6; t += 0.1) cands.push({ key: `i${mm(t)}`, t: mm(t) });
    if (!cands.length) cands.push({ key: 'imid', t: mm((mainLeg.s0 + mainLeg.s1) / 2) });
    const mid = (mainLeg.s0 + mainLeg.s1) / 2;
    return {
      name: 'island', gid: 0, movable: true, anneal: true, cands,
      build: p => {
        const cx = alongX(run.side) ? p.t : run.face + nx * off, cz = alongX(run.side) ? run.face + nz * off : p.t;
        const isl = c.item('breakfast-bar', cx, cz, rot, fitted('breakfast-bar', { w: iw, d: id }));
        isl.clear = [];   // its aisles are the legs' front clearances and the stools'
        const out = [isl], n = Math.max(2, Math.floor((iw - 0.2) / 0.6));
        for (let i = 0; i < n; i++) { const [dx, dz] = turn(-iw / 2 + iw / n * (i + 0.5), id / 2 + 0.12, rot); const s = c.item(stool, cx + dx, cz + dz, rot + 180, {}); s.opt = true; out.push(s); }
        { const t = c.pick('surface-decor-kitchen'); if (t) out.push(c.on(t, isl, iw * 0.25, -0.1)); }
        const [ax, az] = turn(0, id / 2 + 0.75, rot); isl.access = [[cx + ax, cz + az]];
        return out;
      },
      score: p => -Math.abs(p.t - mid) * 0.5,
    };
  };
  // a peninsula: a counter bar off the open end of a run, projecting from the wall into the room, its stools on the
  // side away from the run
  const peninsula = (): Group | null => {
    const k = c.groups.find(g => g.name === 'kitchen'); if (!k || !k.items) return null;
    const legs: Leg[] = k.pose!.l.legs, cands: Pose[] = [], id = PEN_D;
    // (only off an end with floor beyond it along the wall: a run that ends at a corner or the room's edge has none)
    const pe = k.pose!.pe;
    legs.forEach((lg, li) => { for (const end of [0, 1]) { if (end ? lg.corner1 : lg.corner0) continue; if (pe && (pe.li !== li || pe.end !== end)) continue; if ((end ? lg.run.b - lg.s1 : lg.s0 - lg.run.a) < PEN - 0.05) continue; for (const len of [2.0, 1.6, 1.3]) cands.push({ key: `p${li}:${end}:${len}`, li, end, len }); } });
    if (!cands.length) return null;
    return {
      name: 'peninsula', gid: 0, movable: true, anneal: true, cands,
      build: p => {
        const lg: Leg = legs[p.li], run = lg.run, [nx, nz] = INWARD[run.side], along = alongX(run.side), sgn = p.end ? 1 : -1;
        // the bar hangs off the run's last 0.95 m, from the run's front face out into the room, its stools on the far side
        const onLeg = k.items!.filter(it => it.layer === 'body' && it.rot === ROT_OF_WALL[run.side]);
        const deepest = Math.max(DEPTH, ...onLeg.map(it => Math.abs((along ? it.cz : it.cx) - run.face) + it.d / 2));
        const bt = (p.end ? lg.s1 : lg.s0) - sgn * (id / 2), off = deepest + 0.01 + p.len / 2;
        const cx = along ? bt : run.face + nx * off, cz = along ? run.face + nz * off : bt;
        const rot = rotToward(along ? sgn : 0, along ? 0 : sgn);   // its seating side faces along the run, away from it
        const bar = c.item('breakfast-bar', cx, cz, rot, fitted('breakfast-bar', { w: mm(p.len), d: id })); bar.clear = [];
        const out = [bar], n = Math.max(2, Math.floor((p.len - 0.2) / 0.6));
        for (let i = 0; i < n; i++) { const [dx, dz] = turn(-p.len / 2 + p.len / n * (i + 0.5), id / 2 + 0.12, rot); const st = c.item(stool, cx + dx, cz + dz, rot + 180, {}); st.opt = true; out.push(st); }
        { const t = c.pick('surface-decor-kitchen'); if (t) out.push(c.on(t, bar, p.len * 0.25, -0.1)); }
        const [ax, az] = turn(0, id / 2 + 0.75, rot); bar.access = [[cx + ax, cz + az]];
        return out;
      },
      score: p => p.len * 0.3 - (legs[p.li].run.windows.length ? 0.2 : 0),
    };
  };
  const stool = c.pick('stool') || 'bar-stool';
  // (a peninsula the room has no end for is an island: better a bar than none)
  const list: Array<(attempt?: number) => Group | null> = plan.peninsula && !plan.island ? [kitchen, (attempt = 0) => (attempt === 0 ? peninsula() || island() : island())] : [kitchen, island];
  if (dining) list.push(() => {
    // the dining table in whatever part of the room the kitchen leaves: the biggest rectangle past its aisle
    const kit = c.placed.filter(it => !it.pin && (PLACEMENT[it.type]?.group === 'fitted' || PLACEMENT[it.type]?.group === 'appliance' || it.type === 'bar-stool') && it.layer === 'body');
    if (!kit.length) return diningGroup(null);
    const b = c.geo.b, x0 = Math.min(...kit.map(i => i.cx - Math.max(i.w, i.d) / 2)), x1 = Math.max(...kit.map(i => i.cx + Math.max(i.w, i.d) / 2)), z0 = Math.min(...kit.map(i => i.cz - Math.max(i.w, i.d) / 2)), z1 = Math.max(...kit.map(i => i.cz + Math.max(i.w, i.d) / 2));
    const opts = [
      { x0: x1 + 0.9, z0: b.z, x1: b.x + b.w, z1: b.z + b.d }, { x0: b.x, z0: b.z, x1: x0 - 0.9, z1: b.z + b.d },
      { x0: b.x, z0: z1 + 0.9, x1: b.x + b.w, z1: b.z + b.d }, { x0: b.x, z0: b.z, x1: b.x + b.w, z1: z0 - 0.9 },
    ].filter(r => r.x1 - r.x0 >= 2.2 && r.z1 - r.z0 >= 2.2).sort((p, q) => (q.x1 - q.x0) * (q.z1 - q.z0) - (p.x1 - p.x0) * (p.z1 - p.z0));
    return opts.length ? diningGroup(opts[0]) : null;
  });
  return list;
}

// ---- bathrooms ------------------------------------------------------------------------------------------------------
export function bathGroups(c: Composer): Array<() => Group | null> {
  const P = c.program, plan = c.room.bath || {}, area = c.geo.area, trad = c.style.tags.some(t => TRAD.includes(t));
  const tub = plan.tub ?? (P === 'powder' || area < 4.2 ? 'none' : area >= 6.5 && (trad || c.rng() < 0.55) ? 'free' : 'built-in');
  const shower = plan.shower ?? (P !== 'powder' && (tub === 'none' || area >= 9));
  const vanity = plan.vanity ?? (P === 'powder' ? (trad ? 'pedestal' : 'single') : P === 'ensuite' && area >= 7 && c.rng() < 0.6 ? 'double' : trad && c.rng() < 0.4 ? 'pedestal' : 'single');
  const main = c.mainPortal();
  const notDoorWall = (p: Pose) => (main && p.run && p.run.side === main.side ? -1 : 0);
  const list: Array<() => Group | null> = [];
  list.push(() => {
    // (a room that would not take the first sink is given the pedestal one, half the width)
    const type = c.attempt >= 1 && vanity !== 'double' ? 'pedestal-sink' : vanity === 'double' ? 'double-vanity' : vanity === 'pedestal' ? 'pedestal-sink' : (c.pick('vanity', { fit: t => t !== 'pedestal-sink' }) || 'vanity-sink');
    const g = wallGroup(c, 'vanity', type, {}, { score: (p, it) => notDoorWall(p) * 1.5 - (p.run.windows.length ? 0.4 : 0) });
    const b0 = g.build; g.build = p => { const items = b0(p); const it = items[0], [dx, dz] = turn(0, it.d / 2 + 0.35, it.rot); it.access = [[it.cx + dx, it.cz + dz]]; return items; };
    return g;
  });
  list.push(() => {
    // against a side wall (its centre 0.4 m off it) where it can be, away from the door's wall
    const g = wallGroup(c, 'toilet', 'toilet', {}, { score: p => -Math.min(1, Math.abs(Math.min(p.t - p.run.a, p.run.b - p.t) - 0.42)) + (main && p.run.side === main.side ? -0.3 : 0) });
    const b0 = g.build;
    g.build = p => { const items = b0(p); const it = items[0]; for (const s of [-1, 1]) { const [dx, dz] = turn(s * (it.w / 2 + 0.1), 0, it.rot); it.walk.push(obb(it.cx + dx, it.cz + dz, 0.2, it.d, it.rot)); } const [fx, fz] = turn(0, it.d / 2 + 0.3, it.rot); it.access = [[it.cx + fx, it.cz + fz]]; return items; };
    return g;
  });
  if (tub === 'free') list.push(() => {
    const type = c.pick('tub-free') || 'clawfoot-tub';
    return {
      name: 'tub', gid: 0, movable: true, anneal: true, cands: c.wallPoses(c.size(type).w + 0.1),
      build: p => { const it = c.onWall(type, p.run, p.t, {}, 0.15); const [dx, dz] = turn(0, it.d / 2 + 0.4, it.rot); it.access = [[it.cx + dx, it.cz + dz]]; return [it]; },
      score: p => { const win = p.run.windows[0]; return (win ? 1 - Math.min(1, Math.abs(p.t - (win.a + win.b) / 2)) : 0) - Math.abs(p.t - (p.run.a + p.run.b) / 2) * 0.3 + notDoorWall(p); },
    };
  });
  if (tub === 'built-in') list.push(() => {
    const S = c.size('bathtub');
    return {
      name: 'tub', gid: 0, movable: true, anneal: true, cands: c.wallPoses(S.w),
      build: p => { const it = c.onWall('bathtub', p.run, p.t, {}); const [dx, dz] = turn(0, it.d / 2 + 0.4, it.rot); it.access = [[it.cx + dx, it.cz + dz]]; return [it]; },
      score: p => -Math.min(p.t - S.w / 2 - p.run.a, p.run.b - p.t - S.w / 2) * 2 + notDoorWall(p),   // into a corner
    };
  });
  if (shower) list.push(() => {
    const sw = typeof shower === 'object' ? shower : null, params = sw ? { w: sw.w, d: sw.d } : {};
    const g = cornerGroup(c, 'shower', 'shower-cubicle', params);
    const b0 = g.build; g.build = p => { const items = b0(p); for (const it of items) { const [dx, dz] = turn(0, it.d / 2 + 0.4, it.rot); it.access = [[it.cx + dx, it.cz + dz]]; } return items; };
    return g;
  });
  if (P !== 'powder') list.push(() => {
    const t = c.pick('towel-rail') || 'towel-rail';
    const near = c.placed.find(i => !i.pin && (i.type === 'shower-cubicle' || PLACEMENT[i.type]?.roles.some(r => r.startsWith('tub'))));
    return wallGroup(c, 'towel-rail', t, {}, { score: (p, it) => (near ? -Math.hypot(it.cx - near.cx, it.cz - near.cz) : 0) });
  });
  list.push(() => {
    const near = c.placed.find(i => !i.pin && (i.type === 'shower-cubicle' || i.type === 'bathtub' || PLACEMENT[i.type]?.roles.includes('tub-free'))) || c.placed.find(i => !i.pin && PLACEMENT[i.type]?.roles.some(r => r.startsWith('vanity')));
    if (!near) return null;
    const mat = c.pick('bath-mat') || 'bath-mat', round = paramsOf(mat).includes('r'), runner = mat === 'bath-runner';
    const mp = round ? { r: mm(Math.min(0.35, near.w / 2)) } : runner ? { w: mm(Math.min(0.55, near.w)), d: 1.2 } : { w: mm(Math.min(0.8, near.w)), d: 0.5 }, MS = c.size(mat, mp);
    // its near edge 0.05 m off the fitting's front
    const [rx, rz] = turn(0, near.d / 2 + 0.05 + MS.d / 2, near.rot);
    return { name: 'mat', gid: 0, movable: false, cands: [{ key: 'm' }], build: () => [c.item(mat, near.cx + rx, near.cz + rz, near.rot, mp)], score: () => 0 };
  });
  if (c.density >= 0.45 && area >= 4.5) list.push(() => { const t = c.pick('plant-small'); return t ? cornerGroup(c, 'plant', t) : null; });
  if (c.density >= 0.5 && area >= 5.5 && P !== 'powder') list.push(() => cornerGroup(c, 'hamper', c.pick('hamper') || 'laundry-basket'));
  if (c.density >= 0.6 && area >= 7 && P !== 'powder') list.push(() => { const t = c.pick('linen'); return t ? wallGroup(c, 'linen', t, {}) : null; });
  return list;
}
