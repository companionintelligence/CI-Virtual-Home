// The dress recipes (plan 5.6 D2/D3): what each room program is dressed with. A RECIPE is a program's list of SLOTS; a slot is one idea (the coffee table's
// tray, the bedside lamp, the laid dining table, the counter clusters) as a small function over a `Dresser` (assets/room-dress.ts): ask for the hosts of a kind,
// pick a kit by the house's taste, `put` it on the free area of the host. Data plus tiny functions, THREE-free.
//
// Tiers. Tier 1 is the never-bare floor and the lamp: placed at any level (up to 1.5 x the room's budget). Tier 2 runs from level 0.3, tier 3 from 0.6, and both stop
// when the budget is spent. A slot's `min` raises its threshold. A room's `dress.off` skips slots by id.
//
// What a recipe may ask for is what exists: the 30 small goods of assets/props/dress-*.ts, SOFT's towels, the registry's lamps, plants and the floor/wall pieces
// the composer can place. The composer's hosts that carry a body of their own on a seeded spot (a console's bowl, a sideboard's vases) are not hosts
// (assets/room-dress-hosts.ts DROPPED), so a hall's console and a dining room's sideboard are not dressed; a garage has nothing to dress with until BAKE's types land.
//
// Lamps. LIGHT lights a room from every free-standing lamp in it (one pool per lamp room), and a room with none is flat at night: the lamp slot of each recipe puts a
// fitting lamp on a host where the layout placed none (a table lamp on a bedside, a side table, a counter end; a desk lamp on a desk; a floor lamp in a corner where
// no host will do). It is a tier-1 slot of every living, sleeping, eating, working and passing room.
//
// Owner: DRESS.
import type { Dresser } from './room-dress.js';
import { INWARD, ROT_OF_WALL } from './room-geo.js';
import { toLocal, rectArea, standingOn, hostOf, type Host } from './room-dress-hosts.js';
import { CAFE, cafeFit, cafeDrop } from './dress-curtains.js';
import { PLACEMENT } from './props/placement.js';

export interface Slot { id: string; tier: 1 | 2 | 3; min?: number; what: string; run: (d: Dresser) => void }
export interface Recipe { program: string; /** the program's reference area, m2 (its fleet median) */ ref: number; slots: Slot[] }

/** placements at the reference area, density 0.5 (the design's table: surface + wall + floor) */
export const BASE_COUNT: Record<string, number> = {
  living: 10, den: 8, media: 8, library: 9, study: 7, studio: 7, dining: 6, kitchen: 9.5, 'kitchen-dining': 9.5, 'bed-primary': 9, 'bed-guest': 7, 'bed-kid': 7, nursery: 7, playroom: 6,
  bath: 6, ensuite: 8, powder: 4, foyer: 6, hall: 5, laundry: 5, sunroom: 6, bar: 6,
};

export const TABLE_LAMPS = ['table-lamp', 'ginger-lamp', 'column-lamp', 'globe-lamp', 'mushroom-lamp', 'tripod-table-lamp'];
// (no 'halo-lamp': the page's legacy ambient halo, a 3.0-emissive cyan ring on a rod with a blue PointLight. fixtures.ts re-dresses it as a drum lamp only in a room with no `program`; in a
// programmed room, which is where 23 of the 27 first-bake halos stood, it stays a glowing ring and costs a dynamic light of its own, outside the 16-light cap)
export const FLOOR_LAMPS = ['floor-lamp', 'tripod-floor-lamp'];
/** the small ones, for a counter or a bar (0.34-0.52 m high) */
export const SMALL_LAMPS = ['mushroom-lamp', 'globe-lamp', 'tripod-table-lamp'];
/** every type a recipe stands as a lamp that glows */
export const LAMP_TYPES: ReadonlySet<string> = new Set([...TABLE_LAMPS, ...FLOOR_LAMPS, ...SMALL_LAMPS, 'desk-lamp']);
/** a room under this area (m2) gets no light from the light rig (assets/fixtures.ts ROOM_MIN_AREA: test-dress-phase K3 reads that source and fails if the two differ), so a lamp stood in it would glow and light nothing */
export const LAMP_MIN_AREA = 2.5;
/** the lamps whose lit head is bare (a mushroom, a globe, a tripod's bulb: no shade), the ones a recipe stands on a counter: they keep LAMP_EYE from the rig's corner eyes (room-dress.ts) */
export const BARE_LAMPS: ReadonlySet<string> = new Set(SMALL_LAMPS);
const COUNTER_KITS = ['cutting-board-set', 'canister-trio', 'bread-bin', 'utensil-crock', 'tea-towel', 'oil-pair', 'plate-stack', 'kettle-and-mug'];

