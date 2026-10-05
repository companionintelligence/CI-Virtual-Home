#!/usr/bin/env -S node --experimental-strip-types
// The dress host registry's gate (plan 5.6 D1; assets/room-dress-hosts.ts). A host is only a host if the page builds what the registry says:
//
//   A  every host, built alone in the page (3 seeds), sampled every 2 cm over every declared rect (item frame): the geometry there is within 1 cm of the
//      declared top, at the default size and at 0.75 and 1.35 times each sizing param the host declares (`sized`). Nothing higher (a bowl, a tap, a lamp
//      stand) and nothing lower (a basin, a gap) inside a rect. This is the footprint-fits-its-host contract: a good packed into a rect stands on it
//   B  the registry is closed: every host has a placement and a measured box, a rect is inside the measured box (+ 1 cm), no dropped type is also a host,
//      and every dropped type exists
//   C  the packer (fitIn / freeRects / subtract): a box returned fits inside the free rect, never overlaps what stands on the host, honours the margin,
//      and an anchor moves it the way it says
//   D  every dress item the phase puts in the four fixtures, built alone in the page with its own params, measures the box sizeOf gave the packer (0.04 m)
//
// Needs `pnpm run build`. One browser job (~20 s).
//
//   node --experimental-strip-types scripts/test-dress-hosts.mts [--types a,b] [--dump]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startSession, SERVE_ROOT } from './review/page.mts';
import { parseArgs } from './review/lib.mts';

const A = (f: string) => import(pathToFileURL(path.join(SERVE_ROOT, 'assets', f)).href);
const { HOSTS, DROPPED, hostOf, freeRects, fitIn, subtract, rectArea, footprintIn } = await A('room-dress-hosts.js');
const { sizeOf, paramsOf } = await A('room-geo.js');
const { PLACEMENT } = await A('props/placement.js');
const { MEASURED } = await A('props/measured.js');
const args = parseArgs(process.argv.slice(2));
let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail.split('\n').join('\n    ')}`}`); if (!ok) bad++; };
const only = args.types && args.types !== 'true' ? new Set(args.types.split(',')) : null;

// ---- B. the registry is closed ----------------------------------------------------------------------------------------
console.log('── B: the registry');
{
  const types = Object.keys(HOSTS);
  check(types.length >= 20, `${types.length} hosts`);
  check(types.every(t => PLACEMENT[t] && MEASURED[t]), 'every host has a placement and a measured box', types.filter(t => !PLACEMENT[t] || !MEASURED[t]).join(', '));
  check(!Object.keys(DROPPED).some(t => HOSTS[t]), 'no dropped type is also a host', Object.keys(DROPPED).filter(t => HOSTS[t]).join(', '));
  check(Object.keys(DROPPED).every(t => PLACEMENT[t]), 'every dropped type is a real type', Object.keys(DROPPED).filter(t => !PLACEMENT[t]).join(', '));
  const out: string[] = [];
  for (const t of types) {
    const def = HOSTS[t], s = sizeOf(t, {}); if (!s) { out.push(`${t}: no size`); continue; }
    for (const r of def.rects(s, {})) {
      if (!(r[2] > r[0] && r[3] > r[1])) out.push(`${t}: an empty rect`);
      if (r[0] < s.ox - s.w / 2 - 0.01 || r[2] > s.ox + s.w / 2 + 0.01 || r[1] < s.oz - s.d / 2 - 0.01 || r[3] > s.oz + s.d / 2 + 0.01) out.push(`${t}: a rect leaves the measured box`);
    }
    if (def.top > s.h + 0.03) out.push(`${t}: top ${def.top} above the measured box ${s.h.toFixed(2)}`);
  }
  check(!out.length, 'every rect is a real rect inside the measured box, under its top', out.join('\n'));
  const diff = types.filter(t => PLACEMENT[t].top !== undefined && Math.abs(PLACEMENT[t].top - HOSTS[t].top) > 0.005);
  console.log(`  (placement tops the page does not build: ${diff.map(t => `${t} ${PLACEMENT[t].top} -> ${HOSTS[t].top}`).join(', ') || 'none'})`);
}

