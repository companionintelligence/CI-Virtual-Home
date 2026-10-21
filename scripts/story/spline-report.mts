#!/usr/bin/env -S node --experimental-strip-types
// story:spline. The camera spline gate: grades the camera of every family's tour, from its bake lock, before a film is rendered (reference/story/spline.md).
//
//   pnpm run story:spline [-- <slug> ... | --all] [--json <file>] [--md <file>] [--strict] [--quiet]
//        [--dir <families dir>] [--houses <houses dir>] [--casting <file>]     (where the inputs are; the tests point them at a temp dir)
//
// What it reads, per family: content/families/<slug>.json (the story), <slug>.bake.json (the lock: poses with tier and resolved, timeline, track.segs, track.beats, stats, notes),
// content/houses/<house>.json + .plan.json (the spec's bytes and the world digest the planner reads), content/story/casting.json (fitNote and the pieces no beat may frame).
// It re-uses the repo's own functions (assets/story/*.js, assets/shot-*.js) for the camera (trackFrameAt), the clearances (the solver's own grid), the projection and the
// sight lines. No browser, no GPU, no clock: the same tree gives the same report byte for byte.
//
// Every rule is a defect with a severity: `fail` stops a film from rendering (--strict exits 1), `warn` is for a human to look at on the contact sheet. The thresholds are in
// `T` below, printed with every report, and explained in reference/story/spline.md. Output: a table (stdout), --md a markdown file, --json a JSON, worst homes first.
import fs from 'node:fs';
import path from 'node:path';
import { createPoseCtx, type PoseCtx } from '../../assets/story/poses.js';
import { trackFrameAt, type StoryTrack, type Seg } from '../../assets/story/track.js';
import { MAX_ROUTE_M, walkGrid, routeBetween, failed as routeFailed } from '../../assets/story/route.js';
import { CANVAS_TYPE_MIN } from '../../assets/story/place.js';
import { inputShas, staleReasons, allClipsReal } from '../../assets/story/runtime.js';
import { camera, projectBox, boxFrameShare, type V3 } from '../../assets/shot-probe.js';
import { K, levelAt, indoors, type ShotWorld, type Box6 } from '../../assets/shot-world.js';
import { CELL } from '../../assets/shot-nav.js';
import type { Story, BakeLock, VoiceLock } from '../../assets/story/types.js';
import type { RolesTable } from '../../assets/story/roles.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

// ---- the thresholds ------------------------------------------------------------------------------------------------------------------------------
/** Everything the gate decides by. Printed in every report. Why each value: reference/story/spline.md. */
export const T = {
  /** a tour may cut (crossfade, no walk) at most this many times */
  maxCuts: 3,
  /** the tour's own limit on how fast the look turns, degrees a second over 0.1 s: YAW_RATE_CAP in assets/story/track.ts (a test keeps the two equal) */
  lookCapDegPerS: 55,
  /** warn above cap x lookWarnAt (the tour's limit itself), fail above cap x lookFailAt: the stated margin is 5% (the report measures the whole track at three frames, the bake the walks at its own, so a hair of slack) */
  lookFailAt: 1.05, lookWarnAt: 1.0,
  /** a walk longer than this is a cut in the bake (MAX_ROUTE_M, assets/story/route.ts); a move baked longer is a stale lock. A walk on screen longer than maxMoveS seconds is dead time */
  maxRouteM: MAX_ROUTE_M, routeSlackM: 0.5, maxMoveS: 30,
  /** a pose is tier 0 or 1; tier 2 is the last resort (0.22 / 0.12 m) and fails */
  maxTier: 1,
  /** the beats whose anchor was answered by a fallback: warn per beat; warn over this share of the tour, fail over the second */
  fallbackWarnShare: 0.35, fallbackFailShare: 0.6,
  /** the solver's clearance (wall, furniture) in metres at each pose tier: TIERS in assets/story/poses.ts (a test keeps them equal); the check allows `clearEps` for the 3 mm rounding of a lock */
  clear: [{ wall: 0.42, item: 0.32 }, { wall: 0.30, item: 0.20 }, { wall: 0.22, item: 0.12 }],
  clearEps: 0.01,
  /** the eye of a hold's drift and of every sample of a walk: the walker's own last tier (assets/shot-nav.ts TIERS[4] is 0.18 / 0.06) less 0.03 m for the fillet and the interpolation */
  moveClear: { wall: 0.15, item: 0.03 },
  /** the anchor, at rest, at the film's frames: its longest side in px at the 1080 px short edge must be at least this many times the type floor (CANVAS_TYPE_MIN, 36 px) */
  anchorFailMult: 2, anchorWarnMult: 4,
  /** the share of an anchor's projected box that may fall outside the frame before the beat is a defect (a room, a lot zone and a `partial` anchor are exempt) */
  cropMaxShare: 0.12,
  /** a piece that no beat may frame counts as framed when this share of the frame (0..1) shows its box and a sight line to it is clear */
  neverFramedShare: 0.002, neverFramedRays: 2 / 9,
  /** the first and the last seconds of the tour are outdoors (the exterior move); the title card is the first titleCardS seconds of the film */
  exteriorFirstS: 1, exteriorLastS: 1, titleCardS: 4,
};
/** the frames a film or a cut is made in: 16:9, square, 9:16 */
export const FRAMES = [{ k: '16:9', a: 16 / 9, w: 1920, h: 1080 }, { k: '1:1', a: 1, w: 1080, h: 1080 }, { k: '9:16', a: 9 / 16, w: 1080, h: 1920 }];

