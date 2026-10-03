#!/usr/bin/env -S node --experimental-strip-types
// The XR bake (assets/xr/bake.ts): does it build the cheap representation, and does restore() put EVERYTHING back?
// @check-house skip — needs a GPU browser; run pnpm run xr:test -- --only 20  (or this file directly: node --experimental-strip-types scripts/xr-tests/20-bake.mts [--houses a,b] [--shots dir])
//
// It runs two ways. Under scripts/test-xr.mts (the xr-test package's runner) it is the case `XB-bake`; run directly it opens the
// live player itself in plain Chromium. No WebXR runtime is needed either way: the bake is exercised through its own interface
// (apply / refocus / restore) on the live scene, with a stereo ArrayCamera standing in for the headset. What this cannot show: how
// the XR frame behaves inside a real session (the XR render target's program variants, MSAA, the compositor) and any GPU cost.
//
// What it asserts, per house:
//   restore exactness   a snapshot of the scene (every object's visible / shadow flags / layers / render order / matrices, every material's
//                       state, every light, the sun's shadow settings, the renderer's settings, the scene's children and hooks) is the
//                       same after apply+restore, after a second restore (idempotent), and after 5 apply/restore cycles; one mono frame
//                       equals the pre-bake frame in draw calls, triangles and pixel hash; geometry and texture counts return; no
//                       userData.xrBake object is left in the scene.
//   the representation  the 2D meshes it replaced are hidden and none is destroyed; every merged mesh of a pivot is a child of that pivot
//                       and follows it (a door leaf swung, the Core's fan rotor turned); a vertex-coloured bucket carries each flat colour;
//                       the world (userData.world) is not drawn; the lights are within the tier's maxSpots (spot + point), the sun's map is the tier's size
//                       and not auto-updating.
//   no recompile        refocus() to other places changes which cells and lamps are drawn but never the number of lights, and a stereo
//                       frame after it compiles no program (renderer.info.programs does not grow).
//   failure paths       an apply() that throws after it committed leaves the house as built; a restore() while apply() is still waiting
//                       cancels it; an impossible budget reports overBudget rather than hiding the problem.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

