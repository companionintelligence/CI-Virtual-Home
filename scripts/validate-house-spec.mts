#!/usr/bin/env -S node --experimental-strip-types
// Validates HouseSpec v1 JSON files (see reference/HOUSE-SPEC.md).
// Usage: pnpm run validate [--shots [types]] [--jobs N] [files...]
//        (node --experimental-strip-types scripts/validate-house-spec.mts — any cwd; default: content/houses/*.json)
//
// --shots additionally builds each house in headless Chromium and runs the shot QA (render-house-shots.mts
// --qa-only): the door-to-core / orbit / hero-reveal / core-orbit camera paths are sampled against the built
// geometry — wall and floor clips, entering through a wall instead of the door, ending outside the house, Core out
// of frame or occluded on the last frame, and through a Core orbit the Core kept in frame and in sight. Shot errors fail the file like schema errors do, so CI can gate a spec
// before anyone renders it. Needs Playwright's Chromium (see render-house-shots.mts); ~2 s per house × shot.
//
// Plugins: every scripts/validate/*.mts (not "_*") runs after the checks below, in name order — one per stream
// (scripts/validate/_types.mts has the contract). A plugin that exports `flag` runs only when that flag is given:
// `pnpm run validate --layout` runs layout.mts. Plugin issues print like the checks' own, with their code last.
// A plugin also owns its stream's share of the checks below: `extend` adds values to the vocabulary they test
// against (VOCAB: a new roof type, site type, ground …) and `replaces` takes a whole rule over (RULES: the core
// skips it, the plugin checks its own version — S2's stairs arrays, S5's duration 'auto'), so no stream edits
// this file. The item and site types are not listed here at all: they are read off the builders (item-map.ts's
// ITEMS and the prop registry; site-build.ts's SITE, its loop's own types and the site kit's).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { perimeterEdges } from '../assets/house-geometry.js';
import type { Check, ValidateContext } from './validate/_types.mts';
export { perimeterEdges };

import { PROPS } from '../assets/props/index.js';   // registry props are valid item types too
import { createItemMap } from '../assets/item-map.js';
import { createSiteBuild, SITE_LOOP_TYPES } from '../assets/site-build.js';
import { SITE_KIT_TYPES } from '../assets/site.js';
import { probeContext } from './probe-context.mts';
import { VOCAB_KEYS, RULES } from './validate/_types.mts';
import type { Vocab, VocabKey, Rule } from './validate/_types.mts';

// The vocabulary the checks below test against, before the plugins extend it. Item and site types come off the
// builders themselves: their factories are called with a probe context (probe-context.mts) whose every property is a
// callable stand-in, so they may build at factory scope and their keys are still listable.
const BASE_VOCAB: Vocab = {
  sides: ['S', 'N', 'E', 'W'],
  openingTypes: ['door', 'window', 'slider', 'glass', 'garage'],
  roofTypes: ['gable', 'hip', 'shed', 'flat', 'aframe-glass', 'terracotta'],
  floors: ['oak', 'herringbone', 'terrazzo', 'phthalo-terrazzo', 'charcoal-terrazzo', 'marble', 'concrete', 'deck', 'tile', 'grass', 'lawn'],
  grounds: ['lawn', 'desert', 'forest', 'urban', 'waterfront'],
  // site-build.ts's page builders, the ones its site loop builds itself (fence, wall-low), and assets/site.ts's
  // seeded kit (planting, beds, hedges, paths)
  siteTypes: [...Object.keys(createSiteBuild(probeContext()).SITE), ...SITE_LOOP_TYPES, ...SITE_KIT_TYPES],
  // the prop registry, then item-map.ts's page builders
  itemTypes: [...PROPS.keys(), ...Object.keys(createItemMap(probeContext()).ITEMS)],
  stairTypes: ['timber', 'colonial', 'spiral'],
  // shot-planner-v1.ts shotsFor(): the five generated shots, and the dressing a spec may put on one
  shotTypes: ['door-to-core', 'orbit', 'hero-reveal', 'walkthrough', 'core-orbit'],
  shotWalls: ['up', 'cutaway', 'down', 'sims'],
  shotRoofs: ['on', 'off', 'auto'],
  heroDevices: ['chalk', 'charcoal', 'strix'],
  heroPoses: ['prone', 'upright'],
  heroSurfaces: ['desk', 'credenza', 'island', 'shelf', 'none'],
};

