// The room composer — furnishes a room from its program (rooms[].program), deterministically, THREE-free.
//
//   composeHouse(spec)        every composed room of a house → Map(room object → items), in build order, sharing one
//                             house-wide usage count (so a type repeats as little as the rooms allow) and one set of
//                             bedroom palettes (so no two bedrooms match). Cached per spec object.
//   composeRoom(spec, lv, room, opts)   one room (the dry run and compose-house.mts call it through composeHouse)
//   lanes(spec, lv, room)     the room's door-to-door circulation corridors (S5's soft nav bias)
//   snapWallMount(it, geo)    a wall-mounted item authored inside the wall, moved out to the wall's face
//   stackOnSurface(it, items) a surface item (a lamp, a vase) authored at the default desk height, lifted or lowered
//                             onto the top of whatever it stands on
//
// A Merrell-lite solver (plan S3): each program is a list of GROUPS (a seating group round a focus wall, a bed with
// its nightstands, a dining table with its chairs, a fitted kitchen …). A group generates candidate poses — along wall
// runs on a 0.1 m grid, in corners, over the floor — builds its items at each, keeps those that fit (inside the room,
// clear of every other body, of door swings, stair run-ins, the hero's approach, windows for tall pieces, and each
// piece's own clearance zones), scores them (distance to the focus, facing, symmetry, wall preference, balance,
// repetition, style) and takes the best whose placement still leaves every lane open (room-geo.ts lanesOk: 0.9 m
// door to door and door to the middle, 0.6 m to every bed side and desk chair). Then 400 fixed annealing steps move
// the groups among their candidates (Metropolis, seeded), and a move is kept only if the lanes still pass.
// Everything is seeded by mulberry32(fnv1a(`${spec.id}:${room.no}:compose`)), sorted stably and rounded to mm; no
// clock, no Math.random. Output items carry `src: 'compose@1'`.
//
// Owner: S3 (compose). Kitchen and bath packers: room-units.ts.
import { mulberry32, fnv1a } from './materials.js';
import { PROPS } from './props/index.js';
import { PLACEMENT } from './props/placement.js';
import { STYLES, styleOf, type StyleBundle } from './house-styles.js';
import { BEDROOMS, isComposed, inferProgram } from './room-programs.js';
import {
  analyzeRoom, laneGrid, lanesOk, sizeOf, paramsOf, itemObb, obb, overlap, aabb, insideRoom, rectObb, turn, rotToward, mm,
  INWARD, ROT_OF_WALL, OPPOSITE, SIDES, alongX, CENTRE_MOUNT, DEG,
  type Geo, type Obb, type Run, type Side, type Portal,
} from './room-geo.js';
import { kitchenGroups, bathGroups } from './room-units.js';

export const SRC = 'compose@1';
const GAP = 0.015;   // an item's back off the wall face

// ---- an item as the composer holds it ------------------------------------------------------------------------------
export type Layer = 'floor' | 'body' | 'wall' | 'ceiling' | 'surface';
export interface CItem {
  type: string; rot: number; params: Record<string, any>;
  cx: number; cz: number; w: number; d: number; h: number; ox: number; oz: number;
  layer: Layer; y: number;                 // y: a wall item's mount (its centre or bottom, as the prop reads it), a surface item's base
  box: Obb; clear: Obb[]; walk: Obb[];     // the body, and floor it needs kept free (its front; a bed's sides)
  gid: number; opt?: boolean; base?: CItem; tucks?: boolean; access?: Array<[number, number]>;
  pin?: boolean; obstacle?: boolean;
  /** a run unit whose front is a peninsula's bar (assets/room-units.ts): no aisle in front of it */
  peninsulaEnd?: boolean;
}
export const layerOf = (type: string): Layer => {
  const pl = PLACEMENT[type], def = PROPS.get(type);
  if (pl && pl.hangs === 'ceiling') return 'ceiling';
  if (pl && pl.hangs === 'wall') return 'wall';
  if ((pl && pl.onSurface) || (def && def.surface)) return 'surface';
  if (pl && (pl.group === 'rug' || type === 'yoga-mat')) return 'floor';
  return 'body';
};
/** vertical extent [y0, y1] of an item in the room (floor = 0) */
export function vRange(it: CItem): [number, number] {
  if (it.layer === 'wall') { const y0 = CENTRE_MOUNT.has(it.type) ? it.y - it.h / 2 : it.y; return [y0, y0 + it.h]; }
  if (it.layer === 'surface') return [it.y, it.y + it.h];
  if (it.layer === 'ceiling') return [2, 3];
  return [0, it.h];
}

// ---- the room being composed ---------------------------------------------------------------------------------------
export interface Pose { key: string; [k: string]: any }
export interface Group {
  name: string; cands: Pose[]; build: (p: Pose) => CItem[] | null; score: (p: Pose, items: CItem[]) => number;
  pose?: Pose; items?: CItem[]; value?: number; gid: number; movable: boolean; required?: boolean;
  /** the annealer moves it (the anchors whose score has a shape: seating, dining, beds, desks, free pieces) */
  anneal?: boolean;
}
export interface HouseState {
  usage: Map<string, number>; storey: Map<string, number>; palettes: string[]; styleOf: (room: any) => StyleBundle;
  /** the house's own picks per role: two types it leans to (seeded by the house, weighted by its style), so one house
   *  reads as one scheme and the next house reaches for others (the fleet's "each home looks very same") */
  prefer: Map<string, string[]>; /** every type any role of this house prefers: a type another role already prefers is favoured, so the roles that share types (rugs, runners and round rugs; the benches) settle on one */ prefAny: Set<string>; seed: string;
}

/** how many types a house prefers per role (default one): the roles a house furnishes with several kinds at once */
const PREFER_N: Record<string, number> = { armchair: 2, 'plant-floor': 4, 'plant-tall': 2, 'plant-surface': 2, 'surface-decor': 3, 'floor-lamp': 2 };
/** the groups whose pieces come as matched sets and repeat freely (the layout lint's repetition rule exempts the same) */
const REPEATS = new Set(['rug', 'lamp', 'fitted', 'appliance', 'lighting', 'chair', 'bath', 'hero', 'structure', 'decor', 'textile']);

/** how much a house takes to a type, 0..1: a stable hash of (house, type), the same in every room and every role */
const affinity = (seed: string, type: string): number => (fnv1a(`${seed}:likes:${type}`) >>> 0) / 4294967296;

/** the programs whose furniture takes a named style's colours (bedrooms always do, from their own palettes) */
const LIVED_IN = new Set(['living', 'den', 'media', 'dining', 'kitchen-dining', 'study', 'library', 'sunroom', 'foyer']);

// role → the types that can fill it, sorted (built once)
const ROLE_TYPES = new Map<string, string[]>();
function typesFor(role: string): string[] {
  let hit = ROLE_TYPES.get(role);
  if (!hit) { hit = Object.keys(PLACEMENT).sort().filter(t => PLACEMENT[t].roles.includes(role)); ROLE_TYPES.set(role, hit); }
  return hit;
}

export class Composer {
  geo: Geo; rng: () => number; style: StyleBundle; program: string; density: number;
  placed: CItem[] = []; groups: Group[] = []; pinned: CItem[] = []; nextGid = 1;
  palette: { fabric?: string; wood?: string; accent?: string } | null;
  laneW: number; baseLaneW: number; house: HouseState; spec: any; lv: any; room: any;
  focus: { side: Side; t: number; type: string } | null = null;
  constructor(spec: any, lv: any, room: any, others: CItem[], house: HouseState, seedKey: string) {
    this.spec = spec; this.lv = lv; this.room = room; this.house = house;
    this.geo = analyzeRoom(spec, lv, room);
    this.rng = mulberry32(fnv1a(seedKey));
    this.style = house.styleOf(room);
    this.program = room.program;
    this.density = typeof room.density === 'number' ? Math.max(0, Math.min(1, room.density)) : 0.5;
    this.palette = room.palette || null;
    // the pins: this room's authored items (kept exactly), and anything authored or composed in an overlapping room
    for (const it of others) this.placed.push(it);
    // the lane width this room can offer at all (a 1.6 m hall cannot give a 0.9 m lane round a pinned console)
    const want = Math.min(this.geo.b.w, this.geo.b.d) >= 3 ? 0.9 : 0.8;
    this.baseLaneW = 0.5;
    for (const w of [want, 0.8, 0.7, 0.6, 0.5]) if (w <= want && this.lanes(w).ok) { this.baseLaneW = w; break; }
    this.laneW = this.baseLaneW;
    // what the room's own geometry (stairs, voids, pins) already fails, at that width: a placement may not add to it
    this.baseFailed = new Set(lanesOk(this.geo, laneGrid(this.geo, this.blockers()), this.laneW).failed);
    if (this.laneW > 0.8) for (const f of lanesOk(this.geo, laneGrid(this.geo, this.blockers()), 0.8).failed) this.baseFailed.add(f);
  }

