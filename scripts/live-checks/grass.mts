// pnpm run test:live --only grass: the live grass, lawn and crown shading (assets/realism-grass.ts, viewer-grass.ts,
// viewer-bake.ts) on the real GPU.
//
//   1  hash parity     the hash the grass shader uses (HASH_GLSL), run on the GPU for a few hundred cells, equals the
//                      CPU re-implementation in assets/viewer-grass.ts, bit for bit (a blade is a pure function of its cell)
//   2  no popping      the torus (SLOT_GLSL, the text the field's vertex shader runs): every slot holds one cell of the
//                      window, no two slots the same cell, and moving the window by (dx, dz) changes exactly the slots
//                      on its trailing edge (G x G minus the overlap), never one in the middle
//   3  the mask        on five houses the bake's lawn mask against createSiteContext(spec).hard (paths, patios, decks,
//                      pools, steps, drives …): of the pixels that are definitely hard (inside a polygon, 15 cm clear of
//                      its edge) at least 95 % are not lawn in the bake and at most 2 % are lawn. (A strict IoU of the
//                      lawn against everything that is not hard cannot be had: beds, trees and the house are not in
//                      `hard`, so the domain is the hard polygons themselves.)
//   4  the bake        the bake leaves the scene and the renderer's state exactly as it found them
//   5  restore         after external.before() (what the offline hooks call) the scene, its materials' shader hooks and
//                      flat shading are what a ?no=realism page has; external.after() puts the grass back
//   6  kill switches   ?no=grass installs nothing; ?no=foliage leaves every crown material alone; ?no=lawn leaves the lawn
//   7  no grass where there is no lawn (sand, gravel, desert, urban lots)
// Needs `pnpm run build` (it imports the compiled assets/*.js in Node for the CPU side).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LiveEnv, Result } from '../test-live-effects.mts';

const mod = (rel: string, root: string) => import(pathToFileURL(path.join(root, rel)).href);
// (the page-side code below imports through `new Function`: 'three' and './assets/…' resolve through the page's import map and
// base URL, and the type checker does not try to resolve them in Node)

// the feature installs within the loader's 1.5 s when it can and applies itself late when it cannot (a loaded machine): wait for it
const waitGrass = (lp: any) => lp.page.waitForFunction(() => { const f = (window as any).__houseViewer.effects.features; return !!f.grass && f.grass.applied; }, null, { timeout: 60000 }).catch(() => {});

