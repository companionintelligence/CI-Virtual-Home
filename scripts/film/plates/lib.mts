// The plates' plain helpers: what is rendered (the segments of a film's clock), what makes a rendered segment current (its key), what the manifest says (plates.json v1), and the words in it.
// Pure Node: no browser and no ffmpeg (those are render.mts), so scripts/test-film-plates.mts imports it without a GPU. Owner: video-tool.
//
// WHAT A PLATE IS. The family film's 3D picture with nothing drawn over it, cut into one clip per beat (assets/story/film/plates/index.ts renders the frames, the film's own camera and clock),
// in each aspect the CI-Common video-kit composes (landscape, portrait, optionally square). The kit draws every word (cards, captions, the corner label, the end card, the disclosures); this file
// only resolves WHAT those words are, from the family's file and claims.json, and writes them into plates.json. The contract is packages/video-kit/PLATES.md (CI-Common #429), mirrored in
// scripts/film/plates/virtual-home-plates.schema.json; the renderer owes the kit overlay-free plates, hashed bytes, honest subjects and the manifest written last.
//
// WHAT THIS FILE MUST NOT DO. The film's pin (scripts/film/lib.mts toolSha, films.json inputsSha) hashes the film's code. Nothing here is imported by the film, and it lives in a
// folder the pin does not read, so the plates can come and go without making a film stale. scripts/test-film-plates.mts holds that.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { RuntimeStory, RuntimeBeat } from '../../../assets/story/runtime.js';
import type { Story } from '../../../assets/story/types.js';
import { FILM, filmClock, sceneAt, audioPlacements, captionCues, powerForFilm, type FilmClock, type FilmPartT, type Cue } from '../../../assets/story/film/layout.js';
import { trackFrameAt } from '../../../assets/story/track.js';
import { camera, project, projectBoxClipped } from '../../../assets/shot-probe.js';
import { tiltTarget, bandTop, clearBand, KIT_LABEL, MAX_TILT_DEG, type V3 } from '../../../assets/story/film/plates/compose.js';
import { plateSize, KIT_NAME, type PlateKey, type PlateSize } from '../../../assets/story/film/plates/format.js';
import { displayName } from '../../../assets/home-names.js';
import { ROOT, familiesDir, loadClaims, filmDisclosureIds, filmText, sha256, hash10, readJson, FILM_LIGHTING, type Claims, type Family } from '../lib.mts';
import { readMedia, appCaption, type MediaManifest } from '../../story/lib/media.mts';
import { buildPairIndex, pairLine, type PairIndex } from '../../story/lib/pairs.mts';
import { readPlan, readInputs, bansOf, placeTypes, type PlaceType } from '../../story/lib/lander.mts';
import { EXTRA_BANS } from '../../story/lib/extra-bans.mts';

export { ROOT, sha256, hash10, readJson, PLATE_KEYS_DEFAULT };
const PLATE_KEYS_DEFAULT: PlateKey[] = ['16x9', '9x16'];

// ---- where things are ---------------------------------------------------------------------------------------------------------------------------
/** the plates and their manifests: outside git (the repository ignores /video/*) and outside dist. $CI_PLATES_OUT moves it. */
export const platesRoot = (): string => process.env.CI_PLATES_OUT ? path.resolve(process.env.CI_PLATES_OUT) : path.join(ROOT, 'video', 'plates');
export const platesDir = (id: string): string => path.join(platesRoot(), id);
/** the kit's projects and what it renders (scripts/film/wrap.mts) */
export const kitProjectsRoot = (): string => process.env.CI_KIT_OUT ? path.resolve(process.env.CI_KIT_OUT) : path.join(ROOT, 'video', 'kit');

