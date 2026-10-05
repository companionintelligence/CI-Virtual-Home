#!/usr/bin/env -S node --experimental-strip-types
// The dress phase's FLEET gate: the 30 shipped houses baked with the dress phase (to a scratch directory, never into content/houses) and the five dress fixtures,
// every baked house opened in the page, and what the page BUILT measured. These are the skeptic's measuring scripts (the second DRESS skeptic, `sk-measure` and
// `sk-curtain3d`), kept in the repo so the acceptance numbers are reproducible and not scratch-only; the Node tests (scripts/test-dress-phase.mts) measure the same
// things from the specs and the catalog, this one measures the real meshes.
//
//   bake      compose-house.mts --dress for every house (level 0.5, or the room's own) and fixture, into --out <dir> (default a fresh temp dir): prints the dir
//   measure   open every baked spec in the page and measure the built geometry (needs `pnpm run build` and a GPU; one browser job, about 4 minutes)
//   all       bake, then measure (the default)
//
//   node --experimental-strip-types scripts/dress-fleet.mts [bake|measure|all] [--dir <baked dir>] [--only aurora,cocoon] [--json out.json]
//
// The gates (every one must read 0):
//   curtain-vs-item     a café curtain's mesh passes through another item's mesh by more than 1 mm (box against box, every mesh of the curtain and of every item
//                       of its room that is a placed item, authored, composed or dressed). Architecture the page builds with no item type (the wall pieces and their finish, which the
//                       rod brackets sink 3-14 mm into; not the lot and the world, whose boxes are the size of the street) is counted apart as `trim`, informational
//   curtain-vs-curtain  two curtains of one room whose whole boxes (rod and finials included) stand under CURTAIN_GAP of each other in plan while their heights overlap
//   neighbour-gap       a dress item on a surface stands under 1.5 cm (triangle-level plan distance) from any other item that stands at the same level
//   corner-camera       a rig corner camera (all four corners) inside a dress mesh (4 cm), within 0.3 m of one, or a dress floor piece taller than 0.8 m in a 0.5 m corner square
//   curtain-window      a curtain hangs below its window's sill, or its top is above sill + 0.55 x the window's height, or its cloth is dark
// Not a gate, printed: how many curtains cross the 1.45-1.55 m eye line (all on small or high-sill windows, as the recipe says).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, parseArgs } from './review/lib.mts';
import { startSession, roomsOf } from './review/page.mts';
import { cornerCam } from './review/cameras.mts';

export const CURTAIN_GAP = 0.02;
const FIX = ['dress-rooms', 'dress-baths', 'dress-kitchens', 'dress-styles', 'dress-utility'];
const args = parseArgs(process.argv.slice(2));
const mode = process.argv.slice(2).find(a => ['bake', 'measure', 'all'].includes(a)) || 'all';

/** the shipped houses (the 30 pilots) and the dress fixtures: [id, source file] */
export function fleetSources(): Array<{ id: string; file: string }> {
  const dir = path.join(ROOT, 'content', 'houses');
  return [
    ...fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).sort().map(f => ({ id: f.replace(/\.json$/, ''), file: path.join(dir, f) })),
    ...FIX.map(id => ({ id, file: path.join(ROOT, 'test', 'fixtures', 'houses', `${id}.json`) })),
  ];
}

/** bake the fleet into `out` (compose-house.mts --dress --out), one file per id; the sources are never written */
export function bakeFleet(out: string, only: Set<string> | null = null): Array<{ id: string; file: string }> {
  fs.mkdirSync(out, { recursive: true });
  const res: Array<{ id: string; file: string }> = [];
  for (const { id, file } of fleetSources()) {
    if (only && !only.has(id)) continue;
    const dst = path.join(out, `${id}.json`);
    const r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'compose-house.mts'), '--house', file, '--dress', '--out', dst], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.status !== 0) { console.error(`bake ${id} failed:\n${r.stderr}`); process.exit(2); }
    res.push({ id, file: dst });
  }
  return res;
}

