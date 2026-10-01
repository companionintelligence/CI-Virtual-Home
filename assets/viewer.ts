// The portal's player: room-creator.html?mode=view.
//
//   room-creator.html?mode=view&house=<id>[&shot=<shot>][&t=<0…1>][&tod=day|golden|dusk|night][&play=1|0]
//
// A link without shot opens on the house's Orbit. A link without t plays the shot from the start; one with t opens
// paused there. play=1 or play=0 says so outright, except that nothing starts moving by itself for a visitor whose
// system asks for reduced motion.
//
// A minimal, full-bleed player over the editor's renderer: pick a camera shot (listed from the house's own
// presets), play, pause and scrub it, change the time of day, show the camera path in the scene, and leave the
// path to fly the camera yourself. The editor's chrome is hidden by portal/viewer.css; this module builds the
// player's own and drives the page through the small `api` room-creator.html hands it (see its `mountViewer`
// call). Once mounted it owns the frame: room-creator's animate() calls `frame(delta)` and returns.
//
// Frames are the editor's frames. A shot is played by calling the page's own applySplineFrame(t) — the function
// the recorder and the headless renderer use — so the eye path, the ease, the dolly zoom, the roof fade and the
// Core waking are exactly what the videos show. The player only chooses t. Nothing here feeds a rendered
// product frame (the goldens and the frame-hash test never load ?mode=view), so it is free to use the clock.
//
// Fly mode: OrbitControls (the editor's own instance on the perspective camera) plus WASD / arrow keys to move,
// Q / E to sink and rise, Shift to hurry, the wheel to glide forward. Dragging the view enters it; Esc returns
// to the shot. Taking the camera pauses the shot: its own camera stays in the scene as a ghost, parked at the
// moment you left, and Play (or the scrubber) moves it along the path while you watch from wherever you are.
// The free camera keeps above the lot's ground: it can dive into a room, not under the house.
//
// Owner: S6 (ui) in pass 4's streams (it postdates the plan; S6 owns the editor and the portal's UI). It reads three
// v1 shot internals that S5's planner v2 changes — t as a 0–1 fraction of applySplineFrame's path, a 10 s duration
// fallback (shotDuration) and preset.power for the press — so when v2 lands S6 moves it onto window.__houseShotTrack
// (duration, events.pressT, events.enterT in seconds) rather than S5 editing it.
//
// Icons: path data from Lucide (lucide-react 0.469.0, ISC — see THIRD_PARTY.md), as in room-creator's sprite.
//
// Framing: shots are authored for 16:9 with a fixed vertical field of view, so a narrower window (a phone held
// upright) would crop them to a slot. The player widens the field of view for aspects narrower than 16:9
// (fitFov: halfway, in log terms, between keeping the vertical and keeping the horizontal field), after the page's
// applySplineFrame has set the shot's own. The eye path is the shot's; only how much of it the lens takes in
// changes, so a phone sees the house at the door and the Core with its desk at the end.
import { displayName, buildCredit } from './home-names.js';
import { createGlassSwap } from './viewer-glass.js';
import { bakeStatic, restoreStatic } from './viewer-batch.js';
import { mountPlatform } from './viewer-tier.js';

type Api = {
  THREE: any; scene: any; renderer: any; canvas: HTMLCanvasElement; camera: any; controls: any;
  TIME_OF_DAY: Record<string, { label: string }>; lightingName: (n?: string | null) => string;
  ready: Promise<unknown>;
  house: () => any;
  loadHouse: (id: string) => Promise<any>;
  useShot: (key: string) => void;         // a SplinePresets key, house:<id>:<shot>
  splines: () => { eye: any; target: any; shot: any };
  applyFrame: (t: number) => void;
  dress: (dressing: { walls: string; roof: string }, eye: any, target: any) => void;
  houseInside: (p: any) => boolean;
  lighting: () => string;
  setLighting: (name: string) => void;
  hideEditorHelpers: () => void;
  render: (hq: boolean) => void;
};

type IndexEntry = { id: string; name: string; author?: string; style?: string; storeys?: number; areaSqm?: number; source?: string };
type Shot = { key: string; type: string; preset: any; label: string };

