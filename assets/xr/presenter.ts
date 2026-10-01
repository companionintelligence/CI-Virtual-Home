// assets/story/presenter.ts : the Presenter contract. Types, constants and three pure helpers. Browser and Node, no THREE, no DOM.
//
// A Presenter is the part of the tour that FACES THE PERSON: where the words go, how a beat is shown, how the person says
// "next". The Director (assets/story/director.ts) owns everything that is the same on every surface: the beat order, the beat
// clock, the audio, the chapters, the URL. Three presenters render the SAME beats from the SAME data:
//
//   dom   the page: popup card + leader + karaoke caption + chapter drawer (popup.ts, captions.ts, chapters.ts, a11y.ts, keys.ts)
//   film  a Canvas2D overlay drawn over __houseRenderFrames(i) (assets/story/film/)
//   xr    a headset: in-world panels, a blink teleport instead of a camera move, spatial audio (assets/xr/story/)
//
// The text, the order, the timing source and the claims are never the presenter's business: a presenter shows BeatView and
// nothing it made up. Companion docs: PRESENTER.md (the rules, the reasons, the tests). Sources of the shapes below:
//   assets/story/types.ts   (Story, Beat, Popup, Chapter, WordTiming ...)   assets/story/runtime.ts (RuntimeStory, RuntimeBeat)
//   assets/story/track.ts   (StoryTrack, beatRestFrame)                      assets/story/place.ts   (the 2D solver this file extends to 3D)
//
// Owner after adoption: story-player (wave 2) for this file; xr-ui for the XR section (the last third). A change to a name here is a
// contract change: announce it in the progress log.
import type { ChapterKind, ClipId, Colour, MemberRole, PhoneScreen, Runtime, VoiceKey, WordTiming } from './types.js';

export type V3 = [number, number, number];
export type Box6 = [number, number, number, number, number, number];   // minX, minY, minZ, maxX, maxY, maxZ (assets/shot-world.ts)
export type Rect = { x: number; y: number; w: number; h: number };

// ============================================================================================================================
// 1. kinds and capabilities
// ============================================================================================================================
export type PresenterKind = 'dom' | 'film' | 'xr';

export interface PresenterCaps {
  kind: PresenterKind;
  /** 'track': the Director plays the baked camera (trackFrameAt(t)) and the presenter only draws on top of it (dom, film).
   *  'presenter': the presenter moves the person (xr). The Director then does NOT apply the camera of the track, still applies the
   *  ambient channels (host.ambient(t): Core power, doors) and starts each beat's clock when enterBeat() resolves. */
  moves: 'track' | 'presenter';
  /** 'continuous': a time axis with a scrubber (dom, film). 'beat': steps only; there is no scrubber and no seek (xr). */
  timeline: 'continuous' | 'beat';
  /** can the person see a hover state before pressing? false on touch and in visionOS (a transient pointer exists only while pinching) */
  hover: boolean;
  /** can a clip be routed to a world position */
  spatialAudio: boolean;
  /** how text sizes are expressed: CSS px (dom), pixels of the film frame (film), degrees of visual angle (xr) */
  textUnit: 'css-px' | 'film-px' | 'degrees';
  /** how the person gives input */
  input: Array<'pointer' | 'touch' | 'keyboard' | 'gamepad' | 'ray' | 'pinch' | 'gaze-pinch' | 'hand-ray'>;
}

// ============================================================================================================================
// 2. what a presenter RECEIVES (derived by the Director from RuntimeStory; nothing here is authored by a presenter)
// ============================================================================================================================
/** a clip the person can hear: the m4a under /audio/<slug>/, its length and its word timings (ms from the clip's own start, lead trimmed) */
export interface ClipRef { id: ClipId; url: string; durationMs: number; words: WordTiming[]; speaker: 'narrator' | string; voice: VoiceKey | string }

/** the disclosure strings of claims.json, ready to draw. A presenter shows `fictional` at all times (chip, caption footer, wrist) */
export interface Disclosure { fictional: string; scripted: string; stylised: string; synthetic: string; beta: string; signoff: string }

export interface MemberView { id: string; name: string; initial: string; role: MemberRole; colour: Colour; companion: { name: string; runtime: Runtime } | null }
export interface ChapterView { id: string; kind: ChapterKind; title: string; index: number; beat0: number; beats: number }

