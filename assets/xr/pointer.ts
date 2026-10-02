// assets/xr/pointer.ts : what the person sees of their own input: the ray, where it lands, the controllers, the hands, the gaze dot, and the
// teleport arc and its landing ring. All of it is OUR geometry (a box, a sphere, a ring, a ribbon, an instanced sphere per joint).
//
// Not three's XRControllerModelFactory or XRHandMeshModel: both fetch their models from cdn.jsdelivr.net (the webxr-input-profiles assets)
// at runtime, and this site asks no third party for anything (portal:test fails on a request to another origin). A Touch controller drawn
// as a small grey block with a pointer is less pretty than the real model and costs nothing, no licence and no request.
//
// Draw calls matter in a headset (every call is drawn twice, and a Quest 2 is held to about 190 a frame in total): a ray and its dot exist only
// while something that can be pressed is under it (or the person is aiming), the arc and the ring only while aiming, the grip proxies only for
// controllers, the joints one InstancedMesh per hand. At rest with two controllers in hand that is two small meshes, not twenty.
//
// Everything is added to ONE group in the scene, `xr: pointer`, tagged userData.xrOverlay, and removed and disposed by stop().
import type { V3, XrFrame, XrHost, XrRig } from './host.js';
import type { Aim, AimView } from './teleport.js';
import type { XrInputImpl } from './input.js';

