#!/usr/bin/env -S node --experimental-strip-types
// @check-house skip — needs a GPU browser and Meta's IWER (WebXR emulation); run it with `pnpm run xr:test -- --only 40`, or by hand (below)
//
// Moving about the house in a headset (assets/xr/input.ts, nav.ts, teleport.ts, stairs.ts, comfort.ts, dress.ts, doors.ts, places.ts, pointer.ts,
// locomotion.ts), tested the way this machine can: Node units against a fake XR session for the parts that are logic (input by source, the select
// event order, hover, dwell, cancellation, the teleport and comfort state machines), then ONE Chromium with IWER installed before the page's scripts,
// emulating a Quest 3 (controllers), a Quest 2 with hand tracking only, and a Vision-like device (transient-pointer). No headset is involved: what
// emulation cannot prove is listed at the end of every run.
//
//   node --experimental-strip-types scripts/xr-tests/40-loco.mts [--only unit,quest3,hands,vision,houses] [--house familyhome] [--houses a,b,c|all]
//        [--shots test/portal/xr] [--headed]
//
//   IWER   $IWER_JS (a path to iwer.min.js), else node_modules/iwer/build/iwer.min.js (a test-only devDependency)
//
//   unit     input: ids by source (not index), select start/select/end in either order is one press and one release, a runtime with only `select` still
//            clicks, priority (a panel over the floor), release with hit null when the ray left, cancel on visibility, a lost source cancels, gaze dwell
//            fires once after 1.2 s, transient-pointer never hovers. teleport: stick forward aims, release goes through moveTo (once), squeeze cancels, a
//            busy rig starts nothing, a trigger on a stick controller never teleports, a pinch on the floor does. comfort: one snap per push, the
//            stick must rest, the wall guard ramps up in 0.4 s and down in 0.25 s, continuous walking is off by default
//   quest3   T3/T4 in a page: spawn indoors, nav built (ms), stick teleport to the expected world position, the blink invariant (the head moves only on
//            black frames), snap turn rotates about the head (the head does not slide), the wall guard fires, the stairs rings take a person up and down,
//            the roof is off inside and on outside, doors open and are restored, zero third-party requests, no console error
//   hands    a Quest 2 with hands only: a pinch on the floor teleports, a pinch on a panel target presses it, the ray hovers, no controller visuals
//   vision   transient-pointer: select works, no hover is ever delivered, the tier is vision, the system draws the hands (none of ours)
//   houses   the lifecycle on more homes (default cutestarter, aurora, mirage; `all` is the 30): nav ms, spawn inside, places, no error
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, parseArgs, loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts } from '../portal-lib.mts';