/** everything that is the same for every beat of a family: handed over once, in prepare() */
export interface PresenterStory {
  slug: string; surname: string; tagline: string; address: string;
  members: MemberView[]; chapters: ChapterView[]; beatCount: number;
  closing: { body: string; ctaLabel: string; ctaUrl: string };
  disclosure: Disclosure;
  /** the Core: its drawn box and its centre (world metres) when the house has one in view of the tour, else null */
  core: { box: Box6; centre: V3 } | null;
  /** 'voice': every duration is the recorded voice's. 'estimated': a draft (the Director shows a notice; a release build refuses it) */
  durations: 'voice' | 'estimated';
  /** the family files by id, so a presenter can warm what it will draw (fonts) but it never fetches audio: the Director owns audio */
  fonts: { family: 'Manrope'; weights: number[] };
}

/** one beat, as the person sees it. Order, ids, text and numbers are the story's; a presenter may lay them out, never edit them. */
export interface BeatView {
  index: number; count: number; id: string;
  chapter: ChapterView;
  /** who the moment is about; null for the narrator-only beats (FTUE, outro) */
  member: MemberView | null;
  /** "with <companion>" line and the agent's scripted line, when the beat has one */
  companion: { name: string; runtime: Runtime } | null;
  say: { speaker: string; text: string } | null;
  popup: { kind: 'card' | 'phone'; title: string; body: string; note: string | null; chips: string[]; phone: PhoneScreen | null };
  /** the first chip is the app, the others read "replaces X" (STORY-BIBLE 10.2); null in beats with no app */
  app: { id: string; name: string; replaces: string[] } | null;
  emphasis: { ring: boolean; wake: boolean };
  /** what is spoken: narration = popup.body; say = the agent's line. null when the voice lock has no clip (silent tour) */
  narration: ClipRef | null; sayClip: ClipRef | null;
  /** where the subject is, in world metres (the baked anchor, never a coordinate the story author wrote) */
  anchor: { role: string; box: Box6; focus: V3; level: string | null };
  /** the baked camera's rest pose for this beat (beatRestFrame): the DOM player ends its move here; XR uses it to derive a stand point */
  rest: { eye: V3; target: V3; fov: number; level: string | null };
  /** XR only: a stand point verified at bake time (see StandPose). Absent until story-bake emits it; XR then derives one (section 7). */
  stand?: StandPose;
  /** seconds, tour clock: copied from RuntimeBeat. With moves:'presenter' only `readS`, `narrationS`, `sayS` matter (see BeatClock) */
  timing: { t0: number; t1: number; popupAt: number; speechAt: number; sayAt: number | null; readS: number; narrationS: number; sayS: number };
}

/** the last card of the tour */
export interface EndView { closing: PresenterStory['closing']; hasNextFamily: boolean; core: PresenterStory['core']; disclosure: Disclosure }

// ============================================================================================================================
// 3. time and state the Director pushes
// ============================================================================================================================
/** pushed to tick() every frame of the presenter's own loop (rAF in dom, XRSession rAF in xr, the frame index in film). Cheap; no allocation. */
export interface BeatClock {
  /** seconds since the beat's clock started (enterBeat resolved) */
  beatT: number;
  phase: 'enter' | 'narration' | 'gap' | 'say' | 'tail' | 'idle';
  /** the line being spoken: its clip id, ms into the clip, and the index of the word being spoken (-1 before the first); null when none */
  line: { id: ClipId; ms: number; wordIndex: number; speaker: 'narrator' | string } | null;
  playing: boolean; muted: boolean;
  /** what advances the clock: the audio element's currentTime, or the wall clock (muted, silent, reduced motion, audio failed) */
  source: 'audio' | 'wall';
  /** 0..1 progress of the beat and, in 'guided' auto-advance, seconds until the next blink (null: not counting) */
  progress: number; nextInS: number | null;
}

export interface PresenterSettings {
  /** 1 | 1.25 | 1.5 : multiplies every text size (xr: the angular sizes of XR_LEGIBILITY) */
  textScale: 1 | 1.25 | 1.5;
  contrast: 'normal' | 'high';
  /** xr: head height assumed when no standing height is known; seated users get 1.2 m, standing 1.6 m (measured at session start when possible) */
  posture: 'standing' | 'seated';
  /** xr: which hand carries the menu and the pointer's primary action */
  handedness: 'right' | 'left';
  /** 'guided': the tour moves on when the voice ends (after a visible countdown); 'step': only on a press. Reduced motion forces 'step'. */
  autoAdvance: 'guided' | 'step';
  reducedMotion: boolean;
}

