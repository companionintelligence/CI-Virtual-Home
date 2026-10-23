// The film's PLATES, in the page: the same 3D picture the family film draws, with nothing drawn over it.
// scripts/film/plates/render.mts opens a house in the EDITOR page (not the player), imports this module and asks it for frame i:
//
//   const P = await import('/assets/story/film/plates/index.js');
//   const info = await P.prepare({ rs, key: '16x9', res: 1080, silent: true });   // registers the film's camera as a shot preset and begins an offline render
//   const jpg = P.frame(i)                                                         // base64 JPEG of frame i: the room, no card, no caption, no corner mark, no dip
//   P.end()
//
// It is the film's seam used a second way, not a second renderer: the camera is `presetFromFilm` (assets/story/film/index.ts, imported here and not changed), the clock is
// `filmClock`, so plate frame i IS film frame i without the overlay. The film's own modules are not edited by the plates (their code hash, scripts/film/lib.mts toolSha, is
// the pin of every film on record) and nothing in the film imports this file. Each frame is a pure function of the tree and of i, random access, so a plate for one beat can be
// drawn without the beats before it and a crashed run resumes at the next beat.
//
// Offline rendering, the goldens and the film are untouched: this only calls the page's own hooks (__houseDebug, __houseShotWorld, __houseRenderBegin,
// __houseRenderFrames, __houseRenderEnd). Owner: video-tool.
import type { RuntimeStory } from '../../runtime.js';
import { filmClock, silentStory, type FilmClock } from '../layout.js';
import { presetFromFilm } from '../index.js';
import { plateSize, ASPECT_LABEL, type PlateKey } from './format.js';
import { tiltTarget } from './compose.js';

/** a span of the film's frames [f0, f1) whose camera is turned down by `rad` (compose.ts: it carries the subject up the frame, clear of the kit's text) */
export type Tilt = { f0: number; f1: number; rad: number };
export type PrepareOpts = { rs: RuntimeStory; key: PlateKey; res?: number; silent?: boolean; tilts?: Tilt[] };
type State = { clock: FilmClock; w: number; h: number; frames: number; fps: number; cv: HTMLCanvasElement; g: CanvasRenderingContext2D; gl: HTMLCanvasElement; probe: CanvasRenderingContext2D; stats: { mean: number; std: number }; last: number };
let S: State | null = null;
const W: any = window;

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

export async function prepare(o: PrepareOpts) {
  if (S) end();
  const rs = o.silent ? silentStory(o.rs) : o.rs, res = o.res ?? 1080, size = plateSize(o.key, res), clock = filmClock(rs, { silent: !!o.silent });
  const dbg = W.__houseDebug(), THREE = W.__THREE;
  const preset = presetFromFilm(THREE, rs, clock, W.__houseShotWorld());
  // the plate's camera is the film's, turned down by the span's tilt (none: the film's own): a pure function of the frame, as the film's is
  const tilts = (o.tilts || []).filter(t => t.rad), frameAt = preset.frameAt;
  if (tilts.length) preset.frameAt = (u: number, aspect?: number) => {
    const f = frameAt(u, aspect), i = Math.round(Math.max(0, Math.min(1, u)) * (clock.frames - 1)), t = tilts.find(x => i >= x.f0 && i < x.f1);
    if (t) { const r = tiltTarget([f.eye.x, f.eye.y, f.eye.z], [f.target.x, f.target.y, f.target.z], t.rad); f.target.set(r[0], r[1], r[2]); }
    return f;
  };
  const key = `house:${dbg.house.id}:plate-${o.key}`;
  dbg.presets[key] = preset;
  const info = W.__houseRenderBegin({ shot: key, res: String(size.pageRes), aspect: ASPECT_LABEL[o.key], fps: clock.fps });
  if (info.w !== size.w || info.h !== size.h || info.frames !== clock.frames) throw new Error(`the page rendered ${info.w}x${info.h} x ${info.frames}, the plate wants ${size.w}x${size.h} x ${clock.frames}`);
  const cv = document.createElement('canvas'); cv.width = size.w; cv.height = size.h;
  const pc = document.createElement('canvas'); pc.width = 64; pc.height = Math.max(8, Math.round(64 * size.h / size.w));
  S = { clock, w: size.w, h: size.h, frames: clock.frames, fps: clock.fps, cv, g: cv.getContext('2d', { alpha: false })!, gl: dbg.renderer.domElement, probe: pc.getContext('2d', { willReadFrequently: true })!, stats: { mean: 0, std: 0 }, last: -1 };
  // The door channels the film's path planned (door id -> the leaf's angle at each sample), rounded: the script slices them to a segment's frames, so a plate is current only if the
  // doors it was drawn with are the ones the path plans now (a door opens once, at the first crossing of the WHOLE path).
  const doors: Record<string, number[]> = {};
  for (const [id, ch] of Object.entries((preset.track && preset.track.doors) || {})) doors[id] = Array.from(ch as ArrayLike<number>, r4);
  return { w: size.w, h: size.h, fps: clock.fps, frames: clock.frames, span: clock.span, doors };
}

