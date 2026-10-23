// The persona cut's plan: everything about a silent social ad that is arithmetic, with no canvas, no THREE and no DOM, so Node tests it and the
// page that draws the pictures (cut/page.ts) and the script that encodes them (scripts/render-persona-cuts.mts) agree on it.
//
// A CUT is one member's story as a 15 to 25 second silent vertical ad, made from the family's own files: the hook (the member's best beat's title, big,
// over the room), the beat on the tour's own camera with its popup card and burned captions, and an end card. reference/story/ads.md is the brief.
//
//   planFamilyCuts(story, times)   the cuts of a family, one per member who has a beat to tell (the hook rule below)
//   cutFormat(key, res)            the four frames (9x16, 1x1, 4x5, 16x9): the size delivered, the size the page renders, the crop, the safe area
//   sceneAt(plan, ft, establish)   where the cut is at film second ft: which scene, which second of the tour the camera is at
//   placeForCut(f, inp)            the card's (or the hook's) place in a frame: story-bake's solver, as the film uses it
//
// The hook rule: a member's cut opens on the FIRST beat of theirs with `film: true` that is in a room or outside chapter (the first-run chapter is the
// Core's arrival, not the member's story). No such beat: their first room or outside beat that names an app with a `replaces`, then any app, then
// their first. The hook is that beat's popup title (the story writes titles as headlines), or its first sentence when the title runs over eight words.
// The cut length: the hook beat alone when it reaches 15 s (the tail and the end card may stretch to do it), else the member's next beat, whole
// sentences, until the cut is long enough and no longer than 25 s.
//
// Nothing here reads a clock or a file. Owner: ad-kit.
import type { Story, Beat } from '../../types.js';
import { estimateMs } from '../../runtime.js';
import { chunkTokens, placeCanvasCard, CAPTION, type Cue, type CueWord, type CanvasVariant, type CanvasPlace } from '../layout.js';
import { CANVAS_TYPE_MIN, type Rect } from '../../place.js';

// ---- the numbers -----------------------------------------------------------------------------------------------------------------------
export const CUT = {
  fps: 30,
  /** the hook: the title, big, over the room, before the beat's card and captions come in */
  hookS: 2,
  /** the last words stay this long; a short cut may stretch it to tailMaxS */
  tailS: 0.8, tailMaxS: 1.4,
  /** a dip to chalk joins two scenes: the old picture fades out over the first half, the new one in over the second */
  padS: 0.35,
  /** an extension beat is cut in this long before its captions begin */
  leadS: 0.6,
  /** the end card; a short cut may stretch it to endMaxS */
  endS: 3.5, endMaxS: 4,
  minS: 15, maxS: 25,
  /** the hook's words fade out over this long before the card comes in */
  hookFadeS: 0.25,
  /** the card is never in before this long after a part begins (the hook holds the first part's first seconds), and never later than this long after its captions begin */
  cardGapS: 0.3, cardLateS: 1.2,
  /** the title is the hook when it is this many words or fewer, else the body's first sentence */
  hookTitleMaxWords: 8,
} as const;

export type CutKey = '9x16' | '1x1' | '4x5' | '16x9';
/** a word of a caption and the seconds it is read in */
export type CutWord = CueWord;
export const CUT_KEYS: CutKey[] = ['9x16', '1x1', '4x5', '16x9'];
/** the short edge, in pixels, a cut can be rendered at: the sizes the page's own renderer offers (room-creator.html recordSize) */
export const CUT_RES = [360, 540, 720, 1080, 1440, 2160];
/** the page's frame sizes: [the long edge, its `res` string] */
export const PAGE_SIZES: Array<[number, string]> = [[640, '360'], [960, '540'], [1280, '720'], [1920, '1080'], [2560, '1440'], [3840, '2160']];

const R3 = (v: number) => Math.round(v * 1000) / 1000;
export const wordCount = (t: string) => (t.match(/\S+/g) || []).length;
/** whole sentences: a split after . ! or ? that is followed by a space */
export const sentencesOf = (text: string): string[] => text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);

