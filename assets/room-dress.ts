// The dress phase — a second, additive pass after a room's layout is frozen (plan 5.6 DRESS): it reads the room's final items as pins and adds
// `src: 'dress@1'` items (the small goods of assets/props/dress-*.ts, lamps, towels) to the surfaces the layout made. THREE-free, Node and page alike.
//
//   DRESS_SRC            the marker a dress item carries (`src: 'dress@1'`), as `compose@1` marks the composer's
//   isDress(item)        is this item the dress phase's?
//   dressOff()           the `?dress=0` kill switch: the build leaves every dress item out (baked or live), the exact BEFORE of a dressed house
//   dressOptIn(room)     does this room ask for the live phase? Only an explicit `room.dress.level` does: a room without one is never dressed by the build,
//                        so every shipped house builds exactly as it did (a baked `dress@1` item is a plain item in the spec)
//   dressRoom(...)       one room -> DressResult (items, per-slot counts, what it skipped and why)
//   dressHouse(spec)     room -> DressResult for every opted-in room (cached per spec content, like composeHouse)
//   dressRooms(spec, o)  the same for EVERY room that has a recipe (the bake tool and the census: o.level overrides each room's)
//   bareViolation(...)   the never-bare rule of a program, against a room's items (the lint and the census read the same one)
//
// How it works. The layout (authored items + the composer's) is frozen; every item that is a HOST (assets/room-dress-hosts.ts: a measured, flat, clear top)
// becomes a surface to dress. A program's RECIPE (assets/dress-recipes.ts) is a list of SLOTS, each a small function over a `Dresser`: it asks for the hosts
// of a kind, picks a kit (a dress type) for each by the house's own taste, and `put`s it on the host's FREE area (the rects less everything already on it,
// less a margin), anchored at the centre, an end or the back; nothing is ever placed outside a host's rect, over another item, or past 60 % cover. The floor
// layer (a floor lamp, a door mat) goes through the composer's own `place` (lanes, door swings, windows, stair run-ins hold) and the wall layer through
// its `mount`. Slots are tiered: tier 1 is the never-bare floor and the lamp, always placed; tier 2 from level 0.3, tier 3 from 0.6; the room's budget
// (PLAN: n = base x (0.55 + 0.45 x area/ref) x (0.6 + 0.8 x level)) caps tiers 2 and 3.
//
// Seeding. Every dress item carries `dk` (its room, slot and ordinal). The phase's own choices (which kit, which variant) draw from
// mulberry32(fnv1a(`${spec.id}:${room}:dress:${slot}:${n}`)): a stream per slot and ordinal, so adding a slot moves none of another's. The page seeds the
// item's own props from `kit.itemRng('dress:' + dk)`, a stream keyed by the item alone: it never advances the house-wide `propIndex` that every registry
// prop's stream is counted on (assets/rooms-build.ts), so adding, moving or removing a dress item moves no other prop's colour or jitter. No clock, no Math.random.
//
// Owner: DRESS.
import { PLACEMENT } from './props/placement.js';
import { sizeOf, paramsOf, turn, mm, itemObb, overlap, analyzeRoom, type Obb } from './room-geo.js';
import { Composer, composeHouse, pinsFor, cornerGroup, wallGroup, layerOf, type Group, type CItem, type HouseState } from './room-composer.js';
import { inferProgram } from './room-programs.js';
import { styleOf, type StyleBundle } from './house-styles.js';
import { mulberry32, fnv1a } from './materials.js';
import { HERO_SET } from './item-map.js';
import { hostOf, freeRects, standingOn, nearOn, fitIn, footprintIn, coverIn, toWorld, toLocal, subtract, rectArea, neighbourGap, reachOf, NEIGHBOUR_GAP, MIN_GAP, cornerEyes, camBlocked, CAM, LAMP_EYE, type CornerEye, type Host, type HostKind, type Rect, type Anchor } from './room-dress-hosts.js';
import { dressSchemeOf, type DressScheme } from './house-scheme-dress.js';
import { RECIPES, BASE_COUNT, BARE_LAMPS, LAMP_TYPES, LAMP_MIN_AREA, windowTypes, type Recipe } from './dress-recipes.js';
import { planCafe, CURTAIN_PAD, VPAD, type Panel } from './dress-curtains.js';
import { leafStrips, leafSensitive } from './dress-leaves.js';

