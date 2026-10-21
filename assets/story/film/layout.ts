// The film's clock and layout: everything about a family film that is arithmetic, with no canvas, no THREE and no DOM, so Node can test it
// and both sides of the film agree on it: the page that draws the pictures (index.ts) and the script that lays the sound under them
// (scripts/render-family-film.mts, scripts/film/mux.mts).
//
//   filmClock(rs)         the film as a timeline of seconds: a title card, the beats the story flags `film` (cut in as the tour plays them, so
//                         the camera is the live tour's), an end card; each joined by a short dip. Frame i is at i / fps, exactly.
//   audioPlacements       where each recorded clip sits in the film (the SAME m4a files the live tour plays, at the offsets the bake lock gives them)
//   captionCues           the words on screen: the clip's own text, broken into cues of two short lines, timed by the words' timings. The burned
//                         captions and the WebVTT file are made from the same cues, so they cannot disagree.
//   formatFor             the two frames, 16:9 (1920 x 1080) and 9:16 (1080 x 1920), their safe areas and type scale
//   placeForFilm          the popup card's place in a frame, from story-bake's solver (assets/story/place.ts): the SAME function the live popup calls
//   placeCanvasCard       the one placement both canvases (the film and the ad cuts) share: variants of a card (padding and width, never smaller type), the 36 design px floor
//
// Nothing here reads a clock or a file: the film is a pure function of the runtime story. Owner: video-tool.
import type { RuntimeStory, RuntimeBeat, RuntimeClip } from '../runtime.js';
import { FILM_PAD_S } from '../track.js';
import { placePopup, inter, CANVAS_TYPE_MIN, type Rect, type PlaceOut } from '../place.js';

// ---- the numbers -------------------------------------------------------------------------------------------------------------------
export const FILM = {
  fps: 30,
  /** the title card: the exterior establishing move, the family's name, the address, and the fictional line */
  titleS: 4,
  /** a dip to ink joins two scenes: the first half fades the old picture out, the second fades the new one in */
  padS: FILM_PAD_S,
  /** a film beat is cut in this long before its voice begins (the camera is then about to arrive, not walking in silence) and cut out this long after its
   *  last word: the live tour lingers on a beat for its reading time or its walk, a film does not */
  leadS: 0.3,
  tailS: 0.5,
  /** the end card: the voice starts this long after it begins, and the card holds this long after the last word */
  outroLeadS: 0.6,
  outroTailS: 5.5,
  outroMinS: 6,
  /** the disclosures panel comes up this long AFTER the last word ends (the captions are never covered while there is a voice) */
  panelDelayS: 0.2,
  /** a film is never longer (the page it sits on, and a platform's patience); a longer one fails the render with the beats to unflag */
  maxS: 110,
  /** the exterior establishing move is at most this many seconds of the tour's own first moves (the planner's approach to the door) */
  establishMaxS: 5,
  /** the poster is the title card at this second */
  posterS: 3.2,
} as const;

export type FilmKey = '16x9' | '9x16';
export const FILM_KEYS: FilmKey[] = ['16x9', '9x16'];

// ---- the clock ------------------------------------------------------------------------------------------------------------------------
export type FilmPartT = {
  id: string; idx: number;
  /** the tour's seconds this part plays */
  from: number; to: number;
  /** the film's seconds it occupies */
  at: number; end: number;
};
export type FilmClock = {
  fps: number; frames: number;
  /** the film's length in seconds as the frames give it: frames / fps */
  duration: number;
  /** the span the preset's progress 0..1 covers: (frames - 1) / fps, so that frame i is exactly at i / fps */
  span: number;
  title: { t0: number; t1: number };
  parts: FilmPartT[];
  /** the dips between scenes: [t0, t1) in the film's seconds, with the tour's seconds the picture holds before and after the cut */
  pads: Array<{ t0: number; t1: number; before: number; after: number }>;
  outro: { t0: number; t1: number; closingAt: number; closingEnd: number; panelAt: number };
  /** the seconds of the tour's first moves the title card plays forward and the end card plays back */
  establish: number;
};
export type Scene =
  | { kind: 'title'; tour: number; dip: number; ft: number; k: number }
  | { kind: 'part'; tour: number; dip: number; ft: number; part: number; beat: number; k: number }
  | { kind: 'pad'; tour: number; dip: number; ft: number; part: number; beat: number; k: number; shows: 'title' | 'part' | 'outro' }
  | { kind: 'outro'; tour: number; dip: number; ft: number; k: number };