// ---- the measurement, in the page ------------------------------------------------------------------------------------------------------------------
async function measure(list: Array<{ id: string; file: string }>) {
  const session = await startSession();
  const R = { curtains: [] as any[], itemHits: [] as any[], trim: 0, curtainPairs: [] as any[], cams: 0, camsWithDress: 0, inside: [] as any[], near: [] as any[], squareHits: [] as any[], gaps: { pairs: 0, under15: [] as any[], all: [] as any[] }, errors: [] as any[], builds: 0 };
  try {
    for (const { id, file } of list) {
      const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
      const w = await session.open(id, { spec: file, composer: false });
      try {
        const rooms = await roomsOf(w.page);
        const cams: any[] = [];
        for (const r of rooms) for (const c of ['NW', 'SE', 'NE', 'SW'] as const) cams.push({ room: r.name, corner: c, cam: cornerCam(r.b, r.y, c), b: r.b, y: r.y });
        const res: any = await w.page.evaluate(({ cams, CURTAIN_GAP }: any) => {
          const W = window as any, d = W.__houseDebug();
          const placed: any[] = d.scene.children.filter((c: any) => c.userData && c.userData.generated);
          // world AABB of each mesh of an object (the mesh-local box carried through the matrix: exact for the quarter turns the fleet uses)
          const prep = (o: any) => {
            o.updateMatrixWorld(true);
            const meshes: any[] = [], mb: number[][] = []; let box = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
            o.traverse((m: any) => { if (m.isMesh && m.geometry && m.geometry.attributes.position) meshes.push(m); });
            for (const m of meshes) {
              m.geometry.computeBoundingBox(); const lb = m.geometry.boundingBox, e = m.matrixWorld.elements;
              let a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9];
              for (const x of [lb.min.x, lb.max.x]) for (const y of [lb.min.y, lb.max.y]) for (const z of [lb.min.z, lb.max.z]) {
                const p = [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
                a = a.map((v, i) => Math.min(v, p[i])); b = b.map((v, i) => Math.max(v, p[i]));
              }
              mb.push([...a, ...b]); box = [Math.min(box[0], a[0]), Math.min(box[1], a[1]), Math.min(box[2], a[2]), Math.max(box[3], b[0]), Math.max(box[4], b[1]), Math.max(box[5], b[2])];
            }
            return { o, meshes, mb, box };
          };
          const objs = placed.map(prep);
          const ud = (e: any) => e.o.userData;
          const r3 = (v: number) => Math.round(v * 1e3) / 1e3;
          // ---- curtains: the built box, the cloth colours, curtain against every other object of its room (mesh box against mesh box)
          const curtains: any[] = [], itemHits: any[] = [], curtainPairs: any[] = []; let trim = 0;
          const cur = objs.filter(e => ud(e).dress && ud(e).itemType === 'cafe-curtain');
          for (const c of cur) {
            const cols = new Set<string>(); c.o.traverse((m: any) => { if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x: any) => x && x.color && cols.add('#' + x.color.getHexString())); });
            curtains.push({ room: ud(c).room || '', box: c.box.map(r3), colours: [...cols] });
            for (const e of objs) {
              if (e === c || ud(e).room !== ud(c).room) continue;
              let worst: number[] | null = null;
              for (const m of e.mb) for (const k of c.mb) { const ov = [0, 1, 2].map(i => Math.min(m[3 + i], k[3 + i]) - Math.max(m[i], k[i])); if (ov.every(v => v > 0.001) && (!worst || Math.min(...ov) > Math.min(...worst))) worst = ov; }
              if (!worst) continue;
              if (!ud(e).itemType) { if (!ud(e).world && ud(e).category !== 'Site') trim++; continue; }   // (the lot and the world's meshes are boxes the size of the street: not a thing the curtain meets)
              if (ud(e).itemType === 'cafe-curtain') continue;   // (curtain against curtain is its own gate, below)
              itemHits.push({ room: ud(c).room, curtain: c.box.map(r3), other: ud(e).itemType + (ud(e).dress ? '*' : ''), ov: worst.map(r3) });
            }
          }
          for (let i = 0; i < cur.length; i++) for (let j = i + 1; j < cur.length; j++) {
            const a = cur[i], b = cur[j]; if (ud(a).room !== ud(b).room) continue;
            const gy = Math.min(a.box[4], b.box[4]) - Math.max(a.box[1], b.box[1]); if (gy <= 0.01) continue;
            const gx = Math.max(b.box[0] - a.box[3], a.box[0] - b.box[3]), gz = Math.max(b.box[2] - a.box[5], a.box[2] - b.box[5]);
            const gap = Math.hypot(Math.max(gx, 0), Math.max(gz, 0)) * (gx > 0 || gz > 0 ? 1 : 0) + (gx > 0 || gz > 0 ? 0 : Math.max(gx, gz));
            if (gap < CURTAIN_GAP - 0.0005) curtainPairs.push({ room: ud(a).room, gap: r3(gap), a: a.box.map(r3), b: b.box.map(r3) });
          }
          // ---- corner cameras against every dress mesh
          const dressObjs = objs.filter(e => ud(e).dress);
          const dist = (e: any, p: number[]) => {
            let best = 1e9;
            for (const m of e.meshes) {
              const inv = m.matrixWorld.clone().invert(), v = new (m.position.constructor)(p[0], p[1], p[2]).applyMatrix4(inv), lb = m.geometry.boundingBox;
              const dx = Math.max(lb.min.x - v.x, 0, v.x - lb.max.x), dy = Math.max(lb.min.y - v.y, 0, v.y - lb.max.y), dz = Math.max(lb.min.z - v.z, 0, v.z - lb.max.z);
              best = Math.min(best, Math.hypot(dx, dy, dz) * m.matrixWorld.getMaxScaleOnAxis());
            }
            return best;
          };
          const corners = cams.map((c: any) => {
            let best = 1e9, bt = '', sq = '';
            for (const e of dressObjs) {
              if (ud(e).room !== c.room) continue;
              const dd = dist(e, c.cam.pos); if (dd < best) { best = dd; bt = ud(e).itemType; }
              const h = e.box[4] - e.box[1];
              if (e.box[1] < c.y + 0.1 && h > 0.8 && !ud(e).onSurface && !ud(e).mounted) {
                const cx = c.corner[1] === 'E' ? c.b.x + c.b.w : c.b.x, cz = c.corner[0] === 'S' ? c.b.z + c.b.d : c.b.z;
                const sx = c.corner[1] === 'E' ? cx - 0.5 : cx, sz = c.corner[0] === 'S' ? cz - 0.5 : cz;
                if (e.box[3] > sx && e.box[0] < sx + 0.5 && e.box[5] > sz && e.box[2] < sz + 0.5) sq = `${ud(e).itemType} h${h.toFixed(2)}`;
              }
            }
            return { room: c.room, corner: c.corner, best: r3(best), type: bt, hasDress: best < 1e8, sq };
          });
          // ---- the gap from a dress item on a surface to every other item that stands at the same level (box first, then triangle-level plan distance)
          const tri = (E: any) => { const T: number[][] = []; for (const m of E.meshes) { const p = m.geometry.attributes.position, ix = m.geometry.index, e = m.matrixWorld.elements; const V = (i: number) => { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }; const n = ix ? ix.count : p.count; for (let k = 0; k < n; k += 3) { const a = V(ix ? ix.getX(k) : k), b = V(ix ? ix.getX(k + 1) : k + 1), c = V(ix ? ix.getX(k + 2) : k + 2); T.push([a[0], a[2], b[0], b[2], c[0], c[2], Math.min(a[1], b[1], c[1]), Math.max(a[1], b[1], c[1])]); } } return T; };
          const segd = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz; let t = L ? ((px - ax) * dx + (pz - az) * dz) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax + t * dx), pz - (az + t * dz)); };
          const inside = (px: number, pz: number, t: number[]) => { if (Math.abs((t[2] - t[0]) * (t[5] - t[1]) - (t[3] - t[1]) * (t[4] - t[0])) < 1e-9) return false; const s = (ax: number, az: number, bx: number, bz: number) => (bx - ax) * (pz - az) - (bz - az) * (px - ax); const d1 = s(t[0], t[1], t[2], t[3]), d2 = s(t[2], t[3], t[4], t[5]), d3 = s(t[4], t[5], t[0], t[1]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
          const refine = (A: any, B: any) => {
            const TA = tri(A), TB = tri(B), y0 = A.box[1], upB = TB.filter(t => t[7] > y0 + 0.003);
            let best = 1e9;
            const pts = (T: number[][]) => { const P: number[][] = []; for (const t of T) P.push([t[0], t[1]], [t[2], t[3]], [t[4], t[5]]); return P; };
            const far = (p: number[], t: number[]) => Math.abs(p[0] - t[0]) > 0.2 && Math.abs(p[0] - t[2]) > 0.2 && Math.abs(p[0] - t[4]) > 0.2;
            for (const p of pts(TA)) for (const t of upB) { if (far(p, t)) continue; if (inside(p[0], p[1], t)) return 0; best = Math.min(best, segd(p[0], p[1], t[0], t[1], t[2], t[3]), segd(p[0], p[1], t[2], t[3], t[4], t[5]), segd(p[0], p[1], t[4], t[5], t[0], t[1])); }
            for (const p of pts(upB)) for (const t of TA) { if (far(p, t)) continue; if (inside(p[0], p[1], t)) return 0; best = Math.min(best, segd(p[0], p[1], t[0], t[1], t[2], t[3]), segd(p[0], p[1], t[2], t[3], t[4], t[5]), segd(p[0], p[1], t[4], t[5], t[0], t[1])); }
            return best;
          };
          const gaps: any[] = []; let pairs = 0;
          for (const A of dressObjs) {
            if (!ud(A).onSurface) continue;
            for (const B of objs) {
              if (B === A || ud(B).room !== ud(A).room) continue;
              if (Math.abs(A.box[1] - B.box[1]) > 0.05) continue;
              const gx = Math.max(B.box[0] - A.box[3], A.box[0] - B.box[3]), gz = Math.max(B.box[2] - A.box[5], A.box[2] - B.box[5]);
              const coarse = Math.hypot(Math.max(gx, 0), Math.max(gz, 0)); if (coarse > 0.2) continue;
              pairs++;
              if (coarse < 0.05) gaps.push({ room: ud(A).room, a: ud(A).itemType, b: ud(B).itemType + (ud(B).dress ? '*' : ''), coarse: r3(coarse), tri: r3(refine(A, B)), yA: r3(A.box[1]) });
            }
          }
          return { curtains, itemHits, trim, curtainPairs, corners, gaps, pairs, dressCount: dressObjs.length };
        }, { cams: cams.map(c => ({ room: c.room, corner: c.corner, cam: { pos: c.cam.pos }, b: c.b, y: c.y })), CURTAIN_GAP });
        // each curtain against its own window: the spec's own openings (the baked curtain item, the level it stands on, the opening it hangs at)
        for (const cu of res.curtains) {
          let best: any = null; const cx = (cu.box[0] + cu.box[3]) / 2, cz = (cu.box[2] + cu.box[5]) / 2;
          for (const lv of spec.levels) for (const r of lv.rooms) if (r.name === cu.room) for (const it of r.items || []) {
            if (it.type !== 'cafe-curtain' || it.src !== 'dress@1') continue;
            const lvy = lv.y || 0; if (cu.box[1] < lvy - 0.01 || cu.box[4] > lvy + (lv.height || 2.8) + 0.5) continue;
            const dd = Math.hypot(it.at[0] - cx, it.at[1] - cz);
            if (!best || dd < best.dd) best = { dd, it, lv, r, lvy };
          }
          let win: any = null;   // (the nearest window on that wall: a curtain clipped by its neighbour is not centred on its window)
          if (best) for (const op of best.lv.openings || []) {
            if (op.type !== 'window') continue; const it = best.it, r = best.r;
            const along = op.side === 'N' || op.side === 'S' ? it.at[0] : it.at[1];
            const across = op.side === 'N' ? r.bounds.z : op.side === 'S' ? r.bounds.z + r.bounds.d : op.side === 'W' ? r.bounds.x : r.bounds.x + r.bounds.w;
            const acr = op.side === 'N' || op.side === 'S' ? it.at[1] : it.at[0];
            if (Math.abs(acr - across) < 0.35 && (!win || Math.abs(along - op.at) < Math.abs(along - win.at))) win = op;
          }
          const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
          const cloth = [...cu.colours].sort((p: string, q: string) => lum(q) - lum(p))[0];
          R.curtains.push({ id, room: cu.room, lo: cu.box[1] - (best ? best.lvy : 0), hi: cu.box[4] - (best ? best.lvy : 0), cloth, luma: lum(cloth), win: win && { sill: win.sill, h: win.h, w: win.w, at: win.at, side: win.side } });
        }
        R.builds++; R.trim += res.trim;
        for (const h of res.itemHits) R.itemHits.push({ id, ...h });
        for (const p of res.curtainPairs) R.curtainPairs.push({ id, ...p });
        const dres = res.corners.filter((c: any) => c.hasDress);
        R.cams += res.corners.length; R.camsWithDress += dres.length;
        for (const c of res.corners) { if (c.best < 0.04) R.inside.push({ id, ...c }); else if (c.best < 0.3) R.near.push({ id, ...c }); if (c.sq) R.squareHits.push({ id, ...c }); }
        R.gaps.pairs += res.pairs;
        for (const g of res.gaps) { R.gaps.all.push({ id, ...g }); if (g.tri < 0.015) R.gaps.under15.push({ id, ...g }); }
        if (w.errors.length) R.errors.push({ id, e: w.errors.slice(0, 2) });
        console.log(`${id.padEnd(16)} dress objs ${String(res.dressCount).padStart(3)}  curtains ${res.curtains.length}  item hits ${res.itemHits.length}  curtain pairs ${res.curtainPairs.length}  gap pairs ${res.pairs}`);
      } finally { await w.close(); }
    }
  } finally { await session.close(); }
  return R;
}