export const DRESS_SRC = 'dress@1';
export const isDress = (it: any): boolean => !!it && it.src === DRESS_SRC;

/** `?dress=0` (a page switch; Node has no location and is never switched off) */
export function dressOff(): boolean {
  try { return typeof location !== 'undefined' && new URLSearchParams(location.search).get('dress') === '0'; } catch { return false; }
}

/** the room asks for the live dress phase: `dress: { level: 0..1 }` (a number), never `false`, never absent */
export const dressOptIn = (room: any): boolean => !!room && !!room.dress && typeof room.dress === 'object' && typeof room.dress.level === 'number';

export interface DressResult { items: any[]; program: string | null; level: number; slots: Array<{ slot: string; n: number }>; skipped: Array<{ slot: string; why: string }>; cap: number; spent: number }

/** the types that take the house's glaze (`color` repaints the `ceramic` role) */
const GLAZED = new Set(['place-setting', 'centerpiece', 'plate-stack', 'utensil-crock', 'canister-trio', 'vanity-set']);
/** per-tier level thresholds */
const TIER_MIN = [0, 0, 0.3, 0.6];
const COVER = 0.6;   // at most this much of a host's top is under things: 40 % stays free

/** the whole top of a host as one rect (what an anchor is a place in) */
const hostBounds = (h: Host): Rect => [Math.min(...h.rects.map(r => r[0])), Math.min(...h.rects.map(r => r[1])), Math.max(...h.rects.map(r => r[2])), Math.max(...h.rects.map(r => r[3]))];
const affinity = (seed: string, type: string): number => (fnv1a(`${seed}:dress-likes:${type}`) >>> 0) / 4294967296;

/** the vertical span a composer item occupies (a wall item's mount is its centre or its bottom, so the span is taken both ways round) */
const spanOf = (ci: CItem): [number, number] | null => ci.layer === 'body' ? [0, ci.h] : ci.layer === 'surface' ? [ci.y, ci.y + ci.h] : ci.layer === 'wall' ? [ci.y - ci.h, ci.y + ci.h] : null;

// ---- the Dresser: what a slot works with --------------------------------------------------------------------------------------------
export class Dresser {
  readonly spec: any; readonly lv: any; readonly room: any; readonly program: string; readonly level: number; readonly area: number;
  readonly roomKey: string; readonly style: StyleBundle; readonly scheme: DressScheme;
  readonly base: any[]; readonly hosts: Host[];
  placed: any[] = [];
  counts = new Map<string, number>(); skipped: Array<{ slot: string; why: string }> = [];
  cap: number; spent = 0;
  /** the tier of the slot being run: what `put` and the floor placers charge the budget at */
  curTier = 1;
  /** the rig's corner cameras of this room: nothing stands in their way */
  readonly eyes: CornerEye[];
  /** the café curtains the `windows` slot will hang (planned before any slot runs, against the layout), and the volume each takes: nothing else stands in it */
  readonly panels: Panel[];
  /** where the storey's open door leaves park (assets/dress-leaves.ts): nothing the scene check counts as in a leaf's way stands in them */
  readonly leaves: Obb[];
  private keep: Array<{ o: Obb; y0: number; y1: number }>;
  private off: Set<string>; private viaGroup = new Map<any, Group>(); private ord = new Map<string, number>(); private composer: Composer | null = null; private composedItems: Map<any, any[]>;

