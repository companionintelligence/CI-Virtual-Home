// Spline planner v2 (plan §3): door-to-core as timed beats on one shared track. THREE-free — it reads the
// ShotWorld (assets/shot-world.ts) and bakes a 120 Hz track the page samples by seconds (sampleTrack), the Node
// harness bakes byte for byte the same (scripts/test-shot-planner.mts), and QA v2 (assets/shot-qa.ts) measures.
//
//   route      establish → approach → (door) → the rooms worth seeing → stairs up or down → the Core room → the
//              approach to the orbit (nav: assets/shot-nav.ts; route choice §3.7)
//   beats      establish · extStair · approach · threshold · reveal · route · stair | descend · roomReveal · hero
//              (the push-in) · orbit (round the Core, ≥ 90° where the room allows, ending on its front) · power
//   path       one polyline, its corners filleted, resampled every 2 cm; the orbit is exact circle arc
//   speed      a cap per sample (the beat's §3.4 cap, doorways, curvature, the orbit's 40°/s), acceleration-limited
//              forward and back, the time map smoothed (a Hann window), the duration solved (§3.4) — surplus to
//              establish, route, reveal, hero; a pinned duration too short scales every speed up (QA warns)
//   look       §3.5: the look-ahead point and the beat's subject blended by weight, gated on visibility, the lead
//              room, a zero-phase per-beat yaw-rate limiter and a 0.25 s Hann, pitch clamps; the finale locked on
//              the Core and composed on a thirds line
//   bake       pos, look, fov, roofAlpha, compose (the Core's offset in the frame, re-applied per aspect) at 120 Hz
//
// The finale BUILDS ON the shipped orbit (assets/core-orbit.ts): the same free-run search round the Core, run on the
// digest's boxes (framing.ts createOrbitProbeW), with the walk's end chosen so the sweep can be long: ≥ 90° where
// the free arc allows it, ~120° typical, and never swinging round the Core in frame against the orbit first.
//
// Determinism: seeds from fnv1a(`${id}:<purpose>`), fixed grids and iteration counts, stable sorts, no clock,
// Math.random or per-frame state. The track is a pure function of (world, options).
//
// Owner: S5 (shot).
import { Math } from './detmath.js';
import { BEATS, type Beat, SPEC_SPEED, SPEC_YAW, SPEC_PITCH, BEAT_FLOOR, DOOR_PLANE_SPEED, DOOR_ZONE_M, DOORWAY_SPEED, LENS_RATE, LENS_HERO, LENS_HERO_MAX, LENS_INTERIOR } from './shot-spec.js';
import { planDoors } from './shot-doors.js';
import { K, DEG, clamp, inRect, inFootprint, indoors, levelAt, mulberry32, fnv1a, wrapPi, createWorldIndex, type ShotWorld, type WLevel, type WStair, type WRoom } from './shot-world.js';
import { createNav, roomInterest, CELL, type Nav } from './shot-nav.js';
import { createProbe, camera, project, projectBox, boxFrameShare, type V3, type Probe } from './shot-probe.js';
import { chooseEstablish, EST_PITCH, createOrbitProbeW, heroRing, fovForCore, coreHeightPct, composeTarget, THREE_SHIM, ESTABLISH_STYLES, houseBox, type Establish } from './framing.js';
import { freeMap, frontRun, sweepFrom, ORBIT_STEP } from './core-orbit.js';

export const FPS = 120;
// The plan's numbers are assets/shot-spec.ts's (§3.3 – §3.14): the planner builds to them and QA v2 holds the film to them, neither reading the other's constants. What follows
// is the planner's own: the film's frame rate, the beats' order, and the numbers the plan leaves to it.
export { BEATS };
export type { Beat };
/** §3.4 cruise caps, m/s (a flight's is along it in plan) — the plan's, as assets/shot-spec.ts has them; `orbit` is angular, °/s */
export const SPEED_CAP: Record<Beat, number> = { ...SPEC_SPEED };
/** the route beat's cruise cap (§3.4: 2.2 m/s): walking pace is 1.4, and what limits a walk is its doorways, its corners and the rooms it slows for, never a cap it reaches */
export const routeCap = (_lengthM: number) => SPEED_CAP.route;
/** §3.4: the eye crosses the entry door's plane at no more than this (m/s) — the threshold beat's own cap is the wider zone's */
export const DOOR_PLANE_CAP = DOOR_PLANE_SPEED;
/** §3.5 yaw-rate caps, °/s — the plan's. QA holds every beat to them (`beat-yaw`). */
export const YAW_CAP: Record<Beat, number> = { ...SPEC_YAW };
/** §3.5 pitch clamps, degrees */
export const PITCH: Record<Beat, [number, number]> = { ...SPEC_PITCH, establish: EST_PITCH, roomReveal: [-18, 8] };
/** the floors a beat never goes under (§3.4) */
export { BEAT_FLOOR };
export const OUTSIDE = new Set<Beat>(['establish', 'extStair', 'approach']);
export const LENS = { exterior: 34, interior: 57, hero: 40, rate: LENS_RATE };
const LENS_INTERIOR_MIN = LENS_INTERIOR[0];
/** an auto film is never under 12 s (§3.0): it is as long as its walk needs at the caps (plus a breath) — see the duration solve, and QA's `film-length` */
export const AUTO_DURATION = { min: 12 };
/** §3.4 acceleration limits (m/s²): 1.5 inside, 3 outside — the planner keeps a little under so smoothing never crosses them */
export const ACC_IN = 1.45, ACC_OUT = 2.9;

export type Track = {
  version: 2; planner: 'v2'; type: string; id: string;
  duration: number; fps: number; samples: number; dt: number;
  pos: Float32Array; look: Float32Array; fov: Float32Array; roofAlpha: Float32Array; composeW: Float32Array;
  /** what a frame narrower than 16:9 needs of its lens so the Core's box stays inside it (coreTanH): the horizontal half-tangent at 16:9 scale, 0 where the Core is out of view */
  tanHReq?: Float32Array;
  compose: { ndcX: number; ndcY: number } | null;
  beat: Uint8Array;                        // the beat of each sample, as an index into BEATS
  beats: Array<{ name: Beat; t0: number; t1: number; subject: V3 | null }>;
  events: { enterT: number | null; stairT: number[]; pressT: number | null; settleT: number | null; doneT: number; firstCoreT: number | null };
  doors: Record<string, Float32Array>;
  metrics: Record<string, any>;
  plan: Record<string, any>;               // what the planner chose (style, route rooms, orbit …), for QA and the audit
  desired?: Float32Array;                  // the look solver's wanted direction before rate limits (the lag of the limiter: QA's `lookLag`)
  subj?: Float32Array;                     // the beat's subject per sample (x, y, z): what the look solver was looking for, which QA's look error is measured against (§3.14)
  hash?: string;                           // trackHash: what a Node bake and the page's must agree on
};

// ---- small vector helpers ---------------------------------------------------------------------------------------
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dist2 = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const hann = (arr: Float64Array, halfWin: number) => {
  if (halfWin < 1) return arr;
  const n = arr.length, out = new Float64Array(n), w: number[] = [];
  for (let k = -halfWin; k <= halfWin; k++) w.push(0.5 + 0.5 * Math.cos(Math.PI * k / (halfWin + 1)));
  for (let i = 0; i < n; i++) { let s = 0, ws = 0; for (let k = -halfWin; k <= halfWin; k++) { const j = i + k; if (j < 0 || j >= n) continue; s += arr[j] * w[k + halfWin]; ws += w[k + halfWin]; } out[i] = s / ws; }
  return out;
};

/** The zero-phase rate limiter (§3.5): pairs that step faster than the cap (per sample, `cap[i]`) are pulled together
 *  symmetrically, sweep after sweep forward and back (a fixed count), then one forward pass guarantees the cap. */
export function rateLimit(arr: Float64Array, cap: Float64Array) {
  const N = arr.length, y = arr.slice();
  for (let sweep = 0; sweep < 160; sweep++) {
    let moved = 0;
    const fwd = (sweep & 1) === 0;
    for (let k = 0; k < N - 1; k++) {
      const i = fwd ? k : N - 2 - k, lim = Math.min(cap[i], cap[i + 1]), d = y[i + 1] - y[i];
      if (d > lim) { const ex = (d - lim) / 2; y[i] += ex; y[i + 1] -= ex; moved += ex; }
      else if (d < -lim) { const ex = (-lim - d) / 2; y[i] -= ex; y[i + 1] += ex; moved += ex; }
    }
    if (moved < 1e-7) break;
  }
  for (let i = 1; i < N; i++) { const lim = Math.min(cap[i], cap[i - 1]); y[i] = y[i - 1] + clamp(y[i] - y[i - 1], -lim, lim); }
  return y;
}

// ---- the path: segments of points, each with its beat -----------------------------------------------------------
type Seg = { beat: Beat; pts: V3[]; exact?: boolean; level?: string; flight?: number };

/** fillet the corners of a polyline with circular arcs (radius ≤ rMax, never more than 45 % of a leg), 3D */
export function fillet(pts: V3[], rMax = 1.4, ok?: (p: V3) => boolean, okLoose?: (p: V3) => boolean): V3[] {
  if (pts.length < 3) return pts.slice();
  const out: V3[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], v = pts[i], b = pts[i + 1];
    const u1 = norm(sub(v, a)), u2 = norm(sub(b, v)), La = len(sub(v, a)), Lb = len(sub(b, v));
    const cos = clamp(u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2], -1, 1), phi = Math.acos(cos);
    if (phi < 2 * DEG || La < 1e-3 || Lb < 1e-3) { out.push(v); continue; }
    let t = Math.min(0.45 * La, 0.45 * Lb, rMax * Math.tan(phi / 2));
    // (the radius halves while the arc is not clear of the walls; the last two tries hold it to the looser clearance — a corner is never left sharp
    // where a tighter arc will do: at a walking pace a 90° corner is a jerk of 20 m/s³ and a speed cap of 0.5 m/s)
    for (let tries = 0; tries < 6; tries++) {
      const p1 = sub(v, mul(u1, t)), p2 = add(v, mul(u2, t));
      const arc: V3[] = [];
      const n = Math.max(2, Math.ceil(phi / (6 * DEG)));
      // a quadratic Bézier through p1, v, p2 approximates the fillet closely and stays inside the corner
      for (let k = 0; k <= n; k++) { const s = k / n; arc.push(add(add(mul(p1, (1 - s) * (1 - s)), mul(v, 2 * s * (1 - s))), mul(p2, s * s))); }
      if (!ok || arc.every(tries < 4 || !okLoose ? ok : okLoose)) { out.push(...arc); break; }
      t *= 0.6;
      if (tries === 5) out.push(v);
    }
  }
  out.push(pts[pts.length - 1]);
  // drop points closer than 1 mm
  return out.filter((p, i) => i === 0 || len(sub(p, out[i - 1])) > 1e-3);
}
export const polyLen = (pts: V3[]) => { let L = 0; for (let i = 1; i < pts.length; i++) L += len(sub(pts[i], pts[i - 1])); return L; };
/** split a polyline at arc length s: [head, tail] (both include the split point) */
function splitAt(pts: V3[], s: number): [V3[], V3[]] {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = len(sub(pts[i], pts[i - 1]));
    if (acc + l >= s) { const q = lerp3(pts[i - 1], pts[i], l > 0 ? (s - acc) / l : 0); return [[...pts.slice(0, i), q], [q, ...pts.slice(i)]]; }
    acc += l;
  }
  return [pts.slice(), [pts[pts.length - 1]]];
}
export const bezier = (p0: V3, p1: V3, p2: V3, p3: V3, n: number): V3[] => { const out: V3[] = []; for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1], u * u * u * p0[2] + 3 * u * u * t * p1[2] + 3 * u * t * t * p2[2] + t * t * t * p3[2]]); } return out; };

export type PlanOptions = {
  duration?: number | 'auto';      // the shot's length: a number pins it; 'auto' solves it from the route (never under 12 s; about 20–40 s in practice: AUTO_DURATION)
  minDuration?: number;            // under the global switch, the spec's v1 duration is a floor, not a pin
  establish?: any; via?: string[]; beats?: Partial<Record<Beat, number>>; route?: 'auto' | 'scenic' | 'shortest';
  heroView?: any; fps?: number;
  /** a walkthrough: the film starts inside the door (no establishing move, approach or threshold) and passes through `via` */
  inside?: boolean;
  /** internal: what a retry changes (the establishing move's scale) */
  tune?: { estScale?: number };
  /** the seed of the houses' favourite establishing styles (framing.ts ESTABLISH_SALT) — only scripts/fit-establish-salt.mts passes another */
  salt?: string;
};

// =====================================================================================================================
/** Which planner flies a shot, and the options planner v2 plans it with, from the spec (plan §3.16): a shot's own
 *  `planner` ('v1' | 'v2'), else the global switch (the page's ?planner=v2), else v1 — the default on this branch. A number
 *  `duration` pins a v2 film when the shot names v2 itself; under the global switch it is only a floor (the v1 12 or
 *  14 s), the film 'auto'. The page (shot-planner-v1.ts) and the Node harness (scripts/) both read this. */
export function shotOptions(spec: any, type: string, globalPlanner: string | null = null) {
  const shot = (spec.shots || []).find((x: any) => x && x.type === type) || null;
  const explicit = !!(shot && (shot.planner === 'v1' || shot.planner === 'v2'));
  const planner: 'v1' | 'v2' = explicit ? shot.planner : globalPlanner === 'v2' ? 'v2' : 'v1';
  const dur = shot ? shot.duration : undefined;
  const options: PlanOptions = {
    duration: explicit ? (dur ?? 'auto') : (type === 'door-to-core' ? 'auto' : undefined),
    minDuration: !explicit && typeof dur === 'number' && type === 'door-to-core' ? dur : undefined,
    heroView: spec.hero && spec.hero.view,
  };
  if (type === 'door-to-core' && shot) { options.establish = shot.establish; options.via = shot.via; options.beats = shot.beats; options.route = shot.route; }
  if (type !== 'door-to-core') options.duration = typeof dur === 'number' ? dur : type === 'walkthrough' ? 'auto' : undefined;
  return { planner, explicit, options, shot };
}

/** Plan door-to-core. (An earlier version planned an auto film a second time with a smaller establishing move whenever the outside
 *  would be over 30 % of it: an opening sized to the film. The house is now whole in the first frame, and it is the film that is as
 *  long as the opening needs — planOnce's duration solve — so there is one plan.) */
