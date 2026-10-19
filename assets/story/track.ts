// The story track: the camera of a whole family tour as data, and the one pure function that reads it.
//
//   trackFrameAt(track, t, aspect) -> { s, eye, target, fov, roofAlpha, beat }     a function of t and the aspect ALONE: no state, no clock,
//                                                                                    so the live player, the scrubber, the film (via __houseRenderFrames)
//                                                                                    and the tests all see the same frame, in any order
//   bakeTrack(ctx, beats, ...) -> { track, timeline }                               Node, at bake time (scripts/story-bake.mts)
//
// A track is a list of contiguous SEGMENTS covering [0, duration]:
//   hold   a beat's dwell: the eye drifts a few centimetres toward the anchor, and the view is COMPOSED on the anchor (poses.ts composeTarget)
//          from the beat's compose table, so a phone and a desktop each get the anchor on their own third and the whole of it in frame
//   move   the walk to the next beat's pose (route.ts), eye sampled at `hz` along a speed profile. The look is a blend, by the same weights at
//          every aspect, of where the PREVIOUS segment ended looking, where the walk is heading, and where the NEXT segment starts looking:
//          the join with each neighbour is exact at any aspect, with no pop
//   ftue   the first-run chapter: the planner's own door-to-core track (the establishing move, the walk to the Core's room, the hero ring and
//          the orbit), time-warped so each FTUE beat holds the part of the film that tells it, and played back through the planner's sampleTrack
//          (so the Core's composition and its narrow-frame lens are the planner's, which the goldens' author has tuned)
// A CUT (no route: another storey with no stair, an entry above the ground, a walk over 60 m) is a hold that starts at the beat's start,
// listed in events.cuts: the player or the film cross-fades there; reduced motion cuts at every beat (beatRest).
//
// THREE-free, deterministic (fixed grids, fixed rounding: every number is stored to 1 mm or 0.01 degree, so a lock re-bakes byte for byte).
// Owner: story-bake.
import { planDoorToCore, sampleTrack, hann, type Track as PlannerTrack } from '../shot-planner.js';
import { indoors, levelAt, type ShotWorld, type Box6 } from '../shot-world.js';
import type { V3 } from '../shot-probe.js';
import { composeAt, composeTarget, type Compose, type PoseCtx, type Solved } from './poses.js';
import { routeBetween, smoothRoute, failed, type Route } from './route.js';
import { canon, sha256Hex } from './roles.js';

const DEG = Math.PI / 180;
export const ASPECT_REF = 16 / 9;

// ---- the format ----------------------------------------------------------------------------------------------------------------
/** what the runtime needs to know about a beat's anchor: its box (for the popup's placement), the aim point and the compose table */
export type BeatFrame = { role: string; box: Box6; focus: V3; compose: Compose[]; level: string | null; fits: boolean; partial: boolean; rest: number };
export type HoldSeg = { k: 'hold'; t0: number; t1: number; beat: string; eye0: V3; eye1: V3; roof: number };
export type MoveSeg = {
  k: 'move'; t0: number; t1: number; to: string; n: number;
  /** n samples, flat xyz: the eye, and the heading point the walk looks along */
  pos: number[]; look: number[]; roof: number[];
  /** 'follow': the look leaves the previous view over [0, a1] of the walk, follows the heading, and joins the next over [c0, 1].
   *  'direct' (a short walk in one room): the look sweeps from the previous view to the next, and the heading is not used. */
  m: 'follow' | 'direct'; a1: number; c0: number;
};
export type FtueSeg = { k: 'ftue'; t0: number; t1: number; n: number; pos: number[]; look: number[]; fov: number[]; roof: number[]; cw: number[]; tan: number[]; compose: { ndcX: number; ndcY: number } | null; beats: string[] };
export type Seg = HoldSeg | MoveSeg | FtueSeg;
export type FilmPart = { id: string; from: number; to: number; at: number };
export type StoryTrack = {
  v: 1; duration: number; segs: Seg[];
  beats: Record<string, BeatFrame>;
  events: { press: number | null; ramp: number; cuts: number[]; enter: number | null };
  /** the Companion Core's box, for the popup placement and the end card */
  core: Box6 | null;
  /** the film: the parts of the tour it plays (a flagged beat, from its walk-in unless the beat before is skipped), where each lands in the film, and its length */
  film: { parts: FilmPart[]; duration: number };
  stats: { maxYawRate: number; maxPitchRate: number; cuts: number; routed: number; notes: string[] };
};
export type TrackFrame = { s: number; eye: V3; target: V3; fov: number; roofAlpha: number; beat: string | null; seg: number };

// ---- reading -------------------------------------------------------------------------------------------------------------------------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const angles = (eye: V3, p: V3): [number, number] => { const dx = p[0] - eye[0], dy = p[1] - eye[1], dz = p[2] - eye[2]; return [Math.atan2(dx, dz), Math.atan2(dy, Math.hypot(dx, dz))]; };