const R3 = (v: number) => Math.round(v * 1000) / 1000;

/** The seconds of the tour's own first moves the title and the end card use: the establishing move, up to the point where the roof would fade. */
export function establishSeconds(rs: RuntimeStory): number {
  const enter = rs.track.events.enter;
  const e = (enter === null || enter === undefined ? FILM.establishMaxS + 0.4 : enter) - 0.4;
  return R3(Math.max(2, Math.min(FILM.establishMaxS, e)));
}

export function closingSeconds(rs: RuntimeStory): number {
  const c = rs.audio.closing;
  if (!c || !(c.durationMs > 0)) throw new Error(`${rs.slug}: no recorded closing clip, so the end card has no voice (pnpm run story:voice -- ${rs.slug})`);
  return c.durationMs / 1000;
}

export function filmClock(rs: RuntimeStory, o: { fps?: number } = {}): FilmClock {
  const fps = o.fps ?? FILM.fps;
  if (rs.durations !== 'voice') throw new Error(`${rs.slug}: the film needs the recorded voice, and the bake used estimated durations (pnpm run story:voice -- ${rs.slug}; pnpm run story:bake -- ${rs.slug})`);
  if (!rs.film.parts.length) throw new Error(`${rs.slug}: no beat is flagged "film": true`);
  const first = FILM.titleS + FILM.padS;
  // Each part is the tour's beat from where the film cuts in to FILM.tailS after its last word: the tour holds a beat for its reading time, its
  // minimum or its walk, and a film that held it too would be seconds of silence. The parts are laid end to end, a dip between each pair.
  let cursor = first;
  const parts: FilmPartT[] = rs.film.parts.map((p, n) => {
    const idx = rs.beats.findIndex(b => b.id === p.id);
    if (idx < 0) throw new Error(`${rs.slug}: film part ${p.id} is not a beat of the story`);
    const b = rs.beats[idx], say = b.say ? rs.audio[`${b.id}.say`] : null, narr = rs.audio[b.id];
    const spoken = say && b.sayAt !== null ? b.sayAt + say.durationMs / 1000 : narr ? b.speechAt + narr.durationMs / 1000 : p.to;
    const from = R3(Math.max(p.from, Math.min(b.speechAt - FILM.leadS, p.to - 1)));
    const to = R3(Math.max(from + 1, Math.min(p.to, spoken + FILM.tailS)));
    if (n) cursor += FILM.padS;
    const at = R3(cursor); cursor += to - from;
    return { id: p.id, idx, from, to, at, end: R3(at + (to - from)) };
  });
  const lastEnd = parts[parts.length - 1].end;
  const outro0 = R3(lastEnd + FILM.padS);
  const closingS = closingSeconds(rs);
  const outroS = Math.max(FILM.outroMinS, FILM.outroLeadS + closingS + FILM.outroTailS);
  const frames = Math.ceil((outro0 + outroS) * fps - 1e-9);
  const pads: FilmClock['pads'] = [];
  const edge = (t0: number, before: number, after: number) => pads.push({ t0: R3(t0), t1: R3(t0 + FILM.padS), before, after });
  const E = establishSeconds(rs);
  edge(FILM.titleS, E, parts[0].from);
  for (let i = 1; i < parts.length; i++) edge(parts[i - 1].end, parts[i - 1].to, parts[i].from);
  edge(lastEnd, parts[parts.length - 1].to, E);
  const closingAt = R3(outro0 + FILM.outroLeadS);
  return {
    fps, frames, duration: frames / fps, span: (frames - 1) / fps,
    title: { t0: 0, t1: FILM.titleS }, parts, pads,
    outro: { t0: outro0, t1: R3(outro0 + outroS), closingAt, closingEnd: R3(closingAt + closingS), panelAt: R3(closingAt + closingS + FILM.panelDelayS) },
    establish: E,
  };
}