  // ---- sizes, types, colours
  size(type: string, params: any = {}) { return sizeOf(type, params) || { w: 0.5, d: 0.5, h: 0.5, ox: 0, oz: 0, y0: 0 }; }
  usageOf(type: string) { return this.house.usage.get(type) || 0; }
  /** a type for a role: style match × the house's own picks × repetition × fit, then a seeded weighted pick (stable order) */
  pick(role: string, { program = this.program, fit = null as ((t: string) => boolean) | null, exclude = [] as string[], weights = {} as Record<string, number> } = {}): string | null {
    const tags = this.style.tags, key = this.style.key;
    // the types the room's program allows, then those that also fit this particular call (its `fit` and `exclude`)
    const allowed = typesFor(role).filter(t => { const p = PLACEMENT[t]; return !p.programs.length || p.programs.includes(program); });
    let cands = allowed.filter(t => !exclude.includes(t) && (!fit || fit(t)));
    // a group that could not be placed is made again with other pieces: what its last try picked is set aside
    if (this.avoid.size) { const rest = cands.filter(t => !this.avoid.has(t)); if (rest.length) cands = rest; }
    if (!cands.length) return null;
    const styleW = (t: string) => { const st = PLACEMENT[t].styles; return !st.length ? 0.7 : st.includes(key) ? 3 : st.some(s => tags.includes(s)) ? 1.6 : 0.35; };
    // the house's own picks for this role — one lamp, one dresser, a couple of plants: a house reads as one scheme and
    // the next house reaches for others (the fleet's "each home looks very same"). Drawn once per (role, kind of room,
    // room seed) from the types the room's program allows, on a stream of its own (so they do not depend on the order
    // rooms ask), weighted by the style and by what the house already prefers for another role; then the only picks.
    const pk = `${role}:${program}:${this.room.seed ?? ''}`;
    let pref = this.house.prefer.get(pk);
    if (!pref) {
      const r = mulberry32(fnv1a(`${this.house.seed}:prefer:${pk}`)); pref = [];
      // one type where the role has up to five to choose from, two up to ten, three beyond (armchairs and plants: a room
      // holds a mix), so no type is in more than about half the houses
      const n = PREFER_N[role] ?? (allowed.length <= 5 ? 1 : allowed.length <= 10 ? 2 : 3);
      for (let k = 0; k < n && pref.length < allowed.length; k++) {
        const pool = allowed.filter(t => !pref!.includes(t)), ws = pool.map(t => styleW(t) * (this.house.prefAny.has(t) ? 12 : 1)), sum = ws.reduce((a, b) => a + b, 0); let x = r() * sum;
        for (let i = 0; i < pool.length; i++) { x -= ws[i]; if (x <= 0) { pref.push(pool[i]); this.house.prefAny.add(pool[i]); break; } }
      }
      this.house.prefer.set(pk, pref);
    }
    const ownOnly = cands.some(t => pref!.includes(t));   // (a `fit` that rules them all out leaves the room its own choice)
    const w = cands.map(t => {
      // a piece the lint counts (repetition: more than 2 rooms of a storey, more than 5 in a house) fades with use;
      // rugs, lamps, decor, textiles, fitted units and chairs are matched sets, and repeat freely
      const repeats = REPEATS.has(PLACEMENT[t].group), used = this.usageOf(t), onStorey = this.house.storey.get(`${this.lv.id}:${t}`) || 0;
      const fade = repeats ? 1 : Math.pow(0.6, used) * Math.pow(0.5, onStorey);
      // no pick of the house's is possible here (the call's `fit` rules them out): lean on the types the house likes best
      // — a stable, house-wide ranking of every type — rather than on chance
      const own = pref!.includes(t) ? 1 : ownOnly ? 0.02 : (this.house.prefAny.has(t) ? 12 : 1) * (0.03 + affinity(this.house.seed, t) ** 3);
      return styleW(t) * own * fade * (weights[t] ?? 1);
    });
    const sum = w.reduce((a, b) => a + b, 0); let r = this.rng() * sum, got = cands[cands.length - 1];
    for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) { got = cands[i]; break; } }
    this.pickLog.push(got);
    return got;
  }
  /** the colour a room's palette gives an item of this type (null: the house kit themes it) */
  colourFor(type: string): string | null {
    if (!this.palette) return null;
    const role = PLACEMENT[type] && PLACEMENT[type].colorRole, P = paramsOf(type);
    if (!role || !P.includes('color')) return null;
    if (role === 'fabric' || role === 'fabric2' || role === 'linen') return this.palette.fabric || null;
    if (role === 'wood') return this.palette.wood || null;
    if (role === 'accent' || role === 'rug') return this.palette.accent || null;
    return null;
  }

  // ---- items
  /** an item whose footprint box is centred at (cx, cz) */
  item(type: string, cx: number, cz: number, rot: number, params: any = {}, extra: Partial<CItem> = {}): CItem {
    const s = this.size(type, params), layer = extra.layer || layerOf(type), pl = PLACEMENT[type];
    const colour = params.color === undefined ? this.colourFor(type) : params.color;
    const p = { ...params }; if (colour) p.color = colour; else delete p.color;
    const it: CItem = { type, rot: mm(rot), params: p, cx, cz, w: s.w, d: s.d, h: s.h, ox: s.ox, oz: s.oz, layer, y: 0, box: obb(cx, cz, s.w, s.d, rot), clear: [], walk: [], gid: 0, tucks: !!(pl && pl.tucks), ...extra };
    if (pl && layer === 'body' && (pl.clear.front > 0 || pl.clear.side > 0)) {
      const cf = pl.clear.front, [fx, fz] = turn(0, s.d / 2 + cf / 2, rot);
      if (cf > 0) it.clear.push(obb(cx + fx, cz + fz, s.w + 2 * pl.clear.side, cf, rot));
    }
    return it;
  }
  /** an item backed onto a wall run at t (its centre along the run), `off` further out from the face */
  onWall(type: string, run: Run, t: number, params: any = {}, off = 0, extra: Partial<CItem> = {}): CItem {
    const s = this.size(type, params), rot = ROT_OF_WALL[run.side], [nx, nz] = INWARD[run.side];
    const n = GAP + off + s.d / 2, cx = alongX(run.side) ? t : run.face + nx * n, cz = alongX(run.side) ? run.face + nz * n : t;
    return this.item(type, cx, cz, rot, params, extra);
  }
  /** a wall-mounted item on a run at t, mounted at y (its centre or bottom as the prop reads it) */
  mount(type: string, run: Run, t: number, y: number, params: any = {}): CItem {
    const it = this.onWall(type, run, t, params, -GAP + 0.003, { layer: 'wall' }); it.y = y; it.params.y = mm(y); return it;
  }
  /** a surface item on top of a base item, at the base's local (lx, lz) */
  on(type: string, base: CItem, lx = 0, lz = 0, params: any = {}, rot = base.rot): CItem {
    const [dx, dz] = turn(lx, lz, base.rot), top = this.topOf(base);
    const it = this.item(type, base.cx + dx, base.cz + dz, rot, params, { layer: 'surface', base, opt: true });
    it.y = top; it.params.y = mm(top); return it;
  }
  topOf(base: CItem) { const pl = PLACEMENT[base.type]; return pl && pl.top !== undefined ? pl.top : base.h; }

  // ---- fitting
  /** does `it` fit against everything placed (other groups), the room, the obstacles and the keep-outs? */
  fits(it: CItem, mine: CItem[] = []): boolean {
    const g = this.geo, no = (why: string) => { this.why = `${it.type}: ${why}`; return false; };
    if (it.layer === 'ceiling' || it.layer === 'surface') return true;
    if (it.layer !== 'wall' && !insideRoom(g, it.box, 0.012)) return no('outside the room');
    // (a piece placed on looser terms may have its aisle run out through the room's open side or a door: a WC has to)
    if (!this.relaxed) {
      for (const c of it.clear) if (!insideRoom(g, c, 0.05, 1.5)) return no('its clearance leaves the room');
      for (const c of it.walk) if (!insideRoom(g, c, 0.05, 1.5)) return no('its walkway leaves the room');
    }
    const solid = it.layer === 'body' && it.h > 0.12, grp = PLACEMENT[it.type]?.group;
    if (solid) {
      for (const o of g.obstacles) if (overlap(it.box, o) > 0.005) return no('on an obstacle');
      for (const o of g.keepouts) if (overlap(it.box, o) > 0.005 && !(this.relaxed && g.soft.includes(o))) return no('in a keep-out');
      // a plant or a lamp by the glass is fine; a bed under a window is the bed group's penalty, not a veto (plan S3:
      // "not under a window unless unavoidable")
      if (grp !== 'plant' && grp !== 'lamp' && grp !== 'bed' && !(this.relaxed && (grp === 'appliance' || grp === 'fitted')) && !this.clearOfWindows(it)) return no('in front of a window');
    }
    if (it.layer === 'floor') { for (const o of g.obstacles) if (overlap(it.box, o) > 0.05) return no('rug on an obstacle'); }
    if (it.layer === 'wall' && !this.clearOfWindows(it)) return no('hung over a window');
    if (!this.relaxed) for (const c of [...it.clear, ...it.walk]) { for (const o of g.obstacles) if (overlap(c, o) > 0.02) return no('clearance on an obstacle'); }
    const others = [...this.placed, ...mine];
    for (const o of others) {
      if (o === it) continue;
      const same = o.gid === it.gid && it.gid !== 0;
      if (!this.compatible(it, o, same)) return no(`against ${o.type}${o.pin ? ' (pin)' : ''}`);
    }
    return true;
  }
  why = '';
  whys: Record<string, Record<string, number>> = {};
  /** what pick() returned since the group in hand was started, and the types set aside after a failed try of it */
  pickLog: string[] = []; avoid = new Set<string>();
  /** which try of the group in hand this is (0 first): a later try is a smaller, plainer version of it */
  attempt = 0;
  /** how much smaller a group built on this try is (0 on the first two, then 12 % a try) */
  get shrink() { return this.attempt >= 2 ? (this.attempt - 1) * 0.12 : 0; }
  /** a group that has failed twice is placed on looser terms: its aisles may lie across an obstacle, a fridge may stand in front of a glass wall */
  get relaxed() { return this.attempt >= 2; }
  compatible(a: CItem, b: CItem, same: boolean): boolean {
    if (a.layer === 'ceiling' || b.layer === 'ceiling' || a.layer === 'surface' || b.layer === 'surface') return true;
    if (a.layer === 'floor' || b.layer === 'floor') {
      if (a.layer === 'floor' && b.layer === 'floor') return overlap(a.box, b.box) < 0.02 || same;
      return true;
    }
    if (a.layer === 'wall' || b.layer === 'wall') {
      const [w, o] = a.layer === 'wall' ? [a, b] : [b, a];
      if (overlap(w.box, o.box) <= 0.01) return true;
      const [y0, y1] = vRange(w), [z0, z1] = vRange(o);
      return z1 <= y0 + 0.01 || z0 >= y1 - 0.01;
    }
    // two bodies
    const ov = overlap(a.box, b.box);
    if (ov > 0.004) {
      if (same && (a.tucks || b.tucks)) { /* a chair slides under its own table or desk */ }
      else return false;
    }
    if (!same) {
      for (const c of [...a.clear, ...a.walk]) if (overlap(c, b.box) > 0.004 && b.h > 0.12) return false;
      for (const c of [...b.clear, ...b.walk]) if (overlap(c, a.box) > 0.004 && a.h > 0.12) return false;
    }
    return true;
  }
  /** a tall piece backed onto a wall must not stand in front of its window or glass, and nothing hangs over one (a
   *  base cabinet counts as its worktop, 0.92 m: a sink's tap may stand in front of the glass) */
  clearOfWindows(it: CItem): boolean {
    const pl = PLACEMENT[it.type], worktop = pl && (pl.group === 'fitted' || pl.group === 'appliance') && pl.top !== undefined && pl.top <= 0.95;
    const [y0, y1] = it.layer === 'wall' ? vRange(it) : [0, worktop ? 0.86 : it.h];
    for (const r of this.geo.runs) for (const w of r.windows) {
      const strip = alongX(r.side) ? rectObb(w.a, r.face - 0.35, w.b, r.face + 0.35) : rectObb(r.face - 0.35, w.a, r.face + 0.35, w.b);
      if (overlap(strip, it.box) > 0.01 && y1 > w.sill - 0.03 && y0 < w.sill + w.h) return false;
    }
    return true;
  }
  blockers(extra: CItem[] = []): Obb[] {
    const out = [...this.geo.obstacles];
    for (const it of [...this.placed, ...extra]) if (it.layer === 'body' && it.h > 0.12) out.push(it.box);
    return out;
  }
  access(extra: CItem[] = []) { return [...this.placed, ...extra].flatMap(it => (it.pin ? [] : it.access || [])); }
  baseFailed = new Set<string>();
  lanes(W = this.laneW, extra: CItem[] = []) {
    const grid = laneGrid(this.geo, this.blockers(extra)), acc = this.access(extra);
    const r = lanesOk(this.geo, grid, W, acc);
    // the lint holds every room to 0.8 m whatever the composer aims for: a wider aim must pass at 0.8 too
    if (W > 0.8) for (const f of lanesOk(this.geo, grid, 0.8, acc).failed) if (!r.failed.includes(f)) r.failed.push(f);
    if (W === this.laneW && this.baseFailed.size) r.failed = r.failed.filter(f => !this.baseFailed.has(f));
    r.ok = !r.failed.length;
    return r;
  }

  // ---- groups
  /** build a group at a pose and keep what fits: every required item must, an optional one is dropped (and whatever
   *  stands on it) */
  realise(g: Group, p: Pose): CItem[] | null {
    const built = g.build(p); if (!built) return null;
    const items = [...built.filter(i => !i.opt), ...built.filter(i => i.opt)];   // the required pieces claim their floor first
    const kept: CItem[] = [];
    for (const it of items) {
      it.gid = g.gid;
      if (it.base && !kept.includes(it.base)) continue;
      if (this.fits(it, kept)) kept.push(it);
      else if (!it.opt) { const w = (this.whys[g.name] ||= {}); w[this.why] = (w[this.why] || 0) + 1; return null; }
    }
    return kept.length ? kept : null;
  }
  place(g: Group): boolean {
    g.gid = this.nextGid++;
    const scored: Array<{ p: Pose; items: CItem[]; v: number }> = [];
    for (const p of g.cands) {
      const items = this.realise(g, p); if (!items) continue;
      scored.push({ p, items, v: g.score(p, items) + this.rng() * 0.05 });
    }
    scored.sort((a, b) => b.v - a.v || (a.p.key < b.p.key ? -1 : 1));
    // the best dozen first, then a spread through the rest (a lane check is the costly part: 40 at most)
    const order = scored.length <= 40 ? scored : [...scored.slice(0, 12), ...Array.from({ length: 28 }, (_, k) => scored[12 + Math.floor(k * (scored.length - 12) / 28)])];
    for (const s of order) {
      const ln = this.lanes(this.laneW, s.items);
      if (!ln.ok) { const w = (this.whys[g.name] ||= {}); const k = 'lanes: ' + ln.failed[0]; w[k] = (w[k] || 0) + 1; continue; }
      g.pose = s.p; g.items = s.items; g.value = s.v; this.placed.push(...s.items); this.groups.push(g);
      for (const it of s.items) this.count(it.type, 1);
      return true;
    }
    return false;
  }
  count(type: string, n: number) { this.house.usage.set(type, (this.house.usage.get(type) || 0) + n); const k = `${this.lv.id}:${type}`; this.house.storey.set(k, (this.house.storey.get(k) || 0) + n); }
  /** 400 seeded annealing steps over the movable groups' candidate poses; a move that closes a lane is undone */
  anneal(steps = 400) {
    const movable = this.groups.filter(g => g.movable && g.anneal && g.cands.length > 1);
    if (!movable.length) return;
    for (let k = 0; k < steps; k++) {
      const g = movable[Math.floor(this.rng() * movable.length)], p = g.cands[Math.floor(this.rng() * g.cands.length)], u = this.rng();
      if (p === g.pose) continue;
      const old = g.items!; this.placed = this.placed.filter(it => it.gid !== g.gid);
      const items = this.realise(g, p);
      const T = 0.06 * (1 - k / steps) + 0.005;
      if (items) {
        const v = g.score(p, items), dv = v - g.value!;
        // a move that changes nothing is not worth a lane check; a worse one is taken with the Metropolis odds
        if (Math.abs(dv) > 1e-6 && (dv > 0 || u < Math.exp(dv / T)) && this.lanes(this.laneW, items).ok) {
          for (const it of old) this.count(it.type, -1); for (const it of items) this.count(it.type, 1);
          g.items = items; g.pose = p; g.value = v; this.placed.push(...items); continue;
        }
      }
      this.placed.push(...old);
    }
  }

  // ---- candidate poses
  /** positions along every wall run where a piece `len` wide fits (0.1 m grid, centred when the run is short) */
  wallPoses(len: number, { step = 0.1, runs = this.geo.runs, min = 0 } = {}): Pose[] {
    const out: Pose[] = [];
    for (const [ri, r] of runs.entries()) {
      if (r.b - r.a < Math.max(len, min) - 0.01) continue;
      const lo = r.a + len / 2, hi = r.b - len / 2;
      const n = Math.max(0, Math.floor((hi - lo) / step + 1e-6));
      const ts = n === 0 ? [(lo + hi) / 2] : Array.from({ length: n + 1 }, (_, i) => lo + i * step).concat(n * step < hi - lo - 1e-6 ? [hi] : []);
      for (const t of ts) out.push({ key: `w${ri}:${mm(t)}`, run: r, ri, t: mm(t) });
    }
    return out;
  }
  /** the room's corners that have a wall on both sides: the two runs and the corner point */
  corners() {
    const out: Array<{ key: string; a: Run; b: Run; x: number; z: number }> = [];
    for (const a of this.geo.runs) for (const b of this.geo.runs) {
      if (!alongX(a.side) || alongX(b.side)) continue;
      const x = b.face, z = a.face;
      if (x < a.a - 0.2 || x > a.b + 0.2 || z < b.a - 0.2 || z > b.b + 0.2) continue;
      out.push({ key: `c${a.side}${b.side}:${mm(x)}:${mm(z)}`, a, b, x, z });
    }
    return out.sort((p, q) => (p.key < q.key ? -1 : 1));
  }
  /** a piece in a corner, tucked into it, facing out along the diagonal (or square to one wall) */
  inCorner(type: string, c: { a: Run; b: Run; x: number; z: number }, params: any = {}, angled = false, behind = 0) {
    const s = this.size(type, params), [, az] = INWARD[c.a.side], [bx] = INWARD[c.b.side];
    // angled: turned 45° out of the corner, its back `behind` m out along the diagonal (room for a lamp behind it)
    if (angled) { const r = rotToward(bx, az), off = (Math.max(behind, Math.hypot(s.w / 2, 0) * 0.5) + s.d / 2) / Math.SQRT2 + GAP; return this.item(type, c.x + bx * off, c.z + az * off, r, params); }
    const rot = ROT_OF_WALL[c.a.side], q = Math.round(rot / 90) % 2 !== 0, hx = q ? s.d / 2 : s.w / 2, hz = q ? s.w / 2 : s.d / 2;
    return this.item(type, c.x + bx * (hx + GAP), c.z + az * (hz + GAP), rot, params);
  }
  /** points on the floor on a grid (for free-standing groups), inside the room by `margin` */
  floorPoses(step = 0.2, margin = 0.6): Pose[] {
    const b = this.geo.b, out: Pose[] = [];
    for (let x = b.x + margin; x <= b.x + b.w - margin + 1e-6; x += step) for (let z = b.z + margin; z <= b.z + b.d - margin + 1e-6; z += step) out.push({ key: `f${mm(x)}:${mm(z)}`, x: mm(x), z: mm(z) });
    return out;
  }
  inRoom(it: CItem) { const b = this.geo.b; return it.cx >= b.x - 0.05 && it.cx <= b.x + b.w + 0.05 && it.cz >= b.z - 0.05 && it.cz <= b.z + b.d + 0.05; }
  mid() { const b = this.geo.b; return [b.x + b.w / 2, b.z + b.d / 2] as [number, number]; }
  /** the room's main way in: the entry door, else the widest doorway, else the longest open span */
  mainPortal(): Portal | null {
    const ps = this.geo.portals.slice().sort((p, q) => (q.entry ? 1 : 0) - (p.entry ? 1 : 0) || (p.open ? 1 : 0) - (q.open ? 1 : 0) || q.w - p.w || (p.side < q.side ? -1 : 1));
    return ps[0] || null;
  }
  wallLen(side: Side) { return this.geo.runs.filter(r => r.side === side).reduce((a, r) => a + r.b - r.a, 0); }
  glassLen(side: Side) { return this.geo.windows.filter(w => w.side === side).reduce((a, w) => a + (w.b - w.a) * (w.type === 'window' ? 0.6 : 1), 0); }
  depthFrom(side: Side) { return alongX(side) ? this.geo.b.d : this.geo.b.w; }
  /** the run of a side whose span contains t (or the longest) */
  runAt(side: Side, t?: number) {
    const rs = this.geo.runs.filter(r => r.side === side);
    return (t !== undefined && rs.find(r => t >= r.a - 0.01 && t <= r.b + 0.01)) || rs.sort((p, q) => (q.b - q.a) - (p.b - p.a))[0] || null;
  }

  // ---- output
  output(): any[] {
    const out: any[] = [];
    const mine = this.groups.flatMap(g => g.items || []);
    for (const it of mine) {
      const [dx, dz] = turn(it.ox, it.oz, it.rot);
      const o: any = { type: it.type, at: [mm(it.cx - dx), mm(it.cz - dz)] };
      if (it.rot) o.rot = mm(it.rot);
      for (const [k, v] of Object.entries(it.params)) if (v !== undefined && v !== null && k !== 'y') o[k] = typeof v === 'number' ? mm(v) : v;
      if (it.layer === 'wall' || it.layer === 'surface') o.y = mm(it.y);
      o.src = SRC;
      out.push(o);
    }
    return out;
  }
}
const grow = (o: Obb, m: number): Obb => ({ ...o, hw: o.hw + m, hd: o.hd + m });