  constructor(spec: any, lv: any, room: any, program: string, level: number, base: any[], composedItems: Map<any, any[]>) {
    this.spec = spec; this.lv = lv; this.room = room; this.program = program; this.level = level; this.base = base; this.composedItems = composedItems;
    this.area = room.bounds.w * room.bounds.d; this.eyes = cornerEyes(room.bounds);
    this.roomKey = `${lv.id}.${room.no ?? room.name}`;
    this.style = styleOf(spec, room); this.scheme = dressSchemeOf(spec);
    this.off = new Set(room.dress && typeof room.dress === 'object' && Array.isArray(room.dress.off) ? room.dress.off : []);
    const heroHere = spec.hero && spec.hero.level === lv.id;
    this.hosts = base.filter(it => !(heroHere && HERO_SET.has(it.type) && Array.isArray(it.at) && Math.hypot(it.at[0] - spec.hero.at[0], it.at[1] - spec.hero.at[1]) < 1.3))
      .map(hostOf).filter((h): h is Host => !!h)
      .sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : a.at[0] - b.at[0] || a.at[1] - b.at[1]));
    const ref = RECIPES[program]?.ref ?? 12, base0 = BASE_COUNT[program] ?? 6;
    this.cap = Math.max(2, Math.round(base0 * (0.55 + 0.45 * Math.max(0.5, Math.min(2.2, this.area / ref))) * (0.6 + 0.8 * level)));
    // the curtains are planned now, before a slot has placed anything, so every dress item can keep out of their volume (assets/dress-curtains.ts). The plan is a function of the
    // layout alone: whatever the level and whether or not `windows` is switched off, so a lower level places what a higher one places first and no slot moves another (test C)
    this.panels = windowTypes(program) ? planCafe(analyzeRoom(spec, lv, room), base, this.eyes) : [];
    this.keep = this.panels.map(p => ({ o: p.obb, y0: p.hem, y1: p.top }));
    this.leaves = leafStrips(spec, lv);
  }
  /** does a piece of this type and height, on this footprint (grown by `grow`), stand in the strip an open door leaf parks in */
  inLeaf(o: Obb, type: string, h: number, grow = 0): boolean {
    return leafSensitive(type, h) && this.leaves.some(l => overlap({ ...o, hw: o.hw + grow, hd: o.hd + grow }, l) > 0);
  }
  /** the café curtains this room's `windows` slot hangs */
  curtainPanels(): Panel[] { return this.panels; }
  /** does a box standing between y0 and y1 (grown by `grow` in plan) meet the volume of a planned curtain */
  inCurtain(o: Obb, y0: number, y1: number, grow = 0): boolean {
    return this.keep.some(k => y1 + VPAD > k.y0 - CURTAIN_PAD && y0 < k.y1 + CURTAIN_PAD && overlap({ ...o, hw: o.hw + CURTAIN_PAD + grow, hd: o.hd + CURTAIN_PAD + grow }, k.o) > 0);
  }

  // ---- what is here
  all(): any[] { return [...this.base, ...this.placed]; }
  hostsOf(...kinds: HostKind[]): Host[] { return this.hosts.filter(h => kinds.includes(h.kind)); }
  hostsOfType(...types: string[]): Host[] { return this.hosts.filter(h => types.includes(h.type)); }
  count(pred: (it: any) => boolean): number { return this.all().filter(pred).length; }
  groupOf = (it: any): string => (PLACEMENT[it.type] && PLACEMENT[it.type].group) || '';
  /** is there a lamp in the room (the layout's, or one this phase has put): the lamp-less rooms are what LIGHT could not pool */
  /** the registry types that can fill a composer role, sorted (the plants and lamps the layout also picks from) */
  roleTypes(role: string): string[] { return Object.keys(PLACEMENT).sort().filter(t => PLACEMENT[t].roles.includes(role)); }
  hasLamp(): boolean { return this.all().some(it => this.groupOf(it) === 'lamp'); }
  has(type: string): boolean { return this.all().some(it => it.type === type); }
  free(h: Host, margin = 0.03, type?: string): Rect[] { return freeRects(h, nearOn(h, this.all()), margin, NEIGHBOUR_GAP, type ? reachOf(type) : 0); }
  covered(h: Host): number { return standingOn(h, this.all()).reduce((a, it) => { const f = footprintIn(h, it); return a + (f ? rectArea(f) : 0); }, 0); }
  skip(slot: string, why: string) { this.skipped.push({ slot, why }); }
  /** can the budget take one more (tier 1 may run to 1.5 x the cap) */
  afford(tier: number, cost = 1): boolean { return this.spent + cost <= (tier <= 1 ? this.cap * 1.5 : this.cap) + 1e-9; }
  open(slot: string): boolean { return !this.off.has(slot); }

  // ---- seeds and picks
  rngFor(slot: string, n: number): () => number { return mulberry32(fnv1a(`${this.spec.id}:${this.roomKey}:dress:${slot}:${n}`)); }
  /** a type from `types` for a slot: the house's taste (a stable affinity per type), faded by how often this room already has it, then a seeded weighted draw */
  pick(slot: string, types: string[], style = true): string {
    const r = this.rngFor(slot, (this.ord.get(slot) ?? 0) + 1000), seed = String(this.spec.id), tags = this.style.tags, key = this.style.key;
    const w = types.map(t => {
      const st = PLACEMENT[t] && PLACEMENT[t].styles ? PLACEMENT[t].styles : [], sw = !style ? 1 : !st.length ? 0.7 : st.includes(key) ? 3 : st.some((s: string) => tags.includes(s)) ? 1.6 : 0.35;
      return sw * (0.4 + affinity(seed, t)) * Math.pow(0.45, this.all().filter(it => it.type === t).length);
    });
    const sum = w.reduce((a, b) => a + b, 0); let x = r() * sum;
    for (let i = 0; i < types.length; i++) { x -= w[i]; if (x <= 0) return types[i]; }
    return types[types.length - 1];
  }

  // ---- putting a kit on a host
  /**
   * Put a `type` on host `h`: packed into its free rects at `anchor` (or explicitly `at`, the footprint's centre in the host frame), turned `rotExtra`
   * degrees off the host's own front, refused when it will not fit, leaves under 40 % of the top free, or the room's budget is spent. Returns the item.
   */
  put(slot: string, h: Host, type: string, o: { anchor?: Anchor; params?: any; rotExtra?: number; margin?: number; at?: [number, number]; lift?: number; tier?: number; cost?: number; cover?: number } = {}): any | null {
    if (!this.open(slot)) return null;
    const tier = o.tier ?? this.curTier, cost = o.cost ?? 1;
    if (!this.afford(tier, cost)) { this.skip(slot, 'the room budget is spent'); return null; }
    if (LAMP_TYPES.has(type) && this.area < LAMP_MIN_AREA) { this.skip(slot, `${type}: the room is under ${LAMP_MIN_AREA} m2, which the light rig does not light`); return null; }
    const n = this.ord.get(slot) ?? 0, r = this.rngFor(slot, n);
    const params: any = { ...(o.params || {}) }, P = paramsOf(type);
    const u0 = r(), u1 = r();
    if (P.includes('variant') && params.variant === undefined) params.variant = type === 'tray-vignette' && u1 < 0.75 ? this.scheme.tray : type === 'candle-trio' && u1 < 0.75 ? this.scheme.candle : Math.floor(u0 * 3);
    if (P.includes('color') && GLAZED.has(type) && params.color === undefined && this.scheme.glaze) params.color = this.scheme.glaze;
    const s = sizeOf(type, params); if (!s) { this.skip(slot, `no size for ${type}`); return null; }
    const ex = o.rotExtra || 0, swap = ex % 180 !== 0, fw = swap ? s.d : s.w, fd = swap ? s.w : s.d;
    let free = this.free(h, o.margin ?? h.margin, type);
    // a piece that reaches the camera's height keeps CAM.clear from the rig's corner eyes (the zone, in the host's frame, comes off the free area)
    if (h.top + (o.lift || 0) + s.h > CAM.eye - CAM.clear) for (const e of this.eyes) {
      const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toLocal(h, e.x + a * CAM.clear, e.z + b * CAM.clear)), z: Rect = [Math.min(...q.map(v => v[0])), Math.min(...q.map(v => v[1])), Math.max(...q.map(v => v[0])), Math.max(...q.map(v => v[1]))];
      free = free.flatMap(r => subtract(r, z));
    }
    // a lamp with a bare lit head keeps LAMP_EYE from every corner eye (LAMP_EYE is 3-D: the square is the plan footprint of the sphere at the lamp's own height over the eye line). A shaded lamp
    // (a drum on a nightstand, a floor lamp, which stands through the composer in a corner by design) keeps CAM's own clearance: its light is diffused by the shade, not a hot bulb at the lens
    if (BARE_LAMPS.has(type)) for (const e of this.eyes) {
      const y1 = h.top + (o.lift || 0) + s.h, vg = Math.max(0, CAM.eye - y1, h.top + (o.lift || 0) - CAM.eye), rr = Math.sqrt(Math.max(0, LAMP_EYE * LAMP_EYE - vg * vg));
      const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toLocal(h, e.x + a * rr, e.z + b * rr)), z: Rect = [Math.min(...q.map(v => v[0])), Math.min(...q.map(v => v[1])), Math.max(...q.map(v => v[0])), Math.max(...q.map(v => v[1]))];
      free = free.flatMap(r => subtract(r, z));
    }
    // a piece tall enough to reach a planned curtain keeps out of the cloth's volume, its pad and its own reach round it
    { const y0 = h.top + (o.lift || 0) + (s.y0 || 0), y1 = y0 + s.h + VPAD;
      for (const k of this.keep) if (y1 > k.y0 - CURTAIN_PAD && y0 < k.y1 + CURTAIN_PAD) { const z = coverIn(h, k.o, CURTAIN_PAD + reachOf(type) + 0.004); free = free.flatMap(r => subtract(r, z)); } }
    // and out of the strips an open leaf parks in, if the scene check would count it (not foliage, over 0.3 m)
    if (leafSensitive(type, s.h)) for (const l of this.leaves) { const z = coverIn(h, l, 0.02 + reachOf(type)); free = free.flatMap(r => subtract(r, z)); }
    let c: [number, number] | null;
    if (o.at) {
      c = o.at;
      const inside = free.some(f => c![0] - fw / 2 >= f[0] - 1e-6 && c![0] + fw / 2 <= f[2] + 1e-6 && c![1] - fd / 2 >= f[1] - 1e-6 && c![1] + fd / 2 <= f[3] + 1e-6);
      if (!inside) { this.skip(slot, `${type} does not fit at its place on the ${h.type}`); return null; }
    } else c = fitIn(free, fw, fd, o.anchor || 'centre', hostBounds(h));
    if (!c) { this.skip(slot, `${type} (${fw.toFixed(2)} x ${fd.toFixed(2)}) does not fit the free top of the ${h.type}`); return null; }
    const total = h.rects.reduce((a, q) => a + rectArea(q), 0);
    if (this.covered(h) + fw * fd > (o.cover ?? (h.kind === 'tank' ? 0.8 : COVER)) * total + 1e-9) { this.skip(slot, `the ${h.type} would be over ${Math.round((o.cover ?? COVER) * 100)} % covered`); return null; }
    const [ox, oz] = turn(s.ox, s.oz, ex), [wx, wz] = toWorld(h, c[0] - ox, c[1] - oz);
    // a host that reaches far out of its room (a counter drawn across the edge of a small room's bounds) is dressed only where it is near the room: the origin stays within 0.5 m of the
    // bounds (the validator's "lies outside room" is 0.6 m)
    { const b = this.room.bounds; if (wx < b.x - 0.5 || wx > b.x + b.w + 0.5 || wz < b.z - 0.5 || wz > b.z + b.d + 0.5) { this.skip(slot, `${type} would stand outside the room (the ${h.type} reaches out of its bounds)`); return null; } }
    const rot = ((h.rot + ex) % 360 + 360) % 360;
    const it: any = { type, at: [wx, wz] };
    if (rot) it.rot = mm(rot);
    it.y = mm(h.top + (o.lift || 0));
    // (the free area keeps NEIGHBOUR_GAP from what stands here; a piece turned off the host's axes has a larger cover than the box the area was cut for, so the lint's own measure has the last word)
    { const nb = neighbourGap(h, { ...it, ...params }, nearOn(h, this.all()), true); if (nb && nb.gap < MIN_GAP) { this.skip(slot, `${type} would stand ${Math.max(0, Math.round(nb.gap * 1000))} mm from the ${nb.other.type} on the ${h.type}`); return null; } }
    for (const [k, v] of Object.entries(params)) it[k] = typeof v === 'number' ? mm(v) : v;
    it.src = DRESS_SRC; it.dk = `${this.roomKey}:${slot}:${n}`;
    this.ord.set(slot, n + 1); this.placed.push(it); this.counts.set(slot, (this.counts.get(slot) || 0) + 1); this.spent += cost;
    return it;
  }

  // ---- the floor and the walls, through the composer's own placement (lanes, door swings, windows hold)
  private comp(): Composer {
    if (!this.composer) {
      const house: HouseState = { usage: new Map(), storey: new Map(), roomsOn: new Map(), palettes: [], styleOf: r => styleOf(this.spec, r), prefer: new Map(), prefAny: new Set(), seed: String(this.spec.id) };
      const pins = pinsFor(this.spec, this.lv, this.room, this.composedItems, true);
      this.composer = new Composer(this.spec, this.lv, this.room, pins, house, `${this.spec.id}:${this.roomKey}:dress`);
      // what this phase has already put on the floor stands in the way too
      for (const it of this.placed) { const ci = this.toCItem(it); if (ci) this.composer.placed.push(ci); }
    }
    return this.composer;
  }
  private toCItem(it: any): CItem | null {
    const o = itemObb(it), s = sizeOf(it.type, it); if (!o || !s) return null;
    const pl = PLACEMENT[it.type], layer = pl && pl.hangs === 'wall' ? 'wall' : (pl && pl.onSurface) ? 'surface' : pl && pl.group === 'rug' ? 'floor' : 'body';
    return { type: it.type, rot: it.rot || 0, params: {}, cx: o.cx, cz: o.cz, w: s.w, d: s.d, h: s.h, ox: s.ox, oz: s.oz, layer, y: it.y ?? 0, box: o, clear: [], walk: [], gid: 0, pin: true, own: true, tucks: false } as CItem;
  }
  /** the composer, for a slot that needs the room's geometry (portals, runs, corners) */
  geoC(): Composer { return this.comp(); }
  /** place one group through the composer; the item it made, in spec form, or null */
  placeGroup(slot: string, g: Group, params: any = {}, tier = this.curTier, cost = 1): any | null {
    if (!this.open(slot)) return null;
    if (!this.afford(tier, cost)) { this.skip(slot, 'the room budget is spent'); return null; }
    const c = this.comp(), prev = g.accept;
    g.accept = items => (!prev || prev(items)) && !items.some(ci => this.inTheWay(ci) || this.inTheCloth(ci) || this.inLeaf(ci.box, ci.type, ci.h, 0.02));
    if (!g.cands.length || !c.place(g)) { this.skip(slot, `${g.name}: no place in the room (lanes, doors, windows and the furniture hold)`); return null; }
    const ci = (g.items || [])[0]; if (!ci) return null;
    const n = this.ord.get(slot) ?? 0, [dx, dz] = turn(ci.ox, ci.oz, ci.rot);
    const it: any = { type: ci.type, at: [mm(ci.cx - dx), mm(ci.cz - dz)] };
    if (ci.rot) it.rot = mm(ci.rot);
    if (ci.layer === 'wall' || ci.layer === 'surface') it.y = mm(ci.y);
    for (const [k, v] of Object.entries(ci.params)) if (v !== undefined && v !== null && k !== 'y') it[k] = typeof v === 'number' ? mm(v) : v;
    for (const [k, v] of Object.entries(params)) if (it[k] === undefined) it[k] = v;
    it.src = DRESS_SRC; it.dk = `${this.roomKey}:${slot}:${n}`;
    this.ord.set(slot, n + 1); this.viaGroup.set(it, g); this.placed.push(it); this.counts.set(slot, (this.counts.get(slot) || 0) + 1); this.spent += cost;
    return it;
  }
  /** take back the last item put (a table whose lamp then found no room, a candle trio that left no place for a setting): the budget, the count and, for a floor piece, the composer's floor with it */
  retract(it: any, cost = 1): void {
    if (this.placed[this.placed.length - 1] !== it) return;
    this.placed.pop();
    const slot = String(it.dk).split(':').slice(-2)[0], n = this.ord.get(slot) ?? 1;
    this.ord.set(slot, n - 1); this.counts.set(slot, (this.counts.get(slot) || 1) - 1); this.spent -= cost;
    const g = this.viaGroup.get(it); this.viaGroup.delete(it);
    if (g && this.composer) { for (const ci of g.items || []) { const i = this.composer.placed.indexOf(ci); if (i >= 0) this.composer.placed.splice(i, 1); } const k = this.composer.groups.indexOf(g); if (k >= 0) this.composer.groups.splice(k, 1); }
  }
  /** is a composer item in a planned curtain's volume (a floor lamp or a plant under a window that is to wear a café curtain) */
  inTheCloth(ci: CItem): boolean { const sp = spanOf(ci); return !!sp && this.inCurtain(ci.box, sp[0], sp[1]); }
  /** is a composer item in a corner camera's way (CAM): a rug and a ceiling piece never are */
  inTheWay(ci: CItem): boolean { const sp = spanOf(ci); return !!sp && camBlocked(this.eyes, ci.box, sp[0], sp[1], ci.layer === 'body'); }
  /** a piece in a corner (a floor lamp, a plant) */
  corner(slot: string, type: string, params: any = {}, tier = this.curTier, cost = 1): any | null {
    if (LAMP_TYPES.has(type) && this.area < LAMP_MIN_AREA) { this.skip(slot, `${type}: the room is under ${LAMP_MIN_AREA} m2, which the light rig does not light`); return null; }
    const c = this.comp(); return this.placeGroup(slot, cornerGroup(c, slot, type, params, { score: it => 0 }), params, tier, cost);
  }
  /** a piece against a wall, scored toward a point (the entry door, a fixture) */
  against(slot: string, type: string, params: any = {}, near: [number, number] | null = null, tier = this.curTier, cost = 1): any | null {
    if (LAMP_TYPES.has(type) && this.area < LAMP_MIN_AREA) { this.skip(slot, `${type}: the room is under ${LAMP_MIN_AREA} m2, which the light rig does not light`); return null; }
    const c = this.comp();
    const g = wallGroup(c, slot, type, params, { score: (p, it) => (near ? -0.6 * Math.hypot(it.cx - near[0], it.cz - near[1]) : 0) });
    return this.placeGroup(slot, g, params, tier, cost);
  }
  /** an item the slot places outright (a blind on its window): no host and no composer fit, only its own key */
  raw(slot: string, type: string, at: [number, number], rot: number, params: any = {}, cost = 0.5): any | null {
    if (!this.open(slot)) return null;
    if (!this.afford(this.curTier, cost)) { this.skip(slot, 'the room budget is spent'); return null; }
    const n = this.ord.get(slot) ?? 0, it: any = { type, at };
    if (rot) it.rot = mm(rot);
    for (const [k, v] of Object.entries(params)) it[k] = typeof v === 'number' ? mm(v) : v;
    it.src = DRESS_SRC; it.dk = `${this.roomKey}:${slot}:${n}`;
    this.ord.set(slot, n + 1); this.placed.push(it); this.counts.set(slot, (this.counts.get(slot) || 0) + 1); this.spent += cost;
    return it;
  }
  /** an item at a fixed pose (a door mat in front of the entry): a one-candidate group */
  atPose(slot: string, type: string, x: number, z: number, rot: number, params: any = {}, tier = this.curTier, cost = 1): any | null {
    const c = this.comp();
    const g: Group = { name: slot, gid: 0, movable: false, cands: [{ key: 'p' }], build: () => [c.item(type, x, z, rot, params)], score: () => 0 };
    return this.placeGroup(slot, g, params, tier, cost);
  }
}

