// Layout lints — what makes a furnished room unbelievable, measured on a spec's items (and, for a composed room, on
// the composer's items too). THREE-free: scripts/validate/layout.mts runs them under `pnpm run validate --layout`,
// scripts/test-room-composer.mts holds the composer to them, scripts/compose-house.mts reports them for a bake.
// Plan S3 task 5 and Completeness H; every finding is a warning until the layout pass promotes them (plan §2.0).
//
//   overlap          two solid items overlap (a chair tucked under its table or desk, a rug, a surface item, a wall
//                    or ceiling piece, and an item standing on another are not overlaps)
//   wall-pierce      a solid item crosses one of its room's walls (foliage is exempt outdoors only)
//   outside-room     an item stands more than 0.1 m outside its room across an open side
//   door-swing       a solid item in a door leaf's swing (a ≤ 1.1 m partition door or entry door, on the room side)
//   lane             no lane 0.8 m wide from every way in to every other and to the middle of the room
//   core-walk        the walk from the entry to the Core narrows under 1.2 m (plan H: §4.3/§4.7's main lane), doorways
//                    excepted
//   stair-run-in     less than 1.6 m clear at a flight's foot or at its head (plan H: the canon's 1.6, not 1.2)
//   facing           a sofa or armchair faces a wall within 0.5 m, or turns its back on the room's focus
//   silent-param     an item parameter its builder ignores
//   mount-in-wall    a wall-mounted item set inside the wall's thickness (assets/room-composer.ts snapWallMount)
//   surface-height   a surface item not standing on what is under it (stackOnSurface)
//   repetition       one type in more than 2 rooms of a storey, or more than 5 times in a house (rugs, lamps, fitted
//                    units, fixtures, chairs and bath fittings excepted)
//   kitchen-backwards a fitted unit or appliance whose front faces a wall and whose back does not
//   foyer            the entry opens onto a wall closer than 2.5 m, or sees no feature (a stair, glass, a hearth, an
//                    island) within 6 m (plan H: §4.3's foyer rule)
//   empty-half       a room of 12 m² or more with every piece in one half and nothing in the other (plan H: "no furniture
//                    islands with empty halves")
//   missing-anchor   a room with a `program` that lacks what the program cannot do without (a living room's seating, a bed, a
//                    toilet, a kitchen's sink and range, a dining table and its chairs, the bathing …: ANCHORS below), so an
//                    unfurnished composed room is a warning and never passes as furnished. Rooms under 3 m² are left out
//   surface-kind     an item standing on another that its placement does not allow (`surfaces`: a lamp on a nightstand, a kettle
//                    on a counter)
//   dress-floating   a dress item (src dress@1, plan 5.6) that is not on a host of the dress registry (assets/room-dress-hosts.ts), hangs over its
//                    edge by more than 1 cm, or is not at the host's top
//   dress-overlap    two surface items on one host, one of them a dress item, whose footprints overlap or stand under MIN_GAP (1.5 cm) apart (the other
//                    may be authored, composed or dressed: a candle against the table's own flower-jug reads as one object)
//   dress-lane       a dress item that closes a lane the room's other furniture leaves open
//   dress-bare       a dressed room (it has dress items, or opts in) that its program's never-bare rule still finds bare
//
// Owner: S3 (compose).
import { PROPS } from './props/index.js';
import { PLACEMENT } from './props/placement.js';
import { perimeterEdges, edgeForOpening, inRect } from './house-geometry.js';
import { pageItemDef } from './item-meta.js';
import { HERO_SET } from './item-map.js';
import {
  analyzeRoom, sizeOf, paramsOf, itemObb, overlap, aabb, insideRoom, limitOf, laneGrid, lanesOk, obb, rectObb, turn, containsPt,
  INWARD, alongX, SIDES, DEG, CELL, stairSolids, type Geo, type Obb,
} from './room-geo.js';
import { composeHouse, layerOf, snapWallMount, stackOnSurface } from './room-composer.js';
import { houseStairs, levelStairs } from './stairs.js';
import { isComposed, isProgram } from './room-programs.js';
import { dressHouse, dressOff, dressOptIn, isDress, bareViolation } from './room-dress.js';
import { hostOf, footprintIn, nearOn, rectGap, MIN_GAP } from './room-dress-hosts.js';

/** What a room of each program cannot do without: each anchor is satisfied by `n` items (default 1) with any of the roles
 *  (assets/props/placement.ts). The composer's essentials (its `missing`), the `missing-anchor` lint and the composer's
 *  acceptance test all read this one table. A hero desk in a study counts as its desk. */
