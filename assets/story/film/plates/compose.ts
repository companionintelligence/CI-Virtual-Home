// Composing a plate for the video-kit's text: the one piece of arithmetic the page (index.ts) and the script (scripts/film/plates/lib.mts) must agree on, so it is pure (no THREE, no DOM).
//
// WHY. The tour's camera was composed against the tour's own cards and margins. The kit lays its caption, its burned subtitles and its label over a plate from its own numbers
// (packages/video-kit/PLATES.md: the lower third `captionBottom` up, and the subtitles above it), and refuses a film whose text covers more than 2 percent of the rectangle the plate says it is about.
// A beat whose subject reaches the bottom of the frame (a person at a phone, the desk the Core stands on) is under that text in the film's own camera. The bake is not told about the kit's band, and the
// film's pin and the cameras of every film on record are not to be moved, so the PLATE's camera is: it is tilted down by a few degrees, which carries the subject up the frame and clears the band.
// A tilt, not a re-bake: the film is unchanged, the plate is the same picture a little higher. Nothing about the tour moves.
import type { PlateKey } from './format.js';

export type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The target of a camera at `eye` looking at `target`, with the view turned DOWN by `rad` about the camera's own right axis (roll 0, the way the page's cameras look). 0 leaves it as it is. */
export function tiltTarget(eye: V3, target: V3, rad: number): V3 {
  if (!rad) return target;
  const d = sub(target, eye), L = len(d); if (L < 1e-9) return target;
  const fwd: V3 = [d[0] / L, d[1] / L, d[2] / L];
  let right = cross(fwd, [0, 1, 0]); const rl = len(right); if (rl < 1e-6) return target;      // looking straight up or down: no tilt to give
  right = [right[0] / rl, right[1] / rl, right[2] / rl];
  const up = cross(right, fwd), c = Math.cos(rad), s = Math.sin(rad);
  return [eye[0] + (fwd[0] * c - up[0] * s) * L, eye[1] + (fwd[1] * c - up[1] * s) * L, eye[2] + (fwd[2] * c - up[2] * s) * L];
}

/** The tilt that carries what is at the middle of the frame up by `shift` frame heights, for a camera whose vertical field of view is `fovDeg`: tan(tilt) = 2 * shift * tan(fov / 2). */
export const tiltFor = (shift: number, fovDeg: number): number => Math.atan(2 * shift * Math.tan(fovDeg * Math.PI / 360));

/**
 * Where the kit's text begins, from the top, as a fraction of the frame's height: its caption block (the chapter badge and `captionLines` lines) and its burned subtitles (`cueLines` lines) above it.
 * Measured from video-kit 0.35.0 (`captionRect` and `subtitleRect` of src/subject.ts, FORMAT_SPECS of src/brand.ts); scripts/test-film-plates.mts holds this table to the kit's own when a kit is at hand.
 * The keys are `<caption lines><cue lines>`.
 */
export const KIT_BAND: Record<PlateKey, Record<string, number>> = {
  '16x9': { '11': 0.767, '12': 0.706, '21': 0.716, '22': 0.656 },
  '9x16': { '11': 0.798, '12': 0.766, '21': 0.768, '22': 0.735 },
  '1x1': { '11': 0.778, '12': 0.725, '21': 0.731, '22': 0.679 },
};
/** Where the caption block alone begins (a beat with no cues has no subtitle box over it), by the lines of its caption, with the chapter badge counted. */
export const KIT_CAPTION: Record<PlateKey, Record<string, number>> = { '16x9': { '1': 0.854, '2': 0.803 }, '9x16': { '1': 0.845, '2': 0.785 }, '1x1': { '1': 0.858, '2': 0.812 } };
/** How many characters a caption line holds and a subtitle line burns, in each format (the kit's `CAPTION_CHAR_EM` and `burnWidthFor`). */
export const KIT_CHARS: Record<PlateKey, { caption: number; cue: number }> = { '16x9': { caption: 75, cue: 42 }, '9x16': { caption: 39, cue: 33 }, '1x1': { caption: 44, cue: 36 } };
/** The kit's label (the pill in the top right corner): the share of the frame's width from the left where it begins, and how far down it reaches. */
export const KIT_LABEL: Record<PlateKey, { x0: number; y1: number }> = { '16x9': { x0: 0.712, y1: 0.081 }, '9x16': { x0: 0.503, y1: 0.060 }, '1x1': { x0: 0.502, y1: 0.081 } };

/** The y (fraction of the height) where the kit's text begins for a beat with this caption and these cues: the worst case of the two lines estimates. */
export function bandTop(key: PlateKey, title: string, cues: string[]): number {
  const k = KIT_CHARS[key], capLines = Math.min(2, Math.max(1, Math.ceil(title.length / k.caption)));
  if (!cues.length) return KIT_CAPTION[key][String(capLines)];
  const cueLines = Math.min(2, Math.max(1, ...cues.map(t => Math.ceil(t.length / k.cue))));
  return KIT_BAND[key][`${capLines}${cueLines}`];
}

export type Cleared = { tilt: number; shift: number; cleared: boolean };
/** The most a plate's camera is turned down, in degrees: past it the picture looks tipped rather than composed. */
export const MAX_TILT_DEG = 14;
/**
 * How far the subject has to go up to clear the band, and the tilt that does it. `top` and `bottom` are the subject's (unclamped) extent in the frame, as fractions of the height from the top;
 * `band` is where the kit's text begins; `limit` is the highest the subject's top may go (below the label if it is under it). Never more than `maxShift` frame heights nor MAX_TILT_DEG of tilt:
 * a subject taller than the room is carried as far as the room allows and `cleared` says it did not make it.
 */
export function clearBand(o: { top: number; bottom: number; band: number; fovDeg: number; limit?: number; maxShift?: number; margin?: number }): Cleared {
  const limit = o.limit ?? 0.03, margin = o.margin ?? 0.012, tanV = Math.tan(o.fovDeg * Math.PI / 360);
  const cap = Math.min(o.maxShift ?? 0.24, Math.tan(MAX_TILT_DEG * Math.PI / 180) / (2 * tanV));
  const need = o.bottom - (o.band - margin);
  if (need <= 0) return { tilt: 0, shift: 0, cleared: true };
  const room = Math.max(0, o.top - limit), shift = Math.min(need, room, cap);
  return { tilt: shift > 0.002 ? tiltFor(shift, o.fovDeg) : 0, shift: shift > 0.002 ? +shift.toFixed(4) : 0, cleared: shift >= need - 1e-9 };
}
