#!/usr/bin/env -S node --experimental-strip-types
// Writes test/fixtures/stories/{bad,ok}-*.json and cases.json from the exemplar (test/fixtures/stories/exemplar.json), or from the
// whole family a case names as its `base` (ok-9-story-v3.json for the story v3 cases), and scripts/story/lib/bad-cases.mts.
//   node --experimental-strip-types scripts/story/make-bad-fixtures.mts
// Re-run it after changing the exemplar or a case. scripts/test-stories.mts fails when a fixture on disk is not exactly
// "exemplar + this case's mutation", so a stale fixture cannot pass for a negative test it no longer is.
import fs from 'node:fs';
import path from 'node:path';
import { CASES, STANDALONE } from './lib/bad-cases.mts';
import { ROOT } from './lib/context.mts';

const dir = path.join(ROOT, 'test', 'fixtures', 'stories');
const base = JSON.parse(fs.readFileSync(path.join(dir, 'exemplar.json'), 'utf8'));
const index: { name: string; file: string; expect: string[]; warn?: string[]; absent?: string[]; tolerate?: string[] }[] = [];
for (const f of fs.readdirSync(dir)) if (/^(bad|ok)-.*\.json$/.test(f) && !(STANDALONE as readonly string[]).includes(f)) fs.unlinkSync(path.join(dir, f));   // only files this script owns
const bases = new Map<string, unknown>();                       // a case may start from another whole family (story v3: ok-9-story-v3.json)
const baseOf = (c: { base?: string }): unknown => { const f = c.base ?? 'exemplar.json'; if (!bases.has(f)) bases.set(f, f === 'exemplar.json' ? base : JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); return bases.get(f); };
for (const c of CASES) {
  const s = JSON.parse(JSON.stringify(baseOf(c)));
  c.mutate(s);
  const file = `${c.name}.json`;
  fs.writeFileSync(path.join(dir, file), JSON.stringify(s, null, 2) + '\n');
  index.push({ name: c.name, file, expect: c.expect, ...(c.warn ? { warn: c.warn } : {}), ...(c.absent ? { absent: c.absent } : {}), ...(c.tolerate ? { tolerate: c.tolerate } : {}) });
}
fs.writeFileSync(path.join(dir, 'cases.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`wrote ${CASES.length} fixtures and cases.json to ${path.relative(ROOT, dir)}`);