// ---- shared moves --------------------------------------------------------------------------------------------------------------------
/** the lamp the room lacks: on the first host of the first kind that takes one, else (when the room allows it) a floor lamp in a corner */
/** a lamp on a host: the pick, and where its bare head would stand within LAMP_EYE of a corner eye (room-dress.ts refuses it there) the shaded table lamp, which has no hot bulb to put in the lens */
function putLamp(d: Dresser, h: Host, type: string, o: Parameters<Dresser['put']>[3]): any | null {
  return d.put('lamp', h, type, o) || (BARE_LAMPS.has(type) ? d.put('lamp', h, 'table-lamp', o) : null);
}
function lampIfNone(d: Dresser, kinds: Array<Parameters<Dresser['hostsOf']>>, o: { floor?: boolean; pair?: boolean; desk?: boolean; anchor?: 'back' | 'back-left' | 'back-right' } = {}) {
  if (d.hasLamp()) return;
  let n = 0;
  for (const ks of kinds) for (const h of d.hostsOf(...ks)) {
    const t = o.desk ? 'desk-lamp' : d.pick('lamp', TABLE_LAMPS);
    if (putLamp(d, h, t, { anchor: o.anchor || 'back', cost: 0.5 })) { n++; if (!o.pair || n >= 2) return; }
  }
  // no host will take one: a floor lamp in a corner, else against a wall (a narrow hall has the wall and no corner)
  // (the keep-out round the rig's corner cameras leaves a crowded foyer little floor: the type picked first, then each of the others, the slimmest last chance)
  if (n === 0 && o.floor !== false) {
    const first = d.pick('lamp', FLOOR_LAMPS);
    for (const t of [first, ...FLOOR_LAMPS.filter(x => x !== first)]) if (d.corner('lamp', t, {}, undefined, 0.5) || d.against('lamp', t, {}, null, undefined, 0.5)) return;
    // no floor of the room takes a floor lamp outside the cameras' way: a small lamp on a side table in the corner (0.55 + at most 0.52 m, under the eye line)
    const tbl = d.corner('lamp', 'side-table', {}, undefined, 0.5);
    const h = tbl && hostOf(tbl);
    if (h && !putLamp(d, h, d.pick('lamp', SMALL_LAMPS), { anchor: 'back', cost: 0.5 })) d.retract(tbl!, 0.5);
  }
}