const ICONS: Record<string, string> = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  replay: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  fly: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  sunrise: '<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  sunset: '<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
};
const icon = (name: string, cls = ''): string => `<svg class="vh-i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

// What a shot is called in the picker. The list itself comes from the house's presets (shotsFor, plus any
// alias or new shot type a spec or a later builder adds); this only prettifies the names it knows.
const SHOT_LABELS: Record<string, string> = { 'door-to-core': 'Door to Core', 'orbit': 'Orbit', 'hero-reveal': 'Hero reveal', 'walkthrough': 'Walkthrough', 'core-orbit': 'Core orbit' };
// what each shot does, for its chip's tooltip
const SHOT_HINTS: Record<string, string> = {
  'door-to-core': 'In through the front door to the Companion Core on the desk, then round it',
  'orbit': 'Round the whole house from above',
  'hero-reveal': 'Down onto the desk and the Companion Core',
  'walkthrough': 'Through each room, ending at the Companion Core',
  'core-orbit': 'Close round the Companion Core',
};
const TOD_ICONS: Record<string, string> = { day: 'sun', golden: 'sunrise', dusk: 'sunset', night: 'moon' };
const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const FLY_SPEED = 4;          // m/s; Shift × 3
const DRAG_TO_FLY = 6;        // px of drag on the scene before it counts as taking the camera
const IDLE_MS = 2600;         // controls fade after this long without input while a shot plays
const IDLE_TOUCH_MS = 4000;   // on a touch screen, a little longer (a tap brings them back)
const REF_ASPECT = 16 / 9;    // the aspect the shots are framed for
const WIDE_CAP = !(new URLSearchParams(location.search).get('no') || '').split(',').includes('platform');   // fitFov's cap above 16:9
const CORE_URL = 'https://ci.computer';
const DEFAULT_SHOT = 'orbit';   // what a link without shot= opens on (onHouse)
const CORE_NAME = 'Companion Core (Hero)';   // the house builder's name for the desk's Core (the QA gate finds it by it too)
const FLY_FLOOR = 0.25;       // m: the lowest the free camera goes (the lot's ground is y = 0)

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
// whole seconds: the elapsed time counts up in them (floor), a duration is rounded
const clock = (w: number): string => { const m = Math.floor(w / 60), r = w % 60; return `${m}:${r < 10 ? '0' : ''}${r}`; };
const fmtNow = (s: number): string => clock(Math.floor(s + 1e-6));
const fmtWhole = (s: number): string => clock(Math.round(s));
// A shot's vertical field of view, widened for a window narrower than the 16:9 it was framed for: the geometric
// mean of keeping the vertical field (a 9:19.5 phone would see a 19° sliver across) and keeping the horizontal
// one (a 108° fisheye), so a phone held upright takes in about twice the width it would, capped at 80°.
function fitFov(fov: number, aspect: number): number {
  if (!(aspect > 0)) return fov;
  if (aspect >= REF_ASPECT) {
    // Wider than 16:9 (an ultrawide, a laptop with the dock beside it): the shot's vertical field would spread to 85° across at 2.39:1.
    // Past the point where it reaches 15 % more than the 16:9 horizontal field it stops spreading, so the extra width shows more of the
    // sides instead of stretching the middle (and the vertical field narrows). Up to there, and under ?no=platform, the shot's own.
    if (!WIDE_CAP) return fov;
    const h0 = Math.atan(Math.tan((fov * Math.PI) / 360) * REF_ASPECT), cap = h0 * 1.15;
    return Math.atan(Math.tan((fov * Math.PI) / 360) * aspect) <= cap ? fov : (2 * Math.atan(Math.tan(cap) / aspect) * 180) / Math.PI;
  }
  const k = Math.sqrt(REF_ASPECT / aspect);
  return Math.min(80, (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * k) * 180) / Math.PI);
}
const FLY_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown']);
const titleCase = (k: string): string => k.replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
function shotLabel(key: string, preset: any): string {
  const type = preset.type || key;
  if (SHOT_LABELS[key]) return SHOT_LABELS[key];
  if (key === type && SHOT_LABELS[type]) return SHOT_LABELS[type];
  return titleCase(key);
}

export function mountViewer(api: Api) {
  const { THREE, camera, controls, canvas } = api;
  const html = document.documentElement;
  const params = new URLSearchParams(location.search);
  // ?no=glass,adapt kills a live-only performance feature for A/B timing (each one falls back to what the player did before it)
  const no = new Set((params.get('no') || '').split(',').filter(Boolean));
  const coarse = matchMedia('(pointer: coarse)').matches;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  api.hideEditorHelpers();
  controls.minDistance = 0.25;   // a pinch never parks the camera on its own pivot

  // ------------------------------------------------------------------ DOM
  const host = document.getElementById('viewport-box') || document.body;
  const root = document.createElement('div');
  root.className = 'vh';
  root.dataset.state = 'loading';
  root.innerHTML = `
    <div class="vh-loading" role="status" aria-live="polite">
      <div class="vh-loading-card">
        <img class="vh-mark" src="./assets/brand/ci-logo-mark.svg" alt="" width="28" height="28">
        <h2 class="vh-loading-name">Loading</h2>
        <p class="vh-loading-meta"></p>
        <div class="vh-bar"><span></span></div>
        <p class="vh-loading-status">Building the house</p>
      </div>
      <div class="vh-error" hidden>
        ${icon('alert')}
        <h2>We could not open this home.</h2>
        <p class="vh-error-msg">Check the link, or pick a home from the gallery.</p>
        <a class="vh-btn vh-btn-primary" href="./index.html">See all homes</a>
      </div>
    </div>

    <header class="vh-top">
      <a class="vh-iconbtn vh-back" href="./index.html" aria-label="All homes" title="All homes">${icon('back')}</a>
      <div class="vh-title">
        <h1 class="vh-name">&nbsp;</h1>
        <p class="vh-meta"></p>
      </div>
      <div class="vh-actions">
        <button class="vh-iconbtn" data-act="prev" aria-label="Previous home" title="Previous home  [">${icon('prev')}</button>
        <button class="vh-iconbtn" data-act="next" aria-label="Next home" title="Next home  ]">${icon('next')}</button>
        <span class="vh-sep" aria-hidden="true"></span>
        <button class="vh-iconbtn" data-act="share" aria-label="Copy a link to this moment" title="Copy a link to this moment">${icon('link')}</button>
        <button class="vh-iconbtn vh-hide-compact" data-act="fullscreen" aria-label="Full screen" title="Full screen  Shift F">${icon('maximize', 'vh-i-max')}${icon('minimize', 'vh-i-min')}</button>
        <button class="vh-iconbtn vh-hide-coarse" data-act="help" aria-label="Keyboard shortcuts" title="Keyboard shortcuts  ?">${icon('help')}</button>
      </div>
    </header>

    <div class="vh-flybar" role="group" aria-label="Free camera" inert>
      <span class="vh-flybar-label">${icon('fly')}<b>Free camera</b></span>
      <span class="vh-flybar-hint vh-hide-coarse">Drag to look. WASD to move, Q and E to sink and rise.</span>
      <span class="vh-flybar-hint vh-show-coarse">Drag to look. Pinch to move closer.</span>
      <button class="vh-pill vh-pill-quiet" data-act="cutaway" aria-pressed="false" title="Cut the roof and the walls you look through  C">Cutaway</button>
      <button class="vh-pill vh-pill-quiet" data-act="overview" title="See the whole path from above  O">Overview</button>
      <button class="vh-pill" data-act="exit-fly">Back to shot<kbd class="vh-hide-coarse">Esc</kbd></button>
    </div>

    <div class="vh-dock" role="group" aria-label="Player">
      <div class="vh-end" hidden role="group" aria-labelledby="vh-end-title">
        <h2 id="vh-end-title">Meet the Companion Core.</h2>
        <p><span class="vh-end-body">The small computer on the desk runs your own AI, apps and memory at home, not in someone else's cloud. </span><a href="${CORE_URL}" target="_blank" rel="noopener">What is Companion Core?${icon('out', 'vh-i-out')}</a></p>
        <div class="vh-end-actions">
          <button class="vh-end-btn" data-act="replay">${icon('replay')}<span>Replay</span></button>
          <button class="vh-end-btn" data-act="try-shot">${icon('play', 'vh-i-play')}<span class="vh-try-label"></span></button>
          <button class="vh-end-btn vh-end-primary" data-act="next">Next home${icon('next')}</button>
        </div>
      </div>
      <div class="vh-row vh-row-chips">
        <div class="vh-chips vh-shots" role="group" aria-label="Camera shot"></div>
        <div class="vh-chips vh-tods" role="group" aria-label="Time of day"></div>
      </div>
      <div class="vh-row vh-transport">
        <button class="vh-play" data-act="play" aria-label="Play">${icon('play', 'vh-i-play')}${icon('pause', 'vh-i-pause')}${icon('replay', 'vh-i-replay')}</button>
        <div class="vh-scrub">
          <input type="range" min="0" max="1000" step="1" value="0" aria-label="Seek">
          <span class="vh-scrub-mark" hidden data-label="The Core wakes"></span>
        </div>
        <span class="vh-time" aria-hidden="true"><span class="vh-now">0:00</span><span class="vh-dur"> / 0:00</span></span>
        <button class="vh-iconbtn vh-more" data-act="more" aria-label="More controls" aria-expanded="false" aria-controls="vh-tools" title="Speed, path, fly, quality">${icon('more')}</button>
        <div class="vh-tools" id="vh-tools" role="group" aria-label="Playback">
          <button class="vh-tool" data-act="speed" aria-label="Playback speed" title="Playback speed">${icon('gauge', 'vh-show-compact')}<span class="vh-show-compact">Speed</span><b class="vh-speed-val">1×</b></button>
          <button class="vh-tool" data-act="path" aria-pressed="false" title="Show the camera path  P">${icon('route')}<span>Path</span></button>
          <button class="vh-tool" data-act="fly" aria-pressed="false" title="Fly the camera yourself  F">${icon('fly')}<span>Fly</span></button>
          <button class="vh-tool" data-act="hq" aria-pressed="false" title="Best quality: ambient occlusion, bloom and colour grading. Slower on most devices.">${icon('sparkles', 'vh-i-hq')}${icon('loader', 'vh-i-busy')}<span>Best quality</span></button>
          <button class="vh-tool vh-show-compact" data-act="fullscreen" title="Full screen">${icon('maximize', 'vh-i-max')}${icon('minimize', 'vh-i-min')}<span>Full screen</span></button>
        </div>
      </div>
    </div>

    <div class="vh-toast" role="status" aria-live="polite"></div>

    <div class="vh-help" hidden role="dialog" aria-label="Keyboard shortcuts">
      <div class="vh-help-head"><b>Keyboard</b><button class="vh-iconbtn" data-act="help" aria-label="Close">${icon('x')}</button></div>
      <dl>
        <dt><kbd>Space</kbd></dt><dd>Play or pause</dd>
        <dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Back or forward 1 s (Shift: 5 s)</dd>
        <dt><kbd>Home</kbd> <kbd>End</kbd></dt><dd>Start or end of the shot</dd>
        <dt><kbd>1</kbd>…<kbd>9</kbd></dt><dd>Pick a shot</dd>
        <dt><kbd>T</kbd></dt><dd>Next time of day</dd>
        <dt><kbd>P</kbd></dt><dd>Show the camera path</dd>
        <dt><kbd>F</kbd></dt><dd>Fly the camera yourself</dd>
        <dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dt><dd>Move while flying (Shift: faster)</dd>
        <dt><kbd>Q</kbd> <kbd>E</kbd></dt><dd>Sink and rise while flying</dd>
        <dt><kbd>O</kbd></dt><dd>Overview of the whole path</dd>
        <dt><kbd>C</kbd></dt><dd>Cutaway: open the house while flying</dd>
        <dt><kbd>Esc</kbd></dt><dd>Back to the shot</dd>
        <dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Previous or next home</dd>
        <dt><kbd>Shift</kbd> <kbd>F</kbd></dt><dd>Full screen</dd>
      </dl>
      <p class="vh-help-legend"><span class="vh-help-tick" aria-hidden="true"></span>The orange tick on the timeline is where the Companion Core wakes.</p>
    </div>`;
  host.appendChild(root);
  html.dataset.viewer = 'mounted';

  const $ = <T extends Element = HTMLElement>(sel: string): T => root.querySelector(sel) as T;
  const el = {
    loading: $('.vh-loading'), loadingName: $('.vh-loading-name'), loadingMeta: $('.vh-loading-meta'), loadingCard: $('.vh-loading-card'),
    error: $('.vh-error'), errorMsg: $('.vh-error-msg'),
    name: $('.vh-name'), meta: $('.vh-meta'),
    shots: $('.vh-shots'), tods: $('.vh-tods'),
    play: $('.vh-play'), scrub: $<HTMLInputElement>('.vh-scrub input'), mark: $('.vh-scrub-mark'),
    now: $('.vh-now'), dur: $('.vh-dur'), speed: $('[data-act="speed"]'), speedVal: $('.vh-speed-val'),
    path: $('[data-act="path"]'), fly: $('[data-act="fly"]'), hq: $('[data-act="hq"]'),
    toast: $('.vh-toast'), help: $('.vh-help'), flybar: $('.vh-flybar'), more: $('[data-act="more"]'), tools: $('.vh-tools'),
    end: $('.vh-end'), tryShot: $<HTMLButtonElement>('[data-act="try-shot"]'), tryLabel: $('.vh-try-label'),
    dock: $('.vh-dock'), top: $('.vh-top'),
  };
  const fsEnabled = !!(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);
  if (!fsEnabled) for (const b of root.querySelectorAll<HTMLElement>('[data-act="fullscreen"]')) b.hidden = true;

  // ------------------------------------------------------------------ state
  let index: IndexEntry[] = [];
  let houseId = '';
  let shots: Shot[] = [];
  let shot: Shot | null = null;
  let t = 0;                 // shot fraction, 0…1 (what applySplineFrame takes)
  let playing = false;
  let rate = 1;
  let flying = false;
  let showPath = false, pathTouched = false;
  let hq = false;
  // The plain path draws its panes without the transmission pass (viewer-glass.ts); Best quality and anything drawn
  // through the page's __houseRender* hooks get the transmissive glass back.
  const glass = createGlassSwap(THREE, api.scene, !no.has('glass'));
  let tod: string | null = null;   // the viewer's choice; null = the house's own hour
  let ready = false;
  let dirty = true;          // something changed: draw a frame even while paused
  let loadToken = 0;
  let scrubbing = false;
  let moreOpen = false;       // the phone's sheet of tools (speed, path, fly, quality, full screen)
  let hqWarm = false, hqFirst = false;   // the first best-quality frame builds the composer: say so while it does
  let endPlaced = false;      // the end card has been put where it does not cover the Core (placeEndCard)
  let flyHinted = false;      // the free camera's how-to has been said once where the bar has no room for it

  // room-creator.html's head script asked for the list as the page started (window.__vhIndex); fetch it only
  // when the player was mounted some other way
  const indexReady: Promise<IndexEntry[]> = Promise.resolve((window as any).__vhIndex || fetch('./content/houses/index.json').then(r => (r.ok ? r.json() : null)))
    .then((j: any) => (index = (j && j.houses) || []), () => (index = []));

  // ------------------------------------------------------------------ scene overlays: the path and the ghost camera
  const cssColor = (name: string, fallback: string): any => new THREE.Color((getComputedStyle(root).getPropertyValue(name) || '').trim() || fallback);
  const COLORS = { eye: cssColor('--vh-path-eye', '#ff3f00'), target: cssColor('--vh-path-target', '#00a9a7'), ray: cssColor('--vh-path-ray', '#e8f2f4'), halo: cssColor('--vh-path-halo', '#041620') };
  function discTexture(ring: boolean) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
    g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2);
    if (ring) { g.lineWidth = 9; g.strokeStyle = '#fff'; g.stroke(); } else { g.fillStyle = '#fff'; g.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  }
  const DISC = discTexture(false), RING = discTexture(true);
  const overlayMat = (m: any) => { m.transparent = true; m.depthTest = false; m.depthWrite = false; m.fog = false; m.toneMapped = false; return m; };
  const lineMat = (color: any, opacity: number) => overlayMat(new THREE.LineBasicMaterial({ color, opacity }));
  const dotMat = (color: any, size: number, map = DISC, opacity = 1) => overlayMat(new THREE.PointsMaterial({ color, size, map, opacity, sizeAttenuation: false, alphaTest: 0.02 }));
  const helper = (o: any, order: number) => { o.renderOrder = order; o.frustumCulled = false; o.raycast = () => {}; o.userData.isHelper = true; return o; };
  const pointsOf = (pts: any[]) => new THREE.BufferGeometry().setFromPoints(pts);

  let pathGroup: any = null;
  const nowTarget = helper(new THREE.Points(pointsOf([new THREE.Vector3()]), dotMat(COLORS.target, 11, RING)), 1004);
  nowTarget.name = 'viewer: look target';
  // the ghost: the shot's own camera, drawn as a small frustum while you fly beside it
  const ghost = new THREE.Group(); ghost.name = 'viewer: shot camera'; ghost.userData.isHelper = true;
  const ghostFrustum = helper(new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(COLORS.eye, 1)), 1005);
  const ghostEye = helper(new THREE.Points(pointsOf([new THREE.Vector3()]), dotMat(COLORS.eye, 9)), 1005);
  ghost.add(ghostFrustum, ghostEye);
  const ghostRay = helper(new THREE.Line(pointsOf([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), lineMat(COLORS.eye, 0.55)), 1003);
  ghost.visible = ghostRay.visible = nowTarget.visible = false;
  api.scene.add(ghost, ghostRay, nowTarget);
  let ghostFov = -1, ghostAspect = -1;
  function shapeGhost(fov: number, aspect: number) {
    if (Math.abs(fov - ghostFov) < 0.01 && Math.abs(aspect - ghostAspect) < 0.001) return;
    ghostFov = fov; ghostAspect = aspect;
    const d = 0.55, h = d * Math.tan((fov * Math.PI) / 360), w = h * aspect;
    const o = [0, 0, 0], c = [[-w, h, -d], [w, h, -d], [w, -h, -d], [-w, -h, -d]], up = [[-w * 0.35, h * 1.12, -d], [0, h * 1.5, -d], [w * 0.35, h * 1.12, -d]];
    const seg: number[] = [];
    for (const k of c) seg.push(...o, ...k);
    for (let i = 0; i < 4; i++) seg.push(...c[i], ...c[(i + 1) % 4]);
    seg.push(...up[0], ...up[1], ...up[1], ...up[2], ...up[2], ...up[0]);
    ghostFrustum.geometry.dispose();
    ghostFrustum.geometry = new THREE.BufferGeometry();
    ghostFrustum.geometry.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  }

  function disposePath() {
    if (!pathGroup) return;
    api.scene.remove(pathGroup);
    pathGroup.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pathGroup = null;
  }
  // The shot's path, in the scene: the eye path (a line, a dot every 40 cm, a ring at each eye waypoint), the
  // look-target path the same way in the second colour, and a faint ray from eye to target every 1/18 of the
  // shot, so the pairing between the two reads. Drawn over everything (no depth test): the point of the path is
  // to see it through the walls it threads.
  //
  // It is traced from the shot itself, not redrawn from its control points: a preset that carries its own
  // frame function (frameAt(t, aspect) → { eye, target }, a shot with per-waypoint timing) is sampled through
  // it, so the drawn path is the one the camera flies; otherwise the page's eye and target splines are.
  function tracePath(): { eyes: any[]; targets: any[]; rays: any[] } {
    const p = shot!.preset;
    const { eye, target } = api.splines();
    const at = typeof p.frameAt === 'function'
      ? (t: number) => { const f = p.frameAt(t, camera.aspect); return [f.eye.clone(), f.target.clone()]; }
      : eye && target ? (t: number) => [eye.getPointAt(t), target.getPointAt(t)] : null;
    if (!at) return { eyes: [], targets: [], rays: [] };
    const N = 480, eyes: any[] = [], targets: any[] = [], rays: any[] = [];
    for (let i = 0; i <= N; i++) { const [e, g] = at(i / N); eyes.push(e); targets.push(g); if (i % (N / 24) === 0) rays.push(e, g); }
    return { eyes, targets, rays };
  }
  // points every `step` metres along a polyline
  function spaced(line: any[], step: number): any[] {
    if (!line.length) return [];
    const out = [line[0].clone()];
    let need = step;   // distance to the next dot
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], d = a.distanceTo(b);
      let from = 0;
      while (d - from >= need) { from += need; out.push(a.clone().lerp(b, from / d)); need = step; }
      need -= d - from;
    }
    return out;
  }
  function buildPath() {
    disposePath();
    if (!shot) return;
    const { eyes, targets, rays } = tracePath();
    if (eyes.length < 2) return;
    const g = new THREE.Group(); g.name = 'viewer: camera path'; g.userData.isHelper = true;
    g.add(helper(new THREE.Line(pointsOf(eyes), lineMat(COLORS.halo, 0.35)), 999));
    g.add(helper(new THREE.Line(pointsOf(eyes), lineMat(COLORS.eye, 0.95)), 1000));
    g.add(helper(new THREE.Line(pointsOf(targets), lineMat(COLORS.target, 0.8)), 1000));
    const eyeDots = spaced(eyes, 0.4), tgtDots = spaced(targets, 0.4);
    g.add(helper(new THREE.Points(pointsOf(eyeDots), dotMat(COLORS.halo, 7, DISC, 0.55)), 1001));
    g.add(helper(new THREE.Points(pointsOf(eyeDots), dotMat(COLORS.eye, 4.5)), 1002));
    g.add(helper(new THREE.Points(pointsOf(tgtDots), dotMat(COLORS.target, 3.5)), 1002));
    g.add(helper(new THREE.LineSegments(pointsOf(rays), lineMat(COLORS.ray, 0.28)), 998));
    const p = shot.preset;
    // a plumb line from each eye waypoint to the floor below it, so a height reads as a height
    const floors = ((api.house() || {}).spec || {}).levels || [];
    const floorUnder = (v: any) => floors.reduce((y: number, l: any) => (l.y || 0) <= v.y - 0.3 && (l.footprint || []).some((r: any) => v.x >= r.x && v.x <= r.x + r.w && v.z >= r.z && v.z <= r.z + r.d) ? Math.max(y, l.y || 0) : y, 0);
    const plumbs: any[] = [];
    let last: any = null;   // one every 1.2 m at most: an orbit's close-set waypoints would read as a fence
    for (const v of p.eyePoints || []) {
      const y = floorUnder(v);
      if (v.y - y <= 0.4 || (last && Math.hypot(v.x - last.x, v.z - last.z) < 1.2)) continue;
      plumbs.push(v, new THREE.Vector3(v.x, y, v.z)); last = v;
    }
    g.add(helper(new THREE.LineSegments(pointsOf(plumbs), lineMat(COLORS.eye, 0.35)), 998));
    g.add(helper(new THREE.Points(pointsOf(p.eyePoints || []), dotMat(COLORS.halo, 14, DISC, 0.45)), 1002));
    g.add(helper(new THREE.Points(pointsOf(p.eyePoints || []), dotMat(COLORS.eye, 11, RING)), 1003));
    g.add(helper(new THREE.Points(pointsOf(p.targetPoints || []), dotMat(COLORS.target, 9, RING)), 1003));
    g.visible = showPath;
    pathGroup = g;
    api.scene.add(g);
  }

  // ------------------------------------------------------------------ helpers over the page
  const shotDuration = (): number => (shot && shot.preset.duration) || 10;
  const houseEntry = (id: string): IndexEntry | undefined => index.find(h => h.id === id);
  function metaParts(e: { author?: string; storeys?: number; areaSqm?: number }): [string, string] {
    const facts: string[] = [];
    if (e.storeys) facts.push(`${e.storeys} ${e.storeys === 1 ? 'storey' : 'storeys'}`);
    if (e.areaSqm) facts.push(`${e.areaSqm} m²`);
    return [e.author ? `By ${e.author}` : '', facts.join(' · ')];
  }
  const metaLine = (e: { author?: string; storeys?: number; areaSqm?: number }): string => metaParts(e).filter(Boolean).join(' · ');
  function listShots(): Shot[] {
    const h = api.house(); if (!h) return [];
    const seen = new Set<any>(), out: Shot[] = [];
    for (const [key, preset] of Object.entries<any>(h.shots || {})) {
      if (!preset || !preset.eyePoints || seen.has(preset)) continue;   // an alias points at the same object
      seen.add(preset);
      out.push({ key, type: preset.type || key, preset, label: shotLabel(key, preset) });
    }
    return out;
  }
  function findShot(q: string | null): Shot | null {
    if (!q) return null;
    const h = api.house();
    const preset = h && h.shots && h.shots[q];
    return shots.find(s => s.key === q || s.type === q || (preset && s.preset === preset)) || null;
  }

  // ------------------------------------------------------------------ URL
  function url(withT: boolean): string {
    const q = new URLSearchParams();
    q.set('mode', 'view'); q.set('house', houseId);
    if (shot) q.set('shot', shot.key);
    if (withT) q.set('t', t.toFixed(3));
    q.set('tod', tod || api.lighting());
    return `${location.pathname}?${q.toString()}`;
  }
  const syncUrl = () => { try { history.replaceState(null, '', url(false)); } catch { /* sandboxed */ } };
  // What the share button hands out. Deployed, that is homes/<id>.html: scripts/build-portal.mts writes one page
  // per home carrying the home's own title, description and thumbnail for link previews (which never run this
  // script, so they would otherwise show the editor's title), and it forwards here with the query. It marks the
  // built room-creator.html with <meta name="vh-share" content="homes/">; a checkout served as it is has no such
  // pages, and shares this page's own URL.
  const sharePages = (document.querySelector('meta[name="vh-share"]') as HTMLMetaElement | null)?.content || '';
  function shareUrl(): string {
    if (!sharePages || !/^[a-z0-9-]+\/$/.test(sharePages)) return new URL(url(true), location.href).href;
    const q = new URLSearchParams(new URL(url(true), location.href).search);
    q.delete('mode'); q.delete('house');
    return new URL(`./${sharePages}${encodeURIComponent(houseId)}.html?${q.toString()}`, location.href).href;
  }

  // ------------------------------------------------------------------ building the chips
  function renderShots() {
    el.shots.replaceChildren(...shots.map((s, i) => {
      const b = document.createElement('button');
      b.className = 'vh-chip'; b.type = 'button'; b.dataset.shot = s.key;
      b.title = `${SHOT_HINTS[s.type] || s.label}  ${i + 1}`;
      const name = document.createElement('span'); name.textContent = s.label;
      const d = document.createElement('small'); d.textContent = `${Math.round(s.preset.duration || 10)} s`;
      b.append(name, d);
      b.addEventListener('click', () => { selectShot(s, { play: true }); });
      return b;
    }));
  }
  function renderTods() {
    el.tods.replaceChildren(...Object.entries(api.TIME_OF_DAY).map(([key, p]) => {
      const b = document.createElement('button');
      b.className = 'vh-chip vh-chip-tod'; b.type = 'button'; b.dataset.tod = key; b.title = p.label;
      b.innerHTML = icon(TOD_ICONS[key] || 'sun');
      const span = document.createElement('span'); span.textContent = p.label; b.append(span);
      b.addEventListener('click', () => setTod(key));
      return b;
    }));
  }
  renderTods();

  function syncChips() {
    for (const b of el.shots.querySelectorAll<HTMLElement>('.vh-chip')) { const on = !!shot && b.dataset.shot === shot.key; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
    const cur = api.lighting();
    for (const b of el.tods.querySelectorAll<HTMLElement>('.vh-chip')) { const on = b.dataset.tod === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
    const active = el.shots.querySelector<HTMLElement>('.vh-chip.on');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ------------------------------------------------------------------ transport
  let shownT = -1, shownPlaying: boolean | null = null, shownEnded: boolean | null = null;
  let shownEndCard: boolean | null = null;
  function syncTransport(force = false) {
    const ended = !playing && t >= 1 && !(shot && shot.preset.closed);
    if (force || shownPlaying !== playing || shownEnded !== ended) {
      shownPlaying = playing; shownEnded = ended;
      root.dataset.playing = playing ? '1' : '0';
      root.dataset.ended = ended ? '1' : '0';
      el.play.setAttribute('aria-label', playing ? 'Pause' : ended ? 'Play again' : 'Play');
      el.play.title = playing ? 'Pause  Space' : ended ? 'Play again  Space' : 'Play  Space';
    }
    syncEndCard(ended);
    if (force || Math.abs(shownT - t) > 1e-4) {
      shownT = t;
      const d = shotDuration();
      el.scrub.value = String(Math.round(t * 1000));
      el.scrub.style.setProperty('--vh-fill', `${(t * 100).toFixed(2)}%`);
      el.scrub.setAttribute('aria-valuetext', `${fmtWhole(t * d)} of ${fmtWhole(d)}`);
      const now = fmtNow(t * d);
      if (el.now.textContent !== now) el.now.textContent = now;
    }
  }
  // The end of a shot is not a dead end: a card over the dock offers the shot again, another shot, the next
  // home, and a line on what the Companion Core is (every shot but the orbit ends on it). The title pill steps
  // back while it shows, so it does not sit over the payoff. Not while scrubbing through the end, or flying.
  function nextShotFor(s: Shot | null): Shot | null {
    const order = s && s.type === 'door-to-core' ? ['core-orbit', 'orbit'] : s && s.type === 'core-orbit' ? ['orbit', 'door-to-core'] : ['door-to-core', 'core-orbit', 'orbit'];
    for (const type of order) { const n = shots.find(x => x.type === type && x !== s); if (n) return n; }
    return shots.find(x => x !== s) || null;
  }
  function syncEndCard(ended: boolean) {
    const on = ended && !scrubbing && !flying && ready;
    if (on === shownEndCard) return;
    shownEndCard = on;
    el.end.hidden = !on;
    root.dataset.endcard = on ? '1' : '0';
    if (on) {
      endPlaced = false;   // placed after the end frame is drawn (frame())
      root.classList.remove('vh-idle', 'vh-chrome-off');
      const n = nextShotFor(shot);
      el.tryShot.hidden = !n;
      if (n) { el.tryLabel.textContent = n.label; el.tryShot.dataset.shot = n.key; el.tryShot.setAttribute('aria-label', `Play the ${n.label} shot`); }
      el.end.querySelector<HTMLElement>('.vh-end-primary')!.hidden = index.length < 2;
    }
  }
  // Where the end card goes. It sits centred over the dock; where that would cover the Core (a phone on its side,
  // whose card spans the dock just under the Core, or a 4:3 tablet) it moves to the end of the dock away from the
  // Core, as wide as the room there (never so narrow, or so tall, that it reaches the top bar); failing that it
  // drops its sentence on what the Core is (heading, link and buttons stay) where it stands, then at the side. If
  // nothing clears the Core, the placing that covers least of it wins. Run once the end frame has been drawn (the
  // Core's place on the screen is that frame's) and again when the window changes.
  const corner = new THREE.Vector3();
  function coreRect(): { l: number; t: number; r: number; b: number } | null {
    const core = api.scene.getObjectByName(CORE_NAME);
    if (!core) return null;
    const cb = canvas.getBoundingClientRect();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, behind = false;
    core.updateMatrixWorld(true);
    // each visible part's own box, projected: tighter than one world-aligned box round the lot
    core.traverseVisible((m: any) => {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m.matrixWorld).project(camera);
        if (corner.z > 1) behind = true;
        const x = cb.left + ((corner.x + 1) / 2) * cb.width, y = cb.top + ((1 - corner.y) / 2) * cb.height;
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
      }
    });
    if (behind) return null;   // the camera is inside or past it: nothing in the frame to cover
    l = Math.max(l, cb.left); r = Math.min(r, cb.right); t = Math.max(t, cb.top); b = Math.min(b, cb.bottom);
    return r > l && b > t ? { l, t, r, b } : null;
  }
  function placeEndCard() {
    endPlaced = true;
    const set = (side: string, w: number, compact: boolean) => {
      if (side) { root.dataset.endSide = side; el.end.style.setProperty('--vh-end-w', `${Math.floor(w)}px`); }
      else { delete root.dataset.endSide; el.end.style.removeProperty('--vh-end-w'); }
      if (compact) root.dataset.endCompact = '1'; else delete root.dataset.endCompact;
    };
    set('', 0, false);
    const core = coreRect();
    if (!core) return;
    const area = (core.r - core.l) * (core.b - core.t);
    const topBar = el.top.getBoundingClientRect().bottom + 4;
    // the share of the Core the card covers where it comes to rest (a card that would reach the top bar counts as
    // 1); the rect is taken while its rise-in animation still holds it a few pixels low, so that is taken off
    const cover = (): number => {
      const r = el.end.getBoundingClientRect(), tf = getComputedStyle(el.end).transform;
      const dy = tf && tf !== 'none' ? new DOMMatrixReadOnly(tf).m42 : 0;
      const c = { left: r.left, right: r.right, top: r.top - dy, bottom: r.bottom - dy };
      if (c.top < topBar) return 1;
      return (Math.max(0, Math.min(c.right, core.r) - Math.max(c.left, core.l)) * Math.max(0, Math.min(c.bottom, core.b) - Math.max(c.top, core.t))) / area;
    };
    const dock = el.dock.getBoundingClientRect(), GAP = 12, MIN = 260;
    const left = core.l - dock.left - GAP, right = dock.right - core.r - GAP;
    const side = left >= right ? 'left' : 'right', room = Math.min(540, Math.max(left, right));
    const tries: [string, number, boolean][] = [['', 0, false]];
    if (room >= MIN) tries.push([side, room, false]);
    tries.push(['', 0, true]);
    if (room >= MIN) tries.push([side, room, true]);
    let best = tries[0], least = Infinity;
    for (const tr of tries) {
      set(...tr);
      const c = cover();
      if (c < 0.01) return;
      if (c < least) { least = c; best = tr; }
    }
    set(...best);
  }
  function setPlaying(on: boolean) {
    if (on && t >= 1 && !(shot && shot.preset.closed)) t = 0;   // play at the end starts over
    playing = on;
    dirty = true;
    syncTransport();
    poke();
  }
  function seek(nt: number) {
    t = shot && shot.preset.closed ? ((nt % 1) + 1) % 1 : clamp01(nt);
    dirty = true;
    syncTransport();
  }
  function setRate(r: number) { rate = r; el.speedVal.textContent = `${r}×`; el.speed.setAttribute('aria-label', `Playback speed, ${r}×`); }

  function selectShot(s: Shot, { play = true, at = 0 }: { play?: boolean; at?: number } = {}) {
    shot = s;
    api.useShot(`house:${houseId}:${s.key}`);   // SplinePresets key: the page registers a house's shots under it
    t = clamp01(at);
    el.dur.textContent = ` / ${fmtWhole(shotDuration())}`;
    const pw = s.preset.power;
    if (pw && pw.at >= 0 && pw.at <= 1) {
      el.mark.hidden = false; el.mark.style.left = `${(pw.at * 100).toFixed(2)}%`;
      // the label hangs from the tick toward the middle of the bar, so it never runs past either end
      el.mark.dataset.side = pw.at > 0.6 ? 'end' : pw.at < 0.4 ? 'start' : '';
      // a finger cannot point at the tick to be told what it is: say it while the controls show at the start
      if (coarse && play) sayMark(3200);
    } else el.mark.hidden = true;
    buildPath();
    ghostFov = -1; ghostDirty = true;
    playing = play;
    dirty = true;
    syncChips(); syncTransport(true); syncUrl();
  }

  function setTod(key: string) {
    tod = key;
    api.setLighting(key);
    glass.sync();   // the window glow's twins are cloned from the panes as they are now
    dirty = true;
    syncChips(); syncUrl();
  }
  function cycleTod(step: number) {
    const keys = Object.keys(api.TIME_OF_DAY);
    const i = keys.indexOf(api.lighting());
    setTod(keys[(i + step + keys.length) % keys.length]);
  }

  function setPath(on: boolean, byUser = true) {
    showPath = on; if (byUser) pathTouched = true;
    if (pathGroup) pathGroup.visible = on;
    el.path.classList.toggle('on', on); el.path.setAttribute('aria-pressed', String(on));
    dirty = true;
  }
  // Best quality renders through the recorder's composer. Its first frame builds the composer and compiles its
  // shaders, which holds the page for a second or two: the button shows a spinner first (two frames, so it is
  // painted before the wait), and a toast says why playback may slow down.
  function setHq(on: boolean) {
    el.hq.classList.toggle('on', on); el.hq.setAttribute('aria-pressed', String(on));
    if (on && !hqWarm) {
      el.hq.classList.add('busy'); el.hq.setAttribute('aria-busy', 'true');
      // the transmissive glass comes back with the composer: its programs compile in the same held frame
      requestAnimationFrame(() => requestAnimationFrame(() => { if (el.hq.getAttribute('aria-pressed') !== 'true') { hqDone(); return; } glass.restore(); hq = true; hqFirst = true; dirty = true; }));
      return;
    }
    hq = on;
    if (on) { glass.restore(); toast('Best quality is on. Playback may be slower.'); }
    else glass.apply();   // (the swap is a program change, so it happens here and not per frame)
    dirty = true;
  }
  function hqDone() {
    el.hq.classList.remove('busy'); el.hq.removeAttribute('aria-busy');
  }

  // ------------------------------------------------------------------ fly
  const keys = new Set<string>();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function clearControlDeltas() {
    // OrbitControls accumulates a drag's rotation until its next update(); while the shot holds the camera
    // nothing calls update(), so a tap would otherwise bank a nudge that lands the next time you fly.
    if (controls._sphericalDelta) controls._sphericalDelta.set(0, 0, 0);
    if (controls._panOffset) controls._panOffset.set(0, 0, 0);
    if ('_scale' in controls) controls._scale = 1;
  }
  function enterFly({ keepDrag = false } = {}) {
    if (flying || !ready) return;
    if (!keepDrag) clearControlDeltas();
    flying = true;
    playing = false;
    setMore(false);
    root.dataset.fly = '1';
    el.flybar.inert = false;
    el.fly.classList.add('on'); el.fly.setAttribute('aria-pressed', 'true');
    if (!pathTouched) setPath(true, false);
    ghost.visible = ghostRay.visible = true;
    ghostDirty = true; dirty = true;
    flyAspect = camera.aspect;
    syncTransport();
    poke();
    // where the bar has no room for its how-to (a phone, a narrow window), say it once as a toast under the bar
    if (!flyHinted) {
      const hint = root.querySelector<HTMLElement>(`.vh-flybar-hint.${coarse ? 'vh-show-coarse' : 'vh-hide-coarse'}`);
      if (hint && getComputedStyle(hint).display === 'none') { flyHinted = true; toast(hint.textContent || '', 4000); }
    }
  }
  function exitFly() {
    if (!flying) return;
    flying = false;
    tween = null;
    setCutaway(false);
    keys.clear();
    clearControlDeltas();
    root.dataset.fly = '0';
    el.flybar.inert = true;
    if (el.flybar.contains(document.activeElement)) el.fly.focus();
    el.fly.classList.remove('on'); el.fly.setAttribute('aria-pressed', 'false');
    ghost.visible = ghostRay.visible = false;
    dirty = true;
    poke();
  }
  // The shot's camera at t, without taking the view: let applySplineFrame place the camera (and set the roof,
  // the walls and the Core for t, which is what the ghost's moment should look like), read it, put ours back.
  let ghostDirty = true;
  const saved = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), target: new THREE.Vector3(), fov: 42 };
  let ghostShotFov = 42;     // the shot's own field of view at the ghost's moment (before fitFov)
  let flyAspect = 0;         // the window's aspect the free camera's field of view was fitted to
  function placeGhost() {
    saved.pos.copy(camera.position); saved.quat.copy(camera.quaternion); saved.target.copy(controls.target); saved.fov = camera.fov;
    api.applyFrame(t);
    ghostShotFov = camera.fov;
    ghost.position.copy(camera.position); ghost.quaternion.copy(camera.quaternion);
    shapeGhost(fitFov(camera.fov, camera.aspect), camera.aspect);
    const ray = ghostRay.geometry.attributes.position;
    ray.setXYZ(0, camera.position.x, camera.position.y, camera.position.z);
    ray.setXYZ(1, controls.target.x, controls.target.y, controls.target.z);
    ray.needsUpdate = true;
    camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat); controls.target.copy(saved.target);
    if (camera.fov !== saved.fov) { camera.fov = saved.fov; camera.updateProjectionMatrix(); }
    ghostDirty = false;
  }
  function flyMove(delta: number): boolean {
    let f = 0, r = 0, u = 0;
    if (keys.has('w') || keys.has('arrowup')) f += 1;
    if (keys.has('s') || keys.has('arrowdown')) f -= 1;
    if (keys.has('d')) r += 1;
    if (keys.has('a')) r -= 1;
    if (keys.has('e')) u += 1;
    if (keys.has('q')) u -= 1;
    if (!f && !r && !u) return false;
    const speed = FLY_SPEED * (keys.has('shift') ? 3 : 1) * delta;
    camera.getWorldDirection(v1);
    v2.crossVectors(v1, UP).normalize();
    const move = v1.multiplyScalar(f * speed).addScaledVector(v2, r * speed).addScaledVector(UP, u * speed);
    camera.position.add(move); controls.target.add(move);
    return true;
  }
  // The floor under the free camera. Camera and target rise together, so the view keeps its direction: flying
  // down into the lawn slides you along it instead of through it.
  function keepAboveGround(): boolean {
    const dy = FLY_FLOOR - camera.position.y;
    if (dy <= 0) return false;
    camera.position.y += dy; controls.target.y += dy;
    return true;
  }
  // Overview: the free camera eases up to a ¾ aerial that holds the whole path (the thumbnail's framing, aimed
  // at the path instead of the house), so the route the shot flies reads at a glance.
  let tween: { t: number; dur: number; p0: any; p1: any; q0: any; q1: any } | null = null;
  function overview() {
    if (!flying) enterFly();
    const pts = pathGroup ? pathGroup.children[0].geometry.attributes.position : null;
    const box = new THREE.Box3();
    const h = api.house();
    if (pts) box.setFromBufferAttribute(pts);
    else if (h && h.anchors && h.anchors.bounds) { const b = h.anchors.bounds; box.set(new THREE.Vector3(b.minX, 0, b.minZ), new THREE.Vector3(b.maxX, 4, b.maxZ)); }
    if (box.isEmpty()) return;
    // the path, with room round it: a 2 m orbit of the Core is framed with its room, not filling the screen
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    sphere.radius = Math.max(sphere.radius, 5);
    // from the front of the house, swung 34° off the entry's axis, 40° up (the thumbnails' view)
    const out = (h && h.anchors && h.anchors.entry && h.anchors.entry.out) || [0, 1];
    const az = Math.atan2(out[0], out[1]) + (34 * Math.PI) / 180, elev = (40 * Math.PI) / 180;
    const vHalf = (camera.fov * Math.PI) / 360, hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const d = (sphere.radius / Math.sin(Math.min(vHalf, hHalf))) * 0.95;
    const p1 = sphere.center.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)).multiplyScalar(d));
    // aim a little below the centre: the dock covers the bottom of the frame, so the path sits above it
    const q1 = sphere.center.clone(); q1.y -= Math.tan(vHalf) * d * 0.12;
    tween = { t: 0, dur: 0.9, p0: camera.position.clone(), p1, q0: controls.target.clone(), q1 };
    clearControlDeltas();
    setCutaway(true);   // from above, the path is inside: open the house
    dirty = true;
  }
  function stepTween(delta: number): boolean {
    if (!tween) return false;
    tween.t = Math.min(1, tween.t + delta / tween.dur);
    const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, k);
    controls.target.lerpVectors(tween.q0, tween.q1, k);
    camera.lookAt(controls.target);
    if (tween.t >= 1) tween = null;
    return true;
  }
  function glide(amount: number) {
    camera.getWorldDirection(v1);
    const move = v1.multiplyScalar(amount);
    camera.position.add(move); controls.target.add(move);
    dirty = true;
  }
  // While flying the house is dressed for where you are, not for the shot's moment: walls up, the roof on from
  // outside and off once you are under it (ceilings show only while you are below them, as in a shot). The
  // cutaway opens it the way the game does, to see a path threaded through it: roofs off, and each exterior
  // wall you are looking through cut down (the page's own Sims rule, decided per wall per frame).
  let cutaway = false;
  function setCutaway(on: boolean) {
    cutaway = on;
    const b = root.querySelector('[data-act="cutaway"]');
    if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
    dirty = true;
  }
  function flyDress() {
    if (cutaway) { api.dress({ walls: 'sims', roof: 'off' }, camera.position, controls.target); return; }
    const inside = api.houseInside(camera.position);
    api.dress({ walls: 'up', roof: inside ? 'off' : 'on' }, camera.position, controls.target);
  }

  // ------------------------------------------------------------------ platform
  // What this device is and what to do about it (assets/platform.ts, assets/viewer-tier.ts): the start pixel ratio, the drawing-buffer cap and
  // the sun's map for its tier, set here, BEFORE the frame-rate controller below reads the ratio (so that is not edited); the promotion of a phone
  // that holds 60 fps, the 30 fps cap when nothing else is left, WebGL context loss, and the touch and gamepad controls. Player only.
  // ?no=platform is the player as it was.
  const platform = mountPlatform({
    api, no, root, toast, reducedMotion,
    act: {
      playPause: () => setPlaying(!playing), tod: () => cycleTod(1), back: () => exitFly(), enter: () => enterFly(), poke: () => poke(),
      shot: (step) => { const n = shots.length ? shots[(shots.indexOf(shot as Shot) + step + shots.length) % shots.length] : null; if (n) selectShot(n, { play: true }); },
      flying: () => flying, moving: () => playing || flying, settled: () => settled, ratio: () => pixelRatio, dirty: () => { dirty = true; },
      // after a context restore the sky (a PMREM render target) and the panes' copies are gone with the GPU's memory: bake the sky again
      // (the baker caches by preset, so move off it and back) and swap the new panes
      restored: () => { const cur = api.lighting(), other = Object.keys(api.TIME_OF_DAY).find(k => k !== cur); if (other) api.setLighting(other); api.setLighting(cur); glass.sync(); },
    },
  });

  // ------------------------------------------------------------------ the frame
  // Resolution follows the device: while the view moves, the presented frame rate (the rAF deltas, so the display's
  // own rate is its ceiling) is averaged over a window of ADAPT.window seconds and at least ADAPT.frames frames, and
  // a device below ADAPT.low fps steps its pixel ratio down (2 → 1.5 → 1.25 → 1). A 60 Hz screen at 40 fps stutters,
  // so the threshold sits well above 30. A step that does not buy at least ADAPT.gain more frames is undone and the
  // downward adaptation stops: a house is thousands of draw calls, and where the CPU is what limits the frame rate,
  // fewer pixels would only make the picture softer. Once, after ADAPT.upAfter seconds of at least ADAPT.upFps
  // (a brief hitch, such as the first window's shader compiles, does not lock the picture low), it steps back up to
  // the ratio it left, as one more trial: if that ratio cannot hold ADAPT.low it goes down again and stays. Never
  // below 1. ?no=adapt restores the first controller (1.5 s, 28 fps, 15 %, never up).
  // window.__houseViewer reports what it settled on.
  const ADAPT = no.has('adapt')
    ? { window: 1.5, frames: 0, low: 28, gain: 1.15, upAfter: Infinity, upFps: 58 }
    : { window: 0.75, frames: 30, low: 42, gain: 1.10, upAfter: 6, upFps: 58 };
  const renderer = api.renderer;
  let pixelRatio = renderer.getPixelRatio(), perfTime = 0, perfFrames = 0, trial: { fps: number; pr: number } | null = null, settled = false;
  let stepped: number | null = null, upSpent = 0, upTrial: number | null = null, upDone = false;   // the ratio left by the accepted step down; seconds at ≥ upFps; the ratio being tried again
  const stats: any = { fps: 0, pixelRatio, settled };
  (window as any).__houseViewer = stats;
  function setPixelRatio(pr: number) {
    pixelRatio = pr; stats.pixelRatio = pr;
    renderer.setPixelRatio(pr);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    dirty = true;
  }
  stats.setPixelRatio = setPixelRatio;   // the platform block's way to move the ratio without ADAPT's variable going stale
  function adapt(delta: number) {
    perfTime += delta; perfFrames++;
    if (perfTime < ADAPT.window || perfFrames < ADAPT.frames) return;
    const fps = perfFrames / perfTime, span = perfTime;
    stats.fps = Math.round(fps);
    perfTime = 0; perfFrames = 0;
    if (upTrial !== null) {   // the step back up: keep it if it still holds, else go down again for good
      if (fps < ADAPT.low) setPixelRatio(upTrial);
      upTrial = null; upDone = true; settled = stats.settled = true;
      return;
    }
    if (settled) {
      // settled below where it started: a long enough run at full speed earns one look at the ratio it gave up
      if (stepped !== null && !upDone && ADAPT.upAfter < Infinity) {
        upSpent = fps >= ADAPT.upFps ? upSpent + span : 0;
        if (upSpent >= ADAPT.upAfter) { const pr = pixelRatio; setPixelRatio(stepped); upTrial = pr; upSpent = 0; }
      }
      return;
    }
    if (trial) {
      if (fps < trial.fps * ADAPT.gain) { setPixelRatio(trial.pr); settled = stats.settled = true; }
      else stepped = trial.pr;   // kept (the next window may step again if it is still short)
      trial = null;
    } else if (fps < ADAPT.low && pixelRatio > 1) {
      trial = { fps, pr: pixelRatio };
      setPixelRatio(pixelRatio > 1.5 ? 1.5 : pixelRatio > 1.25 ? 1.25 : 1);
    } else if (fps >= ADAPT.low) settled = stats.settled = true;
  }
  // While the view moves, the sun's shadow map is redrawn every third frame rather than every frame (nothing in
  // a house moves but the camera, the roof's fade and the Core's fan); a still frame always redraws it. The
  // renderer's own setting is put back after every frame, so the page's __house* hooks render exactly as before.
  let shadowTick = 0;
  function render() {
    const moving = playing || flying;
    const auto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = !moving || shadowTick++ % 3 === 0;
    try { api.render(hq); } finally { renderer.shadowMap.autoUpdate = auto; }
    if (hqFirst) { hqFirst = false; hqWarm = true; hqDone(); toast('Best quality is on. Playback may be slower.'); }
  }
  // the shot's field of view, widened for a narrow window (fitFov); applySplineFrame puts the shot's own back
  // on every frame, so this never compounds
  function fitCamera() {
    const f = fitFov(camera.fov, camera.aspect);
    if (Math.abs(f - camera.fov) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
  }
  // The ghost fades in as the free camera leaves it: at the shot's own pose its frustum's far rectangle lies
  // exactly on the edges of the screen, and would draw a thin orange frame round the window.
  const GHOST_OPACITY = [ghostFrustum.material.opacity, ghostEye.material.opacity, ghostRay.material.opacity];
  function fadeGhost() {
    const d = camera.position.distanceTo(ghost.position);
    const k = Math.max(0, Math.min(1, (d - 0.4) / 1.2));
    ghost.visible = ghostRay.visible = k > 0.01;
    ghostFrustum.material.opacity = GHOST_OPACITY[0] * k;
    ghostEye.material.opacity = GHOST_OPACITY[1] * k;
    ghostRay.material.opacity = GHOST_OPACITY[2] * k;
  }

  let wasFlying = false;
  function frame(delta: number) {
    if ((delta = platform.tick(delta)) < 0) return;   // (a context lost, or the 30 fps cap between two frames)
    if (!ready) return;
    delta = Math.min(delta, 0.25);   // a tab that slept a minute does not skip the shot
    if (playing || flying) adapt(delta); else { perfTime = 0; perfFrames = 0; }
    let moved = false;
    if (playing) {
      const d = shotDuration(), t0 = t, pw = shot && shot.preset.power;
      t += (delta * rate) / d;
      if (pw && t0 < pw.at && t >= pw.at) sayMark();
      if (t >= 1) {
        if (shot && shot.preset.closed) t %= 1;
        else { t = 1; playing = false; poke(); }
      }
      moved = true;
      if (flying) ghostDirty = true;
      syncTransport();
    }
    if (flying) {
      if (ghostDirty || !wasFlying) placeGhost();
      // The free camera keeps the field of view it was given, until the window changes shape (a phone turned
      // while flying): then it takes the one the shot would have at the new aspect, not a portrait's wide lens
      // stretched across a landscape screen.
      if (Math.abs(camera.aspect - flyAspect) > 1e-3) {
        flyAspect = camera.aspect;
        const f = fitFov(ghostShotFov, camera.aspect);
        if (Math.abs(f - camera.fov) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
        dirty = true;
      }
      // the ghost keeps a readable size however far away you fly
      ghost.scale.setScalar(Math.max(0.7, Math.min(5, camera.position.distanceTo(ghost.position) / 9)));
      const walked = flyMove(delta) || stepTween(delta);
      const turned = controls.update();
      const floored = keepAboveGround();
      if (walked || turned || floored || !wasFlying || dirty || moved) { flyDress(); fadeGhost(); dirty = true; }
    } else if (moved || dirty || wasFlying) {
      api.applyFrame(t);
      fitCamera();
      dirty = true;
    }
    wasFlying = flying;
    // with the path showing, a ring marks what the shot is looking at right now (flying, the ghost's ray does)
    nowTarget.visible = showPath && !flying;
    if (nowTarget.visible && dirty) { const p = nowTarget.geometry.attributes.position; p.setXYZ(0, controls.target.x, controls.target.y, controls.target.z); p.needsUpdate = true; }
    if (dirty) { render(); dirty = false; }
    if (shownEndCard && !endPlaced) placeEndCard();
  }

  // ------------------------------------------------------------------ loading a house
  function showLoading(id: string) {
    const e = houseEntry(id);
    el.loadingName.textContent = e ? displayName(e) : 'Loading';
    el.loadingMeta.textContent = e ? metaLine(e) : '';
    // the poster: the head script set it on <html> for the first home (the root inherits it); a home the index
    // lists gets its own here, and an id it does not list asks for no picture at all
    if (e) root.style.setProperty('--vh-poster', `url("${new URL(`./portal/thumbs/${encodeURIComponent(id)}.webp`, location.href).href}")`);
    el.error.hidden = true; el.loadingCard.hidden = false;
    el.end.hidden = true; shownEndCard = false; root.dataset.endcard = '0';
    setMore(false);
    root.dataset.state = 'loading';
    html.dataset.viewer = 'mounted';
  }
  function showError(message: string) {
    el.loadingCard.hidden = true; el.error.hidden = false;
    el.errorMsg.textContent = message;
    root.dataset.state = 'error';
  }
  // Static batching (assets/viewer-batch.ts): once per house build, before the first frame it is drawn, the static opaque
  // meshes inside each toggle unit become a few merged meshes, so a weak CPU issues a fifth of the draw calls. Player only:
  // the recorder, the goldens and the editor never call it. ?no=batch skips it; a throw leaves the house as built.
  let batchedHouse: any = null;
  function batchHouse(h: any) {
    if (h === batchedHouse) return;   // (the failed-load path calls onHouse again with the house already on screen)
    batchedHouse = h;
    const stat = (window as any).__houseViewer;
    if (String(params.get('no') || '').split(',').includes('batch')) { stat.batch = null; return; }
    const bake = () => {
      const t0 = performance.now();   // the player's clock, for the report only: nothing drawn depends on it
      const r = bakeStatic(api.THREE, api.scene);
      r.ms = Math.round((performance.now() - t0) * 10) / 10;
      stat.batch = r;
    };
    try { bake(); } catch (err) {
      console.warn('viewer: static batching failed, the home is drawn as built', err);
      restoreStatic(); stat.batch = null;
    }
    // for the bench and the pixel check: flip the merged meshes in and out on the page that is open (A/B on one GPU state)
    stat.batchOn = (on: boolean) => { if (on && !stat.batch) bake(); else if (!on && stat.batch) { restoreStatic(); stat.batch = null; } dirty = true; return !!stat.batch; };
  }
  // Link the shaders before the loader lifts. The first render otherwise links every program (about 70 on a furnished
  // home) one after another inside one call, 1 to 1.5 s of frozen page with the loader already fading; here they link
  // on the driver's own threads (KHR_parallel_shader_compile) and the page keeps painting the loader meanwhile. The
  // shot's own first frame is put in place first, so the scene is what the first render draws: lights, dressing,
  // camera. It compiles every mesh's material, hidden or not, so the wall and roof states the dressing flips to later
  // are mostly there too; depth materials for the sun's map still compile in the first shadow render (a few, small).
  // Never a reason for an endless loader: an error or a stalled driver ends the wait (4 s) and the first render
  // compiles what is left as it always did. ?no=compile skips it (A/B timing).
  const COMPILE_WAIT_MS = 4000;
  // The compile in flight. three's compileAsync polls the scene it was given until every program is ready, so a second
  // home must not clear the scene (api.loadHouse) under that poll: goHouse waits for this first (bounded).
  let compiling: Promise<void> = Promise.resolve();
  async function precompile(s: Shot, at: number) {
    if ((params.get('no') || '').split(',').includes('compile') || typeof renderer.compileAsync !== 'function') return;
    let timer = 0;
    try {
      api.useShot(`house:${houseId}:${s.key}`);
      api.applyFrame(clamp01(at));
      fitCamera();
      // (its own catch: a compile that fails after the wait has ended must not become an unhandled rejection)
      const p: Promise<void> = Promise.resolve(renderer.compileAsync(api.scene, camera)).then(() => {}, err => { console.warn('viewer: precompile skipped', err); });
      compiling = p;
      await Promise.race([p, new Promise(r => { timer = window.setTimeout(r, COMPILE_WAIT_MS); })]);
    } catch (err) {
      console.warn('viewer: precompile skipped', err);
    } finally { window.clearTimeout(timer); }
  }
  async function onHouse({ shotKey = null as string | null, at = 0, play = true } = {}) {
    const token = loadToken;
    const h = api.house();
    batchHouse(h);
    houseId = h.id;
    const e = houseEntry(h.id);
    // the portal's name for the home (home-names.ts); the build's own title is in the tooltip, with the credit
    const own = { id: h.id, name: h.spec.name || (e && e.name) || h.id, author: h.spec.author || (e && e.author) };
    const name = displayName(own);
    el.name.textContent = name;
    // the credit, then the facts (which a phone's narrow bar drops)
    const [by, facts] = metaParts({ author: own.author, storeys: (e && e.storeys) || (h.spec.levels || []).length, areaSqm: h.spec.areaSqm || (e && e.areaSqm) });
    const factsEl = document.createElement('span'); factsEl.className = 'vh-meta-facts'; factsEl.textContent = by && facts ? ` · ${facts}` : facts;
    el.meta.replaceChildren(by, factsEl);
    el.name.title = [h.spec.style, buildCredit(own)].filter(Boolean).join('\n');
    el.meta.title = buildCredit(own);
    document.title = `${name} · Virtual homes`;
    if (tod) api.setLighting(tod);   // a building resets the hour to the spec's; keep the viewer's choice
    if (!hq) glass.apply();          // before the first frame of this house, so the transmission programs never compile in the plain path
    shots = listShots();
    renderShots();
    // A home opens on its Orbit: the whole house from above, which reads on every screen. Door to Core spends its
    // middle in doorways and stairwells, framed a metre from a wall, and is one tap away (and a link can ask for it).
    const s = findShot(shotKey) || findShot(DEFAULT_SHOT) || findShot('door-to-core') || shots[0];
    if (!s) { showError('This home has no camera shots.'); return; }
    await precompile(s, at);
    if (token !== loadToken) return;   // another home was asked for meanwhile: its own onHouse takes over
    ready = true;
    if (flying) exitFly();
    selectShot(s, { play, at });
    root.dataset.state = 'ready';
    html.dataset.viewer = 'ready';
    canvas.setAttribute('aria-label', `${name}, 3D view`);
  }
  async function goHouse(id: string) {
    if (!id || id === houseId) return;
    const token = ++loadToken;
    const keepType = shot ? shot.type : null;
    ready = false; playing = false;
    if (flying) exitFly();
    showLoading(id);
    // let the overlay paint before the build takes the main thread
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // a precompile of the home on screen may still be polling its scene: let it end (4 s at most) before the scene is cleared
    { let t = 0; await Promise.race([compiling, new Promise(r => { t = window.setTimeout(r, COMPILE_WAIT_MS); })]); window.clearTimeout(t); }
    if (token !== loadToken) return;
    try {
      await api.loadHouse(id);
    } catch (err) {
      if (token !== loadToken) return;
      console.warn('viewer: could not load', id, err);
      if (api.house()) { ready = true; root.dataset.state = 'ready'; toast('That home could not be opened.'); await onHouse({ shotKey: keepType, play: false }); }
      else showError('That home could not be opened. Pick another from the gallery.');
      return;
    }
    if (token !== loadToken) return;
    await onHouse({ shotKey: keepType, play: !reducedMotion });
  }
  function neighbour(step: number): string | null {
    if (!index.length) return null;
    const i = index.findIndex(h => h.id === houseId);
    return index[(i + step + index.length) % index.length].id;
  }

  // ------------------------------------------------------------------ chrome: toast, idle fade, help, share, fullscreen
  let toastTimer = 0;
  function toast(msg: string, ms = 2200) {
    el.toast.textContent = msg; el.toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.toast.classList.remove('on'), ms);
  }
  // the Core-wakes tick names itself for a moment: when the playhead reaches it, and on a touch screen when a
  // shot starts (with a mouse, pointing at the bar does)
  let markTimer = 0;
  function sayMark(ms = 2600) {
    if (el.mark.hidden) return;
    el.mark.classList.add('say');
    clearTimeout(markTimer); markTimer = window.setTimeout(() => el.mark.classList.remove('say'), ms);
  }
  // Controls fade while a shot plays and the input rests, as a video player's do: with a mouse, only once one
  // has been used on the page (a kiosk or a capture that touches nothing keeps them); on a touch screen, a little
  // after playback starts, and a tap on the scene brings them back. Never while a control has keyboard focus,
  // the sheet or the keyboard panel is open, or the pointer is over them.
  let idleTimer = 0, mouseSeen = false;
  window.addEventListener('mousemove', () => { mouseSeen = true; }, { passive: true });
  function poke() {
    root.classList.remove('vh-idle');
    clearTimeout(idleTimer);
    if (!coarse && !mouseSeen) return;
    idleTimer = window.setTimeout(() => {
      // (a touch screen leaves :hover on whatever was tapped last, so only a mouse's hover counts)
      if (playing && !flying && !moreOpen && el.help.hidden && !root.querySelector(coarse ? ':focus-visible' : '.vh-dock:hover, .vh-top:hover, :focus-visible')) root.classList.add('vh-idle');
    }, coarse ? IDLE_TOUCH_MS : IDLE_MS);
  }
  const chromeHidden = (): boolean => root.classList.contains('vh-idle') || root.classList.contains('vh-chrome-off');
  // the phone's sheet of tools: opens over the dock, closes on a press anywhere else, Esc, or a tool that
  // changes what you are looking at (fly, full screen)
  function setMore(on: boolean) {
    if (on === moreOpen) return;
    moreOpen = on;
    root.dataset.more = on ? '1' : '0';
    el.more.setAttribute('aria-expanded', String(on));
    if (on) { root.classList.remove('vh-idle'); clearTimeout(idleTimer); } else poke();
  }
  window.addEventListener('pointerdown', (e) => {
    if (moreOpen && !(e.target as HTMLElement).closest('.vh-tools, [data-act="more"]')) setMore(false);
  }, true);
  function toggleHelp(force?: boolean) {
    const open = force ?? el.help.hidden;
    el.help.hidden = !open;
    poke();
  }
  async function share() {
    const href = shareUrl();
    const title = el.name.textContent || 'Companion virtual home';
    if (coarse && (navigator as any).share) { try { await (navigator as any).share({ title, url: href }); return; } catch { /* dismissed: fall back to copying */ } }
    try { await navigator.clipboard.writeText(href); toast('Link copied. It opens at this moment.'); }
    catch {
      const ta = document.createElement('textarea'); ta.value = href; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch { /* no clipboard at all */ }
      ta.remove();
      toast(ok ? 'Link copied. It opens at this moment.' : href);
    }
  }
  function toggleFullscreen() {
    const d: any = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else { const e: any = html; (e.requestFullscreen || e.webkitRequestFullscreen).call(e).catch?.(() => {}); }
  }
  const onFs = () => { root.dataset.fullscreen = (document.fullscreenElement || (document as any).webkitFullscreenElement) ? '1' : '0'; dirty = true; };
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);

  // ------------------------------------------------------------------ input
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'play') setPlaying(!playing);
    else if (act === 'more') setMore(!moreOpen);
    else if (act === 'replay') { seek(0); setPlaying(true); }
    else if (act === 'try-shot') { const n = shots.find(x => x.key === b.dataset.shot); if (n) { selectShot(n, { play: true }); poke(); } }
    else if (act === 'speed') setRate(SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length]);
    else if (act === 'path') setPath(!showPath);
    else if (act === 'fly') { setMore(false); flying ? exitFly() : enterFly(); }
    else if (act === 'exit-fly') exitFly();
    else if (act === 'overview') overview();
    else if (act === 'cutaway') { if (!flying) enterFly(); setCutaway(!cutaway); }
    else if (act === 'hq') setHq(!hq);
    else if (act === 'prev') goHouse(neighbour(-1)!);
    else if (act === 'next') goHouse(neighbour(1)!);
    else if (act === 'share') share();
    else if (act === 'fullscreen') { setMore(false); toggleFullscreen(); }
    else if (act === 'help') toggleHelp();
  });
  // A pointer press leaves focus on the control, and Space would then press the button again (or the arrows
  // nudge the slider a thousandth) instead of reaching the player: hand focus back to the page after a pointer
  // press. Keyboard focus never passes through here, so tabbing keeps working.
  root.addEventListener('pointerup', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('button, input[type="range"]'); if (b) setTimeout(() => b.blur(), 0); });
  // any press on the controls counts as the viewer being there (the idle fade waits)
  root.addEventListener('pointerdown', () => poke());

  // scrubbing pauses, and picks up again where you let go if it was playing
  let scrubResume = false;
  const scrubStart = () => { if (scrubbing) return; scrubbing = true; scrubResume = playing; playing = false; syncTransport(); };
  const scrubEnd = () => { if (!scrubbing) return; scrubbing = false; if (scrubResume && t < 1) setPlaying(true); else syncTransport(); };
  el.scrub.addEventListener('pointerdown', scrubStart);
  el.scrub.addEventListener('input', () => { seek(Number(el.scrub.value) / 1000); if (flying) ghostDirty = true; poke(); });
  el.scrub.addEventListener('change', scrubEnd);
  el.scrub.addEventListener('pointerup', scrubEnd);
  el.scrub.addEventListener('pointercancel', scrubEnd);

  // the scene: drag takes the camera; a click plays or pauses (a tap on a touch screen shows or hides the controls)
  let press: { x: number; y: number; moved: boolean; touch: boolean; hidden: boolean } | null = null;
  // (a touch does not poke on the way down: whether the tap shows or hides the controls depends on how they
  // were before it)
  canvas.addEventListener('pointerdown', (e) => { if (!ready) return; const touch = e.pointerType === 'touch'; press = { x: e.clientX, y: e.clientY, moved: false, touch, hidden: chromeHidden() }; if (!touch) poke(); });
  window.addEventListener('pointermove', (e) => {
    if (!press || press.moved) { if (!coarse) poke(); return; }
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_TO_FLY) { press.moved = true; if (!flying) enterFly({ keepDrag: true }); }
  });
  window.addEventListener('pointerup', () => {
    if (!press) return;
    const p = press; press = null;
    if (p.moved || flying) return;
    clearControlDeltas();
    if (p.touch) { root.classList.remove('vh-idle'); root.classList.toggle('vh-chrome-off', !p.hidden); if (p.hidden) poke(); }
    else setPlaying(!playing);
  });
  // the wheel glides forward while flying (and starts flying); OrbitControls would only dolly toward its target
  host.addEventListener('wheel', (e) => {
    if (e.target !== canvas || !ready) return;
    e.preventDefault(); e.stopPropagation();
    if (!flying) enterFly();
    glide(Math.max(-2, Math.min(2, -e.deltaY * (e.deltaMode === 1 ? 0.2 : 0.006))));
  }, { capture: true, passive: false });

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    poke();
    if (k === 'shift') { keys.add('shift'); return; }
    if (!ready) return;
    const onRange = tag === 'INPUT';
    // Space (and Enter) on a focused button or link is that control's own key: a keyboard user who tabs to Path
    // and presses Space means Path. (A pointer press hands focus back to the page, below, so Space still plays.)
    const onControl = tag === 'BUTTON' || tag === 'A';
    if ((k === ' ' || k === 'spacebar') && !onControl) { e.preventDefault(); setPlaying(!playing); return; }
    if ((k === ' ' || k === 'spacebar' || k === 'enter') && onControl) return;
    if ((k === 'arrowleft' || k === 'arrowright') && !onRange) { e.preventDefault(); const step = (e.shiftKey ? 5 : 1) / shotDuration(); seek(t + (k === 'arrowleft' ? -step : step)); if (flying) ghostDirty = true; return; }
    if ((k === 'home' || k === 'end') && !onRange) { e.preventDefault(); seek(k === 'home' ? 0 : 1); if (flying) ghostDirty = true; return; }
    if (k === 'escape') { if (moreOpen) setMore(false); else if (!el.help.hidden) toggleHelp(false); else exitFly(); return; }
    if (k === 'f' && e.shiftKey) { toggleFullscreen(); return; }
    if (k === 'f') { flying ? exitFly() : enterFly(); return; }
    if (k === 'p') { setPath(!showPath); return; }
    if (k === 'o') { overview(); return; }
    if (k === 'c') { if (!flying) enterFly(); setCutaway(!cutaway); return; }
    if (k === 't') { cycleTod(e.shiftKey ? -1 : 1); return; }
    if (k === '[') { goHouse(neighbour(-1)!); return; }
    if (k === ']') { goHouse(neighbour(1)!); return; }
    if (k === '?' || (k === '/' && e.shiftKey)) { toggleHelp(); return; }
    if (/^[1-9]$/.test(k) && shots[Number(k) - 1]) { selectShot(shots[Number(k) - 1], { play: true }); return; }
    if (FLY_KEYS.has(k) && !onRange) {
      e.preventDefault();
      if (!flying) enterFly();
      tween = null;
      keys.add(k);
    }
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); });
  window.addEventListener('blur', () => keys.clear());
  new ResizeObserver(() => { dirty = true; ghostFov = -1; endPlaced = false; }).observe(canvas);

  // ------------------------------------------------------------------ WebXR (assets/xr/): lazy, live only, ?no=xr removes it
  // entry.ts adds the Enter VR controls where a headset (or a PC VR runtime) really is, and window.__houseViewer.xr; where there is
  // none, or with ?no=xr, nothing of assets/xr/ is fetched. xrHost is the one door into the player: accessors, and suspend(), which
  // stops the player moving and answering the page for the length of a session (the XR modules draw the house themselves) and
  // returns the function that puts it back. frame() is not called while presenting (room-creator.html's animate()).
  const XR_QUIET = ['keydown', 'keyup', 'wheel', 'pointerdown', 'pointermove', 'pointerup', 'click'];
  const xrHost = {
    THREE, renderer, scene: api.scene, camera, canvas, controls, api, params, no,
    houseId: () => houseId, anchors: () => (api.house() || {}).anchors, markDirty: () => { dirty = true; }, toast: (m: string) => toast(m), now: () => performance.now(),
    getT: () => t, seek, pause: () => { playing = false; syncTransport(); }, setTod,
    selectShot: (key: string) => { const s = shots.find(x => x.key === key); if (s) selectShot(s, { play: false }); },
    suspend() {
      const was = { playing, flying, cutaway, hq };
      playing = false;
      if (flying) exitFly();   // (it also closes the cutaway and the ghost, and drops a tween)
      tween = null; keys.clear(); setMore(false); toggleHelp(false);
      if (was.hq) glass.apply();   // a headset draws the opaque-pass glass, never the transmission pass
      syncTransport();
      root.inert = true;   // no pointer or focus reaches the page's own controls while a session runs ...
      const quiet = (e: Event) => e.stopImmediatePropagation();   // ... and none of its window-level shortcuts, or a drag on the mirrored window, answers
      for (const ev of XR_QUIET) window.addEventListener(ev, quiet, true);
      return () => {
        for (const ev of XR_QUIET) window.removeEventListener(ev, quiet, true);
        root.inert = false;
        if (was.hq) glass.restore();
        if (was.flying) { enterFly({ keepDrag: true }); if (was.cutaway) setCutaway(true); }
        playing = was.playing;
        dirty = true; ghostDirty = true; syncTransport(true); poke();
      };
    },
  };
  if (!no.has('xr')) import('./xr/entry.js').then(m => m.mountXr(xrHost)).catch(err => console.warn('viewer: VR is unavailable', err));

  // ------------------------------------------------------------------ boot
  (async () => {
    const want = params.get('house') || 'aurora';
    showLoading(want);
    await indexReady;
    // an id the index does not list fails now, without waiting on a build that will not come (room-creator.html
    // skips it too) and without a poster request for a thumbnail that does not exist
    if (index.length && !houseEntry(want)) {
      html.style.removeProperty('--vh-poster');
      showError(`There is no home called “${want}”. Pick one from the gallery.`);
      return;
    }
    showLoading(want);   // again, now with the name and the credit
    await api.ready;
    const h = api.house();
    if (!h) { showError(houseEntry(want) ? 'This home did not load. Check the connection and try again.' : `There is no home called “${want}”. Pick one from the gallery.`); return; }
    const tq = params.get('t');
    const at = tq !== null && Number.isFinite(Number(tq)) ? clamp01(Number(tq)) : 0;
    const pq = params.get('play');
    const play = pq === '0' ? false : (pq === '1' || tq === null) && !reducedMotion;
    const tq2 = params.get('tod');
    if (tq2 && api.TIME_OF_DAY[api.lightingName(tq2)]) tod = api.lightingName(tq2);
    await onHouse({ shotKey: params.get('shot'), at, play });
    poke();
  })().catch(err => { console.error('viewer:', err); showError('Something went wrong while opening this home.'); });

  // The page's __houseRenderBegin / __houseRenderEnd call these: a film or a still drawn through those hooks is a
  // product frame, and gets the transmissive glass the goldens have (the plain path's swap is for the live view only).
  // After, the plain path takes its swap back unless Best quality is on.
  function beforeExternalRender() { (window as any).__houseViewer?.xr?.end('offline-hook'); glass.restore(); }
  function afterExternalRender() { if (!hq) glass.apply(); }

  return { frame, beforeExternalRender, afterExternalRender };
}