// ================================================================================================================
// Group builders shared by the programs
// ================================================================================================================
type C = Composer;
const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
/** a score for being near the room's middle (0 at the middle, −1 at a wall), weighted */
const central = (c: C, x: number, z: number, w = 1) => { const [mx, mz] = c.mid(); return -w * (Math.abs(x - mx) / (c.geo.b.w / 2 + 0.01) + Math.abs(z - mz) / (c.geo.b.d / 2 + 0.01)) / 2; };
/** how far from a run's middle (0 centred, 1 at an end) */
const offCentre = (r: Run, t: number) => Math.abs(t - (r.a + r.b) / 2) / Math.max(0.01, (r.b - r.a) / 2);
const nearEnd = (r: Run, t: number, len: number) => Math.min(t - len / 2 - r.a, r.b - t - len / 2);

/** one piece against a wall, with what goes on it and over it */
export function wallGroup(c: C, name: string, type: string, params: any, { score = (p: Pose, it: CItem): number => 0, dress = (it: CItem): CItem[] => [], movable = true, min = 0 }: { score?: (p: Pose, it: CItem) => number; dress?: (it: CItem) => CItem[]; movable?: boolean; min?: number } = {}): Group {
  const s = c.size(type, params);
  return {
    name, gid: 0, movable, cands: c.wallPoses(s.w, { min }),
    build: p => { const it = layerOf(type) === 'wall' ? c.mount(type, p.run, p.t, PLACEMENT[type]?.mountY ?? 1.5, params) : c.onWall(type, p.run, p.t, params); return [it, ...dress(it)]; },
    score: (p, items) => score(p, items[0]) + central(c, items[0].cx, items[0].cz, 0.15),
  };
}
/** a piece in a corner (plants, lamps, reading chairs) — corners first, else the ends of wall runs */
export function cornerGroup(c: C, name: string, type: string, params: any = {}, { angled = false, score = (it: CItem): number => 0 }: { angled?: boolean; score?: (it: CItem) => number } = {}): Group {
  const s = c.size(type, params), cs = c.corners();
  const cands: Pose[] = cs.map(k => ({ key: k.key, corner: k }));
  for (const p of c.wallPoses(s.w, { step: 0.2 })) if (nearEnd(p.run, p.t, s.w) < 0.35) cands.push(p);
  return {
    name, gid: 0, movable: true, cands,
    build: p => [p.corner ? c.inCorner(type, p.corner, params, angled) : c.onWall(type, p.run, p.t, params)],
    score: (p, items) => (p.corner ? 0.5 : 0) + score(items[0]) - 0.1 * Math.abs(central(c, items[0].cx, items[0].cz)),
  };
}
/** art centred over a piece that backs onto a wall (a sofa, a bed, a console), the top clear of the piece */
function artOver(c: C, base: CItem, run: Run, { big = false, motif = '' } = {}): CItem | null {
  const t = alongX(run.side) ? base.cx : base.cz;
  const wide = big && base.w >= 1.6 && c.rng() < 0.55;
  // a wide piece gets a gallery wall or a triptych (the style's pick), a narrow one a single picture or a hanging
  const type = wide ? (c.pick('art-wide') && c.rng() < 0.4 ? c.pick('art-wide')! : c.pick('art-large') || 'gallery-wall') : (motif ? c.pick('art', { fit: t => paramsOf(t).includes('motif') }) || 'wall-art' : c.pick('art') || 'wall-art');
  const tri = type === 'triptych';
  const w = mm(Math.min(wide ? (tri ? 1.9 : 1.8) : 1.2, Math.max(0.5, base.w * (wide ? 0.75 : 0.55))));
  const h = mm(wide ? Math.min(tri ? 0.75 : 1.0, w * (tri ? 0.42 : 0.55)) : Math.min(0.9, w * (0.6 + c.rng() * 0.35)));
  const y = mm(Math.max(1.45, base.h + 0.2 + h / 2));
  if (y + h / 2 > (c.lv.height || 2.7) - 0.15) return null;
  const pool = c.style.art, m = motif || pool[Math.floor(c.rng() * pool.length)];
  const params: any = ['wall-art', 'framed-print', 'canvas-art'].includes(type) ? { w, h, motif: m } : type === 'gallery-wall' ? { w, h, motifs: pool.join(',') } : tri || type === 'plate-set' ? { w, h } : { w: mm(Math.min(w, 0.9)) };
  const it = c.mount(type, run, t, y, params); it.opt = true; return it;
}
/** a floor rug: a patterned rug in the style's pattern, or the page's area rug */
function rug(c: C, cx: number, cz: number, w: number, d: number, rot: number, { round = false, pattern = '' } = {}): CItem {
  const pats = c.style.rugs, pat = pattern || pats[Math.floor(c.rng() * pats.length)];
  // the house's rug family: a patterned rug in its style's pattern, or the plain area / circular / concentric rugs
  const type = pattern === 'play' ? c.pick('play-rug') || 'patterned-rug' : pattern ? 'patterned-rug' : (round ? c.pick('rug-round') : c.pick('rug')) || 'patterned-rug';
  let p: any;
  if (type === 'patterned-rug') p = round ? { w: mm(w), shape: 'round', pattern: pat } : { w: mm(w), d: mm(d), pattern: pat };
  else if (paramsOf(type).includes('r')) p = { r: mm(Math.min(w, d) / 2) };
  else p = { w: mm(w), d: mm(d) };   // area, shag, flatweave and hide rugs are all w × d
  const it = c.item(type, cx, cz, rot, p); it.opt = true; return it;
}
/** a lamp or a small thing on a surface item */
function dressTop(c: C, base: CItem, kinds: string[], lx = 0): CItem[] {
  const out: CItem[] = [];
  for (const k of kinds) {
    const t = k === 'lamp' ? (c.pick('table-lamp') || 'table-lamp') : k === 'plant' ? c.pick('plant-surface') : k === 'decor' ? c.pick('surface-decor') : k;
    if (!t) continue;
    const s = c.size(t);
    if (s.w > base.w - 0.05) continue;
    out.push(c.on(t, base, lx + (out.length ? (lx >= 0 ? -1 : 1) * Math.min(0.3, base.w / 4) : 0), 0));
  }
  return out;
}