/** the dining table of the room laid: a centrepiece first (it is the table's middle), then a place per chair, as many as keep 40 % of the top free */
function setTable(d: Dresser) {
  const h = d.hostsOf('dining-table')[0]; if (!h) return;
  const r = h.rects[0], long = r[2] - r[0], deep = r[3] - r[1];
  const mid = d.put('table', h, d.pick('table', ['centerpiece', 'centerpiece', 'candle-trio']), { anchor: 'centre', margin: 0.01 });
  if (mid && long >= 1.5 && deep >= 0.8) d.put('table', h, 'candle-trio', { at: [(r[0] + r[2]) / 2 + Math.min(0.5, long * 0.28), (r[1] + r[3]) / 2], margin: 0.01 });
  // the seats: the dining chairs within reach of the table, each by the edge it is nearest, turned to face its diner
  const chairs = d.base.filter(it => ((PLACEMENT[it.type] && PLACEMENT[it.type].roles) || []).includes('dining-chair') && Array.isArray(it.at));
  const seats: Array<{ side: 'front' | 'back' | 'left' | 'right'; t: number }> = [];
  for (const c of chairs) {
    const [lx, lz] = toLocal(h, c.at[0], c.at[1]);
    const dx = Math.max(r[0] - lx, 0, lx - r[2]), dz = Math.max(r[1] - lz, 0, lz - r[3]);
    if (Math.hypot(dx, dz) > 0.95) continue;
    const side = Math.abs(dz) >= Math.abs(dx) ? (lz < r[1] ? 'back' : 'front') : (lx < r[0] ? 'left' : 'right');
    seats.push({ side, t: side === 'front' || side === 'back' ? lx : lz });
  }
  if (!seats.length) { seats.push({ side: 'front', t: (r[0] + r[2]) / 2 - 0.3 }, { side: 'back', t: (r[0] + r[2]) / 2 + 0.3 }); }
  seats.sort((a, b) => (a.side < b.side ? -1 : a.side > b.side ? 1 : a.t - b.t));
  for (const s of seats.slice(0, 8)) {
    const sw = 0.41, sd = 0.33, m = 0.02;
    let at: [number, number], rotExtra: number;
    if (s.side === 'front') { at = [Math.max(r[0] + sw / 2 + m, Math.min(r[2] - sw / 2 - m, s.t)), r[3] - m - sd / 2]; rotExtra = 0; }
    else if (s.side === 'back') { at = [Math.max(r[0] + sw / 2 + m, Math.min(r[2] - sw / 2 - m, s.t)), r[1] + m + sd / 2]; rotExtra = 180; }
    else if (s.side === 'right') { at = [r[2] - m - sd / 2, Math.max(r[1] + sw / 2 + m, Math.min(r[3] - sw / 2 - m, s.t))]; rotExtra = 90; }
    else { at = [r[0] + m + sd / 2, Math.max(r[1] + sw / 2 + m, Math.min(r[3] - sw / 2 - m, s.t))]; rotExtra = 270; }
    d.put('table', h, 'place-setting', { at, rotExtra, margin: 0.0, cost: 0.25 });
  }
  // a laid table is never without a setting, a centrepiece or a runner (the never-bare rule): a table whose middle holds an authored jug and a candle trio, or a round one too small for the
  // chairs' places once every neighbour has its 2 cm and its reach, takes one setting wherever the free top has room, else the candles make way for a centrepiece
  const laid = () => d.all().some(it => it.type === 'place-setting' || it.type === 'table-runner' || it.type === 'centerpiece');
  if (!laid()) for (const a of ['front', 'back', 'left', 'right'] as const) if (d.put('table', h, 'place-setting', { anchor: a, margin: 0.0, cost: 0.25 })) break;
  if (!laid() && mid && mid.type === 'candle-trio') { d.retract(mid); if (!d.put('table', h, 'centerpiece', { anchor: 'centre', margin: 0.01 })) d.put('table', h, 'place-setting', { anchor: 'centre', margin: 0.0, cost: 0.25 }); }
}

/** a run of counter clusters along a host's free top: one to three of the kitchen's small goods, left to right */
function counterClusters(d: Dresser, h: Host, queue: string[], max = 3): number {
  let placed = 0;
  const free = d.free(h), widest = Math.max(0, ...free.map(f => f[2] - f[0]));
  const spots = (widest >= 1.55 ? ['left', 'right', 'centre'] : widest >= 0.7 ? ['left', 'right'] : ['centre']).slice(0, max) as Array<'left' | 'right' | 'centre'>;
  for (const a of spots) {
    // (a kitchen has one bread bin, one kettle, one of each kit: a kit the room already holds is left to the next)
    for (let k = 0; k < queue.length; k++) {
      const t = queue.shift()!; queue.push(t);
      if (d.has(t)) continue;
      if (d.put('counters', h, t, { anchor: a === 'centre' ? 'back' : (`back-${a}` as any) })) { placed++; break; }
    }
  }
  return placed;
}

