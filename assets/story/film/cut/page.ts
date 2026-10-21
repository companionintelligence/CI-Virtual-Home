// The persona cut, in the page. scripts/render-persona-cuts.mts opens a house in the EDITOR page (not the player), imports this module and asks it for frame i:
//
//   const F = await import('/assets/story/film/cut/page.js');
//   const info = await F.prepare({ rs, plan, key: '9x16', res: 1080, end, badge });   // registers the cut's camera as a shot preset and begins an offline render
//   const jpg = F.frame(i);                                                           // base64 JPEG of frame i: the room with the overlay drawn on it
//   F.stats();                                                                        // the luma mean and spread of the room in that frame, before the overlay
//   F.end()
//
// The camera is the live tour's: trackFrameAt (assets/story/track.ts) read at the second of the tour each cut second plays, through the same `applySplineFrame` /
// `__houseRenderFrames` path every product film in this repo uses, so a frame is a pure function of the tree and of i (random access; nothing carries over from
// the frame before). The overlay is Canvas2D drawn over a copy of the WebGL canvas, cropped to the cut's frame (4:5 is the middle 80 % of a square render).
//
// This file is the film's cousin (assets/story/film/index.ts) and does not touch it: the film's exports, the editor page, the player and the goldens are as they were.
// Owner: ad-kit.
import type { RuntimeStory } from '../../runtime.js';
import type { StoryTrack } from '../../track.js';
import { trackFrameAt } from '../../track.js';
import { focusRect, leaderTo, type Rect } from '../../place.js';
import { planDoors } from '../../../shot-doors.js';
import { establishSeconds, ramp, cardAlpha, canvasCardWidths, canvasVariants } from '../layout.js';
import { cutFormat, placeForCut, sceneAt, cutCues, cutCaptionChars, hookAlpha, cutCaptionBox, type CutPlan, type CutKey, type CutFormat, type CutPlace } from './plan.js';
import { font, auditType, nativeTracking, FLOOR, type TypeAudit } from '../cards.js';
import {
  WEIGHTS, drawCutBadge, badgeTextWidth, measureHook, hookSizes, drawHook, measureCard, drawCard, drawCaption, cueAt, drawLeader, drawDip, drawCutEnd,
  type HookLayout, type CardLayout, type CardModel, type EndModel,
} from './draw.js';

export type CutPrepare = { rs: RuntimeStory; plan: CutPlan; key: CutKey; res?: number; end: EndModel; badge: string };
type PartPlan = { layout: CardLayout; place: CutPlace; focus: Rect | null; core: Rect | null; variant: number; tag: string };
type Stats = { mean: number; std: number };
type State = {
  rs: RuntimeStory; plan: CutPlan; f: CutFormat; E: number; cues: ReturnType<typeof cutCues>;
  g: CanvasRenderingContext2D; cv: HTMLCanvasElement; gl: HTMLCanvasElement; probe: CanvasRenderingContext2D;
  parts: PartPlan[]; hook: { layout: HookLayout; place: CutPlace; focus: Rect | null };
  end: EndModel; badge: string; frames: number; stats: Stats; audit: TypeAudit;
};
let S: State | null = null;
const W: any = window;

/** The cut as a shot preset in the page's own vocabulary (compare presetFromFilm in index.ts and presetFromStory in assets/story/runtime.ts): a frameAt that is a pure
 *  function of the progress 0..1, with the roof and the doors laid out over the cut's seconds. The Core is on in every room of the tour (it was woken in the first-run chapter). */
