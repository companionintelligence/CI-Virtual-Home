// assets/xr/ui/tour-presenter.ts : the XR Presenter of PRESENTER.md. The part of the tour that faces a person in a headset.
//
// The Director (assets/story/director.ts) owns what is the same on every surface: the beat order, the beat clock, the audio, the chapters
// and the URL. This presenter shows its BeatView in the world: a card beside the subject (place-world.ts), a leader line to it, a caption bar
// that follows the head lazily, and a blink teleport instead of a camera move. It does not decide anything the DOM presenter does not.
//
// enterBeat(view)
//   1 choose where to stand: the baked StandPose when the bake emitted one, else the baked rest eye projected to the floor when that is
//     walkable and the right distance ('exact'), else the nearest stand that sees the focus (WorldProbe.nearestStand: 'derived'), else, for a
//     subject too far for anyone to stand near (the street, the roof) or no stand at all, stay and say how far ('held'); a beat on another storey
//     with no stair on the route is reached by the same blink ('cut'), nothing is ever walked
//   2 lay the card out and place it for the head as it WILL be after the blink (feet + the person's own eye height, facing the stand's yaw)
//   3 Rig.moveTo(): the view fades to black, the rig moves on a frame whose fade alpha is 1, the view fades back in. The card appears behind
//     the black, so it is already there when the view returns
//   4 resolve when the view is back and the card is readable (about 260 ms of blink + one or two frames; the budget is 450 ms)
//
// The extras this adds to the Presenter interface, for the Director's integration: attach(host) gives the presenter its PresenterHost (emit,
// settings, log); XrUi.presenter(host?) does the same.
import type { XrFrame } from '../host.js';
import type {
  AudioRoute, BeatClock, BeatView, ClipRef, EndView, EnterContext, EnterResult, ExitContext, PlaybackModel, PlacementReport, Presenter, PresenterAudio, PresenterCaps,
  PresenterDebug, PresenterEvent, PresenterFault, PresenterHost, PresenterSettings, PresenterStory, ReachKind, StandPose, StartOptions, V3, WorldProbe, Box6,
} from '../presenter.js';
import { XR_COMFORT, XR_LEGIBILITY } from '../presenter.js';
import { CaptionBar } from './caption.js';
import { CardSurface } from './card.js';
import type { UiKit } from './kit.js';
import type { Menu } from './menu.js';
import { cardAspectAt, layoutBeatCardFit, layoutEndCard, layoutStartCard, MAX_CARD_DEG, type CardView, type Layout } from './paint.js';
import { cardWidthDeg, placeWorld, reportPlacement, type PlaceDebug } from './place-world.js';
import { BudgetError } from './panel.js';

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const CARD_DIST = XR_LEGIBILITY.distance.card;
/** angular rectangles the card keeps off: the caption bar and the dock, as the head sees them */
const RESERVED = [
  { x0: -XR_LEGIBILITY.caption.widthDeg / 2, x1: XR_LEGIBILITY.caption.widthDeg / 2, y0: -XR_LEGIBILITY.caption.belowHorizonDeg - 6, y1: -XR_LEGIBILITY.caption.belowHorizonDeg + 5 },
  { x0: -30, x1: -18, y0: -33, y1: -21 },
];
/** a stand is not worth walking to when the subject is this far (street, roof, aerial hint): the person stays and the card says how far */
const HELD_FAR_M = 14;
const STAND = { minIndoor: 1.6, maxIndoor: 4.8, maxOutdoor: 9 };
const OPEN_WORLD: WorldProbe = {
  floorY: () => 0, walkable: () => true, roomAt: () => ({ room: null, level: null, indoors: false }), segmentClear: () => true, hull: () => [], nearestStand: () => null,
};
const dist3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const grow = (b: Box6, m: number): Box6 => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];

export interface XrPresenterApi extends Presenter {
  /** the Director gives the presenter its host (emit, settings, log). Without one the presenter works and its events go nowhere. */
  attach(host: PresenterHost): void;
  /** a press on a widget of the card, for tests that drive the flow without a ray */
  press(widgetId: string): void;
  /** after dispose() a presenter is finished; XrUi.presenter() then makes a new one */
  readonly disposed: boolean;
}