export function planDoorToCore(world: ShotWorld, opts: PlanOptions = {}) {
  // (a shot whose spec the planner cannot make a film of — a custom `establish` pose the garden blocks and nothing replaces — is QA's `route-failed`, not an exception in the page's glue that no check ever sees)
  try { return planOnce(world, opts); } catch (e: any) { return { ok: false as const, code: 'route-failed', message: `the planner could not plan this shot: ${e && e.message ? e.message : e}`, notes: [] as string[] }; }
}
function planOnce(world: ShotWorld, opts: PlanOptions = {}) {
  const index = createWorldIndex(world), probe = createProbe(index), nav = createNav(world, index);
  const notes: string[] = [];
  const fail = (code: string, message: string) => ({ ok: false as const, code, message, notes });
  if (!world.entry) return fail('route-failed', 'no entry door');
  if (!world.hero) return fail('core-missing', 'no Companion Core');
  const e = world.entry, hero = world.hero;
  const n2: [number, number] = e.out;
  const Le = nav.levelOf(e.level), Lh = nav.levelOf(hero.level);
  const core = hero.core, centre: V3 = [(core[0] + core[3]) / 2, (core[1] + core[4]) / 2, (core[2] + core[5]) / 2];
  const rng = mulberry32(fnv1a(`${world.id}:door-to-core`));
  const eyeY = (lv: WLevel) => lv.y + Math.min(1.5, lv.h - 0.35);

  // ---- 1. the finale: the orbit round the Core (core-orbit.ts's free-run search, on the world) ----------------
  const heroLv = Lh;
  const orbitProbe = createOrbitProbeW(world, index, probe, heroLv);
  // (the radius the finale ends at puts the Core at ~21 % of the frame at a 44–48° lens: 1.05 m, where the room lets it)
  const ORBIT_R: Record<string, number> = { desk: 1.05, credenza: 1.1, island: 1.2, shelf: 0.95, none: 1.0 };
  const upright = hero.pose === 'upright';
  // (an upright Core is 23 cm tall and 15 wide: at 21–24 % of the frame's height it is 8 % of its width — QA's core-narrow wants 10 — so it is framed a little larger, 22–26 %. §3.11: 18–25 % of the frame for the rest)
  const CORE_H = upright ? 0.23 : 0.215, CORE_HMAX = upright ? 0.30 : 0.25;
  // hero.view (plan §3.16) overrides the search: the finale's distance and height, and the azimuth it ends at
  const HV = opts.heroView && typeof opts.heroView === 'object' ? opts.heroView : null;
  const r0 = HV && typeof HV.dist === 'number' ? clamp(HV.dist, 0.6, 2) : (ORBIT_R[hero.surface] ?? 0.9) + (upright ? 0.2 : 0);
  const hMax = heroLv.y + heroLv.h - 0.32 - centre[1];
  // the orbit's eye height over the Core's top: 0.45 easing down to 0.36 (the default), or held at 0.45 / 0.5 where a chair
  // back or a lamp stands in the way of the lower half (§3.11: 0.25–0.5 m over the top)
  const HS_OPTIONS: Array<[number, number]> = (HV && typeof HV.height === 'number' ? [[HV.height + 0.09, HV.height]] : [[0.45, 0.36], [0.45, 0.45], [0.5, 0.5], [0.4, 0.4]] as Array<[number, number]>).map(([a, b]) => [Math.max(0.12, Math.min(a, hMax)), Math.max(0.1, Math.min(b, hMax - (a - b) - 0.0))] as [number, number]);
  let hs: [number, number] = HS_OPTIONS[0];
  const sweepOpt = { aMax: 150, aWant: 135, over: [15, 55] };
  const orbitPtAt = (deg: number, y: number, r: number): V3 => { const a = deg * DEG, f = hero.fwd, sd = [f[1], -f[0]]; return [centre[0] + r * (Math.cos(a) * f[0] + Math.sin(a) * sd[0]), y, centre[2] + r * (Math.cos(a) * f[1] + Math.sin(a) * sd[1])]; };
  type OrbitPlan = { r: number; run: any; options: any[]; hs: [number, number]; rscore: number; lens: number; score: number };
  let orbit: OrbitPlan | null = null;
  // the radii and eye heights the orbit can run at, with the free run round the Core at each (core-orbit.ts's freeMap: 144 probes a combination), ranked by what the sweep is worth
  // (its length, ≥ 90° pays) less what the radius costs (away from the nominal one, and the lens it needs to frame the Core — the plan's finale lens is 38–44, LENS_HERO; up to LENS_HERO_MAX
  // where the room forces it, 10 points a degree). The finale's own walk decides between them (finaleFrom below, per plan): a radius whose free run is long but whose way in
  // swings round the Core against the sweep or arrives facing away from it is no radius at all (vanilla at 1.05 m: a 135° run, every way into it a walk past the Core and back at it).
  const orbitPlans: OrbitPlan[] = [];
  let moreOrbitPlans = (): boolean => false;
  {
    // (the narrowest lens, 38–LENS_HERO_MAX°, at which the Core is no more than CORE_HMAX of the frame from there: the plan's finale lens is 38–44 (§3.5), and a radius that needs more than that is one the room forced — so it costs the sweep it buys, 10 points a degree)
    const lensNeeded = (r: number, hsx: [number, number]) => { const eyeAt = orbitPtAt(35, centre[1] + hsx[1] - 0.01, r * 0.96); for (let f = 38; f <= LENS_HERO_MAX + 0.001; f += 0.5) if (coreHeightPct(eyeAt, centre, f, core) <= CORE_HMAX - 0.015) return f; return 99; };
    const heightAt = (r: number, hsx: [number, number]) => lensNeeded(r, hsx) <= LENS_HERO_MAX ? 0 : 1;
    // (the radii in the order they are tried: the nominal one, then the nearer and the further by tenths — the nearer ones are where a tight room's sweep is longest, the Core fills more of the frame there)
    const RADII_ALL = (HV && typeof HV.dist === 'number' ? [r0] : [r0, r0 - 0.1, r0 + 0.1, r0 - 0.2, r0 + 0.2, r0 - 0.25, r0 + 0.3, r0 + 0.4, r0 + 0.5]).filter(r => r >= 0.6 && r <= 2);
    const okRadii = HV && typeof HV.dist === 'number' ? RADII_ALL : RADII_ALL.filter(r => heightAt(r, HS_OPTIONS[0]) === 0);
    const RADII = (okRadii.length ? okRadii : RADII_ALL.slice().sort((a, b) => lensNeeded(a, HS_OPTIONS[0]) - lensNeeded(b, HS_OPTIONS[0])).slice(0, 1).concat(RADII_ALL.slice(0, 3))).slice(0, 6);
    const combos: Array<[number, [number, number], number]> = [];
    for (const r of RADII) combos.push([0, HS_OPTIONS[0], r]);
    for (const [hi, hsx] of HS_OPTIONS.entries()) if (hi) for (const r of RADII) combos.push([hi, hsx, r]);
    // each combination's free run and sweeps: a plan, or null where nothing is free round the Core
    const evalCombo = ([hi, hsx, r]: [number, [number, number], number]): OrbitPlan | null => {
      const free = freeMap(THREE_SHIM, orbitProbe, new THREE_SHIM.Vector3(...centre), hero.fwd, r, hsx);
      const run0 = frontRun(free); if (!run0) return null;
      // (5° in from where the free run ends: the final push-in and the eye's own size are not in the 5° probe)
      const run = run0.full || run0.hi - run0.lo < 30 ? run0 : { ...run0, lo: run0.lo + 5, hi: run0.hi - 5 };
      const opts2 = (run.full || (run.lo <= 0 && run.hi >= 0) ? [-1, 1] : [Math.abs(run.lo) < Math.abs(run.hi) ? -1 : 1])
        .map(dir => sweepFrom(run, dir, run.full ? -dir * 180 : dir < 0 ? run.hi : run.lo, sweepOpt)).filter(Boolean);
      // (hero.view.azimuth names the side the orbit ends on: only the sweep that ends there)
      if (HV && typeof HV.azimuth === 'number') { const keep = opts2.filter(o => Math.sign(o.dir) === Math.sign(HV.azimuth)); opts2.length = 0; opts2.push(...keep); }
      if (!opts2.length) return null;
      const arc = Math.max(...opts2.map(o => o.arc));
      // (the Core's share of the frame from where the orbit ends — 35° past its front, at the finale's widest lens: over the
      // 25 % the plan holds it to, the orbit is too close to frame it, however long its arc)
      const lens = lensNeeded(r, hsx);
      const rscore = - 40 * Math.abs(r - r0) - 12 * hi - 500 * heightAt(r, hsx) - 10 * Math.max(0, Math.min(LENS_HERO_MAX, lens) - LENS_HERO[1]);
      return { r, run, options: opts2, hs: hsx, rscore, lens, score: Math.min(arc, 150) + (arc >= 90 ? 150 : 0) + rscore };
    };
    // the nominal radius and height first, the others while the sweep is short of 120° (each is 144 probes); what is left over is evaluated when the finale asks for more (moreOrbitPlans)
    let next = 0, bs = -Infinity, bestP: OrbitPlan | null = null;
    for (; next < combos.length; next++) {
      if (bestP && bs >= 120 - 40 * 0.1 && Math.max(...bestP.options.map((o: any) => o.arc)) >= 120) break;
      const p = evalCombo(combos[next]); if (!p) continue;
      orbitPlans.push(p); if (p.score > bs + 1e-9) { bs = p.score; bestP = p; }
    }
    moreOrbitPlans = () => { for (; next < combos.length;) { const p = evalCombo(combos[next++]); if (p) { orbitPlans.push(p); return true; } } return false; };
    orbitPlans.sort((x, y) => y.score - x.score || x.r - y.r);
    orbit = orbitPlans[0] || null;
    if (orbit) hs = orbit.hs;
  }
  const orbitPt = (deg: number, y: number, r: number): V3 => { const a = deg * DEG, f = hero.fwd, s = [f[1], -f[0]]; return [centre[0] + r * (Math.cos(a) * f[0] + Math.sin(a) * s[0]), y, centre[2] + r * (Math.cos(a) * f[1] + Math.sin(a) * s[1])]; };
  const heroAngle = (x: number, z: number) => { const vx = x - centre[0], vz = z - centre[2], f = hero.fwd; return Math.atan2(vx * f[1] - vz * f[0], vx * f[0] + vz * f[1]) / DEG; };

  // ---- 2. the door: its axis points (the establishing pose and the approach are planned after the inside, when
  //         the time the inside needs says how far out the film can start)
  const D: V3 = [e.x, e.y, e.z];
  const outsideOk = (p: V3) => index.pointHits(p[0], p[1], p[2], k => (k === K.site || k === K.roof) ? 0.25 : (k === K.wall || k === K.glass || k === K.rail) ? 0.3 : (k === K.item || k === K.hull || k === K.fixture) ? 0.2 : false).length === 0;
  const blockedOut = (pts: V3[]) => pts.findIndex(p => !outsideOk(p));
  // the eye's height at the door: 1.55 m over the entry's floor — or lower (to 1.15 m) where the first 6 m of the door's axis would take it through a crown or a branch at that height
  // (a front door among the leaves of a host tree: the approach ducks under them, never through)
  let yDoor = e.y + 1.55;
  for (const dy of [0, 0.1, 0.2, 0.3, 0.4]) {
    let ok = true; for (let d = 0.4; d <= 6 && ok; d += 0.2) ok = outsideOk([e.x + n2[0] * d, e.y + 1.55 - dy, e.z + n2[1] * d]);
    if (ok) { yDoor = e.y + 1.55 - dy; break; }
    yDoor = e.y + 1.55 - dy;
  }
  const P08: V3 = [e.x + n2[0] * 0.6, yDoor, e.z + n2[1] * 0.6];
  const P3: V3 = [e.x + n2[0] * 3, yDoor + 0.05, e.z + n2[1] * 3];
  const I0: V3 = [e.x - n2[0] * 0.6, eyeY(Le), e.z - n2[1] * 0.6];

  // ---- 3. inside: the stairs between the entry storey and the Core's, and the rooms on the way ----------------
  const flights: Array<{ st: WStair; up: boolean }> = [];
  if (Le.id !== Lh.id) {
    // breadth-first over the flights, either way (a stair is walked up or down: plan Completeness A2)
    const prev = new Map<string, { from: string; st: WStair; up: boolean }>(); const seen = new Set([Le.id]); let frontier = [Le.id];
    while (frontier.length && !seen.has(Lh.id)) {
      const next: string[] = [];
      for (const id of frontier) for (const st of world.stairs) {
        for (const [a, b, up] of [[st.from, st.to, true], [st.to, st.from, false]] as Array<[string, string, boolean]>) {
          if (a !== id || seen.has(b)) continue;
          seen.add(b); prev.set(b, { from: a, st, up }); next.push(b);
        }
      }
      frontier = next;
    }
    if (!seen.has(Lh.id)) return fail('route-failed', `no flight of stairs connects ${Le.id} to ${Lh.id}`);
    for (let id = Lh.id; id !== Le.id;) { const p = prev.get(id)!; flights.unshift({ st: p.st, up: p.up }); id = p.from; }
  }
  // the rooms: interest per room on the storeys the walk crosses
  const interestOf = new Map<WRoom, ReturnType<typeof roomInterest>>();
  for (const lv of world.levels) for (const r of lv.rooms) {
    const hasStair = world.stairs.some(s => (s.from === lv.id || s.to === lv.id) && inRect(s.bottom[0], s.bottom[2], r.b, 0.2));
    interestOf.set(r, roomInterest(r, world, hasStair));
  }
  const coreRoom = nav.roomAt(Lh.id, hero.x, hero.z) || nav.roomAt(Lh.id, centre[0] + hero.fwd[0] * 1.2, centre[2] + hero.fwd[1] * 1.2);
  const segs: Seg[] = [];
  // door funnels (§3.6): a leg that crosses an interior doorway goes through its middle (±0.1 m) on a straight stretch square to it, 0.9 m either
  // side: the door's middle and the two points on its normal are waypoints of the polyline (the corners they make are rounded by fillet())
  const funnelDoors = (lv: WLevel, g: ReturnType<typeof nav.grid>, pts: Array<[number, number]>) => {
    const doors = nav.doorsOn(lv.id); if (!doors.length) return pts;
    const out: Array<[number, number]> = [pts[0]];
    const sd = (q: [number, number], d: { c: [number, number]; n: [number, number] }) => (q[0] - d.c[0]) * d.n[0] + (q[1] - d.c[1]) * d.n[1];
    for (let k = 0; k < pts.length - 1; k++) {
      const p = pts[k], q = pts[k + 1];
      const hits: Array<{ f: number; d: (typeof doors)[number]; sg: number }> = [];
      for (const d of doors) {
        const a0 = sd(p, d), a1 = sd(q, d); if (!(a0 * a1 < 0)) continue;
        const f = a0 / (a0 - a1), x = p[0] + (q[0] - p[0]) * f, z = p[1] + (q[1] - p[1]) * f;
        if (Math.abs((x - d.c[0]) * d.n[1] - (z - d.c[1]) * d.n[0]) < d.w / 2 + 0.15) hits.push({ f, d, sg: a1 > a0 ? 1 : -1 });
      }
      hits.sort((x, y) => x.f - y.f || x.d.part - y.d.part);
      // (the waypoints go on in order along the segment: two doors close together share the stretch between them, and a point that would take the
      // eye back is dropped, never walked)
      const ux = q[0] - p[0], uz = q[1] - p[1], ul = Math.hypot(ux, uz) || 1, proj = (w: [number, number]) => ((w[0] - p[0]) * ux + (w[1] - p[1]) * uz) / ul;
      let at = proj(out[out.length - 1]);
      const add = (w: [number, number]) => { const t = proj(w); if (t > at + 0.05) { out.push(w); at = Math.max(at, t); } };
      const kept: typeof hits = [];
      for (const h of hits) if (!kept.some(o => Math.hypot(o.d.c[0] - h.d.c[0], o.d.c[1] - h.d.c[1]) < 0.6)) kept.push(h);   // (two partitions with a door in one place: one doorway)
      for (const h of kept) {
        const d = h.d;
        // (1.5 m either side: the corner rounded at the waypoint takes at most 0.45 of its leg, so the walk is straight for the ±0.7 m the plan wants square)
        for (const dd of [1.5, 1.2, 0.9]) { const E: [number, number] = [d.c[0] - d.n[0] * h.sg * dd, d.c[1] - d.n[1] * h.sg * dd]; if (Math.abs(sd(out[out.length - 1], d)) > dd + 0.15 && nav.passableAt(g, E[0], E[1], 3)) { add(E); break; } }
        add([d.c[0], d.c[1]]);
        for (const dd of [1.5, 1.2, 0.9]) { const X: [number, number] = [d.c[0] + d.n[0] * h.sg * dd, d.c[1] + d.n[1] * h.sg * dd]; if (Math.abs(sd(q, d)) > dd + 0.15 && nav.passableAt(g, X[0], X[1], 3)) { add(X); break; } }
      }
      out.push(q);
    }
    return out;
  };
  const legPts = (lv: WLevel, a: [number, number], b: [number, number], snap = 0.8) => {
    const g = nav.grid(lv);
    const r = nav.leg(g, a, b, { snap });
    if (!r) return r;
    const pts = funnelDoors(lv, g, r.pts); let len = 0; for (let k = 1; k < pts.length; k++) len += dist2(pts[k], pts[k - 1]);
    return { ...r, pts, len };
  };
  const via = (opts.via || []).map(nm => { for (const lv of world.levels) for (const r of lv.rooms) if (r.name === nm || r.no === nm) return { lv, r }; notes.push(`via room "${nm}" not found`); return null; }).filter(Boolean) as Array<{ lv: WLevel; r: WRoom }>;
  const routeMode = opts.route || 'auto';
  // one storey's walk from a to b, through its forced rooms, with the detour (route choice) that pays for itself
  // the rooms QA v2 counts as worth seeing (the three of highest interest on the entry storey and the Core's): the route is
  // scored on them first (they weigh half as much again)
  const topSet = new Set<WRoom>();
  { const pool = [...new Set([...Le.rooms, ...Lh.rooms])].filter(r => r.b); pool.sort((x, y) => (interestOf.get(y)!.interest - interestOf.get(x)!.interest) || x.no.localeCompare(y.no)); pool.slice(0, 3).forEach(r => topSet.add(r)); }
  const storeyWalk = (lv: WLevel, a: [number, number], b: [number, number], budgetM: number, scenic = true) => {
    const forced = via.filter(v => v.lv.id === lv.id).map(v => nav.visitPoint(lv.id, v.r)).filter(Boolean) as Array<[number, number]>;
    const stops = [a, ...forced, b];
    const walk = (ps: Array<[number, number]>) => {
      const out: Array<[number, number]> = []; let L = 0;
      for (let k = 1; k < ps.length; k++) { const r = legPts(lv, ps[k - 1], ps[k]); if (!r) return null; out.push(...(k === 1 ? r.pts : r.pts.slice(1))); L += r.len; }
      return { pts: out, len: L };
    };
    const base = walk(stops);
    if (!base) return null;
    const visited = (pts: Array<[number, number]>) => { const s = new Set<WRoom>(); for (let k = 0; k < pts.length - 1; k++) for (let u = 0; u < 1; u += 0.1) { const r = nav.roomAt(lv.id, pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u); if (r) s.add(r); } return s; };
    const doorsOf = (pts: Array<[number, number]>) => { let n = 0; const ds = nav.doorsOn(lv.id); for (let k = 0; k < pts.length - 1; k++) for (const d of ds) { const a0 = (pts[k][0] - d.c[0]) * d.n[0] + (pts[k][1] - d.c[1]) * d.n[1], a1 = (pts[k + 1][0] - d.c[0]) * d.n[0] + (pts[k + 1][1] - d.c[1]) * d.n[1]; if (a0 * a1 < 0) { const f = a0 / (a0 - a1), x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, z = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f; if (Math.hypot(x - d.c[0], z - d.c[1]) < d.w / 2 + 0.2) n++; } } return n; };
    // a walk that doubles back on itself (a turn over 110° inside 4 m, in one corner or two) is a whip pan in waiting
    const reverses = (pts: Array<[number, number]>) => {
      const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist2(pts[k], pts[k - 1]));
      const hd = (k: number) => Math.atan2(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
      for (let k = 0; k < pts.length - 1; k++) {
        let turn = 0;
        for (let m = k + 1; m < pts.length - 1 && cum[m] - cum[k + 1] < 3; m++) { turn += wrapPi(hd(m) - hd(m - 1)); if (Math.abs(turn) > 135 * DEG) return true; }
      }
      return false;
    };
    // a room is seen when the walk goes through it, or when its focal item is in front of the eye (within 55° of the way it is
    // going), in the clear and within 6 m for a metre and a bit of the walk
    const seen = (pts: Array<[number, number]>) => {
      const s = visited(pts); const eyeL = lv.y + Math.min(1.5, lv.h - 0.35);
      const acc = new Map<WRoom, number>();
      for (let k = 0; k < pts.length - 1; k++) {
        const L = dist2(pts[k], pts[k + 1]), n = Math.max(1, Math.ceil(L / 0.3)), hd = Math.atan2(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
        for (let u = 0; u < n; u++) {
          const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u / n, z = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u / n;
          for (const r of lv.rooms) {
            if (s.has(r) || (interestOf.get(r)?.interest || 0) < 0.5) continue;
            const f = interestOf.get(r)!.focal, fx = f ? f.at[0] : r.b.x + r.b.w / 2, fz = f ? f.at[1] : r.b.z + r.b.d / 2;
            if (Math.hypot(fx - x, fz - z) > 6 || Math.abs(wrapPi(Math.atan2(fx - x, fz - z) - hd)) > 55 * DEG) continue;
            if (probe.clear([x, eyeL, z], [fx, lv.y + 1.0, fz])) acc.set(r, (acc.get(r) || 0) + L / n);
          }
        }
      }
      for (const [r, m] of acc) if (m >= 1.3) s.add(r);
      return s;
    };
    const scoreOf = (w: { pts: Array<[number, number]>; len: number }) => { let s = 0; for (const r of seen(w.pts)) s += (interestOf.get(r)?.interest || 0) * (topSet.has(r) ? 1.5 : 1); return s - (routeMode === 'scenic' ? 0.04 : 0.08) * w.len - 0.5 * Math.max(0, doorsOf(w.pts) - 3); };
    let best = base, bs = scoreOf(base);
    if (scenic && routeMode !== 'shortest' && !forced.length) {
      const already = seen(base.pts);
      const cands = lv.rooms.filter(r => !already.has(r) && ((interestOf.get(r)?.interest || 0) >= 0.7 || topSet.has(r))).sort((x, y) => ((topSet.has(y) ? 1 : 0) - (topSet.has(x) ? 1 : 0)) || (interestOf.get(y)!.interest - interestOf.get(x)!.interest) || x.no.localeCompare(y.no)).slice(0, 5);
      for (const r of cands) {
        const vp = nav.visitPoint(lv.id, r); if (!vp) continue;
        const w = walk([a, vp, b]);
        if (!w || w.len - base.len > Math.min(budgetM, 0.9 * base.len + 3) || reverses(w.pts)) continue;
        const s = scoreOf(w);
        if (s > bs + 1e-9) { bs = s; best = w; }
      }
    }
    return { ...best, rooms: [...seen(best.pts)].map(r => r.name) };
  };

  // ---- 4. the finale's approach: chosen with the walk that reaches it -----------------------------------------
  const yA = heroLv.y + Math.min(1.42, heroLv.h - 0.35);
  type Fin = { dir: number; from: number; to: number; arc: number; arcTotal: number; P: V3; S: V3; bez: V3[]; score: number; sound: boolean; swing: number; circling: number; turning: number; sharp: number; face: number; faceWorst: number; walk: Array<[number, number]>; walkLen: number; rooms: string[] };
  const smoothU = (u: number) => u * u * (3 - 2 * u);
  /** the orbit checked every 1° along its own eye-height profile (the 5° free map can step over a chair back): the furthest
   *  angle it is free and the Core in full view to, less 2° — the sweep's own end when all of it is, null when its start is not */
  const verifyArc = (from: number, to: number, dir: number, r: number): number | null => {
    const n = Math.max(1, Math.ceil(Math.abs(to - from)));
    let last = from;
    for (let k = 0; k <= n; k++) {
      const u = k / n, deg = from + (to - from) * u, h = hs[0] + (hs[1] - hs[0]) * (0.5 - 0.5 * Math.cos(Math.PI * u)), p = orbitPt(deg, centre[1] + h, r);
      if (!orbitProbe.free(p[0], p[1], p[2]) || !orbitProbe.sees(p[0], p[1], p[2])) return k === 0 ? null : (last - from) * dir > 2 ? last - dir * 2 : null;
      last = deg;
    }
    return to;
  };
  /** the push-in: P → S as a curve that arrives ALONG the orbit (its tangent at S), leaving P the way the walk was going —
   *  no kink where the orbit starts. Null when the curve is not clear (the caller falls back to the straight chord). */
  const pushIn = (P: V3, S: V3, arrive: V3, dir: number, fromDeg: number): V3[] | null => {
    const ch = Math.hypot(S[0] - P[0], S[2] - P[2]); if (ch < 0.3) return null;
    const a0 = fromDeg * DEG, f = hero.fwd, sd = [f[1], -f[0]];
    const tan = norm([dir * (-Math.sin(a0) * f[0] + Math.cos(a0) * sd[0]), 0, dir * (-Math.sin(a0) * f[1] + Math.cos(a0) * sd[1])]);
    const clearPts = (out: V3[]) => { for (let k = 1; k < out.length - 1; k++) { const q = out[k]; if (!orbitProbe.free(q[0], q[1], q[2]) || (k % 3 === 0 && !orbitProbe.sees(q[0], q[1], q[2]))) return false; } return true; };
    // a cubic Bézier from P (leaving the way the walk was going) to S (arriving along the orbit): handles of 42 % of the chord,
    // shorter or lopsided where the first does not clear the furniture round the Core
    for (const [k1, k2] of [[0.42, 0.42], [0.3, 0.3], [0.5, 0.25], [0.25, 0.5], [0.18, 0.18]]) {
      const h1 = k1 * ch, h2 = k2 * ch;
      const c1: V3 = [P[0] + arrive[0] * h1, P[1], P[2] + arrive[2] * h1], c2: V3 = [S[0] - tan[0] * h2, S[1], S[2] - tan[2] * h2];
      const n = Math.max(8, Math.ceil(ch / 0.05));
      const out: V3[] = [];
      for (let k = 0; k <= n; k++) { const u = k / n, w = 1 - u; out.push([w * w * w * P[0] + 3 * w * w * u * c1[0] + 3 * w * u * u * c2[0] + u * u * u * S[0], P[1] + (S[1] - P[1]) * smoothU(u), w * w * w * P[2] + 3 * w * w * u * c1[2] + 3 * w * u * u * c2[2] + u * u * u * S[2]]); }
      if (clearPts(out)) return out;
    }
    // failing that: the chord to a point on the orbit's tangent 0.4 m before S, then along it — the corner is rounded by
    // the path's smoothing, and the orbit is met along its own direction
    const lead = Math.min(0.4, 0.5 * ch), Q: V3 = [S[0] - tan[0] * lead, lerp3(P, S, 1 - lead / ch)[1], S[2] - tan[2] * lead];
    const out: V3[] = [];
    for (const [a, b] of [[P, Q], [Q, S]] as Array<[V3, V3]>) { const m = Math.max(2, Math.ceil(len(sub(b, a)) / 0.05)); for (let k = out.length ? 1 : 0; k <= m; k++) out.push(lerp3(a, b, k / m)); }
    return clearPts(out) ? out : null;
  };
  let finaleCands: any[] = [], finaleAll: any[] = [], bestReachable = 0;
  // swing (QA's orbit-swing-back): degrees the eye travels round the Core AGAINST the sweep over the last 4 m of the walk
  // and the push-in, while the Core is in view — within 4.5 m of the eye and within ±40° of where the eye is heading
  // (the walk through the next room, the Core behind a wall, is only a walk). `circling` is the same without the
  // in-view condition, within 3.2 m: the eye going round the Core one way and the sweep bringing it back the other.
  const swingOf = (pts: Array<[number, number]>, bez: V3[], dir: number) => {
    const path2: Array<[number, number]> = [...pts, ...bez.slice(1).map(q => [q[0], q[2]] as [number, number])];
    let swing = 0, circling = 0, accL = 0, turning = 0, prevHd: number | null = null;
    for (let q = path2.length - 1; q > 0 && accL < 3.4 + polyLen(bez); q--) {
      const a = path2[q - 1], b = path2[q], L = dist2(a, b); accL += L;
      if (L < 1e-6) continue;
      { const hd0 = Math.atan2(b[0] - a[0], b[1] - a[1]); if (prevHd !== null) turning += Math.abs(wrapPi(hd0 - prevHd)) / DEG; prevHd = hd0; }
      const da = wrapPi((heroAngle(b[0], b[1]) - heroAngle(a[0], a[1])) * DEG) / DEG;
      const hd = Math.atan2(b[0] - a[0], b[1] - a[1]), toCore = Math.atan2(centre[0] - a[0], centre[2] - a[1]), dC = Math.hypot(centre[0] - a[0], centre[2] - a[1]);
      if (dC < 4.5 && Math.abs(wrapPi(toCore - hd)) < 40 * DEG) swing += Math.max(0, -dir * da);
      if (dC < 3.2) circling += Math.max(0, -dir * da);   // (the eye looks at the Core from there: QA's measure)
    }
    // the sharpest turn the eye makes inside 1.2 m of walking, over the whole approach (the last 8 m): a tight U-turn cannot be looked round at the view's turn rate
    let sharp = 0;
    { const cum: number[] = [0]; for (let q = 1; q < path2.length; q++) cum.push(cum[q - 1] + dist2(path2[q], path2[q - 1]));
      const total = cum[cum.length - 1], hd = (q: number) => Math.atan2(path2[q + 1][0] - path2[q][0], path2[q + 1][1] - path2[q][1]);
      for (let q = 0; q < path2.length - 2; q++) { if (total - cum[q] > 8) continue; let turn = 0; for (let m = q + 1; m < path2.length - 1 && cum[m] - cum[q] < 1.2; m++) { turn += wrapPi(hd(m) - hd(m - 1)); sharp = Math.max(sharp, Math.abs(turn) / DEG); } } }
    return { swing, circling, turning, sharp };
  };
  // the Core's place in the finale's frame, seeded by the house (it is on the orbit's side once the sweep's direction is known, below)
  const compose = { ndcX: 0, ndcY: -0.2 };
  let composeVertical = false;   // (the Core on a vertical thirds line: its height in the frame is free)
  {
    const r7 = mulberry32(fnv1a(`${world.id}:compose`));
    // the Core's final place in the frame: on a thirds line — the vertical one (x ±⅓, y seeded) or the horizontal
    // (y −⅓, x seeded) — so the fleet's finales do not all end on one frame (plan §3.14: ≥ 20 distinct)
    const vertical = r7() < 0.55; composeVertical = vertical;
    compose.ndcY = vertical ? +(-0.55 + r7() * 0.65).toFixed(3) : -1 / 3;
    compose.ndcX = vertical ? 1 / 3 : +(0.08 + r7() * 0.48).toFixed(3);
  }
  // the frames of the orbit that are blank (§3.11, §3.13: the finale's background is not a bare wall — 60 % of the frame's rays on one plane within 1.5 m): per 5° of the sweep, at the orbit's own radius and height,
  // looking at the Core on the middle lens
  const blankMemo = new Map<string, boolean>();
  const isBlankAt = (deg: number, dir: number) => {
    const k = Math.round(deg / 5), key = `${k}:${dir}`; let v = blankMemo.get(key);
    if (v === undefined) { const p = orbitPt(k * 5, centre[1] + (hs[0] + hs[1]) / 2, orbit ? orbit.r : 1.05), tg = composeTarget(p, centre, 46, [-dir * Math.abs(compose.ndcX), compose.ndcY]); v = probe.composition(camera(p, tg, 46), false, 1.5).share(1.5) >= 0.6; blankMemo.set(key, v); }
    return v;
  };
  const blankDeg = (from: number, to: number, dir: number) => { let n = 0; for (let d = from; (to - d) * dir >= 0; d += dir * 5) if (isBlankAt(d, dir)) n += 5; return n; };
  const finaleFrom = (start: [number, number], budgetM: number): Fin | null => {
    if (!orbit) return null;
    const cands: Array<Pick<Fin, 'dir' | 'from' | 'to' | 'arc' | 'arcTotal' | 'P' | 'S'> & { Dd: number }> = [];
    const tried = new Set<string>();
    const g = nav.grid(heroLv);
    for (const opt of orbit.options) {
      for (let from = opt.from; ; from += opt.dir * 10) {
        const sw0 = sweepFrom(orbit.run, opt.dir, from, sweepOpt);
        if (!sw0 || sw0.arc < 45 - 1e-6) break;
        const toV = verifyArc(sw0.from, sw0.to, sw0.dir, orbit.r);
        if (toV === null) { if (Math.abs(from - opt.from) > 150) break; continue; }
        const sw = { ...sw0, to: toV, arc: (toV - sw0.from) * sw0.dir };
        if (sw.arc < 45 - 1e-6) { if (Math.abs(from - opt.from) > 150) break; continue; }
        // P is where the walk ends: 0–70° BEHIND the sweep's start (before it, in the sweep's own direction), 1.5–2.1 m
        // out — the push-in is a spiral in that carries on the way round (to the Core's front), never doubling back
        for (const d of [-70, -55, -40, -25, -12, 0]) for (const Dd of [2.1, 1.8, 1.5, 1.25]) {
          if (Dd < orbit.r + (Dd < 1.4 ? 0.35 : 0.45)) continue;
          const key = `${sw.dir}:${sw.from}:${d}:${Dd}`; if (tried.has(key)) continue; tried.add(key);
          const P = orbitPt(sw.from + sw.dir * d, yA, Dd);
          const S = orbitPt(sw.from, centre[1] + hs[0], orbit.r);
          if (!nav.passableAt(g, P[0], P[2], 3) || !orbitProbe.free(P[0], P[1], P[2]) || !orbitProbe.sees(P[0], P[1], P[2])) continue;
          let clear = true; const nS = Math.ceil(len(sub(S, P)) / 0.08);
          for (let k = 1; k < nS && clear; k++) { const q = lerp3(P, S, k / nS); clear = orbitProbe.free(q[0], q[1], q[2]) && (k % 3 !== 0 || orbitProbe.sees(q[0], q[1], q[2])); }
          if (!clear) continue;
          cands.push({ dir: sw.dir, from: sw.from, to: sw.to, arc: sw.arc, arcTotal: sw.arc - d, P, S, Dd });
        }
        if (Math.abs(from - opt.from) > 150) break;
      }
    }
    // score each with the walk that reaches it: the sweep first (its length: ≥ 90° pays, ≥ 120° pays more), then the swing
    // (the eye circling the Core against the sweep in the 4.5 m before it, the Core in view: over 12° costs more than
    // the arc it buys), the way the walk arrives (facing the Core), the walk's length
    const scored: Fin[] = [];
    const walks = new Map<string, any>();
    // keep the work bounded: the longest sweeps first, at most 90
    cands.sort((x, y) => y.arcTotal - x.arcTotal || x.from - y.from || x.P[0] - y.P[0] || x.P[2] - y.P[2]);
    // Two ways to P: the walk's own shortest (which may go round the Core on the way), and a walk to a waypoint W 1.6 m further
    // out on the line from the Core through P, then straight in along that line — the eye arrives from the direction P is in,
    // so the only circling it does is the sweep's own
    const radialWalk = (P: V3): { pts: Array<[number, number]>; len: number; rooms: string[] } | null => {
      const ux = P[0] - centre[0], uz = P[2] - centre[2], ul = Math.hypot(ux, uz) || 1;
      for (const back of [1.8, 1.4, 1.0]) {
        const W: [number, number] = [P[0] + ux / ul * back, P[2] + uz / ul * back];
        if (!nav.passableAt(g, W[0], W[1], 3) || !inFootprint(heroLv.rects, W[0], W[1], 0.3)) continue;
        // (the way in is clear at the eye's height, the Core in sight from a metre out)
        let clear = true; for (let q = 0; q <= 10 && clear; q++) { const px = W[0] + (P[0] - W[0]) * q / 10, pz = W[1] + (P[2] - W[1]) * q / 10; clear = orbitProbe.free(px, P[1], pz) && (q % 3 !== 0 || orbitProbe.sees(px, P[1], pz)); }
        if (!clear) continue;
        const w0 = storeyWalk(heroLv, start, W, budgetM, false); if (!w0) continue;
        // (the way in from W must not double back on the walk to it: a walk that passes P to reach W and comes back is a U-turn, the
        // eye moving away from the Core with its look on it — QA's `reverse`)
        { const a0 = w0.pts.length > 1 ? w0.pts[w0.pts.length - 2] : start, hw = Math.atan2(W[0] - a0[0], W[1] - a0[1]), hp = Math.atan2(P[0] - W[0], P[2] - W[1]);
          if (Math.hypot(W[0] - a0[0], W[1] - a0[1]) > 0.05 && Math.abs(wrapPi(hp - hw)) > 100 * DEG) continue; }
        const pts: Array<[number, number]> = [...w0.pts, [P[0], P[2]]];
        return { pts, len: w0.len + back, rooms: w0.rooms };
      }
      return null;
    };
    for (const c of cands.slice(0, 90)) {
      const k = `${c.P[0].toFixed(2)},${c.P[2].toFixed(2)}`;
      let ws = walks.get(k);
      if (ws === undefined) { const plain = storeyWalk(heroLv, start, [c.P[0], c.P[2]], budgetM, false), rad = radialWalk(c.P); ws = [plain, rad].filter(Boolean); walks.set(k, ws); }
      for (const w of ws as any[]) {
      const pts: Array<[number, number]> = w.pts;
      const last = pts.length > 1 ? pts[pts.length - 2] : start;
      const arrive = norm([c.P[0] - last[0], 0, c.P[2] - last[1]]);
      const bez = pushIn(c.P, c.S, arrive, c.dir, c.from) || [c.P, c.S];
      const { swing, circling, turning, sharp } = swingOf(pts, bez, c.dir);
      // the way the walk faces the Core over its last 3.5 m: the view can be on the Core (never further than 65° off the way the eye goes) only where the Core is ahead — a walk that goes past it, or round it,
      // has the view on the room beside it when the room reveal (20°/s) and the push-in (15°/s) begin, and not enough turn left in them to get onto it
      let faceWorst = 0;
      { let acc = 0; for (let q = pts.length - 1; q > 0 && acc < 3.5; q--) { const a = pts[q - 1], b = pts[q], L = dist2(a, b); if (L < 1e-3) continue; acc += L; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; faceWorst = Math.max(faceWorst, Math.abs(wrapPi(Math.atan2(b[0] - a[0], b[1] - a[1]) - Math.atan2(centre[0] - mx, centre[2] - mz))) / DEG); } }
      // the walk should arrive facing the Core: the look can only turn to it at the push-in's pace
      const toCore = norm([centre[0] - c.P[0], 0, centre[2] - c.P[2]]), face = Math.acos(clamp(arrive[0] * toCore[0] + arrive[2] * toCore[2], -1, 1)) / DEG;
      // (the sweep counts from where the eye starts round the Core: the spiral in and the orbit)
      // a way in that is SOUND keeps the Core in the frame all the way and the eye from circling it against the sweep: the walk faces it within 90° where the push-in begins and within 118° over the last
      // 3.5 m (the look can turn onto it at the room reveal's 20°/s and the push-in's 15 from there, never from further round: the crab cap lets it point 65° off the way the eye goes, and the frame holds the Core 45° either side of that), and the swing is QA's `orbit-swing-back` line (20°). An unsound way in
      // loses to any sound one whatever its sweep (a 135° orbit reached by walking past the Core and back at it is a 3 s film of a bookcase and a decoy, vanilla at 1.05 m), and an orbit of 90°
      // or more beats one that is shorter wherever a sound way in to it exists (the owner's brief): its bonus is more than the walk's turning, circling and blank frames cost together
      const sound = swing <= 20 && face <= 90 && faceWorst <= 118;
      const score = 3.0 * Math.min(c.arc, 120) + 0.6 * Math.min(c.arcTotal - c.arc, 60) + (c.arc >= 90 ? 150 : 0) + (c.arc >= 120 ? 10 : 0) - 4 * Math.max(0, swing - 10) - (swing > 20 ? 60 : 0) - 2 * Math.max(0, circling - 20) - 0.5 * w.len - 1.0 * Math.max(0, face - 40) - 0.7 * Math.max(0, turning - 150) - 0.5 * Math.max(0, turning - 220) - 1.6 * Math.max(0, sharp - 100) - (c.Dd < 1.4 ? 10 : 0) - 1.2 * Math.max(0, faceWorst - 70) - 0.8 * blankDeg(c.from, c.to, c.dir) - (sound ? 0 : 400);
      scored.push({ ...c, bez, score, sound, swing, circling, turning, sharp, face, faceWorst, walk: pts, walkLen: w.len, rooms: w.rooms });
      }
    }
    scored.sort((x, y) => y.score - x.score || x.from - y.from);
    bestReachable = scored.filter(c => c.swing <= 20).reduce((m, c) => Math.max(m, c.arc), 0);
    finaleAll = scored.map(c => ({ dir: c.dir, from: c.from, arc: c.arc, total: c.arcTotal, swing: +c.swing.toFixed(1), circ: +c.circling.toFixed(1), turn: +c.turning.toFixed(0), sharp: +c.sharp.toFixed(0), walkLen: +c.walkLen.toFixed(1), face: +c.face.toFixed(0), faceWorst: +c.faceWorst.toFixed(0), sound: c.sound, score: +c.score.toFixed(0) }));
    finaleCands = scored.slice(0, 8).map(c => ({ dir: c.dir, from: c.from, arc: c.arc, total: c.arcTotal, swing: +c.swing.toFixed(1), turn: +c.turning.toFixed(0), sharp: +c.sharp.toFixed(0), walkLen: +c.walkLen.toFixed(1), face: +c.face.toFixed(0), faceWorst: +c.faceWorst.toFixed(0), sound: c.sound, score: +c.score.toFixed(0) }));
    const top = scored[0];
    if (!top) return null;
    // the walk to the chosen approach again, this time through a room worth seeing on the way if one pays: kept when the
    // way it arrives is no worse
    const sc = storeyWalk(heroLv, start, [top.P[0], top.P[2]], budgetM, true);
    if (sc && sc.len > top.walkLen + 0.3) {
      const last2 = sc.pts.length > 1 ? sc.pts[sc.pts.length - 2] : start, arrive2 = norm([top.P[0] - last2[0], 0, top.P[2] - last2[1]]);
      const bez2 = pushIn(top.P, top.S, arrive2, top.dir, top.from) || [top.P, top.S], sw2 = swingOf(sc.pts, bez2, top.dir);
      if (sw2.swing <= Math.max(top.swing + 3, 10) && sw2.circling <= top.circling + 15 && sw2.sharp <= Math.max(top.sharp + 15, 100)) return { ...top, bez: bez2, swing: sw2.swing, circling: sw2.circling, turning: sw2.turning, sharp: sw2.sharp, walk: sc.pts, walkLen: sc.len, rooms: sc.rooms };
    }
    return top;
  };

  // ---- 5. assemble the walk: storey by storey, flight by flight -----------------------------------------------
  let cur: [number, number] = [I0[0], I0[2]], curLv = Le;
  const walkPts: Array<{ p: V3; beat: Beat; level: string }> = [];
  const pushWalk = (pts: Array<[number, number]>, lv: WLevel, beat: Beat) => { for (const q of pts) walkPts.push({ p: [q[0], eyeY(lv), q[1]], beat, level: lv.id }); };
  const flightSegs: Seg[] = [];
  const routeRooms: string[] = [];
  const budget = opts.inside ? 16 : 9;   // metres a detour may add, at most (a tour goes further out of its way)
  for (const [fi, fl] of flights.entries()) {
    const st = fl.st, lvFrom = nav.levelOf(fl.up ? st.from : st.to), lvTo = nav.levelOf(fl.up ? st.to : st.from);
    // climb: from the foot (1.2 m back on the flight's axis) up the centreline to the landing 0.8 m past the top.
    // descend: from 1.1 m back of the top on the upper floor, down to 0.9 m past the bottom.
    const dir = st.dir;
    const spiral = st.spiral;
    let entryPt: [number, number], exitPt: [number, number], flightPts: V3[] = [];
    if (!spiral) {
      // the walking line: S2's `path` for a flight that turns (an L on a landing, a U), else the straight line first step → last
      const line: Array<[number, number, number]> = st.path && st.path.length >= 2 ? st.path : [st.bottom, st.top];
      const bottom = line[0], top = line[line.length - 1], dir0 = st.dir0 || dir;
      const footUp: [number, number] = [bottom[0] - dir0[0] * 1.2, bottom[2] - dir0[1] * 1.2], landUp: [number, number] = [top[0] + dir[0] * 0.8, top[2] + dir[1] * 0.8];
      const rise = top[1] - bottom[1];
      // the line resampled evenly along its length in plan (a landing is flat: the eye keeps its height over it)
      const cum: number[] = [0]; for (let k = 1; k < line.length; k++) cum.push(cum[k - 1] + Math.hypot(line[k][0] - line[k - 1][0], line[k][2] - line[k - 1][2]));
      const run = cum[cum.length - 1] || 1e-6;
      const lineAt = (u: number): V3 => {
        const d = clamp(u, 0, 1) * run; let k = 1; while (k < line.length - 1 && cum[k] < d) k++;
        const f = cum[k] > cum[k - 1] ? clamp((d - cum[k - 1]) / (cum[k] - cum[k - 1]), 0, 1) : 0;
        return [line[k - 1][0] + (line[k][0] - line[k - 1][0]) * f, line[k - 1][1] + (line[k][1] - line[k - 1][1]) * f, line[k - 1][2] + (line[k][2] - line[k - 1][2]) * f];
      };
      // the eye over the tread at u of the run, `off` above it — but under the upper storey's slab (where there is no
      // void over the flight) never higher than 0.35 m under that slab: it crouches under the slab's edge and rises
      // once the void opens overhead (§3.8)
      const upper = world.levels.find(l => l.id === st.to)!;
      const NU = st.path ? Math.max(48, Math.ceil(run / 0.09)) : 48;
      const us = Array.from({ length: NU + 1 }, (_, k) => k / NU);
      const xz = (u: number): [number, number] => { const q = lineAt(u); return [q[0], q[2]]; };
      const underSlab = (u: number) => { const [x, z] = xz(u); return upper.rects.some(r => inRect(x, z, r, 0.1)) && !upper.voids.some(v => inRect(x, z, v, -0.12)); };
      const ys = us.map(u => lineAt(u)[1] + (fl.up ? 1.55 : 1.6));
      // the slab is [upper.y − 0.3, upper.y]: where the flight runs under it, the eye stays out of that band — under it
      // while the tread is low enough to stand under it, over it (the landing's floor) once the tread nears the top
      for (let k = 0; k <= NU; k++) {
        if (!underSlab(us[k]) || ys[k] <= upper.y - 0.38 || ys[k] >= upper.y + 0.12) continue;
        const tread = lineAt(us[k])[1];
        ys[k] = tread + 1.1 <= upper.y - 0.38 ? upper.y - 0.38 : Math.max(ys[k], upper.y + 0.12);
      }
      // (a step in that profile is ramped over the run on the free side of it: never more than 1.2 m of height per
      // metre of run beyond the flight's own slope)
      for (let k = 1; k <= NU; k++) if (!underSlab(us[k])) ys[k] = Math.min(ys[k], ys[k - 1] + 1.2 * run / NU + rise / NU);
      const along = (u: number): V3 => { const k = Math.round(u * NU); const [x, z] = xz(k / NU); return [x, ys[k], z]; };
      const N = NU;
      if (fl.up) {
        entryPt = footUp; exitPt = landUp;
        flightPts = [[footUp[0], eyeY(lvFrom), footUp[1]]];
        for (let k = 0; k <= N; k++) flightPts.push(along(k / N));
        flightPts.push([landUp[0], eyeY(lvTo), landUp[1]]);
      } else {
        const topBack: [number, number] = [top[0] + dir[0] * 1.1, top[2] + dir[1] * 1.1], botOut: [number, number] = [bottom[0] - dir0[0] * 0.9, bottom[2] - dir0[1] * 0.9];
        entryPt = topBack; exitPt = botOut;
        flightPts = [[topBack[0], eyeY(lvFrom), topBack[1]]];
        for (let k = N; k >= 0; k--) flightPts.push(along(k / N));
        flightPts.push([botOut[0], eyeY(lvTo), botOut[1]]);
      }
    } else {
      // a spiral: a helix round the column at the void's radius less 0.3 m (§3.8), 300° over the climb. The eye steps onto it from
      // clear floor outside the stair's own footprint (the nav keeps that blocked) on the side it comes from, and steps off it to
      // clear floor on the other storey, outside the void it climbs through
      const c = st.bottom; const vd = (world.levels.find(l => l.id === st.to)?.voids || []).find(v => inRect(c[0], c[2], v, 0.5));
      const R = Math.max(0.55, Math.min(1.1, vd ? Math.min(vd.w, vd.d) / 2 - 0.3 : 0.8));
      const rise = st.top[1] - st.bottom[1], N = 30;
      // the helix follows the treads as built (their first angle and how far they turn), else 300° from the side the eye comes from
      const rOut = Math.max(st.plan.maxX - st.plan.minX, st.plan.maxZ - st.plan.minZ) / 2 + 0.55;
      const at = (a: number, r: number): [number, number] => [c[0] + Math.sin(a) * r, c[2] + Math.cos(a) * r];
      const aCur = Math.atan2(cur[0] - c[0], cur[1] - c[2]);
      const sweep = st.spin ? st.spin.sweep : 300 * DEG;
      const aB = st.spin ? st.spin.a0 : fl.up ? aCur : aCur - sweep;   // the helix's angle at its foot
      const ang = (u: number) => aB + sweep * u;
      const pt = (u: number): V3 => [c[0] + Math.sin(ang(u)) * R, c[1] + rise * u + 1.5, c[2] + Math.cos(ang(u)) * R];
      // the treads overhead: on the lower floor the eye (1.6 m up) passes under treads for the first turn, so it only ever walks
      // round the column through the sector behind the first tread (where the treads' next turn is still a storey up) — never through
      // the angles the treads wind over, where a tread stands at eye height
      const sigma = -Math.sign(sweep) || 1, freeDa = [0, 25, 50, 75, 100, -25, -50, -75].map(d => d * sigma), sideDa = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180];
      const lvExit = nav.levelOf(fl.up ? st.to : st.from), gx = nav.grid(lvExit), aEnd = fl.up ? ang(1) : ang(0);
      const wallBetween2 = (a: [number, number], b: [number, number], y: number) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-3) return false; return !!index.raycast(a[0], y, a[1], (b[0] - a[0]) / L, 0, (b[1] - a[1]) / L, L, k => k === K.wall || k === K.glass || k === K.rail); };
      // the step-off: the first of the angles round the end of the helix whose point, out past the void (upper) or the stair's footprint (lower), is clear floor
      const stepOff = (): [number, number] => {
        for (const da of fl.up ? sideDa : [...freeDa, ...sideDa]) for (let r = fl.up ? R + 0.45 : rOut; r < 4.5; r += 0.15) {
          const q = at(aEnd + da * DEG, r);
          if (fl.up && lvExit.voids.some(v => inRect(q[0], q[1], v, 0.4))) continue;
          if (nav.passableAt(gx, q[0], q[1], 1) && !wallBetween2(at(aEnd + da * DEG, R), q, eyeY(lvExit))) return q;
        }
        return at(aEnd, rOut);
      };
      // the step-on: clear floor outside the stair's footprint, at the first tread's side (up: through the free sector) or the top's (down)
      const gFrom = nav.grid(lvFrom), aOn = fl.up ? ang(0) : ang(1), rOn = fl.up ? rOut : Math.max(rOut, (vd ? Math.hypot(vd.w, vd.d) / 2 : 1.4) + 0.3);
      // (and the way in to the helix's radius from it is not through a wall: a stair may stand in an alcove one door wide)
      const yFrom = eyeY(lvFrom), wallBetween = (a: [number, number], b: [number, number], y: number) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-3) return false; const h = index.raycast(a[0], y, a[1], (b[0] - a[0]) / L, 0, (b[1] - a[1]) / L, L, k => k === K.wall || k === K.glass || k === K.rail); return !!h; };
      const onAt = (() => {
        for (const da of fl.up ? [...freeDa, ...sideDa] : sideDa) { const q = at(aOn + da * DEG, rOn); if (nav.passableAt(gFrom, q[0], q[1], 1) && !(!fl.up && lvFrom.voids.some(v => inRect(q[0], q[1], v, 0.3))) && !wallBetween(q, at(aOn + da * DEG, R), yFrom)) return q; }
        return at(aOn, rOn);
      })();
      const foot: [number, number] = onAt;
      const off = stepOff();
      // the walk round the column between the foot and the helix (or the helix and the step-off) at floor height, at the helix radius: an arc
      // (a tread stands at eye height where the treads' height over the floor is about 1.6 m: the way round that avoids those angles)
      const hazard = (a: number) => { const rel = wrapPi(a - ang(0)), t = rel / sweep; return t >= -0.02 && t <= 1.02 && Math.abs(rise * clamp(t, 0, 1) - 1.6) < 0.3; };
      // (in to the helix's radius first, then round it: a partition may stand a metre from the column, and the helix's radius keeps clear of it)
      const aroundTo = (a1: number, a2: number, y: number): V3[] => {
        const d1 = wrapPi(a2 - a1), d2 = d1 - (Math.sign(d1) || 1) * 2 * Math.PI;
        const bad = (d: number) => { for (let k = 0; k <= 40; k++) if (hazard(a1 + d * k / 40)) return true; return false; };
        const d = !bad(d1) ? d1 : !bad(d2) ? d2 : d1, n = Math.max(1, Math.ceil(Math.abs(d) / (18 * DEG))), out: V3[] = [];
        for (let k = 0; k <= n; k++) { const q = at(a1 + d * k / n, R); out.push([q[0], y, q[1]]); }
        return out;
      };
      const seq: V3[] = []; for (let k = 0; k <= N; k++) seq.push(pt(fl.up ? k / N : 1 - k / N));
      entryPt = foot; exitPt = off;
      const aFoot = Math.atan2(foot[0] - c[0], foot[1] - c[2]), aOff = Math.atan2(off[0] - c[0], off[1] - c[2]);
      flightPts = fl.up
        ? [[foot[0], eyeY(lvFrom), foot[1]], ...aroundTo(aFoot, ang(0), eyeY(lvFrom)), ...seq, [off[0], eyeY(lvTo), off[1]]]
        : [[foot[0], eyeY(lvFrom), foot[1]], ...seq, ...aroundTo(ang(0), aOff, eyeY(lvTo)), [off[0], eyeY(lvTo), off[1]]];
    }
    // the walk to the flight on this storey
    const w = storeyWalk(curLv, cur, entryPt, fi === 0 ? budget : budget * 0.5);
    if (!w) return fail('route-failed', `no way from ${curLv.id} [${cur.map(v => v.toFixed(1))}] to the ${fl.up ? 'foot' : 'top'} of the flight to ${lvTo.id}`);
    pushWalk(w.pts, curLv, 'route'); routeRooms.push(...w.rooms);
    flightSegs.push({ beat: fl.up ? 'stair' : 'descend', pts: flightPts, level: lvFrom.id, flight: fi, exact: true });
    walkPts.push({ p: [NaN, NaN, NaN], beat: fl.up ? 'stair' : 'descend', level: String(fi) });   // marker: the flight goes here
    cur = exitPt; curLv = lvTo;
  }
  // the last storey: to the finale's approach
  // the finale: over the orbit plans (radii and eye heights) in the order they rank, the first whose way in is sound and whose sweep is 90° or more; where none is, the best of those tried (at most 5, the ones the first pass of
  // plans did not hold evaluated as they are asked for) — a plan whose own free run cannot beat a sound one in hand by 10° is not tried
  let fin: Fin | null = null;
  const triedLog: any[] = [];
  {
    const startPt = cur, budgetM = budget * (flights.length ? 0.6 : 1);
    let pick: { plan: OrbitPlan; fin: Fin; total: number; reach: number; cands: any[]; all: any[] } | null = null, tried = 0;
    const done = new Set<OrbitPlan>(), freeArc = (p: OrbitPlan) => Math.max(...p.options.map((o: any) => o.arc));
    while (tried < 5 && !(pick && pick.fin.sound && pick.fin.arc >= 90)) {
      const plan = orbitPlans.filter(p => !done.has(p) && !(pick && pick.fin.sound && freeArc(p) < pick.fin.arc + 10)).sort((x, y) => y.score - x.score || x.r - y.r)[0];
      if (!plan) { if (moreOrbitPlans()) continue; break; }
      done.add(plan); orbit = plan; hs = plan.hs; blankMemo.clear(); tried++;
      const f = finaleFrom(startPt, budgetM);
      triedLog.push({ r: +plan.r.toFixed(2), hs: plan.hs, lens: plan.lens, rscore: +plan.rscore.toFixed(0), freeArc: freeArc(plan), arc: f ? f.arc : null, sound: f ? f.sound : null, score: f ? +f.score.toFixed(0) : null, face: f ? +f.face.toFixed(0) : null, faceWorst: f ? +f.faceWorst.toFixed(0) : null, swing: f ? +f.swing.toFixed(1) : null });
      if (!f) continue;
      const total = f.score + plan.rscore;
      if (!pick || (f.sound && !pick.fin.sound) || (f.sound === pick.fin.sound && total > pick.total + 1e-9)) pick = { plan, fin: f, total, reach: bestReachable, cands: finaleCands, all: finaleAll };
    }
    if (pick) { orbit = pick.plan; hs = pick.plan.hs; fin = pick.fin; bestReachable = pick.reach; finaleCands = pick.cands; finaleAll = pick.all; if (tried > 1) notes.push(`the orbit runs at ${pick.plan.r.toFixed(2)} m, eye ${pick.plan.hs[1].toFixed(2)} m over the Core: ${tried} plans were tried`); }
    else if (orbitPlans.length) { orbit = orbitPlans[0]; hs = orbit.hs; }
  }
  let finalWalk;
  if (fin) finalWalk = { pts: fin.walk, rooms: fin.rooms };
  else {
    // no orbit (nothing round the Core free at any radius): walk to the ring's best viewpoint and hold there
    notes.push('no free arc round the Core: the finale is a push-in to the hero ring');
    // (hero.view names its eye: the push-in goes there when it can)
    const ring = heroRing(world, probe, orbitProbe, HV ? { view: typeof HV.azimuth === 'number' ? HV : undefined, radii: typeof HV.dist === 'number' ? [HV.dist] : undefined, heights: typeof HV.height === 'number' ? [HV.height] : undefined } : {});
    const P = ring.length ? ring[0].eye : [centre[0] + hero.fwd[0] * 1.6, yA, centre[2] + hero.fwd[1] * 1.6] as V3;
    const back: V3 = [P[0] + (P[0] - centre[0]) * 0.8, yA, P[2] + (P[2] - centre[2]) * 0.8];
    const w = storeyWalk(Lh, cur, [back[0], back[2]], budget);
    if (!w) return fail('route-failed', `no way to the Core on ${Lh.id}`);
    finalWalk = { pts: w.pts, rooms: w.rooms, ring: ring[0] || null, P };
  }
  // (the walk's last leg to the push-in — the straight run in from the waypoint on the line out from the Core — is not a leg of storeyWalk: a doorway it crosses gets its funnel here)
  pushWalk(funnelDoors(curLv, nav.grid(curLv), finalWalk.pts as Array<[number, number]>), curLv, 'route'); routeRooms.push(...finalWalk.rooms);

  // ---- 6. split the interior walk into its beats: reveal (the first 2 m in), route, roomReveal (into the Core's
  //         room, up to 2.5 m), with the flights between ------------------------------------------------------
  // walkPts is a list of points with flight markers; build per-piece polylines
  const pieces: Array<{ pts: V3[]; level: string } | { flight: number }> = [];
  let curPiece: V3[] = [I0];
  let pieceLv = Le.id;
  for (const w of walkPts) {
    if (Number.isNaN(w.p[0])) { pieces.push({ pts: curPiece, level: pieceLv }); pieces.push({ flight: +w.level }); curPiece = []; continue; }
    if (!curPiece.length || len(sub(curPiece[curPiece.length - 1], w.p)) > 1e-3) curPiece.push(w.p); pieceLv = w.level;
  }
  pieces.push({ pts: curPiece, level: pieceLv });
  // fillet each walked piece, keeping 0.25 m of clearance on the storey's grid
  const okOn = (lvId: string, c = 0.22) => { const g = nav.grid(nav.levelOf(lvId)); return (p: V3) => nav.clearance(g, p[0], p[2]) >= c; };
  for (const p of pieces) if ('pts' in p && p.pts.length > 2) p.pts = fillet(p.pts, 1.2, okOn(p.level), okOn(p.level, 0.12));

  // ---- 7. the finale's own segments: push-in, orbit, power ----------------------------------------------------
  const finaleSegs: Seg[] = [];
  // the hero beat (the push-in onto the orbit) keeps its 0.8 s floor: the look is on the Core before it starts (the
  // roomReveal's subject is the Core, weighted in from 135° round), and the yaw limiter says where it is not (QA beat-yaw)
  const heroFloor = BEAT_FLOOR.hero || 0.8;
  let orbitMeta: any = null, finalFov = LENS.hero, endPose: any = null;
  if (fin && orbit) {
    const r = orbit.r;
    // the end: where on its own side, 15–45° past the front, the ring frames the Core best at the orbit's radius
    const ring = heroRing(world, probe, orbitProbe, { only: az => Math.sign(az) === fin.dir && Math.abs(az) >= 15 && Math.abs(az) <= 60, radii: [r], heights: [hs[1] + centre[1] - core[4]], ndcY: compose.ndcY });
    let to = fin.to;
    // (only inside the free run, 15–45° past the front on the orbit's own side, and never shortening the sweep
    // below 90° or by more than 15°)
    const lo = orbit.run.full ? -180 : orbit.run.lo, hi = orbit.run.full ? 180 : orbit.run.hi;
    if (HV && typeof HV.azimuth === 'number') {
      const want = HV.azimuth, arcW = (want - fin.from) * fin.dir, wv = verifyArc(fin.from, want, fin.dir, r);
      if (want >= lo && want <= hi && Math.sign(want) === fin.dir && arcW > 20 && wv !== null && Math.abs(wv - want) < 1e-6) to = want; else notes.push(`hero.view.azimuth ${want}° is not reachable by the orbit (free run ${lo}…${hi}°): it ends at ${to}°`);
    } else
    for (const rp of ring) {
      const want = rp.az, arcW = (want - fin.from) * fin.dir;
      if (want < lo || want > hi || Math.sign(want) !== fin.dir) continue;
      if (arcW < Math.min(fin.arc, 90) || arcW < fin.arc - 8 || arcW > Math.max(fin.arc, 150)) continue;
      const wv = verifyArc(fin.from, want, fin.dir, r);
      if (wv === null || Math.abs(wv - want) > 1e-6) continue;
      to = want; break;
    }
    // one degree more where the run allows it (unless hero.view names the end): the orbit beat's first sample comes a sample after `from`,
    // so a sweep planned as 90° measures 89.9°
    if (!(HV && typeof HV.azimuth === 'number')) { const t2 = to + fin.dir; if (t2 >= lo && t2 <= hi) { const wv2 = verifyArc(fin.from, t2, fin.dir, r); if (wv2 !== null && Math.abs(wv2 - t2) < 1e-6) to = t2; } }
    const arc = (to - fin.from) * fin.dir;
    const S = orbitPt(fin.from, centre[1] + hs[0], r);
    // the push-in is the hero beat while it closes on the Core; where it turns to run round it (its tangential share of the way the eye goes over 0.85) it is the orbit's — the eye is circling the Core
    // from there, at the orbit's pace and yaw (45°/s), not creeping at the push-in's 0.4 m/s and 15°/s: a push-in that arrives along the orbit is the beat's whole 2–4 s otherwise
    {
      const bz = fin.bez; let split = bz.length - 1;
      if (bz.length > 3) {
        for (let k = 1; k < bz.length - 1; k++) {
          const vx = bz[k + 1][0] - bz[k - 1][0], vz = bz[k + 1][2] - bz[k - 1][2], rx = bz[k][0] - centre[0], rz = bz[k][2] - centre[2], vl = Math.hypot(vx, vz) || 1, rl = Math.hypot(rx, rz) || 1;
          if (Math.abs(vx * rz - vz * rx) / (vl * rl) > 0.85 && polyLen(bz.slice(0, k + 1)) >= 0.25) { split = k; break; }
        }
      }
      if (split < bz.length - 1) { finaleSegs.push({ beat: 'hero', pts: bz.slice(0, split + 1) }); finaleSegs.push({ beat: 'orbit', pts: bz.slice(split) }); }
      else finaleSegs.push({ beat: 'hero', pts: bz });
    }
    const orbitPts: V3[] = [];
    const nA = Math.max(8, Math.ceil(arc / 1));
    for (let k = 0; k <= nA; k++) { const u = k / nA, deg = fin.from + (to - fin.from) * u, h = hs[0] + (hs[1] - hs[0]) * (0.5 - 0.5 * Math.cos(Math.PI * u)); orbitPts.push(orbitPt(deg, centre[1] + h, r)); }
    finaleSegs.push({ beat: 'orbit', pts: orbitPts, exact: true });
    // power: the orbit carries on as it pushes in 4 %, still moving on the last frame (the press is on it): 11° where the probe
    // allows it, less where a wall stands 8° or 5° past the end, and a push-in only where it stands at once
    const powerAt = (extraDeg: number, dy: number, push: number) => { const out: V3[] = []; for (let k = 0; k <= 20; k++) { const u = k / 20; out.push(orbitPt(to + extraDeg * fin.dir * u, centre[1] + hs[1] + dy * u, r * (1 - push * u))); } return out; };
    // (the chair's share of the frame from an eye, the Core composed on `ndc`, at the finale's lens — clipped at the lens, so a chair back 0.3 m from the eye counts)
    const chairShareAt = (eye: V3, ndc: [number, number], fv = 46) => hero.chair ? boxFrameShare(camera(eye, composeTarget(eye, centre, fv, ndc), fv), hero.chair) : 0;
    const okPw = (pts: V3[]) => pts.every(p => orbitProbe.free(p[0], p[1], p[2]) && probe.coreSeen(p, core) >= 0.999);
    // (the power beat's carry-on sweep is for the chair too: palms ends 16° past the front, and 11° more carries the eye over the chair back — a fifth of the frame, then two fifths, where the orbit's end had a fifth)
    const chairAtEnd = chairShareAt(orbitPt(to, centre[1] + hs[1], r), [-fin.dir * Math.abs(compose.ndcX), compose.ndcY]);
    const chairOkPw = (pts: V3[]) => !hero.chair || chairShareAt(pts[pts.length - 1], [-fin.dir * Math.abs(compose.ndcX), compose.ndcY]) <= Math.max(0.1, chairAtEnd + 0.02);
    let powerPts: V3[] | null = null;
    // (the carry-on sweep leaves the eye inside the plan's ±65° of the Core's front — §3.11 — where the orbit ended inside it)
    // (and where there is little sweep left to carry on with, the push-in is more: the film ends in motion, QA's `last-second` — 2–30 cm in the last second)
    for (const [ex, push] of ([[11, 0.04], [8, 0.04], [5, 0.04], [3, 0.05], [0, 0.08]] as Array<[number, number]>).filter(([x]) => x === 0 || Math.abs(to + x * fin.dir) <= 65)) { const pw = powerAt(ex, -0.01, push); if (okPw(pw) && chairOkPw(pw)) { powerPts = pw; break; } }
    if (!powerPts) powerPts = powerAt(0, -0.01, 0.04);
    if (!okPw(powerPts)) powerPts = powerAt(0, 0.02, 0.02);
    finaleSegs.push({ beat: 'power', pts: powerPts, exact: true });
    const endEye = powerPts[powerPts.length - 1];
    finalFov = fovForCore(endEye, centre, core, CORE_H, CORE_HMAX - 0.015);   // (the frame composed on its thirds line measures a point or two over the Core on the axis)
    orbitMeta = { r, hs, reachable: bestReachable, roomArc: Math.max(0, ...orbitPlans.filter(p => p.lens <= LENS_HERO_MAX).map(p => Math.max(...p.options.map((o: any) => o.arc)))), pushIn: fin.bez.length > 2 ? 'curve' : 'chord', from: fin.from, to, arc, arcTotal: +(arc + (fin.arcTotal - fin.arc)).toFixed(0), chosenArc: fin.arc, bestArc: Math.max(...orbit.options.map((o: any) => o.arc)), dir: fin.dir, run: [orbit.run.lo, orbit.run.hi], full: orbit.run.full, swing: +Math.max(fin.swing, fin.circling).toFixed(1), options: orbit.options.map((o: any) => ({ dir: o.dir, from: o.from, to: o.to, arc: o.arc })) };
    compose.ndcX = Math.abs(compose.ndcX) * -fin.dir;
    // the Core on the other vertical third where that takes a chair that fills more than a tenth of the last frame out of it (the chair stands to one side of the Core in the frame: the Core on the side it is on
    // is a frame with a chair back in it, on the other the view has turned away from it)
    if (hero.chair) {
      const a = chairShareAt(endEye, [compose.ndcX, compose.ndcY], finalFov), b = chairShareAt(endEye, [-compose.ndcX, compose.ndcY], finalFov);
      if (a > 0.1 && b < a - 0.04) { compose.ndcX = -compose.ndcX; notes.push(`the Core is composed on the ${compose.ndcX > 0 ? 'right' : 'left'} third: the chair is ${(a * 100).toFixed(0)} % of the last frame on the other (${(b * 100).toFixed(0)} % here)`); }
    }
    // the monitor's top edge stays in the last frame (QA's monitor-cut): the Core lower in the frame, down to −0.5 (where it stands on a vertical thirds
    // line, so its height is free), then the lens wider, up to LENS_HERO_MAX — the Core is a little smaller in it
    if (hero.monitor) {
      const m = hero.monitor, top: V3 = [(m[0] + m[3]) / 2, m[4], (m[2] + m[5]) / 2], base = finalFov;
      const fits = (f: number, ny: number) => { const tg = composeTarget(endEye, centre, f, [compose.ndcX, ny]), q = project(camera(endEye, tg, f), top); return q[2] > 0 && Math.abs(q[1]) < 0.94 && Math.abs(q[0]) < 0.98; };
      let done = fits(base, compose.ndcY);
      for (let f = base; !done && f <= Math.min(LENS_HERO_MAX, base + 5) + 1e-9; f += 0.5) {
        for (let ny = compose.ndcY; ny >= (composeVertical ? -0.5 : compose.ndcY) - 1e-9; ny -= 0.05) if (fits(f, ny)) { finalFov = f; compose.ndcY = +ny.toFixed(3); done = true; break; }
      }
    }
    endPose = { az: to, r: r * 0.96 };
  } else {
    // (no orbit to arrive on — none free round the Core, or no way onto one from the walk: the push-in to the hero ring)
    const P = (finalWalk as any).P as V3, back = walkPts.length ? walkPts[walkPts.length - 1].p : P;
    finaleSegs.push({ beat: 'hero', pts: [back, lerp3(back, P, 0.85)] });
    finaleSegs.push({ beat: 'power', pts: [lerp3(back, P, 0.85), P], exact: true });
    notes.push(`push-in from [${back.map(v => v.toFixed(2))}] to [${P.map(v => v.toFixed(2))}]`);
    finalFov = fovForCore(P, centre, core, CORE_H);
    compose.ndcX = heroAngle(P[0], P[2]) > 0 ? -1 / 3 : 1 / 3;
  }

  // ---- 7b. the outside, now the inside's length is known: the establishing pose (as far out as the outside's share
  //          of the film allows — §3.3's ~3.6 s, 27–30 %) and the approach onto the door axis
  const innerLen = (beat: string) => [...pieces.filter(p => 'pts' in p).map((p: any) => polyLen(p.pts))].reduce((x, y) => x + y, 0);
  const walkL = innerLen('walk'), flightL = flightSegs.reduce((x, f) => x + polyLen(f.pts), 0);
  const tInEst = 1.35 + Math.min(1.3, walkL) / 0.75 + Math.max(0, walkL - 2.7) / 1.45 + 1.4 / 0.85 + flightL / 1.4
    + (orbitMeta ? polyLen(finaleSegs[0].pts) / 0.5 + orbitMeta.arc / 34 + 0.8 : 2) + 2.0;
  // (the film's length as far as the outside is concerned: what was pinned, or the inside's time over the 73 % of it that is
  // not outside)
  const tTarget = typeof opts.duration === 'number' ? opts.duration : Math.max(tInEst / 0.73, opts.minDuration || 0, AUTO_DURATION.min);
  // (a walkthrough starts inside the door: no establishing move, no approach, no threshold)
  let stepsSeg: V3[] | null = null, est!: Establish, A!: V3, pathLed = false, establishPts: V3[] = [], approachPts: V3[] = [];
  if (opts.inside) {
    est = { style: 'axial', eye: I0, aim: centre, fov: LENS.interior, bearing: 0, score: 0, fit: 0, sky: 0, occluded: 0, roofOff: false } as Establish;
    A = I0; approachPts = [P08];
  } else {
    // exterior steps that climb to the door (an upper-storey entry): the approach walks up them
    if (e.y > 0.9) for (const st of world.steps) {
      const a = st.rot * DEG, up: [number, number] = [-Math.sin(a), -Math.cos(a)], run = (st.n - 1) * 0.32, rise = st.n * 0.16;
      const top: V3 = [st.at[0] + up[0] * run, st.y + rise, st.at[1] + up[1] * run];
      if (Math.abs(top[1] - e.y) > 0.6 || dist2([top[0], top[2]], [P3[0], P3[2]]) > 3.2) continue;
      // the eye climbs off the steps' centre toward whichever side is clearer (steps against a facade: away from it)
      const side: [number, number] = [up[1], -up[0]], mid: [number, number] = [st.at[0] + up[0] * run / 2, st.at[1] + up[1] * run / 2];
      const clr = (sg: number) => index.planDistance(mid[0] + side[0] * sg * 0.5, mid[1] + side[1] * sg * 0.5, st.y + rise / 2 + 1.2, st.y + rise / 2 + 1.9, k => k === K.wall || k === K.glass, 2);
      const shift = clamp(st.w / 2 - 0.35, 0, 0.35) * (clr(1) >= clr(-1) ? 1 : -1);
      const ox = side[0] * shift, oz = side[1] * shift;
      const foot: V3 = [st.at[0] - up[0] * 1.2 + ox, st.y + 1.6, st.at[1] - up[1] * 1.2 + oz];
      const pts: V3[] = [];
      for (let k = 0; k <= 20; k++) { const u = k / 20; pts.push([st.at[0] + up[0] * run * u + ox, st.y + rise * u + 1.55, st.at[1] + up[1] * run * u + oz]); }
      stepsSeg = [foot, ...pts];
      notes.push(`approach climbs the steps at [${st.at}] (${st.n} risers)`);
      // planting round the foot of the flight (a stand of trees the steps climb out of): the climb starts where the eye is
      // clear of it
      { let k0 = 0; for (let k = stepsSeg.length - 1; k >= 0; k--) if (!outsideOk(stepsSeg[k])) { k0 = k + 1; break; }
        if (k0 > 0 && k0 < stepsSeg.length - 3) { stepsSeg = stepsSeg.slice(k0); notes.push(`the climb starts ${k0} steps up: planting round its foot`); } }
      break;
    }
    const tSteps = stepsSeg ? polyLen(stepsSeg) / 1.5 : 0;
    const tEst = clamp(0.27 * tTarget - 0.7 - 1.7 - tSteps, 1.2, 2.6);   // the outside's 27 %, less the approach (and any steps) and half the door
    // (an auto film takes the establishing move the house needs to fit the frame, up to 20 m of it; a pinned one only what the
    // outside's share of it can hold)
    const maxPath = (typeof opts.duration === 'number' ? clamp(3.8 * tEst, 6, 13) : 20) * ((opts.tune && opts.tune.estScale) || 1);
    const nearA: [number, number] = stepsSeg ? [stepsSeg[0][0], stepsSeg[0][2]] : [P3[0] + n2[0] * 1.4, P3[2] + n2[1] * 1.4];
    const ests = chooseEstablish(world, probe, index, opts.establish ?? 'auto', { near: nearA, maxPath, openTo: stepsSeg ? [stepsSeg[stepsSeg.length - 1][0], stepsSeg[stepsSeg.length - 1][1] - 0.3, stepsSeg[stepsSeg.length - 1][2]] : undefined, salt: opts.salt });
    // one establishing pose, made into its path: the approach start it flies to (a site path's line into the door, or the
    // pose's bearing's, 1 m past the door axis point 3 m out) and the move itself — a truck across and down onto it (a
    // Bézier whose first tangent is lateral, so the shot moves from frame 0 without charging at the house), over or round
    // whatever stands in it (a tree, a car): a crane rather than a truck, or a wider sweep
    const attemptEstablish = (est: Establish) => {
      const notesE: string[] = [];
      let A: V3;
      const bearA = clamp(est.bearing * 0.55, -32, 32) * DEG, l2: [number, number] = [n2[1], -n2[0]];
      const dirA: [number, number] = [n2[0] * Math.cos(bearA) + l2[0] * Math.sin(bearA), n2[1] * Math.cos(bearA) + l2[1] * Math.sin(bearA)];
      let pathLed = false;
      if (stepsSeg) A = stepsSeg[0];
      else {
        A = [P3[0] + dirA[0] * 1.0, Math.max(yDoor + 0.2, 1.8), P3[2] + dirA[1] * 1.0];
        // a site path that reaches the door: follow its line out
        for (const p of world.paths) {
          const pts = p.pts, dEnd = (q: number[]) => Math.hypot(q[0] - (e.x + n2[0] * 1.5), q[1] - (e.z + n2[1] * 1.5));
          const i0 = dEnd(pts[0]) <= dEnd(pts[pts.length - 1]) ? 0 : pts.length - 1;
          if (dEnd(pts[i0]) > 2.6) continue;
          const seq = i0 === 0 ? pts : pts.slice().reverse();
          // the point on the path 4.2 m out from the door
          let acc = 0, q: number[] | null = null;
          for (let k = 1; k < seq.length; k++) { const l = Math.hypot(seq[k][0] - seq[k - 1][0], seq[k][1] - seq[k - 1][1]); if (acc + l >= 4.2) { const f = (4.2 - acc) / l; q = [seq[k - 1][0] + (seq[k][0] - seq[k - 1][0]) * f, seq[k - 1][1] + (seq[k][1] - seq[k - 1][1]) * f]; break; } acc += l; }
          if (!q) continue;
          const cand: V3 = [q[0], Math.max(yDoor + 0.2, 1.8), q[1]];
          // only a path that comes in from the front half (not one that runs along the facade)
          const along = ((cand[0] - e.x) * n2[0] + (cand[2] - e.z) * n2[1]);
          if (along < 3.3) continue;
          // (only where the walk in from there is clear: a path that winds through planting is the street's, not the camera's)
          // (the handles are 40 % of the chord at most: a second handle longer than the distance from the approach's start to the door axis hooks the curve back on itself — a kink at the start of the approach, the speed dipping to 0.7 m/s there)
          const hd = Math.min(1.4, 0.4 * len(sub(P3, cand))), c1: V3 = add(cand, mul(norm(sub(P3, cand)), Math.min(1.6, len(sub(P3, cand)) * 0.4))), c2: V3 = [P3[0] + n2[0] * hd, P3[1], P3[2] + n2[1] * hd];
          if (blockedOut(bezier(cand, c1, c2, P3, 24)) >= 0) continue;
          A = cand; pathLed = true; notesE.push('approach follows the site path'); break;
        }
      }
      const E = est.eye;
      const EA = sub(A, E), dEA = len(EA);
      const lat = norm([-(est.aim[2] - E[2]), 0, est.aim[0] - E[0]]);
      const latSign = Math.sign(((A[0] - E[0]) * lat[0] + (A[2] - E[2]) * lat[2])) || 1;
      // `bulge` swings the move's middle sideways (metres, + toward the side it already leans to)
      const buildOutside = (A0: V3, bulge = 0): V3[] => {
        const toA = norm(sub(A0, E));
        const c1 = add(E, add(mul(lat, latSign * (dEA * 0.28 + bulge)), mul(toA, dEA * 0.18)));
        const endDir = stepsSeg ? norm(sub(stepsSeg[1], stepsSeg[0])) : norm(sub(P3, A0));
        const c2 = sub(A0, mul(endDir, Math.min(4, dEA * 0.3)));
        return bezier(E, [c1[0], E[1] - (E[1] - A0[1]) * 0.25, c1[2]], [c2[0], A0[1] + 0.6, c2[2]], A0, 60);
      };
      // (the move must not fly at a wall: on the way in, the frame it looks out on — the aim sliding to the door — is never one
      // wall within 1.5 m over more than half of it)
      const facing = (pts: V3[]) => { for (let k = 0; k < pts.length; k += 3) { const u = k / (pts.length - 1), w = clamp((u - 0.3) / 0.65, 0, 1), tgt = lerp3(est.aim, [e.x, e.y + 1.3, e.z], 0.7 * w * w * (3 - 2 * w)); if (probe.composition(camera(pts[k], tgt, est.fov), true, 1.5).blank >= 0.5) return true; } return false; };
      let establishPts = buildOutside(A), blocked = blockedOut(establishPts) >= 0 || facing(establishPts);
      if (blocked) {
        search: for (const bulge of [0, 1.5, -1.5, 3, -3, 5]) for (const lift of [0, 1.2, 2.4, 3.6, 5, 7]) {
          if (!bulge && !lift) continue;
          const base = buildOutside(A, bulge);
          const pts = base.map((p, i) => { const u = i / (base.length - 1); return [p[0], p[1] + lift * Math.sin(Math.PI * Math.min(1, u * 1.15)), p[2]] as V3; });
          if (blockedOut(pts) < 0 && !facing(pts)) { establishPts = pts; blocked = false; notesE.push(`establishing move ${lift ? `lifted ${lift} m` : ''}${lift && bulge ? ' and ' : ''}${bulge ? `swung ${bulge} m wide` : ''} round the garden`); break search; }
        }
      }
      // and the move goes toward the house, not away from it with the eye still on it (a pull-back is QA's `reverse`)
      { let back = 0, tot = 0;
        for (let k = 1; k < establishPts.length; k++) { const a = establishPts[k - 1], b = establishPts[k], vx = b[0] - a[0], vz = b[2] - a[2], L = Math.hypot(vx, vz), ax = est.aim[0] - a[0], az = est.aim[2] - a[2], al = Math.hypot(ax, az); if (L < 1e-6 || al < 1e-6) continue; tot += L; if ((vx * ax + vz * az) / (L * al) < -0.15) back += L; }
        if (tot > 0 && back / tot > 0.25) { blocked = true; notesE.push('the establishing move would pull away from the house'); } }
      // the look has to turn from the aim to what the move lands on (the door, the top of the steps) at the establishing yaw
      // limit: a pose that asks for more than 60° of it in the move's time is another pose's business
      { const next: V3 = stepsSeg ? [stepsSeg[stepsSeg.length - 1][0], 0, stepsSeg[stepsSeg.length - 1][2]] : [e.x, 0, e.z];
        const aim0: V3 = stepsSeg ? lerp3(est.aim, [next[0], est.aim[1], next[2]], 0.8) : est.aim;
        const y0 = Math.atan2(aim0[0] - E[0], aim0[2] - E[2]), y1 = Math.atan2(next[0] - A[0], next[2] - A[2]);
        if (Math.abs(wrapPi(y1 - y0)) > 60 * DEG) { blocked = true; notesE.push('the look would have to turn more than 60° in the establishing move'); } }
      return { est, A, pathLed, establishPts, blocked, notes: notesE };
    };
    let chosenEst = attemptEstablish(ests);
    if (chosenEst.blocked) for (const alt of (ests.alts || []).slice(1, 40)) { const t = attemptEstablish(alt); if (!t.blocked) { chosenEst = t; chosenEst.notes.push(`establishing pose ${alt.style} (the first choice's move is blocked by the garden)`); break; } }
    // (no whole-house pose has a clear move: the cropped ones — the house nearer, less of it in the frame — are tried)
    let relaxed: Establish | null = null;
    if (chosenEst.blocked) {
      relaxed = chooseEstablish(world, probe, index, opts.establish ?? 'auto', { near: nearA, maxPath, openTo: stepsSeg ? [stepsSeg[stepsSeg.length - 1][0], stepsSeg[stepsSeg.length - 1][1] - 0.3, stepsSeg[stepsSeg.length - 1][2]] : undefined, relax: true, salt: opts.salt });
      for (const alt of (relaxed.alts || [relaxed]).slice(0, 14)) { const t = attemptEstablish(alt); if (!t.blocked) { chosenEst = t; chosenEst.notes.push(`establishing pose ${alt.style}, the house cropped: no pose that shows all of it has a move the garden lets through`); break; } }
    }
    // last resort: the same view from nearer — the pose's own eye (the whole-house pose's, then the cropped one's) drawn in along its line to the
    // approach start, and lifted a little, until the move down to the door is clear of the garden
    if (chosenEst.blocked) {
      // (the poses tried: the first, the cropped first, then the first of each other kind — a line the garden blocks may be one another bearing has clear)
      const drawBases: Establish[] = [ests, relaxed || ests, ...(ests.alts || []).slice(1, 9), ...((relaxed && relaxed.alts) || []).slice(1, 5)];
      search2: for (const base of drawBases) {
        const A0 = chosenEst.A, E0 = base.eye, dirOut = norm(sub(E0, A0)), D0 = len(sub(E0, A0));
        for (const f of [0.8, 0.65, 0.5, 0.38, 0.28]) for (const h of [0, 1.5, 3]) {
          const q: V3 = [A0[0] + dirOut[0] * D0 * f, E0[1] + h - (E0[1] - A0[1]) * (1 - f) * 0.3, A0[2] + dirOut[2] * D0 * f];
          if (!outsideOk(q)) continue;
          const t = attemptEstablish({ ...base, eye: q });
          if (!t.blocked) { chosenEst = t; chosenEst.notes.push(`establishing pose drawn in to ${(f * 100).toFixed(0)} % of its distance (the garden is in the way of the full move)`); break search2; }
        }
      }
    }
    if (chosenEst.blocked) chosenEst.notes.push('establishing move blocked by the garden and no way round found');
    ({ est, A, pathLed, establishPts } = chosenEst);
    notes.push(...chosenEst.notes);
    // approach: A → (the door axis, 3 m out) → 0.8 m out; routed round anything at eye height when a straight
    // run is blocked
    // (the steps' top may be nearer the door than the axis point 3 m out: then the walk goes on from the top, never back)
    const axial = (p: V3) => (p[0] - e.x) * n2[0] + (p[2] - e.z) * n2[1];
    if (stepsSeg) approachPts = [...stepsSeg.slice(1), ...(axial(stepsSeg[stepsSeg.length - 1]) > axial(P3) + 0.3 ? [P3] : []), P08].filter((p, i, arr) => i === 0 || len(sub(p, arr[i - 1])) > 0.05);
    else {
      const c1: V3 = add(A, mul(norm(sub(P3, A)), Math.min(1.6, len(sub(P3, A)) * 0.4)));
      const hd = Math.min(1.4, 0.4 * len(sub(P3, A))), c2: V3 = [P3[0] + n2[0] * hd, P3[1], P3[2] + n2[1] * hd];
      approachPts = [...bezier(A, c1, c2, P3, 24), P08];
      if (blockedOut(approachPts) >= 0) {
        // (an entry on an upper level — a treehouse deck, a stilted pod — is walked to at ITS eye height: the grid's solids are the ones at that height, a crown at 4 m is a wall there)
        const g = nav.grid(null, e.y > 0.9 ? e.y : 0);
        const r = nav.leg(g, [A[0], A[2]], [P3[0], P3[2]], { snap: 1.0 });
        if (r) { const ys = (k: number) => A[1] + (P3[1] - A[1]) * (k / (r.pts.length - 1)); approachPts = [...r.pts.map((q, k) => [q[0], ys(k), q[1]] as V3), P08]; notes.push('approach routed round the garden'); }
        else notes.push('approach blocked and unroutable');
      }
    }


  }

  // ---- 8. the whole path, beat by beat -------------------------------------------------------------------------
  const outsideBeat: Beat = stepsSeg ? 'extStair' : 'approach';
  const all: Seg[] = [];
  if (!opts.inside) {
    all.push({ beat: 'establish', pts: establishPts });
    if (stepsSeg) all.push({ beat: 'extStair', pts: [A, ...approachPts.slice(0, -2)] });
    all.push({ beat: 'approach', pts: stepsSeg ? approachPts.slice(-3) : approachPts });
    all.push({ beat: 'threshold', pts: [P08, [e.x, yDoor - 0.02, e.z], I0] });
  }
  // the interior pieces with the flights between them
  const interior: Seg[] = [];
  for (const p of pieces) {
    if ('flight' in p) { const fs = flightSegs[p.flight]; interior.push(fs); continue; }
    if (p.pts.length > 1) interior.push({ beat: 'route', pts: p.pts, level: p.level });
  }
  // reveal: the first 1.3 m of the first walked piece; roomReveal: the last piece's stretch inside the Core's room
  // (0.8–1.4 m: §3.3's ~1 s at 0.9 m/s)
  const firstWalk = interior.findIndex(s => s.beat === 'route');
  if (firstWalk >= 0) {
    const s = interior[firstWalk], L = polyLen(s.pts);
    if (L > 0.5) { const [h, t] = splitAt(s.pts, Math.min(1.0, L * (interior.length === 1 ? 0.35 : 0.6))); interior.splice(firstWalk, 1, { beat: 'reveal', pts: h, level: s.level }, ...(polyLen(t) > 0.05 ? [{ beat: 'route' as Beat, pts: t, level: s.level }] : [])); }
    else s.beat = 'reveal';
  }
  const lastWalk = interior.length - 1 - [...interior].reverse().findIndex(s => s.beat === 'route' || s.beat === 'reveal');
  if (lastWalk >= 0 && lastWalk < interior.length && interior[lastWalk].beat === 'route') {
    const s = interior[lastWalk], L = polyLen(s.pts);
    // where the walk enters the Core's room
    let inside = L;
    if (coreRoom) { let acc = 0; for (let k = 1; k < s.pts.length; k++) { const l = len(sub(s.pts[k], s.pts[k - 1])); if (inRect(s.pts[k][0], s.pts[k][2], coreRoom.b, 0.05) && !inRect(s.pts[k - 1][0], s.pts[k - 1][2], coreRoom.b, 0.05)) inside = L - acc; acc += l; } }
    const rr = clamp(Math.min(inside, 1.1), Math.min(0.8, L * 0.5), L);
    const [h, t] = splitAt(s.pts, L - rr);
    interior.splice(lastWalk, 1, ...(polyLen(h) > 0.05 ? [{ beat: 'route' as Beat, pts: h, level: s.level }] : []), { beat: 'roomReveal', pts: t, level: s.level });
  } else if (lastWalk >= 0 && lastWalk < interior.length && interior[lastWalk].beat === 'reveal' && polyLen(interior[lastWalk].pts) > 2.4) {
    const s = interior[lastWalk], L = polyLen(s.pts), [h, t] = splitAt(s.pts, L * 0.5);
    interior.splice(lastWalk, 1, { beat: 'reveal', pts: h, level: s.level }, { beat: 'roomReveal', pts: t, level: s.level });
  }
  all.push(...interior, ...finaleSegs);

  // ---- 8b. the joints between an exact segment (a flight, the orbit, the power beat) and a walked one: a corner there is rounded with a cubic Bézier on the
  //          walked side — it leaves the exact end where it is and arrives along its tangent. (At a walking pace a 30° kink in one 8 ms sample is a speed dip in
  //          the record and a jerk of 20 m/s³; the orbit's sweep and a flight's treads stay exactly as they were.)
  {
    const tangentAt = (pts: V3[], fromEnd: boolean, reach = 0.15): V3 => {
      let acc = 0, a = fromEnd ? pts[pts.length - 1] : pts[0];
      for (let k = 1; k < pts.length; k++) { const q = fromEnd ? pts[pts.length - 1 - k] : pts[k]; acc = len(sub(q, a)); if (acc >= reach || k === pts.length - 1) return norm(fromEnd ? sub(a, q) : sub(q, a)); }
      return [0, 0, 1];
    };
    for (let k = 0; k + 1 < all.length; k++) {
      const A = all[k], B = all[k + 1];
      if (!!A.exact === !!B.exact) continue;
      const lenA = polyLen(A.pts), lenB = polyLen(B.pts);
      const tA = tangentAt(A.pts, true), tB = tangentAt(B.pts, false);
      const cosT = clamp(tA[0] * tB[0] + tA[1] * tB[1] + tA[2] * tB[2], -1, 1);
      if (Math.acos(cosT) < 3 * DEG) continue;
      if (B.exact) {
        const L = Math.min(0.4, 0.4 * lenA); if (L < 0.08) continue;
        const [head, tail] = splitAt(A.pts, lenA - L), q1 = head[head.length - 1], q = B.pts[0], d = tangentAt(tail, false), kk = L / 3;
        const arc = bezier(q1, add(q1, mul(d, kk)), sub(q, mul(tB, kk)), q, 14);
        A.pts = [...head.slice(0, -1), ...arc];
      } else {
        const L = Math.min(0.4, 0.4 * lenB); if (L < 0.08) continue;
        const q = A.pts[A.pts.length - 1], [head, tail] = splitAt(B.pts, L), q2 = head[head.length - 1], d = tangentAt(tail, false), kk = L / 3;
        const arc = bezier(q, add(q, mul(tA, kk)), sub(q2, mul(d, kk)), q2, 14);
        B.pts = [...arc, ...tail.slice(1)];
      }
    }
  }
  // ---- 9. one polyline, resampled every 2 cm, with a beat and a speed cap per sample --------------------------
  const STEP = 0.02;
  const X: number[] = [], Y: number[] = [], Z: number[] = [], Bt: number[] = [];
  const pushPt = (p: V3, b: number) => { if (X.length && Math.hypot(p[0] - X[X.length - 1], p[1] - Y[Y.length - 1], p[2] - Z[Z.length - 1]) < 1e-6) { Bt[Bt.length - 1] = b; return; } X.push(p[0]); Y.push(p[1]); Z.push(p[2]); Bt.push(b); };
  // joints between segments: a short fillet so the path has no kinks (the orbit and the flights are left exact)
  for (const [si, s] of all.entries()) {
    const b = BEATS.indexOf(s.beat);
    const pts = s.pts;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], c = pts[k + 1], L = len(sub(c, a)), m = Math.max(1, Math.ceil(L / STEP));
      for (let q = 0; q < m; q++) pushPt(lerp3(a, c, q / m), b);
    }
    if (si === all.length - 1) pushPt(pts[pts.length - 1], b);
  }
  let NP = X.length;
  // smooth the joints: a light moving average over the non-exact samples (±0.3 m), which rounds every kink the
  // fillets left at segment boundaries without moving the exact arcs
  {
    const exactSet = new Set(all.filter(s => s.exact).map(s => BEATS.indexOf(s.beat)));
    const flightSet = new Set([BEATS.indexOf('stair'), BEATS.indexOf('descend')]);
    // (the samples next to an exact arc stay where the seam is: the average fades out to nothing at it, so the path meets the
    // arc without a step — a step is a jerk)
    const W = 12, dEx = new Int32Array(NP).fill(1e9);
    for (let i = 0; i < NP; i++) { if (exactSet.has(Bt[i])) dEx[i] = 0; else if (i && dEx[i - 1] < 1e9) dEx[i] = dEx[i - 1] + 1; }
    for (let i = NP - 1; i >= 0; i--) { if (i < NP - 1 && dEx[i + 1] < 1e9) dEx[i] = Math.min(dEx[i], dEx[i + 1] + 1); }
    for (const [arr] of [[X], [Y], [Z]] as Array<[number[]]>) {
      const src = arr.slice();
      for (let i = 0; i < NP; i++) {
        if (exactSet.has(Bt[i])) continue;
        let s = 0, ws = 0;
        for (let k = -W; k <= W; k++) { const j = i + k; if (j < 0 || j >= NP) continue; if (exactSet.has(Bt[j]) && Bt[j] !== Bt[i]) continue; const w = 0.5 + 0.5 * Math.cos(Math.PI * k / (W + 1)); s += src[j] * w; ws += w; }
        // flights keep their line (the average only rounds their ends)
        const m = flightSet.has(Bt[i]) ? src[i] * 0.5 + (s / ws) * 0.5 : s / ws, u = Math.min(1, dEx[i] / W);
        arr[i] = src[i] * (1 - u) + m * u;
      }
    }
  }
  // clearance: the walk keeps 0.27 m off walls and furniture (rounding a corner, the smoothing above cuts it; a partition's end
  // clipped by centimetres is a wall the eye is inside). A point nearer than that is pushed out along the way the distance grows,
  // and the path is rounded again — a few sweeps; doorways and the finale (whose lines are exact) are not touched.
  {
    const walk = new Set<number>([BEATS.indexOf('route'), BEATS.indexOf('reveal'), BEATS.indexOf('roomReveal')]);
    const exactB = new Set(all.filter(s => s.exact).map(s => BEATS.indexOf(s.beat)));
    const solid = (k: number) => k === K.wall || k === K.glass || k === K.rail || k === K.hull || k === K.item || k === K.fixture;
    const near = (i: number) => { for (let k = -4; k <= 4; k++) { const j = i + k; if (j >= 0 && j < NP && exactB.has(Bt[j])) return true; } return false; };
    const dAt = (x: number, z: number, y: number) => index.planDistance(x, z, y - 0.25, y + 0.25, solid, 0.5);
    for (let pass = 0; pass < 6; pass++) {
      let moved = 0;
      for (let i = 0; i < NP; i++) {
        if (!walk.has(Bt[i]) || near(i)) continue;
        const d = dAt(X[i], Z[i], Y[i]);
        if (d >= 0.27 || d <= 0) continue;
        const e = 0.05, gx = dAt(X[i] + e, Z[i], Y[i]) - dAt(X[i] - e, Z[i], Y[i]), gz = dAt(X[i], Z[i] + e, Y[i]) - dAt(X[i], Z[i] - e, Y[i]), gl = Math.hypot(gx, gz);
        if (gl < 1e-6) continue;
        const push = (0.27 - d) * 0.7;
        X[i] += gx / gl * push; Z[i] += gz / gl * push; moved++;
      }
      if (!moved) break;
      // (rounded over ±0.2 m, so a push is a bend and never a kink)
      for (const arr of [X, Z]) { const src = arr.slice(); for (let i = 0; i < NP; i++) { if (!walk.has(Bt[i]) || near(i)) continue; let sm = 0, ws = 0; for (let k = -10; k <= 10; k++) { const j = i + k; if (j < 0 || j >= NP || (exactB.has(Bt[j]) && Bt[j] !== Bt[i])) continue; const w = 0.5 + 0.5 * Math.cos(Math.PI * k / 11); sm += src[j] * w; ws += w; } arr[i] = sm / ws; } }
    }
  }
  // a last light rounding of the walk (±8 cm: the fillets, the funnels and the clearance pushes leave millimetre kinks that are a jerk of 20 m/s³ at a
  // walking pace); the exact arcs, the flights and their neighbours stay where they are
  {
    const walkB2 = new Set<number>([BEATS.indexOf('route'), BEATS.indexOf('reveal'), BEATS.indexOf('roomReveal'), BEATS.indexOf('threshold'), BEATS.indexOf('approach')]);
    const keep = (i: number) => { for (let k = -4; k <= 4; k++) { const j = i + k; if (j < 0 || j >= NP || !walkB2.has(Bt[j])) return true; } return false; };
    for (const arr of [X, Z]) { const src = arr.slice(); for (let i = 0; i < NP; i++) { if (keep(i)) continue; let sm = 0, ws = 0; for (let k = -4; k <= 4; k++) { const w = 0.5 + 0.5 * Math.cos(Math.PI * k / 5); sm += src[i + k] * w; ws += w; } arr[i] = sm / ws; } }
  }
  // arc length
  const S = new Float64Array(NP);
  for (let i = 1; i < NP; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1], Z[i] - Z[i - 1]);
  const total = S[NP - 1];

  // ---- 10. speed caps ----------------------------------------------------------------------------------------
  // cruise: the beat's §3.4 cap (the duration solve scales it); local: doorways and curvature, which it never does
  const cruise = new Float64Array(NP), local = new Float64Array(NP).fill(Infinity);
  const doorsAll = world.levels.flatMap(l => nav.doorsOn(l.id).map(d => ({ ...d, y: l.y })));
  const beatAt = (i: number) => BEATS[Bt[i]];
  // (the route's length, for its cap)
  let routeLenM = 0; for (let i = 1; i < NP; i++) if (beatAt(i) === 'route') routeLenM += S[i] - S[i - 1];
  const ROUTE_CAP = routeCap(routeLenM);
  // the orbit's own angular speed: it starts at the push-in's pace (the hero beat's 0.4 m/s is 22°/s at 1 m), builds to the 30°/s cap
  // over the first fifth of the sweep, holds through the first half and eases down over the second to half of it (15°/s into the power beat) — the sweep
  // brakes as a camera operator's pan would, never a swoosh and a stop (and 26°/s on average, the v1 orbit's pace: 100° in 4 s)
  let orbI0 = -1, orbI1 = -1; for (let i = 0; i < NP; i++) if (Bt[i] === BEATS.indexOf('orbit')) { if (orbI0 < 0) orbI0 = i; orbI1 = i; }
  const orbitTaper = (i: number) => { const u = orbI1 > orbI0 ? (S[i] - S[orbI0]) / (S[orbI1] - S[orbI0]) : 0.5, sm = (x: number) => { const y = Math.max(0, Math.min(1, x)); return y * y * (3 - 2 * y); }; return (0.8 + 0.2 * sm(u / 0.2)) * (1 - 0.5 * sm((u - 0.5) / 0.5)); };
  for (let i = 0; i < NP; i++) {
    const b = beatAt(i);
    let c = b === 'orbit' ? (orbit ? orbit.r : 0.9) * SPEED_CAP.orbit * DEG * orbitTaper(i) : b === 'route' ? ROUTE_CAP : SPEED_CAP[b];
    // a flight's cap is along it in PLAN (§3.4): the 3-D speed that makes that is the plan's over the horizontal share of the way the eye is going over ±0.3 m of it
    if (b === 'stair' || b === 'descend' || b === 'extStair') { const j0 = Math.max(0, i - 15), j1 = Math.min(NP - 1, i + 15), dh = Math.hypot(X[j1] - X[j0], Z[j1] - Z[j0]), d3 = Math.hypot(X[j1] - X[j0], Y[j1] - Y[j0], Z[j1] - Z[j0]); c = SPEED_CAP[b] / Math.max(0.4, d3 > 1e-6 ? dh / d3 : 1); }
    cruise[i] = c * 0.97;
    // an interior doorway: ≤ 1.2 m/s within ±0.6 m of its plane
    for (const d of doorsAll) {
      if (Y[i] < d.y + 0.5 || Y[i] > d.y + 2.5) continue;
      const a = (X[i] - d.c[0]) * d.n[0] + (Z[i] - d.c[1]) * d.n[1], lat = Math.abs((X[i] - d.c[0]) * d.n[1] - (Z[i] - d.c[1]) * d.n[0]);
      if (Math.abs(a) < 0.6 && lat < d.w / 2 + 0.3) local[i] = Math.min(local[i], DOORWAY_SPEED * 0.95);
    }
    // a room worth seeing (the top three) is walked through at 1.6 m/s at most: a second in it, at the least, when the walk
    // crosses more than a metre and a half of it
    if ((b === 'route' || b === 'reveal') && topSet.size) { for (const r of topSet) { if (r === coreRoom) continue; const l = nav.levelOf(r === undefined ? '' : (Le.rooms.includes(r) ? Le.id : Lh.id)); if (Math.abs(Y[i] - l.y - 1.4) < 0.9 && inRect(X[i], Z[i], r.b, 0)) { local[i] = Math.min(local[i], 1.6); break; } } }
    // the entry door: ≤ 0.9 m/s across its plane, rising to the beat's 1.2 by 0.6 m either side of it (D4: the jambs stay
    // readable for a beat's length without the zone taking two seconds)
    if (b === 'threshold') { const a = Math.abs((X[i] - e.x) * n2[0] + (Z[i] - e.z) * n2[1]); local[i] = Math.min(local[i], DOOR_PLANE_CAP * 0.95 + Math.max(0, a - DOOR_ZONE_M) * 1.2); }
  }
  // (a flight's cap, 3-D, follows the slope: smoothed over ±0.5 m so the step from the flat to the flight is a ramp, not a jerk — 16–24 m/s³ on the stairs of mirage and newcrest)
  { const fl = new Set<number>([BEATS.indexOf('stair'), BEATS.indexOf('descend'), BEATS.indexOf('extStair')]), src = cruise.slice(), W = 25;
    for (let i = 0; i < NP; i++) { if (!fl.has(Bt[i])) continue; let sm = 0, ws = 0; for (let k = -W; k <= W; k++) { const j = i + k; if (j < 0 || j >= NP || !fl.has(Bt[j])) continue; const w = 0.5 + 0.5 * Math.cos(Math.PI * k / (W + 1)); sm += src[j] * w; ws += w; } cruise[i] = sm / ws; } }
  // curvature: v ≤ √(a_lat / κ), 1.5 m/s² inside and 3 outside (the look turns on its own solver, rate-limited)
  for (let i = 1; i < NP - 1; i++) {
    const j0 = Math.max(0, i - 10), j1 = Math.min(NP - 1, i + 10);
    const ax = X[i] - X[j0], az = Z[i] - Z[j0], bx = X[j1] - X[i], bz = Z[j1] - Z[i];
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz); if (la < 0.05 || lb < 0.05) continue;
    const ang = Math.abs(wrapPi(Math.atan2(bx, bz) - Math.atan2(ax, az))), kappa = ang / ((la + lb) / 2);
    if (kappa < 1e-3) continue;
    const b = beatAt(i); if (b === 'orbit' || b === 'power') continue;
    local[i] = Math.min(local[i], Math.sqrt((OUTSIDE.has(b) ? 3.0 : 1.5) / kappa));
  }
  // the Core in view while the eye goes round it: the direction to it turns at (the eye's speed across it) / (its distance), and the
  // look cannot turn faster than the beat's yaw cap, so the walk goes round it no faster than the look can follow with room to spare (half the cap)
  for (let i = 0; i < NP; i++) {
    const b = beatAt(i); if (b !== 'hero' && b !== 'roomReveal') continue;
    const j0 = Math.max(0, i - 6), j1 = Math.min(NP - 1, i + 6), tx = X[j1] - X[j0], tz = Z[j1] - Z[j0], tl = Math.hypot(tx, tz);
    const rx = centre[0] - X[i], rz = centre[2] - Z[i], r = Math.hypot(rx, rz);
    if (tl < 1e-6 || r < 0.05) continue;
    const across = Math.abs(tx * rz - tz * rx) / (tl * r);   // the share of the speed that is across the line of sight
    local[i] = Math.min(local[i], 0.5 * YAW_CAP[b] * DEG * r / Math.max(0.3, across));
  }
  // beat floors (§3.4): a beat that would be over too fast is capped at the speed that fills its floor
  const beatRanges = new Map<Beat, Array<[number, number]>>();
  for (let i = 0; i < NP;) { let j = i; while (j + 1 < NP && Bt[j + 1] === Bt[i]) j++; const b = beatAt(i); if (!beatRanges.has(b)) beatRanges.set(b, []); beatRanges.get(b)!.push([i, j]); i = j + 1; }
  const overrides = opts.beats || {};
  for (const [b, rs] of beatRanges) for (const [i0, i1] of rs) {
    const L = S[i1] - S[i0], floor = Math.max(b === 'hero' ? heroFloor : BEAT_FLOOR[b] || 0, overrides[b] || 0);
    // (+ 0.2 s: the speed smoothing moves a beat's ends in by about that)
    if (floor > 0 && L > 0.01) { const v = (L / (floor + 0.2)) * 0.97; for (let i = i0; i <= i1; i++) local[i] = Math.min(local[i], v); }
  }
  // the first frame moves (≥ 0.5 m in the first second): an establishing move is already flying at 2.5 m/s; the
  // last frame is still moving
  const profile = (capArr: Float64Array) => {
    const v = new Float64Array(NP);
    // (the film eases in: it starts at 0.8 m/s and the outside's 3 m/s² takes it to its 3.7 m/s in a second — a first frame already at 3.8 m/s is a cut into motion, QA's `cold-start`; the first second still moves 2.2 m, the plan's ≥ 0.5)
    v[0] = Math.min(capArr[0], OUTSIDE.has(beatAt(0)) ? 0.8 : 1.2);
    for (let i = 1; i < NP; i++) { const a = OUTSIDE.has(beatAt(i)) ? ACC_OUT : ACC_IN, ds = S[i] - S[i - 1]; v[i] = Math.min(capArr[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * a * ds)); }
    v[NP - 1] = Math.min(v[NP - 1], 0.04);
    for (let i = NP - 2; i >= 0; i--) { const a = OUTSIDE.has(beatAt(i)) ? ACC_OUT : ACC_IN, ds = S[i + 1] - S[i]; v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * a * ds)); }
    for (let i = 0; i < NP; i++) v[i] = Math.max(v[i], 0.015);
    const T = new Float64Array(NP);
    for (let i = 1; i < NP; i++) T[i] = T[i - 1] + 2 * (S[i] - S[i - 1]) / (v[i] + v[i - 1]);
    return { v, T };
  };
  // the duration solve (§3.4). The beats at their caps give the shortest film that keeps every cap (Tmin). An auto film
  // is that plus a breath, to the half second (never under 12 s, or the spec's own length under the global switch); a
  // pinned one is what the spec says: longer than Tmin, the surplus goes to establish (only while the outside share
  // stays ≤ 27 %), route, reveal, hero, then the rest — never to the door, the stairs or the power beat; shorter, the
  // beats that are not protected (the door, the stairs, the push-in, the orbit, the power beat) run faster alike, down to
  // 60 % of their time, then every beat alike, and QA names the caps that broke (beat-speed). Nothing is sped up past its
  // cap to make a film fit: a walk that needs longer than the target is planned shorter instead (planDoorToCore's
  // retries), or its auto film is longer.
  const mult = new Map<Beat, number>(BEATS.map(b => [b, 1]));
  // (a beat's multiplier below 1 slows everything in it — the local caps too, so a beat held to its floor stretches)
  const capWith = () => { const c = new Float64Array(NP); for (let i = 0; i < NP; i++) { const m = mult.get(beatAt(i))!; c[i] = Math.min(cruise[i] * m, local[i] * Math.min(1, m)); } return c; };
  let prof = profile(capWith());
  const beatTimes = (T: Float64Array) => { const out = new Map<Beat, number>(); for (const [b, rs] of beatRanges) out.set(b, rs.reduce((a, [i0, i1]) => a + T[i1] - T[i0] + (i1 + 1 < NP ? (T[i1 + 1] - T[i1]) : 0), 0)); return out; };
  const Tmin = prof.T[NP - 1];
  const capTimes = beatTimes(prof.T);
  // (what limits the walk: the share of the route's length, and time, at each cap — for the audit)
  const limitStats: Record<string, number> = {};
  for (let i = 1; i < NP; i++) { const b = beatAt(i); if (b !== 'route') continue; const cru = cruise[i], lo = local[i], v = prof.v[i], ds = S[i] - S[i - 1]; const why = lo < cru - 1e-6 ? (v >= lo - 1e-3 ? 'local' : 'accel') : (v >= cru - 1e-3 ? 'cruise' : 'accel'); limitStats[why] = (limitStats[why] || 0) + ds / Math.max(0.05, v); }
  for (const k of Object.keys(limitStats)) limitStats[k] = +limitStats[k].toFixed(2);
  let duration: number;
  // (the outside — establish, the steps, the approach, half the door — stays under 30 % of an auto film, 34.5 % with an
  // exterior stair: a short walk behind a long approach makes the film longer, its interior slower, never the opening shorter)
  const hasExt = beatRanges.has('extStair');
  const outsideCaps = [...OUTSIDE].reduce((a, b) => a + (capTimes.get(b) || 0), 0) + (capTimes.get('threshold') || 0) / 2;
  if (typeof opts.duration === 'number') duration = +opts.duration.toFixed(2);
  else duration = Math.max(Math.ceil((Tmin + 0.3) * 2 - 1e-6) / 2, opts.minDuration || 0, AUTO_DURATION.min, Math.ceil(outsideCaps / (hasExt ? 0.345 : 0.30) * 2 - 1e-6) / 2);
  if (Tmin < duration - 0.02) {
    // surplus, spread over the inside alike (a languid film, never one beat crawling): every beat that can slow (the
    // reveal, the route, the room reveal, the push-in and the orbit) by the same factor, up to its own limit; the opening
    // takes what the outside's share (27 %) leaves it; what is left goes on stretching those, then the door's approach
    const FACTOR: Partial<Record<Beat, number>> = { reveal: 1.5, route: 1.6, roomReveal: 1.4, hero: 1.4, orbit: 1.35, power: 1.45 };
    for (let it = 0; it < 10; it++) {
      const T = prof.T, now = T[NP - 1]; if (duration - now < 0.02) break;
      const bt = beatTimes(T);
      let surplus = duration - now;
      const outsideNow = [...OUTSIDE].reduce((a, b) => a + (bt.get(b) || 0), 0) + (bt.get('threshold') || 0) / 2;
      // the opening first: establish, while the outside stays within 27 % (32 % with an exterior stair)
      if (bt.has('establish')) { const give = Math.min(surplus, 0.8, Math.max(0, (hasExt ? 0.32 : 0.27) * duration - outsideNow)); if (give > 0.01) { const d0 = bt.get('establish')!; mult.set('establish', mult.get('establish')! * d0 / (d0 + give)); surplus -= give; } }
      // then the inside alike
      const inside = (Object.keys(FACTOR) as Beat[]).filter(b => bt.has(b) && mult.get(b)! > 1 / FACTOR[b]! + 1e-6);
      const base = inside.reduce((a, b) => a + bt.get(b)!, 0);
      if (surplus > 0.01 && base > 0.1) {
        const f = 1 + surplus / base;
        for (const b of inside) { const room = FACTOR[b]! * mult.get(b)!; const fb = Math.min(f, Math.max(1, room)); mult.set(b, mult.get(b)! / fb); }
      } else if (surplus > 0.01) {
        // nothing left to stretch: the approach's last stretch and the reveal take it
        for (const b of ['reveal', 'roomReveal', 'route', 'hero', 'orbit', 'power'] as Beat[]) if (bt.has(b)) { const d0 = bt.get(b)!; mult.set(b, mult.get(b)! * d0 / (d0 + surplus / 6)); }
      }
      prof = profile(capWith());
    }
  } else if (Tmin > duration + 0.02) {
    const T = prof.T, over = T[NP - 1] - duration;
    const PROTECT = new Set<Beat>(['threshold', 'stair', 'descend', 'hero', 'orbit', 'power']);
    const bt = beatTimes(T);
    const free = [...bt].filter(([b]) => !PROTECT.has(b)).reduce((a, [, v]) => a + v, 0);
    const k = Math.max(0.6, (free - over) / Math.max(free, 1e-6));
    const Tn = new Float64Array(NP);
    for (let i = 1; i < NP; i++) Tn[i] = Tn[i - 1] + (T[i] - T[i - 1]) * (PROTECT.has(beatAt(i)) ? 1 : k);
    prof = { v: prof.v, T: Tn };
    notes.push(`the pinned ${duration} s is too short for the walk (${Tmin.toFixed(1)} s at its caps): the beats run faster than their caps`);
  }
  // the time map, smoothed: a 0.35 s Hann over the speed in time, re-integrated, then scaled onto the duration
  const Traw = prof.T, Tend = Traw[NP - 1];
  const scale = duration / Tend;
  const N = Math.max(2, Math.round(duration * FPS) + 1), dt = duration / (N - 1);
  // s(t) on the output grid
  const sOfT = new Float64Array(N);
  {
    let j = 0;
    for (let i = 0; i < N; i++) {
      const t = (i * dt) / scale;
      while (j < NP - 2 && Traw[j + 1] < t) j++;
      const f = Traw[j + 1] > Traw[j] ? clamp((t - Traw[j]) / (Traw[j + 1] - Traw[j]), 0, 1) : 0;
      sOfT[i] = S[j] + (S[j + 1] - S[j]) * f;
    }
    // smooth the speed (ds/dt) with a Hann window and re-integrate, pinned to the same ends
    const v = new Float64Array(N); for (let i = 1; i < N; i++) v[i] = (sOfT[i] - sOfT[i - 1]) / dt; v[0] = v[1];
    const vs = hann(v, Math.round(0.25 * FPS));
    const s2 = new Float64Array(N); for (let i = 1; i < N; i++) s2[i] = s2[i - 1] + (vs[i] + vs[i - 1]) / 2 * dt;
    const k = total / (s2[N - 1] || 1);
    for (let i = 0; i < N; i++) sOfT[i] = Math.min(total, s2[i] * k);
  }
  // positions and beats on the output grid
  const pos = new Float32Array(3 * N), beatOf = new Uint8Array(N);
  const sampleAt = (s: number) => {
    let lo = 0, hi = NP - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const f = S[hi] > S[lo] ? (s - S[lo]) / (S[hi] - S[lo]) : 0;
    return { x: X[lo] + (X[hi] - X[lo]) * f, y: Y[lo] + (Y[hi] - Y[lo]) * f, z: Z[lo] + (Z[hi] - Z[lo]) * f, b: f < 0.5 ? Bt[lo] : Bt[hi], i: lo };
  };
  for (let i = 0; i < N; i++) { const q = sampleAt(sOfT[i]); pos[3 * i] = q.x; pos[3 * i + 1] = q.y; pos[3 * i + 2] = q.z; beatOf[i] = q.b; }
  const beats: Track['beats'] = [];
  for (let i = 0; i < N;) { let j = i; while (j + 1 < N && beatOf[j + 1] === beatOf[i]) j++; beats.push({ name: BEATS[beatOf[i]], t0: +(i * dt).toFixed(4), t1: +((j + 1 < N ? j + 1 : j) * dt).toFixed(4), subject: null }); i = j + 1; }

  // ---- 12. the lens, the roof, the Core's framing -------------------------------------------------------------
  const tOf = (name: Beat, end = false) => { const b = beats.find(x => x.name === name); return b ? (end ? b.t1 : b.t0) : null; };
  const lastT = (name: Beat) => { const bs2 = beats.filter(x => x.name === name); return bs2.length ? bs2[bs2.length - 1].t1 : null; };
  const fov = new Float32Array(N), roofAlpha = new Float32Array(N), composeW = new Float32Array(N);
  const tApproach = tOf('extStair') ?? tOf('approach') ?? 1.5;
  const tInside = tOf('reveal') ?? tOf('route') ?? tApproach + 2;
  const tRoom = tOf('roomReveal') ?? tOf('hero') ?? duration - 4;
  const tHero = tOf('hero') ?? tRoom;
  const tOrbit = tOf('orbit') ?? tHero + 1;
  const tPower = tOf('power') ?? duration - 1.8;
  const fovExt = est.fov;
  const smooth = (u: number) => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };
  const ramp = (t: number, t0: number, t1: number) => t1 <= t0 ? (t >= t1 ? 1 : 0) : clamp((t - t0) / (t1 - t0), 0, 1);
  // exterior → interior at ≤ 4°/s, done when the reveal begins (§3.5: 55–60 inside) — begun in the establishing move's last second where the approach and the door are too short to take it; interior → the
  // finale's lens at ≤ 4°/s, done when the orbit begins (§3.5: 38–44 for the orbit and the press), begun no earlier than a second before the room reveal; eased at both ends
  const RATE = LENS.rate * 0.9, ramp0 = (LENS.interior - fovExt) / RATE;
  const inRampEnd = Math.max(tInside - 0.05, tApproach + 0.5);
  const inRampStart = Math.max(Math.min(tApproach, inRampEnd - ramp0), (tOf('establish', true) || 1.5) - 1.0);
  // (a narrow opening lens — the whole house from further out — has further to go: where the time before the reveal cannot take it to 57° at 3.6°/s it is taken to what it can, no less than the plan's interior 55°, so the lens never changes faster than the plan's 4°/s, QA's `fov-rate`)
  const interiorLens = (LENS.interior - fovExt) / Math.max(0.1, inRampEnd - inRampStart) > RATE ? Math.max(LENS_INTERIOR_MIN, fovExt + RATE * (inRampEnd - inRampStart)) : LENS.interior;
  const outRampEnd = Math.max(tOrbit, tRoom + 0.5), outRampStart = Math.max(tRoom - 1.0, Math.min(tRoom, outRampEnd - (LENS.interior - finalFov) / RATE));
  for (let i = 0; i < N; i++) {
    const t = i * dt;
    const easeLin = (u: number) => u < 0.08 ? (u * u) / (2 * 0.08 * 0.92) : u > 0.92 ? 1 - ((1 - u) * (1 - u)) / (2 * 0.08 * 0.92) : (u - 0.04) / 0.92;   // constant rate, its ends eased (C1)
    let f = fovExt + (interiorLens - fovExt) * easeLin(ramp(t, inRampStart, inRampEnd));
    f = f + (finalFov - f) * easeLin(ramp(t, outRampStart, outRampEnd));
    fov[i] = f;
  }
  // the roof: opaque outside, fading
  // over 0.35 s from the moment the eye crosses the door (§3.2)
  let enterT: number | null = null;
  for (let i = 1; i < N; i++) {
    const a0 = (pos[3 * (i - 1)] - e.x) * n2[0] + (pos[3 * (i - 1) + 2] - e.z) * n2[1], a1 = (pos[3 * i] - e.x) * n2[0] + (pos[3 * i + 2] - e.z) * n2[1];
    if (a0 > 0 && a1 <= 0 && Math.hypot(pos[3 * i] - e.x, pos[3 * i + 2] - e.z) < 1.5) { enterT = +(((i - 1) + a0 / (a0 - a1)) * dt).toFixed(4); break; }
  }
  const estEnd = tOf('establish', true) || 1.5;
  for (let i = 0; i < N; i++) {
    const t = i * dt;
    let a = opts.inside ? 0 : 1;
    if (est.roofOff) a = smooth(ramp(t, estEnd - 0.7, estEnd + 0.1));
    if (enterT !== null && t >= enterT) a = Math.min(a, 1 - smooth(ramp(t, enterT, enterT + 0.35)));
    roofAlpha[i] = a;
  }
  // the Core composed on its thirds line: fades in over the push-in and the orbit's first stretch (≥ 1.2 s)
  const cIn0 = tHero, cIn1 = Math.max(tHero + 2.2, tOrbit + 1.6);   // (a turn of 15° or so the view makes onto the thirds line: spread over the push-in and the orbit's start, it is a few °/s on top of the Core's own bearing — the hero beat's cap is 15)
  for (let i = 0; i < N; i++) composeW[i] = smooth(ramp(i * dt, cIn0, cIn1));
  // ---- 11. subjects, the look solver --------------------------------------------------------------------------
  // threshold: the longest interior sightline from just inside the door, weighted by what it ends on (§3.10)
  let sightline: V3 = [I0[0] - n2[0] * 4, I0[1] - 0.2, I0[2] - n2[1] * 4];
  {
    let bs = -Infinity; const base = Math.atan2(-n2[0], -n2[1]);
    for (let k = 0; k < 25; k++) {
      const a = base + (-60 + 5 * k) * DEG, d: V3 = [Math.sin(a), -0.05, Math.cos(a)];
      const h = probe.cast(I0, d, 20, false);
      const t = h ? h.t : 20;
      if (t < 2.5) continue;
      const w = !h ? 0.6 : h.k === K.glass ? 1.3 : (h.k === K.item || h.k === K.heroSet || h.k === K.surface) ? 1.4 : h.k === K.wall ? 1.0 : 0.9;
      const s = Math.min(t, 12) * w - Math.abs(k - 12) * 0.05;
      if (s > bs) { bs = s; sightline = [I0[0] + d[0] * Math.min(t - 0.3, 10), I0[1] - 0.25, I0[2] + d[2] * Math.min(t - 0.3, 10)]; }
    }
  }
  const focalOf = (r: WRoom | null, lvId: string): V3 | null => {
    if (!r) return null;
    const lv = nav.levelOf(lvId), f = interestOf.get(r)?.focal;
    if (f) return [f.at[0], lv.y + 1.0, f.at[1]];
    return [r.b.x + r.b.w / 2, lv.y + 1.1, r.b.z + r.b.d / 2];
  };
  const coreTarget: V3 = centre;
  const doorSubject: V3 = [e.x, e.y + 1.3, e.z];
  const eyeAt = (i: number): V3 => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
  const levelIdAt = (p: V3) => { const l = levelAt(world, p[0], p[1], p[2]); return l ? l.id : null; };
  const estT1 = (beats.find(x => x.name === 'establish') || { t1: 1.5 }).t1;
  // a glance: while the eye walks, the room worth seeing that is in front of it (its focal item within 85° of the way it is going — 105° in the reveal, where the eye may turn its head —
  // 8 m, in the clear) — the top-3 rooms weigh half as much again; the choice holds until another is clearly better
  const glanceMemo = new Map<number, { p: V3; room: WRoom } | null>();
  let glanceHold: { room: WRoom; v: number } | null = null;
  const glanceTime = new Map<WRoom, number>();   // seconds each room has been the glance so far (the shot is walked in time order)
  const glanceAt = (i: number, lvId: string): { p: V3; room: WRoom } | null => {
    const key = Math.floor(i / 12); if (glanceMemo.has(key)) return glanceMemo.get(key)!;
    const p = eyeAt(i), q = eyeAt(Math.min(N - 1, i + Math.round(0.8 * FPS))), r0 = eyeAt(Math.max(0, i - 6));
    const hd = Math.hypot(q[0] - p[0], q[2] - p[2]) > 0.25 ? Math.atan2(q[0] - p[0], q[2] - p[2]) : Math.atan2(p[0] - r0[0], p[2] - r0[2]);
    const lv = nav.levelOf(lvId), here = nav.roomAt(lvId, p[0], p[2]);
    let best: { room: WRoom; v: number; p: V3 } | null = null;
    for (const r of lv.rooms) {
      const it = interestOf.get(r); if (!it || it.interest < 0.5 || r === here) continue;
      const f = it.focal, fx = f ? f.at[0] : r.b.x + r.b.w / 2, fz = f ? f.at[1] : r.b.z + r.b.d / 2, d = Math.hypot(fx - p[0], fz - p[2]);
      const ang = Math.abs(wrapPi(Math.atan2(fx - p[0], fz - p[2]) - hd)) / DEG;
      if (d > 8 || d < 1.2 || ang > (BEATS[beatOf[i]] === 'reveal' ? 105 : 85)) continue;
      const fp: V3 = [fx, lv.y + 1.0, fz];
      if (!probe.clear(p, fp)) continue;
      // (a room looked at for 1.8 s has had its look: the next one that is worth one takes over)
      const v = it.interest * (topSet.has(r) ? 1.5 : 1) * ((glanceTime.get(r) || 0) >= 1.8 ? 0.35 : 1) - 0.06 * d - 0.012 * ang + (glanceHold && glanceHold.room === r ? 0.3 : 0);
      if (!best || v > best.v) best = { room: r, v, p: fp };
    }
    glanceHold = best ? { room: best.room, v: best.v } : null;
    if (best) glanceTime.set(best.room, (glanceTime.get(best.room) || 0) + 12 / FPS);
    const out = best ? { p: best.p, room: best.room } : null;
    glanceMemo.set(key, out);
    return out;
  };
  // the rooms worth seeing (QA's top three) that the walk does not go through: each is looked at once, for about 1.4 s, at the best moment of the walk — the
  // longest stretch where its focal item is in the clear, indoors on its storey, within 9 m and within 100° of the way the eye is going (what a walk past an
  // open door or through an open plan shows). A room the eye spends 1.3 s in needs no look; one the walk never has in the clear gets none.
  const mustLook: Array<V3 | null> = new Array(N).fill(null);
  const showable = new Set<WRoom>();   // (the top rooms the film can show: the Core's, one the eye is in, one that has a stretch in the clear)
  {
    if (coreRoom && topSet.has(coreRoom)) showable.add(coreRoom);
    const rooms = [...topSet].filter(r => r !== coreRoom).sort((x, y) => (interestOf.get(x)!.interest - interestOf.get(y)!.interest) || x.no.localeCompare(y.no));
    for (const r of rooms) {
      const lv = Le.rooms.includes(r) ? Le : Lh;
      let inside = 0; for (let i = 0; i < N; i += 6) if (inRect(pos[3 * i], pos[3 * i + 2], r.b, 0) && Math.abs(pos[3 * i + 1] - lv.y - 1.4) < 1.2) inside += 6 * dt;
      if (inside >= 1.3) { showable.add(r); continue; }
      const it = interestOf.get(r)!, fp: V3 = it.focal ? [it.focal.at[0], lv.y + 1.0, it.focal.at[1]] : [r.b.x + r.b.w / 2, lv.y + 1.1, r.b.z + r.b.d / 2];
      const ok = new Uint8Array(N);
      for (let i = 0; i < N; i += 6) {
        const b = BEATS[beatOf[i]]; if (b !== 'reveal' && b !== 'route' && b !== 'roomReveal' && b !== 'threshold') continue;
        const p = eyeAt(i); if (levelIdAt(p) !== lv.id) continue;
        const d = Math.hypot(fp[0] - p[0], fp[2] - p[2]); if (d > 9 || d < 1.0) continue;
        const q = eyeAt(Math.min(N - 1, i + 60)), hx = q[0] - p[0], hz = q[2] - p[2], toF = Math.atan2(fp[0] - p[0], fp[2] - p[2]);
        if (Math.abs(wrapPi(toF - (Math.hypot(hx, hz) > 0.3 ? Math.atan2(hx, hz) : toF))) > 100 * DEG) continue;
        if (!probe.clear(p, fp)) continue;
        for (let k = i; k < Math.min(N, i + 6); k++) ok[k] = 1;
      }
      let a0 = 0, bestA = 0, bestB = 0;
      for (let i = 0; i <= N; i++) {
        if (i < N && ok[i]) { if (!a0 && (i === 0 || !ok[i - 1])) a0 = i || 1; continue; }
        if (a0) { const a = a0 === 1 && ok[0] ? 0 : a0, len = i - a; if (len > bestB - bestA) { bestA = a; bestB = i; } a0 = 0; }
      }
      if ((bestB - bestA) * dt < 0.9) continue;
      const mid = (bestA + bestB) >> 1, half = Math.min(Math.round(0.75 * FPS), (bestB - bestA) >> 1);
      for (let k = mid - half; k < mid + half; k++) mustLook[k] = fp;
      showable.add(r);
    }
  }
  const subjectAt = (i: number): { p: V3; w: number; kind: string } => {
    const b = BEATS[beatOf[i]], p = eyeAt(i);
    switch (b) {
      // (the establishing aim slides from the facade's centre to the door as the move comes in, so the look is
      // already on the way in when the approach takes over)
      case 'establish': {
        // (steps against the facade: toward the top of the flight, from early on — the look has to be up the steps,
        // not on the wall beside them, when the move lands at their foot)
        const next: V3 = stepsSeg ? [stepsSeg[stepsSeg.length - 1][0], stepsSeg[stepsSeg.length - 1][1] - 0.3, stepsSeg[stepsSeg.length - 1][2]] : doorSubject;
        const u = smooth(clamp((i * dt - (stepsSeg ? 0.15 : 0.35) * estT1) / ((stepsSeg ? 0.8 : 0.65) * estT1), 0, 1));
        // (with steps to climb the opening already looks half way to their top: the yaw limit of 12°/s could not turn it the
        // whole way in the time the move has)
        const aim0 = stepsSeg ? lerp3(est.aim, next, 0.8) : est.aim;
        return { p: lerp3(aim0, next, (stepsSeg ? 0.9 : 0.7) * u), w: 1, kind: 'facade' };
      }
      case 'extStair': return { p: stepsSeg ? [stepsSeg[stepsSeg.length - 1][0], stepsSeg[stepsSeg.length - 1][1] - 0.1, stepsSeg[stepsSeg.length - 1][2]] : doorSubject, w: 0.5, kind: 'door' };
      case 'approach': return { p: doorSubject, w: 0.7, kind: 'door' };
      case 'threshold': return { p: sightline, w: 0.7, kind: 'sightline' };
      case 'reveal': { const lv = levelIdAt(p) || Le.id; const g = glanceAt(i, lv); if (g) return { p: g.p, w: 0.6, kind: 'glance' }; const r = nav.roomAt(lv, p[0], p[2]); return { p: focalOf(r, lv) || sightline, w: 0.6, kind: 'room' }; }
      case 'route': {
        // the flight of stairs the walk is about to take (the next 2.2 s): the look goes to it — its steps rising, the way down —
        // rather than to the wall a walk that turns into it faces until the last step
        { let fb: Beat | null = null, fp: V3 | null = null;
          for (let k = i; k < Math.min(N, i + Math.round(2.2 * FPS)); k += 6) { const bk = BEATS[beatOf[k]]; if (bk === 'stair' || bk === 'descend') { fb = bk; fp = eyeAt(k); break; } }
          if (fb && fp) {
            let st2: WStair | null = null, bd2 = Infinity;
            for (const f of flights) { const c0 = f.st.path ? f.st.path[0] : f.st.bottom, d0 = Math.hypot(fp[0] - c0[0], fp[2] - c0[2]); if (d0 < bd2) { bd2 = d0; st2 = f.st; } }
            if (st2 && bd2 < 3.5) {
              const dF = st2.dir0 || st2.dir, up2 = fb === 'stair';
              const tgt: V3 = st2.spiral ? [st2.bottom[0], st2.bottom[1] + (up2 ? 1.6 : 1.0), st2.bottom[2]]
                : up2 ? [st2.bottom[0] + dF[0] * 2.0, st2.bottom[1] + 1.9, st2.bottom[2] + dF[1] * 2.0] : [st2.top[0] - st2.dir[0] * 1.6, st2.top[1] + 0.2, st2.top[2] - st2.dir[1] * 1.6];
              return { p: tgt, w: 0.8, kind: 'flight' };
            }
          } }
        // inside the Core's room the Core is what the walk is going to — and for the 2.6 s before the room reveal on its storey, the look turns to it (the room reveal's yaw cap is 20°/s and the push-in's 15: a view that
        // is still on the room beside it when they begin cannot get onto the Core in the time they have)
        if (coreRoom && levelIdAt(p) === Lh.id && inRect(p[0], p[2], coreRoom.b, 0.05)) return { p: coreTarget, w: 0.65, kind: 'core+focal' };
        { const tt = i * dt, t0 = tRoom - 2.6; if (tt > t0 && levelIdAt(p) === Lh.id) return { p: coreTarget, w: 0.5 + 0.35 * smooth((tt - t0) / 2.6), kind: 'core+focal' }; }
        // the room worth seeing in front of the eye, else the next room ahead: the room 2.5 m on along the path
        const lv = levelIdAt(p) || Le.id, here = nav.roomAt(lv, p[0], p[2]);
        // (no glance in the last 3 s of the walk to the Core's room: the corner into it is where the view has most to turn, at the room reveal's 20°/s — it follows the walk round the corner, never a room beside it first)
        if (!(lv === Lh.id && i * dt > tRoom - 3.0)) { const g = glanceAt(i, lv); if (g) return { p: g.p, w: 0.55, kind: 'glance' }; }
        let ahead: WRoom | null = null;
        for (let k = i; k < Math.min(N, i + Math.round(3 * FPS)); k += 12) { const q = eyeAt(k); const l2 = levelIdAt(q); if (l2 !== lv) break; const r = nav.roomAt(lv, q[0], q[2]); if (r && r !== here) { ahead = r; break; } }
        return { p: focalOf(ahead || here, lv) || sightline, w: 0.5, kind: 'next room' };
      }
      case 'stair': case 'descend': {
        // the flight whose axis the eye is nearest
        let st: WStair | null = null, bd = Infinity;
        for (const f of flights) { const a = f.st.bottom, b2 = f.st.top, dx = b2[0] - a[0], dz = b2[2] - a[2], l2 = dx * dx + dz * dz || 1e-9, u = clamp(((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / l2, 0, 1), d = Math.hypot(p[0] - a[0] - dx * u, p[2] - a[2] - dz * u) + Math.abs(p[1] - (a[1] + (b2[1] - a[1]) * u) - 1.5) * 0.5; if (d < bd) { bd = d; st = f.st; } }
        if (!st) return { p: coreTarget, w: 0, kind: 'none' };
        const up = b === 'stair';
        // a spiral climbs inside a well one door wide: the walls are a hand's breadth away whichever way the eye faces along the
        // floor, so the look goes on round the helix where it is going, up (or down) the treads and the column
        if (st.spiral) { const q = eyeAt(Math.min(N - 1, i + Math.round(1.1 * FPS))); return { p: [q[0], q[1] + (up ? 0.9 : -0.5), q[2]], w: 0.9, kind: 'helix ahead' }; }
        const tgt: V3 = up ? [st.top[0] + st.dir[0] * 2.5, st.top[1] + 1.4, st.top[2] + st.dir[1] * 2.5] : [st.bottom[0] - st.dir[0] * 2.5, st.bottom[1] + 1.0, st.bottom[2] - st.dir[1] * 2.5];
        return { p: tgt, w: 0.4, kind: up ? 'landing' : 'foot' };
      }
      case 'roomReveal': { const f = focalOf(coreRoom, Lh.id); const mid: V3 = f ? lerp3(coreTarget, f, 0.2) : coreTarget; return { p: mid, w: 0.85, kind: 'core+focal' }; }
      default: return { p: coreTarget, w: 1, kind: 'core' };
    }
  };
  // visibility of each sample's subject, every 0.1 s (the Core's with its own test)
  const vis = new Float64Array(N);
  const subj: Array<{ p: V3; w: number; kind: string }> = new Array(N);
  for (let i = 0; i < N; i++) subj[i] = mustLook[i] && !(i * dt > tRoom - 3.0 && levelIdAt(eyeAt(i)) === Lh.id) ? { p: mustLook[i]!, w: 0.9, kind: 'must-see' } : subjectAt(i);
  for (let i = 0; i < N; i += 12) {
    const s = subj[i], p = eyeAt(i);
    const roofs = OUTSIDE.has(BEATS[beatOf[i]]);
    const v = s.kind === 'core' ? 1 : s.kind === 'core+focal' ? (probe.coreSeen(p, core) >= 0.5 ? 1 : probe.visibility(p, s.p, 0.2, false)) : s.kind === 'facade' ? 1 : probe.visibility(p, s.p, 0.2, roofs);
    for (let k = i; k < Math.min(N, i + 12); k++) vis[k] = v >= 0.6 ? 1 : 0;
  }
  const visS = hann(vis, Math.round(0.25 * FPS));
  // the wanted direction per sample: the look-ahead point and the subject, blended
  const yawD = new Float64Array(N), pitchD = new Float64Array(N), distD = new Float64Array(N);
  const DX = new Float64Array(N), DY = new Float64Array(N), DZ = new Float64Array(N);
  const speedAt = (i: number) => { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1); return Math.hypot(pos[3 * b] - pos[3 * a], pos[3 * b + 1] - pos[3 * a + 1], pos[3 * b + 2] - pos[3 * a + 2]) / ((b - a) * dt); };
  for (let i = 0; i < N; i++) {
    const p = eyeAt(i), b = BEATS[beatOf[i]], s = subj[i];
    const v = speedAt(i), ahead = Math.max(1.5, v * 1.2);
    // the look-ahead point: that far on along the path (at eye height, 0.2 m down), found on the dense path
    const sa = Math.min(total, sOfT[i] + ahead), q = sampleAt(sa);
    let aheadPt: V3 = [q.x, q.y - 0.2, q.z];
    if (len(sub(aheadPt, p)) < 0.5) aheadPt = add(p, [pos[3 * Math.min(N - 1, i + 1)] - pos[3 * Math.max(0, i - 1)], 0, pos[3 * Math.min(N - 1, i + 1) + 2] - pos[3 * Math.max(0, i - 1) + 2]]);
    let ws = s.w * visS[i];
    const da = norm(sub(aheadPt, p)), dsj = norm(sub(s.p, p));
    // a subject behind the way the eye is going is not looked at: its weight fades from 40° off the look-ahead to
    // none at 100° (the camera never walks backwards to keep something in frame)
    { const c = (da[0] * dsj[0] + da[2] * dsj[2]) / ((Math.hypot(da[0], da[2]) * Math.hypot(dsj[0], dsj[2])) || 1);
      // (the Core, as the walk comes into its room, stays in the blend further round: it is where the film is going)
      const [lo, hi] = s.kind === 'core+focal' ? [55, 95] : s.kind === 'must-see' ? [80, 120] : [40, 100];
      ws *= clamp((c - Math.cos(hi * DEG)) / (Math.cos(lo * DEG) - Math.cos(hi * DEG)), 0, 1); }
    if (b === 'orbit' || b === 'power' || b === 'hero' || b === 'establish') ws = 1;
    const d = norm(add(mul(da, 1 - ws), mul(dsj, ws)));
    DX[i] = d[0]; DY[i] = d[1]; DZ[i] = d[2];
    distD[i] = Math.max(b === 'hero' || b === 'orbit' || b === 'power' ? 0.8 : 2, ws > 0.5 ? len(sub(s.p, p)) : 3);
  }
  // wall-stare avoidance (§3.10 never aim at a wall closer than 2.5 m, §3.13 no blank frame), as a search over time: every 0.1 s indoors
  // the wanted yaw may be turned by up to ±84° (15 states), what a state costs is its distance from the wanted direction (the subject
  // and the look-ahead), the share of the frame's 7 × 5 rays that fall on one plane within 3 m (a wall filling the frame) and the
  // view's depth, and the turn from one step's state to the next; the cheapest path through the states (Viterbi) is the yaw offset
  // per step. The offset builds before the wall fills the frame, because the path is chosen as a whole — a turn that needs 1.5 s at the
  // beat's yaw cap is asked for 1.5 s ahead — and it is zero wherever the wanted direction shows a room.
  const planeShare = (rays: Array<{ t: number; k: number; key: string }>, D: number) => {
    const by = new Map<string, number>(); let m = 0;
    for (const r of rays) if (r.t <= D && (r.k === K.wall || r.k === 0 || r.k === K.rail)) { const v = (by.get(r.key) || 0) + 1; by.set(r.key, v); if (v > m) m = v; }
    return m / rays.length;
  };
  {
    const STARE_D = 3, SP = 12, NS = Math.ceil(N / SP), OFFS = [-84, -72, -60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60, 72, 84], NO = OFFS.length, ZERO = 7;
    // (inside the wall and foreground terms both count; on the way in from the street only the foreground — a facade fills the frame at the door — and
    // only within 1 m: a shrub or a trunk the eye passes)
    const modeOf = (i: number): 'in' | 'out' | null => { const b = BEATS[beatOf[i]]; if (b === 'hero' || b === 'orbit' || b === 'power' || b === 'establish') return null; if (b === 'approach' || b === 'extStair') return 'out'; const p = eyeAt(i); return indoors(world, p[0], p[1], p[2]) ? 'in' : null; };
    const foreShare = (rays: Array<{ t: number; k: number }>) => rays.filter(r => r.t < 1.0 && r.k !== 0 && r.k !== K.surface && r.k !== K.core && r.k !== K.monitor && r.k !== K.heroSet).length / rays.length;
    const data: Float64Array[] = [], flagged: boolean[] = [];
    for (let t = 0; t < NS; t++) {
      const i = Math.min(N - 1, t * SP), row = new Float64Array(NO);
      for (let o = 0; o < NO; o++) row[o] = 0.6 * (OFFS[o] / 40) ** 2;
      let fl = false;
      const mode = modeOf(i);
      if (mode) {
        const p = eyeAt(i), d: V3 = [DX[i], DY[i], DZ[i]], y0 = Math.atan2(d[0], d[2]), pz = Math.asin(clamp(d[1], -1, 1)), fv = fov[i];
        const roofsOn = mode === 'out' && roofAlpha[i] > 0.5;
        const cam = (y: number) => { const dd: V3 = [Math.sin(y) * Math.cos(pz), Math.sin(pz), Math.cos(y) * Math.cos(pz)]; return camera(p, add(p, mul(dd, 3)), fv); };
        const c0 = probe.composition(cam(y0), roofsOn, STARE_D, STARE_D + 0.5);
        const stare = (c: { rays: any[] }) => mode === 'in' ? planeShare(c.rays, STARE_D) : 0;
        if (stare(c0) >= 0.22 || foreShare(c0.rays) >= 0.18) {
          fl = true;
          const q = eyeAt(Math.min(N - 1, i + 150)), moving = Math.hypot(q[0] - p[0], q[2] - p[2]) > 0.5, hd = moving ? Math.atan2(q[0] - p[0], q[2] - p[2]) : y0;   // (where the eye is going over the next 1.25 s)
          for (let o = 0; o < NO; o++) {
            const y = y0 + OFFS[o] * DEG, c = o === ZERO ? c0 : probe.composition(cam(y), roofsOn, STARE_D, STARE_D + 0.5);
            const depth = c.rays.map(r => Math.min(r.t, 8)).sort((a, b) => a - b)[17], crab = Math.max(0, Math.abs(wrapPi(y - hd)) / DEG - 35);
            row[o] += 14 * Math.max(0, stare(c) - 0.2) + 12 * Math.max(0, foreShare(c.rays) - 0.12) + (mode === 'in' ? 0.25 * Math.max(0, 3.5 - depth) : 0) + 0.05 * crab;
          }
        }
      }
      data.push(row); flagged.push(fl);
    }
    if (flagged.some(Boolean)) {
      // Viterbi: at most 36° (three states) of change per step, a cost on the change
      const cost: Float64Array[] = [], from: Int8Array[] = [];
      cost.push(Float64Array.from(data[0])); from.push(new Int8Array(NO));
      for (let t = 1; t < NS; t++) {
        const row = new Float64Array(NO), fr = new Int8Array(NO);
        for (let o = 0; o < NO; o++) {
          let bc = Infinity, bo = o;
          for (let q = Math.max(0, o - 3); q <= Math.min(NO - 1, o + 3); q++) { const c = cost[t - 1][q] + 0.5 * ((o - q) / 1) ** 2 * 0.25; if (c < bc - 1e-12) { bc = c; bo = q; } }
          row[o] = bc + data[t][o]; fr[o] = bo;
        }
        cost.push(row); from.push(fr);
      }
      let o = 0; for (let q = 1; q < NO; q++) if (cost[NS - 1][q] < cost[NS - 1][o] - 1e-12) o = q;
      const off = new Float64Array(NS); for (let t = NS - 1; t >= 0; t--) { off[t] = OFFS[o] * DEG; o = from[t][o]; }
      // the offsets between the steps by a smooth interpolation, then applied to the wanted direction
      for (let i = 0; i < N; i++) {
        const u = i / SP, t0 = Math.min(NS - 1, Math.floor(u)), t1 = Math.min(NS - 1, t0 + 1), f = u - t0, sm = f * f * (3 - 2 * f), a = off[t0] * (1 - sm) + off[t1] * sm;
        if (Math.abs(a) < 1e-4) continue;
        const c = Math.cos(a), sn = Math.sin(a), x = DX[i], z = DZ[i];
        DX[i] = x * c + z * sn; DZ[i] = -x * sn + z * c;
      }
    }
  }
  // the view never turns more than 65° off the way the eye is going (over the next 0.4 s) while it walks: a look further round is a walk against it
  // (QA's crab over 60°, `reverse` past 101°) — the glance at a room, the flight ahead and the Core are looked at as far round as that, and the eye's
  // own turn brings them the rest of the way
  {
    const CRAB = 65 * DEG, LEAD = Math.round(0.4 * FPS);
    for (let i = 0; i < N; i++) {
      const b = BEATS[beatOf[i]]; if (b === 'establish' || b === 'hero' || b === 'orbit' || b === 'power') continue;
      const cap = b === 'stair' || b === 'descend' ? 75 * DEG : CRAB;   // (a flight that turns at its landing: the look is on the way off it, a little further round)
      const j = Math.min(N - 1, i + LEAD), hx = pos[3 * j] - pos[3 * i], hz = pos[3 * j + 2] - pos[3 * i + 2];
      if (Math.hypot(hx, hz) < 0.1) continue;
      const hd = Math.atan2(hx, hz), y = Math.atan2(DX[i], DZ[i]), diff = wrapPi(y - hd);
      if (Math.abs(diff) <= cap) continue;
      const y2 = hd + Math.sign(diff) * cap, ch = Math.hypot(DX[i], DZ[i]);
      DX[i] = Math.sin(y2) * ch; DZ[i] = Math.cos(y2) * ch;
    }
  }
  // the wanted directions smoothed across the beats' seams (a 0.5 s Hann on the unit vectors), so a change of
  // subject is a turn over half a second, never a step the limiter has to chase
  {
    const hw = Math.round(0.25 * FPS);
    const sx = hann(DX, hw), sy = hann(DY, hw), sz = hann(DZ, hw);
    for (let i = 0; i < N; i++) { const l = Math.hypot(sx[i], sy[i], sz[i]) || 1; DX[i] = sx[i] / l; DY[i] = sy[i] / l; DZ[i] = sz[i] / l; yawD[i] = Math.atan2(DX[i], DZ[i]); pitchD[i] = Math.atan2(DY[i], Math.hypot(DX[i], DZ[i])); }
  }
  // unwrap, clamp pitch, limit yaw rate per beat both ways (zero-phase), smooth
  for (let i = 1; i < N; i++) yawD[i] = yawD[i - 1] + wrapPi(yawD[i] - yawD[i - 1]);
  const desiredYaw = yawD.slice(), desiredPitch = pitchD.slice();
  const indoor = (i: number) => !OUTSIDE.has(BEATS[beatOf[i]]) && BEATS[beatOf[i]] !== 'establish';
  // the pitch clamp of each sample: the beat's range (§3.5), level within ±8° indoors outside the stairs and the finale. The limits
  // themselves are smoothed across the seams (a 0.6 s Hann): a tighter beat's clamp releasing into a looser one's the instant the
  // beat changes would step the wanted pitch by several degrees in one sample — a pop, at every seam
  const pLo = new Float64Array(N), pHi = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const b = BEATS[beatOf[i]]; let [lo, hi] = PITCH[b];
    if (b === 'establish' && est.style === 'dollhouse') lo = -40;
    if (indoor(i) && !['stair', 'descend', 'hero', 'orbit', 'power', 'roomReveal'].includes(b)) { lo = Math.max(lo, -8); hi = Math.min(hi, 8); }
    pLo[i] = lo * DEG; pHi[i] = hi * DEG;
  }
  const pLoS = hann(pLo, Math.round(0.3 * FPS)), pHiS = hann(pHi, Math.round(0.3 * FPS));
  for (let i = 0; i < N; i++) pitchD[i] = clamp(pitchD[i], pLoS[i], pHiS[i]);
  // the zero-phase rate limiter: pairs that step faster than the cap are pulled together symmetrically, sweep after
  // sweep forward and back (a fixed count), so the result keeps to the cap without the lag a one-way limiter has and
  // without dragging either end of the shot off its subject
  const limit = (arr: Float64Array, capOf: (i: number) => number) => { const c = new Float64Array(N); for (let i = 0; i < N; i++) c[i] = capOf(i) * dt; return rateLimit(arr, c); };
  // (the establishing move's 12°/s opens up to the next beat's cap over its last 0.3 s — the seam QA allows the looser of the two caps over — where it hands the look over)
  const nextAfterEst = beats.find(x => x.name !== 'establish')?.name || 'approach';
  const yawCapAt = (i: number) => {
    const b = BEATS[beatOf[i]], t = i * dt;
    if (b === 'establish' && t > estT1 - 0.3) return (YAW_CAP.establish + (YAW_CAP[nextAfterEst] - YAW_CAP.establish) * clamp((t - estT1 + 0.3) / 0.3, 0, 1)) * DEG * 0.9;
    return YAW_CAP[b] * DEG * (b === 'hero' || b === 'roomReveal' ? 0.78 : 0.9);   // (the plan's tight caps — 15 and 20 — keep a margin for the smoothing that follows and the pitch that turns with the yaw)
  };
  let yaw = hann(limit(yawD, yawCapAt), Math.round(0.125 * FPS));
  let pitch = hann(limit(pitchD, i => (YAW_CAP[BEATS[beatOf[i]]] * 0.5 + 3) * DEG), Math.round(0.125 * FPS));
  // the pitch clamps (and the verticals: level within ±8° indoors outside the stairs and the finale) once more after the
  // smoothing, which can carry a value a degree or two over one
  for (let i = 0; i < N; i++) pitch[i] = clamp(pitch[i], pLoS[i], pHiS[i]);
  const distS = hann(distD, Math.round(0.25 * FPS));
  // the baked look: the solved direction at the solved distance
  const look = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) {
    const cy = Math.cos(pitch[i]), d = distS[i];
    look[3 * i] = pos[3 * i] + Math.sin(yaw[i]) * cy * d; look[3 * i + 1] = pos[3 * i + 1] + Math.sin(pitch[i]) * d; look[3 * i + 2] = pos[3 * i + 2] + Math.cos(yaw[i]) * cy * d;
  }
  // the finale: the look is locked on the Core — the limiter above keeps it there at orbit rates; pin it exactly so
  // the Core never drifts in frame (the compose offset is applied on top when sampled)
  for (let i = 0; i < N; i++) {
    const b = BEATS[beatOf[i]]; if (b !== 'orbit' && b !== 'power') continue;
    const w = smooth(ramp(i * dt, tOrbit, tOrbit + 0.9));
    for (let c = 0; c < 3; c++) look[3 * i + c] = look[3 * i + c] * (1 - w) + centre[c] * w;
  }
  const desired = new Float32Array(2 * N); for (let i = 0; i < N; i++) { desired[2 * i] = desiredYaw[i]; desired[2 * i + 1] = desiredPitch[i]; }

  // ---- 13. events: the press, when the Core has been seen 1.5 s and the camera has settled (§3.12) ---------------
  const track: Track = {
    version: 2, planner: 'v2', type: opts.inside ? 'walkthrough' : 'door-to-core', id: world.id, duration, fps: FPS, samples: N, dt,
    pos, look, fov, roofAlpha, composeW, compose, beat: beatOf, beats,
    events: { enterT, stairT: beats.filter(b => b.name === 'stair' || b.name === 'descend').map(b => b.t0), pressT: null, settleT: tPower, doneT: duration, firstCoreT: null },
    doors: planDoors(world, pos, N, dt), metrics: {}, plan: {}, desired, subj: new Float32Array(3 * N),
  };
  for (let i = 0; i < N; i++) { const q = subj[i].p; track.subj![3 * i] = q[0]; track.subj![3 * i + 1] = q[1]; track.subj![3 * i + 2] = q[2]; }
  // first moment from which the Core stays in frame and seen
  let firstCore: number | null = null;
  for (let i = N - 1; i >= 0; i -= 6) {
    const fr = sampleTrack(track, i * dt / duration);
    const cam = camera(fr.eye, fr.target, fr.fov);
    const p = project(cam, centre);
    const ok = p[2] > 0 && Math.abs(p[0]) < 0.9 && Math.abs(p[1]) < 0.9 && probe.coreSeen(fr.eye, core) >= 0.95;
    if (!ok) break;
    firstCore = i * dt;
  }
  track.events.firstCoreT = firstCore === null ? null : +firstCore.toFixed(4);
  const pressT = Math.min(duration - 1.4, Math.max(tPower + 0.3, (firstCore ?? tPower) + 1.5));
  track.events.pressT = +pressT.toFixed(4);
  track.beats.forEach(b => {
    const mid = Math.min(N - 1, Math.round(((b.t0 + b.t1) / 2) / dt)); const s = subj[mid];
    b.subject = s ? [+(s.p[0]).toFixed(3), +(s.p[1]).toFixed(3), +(s.p[2]).toFixed(3)] : null;
  });
  track.plan = {
    establish: { style: est.style, bearing: +est.bearing.toFixed(1), eye: est.eye.map(v => +v.toFixed(2)), fit: +est.fit.toFixed(3), sky: +est.sky.toFixed(3), roofOff: est.roofOff, scores: est.scores },
    approach: { pathLed, steps: !!stepsSeg },
    flights: flights.map(f => ({ from: f.st.from, to: f.st.to, up: f.up, spiral: f.st.spiral })),
    rooms: [...new Set(routeRooms)], coreRoom: coreRoom ? coreRoom.name : null,
    orbit: orbitMeta, finalFov: +finalFov.toFixed(1), endPose, Tmin: +Tmin.toFixed(2), length: +total.toFixed(2), notes,
    lengths: Object.fromEntries([...beatRanges].map(([b, rs]) => [b, +rs.reduce((a, [i0, i1]) => a + S[i1] - S[i0], 0).toFixed(2)])),
  };
  track.metrics = { length: +total.toFixed(2), Tmin: +Tmin.toFixed(2), duration };
  track.plan.outside = { share: +(outsideCaps / duration).toFixed(3), caps: +outsideCaps.toFixed(2), establish: +(capTimes.get('establish') || 0).toFixed(2), others: +(outsideCaps - (capTimes.get('establish') || 0)).toFixed(2), hasExt };
  track.plan.routeLimit = limitStats;
  track.plan.topRoomsShowable = showable.size; track.plan.topRooms = [...topSet].map(r => r.name);
  track.plan.routeCap = +ROUTE_CAP.toFixed(2);
  track.plan.finaleCands = finaleCands;
  track.plan.finaleTried = triedLog; track.plan.orbitPlans = orbitPlans.map(p => ({ r: +p.r.toFixed(2), hs: p.hs, lens: p.lens, arc: Math.max(...p.options.map((o: any) => o.arc)), score: +p.score.toFixed(0) }));
  track.plan.finaleAll = finaleAll;
  track.plan.capBeatTimes = Object.fromEntries([...capTimes].map(([b, v]) => [b, +v.toFixed(2)]));
  track.plan.rawBeatTimes = Object.fromEntries([...beatTimes(Traw)].map(([b, v]) => [b, +v.toFixed(2)]));
  track.tanHReq = coreTanH(track, world);
  track.hash = trackHash(track);
  return { ok: true as const, track, world, notes };
}

