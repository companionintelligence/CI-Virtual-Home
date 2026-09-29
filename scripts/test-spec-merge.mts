#!/usr/bin/env -S node --experimental-strip-types
// The merge rule of assets/spec/index.ts, tested: what a stream may do in its fragment compiles, what it may not
// fails, and fails naming the field. The fragments are empty today, so nothing else exercises the rule — and the
// first stream to declare a field would find out a broken rule in a file it may not edit.
// @check-house quick
//
//   node --experimental-strip-types scripts/test-spec-merge.mts        (any cwd; ~10 s)
//
// Each probe copies assets/spec/ to the OS temp dir, appends its edit to a fragment, and runs the repo's own tsc
// with assets/tsconfig.json's options. Exit 0 when every probe behaves.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const SPEC = path.join(ROOT, 'assets', 'spec');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(TSC)) { console.error('no node_modules/typescript — pnpm install first'); process.exit(2); }
const OPTIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tsconfig.json'), 'utf8')).compilerOptions;

type Probe = {
  name: string;
  /** appended to assets/spec/<file>.ts, keyed by the fragment's short name */
  edit?: Record<string, string>;
  /** a file that imports the merged types; its own type errors are what the probe looks for */
  code?: string;
  /** [] = must compile clean; otherwise every entry must appear in the tsc output */
  expect: string[];
};

const probes: Probe[] = [
  {
    name: 'a stream adds fields to room items and site items (the plan puts S1\'s style/chairs, S3\'s src, S4\'s planting here; S4 has its own, so the probe declares two nobody does)',
    edit: {
      kit: 'export interface KitRoomItem { style?: string; chairs?: number }',
      compose: 'export interface ComposeRoomItem { src?: "compose@1" }',
      site: 'export interface SiteSiteItem { probeSmooth?: boolean; probeKind?: string }',
    },
    code: `import type { RoomItem, SiteItem } from './spec/index.ts';
const a: RoomItem = { type: 'fireplace', at: [1, 2], style: 'stone', chairs: 4, src: 'compose@1', anything: 1 };
const b: SiteItem = { type: 'pool', at: [1, 2], w: 3, probeSmooth: true, probeKind: 'oak', other: 'x' };
const t: string = a.type; const at: [number, number] = a.at; const w: number = b.w;`,
    expect: [],
  },
  {
    name: 'the base fields of items keep their types (type, at, rot, w, … are not `unknown`)',
    code: `import type { RoomItem, SiteItem } from './spec/index.ts';
const a: RoomItem = { type: 5, at: 'x' };
const b: SiteItem = { type: 7, at: 3, from: 'nope' };`,
    // line 2: RoomItem's type and at; line 3: SiteItem's type, at and from — one error each, at its column
    expect: ['probe.ts(2,23)', 'probe.ts(2,32)', 'probe.ts(3,23)', 'probe.ts(3,32)', 'probe.ts(3,39)'],
  },
  {
    name: 'a fragment widens a base field (array-valued stairs, an enum value, an object lighting, a duration)',
    edit: {
      arch: `import type { Stairs } from './index.js';
export interface ArchLevel { stairs?: Stairs | Stairs[] }
export interface ArchRoof { type: 'gable' | 'hip' | 'shed' | 'flat' | 'aframe-glass' | 'terracotta' | 'pent' }`,
      kit: `export interface KitSpec { lighting?: string | { preset: string; sunBearing?: number } }
export interface KitHero { surface?: 'desk' | 'credenza' | 'island' | 'shelf' | 'none' | 'console' }`,
      shots: `export interface ShotsShot { duration?: number | 'auto' }`,
    },
    code: `import type { Level, Roof, HouseSpec, Hero, Shot } from './spec/index.ts';
declare const lv: Level; const flights: unknown[] = Array.isArray(lv.stairs) ? lv.stairs : [lv.stairs];
const r: Partial<Roof> = { type: 'pent' }; const h: Partial<Hero> = { surface: 'console' };
const s: Partial<HouseSpec> = { lighting: { preset: 'dusk' } }; const sh: Partial<Shot> = { duration: 'auto' };`,
    expect: [],
  },
  {
    name: 'narrowing a base field fails, naming it',
    edit: { kit: `export interface KitOpening { type: 'door' }` },
    expect: ['TS2344', '"type"'],
  },
  {
    name: 'narrowing a base ITEM field fails, naming it (item fields are typed)',
    edit: { kit: `export interface KitRoomItem { type: 'chair' }`, site: `export interface SiteSiteItem { at?: string }` },
    expect: ['TS2344', '"type"', '"at"'],
  },
  {
    name: 'two fragments declaring a field with DIFFERENT types fail (TS2320 and the one-owner check)',
    edit: {
      kit: `export interface KitHero { chair?: 'task' | 'lounge' | 'none' }`,
      shots: `export interface ShotsHero { chair?: 'tucked' | 'turned' | 'none' }`,
    },
    expect: ['"chair"'],
  },
  {
    name: 'two fragments declaring a field with the SAME type fail too, naming it',
    edit: {
      kit: `export interface KitHero { chair?: { kind: string; pose: string } }`,
      shots: `export interface ShotsHero { chair?: { kind: string; pose: string } }`,
    },
    expect: ['TS2344', '"chair"'],
  },
  {
    name: 'two fragments declaring the same ROOM ITEM field fail',
    edit: { kit: `export interface KitRoomItem { style?: string }`, compose: `export interface ComposeRoomItem { style?: string }` },
    expect: ['TS2344', '"style"'],
  },
];

