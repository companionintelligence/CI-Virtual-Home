// assets/xr/hud.ts : the session's own few in-world pieces, drawn with Canvas2D onto planes (a headset has no DOM).
//
//   the veil    what the person sees while the headset view is being prepared (the merged house is built, its shaders link):
//               a card on black, in a scene of its own, so the 2D house is never drawn in stereo before it is cheap. Also where
//               "this home is too detailed for this headset" is said, because that needs a place to stand that is not the house.
//   the chip    "Headset view" and an Exit VR button, a small card low in front of the person, put in front of them again after
//               every move. The look in a headset is a merged, vertex-coloured, three-or-four-light render of the house (N9): the
//               chip says so, so nobody compares it with a desktop frame. Exit is also a sure way out that needs no other module
//               (the system's own exit always works too).
//   notices     a line above the chip (the comfort notice from the controller).
//
// The panels here are the session's safety net, not the UI kit: assets/xr/ui/ owns the menu, the captions and the cards, and
// registers its panels with the input module. These listen to the session's own `select` event instead, so they work with the
// stub of that module and with the real one alike.
import type { V3 } from './host.js';

type Head = { pos: V3; dir: V3; yawDeg: number };

export interface XrHud {
  /** the veil's scene: render it (with the session camera) instead of the house until the world is ready */
  veilScene: any;
  setStatus(title: string, body?: string): void;
  /** per veil frame: puts the card in front of the person on the first frame, and animates its dots */
  veilFrame(head: Head, nowMs: number): void;
  /** the chip: put it in front of this head, and fade it back after a while */
  placeChip(head: Head, nowMs: number): void;
  tick(nowMs: number): void;
  notice(text: string, ms?: number): void;
  /** an XR `select` event: true when it pressed the chip's Exit button */
  onSelect(e: any): boolean;
  setChipVisible(v: boolean): void;
  dispose(): void;
}

const cssVar = (name: string, fallback: string): string => {
  try { return (getComputedStyle(document.querySelector('.vh') || document.documentElement).getPropertyValue(name) || '').trim() || fallback; } catch { return fallback; }
};
const FONT = '"VH Manrope", "Manrope", system-ui, sans-serif';

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []; let line = '';
  for (const w of text.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out;
}