// ------------------------------------------------------------------------------------------------------------------ in-page checks
// One function, evaluated in the player's page. It returns { checks: [{ok, msg}], notes }.
const IN_PAGE = async (opts: { shots: boolean }) => {
  const w = window as any;
  const d = w.__houseDebug(), r = d.renderer, scene = d.scene, camera = d.camera, THREE = w.__THREE;
  const { createBake } = await import(new URL('./assets/xr/bake.js', location.href).href);
  const T = await import(new URL('./assets/platform-types.js', location.href).href);
  const checks: Array<{ ok: boolean; msg: string }> = [], notes: Record<string, any> = {};
  const check = (ok: any, msg: string) => { checks.push({ ok: !!ok, msg }); };
  const host = { THREE, renderer: r, scene, camera, canvas: r.domElement, controls: null, api: {}, houseId: () => d.house.id, anchors: () => d.house.anchors, markDirty() {}, toast() {}, now: () => performance.now(), params: new URLSearchParams(), no: new Set<string>() };
  const gen2 = T.XR_TIERS['standalone-gen2'], gen1 = T.XR_TIERS['standalone-gen1'], tethered = T.XR_TIERS.tethered;
  // a standing person just inside the front door (the player's camera may be anywhere: an orbit shot hangs above the roof)
  const sw0 = d.house.anchors.shotWorld, en = sw0 && sw0.entry;
  const head: [number, number, number] = en ? [en.x - en.out[0] * 1.2, en.y + 1.6, en.z - en.out[1] * 1.2] : [camera.position.x, camera.position.y, camera.position.z];

  // ---- a snapshot of everything the bake may touch, as one comparable object
  const num = (v: number) => (typeof v === 'number' ? +v.toFixed(6) : v);
  const snapshot = () => {
    const objs: string[] = [], mats = new Map<string, string>(), lights: string[] = [];
    let n = 0;
    scene.traverse((o: any) => {
      const id = n++;
      objs.push(`${id}|${o.type}|${o.name}|${o.visible}|${o.castShadow}|${o.receiveShadow}|${o.layers.mask}|${o.renderOrder}|${o.frustumCulled}|${o.matrixAutoUpdate}|${o.children.length}|${o.matrix.elements.map(num).join(',')}`);
      if (o.isLight) lights.push(`${id}|${o.visible}|${num(o.intensity)}|${o.castShadow}|${o.color.getHex()}|${o.shadow ? `${o.shadow.mapSize.x}x${o.shadow.mapSize.y} nb${num(o.shadow.normalBias)} b${num(o.shadow.bias)}` : '-'}`);
      if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m || mats.has(m.uuid)) continue;
        mats.set(m.uuid, [m.type, m.visible, m.transparent, num(m.opacity), m.side, m.depthWrite, m.depthTest, !!m.alphaHash, num(m.transmission || 0), m.color && m.color.getHex(), m.emissive && m.emissive.getHex(), num(m.emissiveIntensity), num(m.roughness), num(m.metalness),
          m.map && m.map.uuid, m.normalMap && m.normalMap.uuid, m.alphaTest, m.vertexColors, m.polygonOffset].join('|'));
      }
    });
    const rend = [r.shadowMap.enabled, r.shadowMap.autoUpdate, r.shadowMap.type, r.toneMapping, r.outputColorSpace, r.getPixelRatio(), r.xr.enabled, r.info.autoReset, r.autoClear, r.getRenderTarget() === null,
      scene.onBeforeRender === (snapshot as any).hook, scene.children.length, scene.background && scene.background.uuid, scene.environment && scene.environment.uuid, !!scene.fog].join('|');
    return { objs, mats: [...mats.entries()].map(([k, v]) => `${k}|${v}`).sort(), lights, rend, count: n };
  };
  (snapshot as any).hook = scene.onBeforeRender;
  const diff = (a: any, b: any): string => {
    for (const k of ['objs', 'mats', 'lights'] as const) {
      const sa = new Set<string>(a[k]), sb = new Set<string>(b[k]);
      const only = (x: Set<string>, y: Set<string>) => [...x].filter(v => !y.has(v)).slice(0, 3);
      const oa = only(sa, sb), ob = only(sb, sa);
      if (oa.length || ob.length || a[k].length !== b[k].length) return `${k}: ${a[k].length} vs ${b[k].length}; before-only ${JSON.stringify(oa).slice(0, 300)}; after-only ${JSON.stringify(ob).slice(0, 300)}`;
    }
    if (a.rend !== b.rend) return `renderer settings: ${a.rend} vs ${b.rend}`;
    return '';
  };

  // ---- one mono frame into a fixed target: calls, triangles, a pixel hash. (The shadow map is redrawn in it: autoUpdate is on in 2D.)
  const rt = new THREE.WebGLRenderTarget(480, 270, { samples: 0 });
  const frame = () => {
    const prt = r.getRenderTarget(); r.setRenderTarget(rt); camera.updateMatrixWorld(true);
    r.render(scene, camera);
    const calls = r.info.render.calls, tris = r.info.render.triangles;
    const px = new Uint8Array(480 * 270 * 4); r.readRenderTargetPixels(rt, 0, 0, 480, 270, px);
    r.setRenderTarget(prt);
    let h = 2166136261; for (let i = 0; i < px.length; i++) { h ^= px[i]; h = Math.imul(h, 16777619) >>> 0; }
    return { calls, tris, hash: h };
  };
  frame(); frame();                                    // settle: programs, the shadow map, anything lazy
  const base = snapshot(), baseFrame = frame();
  const mem0 = { g: r.info.memory.geometries, t: r.info.memory.textures }, prog0 = r.info.programs.length;
  const visibleMeshes0: any[] = []; scene.traverseVisible((o: any) => { if (o.isMesh) visibleMeshes0.push(o); });
  notes.base = { meshes: visibleMeshes0.length, calls: baseFrame.calls, tris: baseFrame.tris };

  // ---- apply (gen2), then what the representation must be
  const bake = createBake(host);
  const rep = await bake.apply(gen2, head);
  const det = bake.detail();
  notes.gen2 = { ...rep, perEyeAvg: det.sweep.avgPerEye, perEyeWorst: det.sweep.worstPerEye, ms: Math.round(rep.ms), cull: det.cull, geometryMB: +det.geometryMB.toFixed(1) };
  check(bake.report() === rep, 'report() is the report apply() returned');
  check(rep.mergedMeshes > 0 && rep.hiddenMeshes > 0, `nothing was merged (merged ${rep.mergedMeshes}, hidden ${rep.hiddenMeshes})`);
  check(rep.perEyeDraws > 0 && rep.perEyeDraws < baseFrame.calls, `an XR eye (${rep.perEyeDraws} draws) is not cheaper than the 2D frame (${baseFrame.calls})`);
  let xrObjs = 0; scene.traverse((o: any) => { if (o.userData && o.userData.xrBake && o.isMesh) xrObjs++; });
  check(xrObjs === rep.mergedMeshes, `${xrObjs} xrBake meshes in the scene, the report says ${rep.mergedMeshes}`);
  // the originals are hidden, not destroyed
  const stillVisibleSources = visibleMeshes0.filter(m => m.visible && !m.userData.xrBake);
  const keptByDesign = stillVisibleSources.filter(m => { for (let a = m; a; a = a.parent) { const u = a.userData || {}; if (u.isRoof || u.isCeiling || u.screen || typeof u.animate === 'function') return true; } return m.isInstancedMesh || m.isLine || m.isPoints || m.isSprite || !!(Array.isArray(m.material) ? m.material.some((x: any) => x && x.vertexColors) : m.material && m.material.vertexColors); });
  notes.keptVisible = { total: stillVisibleSources.length, byDesign: keptByDesign.length };
  check(stillVisibleSources.length - keptByDesign.length <= Math.max(25, visibleMeshes0.length * 0.02), `${stillVisibleSources.length - keptByDesign.length} original meshes are still drawn that the bake should have replaced or hidden`);
  check(visibleMeshes0.every(m => !!m.parent && !!m.geometry), 'an original mesh lost its parent or geometry');
  // the world is not drawn
  let worldDrawn = 0; scene.traverseVisible((o: any) => { if (o.isMesh && !o.userData.xrBake) for (let a = o; a; a = a.parent) if (a.userData && a.userData.world) { worldDrawn++; break; } });
  check(worldDrawn === 0, `${worldDrawn} meshes of the world (street, neighbours, tree line) are still drawn`);
  // pivots: a merged mesh whose frame is a door pivot or the Core's rotor is a child of it and follows it
  const frames: any[] = []; scene.traverse((o: any) => { if (o.userData && o.userData.xrBake && o.isMesh && o.parent !== scene && !(o.parent.userData && o.parent.userData.xrBake)) frames.push(o); });
  notes.frameChildren = frames.length;
  check(frames.length > 0, 'no merged mesh was baked into a pivot (a door leaf or the Core rotor): doors and the fan would be frozen');
  const pv = frames.find(m => m.parent.userData && m.parent.userData.door) || frames[0];
  if (pv) {
    const p0 = pv.parent; const before = pv.matrixWorld.clone(); const rot = p0.rotation.y;
    p0.rotation.y = rot + 1.1; scene.updateMatrixWorld(true);
    check(pv.matrixWorld.elements.some((v: number, i: number) => Math.abs(v - before.elements[i]) > 1e-4), 'a pivot turned and its merged child did not move');
    check(pv.matrixWorld.equals(p0.matrixWorld), 'a pivot\'s merged child does not carry the pivot\'s world matrix');
    p0.rotation.y = rot; scene.updateMatrixWorld(true);
  }
  // flat colour: a vertex-coloured bucket exists, and the buckets are few
  const flatMats = new Set<any>(); let texturedMeshes = 0;
  scene.traverse((o: any) => { if (o.isMesh && o.userData.xrBake) { if (o.material.vertexColors) flatMats.add(o.material); else texturedMeshes++; } });
  notes.flatBuckets = flatMats.size; notes.texturedMeshes = texturedMeshes;
  check(flatMats.size > 0 && flatMats.size <= 40, `${flatMats.size} vertex-coloured buckets (expected 1 to 40)`);
  // lights
  let sun: any = null, punctualOn = 0, punctualAll = 0, dirOn = 0;
  scene.traverse((o: any) => { if (o.isLight) { if (o.isDirectionalLight && o.castShadow) sun = o; if (o.isSpotLight || o.isPointLight) { punctualAll++; if (o.visible) punctualOn++; } if (o.isDirectionalLight && o.visible) dirOn++; } });
  check(punctualOn <= gen2.maxSpots, `${punctualOn} spot and point lights are on, the gen2 tier allows ${gen2.maxSpots}`);
  check(punctualOn === Math.min(gen2.maxSpots, det.lightsPunctual), `${punctualOn} punctual lights on, expected min(maxSpots, ${det.lightsPunctual})`);
  notes.lights = { total: det.lightsTotal, punctual: det.lightsPunctual, on: punctualOn, directional: dirOn };
  check(!!sun && sun.shadow.mapSize.x === gen2.sunShadow.size && sun.shadow.mapSize.y === gen2.sunShadow.size, `the sun's shadow map is ${sun && sun.shadow.mapSize.x}, the gen2 tier says ${gen2.sunShadow.size}`);
  check(r.shadowMap.autoUpdate === false, 'the sun\'s shadow map is still auto-updating in the static tier');
  // shaders were warmed: a stereo frame at the head compiles no program
  const stereo = (x: number, z: number, yaw = 0) => {
    const mk = (s: number) => { const c = new THREE.PerspectiveCamera(96, 1, 0.1, 160); c.position.set(x, head[1], z); c.rotation.set(0, yaw, 0, 'YXZ'); c.updateMatrixWorld(true); c.translateX(s * 0.032); c.updateMatrixWorld(true); c.viewport = new THREE.Vector4(s < 0 ? 0 : 32, 0, 32, 32); return c; };
    const L = mk(-1), R = mk(1); const ac = new THREE.ArrayCamera([L, R]); ac.position.set(x, head[1], z); ac.rotation.set(0, yaw, 0, 'YXZ'); ac.updateMatrixWorld(true);
    ac.projectionMatrix.copy(L.projectionMatrix); ac.projectionMatrixInverse.copy(L.projectionMatrixInverse);
    const t = new THREE.WebGLRenderTarget(64, 32, { samples: 0, colorSpace: r.outputColorSpace }); t.isXRRenderTarget = true; const prt = r.getRenderTarget(), xe = r.xr.enabled; r.xr.enabled = false; r.setRenderTarget(t);
    r.render(scene, ac); const out = { calls: r.info.render.calls, programs: r.info.programs.length };
    r.setRenderTarget(prt); r.xr.enabled = xe; t.dispose(); return out;
  };
  const progAtApply = r.info.programs.length;
  const s0 = stereo(head[0], head[2]);
  check(s0.programs === progAtApply, `the first stereo frame after apply() compiled ${s0.programs - progAtApply} programs (the warm-up missed them)`);
  // refocus: moves the cells and the lamps, never the light count, compiles nothing
  const lightsVisible = () => { let k = 0; scene.traverseVisible((o: any) => { if (o.isLight) k++; }); return k; };
  const lv0 = lightsVisible();
  const bx = d.house.anchors.shotWorld.bounds;
  const spots: Array<[number, number]> = [[bx.minX + 1, bx.minZ + 1], [bx.maxX - 1, bx.maxZ - 1], [(bx.minX + bx.maxX) / 2, bx.minZ + 1], [head[0], head[2]]];
  let visSets: string[] = [], refocusOk = true;
  for (const [x, z] of spots) {
    bake.refocus([x, head[1], z]);
    check(lightsVisible() === lv0, `refocus to (${x.toFixed(1)}, ${z.toFixed(1)}) changed the visible light count ${lv0} -> ${lightsVisible()} (that recompiles every material)`);
    const s = stereo(x, z, 0.7);
    if (s.programs !== progAtApply) { refocusOk = false; check(false, `a stereo frame after refocus to (${x.toFixed(1)}, ${z.toFixed(1)}) compiled ${s.programs - progAtApply} programs`); }
    let shown = 0; scene.traverseVisible((o: any) => { if (o.isMesh && o.userData.xrBake) shown++; }); visSets.push(String(shown));
  }
  notes.refocusShownMeshes = visSets.join('/');
  if (refocusOk) check(true, 'refocus compiles nothing');
  bake.refocus(head);
  bake.shadowNeedsUpdate();
  check(r.shadowMap.needsUpdate === true, 'shadowNeedsUpdate() did not ask for a shadow render');

  // ---- restore, exactly, twice
  bake.restore();
  const frame1 = frame();
  const after1 = snapshot();
  check(!diff(base, after1), 'restore() did not put the scene back: ' + diff(base, after1));
  bake.restore();
  const after2 = snapshot();
  check(!diff(base, after2), 'a second restore() changed something: ' + diff(base, after2));
  check(bake.report() === null, 'report() is not null after restore()');
  check(frame1.calls === baseFrame.calls && frame1.tris === baseFrame.tris, `the mono frame after restore draws ${frame1.calls} calls / ${frame1.tris} triangles, before the bake ${baseFrame.calls} / ${baseFrame.tris}`);
  check(frame1.hash === baseFrame.hash, `the mono frame after restore is a different picture (pixel hash ${frame1.hash} vs ${baseFrame.hash})`);
  let leftover = 0; scene.traverse((o: any) => { if (o.userData && o.userData.xrBake) leftover++; });
  check(leftover === 0, `${leftover} xrBake objects are still in the scene`);
  check(r.info.memory.geometries === mem0.g, `geometries ${mem0.g} before, ${r.info.memory.geometries} after restore (a leak)`);
  check(r.info.memory.textures === mem0.t, `textures ${mem0.t} before, ${r.info.memory.textures} after restore (a leak)`);

  // ---- five cycles, with a stereo frame and a refocus inside each. three keeps every program a LIVE material has ever used on that material
  // (its `programs` map) until the material is disposed, so the few materials the bake draws with as they are (fixtures, glow) pin one XR
  // program per tier visited. That is bounded: after both tiers have been seen once the count must not move.
  let progAfterBoth = 0;
  for (let i = 0; i < 5; i++) {
    const rp = await bake.apply(i % 2 ? gen1 : gen2, head);
    stereo(head[0], head[2]); bake.refocus([head[0] + 1, head[1], head[2]]);
    void rp;
    bake.restore();
    const f = frame(); const s = snapshot();
    check(!diff(base, s), `cycle ${i + 1}: the scene is different after restore: ` + diff(base, s));
    check(f.hash === baseFrame.hash && f.calls === baseFrame.calls, `cycle ${i + 1}: the 2D frame is different after restore (hash ${f.hash} vs ${baseFrame.hash}, calls ${f.calls} vs ${baseFrame.calls})`);
    if (i === 1) progAfterBoth = r.info.programs.length;
  }
  frame();
  check(r.info.memory.geometries === mem0.g && r.info.memory.textures === mem0.t, `after 5 cycles: geometries ${r.info.memory.geometries}/${mem0.g}, textures ${r.info.memory.textures}/${mem0.t}`);
  notes.programs = { before: prog0, afterBothTiers: progAfterBoth, afterCycles: r.info.programs.length };
  check(r.info.programs.length <= progAfterBoth, `programs kept growing after both tiers were seen: ${progAfterBoth} -> ${r.info.programs.length} (a leak per cycle)`);
  check(r.info.programs.length <= prog0 + 40, `programs ${prog0} -> ${r.info.programs.length}: the XR programs of the shared materials are bounded by a few tens`);

  // ---- tethered: more lamps, every-3rd shadow hook, restored
  {
    const hook0 = scene.onBeforeRender;
    const rp = await bake.apply(tethered, head);
    check(scene.onBeforeRender !== hook0, 'the tethered tier did not install its shadow cadence hook');
    check(rp.lightsKept >= rep.lightsKept, `tethered keeps ${rp.lightsKept} lights, standalone kept ${rep.lightsKept}`);
    let n = 0; const nu: boolean[] = []; r.shadowMap.needsUpdate = false;
    const rtmp = new THREE.WebGLRenderTarget(32, 32); r.setRenderTarget(rtmp);
    for (let i = 0; i < 6; i++) { r.render(scene, camera); nu.push(r.shadowMap.needsUpdate); n++; }
    r.setRenderTarget(null); rtmp.dispose();
    notes.tetheredNeedsAfterRender = nu.join('');
    bake.restore();
    check(scene.onBeforeRender === hook0, 'restore() did not put scene.onBeforeRender back');
    check(!diff(base, snapshot()), 'tethered: the scene is different after restore: ' + diff(base, snapshot()));
  }

  // ---- failure paths
  {
    // apply() throws after it has committed (a budget with no sunShadow): the house is as built
    let threw = false;
    try { await bake.apply({ ...gen2, sunShadow: null }, head); } catch { threw = true; }
    check(threw, 'apply() with a broken budget did not throw');
    check(!diff(base, snapshot()), 'apply() threw and left the scene different: ' + diff(base, snapshot()));
    check(bake.report() === null, 'report() is not null after a failed apply()');
    // restore() while apply() waits (the warm-up): cancelled, house as built
    const pending = bake.apply(gen2, head);
    bake.restore();
    const late = await pending;
    check(!diff(base, snapshot()), 'restore() during apply() left the scene different: ' + diff(base, snapshot()));
    check(bake.report() === null && late.mergedMeshes === 0, 'a cancelled apply() reported a bake');
    // an impossible budget: overBudget says so, restore is still exact
    const tiny = { ...gen2, callsSubmitted: { 72: 6, 90: 6, 120: 6 }, trisSubmitted: 800000 };
    const bad = await bake.apply(tiny, head);
    check(bad.overBudget && bad.overBudget.what === 'calls', `an impossible calls budget reported overBudget ${JSON.stringify(bad.overBudget)}`);
    notes.impossibleBudget = { cull: bake.detail().cull, over: bad.overBudget };
    bake.restore();
    check(!diff(base, snapshot()), 'after an over-budget apply the restore left the scene different: ' + diff(base, snapshot()));
  }
  const fin = frame();
  check(fin.hash === baseFrame.hash, 'the final 2D frame differs from the one before the first bake');
  rt.dispose();
  return { checks, notes };
};

