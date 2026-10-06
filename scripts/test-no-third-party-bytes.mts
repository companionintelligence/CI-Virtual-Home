#!/usr/bin/env -S node --experimental-strip-types
// No third-party bytes (policy: CLAUDE.md → Licensing). The owner's 3Dinside collection may be used only as baked
// derivatives: geometry and role-named flat materials in assets/props/baked/*.ts, generated from models/manifest.json.
// No source pack, model file, image or texture may sit in the tree, and nothing ships without a manifest entry and a row in
// the one root ATTRIBUTION.md. This test is that rule, enforced:
//
//   1. binary      a file under assets/props/ or models/ whose extension (any case) is in BANNED_EXT: a model, scene, image,
//                  texture, archive or DCC-project format (.glb .fbx .obj .blend .png .webp .tga .dds .ktx2 .usdz .zip .rar
//                  .unitypackage .psd and the rest of the list below), unless it is listed, with a reason, in
//                  scripts/third-party-bytes.allowlist.json (exact paths, no globs). A symlink fails too.
//      oversize    any other file over MAX_BYTES (1 MiB) under those roots, unless allowlisted (a renamed pack file of
//                  that size still fails; a smaller one with a harmless extension is NOT caught: the test reads names and
//                  sizes, never content).
//      allowlist   an entry that is malformed, has no reason, or points at nothing fails.
//   2. baked       an assets/props/baked/<family>.ts module with no entry in models/manifest.json (`family` = the module's
//                  name without `.ts`).
//   3. attribution a manifest entry with no row in ATTRIBUTION.md (a table row whose first cell is the id in backticks).
//                  Guarded off until the generator lands: it switches itself on when scripts/bake/attribution.mts exists.
//   +  the 22-pack register (models/packs.json) is well formed and ATTRIBUTION.md carries a section for every pack.
//
// The manifest contract this test relies on is deliberately minimal: models/manifest.json is { "models": [ { "id", "family",
// … } ] }. If the BAKE stream's schema differs, change MANIFEST_* below in that PR; the self-test pins the contract.
// The self-test builds throw-away trees in the temp directory and proves each rule fails when it should and passes when it
// should not; the last test runs the audit on this checkout.
//
// @check-house node-test
// @check-house quick
//
//   node --experimental-strip-types --test scripts/test-no-third-party-bytes.mts        (pure Node: no browser, no GPU, no build)
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');

export const SCAN_ROOTS = ['assets/props', 'models'];
/** Compared case-insensitively against the last extension of a file name (`a.tar.gz` is `.gz`). */
export const BANNED_EXT = [
  // models and scenes
  '.glb', '.gltf', '.fbx', '.dae', '.obj', '.mtl', '.3ds', '.stl', '.ply', '.usd', '.usda', '.usdc', '.usdz', '.abc',
  '.vrm', '.wrl', '.skp', '.3mf', '.lwo', '.x3d', '.off', '.dxf', '.ifc', '.pmx', '.uasset', '.bin',
  // DCC projects and engine packages
  '.blend', '.blend1', '.max', '.ma', '.mb', '.c4d', '.psd', '.unitypackage',
  // images and textures
  '.png', '.jpg', '.jpeg', '.exr', '.webp', '.gif', '.tga', '.tif', '.tiff', '.bmp', '.hdr', '.dds', '.ktx', '.ktx2', '.basis',
  '.svg', '.avif', '.heic', '.jp2', '.jxl', '.ico', '.pdf', '.raw', '.dng', '.xcf',
  // archives that could carry any of the above
  '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.zst', '.lz4', '.iso', '.dmg', '.jar', '.cab',
];
/** A file over this size under a scanned root fails unless allowlisted: baked modules and manifests are far smaller. */
export const MAX_BYTES = 1024 * 1024;
export const ALLOWLIST_FILE = 'scripts/third-party-bytes.allowlist.json';
export const BAKED_DIR = 'assets/props/baked';
export const MANIFEST_FILE = 'models/manifest.json';
export const PACKS_FILE = 'models/packs.json';
export const ATTRIBUTION_FILE = 'ATTRIBUTION.md';
export const GENERATOR_FILE = 'scripts/bake/attribution.mts';   // its arrival switches the attribution-row rule on