// ---- the report's types --------------------------------------------------------------------------------------------------------------------------
export type Sev = 'fail' | 'warn';
export type Defect = { rule: string; beat: string | null; sev: Sev; msg: string; value?: number | string };
export type FamilyStats = {
  beats: number; filmBeats: number; tourS: number; filmS: number; tiers: [number, number, number]; fallbacks: number; cuts: number; cutReasons: string[];
  lookYaw: number; lookPitch: number; bakeYaw: number; aerial: number; durations: string;
};
export type FamilyReport = { slug: string; house: string | null; status: 'pass' | 'warn' | 'fail'; fails: number; warns: number; stats: FamilyStats | null; defects: Defect[] };
export type SplineInput = {
  slug: string; story: Story; lock: BakeLock; spec: any; specText: string; world: ShotWorld; table: RolesTable; voice?: VoiceLock | null; casting?: any | null;
  /** skip the lock-freshness check (the tests grade a lock they mutated on purpose) */
  skipStale?: boolean;
};

const R1 = (v: number) => Math.round(v * 10) / 10;
const R2 = (v: number) => Math.round(v * 100) / 100;
const DEG = Math.PI / 180;
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const angles = (eye: V3, p: V3): [number, number] => { const dx = p[0] - eye[0], dz = p[2] - eye[2]; return [Math.atan2(dx, dz), Math.atan2(p[1] - eye[1], Math.hypot(dx, dz))]; };
const beatAt = (beats: BakeLock['timeline']['beats'], t: number): string | null => { let id: string | null = null; for (const b of beats) { if (b.t0 <= t + 1e-9) id = b.id; else break; } return id; };

// ---- clearances (the solver's own grid) ----------------------------------------------------------------------------------------------------------
/** wall and furniture clearance at an eye, bilinear over the 0.2 m grid the solver and the walker use (a cell that is not free counts as 0). null: not checkable here (on a flight, in the air, on a raised deck). */
export function clearanceAt(ctx: PoseCtx, eye: V3, level: string | null | undefined, rung = 0): { wall: number; item: number } | null {
  const { world, nav } = ctx;
  let lv: ReturnType<typeof nav.levelOf> | null = null;
  if (level === undefined) { lv = indoors(world, eye[0], eye[1], eye[2]) ? levelAt(world, eye[0], eye[1], eye[2]) : null; if (!lv && indoors(world, eye[0], eye[1], eye[2])) return null; }
  else if (level !== null) lv = nav.levelOf(level);
  if (lv) { const h = eye[1] - lv.y; if (h < 0.6 || h > 2.4) return null; /* (a standing or sitting eye: a pose planted low in a wall is still in the wall) */ } else if (eye[1] > 2.0) return null;
  // on a flight or at the foot of one (within 0.5 m of a stair's plan box: S2's walking line, and the grid counts the flight's footprint as a wall), and in the front door (the leaf and the jambs): not the grid's business
  if (world.stairs.some(s => s.plan && eye[0] >= s.plan.minX - 0.5 && eye[0] <= s.plan.maxX + 0.5 && eye[2] >= s.plan.minZ - 0.5 && eye[2] <= s.plan.maxZ + 0.5)) return null;
  if (world.entry && Math.hypot(eye[0] - world.entry.x, eye[2] - world.entry.z) < 1.2) return null;
  // (`rung` > 0: a walk that the router rescued (assets/story/route.ts, the rescue ladder) was walked on the walker's grid, with the doorways opened and low furniture passed over:
  //  the sample is clear if either grid says so, so a walk through an arched door is read at its jambs, not at the digest's bounding box of the arch)
  const read = (g: ReturnType<typeof nav.grid>) => {
    const u = (eye[0] - g.x0) / CELL, v = (eye[2] - g.z0) / CELL;
    const i0 = Math.max(0, Math.min(g.W - 2, Math.floor(u))), j0 = Math.max(0, Math.min(g.H - 2, Math.floor(v))), fu = Math.max(0, Math.min(1, u - i0)), fv = Math.max(0, Math.min(1, v - j0));
    const at = (arr: Float32Array) => {
      const c = (j: number, i: number) => (g.free[j * g.W + i] ? arr[j * g.W + i] : 0);
      return (c(j0, i0) * (1 - fu) + c(j0, i0 + 1) * fu) * (1 - fv) + (c(j0 + 1, i0) * (1 - fu) + c(j0 + 1, i0 + 1) * fu) * fv;
    };
    return { wall: at(g.dW), item: at(g.dI) };
  };
  const plain = read(lv ? nav.grid(lv) : nav.grid(null, 0));
  if (!rung || !lv) return plain;
  const walker = read(walkGrid(ctx, lv.id, rung));
  return { wall: Math.max(plain.wall, walker.wall), item: Math.max(plain.item, walker.item) };
}

// ---- the pieces no beat may frame ----------------------------------------------------------------------------------------------------------------
export type Piece = { type: string; room: string; level: string; box: Box6; why: string };
const isBed = (t: string) => /(^|-)bed$/.test(t) && t !== 'pet-bed' && !/bedside/.test(t);
/** the words of the casting that name a piece, and the spec types they mean */
const NAMED: Array<[RegExp, string[]]> = [[/\bcrib/i, ['crib']], [/\btoddler/i, ['toddler-bed']], [/\bcradle/i, ['cradle']], [/\bbassinet/i, ['bassinet']], [/\bchanging table/i, ['changing-table']], [/\brocking horse/i, ['rocking-horse']]];
/**
 * The pieces the casting says no beat may frame, found in the house. The casting records them in words (a family's `reason`, `fitNote`, `household_text`, `care`):
 *   "the beats never frame a crib or a toddler bed", "no beat frames a rocking horse"  -> those pieces (crib, toddler bed, cradle, bassinet, changing table, rocking horse)
 *   "sleeping is not told", "never shown asleep"                                        -> every bed
 *   an explicit `neverFramed: ["crib", "room:Nursery"]` on the family's casting entry (spec types, or `room:<name>`: every piece in that room), if the casting ever carries one
 * ("the Nursery is never a stage" is a different rule: no beat is anchored in it, `neverStageRooms`.)
 */
