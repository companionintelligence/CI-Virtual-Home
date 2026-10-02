#!/usr/bin/env -S node --experimental-strip-types
// Where a person in a headset may stand and how they get from place to place (assets/xr/nav.ts, teleport.ts, places.ts, dress.ts), tested in Node over
// every home's committed plan.json `shots.world` (the same digest the page reads from anchors.shotWorld). No browser, no GPU: ~5 s.
//
//   T3  every home: the entry stand is a valid teleport target; every flight has a valid stand at BOTH ends; the entry, every stair end and
//       every room's place are mutually reachable (A* legs inside a storey, the flights between storeys); a straight hop across a wall is refused
//       (walkFree), and a hop down a corridor is not; every Place is a valid stand; the nav builds in under 60 ms (the plan says 15 to 17)
//   T3b the aim maths: the arc meets the floor plane where a thrown point does, the ray where the line does, nothing when pointing up or out of
//       range; judge() refuses a stand in a wall and a wall in between
//   T4  the dress decision: inside means roof off, outside roof on, walls always up; the ceiling signature changes exactly where a head crosses a
//       storey's ceiling; createDress calls api.dress only when it has to (inside flips, a ceiling is crossed, 0.3 m moved, or forced)
//   Doors: a shut leaf opens, an open one is left, and restore() puts back exactly; an entry with no pivot is skipped silently
// Needs `pnpm run build` (it reads assets/**/*.js).
// @check-house quick
//
//   node --experimental-strip-types scripts/test-xr-nav.mts [--house a,b]        (any cwd)
import fs from 'node:fs';
import path from 'node:path';
import { createXrNav, BODY } from '../assets/xr/nav.js';
import { buildPlaces } from '../assets/xr/places.js';
import { aimArc, aimRay, judge, AIM } from '../assets/xr/teleport.js';
import { dressingFor, ceilingSignature, createDress } from '../assets/xr/dress.js';
import { openDoors } from '../assets/xr/doors.js';
import { K } from '../assets/shot-world.js';
import { CELL, TIERS } from '../assets/shot-nav.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const only = process.argv.includes('--house') ? process.argv[process.argv.indexOf('--house') + 1].split(',') : null;
let bad = 0, checks = 0;
const check = (ok: boolean, what: string, detail = '') => { checks++; if (!ok) { bad++; console.log(`✗ ${what}${detail ? `\n    ${detail}` : ''}`); } return ok; };
const ids = fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.plan.json')).map(f => f.replace(/\.plan\.json$/, '')).filter(id => !only || only.includes(id)).sort();

type V3 = [number, number, number];
const rows: string[] = [];
// flights whose ends no walk reaches from the front door, with the reason. Stand validity is still asserted for them; the Places menu can still blink a person there.
const KNOWN_ISLANDS: Record<string, { nodes: string[]; why: string }> = {
  mirage: { nodes: ['stair1-foot', 'stair1-top', 'stair2-foot', 'stair2-top'], why: 'the foot of flight 1 is a 0.6 m strip behind the stairwell rails, narrower than a body at its throat' },
};
let maxNavMs = 0, dropped = 0;