export type Finding = { rule: string; path: string; why: string };

const read = (root: string, rel: string): string | null => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return null; } };
type Json = { ok: boolean; value?: any; why?: string };   // (tsconfig is not strict: a union on `ok` would not narrow)
const readJson = (root: string, rel: string): Json => {
  const text = read(root, rel);
  if (text === null) return { ok: false, why: 'missing' };
  try { return { ok: true, value: JSON.parse(text) }; } catch (e) { return { ok: false, why: `not valid JSON (${(e as Error).message})` }; }
};

/** Every non-directory entry under dir, as a posix path relative to root, in sorted order; symlinks are reported, never followed. */
function walk(root: string, rel: string, files: string[], links: string[]): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const r = path.posix.join(rel, e.name);
    if (e.isSymbolicLink()) links.push(r);
    else if (e.isDirectory()) walk(root, r, files, links);
    else files.push(r);
  }
}

const inScanRoot = (p: string) => SCAN_ROOTS.some(r => p.startsWith(r + '/'));

/** Run every rule against the tree at root. `checkAttribution` is rule 3. Returns the findings (none = clean). */
export function audit(root: string, opts: { checkAttribution: boolean }): Finding[] {
  const out: Finding[] = [];
  const files: string[] = [], links: string[] = [];
  for (const r of SCAN_ROOTS) walk(root, r, files, links);

  // the allowlist: exact paths, each with a reason, each pointing at a file that exists
  const allowed = new Set<string>();
  const al = readJson(root, ALLOWLIST_FILE);
  if (al.ok) {
    const list = al.value && Array.isArray(al.value.allow) ? al.value.allow : null;
    if (!list) out.push({ rule: 'allowlist', path: ALLOWLIST_FILE, why: 'must be { "allow": [ { "path", "reason" } ] }' });
    else for (const [i, ent] of list.entries()) {
      const p = ent && typeof ent.path === 'string' ? ent.path : '';
      const where = `${ALLOWLIST_FILE} entry ${i}`;
      if (!p || p.startsWith('/') || p.split('/').includes('..') || p.includes('\\') || !inScanRoot(p)) { out.push({ rule: 'allowlist', path: where, why: `path "${p}" must be a posix path under ${SCAN_ROOTS.join(' or ')}` }); continue; }
      if (typeof ent.reason !== 'string' || ent.reason.trim().length < 10) { out.push({ rule: 'allowlist', path: p, why: 'needs a written reason (at least 10 characters): where the bytes come from and why they may ship' }); continue; }
      if (allowed.has(p)) { out.push({ rule: 'allowlist', path: p, why: 'listed twice' }); continue; }
      allowed.add(p);
      if (!files.includes(p)) out.push({ rule: 'allowlist-stale', path: p, why: 'listed in the allowlist but not on disk: remove the entry' });
    }
  } else if (al.why !== 'missing') out.push({ rule: 'allowlist', path: ALLOWLIST_FILE, why: al.why });

  // 1. binary
  for (const l of links) out.push({ rule: 'symlink', path: l, why: 'a symlink under assets/props/ or models/ could point at a pack outside the repo' });
  for (const f of files) {
    const ext = path.posix.extname(f).toLowerCase();
    if (allowed.has(f)) continue;
    if (BANNED_EXT.includes(ext)) { out.push({ rule: 'binary', path: f, why: `${ext} is a model, image, texture or archive format: only baked modules may ship, never a pack file (CLAUDE.md, Licensing)` }); continue; }
    let size = 0;
    try { size = fs.lstatSync(path.join(root, f)).size; } catch { /* vanished while scanning: nothing to measure */ }
    if (size > MAX_BYTES) out.push({ rule: 'oversize', path: f, why: `${size} bytes is over the ${MAX_BYTES}-byte limit for a file under assets/props/ or models/: a pack file can hide under any name (CLAUDE.md, Licensing)` });
  }

  // 2. baked modules need a manifest entry
  const manifest = readJson(root, MANIFEST_FILE);
  const models: Array<{ id?: unknown; family?: unknown }> = manifest.ok && manifest.value && Array.isArray(manifest.value.models) ? manifest.value.models : [];
  if (manifest.ok && !(manifest.value && Array.isArray(manifest.value.models))) out.push({ rule: 'manifest', path: MANIFEST_FILE, why: 'must be { "models": [ { "id", "family" } ] }' });
  if (!manifest.ok && manifest.why !== 'missing') out.push({ rule: 'manifest', path: MANIFEST_FILE, why: manifest.why });
  const families = new Set(models.filter(m => m && typeof m.family === 'string').map(m => m.family as string));
  for (const f of files) {
    if (!f.startsWith(BAKED_DIR + '/') || !f.endsWith('.ts')) continue;
    const family = f.slice(BAKED_DIR.length + 1, -'.ts'.length);
    if (!families.has(family)) out.push({ rule: 'baked', path: f, why: `no entry with family "${family}" in ${MANIFEST_FILE}${manifest.ok ? '' : ` (${manifest.why})`}` });
  }

  // 3. manifest entries need an ATTRIBUTION.md row (guarded)
  if (opts.checkAttribution) {
    const text = read(root, ATTRIBUTION_FILE);
    if (text === null) out.push({ rule: 'attribution', path: ATTRIBUTION_FILE, why: 'missing' });
    else for (const m of models) {
      const id = m && typeof m.id === 'string' ? m.id : '';
      if (!id) { out.push({ rule: 'manifest', path: MANIFEST_FILE, why: 'an entry has no string "id"' }); continue; }
      const row = new RegExp('^\\| `' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '` \\|', 'm');
      if (!row.test(text)) out.push({ rule: 'attribution', path: `${MANIFEST_FILE}#${id}`, why: `no table row for \`${id}\` in ${ATTRIBUTION_FILE}` });
    }
  }
  return out;
}

