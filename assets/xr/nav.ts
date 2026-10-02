// assets/xr/nav.ts : where a person in a headset may stand, and what they can walk or see to. THREE-free: it runs in Node (scripts/test-xr-nav.mts
// proves it on all 30 homes) exactly as in the page.
//
// This is the ONLY place the player builds a nav (createNav, assets/shot-nav.ts). It reads the world digest the 2D player already made
// (anchors.shotWorld: a getter, made when the shots were planned) and never re-digests: after the static batch (viewer-batch.ts) the scene's
// meshes are merged and a second digest would see 1309 of 2200 boxes. Building every storey's grid and the lot's takes 15 to 17 ms; it is done
// once, behind the veil, after the session has started (XrLocomotion.start), so a visitor who never enters VR never pays for it.
//
// A person is not a camera. The shot planner keeps the eye 0.40 m from a wall (a camera model, wide enough that a lens does not clip); a body
// is narrower, so a teleport target needs min(distance to wall, distance to hard furniture + 0.1) >= 0.30 m, falling back to 0.24 m where
// nothing at 0.30 exists nearby (a narrow doorway with a table beside it), and a cell inside a low piece of furniture's box (a desk, a sofa) is
// never a place to stand. These are the numbers of BODY below.
//
// Levels. A person stands on a plane: their storey's floor, or the lot's ground (0) outside, or the top of a deck (K.walk). Teleport never
// changes the plane; the stairs do (stairs.ts), by a blink to the other end of the flight.
import { createNav, CELL, TIERS, type Grid, type Nav } from '../shot-nav.js';
import { K, createWorldIndex, levelAt, inFootprint, type ShotWorld, type WLevel, type WorldIndex, type WRoom } from '../shot-world.js';
import { createProbe, type Probe } from '../shot-probe.js';
import type { Box6, V3, WorldProbe } from './host.js';

/** the body model (metres) */
export const BODY = {
  /** clearance a standing place needs, and the fallback where nothing at that clearance exists within `near` */
  clear: 0.30, clearMin: 0.24, near: 0.45,
  /** distance to the box of a low piece of furniture (the nav's "soft" band) under which a cell is inside it */
  soft: 0.10,
  /** the head against a wall: below this plan distance the comfort quad takes over (comfort.ts) */
  wallGuard: 0.08,
  /** a storey whose floor is within this of the feet is the one the person is on */
  levelTol: 0.5,
  /** ground-floor storeys start below this y; their footprint is a doorway to the lot */
  ground: 0.3,
  /** the segment test needs this much clearance from a wall (the target test needs `clear`) */
  pass: 0.10,
  /** a deck or step lower than this is part of the ground (a stepping stone, a paving edge) */
  deckMin: 0.10, deckMax: 1.0,
};

export interface StandCheck {
  ok: boolean; x: number; y: number; z: number; level: WLevel | null; clearance: number;
  why: 'ok' | 'no-floor' | 'blocked' | 'tight' | 'low-furniture';
}
export interface StairEnd {
  /** the stand: where the feet go when arriving here (null: no valid cell near, the flight is unusable from this end) */
  stand: V3 | null; yawDeg: number; level: string;
  /** the ring's centre on the floor: at the flight's end, a hand's breadth short of the first step (foot) or past the last (top) */
  ring: V3;
}
export interface StairLink {
  index: number; from: string; to: string; shape: string; spiral: boolean;
  /** the foot is on `from` (Go up), the top on `to` (Go down) */
  foot: StairEnd; top: StairEnd;
}

