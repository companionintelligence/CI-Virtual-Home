#!/usr/bin/env -S node --experimental-strip-types
// Validates every HouseSpec and writes content/houses/index.json (the catalog the
// Room Creator <select> and the generators read). Usage: pnpm run index
//   (node --experimental-strip-types scripts/build-house-index.mts — any cwd; paths resolve from this file)
import fs from 'node:fs';
import path from 'node:path';
import { validate } from './validate-house-spec.mts';
import { rectArea } from '../assets/house-geometry.js';
import { apartmentIds, unitStoreys } from './apartment-unit.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const dir = path.join(ROOT, 'content', 'houses');
const rel = path.relative(process.cwd(), dir) || '.';
// .plan.json beside a spec is build output (build-house-plan.mts), not a spec of its own
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort();
// an apartment's spec draws the whole block (reference/APARTMENTS.md), so its `storeys` is the unit's, like its `areaSqm`: scripts/apartment-unit.mts
const apartments = apartmentIds();
const houses = []; let bad = 0;
for (const f of files) {
  const p = path.join(dir, f);
  let spec; try { spec = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.log(`✗ ${f}: ${e.message}`); bad++; continue; }
  const { errors } = validate(spec, p);
  if (errors.length) { console.log(`✗ ${f}: ${errors.length} errors (excluded)`); errors.slice(0, 3).forEach(e => console.log('    ' + e)); bad++; continue; }
  const area = spec.areaSqm || Math.round(spec.levels.reduce((s, l) => s + rectArea(l.footprint), 0));
  houses.push({ id: spec.id, name: spec.name, author: spec.author, emoji: spec.emoji || '🏠', style: spec.style || '', storeys: unitStoreys(spec, apartments), areaSqm: area, source: spec.source || '' });
  console.log(`✓ ${spec.id.padEnd(18)} ${spec.name} — ${spec.author} (${unitStoreys(spec, apartments)} lvl, ${area} m²)`);
}
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ generated: new Date().toISOString(), houses }, null, 2) + '\n');
console.log(`\n${houses.length} houses indexed${bad ? `, ${bad} excluded` : ''} → ${rel}/index.json`);
// (the front page holds no count: scripts/portal-front.mts writes the families word and the count line in words from this list when the portal is built)
process.exit(bad ? 1 : 0);
