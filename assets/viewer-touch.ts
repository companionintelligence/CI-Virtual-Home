// Touch controls for the player's free camera (defect P3: on a phone, "fly" was OrbitControls around a pivot, which is a way to look at
// a house and no way to walk through one). Mounted by viewer-tier.ts on a touch-first device, the first time the free camera is entered;
// idle otherwise. Its own scheme, not a patch on OrbitControls' pinch:
//
//   drag             look about where you stand, the picture following the finger (a drag across the screen turns one field of view)
//   hold the left    a virtual stick appears under the thumb (at least 44 px, safe-area aware) and walks you: forward, back, sideways
//   tap the floor    walk there, along the shot planner's navigation grid (assets/shot-nav.ts: round the walls, through the doors),
//                    or straight when the grid has no way (a free camera may cross a wall; the walk never takes a person under the lot)
//   double-tap       back to the shot, where you left it
//   two fingers      pinch to glide forward or back
//   "Look around with your phone" in the More sheet: the gyroscope turns the view (off by default, asks permission from the tap on iOS,
//                    never offered when the system asks for reduced motion). Dragging still works and re-centres it.
//
// While it is active OrbitControls is disabled (it would also orbit on the same fingers); it is enabled again when the free camera ends.
// No pointer lock. Live player only; nothing here touches a product frame.
import { deadzone, lookBy, placeAt, poseOf, walkBy } from './viewer-fp.js';

const WALK = 2.2, RUN = 3.4, STICK_R = 56, STICK_DEAD = 0.14, TAP_MS = 350, TAP_PX = 10, DOUBLE_MS = 320, EYE = 1.6, PINCH_K = 0.03;
const TAU = Math.PI * 2;

type P = { id: number; kind: 'stick' | 'look'; x0: number; y0: number; x: number; y: number; t0: number; moved: boolean };
type Plan = { pts: Array<[number, number]>; y0: number; y1: number; len: number; s: number; speed: number };

