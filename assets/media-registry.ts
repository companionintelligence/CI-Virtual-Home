// The CC0 detail textures and hero props of the live player: what a house needs, how it is fetched, and how it is put on.
//
// assets/realism-assets.ts is the thin eager entry the realism registry loads; everything heavy is here (imported when a
// house is opened at tier 1 or above) and in assets/media-assets.ts (the generated manifest: scripts/prep-assets.mts).
// The files themselves are under assets/media/assets/ with a hash of their content in their name, so a cached copy can
// never be stale against new code; the portal build ships exactly the files assets/media/assets/files.json lists.
//
// TWO THINGS ARE SWAPPED, BOTH ONLY IN THE PLAYER, BOTH UNDONE EXACTLY BY restore():
//
//   1. TEXTURES. The kit's procedural sets (assets/textures.ts: oak, herringbone, concrete, stucco, brick, siding, stone,
//      asphalt, clay-tile, deck, tile) carry their palette colour baked into the albedo. A photographed set carries only the
//      DETAIL of a surface (prep-assets.mts reduces its albedo to luma around a known mean), so the swap replaces map,
//      normalMap and roughnessMap and tints the material by (the procedural set's mean colour) / (the detail map's mean):
//      the surface lands on the average colour it had, the palette and the lighting presets stay as tuned, and the surface
//      gains grain, joints and relief. The world-UV period (uniform uWuvPeriod, assets/textures.ts) is set to the photograph's
//      physical size, so a board is a board wide in a bath and in a great room alike. The shader does not change: a swap is
//      pointer assignments (no program compiles), which is why it can happen late, after the static batch.
//   2. PROPS. A placed item whose userData.itemType has a model gets that model as a child, scaled to the box the procedural
//      one measured, and the procedural pieces it replaces are hidden (visible = false, userData.__procedural). Hidden meshes
//      are skipped by viewer-batch, so a pre-batch install lets the models merge into the cells with everything else.
//      A fit that is off by more than the model's tolerance (a tall shelf for a low cubby) leaves the procedural prop alone.
//
// NOTHING BLOCKS THE FIRST FRAME. prefetch(houseId) starts the downloads when the house id is known (concurrency 4, one
// Map of promises, an AbortController per house so a switch cancels the old house's); install() waits at most
// INSTALL_WAIT_MS for them: textures that arrive later swap in when they do, and so do props (placed with the batch undone and redone once, a beat after the last model).
//
// COST. Eager: this file's compiled size plus media-assets.js (a few KB each). Per house, lazily: tier 1 at most
// TIER_BUDGET[1] bytes (512 px albedo, 512 normal, 512 roughness for each set, at most 8 props); tier 2 at most
// TIER_BUDGET[2] (1k albedo on the four biggest surfaces, every prop). GPU: a 512 map with mips is 1.4 MB, a 1k map 5.6 MB.
// A swap compiles nothing; props add draw calls only until viewer-batch merges them (same material objects across clones).
import { MEDIA_ASSETS, type MediaModel, type MediaTexture, type ModelFit } from './media-assets.js';

export const INSTALL_WAIT_MS = 1400;
export const TIER_BUDGET: Record<number, number> = { 1: 1.5 * 1024 * 1024, 2: 3 * 1024 * 1024 };
export const TIER_MAX_PROPS: Record<number, number> = { 1: 8, 2: 1000 };
export const MAX_TRIS = 150000;
const CONCURRENCY = 4;
const BIG_SURFACES = 4;   // how many sets get their 1k albedo at tier 2

// (the import map maps 'three/addons/' to the vendored examples; a variable specifier keeps the type checker out of it)
const ADDON = 'three/addons/';
const dyn = (spec: string): Promise<any> => import(/* @vite-ignore */ spec);
const BASE = new URL('./media/assets/', import.meta.url).href;
const SWAPPABLE = /^(oak|herringbone|concrete|stucco|brick|siding|stone|asphalt|clay-tile|deck|tile)\.map$/;