const isRect = r => r && ['x', 'z', 'w', 'd'].every(k => typeof r[k] === 'number') && r.w > 0 && r.d > 0;
const inRect = (px, pz, r, tol = 0.01) => px >= r.x - tol && px <= r.x + r.w + tol && pz >= r.z - tol && pz <= r.z + r.d + tol;
const rectInside = (a, rects) => {
  // sample corners + centre
  const pts = [[a.x, a.z], [a.x + a.w, a.z], [a.x, a.z + a.d], [a.x + a.w, a.z + a.d], [a.x + a.w / 2, a.z + a.d / 2]];
  return pts.every(([px, pz]) => rects.some(r => inRect(px, pz, r, 0.05)));
};

// ---- plugins: scripts/validate/*.mts --------------------------------------------------------------------------
type Plugin = { name: string; check: Check; flag: string | null };
const PLUGIN_DIR = path.join(import.meta.dirname, 'validate');
export const PLUGINS: Plugin[] = [];
const vocab = Object.fromEntries(VOCAB_KEYS.map(k => [k, [...BASE_VOCAB[k]]])) as { [K in VocabKey]: string[] };
const replaced = new Map<Rule, string>();   // rule → the plugin that took it over
for (const f of (fs.existsSync(PLUGIN_DIR) ? fs.readdirSync(PLUGIN_DIR) : []).filter(f => f.endsWith('.mts') && !f.startsWith('_')).sort()) {
  const m = await import(pathToFileURL(path.join(PLUGIN_DIR, f)).href), name = f.replace(/\.mts$/, '');
  const where = `scripts/validate/${f}`;
  if (typeof m.default !== 'function') throw new Error(`${where}: no default export (a check(spec, ctx) function)`);
  const flag = typeof m.flag === 'string' ? m.flag : null;
  for (const [k, vals] of Object.entries(m.extend || {})) {
    if (!(VOCAB_KEYS as readonly string[]).includes(k)) throw new Error(`${where}: extend.${k} is not a vocabulary (${VOCAB_KEYS.join(', ')})`);
    if (!Array.isArray(vals) || !vals.every(v => typeof v === 'string')) throw new Error(`${where}: extend.${k} must be a string array`);
    for (const v of vals as string[]) if (!vocab[k].includes(v)) vocab[k].push(v);
  }
  for (const r of m.replaces || []) {
    if (!(RULES as readonly string[]).includes(r)) throw new Error(`${where}: replaces "${r}", which is not a rule (${RULES.join(', ')})`);
    // a flag-gated plugin does not run on a plain validate, so a rule it took over would go unchecked there
    if (flag) throw new Error(`${where}: a --${flag} plugin cannot replace a rule (it does not run without the flag)`);
    if (replaced.has(r)) throw new Error(`${where}: rule "${r}" is already replaced by ${replaced.get(r)}`);
    replaced.set(r, name);
  }
  PLUGINS.push({ name, check: m.default, flag });
}
export const PLUGIN_FLAGS = new Set(PLUGINS.map(p => p.flag).filter(Boolean));
/** the vocabulary after every plugin's `extend` (read-only to plugins: ctx.vocab) */
export const VOCAB: Readonly<Vocab> = vocab;
/** is this core rule still the core's (no plugin `replaces` it)? */
const core = (r: Rule) => !replaced.has(r);
const { sides: SIDES, openingTypes: OPENING_TYPES, roofTypes: ROOF_TYPES, floors: FLOORS, grounds: GROUNDS, siteTypes: SITE_TYPES, itemTypes: ITEM_TYPES,
  stairTypes: STAIR_TYPES, shotTypes: SHOT_TYPES, shotWalls: SHOT_WALLS, shotRoofs: SHOT_ROOFS, heroDevices: HERO_DEVICES, heroPoses: HERO_POSES, heroSurfaces: HERO_SURFACES } = vocab;