/** Where the film is, at film second ft: which scene, which second of the tour the camera is at, and how far the dip has darkened the picture. */
export function sceneAt(clock: FilmClock, ft: number): Scene {
  const E = clock.establish;
  if (ft < clock.title.t1) return { kind: 'title', tour: E * Math.max(0, ft) / FILM.titleS, dip: 0, ft, k: Math.max(0, ft) / FILM.titleS };
  if (ft >= clock.outro.t0) {
    const k = Math.min(1, (ft - clock.outro.t0) / (clock.outro.t1 - clock.outro.t0));
    return { kind: 'outro', tour: E * (1 - k), dip: 0, ft, k };
  }
  for (let n = 0; n < clock.pads.length; n++) {
    const p = clock.pads[n];
    if (ft >= p.t0 && ft < p.t1) {
      // pad n joins part n - 1 (or the title) to part n (or the end card): the picture before the cut is held through the first half, the one after through the second
      const k = (ft - p.t0) / (p.t1 - p.t0), dip = 1 - Math.abs(2 * k - 1);
      const part = k < 0.5 ? Math.max(0, n - 1) : Math.min(n, clock.parts.length - 1);
      const shows = k < 0.5 ? (n === 0 ? 'title' : 'part') : (n === clock.pads.length - 1 ? 'outro' : 'part');
      return { kind: 'pad', tour: k < 0.5 ? p.before : p.after, dip, ft, part, beat: clock.parts[part].idx, k, shows };
    }
  }
  let pi = 0;
  for (let i = 0; i < clock.parts.length; i++) if (clock.parts[i].at <= ft + 1e-9) pi = i;
  const p = clock.parts[pi];
  const tour = Math.min(p.to, p.from + (ft - p.at));
  return { kind: 'part', tour, dip: 0, ft, part: pi, beat: p.idx, k: (ft - p.at) / Math.max(1e-6, p.end - p.at) };
}

/** The film second at which the tour's second `tour` is on screen, if any part plays it (otherwise null) */
export function filmTimeOfTour(clock: FilmClock, tour: number): number | null {
  for (const p of clock.parts) if (tour >= p.from - 1e-9 && tour <= p.to + 1e-9) return R3(p.at + (tour - p.from));
  return null;
}

/** The Companion Core's power in the film's progress units (the page's `preset.power`): { at: -1 } where the Core is already on whenever it is seen */
export function powerForFilm(clock: FilmClock, press: number | null, ramp: number): { at: number; ramp?: number } {
  if (press === null || press === undefined) return { at: -1 };
  const first = clock.parts[0];
  if (press <= first.from) return { at: -1 };
  let at: number | null = filmTimeOfTour(clock, press);
  if (at === null) {
    // the press falls in a part nobody sees: the Core is on by the start of the next part that is
    const next = clock.parts.find(p => p.from > press);
    if (!next) return { at: -1 };
    at = next.at - ramp - FILM.padS;
  }
  return { at: +(Math.max(0, at) / clock.span).toFixed(5), ramp: +Math.max(0.004, Math.min(0.08, ramp / clock.span)).toFixed(5) };
}