/** cubic Hermite through uniformly spaced samples (Catmull-Rom tangents; the ends use the one-sided slope): u in sample units */
function herm(arr: number[], n: number, u: number, c: number): number {
  const i = Math.max(0, Math.min(n - 2, Math.floor(u))), f = clamp01(u - i);
  const p0 = arr[3 * Math.max(0, i - 1) + c], p1 = arr[3 * i + c], p2 = arr[3 * (i + 1) + c], p3 = arr[3 * Math.min(n - 1, i + 2) + c];
  const m1 = i === 0 ? p2 - p1 : (p2 - p0) / 2, m2 = i + 2 > n - 1 ? p2 - p1 : (p3 - p1) / 2, f2 = f * f, f3 = f2 * f;
  return (2 * f3 - 3 * f2 + 1) * p1 + (f3 - 2 * f2 + f) * m1 + (-2 * f3 + 3 * f2) * p2 + (f3 - f2) * m2;
}
const hermV = (arr: number[], n: number, u: number): V3 => [herm(arr, n, u, 0), herm(arr, n, u, 1), herm(arr, n, u, 2)];
const lin1 = (arr: number[], u: number) => { const i = Math.max(0, Math.min(arr.length - 2, Math.floor(u))), f = clamp01(u - i); return arr[i] + (arr[i + 1] - arr[i]) * f; };

const ftueCache = new WeakMap<FtueSeg, PlannerTrack>();
function inflate(seg: FtueSeg): PlannerTrack {
  let tr = ftueCache.get(seg); if (tr) return tr;
  const n = seg.n, dur = seg.t1 - seg.t0, f32 = (a: number[]) => Float32Array.from(a);
  tr = { version: 2, planner: 'v2', type: 'story', id: '', duration: dur, fps: (n - 1) / dur, samples: n, dt: dur / (n - 1), pos: f32(seg.pos), look: f32(seg.look), fov: f32(seg.fov), roofAlpha: f32(seg.roof), composeW: f32(seg.cw), tanHReq: f32(seg.tan), compose: seg.compose, beat: new Uint8Array(n), beats: [], events: { enterT: null, stairT: [], pressT: null, settleT: null, doneT: dur, firstCoreT: null }, doors: {}, metrics: {}, plan: {} } as unknown as PlannerTrack;
  ftueCache.set(seg, tr); return tr;
}

/** The heading of a move at each of its samples, unwrapped so that it is continuous along the walk (a flight of stairs turns the heading through more than half a circle). */
const headingCache = new WeakMap<MoveSeg, number[]>();
function headingYaws(seg: MoveSeg): number[] {
  let h = headingCache.get(seg); if (h) return h;
  h = []; let last = 0;
  for (let i = 0; i < seg.n; i++) {
    const y = angles([seg.pos[3 * i], seg.pos[3 * i + 1], seg.pos[3 * i + 2]], [seg.look[3 * i], seg.look[3 * i + 1], seg.look[3 * i + 2]])[0];
    last = i ? last + wrapPi(y - last) : y; h.push(last);
  }
  headingCache.set(seg, h); return h;
}

type Raw = { eye: V3; target: V3; fov: number; roof: number };
function frameOf(track: StoryTrack, idx: number, t: number, aspect: number): Raw {
  const seg = track.segs[idx];
  if (seg.k === 'hold') {
    const bf = track.beats[seg.beat], row = composeAt(bf.compose, aspect), u = seg.t1 > seg.t0 ? smooth((t - seg.t0) / (seg.t1 - seg.t0)) : 0;
    const eye = lerp3(seg.eye0, seg.eye1, u);
    return { eye, target: composeTarget(eye, bf.focus, row.nx, row.ny, row.fov, aspect), fov: row.fov, roof: seg.roof };
  }
  if (seg.k === 'ftue') {
    const u = clamp01((t - seg.t0) / (seg.t1 - seg.t0)), f = sampleTrack(inflate(seg), u, aspect);
    let target = f.target;
    // a phone: the planner puts the Core where a wide frame wants it; on a tall one it goes above the bottom sheet, by the weight the planner gives the Core's composition
    if (aspect < 0.8 && track.core) {
      const w = lin1(seg.cw, u * (seg.n - 1)) * smooth((0.8 - aspect) / 0.3);
      if (w > 1e-3) { const c = track.core, centre: V3 = [(c[0] + c[3]) / 2, (c[1] + c[4]) / 2, (c[2] + c[5]) / 2]; target = lerp3(target, composeTarget(f.eye, centre, 0, 0.34, f.fov, aspect), w); }
    }
    return { eye: f.eye, target, fov: f.fov, roof: f.roofAlpha };
  }
  // a move: the eye along its samples, the look blended from the neighbours' views and the heading
  const u = clamp01((t - seg.t0) / (seg.t1 - seg.t0)), su = u * (seg.n - 1);
  const eye = hermV(seg.pos, seg.n, su), head = hermV(seg.look, seg.n, su), roof = lin1(seg.roof, su);
  const prev = idx > 0 ? frameOf(track, idx - 1, track.segs[idx - 1].t1, aspect) : null, next = idx + 1 < track.segs.length ? frameOf(track, idx + 1, track.segs[idx + 1].t0, aspect) : null;
  const [yB, pB] = angles(eye, head);
  // the view the walk leaves (the direction the eye looked in at its first sample) and the view it joins (the direction at its last): fixed directions,
  // not points, so passing close to the old subject does not whip the view round it
  const e0: V3 = [seg.pos[0], seg.pos[1], seg.pos[2]], m = 3 * (seg.n - 1), e1: V3 = [seg.pos[m], seg.pos[m + 1], seg.pos[m + 2]];
  const A = prev ? angles(e0, prev.target) : null, C = next ? angles(e1, next.target) : null;
  let yaw: number, pitch: number;
  if (seg.m === 'direct' && A && C) {
    // a sweep from the old view to the new, on the branch the first frame takes
    const s = smooth(u);
    yaw = A[0] + s * wrapPi(C[0] - A[0]); pitch = A[1] + s * (C[1] - A[1]);
  } else {
    const wA = A ? 1 - smooth(u / Math.max(1e-6, seg.a1)) : 0, wC = C ? smooth((u - seg.c0) / Math.max(1e-6, 1 - seg.c0)) : 0, wB = Math.max(0, 1 - wA - wC);
    // The turn from one view to another goes the way it goes at the walk's end it is anchored to (the principal angle there), and stays on that
    // branch all along: blending angles near 180 degrees apart must not flip sides in between. The heading is unwrapped along the walk first (a
    // walk up a flight of stairs turns it by more than half a circle while the old view is still fading), else the branch flips mid-walk and the
    // look jumps by the weight left on the old view times a full turn.
    const hy = headingYaws(seg), yBu = lin1(hy, su) + wrapPi(yB - lin1(hy, su));
    const aRef = A ? hy[0] + wrapPi(A[0] - hy[0]) : 0, cRef = C ? hy[seg.n - 1] + wrapPi(C[0] - hy[seg.n - 1]) : 0;
    yaw = yBu + (A ? wA * (aRef - yBu) : 0) + (C ? wC * (cRef - yBu) : 0);
    pitch = wB * pB + wA * (A ? A[1] : 0) + wC * (C ? C[1] : 0);
  }
  const dist = Math.max(1.5, next ? Math.hypot(next.target[0] - eye[0], next.target[1] - eye[1], next.target[2] - eye[2]) : 3);
  const target: V3 = [eye[0] + Math.sin(yaw) * Math.cos(pitch) * dist, eye[1] + Math.sin(pitch) * dist, eye[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
  const fa = prev ? prev.fov : next ? next.fov : 54, fb = next ? next.fov : fa;
  return { eye, target, fov: fa + (fb - fa) * smooth(u), roof };
}

/** the segment holding t: the last one that starts at or before it (a boundary belongs to the later segment) */
function segAt(track: StoryTrack, t: number): number {
  const s = track.segs; let lo = 0, hi = s.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m].t0 <= t) lo = m; else hi = m - 1; }
  return lo;
}