export const ANCHORS: Record<string, Array<{ name: string; roles: string[]; n?: number }>> = {
  living: [{ name: 'seating', roles: ['sofa', 'sofa-l', 'loveseat', 'daybed'] }],
  den: [{ name: 'seating', roles: ['sofa', 'sofa-l', 'loveseat', 'daybed'] }],
  media: [{ name: 'seating', roles: ['sofa', 'sofa-l', 'loveseat', 'daybed'] }],
  kitchen: [{ name: 'sink', roles: ['sink-run'] }, { name: 'range', roles: ['range'] }],
  'kitchen-dining': [{ name: 'sink', roles: ['sink-run'] }, { name: 'range', roles: ['range'] }, { name: 'dining table', roles: ['dining-table', 'dining-table-round'] }, { name: 'dining chairs', roles: ['dining-chair'], n: 2 }],
  dining: [{ name: 'dining table', roles: ['dining-table', 'dining-table-round'] }, { name: 'dining chairs', roles: ['dining-chair'], n: 2 }],
  'bed-primary': [{ name: 'bed', roles: ['bed'] }], 'bed-guest': [{ name: 'bed', roles: ['bed'] }],
  'bed-kid': [{ name: 'bed', roles: ['bed', 'bed-single', 'bed-bunk', 'bed-loft'] }], nursery: [{ name: 'crib', roles: ['crib'] }],
  bath: [{ name: 'toilet', roles: ['toilet'] }, { name: 'sink', roles: ['vanity', 'vanity-double'] }, { name: 'tub or shower', roles: ['tub-free', 'tub-built-in', 'shower'] }],
  ensuite: [{ name: 'toilet', roles: ['toilet'] }, { name: 'sink', roles: ['vanity', 'vanity-double'] }, { name: 'tub or shower', roles: ['tub-free', 'tub-built-in', 'shower'] }],
  powder: [{ name: 'toilet', roles: ['toilet'] }, { name: 'sink', roles: ['vanity', 'vanity-double'] }],
  library: [{ name: 'bookcases', roles: ['bookcase'], n: 2 }],
  study: [{ name: 'desk', roles: ['desk'] }],
  workspace: [{ name: 'desks', roles: ['office-desk', 'desk'], n: 2 }],
  meeting: [{ name: 'meeting table', roles: ['meeting-table', 'dining-table'] }, { name: 'chairs', roles: ['office-chair', 'dining-chair'], n: 2 }],
  laundry: [{ name: 'washer', roles: ['washer'] }, { name: 'dryer', roles: ['dryer'] }],
};
/** the anchors of a room's program that its items do not have (names). `heroDesk`: the Core's desk stands in the room */
export function missingAnchors(program: string, items: any[], { heroDesk = false } = {}): string[] {
  const out: string[] = [];
  for (const a of ANCHORS[program] || []) {
    if (a.name === 'desk' && heroDesk) continue;
    const n = items.filter(it => (PLACEMENT[it.type]?.roles || []).some(r => a.roles.includes(r))).length;
    if (n < (a.n ?? 1)) out.push(a.name);
  }
  return out;
}

export interface LayoutIssue { code: string; level: 'warn' | 'error'; message: string; room?: string; level_id?: string }

const UNIVERSAL = new Set(['type', 'at', 'rot', 'y', 'src', 'dk', 'note', 'label', 'id', 'name', 'hero']);   // (`dk`: a dress item's seed key, which no builder reads)
const REPEAT_EXEMPT_GROUPS = new Set(['rug', 'lamp', 'fitted', 'appliance', 'lighting', 'chair', 'bath', 'hero', 'structure', 'decor', 'textile']);
const solidOf = (it: any) => { const l = layerOf(it.type); if (l !== 'body') return false; const s = sizeOf(it.type, it); return !!s && s.h > 0.12; };
/** the body item a surface item stands on (the one under its point that offers the highest top) */
function supportOf(it: any, items: any[]): any | null {
  if (!Array.isArray(it.at)) return null;
  const under = items.filter(o => o !== it && layerOf(o.type) === 'body').map(o => ({ o, box: itemObb(o) })).filter(u => u.box && overlap(obb(it.at[0], it.at[1], 0.05, 0.05), u.box!) > 0);
  if (!under.length) return null;
  const topOf = (o: any) => { const pl = PLACEMENT[o.type], s = sizeOf(o.type, o); return pl && pl.top !== undefined ? pl.top : s ? s.h : 0; };
  return under.sort((a, b) => topOf(b.o) - topOf(a.o))[0].o;
}
const groupOf = (t: string) => (PLACEMENT[t] && PLACEMENT[t].group) || '';
const r1 = (v: number) => v.toFixed(1), fmt = (p: number[]) => `(${r1(p[0])}, ${r1(p[1])})`;

/** the items of every room: its authored items plus, for a composed room, the composer's */
export function roomItems(spec: any): Map<any, any[]> {
  const out = new Map<any, any[]>(), comp = composeHouse(spec), dress = dressOff() ? new Map<any, any>() : dressHouse(spec);
  for (const lv of spec.levels || []) for (const r of lv.rooms || []) {
    const base = [...(r.items || []), ...(isComposed(r) && comp.get(r) ? comp.get(r)!.items : [])];
    // (what the build adds to an opted-in room that carries no baked dress item of its own: rooms-build.ts)
    out.set(r, dressOptIn(r) && !base.some(isDress) && dress.get(r) ? [...base, ...dress.get(r).items] : base);
  }
  return out;
}

