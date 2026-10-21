// The runtime join: the authored story + the voice lock + the bake lock = the one JSON the player and the film read (RuntimeStory).
// It also holds what the bake and the tour share about TIME: how long each thing is spoken (the voice lock's real durations, or an
// estimate at 150 words a minute marked as such), how long a popup takes to read, when inside a beat the voice, the line and the card start,
// and the staleness check that says whether a lock still matches the files it was made from.
//
// THREE-free except presetFromStory, which takes THREE as an argument (the page's, as presetFromTrack does). Nothing here reads a clock
// or a file. Owner: story-bake.
//
// NOTE (for story-validator): RuntimeStory is defined HERE. The contract's types.ts has no such type; if the validator wants it with the others,
// move it there and import it back; no field changes are needed.
import type { Story, Beat, Chapter, ClipId, VoiceLock, BakeLock, Member, FamilyInfo, Closing, WordTiming } from './types.js';
import { SIGNOFF } from './types.js';
import { canon, sha256Hex, rolesSha, type RolesTable } from './roles.js';
import { powerOf, roofChannel, trackFrameAt, readSeconds, speechLead, SPEECH_LEAD_S, type StoryTrack, type BeatFrame, type FilmPart } from './track.js';
import { planDoors } from '../shot-doors.js';
import type { ShotWorld } from '../shot-world.js';

// ---- words and time ----------------------------------------------------------------------------------------------------------
/** the speech rate of an estimate, words a minute (a real voice lock replaces it, beat by beat, and the lock says which it used) */
export const ESTIMATE_WPM = 150;
/** the agent's line follows the narration after this gap (the voice's own start in a beat is track.ts speechLead) */
export const SAY_GAP_S = 0.35;
export { SPEECH_LEAD_S };

export const wordsIn = (text: string) => (text.match(/\S+/g) || []).length;
/** what is spoken for a beat: its narration is the popup body; its agent line is `say.text`; the closing is its body plus the sign-off */
export const narrationOf = (b: Beat) => b.popup.body;
export const closingOf = (s: Story) => `${s.closing.body} ${SIGNOFF}`;
export const estimateMs = (text: string) => Math.round(wordsIn(text) / ESTIMATE_WPM * 60000);
/** every clip the story speaks, in order: <beat id>, <beat id>.say, ..., closing */
export function clipIds(s: Story): ClipId[] { const o: ClipId[] = []; for (const b of s.beats) { o.push(b.id); if (b.say) o.push(`${b.id}.say`); } o.push('closing'); return o; }
export function clipText(s: Story, id: ClipId): string {
  if (id === 'closing') return closingOf(s);
  if (id.endsWith('.say')) return s.beats.find(b => b.id === id.slice(0, -4))?.say?.text || '';
  return s.beats.find(b => b.id === id)?.popup.body || '';
}
/** seconds of a clip: the voice lock's real duration when it has the clip and its text still matches, else the estimate */
export function clipSeconds(s: Story, id: ClipId, voice: VoiceLock | null): { s: number; real: boolean } {
  const c = voice && voice.clips[id];
  if (c && c.durationMs > 0) return { s: c.durationMs / 1000, real: true };
  return { s: estimateMs(clipText(s, id)) / 1000, real: false };
}
/** The seconds a beat's speech takes from its first sound: the narration and (if it has one) the gap and the agent's line */
export function beatAudioSeconds(s: Story, b: Beat, voice: VoiceLock | null): { audioS: number; narrationS: number; sayS: number; real: boolean } {
  const n = clipSeconds(s, b.id, voice), y = b.say ? clipSeconds(s, `${b.id}.say`, voice) : null;
  return { audioS: n.s + (y ? SAY_GAP_S + y.s : 0), narrationS: n.s, sayS: y ? y.s : 0, real: n.real && (!y || y.real) };
}
/** reading time of what the card shows */
export const popupReadSeconds = (b: Beat) => readSeconds(wordsIn(b.popup.title) + wordsIn(b.popup.body) + wordsIn(b.popup.note || ''));
/** True when every clip the story speaks has a real duration in the lock: only then are the bake's durations the voice's */
export function allClipsReal(s: Story, voice: VoiceLock | null): boolean { return !!voice && clipIds(s).every(id => clipSeconds(s, id, voice).real); }