// ---- one room ------------------------------------------------------------------------------------------------------------------------
/** the program a room is dressed as: its own, else read off its name (a hand-authored room); null when nothing recipes it */
export function dressProgram(room: any, lv: any): string | null {
  const p = room.program || inferProgram(room, lv);
  return p && RECIPES[p] && RECIPES[p].slots.length ? p : null;
}

/** one room's dress items, from its final layout items (`composed`: the composer's items for it, [] when it is baked or hand-authored) */
export function dressRoom(spec: any, lv: any, room: any, composedAll: Map<any, any[]>, opts: { level?: number } = {}): DressResult | null {
  if (!room || !room.bounds || room.dress === false) return null;
  if (typeof room.floorOffset === 'number' && room.floorOffset !== 0) return null;   // a raised or sunken floor: its items carry the offset the page adds; not dressed
  const program = dressProgram(room, lv); if (!program) return null;
  const level = Math.max(0, Math.min(1, opts.level ?? (room.dress && typeof room.dress === 'object' && typeof room.dress.level === 'number' ? room.dress.level : 0.5)));
  const base = [...(room.items || []).filter((it: any) => !isDress(it)), ...(composedAll.get(room) || [])];
  const d = new Dresser(spec, lv, room, program, level, base, composedAll), recipe = RECIPES[program];
  // tier 1 first, then 2, then 3 (a stable sort: within a tier the recipe's own order), so what a lower level places is what a higher level places first
  for (const slot of recipe.slots.map((sl, i) => ({ sl, i })).sort((a, b) => a.sl.tier - b.sl.tier || a.i - b.i).map(x => x.sl)) {
    if (!d.open(slot.id)) continue;
    if (level < Math.max(TIER_MIN[slot.tier], slot.min ?? 0)) continue;
    d.curTier = slot.tier;
    try { slot.run(d); } catch (e: any) { d.skip(slot.id, `error: ${e && e.message}`); }
  }
  const bare = bareViolation(program, [...base, ...d.placed], room);
  if (bare) d.skip('never-bare', bare);
  return { items: d.placed, program, level, slots: [...d.counts].map(([slot, n]) => ({ slot, n })), skipped: d.skipped, cap: d.cap, spent: Math.round(d.spent * 100) / 100 };
}