// ---- the frames ----------------------------------------------------------------------------------------------------------------------------
export type Safe = { top: number; right: number; bottom: number; left: number };
export type CutFormat = {
  key: CutKey;
  /** the file as delivered */
  out: { w: number; h: number };
  /** what the page renders: `res` and `aspect` as __houseRenderBegin takes them, and the size that gives (a square or a 9:16 or a 16:9) */
  page: { res: string; aspect: '16:9' | '9:16' | '1:1'; w: number; h: number };
  /** the part of the page's frame that is the cut's frame: all of it, except 4:5, which is the middle 80 % of a square */
  crop: { x: number; w: number };
  /** the canvas the overlay is drawn on (the crop): `w` and `h` are its size, so a CutFormat has the shape the film's helpers take */
  w: number; h: number; aspect: number;
  /** the aspect the bake's compose table is read at (trackFrameAt): the frame's own, except 4:5, which takes the phone frame's (0.5625), because a 4:5 card is a sheet and the
   *  subject must sit above it as it does in 9:16 */
  compose: number;
  /** pixels of the canvas per unit of the design (a unit is a pixel of the delivered frame at 1080 short edge) */
  k: number;
  /** a sheet layout (the card is a bottom sheet over the captions) in 9x16 and 4x5; the placement solver's card beside the subject in 1x1 and 16x9 */
  sheet: boolean; portrait: boolean;
  /** the frame's margins in canvas pixels: where text may sit */
  safe: Safe;
  res: number;
};
/** The design of each frame: its size at the 1080 short edge and its safe area (9x16 as film.md; the others are ours, see ads.md). */
export const DESIGN: Record<CutKey, { w: number; h: number; safe: Safe }> = {
  '9x16': { w: 1080, h: 1920, safe: { top: 200, right: 72, bottom: 340, left: 72 } },
  '4x5': { w: 1080, h: 1350, safe: { top: 110, right: 72, bottom: 150, left: 72 } },
  '1x1': { w: 1080, h: 1080, safe: { top: 84, right: 84, bottom: 120, left: 84 } },
  '16x9': { w: 1920, h: 1080, safe: { top: 54, right: 96, bottom: 54, left: 96 } },
};
const even = (v: number) => Math.round(v / 2) * 2;
const pageLong = (min: number): [number, string] => PAGE_SIZES.find(p => p[0] >= min) || PAGE_SIZES[PAGE_SIZES.length - 1];

export function cutFormat(key: CutKey, res = 1080): CutFormat {
  if (!CUT_KEYS.includes(key)) throw new Error(`unknown aspect ${key} (${CUT_KEYS.join(', ')})`);
  if (!CUT_RES.includes(res)) throw new Error(`--res must be one of ${CUT_RES.join(', ')} (the sizes the page renders at), got ${res}`);
  const d = DESIGN[key], long = even(res * 16 / 9);
  let out: { w: number; h: number }, page: CutFormat['page'], crop: { x: number; w: number };
  if (key === '9x16') { out = { w: res, h: long }; page = { res: String(res), aspect: '9:16', w: res, h: long }; crop = { x: 0, w: res }; }
  else if (key === '16x9') { out = { w: long, h: res }; page = { res: String(res), aspect: '16:9', w: long, h: res }; crop = { x: 0, w: long }; }
  else if (key === '1x1') { const [s, r] = pageLong(res); out = { w: res, h: res }; page = { res: r, aspect: '1:1', w: s, h: s }; crop = { x: 0, w: s }; }
  else {
    // 4:5: the page cannot render it, so the page renders a square and the frame is its middle 80 %: the same vertical lens, a narrower view, exactly 0.8 wide to 1 tall.
    // The camera is composed as for a phone (compose below): the subject above where the card's sheet goes
    const oh = even(res * 1.25), [s, r] = pageLong(oh), cw = even(s * 0.8);
    out = { w: res, h: oh }; page = { res: r, aspect: '1:1', w: s, h: s }; crop = { x: Math.round((s - cw) / 2), w: cw };
  }
  const w = crop.w, h = page.h, k = w / d.w;
  const sf = d.safe, safe: Safe = { top: sf.top * k, right: sf.right * k, bottom: sf.bottom * k, left: sf.left * k };
  const sheet = key === '9x16' || key === '4x5';
  return { key, out, page, crop, w, h, aspect: w / h, compose: key === '4x5' ? 9 / 16 : w / h, k, sheet, portrait: sheet, safe, res };
}

