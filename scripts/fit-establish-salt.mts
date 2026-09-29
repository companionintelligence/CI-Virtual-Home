#!/usr/bin/env -S node --experimental-strip-types
// Searches the seed of the houses' favourite establishing styles (assets/framing.ts ESTABLISH_SALT) under which the fleet's opening styles and bearings
// are spread evenly — no style on more than 25 % of the houses (plan §3.14, the S5 acceptance). Fleet diversity is deliberately not a runtime input (a house's
// film would then depend on the other houses); the layout pass fixes it with `shots[].establish`. Until it does, the seed is a fitted constant, and it has
// to be fitted again whenever the houses' worlds or the framing change — this is the script.
//
//   node --experimental-strip-types scripts/fit-establish-salt.mts [--from 0] [--to 120] [--jobs 4] [--stale-ok]
// Plans every house's door-to-core once per seed (about 12 s of CPU) from the worlds in test/qa/shot-worlds/, prints the styles and the worst share, and the
// best seeds first. Edit ESTABLISH_SALT to the winner and run `test-shot-planner.mts --update`.
import { spawn } from 'node:child_process';
import { houseIds, parseArgs } from './portal-lib.mts';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './portal-lib.mts';

const args = parseArgs(process.argv.slice(2));
if (args.child) {
  const { planDoorToCore, shotOptions } = await import('../assets/shot-planner.js');
  const ids = houseIds(), from = +args.from, to = +args.to;
  const worlds = new Map(ids.map(id => [id, JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'qa', 'shot-worlds', `${id}.world.json`), 'utf8'))]));
  const specs = new Map(ids.map(id => [id, JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', `${id}.json`), 'utf8'))]));
  for (let n = from; n < to; n++) {
    const salt = `establish-style${n}`, styles: Record<string, number> = {}, buckets: Record<string, number> = {};
    for (const id of ids) {
      const so = shotOptions(specs.get(id), 'door-to-core', 'v2'), r = planDoorToCore(worlds.get(id), { ...so.options, salt });
      if (!r.ok) continue;
      const st = r.track.plan.establish.style, b = Math.floor(r.track.plan.establish.bearing / 15);
      styles[st] = (styles[st] || 0) + 1; buckets[b] = (buckets[b] || 0) + 1;
    }
    const worst = Math.max(...Object.values(styles)), worstB = Math.max(...Object.values(buckets));
    console.log(JSON.stringify({ salt, worst, worstB, styles }));
  }
  process.exit(0);
}
const from = +(args.from ?? 0), to = +(args.to ?? 120), jobs = +(args.jobs ?? 4), per = Math.ceil((to - from) / jobs);
const rows: any[] = [];
await Promise.all(Array.from({ length: jobs }, (_, j) => new Promise<void>(res => {
  const a = from + j * per, b = Math.min(to, a + per);
  const ch = spawn(process.execPath, ['--experimental-strip-types', process.argv[1], '--child', 'true', '--from', String(a), '--to', String(b)], { stdio: ['ignore', 'pipe', 'inherit'] });
  let buf = ''; ch.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { rows.push(JSON.parse(l)); } catch {} } });
  ch.on('close', () => res());
})));
rows.sort((x, y) => x.worst - y.worst || x.worstB - y.worstB);
for (const r of rows.slice(0, 12)) console.log(`${r.salt}: worst style ${r.worst} of 30 (${(r.worst / 30 * 100).toFixed(0)} %), worst bearing bucket ${r.worstB}  ${JSON.stringify(r.styles)}`);