// ---- the gates ---------------------------------------------------------------------------------------------------------------------------------------
export function verdict(R: any): { bad: number; lines: string[] } {
  const lines: string[] = []; let bad = 0;
  const gate = (name: string, n: number, what: string, detail: string[] = []) => { lines.push(`${n === 0 ? '✓' : '✗'} ${name.padEnd(18)} ${n}  ${what}`); for (const d of detail.slice(0, 12)) lines.push(`      ${d}`); if (n) bad++; };
  gate('curtain-vs-item', R.itemHits.length, `curtain meshes through another item's mesh (> 1 mm) over ${R.curtains.length} curtains in ${R.builds} builds (${R.trim} touches of wall pieces, not counted)`, R.itemHits.map((h: any) => `${h.id}/${h.room}: ${h.other} ${JSON.stringify(h.ov)}`));
  gate('curtain-vs-curtain', R.curtainPairs.length, `curtain pairs under ${CURTAIN_GAP * 100} cm apart (boxes with rod and finials, plan)`, R.curtainPairs.map((h: any) => `${h.id}/${h.room}: gap ${h.gap}`));
  gate('neighbour-gap', R.gaps.under15.length, `dress items under 1.5 cm from a neighbour (${R.gaps.pairs} pairs near, ${R.gaps.all.length} measured at triangle level)`, R.gaps.under15.map((g: any) => `${g.id}/${g.room}: ${g.a} and ${g.b} ${(g.tri * 1000).toFixed(1)} mm`));
  gate('corner-camera', R.inside.length + R.near.length + R.squareHits.length, `corner cameras inside (${R.inside.length}), within 0.3 m (${R.near.length}) of a dress mesh, or tall pieces in the corner square (${R.squareHits.length}), of ${R.cams} cameras (${R.camsWithDress} in rooms with a dress piece)`, [...R.inside, ...R.near, ...R.squareHits].map((c: any) => `${c.id}/${c.room} ${c.corner}: ${c.type || c.sq} ${c.best}`));
  const lum = (x: any) => x.luma;
  const faults: string[] = [];
  let noWin = 0, cross = 0;
  for (const c of R.curtains) {
    if (!c.win) { noWin++; faults.push(`${c.id}/${c.room}: no window found under the curtain`); continue; }
    const top = c.win.sill + 0.55 * c.win.h;
    if (c.hi > top + 0.002) faults.push(`${c.id}/${c.room}: top ${c.hi.toFixed(3)} above sill + 0.55 x height ${top.toFixed(3)}`);
    if (c.lo < c.win.sill - 0.002) faults.push(`${c.id}/${c.room}: hem ${c.lo.toFixed(3)} below the sill ${c.win.sill}`);
    if (lum(c) < 0.7) faults.push(`${c.id}/${c.room}: cloth ${c.cloth} is dark`);
    if (c.lo < 1.55 && c.hi > 1.45) cross++;
  }
  gate('curtain-window', faults.length, `curtains off their window's lower half, below the sill or dark (${cross} of ${R.curtains.length} cross the eye line, informational)`, faults);
  if (R.errors.length) { lines.push(`✗ page errors: ${JSON.stringify(R.errors.slice(0, 3))}`); bad++; }
  return { bad, lines };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('dress-fleet.mts')) {
  const only = args.only && args.only !== 'true' ? new Set(args.only.split(',')) : null;
  let dir = args.dir && args.dir !== 'true' ? path.resolve(args.dir) : '';
  let list: Array<{ id: string; file: string }> = [];
  if (mode === 'bake' || mode === 'all') {
    if (!dir) dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dress-fleet-'));
    list = bakeFleet(dir, only); console.log(`baked ${list.length} specs into ${dir}`);
  }
  if (mode === 'measure') {
    if (!dir) { console.error('measure needs --dir <baked dir>'); process.exit(2); }
    list = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => ({ id: f.replace(/\.json$/, ''), file: path.join(dir, f) })).filter(x => !only || only.has(x.id));
  }
  if (mode !== 'bake') {
    const R = await measure(list);
    const v = verdict(R);
    for (const l of v.lines) console.log(l);
    if (args.json && args.json !== 'true') fs.writeFileSync(path.resolve(args.json), JSON.stringify(R, null, 1) + '\n');
    process.exit(v.bad ? 1 : 0);
  }
}
