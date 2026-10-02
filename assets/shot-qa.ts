// QA v2 (plan §3.14 and Completeness E): what a viewer would notice in a planner-v2 track, as numbers against
// thresholds — pacing, orientation, composition, the Core and its press, the route — besides the geometry v1
// checked. THREE-free: it reads the baked track (assets/shot-planner.ts) and the ShotWorld, so it runs in the page
// (window.__houseShotQA on a v2 shot) and in Node (scripts/test-shot-planner.mts) alike, and a test can feed it a
// deliberately bad track and see each check fire (scripts/test-shot-qa.mts).
//
// Sampling: every 120 Hz sample of the track for rates, beats and events; the eye path swept every 0.05 m (not
// every 1/12 s: a 12 Hz sample steps over a 0.1 m partition) for clips; a 7 × 5 ray grid every 0.1 s for the
// frame's composition; the Core's 19-point sight test at the moments that need it.
//
// Every finding: { code, level, t (s), tEnd, samples, subject, message }. Errors fail the gate, warnings are
// reported. `metrics` carries the numbers the fleet targets (camera-audit.mts) read.
//
// Owner: S5 (shot).
import { Math } from './detmath.js';
import { K, DEG, clamp, inRect, inFootprint, indoors, levelAt, wrapPi, createWorldIndex, leafSegment, type ShotWorld, type Box6 } from './shot-world.js';
import { firstCrossing, leafOpen, DOOR_DONE_S } from './shot-doors.js';
import { createProbe, camera, project, projectBox, bgClass, type V3 } from './shot-probe.js';
import { createNav, roomInterest } from './shot-nav.js';
import { sampleTrack, type Track } from './shot-planner.js';
import { BEATS, type Beat, beatWindow, filmBudget, BUDGET_SLACK, SPEC_LOOK_SUBJECT, LOOK_ERROR_WARN, LOOK_ERROR_STRETCH, SPEC_SPEED, SPEC_YAW, SPEC_PITCH, SPEC_FOV, BEAT_FLOOR, DOOR_PLANE_SPEED, DOOR_ZONE_M, DOORWAY_SPEED, YAW_WARN, YAW_ERROR, DOLLHOUSE_PITCH_MIN, INTERIOR_LEVEL_DEG, PITCH_ERROR, LENS_RATE, OUTSIDE_TARGET, OUTSIDE_ERROR, SPEC_ESTABLISH } from './shot-spec.js';
import { houseCorners, frameFit, wholeFit, coreHeightPct, lumOf } from './framing.js';

export type Finding = { code: string; level: 'error' | 'warn'; t: number; tEnd: number; samples: number; subject: string; message: string };
export type QAResult = { errors: Finding[]; warnings: Finding[]; metrics: Record<string, any> };

/** the beats that are outside the house: the establishing move, an exterior stair, the approach (the door itself is the threshold's) */
const OUTSIDE = new Set<Beat>(['establish', 'extStair', 'approach']);

/** every code QA v2 can report, with its level — the test (scripts/test-shot-qa.mts) injects a fault for each */
export const QA_CODES: Record<string, 'error' | 'warn'> = {
  'wall-clip': 'error', 'item-clip': 'error', 'site-clip': 'error', 'stair-clip': 'error', 'roof-clip': 'error', 'floor-clip': 'error', 'ceiling': 'error',
  'enters-through-wall': 'error', 'route-failed': 'error', 'ends-outside': 'error', 'core-missing': 'error', 'core-occluded': 'error',
  'late-core': 'error', 'void-clip': 'error', 'press-speed': 'error', 'press-yaw': 'error', 'press-frame': 'error', 'press-late': 'error',
  'yaw-whip': 'error', 'pitch': 'error', 'door-speed': 'error', 'reverse': 'error', 'hero-surface': 'error', 'monitor-near': 'error',
  'outside-share': 'error', 'blank-frame': 'error', 'dead-air': 'error', 'beat-floor': 'error', 'roof-timing': 'error', 'door-closed': 'error',
  'via-missed': 'error', 'attic-route': 'error', 'orbit-core-out-of-frame': 'error', 'orbit-core-occluded': 'error',
  'door-leaf': 'warn', 'door-zone-speed': 'warn', 'film-length': 'warn', 'yaw-rate': 'warn', 'beat-yaw': 'warn', 'outside-share-high': 'warn', 'first-second': 'warn', 'last-second': 'warn', 'floor-proximity': 'warn',
  'look-error': 'warn', 'core-height': 'warn', 'core-narrow': 'warn', 'core-thirds': 'warn', 'chair-share': 'warn', 'top-rooms': 'warn',
  'stair-short': 'warn', 'fov-rate': 'warn', 'fov-range': 'warn', 'near-blank': 'warn', 'beat-window': 'warn', 'beat-speed': 'warn',
  'doorway-speed': 'warn', 'accel': 'warn', 'jerk': 'warn', 'crab': 'warn', 'beat-pitch': 'warn', 'verticals': 'warn', 'look-near': 'warn',
  'graze': 'warn', 'look-whip': 'warn', 'look-snap': 'error', 'finale-blank': 'warn', 'door-funnel': 'warn', 'approach-axis': 'warn', 'establish-crop': 'warn', 'establish-sky': 'warn', 'establish-height': 'warn', 'establish-occluder': 'warn',
  'foreground-occluder': 'warn', 'monitor-cut': 'warn', 'core-contrast': 'warn', 'core-room-side': 'warn', 'orbit-short': 'warn',
  'orbit-swing-back': 'warn', 'orbit-yaw-rate': 'warn',
};

const lum = lumOf;

