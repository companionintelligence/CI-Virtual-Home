// Navigation for the spline planner v2 (plan §3.6, §3.7): a 0.2 m grid per storey (and one over the lot outside),
// each cell's clearance to the nearest wall and to the nearest piece of furniture, A* on a cost that pulls the eye
// to the middle of rooms and doorways, string pulling that never trades clearance for a shortcut, door funnels,
// and the room graph the route choice reads.
//
// THREE-free: it reads the ShotWorld (assets/shot-world.ts) and its index. Deterministic: a fixed grid, a binary
// heap that breaks ties on (f, h, cell index), fixed tiers, no clock, no random.
//
//   solids at eye height — walls, glass, rails and the voids (a hole in an upper floor) at 0.40 m (0.45 m for the
//   perimeter), furniture whose box meets 0.3–2.0 m above the floor at 0.30 m, a fixture hanging below 2.0 m the
//   same; a flight of stairs blocks its own footprint on the storey it climbs from (the walk goes round it to its
//   foot, never under it); furniture under 1.1 m is soft — it gives way only on the tiers where nothing else does.
//   Ceiling lights and chandeliers that hang above 2.0 m are not floor solids (v1 blocked floor cells under them).
//   route-or-fail: a leg with no way through is null, never a straight line through a wall.
//
// Owner: S5 (shot).
import { K, inRect, inFootprint, type ShotWorld, type WLevel, type WRoom, type WorldIndex, type Rect } from './shot-world.js';

export const CELL = 0.2;
const WALL_KINDS = new Set<number>([K.wall, K.glass, K.rail]);
const ITEM_KINDS = new Set<number>([K.item, K.hull, K.fixture, K.surface, K.monitor, K.chair, K.heroSet, K.core]);
// the clearance tiers a leg tries in turn: (wall, item, soft furniture blocks?)
export const TIERS = [
  { wall: 0.42, item: 0.32, soft: true },
  { wall: 0.34, item: 0.24, soft: true },
  { wall: 0.28, item: 0.16, soft: true },
  { wall: 0.24, item: 0.1, soft: false },
  { wall: 0.18, item: 0.06, soft: false },
];

export type Grid = {
  key: string; x0: number; z0: number; W: number; H: number; y: number;
  outside: boolean;          // the lot grid (no footprint to stay in)
  free: Uint8Array;          // 1 where the eye may stand at all (in the footprint, off voids and stair footprints)
  dW: Float32Array;          // plan distance to the nearest wall solid (capped 1.5)
  dI: Float32Array;          // … to the nearest hard furniture (capped 1.5)
  dS: Float32Array;          // … to the nearest soft (low) furniture
};
export type Door = { level: string; c: [number, number]; n: [number, number]; w: number; part: number };

// ---- a binary heap with deterministic ties ------------------------------------------------------------------------
class Heap {
  f: number[] = []; h: number[] = []; id: number[] = [];
  get size() { return this.id.length; }
  clear() { this.f.length = 0; this.h.length = 0; this.id.length = 0; }
  less(a: number, b: number) { return this.f[a] < this.f[b] || (this.f[a] === this.f[b] && (this.h[a] < this.h[b] || (this.h[a] === this.h[b] && this.id[a] < this.id[b]))); }
  swap(a: number, b: number) { for (const arr of [this.f, this.h, this.id]) { const t = arr[a]; arr[a] = arr[b]; arr[b] = t; } }
  push(f: number, h: number, id: number) {
    this.f.push(f); this.h.push(h); this.id.push(id);
    let i = this.id.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!this.less(i, p)) break; this.swap(i, p); i = p; }
  }
  pop() {
    const top = this.id[0], last = this.id.length - 1;
    this.swap(0, last); this.f.pop(); this.h.pop(); this.id.pop();
    let i = 0;
    for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < this.id.length && this.less(l, m)) m = l; if (r < this.id.length && this.less(r, m)) m = r; if (m === i) break; this.swap(i, m); i = m; }
    return top;
  }
}