// ---- the join ----------------------------------------------------------------------------------------------------------------------
export type RuntimeClip = { file: string; sha256: string; bytes: number; durationMs: number; words: WordTiming[]; voice: string; speaker: 'narrator' | string };
export type RuntimeBeat = Omit<Beat, 'anchor' | 'camera' | 'capability'> & {
  /** seconds into the tour: the beat's start and end, and the walk-in (null: the camera is already there / the FTUE's one long move) */
  t0: number; t1: number; travel: [number, number] | null;
  /** when the camera is at rest (reduced motion cuts to here) */
  rest: number;
  /** seconds into the tour: the voice, the agent's line (null: none) and the card appearing */
  speechAt: number; sayAt: number | null; popupAt: number;
  /** the anchor as the camera sees it, for the popup's placement and the leader line */
  frame: Pick<BeatFrame, 'box' | 'focus' | 'role'>;
};
export type RuntimeChapter = Chapter & { beat0: number; beats: number; t0: number; t1: number };
/** Story v2: the real logo of an app the tour names (content/story/app-media.json; scripts/story/ship/player.mts fills it). A file is relative to the site root. */
export type RuntimeLogo = { file: string; w: number; h: number; alt: string };
export type RuntimeMedia = Record<string, { name: string; logo: RuntimeLogo | null }>;
export type RuntimeStory = {
  v: 1; slug: string; fictional: true;
  /** the apps of the beats (`app` and `with`) and their real logos; absent in a story shipped without the manifest. The card shows a logo beside the chip that names its app. */
  media?: RuntimeMedia;
  /** 'voice': the timeline is the recorded voice's. 'estimated': a draft (a release build refuses it) */
  durations: 'voice' | 'estimated';
  family: FamilyInfo; members: Member[]; chapters: RuntimeChapter[]; beats: RuntimeBeat[]; closing: Closing;
  duration: number;
  /** the film: the parts of the tour it plays and its length */
  film: { parts: FilmPart[]; duration: number };
  /** the camera */
  track: StoryTrack;
  /** clip id -> its file (relative to content/families/<slug>/, the site build rewrites it to a URL), timings and speaker */
  audio: Record<ClipId, RuntimeClip>;
};

/** Join the three files. The internal house id, the notes and the beats' anchors, camera hints and capabilities stay behind (they are not public). */
export function joinRuntime(story: Story, voice: VoiceLock | null, bake: BakeLock): RuntimeStory {
  const track = bake.track as StoryTrack;
  if (!track || track.v !== 1) throw new Error(`${story.slug}: the bake lock has no story track`);
  const tl = bake.timeline;
  if (tl.beats.length !== story.beats.length || tl.beats.some((b, i) => b.id !== story.beats[i].id)) throw new Error(`${story.slug}: the bake lock's beats are not the story's (re-run pnpm run story:bake)`);
  const byId = new Map(story.beats.map(b => [b.id, b]));
  const beats: RuntimeBeat[] = tl.beats.map(bt => {
    const b = byId.get(bt.id)!, { anchor: _a, camera: _c, capability: _k, ...pub } = b;
    const a = beatAudioSeconds(story, b, voice), speechAt = bt.t0 + speechLead(bt.travel ? bt.travel[1] - bt.travel[0] : null);
    const f = track.beats[b.id];
    return {
      ...pub, t0: bt.t0, t1: bt.t1, travel: bt.travel, rest: f ? f.rest : bt.t0,
      speechAt: +speechAt.toFixed(3), sayAt: b.say ? +(speechAt + a.narrationS + SAY_GAP_S).toFixed(3) : null,
      // the card comes in as the camera settles, or at the start when there is no walk
      popupAt: +(bt.travel ? Math.max(bt.t0, bt.travel[1] - 0.4) : bt.t0 + 0.15).toFixed(3),
      frame: f ? { box: f.box, focus: f.focus, role: f.role } : { box: [0, 0, 0, 1, 1, 1], focus: [0, 0, 0], role: 'none' },
    };
  });
  const chapters: RuntimeChapter[] = story.chapters.map(c => {
    const idx = beats.map((b, i) => (b.chapter === c.id ? i : -1)).filter(i => i >= 0);
    return { ...c, beat0: idx.length ? idx[0] : 0, beats: idx.length, t0: idx.length ? beats[idx[0]].t0 : 0, t1: idx.length ? beats[idx[idx.length - 1]].t1 : 0 };
  });
  const audio: Record<ClipId, RuntimeClip> = {};
  if (bake.durations === 'voice' && voice) {
    const narrator = story.family.narrator;
    for (const id of clipIds(story)) {
      const c = voice.clips[id]; if (!c) continue;
      const speaker = id.endsWith('.say') ? (story.beats.find(b => b.id === id.slice(0, -4))?.say?.speaker || 'narrator') : 'narrator';
      audio[id] = { file: c.file, sha256: c.sha256, bytes: c.bytes, durationMs: c.durationMs, words: c.words, voice: c.voice || narrator, speaker };
    }
  }
  return { v: 1, slug: story.slug, fictional: true, durations: bake.durations, family: story.family, members: story.members, chapters, beats, closing: story.closing, duration: tl.duration, film: { parts: track.film.parts, duration: track.film.duration }, track, audio };
}