// ---- the focus wall and the seating group (living, den, media, library, sunroom) ---------------------------------
type Focus = { side: Side; t: number; type: string; pin: CItem | null };
/** the focus walls a lounge could face, best first: the room's `focus`, a pinned hearth or screen, else each wall by its
 *  solid length (or its glass, for a view), the room's depth in front of it and where the door is */
function chooseFoci(c: C, prefer: string): Focus[] {
  const g = c.geo, f = c.room.focus;
  const pinTypes = new Set(['fireplace', 'wall-tv', 'media-credenza', 'tv-stand']);
  const pin = c.placed.find(it => it.pin && pinTypes.has(it.type) && c.inRoom(it)) || null;
  const sideOfPin = (it: CItem): Side => { const [fx, fz] = turn(0, 1, it.rot); return Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 'W' : 'E') : (fz > 0 ? 'N' : 'S'); };
  if (f && f.wall) {
    const t = typeof f.at === 'number' ? f.at : Array.isArray(f.at) ? (alongX(f.wall) ? f.at[0] : f.at[1]) : null;
    const run = c.runAt(f.wall, t ?? undefined);
    return [{ side: f.wall, t: t ?? (run ? (run.a + run.b) / 2 : (alongX(f.wall) ? g.b.x + g.b.w / 2 : g.b.z + g.b.d / 2)), type: f.type || prefer, pin }];
  }
  if (pin) { const s = sideOfPin(pin); return [{ side: s, t: alongX(s) ? pin.cx : pin.cz, type: pin.type === 'fireplace' ? 'fireplace' : 'tv', pin }]; }
  const main = c.mainPortal(), out: Array<Focus & { v: number }> = [];
  for (const s of SIDES) {
    const glass = c.glassLen(s), depth = c.depthFrom(s);
    if (depth < 2.8) continue;
    for (const type of f && f.type ? [f.type] : [prefer, prefer === 'view' ? 'tv' : 'view']) {
      const run = c.runAt(s);
      let v = 0, t: number;
      if (type === 'view' || type === 'window') {
        if (glass < 1.2) continue; v = glass * 2;
        const ws = g.windows.filter(w => w.side === s).sort((p, q) => (q.b - q.a) - (p.b - p.a)); t = (ws[0].a + ws[0].b) / 2;
      } else { if (!run || run.b - run.a < 1.8) continue; v = (run.b - run.a) - glass * 0.8; t = (run.a + run.b) / 2; }
      if (type !== prefer) v -= 3;
      v += depth >= 3.4 && depth <= 6 ? 1.5 : 0;
      if (main && main.side === s) v -= 2.5;
      if (main && main.side === OPPOSITE[s]) v -= 0.6;   // the sofa's back to the door
      out.push({ side: s, t, type, pin: null, v });
    }
  }
  return out.sort((a, b) => b.v - a.v || (a.side < b.side ? -1 : 1));
}
function chooseFocus(c: C, prefer: string): Focus | null { return chooseFoci(c, prefer)[0] || null; }

/** the lounge: a focal piece (unless the focus is pinned or a view) and the seating group facing it, placed as one */
function loungeGroup(c: C, fc: Focus, opts: { big?: boolean } = {}): Group | null {
  const seat = seatingGroup(c, fc, opts); if (!seat) return null;
  const foc = fc.pin ? null : focusGroup(c, fc);
  let fixed: CItem[] = [];
  if (foc) {
    foc.gid = -1;
    const poses = foc.cands.slice().sort((a, b) => foc.score(b, []) - foc.score(a, []));
    for (const p of poses) { const items = c.realise(foc, p); if (items) { fixed = items; break; } }
    if (!fixed.length) return null;
  }
  c.focus = { side: fc.side, t: fc.t, type: fc.type };
  return { ...seat, name: 'lounge', build: p => { const items = seat.build(p); return items ? [...fixed.map(it => ({ ...it, box: it.box, clear: it.clear.slice(), walk: [] })), ...items] : null; } };
}

/** the focal piece on the focus wall: a fireplace, a media unit with the TV over it, a console with art */
function focusGroup(c: C, fc: { side: Side; t: number; type: string }): Group | null {
  const run = c.runAt(fc.side, fc.t); if (!run) return null;
  const T = fc.type;
  if (T === 'view' || T === 'window' || T === 'island' || T === 'bed') return null;
  let base: string, params: any = {};
  if (T === 'fireplace') base = 'fireplace';
  else if (T === 'tv') { base = c.pick('media') || 'media-credenza'; if (base === 'tv-stand') params = { w: 1.6 }; }
  else base = c.pick('console') || 'console-table';
  const s = c.size(base, params);
  const cands = c.wallPoses(s.w, { runs: [run] }).filter(p => Math.abs(p.t - fc.t) <= 0.6);
  return {
    name: 'focus', gid: 0, movable: false, cands,
    build: p => {
      const it = c.onWall(base, run, p.t, params); const out = [it];
      if (T === 'tv' && base !== 'tv-stand') { const tv = c.mount('wall-tv', run, p.t, mm(Math.max(1.25, it.h + 0.6)), { w: mm(Math.min(1.9, Math.max(1.3, s.w * 0.85))), h: mm(Math.min(1.9, Math.max(1.3, s.w * 0.85)) * 0.5625) }); out.push(tv); }
      else { const a = artOver(c, it, run, { big: T !== 'fireplace' }); if (a) { a.opt = true; out.push(a); } }
      if (T === 'art' || T === 'fireplace') out.push(...dressTop(c, it, T === 'fireplace' ? ['decor'] : ['lamp', 'decor']));
      return out;
    },
    score: p => -Math.abs(p.t - fc.t),
  };
}

/** the seating group facing the focus: sofa (or an L), coffee table, rug under the front legs, one or two chairs at
 *  30–45°, side tables with lamps, art over the sofa when its back is to a wall */