const textures = Object.values(MEDIA_ASSETS).filter((a): a is MediaTexture => a.kind === 'tex' && !a.optOut);
const models = Object.values(MEDIA_ASSETS).filter((a): a is MediaModel => a.kind === 'model' && !a.optOut);
const TEX_FOR_KIND = new Map<string, MediaTexture>();
for (const t of textures) for (const k of t.kinds) TEX_FOR_KIND.set(k, t);
/** itemType → the models that may stand in for it (several = variants, one chosen per prop by a hash of where it stands) */
export const MODELS_FOR_TYPE = new Map<string, MediaModel[]>();
for (const m of models) for (const t of m.types) MODELS_FOR_TYPE.set(t, [...(MODELS_FOR_TYPE.get(t) || []), m]);
export const textureKind = (kind: string, exterior: boolean): string => (exterior && TEX_FOR_KIND.has(`${kind}:exterior`) ? `${kind}:exterior` : kind);

// ------------------------------------------------------------------------------------------------ what a house needs
// A pure function of the spec's fields: the palette's cladding, the floors (a level's and a room's), room finishes, roof types,
// the site's ground and the item types. It is a guess made before the house is built (prefetch uses it); install() reads the real
// scene and asks for whatever the guess missed.
const FLOOR_KIND: Record<string, string> = { oak: 'oak', wood: 'oak', planks: 'oak', herringbone: 'herringbone', 'oak-herringbone': 'herringbone', parquet: 'herringbone', tile: 'tile', porcelain: 'tile', stone: 'tile', concrete: 'concrete', 'polished-concrete': 'concrete', deck: 'deck', 'honey-oak': 'oak', walnut: 'oak', cherry: 'oak', 'white-oak': 'oak', 'grey-wash': 'oak', 'square-tile': 'tile' };
const WALL_KIND: Record<string, string> = { brick: 'brick', stone: 'stone', siding: 'siding', stucco: 'stucco', timber: '', corrugated: '' };
const ROOF_TILE = new Set(['terracotta', 'tile', 'spanish', 'clay-tile']);
export type Need = { tex: string[]; models: string[] };
export function neededFor(spec: any, tier: number): Need {
  const kinds = new Set<string>();
  const add = (k?: string) => { if (k && TEX_FOR_KIND.has(k)) kinds.add(k); };
  if (tier < 1 || !spec) return { tex: [], models: [] };
  const mat = spec.palette && spec.palette.material;
  add(WALL_KIND[mat] ?? 'stucco');
  const types = new Set<string>();
  for (const lv of spec.levels || []) {
    add(FLOOR_KIND[lv.floor || 'oak']);
    if (lv.material) add(WALL_KIND[lv.material]);
    for (const r of lv.rooms || []) {
      if (r.floor) add(FLOOR_KIND[typeof r.floor === 'string' ? r.floor : r.floor.kind]);
      if (r.walls) add(WALL_KIND[typeof r.walls === 'string' ? r.walls : r.walls.kind]);
      for (const it of r.items || []) types.add(it.type);
    }
  }
  for (const rf of spec.roofs || []) if (ROOF_TILE.has(rf.finish) || ROOF_TILE.has(rf.type)) add('clay-tile');
  const g = spec.lot && spec.lot.ground;
  if (g === 'asphalt' || g === 'road' || (spec.site && spec.site.street)) add('asphalt');
  add('concrete:exterior');
  const tex = [...kinds].map(k => TEX_FOR_KIND.get(k)!.id);
  const ms = new Set<string>();
  for (const t of types) for (const m of MODELS_FOR_TYPE.get(t) || []) if (m.tier <= tier) ms.add(m.id);
  if (types.has('fruit-bowl')) for (const id of ['bowl', 'lemon', 'apple']) ms.add(id);
  return { tex: [...new Set(tex)], models: [...ms] };
}

// ------------------------------------------------------------------------------------------------ downloads
type Session = { house: string; ac: AbortController };
let session: Session = { house: '', ac: new AbortController() };
const bytesCache = new Map<string, Promise<ArrayBuffer>>();
const loaded = new Set<string>();   // files fetched in this session (for the report)
let active = 0;
const queue: (() => void)[] = [];
const pump = (): void => { while (active < CONCURRENCY && queue.length) { active++; queue.shift()!(); } };

