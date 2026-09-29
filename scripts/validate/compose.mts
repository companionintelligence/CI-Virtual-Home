// Validator plugin — owned by S3 (compose): the composer's spec fields (assets/spec/compose.ts). See _types.mts for the
// contract. Always on (layout.mts, S3's other plugin, holds the layout lints and runs only under `validate --layout`).
//
// Errors are for a value the composer cannot read (a program that is not one of the 26, a density of 3, a colour that is
// not '#rrggbb'); warnings for a field that will do nothing (a `kitchen` plan on a bedroom, a `focus` on a room with no
// `program`, so no composer to read it).
import type { Check, Issue } from './_types.mts';
import { PROGRAMS, isProgram } from '../../assets/room-programs.js';
import { STYLE_KEYS } from '../../assets/house-styles.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const SIDES = ['N', 'S', 'E', 'W'];
const FOCUS = ['fireplace', 'tv', 'window', 'art', 'island', 'bed', 'view'];
const KITCHEN_LAYOUTS = ['L', 'U', 'galley', 'single'];
const TOPS = ['stone', 'marble', 'butcher', 'concrete', 'quartz', 'terrazzo'];
const TUBS = ['free', 'built-in', 'none'];
const VANITIES = ['single', 'double', 'pedestal'];
const KITCHENS = new Set(['kitchen', 'kitchen-dining']);
const BATHS = new Set(['bath', 'ensuite', 'powder']);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const oneOf = (v: unknown, list: readonly string[]) => typeof v === 'string' && list.includes(v);
const size = (v: any) => v === true || v === false || (v && typeof v === 'object' && isNum(v.w) && isNum(v.d) && v.w > 0 && v.d > 0);

const check: Check = spec => {
  const out: Issue[] = [];
  const err = (message: string, code: string) => out.push({ level: 'error', message, code: `compose:${code}` });
  const warn = (message: string, code: string) => out.push({ level: 'warn', message, code: `compose:${code}` });

  if (spec.styleKey !== undefined && !oneOf(spec.styleKey, STYLE_KEYS)) err(`styleKey "${spec.styleKey}" is not one of ${STYLE_KEYS.join(', ')}`, 'style-key');

  for (const lv of spec.levels || []) for (const room of lv.rooms || []) {
    const at = `level ${lv.id}, room "${room.name}"`;
    const has = (k: string) => room[k] !== undefined;
    if (has('program') && !isProgram(room.program)) err(`${at}: program "${room.program}" is not one of ${PROGRAMS.join(', ')}`, 'program');
    if (has('lock') && typeof room.lock !== 'boolean') err(`${at}: lock must be true or false`, 'lock');
    if (has('density') && !(isNum(room.density) && room.density >= 0 && room.density <= 1)) err(`${at}: density must be a number from 0 to 1`, 'density');
    if (has('style') && !oneOf(room.style, STYLE_KEYS)) err(`${at}: style "${room.style}" is not one of ${STYLE_KEYS.join(', ')}`, 'style');
    if (has('seed') && !(isNum(room.seed) || typeof room.seed === 'string')) err(`${at}: seed is a string or a number`, 'seed');
    if (has('palette')) {
      const p = room.palette;
      if (!p || typeof p !== 'object') err(`${at}: palette is { fabric, wood, accent }`, 'palette');
      else for (const k of Object.keys(p)) { if (!['fabric', 'wood', 'accent'].includes(k)) err(`${at}: palette.${k} is not a palette role (fabric, wood, accent)`, 'palette'); else if (!HEX.test(p[k])) err(`${at}: palette.${k} "${p[k]}" is not a '#rrggbb' colour`, 'palette'); }
    }
    if (has('focus')) {
      const f = room.focus;
      if (!f || typeof f !== 'object' || !oneOf(f.type, FOCUS)) err(`${at}: focus.type must be one of ${FOCUS.join(', ')}`, 'focus');
      else {
        if (f.wall !== undefined && !oneOf(f.wall, SIDES)) err(`${at}: focus.wall "${f.wall}" is not N, S, E or W`, 'focus');
        if (f.at !== undefined && !(isNum(f.at) || (Array.isArray(f.at) && f.at.length === 2 && f.at.every(isNum)))) err(`${at}: focus.at is a number along the wall or a point [x, z]`, 'focus');
      }
    }
    if (has('kitchen')) {
      const k = room.kitchen;
      if (!k || typeof k !== 'object') err(`${at}: kitchen is { layout, island, peninsula, sinkWall, windowOverSink, top, glassUppers, color }`, 'kitchen');
      else {
        if (k.layout !== undefined && !oneOf(k.layout, KITCHEN_LAYOUTS)) err(`${at}: kitchen.layout must be one of ${KITCHEN_LAYOUTS.join(', ')}`, 'kitchen');
        if (k.island !== undefined && !size(k.island)) err(`${at}: kitchen.island is true, false or { w, d }`, 'kitchen');
        if (k.sinkWall !== undefined && !oneOf(k.sinkWall, SIDES)) err(`${at}: kitchen.sinkWall "${k.sinkWall}" is not N, S, E or W`, 'kitchen');
        if (k.top !== undefined && !oneOf(k.top, TOPS)) err(`${at}: kitchen.top "${k.top}" is not one of ${TOPS.join(', ')}`, 'kitchen');
        if (k.color !== undefined && !HEX.test(k.color)) err(`${at}: kitchen.color "${k.color}" is not a '#rrggbb' colour`, 'kitchen');
        for (const b of ['peninsula', 'windowOverSink', 'glassUppers']) if (k[b] !== undefined && typeof k[b] !== 'boolean') err(`${at}: kitchen.${b} is true or false`, 'kitchen');
        if (k.island && k.peninsula) warn(`${at}: kitchen has both an island and a peninsula; the island wins`, 'kitchen');
      }
      if (isProgram(room.program) && !KITCHENS.has(room.program)) warn(`${at}: a kitchen plan on a ${room.program} room is ignored`, 'inert');
    }
    if (has('bath')) {
      const b = room.bath;
      if (!b || typeof b !== 'object') err(`${at}: bath is { tub, shower, vanity }`, 'bath');
      else {
        if (b.tub !== undefined && !oneOf(b.tub, TUBS)) err(`${at}: bath.tub "${b.tub}" is not one of ${TUBS.join(', ')}`, 'bath');
        if (b.shower !== undefined && !size(b.shower)) err(`${at}: bath.shower is true, false or { w, d }`, 'bath');
        if (b.vanity !== undefined && !oneOf(b.vanity, VANITIES)) err(`${at}: bath.vanity "${b.vanity}" is not one of ${VANITIES.join(', ')}`, 'bath');
      }
      if (isProgram(room.program) && !BATHS.has(room.program)) warn(`${at}: bath fixtures on a ${room.program} room are ignored`, 'inert');
    }
    // the composer's inputs on a room it will not compose
    const inputs = ['focus', 'density', 'style', 'palette', 'seed', 'kitchen', 'bath'].filter(has);
    if (!has('program') && inputs.length) warn(`${at}: ${inputs.join(', ')} ${inputs.length === 1 ? 'does' : 'do'} nothing without a program (no program: the room is never composed)`, 'inert');
    if (room.lock === true && !has('program')) warn(`${at}: lock does nothing without a program`, 'inert');
  }
  return out;
};
export default check;
