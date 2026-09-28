// The portal's player: room-creator.html?mode=view.
//
//   room-creator.html?mode=view&house=<id>[&shot=<shot>][&t=<0…1>][&tod=day|golden|dusk|night][&play=1|0]
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
// to the shot. While flying, the shot keeps its own camera as a ghost that plays along the path.
//
// Icons: path data from Lucide (lucide-react 0.469.0, ISC — see THIRD_PARTY.md), as in room-creator's sprite.

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
};
const icon = (name: string, cls = ''): string => `<svg class="vh-i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

// What a shot is called in the picker. The list itself comes from the house's presets (shotsFor, plus any
// alias or new shot type a spec or a later builder adds); this only prettifies the names it knows.
const SHOT_LABELS: Record<string, string> = { 'door-to-core': 'Door to Core', 'orbit': 'Orbit', 'hero-reveal': 'Hero reveal', 'walkthrough': 'Walkthrough', 'core-orbit': 'Core orbit' };
const TOD_ICONS: Record<string, string> = { day: 'sun', golden: 'sunrise', dusk: 'sunset', night: 'moon' };
const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const FLY_SPEED = 4;          // m/s; Shift × 3
const DRAG_TO_FLY = 6;        // px of drag on the scene before it counts as taking the camera
const IDLE_MS = 2600;         // controls fade after this long without input while a shot plays

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const fmt = (s: number): string => { const d = Math.floor(s * 10 + 1e-6), m = Math.floor(d / 600), r = (d % 600) / 10; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; };
const fmtWhole = (s: number): string => { const w = Math.round(s), m = Math.floor(w / 60), r = w % 60; return `${m}:${r < 10 ? '0' : ''}${r}`; };
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
        <p class="vh-eyebrow">Building the house</p>
        <h2 class="vh-loading-name">Loading</h2>
        <p class="vh-loading-meta"></p>
        <div class="vh-bar"><span></span></div>
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
        <button class="vh-iconbtn" data-act="fullscreen" aria-label="Full screen" title="Full screen  Shift F">${icon('maximize', 'vh-i-max')}${icon('minimize', 'vh-i-min')}</button>
        <button class="vh-iconbtn vh-hide-coarse" data-act="help" aria-label="Keyboard shortcuts" title="Keyboard shortcuts  ?">${icon('help')}</button>
      </div>
    </header>

    <div class="vh-flybar" role="status">
      <span class="vh-flybar-label">${icon('fly')}<b>Free camera</b></span>
      <span class="vh-flybar-hint vh-hide-coarse">Drag to look. WASD to move, Q and E to sink and rise.</span>
      <span class="vh-flybar-hint vh-show-coarse">Drag to look. Pinch to move closer.</span>
      <button class="vh-pill vh-pill-quiet" data-act="overview" title="See the whole path from above  O">Overview</button>
      <button class="vh-pill" data-act="exit-fly">Back to shot<kbd class="vh-hide-coarse">Esc</kbd></button>
    </div>

    <div class="vh-dock" role="group" aria-label="Player">
      <div class="vh-row vh-row-chips">
        <div class="vh-chips vh-shots" role="group" aria-label="Camera shot"></div>
        <div class="vh-chips vh-tods" role="group" aria-label="Time of day"></div>
      </div>
      <div class="vh-row vh-transport">
        <button class="vh-play" data-act="play" aria-label="Play">${icon('play', 'vh-i-play')}${icon('pause', 'vh-i-pause')}${icon('replay', 'vh-i-replay')}</button>
        <div class="vh-scrub">
          <input type="range" min="0" max="1000" step="1" value="0" aria-label="Seek">
          <span class="vh-scrub-mark" hidden title="The Core wakes"></span>
        </div>
        <span class="vh-time" aria-hidden="true"><span class="vh-now">0:00.0</span><span class="vh-dur"> / 0:00</span></span>
        <div class="vh-tools">
          <button class="vh-tool" data-act="speed" aria-label="Playback speed" title="Playback speed">1×</button>
          <button class="vh-tool" data-act="path" aria-pressed="false" title="Show the camera path  P">${icon('route')}<span>Path</span></button>
          <button class="vh-tool" data-act="fly" aria-pressed="false" title="Fly the camera yourself  F">${icon('fly')}<span>Fly</span></button>
          <button class="vh-tool" data-act="hq" aria-pressed="false" title="High quality: ambient occlusion, bloom and grading. Slower.">${icon('sparkles')}<span>HQ</span></button>
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
        <dt><kbd>Esc</kbd></dt><dd>Back to the shot</dd>
        <dt><kbd>[</kbd> <kbd>]</kbd></dt><dd>Previous or next home</dd>
        <dt><kbd>Shift</kbd> <kbd>F</kbd></dt><dd>Full screen</dd>
      </dl>
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
    now: $('.vh-now'), dur: $('.vh-dur'), speed: $('[data-act="speed"]'),
    path: $('[data-act="path"]'), fly: $('[data-act="fly"]'), hq: $('[data-act="hq"]'),
    toast: $('.vh-toast'), help: $('.vh-help'), fullscreen: $('[data-act="fullscreen"]'),
  };
  const fsEnabled = !!(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);
  if (!fsEnabled) el.fullscreen.hidden = true;

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
  let tod: string | null = null;   // the viewer's choice; null = the house's own hour
  let ready = false;
  let dirty = true;          // something changed: draw a frame even while paused
  let loadToken = 0;

  const indexReady = fetch('./content/houses/index.json').then(r => (r.ok ? r.json() : { houses: [] })).then(j => { index = j.houses || []; return index; }).catch(() => (index = []));

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
    for (const v of p.eyePoints || []) { const y = floorUnder(v); if (v.y - y > 0.4) plumbs.push(v, new THREE.Vector3(v.x, y, v.z)); }
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
    return [e.author ? `Build by ${e.author}` : '', facts.join('  ·  ')];
  }
  const metaLine = (e: { author?: string; storeys?: number; areaSqm?: number }): string => metaParts(e).filter(Boolean).join('  ·  ');
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

  // ------------------------------------------------------------------ building the chips
  function renderShots() {
    el.shots.replaceChildren(...shots.map((s, i) => {
      const b = document.createElement('button');
      b.className = 'vh-chip'; b.type = 'button'; b.dataset.shot = s.key;
      b.title = `${s.label}  ${i + 1}`;
      const name = document.createElement('span'); name.textContent = s.label;
      const d = document.createElement('small'); d.textContent = `${Math.round(s.preset.duration || 10)}s`;
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
  function syncTransport(force = false) {
    const ended = !playing && t >= 1 && !(shot && shot.preset.closed);
    if (force || shownPlaying !== playing || shownEnded !== ended) {
      shownPlaying = playing; shownEnded = ended;
      root.dataset.playing = playing ? '1' : '0';
      root.dataset.ended = ended ? '1' : '0';
      el.play.setAttribute('aria-label', playing ? 'Pause' : ended ? 'Play again' : 'Play');
      el.play.title = playing ? 'Pause  Space' : ended ? 'Play again  Space' : 'Play  Space';
    }
    if (force || Math.abs(shownT - t) > 1e-4) {
      shownT = t;
      const d = shotDuration();
      el.scrub.value = String(Math.round(t * 1000));
      el.scrub.style.setProperty('--vh-fill', `${(t * 100).toFixed(2)}%`);
      el.scrub.setAttribute('aria-valuetext', `${fmtWhole(t * d)} of ${fmtWhole(d)}`);
      el.now.textContent = fmt(t * d);
    }
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
  function setRate(r: number) { rate = r; el.speed.textContent = `${r}×`; }

  function selectShot(s: Shot, { play = true, at = 0 }: { play?: boolean; at?: number } = {}) {
    shot = s;
    api.useShot(`house:${houseId}:${s.key}`);   // SplinePresets key: the page registers a house's shots under it
    t = clamp01(at);
    el.dur.textContent = ` / ${fmtWhole(shotDuration())}`;
    const pw = s.preset.power;
    if (pw && pw.at >= 0 && pw.at <= 1) { el.mark.hidden = false; el.mark.style.left = `${(pw.at * 100).toFixed(2)}%`; } else el.mark.hidden = true;
    buildPath();
    ghostFov = -1;
    playing = play;
    dirty = true;
    syncChips(); syncTransport(true); syncUrl();
  }

  function setTod(key: string) {
    tod = key;
    api.setLighting(key);
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
  function setHq(on: boolean) {
    hq = on;
    el.hq.classList.toggle('on', on); el.hq.setAttribute('aria-pressed', String(on));
    dirty = true;
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
    root.dataset.fly = '1';
    el.fly.classList.add('on'); el.fly.setAttribute('aria-pressed', 'true');
    if (!pathTouched) setPath(true, false);
    ghost.visible = ghostRay.visible = true;
    ghostDirty = true; dirty = true;
    syncTransport();
    poke();
  }
  function exitFly() {
    if (!flying) return;
    flying = false;
    tween = null;
    keys.clear();
    clearControlDeltas();
    root.dataset.fly = '0';
    el.fly.classList.remove('on'); el.fly.setAttribute('aria-pressed', 'false');
    ghost.visible = ghostRay.visible = false;
    dirty = true;
    poke();
  }
  // The shot's camera at t, without taking the view: let applySplineFrame place the camera (and set the roof,
  // the walls and the Core for t, which is what the ghost's moment should look like), read it, put ours back.
  let ghostDirty = true;
  const saved = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), target: new THREE.Vector3(), fov: 42 };
  function placeGhost() {
    saved.pos.copy(camera.position); saved.quat.copy(camera.quaternion); saved.target.copy(controls.target); saved.fov = camera.fov;
    api.applyFrame(t);
    ghost.position.copy(camera.position); ghost.quaternion.copy(camera.quaternion);
    shapeGhost(camera.fov, camera.aspect);
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
  // Overview: the free camera eases up to a ¾ aerial that holds the whole path (the thumbnail's framing, aimed
  // at the path instead of the house), so the route the shot flies reads at a glance.
  let tween: { t: number; dur: number; p0: any; p1: any; q0: any; q1: any } | null = null;
  function overview() {
    if (!flying) enterFly();
    const pts = pathGroup ? pathGroup.children[0].geometry.attributes.position : null;
    const box = new THREE.Box3();
    if (pts) box.setFromBufferAttribute(pts);
    const h = api.house();
    if (h && h.anchors && h.anchors.bounds) { const b = h.anchors.bounds; box.expandByPoint(new THREE.Vector3(b.minX, 0, b.minZ)); box.expandByPoint(new THREE.Vector3(b.maxX, 4, b.maxZ)); }
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    // from the front of the house, swung 34° off the entry's axis, 40° up (the thumbnails' view)
    const out = (h && h.anchors && h.anchors.entry && h.anchors.entry.out) || [0, 1];
    const az = Math.atan2(out[0], out[1]) + (34 * Math.PI) / 180, el = (40 * Math.PI) / 180;
    const vHalf = (camera.fov * Math.PI) / 360, hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const d = (sphere.radius / Math.sin(Math.min(vHalf, hHalf))) * 0.95;
    const p1 = sphere.center.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d));
    // aim a little below the centre: the dock covers the bottom of the frame, so the path sits above it
    const q1 = sphere.center.clone(); q1.y -= Math.tan(vHalf) * d * 0.12;
    tween = { t: 0, dur: 0.9, p0: camera.position.clone(), p1, q0: controls.target.clone(), q1 };
    clearControlDeltas();
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
  // outside and off once you are under it (ceilings show only while you are below them, as in a shot).
  function flyDress() {
    const inside = api.houseInside(camera.position);
    api.dress({ walls: 'up', roof: inside ? 'off' : 'on' }, camera.position, controls.target);
  }

  // ------------------------------------------------------------------ the frame
  // Resolution follows the device: while the view moves, the frame rate is averaged over ~1.5 s, and a device
  // that cannot hold ~28 fps steps its pixel ratio down (2 → 1.5 → 1.25 → 1). A step that does not buy at least
  // 15 % more frames is undone and adaptation stops: a house is thousands of draw calls, and where the CPU is
  // what limits the frame rate, fewer pixels would only make the picture softer. It never steps back up, so
  // the picture does not pump. window.__houseViewer reports what it settled on.
  const renderer = api.renderer;
  let pixelRatio = renderer.getPixelRatio(), perfTime = 0, perfFrames = 0, trial: { fps: number; pr: number } | null = null, settled = false;
  const stats = { fps: 0, pixelRatio, settled };
  (window as any).__houseViewer = stats;
  function setPixelRatio(pr: number) {
    pixelRatio = pr; stats.pixelRatio = pr;
    renderer.setPixelRatio(pr);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    dirty = true;
  }
  function adapt(delta: number) {
    perfTime += delta; perfFrames++;
    if (perfTime < 1.5) return;
    const fps = perfFrames / perfTime;
    stats.fps = Math.round(fps);
    perfTime = 0; perfFrames = 0;
    if (settled) return;
    if (trial) {
      if (fps < trial.fps * 1.15) { setPixelRatio(trial.pr); settled = stats.settled = true; }
      trial = null;
    } else if (fps < 28 && pixelRatio > 1) {
      trial = { fps, pr: pixelRatio };
      setPixelRatio(pixelRatio > 1.5 ? 1.5 : pixelRatio > 1.25 ? 1.25 : 1);
    } else if (fps >= 28) settled = stats.settled = true;
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
  }

  let wasFlying = false;
  function frame(delta: number) {
    if (!ready) return;
    delta = Math.min(delta, 0.25);   // a tab that slept a minute does not skip the shot
    if (playing || flying) adapt(delta); else { perfTime = 0; perfFrames = 0; }
    let moved = false;
    if (playing) {
      const d = shotDuration();
      t += (delta * rate) / d;
      if (t >= 1) {
        if (shot && shot.preset.closed) t %= 1;
        else { t = 1; playing = false; }
      }
      moved = true;
      if (flying) ghostDirty = true;
      syncTransport();
    }
    if (flying) {
      if (ghostDirty || !wasFlying) placeGhost();
      // the ghost keeps a readable size however far away you fly
      ghost.scale.setScalar(Math.max(0.7, Math.min(5, camera.position.distanceTo(ghost.position) / 9)));
      const walked = flyMove(delta) || stepTween(delta);
      const turned = controls.update();
      if (walked || turned || !wasFlying || dirty || moved) { flyDress(); dirty = true; }
    } else if (moved || dirty || wasFlying) {
      api.applyFrame(t);
      dirty = true;
    }
    wasFlying = flying;
    // with the path showing, a ring marks what the shot is looking at right now (flying, the ghost's ray does)
    nowTarget.visible = showPath && !flying;
    if (nowTarget.visible && dirty) { const p = nowTarget.geometry.attributes.position; p.setXYZ(0, controls.target.x, controls.target.y, controls.target.z); p.needsUpdate = true; }
    if (dirty) { render(); dirty = false; }
  }

  // ------------------------------------------------------------------ loading a house
  function showLoading(id: string) {
    const e = houseEntry(id);
    el.loadingName.textContent = (e && e.name) || id;
    el.loadingMeta.textContent = e ? metaLine(e) : '';
    if (/^[a-z0-9-]+$/.test(id)) root.style.setProperty('--vh-poster', `url("${new URL(`./portal/thumbs/${id}.webp`, location.href).href}")`);
    el.error.hidden = true; el.loadingCard.hidden = false;
    root.dataset.state = 'loading';
    html.dataset.viewer = 'mounted';
  }
  function showError(message: string) {
    el.loadingCard.hidden = true; el.error.hidden = false;
    el.errorMsg.textContent = message;
    root.dataset.state = 'error';
  }
  function onHouse({ shotKey = null as string | null, at = 0, play = true } = {}) {
    const h = api.house();
    houseId = h.id;
    const e = houseEntry(h.id);
    const name = h.spec.name || (e && e.name) || h.id;
    el.name.textContent = name;
    // the credit, then the facts (which a phone's narrow bar drops)
    const [by, facts] = metaParts({ author: h.spec.author, storeys: (e && e.storeys) || (h.spec.levels || []).length, areaSqm: h.spec.areaSqm || (e && e.areaSqm) });
    const factsEl = document.createElement('span'); factsEl.className = 'vh-meta-facts'; factsEl.textContent = by && facts ? `  ·  ${facts}` : facts;
    el.meta.replaceChildren(by, factsEl);
    el.name.title = [h.spec.style, h.spec.source].filter(Boolean).join('\n');
    document.title = `${name} · Companion virtual homes`;
    if (tod) api.setLighting(tod);   // a building resets the hour to the spec's; keep the viewer's choice
    shots = listShots();
    renderShots();
    const s = findShot(shotKey) || findShot('door-to-core') || shots[0];
    if (!s) { showError('This home has no camera shots.'); return; }
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
    try {
      await api.loadHouse(id);
    } catch (err) {
      if (token !== loadToken) return;
      console.warn('viewer: could not load', id, err);
      if (api.house()) { ready = true; root.dataset.state = 'ready'; toast('That home could not be opened.'); onHouse({ shotKey: keepType, play: false }); }
      else showError('That home could not be opened. Pick another from the gallery.');
      return;
    }
    if (token !== loadToken) return;
    onHouse({ shotKey: keepType, play: !reducedMotion });
  }
  function neighbour(step: number): string | null {
    if (!index.length) return null;
    const i = index.findIndex(h => h.id === houseId);
    return index[(i + step + index.length) % index.length].id;
  }

  // ------------------------------------------------------------------ chrome: toast, idle fade, help, share, fullscreen
  let toastTimer = 0;
  function toast(msg: string) {
    el.toast.textContent = msg; el.toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.toast.classList.remove('on'), 2200);
  }
  // Controls fade while a shot plays and the mouse rests, as a video player's do, but only once a mouse has
  // been used on the page: a viewer who has not touched anything yet (or a kiosk, or a capture) keeps them.
  let idleTimer = 0, mouseSeen = false;
  window.addEventListener('mousemove', () => { mouseSeen = true; }, { passive: true });
  function poke() {
    root.classList.remove('vh-idle');
    clearTimeout(idleTimer);
    if (coarse || !mouseSeen) return;
    idleTimer = window.setTimeout(() => {
      if (playing && !flying && el.help.hidden && !root.querySelector('.vh-dock:hover, .vh-top:hover')) root.classList.add('vh-idle');
    }, IDLE_MS);
  }
  function toggleHelp(force?: boolean) {
    const open = force ?? el.help.hidden;
    el.help.hidden = !open;
    poke();
  }
  async function share() {
    const href = new URL(url(true), location.href).href;
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
    else if (act === 'speed') setRate(SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length]);
    else if (act === 'path') setPath(!showPath);
    else if (act === 'fly') (flying ? exitFly() : enterFly());
    else if (act === 'exit-fly') exitFly();
    else if (act === 'overview') overview();
    else if (act === 'hq') setHq(!hq);
    else if (act === 'prev') goHouse(neighbour(-1)!);
    else if (act === 'next') goHouse(neighbour(1)!);
    else if (act === 'share') share();
    else if (act === 'fullscreen') toggleFullscreen();
    else if (act === 'help') toggleHelp();
  });
  // A pointer press leaves focus on the control, and Space would then press the button again (or the arrows
  // nudge the slider a thousandth) instead of reaching the player: hand focus back to the page after a pointer
  // press. Keyboard focus never passes through here, so tabbing keeps working.
  root.addEventListener('pointerup', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('button, input[type="range"]'); if (b) setTimeout(() => b.blur(), 0); });

  // scrubbing pauses, and picks up again where you let go if it was playing
  let scrubResume = false, scrubbing = false;
  const scrubStart = () => { if (scrubbing) return; scrubbing = true; scrubResume = playing; playing = false; syncTransport(); };
  const scrubEnd = () => { if (!scrubbing) return; scrubbing = false; if (scrubResume && t < 1) setPlaying(true); };
  el.scrub.addEventListener('pointerdown', scrubStart);
  el.scrub.addEventListener('input', () => { seek(Number(el.scrub.value) / 1000); if (flying) ghostDirty = true; poke(); });
  el.scrub.addEventListener('change', scrubEnd);
  el.scrub.addEventListener('pointerup', scrubEnd);
  el.scrub.addEventListener('pointercancel', scrubEnd);

  // the scene: drag takes the camera; a click plays or pauses (a tap on a touch screen shows or hides the controls)
  let press: { x: number; y: number; moved: boolean; touch: boolean } | null = null;
  canvas.addEventListener('pointerdown', (e) => { if (!ready) return; press = { x: e.clientX, y: e.clientY, moved: false, touch: e.pointerType === 'touch' }; poke(); });
  window.addEventListener('pointermove', (e) => {
    if (!press || press.moved) { if (!coarse) poke(); return; }
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_TO_FLY) { press.moved = true; if (!flying) enterFly({ keepDrag: true }); }
  });
  window.addEventListener('pointerup', () => {
    if (!press) return;
    const p = press; press = null;
    if (p.moved || flying) return;
    clearControlDeltas();
    if (p.touch) root.classList.toggle('vh-chrome-off');
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
    if (k === ' ' || k === 'spacebar') { e.preventDefault(); setPlaying(!playing); return; }
    if ((k === 'arrowleft' || k === 'arrowright') && !onRange) { e.preventDefault(); const step = (e.shiftKey ? 5 : 1) / shotDuration(); seek(t + (k === 'arrowleft' ? -step : step)); if (flying) ghostDirty = true; return; }
    if ((k === 'home' || k === 'end') && !onRange) { e.preventDefault(); seek(k === 'home' ? 0 : 1); if (flying) ghostDirty = true; return; }
    if (k === 'escape') { if (!el.help.hidden) toggleHelp(false); else exitFly(); return; }
    if (k === 'f' && e.shiftKey) { toggleFullscreen(); return; }
    if (k === 'f') { flying ? exitFly() : enterFly(); return; }
    if (k === 'p') { setPath(!showPath); return; }
    if (k === 'o') { overview(); return; }
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
  new ResizeObserver(() => { dirty = true; ghostFov = -1; }).observe(canvas);

  // ------------------------------------------------------------------ boot
  (async () => {
    const want = params.get('house') || 'aurora';
    showLoading(want);
    await indexReady;
    showLoading(want);   // again, now with the name and the credit
    await api.ready;
    const h = api.house();
    if (!h) { showError(`There is no home called “${want}”. Pick one from the gallery.`); return; }
    const tq = params.get('t');
    const at = tq !== null && Number.isFinite(Number(tq)) ? clamp01(Number(tq)) : 0;
    const pq = params.get('play');
    const play = pq !== null ? pq === '1' : tq === null && !reducedMotion;
    const tq2 = params.get('tod');
    if (tq2 && api.TIME_OF_DAY[api.lightingName(tq2)]) tod = api.lightingName(tq2);
    onHouse({ shotKey: params.get('shot'), at, play });
    poke();
  })().catch(err => { console.error('viewer:', err); showError('Something went wrong while opening this home.'); });

  return { frame };
}
