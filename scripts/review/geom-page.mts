// The browser half of the two geometry detectors (zfight.mts, collide.mts), and the session both open a house with.
//
// `installGeo` is a self-contained function: Node serialises its source into the page (page.evaluate cannot see this module's other
// bindings) and it hangs everything on window.__geo. Nothing in it touches the product: it reads the scene through the page's own
// hooks (__houseDebug, __houseSnapshot, __THREE) and puts back exactly what it changed (materials swapped for an ID pass, camera
// near/far, the renderer's clear state, the render target), so a frame drawn after it is the frame drawn before it.
//
// What it gives the detectors:
//   registry()         every mesh of the scene in traversal order, with a 1-based id and a description (class, item, room, material, ...)
//   captureSpot(cfg)   one camera spot rendered through the composer path the goldens use (beauty) at two depth-precision settings, and an ID
//                      pass (a flat colour per mesh, same depth state, no antialiasing) at each setting, diffed per pixel
//   extract(opts)      the visible meshes as world-space boxes / triangle soups, grouped under the page's placed objects (for collide.mts)
//   rayGap(...)        where two named meshes meet along a pixel's ray, for the report
//
// Determinism: ids follow scene.traverse order, the render path is the golden one (composer warmed by the session), the camera is the
// caller's, the clock is not read.
import path from 'node:path';
import { ROOT, serve, loadPlaywright, stubGoogleFonts } from '../portal-lib.mts';

