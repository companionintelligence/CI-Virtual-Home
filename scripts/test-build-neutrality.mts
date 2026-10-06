#!/usr/bin/env -S node --experimental-strip-types
// R9: the build-neutrality test (plan 5.1, 9). Builds six houses in the browser and proves a change touched only what it meant to: every
// placed object that is not of a changed class is identical to the frozen BEFORE in world matrix, geometry, material colour (and
// roughness, metalness, opacity, maps) and in order. The proof that a new type, a new role, a new module or a new switch did not move
// an object it did not own: a prop's seed is `propIndex`-keyed, so one extra registry prop built earlier shifts every later one.
//
// @check-house skip — slow and needs a declared change set: run by hand in a stream's PR with --changed (the baseline holds on the frozen tree by construction)
//
//   node --experimental-strip-types scripts/test-build-neutrality.mts                          compare this tree with test/review/baselines/build-neutrality.json (nothing may differ)
//   node --experimental-strip-types scripts/test-build-neutrality.mts --changed item:bed,item:upholstered-bed,role:ceiling
//                                                                                              the classes this change means to move; everything else must be identical
//   node --experimental-strip-types scripts/test-build-neutrality.mts --changed 'item:*'       a class may end in * (all item types)
//   node --experimental-strip-types scripts/test-build-neutrality.mts --query dress=0          build with a switch (`?dress=0`, `?baked=0`): a same-tree A/B against the frozen BEFORE
//   node --experimental-strip-types scripts/test-build-neutrality.mts --houses aurora,cutestarter
//   node --experimental-strip-types scripts/test-build-neutrality.mts --houses aurora --spec aurora=/tmp/aurora-copy.json     build a composed COPY of a spec in its place (the repo file is never touched)
//   node --experimental-strip-types scripts/test-build-neutrality.mts --write                  re-freeze the baseline (at baseline/stage0-green only)
//   node --experimental-strip-types scripts/test-build-neutrality.mts --self-test              prove the comparison catches what it should (no browser)
// A class is `item:<type>` for a room item (by its type) or `role:<role>` for everything else the builder puts in the scene (structure,
// ground, fixtures, hero, site ...). Added or removed objects of a changed class are expected; any other difference is a failure, and the
// failure names the class, the house and the room. Exit 0 when nothing unexpected moved. One browser job: ~1 minute for six houses.
import fs from 'node:fs';
import path from 'node:path';
import { BASELINES, BEFORE_TAG, parseArgs, readJson, rel, stableJson, writeText, productFingerprint, productDiffersFromTag } from './review/lib.mts';

export const NEUTRAL_FILE = path.join(BASELINES, 'build-neutrality.json');
/** six houses across the styles the interiors work touches: modern, cottage, queen anne, craftsman, mid-century, tropical */
export const HOUSES = ['aurora', 'cutestarter', 'seraphine', 'lakecabin', 'mesamariposa', 'neweco'];

export interface ClassDigest { n: number; sha: string; rooms: Record<string, string> }
export interface HouseSnap { objects: number; classes: Record<string, ClassDigest>; runs: Array<[string, number]> }
export interface Neutrality { schema: 1; what: string; regenerate: string; houses: Record<string, HouseSnap> }

const matches = (c: string, changed: string[]) => changed.some(p => (p.endsWith('*') ? c.startsWith(p.slice(0, -1)) : c === p));

