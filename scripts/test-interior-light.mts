#!/usr/bin/env -S node --experimental-strip-types
// @check-house skip — a browser gate that reads rendered frames against the frozen BEFORE (a GPU, 2-10 minutes): run by hand in a LIGHT PR (pnpm run test:light)
//
// G1, the interior-light acceptance gate (plan 5.2, light-and-finish design section 8). Three jobs, one per mode:
//
//   pnpm run test:light                       fixtures: the four light-* fixture houses at day, dusk and night from the review rig's
//                                             corner cameras, luma metrics per frame, and the structural facts of the light rig
//                                             (lights per house <= LIGHT_CAP, re-lighting idempotent, ...); exits 1 on a failed row
//   pnpm run test:light -- --bench            the 19 luma checks of the plan's LIGHT acceptance on the five bench rooms (plus riverbend's
//                                             family room, which the day-ceiling check reads): captures them with scripts/review/capture.mts
//                                             (so the product tree must be committed and clean), reads them with scripts/review/luma.mts
//                                             against before.metrics.json, and prints the same table as `luma.mts --compare --gate light`
//                                             --set <label>  the review set name (default after-light, written to <REVIEW_DIR>/after/light/<label>)
//                                             --compare-only  read an already captured set instead of capturing
//   pnpm run test:light -- --portal           the day gain on 12 portal-camera frames (the door-to-core film's last frame, the frame the
//                                             gallery's player ends its walk on, in 12 houses) under the product tree as it is, and under
//                                             the runtime variants L2 and L4 would build (--variants base,bounce,grade,ao,all), so the
//                                             decision whether L2 and L4 earn their keep is made from numbers, not from the design's
//                                             seven hand-picked rooms. It writes <out>/portal-day.json and prints the table.
//                                             --houses a,b  --frames 1,0.55  --variants base,bounce  --label <name>
//
//   pnpm run test:light -- --hitch           the L1 spike: in the live player (?mode=view), how long the first frame after a time-of-day switch takes
//                                             when the room lights are HIDDEN while it is day (three recompiles every lit material, NUM_SPOT_LIGHTS
//                                             changes) against left in the scene at intensity 0. Policy lives in assets/fixtures.ts (hideOffGain);
//                                             this reports the numbers it was chosen on.   --houses a,b  --reps 3
//
//   pnpm run test:light -- --player-calls    the player's static batcher (assets/viewer-batch.ts): draw calls a frame issues for the whole home before and
//                                             after batching, per house, read from window.__houseViewer.batch. Run it on two trees (REVIEW_SERVE_ROOT=<tree>
//                                             serves another checkout) and compare: L2's tag on ceiling materials must cost at most +2 % median.
//                                             --houses a,b  --label <name>
//
// Frames are read off the product's own composer path (__houseSnapshot / __houseRenderFrames, 2x supersample, GTAO, bloom, grade, SMAA), at
// the rig's pinned profile; every decision is a pure function of the files' bytes (luma.mts decodes with ffmpeg). Images go outside git
// (<REVIEW_DIR>/after/light/...).
//
// Exit: 0 every row passes · 1 a row failed · 2 a harness error
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, REVIEW_DIR, BASELINES, parseArgs, readJson, round, stableJson, writeText, rel, machine } from './review/lib.mts';
import { cornerCam, RES, QUALITY, R24 } from './review/cameras.mts';
import { startSession, roomsOf, here } from './review/page.mts';
import { lumaOfFile, lumaMetrics, roundLuma, lightAcceptance, type Luma } from './review/luma.mts';
import { loadManifest } from './review/manifest.mts';

const args = parseArgs(process.argv.slice(2));
const OUT_ROOT = path.join(REVIEW_DIR, 'after', 'light');
const out = (...p: string[]) => path.join(OUT_ROOT, ...p);
const LIGHT_CAP = 16;

interface Row { check: string; frame: string; value: string; limit: string; ok: boolean }
const rows: Row[] = [];
const say = (r: Row) => { rows.push(r); console.log(`  ${r.ok ? '✓' : '✗'} ${r.check.padEnd(46)} ${r.frame.padEnd(40)} ${r.value} (limit ${r.limit})`); };
const num = (v: number, dp = 2) => v.toFixed(dp);