const describe = (fs_: Finding[]) => fs_.map(f => `  [${f.rule}] ${f.path}: ${f.why}`).join('\n');

// ---- throw-away trees for the self-test ------------------------------------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-tpb-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let seq = 0;
function tree(files: Record<string, string>): string {
  const root = path.join(TMP, `t${++seq}`);
  for (const [rel, body] of Object.entries(files)) { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); }
  fs.mkdirSync(root, { recursive: true });
  return root;
}
const rules = (fs_: Finding[]) => fs_.map(f => f.rule);
const OFF = { checkAttribution: false }, ON = { checkAttribution: true };
const allow = (...p: string[]) => JSON.stringify({ allow: p.map(path => ({ path, reason: 'a fixture reason that is long enough' })) });
const manifest = (...m: Array<{ id: string; family: string }>) => JSON.stringify({ models: m });
const attrib = (...ids: string[]) => ['# ATTRIBUTION', '', '| Model id | Prop type |', '|---|---|', ...ids.map(i => `| \`${i}\` | x |`), ''].join('\n');

test('self-test: a tree with no model, image or baked module is clean', () => {
  assert.deepEqual(audit(tree({ 'assets/props/index.ts': '', 'models/packs.json': '{}' }), OFF), []);
  assert.deepEqual(audit(tree({}), OFF), []);
  assert.deepEqual(audit(tree({ 'assets/props/index.ts': '', [ATTRIBUTION_FILE]: attrib() }), ON), [], 'rule 3 on: a root ATTRIBUTION.md and no models is clean');
  assert.deepEqual(rules(audit(tree({}), ON)), ['attribution'], 'rule 3 on: the root ATTRIBUTION.md must exist');
});