export function createNav(world: ShotWorld, index: WorldIndex) {
  const grids = new Map<string, Grid>();
  const levelOf = (id: string) => world.levels.find(l => l.id === id) || world.levels[0];

  function buildGrid(lv: WLevel | null, outsideY = 0): Grid {
    const key = lv ? lv.id : `outside@${outsideY.toFixed(2)}`;
    if (grids.has(key)) return grids.get(key)!;
    const outside = !lv;
    let minX, maxX, minZ, maxZ;
    if (lv) {
      minX = Math.min(...lv.rects.map(r => r.x)) - 0.4; maxX = Math.max(...lv.rects.map(r => r.x + r.w)) + 0.4;
      minZ = Math.min(...lv.rects.map(r => r.z)) - 0.4; maxZ = Math.max(...lv.rects.map(r => r.z + r.d)) + 0.4;
    } else {
      minX = -world.lot.w / 2 - 2; maxX = world.lot.w / 2 + 2; minZ = -world.lot.d / 2 - 2; maxZ = world.lot.d / 2 + 6;
    }
    const x0 = Math.floor(minX / CELL) * CELL, z0 = Math.floor(minZ / CELL) * CELL;
    const W = Math.ceil((maxX - x0) / CELL) + 1, H = Math.ceil((maxZ - z0) / CELL) + 1;
    const y = lv ? lv.y : outsideY;
    const free = new Uint8Array(W * H), dW = new Float32Array(W * H), dI = new Float32Array(W * H), dS = new Float32Array(W * H);
    const eyeLo = y + 1.2, eyeHi = y + 1.8;
    // the stair footprints on the storey they climb from
    const stairRects: Rect[] = lv ? world.stairs.filter(s => s.from === lv.id && s.plan).map(s => ({ x: s.plan.minX - 0.05, z: s.plan.minZ - 0.05, w: s.plan.maxX - s.plan.minX + 0.1, d: s.plan.maxZ - s.plan.minZ + 0.1 })) : [];
    const houseRects = outside ? world.levels.filter(l => Math.abs(l.y - outsideY) < 1.2 || l.y <= outsideY + 0.2).flatMap(l => l.rects) : [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = x0 + i * CELL, z = z0 + j * CELL, c = j * W + i;
      let ok = true;
      if (lv) {
        ok = inFootprint(lv.rects, x, z, 0.02);
        if (ok && lv.y > 0.05 && lv.voids.some(r => inRect(x, z, r, 0.05))) ok = false;
        if (ok && stairRects.some(r => inRect(x, z, r))) ok = false;
      } else {
        ok = !houseRects.some(r => inRect(x, z, r, 0.25));
      }
      free[c] = ok ? 1 : 0;
    }
    // exact plan distances, splatted box by box over the cells within MAXD of each (cheaper than a query per cell)
    const MAXD = 1.5;
    dW.fill(MAXD); dI.fill(MAXD); dS.fill(MAXD);
    const splat = (D: Float32Array, bx0: number, bz0: number, bx1: number, bz1: number) => {
      const i0 = Math.max(0, Math.floor((bx0 - MAXD - x0) / CELL)), i1 = Math.min(W - 1, Math.ceil((bx1 + MAXD - x0) / CELL));
      const j0 = Math.max(0, Math.floor((bz0 - MAXD - z0) / CELL)), j1 = Math.min(H - 1, Math.ceil((bz1 + MAXD - z0) / CELL));
      for (let j = j0; j <= j1; j++) { const z = z0 + j * CELL, dz = Math.max(bz0 - z, 0, z - bz1); for (let i = i0; i <= i1; i++) { const x = x0 + i * CELL, d = Math.hypot(Math.max(bx0 - x, 0, x - bx1), dz); const c = j * W + i; if (d < D[c]) D[c] = d; } }
    };
    const B = world.boxes;
    for (let n = 0; n < world.kinds.length; n++) {
      const k = world.kinds[n], by0 = B[6 * n + 1], by1 = B[6 * n + 4];
      const bx0 = B[6 * n], bz0 = B[6 * n + 2], bx1 = B[6 * n + 3], bz1 = B[6 * n + 5];
      if (bx1 < x0 - MAXD || bx0 > x0 + W * CELL + MAXD || bz1 < z0 - MAXD || bz0 > z0 + H * CELL + MAXD) continue;
      if ((WALL_KINDS.has(k) || (outside && k === K.site && by1 - by0 > 0.9 && by0 < y + 1.9)) && by1 >= eyeLo && by0 <= eyeHi) splat(dW, bx0, bz0, bx1, bz1);
      // furniture: anything meeting 1.1–2.0 m above this floor is hard, 0.3–1.1 m soft; fixtures only below 2.0 m;
      // outside, site things at eye height (a trunk, a post, a fence, a hedge) are hard — a storey ignores the site
      else if (ITEM_KINDS.has(k) || (outside && k === K.site)) {
        if (by1 >= y + 1.1 && by0 <= y + 2.0) splat(dI, bx0, bz0, bx1, bz1);
        else if (k !== K.fixture && by1 >= y + 0.3 && by0 <= y + 1.1) splat(dS, bx0, bz0, bx1, bz1);
      }
    }
    // oriented solids (stair flights, roofs) by their plan box: a flight on another storey that rises through this
    // one's eye band (the void is already out), a roof at eye height outside
    for (const o of world.obbs) {
      const ex = [0, 1, 2].map(r => Math.abs(o.ax[r]) * o.h[0] + Math.abs(o.ax[3 + r]) * o.h[1] + Math.abs(o.ax[6 + r]) * o.h[2]);
      const by0 = o.c[1] - ex[1], by1 = o.c[1] + ex[1];
      if (by1 < eyeLo || by0 > eyeHi) continue;
      if (o.k === K.roof && !outside) continue;
      if (o.k === K.stair && lv) continue;   // on a storey: the flight's footprint (or the void over it) is out already
      splat(dW, o.c[0] - ex[0], o.c[2] - ex[2], o.c[0] + ex[0], o.c[2] + ex[2]);
    }
    for (let c = 0; c < W * H; c++) if (!free[c]) { dW[c] = 0; dI[c] = 0; dS[c] = 0; }
    // the edge of the footprint is a wall even where no wall solid stands (an open-sided mezzanine, a void's edge)
    if (lv) edgeDistance(free, dW, W, H);
    const g = { key, x0, z0, W, H, y, outside, free, dW, dI, dS };
    grids.set(key, g);
    return g;
  }
  // the distance from each free cell to the nearest non-free cell, folded into dW (a two-pass chamfer, exact enough
  // at 0.2 m for a clearance of 0.4)
  function edgeDistance(free: Uint8Array, dW: Float32Array, W: number, H: number) {
    const D = new Float32Array(W * H), a = CELL, b = CELL * Math.SQRT2;
    for (let c = 0; c < W * H; c++) D[c] = free[c] ? 1e9 : 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const c = j * W + i; if (!D[c]) continue;
      if (i > 0) D[c] = Math.min(D[c], D[c - 1] + a);
      if (j > 0) { D[c] = Math.min(D[c], D[c - W] + a); if (i > 0) D[c] = Math.min(D[c], D[c - W - 1] + b); if (i < W - 1) D[c] = Math.min(D[c], D[c - W + 1] + b); }
    }
    for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
      const c = j * W + i; if (!D[c]) continue;
      if (i < W - 1) D[c] = Math.min(D[c], D[c + 1] + a);
      if (j < H - 1) { D[c] = Math.min(D[c], D[c + W] + a); if (i < W - 1) D[c] = Math.min(D[c], D[c + W + 1] + b); if (i > 0) D[c] = Math.min(D[c], D[c + W - 1] + b); }
    }
    // a cell centre is half a cell from its neighbour's edge
    for (let c = 0; c < W * H; c++) if (free[c]) dW[c] = Math.min(dW[c], Math.max(0, D[c] - a / 2));
  }

  const cellOf = (g: Grid, x: number, z: number) => [Math.round((x - g.x0) / CELL), Math.round((z - g.z0) / CELL)];
  const inside = (g: Grid, i: number, j: number) => i >= 0 && j >= 0 && i < g.W && j < g.H;
  /** the clearance at (x, z) on grid g: the smaller of the wall and furniture distances (0 outside the grid) */
  function clearance(g: Grid, x: number, z: number, soft = true) {
    const [i, j] = cellOf(g, x, z); if (!inside(g, i, j)) return 0;
    const c = j * g.W + i; if (!g.free[c]) return 0;
    return Math.min(g.dW[c], g.dI[c] + 0.1, soft ? g.dS[c] + 0.1 : 9);
  }
  const passable = (g: Grid, c: number, t: typeof TIERS[number]) => g.free[c] === 1 && g.dW[c] >= t.wall && g.dI[c] >= t.item && (!t.soft || g.dS[c] >= t.item);
  const stepCost = (g: Grid, c: number) => { const d = Math.max(0.05, Math.min(g.dW[c], g.dI[c] + 0.1, g.dS[c] + 0.2)); return 1 + 0.15 / (d * d); };

  // nearest passable cell to (x, z) within r metres (ring by ring, fixed order)
  function nearestFree(g: Grid, x: number, z: number, t: typeof TIERS[number], r = 1.0) {
    const [ci, cj] = cellOf(g, x, z), R = Math.round(r / CELL);
    let best = null, bd = Infinity;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const i = ci + di, j = cj + dj; if (!inside(g, i, j)) continue;
      const c = j * g.W + i; if (!passable(g, c, t)) continue;
      const d = Math.hypot(g.x0 + i * CELL - x, g.z0 + j * CELL - z);
      if (d < bd - 1e-9) { bd = d; best = [i, j]; }
    }
    return best;
  }

  /** A* from a to b on grid g at tier t: the cells, or null. The end cells snap to the nearest passable cell within
   *  `snap` metres (a stair foot against a wall, an approach beside a desk). */
  function astar(g: Grid, a: [number, number], b: [number, number], t: typeof TIERS[number], snap = 0.6) {
    const s = nearestFree(g, a[0], a[1], t, snap), e = nearestFree(g, b[0], b[1], t, snap);
    if (!s || !e) return null;
    const W = g.W, start = s[1] * W + s[0], goal = e[1] * W + e[0];
    // (one set of work buffers for the grid, reset on each search)
    const bufs = ((g as any)._astar ||= { gs: new Float64Array(g.W * g.H), came: new Int32Array(g.W * g.H), closed: new Uint8Array(g.W * g.H), heap: new Heap() });
    const gs: Float64Array = bufs.gs.fill(Infinity), came: Int32Array = bufs.came.fill(-1), closed: Uint8Array = bufs.closed.fill(0);
    const heap: Heap = bufs.heap; heap.clear();
    const hOf = (c: number) => Math.hypot((c % W) - e[0], Math.floor(c / W) - e[1]);
    gs[start] = 0; heap.push(hOf(start), hOf(start), start);
    const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (heap.size) {
      const c = heap.pop(); if (closed[c]) continue; closed[c] = 1;
      if (c === goal) break;
      const i = c % W, j = Math.floor(c / W);
      for (const [di, dj] of N8) {
        const ni = i + di, nj = j + dj; if (!inside(g, ni, nj)) continue;
        const nc = nj * W + ni; if (closed[nc] || !passable(g, nc, t)) continue;
        if (di && dj && (!passable(g, j * W + ni, t) || !passable(g, nj * W + i, t))) continue;
        const ng = gs[c] + Math.hypot(di, dj) * stepCost(g, nc);
        if (ng < gs[nc] - 1e-12) { gs[nc] = ng; came[nc] = c; const h = hOf(nc); heap.push(ng + h, h, nc); }
      }
    }
    if (!closed[goal]) return null;
    const cells: number[] = [];
    for (let c = goal; c !== -1; c = came[c]) cells.push(c);
    cells.reverse();
    return { cells, s, e };
  }

  // is the straight segment from p to q clear on g at clearance ≥ minClear (samples every 0.05 m)?
  function segClear(g: Grid, p: [number, number], q: [number, number], minClear: number, t: typeof TIERS[number]) {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(L / 0.05));
    for (let k = 0; k <= n; k++) {
      const x = p[0] + (q[0] - p[0]) * k / n, z = p[1] + (q[1] - p[1]) * k / n;
      const [i, j] = cellOf(g, x, z); if (!inside(g, i, j)) return false;
      const c = j * g.W + i;
      if (!passable(g, c, t)) return false;
      if (Math.min(g.dW[c], g.dI[c] + 0.1) < minClear) return false;
    }
    return true;
  }

  /** a leg across one grid: the string-pulled polyline from a to b (both included), or null when no tier finds a way.
   *  opts.tiers limits the tiers tried. */
  function leg(g: Grid, a: [number, number], b: [number, number], opts: { tiers?: number[]; snap?: number } = {}) {
    const tiers = (opts.tiers || TIERS.map((_, i) => i));
    for (const ti of tiers) {
      const t = TIERS[ti];
      const r = astar(g, a, b, t, opts.snap ?? 0.6);
      if (!r) continue;
      const pts: Array<[number, number]> = r.cells.map(c => [g.x0 + (c % g.W) * CELL, g.z0 + Math.floor(c / g.W) * CELL]);
      const clr = r.cells.map(c => Math.min(g.dW[c], g.dI[c] + 0.1));
      // string pull: from each kept point jump to the farthest point whose segment keeps the clearance the A* path
      // had over that stretch (never less than 0.5 m where it had more) — shortcuts never hug a wall
      const out: Array<[number, number]> = [a];
      let from = 0, cur: [number, number] = a;
      while (from < pts.length - 1) {
        let far = from + 1;
        for (let k = pts.length - 1; k > from + 1; k--) {
          let mc = Infinity; for (let m = from; m <= k; m++) mc = Math.min(mc, clr[m]);
          if (segClear(g, cur, pts[k], Math.min(0.5, mc) - 0.02, t)) { far = k; break; }
        }
        cur = pts[far]; from = far;
        if (from < pts.length - 1) out.push(cur);
      }
      out.push(b);
      // the snapped ends: a leg that started or ended off the grid's free space keeps its true end points
      let len = 0; for (let k = 1; k < out.length; k++) len += Math.hypot(out[k][0] - out[k - 1][0], out[k][1] - out[k - 1][1]);
      return { pts: out, len, tier: ti };
    }
    return null;
  }

  // ---- doors and rooms -------------------------------------------------------------------------------------------
  /** every doorway in a storey's partitions: its centre, normal (unit, either way) and width */
  function doorsOn(levelId: string): Door[] {
    const lv = levelOf(levelId); if (!lv) return [];
    const out: Door[] = [];
    lv.parts.forEach((p, i) => {
      if (p.door === null || p.door === undefined) return;
      const dx = p.b[0] - p.a[0], dz = p.b[1] - p.a[1], L = Math.hypot(dx, dz) || 1, u = [dx / L, dz / L];
      out.push({ level: lv.id, c: [p.a[0] + u[0] * p.door, p.a[1] + u[1] * p.door], n: [-u[1], u[0]], w: p.doorW || 0.9, part: i });
    });
    return out;
  }
  /** the room of a storey whose bounds hold (x, z) (the smallest, when bounds overlap), or null */
  function roomAt(levelId: string, x: number, z: number): WRoom | null {
    const lv = levelOf(levelId); if (!lv) return null;
    let best: WRoom | null = null;
    for (const r of lv.rooms) if (r.b && inRect(x, z, r.b, 0.02) && (!best || r.b.w * r.b.d < best.b.w * best.b.d)) best = r;
    return best;
  }
  /** a point to visit a room at: the most open cell near its centre (clearance counts double against distance) */
  function visitPoint(levelId: string, room: WRoom): [number, number] | null {
    const g = buildGrid(levelOf(levelId)); const b = room.b;
    const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
    let best = null, bs = -Infinity;
    for (let j = 0; j < g.H; j++) for (let i = 0; i < g.W; i++) {
      const x = g.x0 + i * CELL, z = g.z0 + j * CELL; if (!inRect(x, z, b, -0.3)) continue;
      const c = j * g.W + i; if (!passable(g, c, TIERS[0])) continue;
      const s = 2 * Math.min(1.2, Math.min(g.dW[c], g.dI[c])) - Math.hypot(x - cx, z - cz) * 0.5;
      if (s > bs + 1e-9) { bs = s; best = [x, z]; }
    }
    return best;
  }
  return { grid: buildGrid, levelOf, leg, clearance, doorsOn, roomAt, visitPoint, segClear, cellOf, passableAt: (g: Grid, x: number, z: number, ti = 0) => { const [i, j] = cellOf(g, x, z); return inside(g, i, j) && passable(g, j * g.W + i, TIERS[ti]); } };
}
export type Nav = ReturnType<typeof createNav>;

