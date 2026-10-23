#!/usr/bin/env -S node --experimental-strip-types
// Validates every HouseSpec and writes content/houses/index.json (the catalog the
// Room Creator <select> and the generators read). Usage: pnpm run index
//   (node --experimental-strip-types scripts/build-house-index.mts — any cwd; paths resolve from this file)
// A spec with `use: "office"` is an office (reference/office/office-contract-m0.md): it is listed under `offices`, beside `houses`, never in it, so the
// homes' rows are the ones they always were. With no office in the folder the file has no `offices` key at all. `--dir <folder> --out <file>` index
// another folder into another file (the office tests do; the default is content/houses/ into its own index.json).
import fs from 'node:fs';
import path from 'node:path';
import { validate } from './validate-house-spec.mts';
import { rectArea } from '../assets/house-geometry.js';
import { apartmentIds, unitStoreys } from './apartment-unit.mts';
import { specUse } from './lib/list-specs.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const opt = (n: string): string | null => { const i = process.argv.indexOf(`--${n}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null; };
const dir = opt('dir') ? path.resolve(opt('dir')!) : path.join(ROOT, 'content', 'houses');
const outFile = opt('out') ? path.resolve(opt('out')!) : path.join(dir, 'index.json');
// .plan.json beside a spec is build output (build-house-plan.mts), not a spec of its own
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort();
// an apartment's spec draws the whole block (reference/APARTMENTS.md), so its `storeys` is the unit's, like its `areaSqm`: scripts/apartment-unit.mts
const apartments = apartmentIds();
const houses = [], offices = []; let bad = 0;
for (const f of files) {
  const p = path.join(dir, f);
  let spec; try { spec = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.log(`✗ ${f}: ${e.message}`); bad++; continue; }
  const { errors } = validate(spec, p);
  if (errors.length) { console.log(`✗ ${f}: ${errors.length} errors (excluded)`); errors.slice(0, 3).forEach(e => console.log('    ' + e)); bad++; continue; }
  const area = spec.areaSqm || Math.round(spec.levels.reduce((s, l) => s + rectArea(l.footprint), 0));
  if (specUse(spec) === 'office') {
    offices.push({ id: spec.id, name: spec.name, author: spec.author, emoji: spec.emoji || '🏢', style: spec.style || '', storeys: unitStoreys(spec, apartments), areaSqm: area, headcount: spec.office?.headcount, source: spec.source || '' });
    console.log(`✓ ${spec.id.padEnd(18)} ${spec.name} — ${spec.author} (${unitStoreys(spec, apartments)} lvl, ${area} m², office)`);
    continue;
  }
  houses.push({ id: spec.id, name: spec.name, author: spec.author, emoji: spec.emoji || '🏠', style: spec.style || '', storeys: unitStoreys(spec, apartments), areaSqm: area, source: spec.source || '' });
  console.log(`✓ ${spec.id.padEnd(18)} ${spec.name} — ${spec.author} (${unitStoreys(spec, apartments)} lvl, ${area} m²)`);
}
fs.writeFileSync(outFile, JSON.stringify({ generated: new Date().toISOString(), houses, ...(offices.length ? { offices } : {}) }, null, 2) + '\n');
console.log(`\n${houses.length} houses${offices.length ? ` and ${offices.length} office${offices.length === 1 ? '' : 's'}` : ''} indexed${bad ? `, ${bad} excluded` : ''} → ${path.relative(process.cwd(), outFile) || '.'}`);
// (the front page holds no count: scripts/portal-front.mts writes the families word and the count line in words from this list when the portal is built)
process.exit(bad ? 1 : 0);
