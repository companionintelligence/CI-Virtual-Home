// Facade — what dresses a storey's outside walls (plan S2 tasks 3, 5, 6):
//
//   facade zones    `facade: [{ level?, side?, from?, to?, yFrom?, yTo?, rect?, material, color }]` — cladding panels laid
//                   on the walls' outer faces over a span and a height (a stone base, a timber upper storey, a brick
//                   gable wall), cut round the openings; a zone with `rect` wears every exterior wall of that rect
//   bands           `facade: { bands: [{ y, h?, material?, color?, proud?, sides? }] }` — string courses and floor bands
//   plinths         `levels[i].plinth: { h?, material?, color?, proud? }` — a base course; a storey standing above grade
//                   with nothing under it in plan also gets its foundation, clad the same, from grade to its floor
//   opening dressing `openings[].shutters | box | head | surround | blinds | canopy` — shutters (panel, louvre, board), a
//                   window box with planting, a head (arch, segmental, pediment, keystone, crown), a surround (casing, stone,
//                   brick soldier course, box reveal) with its sill, an interior roller blind, and a canopy over the opening
//                   (flat, lattice, awning, gable, shed — registered as a roof, so it fades with the roofs)
//   stoops          `entry.stoop: { depth?, w?, steps?, rail?, material?, color? }` — a landing at the door and steps to grade
//
// Opening frames come from arch-plan.ts openingFrames() (the same defaults kit-build.ts gives the wall's holes). S1's
// `anchors.openings`, when it lands, carries the same frames. Everything here is built only when the spec asks.
// Owner: S2 (architecture).
import { perimeterEdges } from './house-geometry.js';
import { openingFrames, OUT, WALL_HALF, inR } from './arch-plan.js';
import { mulberry32, fnv1a } from './materials.js';

const SIDE_ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
const SIDE_ORI = { S: 'south', N: 'north', E: 'east', W: 'west' };
const hexOf = (c: any, d: number) => (c === undefined || c === null ? d : typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16));
/** A depth bias for the dressing's own materials. A surround, a head or a shutter is drawn flush with the wall's own casing (0.03 proud) and
 *  shares its planes with it, and two flat faces on one plane flicker. The bias makes the dressing win them; unlike a 2 mm move of the boxes it
 *  leaves the world digest alone (plan.json shots.world, and the bake locks' worldSha, are mm-rounded boxes of every structure mesh). */
const BIAS = { polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -4 };
export const facadeOf = (spec: any) => (Array.isArray(spec.facade) ? { zones: spec.facade, bands: [] } : { zones: (spec.facade || {}).zones || [], bands: (spec.facade || {}).bands || [] });
/** does this storey need the facade module at all? */
export function facadeWanted(spec: any, lv: any, lowestY: number) {
  const f = facadeOf(spec);
  return !!lv.plinth || f.zones.some(z => z.level === undefined || z.level === lv.id) || f.bands.length > 0
    || (lv.openings || []).some(o => o.shutters || o.box || (o.head && o.head !== 'flat') || o.surround || o.blinds || o.canopy)
    || !!(spec.entry && spec.entry.stoop && spec.entry.level === lv.id);
}

