#!/usr/bin/env -S node --experimental-strip-types
// R3: the cost census (plan 5.1, 8.4), ported from the audit's repo-recon/interior-look/cost.mts. For each of the 30 houses, with
// twelve FIXED interior cameras per house (scripts/review/cameras.mts costCameras: a function of room names, programs and bounds,
// never of their items, and stored in the baseline so a later run measures from the very same eyes):
//   house        meshes, triangles, unique geometries / materials / textures, texture memory (MB), lights, prop meshes and triangles
//   per camera   `audit`  calls and triangles of one direct renderer.render(scene, camera) after the snapshot (the audit's own method:
//                         the plan's budget table, median 1,639 and max 5,194 interior draw calls, is in this number)
//                `pass`   the same one camera pass while the frame's walls-up / roof-on dressing is still on (it includes a sun shadow update when the dressing asks for one: information, not a budget)
//                `frame`  renderer.info calls and triangles of the whole composed frame (every pass: scene, GTAO normal/depth, bloom, shadow update ...)
//                `visible` meshes and triangles whose box meets the frustum, with the walls-up / roof-on dressing the frame has
//   fleet        the medians and maxima the plan's budget table (8.4) is written in
// The measurements are taken inside the snapshot (a toDataURL hook, so the scene is dressed exactly as the frame is) and nothing in
// the file is a timing, so two runs of an unchanged tree write the same bytes.
//
//   node --experimental-strip-types scripts/review/cost.mts [--houses a,b] [--out file] [--write]      measure (--write: test/review/baselines/cost.json)
//   node --experimental-strip-types scripts/review/cost.mts --compare [test/review/baselines/cost.json] [--houses a,b]    measure again from the baseline's cameras and judge section 8.4
// (needs `pnpm run build`; a GPU; ~10-20 s a house. One browser job at a time on this machine.)
import fs from 'node:fs';
import path from 'node:path';
import { REVIEW_DIR, BEFORE_TAG, BASELINES, productFingerprint, productKey, recordProvenance, productDiffersFromTag, parseArgs, readJson, stableJson, writeText, median, round, rel, machine } from './lib.mts';
import { costCameras, type CostCam, type CostRoom } from './cameras.mts';
import { startSession, burnColdContext } from './page.mts';
import { M, houseIds, loadSpec } from '../fleet/_compose-dry.mts';

export const COST_FILE = path.join(BASELINES, 'cost.json');
const args = parseArgs(process.argv.slice(2));

export interface CamCost { key: string; audit: { calls: number; triangles: number }; room: string; program: string | null; frame: { calls: number; triangles: number }; pass: { calls: number; triangles: number }; visible: { meshes: number; triangles: number } }
/** renderer.info.memory at the end of a camera's snapshot: GPU-side counters that depend on what the page happened to allocate and
 *  free before (a different count in a fresh process for the same house), so they are information only, written next to the timings
 *  outside git (cost-memory.json) and never to the committed baseline. */
export interface CamMemory { geometries: number; textures: number }
export interface HouseCost {
  meshes: number; triangles: number; uniqueGeometries: number; uniqueMaterials: number; uniqueTextures: number; textureMB: number;
  lights: { spot: number; point: number; dir: number; hemi: number; other: number }; casters: number; instanced: number;
  items: number; propMeshes: number; propTriangles: number;
  types: Record<string, [number, number, number]>;   // item type -> [instances, meshes, triangles] in this house
  cameras: Array<CostCam & { cost: CamCost }>;
}