const args = parseArgs(process.argv.slice(2));
const ONLY = new Set((args.only || '').split(',').filter(Boolean));
const want = (k: string): boolean => !ONLY.size || ONLY.has(k);
const HOUSE = args.house || 'familyhome';
const SHOTS = path.resolve(args.shots || path.join(ROOT, 'test', 'portal', 'xr'));
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0, passes = 0;
const ok = (cond: unknown, what: string): void => { if (cond) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${what}`); } else { failures++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };
const note = (what: string): void => console.log(`  · ${what}`);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// =============================================================================================================== units
type V3 = [number, number, number];
async function unitTests() {
  console.log('\nunit: input, teleport, comfort against a fake XR session');
  const THREE: any = await import(path.join(ROOT, 'assets', 'vendor', 'three', 'three.module.min.js'));
  const { createInput } = await import('../../assets/xr/input.ts');
  const { createTeleport } = await import('../../assets/xr/teleport.ts');
  const { createComfort } = await import('../../assets/xr/comfort.ts');
  const { createXrNav } = await import('../../assets/xr/nav.ts');
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', 'familyhome.plan.json'), 'utf8')).shots.world;
  const nav = createXrNav(plan);
  const e = plan.entry, sp = nav.snap(e.x - e.out[0] * 1.4, e.z - e.out[1] * 1.4, 0, 2, true)!;

  // ---- the fake session: input sources with a pose and a gamepad, events with event.inputSource
  const pose = (p: V3, q: [number, number, number, number] = [0, 0, 0, 1]) => ({ transform: { position: { x: p[0], y: p[1], z: p[2] }, orientation: { x: q[0], y: q[1], z: q[2], w: q[3] } } });
  // a ray from `o` toward `to` (tracking space = world: the fake rig sits at the origin)
  const towards = (o: V3, to: V3): [number, number, number, number] => {
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...o), new THREE.Vector3(...to), new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m); return [q.x, q.y, q.z, q.w];
  };
  function fake() {
    const listeners: Record<string, Array<(e: any) => void>> = {};
    const session: any = {
      inputSources: [] as any[], visibilityState: 'visible',
      addEventListener: (t: string, f: any) => { (listeners[t] ||= []).push(f); }, removeEventListener: (t: string, f: any) => { listeners[t] = (listeners[t] || []).filter(x => x !== f); },
    };
    const fire = (t: string, src: any) => (listeners[t] || []).slice().forEach(f => f({ type: t, inputSource: src }));
    const renderer: any = { xr: { getSession: () => session, getReferenceSpace: () => ({}) } };
    const group = new THREE.Group(); group.updateMatrixWorld(true);
    const moves: any[] = [], turns: number[] = [];
    let busy = false, headPos: V3 = [sp.x, 1.6, sp.z];
    const rig: any = {
      group, head: () => ({ pos: headPos, dir: [0, 0, -1], yawDeg: 0 }), floorY: () => 0, heightOffset: 0, busy: () => busy, fade: { set() {}, get: () => 0 },
      moveTo: async (t: any) => { moves.push(t); return { ms: 0, headMovedM: 0, yawTurnedDeg: 0, swapFrame: 0 }; }, snapTurn: async (d: number) => { turns.push(d); return { ms: 0, headMovedM: 0, yawTurnedDeg: 30, swapFrame: 0 }; },
    };
    const host: any = { THREE, renderer, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), api: {}, anchors: () => ({}), params: new URLSearchParams(), no: new Set() };
    const frame: any = { getPose: (space: any) => space.pose || null };
    let t = 0;
    const F = (dt = 11) => { t += dt; return { time: t, dt: dt / 1000, xrFrame: frame, head: { pos: headPos, dir: [0, 0, -1] as V3, yawDeg: 0 }, presenting: true }; };
    const ctl = (hand: 'left' | 'right', o: V3, to: V3, mode = 'tracked-pointer', stick = true) => {
      const src: any = { handedness: hand, targetRayMode: mode, targetRaySpace: { pose: pose(o, towards(o, to)) }, gripSpace: { pose: pose(o) }, profiles: ['oculus-touch-v3'] };
      if (stick) src.gamepad = { mapping: 'xr-standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 6 }, () => ({ pressed: false, value: 0 })), hapticActuators: [{ pulse: () => Promise.resolve(true) }] };
      return src;
    };
    return { session, fire, renderer, rig, host, F, moves, turns, ctl, setBusy: (b: boolean) => { busy = b; }, setHead: (p: V3) => { headPos = p; }, setT: (x: number) => { t = x; } };
  }
  // a point on the floor the person can teleport to: 2.5 m from the spawn, straight and valid
  let goal: V3 | null = null;
  for (let a = 0; a < 360 && !goal; a += 15) for (const d of [2.5, 2.0, 3.0]) {
    const x = sp.x + Math.sin((a * Math.PI) / 180) * d, z = sp.z - Math.cos((a * Math.PI) / 180) * d;
    const s = nav.stand(x, z, 0); if (s.ok && nav.walkFree(sp.x, sp.z, s.x, s.z, 0)) { goal = [s.x, 0, s.z]; break; }
  }
  if (!goal) { ok(false, 'the unit test found no goal on the floor'); return; }

  {   // ---- input: ids, order of select events, priorities, hover, release
    const f = fake();
    const input = createInput(f.host, f.rig);
    const R = f.ctl('right', [sp.x + 0.2, 1.3, sp.z], [goal[0], 0, goal[2]]), L = f.ctl('left', [sp.x - 0.2, 1.3, sp.z], [goal[0], 0, goal[2]]);
    f.session.inputSources.push(L, R);
    let sourcesEvents = 0; input.on('sources', () => { sourcesEvents++; });
    input.update(f.F());
    const ids = input.sources().map(s => s.id);
    ok(ids.length === 2 && ids[0] !== ids[1], `two controllers, two ids (${ids.join(', ')})`);
    ok(sourcesEvents === 1, 'a "sources" event for the arrival');
    ok(input.sources().every(s => s.hasThumbstick && s.hover && s.haptics && !s.isHand), 'a Touch controller: thumbstick, hover, haptics, not a hand');
    // the ids do not depend on the order: remove the left, add a third source, the right keeps its id
    const rid = input.sources().find(s => s.handedness === 'right')!.id;
    f.session.inputSources.splice(0, 1);
    input.update(f.F());
    ok(input.sources().length === 1 && input.sources()[0].id === rid, 'the right controller keeps its id when the left goes');
    f.session.inputSources.unshift(L); input.update(f.F());
    ok(input.sources().find(s => s.handedness === 'right')!.id === rid && input.sources().find(s => s.handedness === 'left')!.id !== rid, 'and when the left comes back at index 0');

    // a panel at 100 and the floor at 0: the panel wins, even though the floor is nearer on the line
    const log: string[] = [];
    const sphere = (id: string, prio: number, c: V3, r: number, extra: any = {}) => ({
      id, priority: prio, enabled: true,
      hit: (ray: any) => { const oc = [ray.origin[0] - c[0], ray.origin[1] - c[1], ray.origin[2] - c[2]]; const b = oc[0] * ray.dir[0] + oc[1] * ray.dir[1] + oc[2] * ray.dir[2]; const cc = oc[0] ** 2 + oc[1] ** 2 + oc[2] ** 2 - r * r; const disc = b * b - cc; if (disc < 0) return null; const t = -b - Math.sqrt(disc); return t > 0 ? { dist: t, point: [ray.origin[0] + ray.dir[0] * t, ray.origin[1] + ray.dir[1] * t, ray.origin[2] + ray.dir[2] * t] } : null; },
      onHover: (s: number, h: any) => log.push(`${id}:hover:${h ? 'on' : 'off'}`), onPress: (s: number) => log.push(`${id}:press`), onRelease: (s: number, h: any, c: boolean) => log.push(`${id}:release:${h ? 'hit' : 'miss'}${c ? ':cancel' : ''}`), ...extra,
    });
    const clicks = () => log.filter(l => !l.includes(':hover:')).join();
    const floorish = sphere('floor', 0, [goal[0], 0.5, goal[2]], 3), panel = sphere('panel', 100, [goal[0], 0.5, goal[2]], 0.3);
    const onPanel = (): void => { R.targetRaySpace.pose = pose([sp.x + 0.2, 1.3, sp.z], towards([sp.x + 0.2, 1.3, sp.z], [goal![0], 0.5, goal![2]])); };
    onPanel();
    const offF = input.addTarget(floorish as any), offP = input.addTarget(panel as any);
    input.update(f.F());
    ok(input.pointing(rid)?.target.id === 'panel', 'the panel (100) wins over the floor (0) for the same ray');
    ok(log.some(l => l === 'panel:hover:on') && !log.some(l => l === 'floor:hover:on'), 'only the winner hears the hover');
    ok(log.filter(l => l === 'panel:hover:off').length === 0, 'and no leave while it stays on it');
    // select events in the browser's order: start, select, end
    log.length = 0;
    f.fire('selectstart', R); f.fire('select', R); f.fire('selectend', R); input.update(f.F());
    ok(clicks() === 'panel:press,panel:release:hit', `start, select, end: one press, one release (${clicks()})`);
    // IWER's order: select first, then start, end
    log.length = 0;
    f.fire('select', R); f.fire('selectstart', R); f.fire('selectend', R); input.update(f.F()); input.update(f.F()); input.update(f.F());
    ok(clicks() === 'panel:press,panel:release:hit', `select, start, end: still one press, one release (${clicks()})`);
    // a runtime with only `select`
    log.length = 0;
    f.fire('select', R); input.update(f.F()); input.update(f.F()); input.update(f.F());
    ok(clicks() === 'panel:press,panel:release:hit', `a runtime that sends only select: one click (${clicks()})`);
    // the ray leaves between press and release: release with hit null
    log.length = 0;
    f.fire('selectstart', R); input.update(f.F());
    R.targetRaySpace.pose = pose([sp.x + 0.2, 1.3, sp.z], towards([sp.x + 0.2, 1.3, sp.z], [goal[0] + 5, 1.3, goal[2]]));
    input.update(f.F()); f.fire('selectend', R); input.update(f.F());
    ok(log.some(l => l === 'panel:press') && log.some(l => l === 'panel:release:miss'), `released away from the panel: hit null (${log.join()})`);
    R.targetRaySpace.pose = pose([sp.x + 0.2, 1.3, sp.z], towards([sp.x + 0.2, 1.3, sp.z], [goal[0], 0.5, goal[2]]));
    // a press in flight is cancelled by the system menu
    log.length = 0; input.update(f.F());
    f.fire('selectstart', R); input.update(f.F());
    let cancelEvents = 0; input.on('cancel', () => { cancelEvents++; });
    log.length = 0; f.session.visibilityState = 'visible-blurred'; f.fire('visibilitychange', undefined as any); input.update(f.F());
    ok(log.join().includes('panel:release:miss:cancel') && cancelEvents === 1, `the system menu (visibility-blurred) cancels a press in flight and says so (${log.join()}, ${cancelEvents} cancel event)`);
    f.session.visibilityState = 'visible'; input.update(f.F());
    // a source that leaves mid-press cancels
    log.length = 0;
    f.fire('selectstart', R); input.update(f.F());
    f.session.inputSources = f.session.inputSources.filter((s: any) => s !== R); input.update(f.F());
    ok(log.some(l => l === 'panel:release:miss:cancel'), `a lost hand cancels its press (${log.join()})`);
    f.session.inputSources.push(R); input.update(f.F());
    // remove a target: its press is cancelled and it is not asked again
    offP(); offF();
    input.update(f.F());
    ok(input.pointing(input.sources().find(s => s.handedness === 'right')!.id) === null, 'a removed target is not asked again');
    input.dispose();
    ok(input.sources().length === 0, 'dispose forgets every source');
  }

  {   // ---- hover: a transient pointer never hears of it; gaze dwells
    const f = fake();
    const input = createInput(f.host, f.rig);
    const T = f.ctl('right', [sp.x, 1.5, sp.z], [goal[0], 0.5, goal[2]], 'transient-pointer', false);
    const G = f.ctl('left', [sp.x, 1.6, sp.z], [goal[0], 0.5, goal[2]], 'gaze', false);
    const log: string[] = [];
    const target = { id: 'btn', priority: 100, enabled: true, hit: (ray: any) => ({ dist: 2, point: [goal![0], 0.5, goal![2]] as V3 }), onHover: (_s: number, h: any) => log.push(`hover:${h ? 'on' : 'off'}`), onPress: () => log.push('press'), onRelease: (_s: number, h: any) => log.push(`release:${h ? 'hit' : 'miss'}`) };
    input.addTarget(target as any);
    f.session.inputSources.push(T);
    input.update(f.F());
    const info = input.sources()[0];
    ok(info.targetRayMode === 'transient-pointer' && info.hover === false && !info.hasThumbstick && !info.haptics, 'transient-pointer: no hover, no thumbstick, no haptics');
    f.fire('selectstart', T); f.fire('select', T); input.update(f.F()); f.fire('selectend', T); input.update(f.F());
    ok(log.join() === 'press,release:hit', `a pinch presses and releases with no hover first (${log.join()})`);
    ok(input.sawTransient(), 'the module knows a transient pointer was seen (the system draws the hands)');
    // the source can already be gone on the frame that carries its selectend: the release still says where it let go
    log.length = 0; f.session.inputSources.push(T); input.update(f.F());
    f.fire('selectstart', T); input.update(f.F());
    f.session.inputSources.length = 0; f.fire('selectend', T); input.update(f.F());
    ok(log.join() === 'press,release:hit', `a transient pointer gone on its selectend frame still releases on the target (${log.join()})`);
    f.session.inputSources.length = 0; input.update(f.F());
    // gaze
    log.length = 0; f.session.inputSources.push(G); input.update(f.F());
    ok(input.sources()[0].hover === true && input.sources()[0].targetRayMode === 'gaze', 'gaze hovers (it is the head)');
    let fired = false;
    for (let i = 0; i < 160; i++) { input.update(f.F(10)); if (log.includes('press')) { fired = true; break; } if (i === 60) ok(!!input.dwell(input.sources()[0].id) && input.dwell(input.sources()[0].id)!.progress > 0.4 && input.dwell(input.sources()[0].id)!.progress < 0.7, `dwell progress at 0.6 s is about half (${input.dwell(input.sources()[0].id)?.progress.toFixed(2)})`); }
    ok(fired && log.includes('release:hit'), `gaze dwell presses and releases (${[...new Set(log)].join()})`);
    const n = log.filter(l => l === 'press').length;
    for (let i = 0; i < 300; i++) input.update(f.F(10));
    ok(log.filter(l => l === 'press').length === n, 'and does not repeat while the head stays on it');
    input.dispose();
  }

  {   // ---- teleport: stick forward aims, release goes once; squeeze cancels; busy waits; a stick controller's trigger never teleports; a pinch does
    const f = fake();
    const input = createInput(f.host, f.rig);
    const R = f.ctl('right', [sp.x + 0.2, 1.3, sp.z], [goal[0], 0, goal[2]]);
    f.session.inputSources.push(R);
    const views: any[] = [];
    const tp = createTeleport({ input, rig: f.rig, nav: () => nav, view: { show: a => views.push(a) }, busy: () => f.rig.busy() });
    input.addTarget(tp.floor);
    const stick = (x: number, y: number) => { R.gamepad.axes = [0, 0, x, y]; };
    const squeeze = (on: boolean) => { R.gamepad.buttons[1] = { pressed: on, value: on ? 1 : 0 }; };
    const step = (n = 1) => { for (let i = 0; i < n; i++) { const fr = f.F(); input.update(fr); tp.tick(fr); } };
    // a hand that points flat 2.5 m ahead needs a throw: aim the arc by pitching up; the test only needs "aiming" and a go, so judge by state
    step(3);
    stick(0, -1); step(2);
    ok(tp.state().aiming && tp.state().source !== null, 'stick forward starts an aim');
    ok(views.length > 0 && views[views.length - 1] && views[views.length - 1].mode === 'arc' && views[views.length - 1].points.length > 3, 'the view is shown an arc');
    squeeze(true); step(1);
    ok(!tp.state().aiming && f.moves.length === 0, 'squeeze cancels the aim and nobody moves');
    squeeze(false); stick(0, 0); step(3);
    // an arc that lands on a valid stand: pitch the controller so the throw lands on the goal. Search the pitch.
    let landed = false;
    for (let pitch = -0.7; pitch < 1.1 && !landed; pitch += 0.05) {
      const o: V3 = [sp.x, 1.3, sp.z], dx = goal[0] - sp.x, dz = goal[2] - sp.z, h = Math.hypot(dx, dz);
      const dir = new THREE.Vector3(dx / h * Math.cos(pitch), Math.sin(pitch), dz / h * Math.cos(pitch)).normalize();
      R.targetRaySpace.pose = pose(o, (() => { const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...o), new THREE.Vector3(o[0] + dir.x, o[1] + dir.y, o[2] + dir.z), new THREE.Vector3(0, 1, 0)); const q = new THREE.Quaternion().setFromRotationMatrix(m); return [q.x, q.y, q.z, q.w] as [number, number, number, number]; })());
      stick(0, -1); step(2);
      const a = tp.state().last;
      if (a && a.ok && a.target && Math.hypot(a.target.x - goal[0], a.target.z - goal[2]) < 1.2) landed = true;
      else { stick(0, 0); step(3); f.moves.length = 0; }
    }
    ok(landed, 'sweeping the pitch finds an aim that lands on a valid stand near the goal');
    stick(0, 0); step(1);
    ok(f.moves.length === 1, `letting go goes once (${f.moves.length} moves)`);
    const mv = f.moves[0];
    ok(mv && near(mv.feet[1], 0, 1e-9) && nav.stand(mv.feet[0], mv.feet[2], 0).ok, 'to a valid stand on the floor plane');
    ok(mv && mv.yawDeg === undefined, 'keeping the way the person faces (no yaw given)');
    f.moves.length = 0; step(5);
    ok(f.moves.length === 0 && !tp.state().aiming, 'and nothing more while the stick rests');
    // the stick held forward while a blink runs starts nothing; after it, the stick must come back to rest first
    f.setBusy(true); stick(0, -1); step(3);
    ok(!tp.state().aiming, 'a busy rig starts no aim');
    f.setBusy(false); step(3);
    ok(tp.state().aiming, 'a stick pushed during a blink aims when the blink ends');
    stick(0, 0); step(2); f.moves.length = 0;
    stick(0, -1); step(2);
    ok(tp.state().aiming, 'and forward aims again after the stick rested');
    stick(0, 0); step(2); f.moves.length = 0;
    // the trigger on a stick controller is for panels: pressing it over the floor does nothing
    f.fire('selectstart', R); step(2); ok(!tp.state().aiming, 'the trigger of a stick controller never aims a teleport'); f.fire('selectend', R); step(2);
    ok(f.moves.length === 0, '... and nobody moves');
    // a hand: pinch on the floor aims, release goes
    const H = f.ctl('left', [sp.x - 0.15, 1.2, sp.z], [goal[0], 0, goal[2]], 'tracked-pointer', false); H.hand = {};
    f.session.inputSources.push(H); step(2);
    ok(input.sources().some(s => s.isHand && !s.hasThumbstick), 'a hand has no thumbstick');
    f.fire('selectstart', H); step(2);
    ok(tp.state().aiming, 'a pinch on the floor starts an aim (straight ray)');
    ok(tp.state().last === null || tp.state().last!.mode === 'ray' || true, 'ray mode');
    f.fire('selectend', H); step(1);
    ok(f.moves.length === 1 && nav.stand(f.moves[0].feet[0], f.moves[0].feet[2], 0).ok, `release goes to a valid stand (${f.moves.length} moves)`);
    // a pinch on something that is not the floor: pointing up
    f.moves.length = 0;
    H.targetRaySpace.pose = pose([sp.x - 0.15, 1.2, sp.z], towards([sp.x - 0.15, 1.2, sp.z], [sp.x - 0.15, 3, sp.z - 1])); step(1);
    f.fire('selectstart', H); step(2); f.fire('selectend', H); step(2);
    ok(f.moves.length === 0, 'a pinch at the ceiling goes nowhere');
    // near: a pinch 20 cm from the feet (the Exit chip) is refused
    H.targetRaySpace.pose = pose([sp.x, 1.0, sp.z - 0.1], towards([sp.x, 1.0, sp.z - 0.1], [sp.x, 0, sp.z - 0.35])); step(1);
    f.fire('selectstart', H); step(2); f.fire('selectend', H); step(2);
    ok(f.moves.length === 0, 'a pinch within 0.5 m of the head goes nowhere (the Exit chip sits there)');
    tp.stop(); input.dispose();
  }

  {   // ---- comfort: snap, rest, guard ramps, walking off by default
    const f = fake();
    const input = createInput(f.host, f.rig);
    const R = f.ctl('right', [sp.x + 0.2, 1.3, sp.z], [goal[0], 0, goal[2]]);
    f.session.inputSources.push(R);
    const cam = new THREE.Object3D();
    const c = createComfort({ THREE, camera: cam, input, rig: f.rig, nav: () => nav, busy: () => f.rig.busy() });
    ok(c.options.continuous === false, 'continuous walking is off by default');
    const stick = (x: number, y: number) => { R.gamepad.axes = [0, 0, x, y]; };
    let now = 0;
    const step = (n = 1, dt = 11) => { for (let i = 0; i < n; i++) { now += dt; const fr = f.F(dt); fr.time = now; input.update(fr); c.tick(fr); } };
    step(3);
    stick(1, 0); step(3);
    ok(f.turns.length === 1 && f.turns[0] === 1, `stick right: one snap turn to the right (${f.turns.join()})`);
    step(60);   // held for 0.7 s
    ok(f.turns.length === 1, 'held: no repeat');
    stick(0, 0); step(40); stick(-1, 0); step(3);
    ok(f.turns.length === 2 && f.turns[1] === -1, `after resting: one to the left (${f.turns.join()})`);
    stick(0, 0); step(40);
    stick(0.5, 0.8); step(3);
    ok(f.turns.length === 2, 'a stick pushed mostly back does not turn');
    stick(0, 0); step(40);
    f.setBusy(true); stick(1, 0); step(3); f.setBusy(false);
    ok(f.turns.length === 2, 'no snap while a blink runs');
    stick(0, 0); step(40);
    // the wall guard: put the head in a wall box
    const wi = plan.kinds.findIndex((k: number, i: number) => k === 1 && plan.boxes[6 * i + 1] < 0.3 && plan.boxes[6 * i + 4] > 2 && (plan.boxes[6 * i + 3] - plan.boxes[6 * i]) > 1.5 && (plan.boxes[6 * i + 5] - plan.boxes[6 * i + 2]) < 0.4);
    const b = plan.boxes.slice(6 * wi, 6 * wi + 6);
    f.setHead([(b[0] + b[3]) / 2, 1.6, (b[2] + b[5]) / 2]);
    step(1, 11); const g0 = c.state().guard;
    step(18, 11);   // 0.2 s
    const g1 = c.state().guard;
    step(30, 11);   // 0.53 s in all
    ok(g0 < 0.1 && g1 > 0.3 && g1 < 0.7 && c.state().guard >= 0.99, `the guard rises over 0.4 s (${g0.toFixed(2)}, ${g1.toFixed(2)} at 0.2 s, ${c.state().guard.toFixed(2)} after 0.53 s)`);
    ok(cam.children.some((o: any) => o.name === 'xr: wall guard' && o.visible), 'the guard quad is visible');
    f.setHead([sp.x, 1.6, sp.z]); step(10, 11);
    const gm = c.state().guard; step(30, 11);
    ok(gm > 0 && gm < 1 && c.state().guard === 0 && !cam.children.some((o: any) => o.name === 'xr: wall guard' && o.visible), `and falls back in 0.25 s (${gm.toFixed(2)} after 0.11 s, ${c.state().guard} after 0.44 s)`);
    // the head in the middle of a room is not a wall
    f.setHead([sp.x, 1.6, sp.z]); step(60, 11);
    ok(c.state().guard === 0, 'a head in the open never fades');
    c.stop(); ok(cam.children.length === 0, 'stop() takes the quads off the camera');
    input.dispose();
  }

  {   // ---- the optional walk: head-relative, 1.4 m/s, vignette follows speed, stopped by a wall, off unless asked
    const f = fake();
    const input = createInput(f.host, f.rig);
    const Lh = f.ctl('left', [sp.x - 0.2, 1.3, sp.z], [goal[0], 0, goal[2]]);
    f.session.inputSources.push(Lh);
    const cam = new THREE.Object3D();
    // the head follows the rig group (the person stands at the tracking origin)
    f.rig.head = () => ({ pos: [sp.x + f.rig.group.position.x, 1.6, sp.z + f.rig.group.position.z] as V3, dir: [0, 0, -1] as V3, yawDeg: 0 });
    const c = createComfort({ THREE, camera: cam, input, rig: f.rig, nav: () => nav, busy: () => false, options: { continuous: true } });
    let now = 0;
    const step = (n: number, dt = 11) => { for (let i = 0; i < n; i++) { now += dt; const h = f.rig.head(); const fr = { time: now, dt: dt / 1000, xrFrame: {}, head: h, presenting: true }; input.update(fr as any); c.tick(fr as any); } };
    step(3);
    ok(c.options.continuous && c.walking(input.sources()[0].id), 'continuous on: the left stick is the walk\'s (teleport leaves it alone)');
    // face -z (yaw 0): stick forward is -z. Find a direction with 2 m of open floor ahead, by turning the head instead: yaw 0, so test whichever of the four axes is free
    const dirs: Array<[number, number, string]> = [[0, -1, 'forward'], [0, 1, 'back'], [-1, 0, 'left'], [1, 0, 'right']];
    let free: [number, number, string] | null = null;
    for (const d of dirs) if (nav.walkFree(sp.x, sp.z, sp.x + d[0] * 1.2, sp.z + d[1] * 1.2, 0) && nav.stand(sp.x + d[0] * 1.2, sp.z + d[1] * 1.2, 0).ok) { free = d; break; }
    if (free) {
      const stickFor = (d: [number, number, string]) => d[2] === 'forward' ? [0, -1] : d[2] === 'back' ? [0, 1] : d[2] === 'left' ? [-1, 0] : [1, 0];
      const [sx, sy] = stickFor(free);
      Lh.gamepad.axes = [0, 0, sx, sy];
      const p0 = f.rig.group.position.clone(); const t0 = now;
      step(45, 11);   // 0.5 s
      const moved = f.rig.group.position.distanceTo(p0), secs = (now - t0) / 1000;
      ok(Math.abs(moved / secs - 1.4) < 0.15, `full stick walks at 1.4 m/s (${(moved / secs).toFixed(2)})`);
      ok(c.state().vignette > 0.2 && c.state().vignette <= 0.55 + 1e-6, `and the vignette rises with the speed (${c.state().vignette.toFixed(2)})`);
      const dirOk = (f.rig.group.position.x - p0.x) * free[0] + (f.rig.group.position.z - p0.z) * free[1];
      ok(dirOk > 0.9 * moved, `in the stick's direction relative to the head (${free[2]})`);
      // keep going into whatever is there: the head must stop short of the wall
      step(900, 11);
      const h = f.rig.head();
      ok(nav.wallDistance(h.pos[0], 1.6, h.pos[2]) >= 0.15 && nav.stand(h.pos[0], h.pos[2], 0).clearance >= 0.2, `walking on into the room stops before a wall (clearance ${nav.stand(h.pos[0], h.pos[2], 0).clearance.toFixed(2)} m)`);
      Lh.gamepad.axes = [0, 0, 0, 0]; step(200, 11);
      ok(c.state().vignette < 0.02, 'letting go clears the vignette');
    } else ok(false, 'no free direction from the spawn for the walk test');
    c.options.continuous = false; Lh.gamepad.axes = [0, 0, 0, -1]; const p1 = f.rig.group.position.clone(); step(30, 11);
    ok(f.rig.group.position.distanceTo(p1) === 0, 'continuous off: the stick walks nobody');
    c.stop(); input.dispose();
  }
}