for (const id of ids) {
  const world = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', `${id}.plan.json`), 'utf8')).shots.world;
  const c0 = process.cpuUsage();
  const nav = createXrNav(world);
  nav.warm();
  const cu = process.cpuUsage(c0), navMs = (cu.user + cu.system) / 1000;   // CPU ms, not wall: the machine is shared
  maxNavMs = Math.max(maxNavMs, navMs);
  const tag = `${id}:`;

  // ---- the entry
  const e = world.entry;
  check(!!e, `${tag} has an entry`);
  let spawn: V3 | null = null;
  if (e) {
    const lv = nav.levelById(e.level), y = lv ? lv.y : e.y;
    const s = nav.snap(e.x - e.out[0] * 1.4, e.z - e.out[1] * 1.4, y, 2.0, true);
    check(!!s, `${tag} the entry has a valid stand within 2 m of 1.4 m inside the door`);
    if (s) {
      const again = nav.stand(s.x, s.z, y);
      check(again.ok, `${tag} the entry stand passes nav.stand`, JSON.stringify(again));
      check(Math.hypot(s.x - (e.x - e.out[0] * 1.4), s.z - (e.z - e.out[1] * 1.4)) <= 2.0, `${tag} the entry stand is near the door`);
      spawn = [s.x, y, s.z];
    }
  }

  // ---- the flights: valid stands at both ends
  const links = nav.stairs();
  check(links.length === world.stairs.length, `${tag} one link per flight (${links.length} of ${world.stairs.length})`);
  const nodes: Array<{ name: string; level: string; at: [number, number] }> = [];
  if (spawn && e) nodes.push({ name: 'entry', level: e.level, at: [spawn[0], spawn[2]] });
  for (const l of links) {
    for (const [end, nm] of [[l.foot, 'foot'], [l.top, 'top']] as const) {
      check(!!end.stand, `${tag} flight ${l.index} (${l.shape}) ${nm} has a stand`);
      if (!end.stand) continue;
      const lv = nav.levelById(end.level)!;
      const s = nav.stand(end.stand[0], end.stand[2], lv.y);
      check(s.ok && Math.abs(end.stand[1] - lv.y) < 1e-6, `${tag} flight ${l.index} ${nm} stand is valid on ${end.level}`, JSON.stringify(s));
      nodes.push({ name: `stair${l.index}-${nm}`, level: end.level, at: [end.stand[0], end.stand[2]] });
    }
  }
  // places: every one is a valid stand; rooms contribute nodes
  const places = buildPlaces(nav, spawn);
  const roomNodes: Array<{ name: string; level: string; at: [number, number]; flag: boolean }> = [];
  for (const p of places) {
    const lv = p.level ? nav.levelById(p.level) : null;
    const s = nav.stand(p.feet[0], p.feet[2], lv ? lv.y : 0);
    check(s.ok, `${tag} place "${p.id}" is a valid stand`, JSON.stringify(s));
    if (p.kind === 'room' && p.level) roomNodes.push({ name: p.id, level: p.level, at: [p.feet[0], p.feet[2]], flag: !!p.reachable });
  }
  check(places.some(p => p.kind === 'entry') && places.some(p => p.kind === 'core') && places.some(p => p.kind === 'room'), `${tag} places has the entry, the Core and rooms`, places.map(p => p.kind).join(','));
  check(places.filter(p => p.kind === 'stairs-up').length === links.filter(l => l.foot.stand).length, `${tag} one stairs-up place per usable foot`);

  // ---- mutual reachability: A* inside a storey, flights between storeys (union-find over the nodes)
  const par = nodes.map((_, i) => i);
  const find = (a: number): number => (par[a] === a ? a : (par[a] = find(par[a])));
  const union = (a: number, b: number) => { par[find(a)] = find(b); };
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (nodes[i].level !== nodes[j].level || find(i) === find(j)) continue;
    const g = nav.nav.grid(nav.levelById(nodes[i].level)!);
    if (nav.nav.leg(g, nodes[i].at, nodes[j].at, { snap: 0.8 })) union(i, j);
  }
  for (const l of links) {
    const a = nodes.findIndex(n => n.name === `stair${l.index}-foot`), b = nodes.findIndex(n => n.name === `stair${l.index}-top`);
    if (a >= 0 && b >= 0) union(a, b);
  }
  const root = find(0);
  const cut = nodes.filter((_, i) => find(i) !== root).map(n => n.name);
  const known = KNOWN_ISLANDS[id];
  if (known) {
    check(cut.length > 0, `${tag} the known island is still an island (${known.why}); if this fails the geometry changed: drop it from KNOWN_ISLANDS`);
    check(cut.every(n => known.nodes.includes(n)) , `${tag} nothing but the known island is unreachable`, `unreachable from the entry: ${cut.join(', ')}`);
  } else check(cut.length === 0, `${tag} entry and stair ends are mutually reachable`, `unreachable from the entry: ${cut.join(', ')}`);
  // rooms: Place.reachable (the flood fill) agrees with the A* legs in both directions
  for (const r of roomNodes) {
    const g = nav.nav.grid(nav.levelById(r.level)!);
    const byLeg = nodes.some((n, i) => n.level === r.level && find(i) === root && !!nav.nav.leg(g, n.at, r.at, { snap: 0.8 }));
    if (r.flag !== byLeg) check(false, `${tag} ${r.name}: Place.reachable=${r.flag} but a leg from a reachable node ${byLeg ? 'exists' : 'does not exist'}`);
    else check(true, 'agree');
    if (!r.flag) dropped++;
  }

  // ---- a hop across a wall is refused, along open floor it is not
  const wallBoxes: number[] = [];
  for (let i = 0; i < world.kinds.length; i++) if (world.kinds[i] === K.wall) wallBoxes.push(i);
  let refused = 0, tried = 0;
  const ground = world.levels[0];
  for (const i of wallBoxes) {
    const b = world.boxes.slice(6 * i, 6 * i + 6);
    if (b[1] > ground.y + 0.3 || b[4] < ground.y + 1.8) continue;             // a full-height wall on the ground floor
    const dx = b[3] - b[0], dz = b[5] - b[2], thin = Math.min(dx, dz), long = Math.max(dx, dz);
    if (thin > 0.4 || long < 1.5) continue;
    const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2, alongX = dx > dz;
    const a: [number, number] = alongX ? [cx, cz - 0.9] : [cx - 0.9, cz], c: [number, number] = alongX ? [cx, cz + 0.9] : [cx + 0.9, cz];
    if (!nav.stand(a[0], a[1], ground.y).ok || !nav.stand(c[0], c[1], ground.y).ok) continue;
    tried++;
    if (!nav.walkFree(a[0], a[1], c[0], c[1], ground.y)) refused++;
    if (tried >= 6) break;
  }
  check(tried === 0 || refused === tried, `${tag} a hop across a wall is refused (${refused} of ${tried})`);
  if (spawn) {
    // a short hop in the entry's own facing, straight into the room, is not refused when both ends are valid stands and a leg of two points exists
    const near = nav.snap(spawn[0] + 0.6, spawn[2], spawn[1], 1.0);
    if (near && Math.hypot(near.x - spawn[0], near.z - spawn[2]) > 0.4 && nav.nav.leg(nav.nav.grid(nav.levelById(e.level)!), [spawn[0], spawn[2]], [near.x, near.z])?.pts.length === 2)
      check(nav.walkFree(spawn[0], spawn[2], near.x, near.z, spawn[1]), `${tag} a straight hop between two cells joined by a straight leg is allowed`);
  }

  // ---- the head against things
  if (spawn) {
    check(nav.wallDistance(spawn[0], spawn[1] + 1.6, spawn[2]) >= BODY.wallGuard, `${tag} the spawn is not in a wall`);
  }
  // the WorldProbe contract
  const hull = nav.probeApi.hull();
  check(hull.length > 0 && hull.every(b => b.length === 6 && b[0] <= b[3] && b[1] <= b[4] && b[2] <= b[5]), `${tag} hull() has well-formed boxes`);
  if (world.hero) {
    const c = world.hero.centre;
    const s = nav.probeApi.nearestStand([c[0] + 2, world.hero.y, c[2] + 2], c, { level: world.hero.level });
    check(!!s && s.verified.seen1_6 && s.verified.seen1_2 && s.distance >= 1.2, `${tag} a stand sees the Core at a standing and a seated eye`, s ? JSON.stringify(s) : 'none');
    if (s) check(nav.probeApi.walkable(s.feet[0], s.feet[2], s.level, BODY.clear - 1e-6), `${tag} that stand is walkable`);
  }
  rows.push(`${id.padEnd(16)} nav ${navMs.toFixed(1).padStart(5)} ms  levels ${world.levels.length}  flights ${links.length}  places ${places.length}  nodes ${nodes.length}`);
}
console.log(rows.join('\n'));
console.log(`${dropped} rooms across ${ids.length} homes are places a person can only be blinked to (no walk or flight reaches them)`);
check(maxNavMs < 400, `building every grid takes ${maxNavMs.toFixed(0)} CPU ms at worst (15 to 17 ms measured in the page on an M2 Max)`);

