#!/usr/bin/env -S node --experimental-strip-types
// The camera audit (plan §3.14, the S5 acceptance): what the 30 door-to-core films look like and how they move, for planner v1
// and planner v2 side by side.
//
//   node --experimental-strip-types scripts/camera-audit.mts [--house a,b | all] [--planner v1,v2] [--frames 12] [--res 270]
//        [--out test/qa/camera-audit] [--no-render] [--stale-ok] [--rebuild-worlds]
//
// For each house × planner it writes <out>/<planner>/<id>.strip.jpg — a CONTACT STRIP: twelve frames of the film in order (each
// captioned with its time and beat) beside the house's plan(s), the eye's path drawn in the colour of its beat, a tick a second,
// the camera's cone at each of the twelve frames — and a metrics table. The numbers are measured one way on both planners' tracks
// (assets/shot-fleet.ts trackMetrics: outside share, first-second travel, speed at the entry door and the doorways, view turn rate
// smoothed over 0.2 s and raw, dead air, how far the look lags the walk, the finale orbit's arc, the Core's height in the last
// frame), with QA's findings (the page's __houseShotQA: v1's checks on a v1 film, QA v2 on a v2 one) and, for v2, the fleet
// targets (assets/shot-fleet.ts fleetChecks). Writes <out>/camera-audit.json, <out>/index.html (every strip, the metrics side by
// side) and prints the fleet table.
//
// A v2 film is baked in Node from the house's ShotWorld (scripts/shot-worlds.mts) — the track the page bakes (test-shot-planner
// proves the hashes equal) — and its frames are rendered by the page under ?planner=v2; a v1 film is the page's own. --no-render
// skips the browser for v2 (metrics only). Needs `pnpm run build`; ffmpeg is not needed.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, houseIds, parseArgs, loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts } from './portal-lib.mts';
import { ensureWorlds, specFile } from './shot-worlds.mts';
import { planDoorToCore, shotOptions, sampleTrack, BEATS } from '../assets/shot-planner.js';
import { qaTrack } from '../assets/shot-qa.js';
import { fleetChecks, trackMetrics, type FleetRow } from '../assets/shot-fleet.js';

const args = parseArgs(process.argv.slice(2));
const ids = !args.house || args.house === 'all' ? houseIds() : args.house.split(',');
const planners = (args.planner || 'v1,v2').split(',').filter(p => p === 'v1' || p === 'v2');
const KEEP = Math.max(4, parseInt(args.frames || '12', 10)), RES = args.res || '270', FPS = 10;
const OUT = args.out ? path.resolve(args.out) : path.join(ROOT, 'test', 'qa', 'camera-audit');
const render = args['no-render'] !== 'true';
fs.mkdirSync(OUT, { recursive: true });
for (const p of planners) fs.mkdirSync(path.join(OUT, p), { recursive: true });

const worlds = await ensureWorlds(ids, { rebuild: args['rebuild-worlds'] === 'true', staleOk: args['stale-ok'] === 'true' });
const BEAT_COLOURS = ['#7a8b99', '#c08a3e', '#3f8f6b', '#2e7fb8', '#8a5fb0', '#d0574a', '#e0a020', '#20a0a0', '#b06090', '#5a5a5a', '#e07020', '#c02060'];

// ---- v2 in Node ---------------------------------------------------------------------------------------------------------
type Film = { planner: string; duration: number; pos: number[]; look: number[]; fov: number[]; beat: number[] | null; samples: number; dt: number; qa: any; metrics: any; plan?: any; hash?: string; error?: string };
const films = new Map<string, Film>();   // `${planner}/${id}`
const fleetRows: FleetRow[] = [];
for (const id of ids) {
  if (!planners.includes('v2')) break;
  const world = worlds.get(id), spec = JSON.parse(fs.readFileSync(specFile(id), 'utf8')), so = shotOptions(spec, 'door-to-core', 'v2');
  const r = planDoorToCore(world, so.options);
  if (!r.ok) { films.set(`v2/${id}`, { planner: 'v2', duration: 0, pos: [], look: [], fov: [], beat: null, samples: 0, dt: 0, qa: { errors: [{ code: (r as any).code, message: (r as any).message }], warnings: [] }, metrics: {}, error: (r as any).message }); continue; }
  const t = r.track, qa = qaTrack(t, world, { via: so.shot && so.shot.via });
  films.set(`v2/${id}`, { planner: 'v2', duration: t.duration, pos: Array.from(t.pos), look: Array.from(t.look), fov: Array.from(t.fov), beat: Array.from(t.beat), samples: t.samples, dt: t.dt, qa: { errors: qa.errors, warnings: qa.warnings, metrics: qa.metrics }, metrics: { ...trackMetrics(t, world, 16 / 9, sampleTrack(t, 1).target), orbitBeatArc: qa.metrics.orbitArc ?? null }, plan: t.plan, hash: t.hash });
  fleetRows.push({ id, duration: t.duration, metrics: qa.metrics, plan: t.plan, errors: qa.errors.length, warnings: qa.warnings.length });
}