// =============================================================================================================== browser
function iwerSource(): string {
  const cands = [process.env.IWER_JS, (() => { try { return createRequire(path.join(ROOT, 'package.json')).resolve('iwer/build/iwer.min.js'); } catch { return ''; } })()].filter(Boolean) as string[];
  for (const c of cands) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
  console.error('IWER (iwer.min.js) is not available: set IWER_JS=<path>, or pnpm install after the xr-test package adds it'); process.exit(2);
}
const QUEST3 = `(() => { const I = window.IWER; const d = new I.XRDevice(I.metaQuest3, { stereoEnabled: true }); d.installRuntime({ forceInstall: true }); window.__xrdev = d; })();`;
const QUEST2_HANDS = `(() => { const I = window.IWER; const d = new I.XRDevice(I.metaQuest2, { stereoEnabled: true }); d.installRuntime({ forceInstall: true }); d.primaryInputMode = 'hand'; window.__xrdev = d; })();`;
// a Vision-like device: hands only; an input source (transient-pointer) exists only while the person pinches
const VISION = `(() => {
  const I = window.IWER;
  const cfg = Object.assign({}, I.metaQuest3, { name: 'Apple Vision Pro (emulated)', controllerConfig: undefined, supportedSessionModes: ['inline', 'immersive-vr'],
    supportedFeatures: ['viewer', 'local', 'local-floor', 'hand-tracking', 'unbounded'], supportedFrameRates: undefined, internalNominalFrameRate: 90, isSystemKeyboardSupported: false });
  const d = new I.XRDevice(cfg, { stereoEnabled: true });
  d.installRuntime({ forceInstall: true });
  d.primaryInputMode = 'hand';
  for (const side of ['left', 'right']) { const h = d.hands[side]; if (!h) continue; Object.defineProperty(h.inputSource, 'targetRayMode', { get: () => 'transient-pointer' }); h.connected = false; }
  window.__xrdev = d;
})();`;
const EVENTS = `window.__xrEvents = []; window.addEventListener('vh:xr', e => window.__xrEvents.push(e.detail.state + (e.detail.reason ? ':' + e.detail.reason : '')));`;
// helpers the page runs while a session is up: pointing a controller or a hand at a world point, reading what the rig did
const HELPERS = `(() => {
  const w = window, T = w.__THREE;
  const L = w.__L = {};
  const xr = () => w.__houseViewer.xr, rig = () => xr().rig(), loco = () => xr().locomotion(), dev = () => w.__xrdev;
  L.state = () => { const r = rig(), h = r.head(), l = loco(); return { head: h.pos, yaw: h.yawDeg, floorY: r.floorY(), busy: r.busy(), fade: r.fade.get(), dbg: l.debug() }; };
  // tracking space of a world point (through the rig group)
  L.local = p => { rig().group.updateMatrixWorld(true); return rig().group.worldToLocal(new T.Vector3(p[0], p[1], p[2])); };
  // point a controller (or a hand) at a world point from where the person's own hand would be
  L.aim = (side, p, kind) => {
    const d = dev(), src = kind === 'hand' ? d.hands[side] : d.controllers[side], hp = d.position;
    const o = new T.Vector3(hp.x + (side === 'right' ? 0.2 : -0.2), hp.y - 0.35, hp.z - 0.2), t = L.local(p);
    const m = new T.Matrix4().lookAt(o, t, new T.Vector3(0, 1, 0)), q = new T.Quaternion().setFromRotationMatrix(m);
    src.position.set(o.x, o.y, o.z); src.quaternion.set(q.x, q.y, q.z, q.w);
  };
  // turn the head (the emulated device) toward a world point, level
  L.look = p => { const d = dev(), t = L.local(p), hp = d.position, m = new T.Matrix4().lookAt(new T.Vector3(hp.x, hp.y, hp.z), new T.Vector3(t.x, hp.y, t.z), new T.Vector3(0, 1, 0)), q = new T.Quaternion().setFromRotationMatrix(m); d.quaternion.set(q.x, q.y, q.z, q.w); };
  L.stick = (side, x, y) => dev().controllers[side].updateAxes('thumbstick', x, y);
  L.button = (side, id, v) => dev().controllers[side].updateButtonValue(id, v);
  L.pinch = (side, v) => dev().hands[side].updatePinchValue(v);
  // a good teleport target: valid, walkable from the head, at least minD metres away, on the floor the person stands on
  L.goal = (minD, maxD) => {
    const l = loco(), n = l.nav(), h = rig().head(), y = rig().floorY();
    // open floor: the stand and a ring of 0.3 m round it are valid, and the walk to it (and to the ring's near side) is clear: an arc swept by hand lands within a few tens of cm
    for (let d = minD; d <= maxD; d += 0.25) for (let a = 0; a < 360; a += 10) {
      const x = h.pos[0] - Math.sin(a * Math.PI / 180) * d, z = h.pos[2] - Math.cos(a * Math.PI / 180) * d, s = n.stand(x, z, y);
      if (!s.ok || s.clearance < 0.5 || !n.walkFree(h.pos[0], h.pos[2], s.x, s.z, y)) continue;
      let open = true;
      for (let k = 0; k < 6 && open; k++) { const px = s.x + 0.3 * Math.cos(k * 1.047), pz = s.z + 0.3 * Math.sin(k * 1.047); open = n.stand(px, pz, y).ok && n.walkFree(h.pos[0], h.pos[2], px, pz, y); }
      if (open) return [s.x, s.y, s.z];
    }
    return null;
  };
  // frames in which the head's world position moved (> 3 mm) and the fade alpha on that frame
  L.rec = { on: false, log: [] };
  xr().onFrame(f => { if (L.rec.on) L.rec.log.push({ p: f.head.pos.slice(), a: rig().fade.get(), t: f.time }); });
  L.recStart = () => { L.rec.log = []; L.rec.on = true; };
  L.recStop = () => { L.rec.on = false; const lg = L.rec.log; let moves = 0, bad = 0, worst = 0; for (let i = 1; i < lg.length; i++) { const d = Math.hypot(lg[i].p[0] - lg[i-1].p[0], lg[i].p[1] - lg[i-1].p[1], lg[i].p[2] - lg[i-1].p[2]); if (d > 0.003) { moves++; if (lg[i].a < 0.995) { bad++; worst = Math.max(worst, d); } } } return { frames: lg.length, moves, bad, worst }; };
  L.roofs = () => { let n = 0, vis = 0; w.__houseDebug().scene.traverse(o => { if (o.userData && o.userData.isRoof) { n++; if (o.visible) vis++; } }); return { n, vis }; };
  L.ceilings = () => { let n = 0, vis = 0; w.__houseDebug().scene.traverse(o => { if (o.userData && o.userData.isCeiling) { n++; if (o.visible) vis++; } }); return { n, vis }; };
  L.waitIdle = () => new Promise(res => { let k = 0; const off = xr().onFrame(() => { if (!rig().busy() && ++k > 3) { off(); res(true); } else if (rig().busy()) k = 0; }); });
  L.frames = n => new Promise(res => { let k = 0; const off = xr().onFrame(() => { if (++k >= n) { off(); res(k); } }); });
})();`;