/** The caption strip's place and the room it reserves: two lines of the caption's type and its padding, on the bottom margin. The caption type (42 and 44 design px) is above the canvas floor (36). */
export function cutCaptionBox(f: CutFormat): Rect & { font: number; line: number; pad: number } {
  const font = Math.round((f.sheet ? 42 : 44) * f.k), line = Math.round(font * 1.32), pad = Math.round(20 * f.k);
  const width = f.sheet || f.key === '1x1' ? f.w - f.safe.left - f.safe.right : Math.min(f.w - f.safe.left - f.safe.right, Math.round(1320 * f.k));
  const hh = line * CAPTION.maxLines + 2 * pad;
  return { x: Math.round((f.w - width) / 2), y: Math.round(f.h - f.safe.bottom - hh), w: width, h: hh, font, line, pad };
}
/** The corner mark's size: the label at the canvas floor, 36 design units (it was 28 to 31), top left inside the safe area. */
export function cutBadgeBox(f: CutFormat, textW: number): Rect & { font: number } {
  const font = CANVAS_TYPE_MIN * f.k, padX = Math.round(20 * f.k), hh = Math.round(font * 1.7);   // (not rounded: a rounded size can fall a hair under the floor)
  return { x: Math.round(f.safe.left), y: Math.round(f.safe.top), w: Math.round(textW + 2 * padX + font * 0.9), h: hh, font };
}

export type CutPlace = CanvasPlace;
/**
 * Where a card (or the hook's panel) goes in a frame, from the subject's rect at the beat's rest pose: `placeCanvasCard` (layout.ts), the placement the family film shares.
 * Sheet frames (9x16, 4x5): a sheet across the safe width sitting on the caption strip; if that would cover the subject, under the corner mark.
 * 1x1 and 16x9: story-bake's solver (assets/story/place.ts), the same function the live popup calls, with the caption strip and the corner mark as bars.
 * The card is offered as `variants` (its width, tighter padding, narrower and taller), none with type under 36 design px; a lone `card` is one variant that is not judged.
 */
export function placeForCut(f: CutFormat, inp: { focus: Rect | null; core: Rect | null; card: { w: number; h: number }; variants?: CanvasVariant[]; badgeW?: number }): CutPlace {
  const cap = cutCaptionBox(f), bw = inp.badgeW ?? 640 * f.k, bb = cutBadgeBox(f, bw);
  return placeCanvasCard({ w: f.w, h: f.h, k: f.k, safe: f.safe, sheet: f.sheet }, { focus: inp.focus, core: inp.core, variants: inp.variants ?? [{ w: inp.card.w, h: inp.card.h }], cap: { x: cap.x, y: cap.y, w: cap.w, h: cap.h }, badge: { x: bb.x, y: bb.y, w: bb.w, h: bb.h } });
}

// ---- the words ----------------------------------------------------------------------------------------------------------------------------
/**
 * Word timings for a caption read at the estimate's pace (the bake's 150 words a minute: `estimateMs`): the caption lasts exactly `durS`, a word's share of it is
 * its length plus two, and a full stop or a comma leaves a short pause after it. Times are seconds from the caption's start.
 */