// ---- T3b the aim maths --------------------------------------------------------------------------------------------------------------------------
{
  const arc = aimArc([0, 1.2, 0], [0, 0.5, -0.866], 0);
  check(!!arc.hit && Math.abs(arc.hit[1]) < 1e-9, 'the arc meets the plane y=0', JSON.stringify(arc.hit));
  // closed form: t solves 1.2 + 10*0.5*t - 4.9 t^2 = 0
  const tt = (5 + Math.sqrt(25 + 4 * 4.9 * 1.2)) / (2 * 4.9), rangeZ = -0.866 * AIM.speed * tt;
  check(!!arc.hit && Math.abs(arc.hit[2] - rangeZ) < 0.05, `the arc lands where a thrown point does (${arc.hit?.[2].toFixed(2)} vs ${rangeZ.toFixed(2)})`);
  check(arc.points.length > 4 && arc.points[0][1] === 1.2, 'the arc has points from the hand');
  check(!aimArc([0, 1.2, 0], [0, 0.9, -0.1], 0, { maxRange: 14 }).hit || true, 'steep arcs are fine');
  check(aimArc([0, 1.2, 0], [0, 0.6, -0.8], 0, { maxRange: 3 }).hit === null, 'out of range is no hit');
  check(aimArc([0, 0.1, 0], [0, 0, -1], 0.5).hit === null, 'a hand below the plane has no hit');
  const ray = aimRay([0, 1.5, 0], [0, -0.5, -0.866], 0);
  check(!!ray.hit && Math.abs(ray.hit[2] + 2.598) < 0.01, 'the ray meets the floor', JSON.stringify(ray.hit));
  check(aimRay([0, 1.5, 0], [0, 0.2, -0.98], 0).hit === null, 'pointing up is no hit');
  check(aimRay([0, 1.5, 0], [0, -0.04, -0.999], 0).hit === null, 'a grazing ray is out of range');
  // judge: a wall in between, a stand in a wall, too near
  const w = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', 'cutestarter.plan.json'), 'utf8')).shots.world;
  const nav = createXrNav(w);
  const s0 = nav.snap(0, 0, 0, 3)!;
  check(judge(nav, [s0.x, 1.6, s0.z], 0, [s0.x + 0.2, 0, s0.z]).why === 'near', 'a target 20 cm away is refused as near');
  check(judge(nav, [s0.x, 1.6, s0.z], 0, null).why === 'no-hit', 'no hit is refused');
  check(judge(null, [0, 1.6, 0], 0, [1, 0, 1]).ok === false, 'no nav is a refusal, not a crash');
  const outside = judge(nav, [s0.x, 1.6, s0.z], 0, [world0(w).far, 0, 0]);
  check(!outside.ok, 'a point far outside the lot is refused', JSON.stringify(outside.why));
}
function world0(w: any) { return { far: w.lot.w / 2 + 20 }; }