// ---- the sound -------------------------------------------------------------------------------------------------------------------------
export type Placement = { id: string; kind: 'narration' | 'say' | 'closing'; atS: number; durS: number; endS: number; clip: RuntimeClip; beat: string | null; speaker: string };
/** Where each recorded clip sits in the film. A clip that would run past its part (or begin before it) is reported in `problems`. */
export function audioPlacements(rs: RuntimeStory, clock: FilmClock): { placements: Placement[]; problems: string[] } {
  const out: Placement[] = [], problems: string[] = [];
  for (const p of clock.parts) {
    const b = rs.beats[p.idx];
    const add = (id: string, kind: 'narration' | 'say', tourAt: number) => {
      const clip = rs.audio[id];
      if (!clip) { problems.push(`${id}: no recorded clip in the voice lock`); return; }
      const atS = R3(p.at + (tourAt - p.from)), durS = clip.durationMs / 1000, endS = R3(atS + durS);
      if (atS < p.at - 1e-6) problems.push(`${id}: starts ${(p.at - atS).toFixed(2)} s before its part of the film`);
      if (endS > p.end + 1e-6) problems.push(`${id}: runs ${(endS - p.end).toFixed(2)} s past its part of the film`);
      out.push({ id, kind, atS, durS: R3(durS), endS, clip, beat: b.id, speaker: clip.speaker });
    };
    add(b.id, 'narration', b.speechAt);
    if (b.say && b.sayAt !== null) add(`${b.id}.say`, 'say', b.sayAt);
  }
  const c = rs.audio.closing;
  out.push({ id: 'closing', kind: 'closing', atS: clock.outro.closingAt, durS: R3(c.durationMs / 1000), endS: clock.outro.closingEnd, clip: c, beat: null, speaker: 'narrator' });
  out.sort((a, b) => a.atS - b.atS);
  for (let i = 1; i < out.length; i++) if (out[i].atS < out[i - 1].endS - 1e-6) problems.push(`${out[i].id} starts before ${out[i - 1].id} has finished`);
  return { placements: out, problems };
}

// ---- the words -------------------------------------------------------------------------------------------------------------------------
export type CueWord = { text: string; s: number; e: number };
export type Cue = { start: number; end: number; words: CueWord[]; text: string; speaker: string | null; clip: string; scripted: boolean };
/** the per-line limit the style sheet sets (claims.json style.captionMaxCharsPerLine / captionMaxLines) */
export const CAPTION = { maxChars: 42, maxLines: 2 };

/** The clip's text split on whitespace, each token with its timing. The lock's timings are per spoken word (punctuation has none), so the tokens line
 *  up one to one with the text; when they do not (a lexicon respelling, say) the tokens share the clip's length by their size. */
export function tokensWithTiming(text: string, words: Array<[string, number, number]>, durationMs: number): { text: string; s: number; e: number }[] {
  const toks = text.split(/\s+/).filter(Boolean);
  if (words.length === toks.length) return toks.map((t, i) => ({ text: t, s: words[i][1] / 1000, e: words[i][2] / 1000 }));
  const total = toks.reduce((a, t) => a + t.length + 1, 0);
  let acc = 0;
  return toks.map(t => { const s = acc / total * durationMs / 1000; acc += t.length + 1; return { text: t, s, e: acc / total * durationMs / 1000 }; });
}