// ---- sampling: the page's applySplineFrame and QA read the track through this ---------------------------------------
/** The lens a narrow frame needs (see Track.tanHReq): for each sample where the Core's box is in the 16:9 frame, the horizontal half-tangent at which the
 *  box, with its composed offset, reaches 0.92 of the half-frame — the frame's 8 % margin. Baked once; sampleTrack reads it for aspects under 16:9. */
export function coreTanH(track: Track, world: ShotWorld): Float32Array {
  const N = track.samples, out = new Float32Array(N), hero = world.hero; if (!hero) return out;
  const core = hero.core, REF = 16 / 9;
  // (only in the finale — the walk into the Core's room, the push-in, the orbit, the press — where the Core is the subject; from outside, or through a wall, it is in
  // the frame by chance and the lens is the walk's; the need comes in over the first 0.6 s of the roomReveal)
  const FIN = new Set([BEATS.indexOf('roomReveal'), BEATS.indexOf('hero'), BEATS.indexOf('orbit'), BEATS.indexOf('power')]);
  let iFin = -1; for (let i = 0; i < N; i++) if (FIN.has(track.beat[i])) { iFin = i; break; }
  for (let i = 0; i < N; i++) {
    if (iFin < 0 || i < iFin || !FIN.has(track.beat[i])) continue;
    const f = sampleTrack(track, i / (N - 1), REF), cam = camera(f.eye, f.target, f.fov, REF), pb = projectBox(cam, core);
    if (!pb) continue;
    // (the need fades in as the box comes into the 16:9 frame — from 2.2 to 1.4 of its half-width — so the lens never steps when the Core enters it)
    const reach = Math.max(-pb.minX, pb.maxX, -pb.minY, pb.maxY), fade = Math.max(0, Math.min(1, (2.2 - reach) / 0.8));
    if (fade <= 0) continue;
    const half = (pb.maxX - pb.minX) / 2, cx = Math.abs((pb.maxX + pb.minX) / 2), tv = Math.tan(f.fov * DEG / 2);
    const ramp = Math.min(1, (i - iFin) * track.dt / 0.6);
    out[i] = ramp * ramp * (3 - 2 * ramp) * fade * fade * (3 - 2 * fade) * half * tv * REF / Math.max(0.25, 0.7 - cx);
  }
  return hann(out.length ? Float64Array.from(out) : new Float64Array(0), Math.round(0.2 * FPS)).reduce((a, v, i) => { a[i] = v; return a; }, out);
}