/** The camera at time t (seconds into the tour) for a frame of this aspect (width / height). Pure: the same (t, aspect) always gives the same frame. */
export function trackFrameAt(track: StoryTrack, t: number, aspect = ASPECT_REF): TrackFrame {
  const tt = Math.max(0, Math.min(track.duration, t)), idx = segAt(track, tt), seg = track.segs[idx];
  const f = frameOf(track, idx, Math.min(tt, seg.t1), aspect);
  const beat = seg.k === 'hold' ? seg.beat : seg.k === 'move' ? seg.to : ftueBeat(seg, tt);
  return { s: track.duration > 0 ? tt / track.duration : 0, eye: f.eye, target: f.target, fov: f.fov, roofAlpha: f.roof, beat, seg: idx };
}
const ftueBeat = (seg: FtueSeg, t: number): string | null => seg.beats.length ? seg.beats[Math.min(seg.beats.length - 1, Math.floor(((t - seg.t0) / Math.max(1e-6, seg.t1 - seg.t0)) * seg.beats.length))] : null;

/** The frame a beat comes to rest in (reduced motion cuts straight to it; the review contact sheet renders it) */
export function beatRestFrame(track: StoryTrack, beatId: string, aspect = ASPECT_REF): TrackFrame | null {
  const bf = track.beats[beatId]; return bf ? trackFrameAt(track, bf.rest, aspect) : null;
}

/** The roof channel of the track at 30 Hz, in the shape the page's shotRoofAlpha reads (preset.track.roofAlpha, preset.track.samples) */
export function roofChannel(track: StoryTrack, hz = 30): { samples: number; roofAlpha: Float32Array } {
  const n = Math.max(2, Math.round(track.duration * hz) + 1), a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = trackFrameAt(track, (i / (n - 1)) * track.duration, ASPECT_REF).roofAlpha;
  return { samples: n, roofAlpha: a };
}

/** The Companion Core's power as the preset reads it: a shot fraction and a ramp fraction; { at: -1 } where the tour never switches it on (always on) */
export function powerOf(track: StoryTrack): { at: number; ramp?: number } {
  const e = track.events; if (e.press === null) return { at: -1 };
  return { at: +(e.press / track.duration).toFixed(5), ramp: +Math.max(0.004, Math.min(0.08, e.ramp / track.duration)).toFixed(5) };
}

/** the stable hash of a track (its canonical JSON): the lock's trackSha */
export const trackSha = (track: StoryTrack) => sha256Hex(canon(track));