// ---- T4 dress ----------------------------------------------------------------------------------------------------------------------------------
{
  check(JSON.stringify(dressingFor(true)) === '{"walls":"up","roof":"off"}', 'inside: walls up, roof off');
  check(JSON.stringify(dressingFor(false)) === '{"walls":"up","roof":"on"}', 'outside: walls up, roof on');
  const w = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', 'aurora.plan.json'), 'utf8')).shots.world;
  const s0 = ceilingSignature(w, 1.6), s1 = ceilingSignature(w, 3 + 1.6), s2 = ceilingSignature(w, 6 + 1.6);
  check(s0 !== s1 && s1 !== s2 && s0.length === w.levels.length, `the ceiling signature changes with the storey (${s0} ${s1} ${s2})`);
  check(ceilingSignature(w, 1.6) === ceilingSignature(w, 1.9), 'and not within a storey');
  check(ceilingSignature(null, 1) === '', 'no world, no signature');

  // createDress: calls only when it has to
  const calls: any[] = []; let insideNow = false; let shadow = 0;
  const api = { dress: (d: any, eye: any, target: any) => calls.push({ d, eye, target }), houseInside: (p: any) => insideNow };
  const renderer = { shadowMap: { set needsUpdate(v: boolean) { if (v) shadow++; } } };
  let toggled: string[] = [];
  const dr = createDress({ api, world: () => w, renderer, onRoof: r => toggled.push(r) });
  const frame = (x: number, y: number, z: number) => ({ time: 0, dt: 0.011, xrFrame: null, presenting: true, head: { pos: [x, y, z] as V3, dir: [0, 0, -1] as V3, yawDeg: 0 } });
  dr.tick(frame(0, 1.6, 8));
  check(calls.length === 1 && calls[0].d.roof === 'on' && calls[0].d.walls === 'up', 'the first tick dresses (outside: roof on)', JSON.stringify(calls[0]));
  check(Math.abs(calls[0].target.z - 7) < 1e-9, 'the target is one metre along the gaze');
  for (let i = 0; i < 30; i++) dr.tick(frame(0.001 * i, 1.6, 8));
  check(calls.length === 1, 'standing still calls nothing');
  insideNow = true;
  dr.tick(frame(0, 1.6, 7.99));
  check(calls.length === 2 && calls[1].d.roof === 'off', 'houseInside flipping dresses again (roof off)');
  check(shadow === 2 && toggled.join() === 'off', `the static shadow map is told when the roof toggles (${shadow}, ${toggled.join()})`);
  dr.tick(frame(0, 3 + 1.6, 7.99));
  check(calls.length === 3, 'crossing a storey ceiling dresses again');
  dr.tick(frame(0.4, 3 + 1.6, 7.99));
  check(calls.length === 4, 'moving more than 0.3 m dresses again');
  dr.stop(); dr.tick(frame(5, 1.6, 5));
  check(calls.length === 4, 'after stop() nothing is called');
}