/** every lint for one house (warnings) */
export function lintLayout(spec: any, { only = null as Set<string> | null, items: override = null as Map<any, any[]> | null } = {}): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const add = (code: string, message: string, lv?: any, room?: any) => { if (!only || only.has(code)) issues.push({ code, level: 'warn', message: `${lv ? `level ${lv.id}: ` : ''}${room ? `room "${room.name}": ` : ''}${message}` }); };
  const all = override || roomItems(spec);
  const heroAt = spec.hero && Array.isArray(spec.hero.at) ? spec.hero : null;
  const houseCount = new Map<string, number>();
  for (const lv of spec.levels || []) {
    const storeyRooms = new Map<string, Set<string>>();
    for (const room of lv.rooms || []) {
      if (!room.bounds) continue;
      const geo = analyzeRoom(spec, lv, room), items = (all.get(room) || []).filter(it => Array.isArray(it.at) && !(heroAt && heroAt.level === lv.id && HERO_SET.has(it.type) && Math.hypot(it.at[0] - heroAt.at[0], it.at[1] - heroAt.at[1]) < 1.3));
      const outdoor = room.program === 'outdoor' || /terrace|patio|deck|porch|balcony|yard|garden|stoop|pool/i.test(room.name) || room.bounds.w * room.bounds.d < 1.2;
      const boxes = items.map(it => ({ it, o: itemObb(it), solid: solidOf(it) }));
      // the dress phase's items (plan 5.6): each stands on a host of the registry, inside its measured rects and at its top, and on nothing else
      const dressed = items.filter(isDress);
      if (dressed.length) {
        const hosts = items.map(hostOf).filter((h): h is NonNullable<ReturnType<typeof hostOf>> => !!h);
        for (const it of dressed) {
          if (layerOf(it.type) !== 'surface') continue;
          const under = hosts.find(h => { const f = footprintIn(h, it); return !!f && h.rects.some(r => (f[0] + f[2]) / 2 >= r[0] && (f[0] + f[2]) / 2 <= r[2] && (f[1] + f[3]) / 2 >= r[1] && (f[1] + f[3]) / 2 <= r[3]); });
          if (!under) { add('dress-floating', `${it.type} at ${fmt(it.at)} stands on no host of the dress registry`, lv, room); continue; }
          const f = footprintIn(under, it)!, inside = under.rects.some(r => f[0] >= r[0] - 0.01 && f[1] >= r[1] - 0.01 && f[2] <= r[2] + 0.01 && f[3] <= r[3] + 0.01);
          if (!inside) add('dress-floating', `${it.type} at ${fmt(it.at)} overhangs its ${under.type} (outside the flat top by ${Math.max(0, ...under.rects.map(r => Math.max(r[0] - f[0], r[1] - f[1], f[2] - r[2], f[3] - r[3]))).toFixed(2)} m)`, lv, room);
          if (Math.abs((it.y ?? 0) - under.top) > 0.01) add('dress-floating', `${it.type} at ${fmt(it.at)} is at y ${it.y} on a ${under.type} whose top is ${under.top}`, lv, room);
          for (const o of nearOn(under, items)) {   // (on this host and on the next unit of the run: a gap is a gap across the seam)
            if (o === it) continue;
            const g = footprintIn(under, o); if (!g) continue;
            const gap = rectGap(f, g);
            // (two dress items are reported once, from the later one)
            if (gap < MIN_GAP && (!isDress(o) || String(o.dk) < String(it.dk))) add('dress-overlap', `${it.type} at ${fmt(it.at)} and ${o.type} at ${fmt(o.at)} ${gap < 0.005 && gap > -0.005 ? 'touch' : gap < 0 ? 'overlap' : `stand ${(gap * 1000).toFixed(0)} mm apart`} on the ${under.type} (under ${MIN_GAP * 100} cm)`, lv, room);
          }
        }
        const bare = bareViolation(room.program || null, items, room);
        if (bare && (dressOptIn(room) || dressed.length)) add('dress-bare', bare, lv, room);
      }
      // overlap: solid against solid (tucked chairs, and one item standing on another, excepted)
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i], B = boxes[j]; if (!A.solid || !B.solid || !A.o || !B.o) continue;
        const d = overlap(A.o, B.o); if (d <= 0.03) continue;
        const tuck = (P: any, Q: any) => PLACEMENT[P.it.type]?.tucks && ['table', 'desk', 'fitted', 'hero'].includes(groupOf(Q.it.type));
        if (tuck(A, B) || tuck(B, A)) continue;
        if (A.it.y > 0.3 || B.it.y > 0.3) continue;   // one stands on the other, or hangs over it
        add('overlap', `${A.it.type} at ${fmt(A.it.at)} and ${B.it.type} at ${fmt(B.it.at)} overlap by ${d.toFixed(2)} m`, lv, room);
      }
      for (const { it, o, solid } of boxes) {
        if (!o) continue;
        const layer = layerOf(it.type), foliage = groupOf(it.type) === 'plant';
        // through a wall, or out across an open side
        if (layer !== 'wall' && layer !== 'ceiling' && !(foliage && outdoor)) {
          const A = aabb(o);
          const sides: Array<[string, number]> = [['N', limitOf(geo, 'N', A.x0, A.x1) - A.z0], ['S', A.z1 - limitOf(geo, 'S', A.x0, A.x1)], ['W', limitOf(geo, 'W', A.z0, A.z1) - A.x0], ['E', A.x1 - limitOf(geo, 'E', A.z0, A.z1)]];
          for (const [side, out] of sides) {
            const walled = geo.runs.some(r => r.side === side && (alongX(r.side) ? A.x1 > r.a && A.x0 < r.b : A.z1 > r.a && A.z0 < r.b));
            // into the wall's thickness is hidden; past its far face (0.14–0.16 m on) the piece shows on the other side
            if (walled && out > 0.15 && (solid || layer === 'floor') && !foliage) add('wall-pierce', `${it.type} at ${fmt(it.at)} passes ${out.toFixed(2)} m through the ${side} wall`, lv, room);
            else if (!walled && out > 0.1 && solid && !foliage && !outdoor) add('outside-room', `${it.type} at ${fmt(it.at)} stands ${out.toFixed(2)} m outside the room on its ${side} side`, lv, room);
          }
        }
        // in a door's swing
        if (solid) for (const p of geo.portals) {
          if (!p.hinged) continue;
          const [nx, nz] = INWARD[p.side], sq = alongX(p.side) ? obb(p.x, p.z + nz * p.w / 2, p.w, p.w, 0) : obb(p.x + nx * p.w / 2, p.z, p.w, p.w, 0);
          if (overlap(sq, o) > 0.05) add('door-swing', `${it.type} at ${fmt(it.at)} stands in the swing of the ${p.kind} on the ${p.side} wall`, lv, room);
        }
        // silent parameters
        const P: string[] | null = PROPS.has(it.type) || pageItemDef(it.type) ? paramsOf(it.type) : null;
        if (P) for (const k of Object.keys(it)) if (!UNIVERSAL.has(k) && !P.includes(k) && !(k === 'y')) add('silent-param', `${it.type} at ${fmt(it.at)}: "${k}" is ignored by its builder`, lv, room);
        // mounts inside the wall, surface items floating or sunk
        if (layer === 'wall' && snapWallMount(it, geo)) add('mount-in-wall', `${it.type} at ${fmt(it.at)} is set inside the wall`, lv, room);
        // (a dress item's host is the dress registry's to judge: assets/room-dress-hosts.ts, the `dress-*` lints; PLACEMENT.surfaces is the composer's own)
        if (layer === 'surface' && !isDress(it)) {
          const pl = PLACEMENT[it.type], top = pl && pl.surfaces.length ? supportOf(it, items) : null;
          if (top && !pl.surfaces.includes(groupOf(top.type))) add('surface-kind', `${it.type} at ${fmt(it.at)} stands on a ${top.type}, which its placement does not allow (${pl.surfaces.join(', ')})`, lv, room);
        }
        if (layer === 'surface' && !isDress(it) && stackOnSurface(it, items)) add('surface-height', `${it.type} at ${fmt(it.at)} (y ${it.y ?? 'default 0.77'}) is not on the top of what stands under it`, lv, room);
        // facing: seating that looks at a wall
        if (solid && PLACEMENT[it.type] && PLACEMENT[it.type].faces === 'focus' && !PLACEMENT[it.type].roles.some(r => ['bench', 'bed-bench', 'ottoman', 'pouf', 'floor-seat', 'dining-bench', 'hammock'].includes(r))) {
          const [fx, fz] = turn(0, 1, it.rot || 0), s = sizeOf(it.type, it)!;
          const probe = obb(o.cx + fx * (s.d / 2 + 0.25), o.cz + fz * (s.d / 2 + 0.25), Math.max(0.2, s.w - 0.3), 0.5, it.rot || 0);
          if (!insideRoom(geo, probe, 0, 2)) add('facing', `${it.type} at ${fmt(it.at)} faces a wall ${0.5} m away`, lv, room);
        }
        // a kitchen run installed backwards
        if (solid && ['fitted', 'appliance'].includes(groupOf(it.type)) && PLACEMENT[it.type].against === 'wall') {
          const s = sizeOf(it.type, it)!, [fx, fz] = turn(0, 1, it.rot || 0);
          const front = obb(o.cx + fx * (s.d / 2 + 0.15), o.cz + fz * (s.d / 2 + 0.15), s.w * 0.6, 0.3, it.rot || 0), back = obb(o.cx - fx * (s.d / 2 + 0.15), o.cz - fz * (s.d / 2 + 0.15), s.w * 0.6, 0.3, it.rot || 0);
          if (!insideRoom(geo, front, 0, 2) && insideRoom(geo, back, 0, 2)) add('kitchen-backwards', `${it.type} at ${fmt(it.at)} faces the wall it should back onto`, lv, room);
        }
        // repetition counts
        // (a wall of matched bookcases is one piece of furniture: the library's run of four is not four repeats)
        if (!isDress(it) && !REPEAT_EXEMPT_GROUPS.has(groupOf(it.type)) && !HERO_SET.has(it.type) && !(PLACEMENT[it.type] && PLACEMENT[it.type].roles.includes('bookcase'))) {
          houseCount.set(it.type, (houseCount.get(it.type) || 0) + 1);
          (storeyRooms.get(it.type) || storeyRooms.set(it.type, new Set()).get(it.type)!).add(room.name);
        }
      }
      // lanes (0.8 m), in rooms that have somewhere to walk
      if (!outdoor && geo.area >= 3) {
        const blockers = [...geo.obstacles, ...boxes.filter(b => b.solid && b.o).map(b => b.o!)];
        const bare = lanesOk(geo, laneGrid(geo, geo.obstacles), 0.8);
        const rep = lanesOk(geo, laneGrid(geo, blockers), 0.8);
        const extra = rep.failed.filter(f => !bare.failed.includes(f));
        // (a lane the room's own furniture leaves open and a dress item closes is the dress phase's: dress-lane)
        const noDress = lanesOk(geo, laneGrid(geo, [...geo.obstacles, ...boxes.filter(b => b.solid && b.o && !isDress(b.it)).map(b => b.o!)]), 0.8);
        for (const f of extra) add(dressed.length && !noDress.failed.includes(f) ? 'dress-lane' : 'lane', f, lv, room);
      }
      // a room with a program that lacks what the program cannot do without
      if (isProgram(room.program) && geo.area >= 3 && !outdoor) {
        const lacks = missingAnchors(room.program, items, { heroDesk: geo.heroHere && (spec.hero.surface || 'desk') === 'desk' });
        if (lacks.length) add('missing-anchor', `${room.program} has no ${lacks.join(', no ')}`, lv, room);
      }
      // a furniture island with an empty half (a garage's other half is for the car, an outdoor room's furniture does not
      // need to fill its whole deck or patio: the composer's own emptyHalf() never tries to fill either, for the same reason)
      if (geo.area >= 12 && !outdoor && room.program !== 'garage') {
        const along = geo.b.w >= geo.b.d, mid = along ? geo.b.x + geo.b.w / 2 : geo.b.z + geo.b.d / 2;
        const solidItems = boxes.filter(b => b.solid && b.o);
        const lo = solidItems.filter(b => (along ? b.o!.cx : b.o!.cz) < mid).length, hi = solidItems.length - lo;
        if ((lo === 0 && hi >= 3) || (hi === 0 && lo >= 3)) add('empty-half', `every piece stands in one half (${Math.max(lo, hi)} there, none in the other)`, lv, room);
      }
    }
    for (const [t, rooms] of storeyRooms) if (rooms.size > 2) add('repetition', `${t} in ${rooms.size} rooms of this storey (${[...rooms].join(', ')})`, lv);
  }
  for (const [t, n] of houseCount) if (n > 5) add('repetition', `${t} ${n} times in the house`);
  for (const i of stairRunIn(spec, all)) add('stair-run-in', i);
  for (const i of foyerRule(spec)) add('foyer', i);
  const cw = coreWalk(spec, all); if (cw) add('core-walk', cw);
  return issues;
}