// ---- C. the packer -----------------------------------------------------------------------------------------------------
console.log('── C: the packer');
{
  const tbl = { type: 'coffee-table', at: [10, 20], rot: 0 }, h = hostOf(tbl);
  const free0 = freeRects(h, [], 0.04);
  check(free0.length === 1 && Math.abs(rectArea(free0[0]) - (1.2 - 0.08) * (0.6 - 0.08)) < 1e-6, 'an empty host has its rect less the margin all round');
  const w = 0.42, d = 0.3, p = fitIn(free0, w, d, 'centre')!;
  check(!!p && Math.abs(p[0]) < 0.011 && Math.abs(p[1]) < 0.011, 'a box in an empty host goes to the centre');
  const left = fitIn(free0, w, d, 'left')!, right = fitIn(free0, w, d, 'right')!;
  check(left[0] < p[0] && right[0] > p[0] && Math.abs(left[0] + right[0]) < 0.011, 'left and right anchors are mirror images either side of the centre');
  check(Math.abs(left[0] - (-0.3 + 0.0)) < 0.2 && fitIn(free0, w, d, 'back-left')![1] < fitIn(free0, w, d, 'front-left')![1], 'a corner anchor combines its two');
  const back = fitIn(free0, w, d, 'back')!, front = fitIn(free0, w, d, 'front')!;
  check(back[1] < front[1], 'back is toward -z (the wall side), front toward +z');
  check(Math.abs((back[1] - d / 2) - free0[0][1]) < 0.011, 'a back anchor stands against the back margin');
  check(fitIn(free0, 1.2, 0.3, 'centre') === null, 'a box wider than the free rect does not fit');
  // something already on the host takes its footprint and its margin
  const lamp = { type: 'table-lamp', at: [10 + 0.3, 20], rot: 0, y: 0.4 };
  const free1 = freeRects(h, [lamp], 0.04), lf = footprintIn(h, lamp)!;
  check(free1.every((r: number[]) => r[2] <= lf[0] - 0.04 + 1e-6 || r[0] >= lf[2] + 0.04 - 1e-6 || r[3] <= lf[1] - 0.04 + 1e-6 || r[1] >= lf[3] + 0.04 - 1e-6), 'free rects keep 4 cm clear of what stands on the host');
  const q = fitIn(free1, 0.25, 0.2, 'right');
  check(q === null || q[0] + 0.125 <= lf[0] - 0.04 + 1e-6 || q[0] - 0.125 >= lf[2] + 0.04 - 1e-6 || q[1] + 0.1 <= lf[1] - 0.04 + 1e-6 || q[1] - 0.1 >= lf[3] + 0.04 - 1e-6, 'a box packed beside a lamp is clear of it (by the margin, on one axis or the other)');
  const sub = subtract([0, 0, 1, 1], [0.4, 0.4, 0.6, 0.6]);
  check(sub.length === 4 && sub.every((r: number[]) => !(r[0] < 0.6 && r[2] > 0.4 && r[1] < 0.6 && r[3] > 0.4)), 'subtracting a hole from the middle leaves four maximal rects (left, right, behind, in front), none over the hole');
  // every box that clears the hole stands whole in one of them, and none that touches it does
  let bad1 = 0;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    const x = 0.05 + i * 0.1, z = 0.05 + j * 0.1, E = 1e-9, box = [x - 0.05, z - 0.05, x + 0.05, z + 0.05], clear = box[2] <= 0.4 + E || box[0] >= 0.6 - E || box[3] <= 0.4 + E || box[1] >= 0.6 - E, inOne = sub.some((r: number[]) => box[0] >= r[0] - 1e-9 && box[1] >= r[1] - 1e-9 && box[2] <= r[2] + 1e-9 && box[3] <= r[3] + 1e-9);
    if (clear !== inOne) bad1++;
  }
  check(bad1 === 0, 'a box is inside one of the remaining rects exactly when it clears the hole');
  // a rotated host: the rects turn with it
  const hr = hostOf({ type: 'coffee-table', at: [0, 0], rot: 90 })!;
  check(hr.rot === 90 && hr.rects.length === 1, 'a host keeps its rot');
}

