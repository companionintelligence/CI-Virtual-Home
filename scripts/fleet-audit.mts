#!/usr/bin/env -S node --experimental-strip-types
// Fleet audit: how alike the 30 homes are, as numbers (plan Completeness A5). The owner's verdict was "each home
// looks very same" and "the planting is very rectangular and repetitive"; the plan is done when the fleet sameness
// metrics are within target, and this is where they live.
//
//   pnpm run fleet-audit [--out test/qa/fleet-audit.md] [--metric door-colours,…] [--fixtures] [--built] [--baseline]
//   (node --experimental-strip-types scripts/fleet-audit.mts — any cwd; needs `pnpm run build`)
//
// Metrics are registered, not listed here: every scripts/fleet/*.mts (not "_*") exports `metrics`, one file per
// stream (scripts/fleet/_types.mts has the contract), and they run in file then declaration order. Each gets the
// fleet — every spec, plus a CIEDE2000 ΔE and colour helpers — and returns a headline value, pass / fail / null
// against its target, and optionally a detail line and a table. The report is markdown (test/qa/fleet-audit.md,
// gitignored) with a JSON twin beside it; stdout gets the summary table. It never fails: it measures, the layout
// pass and the integration decide.
//
// --fixtures adds test/fixtures/houses/ to the fleet (a stream checking its fixtures move a metric; a fixture has no
// plan). --built rebuilds every house's plan.json from this tree first (scripts/build-house-plan.mts --out
// test/qa/plans), so metrics of what the builders generate measure this branch, not the last integration.
// --baseline writes this run as test/fleet/baseline.json (committed: every run prints it beside each value).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import type { Fleet, Metric, MetricResult } from './fleet/_types.mts';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return a; }, []));
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = args.out ? path.resolve(args.out) : path.join(ROOT, 'test', 'qa', 'fleet-audit.md');
const ONLY = args.metric ? new Set(args.metric.split(',')) : null;
const BASELINE = path.join(ROOT, 'test', 'fleet', 'baseline.json');
if (args.baseline === 'true' && (ONLY || args.fixtures === 'true')) { console.error('--baseline records the whole real fleet: drop --metric / --fixtures'); process.exit(2); }