// ---- fixtures -----------------------------------------------------------------------------------------------------------------------
export const LIGHT_FIXTURES = ['light-living-lamp', 'light-bed-lamp', 'light-kitchen-nolamp', 'light-bath-tile'] as const;
/** rooms that have a lamp head the L3 pool can sit at (the fixtures declare their lamps in the spec) */
const HAS_LAMP: Record<string, boolean> = { 'light-living-lamp': true, 'light-bed-lamp': true, 'light-kitchen-nolamp': false, 'light-bath-tile': false };

async function snapRoom(page: any, room: any, corner: 'NW' | 'SE', file: string): Promise<Luma> {
  const cam = cornerCam(room.b, room.y, corner);
  const url = await page.evaluate(({ cam, res, quality }: any) => {
    const W = window as any, d = W.__houseDebug(), c = d.camera;
    c.position.set(...cam.pos); c.lookAt(...cam.target); c.fov = cam.fov; c.near = cam.near; c.updateProjectionMatrix();
    return W.__houseSnapshot({ res, dressing: { walls: 'up', roof: 'on' }, quality });
  }, { cam, res: RES, quality: QUALITY });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  return roundLuma(lumaOfFile(file));
}

async function fixturesMode(): Promise<number> {
  const only = args.fixture && args.fixture !== 'true' ? new Set(args.fixture.split(',')) : null;
  const dir = out('fixtures');
  const session = await startSession();
  const metrics: Record<string, Luma> = {};
  try {
    for (const id of LIGHT_FIXTURES) {
      if (only && !only.has(id)) continue;
      const spec = here('test', 'fixtures', 'houses', `${id}.json`);
      // one throwaway context first, so the kept one does not meet a cold shader pipeline (page.mts burnColdContext, for a fixture)
      const burn = await session.open(id, { spec, res: RES });
      try { await burn.page.evaluate((r: string) => (window as any).__houseSnapshot({ res: r, quality: 0.5 }), RES); } finally { await burn.close(); }
      const w = await session.open(id, { spec, res: RES });
      const rooms = await roomsOf(w.page);
      const room = rooms.find(r => r.program !== 'hall');
      if (!room) throw new Error(`${id}: no room under test`);
      console.log(`${id}  (${room.name}, ${room.b.w} x ${room.b.d} m)`);
      for (const tod of ['day', 'dusk', 'night'] as const) {
        await w.page.evaluate((t: string) => (window as any).__houseSetLighting(t), tod);
        for (const corner of ['NW', 'SE'] as const) {
          const m = await snapRoom(w.page, room, corner, path.join(dir, `${id}__${corner}-${tod}.jpg`));
          metrics[`${id}/${corner}/${tod}`] = m;
        }
      }
      const g = (tod: string) => metrics[`${id}/NW/${tod}`];
      for (const tod of ['dusk', 'night']) say({ check: 'clip <= 1.0', frame: `${id}/NW/${tod}`, value: `${num(g(tod).clip)} %`, limit: '1.0', ok: g(tod).clip <= 1.0 });
      say({ check: 'night crush <= 12', frame: `${id}/NW/night`, value: `${num(g('night').crush)} %`, limit: '12', ok: g('night').crush <= 12 });
      say({ check: 'dusk crush <= 3', frame: `${id}/NW/dusk`, value: `${num(g('dusk').crush)} %`, limit: '3', ok: g('dusk').crush <= 3 });
      say({ check: 'night ceiling luma >= 0.17', frame: `${id}/NW/night`, value: num(g('night').ceil, 3), limit: '0.17', ok: g('night').ceil >= 0.17 });
      say({ check: 'day ceiling luma >= 0.60', frame: `${id}/NW/day`, value: num(g('day').ceil, 3), limit: '0.60', ok: g('day').ceil >= 0.60 });

      // structure of the light rig, read back off the page
      const info = await w.page.evaluate(async () => {
        const W = window as any, F = W.__houseFixtures, st = F.stats();
        const lights: any[] = []; W.__houseDebug().scene.traverse((o: any) => { if (o.isLight && !o.isDirectionalLight && !o.isHemisphereLight && !o.isAmbientLight) lights.push({ type: o.type, fixtureLight: !!o.userData.fixtureLight, visible: o.visible, intensity: o.intensity, penumbra: o.penumbra, angle: o.angle }); });
        // re-lighting is idempotent: ten flips of the time of day end where the first one did
        const snap = () => lights.map(l => l.intensity);
        const first: number[][] = [];
        for (const t of ['dusk', 'night', 'day', 'dusk', 'night', 'day', 'dusk', 'night', 'day', 'dusk']) {
          W.__houseSetLighting(t);
          const now: any[] = []; W.__houseDebug().scene.traverse((o: any) => { if (o.isLight && !o.isDirectionalLight && !o.isHemisphereLight && !o.isAmbientLight) now.push(o.intensity); });
          first.push(now);
        }
        const dusks = [first[0], first[3], first[6], first[9]];
        const stable = dusks.every(a => a.length === dusks[0].length && a.every((v, i) => Math.abs(v - dusks[0][i]) < 1e-9));
        return { stats: st && { lights: st.lights.length, gain: st.gain }, lights, stable };
      });
      say({ check: `lights <= ${LIGHT_CAP}`, frame: id, value: String(info.stats ? info.stats.lights : 0), limit: String(LIGHT_CAP), ok: !!info.stats && info.stats.lights <= LIGHT_CAP });
      say({ check: 're-lighting is idempotent (dusk x4 equal)', frame: id, value: info.stable ? 'equal' : 'differs', limit: 'equal', ok: info.stable });
      if (w.errors.length) say({ check: 'no page errors', frame: id, value: w.errors[0], limit: 'none', ok: false });
      (fixturesMode as any).seen = ((fixturesMode as any).seen || {}) as Record<string, any>;
      (fixturesMode as any).seen[id] = { room: room.name, lights: info.lights, hasLamp: HAS_LAMP[id] };
      await w.close();
    }
  } finally { await session.close(); }
  writeText(path.join(dir, 'fixtures.metrics.json'), stableJson({ schema: 1, what: 'luma metrics of the light-* fixtures (scripts/test-interior-light.mts)', frames: metrics }));
  // room-light facts that the commits after G1 tighten (see the rig-structure block of each commit): reported here, judged there
  const seen = (fixturesMode as any).seen || {};
  for (const [id, v] of Object.entries<any>(seen)) console.log(`  rig ${id}: ${v.lights.map((l: any) => `${l.type}${l.fixtureLight ? '*' : ''}${l.visible ? '' : '(hidden)'} i=${round(l.intensity, 2)}${l.type === 'SpotLight' ? ` pen=${l.penumbra} ang=${round(l.angle, 2)}` : ''}`).join(', ')}`);
  return rows.some(r => !r.ok) ? 1 : 0;
}