function seatingGroup(c: C, fc: { side: Side; t: number; type: string }, { big = true } = {}): Group | null {
  const g = c.geo, n = INWARD[fc.side], depth = c.depthFrom(fc.side), lat = alongX(fc.side) ? [g.b.x, g.b.x + g.b.w] : [g.b.z, g.b.z + g.b.d];
  const face = (() => { const r = c.runAt(fc.side, fc.t); return r ? r.face : (fc.side === 'N' ? g.b.z : fc.side === 'S' ? g.b.z + g.b.d : fc.side === 'W' ? g.b.x : g.b.x + g.b.w); })();
  const width = lat[1] - lat[0];
  const roomy = depth >= 4.2 && width >= 4.2 && g.area >= 22;
  // a sectional by the room's size: the modular (compact), the L, and in a big room the U (the page's plain `sectional`
  // builder is left to hand-authored rooms: it has no size or hand)
  const uRoom = width >= 5.4 && depth >= 5.2 && g.area >= 30;
  let sofa = roomy && big && c.attempt === 0 && c.rng() < 0.5 ? c.pick('sofa-l', { fit: t => t !== 'sectional' && (t !== 'u-sectional' || uRoom) }) : null;
  if (!sofa) sofa = c.pick('sofa', { fit: t => (c.size(t).w <= width - 0.8) });
  if (!sofa) return null;
  const sw = mm(Math.min(sofa === 'loveseat' ? (width >= 3.4 ? 2.0 : 1.6) : c.size(sofa).w, width - 1.0) * (1 - c.shrink));
  const sParams: any = paramsOf(sofa).includes('w') ? { w: mm(sw) } : {};
  const isU = sofa === 'u-sectional', isL = PLACEMENT[sofa].roles.includes('sofa-l') && !isU;
  if (isL || isU) { sParams.w = mm(Math.min(isU ? 3.8 : 3.0, width - 1.2)); sParams.l = mm(Math.min(isU ? 2.0 : 1.9, depth - 2.6)); if (isL) sParams.hand = c.rng() < 0.5 ? 'left' : 'right'; }
  const S = c.size(sofa, sParams);
  const ct = c.pick('coffee-table', { fit: t => c.size(t).w <= S.w - 0.3 }) || 'coffee-table';
  const ctP: any = ct === 'coffee-table' ? { w: mm(Math.min(1.3, S.w * 0.55)), d: 0.6 } : ct === 'ottoman' ? { w: 0.9, d: 0.6 } : {};
  const CT = c.size(ct, ctP);
  const nChairs = c.density < 0.3 || isU ? 0 : width >= S.w + 2.4 ? (c.density >= 0.6 ? 2 : 1 + (c.rng() < 0.5 ? 1 : 0)) : width >= S.w + 1.3 ? 1 : 0;
  const chair = nChairs ? c.pick('armchair') : null;
  const turnToward = fc.type === 'fireplace' || fc.type === 'art' ? 1 : -1;
  const chairSides = nChairs === 2 ? [-1, 1] : nChairs === 1 ? [c.rng() < 0.5 ? -1 : 1] : [];
  const facingRot = ROT_OF_WALL[OPPOSITE[fc.side]], lx = turn(1, 0, facingRot), latSign = Math.sign(alongX(fc.side) ? lx[0] : lx[1]) || 1;
  const chaiseLat = isL ? (sParams.hand === 'right' ? -1 : 1) * latSign : 0;   // the world lateral side the chaise is on
  const chaiseSides = isU ? [-1, 1] : chaiseLat ? [chaiseLat] : [];                // (a U has one at each end)
  const oppFace = (() => { const r = c.runAt(OPPOSITE[fc.side]); return r ? Math.abs(r.face - face) : Infinity; })();   // chairs turn to the sofa (conversation) or to the focus (a screen, a view)
  const lampOn = c.density >= 0.3;
  const Ds: number[] = []; for (let D = 1.6; D <= 3.4 + 1e-6; D += 0.1) Ds.push(mm(D));
  // how far from the focus the sofa likes to stand and how far off its middle: a room's own taste, so two rooms of one
  // size do not come out as one
  const dT = 2.3 + c.rng() * 0.9, oT = (c.rng() - 0.5) * 0.9;
  const cands: Pose[] = [];
  const oLo = lat[0] + S.w / 2 + 0.05 - fc.t, oHi = lat[1] - S.w / 2 - 0.05 - fc.t;
  for (const D of Ds) for (let o = Math.ceil(oLo * 10) / 10; o <= oHi + 1e-6; o += 0.1) {
    if (D + S.d > depth - 0.05) continue;
    cands.push({ key: `s${D}:${mm(o)}`, D, o: mm(o) });
  }
  // an L's chaise must not cut across the walk to the door: it faces +z in its own frame, so it turns with the sofa
  const at = (N: number, L: number): [number, number] => alongX(fc.side) ? [mm(fc.t + L), mm(face + n[1] * N)] : [mm(face + n[0] * N), mm(fc.t + L)];
  const facing = ROT_OF_WALL[OPPOSITE[fc.side]];   // the sofa faces the focus wall
  return {
    name: 'seating', gid: 0, movable: true, anneal: true, cands,
    build: p => {
      const out: CItem[] = [];
      const [sx, sz] = at(p.D + S.d / 2, p.o);
      // an L-sectional's box centre is the footprint's centre, its seat run along the back; flip its chaise to the
      // side away from the room's main door
      const sofaIt = c.item(sofa, sx, sz, facing, sParams); out.push(sofaIt);
      const frontN = p.D;   // the sofa's front edge, measured from the focus wall's face
      const ctN = frontN - 0.45 - CT.d / 2;
      if (ctN - CT.d / 2 > 0.6) { const [x, z] = at(ctN, p.o - chaiseLat * 0.35); const ci = c.item(ct, x, z, facing, ctP); ci.opt = isL || isU; out.push(ci); }
      // the rug: under the sofa's front legs, out past the table
      const rd = Math.max(1.6, Math.min(3.0, frontN - 0.3 + 0.35)), rw = Math.max(2.0, Math.min(S.w + 0.6, width - 0.6));
      const [rx, rz] = at(frontN + 0.35 - rd / 2, p.o), r = rug(c, rx, rz, alongX(fc.side) ? rw : rd, alongX(fc.side) ? rd : rw, 0);
      out.push(r);
      // chairs flanking the table, turned 35–45° toward the sofa (a hearth, art) or the focus (a screen, a view)
      if (chair) for (const s2 of chairSides) {
        if (chaiseSides.includes(s2)) continue;
        const CH = c.size(chair), L = p.o + s2 * (Math.max(CT.w, S.w * 0.6) / 2 + 0.35 + CH.w / 2), N = Math.max(0.9, ctN);
        const [x, z] = at(N, L);
        const inw: [number, number] = alongX(fc.side) ? [-s2, 0] : [0, -s2], ang = (35 + c.rng() * 10) * DEG, tw = turnToward > 0 ? 1 : -1;
        const fx = inw[0] * Math.cos(ang) + tw * n[0] * Math.sin(ang), fz = inw[1] * Math.cos(ang) + tw * n[1] * Math.sin(ang);
        const ci = c.item(chair, x, z, rotToward(fx, fz)); ci.opt = true; out.push(ci);
      }
      // side tables and their lamps at the sofa's ends (not at a chaise)
      for (const s2 of [-1, 1]) {
        if (chaiseSides.includes(s2)) continue;
        const st = c.density >= 0.35 || s2 < 0 ? (c.pick('side-table') || 'side-table') : null; if (!st) continue;
        const ST = c.size(st), [x, z] = at(p.D + S.d - ST.d / 2 - 0.05, p.o + s2 * (S.w / 2 + 0.06 + ST.w / 2));
        const si = c.item(st, x, z, facing); si.opt = true; out.push(si);
        if (lampOn && (s2 < 0 || c.density >= 0.6)) out.push(...dressTop(c, si, ['lamp']));
      }
      // art over the sofa when its back is to a wall
      if (Math.abs(oppFace - (p.D + S.d + GAP)) < 0.1) { const opp = c.runAt(OPPOSITE[fc.side], fc.t + p.o); if (opp) { const a = artOver(c, sofaIt, opp, { big: true }); if (a) out.push(a); } }
      return out;
    },
    score: (p, items) => {
      let v = -Math.abs(p.D - dT) * 1.2 - Math.abs(p.o - oT) * 0.8 - (p.D < 2.2 ? 0.8 : 0);
      const backGap = depth - (p.D + S.d);
      if (backGap < 0.12) v += 0.5; else if (backGap < 0.85) v -= 1.2;
      v += items.filter(i => PLACEMENT[i.type]?.group === 'seating').length * 0.25 + items.length * 0.05;
      return v;
    },
  };
}

// ---- the dining table and its chairs --------------------------------------------------------------------------------
function diningGroup(c: C, region: { x0: number; z0: number; x1: number; z1: number } | null = null): Group | null {
  const g = c.geo, R = region || { x0: g.b.x, z0: g.b.z, x1: g.b.x + g.b.w, z1: g.b.z + g.b.d };
  const W = R.x1 - R.x0, D = R.z1 - R.z0, along = W >= D, long = Math.max(W, D), short = Math.min(W, D);
  if (short < 2.2) return null;
  const round = (long < 3.4 || long - short < 0.6) && c.rng() < 0.7;
  const type = round ? (c.pick('dining-table-round') || 'round-dining-table') : (c.pick('dining-table') || 'farmhouse-table');
  const isRound = PLACEMENT[type].roles.includes('dining-table-round') && (type === 'round-dining-table' || type === 'pedestal-dining-table');
  const chair = c.pick('dining-chair') || 'dining-chair';
  let tp: any, L: number, Wd: number;
  // a retry (the room is tight) is a smaller table
  const k = 1 - c.shrink;
  if (isRound) { const r = mm(Math.max(0.45, Math.min(0.75, (short - 2.4) / 2 + 0.5) * k)); tp = { r }; L = Wd = 2 * r; }
  else { L = mm(Math.max(1.1, Math.min(2.6, Math.round((long - 2.5) * 10) / 10) * k)); Wd = mm(Math.max(0.7, Math.min(1.0, short - 2.4) * k)); tp = { w: L, d: Wd }; }
  const colour = c.colourFor(type); if (colour) tp.color = colour;
  const rot = isRound ? 0 : (along ? 0 : 90);
  const perSide = isRound ? 0 : Math.max(1, Math.min(4, Math.floor((L - 0.1) / 0.62))), ends = !isRound && long - L >= 2 * 1.3 && L >= 1.5;
  const nRound = isRound ? (L >= 1.3 ? 6 : L >= 1.1 ? 4 : 3) : 0;
  const main = c.mainPortal();
  const mg = 0.9 - c.shrink * 0.8;
  const cands = c.floorPoses(0.1, mg).filter(p => p.x >= R.x0 + mg && p.x <= R.x1 - mg && p.z >= R.z0 + mg && p.z <= R.z1 - mg);
  const hung = c.style.tags.some(t => ['farmhouse', 'cottage', 'mediterranean', 'craftsman', 'traditional'].includes(t)) && c.rng() < 0.6 ? 'chandelier' : 'pendant-lamp';
  return {
    name: 'dining', gid: 0, movable: true, anneal: true, cands,
    build: p => {
      const t = c.item(type, p.x, p.z, rot, tp), out = [t]; t.clear = [];
      const chairAt = (lx: number, lz: number, face: number) => { const [dx, dz] = turn(lx, lz, rot); return c.item(chair, p.x + dx, p.z + dz, face); };
      if (isRound) for (let k = 0; k < nRound; k++) { const a = k / nRound * Math.PI * 2 + Math.PI / 4, R2 = L / 2 + 0.2; out.push(chairAt(Math.sin(a) * R2, Math.cos(a) * R2, rotToward(-Math.sin(a), -Math.cos(a)))); }
      else {
        for (let i = 0; i < perSide; i++) {
          const lx = -L / 2 + L / perSide * (i + 0.5);
          out.push(chairAt(lx, -(Wd / 2 + 0.2), mm(rot)));
          out.push(chairAt(lx, Wd / 2 + 0.2, mm(rot + 180)));
        }
        if (ends) { const e1 = chairAt(-(L / 2 + 0.22), 0, mm(rot + 90)), e2 = chairAt(L / 2 + 0.22, 0, mm(rot + 270)); e1.opt = e2.opt = true; out.push(e1, e2); }
      }
      // 0.6 m behind every chair, to pull it out (the plan's 0.9 where the room allows: the score)
      { const back = 0.6 - c.shrink * 1.2; for (const ch of out.slice(1)) { const [bx, bz] = turn(0, -(0.25 + back / 2), ch.rot); ch.walk.push(obb(ch.cx + bx, ch.cz + bz, 0.5, back, ch.rot)); } }
      if (c.density >= 0.35) out.push(rug(c, p.x, p.z, isRound ? L + 1.4 : L + 1.3, isRound ? L + 1.4 : Wd + 1.4, rot, { round: isRound && c.rng() < 0.6 }));
      // light over the table (fixtures.ts leaves a table that has one alone)
      if ((c.lv.height || 2.7) >= 2.5) {
        if (hung === 'chandelier' || isRound || L < 1.8) { const hl = c.item(hung, p.x, p.z, rot, hung === 'chandelier' ? { w: mm(Math.min(0.9, L * 0.45)), drop: 0.8 } : { drop: 0.85 }, { layer: 'ceiling', opt: true }); out.push(hl); }
        else for (const s of [-1, 1]) { const [dx, dz] = turn(s * L / 4, 0, rot); out.push(c.item('pendant-lamp', p.x + dx, p.z + dz, rot, { drop: 0.85 }, { layer: 'ceiling', opt: true })); }
      }
      { const dt = c.pick(c.rng() < 0.5 ? 'surface-decor' : 'surface-decor-kitchen'); if (dt) out.push(c.on(dt, t, 0, 0)); }
      return out;
    },
    score: (p, items) => {
      let v = central(c, p.x, p.z, 1.5) + items.length * 0.1;
      if (main && !main.open) { const ax = alongX(main.side) ? Math.abs(p.x - main.x) : Math.abs(p.z - main.z); v -= Math.min(1, ax / 2) * 0.4; }   // on the entry axis
      for (const ch of items) for (const wz of ch.walk) { const back = { ...wz, hd: wz.hd + 0.15 }; if (!insideRoom(g, back, 0.05, 1.5)) v -= 0.15; }
      return v;
    },
  };
}