/** the never-bare rule of a program against the room's items (dress included): a reason, or null when the room is dressed enough */
export function bareViolation(program: string | null, items: any[], room?: any): string | null {
  const dress = items.filter(isDress), surf = dress.filter(it => layerOf(it.type) === 'surface');
  const area = room && room.bounds ? room.bounds.w * room.bounds.d : 0;
  if (program === 'bath' || program === 'ensuite' || program === 'powder') {
    if (dress.length < 3) return `a ${program} wants at least 3 dress items (has ${dress.length})`;
    if (!items.some(it => /towel/.test(it.type) && (isDress(it) || /towel-(rail|ladder)/.test(it.type)))) return `a ${program} wants a towel object`;
  }
  if (program === 'dining' && !dress.some(it => it.type === 'place-setting' || it.type === 'table-runner' || it.type === 'centerpiece')) return 'a dining room wants a set table';
  if ((program === 'kitchen' || program === 'kitchen-dining') && surf.length < 4) return `a kitchen wants at least 4 counter clusters (has ${surf.length})`;
  if (program === 'hall' && area >= 8 && dress.length < 3) return `a hall of 8 m2 or more wants at least 3 dress items (has ${dress.length})`;
  return null;
}

// ---- the house -------------------------------------------------------------------------------------------------------------------------
const cache = new WeakMap<any, { sig: number; all: boolean; level: number | null; byRoom: Map<any, DressResult> }>();
const signature = (spec: any): number => fnv1a(JSON.stringify([spec.id, spec.styleKey, spec.hero, spec.entry, spec.features, spec.defaults, spec.palette, spec.levels]));
export const dressStats = { hits: 0, misses: 0 };

