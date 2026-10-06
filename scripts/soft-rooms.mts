#!/usr/bin/env -S node --experimental-strip-types
// The soft-props fixture house seen from inside, at the RIG's cameras (scripts/review/cameras.mts cornerCam: 1.5 m eye, 60 degrees, NW and SE
// corner of each room, 1280 x 720, the composer path): the look of every soft type in a room, before and after, outside the 150 goldens.
//
//   node --experimental-strip-types scripts/soft-rooms.mts --out <dir> [--root <tree>] [--rooms Beds,Towels] [--strip-new] [--tod day]
// --root renders from another served tree (the integration worktree is the BEFORE); --strip-new drops the types the BEFORE tree does not have
// (towel-stack, towel-ring-set, robe-hook) from a temporary copy of the spec. One browser, one job.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseArgs } from './review/lib.mts';
const args = parseArgs(process.argv.slice(2));
if (args.root) process.env.REVIEW_SERVE_ROOT = String(args.root);
const { startSession, roomsOf } = await import('./review/page.mts');
const { cornerCam, RES, QUALITY } = await import('./review/cameras.mts');
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(String(args.out || path.join(ROOT, 'video', 'soft-rooms')));
const only = args.rooms ? new Set(String(args.rooms).split(',')) : null;
const tod = String(args.tod || 'day');
fs.mkdirSync(OUT, { recursive: true });
let spec = path.join(ROOT, 'test', 'fixtures', 'houses', 'soft-props.json');
if (args['strip-new']) {
  const d = JSON.parse(fs.readFileSync(spec, 'utf8')), NEW = new Set(['towel-stack', 'towel-ring-set', 'robe-hook']);
  for (const lv of d.levels) for (const r of lv.rooms) r.items = (r.items || []).filter((i: any) => !NEW.has(i.type));
  spec = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'soft-rooms-')), 'soft-props.json'); fs.writeFileSync(spec, JSON.stringify(d));
}
const session = await startSession();
try {
  const w = await session.open('soft-props', { spec, res: RES });
  if (tod !== 'day') await w.page.evaluate((t: string) => (window as any).__houseSetLighting(t), tod);
  const rooms = (await roomsOf(w.page)).filter(r => !only || only.has(r.name));
  for (const room of rooms) for (const corner of ['NW', 'SE'] as const) {
    const cam = cornerCam(room.b, room.y, corner);
    const url = await w.page.evaluate(({ cam, res, quality }: any) => {
      const W = window as any, d = W.__houseDebug(), c = d.camera;
      c.position.set(...cam.pos); c.lookAt(...cam.target); c.fov = cam.fov; c.near = cam.near; c.updateProjectionMatrix();
      return W.__houseSnapshot({ res, dressing: { walls: 'up', roof: 'on' }, quality });
    }, { cam, res: RES, quality: QUALITY });
    const f = path.join(OUT, `${room.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}__${corner}-${tod}.jpg`);
    fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); console.log('wrote', path.basename(f));
  }
  if (w.errors.length) console.error('page errors:', w.errors.slice(0, 3).join(' | '));
  await w.close();
} finally { await session.close(); }