export function neverFramedPieces(casting: any | null, world: ShotWorld): Piece[] {
  if (!casting) return [];
  const text = [casting.reason, casting.fitNote, casting.household_text, casting.care].filter(Boolean).join(' ');
  const types = new Set<string>(), rooms: string[] = [], why = new Map<string, string>();
  const say = /\bnever\b[^.]*\b(frame[ds]?|stage|shown|show|told)\b|\bno beat frames\b|\bis not told\b/i.test(text);
  if (say) for (const [re, ts] of NAMED) if (re.test(text)) for (const t of ts) { types.add(t); why.set(t, 'the casting keeps it out of frame'); }
  if (/\b(sleeping|sleep)\b[^.]*\b(not told|never)\b|\bnever\b[^.]*\basleep\b|\bnot told\b/i.test(text)) { for (const l of world.levels) for (const r of l.rooms) for (const it of r.items) if (isBed(it.type)) { types.add(it.type); why.set(it.type, 'the casting says sleeping is not told'); } }
  for (const x of casting.neverFramed || []) { if (String(x).startsWith('room:')) rooms.push(String(x).slice(5).toLowerCase()); else { types.add(String(x)); why.set(String(x), 'casting.neverFramed'); } }
  const out: Piece[] = [], idxByName = new Map<string, number[]>();
  world.names.forEach((n, i) => { const k = world.kinds[i]; if (k === K.hull || k === K.item) { let a = idxByName.get(n); if (!a) idxByName.set(n, a = []); a.push(i); } });
  const boxOf = (i: number): Box6 => world.boxes.slice(6 * i, 6 * i + 6) as Box6;
  for (const l of world.levels) for (const r of l.rooms) for (const it of r.items) {
    const inRoom = rooms.some(n => r.name.toLowerCase().includes(n));
    if (!types.has(it.type) && !inRoom) continue;
    if (/rug|ceiling|pendant|light|curtain|vent|window|door/i.test(it.type)) continue;
    // the digest boxes that are this piece (the same reading as assets/story/anchors.ts pieceBoxes: the hull that holds `at`, else the boxes that do, else a guess)
    const tol = 0.06, holds = (b: Box6) => it.at[0] >= b[0] - tol && it.at[0] <= b[3] + tol && it.at[1] >= b[2] - tol && it.at[1] <= b[5] + tol && b[4] > l.y - 0.5 && b[1] < l.y + 4;
    const cand = (idxByName.get(it.type) || []).map(boxOf).filter(holds);
    const hull = (idxByName.get(it.type) || []).filter(i => world.kinds[i] === K.hull && holds(boxOf(i)));
    const box: Box6 = hull.length ? boxOf(hull[0]) : cand.length ? [Math.min(...cand.map(b => b[0])), Math.min(...cand.map(b => b[1])), Math.min(...cand.map(b => b[2])), Math.max(...cand.map(b => b[3])), Math.max(...cand.map(b => b[4])), Math.max(...cand.map(b => b[5]))] : [it.at[0] - 0.45, l.y, it.at[1] - 0.45, it.at[0] + 0.45, l.y + 0.8, it.at[1] + 0.45];
    out.push({ type: it.type, room: r.name, level: l.id, box, why: why.get(it.type) || `a piece of the ${r.name}, which the casting keeps out of frame` });
  }
  return out;
}

/** The rooms the casting says are never a stage ("the Nursery is a spare room and is never a stage"): no beat may be anchored in them. Names, lower case. */
export function neverStageRooms(casting: any | null): string[] {
  if (!casting) return [];
  const text = [casting.reason, casting.fitNote, casting.household_text, casting.care].filter(Boolean).join(' '), out: string[] = [];
  if (/nursery[^.]*\bnever\b[^.]*\bstage\b|\bnever a stage\b[^.]*nursery/i.test(text)) out.push('nursery');
  return out;
}

/** does a camera at (eye, target, fov, aspect) show the piece: its box takes a share of the frame and a sight line is clear (the piece's own boxes do not block it)? */
export function frames(ctx: PoseCtx, piece: Piece, eye: V3, target: V3, fov: number, aspect: number): boolean {
  const { world, probe } = ctx;
  const inside = indoors(world, eye[0], eye[1], eye[2]), lv = inside ? levelAt(world, eye[0], eye[1], eye[2]) : null;
  if (inside && (!lv || lv.id !== piece.level)) return false;   // another storey: the floor is in the way
  const share = boxFrameShare(camera(eye, target, fov, aspect), piece.box);
  if (share < T.neverFramedShare) return false;
  const b = piece.box, c: V3 = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
  const own = new Set<number>(); const E = 0.12;
  for (let q = 0; q < world.kinds.length; q++) {
    const k = world.kinds[q]; if (k === K.wall || k === K.glass || k === K.roof || k === K.rail) continue;
    const o = world.boxes.slice(6 * q, 6 * q + 6) as Box6;
    if (o[0] < b[3] + E && o[3] > b[0] - E && o[1] < b[4] + E && o[4] > b[1] - E && o[2] < b[5] + E && o[5] > b[2] - E) own.add(q);
  }
  return probe.visibility(eye, c, Math.max(0.15, Math.min(0.4, (b[3] - b[0]) / 3)), !inside, q => own.has(q)) >= T.neverFramedRays;
}