/** the comparison, pure: one house, baseline against now, `changed` classes excused */
export function compareHouse(id: string, base: HouseSnap, now: HouseSnap, changed: string[]): string[] {
  const bad: string[] = [];
  const all = new Set([...Object.keys(base.classes), ...Object.keys(now.classes)]);
  for (const c of [...all].sort()) {
    if (matches(c, changed)) continue;
    const a = base.classes[c], b = now.classes[c];
    if (!a) { bad.push(`${id}: ${c} is new (${b.n} object(s)) and not declared changed`); continue; }
    if (!b) { bad.push(`${id}: ${c} is gone (${a.n} object(s)) and not declared changed`); continue; }
    if (a.n !== b.n) { bad.push(`${id}: ${c} has ${b.n} object(s), the baseline ${a.n}`); continue; }
    if (a.sha !== b.sha) {
      const rooms = [...new Set([...Object.keys(a.rooms), ...Object.keys(b.rooms)])].filter(r => a.rooms[r] !== b.rooms[r]).sort();
      bad.push(`${id}: ${c} moved (${a.n} object(s))${rooms.length ? ` in ${rooms.slice(0, 5).map(r => r || 'no room').join(', ')}${rooms.length > 5 ? ', ...' : ''}` : ''}`);
    }
  }
  // order: the sequence of the objects that are NOT excused must be the same, run by run
  const seq = (s: HouseSnap) => s.runs.filter(([c]) => !matches(c, changed)).reduce<Array<[string, number]>>((out, [c, k]) => { const l = out[out.length - 1]; if (l && l[0] === c) l[1] += k; else out.push([c, k]); return out; }, []);
  const A = seq(base), B = seq(now);
  const at = A.findIndex((r, i) => !B[i] || B[i][0] !== r[0] || B[i][1] !== r[1]);
  if (A.length !== B.length || at !== -1) bad.push(`${id}: the order of unchanged objects moved${at !== -1 ? ` (first at run ${at}: ${A[at]?.join(' x ')} became ${B[at] ? B[at].join(' x ') : 'nothing'})` : ''}`);
  return bad;
}

export async function snapshot(houses: string[], query: string, specs: Record<string, string> = {}): Promise<{ doc: Record<string, HouseSnap>; version: string }> {
  const { startSession } = await import('./review/page.mts');
  const session = await startSession();
  const doc: Record<string, HouseSnap> = {};
  try {
    for (const id of houses) {
      const w = await session.open(id, { composer: false, query, spec: specs[id] });
      try {
        doc[id] = await w.page.evaluate(async () => {
          const W = window as any, d = W.__houseDebug();
          // what the builder made: the scene's own children that carry userData.generated, in the order they were put (a home's own parts are locked and tagged so)
          const placed: any[] = d.scene.children.filter((c: any) => c.userData && c.userData.generated);
          const enc = new TextEncoder();
          const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
          const fix = (v: number) => { const r = Math.round(v * 1e4) / 1e4; return r === 0 ? 0 : r; };
          const mats = (m: any) => (Array.isArray(m) ? m : [m]).filter(Boolean).map((x: any) => [x.type, x.color ? x.color.getHex() : '', fix(x.roughness ?? -1), fix(x.metalness ?? -1), fix(x.opacity ?? 1), x.transparent ? 1 : 0, x.emissive ? x.emissive.getHex() : '', x.map ? 1 : 0, x.normalMap ? 1 : 0, x.side, x.userData && x.userData.muted ? 1 : 0].join(':')).join('+');
          const geo = (g: any) => {
            if (!g || !g.attributes || !g.attributes.position) return 'none';
            const p = g.attributes.position.array; let h = 0x811c9dc5;
            for (let i = 0; i < p.length; i++) { h ^= Math.round(p[i] * 1e4) | 0; h = Math.imul(h, 0x01000193) >>> 0; }
            return `${g.type}:${g.attributes.position.count}:${g.index ? g.index.count : 0}:${h.toString(16)}`;
          };
          const recs: Array<{ c: string; r: string; h: string }> = [];
          for (const o of placed) {
            o.updateMatrixWorld(true);
            const parts: string[] = [o.matrixWorld.elements.map(fix).join(',')];
            o.traverse((m: any) => { if (m.isMesh) parts.push([m.matrixWorld.elements.map(fix).join(','), geo(m.geometry), mats(m.material), m.visible ? 1 : 0, m.castShadow ? 1 : 0, m.isInstancedMesh ? m.count : 0].join('|')); else if (m.isLight) parts.push(`L:${m.type}:${m.intensity}:${m.color.getHex()}:${m.matrixWorld.elements.map(fix).join(',')}`); });
            const u = o.userData || {};
            recs.push({ c: u.itemType ? `item:${u.itemType}` : `role:${u.role || 'none'}`, r: u.room || '', h: await sha(parts.join('\n')) });
          }
          const classes: Record<string, { hs: string[]; rooms: Record<string, string[]> }> = {};
          const runs: Array<[string, number]> = [];
          for (const r of recs) {
            const e = (classes[r.c] ||= { hs: [], rooms: {} }); e.hs.push(r.h); (e.rooms[r.r] ||= []).push(r.h);
            const l = runs[runs.length - 1]; if (l && l[0] === r.c) l[1]++; else runs.push([r.c, 1]);
          }
          const out: any = { objects: recs.length, classes: {}, runs };
          for (const c of Object.keys(classes).sort()) { const e = classes[c]; out.classes[c] = { n: e.hs.length, sha: await sha(e.hs.join(',')), rooms: Object.fromEntries(await Promise.all(Object.keys(e.rooms).sort().map(async r => [r, await sha(e.rooms[r].join(','))]))) }; }
          return out;
        });
        if (!doc[id].objects) throw new Error('the page reports no generated objects in the scene');
      } finally { await w.close(); }
      console.log(`  ${id}: ${doc[id].objects} objects, ${Object.keys(doc[id].classes).length} classes`);
    }
  } finally { await session.close(); }
  return { doc, version: session.version };
}

