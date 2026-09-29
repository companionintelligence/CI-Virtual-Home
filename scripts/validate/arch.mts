// Validator plugin — owned by S2 (architecture). See _types.mts for the contract.
//
// Takes over two core rules, whose meaning S2 changes:
//   'stairs'        levels[].stairs is one flight or an array of them (Completeness A2); every flight has a known
//                   type (+ closed, L, U), an `at`, and a `to` naming a higher storey
//   'raised-level'  a storey above grade is reached by a flight — unless it is the lowest storey (a raised ground
//                   floor on a plinth, reached by its stoop); a void over the stairwell (or the flight's autoVoid);
//                   no balustrade across any flight's step-off. v1's messages, word for word, for v1's cases.
// and adds the architecture lints — warnings until the layout pass promotes them (plan §2.0):
//   stair-void       the storey above is solid over a flight where the climb needs its headroom
//   stair-step-off   0.3 m past a flight's top step is not open floor: outside the storey, in its void, or into a wall
//   roof-storey      a roof whose plan runs into a taller storey's walls (the roof slices through it)
//   roof-y           a roof's eave height meets no storey top under it (a gap or an overlap at the wall head)
//   chimney-hearth   a roof chimney that stands over no fireplace (and a fireplace feature under no roof)
//   porch-door       a porch post in a door's span
//   feature-opening  a bay over a door, a porch roof across an upper window, a balcony's deck across a window
// and checks the S2 fields' values (unknown kinds are errors, like the core's vocabularies).
// (S0 also lets this plugin replace 'footprint-rects' and 'partition-axis-aligned' — polygon plans and angled partitions, which S2
// has not built, so neither is replaced.)
import type { Check, Extend, Rule } from './_types.mts';
import { levelStairs, houseStairs, autoVoidsFor } from '../../assets/stairs.js';
import { porchPosts as porchPostsAlong } from '../../assets/arch-plan.js';

export const extend: Extend = { stairTypes: ['closed', 'L', 'U'], roofTypes: ['pent'] };
export const replaces: Rule[] = ['stairs', 'raised-level'];

const SIDES = ['S', 'N', 'E', 'W'];
const CLAD = ['stucco', 'siding', 'brick', 'stone', 'timber', 'corrugated', 'board-and-batten', 'concrete', 'shingle'];
const FLOOR_KINDS = ['oak', 'honey-oak', 'walnut', 'cherry', 'white-oak', 'grey-wash', 'herringbone', 'chevron', 'tile', 'hex-tile', 'checker', 'terracotta', 'stone', 'pavers', 'slate', 'concrete', 'carpet', 'marble', 'terrazzo', 'phthalo-terrazzo', 'charcoal-terrazzo', 'deck'];
const WALL_KINDS = ['paint', 'plaster', 'painted-brick', 'brick', 'stone', 'concrete', 'wallpaper', 'wainscot', 'board-and-batten', 'shiplap', 'timber', 'tile'];
const CEILING_KINDS = ['flat', 'timber', 'beams', 'vault', 'tray', 'double'];
const ROOF_FINISH = ['shingle', 'seam', 'tile', 'slate', 'shake', 'membrane'];
const ROOF_ENDS = ['gable', 'hip', 'open', 'abut'];
const PART_STYLES = ['solid', 'half', 'posts', 'slats', 'glass', 'arch', 'bookcase'];
const FEATURE_TYPES = ['porch', 'balcony', 'terrace', 'loggia', 'bay', 'fireplace', 'builtin'];
const HEADS = ['flat', 'arch', 'segmental', 'pediment', 'keystone', 'crown'];
const SURROUNDS = ['casing', 'stone', 'brick-soldier', 'box-reveal', 'none'];
const CANOPIES = ['flat', 'lattice', 'awning', 'gable', 'shed'];
const HEX = /^#[0-9a-fA-F]{6}$/;

const inRect = (x: number, z: number, r: any, tol = 0.01) => x >= r.x - tol && x <= r.x + r.w + tol && z >= r.z - tol && z <= r.z + r.d + tol;
const fmt = (v: number) => +v.toFixed(2);

