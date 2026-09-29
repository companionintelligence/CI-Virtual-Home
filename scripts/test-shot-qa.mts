#!/usr/bin/env -S node --experimental-strip-types
// QA v2 must catch what it claims to (plan §3.14, Completeness E): every code in QA_CODES is proved by a bad track. Two real
// houses' worlds are frozen in test/shots/worlds/ (a one-storey house and a two-storey one with a flight of stairs); the planner
// bakes a clean door-to-core on each, and for every QA code a fault is injected into a copy of it — a wall the eye is inside, a
// whip pan, a door crossed at a run, a press with the camera still moving, a Core hidden behind a panel, an orbit that swings
// back — and QA v2 has to report exactly that code, in the window where the fault is, and not on the clean track there.
// The fleet checks (assets/shot-fleet.ts) get the same treatment: a fleet of synthetic good rows passes, and for each check a
// row is spoiled until it fails.
//
// A code without an injector fails the test: whoever adds a QA code adds its fault here.
//
//   node --experimental-strip-types scripts/test-shot-qa.mts [--code wall-clip,pitch] [--verbose]
// No browser, no build beyond `pnpm run build`. Exit 0 all pass · 1 a code is not caught · 2 harness error.
// @check-house quick
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './portal-lib.mts';
import { planDoorToCore, sampleTrack, BEATS, BEAT_WINDOW, type Track } from '../assets/shot-planner.js';
import { qaTrack, QA_CODES, type QAResult } from '../assets/shot-qa.js';
import { fleetChecks, type FleetRow } from '../assets/shot-fleet.js';
import { K, DEG, clamp, inRect, inFootprint, indoors, levelAt, wrapPi, createWorldIndex, leafSegment, type ShotWorld, type WDoor } from '../assets/shot-world.js';
import { createNav } from '../assets/shot-nav.js';

type V3 = [number, number, number];
const args = parseArgs(process.argv.slice(2));
const only = args.code ? new Set(args.code.split(',')) : null;
const verbose = args.verbose === 'true';
let bad = 0;
const say = (ok: boolean, what: string, detail = '') => { if (!ok) bad++; if (!ok || verbose) console.log(`${ok ? '✓' : '✗'} ${what}${detail ? `\n    ${detail.split('\n').join('\n    ')}` : ''}`); };

// ---- the frozen worlds and their clean tracks ---------------------------------------------------------------------
const WORLD_DIR = path.join(ROOT, 'test', 'shots', 'worlds');
type Base = { id: string; world: ShotWorld; track: Track; qa: QAResult };
const bases: Base[] = [];
for (const id of ['cutestarter', 'familyhome']) {
  const world = JSON.parse(fs.readFileSync(path.join(WORLD_DIR, `${id}.world.json`), 'utf8')) as ShotWorld;
  const r = planDoorToCore(world, { duration: 'auto' });
  if (!r.ok) { console.error(`cannot plan ${id}: ${(r as any).message}`); process.exit(2); }
  const qa = qaTrack(r.track, world);
  bases.push({ id, world, track: r.track, qa });
  say(qa.errors.length === 0, `the clean ${id} track has no QA errors`, qa.errors.map(e => `${e.code} @${e.t}: ${e.message}`).join('\n'));
}

// ---- track surgery ------------------------------------------------------------------------------------------------
const cloneTrack = (t: Track): Track => ({
  ...t, pos: t.pos.slice(), look: t.look.slice(), fov: t.fov.slice(), roofAlpha: t.roofAlpha.slice(), composeW: t.composeW.slice(), beat: t.beat.slice(),
  events: { ...t.events, stairT: t.events.stairT.slice() }, plan: JSON.parse(JSON.stringify(t.plan)), desired: t.desired ? t.desired.slice() : undefined,
  doors: Object.fromEntries(Object.entries(t.doors || {}).map(([k, v]) => [k, v.slice()])), beats: t.beats.map(b => ({ ...b })),
});
const cloneWorld = (w: ShotWorld): ShotWorld => ({ ...w, boxes: w.boxes.slice(), kinds: w.kinds.slice(), names: w.names.slice(), colors: w.colors.slice(), levels: w.levels.map(l => ({ ...l, rects: l.rects.slice(), voids: l.voids.slice(), rooms: l.rooms.slice(), parts: l.parts.slice() })), hero: w.hero ? { ...w.hero } : null, doors: w.doors ? w.doors.slice() : undefined });
const addBox = (w: ShotWorld, b: number[], kind: number, name: string, color = 0x808080) => { w.boxes.push(...b); w.kinds.push(kind); w.names.push(name); w.colors.push(color); };
const eyeAt = (t: Track, i: number): V3 => [t.pos[3 * i], t.pos[3 * i + 1], t.pos[3 * i + 2]];
const lookAt = (t: Track, i: number): V3 => [t.look[3 * i], t.look[3 * i + 1], t.look[3 * i + 2]];
const setEye = (t: Track, i: number, p: V3) => { t.pos[3 * i] = p[0]; t.pos[3 * i + 1] = p[1]; t.pos[3 * i + 2] = p[2]; };
const setLook = (t: Track, i: number, p: V3) => { t.look[3 * i] = p[0]; t.look[3 * i + 1] = p[1]; t.look[3 * i + 2] = p[2]; };
const smooth = (u: number) => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** turn the look about the eye: yaw and pitch offsets (radians), the distance kept */
const turnLook = (t: Track, i: number, dyaw: number, dpitch = 0) => {
  const e = eyeAt(t, i), d = sub(lookAt(t, i), e), L = Math.hypot(d[0], d[1], d[2]) || 1, h = Math.hypot(d[0], d[2]);
  const yaw = Math.atan2(d[0], d[2]) + dyaw, pitch = Math.atan2(d[1], h) + dpitch;
  setLook(t, i, [e[0] + Math.sin(yaw) * Math.cos(pitch) * L, e[1] + Math.sin(pitch) * L, e[2] + Math.cos(yaw) * Math.cos(pitch) * L]);
};
/** the eye replaced by what it would be at c + k·(i − c) for |i − c| ≤ w: the same path flown k times as fast */
const burst = (t: Track, c: number, w: number, k: number) => {
  const N = t.samples, src = t.pos.slice(), srcL = t.look.slice();
  for (let i = Math.max(0, c - w); i <= Math.min(N - 1, c + w); i++) {
    const j = clamp(c + k * (i - c), 0, N - 1), a = Math.floor(j), f = j - a, b = Math.min(N - 1, a + 1);
    for (let q = 0; q < 3; q++) { t.pos[3 * i + q] = src[3 * a + q] + (src[3 * b + q] - src[3 * a + q]) * f; t.look[3 * i + q] = srcL[3 * a + q] + (srcL[3 * b + q] - srcL[3 * a + q]) * f; }
  }
};
const spans = (t: Track, name: string): Array<[number, number]> => { const b = BEATS.indexOf(name as any), out: Array<[number, number]> = []; for (let i = 0; i < t.samples;) { let j = i; while (j + 1 < t.samples && t.beat[j + 1] === t.beat[i]) j++; if (t.beat[i] === b) out.push([i, j]); i = j + 1; } return out; };

