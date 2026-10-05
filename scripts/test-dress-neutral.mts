#!/usr/bin/env -S node --experimental-strip-types
// The dress phase's build gate (plan 5.6 D0, the "neutrality" test): in the page, dress items are exactly additive and exactly switchable.
//
//   A  ?dress=0     a house that opts in, built with `?dress=0`, is object for object the house with its dress fields stripped (the same digest of every placed
//                   object's matrices, geometry, materials and order, per class of item), and its frames are bit-exact over three cameras
//   B  no re-roll   the same house built dressed differs from the stripped one ONLY in the classes of the dress items' own types (the lamp a recipe adds is a
//                   `table-lamp`, and the composer's table lamps are the same class, so a type the phase placed is declared changed; every other class
//                   is identical): one more dress item moves no other prop's colour, jitter or place, because it seeds from `dress:<dk>` and never takes a
//                   `propIndex`
//   C  baked        the dress items baked into a spec (`src: 'dress@1'`, no `dress` field) build the same objects as the live phase, frames bit-exact
//
// @check-house skip — a browser job (~2 minutes) that needs a built tree: run by hand in a DRESS PR, and by INT after the pilot bake
//
//   node --experimental-strip-types scripts/test-dress-neutral.mts [--fixtures dress-rooms,dress-baths]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { startSession, SERVE_ROOT } from './review/page.mts';
import { cornerCam, RES, QUALITY } from './review/cameras.mts';
import { snapshot, compareHouse } from './test-build-neutrality.mts';
import { parseArgs } from './review/lib.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = parseArgs(process.argv.slice(2));
const FIX = args.fixtures && args.fixtures !== 'true' ? args.fixtures.split(',') : ['dress-rooms', 'dress-baths'];
const A = (f: string) => import(pathToFileURL(path.join(SERVE_ROOT, 'assets', f)).href);
const { dressRooms, dressHouse } = await A('room-dress.js');
let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail.split('\n').join('\n    ')}`}`); if (!ok) bad++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dress-neutral-'));
const write = (name: string, spec: any) => { const f = path.join(tmp, `${name}.json`); fs.writeFileSync(f, JSON.stringify(spec, null, 2)); return f; };

/** three frames of a house: the first rooms' NW corner cameras, hashed */
async function frames(session: any, id: string, specFile: string, query: string, picks: Array<{ room: string }>): Promise<string[]> {
  const w = await session.open(id, { spec: specFile, query, res: RES });
  const out: string[] = [];
  try {
    const rooms: any[] = await w.page.evaluate(() => { const d = (window as any).__houseDebug(), s = d.house.spec; return s.levels.flatMap((lv: any) => (lv.rooms || []).map((r: any) => ({ name: r.name, y: lv.y || 0, b: r.bounds }))); });
    for (const p of picks) {
      const room = rooms.find(r => r.name === p.room); if (!room) { out.push('no room ' + p.room); continue; }
      const cam = cornerCam(room.b, room.y, 'NW');
      const url: string = await w.page.evaluate(({ cam, res, quality }: any) => { const W = window as any, d = W.__houseDebug(), c = d.camera; c.position.set(...cam.pos); c.lookAt(...cam.target); c.fov = cam.fov; c.near = cam.near; c.updateProjectionMatrix(); return W.__houseSnapshot({ res, dressing: { walls: 'up', roof: 'on' }, quality }); }, { cam, res: RES, quality: QUALITY });
      out.push(crypto.createHash('sha256').update(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')).digest('hex').slice(0, 16));
    }
    if (w.errors.length) out.push('page errors: ' + w.errors.slice(0, 2).join(' | '));
  } finally { await w.close(); }
  return out;
}

for (const id of FIX) {
  console.log(`── ${id}`);
  const file = path.join(ROOT, 'test', 'fixtures', 'houses', `${id}.json`), spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  const stripped = JSON.parse(JSON.stringify(spec)); for (const lv of stripped.levels) for (const r of lv.rooms || []) delete r.dress;
  const strippedFile = write(`${id}-stripped`, stripped);
  const specCopy = JSON.parse(JSON.stringify(spec)), live = dressHouse(specCopy);
  const types = [...new Set([...live.values()].flatMap((r: any) => r.items.map((i: any) => `item:${i.type}`)))].sort();
  console.log(`  the phase adds ${[...live.values()].reduce((a: number, r: any) => a + r.items.length, 0)} items of ${types.length} types: ${types.map(t => t.slice(5)).join(', ')}`);
  // baked: the same items written into the spec as dress@1, the dress field gone
  const baked = JSON.parse(JSON.stringify(stripped)), all = dressRooms(specCopy);
  const rooms = (sp: any) => sp.levels.flatMap((lv: any) => lv.rooms || []);
  const optedIn = rooms(specCopy).map((r: any) => !!(r.dress && typeof r.dress.level === 'number'));
  rooms(specCopy).forEach((r: any, i: number) => { const res = all.get(r); if (res && optedIn[i]) rooms(baked)[i].items = [...(rooms(baked)[i].items || []), ...res.items]; });
  const bakedFile = write(`${id}-baked`, baked);
  const picks = rooms(specCopy).filter((r: any) => r.dress && live.get(r) && live.get(r).items.length).slice(0, 3).map((r: any) => ({ room: r.name }));

  const snap = async (query: string, spec_: string) => (await snapshot([id], query, { [id]: spec_ })).doc[id];
  const base = await snap('', strippedFile);
  const off = await snap('dress=0', file);
  const A_ = compareHouse(id, base, off, []);
  check(A_.length === 0, `A: ?dress=0 builds the stripped house object for object (${base.objects} objects)`, A_.join('\n'));
  const on = await snap('', file);
  const B_ = compareHouse(id, base, on, types);
  check(B_.length === 0, `B: dressed, only the dress items' own classes differ (${on.objects - base.objects} objects added; ${types.length} classes declared)`, B_.join('\n'));
  check(on.objects > base.objects, 'B: the phase did add objects');
  const bk = await snap('', bakedFile);
  const C_ = compareHouse(id, on, bk, []);
  check(C_.length === 0 && bk.objects === on.objects, `C: the baked dress@1 items build the live phase's objects (${bk.objects} = ${on.objects})`, C_.join('\n'));

  const session = await startSession();
  try {
    const f0 = await frames(session, id, strippedFile, '', picks), f1 = await frames(session, id, file, 'dress=0', picks), f2 = await frames(session, id, file, '', picks), f3 = await frames(session, id, bakedFile, '', picks);
    check(JSON.stringify(f0) === JSON.stringify(f1) && f0.length === picks.length, `A: ${picks.length} frames, ?dress=0 against stripped: bit-exact`, `${f0.join(' ')} | ${f1.join(' ')}`);
    check(f0.some((h, i) => h !== f2[i]), 'B: the dressed frames differ from the stripped ones (the phase is visible)');
    check(JSON.stringify(f2) === JSON.stringify(f3), 'C: baked and live frames are bit-exact', `${f2.join(' ')} | ${f3.join(' ')}`);
  } finally { await session.close(); }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? `✗ ${bad} wrong` : '✓ the dress phase is exactly additive and exactly switchable');
process.exit(bad ? 1 : 0);