/**
 * A window with nothing on it wears a café curtain where one belongs: a kitchen's, the LOWER part of the window, its hem at the sill and its rod at about half the
 * window's height (never above sill + 0.55 x the window's height, and clear of the 1.45-1.55 m eye line wherever the window leaves room to be). The upper window and the
 * view stay. Nowhere else: SOFT's blinds hang fully drawn (their drop is a function of the head height alone), and drawn they are a flat white sheet that shuts the view
 * and the sun out of the room (seen on the pilot bath: a roller shade over a 1.4 m window, the lawn gone), so a bath keeps its window bare, and the lived-in rooms keep
 * the curtains their authors hung.
 *
 * Why the first cut was a slab across the eye line: SOFT's `cafe-curtain` takes `h` as the height of its ROD and hangs the cloth a fixed drop below it, `clamp(h - 0.5,
 * 0.3, 0.75)`; the slot passed `min(head, sill + 0.95)` as if `h` were the top of the part to cover, so the rod stood at sill + 0.95 (1.95-2.1 m in the fleet's kitchens) and the
 * cloth hung 0.75 below it, y 1.19-1.97. The type has no other size, so the slot sizes it with what the item does have: `h` for the drop (h = drop + 0.5) and `y`, the
 * item's own lift, for where the rod stands. `cafeFit` is that arithmetic; the test measures the BUILT geometry against it.
 *
 * Where it hangs, how wide and what it keeps clear of is assets/dress-curtains.ts's plan, made before the first slot runs (the second skeptic measured the first cut's cloth, 0.094 m
 * deep and 3 cm over the sill, passing 2-4 cm through whatever stood against the wall under the window, and two neighbours' boxes overlapping): a curtain is lifted over a low
 * obstacle, parted round a narrow one (a tap, a lamp), skipped where nothing is left, and never within 2.5 cm of the next curtain; every dress item keeps out of its volume.
 */
const WINDOW_TYPE: Record<string, string[]> = { kitchen: ['cafe-curtain'], 'kitchen-dining': ['cafe-curtain'] };
/** the types the `windows` slot hangs in a program's windows, or undefined when the program hangs none (the planner needs to know before the slots run: it keeps their volume clear) */
export const windowTypes = (program: string): string[] | undefined => WINDOW_TYPE[program];
export { CAFE, cafeFit, cafeDrop };
const windowSlot: Slot = { id: 'windows', tier: 2, what: 'a café curtain (a parted pair where a tap or a lamp stands) on the lower half of a kitchen window that wears nothing', run(d) {
  const types = WINDOW_TYPE[d.program]; if (!types) return;
  // (the plan was made before the first slot ran, against the layout, and every dress item since has kept out of its volume: assets/dress-curtains.ts)
  for (const p of d.curtainPanels()) d.raw('windows', d.pick('windows', types), p.at, p.rot, { w: p.w, h: p.h, y: p.y, color: d.scheme.curtain });
} };

// ---- the recipes ---------------------------------------------------------------------------------------------------------------------
const living: Slot[] = [
  { id: 'coffee', tier: 1, what: 'a tray vignette (tray, books, a candle or a bowl) on the coffee table, a centrepiece on a second', run(d) {
    d.hostsOf('coffee-table').slice(0, 2).forEach((h, i) => d.put('coffee', h, i === 0 ? 'tray-vignette' : d.pick('coffee', ['centerpiece', 'tray-vignette']), { anchor: 'centre' }));
  } },
  { id: 'lamp', tier: 1, what: 'a table lamp on a side table or a console where the room has no lamp, else a floor lamp in a corner', run(d) { lampIfNone(d, [['side-table'], ['console']]); } },
  { id: 'side', tier: 1, what: 'a book, a coaster and a glass on a side table', run(d) {
    d.hostsOf('side-table').slice(0, 2).forEach(h => d.put('side', h, 'side-set', { anchor: 'centre' }));
  } },
  { id: 'console', tier: 2, what: 'a console arrangement on a console', run(d) { d.hostsOf('console').slice(0, 1).forEach(h => d.put('console', h, 'console-set', { anchor: 'centre' })); } },
];

const bedroom: Slot[] = [
  { id: 'lamp', tier: 1, what: 'a lamp on each bedside (a pair in the primary), on the dresser, else a floor lamp, where the room has none', run(d) {
    lampIfNone(d, [['nightstand'], ['dresser']], { pair: d.program === 'bed-primary' });
  } },
  { id: 'bedside', tier: 1, what: 'a book, a glass and a candle on a bedside', run(d) {
    d.hostsOf('nightstand').slice(0, 2).forEach(h => d.put('bedside', h, 'nightstand-set', { anchor: 'centre' }));
  } },
  { id: 'dresser', tier: 1, what: 'a tray with scent bottles, a box and a frame on a dresser; a tray vignette on a long one', run(d) {
    d.hostsOf('dresser').slice(0, 2).forEach(h => {
      d.put('dresser', h, 'dresser-set', { anchor: 'back-left' });
      if (h.rects[0][2] - h.rects[0][0] >= 1.3) d.put('dresser', h, 'tray-vignette', { anchor: 'right' });
    });
  } },
];

