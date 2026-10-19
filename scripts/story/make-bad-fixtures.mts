#!/usr/bin/env -S node --experimental-strip-types
// Writes test/fixtures/stories/{bad,ok}-*.json and cases.json from the exemplar (test/fixtures/stories/exemplar.json) and
// scripts/story/lib/bad-cases.mts.
//   node --experimental-strip-types scripts/story/make-bad-fixtures.mts
// Re-run it after changing the exemplar or a case. scripts/test-stories.mts fails when a fixture on disk is not exactly
// "exemplar + this case's mutation", so a stale fixture cannot pass for a negative test it no longer is.
import fs from 'node:fs';
import path from 'node:path';
import { CASES } from './lib/bad-cases.mts';
import { ROOT } from './lib/context.mts';

const dir = path.join(ROOT, 'test', 'fixtures', 'stories');
const base = JSON.parse(fs.readFileSync(path.join(dir, 'exemplar.json'), 'utf8'));
const index: { name: string; file: string; expect: string[]; warn?: string[]; absent?: string[] }[] = [];
for (const f of fs.readdirSync(dir)) if (/^(bad|ok)-.*\.json$/.test(f)) fs.unlinkSync(path.join(dir, f));   // only files this script owns
for (const c of CASES) {
  const s = JSON.parse(JSON.stringify(base));
  c.mutate(s);
  const file = `${c.name}.json`;
  fs.writeFileSync(path.join(dir, file), JSON.stringify(s, null, 2) + '\n');
  index.push({ name: c.name, file, expect: c.expect, ...(c.warn ? { warn: c.warn } : {}), ...(c.absent ? { absent: c.absent } : {}) });
}
fs.writeFileSync(path.join(dir, 'cases.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`wrote ${CASES.length} fixtures and cases.json to ${path.relative(ROOT, dir)}`);
