// assets/xr/bake.ts : the cheap representation of the house for a headset. Replaces the seed stub; implements XrBake (host.ts).
//
//   apply(budget, head)  behind the entry veil: merge the house into cells (bake-merge.ts), hide the 2D meshes, ration the lights and
//                        size the sun's shadow (bake-lights.ts), cull to the head (bake-lod.ts), warm the shader programs, then measure
//                        one stereo frame at eight headings and report it.
//   refocus(head)        per teleport, never per frame: which cells are drawn, which `maxSpots` lamps are on.
//   restore()            the exact inverse. Idempotent. Runs before any offline hook (viewer.beforeExternalRender -> xr.end -> here).
//   shadowNeedsUpdate()  one more static shadow render on the next frame (a roof or door moved, the lighting changed).
//
// What it touches, all of it recorded as an undo step and put back by restore(): mesh.visible on the originals it replaced, light.visible
// on the lamps it rationed, the sun's shadow mapSize/normalBias/map, renderer.shadowMap.autoUpdate/needsUpdate, scene.onBeforeRender
// (tethered tier only), and the meshes, materials, textures and geometries it added (disposed). It edits no material and no geometry of the
// house, and it does not touch viewer-glass.ts: the panes stay in the opaque-pass state (transmission would draw the scene again per eye).
//
// The caller (xr-session) owns the order: the house should be in its XR dress (walls up) before apply(), and xr-locomotion toggles the
// roofs and ceilings, then calls shadowNeedsUpdate(). apply() reads the storeys from host.anchors().shotWorld live and never re-digests
// the world after the 2D batch (measured: 1309 of 2200 boxes).
//
// Not product code: nothing a golden, a fixture, a film or a still loads imports this file.
import type { XrBake, BakeReport, XrHost, V3 } from './host.js';
import type { XrBudget } from '../platform-types.js';
import { planBake, buildMerged, mutableMaterials, levelAt } from './bake-merge.js';
import type { BakeOptions, Merged, MatKit, Plan } from './bake-merge.js';
import { focus } from './bake-lod.js';
import type { LodState } from './bake-lod.js';
import { collectLights, pickLights, setLights, restoreLights, configureShadow, dropFill } from './bake-lights.js';
import type { LightBudget, ShadowPlan } from './bake-lights.js';

/** what the census, the tests and the HUD read beyond BakeReport */
export interface BakeDetail {
  ms: { plan: number; merge: number; commit: number; warm: number; measure: number; total: number };
  geometryMB: number; mergedTris: number; groups: number;
  counts: Plan['counts'];
  cull: { radius: number; levels: number; steps: number };
  sweep: { callsPerEye: number[]; avgPerEye: number; worstPerEye: number; trisAvg: number; trisWorst: number };
  limits: { calls: number; tris: number; programs: number; textureMB: number; hz: number };
  /** median ms the CPU spent in one stereo renderer.render at heading 0 (a small target: JS submission, not GPU) */
  submitMs: number;
  residentPrograms: number;
  keptDraws: number;
  warm: { ms: number; ok: boolean; timedOut: boolean; twins: number; programsBefore: number; programsAfter: number };
  lightsTotal: number; lightsPunctual: number; lightsOn: number;
  site: 'ground' | 'all';
  flatBuckets: number; texturedMeshes: number; flatMeshes: number;
}

export interface XrBakeImpl extends XrBake { detail(): BakeDetail | null }

const STEREO_IPD = 0.064, FOV_V = 96, EYE_W = 1344, EYE_H = 1408;     // the Quest 3 at scale 0.8: the census's reference eye
const WARM_TIMEOUT_MS = 8000;