// ---- the schedule helpers (the player's director and the film use these) -----------------------------------------------------------------
/** index of the beat playing at t (the last one that has started; 0 before the first) */
export function beatIndexAt(beats: Array<{ t0: number }>, t: number): number { let lo = 0, hi = beats.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (beats[m].t0 <= t) lo = m; else hi = m - 1; } return lo; }
export function chapterIndexAt(rs: RuntimeStory, t: number): number { const bi = beatIndexAt(rs.beats, t), id = rs.beats[bi]?.chapter; return Math.max(0, rs.chapters.findIndex(c => c.id === id)); }
/** where in the beat t is, 0 to 1 */
export const beatProgress = (b: { t0: number; t1: number }, t: number) => Math.max(0, Math.min(1, (t - b.t0) / Math.max(1e-6, b.t1 - b.t0)));
/** the word of a clip being spoken `ms` into it (-1 before the first word): the karaoke caption's index */
export function wordAt(words: WordTiming[], ms: number): number { let k = -1; for (let i = 0; i < words.length; i++) { if (words[i][1] <= ms) k = i; else break; } return k; }
/** The card is on screen from popupAt to the end of the beat; the agent's line, if any, from sayAt */
export function beatWindows(b: RuntimeBeat) { return { card: [b.popupAt, b.t1] as [number, number], speech: [b.speechAt, b.sayAt ?? b.t1] as [number, number], say: b.sayAt === null ? null : ([b.sayAt, b.t1] as [number, number]) }; }

// ---- staleness: does a lock still match what it was made from ----------------------------------------------------------------------------
/** The story's inputs to the bake that are not the voice: the beats' anchors, camera hints, flags, order, chapters, and the word counts that set an
 *  estimated beat's length (a copy edit that keeps the counts does not stale a lock; one that changes them does) */
