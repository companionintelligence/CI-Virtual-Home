// assets/xr/stairs.ts : the stairs, for a person who moves by blinking. A person cannot walk a flight (no smooth motion, and a teleport never
// changes the plane they stand on), so each end of each flight has a floating ring on the floor and a label above it: "Go up" at the foot,
// "Go down" at the top. Pointing at one and pressing it blinks the person to the other end, on the other storey, facing the way they would
// have walked. Spiral, U and L flights are the same: the ends come from anchors.stairs (bottom and top; shot-world.ts WStair), the walk
// between them is a blink, so a flight's shape does not matter.
//
// A ring is a RayTarget at priority 50 (above the floor, below any panel). It exists only for the storey the person is on, nearest four within
// 9 m, so the draw calls stay at three per ring at most and a house with six flights shows the ones that matter. The label is a Canvas2D
// texture painted once ("Go up" with an arrow), a quad that turns to face the head about the vertical axis.
import type { RayHit, RayTarget, V3, XrFrame, XrInput, XrRig } from './host.js';
import type { StairLink, XrNav } from './nav.js';

export interface StairsDeps { THREE: any; scene: any; nav: XrNav; input: XrInput; rig: XrRig; busy(): boolean; onGo?(link: StairLink, dir: 'up' | 'down'): void }
export interface Stairs {
  tick(f: XrFrame): void;
  /** go along a flight from one end (what pressing its ring does) */
  go(index: number, dir: 'up' | 'down'): Promise<boolean>;
  /** the rings drawn right now (for the budget test) */
  shown(): Array<{ index: number; dir: 'up' | 'down'; at: V3 }>;
  stop(): void;
}

const RADIUS = 0.5, LABEL_W = 0.56, LABEL_H = 0.2, LABEL_Y = 1.3, SHOW_R = 7, MAX_SHOWN = 4;
// the label grows with distance (its text must stay over 1.1 degrees of visual angle at 7 m) and shrinks up close (a label 0.9 m away must not fill the view)
const labelScale = (d: number) => Math.min(2, Math.max(0.65, d / 1.5));