/** the house-wide census and, inside one dressed snapshot per camera, the frame cost: runs in the page */
async function measure(w: any, cams: CostCam[]): Promise<Omit<HouseCost, 'cameras'> & { cams: CamCost[] }> {
  return w.page.evaluate(({ cams }: any) => {
    const W = window as any, d = W.__houseDebug(), scene = d.scene, r = d.renderer, c = d.camera, T = W.__THREE;
    const triOf = (g: any) => g ? (g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0)) : 0;
    const texBytes = (t: any) => { const im = t && t.image; if (!im || !im.width) return 0; return im.width * im.height * 4 * (t.generateMipmaps !== false ? 4 / 3 : 1); };
    const geos = new Set(), mats = new Set(), texs = new Map();
    let meshes = 0, tris = 0, casters = 0, instanced = 0, propMeshes = 0, propTris = 0;
    const lights = { spot: 0, point: 0, dir: 0, hemi: 0, other: 0 };
    const types: Record<string, number[]> = {}, roots = new Map<string, Set<any>>(), items = new Set<any>();
    scene.traverse((o: any) => {
      if (o.userData && o.userData.itemType && o.userData.room !== undefined) { (roots.get(o.userData.itemType) || roots.set(o.userData.itemType, new Set()).get(o.userData.itemType)!).add(o); items.add(o); }
      if (o.isLight) { if (o.isSpotLight) lights.spot++; else if (o.isPointLight) lights.point++; else if (o.isDirectionalLight) lights.dir++; else if (o.isHemisphereLight) lights.hemi++; else lights.other++; if (o.castShadow) casters++; }
      if (!o.isMesh) return;
      meshes++; if (o.isInstancedMesh) instanced++;
      const t = triOf(o.geometry) * (o.isInstancedMesh ? o.count : 1); tris += t; geos.add(o.geometry);
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { if (!m) continue; mats.add(m); for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap']) { const tx = m[k]; if (tx && !texs.has(tx)) texs.set(tx, texBytes(tx)); } }
      let p = o, it: string | null = null; while (p) { if (p.userData && p.userData.itemType && p.userData.room !== undefined) { it = p.userData.itemType; break; } p = p.parent; }
      if (it) { propMeshes++; propTris += t; const e = (types[it] ||= [0, 0, 0]); e[1]++; e[2] += t; }
    });
    for (const [k, s] of roots) (types[k] ||= [0, 0, 0])[0] = s.size;
    let texB = 0; for (const v of texs.values()) texB += v;
    // per camera: one dressed snapshot, measured inside it (toDataURL runs while the walls are up and the roof is on)
    const out: any[] = [];
    const proto = HTMLCanvasElement.prototype, orig = proto.toDataURL;
    const frustum = new T.Frustum(), pv = new T.Matrix4(), box = new T.Box3();
    for (const k of cams) {
      c.position.set(...k.cam.pos); c.lookAt(...k.cam.target); c.fov = k.cam.fov; c.near = k.cam.near; c.updateProjectionMatrix();
      let rec: any = null;
      proto.toDataURL = function () {
        const frame = { calls: r.info.render.calls, triangles: r.info.render.triangles };
        c.updateMatrixWorld(true); pv.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
        let vm = 0, vt = 0;
        scene.traverseVisible((o: any) => {
          if (!o.isMesh || !o.geometry) return;
          if (o.isInstancedMesh) { vm++; vt += triOf(o.geometry) * o.count; return; }   // an instanced mesh's own box says nothing of its instances
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
          if (!frustum.intersectsBox(box)) return;
          vm++; vt += triOf(o.geometry) * (o.isInstancedMesh ? o.count : 1);
        });
        r.info.reset(); r.render(scene, c);
        rec = { frame, pass: { calls: r.info.render.calls, triangles: r.info.render.triangles }, visible: { meshes: vm, triangles: Math.round(vt) }, memory: { geometries: r.info.memory.geometries, textures: r.info.memory.textures } };
        return 'data:,';
      };
      r.info.autoReset = false; r.info.reset();
      try { W.__houseSnapshot({ res: '360', dressing: { walls: 'up', roof: 'on' }, quality: 0.5 }); } finally { proto.toDataURL = orig; r.info.autoReset = true; }
      // the audit's own method (repo-recon cost.mts): one direct render after the snapshot has ended its dressing. The plan's budget table
      // (median 1,639, max 5,194 interior draw calls) is in these numbers, so `audit` is what the budgets are judged on.
      r.render(scene, c);
      out.push({ key: k.key, ...rec, audit: { calls: r.info.render.calls, triangles: r.info.render.triangles } });
    }
    return { meshes, triangles: Math.round(tris), uniqueGeometries: geos.size, uniqueMaterials: mats.size, uniqueTextures: texs.size, textureMB: Math.round(texB / 1048576 * 10) / 10, lights, casters, instanced, items: items.size, propMeshes, propTriangles: Math.round(propTris), types: Object.fromEntries(Object.entries(types).map(([k, v]) => [k, [v[0], v[1], Math.round(v[2])]])), cams: out };
  }, { cams });
}