// ---- baking ----------------------------------------------------------------------------------------------------------------------------
export type BakeBeat = {
  id: string; chapterKind: 'ftue' | 'room' | 'outside' | 'outro';
  /** the safe pose solved for the beat's anchor (null: it lost its anchor; the bake reports it) */
  solved: Solved | null;
  /** seconds: the speech (narration + the agent's line + gap) from its first sound, and the popup's reading time, and the author's floor */
  audioS: number; readS: number; minS: number;
  film: boolean; wake: boolean;
};
export type BakeOpts = { hz?: number; ftue?: boolean; planned?: ReturnType<typeof planDoorToCore> };
export type Timeline = { duration: number; beats: Array<{ id: string; t0: number; t1: number; travel: [number, number] | null }>; filmBeats: string[]; filmDuration: number };

const R3 = (v: number) => Math.round(v * 1000) / 1000;
const R2 = (v: number) => Math.round(v * 100) / 100;
const r3v = (p: V3): V3 => [R3(p[0]), R3(p[1]), R3(p[2])];
const flat3 = (ps: V3[]) => { const o: number[] = []; for (const p of ps) o.push(R3(p[0]), R3(p[1]), R3(p[2])); return o; };

export const SETTLE_S = 1.2;            // a beat is never shorter than its walk plus this long at rest
export const AUDIO_TAIL_S = 0.6;        // the beat outlasts its voice by this
export const SPEECH_LEAD_S = 0.25;      // the voice starts this long after a beat does ...
export const SPEECH_OVERLAP_S = 1.5;    // ... or, after a long walk, this long before the camera arrives (no dead air while it walks)
/** seconds into a beat at which its voice starts, given the length of its walk-in (null / 0: it starts at once) */
export const speechLead = (travel: number | null) => Math.max(SPEECH_LEAD_S, (travel ?? 0) - SPEECH_OVERLAP_S);
export const FILM_PAD_S = 0.35;
const YAW_RATE_CAP = 55;                // degrees a second, measured over 0.1 s (the planner's QA measures the same way)

/** words of a popup that a reader reads (title, body, note), seconds at 200 words a minute, and a half second to land on it */
export const readSeconds = (words: number) => words / 200 * 60 + 0.5;