export interface PlaybackModel {
  playing: boolean; muted: boolean; hasAudio: boolean; audioFailed: boolean;
  beatIndex: number; beatCount: number; chapterIndex: number;
  canPrev: boolean; canNext: boolean;
  chaptersOpen: boolean;
  ended: boolean;
  settings: PresenterSettings;
}

// ============================================================================================================================
// 4. what a presenter SENDS (one callback, host.emit)
// ============================================================================================================================
export type PresenterFault =
  | 'no-xr' | 'xr-session-ended' | 'font-failed' | 'texture-failed' | 'no-placement' | 'unreachable-beat' | 'budget-exceeded' | 'input-lost';

export type PresenterEvent =
  | { type: 'next' } | { type: 'prev' }
  | { type: 'play' } | { type: 'pause' } | { type: 'mute'; muted: boolean }
  | { type: 'chapters'; open: boolean }
  | { type: 'chapter'; id: string }
  | { type: 'beat'; id: string }
  | { type: 'replay' } | { type: 'next-family' } | { type: 'share' }
  /** the end card's call to action. In xr the host ends the session first (a headset cannot follow a link), then shows it on the page. */
  | { type: 'cta'; id: 'core' }
  | { type: 'setting'; key: keyof PresenterSettings; value: PresenterSettings[keyof PresenterSettings] }
  /** xr: the system menu, the proximity sensor or tracking loss. The Director pauses the clock and the audio on 'blurred' | 'hidden'. */
  | { type: 'visibility'; state: 'visible' | 'blurred' | 'hidden' }
  | { type: 'exit'; reason: 'user' | 'session-end' | 'error' }
  | { type: 'fault'; code: PresenterFault; detail?: string };

/** what the Director does with events: idempotent, at most one beat change in flight (a 'next' during enterBeat is queued once, the rest are dropped) */
export type EmitFn = (e: PresenterEvent) => void;

// ============================================================================================================================
// 5. audio routing: the Director plays, the presenter says where it should seem to come from
// ============================================================================================================================
export type AudioRoute =
  /** plain stereo to both ears; does not move with the head (the narrator). Mono clips play identically in each ear. */
  | { kind: 'head' }
  /** HRTF PannerNode at a world position; the host keeps the Web Audio listener on the head pose (the companion at the Core) */
  | { kind: 'world'; position: V3; refDistance: number; rolloff: number; maxDistance: number; minGain: number };

export interface PresenterAudio {
  /** called once per clip, just before it starts. The default is { kind: 'head' }. */
  routeFor(clip: ClipRef, beat: BeatView): AudioRoute;
}

// ============================================================================================================================
// 6. the interface itself
// ============================================================================================================================
export interface PresenterHost {
  emit: EmitFn;
  /** the story-wide data (also passed to prepare) */
  story: PresenterStory;
  /** apply the non-camera channels of the track for story time t: the roof, the doors, the Core's power. Never touches the camera. */
  ambient(t: number): void;
  /** a monotonic clock in ms. The only clock a presenter may read; it is NOT a frame input (nothing a product frame draws may depend on it). */
  now(): number;
  /** settings storage (localStorage behind try/catch in the page; a plain object in tests) */
  settings: { get(): PresenterSettings; set(patch: Partial<PresenterSettings>): void };
  log(level: 'info' | 'warn' | 'error', msg: string): void;
}

export interface StartOptions {
  /** the person pressed "Start with narration" or "Start without sound" (or entered the headset) : a user gesture happened */
  audio: 'narrated' | 'silent';
  /** the beat to open on (a shared moment, ?beat=) */
  beat: number;
  /** a deep-linked or shared moment opens paused */
  paused: boolean;
}