function run(spec: any, all: boolean, level: number | null): Map<any, DressResult> {
  const sig = signature(spec), hit = cache.get(spec);
  if (hit && hit.sig === sig && hit.all === all && hit.level === level) { dressStats.hits++; return hit.byRoom; }
  dressStats.misses++;
  const byRoom = new Map<any, DressResult>();
  // (rooms with nothing to dress never ask the composer for anything: composeHouse is cached per spec and shared with the build)
  const wanted: Array<[any, any]> = [];
  for (const lv of spec.levels || []) for (const room of lv.rooms || []) if (room.bounds && room.dress !== false && (all || dressOptIn(room))) wanted.push([lv, room]);
  if (wanted.length) {
    const composed = new Map<any, any[]>();
    for (const [room, res] of composeHouse(spec)) composed.set(room, res.items);
    for (const [lv, room] of wanted) { const res = dressRoom(spec, lv, room, composed, level === null ? {} : { level }); if (res) byRoom.set(room, res); }
  }
  cache.set(spec, { sig, all, level, byRoom });
  return byRoom;
}
/** room -> what the dress phase adds, for the rooms that opt in with `dress.level` (the build and the lints read this) */
export function dressHouse(spec: any): Map<any, DressResult> { return run(spec, false, null); }
/** room -> what the dress phase would add to EVERY room that has a recipe (not a room with `dress: false`), at `level` or each room's own: the bake tool and the census */
export function dressRooms(spec: any, o: { level?: number } = {}): Map<any, DressResult> { return run(spec, true, o.level ?? null); }