const kitchen: Slot[] = [
  { id: 'hob', tier: 1, what: 'a lidded pot on the range', run(d) { d.hostsOf('hob').slice(0, 1).forEach(h => d.put('hob', h, 'pot-on-hob', { anchor: 'centre' })); } },
  { id: 'lamp', tier: 1, what: 'a small lamp at the end of a counter run where the room has none', run(d) {
    if (d.hasLamp()) return;
    const range = d.hostsOf('hob')[0], dist = (h: Host) => (range ? Math.hypot(h.at[0] - range.at[0], h.at[1] - range.at[1]) : 0);
    // the island, the cart and the bar first (a lamp has nothing over its head there: on a counter run a mushroom lamp's pool is a hot spot on the underside of the upper cabinets 0.2 m above it,
    // aurora Kitchen NW night clipped 6 % of the frame), then the run farthest from the range: the first with room for it
    for (const h of [...d.hostsOf('island'), ...d.hostsOfType('kitchen-cart', 'breakfast-bar'), ...d.hostsOfType('counter-run').sort((a, b) => dist(b) - dist(a))]) {
      if (putLamp(d, h, d.pick('lamp', SMALL_LAMPS), { anchor: 'back-right', cost: 0.5 })) return;
    }
  } },
  { id: 'counters', tier: 1, what: 'clusters along the counters, those by the range first: boards, canisters, a bread bin, a crock, a tea towel, oils, a kettle', run(d) {
    const queue = COUNTER_KITS.filter(t => t !== 'kettle-and-mug' || !d.has('kettle')).slice();
    const r = d.pick('counters', queue, false); while (queue[0] !== r) queue.push(queue.shift()!);
    const range = d.hostsOf('hob')[0], dist = (h: Host) => (range ? Math.hypot(h.at[0] - range.at[0], h.at[1] - range.at[1]) : 0);
    const sinks = d.hostsOfType('sink-run'), runs = d.hostsOfType('counter-run', 'dishwasher').filter(h => h.rects.some(q => q[2] - q[0] >= 0.5)).sort((a, b) => dist(a) - dist(b));
    // beside the basin: the dish rack on the wider side, a tea towel on the other
    for (const h of sinks.slice(0, 1)) {
      const sides = d.free(h).slice().sort((a, b) => rectArea(b) - rectArea(a));
      sides.slice(0, 2).forEach((s, i) => { const t = i === 0 ? 'dish-rack' : 'tea-towel', onRight = s[0] > 0, fw = t === 'dish-rack' ? 0.5 : 0.31; d.put('counters', h, t, { at: [onRight ? s[0] + fw / 2 : s[2] - fw / 2, s[1] + (t === 'dish-rack' ? 0.16 : 0.12)] }); });
    }
    // (a run that already carries things gets one cluster, not three)
    for (const h of runs.slice(0, 4)) counterClusters(d, h, queue, standingOn(h, d.all()).length >= 2 ? 1 : 3);
    // a bar or a cart: one cluster, and only where nothing stands yet
    for (const h of d.hostsOfType('breakfast-bar', 'kitchen-cart')) if (!standingOn(h, d.all()).length) counterClusters(d, h, queue, 1);
  } },
  { id: 'island', tier: 1, what: 'a bowl, a carafe and a stack of plates on the island', run(d) {
    for (const h of d.hostsOf('island').slice(0, 1)) {
      const wide = h.rects.reduce((m, q) => Math.max(m, q[2] - q[0]), 0), busy = standingOn(h, d.all()).length;
      d.put('island', h, d.pick('island', ['centerpiece', 'centerpiece', 'tray-vignette']), { anchor: 'centre' });
      if (wide >= 1.8 && !busy) { d.put('island', h, 'carafe', { anchor: 'left' }); d.put('island', h, 'plate-stack', { anchor: 'right' }); }
    }
  } },
  { id: 'table', tier: 2, what: 'an eat-in table laid: a centrepiece and a place for each chair', run(d) { setTable(d); } },
];