// ---- A. what the page builds --------------------------------------------------------------------------------------------
console.log('── A: the page builds what the registry says (every rect, 2 cm, 1 cm)');
type Probe = { type: string; label: string; params: any; top: number; rects: number[][] };
const probes: Probe[] = [];
for (const [t, def] of Object.entries<any>(HOSTS)) {
  if (only && !only.has(t)) continue;
  const s0 = sizeOf(t, {});
  probes.push({ type: t, label: 'default', params: {}, top: def.top, rects: def.rects(s0, {}) });
  const P: string[] = paramsOf(t);
  for (const k of def.sized || []) {
    if (!P.includes(k)) continue;
    const ext = k === 'w' ? s0.w : s0.d;
    // (the sizing params are the item's own `w` and `d`: the box's extent is what they set, within the fit line)
    for (const m of [0.75, 1.35]) { const v = Math.round(ext * m * 100) / 100, params = { [k]: v }, s = sizeOf(t, params); probes.push({ type: t, label: `${k}=${v}`, params, top: def.top, rects: def.rects(s, params) }); }
  }
}
const session = await startSession();
try {
  const w = await session.openBare();
  const res: Array<{ probe: Probe; cells: number; bad: number; worst: any; hi: number; lo: number; modes?: Record<string, number> }> = await w.page.evaluate(({ probes }: any) => {
    const hb = (window as any).__houseBuilderRef, T = (window as any).__THREE;
    const pal = { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', material: 'stucco' };
    const out: any[] = [];
    const step = 0.02;
    for (const p of probes) {
      const os = ['a', 'b', 'c'].map(sd => hb.buildProp(p.type, p.params, pal, sd));
      if (!os[0]) { out.push({ probe: p, cells: 0, bad: -1, worst: null, hi: 0, lo: 0 }); continue; }
      os.forEach((o: any) => o.updateMatrixWorld(true));
      // the bounding region of every rect
      const X0 = Math.min(...p.rects.map((r: number[]) => r[0])), X1 = Math.max(...p.rects.map((r: number[]) => r[2])), Z0 = Math.min(...p.rects.map((r: number[]) => r[1])), Z1 = Math.max(...p.rects.map((r: number[]) => r[3]));
      const nx = Math.ceil((X1 - X0) / step) + 1, nz = Math.ceil((Z1 - Z0) / step) + 1;
      const hm = new Float32Array(nx * nz).fill(-1);
      const v = new T.Vector3();
      for (const o of os) o.traverse((m: any) => {
        if (!m.isMesh || !m.geometry) return;
        const g = m.geometry, pos = g.attributes.position, idx = g.index, P: number[][] = [];
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); P.push([v.x, v.y, v.z]); }
        const nt = idx ? idx.count / 3 : pos.count / 3;
        for (let k = 0; k < nt; k++) {
          const a = P[idx ? idx.getX(k * 3) : k * 3], b = P[idx ? idx.getX(k * 3 + 1) : k * 3 + 1], c = P[idx ? idx.getX(k * 3 + 2) : k * 3 + 2];
          const ix0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - X0) / step)), ix1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - X0) / step));
          const iz0 = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - Z0) / step)), iz1 = Math.min(nz - 1, Math.ceil((Math.max(a[2], b[2], c[2]) - Z0) / step));
          const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-12) continue;
          for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
            const px = X0 + ix * step, pz = Z0 + iz * step;
            const l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / d, l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / d, l3 = 1 - l1 - l2;
            if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
            const y = l1 * a[1] + l2 * b[1] + l3 * c[1]; if (y > hm[iz * nx + ix]) hm[iz * nx + ix] = y;
          }
        }
      });
      let cells = 0, bad = 0, hi = 0, lo = 0, worst: any = null; const modes: Record<string, number> = {};
      for (const r of p.rects) {
        for (let x = r[0] + 0.01; x <= r[2] - 0.01 + 1e-9; x += step) for (let z = r[1] + 0.01; z <= r[3] - 0.01 + 1e-9; z += step) {
          const ix = Math.round((x - X0) / step), iz = Math.round((z - Z0) / step), y = hm[iz * nx + ix];
          cells++;
          { const k = y < 0 ? 'none' : String(Math.round(y * 200) / 200); modes[k] = (modes[k] || 0) + 1; }
          const dev = y < 0 ? -9 : y - p.top;
          if (y < 0 || Math.abs(dev) > 0.01) { bad++; if (y >= 0 && dev > 0) hi++; else lo++; if (!worst || Math.abs(dev) > Math.abs(worst.dev)) worst = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, y: Math.round(y * 1000) / 1000, dev: Math.round(dev * 1000) / 1000 }; }
        }
      }
      out.push({ probe: p, cells, bad, worst, hi, lo, modes });
    }
    return out;
  }, { probes });
  if (w.errors.length) console.error(`page errors: ${w.errors.slice(0, 2).join(' | ')}`);
  await w.close();
  for (const r of res) {
    const p = r.probe, name = `${p.type} (${p.label}): ${p.rects.length} rect${p.rects.length === 1 ? '' : 's'}, ${r.cells} samples at ${p.top} m`;
    if (r.bad < 0) { check(false, `${name}: the page cannot build it`); continue; }
    check(r.bad === 0, name, `${r.bad} samples off the top by more than 1 cm (${r.hi} above, ${r.lo} below or empty); worst at x ${r.worst && r.worst.x} z ${r.worst && r.worst.z}: height ${r.worst && r.worst.y}, ${r.worst && r.worst.dev} from the top\nheights (to 5 mm): ${JSON.stringify(r.modes)}\nrects: ${JSON.stringify(p.rects.map(q => q.map(v => Math.round(v * 1000) / 1000)))}`);
  }
} finally { await session.close(); }

