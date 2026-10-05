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
//   pnpm run test:light -- --hitch [--editor]  the L1 spike (--editor: the page without ?mode=view, the offline path): in the live player (?mode=view), how long the first frame after a time-of-day switch takes
//                                             when the room lights are HIDDEN while it is day (three recompiles every lit material, NUM_SPOT_LIGHTS
//                                             changes) against left in the scene at intensity 0. Policy lives in assets/fixtures.ts (hideOffGain);
//                                             this reports the numbers it was chosen on.   --houses a,b  --reps 3
//
//   pnpm run test:light -- --player-calls    the player's static batcher (assets/viewer-batch.ts): draw calls a frame issues for the whole home before and
//                                             after batching, per house, read from window.__houseViewer.batch. Run it on two trees (REVIEW_SERVE_ROOT=<tree>
//                                             serves another checkout) and compare: L2's tag on ceiling materials must cost at most +2 % median.
//                                             --houses a,b  --label <name>
//
//   pnpm run test:light -- --steady          the steady DAY frame time of the shipped off-light policy against the old hide policy, player or --editor, many-frame medians (LIGHT v3 item 6)
//   pnpm run test:light -- --closeups        GTAO thickness 1 against the shipped value on pendants, shades, curtains, plants, a stair and a chair (LIGHT v3 item 5)
//   pnpm run test:light -- --mood            night: the luma within 1.2 m of a lamp against the room's far wall, on the bench rooms (LIGHT v3 item 2; target 1.3 or more)
//   pnpm run test:light -- --lamps           the lamp census: every glowing lamp of every house by type, and which rooms have no pool (LIGHT v3 item 1)
//
//   pnpm run test:light -- --probe           (--corners NW,SE --rooms a,b --label <dir> --tune '{json}' (fixtures.ts tune hook) --env '{json}' (TIME_OF_DAY merge) --gtao '{json}' --variant grade|ao|all: with a runtime L4 variant) the bench without the provenance rules: the same cameras (from before.manifest.json) and the same 19 reads, on the
//                                             tree as it is, committed or not, for tuning a constant. Not a gate result (use --bench for that).   --tods dusk,night
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
const OUT_ROOT = path.join(REVIEW_DIR, 'after', args.stream && args.stream !== 'true' ? args.stream : 'light3');   // --stream light  reads LIGHT v1's old directory
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
/** per-fixture limits. The plan's numbers (night crush <= 12, dusk crush <= 3, day ceiling >= 0.60) were measured on living rooms and bedrooms; the kitchen
 *  fixture is black cabinetry on a black and white checker floor, which crushes by construction (its BEFORE was already 14 % at night, 6.7 % at dusk, and its
 *  camera sees a strip of ceiling between pendants), so it is judged at the level the lampless fill can honestly reach, and the number is the one to beat. */