function chooseCameras(id: string): CostCam[] {
  const spec = loadSpec(id);
  const rooms: CostRoom[] = [];
  for (const lv of spec.levels || []) for (const r of lv.rooms || []) {
    if (!r.bounds) continue;
    rooms.push({ level: lv.id, y: lv.y || 0, name: r.name, program: r.program || M.inferProgram(r, lv) || null, b: { x: r.bounds.x, z: r.bounds.z, w: r.bounds.w, d: r.bounds.d } });
  }
  return costCameras(rooms);
}

export function summarise(houses: Record<string, HouseCost>) {
  const hs = Object.values(houses), cams = hs.flatMap(h => h.cameras);
  const types: Record<string, [number, number, number]> = {};
  for (const h of hs) for (const [t, v] of Object.entries(h.types)) { const e = (types[t] ||= [0, 0, 0]); e[0] += v[0]; e[1] += v[1]; e[2] += v[2]; }
  return {
    houses: hs.length, cameras: cams.length,
    medianMeshes: median(hs.map(h => h.meshes)), medianTriangles: median(hs.map(h => h.triangles)), medianTextureMB: round(median(hs.map(h => h.textureMB)), 1),
    maxSpotLights: Math.max(...hs.map(h => h.lights.spot)),
    maxLights: Math.max(...hs.map(h => h.lights.spot + h.lights.point)),
    interiorCalls: { median: median(cams.map(c => c.cost.audit.calls)), max: Math.max(...cams.map(c => c.cost.audit.calls)), medianOfHouseMedians: median(hs.map(h => median(h.cameras.map(c => c.cost.audit.calls)))) },
    interiorPassCalls: { median: median(cams.map(c => c.cost.pass.calls)), max: Math.max(...cams.map(c => c.cost.pass.calls)) },
    interiorFrameCalls: { median: median(cams.map(c => c.cost.frame.calls)), max: Math.max(...cams.map(c => c.cost.frame.calls)) },
    interiorVisibleMeshes: { median: median(cams.map(c => c.cost.visible.meshes)), max: Math.max(...cams.map(c => c.cost.visible.meshes)) },
    interiorTriangles: { median: median(cams.map(c => c.cost.audit.triangles)) },
    propMeshes: hs.reduce((a, h) => a + h.propMeshes, 0), propTriangles: hs.reduce((a, h) => a + h.propTriangles, 0), items: hs.reduce((a, h) => a + h.items, 0),
    types,
  };
}

