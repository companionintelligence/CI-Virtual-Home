#!/usr/bin/env -S node --experimental-strip-types
// The Python twins (generate_floor_plans.py, generate_house_iso.py) must run on the 30 houses and on every fixture — and
// must draw the architecture S2 adds, not skip it silently.
//
//   node --experimental-strip-types scripts/test-twins.mts [--fixtures-only] [--strict]      (any cwd; ~2 min, needs a GPU
//   for the fixtures' plan.json — the builder resolves the porches, bays and L/U flights the twins draw)
//
// What it does, all into test/qa/ (gitignored), never over the committed scenes/:
//   1. the 30 real specs through both twins (--out test/qa/twins-real): they must exit 0, and their SVGs and Lotties are
//      compared byte for byte with the committed ones — a house that uses no S2 field must draw exactly as it did. A
//      difference is reported (a stream that changes the look regenerates them at integration); `--strict` fails on one;
//   2. every fixture in test/fixtures/houses (build-house-plan.mts --specs → test/qa/twins-specs, then both twins with
//      --specs/--out): they must exit 0, and the S2 fixtures' sheets must carry the marks of what they show (a porch, a U
//      stair, a bay, floor patterns …) — the twin that draws nothing for a field fails here.
// (Not `quick`: the fixtures' plans need a browser, and the two twins take about two minutes — `check` runs it, `check:quick` does not.)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict'), FIXTURES_ONLY = args.has('--fixtures-only');
const QA = path.join(ROOT, 'test', 'qa');
const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'houses');
let failed = 0;
const say = (ok: boolean, msg: string) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed++; };