const WHAT = 'per class of placed object (a room item by its type, everything else by its role) in six houses: how many, and a digest of their world matrices, geometry, material colours and flags, in order; plus the run-length sequence of classes. scripts/test-build-neutrality.mts compares a build with it: whatever is not declared changed must be identical.';
const REGENERATE = 'pnpm run build && node --experimental-strip-types scripts/test-build-neutrality.mts --write   (only to re-freeze the BEFORE at baseline/stage0-green; never to make a moved object pass)';

function selfTest(base: Neutrality): number {
  let bad = 0;
  const ok = (cond: boolean, what: string) => { console.log(`  ${cond ? '✓' : '✗'} ${what}`); if (!cond) bad++; };
  const id = Object.keys(base.houses)[0], clone = (): HouseSnap => JSON.parse(JSON.stringify(base.houses[id]));
  const items = Object.keys(base.houses[id].classes).filter(c => c.startsWith('item:'));
  const c0 = items[0], c1 = items[1];
  ok(compareHouse(id, base.houses[id], clone(), []).length === 0, 'a build equal to the baseline is neutral');
  { const n = clone(); n.classes[c0].sha = 'f'.repeat(16); ok(compareHouse(id, base.houses[id], n, []).some(m => m.includes(c0) && /moved/.test(m)), `${c0}: one object moved is caught, by class`); ok(compareHouse(id, base.houses[id], n, [c0]).length === 0, '... and excused when declared changed'); ok(compareHouse(id, base.houses[id], n, ['item:*']).length === 0, '... and by a prefix'); ok(compareHouse(id, base.houses[id], n, [c1]).some(m => m.includes(c0)), '... but not by declaring another class'); }
  { const n = clone(); const room = Object.keys(n.classes[c0].rooms)[0]; n.classes[c0].sha = 'e'.repeat(16); n.classes[c0].rooms[room] = 'e'.repeat(16); ok(compareHouse(id, base.houses[id], n, []).some(m => m.includes(room || 'no room')), 'the failure names the room'); }
  { const n = clone(); n.classes[c0].n += 1; ok(compareHouse(id, base.houses[id], n, []).some(m => /object\(s\), the baseline/.test(m)), `${c0}: an extra object is caught`); }
  { const n = clone(); n.classes['item:zz-new'] = { n: 3, sha: 'a'.repeat(16), rooms: {} }; ok(compareHouse(id, base.houses[id], n, []).some(m => /is new/.test(m)), 'a new class is caught'); ok(compareHouse(id, base.houses[id], n, ['item:zz-new']).length === 0, '... unless declared'); }
  { const n = clone(); delete n.classes[c0]; ok(compareHouse(id, base.houses[id], n, []).some(m => /is gone/.test(m)), `${c0}: a removed class is caught`); }
  { const n = clone(); const i = n.runs.findIndex((r, k) => k > 2 && n.runs[k - 1][0] !== r[0]); const t = n.runs[i]; n.runs[i] = n.runs[i - 1]; n.runs[i - 1] = t; ok(compareHouse(id, base.houses[id], n, []).some(m => /order/.test(m)), 'two runs of objects swapped is an order failure'); }
  { // objects of a changed class inserted among the rest do not disturb the order of the others
    const n = clone(); n.runs.splice(Math.floor(n.runs.length / 2), 0, [c0, 4]); n.classes[c0].n += 4; ok(compareHouse(id, base.houses[id], n, [c0]).length === 0, 'objects of a declared class inserted anywhere leave the order of the rest alone'); }
  return bad;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (args['self-test'] === 'true') {
    if (!fs.existsSync(NEUTRAL_FILE)) { console.error(`no ${rel(NEUTRAL_FILE)}: --write it first`); process.exit(2); }
    const bad = selfTest(readJson(NEUTRAL_FILE));
    console.log(bad ? `✗ ${bad} wrong` : '✓ the neutrality comparison catches what it should');
    process.exit(bad ? 1 : 0);
  }
  const houses = args.houses && args.houses !== 'true' ? args.houses.split(',') : HOUSES;
  const query = args.query && args.query !== 'true' ? args.query : '';
  const changed = args.changed && args.changed !== 'true' ? args.changed.split(',') : [];
  if (args.write === 'true') {
    const fp = productFingerprint('HEAD');
    if (fp.dirty.length) { console.error(`the product code has uncommitted changes: ${fp.dirty.slice(0, 3).join('; ')}`); process.exit(2); }
    if (args['allow-drift'] !== 'true') { const d = productDiffersFromTag(); if (d.length) { console.error(`HEAD's product code differs from ${BEFORE_TAG} in: ${d.join(', ')}; the baseline is frozen from that tag (--allow-drift to override)`); process.exit(2); } }
    if (query) { console.error('--write takes no --query: the baseline is the default build'); process.exit(2); }
  }
  const specs = Object.fromEntries((args.spec && args.spec !== 'true' ? args.spec.split(',') : []).map(kv => kv.split('=')));
  const { doc } = await snapshot(houses, query, specs);
  if (args.write === 'true') {
    const full: Neutrality = { schema: 1, what: WHAT, regenerate: REGENERATE, houses: doc };
    writeText(NEUTRAL_FILE, stableJson(full, 0).replace(/\n$/, '') + '\n');
    console.log(`→ ${rel(NEUTRAL_FILE)}`); process.exit(0);
  }
  if (!fs.existsSync(NEUTRAL_FILE)) { console.error(`no ${rel(NEUTRAL_FILE)}: --write it first`); process.exit(2); }
  const base = readJson<Neutrality>(NEUTRAL_FILE);
  let bad: string[] = [];
  for (const id of houses) { if (!base.houses[id]) { bad.push(`${id}: not in the baseline`); continue; } bad = bad.concat(compareHouse(id, base.houses[id], doc[id], changed)); }
  for (const b of bad) console.log(`  ✗ ${b}`);
  console.log(bad.length ? `✗ ${bad.length} unexpected difference(s) in ${houses.length} house(s)${changed.length ? ` (declared changed: ${changed.join(', ')})` : ''}` : `✓ build-neutral: ${houses.length} houses, nothing moved outside ${changed.length ? changed.join(', ') : 'an empty change set'}${query ? ` (with ?${query})` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