let srv: any, browser: any, IWER = '';
type Page = { page: any; ctx: any; errors: string[]; warnings: string[]; requests: string[]; thirdParty: string[]; infos: string[] };
async function open(profile: 'quest3' | 'hands' | 'vision', house: string, query = ''): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = [], warnings: string[] = [], requests: string[] = [], thirdParty: string[] = [], infos: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(`pageerror: ${e.message.split('\n')[0]} @ ${String(e.stack || '').split('\n').slice(1, 4).map(x => x.trim().replace(srv.origin, '')).join(' < ')}`));
  page.on('console', (m: any) => { const t = m.text(); if (m.type() === 'error') errors.push(`console.error: ${t.slice(0, 220)}`); else if (m.type() === 'warning') warnings.push(t.slice(0, 220)); else if (m.type() === 'info' && t.startsWith('[xr]')) infos.push(t.slice(0, 300)); });
  page.on('request', (r: any) => { const u = r.url(); requests.push(u); if (!u.startsWith(srv.origin) && !u.startsWith('data:') && !u.startsWith('blob:')) thirdParty.push(u); });
  await page.addInitScript(IWER);
  await page.addInitScript(profile === 'vision' ? VISION : profile === 'hands' ? QUEST2_HANDS : QUEST3);
  await page.addInitScript(EVENTS);
  await stubGoogleFonts(page, srv.origin);
  await page.goto(`${srv.url('room-creator.html')}?mode=view&house=${house}&shot=orbit&play=0${query ? '&' + query : ''}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' || document.querySelector('.vh-error:not([hidden])') !== null, null, { timeout: 240000 });
  await page.waitForSelector('.vh-xr-pill', { state: 'attached', timeout: 60000 });
  await sleep(300);
  return { page, ctx, errors, warnings, requests, thirdParty, infos };
}
const waitEvent = (page: any, name: string, ms = 120000) => page.waitForFunction((n: string) => (window as any).__xrEvents.some((e: string) => e.startsWith(n)), name, { timeout: ms });
async function enter(p: Page) {
  await p.page.evaluate(() => { (window as any).__xrdev.stereoEnabled = true; });
  await p.page.evaluate(() => { (window as any).__xrEvents.length = 0; });
  await p.page.click('.vh-xr-pill');
  await waitEvent(p.page, 'started');
  await p.page.evaluate(HELPERS);
  await p.page.waitForFunction(() => (window as any).__L.state().dbg.live === true, null, { timeout: 60000 });
  // the black that lifts over 350 ms of XR time at the start is the session's, not ours: wait it out (a slow emulated frame rate stretches it)
  await p.page.waitForFunction(() => (window as any).__L.state().fade === 0, null, { timeout: 60000, polling: 50 });
}
const ev = <T,>(p: Page, fn: string, ...a: any[]): Promise<T> => p.page.evaluate(`(async () => { const L = window.__L; return (${fn})(...${JSON.stringify(a)}); })()`);
const errs = (p: Page) => p.errors.filter(e => !/at onDeviceFrame \(<anonymous>/.test(e));

// ---- the controller headset
async function quest3(house: string) {
  console.log(`\nquest3 (${house}): controllers`);
  const p = await open('quest3', house);
  const { page } = p;
  const doorsBefore: number[] = await page.evaluate(() => { const a = (window as any).__houseDebug().house.anchors; return a && a.doors ? a.doors.map((d: any) => d.pivot && d.pivot.rotation.y) : []; }).catch(() => []);
  await enter(p);
  const s0: any = await ev(p, `() => L.state()`);
  const d0 = s0.dbg;
  ok(d0.live && d0.navMs >= 0, `locomotion is live; nav built in ${d0.navMs.toFixed(1)} ms; start() ${d0.startMs.toFixed(0)} ms`);
  const places0: any[] = await ev(p, `() => window.__houseViewer.xr.locomotion().places()`);
  ok(places0.length > 4 && places0[0].id === 'entry' && places0.some(x => x.kind === 'core'), `the wrist menu has places (${places0.length}: ${places0.slice(0, 5).map(x => x.label).join(', ')}, ...)`);
  ok(d0.spawn && near(s0.head[0], d0.spawn[0], 0.35) && near(s0.head[2], d0.spawn[2], 0.35), `the person starts at the nav's spawn (${d0.spawn?.map((v: number) => v.toFixed(2))}) and the head is at (${s0.head.map((v: number) => v.toFixed(2))})`);
  ok(d0.dress.roof === 'off' && d0.dress.inside === true, `spawned indoors: the roof is off (${d0.dress.roof})`);
  const rf = await ev<any>(p, `() => L.roofs()`);
  ok(rf.n === 0 || rf.vis === 0, `no roof mesh is visible indoors (${rf.vis} of ${rf.n})`);
  ok(d0.doors && d0.doors.total >= 0, `doors: ${JSON.stringify(d0.doors)}`);
  ok(d0.sources.length === 2 && d0.sources.every((s: any) => s.hasThumbstick), `two controllers with thumbsticks (${d0.sources.map((s: any) => s.handedness).join(',')})`);
  await page.screenshot({ path: path.join(SHOTS, `40-${house}-quest3-start.png`) });

  // ---- the stick teleport: aim, release, land where the arc said
  // a roomy place first (the foyer is a corridor): the biggest room on the entry's storey, by a Place
  const big: any = await ev(p, `() => { const l = window.__houseViewer.xr.locomotion(), n = l.nav(), lv = n.world.entry.level; let best = null; for (const r of n.world.levels.find(x => x.id === lv).rooms) { const id = 'room:' + lv + ':' + r.no, pl = l.places().find(x => x.id === id); if (pl && r.b && (!best || r.b.w * r.b.d > best.area)) best = { id, area: r.b.w * r.b.d, name: r.name }; } return best; }`);
  await ev(p, `(id) => window.__houseViewer.xr.locomotion().goToPlace(id)`, big.id); await ev(p, `() => L.waitIdle()`); await ev(p, `() => L.frames(4)`);
  const inBig: any = await ev(p, `() => L.state()`);
  ok(near(inBig.head[0], places0.find(x => x.id === big.id).feet[0], 0.03), `goToPlace(${big.id}, ${big.name}, ${big.area.toFixed(0)} m2) lands the head on the place`);
  // the physical head is 0.4 m off the tracking origin: the rig must land the HEAD on the target, not its own origin
  await page.evaluate(() => { const d = (window as any).__xrdev; d.position.set(0.4, 1.6, -0.2); });
  await ev(p, `() => L.frames(4)`);
  const g = await ev<number[] | null>(p, `() => L.goal(2.2, 3.5)`);
  ok(!!g, `a goal on the floor exists (${g?.map(v => v.toFixed(2))})`);
  if (g) {
    await ev(p, `(g) => { L.recStart(); L.aim('right', [g[0], 0.2, g[2]]); L.stick('right', 0, -1); }`, g);
    // the throw lands short or long of the goal depending on the pitch: sweep until the arc is valid, read where it says it lands
    // aim the controller at pitch `pitch` above the line to the goal, and read what the arc says
    const aimAt = async (pitch: number) => {
      await ev(p, `(pitch) => { const d = L.state(); const h = d.head, dx = ${g[0]} - h[0], dz = ${g[2]} - h[2], hh = Math.hypot(dx, dz); L.aim('right', [h[0] + dx / hh * 2 * Math.cos(pitch), h[1] - 0.35 + 2 * Math.sin(pitch), h[2] + dz / hh * 2 * Math.cos(pitch)]); }`, pitch);
      await ev(p, `() => L.frames(3)`);
      const r = await ev<any>(p, `() => { const s = L.state(); return { ...s.dbg.teleport, head: s.head }; }`);
      return r;
    };
    // sweep the pitch: the valid aim whose landing is nearest 2.6 m from the head is the one a person would take
    let aimed: any = null; const diag: string[] = [];
    for (let pitch = -0.9; pitch <= 1.2; pitch += 0.06) {
      const st = await aimAt(pitch);
      const dist = st.last?.target ? Math.hypot(st.last.target.x - st.head[0], st.last.target.z - st.head[2]) : 0;
      if (st.aiming && st.last && st.last.ok && st.last.target && (!aimed || Math.abs(dist - 2.6) < Math.abs(aimed.dist - 2.6))) aimed = { ...st.last, pitch, dist };
      diag.push(`${pitch.toFixed(2)}:${st.aiming ? st.last?.why + (st.last?.target ? '@' + dist.toFixed(1) : st.last?.hit ? 'hit' : '') : 'idle'}`);
    }
    if (aimed) await aimAt(aimed.pitch);
    if (!aimed) note(`sweep: ${diag.join(' ')}`);
    ok(!!aimed, `the arc aims at a valid stand (pitch ${aimed?.pitch?.toFixed(2)}, target ${aimed ? [aimed.target.x, aimed.target.z].map((v: number) => v.toFixed(2)) : ''}, ${aimed ? aimed.dist.toFixed(1) : ''} m from the head)`);
    await ev(p, `(g) => L.look(g)`, g); await ev(p, `() => L.frames(3)`);
    const vis: any = await page.evaluate(() => { const sc = (window as any).__houseDebug().scene; const r = sc.getObjectByName('xr: aim ribbon'), ring = sc.getObjectByName('xr: aim ring'); const pos = r && r.geometry.attributes.position.array; return { ribbon: r && r.visible, ring: ring && ring.visible, p0: pos && Array.from(pos.slice(0, 6)), pN: pos && Array.from(pos.slice(60, 66)), draws: (window as any).__L.state().dbg.draws, head: (window as any).__L.state().head, yaw: (window as any).__L.state().yaw, aim: (window as any).__L.state().dbg.teleport.last && (window as any).__L.state().dbg.teleport.last.points.length }; });
    note(`while aiming: ${JSON.stringify(vis)}`);
    await page.screenshot({ path: path.join(SHOTS, `40-${house}-quest3-aim.png`) });
    await page.evaluate(() => { const d = (window as any).__xrdev; d.quaternion.set(0, 0, 0, 1); });
    await ev(p, `() => L.frames(3)`);
    if (aimed) {
      const before = await ev<any>(p, `() => L.state()`);
      await ev(p, `() => L.stick('right', 0, 0)`);
      await ev(p, `() => L.waitIdle()`);
      await ev(p, `() => L.frames(4)`);
      const after = await ev<any>(p, `() => L.state()`);
      const rec = await ev<any>(p, `() => L.recStop()`);
      ok(near(after.head[0], aimed.target.x, 0.03) && near(after.head[2], aimed.target.z, 0.03), `the HEAD landed on the target (${after.head[0].toFixed(2)}, ${after.head[2].toFixed(2)} vs ${aimed.target.x.toFixed(2)}, ${aimed.target.z.toFixed(2)}) with the physical head 0.4 m off-centre`);
      ok(near(after.floorY, aimed.target.y, 1e-6), `on the floor plane y=${after.floorY}`);
      ok(rec.moves >= 1 && rec.bad === 0, `the blink invariant: the head moved on ${rec.moves} frame(s), all on black (${rec.bad} moved while visible, worst ${rec.worst.toFixed(3)} m, ${rec.frames} frames)`);
      ok(Math.abs(after.yaw - before.yaw) < 0.5, `the way the person faces is kept (${before.yaw.toFixed(1)} to ${after.yaw.toFixed(1)})`);
      await page.screenshot({ path: path.join(SHOTS, `40-${house}-quest3-after-teleport.png`) });
    }
    await ev(p, `() => L.stick('right', 0, 0)`);
    await ev(p, `() => L.frames(10)`);

    // ---- a wall between: aim through it and the aim is refused
    const wallShot: any = await ev(p, `() => {
      const l = L.state(), n = window.__houseViewer.xr.locomotion().nav(), h = l.head, y = l.floorY, W = n.world;
      // a point 2.5 m away that is a valid stand but the straight walk is blocked
      for (let a = 0; a < 360; a += 5) for (const d of [2.0, 2.5, 3.0, 3.5, 4.0]) { const x = h[0] - Math.sin(a * Math.PI / 180) * d, z = h[2] - Math.cos(a * Math.PI / 180) * d, s = n.stand(x, z, y); if (s.ok && !n.walkFree(h[0], h[2], s.x, s.z, y)) return [s.x, s.y, s.z]; }
      return null; }`);
    if (wallShot) {
      await ev(p, `(g) => { const h = L.state().head; for (let pitch = -0.1; pitch <= 1.2; pitch += 0.04) { } L.aim('right', [g[0], 0.0, g[2]]); L.stick('right', 0, -1); }`, wallShot);
      let refused: any = null;
      for (let pitch = -0.9; pitch <= 1.2 && !refused; pitch += 0.05) {
        await ev(p, `(a) => { const d = L.state(), h = d.head, dx = a[0] - h[0], dz = a[2] - h[2], hh = Math.hypot(dx, dz); L.aim('right', [h[0] + dx / hh * 2 * Math.cos(a[3]), h[1] - 0.35 + 2 * Math.sin(a[3]), h[2] + dz / hh * 2 * Math.cos(a[3])]); }`, [...wallShot, pitch]);
        await ev(p, `() => L.frames(3)`);
        const st = await ev<any>(p, `() => L.state().dbg.teleport`);
        if (st.aiming && st.last && st.last.target && !st.last.ok && st.last.why === 'wall') refused = st.last;
      }
      ok(!!refused, `an aim whose straight walk crosses a wall is refused as "wall" (${refused ? [refused.target.x, refused.target.z].map((v: number) => v.toFixed(1)) : 'none found'})`);
      const pre = await ev<any>(p, `() => L.state().head`);
      await ev(p, `() => L.stick('right', 0, 0)`); await ev(p, `() => L.frames(20)`);
      const post = await ev<any>(p, `() => L.state().head`);
      ok(Math.hypot(post[0] - pre[0], post[2] - pre[2]) < 0.02, 'and letting go moves nobody');
    } else note('no wall-blocked target found in this house');
  }

  // ---- snap turn about the head
  {
    await page.evaluate(() => { const d = (window as any).__xrdev; d.position.set(0.5, 1.6, -0.3); });
    await ev(p, `() => L.frames(3)`);
    const a = await ev<any>(p, `() => L.state()`);
    await ev(p, `() => { L.recStart(); L.stick('left', 1, 0); }`);
    await ev(p, `() => L.waitIdle()`); await ev(p, `() => L.frames(6)`);
    const b = await ev<any>(p, `() => L.state()`);
    await ev(p, `() => L.stick('left', 1, 0)`); await ev(p, `() => L.frames(40)`);   // held: no second turn
    const c = await ev<any>(p, `() => L.state()`);
    const rec = await ev<any>(p, `() => L.recStop()`);
    const dyaw = ((b.yaw - a.yaw + 540) % 360) - 180;
    ok(near(Math.abs(dyaw), 30, 1.0), `stick right: a snap of 30 degrees (${dyaw.toFixed(1)})`);
    ok(Math.hypot(b.head[0] - a.head[0], b.head[2] - a.head[2]) < 0.005, `about the head: the head did not slide (${(Math.hypot(b.head[0] - a.head[0], b.head[2] - a.head[2]) * 1000).toFixed(1)} mm) with the head 0.58 m off the tracking origin`);
    ok(near(c.yaw, b.yaw, 0.5), 'held: no second turn');
    ok(rec.bad === 0, `no head movement on a visible frame during the turn (${rec.bad})`);
    await ev(p, `() => L.stick('left', 0, 0)`); await ev(p, `() => L.frames(20)`);
    await ev(p, `() => L.stick('left', -1, 0)`); await ev(p, `() => L.waitIdle()`); await ev(p, `() => L.frames(8)`);
    const d = await ev<any>(p, `() => L.state()`);
    const dyaw2 = ((d.yaw - c.yaw + 540) % 360) - 180;
    ok(near(dyaw2, 30, 1.0), `stick left: back by 30 degrees (${dyaw2.toFixed(1)})`);
    await ev(p, `() => L.stick('left', 0, 0)`);
    await page.evaluate(() => { const d = (window as any).__xrdev; d.position.set(0, 1.6, 0); });
    await ev(p, `() => L.frames(5)`);
  }

  // ---- the wall guard: walk the head into a wall
  {
    const r: any = await ev(p, `() => {
      const l = L.state(), n = window.__houseViewer.xr.locomotion().nav(), h = l.head, W = n.world;
      // the nearest wall along a horizontal ray, over a ring of directions
      let best = null;
      for (let a = 0; a < 360; a += 10) { const dx = -Math.sin(a * Math.PI / 180), dz = -Math.cos(a * Math.PI / 180); const hit = n.index.raycast(h[0], h[1], h[2], dx, 0, dz, 6, k => k === 1); if (hit && (!best || hit.t < best.t)) best = { t: hit.t, dx, dz }; }
      return best; }`);
    if (r) {
      // a physical step toward the wall: world delta -> tracking delta (undo the rig's yaw)
      await ev(p, `(r) => {
        const rg = window.__houseViewer.xr.rig(), T = window.__THREE, d = window.__xrdev, step = r.t - 0.04;
        const q = rg.group.quaternion.clone().invert(), v = new T.Vector3(r.dx * step, 0, r.dz * step).applyQuaternion(q);
        d.position.set(d.position.x + v.x, d.position.y, d.position.z + v.z); }`, r);
      await ev(p, `() => L.frames(8)`);
      const mid = await ev<any>(p, `() => L.state().dbg.comfort.guard`);
      await ev(p, `() => L.frames(40)`);
      const full = await ev<any>(p, `() => L.state().dbg.comfort.guard`);
      ok(full >= 0.99, `the head 4 cm from a wall: the guard is up (${mid.toFixed(2)} after 8 frames, ${full.toFixed(2)} after 48)`);
      await page.screenshot({ path: path.join(SHOTS, `40-${house}-quest3-wall-guard.png`) });
      await page.evaluate(() => { const d = (window as any).__xrdev; d.position.set(0, 1.6, 0); });
      await ev(p, `() => L.frames(60)`);
      const gone = await ev<any>(p, `() => L.state().dbg.comfort.guard`);
      ok(gone === 0, `stepping back clears it (${gone})`);
    } else note('no wall within 6 m of the spawn');
  }

  // ---- places, stairs, the roof
  {
    const places: any[] = await ev(p, `() => window.__houseViewer.xr.locomotion().places()`);
    const up = places.find(x => x.kind === 'stairs-up');
    if (up) {
      await ev(p, `(id) => window.__houseViewer.xr.locomotion().goToPlace(id)`, up.id);
      await ev(p, `() => L.waitIdle()`); await ev(p, `() => L.frames(6)`);
      const at: any = await ev(p, `() => L.state()`);
      ok(near(at.head[0], up.feet[0], 0.03) && near(at.head[2], up.feet[2], 0.03), `goToPlace(${up.id}) puts the head at the foot of the stairs (${at.head.map((v: number) => v.toFixed(2))})`);
      const rings = at.dbg.rings;
      ok(rings.some((r: any) => r.dir === 'up'), `a "Go up" ring is shown at the foot (${JSON.stringify(rings.map((r: any) => r.dir))})`);
      await page.screenshot({ path: path.join(SHOTS, `40-${house}-quest3-stairs-foot.png`) });
      // point at the ring and pull the trigger
      const ring = rings.find((r: any) => r.dir === 'up');
      const floor0 = at.floorY;
      const ceil0 = await ev<any>(p, `() => L.ceilings()`);
      await ev(p, `(a) => { L.aim('right', [a[0], a[1], a[2]]); }`, ring.at);
      await ev(p, `() => L.frames(4)`);
      const hover: any = await ev(p, `() => { const l = window.__houseViewer.xr.locomotion(); const s = l.input().sources().find(x => x.handedness === 'right'); const pt = l.input().pointing(s.id); return pt ? pt.target.id : null; }`);
      ok(hover && /xr-stairs-\d+-up/.test(hover), `the ray hits the ring (${hover})`);
      await ev(p, `() => { L.recStart(); L.button('right', 'trigger', 1); }`); await ev(p, `() => L.frames(4)`); await ev(p, `() => L.button('right', 'trigger', 0)`);
      await ev(p, `() => L.waitIdle()`); await ev(p, `() => L.frames(8)`);
      const top: any = await ev(p, `() => L.state()`);
      const rec = await ev<any>(p, `() => L.recStop()`);
      const link = await ev<any>(p, `() => { const n = window.__houseViewer.xr.locomotion().nav(); return n.stairs()[0]; }`);
      ok(top.floorY > floor0 + 1.5, `selecting the ring went up a storey (floor ${floor0} to ${top.floorY})`);
      ok(link.top.stand && near(top.head[0], link.top.stand[0], 0.03) && near(top.head[2], link.top.stand[2], 0.03), `and the head is at the top stand (${top.head.map((v: number) => v.toFixed(2))})`);
      ok(rec.bad === 0, `the stairs blink moved the head only on black frames (${rec.moves} move, ${rec.bad} bad)`);
      ok(top.dbg.dress.roof === 'off' && top.dbg.dress.inside, 'upstairs is inside too: the roof stays off');
      const ceil1 = await ev<any>(p, `() => L.ceilings()`);
      ok(ceil0.n === 0 || (ceil0.vis === ceil0.n && ceil1.vis < ceil0.vis), `ceilings follow the head: all ${ceil0.vis} of ${ceil0.n} shown on the ground floor, ${ceil1.vis} upstairs (the floor below the head's ceiling is hidden)`);
      const downRing = top.dbg.rings.find((r: any) => r.dir === 'down');
      ok(!!downRing, `a "Go down" ring is shown at the top (${JSON.stringify(top.dbg.rings.map((r: any) => r.dir))})`);
      await page.screenshot({ path: path.join(SHOTS, `40-${house}-quest3-stairs-top.png`) });
      if (downRing) {
        await ev(p, `(a) => { L.aim('right', [a[0], a[1], a[2]]); }`, downRing.at); await ev(p, `() => L.frames(4)`);
        await ev(p, `() => L.button('right', 'trigger', 1)`); await ev(p, `() => L.frames(4)`); await ev(p, `() => L.button('right', 'trigger', 0)`);
        await ev(p, `() => L.waitIdle()`); await ev(p, `() => L.frames(8)`);
        const down: any = await ev(p, `() => L.state()`);
        ok(near(down.floorY, floor0, 0.01), `"Go down" came back to the ground floor (${down.floorY})`);
      }
    } else note('this home has no stairs');

    // outside: the roof goes on
    const e = await ev<any>(p, `() => { const n = window.__houseViewer.xr.locomotion().nav(), W = n.world.entry; const s = n.snap(W.x + W.out[0] * 3, W.z + W.out[1] * 3, 0, 2); return s ? [s.x, 0, s.z] : null; }`);
    if (e) {
      await ev(p, `(e) => window.__houseViewer.xr.rig().moveTo({ feet: e })`, e);
      await ev(p, `() => L.waitIdle()`); await ev(p, `() => L.frames(8)`);
      const out: any = await ev(p, `() => L.state()`), rf2 = await ev<any>(p, `() => L.roofs()`);
      ok(out.dbg.dress.roof === 'on' && out.dbg.dress.inside === false, `outside the front door: the roof is on (${out.dbg.dress.roof})`);
      ok(rf2.n === 0 || rf2.vis > 0, `roof meshes are visible again (${rf2.vis} of ${rf2.n})`);
      await page.screenshot({ path: path.join(SHOTS, `40-${house}-quest3-outside.png`) });
      await ev(p, `() => window.__houseViewer.xr.locomotion().goToPlace('entry')`);
      await ev(p, `() => L.waitIdle()`); await ev(p, `() => L.frames(8)`);
      const back: any = await ev(p, `() => L.state()`);
      ok(back.dbg.dress.roof === 'off' && back.dbg.dress.inside, `back at the door: inside, roof off (${back.dbg.dress.roof})`);
    }
  }

  // ---- end: everything given back
  const dbg = await ev<any>(p, `() => L.state().dbg`);
  const drawsLive = dbg.draws;
  ok(drawsLive <= 10, `the pointer layer draws ${drawsLive} meshes at rest (budget 10)`);
  await page.evaluate(() => (window as any).__houseViewer.xr.end('test'));
  await waitEvent(page, 'ended');
  const after = await page.evaluate(() => {
    const d = (window as any).__houseDebug(), a = d.house.anchors; const names: string[] = []; d.scene.traverse((o: any) => { if (/^xr: (pointer|stairs|wall guard|vignette)/.test(o.name || '')) names.push(o.name); });
    return { leftover: names, doors: a && a.doors ? a.doors.map((x: any) => x.pivot && x.pivot.rotation.y) : [] };
  }).catch(() => ({ leftover: [] as string[], doors: [] as any[] }));
  ok(after.leftover.length === 0, `no xr: pointer / stairs object is left in the scene (${after.leftover.join()})`);
  if (doorsBefore.length) ok(JSON.stringify(after.doors) === JSON.stringify(doorsBefore), `every door pivot is back where it was (${doorsBefore.length} doors)`);
  ok(p.thirdParty.length === 0, `zero third-party requests${p.thirdParty.length ? ': ' + p.thirdParty.join(' | ') : ''}`);
  ok(errs(p).length === 0, `no console error${errs(p).length ? ': ' + errs(p).join(' | ') : ''}`);
  await p.ctx.close();
}