// ---- the page: v1's tracks and QA, and the frames of both ---------------------------------------------------------------
async function drawStrip(page: any, data: any): Promise<string> {
  return page.evaluate(async (d: any) => {
    const W = 480, H = 270, cols = 4, rows = Math.ceil(d.frames.length / cols), HEAD = 46, GRID_W = cols * W, GRID_H = rows * H, PLAN_W = 820;
    const cv = document.createElement('canvas'); cv.width = GRID_W + PLAN_W; cv.height = HEAD + Math.max(GRID_H, 820); const g = cv.getContext('2d')!;
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#111'; g.font = '600 22px system-ui, sans-serif'; g.fillText(d.title, 12, 30);
    g.font = '15px system-ui, sans-serif'; g.fillStyle = '#444'; g.textAlign = 'right'; g.fillText(d.subtitle, cv.width - 12, 30); g.textAlign = 'left';
    for (let k = 0; k < d.frames.length; k++) {
      const img = new Image(); await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); img.src = d.frames[k]; });
      const x = (k % cols) * W, y = HEAD + Math.floor(k / cols) * H;
      g.drawImage(img, x, y, W, H);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, y, 190, 22); g.fillStyle = '#fff'; g.font = '13px ui-monospace, monospace'; g.fillText(`${k + 1}  ${d.labels[k]}`, x + 6, y + 15);
      g.strokeStyle = '#f4f1ea'; g.lineWidth = 2; g.strokeRect(x, y, W, H);
    }
    // ---- the plan(s): every storey the path is on, walls, items, stairs, the path by beat, the cones of the twelve frames
    const w = d.world, P = d.path, levels = w.levels.filter((l: any) => { let n = 0; for (let i = 0; i < P.n; i++) if (P.y[i] > l.y - 0.2 && P.y[i] < l.y + l.h + 0.4 && l.rects.some((r: any) => P.x[i] >= r.x - 0.3 && P.x[i] <= r.x + r.w + 0.3 && P.z[i] >= r.z - 0.3 && P.z[i] <= r.z + r.d + 0.3)) n++; return n > 6; });
    if (!levels.length) levels.push(w.levels[0]);
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    const grow = (x: number, z: number) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); };
    for (const l of w.levels) for (const r of l.rects) { grow(r.x, r.z); grow(r.x + r.w, r.z + r.d); }
    for (let i = 0; i < P.n; i++) grow(P.x[i], P.z[i]);
    minX -= 1.5; minZ -= 1.5; maxX += 1.5; maxZ += 1.5;
    const panelH = Math.floor(Math.max(GRID_H, 820) / levels.length), sc = Math.min((PLAN_W - 16) / (maxX - minX), (panelH - 24) / (maxZ - minZ));
    levels.forEach((l: any, li: number) => {
      const ox = GRID_W + 8 - minX * sc, oz = HEAD + li * panelH + 20 - minZ * sc, X = (x: number) => ox + x * sc, Z = (z: number) => oz + z * sc;
      g.save(); g.beginPath(); g.rect(GRID_W + 2, HEAD + li * panelH + 18, PLAN_W - 4, panelH - 20); g.clip();
      g.fillStyle = '#111'; g.font = '600 13px system-ui, sans-serif'; g.fillText(`${l.id}  (y ${l.y} m)`, GRID_W + 10, HEAD + li * panelH + 14);
      g.fillStyle = '#fff'; g.strokeStyle = '#9a958a'; g.lineWidth = 1;
      for (const r of l.rects) { g.fillRect(X(r.x), Z(r.z), r.w * sc, r.d * sc); g.strokeRect(X(r.x), Z(r.z), r.w * sc, r.d * sc); }
      for (const v of l.voids) { g.fillStyle = '#e6e2d8'; g.fillRect(X(v.x), Z(v.z), v.w * sc, v.d * sc); }
      // site: planting and built things on the lot, faint
      for (const b of w.boxes) if (b.k === 7) { g.fillStyle = 'rgba(90,140,90,0.28)'; g.fillRect(X(b.b[0]), Z(b.b[2]), (b.b[3] - b.b[0]) * sc, (b.b[5] - b.b[2]) * sc); }
      for (const b of w.boxes) {
        if (b.b[4] < l.y + 0.3 || b.b[1] > l.y + l.h - 0.2) continue;
        if (b.k === 1) g.fillStyle = '#555'; else if (b.k === 3 || b.k === 4) g.fillStyle = '#d3c9b6'; else if (b.k === 10) g.fillStyle = '#e07020'; else continue;
        g.fillRect(X(b.b[0]), Z(b.b[2]), Math.max(1, (b.b[3] - b.b[0]) * sc), Math.max(1, (b.b[5] - b.b[2]) * sc));
      }
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.font = '11px system-ui, sans-serif';
      for (const r of l.rooms) if (r.b) { g.fillText(r.name, X(r.b.x) + 3, Z(r.b.z) + 12); }
      for (const o of w.stairs) { if (Math.abs(o.bottom[1] - l.y) < 0.6 || Math.abs(o.top[1] - l.y) < 0.6) { g.strokeStyle = '#b06090'; g.lineWidth = 2; g.strokeRect(X(o.plan.minX), Z(o.plan.minZ), (o.plan.maxX - o.plan.minX) * sc, (o.plan.maxZ - o.plan.minZ) * sc); } }
      if (w.entry && w.entry.level === l.id) { g.fillStyle = '#2a9d5a'; g.beginPath(); g.arc(X(w.entry.x), Z(w.entry.z), 5, 0, 6.3); g.fill(); }
      // the path
      const onLevel = (i: number) => P.y[i] > l.y - 0.2 && P.y[i] < l.y + l.h + 0.4;
      for (let i = 1; i < P.n; i++) {
        g.strokeStyle = onLevel(i) && onLevel(i - 1) ? d.colours[P.beat ? P.beat[i] : 5] : 'rgba(120,120,120,0.25)'; g.lineWidth = onLevel(i) ? 3 : 1.2;
        g.beginPath(); g.moveTo(X(P.x[i - 1]), Z(P.z[i - 1])); g.lineTo(X(P.x[i]), Z(P.z[i])); g.stroke();
      }
      for (let i = 0; i < P.n; i += P.perSecond) { if (!onLevel(i)) continue; g.fillStyle = '#111'; g.beginPath(); g.arc(X(P.x[i]), Z(P.z[i]), 2.2, 0, 6.3); g.fill(); if (Math.round(i / P.perSecond) % 5 === 0) { g.font = '10px ui-monospace, monospace'; g.fillText(`${Math.round(i / P.perSecond)}s`, X(P.x[i]) + 4, Z(P.z[i]) - 4); } }
      // the cones of the kept frames
      d.keys.forEach((k: any, n: number) => {
        if (!(k.y > l.y - 0.2 && k.y < l.y + l.h + 0.4)) return;
        const a = k.yaw, half = (k.fov * 1.6) * Math.PI / 360 * 1.2, len = 1.6 * sc;
        g.fillStyle = 'rgba(30,110,200,0.22)'; g.strokeStyle = 'rgba(30,110,200,0.8)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(X(k.x), Z(k.z)); g.lineTo(X(k.x) + Math.sin(a - half) * len, Z(k.z) + Math.cos(a - half) * len); g.lineTo(X(k.x) + Math.sin(a + half) * len, Z(k.z) + Math.cos(a + half) * len); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#0b3d75'; g.font = '600 11px system-ui, sans-serif'; g.fillText(String(n + 1), X(k.x) + 3, Z(k.z) - 3);
      });
      if (w.hero && w.hero.level === l.id) { g.fillStyle = '#e07020'; g.beginPath(); g.arc(X(w.hero.x), Z(w.hero.z), 6, 0, 6.3); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
      g.restore();
    });
    // the legend
    if (d.beatNames) { let lx = GRID_W + 10; const ly = HEAD + Math.max(GRID_H, 820) - 8; g.font = '11px system-ui, sans-serif'; d.beatNames.forEach((n: string, i: number) => { if (!d.usedBeats.includes(i)) return; g.fillStyle = d.colours[i]; g.fillRect(lx, ly - 9, 10, 10); g.fillStyle = '#333'; g.fillText(n, lx + 13, ly); lx += 22 + g.measureText(n).width; }); }
    return cv.toDataURL('image/jpeg', 0.86);
  }, data);
}

