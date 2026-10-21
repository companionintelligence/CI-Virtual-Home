// The film, in the page. scripts/render-family-film.mts opens a house in the EDITOR page (not the player), imports this module, and asks it for frame i:
//
//   const F = await import('/assets/story/film/index.js');
//   const info = await F.prepare({ rs, format: '16x9', res: 1080, ... });     // registers the film's camera as a shot preset and begins an offline render
//   const jpg = F.frame(i)                                                       // base64 JPEG of frame i, the 3D picture with the overlay drawn on it
//   F.end()
//
// The camera is the live tour's: trackFrameAt (assets/story/track.ts) read at the second of the tour each film second plays, through the same
// `applySplineFrame` / `__houseRenderFrames` path every product film in this repo uses, so a film frame is a pure function of the tree and of i
// (random access; nothing carries over from the frame before). The overlay is Canvas2D drawn over the WebGL canvas right after it renders.
//
// Story mode never touches the editor or the offline path: nothing imports this file but the film script, and it only calls the page's own hooks
// (__houseDebug, __houseShotWorld, __houseRenderBegin, __houseRenderFrames, __houseRenderEnd). Owner: video-tool.
import type { RuntimeStory, RuntimeBeat } from '../runtime.js';
import type { StoryTrack } from '../track.js';
import { trackFrameAt } from '../track.js';
import { focusRect, leaderTo, type Rect } from '../place.js';
import { planDoors } from '../../shot-doors.js';
import { FILM, filmClock, silentStory, sceneAt, powerForFilm, audioPlacements, captionCues, placeForFilm, formatFor, cardAlpha, ramp, badgeBox, captionBox, canvasCardWidths, canvasVariants, type FilmClock, type FilmFormat, type FilmKey, type Cue, type Placement, type FilmPlace, type Scene } from './layout.js';
import { measureCard, drawCard, drawTitle, drawEnd, WEIGHTS, font, nativeTracking, auditType, type TypeAudit, type CardLayout, type CardModel, type TitleModel, type EndModel, type Ctx } from './cards.js';
import { drawBadge, drawCaption, drawLeader, drawDip, cueAt } from './overlay.js';

export type PrepareOpts = {
  rs: RuntimeStory;
  format: FilmKey;
  res?: number;
  /** the strings the film prints that are not in the family's file (claims.json), chosen by the script */
  title: TitleModel;
  end: EndModel;
  badge: string;
  /** a silent film: the clock and the captions come from the estimated durations (layout.ts silentStory); there is no sound under it */
  silent?: boolean;
};
type BeatPlan = { layout: CardLayout; place: FilmPlace; narr: Placement | null; focus: Rect | null; core: Rect | null; variant: number; tag: string };
type State = {
  rs: RuntimeStory; f: FilmFormat; clock: FilmClock; cues: Cue[]; placements: Placement[];
  g: Ctx; cv: HTMLCanvasElement; gl: HTMLCanvasElement; plans: Map<number, BeatPlan>;
  title: TitleModel; end: EndModel; badge: string; key: string; frames: number; last: number; audit: TypeAudit;
  /** the luma mean and spread of the room in the last frame drawn, before the overlay (a blank render has no spread, whatever the overlay says) */
  probe: Ctx; stats: { mean: number; std: number };
};
let S: State | null = null;
const W: any = window;

function modelOf(rs: RuntimeStory, b: RuntimeBeat): CardModel {
  const m = b.member ? rs.members.find(x => x.id === b.member) : null, a = b.agent ? rs.members.find(x => x.id === b.agent) : null;
  const ch = rs.chapters.find(c => c.id === b.chapter);
  return {
    member: m ? { name: m.name, colour: m.colour } : null,
    companion: a && a.companion ? a.companion.name : null,
    chapter: ch ? ch.title : '',
    title: b.popup.title, chips: b.popup.chips || [], note: b.popup.note || null,
    phone: b.popup.kind === 'phone' && b.popup.phone ? { header: b.popup.phone.header, rows: b.popup.phone.rows } : null,
  };
}

/** The film as a shot preset in the page's own vocabulary (compare presetFromStory in assets/story/runtime.ts): a frameAt that is a pure function of the
 *  progress 0..1, with the roof, the doors and the Core's power laid out over the FILM's seconds instead of the tour's. */