export type EnterFrom = 'start' | 'next' | 'prev' | 'jump' | 'chapter' | 'replay' | 'resume' | 'recall';
export interface EnterContext {
  from: EnterFrom;
  reducedMotion: boolean;
  /** aborted when the person presses next/prev/jump while this enter is still running: finish at once, leave nothing half-shown */
  signal: AbortSignal;
}
export interface EnterResult {
  /** how the person got to this beat. See ReachKind. 'n/a' for presenters that do not move the person. */
  reach: ReachKind | 'n/a';
  /** what the placement achieved (the same numbers the DOM solver reports: PlaceOut.overlapFocus ...) */
  placement: PlacementReport | null;
  /** the card is on screen and readable now */
  cardVisible: boolean;
  /** how long enter took, ms (xr budget: 450) */
  ms: number;
  notes: string[];
}
export interface ExitContext { to: 'next' | 'prev' | 'jump' | 'chapter' | 'end' | 'replay' | 'dispose'; reducedMotion: boolean; signal: AbortSignal }

export interface Presenter {
  readonly caps: PresenterCaps;
  /** optional spatial routing; absent: everything is { kind: 'head' } */
  readonly audio?: PresenterAudio;

  /** load what drawing needs (fonts, textures, panels, meshes). After this resolves enterBeat() never waits for the network. Rejects only if the
   *  presenter cannot work at all (the Director then falls back to the DOM presenter and shows a notice). */
  prepare(story: PresenterStory, signal?: AbortSignal): Promise<void>;

  /** the tour begins (after the user's gesture). The presenter shows its first chrome; it does NOT show a beat yet. */
  start(opts: StartOptions): Promise<void>;

  /** Show a beat. In xr this includes moving the person (blink) and placing the card, and resolves only when the view is back and the card is
   *  readable; the Director starts the beat clock then, so no sound is played over a black frame. In dom/film it resolves when the card is placed. */
  enterBeat(view: BeatView, ctx: EnterContext): Promise<EnterResult>;

  /** every frame of the presenter's own loop: karaoke, progress, the countdown ring. No allocation, no layout, no texture upload unless a word changed. */
  tick(clock: BeatClock): void;

  /** take the beat away (fade the card out, release anything per-beat). Resolves when nothing of it is visible. */
  exitBeat(view: BeatView, ctx: ExitContext): Promise<void>;

  /** the playback state changed (play/pause, mute, chapters, settings, index). Idempotent; called often. */
  update(model: PlaybackModel): void;

  /** the last card. Placed so that it covers under 5 % of the Core (dom/film) / is at least 12 degrees away from the Core (xr). */
  showEnd(view: EndView): Promise<void>;

  /** a short notice that is also announced (dom: aria-live; xr: a toast panel that never takes the ray; film: not used) */
  toast(msg: { text: string; kind: 'info' | 'warn'; ms?: number }): void;

  /** the world went away under the tour (xr: visibility 'blurred'/'hidden', tracking lost). Hide popups that need attention, freeze counters.
   *  Do not emit events from here. resume() puts it back. */
  interrupt(reason: 'blurred' | 'hidden' | 'tracking-lost' | 'context-lost'): void;
  resume(): void;

  /** remove everything this presenter added to the page / scene, restore everything it changed on the renderer, cancel its loops.
   *  After dispose() the renderer, scene and camera are exactly as they were before prepare(): the offline hooks may run (determinism). */
  dispose(): void;

  /** test hook, present in every presenter (sections 9 and 10 of PRESENTER.md) */
  readonly debug: PresenterDebug;
}

export interface PresenterDebug {
  /** every string the presenter has put in front of the person for the current beat, in reading order (title, body, note, chips, say, footer, captions so far) */
  texts(): string[];
  /** the last placement, with the measured numbers */
  placement(): PlacementReport | null;
  /** objects/nodes currently alive (dom: elements it owns; xr: scene objects it owns) and GPU memory it holds (xr: textures + geometries bytes estimate) */
  footprint(): { nodes: number; textureBytes: number; drawCalls: number };
  /** the frames on which the person's viewpoint moved, with the fade alpha at that frame (xr comfort test); [] for presenters that never move it */
  motionLog(): Array<{ frame: number; fade: number; moved: boolean }>;
}