const results: any[] = [];
const bx = (id: string) => ({ w: worlds.get(id) });
if (render || planners.includes('v1')) {
  const srv = await serve(ROOT, '/'), pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ headless: true, args: LAUNCH_ARGS });
  try {
    const compose = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
    await compose.setContent('<!doctype html><meta charset=utf-8><body></body>');
    for (const id of ids) {
      const world = worlds.get(id), row: any = { id };
      for (const planner of planners) {
        const key = `${planner}/${id}`;
        const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
        page.on('pageerror', (e: Error) => console.error(`  page error ${key}:`, e.message));
        await stubGoogleFonts(page, srv.origin);
        try {
          await page.goto(srv.url(`room-creator.html?house=${id}&planner=${planner}`), { waitUntil: 'domcontentloaded', timeout: 120000 });
          await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, id, { timeout: 120000 });
          const qa = await page.evaluate(() => { try { const q = (window as any).__houseShotQA('door-to-core'); return { planner: q.planner || 'v1', errors: q.errors, warnings: q.warnings, metrics: q.metrics || null, orbit: q.orbit || null }; } catch (e) { return { error: String(e), errors: [], warnings: [] }; } });
          let film = films.get(key);
          if (planner === 'v1') {
            const tr = await page.evaluate(() => { const t = (window as any).__houseShotTrack('door-to-core', { fps: 60 }); return { duration: t.duration, samples: t.samples, dt: t.dt, pos: Array.from(t.pos as ArrayLike<number>), look: Array.from(t.look as ArrayLike<number>), fov: Array.from(t.fov as ArrayLike<number>) }; });
            film = { planner, duration: tr.duration, pos: tr.pos, look: tr.look, fov: tr.fov, beat: null, samples: tr.samples, dt: tr.dt, qa: { errors: qa.errors, warnings: qa.warnings }, metrics: { ...trackMetrics(tr as any, world), orbitBeatArc: qa.orbit && typeof qa.orbit.arc === 'number' ? Math.round(qa.orbit.arc) : null } };
            films.set(key, film);
          } else if (film && qa.planner !== 'v2') { film.qa = { ...film.qa, pageNote: `the page fell back to ${qa.planner}` }; }
          if (!film) continue;
          if (render) {
            await page.evaluate(() => document.fonts.ready);
            await page.evaluate((r: string) => (window as any).__houseComposerWarm({ res: r }), RES);
            const info = await page.evaluate(({ s, r, fps }: any) => (window as any).__houseRenderBegin({ shot: s, res: r, fps }), { s: 'door-to-core', r: RES, fps: FPS });
            const frames: string[] = [], labels: string[] = [], keys: any[] = [];
            for (let k = 0; k < KEEP; k++) {
              const u = k / (KEEP - 1), fi = Math.round(u * (info.frames - 1)), si = Math.min(film.samples - 1, Math.round(u * (film.samples - 1)));
              const b64 = await page.evaluate((i: number) => (window as any).__houseRenderFrames(i, 1, 0.85)[0], fi);
              frames.push(`data:image/jpeg;base64,${b64}`);
              const t = u * film.duration, bn = film.beat ? BEATS[film.beat[si]] : '';
              labels.push(`${t.toFixed(1)} s ${bn}`);
              const e = [film.pos[3 * si], film.pos[3 * si + 1], film.pos[3 * si + 2]], l = [film.look[3 * si], film.look[3 * si + 1], film.look[3 * si + 2]];
              keys.push({ x: e[0], y: e[1], z: e[2], yaw: Math.atan2(l[0] - e[0], l[2] - e[2]), fov: film.fov[si] });
            }
            await page.evaluate(() => (window as any).__houseRenderEnd());
            const step = Math.max(1, Math.round(1 / FPS / film.dt)), n = Math.ceil(film.samples / step), x: number[] = [], y: number[] = [], z: number[] = [], beat: number[] = [];
            for (let i = 0; i < film.samples; i += step) { x.push(film.pos[3 * i]); y.push(film.pos[3 * i + 1]); z.push(film.pos[3 * i + 2]); if (film.beat) beat.push(film.beat[i]); }
            const m = film.metrics;
            const data = {
              title: `${id} — planner ${planner}${film.hash ? ` — ${film.hash.split(':')[0]}` : ''}`,
              subtitle: `${film.duration.toFixed(1)} s · outside ${(m.outsideShare * 100).toFixed(0)} % · door ${m.doorSpeed ?? '–'} m/s · yaw peak ${m.yawPeak}°/s (raw ${m.yawPeakRaw}) · orbit ${m.orbitBeatArc ?? '–'}° · errors ${film.qa.errors.length} · warnings ${film.qa.warnings.length}`,
              frames, labels, keys, colours: BEAT_COLOURS, beatNames: film.beat ? [...BEATS] : null, usedBeats: film.beat ? [...new Set(beat)] : [],
              world: { levels: world.levels, entry: world.entry, hero: world.hero, stairs: world.stairs, boxes: world.kinds.map((k: number, i: number) => ({ k, b: world.boxes.slice(6 * i, 6 * i + 6) })).filter((o: any) => o.k === 1 || o.k === 3 || o.k === 4 || o.k === 7 || o.k === 10) },
              path: { n: x.length, x, y, z, beat: film.beat ? beat : null, perSecond: FPS },
            };
            const url = await drawStrip(compose, data);
            fs.writeFileSync(path.join(OUT, planner, `${id}.strip.jpg`), Buffer.from(url.split(',')[1], 'base64'));
          }
          row[planner] = { duration: film.duration, hash: film.hash, metrics: film.metrics, errors: film.qa.errors.map((e: any) => ({ code: e.code, t: e.t, message: e.message })), warnings: countBy(film.qa.warnings), plan: planner === 'v2' && film.plan ? { establish: film.plan.establish && film.plan.establish.style, orbit: film.plan.orbit && { arc: film.plan.orbit.arc, reachable: film.plan.orbit.reachable, swing: film.plan.orbit.swing } } : null };
        } catch (e: any) { console.error(`  ${key}: ${e.message.split('\n')[0]}`); row[planner] = { error: e.message.split('\n')[0] }; }
        await page.context().close();
      }
      results.push(row);
      console.log(`  ${id}: ${planners.map(p => (row[p] && row[p].metrics ? `${p} ${row[p].duration.toFixed(1)} s, ${row[p].errors.length} errors, orbit ${row[p].metrics.orbitBeatArc}°` : `${p} —`)).join(' · ')}`);
    }
  } finally { await browser.close(); await srv.close(); }
} else {
  for (const id of ids) { const f = films.get(`v2/${id}`); if (f) results.push({ id, v2: { duration: f.duration, hash: f.hash, metrics: f.metrics, errors: f.qa.errors.length, warnings: countBy(f.qa.warnings) } }); }
}
function countBy(list: any[]) { const m: Record<string, number> = {}; for (const f of list) m[f.code] = (m[f.code] || 0) + 1; return m; }

