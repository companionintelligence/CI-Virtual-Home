#!/usr/bin/env -S node --experimental-strip-types
// The validator's plugin seam, tested against a COPY of the validator (so a probe plugin never touches
// scripts/validate/): a plugin's `extend` widens a vocabulary, its `replaces` takes a core rule over — every rule in
// RULES, the two S2's polygon plans and angled partitions need included — and the loader refuses what it should.
// @check-house quick
//
//   node --experimental-strip-types scripts/test-validate-plugins.mts        (any cwd; ~3 s)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RULES } from './validate/_types.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail.split('\n').join('\n    ')}`}`); if (!ok) bad++; };

/** the validator, copied beside `plugins` (file name → source) and imported; a load error comes back as `error` */
async function validatorWith(plugins: Record<string, string>): Promise<{ validate?: any; PLUGINS?: any[]; error?: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'house-validate-plugins-'));
  fs.cpSync(path.join(ROOT, 'scripts'), path.join(dir, 'scripts'), { recursive: true, filter: s => !s.includes(`${path.sep}vendor`) });
  for (const f of ['assets', 'content', 'node_modules']) fs.symlinkSync(path.join(ROOT, f), path.join(dir, f));
  const pdir = path.join(dir, 'scripts', 'validate');
  for (const f of fs.readdirSync(pdir)) if (!f.startsWith('_')) fs.rmSync(path.join(pdir, f));   // only the probe plugins
  for (const [f, src] of Object.entries(plugins)) fs.writeFileSync(path.join(pdir, f), src);
  try { return await import(pathToFileURL(path.join(dir, 'scripts', 'validate-house-spec.mts')).href); }
  catch (e) { return { error: String(e && e.message || e) }; }
  finally { setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 0); }
}

// a fixture, not a real content house: every content/houses/*.json is meant to lean on stream vocabulary (S1-S6)
// post pass-4, so a real house is no longer a stable "needs no plugin" baseline — this one is core-vocabulary only
// (rect footprint, axis-aligned partitions, point-free roofs, a numeric shot duration) on purpose, and stays that way.
const house = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'houses', 's2-arch-vanilla.json'), 'utf8'));
const errorsOf = (v: any, spec: any) => v.validate(structuredClone(spec), 's2-arch-vanilla.json').errors as string[];
// a level whose footprint is not a list of rects, a diagonal partition, a pent roof
const polygon = structuredClone(house); polygon.levels[0].footprint = [{ poly: [[0, 0], [4, 0], [4, 3]] }];
const angled = structuredClone(house); angled.levels[0].partitions = [...(angled.levels[0].partitions || []), { from: [1, 1], to: [3, 2.5] }];
const pent = structuredClone(house); pent.roofs = [...(pent.roofs || []), { over: { x: 0, z: 0, w: 4, d: 4 }, y: 2.8, type: 'pent' }];

const none = await validatorWith({});
check(!none.error && none.PLUGINS!.length === 0, 'the validator loads with no plugin', none.error);
check(errorsOf(none, house).length === 0, 's2-arch-vanilla validates clean with none');
check(errorsOf(none, polygon).some(e => /footprint must be a non-empty array of rects/.test(e)), 'core: a polygon footprint is reported');
check(errorsOf(none, angled).some(e => /partition must be axis-aligned/.test(e)), 'core: an angled partition is reported');
check(errorsOf(none, pent).some(e => /pent/.test(e)), 'core: an unknown roof type is reported');

const ok = await validatorWith({
  'probe.mts': `export const extend = { roofTypes: ['pent'] };
    export const replaces = ['footprint-rects', 'partition-axis-aligned'];
    export default (spec, ctx) => [{ level: 'warn', message: 'probe ran; replaced: ' + [...ctx.replaced].sort().join(), code: 'probe' }];`,
});
check(!ok.error, 'a plugin that extends a vocabulary and replaces footprint-rects and partition-axis-aligned loads', ok.error);
if (!ok.error) {
  check(!errorsOf(ok, polygon).some(e => /array of rects/.test(e)), 'replaced footprint-rects: a polygon footprint is not reported by the core');
  check(!errorsOf(ok, angled).some(e => /axis-aligned/.test(e)), 'replaced partition-axis-aligned: an angled partition is not reported');
  check(!errorsOf(ok, pent).some(e => /pent/.test(e)), 'extend.roofTypes: a pent roof is accepted');
  check(errorsOf(ok, house).length === 0, 's2-arch-vanilla still validates clean');
  const r = ok.validate(structuredClone(house), 's2-arch-vanilla.json');
  check(r.warnings.some((w: string) => /probe ran; replaced: footprint-rects,partition-axis-aligned \[probe:probe\]/.test(w)), 'ctx.replaced tells a plugin what the core skips', r.warnings.join('\n'));
}

// every rule in RULES is replaceable, once, and a rule the core does not have is refused
for (const rule of RULES) {
  const v = await validatorWith({ 'a.mts': `export const replaces = ['${rule}']; export default () => [];` });
  check(!v.error, `rule '${rule}' can be replaced`, v.error);
}
const twice = await validatorWith({ 'a.mts': `export const replaces = ['stairs']; export default () => [];`, 'b.mts': `export const replaces = ['stairs']; export default () => [];` });
check(/already replaced by a/.test(twice.error || ''), 'two plugins cannot replace one rule', twice.error);
const unknown = await validatorWith({ 'a.mts': `export const replaces = ['no-such-rule']; export default () => [];` });
check(/not a rule/.test(unknown.error || ''), 'an unknown rule is refused', unknown.error);
const gated = await validatorWith({ 'a.mts': `export const flag = 'layout'; export const replaces = ['stairs']; export default () => [];` });
check(/cannot replace a rule/.test(gated.error || ''), 'a flag-gated plugin cannot replace a rule', gated.error);
const vocab = await validatorWith({ 'a.mts': `export const extend = { nope: ['x'] }; export default () => [];` });
check(/not a vocabulary/.test(vocab.error || ''), 'an unknown vocabulary is refused', vocab.error);

console.log(`${bad ? '✗' : '✓'} validator plugin seam: ${bad} wrong`);
process.exit(bad ? 1 : 0);