export interface XrNav {
  world: ShotWorld; index: WorldIndex; probe: Probe; nav: Nav;
  /** build every grid now; returns the ms it took (0 when already built) */
  warm(): number;
  levelById(id: string | null): WLevel | null;
  /** the storey whose floor is within BODY.levelTol of feetY, or null (on the lot, on a deck) */
  levelFor(feetY: number): WLevel | null;
  /** the y of the plane under (x, z) for a person whose feet are at feetY: their storey's floor, else the top of a deck, else 0 */
  floorAt(x: number, z: number, feetY: number): number;
  /** can a person stand at (x, z) on the plane of feetY, and how well */
  stand(x: number, z: number, feetY: number): StandCheck;
  /** nearest valid stand to (x, z) within maxR on the plane of feetY (BODY.clear, then clearMin, then 0.16), or null; `inside`: only cells in the storey's own footprint (not the lot beyond its wall) */
  snap(x: number, z: number, feetY: number, maxR?: number, inside?: boolean): StandCheck | null;
  /** is the straight walk from a to b (plan) free of walls, voids and furniture on the plane of feetY (door gaps to the lot allowed) */
  walkFree(ax: number, az: number, bx: number, bz: number, feetY: number): boolean;
  /** nearest wall (kinds wall, rail) in plan to (x, z) within the height band of a head at y, capped at 0.3 */
  wallDistance(x: number, y: number, z: number): number;
  /** is the point inside a piece of furniture's box at head height (the head in a wardrobe) */
  insideItem(x: number, y: number, z: number): boolean;
  roomAt(level: string | null, x: number, z: number): WRoom | null;
  /** a point to visit a room at, or null for a room too small to stand in */
  visitPoint(level: string, room: WRoom): V3 | null;
  /** the heading (degrees, three's yaw: 0 looks down -z) with the longest clear view from a standing eye at (x, z) */
  bestHeading(x: number, y: number, z: number): number;
  stairs(): StairLink[];
  /** from a stand, a test for "can a person get to (level, x, z) at all": walking within a storey (the loosest clearance the planner's A* uses) and the flights between storeys */
  reachableFrom(level: string, x: number, z: number): (level: string, x: number, z: number) => boolean;
  /** the mid-point of every door to the lot: a straight line through one crosses the dead band between the storey's grid and the lot's */
  openings(): Array<{ x: number; z: number; r: number }>;
  probeApi: WorldProbe;
}

const yawOf = (dx: number, dz: number) => (Math.atan2(-dx, -dz) * 180) / Math.PI;
export { yawOf };