const endsSentence = (t: string) => /[.!?]["')\]]?$/.test(t);
const endsClause = (t: string) => /[,;:]["')\]]?$/.test(t);

/** Break a clip's tokens into cues of at most `maxLines` lines of `maxChars`: at sentence ends first, then at a comma near the middle, then anywhere. */
export function chunkTokens<T extends { text: string }>(toks: T[], maxChars = CAPTION.maxChars, maxLines = CAPTION.maxLines): T[][] {
  const limit = maxChars * maxLines;
  const len = (a: T[]) => a.reduce((n, t) => n + t.text.length, 0) + Math.max(0, a.length - 1);
  // sentences
  const sentences: T[][] = []; let cur: T[] = [];
  for (const t of toks) { cur.push(t); if (endsSentence(t.text)) { sentences.push(cur); cur = []; } }
  if (cur.length) sentences.push(cur);
  // a sentence longer than a cue is split: at the comma nearest the middle that leaves both halves fitting, else at the middle word
  const pieces: T[][] = [];
  const split = (s: T[]) => {
    if (len(s) <= limit) { pieces.push(s); return; }
    let best = -1, bestScore = Infinity;
    for (let i = 1; i < s.length; i++) {
      const left = len(s.slice(0, i)), right = len(s.slice(i));
      const score = Math.abs(left - right) + (endsClause(s[i - 1].text) ? 0 : 12);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    split(s.slice(0, best)); split(s.slice(best));
  };
  sentences.forEach(split);
  // short neighbours share a cue when both fit
  const cues: T[][] = [];
  for (const p of pieces) {
    const prev = cues[cues.length - 1];
    if (prev && len(prev) + 1 + len(p) <= limit && len(prev) < maxChars * 0.7) cues[cues.length - 1] = prev.concat(p);
    else cues.push(p);
  }
  return cues;
}

/** Every cue of the film, in order. `names` maps a speaker's member id to the name the caption shows. */
export function captionCues(rs: RuntimeStory, placements: Placement[], names: Record<string, string> = {}): Cue[] {
  const out: Cue[] = [];
  for (const pl of placements) {
    const text = clipText(rs, pl);
    const toks = tokensWithTiming(text, pl.clip.words, pl.clip.durationMs);
    const speaker = pl.kind === 'say' ? (names[pl.clip.speaker] || pl.clip.speaker) : null;
    for (const chunk of chunkTokens(toks)) {
      const words: CueWord[] = chunk.map(t => ({ text: t.text, s: R3(pl.atS + t.s), e: R3(pl.atS + t.e) }));
      out.push({ start: words[0].s, end: words[words.length - 1].e, words, text: chunk.map(t => t.text).join(' '), speaker, clip: pl.id, scripted: pl.kind === 'say' });
    }
  }
  // a cue comes up 0.08 s before its first word (never before the last word of the cue before it is done) and stays up until the next begins, at most
  // 0.6 s past its last word; no two overlap
  const starts = out.map((c, i) => Math.max(0, R3(Math.min(c.start, Math.max(c.start - 0.08, i ? out[i - 1].end : 0)))));
  for (let i = 0; i < out.length; i++) {
    const next = starts[i + 1], hold = R3(out[i].end + 0.6);
    out[i] = { ...out[i], start: starts[i], end: next === undefined ? hold : R3(Math.max(Math.min(hold, next), out[i].end)) };
  }
  return out;
}
function clipText(rs: RuntimeStory, pl: Placement): string {
  if (pl.kind === 'closing') return `${rs.closing.body} UnCloud your life.`;
  const b = rs.beats.find(x => x.id === pl.beat)!;
  return pl.kind === 'say' ? b.say!.text : b.popup.body;
}

const ts = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000)), h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), sec = Math.floor(ms % 60000 / 1000), r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
};
const escVtt = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** WebVTT for the film. One cue per caption, a line break at the balanced word when the cue is longer than one line, a voice tag on an agent's line. */
export function toVtt(cues: Cue[]): string {
  const lines = ['WEBVTT', ''];
  cues.forEach((c, i) => {
    let text = c.text;
    if (text.length > CAPTION.maxChars) {
      let acc = 0, best = 0, bestD = Infinity;
      c.words.forEach((w, k) => { acc += w.text.length + (k ? 1 : 0); const d = Math.abs(acc - text.length / 2); if (k < c.words.length - 1 && d < bestD) { bestD = d; best = k; } });
      text = c.words.slice(0, best + 1).map(w => w.text).join(' ') + '\n' + c.words.slice(best + 1).map(w => w.text).join(' ');
    }
    lines.push(String(i + 1), `${ts(c.start)} --> ${ts(c.end)}`, (c.speaker ? `<v ${escVtt(c.speaker)}>` : '') + escVtt(text), '');
  });
  return lines.join('\n');
}