// ---- stairs: 1.6 m clear at the foot and at the head ------------------------------------------------------------------
function stairRunIn(spec: any, all: Map<any, any[]>): string[] {
  const out: string[] = [];
  // every flight: its foot (1.6 m behind its first step) and the head (1.6 m past its last, on the storey it climbs to). A single straight
  // flight keeps its own numbers; an L, a U or one of an array runs on stairs.ts's plan (the heading off the top is the last flight's)
  for (const { lv, st, plan } of houseStairs(spec)) {
    if (plan.shape === 'spiral') continue;
    const turning = Array.isArray(lv.stairs) || plan.shape === 'L' || plan.shape === 'U';
    const run = st.run || 3.36, w = turning ? plan.w : st.w || 1.1;
    const f0 = plan.flights[0], fl = plan.flights[plan.flights.length - 1];
    const a = (turning ? f0.rot : st.rot || 0) * DEG, d = [Math.sin(a), Math.cos(a)], top = levelById(spec, st.to);
    const at = plan.bottom, headD = turning ? plan.dir : d, headAt = turning ? plan.top : [at[0] + d[0] * run, at[1] + d[1] * run], headRot = turning ? fl.rot : st.rot || 0;
    for (const [where, L, cx, cz, rot, ox, oz, dx, dz] of [
      ['foot', lv, at[0] - d[0] * 0.8, at[1] - d[1] * 0.8, turning ? f0.rot : st.rot || 0, at[0], at[1], -d[0], -d[1]],
      ['head', top, headAt[0] + headD[0] * 0.8, headAt[1] + headD[1] * 0.8, headRot, headAt[0], headAt[1], headD[0], headD[1]],
    ] as Array<[string, any, number, number, number, number, number, number, number]>) {
      if (!L) continue;
      const zone = obb(cx, cz, w, 1.6, rot);
      const inFoot = [0.2, 0.8, 1.4].every(f => (L.footprint || []).some((r: any) => inRect(ox + dx * f, oz + dz * f, r, 0)));
      if (!inFoot) { out.push(`level ${L.id}: the flight to ${st.to} has less than 1.6 m of floor at its ${where} (it runs into the outside wall)`); continue; }
      for (const room of L.rooms || []) for (const it of all.get(room) || []) {
        if (!solidOf(it)) continue; const o = itemObb(it); if (!o) continue;
        if (overlap(o, zone) > 0.05) out.push(`level ${L.id}: ${it.type} at ${fmt(it.at)} stands in the 1.6 m clear at the ${where} of the flight to ${st.to}`);
      }
      for (const p of L.partitions || []) {
        if (!Array.isArray(p.from) || !Array.isArray(p.to)) continue;
        const px = Math.abs(p.from[1] - p.to[1]) < 1e-6, seg = px ? rectObb(Math.min(p.from[0], p.to[0]), p.from[1] - 0.07, Math.max(p.from[0], p.to[0]), p.from[1] + 0.07) : rectObb(p.from[0] - 0.07, Math.min(p.from[1], p.to[1]), p.from[0] + 0.07, Math.max(p.from[1], p.to[1]));
        if (overlap(seg, zone) > 0.05) out.push(`level ${L.id}: a partition stands in the 1.6 m clear at the ${where} of the flight to ${st.to}`);
      }
    }
  }
  return out;
}
const levelById = (spec: any, id: string) => (spec.levels || []).find((l: any) => l.id === id);