export function presetFromFilm(THREE: any, rs: RuntimeStory, clock: FilmClock, world: any) {
  const track: StoryTrack = rs.track, V = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);
  const at = (ft: number, aspect: number) => trackFrameAt(track, sceneAt(clock, ft).tour, aspect);
  const eyePoints: any[] = [], targetPoints: any[] = [];
  for (let ft = 0; ft < clock.span; ft += 0.25) { const f = at(ft, 16 / 9); eyePoints.push(V(f.eye)); targetPoints.push(V(f.target)); }
  { const f = at(clock.span, 16 / 9); eyePoints.push(V(f.eye)); targetPoints.push(V(f.target)); }
  const N = Math.max(2, Math.round(clock.span * 30) + 1), roof = new Float32Array(N), pos = new Float32Array(3 * N);
  for (let j = 0; j < N; j++) { const f = at(j / (N - 1) * clock.span, 16 / 9); roof[j] = f.roofAlpha; pos[3 * j] = f.eye[0]; pos[3 * j + 1] = f.eye[1]; pos[3 * j + 2] = f.eye[2]; }
  const doors: Record<string, Float32Array> = world && (world.doors || []).length ? planDoors(world, pos, N, clock.span / (N - 1)) : {};
  const preset: any = {
    type: 'story', planner: 'v2', name: 'Family film', dressing: { walls: 'up', roof: 'auto' }, duration: clock.frames / clock.fps, closed: false,
    eyePoints, targetPoints, track: { samples: N, roofAlpha: roof, doors }, beats: [],
    events: { enterT: Infinity, stairT: [], pressT: null, settleT: null, doneT: clock.span, firstCoreT: null },
    power: powerForFilm(clock, track.events.press, track.events.ramp), enterT: Infinity, orbit: null,
  };
  preset.frameAt = (u: number, aspect = 16 / 9) => {
    const f = at(Math.max(0, Math.min(1, u)) * clock.span, aspect);
    return { s: u, u, eye: V(f.eye), target: V(f.target), fov: f.fov, roofAlpha: f.roofAlpha, beat: f.beat };
  };
  return preset;
}

/** Load the fonts the overlay draws with: a canvas does not wait for a face it has not used yet, and the first frame would be drawn in the fallback. */
async function loadFonts(sample = '') {
  await Promise.all(WEIGHTS.map(w => (document as any).fonts.load(font(w, 32), `Aa Hh 0123 UnCloud ${sample} ${sample.toUpperCase()}`)));
  await (document as any).fonts.ready;
  for (const w of WEIGHTS) if (!(document as any).fonts.check(font(w, 32))) throw new Error(`Manrope ${w} did not load`);
}