export function createStairs(d: StairsDeps): Stairs {
  const { THREE, nav, rig } = d;
  const root = new THREE.Group(); root.name = 'xr: stairs'; root.userData.xrOverlay = true; d.scene.add(root);
  const geos: any[] = [], mats: any[] = [], texs: any[] = [];
  const ringGeo = new THREE.RingGeometry(0.26, 0.34, 40).rotateX(-Math.PI / 2), padGeo = new THREE.CircleGeometry(0.26, 40).rotateX(-Math.PI / 2);
  const labelGeo = new THREE.PlaneGeometry(LABEL_W, LABEL_H);
  geos.push(ringGeo, padGeo, labelGeo);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false, side: THREE.DoubleSide }), padMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const hotMat = new THREE.MeshBasicMaterial({ color: 0xff7a45, toneMapped: false, fog: false, side: THREE.DoubleSide });
  mats.push(ringMat, padMat, hotMat);

  function paint(text: string, arrow: '↑' | '↓'): any {
    const cv = document.createElement('canvas'); cv.width = 448; cv.height = 160;
    const g = cv.getContext('2d')!;
    g.fillStyle = 'rgba(2,16,24,0.88)'; g.beginPath(); g.roundRect(4, 4, 440, 152, 40); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#ffffff'; g.font = '700 74px "VH Manrope", "Manrope", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${arrow} ${text}`, 224, 84);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.anisotropy = 4;
    texs.push(tex);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, fog: false });
    mats.push(m); return m;
  }
  const upMat = paint('Go up', '↑'), downMat = paint('Go down', '↓');

  interface Ring {
    link: StairLink; dir: 'up' | 'down'; at: V3; level: string; to: { stand: V3; yawDeg: number };
    grp: any; ring: any; pad: any; label: any; target: RayTarget; hover: boolean; k: number;
  }
  const rings: Ring[] = [];
  const offs: Array<() => void> = [];

  function plane(r: Ring, ray: { origin: V3; dir: V3 }): RayHit | null {
    // the floor disc (a flat circle 0.5 m across), and the label (a quad that faces the head, so a plane through it at its yaw)
    let best: RayHit | null = null;
    const { origin: o, dir: dr } = ray;
    if (dr[1] < -1e-3) {
      const t = (r.at[1] - o[1]) / dr[1];
      if (t > 0 && t < 30 && Math.hypot(o[0] + dr[0] * t - r.at[0], o[2] + dr[2] * t - r.at[2]) <= RADIUS) best = { dist: t, point: [o[0] + dr[0] * t, r.at[1], o[2] + dr[2] * t] };
    }
    const n = r.label; n.updateMatrixWorld(true);
    const e = n.matrixWorld.elements, nx = e[8], nz = e[10], cx = e[12], cy = e[13], cz = e[14];   // the quad's normal (+z column) and centre
    const den = dr[0] * nx + dr[2] * nz;
    if (Math.abs(den) > 1e-4) {
      const t = ((cx - o[0]) * nx + (cz - o[2]) * nz) / den;
      if (t > 0 && t < 30 && (!best || t < best.dist)) {
        const px = o[0] + dr[0] * t, py = o[1] + dr[1] * t, pz = o[2] + dr[2] * t;
        const rx = nz, rz = -nx;                                                          // the quad's right (+x column), horizontal
        const u = (px - cx) * rx + (pz - cz) * rz, w = py - cy;
        if (Math.abs(u) <= (LABEL_W / 2) * r.k + 0.05 && Math.abs(w) <= (LABEL_H / 2) * r.k + 0.05) best = { dist: t, point: [px, py, pz] };
      }
    }
    return best;
  }

  for (const link of nav.stairs()) {
    for (const dir of ['up', 'down'] as const) {
      const here = dir === 'up' ? link.foot : link.top, there = dir === 'up' ? link.top : link.foot;
      if (!here.stand || !there.stand) continue;    // a flight with no valid stand at one end is not offered at either (the person could arrive and not leave)
      const grp = new THREE.Group(); grp.visible = false; grp.name = `xr: stairs ${link.index} ${dir}`;
      const ring = new THREE.Mesh(ringGeo, ringMat), pad = new THREE.Mesh(padGeo, padMat), label = new THREE.Mesh(labelGeo, dir === 'up' ? upMat : downMat);
      for (const m of [ring, pad, label]) { m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 9001; }
      ring.position.y = 0.03; pad.position.y = 0.025; label.position.y = LABEL_Y;
      grp.position.set(here.ring[0], here.ring[1], here.ring[2]);
      grp.add(ring, pad, label); root.add(grp);
      const r: Ring = { link, dir, at: here.ring, level: here.level, to: { stand: there.stand, yawDeg: there.yawDeg }, grp, ring, pad, label, hover: false, k: 1, target: null as any };
      r.target = {
        id: `xr-stairs-${link.index}-${dir}`, priority: 50, enabled: false,
        hit: ray => plane(r, ray),
        onHover: (_id, hit) => { r.hover = !!hit; },
        onRelease: (_id, hit, cancelled) => { if (hit && !cancelled) void go(link.index, dir); },
      };
      offs.push(d.input.addTarget(r.target));
      rings.push(r);
    }
  }

  async function go(index: number, dir: 'up' | 'down'): Promise<boolean> {
    const r = rings.find(x => x.link.index === index && x.dir === dir);
    if (!r || d.busy()) return false;
    d.onGo?.(r.link, dir);
    // the feet go to the stand at the other end, on the other storey's floor; the head ends above them at the person's own height
    await rig.moveTo({ feet: r.to.stand, yawDeg: r.to.yawDeg }, { faceStandYaw: true });
    return true;
  }

  let shown: Ring[] = [];
  function tick(f: XrFrame) {
    const head = f.head.pos, here = nav.levelFor(rig.floorY());
    const cands = rings.filter(r => here && r.level === here.id).map(r => [Math.hypot(r.at[0] - head[0], r.at[2] - head[2]), r] as const).filter(([dd]) => dd <= SHOW_R).sort((a, b) => a[0] - b[0]).slice(0, MAX_SHOWN);
    const keep = new Set(cands.map(c => c[1]));
    for (const r of rings) { const on = keep.has(r) && !d.busy(); r.grp.visible = on; r.target.enabled = on; if (!on) r.hover = false; }
    shown = cands.map(c => c[1]);
    for (const r of shown) {
      // the label turns to the head about the vertical axis only (a tilted label reads badly in a headset)
      r.label.rotation.y = Math.atan2(head[0] - r.at[0], head[2] - r.at[2]);
      r.k = labelScale(Math.hypot(head[0] - r.at[0], head[2] - r.at[2])); r.label.scale.setScalar(r.k);
      r.ring.material = r.hover ? hotMat : ringMat;
      const s = r.hover ? 1.12 : 1 + 0.04 * Math.sin(f.time / 400);   // a slow breathing so a ring reads as live
      r.ring.scale.set(s, 1, s);
    }
  }
  return {
    tick, go,
    shown: () => shown.filter(r => r.grp.visible).map(r => ({ index: r.link.index, dir: r.dir, at: r.at })),
    stop() {
      for (const off of offs.splice(0)) off();
      root.removeFromParent();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
      rings.length = 0; shown = [];
    },
  };
}