export function bakeTrack(ctx: PoseCtx, beats: BakeBeat[], opts: BakeOpts = {}): { track: StoryTrack; timeline: Timeline; problems: string[]; notes: string[] } {
  const world = ctx.world, hz = opts.hz ?? 10, problems: string[] = [], notes: string[] = [];
  const segs: Seg[] = [], frames: Record<string, BeatFrame> = {}, bt: Timeline['beats'] = [];
  const cuts: number[] = []; let press: number | null = null, enter: number | null = null, t = 0, maxYaw = 0, maxPitch = 0, routed = 0;
  const lengthOf = (b: BakeBeat, travel: number) => Math.max(speechLead(travel) + b.audioS + AUDIO_TAIL_S, b.readS, b.minS, travel + SETTLE_S);
  const levelOfEye = (p: V3): string | null => { if (!indoors(world, p[0], p[1], p[2])) return null; const l = levelAt(world, p[0], p[1], p[2]); return l ? l.id : null; };
  const frameFor = (s: Solved): BeatFrame => ({ role: s.pose.resolved.role, box: s.box, focus: s.focus, compose: s.compose, level: s.pose.level, fits: s.fitsAll, partial: s.partial, rest: 0 });

  // ---- 1. the first-run chapter, from the planner's door-to-core
  let i0 = 0, endEye: V3 | null = null, endLevel: string | null = null;
  const lead = beats.findIndex(b => b.chapterKind !== 'ftue'), nF = lead < 0 ? beats.length : lead;
  if (nF > 0 && opts.ftue !== false && world.entry && world.hero) {
    const plan = opts.planned || planDoorToCore(world, { duration: 'auto' });
    if (plan.ok) {
      const built = bakeFtue(world, plan.track, beats.slice(0, nF), hz, lengthOf);
      segs.push(built.seg); built.times.forEach(x => bt.push(x));
      Object.assign(frames, built.frames); t = built.seg.t1; press = built.press; enter = built.enter; i0 = nF;
      const n = built.seg.n; endEye = [built.seg.pos[3 * (n - 1)], built.seg.pos[3 * (n - 1) + 1], built.seg.pos[3 * (n - 1) + 2]];
      endLevel = levelOfEye(endEye);
      notes.push(`ftue: planner track ${plan.track.duration.toFixed(1)} s, played over ${(built.seg.t1 - built.seg.t0).toFixed(1)} s`);
    } else {
      const f = plan as { code?: string; message?: string };
      notes.push(`ftue: the planner failed (${f.code}: ${f.message}); the first-run beats use their own poses`);
    }
  }

  // ---- 2. every other beat: walk to the pose, then dwell
  let prev: { eye: V3; level: string | null } | null = endEye ? { eye: endEye, level: endLevel } : null;
  for (let i = i0; i < beats.length; i++) {
    const b = beats[i], s = b.solved;
    if (!s) {
      problems.push(`${b.id}: no pose (the anchor was lost)`);
      // hold the previous view so the track stays whole; the bake exits 1
      const last = prev || { eye: [0, 1.6, 0] as V3, level: null }, L = lengthOf(b, 0);
      const fr: BeatFrame = { role: 'none', box: [last.eye[0] - 1, 0, last.eye[2] - 1, last.eye[0] + 1, 1, last.eye[2] + 1], focus: [last.eye[0], last.eye[1], last.eye[2] + 3], compose: [{ a: ASPECT_REF, nx: 0, ny: 0, fov: 54 }], level: last.level, fits: false, partial: false, rest: t };
      frames[b.id] = fr; segs.push({ k: 'hold', t0: R3(t), t1: R3(t + L), beat: b.id, eye0: r3v(last.eye), eye1: r3v(last.eye), roof: levelOfEye(last.eye) === null ? 1 : 0 });
      bt.push({ id: b.id, t0: R3(t), t1: R3(t + L), travel: null }); t += L; continue;
    }
    const pose = s.pose, fr = frameFor(s), standing = { eye: pose.eye as V3, level: pose.level };
    const aim = s.focus, d = Math.hypot(aim[0] - pose.eye[0], aim[1] - pose.eye[1], aim[2] - pose.eye[2]);
    // the dwell's drift: toward the anchor, never closer than 0.3 m to its box in plan, at most 20 cm or 5 %
    const bx = Math.max(s.box[0] - pose.eye[0], 0, pose.eye[0] - s.box[3]), bz = Math.max(s.box[2] - pose.eye[2], 0, pose.eye[2] - s.box[5]), clearTo = Math.hypot(bx, bz);
    const drift = Math.max(0, Math.min(0.2, 0.05 * d, clearTo - 0.3)), k = d > 1e-6 ? drift / d : 0;
    const eye1: V3 = [pose.eye[0] + (aim[0] - pose.eye[0]) * k, pose.eye[1] + (aim[1] - pose.eye[1]) * k * 0.5, pose.eye[2] + (aim[2] - pose.eye[2]) * k];
    const roof = levelOfEye(pose.eye as V3) === null ? 1 : 0;
    let travel: number | null = null;
    if (prev) {
      const route = routeBetween(ctx, prev, standing);
      if (failed(route)) { cuts.push(R3(t)); notes.push(`${b.id}: cut (${route.reason})`); }
      else {
        // How the look turns: a short walk in a room sweeps from the old view to the new one; a long one (a doorway, a flight, a corner) looks
        // where it is going, turning away from the old view first and onto the new one last. Either way the walk takes at least as long as the
        // turns need at the cap, and longer until the measured rate is under it.
        const r = smoothRoute(ctx, route), dense = densify(r);
        const holdSeg: HoldSeg = { k: 'hold', t0: R3(t), t1: R3(t + 1), beat: b.id, eye0: r3v(pose.eye as V3), eye1: r3v(eye1), roof };
        const here = { v: 1, duration: t, segs: [...segs], beats: { ...frames, [b.id]: fr } } as unknown as StoryTrack;
        const aim = turns(here, holdSeg, dense);
        const direct = r.length < 5.5 && !dense.stairs.some(Boolean) && new Set(r.levels).size <= 1;
        const budget = 1.7 / (YAW_RATE_CAP * 0.85), floor = Math.max(1.4, dense.T0 + 0.9);
        // (a turn's window is its angle at the cap; when the measured rate is over, the window grows as well as the walk: a longer walk alone leaves it)
        let bm = 1, T = Math.max(floor, (direct ? aim.ac * budget : (aim.a + aim.c) * budget) + 0.4), ry = 0, rp = 0, mode = { m: (direct ? 'direct' : 'follow') as 'direct' | 'follow', a1: 0.3, c0: 0.6 };
        for (let attempt = 0; attempt < 8; attempt++) {
          const a1 = Math.max(0.08, Math.min(0.45, aim.a * budget * bm / T)), c0 = 1 - Math.max(0.08, Math.min(0.45, aim.c * budget * bm / T));
          mode = { m: mode.m, a1, c0: Math.max(a1 + 0.05, c0) };
          const mv = buildMove(dense, T, hz, b.id, world, mode), idx = segs.length;
          const trial = { v: 1, duration: t + T + 1, segs: [...segs, { ...mv, t0: R3(t), t1: R3(t + T) }, { ...holdSeg, t0: R3(t + T), t1: R3(t + T + 1) }], beats: { ...frames, [b.id]: fr } } as unknown as StoryTrack;
          const rate = measureRates(trial, idx); ry = rate.yaw; rp = rate.pitch;
          if (typeof process !== 'undefined' && process.env && process.env.STORY_BAKE_DEBUG) notes.push(`${b.id}: attempt ${attempt} ${mode.m} T=${T.toFixed(1)} route=${r.length.toFixed(1)}m turns=${aim.a.toFixed(0)}/${aim.c.toFixed(0)}/${aim.ac.toFixed(0)} yaw=${ry.toFixed(0)} pitch=${rp.toFixed(0)}`);
          if (ry <= YAW_RATE_CAP && rp <= YAW_RATE_CAP) break;
          if (attempt === 7) notes.push(`${b.id}: the look turns at ${ry.toFixed(0)} deg/s on the longest walk`);
          else { bm *= 1.25; T = Math.max(T * 1.08, floor, (direct ? aim.ac * budget * bm : (aim.a + aim.c) * budget * bm) + 0.4); }
        }
        maxYaw = Math.max(maxYaw, ry); maxPitch = Math.max(maxPitch, rp);
        const mv = buildMove(dense, T, hz, b.id, world, mode);
        segs.push({ ...mv, t0: R3(t), t1: R3(t + T) }); travel = T; routed++;
      }
    }
    const L = lengthOf(b, travel ?? 0), t0 = t, t1 = R3(t0 + L), arrive = R3(t0 + (travel ?? 0));
    if (travel !== null) fr.rest = arrive; else fr.rest = R3(t0 + Math.min(0.5, L / 2));
    frames[b.id] = fr;
    segs.push({ k: 'hold', t0: arrive, t1, beat: b.id, eye0: r3v(pose.eye as V3), eye1: r3v(eye1), roof });
    bt.push({ id: b.id, t0: R3(t0), t1, travel: travel !== null ? [R3(t0), arrive] : null });
    t = t1; prev = { eye: eye1, level: pose.level };
  }
  // a stitched duration: the segments tile [0, t]; fix tiny rounding gaps so each starts where the last ended
  for (let i = 1; i < segs.length; i++) segs[i].t0 = segs[i - 1].t1;

  const film = filmPlan(beats, bt);
  const track: StoryTrack = {
    v: 1, duration: R3(t), segs, beats: frames, events: { press, ramp: 1.5, cuts, enter },
    core: world.hero ? world.hero.core : null, film,
    stats: { maxYawRate: R2(maxYaw), maxPitchRate: R2(maxPitch), cuts: cuts.length, routed, notes },
  };
  return { track, timeline: { duration: track.duration, beats: bt, filmBeats: film.parts.map(p => p.id), filmDuration: film.duration }, problems, notes };
}