export function mountTouch(ctx: { api: any; root: HTMLElement; toast(m: string, ms?: number): void; act: { flying(): boolean; back(): void; enter(): void; dirty(): void; poke(): void }; reducedMotion: boolean; profile: any }) {
  const { api, root, act } = ctx, { THREE, camera, controls, canvas } = api, rig = { camera, controls };
  let on = false, stickId = -1, nav: { world: any; nav: any } | null = null, navFor: any = null, navBusy = false, plan: Plan | null = null;
  let last = { t: 0, x: 0, y: 0 }, hinted = false;
  const ptr = new Map<number, P>();
  const sv: [number, number] = [0, 0];

  // ---- the stick: drawn only while a thumb is on it
  const stick = document.createElement('div');
  stick.className = 'vh-stick'; stick.hidden = true; stick.setAttribute('aria-hidden', 'true');
  stick.innerHTML = '<i class="vh-stick-knob"></i>';
  const knob = stick.firstElementChild as HTMLElement;
  const areas = document.createElement('div');
  areas.className = 'vh-touch-areas'; areas.hidden = true; areas.setAttribute('aria-hidden', 'true');
  areas.innerHTML = '<span>Hold to walk</span><span>Drag to look</span>';
  root.append(stick, areas);
  const place = (x: number, y: number, dx = 0, dy = 0) => {
    const r = root.getBoundingClientRect();
    stick.style.transform = `translate(${x - r.left}px, ${y - r.top}px)`;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  // ---- pointers
  const inLeftThird = (x: number) => { const r = canvas.getBoundingClientRect(); return x - r.left < r.width / 3; };
  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    if (!on) return;
    const kind = stickId < 0 && inLeftThird(e.clientX) ? 'stick' : 'look';
    ptr.set(e.pointerId, { id: e.pointerId, kind, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a pointer that already ended */ }
    if (kind === 'stick') { stickId = e.pointerId; sv[0] = sv[1] = 0; stick.hidden = false; place(e.clientX, e.clientY); }
    gBase = null;   // a touch re-centres the gyroscope
    act.poke();
  });
  addEventListener('pointermove', (e: PointerEvent) => {
    if (!on) return;
    let p = ptr.get(e.pointerId);
    // the drag that began the free camera started before it existed: take it over as a look
    if (!p) { if (e.buttons & 1) { p = { id: e.pointerId, kind: 'look', x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: true }; ptr.set(e.pointerId, p); } else return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (!p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > TAP_PX) p.moved = true;
    if (p.kind === 'stick') {
      const ox = p.x - p.x0, oy = p.y - p.y0, m = Math.hypot(ox, oy) || 1, k = Math.min(1, STICK_R / m);
      place(p.x0, p.y0, ox * k, oy * k);
      [sv[0], sv[1]] = deadzone((ox * k) / STICK_R, (oy * k) / STICK_R, STICK_DEAD);
      if (sv[0] || sv[1]) plan = null;
      return;
    }
    if (!p.moved) return;
    const looks = [...ptr.values()].filter(q => q.kind === 'look');
    if (looks.length >= 2) {   // two fingers: pinch glides along the view
      const [a, b] = looks, d1 = Math.hypot(a.x - b.x, a.y - b.y), pa = { x: a.x - (p === a ? dx : 0), y: a.y - (p === a ? dy : 0) }, pb = { x: b.x - (p === b ? dx : 0), y: b.y - (p === b ? dy : 0) };
      const d0 = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      walkBy(rig, (d1 - d0) * PINCH_K, 0); act.dirty(); plan = null;
      return;
    }
    // (a drag across the screen turns one vertical field of view; the picture follows the finger)
    const k = ((camera.fov * Math.PI) / 180) / Math.max(1, canvas.clientHeight);
    lookBy(rig, dx * k, dy * k);
    gBase = null; manual = true;
    act.dirty();
  });
  const end = (e: PointerEvent) => {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    ptr.delete(e.pointerId);
    if (p.kind === 'stick') { stickId = -1; sv[0] = sv[1] = 0; stick.hidden = true; }
    if (e.type === 'pointercancel' || !on) return;
    const now = performance.now();
    if (p.moved || now - p.t0 > TAP_MS) return;
    // a tap: twice in quick succession goes back to the shot, once walks to the floor under the finger
    if (now - last.t < DOUBLE_MS && Math.hypot(p.x - last.x, p.y - last.y) < 40) { last.t = 0; plan = null; act.back(); return; }
    last = { t: now, x: p.x, y: p.y };
    walkTo(p.x, p.y);
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);

  // ---- tap to walk
  const pointsAt = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  };
  /** the floor under a screen point: the house's floors and the lot's ground, top faces only (a ceiling is not somewhere to walk to) */
  function floorAt(cx: number, cy: number): { x: number; y: number; z: number } | null {
    const h = api.house(), placed: any[] = (h && h.anchors && h.anchors.placed) || [];
    const ray = new THREE.Raycaster();
    ray.setFromCamera(pointsAt(cx, cy), camera);
    const floors = placed.filter(o => o.userData && (o.userData.role === 'floor' || o.userData.role === 'ground'));
    const n = new THREE.Vector3();
    for (const hit of ray.intersectObjects(floors, true)) {
      if (!hit.face) continue;
      n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      if (n.y > 0.5) return { x: hit.point.x, y: hit.point.y, z: hit.point.z };
    }
    // no floor in the way (the lot's ground may not be a placed object): the ground plane
    const d = ray.ray.direction;
    if (d.y < -0.02) { const s = -ray.ray.origin.y / d.y; return { x: ray.ray.origin.x + d.x * s, y: 0, z: ray.ray.origin.z + d.z * s }; }
    return null;
  }
  async function warmNav() {
    const h = api.house();
    if (!h || (nav && navFor === h) || navBusy) return nav;
    navBusy = true;
    try {
      const [{ createNav }, { createWorldIndex }] = await Promise.all([import('./shot-nav.js'), import('./shot-world.js')]);
      const world = h.anchors && h.anchors.shotWorld;   // the planner's digest, made on first read and kept
      if (world) { nav = { world, nav: createNav(world, createWorldIndex(world)) }; navFor = h; }
    } catch (err) { console.warn('viewer: the navigation grid did not build; taps walk in a straight line', err); }
    finally { navBusy = false; }
    return nav;
  }
  async function walkTo(cx: number, cy: number) {
    const f = floorAt(cx, cy);
    if (!f) { ctx.toast('Tap the floor to walk there.', 2200); return; }
    const from = camera.position, y1 = f.y + EYE;
    let pts: Array<[number, number]> = [[from.x, from.z], [f.x, f.z]];
    const n = await warmNav();
    if (n) {
      const lv = n.world.levels.find((l: any) => Math.abs(l.y - f.y) < 0.35);
      const g = lv ? n.nav.grid(lv) : n.nav.grid(null, 0);
      const r = g && n.nav.leg(g, [from.x, from.z], [f.x, f.z]);
      if (r && r.pts.length >= 2) pts = r.pts;
    }
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    len = Math.max(len, Math.abs(y1 - from.y), 0.01);
    // a long way (down from the aerial) takes about five seconds, a few steps takes a few steps
    plan = { pts, y0: from.y, y1, len, s: 0, speed: Math.max(WALK, Math.min(7, len / 5)) };
    if (ctx.reducedMotion) { placeAt(rig, f.x, y1, f.z); plan = null; act.dirty(); }
  }
  function stepPlan(dt: number): boolean {
    const p = plan!;
    // quick ease in and out, so a walk neither jerks off nor stops dead
    p.s = Math.min(p.len, p.s + p.speed * Math.min(1, 0.25 + p.s / 0.8, 0.25 + (p.len - p.s) / 0.8) * dt);
    let acc = 0, x = p.pts[p.pts.length - 1][0], z = p.pts[p.pts.length - 1][1], hx = 0, hz = 0;
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1], b = p.pts[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc + seg >= p.s || i === p.pts.length - 1) { const k = seg > 1e-6 ? Math.max(0, Math.min(1, (p.s - acc) / seg)) : 1; x = a[0] + (b[0] - a[0]) * k; z = a[1] + (b[1] - a[1]) * k; hx = b[0] - a[0]; hz = b[1] - a[1]; break; }
      acc += seg;
    }
    const q = p.s / p.len, y = p.y0 + (p.y1 - p.y0) * (q * q * (3 - 2 * q));
    placeAt(rig, x, y, z);
    if (!ptr.size && Math.hypot(hx, hz) > 1e-3) {   // face the way you walk, and level out, unless a finger is steering
      const pose = poseOf(rig), want = Math.atan2(hx, hz);
      let dy = ((want - pose.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
      dy *= Math.min(1, dt * 3);
      lookBy(rig, dy, (p.y1 < 3.2 ? (-0.08 - pose.pitch) * Math.min(1, dt * 2) : 0));
    }
    if (p.s >= p.len) plan = null;
    return true;
  }

  // ---- the gyroscope ("Look around with your phone")
  let gyro = false, gBase: { dev: any; cam: any } | null = null, ev: DeviceOrientationEvent | null = null, manual = false;
  const onOrient = (e: DeviceOrientationEvent) => { ev = e; };
  const D = Math.PI / 180, ZEE = new THREE.Vector3(0, 0, 1), EUL = new THREE.Euler(), Q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  const deviceQuat = (e: DeviceOrientationEvent) => {
    // (three's DeviceOrientationControls: alpha, beta, gamma to a camera orientation, the screen's turn taken out)
    const orient = ((screen.orientation && screen.orientation.angle) || (window as any).orientation || 0) * D;
    const q = new THREE.Quaternion().setFromEuler(EUL.set((e.beta || 0) * D, (e.alpha || 0) * D, -(e.gamma || 0) * D, 'YXZ'));
    return q.multiply(Q1).multiply(new THREE.Quaternion().setFromAxisAngle(ZEE, -orient));
  };
  function applyGyro() {
    if (!ev || ev.alpha === null) return false;
    const dev = deviceQuat(ev);
    if (!gBase) { gBase = { dev, cam: camera.quaternion.clone() }; return false; }
    // the phone's turn since the baseline, laid on the view's own orientation at the baseline
    const rel = gBase.dev.clone().invert().multiply(dev), want = gBase.cam.clone().multiply(rel);
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(want), pose = poseOf(rig);
    const wy = Math.atan2(f.x, f.z), wp = Math.asin(Math.max(-1, Math.min(1, f.y)));
    const dy = ((wy - pose.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
    if (Math.abs(dy) < 1e-4 && Math.abs(wp - pose.pitch) < 1e-4) return false;
    lookBy(rig, dy, wp - pose.pitch);
    return true;
  }
  const tools = root.querySelector('.vh-tools');
  if (tools && ctx.profile.can.gyro && !ctx.reducedMotion) {
    const b = document.createElement('button');
    b.className = 'vh-tool'; b.type = 'button'; b.dataset.act = 'gyro'; b.setAttribute('aria-pressed', 'false');
    b.title = 'Turn the view by turning your phone';
    b.innerHTML = '<svg class="vh-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg><span class="vh-gyro-long">Look around with your phone</span><span class="vh-gyro-short">Gyro</span>';
    // (asked for from the tap itself: iOS only shows its permission prompt from a user gesture)
    b.addEventListener('click', async () => {
      if (gyro) { gyro = false; removeEventListener('deviceorientation', onOrient); }
      else {
        const DOE: any = (window as any).DeviceOrientationEvent;
        try { if (DOE && typeof DOE.requestPermission === 'function' && (await DOE.requestPermission()) !== 'granted') throw new Error('denied'); }
        catch { ctx.toast('Motion access was not allowed. Drag to look instead.', 3200); return; }
        gyro = true; gBase = null; ev = null; addEventListener('deviceorientation', onOrient);
        if (!act.flying()) act.enter();
        ctx.toast('Turn your phone to look around.', 2600);
      }
      b.setAttribute('aria-pressed', String(gyro)); b.classList.toggle('on', gyro);
    });
    tools.appendChild(b);
  }

  // ---- the frame
  function enter() {
    on = true; controls.enabled = false;
    if (!hinted) { hinted = true; areas.hidden = false; setTimeout(() => { areas.hidden = true; }, ctx.reducedMotion ? 2600 : 3400); }
    warmNav();
  }
  function leave() {
    on = false; controls.enabled = true; ptr.clear(); stickId = -1; stick.hidden = true; areas.hidden = true; sv[0] = sv[1] = 0; plan = null; gBase = null;
  }
  return {
    tick(dt: number) {
      const fl = act.flying();
      if (fl !== on) { if (fl) enter(); else leave(); }
      if (!on) return;
      let moved = false;
      if (sv[0] || sv[1]) {
        const m = Math.hypot(sv[0], sv[1]), t = Math.max(0, Math.min(1, (m - 0.6) / 0.4)), speed = (WALK + (RUN - WALK) * t * t * (3 - 2 * t)) * Math.min(1, m * 1.4);
        walkBy(rig, (-sv[1] / m) * speed * dt, (sv[0] / m) * speed * dt); moved = true;
      }
      if (plan) moved = stepPlan(dt) || moved;
      if (gyro && !manual) moved = applyGyro() || moved;
      manual = false;
      if (moved) act.dirty();
    },
  };
}