export function presetFromCut(THREE: any, rs: RuntimeStory, plan: CutPlan, f: CutFormat, E: number, world: any) {
  const track: StoryTrack = rs.track, V = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);
  const span = (plan.frames - 1) / plan.fps, at = (ft: number) => trackFrameAt(track, sceneAt(plan, ft, E).tour, f.compose);
  const eyePoints: any[] = [], targetPoints: any[] = [];
  for (let ft = 0; ft < span; ft += 0.25) { const q = at(ft); eyePoints.push(V(q.eye)); targetPoints.push(V(q.target)); }
  { const q = at(span); eyePoints.push(V(q.eye)); targetPoints.push(V(q.target)); }
  const N = Math.max(2, Math.round(span * 30) + 1), roof = new Float32Array(N), pos = new Float32Array(3 * N);
  for (let j = 0; j < N; j++) { const q = at(j / (N - 1) * span); roof[j] = q.roofAlpha; pos[3 * j] = q.eye[0]; pos[3 * j + 1] = q.eye[1]; pos[3 * j + 2] = q.eye[2]; }
  const doors: Record<string, Float32Array> = world && (world.doors || []).length ? planDoors(world, pos, N, span / (N - 1)) : {};
  const preset: any = {
    type: 'story', planner: 'v2', name: 'Persona cut', dressing: { walls: 'up', roof: 'auto' }, duration: plan.frames / plan.fps, closed: false,
    eyePoints, targetPoints, track: { samples: N, roofAlpha: roof, doors }, beats: [],
    events: { enterT: Infinity, stairT: [], pressT: null, settleT: null, doneT: span, firstCoreT: null },
    power: { at: -1 }, enterT: Infinity, orbit: null,
  };
  // the camera is composed for the cut's own frame (f.compose), whatever the page renders: for 4:5 the page renders a square and the cut is its middle
  preset.frameAt = (u: number, _aspect = 16 / 9) => {
    const q = at(Math.max(0, Math.min(1, u)) * span);
    return { s: u, u, eye: V(q.eye), target: V(q.target), fov: q.fov, roofAlpha: q.roofAlpha, beat: q.beat };
  };
  return preset;
}

/** Load the faces the overlay draws with: a canvas does not wait for a face it has not used yet, and the first frame would be drawn in the fallback. `sample` is every string the
 *  cut prints (the name's capitals included), so a letter outside the basic Latin set loads its own piece of the face too. */
async function loadFonts(sample = '') {
  await Promise.all(WEIGHTS.map(w => (document as any).fonts.load(font(w, 32), `Aa Hh 0123 See Companion Core ${sample} ${sample.toUpperCase()}`)));
  await (document as any).fonts.ready;
  for (const w of WEIGHTS) if (!(document as any).fonts.check(font(w, 32))) throw new Error(`Manrope ${w} did not load`);
}

const inside = (r: Rect, f: CutFormat) => r.x >= f.safe.left - 1 && r.y >= f.safe.top - 1 && r.x + r.w <= f.w - f.safe.right + 1 && r.y + r.h <= f.h - f.safe.bottom + 1;