const HEADING_RATE = 35 * DEG;   // the walk slows until the heading it looks along turns no faster than this (rad/s)

/** The walk as a dense path (every 0.1 m) with the speed it can be walked at: 1.5 m/s indoors, 2 outdoors, 1 on a flight, and slower where the
 *  heading (3 m ahead on the path) turns quickly. Time and arc length convert both ways through `tc` / `sd`. */
type Dense = { P: V3[]; sd: number[]; tc: number[]; yaw: number[]; pitch: number[]; lvl: Array<string | null>; stairs: boolean[]; T0: number; S: number };
function densify(r: Route): Dense {
  const STEP = 0.1, P: V3[] = [r.pts[0]], lvl: Array<string | null> = [r.levels[0]], st: boolean[] = [r.mode[0] === 'stair'];
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1], b = r.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(L / STEP)), stair = r.mode[i] === 'stair' || r.mode[i - 1] === 'stair';
    for (let k = 1; k <= n; k++) { P.push(lerp3(a, b, k / n)); lvl.push(k === n ? r.levels[i] : r.levels[i - 1]); st.push(stair); }
  }
  const N = P.length, sd = new Array<number>(N).fill(0);
  for (let i = 1; i < N; i++) sd[i] = sd[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]);
  const S = sd[N - 1];
  // the heading: toward the point 3 m on (the end of the path when nearer), unwrapped
  const yaw = new Float64Array(N), pitch = new Float64Array(N); let last = 0, j = 0;
  for (let i = 0; i < N; i++) {
    while (j < N - 1 && sd[j] < sd[i] + 3) j++;
    const dx = P[j][0] - P[i][0], dz = P[j][2] - P[i][2], dh = Math.hypot(dx, dz);
    if (dh > 0.05) { last = last + wrapPi(Math.atan2(dx, dz) - last); }
    yaw[i] = last; pitch[i] = Math.atan2(P[j][1] - P[i][1], Math.max(dh, 0.05));
  }
  const ys = hann(yaw, 8), ps = hann(pitch, 8);
  const rho = new Float64Array(N); for (let i = 0; i + 1 < N; i++) rho[i] = Math.abs(ys[i + 1] - ys[i]) / STEP; rho[N - 1] = rho[Math.max(0, N - 2)];
  const rs = hann(rho, 6), tc = new Array<number>(N).fill(0);
  for (let i = 0; i + 1 < N; i++) { const vc = st[i] ? 1.0 : lvl[i] === null ? 2.0 : 1.5, v = Math.max(0.35, Math.min(vc, HEADING_RATE / Math.max(rs[i], 1e-3))); tc[i + 1] = tc[i] + STEP / v; }
  return { P, sd, tc, yaw: Array.from(ys), pitch: Array.from(ps), lvl, stairs: st, T0: tc[N - 1] || 1e-6, S };
}

/** the share of a move done at t of T: a dolly with 0.45 s ramps at each end (no ease-in crawl) */
function trapezoid(t: number, T: number): number {
  const a = Math.min(0.45, T * 0.3), vc = 1 / (T - a), x = Math.max(0, Math.min(T, t));
  if (x < a) return vc * x * x / (2 * a);
  if (x > T - a) return 1 - vc * (T - x) * (T - x) / (2 * a);
  return vc * a / 2 + vc * (x - a);
}

