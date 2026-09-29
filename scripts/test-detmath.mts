#!/usr/bin/env -S node --experimental-strip-types
// assets/detmath.ts (S5): the elementary functions the planner and QA use in place of Math's, built from + − × ÷ and sqrt only so
// every JS engine returns the same bits (the ECMAScript spec leaves sin, cos, atan2 … implementation-approximated, and Node's V8 and
// Chromium's differ in the last bit for a share of inputs — see the header of that file). This test proves the two things about
// them that can be proved in one engine: they are accurate (within a few ulp of the engine's own, over the ranges the planner uses)
// and their bits are pinned (a fixed grid of inputs hashes to the recorded value — editing detmath.ts changes every baked track,
// so the recorded value changes with it, on purpose). That the browser's engine agrees with Node's is proved by
// scripts/test-shot-planner.mts, which plans every world in both.
//
//   node --experimental-strip-types scripts/test-detmath.mts [--print]
// @check-house quick
import { sin, cos, tan, atan, atan2, asin, acos, exp, log, pow, hypot } from '../assets/detmath.js';

let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail}`}`); };
const M = globalThis.Math;

// ---- accuracy against the engine's own (absolute error, or relative for exp/log/pow) ---------------------------------
const grid = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
const worst = (xs: number[], f: (x: number) => number, g: (x: number) => number, rel = false) => xs.reduce((m, x) => { const d = M.abs(f(x) - g(x)) / (rel ? M.max(1e-300, M.abs(g(x))) : 1); return M.max(m, d); }, 0);
const ANG = grid(-40, 40, 8000), UNIT = grid(-1, 1, 4000), POS = grid(0.001, 60, 6000);
const cases: Array<[string, number, number]> = [
  ['sin', worst(ANG, sin, M.sin), 2e-15], ['cos', worst(ANG, cos, M.cos), 2e-15], ['tan', worst(grid(-1.5, 1.5, 3000), tan, M.tan, true), 1e-14],
  ['atan', worst(grid(-50, 50, 8000), atan, M.atan), 2e-15], ['asin', worst(UNIT.filter(x => M.abs(x) < 0.999999), asin, M.asin), 1e-13], ['acos', worst(UNIT.filter(x => M.abs(x) < 0.999999), acos, M.acos), 1e-13],
  ['exp', worst(grid(-30, 30, 4000), exp, M.exp, true), 1e-14], ['log', worst(POS, log, M.log), 2e-15], ['pow(x, 2.4)', worst(POS, x => pow(x, 2.4), x => M.pow(x, 2.4), true), 1e-13],
];
let a2 = 0; for (const y of grid(-8, 8, 160)) for (const x of grid(-8, 8, 160)) if (x || y) a2 = M.max(a2, M.abs(atan2(y, x) - M.atan2(y, x)));
cases.push(['atan2', a2, 2e-15]);
let h2 = 0; for (const a of grid(-30, 30, 30)) for (const b of grid(-30, 30, 30)) h2 = M.max(h2, M.abs(hypot(a, b) - M.hypot(a, b)) / M.max(1e-300, M.hypot(a, b)));
cases.push(['hypot', h2, 1e-15]);
for (const [n, err, lim] of cases) check(err <= lim, `${n}: worst error ${err.toExponential(1)} (≤ ${lim.toExponential(0)})`);

// ---- the edges the spec pins ---------------------------------------------------------------------------------------------
const same = (a: number, b: number) => Object.is(a, b);
check(same(sin(0), 0) && same(sin(-0), -0) && same(cos(0), 1) && same(atan(0), 0) && same(atan(-0), -0), 'sin/cos/atan at ±0');
check(same(atan2(0, 1), 0) && same(atan2(-0, 1), -0) && same(atan2(0, -1), M.PI) && same(atan2(-0, -1), -M.PI) && same(atan2(1, 0), M.PI / 2) && same(atan2(-1, 0), -M.PI / 2), 'atan2 on the axes');
check(same(atan(Infinity), M.PI / 2) && same(atan2(Infinity, Infinity), M.PI / 4) && same(atan2(1, -Infinity), M.PI) && Number.isNaN(atan2(NaN, 1)) && Number.isNaN(sin(Infinity)), 'infinities and NaN');
check(same(asin(1), M.PI / 2) && same(acos(1), 0) && same(acos(-1), M.PI) && Number.isNaN(asin(1.0001)) && Number.isNaN(acos(-1.0001)), 'asin/acos at ±1 and outside');
check(same(exp(0), 1) && same(log(1), 0) && log(0) === -Infinity && Number.isNaN(log(-1)) && same(pow(2, 10), 1024) && same(pow(2, -2), 0.25) && same(pow(7, 0), 1), 'exp/log/pow specials');

// ---- pinned bits: a fixed grid, hashed ---------------------------------------------------------------------------------
const f64 = new Float64Array(1), u8 = new Uint8Array(f64.buffer);
let h = 0x811c9dc5; const feed = (x: number) => { f64[0] = x; for (let i = 0; i < 8; i++) { h ^= u8[i]; h = M.imul(h, 0x01000193); } };
for (const x of ANG) { feed(sin(x)); feed(cos(x)); feed(atan(x)); feed(exp(x / 4)); }
for (const x of UNIT) { feed(asin(x)); feed(acos(x)); }
for (const x of POS) { feed(log(x)); feed(pow(x, 2.4)); feed(tan(x / 50)); }
for (const y of grid(-8, 8, 40)) for (const x of grid(-8, 8, 40)) { feed(atan2(y, x)); feed(hypot(x, y, 0.5)); }
const bits = (h >>> 0).toString(16).padStart(8, '0');
const PINNED = '8630ba7f';
if (process.argv.includes('--print')) console.log('bits', bits);
check(bits === PINNED, `the bits of ${ANG.length * 4 + UNIT.length * 2 + POS.length * 3 + 41 * 41 * 2} results are pinned (${bits}${bits === PINNED ? '' : `, recorded ${PINNED}: detmath.ts changed — every baked track changes with it; re-record with test-shot-planner --update and edit PINNED`})`);
console.log(bad ? `\n${bad} check${bad === 1 ? '' : 's'} failed` : '\nall checks passed');
process.exit(bad ? 1 : 0);