type Pair = { track: Track; world: ShotWorld };
/** `ref`: the track the fault was made from, when the clean base already has the finding (the comparison is against it);
 *  `repairs`: candidate repaired tracks, when even that is flagged — the code must clear on one of them */
type Bad = Pair & { via?: string[]; window?: [number, number]; ref?: Pair; repairs?: () => Pair[] };
type Ctx = { code: string; base: Base; world: ShotWorld; track: Track; N: number; dt: number; T: number; index: ReturnType<typeof createWorldIndex>; mid: number; midRoute: (secs: number) => number; enterI: number; faceWall: () => { eye: (dist: number) => V3; at: V3 } | null; crossings: () => Array<{ d: any; i: number; y: number }> };
type Injector = (c: Ctx, variant?: number) => Bad | null;
const win = (c: Ctx, i0: number, i1: number): [number, number] => [i0 * c.dt, i1 * c.dt];
const mk = (c: Ctx): { t: Track; w: ShotWorld } => ({ t: cloneTrack(c.track), w: cloneWorld(c.world) });

// a long, plain wall with clear floor in front of it, indoors: the place to stand for a blank frame, a graze
const faceWallOf = (world: ShotWorld, index: ReturnType<typeof createWorldIndex>) => (): { eye: (dist: number) => V3; at: V3 } | null => {
  const cands: Array<{ i: number; len: number }> = [];
  for (let i = 0; i < world.kinds.length; i++) {
    if (world.kinds[i] !== K.wall) continue;
    const b = world.boxes.slice(6 * i, 6 * i + 6), dx = b[3] - b[0], dz = b[5] - b[2], dy = b[4] - b[1];
    if (dy > 2.2 && Math.min(dx, dz) < 0.5 && Math.max(dx, dz) > 4) cands.push({ i, len: Math.max(dx, dz) });
  }
  cands.sort((a, b) => b.len - a.len || a.i - b.i);
  for (const { i } of cands) {
    const b = world.boxes.slice(6 * i, 6 * i + 6), alongX = b[3] - b[0] > b[5] - b[2], cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2, y = b[1] + 1.5;
    for (const sg of [-1, 1]) {
      const eyeAtD = (d: number): V3 => alongX ? [cx, y, sg < 0 ? b[2] - d : b[5] + d] : [sg < 0 ? b[0] - d : b[3] + d, y, cz];
      const p = eyeAtD(1.75), q: V3 = [cx, y, cz], dir = norm(sub(q, p));
      const h = index.raycast(p[0], p[1], p[2], dir[0], dir[1], dir[2], 3, k => k !== K.walk && k !== K.roof);
      if (!indoors(world, p[0], p[1], p[2]) || !indoors(world, eyeAtD(0.15)[0], y, eyeAtD(0.15)[2]) || !h || h.i !== i || h.t > 1.9) continue;
      return { eye: eyeAtD, at: q };
    }
  }
  return null;
};

/** every interior doorway the track goes through: the doorway, the sample and the storey's floor */
const crossingsOf = (track: Track, world: ShotWorld, index: ReturnType<typeof createWorldIndex>) => () => {
  const nav = createNav(world, index), out: Array<{ d: any; i: number; y: number }> = [];
  for (const l of world.levels) for (const d of nav.doorsOn(l.id)) for (let i = 1; i < track.samples; i++) {
    const p = eyeAt(track, i), q = eyeAt(track, i - 1);
    if (p[1] < l.y + 0.4 || p[1] > l.y + 2.6) continue;
    const a0 = (q[0] - d.c[0]) * d.n[0] + (q[2] - d.c[1]) * d.n[1], a1 = (p[0] - d.c[0]) * d.n[0] + (p[2] - d.c[1]) * d.n[1];
    if (a0 * a1 >= 0) continue;
    if (Math.abs((p[0] - d.c[0]) * d.n[1] - (p[2] - d.c[1]) * d.n[0]) > d.w / 2 - 0.1) continue;
    out.push({ d, i, y: l.y });
  }
  return out;
};

/** where in the longest route span to put a fault of `secs` seconds: from the middle outward, the first place the clean track has no finding of `code` */
const cleanStart = (base: Base, code: string, r0: number, r1: number, secs: number): number => {
  const dt = base.track.dt, n = Math.round(secs / dt), lo = r0 + 5, hi = Math.max(lo, r1 - n - 5), mid = Math.max(lo, Math.min(hi, ((r0 + r1) >> 1) - (n >> 1)));
  const list = QA_CODES[code] === 'error' ? base.qa.errors : base.qa.warnings, dirty = (i: number) => list.some(f => f.code === code && f.tEnd >= i * dt - 0.8 && f.t <= (i + n) * dt + 0.8);
  for (let off = 0; off <= hi - lo; off += 30) for (const sg of [1, -1]) { const i = mid + sg * off; if (i >= lo && i <= hi && !dirty(i)) return i; }
  return mid;
};

const outsidePoint = (w: ShotWorld): V3 => [w.bounds.maxX + 6, 1.6, w.bounds.maxZ + 6];