// ---- the frames --------------------------------------------------------------------------------------------------------------------------
export type Safe = { top: number; right: number; bottom: number; left: number };
export type FilmFormat = {
  key: FilmKey; res: number; w: number; h: number; aspect: number; portrait: boolean;
  /** pixels per unit of the design (a unit is a pixel of the 1080-short-edge frame) */
  k: number;
  /** the frame's margins, in pixels: where text may sit. A portrait film keeps clear of the top and bottom a phone's own interface covers. */
  safe: Safe;
};
export function formatFor(key: FilmKey, res = 1080): FilmFormat {
  const long = Math.round(res * 16 / 9 / 2) * 2, k = res / 1080, portrait = key === '9x16';
  const w = portrait ? res : long, h = portrait ? long : res;
  const safe: Safe = portrait ? { top: 200 * k, right: 72 * k, bottom: 340 * k, left: 72 * k } : { top: 54 * k, right: 96 * k, bottom: 54 * k, left: 96 * k };
  return { key, res, w, h, aspect: w / h, portrait, k, safe };
}

/** Where the caption strip sits and how tall it is reserved to be (two lines of the caption type plus its padding, and the row an agent's line adds for its speaker):
 *  the popup stays out of it. The caption type (40 and 44 design px) is above the canvas floor (36). */
export function captionBox(f: FilmFormat): Rect & { font: number; line: number; pad: number; tag: number } {
  const font = Math.round((f.portrait ? 40 : 44) * f.k), line = Math.round(font * 1.32), pad = Math.round(20 * f.k), tag = Math.round(CANVAS_TYPE_MIN * 1.5 * f.k);
  const width = f.portrait ? f.w - f.safe.left - f.safe.right : Math.min(f.w - f.safe.left - f.safe.right, Math.round(1320 * f.k));
  const hh = line * CAPTION.maxLines + 2 * pad + tag;
  return { x: Math.round((f.w - width) / 2), y: Math.round(f.h - f.safe.bottom - hh), w: width, h: hh, font, line, pad, tag };
}
/** The corner mark ("Fictional family. Real software."): top left inside the safe area, at the canvas floor (36 design px, it was 26). */
export function badgeBox(f: FilmFormat, textW: number): Rect & { font: number } {
  const font = CANVAS_TYPE_MIN * f.k, padX = Math.round(20 * f.k), hh = Math.round(font * 1.7);   // (not rounded: a rounded size can fall a hair under the floor)
  return { x: Math.round(f.safe.left), y: Math.round(f.safe.top), w: Math.round(textW + 2 * padX + font * 0.9), h: hh, font };
}

// ---- the canvas card: one placement for the film and the ad cuts -----------------------------------------------------------------------------
/**
 * THE CANVAS TYPE FLOOR. A film or ad canvas is a picture, shown scaled down (a 1080 px canvas is about 390 px wide on a phone), so its type floor is not the live cards' 25.5 px:
 * it is 36 design px at a 1080 px short edge (`CANVAS_TYPE_MIN`, assets/story/place.ts), times the frame's k. Like the live card, a canvas card never shrinks its type to fit: it is
 * offered as VARIANTS (the card at its width, with tighter padding, narrower and so taller, without its phone drawing), each with the smallest type in it, and the solver
 * refuses a variant under the floor and finds the slot and variant that keep off the subject. A card cannot scroll on a canvas: one taller than its room is not ok.
 */