// ---- bench: the 19 luma checks ------------------------------------------------------------------------------------------------------
const BENCH_ROOMS = [...R24.filter(r => r.bench).map(r => r.id), 'riverbend-family-room'];
async function benchMode(): Promise<number> {
  const label = args.set && args.set !== 'true' ? args.set : 'after-light';
  const dir = out(label.replace(/^after-/, '') === 'light' ? 'bench' : label);
  const mfile = path.join(dir, `${label}.manifest.json`);
  if (args['compare-only'] !== 'true') {
    console.log(`capturing ${BENCH_ROOMS.length} rooms -> ${rel(dir)}`);
    const r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'review', 'capture.mts'), '--set', label, '--out', dir, '--only', BENCH_ROOMS.join(','), '--tods', 'day,dusk,night', '--no-scale'], { stdio: 'inherit', cwd: ROOT });
    if (r.status !== 0) { console.error('capture failed (the product tree must be committed and clean)'); return 2; }
  }
  const m = loadManifest(mfile);
  const before = readJson(path.join(BASELINES, 'before.metrics.json')).frames as Record<string, Luma>;
  const after: Record<string, Luma> = {};
  for (const s of m.shots.filter(s => s.kind === 'eye')) after[s.id] = roundLuma(lumaOfFile(path.join(dir, s.file)));
  writeText(path.join(dir, 'after.metrics.json'), stableJson({ schema: 1, set: label, frames: after }));
  console.log(`\nLIGHT acceptance (plan 5.2, luma part), ${label} against before.metrics.json`);
  for (const r of lightAcceptance(before, after)) say({ check: r.check, frame: r.frame, value: num(r.value, 3), limit: r.limit, ok: r.ok });
  // the day gain on these frames, for the record
  for (const id of Object.keys(after).filter(i => /\/NW\/day$/.test(i) && before[i])) console.log(`  day ${id.padEnd(40)} ceil ${before[id].ceil.toFixed(3)} > ${after[id].ceil.toFixed(3)}   range ${before[id].range.toFixed(3)} > ${after[id].range.toFixed(3)}   cont ${before[id].cont.toFixed(3)} > ${after[id].cont.toFixed(3)}`);
  const bad = rows.filter(r => !r.ok).length;
  console.log(bad ? `${bad} of ${rows.length} failed` : `all ${rows.length} pass`);
  return bad ? 1 : 0;
}

