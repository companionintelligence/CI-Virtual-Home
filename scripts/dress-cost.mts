#!/usr/bin/env -S node --experimental-strip-types
// The dress phase's draw-call sub-gate (plan 5.6 / 8.4: "draw calls at most +12 % on the dressed fixtures"). For each dress fixture, in the page: the same twelve
// fixed interior cameras (scripts/review/cameras.mts costCameras, a function of room names, programs and bounds), measured the way the cost census's `audit`
// column is (one direct renderer.render after a snapshot has ended its dressing), once with `?dress=0` and once dressed: the draw calls, the triangles, the meshes
// and the scene's own totals. A fixture is a house with every room opted in, so its ratio is the upper end of what a dressed house costs.
//
//   node --experimental-strip-types scripts/dress-cost.mts [--fixtures dress-rooms,dress-baths,dress-kitchens,dress-styles,dress-utility] [--json out.json]
// (needs `pnpm run build` and a GPU; one browser job at a time.)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, median, round } from './review/lib.mts';
import { costCameras } from './review/cameras.mts';
import { startSession } from './review/page.mts';

const args = parseArgs(process.argv.slice(2));
const FIX = args.fixtures && args.fixtures !== 'true' ? args.fixtures.split(',') : ['dress-rooms', 'dress-baths', 'dress-kitchens', 'dress-styles', 'dress-utility'];
const BUDGET = 1.12;

const session = await startSession();
const rows: any[] = [];
try {
  for (const id of FIX) {
    const file = path.join(ROOT, 'test', 'fixtures', 'houses', `${id}.json`), spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    const rooms = (spec.levels || []).flatMap((lv: any) => (lv.rooms || []).filter((r: any) => r.bounds).map((r: any) => ({ level: lv.id, y: lv.y || 0, name: r.name, program: r.program || null, b: { x: r.bounds.x, z: r.bounds.z, w: r.bounds.w, d: r.bounds.d } })));
    const cams = costCameras(rooms);
    const out: Record<string, any> = {};
    for (const mode of ['off', 'on']) {
      { const w0 = await session.open(id, { res: '360', spec: file, query: mode === 'off' ? 'dress=0' : '' }); try { await w0.page.evaluate((r: string) => (window as any).__houseSnapshot({ res: r, quality: 0.4 }), '360'); } finally { await w0.close(); } }   // a throwaway context first: the cold pipeline
      const w = await session.open(id, { res: '360', spec: file, query: mode === 'off' ? 'dress=0' : '' });
      try {
        out[mode] = await w.page.evaluate(({ cams }: any) => {
          const W = window as any, d = W.__houseDebug(), scene = d.scene, r = d.renderer, c = d.camera;
          const triOf = (g: any) => g ? (g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0)) : 0;
          let meshes = 0, tris = 0; scene.traverse((o: any) => { if (o.isMesh) { meshes++; tris += triOf(o.geometry) * (o.isInstancedMesh ? o.count : 1); } });
          const calls: number[] = [], tri: number[] = [];
          for (const k of cams) {
            c.position.set(...k.cam.pos); c.lookAt(...k.cam.target); c.fov = k.cam.fov; c.near = k.cam.near; c.updateProjectionMatrix();
            W.__houseSnapshot({ res: '360', dressing: { walls: 'up', roof: 'on' }, quality: 0.5 });
            r.info.reset(); r.render(scene, c); calls.push(r.info.render.calls); tri.push(r.info.render.triangles);
          }
          return { meshes, tris: Math.round(tris), calls, tri };
        }, { cams });
      } finally { await w.close(); }
    }
    const off = out.off, on = out.on;
    const ratios = off.calls.map((c: number, i: number) => on.calls[i] / c);
    rows.push({ id, cameras: cams.map(c => c.key), off, on, medianCallsOff: median(off.calls), medianCallsOn: median(on.calls), medianRatio: round(median(ratios), 4), maxRatio: round(Math.max(...ratios), 4), meshRatio: round(on.meshes / off.meshes, 4), triRatio: round(on.tris / off.tris, 4) });
    const r = rows[rows.length - 1];
    console.log(`${id.padEnd(15)} interior draw calls median ${r.medianCallsOff} -> ${r.medianCallsOn} (x${r.medianRatio.toFixed(3)}, worst camera x${r.maxRatio.toFixed(3)}); scene meshes ${off.meshes} -> ${on.meshes} (x${r.meshRatio.toFixed(3)}), triangles x${r.triRatio.toFixed(3)}`);
  }
} finally { await session.close(); }
const worst = Math.max(...rows.map(r => r.medianRatio));
console.log(`${worst <= BUDGET ? '✓' : '✗'} the median interior draw calls of every dressed fixture are within +${Math.round((BUDGET - 1) * 100)} % (worst fixture x${worst.toFixed(3)})`);
if (args.json && args.json !== 'true') fs.writeFileSync(path.resolve(args.json), JSON.stringify(rows, null, 1) + '\n');
process.exit(worst <= BUDGET ? 0 : 1);