/** the move's samples: the eye along the dense path by its speed limits, the heading look 3 m ahead, the roof by the storey */
function buildMove(d: Dense, T: number, hz: number, to: string, world: ShotWorld, mode: { m: 'follow' | 'direct'; a1: number; c0: number }): Omit<MoveSeg, 't0' | 't1'> {
  const n = Math.max(3, Math.ceil(T * hz) + 1), dt = T / (n - 1), N = d.P.length;
  const pos: V3[] = [], look: V3[] = [], raw: number[] = [];
  let k = 1;
  for (let j = 0; j < n; j++) {
    const tau = trapezoid(j * dt, T) * d.T0;
    while (k < N - 1 && d.tc[k] < tau) k++;
    const f = d.tc[k] > d.tc[k - 1] ? Math.max(0, Math.min(1, (tau - d.tc[k - 1]) / (d.tc[k] - d.tc[k - 1]))) : 0;
    const p = lerp3(d.P[k - 1], d.P[k], f), yw = d.yaw[k - 1] + (d.yaw[k] - d.yaw[k - 1]) * f, pt = d.pitch[k - 1] + (d.pitch[k] - d.pitch[k - 1]) * f;
    pos.push(p); look.push([p[0] + Math.sin(yw) * Math.cos(pt) * 3, p[1] + Math.sin(pt) * 3, p[2] + Math.cos(yw) * Math.cos(pt) * 3]);
    raw.push(inRoof(world, p));
  }
  // the roof: a 0.35 s fade across the storey boundary
  const roof = Array.from(hann(Float64Array.from(raw), Math.max(1, Math.round(0.175 * hz)))).map(R2);
  return { k: 'move', to, n, pos: flat3(pos), look: flat3(look), roof, m: mode.m, a1: R3(mode.a1), c0: R3(mode.c0) };
}
/** 1 when the roof is on (the eye is outdoors), 0 when it is under a ceiling */
const inRoof = (world: ShotWorld, p: V3) => (indoors(world, p[0], p[1], p[2]) ? 0 : 1);

/** the turns a walk has to make, in degrees (the worst of a wide and a phone frame): away from the old view, onto the new one, and straight from one to the other */
function turns(before: StoryTrack, hold: HoldSeg, d: Dense) {
  let a = 0, c = 0, ac = 0;
  const e0 = d.P[0], e1 = d.P[d.P.length - 1], hStart = d.yaw[0], hEnd = d.yaw[d.yaw.length - 1];
  for (const asp of [ASPECT_REF, 0.5]) {
    const prev = before.segs.length ? frameOf(before, before.segs.length - 1, before.segs[before.segs.length - 1].t1, asp) : null;
    const next = frameOf({ segs: [hold], beats: before.beats } as unknown as StoryTrack, 0, hold.t0, asp);
    if (!prev) continue;
    const yA = angles(e0, prev.target)[0], yC = angles(e1, next.target)[0];
    ac = Math.max(ac, Math.abs(wrapPi(angles(e0, next.target)[0] - yA)) / DEG);
    a = Math.max(a, Math.abs(wrapPi(yA - hStart)) / DEG); c = Math.max(c, Math.abs(wrapPi(yC - hEnd)) / DEG);
  }
  return { a, c, ac };
}

/** the highest rates the look turns at over a move, in degrees a second over 0.1 s, at three aspects */
function measureRates(track: StoryTrack, idx: number) {
  const seg = track.segs[idx], step = 1 / 30; let yaw = 0, pitch = 0;
  for (const a of [ASPECT_REF, 1, 0.5]) {
    const ys: number[] = [], ps: number[] = [];
    for (let tt = seg.t0; tt <= seg.t1 + 1e-9; tt += step) { const f = frameOf(track, idx, Math.min(tt, seg.t1), a), [y, p] = angles(f.eye, f.target); ys.push(y); ps.push(p); }
    for (let i = 3; i < ys.length; i++) { yaw = Math.max(yaw, Math.abs(wrapPi(ys[i] - ys[i - 3])) / DEG / (3 * step)); pitch = Math.max(pitch, Math.abs(ps[i] - ps[i - 3]) / DEG / (3 * step)); }
  }
  return { yaw, pitch };
}

// ---- the first-run chapter ---------------------------------------------------------------------------------------------------------------
/** the FTUE beats' share of the planner's film: groups of it, in the order the story tells them */
const FTUE_GROUP: Record<string, number> = { 'ftue-delivery': 0, 'ftue-unbox': 1, 'ftue-plug-in': 2, 'ftue-join': 3, 'ftue-pick': 4, 'ftue-hello': 5 };