const run = (cmd: string, argv: string[]) => spawnSync(cmd, argv, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const node = (script: string, argv: string[]) => run(process.execPath, ['--experimental-strip-types', path.join('scripts', script), ...argv]);
const py = (script: string, argv: string[]) => run('python3', [path.join('scripts', script), ...argv]);
const tail = (r: { stdout: string; stderr: string }) => (r.stderr || r.stdout || '').trim().split('\n').slice(-6).join('\n    ');
const walk = (dir: string): string[] => fs.existsSync(dir) ? fs.readdirSync(dir).flatMap(f => { const p = path.join(dir, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; }) : [];

// ---- 1. the 30 houses ------------------------------------------------------------------------------------------------------
if (!FIXTURES_ONLY) {
  const out = path.join(QA, 'twins-real');
  fs.rmSync(out, { recursive: true, force: true });
  const fp = py('generate_floor_plans.py', ['--out', path.join(out, 'floorplans'), '--no-png']);
  say(fp.status === 0, `generate_floor_plans.py on the 30 houses${fp.status === 0 ? '' : '\n    ' + tail(fp)}`);
  const iso = py('generate_house_iso.py', ['--out', out]);
  say(iso.status === 0, `generate_house_iso.py on the 30 houses${iso.status === 0 ? '' : '\n    ' + tail(iso)}`);
  const pairs: Array<[string, string]> = [];
  for (const [src, dst] of [['scenes/floorplans', 'floorplans'], ['scenes/svg', 'svg'], ['scenes/lottie-scenes', 'lottie-scenes']]) {
    for (const f of walk(path.join(ROOT, src))) if (/\.(svg|json)$/.test(f)) pairs.push([f, path.join(out, dst, path.relative(path.join(ROOT, src), f))]);
  }
  const differ = pairs.filter(([a, b]) => !fs.existsSync(b) || !fs.readFileSync(a).equals(fs.readFileSync(b)));
  const note = `${pairs.length - differ.length} of ${pairs.length} committed sheets, isometrics and lotties reproduced byte for byte${differ.length ? `; ${differ.length} differ (${differ.slice(0, 4).map(([a]) => path.basename(a)).join(', ')}${differ.length > 4 ? ' …' : ''}) — regenerate with pnpm run floorplans / iso if the change was meant` : ''}`;
  if (STRICT) say(!differ.length, note); else console.log(`${differ.length ? '~' : '✓'} ${note}`);
}

// ---- 2. the fixtures ---------------------------------------------------------------------------------------------------------
const specs = path.join(QA, 'twins-specs'), fix = path.join(QA, 'twins-fixtures');
fs.rmSync(specs, { recursive: true, force: true }); fs.rmSync(fix, { recursive: true, force: true });
const plans = node('build-house-plan.mts', ['--specs', FIXTURES, '--out', specs]);
say(plans.status === 0, `plan.json for the fixtures${plans.status === 0 ? '' : '\n    ' + tail(plans)}`);
if (plans.status === 0) {
  const fp = py('generate_floor_plans.py', ['--specs', specs, '--out', path.join(fix, 'floorplans'), '--no-png']);
  say(fp.status === 0, `generate_floor_plans.py on the fixtures${fp.status === 0 ? '' : '\n    ' + tail(fp)}`);
  const iso = py('generate_house_iso.py', ['--specs', specs, '--out', fix]);
  say(iso.status === 0, `generate_house_iso.py on the fixtures${iso.status === 0 ? '' : '\n    ' + tail(iso)}`);
  // what each S2 fixture's sheets must show (the class a twin gives what it draws)
  const want: Record<string, Array<[string, string, string]>> = {
    's2-arch-porch': [['floorplans/fp-s2-arch-porch-l1.svg', 'arch-porch', 'a porch'], ['floorplans/fp-s2-arch-porch-l1.svg', 'arch-bay', 'a bay'], ['floorplans/fp-s2-arch-porch-l1.svg', 'arch-loggia', 'a loggia'],
      ['floorplans/fp-s2-arch-porch-l1.svg', 'stairs-U', 'a U stair'], ['floorplans/fp-s2-arch-porch-l1.svg', 'arch-chimney', 'a chimney stack'], ['floorplans/fp-s2-arch-porch-l2.svg', 'arch-balcony', 'a balcony'],
      ['floorplans/fp-s2-arch-porch-l2.svg', 'arch-terrace', 'a terrace'], ['svg/house-s2-arch-porch.svg', 'porch', 'the porch volume']],
    's2-arch-stairs': [['floorplans/fp-s2-arch-stairs-l1.svg', 'stairs-L', 'an L stair'], ['floorplans/fp-s2-arch-stairs-l1.svg', 'stairs-U', 'a U stair'], ['floorplans/fp-s2-arch-stairs-l1.svg', 'stairs-closed', 'a closed stair'],
      ['floorplans/fp-s2-arch-stairs-l2.svg', 'class="void"', 'the autoVoid openings']],
    's2-arch-finishes': [['floorplans/fp-s2-arch-finishes-l1.svg', 'room-floor-herringbone', 'a herringbone floor'], ['floorplans/fp-s2-arch-finishes-l1.svg', 'room-floor-hex-tile', 'a hex-tile floor'],
      ['floorplans/fp-s2-arch-finishes-l1.svg', 'DOUBLE HEIGHT', 'the double-height room'], ['floorplans/fp-s2-arch-finishes-l2.svg', 'OPEN TO BELOW', 'its opening above']],
    's2-arch-facade': [['floorplans/fp-s2-arch-facade-l1.svg', 'arch-stoop', 'the stoop']],
    's2-arch-split': [['floorplans/fp-s2-arch-split-l2.svg', 'arch-stoop', 'the stoop'], ['floorplans/fp-s2-arch-split-l2.svg', 'arch-volume', 'the tower volume']],
  };
  for (const [id, checks] of Object.entries(want)) {
    const missing = checks.filter(([file, mark]) => { const p = path.join(fix, file); return !fs.existsSync(p) || !fs.readFileSync(p, 'utf8').includes(mark); });
    say(!missing.length, `${id}: the twins draw ${checks.map(c => c[2]).join(', ')}${missing.length ? `\n    missing: ${missing.map(m => `${m[2]} (${m[0]}: ${m[1]})`).join('; ')}` : ''}`);
  }
}
console.log(failed ? `\n${failed} failed` : '\nthe twins run on every house and fixture and draw the S2 vocabulary');
process.exit(failed ? 1 : 0);