// ---- the look's speed ----------------------------------------------------------------------------------------------------------------------------
/** The fastest the look turns over the whole track, degrees a second over 0.1 s (the bake's own measure, at 30 Hz, but over every segment and at the three film frames); a cut is not a turn. */
export function lookRates(track: StoryTrack, beats: BakeLock['timeline']['beats']) {
  const step = 1 / 30, n = Math.floor(track.duration / step), cuts = track.events.cuts || [];
  let yaw = 0, pitch = 0, yawAt = 0, pitchAt = 0;
  for (const fr of FRAMES) {
    const ys: number[] = [], ps: number[] = [];
    for (let i = 0; i <= n; i++) { const f = trackFrameAt(track, i * step, fr.a), [y, p] = angles(f.eye, f.target); ys.push(y); ps.push(p); }
    for (let i = 3; i <= n; i++) {
      const t0 = (i - 3) * step, t1 = i * step;
      if (cuts.some(c => c > t0 + 1e-6 && c <= t1 + 1e-6)) continue;
      const ry = Math.abs(wrapPi(ys[i] - ys[i - 3])) / DEG / (3 * step), rp = Math.abs(ps[i] - ps[i - 3]) / DEG / (3 * step);
      if (ry > yaw) { yaw = ry; yawAt = t1; }
      if (rp > pitch) { pitch = rp; pitchAt = t1; }
    }
  }
  return { yaw, pitch, yawBeat: beatAt(beats, yawAt), pitchBeat: beatAt(beats, pitchAt), yawAt, pitchAt };
}

// ---- grading -------------------------------------------------------------------------------------------------------------------------------------
const pathLength = (pos: number[], n: number) => { let L = 0; for (let i = 1; i < n; i++) L += Math.hypot(pos[3 * i] - pos[3 * i - 3], pos[3 * i + 1] - pos[3 * i - 2], pos[3 * i + 2] - pos[3 * i - 1]); return L; };

