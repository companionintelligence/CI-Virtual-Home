// Shared by the bake scripts, the attribution generator and scripts/test-baked.mts: where things are, and the one JSON layout the
// hand-edited files use.
import fs from 'node:fs';
import path from 'node:path';

export const REPO = path.resolve(import.meta.dirname, '..', '..');
export const MANIFEST = path.join(REPO, 'models', 'manifest.json');
export const PACKS = path.join(REPO, 'models', 'packs.json');
export const readManifest = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
export const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'));

/** JSON for hand-edited files: objects expanded, arrays of plain values on one line. Stable, so a rebake produces no diff noise. */
export function pretty(v: any, ind = ''): string {
  const plain = (x: any) => x === null || typeof x !== 'object';
  if (Array.isArray(v)) {
    if (v.every(plain)) return '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
    return '[\n' + v.map(x => ind + '  ' + pretty(x, ind + '  ')).join(',\n') + '\n' + ind + ']';
  }
  if (v && typeof v === 'object') {
    const ks = Object.keys(v).filter(k => v[k] !== undefined);
    if (!ks.length) return '{}';
    return '{\n' + ks.map(k => ind + '  ' + JSON.stringify(k) + ': ' + pretty(v[k], ind + '  ')).join(',\n') + '\n' + ind + '}';
  }
  return JSON.stringify(v);
}