export function createBake(host: XrHost): XrBakeImpl {
  const THREE = host.THREE, renderer = host.renderer, scene = host.scene;
  let applied = false, generation = 0;
  let undo: Array<() => void> = [];
  let merged: Merged[] = [];
  let lod: LodState = { radius: 16, levels: 1 };
  let lb: LightBudget | null = null;
  let shadow: ShadowPlan | null = null;
  let levels: Array<{ y: number; h: number }> = [];
  let last: BakeReport | null = null, lastDetail: BakeDetail | null = null;
  let kit: MatKit | null = null;
  let warming: Promise<void> | null = null, warmPending = false;

  const xrLevels = (): Array<{ y: number; h: number }> => {
    let a: any = null;
    try { a = host.anchors(); } catch { /* a house without anchors: storeys by height */ }
    const l = a && a.shotWorld && Array.isArray(a.shotWorld.levels) ? a.shotWorld.levels : [];
    return l.map((x: any) => ({ y: x.y, h: x.h })).sort((p: any, q: any) => p.y - q.y);
  };
  const headLevel = (head: V3): number => levelAt(levels, head[1] - 1.0);   // the eye is ~1.6 m up: 0.6 m above the floor it stands on

  // ---------------------------------------------------------------------------------------------------------- measuring
  // A stereo ArrayCamera of two eyes 64 mm apart at `head`, 96 degrees vertical, drawn into a small target (the draw count and the CPU
  // submission cost do not depend on the pixels). three's renderer.xr is switched off for the call so it does not swap the camera for
  // the session's; everything else the renderer is left as it was.
  function stereoRig(head: V3, yawRad: number, w: number, h: number) {
    const mk = (side: number) => {
      const c = new THREE.PerspectiveCamera(FOV_V, EYE_W / EYE_H, host.camera.near || 0.1, host.camera.far || 160);
      c.position.set(head[0], head[1], head[2]); c.rotation.set(0, yawRad, 0, 'YXZ'); c.updateMatrixWorld(true);
      c.translateX(side * STEREO_IPD / 2); c.updateMatrixWorld(true);
      c.viewport = new THREE.Vector4(side < 0 ? 0 : w, 0, w, h);
      return c;
    };
    const L = mk(-1), R = mk(1);
    const ac = new THREE.ArrayCamera([L, R]);
    ac.position.set(head[0], head[1], head[2]); ac.rotation.set(0, yawRad, 0, 'YXZ'); ac.updateMatrixWorld(true);
    ac.projectionMatrix.copy(L.projectionMatrix); ac.projectionMatrixInverse.copy(L.projectionMatrixInverse);
    return ac;
  }

  function sweep(head: V3, timed: boolean): { calls: number[]; tris: number[]; submitMs: number } {
    const w = 32, h = 32;
    // marked the way WebXRManager marks its own target (isXRRenderTarget, the output colour space), so three picks the SAME program variants the
    // XR frame will use: a plain target would compile (synchronously) a linear-output twin of every program that no headset frame ever draws with
    const rt = new THREE.WebGLRenderTarget(w * 2, h, { samples: 0, colorSpace: renderer.outputColorSpace });
    rt.isXRRenderTarget = true;
    const prevRt = renderer.getRenderTarget(), prevXr = renderer.xr.enabled;
    const calls: number[] = [], tris: number[] = [];
    let submitMs = 0;
    try {
      renderer.xr.enabled = false;
      renderer.setRenderTarget(rt);
      for (let k = 0; k < 8; k++) {
        const ac = stereoRig(head, k * Math.PI / 4, w, h);
        renderer.render(scene, ac);
        calls.push(renderer.info.render.calls); tris.push(renderer.info.render.triangles);
      }
      if (timed) {
        const ac = stereoRig(head, 0, w, h), t: number[] = [];
        for (let i = 0; i < 9; i++) { const a = performance.now(); renderer.render(scene, ac); t.push(performance.now() - a); }
        t.sort((a, b) => a - b); submitMs = t[t.length >> 1];
      }
    } finally {
      renderer.setRenderTarget(prevRt); renderer.xr.enabled = prevXr; rt.dispose();
    }
    return { calls, tris, submitMs };
  }

  // The distinct shader programs the XR frame draws with: the programs of the materials of what is shown, plus the depth programs the sun's
  // map needs (one per side among the casters). Programs the 2D player compiled stay resident but are not part of an XR frame.
  function programsOf(shownMeshes: any[]): number {
    const ids = new Set<any>(); const sides = new Set<number>();
    for (const m of shownMeshes) {
      const list = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of list) {
        if (!mat) continue;
        const p = renderer.properties.get(mat).currentProgram;
        ids.add(p ? p.cacheKey : mat.uuid);
        if (m.castShadow) sides.add(mat.shadowSide !== null && mat.shadowSide !== undefined ? mat.shadowSide : mat.side === 1 ? 0 : mat.side);
      }
    }
    return ids.size + sides.size;
  }

  // ---------------------------------------------------------------------------------------------------------- warm-up
  // Link the programs the XR frame needs on the driver's own threads before the first stereo frame. compile() would visit EVERY material in
  // the scene, including the hidden 2D originals, and switch them to the XR light count (and the 2D player would then relink them all when the
  // person leaves). So it is given a throwaway group of TWIN meshes (same geometry, material and the flags that are part of three's program
  // key) for only the materials XR draws; the real scene supplies the lights, fog and environment.
  const makeTwins = (meshes: any[], seen: Set<string>): any[] => {
    const out: any[] = [];
    for (const src of meshes) {
      const mats = Array.isArray(src.material) ? src.material : [src.material];
      const key = `${mats.map((m: any) => m && m.uuid).join(',')}|${src.isInstancedMesh ? 'i' : 'm'}${src.instanceColor ? 'c' : ''}|${src.receiveShadow ? 1 : 0}|${Object.keys(src.geometry.attributes).sort().join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const t = src.isInstancedMesh ? new THREE.InstancedMesh(src.geometry, src.material, 1) : new THREE.Mesh(src.geometry, src.material);
      if (src.isInstancedMesh && src.instanceColor) t.setColorAt(0, new THREE.Color());
      t.receiveShadow = src.receiveShadow; t.castShadow = src.castShadow;
      out.push(t);
    }
    return out;
  };
  // The meshes XR leaves as built that come and go with the head (roofs, ceilings, door leaves) or stay (the screen, instanced cans). Their
  // programs are rebuilt for the XR light count at apply() and for the 2D one at restore(), so neither the first roof shown in a headset nor the
  // first one shown after leaving it stops the frame to link.
  const keptMeshesOf = (plan: Plan): any[] => {
    const out = new Set<any>(plan.keptMeshes.filter(m => m.isMesh));
    scene.traverse((o: any) => {
      if (!o.isMesh || (o.userData && o.userData.xrBake)) return;
      for (let a = o.parent; a; a = a.parent) if (a.userData && (a.userData.isRoof || a.userData.isCeiling)) { out.add(o); return; }
    });
    return [...out];
  };

  function relinkKept(twins: any[]): void {
    if (!twins.length || typeof renderer.compileAsync !== 'function') return;
    try {
      const g = new THREE.Group();
      for (const t of twins) g.add(t);
      Promise.resolve(renderer.compileAsync(g, host.camera, scene)).catch(() => {});
    } catch (err) { console.warn('xr bake: relinking the 2D programs failed; they link on first use', err); }
  }

  async function warm(twins: any[]): Promise<BakeDetail['warm']> {
    const t0 = performance.now();
    const programsBefore = renderer.info.programs ? renderer.info.programs.length : 0;
    const group = new THREE.Group();
    for (const t of twins) group.add(t);
    let timedOut = false, ok = true;
    if (typeof renderer.compileAsync === 'function' && group.children.length) {
      let timer = 0;
      try {
        // (the owned materials are not disposed while this poll is in flight: three reads their programs on a timer and throws if they are gone)
        const p: Promise<unknown> = Promise.resolve(renderer.compileAsync(group, host.camera, scene));
        warmPending = true;
        warming = p.then(() => { warmPending = false; }, () => { warmPending = false; });
        await Promise.race([p, new Promise(r => { timer = window.setTimeout(() => { timedOut = true; r(null); }, WARM_TIMEOUT_MS); })]);
      } catch (err) { ok = false; console.warn('xr bake: shader warm-up failed, the first frame compiles what is left', err); }
      finally { window.clearTimeout(timer); }
    }
    return { ms: performance.now() - t0, ok, timedOut, twins: group.children.length, programsBefore, programsAfter: renderer.info.programs ? renderer.info.programs.length : 0 };
  }

  // ---------------------------------------------------------------------------------------------------------- budget
  const limitsOf = (budget: XrBudget) => {
    const rates = Object.keys(budget.callsSubmitted).map(Number);
    const hz = budget.callsSubmitted[budget.refreshHz.start] !== undefined ? budget.refreshHz.start : Math.min(...rates);
    return { calls: budget.callsSubmitted[hz], tris: budget.trisSubmitted, programs: budget.programs, textureMB: budget.textureMB, hz };
  };

  const shownMeshes = (): any[] => {
    const out: any[] = [];
    scene.traverseVisible((o: any) => { if (o.isMesh) out.push(o); });
    return out;
  };

  function textureMBOf(meshes: any[]): number {
    const seen = new Set<any>(); let bytes = 0;
    const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'emissiveMap', 'alphaMap', 'lightMap', 'displacementMap'];
    for (const m of meshes) for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) {
      if (!mat) continue;
      for (const k of slots) {
        const t = mat[k]; if (!t || seen.has(t)) continue; seen.add(t);
        const img = t.image; const w = img && (img.naturalWidth || img.width) || 0, h = img && (img.naturalHeight || img.height) || 0;
        bytes += w * h * 4 * (t.generateMipmaps ? 1.333 : 1);
      }
    }
    return bytes / 1048576;
  }

  // ---------------------------------------------------------------------------------------------------------- the interface
  function restore(): void {
    generation++;
    if (!applied && !undo.length) { last = null; return; }
    const steps = undo; undo = [];
    for (let i = steps.length - 1; i >= 0; i--) { try { steps[i](); } catch (err) { console.warn('xr bake: restore step failed', err); } }
    merged = []; lb = null; shadow = null; kit = null; applied = false; last = null; lastDetail = null;
  }

  async function apply(budget: XrBudget, head: V3): Promise<BakeReport> {
    if (applied || undo.length) restore();
    const gen = ++generation;
    const T0 = performance.now();
    const lim = limitsOf(budget);
    levels = xrLevels();
    scene.updateMatrixWorld(true);
    // (the standalone tiers draw the lot's ground only: the planted site is most of what a window looks onto, and the first headset run decides
    //  whether the budget has room for it; ?xrbake-site=all puts it back for that A/B, ?xrbake-site=ground takes it away on the other tiers)
    const siteParam = host.params.get('xrbake-site');
    const opts: BakeOptions = { site: siteParam === 'all' || siteParam === 'ground' ? siteParam : budget.foveation ? 'ground' : 'all', cellM: Number(host.params.get('xrbake-cell')) || 9, textureCapPx: budget.textureCapPx, levels };

    try {
      // ---- plan + merge: nothing in the scene changes until the commit below, so a throw here leaves the house exactly as it was
      const tp = performance.now();
      const plan = planBake(THREE, scene, opts);
      if (plan.counts.wallsCut) console.warn(`xr bake: ${plan.counts.wallsCut} walls are not at full height; the house should be dressed walls-up before apply()`);
      const mutable = mutableMaterials(scene);
      const tm = performance.now();
      const built = buildMerged(THREE, plan, opts, mutable);
      kit = built.kit;
      const tc = performance.now();

      // ---- commit
      // (pushed first, so run last: after the lights and visibility are back, link the 2D programs of the meshes XR left as built)
      const keptTwinsRef: any[] = [];
      undo.push(() => relinkKept(keptTwinsRef));
      const root = new THREE.Group(); root.name = 'XR bake'; root.userData = { xrBake: true }; root.matrixAutoUpdate = false;
      scene.add(root);
      undo.push(() => { if (root.parent) root.parent.remove(root); });
      for (const m of built.merged) {
        (m.frame || root).add(m.mesh);
        m.mesh.updateMatrixWorld(true);   // (a frame's child: its world matrix is the pivot's, current now)
        undo.push(() => { if (m.mesh.parent) m.mesh.parent.remove(m.mesh); });
      }
      undo.push(() => {
        for (const g of built.geometries) g.dispose();
        const disposeOwned = () => { for (const mt of built.kit.owned) mt.dispose(); for (const t of built.kit.textures) t.dispose(); };
        if (warmPending && warming) warming.then(disposeOwned); else disposeOwned();   // (see warm())
      });
      for (const o of plan.hide) { o.visible = false; undo.push(() => { o.visible = true; }); }
      merged = built.merged;
      lb = collectLights(THREE, scene, budget);
      const lbRef = lb;
      if (host.params.get('xrbake-fill') !== '1') dropFill(lb, budget);   // (?xrbake-fill=1 keeps it, for A/B)
      undo.push(() => restoreLights(lbRef));
      shadow = configureShadow(THREE, renderer, scene, budget);
      const sh = shadow; undo.push(() => sh.undo());
      applied = true;

      // ---- first focus, then warm the programs, then measure (tightening the cull until the budget holds)
      lod = { radius: budget.lodRadiusM, levels: 1 };
      const place = (): void => {
        const lvl = headLevel(head);
        focus(merged, head[0], head[2], lvl, lod);
        setLights(lbRef, pickLights(THREE, lbRef, { x: head[0], y: head[1], z: head[2] }));
      };
      place();
      const seenTwins = new Set<string>();
      const keptList = keptMeshesOf(plan);
      const keptTwins = makeTwins(keptList, seenTwins);
      // (what restore() relinks for the 2D light count: the meshes left as built, and the originals whose material XR draws with as it is)
      keptTwinsRef.push(...makeTwins([...keptList, ...built.ownSources], new Set<string>()));
      const w = await warm([...makeTwins(built.merged.map(m => m.mesh), seenTwins), ...keptTwins]);
      if (gen !== generation) return emptyReport(performance.now() - T0);

      const tms = performance.now();
      const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
      let sw = sweep(head, false), steps = 0;
      // "cull harder": over budget means a smaller radius, then the head's own storey only. (Each step changes only visibility.)
      const ladder: LodState[] = [{ radius: lod.radius * 0.75, levels: 1 }, { radius: Math.max(8, lod.radius * 0.5), levels: 1 }, { radius: Math.max(8, lod.radius * 0.5), levels: 0 }, { radius: 8, levels: 0 }];
      while ((avg(sw.calls) > lim.calls || avg(sw.tris) > lim.tris) && steps < ladder.length) { lod = ladder[steps++]; place(); sw = sweep(head, false); }
      renderer.shadowMap.needsUpdate = true;     // the casters changed with the cull: draw the static map once more, for the final set
      sw = sweep(head, true);
      if (gen !== generation) return emptyReport(performance.now() - T0);
      const tdone = performance.now();

      const shown = shownMeshes();
      const callsAvg = avg(sw.calls), trisAvg = avg(sw.tris);
      const programs = programsOf(shown), texMB = textureMBOf(shown);
      const flatMeshes = built.merged.filter(m => m.kind === 'flat').length;
      let lightsOn = 0; for (const l of lbRef.all) if (l.visible) lightsOn++;
      let over: BakeReport['overBudget'] = null;
      if (callsAvg > lim.calls) over = { what: 'calls', got: Math.round(callsAvg), limit: lim.calls };
      else if (trisAvg > lim.tris) over = { what: 'tris', got: Math.round(trisAvg), limit: lim.tris };
      else if (programs > lim.programs) over = { what: 'programs', got: programs, limit: lim.programs };
      else if (texMB > lim.textureMB) over = { what: 'textureMB', got: Math.round(texMB * 10) / 10, limit: lim.textureMB };
      const report: BakeReport = {
        ms: Math.round((performance.now() - T0) * 10) / 10,
        calls: Math.round(callsAvg), tris: Math.round(trisAvg), perEyeDraws: Math.round(callsAvg / 2), programs, textureMB: Math.round(texMB * 10) / 10,
        cells: new Set(built.merged.map(m => m.cell)).size, hiddenMeshes: plan.hide.length, mergedMeshes: built.merged.length, lightsKept: lightsOn, overBudget: over,
      };
      const pe = sw.calls.map(c => c / 2);
      lastDetail = {
        ms: { plan: tm - tp, merge: tc - tm, commit: tms - tc - w.ms, warm: w.ms, measure: tdone - tms, total: performance.now() - T0 },
        geometryMB: built.bytes / 1048576, mergedTris: built.tris, groups: built.groups, counts: plan.counts,
        cull: { radius: lod.radius, levels: lod.levels, steps },
        sweep: { callsPerEye: pe, avgPerEye: avg(pe), worstPerEye: Math.max(...pe), trisAvg, trisWorst: Math.max(...sw.tris) },
        limits: lim, submitMs: sw.submitMs, residentPrograms: renderer.info.programs ? renderer.info.programs.length : 0,
        keptDraws: plan.keptMeshes.filter(m => m.visible).length, warm: w,
        lightsTotal: lbRef.all.length, lightsPunctual: lbRef.punctual.length, lightsOn,
        site: opts.site, flatBuckets: built.kit.owned.filter((m: any) => m.vertexColors).length, texturedMeshes: built.merged.length - flatMeshes, flatMeshes,
      };
      last = report;
      return report;
    } catch (err) {
      if (gen === generation) restore();   // a throw leaves the house as it was built (unless a newer apply() or restore() already owns the scene)
      throw err;
    }
  }

  function emptyReport(ms: number): BakeReport {
    return { ms, calls: 0, tris: 0, perEyeDraws: 0, programs: 0, textureMB: 0, cells: 0, hiddenMeshes: 0, mergedMeshes: 0, lightsKept: 0, overBudget: null };
  }

  function refocus(head: V3): void {
    if (!applied || !lb) return;
    const { changed } = focus(merged, head[0], head[2], headLevel(head), lod);
    setLights(lb, pickLights(THREE, lb, { x: head[0], y: head[1], z: head[2] }));
    if (changed) renderer.shadowMap.needsUpdate = true;     // fewer or more casters
  }

  function shadowNeedsUpdate(): void { if (applied) renderer.shadowMap.needsUpdate = true; }

  return { apply, refocus, restore, shadowNeedsUpdate, report: () => last, detail: () => lastDetail };
}
