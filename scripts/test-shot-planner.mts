#!/usr/bin/env -S node --experimental-strip-types
// Spline planner v2 (plan §3, S5's acceptance), planned in Node on the built houses and judged as a fleet:
//
//   1. plans door-to-core for all 30 houses from their ShotWorld (scripts/shot-worlds.mts builds the worlds in the page
//      once and keeps them in test/qa/shot-worlds/; a fixture is planned too), twice, and the two runs must be byte-identical;
//   2. QA v2 (assets/shot-qa.ts) on every track: 0 errors;
//   3. the fleet targets of plan §3.14 / the S5 acceptance (assets/shot-fleet.ts): outside share, travel in the first
//      second, speed across the door, view rate, look error, the press, the rooms seen, the Core's height and place in the
//      last frame, the establishing styles and bearings, the finale orbit;
//   4. the page bakes the same track: with --parity (the default for two houses) __houseShotTrack's hash in the page,
//      under ?planner=v2, equals the Node bake's — the Node harness IS the page's planner;
//   5. the budgets (plan Completeness A4): planning all 30 within 15 s of CPU, QA v2 within 0.5 s a shot (reported;
//      only failing when the machine is not loaded — a busy machine inflates CPU time too).
//
//   node --experimental-strip-types scripts/test-shot-planner.mts [--house a,b] [--fixtures] [--update] [--parity 2|0|all]
//        [--rebuild-worlds] [--stale-ok] [--planner-only] [--out test/qa/shot-planner.json]
//   --update writes test/shots/<id>.track.json: the track's hash and metrics, which the next run compares (a drift is
//   reported, never a failure: the layout pass and the other streams change the houses the worlds are made of).
// Needs `pnpm run build`. Exit 0 all pass · 1 a check failed · 2 harness error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, houseIds, parseArgs, loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts } from './portal-lib.mts';
import { ensureWorlds, fixtureIds, specFile } from './shot-worlds.mts';
import { planDoorToCore, shotOptions, trackHash } from '../assets/shot-planner.js';
import { qaTrack } from '../assets/shot-qa.js';
import { fleetChecks, type FleetRow } from '../assets/shot-fleet.js';
import { planHeroReveal, planWalkthrough } from '../assets/shot-planner-tour.js';

const args = parseArgs(process.argv.slice(2));
const ids = args.house ? args.house.split(',') : houseIds();
const fixtures = args.fixtures === 'true' ? fixtureIds() : [];
const SHOTS_DIR = path.join(ROOT, 'test', 'shots');
const cpuMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail.split('\n').join('\n    ')}`}`); if (!ok) bad++; };

const worlds = await ensureWorlds([...ids, ...fixtures], { rebuild: args['rebuild-worlds'] === 'true', staleOk: args['stale-ok'] === 'true' });
const specOf = (id: string) => JSON.parse(fs.readFileSync(specFile(id), 'utf8'));

// ---- 1 + 2. plan (twice), QA
type Row = FleetRow & { hash: string; planMs: number; qaMs: number; notes: string[]; findings: any };
const rows: Row[] = [];
let planCpu = 0, identical = true; const drift: string[] = [], nondet: string[] = [], failed: string[] = [];
for (const id of [...ids, ...fixtures]) {
  const world = worlds.get(id), spec = specOf(id);
  const so = shotOptions(spec, 'door-to-core', 'v2');
  const t0 = cpuMs();
  const a = planDoorToCore(world, so.options);
  const planMs = cpuMs() - t0;
  if (ids.includes(id)) planCpu += planMs;
  if (!a.ok) { const f = a as any; failed.push(`${id}: ${f.code} — ${f.message}`); continue; }
  const b = planDoorToCore(world, so.options);
  if (!b.ok || trackHash(a.track) !== trackHash(b.track) || JSON.stringify(a.track.plan) !== JSON.stringify(b.track.plan)) { identical = false; nondet.push(id); }
  const t1 = cpuMs(); const qa = qaTrack(a.track, world, { via: (so.shot && so.shot.via) || undefined }); const qaMs = cpuMs() - t1;
  rows.push({ id, duration: a.track.duration, metrics: qa.metrics, plan: a.track.plan, errors: qa.errors.length, warnings: qa.warnings.length, hash: trackHash(a.track), planMs, qaMs, notes: a.notes, findings: { errors: qa.errors, warnings: qa.warnings } });
}
check(!failed.length, `every house plans (${ids.length + fixtures.length})`, failed.join('\n'));
check(identical, 'two plans of the same world are byte-identical (hash and plan)', nondet.join(', '));
const real = rows.filter(r => ids.includes(r.id)), fix = rows.filter(r => !ids.includes(r.id));
for (const r of rows) for (const e of r.findings.errors) console.log(`  ERROR ${r.id} t=${e.t}${e.tEnd > e.t ? '–' + e.tEnd : ''} ${e.code}: ${e.message}`);
check(!rows.some(r => r.errors), `QA v2: 0 errors on ${rows.length} track${rows.length === 1 ? '' : 's'}`, rows.filter(r => r.errors).map(r => `${r.id}: ${r.findings.errors.map((e: any) => e.code).join(', ')}`).join('\n'));