export function qaTrack(track: Track, world: ShotWorld, opts: { via?: string[]; aspect?: number; frameOnly?: boolean } = {}): QAResult {
  const index = createWorldIndex(world), probe = createProbe(index), nav = createNav(world, index);
  const errors: Finding[] = [], warnings: Finding[] = [];
  // consecutive samples with one code and subject collapse into one finding with a t range
  const push = (list: Finding[], code: string, t: number, subject: string, message: string) => {
    const last = list.length ? list.filter(f => f.code === code && f.subject === subject).pop() : null;
    if (last && t - last.tEnd <= 0.12) { last.tEnd = +t.toFixed(3); last.samples++; return; }
    list.push({ code, level: list === errors ? 'error' : 'warn', t: +t.toFixed(3), tEnd: +t.toFixed(3), samples: 1, subject, message });
  };
  const E = (code: string, t: number, m: string, subject = '') => push(errors, code, t, subject, m);
  const W = (code: string, t: number, m: string, subject = '') => push(warnings, code, t, subject, m);
  const aspect = opts.aspect || 16 / 9;
  const N = track.samples, dt = track.dt, T = track.duration;
  // door-to-core is the whole film (outside, the door, the route, the finale); hero-reveal and walkthrough stay inside
  // and are held to what applies to them
  const d2c = track.type === 'door-to-core';
  const hero = world.hero, entry = world.entry;
  const metrics: Record<string, any> = { duration: T, samples: N };
  if (track.plan && track.plan.failed) { E('route-failed', 0, track.plan.failed); return { errors, warnings, metrics }; }
  if (!hero) { E('core-missing', 0, 'no Companion Core in the world'); return { errors, warnings, metrics }; }
  const core = hero.core, centre: V3 = [(core[0] + core[3]) / 2, (core[1] + core[4]) / 2, (core[2] + core[5]) / 2];

  // ---- the frames, once: eye, target (composed, for this aspect), fov, beat --------------------------------------
  const eye: V3[] = [], tgt: V3[] = [], fov = new Float64Array(N), beat: Beat[] = [];
  for (let i = 0; i < N; i++) { const f = sampleTrack(track, i / (N - 1), aspect); eye.push(f.eye); tgt.push(f.target); fov[i] = f.fov; beat.push(BEATS[track.beat[i]]); }
  const dir = eye.map((e, i) => { const d = [tgt[i][0] - e[0], tgt[i][1] - e[1], tgt[i][2] - e[2]], l = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l] as V3; });
  const yaw = new Float64Array(N), pitch = new Float64Array(N);
  for (let i = 0; i < N; i++) { yaw[i] = Math.atan2(dir[i][0], dir[i][2]); pitch[i] = Math.asin(clamp(dir[i][1], -1, 1)); if (i) yaw[i] = yaw[i - 1] + wrapPi(yaw[i] - yaw[i - 1]); }
  const speed = new Float64Array(N), speedH = new Float64Array(N);
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1); speed[i] = Math.hypot(eye[b][0] - eye[a][0], eye[b][1] - eye[a][1], eye[b][2] - eye[a][2]) / ((b - a) * dt); speedH[i] = Math.hypot(eye[b][0] - eye[a][0], eye[b][2] - eye[a][2]) / ((b - a) * dt); }
  const tOf = (i: number) => i * dt;
  const beatSpans = new Map<Beat, Array<[number, number]>>();
  for (let i = 0; i < N;) { let j = i; while (j + 1 < N && beat[j + 1] === beat[i]) j++; if (!beatSpans.has(beat[i])) beatSpans.set(beat[i], []); beatSpans.get(beat[i])!.push([i, j]); i = j + 1; }
  const durOf = (b: Beat) => (beatSpans.get(b) || []).reduce((a, [i, j]) => a + (Math.min(N - 1, j + 1) - i) * dt, 0);
  metrics.beats = Object.fromEntries([...beatSpans.keys()].map(b => [b, +durOf(b).toFixed(2)]));
  const isIndoors = (p: V3) => indoors(world, p[0], p[1], p[2]);
  // a beat's limits hold inside it; within 0.35 s of a seam the eye is still handing over from the neighbour's, so the looser
  // of the two applies (a cap that stepped up or down the instant the beat changed would need an infinite acceleration)
  const seam = 0.35, seamN = Math.round(seam / dt);
  const beatIdx: Array<[number, number, Beat]> = []; for (const [b, spans] of beatSpans) for (const [i0, i1] of spans) beatIdx.push([i0, i1, b]);
  beatIdx.sort((a, b) => a[0] - b[0]);
  const neighbours = (i: number): Beat[] => { const out: Beat[] = [beat[i]]; for (let k = 0; k < beatIdx.length; k++) { const [i0, i1, b] = beatIdx[k]; if (i < i0 || i > i1) continue; if (i - i0 < seamN && k > 0) out.push(beatIdx[k - 1][2]); if (i1 - i < seamN && k + 1 < beatIdx.length) out.push(beatIdx[k + 1][2]); } return out; };
  const loosest = <T,>(i: number, f: (b: Beat) => T, gt: (a: T, b: T) => boolean): T => { let best = f(beat[i]); for (const b of neighbours(i)) { const v = f(b); if (gt(v, best)) best = v; } return best; };

  // ---- geometry: the eye path swept every 0.05 m ----------------------------------------------------------------
  const B = world.boxes;
  // a glass pane is a box with no thickness in plan (692 of the 766 panes of the 30 houses): a point sample never lands in it, so the clip test pads it — the sweep's step is 5 cm, the pad 3 cm
  // either side — and leaves out the doorways (the entry's pane is the door's, S1's channel: the eye goes through the doorway, not the glass beside it)
  const GLASS_PAD = 0.03;
  const CLIP_WALL = (k: number) => (k === K.wall || k === K.rail) ? 0 : k === K.glass ? GLASS_PAD : false;
  const CLIP_ITEM = (k: number) => (k === K.hull || k === K.fixture || k === K.surface || k === K.monitor || k === K.chair || k === K.heroSet || k === K.core) ? 0 : false;
  const CLIP_ITEM_FAR = (k: number) => k === K.item ? 0 : false;
  const doorways = world.levels.flatMap(l => nav.doorsOn(l.id).map(d => ({ ...d, y: l.y })));
  const inDoorway = (p: V3) => {
    if (entry && Math.abs((p[0] - entry.x) * entry.out[0] + (p[2] - entry.z) * entry.out[1]) < 0.5 && Math.abs((p[0] - entry.x) * entry.out[1] - (p[2] - entry.z) * entry.out[0]) < entry.w / 2 + 0.25) return true;
    for (const d of doorways) if (p[1] > d.y && p[1] < d.y + 2.6 && Math.abs((p[0] - d.c[0]) * d.n[0] + (p[2] - d.c[1]) * d.n[1]) < 0.4 && Math.abs((p[0] - d.c[0]) * d.n[1] - (p[2] - d.c[1]) * d.n[0]) < d.w / 2 + 0.2) return true;
    return false;
  };
  let minClear = Infinity, minClearAt = 0;
  const hullIds = new Set<number>(); for (let i = 0; i < world.kinds.length; i++) if (world.kinds[i] === K.hull) hullIds.add(i);
  const sweep = (fn: (p: V3, t: number, i: number) => void) => {
    for (let i = 0; i < N - 1; i++) {
      const a = eye[i], b = eye[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(L / 0.05));
      for (let k = 0; k < n; k++) { const u = k / n; fn([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u], tOf(i + u), i); }
    }
    fn(eye[N - 1], T, N - 1);
  };
  const tag = (x: V3) => `(${x[0].toFixed(1)}, ${x[1].toFixed(1)}, ${x[2].toFixed(1)})`;
  if (!opts.frameOnly) sweep((p, t, i) => {
    { const w = index.pointHits(p[0], p[1], p[2], CLIP_WALL).filter(id => id < 0 || world.kinds[id] !== K.glass || !inDoorway(p)); if (w.length) { const n = w[0] >= 0 ? world.names[w[0]] : 'wall'; E('wall-clip', t, `eye inside ${w[0] >= 0 && world.kinds[w[0]] === K.glass ? 'a window or glazed wall' : 'wall'} "${n}" at ${tag(p)}`, n); } }
    const it = index.pointHits(p[0], p[1], p[2], CLIP_ITEM).concat(index.pointHits(p[0], p[1], p[2], CLIP_ITEM_FAR).filter(id => id >= 0 && !isNearCoreItem(id)));
    if (it.length) { const n = world.names[it[0]] || 'item'; E('item-clip', t, `eye inside "${n}" at ${tag(p)}`, n); }
    const st = index.pointHits(p[0], p[1], p[2], k => k === K.stair ? 0 : false); if (st.length) E('stair-clip', t, `eye inside a flight of stairs at ${tag(p)}`, 'stairs');
    const inside = isIndoors(p);
    // (the outside beats too where the storey's footprint covers the point — a porch, a deck, a landing at the head of an exterior stair: the eye is "indoors" there by the rects, and a trunk beside the steps is still a trunk)
    if (!inside || OUTSIDE.has(beat[i])) {
      const s = index.pointHits(p[0], p[1], p[2], k => k === K.site ? 0 : false).filter(id => id >= 0);
      if (s.length) E('site-clip', t, `eye inside "${world.names[s[0]]}" on the lot at ${tag(p)}`, world.names[s[0]]);
    }
    if (!inside && track.roofAlpha[Math.min(N - 1, Math.round(t / dt))] > 0.05) { const r = index.pointHits(p[0], p[1], p[2], k => k === K.roof ? 0 : false); if (r.length) E('roof-clip', t, `eye inside a roof at ${tag(p)}`, 'roof'); }
    // §3.14: voids are solids — a storey's stairwell is not floor to cross at eye height (the flight through it is the stair beat's, and the seam round it)
    if (beat[i] !== 'stair' && beat[i] !== 'descend' && !neighbours(i).some(b => b === 'stair' || b === 'descend')) for (const lv of world.levels) {
      if (lv.y <= 0.05 || p[1] < lv.y + 0.9 || p[1] > lv.y + lv.h - 0.15) continue;
      if (lv.voids.some(v => inRect(p[0], p[2], v, -0.05))) { E('void-clip', t, `eye over the ${lv.id} stairwell opening at ${tag(p)}`, lv.id); break; }
    }
    // floors: a slab is 0.3 m under a storey's floor line, except where the storey has a void (a stairwell)
    for (const l of world.levels) {
      if (!l.rects.some(r => inRect(p[0], p[2], r, 0.02))) continue;
      if (l.y <= 0.05) { if (p[1] < l.y + 0.05) E('floor-clip', t, `eye ${(p[1] - l.y).toFixed(2)} m above the ${l.id} floor`, l.id); continue; }
      if (p[1] > l.y - 0.3 && p[1] < l.y + 0.05 && !l.voids.some(v => inRect(p[0], p[2], v, 0.1))) E('floor-clip', t, `eye passes through the ${l.id} floor slab at ${tag(p)}`, l.id);
    }
    // the ceiling: 0.2 m under it, where an upper storey's floor closes the room over it and no void opens it up (a storey at
    // y = the one below's ceiling hides the lower storey from levelAt above y − 0.25, so each storey is asked, not the nearest)
    for (const lv of world.levels) {
      if (!(p[1] > lv.y + lv.h - 0.2 && p[1] < lv.y + lv.h + 0.3) || !inFootprint(lv.rects, p[0], p[2], 0.05)) continue;
      // (a storey with nothing above it is closed by its own ceiling and the roof: the eye is 0.2 m under it at the most, like any other)
      const above = world.levels.find(l => l.y > lv.y + 0.5 && l.y < lv.y + lv.h + 0.6);
      const open = above ? (!above.rects.some(r => inRect(p[0], p[2], r)) || above.voids.some(v => inRect(p[0], p[2], v, 0.1))) : false;
      if (!open) E('ceiling', t, `eye ${(lv.y + lv.h - p[1]).toFixed(2)} m under the ${lv.id} ceiling`, lv.id);
    }
    const lv = levelAt(world, p[0], p[1], p[2]);
    // clearance at eye height (indoors, off the stairs): walls and furniture in plan
    if (inside && beat[i] !== 'stair' && beat[i] !== 'descend' && beat[i] !== 'orbit' && beat[i] !== 'power' && beat[i] !== 'hero' && lv) {
      const d = index.planDistance(p[0], p[2], p[1] - 0.25, p[1] + 0.25, k => k === K.wall || k === K.glass || k === K.rail || k === K.hull || k === K.item || k === K.fixture, 0.5);
      // (the entry door's own pane: the eye goes through the doorway, the leaf is S1's door channel — never a graze)
      const atEntry = !!entry && Math.abs((p[0] - entry.x) * entry.out[0] + (p[2] - entry.z) * entry.out[1]) < 0.5 && Math.abs((p[0] - entry.x) * entry.out[1] - (p[2] - entry.z) * entry.out[0]) < entry.w / 2 + 0.2;
      if (d < minClear && !atEntry) { minClear = d; minClearAt = t; }
      if (d < 0.25 && !atEntry) W('graze', t, `eye ${d.toFixed(2)} m from a solid at ${tag(p)}`, 'graze');
    }
    // the hero surface and the monitor
    if (hero.surfaceBox) { const s = hero.surfaceBox; if (p[0] > s[0] && p[0] < s[3] && p[2] > s[2] && p[2] < s[5] && p[1] < s[4] + 1.6 && p[1] > s[1] - 0.4) E('hero-surface', t, `eye over the hero ${hero.surface} at ${tag(p)}`, hero.surface); }
    if (hero.monitor) { const m = hero.monitor, d = Math.hypot(Math.max(m[0] - p[0], 0, p[0] - m[3]), Math.max(m[2] - p[2], 0, p[2] - m[5])); if (d < 0.5 && p[1] < m[4] + 0.6 && p[1] > m[1] - 0.6) E('monitor-near', t, `eye ${d.toFixed(2)} m from the monitor`, 'monitor'); }
  });
  function isNearCoreItem(id: number) {
    // an item digested mesh by mesh near the Core has a hull; its mesh boxes are for sight lines, the hull is the clip
    for (const h of hullIds) { if (world.names[h] === world.names[id] && B[6 * h] <= B[6 * id] + 1e-6 && B[6 * h + 3] >= B[6 * id + 3] - 1e-6 && B[6 * h + 2] <= B[6 * id + 2] + 1e-6 && B[6 * h + 5] >= B[6 * id + 5] - 1e-6) return true; }
    return false;
  }
  metrics.minClearance = Number.isFinite(minClear) ? +minClear.toFixed(3) : null;
  metrics.minClearanceAt = +minClearAt.toFixed(2);

  // ---- entering: through the door, at walking pace -----------------------------------------------------------
  let enterT: number | null = null, doorSpeed: number | null = null;
  if (entry && d2c) {
    const eLv = world.levels.find(l => l.id === entry.level)!;
    let was: boolean | null = null;
    for (let i = 0; i < N; i++) {
      const p = eye[i], inE = inFootprint(eLv.rects, p[0], p[2]) && p[1] > eLv.y - 0.1 && p[1] < eLv.y + eLv.h;
      if (was === false && inE && enterT === null) {
        enterT = tOf(i);
        const d = Math.hypot(p[0] - entry.x, p[2] - entry.z);
        if (d > 1.2) E('enters-through-wall', enterT, `first entry into the ${eLv.id} footprint is ${d.toFixed(1)} m from the entry door`);
      }
      was = inE;
      if (i) {
        const a0 = (eye[i - 1][0] - entry.x) * entry.out[0] + (eye[i - 1][2] - entry.z) * entry.out[1], a1 = (p[0] - entry.x) * entry.out[0] + (p[2] - entry.z) * entry.out[1];
        if (a0 > 0 && a1 <= 0 && Math.hypot(p[0] - entry.x, p[2] - entry.z) < 1.5 && doorSpeed === null) {
          doorSpeed = speed[i];
          if (doorSpeed > 1.2) E('door-speed', tOf(i), `the door plane is crossed at ${doorSpeed.toFixed(2)} m/s (walking pace ≤ 0.9, error over 1.2)`);
        }
      }
    }
    // the last 3 m before the door plane on its axis (±5°)
    let acc = 0, worst = 0;
    const iDoor = doorSpeed !== null && enterT !== null ? Math.round(enterT / dt) : -1;
    for (let i = iDoor; i > 0 && acc < 3; i--) {
      const a = eye[i - 1], b = eye[i], L = Math.hypot(b[0] - a[0], b[2] - a[2]); acc += L;
      const off = Math.abs((a[0] - entry.x) * entry.out[1] - (a[2] - entry.z) * entry.out[0]), along = (a[0] - entry.x) * entry.out[0] + (a[2] - entry.z) * entry.out[1];
      if (along > 0.2) worst = Math.max(worst, Math.atan2(off, along) / DEG);
    }
    metrics.approachAxisDeg = +worst.toFixed(1);
    if (worst > 5) W('approach-axis', enterT ?? 0, `the last 3 m before the door are ${worst.toFixed(0)}° off its axis (±5°)`);
    // §3.4: 0.9 m/s across the door's plane — the zone, not the instant of the crossing (the speed AT the plane is what the planner pins; what a viewer sees is the metre round it)
    { let zone = 0, zoneAt = 0;
      for (let i = 0; i < N; i++) { const p = eye[i], a = (p[0] - entry.x) * entry.out[0] + (p[2] - entry.z) * entry.out[1], l = (p[0] - entry.x) * entry.out[1] - (p[2] - entry.z) * entry.out[0]; if (Math.abs(a) <= DOOR_ZONE_M && Math.abs(l) <= entry.w / 2 + 0.3 && speed[i] > zone) { zone = speed[i]; zoneAt = tOf(i); } }
      metrics.doorZoneSpeed = +zone.toFixed(2);
      if (zone > DOOR_PLANE_SPEED * 1.1) W('door-zone-speed', zoneAt, `${zone.toFixed(2)} m/s within ${DOOR_ZONE_M} m of the door's plane (the plan's ${DOOR_PLANE_SPEED}, ±0.8 m in §3.4, ±${DOOR_ZONE_M} here)`); }
  }
  metrics.enterT = enterT === null ? null : +enterT.toFixed(3); metrics.doorSpeed = doorSpeed === null ? null : +doorSpeed.toFixed(2);

  // ---- the outside share ---------------------------------------------------------------------------------------
  let out = 0; for (let i = 0; i < N; i++) if (!isIndoors(eye[i])) out++;
  const outside = out / N, ext = beatSpans.has('extStair');
  metrics.outsideShare = +outside.toFixed(3);
  if (!d2c) { /* inside shots: no outside share to hold */ }
  // (§3.14: an error over 35 % whatever the entry, a warning over 30 — over 35 with an exterior stair, §3.3's raised cap: the two lines are one there)
  else if (outside > OUTSIDE_ERROR) E('outside-share', 0, `${(outside * 100).toFixed(0)} % of the film is outside (error over ${OUTSIDE_ERROR * 100} %)`);
  else if (outside > (ext ? OUTSIDE_ERROR : OUTSIDE_TARGET)) W('outside-share-high', 0, `${(outside * 100).toFixed(0)} % of the film is outside (target ≤ ${(ext ? OUTSIDE_ERROR : OUTSIDE_TARGET) * 100} %)`);

  // ---- travel in the first and last second -------------------------------------------------------------------
  const travel = (i0: number, i1: number) => { let L = 0; for (let i = i0 + 1; i <= i1; i++) L += Math.hypot(eye[i][0] - eye[i - 1][0], eye[i][1] - eye[i - 1][1], eye[i][2] - eye[i - 1][2]); return L; };
  const n1 = Math.min(N - 1, Math.round(1 / dt));
  metrics.firstSecond = +travel(0, n1).toFixed(3); metrics.lastSecond = +travel(N - 1 - n1, N - 1).toFixed(3);
  if (metrics.firstSecond < 0.5 && d2c) W('first-second', 0, `the first second moves ${metrics.firstSecond} m (≥ 0.5)`);
  if (metrics.lastSecond < 0.02 || metrics.lastSecond > 0.3) W('last-second', T - 1, `the last second moves ${metrics.lastSecond} m (0.02–0.3: the film ends in motion, settled)`);

  // ---- look: yaw rates, pitch, crab, reverse, look distance ------------------------------------------------
  const W01 = Math.max(1, Math.round(0.05 / dt));   // (±0.05 s: the 0.1 s window of §3.14)
  let maxYaw = 0, maxYawAt = 0; const rates: number[] = [];
  let crabRun = 0, revRun = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - W01), b = Math.min(N - 1, i + W01);
    // the smoothed yaw rate: yaw and pitch together over a 0.1 s window
    const r = Math.hypot((yaw[b] - yaw[a]) * Math.cos(pitch[i]), pitch[b] - pitch[a]) / ((b - a) * dt) / DEG;
    rates.push(r);
    if (r > maxYaw) { maxYaw = r; maxYawAt = tOf(i); }
    const bt = beat[i];
    if (r > YAW_ERROR) E('yaw-whip', tOf(i), `the view turns at ${r.toFixed(0)}°/s (error over ${YAW_ERROR})`);
    else if (r > YAW_WARN) W('yaw-rate', tOf(i), `the view turns at ${r.toFixed(0)}°/s (over ${YAW_WARN})`);
    // the beat's cap is the plan's (§3.5, assets/shot-spec.ts), never the planner's own; 10 % and 1°/s of slack (the 0.1 s window of a turn that is eased in and out)
    const yc = loosest(i, b => SPEC_YAW[b], (a, b) => a > b);
    if (r > yc * 1.1 + 1) W('beat-yaw', tOf(i), `${bt}: the view turns at ${r.toFixed(0)}°/s (the plan's cap is ${SPEC_YAW[bt]}${yc !== SPEC_YAW[bt] ? `, ${yc} at its seam` : ''})`, bt);
    const pd = pitch[i] / DEG;
    if (pd < PITCH_ERROR[0] || pd > PITCH_ERROR[1]) E('pitch', tOf(i), `pitch ${pd.toFixed(0)}° (outside ${PITCH_ERROR[0]}…+${PITCH_ERROR[1]})`);
    const [lo, hi] = [loosest(i, b => SPEC_PITCH[b][0], (a, b) => a < b), loosest(i, b => SPEC_PITCH[b][1], (a, b) => a > b)]; const loX = bt === 'establish' && track.plan && track.plan.establish && track.plan.establish.style === 'dollhouse' ? DOLLHOUSE_PITCH_MIN : lo;
    if (pd < loX - 3 || pd > hi + 3) W('beat-pitch', tOf(i), `${bt}: pitch ${pd.toFixed(0)}° outside ${loX}…${hi}`, bt);
    if (isIndoors(eye[i]) && !['stair', 'descend', 'hero', 'orbit', 'power', 'roomReveal'].includes(bt) && neighbours(i).length === 1 && Math.abs(pd) > INTERIOR_LEVEL_DEG + 0.5) W('verticals', tOf(i), `${bt}: pitch ${pd.toFixed(0)}° indoors (verticals want ±${INTERIOR_LEVEL_DEG}°)`, bt);
    // travel direction against the look
    const j = Math.min(N - 1, i + 1), k0 = Math.max(0, i - 1);
    const v: V3 = [eye[j][0] - eye[k0][0], eye[j][1] - eye[k0][1], eye[j][2] - eye[k0][2]], vl = Math.hypot(v[0], v[2]);
    if (speed[i] > 0.3 && vl > 1e-6) {
      const c = (v[0] * dir[i][0] + v[2] * dir[i][2]) / (vl * (Math.hypot(dir[i][0], dir[i][2]) || 1));
      // (going round the Core with the look on it is not going backwards: the walk into its room and the finale circle it)
      const tc: V3 = [centre[0] - eye[i][0], centre[1] - eye[i][1], centre[2] - eye[i][2]], tcl = Math.hypot(tc[0], tc[1], tc[2]) || 1;
      // (only circling it: an eye backing straight away from the Core with its look on it is the moonwalk this check is for — the
      // share of the velocity that points away from the Core, over half of it, is no circling)
      const away = -(v[0] * tc[0] + v[2] * tc[2]) / ((vl * Math.hypot(tc[0], tc[2])) || 1);
      const onCore = tcl < 4 && (tc[0] * dir[i][0] + tc[1] * dir[i][1] + tc[2] * dir[i][2]) / tcl > Math.cos(40 * DEG) && away < 0.5;
      if (c < -0.2 && !onCore) { revRun += dt; if (revRun > 0.5) E('reverse', tOf(i), `the camera travels against its look for ${revRun.toFixed(1)} s`); } else revRun = 0;
      if (!['orbit', 'power', 'hero', 'establish'].includes(bt) && c < Math.cos(60 * DEG)) { crabRun += dt; if (crabRun > 0.5) W('crab', tOf(i), `${bt}: the look is over 60° off the direction of travel for ${crabRun.toFixed(1)} s`, bt); } else crabRun = 0;
    } else { revRun = 0; crabRun = 0; }
    // the look target's distance (the planner's singularity guard)
    const ld = Math.hypot(track.look[3 * i] - track.pos[3 * i], track.look[3 * i + 1] - track.pos[3 * i + 1], track.look[3 * i + 2] - track.pos[3 * i + 2]);
    const minLd = ['hero', 'orbit', 'power', 'roomReveal'].includes(bt) ? 0.8 : 2;
    if (ld < minLd - 0.05) W('look-near', tOf(i), `${bt}: the look target is ${ld.toFixed(2)} m from the eye (≥ ${minLd})`, bt);
  }
  const sorted = rates.slice().sort((a, b) => a - b);
  metrics.maxYawRate = +maxYaw.toFixed(1); metrics.maxYawAt = +maxYawAt.toFixed(2); metrics.yawP95 = +sorted[Math.floor(sorted.length * 0.95)].toFixed(1);
  // the raw look rate, 60 Hz: the angle the view turns between two frames 1/60 s apart. The smoothed 0.1 s rate above cannot see a pop of a
  // few degrees in one sample (a beat seam where a clamp lets go); on screen it is a snap. (The v1 gate's look-whip: warn over 100°/s here,
  // 125 there, an error over 200: a snap.)
  { const st = Math.max(1, Math.round(1 / 60 / dt)); let peak = 0, at = 0;
    for (let i = 0; i + st < N; i++) {
      const c = clamp(dir[i][0] * dir[i + st][0] + dir[i][1] * dir[i + st][1] + dir[i][2] * dir[i + st][2], -1, 1), r = Math.acos(c) / DEG / (st * dt);
      if (r > peak) { peak = r; at = tOf(i); }
      if (r > 200) E('look-snap', tOf(i), `the view snaps ${(r * st * dt).toFixed(1)}° in 1/${Math.round(1 / (st * dt))} s (${r.toFixed(0)}°/s raw, error over 200)`);
      else if (r > 100) W('look-whip', tOf(i), `the view turns at ${r.toFixed(0)}°/s raw (over 100)`);
    }
    metrics.maxLookRate60 = +peak.toFixed(0); metrics.maxLookRate60At = +at.toFixed(2); }
  // the lag of the limiters: the baked look against the solver's own wanted direction before the rate limits and the smoothing (`track.desired`) — a measure of the filter, not of the film
  if (track.desired) {
    const errs: number[] = [];
    for (let i = 0; i < N; i++) {
      const y = track.desired[2 * i], p = track.desired[2 * i + 1];
      const d0: V3 = [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)];
      const b = [track.look[3 * i] - track.pos[3 * i], track.look[3 * i + 1] - track.pos[3 * i + 1], track.look[3 * i + 2] - track.pos[3 * i + 2]], bl = Math.hypot(b[0], b[1], b[2]) || 1;
      errs.push(Math.acos(clamp((d0[0] * b[0] + d0[1] * b[1] + d0[2] * b[2]) / bl, -1, 1)) / DEG);
    }
    errs.sort((a, b) => a - b);
    metrics.lookLagMedian = +errs[errs.length >> 1].toFixed(1); metrics.lookLagP95 = +errs[Math.floor(errs.length * 0.95)].toFixed(1);
  }
  // §3.14 look error: the baked look against the beat's SUBJECT — what the plan's look solver (§3.5) wants of this beat, re-derived here from the eye's own path and the subject, not read back
  // from the solver: the blend of the look-ahead point (max(1.5 m, v × 1.2 s) ahead on the eye path) and the subject, weighted by the plan's table, the subject counting only where
  // ≥ 60 % of 9 rays reach it (§3.5). Fixed subjects are independent of the planner: the door on the approach (extStair: the door too), the Core in the push-in, the orbit and the press.
  // A film's median of it is the fleet's look error (target ≤ 10°); a beat of half a second or more whose own median is over 25° is a warning (the look is somewhere else than the subject
  // — a wrong subject, a look rotated after solving — which a median over the whole film never shows).
  if (d2c && track.subj) {
    const cum = new Float64Array(N); for (let i = 1; i < N; i++) cum[i] = cum[i - 1] + Math.hypot(eye[i][0] - eye[i - 1][0], eye[i][1] - eye[i - 1][1], eye[i][2] - eye[i - 1][2]);
    const aheadAt = (i: number) => { const want = cum[i] + Math.max(1.5, speed[i] * 1.2); let lo = i, hi = N - 1; if (cum[hi] < want) return hi; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < want) lo = m; else hi = m; } return hi; };
    const door: V3 | null = entry ? [entry.x, entry.y + 1.3, entry.z] : null;
    const visMemo = new Map<number, number>();
    const lookErr = (i: number): number => {
      const b = beat[i], p = eye[i];
      const fixed: V3 | null = b === 'approach' || b === 'extStair' ? door : (b === 'hero' || b === 'orbit' || b === 'power') ? centre : null;
      const sj: V3 = fixed || [track.subj![3 * i], track.subj![3 * i + 1], track.subj![3 * i + 2]];
      let ws = SPEC_LOOK_SUBJECT[b];
      if (ws < 1) { const k = Math.floor(i / 12); let v = visMemo.get(k); if (v === undefined) { v = probe.visibility(eye[k * 12], sj, 0.2, OUTSIDE.has(b)) >= 0.6 ? 1 : 0; visMemo.set(k, v); } ws *= v; }
      const q = eye[aheadAt(i)], da = [q[0] - p[0], q[1] - 0.2 - p[1], q[2] - p[2]], dl = Math.hypot(da[0], da[1], da[2]) || 1, ds = [sj[0] - p[0], sj[1] - p[1], sj[2] - p[2]], dsl = Math.hypot(ds[0], ds[1], ds[2]) || 1;
      const want = [da[0] / dl * (1 - ws) + ds[0] / dsl * ws, da[1] / dl * (1 - ws) + ds[1] / dsl * ws, da[2] / dl * (1 - ws) + ds[2] / dsl * ws], wl = Math.hypot(want[0], want[1], want[2]) || 1;
      const g = [track.look[3 * i] - track.pos[3 * i], track.look[3 * i + 1] - track.pos[3 * i + 1], track.look[3 * i + 2] - track.pos[3 * i + 2]], gl = Math.hypot(g[0], g[1], g[2]) || 1;
      return Math.acos(clamp((want[0] * g[0] + want[1] * g[1] + want[2] * g[2]) / (wl * gl), -1, 1)) / DEG;
    };
    const med = (a: number[]) => { const t = a.slice().sort((x, y) => x - y); return t[t.length >> 1]; };
    const all: number[] = [], byBeat = new Map<Beat, number[]>();
    // §3.14: the median over a beat of the look's error against the subject, a warning over 25°; and a stretch of 1.5 s inside a longer beat (a walk of ten seconds) whose own median is over
    // 45° — the look somewhere else than the subject for a stretch, which the beat's median hides
    const WIN = 30;
    for (const [b, spans] of beatSpans) for (const [i0, i1] of spans) {
      const es: number[] = []; for (let i = Math.ceil(i0 / 6) * 6; i <= i1; i += 6) es.push(lookErr(i));
      all.push(...es); (byBeat.get(b) || byBeat.set(b, []).get(b)!).push(...es);
      if ((i1 - i0 + 1) * dt < 0.5 || es.length < 4) continue;
      const mb = med(es);
      if (mb > LOOK_ERROR_WARN) W('look-error', tOf(i0), `${b}: the look is a median ${mb.toFixed(0)}° off the beat's subject and the look-ahead (the plan's solver, §3.5; ≤ ${LOOK_ERROR_WARN}°)`, b);
      else if (es.length > WIN) for (let k = 0; k + WIN <= es.length; k++) { const m = med(es.slice(k, k + WIN)); if (m > LOOK_ERROR_STRETCH) W('look-error', tOf(Math.ceil(i0 / 6) * 6 + 6 * k), `${b}: the look is a median ${m.toFixed(0)}° off the subject and the look-ahead over ${(WIN * 0.05).toFixed(1)} s (≤ ${LOOK_ERROR_STRETCH}°)`, b); }
    }
    if (all.length) { all.sort((a, b) => a - b); metrics.lookErrorMedian = +all[all.length >> 1].toFixed(1); metrics.lookErrorP95 = +all[Math.floor(all.length * 0.95)].toFixed(1); }
    metrics.lookErrorByBeat = Object.fromEntries([...byBeat].map(([b, es]) => [b, +med(es).toFixed(1)]));
  } else if (d2c) W('look-error', 0, 'the track records no subjects: its look error cannot be measured');

  // ---- speed: per beat, doorways, acceleration, jerk -----------------------------------------------------
  const acc = new Float64Array(N);
  for (let i = 1; i < N - 1; i++) acc[i] = (speed[i + 1] - speed[i - 1]) / (2 * dt);
  const accS = new Float64Array(N); { const w = Math.round(0.1 / dt); for (let i = 0; i < N; i++) { let s = 0, c = 0; for (let k = -w; k <= w; k++) { const j = i + k; if (j < 0 || j >= N) continue; s += acc[j]; c++; } accS[i] = s / c; } }
  let maxAcc = 0, maxJerk = 0;
  for (let i = 1; i < N - 1; i++) {
    const out2 = !isIndoors(eye[i]);   // (by where the eye is: 3 m/s² outside, 1.5 inside)
    const a = Math.abs(accS[i]); maxAcc = Math.max(maxAcc, a);
    if (a > (out2 ? 3 : 1.5) * 1.15) W('accel', tOf(i), `${beat[i]}: ${a.toFixed(1)} m/s² (≤ ${out2 ? 3 : 1.5})`, beat[i]);
    const j = Math.abs((accS[i + 1] - accS[i - 1]) / (2 * dt)); maxJerk = Math.max(maxJerk, j);
    if (j > (out2 ? 30 : 15)) W('jerk', tOf(i), `${beat[i]}: jerk ${j.toFixed(0)} m/s³ (≤ ${out2 ? 30 : 15})`, beat[i]);
    const bt = beat[i];
    // the caps are the plan's (§3.4, assets/shot-spec.ts): a flight's is along it in plan, so its speed is measured in plan; the orbit's is angular (below)
    const FLIGHT = (b: Beat) => b === 'stair' || b === 'descend' || b === 'extStair';
    const capOf = (b: Beat): number | null => b === 'orbit' ? null : SPEC_SPEED[b];
    let cap = capOf(bt), vOf = FLIGHT(bt) ? speedH[i] : speed[i];
    for (const nb of neighbours(i)) { const c2 = capOf(nb); if (cap !== null && (c2 === null || c2 > cap)) cap = c2; if (FLIGHT(nb)) vOf = Math.min(vOf, speedH[i]); }
    if (cap !== null && vOf > cap * 1.1) W('beat-speed', tOf(i), `${bt}: ${vOf.toFixed(2)} m/s${FLIGHT(bt) ? ' in plan' : ''} (the plan's cap is ${cap.toFixed(1)})`, bt);
    if (bt === 'orbit') { const r = Math.hypot(eye[i][0] - centre[0], eye[i][2] - centre[2]) || 1; const w2 = speed[i] / r / DEG; if (w2 > SPEC_YAW.orbit) W('orbit-yaw-rate', tOf(i), `the orbit turns at ${w2.toFixed(0)}°/s (≤ ${SPEC_YAW.orbit})`); }
  }
  metrics.maxAccel = +maxAcc.toFixed(2); metrics.maxJerk = +maxJerk.toFixed(1);
  // interior doorways: ≤ 1.2 m/s within ±0.6 m of the plane, through the middle (±0.1 m), square to it for ±0.7 m
  const doors = world.levels.flatMap(l => nav.doorsOn(l.id).map(d => ({ ...d, y: l.y })));
  const doorsCrossed: any[] = [];
  for (const d of doors) {
    for (let i = 1; i < N; i++) {
      const p = eye[i], q = eye[i - 1];
      if (p[1] < d.y + 0.4 || p[1] > d.y + 2.6) continue;
      const a0 = (q[0] - d.c[0]) * d.n[0] + (q[2] - d.c[1]) * d.n[1], a1 = (p[0] - d.c[0]) * d.n[0] + (p[2] - d.c[1]) * d.n[1];
      if (!(a0 * a1 < 0)) continue;
      const lat = (p[0] - d.c[0]) * d.n[1] - (p[2] - d.c[1]) * d.n[0];
      if (Math.abs(lat) > d.w / 2 + 0.1) continue;
      doorsCrossed.push({ d, i });
      if (Math.abs(lat) > 0.12) W('door-funnel', tOf(i), `a doorway (${d.level}) crossed ${Math.abs(lat).toFixed(2)} m off its middle (±0.1)`, `door ${d.level}:${d.part}`);
      // square to the door for ±0.7 m, and at walking pace within ±0.6 m
      let worstAng = 0, worstV = 0;
      for (let k = Math.max(1, i - 90); k < Math.min(N, i + 90); k++) {
        const a = (eye[k][0] - d.c[0]) * d.n[0] + (eye[k][2] - d.c[1]) * d.n[1];
        const v = [eye[k][0] - eye[k - 1][0], eye[k][2] - eye[k - 1][2]], vl = Math.hypot(v[0], v[1]);
        if (Math.abs(a) < 0.7 && vl > 1e-5) worstAng = Math.max(worstAng, Math.acos(clamp(Math.abs(v[0] * d.n[0] + v[1] * d.n[1]) / vl, -1, 1)) / DEG);
        if (Math.abs(a) < 0.6) worstV = Math.max(worstV, speed[k]);
      }
      if (worstAng > 15) W('door-funnel', tOf(i), `a doorway (${d.level}) is crossed ${worstAng.toFixed(0)}° off square (±0.7 m square to it)`, `door ${d.level}:${d.part}`);
      if (worstV > 1.2 * 1.05) W('doorway-speed', tOf(i), `a doorway (${d.level}) is crossed at ${worstV.toFixed(2)} m/s (≤ 1.2)`, `door ${d.level}:${d.part}`);
      // the opening is open at eye height (a closed leaf, a wall where the spec has a door)
      const blocked = index.pointHits(d.c[0], d.y + 1.5, d.c[1], k => (k === K.wall || k === K.glass) ? 0.05 : false);
      if (blocked.length) E('door-closed', tOf(i), `the doorway the route takes (${d.level}) is shut at eye height`, `door ${d.level}:${d.part}`);
    }
  }
  metrics.doorways = doorsCrossed.length;

  // ---- door leaves: shut in the house, opened by the track ahead of the eye, and never swung into it ----------------------
  for (const d of world.doors || []) {
    if (d.open || d.closedAngle === null || d.openAngle === null) continue;
    const ic = firstCrossing(d, track.pos, N); if (ic < 0) continue;
    metrics.doorLeaves = (metrics.doorLeaves || 0) + 1;
    const ch = track.doors && track.doors[d.id];
    const openAt = (i: number) => ch ? leafOpen(d, ch[Math.max(0, Math.min(N - 1, i))]) : 0;
    const early = openAt(ic - Math.round(DOOR_DONE_S / 2 / dt));
    if (early < 0.9) E('door-closed', tOf(ic), `the door "${d.id}" is ${(early * 100).toFixed(0)} % open when the eye reaches it${ch ? '' : ' (the track has no channel for it)'}`, `door ${d.id}`);
    for (let i = 0; i <= Math.min(N - 1, ic + Math.round(2 / dt)); i += 3) {
      const yawDeg = d.closedYaw + (d.openYaw - d.closedYaw) * openAt(i), seg = leafSegment(d, yawDeg), p = eye[i];
      if (p[1] < d.y0 - 0.3 || p[1] > d.y0 + d.h + 0.3) continue;
      const vx = seg.b[0] - seg.a[0], vz = seg.b[1] - seg.a[1], u = clamp(((p[0] - seg.a[0]) * vx + (p[2] - seg.a[1]) * vz) / (vx * vx + vz * vz || 1), 0, 1);
      const dd = Math.hypot(p[0] - (seg.a[0] + vx * u), p[2] - (seg.a[1] + vz * u));
      if (dd < 0.25) W('door-leaf', tOf(i), `the leaf of door "${d.id}" is ${dd.toFixed(2)} m from the eye as it swings (≥ 0.25)`, `door ${d.id}`);
    }
  }

  // ---- beats: floors, windows ---------------------------------------------------------------------------
  const storeysRoute = (() => { const ys = [...new Set(world.levels.map(l => Math.round(l.y * 2) / 2))].sort((a, b) => a - b), ie = entry ? ys.indexOf(Math.round(world.levels.find(l => l.id === entry.level)!.y * 2) / 2) : 0, ih = ys.indexOf(Math.round(world.levels.find(l => l.id === hero.level)!.y * 2) / 2); return Math.abs(ih - ie) + 1; })();
  for (const [b, spans] of beatSpans) {
    for (const [i0, i1] of spans) {
      const d = (Math.min(N - 1, i1 + 1) - i0) * dt, f = BEAT_FLOOR[b];
      if (f && d < f - 0.02) E('beat-floor', tOf(i0), `${b} lasts ${d.toFixed(2)} s (never under ${f})`, b);
      const w = d2c ? beatWindow(b, storeysRoute) : null;
      if (w && (d < w[0] - 0.05 || d > w[1] + 0.05)) W('beat-window', tOf(i0), `${b} lasts ${d.toFixed(2)} s (the plan's budget allows ${w[0]}–${w[1].toFixed(1)})`, b);
      if ((b === 'stair' || b === 'descend') && d < 1.6) W('stair-short', tOf(i0), `a flight takes ${d.toFixed(2)} s (≥ 1.6)`, b);
    }
  }
  // ---- the film's length against the plan's budget (§3.0, §3.3: 12 s, plus the orbit and the distances of this house) ------------------
  if (d2c) {
    const lenOf = (names: Beat[], plan = false) => { let L = 0; for (let i = 1; i < N; i++) if (names.includes(beat[i])) L += plan ? Math.hypot(eye[i][0] - eye[i - 1][0], eye[i][2] - eye[i - 1][2]) : Math.hypot(eye[i][0] - eye[i - 1][0], eye[i][1] - eye[i - 1][1], eye[i][2] - eye[i - 1][2]); return L; };
    const orbitDeg = (() => { const sp = beatSpans.get('orbit'); if (!sp) return 0; let sw = 0; for (const [i0, i1] of sp) for (let i = Math.max(1, i0); i <= i1; i++) sw += wrapPi(Math.atan2(eye[i][0] - centre[0], eye[i][2] - centre[2]) - Math.atan2(eye[i - 1][0] - centre[0], eye[i - 1][2] - centre[2])); return Math.abs(sw) / DEG; })();
    const bud = filmBudget({ storeys: storeysRoute, ext: beatSpans.has('extStair'), establishM: lenOf(['establish']), approachM: lenOf(['approach', 'extStair']), walkM: lenOf(['reveal', 'route', 'roomReveal', 'hero']), flightPlanM: lenOf(['stair', 'descend'], true), orbitDeg });
    metrics.filmBudget = +bud.total.toFixed(1); metrics.filmBudgetRatio = +(T / bud.total).toFixed(2);
    if (T > bud.total * BUDGET_SLACK + 0.25) W('film-length', 0, `the film runs ${T.toFixed(1)} s against a budget of ${bud.total.toFixed(1)} s (the plan's ${bud.base.toFixed(1)} s with the orbit, and ${(bud.total - bud.base).toFixed(1)} s for this house's distances; over ${((BUDGET_SLACK - 1) * 100).toFixed(0)} % warns)`);
  }
  // the lens: its rate, and its range where a beat has one
  let maxFovRate = 0;
  for (let i = 1; i < N; i++) {
    const r = Math.abs(fov[i] - fov[i - 1]) / dt; maxFovRate = Math.max(maxFovRate, r);
    if (r > LENS_RATE * 1.1) W('fov-rate', tOf(i), `the lens changes at ${r.toFixed(1)}°/s (≤ ${LENS_RATE})`);
    const bt = beat[i], f = fov[i];
    const range: [number, number] | null = SPEC_FOV[bt] || null;
    if (range && (f < range[0] - 0.5 || f > range[1] + 0.5)) W('fov-range', tOf(i), `${bt}: lens ${f.toFixed(1)}° (${range[0]}–${range[1]})`, bt);
  }
  metrics.maxFovRate = +maxFovRate.toFixed(2);

  // ---- composition: a 7 × 5 ray grid every 0.1 s (blank, near-blank, foreground occluders) -------------------------
  let blankRun = 0, nearRun = 0, foreRun = 0, blankMax = 0, nearMax = 0;
  const step = Math.max(1, Math.round(0.1 / dt));
  for (let i = 0; i < N; i += step) {
    const cam = camera(eye[i], tgt[i], fov[i], aspect);
    const roofs = track.roofAlpha[i] > 0.5 && !isIndoors(eye[i]);
    const c = probe.composition(cam, roofs, 1.5);
    const finale = ['hero', 'orbit', 'power'].includes(beat[i]), indoor = isIndoors(eye[i]);
    // (the finale's background is a wall by the Core's own desk: a warning there, an error anywhere else)
    const b15 = c.share(1.5), b3 = c.share(3);
    if (b15 >= 0.6) { blankRun += step * dt; blankMax = Math.max(blankMax, blankRun); if (blankRun > 0.3) { if (finale) W('finale-blank', tOf(i), `${(b15 * 100).toFixed(0)} % of the finale's frame is one plane within 1.5 m for ${blankRun.toFixed(1)} s`); else if (aspect < 1.5) W('near-blank', tOf(i), `${(b15 * 100).toFixed(0)} % of a ${aspect.toFixed(2)}:1 frame is one wall within 1.5 m for ${blankRun.toFixed(1)} s`); else E('blank-frame', tOf(i), `${(b15 * 100).toFixed(0)} % of the frame is one wall within 1.5 m for ${blankRun.toFixed(1)} s`); } } else blankRun = 0;
    // (§3.10: never aim at a wall closer than 2.5 m — a plane over 40 % of the frame within 3 m, inside, outside the finale)
    if (b3 >= 0.4 && !finale && indoor) { nearRun += step * dt; nearMax = Math.max(nearMax, nearRun); if (nearRun > 0.5) W('near-blank', tOf(i), `${(b3 * 100).toFixed(0)} % of the frame is one wall within 3 m for ${nearRun.toFixed(1)} s`); } else nearRun = 0;
    // (the Core's own desk, its monitor and the set it stands on are the subject of the finale, not something in the way of it: a chair back, a plant, a
    // column are; a wall is `near-blank`'s and `blank-frame`'s business, and the frame of the door the eye goes through is a wall)
    const fore = c.rays.filter(r => r.t < 0.8 && r.k !== 0 && r.k !== K.wall && r.k !== K.glass && r.k !== K.surface && r.k !== K.core && r.k !== K.monitor && r.k !== K.heroSet).length / c.rays.length;
    if (fore > 0.25) { foreRun += step * dt; if (foreRun > 0.3) W('foreground-occluder', tOf(i), `${(fore * 100).toFixed(0)} % of the frame is something within 0.8 m of the lens`); } else foreRun = 0;
  }
  metrics.blankMax = +blankMax.toFixed(2); metrics.nearBlankMax = +nearMax.toFixed(2);
  // dead air: a 1 s window outside the power beat with under 3° of view change (the turn, plus what the eye's travel
  // does to a subject 3 m away)
  { const w = Math.round(1 / dt); let worst = Infinity, at = 0;
    for (let i = 0; i + w < N; i += 6) {
      if (beat[i] === 'power' || beat[i + w] === 'power') continue;
      const a = dir[i], b = dir[i + w];
      const turn = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)) / DEG;
      const moved = Math.atan2(travel(i, i + w), 3) / DEG;
      const v = turn + moved; if (v < worst) { worst = v; at = tOf(i); }
      if (v < 3) E('dead-air', tOf(i), `1 s from ${tOf(i).toFixed(1)} s changes the view by ${v.toFixed(1)}° (≥ 3)`);
    }
    metrics.minViewChange = Number.isFinite(worst) ? +worst.toFixed(1) : null; metrics.minViewChangeAt = +at.toFixed(2);
  }
  // near the floor, outside the stairs and the finale
  for (let i = 0; i < N; i++) {
    const bt = beat[i]; if (['stair', 'descend', 'hero', 'orbit', 'power', 'extStair', 'establish'].includes(bt)) continue;
    const lv = levelAt(world, eye[i][0], eye[i][1], eye[i][2]); const floor = lv && inFootprint(lv.rects, eye[i][0], eye[i][2]) ? lv.y : 0;
    if (eye[i][1] - floor < 1.1) W('floor-proximity', tOf(i), `${bt}: the eye is ${(eye[i][1] - floor).toFixed(2)} m above the floor (≥ 1.1)`, bt);
  }

  // ---- the establishing frame --------------------------------------------------------------------------------
  if (d2c) {
    const cam0 = camera(eye[0], tgt[0], fov[0], aspect);
    const f = frameFit(eye[0], tgt[0], fov[0], houseCorners(world), 0.08, aspect);
    const c = probe.composition(cam0, true, 1.5);
    const occ = c.rays.filter(r => r.k === K.site && r.t < 6).length / c.rays.length;
    metrics.establish = { style: track.plan && track.plan.establish ? track.plan.establish.style : null, crop: { top: +f.top.toFixed(3), bottom: +f.bottom.toFixed(3), side: +f.side.toFixed(3) }, sky: +c.sky.toFixed(3), occluder: +occ.toFixed(3), bearing: entry ? +(Math.atan2((eye[0][0] - entry.x) * entry.out[1] - (eye[0][2] - entry.z) * entry.out[0], (eye[0][0] - entry.x) * entry.out[0] + (eye[0][2] - entry.z) * entry.out[1]) / DEG).toFixed(1) : null };
    // (§3.9: the footprint and the roof inside the frame with 8 % margins — a stray eave or dormer, 3 % of the corners, and the ground line within 15 % of the bottom margin)
    if (!wholeFit(eye[0], tgt[0], fov[0], houseCorners(world), aspect)) W('establish-crop', 0, `the house is cropped on the first frame: ${(f.top * 100).toFixed(0)} % of its corners over the top margin, ${(f.bottom * 100).toFixed(0)} % under the bottom, ${(f.side * 100).toFixed(0)} % past a side (all of it in, with 8 % margins: at most 3 % over the top or a side)`);
    // §3.9: sky 15–35 % of the first frame (5 points of slack either side: the share is the 35 rays of a 7 × 5 grid)
    if (c.sky < SPEC_ESTABLISH.sky[0] - 0.05 || c.sky > SPEC_ESTABLISH.sky[1] + 0.05) W('establish-sky', 0, `sky is ${(c.sky * 100).toFixed(0)} % of the first frame (the plan's ${SPEC_ESTABLISH.sky[0] * 100}–${SPEC_ESTABLISH.sky[1] * 100} %)`);
    // §3.9: an eye 5–9 m over the entry's floor (the dollhouse, the high cutaway, is higher by definition)
    { const h = eye[0][1] - (entry ? entry.y : 0); metrics.establish.eyeHeight = +h.toFixed(1); if (track.plan && track.plan.establish && track.plan.establish.style !== 'dollhouse' && track.plan.establish.style !== 'garden' && (h < SPEC_ESTABLISH.eyeHeight[0] - 0.5 || h > SPEC_ESTABLISH.eyeHeight[1] + 0.5)) W('establish-height', 0, `the first frame's eye is ${h.toFixed(1)} m over the entry's floor (the plan's ${SPEC_ESTABLISH.eyeHeight[0]}–${SPEC_ESTABLISH.eyeHeight[1]} m)`); }
    if (occ > 0.1) W('establish-occluder', 0, `${(occ * 100).toFixed(0)} % of the first frame is planting or a car within 6 m`);
  }

  // ---- roofs: opaque outside, faded within 0.35 s of the door ----------------------------------------------------
  if (enterT !== null) {
    const est = track.plan && track.plan.establish && track.plan.establish.roofOff;
    const tEst = (beatSpans.get('establish') || [[0, 0]])[0][1] * dt;
    for (let i = 0; i < N; i++) {
      const t = tOf(i), a = track.roofAlpha[i];
      if (t < enterT - 0.05 && !isIndoors(eye[i]) && a < 0.99 && !(est && t < tEst + 0.2)) { E('roof-timing', t, `the roofs are ${(a * 100).toFixed(0)} % opaque while the eye is outside`); }
      if (t > enterT + 0.4 && a > 0.01) E('roof-timing', t, `the roofs are still ${(a * 100).toFixed(0)} % opaque 0.4 s after the door`);
    }
  }

  // ---- the Core: in sight before the press, the press itself, the final frame -------------------------------
  const ev = track.events;
  const coreIn = (i: number, margin = 0.9) => { const cam = camera(eye[i], tgt[i], fov[i], aspect); const p = project(cam, centre); return p[2] > 0 && Math.abs(p[0]) < margin && Math.abs(p[1]) < margin; };
  let losT = 0;
  const pressI = ev.pressT !== null ? Math.min(N - 1, Math.round(ev.pressT / dt)) : -1;
  if (pressI < 0) { if (d2c || beatSpans.has('power')) E('core-missing', 0, 'no press event: the Core is never switched on'); }
  else {
    // continuous line of sight up to the press
    for (let i = pressI; i >= 0; i -= 3) { if (!coreIn(i) || probe.coreSeen(eye[i], core) < 0.95) break; losT = (pressI - i) * dt; }
    metrics.coreLOS = +losT.toFixed(2);
    if (losT < 1.5) E('late-core', ev.pressT!, `the Core is in sight ${losT.toFixed(2)} s before the press (≥ 1.5)`);
    const seen = probe.coreSeen(eye[pressI], core);
    if (seen < 0.95) E('core-occluded', ev.pressT!, `${((1 - seen) * 100).toFixed(0)} % of the Core is hidden at the press`);
    if (speed[pressI] > 0.3) E('press-speed', ev.pressT!, `the camera moves at ${speed[pressI].toFixed(2)} m/s at the press (≤ 0.3)`);
    if (rates[pressI] > 10) E('press-yaw', ev.pressT!, `the view turns at ${rates[pressI].toFixed(0)}°/s at the press (≤ 10)`);
    const pb = projectBox(camera(eye[pressI], tgt[pressI], fov[pressI], aspect), core);
    if (!pb || pb.minX < -0.92 || pb.maxX > 0.92 || pb.minY < -0.92 || pb.maxY > 0.92) E('press-frame', ev.pressT!, 'the Core is not wholly in frame with an 8 % margin at the press');
    if (ev.pressT! > T - 1.4 + 1e-3) E('press-late', ev.pressT!, `the press at ${ev.pressT!.toFixed(2)} s leaves under 1.4 s to watch the Core wake`);
    metrics.pressT = ev.pressT; metrics.pressSpeed = +speed[pressI].toFixed(3); metrics.pressYaw = +rates[pressI].toFixed(1);
    // contrast: the Core's finish against what stands behind it (luminance of the first box behind, by colour)
    const d = [centre[0] - eye[pressI][0], centre[1] - eye[pressI][1], centre[2] - eye[pressI][2]], L = Math.hypot(d[0], d[1], d[2]);
    const coreIds = new Set<number>(); for (let i = 0; i < world.kinds.length; i++) if (world.kinds[i] === K.core) coreIds.add(i);
    const hit = index.raycast(centre[0], centre[1], centre[2], d[0] / L, d[1] / L, d[2] / L, 30, k => k !== K.hull && k !== K.core && k !== K.walk && k !== K.surface && k !== K.heroSet && k !== K.chair && k !== K.fixture, i => coreIds.has(i));
    const coreColor = world.colors[[...coreIds][0] ?? -1] ?? 0xe7e3dc;
    const bgColor = hit && hit.i >= 0 ? world.colors[hit.i] : 0xd8d8d8;
    const cr = (Math.max(lum(coreColor), lum(bgColor)) + 0.05) / (Math.min(lum(coreColor), lum(bgColor)) + 0.05);
    metrics.coreContrast = +cr.toFixed(2);
    metrics.coreBg = hit ? bgClass(hit.k, hit.n) : 'sky';
    if (cr < 1.25) W('core-contrast', ev.pressT!, `the Core's finish and what is behind it differ by a contrast of ${cr.toFixed(2)} (≥ 1.25)`);
  }
  // the final frame (a walkthrough that never reaches the Core has none to judge)
  if (d2c || beatSpans.has('power')) {
    const i = N - 1, p = eye[i];
    const hLv = world.levels.find(l => l.id === hero.level)!;
    if (!isIndoors(p) || !inFootprint(hLv.rects, p[0], p[2])) E('ends-outside', T, `the final eye ${tag(p)} is outside the hero storey`);
    const cam = camera(p, tgt[i], fov[i], aspect), pb = projectBox(cam, core), pc = project(cam, centre);
    const hp = pb ? (pb.maxY - pb.minY) / 2 : 0, wp = pb ? (pb.maxX - pb.minX) / 2 : 0;
    metrics.finalCoreHeight = +hp.toFixed(3); metrics.finalCoreWidth = +wp.toFixed(3); metrics.finalCoreNDC = [+pc[0].toFixed(3), +pc[1].toFixed(3)];
    if (hp < 0.15 || hp > 0.30) W('core-height', T, `the Core is ${(hp * 100).toFixed(0)} % of the final frame's height (15–30 %)`);
    if (wp < 0.10) W('core-narrow', T, `the Core is ${(wp * 100).toFixed(0)} % of the final frame's width (≥ 10 %)`);
    const thirds = Math.min(Math.abs(Math.abs(pc[0]) - 1 / 3), Math.abs(Math.abs(pc[1]) - 1 / 3));
    if (thirds > 0.08) W('core-thirds', T, `the Core ends at (${pc[0].toFixed(2)}, ${pc[1].toFixed(2)}), off every thirds line`);
    if (hero.chair) { const cb = projectBox(cam, hero.chair); const share = cb ? Math.max(0, Math.min(1, cb.maxX) - Math.max(-1, cb.minX)) * Math.max(0, Math.min(1, cb.maxY) - Math.max(-1, cb.minY)) / 4 : 0; metrics.chairShare = +share.toFixed(3); if (share > 0.10) W('chair-share', T, `the chair covers ${(share * 100).toFixed(0)} % of the final frame (≤ 10 %)`); }
    if (hero.monitor) { const m = hero.monitor, q = project(cam, [(m[0] + m[3]) / 2, m[4], (m[2] + m[5]) / 2]); const ok = q[2] > 0 && Math.abs(q[1]) < 0.98 && Math.abs(q[0]) < 1; metrics.monitorTop = ok; if (!ok) W('monitor-cut', T, 'the monitor\'s top edge is out of the final frame'); }
  }
  // the orbit: the Core framed and in sight throughout, the sweep, the swing before it
  const orbitSpan = beatSpans.get('orbit');
  if (orbitSpan) {
    let swept = 0;
    for (const [i0, i1] of orbitSpan) for (let i = i0; i <= i1; i++) {
      // (the middle 70 % of a wide frame; of a narrow one — a phone's, a third of the horizontal angle — the middle 85 %: the plan's hero yaw cap of 15°/s leaves the view a few degrees behind the Core where the push-in turns into the orbit, which is half the width of a portrait frame)
      if (!coreIn(i, aspect < 1.5 ? 0.85 : 0.7)) E('orbit-core-out-of-frame', tOf(i), `the Core leaves the middle ${aspect < 1.5 ? 85 : 70} % of the frame while orbiting`);
      if (i % 3 === 0 && probe.coreSeen(eye[i], core) < 0.95) E('orbit-core-occluded', tOf(i), 'something stands in front of the Core while orbiting');
      // (from the sample before the beat's first: the sweep the eye makes INTO the orbit's first sample is the orbit's — a sweep planned as 90° measures 89.8° without it)
      if (i > 0) { const a = Math.atan2(eye[i][0] - centre[0], eye[i][2] - centre[2]), b = Math.atan2(eye[i - 1][0] - centre[0], eye[i - 1][2] - centre[2]); swept += wrapPi(a - b); }
    }
    const arc = Math.abs(swept) / DEG; metrics.orbitArc = +arc.toFixed(1);
    // (what the room allows: the longest sweep the planner found a swing-free way to arrive at — a walk that comes straight
    // at the Core's front cannot start a long sweep without first circling it the other way)
    const best = track.plan && track.plan.orbit ? (track.plan.orbit.reachable ?? track.plan.orbit.bestArc) : 0;
    if (arc < 90 - 0.5 && best >= 90) W('orbit-short', tOf(orbitSpan[0][0]), `the Core orbit sweeps ${arc.toFixed(0)}° where the room allows ${best}° (≥ 90)`);
    // swing: the 2.5 s before the orbit, the eye travelling round the Core against it with the Core in frame
    const i0 = orbitSpan[0][0], sg = Math.sign(swept) || 1;
    let swing = 0;
    for (let i = Math.max(1, i0 - Math.round(2.5 / dt)); i < i0; i++) {
      if (!coreIn(i) || !coreIn(i - 1)) continue;
      const a = Math.atan2(eye[i][0] - centre[0], eye[i][2] - centre[2]), b = Math.atan2(eye[i - 1][0] - centre[0], eye[i - 1][2] - centre[2]);
      swing += Math.max(0, -sg * wrapPi(a - b)) / DEG;
    }
    metrics.swing = +swing.toFixed(1);
    if (swing > 20) W('orbit-swing-back', tOf(i0), `the eye circles ${swing.toFixed(0)}° round the Core against the orbit in the 2.5 s before it, the Core in view`);
  }

  // ---- the route: the rooms worth seeing, the via rooms, the Core room's side, attics ---------------------------
  if (d2c) {
    const hLv = world.levels.find(l => l.id === hero.level)!, eLv = entry ? world.levels.find(l => l.id === entry.level)! : hLv;
    const rooms = [...new Set([...eLv.rooms, ...hLv.rooms])].filter(r => r.b).map(r => ({ r, lv: eLv.rooms.includes(r) ? eLv : hLv, ...roomInterest(r, world) }));
    rooms.sort((a, b) => b.interest - a.interest || a.r.no.localeCompare(b.r.no));
    const top3 = rooms.slice(0, 3);
    const seenFor = new Map<any, number>();
    for (let i = 0; i < N; i += 6) {
      const cam = camera(eye[i], tgt[i], fov[i], aspect);
      for (const r of top3) {
        // (a room is seen when the eye is in it, or its focal item — or, failing that, the middle of its floor — is in the frame and
        // in the clear)
        const pts: V3[] = [r.focal ? [r.focal.at[0], r.lv.y + 1.0, r.focal.at[1]] : [r.r.b.x + r.r.b.w / 2, r.lv.y + 1.1, r.r.b.z + r.r.b.d / 2], [r.r.b.x + r.r.b.w / 2, r.lv.y + 1.0, r.r.b.z + r.r.b.d / 2]];
        const inRoom = inRect(eye[i][0], eye[i][2], r.r.b) && Math.abs(eye[i][1] - r.lv.y - 1.4) < 1.2;
        const inView = () => pts.some(pt => { const q = project(cam, pt); return q[2] > 0 && Math.abs(q[0]) < 0.9 && Math.abs(q[1]) < 0.9 && probe.clear(eye[i], pt); });
        if (inRoom || inView()) seenFor.set(r, (seenFor.get(r) || 0) + 6 * dt);
      }
    }
    const seen = top3.filter(r => (seenFor.get(r) || 0) >= 1).length;
    metrics.topRooms = top3.map(r => ({ name: r.r.name, interest: +r.interest.toFixed(2), seen: +(seenFor.get(r) || 0).toFixed(1) }));
    metrics.topRoomsSeen = seen;
    // (of the top rooms the film can show: the planner names how many the walk opens to it — the Core's, one it goes through, one it has a stretch in the clear of; a
    // room behind walls the route never opens cannot be seen, and the layout pass (shots[].via, showcase, the plan of the house) is what changes that)
    const showable = track.plan && typeof track.plan.topRoomsShowable === 'number' ? track.plan.topRoomsShowable : top3.length;
    metrics.topRoomsShowable = showable;
    if (seen < Math.min(2, top3.length, showable)) W('top-rooms', 0, `${seen} of the top ${top3.length} rooms seen for ≥ 1 s (${top3.map(r => r.r.name).join(', ')}; the walk can show ${showable})`);
    // via: in order
    const via = opts.via || [];
    let last = -1;
    for (const nm of via) {
      let found = -1;
      for (const l of world.levels) for (const r of l.rooms) if ((r.name === nm || r.no === nm) && r.b) for (let i = Math.max(0, last); i < N; i++) if (inRect(eye[i][0], eye[i][2], r.b, -0.1) && Math.abs(eye[i][1] - l.y - 1.4) < 1.0) { found = i; break; }
      if (found < 0 || found < last) E('via-missed', 0, `the route does not pass through "${nm}"${found >= 0 ? ' in order' : ''}`, nm); else last = found;
    }
    // the Core room entered from its user side
    const cr = hLv.rooms.find(r => r.b && inRect(hero.x, hero.z, r.b, 0.05));
    if (cr) {
      for (let i = 1; i < N; i++) if (inRect(eye[i][0], eye[i][2], cr.b, -0.05) && !inRect(eye[i - 1][0], eye[i - 1][2], cr.b, -0.05) && Math.abs(eye[i][1] - hLv.y - 1.4) < 1) {
        const a = Math.atan2((eye[i][0] - centre[0]) * hero.fwd[1] - (eye[i][2] - centre[2]) * hero.fwd[0], (eye[i][0] - centre[0]) * hero.fwd[0] + (eye[i][2] - centre[2]) * hero.fwd[1]) / DEG;
        metrics.coreRoomEntryDeg = +a.toFixed(0);
        if (Math.abs(a) > 100) W('core-room-side', tOf(i), `the Core's room is entered from behind the Core (${a.toFixed(0)}° off its front)`);
      }
    }
    // no attic under 2 m on the route
    for (let i = 0; i < N; i += 12) { const l = levelAt(world, eye[i][0], eye[i][1], eye[i][2]); if (l && l.h < 2.0 && inFootprint(l.rects, eye[i][0], eye[i][2])) E('attic-route', tOf(i), `the route passes through ${l.id}, ${l.h} m high (attics under 2 m are off the route)`, l.id); }
  }
  metrics.errors = errors.length; metrics.warnings = warnings.length;
  return { errors, warnings, metrics };
}

/** the errors that depend on the shape of the frame (a portrait phone, a square still, a wide screen): the Core in the frame at the press, the orbit keeping it
 *  in the middle, a blank wall — QA's frame checks run again at each aspect, on the track's own narrow-frame lens (Track.tanHReq); the rest of QA does not depend on it */
export const ASPECT_CODES = new Set(['press-frame', 'blank-frame', 'orbit-core-out-of-frame', 'core-occluded', 'late-core']);
export const ASPECTS: Array<[string, number]> = [['9:16', 9 / 16], ['3:4', 3 / 4], ['1:1', 1], ['21:9', 21 / 9]];
export function qaAspects(track: Track, world: ShotWorld, opts: { via?: string[]; aspects?: Array<[string, number]> } = {}): Finding[] {
  const out: Finding[] = [];
  for (const [name, a] of opts.aspects || ASPECTS) for (const e of qaTrack(track, world, { via: opts.via, aspect: a, frameOnly: true }).errors) if (ASPECT_CODES.has(e.code)) out.push({ ...e, subject: `${e.subject ? e.subject + ' ' : ''}@${name}`, message: `[${name}] ${e.message}` });
  return out;
}