export function createXrNav(world: ShotWorld): XrNav {
  const index = createWorldIndex(world);
  const nav = createNav(world, index);
  const probe = createProbe(index);
  const levels = world.levels;
  let warmed = false;
  const levelById = (id: string | null) => (id ? levels.find(l => l.id === id) || null : null);
  const outsideGrid = () => nav.grid(null, 0);

  function warm() {
    if (warmed) return 0;
    const t0 = performance.now();
    for (const l of levels) nav.grid(l);
    outsideGrid();
    warmed = true;
    return performance.now() - t0;
  }

  // ---- levels and planes
  function levelFor(feetY: number): WLevel | null {
    let best: WLevel | null = null, bd = BODY.levelTol;
    for (const l of levels) { const d = Math.abs(l.y - feetY); if (d <= bd) { bd = d; best = l; } }
    return best;
  }
  // the walk boxes (decks, steps, patios lifted off the ground): standing on one puts the feet on its top
  const decks: Box6[] = [];
  for (let i = 0; i < world.kinds.length; i++) {
    if (world.kinds[i] !== K.walk) continue;
    const b = index.box(i);
    if (b[4] >= BODY.deckMin && b[4] <= BODY.deckMax) decks.push(b);
  }
  function floorAt(x: number, z: number, feetY: number): number {
    const cur = levelFor(feetY);
    if (cur && inFootprint(cur.rects, x, z)) return cur.y;
    if (cur && cur.y > BODY.ground) return cur.y;              // an upper storey has no ground to step onto
    let y = 0;
    for (const d of decks) if (x >= d[0] && x <= d[3] && z >= d[2] && z <= d[5] && d[4] > y && d[4] <= feetY + 0.5) y = d[4];
    return y;
  }
  /** which grid decides (x, z) for a person on the storey `cur` (null: on the lot): the storey's own inside its footprint, the lot's outside it on the ground */
  function gridFor(cur: WLevel | null, x: number, z: number): { g: Grid; level: WLevel | null } | null {
    if (cur) {
      if (inFootprint(cur.rects, x, z)) return { g: nav.grid(cur), level: cur };
      return cur.y < BODY.ground ? { g: outsideGrid(), level: null } : null;
    }
    const ground = levels.find(l => l.y < BODY.ground && inFootprint(l.rects, x, z));
    return ground ? { g: nav.grid(ground), level: ground } : { g: outsideGrid(), level: null };
  }
  const clearOf = (g: Grid, c: number) => Math.min(g.dW[c], g.dI[c] + 0.1);

  function stand(x: number, z: number, feetY: number): StandCheck {
    const cur = levelFor(feetY);
    const r = gridFor(cur, x, z);
    const y = floorAt(x, z, feetY);
    if (!r) return { ok: false, x, y, z, level: null, clearance: 0, why: 'no-floor' };
    const g = r.g, [i, j] = nav.cellOf(g, x, z);
    if (i < 0 || j < 0 || i >= g.W || j >= g.H) return { ok: false, x, y, z, level: r.level, clearance: 0, why: 'no-floor' };
    const c = j * g.W + i;
    if (!g.free[c]) return { ok: false, x, y, z, level: r.level, clearance: 0, why: 'no-floor' };
    const clr = clearOf(g, c);
    if (g.dS[c] < BODY.soft) return { ok: false, x, y, z, level: r.level, clearance: clr, why: 'low-furniture' };
    // 0.30 m; 0.24 m only where no cell within BODY.near has 0.30 (a narrow doorway, a gap beside a table)
    if (clr >= BODY.clear) return { ok: true, x, y, z, level: r.level, clearance: clr, why: 'ok' };
    if (clr >= BODY.clearMin && !anyWithin(g, x, z, BODY.near, BODY.clear)) return { ok: true, x, y, z, level: r.level, clearance: clr, why: 'ok' };
    return { ok: false, x, y, z, level: r.level, clearance: clr, why: clr < 0.05 ? 'blocked' : 'tight' };
  }
  function anyWithin(g: Grid, x: number, z: number, r: number, need: number): boolean {
    const R = Math.ceil(r / CELL), [ci, cj] = nav.cellOf(g, x, z);
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= g.W || j >= g.H) continue;
      if (Math.hypot(di, dj) * CELL > r) continue;
      const c = j * g.W + i;
      if (g.free[c] && clearOf(g, c) >= need && g.dS[c] >= BODY.soft) return true;
    }
    return false;
  }
  function snap(x: number, z: number, feetY: number, maxR = 2.0, inside = false): StandCheck | null {
    const cur = levelFor(feetY);
    const R = Math.ceil(maxR / CELL);
    const cand: Array<[number, number, number]> = [];
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const d = Math.hypot(di, dj) * CELL; if (d > maxR) continue;
      cand.push([d, x + di * CELL, z + dj * CELL]);
    }
    cand.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    for (const need of [BODY.clear, BODY.clearMin, 0.16]) {
      for (const [, cx, cz] of cand) {
        const r = gridFor(cur, cx, cz); if (!r || (inside && !r.level)) continue;
        const g = r.g, [i, j] = nav.cellOf(g, cx, cz);
        if (i < 0 || j < 0 || i >= g.W || j >= g.H) continue;
        const c = j * g.W + i;
        if (g.free[c] && clearOf(g, c) >= need && g.dS[c] >= BODY.soft) return { ok: true, x: g.x0 + i * CELL, y: floorAt(cx, cz, feetY), z: g.z0 + j * CELL, level: r.level, clearance: clearOf(g, c), why: 'ok' };
      }
    }
    return null;
  }

  // ---- walking
  const openings: Array<{ x: number; z: number; r: number }> = [];
  if (world.entry) openings.push({ x: world.entry.x, z: world.entry.z, r: Math.max(0.9, world.entry.w * 0.7) });
  for (const d of world.doors || []) {
    if (d.kind === 'interior') continue;
    const a = (d.closedYaw * Math.PI) / 180;
    openings.push({ x: d.hinge[0] + Math.sin(a) * d.w / 2, z: d.hinge[1] + Math.cos(a) * d.w / 2, r: Math.max(0.9, d.w) });
  }
  const nearOpening = (x: number, z: number) => openings.some(o => Math.hypot(x - o.x, z - o.z) <= o.r);
  function walkFree(ax: number, az: number, bx: number, bz: number, feetY: number): boolean {
    const cur = levelFor(feetY), L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.05));
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      const r = gridFor(cur, x, z);
      let ok = false;
      if (r) {
        const g = r.g, [i, j] = nav.cellOf(g, x, z);
        if (i >= 0 && j >= 0 && i < g.W && j < g.H) {
          const c = j * g.W + i;
          // the first 0.3 m is the person's own spot: they may stand 10 cm from a wall and still point along it
          ok = g.free[c] === 1 && (k * 0.05 < 0.3 || (g.dW[c] >= BODY.pass && g.dI[c] >= 0.05));
        }
      }
      if (!ok && !nearOpening(x, z)) return false;
    }
    return true;
  }

  // ---- the head against things
  const WALLS = (k: number) => k === K.wall || k === K.rail;
  const ITEMS = (k: number) => k === K.item || k === K.hull || k === K.fixture || k === K.surface || k === K.chair || k === K.heroSet || k === K.core || k === K.monitor;
  function wallDistance(x: number, y: number, z: number) { return index.planDistance(x, z, y - 0.2, y + 0.1, WALLS, 0.3); }
  function insideItem(x: number, y: number, z: number) { return index.pointHits(x, y, z, k => (ITEMS(k) && k !== K.hull ? 0 : false)).length > 0; }

  const roomAt = (level: string | null, x: number, z: number) => (level ? nav.roomAt(level, x, z) : null);
  function visitPoint(level: string, room: WRoom): V3 | null {
    const p = nav.visitPoint(level, room); if (!p) return null;
    const lv = levelById(level)!;
    const s = snap(p[0], p[1], lv.y, 0.8, true);
    return s ? [s.x, lv.y, s.z] : null;
  }
  function bestHeading(x: number, y: number, z: number): number {
    let best = 0, bd = -1;
    for (let a = 0; a < 360; a += 15) {
      const r = (a * Math.PI) / 180, dx = -Math.sin(r), dz = -Math.cos(r);   // yaw a looks along (-sin a, -cos a)
      const h = probe.cast([x, y + 1.6, z], [dx, 0, dz], 12, false);
      const d = h ? h.t : 12;
      if (d > bd + 1e-6) { bd = d; best = a; }
    }
    return best > 180 ? best - 360 : best;
  }

  // ---- the flights
  let links: StairLink[] | null = null;
  function stairs(): StairLink[] {
    if (links) return links;
    links = world.stairs.map((s, index): StairLink => {
      const from = levelById(s.from), to = levelById(s.to);
      const d0 = s.dir0 || s.dir, d1 = s.dir;
      const cx = (s.plan.minX + s.plan.maxX) / 2, cz = (s.plan.minZ + s.plan.maxZ) / 2;
      // a spiral's ends are the column: the approach starts from its edge, not its centre
      const reach = s.spiral ? Math.max(s.plan.maxX - s.plan.minX, s.plan.maxZ - s.plan.minZ) / 2 + 0.8 : 0.9;
      const footAim: [number, number] = s.spiral ? [cx - d0[0] * reach, cz - d0[1] * reach] : [s.bottom[0] - d0[0] * reach, s.bottom[2] - d0[1] * reach];
      const topAim: [number, number] = s.spiral ? [cx + d1[0] * reach, cz + d1[1] * reach] : [s.top[0] + d1[0] * reach, s.top[2] + d1[1] * reach];
      // a flight inside the footprint is entered from inside it (not from the lot beyond a wall); an outside one (the steps up from the street to a
      // hillside front door) from the lot
      const within = (lv: WLevel | null) => !!lv && inFootprint(lv.rects, cx, cz);
      const mk = (aim: [number, number], y: number, lv: WLevel | null, face: [number, number], end: [number, number]): StairEnd => {
        const st = lv ? snap(aim[0], aim[1], lv.y, 2.6, within(lv)) : null;
        const stand: V3 | null = st ? [st.x, lv!.y, st.z] : null;
        const at: [number, number] = stand ? [stand[0], stand[2]] : aim;
        const t = 0.9, ring: V3 = [at[0] + (end[0] - at[0]) * t, y + 0.02, at[1] + (end[1] - at[1]) * t];
        return { stand, yawDeg: yawOf(face[0], face[1]), level: lv ? lv.id : '', ring };
      };
      return {
        index, from: s.from, to: s.to, shape: s.shape || s.type, spiral: s.spiral,
        foot: mk(footAim, s.bottom[1], from, [-d0[0], -d0[1]], [s.spiral ? cx : s.bottom[0], s.spiral ? cz : s.bottom[2]]),   // arriving at the foot you face away from the flight
        top: mk(topAim, s.top[1], to, d1, [s.spiral ? cx : s.top[0], s.spiral ? cz : s.top[2]]),                            // arriving at the top you face the way the flight pointed
      };
    });
    return links;
  }

  // ---- what is connected to what: the connected pieces of each storey's walkable cells (the planner's loosest tier: wall 0.18, furniture 0.06), joined by the flights
  const labels = new Map<string, { lab: Int32Array; g: Grid }>();
  function components(lv: WLevel) {
    const hit = labels.get(lv.id); if (hit) return hit;
    const g = nav.grid(lv), W = g.W, H = g.H, lab = new Int32Array(W * H).fill(-1), T = TIERS[4];
    const ok = (c: number) => g.free[c] === 1 && g.dW[c] >= T.wall && g.dI[c] >= T.item;
    let n = 0; const stack: number[] = [];
    for (let c0 = 0; c0 < W * H; c0++) {
      if (lab[c0] !== -1 || !ok(c0)) continue;
      lab[c0] = n; stack.push(c0);
      while (stack.length) {
        const c = stack.pop()!, i = c % W, j = (c - i) / W;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const nc = nj * W + ni; if (lab[nc] !== -1 || !ok(nc)) continue;
          if (di && dj && (!ok(j * W + ni) || !ok(nj * W + i))) continue;
          lab[nc] = n; stack.push(nc);
        }
      }
      n++;
    }
    const r = { lab, g }; labels.set(lv.id, r); return r;
  }
  function labelAt(level: string, x: number, z: number, r = 0.8): number {
    const lv = levelById(level); if (!lv) return -1;
    const { lab, g } = components(lv), R = Math.ceil(r / CELL), [ci, cj] = nav.cellOf(g, x, z);
    let best = -1, bd = Infinity;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= g.W || j >= g.H) continue;
      const l = lab[j * g.W + i]; if (l < 0) continue;
      const dd = Math.hypot(di, dj); if (dd < bd) { bd = dd; best = l; }
    }
    return best;
  }
  function reachableFrom(level: string, x: number, z: number) {
    // nodes are `${level}#${label}`; a flight joins the piece at its foot stand to the piece at its top stand
    const adj = new Map<string, string[]>();
    const link = (a: string, b: string) => { (adj.get(a) || adj.set(a, []).get(a)!).push(b); (adj.get(b) || adj.set(b, []).get(b)!).push(a); };
    for (const l of stairs()) {
      if (!l.foot.stand || !l.top.stand) continue;
      const a = labelAt(l.from, l.foot.stand[0], l.foot.stand[2]), b = labelAt(l.to, l.top.stand[0], l.top.stand[2]);
      if (a >= 0 && b >= 0) link(`${l.from}#${a}`, `${l.to}#${b}`);
    }
    const start = labelAt(level, x, z), seen = new Set<string>();
    if (start >= 0) { const q = [`${level}#${start}`]; seen.add(q[0]); while (q.length) for (const nb of adj.get(q.pop()!) || []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); } }
    return (lv: string, px: number, pz: number) => { const l = labelAt(lv, px, pz); return l >= 0 && seen.has(`${lv}#${l}`); };
  }

  // ---- the WorldProbe the story's XR presenter shares (PRESENTER.md section 6)
  let hullBoxes: Box6[] | null = null;
  const probeApi: WorldProbe = {
    floorY(x, z, level) {
      if (level) { const l = levelById(level); return l && inFootprint(l.rects, x, z, 0) ? l.y : null; }
      return floorAt(x, z, 0);
    },
    walkable(x, z, level, clearance = BODY.clear) {
      const l = levelById(level), r = gridFor(l, x, z);
      if (!r || (l && !r.level)) return false;
      const g = r.g, [i, j] = nav.cellOf(g, x, z);
      if (i < 0 || j < 0 || i >= g.W || j >= g.H) return false;
      const c = j * g.W + i;
      return g.free[c] === 1 && clearOf(g, c) >= clearance && g.dS[c] >= BODY.soft;
    },
    roomAt(p) {
      const l = levelAt(world, p[0], p[1], p[2]);
      const room = l ? nav.roomAt(l.id, p[0], p[2]) : null;
      return { room: room ? room.no : null, level: l ? l.id : null, indoors: !!l };
    },
    segmentClear(a, b, ignore) {
      const skip = ignore && ignore.length ? (i: number) => { const bx = index.box(i); return ignore.some(g => bx[0] < g[3] && bx[3] > g[0] && bx[1] < g[4] && bx[4] > g[1] && bx[2] < g[5] && bx[5] > g[2]); } : undefined;
      return probe.clear(a, b, true, skip);
    },
    hull() {
      if (hullBoxes) return hullBoxes;
      const out: Box6[] = [];
      for (let i = 0; i < world.kinds.length; i++) if (world.kinds[i] === K.wall || world.kinds[i] === K.glass || world.kinds[i] === K.rail) out.push(index.box(i));
      for (const l of levels) for (const r of l.rects) out.push([r.x, l.y - 0.2, r.z, r.x + r.w, l.y, r.z + r.d]);   // the slab under each footprint rect
      for (const o of world.obbs) if (o.k === K.roof) {
        const ex = [0, 1, 2].map(q => Math.abs(o.ax[q]) * o.h[0] + Math.abs(o.ax[3 + q]) * o.h[1] + Math.abs(o.ax[6 + q]) * o.h[2]);
        out.push([o.c[0] - ex[0], o.c[1] - ex[1], o.c[2] - ex[2], o.c[0] + ex[0], o.c[1] + ex[1], o.c[2] + ex[2]]);
      }
      return (hullBoxes = out);
    },
    nearestStand(from, focus, q = {}) {
      const lv = q.level !== undefined && q.level !== null ? levelById(q.level) : levelAt(world, from[0], from[1], from[2]);
      const inside = !!lv;
      const minD = q.minDist ?? (inside ? 1.6 : 3), maxD = q.maxDist ?? (inside ? 4.8 : 9);
      const plane = lv ? lv.y : floorAt(from[0], from[2], 0);
      const heights = q.eyeHeights && q.eyeHeights.length ? q.eyeHeights : [1.6, 1.2];
      // the Core is seen by the planner's own test (a grid over its faces toward the eye, its boxes excepted); any other focus by the 9 rays of poses.ts
      // with the boxes that hold the focus point itself (the thing looked at) left out
      const hero = world.hero, isCore = !!hero && Math.hypot(focus[0] - hero.centre[0], focus[1] - hero.centre[1], focus[2] - hero.centre[2]) < 0.05;
      const holds = (i: number) => { const b = index.box(i); return focus[0] >= b[0] - 0.03 && focus[0] <= b[3] + 0.03 && focus[1] >= b[1] - 0.03 && focus[1] <= b[4] + 0.03 && focus[2] >= b[2] - 0.03 && focus[2] <= b[5] + 0.03; };
      const see = (eye: V3) => (isCore ? probe.coreSeen(eye, hero!.core) >= 0.7 : probe.visibility(eye, focus, 0.15, false, holds) >= 8 / 9);
      // every standing cell in the annulus round the focus, nearest to `from` first; the first that sees the focus at every eye height wins
      const R = Math.ceil(maxD / CELL), cand: Array<[number, number, number, number]> = [];
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
        const x = focus[0] + di * CELL, z = focus[2] + dj * CELL;
        const dd = Math.hypot(x - focus[0], z - focus[2]);
        if (dd < minD || dd > maxD) continue;
        cand.push([Math.hypot(x - from[0], z - from[2]), x, z, dd]);
      }
      cand.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
      for (const [dfrom, x, z, dd] of cand) {
        const s = stand(x, z, plane);
        if (!s.ok || (s.level ? s.level.id : null) !== (lv ? lv.id : null)) continue;
        let seen = true;
        const per: boolean[] = heights.map(h => see([x, plane + h, z]));
        for (const p of per) if (!p) { seen = false; break; }
        if (!seen) continue;
        const dx = focus[0] - x, dz = focus[2] - z;
        return {
          feet: [s.x, plane, s.z], yaw: Math.atan2(-dx, -dz), level: lv ? lv.id : null, kind: dfrom < 0.3 ? 'exact' : 'derived', distance: Math.hypot(dd, focus[1] - (plane + 1.6)),
          verified: { walkable: true, seen1_6: per[heights.indexOf(1.6)] ?? true, seen1_2: per[heights.indexOf(1.2)] ?? true },
        };
      }
      return null;
    },
  };

  return { world, index, probe, nav, warm, levelById, levelFor, floorAt, stand, snap, walkFree, wallDistance, insideItem, roomAt, visitPoint, bestHeading, stairs, reachableFrom, openings: () => openings, probeApi };
}