// ---- 2b. hero-reveal and walkthrough (planner v2's other two shots): planned twice, identical, and QA v2 has no error on either
{
  const bad2: string[] = [], nondet2: string[] = []; let n2 = 0, cpu2 = 0;
  for (const id of [...ids, ...fixtures]) {
    const world = worlds.get(id), spec = specOf(id);
    for (const [type, plan] of [['hero-reveal', (o: any) => planHeroReveal(world, o)], ['walkthrough', (o: any) => planWalkthrough(world, o)]] as Array<[string, (o: any) => any]>) {
      const so = shotOptions(spec, type, 'v2'), t0 = cpuMs(), a = plan({ duration: so.options.duration, heroView: so.options.heroView, via: (so.shot && so.shot.via) || undefined });
      cpu2 += cpuMs() - t0; n2++;
      if (!a.ok) { bad2.push(`${id}/${type}: ${a.code} — ${a.message}`); continue; }
      const b = plan({ duration: so.options.duration, heroView: so.options.heroView, via: (so.shot && so.shot.via) || undefined });
      if (!b.ok || trackHash(a.track) !== trackHash(b.track)) nondet2.push(`${id}/${type}`);
      const qa = qaTrack(a.track, world);
      for (const e of qa.errors) bad2.push(`${id}/${type} t=${e.t} ${e.code}: ${e.message}`);
    }
  }
  check(!nondet2.length, `hero-reveal and walkthrough: two plans of the same world are byte-identical (${n2} films)`, nondet2.join(', '));
  check(!bad2.length, `hero-reveal and walkthrough: 0 QA v2 errors on ${n2} films (${(cpu2 / n2).toFixed(0)} ms of CPU to plan one)`, bad2.join('\n'));
}

// ---- 3. the fleet
if (real.length === ids.length && ids.length >= 10) {
  const cs = fleetChecks(real);
  // (a check marked advisory is the layout pass's to fix — the camera audit warns — and never fails the gate)
  for (const c of cs) if (c.id !== 'qa-errors') { if (c.advisory) console.log(`${c.pass ? '✓' : '•'} ${c.title}: ${c.value}  (target ${c.target}${c.pass ? '' : ', advisory'})`); else check(c.pass, `${c.title}: ${c.value}  (target ${c.target})`, c.pass ? '' : c.detail || ''); }
} else console.log(`(the fleet targets need all the houses; ${real.length} planned)`);

// ---- the table
const w = 18;
console.log(`\n${'house'.padEnd(w)} ${'s'.padStart(5)} ${'style'.padEnd(12)} out%  1st  door  yaw  lookE  LOS  coreH  orbit  swing  plan  qa   E/W`);
for (const r of rows) {
  const m = r.metrics, o = r.plan.orbit;
  console.log(`${r.id.padEnd(w)} ${String(r.duration).padStart(5)} ${String((r.plan.establish || {}).style).padEnd(12)} ${(m.outsideShare * 100).toFixed(0).padStart(3)}  ${String(m.firstSecond).padStart(4)} ${String(m.doorSpeed).padStart(5)} ${String(m.maxYawRate).padStart(4)} ${String(m.lookErrorMedian).padStart(5)} ${String(m.coreLOS).padStart(4)} ${((m.finalCoreHeight || 0) * 100).toFixed(0).padStart(5)}  ${o ? `${o.arc}°`.padStart(5) : '    -'}  ${o ? String(o.swing).padStart(5) : '    -'} ${r.planMs.toFixed(0).padStart(5)} ${r.qaMs.toFixed(0).padStart(4)}  ${r.errors}/${r.warnings}`);
}