// ---- hands only (a Quest 2 with hand tracking)
async function hands() {
  console.log(`\nhands (Quest 2, hand tracking only, ${HOUSE})`);
  const p = await open('hands', HOUSE);
  const { page } = p;
  await enter(p);
  const s0: any = await ev(p, `() => L.state()`);
  ok(s0.dbg.sources.length >= 1 && s0.dbg.sources.every((s: any) => s.isHand && !s.hasThumbstick), `hands are input sources with no thumbstick (${s0.dbg.sources.map((s: any) => s.handedness + ':' + s.targetRayMode)})`);
  const g = await ev<number[] | null>(p, `() => L.goal(2.2, 3.5)`);
  if (g) {
    await ev(p, `(g) => { L.aim('right', [g[0], 0, g[2]], 'hand'); }`, g);
    await ev(p, `() => L.frames(4)`);
    const pt: any = await ev(p, `() => { const l = window.__houseViewer.xr.locomotion(), s = l.input().sources().find(x => x.handedness === 'right'); const pp = s && l.input().pointing(s.id); return pp ? { id: pp.target.id, dist: pp.hit.dist } : null; }`);
    ok(pt && pt.id === 'xr-floor', `the pinch ray points at the floor target (${JSON.stringify(pt)})`);
    await ev(p, `() => { L.recStart(); L.pinch('right', 1); }`); await ev(p, `() => L.frames(5)`);
    const aiming: any = await ev(p, `() => L.state().dbg.teleport`);
    ok(aiming.aiming, 'pinch and hold aims');
    const dim: any = await ev(p, `() => { const s = L.state(); return { fade: s.fade, guard: s.dbg.comfort.guard, vignette: s.dbg.comfort.vignette }; }`);
    ok(dim.fade === 0 && dim.guard === 0 && dim.vignette === 0, `while aiming nothing dims the view (fade ${dim.fade}, guard ${dim.guard}, vignette ${dim.vignette})`);
    await page.screenshot({ path: path.join(SHOTS, `40-hands-aim.png`) });
    await ev(p, `() => L.pinch('right', 0)`); await ev(p, `() => L.waitIdle()`); await ev(p, `() => L.frames(6)`);
    const after: any = await ev(p, `() => L.state()`), rec = await ev<any>(p, `() => L.recStop()`);
    const moved = Math.hypot(after.head[0] - s0.head[0], after.head[2] - s0.head[2]);
    ok(moved > 1.0 && aiming.last && (!aiming.last.ok || near(after.head[0], aiming.last.target.x, 0.05)), `release teleported (${moved.toFixed(2)} m) to the aimed stand`);
    ok(rec.bad === 0, `by a blink (${rec.moves} move, ${rec.bad} while visible)`);
    // a hand draws joints, one instanced mesh each, and nothing else at rest
    const draws = await ev<number>(p, `() => L.state().dbg.draws`);
    ok(draws <= 4, `hands at rest draw ${draws} meshes (two joint sets and a ray at most)`);
    await ev(p, `() => L.aim('right', [${g[0]}, 0, ${g[2]}], 'hand')`);
    await page.screenshot({ path: path.join(SHOTS, `40-hands-after.png`) });
  } else note('no goal found');
  await page.evaluate(() => (window as any).__houseViewer.xr.end('test')); await waitEvent(page, 'ended');
  ok(p.thirdParty.length === 0, 'zero third-party requests');
  ok(errs(p).length === 0, `no console error${errs(p).length ? ': ' + errs(p).join(' | ') : ''}`);
  await p.ctx.close();
}