export async function prepare(o: PrepareOpts) {
  if (S) end();
  const rs = o.silent ? silentStory(o.rs) : o.rs, res = o.res ?? 1080, f = formatFor(o.format, res), clock = filmClock(rs, { silent: !!o.silent });
  await loadFonts([o.badge, o.title.heading, o.title.address, o.title.tagline, o.end.signoff, ...o.end.lines, ...rs.members.map(m => m.name)].join(' '));
  const { placements, problems } = audioPlacements(rs, clock);
  if (problems.length) throw new Error(`audio does not fit the film: ${problems.join('; ')}`);
  const names: Record<string, string> = {}; for (const m of rs.members) names[m.id] = m.companion ? m.companion.name : m.name;
  const cues = captionCues(rs, placements, names);
  const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h;
  const g = cv.getContext('2d', { alpha: false })!, audit = auditType(g, f.k);
  const dbg = W.__houseDebug(), THREE = W.__THREE;
  const key = `house:${dbg.house.id}:film-${o.format}`;
  dbg.presets[key] = presetFromFilm(THREE, rs, clock, W.__houseShotWorld());
  const info = W.__houseRenderBegin({ shot: key, res: String(res), aspect: o.format === '16x9' ? '16:9' : '9:16', fps: clock.fps });
  if (info.w !== f.w || info.h !== f.h || info.frames !== clock.frames) throw new Error(`the page rendered ${info.w}x${info.h} x ${info.frames}, the film wants ${f.w}x${f.h} x ${clock.frames}`);
  // each flagged beat's card: measured once, placed once against the beat's rest pose (never per frame, so a card cannot swap sides while the camera settles).
  // The card is offered as variants (its width and tighter padding, narrower and so taller, the phone screen left out), never in smaller type: the solver refuses a
  // variant under the 36 design px floor and takes the first that clears the subject (layout.ts placeCanvasCard).
  const plans = new Map<number, BeatPlan>();
  g.save(); g.font = font(700, badgeBox(f, 0).font); const badgeW = g.measureText(o.badge).width; g.restore();
  for (const p of clock.parts) {
    const b = rs.beats[p.idx], model = modelOf(rs, b);
    const fr = trackFrameAt(rs.track, b.rest, f.aspect);
    const focus = focusRect(fr.eye, fr.target, fr.fov, b.frame.box as any, f.w, f.h);
    const core = rs.track.core ? focusRect(fr.eye, fr.target, fr.fov, rs.track.core as any, f.w, f.h) : null;
    const widths = f.portrait ? [f.w - f.safe.left - f.safe.right] : canvasCardWidths(f);
    const vars = canvasVariants(widths, (w, tight, bare) => measureCard(g, model, f, w, tight, bare), { bare: !!model.phone });
    const place = placeForFilm(f, { focus, core, card: vars[0].size, variants: vars.map(v => v.size), badgeW });
    plans.set(p.idx, { layout: vars[place.variant].layout, place, narr: placements.find(x => x.id === b.id) || null, focus, core, variant: place.variant, tag: vars[place.variant].size.tag || '' });
  }
  // nothing may sit outside the safe area (a portrait film keeps clear of the bands a phone's own interface covers), and a card has to fit the room it was given:
  // a canvas cannot scroll. The end card is measured here once, at no opacity.
  const inside = (r: Rect) => r.x >= f.safe.left - 1 && r.y >= f.safe.top - 1 && r.x + r.w <= f.w - f.safe.right + 1 && r.y + r.h <= f.h - f.safe.bottom + 1;
  const endRect = drawEnd(g, f, o.end, 0), cb = captionBox(f), unsafe: string[] = [];
  for (const p of clock.parts) { const pl = plans.get(p.idx)!; if (!inside(pl.place.rect) || pl.layout.h > pl.place.rect.h + 1) unsafe.push(`card ${p.id}`); }
  if (!inside(endRect)) unsafe.push('end card');
  if (!inside(cb)) unsafe.push('captions');
  const pc = document.createElement('canvas'); pc.width = 64; pc.height = Math.max(8, Math.round(64 * f.h / f.w));
  S = { rs, f, clock, cues, placements, g, cv, gl: dbg.renderer.domElement, plans, title: o.title, end: o.end, badge: o.badge, key, frames: clock.frames, last: -1, audit, probe: pc.getContext('2d', { willReadFrequently: true })! as Ctx, stats: { mean: 0, std: 0 } };
  return {
    silent: !!o.silent,
    w: f.w, h: f.h, fps: clock.fps, frames: clock.frames, duration: clock.duration,
    placements: placements.map(p => ({ id: p.id, kind: p.kind, atS: p.atS, durS: p.durS, endS: p.endS, file: p.clip.file, sha256: p.clip.sha256 })),
    cues: cues.map(c => ({ start: c.start, end: c.end, text: c.text, speaker: c.speaker, clip: c.clip, words: c.words })),
    clock: { title: clock.title, parts: clock.parts, pads: clock.pads, outro: clock.outro, establish: clock.establish, frames: clock.frames, span: clock.span },
    // the card placements the picture uses: for the QA report (a card that covers its subject is a defect to look at)
    cards: clock.parts.map(p => { const pl = plans.get(p.idx)!; return { id: p.id, slot: pl.place.slot, rect: pl.place.rect, ok: pl.place.ok, variant: pl.variant, tag: pl.tag, type: +pl.layout.type.toFixed(2), height: pl.layout.h, overlapFocus: +pl.place.overlapFocus.toFixed(4), overlapCore: +pl.place.overlapCore.toFixed(4), overlapBars: +pl.place.overlapBars.toFixed(4), alt: pl.place.alt, focus: pl.focus, core: pl.core }; }),
    end: endRect, unsafe, poster: Math.round(FILM.posterS * clock.fps), tracking: nativeTracking(g) ? 'letterSpacing' : 'glyph by glyph',
  };
}

/** Frame i: render the scene, draw the overlay over it, return a base64 JPEG. */
export function frame(i: number, quality = 0.95): string {
  const st = S; if (!st) throw new Error('prepare() first');
  const { f, clock, g, cv, gl } = st;
  W.__houseRenderFrames(i, 1, null);                         // draws the 3D frame (and the page's own composer) onto the WebGL canvas
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  g.drawImage(gl, 0, 0, f.w, f.h);
  st.stats = lumaStats(st);                                  // the room alone, before the overlay
  const ft = i / clock.fps, sc = sceneAt(clock, ft);
  drawScene(st, sc, ft);
  st.last = i;
  return cv.toDataURL('image/jpeg', quality).slice(23);
}