/** frame at shot fraction t (0…1) for an aspect: { eye, target, fov, roofAlpha, s: t, beat } — cubic Hermite on
 *  position and look, monotone on fov and roofAlpha; the Core's composition applied for this aspect */
export function sampleTrack(track: Track, t: number, aspect = 16 / 9) {
  const N = track.samples, u = clamp(t, 0, 1) * (N - 1);
  const i = Math.min(N - 2, Math.floor(u)), f = u - i;
  const herm = (arr: Float32Array, k: number, c: number) => {
    const p0 = arr[3 * Math.max(0, k - 1) + c], p1 = arr[3 * k + c], p2 = arr[3 * (k + 1) + c], p3 = arr[3 * Math.min(N - 1, k + 2) + c];
    const m1 = (p2 - p0) / 2, m2 = (p3 - p1) / 2, f2 = f * f, f3 = f2 * f;
    return (2 * f3 - 3 * f2 + 1) * p1 + (f3 - 2 * f2 + f) * m1 + (-2 * f3 + 3 * f2) * p2 + (f3 - f2) * m2;
  };
  const lin = (arr: Float32Array) => arr[i] + (arr[i + 1] - arr[i]) * f;
  const eye: V3 = [herm(track.pos, i, 0), herm(track.pos, i, 1), herm(track.pos, i, 2)];
  let target: V3 = [herm(track.look, i, 0), herm(track.look, i, 1), herm(track.look, i, 2)];
  let fov = lin(track.fov);
  const roofAlpha = lin(track.roofAlpha), w = lin(track.composeW);
  // a frame narrower than 16:9 (a portrait phone, a square still) widens its lens where the Core is in it, just enough for the Core's box to stay inside
  // with its margin (the orbit holds the Core in the middle 70 %): the horizontal reach is what a narrow frame is short of
  if (track.tanHReq && aspect < 16 / 9 - 1e-6) { const req = lin(track.tanHReq); if (req > 0) { const tv0 = Math.tan(fov * DEG / 2), tv1 = Math.max(tv0, req / aspect); fov = 2 * Math.atan(tv1) / DEG; } }
  if (track.compose && w > 1e-4) {
    const c = track.compose, dx = target[0] - eye[0], dy = target[1] - eye[1], dz = target[2] - eye[2], dh = Math.hypot(dx, dz), d = Math.hypot(dx, dy, dz);
    const yaw = Math.atan2(dx, dz), pitch = Math.atan2(dy, dh), tv = Math.tan(fov * DEG / 2);
    const yaw2 = yaw + Math.atan(w * c.ndcX * tv * aspect), pitch2 = pitch - Math.atan(w * c.ndcY * tv);
    target = [eye[0] + Math.sin(yaw2) * Math.cos(pitch2) * d, eye[1] + Math.sin(pitch2) * d, eye[2] + Math.cos(yaw2) * Math.cos(pitch2) * d];
  }
  return { eye, target, fov, roofAlpha, s: clamp(t, 0, 1), beat: BEATS[track.beat[f < 0.5 ? i : i + 1]] };
}