const LIMITS: Record<string, { nightCrush: number; duskCrush: number; dayCeil: number }> = {
  'light-living-lamp': { nightCrush: 12, duskCrush: 3, dayCeil: 0.6 }, 'light-bed-lamp': { nightCrush: 12, duskCrush: 3, dayCeil: 0.6 },
  'light-kitchen-nolamp': { nightCrush: 20, duskCrush: 10, dayCeil: 0.5 }, 'light-bath-tile': { nightCrush: 12, duskCrush: 3, dayCeil: 0.6 },
};

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
      const L = LIMITS[id];
      say({ check: `night crush <= ${L.nightCrush}`, frame: `${id}/NW/night`, value: `${num(g('night').crush)} %`, limit: String(L.nightCrush), ok: g('night').crush <= L.nightCrush });
      say({ check: `dusk crush <= ${L.duskCrush}`, frame: `${id}/NW/dusk`, value: `${num(g('dusk').crush)} %`, limit: String(L.duskCrush), ok: g('dusk').crush <= L.duskCrush });
      say({ check: 'night ceiling luma >= 0.17', frame: `${id}/NW/night`, value: num(g('night').ceil, 3), limit: '0.17', ok: g('night').ceil >= 0.17 });
      say({ check: `day ceiling luma >= ${L.dayCeil}`, frame: `${id}/NW/day`, value: num(g('day').ceil, 3), limit: String(L.dayCeil), ok: g('day').ceil >= L.dayCeil });

      // structure of the light rig, read back off the page
      const info = await w.page.evaluate(async () => {
        const W = window as any, F = W.__houseFixtures, st = F.stats();
        const lights: any[] = []; W.__houseDebug().scene.traverse((o: any) => { if (o.isLight && !o.isDirectionalLight && !o.isHemisphereLight && !o.isAmbientLight) lights.push({ type: o.type, fixtureLight: !!o.userData.fixtureLight, pool: !!o.userData.lampPool, visible: o.visible, intensity: o.intensity, penumbra: o.penumbra, angle: o.angle, color: o.color.getHex(), distance: o.distance }); });
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
      // the rig's facts (L1: soft fill, L3: lamp pools), read off the lights of the page at dusk
      const spots = info.lights.filter((l: any) => l.type === 'SpotLight' && l.fixtureLight && !l.pool), pools = info.lights.filter((l: any) => l.pool);
      say({ check: 'fill spots: penumbra 1.0, cone <= 1.25 rad', frame: id, value: spots.map((l: any) => `${l.penumbra}/${round(l.angle, 2)}`).join(' '), limit: '1 / 1.25', ok: spots.length > 0 && spots.every((l: any) => l.penumbra === 1 && l.angle <= 1.25 + 1e-9) });
      say({ check: HAS_LAMP[id] ? 'lamp room: one pool' : 'lampless room: no pool', frame: id, value: String(pools.length), limit: HAS_LAMP[id] ? '1' : '0', ok: pools.length === (HAS_LAMP[id] ? 1 : 0) });
      if (HAS_LAMP[id]) say({ check: 'pool: a soft spot cone (penumbra 1, wide), falloff ends inside the room\'s diagonal', frame: id, value: `${pools[0]?.type} ${round(pools[0]?.angle ?? 0, 2)} rad, ${round(pools[0]?.distance ?? 0, 2)} m`, limit: '<= 0.8 x 6.7 m', ok: !!pools[0] && pools[0].type === 'SpotLight' && pools[0].penumbra === 1 && pools[0].distance <= 0.8 * Math.hypot(4.5, 5) + 1e-6 });
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
    for (const house of houses) for (const policy of (args.policies && args.policies !== 'true' ? args.policies : 'hide,cold,zero').split(',') as Array<'hide' | 'cold' | 'zero'>) {   // hide: shipped (hidden by day, night programs pre-warmed, waited for); cold: hidden, no pre-warm (v1); zero: intensity 0 in the loop (v2)
      const ctx = await session.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors: string[] = []; page.on('pageerror', (e: Error) => errors.push(e.message.split('\n')[0]));
      await page.route('https://fonts.googleapis.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await page.route('https://fonts.gstatic.com/**', (r: any) => r.abort());
      await page.addInitScript((p: string) => { (window as any).__fillZero = p === 'zero'; (window as any).__fillNoWarm = p === 'cold'; }, policy);   // the policy is in force from the build, as shipped code would have it
      await page.goto(session.srv.url(args.editor === 'true' ? `room-creator.html?house=${house}` : `room-creator.html?mode=view&house=${house}&tod=day&play=0`), { waitUntil: 'domcontentloaded', timeout: 240000 });
      await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, house, { timeout: 240000 });
      if (args.editor === 'true') await page.evaluate(() => (window as any).__houseSetLighting('day'));
      let warmMs = -1;
      if (policy === 'hide') { const t0 = Date.now(); await page.waitForFunction(() => { const w = (window as any).__houseFixturesWarm && (window as any).__houseFixturesWarm(); return !!(w && w.done); }, null, { timeout: 180000, polling: 250 }); warmMs = Date.now() - t0; }
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
      console.log(`${house.padEnd(10)} ${policy.padEnd(5)} ${warmMs >= 0 ? `[pre-warm done ${warmMs} ms after ready] ` : ''}spots ${r.spots} (${r.hidden} hidden)  programs ${r.programsDay} > ${r.programsAfter}  day frame ${r.dayMs.toFixed(1)} ms   first frame after the switch: ${r.flips.map((f: any) => `night ${f.toNight.toFixed(0)} / day ${f.toDay.toFixed(0)}`).join(' | ')}   (night steady ${r.flips[0].nightMs.toFixed(1)} ms)${errors.length ? '  ERR ' + errors[0] : ''}`);
      table.push({ house, policy, ...r });
      await ctx.close();
    }
  } finally { await session.close(); }
  writeText(out('hitch.json'), stableJson({ schema: 1, what: 'first frame after a time-of-day switch in the player, hide vs intensity 0 (scripts/test-interior-light.mts --hitch)', rows: table, machine: machine() }));
  const worstOf = (pol: string) => { const rows = table.filter(t => t.policy === pol); return rows.length ? Math.max(...rows.flatMap(t => t.flips.map((f: any) => Math.max(f.toNight, f.toDay)))) : NaN; };
  console.log(`worst first frame after the switch: shipped (hidden, pre-warmed) ${worstOf('hide').toFixed(0)} ms (target < 250 ms)   cold (hidden, no pre-warm: v1) ${worstOf('cold').toFixed(0)} ms   intensity 0 (v2) ${worstOf('zero').toFixed(0)} ms`);
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

// ---- probe: the bench on a dirty tree, for tuning ------------------------------------------------------------------------------------
async function probeMode(): Promise<number> {
  const m = loadManifest(path.join(BASELINES, 'before.manifest.json'));
  const before = readJson(path.join(BASELINES, 'before.metrics.json')).frames as Record<string, Luma>;
  const tods = new Set((args.tods && args.tods !== 'true' ? args.tods : 'day,dusk,night').split(','));
  const dir = out(args.label && args.label !== 'true' ? args.label : 'probe');
  const corners = new Set((args.corners && args.corners !== 'true' ? args.corners : 'NW').split(','));   // --corners NW,SE: both of the rig's cameras
  const rooms = args.rooms && args.rooms !== 'true' ? new Set(args.rooms.split(',')) : null;
  const shots = m.shots.filter(x => x.kind === 'eye' && BENCH_ROOMS.includes(x.room) && corners.has(x.corner) && tods.has(x.tod) && (!rooms || rooms.has(x.room)));
  const session = await startSession();
  const after: Record<string, Luma> = {};
  try {
    for (const house of [...new Set(shots.map(x => x.house))]) {
      const burn = await session.open(house, { res: RES });
      try { await burn.page.evaluate((r: string) => (window as any).__houseSnapshot({ res: r, quality: 0.5 }), RES); } finally { await burn.close(); }
      const w = await session.open(house, { res: RES, query: args.query && args.query !== 'true' ? args.query : '' });
      // --variant grade|ao|all: the runtime L4 variants of --portal, to read what they would add to the bench rooms (quantifying a row that L4 owns)
      if (args.variant && args.variant !== 'true') {
        if (!(args.variant in VARIANTS)) throw new Error(`unknown variant ${args.variant}`);
        await w.page.evaluate(async (src: string) => { const W = window as any, d = W.__houseDebug(); return await new Function('W', 'd', `return (async () => { ${src} })();`)(W, d); }, VARIANTS[args.variant]);
      }
      // --tune '{"poolI":9,"haloK":0.2}': fixtures.ts' QA hook, applied to the lights this page built
      if (args.tune && args.tune !== 'true') await w.page.evaluate((o: any) => (window as any).__houseFixtures.tune(o), JSON.parse(args.tune));
      // --env '{"night":{"hemi":{"intensity":0.8}}}': a deep merge into environment.ts TIME_OF_DAY on this page (the presets are plain data the page reads on every re-light)
      if (args.env && args.env !== 'true') await w.page.evaluate(async (o: any) => {
        const E: any = await import(String('./assets/environment.js'));
        const merge = (t: any, u: any) => { for (const k of Object.keys(u)) { if (u[k] && typeof u[k] === 'object' && !Array.isArray(u[k]) && t[k] && typeof t[k] === 'object') merge(t[k], u[k]); else t[k] = u[k]; } };
        merge(E.TIME_OF_DAY, o);
      }, JSON.parse(args.env));
      // --gtao '{"radius":0.55,"thickness":0.15,"blend":1.4}': the composer's GTAO pass on this page (room-creator.html composerFor sets the shipped numbers)
      if (args.gtao && args.gtao !== 'true') await w.page.evaluate((o: any) => { const fc = (window as any).__houseComposer(); if (!fc) throw new Error('no composer'); if (typeof o.blend === 'number') fc.gtao.blendIntensity = o.blend; fc.gtao.updateGtaoMaterial({ radius: o.radius ?? 0.8, distanceExponent: 1, thickness: o.thickness ?? 1, scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false }); }, JSON.parse(args.gtao));
      for (const tod of ['day', 'dusk', 'night']) {
        if (!tods.has(tod)) continue;
        await w.page.evaluate((t: string) => (window as any).__houseSetLighting(t), tod);
        for (const x of shots.filter(y => y.house === house && y.tod === tod)) {
          const url = await w.page.evaluate(({ cam, res, quality }: any) => {
            const W = window as any, d = W.__houseDebug(), c = d.camera;
            c.position.set(...cam.pos); c.lookAt(...cam.target); c.fov = cam.fov; c.near = cam.near; c.updateProjectionMatrix();
            return W.__houseSnapshot({ res, dressing: { walls: 'up', roof: 'on' }, quality });
          }, { cam: x.camera, res: RES, quality: QUALITY });
          const f = path.join(dir, x.file); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
          after[x.id] = roundLuma(lumaOfFile(f));
        }
      }
      await w.close();
    }
  } finally { await session.close(); }
  for (const r of lightAcceptance(before, after)) say({ check: r.check, frame: r.frame, value: num(r.value, 3), limit: r.limit, ok: r.ok });
  const bad = rows.filter(r => !r.ok).length; console.log(bad ? `${bad} of ${rows.length} failed` : `all ${rows.length} pass`);
  return 0;
}


// ---- leak: does a room's light stay in its room? ------------------------------------------------------------------------------------------
// LIGHT v2 item 2. For every room of every house (or --houses a,b), at night, from the room's NW corner camera (the rig's), three plain renders
// of the same state: everything on; every OTHER room's lamp pools at intensity 0; every other room's light of any kind at 0. A world-position
// pass of the same frame says which pixels are the room's own surfaces (its box shrunk by 1 cm: walls are centred on the room bounds, so the room's own wall face is 6-8 cm inside them and the next room's as far outside, and the end cap of a wall at an opening belongs to neither), and only those are
// judged: a room seen through an opening is not the room (its own pool lights it, legitimately), and neither is a surface where two rooms' rectangles overlap (an authored 20 cm overlap puts one room's sofa inside the next). The mask is eroded by a pixel (the canvas is multisampled, the position pass is not: a slat screen or a balustrade would otherwise count its
// own anti-aliased edge against the room behind it). A pixel CHANGED when a channel moved by 3 of 255 or more in the tone-mapped 8-bit frame. Limits (the task's acceptance): <= 1 % of a lampless room's pixels, <= 3 % of a lamp room's.
//   pnpm run test:light -- --leak [--houses a,b] [--tod night] [--stream <dir>] [--min-px 1500] [--query no=roomclip]
const LEAK_T = 3;
async function leakMode(): Promise<number> {
  const all = fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map(f => f.replace(/\.json$/, '')).sort();
  const houses = args.houses && args.houses !== 'true' ? args.houses.split(',') : all;
  const tod = args.tod && args.tod !== 'true' ? args.tod : 'night';
  const minPx = Number(args['min-px'] && args['min-px'] !== 'true' ? args['min-px'] : 1500);
  const session = await startSession();
  const result: any[] = [];
  try {
    for (const house of houses) {
      const w = await session.open(house, { res: '360', composer: false, query: args.query && args.query !== 'true' ? args.query : '' });
      await w.page.evaluate((t: string) => (window as any).__houseSetLighting(t), tod);
      const rooms: any[] = await w.page.evaluate(() => {
        const d = (window as any).__houseDebug(), s = d.house.spec, out: any[] = [];
        s.levels.forEach((lv: any) => (lv.rooms || []).forEach((r: any, ri: number) => out.push({ key: `${lv.id}#${ri}`, lv: lv.id, name: r.name, program: r.program || null, y: lv.y || 0, H: lv.height || 3, b: { x: r.bounds.x, z: r.bounds.z, w: r.bounds.w, d: r.bounds.d } })));
        return out;
      });
      const pools: string[] = await w.page.evaluate(() => { const o: string[] = []; (window as any).__houseDebug().scene.traverse((l: any) => { if (l.isLight && l.userData.lampPool) o.push(l.userData.roomKey); }); return o; });
      let nPool = 0;
      for (const r of rooms) {
        if (r.program === 'outdoor' || r.b.w * r.b.d < 2.5) continue;
        if (args.room && args.room !== 'true' && args.room !== r.name) continue;
        const cam = cornerCam(r.b, r.y, 'NW');
        const m: any = await w.page.evaluate(({ cam, key, box, others, T, res, eachPool }: any) => {
          const W = window as any, d = W.__houseDebug(), renderer = d.renderer, scene = d.scene, TH = W.__THREE, c = d.camera;
          c.position.set(...cam.pos); c.lookAt(...cam.target); c.fov = cam.fov; c.near = cam.near; c.updateProjectionMatrix();
          const lights: any[] = []; scene.traverse((o: any) => { if (o.isLight && o.userData.fixtureLight) lights.push(o); });
          const base = new Map(lights.map(l => [l, l.intensity]));
          const set = (kind: string) => { for (const l of lights) { const mine = l.userData.roomKey === key; l.intensity = !mine && (kind === 'all' || (kind === 'pools' && l.userData.lampPool)) ? 0 : base.get(l); } };
          const orig = renderer.render;
          let res_: any = null;
          (renderer as any).render = (s: any, cm: any) => {
            (renderer as any).render = orig;
            const gl = renderer.getContext(), cv = renderer.domElement, Wd = cv.width, Hd = cv.height;
            const grab = () => { const px = new Uint8Array(Wd * Hd * 4); gl.readPixels(0, 0, Wd, Hd, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
            set('none'); orig.call(renderer, s, cm); const A = grab();
            set('pools'); orig.call(renderer, s, cm); const B = grab();
            set('all'); orig.call(renderer, s, cm); const C = grab();
            set('none');
            // the world position of every pixel
            const rt = new TH.WebGLRenderTarget(Wd, Hd, { type: TH.FloatType, format: TH.RGBAFormat, depthBuffer: true, minFilter: TH.NearestFilter, magFilter: TH.NearestFilter });
            const pm = new TH.MeshBasicMaterial({ fog: false });
            pm.onBeforeCompile = (sh: any) => {
              sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vhPos;').replace('#include <project_vertex>', '#include <project_vertex>\nvec4 vhw = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\nvhw = instanceMatrix * vhw;\n#endif\nvhw = modelMatrix * vhw; vhPos = vhw.xyz;');
              sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vhPos;').replace('#include <opaque_fragment>', 'gl_FragColor = vec4( vhPos, 1.0 );');
            };
            const prevOverride = scene.overrideMaterial, prevFog = scene.fog, prevBg = scene.background, prevTone = renderer.toneMapping;
            scene.overrideMaterial = pm; scene.fog = null; scene.background = null; renderer.toneMapping = TH.NoToneMapping;
            // a see-through surface (window glass, a 10 % overlay plane) is not what the pixel shows: hide it, so the position is the opaque surface behind
            const seeThrough: any[] = [];
            scene.traverse((o: any) => { if (!o.isMesh || !o.visible) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; if (ms.some((m: any) => m && ((m.transparent && m.opacity < 0.95) || (m.transmission || 0) > 0))) { seeThrough.push(o); o.visible = false; } });
            renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); orig.call(renderer, s, cm);
            for (const o of seeThrough) o.visible = true;
            const P = new Float32Array(Wd * Hd * 4); renderer.readRenderTargetPixels(rt, 0, 0, Wd, Hd, P);
            renderer.setRenderTarget(null); scene.overrideMaterial = prevOverride; scene.fog = prevFog; scene.background = prevBg; renderer.toneMapping = prevTone; rt.dispose(); pm.dispose();
            const PAD = -0.01, mask = new Uint8Array(Wd * Hd);
            let inMask = 0;
            for (let i = 0; i < Wd * Hd; i++) {
              if (P[i * 4 + 3] < 0.5) continue;
              const x = P[i * 4], y = P[i * 4 + 1], z = P[i * 4 + 2];
              if (x < box.x0 - PAD || x > box.x1 + PAD || z < box.z0 - PAD || z > box.z1 + PAD || y < box.y0 - 0.02 || y > box.y1 - 0.005) continue;
              if (others.some((o: any) => x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1)) continue;   // where two rooms' rectangles overlap the surface is not one room's
              mask[i] = 1;
            }
            // one pixel in from the room's silhouette: the canvas is multisampled and the position pass is not, so a pixel on the edge of a see-through
            // boundary (a slat screen, a balustrade, a window frame) blends the next room's lit surface behind it into the room's own surface
            const keep = new Uint8Array(Wd * Hd);
            for (let yy = 1; yy < Hd - 1; yy++) for (let xx = 1; xx < Wd - 1; xx++) {
              const i = yy * Wd + xx;
              if (mask[i] && mask[i - 1] && mask[i + 1] && mask[i - Wd] && mask[i + Wd] && mask[i - Wd - 1] && mask[i - Wd + 1] && mask[i + Wd - 1] && mask[i + Wd + 1]) { keep[i] = 1; inMask++; }
            }
            mask.set(keep);
            const samples: number[][] = [];
            const diff = (X: Uint8Array) => { let chg = 0, sum = 0, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, minY = 1e9, maxY = -1e9; for (let i = 0; i < Wd * Hd; i++) { if (!mask[i]) continue; const d = Math.max(Math.abs(A[i * 4] - X[i * 4]), Math.abs(A[i * 4 + 1] - X[i * 4 + 1]), Math.abs(A[i * 4 + 2] - X[i * 4 + 2])); sum += d; if (d >= T) { chg++; if (X !== B && X !== C && samples.length < 400 && chg % 17 === 0) samples.push([P[i * 4], P[i * 4 + 1], P[i * 4 + 2], d]); minX = Math.min(minX, P[i * 4]); maxX = Math.max(maxX, P[i * 4]); minY = Math.min(minY, P[i * 4 + 1]); maxY = Math.max(maxY, P[i * 4 + 1]); minZ = Math.min(minZ, P[i * 4 + 2]); maxZ = Math.max(maxZ, P[i * 4 + 2]); } } return { chg, sum, where: chg ? [minX, maxX, minY, maxY, minZ, maxZ].map(v => Math.round(v * 100) / 100) : null }; };
            const dp = diff(B), da = diff(C);
            let chgFrame = 0; for (let i = 0; i < Wd * Hd; i++) if (Math.max(Math.abs(A[i * 4] - B[i * 4]), Math.abs(A[i * 4 + 1] - B[i * 4 + 1]), Math.abs(A[i * 4 + 2] - B[i * 4 + 2])) >= T) chgFrame++;
            const each: any[] = [];
            if (eachPool) for (const l of lights) {
              if (!l.userData.lampPool || l.userData.roomKey === key) continue;
              for (const o of lights) o.intensity = o === l ? 0 : base.get(o);
              orig.call(renderer, s, cm); const X = grab(); const r = diff(X);
              let hit: any = null;
              if (r.chg && samples.length) {
                const sp = samples[0], dir = new TH.Vector3(sp[0], sp[1], sp[2]).sub(c.position).normalize(), rc = new TH.Raycaster(c.position.clone(), dir, 0.05, 80);
                const hs = rc.intersectObjects(scene.children, true).filter((h: any) => h.object.isMesh && h.object.visible);
                if (hs[0]) { const o = hs[0].object, mm = Array.isArray(o.material) ? o.material[0] : o.material; hit = { name: o.name, parent: o.parent && o.parent.name, type: mm.type, transmission: mm.transmission || 0, transparent: !!mm.transparent, opacity: mm.opacity, side: mm.side, ud: Object.keys(o.userData || {}).join(','), dist: +hs[0].distance.toFixed(2), pt: hs[0].point.toArray().map((v: number) => Math.round(v * 100) / 100) }; }
              }
              if (r.chg) each.push({ roomKey: l.userData.roomKey, chg: r.chg, hit, samples: samples.splice(0, 12).map(v => v.map((q: number) => Math.round(q * 100) / 100)), where: r.where, at: l.position.toArray().map((v: number) => Math.round(v * 100) / 100) });
            }
            res_ = { total: Wd * Hd, inMask, chgPools: dp.chg, chgAll: da.chg, chgFrame, meanPools: inMask ? dp.sum / inMask : 0, meanAll: inMask ? da.sum / inMask : 0, where: dp.where, each };
          };
          W.__housePlainRender = true;
          try { W.__houseSnapshot({ res, dressing: { walls: 'up', roof: 'on' }, quality: 0.3 }); } finally { W.__housePlainRender = false; (renderer as any).render = orig; for (const [l, v] of base) l.intensity = v; }
          return res_;
        }, { cam, key: r.key, box: { x0: r.b.x, x1: r.b.x + r.b.w, z0: r.b.z, z1: r.b.z + r.b.d, y0: r.y, y1: r.y + r.H }, others: rooms.filter(o => o.lv === r.lv && o.key !== r.key && o.program !== 'outdoor').map(o => ({ x0: o.b.x, x1: o.b.x + o.b.w, z0: o.b.z, z1: o.b.z + o.b.d })), T: LEAK_T, res: '360', eachPool: args.each === 'true' });
        const lamp = pools.includes(r.key); if (lamp) nPool++;
        const row = { house, room: r.name, level: r.lv, key: r.key, lamp, ...m, pctPools: m.inMask ? 100 * m.chgPools / m.inMask : 0, pctAll: m.inMask ? 100 * m.chgAll / m.inMask : 0 };
        result.push(row);
        if (args.each === 'true' && m.each.length) console.log(`    ${house}/${r.name} (${r.key}): changed by`, JSON.stringify(m.each), 'in', JSON.stringify(m.where));
        if (m.inMask < minPx) continue;
        const lim = lamp ? 3 : 1;
        say({ check: `other rooms' pools: <= ${lim} % of the ${lamp ? 'lamp' : 'lampless'} room's pixels change`, frame: `${house}/${r.name}`, value: `${num(row.pctPools, 2)} % of ${m.inMask} px (all other lights ${num(row.pctAll, 2)} %)`, limit: String(lim), ok: row.pctPools <= lim });
      }
      if (w.errors.length) say({ check: 'no page errors', frame: house, value: w.errors[0], limit: 'none', ok: false });
      console.log(`  ${house}: ${rooms.length} rooms, ${nPool} lamp rooms with a pool`);
      await w.close();
    }
  } finally { await session.close(); }
  writeText(out('leak.json'), stableJson({ schema: 1, what: 'does a room\'s light stay in its room (scripts/test-interior-light.mts --leak)', tod, threshold: LEAK_T, rows: result, machine: machine() }));
  const judged = result.filter(r => r.inMask >= minPx);
  const worst = (xs: any[], k: string) => xs.reduce((a, r) => Math.max(a, r[k]), 0);
  const lampRooms = judged.filter(r => r.lamp), lampless = judged.filter(r => !r.lamp);
  console.log(`\n${result.length} rooms, ${judged.length} judged (>= ${minPx} px of the room's own surfaces), ${result.filter(r => r.lamp).length} with a pool`);
  console.log(`  lamp rooms    ${lampRooms.length}: worst ${num(worst(lampRooms, 'pctPools'), 2)} % (pools only), ${num(worst(lampRooms, 'pctAll'), 2)} % (all other lights)   limit 3 %`);
  console.log(`  lampless      ${lampless.length}: worst ${num(worst(lampless, 'pctPools'), 2)} % (pools only), ${num(worst(lampless, 'pctAll'), 2)} % (all other lights)   limit 1 %`);
  const badRooms = rows.filter(r => !r.ok).length;
  console.log(badRooms ? `${badRooms} of ${rows.length} room rows failed` : `all ${rows.length} room rows pass`);
  return badRooms ? 1 : 0;
}


// ---- lamps: the census of every lamp a built house has, and whether its room is lit by it ----------------------------------------------
// LIGHT v3 item 1. For every house (or --houses a,b), at night: each placed item that carries a glowing part tagged userData.fixture = 'lamp' and
// is not hung from a ceiling (pendants, chandeliers, string lights are the room fill's), by type, in its room; and for each room that has one,
// whether the room has a lamp pool (a light with userData.lampPool). A room with a glowing lamp and no pool is "unlit by its lamp": it must be 0,
// or the room is one of those the 16-light cap leaves out (reported separately: `capped`). Writes <out>/lamps.json.
//   pnpm run test:light -- --lamps [--houses a,b]
async function lampsMode(): Promise<number> {
  const all = fs.readdirSync(path.join(ROOT, 'content', 'houses')).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map(f => f.replace(/\.json$/, '')).sort();
  const houses = args.houses && args.houses !== 'true' ? args.houses.split(',') : all;
  const session = await startSession();
  const result: any[] = [];
  const byType: Record<string, { items: number; pooled: number }> = {};
  try {
    for (const house of houses) {
      const w = await session.open(house, { res: '360', composer: false });
      await w.page.evaluate(() => (window as any).__houseSetLighting('night'));
      const r: any = await w.page.evaluate(() => {
        const W = window as any, d = W.__houseDebug(), spec = d.house.spec, st = W.__houseFixtures.stats();
        const rooms: any[] = [];
        spec.levels.forEach((lv: any) => (lv.rooms || []).forEach((rm: any, ri: number) => rooms.push({ key: `${lv.id}#${ri}`, name: rm.name, y: lv.y || 0, H: lv.height || 3, program: rm.program || null, b: rm.bounds })));
        const roomAt = (o: any, wp: any) => {
          const c = rooms.filter(r => r.b && wp.x >= r.b.x - 0.05 && wp.x <= r.b.x + r.b.w + 0.05 && wp.z >= r.b.z - 0.05 && wp.z <= r.b.z + r.b.d + 0.05 && wp.y > r.y - 0.1 && wp.y < r.y + r.H);
          return c.find((r: any) => r.name === o.userData.room) || c[0] || null;
        };
        const items: any[] = [];
        d.scene.traverse((o: any) => {
          const u = o.userData || {}; if (!u.itemType || u.role !== 'item') return;
          let glow = 0; o.traverse((m: any) => { if (m.isMesh && m.userData && m.userData.fixture === 'lamp') glow++; });
          if (!glow) return;
          const wp = o.getWorldPosition(new (o.position.constructor)());
          const rm = roomAt(o, wp);
          items.push({ type: u.itemType, name: o.name, room: rm ? rm.key : null, roomName: rm ? rm.name : u.room, program: rm ? rm.program : null, x: +wp.x.toFixed(2), y: +wp.y.toFixed(2), z: +wp.z.toFixed(2) });
        });
        const pools = new Set<string>(), lit = new Set<string>();
        d.scene.traverse((l: any) => { if (l.isLight && l.userData.fixtureLight) { lit.add(l.userData.roomKey); if (l.userData.lampPool) pools.add(l.userData.roomKey); } });
        return { items, pools: [...pools], lit: [...lit], lights: st ? st.lights.length : 0, poolTypes: W.__houseFixtures.lampTypes ? W.__houseFixtures.lampTypes() : [] };
      });
      const hung = new Set(['pendant-lamp', 'chandelier', 'ceiling-light', 'string-lights']);
      // a wall sconce glows and hangs on a wall: the room's fill is its light (fixtures.ts SCONCES), so it is counted apart; a free-standing lamp type that glows
      // and is NOT in fixtures.ts POOL_LAMPS is a miss and fails the run
      const sconce = new Set(['wall-sconce']);
      const poolTypes = new Set<string>(r.poolTypes);
      const missed = r.items.filter((i: any) => !hung.has(i.type) && !sconce.has(i.type) && !poolTypes.has(i.type));
      if (missed.length) say({ check: 'every glowing free-standing lamp type is a pool lamp', frame: house, value: [...new Set(missed.map((i: any) => i.type))].join(','), limit: 'none missed', ok: false });
      const lamps = r.items.filter((i: any) => !hung.has(i.type) && !sconce.has(i.type));
      const sconces = r.items.filter((i: any) => sconce.has(i.type));
      const roomKeys = [...new Set(lamps.map((i: any) => i.room))] as string[];
      const poolSet = new Set<string>(r.pools), litSet = new Set<string>(r.lit);
      const noPool = roomKeys.filter(k => k && !poolSet.has(k));
      const capped = noPool.filter(k => !litSet.has(k));
      for (const i of lamps) { const t = (byType[i.type] ||= { items: 0, pooled: 0 }); t.items++; if (i.room && poolSet.has(i.room)) t.pooled++; }
      result.push({ house, lights: r.lights, lampRooms: roomKeys.length, pooled: roomKeys.filter(k => poolSet.has(k)).length, noPool: noPool.length, capped: capped.length, sconces: sconces.length, sconceRooms: [...new Set(sconces.map((i: any) => i.room))].filter(k => k && !roomKeys.includes(k as string)).length, sconceUnlit: [...new Set(sconces.map((i: any) => i.room))].filter(k => k && !roomKeys.includes(k as string) && !litSet.has(k as string)).length, noPoolRooms: noPool.map(k => ({ key: k, capped: !litSet.has(k), types: [...new Set(lamps.filter((i: any) => i.room === k).map((i: any) => i.type))] })), items: lamps, hungOnly: r.items.length - lamps.length });
      const rr = result[result.length - 1];
      console.log(`  ${house.padEnd(20)} lights ${String(rr.lights).padStart(2)}  lamp rooms ${String(rr.lampRooms).padStart(2)}  with a pool ${String(rr.pooled).padStart(2)}  without ${String(rr.noPool).padStart(2)} (capped out ${rr.capped})  lamp items ${lamps.length}  sconces ${sconces.length} (${rr.sconceRooms} sconce-only rooms, ${rr.sconceUnlit} with no light)`);
      if (w.errors.length) say({ check: 'no page errors', frame: house, value: w.errors[0], limit: 'none', ok: false });
      await w.close();
    }
  } finally { await session.close(); }
  writeText(out('lamps.json'), stableJson({ schema: 1, what: 'the lamp census (scripts/test-interior-light.mts --lamps)', byType, rows: result, machine: machine() }));
  console.log('\nby type (items / in a room with a pool):'); for (const [t, v] of Object.entries(byType).sort()) console.log(`  ${t.padEnd(20)} ${String(v.items).padStart(4)} / ${v.pooled}`);
  const tot = (k: string) => result.reduce((a, r) => a + r[k], 0);
  console.log(`\n${tot('sconceRooms')} rooms have only wall sconces: ${tot('sconceRooms') - tot('sconceUnlit')} are lit by their fill, ${tot('sconceUnlit')} are left out by the ${LIGHT_CAP}-light cap`);
  console.log(`${result.length} houses: ${tot('lampRooms')} rooms with a glowing free-standing lamp, ${tot('pooled')} with a pool, ${tot('noPool')} without (${tot('capped')} of them left out by the ${LIGHT_CAP}-light cap), max lights ${Math.max(...result.map(r => r.lights))}`);
  return tot('noPool') - tot('capped') > 0 ? 1 : 0;
}


// ---- mood: how much of a lamp's pool there is against the room, at night ------------------------------------------------------------------
// LIGHT v3 item 2. For each bench room that has a lamp pool, from the rig's two corner cameras at night: the mean luma (Rec. 709 of the tone-mapped 8-bit
// frame, plain render: no GTAO, bloom or grade) of the room's own surfaces within 1.2 m of the lamp head (outside 0.3 m, so the glowing shade itself is not
// counted), against the mean luma of the room's FAR WALL: the wall pixels (within 12 cm of a plane of the room's bounds, 0.3 to 2.2 m up) that are among the
// farthest quarter from the lamp. Target: near / far >= 1.3 in a lamp room at night. A frame where fewer than 400 px of either class are seen is "not seen"
// and reported, not judged. World positions come from the same position pass as --leak. Which lamp: the pool light's own position (the lamp head).
//   pnpm run test:light -- --mood [--rooms a,b] [--tod night] [--tune '{json}'] [--env '{json}']
async function moodMode(): Promise<number> {
  const tod = args.tod && args.tod !== 'true' ? args.tod : 'night';
  const only = args.rooms && args.rooms !== 'true' ? new Set(args.rooms.split(',')) : null;
  const rooms = R24.filter(r => r.bench && (!only || only.has(r.id)));
  // --tune '{json}' once, or --sweep '[{json},{json}]': each applied in turn to the same page (a tune sets only the keys it names, so a sweep entry lists all it changes)
  const tunes: any[] = args.sweep && args.sweep !== 'true' ? JSON.parse(args.sweep) : args.tune && args.tune !== 'true' ? [JSON.parse(args.tune)] : [null];
  const session = await startSession();
  const res: any[] = [];
  try {
    for (const house of [...new Set(rooms.map(r => r.house))]) {
      const w = await session.open(house, { res: '360', composer: false });
      if (args.env && args.env !== 'true') await w.page.evaluate(async (o: any) => { const E: any = await import(String('./assets/environment.js')); const merge = (t: any, u: any) => { for (const k of Object.keys(u)) { if (u[k] && typeof u[k] === 'object' && !Array.isArray(u[k]) && t[k] && typeof t[k] === 'object') merge(t[k], u[k]); else t[k] = u[k]; } }; merge(E.TIME_OF_DAY, o); }, JSON.parse(args.env));
      await w.page.evaluate((t: string) => (window as any).__houseSetLighting(t), tod);
      const allRooms = await roomsOf(w.page);
      for (const [ti, tune] of tunes.entries()) {
      if (tune) await w.page.evaluate((o: any) => (window as any).__houseFixtures.tune(o), tune);
      const label = tunes.length > 1 || tune ? `#${ti}` : '';
      for (const r of rooms.filter(x => x.house === house)) {
        const room = allRooms.find(x => x.name === r.room);
        if (!room) throw new Error(`${r.id}: no room ${r.room}`);
        for (const corner of ['NW', 'SE'] as const) {
          const cam = cornerCam(room.b, room.y, corner);
          const m: any = await w.page.evaluate(({ cam, key, box }: any) => {
            const W = window as any, d = W.__houseDebug(), renderer = d.renderer, scene = d.scene, TH = W.__THREE, c = d.camera;
            c.position.set(...cam.pos); c.lookAt(...cam.target); c.fov = cam.fov; c.near = cam.near; c.updateProjectionMatrix();
            let head: any = null; scene.traverse((o: any) => { if (o.isLight && o.userData.lampPool && o.userData.roomKey === key) head = o.getWorldPosition(new TH.Vector3()); });
            if (!head) return { noPool: true };
            const orig = renderer.render; let out: any = null;
            (renderer as any).render = (s: any, cm: any) => {
              (renderer as any).render = orig;
              const gl = renderer.getContext(), cv = renderer.domElement, Wd = cv.width, Hd = cv.height;
              orig.call(renderer, s, cm);
              const A = new Uint8Array(Wd * Hd * 4); gl.readPixels(0, 0, Wd, Hd, gl.RGBA, gl.UNSIGNED_BYTE, A);
              // the same frame with this room's pool off: what the lamp adds to the same surfaces (albedo cancels)
              const poolL: any[] = []; scene.traverse((o: any) => { if (o.isLight && o.userData.lampPool && o.userData.roomKey === key) poolL.push(o); });
              const I0 = poolL.map(l => l.intensity); for (const l of poolL) l.intensity = 0;
              orig.call(renderer, s, cm);
              const Z = new Uint8Array(Wd * Hd * 4); gl.readPixels(0, 0, Wd, Hd, gl.RGBA, gl.UNSIGNED_BYTE, Z);
              poolL.forEach((l, i) => { l.intensity = I0[i]; });
              const rt = new TH.WebGLRenderTarget(Wd, Hd, { type: TH.FloatType, format: TH.RGBAFormat, depthBuffer: true, minFilter: TH.NearestFilter, magFilter: TH.NearestFilter });
              const pm = new TH.MeshBasicMaterial({ fog: false });
              pm.onBeforeCompile = (sh: any) => {
                sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vhPos;').replace('#include <project_vertex>', '#include <project_vertex>\nvec4 vhw = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\nvhw = instanceMatrix * vhw;\n#endif\nvhw = modelMatrix * vhw; vhPos = vhw.xyz;');
                sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vhPos;').replace('#include <opaque_fragment>', 'gl_FragColor = vec4( vhPos, 1.0 );');
              };
              const prevOverride = scene.overrideMaterial, prevFog = scene.fog, prevBg = scene.background, prevTone = renderer.toneMapping;
              scene.overrideMaterial = pm; scene.fog = null; scene.background = null; renderer.toneMapping = TH.NoToneMapping;
              const seeThrough: any[] = [];
              scene.traverse((o: any) => { if (!o.isMesh || !o.visible) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; if (ms.some((mm: any) => mm && ((mm.transparent && mm.opacity < 0.95) || (mm.transmission || 0) > 0))) { seeThrough.push(o); o.visible = false; } });
              renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); orig.call(renderer, s, cm);
              for (const o of seeThrough) o.visible = true;
              const P = new Float32Array(Wd * Hd * 4); renderer.readRenderTargetPixels(rt, 0, 0, Wd, Hd, P);
              renderer.setRenderTarget(null); scene.overrideMaterial = prevOverride; scene.fog = prevFog; scene.background = prevBg; renderer.toneMapping = prevTone; rt.dispose(); pm.dispose();
              const lum = (i: number, B: Uint8Array = A) => { const f = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(B[i * 4]) + 0.7152 * f(B[i * 4 + 1]) + 0.0722 * f(B[i * 4 + 2]); };
              const walls: Array<{ l: number; dist: number }> = [], near: number[] = [], nearOff: number[] = [];
              for (let i = 0; i < Wd * Hd; i++) {
                if (P[i * 4 + 3] < 0.5) continue;
                const x = P[i * 4], y = P[i * 4 + 1], z = P[i * 4 + 2];
                if (x < box.x0 - 0.01 || x > box.x1 + 0.01 || z < box.z0 - 0.01 || z > box.z1 + 0.01 || y < box.y0 - 0.02 || y > box.y1 - 0.005) continue;
                const d3 = Math.hypot(x - head.x, y - head.y, z - head.z);
                if (d3 >= 0.3 && d3 <= 1.2) { near.push(lum(i)); nearOff.push(lum(i, Z)); }
                const onWall = Math.min(x - box.x0, box.x1 - x, z - box.z0, box.z1 - z) < 0.12 && y > box.y0 + 0.3 && y < box.y0 + 2.2;
                if (onWall) walls.push({ l: lum(i), dist: Math.hypot(x - head.x, z - head.z) });
              }
              walls.sort((a, b) => a.dist - b.dist);
              const far = walls.slice(Math.floor(walls.length * 0.75));
              const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
              out = { nearN: near.length, near: mean(near), nearOff: mean(nearOff), farN: far.length, far: mean(far.map(f => f.l)), allWallsN: walls.length };
            };
            W.__housePlainRender = true;
            try { W.__houseSnapshot({ res: '720', dressing: { walls: 'up', roof: 'on' }, quality: 0.3 }); } finally { W.__housePlainRender = false; (renderer as any).render = orig; }
            return out;
          }, { cam, key: `${room.lv}#${allRooms.filter(x => x.lv === room.lv).findIndex(x => x.name === room.name)}`, box: { x0: room.b.x, x1: room.b.x + room.b.w, z0: room.b.z, z1: room.b.z + room.b.d, y0: room.y, y1: room.y + 3 } });
          const row = { room: r.id + label, corner, tod, tune: tune || null, ...m, ratio: m && m.far > 0 && m.nearN >= 400 && m.farN >= 400 ? m.near / m.far : null };
          res.push(row);
          if (m.noPool) console.log(`  ${(r.id + label).padEnd(26)} ${corner}  no lamp pool (a fill room)`);
          else console.log(`  ${(r.id + label).padEnd(26)} ${corner}  near ${m.near.toFixed(3)} (${m.nearN} px)  far wall ${m.far.toFixed(3)} (${m.farN} px)  ratio ${row.ratio === null ? 'not seen' : row.ratio.toFixed(2)}`);
        }
      }
      }
      await w.close();
    }
  } finally { await session.close(); }
  writeText(out(`mood-${tod}.json`), stableJson({ schema: 1, what: 'pool against far wall (scripts/test-interior-light.mts --mood)', rows: res }));
  // judged per room over both corners (pixel-weighted): one corner often sees the lamp's back or a dark piece of furniture beside it
  for (const id of [...new Set(res.filter(r => !r.noPool).map(r => r.room))]) {
    const rs = res.filter(r => r.room === id && !r.noPool && r.nearN >= 400 && r.farN >= 400);
    if (!rs.length) { console.log(`  ${id}: not seen well enough to judge`); continue; }
    const wm = (k: string, n: string) => rs.reduce((a, r) => a + r[k] * r[n], 0) / rs.reduce((a, r) => a + r[n], 0);
    const near = wm('near', 'nearN'), far = wm('far', 'farN'), off = wm('nearOff', 'nearN');
    console.log(`  ${id.padEnd(26)} both corners: near ${near.toFixed(3)}  far wall ${far.toFixed(3)}  pool gain on the same surfaces ${(near / Math.max(off, 1e-6)).toFixed(2)}x`);
    say({ check: `${tod}: lamp pool / far wall luma >= 1.3`, frame: id, value: `${(near / far).toFixed(2)} (pool adds ${(near / Math.max(off, 1e-6)).toFixed(2)}x)`, limit: '1.3', ok: near / far >= 1.3 });
  }
  return rows.some(r => !r.ok) ? 1 : 0;
}


// ---- closeups: does the GTAO retune put a halo round anything thin? ------------------------------------------------------------------------
// LIGHT v3 item 5. Pendants, lamp shades, curtains, plants, a stair and a chair, each from 1-2 m, by day and at night, rendered through the composer with the shipped
// GTAO thickness and with the old one (1); the pair side by side and an amplified difference go to <out>/closeups/. A halo is a LIGHTER outline: the sheet is for the eye.
//   pnpm run test:light -- --closeups [--houses aurora,seraphine,cutestarter]
async function closeupsMode(): Promise<number> {
  const houses = args.houses && args.houses !== 'true' ? args.houses.split(',') : ['aurora', 'seraphine', 'cutestarter'];
  const dir = out('closeups'); fs.mkdirSync(dir, { recursive: true });
  const session = await startSession();
  const manifest: any[] = [];
  try {
    for (const house of houses) {
      const w = await session.open(house, { res: RES });
      const targets: any[] = await w.page.evaluate(() => {
        const d = (window as any).__houseDebug(), scene = d.scene, TH = (window as any).__THREE;
        const kinds: Array<[string, (o: any) => boolean]> = [
          ['pendant', o => /^Pendant/.test(o.name || '') && o.isGroup && !!o.parent && /Pendants/.test(o.parent.name || '')],
          ['curtains', o => o.userData && o.userData.itemType === 'curtains'],
          ['plant', o => o.userData && /plant|palm|fiddle|fern|monstera|pothos|ficus|tree/.test(o.userData.itemType || '') && o.userData.role === 'item'],
          ['lamp', o => o.userData && /lamp/.test(o.userData.itemType || '') && !/pendant/.test(o.userData.itemType) && o.userData.role === 'item'],
          ['stairs', o => o.userData && o.userData.stair === true],
          ['chair', o => o.userData && /chair/.test(o.userData.itemType || '') && o.userData.role === 'item'],
        ];
        const out: any[] = [];
        for (const [kind, f] of kinds) {
          let n = 0;
          scene.traverse((o: any) => {
            if (n >= 2 || !o.visible || !f(o)) return;
            o.updateWorldMatrix(true, true);
            const b = new TH.Box3().setFromObject(o); if (b.isEmpty()) return;
            const c = b.getCenter(new TH.Vector3()), sz = b.getSize(new TH.Vector3());
            if (Math.max(sz.x, sz.y, sz.z) < 0.15 || Math.max(sz.x, sz.y, sz.z) > 6) return;
            // the room the object stands in: toward its middle is where the eye is
            const rooms = d.house.spec.levels.flatMap((lv: any) => (lv.rooms || []).map((r: any) => ({ lv, r })));
            const home = rooms.filter(({ lv, r }: any) => r.bounds && c.x >= r.bounds.x && c.x <= r.bounds.x + r.bounds.w && c.z >= r.bounds.z && c.z <= r.bounds.z + r.bounds.d && c.y >= (lv.y || 0) - 0.1 && c.y <= (lv.y || 0) + (lv.height || 3))[0];
            const m = home ? { x: home.r.bounds.x + home.r.bounds.w / 2, z: home.r.bounds.z + home.r.bounds.d / 2 } : { x: c.x + 1, z: c.z + 1 };
            let dx = m.x - c.x, dz = m.z - c.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
            const dist = Math.min(l * 0.9, Math.max(sz.x, sz.y, sz.z) * 1.6 + 0.7);
            out.push({ kind, name: o.name || kind, c: c.toArray(), cam: [c.x + dx * dist, Math.min(c.y + 0.25, (home ? (home.lv.y || 0) : 0) + 1.6), c.z + dz * dist] });
            n++;
          });
        }
        return out;
      });
      for (const [ti, t] of targets.entries()) for (const tod of ['day', 'night'] as const) {
        await w.page.evaluate((tt: string) => (window as any).__houseSetLighting(tt), tod);
        const files: string[] = [];
        for (const [tag, thick] of [['old', 1], ['new', null]] as Array<[string, number | null]>) {
          if (thick !== null) await w.page.evaluate((th: number) => { const fc = (window as any).__houseComposer(); fc.gtao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1, thickness: th, scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false }); }, thick);
          else await w.page.evaluate(() => { const fc = (window as any).__houseComposer(); fc.gtao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1, thickness: 0.15, scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false }); });
          const url = await w.page.evaluate(({ t, res, quality }: any) => {
            const W = window as any, d = W.__houseDebug(), c = d.camera;
            c.position.set(...(t.cam as [number, number, number])); c.lookAt(...(t.c as [number, number, number])); c.fov = 60; c.near = 0.05; c.updateProjectionMatrix();
            return W.__houseSnapshot({ res, dressing: { walls: 'up', roof: 'on' }, quality });
          }, { t, res: RES, quality: QUALITY });
          const f = path.join(dir, `${house}__${t.kind}${ti}__${tod}-${tag}.jpg`); fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); files.push(f);
        }
        manifest.push({ house, kind: t.kind, name: t.name, tod, files: files.map(f => path.basename(f)) });
        console.log(`  ${house.padEnd(12)} ${t.kind.padEnd(8)} ${tod}  ${t.name}`);
      }
      await w.close();
    }
  } finally { await session.close(); }
  writeText(path.join(dir, 'closeups.json'), stableJson({ schema: 1, what: 'GTAO thickness 1 (old) against the shipped value, close-ups (test-interior-light.mts --closeups)', rows: manifest }));
  return 0;
}