export async function prepare(o: CutPrepare) {
  if (S) end();
  const rs = o.rs, plan = o.plan, f = cutFormat(o.key, o.res ?? 1080);
  if (plan.status !== 'ready') throw new Error(`${plan.id}: the plan is ${plan.status}, not ready`);
  await loadFonts([o.badge, plan.name, plan.hook.text, ...o.end.lines, o.end.cta, o.end.url, ...plan.parts.flatMap(p => [p.card.title, p.card.note || '', ...p.card.chips, p.text])].join(' '));
  const E = establishSeconds(rs), cues = cutCues(plan.parts, cutCaptionChars(o.key));
  const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h;
  const g = cv.getContext('2d', { alpha: false })!, audit = auditType(g, f.k);
  const pc = document.createElement('canvas'); pc.width = 32; pc.height = Math.max(8, Math.round(32 * f.h / f.w));
  const probe = pc.getContext('2d', { willReadFrequently: true })!;
  const dbg = W.__houseDebug(), THREE = W.__THREE;
  const key = `house:${dbg.house.id}:cut-${plan.id}-${o.key}`;
  dbg.presets[key] = presetFromCut(THREE, rs, plan, f, E, W.__houseShotWorld());
  const info = W.__houseRenderBegin({ shot: key, res: f.page.res, aspect: f.page.aspect, fps: plan.fps });
  if (info.w !== f.page.w || info.h !== f.page.h || info.frames !== plan.frames) throw new Error(`the page rendered ${info.w}x${info.h} x ${info.frames}, the cut wants ${f.page.w}x${f.page.h} x ${plan.frames}`);
  // each part's card: measured once, placed once against the beat's rest pose (never per frame, so a card cannot swap sides while the camera settles)
  const badgeW = badgeTextWidth(g, f, o.badge), parts: PartPlan[] = [];
  const subject = (part: CutPlan['parts'][0]) => {
    const b = rs.beats.find(x => x.id === part.beat)!, fr = trackFrameAt(rs.track, part.tour!.rest, f.compose);
    return { b, fr, focus: focusRect(fr.eye, fr.target, fr.fov, b.frame.box as any, f.w, f.h), core: rs.track.core ? focusRect(fr.eye, fr.target, fr.fov, rs.track.core as any, f.w, f.h) : null };
  };
  /** the room beside a subject, on the side that has more, inside the safe area (the hook goes there when the frame is not a sheet) */
  const freeSide = (focus: Rect | null) => { const gap = 18 * f.k; return focus ? Math.max(focus.x - f.safe.left - gap, f.w - f.safe.right - (focus.x + focus.w) - gap) : f.w - f.safe.left - f.safe.right; };
  for (const part of plan.parts) {
    const { b, focus, core } = subject(part), agent = b.agent ? rs.members.find(m => m.id === b.agent) : null;
    const model: CardModel = { name: plan.name, companion: agent && agent.companion ? agent.companion.name : null, title: part.card.title, chips: part.card.chips, note: part.card.note };
    // the card is offered as variants, never in smaller type: a sheet frame's card is the safe width (its padding as designed, then tighter); beside the subject it is the card's wanted
    // width (about a third of the canvas, never narrower than 18 em of the 36 px floor), then 90 and 80 % of it, each with both paddings. The solver takes the first that clears the subject.
    const widths = f.sheet ? [f.w - f.safe.left - f.safe.right] : canvasCardWidths(f);
    const vars = canvasVariants(widths, (w, tight) => measureCard(g, model, f, w, tight));
    const place = placeForCut(f, { focus, core, card: vars[0].size, variants: vars.map(v => v.size), badgeW });
    parts.push({ layout: vars[place.variant].layout, place, focus, core, variant: place.variant, tag: vars[place.variant].size.tag || '' });
  }
  // the hook: the member and the title, big, where the first part's card will sit
  const first = subject(plan.parts[0]), cw = canvasCardWidths(f), hw = f.sheet ? f.w - f.safe.left - f.safe.right : Math.max(cw[cw.length - 1], Math.min(freeSide(first.focus), (f.key === '1x1' ? 760 : 900) * f.k));
  // the hook is offered at each size its title takes (the biggest first, none under 42): the placer takes the biggest that keeps off the subject
  const hvars: Array<{ layout: HookLayout; size: { w: number; h: number; type: number; cost: number; tag: string } }> = [];
  hookSizes(f).forEach((cap, i) => { const L = measureHook(g, { name: plan.name, text: plan.hook.text }, f, hw, cap); if (!hvars.some(v => Math.abs(v.layout.px - L.px) < 1e-6 && v.layout.h === L.h)) hvars.push({ layout: L, size: { w: L.w, h: L.h, type: L.type, cost: hvars.length * 0.05, tag: `${(L.px / f.k).toFixed(0)}` } }); });
  const hplace = placeForCut(f, { focus: first.focus, core: first.core, card: hvars[0].size, variants: hvars.map(v => v.size), badgeW }), hl = hvars[hplace.variant].layout;
  const hook = { layout: hl, place: hplace, focus: first.focus };
  // the end card's rectangle (drawn once at no opacity to measure it)
  const endRect = drawCutEnd(g, f, o.end, 0);
  const cap = cutCaptionBox(f);
  // nothing may sit outside the safe area, and a card has to fit the room it was given: a canvas cannot scroll
  const unsafe: string[] = [];
  parts.forEach((p, i) => { if (!inside(p.place.rect, f) || p.layout.h > p.place.rect.h + 1) unsafe.push(`card ${plan.parts[i].beat}`); });
  if (!inside(hook.place.rect, f) || hl.h > hook.place.rect.h + 1) unsafe.push('hook');
  if (!inside(endRect, f)) unsafe.push('end card');
  if (!inside(cap, f)) unsafe.push('captions');
  S = { rs, plan, f, E, cues, g, cv, gl: dbg.renderer.domElement, probe, parts, hook, end: o.end, badge: o.badge, frames: plan.frames, stats: { mean: 0, std: 0 }, audit };
  const place = (p: CutPlace, extra: object) => ({ slot: p.slot, rect: p.rect, ok: p.ok, overlapFocus: +p.overlapFocus.toFixed(4), overlapCore: +p.overlapCore.toFixed(4), overlapBars: +p.overlapBars.toFixed(4), alt: p.alt, variant: p.variant, refused: p.refused, ...extra });
  return {
    page: f.page, canvas: { w: f.w, h: f.h }, out: f.out, crop: f.crop, k: f.k, safe: f.safe, fps: plan.fps, frames: plan.frames, duration: plan.duration, floor: FLOOR * f.k,
    tracking: nativeTracking(g) ? 'letterSpacing' : 'glyph by glyph',
    cards: parts.map((p, i) => place(p.place, { beat: plan.parts[i].beat, tag: p.tag, type: +p.layout.type.toFixed(2), width: p.layout.w, height: p.layout.h, focus: p.focus, core: p.core })),
    hook: place(hook.place, { lines: hl.lines.length, px: +hl.px.toFixed(1), type: +hl.type.toFixed(2), height: hl.h, focus: hook.focus }),
    end: endRect, captions: cap, unsafe,
    cues: cues.map(c => ({ start: c.start, end: c.end, text: c.text })),
  };
}