/** a stable hash of a track: FNV-1a over the bytes of everything that decides the film — the arrays (eye, look, lens, roof,
 *  the Core's compose weight, every door channel, the wanted look, the beat of each sample), the compose target, the events
 *  (the press drives the Core's LED and fan, the entry the roof fade) and the beat list with its subjects. The harness compares
 *  Node's with the page's; a difference in any of these is a different film, so all of them are in it. */
export function trackHash(track: Track) {
  let h = 0x811c9dc5;
  const feed = (b: Uint8Array) => { for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); } };
  const one = new Float64Array(1), oneB = new Uint8Array(one.buffer);
  const num = (x: number | null | undefined) => { one[0] = x === null || x === undefined ? -1e300 : x; feed(oneB); };
  const str = (t: string) => { for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i) & 255; h = Math.imul(h, 0x01000193); } h ^= 0xff; h = Math.imul(h, 0x01000193); };
  const arr = (a: ArrayBufferView | undefined) => { if (a) feed(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); else num(null); };
  const doorIds = Object.keys(track.doors || {}).sort();
  for (const a of [track.pos, track.look, track.fov, track.roofAlpha, track.composeW, track.beat, track.desired, track.subj, track.tanHReq, ...doorIds.map(id => track.doors[id])]) arr(a);
  for (const id of doorIds) str(id);
  num(track.compose ? track.compose.ndcX : null); num(track.compose ? track.compose.ndcY : null);
  const ev = track.events;
  for (const x of [ev.enterT, ev.pressT, ev.settleT, ev.doneT, ev.firstCoreT]) num(x);
  for (const x of ev.stairT) num(x); num(ev.stairT.length);
  for (const b of track.beats) { str(b.name); num(b.t0); num(b.t1); if (b.subject) for (const x of b.subject) num(x); else num(null); }
  return (h >>> 0).toString(16).padStart(8, '0') + ':' + track.samples + ':' + track.duration;
}