let failed = 0;
for (const p of probes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'house-spec-merge-'));
  try {
    fs.mkdirSync(path.join(dir, 'spec'));
    for (const f of fs.readdirSync(SPEC)) if (f.endsWith('.ts')) fs.copyFileSync(path.join(SPEC, f), path.join(dir, 'spec', f));
    for (const [frag, text] of Object.entries(p.edit ?? {})) {
      const file = path.join(dir, 'spec', `${frag}.ts`);
      // a fragment's interface is empty (`export interface KitRoomItem {}`): the probe's declaration replaces it, and
      // any import it needs goes to the top
      let src = fs.readFileSync(file, 'utf8');
      const imports = text.split('\n').filter(l => l.startsWith('import ')), body = text.split('\n').filter(l => !l.startsWith('import ')).join('\n');
      for (const m of body.matchAll(/export interface (\w+)/g)) src = src.replace(new RegExp(`export interface ${m[1]} \\{\\}\\n?`), '');
      fs.writeFileSync(file, imports.join('\n') + '\n' + src + '\n' + body + '\n');
    }
    const files = ['spec/index.ts'];
    if (p.code) { fs.writeFileSync(path.join(dir, 'probe.ts'), p.code + '\nexport {};\n'); files.push('probe.ts'); }
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { ...OPTIONS, allowImportingTsExtensions: true, noEmit: true, types: [] }, files }));
    const r = spawnSync(process.execPath, [TSC, '-p', dir, '--pretty', 'false'], { encoding: 'utf8' });
    const out = (r.stdout + r.stderr).split('\n').filter(l => /error TS\d+/.test(l)).join('\n');
    const problems: string[] = [];
    if (!p.expect.length) { if (out) problems.push(`expected a clean compile, got:\n${out}`); }
    else {
      if (!out) problems.push('expected a compile error, got none');
      for (const want of new Set(p.expect)) {
        const wanted = p.expect.filter(w => w === want).length, got = out.split(want).length - 1;
        if (got < wanted) problems.push(`expected ${wanted}× ${JSON.stringify(want)} in the errors, found ${got}:\n${out || '(no errors)'}`);
      }
    }
    console.log(`${problems.length ? '✗' : '✓'} ${p.name}`);
    for (const x of problems) console.log(`    ${x.split('\n').join('\n    ')}`);
    if (problems.length) failed++;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
console.log(`${failed ? '✗' : '✓'} ${probes.length} merge-rule probes: ${failed} wrong`);
process.exit(failed ? 1 : 0);