test('self-test rule 1: every banned extension fails, under both roots, at any depth and in any case', () => {
  for (const ext of BANNED_EXT) {
    for (const where of ['assets/props/a', 'models/x/y/a', 'models/a']) {
      for (const e of [ext, ext.toUpperCase()]) {
        const f = audit(tree({ [`${where}${e}`]: 'bytes' }), OFF);
        assert.deepEqual(rules(f), ['binary'], `${where}${e}\n${describe(f)}`);
      }
    }
  }
});

test('self-test rule 1: text and code beside the banned formats pass, and other directories are not scanned', () => {
  const f = audit(tree({
    'assets/props/baked/x.ts': 'export default {}', 'assets/props/notes.md': '', 'models/roles/wood.json': '{}', 'models/readme.txt': '',
    'assets/other/a.png': 'bytes', 'test/goldens/macos-metal/a.png': 'bytes', 'content/a.glb': 'bytes', 'portal/a.jpg': 'bytes',
    'models/manifest.json': manifest({ id: 'a', family: 'x' }),
  }), OFF);
  assert.deepEqual(f, [], describe(f));
});

// The classes below are written out literally (not derived from BANNED_EXT), so deleting an extension from the constant fails here.
const CLASSES: Record<string, string[]> = {
  image: ['.webp', '.gif', '.bmp', '.tif', '.tiff', '.svg', '.avif', '.heic', '.jp2', '.jxl', '.ico', '.pdf', '.raw', '.dng', '.xcf'],
  texture: ['.tga', '.hdr', '.dds', '.ktx', '.ktx2', '.basis'],
  'model or scene': ['.mtl', '.3ds', '.stl', '.ply', '.usd', '.usda', '.usdc', '.usdz', '.abc', '.vrm', '.wrl', '.skp', '.3mf', '.lwo', '.x3d', '.off', '.dxf', '.ifc', '.pmx', '.uasset', '.bin'],
  archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.unitypackage', '.tgz', '.bz2', '.xz', '.zst', '.lz4', '.iso', '.dmg', '.jar', '.cab'],
  'DCC project': ['.psd', '.max', '.ma', '.mb', '.c4d'],
  'original formats': ['.glb', '.gltf', '.fbx', '.dae', '.obj', '.blend', '.blend1', '.png', '.jpg', '.jpeg', '.exr'],
};
for (const [cls, exts] of Object.entries(CLASSES)) {
  test(`self-test rule 1: the ${cls} class (${exts.join(' ')}) fails in any case and passes when allowlisted`, () => {
    for (const ext of exts) {
      assert.ok(BANNED_EXT.includes(ext), `${ext} is in BANNED_EXT`);
      for (const name of [`models/pack/a${ext}`, `assets/props/a${ext.toUpperCase()}`, `models/deep/er/Mixed${ext[0]}${ext.slice(1).toUpperCase()}`]) {
        const f = audit(tree({ [name]: 'bytes' }), OFF);
        assert.deepEqual(rules(f), ['binary'], `${name}\n${describe(f)}`);
      }
      assert.deepEqual(audit(tree({ [`models/p/a${ext}`]: 'b', [ALLOWLIST_FILE]: allow(`models/p/a${ext}`) }), OFF), [], `${ext} allowlisted`);
    }
  });
}

test('self-test rule 1: a double extension is judged by its last part (pack.fbx.zip, scene.tar.gz fail; notes.fbx.md passes)', () => {
  assert.deepEqual(rules(audit(tree({ 'models/pack.fbx.zip': 'b' }), OFF)), ['binary']);
  assert.deepEqual(rules(audit(tree({ 'models/scene.tar.gz': 'b' }), OFF)), ['binary']);
  assert.deepEqual(audit(tree({ 'models/notes.fbx.md': 'text' }), OFF), []);
});