// ---- the page's preset (SplinePresets format) for a v2 track: three.js injected -------------------------------------
/** A planner-v2 shot as the page plays it: eyePoints / targetPoints every 0.25 s for the overlay and the curve the
 *  editor draws, `frameAt(t, aspect)` sampling the baked track (s = t: the roof rule and the dolly read time), the
 *  power as a shot fraction for driveCoresForShot, and the track itself for __houseShotTrack / QA v2. */
export function presetFromTrack(THREE: any, track: Track, meta: { type: string; name: string; world: ShotWorld; dressing?: any }) {
  const V = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);
  const eyePoints: any[] = [], targetPoints: any[] = [];
  const step = Math.max(1, Math.round(track.fps * 0.25));
  for (let i = 0; i < track.samples; i += step) { const f = sampleTrack(track, i / (track.samples - 1)); eyePoints.push(V(f.eye)); targetPoints.push(V(f.target)); }
  if ((track.samples - 1) % step) { const f = sampleTrack(track, 1); eyePoints.push(V(f.eye)); targetPoints.push(V(f.target)); }
  const ev = track.events, o = track.plan && track.plan.orbit, T = track.duration;
  const preset: any = {
    type: meta.type, planner: 'v2', dressing: meta.dressing || { walls: 'up', roof: 'auto' }, name: meta.name, duration: T, closed: false,
    eyePoints, targetPoints, track, beats: track.beats, events: ev,
    power: ev.pressT === null ? { at: -1 } : { at: +(ev.pressT / T).toFixed(5), ramp: +Math.max(0.02, Math.min(0.08, (T - ev.pressT) / T - 0.005)).toFixed(5) },   // (the LED and the fan finish spinning up before the last frame: never longer than what is left of the film)
    enterT: ev.enterT === null ? Infinity : +(ev.enterT / T).toFixed(5),
    orbit: o ? { t0: +(((track.beats.find(b => b.name === 'orbit') || { t0: 0 }).t0) / T).toFixed(4), t1: 1, radius: o.r, from: o.from, to: o.to, arc: o.arc, dir: o.dir, run: o.run } : null,
  };
  Object.defineProperty(preset, 'world', { value: meta.world, enumerable: false });
  preset.frameAt = (t: number, aspect = 16 / 9) => { const f = sampleTrack(track, t, aspect); return { s: f.s, u: f.s, eye: V(f.eye), target: V(f.target), fov: f.fov, roofAlpha: f.roofAlpha, beat: f.beat }; };
  return preset;
}