// ---- one injector per code ----------------------------------------------------------------------------------------
const INJECT: Record<string, Injector> = {
  'wall-clip': c => { const { t, w } = mk(c), i = c.midRoute(0.3); let best = -1, bl = 0;
    for (let j = 0; j < w.kinds.length; j++) if (w.kinds[j] === K.wall) { const b = w.boxes.slice(6 * j, 6 * j + 6), l = Math.max(b[3] - b[0], b[5] - b[2]); if (Math.min(b[3] - b[0], b[5] - b[2]) > 0.1 && b[4] - b[1] > 2 && l > bl) { bl = l; best = j; } }
    const b = w.boxes.slice(6 * best, 6 * best + 6); for (let k = 0; k < 20; k++) setEye(t, i + k, [(b[0] + b[3]) / 2, b[1] + 1.4, (b[2] + b[5]) / 2]); return { track: t, world: w, window: win(c, i, i + 20) }; },
  'item-clip': c => { const { t, w } = mk(c), i = c.midRoute(0.3), h = w.hero!, ctr: V3 = [(h.core[0] + h.core[3]) / 2, (h.core[1] + h.core[4]) / 2, (h.core[2] + h.core[5]) / 2]; for (let k = 0; k < 20; k++) setEye(t, i + k, ctr); return { track: t, world: w, window: win(c, i, i + 20) }; },
  'site-clip': c => { const { t, w } = mk(c), i = c.midRoute(0.3); for (let j = 0; j < w.kinds.length; j++) if (w.kinds[j] === K.site && !c.index.siteInside[j]) { const b = w.boxes.slice(6 * j, 6 * j + 6), p: V3 = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]; if (indoors(w, p[0], p[1], p[2]) || b[4] - b[1] < 0.6) continue; for (let k = 0; k < 20; k++) setEye(t, i + k, p); return { track: t, world: w, window: win(c, i, i + 20) }; } return null; },
  'stair-clip': c => { const o = c.world.obbs.find(q => q.k === K.stair); if (!o) return null; const { t, w } = mk(c), i = c.midRoute(0.3); for (let k = 0; k < 20; k++) setEye(t, i + k, o.c); return { track: t, world: w, window: win(c, i, i + 20) }; },
  'roof-clip': c => { const o = c.world.obbs.find(q => q.k === K.roof && !indoors(c.world, q.c[0], q.c[1], q.c[2])); if (!o) return null; const { t, w } = mk(c); for (let k = 0; k < 20; k++) setEye(t, 20 + k, o.c); return { track: t, world: w, window: win(c, 20, 40) }; },
  'floor-clip': c => { const l = c.world.levels.slice().sort((a, b) => a.y - b.y)[0], r = l.rects[0], { t, w } = mk(c), i = c.midRoute(0.3); for (let k = 0; k < 20; k++) setEye(t, i + k, [r.x + r.w / 2, l.y + 0.02, r.z + r.d / 2]); return { track: t, world: w, window: win(c, i, i + 20) }; },
  'ceiling': c => {
    const up = c.world.levels.find(l => l.y > 0.5), lo = up && c.world.levels.find(l => l.y < up.y && l.y > up.y - 4.5); if (!up || !lo) return null;
    for (const r of up.rects) for (let x = r.x + 0.5; x < r.x + r.w; x += 0.5) for (let z = r.z + 0.5; z < r.z + r.d; z += 0.5) if (!up.voids.some(v => inRect(x, z, v, 0.3)) && inFootprint(lo.rects, x, z, 0.3)) {
      const { t, w } = mk(c), i = c.midRoute(0.3); for (let k = 0; k < 20; k++) setEye(t, i + k, [x, lo.y + lo.h - 0.1, z]); return { track: t, world: w, window: win(c, i, i + 20) };
    } return null; },
  'enters-through-wall': c => {
    const { t, w } = mk(c), e = w.entry!, lv = w.levels.find(l => l.id === e.level)!; let far: V3 | null = null;
    for (const r of lv.rects) for (let x = r.x + 1; x < r.x + r.w && !far; x += 0.5) for (let z = r.z + 1; z < r.z + r.d && !far; z += 0.5) if (Math.hypot(x - e.x, z - e.z) > 3 && inFootprint(lv.rects, x, z, 0.3)) far = [x, lv.y + 1.5, z];
    if (!far) return null;
    const o = outsidePoint(w); for (let k = 0; k < 4; k++) setEye(t, k, o); for (let k = 4; k < 30; k++) setEye(t, k, far); return { track: t, world: w, window: win(c, 4, 30) }; },
  'route-failed': c => { const { t, w } = mk(c); t.plan.failed = 'no way through'; return { track: t, world: w }; },
  'ends-outside': c => { const { t, w } = mk(c); for (let k = 0; k < 60; k++) setEye(t, c.N - 1 - k, outsidePoint(w)); return { track: t, world: w, window: [c.T, c.T] }; },
  'core-missing': c => { const { t, w } = mk(c); t.events.pressT = null; return { track: t, world: w }; },
  'core-occluded': c => { const { t, w } = mk(c), ip = Math.round(t.events.pressT! / c.dt), e = eyeAt(t, ip), h = w.hero!, ctr: V3 = [(h.core[0] + h.core[3]) / 2, (h.core[1] + h.core[4]) / 2, (h.core[2] + h.core[5]) / 2], d = sub(ctr, e), L = Math.hypot(d[0], d[1], d[2]), p = add(e, mul(d, 0.4)), r = 0.2 * L;
    addBox(w, [p[0] - r, p[1] - r, p[2] - r, p[0] + r, p[1] + r, p[2] + r], K.wall, 'panel'); return { track: t, world: w, window: [t.events.pressT!, t.events.pressT!] }; },
  'late-core': c => { const { t, w } = mk(c), tp = t.events.pressT!; for (let i = Math.round((tp - 1.7) / c.dt); i < Math.round((tp - 0.1) / c.dt); i++) turnLook(t, i, 60 * DEG); return { track: t, world: w, window: [tp, tp] }; },
  'press-speed': c => { const { t, w } = mk(c), ip = Math.round(t.events.pressT! / c.dt), e = eyeAt(t, ip); for (let i = ip - 60; i <= ip + 60; i++) setEye(t, i, add(e, [(i - ip) * c.dt * 1.0, 0, 0])); return { track: t, world: w, window: [t.events.pressT!, t.events.pressT!] }; },
  'press-yaw': c => { const { t, w } = mk(c), ip = Math.round(t.events.pressT! / c.dt); for (let i = ip - 60; i <= ip + 60; i++) turnLook(t, i, 30 * DEG * (i - ip) * c.dt); return { track: t, world: w, window: [t.events.pressT!, t.events.pressT!] }; },
  'press-frame': c => { const { t, w } = mk(c), ip = Math.round(t.events.pressT! / c.dt); for (let i = ip - 90; i <= ip + 90; i++) turnLook(t, i, 30 * DEG * smooth(1 - Math.abs(i - ip) / 60)); return { track: t, world: w, window: [t.events.pressT!, t.events.pressT!] }; },
  'press-late': c => { const { t, w } = mk(c); t.events.pressT = c.T - 0.5; return { track: t, world: w, window: [c.T - 0.5, c.T - 0.5] }; },
  'yaw-whip': c => { const { t, w } = mk(c), i = c.midRoute(1.0); for (let k = i; k < c.N; k++) turnLook(t, k, 50 * DEG * smooth((k - i) * c.dt / 0.2)); return { track: t, world: w, window: win(c, i, i + 24) }; },
  'yaw-rate': c => { const { t, w } = mk(c), i = c.midRoute(1.0), yawAt = (k: number) => { const e = eyeAt(t, k), l = lookAt(t, k); return Math.atan2(l[0] - e[0], l[2] - e[2]); };
    // the turn to add makes the whole view turn at 72°/s: what the walk already turns at is taken off
    const base = wrapPi(yawAt(i + 90) - yawAt(i)) / (90 * c.dt), rho = 72 * DEG - base;
    for (let k = i; k < i + 90; k++) turnLook(t, k, rho * (k - i) * c.dt); for (let k = i + 90; k < c.N; k++) turnLook(t, k, rho * 90 * c.dt); return { track: t, world: w, window: win(c, i, i + 90) }; },
  'beat-yaw': c => INJECT['yaw-rate'](c),
  'pitch': c => { const { t, w } = mk(c), i = c.midRoute(0.3); for (let k = 0; k < 12; k++) { const e = eyeAt(t, i + k); setLook(t, i + k, add(e, [0.5, -3, 0.5])); } return { track: t, world: w, window: win(c, i, i + 12) }; },
  'beat-pitch': c => { const { t, w } = mk(c), i = c.midRoute(0.8); for (let k = i - 40; k < i + 40; k++) turnLook(t, k, 0, 25 * DEG * smooth(1 - Math.abs(k - i) / 24)); return { track: t, world: w, window: win(c, i - 24, i + 24) }; },
  'verticals': c => INJECT['beat-pitch'](c),
  'door-speed': c => { const { t, w } = mk(c); if (c.enterI < 0) return null; burst(t, c.enterI, 60, 4); return { track: t, world: w, window: win(c, c.enterI - 60, c.enterI + 60) }; },
  'reverse': c => { const { t, w } = mk(c), i = c.midRoute(1.2); for (let k = i; k < i + 100; k++) { const e = eyeAt(t, k), v = sub(eyeAt(t, k + 1), eyeAt(t, k - 1)); setLook(t, k, sub(e, mul(norm([v[0], 0, v[2]]), 4))); } return { track: t, world: w, window: win(c, i, i + 100) }; },
  'hero-surface': c => { const { t, w } = mk(c), i = c.midRoute(0.3), e = eyeAt(t, i); w.hero = { ...w.hero!, surfaceBox: [e[0] - 0.5, e[1] - 1.5, e[2] - 0.5, e[0] + 0.5, e[1] - 1.0, e[2] + 0.5] }; return { track: t, world: w, window: win(c, i, i + 40) }; },
  'monitor-near': c => { const { t, w } = mk(c), i = c.midRoute(0.3), e = eyeAt(t, i); w.hero = { ...w.hero!, monitor: [e[0] - 0.2, e[1] - 1.2, e[2] - 0.2, e[0] + 0.2, e[1] - 0.6, e[2] + 0.2] }; return { track: t, world: w, window: win(c, i - 60, i + 60) }; },
  'outside-share': c => { const { t, w } = mk(c), i = c.midRoute(0.3), n = Math.round(0.42 * c.N); for (let k = 0; k < n; k++) setEye(t, (i + k) % c.N, outsidePoint(w)); return { track: t, world: w, window: [0, 0] }; },
  'outside-share-high': c => {
    const { t, w } = mk(c), ext = spans(t, 'extStair').length > 0; let out = 0; for (let i = 0; i < c.N; i++) if (!indoors(w, ...eyeAt(t, i))) out++;
    const want = Math.round((ext ? 0.375 : 0.325) * c.N) - out; if (want <= 0) return null;
    const i = c.midRoute(0.3); for (let k = 0; k < want; k++) setEye(t, i + k, outsidePoint(w)); return { track: t, world: w, window: [0, 0] }; },
  'blank-frame': c => { const f = c.faceWall(); if (!f) return null; const { t, w } = mk(c), i = c.midRoute(1.0); for (let k = 0; k < 96; k++) { setEye(t, i + k, f.eye(0.5)); setLook(t, i + k, f.at); } return { track: t, world: w, window: win(c, i, i + 96) }; },
  'foreground-occluder': (c, v) => INJECT['blank-frame'](c, v),
  'near-blank': c => { const f = c.faceWall(); if (!f) return null; const { t, w } = mk(c), i = c.midRoute(1.2); for (let k = 0; k < 120; k++) { setEye(t, i + k, f.eye(1.7)); setLook(t, i + k, f.at); } return { track: t, world: w, window: win(c, i, i + 120) }; },
  'graze': c => { const f = c.faceWall(); if (!f) return null; const { t, w } = mk(c), i = c.midRoute(0.6); for (let k = 0; k < 36; k++) { setEye(t, i + k, f.eye(0.15)); setLook(t, i + k, f.at); } return { track: t, world: w, window: win(c, i, i + 36) }; },
  'dead-air': c => { const { t, w } = mk(c), i = c.midRoute(1.4), e = eyeAt(t, i), l = lookAt(t, i); for (let k = 0; k < 170; k++) { setEye(t, i + k, e); setLook(t, i + k, l); } return { track: t, world: w, window: win(c, i, i + 170) }; },
  'beat-floor': c => { const { t, w } = mk(c), i = c.midRoute(0.3); for (let k = 0; k < 3; k++) t.beat[i + k] = BEATS.indexOf('threshold'); return { track: t, world: w, window: win(c, i, i + 3) }; },
  'beat-window': c => { const { t, w } = mk(c), i = c.midRoute(0.3); if (!BEAT_WINDOW.reveal) return null; for (let k = 0; k < 20; k++) t.beat[i + k] = BEATS.indexOf('reveal'); return { track: t, world: w, window: win(c, i, i + 20) }; },
  'stair-short': c => { const { t, w } = mk(c), i = c.midRoute(1.0); for (let k = 0; k < 100; k++) t.beat[i + k] = BEATS.indexOf('stair'); return { track: t, world: w, window: win(c, i, i + 100) }; },
  'roof-timing': c => { const { t, w } = mk(c), i = c.enterI + 120; if (c.enterI < 0) return null; for (let k = 0; k < 40; k++) t.roofAlpha[i + k] = 0.5; return { track: t, world: w, window: win(c, i, i + 40) }; },
  'door-closed': c => { const x = c.crossings()[0]; if (!x) return null; const { t, w } = mk(c), d = x.d; addBox(w, [d.c[0] - 0.15, x.y, d.c[1] - 0.15, d.c[0] + 0.15, x.y + 2.1, d.c[1] + 0.15], K.wall, 'closed door'); return { track: t, world: w, window: win(c, x.i, x.i) }; },
  'via-missed': c => { const { t, w } = mk(c); return { track: t, world: w, via: ['a room the house does not have'], window: [0, 0] }; },
  'attic-route': c => { const { t, w } = mk(c), i = c.midRoute(0.6); w.levels.push({ id: 'attic', y: 30, h: 1.5, rects: [{ x: -1, z: -1, w: 2, d: 2 }], voids: [], parts: [], rooms: [], openings: [] }); for (let k = 0; k < 40; k++) setEye(t, i + k, [0, 30.8, 0]); return { track: t, world: w, window: win(c, i, i + 40) }; },
  'first-second': c => { const { t, w } = mk(c); for (let k = 0; k < 130; k++) { setEye(t, k, eyeAt(t, 0)); } return { track: t, world: w, window: [0, 0] }; },
  'last-second': c => { const { t, w } = mk(c), e = eyeAt(t, c.N - 130); for (let k = c.N - 130; k < c.N; k++) setEye(t, k, e); return { track: t, world: w, window: [c.T - 1, c.T - 1] }; },
  'floor-proximity': c => { const { t, w } = mk(c), i = c.midRoute(0.6); for (let k = 0; k < 40; k++) { const e = eyeAt(t, i + k), l = levelAt(w, e[0], e[1], e[2]); setEye(t, i + k, [e[0], (l ? l.y : 0) + 0.6, e[2]]); } return { track: t, world: w, window: win(c, i, i + 40) }; },
  'look-error': c => { const { t, w } = mk(c); if (!t.desired) return null; for (let i = 0; i < c.N; i++) t.desired[2 * i] += 0.7; return { track: t, world: w, window: [0, 0] }; },
  'core-height': c => { const { t, w } = mk(c); for (let k = 0; k < 60; k++) t.fov[c.N - 1 - k] = 100; return { track: t, world: w, window: [c.T, c.T] }; },
  'core-narrow': c => { const { t, w } = mk(c), h = w.hero!, ctr: V3 = [(h.core[0] + h.core[3]) / 2, (h.core[1] + h.core[4]) / 2, (h.core[2] + h.core[5]) / 2]; for (let k = 0; k < 60; k++) { const e = eyeAt(t, c.N - 1 - k); setEye(t, c.N - 1 - k, [ctr[0] + (e[0] - ctr[0]) * 3, e[1], ctr[2] + (e[2] - ctr[2]) * 3]); } return { track: t, world: w, window: [c.T, c.T] }; },
  'core-thirds': c => { const { t, w } = mk(c); for (let k = 0; k < 60; k++) t.composeW[c.N - 1 - k] = 0; return { track: t, world: w, window: [c.T, c.T] }; },
  'chair-share': c => { const { t, w } = mk(c), e = eyeAt(t, c.N - 1), l = lookAt(t, c.N - 1), d = norm(sub(l, e)), p = add(e, mul(d, 2.2)); w.hero = { ...w.hero!, chair: [p[0] - 0.9, p[1] - 0.9, p[2] - 0.9, p[0] + 0.9, p[1] + 0.9, p[2] + 0.9] }; return { track: t, world: w, window: [c.T, c.T] }; },
  'monitor-cut': c => { const { t, w } = mk(c), e = eyeAt(t, c.N - 1), l = lookAt(t, c.N - 1), d = norm(sub(l, e)), p = add(e, mul(d, -4)); w.hero = { ...w.hero!, monitor: [p[0] - 0.3, p[1] - 0.5, p[2] - 0.1, p[0] + 0.3, p[1] + 0.1, p[2] + 0.1] }; return { track: t, world: w, window: [c.T, c.T] }; },
  'fov-rate': c => { const { t, w } = mk(c), i = c.midRoute(1.0); for (let k = i; k < c.N; k++) t.fov[k] = Math.min(150, t.fov[k] + 9); return { track: t, world: w, window: win(c, i, i + 1) }; },
  'fov-range': c => { const { t, w } = mk(c), i = c.midRoute(0.6); for (let k = 0; k < 60; k++) t.fov[i + k] = 30; return { track: t, world: w, window: win(c, i, i + 60) }; },
  'beat-speed': c => { const { t, w } = mk(c), i = c.midRoute(1.5); burst(t, i, 80, 6); return { track: t, world: w, window: win(c, i - 80, i + 80) }; },
  'accel': c => INJECT['beat-speed'](c),
  'jerk': c => INJECT['beat-speed'](c),
  'doorway-speed': (c, v = 0) => { const x = c.crossings()[v]; if (!x) return null; const { t, w } = mk(c); burst(t, x.i, 40, 3); return { track: t, world: w, window: win(c, x.i - 40, x.i + 40) }; },
  'door-funnel': (c, v = 0) => {
    const x = c.crossings()[v]; if (!x) return null;
    const n = x.d.n, side: V3 = [-n[1], 0, n[0]], lat = (k: number, t: Track) => (t.pos[3 * k] - x.d.c[0]) * side[0] + (t.pos[3 * k + 2] - x.d.c[1]) * side[2];
    // the reference: the walk straightened through the middle of the doorway (its lateral offset blended out over ±1.5 s)
    const ref = mk(c); const src = c.track;
    for (let k = x.i - 180; k <= x.i + 180; k++) if (k >= 0 && k < c.N) { const wgt = smooth(1 - Math.abs(k - x.i) / 180); setEye(ref.t, k, add(eyeAt(src, k), mul(side, -lat(k, src) * wgt))); }
    const bad = { t: cloneTrack(ref.t), w: ref.w };
    for (let k = x.i - 90; k <= x.i + 90; k++) { const f = 0.5 + 0.5 * Math.cos(Math.PI * clamp((k - x.i) / 90, -1, 1)); setEye(bad.t, k, add(eyeAt(bad.t, k), mul(side, 0.3 * f))); }
    return { track: bad.t, world: bad.w, window: win(c, x.i - 90, x.i + 90), ref: { track: ref.t, world: ref.w } }; },
  'approach-axis': c => {
    const { t, w } = mk(c), e = w.entry!; if (c.enterI < 0) return null;
    const perp: V3 = [e.out[1], 0, -e.out[0]];
    for (let k = 0; k < c.enterI; k++) { const p = eyeAt(t, k), along = (p[0] - e.x) * e.out[0] + (p[2] - e.z) * e.out[1]; if (along > 0.2 && along < 4) setEye(t, k, add(p, mul(perp, 1.2 * smooth(along / 3)))); }
    return { track: t, world: w, window: [c.enterI * c.dt, c.enterI * c.dt] }; },
  'establish-crop': c => { const { t, w } = mk(c); for (let k = 0; k < 6; k++) turnLook(t, k, 40 * DEG); return { track: t, world: w, window: [0, 0] }; },
  'establish-sky': c => {
    const { t, w } = mk(c); for (let k = 0; k < 6; k++) turnLook(t, k, 0, 45 * DEG);
    return { track: t, world: w, window: [0, 0], repairs: () => [-40, -35, -30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25, 30].map(deg => { const r = mk(c); for (let k = 0; k < 6; k++) turnLook(r.t, k, 0, deg * DEG); return { track: r.t, world: r.w }; }) }; },
  'establish-occluder': c => { const { t, w } = mk(c), e = eyeAt(t, 0), d = norm(sub(lookAt(t, 0), e)), p = add(e, mul(d, 3)); addBox(w, [p[0] - 2, p[1] - 2, p[2] - 2, p[0] + 2, p[1] + 2, p[2] + 2], K.site, 'tree'); return { track: t, world: w, window: [0, 0] }; },
  'look-near': c => { const { t, w } = mk(c), i = c.midRoute(0.6); for (let k = 0; k < 48; k++) { const e = eyeAt(t, i + k); setLook(t, i + k, add(e, mul(norm(sub(lookAt(t, i + k), e)), 1.0))); } return { track: t, world: w, window: win(c, i, i + 48) }; },
  'crab': c => { const { t, w } = mk(c), i = c.midRoute(1.4); for (let k = i - 40; k < i + 140; k++) { const e = eyeAt(t, k), v = sub(eyeAt(t, k + 1), eyeAt(t, k - 1)), yaw = Math.atan2(v[0], v[2]) + 90 * DEG * smooth(Math.min((k - (i - 40)) / 18, (i + 140 - k) / 18)), L = 4; setLook(t, k, [e[0] + Math.sin(yaw) * L, e[1], e[2] + Math.cos(yaw) * L]); } return { track: t, world: w, window: win(c, i, i + 100) }; },
  'core-contrast': c => { const { t, w } = mk(c), ip = Math.round(t.events.pressT! / c.dt), e = eyeAt(t, ip), h = w.hero!, ctr: V3 = [(h.core[0] + h.core[3]) / 2, (h.core[1] + h.core[4]) / 2, (h.core[2] + h.core[5]) / 2], d = norm(sub(ctr, e)), p = add(ctr, mul(d, 1.05));
    addBox(w, [p[0] - 1, p[1] - 1.2, p[2] - 1, p[0] + 1, p[1] + 1.2, p[2] + 1], K.wall, 'backdrop', 0xe7e3dc); return { track: t, world: w, window: [t.events.pressT!, t.events.pressT!] }; },
  'core-room-side': c => { const { t, w } = mk(c), h = w.hero!; w.hero = { ...h, fwd: [-h.fwd[0], -h.fwd[1]] }; return { track: t, world: w, window: [0, c.T] }; },
  'top-rooms': c => { const { t, w } = mk(c), o = outsidePoint(w); for (let i = 0; i < c.N; i++) { setEye(t, i, [o[0], 30, o[2]]); setLook(t, i, [o[0], 40, o[2]]); } return { track: t, world: w, window: [0, 0] }; },
  'orbit-short': c => {
    const sp = spans(c.track, 'orbit'); if (!sp.length) return null; const { t, w } = mk(c), h = w.hero!, ctr: V3 = [(h.core[0] + h.core[3]) / 2, (h.core[1] + h.core[4]) / 2, (h.core[2] + h.core[5]) / 2], [i0, i1] = sp[0];
    const a0 = Math.atan2(eyeAt(t, i0)[0] - ctr[0], eyeAt(t, i0)[2] - ctr[2]);
    for (let i = i0; i <= c.N - 1; i++) { const e = eyeAt(t, i), a = a0 + wrapPi(Math.atan2(e[0] - ctr[0], e[2] - ctr[2]) - a0) * 0.3, r = Math.hypot(e[0] - ctr[0], e[2] - ctr[2]); setEye(t, i, [ctr[0] + Math.sin(a) * r, e[1], ctr[2] + Math.cos(a) * r]); }
    t.plan.orbit = { ...(t.plan.orbit || {}), reachable: 150, bestArc: 150 }; return { track: t, world: w, window: [i0 * c.dt, i0 * c.dt] }; },
  'orbit-swing-back': c => {
    const sp = spans(c.track, 'orbit'); if (!sp.length) return null; const { t, w } = mk(c), h = w.hero!, ctr: V3 = [(h.core[0] + h.core[3]) / 2, (h.core[1] + h.core[4]) / 2, (h.core[2] + h.core[5]) / 2], [i0, i1] = sp[0];
    const a1 = Math.atan2(eyeAt(t, i1)[0] - ctr[0], eyeAt(t, i1)[2] - ctr[2]), sg = Math.sign(wrapPi(a1 - Math.atan2(eyeAt(t, i0)[0] - ctr[0], eyeAt(t, i0)[2] - ctr[2]))) || 1;
    const e0 = eyeAt(t, i0), r = Math.hypot(e0[0] - ctr[0], e0[2] - ctr[2]), a0 = Math.atan2(e0[0] - ctr[0], e0[2] - ctr[2]), n = Math.round(2.4 / c.dt);
    for (let i = i0 - n; i < i0; i++) { const u = (i - (i0 - n)) / n, a = a0 + sg * 60 * DEG * (1 - u); setEye(t, i, [ctr[0] + Math.sin(a) * r, e0[1], ctr[2] + Math.cos(a) * r]); setLook(t, i, ctr); }
    return { track: t, world: w, window: [i0 * c.dt, i0 * c.dt] }; },
  'orbit-core-out-of-frame': c => { const sp = spans(c.track, 'orbit'); if (!sp.length) return null; const { t, w } = mk(c), [i0, i1] = sp[0], m = (i0 + i1) >> 1; for (let k = m; k < m + 30; k++) turnLook(t, k, 45 * DEG); return { track: t, world: w, window: win(c, m, m + 30) }; },
  'orbit-core-occluded': c => { const sp = spans(c.track, 'orbit'); if (!sp.length) return null; const { t, w } = mk(c), [i0, i1] = sp[0], m = (i0 + i1) >> 1, e = eyeAt(t, m), h = w.hero!, ctr: V3 = [(h.core[0] + h.core[3]) / 2, (h.core[1] + h.core[4]) / 2, (h.core[2] + h.core[5]) / 2], d = sub(ctr, e), L = Math.hypot(d[0], d[1], d[2]), p = add(e, mul(d, 0.4)), r = 0.2 * L;
    addBox(w, [p[0] - r, p[1] - r, p[2] - r, p[0] + r, p[1] + r, p[2] + r], K.wall, 'panel'); return { track: t, world: w, window: win(c, m - 6, m + 6) }; },
  'orbit-yaw-rate': c => { const sp = spans(c.track, 'orbit'); if (!sp.length) return null; const { t, w } = mk(c), [i0, i1] = sp[0], m = (i0 + i1) >> 1; burst(t, m, 30, 6); return { track: t, world: w, window: win(c, m - 30, m + 30) }; },
  // the two below need a door leaf in the world: see the leaf tests
  'door-leaf': () => null,
};