// ---- rooms: what a room is, and how much it is worth seeing (plan §3.7) -----------------------------------------
/** the program a room plays: rooms[].program (S3) when the spec gives one, else read off its name */
export function roomProgram(room: WRoom): string {
  if (room.program) return room.program;
  const n = (room.name || '').toLowerCase();
  if (/garage|carport|storage|utility|laundry|mudroom|closet|pantry|mechanical|boiler/.test(n)) return /laundry|mud/.test(n) ? 'laundry' : 'garage';
  if (/powder|wc\b|toilet/.test(n)) return 'powder';
  if (/en.?suite|bath|shower/.test(n)) return 'bath';
  if (/nursery|kid|child/.test(n)) return 'bed-kid';
  if (/bed|suite|guest|sleep|loft bed/.test(n)) return 'bed-primary';
  if (/kitchen/.test(n)) return /dining|diner/.test(n) ? 'kitchen-dining' : 'kitchen';
  if (/dining|breakfast|nook/.test(n)) return 'dining';
  if (/library/.test(n)) return 'library';
  if (/study|office|studio|work/.test(n)) return 'study';
  if (/den|snug|media|cinema|tv/.test(n)) return 'den';
  if (/sun|conservatory|garden room|greenhouse|solarium/.test(n)) return 'sunroom';
  if (/living|lounge|family|great|salon|parlou?r|sitting|bar/.test(n)) return 'living';
  if (/foyer|entry|entrance|vestibule/.test(n)) return 'foyer';
  if (/hall|landing|corridor|stair|gallery/.test(n)) return 'hall';
  if (/terrace|patio|deck|porch|balcony|court/.test(n)) return 'outdoor';
  return 'living';
}
const INTEREST: Record<string, number> = {
  living: 1.0, library: 1.0, den: 1.0, media: 1.0, kitchen: 0.9, 'kitchen-dining': 0.95, sunroom: 0.8, greenhouse: 0.8, dining: 0.7, study: 0.7, studio: 0.7, bar: 0.7,
  foyer: 0.3, 'bed-primary': 0.3, 'bed-kid': 0.3, 'bed-guest': 0.3, nursery: 0.3, bath: 0.2, ensuite: 0.2, powder: 0.1, hall: 0.1, laundry: 0.05, garage: 0, outdoor: 0.2, playroom: 0.5, gym: 0.3,
};
const FOCAL = [
  { re: /fireplace|hearth|stove/, bonus: 0.5, kind: 'fireplace' },
  { re: /island/, bonus: 0.3, kind: 'island' },
  { re: /bookcase|bookshelf|library/, bonus: 0.3, kind: 'bookcase' },
  { re: /piano/, bonus: 0.3, kind: 'piano' },
  { re: /sectional|sofa|dining-set|dining-table|platform-bed|bed\b/, bonus: 0, kind: 'anchor' },
  { re: /wall-art|art|painting|mirror/, bonus: 0.1, kind: 'art' },
];
/** a room's worth (§3.7): its program, plus its best focal item's bonus, ×2 when the spec showcases it; and that item */
export function roomInterest(room: WRoom, world: ShotWorld, stairsInRoom = false) {
  const prog = roomProgram(room);
  let base = INTEREST[prog] ?? 0.4, bonus = 0, focal: { at: [number, number]; kind: string; type: string } | null = null, focalRank = Infinity;
  const shelves = room.items.filter(it => /bookcase|bookshelf/.test(it.type)).length;
  for (const it of room.items) FOCAL.forEach((f, rank) => {
    if (!f.re.test(it.type)) return;
    if (f.kind === 'bookcase' && shelves < 2 && !/bookcase/.test(it.type)) return;
    if (rank < focalRank) { focalRank = rank; focal = { at: [it.at[0], it.at[1]], kind: f.kind, type: it.type }; bonus = Math.max(bonus, f.bonus); }
  });
  if (stairsInRoom) bonus = Math.max(bonus, 0.3);
  const show = (world.showcase || []).some(s => s && (s === room.name || s === room.no));
  return { program: prog, interest: (base + bonus) * (show ? 2 : 1), focal };
}