// ---- the foyer: 2.5 m to the first wall, a feature within 6 m ------------------------------------------------------------
function foyerRule(spec: any): string[] {
  const e = spec.entry; if (!e) return [];
  const lv = levelById(spec, e.level); if (!lv) return [];
  const edges = perimeterEdges(lv.footprint), edge = edgeForOpening(edges, e.side, e.at); if (!edge) return [];
  const n = INWARD[e.side as 'N' | 'S' | 'W' | 'E'];
  const x0 = alongX(e.side) ? e.at : edge.a[0], z0 = alongX(e.side) ? edge.a[1] : e.at;
  // the first wall straight in: a partition crossing the entry axis, or the far outside wall
  let wall = Infinity;
  for (const p of lv.partitions || []) {
    if (!Array.isArray(p.from)) continue;
    const px = Math.abs(p.from[1] - p.to[1]) < 1e-6;
    if (px === alongX(e.side)) {
      const ln = px ? p.from[1] : p.from[0], lo = px ? Math.min(p.from[0], p.to[0]) : Math.min(p.from[1], p.to[1]), hi = px ? Math.max(p.from[0], p.to[0]) : Math.max(p.from[1], p.to[1]);
      const t = alongX(e.side) ? x0 : z0, dd = ((ln - (alongX(e.side) ? z0 : x0)) * (alongX(e.side) ? n[1] : n[0]));
      const dc = p.door == null ? null : lo + (Math.sign((px ? p.to[0] - p.from[0] : p.to[1] - p.from[1]) || 1) > 0 ? p.door : hi - lo - p.door), dw = (p.doorW || 0.9) / 2;
      if (dd > 0.2 && t > lo && t < hi && !(dc !== null && Math.abs(t - dc) < dw)) wall = Math.min(wall, dd);
    }
  }
  const out: string[] = [];
  if (wall < 2.5) out.push(`the entry opens onto a wall ${wall.toFixed(1)} m in (the canon's foyer keeps 2.5 m clear)`);
  // a feature in sight: a flight, glass, a hearth or an island within 6 m, within 35° of the entry axis
  const seen = (x: number, z: number) => { const dx = x - x0, dz = z - z0, dd = Math.hypot(dx, dz); if (dd > 6 || dd < 0.5) return false; return (dx * n[0] + dz * n[1]) / dd > Math.cos(35 * DEG); };
  let feature = levelStairs(lv).some((st: any) => Array.isArray(st.at) && seen(st.at[0], st.at[1]));
  for (const op of lv.openings || []) if (!feature && (op.type === 'glass' || op.type === 'slider') && op !== undefined) { const ed = edgeForOpening(edges, op.side, op.at); if (ed) feature = seen(alongX(op.side) ? op.at : ed.a[0], alongX(op.side) ? ed.a[1] : op.at); }
  for (const r of lv.rooms || []) for (const it of r.items || []) if (!feature && Array.isArray(it.at) && ['fireplace', 'kitchen-island', 'breakfast-bar', 'grand-piano'].includes(it.type)) feature = seen(it.at[0], it.at[1]);
  if (!feature) out.push('nothing to see from the entry: no stair, glass, hearth or island within 6 m of its axis (±35°)');
  return out;
}