// ---- beds ---------------------------------------------------------------------------------------------------------
function bedGroup(c: C, attempt = 0): Group | null {
  const g = c.geo, prog = c.program, kid = prog === 'bed-kid', nursery = prog === 'nursery';
  const role = nursery ? 'crib' : kid ? (c.rng() < 0.18 && g.area < 10 ? 'bed-bunk' : c.rng() < 0.15 ? 'bed-loft' : 'bed-single') : 'bed';
  const type = c.pick(role) || (kid ? 'single-bed' : 'headboard-bed');
  const P = paramsOf(type);
  const minDim = Math.min(g.b.w, g.b.d);
  const bw0 = kid || nursery ? undefined : prog === 'bed-primary' ? (minDim >= 3.9 ? 1.8 : 1.6) : (minDim >= 3.4 ? 1.5 : 1.4);
  const bw = bw0 === undefined ? undefined : Math.max(1.2, bw0 - attempt * 0.2);   // a retry is a narrower bed
  const params: any = {};
  if (bw && P.includes('w') && type !== 'platform-bed') params.w = bw;
  if (P.includes('quilt') && c.rng() < 0.45) params.quilt = c.style.rugs[Math.floor(c.rng() * c.style.rugs.length)] === 'solid' ? 'check' : c.style.rugs[Math.floor(c.rng() * c.style.rugs.length)];
  const S = c.size(type, params);
  const double = S.w >= 1.3;
  const main = c.mainPortal();
  const cands: Pose[] = [];
  for (const p of c.wallPoses(S.w)) cands.push({ ...p, key: 'h' + p.key, mode: 'head' });
  for (const k of c.corners()) for (const [wallA, wallB] of [[k.a, k.b], [k.b, k.a]]) cands.push({ key: `k${k.key}:${wallA.side}`, mode: 'side', head: wallB, side: wallA, x: k.x, z: k.z });
  const ns = nursery ? null : (c.pick('nightstand') || 'nightstand');
  const NS = ns ? c.size(ns) : null;
  const sconces = double && c.style.tags.some(t => ['modern', 'scandi', 'mid-century'].includes(t)) && c.rng() < 0.35;
  return {
    name: 'bed', gid: 0, movable: true, anneal: true, cands,
    build: p => {
      let bed: CItem, headRun: Run, t: number, sideSign = 0;
      if (p.mode === 'head') { headRun = p.run; t = p.t; bed = c.onWall(type, headRun, t, params); }
      else {
        // the long side along wall `side`, the head against the corner's other wall
        headRun = p.head; const [ax, az] = INWARD[p.side.side], [hx, hz] = INWARD[headRun.side];
        const rot = ROT_OF_WALL[headRun.side], cx = p.x + ax * (S.w / 2 + GAP) + hx * (S.d / 2 + GAP), cz = p.z + az * (S.w / 2 + GAP) + hz * (S.d / 2 + GAP);
        bed = c.item(type, cx, cz, rot, params); t = alongX(headRun.side) ? cx : cz;
        const [lx] = turn(ax, az, -rot); sideSign = lx > 0 ? 1 : -1;   // the side the wall is on, in the bed's frame
      }
      const out = [bed];
      // walkways: 0.6 m beside the bed (both sides of a double; the open side of a single), past the nightstands
      for (const s of [-1, 1]) {
        if (sideSign && s === sideSign) continue;
        const [dx, dz] = turn(s * (S.w / 2 + 0.3), 0.25, bed.rot); bed.walk.push(obb(bed.cx + dx, bed.cz + dz, 0.6, S.d - 0.5, bed.rot));
        const [ax2, az2] = turn(s * (S.w / 2 + 0.3), 0.3, bed.rot); (bed.access ||= []).push([bed.cx + ax2, bed.cz + az2]);
        if (!double) break;
      }
      const [fx, fz] = turn(0, S.d / 2 + 0.3, bed.rot); bed.clear = [obb(bed.cx + fx, bed.cz + fz, S.w, 0.6, bed.rot)];
      if (ns && NS) for (const s of [-1, 1]) {
        if (sideSign && s === sideSign) continue;
        const [dx, dz] = turn(s * (S.w / 2 + 0.04 + NS.w / 2), -S.d / 2 + NS.d / 2 + 0.02, bed.rot);
        const n1 = c.item(ns, bed.cx + dx, bed.cz + dz, bed.rot); n1.opt = true; out.push(n1);
        if (sconces) { const tt = alongX(headRun.side) ? n1.cx : n1.cz; const sc = c.mount('wall-sconce', headRun, tt, 1.2); sc.opt = true; out.push(sc); }
        else out.push(c.on(kid && c.rng() < 0.5 ? 'desk-lamp' : (c.pick('table-lamp') || 'table-lamp'), n1, 0, -0.03));
        if (!double) break;
      }
      // art over the bed; a kid's room gets a story picture
      const motif = kid ? ['story-balloon', 'story-whale', 'animal', 'story-moon'][Math.floor(c.rng() * 4)] : nursery ? 'story-moon' : '';
      const a = artOver(c, bed, headRun, { big: double, motif }); if (a) out.push(a);
      // a rug under the lower two-thirds, a bench at the foot of a primary bed
      if (c.density >= 0.3 && !nursery) {
        const rw = S.w + (double ? 1.2 : 0.8), rd = S.d * 0.62 + 0.5, [dx, dz] = turn(0, S.d / 2 - rd / 2 + 0.5, bed.rot);
        out.push(rug(c, bed.cx + dx, bed.cz + dz, rw, rd, bed.rot, { pattern: kid ? 'play' : '' }));
      }
      if (prog === 'bed-primary' && c.density >= 0.35) {
        const bt = c.pick('bed-bench', { fit: t => c.size(t).w <= S.w }) ;
        if (bt) { const BP: any = paramsOf(bt).includes('w') ? { w: mm(Math.min(S.w - 0.2, 1.4)) } : {}; const B = c.size(bt, BP), [dx, dz] = turn(0, S.d / 2 + 0.05 + B.d / 2, bed.rot); const bi = c.item(bt, bed.cx + dx, bed.cz + dz, bed.rot, BP); bi.opt = true; bi.clear = []; out.push(bi); }
      }
      return out;
    },
    score: (p, items) => {
      const bed = items[0];
      let v = 0;
      const head = p.mode === 'head' ? (p.run as Run) : (p.head as Run);
      if (main) { if (head.side === main.side) v -= 2.5; else if (head.side === OPPOSITE[main.side]) v += 0.8; else v += 0.4; }
      for (const w of head.windows) { const t0 = (alongX(head.side) ? bed.cx : bed.cz) - S.w / 2, t1 = t0 + S.w; if (w.b > t0 && w.a < t1) v -= 1.5; }
      if (p.mode === 'head') v -= offCentre(p.run, p.t) * 0.6; else v += double ? -1.5 : 0.3;   // a double against a wall only when nothing else fits
      v += items.length * 0.15;
      return v;
    },
  };
}

// ---- a desk with its chair and lamp (study, library, kid's room, guest room) -------------------------------------
function deskGroup(c: C, { kid = false } = {}): Group | null {
  const type = kid ? 'kids-desk' : (c.pick('desk') || 'writing-desk');
  const params: any = type === 'writing-desk' ? { w: 1.2 } : {};
  const S = c.size(type, params), chair = kid ? null : (c.pick('desk-chair') || 'dining-chair');
  const main = c.mainPortal();
  return {
    name: 'desk', gid: 0, movable: true, anneal: true, cands: c.wallPoses(S.w),
    build: p => {
      const d = c.onWall(type, p.run, p.t, params), out = [d];
      if (chair) { const [dx, dz] = turn(0, S.d / 2 + 0.18, d.rot); const ch = c.item(chair, d.cx + dx, d.cz + dz, mm(d.rot + 180)); out.push(ch); d.access = [[d.cx + dx * 2.2, d.cz + dz * 2.2]]; }
      out.push(c.on(kid || c.rng() < 0.6 ? 'desk-lamp' : (c.pick('table-lamp') || 'table-lamp'), d, S.w / 2 - 0.2, -0.1));
      if (!kid) out.push(c.on(c.rng() < 0.5 ? 'laptop' : (c.pick('surface-decor') || 'book-stack'), d, -0.1, 0));
      const a = c.rng() < 0.5 ? artOver(c, d, p.run, {}) : null; if (a) out.push(a);
      return out;
    },
    score: (p) => {
      let v = -offCentre(p.run, p.t) * 0.2;
      // perpendicular to a window: a window on a neighbouring wall near the desk; not facing the door's wall
      for (const w of c.geo.windows) if (w.side !== p.run.side && w.side !== OPPOSITE[p.run.side]) v += 0.4;
      if (p.run.windows.length) v -= 0.3;
      if (main && main.side === p.run.side) v -= 0.5;
      return v;
    },
  };
}

// ---- simple wall pieces ---------------------------------------------------------------------------------------------
function storageGroup(c: C, role: string, { name = role, dress = true, prefer = null as ((p: Pose, it: CItem) => number) | null, params = {} as any } = {}): Group | null {
  const type = c.pick(role); if (!type) return null;
  const pr = { ...params }; const P = paramsOf(type);
  for (const k of Object.keys(pr)) if (!P.includes(k)) delete pr[k];
  return wallGroup(c, name, type, pr, {
    score: (p, it) => (prefer ? prefer(p, it) : 0) - offCentre(p.run, p.t) * 0.1,
    dress: it => {
      if (!dress) return [];
      const out: CItem[] = []; const pl = PLACEMENT[it.type];
      if (pl && pl.top !== undefined && it.h < 1.2) {
        out.push(...dressTop(c, it, c.density >= 0.5 ? ['lamp', 'decor'] : ['decor']));
        const run = (c.geo.runs.find(r => r.side === sideOfRot(it.rot) && (alongX(r.side) ? it.cx : it.cz) >= r.a && (alongX(r.side) ? it.cx : it.cz) <= r.b));
        if (run && c.rng() < 0.7) { const a = c.rng() < 0.35 && (role === 'dresser' || role === 'console') ? c.mount('round-mirror', run, alongX(run.side) ? it.cx : it.cz, mm(it.h + 0.6), { r: mm(Math.min(0.45, it.w * 0.3)) }) : artOver(c, it, run, {}); if (a) { a.opt = true; out.push(a); } }
      }
      return out;
    },
  });
}
const sideOfRot = (rot: number): Side => { const r = ((Math.round(rot) % 360) + 360) % 360; return r === 0 ? 'N' : r === 180 ? 'S' : r === 90 ? 'W' : 'E'; };
function plantGroup(c: C, role = 'plant-floor'): Group | null { const t = c.pick(role); return t ? cornerGroup(c, 'plant', t) : null; }
function floorLampGroup(c: C): Group | null { const t = c.pick('floor-lamp'); return t ? cornerGroup(c, 'floor-lamp', t) : null; }
/** a reading corner: an armchair turned out of a corner, a floor lamp behind it, a side table */
function readingCorner(c: C): Group | null {
  const chair = c.pick('reading-chair') || c.pick('armchair'); if (!chair) return null;
  const lamp = c.pick('floor-lamp') || 'floor-lamp';
  const ks = c.corners();
  return {
    name: 'reading', gid: 0, movable: true, anneal: true, cands: ks.map(k => ({ key: k.key, k })),
    build: p => {
      const [, az] = INWARD[p.k.a.side], [bx] = INWARD[p.k.b.side];
      const ch = c.inCorner(chair, p.k, {}, true, 0.62), out = [ch];
      const lp = c.item(lamp, p.k.x + bx * (0.2 + GAP), p.k.z + az * (0.2 + GAP), ch.rot); lp.opt = true; out.push(lp);
      const CH = c.size(chair), [dx, dz] = turn(CH.w / 2 + 0.32, 0.1, ch.rot);
      const st = c.item('side-table', ch.cx + dx, ch.cz + dz, ch.rot); st.opt = true; out.push(st, ...dressTop(c, st, c.rng() < 0.5 ? ['decor'] : ['plant']));
      ch.access = [[ch.cx + turn(0, 0.7, ch.rot)[0], ch.cz + turn(0, 0.7, ch.rot)[1]]];
      return out;
    },
    score: (p, items) => items.length * 0.2 - 0.2 * Math.abs(central(c, p.k.x, p.k.z)),
  };
}
/** a run of 2–4 matching tall bookcases side by side on one wall, the library's wall of books (never in front of a
 *  window: a bookcase is tall) */
function bookcaseRun(c: C, most = 4): Group | null {
  const tall = c.pick('bookcase', { fit: t => c.size(t).h >= 1.6 }) || 'bookshelf';
  const unit = c.size(tall), cands: Pose[] = [];
  for (let n = most; n >= 2; n--) for (const p of c.wallPoses(unit.w * n + 0.02 * (n - 1))) cands.push({ ...p, key: `${n}:${p.key}`, n });
  return {
    name: 'bookcases', gid: 0, movable: false, cands,
    build: p => { const len = unit.w * p.n + 0.02 * (p.n - 1), out: CItem[] = []; for (let i = 0; i < p.n; i++) out.push(c.onWall(tall, p.run, p.t - len / 2 + unit.w / 2 + i * (unit.w + 0.02), {})); return out; },
    score: p => p.n * 0.6 - offCentre(p.run, p.t) * 0.3 + (p.run.b - p.run.a) * 0.05,
  };
}