// ---- portal: the day gain on 12 portal-camera frames -----------------------------------------------------------------------------------
const PORTAL_HOUSES = ['aurora', 'cutestarter', 'seraphine', 'riverbend', 'lakecabin', 'mediterranean', 'mesamariposa', 'neweco', 'vanilla', 'modernhouse-nora', 'palnknoll', 'valleyview'];
/** the runtime variants L2 and L4 would build, applied in the page to the product tree as it is (the L2/L4 decision experiment; the product
 *  implementations are the commits L2 and L4, these are the design's day-v2 numbers) */
const VARIANTS: Record<string, string> = {
  base: '',
  bounce: `const seen = new Set(); let n = 0; d.scene.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.userData && o.material.userData.neutralIndirect && !seen.has(o.material)) { seen.add(o.material); const m = o.material; m.emissive.setHex(0xfff0dc); m.emissiveIntensity = 0.12; n++; } }); return { ceilMats: n };`,
  grade: `const fc = W.__houseComposer && W.__houseComposer(); if (!fc) return null; const u = fc.grade.uniforms; const pin = (obj, v) => Object.defineProperty(obj, 'value', { get: () => v, set: () => {}, configurable: true }); pin(u.contrast, 1.12); pin(u.saturation, 0.97); pin(u.vignette, 0.2); return { grade: true };`,
  ao: `const fc = W.__houseComposer && W.__houseComposer(); if (!fc) return null; fc.gtao.blendIntensity = 1.4; fc.gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1, thickness: 1, scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false }); return { ao: true };`,
};
VARIANTS.all = [VARIANTS.bounce, VARIANTS.grade, VARIANTS.ao].map(s => `(() => { ${s} })();`).join(' ') + ' return { all: true };';