/** Grade one family's lock. Pure: everything it reads is in `inp`. */
export async function gradeFamily(inp: SplineInput): Promise<FamilyReport> {
  const { slug, story, lock } = inp, defects: Defect[] = [];
  const add = (rule: string, beat: string | null, sev: Sev, msg: string, value?: number | string) => defects.push({ rule, beat, sev, msg, ...(value === undefined ? {} : { value }) });
  const track = lock.track as StoryTrack, world = inp.world, ids = story.beats.map(b => b.id);
  const beatBy = new Map(story.beats.map(b => [b.id, b])), chapterKind = new Map(story.chapters.map(c => [c.id, c.kind]));

  // ---- the lock is the story's and the house's
  if (!inp.skipStale) {
    const voice = inp.voice ?? null, real = allClipsReal(story, voice);
    const shas = await inputShas({ specText: inp.specText, world, table: inp.table, story, voice, real });
    for (const why of staleReasons(lock, shas, real)) add('lock-stale', null, 'fail', `the bake lock is stale: ${why} (pnpm run story:bake -- ${slug})`);
  }
  const tl = lock.timeline.beats.map(b => b.id);
  if (ids.length !== tl.length || ids.some((id, i) => id !== tl[i])) add('lock-stale', null, 'fail', `the lock's beats are not the story's (story ${ids.length}, lock ${tl.length}): re-run story:bake`);

  // ---- 1. no lost anchor
  for (const id of ids) {
    const pose = lock.poses[id], bf = track.beats[id];
    if (!pose || !bf) add('anchor-lost', id, 'fail', `no pose in the lock: the anchor ${beatBy.get(id).anchor.role} was lost`);
    else if (bf.role === 'none') add('anchor-lost', id, 'fail', 'the track holds still here: the anchor was lost');
  }
  const ctx = createPoseCtx(world), posed = ids.filter(id => lock.poses[id] && track.beats[id] && track.beats[id].role !== 'none');

  // ---- 2. tiers and fallbacks
  const tiers: [number, number, number] = [0, 0, 0]; let fallbacks = 0, aerial = 0;
  for (const id of posed) {
    const p = lock.poses[id]; tiers[Math.min(2, p.tier)]++;
    if (p.tier > T.maxTier) add('pose-tier', id, 'fail', `tier ${p.tier} pose: the solver found no eye with the comfortable clearance (0.30 / 0.20 m or better); say it differently or pick another anchor`, p.tier);
    const want = beatBy.get(id).anchor.role;
    if (p.resolved.viaFallback > 0) { fallbacks++; add('fallback', id, 'warn', `${want} was answered by a fallback ${p.resolved.viaFallback} deep (${p.resolved.role}/${p.resolved.type}): the beat shows ${p.resolved.role}, not ${want}`, p.resolved.viaFallback); }
    if (p.level === null && p.eye[1] > 4) aerial++;
  }
  if (posed.length) {
    const share = fallbacks / posed.length;
    if (share > T.fallbackFailShare) add('fallback-share', null, 'fail', `${fallbacks} of ${posed.length} beats are fallbacks (${Math.round(share * 100)}%): the story asks for things this house does not have`, R2(share));
    else if (share > T.fallbackWarnShare) add('fallback-share', null, 'warn', `${fallbacks} of ${posed.length} beats are fallbacks (${Math.round(share * 100)}%)`, R2(share));
  }

  // ---- 3. how fast the look turns
  const rates = lookRates(track, lock.timeline.beats);
  const cap = T.lookCapDegPerS;
  for (const [what, v, beat, at] of [['yaw', rates.yaw, rates.yawBeat, rates.yawAt], ['pitch', rates.pitch, rates.pitchBeat, rates.pitchAt]] as Array<[string, number, string | null, number]>) {
    if (v > cap * T.lookFailAt) add('look-rate', beat, 'fail', `the look ${what === 'yaw' ? 'turns' : 'tilts'} at ${R1(v)} deg/s at ${R1(at)} s (the tour's limit is ${cap}, fail over ${R1(cap * T.lookFailAt)})`, R1(v));
    else if (v > cap * T.lookWarnAt) add('look-rate', beat, 'warn', `the look ${what === 'yaw' ? 'turns' : 'tilts'} at ${R1(v)} deg/s at ${R1(at)} s, over the tour's limit of ${cap} but inside the ${Math.round((T.lookFailAt - 1) * 100)}% margin`, R1(v));
  }

  // ---- 4. cuts
  const cutNotes = (track.stats.notes || []).filter(n => /: cut \(/.test(n)).map(n => { const m = /^([^:]+): cut \((.*)\)$/.exec(n); return m ? { beat: m[1], reason: m[2] } : { beat: null, reason: n }; });
  if (track.events.cuts.length > T.maxCuts) add('cuts', null, 'fail', `${track.events.cuts.length} cuts in one tour (at most ${T.maxCuts}): ${cutNotes.map(c => `${c.beat} (${c.reason})`).join('; ')}`, track.events.cuts.length);
  if (track.events.cuts.length !== track.stats.cuts) add('cuts', null, 'fail', `the lock counts ${track.stats.cuts} cuts but lists ${track.events.cuts.length}`);
  for (const c of cutNotes) {
    if (/no walkable leg|no flights connect|no entry door/.test(c.reason)) add('cut-reason', c.beat, 'warn', `a cut because the camera cannot walk there (${c.reason}): a house or stair problem to record for the geometry stream`);
  }
  if (cutNotes.length !== track.events.cuts.length) add('cuts', null, 'warn', `${track.events.cuts.length} cuts but ${cutNotes.length} named in the notes`);

  // ---- 5. walks: none longer than the cut threshold, none dead time
  for (const s of track.segs as Seg[]) {
    if (s.k !== 'move') continue;
    const L = pathLength(s.pos, s.n);
    if (L > T.maxRouteM + T.routeSlackM) add('walk-long', s.to, 'fail', `a walk of ${R1(L)} m is shown as a move (a walk over ${T.maxRouteM} m is a cut)`, R1(L));
    if (s.t1 - s.t0 > T.maxMoveS) add('walk-long', s.to, 'warn', `the walk takes ${R1(s.t1 - s.t0)} s on screen (over ${T.maxMoveS} s is dead time)`, R1(s.t1 - s.t0));
  }

  // ---- 6. every eye clear of walls and furniture
  const worstClear = new Map<string, { wall: number; item: number; need: { wall: number; item: number }; what: string }>();
  const clearCheck = (beat: string, eye: V3, level: string | null | undefined, need: { wall: number; item: number }, what: string, rung = 0) => {
    const c = clearanceAt(ctx, eye, level, rung); if (!c) return;
    const bw = c.wall - need.wall, bi = c.item - need.item, margin = Math.min(bw, bi), prev = worstClear.get(beat);
    if (margin < -T.clearEps && (!prev || margin < Math.min(prev.wall - prev.need.wall, prev.item - prev.need.item))) worstClear.set(beat, { wall: c.wall, item: c.item, need, what });
  };
  for (const id of posed) {
    const p = lock.poses[id], need = T.clear[Math.min(2, p.tier)];
    clearCheck(id, p.eye as V3, p.level, need, `the rest eye (tier ${p.tier})`);
  }
  // (the rung a walk was made on: only a walk the router RESCUED is read on the walker's grid; every other walk is read on the planner's, as it always was. The walk is asked of the
  //  router again from where the track left the camera, as the track did; if that gives no rescue the rung is 0, which can only read stricter)
  const walkRung = (segIx: number, to: string): number => {
    const before = (track.segs as Seg[])[segIx - 1], pose = lock.poses[to];
    if (!before || !pose) return 0;
    let from: { eye: V3; level: string | null } | null = null;
    if (before.k === 'hold') from = { eye: before.eye1, level: lock.poses[before.beat]?.level ?? null };
    else if (before.k === 'ftue') {
      const n = before.n, eye: V3 = [before.pos[3 * (n - 1)], before.pos[3 * (n - 1) + 1], before.pos[3 * (n - 1) + 2]];
      from = { eye, level: indoors(world, eye[0], eye[1], eye[2]) ? levelAt(world, eye[0], eye[1], eye[2])?.id ?? null : null };
    }
    if (!from) return 0;
    const r = routeBetween(ctx, from, { eye: pose.eye as V3, level: pose.level });
    return !routeFailed(r) && r.rescued ? r.rescued : 0;
  };
  for (const [si, s] of (track.segs as Seg[]).entries()) {
    if (s.k === 'hold') { clearCheck(s.beat, s.eye0, lock.poses[s.beat]?.level, T.moveClear, 'the start of the dwell'); clearCheck(s.beat, s.eye1, lock.poses[s.beat]?.level, T.moveClear, 'the end of the dwell drift'); }
    else if (s.k === 'move') { const rung = walkRung(si, s.to); for (let j = 0; j < s.n; j++) clearCheck(s.to, [s.pos[3 * j], s.pos[3 * j + 1], s.pos[3 * j + 2]], undefined, T.moveClear, `the walk, ${R1(s.t0 + (s.t1 - s.t0) * j / Math.max(1, s.n - 1))} s`, rung); }
  }
  for (const [beat, w] of worstClear) add('eye-clearance', beat, 'fail', `${w.what} is ${R2(w.wall)} m from a wall and ${R2(w.item)} m from furniture (needs ${w.need.wall} / ${w.need.item}): the camera is in or against the house`, R2(Math.min(w.wall - w.need.wall, w.item - w.need.item)));

  // ---- 7. the anchor, at rest, in every film frame: big enough, whole
  const floorPx = T.anchorFailMult * CANVAS_TYPE_MIN, warnPx = T.anchorWarnMult * CANVAS_TYPE_MIN;
  for (const id of posed) {
    const bf = track.beats[id], kind = chapterKind.get(beatBy.get(id).chapter);
    // the first-run chapter is the planner's film (its composition and lens are the planner's); the house from the street is the whole house; a room is framed by what is in it, not by its box (the camera stands inside it)
    if (kind === 'ftue' || bf.role === 'front-door' || bf.role === 'street' || bf.role === 'room') continue;
    for (const fr of FRAMES) {
      const f = trackFrameAt(track, bf.rest, fr.a), pb = projectBox(camera(f.eye, f.target, f.fov, fr.a), bf.box);
      if (!pb) { add('anchor-frame', id, 'fail', `at ${fr.k} the anchor (${bf.role}) is behind the lens at rest`); continue; }
      const w = (pb.maxX - pb.minX) / 2 * fr.w, h = (pb.maxY - pb.minY) / 2 * fr.h, size = Math.max(w, h);
      {
        const ix = Math.max(0, Math.min(1, pb.maxX) - Math.max(-1, pb.minX)), iy = Math.max(0, Math.min(1, pb.maxY) - Math.max(-1, pb.minY)), area = (pb.maxX - pb.minX) * (pb.maxY - pb.minY);
        const out = area > 1e-9 ? 1 - (ix * iy) / area : 0;
        if (out > T.cropMaxShare) add('anchor-frame', id, bf.partial || !bf.fits ? 'warn' : 'fail', `at ${fr.k} ${Math.round(out * 100)}% of the anchor (${bf.role}) is outside the frame${bf.partial ? ' (the bake marks it partial)' : ''}`, R2(out));
      }
      if (size < floorPx) add('anchor-size', id, 'fail', `at ${fr.k} the anchor (${bf.role}) is ${Math.round(size)} px across, under ${floorPx} px (${T.anchorFailMult} x the ${CANVAS_TYPE_MIN} px type floor)`, Math.round(size));
      else if (size < warnPx) add('anchor-size', id, 'warn', `at ${fr.k} the anchor (${bf.role}) is ${Math.round(size)} px across, under ${warnPx} px (${T.anchorWarnMult} x the type floor)`, Math.round(size));
    }
  }

  // ---- 8. no frame of a piece the casting keeps out of frame, no beat in a room it says is never a stage
  for (const name of neverStageRooms(inp.casting ?? null)) {
    for (const id of posed) {
      const bf = track.beats[id], cx = (bf.box[0] + bf.box[3]) / 2, cz = (bf.box[2] + bf.box[5]) / 2;
      const room = world.levels.filter(l => l.id === bf.level).flatMap(l => l.rooms).find(r => r.name.toLowerCase().includes(name) && cx >= r.b.x && cx <= r.b.x + r.b.w && cz >= r.b.z && cz <= r.b.z + r.b.d);
      if (room) add('never-stage', id, 'fail', `the anchor (${bf.role}) is in the ${room.name}, which the casting says is never a stage`, room.name);
    }
  }
  const pieces = neverFramedPieces(inp.casting ?? null, world);
  if (pieces.length) {
    const seen = new Set<string>();
    for (const id of posed) {
      const bf = track.beats[id];
      for (const fr of FRAMES) {
        const f = trackFrameAt(track, bf.rest, fr.a);
        for (const pc of pieces) {
          const key = `${id}|${pc.type}|${pc.room}`; if (seen.has(key)) continue;
          // (the first-run chapter is the planner's film: no camera hint of the story reaches it, so a piece seen there is a note for the geometry stream, not a fix in the story)
          if (frames(ctx, pc, f.eye, f.target, f.fov, fr.a)) { seen.add(key); add('never-framed', id, chapterKind.get(beatBy.get(id).chapter) === 'ftue' ? 'warn' : 'fail', `a ${pc.type} (${pc.room}) is in the ${fr.k} frame at rest, and ${pc.why}${chapterKind.get(beatBy.get(id).chapter) === 'ftue' ? ' (first-run chapter: the planner\'s camera, a note for the geometry stream)' : ''}`, pc.type); }
        }
      }
    }
    // a walk past the room is a warning: the camera is moving, but a crib that slides through the frame is still a crib
    for (const s of track.segs as Seg[]) {
      if (s.k !== 'move') continue;
      for (let t = s.t0; t <= s.t1 + 1e-9; t += 0.5) for (const fr of [FRAMES[0], FRAMES[2]]) {
        const f = trackFrameAt(track, Math.min(t, s.t1), fr.a);
        for (const pc of pieces) {
          const key = `${s.to}|walk|${pc.type}|${pc.room}`; if (seen.has(key) || seen.has(`${s.to}|${pc.type}|${pc.room}`)) continue;
          if (frames(ctx, pc, f.eye, f.target, f.fov, fr.a)) { seen.add(key); add('never-framed-walk', s.to, 'warn', `a ${pc.type} (${pc.room}) crosses the ${fr.k} frame on the walk to this beat, ${R1(t)} s`, pc.type); }
        }
      }
    }
  }

  // ---- 9. the first and the last seconds are the exterior move
  const outAt = (t: number) => { const f = trackFrameAt(track, t, 16 / 9); return !indoors(world, f.eye[0], f.eye[1], f.eye[2]); };
  const firstIn = [...Array(Math.round(T.exteriorFirstS * 10) + 1).keys()].map(i => i / 10).find(t => !outAt(t));
  if (firstIn !== undefined) add('exterior-first', ids[0] ?? null, 'fail', `the tour does not open outdoors: the eye is indoors at ${R1(firstIn)} s (the first ${T.exteriorFirstS} s are the exterior move)`);
  else if (track.events.enter !== null && track.events.enter < T.titleCardS) add('exterior-first', ids[0] ?? null, 'warn', `the eye goes indoors at ${R1(track.events.enter)} s, inside the film's ${T.titleCardS} s title card`, R1(track.events.enter));
  const lastIn = [...Array(Math.round(T.exteriorLastS * 10) + 1).keys()].map(i => track.duration - i / 10).find(t => !outAt(Math.max(0, t)));
  if (lastIn !== undefined) add('exterior-last', ids[ids.length - 1] ?? null, 'fail', `the tour does not close outdoors: the eye is indoors at ${R1(lastIn)} s (the last ${T.exteriorLastS} s are the exterior move)`);

  const fails = defects.filter(d => d.sev === 'fail').length, warns = defects.length - fails;
  const stats: FamilyStats = {
    beats: ids.length, filmBeats: lock.timeline.filmBeats.length, tourS: R1(track.duration), filmS: R1(lock.timeline.filmDuration), tiers, fallbacks, cuts: track.events.cuts.length, cutReasons: cutNotes.map(c => `${c.beat}: ${c.reason}`),
    lookYaw: R1(rates.yaw), lookPitch: R1(rates.pitch), bakeYaw: R1(track.stats.maxYawRate), aerial, durations: lock.durations,
  };
  return { slug, house: story.house, status: fails ? 'fail' : warns ? 'warn' : 'pass', fails, warns, stats, defects };
}

// ---- loading -------------------------------------------------------------------------------------------------------------------------------------
export type Dirs = { families: string; houses: string; casting: string; roles: string };
export const defaultDirs = (): Dirs => ({ families: path.join(ROOT, 'content', 'families'), houses: path.join(ROOT, 'content', 'houses'), casting: path.join(ROOT, 'content', 'story', 'casting.json'), roles: path.join(ROOT, 'content', 'story', 'roles.json') });
export const familySlugs = (dir: string) => fs.readdirSync(dir).filter(f => /^[a-z][a-z-]*\.json$/.test(f) && !/\.(voice|bake)\.json$/.test(f) && f !== 'films.json').map(f => f.replace(/\.json$/, '')).sort();

/** Read one family's files and grade it. A family with no lock, or whose files do not read, is a failing report, not a crash. */
export async function gradeSlug(slug: string, dirs: Dirs = defaultDirs()): Promise<FamilyReport> {
  const bad = (rule: string, msg: string, house: string | null = null): FamilyReport => ({ slug, house, status: 'fail', fails: 1, warns: 0, stats: null, defects: [{ rule, beat: null, sev: 'fail', msg }] });
  let story: Story; try { story = readJson(path.join(dirs.families, `${slug}.json`)); } catch (e: any) { return bad('story', `the story does not read: ${String(e.message).slice(0, 100)}`); }
  const lockPath = path.join(dirs.families, `${slug}.bake.json`);
  if (!fs.existsSync(lockPath)) return bad('lock-missing', `no bake lock (pnpm run story:bake -- ${slug})`, story.house);
  let lock: BakeLock; try { lock = readJson(lockPath); } catch (e: any) { return bad('lock-missing', `the bake lock does not read: ${String(e.message).slice(0, 100)}`, story.house); }
  let spec: any, specText: string, world: ShotWorld;
  try { specText = fs.readFileSync(path.join(dirs.houses, `${story.house}.json`), 'utf8'); spec = JSON.parse(specText); world = readJson(path.join(dirs.houses, `${story.house}.plan.json`)).shots.world; } catch (e: any) { return bad('house', `the house ${story.house} does not read: ${String(e.message).slice(0, 100)}`, story.house); }
  let casting: any = null; try { casting = (readJson(dirs.casting).families || []).find((f: any) => f.slug === slug) || null; } catch { /* no casting: no never-framed pieces */ }
  const voicePath = path.join(dirs.families, `${slug}.voice.json`), voice: VoiceLock | null = fs.existsSync(voicePath) ? readJson(voicePath) : null;
  return gradeFamily({ slug, story, lock, spec, specText, world, table: readJson(dirs.roles), voice, casting });
}

// ---- output --------------------------------------------------------------------------------------------------------------------------------------
export function sortWorstFirst(rs: FamilyReport[]): FamilyReport[] {
  return rs.slice().sort((a, b) => (b.fails - a.fails) || (b.warns - a.warns) || a.slug.localeCompare(b.slug));
}
const first = (r: FamilyReport) => { const d = r.defects.find(x => x.sev === 'fail'); return d ? `${d.rule}${d.beat ? ` (${d.beat})` : ''}` : '-'; };

export function fleetJson(rs: FamilyReport[]) {
  const sorted = sortWorstFirst(rs);
  return { v: 1, thresholds: { ...T, frames: FRAMES }, totals: { families: rs.length, pass: rs.filter(r => r.status === 'pass').length, warn: rs.filter(r => r.status === 'warn').length, fail: rs.filter(r => r.status === 'fail').length, fails: rs.reduce((n, r) => n + r.fails, 0), warns: rs.reduce((n, r) => n + r.warns, 0) }, families: sorted };
}

export function fleetMarkdown(rs: FamilyReport[]): string {
  const sorted = sortWorstFirst(rs), j = fleetJson(rs), L: string[] = [];
  L.push('# Camera spline report', '', `${j.totals.families} families: ${j.totals.pass} pass, ${j.totals.warn} with warnings only, ${j.totals.fail} fail (${j.totals.fails} failing defects, ${j.totals.warns} warnings). Worst first. A film renders only from a family that passes (reference/story/spline.md).`, '');
  L.push('| # | family | home | beats | tour s | film s | tiers 0/1/2 | fallbacks | cuts | look deg/s | fails | warns | first failing rule (beat) |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  sorted.forEach((r, i) => {
    const s = r.stats;
    L.push(s ? `| ${i + 1} | ${r.slug} | ${r.house} | ${s.beats} | ${s.tourS} | ${s.filmS} | ${s.tiers.join('/')} | ${s.fallbacks} | ${s.cuts} | ${s.lookYaw} / ${s.lookPitch} | ${r.fails} | ${r.warns} | ${first(r)} |` : `| ${i + 1} | ${r.slug} | ${r.house ?? '-'} | - | - | - | - | - | - | - | ${r.fails} | ${r.warns} | ${first(r)} |`);
  });
  L.push('', '## Defects', '');
  for (const r of sorted) {
    if (!r.defects.length) continue;
    L.push(`### ${r.slug} (${r.house ?? '-'}): ${r.fails} fail, ${r.warns} warn`, '', '| severity | rule | beat | what |', '|---|---|---|---|');
    for (const d of r.defects.slice().sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'fail' ? -1 : 1))) L.push(`| ${d.sev} | ${d.rule} | ${d.beat ?? '-'} | ${d.msg.replace(/\|/g, '/')} |`);
    if (r.stats && r.stats.cutReasons.length) L.push('', `Cuts: ${r.stats.cutReasons.join('; ')}`);
    L.push('');
  }
  L.push('## Thresholds', '', '| rule | value |', '|---|---|');
  for (const [k, v] of Object.entries(T)) L.push(`| ${k} | \`${JSON.stringify(v)}\` |`);
  L.push('');
  return L.join('\n');
}

