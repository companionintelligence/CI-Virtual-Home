#!/usr/bin/env -S node --experimental-strip-types
// Fresh-process determinism of the cost census (RIG fixup): run cost.mts twice, each in its own node process and its own Chromium,
// and require (a) the two output files to be byte-identical and (b) every house they cover to equal the committed cost.json
// house for house. The default houses are the three the skeptic found drifting in their renderer.info.memory counters (familyhome,
// lakecabin, newcrest) plus aurora as a control; --houses all runs the fleet. Browser/GPU job: run it alone, by hand.
//
//   node --experimental-strip-types scripts/review/test-cost-determinism.mts [--houses a,b | all] [--keep] [--strict-product]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { COST_FILE } from './cost.mts';
import { parseArgs, readJson, stableJson, ROOT } from './lib.mts';

const args = parseArgs(process.argv.slice(2));
const houses = args.houses === 'all' ? null : (args.houses && args.houses !== 'true' ? args.houses : 'familyhome,lakecabin,newcrest,aurora');
const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'cost-det-'));
const run = (n: number) => {
  const out = path.join(dir, `run${n}.json`);
  const t0 = Date.now();
  const r = spawnSync('node', ['--experimental-strip-types', path.join(import.meta.dirname, 'cost.mts'), ...(houses ? ['--houses', houses] : []), '--out', out], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0 || !fs.existsSync(out)) { console.error(r.stdout, r.stderr); throw new Error(`run ${n} failed (exit ${r.status})`); }
  console.log(`run ${n}: fresh process, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return out;
};
const a = run(1), b = run(2);
const A = fs.readFileSync(a, 'utf8'), B = fs.readFileSync(b, 'utf8');
let ok = true;
if (A === B) console.log(`✓ the two fresh-process runs are byte-identical (${A.length} bytes)`); else { ok = false; console.log('✗ the two fresh-process runs differ'); }
const base = readJson(COST_FILE), got = JSON.parse(A);
const ids = Object.keys(got.houses);
const bad = ids.filter(i => stableJson(base.houses[i]) !== stableJson(got.houses[i]));
if (bad.length) { ok = false; console.log(`✗ differs from the committed baseline: ${bad.join(', ')}`); } else console.log(`✓ ${ids.length} house(s) equal the committed cost.json house for house (${ids.join(', ')})`);
// the baseline is frozen from baseline/stage0-green; a later HEAD may carry different product trees (BAKE's dormant assets): that is
// information, and house-for-house equality above is the point. --strict-product turns it into a failure (a run AT the tag).
const moved = Object.keys(base.product.tree).filter(k => base.product.tree[k] !== got.product.tree[k]);
if (!moved.length) console.log('✓ product trees equal the committed baseline\'s (this run is from the frozen product code)');
else if (args['strict-product'] === 'true') { ok = false; console.log(`✗ product trees differ from the baseline in: ${moved.join(', ')}`); }
else console.log(`· note: product trees differ from the frozen baseline in ${moved.join(', ')} (HEAD is not at the tag); the compared numbers above still agree`);
if (args.keep !== 'true') fs.rmSync(dir, { recursive: true });
process.exit(ok ? 0 : 1);
