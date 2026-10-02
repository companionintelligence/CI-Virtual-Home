#!/usr/bin/env -S node --experimental-strip-types
// The portal's binary-asset rules (scripts/portal-assets.mts) against fixtures: a clean tree passes; an unhashed file, an
// unlisted file, a listed file that is missing, a hash that does not match the content, a manifest that is not JSON, an
// assets/media over the limit and an eager module over its limit each fail with a message that names the file.
//
//   node --experimental-strip-types scripts/test-binary-guard.mts
// @check-house quick
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkBinaryAssets, MEDIA_LIMIT, EAGER_LIMIT } from './portal-assets.mts';

let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail}`}`); };
const h8 = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 8);

function tree(setup: (put: (rel: string, data: Buffer | string) => void) => void): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-guard-'));
  setup((rel, data) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), data); });
  return root;
}
// a hashed binary written under `dir`; returns its name
const hashed = (put: (rel: string, d: Buffer | string) => void, dir: string, stem: string, ext: string, data: Buffer): string => { const name = `${stem}-${h8(data)}.${ext}`; put(`${dir}/${name}`, data); return name; };
const run = (name: string, setup: Parameters<typeof tree>[0], expect: RegExp | null) => {
  const root = tree(setup);
  try {
    const r = checkBinaryAssets(root);
    if (!expect) check(r.problems.length === 0, `${name}: passes`, r.problems.join('; '));
    else check(r.problems.some(p => expect.test(p)), `${name}: fails`, r.problems.length ? r.problems.join('; ') : 'it passed');
    return r;
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

const good = Buffer.from('a texture');
const clean = (put: (rel: string, d: Buffer | string) => void) => {
  const a = hashed(put, 'assets/media/assets', 'oak-floor', 'webp', good);
  put('assets/media/assets/files.json', JSON.stringify({ files: [{ file: a, licence: 'CC0' }] }));
  const ao = Buffer.from('volume'); const b = `aurora.${h8(ao)}.bin`; put(`content/ao/${b}`, ao);
  put('content/ao/manifest.json', JSON.stringify({ volumes: { aurora: b } }));
};
const r = run('a clean tree', clean, null);
check(r.ship.length === 3 && r.ship.includes('content/ao/manifest.json'), 'it ships the two listed files and the AO manifest, not files.json', r.ship.join(', '));

run('an unhashed file', put => { clean(put); put('assets/media/assets/wood.webp', 'x'); }, /wood\.webp.*content hash/);
run('an unlisted file', put => { clean(put); hashed(put, 'assets/media/assets', 'extra', 'glb', Buffer.from('model')); }, /extra-[0-9a-f]{8}\.glb is not listed/);
run('an unlisted AO volume', put => { clean(put); put(`content/ao/other.${h8('zz')}.bin`, 'zz'); }, /other\.[0-9a-f]{8}\.bin is not listed/);
run('a missing file', put => { clean(put); put('assets/media/assets/files.json', JSON.stringify({ files: ['gone-0123abcd.webp'] })); }, /gone-0123abcd\.webp is listed .* but missing/);
run('a hash mismatch', put => { clean(put); put('assets/media/assets/stone-deadbeef.webp', 'not that hash'); put('assets/media/assets/files.json', JSON.stringify({ files: ['stone-deadbeef.webp'] })); }, /stone-deadbeef\.webp: the name says deadbeef but the content hashes to/);
run('a manifest that is not JSON', put => { clean(put); put('content/ao/manifest.json', '{'); }, /manifest\.json: not valid JSON/);
run('a file directly in assets/media', put => { clean(put); hashed(put, 'assets/media', 'loose', 'webp', Buffer.from('l')); }, /loose-[0-9a-f]{8}\.webp is not listed/);
run('assets/media over the limit', put => {
  const big = Buffer.alloc(MEDIA_LIMIT + 1024, 7);
  const a = hashed(put, 'assets/media/assets', 'big', 'glb', big);
  put('assets/media/assets/files.json', JSON.stringify([a]));
}, /assets\/media ships 12\.0 MB/);
run('an eager module over its limit', put => { clean(put); put('assets/realism-ao.js', 'x'.repeat(EAGER_LIMIT + 1)); }, /realism-ao\.js is 20\.0 KB/);
run('an eager module under its limit', put => { clean(put); put('assets/realism-ao.js', 'x'.repeat(1000)); put('assets/viewer-ao.js', 'x'.repeat(EAGER_LIMIT * 3)); }, null);

// and the real tree
const real = checkBinaryAssets(path.resolve(import.meta.dirname, '..'));
check(real.problems.length === 0, 'this repository passes its own rules', real.problems.join('; '));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