export function validate(spec, file = '<spec>', { flags = new Set<string>() }: { flags?: ReadonlySet<string> } = {}) {
  const errors = [], warnings = [];
  const err = m => errors.push(`${file}: ${m}`), warn = m => warnings.push(`${file}: ${m}`);
  for (const k of ['id', 'name', 'author', 'lot', 'palette', 'levels', 'hero', 'entry']) if (!(k in spec)) err(`missing "${k}"`);
  if (spec.id && path.basename(file, '.json') !== spec.id && file !== '<spec>') err(`id "${spec.id}" != file name`);
  if (spec.lot && !(spec.lot.w > 0 && spec.lot.d > 0)) err('lot.w/d must be > 0');
  if (spec.lot && spec.lot.ground && !GROUNDS.includes(spec.lot.ground)) err(`lot.ground "${spec.lot.ground}"`);
  const levelIds = new Set();
  for (const lv of spec.levels || []) {
    const L = `level ${lv.id}`;
    if (!lv.id) err('level without id'); levelIds.add(lv.id);
    if (typeof lv.y !== 'number' || typeof lv.height !== 'number') err(`${L}: y/height required`);
    if (lv.floor && !FLOORS.includes(lv.floor)) err(`${L}: floor "${lv.floor}"`);
    if (!Array.isArray(lv.footprint) || !lv.footprint.length || !lv.footprint.every(isRect)) { if (core('footprint-rects')) err(`${L}: footprint must be a non-empty array of rects`); continue; }
    const edges = perimeterEdges(lv.footprint);
    for (const op of lv.openings || []) {
      const O = `${L} opening ${op.type}@${op.side}:${op.at}`;
      if (!SIDES.includes(op.side)) err(`${O}: bad side`);
      if (!OPENING_TYPES.includes(op.type)) err(`${O}: bad type`);
      if (!(op.w > 0)) err(`${O}: w required`);
      const horiz = op.side === 'S' || op.side === 'N';
      const cand = edges.filter(e => e.side === op.side && (horiz ? (op.at >= e.a[0] - 1e-6 && op.at <= e.b[0] + 1e-6) : (op.at >= e.a[1] - 1e-6 && op.at <= e.b[1] + 1e-6)));
      if (!cand.length) { err(`${O}: no perimeter edge on side ${op.side} contains at=${op.at}`); continue; }
      const e = cand[0];
      const lo = horiz ? e.a[0] : e.a[1], hi = horiz ? e.b[0] : e.b[1];
      if (op.at - op.w / 2 < lo + 0.15 || op.at + op.w / 2 > hi - 0.15) err(`${O}: opening (w=${op.w}) runs past edge [${lo.toFixed(2)}, ${hi.toFixed(2)}]`);
      if (op.edgeZ === undefined) Object.defineProperty(op, '_edge', { value: e, enumerable: false });
    }
    // overlaps on the same side
    const ops = (lv.openings || []).filter(o => o._edge);
    for (let i = 0; i < ops.length; i++) for (let j = i + 1; j < ops.length; j++) {
      const a = ops[i], b = ops[j];
      if (a._edge === b._edge && Math.abs(a.at - b.at) < (a.w + b.w) / 2 + 0.1) err(`${L}: openings ${a.type}@${a.at} and ${b.type}@${b.at} overlap on side ${a.side}`);
    }
    for (const p of lv.partitions || []) {
      if (!Array.isArray(p.from) || !Array.isArray(p.to)) { err(`${L}: partition needs from/to`); continue; }
      if (core('partition-axis-aligned') && Math.abs(p.from[0] - p.to[0]) > 1e-6 && Math.abs(p.from[1] - p.to[1]) > 1e-6) err(`${L}: partition must be axis-aligned`);
      if (!lv.footprint.some(r => inRect(p.from[0], p.from[1], r, 0.05)) || !lv.footprint.some(r => inRect(p.to[0], p.to[1], r, 0.05))) warn(`${L}: partition endpoint outside footprint`);
    }
    if (lv.stairs && core('stairs')) {
      if (!STAIR_TYPES.includes(lv.stairs.type)) err(`${L}: stairs.type "${lv.stairs.type}"`);
      if (!Array.isArray(lv.stairs.at)) err(`${L}: stairs.at required`);
    }
    for (const r of lv.rooms || []) {
      if (!isRect(r.bounds)) { err(`${L}: room "${r.name}" needs bounds rect`); continue; }
      if (!rectInside(r.bounds, lv.footprint)) warn(`${L}: room "${r.name}" bounds extend outside footprint`);
      for (const it of r.items || []) {
        if (!ITEM_TYPES.includes(it.type)) err(`${L}: room "${r.name}" item type "${it.type}" unknown`);
        if (!Array.isArray(it.at)) err(`${L}: item ${it.type} needs at`);
        else if (!inRect(it.at[0], it.at[1], r.bounds, 0.6)) warn(`${L}: item ${it.type} at ${it.at} lies outside room "${r.name}"`);
        if (it.pose !== undefined && (!['chalk-tower', 'charcoal-tower', 'core-shelf'].includes(it.type) || !['prone', 'upright'].includes(it.pose))) err(`${L}: item ${it.type}: pose "${it.pose}" (prone | upright, Companion Core items only)`);
        if (it.type === 'core-shelf' && it.finish !== undefined && !['chalk', 'charcoal'].includes(it.finish)) err(`${L}: core-shelf finish "${it.finish}" (chalk | charcoal)`);
      }
    }
  }
  if (core('raised-level')) for (const lv of spec.levels || []) if (lv.y > 0) {
    const below = (spec.levels || []).find(l => l.stairs && l.stairs.to === lv.id);
    if (!below) err(`level ${lv.id} (y=${lv.y}) has no stairs leading to it`);
    if (!(lv.voids || []).length) warn(`level ${lv.id}: no voids over the stairwell`);
    // a balustrade across the stair's step-off edge fences the landing (the camera and anyone climbing walk
    // straight into it); the rails belong on the void's other edges — the builder's stair top is at + dir × run
    if (below && below.stairs && Array.isArray(below.stairs.at) && below.stairs.type !== 'spiral') {
      const st = below.stairs, run = st.run || 3.36, a = (st.rot || 0) * Math.PI / 180;
      const tx = st.at[0] + Math.sin(a) * run, tz = st.at[1] + Math.cos(a) * run, w = (st.w || 1.1) / 2;
      for (const bl of lv.balustrades || []) {
        if (!Array.isArray(bl.from) || !Array.isArray(bl.to)) continue;
        const alongX = Math.abs(bl.from[1] - bl.to[1]) < 1e-6;
        const lo = Math.min(bl.from[alongX ? 0 : 1], bl.to[alongX ? 0 : 1]), hi = Math.max(bl.from[alongX ? 0 : 1], bl.to[alongX ? 0 : 1]);
        const across = alongX ? Math.abs(tz - bl.from[1]) : Math.abs(tx - bl.from[0]), along = alongX ? tx : tz;
        if (across < 0.45 && along > lo - w && along < hi + w) err(`level ${lv.id}: balustrade ${JSON.stringify(bl.from)}→${JSON.stringify(bl.to)} crosses the stair step-off at (${tx.toFixed(2)}, ${tz.toFixed(2)})`);
      }
    }
  }
  for (const rf of spec.roofs || []) {
    if (!isRect(rf.over)) err('roof.over must be a rect');
    if (!ROOF_TYPES.includes(rf.type)) err(`roof.type "${rf.type}"`);
    if (typeof rf.y !== 'number') err('roof.y (eave elevation) required');
  }
  for (const s of spec.site || []) {
    if (!SITE_TYPES.includes(s.type)) err(`site type "${s.type}" unknown`);
    if (!core('site-needs')) continue;
    const needs = ['fence', 'wall-low'].includes(s.type) ? 'from/to' : ['path', 'hedge'].includes(s.type) ? 'path' : s.type === 'bed' ? 'poly or at' : 'at';
    const ok = needs === 'from/to' ? !!(s.from && s.to) : needs === 'path' ? Array.isArray(s.path) && s.path.length >= 2 : needs === 'poly or at' ? (Array.isArray(s.poly) && s.poly.length >= 3) || Array.isArray(s.at) : Array.isArray(s.at);
    if (!ok) err(`site ${s.type}: needs ${needs}`);
  }
  if (spec.hero) {
    if (!levelIds.has(spec.hero.level)) err(`hero.level "${spec.hero.level}" not a level`);
    const lv = (spec.levels || []).find(l => l.id === spec.hero.level);
    if (lv && Array.isArray(spec.hero.at) && !lv.footprint.some(r => inRect(spec.hero.at[0], spec.hero.at[1], r))) err('hero.at outside footprint');
    if (spec.hero.device !== undefined && !HERO_DEVICES.includes(spec.hero.device)) err(`hero.device "${spec.hero.device}" (${HERO_DEVICES.join(' | ')})`);
    if (spec.hero.pose !== undefined && !HERO_POSES.includes(spec.hero.pose)) err(`hero.pose "${spec.hero.pose}" (${HERO_POSES.join(' | ')})`);
    if (spec.hero.surface !== undefined && !HERO_SURFACES.includes(spec.hero.surface)) err(`hero.surface "${spec.hero.surface}"`);
    if (spec.hero.shelfHeight !== undefined && !(spec.hero.shelfHeight > 0.3 && spec.hero.shelfHeight < 2.2)) err(`hero.shelfHeight ${spec.hero.shelfHeight} (metres, 0.3–2.2)`);
  }
  if (spec.entry) {
    const lv = (spec.levels || []).find(l => l.id === spec.entry.level);
    const match = lv && (lv.openings || []).find(o => o.side === spec.entry.side && Math.abs(o.at - spec.entry.at) < 1e-6 && ['door', 'slider'].includes(o.type));
    if (!match) err('entry does not match a door/slider opening');
  }
  // shots: which generated shot a spec tunes, and how it dresses it. Nothing here was checked before, so a
  // misspelt type was a silently ignored block and the video kept whatever the editor's buttons said.
  const shotSeen = new Map();
  for (const sh of spec.shots || []) {
    const S = `shot ${sh.id || sh.type}`;
    if (!SHOT_TYPES.includes(sh.type)) { err(`${S}: type "${sh.type}" (${SHOT_TYPES.join(' | ')})`); continue; }
    if (core('shot-duration')) {
      if (sh.duration !== undefined && !(sh.duration >= 2 && sh.duration <= 60)) err(`${S}: duration ${sh.duration} (seconds, 2–60)`);
      // door-to-core walks the house, climbs its stairs and orbits the Core: under 8 s the walk is a blur of whip
      // pans (house-builder.ts lays its timing out for the pinned duration and raises the pan budget to fit)
      else if (sh.type === 'door-to-core' && sh.duration !== undefined && sh.duration < 8) err(`${S}: duration ${sh.duration} (door-to-core needs at least 8 s)`);
    }
    if (sh.walls !== undefined && !SHOT_WALLS.includes(sh.walls)) err(`${S}: walls "${sh.walls}" (${SHOT_WALLS.join(' | ')})`);
    if (sh.roof !== undefined && !SHOT_ROOFS.includes(sh.roof)) err(`${S}: roof "${sh.roof}" (${SHOT_ROOFS.join(' | ')})`);
    if (sh.enterT !== undefined && !(sh.enterT >= 0 && sh.enterT <= 1)) err(`${S}: enterT ${sh.enterT} (fraction of the shot, 0–1)`);
    // two entries for one type share one shot object, so the second silently overwrites the first's dressing
    if (shotSeen.has(sh.type)) err(`${S}: type "${sh.type}" is already tuned by "${shotSeen.get(sh.type)}" — they are one shot, so this overwrites it`);
    else shotSeen.set(sh.type, sh.id || sh.type);
  }
  // plugins (scripts/validate/*.mts), after every check above so their findings print after the schema's
  const ctx: ValidateContext = { file, flags, itemTypes: ITEM_TYPES, siteTypes: SITE_TYPES, vocab: VOCAB, replaced: new Set(replaced.keys()), props: PROPS, perimeterEdges };
  for (const pl of PLUGINS) {
    if (pl.flag && !flags.has(pl.flag)) continue;
    let issues;
    try { issues = pl.check(spec, ctx) || []; } catch (e) { err(`validator plugin ${pl.name} threw: ${e.message}`); continue; }
    for (const is of issues) (is.level === 'error' ? err : warn)(is.code ? `${is.message} [${pl.name}:${is.code}]` : is.message);
  }
  return { errors, warnings };
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2);
  const flag = (name, dflt) => { const i = argv.indexOf(`--${name}`); if (i === -1) return null; const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv.splice(i, 2)[1] : (argv.splice(i, 1), dflt); return v; };
  const shots = flag('shots', 'door-to-core,orbit,hero-reveal,core-orbit');
  const jobs = flag('jobs', '3') || '3';
  // plugin flags (`--layout` …): anything else that starts with -- is refused rather than read as a file name
  const pluginFlags = new Set<string>();
  for (const a of argv.filter(x => x.startsWith('--'))) {
    const n = a.slice(2);
    if (!PLUGIN_FLAGS.has(n)) { console.error(`unknown option ${a} (plugin flags: ${[...PLUGIN_FLAGS].map(f => '--' + f).join(', ') || 'none'})`); process.exit(2); }
    pluginFlags.add(n); argv.splice(argv.indexOf(a), 1);
  }
  const files = argv.length ? argv
    // .plan.json beside a spec is build output (build-house-plan.mts), not a spec of its own. Listed relative to
    // the cwd so the report reads `content/houses/aurora.json` from the repo root, wherever the script lives.
    : (houses => fs.readdirSync(houses).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json'))
        .map(f => { const abs = path.join(houses, f), rel = path.relative(process.cwd(), abs); return rel.startsWith('..') ? abs : rel; }))(path.resolve(import.meta.dirname, '..', 'content', 'houses'));
  let bad = 0; const valid = [];
  for (const f of files) {
    let spec;
    try { spec = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`✗ ${f}: invalid JSON — ${e.message}`); bad++; continue; }
    const { errors, warnings } = validate(spec, f, { flags: pluginFlags });
    errors.forEach(e => console.log('  ERROR ' + e)); warnings.forEach(w => console.log('  warn  ' + w));
    console.log(`${errors.length ? '✗' : '✓'} ${f}  (${errors.length} errors, ${warnings.length} warnings)`);
    if (errors.length) bad++; else valid.push({ f, id: spec.id });
  }
  if (shots && valid.length) {
    // the built house is the only place the camera paths exist; render-house-shots.mts --qa-only samples them
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'house-shot-qa-'));
    console.log(`\nshot QA (${shots}) for ${valid.length} house${valid.length === 1 ? '' : 's'} …`);
    const r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(import.meta.dirname, 'render-house-shots.mts'), '--qa-only', '--shot', shots, '--house', valid.map(v => v.id).join(','), '--jobs', jobs, '--out', out], { encoding: 'utf8' });
    const qaFile = path.join(out, 'qa.json');
    if (!fs.existsSync(qaFile)) { console.log(`✗ shot QA did not run: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | ')}`); process.exit(2); }
    const qa = JSON.parse(fs.readFileSync(qaFile, 'utf8')).shots;
    for (const { f, id } of valid) {
      const mine = qa.filter(q => q.id === id);
      const errs = mine.flatMap(q => q.errors.map(e => `${f}: ${q.shot} t=${e.t}${e.tEnd > e.t ? '–' + e.tEnd : ''} ${e.code} — ${e.message}`));
      const warns = mine.flatMap(q => q.warnings.map(w => `${f}: ${q.shot} t=${w.t}${w.tEnd > w.t ? '–' + w.tEnd : ''} ${w.code} — ${w.message}`));
      errs.forEach(e => console.log('  ERROR ' + e)); warns.forEach(w => console.log('  warn  ' + w));
      console.log(`${errs.length ? '✗' : '✓'} ${f}  shots: ${mine.length} checked, ${errs.length} errors, ${warns.length} warnings`);
      if (errs.length) bad++;
    }
    fs.rmSync(out, { recursive: true, force: true });
  }
  process.exit(bad ? 1 : 0);
}