export function createXrPresenter(kit: UiKit, menu: Menu): XrPresenterApi {
  const caps: PresenterCaps = { kind: 'xr', moves: 'presenter', timeline: 'beat', hover: true, spatialAudio: true, textUnit: 'degrees', input: ['ray', 'pinch', 'gaze-pinch', 'hand-ray'] };

  let host: PresenterHost | null = null;
  let story: PresenterStory | null = null;
  let surface: CardSurface | null = null, caption: CaptionBar | null = null;
  let beat: BeatView | null = null, model: PlaybackModel | null = null;
  let stage: 'idle' | 'start' | 'beat' | 'end' = 'idle';
  let endView: EndView | null = null;
  let lastPlacement: PlacementReport | null = null;
  let pendingReveal: { at: number } | null = null;
  let countdown: number | null = null, cardCanPrev = true, cardCanNext = true;
  let syncing = false, disposed = false, announcedFont = false;
  let enterToken = 0;
  const clips = new Map<string, ClipRef>(); const words = new Map<string, string[]>();
  const offs: Array<() => void> = [];
  const cview = { words: [] as string[], wordIndex: -1, speaker: null as string | null, fictional: 'Fictional', progress: null as number | null };

  const emit = (e: PresenterEvent) => { try { host?.emit(e); } catch (err) { console.warn('xr presenter: a host handler threw', err); } };
  const fault = (code: PresenterFault, detail?: string) => { kit.fault(code, detail); emit({ type: 'fault', code, detail }); };
  const world = (): WorldProbe => kit.loco?.world || OPEN_WORLD;
  const cs = () => kit.settings.get();

  /** a card should fit between the top of the caption bar and the top of the view; taller ones lose the phone drawing (paint.ts) */
  const fitDeg = () => Math.max(34, Math.min(MAX_CARD_DEG, kit.viewCone().elMax + 11));

  // ---- the card's content and its layout
  const cardView = (b: BeatView, far?: string): CardView => ({
    beat: b, disclosure: story!.disclosure, canPrev: cardCanPrev, canNext: cardCanNext, nextLabel: b.index + 1 >= b.count ? 'Finish' : 'Next',
    nextInS: countdown, far,
  });
  let farNote: string | undefined;
  function layoutFor(b: BeatView, widthDeg?: number): { L: Layout; m: ReturnType<UiKit['metrics']>; widthDeg: number } {
    const m = kit.metrics(CARD_DIST), wd = widthDeg ?? cardWidthDeg(m.textScale), W = Math.round(wd * m.texelsPerDeg);
    return { L: layoutBeatCardFit(kit.measure, cardView(b, farNote), m, W, fitDeg()), m, widthDeg: wd };
  }

  // ---- where to stand
  function standFor(b: BeatView): { stand: StandPose | null; kind: ReachKind; notes: string[] } {
    const notes: string[] = [], w = world();
    const level = b.anchor.level ?? b.rest.level;
    if (b.stand && b.stand.verified.walkable) return { stand: b.stand, kind: b.stand.kind, notes };
    const eye = b.rest.eye, focus = b.anchor.focus;
    const yawTo = (from: V3) => Math.atan2(-(focus[0] - from[0]), -(focus[2] - from[2]));
    let floor: number | null = null, ok = false;
    try { floor = w.floorY(eye[0], eye[2], level); ok = floor != null && w.walkable(eye[0], eye[2], level, 0.3); } catch { ok = false; }
    const d = Math.hypot(focus[0] - eye[0], focus[2] - eye[2]);
    const indoors = (() => { try { return w.roomAt([eye[0], (floor ?? 0) + 1, eye[2]]).indoors; } catch { return true; } })();
    if (ok && floor != null && d >= STAND.minIndoor * 0.7 && d <= (indoors ? STAND.maxIndoor * 1.6 : STAND.maxOutdoor * 1.4)) {
      const feet: V3 = [eye[0], floor, eye[2]];
      return { stand: { feet, yaw: yawTo(feet), level, kind: 'exact', distance: d, verified: { walkable: true, seen1_6: true, seen1_2: true } }, kind: 'exact', notes };
    }
    let s: StandPose | null = null;
    try { s = w.nearestStand(eye, focus, { minDist: STAND.minIndoor, maxDist: indoors ? STAND.maxIndoor : STAND.maxOutdoor, eyeHeights: [1.6, 1.2], level }); } catch { s = null; }
    if (!s && level) { try { s = w.nearestStand(eye, focus, { minDist: STAND.minIndoor, maxDist: STAND.maxOutdoor, eyeHeights: [1.6, 1.2], level: null }); if (s) notes.push('cut: another storey'); } catch { s = null; } }
    if (s) return { stand: s, kind: s.kind === 'exact' ? 'derived' : s.kind, notes };
    notes.push('no stand: the person stays');
    return { stand: null, kind: 'held', notes };
  }

  // ---- the head as it will be after the move
  function predictedHead(stand: StandPose | null): { pos: V3; yaw: number; eye: number } {
    const h = kit.head();
    const eye = Math.max(1.0, h.pos[1] - kit.rig.floorY());
    if (!stand) return { pos: h.pos, yaw: h.yawDeg * RAD, eye };
    return { pos: [stand.feet[0], stand.feet[1] + eye, stand.feet[2]], yaw: stand.yaw, eye };
  }

  /** lay out and place for a head; the solver may choose a wider (so shorter) card, in which case the layout is redone at that width, and, when the person is
   *  about to be moved (`turn`), the yaw the head should end with (so the subject and the card are side by side in the middle of the view) */
  function layoutAndPlace(b: BeatView, head: { pos: V3; yaw: number; eye: number }, turn: boolean, dbg?: PlaceDebug) {
    const first = layoutFor(b);
    const inp = (L: Layout, yaw = head.yaw) => ({ head: head.pos, headYaw: yaw, eyeHeight: head.eye, anchor: b.anchor, core: story!.core, cardAspect: L.w / L.h, textScale: cs().textScale, world: world(), reservedDeg: RESERVED });
    const out = placeWorld(inp(first.L), dbg, { aspectAt: cardAspectAt(kit.measure, cardView(b, farNote), first.m, fitDeg()), turn, cone: kit.viewCone() });
    const lay = out.widthDeg === first.widthDeg ? first : layoutFor(b, out.widthDeg);
    const report = reportPlacement(inp(lay.L, out.headYaw), out);
    return { out, report, ...lay };
  }

  // ---- surfaces
  function ensureSurfaces(): void {
    if (!surface) surface = new CardSurface(kit, 'card');
    if (!caption) caption = new CaptionBar(kit);
    surface.panel.activate = (w) => onCard(w.id);
  }
  function onCard(id: string): void {
    if (stage === 'beat') { if (id === 'prev') emit({ type: 'prev' }); else if (id === 'next') emit({ type: 'next' }); return; }
    if (stage === 'end') {
      if (id === 'cta') emit({ type: 'cta', id: 'core' });
      else if (id === 'replay') emit({ type: 'replay' });
      else if (id === 'next-family') emit({ type: 'next-family' });
      else if (id === 'exit') { emit({ type: 'exit', reason: 'user' }); kit.exit(); }
    }
  }

  // ---- every XR frame (called by the kit, not by the Director)
  function frame(f: XrFrame): void {
    if (disposed) return;
    surface?.tick(f);
    caption?.tick(f);
    if (pendingReveal && surface) {
      // the blink has reached black (the rig swaps on the next frame): show the card behind it
      if (kit.rig.fade.get() >= XR_COMFORT.visibleFadeAlpha || kit.frame() - pendingReveal.at > 90) { pendingReveal = null; surface.reveal(); }
    }
  }

  // ---- the Presenter ----------------------------------------------------------------------------------------------------------
  const audio: PresenterAudio = {
    routeFor(clip: ClipRef, b: BeatView): AudioRoute {
      // the narrator is in the person's head (stereo, does not move); a companion speaks from the Core, or from the subject when the house has none in view
      if (clip.speaker === 'narrator') return { kind: 'head' };
      const at = story?.core?.centre ?? b.anchor.focus;
      return { kind: 'world', position: [at[0], at[1], at[2]], refDistance: 1.5, rolloff: 1.2, maxDistance: 25, minGain: 0.15 };
    },
  };

  const p: XrPresenterApi = {
    caps, audio,

    async prepare(s, signal) {
      if (disposed) throw new Error('xr presenter: disposed');
      story = s;
      if (!kit.host.renderer?.xr?.getSession?.()) { fault('no-xr', 'no immersive session'); throw new Error('no immersive session'); }
      if (!kit.fontsOk() && !announcedFont) { announcedFont = true; fault('font-failed', 'Manrope did not load; the system font stands in'); }
      cview.fictional = s.disclosure.fictional || 'Fictional';
      try { ensureSurfaces(); } catch (e) {
        fault(e instanceof BudgetError ? 'budget-exceeded' : 'texture-failed', String((e as Error).message || e));
        throw e;
      }
      if (signal?.aborted) throw new Error('aborted');
      menu.bindTour({ chapters: () => story?.chapters ?? [], model: () => model, emit });
      // settings: the person's choices in the menu go to the Director, and the Director's go to the menu
      offs.push(kit.settings.on((st, changed) => {
        if (syncing) return;
        const map: Array<keyof PresenterSettings> = ['textScale', 'contrast', 'posture', 'handedness', 'autoAdvance'];
        for (const k of changed) if ((map as string[]).includes(k)) { const v = (st as any)[k]; try { host?.settings.set({ [k]: v } as Partial<PresenterSettings>); } catch { /* ignore */ } emit({ type: 'setting', key: k as keyof PresenterSettings, value: v }); }
      }));
      offs.push(kit.onRelayout(() => rerender(true)));
      offs.push(kit.onVisibility(state => emit({ type: 'visibility', state })));
      offs.push(kit.onFrame(frame));
      offs.push(kit.onEnd(() => { emit({ type: 'fault', code: 'xr-session-ended' }); emit({ type: 'exit', reason: 'session-end' }); }));
    },

    async start(opts: StartOptions) {
      ensureSurfaces();
      stage = 'start';
      caption!.show();
      // the title card: where the person is standing, 1.7 m ahead, until the first beat takes its place
      const m = kit.metrics(CARD_DIST), widthDeg = cardWidthDeg(m.textScale), W = Math.round(widthDeg * m.texelsPerDeg);
      const L = layoutStartCard(kit.measure, { story: story!, line: story!.disclosure.fictional }, m, W);
      const h = kit.head();
      const yaw = h.yawDeg * RAD, d = CARD_DIST;
      const centre: V3 = [h.pos[0] - Math.sin(yaw) * d, h.pos[1] - 0.05, h.pos[2] - Math.cos(yaw) * d];
      const wM = 2 * d * Math.tan(widthDeg * RAD / 2);
      surface!.present(L, m, widthDeg, { centre, yaw, tiltDeg: 0, widthM: wM, heightM: wM * L.h / L.w, leader: null, mode: 'card' });
      surface!.panel.activate = null;
      void opts;
    },

    async enterBeat(view: BeatView, ctx: EnterContext): Promise<EnterResult> {
      ensureSurfaces();
      const token = ++enterToken, t0 = kit.host.now();
      const notes: string[] = [];
      beat = view; stage = 'beat'; cardCanPrev = model ? model.canPrev : view.index > 0; cardCanNext = model ? model.canNext : true; countdown = null;
      for (const c of [view.narration, view.sayClip]) if (c) { clips.set(c.id, c); words.set(c.id, c.words.map(w => w[0])); }
      surface!.hide(0); surface!.panel.activate = (w) => onCard(w.id);
      caption!.show(); cview.words = []; cview.wordIndex = -1; cview.speaker = null; cview.progress = 0; caption!.set(cview);

      const { stand, kind, notes: n1 } = standFor(view); notes.push(...n1);
      farNote = undefined;
      const head = predictedHead(stand);
      const far = dist3(head.pos, view.anchor.focus);
      if (kind === 'held') { farNote = far > 6 ? `About ${Math.round(far)} m away` : undefined; if (far > HELD_FAR_M) notes.push(`subject ${Math.round(far)} m away`); else if (!stand) fault('unreachable-beat', view.id); }
      const dbg: PlaceDebug = { candidates: [], sheet: false };
      let { out, report, L, m, widthDeg } = layoutAndPlace(view, head, !!stand, dbg);
      lastPlacement = report;
      if (out.mode === 'sheet') { fault('no-placement', view.id); notes.push('sheet: no candidate fit'); }
      surface!.present(L, m, widthDeg, out, false);

      // the move. With nowhere to go the card simply appears; otherwise it waits for the blink's black frame.
      let moved = false;
      if (stand && !ctx.signal.aborted) {
        pendingReveal = { at: kit.frame() };
        moved = true;
        const r = await kit.rig.moveTo({ feet: stand.feet, yawDeg: out.headYaw * DEG }, { faceStandYaw: true, signal: ctx.signal });
        notes.push(`blink ${Math.round(r.ms)} ms, head moved ${r.headMovedM.toFixed(2)} m`);
        if (token !== enterToken) return { reach: kind, placement: report, cardVisible: false, ms: kit.host.now() - t0, notes: [...notes, 'superseded'] };
        // the head is where it really is: re-place only if the prediction was off (eye height, a lean at the moment of the swap)
        const actual = kit.head(), moveErr = dist3(actual.pos, head.pos), yawErr = Math.abs(((actual.yawDeg - out.headYaw * DEG + 540) % 360) - 180);
        if (moveErr > 0.12 || yawErr > 6) {
          const re = layoutAndPlace(view, { pos: actual.pos, yaw: actual.yawDeg * RAD, eye: head.eye }, false);
          out = re.out; report = re.report; L = re.L; m = re.m; widthDeg = re.widthDeg; lastPlacement = report; surface!.present(L, m, widthDeg, out, false);
          notes.push(`re-placed: head was ${moveErr.toFixed(2)} m / ${yawErr.toFixed(0)} deg off`);
        }
      }
      pendingReveal = null;
      if (ctx.signal.aborted) { surface!.hide(0); return { reach: kind, placement: report, cardVisible: false, ms: kit.host.now() - t0, notes: [...notes, 'aborted'] }; }
      surface!.reveal();
      const ms = kit.host.now() - t0;
      if (ms > XR_COMFORT.enterBudgetMs && moved) fault('budget-exceeded', `enterBeat took ${Math.round(ms)} ms (budget ${XR_COMFORT.enterBudgetMs})`);
      return { reach: kind, placement: report, cardVisible: true, ms, notes };
    },

    tick(clock: BeatClock) {
      if (disposed || !caption || !beat) return;
      const line = clock.line;
      if (line) {
        const w = words.get(line.id) || [], clip = clips.get(line.id);
        cview.words = w; cview.wordIndex = line.wordIndex;
        cview.speaker = line.speaker === 'narrator' ? null : (beat.companion?.name || (clip ? String(clip.speaker) : null));
      } else { cview.words = []; cview.wordIndex = -1; cview.speaker = null; }
      cview.progress = clock.progress;
      caption.set(cview);
      // the guided countdown: the Next label says "Next in 2"; redrawn when the whole second changes, not every frame
      const c = clock.nextInS != null && clock.nextInS > 0 ? Math.ceil(clock.nextInS) : null;
      if (c !== countdown && stage === 'beat' && surface && surface.visible) { countdown = c; rerender(); }
    },

    async exitBeat(view: BeatView, ctx: ExitContext) {
      void view;
      pendingReveal = null;
      if (!surface) return;
      surface.hide(ctx.reducedMotion ? 0 : 0.12);
      await whenHidden(surface.panel.mesh, 400, kit);
    },

    update(m: PlaybackModel) {
      model = m;
      if (disposed) return;
      syncing = true;
      try {
        const s = m.settings, cur = cs();
        const patch: Partial<typeof cur> = {};
        if (s.textScale !== cur.textScale) patch.textScale = s.textScale;
        if (s.contrast !== cur.contrast) patch.contrast = s.contrast;
        if (s.posture !== cur.posture) patch.posture = s.posture;
        if (s.handedness !== cur.handedness) patch.handedness = s.handedness;
        if (s.autoAdvance !== cur.autoAdvance) patch.autoAdvance = s.autoAdvance;
        if (Object.keys(patch).length) { kit.settings.set(patch); rerender(true); }
      } finally { syncing = false; }
      if (stage === 'beat' && (m.canPrev !== cardCanPrev || m.canNext !== cardCanNext)) { cardCanPrev = m.canPrev; cardCanNext = m.canNext; rerender(); }
      if (m.chaptersOpen && !(menu.open && menu.currentPage === 'chapters')) menu.show('chapters');
      else if (!m.chaptersOpen && menu.open && menu.currentPage === 'chapters') menu.hide();
      else menu.refresh();
    },

    async showEnd(view: EndView) {
      ensureSurfaces();
      stage = 'end'; endView = view; pendingReveal = null; countdown = null;
      surface!.hide(0); surface!.panel.activate = (w) => onCard(w.id);
      caption!.hide();
      const m = kit.metrics(CARD_DIST), widthDeg = cardWidthDeg(m.textScale), W = Math.round(widthDeg * m.texelsPerDeg);
      const L = layoutEndCard(kit.measure, view, m, W, { canReplay: true, hasCta: !!view.closing.ctaLabel });
      const h = kit.head(), yaw = h.yawDeg * RAD;
      // at least 12 degrees from the Core: the solver treats the Core's box, grown by 10 degrees' worth of metres, as the subject it must keep clear of
      const core = view.core ?? story?.core ?? null;
      let out;
      if (core) {
        const d = dist3(h.pos, core.centre), pad = d * Math.tan(10 * RAD);
        const anchor = { role: 'core', box: grow(core.box, pad), focus: core.centre, level: null };
        out = placeWorld({ head: h.pos, headYaw: yaw, eyeHeight: h.pos[1], anchor, core: null, cardAspect: L.w / L.h, textScale: cs().textScale, world: world(), reservedDeg: [] });
        out = { ...out, leader: null };
      } else {
        const d = CARD_DIST, wM = 2 * d * Math.tan(widthDeg * RAD / 2);
        out = { centre: [h.pos[0] - Math.sin(yaw) * d, h.pos[1] - 0.05, h.pos[2] - Math.cos(yaw) * d] as V3, yaw, tiltDeg: 0, widthM: wM, heightM: wM * L.h / L.w, leader: null, mode: 'card' as const };
      }
      surface!.present(L, m, widthDeg, out, true);
    },

    toast(msg) { kit.toast(msg.text, msg.kind, msg.ms); },

    interrupt(reason) {
      void reason;
      surface?.dim(0.15); caption?.panel.dim(0.2, 0.25);
    },
    resume() {
      surface?.dim(1); caption?.panel.dim(1, 0.25);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const f of offs.splice(0)) { try { f(); } catch { /* gone */ } }
      menu.bindTour(null);
      surface?.dispose(); caption?.dispose(); surface = null; caption = null;
      beat = null; story = null; model = null; clips.clear(); words.clear();
    },

    attach(h: PresenterHost) {
      host = h;
      // adopt the Director's settings as the person's (they were saved by an earlier tour); the other direction runs through kit.settings.on
      try {
        const s = h.settings.get(); syncing = true;
        kit.settings.set({ textScale: s.textScale, contrast: s.contrast, posture: s.posture, handedness: s.handedness, autoAdvance: s.autoAdvance });
      } catch { /* a host without settings */ } finally { syncing = false; }
    },
    press(id: string) { onCard(id); },
    get disposed() { return disposed; },

    debug: {
      texts() {
        const out: string[] = [];
        if (surface?.panel.layout && surface.visible) out.push(...surface.panel.layout.texts);
        if (caption?.visible) out.push(...caption.texts().filter((t, i, a) => a.indexOf(t) === i));
        return out;
      },
      placement: () => lastPlacement,
      footprint: () => kit.footprint(),
      motionLog: () => kit.motionLog(),
    } as PresenterDebug,
  };

  function rerender(sizeChanged = false): void {
    if (!surface || !surface.visible) return;
    const pose = surface.pose; if (!pose) return;
    if (stage === 'beat' && beat && story) {
      // a text scale or contrast change re-places the card (its shape changed), for the head where it is now; a label change only redraws
      if (sizeChanged) { const h = kit.head(), r = layoutAndPlace(beat, { pos: h.pos, yaw: h.yawDeg * RAD, eye: Math.max(1.0, h.pos[1] - kit.rig.floorY()) }, false); lastPlacement = r.report; surface.present(r.L, r.m, r.widthDeg, r.out, true); }
      else { const { L, m, widthDeg } = layoutFor(beat, surface.panel.widthDeg || undefined); surface.relayout(L, m, widthDeg); }
    }
    else if (stage === 'end' && endView) { const m = kit.metrics(CARD_DIST), widthDeg = cardWidthDeg(m.textScale); surface.relayout(layoutEndCard(kit.measure, endView, m, Math.round(widthDeg * m.texelsPerDeg), { canReplay: true, hasCta: !!endView.closing.ctaLabel }), m, widthDeg); }
  }
  return p;
}

/** resolves when the panel's mesh is hidden, or after maxMs of wall time (a hidden session draws no frames, so the fade may never finish) */
function whenHidden(mesh: any, maxMs: number, kit: UiKit): Promise<void> {
  return new Promise<void>(res => {
    if (!mesh.visible) return res();
    let done = false; const fin = () => { if (done) return; done = true; off(); clearTimeout(t); res(); };
    const off = kit.onFrame(() => { if (!mesh.visible) fin(); });
    const t = setTimeout(fin, maxMs);
  });
}
