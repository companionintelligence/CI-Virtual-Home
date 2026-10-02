// assets/xr/host.ts : the seams between the XR packages. Types only (THREE objects are `any`, as everywhere in assets/).
//
//   xr-session    builds the XrHost, runs the frame loop, owns the Rig and the single restore point. Calls the other four.
//   xr-bake       implements XrBake   (the cheap representation of the house for a headset: merge, LOD, lights, static shadow).
//   xr-locomotion implements XrLocomotion + XrInput (controllers / hands / transient pointer, teleport, snap turn, dressing, doors).
//   xr-ui         implements XrUi      (panel kit, wrist menu, toasts, and the XR Presenter of PRESENTER.md).
//   platform      supplies PlatformProfile / XrBudget (assets/platform-types.ts).
//
// Byte-identical in every worktree (seeded by the orchestrator); a change is a contract change. Doc: xr/contract/XR-PLAN.md.
import type { XrBudget, XrTierName, XrGen } from '../platform-types.js';
import type { BlinkOptions, BlinkResult, Box6, V3, WorldProbe } from './presenter.js';

export type XrMode = 'vr' | 'ar';
export type Handedness = 'left' | 'right' | 'none';
export type TargetRayMode = 'tracked-pointer' | 'gaze' | 'screen' | 'transient-pointer';

/** What the live page hands the XR modules. Built once by xr-session from mountViewer's `api` plus viewer.ts closure accessors; the only door into the player. */
export interface XrHost {
  THREE: any; renderer: any; scene: any; camera: any /* persCamera */; canvas: HTMLCanvasElement; controls: any /* OrbitControls */;
  api: any;                                            // room-creator's mountViewer api (house(), dress(), houseInside(), setLighting(), ...)
  houseId(): string;
  /** anchors.shotWorld etc. Read live; NEVER re-digest after the static batch (measured: 1309 of 2200 boxes). */
  anchors(): any;
  markDirty(): void;                                   // the 2D player redraws when it comes back
  toast(msg: string): void;                            // the 2D toast; in a session xr-ui shows an in-world one instead
  now(): number;                                       // performance.now(): XR modules may read the clock (nothing they draw is a product frame)
  params: URLSearchParams;
  no: Set<string>;                                     // ?no=<feature> kill switches
}

/** One XR frame, handed to every module's tick in this order: input, locomotion, ui, bake. */
export interface XrFrame {
  time: number; dt: number;                            // dt: seconds from the XR time argument, clamped to 0.1, never THREE.Clock
  xrFrame: any | null;                                 // the XRFrame (null in tests that tick by hand)
  head: { pos: V3; dir: V3; yawDeg: number };          // world space (rig applied)
  presenting: boolean;
}

// ---------------------------------------------------------------------------------------------------------------- rig (xr-session)
/** The only thing that ever moves the person. persCamera is a child of rig.group for the length of a session; its pose is XR-owned, never written. */
export interface XrRig {
  readonly group: any;                                 // THREE.Group in the scene
  head(): { pos: V3; dir: V3; yawDeg: number };
  /** blink teleport to a standing place: `feet` is where the FEET go; the head ends above it at the person's own height (+ heightOffset). */
  moveTo(target: { feet: V3; yawDeg?: number }, o?: BlinkOptions & { signal?: AbortSignal; blink?: boolean }): Promise<BlinkResult>;
  /** rotate about the HEAD (so the person does not slide) with a short dip */
  snapTurn(dir: 1 | -1, deg?: number): Promise<BlinkResult>;
  /** 0 to 1 black over the view (a quad child of the camera); the presenter, the wall guard and blink all use it. */
  fade: { set(a: number): void; get(): number };
  /** seated/standing correction in metres, added to the rig height (persisted by xr-ui's settings) */
  heightOffset: number;
  /** the head's floor y and level at this moment, for the wall guard and dress */
  floorY(): number;
}

// ---------------------------------------------------------------------------------------------------------------- input (xr-locomotion)
export interface InputSourceInfo {
  id: number;                                          // stable for the life of the source (NOT the three.js controller index: on visionOS indices 0-1 are hands)
  handedness: Handedness; targetRayMode: TargetRayMode;
  hasThumbstick: boolean; isHand: boolean;
  hover: boolean;                                      // false for transient-pointer: no hover exists there
  haptics: boolean;
}
export interface Ray { origin: V3; dir: V3 }
export interface RayHit { dist: number; point: V3; uv?: [number, number]; normal?: V3 }
/** Anything the ray can touch. xr-ui registers panels (priority 100), xr-locomotion registers the floor (priority 0) and stair rings (50); the highest priority hit wins. */
export interface RayTarget {
  id: string; priority: number; enabled: boolean;
  hit(ray: Ray): RayHit | null;
  onHover?(sourceId: number, hit: RayHit | null): void;
  onPress?(sourceId: number, hit: RayHit): void;      // selectstart (fallback: select)
  onRelease?(sourceId: number, hit: RayHit | null, cancelled: boolean): void;   // selectend; null hit = left the target; cancelled = source removed / visibility change / session end
}
export interface XrInput {
  sources(): InputSourceInfo[];
  rayPose(sourceId: number): Ray | null;
  axes(sourceId: number): [number, number] | null;     // thumbstick, null without one
  button(sourceId: number, name: 'trigger' | 'squeeze' | 'primary' | 'secondary' | 'thumbstick'): { pressed: boolean; edge: -1 | 0 | 1 } | null;
  haptic(sourceId: number, intensity: number, ms: number): void;
  addTarget(t: RayTarget): () => void;
  /** the target the source currently points at (after priorities), for the ray visual and the hit dot */
  pointing(sourceId: number): { target: RayTarget; hit: RayHit } | null;
  on(ev: 'sources' | 'menu' | 'cancel', cb: () => void): () => void;
  update(f: XrFrame): void;
}