/** a new house cancels the old one's pending downloads (the ones in flight end with an AbortError and leave no trace) */
function sessionFor(house: string): Session {
  if (session.house !== house) { session.ac.abort(); session = { house, ac: new AbortController() }; }
  return session;
}
function fetchBytes(file: string, s: Session): Promise<ArrayBuffer> {
  const hit = bytesCache.get(file);
  if (hit) return hit;
  const p = new Promise<ArrayBuffer>((resolve, reject) => {
    queue.push(() => {
      if (s.ac.signal.aborted) { active--; pump(); reject(new DOMException('aborted', 'AbortError')); return; }
      fetch(BASE + file, { signal: s.ac.signal }).then(r => { if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`); return r.arrayBuffer(); })
        .then(b => { loaded.add(file); resolve(b); }, reject)
        .finally(() => { active--; pump(); });
    });
    pump();
  });
  bytesCache.set(file, p);
  p.catch(() => { if (bytesCache.get(file) === p) bytesCache.delete(file); });   // a failure (or an abort) is not remembered
  return p;
}

/** start the downloads a house will want, as soon as its id is known; nothing else is touched */
export function prefetch(houseId: string, tier: number): void {
  const s = sessionFor(houseId);
  if (tier < 1) return;
  const url = new URL(`../content/houses/${houseId}.json`, import.meta.url).href;
  fetch(url, { signal: s.ac.signal }).then(r => (r.ok ? r.json() : null)).then(spec => {
    if (!spec || s.ac.signal.aborted) return;
    const need = neededFor(spec, tier);
    for (const id of need.tex) { const t = MEDIA_ASSETS[id] as MediaTexture; for (const f of [t.files.albedo, t.files.normal, t.files.rough]) fetchBytes(f.file, s).catch(() => {}); }
    for (const id of need.models) fetchBytes((MEDIA_ASSETS[id] as MediaModel).file, s).catch(() => {});
  }).catch(() => {});
}

// ------------------------------------------------------------------------------------------------ the swap
export type Handle = {
  apply(): void; restore(): void; setTier(t: number): void; sync(): void; dispose(): void; stats(): Record<string, unknown>;
};

type TexSwap = {
  mat: any; asset: MediaTexture;
  orig: { map: any; normalMap: any; roughnessMap: any; color: any; period: [number, number]; rot: [number, number]; macroMean: number | null; userPeriod: number[] };
  area: number;
};
type PropSwap = { obj: any; wrapper: any; hidden: any[]; ids: string[] };

const fnv = (s: string): number => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };

export async function install(ctx: any): Promise<Handle | null> {
  const { THREE, scene, renderer } = ctx;
  const house = ctx.houseId();
  const s = sessionFor(house);
  const tier = (): number => ctx.tier();
  // ?assetskip=plaster,vase-01 leaves those ids procedural: for A/B stills, and the per-asset opt-out in the manifest (optOut) made visible
  const skip = new Set((ctx.params.get('assetskip') || '').split(',').filter(Boolean));
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);

  // ---- what is in the scene that can be swapped (the batch has not run: the meshes are the builders' own)
  const mats = new Map<any, { assets: MediaTexture; meshes: any[]; area: number }>();
  const candidates: any[] = [];
  scene.traverse((o: any) => {
    if (o.isMesh) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || !m.map || !SWAPPABLE.test(m.map.name || '') || !m.userData.worldUV || !m.userData.worldUV.uniforms) continue;
        const key = textureKind(m.map.userData.kind, !!m.map.userData.exterior);
        const asset = TEX_FOR_KIND.get(key);
        if (!asset || skip.has(asset.id)) continue;
        let e = mats.get(m); if (!e) mats.set(m, e = { assets: asset, meshes: [], area: 0 });
        e.meshes.push(o);
      }
    }
    const t = o.userData && o.userData.itemType;
    if (t && MODELS_FOR_TYPE.has(t) && !o.userData.__media) candidates.push(o);
  });

  // ---- which sets, in the order of the area they cover, within the byte budget of the tier
  const area = new Map<string, number>();
  const box = new THREE.Box3(), size = new THREE.Vector3();
  for (const [m, e] of mats) {
    let a = 0;
    for (const o of e.meshes) { box.setFromObject(o); box.getSize(size); a += Math.max(size.x * size.z, size.x * size.y, size.z * size.y); }
    area.set(e.assets.id, (area.get(e.assets.id) || 0) + a);
    e.area = a;
  }
  const ranked = [...new Set([...mats.values()].map(e => e.assets.id))].sort((a, b) => (area.get(b) || 0) - (area.get(a) || 0));
  const budget = TIER_BUDGET[Math.max(1, tier())] ?? TIER_BUDGET[2];
  let spent = 0;
  const useTex: string[] = [];
  const texBytes = (t: MediaTexture): number => t.files.albedo.bytes + t.files.normal.bytes + t.files.rough.bytes;
  for (const id of ranked) { const t = MEDIA_ASSETS[id] as MediaTexture; if (spent + texBytes(t) > budget) continue; spent += texBytes(t); useTex.push(id); }
  const bigIds = new Set(useTex.slice(0, BIG_SURFACES));

  // ---- start every download now (a prefetch has most of them under way)
  const texPromise = new Map<string, Promise<{ albedo: any; normal: any; rough: any }>>();
  const made: any[] = [];   // every texture made here, for dispose()
  const toTexture = async (file: string, srgb: boolean) => {
    const buf = await fetchBytes(file, s);
    const bmp = await createImageBitmap(new Blob([buf], { type: 'image/webp' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const t = new THREE.Texture(bmp);
    // (the files are written with row 0 = v 0, the kit's own convention: assets/textures.ts, scripts/prep-assets.mts)
    t.flipY = false; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true;
    made.push(t);
    return t;
  };
  const texSet = (id: string) => {
    let p = texPromise.get(id);
    if (!p) {
      const t = MEDIA_ASSETS[id] as MediaTexture;
      p = Promise.all([toTexture(t.files.albedo.file, true), toTexture(t.files.normal.file, false), toTexture(t.files.rough.file, false)]).then(([albedo, normal, rough]) => ({ albedo, normal, rough }));
      texPromise.set(id, p);
    }
    return p;
  };
  const big = new Map<string, Promise<any>>();
  const bigAlbedo = (id: string) => { let p = big.get(id); if (!p) { p = toTexture((MEDIA_ASSETS[id] as MediaTexture).files.albedo1k.file, true); big.set(id, p); } return p; };

  // ---- props: which objects, which models, within the tier's count and bytes
  type PlanItem = { obj: any; type: string; model: MediaModel };
  const propPlan: PlanItem[] = [];
  const modelIds = new Set<string>();
  {
    let n = 0, tris = 0;
    const maxProps = TIER_MAX_PROPS[Math.max(1, tier())] ?? 1000;
    // props in the order a viewer meets them: the biggest rooms' first is not known here, so the scene order (floors up)
    for (const obj of candidates) {
      if (n >= maxProps) break;
      let fixture = false;
      obj.traverse((c: any) => { if (c.userData && (c.userData.fixture || c.userData.lampHead)) fixture = true; });
      if (fixture) continue;
      const list = MODELS_FOR_TYPE.get(obj.userData.itemType)!.filter(x => !skip.has(x.id));
      if (!list.length) continue;
      obj.updateMatrixWorld(true);
      const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
      const model = list[fnv(`${house}:${obj.userData.itemType}:${wp.x.toFixed(2)},${wp.z.toFixed(2)}`) % list.length];
      const extra = obj.userData.itemType === 'fruit-bowl' ? ['bowl', 'lemon', 'apple'] : [model.id];
      let bytes = 0; for (const id of extra) if (!modelIds.has(id)) bytes += (MEDIA_ASSETS[id] as MediaModel).bytes;
      if (spent + bytes > budget) continue;
      const tr = extra.reduce((a, id) => a + (MEDIA_ASSETS[id] as MediaModel).tris, 0);
      if (tris + tr > MAX_TRIS) continue;
      spent += bytes; tris += tr; n++;
      for (const id of extra) modelIds.add(id);
      propPlan.push({ obj, type: obj.userData.itemType, model });
    }
  }
  const gltf: Map<string, Promise<any>> = new Map();
  let loaderPromise: Promise<any> | null = null;
  const loadModel = (id: string) => {
    let p = gltf.get(id);
    if (!p) {
      p = (async () => {
        if (!loaderPromise) loaderPromise = Promise.all([dyn(ADDON + 'loaders/GLTFLoader.js'), dyn(ADDON + 'libs/meshopt_decoder.module.js')]).then(([g, d]: any[]) => { const l = new g.GLTFLoader(); l.setMeshoptDecoder(d.MeshoptDecoder); return l; });
        const [loader, buf] = await Promise.all([loaderPromise, fetchBytes((MEDIA_ASSETS[id] as MediaModel).file, s)]);
        const g = await loader.parseAsync(buf.slice(0), '');
        g.scene.traverse((o: any) => {
          if (!o.isMesh) return;
          made.push(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) { made.push(m); for (const v of Object.values<any>(m)) if (v && v.isTexture) made.push(v); }
        });
        return g.scene;
      })();
      gltf.set(id, p);
    }
    return p;
  };

  if (!useTex.length && !propPlan.length) return null;
  for (const id of useTex) void texSet(id).catch(() => {});
  for (const id of modelIds) void loadModel(id).catch(() => {});

  // ---- wait (bounded) for what the first frame can have
  const ready = new Set<string>();   // texture set ids whose maps are decoded
  const modelsReady = new Map<string, any>();
  let applied = false, disposed = false;
  // A model that arrives after apply() (a cold load, a slow link) is placed when it does: the batch is undone around it
  // (ctx.withUnbatched, as for any pre-batch feature that arrives late) and made again, once, a beat after the last arrival.
  let lateTimer = 0;
  function lateProps(): void {
    if (!applied || disposed || lateTimer) return;
    lateTimer = window.setTimeout(() => {
      lateTimer = 0;
      if (!applied || disposed || s.ac.signal.aborted) return;
      try { ctx.withUnbatched(() => buildProps()); } catch (e) { console.warn('realism: assets could not place a late prop', e); }
      ctx.markDirty();
    }, 250);
  }
  const settle = (p: Promise<any>, f: (v: any) => void) => p.then(f, () => {});
  const all: Promise<any>[] = [];
  for (const id of useTex) all.push(settle(texSet(id), () => ready.add(id)));
  for (const id of modelIds) all.push(settle(loadModel(id), v => { modelsReady.set(id, v); lateProps(); }));
  let timer = 0;
  await Promise.race([Promise.all(all), new Promise<void>(r => { timer = window.setTimeout(r, INSTALL_WAIT_MS); })]);
  window.clearTimeout(timer);
  if (s.ac.signal.aborted) return null;

  // ---- the handle
  const swaps: TexSwap[] = [];
  const swapped = new Map<any, TexSwap>();
  const props: PropSwap[] = [];
  const upgraded = new Set<string>();   // set ids on their 1k albedo
  const propsDone = new Set<PlanItem>();   // plan entries decided (placed, or off the fit and left procedural)
  const perRoom = new Map<string, { sz: number; w: any }[]>();
  let propTris = 0;
  const setsDone = new Set<string>();

  const wuv = (m: any) => m.userData.worldUV.uniforms;
  function swapMaterial(m: any, e: { assets: MediaTexture; meshes: any[]; area: number }, set: { albedo: any; normal: any; rough: any }): void {
    const a = e.assets, u = wuv(m), orig = m.map;
    const sp = orig.userData.period as [number, number];
    const rec: TexSwap = {
      mat: m, asset: a, area: e.area || 0,
      orig: {
        map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, color: m.color.clone(),
        period: [u.uWuvPeriod.value.x, u.uWuvPeriod.value.y], rot: [u.uWuvRot.value.x, u.uWuvRot.value.y],
        macroMean: u.uWuvMacro.value > 0 ? u.uWuvMacroMean.value : null, userPeriod: [...m.userData.worldUV.period],
      },
    };
    const follow = a.followSet ? sp[0] / a.followSet : 1;
    const kx = rec.orig.period[0] / sp[0], ky = rec.orig.period[1] / sp[1];
    u.uWuvPeriod.value.set(a.periodM * follow * kx, a.periodM * follow * ky);
    m.userData.worldUV.period = [a.periodM * follow * kx, a.periodM * follow * ky];
    const rotUV = (a.rotUV || 0) * Math.PI / 180;
    if (rotUV) { const ang = Math.atan2(rec.orig.rot[1], rec.orig.rot[0]) + rotUV; u.uWuvRot.value.set(Math.cos(ang), Math.sin(ang)); }
    // the tint: the procedural set's mean in linear light over this map's mean, so the average colour is the kit's
    const pm = orig.userData.meanLin as [number, number, number], am = a.meanLin;
    m.color.r *= pm[0] / am[0]; m.color.g *= pm[1] / am[1]; m.color.b *= pm[2] / am[2];
    if (rec.orig.macroMean !== null) u.uWuvMacroMean.value = (am[0] + am[1] + am[2]) / 3;
    m.map = set.albedo; m.normalMap = set.normal; m.roughnessMap = set.rough;
    swaps.push(rec); swapped.set(m, rec);
  }
  function unswapMaterial(rec: TexSwap): void {
    const m = rec.mat, u = wuv(m), o = rec.orig;
    m.map = o.map; m.normalMap = o.normalMap; m.roughnessMap = o.roughnessMap; m.color.copy(o.color);
    u.uWuvPeriod.value.set(o.period[0], o.period[1]); u.uWuvRot.value.set(o.rot[0], o.rot[1]);
    if (o.macroMean !== null) u.uWuvMacroMean.value = o.macroMean;
    m.userData.worldUV.period = o.userPeriod;
  }
  /** swap every material of a set whose maps are ready (idempotent); each new texture is uploaded before it is drawn with */
  async function reconcileTextures(): Promise<void> {
    if (!applied || disposed) return;
    for (const id of useTex) {
      if (setsDone.has(id) || !ready.has(id)) continue;
      const set = await texSet(id);
      if (!applied || disposed) return;
      for (const t of [set.albedo, set.normal, set.rough]) renderer.initTexture(t);
      for (const [m, e] of mats) if (e.assets.id === id && !swapped.has(m)) swapMaterial(m, e, set);
      setsDone.add(id);
      freeOriginals(id);
      ctx.markDirty();
    }
    if (ctx.tier() >= 2) await promote();
  }
  /** The procedural maps of a swapped set may have been uploaded already (a cold load draws a few frames before the files
   *  arrive) and nothing draws with them now: free their GPU copies. The textures themselves (CPU data) stay for restore(),
   *  and three uploads one again the next time it is drawn with. This is what makes a cold load hold what a warm one does. */
  function freeOriginals(id: string): void {
    for (const r of swaps) if (r.asset.id === id) for (const t of [r.orig.map, r.orig.normalMap, r.orig.roughnessMap]) if (t && t !== r.mat.map && t.dispose) t.dispose();
  }
  async function promote(): Promise<void> {
    for (const id of bigIds) {
      if (upgraded.has(id) || !setsDone.has(id)) continue;
      let t: any;
      try { t = await bigAlbedo(id); } catch { continue; }
      if (!applied || disposed || ctx.tier() < 2) return;
      renderer.initTexture(t);
      const set = await texSet(id);
      for (const r of swaps) if (r.asset.id === id) r.mat.map = t;
      set.albedo.dispose();   // (the 512 map is out of use until a demotion; it is uploaded again then)
      upgraded.add(id); ctx.markDirty();
    }
  }
  async function demote(): Promise<void> {
    for (const id of [...upgraded]) {
      const set = await texSet(id);
      renderer.initTexture(set.albedo);
      for (const r of swaps) if (r.asset.id === id) r.mat.map = set.albedo;
      upgraded.delete(id);
    }
    ctx.markDirty();
  }

  // ---- props
  function localBox(obj: any, kids: any[]): any {
    const out = new THREE.Box3(), inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), tmp = new THREE.Box3(), mtx = new THREE.Matrix4();
    for (const k of kids) {
      k.updateMatrixWorld(true);
      k.traverse((c: any) => {
        if (!c.isMesh || !c.geometry) return;
        if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
        tmp.copy(c.geometry.boundingBox).applyMatrix4(mtx.multiplyMatrices(inv, c.matrixWorld));
        out.union(tmp);
      });
    }
    return out;
  }
  /** place every planned prop whose models have arrived and that is not decided yet; safe to call again when more models arrive */
  function buildProps(): void {
    const touched = new Set<string>();
    for (const pl of propPlan) {
      if (propsDone.has(pl)) continue;
      const ids = pl.type === 'fruit-bowl' ? ['bowl', 'lemon', 'apple'] : [pl.model.id];
      if (!ids.every(id => modelsReady.has(id))) continue;   // the models are late: a later call (when they arrive) places it
      propsDone.add(pl);
      const spec: ModelFit = pl.model.fit || {};
      const obj = pl.obj;
      obj.updateMatrixWorld(true);
      const kids: any[] = obj.children.filter((c: any) => !c.userData.__procedural && !c.userData.__media);
      const h: any = spec.hide, hide = h === 'all' || !h ? kids : typeof h.first === 'number' ? kids.slice(0, h.first) : kids.slice(h.from ?? 0);
      if (!hide.length) continue;
      const pb = localBox(obj, hide);
      if (pb.isEmpty()) continue;
      const wrapper = new THREE.Group();
      wrapper.name = `media:${pl.model.id}`; wrapper.userData.__media = pl.model.id;
      let placed = true;
      if (pl.type === 'fruit-bowl') placed = composeFruitBowl(obj, wrapper, hide, pb);
      else placed = placeModel(wrapper, modelsReady.get(pl.model.id), pl.model, spec, pb);
      if (!placed) continue;
      const tr = ids.reduce((a, id) => a + (MEDIA_ASSETS[id] as MediaModel).tris, 0);
      if (propTris + tr > MAX_TRIS) continue;
      propTris += tr;
      // (hidden, so never drawn again until restore(): a cold load had drawn them a few frames, free what that uploaded)
      for (const k of hide) { k.visible = false; k.userData.__procedural = true; k.traverse((c: any) => { if (c.isMesh && c.geometry) c.geometry.dispose(); }); }
      obj.add(wrapper);
      props.push({ obj, wrapper, hidden: hide, ids });
      const room = String(obj.userData.room || '');
      const arr = perRoom.get(room) || []; arr.push({ sz: pb.getSize(new THREE.Vector3()).length(), w: wrapper }); perRoom.set(room, arr);
      touched.add(room);
      wrapper.traverse((c: any) => { if (c.isMesh) { c.castShadow = false; c.receiveShadow = true; } });
    }
    // only the three largest props of a room cast a shadow (the shadow pass pays for every triangle that casts)
    for (const room of touched) { const arr = perRoom.get(room)!; arr.sort((a, b) => b.sz - a.sz); arr.forEach((x, k) => x.w.traverse((c: any) => { if (c.isMesh) c.castShadow = k < 3; })); }
  }
  /** put a model in `wrapper`, scaled and placed to the box `pb` the procedural pieces measured (local space of the item); false = off the fit */
  function placeModel(wrapper: any, src: any, m: MediaModel, spec: ModelFit, pb: any): boolean {
    const model = src.clone(true);
    const mb = new THREE.Box3().setFromObject(model), msz = mb.getSize(new THREE.Vector3()), psz = pb.getSize(new THREE.Vector3());
    const tryRot = (deg: number) => {
      const swap = deg === 90 || deg === 270;
      const w = swap ? msz.z : msz.x, d = swap ? msz.x : msz.z, h = msz.y;
      const mode = spec.mode || 'box';
      const s = mode === 'height' ? psz.y / h : mode === 'width' ? psz.x / w : mode === 'footprint' ? Math.min(psz.x / w, psz.z / d) : Math.min(psz.x / w, psz.y / h, psz.z / d);
      const err = Math.max(...(spec.gate || ['x', 'y', 'z']).map((ax: string) => { const mv = ax === 'x' ? w : ax === 'y' ? h : d, pv = ax === 'x' ? psz.x : ax === 'y' ? psz.y : psz.z; return Math.abs(mv * s / pv - 1); }));
      return { s: s * (spec.mul || 1), err, deg };
    };
    const choices = spec.rotY === 'auto' ? [0, 90, 180, 270].map(tryRot) : [tryRot(spec.rotY || 0)];
    choices.sort((a, b) => a.err - b.err);
    const best = choices[0];
    if (best.err > (spec.tol ?? 0.3)) return false;
    const s = best.s;
    model.rotation.y = best.deg * Math.PI / 180;
    model.updateMatrixWorld(true);
    const rb = new THREE.Box3().setFromObject(model);   // after the rotation, before the scale
    const pc = pb.getCenter(new THREE.Vector3()), rc = rb.getCenter(new THREE.Vector3());
    model.scale.setScalar(s);
    const ox = spec.offset || [0, 0, 0];
    const x = pc.x - rc.x * s + ox[0];
    const y = (spec.anchorY === 'center' ? pc.y - rc.y * s : pb.min.y - rb.min.y * s) + ox[1];
    const z = (spec.anchorZ === 'back' ? pb.min.z - rb.min.z * s : spec.anchorZ === 'front' ? pb.max.z - rb.max.z * s : pc.z - rc.z * s) + ox[2];
    model.position.set(x, y, z);
    wrapper.add(model);
    return true;
  }
  /** a fruit bowl: the wooden bowl scaled to the procedural one's rim, a lemon or an apple where each procedural fruit sat */
  function composeFruitBowl(obj: any, wrapper: any, hide: any[], pb: any): boolean {
    const bowlM = MEDIA_ASSETS.bowl as MediaModel, bowl = modelsReady.get('bowl').clone(true);
    const bb = new THREE.Box3().setFromObject(bowl), bs = bb.getSize(new THREE.Vector3());
    const rimW = Math.max(pb.max.x - pb.min.x, pb.max.z - pb.min.z);
    const sb = rimW / Math.max(bs.x, bs.z);
    bowl.scale.setScalar(sb);
    bowl.position.set((pb.min.x + pb.max.x) / 2 - (bb.min.x + bb.max.x) / 2 * sb, pb.min.y - bb.min.y * sb, (pb.min.z + pb.max.z) / 2 - (bb.min.z + bb.max.z) / 2 * sb);
    wrapper.add(bowl);
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), p = new THREE.Vector3();
    const bowlTop = pb.min.y + bs.y * sb;
    void bowlM;
    for (const k of hide) {
      if (!k.isMesh || !k.geometry || k.geometry.type !== 'SphereGeometry') continue;
      k.updateMatrixWorld(true);
      p.setFromMatrixPosition(k.matrixWorld).applyMatrix4(inv);
      const r = k.geometry.parameters.radius * Math.max(k.scale.x, k.scale.y, k.scale.z);
      const col = k.material && k.material.color ? k.material.color : null;
      const lemonish = col ? col.r > 0.6 && col.g > 0.5 && col.b < 0.3 : false;   // yellow/orange procedural fruit → a lemon, red/green → an apple
      const id = lemonish || fnv(`${p.x.toFixed(3)}${p.z.toFixed(3)}`) % 3 === 0 ? 'lemon' : 'apple';
      const fm = modelsReady.get(id).clone(true), fb = new THREE.Box3().setFromObject(fm), fs = fb.getSize(new THREE.Vector3());
      const sc = (2 * r) / Math.max(fs.x, fs.y, fs.z) * 1.05;
      fm.scale.setScalar(sc);
      fm.rotation.y = (fnv(`${p.x.toFixed(3)}:${p.z.toFixed(3)}`) % 628) / 100;
      fm.position.set(p.x - (fb.min.x + fb.max.x) / 2 * sc, Math.max(p.y - fs.y * sc / 2 + 0.002, bowlTop * 0.6) - fb.min.y * sc, p.z - (fb.min.z + fb.max.z) / 2 * sc);
      wrapper.add(fm);
    }
    return true;
  }
  function removeProps(): void {
    for (const p of props) { p.obj.remove(p.wrapper); for (const k of p.hidden) { k.visible = true; delete k.userData.__procedural; } }
    props.length = 0; propsDone.clear(); perRoom.clear(); propTris = 0;
  }

  const handle: Handle = {
    apply() {
      if (applied || disposed) return;
      applied = true;
      buildProps();
      void reconcileTextures();
      for (const id of useTex) if (!ready.has(id)) {   // late: swap when the set arrives
        void settle(texSet(id), () => { ready.add(id); void reconcileTextures(); });
      }
    },
    restore() {
      if (!applied) return;
      applied = false;
      window.clearTimeout(lateTimer); lateTimer = 0;
      removeProps();
      for (const r of swaps) unswapMaterial(r);
      swaps.length = 0; swapped.clear(); setsDone.clear(); upgraded.clear();
    },
    setTier(t: number) { if (!applied) return; if (t >= 2) void promote(); else void demote(); },
    sync() { /* the swapped materials are the builders' own objects: the batch keeps them (worldUV materials keep their identity) */ },
    dispose() {
      disposed = true; window.clearTimeout(lateTimer);
      handle.restore();
      for (const x of made) { try { x.dispose(); } catch { /* gone */ } }
      for (const t of made) if (t && t.image && typeof t.image.close === 'function') { try { t.image.close(); } catch { /* ditto */ } }
      made.length = 0;
    },
    stats() {
      return {
        tier: ctx.tier(), sets: [...setsDone], upgraded: [...upgraded], swappedMaterials: swaps.length, props: props.length,
        propIds: props.map(p => p.wrapper.userData.__media), planned: propPlan.length, files: loaded.size,
        triangles: props.reduce((a, p) => a + p.ids.reduce((b, id) => b + (MEDIA_ASSETS[id] as MediaModel).tris, 0), 0),
      };
    },
  };
  return handle;
}