// ---- the fleet ---------------------------------------------------------------------------------------------------------
const med = (a: number[]) => { const s = a.filter(v => Number.isFinite(v)).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const summary: Record<string, any> = {};
for (const planner of planners) {
  const fs_ = ids.map(id => films.get(`${planner}/${id}`)).filter(Boolean) as Film[], M = (k: string) => fs_.map(f => f.metrics[k]).filter(v => typeof v === 'number');
  summary[planner] = {
    films: fs_.length, duration: +med(fs_.map(f => f.duration)).toFixed(1), outsideShareMedian: +med(M('outsideShare')).toFixed(2), doorSpeedMedian: +med(M('doorSpeed')).toFixed(2), doorSpeedMax: Math.max(...M('doorSpeed')),
    doorwayMaxMedian: +med(M('doorwayMax')).toFixed(2), yawPeakMedian: med(M('yawPeak')), yawPeakRawMedian: med(M('yawPeakRaw')), whipsTotal: M('whips').reduce((a, b) => a + b, 0), deadAirHouses: fs_.filter(f => f.metrics.deadAirS > 0).length,
    lookLagMedian: med(M('lookLagMedian')), crabPctMedian: med(M('crabPct')), orbitUnder60: fs_.filter(f => f.metrics.orbitBeatArc < 60).length, orbitMedian: med(M('orbitBeatArc')), orbitAtLeast90: fs_.filter(f => f.metrics.orbitBeatArc >= 90).length, orbitAtLeast120: fs_.filter(f => f.metrics.orbitBeatArc >= 120).length, sweepMedian: med(M('orbitArc')),
    qaErrors: fs_.reduce((a, f) => a + f.qa.errors.length, 0), swingBackWarnings: fs_.reduce((a, f) => a + f.qa.warnings.filter((w: any) => w.code === 'orbit-swing-back').length, 0), warningsPerFilm: +(fs_.reduce((a, f) => a + f.qa.warnings.length, 0) / Math.max(1, fs_.length)).toFixed(1),
  };
}
const checks = fleetRows.length >= 10 ? fleetChecks(fleetRows) : [];
fs.writeFileSync(path.join(OUT, 'camera-audit.json'), JSON.stringify({ generated: new Date().toISOString(), houses: ids, planners, summary, fleetChecks: checks, results }, null, 1));

// ---- the page ------------------------------------------------------------------------------------------------------------
const esc = (s: any) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
const cell = (v: any) => (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? '–' : esc(v));
const KEYS: Array<[string, string]> = [['duration', 's'], ['outsideShare', 'outside'], ['firstSecond', '1st s (m)'], ['doorSpeed', 'door m/s'], ['doorwayMax', 'doorway m/s'], ['yawPeak', 'yaw peak °/s'], ['yawPeakRaw', 'raw'], ['whips', 'whips'], ['deadAirS', 'dead air s'], ['lookLagMedian', 'look lag °'], ['crabPct', 'crab %'], ['orbitBeatArc', 'orbit °'], ['orbitArc', 'sweep °'], ['finalCoreHeight', 'Core h']];
let html = `<!doctype html><meta charset="utf-8"><title>Camera audit</title><style>body{font:14px system-ui,sans-serif;margin:24px;background:#f7f5f0;color:#181818}h1{font-size:22px}h2{font-size:16px;margin:26px 0 6px}table{border-collapse:collapse;margin:6px 0}td,th{border:1px solid #cfc9bb;padding:2px 8px;text-align:right;font-variant-numeric:tabular-nums}th{background:#ebe6da}td:first-child,th:first-child{text-align:left}img{max-width:100%;display:block;margin:6px 0;border:1px solid #cfc9bb}.bad{color:#b3261e;font-weight:600}.ok{color:#1b7a3d}</style><h1>Camera audit</h1><p>${esc(new Date().toISOString())} · ${ids.length} houses · planners ${planners.join(', ')}</p>`;
html += `<h2>The fleet, planner by planner</h2><table><tr><th></th>${planners.map(p => `<th>${p}</th>`).join('')}</tr>${Object.keys(summary[planners[0]] || {}).map(k => `<tr><td>${k}</td>${planners.map(p => `<td>${cell(summary[p][k])}</td>`).join('')}</tr>`).join('')}</table>`;
if (checks.length) html += `<h2>Fleet targets (planner v2)</h2><table><tr><th>check</th><th>value</th><th>target</th><th></th></tr>${checks.map(c => `<tr><td>${esc(c.title)}</td><td style="text-align:left">${esc(c.value)}</td><td style="text-align:left">${esc(c.target)}</td><td class="${c.pass ? 'ok' : 'bad'}">${c.pass ? 'pass' : c.advisory ? 'advisory' : 'FAIL'}</td></tr>`).join('')}</table>`;
for (const r of results) {
  html += `<h2>${esc(r.id)}</h2><table><tr><th>planner</th>${KEYS.map(([, l]) => `<th>${l}</th>`).join('')}<th>errors</th><th>warnings</th></tr>`;
  for (const p of planners) { const x = r[p]; if (!x || !x.metrics) { html += `<tr><td>${p}</td><td colspan="${KEYS.length + 2}">${esc((x && x.error) || 'no film')}</td></tr>`; continue; } html += `<tr><td>${p}</td>${KEYS.map(([k]) => `<td>${cell(x.metrics[k])}</td>`).join('')}<td class="${(Array.isArray(x.errors) ? x.errors.length : x.errors) ? 'bad' : ''}">${Array.isArray(x.errors) ? x.errors.length : x.errors}</td><td style="text-align:left">${esc(Object.entries(x.warnings || {}).map(([c, n]) => `${c}×${n}`).join(' '))}</td></tr>`; }
  html += '</table>';
  if (render) for (const p of planners) html += `<img loading="lazy" src="${p}/${r.id}.strip.jpg" alt="${esc(r.id)} ${p}">`;
}
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`\n${planners.map(p => `${p}: ${JSON.stringify(summary[p])}`).join('\n')}`);
if (checks.length) { console.log(''); for (const c of checks) console.log(`${c.pass ? '✓' : c.advisory ? '•' : '✗'} ${c.title}: ${c.value}`); }
console.log(`\n→ ${path.relative(process.cwd(), OUT)}/index.html${render ? `, ${results.length * planners.length} contact strips in ${planners.map(p => `${p}/`).join(' ')}` : ''}`);
void bx;