// ------------------------------------------------------------------------------------------------------------------ the two ways to run it
async function runDirect() {
  const { loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts, parseArgs } = await import(path.join(ROOT, 'scripts', 'portal-lib.mts'));
  const args = parseArgs(process.argv.slice(2));
  const houses: string[] = (args.houses || 'cutestarter,aurora').split(',');
  const srv = await serve(ROOT, '/'), pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ headless: true, args: LAUNCH_ARGS });
  let failed = 0;
  for (const house of houses) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); await stubGoogleFonts(page, srv.origin);
    const errors: string[] = [];
    page.on('pageerror', (e: any) => errors.push(String(e.message || e))); page.on('console', (m: any) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await page.goto(`${srv.url('room-creator.html')}?mode=view&house=${house}&shot=door-to-core&play=0&t=0.55`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction(() => (document.documentElement as any).dataset.viewer === 'ready', null, { timeout: 240000 });
    const res = await page.evaluate(IN_PAGE, { shots: false });
    const bad = res.checks.filter((c: any) => !c.ok);
    failed += bad.length + errors.length;
    console.log(`${house.padEnd(14)} ${res.checks.length - bad.length}/${res.checks.length} checks   ${JSON.stringify(res.notes)}`);
    for (const b of bad) console.log(`   FAIL ${b.msg}`);
    for (const e of errors.slice(0, 3)) console.log(`   page error: ${e}`);
    await ctx.close();
  }
  await browser.close(); await srv.close();
  console.log(failed ? `\nXR bake test FAILED (${failed})` : '\nXR bake test: ok');
  process.exit(failed ? 1 : 0);
}

// Under the xr-test runner (scripts/test-xr.mts) this file is a case; the harness module only exists on a tree that has the xr-test package.
let H: any = null;
const HARNESS = '../xr-harness/lib.mts';   // (a variable, so tsc does not need the file to exist on a tree without the xr-test package)
try { H = await import(HARNESS); } catch { /* run directly */ }
export const bake = H && H.defineCase({
  id: 'XB-bake',
  title: 'the XR bake builds the cheap representation and restore() puts the whole scene back (5 cycles, mono frame hash, geometry and texture counts)',
  async run(t: any) {
    const p = await t.open({ kind: 'player', treeName: 'root', device: 'none', query: 'shot=door-to-core&t=0.55' });
    const res = await p.page.evaluate(IN_PAGE, { shots: false });
    for (const [k, v] of Object.entries(res.notes)) t.note(k, v);
    for (const c of res.checks) t.check(c.ok, c.msg);
  },
});
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await runDirect();