export default async function check(env: LiveEnv): Promise<Result[]> {
  const out: Result[] = [];
  const add = (name: string, ok: boolean, detail?: string) => out.push({ name, ok, detail });
  const G = await mod('assets/viewer-grass.js', env.ROOT);
  const houses = ['vanilla', 'cocoon', 'aurora', 'riverbend', 'seraphine'];

  // ---- 1 + 2: hash parity and the torus, on the GPU
  {
    const lp = await env.open(houses[0], { query: 'q=1' });
    try {
      const seed = G.seedOf(houses[0]);
      const gpu = await lp.eval(async (seed: number) => {
        const imp = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
        const T = await imp('three');
        const V: any = await imp('./assets/viewer-grass.js');
        const r = (window as any).__houseDebug().renderer;
        const N = 256;
        const rt = new T.WebGLRenderTarget(N, 1, { type: T.FloatType, format: T.RGBAFormat, minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: false });
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
        const mat = new T.ShaderMaterial({
          depthTest: false, depthWrite: false,
          uniforms: { uSeed: { value: seed }, uBase: { value: new T.Vector2() }, uG: { value: 16 } },
          vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
          fragmentShader: `uniform uint uSeed; uniform ivec2 uBase; uniform int uG;\n${V.HASH_GLSL}\n${V.SLOT_GLSL}
            void main() { int id = int(gl_FragCoord.x); ivec2 c = gh_slot(id, uG, uBase); uint k = gh_cell(c, uSeed);
              gl_FragColor = vec4(float(c.x), float(c.y), gh_f(k + 1u), float(k & 0xffffu)); }`,
        });
        const q = new T.Mesh(geo, mat); q.frustumCulled = false;
        const sc = new T.Scene(); sc.add(q);
        const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const prev = { t: r.getRenderTarget(), a: r.autoClear };
        const res: Record<string, number[]> = {};
        try {
          r.autoClear = true;
          for (const [name, b] of Object.entries({ a: [-37, 1001], b: [-36, 1001], c: [-37, 1002], d: [-34, 999], e: [5, -7], f: [2147, -90000] })) {
            mat.uniforms.uBase.value.set(b[0], b[1]);
            r.setRenderTarget(rt); r.render(sc, cam);
            const px = new Float32Array(N * 4);
            r.readRenderTargetPixels(rt, 0, 0, N, 1, px);
            res[name] = Array.from(px);
          }
        } finally { r.setRenderTarget(prev.t); r.autoClear = prev.a; rt.dispose(); geo.dispose(); mat.dispose(); }
        return res;
      }, seed);
      let bad = 0, first = '';
      for (const [name, px] of Object.entries(gpu) as [string, number[]][]) {
        for (let i = 0; i < 256; i++) {
          const cx = px[i * 4], cz = px[i * 4 + 1];
          const key = G.cellKey(cx, cz, seed);
          const f = G.hashF((key + 1) >>> 0), low = key & 0xffff;
          if (px[i * 4 + 2] !== f || px[i * 4 + 3] !== low) { bad++; if (!first) first = `${name}[${i}] cell ${cx},${cz}: gpu ${px[i * 4 + 2]}/${px[i * 4 + 3]} cpu ${f}/${low}`; }
        }
      }
      add('hash parity: 6 windows x 256 cells, GPU = CPU', bad === 0, bad ? `${bad} differ, first ${first}` : undefined);

      // the torus
      const base: Record<string, [number, number]> = { a: [-37, 1001], b: [-36, 1001], c: [-37, 1002], d: [-34, 999] };
      const cells = (n: string) => Array.from({ length: 256 }, (_, i) => `${gpu[n][i * 4]},${gpu[n][i * 4 + 1]}`);
      let torusOk = true, why = '';
      for (const n of Object.keys(base)) {
        const cs = cells(n), set = new Set(cs);
        const [bx, bz] = base[n];
        const inside = cs.every((c, i) => { const [x, z] = c.split(',').map(Number); return x >= bx && x < bx + 16 && z >= bz && z < bz + 16 && ((x % 16) + 16) % 16 === i % 16 && ((z % 16) + 16) % 16 === Math.floor(i / 16) % 16; });
        if (set.size !== 256 || !inside) { torusOk = false; why = `window ${n}: ${set.size} distinct, inside ${inside}`; }
      }
      for (const [from, to] of [['a', 'b'], ['a', 'c'], ['a', 'd']]) {
        const A = cells(from), B = cells(to);
        const changed = A.filter((c, i) => c !== B[i]).length;
        const [dx, dz] = [base[to][0] - base[from][0], base[to][1] - base[from][1]];
        const want = 256 - (16 - Math.abs(dx)) * (16 - Math.abs(dz));
        if (changed !== want) { torusOk = false; why = `${from}->${to}: ${changed} slots changed, wanted ${want}`; }
      }
      add('no popping: a slot keeps its cell; a move of the window changes only its trailing edge', torusOk, why || undefined);
    } finally { await lp.close(); }
  }

  // ---- 3: the mask against the site's hard polygons
  {
    const planting = await mod('assets/site-planting.js', env.ROOT);
    const geom = await mod('assets/site-geom.js', env.ROOT);
    for (const h of houses) {
      const lp = await env.open(h, { query: 'q=1' });
      try {
        await waitGrass(lp);
        const got = await lp.eval(() => {
          const g = (window as any).__houseViewer.effects.features.grass;
          if (!g || !g.readMask) return null;
          const px: Float32Array = g.readMask(), [W, H] = g.size, bytes = new Uint8Array(W * H);
          for (let i = 0; i < W * H; i++) bytes[i] = px[i * 4] > 0.8 ? 1 : 0;   // (the shader's remap, smoothstep(0.6, 0.98), is half way at 0.79)
          let s = ''; const CH = 8192;
          for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
          return { W, H, rect: g.rect, b64: btoa(s) };
        });
        if (!got) { add(`${h}: mask vs hard polygons`, false, 'no grass bake (not installed)'); continue; }
        const bytes = Buffer.from(got.b64, 'base64');
        const spec = JSON.parse(fs.readFileSync(path.join(env.ROOT, 'content', 'houses', `${h}.json`), 'utf8'));
        // (only the kinds whose polygon IS the built footprint: a car, a pond, and the beds of a vegetable garden are boxes or
        // ellipses inside a rectangle, a fence or a low wall is a ribbon wider than the wall)
        const EXACT = new Set(['path', 'patio', 'deck', 'driveway', 'porch', 'steps', 'stair', 'pool', 'basin', 'rill', 'channel']);
        const hardAll = planting.createSiteContext(spec).hard.filter((x: any) => EXACT.has(x.type));
        const hard = hardAll.map((x: any) => x.poly as number[][]);
        const edgeDist = (px: number, pz: number, poly: number[][]) => {
          let d = Infinity;
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1e-9;
            const t = Math.max(0, Math.min(1, ((px - a[0]) * ex + (pz - a[1]) * ez) / L2));
            d = Math.min(d, Math.hypot(px - (a[0] + t * ex), pz - (a[1] + t * ez)));
          }
          return d;
        };
        let nHard = 0, hardNotLawn = 0, hardLawn = 0, nLawn = 0;
        const leakBy: Record<string, number> = {};
        const types: string[] = hardAll.map((x: any) => x.type);
        const { W, H, rect } = got;
        for (let y = 2; y < H; y += 4) for (let x = 2; x < W; x += 4) {
          const wx = rect.x0 + (x + 0.5) / W * rect.w, wz = rect.z0 + rect.d - (y + 0.5) / H * rect.d;
          const lawn = bytes[y * W + x] === 1;
          if (lawn) nLawn++;
          let inside = false, near = false, which = '';
          hard.forEach((poly: number[][], pi: number) => {
            if (geom.inPoly(wx, wz, poly)) { if (edgeDist(wx, wz, poly) >= 0.15) { inside = true; which = types[pi]; } else near = true; }
            else if (edgeDist(wx, wz, poly) < 0.15) near = true;
          });
          if (inside && !near) { nHard++; if (lawn) { hardLawn++; leakBy[which] = (leakBy[which] || 0) + 1; } else hardNotLawn++; }
        }
        const recall = nHard ? hardNotLawn / nHard : 1, leak = nHard ? hardLawn / nHard : 0;
        add(`${h}: bake mask vs createSiteContext().hard (${hard.length} polygons)`, nHard > 20 ? recall >= 0.95 && leak <= 0.02 : nLawn > 1000, `${nHard} hard samples, ${(recall * 100).toFixed(1)} % not lawn, ${(leak * 100).toFixed(1)} % lawn; ${nLawn} lawn samples${hardLawn ? '; lawn inside: ' + JSON.stringify(leakBy) : ''}`);
      } finally { await lp.close(); }
    }
  }

  // ---- 4: the bake leaves nothing behind
  {
    const lp = await env.open(houses[1], { query: 'q=1' });
    try {
      const r = await lp.eval(async () => {
        const imp = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
        const B: any = await imp('./assets/viewer-bake.js');
        const T = await imp('three');
        const d = (window as any).__houseDebug(), r = d.renderer, scene = d.scene;
        const sig = () => {
          const parts: string[] = [];
          scene.traverse((o: any) => { const m = o.material; parts.push(`${o.type}|${o.name}|${o.visible}|${o.children.length}|${m ? (Array.isArray(m) ? m.map((x: any) => x.uuid).join(',') : m.uuid) : ''}`); });
          const st = [r.getRenderTarget() === null, r.autoClear, r.getClearColor(new T.Color()).getHex(), r.getClearAlpha(), r.shadowMap.autoUpdate, r.shadowMap.needsUpdate, scene.background && scene.background.uuid, scene.fog && scene.fog.uuid, r.xr.enabled, r.toneMapping];
          return parts.join('\n') + '\n' + JSON.stringify(st);
        };
        const before = sig();
        const bake = B.bakeSite(T, r, scene, { maxSide: 512 });
        const after = sig();
        const ok = !!bake;
        if (bake) bake.dispose();
        return { same: before === after, ok };
      });
      add('bakeSite leaves the scene and the renderer as it found them', r.ok && r.same, r.ok ? undefined : 'no bake');
    } finally { await lp.close(); }
  }

  // ---- 5 + 6: restore identity and the kill switches
  {
    const sigOf = (lp: any) => lp.eval(() => {
      const d = (window as any).__houseDebug();
      const parts: string[] = [];
      d.scene.traverse((o: any) => {
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        parts.push([o.type, o.name, o.visible, o.children.length, o.count ?? '', ms.map((m: any) => [m.type, m.flatShading, m.side, m.transparent, m.opacity, m.color && m.color.getHex(), m.onBeforeCompile === Object.getPrototypeOf(m).onBeforeCompile ? 'p' : String(m.onBeforeCompile).length, Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey') ? m.customProgramCacheKey() : ''].join(':')).join(';')].join('|'));
      });
      return { n: parts.length, text: parts.join('\n') };
    });
    const firstDiff = (a: string, b: string) => { const x = a.split('\n'), y = b.split('\n'); for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return `line ${i}: ${String(x[i]).slice(0, 160)} <> ${String(y[i]).slice(0, 160)}`; return ''; };
    const hashOf = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
    for (const h of [houses[0], houses[2]]) {
      const on = await env.open(h, { query: 'q=1' });
      const off = await env.open(h, { query: 'no=realism' });
      try {
        await waitGrass(on);
        const fxOn = await on.effects();
        const patched = await on.eval(() => { let n = 0; (window as any).__houseDebug().scene.traverse((o: any) => { if (o.material && !Array.isArray(o.material) && o.material.userData && o.material.userData.__fol) n++; }); return n; });
        const sigWith = await sigOf(on);
        await on.eval(() => (window as any).__houseViewer.external.before());
        await off.eval(() => (window as any).__houseViewer.external.before());   // (the glass swap goes back on both pages)
        const sigRestored = await sigOf(on), sigOff = await sigOf(off);
        add(`${h}: grass installed and crowns shaded (${patched} meshes) before the hooks`, !!fxOn.features.grass && patched > 0 && sigWith.text !== sigOff.text);
        add(`${h}: restored scene equals the ?no=realism scene`, sigRestored.text === sigOff.text, sigRestored.text === sigOff.text ? `${sigOff.n} objects, ${hashOf(sigOff.text)}` : firstDiff(sigRestored.text, sigOff.text));
        await on.eval(() => (window as any).__houseViewer.external.after());
        const sigAgain = await sigOf(on);
        const sorted = (t: string) => t.split('\n').sort().join('\n');   // (the field's group is added last, where it was added the first time or later)
        add(`${h}: the effect comes back after the hooks`, sorted(sigAgain.text) === sorted(sigWith.text), sorted(sigAgain.text) === sorted(sigWith.text) ? undefined : firstDiff(sorted(sigAgain.text), sorted(sigWith.text)));
      } finally { await on.close(); await off.close(); }
    }
    const lp = await env.open(houses[0], { query: 'no=grass' });
    try { await new Promise(r => setTimeout(r, 3000)); add('?no=grass installs nothing', !(await lp.effects()).installed.includes('grass')); } finally { await lp.close(); }
    const lf = await env.open(houses[0], { query: 'q=1&no=foliage' });
    try {
      await waitGrass(lf);
      const n = await lf.eval(() => { let n = 0; (window as any).__houseDebug().scene.traverse((o: any) => { if (o.material && !Array.isArray(o.material) && o.material.userData && o.material.userData.__fol) n++; }); return n; });
      add('?no=foliage leaves every crown material alone', n === 0, `${n} patched`);
    } finally { await lf.close(); }
    const ll = await env.open(houses[0], { query: 'q=1&no=lawn' });
    try { await waitGrass(ll); const fx = await ll.effects(); add('?no=lawn leaves the lawn material alone', fx.features.grass && fx.features.grass.lawn === null); } finally { await ll.close(); }
  }

  // ---- 7: no grass where the ground is not lawn
  {
    const specs = fs.readdirSync(path.join(env.ROOT, 'content', 'houses')).filter(f => f.endsWith('.json') && !f.includes('.plan') && f !== 'index.json');
    const wanted: string[] = [];
    for (const f of specs) {
      const lot = JSON.parse(fs.readFileSync(path.join(env.ROOT, 'content', 'houses', f), 'utf8')).lot || {};
      if (['sand', 'gravel', 'desert', 'urban'].includes(lot.ground)) wanted.push(f.replace('.json', ''));
    }
    for (const h of wanted.slice(0, 3)) {
      const lp = await env.open(h, { query: 'q=1' });
      try { await new Promise(r => setTimeout(r, 4000)); const fx = await lp.effects(); add(`${h}: no grass on a non-lawn lot`, !fx.installed.includes('grass')); } finally { await lp.close(); }
    }
    if (!wanted.length) add('no house in the gallery has a sand, gravel, desert or urban lot (nothing to check)', true);
  }
  return out;
}