export type CanvasFrame = { w: number; h: number; k: number; safe: Safe; sheet: boolean };
export type CanvasVariant = { w: number; h: number; /** the smallest type in the card, px of this canvas (undefined: not judged) */ type?: number; /** the cost of choosing it (0 is the card as designed) */ cost?: number; tag?: string };
export type CanvasPlace = PlaceOut & { alt: 'top' | null; variant: number; scrolls: boolean; refused: number };
/** The card's wanted width in design units: about a third of the canvas (the live cards' 32 %), and never narrower than 18 em of the floor's type (the live card at 1440 is 18 em wide). */
export const CARD_EM = 18;
export function canvasCardWidth(f: { w: number; k: number }): number {
  const k = f.k, third = 0.32 * f.w, em = CARD_EM * CANVAS_TYPE_MIN * k;
  return Math.round(Math.min(0.62 * f.w, Math.max(third, em)));
}
/** The widths a floating card may take: the wanted one, then 92, 85, 78 and 72 % of it, never under 12.5 em of the floor's type (a layout whose chip or longest word is wider than its text column is dropped by `canvasVariants`). */
export function canvasCardWidths(f: { w: number; k: number }): number[] {
  const w0 = canvasCardWidth(f), min = 12.5 * CANVAS_TYPE_MIN * f.k, out = [w0];
  for (const s of [0.92, 0.85, 0.78, 0.72]) { const w = Math.round(w0 * s); if (w >= min && !out.includes(w)) out.push(w); }
  return out;
}
/** The tight padding costs little; a narrower card more; leaving the phone drawing out the most (it is the story's own picture of a first-run step). */
export const COST_TIGHT = 0.03, COST_NARROWER = 0.4, COST_BARE = 0.8;
/** The variants of a card in the order the solver prefers them: for each way of leaving the drawing out, each width, each padding. `measure` lays the card out and returns its size. */
export function canvasVariants<L extends { w: number; h: number; type: number; bad?: boolean }>(widths: number[], measure: (w: number, tight: boolean, bare: boolean) => L, o: { bare?: boolean } = {}): Array<{ layout: L; size: CanvasVariant }> {
  const out: Array<{ layout: L; size: CanvasVariant }> = [];
  for (const bare of o.bare ? [false, true] : [false]) widths.forEach((w, wi) => { for (const tight of [false, true]) {
    const layout = measure(w, tight, bare);
    if (layout.bad && (wi > 0 || tight || bare)) continue;      // a chip or a word wider than the column: not a way to set this card (the first is kept so there is always one)
    out.push({ layout, size: { w: layout.w, h: layout.h, type: layout.type, cost: wi * COST_NARROWER + (tight ? COST_TIGHT : 0) + (bare ? COST_BARE : 0), tag: `${wi ? `w${wi}` : 'w0'}${tight ? ' tight' : ''}${bare ? ' bare' : ''}` } });
  } });
  return out;
}
/**
 * Where a card (or the hook's panel) goes in a canvas. `cap` is the caption strip's reserved box, `badge` the corner mark's.
 *  Sheet frames (9:16, 4:5): a sheet across the safe width sitting on the captions, or, if that would cover the subject, under the corner mark; the variants are tried in order.
 *  Others (16:9, 1:1): story-bake's solver, the same function the live popup calls, with the captions and the corner mark as bars and the floor of this canvas.
 */
export function placeCanvasCard(fr: CanvasFrame, inp: { focus: Rect | null; core: Rect | null; variants: CanvasVariant[]; cap: Rect; badge: Rect }): CanvasPlace {
  const k = fr.k, floor = CANVAS_TYPE_MIN * k, eps = 0.06, bars: Rect[] = [{ x: inp.cap.x, y: inp.cap.y, w: inp.cap.w, h: inp.cap.h }];
  const vs = inp.variants.map((v, i) => ({ ...v, i, cost: v.cost ?? i * COST_NARROWER })), allowed = vs.filter(v => v.type === undefined || v.type + eps >= floor), refused = vs.length - allowed.length;
  const stuck = !allowed.length, pool = stuck ? [vs[0]] : allowed;
  if (!fr.sheet) {
    bars.push({ x: inp.badge.x, y: inp.badge.y, w: inp.badge.w, h: inp.badge.h });
    const p = placePopup({
      vw: fr.w, vh: fr.h, safe: { ...fr.safe }, focus: inp.focus, core: inp.core, bars, card: { w: vs[0].w, h: vs[0].h },
      variants: vs.map(v => ({ w: v.w, h: v.h, full: v.h, type: v.type, cost: v.cost, tag: v.tag })), floor, gap: 18 * k, phone: false,
    });
    return { ...p, ok: p.ok && !p.scrolls, alt: null };
  }
  const w = fr.w - fr.safe.left - fr.safe.right, meas = (r: Rect) => ({
    overlapFocus: inp.focus ? inter(r, inp.focus) / Math.max(1, inp.focus.w * inp.focus.h) : 0,
    overlapCore: inp.core ? inter(r, inp.core) / Math.max(1, inp.core.w * inp.core.h) : 0,
    overlapBars: bars.reduce((a, b) => a + inter(r, b), 0) / Math.max(1, r.w * r.h),
  });
  let best: CanvasPlace | null = null, bestCost = Infinity;
  for (const v of pool) for (const where of ['bottom', 'top'] as const) {
    const rect: Rect = where === 'bottom' ? { x: fr.safe.left, y: inp.cap.y - Math.round(16 * k) - v.h, w, h: v.h } : { x: fr.safe.left, y: Math.round(fr.safe.top + inp.badge.h + 14 * k), w, h: v.h };
    const m = meas(rect), fits = rect.y >= fr.safe.top - 1 && rect.y + rect.h <= inp.cap.y - (where === 'bottom' ? 0 : 8 * k) + 1;
    const good = fits && m.overlapFocus < 0.02 && m.overlapCore < 0.02 && m.overlapBars === 0;
    const cost = good ? v.cost + (where === 'top' ? 0.05 : 0) : 10 + m.overlapFocus + m.overlapCore + m.overlapBars * 10 + (fits ? 0 : 5) + v.cost;
    if (cost < bestCost - 1e-9) { bestCost = cost; best = { slot: 'sheet', mode: 'sheet', rect, leader: null, ...m, ok: good && !stuck, score: -cost, alt: where === 'top' ? 'top' : null, variant: v.i, scrolls: false, refused }; }
  }
  return best!;
}

