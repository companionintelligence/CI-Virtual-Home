#!/usr/bin/env -S node --experimental-strip-types
// The isometric twin (scripts/generate_house_iso.py) must draw every S4 form without crashing: a fence along a `path`, a
// wall at an angle, a prop it has no drawing of its own for. It draws the fixtures without a plan.json (the fallback:
// every native handler runs, the seeded kit types are noted as skipped) — a crash in one of them would stop `pnpm run iso`
// for the whole fleet the day a house is authored with the new fields. (With a plan.json the twin draws the built outlines
// of plantings, water and terraces from it; `pnpm run plans --house <fixture> --out <dir>` makes one for a fixture.)
// @check-house quick
//
//   node --experimental-strip-types scripts/test-site-iso.mts        (any cwd; needs python3)
// Exit 0 when every fixture draws; 1 when one crashes; 0 with a note when python3 is not there.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const FIX = path.join(ROOT, 'test', 'fixtures', 'houses');
const files = fs.readdirSync(FIX).filter(f => /^s4-site-.+\.json$/.test(f)).sort();
if (!files.length) { console.error('no S4 fixtures'); process.exit(2); }
if (spawnSync('python3', ['--version']).status !== 0) { console.log('python3 is not installed: the isometric twin is not checked'); process.exit(0); }
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-iso-'));   // a plan-less HOUSES_DIR: the twin's own handlers only
const py = `
import sys, json
from pathlib import Path
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'scripts'))})
import generate_house_iso as g
g.HOUSES_DIR = Path(${JSON.stringify(empty)})
bad = 0
for f in sys.argv[1:]:
    try:
        spec = json.load(open(f))
        svg, r = g.generate_svg(spec, 1920, 1080, False)
        gaps = [n for n in r.skipped if 'not drawn' in n]
        if gaps: bad += 1; print('  ✗', Path(f).stem, gaps)
        else: print('  ✓', Path(f).stem, len(r.items), 'paint items')
    except Exception as e:
        bad += 1; import traceback; print('  ✗', Path(f).stem, repr(e)); traceback.print_exc()
sys.exit(1 if bad else 0)
`;
const r = spawnSync('python3', ['-c', py, ...files.map(f => path.join(FIX, f))], { encoding: 'utf8' });
process.stdout.write(r.stdout); process.stderr.write(r.stderr);
fs.rmSync(empty, { recursive: true, force: true });
if (r.status !== 0) { console.log(`\n✗ the isometric twin crashed on an S4 fixture`); process.exit(1); }
console.log(`\n✓ the isometric twin draws all ${files.length} S4 fixtures (without a plan.json)`);