function runnerGroup(c: C): Group | null {
  const g = c.geo, along = g.b.w >= g.b.d, L = (along ? g.b.w : g.b.d) - 0.8, wid = Math.min(1.0, (along ? g.b.d : g.b.w) - 0.6);
  if (L < 1.2 || wid < 0.6) return null;
  const type = c.pick('runner') || 'runner-rug';
  const [mx, mz] = c.mid(), cands: Pose[] = [];
  // runners of a few lengths slid along the hall and a little across it, so a stair or a pinned console can be avoided
  for (const len of [3.0, 2.4, 1.8, 1.4]) {
    if (len > L + 1e-6) continue;
    for (let o = -(L - len) / 2; o <= (L - len) / 2 + 1e-6; o += 0.2) for (const q of [0, -0.25, 0.25]) cands.push({ key: `r${len}:${mm(o)}:${q}`, len, o: mm(o), q });
  }
  return {
    name: 'runner', gid: 0, movable: false, cands,
    build: p => [c.item(type, along ? mx + p.o : mx + p.q, along ? mz + p.q : mz + p.o, along ? 90 : 0, type === 'patterned-rug' ? { w: mm(wid), d: mm(p.len), pattern: ['stripe', 'kilim', 'border', 'check'].find(n => c.style.rugs.includes(n)) || 'stripe' } : { w: mm(wid), d: mm(p.len) })],
    score: p => p.len - Math.abs(p.o) * 0.3 - Math.abs(p.q),
  };
}

// ================================================================================================================
// Programs
// ================================================================================================================
function program(c: C): Array<(attempt: number) => Group | null> {
  const P = c.program, d = c.density, g = c.geo, big = g.area >= 14;
  const plants = (n: number) => Array.from({ length: n }, () => () => plantGroup(c));
  switch (P) {
    case 'living': case 'den': case 'media': {
      // what the seating faces: a screen in a den or media room; else the glass when the room is mostly glass; else by style —
      // a hearth (or a picture wall) in the traditional styles, a screen or a picture wall in the modern ones
      const trad = c.style.tags.some(t => ['farmhouse', 'cottage', 'craftsman', 'mediterranean', 'traditional'].includes(t));
      const prefer = P === 'media' || P === 'den' ? 'tv' : g.windows.some(w => w.type !== 'window' && w.b - w.a >= 2) ? 'view' : trad ? (c.rng() < 0.6 ? 'fireplace' : 'art') : c.rng() < 0.6 ? 'tv' : 'art';
      const foci = chooseFoci(c, prefer);
      const list: Array<(attempt: number) => Group | null> = [];
      if (foci.length) list.push(k => { const f = foci[k % 2] || foci[0]; return f ? loungeGroup(c, f) : null; });
      if (P === 'living' && g.area >= 28 && d >= 0.55 && c.rng() < 0.35) list.push(() => { const t = c.style.tags.some(s => ['modern', 'industrial'].includes(s)) ? 'grand-piano' : (c.rng() < 0.5 ? 'grand-piano' : 'upright-piano'); return t === 'grand-piano' ? freeGroup(c, t) : wallGroup(c, 'piano', t, {}); });
      if (d >= 0.4) list.push(() => storageGroup(c, 'bookcase', { dress: false }));
      if (d >= 0.65 && big) list.push(() => storageGroup(c, P === 'living' ? 'sideboard' : 'bookcase'));
      list.push(() => floorLampGroup(c), ...plants(d >= 0.6 ? 2 : 1));
      if (P === 'den' && d >= 0.5) list.push(() => readingCorner(c));
      return list;
    }
    case 'library': {
      const foci = chooseFoci(c, 'art');
      // the walls of books: runs of matching tall bookcases, on the longest free walls first
      const n = Math.max(2, Math.min(4, Math.floor(g.runs.reduce((a, r) => a + r.b - r.a, 0) / 4)));
      const list: Array<(attempt: number) => Group | null> = Array.from({ length: n }, () => (k: number) => bookcaseRun(c, Math.max(2, 4 - k)));
      list.unshift(() => readingCorner(c));
      if (foci.length && g.area >= 14) list.unshift(k => { const f = foci[k % 2] || foci[0]; return f ? loungeGroup(c, f, { big: false }) : null; });
      if (d >= 0.5) list.push(() => deskGroup(c));
      list.push(() => floorLampGroup(c), ...plants(1));
      return list;
    }
    case 'study': case 'studio': {
      const list: Array<(attempt: number) => Group | null> = [() => deskGroup(c), () => storageGroup(c, 'bookcase', { dress: false })];
      if (P === 'studio') list.push(() => cornerGroup(c, 'easel', 'easel'), () => storageGroup(c, 'shelving', { dress: false }));
      if (g.area >= 9) list.push(() => readingCorner(c));
      if (d >= 0.5 && g.area >= 12) list.push(() => storageGroup(c, 'bookcase', { dress: false }));
      if (d >= 0.5) list.push(() => { const t = c.pick('rug'); if (!t) return null; const [mx, mz] = c.mid(); return { name: 'rug', gid: 0, movable: false, cands: [{ key: 'm' }], build: () => [rug(c, mx, mz, Math.min(2.4, g.b.w - 1.4), Math.min(1.7, g.b.d - 1.4), 0)], score: () => 0 }; });
      list.push(...plants(1));
      return list;
    }
    case 'dining': {
      const list: Array<(attempt: number) => Group | null> = [() => diningGroup(c), () => storageGroup(c, 'sideboard')];
      if (d >= 0.55) list.push(...plants(1));
      if (d >= 0.7 && big) list.push(() => storageGroup(c, 'wine'));
      return list;
    }
    case 'kitchen': case 'kitchen-dining': return [...kitchenGroups(c, { dining: P === 'kitchen-dining', diningGroup: (r: any) => diningGroup(c, r) }), ...(d >= 0.6 ? plants(1) : [])];
    case 'bed-primary': case 'bed-guest': {
      const list: Array<(attempt: number) => Group | null> = [k => bedGroup(c, k), () => storageGroup(c, 'dresser', { prefer: (p, it) => (c.groups[0] && c.groups[0].items && Math.abs(((c.groups[0].items[0].rot - it.rot) % 360 + 360) % 360 - 180) < 1 ? 1 : 0) })];
      if (g.area >= 11 && !c.placed.some(i => i.pin && ['wardrobe', 'armoire'].includes(i.type))) list.push(() => storageGroup(c, 'wardrobe', { dress: false }));
      if (P === 'bed-primary' && g.area >= 14 && d >= 0.45) list.push(() => readingCorner(c));
      if (P === 'bed-guest' && d >= 0.6) list.push(() => deskGroup(c));
      list.push(...plants(d >= 0.5 ? 1 : 0));
      return list;
    }
    case 'bed-kid': return [() => bedGroup(c), () => storageGroup(c, 'toy-storage', { dress: false }), () => (g.area >= 9 ? deskGroup(c, { kid: true }) : null), () => cornerGroup(c, 'play', c.pick('play') || 'play-tent'), () => (d >= 0.5 ? cornerGroup(c, 'floor-seat', c.pick('floor-seat') || 'beanbag') : null), () => (d >= 0.4 ? storageGroup(c, 'dresser') : null)];
    case 'nursery': return [() => bedGroup(c), () => storageGroup(c, 'changing', { dress: false }), () => { const t = 'nursery-glider'; return cornerGroup(c, 'glider', t, {}, { angled: true }); }, () => storageGroup(c, 'dresser'), () => storageGroup(c, 'toy-storage', { dress: false }), () => { const [mx, mz] = c.mid(); return { name: 'rug', gid: 0, movable: false, cands: [{ key: 'm' }], build: () => [rug(c, mx, mz, Math.min(2.0, g.b.w - 1.2), Math.min(1.5, g.b.d - 1.2), 0, { pattern: c.rng() < 0.5 ? 'dots' : 'check' })], score: () => 0 }; }];
    case 'playroom': return [() => { const [mx, mz] = c.mid(); return { name: 'rug', gid: 0, movable: false, cands: [{ key: 'm' }], build: () => [rug(c, mx, mz, Math.min(2.6, g.b.w - 1.0), Math.min(2.0, g.b.d - 1.0), 0, { pattern: 'play' })], score: () => 0 }; }, () => storageGroup(c, 'toy-storage', { dress: false }), () => storageGroup(c, 'toy-storage', { dress: false }), () => cornerGroup(c, 'play', c.pick('play') || 'play-tent'), () => freeGroup(c, 'kids-table'), () => cornerGroup(c, 'floor-seat', c.pick('floor-seat') || 'beanbag'), () => cornerGroup(c, 'easel', 'easel')];
    case 'bath': case 'ensuite': case 'powder': return bathGroups(c);
    case 'foyer': return [() => storageGroup(c, 'console', { prefer: (p) => (c.mainPortal() && p.run.side !== c.mainPortal()!.side ? 0.5 : 0) }), () => runnerGroup(c), () => (g.area >= 4 ? storageGroup(c, c.rng() < 0.5 ? 'bench' : 'coat-rack', { dress: false }) : null), () => (d >= 0.4 ? plantGroup(c) : null)];
    case 'hall': return [() => runnerGroup(c), () => (Math.min(g.b.w, g.b.d) >= 1.7 ? storageGroup(c, 'console') : null), () => (d >= 0.5 && Math.min(g.b.w, g.b.d) >= 1.5 ? plantGroup(c, 'plant-small') : null)];
    case 'laundry': return [() => wallGroup(c, 'washer', 'washing-machine', {}), () => wallGroup(c, 'dryer', 'dryer', {}), () => storageGroup(c, 'tall-storage', { dress: false }), () => cornerGroup(c, 'hamper', c.pick('hamper') || 'laundry-basket'), () => storageGroup(c, 'hooks', { dress: false })];
    case 'garage': return [() => wallGroup(c, 'workbench', 'workbench', {}), () => storageGroup(c, 'shelving', { dress: false }), () => cornerGroup(c, 'bike', 'bicycle')];
    case 'gym': return [() => freeGroup(c, 'exercise-bike'), () => freeGroup(c, 'weight-bench'), () => freeGroup(c, 'yoga-mat'), () => plantGroup(c)];
    case 'bar': return [() => storageGroup(c, c.rng() < 0.5 ? 'bar-cart' : 'wine', { dress: false }), () => freeGroup(c, 'bar-table'), () => storageGroup(c, 'sideboard'), () => plantGroup(c)];
    case 'sunroom': case 'greenhouse': {
      const list: Array<(attempt: number) => Group | null> = [];
      if (P === 'greenhouse') list.push(() => wallGroup(c, 'potting', 'potting-bench', {}));
      list.push(() => readingCorner(c), () => (g.area >= 10 ? readingCorner(c) : null), ...plants(P === 'greenhouse' ? 4 : 3));
      if (P === 'sunroom' && g.area >= 12) list.push(k => { const fs = chooseFoci(c, 'view'), fc = fs[k % 2] || fs[0]; return fc ? loungeGroup(c, fc, { big: false }) : null; });
      return list;
    }
    case 'outdoor': return g.area >= 5 ? [() => freeGroup(c, c.rng() < 0.5 ? 'patio-set' : 'outdoor-sofa'), () => (g.area >= 9 ? freeGroup(c, 'fire-bowl') : null)] : [];
    default: return [];
  }
}
/** a free-standing piece somewhere on the floor (a piano, a kids' table, gym kit) */
function freeGroup(c: C, type: string): Group | null {
  const S = c.size(type);
  return {
    name: type, gid: 0, movable: true, anneal: true, cands: c.floorPoses(0.2, Math.max(S.w, S.d) / 2 + 0.1).flatMap(p => [0, 90].map(r => ({ ...p, key: `${p.key}:${r}`, r }))),
    build: p => [c.item(type, p.x, p.z, p.r)],
    score: p => -central(c, p.x, p.z, 0.5),   // toward the walls, leaving the middle to walk through
  };
}