// ---- run each injector on the first base that takes it -------------------------------------------------------------
const codes = Object.keys(QA_CODES);
const used = fs.readFileSync(path.join(ROOT, 'assets', 'shot-qa.ts'), 'utf8').matchAll(/\b[EW]\('([a-z0-9-]+)'/g);
for (const m of used) say(m[1] in QA_CODES, `QA code "${m[1]}" is registered in QA_CODES`);
const caught: string[] = [], skipped: string[] = [];
for (const code of codes) {
  if (only && !only.has(code)) continue;
  if (!(code in INJECT)) { say(false, `${code}: no injector — add the fault that must trip it to scripts/test-shot-qa.mts`); continue; }
  if (code === 'door-leaf') continue;
  let done = false; const notes: string[] = []; let lastFail = '';
  outer: for (const base of bases) {
    const { world, track } = base, N = track.samples, dt = track.dt, index = createWorldIndex(world);
    const routes = spans(track, 'route').sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    const [r0, r1] = routes[0] || [Math.round(N * 0.4), Math.round(N * 0.6)];
    const enterI = base.qa.metrics.enterT === null || base.qa.metrics.enterT === undefined ? -1 : Math.round(base.qa.metrics.enterT / dt);
    const ctx: Ctx = { code, base, world, track, N, dt, T: track.duration, index, mid: (r0 + r1) >> 1, midRoute: secs => cleanStart(base, code, r0, r1, secs), enterI, faceWall: faceWallOf(world, index), crossings: crossingsOf(track, world, index) };
    for (let variant = 0; variant < 4; variant++) {
      let bd: Bad | null; try { bd = INJECT[code](ctx, variant); } catch (e: any) { say(false, `${code}: the injector threw on ${base.id}`, e.stack || String(e)); done = true; break outer; }
      if (!bd) { notes.push(`${base.id}#${variant}: n/a`); break; }
      const res = qaTrack(bd.track, bd.world, { via: bd.via });
      const level = QA_CODES[code], list = level === 'error' ? res.errors : res.warnings;
      const refRes = bd.ref ? qaTrack(bd.ref.track, bd.ref.world, { via: bd.via }) : null, clean = refRes ? (level === 'error' ? refRes.errors : refRes.warnings) : level === 'error' ? base.qa.errors : base.qa.warnings;
      const [w0, w1] = bd.window || [0, track.duration], near = (f: any, pad: number) => f.code === code && f.tEnd >= w0 - pad && f.t <= w1 + pad;
      const hit = list.some(f => near(f, 0.3)), was = clean.some(f => near(f, 0.3));
      const where = `${code} (${level}) is caught on ${base.id}${bd.window ? ` in ${w0.toFixed(1)}–${w1.toFixed(1)} s` : ''}`;
      if (hit && !was) { say(true, where); caught.push(code); done = true; break outer; }
      if (hit && was && bd.repairs) {
        const ok = bd.repairs().some(r => { const q = qaTrack(r.track, r.world, { via: bd!.via }); return !(level === 'error' ? q.errors : q.warnings).some(f => near(f, 0.3)); });
        if (ok) { say(true, `${where} (the real track has it too; a repaired frame clears it)`); caught.push(code); done = true; break outer; }
      }
      lastFail = `${where}\n` + (!hit ? `not reported. QA said: ${[...res.errors, ...res.warnings].filter(f => f.code === code).map(f => `${f.code}@${f.t}`).join(', ') || '(no such code at all)'}; errors: ${res.errors.map(f => f.code).join(', ')}` : 'the clean track already has this finding in that window — the injection proves nothing');
      if (!hit) break;   // a variant only helps when the clean track was already flagged
    }
  }
  if (!done) { skipped.push(code); say(false, lastFail || `${code}: no base could take the injection (${notes.join('; ')})`); }
}

// ---- door leaves: opened ahead of the eye by the planner, and QA holds them to it ---------------------------------------------
{
  const base = bases[1], { world, track } = base, index = createWorldIndex(world), nav = createNav(world, index);
  const cr = crossingsOf(track, world, index)()[0];
  if (!cr || (only && !only.has('door-leaf') && !only.has('door-closed'))) { if (!cr) say(false, 'no interior doorway on the route of the two-storey base: the door-leaf tests have nothing to open'); }
  else {
    // a shut leaf hung in that doorway: hinge at one jamb, its free edge along the doorway
    const d = cr.d, pc = eyeAt(track, cr.i), alongV: [number, number] = [-d.n[1], d.n[0]], sg = Math.sign((pc[0] - d.c[0]) * alongV[0] + (pc[2] - d.c[1]) * alongV[1]) || 1;
    const along: [number, number] = [alongV[0] * sg, alongV[1] * sg], hinge: [number, number] = [d.c[0] - along[0] * d.w / 2, d.c[1] - along[1] * d.w / 2];   // (hung on the jamb away from the eye's side)
    const yawOf = (v: [number, number]) => Math.atan2(v[0], v[1]) / DEG;
    const leaf: WDoor = { id: 'test:leaf', level: cr.d.level ?? null, kind: 'interior', leaf: 'single', hinge, y0: cr.y, h: 2.05, w: d.w, closedYaw: +yawOf(along).toFixed(1), openYaw: +(yawOf(along) + 90).toFixed(1), closedAngle: 0, openAngle: Math.PI / 2, swing: 'in', open: false };
    const w2 = { ...world, doors: [leaf] } as ShotWorld;
    const r = planDoorToCore(w2, { duration: 'auto' });
    if (!r.ok) say(false, 'the planner plans the two-storey base with a door leaf in it', (r as any).message);
    else {
      const t = r.track, ch = t.doors['test:leaf'];
      say(!!ch, 'the planner writes a channel for a shut leaf the route goes through');
      if (ch) {
        const q0 = qaTrack(t, w2);
        say(!q0.errors.some(e => e.code === 'door-closed') && !q0.warnings.some(e => e.code === 'door-leaf'), 'QA is content with the leaf opened ahead of the eye', [...q0.errors, ...q0.warnings].filter(e => e.code.startsWith('door-')).map(e => `${e.code}: ${e.message}`).join('\n'));
        say(ch[0] === 0 && Math.abs(ch[ch.length - 1] - Math.PI / 2) < 1e-3, 'the leaf starts shut and ends open', `${ch[0]} … ${ch[ch.length - 1]}`);
        // monotone opening, over about 0.7 s
        let rising = 0; for (let i = 1; i < ch.length; i++) { if (ch[i] < ch[i - 1] - 1e-6) rising = -1e9; if (ch[i] > ch[i - 1] + 1e-6) rising++; }
        say(rising > 0.3 * 120 && rising < 1.2 * 120, `the leaf takes about 0.7 s to swing, without turning back (${(rising / 120).toFixed(2)} s)`);
        // the fault: no channel → shut in the eye's way
        const t1 = cloneTrack(t); t1.doors = {};
        const q1 = qaTrack(t1, w2);
        say(q1.errors.some(e => e.code === 'door-closed'), 'door-closed (error) is caught when the track has no channel for a shut leaf');
        // the fault: opens too late (a fraction of the way when the eye is at the doorway)
        const t2 = cloneTrack(t); t2.doors['test:leaf'] = t2.doors['test:leaf'].map((_, i, a) => a[Math.max(0, i - 200)]) as any; t2.doors['test:leaf'] = Float32Array.from(t2.doors['test:leaf']);
        const q2 = qaTrack(t2, w2);
        say(q2.errors.some(e => e.code === 'door-closed'), 'door-closed (error) is caught when the leaf opens 1.7 s late (the eye is at the doorway before it is open)');
        // the fault: the open leaf lies across the path (openYaw = closedYaw)
        const w3 = { ...w2, doors: [{ ...leaf, openYaw: leaf.closedYaw }] } as ShotWorld;
        const q3 = qaTrack(t, w3);
        say(q3.warnings.some(e => e.code === 'door-leaf'), 'door-leaf (warning) is caught when the leaf swings into the eye');
        // an open leaf (built open) is left alone
        const w4 = { ...world, doors: [{ ...leaf, open: true }] } as ShotWorld, r4 = planDoorToCore(w4, { duration: 'auto' });
        say(r4.ok && Object.keys((r4 as any).track.doors).length === 0, 'a leaf the house built open gets no channel');
      }
    }
    void nav;
  }
}

// ---- the fleet checks: good rows pass, and each spoiled row fails ---------------------------------------------------------------
{
  const styles = ['axial', 'garden', 'corner-right', 'dollhouse', 'corner-left'], bgs = ['art', 'wall', 'window', 'bookcase', 'other'];
  const good = (k: number): FleetRow => ({
    id: `h${k}`, duration: 20, errors: 0, warnings: 3,
    metrics: { outsideShare: 0.27, firstSecond: 1.5, doorSpeed: 0.85, maxYawRate: 45, lookErrorMedian: 0.3, coreLOS: 4, pressSpeed: 0.02, topRoomsSeen: 3, finalCoreHeight: 0.22, finalCoreNDC: [((k % 7) - 3) * 0.1, ((k % 4) - 2) * 0.1], coreBg: bgs[k % 5], establish: { bearing: -45 + (k * 13) % 90 } },
    plan: { establish: { style: styles[k % 5] }, outside: { hasExt: false }, orbit: { arc: 100, reachable: 130 } },
  });
  const rows = Array.from({ length: 30 }, (_, k) => good(k));
  const base = fleetChecks(rows);
  say(base.every(c => c.pass), 'the fleet checks pass on 30 good rows', base.filter(c => !c.pass).map(c => `${c.id}: ${c.value}`).join('\n'));
  const spoil: Record<string, (r: FleetRow[]) => FleetRow[]> = {
    'outside-share': r => r.map((x, i) => i < 3 ? { ...x, metrics: { ...x.metrics, outsideShare: 0.4 } } : x),
    'first-second': r => r.map((x, i) => i === 0 ? { ...x, metrics: { ...x.metrics, firstSecond: 0.1 } } : x),
    'door-speed': r => r.map((x, i) => i === 0 ? { ...x, metrics: { ...x.metrics, doorSpeed: 1.6 } } : x),
    'yaw': r => r.map((x, i) => i === 0 ? { ...x, metrics: { ...x.metrics, maxYawRate: 75 } } : x),
    'look-error': r => r.map((x, i) => i === 0 ? { ...x, metrics: { ...x.metrics, lookErrorMedian: 22 } } : x),
    'press': r => r.map((x, i) => i === 0 ? { ...x, metrics: { ...x.metrics, coreLOS: 0.4 } } : x),
    'top-rooms': r => r.map((x, i) => i < 8 ? { ...x, metrics: { ...x.metrics, topRoomsSeen: 1 } } : x),
    'core-height': r => r.map((x, i) => i < 8 ? { ...x, metrics: { ...x.metrics, finalCoreHeight: 0.1 } } : x),
    'final-positions': r => r.map(x => ({ ...x, metrics: { ...x.metrics, finalCoreNDC: [0.3, -0.2] } })),
    'establish-style': r => r.map((x, i) => i < 12 ? { ...x, plan: { ...x.plan, establish: { style: 'axial' } } } : x),
    'establish-bearing': r => r.map(x => ({ ...x, metrics: { ...x.metrics, establish: { bearing: 5 } } })),
    'finale-background': r => r.map((x, i) => i < 14 ? { ...x, metrics: { ...x.metrics, coreBg: 'window' } } : x),
    'orbit-arc': r => r.map((x, i) => i < 10 ? { ...x, plan: { ...x.plan, orbit: { arc: 50, reachable: 130 } } } : x),
    'qa-errors': r => r.map((x, i) => i === 0 ? { ...x, errors: 2 } : x),
  };
  for (const c of base) {
    const f = spoil[c.id]; if (!f) { say(false, `fleet check "${c.id}" has no spoiled row in scripts/test-shot-qa.mts`); continue; }
    const got = fleetChecks(f(rows)).find(x => x.id === c.id);
    say(!!got && !got.pass, `fleet check "${c.id}" fails on a spoiled fleet${c.advisory ? ' (advisory)' : ''}`, got ? `it says: ${got.value}` : 'it did not report');
  }
}

console.log(bad ? `\n${bad} QA test${bad === 1 ? '' : 's'} failed` : `\nall QA v2 checks catch their faults (${caught.length} codes injected on ${bases.map(b => b.id).join(' + ')})`);
process.exit(bad ? 1 : 0);
