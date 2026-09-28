#!/usr/bin/env -S node --experimental-strip-types
// Every spec — the 30 houses and every fixture — type-checked against HouseSpec (assets/spec/index.ts), so a spec
// field the types do not declare, or a value outside a declared enum, fails here instead of drifting silently.
// @check-house quick
//
//   node --experimental-strip-types scripts/test-spec-types.mts [files…]      (any cwd; ~1 s)
//
// assets/spec/ is otherwise documentation: nothing imports the types, and tsc checks only .ts. This writes each
// JSON spec as an object literal typed `HouseSpec` into a throwaway .ts beside nothing (the OS temp dir) and runs
// the repo's own tsc over it, so an object literal's excess-property check and every enum apply. A stream proving a
// new field on its fixture therefore has to declare it in its fragment (assets/spec/<stream>.ts) — which is the
// point: the fragment and what the builder honours stay one list. Exit 0 when every spec compiles.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const HOUSES = path.join(ROOT, 'content', 'houses'), FIXTURES = path.join(ROOT, 'test', 'fixtures', 'houses');
const list = (dir: string) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort().map(f => path.join(dir, f)) : [];
const files = process.argv.slice(2).length ? process.argv.slice(2).map(f => path.resolve(f)) : [...list(HOUSES), ...list(FIXTURES)];
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(TSC)) { console.error('no node_modules/typescript — pnpm install first'); process.exit(2); }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'house-spec-types-'));
try {
  // one declaration per spec; `lines` maps a line of the generated file back to its spec for the report
  const lines: Array<{ from: number; file: string }> = [];
  let out = `import type { HouseSpec } from ${JSON.stringify(path.join(ROOT, 'assets', 'spec', 'index.ts'))};\n`, line = 2;
  for (const [i, f] of files.entries()) {
    const json = fs.readFileSync(f, 'utf8').trim();
    try { JSON.parse(json); } catch (e) { console.log(`✗ ${path.relative(process.cwd(), f)}: invalid JSON — ${e.message}`); process.exitCode = 1; continue; }
    lines.push({ from: line, file: f });
    out += `export const spec${i}: HouseSpec = ${json};\n`;
    line += json.split('\n').length;
  }
  fs.writeFileSync(path.join(dir, 'specs.ts'), out);
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: false, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true },
    files: ['specs.ts'],
  }));
  const r = spawnSync(process.execPath, [TSC, '-p', dir, '--pretty', 'false'], { encoding: 'utf8' });
  const errors = (r.stdout + r.stderr).split('\n').filter(l => /error TS\d+/.test(l));
  const bySpec = new Map<string, string[]>();
  for (const e of errors) {
    const m = e.match(/specs\.ts\((\d+),\d+\): (.*)$/);
    const at = m ? +m[1] : 0, owner = [...lines].reverse().find(l => l.from <= at);
    const key = owner ? path.relative(process.cwd(), owner.file) : '(spec types)';
    const where = owner ? ` (line ${at - owner.from + 1})` : '';
    if (!bySpec.has(key)) bySpec.set(key, []);
    bySpec.get(key)!.push(`${m ? m[2] : e}${where}`);
  }
  for (const [f, errs] of bySpec) { console.log(`✗ ${f}`); for (const e of errs) console.log(`    ${e}`); }
  if (r.status !== 0 && !errors.length) { console.log(`✗ tsc failed: ${(r.stdout + r.stderr).trim().split('\n').slice(-3).join(' | ')}`); process.exitCode = 1; }
  if (errors.length) process.exitCode = 1;
  console.log(`${errors.length ? '✗' : '✓'} ${files.length} specs against HouseSpec (assets/spec/): ${errors.length} type errors`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