function bakeFtue(world: ShotWorld, pt: PlannerTrack, fb: BakeBeat[], hz: number, lengthOf: (b: BakeBeat, travel: number) => number) {
  // planner time of each boundary: the walk (everything before roomReveal), roomReveal, hero, orbit (in thirds); the power beat is dropped
  const first = (name: string) => pt.beats.find(b => b.name === name);
  const tRR = first('roomReveal')?.t0 ?? first('hero')?.t0 ?? first('orbit')?.t0 ?? pt.duration;
  const tH = Math.max(tRR, first('hero')?.t0 ?? first('orbit')?.t0 ?? tRR), tO = Math.max(tH, first('orbit')?.t0 ?? tH);
  const tP = Math.max(tO, first('power')?.t0 ?? pt.duration);
  const E = [0, tRR, tH, tO, tO + (tP - tO) / 3, tO + (tP - tO) * 2 / 3, tP];   // six groups of the film: walk, roomReveal, hero, orbit x 3
  const nb = fb.length;
  // which group each beat starts at: by its id (delivery, unbox, plug-in, join, pick, hello), else by its place; strictly increasing
  const start = fb.map((b, j) => FTUE_GROUP[b.id] ?? Math.floor(j * 6 / nb));
  start[0] = 0;
  for (let j = 1; j < nb; j++) start[j] = Math.max(start[j], start[j - 1] + 1);
  for (let j = nb - 1; j >= 0; j--) start[j] = Math.min(start[j], 6 - (nb - j));
  const src: Array<[number, number]> = nb <= 6
    ? fb.map((_, j) => [E[start[j]], E[j + 1 < nb ? start[j + 1] : 6]] as [number, number])
    : fb.map((_, j) => [tP * j / nb, tP * (j + 1) / nb] as [number, number]);
  // a beat plays at least as long as its part of the film takes at the planner's own speed caps (slower is always inside them)
  const lens = fb.map((b, j) => Math.max(lengthOf(b, 0), src[j][1] - src[j][0]));
  const T0s: number[] = []; let acc = 0; for (const L of lens) { T0s.push(acc); acc += L; }
  const total = acc, n = Math.ceil(total * hz) + 1, dt = total / (n - 1);
  const comp = (arr: Float32Array, k: number) => Float32Array.from({ length: pt.samples }, (_, q) => arr[3 * q + k]);
  const PX = [0, 1, 2].map(c => comp(pt.pos, c)), LK = [0, 1, 2].map(c => comp(pt.look, c));
  const at = (arr: ArrayLike<number>, tp: number) => { const u = Math.max(0, Math.min(pt.samples - 1, tp / pt.dt)), i = Math.min(pt.samples - 2, Math.floor(u)), f = u - i; return arr[i] + (arr[i + 1] - arr[i]) * f; };
  const pos: number[] = [], look: number[] = [], fov: number[] = [], roof: number[] = [], cw: number[] = [], tan: number[] = [];
  for (let j = 0; j < n; j++) {
    const ts = j * dt; let b = nb - 1; while (b > 0 && T0s[b] > ts + 1e-9) b--;
    const u = Math.max(0, Math.min(1, (ts - T0s[b]) / lens[b])), tp = src[b][0] + (src[b][1] - src[b][0]) * u;
    for (let c = 0; c < 3; c++) pos.push(R3(at(PX[c], tp)));
    for (let c = 0; c < 3; c++) look.push(R3(at(LK[c], tp)));
    fov.push(R2(at(pt.fov, tp))); roof.push(R2(at(pt.roofAlpha, tp))); cw.push(R3(at(pt.composeW, tp))); tan.push(R3(pt.tanHReq ? at(pt.tanHReq, tp) : 0));
  }
  const seg: FtueSeg = { k: 'ftue', t0: 0, t1: R3(total), n, pos, look, fov, roof, cw, tan, compose: pt.compose ? { ndcX: pt.compose.ndcX, ndcY: pt.compose.ndcY } : null, beats: fb.map(b => b.id) };
  const times = fb.map((b, j) => ({ id: b.id, t0: R3(T0s[j]), t1: R3(T0s[j] + lens[j]), travel: null as [number, number] | null }));
  // the frames: every FTUE beat is about the Core itself (the popup keeps off it), except the delivery (the front door)
  const h = world.hero!, core = h.core, e = world.entry!;
  const frames: Record<string, BeatFrame> = {};
  fb.forEach((b, j) => {
    const door = b.id === 'ftue-delivery';
    frames[b.id] = { role: door ? 'front-door' : 'core', box: door ? [e.x - 0.5, 0, e.z - 0.5, e.x + 0.5, 2.1, e.z + 0.5] : [core[0] - 0.12, core[1] - 0.04, core[2] - 0.12, core[3] + 0.12, core[4] + 0.12, core[5] + 0.12], focus: door ? [e.x, 1.2, e.z] : [(core[0] + core[3]) / 2, (core[1] + core[4]) / 2, (core[2] + core[5]) / 2], compose: [{ a: ASPECT_REF, nx: 0, ny: 0, fov: 50 }], level: door ? e.level : h.level, fits: true, partial: false, rest: R3(T0s[j] + lens[j] * 0.55) };
  });
  // the press: a moment into the plug-in beat (or the first beat that wakes the Core)
  const wake = fb.findIndex(b => b.id === 'ftue-plug-in'), w2 = wake >= 0 ? wake : fb.findIndex(b => b.wake);
  const press = w2 >= 0 ? R3(Math.min(T0s[w2] + 1.0, T0s[w2] + lens[w2] - 0.5)) : null;
  // the roof comes off when the eye first goes under a ceiling
  let enter: number | null = null; for (let j = 0; j < n; j++) if (roof[j] < 0.5) { enter = R3(j * dt); break; }
  return { seg, times, frames, press, enter };
}

// ---- the film: which parts of the tour it plays ------------------------------------------------------------------------------------------
function filmPlan(beats: BakeBeat[], bt: Timeline['beats']): StoryTrack['film'] {
  const parts: FilmPart[] = []; let at = 0;
  beats.forEach((b, i) => {
    if (!b.film) return;
    const x = bt[i], contiguous = i > 0 && beats[i - 1].film;
    // a film beat after a skipped one cuts in as its voice starts; after a film beat it walks in as the tour does
    const from = contiguous || !x.travel ? x.t0 : Math.max(x.t0, x.t0 + speechLead(x.travel[1] - x.travel[0]) - 0.4);
    if (parts.length) at += FILM_PAD_S;
    parts.push({ id: b.id, from: R3(from), to: x.t1, at: R3(at) }); at += x.t1 - from;
  });
  return { parts, duration: R3(at) };
}