// ---- steady: what do lights at intensity 0 cost a DAY frame? ----------------------------------------------------------------------------------
// LIGHT v3 item 6. v2 left the room lights in the scene at intensity 0 by day (so the Day-to-Dusk switch recompiles nothing), and a skeptic measured steady day frames
// 15-30 % dearer than the old policy that hid them. Here: per house, the page of each policy (cold = hidden and never warmed: the old baseline; hide = what ships, after its pre-warm; zero = v2's intensity 0) in turn, `--rounds`
// times, each page rendering `--frames` frames through the plain renderer (render + a 1-pixel readback, so the GPU has finished) after a warm-up, the median of them; the player (?mode=view,
// the default) or the editor (--editor). Load is recorded before and after every page: the machine is shared, so the ratio inside a round, not the milliseconds, is the result.
//   pnpm run test:light -- --steady [--editor] [--houses aurora,seraphine] [--rounds 3] [--frames 60] [--policies hide,zero] [--query no=x]
async function steadyMode(): Promise<number> {
  const houses = args.houses && args.houses !== 'true' ? args.houses.split(',') : ['aurora', 'seraphine'];
  const rounds = Number(args.rounds && args.rounds !== 'true' ? args.rounds : 3), nFrames = Number(args.frames && args.frames !== 'true' ? args.frames : 60);
  const policies = (args.policies && args.policies !== 'true' ? args.policies : 'cold,hide,zero').split(',');
  const editor = args.editor === 'true';
  const extra = args.query && args.query !== 'true' ? `&${args.query}` : '';
  const session = await startSession();
  const res: Record<string, Record<string, number[]>> = {}, cpuRes: Record<string, Record<string, number[]>> = {};
  const loads: number[] = [];
  try {
    for (let round = 0; round < rounds; round++) for (const house of houses) for (const policy of (round % 2 ? [...policies].reverse() : policies)) {
      const ctx = await session.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.route('https://fonts.googleapis.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await page.route('https://fonts.gstatic.com/**', (r: any) => r.abort());
      await page.addInitScript((p: string) => { (window as any).__fillZero = p === 'zero'; (window as any).__fillNoWarm = p === 'cold'; }, policy);   // hide: shipped (waited for the pre-warm); cold: hidden, never warmed (the v1 baseline); zero: v2
      await page.goto(session.srv.url(editor ? `room-creator.html?house=${house}${extra}` : `room-creator.html?mode=view&house=${house}&tod=day&play=0${extra}`), { waitUntil: 'domcontentloaded', timeout: 240000 });
      await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, house, { timeout: 240000 });
      if (editor) await page.evaluate(() => (window as any).__houseSetLighting('day'));
      if (policy === 'hide') await page.waitForFunction(() => { const w = (window as any).__houseFixturesWarm && (window as any).__houseFixturesWarm(); return !!(w && w.done); }, null, { timeout: 180000, polling: 250 });
      const l0 = machine().load1;
      const { ms, cpu, calls, lights }: any = await page.evaluate(async ({ n }: any) => {
        const W = window as any, d = W.__houseDebug(), R = d.renderer, gl = R.getContext(), px = new Uint8Array(4);
        let cpuT = 0;
        const frame = () => { const t0 = performance.now(); R.render(d.scene, d.camera); cpuT = performance.now() - t0; gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; };
        for (let i = 0; i < 12; i++) frame();
        const xs: number[] = [], cs: number[] = []; for (let i = 0; i < n; i++) { xs.push(frame()); cs.push(cpuT); } xs.sort((a, b) => a - b); cs.sort((a, b) => a - b);
        let vis = 0; d.scene.traverse((o: any) => { if (o.isSpotLight && o.userData.fixtureLight && o.visible) vis++; });
        return { ms: xs[xs.length >> 1], cpu: cs[cs.length >> 1], calls: R.info.render.calls, lights: vis };
      }, { n: nFrames });
      (cpuRes[house] ||= {})[policy] ||= []; cpuRes[house][policy].push(cpu);
      loads.push(l0, machine().load1);
      (res[house] ||= {})[policy] ||= []; res[house][policy].push(ms);
      console.log(`  round ${round} ${house.padEnd(10)} ${policy.padEnd(5)} ${ms.toFixed(1)} ms (render call alone ${cpu.toFixed(1)}, ${calls} calls, ${lights} lights visible)  (load ${l0} > ${machine().load1})`);
      await ctx.close();
    }
  } finally { await session.close(); }
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
  console.log(`\nsteady DAY frame, ${editor ? 'editor' : 'player'}, median of ${nFrames} frames, median over ${rounds} rounds`);
  const table: any = {};
  for (const house of houses) {
    const m: Record<string, number> = {}; for (const p of policies) m[p] = med(res[house][p]);
    const base = m[policies[0]];
    table[house] = m;
    console.log(`  ${house.padEnd(10)} ${policies.map(p => `${p} ${m[p].toFixed(1)} ms (${res[house][p].map(v => v.toFixed(1)).join(' ')}; render call ${med(cpuRes[house][p]).toFixed(1)})`).join('   ')}   ${policies.slice(1).map(p => `${p}/${policies[0]} ${(m[p] / base).toFixed(3)}`).join('  ')}`);
  }
  writeText(out(`steady-${editor ? 'editor' : 'player'}${args.label && args.label !== 'true' ? '-' + args.label : ''}.json`), stableJson({ schema: 1, what: 'steady day frame cost by policy (scripts/test-interior-light.mts --steady)', editor, nFrames, rounds, res, cpuRes, table, loadsRecorded: loads, machine: machine() }));
  return 0;
}

let code = 0;
if (args.steady === 'true') code = await steadyMode();
else if (args.closeups === 'true') code = await closeupsMode();
else if (args.mood === 'true') code = await moodMode();
else if (args.lamps === 'true') code = await lampsMode();
else if (args.leak === 'true') code = await leakMode();
else if (args.probe === 'true') code = await probeMode();
else if (args['player-calls'] === 'true') code = await playerCallsMode();
else if (args.hitch === 'true') code = await hitchMode();
else if (args.portal === 'true') code = await portalMode();
else if (args.bench === 'true') code = await benchMode();
else code = await fixturesMode();
const bad = rows.filter(r => !r.ok).length;
if (args.portal !== 'true' && args.probe !== 'true' && args.leak !== 'true' && args.lamps !== 'true' && args.mood !== 'true' && args.closeups !== 'true' && args.steady !== 'true' && args.hitch !== 'true' && args['player-calls'] !== 'true') console.log(bad ? `\n${bad} of ${rows.length} rows failed` : `\nall ${rows.length} rows pass`);
console.log(`(load ${machine().load1})`);
process.exit(code);
