// pnpm run test:live --only assets: the CC0 detail textures and props of the player (assets/realism-assets.ts, media-registry.ts).
//
//  1. manifest    assets/media/assets/files.json lists exactly the files assets/media-assets.ts names; each exists and its name carries
//                 the first 8 hex digits of its sha256; every texture and model has a licence, a licence page and authors
//  2. switches    ?no=assets and ?q=0 make zero media requests and leave no feature behind
//  3. requests    at tier 1 and tier 2 every media URL the page asked for is in the manifest, was fetched with fetch() (never a <link> or a
//                 tag), answers 200 with image/webp or model/gltf-binary, and the bytes stay inside the tier's budget (1.5 / 3 MB)
//  4. it works    swapped materials and (tier 2) props are reported, the world-UV period of a swapped material is a physical size
//  5. restore     after viewer.external.before() the canvas equals ?no=assets's, no material keeps a photographed map, no model and no
//                 hidden procedural piece is left in the scene; after() brings the swap back
//  6. eager       the eager part (realism-assets.js + media-registry.js + media-assets.js) stays small
// A check returns { name, ok, detail }[]; the console-error check (c) of test-live-effects.mts covers every page opened here.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { LiveEnv, LivePage, Result } from '../test-live-effects.mts';

const MB = 1024 * 1024;