test('self-test oversize: a file over 1 MiB under either root fails whatever its name, unless allowlisted; at the limit it passes', () => {
  const over = 'x'.repeat(MAX_BYTES + 1), exact = 'x'.repeat(MAX_BYTES);
  for (const name of ['models/a.txt', 'models/deep/a.json', 'models/noext', 'assets/props/a.ts', 'assets/props/baked/storage.ts', 'assets/props/data.dat', 'models/a.bak']) {
    const files: Record<string, string> = { [name]: over };
    if (name === 'assets/props/baked/storage.ts') files[MANIFEST_FILE] = manifest({ id: 'a', family: 'storage' });
    const f = audit(tree(files), OFF);
    assert.deepEqual(f.map(x => `${x.rule}:${x.path}`), [`oversize:${name}`], `${name}\n${describe(f)}`);
    assert.deepEqual(audit(tree({ ...files, [ALLOWLIST_FILE]: allow(name) }), OFF), [], `${name} allowlisted`);
  }
  assert.deepEqual(audit(tree({ 'models/a.txt': exact }), OFF), [], 'exactly MAX_BYTES passes');
  assert.deepEqual(rules(audit(tree({ 'models/a.glb': over }), OFF)), ['binary'], 'a banned extension is one finding, not two');
  assert.deepEqual(audit(tree({ 'content/a.txt': over, 'portal/b.bin': over }), OFF), [], 'other directories are not measured');
  const neighbour = tree({ 'models/big.txt': over, 'models/other.txt': over, [ALLOWLIST_FILE]: allow('models/big.txt') });
  assert.deepEqual(audit(neighbour, OFF).map(f => f.path), ['models/other.txt'], 'the allowlist is exact paths');
});

test('self-test rule 1: an allowlisted file passes; an unlisted neighbour still fails; the entry needs a reason and a file', () => {
  const ok = tree({ 'models/preview/a.png': 'b', [ALLOWLIST_FILE]: allow('models/preview/a.png') });
  assert.deepEqual(audit(ok, OFF), []);
  const neighbour = tree({ 'models/preview/a.png': 'b', 'models/preview/b.png': 'b', [ALLOWLIST_FILE]: allow('models/preview/a.png') });
  assert.deepEqual(audit(neighbour, OFF).map(f => `${f.rule}:${f.path}`), ['binary:models/preview/b.png']);
  const stale = tree({ [ALLOWLIST_FILE]: allow('models/preview/gone.png') });
  assert.deepEqual(rules(audit(stale, OFF)), ['allowlist-stale']);
  const noReason = tree({ 'models/a.png': 'b', [ALLOWLIST_FILE]: JSON.stringify({ allow: [{ path: 'models/a.png' }] }) });
  assert.deepEqual(rules(audit(noReason, OFF)).sort(), ['allowlist', 'binary']);
  const shortReason = tree({ 'models/a.png': 'b', [ALLOWLIST_FILE]: JSON.stringify({ allow: [{ path: 'models/a.png', reason: 'ok' }] }) });
  assert.deepEqual(rules(audit(shortReason, OFF)).sort(), ['allowlist', 'binary']);
  const dup = tree({ 'models/a.png': 'b', [ALLOWLIST_FILE]: allow('models/a.png', 'models/a.png') });
  assert.deepEqual(rules(audit(dup, OFF)), ['allowlist']);
});

test('self-test rule 1: the allowlist cannot reach outside the scanned roots, use .. or a leading slash, or be malformed', () => {
  for (const p of ['content/a.png', '/models/a.png', 'models/../content/a.png', 'models\\a.png', '', 'models']) {
    const f = audit(tree({ [ALLOWLIST_FILE]: allow(p) }), OFF);
    assert.deepEqual(rules(f), ['allowlist'], `"${p}"\n${describe(f)}`);
  }
  assert.deepEqual(rules(audit(tree({ [ALLOWLIST_FILE]: '{ not json' }), OFF)), ['allowlist']);
  assert.deepEqual(rules(audit(tree({ [ALLOWLIST_FILE]: '[]' }), OFF)), ['allowlist']);
});

test('self-test rule 1: a symlink under a scanned root fails (it could point at a pack outside the repo)', t => {
  const root = tree({ 'models/x.txt': '' });
  try { fs.symlinkSync(TMP, path.join(root, 'models', 'pack-link')); } catch { t.skip('symlinks are not available here'); return; }
  assert.deepEqual(rules(audit(root, OFF)), ['symlink']);
});