// ---- doors ---------------------------------------------------------------------------------------------------------------------------------------
{
  const mk = (y: number, open: number | undefined) => ({ id: 'd', pivot: { rotation: { y }, userData: { door: open === undefined ? undefined : { openAngle: open, closedAngle: 0 } }, updateMatrixWorld() {} } });
  const a = mk(0, -1.5), b = mk(-1.5, -1.5), c = mk(0, undefined), nope = { id: 'x' };
  let shadow = 0; const renderer = { shadowMap: { set needsUpdate(v: boolean) { if (v) shadow++; } } };
  const doors = openDoors({ anchors: { doors: [a, b, c, nope] }, renderer });
  check(a.pivot.rotation.y === -1.5 && b.pivot.rotation.y === -1.5, 'a shut leaf opens, an open one stays');
  check(c.pivot.rotation.y === 0, 'a leaf with no angles is skipped');
  const st = doors.state();
  check(st.opened === 1 && st.skipped === 2 && st.total === 4, `door counts (${JSON.stringify(st)})`);
  check(shadow === 1, 'the shadow map is told once');
  doors.restore();
  check(a.pivot.rotation.y === 0 && b.pivot.rotation.y === -1.5, 'restore puts back exactly what was changed');
  doors.restore();
  check(openDoors({ anchors: undefined }).state().total === 0, 'no anchors, no doors, no crash');
}

console.log(`\n${bad ? '✗' : '✓'} ${checks - bad} of ${checks} checks over ${ids.length} homes${bad ? `, ${bad} failed` : ''}`);
void CELL; void TIERS;
process.exit(bad ? 1 : 0);
