// Validator plugin — owned by S1 (kit). See _types.mts for the contract.
//
// Errors: a malformed value in one of S1's own fields (they are new, so no house depends on the fallback a typo
// would silently get): lighting, palette.door / restraint / keep / roofPull, levels[].material, openings[].leaf /
// transom / frame / grid / lantern / head / swing, partitions[].doorColor / doorStyle / doorSwing,
// rooms[].fixtures, hero.surfaceColor / desk / monitor / chair / upstairs.
// Warnings (the plan's lints, promoted after the layout pass):
//   kit:lighting-alias   a legacy preset name (pascal-daylight, ci-twilight …): say day / golden / dusk / night
//   kit:silent-param     an item parameter its builder ignores (item-map.ts ITEM_PARAMS, the registry's params);
//                        a `color` a page builder honours only under defaults 2 says so
//   kit:style            an unknown style / enum value on an item (item-map.ts ITEM_ENUMS)
//   kit:wide-leaf        a door wider than 1.1 m without `leaf`: a leafless cased opening (defaults 2 hangs a pair
//                        up to 1.8 m)
//   kit:fan-over-hero    the hero's room would hang a ceiling fan over the Core
//   kit:no-top           an on-surface item (a monitor, a Core, a lamp) with nothing under it to stand on
// What the core accepts is widened from here, never in validate-house-spec.mts: heroSurfaces gains the kit's
// surface family (item-map.ts HERO_SURFACES).
import fs from 'node:fs';
import path from 'node:path';
import type { Check, Issue } from './_types.mts';
import { ITEM_PARAM_GEN, ITEM_ENUMS, HERO_SURFACES, SURFACE_TYPES, HERO_SET } from '../../assets/item-map.js';
import { TIME_OF_DAY, LIGHTING_ALIASES } from '../../assets/environment.js';
import { KEEP_ROLES, LAMP_KINDS, heroRoom, presetAuthored } from '../../assets/kit-rules.js';
import { fanEligible, roomKind } from '../../assets/fixtures.js';
import { specDefaults } from '../../assets/spec/index.js';

export const extend = { heroSurfaces: [...HERO_SURFACES] };

const COLOUR = /^#[0-9a-fA-F]{6}$/;
const CLAD = ['stucco', 'siding', 'brick', 'stone', 'timber', 'corrugated'];
const LEAVES = ['single', 'double', 'french', 'glazed', 'none'];
const GRIDS = ['none', '2x2', 'vertical', 'prairie'];
const HEADS = ['flat', 'arch', 'segmental'];
// every item takes these; anything else must be one of its builder's parameters
const COMMON = new Set(['type', 'at', 'rot', 'y', 'id', 'note', '$comment', 'src', 'name', 'label', 'lock']);
const ON_SURFACE = new Set(['curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers']);
const HUNG = new Set(['pendant-lamp', 'chandelier', 'ceiling-light']);