/**
 * A HOME TOUR plate: one of the house's own shots (door-to-core, orbit, hero-reveal ...: the presets the page builds for every home, the ones `pnpm run shots` films), at 30 fps, in the
 * shape asked for, lit as the page was opened (?lighting=day). There is no story under it, so there is no film clock: frame i is the shot's `applySplineFrame(i / (frames - 1))`.
 */
export function prepareShot(o: { shot: string; key: PlateKey; res?: number; fps?: number }) {
  if (S) end();
  const res = o.res ?? 1080, size = plateSize(o.key, res), fps = o.fps ?? 30, dbg = W.__houseDebug();
  const info = W.__houseRenderBegin({ shot: o.shot, res: String(size.pageRes), aspect: ASPECT_LABEL[o.key], fps });
  if (info.w !== size.w || info.h !== size.h) throw new Error(`the page rendered ${info.w}x${info.h}, the plate wants ${size.w}x${size.h}`);
  const cv = document.createElement('canvas'); cv.width = size.w; cv.height = size.h;
  const pc = document.createElement('canvas'); pc.width = 64; pc.height = Math.max(8, Math.round(64 * size.h / size.w));
  S = { clock: null as any, w: size.w, h: size.h, frames: info.frames, fps: info.fps, cv, g: cv.getContext('2d', { alpha: false })!, gl: dbg.renderer.domElement, probe: pc.getContext('2d', { willReadFrequently: true })!, stats: { mean: 0, std: 0 }, last: -1 };
  return { w: size.w, h: size.h, fps: info.fps, frames: info.frames, duration: info.duration };
}

/** Frame i: render the scene and return it as a base64 JPEG, exactly the picture the film draws its overlay on (the same draw of the WebGL canvas onto a 2D canvas, the same JPEG). */
export function frame(i: number, quality = 0.95): string {
  const st = S; if (!st) throw new Error('prepare() first');
  W.__houseRenderFrames(i, 1, null);                         // draws the 3D frame (and the page's own composer) onto the WebGL canvas
  const { g, cv, gl, probe } = st;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  g.drawImage(gl, 0, 0, st.w, st.h);
  const pw = probe.canvas.width, ph = probe.canvas.height;
  probe.drawImage(cv, 0, 0, st.w, st.h, 0, 0, pw, ph);
  const d = probe.getImageData(0, 0, pw, ph).data; let sum = 0, sq = 0; const n = pw * ph;
  for (let k = 0; k < d.length; k += 4) { const y = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; sum += y; sq += y * y; }
  const mean = sum / n; st.stats = { mean: +mean.toFixed(2), std: +Math.sqrt(Math.max(0, sq / n - mean * mean)).toFixed(2) };
  st.last = i;
  return cv.toDataURL('image/jpeg', quality).slice(23);
}

/** The luma mean and standard deviation (0 to 255) of the last frame drawn: a blank render (the GPU path that draws nothing) has no spread. */
export function stats(): { mean: number; std: number } { return S ? S.stats : { mean: 0, std: 0 }; }

export function end() {
  if (!S) return;
  try { W.__houseRenderEnd(); } catch { /* the page may already have closed it */ }
  S = null;
}