// ---- D. the dress items' own sizes: every item the phase puts, built alone in the page with its own params, measures the box sizeOf gave the packer ---------------
console.log('── D: the packer\'s sizes are the page\'s (every dress item of the fixtures, within 0.04 m a side)');
{
  const { dressRooms } = await A('room-dress.js');
  const fs = await import('node:fs');
  const seen = new Map<string, any>();
  for (const id of ['dress-rooms', 'dress-baths', 'dress-kitchens', 'dress-styles']) {
    const spec = JSON.parse(fs.readFileSync(path.join(path.resolve(import.meta.dirname, '..'), 'test', 'fixtures', 'houses', `${id}.json`), 'utf8'));
    for (const r of dressRooms(spec).values()) for (const it of r.items) { const k = JSON.stringify([it.type, it.w, it.d, it.variant, it.color]); if (!seen.has(k)) seen.set(k, it); }
  }
  const items = [...seen.values()];
  const s2 = await startSession();
  try {
    const w = await s2.openBare();
    const res: Array<{ type: string; params: any; got: number[] | null }> = await w.page.evaluate(({ items }: any) => {
      const hb = (window as any).__houseBuilderRef, T = (window as any).__THREE, pal = { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', material: 'stucco' };
      return items.map((it: any) => { const { type, at, rot, y, src, dk, ...params } = it; const o = hb.buildProp(type, params, pal, 'a'); if (!o) return { type, params, got: null }; o.updateMatrixWorld(true); const b = new T.Box3().setFromObject(o); return { type, params, got: [b.min.x, b.max.x, b.min.z, b.max.z, b.max.y - b.min.y] }; });
    }, { items });
    await w.close();
    const off: string[] = [];
    for (const r of res) {
      if (!r.got) { off.push(`${r.type}: not built`); continue; }
      const sz = sizeOf(r.type, r.params), [x0, x1, z0, z1] = r.got;
      if (!sz) { off.push(`${r.type}: no size`); continue; }
      const dw = Math.abs((x1 - x0) - sz.w), dd = Math.abs((z1 - z0) - sz.d), dx = Math.abs((x0 + x1) / 2 - sz.ox), dz = Math.abs((z0 + z1) / 2 - sz.oz);
      // (foliage leans a different way in every seed: it may be SMALLER than the box it was measured at, never bigger)
      const plant = PLACEMENT[r.type] && PLACEMENT[r.type].group === 'plant', grew = Math.max((x1 - x0) - sz.w, (z1 - z0) - sz.d);
      if (plant ? grew > 0.04 : Math.max(dw, dd, dx, dz) > 0.04) off.push(`${r.type} ${JSON.stringify(r.params)}: the page builds ${(x1 - x0).toFixed(3)} x ${(z1 - z0).toFixed(3)} (centre ${((x0 + x1) / 2).toFixed(3)}, ${((z0 + z1) / 2).toFixed(3)}), sizeOf says ${sz.w.toFixed(3)} x ${sz.d.toFixed(3)} (centre ${sz.ox.toFixed(3)}, ${sz.oz.toFixed(3)})`);
    }
    check(!off.length, `${items.length} distinct dress items (type, size, variant, glaze) build the box the packer used`, off.join('\n'));
  } finally { await s2.close(); }
}
console.log(bad ? `✗ ${bad} wrong` : `✓ dress hosts: ${probes.length} probes over ${Object.keys(HOSTS).length} hosts, 0 wrong`);
process.exit(bad ? 1 : 0);