export function anchorsOf(story: Story) {
  const kind = new Map(story.chapters.map(c => [c.id, c.kind]));
  return story.beats.map(b => ({ id: b.id, chapter: b.chapter, kind: kind.get(b.chapter), anchor: b.anchor, camera: b.camera || null, emphasis: b.emphasis || null, film: !!b.film, minSeconds: b.minSeconds ?? null, words: [wordsIn(b.popup.title), wordsIn(b.popup.body), wordsIn(b.popup.note || ''), b.say ? wordsIn(b.say.text) : 0] }));
}
export type Shas = { specSha: string; worldSha: string; rolesSha: string; anchorsSha: string; voiceSha: string | null };
/** the voice lock's part of the bake: the duration and file of every clip the story speaks */
export const voiceShaOf = (story: Story, voice: VoiceLock | null) => voice ? sha256Hex(canon(clipIds(story).map(id => [id, voice.clips[id] ? [voice.clips[id].sha256, voice.clips[id].durationMs] : null]))) : Promise.resolve(null);
/** The hashes of the files a bake is made from. `specText` is the HouseSpec's bytes; `world` the plan.json digest (`shots.world`). */
export async function inputShas(inp: { specText: string | Uint8Array; world: ShotWorld; table: RolesTable; story: Story; voice: VoiceLock | null; real: boolean }): Promise<Shas> {
  return {
    specSha: await sha256Hex(inp.specText), worldSha: await sha256Hex(canon(inp.world)), rolesSha: await rolesSha(inp.table),
    anchorsSha: await sha256Hex(canon(anchorsOf(inp.story))), voiceSha: inp.real ? await voiceShaOf(inp.story, inp.voice) : null,
  };
}
/** Why a bake lock is stale (an empty list: it is fresh). Each reason names the input that moved. */
export function staleReasons(lock: BakeLock, now: Shas, voiceReal: boolean): string[] {
  const why: string[] = [];
  if (lock.specSha !== now.specSha) why.push('the HouseSpec changed');
  if (lock.worldSha !== now.worldSha) why.push('the house\'s world digest (plan.json) changed');
  if (lock.rolesSha !== now.rolesSha) why.push('content/story/roles.json changed');
  if (lock.anchorsSha !== now.anchorsSha) why.push('the story\'s beats, anchors or camera hints changed');
  if (lock.durations === 'voice' && lock.voiceSha !== now.voiceSha) why.push('the voice lock changed');
  if (lock.durations === 'estimated' && voiceReal) why.push('a voice lock now covers every clip; the durations were estimated');
  return why;
}

// ---- the page's preset ---------------------------------------------------------------------------------------------------------------------
/** The tour as the page plays it: a SplinePresets entry (three.js injected, as shot-planner's presetFromTrack) whose frameAt is trackFrameAt, with the
 *  Core's power from the press, the baked roof channel and (given the world) the door leaves that swing open ahead of the eye. */
export function presetFromStory(THREE: any, track: StoryTrack, meta: { name?: string; world?: ShotWorld; dressing?: any } = {}) {
  const V = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);
  const T = track.duration, eyePoints: any[] = [], targetPoints: any[] = [];
  for (let t = 0; t < T; t += 0.25) { const f = trackFrameAt(track, t); eyePoints.push(V(f.eye)); targetPoints.push(V(f.target)); }
  { const f = trackFrameAt(track, T); eyePoints.push(V(f.eye)); targetPoints.push(V(f.target)); }
  const roof = roofChannel(track), doors: Record<string, Float32Array> = {};
  if (meta.world && (meta.world.doors || []).length) {
    const hz = 30, N = Math.max(2, Math.round(T * hz) + 1), pos = new Float32Array(3 * N);
    for (let i = 0; i < N; i++) { const f = trackFrameAt(track, (i / (N - 1)) * T); pos[3 * i] = f.eye[0]; pos[3 * i + 1] = f.eye[1]; pos[3 * i + 2] = f.eye[2]; }
    Object.assign(doors, planDoors(meta.world, pos, N, T / (N - 1)));
  }
  const preset: any = {
    type: 'story', planner: 'v2', name: meta.name || 'Family tour', dressing: meta.dressing || { walls: 'up', roof: 'auto' }, duration: T, closed: false,
    eyePoints, targetPoints, track: { samples: roof.samples, roofAlpha: roof.roofAlpha, doors }, beats: [], events: { enterT: track.events.enter, stairT: [], pressT: track.events.press, settleT: null, doneT: T, firstCoreT: null },
    power: powerOf(track), enterT: Infinity, orbit: null,
  };
  preset.frameAt = (t: number, aspect = 16 / 9) => { const f = trackFrameAt(track, t * T, aspect); return { s: f.s, u: f.s, eye: V(f.eye), target: V(f.target), fov: f.fov, roofAlpha: f.roofAlpha, beat: f.beat }; };
  return preset;
}