export type FilmPlace = CanvasPlace;
/** The popup card's rectangle in a film frame: `placeCanvasCard` (above) with the film's caption strip and corner mark. `variants` are the ways the card can be set (padding, width, the
 *  phone drawing left out; none under the 36 design px floor); a lone `card` is one variant that is not judged. `badgeW` is the corner mark's text width (default: its 32 characters). */
export function placeForFilm(f: FilmFormat, inp: { focus: Rect | null; core: Rect | null; card: { w: number; h: number }; variants?: CanvasVariant[]; badgeW?: number }): FilmPlace {
  const cap = captionBox(f), bb = badgeBox(f, inp.badgeW ?? 640 * f.k), badge: Rect = { x: bb.x, y: bb.y, w: bb.w, h: bb.h };
  return placeCanvasCard({ w: f.w, h: f.h, k: f.k, safe: f.safe, sheet: f.portrait }, { focus: inp.focus, core: inp.core, variants: inp.variants ?? [{ w: inp.card.w, h: inp.card.h }], cap: { x: cap.x, y: cap.y, w: cap.w, h: cap.h }, badge });
}

// ---- small shared helpers ----------------------------------------------------------------------------------------------------------------
export const smoothstep = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** 0 before `a`, 1 after `b` */
export const ramp = (x: number, a: number, b: number) => smoothstep((x - a) / Math.max(1e-6, b - a));
/** the card's opacity at film second ft for a beat shown from `from` to `to` (fades over 0.3 s in and 0.25 s out) */
export const cardAlpha = (ft: number, from: number, to: number) => Math.min(ramp(ft, from, from + 0.3), 1 - ramp(ft, to - 0.25, to));

/** The beat of the story a scene belongs to (null on the title and the end card) */
export function beatOf(rs: RuntimeStory, sc: Scene): RuntimeBeat | null { return sc.kind === 'part' || sc.kind === 'pad' ? rs.beats[sc.beat] : null; }

/** How many seconds of a film would have to go for the cap: the beats, longest first (the render's error message) */
export function overCap(rs: RuntimeStory, clock: FilmClock): string | null {
  if (clock.duration <= FILM.maxS) return null;
  const longest = clock.parts.map(p => ({ id: p.id, s: p.end - p.at })).sort((a, b) => b.s - a.s).slice(0, 3).map(x => `${x.id} (${x.s.toFixed(1)} s)`).join(', ');
  return `${rs.slug}: the film is ${clock.duration.toFixed(1)} s and the cap is ${FILM.maxS} s; unflag "film" on a beat or two (the longest: ${longest})`;
}