const dining: Slot[] = [
  { id: 'table', tier: 1, what: 'the table laid: a centrepiece, candles, and a place for each chair', run(d) { setTable(d); } },
  { id: 'lamp', tier: 1, what: 'a floor lamp in a corner where the room has no lamp (the sideboard is not a host)', run(d) { lampIfNone(d, [], { floor: true }); } },
];

const bath: Slot[] = [
  { id: 'vanity', tier: 1, what: 'a soap dispenser, a cup and a soap dish on the strip between a double vanity\'s basins', run(d) { d.hostsOf('vanity').slice(0, 1).forEach(h => d.put('vanity', h, 'vanity-set', { anchor: 'centre' })); } },
  { id: 'tank', tier: 1, what: 'a tissue box and a candle on the toilet tank', run(d) { d.hostsOf('tank').slice(0, 1).forEach(h => d.put('tank', h, 'tissue-candle', { anchor: 'centre' })); } },
  { id: 'towels', tier: 1, what: 'a towel ring by the vanity or the toilet and a robe hook by the bathing', run(d) {
    const near = (re: RegExp): [number, number] | null => { const it = d.base.find(i => re.test(i.type) && Array.isArray(i.at)); return it ? [it.at[0], it.at[1]] : null; };
    if (!d.has('towel-ladder') && !d.has('towel-rail') && !d.has('heated-towel-rail')) d.against('towels', 'towel-ring-set', {}, near(/vanity|sink/));
    // (a bath so small that every wall within reach of the bathing is also within 0.3 m of a corner camera keeps its third piece low and on the floor: a hamper in the corner, 0.6 m, under the eye line)
    if (!d.against('hook', 'robe-hook', {}, near(/shower|tub/))) d.corner('hook', 'laundry-hamper', {}, undefined, 0.5);
  } },
  { id: 'roll', tier: 1, what: 'a toilet roll holder beside the toilet', run(d) { d.against('roll', 'roll-holder', {}, (() => { const t = d.base.find(i => i.type === 'toilet' && Array.isArray(i.at)); return t ? [t.at[0], t.at[1]] as [number, number] : null; })()); } },
];

const hall: Slot[] = [
  { id: 'entry', tier: 1, what: 'a door mat in front of the entry, an umbrella stand and a shoe row beside it', run(d) {
    const c = d.geoC(), p = c.geo.portals.find(q => q.entry); if (!p) return;
    const [nx, nz] = INWARD[p.side];
    d.atPose('entry', 'door-mat', p.x + nx * 0.36, p.z + nz * 0.36, ROT_OF_WALL[p.side], { w: Math.max(0.6, Math.min(0.9, p.w - 0.12)), d: 0.45 });
    d.against('entry', 'umbrella-stand', {}, [p.x, p.z]);
    d.against('entry', 'shoe-row', {}, [p.x, p.z]);
  } },
  { id: 'console', tier: 1, what: 'a console arrangement on a console (demilune)', run(d) { d.hostsOf('console').slice(0, 1).forEach(h => d.put('console', h, 'console-set', { anchor: 'centre' })); } },
  { id: 'lamp', tier: 1, what: 'a table lamp on a console, else a floor lamp in a corner, where the hall has no lamp', run(d) { lampIfNone(d, [['console']]); } },
  { id: 'mirror', tier: 1, what: 'a leaning mirror against a wall', run(d) { d.against('mirror', 'leaner-mirror', {}, null); } },
  { id: 'plant', tier: 1, what: 'a floor plant in a corner, while a hall of 8 m2 or more has fewer than the 3 dress items it is never without', run(d) { for (let k = 0; k < 2 && d.area >= 8 && d.placed.length < 3; k++) {
      // (the type the house favours first, then each of the others: the keep-out round the corner cameras leaves a narrow hall room for the slim ones only)
      const all = d.roleTypes('plant-floor').filter(t => !/palm|tree|tall/.test(t)), first = d.pick('plant', all);
      // (not the plant stand: 18 meshes, the heaviest plant, and a hall of the fleet is not worth the triangle share it would take past the plan's 3 %)
      if (![first, ...all.filter(t => t !== first && t !== 'plant-stand')].some(t => d.corner('plant', t, {}))) break;
    }
  } },
];