// ================================================================================================================
// Rooms and houses
// ================================================================================================================
export interface ComposeResult { items: any[]; program: string; style: string; laneWidth: number; lanes: ReturnType<typeof lanesOk>; groups: string[]; dropped: string[]; why?: Record<string, string[]>; focus?: any; geometry?: string[] }
const roomKey = (lv: any, ri: number) => `${lv.id}#${ri}`;
export const seedKeyOf = (spec: any, room: any) => `${spec.id}:${room.no ?? room.name}:compose${room.seed !== undefined ? ':' + room.seed : ''}`;

/** pins as composer items (the room's own and those of overlapping rooms on the storey), skipping the hero set that
 *  the hero block places */
function pinsFor(spec: any, lv: any, room: any, composed: Map<any, any[]>): CItem[] {
  const b = room.bounds, out: CItem[] = [];
  const HERO = new Set(['walnut-desk', 'task-chair', 'curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers']);
  const heroHere = spec.hero && spec.hero.level === lv.id;
  for (const r of lv.rooms || []) {
    const rb = r.bounds; if (!rb) continue;
    if (r !== room && (rb.x >= b.x + b.w || rb.x + rb.w <= b.x || rb.z >= b.z + b.d || rb.z + rb.d <= b.z)) continue;
    for (const it of [...(r.items || []), ...(composed.get(r) || [])]) {
      if (heroHere && HERO.has(it.type) && Array.isArray(it.at) && Math.hypot(it.at[0] - spec.hero.at[0], it.at[1] - spec.hero.at[1]) < 1.3) continue;
      const o = itemObb(it); if (!o) continue;
      const s = sizeOf(it.type, it)!, layer = layerOf(it.type);
      const ci: CItem = { type: it.type, rot: it.rot || 0, params: {}, cx: o.cx, cz: o.cz, w: s.w, d: s.d, h: s.h, ox: s.ox, oz: s.oz, layer, y: it.y ?? 0, box: o, clear: [], walk: [], gid: 0, pin: true, tucks: !!PLACEMENT[it.type]?.tucks };
      if (layer === 'wall' && it.y === undefined) ci.y = PLACEMENT[it.type]?.mountY ?? 1.5;
      out.push(ci);
    }
  }
  return out;
}

export function composeRoom(spec: any, lv: any, room: any, house: HouseState, composed: Map<any, any[]>): ComposeResult {
  const c = new Composer(spec, lv, room, pinsFor(spec, lv, room, composed), house, seedKeyOf(spec, room));
  // a bedroom gets a palette of its own when it has none: its style's fabrics and accents, distinct from the house's
  // other bedrooms (a kid's room from the brighter nursery set)
  if (!c.palette && BEDROOMS.has(c.program)) {
    const kids = ['#b7c9a8', '#a9c1d9', '#e3b8b0', '#e8d8a0', '#c3b5d6', '#a8d5c9'];
    const fabrics = c.program === 'bed-kid' || c.program === 'nursery' ? kids : c.style.fabric;
    const free = fabrics.filter(f => !house.palettes.includes(f)), pool = free.length ? free : fabrics;
    const fabric = pool[Math.floor(c.rng() * pool.length)];
    const accent = c.style.accent[Math.floor(c.rng() * c.style.accent.length)];
    c.palette = { fabric, accent };
    house.palettes.push(fabric);
  } else if (!c.palette && (room.style || spec.styleKey) && LIVED_IN.has(c.program)) {
    // an author who names a style gets its colours: the lived-in rooms take a fabric, a wood and an accent from the
    // style's palette (a house with no style named keeps the kit's scheme, harmonised with its own palette)
    const free = c.style.fabric.filter(f => !house.palettes.includes(f)), pool = free.length ? free : c.style.fabric;
    const pick = (a: string[]) => a[Math.floor(c.rng() * a.length)];
    const fabric = pick(pool);
    c.palette = { fabric, wood: pick(c.style.wood), accent: pick(c.style.accent) };
    house.palettes.push(fabric);
  }
  const dropped: string[] = [];
  for (const make of program(c)) {
    // a group that cannot be placed is made again (a lounge tries its next focus wall, and every piece its last try
    // picked is set aside, so the next try reaches for others rather than the house's favourite again), twice at most
    let name = '';
    c.avoid = new Set();
    for (let attempt = 0; attempt < 4; attempt++) {
      c.attempt = attempt; c.pickLog = [];
      const g = make(attempt); if (!g) { name = name && attempt ? name : ''; break; }
      name = g.name;
      if (g.cands.length && c.place(g)) { name = ''; break; }
      for (const t of c.pickLog) c.avoid.add(t);
    }
    if (name) dropped.push(name);
  }
  c.avoid = new Set(); c.attempt = 0;
  c.anneal(400);
  // the report: the lanes at the room's width (0.9 m where it has 3 m to give, else 0.8) and anything its geometry
  // alone already blocks (a stair across a landing), which no composition can open
  const lanes = lanesOk(c.geo, laneGrid(c.geo, c.blockers()), c.laneW, c.access());
  const geometry = lanes.failed.filter(f => c.baseFailed.has(f));
  lanes.failed = lanes.failed.filter(f => !c.baseFailed.has(f)); lanes.ok = !lanes.failed.length;
  const why = Object.fromEntries(dropped.map(n => [n, Object.entries(c.whys[n] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ×${v}`)]));
  return { items: c.output(), program: c.program, style: c.style.key, laneWidth: c.laneW, lanes, geometry, groups: c.groups.map(g => g.name), dropped, why, focus: c.focus };
}

const cache = new WeakMap<any, { byRoom: Map<any, ComposeResult> }>();
/**
 * Compose every room of a house that has a program (and is not locked), in build order: levels, then rooms. Returns
 * room → result. Cached per spec object, so the page's builder, the lints and plan-export see the same composition.
 * `opts.program(room, lv)` overrides which rooms are composed and as what (the dry run infers programs by name).
 */
export function composeHouse(spec: any, opts: { program?: (room: any, lv: any) => string | null } = {}): Map<any, ComposeResult> {
  const hit = !opts.program && cache.get(spec); if (hit) return hit.byRoom;
  const house: HouseState = { usage: new Map(), storey: new Map(), palettes: [], styleOf: room => styleOf(spec, room), prefer: new Map(), prefAny: new Set(), seed: String(spec.id) };
  const byRoom = new Map<any, ComposeResult>(), composed = new Map<any, any[]>();
  // every authored type counts as used, so the composer reaches for something else
  for (const lv of spec.levels || []) for (const r of lv.rooms || []) for (const it of r.items || []) { house.usage.set(it.type, (house.usage.get(it.type) || 0) + 1); const k = `${lv.id}:${it.type}`; house.storey.set(k, (house.storey.get(k) || 0) + 1); }
  for (const lv of spec.levels || []) (lv.rooms || []).forEach((room: any) => {
    const prog = opts.program ? opts.program(room, lv) : (isComposed(room) ? room.program : null);
    if (!prog || !room.bounds) return;
    const r = prog === room.program ? room : { ...room, program: prog };
    const res = composeRoom(spec, lv, r, house, composed);
    byRoom.set(room, res); composed.set(room, res.items);
  });
  // the house-wide state (its preferred types per role, its usage counts), for the tools and tests to look at
  Object.defineProperty(byRoom, 'house', { value: house });
  if (!opts.program) cache.set(spec, { byRoom });
  return byRoom;
}
/** the composed items of one room ([] for a room that is not composed) */
export function composedItems(spec: any, room: any): any[] {
  if (!isComposed(room)) return [];
  const r = composeHouse(spec).get(room); return r ? r.items : [];
}

// ================================================================================================================
// Exported helpers
// ================================================================================================================
/** the door-to-door circulation corridors of a room: Manhattan routes 0.9 m wide between every pair of its ways in
 *  (and to its middle when it has one way in), as plan rectangles — S5's soft nav bias */
export function lanes(spec: any, lv: any, room: any): Array<{ from: string; to: string; rects: Obb[] }> {
  const geo = analyzeRoom(spec, lv, room), ps = geo.portals.filter(p => p.w >= 0.5), out: Array<{ from: string; to: string; rects: Obb[] }> = [];
  const inner = (p: Portal): [number, number] => { const [nx, nz] = INWARD[p.side]; return [p.x + nx * 0.5, p.z + nz * 0.5]; };
  const route = (a: [number, number], b: [number, number]) => { const w = 0.9; return [rectObb(Math.min(a[0], b[0]) - w / 2, a[1] - w / 2, Math.max(a[0], b[0]) + w / 2, a[1] + w / 2), rectObb(b[0] - w / 2, Math.min(a[1], b[1]) - w / 2, b[0] + w / 2, Math.max(a[1], b[1]) + w / 2)]; };
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) out.push({ from: `${ps[i].kind}@${ps[i].side}`, to: `${ps[j].kind}@${ps[j].side}`, rects: route(inner(ps[i]), inner(ps[j])) });
  if (ps.length === 1) { const b = geo.b; out.push({ from: `${ps[0].kind}@${ps[0].side}`, to: 'middle', rects: route(inner(ps[0]), [b.x + b.w / 2, b.z + b.d / 2]) }); }
  return out;
}

/** a wall-mounted item authored with its back inside the wall: moved out to the face of the nearest wall of its room
 *  (returns a copy; null when it needs no move). Plan S3 task 4. */
export function snapWallMount(it: any, geo: Geo): any | null {
  if (layerOf(it.type) !== 'wall' || !Array.isArray(it.at)) return null;
  const s = sizeOf(it.type, it); if (!s) return null;
  const side = sideOfRot(it.rot || 0), run = geo.runs.filter(r => r.side === side).sort((p, q) => Math.abs((alongX(side) ? it.at[1] : it.at[0]) - p.face) - Math.abs((alongX(side) ? it.at[1] : it.at[0]) - q.face))[0];
  if (!run) return null;
  // the box's back must be at the face: along the inward normal the box centre is `oz` in front of the origin
  const [nx, nz] = INWARD[side], sign = alongX(side) ? nz : nx, want = run.face + sign * (0.003 + s.d / 2 - s.oz), cur = alongX(side) ? it.at[1] : it.at[0];
  if ((cur - want) * sign >= -0.005 || Math.abs(cur - want) > 0.3) return null;
  return { ...it, at: alongX(side) ? [it.at[0], mm(want)] : [mm(want), it.at[1]] };
}
/** a surface item (surface: true) with no `y`, or one at the desk default, set onto the top of the item under it
 *  (returns a copy; null when nothing is under it or it already sits right). Plan S3 task 4. */
export function stackOnSurface(it: any, items: any[]): any | null {
  if (layerOf(it.type) !== 'surface' || !Array.isArray(it.at)) return null;
  const under = items.filter(o => o !== it && layerOf(o.type) === 'body').map(o => ({ o, box: itemObb(o) })).filter(u => u.box && overlap(obb(it.at[0], it.at[1], 0.05, 0.05), u.box) > 0);
  if (!under.length) return null;
  const top = Math.max(...under.map(u => { const pl = PLACEMENT[u.o.type]; const s = sizeOf(u.o.type, u.o)!; return pl && pl.top !== undefined ? pl.top : s.h; }));
  const y = it.y ?? 0.77;
  return Math.abs(y - top) > 0.02 ? { ...it, y: mm(top) } : null;
}
export { inferProgram, isComposed };
/** the group builders, for tests and the fixture tooling */
export const GROUP_BUILDERS = { seatingGroup, diningGroup, bedGroup, deskGroup, focusGroup, chooseFocus, chooseFoci, loungeGroup, storageGroup, readingCorner, runnerGroup };