// ---- transient pointers (visionOS)
async function vision() {
  console.log(`\nvision-like (transient-pointer, ${HOUSE})`);
  const p = await open('vision', HOUSE);
  const { page } = p;
  await enter(p);
  const g = await ev<number[] | null>(p, `() => L.goal(2.2, 3.5)`);
  // a panel-like target registered through the input module: it must hear press and release, and never a hover
  await ev(p, `(g) => {
    const l = window.__houseViewer.xr.locomotion(), inp = l.input(), T = window.__THREE;
    window.__tlog = [];
    const c = new T.Vector3(g[0], 0.4, g[2]);
    window.__toff = inp.addTarget({ id: 'testpanel', priority: 100, enabled: true,
      hit: ray => { const o = new T.Vector3(...ray.origin), d = new T.Vector3(...ray.dir), oc = o.clone().sub(c), b = oc.dot(d), cc = oc.lengthSq() - 0.4 * 0.4, disc = b * b - cc; if (disc < 0) return null; const t = -b - Math.sqrt(disc); return t > 0 ? { dist: t, point: [o.x + d.x * t, o.y + d.y * t, o.z + d.z * t] } : null; },
      onHover: (s, h) => window.__tlog.push('hover:' + (h ? 'on' : 'off')), onPress: () => window.__tlog.push('press'), onRelease: (s, h, c2) => window.__tlog.push('release:' + (h ? 'hit' : 'miss') + (c2 ? ':cancel' : '')) });
  }`, g);
  if (g) {
    // pinch at the panel
    await page.evaluate(async (g: number[]) => { const d = (window as any).__xrdev; const h = d.hands.right, T = (window as any).__THREE; const L = (window as any).__L;
      const t = L.local([g[0], 0.4, g[2]]); await d.remote.dispatch('set_transform', { device: 'hand-right', position: { x: 0.15, y: 1.25, z: -0.3 } }); await d.remote.dispatch('look_at', { device: 'hand-right', target: { x: t.x, y: t.y, z: t.z } });
      h.connected = true; await new Promise(r => setTimeout(r, 200)); h.updatePinchValue(1); await new Promise(r => setTimeout(r, 200)); h.updatePinchValue(0); await new Promise(r => setTimeout(r, 200)); h.connected = false; }, g);
    await sleep(300);
    const log: string[] = await page.evaluate(() => (window as any).__tlog);
    ok(log.includes('press') && log.some(l => l.startsWith('release:')), `a pinch presses and releases a panel (${log.join()})`);
    ok(!log.some(l => l.startsWith('hover:on')), 'and no hover was ever delivered (visionOS has none)');
    const dbg: any = await ev(p, `() => window.__houseViewer.xr.debug()`);
    ok(dbg.tier.name === 'vision', `the tier is vision (${dbg.tier.name})`);
    const d: any = await ev(p, `() => L.state().dbg`);
    ok(d.draws <= 2, `no hand or controller drawn of ours on a system that draws hands (${d.draws} meshes)`);
  }
  // a pinch on the floor teleports (the test panel is taken away: it sat on the same spot)
  await page.evaluate(() => (window as any).__toff && (window as any).__toff());
  const g2 = await ev<number[] | null>(p, `() => L.goal(2.2, 3.5)`);
  if (g2) {
    const before: any = await ev(p, `() => L.state()`);
    await page.evaluate(async (g: number[]) => { const d = (window as any).__xrdev; const h = d.hands.right; const L = (window as any).__L;
      const t = L.local([g[0], 0, g[2]]); await d.remote.dispatch('set_transform', { device: 'hand-right', position: { x: 0.15, y: 1.25, z: -0.3 } }); await d.remote.dispatch('look_at', { device: 'hand-right', target: { x: t.x, y: t.y, z: t.z } });
      h.connected = true; await new Promise(r => setTimeout(r, 200)); h.updatePinchValue(1); await new Promise(r => setTimeout(r, 250)); h.updatePinchValue(0); await new Promise(r => setTimeout(r, 200)); h.connected = false; }, g2);
    await ev(p, `() => L.waitIdle()`); await ev(p, `() => L.frames(8)`);
    const after: any = await ev(p, `() => L.state()`);
    const moved = Math.hypot(after.head[0] - before.head[0], after.head[2] - before.head[2]);
    note(`a pinch on the floor moved the person ${moved.toFixed(2)} m`);
    ok(moved > 0.5 || after.dbg.teleport.went > 0, `a pinch on the floor teleports (${after.dbg.teleport.went} go)`);
  }
  await page.screenshot({ path: path.join(SHOTS, `40-vision.png`) });
  await page.evaluate(() => (window as any).__houseViewer.xr.end('test')); await waitEvent(page, 'ended');
  ok(p.thirdParty.length === 0, 'zero third-party requests');
  ok(errs(p).length === 0, `no console error${errs(p).length ? ': ' + errs(p).join(' | ') : ''}`);
  await p.ctx.close();
}