const study: Slot[] = [
  { id: 'lamp', tier: 1, what: 'a desk lamp on the desk (a floor lamp in a corner when there is no desk) where the room has no lamp', run(d) { lampIfNone(d, [['desk']], { desk: true, anchor: 'back-right' }); } },
  { id: 'desk', tier: 2, what: 'a book, a coaster and a glass on the desk', run(d) { d.hostsOf('desk').slice(0, 1).forEach(h => d.put('desk', h, 'side-set', { anchor: 'left' })); } },
  { id: 'console', tier: 2, what: 'a console arrangement on a console', run(d) { d.hostsOf('console').slice(0, 1).forEach(h => d.put('console', h, 'console-set', { anchor: 'centre' })); } },
];

const laundry: Slot[] = [
  { id: 'tops', tier: 1, what: 'folded towels on the dryer, a tea towel on the washer', run(d) {
    d.hostsOfType('dryer').slice(0, 1).forEach(h => d.put('tops', h, 'towel-stack', { anchor: 'centre' }));
    d.hostsOfType('washing-machine').slice(0, 1).forEach(h => d.put('tops', h, 'tea-towel', { anchor: 'centre' }));
  } },
  { id: 'counters', tier: 2, what: 'a cluster on the counter', run(d) { const q = ['canister-trio', 'tea-towel', 'utensil-crock']; d.hostsOf('counter').slice(0, 1).forEach(h => counterClusters(d, h, q, 1)); } },
];

const withWindows = (slots: Slot[]): Slot[] => [...slots, windowSlot];
export const RECIPES: Record<string, Recipe> = {
  living: { program: 'living', ref: 27, slots: withWindows(living) }, den: { program: 'den', ref: 25, slots: withWindows(living) }, media: { program: 'media', ref: 25, slots: withWindows(living) },
  sunroom: { program: 'sunroom', ref: 9, slots: withWindows(living.filter(s => s.id !== 'console')) }, bar: { program: 'bar', ref: 27, slots: living.filter(s => s.id === 'lamp' || s.id === 'side') },
  playroom: { program: 'playroom', ref: 20, slots: living.filter(s => s.id === 'lamp' || s.id === 'side') },
  'bed-primary': { program: 'bed-primary', ref: 24, slots: withWindows(bedroom) }, 'bed-guest': { program: 'bed-guest', ref: 22, slots: withWindows(bedroom) }, 'bed-kid': { program: 'bed-kid', ref: 14, slots: withWindows(bedroom) }, nursery: { program: 'nursery', ref: 15, slots: withWindows(bedroom) },
  kitchen: { program: 'kitchen', ref: 18, slots: withWindows(kitchen) },
  'kitchen-dining': { program: 'kitchen-dining', ref: 24, slots: withWindows([...kitchen.filter(s => s.id !== 'table'), { ...dining[0], tier: 1 }]) },
  dining: { program: 'dining', ref: 20, slots: withWindows(dining) },
  bath: { program: 'bath', ref: 8, slots: withWindows(bath) }, ensuite: { program: 'ensuite', ref: 14, slots: withWindows(bath) }, powder: { program: 'powder', ref: 4, slots: withWindows(bath) },
  hall: { program: 'hall', ref: 12, slots: hall }, foyer: { program: 'foyer', ref: 11, slots: hall },
  study: { program: 'study', ref: 19, slots: withWindows(study) }, library: { program: 'library', ref: 18, slots: withWindows(study) }, studio: { program: 'studio', ref: 16, slots: withWindows(study) },
  laundry: { program: 'laundry', ref: 12, slots: withWindows(laundry) },
  garage: { program: 'garage', ref: 34, slots: [] },   // nothing exists to dress a garage with until BAKE's bk-* types (a car, shelving, bins, a vise) are merged
  gym: { program: 'gym', ref: 37, slots: [] }, greenhouse: { program: 'greenhouse', ref: 24, slots: [] }, outdoor: { program: 'outdoor', ref: 0, slots: [] },
};