// ============================================================================================================================
// 7. XR: reaching a beat, standing, blinking (the part only the xr presenter implements; kept here so story-bake can emit StandPose)
// ============================================================================================================================
/** how a beat's viewpoint was reached for a person in a headset */
export type ReachKind =
  /** the baked rest eye projected to the floor, standing eye height: the same place the DOM player shows */
  | 'exact'
  /** the nearest walkable cell with the sight lines the pose solver demands (8 of 9 rays clear at both eye heights); same room, same level */
  | 'derived'
  /** the anchor is farther than a person can reasonably stand to (the street, the roof, an aerial hint): the person stays on the nearest ground
   *  stand and the card says how far the subject is. Never in the air, never in a wall. */
  | 'held'
  /** another storey with no stair on the baked route, or a walk over 60 m: the person is carried by a blink, like every other beat; nothing is walked */
  | 'cut';

/** where the person's FEET go (metres, world). The head ends above it at the person's own standing or seated height, so a tall or seated
 *  person is not shrunk or lifted. `yaw` is the direction the head should face after the blink (radians about +y, 0 = -z, as three.js). */
export interface StandPose {
  feet: V3; yaw: number; level: string | null; kind: ReachKind;
  /** the subject's distance from the stand, metres (xr budget: 1.6 to 4.8 indoors, 3 to 9 outside, the same as poses.ts) */
  distance: number;
  /** verified at bake time against the world digest: the feet cell is walkable with clearance, the anchor is seen at standing (1.6) and seated (1.2) eye height */
  verified: { walkable: boolean; seen1_6: boolean; seen1_2: boolean };
}

export interface BlinkOptions {
  /** fade to black over this many ms (default XR_COMFORT.blinkOutMs) and back (XR_COMFORT.blinkInMs). The rig moves on a frame whose fade alpha is 1. */
  outMs?: number; inMs?: number;
  /** rotate the rig AROUND THE HEAD so the head's real facing becomes `stand.yaw` (a person looking over their shoulder is turned back to the subject). */
  faceStandYaw?: boolean;
}
export interface BlinkResult { ms: number; headMovedM: number; yawTurnedDeg: number; swapFrame: number }

/** queries against the baked world digest (assets/shot-world.ts, shot-probe.ts, createNav): THREE-free, so the same functions run in Node tests. */
export interface WorldProbe {
  floorY(x: number, z: number, level: string | null): number | null;
  walkable(x: number, z: number, level: string | null, clearance?: number): boolean;
  roomAt(p: V3): { room: string | null; level: string | null; indoors: boolean };
  /** is the straight segment a to b free of the house's hull (walls, slabs, roofs, closed doors); boxes in `ignore` do not count */
  segmentClear(a: V3, b: V3, ignore?: Box6[]): boolean;
  /** the hull boxes a card must stay out of */
  hull(): Box6[];
  /** the nearest stand that sees `focus` (poses.ts rules) from `from`; null when none exists */
  nearestStand(from: V3, focus: V3, q?: { minDist?: number; maxDist?: number; eyeHeights?: number[]; level?: string | null }): StandPose | null;
}

// ---- placement in 3D (the extension of assets/story/place.ts; pure, so it is unit-tested in Node) -----------------------------------
export interface PlaceWorldInput {
  /** the head after the blink (world metres, and the unit direction it looks along on the ground plane) */
  head: V3; headYaw: number; eyeHeight: number;
  anchor: BeatView['anchor'];
  core: { box: Box6; centre: V3 } | null;
  /** the card's size in metres at the distance chosen by the solver is computed from `cardDeg` (see XR_LEGIBILITY.card) */
  cardAspect: number;
  textScale: number;
  world: WorldProbe;
  /** areas the card must stay off: the caption bar and the menu, as angular rects around the view axis (degrees, +x right, +y up) */
  reservedDeg: Array<{ x0: number; y0: number; x1: number; y1: number }>;
}
export interface PlaceWorldOut {
  /** card centre and the normal it faces (a yaw-only billboard with a slight tilt toward the head), width and height in metres */
  centre: V3; yaw: number; tiltDeg: number; widthM: number; heightM: number;
  /** the leader: from the card's nearest edge to the anchor's focus; `dashed` when the focus is hidden from the head by the hull */
  leader: { from: V3; to: V3; dashed: boolean } | null;
  /** 'card': a world-locked card beside the subject. 'sheet': no candidate fit, the card is a lazy-follow sheet below the horizon (the phone layout's cousin) */
  mode: 'card' | 'sheet';
}
export interface PlacementReport {
  mode: 'card' | 'sheet' | 'bottom-sheet' | 'corner';
  /** fractions of the subject's / the Core's projected rect covered by the card (xr: rect as seen by the head). Must be under MAX_OVERLAP. */
  overlapFocus: number; overlapCore: number; overlapBars: number;
  /** xr only */
  distanceM?: number; widthDeg?: number; offAxisDeg?: number; clearanceM?: number; headToCardClear?: boolean;
  ok: boolean;
}