// the catalog's measured boxes (content/house-catalog.json) — what the no-top lint stands things on
const CATALOG = (() => { try { return JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', '..', 'content', 'house-catalog.json'), 'utf8')).types || {}; } catch { return {}; } })();
// anything a small thing can stand on: the surface family, and every catalog piece 0.3–1.3 m tall that does not
// itself stand on a surface (tables, cabinets, planters, low walls, beds' nightstands …)
const TOPS = new Set([...SURFACE_TYPES, 'walnut-desk', 'kitchen-island', 'kitchen-cabinetry', 'media-credenza', 'core-shelf', 'bookshelf',
  ...Object.entries(CATALOG).filter(([, c]: any) => !c.surface && c.height >= 0.3 && c.height <= 1.3).map(([t]) => t)]);

const check: Check = (spec, ctx) => {
  const out: Issue[] = [];
  const err = (message: string, code = 'field') => out.push({ level: 'error', message, code });
  const warn = (message: string, code: string) => out.push({ level: 'warn', message, code });
  const d2 = specDefaults(spec) >= 2;
  const isColour = c => typeof c === 'string' && COLOUR.test(c);

  // ---- lighting
  const L = spec.lighting;
  if (L !== undefined) {
    if (L !== null && typeof L === 'object') {
      if (L.preset !== undefined && (typeof L.preset !== 'string' || !(TIME_OF_DAY[L.preset] || LIGHTING_ALIASES[L.preset]))) err(`lighting.preset "${L.preset}" (${Object.keys(TIME_OF_DAY).join(' | ')})`);
      if (L.sunBearing !== undefined && !(typeof L.sunBearing === 'number' && L.sunBearing >= 0 && L.sunBearing < 360)) err(`lighting.sunBearing ${JSON.stringify(L.sunBearing)} (compass degrees, 0 ≤ b < 360: 0 north, 90 east, 180 south)`);
      for (const k of Object.keys(L)) if (!['preset', 'sunBearing'].includes(k)) err(`lighting.${k} is not a lighting field (preset, sunBearing)`);
    } else if (typeof L !== 'string' || !(TIME_OF_DAY[L] || LIGHTING_ALIASES[L])) err(`lighting "${L}" (${Object.keys(TIME_OF_DAY).join(' | ')}, or { preset, sunBearing })`);
    const n = presetAuthored(spec);
    if (typeof n === 'string' && !TIME_OF_DAY[n] && LIGHTING_ALIASES[n]) warn(`lighting "${n}" is a legacy alias of "${LIGHTING_ALIASES[n]}" — name the preset (day | golden | dusk | night)`, 'lighting-alias');
  }

  // ---- palette
  const p = spec.palette || {};
  if (p.door !== undefined && !isColour(p.door)) err(`palette.door "${p.door}" (#rrggbb)`);
  if (p.restraint !== undefined && !(typeof p.restraint === 'number' && p.restraint >= 0 && p.restraint <= 1)) err(`palette.restraint ${JSON.stringify(p.restraint)} (0..1; 1 = today's restraint)`);
  if (p.keep !== undefined && !(Array.isArray(p.keep) && p.keep.every(r => (KEEP_ROLES as readonly string[]).includes(r)))) err(`palette.keep ${JSON.stringify(p.keep)} (a list of ${KEEP_ROLES.join(' | ')})`);
  if (p.roofPull !== undefined && typeof p.roofPull !== 'boolean') err(`palette.roofPull ${JSON.stringify(p.roofPull)} (true | false)`);

  for (const lv of spec.levels || []) {
    const LV = `level ${lv.id}`;
    if (lv.material !== undefined && !CLAD.includes(lv.material)) err(`${LV}: material "${lv.material}" (${CLAD.join(' | ')})`);
    // ---- openings
    for (const op of lv.openings || []) {
      const O = `${LV} opening ${op.type}@${op.side}:${op.at}`;
      if (op.leaf !== undefined && !LEAVES.includes(op.leaf)) err(`${O}: leaf "${op.leaf}" (${LEAVES.join(' | ')})`);
      if (op.transom !== undefined && !(typeof op.transom === 'number' && op.transom > 0.1 && op.transom < 1.5)) err(`${O}: transom ${JSON.stringify(op.transom)} (metres of glass over the door, 0.1–1.5)`);
      if (op.frame !== undefined && !isColour(op.frame)) err(`${O}: frame "${op.frame}" (#rrggbb)`);
      if (op.grid !== undefined && !GRIDS.includes(op.grid)) err(`${O}: grid "${op.grid}" (${GRIDS.join(' | ')})`);
      if (op.lantern !== undefined && typeof op.lantern !== 'boolean') err(`${O}: lantern ${JSON.stringify(op.lantern)} (true | false)`);
      if (op.head !== undefined && !HEADS.includes(op.head)) err(`${O}: head "${op.head}" (${HEADS.join(' | ')})`);
      if (op.swing !== undefined && !['in', 'out'].includes(op.swing)) err(`${O}: swing "${op.swing}" (in | out)`);
      if (op.leaf !== undefined && op.type !== 'door') warn(`${O}: leaf is for doors (a ${op.type} ignores it)`, 'silent-param');
      const hinged = op.type === 'door' && op.style !== 'garage' && op.style !== 'glass-slider';
      if (hinged && op.w > 1.1 && op.leaf === undefined && !(d2 && op.w <= 1.8)) warn(`${O}: a ${op.w} m door is a leafless cased opening — set leaf ('double' | 'french' for a pair, 'none' to say so)${op.w <= 1.8 ? ', or defaults: 2 hangs a pair' : ''}`, 'wide-leaf');
    }
    // ---- partitions
    for (const pt of lv.partitions || []) {
      const P = `${LV} partition ${JSON.stringify(pt.from)}→${JSON.stringify(pt.to)}`;
      if (pt.doorColor !== undefined && !isColour(pt.doorColor)) err(`${P}: doorColor "${pt.doorColor}" (#rrggbb)`);
      if (pt.doorStyle !== undefined && ![...LEAVES, 'cased'].includes(pt.doorStyle)) err(`${P}: doorStyle "${pt.doorStyle}" (${[...LEAVES, 'cased'].join(' | ')})`);
      if (pt.doorSwing !== undefined && !['in', 'out'].includes(pt.doorSwing)) err(`${P}: doorSwing "${pt.doorSwing}" (in | out)`);
      if (pt.door !== null && pt.door !== undefined && (pt.doorW || 0.9) > 1.1 && pt.doorStyle === undefined && !(d2 && pt.doorW <= 1.8) && pt.doorColor !== undefined) warn(`${P}: doorColor on a ${pt.doorW} m doorway, which has no leaf (set doorStyle)`, 'wide-leaf');
    }
    // ---- rooms: fixtures and items
    const catBox = t => CATALOG[t] && CATALOG[t].box;
    for (const r of lv.rooms || []) {
      const R = `${LV} room "${r.name}"`;
      const f = r.fixtures;
      if (f !== undefined) {
        if (!f || typeof f !== 'object' || Array.isArray(f)) err(`${R}: fixtures must be { fan, pendants, ceiling, lamp }`);
        else {
          if (f.fan !== undefined && typeof f.fan !== 'boolean') err(`${R}: fixtures.fan ${JSON.stringify(f.fan)} (true | false)`);
          if (f.pendants !== undefined && !(Number.isInteger(f.pendants) && f.pendants >= 0 && f.pendants <= 6)) err(`${R}: fixtures.pendants ${JSON.stringify(f.pendants)} (0–6)`);
          if (f.ceiling !== undefined && !['flush', 'chandelier', 'none'].includes(f.ceiling)) err(`${R}: fixtures.ceiling "${f.ceiling}" (flush | chandelier | none)`);
          if (f.lamp !== undefined && !(LAMP_KINDS as readonly string[]).includes(f.lamp)) err(`${R}: fixtures.lamp "${f.lamp}" (${LAMP_KINDS.join(' | ')})`);
          for (const k of Object.keys(f)) if (!['fan', 'pendants', 'ceiling', 'lamp'].includes(k)) err(`${R}: fixtures.${k} is not a fixtures field (fan, pendants, ceiling, lamp)`);
        }
      }
      const heroHere = spec.hero && spec.hero.level === lv.id && Array.isArray(spec.hero.at);
      for (const it of r.items || []) {
        const I = `${R} item ${it.type}`;
        // the hero desk set at hero.at is the hero block's, not built from the item (rooms-build.ts)
        if (heroHere && HERO_SET.has(it.type) && Array.isArray(it.at) && Math.hypot(it.at[0] - spec.hero.at[0], it.at[1] - spec.hero.at[1]) < 1.3) continue;
        const page = ITEM_PARAM_GEN[it.type], prop = ctx.props.get(it.type);
        const honoured = page ? page : prop ? Object.fromEntries((prop.params || []).map(k => [k, 1])) : null;
        if (honoured) for (const k of Object.keys(it)) {
          if (COMMON.has(k)) continue;
          if (!(k in honoured)) warn(`${I}: "${k}" is ignored by its builder (${Object.keys(honoured).join(', ') || 'no parameters'})`, 'silent-param');
          else if (honoured[k] === 2 && !d2) warn(`${I}: "${k}" is honoured only under defaults: 2 (without it the item keeps its own colours and skips the house's theme)`, 'silent-param');
        }
        const enums = ITEM_ENUMS[it.type];
        if (enums) for (const [k, vals] of Object.entries(enums)) if (it[k] !== undefined && !(vals as any[]).includes(it[k])) warn(`${I}: ${k} ${JSON.stringify(it[k])} (${(vals as any[]).join(' | ')})`, 'style');
        // on-surface items (a monitor, a Core, speakers, a lamp) default to desk height: something must be under them
        const onTop = ON_SURFACE.has(it.type) || !!(prop && prop.surface);
        if (onTop && it.y === undefined && Array.isArray(it.at)) {
          // the hero's own desk (or shelf, or piece) is a top too, whether or not the room lists it
          const onHero = heroHere && Math.hypot(it.at[0] - spec.hero.at[0], it.at[1] - spec.hero.at[1]) < 1.0 && (spec.hero.surface || 'desk') !== 'none';
          const under = onHero || (lv.rooms || []).flatMap(rr => rr.items || []).some(o => {
            if (o === it || !TOPS.has(o.type) || !Array.isArray(o.at)) return false;
            const b = catBox(o.type); if (!b) return false;
            const q = ((o.rot || 0) % 180 + 180) % 180 === 90, hw = (q ? b[5] - b[2] : b[3] - b[0]) / 2 + 0.05, hd = (q ? b[3] - b[0] : b[5] - b[2]) / 2 + 0.05;
            return Math.abs(it.at[0] - o.at[0]) <= hw && Math.abs(it.at[1] - o.at[1]) <= hd;
          });
          if (!under) warn(`${I} at ${JSON.stringify(it.at)}: an on-surface item with nothing under it — it stands at desk height in the air (put it on a desk, a credenza or a shelf, or give it a y)`, 'no-top');
        }
      }
    }
  }

  // ---- hero
  const h = spec.hero || {};
  if (h.surfaceColor !== undefined && !isColour(h.surfaceColor)) err(`hero.surfaceColor "${h.surfaceColor}" (#rrggbb)`);
  if (h.desk !== undefined) {
    if (!h.desk || typeof h.desk !== 'object') err('hero.desk must be { style, color, w }');
    else {
      if (h.desk.style !== undefined && !['walnut', 'oak', 'white', 'black'].includes(h.desk.style)) err(`hero.desk.style "${h.desk.style}" (walnut | oak | white | black)`);
      if (h.desk.color !== undefined && !isColour(h.desk.color)) err(`hero.desk.color "${h.desk.color}" (#rrggbb)`);
      if (h.desk.w !== undefined && !(typeof h.desk.w === 'number' && h.desk.w >= 1 && h.desk.w <= 2.6)) err(`hero.desk.w ${JSON.stringify(h.desk.w)} (1–2.6 m)`);
    }
    if ((h.surface || 'desk') !== 'desk') warn(`hero.desk is for a desk surface (this hero stands on a ${h.surface})`, 'silent-param');
  }
  if (h.monitor !== undefined && !['curved', 'flat', 'none'].includes(h.monitor)) err(`hero.monitor "${h.monitor}" (curved | flat | none)`);
  if (h.chair !== undefined) {
    const kinds = ['task', 'lounge', 'none'], poses = ['turned', 'tucked'];
    if (typeof h.chair === 'string') { if (!kinds.includes(h.chair)) err(`hero.chair "${h.chair}" (${kinds.join(' | ')}, or { kind, pose })`); }
    else if (!h.chair || typeof h.chair !== 'object') err('hero.chair must be a kind or { kind, pose }');
    else {
      if (h.chair.kind !== undefined && !kinds.includes(h.chair.kind)) err(`hero.chair.kind "${h.chair.kind}" (${kinds.join(' | ')})`);
      if (h.chair.pose !== undefined && !poses.includes(h.chair.pose)) err(`hero.chair.pose "${h.chair.pose}" (${poses.join(' | ')})`);
    }
  }
  if (h.upstairs !== undefined && typeof h.upstairs !== 'boolean') err(`hero.upstairs ${JSON.stringify(h.upstairs)} (true | false)`);
  if (h.shelfWidth !== undefined && !(typeof h.shelfWidth === 'number' && h.shelfWidth >= 0.5 && h.shelfWidth <= 2.4)) err(`hero.shelfWidth ${JSON.stringify(h.shelfWidth)} (metres, 0.5–2.4)`);
  if (h.shelfWidth !== undefined && (h.surface || 'desk') !== 'shelf') warn(`hero.shelfWidth is for a shelf surface (this hero stands on a ${h.surface || 'desk'})`, 'silent-param');

  // ---- a ceiling fan over the Core: the hero's room is a fan room, nothing hung keeps it off, and nothing says no
  const hr = heroRoom(spec);
  if (hr) {
    const f = hr.room.fixtures || {};
    const hung = (hr.room.items || []).some(it => HUNG.has(it.type)) || f.ceiling === 'chandelier';
    const wouldFan = f.fan === true || (f.fan !== false && !d2 && fanEligible(hr.room));
    if (wouldFan && !hung) warn(`a ceiling fan hangs over the Core: room "${hr.room.name}" reads as a ${roomKind(hr.room)} room — name it for what it is, set its fixtures.fan: false, or defaults: 2`, 'fan-over-hero');
  }
  return out;
};
export default check;