// ---- the walk from the entry to the Core: its narrowest point, doorways excepted --------------------------------------------
/** The widest walk (a maximin path on a 0.1 m grid of the storey) from inside the entry to the Core's approach (on the
 *  entry storey) or to the flight's foot, and from the flight's head to the Core on the Core's storey. null when it is
 *  1.2 m or more everywhere; else a finding naming the pinch. */
export function coreWalk(spec: any, all: Map<any, any[]>): string | null {
  const e = spec.entry, h = spec.hero; if (!e || !h || !Array.isArray(h.at)) return null;
  const legs: Array<{ lv: any; from: [number, number]; to: [number, number] }> = [];
  const elv = levelById(spec, e.level), hlv = levelById(spec, h.level); if (!elv || !hlv) return null;
  const edges = perimeterEdges(elv.footprint), edge = edgeForOpening(edges, e.side, e.at); if (!edge) return null;
  const n = INWARD[e.side as 'N' | 'S' | 'W' | 'E'], door: [number, number] = alongX(e.side) ? [e.at + 0, edge.a[1] + n[1] * 0.4] : [edge.a[0] + n[0] * 0.4, e.at];
  const fwd = [Math.sin((h.rot || 0) * DEG), Math.cos((h.rot || 0) * DEG)], core: [number, number] = [h.at[0] + fwd[0] * 1.3, h.at[1] + fwd[1] * 1.3];
  if (elv === hlv) legs.push({ lv: elv, from: door, to: core });
  else {
    const st = levelStairs(elv).find((q: any) => q.to === hlv.id && Array.isArray(q.at)); if (!st) return null;
    const a = (st.rot || 0) * DEG, d = [Math.sin(a), Math.cos(a)], run = st.run || 3.36;
    // (an L or a U, or one of an array: the foot is the first step's, the head the last flight's top and its own heading — stairs.ts's plan)
    const plan = houseStairs(spec).find(q => q.st === st);
    const turning = !!plan && (Array.isArray(elv.stairs) || plan.plan.shape === 'L' || plan.plan.shape === 'U');
    const head: [number, number] = turning ? [plan!.plan.top[0] + plan!.plan.dir[0] * 0.6, plan!.plan.top[1] + plan!.plan.dir[1] * 0.6] : [st.at[0] + d[0] * (run + 0.6), st.at[1] + d[1] * (run + 0.6)];
    legs.push({ lv: elv, from: door, to: [st.at[0] - d[0] * 0.6, st.at[1] - d[1] * 0.6] });
    legs.push({ lv: hlv, from: head, to: core });
  }
  let worst: { w: number; at: [number, number]; lv: string } | null = null;
  for (const L of legs) {
    const r = widest(spec, L.lv, L.from, L.to, all);
    if (r && (!worst || r.w < worst.w)) worst = { ...r, lv: L.lv.id };
  }
  if (!worst || worst.w >= 1.2 - 1e-6) return null;
  return worst.w <= 0 ? `level ${worst.lv}: no walk at all from the entry to the Core` : `level ${worst.lv}: the walk from the entry to the Core narrows to ${worst.w.toFixed(2)} m at ${fmt(worst.at)} (plan H: 1.2 m on the main walk)`;
}
function widest(spec: any, lv: any, from: [number, number], to: [number, number], all: Map<any, any[]>) {
  const fp = lv.footprint || []; if (!fp.length) return null;
  const x0 = Math.min(...fp.map((r: any) => r.x)) - 0.2, z0 = Math.min(...fp.map((r: any) => r.z)) - 0.2, x1 = Math.max(...fp.map((r: any) => r.x + r.w)) + 0.2, z1 = Math.max(...fp.map((r: any) => r.z + r.d)) + 0.2;
  const nx = Math.ceil((x1 - x0) / CELL), nz = Math.ceil((z1 - z0) / CELL), N = nx * nz;
  const blocked = new Uint8Array(N), doorway = new Uint8Array(N);
  const cx = (i: number) => x0 + (i + 0.5) * CELL, cz = (k: number) => z0 + (k + 0.5) * CELL;
  const mark = (o: Obb, v = 1, arr = blocked) => { const A = aabb(o); for (let k = Math.max(0, Math.floor((A.z0 - z0) / CELL)); k <= Math.min(nz - 1, Math.ceil((A.z1 - z0) / CELL)); k++) for (let i = Math.max(0, Math.floor((A.x0 - x0) / CELL)); i <= Math.min(nx - 1, Math.ceil((A.x1 - x0) / CELL)); i++) if (containsPt(o, cx(i), cz(k), 0)) arr[k * nx + i] = v; };
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) if (!fp.some((r: any) => inRect(cx(i), cz(k), r, -0.08))) blocked[k * nx + i] = 1;
  // the doors in the outside wall and the partition doorways are gaps (and their funnels are exempt from the width)
  const edges = perimeterEdges(fp);
  for (const op of lv.openings || []) if (['door', 'slider', 'garage'].includes(op.type)) { const ed = edgeForOpening(edges, op.side, op.at); if (!ed) continue; const px = alongX(op.side), c = px ? [op.at, ed.a[1]] : [ed.a[0], op.at]; mark(px ? obb(c[0], c[1], op.w, 0.4, 0) : obb(c[0], c[1], 0.4, op.w, 0), 0); mark(obb(c[0], c[1], op.w + 1.2, op.w + 1.2, 0), 1, doorway); }
  for (const p of lv.partitions || []) {
    if (!Array.isArray(p.from) || !Array.isArray(p.to)) continue;
    const px = Math.abs(p.from[1] - p.to[1]) < 1e-6, ln = px ? p.from[1] : p.from[0], lo = px ? Math.min(p.from[0], p.to[0]) : Math.min(p.from[1], p.to[1]), hi = px ? Math.max(p.from[0], p.to[0]) : Math.max(p.from[1], p.to[1]);
    const dir = px ? Math.sign(p.to[0] - p.from[0]) || 1 : Math.sign(p.to[1] - p.from[1]) || 1, base = px ? p.from[0] : p.from[1];
    // a single door (`door` / `doorW`), and/or more than one doorway (`doors[]`) — both are real gaps in the wall
    const gaps: Array<[number, number]> = [
      ...(p.door == null ? [] : [[base + dir * p.door - (p.doorW || 0.9) / 2, base + dir * p.door + (p.doorW || 0.9) / 2] as [number, number]]),
      ...(Array.isArray(p.doors) ? p.doors.map((d: any) => { const dc = base + dir * d.at, dw = (d.w || 0.9) / 2; return [dc - dw, dc + dw] as [number, number]; }) : []),
    ].sort((a, b) => a[0] - b[0]);
    let cursor = lo; const segs: Array<[number, number]> = [];
    for (const [g0, g1] of gaps) { if (g0 > cursor) segs.push([cursor, g0]); cursor = Math.max(cursor, g1); }
    if (cursor < hi) segs.push([cursor, hi]);
    for (const [a, b] of segs) if (b - a > 0.02) mark(px ? rectObb(a, ln - 0.07, b, ln + 0.07) : rectObb(ln - 0.07, a, ln + 0.07, b));
    for (const [g0, g1] of gaps) { const dc = (g0 + g1) / 2, dw = (g1 - g0) / 2; mark(px ? obb(dc, ln, 2 * dw + 1.2, 1.4, 0) : obb(ln, dc, 1.4, 2 * dw + 1.2, 0), 1, doorway); }
  }
  { const sg = stairSolids(spec, lv); for (const o of [...sg.obstacles, ...sg.holes]) mark(o); }
  for (const v of lv.voids || []) mark(rectObb(v.x, v.z, v.x + v.w, v.z + v.d));
  for (const r of lv.rooms || []) for (const it of all.get(r) || []) if (solidOf(it)) { const o = itemObb(it); if (o) mark(o); }
  if (spec.hero && spec.hero.level === lv.id) { const hh = spec.hero, surf = hh.surface || 'desk', dims = surf === 'shelf' ? [0.9, 0.3] : surf === 'credenza' ? [1.8, 0.45] : surf === 'island' ? [2.4, 1.0] : [1.8, 0.85]; mark(obb(hh.at[0], hh.at[1], dims[0], dims[1], hh.rot || 0)); }
  // clearance field, then the maximin path by descending widths
  const INF = 1e9, dist = new Float32Array(N); for (let n = 0; n < N; n++) dist[n] = blocked[n] ? 0 : INF;
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { const n = k * nx + i; let v = dist[n]; if (i) v = Math.min(v, dist[n - 1] + CELL); if (k) { v = Math.min(v, dist[n - nx] + CELL); if (i) v = Math.min(v, dist[n - nx - 1] + CELL * Math.SQRT2); if (i < nx - 1) v = Math.min(v, dist[n - nx + 1] + CELL * Math.SQRT2); } dist[n] = v; }
  for (let k = nz - 1; k >= 0; k--) for (let i = nx - 1; i >= 0; i--) { const n = k * nx + i; let v = dist[n]; if (i < nx - 1) v = Math.min(v, dist[n + 1] + CELL); if (k < nz - 1) { v = Math.min(v, dist[n + nx] + CELL); if (i < nx - 1) v = Math.min(v, dist[n + nx + 1] + CELL * Math.SQRT2); if (i) v = Math.min(v, dist[n + nx - 1] + CELL * Math.SQRT2); } dist[n] = v; }
  const cell = (p: [number, number]) => { const i = Math.floor((p[0] - x0) / CELL), k = Math.floor((p[1] - z0) / CELL); return i >= 0 && k >= 0 && i < nx && k < nz ? k * nx + i : -1; };
  const s = cell(from), t = cell(to); if (s < 0 || t < 0) return null;
  const width = (n: number) => (doorway[n] ? 99 : 2 * Math.max(0, dist[n] - CELL / 2));
  const reach = (W: number) => {
    const seen = new Uint8Array(N), q = [s]; seen[s] = 1;
    for (let hd = 0; hd < q.length; hd++) { const n = q[hd]; if (n === t) return true; const i = n % nx, k = (n - i) / nx; for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) { const ii = i + di, kk = k + dk; if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue; const m = kk * nx + ii; if (!seen[m] && !blocked[m] && (width(m) >= W - 1e-6 || m === t)) { seen[m] = 1; q.push(m); } } }
    return false;
  };
  let lo = 0, found = 0;
  for (const W of [1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) if (reach(W)) { found = W; break; }
  if (found >= 1.2) return { w: found, at: from };
  // the pinch: the narrowest cell on a path found at `found` (a coarse locator: the cell nearest the walk's midpoint
  // whose width is under the next step up)
  let at: [number, number] = from, bestD = Infinity; const mx = (from[0] + to[0]) / 2, mz = (from[1] + to[1]) / 2;
  for (let n = 0; n < N; n++) { if (blocked[n] || doorway[n]) continue; const w = width(n); if (w >= found - 1e-6 && w < found + 0.1) { const i = n % nx, k = (n - i) / nx, dd = Math.hypot(cx(i) - mx, cz(k) - mz); if (dd < bestD) { bestD = dd; at = [cx(i), cz(k)]; } } }
  void lo;
  return { w: found, at };
}