export interface XrLocomotion {
  /** after the session is up and the bake is applied: build the nav (15-17 ms for all storeys), open interior doors, place the person at the entry. */
  start(): Promise<void>;
  tick(f: XrFrame): void;
  /** teleport shortcuts for the wrist menu: one per room (nav.visitPoint) and per stair end */
  places(): Array<{ id: string; label: string; level: string | null; feet: V3; kind: 'room' | 'stairs-up' | 'stairs-down' | 'entry' | 'core' }>;
  goToPlace(id: string): Promise<BlinkResult>;
  world: WorldProbe;                                   // the same probe the story presenter uses (PRESENTER.md section 6)
  /** undo everything: doors, dress, comfort quad, listeners. Idempotent. */
  stop(): void;
}

// ---------------------------------------------------------------------------------------------------------------- bake (xr-bake)
export interface BakeReport {
  ms: number;
  calls: number; tris: number;                         // renderer.info after one stereo render, main pass only
  perEyeDraws: number; programs: number; textureMB: number;
  cells: number; hiddenMeshes: number; mergedMeshes: number; lightsKept: number;
  overBudget: null | { what: 'calls' | 'tris' | 'programs' | 'textureMB'; got: number; limit: number };
}
export interface XrBake {
  /** build the cheap representation behind the entry veil (20-50 ms of JS + a shader warm-up); the 2D player's meshes are hidden, not destroyed. */
  apply(budget: XrBudget, head: V3): Promise<BakeReport>;
  /** per teleport (never per frame): show the cells within lodRadius of the head, recompute nothing that recompiles a program */
  refocus(head: V3): void;
  /** the exact inverse of apply(): every visibility, material flag, light, shadow flag and renderer setting is put back. Idempotent. Called before any offline hook. */
  restore(): void;
  shadowNeedsUpdate(): void;                           // roof/door/lighting changed: one static shadow render on the next frame
  report(): BakeReport | null;
}

// ---------------------------------------------------------------------------------------------------------------- ui (xr-ui)
export interface XrUi {
  /** build panels (fonts loaded first), attach to the rig/scene. Resolves when the first frame can draw them. */
  mount(rig: XrRig, input: XrInput, loco: XrLocomotion | null): Promise<void>;
  tick(f: XrFrame): void;
  toast(text: string, kind?: 'info' | 'warn', ms?: number): void;
  /** the entry card (Preparing / Ready / "this home is too detailed for this headset") shown before the person is moved */
  showStatus(s: { title: string; body?: string; progress?: number } | null): void;
  /** the XR Presenter of PRESENTER.md, created lazily by the story director; null without the story branch */
  presenter(): import('./presenter.js').Presenter | null;
  unmount(): void;
}

// ---------------------------------------------------------------------------------------------------------------- the session (xr-session)
export type XrState = 'idle' | 'starting' | 'running' | 'ending';
export interface XrSessionApi {
  readonly state: XrState; readonly mode: XrMode | null;
  tier: { name: XrTierName; gen: XrGen | null } | null;
  /** must be called from a user gesture's call stack */
  enter(mode: XrMode): Promise<{ ok: true } | { ok: false; reason: 'unsupported' | 'insecure' | 'denied' | 'too-detailed' | 'error'; message: string }>;
  /** idempotent; callable from webglcontextlost, pagehide, beforeExternalRender, the Exit panel */
  end(why: string): Promise<void>;
  on(ev: 'starting' | 'started' | 'ended' | 'error', cb: (d: any) => void): () => void;
  /** the XR frame loop, for anything that must not run on window.requestAnimationFrame while presenting (the story Director's clock, TourStage.onFrame). */
  onFrame(cb: (f: XrFrame) => void): () => void;
  /** the in-world UI (the XR Presenter of PRESENTER.md lives behind ui().presenter()); null before the session started */
  ui(): XrUi | null;
  locomotion(): XrLocomotion | null;
}

/** CustomEvent 'vh:xr' on window: detail { state: 'starting'|'started'|'ended'|'error', mode, tier, reason? }. window.__houseViewer.xr is the XrSessionApi. */
export const XR_EVENT = 'vh:xr';
export type { BlinkOptions, BlinkResult, Box6, V3, WorldProbe };