export function createFacade(bctx) {
  const { THREE, group, registerRoof, registerTrackedWall } = bctx;
  const fresh = (c: number, extra: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra });   // canopies: own materials (the roof fade writes to them)

  // panels on a wall's outer face over [a0, a1] × [y0, y1] (along, height over the storey floor), round the holes. The
  // group is world-aligned at the storey's floor; `face` is the face line (z for S/N walls, x for E/W), `n` the outward sign.
  function facePanels(gg, { horiz, face, n, a0, a1, y0, y1, holes, mat, proud = 0.018, off = 0.004 }) {
    // cut points inside the span only (a hole beyond it — another zone's window — is none of this panel's business)
    const xs = [...new Set([a0, a1, ...holes.flatMap(h => [h.a0, h.a1]).filter(v => v > a0 && v < a1)])].sort((p, q) => p - q);
    const T = proud - off, c = face + n * (off + T / 2);
    for (let i = 0; i < xs.length - 1; i++) {
      const p0 = xs[i], p1 = xs[i + 1], pm = (p0 + p1) / 2;
      if (p1 - p0 < 0.005) continue;
      const cut = holes.filter(h => pm > h.a0 && pm < h.a1).map(h => [Math.max(y0, h.y0 - 0.02), Math.min(y1, h.y1 + 0.02)]).filter(q => q[1] > q[0]).sort((p, q) => p[0] - q[0]);
      let yy = y0;
      for (const [c0, c1] of [...cut, [y1, y1]]) {
        if (c0 - yy > 0.005) { const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? p1 - p0 : T, c0 - yy, horiz ? T : p1 - p0), mat); m.position.set(horiz ? pm : c, (yy + c0) / 2, horiz ? c : pm); m.castShadow = false; m.receiveShadow = true; gg.add(m); }
        yy = Math.max(yy, c1);
      }
    }
  }
  const outerEnd = (lv, e, end) => {   // is this end of an edge an outside corner?
    const horiz = e.side === 'S' || e.side === 'N', n = OUT[e.side], p = end === 0 ? e.a : e.b, d = end === 0 ? -1 : 1;
    const px = horiz ? p[0] + d * 0.05 : p[0], pz = horiz ? p[1] : p[1] + d * 0.05;
    return [1, -1].every(k => !(lv.footprint || []).some(r => inR(px + (horiz ? 0 : k * n[0] * 0.05), pz + (horiz ? k * n[1] * 0.05 : 0), r, -1e-6)));
  };

  function levelFacade({ spec, lv, y, H, palette, am, put, anchors, lowestY }) {
    const edges = perimeterEdges(lv.footprint || []), frames = openingFrames(lv, edges, spec);
    const holesOn = e => frames.filter(f => f.edge === e).map(f => ({ a0: (e.side === 'S' || e.side === 'N' ? f.cx : f.cz) - f.w / 2, a1: (e.side === 'S' || e.side === 'N' ? f.cx : f.cz) + f.w / 2, y0: f.sill, y1: f.top }));
    const fac = facadeOf(spec);

    // ---- plinth and foundation
    if (lv.plinth) {
      const pl = lv.plinth, proud = pl.proud ?? 0.04;
      const mat = am.cladding({ kind: pl.material || 'stone', color: pl.color || '#a39c90' });
      // the foundation: the parts of the footprint with no storey under them, from grade to the floor
      if (y > 0.05) {
        const below = (spec.levels || []).filter(o => (o.y || 0) < y - 0.3);
        const cells = footprintCells(lv.footprint, r => !below.some(o => (o.footprint || []).some(q => inR(r[0], r[1], q, -0.01))));
        if (cells.length) put(() => {
          const gg = group(`Foundation (${lv.id})`, { category: 'Architecture' });
          for (const c of cells) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(c.w + 2 * (WALL_HALF + proud), y - 0.01, c.d + 2 * (WALL_HALF + proud)), mat);
            m.position.set(c.x + c.w / 2, (y - 0.01) / 2, c.z + c.d / 2); m.castShadow = true; m.receiveShadow = true; gg.add(m);
          }
          return gg;
        }, 0, 0, 0, null, 'structure');
      }
      // the base course above the floor (a plinth at grade, or one taller than the foundation)
      const h = pl.h ?? (y > 0.05 ? 0 : 0.45);
      (anchors.arch.plinths ||= []).push({ level: lv.id, h: Math.round(h * 1000) / 1000, foundation: y > 0.05, material: pl.material || 'stone', color: pl.color || '#a39c90' });
      if (h > 0.02) put(() => {
        const gg = group(`Plinth course (${lv.id})`, { category: 'Architecture' });
        for (const e of edges) {
          const horiz = e.side === 'S' || e.side === 'N', n = horiz ? OUT[e.side][1] : OUT[e.side][0], line = horiz ? e.a[1] : e.a[0];
          const ext = proud + 0.004;
          facePanels(gg, { horiz, face: line + n * WALL_HALF, n, a0: (horiz ? e.a[0] : e.a[1]) - (outerEnd(lv, e, 0) ? ext : 0), a1: (horiz ? e.b[0] : e.b[1]) + (outerEnd(lv, e, 1) ? ext : 0), y0: 0, y1: h, holes: holesOn(e), mat, proud, off: 0.002 });
        }
        return gg;
      }, 0, 0, y, null, 'structure');
    }

    // Cladding, bands and opening dressing hang on a wall, so each is registered with that wall's side and folds away with it
    // when the cutaway lowers the wall (collapsed heights: a lowered wall shows its own cladding, not a shutter in mid-air)
    const onWall = (o: any, side: string) => { if (typeof registerTrackedWall === 'function') registerTrackedWall(o, SIDE_ORI[side], H, 0.02, 0.02); return o; };
    const SIDES = ['S', 'N', 'E', 'W'];

    // ---- cladding zones on this storey
    const zones = fac.zones.filter(z => z.level === undefined || z.level === lv.id);
    if (zones.length) for (const side of SIDES) {
      const gg = group(`Facade zones (${lv.id} ${side})`, { category: 'Architecture' });
      for (const z of zones) {
        const mat = am.cladding({ kind: z.material || 'stucco', color: z.color || palette.wall || '#f1f5f9' });
        for (const e of edges) {
          if (e.side !== side) continue;
          const horiz = e.side === 'S' || e.side === 'N', n = horiz ? OUT[e.side][1] : OUT[e.side][0], line = horiz ? e.a[1] : e.a[0];
          let lo = horiz ? e.a[0] : e.a[1], hi = horiz ? e.b[0] : e.b[1];
          if (z.rect) {
            // every edge (or edge piece) of this rect's outline on this storey
            const r = z.rect, onLine = horiz ? Math.abs(line - (e.side === 'N' ? r.z : r.z + r.d)) < 0.02 : Math.abs(line - (e.side === 'W' ? r.x : r.x + r.w)) < 0.02;
            if (!onLine) continue;
            lo = Math.max(lo, horiz ? r.x : r.z); hi = Math.min(hi, horiz ? r.x + r.w : r.z + r.d);
          } else {
            if (z.side && z.side !== e.side) continue;
            if (z.from !== undefined) lo = Math.max(lo, z.from);
            if (z.to !== undefined) hi = Math.min(hi, z.to);
          }
          if (hi - lo < 0.05) continue;
          const ext = 0.022, fullLo = Math.abs(lo - (horiz ? e.a[0] : e.a[1])) < 1e-3, fullHi = Math.abs(hi - (horiz ? e.b[0] : e.b[1])) < 1e-3;
          facePanels(gg, { horiz, face: line + n * WALL_HALF, n, a0: lo - (fullLo && outerEnd(lv, e, 0) ? ext : 0), a1: hi + (fullHi && outerEnd(lv, e, 1) ? ext : 0), y0: z.yFrom ?? 0, y1: Math.min(H, z.yTo ?? H), holes: holesOn(e), mat });
        }
      }
      if (gg.children.length) onWall(put(() => gg, 0, 0, y, null, 'structure'), side);
    }

    // ---- string courses crossing this storey
    const bands = fac.bands.filter(b => b.y >= y - 1e-6 && b.y < y + H - 0.05);
    if (bands.length) for (const side of SIDES) {
      const gg = group(`Facade bands (${lv.id} ${side})`, { category: 'Architecture' });
      for (const b of bands) {
        if (b.sides && !b.sides.includes(side)) continue;
        const mat = b.material ? am.cladding({ kind: b.material, color: b.color || palette.trim || '#e7e2d8' }) : am.paint(b.color || palette.trim || '#e7e2d8', { roughness: 0.75 });
        const proud = b.proud ?? 0.035, hb = b.h ?? 0.18, y0 = b.y - y;
        for (const e of edges) {
          if (e.side !== side) continue;
          const horiz = e.side === 'S' || e.side === 'N', n = horiz ? OUT[e.side][1] : OUT[e.side][0], line = horiz ? e.a[1] : e.a[0];
          const ext = proud + 0.004;
          facePanels(gg, { horiz, face: line + n * WALL_HALF, n, a0: (horiz ? e.a[0] : e.a[1]) - (outerEnd(lv, e, 0) ? ext : 0), a1: (horiz ? e.b[0] : e.b[1]) + (outerEnd(lv, e, 1) ? ext : 0), y0, y1: Math.min(H, y0 + hb), holes: holesOn(e), mat, proud, off: 0.004 });
        }
      }
      if (gg.children.length) onWall(put(() => gg, 0, 0, y, null, 'structure'), side);
    }

    // ---- opening dressing
    for (const f of frames) {
      const op = f.op;
      if (!(op.shutters || op.box || (op.head && op.head !== 'flat') || op.surround || op.blinds || op.canopy)) continue;
      const u = put(() => dressOpening({ spec, lv, f, palette, am }), f.cx, f.cz, y, null, 'structure');
      u.rotation.y = SIDE_ROT[f.side];
      onWall(u, f.side);
      if (op.canopy) {
        const c = put(() => canopy({ f, op, palette }), f.cx, f.cz, y, null, null);
        c.rotation.y = SIDE_ROT[f.side];
        c.userData.isRoof = true;
        registerRoof(c);
      }
    }

    // ---- the entry's stoop
    if (spec.entry && spec.entry.stoop && spec.entry.level === lv.id) {
      const ef = frames.find(f => f.side === spec.entry.side && Math.abs(f.op.at - spec.entry.at) < 1e-6);
      if (ef) {
        const s = put(() => stoop({ spec, lv, y, f: ef, am }), ef.cx, ef.cz, 0, null, 'structure'); s.rotation.y = SIDE_ROT[ef.side];
        // the landing and its steps in plan (the plan twins draw them): a rect out of the door's wall face, and the run of steps beyond it
        const st = spec.entry.stoop, depth = st.depth ?? 1.2, w = st.w ?? ef.w + 0.9, top = Math.max(0.12, y), n = st.steps ?? Math.max(0, Math.round(top / 0.17) - 0), run = 0.3;
        const horiz = ef.side === 'S' || ef.side === 'N', nrm = ef.out, r3 = (v: number) => Math.round(v * 1000) / 1000;
        const box = (d0: number, d1: number) => horiz ? { x: r3(ef.cx - w / 2), z: r3(Math.min(ef.cz + nrm[1] * d0, ef.cz + nrm[1] * d1)), w: r3(w), d: r3(Math.abs(d1 - d0)) } : { x: r3(Math.min(ef.cx + nrm[0] * d0, ef.cx + nrm[0] * d1)), z: r3(ef.cz - w / 2), w: r3(Math.abs(d1 - d0)), d: r3(w) };
        anchors.arch.stoop = { level: lv.id, side: ef.side, at: spec.entry.at, top: r3(top), steps: n, run, rail: st.rail || false, landing: box(0, depth), stairs: n > 0 ? box(depth, depth + n * run) : null };
      }
    }
  }

  // the footprint cut into 0.1 m-aligned cells that pass `keep`, merged back into rects row by row
  function footprintCells(rects, keep) {
    const out = [];
    for (const r of rects) {
      // coarse: keep a rect whole when its centre and corners pass, else split it in a 4 × 4 grid
      const pts = [[r.x + r.w / 2, r.z + r.d / 2], [r.x + 0.05, r.z + 0.05], [r.x + r.w - 0.05, r.z + 0.05], [r.x + 0.05, r.z + r.d - 0.05], [r.x + r.w - 0.05, r.z + r.d - 0.05]];
      if (pts.every(p => keep(p))) { out.push(r); continue; }
      const n = 4, cw = r.w / n, cd = r.d / n;
      for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { const c = { x: r.x + i * cw, z: r.z + k * cd, w: cw, d: cd }; if (keep([c.x + cw / 2, c.z + cd / 2])) out.push(c); }
    }
    return out;
  }

  // ---- one opening's dressing, in its wall frame: local +x along the wall, +z out of it, y over the storey floor
  function dressOpening({ spec, lv, f, palette, am }) {
    const op = f.op, gg = group(`Opening dressing (${lv.id} ${f.side} ${op.at})`, { category: 'Architecture' });
    const w = f.w, sill = f.sill, top = f.top, h = f.h, win = f.kind === 'window' || f.kind === 'glass';
    const box = (bw, bh, bd, x, yy, z, mat, shadow = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat); m.position.set(x, yy, z); m.castShadow = shadow; m.receiveShadow = true; gg.add(m); return m; };
    const accent = hexOf(palette.accent, 0x3f5a4a), trim = hexOf(palette.trim, 0x2b2f33);
    const r = mulberry32(fnv1a(`${spec.id}:${lv.id}:${f.side}:${op.at}:dress`));
    // shutters: a leaf each side, half the opening wide, standing just off the wall
    if (op.shutters) {
      const s = typeof op.shutters === 'object' ? op.shutters : {}, col = am.paint(hexOf(s.color, accent), { roughness: 0.6, ...BIAS }), dark = am.paint(hexOf(s.color, accent) === 0 ? 0x111111 : mixHex(hexOf(s.color, accent), 0x000000, 0.25), { roughness: 0.7, ...BIAS });
      const sw = Math.min(0.6, Math.max(0.3, w / 2)), sh = win ? h : Math.min(h, 2.1);
      for (const sd of [-1, 1]) {
        const cx = sd * (w / 2 + 0.08 + sw / 2), cy = (win ? sill : 0) + sh / 2, z = 0.03;
        if (s.style === 'louvre') {
          box(0.045, sh, 0.03, cx - sw / 2 + 0.0225, cy, z, col); box(0.045, sh, 0.03, cx + sw / 2 - 0.0225, cy, z, col);
          box(sw, 0.05, 0.03, cx, cy - sh / 2 + 0.025, z, col); box(sw, 0.05, 0.03, cx, cy + sh / 2 - 0.025, z, col); box(sw, 0.04, 0.03, cx, cy, z, col);
          const n = Math.max(4, Math.round((sh - 0.1) / 0.06));
          for (let i = 0; i < n; i++) { const sl = box(sw - 0.09, 0.012, 0.045, cx, cy - sh / 2 + 0.06 + (sh - 0.12) * (i + 0.5) / n, z, col, false); sl.rotation.x = -0.5; }
        } else if (s.style === 'board') {
          const nb = Math.max(2, Math.round(sw / 0.12));
          for (let i = 0; i < nb; i++) box(sw / nb - 0.006, sh, 0.028, cx - sw / 2 + (sw / nb) * (i + 0.5), cy, z, col);
          box(sw - 0.04, 0.08, 0.02, cx, cy + sh * 0.3, z + 0.02, col); box(sw - 0.04, 0.08, 0.02, cx, cy - sh * 0.3, z + 0.02, col);
          const brace = box(0.07, Math.hypot(sw - 0.1, sh * 0.6), 0.02, cx, cy, z + 0.02, col); brace.rotation.z = sd * Math.atan2(sw - 0.1, sh * 0.6);
        } else {
          box(sw, sh, 0.035, cx, cy, z, col);
          for (const k of [-1, 1]) box(sw - 0.12, sh / 2 - 0.12, 0.01, cx, cy + k * sh / 4, z + 0.02, dark, false);
        }
      }
    }
    // a window box under the sill, with seeded planting
    if (op.box && win) {
      const b = typeof op.box === 'object' ? op.box : {}, col = am.paint(hexOf(b.color, trim), { roughness: 0.7, ...BIAS });
      const bw = w + 0.1, y0 = sill - 0.04;
      box(bw, 0.22, 0.22, 0, y0 - 0.11, 0.13, col); box(bw - 0.04, 0.02, 0.18, 0, y0 - 0.02, 0.13, am.paint(0x4a3a2c), false);
      const leaf = am.paint(0x4f6b3a, { roughness: 0.9 }), bloom = am.paint(hexOf(b.bloom, [0xd1495b, 0xe9c46a, 0xf4a3b5, 0xffffff][Math.floor(r() * 4)]), { roughness: 0.8 });
      const n = Math.max(4, Math.round(bw / 0.12));
      for (let i = 0; i < n; i++) {
        const x = -bw / 2 + 0.06 + (bw - 0.12) * (i + r() * 0.6) / n, s2 = 0.07 + r() * 0.05;
        const m = new THREE.Mesh(new THREE.SphereGeometry(s2, 7, 5), r() < 0.45 && b.plants !== 'herbs' ? bloom : leaf); m.position.set(x, y0 + s2 * 0.8, 0.1 + r() * 0.08); m.castShadow = true; gg.add(m);
      }
      // trailing stems over the front edge: narrow, uneven, a leaf cluster at each tip
      if (b.plants === 'trailing' || b.plants === undefined) for (let i = 0; i < Math.round(bw / 0.09); i++) {
        if (r() < 0.45) continue;
        const len = 0.12 + r() * 0.34, x = -bw / 2 + 0.06 + (bw - 0.12) * r();
        const stem = new THREE.Mesh(new THREE.BoxGeometry(0.018, len, 0.018), am.paint(0x3f5a2e, { roughness: 0.95 })); stem.position.set(x, y0 - 0.02 - len / 2, 0.245 + r() * 0.01); stem.rotation.z = (r() - 0.5) * 0.3; gg.add(stem);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035 + r() * 0.02, 6, 4), leaf); tip.position.set(x, y0 - 0.02 - len, 0.25); gg.add(tip);
      }
    }
    // a surround over the wall's own trim, and its sill
    if (op.surround && op.surround.kind !== 'none') {
      const s = op.surround, kind = s.kind;
      const own = (m: any) => Object.assign(am.own(m), BIAS);   // the cladding kit's material is shared with the wall: the dressing gets a private copy to bias
      const col = kind === 'stone' ? own(am.cladding({ kind: 'stone', color: s.color || '#cfc8bb' })) : kind === 'brick-soldier' ? own(am.cladding({ kind: 'brick', color: s.color || '#8f4d3a' })) : am.paint(hexOf(s.color, trim === 0 ? 0xf2efe9 : 0xf2efe9), { roughness: 0.55, ...BIAS });
      const bw = s.w ?? (kind === 'stone' ? 0.16 : kind === 'box-reveal' ? 0.06 : 0.1), dp = s.depth ?? (kind === 'stone' ? 0.05 : kind === 'box-reveal' ? 0.22 : 0.03);
      const y0 = win ? sill : 0, y1 = top;
      if (kind === 'box-reveal') {
        // a deep frame round the opening, standing out of the wall
        box(bw, y1 - y0 + bw, dp, -w / 2 - bw / 2, (y0 + y1) / 2 + (win ? 0 : bw / 2), dp / 2, col); box(bw, y1 - y0 + bw, dp, w / 2 + bw / 2, (y0 + y1) / 2 + (win ? 0 : bw / 2), dp / 2, col);
        box(w + 2 * bw, bw, dp, 0, y1 + bw / 2, dp / 2, col); if (win) box(w + 2 * bw, bw, dp, 0, y0 - bw / 2, dp / 2, col);
      } else if (kind === 'brick-soldier') {
        box(w + 0.2, 0.22, dp, 0, y1 + 0.11, dp / 2, col);
      } else {
        for (const sd of [-1, 1]) box(bw, y1 - y0 + (win ? 0 : 0), dp, sd * (w / 2 + bw / 2), (y0 + y1) / 2, dp / 2, col);
        box(w + 2 * bw, bw * (kind === 'stone' ? 1.3 : 1), dp, 0, y1 + bw * (kind === 'stone' ? 0.65 : 0.5), dp / 2, col);
      }
      const sillD = s.sill ?? (win ? (kind === 'stone' ? 0.09 : 0.06) : 0);
      if (win && sillD > 0) box(w + 2 * bw + 0.06, 0.06, sillD + dp, 0, y0 - 0.03, (sillD + dp) / 2, col);
    }
    // the head's dressing
    if (op.head && op.head !== 'flat') {
      const col = am.paint(hexOf(op.surround && op.surround.color, 0xf2efe9), { roughness: 0.55, ...BIAS });
      const yh = top + (op.surround && op.surround.kind !== 'none' ? 0.1 : 0.03);
      if (op.head === 'crown') {
        box(w + 0.3, 0.12, 0.05, 0, yh + 0.06, 0.025, col); box(w + 0.42, 0.06, 0.14, 0, yh + 0.15, 0.07, col);
      } else if (op.head === 'pediment') {
        const rise = Math.min(0.35, 0.22 + w * 0.05), tri = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.22, 0), new THREE.Vector2(w / 2 + 0.22, 0), new THREE.Vector2(0, rise)]);
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: false }), col); m.position.set(0, yh + 0.08, 0); m.castShadow = true; gg.add(m);
        box(w + 0.5, 0.08, 0.13, 0, yh + 0.04, 0.065, col);
      } else if (op.head === 'keystone') {
        box(w + 0.16, 0.12, 0.03, 0, yh + 0.06, 0.015, col);
        const ks = new THREE.Shape([new THREE.Vector2(-0.07, 0), new THREE.Vector2(0.07, 0), new THREE.Vector2(0.1, 0.26), new THREE.Vector2(-0.1, 0.26)]);
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(ks, { depth: 0.06, bevelEnabled: false }), col); m.position.set(0, yh - 0.04, 0); gg.add(m);
      } else {
        // arch / segmental: a fanlight of dark glass over the head and a trim ring round it
        const seg = op.head === 'segmental', R = seg ? (w * w / 4 + (0.15 * w) ** 2) / (2 * 0.15 * w) : w / 2, rise = seg ? 0.15 * w : w / 2;
        const th = seg ? 2 * Math.asin(w / 2 / R) : Math.PI, cy = yh - 0.03 + rise - R;
        const fan = new THREE.Shape(); fan.moveTo(-w / 2, yh - 0.03); fan.absarc(0, cy, R, Math.PI / 2 + th / 2, Math.PI / 2 - th / 2, true); fan.lineTo(-w / 2, yh - 0.03);
        const gl = new THREE.Mesh(new THREE.ShapeGeometry(fan, 24), new THREE.MeshStandardMaterial({ color: 0x1d242b, roughness: 0.14, metalness: 0.5 })); gl.position.z = 0.006; gl.userData.windowGlow = true; gg.add(gl);
        const ring = new THREE.Shape(); ring.absarc(0, cy, R + 0.09, Math.PI / 2 + th / 2 + 0.02, Math.PI / 2 - th / 2 - 0.02, true); ring.absarc(0, cy, R, Math.PI / 2 - th / 2, Math.PI / 2 + th / 2, false);
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.04, bevelEnabled: false, curveSegments: 24 }), col); m.castShadow = true; gg.add(m);
      }
    }
    // an interior roller blind, on the inside face
    if (op.blinds && win) {
      const b = op.blinds, drop = Math.max(0.05, Math.min(1, b.drop ?? 0.35)), col = am.paint(hexOf(b.color, 0xe9e3d6), { roughness: 0.95, side: THREE.DoubleSide });
      const zin = -2 * WALL_HALF - 0.04;
      box(w - 0.06, h * drop, 0.006, 0, top - 0.05 - h * drop / 2, zin, col, false);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, w - 0.04, 12), am.paint(0xdcd6ca)); tube.rotation.z = Math.PI / 2; tube.position.set(0, top - 0.04, zin); gg.add(tube);
    }
    return gg;
  }

  // ---- a canopy over an opening (its own materials: it fades with the roofs)
  function canopy({ f, op, palette }) {
    const c = op.canopy, gg = group(`Canopy (${c.kind} over ${f.kind} ${f.side} ${op.at})`, { category: 'Architecture', isRoof: true });
    const depth = c.depth ?? 0.9, ext = c.extend ?? 0.25, w = f.w + 2 * ext, yh = f.top + 0.2;
    const col = hexOf(c.color, hexOf(palette.trim, 0x2b2f33)), mat = fresh(col, { roughness: 0.6 });
    const box = (bw, bh, bd, x, yy, z, m = mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m); b.position.set(x, yy, z); b.castShadow = true; b.receiveShadow = true; gg.add(b); return b; };
    if (c.kind === 'flat') { box(w, 0.1, depth, 0, yh + 0.05, depth / 2); box(w, 0.04, 0.03, 0, yh + 0.11, depth - 0.015); }
    else if (c.kind === 'lattice') {
      for (const sd of [-1, 1]) box(0.06, 0.12, depth, sd * (w / 2 - 0.03), yh + 0.06, depth / 2);
      const n = Math.max(3, Math.round(w / 0.2)); for (let i = 0; i <= n; i++) box(0.04, 0.06, depth, -w / 2 + w * i / n, yh + 0.15, depth / 2);
      box(w, 0.1, 0.06, 0, yh + 0.06, depth - 0.03);
    } else if (c.kind === 'awning') {
      const fab = fresh(hexOf(c.color, hexOf(palette.accent, 0x3f5a4a)), { roughness: 0.95, side: THREE.DoubleSide });
      const slope = Math.hypot(depth, 0.45), pl = new THREE.Mesh(new THREE.PlaneGeometry(w, slope), fab);
      pl.rotation.x = -Math.PI / 2 + Math.atan2(0.45, depth); pl.position.set(0, yh + 0.225, depth / 2); gg.add(pl);
      const val = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.18), fab); val.position.set(0, yh - 0.09, depth); gg.add(val);
    } else {
      // gable or shed: a small roof on brackets
      const pitch = c.kind === 'gable' ? 30 : 14, t = Math.tan(pitch * Math.PI / 180);
      if (c.kind === 'shed') { const len = Math.hypot(depth, depth * t), s = box(w, 0.07, len, 0, yh + depth * t / 2 + 0.035, depth / 2); s.rotation.x = Math.atan(t); }
      else {
        const half = w / 2, rise = half * t, len = Math.hypot(half, rise);
        for (const sd of [-1, 1]) { const s = box(len, 0.07, depth, sd * half / 2, yh + rise / 2 + 0.035, depth / 2); s.rotation.z = -sd * Math.atan(t); }
        const tri = new THREE.Shape([new THREE.Vector2(-half + 0.05, 0), new THREE.Vector2(half - 0.05, 0), new THREE.Vector2(0, rise - 0.03)]);
        const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false }), fresh(0xf2efe9, { roughness: 0.6 })); ped.position.set(0, yh, depth - 0.06); gg.add(ped);
      }
    }
    if (c.supports !== 'none' && c.kind !== 'awning') {
      const br = fresh(hexOf(c.color, hexOf(palette.trim, 0x2b2f33)), { roughness: 0.6 });
      if (c.supports === 'posts') for (const sd of [-1, 1]) box(0.1, yh, 0.1, sd * (w / 2 - 0.08), yh / 2, depth - 0.08, br);
      else for (const sd of [-1, 1]) { const b = box(0.05, 0.05, Math.hypot(depth * 0.6, 0.4), sd * (w / 2 - 0.1), yh - 0.2, depth * 0.3, br); b.rotation.x = Math.atan2(0.4, depth * 0.6); }
    }
    return gg;
  }

  // ---- the entry's stoop: a landing at the door's sill and steps to grade, in the door's wall frame at grade
  function stoop({ spec, lv, y, f, am }) {
    const s = spec.entry.stoop, gg = group(`Stoop (${lv.id})`, { category: 'Architecture' });
    const depth = s.depth ?? 1.2, w = s.w ?? f.w + 0.9, top = Math.max(0.12, y), n = s.steps ?? Math.max(0, Math.round(top / 0.17) - 0);
    const kind = s.material || 'stone';
    const mat = kind === 'timber' ? am.floor({ kind: 'deck', ...(s.color ? { color: s.color } : {}) }) : kind === 'brick' ? am.cladding({ kind: 'brick', color: s.color || '#8f4d3a' }) : kind === 'concrete' ? am.floor({ kind: 'concrete', ...(s.color ? { color: s.color } : {}) }) : am.cladding({ kind: 'stone', color: s.color || '#b4ada1' });
    const box = (bw, bh, bd, x, yy, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat); m.position.set(x, yy, z); m.castShadow = true; m.receiveShadow = true; gg.add(m); return m; };
    box(w, top - 0.005, depth, 0, (top - 0.005) / 2, depth / 2);
    const rise = n > 0 ? top / (n + 1) : top, run = 0.3;
    for (let i = 0; i < n; i++) { const hh = top - rise * (i + 1); if (hh < 0.02) break; box(w - 0.1, hh, run, 0, hh / 2, depth + run * (i + 0.5)); }
    if (s.rail) {
      const railMat = s.rail === 'timber' ? am.paint(0x5b4636, { roughness: 0.6 }) : am.paint(0x1f2226, { roughness: 0.4, metalness: 0.6 });
      const runL = depth + n * run;
      for (const sd of [-1, 1]) {
        const x = sd * (w / 2 - 0.05);
        for (const [z, yb] of [[0.1, top], [depth, top], [runL, top - n * rise]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.05), railMat); p.position.set(x, yb + 0.475, z); gg.add(p); }
        const lr = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, depth - 0.05), railMat); lr.position.set(x, top + 0.93, (depth + 0.1) / 2); gg.add(lr);
        if (n > 0) { const L = Math.hypot(n * run, n * rise), sr = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, L), railMat); sr.rotation.x = Math.atan2(n * rise, n * run); sr.position.set(x, top + 0.93 - n * rise / 2, depth + n * run / 2); gg.add(sr); }
      }
    }
    return gg;
  }

  return { levelFacade };
}
function mixHex(a: number, b: number, t: number) {
  const ch = (c: number, s: number) => (c >> s) & 255;
  return (Math.round(ch(a, 16) * (1 - t) + ch(b, 16) * t) << 16) | (Math.round(ch(a, 8) * (1 - t) + ch(b, 8) * t) << 8) | Math.round(ch(a, 0) * (1 - t) + ch(b, 0) * t);
}