function table(rs: FamilyReport[]): string {
  const sorted = sortWorstFirst(rs), w = Math.max(6, ...sorted.map(r => r.slug.length));
  const L = [`${'family'.padEnd(w)}  ${'beats'.padStart(5)} ${'tour s'.padStart(7)}  tiers   fb cuts  look y/p    fail warn  first failing rule`];
  for (const r of sorted) {
    const s = r.stats;
    L.push(`${r.slug.padEnd(w)}  ${s ? String(s.beats).padStart(5) : '    -'} ${s ? String(s.tourS).padStart(7) : '      -'}  ${s ? s.tiers.join('/').padEnd(6) : '-     '} ${s ? String(s.fallbacks).padStart(3) : '  -'} ${s ? String(s.cuts).padStart(4) : '   -'}  ${s ? `${s.lookYaw}/${s.lookPitch}`.padEnd(10) : '-'.padEnd(10)}  ${String(r.fails).padStart(3)} ${String(r.warns).padStart(4)}  ${first(r)}`);
  }
  return L.join('\n');
}

// ---- main ----------------------------------------------------------------------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2), valued = new Set(['json', 'md', 'dir', 'houses', 'casting', 'roles']), flags: Record<string, string> = {}, slugs: string[] = [];
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); flags[k] = valued.has(k) ? argv[++i] : 'true'; } else slugs.push(a); }
  const d = defaultDirs(), dirs: Dirs = { families: flags.dir ? path.resolve(flags.dir) : d.families, houses: flags.houses ? path.resolve(flags.houses) : d.houses, casting: flags.casting ? path.resolve(flags.casting) : d.casting, roles: flags.roles ? path.resolve(flags.roles) : d.roles };
  const list = flags.all === 'true' || !slugs.length ? familySlugs(dirs.families) : slugs;
  const reports: FamilyReport[] = [];
  for (const slug of list) reports.push(await gradeSlug(slug, dirs));
  if (flags.quiet !== 'true') {
    console.log(`camera spline gate: ${reports.length} famil${reports.length === 1 ? 'y' : 'ies'}\n`);
    console.log(table(reports));
    for (const r of sortWorstFirst(reports)) for (const x of r.defects.filter(x => x.sev === 'fail')) console.log(`  FAIL ${r.slug} ${x.rule}${x.beat ? ` [${x.beat}]` : ''}: ${x.msg}`);
    console.log(`\n${reports.filter(r => r.status === 'pass').length} pass, ${reports.filter(r => r.status === 'warn').length} warn only, ${reports.filter(r => r.status === 'fail').length} fail`);
  }
  if (flags.json) { fs.mkdirSync(path.dirname(path.resolve(flags.json)), { recursive: true }); fs.writeFileSync(flags.json, JSON.stringify(fleetJson(reports), null, 1) + '\n'); console.log(`wrote ${flags.json}`); }
  if (flags.md) { fs.mkdirSync(path.dirname(path.resolve(flags.md)), { recursive: true }); fs.writeFileSync(flags.md, fleetMarkdown(reports)); console.log(`wrote ${flags.md}`); }
  process.exit(flags.strict === 'true' && reports.some(r => r.fails > 0) ? 1 : 0);
}
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