type Entry = { url: string; initiator: string; bytes: number; start: number };
const mediaEntries = (lp: LivePage): Promise<Entry[]> => lp.eval(() =>
  performance.getEntriesByType('resource').filter(e => /\/assets\/media\//.test(e.name)).map((e: any) => ({ url: e.name, initiator: e.initiatorType, bytes: e.encodedBodySize || e.transferSize || 0, start: e.startTime })));

export default async function check(env: LiveEnv): Promise<Result[]> {
  const out: Result[] = [];
  const add = (name: string, ok: boolean, detail?: string) => out.push({ name, ok, detail });
  const dir = path.join(env.ROOT, 'assets', 'media', 'assets');

  // ---- 1. the manifest
  const files: string[] = JSON.parse(fs.readFileSync(path.join(dir, 'files.json'), 'utf8')).files;
  const src = fs.readFileSync(path.join(env.ROOT, 'assets', 'media-assets.ts'), 'utf8');
  const named = new Set<string>(); for (const m of src.matchAll(/"file": "([^"]+)"/g)) named.add(m[1]);
  add('files.json lists exactly the files media-assets.ts names', files.length === named.size && files.every(f => named.has(f)), `${files.length} vs ${named.size}`);
  const badName = files.filter(f => {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) return true;
    const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 8);
    return !new RegExp(`-${h}\\.(webp|glb)$`).test(f);
  });
  add('every file exists and carries the hash of its content in its name', badName.length === 0, badName.join(', '));
  const meta = JSON.parse(/MEDIA_ASSETS: Record<string, MediaAsset> = (\{[\s\S]*?\n\});\n/.exec(src)![1]);
  const noLicence = Object.values<any>(meta).filter(a => a.licence !== 'CC0-1.0' || !/^https:\/\//.test(a.licencePage) || !/^https:\/\//.test(a.pageUrl) || !a.authors?.length);
  add('every asset is CC0-1.0 with a licence page, an asset page and authors', noLicence.length === 0, noLicence.map((a: any) => a.id).join(', '));
  const total = files.reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
  add('assets/media/assets is inside the 12 MB budget', total <= 12 * MB, `${(total / MB).toFixed(2)} MB`);

  // ---- 6. the eager part
  const eager = ['realism-assets.js', 'media-registry.js', 'media-assets.js'].map(f => ({ f, n: fs.statSync(path.join(env.ROOT, 'assets', f)).size }));
  const eagerTotal = eager.reduce((a, e) => a + e.n, 0);
  add('the code the feature adds stays under 60 KB uncompressed', eagerTotal < 60 * 1024, eager.map(e => `${e.f} ${(e.n / 1024).toFixed(1)} KB`).join(', '));
  add('realism-assets.js itself is tiny (it is the eager entry)', eager[0].n < 3 * 1024, `${eager[0].n} B`);

  // ---- 2. the switches
  for (const [label, q] of [['?no=assets', 'q=2&no=assets'], ['?q=0', 'q=0'], ['?no=realism', 'no=realism']] as const) {
    const lp = await env.open('aurora', { query: q });
    try {
      await lp.page.waitForTimeout(1500);
      const e = await mediaEntries(lp), fx = await lp.effects();
      add(`${label}: zero media requests and no feature`, e.length === 0 && !(fx && fx.features && fx.features.assets), `${e.length} requests`);
    } finally { await lp.close(); }
  }

  // ---- 3 & 4. requests, budgets, the swap
  const probe = (lp: LivePage) => lp.eval(() => {
    const d = (window as any).__houseDebug();
    let periods: number[] = [], media = 0, hidden = 0, photo = 0, swapped = 0;
    const seen = new Set<any>();
    d.scene.traverse((o: any) => {
      if (o.userData && o.userData.__media) media++;
      if (o.userData && o.userData.__procedural) hidden++;
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || seen.has(m)) continue; seen.add(m);
        const u = m.userData && m.userData.worldUV && m.userData.worldUV.uniforms;
        if (m.map && m.map.isTexture && m.map.image && typeof ImageBitmap !== 'undefined' && m.map.image instanceof ImageBitmap && u) { swapped++; periods.push(u.uWuvPeriod.value.x); }
        if (m.map && m.map.image instanceof ImageBitmap && u) photo++;
      }
    });
    return { media, hidden, photo, swapped, periods };
  });
  for (const [h, q, budget, wantProps] of [['aurora', 'q=1', 1.5 * MB, false], ['aurora', 'q=2', 3 * MB, true], ['vanilla', 'q=2', 3 * MB, true]] as const) {
    const lp = await env.open(h, { query: q });
    try {
      await lp.page.waitForTimeout(4000);
      const e = await mediaEntries(lp), fx = await lp.effects(), a = fx && fx.features && fx.features.assets;
      add(`${h} ${q}: the feature is installed and applied`, !!a && a.applied === true, JSON.stringify(a || null).slice(0, 200));
      const rel = e.map(x => x.url.split('/assets/media/assets/')[1]).filter(Boolean);
      const notListed = rel.filter(r => !files.includes(r));
      add(`${h} ${q}: ${rel.length} media requests, every one in the manifest`, rel.length > 0 && notListed.length === 0, notListed.join(', '));
      add(`${h} ${q}: all fetched with fetch() (no tag, no <link>)`, e.every(x => x.initiator === 'fetch'), [...new Set(e.map(x => x.initiator))].join(','));
      const types = await lp.eval(async (urls: string[]) => { const r: string[] = []; for (const u of urls) { const x = await fetch(u); r.push(`${x.status} ${x.headers.get('content-type')}`); } return r; }, e.map(x => x.url));
      const bad = types.filter(t => !/^200 (image\/webp|model\/gltf-binary)/.test(t));
      add(`${h} ${q}: each answers 200 with image/webp or model/gltf-binary`, bad.length === 0, bad.slice(0, 3).join('; '));
      const bytes = e.reduce((s, x) => s + x.bytes, 0);
      add(`${h} ${q}: the downloads fit the tier's budget`, bytes <= budget, `${(bytes / MB).toFixed(2)} MB of ${(budget / MB).toFixed(1)} MB`);
      const p = await probe(lp);
      add(`${h} ${q}: materials carry the photographed maps`, p.swapped > 0 && p.swapped === (a && a.swappedMaterials), `${p.swapped} (feature says ${a && a.swappedMaterials})`);
      add(`${h} ${q}: the world-UV periods are physical sizes`, p.periods.every(x => x > 0.2 && x < 12), p.periods.map(x => x.toFixed(2)).join(' '));
      if (wantProps) add(`${h} ${q}: props were placed (and the procedural pieces they replace hidden)`, p.media > 0 && p.hidden > 0, `${p.media} models, ${p.hidden} hidden pieces`);
      if (q === 'q=1') add(`${h} ${q}: at most 8 props`, (a && a.props) <= 8, String(a && a.props));
    } finally { await lp.close(); }
  }

  // ---- 5. restore is exact
  for (const [h, q] of [['aurora', 'q=2'], ['vanilla', 'q=1']] as const) {
    { const w = await env.open(h, { query: `${q}&no=assets` }); await w.eval(() => (window as any).__houseViewer.external.before()); await w.hash(); await w.close(); }
    const on = await env.open(h, { query: q });
    const off = await env.open(h, { query: `${q}&no=assets` });
    try {
      await on.page.waitForTimeout(4000);
      const before = await on.eval(() => (window as any).__houseViewer.effects.features.assets.swappedMaterials);
      await on.eval(() => (window as any).__houseViewer.external.before());
      await off.eval(() => (window as any).__houseViewer.external.before());
      const [x, y] = [await on.hash(), await off.hash()];
      add(`${h} ${q}: restored equals ?no=assets`, x === y, x === y ? x.slice(0, 8) : `${x.slice(0, 8)} vs ${y.slice(0, 8)}`);
      const p = await probe(on);
      add(`${h} ${q}: restored scene has no photographed map, no model and no hidden piece`, p.photo === 0 && p.media === 0 && p.hidden === 0, JSON.stringify({ photo: p.photo, media: p.media, hidden: p.hidden }));
      await on.eval(() => (window as any).__houseViewer.external.after());
      await on.page.waitForTimeout(1500);
      const after = await on.eval(() => (window as any).__houseViewer.effects.features.assets);
      add(`${h} ${q}: after() brings the swap back`, after && after.applied === true && after.swappedMaterials === before, `${after && after.swappedMaterials} vs ${before}`);
    } finally { await on.close(); await off.close(); }
  }
  return out;
}