test('self-test rule 2: a baked module needs a manifest entry of its family', () => {
  assert.deepEqual(rules(audit(tree({ 'assets/props/baked/storage.ts': '' }), OFF)), ['baked'], 'no manifest at all');
  assert.deepEqual(rules(audit(tree({ 'assets/props/baked/storage.ts': '', [MANIFEST_FILE]: manifest({ id: 'a', family: 'seating' }) }), OFF)), ['baked'], 'only another family');
  assert.deepEqual(rules(audit(tree({ 'assets/props/baked/storage.ts': '', [MANIFEST_FILE]: '{' }), OFF)).sort(), ['baked', 'manifest'], 'unreadable manifest');
  assert.deepEqual(rules(audit(tree({ 'assets/props/baked/storage.ts': '', [MANIFEST_FILE]: '{"entries":[]}' }), OFF)).sort(), ['baked', 'manifest'], 'wrong shape');
  assert.deepEqual(audit(tree({ 'assets/props/baked/storage.ts': '', [MANIFEST_FILE]: manifest({ id: 'a', family: 'storage' }) }), OFF), [], 'entry present');
  const two = tree({ 'assets/props/baked/storage.ts': '', 'assets/props/baked/garage.ts': '', [MANIFEST_FILE]: manifest({ id: 'a', family: 'storage' }) });
  assert.deepEqual(audit(two, OFF).map(f => f.path), ['assets/props/baked/garage.ts'], 'one of two modules');
  assert.deepEqual(audit(tree({ 'assets/props/baked/sub/deep.ts': '', [MANIFEST_FILE]: manifest({ id: 'a', family: 'deep' }) }), OFF).map(f => f.path), ['assets/props/baked/sub/deep.ts'], 'nested modules are named by their path');
  assert.deepEqual(audit(tree({ 'assets/props/baked.ts': '', 'assets/props/baked/notes.md': '' }), OFF), [], 'the runtime baked.ts and non-ts files are not modules');
});

test('self-test rule 3: a manifest entry needs an ATTRIBUTION.md row, only while the rule is on', () => {
  const m = manifest({ id: 'chesterfield-a', family: 'seating' }, { id: 'nightstand-a', family: 'seating' });
  const base = { 'assets/props/baked/seating.ts': '', [MANIFEST_FILE]: m };
  assert.deepEqual(audit(tree(base), OFF), [], 'guard off: no ATTRIBUTION.md needed');
  assert.deepEqual(rules(audit(tree(base), ON)), ['attribution'], 'on and ATTRIBUTION.md missing');
  assert.deepEqual(audit(tree({ ...base, [ATTRIBUTION_FILE]: attrib('chesterfield-a', 'nightstand-a') }), ON), [], 'every entry has a row');
  const missing = audit(tree({ ...base, [ATTRIBUTION_FILE]: attrib('chesterfield-a') }), ON);
  assert.deepEqual(missing.map(f => f.path), [`${MANIFEST_FILE}#nightstand-a`], describe(missing));
  const prose = audit(tree({ ...base, [ATTRIBUTION_FILE]: 'chesterfield-a and nightstand-a are mentioned in prose only, with `chesterfield-a` and `nightstand-a` in code spans\n' }), ON);
  assert.equal(prose.length, 2, 'prose is not a row');
  const prefix = audit(tree({ ...base, [ATTRIBUTION_FILE]: attrib('chesterfield-a-long', 'nightstand-a') }), ON);
  assert.deepEqual(prefix.map(f => f.path), [`${MANIFEST_FILE}#chesterfield-a`], 'an id that only prefixes another id does not match');
  const meta = tree({ [MANIFEST_FILE]: manifest({ id: 'a.b*c', family: 'x' }), [ATTRIBUTION_FILE]: attrib('aXbbc') });
  assert.deepEqual(rules(audit(meta, ON)), ['attribution'], 'ids are literal, not patterns');
  assert.deepEqual(audit(tree({ [MANIFEST_FILE]: manifest({ id: 'a.b*c', family: 'x' }), [ATTRIBUTION_FILE]: attrib('a.b*c') }), ON), [], 'a literal id with regex characters matches itself');
});