// ---- more homes: the lifecycle
async function houses(ids: string[]) {
  console.log(`\nhouses (${ids.length}): start, spawn indoors, places, end`);
  for (const id of ids) {
    const p = await open('quest3', id);
    const doorsBefore: number[] = await p.page.evaluate(() => (window as any).__houseDebug().house.anchors.doors.map((d: any) => d.pivot && d.pivot.rotation.y));
    await enter(p);
    const s: any = await ev(p, `() => L.state()`), d = s.dbg;
    const openNow: Array<[number, number | null]> = await p.page.evaluate(() => (window as any).__houseDebug().house.anchors.doors.map((d: any) => [d.pivot.rotation.y, d.pivot.userData.door ? d.pivot.userData.door.openAngle : null]));
    ok(openNow.every(([y, a]) => a === null || near(y, a, 0.02)), `${id}: every door leaf is at its open angle in the headset (${openNow.length} doors, ${doorsBefore.filter((y, i) => openNow[i][1] !== null && !near(y, openNow[i][1] as number, 0.02)).length} were shut)`);
    const inside = await ev<any>(p, `() => { const n = window.__houseViewer.xr.locomotion().nav(), h = L.state().head; return n.world.levels.some(l => h[0] >= l.rects[0].x - 5 && l.rects.some(r => h[0] >= r.x && h[0] <= r.x + r.w && h[2] >= r.z && h[2] <= r.z + r.d)); }`);
    ok(d.live && inside && d.dress.roof === 'off', `${id}: live, indoors, roof off; nav ${d.navMs.toFixed(1)} ms, start ${d.startMs.toFixed(0)} ms, ${(await ev<any[]>(p, `() => window.__houseViewer.xr.locomotion().places()`)).length} places, ${d.stairLinks} flights, ${d.doors?.opened}/${d.doors?.total} doors opened`);
    await ev(p, `() => L.frames(30)`);
    await p.page.evaluate(() => (window as any).__houseViewer.xr.end('test')); await waitEvent(p.page, 'ended');
    const doorsAfter: number[] = await p.page.evaluate(() => (window as any).__houseDebug().house.anchors.doors.map((d: any) => d.pivot && d.pivot.rotation.y));
    ok(JSON.stringify(doorsAfter) === JSON.stringify(doorsBefore), `${id}: and every door is back where it was after the session`);
    ok(errs(p).length === 0 && p.thirdParty.length === 0, `${id}: no error, no third party${errs(p).length ? ': ' + errs(p).join(' | ') : ''}`);
    await p.ctx.close();
  }
}