// ---- hashes (test/shots/<id>.track.json)
if (args.update === 'true') fs.mkdirSync(SHOTS_DIR, { recursive: true });
for (const r of real) {
  const f = path.join(SHOTS_DIR, `${r.id}.track.json`);
  const rec = { hash: r.hash, duration: r.duration, beats: Object.fromEntries((r.plan.rawBeatTimes ? Object.entries(r.plan.rawBeatTimes) : [])), events: undefined as any, metrics: { outsideShare: r.metrics.outsideShare, doorSpeed: r.metrics.doorSpeed, maxYawRate: r.metrics.maxYawRate, lookErrorMedian: r.metrics.lookErrorMedian, coreLOS: r.metrics.coreLOS, finalCoreHeight: r.metrics.finalCoreHeight, finalCoreNDC: r.metrics.finalCoreNDC, orbitArc: r.metrics.orbitArc, topRoomsSeen: r.metrics.topRoomsSeen, errors: r.errors, warnings: r.warnings }, establish: (r.plan.establish || {}).style };
  delete rec.events;
  if (args.update === 'true') fs.writeFileSync(f, JSON.stringify(rec, null, 1) + '\n');
  else if (fs.existsSync(f)) { const old = JSON.parse(fs.readFileSync(f, 'utf8')); if (old.hash !== r.hash) drift.push(r.id); }
}
if (args.update === 'true') console.log(`\n→ ${path.relative(process.cwd(), SHOTS_DIR)}/<id>.track.json (${real.length} recorded)`);
else if (drift.length) console.log(`\n(${drift.length} track hash${drift.length === 1 ? '' : 'es'} differ from test/shots/: ${drift.join(', ')} — the worlds or the planner changed; --update records them)`);

// ---- 5. budgets
const load = os.loadavg()[0], cores = os.cpus().length, loaded = load > cores * 0.75;
const slowQA = rows.filter(r => r.qaMs > 500);
console.log(`\nplanning ${real.length} houses: ${(planCpu / 1000).toFixed(1)} s of CPU (budget 15 s); QA v2 ${Math.max(...rows.map(r => r.qaMs)).toFixed(0)} ms at worst (budget 500); load average ${load.toFixed(1)} on ${cores} cores`);
check(planCpu <= 15000 || loaded, `planning all the houses in Node within 15 s of CPU${planCpu > 15000 ? ' (over, but the machine is loaded — not counted)' : ''}`);
check(!slowQA.length || loaded, 'QA v2 within 0.5 s a shot', slowQA.map(r => `${r.id} ${r.qaMs.toFixed(0)} ms`).join(', '));

// ---- 4. the page bakes the same track
const parityN = args.parity === 'all' ? real.length : args.parity !== undefined ? parseInt(args.parity, 10) : 2;
if (args['planner-only'] !== 'true' && parityN > 0 && real.length) {
  const pick = real.filter((_, i) => i % Math.max(1, Math.floor(real.length / parityN)) === 0).slice(0, parityN);
  const srv = await serve(ROOT, '/'), pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ headless: true, args: LAUNCH_ARGS });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1200, height: 700 } })).newPage();
    await stubGoogleFonts(page, srv.origin);
    for (const r of pick) {
      await page.goto(srv.url(`room-creator.html?house=${r.id}&planner=v2`), { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, r.id, { timeout: 120000 });
      const got = await page.evaluate(() => { const t = (window as any).__houseShotTrack('door-to-core'); return { hash: t.hash, planner: t.planner, duration: t.duration, samples: t.samples }; });
      check(got.planner === 'v2' && got.hash === r.hash && got.duration === r.duration, `the page's door-to-core track for ${r.id} is the Node bake (${r.hash})`, `page: ${JSON.stringify(got)}\nnode: ${r.hash} ${r.duration} s`);
    }
  } finally { await browser.close(); await srv.close(); }
}
if (args.out) { fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true }); fs.writeFileSync(path.resolve(args.out), JSON.stringify(rows.map(r => ({ id: r.id, duration: r.duration, hash: r.hash, metrics: r.metrics, plan: r.plan, errors: r.errors, warnings: r.warnings, findings: r.findings })), null, 1)); }
console.log(bad ? `\n${bad} check${bad === 1 ? '' : 's'} failed` : '\nall checks passed');
process.exit(bad ? 1 : 0);
