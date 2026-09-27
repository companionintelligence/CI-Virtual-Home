#!/usr/bin/env -S node --experimental-strip-types
// Compiles assets/**/*.ts (the house-builder's three.js engine: house-builder.ts,
// site.ts, the props/* registries, wall-compiler.ts, floorplan-graph.ts, house-geometry.ts, materials.ts)
// down to sibling .js files — plain type-stripping per file via esbuild's transform(), NOT bundling, so
// the module graph and every import path stay exactly as they are (room-creator.html's importmap-based
// ES modules, and the Node scripts under scripts/ that import the same files for validation).
//
// Why a build step exists at all here, when the rest of this repo's scripts run .mts directly: these
// files are loaded by a BROWSER (room-creator.html's `<script type="module">`), and no browser executes
// TypeScript natively — Node's --experimental-strip-types has no equivalent on the page. The .js output
// is a build artifact (gitignored); the .ts is the source of truth.
//
// Run after editing anything under assets/*.ts, or via `pnpm run build`. check-house.mts
// runs this itself before its four checks, so the common path never needs a manual step.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const ASSETS = path.resolve(import.meta.dirname, '..', 'assets');

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'vendor') continue; // third-party — not ours to compile
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.ts')) yield p;
  }
}

let count = 0;
for (const file of walk(ASSETS)) {
  const source = readFileSync(file, 'utf8');
  const { code } = await esbuild.transform(source, { loader: 'ts', format: 'esm', target: 'es2022', sourcefile: file });
  writeFileSync(file.replace(/\.ts$/, '.js'), code);
  count++;
}
console.log(`built ${count} browser asset${count === 1 ? '' : 's'} (assets/**/*.ts → *.js)`);