/** the plan's budget table (8.4), as limits over the baseline's own fleet numbers */
export function judge(base: ReturnType<typeof summarise>, now: ReturnType<typeof summarise>) {
  const pct = (a: number, b: number) => (b - a) / a * 100;
  const rows: Array<{ what: string; base: number; now: number; change: string; limit: string; ok: boolean }> = [];
  const add = (what: string, a: number, b: number, maxPct: number, label = `+${maxPct}%`) => rows.push({ what, base: a, now: b, change: `${pct(a, b) >= 0 ? '+' : ''}${pct(a, b).toFixed(1)}%`, limit: label, ok: pct(a, b) <= maxPct + 1e-9 });
  add('interior eye-view draw calls, median (all cameras)', base.interiorCalls.median, now.interiorCalls.median, 5, '+5% final (LIGHT +2%, BAKE 0%, SOFT -5%, DRESS +12% of post-SOFT)');
  add('interior eye-view draw calls, max', base.interiorCalls.max, now.interiorCalls.max, 5, '+5%');
  add('camera pass draw calls with the frame dressing, median', base.interiorPassCalls.median, now.interiorPassCalls.median, 5, '+5% (information)');
  add('scene meshes, median', base.medianMeshes, now.medianMeshes, 1, '+1% (about 3,400 of 3,368)');
  add('triangles, median', base.medianTriangles, now.medianTriangles, 6, '+6%');
  add('texture memory, median (MB)', base.medianTextureMB, now.medianTextureMB, 0, 'not above baseline');
  rows.push({ what: 'room spot lights per house, max (LIGHT_CAP)', base: base.maxSpotLights, now: now.maxSpotLights, change: `${now.maxSpotLights - base.maxSpotLights}`, limit: '<= 16', ok: now.maxSpotLights <= 16 });
  rows.push({ what: 'dynamic lights (spot + point) per house, max', base: base.maxLights, now: now.maxLights, change: `${now.maxLights - base.maxLights}`, limit: 'not above baseline', ok: now.maxLights <= base.maxLights });
  return rows;
}

/** The BASELINE side of a --compare: the committed summary when every house is compared, else a summary of just the
 *  compared houses taken from the baseline's own per-house numbers. (It used to be the fresh run's summary when all houses
 *  were compared, so every row read +0.0% and passed whatever had changed.) Never takes anything from the fresh run. */
export function compareBase(base: { summary: ReturnType<typeof summarise>; houses: Record<string, any> }, ids: string[]) {
  return ids.length === Object.keys(base.houses).length ? base.summary : summarise(Object.fromEntries(ids.map(i => [i, base.houses[i]])) as any);
}