// ============================================================================================================================
// 8. constants: the numbers behind the rules (PRESENTER.md sections 4 and 5 give the reasons and the sources)
// ============================================================================================================================
export const MAX_OVERLAP = 0.02;   // same as place.ts

/** angular legibility, degrees of visual angle subtended by the em (font size) of the text at the moment it is read. The kit converts with metres = distance * tan(deg). */
export const XR_LEGIBILITY = {
  /** nothing smaller than this is drawn, ever (chips, footers) */
  minEmDeg: 1.1,
  /** card body, button labels */
  bodyEmDeg: 1.4,
  /** captions are read while moving: larger */
  captionEmDeg: 1.6,
  /** card title, menu rows */
  titleEmDeg: 2.0,
  /** one-off headings (start and end cards) */
  headingEmDeg: 2.8,
  /** a pixel floor: the em must cover at least this many display pixels at the device's centre pixels-per-degree, else the kit raises the angular size */
  minEmPx: 16,
  /** interactive targets, degrees across: ray (controller), pinch with hand ray, gaze plus pinch (visionOS: no hover, coarser) */
  targetDeg: { ray: 3.5, handRay: 4.5, gazePinch: 5.0 },
  /** gap between neighbouring targets */
  targetGapDeg: 1.0,
  /** contrast: body on its backing */
  minContrast: 7,
  /** card width in degrees of visual angle: min, default, max; and the share of the field of view the whole UI may use at once */
  card: { minDeg: 22, defaultDeg: 32, maxDeg: 40 },
  /** distances in metres: nearest and farthest a panel may be placed, and the default for cards and for the head-following caption bar */
  distance: { min: 0.9, max: 3.0, card: 1.7, caption: 1.7, menu: 1.0 },
  /** caption bar: down from the horizon, how far the head may turn before it re-centres, how fast */
  caption: { belowHorizonDeg: 16, deadzoneDeg: 18, followS: 0.6, maxLines: 2, widthDeg: 34 },
} as const;

/** comfort: how a person is moved, in numbers */
export const XR_COMFORT = {
  blinkOutMs: 120, blinkInMs: 140,
  /** an enterBeat that takes longer than this (ms) is a defect; the Director shows a toast and the Presenter emits a 'fault' */
  enterBudgetMs: 450,
  /** a viewpoint change on a frame whose fade alpha is below this counts as visible motion */
  visibleFadeAlpha: 0.995,
  /** the largest per-frame head displacement (m) that is not counted as a viewpoint change (the person's own movement is not ours to judge) */
  headStepM: 0.003,
  snapTurnDeg: 30,
  /** no card nearer to the head than this (m) and none that the person must lean toward */
  minCardDistM: 0.9,
  /** guided auto-advance: the visible countdown before a blink, seconds */
  guidedCountdownS: 1.5,
} as const;

/** budgets for the xr presenter, enforced by the conformance test */
export const XR_BUDGET = { panels: 8, textureBytes: 24 * 1024 * 1024, drawCalls: 24, tickCpuMs: 0.3, enterMsP95: 450 } as const;

// ============================================================================================================================
// 9. three pure helpers (no state; used by the kit, the solver and the tests)
// ============================================================================================================================
export const degToRad = (d: number) => d * Math.PI / 180;
/** metres subtended by `deg` degrees of visual angle at `distM` metres */
export const metresAt = (deg: number, distM: number) => distM * Math.tan(degToRad(deg));
/** the em size in metres for a role at a distance, after the person's text scale; raised so that the em covers at least minEmPx at `ppd` pixels per degree */
export function emMetres(roleDeg: number, distM: number, textScale = 1, ppd = 20): number {
  const deg = Math.max(roleDeg * textScale, XR_LEGIBILITY.minEmPx / Math.max(1, ppd), XR_LEGIBILITY.minEmDeg);
  return metresAt(deg, distM);
}