// ---- the fleet (and, with --built, its plans rebuilt from this tree)
const HOUSES_DIR = path.join(ROOT, 'content', 'houses');
let PLANS_DIR = HOUSES_DIR;
if (args.built === 'true') {
  PLANS_DIR = path.join(ROOT, 'test', 'qa', 'plans');
  console.log(`rebuilding the plans from this tree → ${path.relative(process.cwd(), PLANS_DIR)} …`);
  const ids = fs.readdirSync(HOUSES_DIR).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map(f => f.replace(/\.json$/, ''));
  const r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(import.meta.dirname, 'build-house-plan.mts'), '--house', ids.join(','), '--out', PLANS_DIR], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) { console.error('build-house-plan.mts failed'); process.exit(2); }
}
const planOf = (dir: string, id: string) => { const f = path.join(dir, `${id}.plan.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const readDir = (dir, plans) => fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort()
  .map(f => { const id = f.replace(/\.json$/, ''); return { id, spec: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), plan: plans ? planOf(plans, id) : null }; });
const houses = readDir(HOUSES_DIR, PLANS_DIR)
  .concat(args.fixtures === 'true' && fs.existsSync(path.join(ROOT, 'test', 'fixtures', 'houses')) ? readDir(path.join(ROOT, 'test', 'fixtures', 'houses'), null) : []);
const baseline: { when?: string; results?: Record<string, MetricResult> } = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const baseOf = (id: string): MetricResult | null => (baseline.results && baseline.results[id]) || null;

// ---- colour: sRGB → CIELAB (D65) and CIEDE2000 (Sharma, Wu & Dalal 2005)
const hex = (c: string | number): number => (typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16));
const css = (c: number): string => '#' + (c >>> 0).toString(16).padStart(6, '0');
function lab(c: string | number): [number, number, number] {
  const n = hex(c), lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const [r, g, b] = lin;
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function deltaE(a: string | number, b: string | number): number {
  const [L1, a1, b1] = lab(a), [L2, a2, b2] = lab(b), D = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (x, y) => { if (x === 0 && y === 0) return 0; const v = Math.atan2(y, x) / D; return v < 0 ? v + 360 : v; };
  const h1 = h(a1p, b1), h2 = h(a2p, b2);
  const dL = L2 - L1, dC = C2p - C1p;
  let dh = 0; if (C1p * C2p !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * D / 2);
  const Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1 + h2; if (C1p * C2p !== 0) { hm = Math.abs(h1 - h2) > 180 ? (h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2) : (h1 + h2) / 2; }
  const T = 1 - 0.17 * Math.cos((hm - 30) * D) + 0.24 * Math.cos(2 * hm * D) + 0.32 * Math.cos((3 * hm + 6) * D) - 0.2 * Math.cos((4 * hm - 63) * D);
  const SL = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cmp, SH = 1 + 0.015 * Cmp * T;
  const RT = -2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * D);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
const fleet: Fleet = { houses, deltaE, css, hex };

// ---- the metrics: scripts/fleet/*.mts
const DIR = path.join(import.meta.dirname, 'fleet');
const metrics: Array<Metric & { file: string }> = [];
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.mts') && !f.startsWith('_')).sort()) {
  const m = await import(pathToFileURL(path.join(DIR, f)).href);
  for (const metric of (m.metrics || []) as Metric[]) metrics.push({ ...metric, file: f });
}
const results: Array<{ metric: Metric & { file: string }; result: MetricResult | null; error?: string }> = [];
for (const metric of metrics) {
  if (ONLY && !ONLY.has(metric.id)) continue;
  try { results.push({ metric, result: metric.compute(fleet, { baseline: baseOf(metric.id) }) }); } catch (e) { results.push({ metric, result: null, error: e.message }); }
}

// ---- report
const mark = (p: boolean | null | undefined) => (p === true ? 'pass' : p === false ? 'FAIL' : '—');
const cell = (v: unknown) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = [];
// the baseline beside a value: its own value, and the Δ of the two measures when both have one
const vsBase = (id: string, r: MetricResult | null) => { const b = baseOf(id); if (!b) return '—'; const d = r && typeof r.measure === 'number' && typeof b.measure === 'number' ? ` (Δ ${r.measure - b.measure >= 0 ? '+' : ''}${+(r.measure - b.measure).toFixed(3)})` : ''; return `${b.value}${d}`; };
md.push(`# Fleet audit`, '', `${houses.length} houses${args.fixtures === 'true' ? ' (with fixtures)' : ''}${args.built === 'true' ? ', plans rebuilt from this tree' : ''}, ${new Date().toISOString().slice(0, 10)} — \`pnpm run fleet-audit\` (scripts/fleet-audit.mts; metrics in scripts/fleet/, one file per stream). Baseline: ${baseline.when ? `test/fleet/baseline.json, ${baseline.when.slice(0, 10)}` : 'none'}.`, '');
md.push('| Metric | Stream | Value | Baseline | Target | |', '|---|---|---|---|---|---|');
for (const { metric, result, error } of results) md.push(`| ${cell(metric.title)} | ${metric.stream} | ${cell(error ? `error: ${error}` : result.value)} | ${cell(vsBase(metric.id, result))} | ${cell(metric.target || '—')} | ${error ? 'ERROR' : mark(result.pass)} |`);
for (const { metric, result, error } of results) {
  md.push('', `## ${metric.title} (\`${metric.id}\`, ${metric.stream}, scripts/fleet/${metric.file})`, '');
  if (error) { md.push(`Error: ${error}`); continue; }
  md.push(`**${cell(result.value)}**${metric.target ? ` — target ${metric.target}: ${mark(result.pass)}` : ''}`, '', `Baseline: ${vsBase(metric.id, result)}`);
  if (result.detail) md.push('', result.detail);
  if (result.table && result.table.rows.length) {
    md.push('', `| ${result.table.head.map(cell).join(' | ')} |`, `|${result.table.head.map(() => '---').join('|')}|`);
    for (const r of result.table.rows) md.push(`| ${r.map(cell).join(' | ')} |`);
  }
}
md.push('', 'Not yet a metric: the 30-poster grid per shot (plan A5) — it needs renders (`pnpm run shots --poster-only`), not specs.', '');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md.join('\n'));
fs.writeFileSync(OUT.replace(/\.md$/, '') + '.json', JSON.stringify(results.map(({ metric, result, error }) => ({ id: metric.id, stream: metric.stream, title: metric.title, target: metric.target || null, error: error || null, ...(result || {}) })), null, 1) + '\n');

console.log(`fleet audit — ${houses.length} houses, ${results.length} metrics`);
const w = Math.max(...results.map(r => r.metric.title.length), 10);
for (const { metric, result, error } of results) {
  const b = baseOf(metric.id), d = !error && b && typeof result.measure === 'number' && typeof b.measure === 'number' && result.measure !== b.measure ? `  [Δ ${result.measure - b.measure > 0 ? '+' : ''}${+(result.measure - b.measure).toFixed(3)} against the baseline]` : '';
  console.log(`  ${(error ? 'ERROR' : mark(result.pass)).padEnd(5)} ${metric.stream}  ${metric.title.padEnd(w)}  ${error ? error : result.value}${metric.target ? `   (target ${metric.target})` : ''}${d}`);
}
console.log(`→ ${path.relative(process.cwd(), OUT)}`);
if (args.baseline === 'true') {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, JSON.stringify({ when: new Date().toISOString(), houses: houses.length, built: args.built === 'true',
    results: Object.fromEntries(results.filter(r => !r.error).map(({ metric, result }) => [metric.id, result])) }, null, 1) + '\n');
  console.log(`→ ${path.relative(process.cwd(), BASELINE)} (the baseline)`);
}