async function main() {
  const fp = productFingerprint('HEAD');
  if (fp.dirty.length) { console.error(`the product code has uncommitted changes (${fp.dirty.slice(0, 4).join('; ')}): commit or stash them first`); process.exit(2); }
  if (args.write === 'true' && args['allow-drift'] !== 'true') {
    const drift = productDiffersFromTag();
    if (drift.length) { console.error(`HEAD's product code differs from ${BEFORE_TAG} in: ${drift.join(', ')}; the baseline is frozen from that tag (--allow-drift to override, never for the committed file)`); process.exit(2); }
  }
  const ids = args.houses && args.houses !== 'true' ? args.houses.split(',') : houseIds();
  const compare = args.compare !== undefined;
  const basePath = compare && args.compare !== 'true' ? path.resolve(args.compare) : COST_FILE;
  const base = compare ? readJson(basePath) : null;
  const session = await startSession();
  const houses: Record<string, HouseCost> = {};
  const memoryLog: Record<string, Record<string, CamMemory>> = {};
  const timing: Array<{ house: string; seconds: number; load1: number }> = [];
  try {
    for (const id of ids) {
      const t0 = process.hrtime.bigint();
      const cams: CostCam[] = base?.houses?.[id] ? base.houses[id].cameras.map((c: any) => ({ key: c.key, level: c.level, room: c.room, program: c.program, cam: c.cam })) : chooseCameras(id);
      await burnColdContext(session, id, '360');
      const w = await session.open(id, { res: '360' });
      try {
        const m = await measure(w, cams);
        const { cams: camCosts, ...rest } = m;
        houses[id] = { ...rest, cameras: cams.map((c, i) => { const { key: _k, memory, ...cost } = camCosts[i] as any; (memoryLog[id] ||= {})[c.key] = memory; return { ...c, cost }; }) } as HouseCost;
        const secs = Number(process.hrtime.bigint() - t0) / 1e9;
        timing.push({ house: id, seconds: round(secs, 1), load1: machine().load1 });
        const au = houses[id].cameras.map(c => c.cost.audit.calls), ps = houses[id].cameras.map(c => c.cost.pass.calls), fr = houses[id].cameras.map(c => c.cost.frame.calls);
        console.log(`${id.padEnd(16)} meshes ${rest.meshes} tris ${rest.triangles} tex ${rest.textureMB} MB lights ${rest.lights.spot + rest.lights.point} | calls audit ${median(au)} (max ${Math.max(...au)}) pass ${median(ps)} frame ${median(fr)} | ${secs.toFixed(0)} s (load ${machine().load1})`);
        if (w.errors.length) console.error(`  page errors: ${w.errors.slice(0, 2).join(' | ')}`);
      } catch (e: any) { console.error(`${id}: FAILED ${String(e.message).split('\n')[0]}`); process.exitCode = 1; }
      await w.close();
    }
  } finally { await session.close(); }

  const summary = summarise(houses);
  const doc = {
    schema: 1,
    what: 'cost census of every house (scripts/review/cost.mts): house-wide meshes, triangles, geometries, materials, textures and texture memory, lights, prop cost by type, and for each of twelve fixed interior cameras the draw calls and triangles of the composed frame and of one camera pass, and the meshes in view. No timing: two runs of an unchanged tree write the same bytes. Keyed by the tree ids of the product code, not by the commit; the GPU memory counters are not here (see CamMemory in cost.mts).',
    regenerate: 'pnpm run build && node --experimental-strip-types scripts/review/cost.mts --write   (only to re-freeze the BEFORE: at baseline/stage0-green, never to turn a budget green)',
    product: { tag: BEFORE_TAG, ...productKey(fp) },
    renderer: { profile: 'macos-metal', chromium: session.version, res: '360', supersample: 2, dressing: { walls: 'up', roof: 'on' } },
    summary, houses,
  };
  if (compare) {
    console.log(`\nfleet against ${rel(basePath)} (${ids.length} houses):`);
    const rows = judge(compareBase(base, ids), summary);
    for (const r of rows) console.log(`  ${r.ok ? '✓' : '✗'} ${r.what.padEnd(48)} ${String(r.base).padStart(9)} -> ${String(r.now).padStart(9)}  ${r.change.padStart(7)}  (limit ${r.limit})`);
    const exact = ids.every(i => base.houses[i] && stableJson(base.houses[i]) === stableJson(houses[i]));
    console.log(exact ? '  identical to the baseline, house by house' : '  differs from the baseline');
    if (args.out && args.out !== 'true') writeText(path.resolve(args.out), stableJson(doc));
    if (rows.some(r => !r.ok)) process.exitCode = 1;
  } else {
    const out = args.out && args.out !== 'true' ? path.resolve(args.out) : args.write === 'true' ? COST_FILE : null;
    if (!out) { console.log('(not written: --write for test/review/baselines/cost.json, or --out <file>)'); }
    else { writeText(out, stableJson(doc)); console.log(`→ ${rel(out)}`); if (out === COST_FILE) recordProvenance('cost.json', fp); }
    console.log(`fleet: median meshes ${summary.medianMeshes}, triangles ${summary.medianTriangles}, texture ${summary.medianTextureMB} MB; interior eye-view calls median ${summary.interiorCalls.median} max ${summary.interiorCalls.max} (camera pass ${summary.interiorPassCalls.median}, frame ${summary.interiorFrameCalls.median}); max spot lights ${summary.maxSpotLights} (spot + point ${summary.maxLights})`);
    writeText(path.join(REVIEW_LOGS, 'cost-timing.json'), JSON.stringify({ machine: machine(), timing }, null, 1) + '\n');
    writeText(path.join(REVIEW_LOGS, 'cost-memory.json'), stableJson({ what: 'renderer.info.memory per house and camera (information only, not reproducible across processes)', memory: memoryLog }));
  }
}
const REVIEW_LOGS = path.join(REVIEW_DIR, 'logs');   // outside git: timings and logs, never baselines
if (import.meta.url === `file://${process.argv[1]}`) await main();