function lumaStats(st: State): Stats {
  const { probe } = st, w = probe.canvas.width, h = probe.canvas.height;
  probe.drawImage(st.cv, 0, 0, st.f.w, st.f.h, 0, 0, w, h);
  const d = probe.getImageData(0, 0, w, h).data; let sum = 0, sq = 0; const n = w * h;
  for (let i = 0; i < d.length; i += 4) { const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; sum += y; sq += y * y; }
  const mean = sum / n; return { mean: +mean.toFixed(2), std: +Math.sqrt(Math.max(0, sq / n - mean * mean)).toFixed(2) };
}

/** Frame i: render the room, copy its cut-out frame, draw the overlay over it, return a base64 JPEG. */
export function frame(i: number, quality = 0.95): string {
  const st = S; if (!st) throw new Error('prepare() first');
  const { f, g, cv, gl, plan } = st;
  W.__houseRenderFrames(i, 1, null);                         // draws the 3D frame (through the page's own composer) onto the WebGL canvas
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  g.drawImage(gl, f.crop.x, 0, f.crop.w, f.page.h, 0, 0, f.w, f.h);
  st.stats = lumaStats(st);                                  // the room alone: a blank render has no spread, whatever the overlay says
  drawScene(st, i / plan.fps);
  return cv.toDataURL('image/jpeg', quality).slice(23);
}
/** The luma mean and standard deviation (0 to 255) of the room in the last frame drawn, before the overlay. */
export function stats(): Stats { return S ? S.stats : { mean: 0, std: 0 }; }
/** The smallest type painted so far, in design units (the floor is 36), the string it was painted for and every size drawn: the render fails the floor on what was painted. */
export function typeAudit(): TypeAudit { return S ? S.audit : { min: Infinity, text: '', sizes: {}, drawn: 0 }; }

function drawScene(st: State, ft: number) {
  const { f, plan, g, rs } = st, sc = sceneAt(plan, ft, st.E);
  if (sc.kind === 'part') {
    const part = plan.parts[sc.part], P = st.parts[sc.part], b = rs.beats.find(x => x.id === part.beat)!;
    if (sc.part === 0) { const ha = hookAlpha(ft); if (ha > 0.002) drawHook(g, st.hook.layout, st.hook.place.rect.x, st.hook.place.rect.y, ha); }
    const a = cardAlpha(ft, part.card.at, part.end), rect = P.place.rect;
    if (a > 0.002) {
      // the leader points at where the subject is NOW (the camera still drifts a little); the card stays where it was placed
      const tf = trackFrameAt(rs.track, sc.tour, f.compose), fo = focusRect(tf.eye, tf.target, tf.fov, b.frame.box as any, f.w, f.h);
      if (fo) { if (P.place.mode === 'card') { const l = leaderTo(rect, fo); drawLeader(g, f, l.from, l.to, a, ft); } else drawLeader(g, f, null, [fo.x + fo.w / 2, fo.y + fo.h / 2], a, ft); }
      const rise = (1 - Math.min(1, Math.max(0, (ft - part.card.at) / 0.3))) * 14 * f.k;
      drawCard(g, P.layout, rect.x, rect.y + rise, a);
    }
    drawCaption(g, f, cueAt(st.cues, ft), ft);
  } else if (sc.kind === 'end') {
    drawCutEnd(g, f, st.end, ramp(ft, plan.end.t0 + 0.1, plan.end.t0 + 0.5));
  } else drawDip(g, f, sc.dip);
  drawCutBadge(g, f, st.badge, 1);                           // on every frame: the dip does not cover it
}

export function end() {
  if (!S) return;
  try { W.__houseRenderEnd(); } catch { /* the page may already have closed it */ }
  S = null;
}