async function portalMode(): Promise<number> {
  const houses = args.houses && args.houses !== 'true' ? args.houses.split(',') : PORTAL_HOUSES;
  const frames = (args.frames && args.frames !== 'true' ? args.frames : '1').split(',').map(Number);
  const variants = (args.variants && args.variants !== 'true' ? args.variants : 'base,bounce,grade,ao,all').split(',');
  for (const v of variants) if (!(v in VARIANTS)) { console.error(`unknown variant ${v} (${Object.keys(VARIANTS).join(', ')})`); return 2; }
  const label = args.label && args.label !== 'true' ? args.label : 'portal-day';
  const dir = out(label);
  const session = await startSession();
  const res: Record<string, Record<string, Luma>> = {};   // frame id -> variant -> metrics
  try {
    for (const house of houses) {
      // one throwaway context a house (a cold pipeline renders a hair differently), then a fresh page per variant: the patches pin
      // uniforms and write materials, so none carries to the next
      const burn = await session.open(house, { res: '360', tod: 'day' });
      try { await burn.page.evaluate(() => (window as any).__houseSnapshot({ res: '360', quality: 0.5 })); } finally { await burn.close(); }
      for (const variant of variants) {
        const w = await session.open(house, { res: '360', tod: 'day' });
        if (VARIANTS[variant]) await w.page.evaluate(async (src: string) => { const W = window as any, d = W.__houseDebug(); return await new Function('W', 'd', `return (async () => { ${src} })();`)(W, d); }, VARIANTS[variant]);
        await w.page.evaluate(() => (window as any).__houseComposerWarm({ res: '360' }));
        for (const t of frames) {
          const shot = await w.page.evaluate(([res, t]: any) => {
            const W = window as any, info = W.__houseRenderBegin({ shot: 'door-to-core', res, fps: 24 });
            const i = Math.round(t * (info.frames - 1));
            W.__houseRenderFrames(i, 1, 1.0);
            const gl = W.__houseDebug().renderer.getContext();
            const px = new Uint8Array(info.w * info.h * 4);
            gl.readPixels(0, 0, info.w, info.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
            W.__houseRenderEnd();
            let s = ''; for (let k = 0; k < px.length; k += 8192) s += String.fromCharCode.apply(null, px.subarray(k, k + 8192));
            return { w: info.w, h: info.h, b64: btoa(s) };
          }, ['360', t]);
          const raw = Buffer.from(shot.b64, 'base64');
          // bottom-up RGBA -> top-down RGB (luma's `ceil` reads the top rows)
          const rgb = new Uint8Array(shot.w * shot.h * 3);
          for (let y = 0; y < shot.h; y++) for (let x = 0; x < shot.w; x++) { const s = ((shot.h - 1 - y) * shot.w + x) * 4, o = (y * shot.w + x) * 3; rgb[o] = raw[s]; rgb[o + 1] = raw[s + 1]; rgb[o + 2] = raw[s + 2]; }
          const id = `${house}/door-to-core@${t}`;
          (res[id] ||= {})[variant] = roundLuma(lumaMetrics(rgb, shot.w, shot.h));
          console.log(`  ${id.padEnd(36)} ${variant.padEnd(7)} ceil ${res[id][variant].ceil.toFixed(3)}  range ${res[id][variant].range.toFixed(3)}  cont ${res[id][variant].cont.toFixed(3)}  clip ${res[id][variant].clip.toFixed(2)}`);
        }
        if (w.errors.length) console.error(`  page errors in ${house}: ${w.errors.slice(0, 2).join(' | ')}`);
        await w.close();
      }
    }
  } finally { await session.close(); }
  writeText(path.join(dir, 'portal-day.json'), stableJson({ schema: 1, what: 'day luma of the door-to-core film\'s frames under runtime variants (scripts/test-interior-light.mts --portal)', frames: res, machine: { ...machine() } }));
  // the table: median gain over BASE per variant
  const ids = Object.keys(res);
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  console.log(`\nday gain over base, ${ids.length} frames (median / min / max)`);
  for (const v of variants.filter(v => v !== 'base')) {
    const d = (k: keyof Luma) => ids.filter(i => res[i].base && res[i][v]).map(i => res[i][v][k] - res[i].base[k]);
    for (const k of ['ceil', 'range', 'cont'] as const) { const x = d(k); if (x.length) console.log(`  ${v.padEnd(7)} ${k.padEnd(6)} ${med(x).toFixed(3).padStart(7)}  ${Math.min(...x).toFixed(3).padStart(7)}  ${Math.max(...x).toFixed(3).padStart(7)}`); }
  }
  return 0;
}


// ---- hitch: the L1 spike ---------------------------------------------------------------------------------------------------------------
async function hitchMode(): Promise<number> {
  const houses = args.houses && args.houses !== 'true' ? args.houses.split(',') : ['aurora', 'riverbend'];
  const reps = Number(args.reps && args.reps !== 'true' ? args.reps : 3);
  const session = await startSession();
  const table: any[] = [];
  try {
    for (const house of houses) for (const policy of ['hide', 'zero'] as const) {
      const ctx = await session.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors: string[] = []; page.on('pageerror', (e: Error) => errors.push(e.message.split('\n')[0]));
      await page.route('https://fonts.googleapis.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await page.route('https://fonts.gstatic.com/**', (r: any) => r.abort());
      await page.addInitScript((hide: boolean) => { (window as any).__fillHide = hide; }, policy === 'hide');   // the policy is in force from the build, as shipped code would have it
      await page.goto(session.srv.url(`room-creator.html?mode=view&house=${house}&tod=day&play=0`), { waitUntil: 'domcontentloaded', timeout: 240000 });
      await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, house, { timeout: 240000 });
      const r = await page.evaluate(async ({ reps }: any) => {
        const W = window as any, d = W.__houseDebug(), R = d.renderer, gl = R.getContext(), px = new Uint8Array(4);
        const frame = () => { const t0 = performance.now(); R.render(d.scene, d.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; };
        const steady = (n = 12) => { const xs: number[] = []; for (let i = 0; i < n; i++) xs.push(frame()); xs.sort((a, b) => a - b); return xs[xs.length >> 1]; };
        let spots = 0, hidden = 0; d.scene.traverse((o: any) => { if (o.isSpotLight && o.userData.fixtureLight) { spots++; if (!o.visible) hidden++; } });
        const programs0 = R.info.programs.length;
        // the house was built (and the player has drawn it) at its own hour, day: the first night frame is the cold one
        const dayMs = steady();
        const out: any = { spots, hidden, programsDay: R.info.programs.length, dayMs, flips: [] };
        for (let k = 0; k < reps; k++) {
          W.__houseSetLighting('night'); const toNight = frame(); const nightMs = steady();
          W.__houseSetLighting('day'); const toDay = frame();
          out.flips.push({ toNight, toDay, nightMs });
        }
        out.programsAfter = R.info.programs.length; out.programs0 = programs0;
        return out;
      }, { reps });
      console.log(`${house.padEnd(10)} ${policy.padEnd(5)} spots ${r.spots} (${r.hidden} hidden)  programs ${r.programsDay} > ${r.programsAfter}  day frame ${r.dayMs.toFixed(1)} ms   first frame after the switch: ${r.flips.map((f: any) => `night ${f.toNight.toFixed(0)} / day ${f.toDay.toFixed(0)}`).join(' | ')}   (night steady ${r.flips[0].nightMs.toFixed(1)} ms)${errors.length ? '  ERR ' + errors[0] : ''}`);
      table.push({ house, policy, ...r });
      await ctx.close();
    }
  } finally { await session.close(); }
  writeText(out('hitch.json'), stableJson({ schema: 1, what: 'first frame after a time-of-day switch in the player, hide vs intensity 0 (scripts/test-interior-light.mts --hitch)', rows: table, machine: machine() }));
  const worst = Math.max(...table.filter(t => t.policy === 'hide').map(t => Math.max(...t.flips.map((f: any) => Math.max(f.toNight, f.toDay)))));
  console.log(`worst first frame under HIDE: ${worst.toFixed(0)} ms (limit 250 ms for hiding in the player)`);
  return 0;
}

// ---- player calls: the batcher's draw-call census ----------------------------------------------------------------------------------------
async function playerCallsMode(): Promise<number> {
  const houses = args.houses && args.houses !== 'true' ? args.houses.split(',') : ['aurora', 'cutestarter', 'seraphine', 'riverbend', 'lakecabin', 'mediterranean', 'mesamariposa', 'neweco', 'vanilla', 'modernhouse-nora', 'palnknoll', 'valleyview'];
  const label = args.label && args.label !== 'true' ? args.label : 'player-calls';
  const session = await startSession();
  const rows: Record<string, any> = {};
  try {
    for (const house of houses) {
      const ctx = await session.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.route('https://fonts.googleapis.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await page.route('https://fonts.gstatic.com/**', (r: any) => r.abort());
      await page.goto(session.srv.url(`room-creator.html?mode=view&house=${house}&tod=day&play=0`), { waitUntil: 'domcontentloaded', timeout: 240000 });
      await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, house, { timeout: 240000 });
      await page.waitForFunction(() => !!((window as any).__houseViewer && (window as any).__houseViewer.batch), null, { timeout: 60000 });
      const b = await page.evaluate(() => { const b = (window as any).__houseViewer.batch; return { before: b.before, after: b.after, meshesBefore: b.meshesBefore, meshesAfter: b.meshesAfter, materialsAfter: b.materialsAfter, merged: b.merged }; });
      rows[house] = b;
      console.log(`  ${house.padEnd(18)} draw calls ${String(b.before).padStart(5)} > ${String(b.after).padStart(5)}   meshes ${b.meshesBefore} > ${b.meshesAfter}   materials ${b.materialsAfter}`);
      await ctx.close();
    }
  } finally { await session.close(); }
  writeText(out(`${label}.json`), stableJson({ schema: 1, what: 'the player batcher\'s draw-call census (scripts/test-interior-light.mts --player-calls)', rows }));
  const after = Object.values(rows).map((r: any) => r.after).sort((a: number, b: number) => a - b);
  console.log(`median draw calls after batching: ${after[after.length >> 1]}   total ${after.reduce((a: number, b: number) => a + b, 0)}`);
  return 0;
}

let code = 0;
if (args['player-calls'] === 'true') code = await playerCallsMode();
else if (args.hitch === 'true') code = await hitchMode();
else if (args.portal === 'true') code = await portalMode();
else if (args.bench === 'true') code = await benchMode();
else code = await fixturesMode();
const bad = rows.filter(r => !r.ok).length;
if (args.portal !== 'true' && args.hitch !== 'true' && args['player-calls'] !== 'true') console.log(bad ? `\n${bad} of ${rows.length} rows failed` : `\nall ${rows.length} rows pass`);
console.log(`(load ${machine().load1})`);
process.exit(code);