/** `canon`: JSON with sorted keys, so the same value is the same text on every machine */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${canon((v as any)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
// (`+ 0` turns a -0 into 0: JSON has no negative zero, and a manifest read back must equal the one written)
const r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
const r3 = (v: number) => Math.round(v * 1e3) / 1e3 + 0;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---- the encode ---------------------------------------------------------------------------------------------------------------------------------
/** Everything about how a plate is made that is not the picture: a change here is a change to every plate (it is in every segment's key). */
export const ENCODE = { codec: 'libx264', crf: 15, preset: 'medium', profile: 'high', gop: 30, pix: 'yuv420p', jpeg: 0.95, threads: 1 } as const;

/** ffmpeg: a stream of JPEG frames on stdin to ONE plate, H.264 yuv420p BT.709, bit-exact and single-threaded (the same frames make the same bytes: scripts/film/mux.mts says why). No audio, no metadata. */
export function plateEncodeArgs(fps: number, out: string): string[] {
  return ['-y', '-loglevel', 'error', '-nostdin', '-fflags', '+bitexact', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', '-an',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:v', ENCODE.codec, '-threads', String(ENCODE.threads), '-pix_fmt', ENCODE.pix, '-profile:v', ENCODE.profile, '-preset', ENCODE.preset, '-crf', String(ENCODE.crf), '-g', String(ENCODE.gop),
    '-flags:v', '+bitexact', '-map_metadata', '-1', '-movflags', '+faststart', '-f', 'mp4', out];
}

// ---- what a plate is a function of --------------------------------------------------------------------------------------------------------------
const walk = (dir: string, keep: (rel: string) => boolean, rel = ''): string[] => (fs.existsSync(path.join(dir, rel)) ? fs.readdirSync(path.join(dir, rel)).sort() : []).flatMap(n => {
  const r = rel ? `${rel}/${n}` : n, abs = path.join(dir, r);
  return fs.statSync(abs).isDirectory() ? walk(dir, keep, r) : keep(r) ? [r] : [];
});
/**
 * A hash of the code that draws a HOUSE: assets/**\/*.ts (the builders, the kit, the materials, the shot machinery, the lighting) and the vendored three.js, plus room-creator.html. Not the story
 * player (assets/story/), the editor's chrome (assets/ui/), the scene checks, the plan export nor the viewer: none of them reaches a frame, and the mobile and tour work edits them all the time.
 * (The film's own modules that DO reach a plate are in `toolSha`.) A plate made under another engine is stale.
 */
export function engineSha(root: string = ROOT): string {
  const a = path.join(root, 'assets'), h = crypto.createHash('sha256');
  const skip = /^(story|ui|scene-qa|plan-export)\//;
  const files = walk(a, r => (r.endsWith('.ts') && !skip.test(r) && r !== 'viewer.ts') || (r.startsWith('vendor/') && r.endsWith('.js')));
  for (const f of files) h.update(f).update(fs.readFileSync(path.join(a, f)));
  h.update('room-creator.html').update(fs.readFileSync(path.join(root, 'room-creator.html')));
  return h.digest('hex');
}
/** A hash of the film modules a plate frame passes through (the clock, the camera preset and its doors, the plates' own page module and sizes) and the encode. */
export function toolSha(root: string = ROOT): string {
  const h = crypto.createHash('sha256'), f = path.join(root, 'assets', 'story', 'film');
  const files = [path.join(f, 'index.ts'), path.join(f, 'layout.ts'), ...walk(path.join(f, 'plates'), r => r.endsWith('.ts')).map(r => path.join(f, 'plates', r))];
  for (const x of files) h.update(path.relative(root, x)).update(fs.readFileSync(x));
  return h.update(canon(ENCODE)).digest('hex');
}
export const houseSha = (house: string, root: string = ROOT): string => sha256(fs.readFileSync(path.join(root, 'content', 'houses', `${house}.json`)));

// ---- the segments -------------------------------------------------------------------------------------------------------------------------------
/** One plate's span of the film's frames: [f0, f1). Frame i of the film is at i / fps, exactly; a part owns the frames from its `at` up to its `end`. */
export type Segment = { id: string; kind: 'approach' | 'beat'; part: FilmPartT | null; f0: number; f1: number; frames: number; durationS: number };
const frameOf = (s: number, fps: number) => Math.max(0, Math.ceil(s * fps - 1e-6));

/** The film's own beats, each as its span of frames, preceded by the approach to the front door (the title card's picture, 4 s). The dips between scenes and the end card's pull-back are the kit's to make. */
export function segmentsOf(clock: FilmClock): Segment[] {
  const fps = clock.fps, out: Segment[] = [];
  const mk = (id: string, kind: Segment['kind'], part: FilmPartT | null, s0: number, s1: number) => {
    const f0 = frameOf(s0, fps), f1 = frameOf(s1, fps);
    out.push({ id, kind, part, f0, f1, frames: f1 - f0, durationS: r3((f1 - f0) / fps) });
  };
  mk('approach', 'approach', null, 0, clock.title.t1);
  for (const p of clock.parts) mk(plateId(p.id), 'beat', p, p.at, p.end);
  return out;
}
/** The kit's own scene ids may not be a beat's (title, hook, apps, apps-N, proof-N, close, plainly, label): a story beat that would clash gets a suffix. */
export const RESERVED_ID = /^(title|hook|apps(-\d+)?|proof(-\d+)?|close|plainly|label)$/;
export const plateId = (id: string): string => (RESERVED_ID.test(id) ? `${id}-beat` : id);

/** The camera of every frame of a segment, as one hash (eye, target, field of view and roof, to 0.1 mm): what the segment draws, whatever the clock says it is. */
export function cameraFingerprint(rs: RuntimeStory, clock: FilmClock, seg: Segment, aspect: number, tilt = 0): string {
  const h = crypto.createHash('sha256');
  for (let i = seg.f0; i < seg.f1; i++) {
    const f = trackFrameAt(rs.track, sceneAt(clock, i / clock.fps).tour, aspect), tg = tiltTarget(f.eye as V3, f.target as V3, tilt);
    h.update(`${r4(f.eye[0])},${r4(f.eye[1])},${r4(f.eye[2])}|${r4(tg[0])},${r4(tg[1])},${r4(tg[2])}|${r4(f.fov)}|${r4(f.roofAlpha)};`);
  }
  return h.digest('hex');
}
/** When the Core powers on, relative to the segment's first frame (the page's `preset.power`), clamped to the segment: a Core that was on long before it, or comes on after it, reads the same. */
export function powerRel(rs: RuntimeStory, clock: FilmClock, seg: Segment): { at: number; ramp: number } | null {
  const pw = powerForFilm(clock, rs.track.events.press, rs.track.events.ramp);
  if (pw.at < 0) return null;
  const t0 = seg.f0 / clock.fps, len = seg.durationS, ramp = (pw.ramp ?? 0) * clock.span;
  return { at: r3(Math.max(-ramp - 1, Math.min(len + 1, pw.at * clock.span - t0))), ramp: r3(ramp) };
}

export type KeyInputs = { house: string; engine: string; tool: string; gl: string; chromium: string; aspect: PlateKey; w: number; h: number; fps: number; lighting: string; frames: number; camera: string; power: ReturnType<typeof powerRel>; shot?: string };
/** What makes a rendered segment current. A different house, engine, film module, encode, GPU path, size, light, length or camera is a different key; a new caption, chip, title or disclosure is not (those are the manifest's, not the picture's). */
export const segmentKey = (k: KeyInputs): string => sha256(canon({ v: 1, ...k, encode: ENCODE }));

/** The door channels (door id -> the leaf's angle at each sample of the film) sliced to a segment's frames (and one more each side, for the interpolation), as a hash. A door opens once, at the first crossing of the whole path, so a segment's doors are not a function of the segment alone. */
export function doorsSha(doors: Record<string, number[]> | null | undefined, seg: Segment): string {
  const h = crypto.createHash('sha256');
  for (const id of Object.keys(doors || {}).sort()) h.update(id).update(':').update((doors![id].slice(Math.max(0, seg.f0 - 1), seg.f1 + 1)).join(',')).update(';');
  return h.digest('hex');
}

// ---- the subject --------------------------------------------------------------------------------------------------------------------------------
export type Rect = { x: number; y: number; w: number; h: number };
const clampRect = (r: Rect): Rect | null => {
  const x = clamp01(r.x), y = clamp01(r.y), x1 = clamp01(r.x + r.w), y1 = clamp01(r.y + r.h);
  return x1 - x > 0.01 && y1 - y > 0.01 ? { x: r4(x), y: r4(y), w: r4(x1 - x), h: r4(y1 - y) } : null;
};
/** Where a frame is "about", when nothing says: the middle of the picture, above the caption. Declared, and recorded as declared. */
export const DEFAULT_SUBJECT: Record<PlateKey, Rect> = { '16x9': { x: 0.2, y: 0.12, w: 0.6, h: 0.6 }, '9x16': { x: 0.1, y: 0.2, w: 0.8, h: 0.42 }, '1x1': { x: 0.15, y: 0.12, w: 0.7, h: 0.6 } };

/** a plate whose anchor cannot be carried clear of the kit's text is about the point the tour looks at: the rectangle reaches this far each way from it, in NDC (0.3 = 15 percent of the frame each way, 30 percent across) */
export const FOCUS_HALF = 0.3;
export type Composed = { subject: Rect; declared: boolean; tilt: number; shift: number; cleared: boolean; band: number; camera: Record<string, unknown> };
/**
 * The rectangle a beat's plate is about: the beat's anchor (its box in the house) projected through the camera at rest, as fractions of the frame. It is the rectangle the film's own card solver keeps its card off
 * (assets/story/film/layout.ts placeForFilm). The kit holds its own text (the caption, the subtitles, the label) to 2 percent of it, so the plate is COMPOSED for that text (assets/story/film/plates/compose.ts):
 * where the anchor reaches into the kit's band at the bottom of the frame, the plate's camera is tilted down just far enough to carry it up and clear, and the rectangle declared is the one after the tilt.
 * `declared` says it fell back to the default (no anchor in view); `cleared` says whether the subject made it clear of the band (a subject taller than the room is carried as far as it goes).
 */
export function composeBeat(rs: RuntimeStory, b: RuntimeBeat, size: PlateSize, o: { title: string; cues: string[]; tilt?: boolean }): Composed {
  const fr = trackFrameAt(rs.track, b.rest, size.aspect), box = b.frame.box as any, focusAt = b.frame.focus as V3;
  const meta = { preset: 'story-track', fovDeg: r3(fr.fov), restTourS: r3(b.rest), role: b.frame.role };
  const band = bandTop(size.key, o.title, o.cues), lab = KIT_LABEL[size.key], maxTilt = MAX_TILT_DEG * Math.PI / 180;
  // What the plate is about: the beat's anchor; or, when the anchor cannot be carried clear of the kit's text (it fills the frame: it is the room the camera stands in), the point the tour looks at (the beat's
  // focus), a square of a third of the frame about it. `subjectKind` in the camera record says which.
  const extent = (kind: 'anchor' | 'focus', target: V3) => {
    const cam = camera(fr.eye as V3, target, fr.fov, size.aspect);
    if (kind === 'anchor') { const pb = projectBoxClipped(cam, box); return pb && { top: (1 - pb.maxY) / 2, bottom: (1 - pb.minY) / 2, left: (pb.minX + 1) / 2, right: (pb.maxX + 1) / 2 }; }
    const p = project(cam, focusAt); if (!(p[2] > 0)) return null;
    return { top: (1 - (p[1] + FOCUS_HALF)) / 2, bottom: (1 - (p[1] - FOCUS_HALF)) / 2, left: (p[0] - FOCUS_HALF + 1) / 2, right: (p[0] + FOCUS_HALF + 1) / 2 };
  };
  const solve = (kind: 'anchor' | 'focus'): Composed | null => {
    const p0 = extent(kind, fr.target as V3); if (!p0) return null;
    const underLabel = p0.right > lab.x0 && p0.left < 1, limit = underLabel ? lab.y1 + 0.012 : 0.03;
    // the tilt is found by trying it: a shift of the picture is not quite a shift of the subject (the lens is a perspective one), so each pass measures what is left and carries the subject the rest of the way
    let tilt = 0, p1 = p0;
    if (o.tilt !== false) for (let pass = 0; pass < 4; pass++) {
      const c = clearBand({ top: Math.max(0, p1.top), bottom: Math.min(1, p1.bottom), band, fovDeg: fr.fov, limit }), next = Math.min(tilt + c.tilt, maxTilt);
      if (!c.tilt || next <= tilt + 1e-9) break;
      tilt = next; p1 = extent(kind, tiltTarget(fr.eye as V3, fr.target as V3, tilt)) || p1;
      if (tilt >= maxTilt - 1e-9) break;
    }
    const shift = r4(p0.bottom - p1.bottom), rect = clampRect({ x: p1.left, y: p1.top, w: p1.right - p1.left, h: p1.bottom - p1.top }), at = rect || DEFAULT_SUBJECT[size.key];
    return { subject: at, declared: !rect, tilt, shift, cleared: at.y + at.h <= band + 1e-6, band, camera: { ...meta, subjectKind: kind, tiltDeg: r3(tilt * 180 / Math.PI), shiftFrac: shift, kitBandTop: band } };
  };
  const anchor = solve('anchor');
  if (anchor && anchor.cleared) return anchor;
  const focus = b.frame.focus ? solve('focus') : null;
  if (focus && (focus.cleared || !anchor)) return focus;
  return anchor ?? { subject: DEFAULT_SUBJECT[size.key], declared: true, tilt: 0, shift: 0, cleared: true, band, camera: meta };
}

// ---- the captions -------------------------------------------------------------------------------------------------------------------------------
export type PlateCue = { fromS: number; toS: number; text: string };
/** The most characters of a line the film's cues and the kit's subtitles hold in 16:9 (the kit's burn width there): a plate's cues are cut to ONE line of this, so the subtitle box is one line tall and the kit's text takes the least of the frame. */
export const CUE_LINE = 42;
/** Words a line should not end on ("no / longer", "the / desk"): the break goes after the end of a phrase when one is near. */
const WEAK_END = new Set(['a', 'an', 'the', 'no', 'not', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'and', 'or', 'but', 'with', 'from', 'is', 'are', 'its', 'his', 'her', 'their', 'our', 'your', 'as', 'that', 'so', 'than', 'it', 'into', 'onto']);
type Tok = { text: string; s: number; e: number };
/**
 * A cue's words in lines of at most `room` characters, one line each: sentences first, a sentence longer than a line split where both halves fit and the pause is nearest (a comma first, never right after
 * a word like "no" or "the"), short neighbours joined when they fit. (The film's own `chunkTokens` breaks at the middle word; this is that, with a phrase-aware break.)
 */
export function oneLines(toks: Tok[], room: number): Tok[][] {
  const len = (a: Tok[]) => a.reduce((n, t) => n + t.text.length, 0) + Math.max(0, a.length - 1);
  const sentences: Tok[][] = []; let cur: Tok[] = [];
  for (const t of toks) { cur.push(t); if (/[.!?]["')\]]?$/.test(t.text)) { sentences.push(cur); cur = []; } }
  if (cur.length) sentences.push(cur);
  const pieces: Tok[][] = [];
  const split = (a: Tok[]): void => {
    if (len(a) <= room || a.length < 2) { pieces.push(a); return; }
    let best = 1, bestScore = Infinity;
    for (let i = 1; i < a.length; i++) {
      const l = len(a.slice(0, i)), r = len(a.slice(i)), last = a[i - 1].text.toLowerCase().replace(/[^a-z']/g, '');
      const score = Math.abs(l - r) + (/[,;:]["')\]]?$/.test(a[i - 1].text) ? 0 : 12) + (WEAK_END.has(last) ? 16 : 0) + (l > room ? 40 : 0);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    split(a.slice(0, best)); split(a.slice(best));
  };
  sentences.forEach(split);
  const out: Tok[][] = [];
  for (const p of pieces) { const prev = out[out.length - 1]; if (prev && len(prev) + 1 + len(p) <= room && len(prev) < room * 0.7) out[out.length - 1] = prev.concat(p); else out.push(p); }
  return out;
}
/**
 * The film's own caption cues that fall in a segment, on the plate's clock (seconds from its first frame), each cut to one line of at most CUE_LINE characters (the film's cue is two lines; the words
 * keep their own times, so a cue splits where the speaker would pause: at a sentence end, then a comma, then the middle). A cue is up 0.08 s before its first word and at most 0.6 s past its last, so one
 * can straddle a segment's edge: it is cut at the edge (one that would be up for under a fifth of a second is dropped). An agent's line is marked scripted on its first cue and carries the speaker on the
 * rest (claims.json: an agent line on screen is scripted, not captured), and the cues never overlap.
 */
export function cuesOf(cues: Cue[], seg: Segment, fps: number): PlateCue[] {
  const t0 = seg.f0 / fps, t1 = seg.f1 / fps, out: Array<PlateCue & { clip: string }> = [], emitted = new Set<string>();
  for (const c of cues) {
    // the cue's words, split into lines of one: each takes the span of its own words (the first from the cue's start, the last to its end, no gap between). An agent's lines keep room for their prefix.
    const room = Math.max(16, CUE_LINE - (c.speaker ? c.speaker.length + ' (scripted): '.length : 0));
    const pieces = oneLines(c.words.length ? c.words : [{ text: c.text, s: c.start, e: c.end }], room);
    pieces.forEach((words, k) => {
      const start = k === 0 ? c.start : words[0].s, end = k === pieces.length - 1 ? c.end : pieces[k + 1][0].s;
      const from = Math.max(start, t0), to = Math.min(end, t1);
      if (to - from < 0.2) return;
      const prefix = c.speaker ? `${c.speaker}${emitted.has(c.clip) ? '' : ' (scripted)'}: ` : '';
      if (c.speaker) emitted.add(c.clip);
      out.push({ fromS: r3(from - t0), toS: r3(Math.min(to - t0, seg.durationS)), text: `${prefix}${words.map(w => w.text).join(' ')}`, clip: c.clip });
    });
  }
  const cleaned: PlateCue[] = out.map(({ clip: _clip, ...x }) => x);
  for (let i = 1; i < cleaned.length; i++) if (cleaned[i].fromS < cleaned[i - 1].toS) cleaned[i].fromS = cleaned[i - 1].toS;
  return cleaned.filter(c => c.toS - c.fromS >= 0.2);
}

// ---- the words the film prints ------------------------------------------------------------------------------------------------------------------
export type PlatesText = { label: string; cta: string; tagline?: string; link: string; disclosures: Array<{ id: string; text: string }>; hook?: { text: string; accent: string } };
/** The sanctioned end card of a family film, resolved from claims.json through the film's own `filmText` (the same strings the film prints), a silent film's lines (no synthetic-voice line), and the owner-approved claim the short cuts open on. */
export function familyText(rs: RuntimeStory, claims: Claims = loadClaims()): PlatesText {
  const ft = filmText(rs, claims, { silent: true });
  const ids = filmDisclosureIds(rs, true);
  const disclosures = ids.map(id => ({ id, text: claims.disclosures.find(d => d.id === id)!.text }));
  return { label: ft.badge, cta: ft.end.signoff, tagline: rs.closing.cta.label, link: ft.end.url, disclosures, ...hookOf(claims) };
}
/** The claim the cuts open on: `rent-line` of claims.json, only while the claim is cleared (a held claim is not used), with "renting" in the accent. */
export function hookOf(claims: any): { hook?: { text: string; accent: string } } {
  const c = (claims.allowedClaims || []).find((x: any) => x.id === 'rent-line');
  return c && c.status !== 'hold' && /\brenting\b/.test(c.text) ? { hook: { text: c.text, accent: 'renting' } } : {};
}

// ---- the apps -----------------------------------------------------------------------------------------------------------------------------------
export type Ctx = {
  claims: Claims & { allowedClaims?: any[]; bannedPhrases?: any[] };
  catalog: Map<string, { id: string; name: string; inLiveStore?: boolean; storySafe?: string }>;
  media: MediaManifest | null;
  index: PairIndex | null;
  root: string;
};
/** The inputs that come from files, read once. */
export function loadCtx(root: string = ROOT, stories: Story[] = []): Ctx {
  const inputs = readInputs(root), plan = readPlan(root);
  const catalog = new Map<string, any>(inputs.apps.map(a => [a.id, a]));
  const index = stories.length ? buildPairIndex({ stories: stories as any, services: inputs.services, apps: inputs.apps, plan, bans: bansOf(inputs.claims) }) : null;
  return { claims: inputs.claims as any, catalog, media: readMedia(root), index, root };
}

export type Chip = { app: string; logo?: string; pairText?: string };
export type ChipFiles = { logos: Map<string, string> };      // app id -> the file to copy (relative to the repository), for the manifest builder
/**
 * The apps of one film beat: its `app` then its `with` apps. Each wears the real logo the app-media manifest holds for it (a logo is only ever shown beside the app's name), and the pair text
 * "<app>, alternative to <service>" when the pair index lets a page show it for this family (a pair that is held, or that the copy rules stop, is never written). The same app is described the same way
 * in every beat: its pair is its FIRST shown pair in the family. An app that is not in the live store is left out, with a note.
 */
export function chipsOf(story: Story, b: { app?: { id: string } | undefined; with?: string[] }, ctx: Ctx, notes: string[] = []): Array<Chip & { id: string }> {
  const ids = [b.app?.id, ...(b.with || [])].filter((x): x is string => !!x);
  const pairByApp = new Map<string, string>();
  for (const p of ctx.index?.byFamily.get(story.slug) || []) if (!pairByApp.has(p.app.id)) pairByApp.set(p.app.id, pairLine(p));
  const out: Array<Chip & { id: string }> = [];
  for (const id of ids) {
    const a = ctx.catalog.get(id);
    if (!a) { notes.push(`${story.slug}: the app ${id} is not in the Companion Hub catalog, so its chip is left out`); continue; }
    if (a.inLiveStore === false) { notes.push(`${story.slug}: the app ${id} is not in the live store, so its chip is left out`); continue; }
    if (out.some(c => c.id === id)) continue;
    const pair = pairByApp.get(id);
    out.push({ id, app: a.name, ...(pair ? { pairText: pair } : {}) });
  }
  return out;
}
/** The real logo file of an app (relative to the repository root), or null: an app with no entry is shown by its name alone, never with a stand-in. */
export const logoFileOf = (media: MediaManifest | null, id: string): string | null => media?.apps[id]?.logo?.file || null;

// ---- the manifest -------------------------------------------------------------------------------------------------------------------------------
export type PlateEntry = { file: string; sha256: string; durationS: number; width: number; height: number; subject: Rect; camera: Record<string, unknown> };
export type BeatEntry = { id: string; member: { id: string; name: string; companion?: string } | null; title: string; body?: string; chips: Chip[]; cues?: PlateCue[]; plates: Partial<Record<'landscape' | 'portrait' | 'square', PlateEntry>> };
export type InsertEntry = { id: string; app: string; file: string; sha256: string; width: number; height: number; alt: string; label: string };

/** The editorial picks for the 30 s and 15 s cuts: beats that show an app, one per person, in film order (the kit's own default picks the first moment of each person). Empty: the kit chooses. */
export function cutPicks(beats: BeatEntry[]): { '15'?: string[]; '30'?: string[] } {
  const seen = new Set<string>(), picks: string[] = [];
  for (const b of beats) if (b.member && b.chips.length && !seen.has(b.member.id) && b.plates.portrait) { seen.add(b.member.id); picks.push(b.id); }
  return picks.length ? { '15': picks.slice(0, 1), '30': picks.slice(0, 2) } : {};
}

export type Profile = { chromium: string; renderer: string; ffmpeg: string; gl: string; machine?: string };
export function buildFamilyManifest(o: { fam: Family; beats: BeatEntry[]; inserts: InsertEntry[]; text: PlatesText; profile: Profile; platesSha: string; inputsSha: string; claimsSha: string }): any {
  const { fam } = o, f = fam.rs.family;
  const picks = cutPicks(o.beats);
  return {
    $schema: 'https://raw.githubusercontent.com/companionintelligence/CI-Common/main/packages/video-kit/schema/virtual-home-plates.schema.json',
    v: 1, kind: 'family-film', id: fam.slug,
    displayName: `The ${f.surname} family of ${f.address.place}`,
    family: { slug: fam.slug, name: `The ${f.surname} family`, place: f.address.place, tagline: f.tagline },
    lighting: FILM_LIGHTING, fps: FILM.fps, profile: o.profile, text: o.text,
    beats: o.beats, ...(o.inserts.length ? { inserts: o.inserts } : {}), ...(Object.keys(picks).length ? { cuts: picks } : {}),
    audio: null, platesSha: o.platesSha, claimsSha: o.claimsSha, inputsSha: o.inputsSha,
  };
}

/** plates.json of a home with no family: its own shots, its display name and kind of place as the only words, the sanctioned end card, no hook, no cuts, no apps, no screenshots. */
export function buildHomeManifest(o: { info: HomeInfo; beats: BeatEntry[]; text: PlatesText; profile: Profile; lighting: string; platesSha: string; inputsSha: string; claimsSha: string }): any {
  return {
    $schema: 'https://raw.githubusercontent.com/companionintelligence/CI-Common/main/packages/video-kit/schema/virtual-home-plates.schema.json',
    v: 1, kind: 'home-tour', id: o.info.id, displayName: o.info.name, family: null, lighting: o.lighting, fps: FILM.fps, profile: o.profile, text: o.text,
    beats: o.beats, audio: null, platesSha: o.platesSha, claimsSha: o.claimsSha, inputsSha: o.inputsSha,
  };
}
/** The beats of a home tour: one per shot the home has, each titled with the kind of place (the only word besides the name), no one in it, nothing to say about it. */
export function homeBeats(info: HomeInfo, shots: string[], plateOf: (shot: string) => Partial<BeatEntry['plates']>): BeatEntry[] {
  return shots.map(shot => ({ id: shot, member: null, title: info.label, chips: [], plates: plateOf(shot) }));
}

/** The member of a beat as the manifest names them (null for the approach and for the set-up beats, which belong to no one). */
export function memberOf(rs: RuntimeStory, b: RuntimeBeat): BeatEntry['member'] {
  const m = b.member ? rs.members.find(x => x.id === b.member) : null;
  return m ? { id: m.id, name: m.name, ...(m.companion ? { companion: m.companion.name } : {}) } : null;
}

export const digestOf = (v: unknown): string => sha256(canon(v));

// ---- a copy lint over a list of strings (the wrap uses it on the storyboard and the WebVTT, the plates on their own manifest) --------------------------
/** claims.json's rules that stop a sentence (error and review severity), plus the extra ones (the word "beta" among them), as [id, regex]. */
export function copyRules(claims: { bannedPhrases?: Array<{ id: string; pattern: string; flags?: string; severity: string }> }): Array<{ id: string; re: RegExp; severity: string }> {
  const own = (claims.bannedPhrases || []).map(b => ({ id: b.id, severity: b.severity, re: new RegExp(b.pattern, b.flags ?? 'i') }));
  const have = new Set(own.map(r => r.id));
  return [...own, ...EXTRA_BANS.filter(e => !have.has(e.id)).map(e => ({ id: e.id, severity: e.severity as string, re: new RegExp(e.pattern, e.flags) }))];
}
/** The display names of the homes: the portal's own words for a place, which the two internal-id rules do not read (as in scripts/story/lib/site-copy.mts). */
export function homeDisplayNames(root: string = ROOT): string[] {
  try { return (readJson(path.join(root, 'content', 'houses', 'index.json')).houses as Array<{ id: string; name?: string }>).map(h => displayName(h)).sort((a, b) => b.length - a.length); } catch { return []; }
}
const NAME_RULES = new Set(['internal-ids', 'internal-ids-ordinary']);
/**
 * Every string that fails an error or review rule, a dash, an exclamation mark, or the word "beta"; `where` names it. Warnings are not problems. As on the built site, a home's display name is
 * not read by the internal-id rules, and the "ordinary words that are also house ids" rule reads alt text only (here: nothing, a film has no alt text of its own).
 */
export function copyProblems(strings: Array<[string, string]>, claims: Parameters<typeof copyRules>[0], names: string[] = homeDisplayNames()): string[] {
  const rules = copyRules(claims).filter(r => (r.severity === 'error' || r.severity === 'review') && r.id !== 'internal-ids-ordinary'), out: string[] = [];
  for (const [where, raw] of strings) {
    const t = String(raw).replace(/<[^>]*>/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"'), noNames = names.reduce((x, n) => x.split(n).join(' '), t);
    for (const r of rules) { const m = r.re.exec(NAME_RULES.has(r.id) ? noNames : t); if (m) out.push(`${where}: "${m[0]}" breaks the copy rule ${r.id}`); }
    if (/!/.test(t)) out.push(`${where}: an exclamation mark`);
    if (/\bbeta\b/i.test(t)) out.push(`${where}: the word "beta"`);
  }
  return out;
}
/** The strings of a manifest a viewer can read, with where each is from. */
export function readableOf(m: any): Array<[string, string]> {
  const out: Array<[string, string]> = [['displayName', m.displayName]];
  if (m.family) for (const k of ['name', 'place', 'tagline']) out.push([`family.${k}`, m.family[k]]);
  for (const k of ['label', 'cta', 'tagline', 'codaTitle']) if (m.text[k]) out.push([`text.${k}`, m.text[k]]);
  if (m.text.hook) out.push(['text.hook', m.text.hook.text]);
  m.text.disclosures.forEach((d: any, i: number) => out.push([`text.disclosures[${i}]`, d.text]));
  for (const b of m.beats) {
    out.push([`${b.id} title`, b.title]); if (b.body) out.push([`${b.id} body`, b.body]);
    if (b.member) out.push([`${b.id} member`, b.member.name]);
    (b.cues || []).forEach((c: any, i: number) => out.push([`${b.id} cue ${i}`, c.text]));
    (b.chips || []).forEach((c: any, i: number) => { out.push([`${b.id} chip ${i}`, c.app]); if (c.pairText) out.push([`${b.id} chip ${i} pair`, c.pairText]); });
  }
  (m.inserts || []).forEach((s: any, i: number) => { out.push([`insert ${i} label`, s.label]); out.push([`insert ${i} alt`, s.alt]); });
  return out;
}
/** What is wrong with a manifest that the renderer can tell on its own: the words (the copy rules, the credit words), pairs written as "alternative to", the label and the one link. */
export function manifestProblems(m: any, claims: Parameters<typeof copyRules>[0], credit?: RegExp): string[] {
  const out = copyProblems(readableOf(m), claims);
  if (m.lighting !== 'day') out.push(`lighting is ${m.lighting}; a film is lit as day`);
  if (!m.text.label) out.push('no label');
  if (m.text.link !== 'ci.computer/core') out.push(`the link is ${m.text.link}; the end card carries ci.computer/core only`);
  for (const b of m.beats) for (const c of b.chips || []) if (c.pairText && (/\breplac/i.test(c.pairText) || !c.pairText.startsWith(`${c.app}, alternative to `))) out.push(`${b.id}: the pair "${c.pairText}" is not "<app>, alternative to <service>"`);
  for (const s of m.inserts || []) if (!s.label) out.push(`insert ${s.id}: no label`);
  if (credit) for (const [where, t] of readableOf(m)) if (credit.test(t)) out.push(`${where}: names a source of the build`);
  return out;
}

// ---- homes with no family: the home tour -----------------------------------------------------------------------------------------------------------------
export const HOME_TOUR_SHOTS = ['door-to-core', 'orbit', 'hero-reveal'] as const;
export const PLACE_LABEL: Record<PlaceType, string> = { home: 'Home', apartment: 'Apartment', office: 'Office' };
/** A home's public id for its film: its display name as a slug ("Garden Flat" is garden-flat). Never the filed title, a builder's handle or a pack's id. */
export const homeFilmId = (house: { id: string; name?: string }): string => displayName(house).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export type HomeInfo = { house: string; id: string; name: string; type: PlaceType; label: string };
/** The facts of a home tour that are not pictures: the home's display name, its kind of place and the one word that names it. */
export function homeInfo(houseId: string, root: string = ROOT): HomeInfo {
  const idx = readJson(path.join(root, 'content', 'houses', 'index.json')).houses as Array<{ id: string; name?: string; type?: string }>;
  const h = idx.find(x => x.id === houseId);
  if (!h) throw new Error(`no home ${houseId} in content/houses/index.json`);
  const types = placeTypes(idx, readPlan(root)), type = types.of[houseId] ?? 'home';
  return { house: houseId, id: homeFilmId(h), name: displayName(h), type, label: PLACE_LABEL[type] };
}
/** The sanctioned end card of a home with no family. The only claim it can make is that the Core is drawn as an illustration (stylised-art): no family, no scripted scene, no app, no story. */
export function homeText(info: HomeInfo, claims: Claims = loadClaims()): PlatesText {
  const style = (claims as any).style || {};
  const d = claims.disclosures.find(x => x.id === 'stylised-art');
  if (!d) throw new Error('claims.json has no stylised-art disclosure');
  return { label: info.name, cta: style.signOff || 'UnCloud your life.', tagline: 'See Companion Core', link: 'ci.computer/core', disclosures: [{ id: d.id, text: d.text }] };
}
/** The homes that have no family: cast-plan.json's `homesWithoutFamily`. */
export function homesWithoutFamily(root: string = ROOT): string[] {
  const plan = readJson(path.join(root, 'content', 'story', 'cast-plan.json'));
  return Object.keys(plan.homesWithoutFamily || {}).sort();
}
export { familiesDir };