const GREEN = 0x35d07f, RED = 0xff5a4d, WHITE = 0xffffff, ORANGE = 0xff7a45, GREY = 0x8f9aa0;
const cssPrimary = (): number => {
  try { const c = (getComputedStyle(document.querySelector('.vh') || document.documentElement).getPropertyValue('--primary') || '').trim(); if (/^#[0-9a-f]{6}$/i.test(c)) return parseInt(c.slice(1), 16); } catch { /* the default */ }
  return ORANGE;
};

export interface Pointer {
  view: AimView;
  tick(f: XrFrame): void;
  /** the meshes alive right now (the aim, rays, dots, grips, joints): the draw-call cost the budget test reads */
  drawCount(): number;
  stop(): void;
}

export function createPointer(host: XrHost, input: XrInputImpl, rig: XrRig): Pointer {
  const THREE = host.THREE, scene = host.scene;
  const root = new THREE.Group(); root.name = 'xr: pointer'; root.userData.xrOverlay = true;
  scene.add(root);
  const accent = cssPrimary();
  const geos: any[] = [], mats: any[] = [];
  const mat = (color: number, o: any = {}) => { const m = new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false, ...o }); mats.push(m); return m; };
  const geo = <T>(g: T): T => { geos.push(g); return g; };
  const mesh = (g: any, m: any, name: string) => { const o = new THREE.Mesh(g, m); o.name = name; o.frustumCulled = false; o.visible = false; o.raycast = () => {}; o.renderOrder = 9000; root.add(o); return o; };

  const unitBox = geo(new THREE.BoxGeometry(1, 1, 1));
  const dotGeo = geo(new THREE.SphereGeometry(0.012, 10, 8));
  const gripGeo = geo(new THREE.BoxGeometry(0.04, 0.035, 0.12));
  const jointGeo = geo(new THREE.SphereGeometry(1, 6, 4));
  const ringGeo = geo(new THREE.RingGeometry(0.2, 0.28, 40).rotateX(-Math.PI / 2));
  const padGeo = geo(new THREE.CircleGeometry(0.2, 32).rotateX(-Math.PI / 2));
  const reticleGeo = geo(new THREE.RingGeometry(0.018, 0.026, 24));
  const fillGeo = geo(new THREE.CircleGeometry(0.018, 24));
  const white = mat(WHITE, { transparent: true, opacity: 0.85 }), hot = mat(accent), grey = mat(GREY), skin = mat(0xdfe6ea);
  const ok = mat(GREEN, { transparent: true, opacity: 0.95, side: THREE.DoubleSide }), bad = mat(RED, { transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  const okPad = mat(GREEN, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }), badPad = mat(RED, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });

  // ---- the aim: a ribbon along the arc (or the line), a ring where it lands
  const SEG = 40;
  const ribbonGeo = geo(new THREE.BufferGeometry());
  const ribbonPos = new Float32Array((SEG + 1) * 2 * 3);
  ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonPos, 3).setUsage(THREE.DynamicDrawUsage));
  { const idx: number[] = []; for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } ribbonGeo.setIndex(idx); }
  const ribbon = mesh(ribbonGeo, ok, 'xr: aim ribbon');
  const landRing = mesh(ringGeo, ok, 'xr: aim ring'), landPad = mesh(padGeo, okPad, 'xr: aim pad');
  let aim: Aim | null = null;
  const view: AimView = { show(a) { aim = a; } };
  const A = new THREE.Vector3(), B = new THREE.Vector3(), S = new THREE.Vector3(), H = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, -1), Q = new THREE.Quaternion();
  function drawAim(head: V3) {
    if (!aim || aim.points.length < 2) { ribbon.visible = landRing.visible = landPad.visible = false; return; }
    const pts = aim.points, n = Math.min(pts.length, SEG + 1), good = aim.ok;
    ribbon.material = good ? ok : bad;
    H.set(head[0], head[1], head[2]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], pn = pts[Math.min(i + 1, n - 1)], pp = pts[Math.max(i - 1, 0)];
      A.set(pn[0] - pp[0], pn[1] - pp[1], pn[2] - pp[2]); B.set(p[0] - H.x, p[1] - H.y, p[2] - H.z);
      S.crossVectors(A, B); if (S.lengthSq() < 1e-12) S.set(0, 1, 0); S.normalize().multiplyScalar(i === 0 ? 0.004 : 0.008);   // 1.6 cm across, narrower at the hand
      ribbonPos.set([p[0] - S.x, p[1] - S.y, p[2] - S.z, p[0] + S.x, p[1] + S.y, p[2] + S.z], i * 6);
    }
    for (let i = n; i <= SEG; i++) ribbonPos.copyWithin(i * 6, (n - 1) * 6, n * 6);   // the unused tail collapses onto the last point
    ribbonGeo.attributes.position.needsUpdate = true;
    ribbonGeo.setDrawRange(0, SEG * 6);
    ribbon.visible = true;
    const h = aim.hit;
    landRing.visible = landPad.visible = !!h;
    if (h) { landRing.position.set(h[0], h[1] + 0.025, h[2]); landPad.position.set(h[0], h[1] + 0.02, h[2]); landRing.material = good ? ok : bad; landPad.material = good ? okPad : badPad; }
  }

  // ---- one visual set per input source
  interface Vis { ray: any; dot: any; grip: any; joints: any; reticle: any; fill: any }
  const vis = new Map<number, Vis>();
  const dummy = new THREE.Object3D(), v3 = new THREE.Vector3();
  function visOf(id: number): Vis {
    let v = vis.get(id); if (v) return v;
    v = {
      ray: mesh(unitBox, white, `xr: ray ${id}`), dot: mesh(dotGeo, hot, `xr: dot ${id}`), grip: mesh(gripGeo, grey, `xr: grip ${id}`),
      joints: null, reticle: mesh(reticleGeo, white, `xr: reticle ${id}`), fill: mesh(fillGeo, hot, `xr: dwell ${id}`),
    };
    vis.set(id, v); return v;
  }
  function dropVis(id: number) {
    const v = vis.get(id); if (!v) return;
    for (const m of [v.ray, v.dot, v.grip, v.joints, v.reticle, v.fill]) if (m) { root.remove(m); if (m.isInstancedMesh) m.dispose(); }
    vis.delete(id);
  }

  function tick(f: XrFrame) {
    rig.group.updateMatrixWorld(true);
    const live = new Set<number>();
    for (const info of input.sources()) {
      live.add(info.id);
      const v = visOf(info.id), ray = input.rayPose(info.id), p = input.pointing(info.id);
      const aiming = !!aim && aim.source === info.id;
      const pressed = !!input.button(info.id, 'trigger')?.pressed;
      // ---- the ray: only while it is on something worth pressing (a panel, a ring); the floor's own line is the aim
      const ui = !!p && p.target.priority >= 50;
      if (ray && ui && !aiming) {
        const len = Math.min(8, Math.max(0.1, p!.hit.dist));
        v.ray.visible = true; v.ray.material = pressed ? hot : white;
        v.ray.scale.set(0.004, 0.004, len);
        A.set(ray.dir[0], ray.dir[1], ray.dir[2]);
        v.ray.position.set(ray.origin[0] + A.x * len / 2, ray.origin[1] + A.y * len / 2, ray.origin[2] + A.z * len / 2);
        v.ray.quaternion.copy(Q.setFromUnitVectors(Z, A));
        v.dot.visible = true; v.dot.material = pressed ? hot : white; v.dot.position.set(p!.hit.point[0], p!.hit.point[1], p!.hit.point[2]);
      } else v.ray.visible = v.dot.visible = false;
      // ---- the grip proxy: a controller in the hand (a hand needs none, a transient pointer has no body)
      const grip = input.gripPose(info.id);
      const isCtrl = info.targetRayMode === 'tracked-pointer' && !info.isHand;
      if (isCtrl && grip) {
        v.grip.visible = true; v.grip.position.set(grip.pos[0], grip.pos[1], grip.pos[2]); v.grip.quaternion.set(grip.quat[0], grip.quat[1], grip.quat[2], grip.quat[3]);
        v.grip.material = pressed ? hot : grey;
      } else v.grip.visible = false;
      // ---- the hand: one dot per joint. visionOS draws the person's hands itself.
      const ownHands = info.isHand && info.targetRayMode !== 'transient-pointer' && !input.sawTransient();
      if (ownHands) {
        input.wantJoints(info.id, true);
        const j = input.joints(info.id);
        if (j) {
          if (!v.joints) { v.joints = new THREE.InstancedMesh(jointGeo, skin, 25); v.joints.name = `xr: hand ${info.id}`; v.joints.frustumCulled = false; v.joints.raycast = () => {}; v.joints.renderOrder = 9000; root.add(v.joints); }
          for (let k = 0; k < 25; k++) {
            v3.set(j[k * 16 + 12], j[k * 16 + 13], j[k * 16 + 14]).applyMatrix4(rig.group.matrixWorld);
            dummy.position.copy(v3); dummy.scale.setScalar(k === 4 || k === 9 || k === 14 || k === 19 || k === 24 ? 0.0085 : 0.0065); dummy.updateMatrix();
            v.joints.setMatrixAt(k, dummy.matrix);
          }
          v.joints.instanceMatrix.needsUpdate = true; v.joints.visible = true;
        } else if (v.joints) v.joints.visible = false;
      } else if (v.joints) v.joints.visible = false;
      // ---- gaze: a reticle where the head points, filling as it dwells on something that can be pressed
      if (info.targetRayMode === 'gaze' && ray) {
        const dist = p ? Math.min(6, p.hit.dist) : 2.5;
        v.reticle.visible = true; v.reticle.position.set(ray.origin[0] + ray.dir[0] * dist, ray.origin[1] + ray.dir[1] * dist, ray.origin[2] + ray.dir[2] * dist);
        v.reticle.lookAt(f.head.pos[0], f.head.pos[1], f.head.pos[2]); v.reticle.scale.setScalar(Math.max(0.6, dist * 0.5));
        const dw = input.dwell(info.id);
        v.fill.visible = !!dw;
        if (dw) { v.fill.position.copy(v.reticle.position); v.fill.quaternion.copy(v.reticle.quaternion); v.fill.scale.setScalar(Math.max(0.1, dw.progress) * Math.max(0.6, dist * 0.5)); }
      } else v.reticle.visible = v.fill.visible = false;
    }
    for (const id of [...vis.keys()]) if (!live.has(id)) dropVis(id);
    drawAim(f.head.pos);
  }

  return {
    view, tick,
    drawCount() { let n = 0; root.traverse((o: any) => { if (o.isMesh && o.visible) n++; }); return n; },
    stop() {
      for (const id of [...vis.keys()]) dropVis(id);
      aim = null; root.removeFromParent();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