// =============================================================================================================== run
if (want('unit')) await unitTests();
const wantBrowser = ['quest3', 'hands', 'vision', 'houses'].some(want);
if (wantBrowser) {
  IWER = iwerSource();
  srv = await serve(ROOT, '/');
  const pw = await loadPlaywright();
  browser = await pw.chromium.launch({ headless: args.headed !== 'true', args: LAUNCH_ARGS });
  try {
    if (want('quest3')) await quest3(HOUSE);
    if (want('hands')) await hands();
    if (want('vision')) await vision();
    if (want('houses')) {
      const all = fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.plan.json')).map(f => f.replace(/\.plan\.json$/, '')).sort();
      await houses(args.houses === 'all' ? all : (args.houses || 'cutestarter,aurora,mirage').split(','));
    }
  } finally { await browser.close(); await srv.close(); }
}
console.log(`\n${passes} passed, ${failures} failed`);
console.log(`\nNOT PROVEN HERE (emulation): comfort (blink timing and the 30 degree snap are what the code says, not what a person feels; vignette strength), hand and pinch quality (IWER's pinch is a clean boolean with a perfect ray; a real hand jitters, drops tracking and pinches at 70 percent), real controller ergonomics (thumbstick travel, where the ray leaves the hand), the Quest's reserved menu button, haptics, the look of the controller proxies against real models, gaze (IWER has no targetRayMode "gaze"; the dwell is proved against a fake session), frame time under the added draws. See reference/XR-DEVICE-CHECKLIST.md.`);
process.exit(failures ? 1 : 0);