const check: Check = (spec, ctx) => {
  const out: ReturnType<Check> = [];
  const err = (message: string, code?: string) => out.push({ level: 'error', message, ...(code ? { code } : {}) });
  const warn = (message: string, code: string) => out.push({ level: 'warn', message, code });
  const levels = spec.levels || [];
  const byId = Object.fromEntries(levels.map(l => [l.id, l]));
  const STAIR_TYPES = ctx.vocab.stairTypes;
  const colour = (v: any, what: string) => { if (v !== undefined && !(typeof v === 'string' && HEX.test(v))) err(`${what}: colour ${JSON.stringify(v)} (#rrggbb)`, 'colour'); };
  const oneOf = (v: any, list: string[], what: string) => { if (v !== undefined && !list.includes(v)) err(`${what} "${v}" (${list.join(' | ')})`, 'vocab'); };

  // ---- rule 'stairs' (replaces the core's): one flight or an array ------------------------------------------------
  for (const lv of levels) {
    if (!lv.stairs) continue;
    const L = `level ${lv.id}`, arr = Array.isArray(lv.stairs);
    levelStairs(lv).forEach((st, i) => {
      const S = arr ? `${L}: stairs[${i}]` : `${L}: stairs`;
      if (!STAIR_TYPES.includes(st.type)) err(`${S}.type "${st.type}"`);
      if (!Array.isArray(st.at)) err(`${S}.at required`);
      if (st.to !== undefined && !byId[st.to]) err(`${S}.to "${st.to}" is not a level`, 'stair-to');
      else if (st.to !== undefined && (byId[st.to].y || 0) <= (lv.y || 0)) err(`${S}.to "${st.to}" (y ${byId[st.to].y}) is not above ${lv.id} (y ${lv.y}) — a flight climbs from its own storey`, 'stair-to');
      if (st.type === 'L' || st.type === 'U') {
        oneOf(st.style, ['timber', 'colonial', 'closed'], `${S}.style`);
        oneOf(st.turn, ['left', 'right'], `${S}.turn`);
      }
      oneOf(st.riser, ['open', 'closed'], `${S}.riser`);
      oneOf(st.handrailSide, ['left', 'right', 'both', 'none'], `${S}.handrailSide`);
      colour(st.stringer, `${S}.stringer`);
    });
    if (arr && !levelStairs(lv).length) err(`${L}: stairs is an empty array`);
  }

  // ---- rule 'raised-level' (replaces the core's) ---------------------------------------------------------------------
  const flights = houseStairs(spec);
  const lowestY = levels.length ? Math.min(...levels.map(l => l.y || 0)) : 0;
  for (const lv of levels) if (lv.y > 0) {
    const mine = flights.filter(f => f.plan.to === lv.id);
    // the lowest storey standing above grade is a raised ground floor (a plinth, a stoop): nothing climbs to it
    if (!mine.length && lv.y > lowestY + 1e-6) err(`level ${lv.id} (y=${lv.y}) has no stairs leading to it`);
    const auto = autoVoidsFor(spec, lv.id);
    // (v1's words, uncoded, so the report of a v1 spec reads as it did) — unless no flight to it climbs under its slab: an
    // exterior flight, or a half-flight up from a split level beside it, needs no hole in it
    const under = mine.some(f => f.plan.shape === 'spiral' || f.plan.flights.some(fl => [0.25, 0.5, 0.75].some(t => { const d = [Math.sin(fl.rot * Math.PI / 180), Math.cos(fl.rot * Math.PI / 180)]; return (lv.footprint || []).some(r => inRect(fl.at[0] + d[0] * fl.run * t, fl.at[1] + d[1] * fl.run * t, r, -0.05)); })));
    if (lv.y > lowestY + 1e-6 && !(lv.voids || []).length && !auto.length && (under || !mine.length)) out.push({ level: 'warn', message: `level ${lv.id}: no voids over the stairwell` });
    // a balustrade across a flight's step-off fences the landing (the builder's stair top is its last step)
    for (const f of mine) {
      if (f.plan.shape === 'spiral') continue;
      const [tx, tz] = f.plan.top, w = f.plan.w / 2;
      for (const bl of lv.balustrades || []) {
        if (!Array.isArray(bl.from) || !Array.isArray(bl.to)) continue;
        const alongX = Math.abs(bl.from[1] - bl.to[1]) < 1e-6;
        const lo = Math.min(bl.from[alongX ? 0 : 1], bl.to[alongX ? 0 : 1]), hi = Math.max(bl.from[alongX ? 0 : 1], bl.to[alongX ? 0 : 1]);
        const across = alongX ? Math.abs(tz - bl.from[1]) : Math.abs(tx - bl.from[0]), along = alongX ? tx : tz;
        if (across < 0.45 && along > lo - w && along < hi + w) err(`level ${lv.id}: balustrade ${JSON.stringify(bl.from)}→${JSON.stringify(bl.to)} crosses the stair step-off at (${tx.toFixed(2)}, ${tz.toFixed(2)})`);
      }
    }
  }

  // ---- stair-void and stair-step-off ----------------------------------------------------------------------------------
  for (const { lv, plan: p } of flights) {
    const up = byId[p.to];
    if (!up || !(up.y > (lv.y || 0)) || !Array.isArray(up.footprint)) continue;
    const S = `level ${lv.id}: the ${p.shape === 'straight' ? p.type : p.shape === 'spiral' ? 'spiral' : p.shape + '-'} stair at [${p.bottom}]${levelStairs(lv).length > 1 ? ` (#${p.index})` : ''}`;
    const voids = [...(up.voids || []), ...autoVoidsFor(spec, up.id)];
    const solid = (x: number, z: number, tol: number) => up.footprint.some(r => inRect(x, z, r, -0.05)) && !voids.some(v => inRect(x, z, v, tol));
    if (p.shape !== 'spiral') {
      // walk each flight's centreline where the tread is within 2 m of the slab's underside over it
      const h0 = p.rise - 0.18 - 2.0;
      let first = null, last = null;
      for (const f of p.flights) for (let k = 0; k <= 20; k++) {
        const t = k / 20, h = f.y0 + f.rise * t;
        // under the slab with less than the headroom — not yet up at it (a half-flight arriving beside a split level
        // ends on the upper floor, not under it)
        if (h <= h0 + 0.05 || h >= p.rise - 0.2) continue;
        const d = [Math.sin(f.rot * Math.PI / 180), Math.cos(f.rot * Math.PI / 180)];
        const x = f.at[0] + d[0] * f.run * t, z = f.at[1] + d[1] * f.run * t;
        if (solid(x, z, 0.1)) { first ||= [x, z]; last = [x, z]; }
      }
      if (first) warn(`${S} climbs under the ${up.id} slab from (${fmt(first[0])}, ${fmt(first[1])}) to (${fmt(last[0])}, ${fmt(last[1])}) — no void over it there, so the climb has under 2 m of headroom (a void over the run, or autoVoid: true)`, 'stair-void');
    }
    if (p.shape === 'spiral') continue;
    const [sx, sz] = p.stepOff;
    // a flight that arrives at a door in the upper storey's wall (a podium stair into the house), or onto a deck
    // standing at the upper floor's height, arrives somewhere
    const upEdges = ctx.perimeterEdges(up.footprint);
    const atDoor = (up.openings || []).some(op => {
      if (!['door', 'slider', 'glass'].includes(op.type)) return false;
      const horiz = op.side === 'S' || op.side === 'N';
      return upEdges.some(e => e.side === op.side && Math.abs((horiz ? e.a[1] : e.a[0]) - (horiz ? sz : sx)) < 0.4 && (horiz ? op.at >= e.a[0] && op.at <= e.b[0] : op.at >= e.a[1] && op.at <= e.b[1])
        && Math.abs((horiz ? sx : sz) - op.at) < (op.w || 1) / 2);
    });
    const onDeck = (spec.site || []).some(s => s.type === 'deck' && Array.isArray(s.at) && Math.abs((s.y || 0) + (s.h ?? 0.12) - up.y) < 0.35
      && Math.abs(sx - s.at[0]) < (((s.rot || 0) % 180 === 90 ? s.d : s.w) || 3) / 2 + 0.1 && Math.abs(sz - s.at[1]) < (((s.rot || 0) % 180 === 90 ? s.w : s.d) || 3) / 2 + 0.1);
    if (atDoor || onDeck) continue;
    if (!up.footprint.some(r => inRect(sx, sz, r, -0.05))) warn(`${S} tops out at (${sx}, ${sz}), outside ${up.id}'s footprint`, 'stair-step-off');
    else if (voids.some(v => inRect(sx, sz, v, -0.05))) warn(`${S} steps off at (${sx}, ${sz}) into ${up.id}'s void — the top step has to land on floor`, 'stair-step-off');
    else {
      // a partition or balustrade across the way off the top: within 0.35 m ahead, across the flight's width
      const [dx, dz] = p.dir, [tx, tz] = p.top;
      const blocks = [...(up.partitions || []).map(q => ({ ...q, what: 'partition' })), ...(up.balustrades || []).map(q => ({ ...q, what: 'balustrade' }))];
      for (const q of blocks) {
        if (!Array.isArray(q.from) || !Array.isArray(q.to)) continue;
        const alongX = Math.abs(q.from[1] - q.to[1]) < 1e-6;
        if (alongX ? Math.abs(dz) < 0.5 : Math.abs(dx) < 0.5) continue;   // parallel to the climb
        const ahead = alongX ? (q.from[1] - tz) * Math.sign(dz) : (q.from[0] - tx) * Math.sign(dx);
        const along = alongX ? tx : tz, lo = Math.min(q.from[alongX ? 0 : 1], q.to[alongX ? 0 : 1]), hi = Math.max(q.from[alongX ? 0 : 1], q.to[alongX ? 0 : 1]);
        if (ahead > -0.05 && ahead < 0.35 && along > lo - 0.1 && along < hi + 0.1) {
          // a partition doorway right there lets the flight through
          const len = hi - lo, doorsAt = q.what === 'partition' ? [...(q.door != null ? [{ at: q.door, w: q.doorW || 0.9 }] : []), ...((q.doors || []).map(d => ({ at: d.at, w: d.w || 0.9 })))] : [];
          const dirQ = alongX ? Math.sign(q.to[0] - q.from[0]) || 1 : Math.sign(q.to[1] - q.from[1]) || 1;
          const fromC = alongX ? q.from[0] : q.from[1];
          if (doorsAt.some(d => Math.abs(fromC + dirQ * d.at - along) < d.w / 2)) continue;
          warn(`${S} tops out ${fmt(Math.max(0, ahead))} m short of a ${q.what} on ${up.id} (${JSON.stringify(q.from)}→${JSON.stringify(q.to)}) — the step-off runs into it`, 'stair-step-off');
          break;
        }
      }
    }
  }

  // ---- roofs --------------------------------------------------------------------------------------------------------------
  const topOf = (l: any) => (l.y || 0) + (l.knee !== undefined ? l.knee : (l.height || 2.8));   // a knee-walled storey's walls stop at the knee
  const tops = [...new Set(levels.flatMap(l => [topOf(l), ...(l.footprint || []).filter(r => r.h !== undefined).map(r => (l.y || 0) + r.h)]).map(t => +t.toFixed(2)))];
  (spec.roofs || []).forEach((rf, i) => {
    const R = `roof ${i} (${rf.type} at y ${rf.y})`;
    oneOf(rf.finish, ROOF_FINISH, `${R}: finish`);
    colour(rf.trim, `${R}: trim`); colour(rf.soffit, `${R}: soffit`); colour(rf.color, `${R}: color`);
    if (rf.gableWindow !== undefined && rf.gableWindow !== false && !['window', 'louvre'].includes(rf.gableWindow)) err(`${R}: gableWindow ${JSON.stringify(rf.gableWindow)} (false | window | louvre)`, 'vocab');
    for (const [k, v] of Object.entries(rf.ends || {})) { if (!SIDES.includes(k)) err(`${R}: ends.${k} (N | S | E | W)`, 'vocab'); oneOf(v, ROOF_ENDS, `${R}: ends.${k}`); }
    for (const s of rf.gableGlass || []) if (!SIDES.includes(s)) err(`${R}: gableGlass "${s}" (N | S | E | W)`, 'vocab');
    for (const s of rf.sweep || []) if (!SIDES.includes(s)) err(`${R}: sweep "${s}" (N | S | E | W)`, 'vocab');
    for (const [k, v] of Object.entries(rf.pitches || {})) if (!SIDES.includes(k) || !(typeof v === 'number' && v > 0 && v < 75)) err(`${R}: pitches.${k} ${v} (degrees, 0–75, per side)`, 'vocab');
    oneOf(rf.planted, ['meadow', 'sedum'], `${R}: planted`);
    if (rf.gableCladding) { oneOf(rf.gableCladding.material, CLAD, `${R}: gableCladding.material`); colour(rf.gableCladding.color, `${R}: gableCladding.color`); }
    for (const d of rf.dormers || []) { oneOf(d.style, ['gable', 'shed', 'flat', 'eyebrow', 'glazed'], `${R}: dormer style`); oneOf(d.side, SIDES, `${R}: dormer side`); }
    if (rf.chimney) { oneOf(rf.chimney.material, ['brick', 'stone', 'stucco', 'metal'], `${R}: chimney.material`); oneOf(rf.chimney.cap, ['stone', 'pots', 'metal'], `${R}: chimney.cap`); colour(rf.chimney.color, `${R}: chimney.color`); }
    for (const s of rf.skylights || []) if (!Array.isArray(s.at)) err(`${R}: skylight needs at`, 'vocab');
    if (!rf.over || typeof rf.y !== 'number') return;
    const O = rf.over;
    // the storey this roof caps (its top is the eave) and the storeys that rise past the eave
    const cap = levels.find(l => Math.abs(topOf(l) - rf.y) < 0.05) || levels.find(l => (l.footprint || []).some(r => r.h !== undefined && Math.abs((l.y || 0) + r.h - rf.y) < 0.05));
    const pitched = rf.type !== 'flat';
    if (!cap) {
      // what stands under it: a roof over walls whose top is near, but not at, its eave
      const under = levels.filter(l => (l.footprint || []).some(r => r.x < O.x + O.w - 0.3 && r.x + r.w > O.x + 0.3 && r.z < O.z + O.d - 0.3 && r.z + r.d > O.z + 0.3));
      const near = under.map(l => topOf(l)).filter(t => Math.abs(t - rf.y) > 0.05 && Math.abs(t - rf.y) < 0.8);
      if (near.length) warn(`${R}: its eave matches no storey top under it (the walls stop at ${near.map(fmt).join(', ')}; storey tops: ${tops.join(', ')}) — a gap or an overlap at the wall head`, 'roof-y');
    }
    // a taller storey inside the roof's plan (not just against one of its sides): the roof runs through its walls
    for (const l of levels) {
      if (l === cap || !((l.y || 0) < rf.y + 0.05 && topOf(l) > rf.y + 0.3)) continue;
      for (const r of l.footprint || []) {
        const ix = Math.min(O.x + O.w, r.x + r.w) - Math.max(O.x, r.x), iz = Math.min(O.z + O.d, r.z + r.d) - Math.max(O.z, r.z);
        if (ix > 0.6 && iz > 0.6 && pitched && !rf.clip) warn(`${R}: level ${l.id} (rect x ${r.x}, z ${r.z}, ${r.w} × ${r.d}) rises through it (${fmt(ix)} × ${fmt(iz)} m inside the roof's plan) — the roof slices its walls (roofs[].clip: true, or defaults: 2)`, 'roof-storey');
      }
    }
  });

  // ---- chimneys and hearths ---------------------------------------------------------------------------------------------------
  const hearths = [];
  for (const lv of levels) for (const room of lv.rooms || []) for (const it of room.items || []) if (it.type === 'fireplace' && Array.isArray(it.at)) hearths.push({ at: it.at, lv });
  for (const f of spec.features || []) if (f.type === 'fireplace' && Array.isArray(f.at)) hearths.push({ at: f.at, lv: byId[f.level], feature: f });
  (spec.roofs || []).forEach((rf, i) => {
    const c = rf.chimney;
    if (!c || !Array.isArray(c.at)) return;
    const near = hearths.filter(h => Math.hypot(h.at[0] - c.at[0], h.at[1] - c.at[1]) < 1.5);
    if (!near.length) warn(`roof ${i}: the chimney at [${c.at}] stands over no fireplace (nearest ${hearths.length ? fmt(Math.min(...hearths.map(h => Math.hypot(h.at[0] - c.at[0], h.at[1] - c.at[1])))) + ' m off' : 'none in the house'}) — a fireplace feature raises its own stack`, 'chimney-hearth');
  });

  // ---- features ----------------------------------------------------------------------------------------------------------
  const opsOn = (lv, side) => (lv && lv.openings || []).filter(o => o.side === side);
  (spec.features || []).forEach((f, i) => {
    const F = `features[${i}] (${f.type})`;
    if (!FEATURE_TYPES.includes(f.type)) { err(`${F}: type "${f.type}" (${FEATURE_TYPES.join(' | ')})`, 'vocab'); return; }
    const lv = byId[f.level || (f.type === 'porch' ? (spec.entry || {}).level : undefined)] || (f.type === 'porch' ? levels[0] : null);
    if (f.level !== undefined && !byId[f.level]) { err(`${F}: level "${f.level}" is not a level`, 'feature'); return; }
    if (['porch', 'bay'].includes(f.type) || (f.type === 'balcony' && !f.rect)) oneOf(f.side, SIDES, `${F}: side`);
    if (f.type === 'porch') {
      if (!(typeof f.from === 'number' && typeof f.to === 'number' && f.to > f.from && f.depth > 0)) { err(`${F}: needs from < to and depth > 0`, 'feature'); return; }
      const posts = porchPostsAlong(f);
      for (const op of opsOn(lv, f.side)) {
        if (!['door', 'slider', 'garage'].includes(op.type)) continue;
        const hit = posts.find(p => Math.abs(p - op.at) < (op.w || 1) / 2 + 0.15);
        if (hit !== undefined) warn(`${F}: a post at ${fmt(hit)} stands in the ${op.type} at ${op.at} (w ${op.w}) — posts.spacing / n, or move the porch`, 'porch-door');
      }
      // an upper storey's window behind the porch roof
      const up = levels.filter(l => (l.y || 0) > (lv.y || 0) + 0.5);
      const roofTop = (lv.y || 0) + (lv.height || 2.8) + (f.roof && f.roof !== 'flat' && f.roof !== 'none' ? 0.4 : 0.15);
      for (const l of up) for (const op of opsOn(l, f.side)) {
        const sill = (l.y || 0) + (op.type === 'window' ? (op.sill ?? 0.9) : 0);
        if (op.at > f.from && op.at < f.to && sill < roofTop) warn(`${F}: its roof rises to ~${fmt(roofTop)} m, across ${l.id}'s ${op.type} at ${op.at} (sill ${fmt(sill)} m)`, 'feature-opening');
      }
    }
    if (f.type === 'bay') {
      if (!(f.w > 0 && f.depth > 0 && typeof f.at === 'number')) { err(`${F}: needs at, w > 0 and depth > 0`, 'feature'); return; }
      oneOf(f.form, ['box', 'canted'], `${F}: form`); oneOf(f.roof, ['hip', 'shed', 'flat', 'gable'], `${F}: roof`);
      for (const op of opsOn(lv, f.side)) if (op.type !== 'window' && Math.abs(op.at - f.at) < (op.w + f.w) / 2) warn(`${F}: the bay's span covers the ${op.type} at ${op.at} — a bay opens off a room, not over a door`, 'feature-opening');
    }
    if (f.type === 'balcony' || f.type === 'terrace' || f.type === 'loggia') {
      oneOf(f.rail, ['glass', 'metal', 'timber', 'parapet', 'none'], `${F}: rail`);
      if (f.type !== 'balcony' && !f.rect) err(`${F}: a ${f.type} needs its plan rect`, 'feature');
      if (f.type === 'balcony' && !f.rect && !(f.depth > 0)) err(`${F}: a balcony needs depth > 0 (or a rect)`, 'feature');
      if (f.type === 'balcony' && !f.rect) {
        const below = levels.filter(l => (l.y || 0) < (lv.y || 0) - 0.5);
        for (const l of below) for (const op of opsOn(l, f.side)) {
          const head = (l.y || 0) + (op.type === 'window' ? (op.sill ?? 0.9) + (op.h || 1.2) : (op.h || 2.1));
          if ((f.from === undefined || op.at > f.from) && (f.to === undefined || op.at < f.to) && head > (lv.y || 0) - 0.25) warn(`${F}: its deck at ${lv.y} m runs across ${l.id}'s ${op.type} at ${op.at} (head ${fmt(head)} m)`, 'feature-opening');
        }
      }
    }
    if (f.type === 'fireplace') {
      if (!Array.isArray(f.at)) err(`${F}: needs at`, 'feature');
      oneOf(f.style, ['modern', 'mantel', 'stone', 'painted-brick', 'tv-breast'], `${F}: style`);
      oneOf(f.stack, ['outside', 'inside'], `${F}: stack`);
      if (f.chimney && typeof f.chimney === 'object') { oneOf(f.chimney.material, ['brick', 'stone', 'stucco', 'metal'], `${F}: chimney.material`); oneOf(f.chimney.cap, ['stone', 'pots', 'metal'], `${F}: chimney.cap`); }
    }
    if (f.type === 'builtin') {
      oneOf(f.kind, ['bookcase-wall', 'niche', 'wine-wall', 'window-seat', 'media-wall'], `${F}: kind`);
      if (!Array.isArray(f.from) || !Array.isArray(f.to)) err(`${F}: needs from and to`, 'feature');
    }
  });

  // ---- storeys, openings, partitions, rooms, facade --------------------------------------------------------------------------
  for (const lv of levels) {
    const L = `level ${lv.id}`;
    if (lv.plinth) { oneOf(lv.plinth.material, CLAD, `${L}: plinth.material`); colour(lv.plinth.color, `${L}: plinth.color`); }
    if (lv.knee !== undefined && !(lv.knee > 0.4 && lv.knee < (lv.height || 2.8))) err(`${L}: knee ${lv.knee} (metres, 0.4 – the storey's height)`, 'vocab');
    for (const r of lv.footprint || []) {
      oneOf(r.material, CLAD, `${L}: footprint material`); colour(r.color, `${L}: footprint color`);
      if (r.h !== undefined && !(r.h > 1.5 && r.h < 12)) err(`${L}: footprint rect h ${r.h} (metres, 1.5–12)`, 'vocab');
    }
    const edges = ctx.perimeterEdges(lv.footprint || []);
    for (const op of lv.openings || []) {
      const O = `${L} opening ${op.type}@${op.side}:${op.at}`;
      oneOf(op.head, HEADS, `${O}: head`);
      if (op.surround) oneOf(op.surround.kind, SURROUNDS, `${O}: surround.kind`);
      if (op.canopy) oneOf(op.canopy.kind, CANOPIES, `${O}: canopy.kind`);
      if (op.shutters && typeof op.shutters === 'object') { oneOf(op.shutters.style, ['panel', 'louvre', 'board'], `${O}: shutters.style`); colour(op.shutters.color, `${O}: shutters.color`); }
      if (op.edgeZ !== undefined) {
        // the core skips its overlap test for these; do it here, against openings on the same edge only
        const horiz = op.side === 'S' || op.side === 'N';
        const hit = edges.find(e => e.side === op.side && Math.abs((horiz ? e.a[1] : e.a[0]) - op.edgeZ) < 0.02 && (horiz ? op.at >= e.a[0] && op.at <= e.b[0] : op.at >= e.a[1] && op.at <= e.b[1]));
        if (!hit) err(`${O}: edgeZ ${op.edgeZ} names no ${op.side} edge containing at=${op.at}`, 'opening-edge');
        else {
          const lo = horiz ? hit.a[0] : hit.a[1], hi = horiz ? hit.b[0] : hit.b[1];
          if (op.at - op.w / 2 < lo + 0.15 || op.at + op.w / 2 > hi - 0.15) err(`${O}: opening (w=${op.w}) runs past its edge [${lo}, ${hi}]`, 'opening-edge');
          for (const o2 of lv.openings || []) {
            if (o2 === op || o2.side !== op.side) continue;
            const e2 = o2.edgeZ !== undefined ? edges.find(e => e.side === o2.side && Math.abs((horiz ? e.a[1] : e.a[0]) - o2.edgeZ) < 0.02) : ctx.perimeterEdges(lv.footprint).find(e => e.side === o2.side && (horiz ? o2.at >= e.a[0] - 1e-6 && o2.at <= e.b[0] + 1e-6 : o2.at >= e.a[1] - 1e-6 && o2.at <= e.b[1] + 1e-6));
            if (e2 && Math.abs((horiz ? e2.a[1] : e2.a[0]) - op.edgeZ) < 0.02 && Math.abs(o2.at - op.at) < (o2.w + op.w) / 2 + 0.1 && lv.openings.indexOf(o2) > lv.openings.indexOf(op)) err(`${O}: overlaps ${o2.type}@${o2.at} on its edge`, 'opening-edge');
          }
        }
      }
    }
    (lv.partitions || []).forEach((p, i) => {
      oneOf(p.style, PART_STYLES, `${L}: partition ${i} style`);
      const len = Array.isArray(p.from) && Array.isArray(p.to) ? Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]) : 0;
      const ds = [...(p.door != null ? [{ at: p.door, w: p.doorW || 0.9 }] : []), ...(p.doors || []).map(d => ({ at: d.at, w: d.w || 0.9 }))].sort((a, b) => a.at - b.at);
      for (const d of ds) if (d.at - d.w / 2 < -0.01 || d.at + d.w / 2 > len + 0.01) err(`${L}: partition ${i}: doorway at ${d.at} (w ${d.w}) runs past its ${fmt(len)} m`, 'partition-door');
      for (let k = 1; k < ds.length; k++) if (ds[k].at - ds[k].w / 2 < ds[k - 1].at + ds[k - 1].w / 2 + 0.1) err(`${L}: partition ${i}: doorways at ${ds[k - 1].at} and ${ds[k].at} overlap`, 'partition-door');
    });
    for (const room of lv.rooms || []) {
      const R = `${L}: room "${room.name}"`;
      const fl = typeof room.floor === 'string' ? { kind: room.floor } : room.floor;
      if (fl) { oneOf(fl.kind, FLOOR_KINDS, `${R}: floor.kind`); colour(fl.color, `${R}: floor.color`); }
      if (room.walls) {
        oneOf(room.walls.kind, WALL_KINDS, `${R}: walls.kind`); colour(room.walls.color, `${R}: walls.color`);
        const ft = room.walls.feature;
        if (ft) { oneOf(ft.kind, WALL_KINDS, `${R}: walls.feature.kind`); colour(ft.color, `${R}: walls.feature.color`); if (ft.side === undefined && ft.partition === undefined) err(`${R}: walls.feature needs a side or a partition`, 'vocab'); if (ft.side !== undefined) oneOf(ft.side, SIDES, `${R}: walls.feature.side`); }
      }
      if (room.ceiling) {
        oneOf(room.ceiling.kind, CEILING_KINDS, `${R}: ceiling.kind`);
        const above = levels.filter(l => (l.y || 0) > (lv.y || 0) + 0.5 && (l.footprint || []).some(r => r.x < room.bounds.x + room.bounds.w - 0.2 && r.x + r.w > room.bounds.x + 0.2 && r.z < room.bounds.z + room.bounds.d - 0.2 && r.z + r.d > room.bounds.z + 0.2));
        if ((room.ceiling.kind === 'vault' || room.ceiling.kind === 'tray') && above.length) warn(`${R}: a ${room.ceiling.kind} ceiling needs nothing above it, and ${above.map(l => l.id).join(', ')} stands over it — built flat`, 'ceiling');
        if (room.ceiling.kind === 'double' && !above.length) warn(`${R}: a double-height ceiling opens the storey above, and there is none over it`, 'ceiling');
      }
      if (room.floorOffset !== undefined && !(Math.abs(room.floorOffset) <= 1.2)) err(`${R}: floorOffset ${room.floorOffset} (metres, −1.2 … 1.2)`, 'vocab');
    }
  }
  const fac = Array.isArray(spec.facade) ? { zones: spec.facade } : spec.facade || {};
  for (const [i, z] of (fac.zones || []).entries()) { oneOf(z.material, CLAD, `facade[${i}].material`); colour(z.color, `facade[${i}].color`); if (z.side !== undefined) oneOf(z.side, SIDES, `facade[${i}].side`); if (z.level !== undefined && !byId[z.level]) err(`facade[${i}].level "${z.level}" is not a level`, 'vocab'); }
  for (const [i, b] of (fac.bands || []).entries()) { if (typeof b.y !== 'number') err(`facade.bands[${i}]: y required`, 'vocab'); oneOf(b.material, CLAD, `facade.bands[${i}].material`); colour(b.color, `facade.bands[${i}].color`); }
  if (spec.entry && spec.entry.stoop) oneOf(spec.entry.stoop.material, ['stone', 'concrete', 'brick', 'timber'], 'entry.stoop.material');
  return out;
};
export default check;