test('self-test: findings accumulate (a stray image, an unregistered module and a missing row are three findings)', () => {
  const f = audit(tree({ 'models/x.png': 'b', 'assets/props/baked/a.ts': '', [MANIFEST_FILE]: manifest({ id: 'orphan', family: 'b' }), [ATTRIBUTION_FILE]: attrib() }), ON);
  assert.deepEqual(rules(f).sort(), ['attribution', 'baked', 'binary'], describe(f));
});

// ---- this checkout ---------------------------------------------------------------------------------------------------
test('this tree: no model, image, texture or archive and no file over 1 MiB under assets/props/ or models/, no unregistered baked module', () => {
  const checkAttribution = fs.existsSync(path.join(REPO, GENERATOR_FILE));
  const f = audit(REPO, { checkAttribution });
  assert.deepEqual(f, [], `\n${describe(f)}\n(attribution rows ${checkAttribution ? 'checked' : 'not checked yet: scripts/bake/attribution.mts has not landed'})`);
});

test('this tree: models/packs.json registers the 22 packs and ATTRIBUTION.md has a section for each', () => {
  const packs = readJson(REPO, PACKS_FILE);
  assert.ok(packs.ok, `${PACKS_FILE}: ${packs.ok ? '' : packs.why}`);
  const list: any[] = (packs as any).value.packs;
  assert.equal(list.length, 22, 'the collection is 22 packs');
  const attribution = read(REPO, ATTRIBUTION_FILE);
  assert.ok(attribution, `${ATTRIBUTION_FILE} is missing`);
  const ids = new Set<string>(), folders = new Set<string>();
  const DECISIONS = ['use', 'reference-only', 'outdoor-only', 'not-shipped'];
  list.forEach((p, i) => {
    const who = `pack ${i + 1} (${p.id})`;
    assert.match(String(p.id), /^[a-z0-9]+(-[a-z0-9]+)*$/, `${who}: id`);
    assert.ok(!ids.has(p.id) && !folders.has(p.folder), `${who}: id and folder are unique`);
    ids.add(p.id); folders.add(p.folder);
    assert.match(String(p.archive_sha256), /^[0-9a-f]{64}$/, `${who}: archive_sha256`);
    assert.ok(Number.isInteger(p.archive_bytes) && p.archive_bytes > 0, `${who}: archive_bytes`);
    assert.ok(DECISIONS.includes(p.decision), `${who}: decision ${p.decision}`);
    assert.equal(p.committed_source_bytes, 0, `${who}: no pack source is committed`);
    assert.ok(['cc0-in-pack', 'owner-asserted'].includes(p.licence_basis), `${who}: licence_basis ${p.licence_basis}`);
    if (p.licence_basis === 'cc0-in-pack') {
      assert.ok(p.evidence && /^[0-9a-f]{64}$/.test(p.evidence.sha256) && p.evidence.archive_member && p.evidence.quotes.length > 0, `${who}: cc0-in-pack needs its evidence file, sha256 and quotes`);
      assert.ok(attribution!.includes(p.evidence.sha256), `${who}: ATTRIBUTION.md carries the evidence sha256`);
    } else assert.equal(p.evidence, null, `${who}: owner-asserted has no in-pack evidence`);
    assert.ok(attribution!.includes(`### ${i + 1}. ${p.folder}\n`), `${who}: ATTRIBUTION.md has its "### ${i + 1}. ${p.folder}" section`);
    assert.ok(attribution!.includes(p.archive_sha256), `${who}: ATTRIBUTION.md carries the archive sha256`);
  });
  assert.equal((attribution!.match(/^### \d+\. /gm) || []).length, 22, 'ATTRIBUTION.md has no extra pack sections');
});