export function wordTimes(text: string, durS: number): CutWord[] {
  const toks = text.split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const w = toks.map(t => t.replace(/[^\p{L}\p{N}]/gu, '').length + 2), pause = toks.map((t, i) => (i === toks.length - 1 ? 0 : /[.!?]["')\]]?$/.test(t) ? 3 : /[,;:]["')\]]?$/.test(t) ? 1.5 : 0));
  const total = w.reduce((a, b) => a + b, 0) + pause.reduce((a, b) => a + b, 0), unit = durS / total;
  let acc = 0;
  return toks.map((t, i) => { const s = acc * unit; acc += w[i]; const e = acc * unit; acc += pause[i]; return { text: t, s: R3(s), e: R3(Math.min(durS, e)) }; });
}

/** How many characters a caption line may hold in a frame: the strip is narrower in a phone's frame than in a wide one, and a cue must fit its two lines. */
export const cutCaptionChars = (key: CutKey): number => (key === '16x9' ? CAPTION.maxChars : 38);

/** the captions of every part as cues of two short lines, the way the film cuts them (layout.ts chunkTokens), timed by the words; no two overlap */
export function cutCues(parts: CutPart[], maxChars: number = CAPTION.maxChars): Cue[] {
  const out: Cue[] = [];
  for (const p of parts) {
    for (const chunk of chunkTokens(p.words.map(w => ({ ...w })), maxChars, CAPTION.maxLines)) {
      const words: CueWord[] = chunk.map(t => ({ text: t.text, s: R3(t.s), e: R3(t.e) }));
      out.push({ start: words[0].s, end: words[words.length - 1].e, words, text: chunk.map(t => t.text).join(' '), speaker: null, clip: p.beat, scripted: false });
    }
  }
  const starts = out.map((c, i) => Math.max(0, R3(Math.min(c.start, Math.max(c.start - 0.08, i ? out[i - 1].end : 0)))));
  for (let i = 0; i < out.length; i++) {
    const next = starts[i + 1], hold = R3(out[i].end + 0.6);
    out[i] = { ...out[i], start: starts[i], end: next === undefined ? hold : R3(Math.max(Math.min(hold, next), out[i].end)) };
  }
  return out;
}

// ---- the plan ---------------------------------------------------------------------------------------------------------------------------------
/** what the bake says of one beat, in the shape of a RuntimeBeat (assets/story/runtime.ts): the tour's seconds */
export type BeatTimes = { t0: number; t1: number; travel: [number, number] | null; rest: number; speechAt: number; popupAt: number };
export type CutPart = {
  beat: string; kind: 'hook' | 'extend';
  /** cut seconds */
  at: number; end: number; lead: number; narrAt: number; narrEnd: number;
  /** the caption: whole sentences of the beat's body; each word's time is in cut seconds */
  text: string; sentences: number; of: number; words: CutWord[];
  /** the popup card's words (the story's own) and when it comes in */
  card: { title: string; chips: string[]; note: string | null; agent: string | null; app: string | null; replaces: string[]; at: number };
  /** the tour's seconds this part plays (null: no bake yet, so no camera) */
  tour: { from: number; to: number; popupAt: number; rest: number } | null;
};
export type CutPlan = {
  v: 1; id: string; slug: string; member: string; name: string; archetype: string | null;
  /** ready: it can be rendered; no-bake: the family has no bake lock yet; short: under 15 s with nothing to extend it with; blocked: its words fail the copy lint (set by scripts/film/ads-lib.mts) */
  status: 'ready' | 'no-bake' | 'short' | 'blocked';
  notes: string[];
  hook: { beat: string; kind: 'title' | 'sentence'; text: string; rule: 'flagged' | 'replaces' | 'app' | 'first' };
  parts: CutPart[];
  pads: Array<{ t0: number; t1: number; to: number | 'end' }>;
  end: { t0: number; t1: number; panelAt: number };
  fps: number; frames: number; duration: number; tailS: number; endS: number;
  /** the hook beat's chips (app, replaces X) and every app a part names */
  chips: string[]; apps: Array<{ id: string; replaces: string[] }>;
  /** ids of the claims.json disclosures the end card prints */
  disclosures: string[];
  cta: { label: string; url: string };
};

type Pick = { beat: Beat; rule: CutPlan['hook']['rule'] };
const AGENT_APPS = new Set(['ci-hermes', 'ci-openclaw']);
/** does a beat name Hermes or OpenClaw (the end card then carries the attribution line, as the film's does) */
export const namesAgentRuntime = (b: Beat): boolean => !!b.agent || !!(b.app && AGENT_APPS.has(b.app.id)) || (b.with || []).some(a => AGENT_APPS.has(a));
const chipsOf = (b: Beat): string[] => (b.popup.chips || []).slice();

/** The member's beats the cut may use, in story order: those in a room or an outside chapter (not the first-run chapter, not the outro). */
export function memberBeats(story: Story, memberId: string): Beat[] {
  const kind = new Map(story.chapters.map(c => [c.id, c.kind]));
  return story.beats.filter(b => b.member === memberId && (kind.get(b.chapter) === 'room' || kind.get(b.chapter) === 'outside'));
}
/** The hook rule (see the top of this file). */
export function pickHookBeat(beats: Beat[]): Pick | null {
  const flagged = beats.find(b => b.film === true); if (flagged) return { beat: flagged, rule: 'flagged' };
  const rep = beats.find(b => b.app && b.app.replaces && b.app.replaces.length); if (rep) return { beat: rep, rule: 'replaces' };
  const app = beats.find(b => b.app); if (app) return { beat: app, rule: 'app' };
  return beats.length ? { beat: beats[0], rule: 'first' } : null;
}
/** The beat a short cut extends with: the member's next beat after the hook beat that names an app, in the hook's chapter first, then any later one. */
export function pickExtension(beats: Beat[], hook: Beat): Beat | null {
  const i = beats.findIndex(b => b.id === hook.id), later = beats.slice(i + 1).filter(b => b.app);
  return later.find(b => b.chapter === hook.chapter) || later[0] || null;
}
export function hookOf(b: Beat): CutPlan['hook'] & { text: string } {
  const title = b.popup.title.trim();
  if (wordCount(title) <= CUT.hookTitleMaxWords) return { beat: b.id, kind: 'title', text: title, rule: 'flagged' };
  return { beat: b.id, kind: 'sentence', text: sentencesOf(b.popup.body)[0] || title, rule: 'flagged' };
}

type Spec = { beat: Beat; kind: 'hook' | 'extend'; sentences: string[]; of: number };
/** The timeline of the specs with this tail and end card: the parts, the dips between them, the end card and the length in frames. */
function lay(specs: Spec[], tailS: number, endS: number, fps: number) {
  const parts: CutPart[] = [], pads: CutPlan['pads'] = [];
  let at = 0;
  specs.forEach((s, i) => {
    const text = s.sentences.join(' '), dur = estimateMs(text) / 1000, lead = i === 0 ? CUT.hookS : CUT.leadS;
    const narrAt = R3(at + lead), narrEnd = R3(narrAt + dur), end = R3(narrEnd + tailS);
    const b = s.beat;
    parts.push({
      beat: b.id, kind: s.kind, at: R3(at), end, lead, narrAt, narrEnd, text, sentences: s.sentences.length, of: s.of,
      words: wordTimes(text, dur).map(w => ({ text: w.text, s: R3(narrAt + w.s), e: R3(narrAt + w.e) })),
      card: { title: b.popup.title, chips: chipsOf(b), note: b.popup.note || null, agent: b.agent || null, app: b.app ? b.app.id : null, replaces: b.app ? b.app.replaces || [] : [], at: R3(at + (i === 0 ? CUT.hookS : CUT.cardGapS)) },
      tour: null,
    });
    pads.push({ t0: end, t1: R3(end + CUT.padS), to: i + 1 < specs.length ? i + 1 : 'end' });
    at = R3(end + CUT.padS);
  });
  const total = at + endS, frames = Math.max(2, Math.ceil(total * fps - 1e-9)), duration = frames / fps;
  return { parts, pads, end: { t0: at, t1: R3(duration), panelAt: R3(at + 0.2) }, frames, duration, total };
}

/** The cuts of a family: one per member with a beat to tell. `times`: the bake's beat times (null: no bake lock yet). */
export function planFamilyCuts(story: Story, times: Record<string, BeatTimes> | null = null, fps: number = CUT.fps): { cuts: CutPlan[]; skipped: Array<{ member: string; why: string }> } {
  const cuts: CutPlan[] = [], skipped: Array<{ member: string; why: string }> = [];
  for (const m of story.members) {
    if (!m.archetype) { skipped.push({ member: m.id, why: 'no archetype (no persona to tell)' }); continue; }
    const beats = memberBeats(story, m.id), pick = pickHookBeat(beats);
    if (!pick) { skipped.push({ member: m.id, why: 'no beat in a room or outside chapter' }); continue; }
    const notes: string[] = [];
    if (pick.rule !== 'flagged') notes.push(`no beat of ${m.name}'s is flagged "film": the hook beat is ${pick.beat.id}, the first with ${pick.rule === 'replaces' ? 'a replaces name' : pick.rule === 'app' ? 'an app' : 'a place in the tour'}`);
    const hook = { ...hookOf(pick.beat), rule: pick.rule };
    const all0 = sentencesOf(pick.beat.popup.body);
    const specs: Spec[] = [{ beat: pick.beat, kind: 'hook', sentences: all0, of: all0.length }];
    let tail = CUT.tailS, end = CUT.endS, L = lay(specs, tail, end, fps);
    const stretch = (): boolean => {
      // a cut a little short reaches the minimum by holding the last words and the end card longer; nothing else moves
      const need = CUT.minS - L.duration;
      if (need <= 0) return true;
      const e = Math.min(need, CUT.endMaxS - end), t = Math.min(need - e, CUT.tailMaxS - tail);
      end += e; tail += t; L = lay(specs, tail, end, fps);
      return L.duration >= CUT.minS - 1e-9;
    };
    if (L.duration > CUT.maxS) {
      // over: drop the body's last sentences until it fits (at least one stays)
      while (specs[0].sentences.length > 1 && L.duration > CUT.maxS) { specs[0].sentences = specs[0].sentences.slice(0, -1); L = lay(specs, tail, end, fps); }
      notes.push(`the caption keeps ${specs[0].sentences.length} of ${all0.length} sentences to stay within ${CUT.maxS} s`);
    } else if (L.duration < CUT.minS && !stretch()) {
      const ext = pickExtension(beats, pick.beat);
      if (ext) {
        const ss = sentencesOf(ext.popup.body);
        tail = CUT.tailS; end = CUT.endS;
        specs.push({ beat: ext, kind: 'extend', sentences: ss.slice(0, 1), of: ss.length }); L = lay(specs, tail, end, fps);
        // as many whole sentences as the cut can hold, at least the first
        let n = 1;
        for (let q = 1; q <= ss.length; q++) { specs[1].sentences = ss.slice(0, q); if (lay(specs, tail, end, fps).duration <= CUT.maxS) n = q; else break; }
        specs[1].sentences = ss.slice(0, n); L = lay(specs, tail, end, fps);
        notes.push(`${pick.beat.id} alone is under ${CUT.minS} s: the cut goes on to ${ext.id} (${specs[1].sentences.length} of ${ss.length} sentences)`);
        stretch();
      } else notes.push(`${pick.beat.id} alone is ${L.duration.toFixed(1)} s and ${m.name} has no later beat that names an app: the cut stays under ${CUT.minS} s`);
    }
    const parts = L.parts;
    // the camera: the tour's seconds each part plays, from the bake. A part cuts in `lead` seconds before the camera settles (never before its beat begins)
    let status: CutPlan['status'] = times ? 'ready' : 'no-bake';
    if (times) {
      for (const p of parts) {
        const t = times[p.beat];
        if (!t) { status = 'no-bake'; notes.push(`the bake lock has no times for ${p.beat}`); break; }
        // the hook is the camera's last seconds before it settles on the subject (the cut has no voice to wait for, so the captions begin as the camera arrives)
        const arrive = t.travel ? t.travel[1] : t.t0, from = R3(Math.max(t.t0, arrive - p.lead)), to = R3(Math.max(from + 0.5, Math.min(t.t1 - 0.002, from + (p.end - p.at))));
        p.tour = { from, to, popupAt: t.popupAt, rest: t.rest };
        // the card comes in as the camera settles, and never before the hook has gone
        p.card.at = R3(Math.min(Math.max(p.card.at, p.at + (t.popupAt - from)), p.narrAt + CUT.cardLateS));
      }
    }
    if (L.duration < CUT.minS - 1e-9) status = 'short';
    const apps = parts.filter(p => p.card.app).map(p => ({ id: p.card.app!, replaces: p.card.replaces }));
    const used = parts.map(p => specs.find(s => s.beat.id === p.beat)!.beat);
    const disclosures = ['fictional-family', 'scripted-scenes', 'stylised-art'];
    if (parts.some(p => p.card.replaces.length)) disclosures.push('names-owners');
    if (used.some(namesAgentRuntime)) disclosures.push('attribution-agents');
    cuts.push({
      v: 1, id: `${story.slug}-${m.id}`, slug: story.slug, member: m.id, name: m.name, archetype: m.archetype, status, notes,
      hook: { beat: hook.beat, kind: hook.kind, text: hook.text, rule: pick.rule },
      parts, pads: L.pads, end: L.end, fps, frames: L.frames, duration: L.duration, tailS: R3(tail), endS: R3(end),
      chips: chipsOf(pick.beat), apps, disclosures,
      cta: { label: story.closing.cta.label, url: story.closing.cta.url },
    });
  }
  return { cuts, skipped };
}

// ---- the clock ------------------------------------------------------------------------------------------------------------------------------
export type CutScene =
  | { kind: 'part'; part: number; ft: number; tour: number }
  | { kind: 'pad'; pad: number; ft: number; tour: number; dip: number; shows: { part: number } | { end: true } }
  | { kind: 'end'; ft: number; tour: number; k: number };

/** The tour second part `i` is at at cut second `ft`: its own clock from where it cut in, held at the last second it plays. */
export function tourIn(plan: CutPlan, i: number, ft: number): number {
  const p = plan.parts[i]; if (!p.tour) return 0;
  return Math.max(p.tour.from, Math.min(p.tour.to, p.tour.from + (ft - p.at)));
}
/** Where the cut is at second `ft`: which scene, and which second of the tour the camera is at. `establish` is the seconds of the tour's first moves the end card plays back. */
export function sceneAt(plan: CutPlan, ft: number, establish: number): CutScene {
  if (ft >= plan.end.t0) { const k = Math.min(1, Math.max(0, (ft - plan.end.t0) / Math.max(1e-6, plan.end.t1 - plan.end.t0))); return { kind: 'end', ft, tour: establish * (1 - k), k }; }
  for (let n = 0; n < plan.pads.length; n++) {
    const pd = plan.pads[n];
    if (ft >= pd.t0 && ft < pd.t1) {
      const k = (ft - pd.t0) / (pd.t1 - pd.t0), dip = 1 - Math.abs(2 * k - 1), first = k < 0.5;
      const shows = first ? { part: n } : pd.to === 'end' ? { end: true as const } : { part: pd.to as number };
      const tour = first ? (plan.parts[n].tour ? plan.parts[n].tour!.to : 0) : pd.to === 'end' ? establish : (plan.parts[pd.to as number].tour?.from ?? 0);
      return { kind: 'pad', pad: n, ft, tour, dip, shows };
    }
  }
  let pi = 0;
  for (let i = 0; i < plan.parts.length; i++) if (plan.parts[i].at <= ft + 1e-9) pi = i;
  return { kind: 'part', part: pi, ft, tour: tourIn(plan, pi, ft) };
}

/** the hook's opacity at ft: in from the first frame (a still of frame 0 carries the words), out over hookFadeS before the card comes in */
export const hookAlpha = (ft: number, hookS: number = CUT.hookS): number => Math.max(0, Math.min(1, (hookS - 0.1 - ft) / CUT.hookFadeS));