export function createHud(o: { THREE: any; renderer: any; scene: any; camera: any; group: any; onExit(): void }): XrHud {
  const { THREE, renderer, scene, group } = o;
  const ink = '#021018', white = '#ffffff', soft = '#c9d6dc';
  const primary = cssVar('--primary', '#ff3f00'), onPrimary = cssVar('--primary-foreground', '#ffffff');

  function panel(px: number, py: number, wM: number, hM: number, order: number) {
    const cv = document.createElement('canvas'); cv.width = px; cv.height = py;
    const g = cv.getContext('2d')!;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy?.() ?? 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, depthTest: false, fog: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), mat);
    mesh.renderOrder = order; mesh.frustumCulled = false; mesh.userData.xrOverlay = true; mesh.rotation.order = 'YXZ';
    return { cv, g, tex, mat, mesh, dispose() { mesh.geometry.dispose(); mat.dispose(); tex.dispose(); mesh.removeFromParent(); } };
  }
  // put `mesh` at `at`, turned toward `head` (yaw about y; tilt about x so a card low in front leans up to the eyes)
  function face(mesh: any, at: V3, head: V3) {
    mesh.position.set(at[0], at[1], at[2]);
    const dx = head[0] - at[0], dz = head[2] - at[2], dy = head[1] - at[1];
    mesh.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0);
  }

  // ---- the veil
  const veilScene = new THREE.Scene(); veilScene.background = new THREE.Color(0x03070b);
  const veil = panel(1200, 500, 1.2, 0.5, 1);
  veilScene.add(veil.mesh);
  let title = 'Preparing your home', body = '', veilPlaced = false, lastDots = -1;
  function paintVeil(dots: number) {
    const g = veil.g; g.clearRect(0, 0, 1200, 500);
    g.fillStyle = ink; roundRect(g, 0, 0, 1200, 500, 56); g.fill();
    g.textBaseline = 'alphabetic'; g.fillStyle = white; g.font = `700 64px ${FONT}`;
    g.fillText(title, 64, 150);
    g.font = `500 42px ${FONT}`; g.fillStyle = soft;
    const lines = wrap(g, body, 1070).slice(0, 4);
    lines.forEach((l, i) => g.fillText(l, 64, 238 + i * 58));
    if (!body) { g.fillStyle = primary; for (let i = 0; i < 3; i++) { g.globalAlpha = i === dots % 3 ? 1 : 0.3; g.beginPath(); g.arc(80 + i * 46, 260, 14, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; }
    veil.tex.needsUpdate = true;
  }
  paintVeil(0);
  try { void document.fonts.load(`700 64px ${FONT}`).then(() => document.fonts.load(`500 42px ${FONT}`)).then(() => { paintVeil(0); chipDirty = true; }); } catch { /* the system font stands in */ }

  // ---- the chip
  const CW = 768, CH = 272, chip = panel(CW, CH, 0.42, 0.149, 1000);
  chip.mesh.name = 'xr: headset chip'; chip.mesh.visible = false; scene.add(chip.mesh);
  const EXIT = { x: 452, y: 60, w: 276, h: 152 };       // the button, in canvas px
  let chipDirty = true, chipPlacedAt = -1e9, chipOn = true;
  function paintChip() {
    const g = chip.g; g.clearRect(0, 0, CW, CH);
    g.fillStyle = 'rgba(2,16,24,0.92)'; roundRect(g, 0, 0, CW, CH, 54); g.fill();
    g.fillStyle = white; g.font = `700 50px ${FONT}`; g.textBaseline = 'alphabetic';
    g.fillText('Headset view', 40, 128);
    g.fillStyle = soft; g.font = `500 32px ${FONT}`; g.fillText('A lighter look, made for VR', 40, 184);
    g.fillStyle = primary; roundRect(g, EXIT.x, EXIT.y, EXIT.w, EXIT.h, 40); g.fill();
    g.fillStyle = onPrimary; g.font = `700 52px ${FONT}`; g.textAlign = 'center'; g.fillText('Exit VR', EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 + 18); g.textAlign = 'left';
    chip.tex.needsUpdate = true; chipDirty = false;
  }

  // ---- a notice line above the chip
  const note = panel(1024, 192, 0.8, 0.15, 1001);
  note.mesh.name = 'xr: notice'; note.mesh.visible = false; scene.add(note.mesh);
  let noteUntil = 0, noteAt = 0;

  const head3 = new THREE.Vector3(), tmp = new THREE.Vector3(), ray = new THREE.Raycaster(), q = new THREE.Quaternion();
  const hud: XrHud = {
    veilScene,
    setStatus(t, b = '') { title = t; body = b; veilPlaced = false; paintVeil(0); },
    veilFrame(head, nowMs) {
      if (!veilPlaced) {   // once: a card in the world, where the person looks when the session starts
        const d = Math.hypot(head.dir[0], head.dir[2]) || 1;
        face(veil.mesh, [head.pos[0] + (head.dir[0] / d) * 1.9, head.pos[1] - 0.05, head.pos[2] + (head.dir[2] / d) * 1.9], head.pos);
        veilPlaced = true;
      }
      const dots = Math.floor(nowMs / 400) % 3;
      if (dots !== lastDots && !body) { lastDots = dots; paintVeil(dots); }
    },
    placeChip(head, nowMs) {
      const d = Math.hypot(head.dir[0], head.dir[2]) || 1;
      face(chip.mesh, [head.pos[0] + (head.dir[0] / d) * 1.0, head.pos[1] - 0.46, head.pos[2] + (head.dir[2] / d) * 1.0], head.pos);
      chipPlacedAt = nowMs; chip.mesh.visible = chipOn; chip.mat.opacity = 1;
      if (chipDirty) paintChip();
      face(note.mesh, [head.pos[0] + (head.dir[0] / d) * 1.0, head.pos[1] - 0.27, head.pos[2] + (head.dir[2] / d) * 1.0], head.pos);
    },
    tick(nowMs) {
      if (chipDirty && chip.mesh.visible) paintChip();
      if (chip.mesh.visible) chip.mat.opacity = nowMs - chipPlacedAt < 6000 ? 1 : 0.55;   // it steps back once it has been seen
      if (note.mesh.visible && nowMs > noteUntil) note.mesh.visible = false;
    },
    notice(text, ms = 5000) {
      const g = note.g; g.clearRect(0, 0, 1024, 192);
      g.font = `600 44px ${FONT}`; const lines = wrap(g, text, 940).slice(0, 2);
      g.fillStyle = 'rgba(2,16,24,0.92)'; roundRect(g, 0, 0, 1024, 40 + lines.length * 62 + 28, 44); g.fill();
      g.fillStyle = white; g.font = `600 44px ${FONT}`; g.textBaseline = 'alphabetic'; lines.forEach((l, i) => g.fillText(l, 42, 76 + i * 62));
      note.tex.needsUpdate = true; note.mesh.visible = true; noteAt = performance.now(); noteUntil = Infinity;
      // (the frame time is what tick() sees; arm the timer on the next tick, so a notice outlives a slow frame)
      const arm = noteAt; setTimeout(() => { if (noteAt === arm) noteUntil = 0; }, ms);
    },
    onSelect(e) {
      if (!chip.mesh.visible) return false;
      try {
        const rs = renderer.xr.getReferenceSpace(), p = e.frame?.getPose?.(e.inputSource.targetRaySpace, rs);
        if (!p) return false;
        const t = p.transform;
        group.updateMatrixWorld(true);
        head3.set(t.position.x, t.position.y, t.position.z); group.localToWorld(head3);
        q.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
        tmp.set(0, 0, -1).applyQuaternion(q); tmp.transformDirection(group.matrixWorld);
        chip.mesh.updateMatrixWorld(true);
        ray.set(head3, tmp);
        const hit = ray.intersectObject(chip.mesh, false)[0];
        if (!hit || !hit.uv) return false;
        const x = hit.uv.x * CW, y = (1 - hit.uv.y) * CH;
        if (x >= EXIT.x && x <= EXIT.x + EXIT.w && y >= EXIT.y && y <= EXIT.y + EXIT.h) { o.onExit(); return true; }
      } catch { /* a select with no pose (tracking lost) is not a press */ }
      return false;
    },
    setChipVisible(v) { chipOn = v; if (!v) { chip.mesh.visible = false; note.mesh.visible = false; } },
    dispose() { veil.dispose(); chip.dispose(); note.dispose(); veilScene.clear(); },
  };
  return hud;
}