export function installGeo() {
  const W: any = window;
  const T: any = W.__THREE;
  const geo: any = {};
  const dbg = () => W.__houseDebug();
  const scene = () => dbg().scene;
  const renderer = () => dbg().renderer;

  // ------------------------------------------------------------------------------------------------------------------------------
  // registry: a stable id for every mesh, and what it is
  // ------------------------------------------------------------------------------------------------------------------------------
  geo.ids = new Map();
  geo.meshes = [];
  geo.buildRegistry = () => {
    geo.ids.clear(); geo.meshes.length = 0;
    for (const v of idMats.values()) (Array.isArray(v) ? v : [v]).forEach((m: any) => m.dispose());
    idMats.clear();
    scene().traverse((o: any) => { if (o.isMesh) { geo.meshes.push(o); geo.ids.set(o, geo.meshes.length); } });
    return geo.meshes.length;
  };
  const topOf = (o: any) => { let p = o; while (p.parent && p.parent !== scene()) p = p.parent; return p; };
  const shown = (o: any) => { for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p === scene()) return true; } return false; };   // visible all the way up to the scene (an object taken out of it is not shown)
  const levelOfY = (y: number) => {
    const lv = dbg().house.spec.levels || []; let best = 0;
    lv.forEach((l: any, i: number) => { if (y >= (l.y || 0) - 0.05) best = i; });
    return best;
  };
  // the storey an object stands on: its origin's, except for an object AT the world origin. A group there holds world-space geometry (the hero's
  // power cord and display lead: AssetFactory.createCable builds the tube in world coordinates, put() at 0,0,0), so its origin says nothing of the
  // storey and read as level 0 on every home whose hero is upstairs (13 false `ceiling` findings, up to 389 cm); the centre of its box does.
  const _lbb = new T.Box3(), _lc = new T.Vector3();
  const levelOfObj = (o: any, wp: any) => {
    if (Math.abs(wp.x) + Math.abs(wp.y) + Math.abs(wp.z) < 1e-6) { _lbb.setFromObject(o); if (!_lbb.isEmpty()) return levelOfY(_lbb.getCenter(_lc).y); }
    return levelOfY(wp.y);
  };
  const matOf = (m: any) => m ? ({
    n: m.name || '', t: String(m.type).replace('Material', ''), c: m.color ? m.color.getHexString() : null,
    tr: !!m.transparent, op: +(+m.opacity).toFixed(3), side: m.side, dw: m.depthWrite, dt: m.depthTest,
    po: m.polygonOffset ? [m.polygonOffsetFactor, m.polygonOffsetUnits] : null, at: m.alphaTest || 0, tm: m.transmission || 0, vis: m.visible !== false,
  }) : null;
  const unitName = (mesh: any, top: any) => {
    for (let p = mesh.parent; p && p !== top.parent; p = p.parent) {
      const n = p.name || '';
      if (/^Window/.test(n)) return 'window';
      if (/^Door/.test(n)) return 'door';
      if (p.userData && p.userData.door) return 'leaf';
    }
    return null;
  };
  const wallPartOf = (mesh: any, top: any) => {
    const u = top.userData || {};
    for (let p = mesh.parent; p && p !== top.parent; p = p.parent) {
      if (p === u.cutawayGroup) return 'cutaway';
      if (p === u.baseboardGroup) return 'baseboard';
      if (p === u.fullGroup) return 'full';
    }
    return null;
  };
  geo.describe = (mesh: any) => {
    const top = topOf(mesh), u = top.userData || {};
    const chain: string[] = [];
    for (let p = mesh.parent; p && p !== scene(); p = p.parent) chain.unshift(p.name || p.type);
    const g = mesh.geometry;
    if (g && !g.boundingBox) g.computeBoundingBox();
    const bb = g && g.boundingBox, sz = bb ? [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].map((v: number) => +v.toFixed(4)) : null;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(matOf);
    const wp = new T.Vector3(); mesh.getWorldPosition(wp);
    const idx = g && g.index ? g.index.count : g && g.attributes && g.attributes.position ? g.attributes.position.count : 0;
    return {
      id: geo.ids.get(mesh) || 0, name: mesh.name || '', top: top.name || top.type, role: u.role || (u.isWall ? 'wall' : u.isRoof ? 'roof' : u.isCeiling ? 'ceiling' : u.category === 'Site' ? 'site' : null),
      cat: u.category || null, itemType: u.itemType || null, room: u.room || null, level: levelOfObj(mesh, wp),
      chain: chain.join(' > '), geom: g ? g.type : null, size: sz, tris: Math.round(idx / 3), instanced: !!mesh.isInstancedMesh,
      mats: mats.slice(0, 4), unit: unitName(mesh, top), wallPart: wallPartOf(mesh, top), glass: !!(mesh.userData && mesh.userData.windowGlow),
      ro: mesh.renderOrder || 0, shadow: !!mesh.castShadow, at: [+wp.x.toFixed(3), +wp.y.toFixed(3), +wp.z.toFixed(3)],
    };
  };
  geo.registry = () => geo.meshes.map((m: any) => geo.describe(m));

  // ------------------------------------------------------------------------------------------------------------------------------
  // the hook: do something at the instant __houseSnapshot has drawn its frame and is about to read it (the dressing is on, the
  // composer has just rendered, the canvas holds the beauty frame)
  // ------------------------------------------------------------------------------------------------------------------------------
  geo.withSnapshot = (opts: any, fn: () => any) => {
    const orig = HTMLCanvasElement.prototype.toDataURL;
    let result: any, err: any = null, ran = false;
    const cv = renderer().domElement;
    HTMLCanvasElement.prototype.toDataURL = function (...a: any[]) {
      if (!ran && this === cv) { ran = true; try { result = fn(); } catch (e) { err = e; } }
      return orig.apply(this, a as any);
    };
    try { W.__houseSnapshot({ res: opts.res || '720', dressing: opts.dressing || { walls: 'up', roof: 'on' }, quality: 0.05 }); }
    finally { HTMLCanvasElement.prototype.toDataURL = orig; }
    if (err) throw err;
    return result;
  };
  let scratch: any = null;
  const readCanvas = (cv: any) => {
    if (!scratch) scratch = document.createElement('canvas');
    scratch.width = cv.width; scratch.height = cv.height;
    const ctx = scratch.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(cv, 0, 0);
    return ctx.getImageData(0, 0, cv.width, cv.height).data;
  };
  const perspCam = () => {
    let cam = dbg().camera;
    if (!cam.isPerspectiveCamera) { W.__houseSnapshot({ res: '360' }); cam = dbg().camera; }
    return cam;
  };
  geo.setCam = (c: any) => {
    const cam = perspCam();
    cam.position.set(c.pos[0], c.pos[1], c.pos[2]); cam.up.set(0, 1, 0);
    cam.lookAt(c.target[0], c.target[1], c.target[2]);
    cam.fov = c.fov; cam.near = c.near; cam.far = c.far; cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    return cam;
  };

  // ------------------------------------------------------------------------------------------------------------------------------
  // the ID pass: every mesh drawn as one flat colour with its own depth state; no lights, no fog, no antialiasing, no tone mapping
  // ------------------------------------------------------------------------------------------------------------------------------
  const idMats = new Map();
  const idMatFor = (mesh: any) => {
    let cached = idMats.get(mesh);
    if (cached) return cached;
    const id = geo.ids.get(mesh);
    const mk = (src: any) => {
      const m = new T.MeshBasicMaterial({ color: 0x000000 });
      m.color.setRGB((id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255, T.LinearSRGBColorSpace);
      m.fog = false; m.toneMapped = false; m.blending = T.NoBlending; m.opacity = 1;
      if (src) {
        m.side = src.side; m.transparent = !!src.transparent; m.depthWrite = src.depthWrite; m.depthTest = src.depthTest; m.depthFunc = src.depthFunc;
        m.polygonOffset = src.polygonOffset; m.polygonOffsetFactor = src.polygonOffsetFactor; m.polygonOffsetUnits = src.polygonOffsetUnits;
        m.colorWrite = src.colorWrite; m.visible = src.visible !== false && !(src.transparent && src.opacity < 0.02);
        if (src.alphaTest > 0 && src.alphaMap) { m.alphaTest = src.alphaTest; m.alphaMap = src.alphaMap; }
      }
      return m;
    };
    cached = Array.isArray(mesh.material) ? mesh.material.map(mk) : mk(mesh.material);
    idMats.set(mesh, cached);
    return cached;
  };
  let rt: any = null;
  geo.idPass = (cam: any, w: number, h: number) => {
    const r = renderer(), sc = scene();
    if (!rt || rt.width !== w || rt.height !== h) {
      if (rt) rt.dispose();
      rt = new T.WebGLRenderTarget(w, h, { samples: 0, depthBuffer: true, stencilBuffer: false, type: T.UnsignedByteType, format: T.RGBAFormat, minFilter: T.NearestFilter, magFilter: T.NearestFilter, generateMipmaps: false });
    }
    const keep = {
      rt: r.getRenderTarget(), bg: sc.background, fog: sc.fog, ov: sc.overrideMaterial, ac: r.autoClear, acc: r.autoClearColor, acd: r.autoClearDepth, acs: r.autoClearStencil,
      su: r.shadowMap.autoUpdate, cc: r.getClearColor(new T.Color()).getHex(), ca: r.getClearAlpha(),
    };
    const swapped: any[] = [], hidden: any[] = [], tints: any[] = [];
    sc.traverse((o: any) => {
      // a per-instance colour multiplies the material's (instanced foliage): it would turn a mesh's id into another number
      if (o.isInstancedMesh && o.instanceColor) { tints.push([o, o.instanceColor]); o.instanceColor = null; }
      if ((o.isLine || o.isPoints || o.isSprite || /TransformControls/.test(o.type)) && o.visible) { hidden.push(o); o.visible = false; }   // the editor's helpers are never a surface
      if (o.isMesh) { swapped.push([o, o.material]); o.material = idMatFor(o); }
    });
    sc.background = null; sc.fog = null; sc.overrideMaterial = null;
    r.shadowMap.autoUpdate = false; r.autoClear = true; r.autoClearColor = true; r.autoClearDepth = true; r.autoClearStencil = true;
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(rt);
    const buf = new Uint8Array(w * h * 4);
    try {
      r.clear(true, true, true);
      r.render(sc, cam);
      r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    } finally {
      for (const [o, m] of swapped) o.material = m;
      for (const [o, c] of tints) o.instanceColor = c;
      for (const o of hidden) o.visible = true;
      sc.background = keep.bg; sc.fog = keep.fog; sc.overrideMaterial = keep.ov;
      r.setRenderTarget(keep.rt); r.autoClear = keep.ac; r.autoClearColor = keep.acc; r.autoClearDepth = keep.acd; r.autoClearStencil = keep.acs;
      r.shadowMap.autoUpdate = keep.su; r.setClearColor(keep.cc, keep.ca);
    }
    // top-down ids
    const ids = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) { const src = (h - 1 - y) * w * 4, dst = y * w; for (let x = 0; x < w; x++) { const s = src + x * 4; ids[dst + x] = buf[s] | (buf[s + 1] << 8) | (buf[s + 2] << 16); } }
    return ids;
  };

  // ------------------------------------------------------------------------------------------------------------------------------
  // one camera spot: beauty at two depth settings, ID pass at each, the per-pixel diff, the pairs
  // ------------------------------------------------------------------------------------------------------------------------------
  const quantum = (z: number, n: number, f: number) => ((f - n) * z * z) / (f * n * 16777216);
  geo.captureSpot = (cfg: any) => {
    // cfg: { cam:{pos,target,fov}, near, far, perturb:[{kn,kf},...] (first is the identity), dressing, res, thr, image, top, rays }
    if (!geo.meshes.length) geo.buildRegistry();
    const cam = geo.setCam({ ...cfg.cam, near: cfg.near, far: cfg.far });
    const beauty: any[] = [], ids: any[] = [];
    let w = 0, h = 0;
    const P = cfg.perturb;
    for (let b = 0; b < P.length; b++) {
      cam.near = cfg.near * P[b].kn; cam.far = cfg.far * P[b].kf; cam.updateProjectionMatrix();
      geo.withSnapshot({ res: cfg.res, dressing: cfg.dressing }, () => {
        const cv = renderer().domElement; w = cv.width; h = cv.height;
        beauty.push(new Uint8ClampedArray(readCanvas(cv)));
        if (b === 0) {
          for (const p of P) {
            cam.near = cfg.near * p.kn; cam.far = cfg.far * p.kf; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
            ids.push(geo.idPass(cam, w, h));
          }
          cam.near = cfg.near * P[0].kn; cam.far = cfg.far * P[0].kf; cam.updateProjectionMatrix();
        }
      });
    }
    // the diff
    const n = w * h, thr = cfg.thr ?? 10, B0 = beauty[0], K = ids.length, BK = beauty.length;
    const pairs = new Map<number, any>();
    let flagged = 0, bdiff = 0, bdiffUnexplained = 0;
    for (let i = 0; i < n; i++) {
      const a = ids[0][i]; let b = a;
      for (let k = 1; k < K; k++) { const v = ids[k][i]; if (v !== a) { b = v; break; } }
      const j = i * 4; let dB = 0;
      for (let k = 1; k < BK; k++) { const Bk = beauty[k]; const d = Math.max(Math.abs(B0[j] - Bk[j]), Math.abs(B0[j + 1] - Bk[j + 1]), Math.abs(B0[j + 2] - Bk[j + 2])); if (d > dB) dB = d; }
      if (dB > thr) bdiff++;
      if (b === a) { if (dB > thr) bdiffUnexplained++; continue; }
      flagged++;
      const lo = a < b ? a : b, hi = a < b ? b : a, key = lo * 16777216 + hi, x = i % w, y = (i / w) | 0;
      let e = pairs.get(key);
      if (!e) { e = { a: lo, b: hi, count: 0, vis: 0, visSum: 0, x0: x, y0: y, x1: x, y1: y, sx: 0, sy: 0, px: [] }; pairs.set(key, e); }
      e.count++; e.sx += x; e.sy += y;
      if (x < e.x0) e.x0 = x; if (x > e.x1) e.x1 = x; if (y < e.y0) e.y0 = y; if (y > e.y1) e.y1 = y;
      if (dB > thr) { e.vis++; e.visSum += dB; }
      e.px.push(i);
    }
    const list = [...pairs.values()].sort((p, q) => q.vis - p.vis || q.count - p.count || p.a - q.a || p.b - q.b);
    const top = list.slice(0, cfg.top ?? 24);
    // name the surfaces: where the two meet along a few of the pair's pixel rays
    const ray = new T.Raycaster();
    cam.near = cfg.near * P[0].kn; cam.far = cfg.far * P[0].kf; cam.aspect = w / h; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const ndc = new T.Vector2(), nm = new T.Matrix3(), nA = new T.Vector3(), nB = new T.Vector3();
    const out = top.map((e: any, rank: number) => {
      const samples: any[] = [];
      const take = rank < (cfg.rays ?? 10) ? 4 : 0;
      for (let s = 0; s < take; s++) {
        const i = e.px[Math.min(e.px.length - 1, Math.floor(((s + 0.5) / take) * e.px.length))], x = i % w, y = (i / w) | 0;
        ndc.set(((x + 0.5) / w) * 2 - 1, -(((y + 0.5) / h) * 2 - 1)); ray.setFromCamera(ndc, cam);
        const ma = geo.meshes[e.a - 1], mb = geo.meshes[e.b - 1];
        const ha = ma ? ray.intersectObject(ma, false)[0] : null, hb = mb ? ray.intersectObject(mb, false)[0] : null;
        const rec: any = { x, y };
        if (ha) { rec.tA = +ha.distance.toFixed(5); if (ha.face) { nm.getNormalMatrix(ma.matrixWorld); nA.copy(ha.face.normal).applyMatrix3(nm).normalize(); rec.nA = [+nA.x.toFixed(3), +nA.y.toFixed(3), +nA.z.toFixed(3)]; } rec.pA = [+ha.point.x.toFixed(4), +ha.point.y.toFixed(4), +ha.point.z.toFixed(4)]; }
        if (hb) { rec.tB = +hb.distance.toFixed(5); if (hb.face) { nm.getNormalMatrix(mb.matrixWorld); nB.copy(hb.face.normal).applyMatrix3(nm).normalize(); rec.nB = [+nB.x.toFixed(3), +nB.y.toFixed(3), +nB.z.toFixed(3)]; } rec.pB = [+hb.point.x.toFixed(4), +hb.point.y.toFixed(4), +hb.point.z.toFixed(4)]; }
        if (ha && hb) {
          const dir = ray.ray.direction; rec.gap = +Math.abs(ha.distance - hb.distance).toFixed(6);
          rec.perp = rec.nA ? +(rec.gap * Math.abs(dir.x * rec.nA[0] + dir.y * rec.nA[1] + dir.z * rec.nA[2])).toFixed(6) : rec.gap;
          rec.quantum = +quantum((ha.distance + hb.distance) / 2, cfg.near * P[0].kn, cfg.far * P[0].kf).toFixed(7);
          if (rec.nA && rec.nB) rec.ndot = +(rec.nA[0] * rec.nB[0] + rec.nA[1] * rec.nB[1] + rec.nA[2] * rec.nB[2]).toFixed(4);
        }
        samples.push(rec);
      }
      return { a: e.a, b: e.b, count: e.count, vis: e.vis, visSum: e.visSum, bbox: [e.x0, e.y0, e.x1, e.y1], centroid: [Math.round(e.sx / e.count), Math.round(e.sy / e.count)], samples };
    });
    const res: any = { w, h, flagged, bdiff, bdiffUnexplained, nPairs: list.length, pairs: out, rest: list.slice(top.length).reduce((s: number, e: any) => s + e.count, 0) };
    if (cfg.image) res.image = geo.contactImage({ w, h, B0, B1: beauty[1], beauty, list, top: out, label: cfg.label || '', thr });
    return res;
  };

  // the picture: the beauty frame with the flagged pixels in magenta (and the top pairs boxed), and under it a strip of three 4x crops of the worst pair
  geo.contactImage = (a: any) => {
    const { w, h, B0, B1, list, top, thr } = a;
    const strip = 260, cv = document.createElement('canvas'); cv.width = w; cv.height = h + strip;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h); img.data.set(B0);
    const mark = new Set<number>(); for (const e of list.slice(0, 40)) for (const i of e.px) mark.add(i);
    for (const i of mark) { const j = i * 4; img.data[j] = 255; img.data[j + 1] = 0; img.data[j + 2] = 255; img.data[j + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#10141c'; ctx.fillRect(0, h, w, strip);
    ctx.font = '14px monospace'; ctx.textBaseline = 'top';
    top.slice(0, 6).forEach((e: any, k: number) => {
      const [x0, y0, x1, y1] = e.bbox; ctx.strokeStyle = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ff9f0a', '#bf5af2'][k]; ctx.lineWidth = 2;
      ctx.strokeRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12);
      ctx.fillStyle = ctx.strokeStyle; ctx.fillText(String(k + 1), Math.max(2, x0 - 6), Math.max(2, y0 - 22));
    });
    ctx.fillStyle = '#fff'; ctx.fillText(a.label, 8, 6);
    if (top.length) {
      const e = top[0], cx = Math.round((e.bbox[0] + e.bbox[2]) / 2), cy = Math.round((e.bbox[1] + e.bbox[3]) / 2), cw = 107, ch = 60;
      const sx = Math.max(0, Math.min(w - cw, cx - (cw >> 1))), sy = Math.max(0, Math.min(h - ch, cy - (ch >> 1)));
      const crop = (src: any, amp: number, dx: number) => {
        const t = document.createElement('canvas'); t.width = cw; t.height = ch; const tc = t.getContext('2d'); const id = tc.createImageData(cw, ch);
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const s = ((sy + y) * w + sx + x) * 4, d = (y * cw + x) * 4; for (let c = 0; c < 3; c++) { let m = 0; if (amp) for (let k = 1; k < a.beauty.length; k++) m = Math.max(m, Math.abs(B0[s + c] - a.beauty[k][s + c])); id.data[d + c] = amp ? Math.min(255, m * amp) : src[s + c]; } id.data[d + 3] = 255; }
        tc.putImageData(id, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, cw, ch, dx, h + 10, 4 * cw, 4 * ch);
      };
      crop(B0, 0, 0); crop(B1, 0, 4 * cw + 10); crop(B0, 6, 8 * cw + 20);
      ctx.fillStyle = '#fff'; ctx.fillText('beauty, depth setting A', 2, h + 4 + 4 * ch + 14); ctx.fillText('beauty, depth setting B (far x0.94)', 4 * cw + 12, h + 4 + 4 * ch + 14); ctx.fillText('max |A - other| x6', 8 * cw + 22, h + 4 + 4 * ch + 14);
    }
    return cv.toDataURL('image/png');
  };

  // ------------------------------------------------------------------------------------------------------------------------------
  // extraction for collide.mts and zfight --geom: what is visible under a dressing, as world-space boxes and triangle soups
  // ------------------------------------------------------------------------------------------------------------------------------
  const b64 = (arr: any) => {
    const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000) as any);
    return btoa(s);
  };
  geo.extract = (opts: any) => geo.withSnapshot({ res: '360', dressing: opts.dressing || { walls: 'up', roof: 'on' } }, () => {
    if (!geo.meshes.length) geo.buildRegistry();
    const house = dbg().house, sc = scene();
    sc.updateMatrixWorld(true);
    const tops = new Map<any, number>(), ents: any[] = [], meshes: any[] = [];
    geo.tops = [];
    const skipRoles = new Set(opts.skipRoles || ['ground']);
    for (const mesh of geo.meshes) {
      if (!shown(mesh) || mesh.isInstancedMesh) continue;
      const top = topOf(mesh), u = top.userData || {};
      const role = u.role || (u.isWall ? 'wall' : u.isRoof ? 'roof' : u.isCeiling ? 'ceiling' : u.category === 'Site' ? 'site' : 'other');
      if (skipRoles.has(role)) continue;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (mats.every((m: any) => !m || m.visible === false || (m.transparent && m.opacity < 0.02))) continue;
      let ei = tops.get(top);
      if (ei === undefined) {
        ei = ents.length; tops.set(top, ei); geo.tops[ei] = top;
        const wp = new T.Vector3(); top.getWorldPosition(wp);
        ents.push({ i: ei, name: top.name || top.type, role, cat: u.category || null, itemType: u.itemType || null, room: u.room || null, level: levelOfObj(top, wp), onSurface: !!u.onSurface, mounted: !!u.mounted, foliage: !!u.foliage, dress: !!u.dress, stair: !!u.stair, isWall: !!u.isWall, at: [+wp.x.toFixed(4), +wp.y.toFixed(4), +wp.z.toFixed(4)], rotY: +top.rotation.y.toFixed(5) });
      }
      const g = mesh.geometry; if (!g || !g.attributes || !g.attributes.position) continue;
      if (!g.boundingBox) g.computeBoundingBox();
      mesh.updateMatrixWorld(true);
      const rec: any = { id: geo.ids.get(mesh), e: ei, unit: unitName(mesh, top), wp: wallPartOf(mesh, top), glass: !!(mesh.userData && mesh.userData.windowGlow), geom: g.type };
      rec.sides = mats.map((m: any) => m ? m.side : 0);
      rec.po = mats.some((m: any) => m && m.polygonOffset) ? 1 : 0;
      if (g.type === 'BoxGeometry' && !mesh.isInstancedMesh) {
        const bb = g.boundingBox;
        rec.box = { m: Array.from(mesh.matrixWorld.elements), c: [(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2], h: [(bb.max.x - bb.min.x) / 2, (bb.max.y - bb.min.y) / 2, (bb.max.z - bb.min.z) / 2] };
      } else {
        const pa = g.attributes.position, n = pa.count, out = new Float32Array(n * 3), v = new T.Vector3(), M = mesh.matrixWorld;
        for (let k = 0; k < n; k++) { v.fromBufferAttribute(pa, k).applyMatrix4(M); out[k * 3] = v.x; out[k * 3 + 1] = v.y; out[k * 3 + 2] = v.z; }
        rec.pos = b64(out);
        if (opts.tris || opts.idx) {
          const ix = g.index; let idx;
          if (ix) idx = ix.count > 65535 ? new Uint32Array(ix.array) : new Uint16Array(ix.array); else { idx = new Uint32Array(n); for (let k = 0; k < n; k++) idx[k] = k; }
          rec.idx = b64(idx); rec.idxBits = idx.BYTES_PER_ELEMENT * 8;
          if (g.groups && g.groups.length) rec.groups = g.groups.map((q: any) => [q.start, q.count, q.materialIndex || 0]);
        }
      }
      if (opts.tris && rec.box) {
        // a box's twelve triangles, for the coplanar mode
        const bb = g.boundingBox, M = mesh.matrixWorld, P: number[] = [], v = new T.Vector3();
        const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
        for (const c of corners) { v.set(c[0] ? bb.max.x : bb.min.x, c[1] ? bb.max.y : bb.min.y, c[2] ? bb.max.z : bb.min.z).applyMatrix4(M); P.push(v.x, v.y, v.z); }
        rec.pos = b64(new Float32Array(P));
        rec.idx = b64(new Uint16Array([0, 3, 2, 0, 2, 1, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 3, 7, 6, 3, 6, 2, 0, 1, 5, 0, 5, 4])); rec.idxBits = 16;
        rec.boxFaces = true;
      }
      meshes.push(rec);
    }
    // door leaves: the pose a shot may park them in and the sweep between the closed and the open pose
    const doors: any[] = [];
    if (opts.doors) {
      for (const d of house.anchors.doors || []) {
        const pv = d.pivot; if (!pv || !shown(pv)) continue;
        const ud = pv.userData.door, keep = pv.rotation.y, poses: any[] = [];
        const steps = 7;
        for (let s = 0; s <= steps; s++) {
          pv.rotation.y = ud.closedAngle + (ud.openAngle - ud.closedAngle) * (s / steps); pv.updateMatrixWorld(true);
          const boxes: any[] = [];
          pv.traverse((o: any) => {
            if (!o.isMesh || !o.geometry) return;
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            const bb = o.geometry.boundingBox; if (o.geometry.type !== 'BoxGeometry') return;
            boxes.push({ m: Array.from(o.matrixWorld.elements), c: [(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2], h: [(bb.max.x - bb.min.x) / 2, (bb.max.y - bb.min.y) / 2, (bb.max.z - bb.min.z) / 2] });
          });
          poses.push(boxes);
        }
        pv.rotation.y = keep; pv.updateMatrixWorld(true);
        doors.push({ id: d.id, level: d.level, kind: d.kind, leaf: d.leaf, hinge: d.hinge, y0: d.y0, h: d.h, w: d.w, open: d.open, swing: d.swing, closed: ud.closedAngle, openA: ud.openAngle, poses });
      }
    }
    return { entities: ents, meshes, doors };
  });

  // a mesh's hit along a pixel ray, for tooling that wants to look at one pair again
  geo.hit = (id: number, origin: number[], dir: number[]) => {
    const ray = new T.Raycaster(new T.Vector3(...origin), new T.Vector3(...dir).normalize());
    const h = ray.intersectObject(geo.meshes[id - 1], false)[0];
    return h ? { t: h.distance, p: h.point.toArray() } : null;
  };


  // ------------------------------------------------------------------------------------------------------------------------------
  // the house's own numbers for collide.mts: storeys, rooms (with floor offsets), the slab openings
  // ------------------------------------------------------------------------------------------------------------------------------
  geo.sceneMeta = () => {
    const d = dbg(), spec = d.house.spec, a = d.house.anchors;
    const levels = (spec.levels || []).map((l: any) => ({ id: l.id, y: l.y || 0, height: l.height || 2.8 }));
    const rooms: any[] = [], voids: any[] = [];
    (spec.levels || []).forEach((l: any, li: number) => {
      for (const r of l.rooms || []) if (r.bounds) rooms.push({ level: li, levelId: l.id, name: r.name, bounds: { x: r.bounds.x, z: r.bounds.z, w: r.bounds.w, d: r.bounds.d }, program: r.program || null, floorOffset: typeof r.floorOffset === 'number' ? r.floorOffset : 0, y: l.y || 0, height: l.height || 2.8 });
      for (const v of l.voids || []) voids.push({ level: li, rect: { x: v.x, z: v.z, w: v.w, d: v.d }, kind: 'authored' });
    });
    for (const v of (a.arch && a.arch.voids) || []) {
      const li = levels.findIndex((l: any) => l.id === v.level);
      for (const r of v.auto || []) voids.push({ level: li, rect: r, kind: 'stairwell' });
      for (const r of v.double || []) voids.push({ level: li, rect: r, kind: 'double-height' });
    }
    return { levels, rooms, voids };
  };

  // ------------------------------------------------------------------------------------------------------------------------------
  // the picture of a collision: the two things tinted (red, blue), the shared box in magenta over everything, the camera in the room at
  // the angle with the clearest line to it (else from above through the cutaway)
  // ------------------------------------------------------------------------------------------------------------------------------
  geo.pairShot = async (cfg: any) => {
    const A = geo.tops[cfg.ea], B = cfg.eb !== null && cfg.eb !== undefined ? geo.tops[cfg.eb] : null;
    const at = new T.Vector3(cfg.at[0], cfg.at[1], cfg.at[2]), sc = scene();
    const lv = dbg().house.spec.levels[cfg.level] || { y: 0, height: 2.8 };
    const inEnt = (o: any) => { for (let p = o; p; p = p.parent) if (p === A || p === B) return true; return false; };
    const saved: any[] = [];
    const hiddenUp: any[] = [];
    const tint = (root: any, hex: number) => root && root.traverse((o: any) => {
      if (!o.isMesh) return;
      saved.push([o, o.material]);
      const f = (m: any) => { if (!m || !m.clone) return m; const c = m.clone(); if (c.color) c.color.lerp(new T.Color(hex), 0.62); if (c.emissive) { c.emissive.setHex(hex); c.emissiveIntensity = 0.28; } return c; };
      o.material = Array.isArray(o.material) ? o.material.map(f) : f(o.material);
    });
    tint(A, 0xff3b30); tint(B, 0x0a84ff);
    const sz = cfg.size || [0.1, 0.1, 0.1];
    const marker = new T.Mesh(new T.BoxGeometry(Math.max(0.05, sz[0]), Math.max(0.05, sz[1]), Math.max(0.05, sz[2])), new T.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
    marker.position.copy(at); marker.renderOrder = 999; sc.add(marker);
    try {
      let cam: any = null, dressing = { walls: 'up', roof: 'on' };
      const bb = new T.Box3().setFromObject(A); if (B) bb.union(new T.Box3().setFromObject(B));
      const dist0 = Math.max(1.8, Math.min(4.2, 0.95 * bb.getSize(new T.Vector3()).length()));
      geo.withSnapshot({ res: '360', dressing }, () => {
        marker.visible = false;
        const ray = new T.Raycaster(), cands: any[] = [];
        for (const k of [1, 1.35, 0.8]) for (let i = 0; i < 12; i++) {
          const az = (i / 12) * Math.PI * 2, d = dist0 * k;
          const y = Math.max(lv.y + 1.15, Math.min(lv.y + 1.75, at.y + 0.9));
          const pos = new T.Vector3(at.x + Math.sin(az) * d, y, at.z + Math.cos(az) * d);
          const dir = at.clone().sub(pos), len = dir.length(); dir.normalize(); ray.set(pos, dir); ray.far = len + 0.05;
          const hits = ray.intersectObjects(sc.children, true).filter((h: any) => h.object.isMesh && shown(h.object) && !(h.object.userData && h.object.userData.windowGlow));
          const first = hits[0], clear = !first || inEnt(first.object) || first.distance > len - 0.12;
          // the eye must be in free space too: nothing within 0.35 m around it
          let free = true;
          for (const dd of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) { ray.set(pos, new T.Vector3(dd[0], dd[1], dd[2])); ray.far = 0.3; if (ray.intersectObjects(sc.children, true).some((h: any) => h.object.isMesh && shown(h.object) && !h.object.userData.windowGlow)) free = false; }
          if (clear && free) { cands.push({ pos, k }); if (cands.length) break; }
        }
        if (cands.length) cam = cands[0].pos;
        marker.visible = true;
      });
      let target = at.clone();
      if (!cam) {
        // from above through the cutaway, with every storey over this one taken away
        cam = new T.Vector3(at.x + 1.6, lv.y + lv.height + 1.6, at.z + 1.6); dressing = { walls: 'cutaway', roof: 'off' };
        const levels = dbg().house.spec.levels || [];
        for (const top of sc.children) {
          if (!top.visible || top.isLight || (top.userData && (top.userData.role === 'ground' || top.userData.role === 'site'))) continue;
          const wp = new T.Vector3(); top.getWorldPosition(wp);
          let li = 0; levels.forEach((l: any, i: number) => { if (wp.y >= (l.y || 0) - 0.3) li = i; });
          if (li > cfg.level) { hiddenUp.push(top); top.visible = false; }
        }
      }
      geo.setCam({ pos: [cam.x, cam.y, cam.z], target: [target.x, target.y, target.z], fov: 55, near: 0.05, far: 160 });
      let url = '';
      geo.withSnapshot({ res: cfg.res || '720', dressing }, () => { url = renderer().domElement.toDataURL('image/png'); });
      // the snapshot hook above drew the frame before reading: that is the picture. Put a label on it.
      const img = await createImageBitmap(await (await fetch(url)).blob());
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height + 40; const c2 = cv.getContext('2d');
      c2.fillStyle = '#10141c'; c2.fillRect(0, 0, cv.width, cv.height); c2.drawImage(img, 0, 40);
      c2.fillStyle = '#fff'; c2.font = '15px monospace'; c2.textBaseline = 'top'; c2.fillText(cfg.label || '', 10, 6); c2.fillStyle = '#ff6a60'; c2.fillText('red: ' + (cfg.nameA || ''), 10, 22); c2.fillStyle = '#5ab0ff'; c2.fillText('   blue: ' + (cfg.nameB || ''), 10 + 9 * 8 + (cfg.nameA || '').length * 9, 22);
      for (const o of hiddenUp) o.visible = true;
      return { image: cv.toDataURL('image/png'), cam: [cam.x, cam.y, cam.z].map((v: number) => +v.toFixed(3)), overhead: dressing.walls === 'cutaway' };
    } finally {
      for (const o of hiddenUp) o.visible = true;
      sc.remove(marker); marker.geometry.dispose(); marker.material.dispose();
      for (const [o, m] of saved) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((x: any) => x && x.dispose && x.dispose()); o.material = m; }
    }
  };

  // ------------------------------------------------------------------------------------------------------------------------------
  // camera spots that come from the house: n evenly spaced samples of a baked shot track, and the cutaway overviews
  // ------------------------------------------------------------------------------------------------------------------------------
  geo.trackSamples = (shot: string, n: number) => {
    const tr = W.__houseShotTrack(shot, { fps: 30 });
    const out: any[] = [], S = tr.samples;
    for (let k = 0; k < n; k++) {
      const i = Math.min(S - 1, Math.round(((k + 0.5) / n) * (S - 1)));
      out.push({ k, t: +(i / (S - 1)).toFixed(4), pos: [tr.pos[i * 3], tr.pos[i * 3 + 1], tr.pos[i * 3 + 2]].map((v: number) => +v.toFixed(4)), target: [tr.look[i * 3], tr.look[i * 3 + 1], tr.look[i * 3 + 2]].map((v: number) => +v.toFixed(4)), fov: +(+tr.fov[i]).toFixed(3), roof: +(+tr.roofAlpha[i]).toFixed(3) });
    }
    return out;
  };
  geo.overviewCams = () => {
    const b = dbg().house.anchors.bounds, lot = dbg().house.spec.lot || { w: 30, d: 24 };
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, ext = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const top = Math.max(...(dbg().house.spec.levels || []).map((l: any) => (l.y || 0) + (l.height || 2.8)));
    const out: any[] = [];
    for (const az of [45, 135, 225, 315]) {
      const a = (az * Math.PI) / 180, d = ext * 1.15 + 5, el = (38 * Math.PI) / 180;
      out.push({ az, pos: [cx + Math.sin(a) * d * Math.cos(el), top * 0.5 + d * Math.sin(el), cz + Math.cos(a) * d * Math.cos(el)].map((v: number) => +v.toFixed(3)), target: [cx, top * 0.35, cz], fov: 42, lot: [lot.w, lot.d] });
    }
    return out;
  };

  // ------------------------------------------------------------------------------------------------------------------------------
  // the scratch scene of the self-tests: the home taken out of the scene (put back by sandboxOff), the lights kept, and a few boxes and
  // quads put in with the userData the builders would give them. Everything it adds is removed again.
  // ------------------------------------------------------------------------------------------------------------------------------
  let stash: any[] = [], added: any[] = [];
  geo.sandboxOn = () => {
    const sc = scene();
    stash = sc.children.filter((c: any) => !c.isLight && !(c.type === 'Object3D' && c.children.length === 0));
    for (const c of stash) sc.remove(c);
    added = [];
    return stash.length;
  };
  geo.sandboxAdd = (d: any) => {
    const sc = scene();
    const geom = d.kind === 'plane' ? new T.PlaneGeometry(d.size[0], d.size[1]) : new T.BoxGeometry(d.size[0], d.size[1], d.size[2]);
    const mat = new T.MeshStandardMaterial({ color: d.color ?? 0xbbbbbb, roughness: 0.8, side: d.side ?? T.FrontSide });
    if (d.po) { mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -1; }
    const m = new T.Mesh(geom, mat);
    m.position.set(d.pos[0], d.pos[1], d.pos[2]); m.rotation.set(d.rot ? d.rot[0] : 0, d.rot ? d.rot[1] : 0, d.rot ? d.rot[2] : 0);
    m.name = d.name || 'sandbox'; m.userData = { ...(d.userData || {}), planted: true }; m.castShadow = true; m.receiveShadow = true;
    sc.add(m); added.push(m); m.updateMatrixWorld(true);
    return m.id;
  };
  // a box built in WORLD coordinates under a group left at the origin, as AssetFactory.createCable builds the hero's power cord and display lead
  // (hero-build.ts: put(..., 0, 0, 0)): the mesh and its group are at (0,0,0) and only the vertices say where it is
  geo.sandboxAddWorldSpace = (d: any) => {
    const sc = scene();
    const geom = new T.BoxGeometry(d.size[0], d.size[1], d.size[2]); geom.translate(d.pos[0], d.pos[1], d.pos[2]);
    const m = new T.Mesh(geom, new T.MeshStandardMaterial({ color: d.color ?? 0x222222, roughness: 0.8 }));
    const holder = new T.Group(); holder.name = d.name || 'sandbox'; holder.userData = { ...(d.userData || {}), planted: true }; holder.add(m);
    sc.add(holder); added.push(holder); holder.updateMatrixWorld(true);
    return holder.id;
  };
  geo.sandboxOff = () => {
    const sc = scene();
    for (const m of added) { sc.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }
    for (const c of stash) sc.add(c);
    added = []; stash = [];
    geo.buildRegistry();
    return true;
  };
  geo.rebuildRegistry = () => { geo.buildRegistry(); return geo.meshes.length; };
  // a quad exactly on the floor where a camera spot sees bare floor (the first visible hit of a grid of pixel rays is a floor mesh, 2.2-5 m away)
  geo.plantVisible = (cam: any, size: number) => {
    const sc = scene(), c = geo.setCam(cam), ray = new T.Raycaster(), ndc = new T.Vector2();
    c.aspect = 16 / 9; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    let best: any = null;
    const nm = new T.Matrix3(), wn = new T.Vector3();
    for (const ny of [-0.95, -0.85, -0.75, -0.65, -0.55, -0.45, -0.35, -0.25, -0.15]) for (const nx of [0, -0.3, 0.3, -0.6, 0.6, -0.15, 0.15, -0.8, 0.8]) {
      ndc.set(nx, ny); ray.setFromCamera(ndc, c);
      const h = ray.intersectObjects(sc.children, true).find((x: any) => x.object.isMesh && shown(x.object) && !(x.object.userData && x.object.userData.planted));
      if (!h || !h.face) continue;
      const u = topOf(h.object).userData || {};
      nm.getNormalMatrix(h.object.matrixWorld); wn.copy(h.face.normal).applyMatrix3(nm).normalize();
      if (u.role !== 'floor' || h.distance < 2.2 || h.distance > 5.5 || wn.y < 0.99) continue;
      if (!best || Math.abs(h.distance - 3.2) < Math.abs(best.distance - 3.2)) best = h;
    }
    if (!best) return null;
    const m = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshStandardMaterial({ color: 0xff2020, roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set(best.point.x, best.point.y, best.point.z); m.name = 'PLANTED coplanar quad'; m.userData = { planted: true, role: 'item', itemType: 'planted-quad', room: 'planted' };
    sc.add(m); added.push(m); m.updateMatrixWorld(true);
    geo.buildRegistry();
    return { y: best.point.y, at: [best.point.x, best.point.z], id: geo.ids.get(m), under: topOf(best.object).name };
  };
  // an item (a box of the given size, dressed as a registry item) put through a real wall of the house: centred on the wall slab of the first
  // full-height wall piece of the ground storey that is long and tall enough, 0.45 m up, so half of it is in the slab and the rest on both sides
  geo.plantBoxThroughWall = (size: number[], itemType: string) => {
    const sc = scene();
    for (const m of geo.meshes) {
      const g = m.geometry; if (!g || g.type !== 'BoxGeometry' || !shown(m)) continue;
      const top = topOf(m), u = top.userData || {};
      if (!u.isWall || u.role !== 'wall' || wallPartOf(m, top) !== 'full' || unitName(m, top)) continue;
      const p = g.parameters; if (p.width < 2.0 || p.height < 2.5 || p.depth > 0.2 || p.depth < 0.1) continue;
      m.updateMatrixWorld(true);
      const pos = new T.Vector3(), q = new T.Quaternion(), s2 = new T.Vector3(); m.matrixWorld.decompose(pos, q, s2);
      if (pos.y > 2) continue;
      const box = new T.Mesh(new T.BoxGeometry(size[0], size[1], size[2]), new T.MeshStandardMaterial({ color: 0xff2020, roughness: 0.8 }));
      const holder = new T.Group(); holder.name = 'PLANTED ' + itemType; holder.add(box); holder.position.set(pos.x, size[1] / 2, pos.z); holder.quaternion.copy(q);
      holder.userData = { planted: true, role: 'item', itemType, room: 'planted' };
      sc.add(holder); added.push(holder); holder.updateMatrixWorld(true);
      geo.buildRegistry();
      return { wall: top.name, at: [pos.x, size[1] / 2, pos.z], id: geo.ids.get(box), thickness: p.depth };
    }
    return null;
  };
  geo.removePlanted = () => {
    const sc = scene();
    for (const m of added) { sc.remove(m); m.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    added = []; geo.buildRegistry();
    return true;
  };

  W.__geo = geo;
  return true;
}

// ------------------------------------------------------------------------------------------------------------------------------------
// the session: a static server over the tree, Chromium on this machine's GPU (or SwiftShader), one page per house
// ------------------------------------------------------------------------------------------------------------------------------------
export const GEO_SRC = `(${installGeo.toString()})()`;

export interface GeoSession {
  srv: Awaited<ReturnType<typeof serve>>;
  browser: any;
  version: string;
  gpu: string;
  open: (house: string, o?: OpenOpts) => Promise<GeoPage>;
  close: () => Promise<void>;
}
export interface OpenOpts { res?: string; tod?: string; query?: string }
export interface GeoPage { page: any; ctx: any; errors: string[]; house: string; close: () => Promise<void> }

/** Chromium's flags on this machine: the GPU through ANGLE's default backend (the Intel iGPU on the dev laptop); `software` is SwiftShader.
 *  macOS keeps the goldens' Metal flags. Never ANGLE-over-Vulkan: it draws blank frames here. */
export function launchArgs(gl: 'default' | 'software' = 'default'): string[] {
  if (process.platform === 'darwin') return ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
  return gl === 'software'
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog']
    : ['--use-gl=angle', '--use-angle=default', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
}

export async function startGeoSession(opts: { gl?: 'default' | 'software'; root?: string } = {}): Promise<GeoSession> {
  const srv = await serve(opts.root ? path.resolve(opts.root) : ROOT, '/');
  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ headless: true, args: launchArgs(opts.gl || 'default') });
  const version = browser.version();
  let gpu = '?';
  async function open(house: string, o: OpenOpts = {}): Promise<GeoPage> {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(e.message.split('\n')[0]));
    await stubGoogleFonts(page, srv.origin);
    await page.goto(srv.url(`room-creator.html?house=${encodeURIComponent(house)}&mode=review${o.query ? '&' + o.query.replace(/^&/, '') : ''}`), { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, house, { timeout: 240000 });
    await page.evaluate(async () => {
      for (const f of ['Manrope', 'Plus Jakarta Sans', 'JetBrains Mono']) await document.fonts.load(`16px "${f}"`).catch(() => {});
      await document.fonts.ready;
    });
    if (o.tod !== undefined) await page.evaluate((t: string) => (window as any).__houseSetLighting(t), o.tod || 'day');
    else await page.evaluate(() => (window as any).__houseSetLighting('day'));
    await page.evaluate((r: string) => { (window as any).__houseSupersample = 2; return (window as any).__houseComposerWarm({ res: r }); }, o.res || '720');
    gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : '?'; });
    await page.evaluate(GEO_SRC);
    await page.evaluate(() => (window as any).__geo.buildRegistry());
    return { page, ctx, errors, house, close: () => ctx.close() };
  }
  return { srv, browser, version, get gpu() { return gpu; }, open, close: async () => { await browser.close(); await srv.close(); } } as GeoSession;
}