function lumaStats(st: State): { mean: number; std: number } {
  const p = st.probe, w = p.canvas.width, h = p.canvas.height;
  p.drawImage(st.cv, 0, 0, st.f.w, st.f.h, 0, 0, w, h);
  const d = p.getImageData(0, 0, w, h).data; let sum = 0, sq = 0; const n = w * h;
  for (let i = 0; i < d.length; i += 4) { const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; sum += y; sq += y * y; }
  const mean = sum / n; return { mean: +mean.toFixed(2), std: +Math.sqrt(Math.max(0, sq / n - mean * mean)).toFixed(2) };
}
/** The luma mean and standard deviation (0 to 255) of the room in the last frame drawn, before the overlay: the renderer checks the first frame for a spread (the GPU path that draws nothing). */
export function stats(): { mean: number; std: number } { return S ? S.stats : { mean: 0, std: 0 }; }

/** The smallest type painted so far, in design units (the floor is 36), the string it was painted for and every size drawn: the render fails the floor on what was painted. */
export function typeAudit(): TypeAudit { return S ? S.audit : { min: Infinity, text: '', sizes: {}, drawn: 0 }; }

/** The last frame drawn, scaled to `width` pixels across, as a base64 JPEG (the poster). Call straight after frame(). */
export function posterOf(width: number, quality = 0.82): string {
  const st = S!, h = Math.round(width * st.f.h / st.f.w), c = document.createElement('canvas'); c.width = width; c.height = h;
  const g = c.getContext('2d', { alpha: false })!; g.imageSmoothingQuality = 'high'; g.drawImage(st.cv, 0, 0, width, h);
  return c.toDataURL('image/jpeg', quality).slice(23);
}

function drawScene(st: State, sc: Scene, ft: number) {
  const { f, clock, g, rs } = st;
  const shows = sc.kind === 'pad' ? sc.shows : sc.kind;
  const tourFrame = trackFrameAt(rs.track, sc.tour, f.aspect);
  if (shows === 'title') {
    drawTitle(g, f, st.title, ft, 1);
  } else if (shows === 'part') {
    const part = clock.parts[sc.kind === 'part' || sc.kind === 'pad' ? sc.part : 0], plan = st.plans.get(part.idx)!, b = rs.beats[part.idx];
    drawBadge(g, f, st.badge, 1);
    // the card: in from where the tour puts the popup (popupAt), out a moment before the part ends
    const cardFrom = part.at + Math.max(0, b.popupAt - part.from);
    const a = cardAlpha(ft, cardFrom, part.end);
    const rect = plan.place.rect, lay = plan.layout;
    const rise = (1 - Math.min(1, Math.max(0, (ft - cardFrom) / 0.3))) * 14 * f.k;
    if (a > 0.002) {
      const progress = plan.narr ? Math.max(0, Math.min(1, (ft - plan.narr.atS) / plan.narr.durS)) : 1;
      // the leader points at where the subject is NOW (the camera still drifts a little); the card stays where it was placed
      const fo = focusRect(tourFrame.eye, tourFrame.target, tourFrame.fov, b.frame.box as any, f.w, f.h);
      if (fo) {
        if (plan.place.mode === 'card') { const l = leaderTo(rect, fo); drawLeader(g, f, l.from, l.to, a, ft); }
        else drawLeader(g, f, null, [fo.x + fo.w / 2, fo.y + fo.h / 2], a, ft);
      }
      drawCard(g, lay, rect.x, rect.y + rise, a, progress);
    }
    drawCaption(g, f, cueAt(st.cues, ft), ft);
  } else {
    // the end card: the exterior pulls back under the closing words; the panel comes in when the voice is done
    const pa = ramp(ft, clock.outro.panelAt, clock.outro.panelAt + 0.5);
    if (pa < 0.01) { drawBadge(g, f, st.badge, 1); }
    if (ft < clock.outro.panelAt) drawCaption(g, f, cueAt(st.cues, ft), ft);
    drawEnd(g, f, st.end, pa);
  }
  if (sc.kind === 'pad') drawDip(g, f, sc.dip);
}

export function end() {
  if (!S) return;
  try { W.__houseRenderEnd(); } catch { /* the page may already have closed it */ }
  S = null;
}
