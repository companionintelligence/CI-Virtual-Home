// Features — the architecture a house has besides walls and roofs (plan S2 tasks 7–12):
//
//   porch      { side, from, to, depth, roof: shed|hip|gable|flat|none, pitch, posts: {spacing|n, style, size, color}, rail,
//              floorY, steps, ceiling } — a deck on a skirt, posts (never in a doorway or on the steps), a header, rails,
//              steps to grade, and a real roof: built by roofs.ts from a one-roof spec, so it has the eaves, fascia,
//              gutters and soffit every roof has, and abuts the house wall instead of passing into it
//   balcony    { level, side, from, to, depth | rect, rail: glass|metal|timber|parapet|none } — a slab out of the wall with
//              rails round its free edges;  terrace { level, rect } — a deck and rails on a lower roof (it fades with the
//              roof);  loggia { level, rect, posts } — a recessed outdoor room under the storey above, floored and railed
//   bay        { level, side, at, w, depth, form: box|canted, roof: hip|shed|flat|gable|none, skirt: grade|oriel|none, sill, head, h }
//              — the host wall opened, a floor on a stone skirt to grade (lowest storey) or a sill course (higher: an oriel), glazed
//              walls (box, or canted at 45°), a ceiling and its own roof (none: a bay over it stands on its top)
//   fireplace  { level, at, rot, style: modern|mantel|stone|painted-brick|tv-breast, w, chimney, stack: outside|inside } —
//              a chimney breast with its hearth, and the stack it needs: outside an exterior wall (shouldered, from grade; its
//              width is along the wall, its depth out of it, on an E or W wall as on a S or N one)
//              or up through the storeys above, always out through the roof over it. A fireplace room item with
//              `chimney: true` gets the stack alone.
//   builtin    { level, kind: bookcase-wall|niche|wine-wall|window-seat|media-wall, from, to, face, h, d, color }
//   partitions[].style  half | posts | slats | glass | arch | bookcase (solid stays S1's partition builder)
//
// Plan-geometry helpers (porch posts, …) are in arch-plan.ts so the validator and the plan twins place things the same way.
// Owner: S2 (architecture).
import { perimeterEdges } from './house-geometry.js';
import { edgeFor, porchPlan, featureLevel, offWallRect, OUT, WALL_HALF, inR } from './arch-plan.js';
import { buildRoofs, planRoofModels, roofTopAt, roofUnderAt } from './roofs.js';
import { mulberry32, fnv1a } from './materials.js';
import { worldUV } from './textures.js';
import { createArchMaterials } from './arch-materials.js';

const SIDE_ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
const SIDE_ORI = { S: 'south', N: 'north', E: 'east', W: 'west' };
const OPP = { S: 'N', N: 'S', E: 'W', W: 'E' };
const DEG = Math.PI / 180;
const hexOf = (c: any, d: number) => (c === undefined || c === null ? d : typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export { featureLevel, offWallRect };

export function createFeatures(bctx) {
  const { THREE, ProceduralArchitecture, AssetFactory, registerTrackedWall, registerRoof, registerCeiling, group, std } = bctx;
  const box = (parent, w, h, d, x, y, z, mat, shadow = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  const fresh = (c: number, extra: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra });

  // ---- rails -------------------------------------------------------------------------------------------------------------
  // A rail along a to b (plan) standing on height y (absolute): the page's glass and spindle balustrades, or S2's metal and
  // timber rails. Returns a group positioned and turned, not yet placed.
  function railGroup(style: string, len: number, h: number, color?: any) {
    if (style === 'glass') return ProceduralArchitecture.createGlassBalustrade(len, h, 0);
    if (style === 'spindle' || style === 'colonial') return ProceduralArchitecture.createColonialBalustrade(len, h, 0);
    const g = group(`${style} rail (${+len.toFixed(2)}m)`, { category: 'Architecture' });
    if (style === 'parapet') {
      const m = std(hexOf(color, 0xe7e2d8), { roughness: 0.85 });
      box(g, len, h, 0.16, 0, h / 2, 0, m); box(g, len + 0.02, 0.04, 0.22, 0, h + 0.02, 0, std(0xf1eee8, { roughness: 0.7 }));
      return g;
    }
    const m = style === 'timber' ? std(hexOf(color, 0x6b5440), { roughness: 0.6 }) : std(hexOf(color, 0x1f2226), { roughness: 0.4, metalness: 0.6 });
    box(g, len, 0.05, 0.06, 0, h - 0.025, 0, m);
    if (style === 'timber') { box(g, len, 0.1, 0.03, 0, h * 0.55, 0, m); box(g, len, 0.1, 0.03, 0, 0.15, 0, m); }
    else { box(g, len, 0.03, 0.03, 0, 0.1, 0, m); const n = Math.max(2, Math.round(len / 0.12)); for (let i = 0; i <= n; i++) box(g, 0.018, h - 0.13, 0.018, -len / 2 + len * i / n, 0.1 + (h - 0.13) / 2, 0, m, false); }
    for (const sx of [-1, 1]) box(g, 0.05, h, 0.05, sx * (len / 2 - 0.025), h / 2, 0, m);
    return g;
  }
  function placeRail(put, style, a: number[], b: number[], y: number, h = 0.95, color?: any, role = 'structure') {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.15 || style === 'none') return null;
    const g = put(() => railGroup(style, len, h, color), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, y, null, role);
    g.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    return g;
  }

  // ---- partitions with a style ----------------------------------------------------------------------------------------------
  function partition({ spec, lv, p, index, y, H, interior, trimColor, put, am, kitb, defaults }) {
    const alongX = Math.abs(p.from[1] - p.to[1]) < 1e-6, len = Math.abs(alongX ? p.to[0] - p.from[0] : p.to[1] - p.from[1]);
    const cx = (p.from[0] + p.to[0]) / 2, cz = (p.from[1] + p.to[1]) / 2;
    const dir = alongX ? Math.sign(p.to[0] - p.from[0]) || 1 : -(Math.sign(p.to[1] - p.from[1]) || 1);
    const doors = [...(p.door != null ? [{ at: p.door, w: p.doorW || 0.9, h: 2.1 }] : []), ...(p.doors || []).map(d => ({ at: d.at, w: d.w || p.doorW || 0.9, h: d.h || 2.1 }))]
      .map(d => ({ x0: dir * (d.at - len / 2) - d.w / 2, x1: dir * (d.at - len / 2) + d.w / 2, h: d.h }));
    const top = p.height || (p.style === 'half' ? 1.1 : H - 0.06);
    const inDoor = (x: number, pad = 0.04) => doors.some(d => x > d.x0 - pad && x < d.x1 + pad);
    const wood = am.paint(hexOf(p.color, 0x8a6b4e), { roughness: 0.6 }), paint = am.paint(hexOf(p.color, interior), { roughness: 0.7 });
    let wall;
    if (p.style === 'half' || p.style === 'arch') {
      // a low wall with a timber cap, or a full wall whose doorways are round-headed archways
      const pp = kitb.partitionParams(p, { spec, defaults, lv, interior, trimColor });
      const archDoors = doors.map(d => ({ type: 'door', offset: (d.x0 + d.x1) / 2, width: Math.max(1.12, d.x1 - d.x0), height: p.style === 'arch' ? Math.min(top - 0.15, d.h + 0.1) : top, style: 'cased', open: true }));
      wall = put(() => {
        const g = ProceduralArchitecture.createParametricWall({ length: len, height: top, thickness: 0.14, wallColor: pp.wallColor, trimColor: pp.trimColor, baseboardColor: 0xe2e8f0, orientation: 'partition', openings: archDoors });
        if (p.style === 'half') {
          const capM = am.paint(0x6b5440, { roughness: 0.5 });
          const xs = [-len / 2, ...doors.flatMap(d => [d.x0, d.x1]), len / 2].sort((a, b) => a - b);
          for (let i = 0; i < xs.length - 1; i += 1) { const a = xs[i], b = xs[i + 1]; if (b - a > 0.05 && !inDoor((a + b) / 2, -0.01)) box(g.userData.fullGroup, b - a + 0.04, 0.045, 0.22, (a + b) / 2, top + 0.0225, 0, capM); }
        } else {
          // round heads: a spandrel either side of each archway's crown, in the wall's paint, on both faces
          for (const d of archDoors) {
            const w = d.width, spring = d.height - w / 2, hh = Math.min(w / 2, top - spring - 0.01);
            if (hh < 0.1) continue;
            // two corner pieces (one outline touching itself at the crown does not triangulate)
            const r = w / 2 - 0.05;
            const left = new THREE.Shape(); left.moveTo(-w / 2, spring); left.lineTo(-w / 2, spring + hh); left.lineTo(0, spring + hh); left.lineTo(0, spring + r); left.absarc(0, spring, r, Math.PI / 2, Math.PI, false); left.lineTo(-w / 2, spring);
            const right = new THREE.Shape(); right.moveTo(w / 2, spring); right.lineTo(w / 2 - 0.05, spring); right.absarc(0, spring, r, 0, Math.PI / 2, false); right.lineTo(0, spring + hh); right.lineTo(w / 2, spring + hh); right.lineTo(w / 2, spring);
            // `archRise`: the digest (shot-world.ts) boxes a mesh by its axis-aligned box, and a spandrel's spans the whole doorway from the springline up; the
            // solid is above the crown, `r` over the springline, so the digest's box starts that much higher and the doorway reads as open at the eye
            for (const sh of [left, right]) { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false, curveSegments: 16 }), paint); m.position.set(d.offset, 0, -0.08); m.castShadow = true; m.receiveShadow = true; m.userData.archRise = r; g.userData.fullGroup.add(m); }
          }
        }
        return g;
      }, cx, cz, y);
    } else {
      wall = put(() => {
        const g = group(`Partition (${p.style}, ${+len.toFixed(2)}m)`, { category: 'Architecture', isWall: true, partition: true });
        const full = new THREE.Group(); full.name = 'Full'; g.add(full);
        if (p.style === 'posts' || p.style === 'slats') {
          const step = p.style === 'posts' ? 0.6 : 0.12, sw = p.style === 'posts' ? 0.1 : 0.04, sd = p.style === 'posts' ? 0.1 : 0.08;
          for (let x = -len / 2 + sw / 2; x <= len / 2 - sw / 2 + 1e-6; x += step) if (!inDoor(x)) box(full, sw, top, sd, x, top / 2, 0, wood);
          box(full, len, 0.12, 0.12, 0, top - 0.06, 0, wood);   // the header
          if (p.style === 'posts') box(full, len, 0.05, 0.12, 0, 0.025, 0, wood);
        } else if (p.style === 'glass') {
          const frame = std(hexOf(p.color, 0x1f2226), { roughness: 0.4, metalness: 0.5 }), glass = bctx.glassMat();
          const xs = [-len / 2, ...doors.flatMap(d => [d.x0, d.x1]), len / 2].sort((a, b) => a - b);
          for (let i = 0; i < xs.length - 1; i++) {
            const a = xs[i], b = xs[i + 1], m = (a + b) / 2;
            if (b - a < 0.05) continue;
            if (inDoor(m, -0.01)) { const d = doors.find(q => m > q.x0 && m < q.x1); if (top - d.h > 0.1) { const gl = box(full, b - a, top - d.h, 0.012, m, (top + d.h) / 2, 0, glass, false); gl.userData.windowGlow = false; } continue; }
            box(full, b - a, top, 0.012, m, top / 2, 0, glass, false);
            const n = Math.max(1, Math.round((b - a) / 1.1));
            for (let k = 0; k <= n; k++) box(full, 0.04, top, 0.05, a + (b - a) * k / n, top / 2, 0, frame);
          }
          box(full, len, 0.05, 0.06, 0, 0.025, 0, frame); box(full, len, 0.05, 0.06, 0, top - 0.025, 0, frame);
          for (const d of doors) box(full, d.x1 - d.x0 + 0.08, 0.05, 0.06, (d.x0 + d.x1) / 2, d.h, 0, frame);
        } else if (p.style === 'bookcase') {
          // shelving both faces, 0.36 deep in all, round the doorways
          const carcass = am.paint(hexOf(p.color, 0xefe9df), { roughness: 0.6 }), r = mulberry32(fnv1a(`${spec.id}:${lv.id}:partition:${index}`));
          const xs = [-len / 2, ...doors.flatMap(d => [d.x0, d.x1]), len / 2].sort((a, b) => a - b);
          for (let i = 0; i < xs.length - 1; i++) {
            const a = xs[i], b = xs[i + 1], m = (a + b) / 2;
            if (b - a < 0.2) continue;
            if (inDoor(m, -0.01)) { const d = doors.find(q => m > q.x0 && m < q.x1); box(full, b - a, top - d.h, 0.36, m, (top + d.h) / 2, 0, carcass); continue; }
            shelving(full, { a, b, top, depth: 0.36, carcass, r, both: true });
          }
        }
        return g;
      }, cx, cz, y, null, null);
    }
    if (!alongX) wall.rotation.y = Math.PI / 2;
    registerTrackedWall(wall, 'partition', top, Math.min(0.85, top));
  }

  // shelving between a and b (along local x), `depth` deep centred on z 0 (both faces) or backed on z = −depth/2
  function shelving(parent, { a, b, top, depth, carcass, r, both = false, back = null }) {
    const len = b - a, bays = Math.max(1, Math.round(len / 0.85)), bw = len / bays;
    for (let i = 0; i <= bays; i++) box(parent, 0.025, top, depth, a + i * bw, top / 2, 0, carcass);
    const rows = Math.max(3, Math.round((top - 0.1) / 0.36));
    for (let k = 0; k <= rows; k++) box(parent, len, 0.025, depth, (a + b) / 2, 0.05 + (top - 0.1) * k / rows, 0, carcass, false);
    if (back) box(parent, len, top, 0.012, (a + b) / 2, top / 2, -depth / 2 + 0.006, back, false);
    const spines = [0x6b3e2e, 0x2f4858, 0x8c6a3e, 0x3d5a45, 0xb7a58a, 0x7a2f2f, 0x2b2b2b, 0xc9b99a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    for (const face of both ? [-1, 1] : [1]) for (let i = 0; i < bays; i++) for (let k = 0; k < rows; k++) {
      if (r() < 0.18) continue;
      let x = a + i * bw + 0.03, fill = 0.4 + r() * 0.5;
      const y0 = 0.05 + (top - 0.1) * k / rows + 0.0125, rowH = (top - 0.1) / rows - 0.04;
      while (x < a + i * bw + bw * fill) {
        const tw = 0.025 + r() * 0.03, th = rowH * (0.62 + r() * 0.3);
        box(parent, tw, th, depth * (both ? 0.4 : 0.7), x + tw / 2, y0 + th / 2, face * (both ? depth * 0.25 : 0.02), spines[Math.floor(r() * spines.length)], false);
        x += tw + 0.002;
      }
    }
  }

  // ---- per storey: bays (walls, floor, ceiling), balconies, terraces, loggias, fireplaces (the breast), built-ins ----
  function levelFeatures({ spec, lv, y, H, palette, kit, am, put, anchors, kitb, interior, wallColor, trimColor, defaults }) {
    const mine = (spec.features || []).map((f, i) => ({ f, i })).filter(({ f }) => f && f.type !== 'porch' && featureLevel(spec, f) === lv);
    for (const { f, i } of mine) {
      if (f.type === 'bay') bay({ spec, lv, f, i, y, H, am, put, anchors, kitb, kit, interior, wallColor, trimColor, defaults });
      else if (f.type === 'balcony' || f.type === 'terrace' || f.type === 'loggia') balcony({ spec, lv, f, i, y, H, am, put, anchors });
      else if (f.type === 'fireplace') hearth({ spec, lv, f, i, y, H, am, put, anchors, kitb, kit });
      else if (f.type === 'builtin') builtin({ spec, lv, f, i, y, H, am, put, anchors });
    }
  }

  function bay({ spec, lv, f, i, y, H, am, put, anchors, kitb, kit, interior, wallColor, trimColor, defaults }) {
    const half = f.w / 2, depth = f.depth, h = f.h ?? H - 0.3, sill = f.sill ?? 0.45, head = Math.min(f.head ?? h - 0.35, h - 0.15);
    const ow = offWallRect(lv, f.side, f.at - half, f.at + half, depth, true);
    if (!ow) return;
    const { line, horiz } = ow, n = OUT[f.side], nn = horiz ? n[1] : n[0];
    const canted = f.form === 'canted' && f.w - 2 * depth > 0.6;
    // points in (along, out) → world plan
    const P = (a: number, o: number) => (horiz ? [a, line + nn * o] : [line + nn * o, a]);
    const win = (w: number) => (w > 0.7 ? [{ type: 'window', offset: 0, width: Math.max(0.4, w - 0.35), height: head - sill, sillY: sill }] : []);
    const walls: Array<{ a: number[]; b: number[]; len: number; openings: any[] }> = [];
    const s0 = f.at - half, s1 = f.at + half;
    if (canted) {
      const f0 = s0 + depth, f1 = s1 - depth;
      walls.push({ a: P(s0, WALL_HALF), b: P(f0, depth), len: 0, openings: [] }, { a: P(f0, depth), b: P(f1, depth), len: 0, openings: [] }, { a: P(f1, depth), b: P(s1, WALL_HALF), len: 0, openings: [] });
    } else walls.push({ a: P(s0, 0), b: P(s0, depth), len: 0, openings: [] }, { a: P(s0, depth), b: P(s1, depth), len: 0, openings: [] }, { a: P(s1, depth), b: P(s1, 0), len: 0, openings: [] });
    for (const w of walls) { w.len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]); w.openings = win(w.len - (canted ? 0 : 0.1)); }
    const clad = kitb.wallCladding(kit, { spec, defaults, lv, edge: ow.edge });
    const lowestY = Math.min(...(spec.levels || []).map(l => l.y || 0));
    const skirt: string = f.skirt ?? ((lv.y || 0) <= lowestY + 0.05 ? 'grade' : 'oriel');
    for (const w of walls) {
      const mx = (w.a[0] + w.b[0]) / 2, mz = (w.a[1] + w.b[1]) / 2;
      // the wall's local +z must face out of the bay: its outward normal is the plan normal pointing away from the host
      const dx = (w.b[0] - w.a[0]) / w.len, dz = (w.b[1] - w.a[1]) / w.len;
      let ox = dz, oz = -dx;   // one normal of a → b
      const cxB = horiz ? f.at : line + nn * depth / 2, czB = horiz ? line + nn * depth / 2 : f.at;
      if ((mx - cxB) * ox + (mz - czB) * oz < 0) { ox = -ox; oz = -oz; }
      const g = put(() => ProceduralArchitecture.createParametricWall({
        length: w.len + 0.08, height: h, wallColor: interior, trimColor, baseboardColor: bctx.mix(interior, 0xffffff, 0.5),
        orientation: SIDE_ORI[f.side], openings: w.openings, cladding: clad, exteriorColor: wallColor, outerCorner: false,
      }), mx, mz, y);
      g.rotation.y = Math.atan2(ox, oz);
      registerTrackedWall(g, SIDE_ORI[f.side], h, 0.85);
    }
    // the floor (on a skirt down to grade) and the ceiling
    const outline = canted ? [P(s0, 0), P(s1, 0), P(s1, WALL_HALF), P(s1 - depth, depth), P(s0 + depth, depth), P(s0, WALL_HALF)] : [P(s0, 0), P(s1, 0), P(s1, depth), P(s0, depth)];
    const shape = new THREE.Shape(outline.map(p => new THREE.Vector2(p[0], p[1])));
    const floorMat = kit.floor(lv.floor || 'oak');
    put(() => {
      const g = group(`Bay floor (${lv.id} ${f.side} ${f.at})`, { category: 'Architecture' });
      const top = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMat); top.rotation.x = Math.PI / 2; top.position.y = 0.001; top.receiveShadow = true; top.material.side = THREE.DoubleSide; g.add(top);
      // under a bay: on the lowest storey a stone skirt down to grade; higher up (an oriel) a deep sill course in the wall's own
      // cladding — a pier to the ground under a bay over open air would be a column, and one over a lower bay would
      // fill its windows; `skirt: 'grade'` asks for the pier, `'none'` for the bare floor
      const skirtH = skirt === 'grade' ? (y > 0.05 ? y : 0.15) : skirt === 'oriel' ? 0.3 : 0;
      if (skirtH > 0) {
        const skMat = skirt === 'grade' ? am.cladding({ kind: (lv.plinth && lv.plinth.material) || 'stone', color: (lv.plinth && lv.plinth.color) || '#a39c90' }) : (clad && clad.isMaterial ? clad : am.cladding({ kind: 'stucco', color: '#' + wallColor.toString(16).padStart(6, '0') }));
        const sk = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: skirtH, bevelEnabled: false }), skMat);
        sk.rotation.x = Math.PI / 2; sk.position.y = -0.002; sk.castShadow = true; sk.receiveShadow = true; g.add(sk);
      }
      return g;
    }, 0, 0, y, null, 'floor');
    const ceil = put(() => {
      const g = group(`Bay ceiling (${lv.id} ${f.side} ${f.at})`, { category: 'Architecture' });
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), am.ceiling('flat', '#f1f5f9')); m.rotation.x = Math.PI / 2; g.add(m);
      return g;
    }, 0, 0, y + h - 0.02, null, null);
    if (typeof registerCeiling === 'function') registerCeiling(ceil, y + h - 0.02);
    anchors.arch.features.push({ type: 'bay', level: lv.id, side: f.side, at: f.at, w: f.w, depth, form: canted ? 'canted' : 'box', skirt, outline: outline.map(p => [r3(p[0]), r3(p[1])]), y: r3(y), h: r3(h), roof: f.roof || 'hip', roofColor: f.roofColor || undefined });
  }

  function balcony({ spec, lv, f, i, y, H, am, put, anchors }) {
    const style = f.rail ?? (f.type === 'terrace' ? 'glass' : 'glass');
    let R, open: Array<[number[], number[]]> = [];
    const fp = lv.footprint || [];
    const againstStorey = (x, z) => fp.some(r => inR(x, z, r, 0.02));
    if (f.rect) {
      R = f.rect;
      // rails on every edge not against this storey's walls
      for (const [a, b] of [[[R.x, R.z], [R.x + R.w, R.z]], [[R.x + R.w, R.z], [R.x + R.w, R.z + R.d]], [[R.x + R.w, R.z + R.d], [R.x, R.z + R.d]], [[R.x, R.z + R.d], [R.x, R.z]]] as Array<[number[], number[]]>) {
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], nx = b[1] - a[1], nz = -(b[0] - a[0]), l = Math.hypot(nx, nz);
        const out = [m[0] + nx / l * 0.12, m[1] + nz / l * 0.12], inn = [m[0] - nx / l * 0.12, m[1] - nz / l * 0.12];
        if (!againstStorey(out[0], out[1]) && !againstStorey(inn[0], inn[1]) || (!againstStorey(out[0], out[1]) && againstStorey(inn[0], inn[1]) && f.type !== 'loggia')) open.push([a, b]);
        else if (f.type === 'loggia' && !againstStorey(out[0], out[1]) && !againstStorey(inn[0], inn[1])) open.push([a, b]);
      }
    } else {
      const edges = perimeterEdges(fp), e0 = edgeFor(edges, { side: f.side, at: f.from !== undefined && f.to !== undefined ? (f.from + f.to) / 2 : 0 }) || edges.find(e => e.side === f.side);
      if (!e0) return;
      const horiz = f.side === 'S' || f.side === 'N';
      const a0 = f.from ?? (horiz ? e0.a[0] : e0.a[1]), a1 = f.to ?? (horiz ? e0.b[0] : e0.b[1]);
      const ow = offWallRect(lv, f.side, a0, a1, f.depth || 1.2);
      if (!ow) return;
      R = ow.rect;
      const n = OUT[f.side], outer = (horiz ? ow.line + n[1] * (WALL_HALF + (f.depth || 1.2)) : ow.line + n[0] * (WALL_HALF + (f.depth || 1.2))), inner = horiz ? ow.line + n[1] * WALL_HALF : ow.line + n[0] * WALL_HALF;
      open = horiz ? [[[a0, outer], [a1, outer]], [[a0, inner], [a0, outer]], [[a1, inner], [a1, outer]]] : [[[outer, a0], [outer, a1]], [[inner, a0], [outer, a0]], [[inner, a1], [outer, a1]]];
    }
    // the deck: a balcony's slab out of the wall, a terrace's boards over the roof under it, a loggia's floor
    let deckY = y;
    if (f.type === 'terrace') { const top = roofTopAt(planRoofModels(spec), R.x + R.w / 2, R.z + R.d / 2); if (top !== null) deckY = Math.max(y, top + 0.03); }
    const deckMat = f.type === 'terrace' ? fresh(hexOf(f.floorColor, 0x8a735c), { roughness: 0.8 }) : am.floor({ kind: 'deck', ...(f.floorColor ? { color: f.floorColor } : {}) });
    const slabMat = f.type === 'terrace' ? fresh(0xd9d4cb, { roughness: 0.8 }) : am.paint(0xe3ded5, { roughness: 0.8 });
    // a terrace's boards on the roof; a loggia near grade stands on a plinth to the ground; a balcony's slab
    const T = f.type === 'terrace' ? 0.06 : f.type === 'loggia' && y < 1.2 ? Math.max(0.05, y + 0.01) : y > 0.05 ? 0.2 : Math.max(0.05, y + 0.02);
    const deck = put(() => {
      const g = group(`${f.type} deck (${lv.id})`, { category: 'Architecture', ...(f.type === 'terrace' ? { isRoof: true } : {}) });
      box(g, R.w, T - 0.03, R.d, R.x + R.w / 2, -(T - 0.03) / 2 - 0.03, R.z + R.d / 2, slabMat);
      const top = box(g, R.w, 0.03, R.d, R.x + R.w / 2, -0.015, R.z + R.d / 2, deckMat); top.castShadow = false;
      return g;
    }, 0, 0, deckY, null, f.type === 'terrace' ? null : 'structure');
    const railRole = f.type === 'terrace' ? null : 'structure';
    const rails = [];
    for (const [a, b] of open) { const g = placeRail(put, style, a, b, deckY, style === 'parapet' ? 1.0 : 0.98, f.railColor, railRole); if (g) rails.push(g); }
    if (f.type === 'terrace') for (const g of [deck, ...rails]) { g.userData.isRoof = true; registerRoof(g); }
    if (f.type === 'loggia' && f.posts) {
      const post = am.paint(0xf2efe9, { roughness: 0.6 }), under = (spec.levels || []).filter(o => (o.y || 0) > y + 0.5 && (o.footprint || []).some(r => inR(R.x + R.w / 2, R.z + R.d / 2, r, 0.01))).sort((p, q) => (p.y || 0) - (q.y || 0))[0];
      const ph = (under ? (under.y || 0) - 0.19 : y + H) - y;
      for (const [a, b] of open) for (let k = 0; k <= f.posts; k++) {
        const t = f.posts ? k / f.posts : 0, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const g = put(() => { const gg = group('Loggia post', { category: 'Architecture' }); box(gg, 0.2, ph, 0.2, 0, ph / 2, 0, post); return gg; }, x, z, y, null, 'structure');
      }
    }
    anchors.arch.features.push({ type: f.type, level: lv.id, side: f.side, rect: { x: r3(R.x), z: r3(R.z), w: r3(R.w), d: r3(R.d) }, y: r3(deckY), rail: style, rails: open.map(([a, b]) => [a.map(r3), b.map(r3)]), posts: f.type === 'loggia' && f.posts ? f.posts : undefined });
  }

  // ---- fireplaces: the breast and hearth in the room (the stack is built with the roofs: houseFeatures) --------------------
  function fireplaceFrame(spec: any, lv: any, at: number[], rot: number) {
    const fwd = [Math.sin(rot * DEG), Math.cos(rot * DEG)];
    const edges = perimeterEdges(lv.footprint || []);
    // the wall behind: a perimeter edge or a partition within 0.7 m of the hearth's back, across its heading
    let best = null;
    for (const e of edges) {
      const horiz = e.side === 'S' || e.side === 'N', n = OUT[e.side];
      if (Math.abs(n[0] + fwd[0]) + Math.abs(n[1] + fwd[1]) > 0.2) continue;   // the wall's outside must be behind the hearth
      const line = horiz ? e.a[1] : e.a[0], d = horiz ? (at[1] - line) * -n[1] : (at[0] - line) * -n[0];
      const a = horiz ? at[0] : at[1], inSpan = a > (horiz ? e.a[0] : e.a[1]) - 0.1 && a < (horiz ? e.b[0] : e.b[1]) + 0.1;
      if (inSpan && d > 0 && d < 0.8 && (!best || d < best.d)) best = { d, line, exterior: true, side: e.side, half: WALL_HALF, edge: e };
    }
    for (const p of lv.partitions || []) {
      const alongX = Math.abs(p.from[1] - p.to[1]) < 1e-6;
      if (alongX ? Math.abs(fwd[0]) > 0.2 : Math.abs(fwd[1]) > 0.2) continue;
      const line = alongX ? p.from[1] : p.from[0], d = alongX ? (at[1] - line) * Math.sign(fwd[1]) : (at[0] - line) * Math.sign(fwd[0]);
      const a = alongX ? at[0] : at[1], lo = Math.min(alongX ? p.from[0] : p.from[1], alongX ? p.to[0] : p.to[1]), hi = Math.max(alongX ? p.from[0] : p.from[1], alongX ? p.to[0] : p.to[1]);
      if (a > lo - 0.1 && a < hi + 0.1 && d > 0 && d < 0.8 && (!best || d < best.d)) best = { d, line, exterior: false, half: 0.07 };
    }
    return { fwd, wall: best };
  }
  function hearth({ spec, lv, f, i, y, H, am, put, anchors, kitb, kit }) {
    if (!Array.isArray(f.at)) return;
    const rot = f.rot || 0, { fwd, wall } = fireplaceFrame(spec, lv, f.at, rot);
    const w = f.w || 1.8, style = f.style || 'mantel', dep = 0.42;
    // the breast stands on the wall's face (or, free-standing, behind the hearth's point)
    const back = wall ? wall.d - wall.half : 0.2;   // how far behind `at` the wall face is
    const bx = f.at[0] - fwd[0] * back, bz = f.at[1] - fwd[1] * back;
    const above = (spec.levels || []).filter(o => (o.y || 0) > y + 0.5 && (o.footprint || []).some(r => inR(bx, bz, r, 0.05))).sort((p, q) => (p.y || 0) - (q.y || 0))[0];
    const ceil = (above ? (above.y || 0) - 0.185 : y + H - 0.02) - y - 0.005;
    const g = put(() => {
      const gg = group(`Fireplace (${style}, ${lv.id})`, { category: 'Architecture' });
      const breastMat = style === 'stone' ? am.cladding({ kind: 'stone', color: f.color || '#b3aca1' }) : style === 'painted-brick' ? am.wall('painted-brick', f.color || '#efece6') : am.wall('plaster', f.color || lv.interior || '#efeae2');
      // breast, in its own frame: local +z into the room, its back on the wall face at z 0
      box(gg, w, ceil, dep, 0, ceil / 2, dep / 2, breastMat);
      const fbW = Math.min(w - 0.5, 0.95), fbH = 0.7;
      const soot = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.95 });
      box(gg, fbW, fbH, 0.02, 0, 0.2 + fbH / 2, dep + 0.002, soot, false);
      const glowM = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 2.2 });
      box(gg, fbW * 0.7, 0.05, 0.03, 0, 0.26, dep + 0.012, glowM, false);
      box(gg, w + 0.3, 0.1, 0.55, 0, 0.05, dep + 0.2, am.cladding({ kind: 'stone', color: '#8f8a82' }));   // the hearth slab
      if (style === 'mantel' || style === 'painted-brick') { const mm = am.paint(hexOf(f.color && style === 'mantel' ? f.color : null, 0x5b4636), { roughness: 0.5 }); box(gg, w - 0.1, 0.08, 0.22, 0, 1.28, dep + 0.08, mm); box(gg, 0.12, 1.1, 0.06, -fbW / 2 - 0.12, 0.75, dep + 0.03, mm); box(gg, 0.12, 1.1, 0.06, fbW / 2 + 0.12, 0.75, dep + 0.03, mm); }
      if (style === 'tv-breast') { const tv = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.25, metalness: 0.4 }); box(gg, 1.4, 0.8, 0.04, 0, 1.75, dep + 0.02, tv); }
      if (style === 'modern') { const frame = std(0x16191d, { roughness: 0.4, metalness: 0.6 }); box(gg, fbW + 0.3, fbH + 0.2, 0.04, 0, 0.2 + fbH / 2, dep + 0.02, frame); }
      return gg;
    }, bx, bz, y, null, 'structure');
    g.rotation.y = Math.atan2(fwd[0], fwd[1]);
    // a routing solid: the walk goes round the breast
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    (anchors.solids[lv.id] ||= []).push({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z, top: bb.max.y, type: 'fireplace-breast' });
    anchors.arch.features.push({ type: 'fireplace', level: lv.id, at: f.at, rot, style, w, back: [r3(bx), r3(bz)], wall: wall ? (wall.exterior ? `exterior ${wall.side}` : 'partition') : 'none' });
  }

  // ---- built-ins -------------------------------------------------------------------------------------------------------
  function builtin({ spec, lv, f, i, y, H, am, put, anchors }) {
    if (!Array.isArray(f.from) || !Array.isArray(f.to)) return;
    const dx = f.to[0] - f.from[0], dz = f.to[1] - f.from[1], len = Math.hypot(dx, dz);
    if (len < 0.3) return;
    const d = [dx / len, dz / len], left = [d[1], -d[0]], faceV = f.face === 'right' ? [-left[0], -left[1]] : left;
    // the line is a wall's centre line when it lies on one: stand off its face
    const edges = perimeterEdges(lv.footprint || []);
    const onEdge = edges.some(e => (Math.abs(e.a[1] - f.from[1]) < 0.05 && Math.abs(e.b[1] - e.a[1]) < 1e-6 && Math.abs(dz) < 1e-6) || (Math.abs(e.a[0] - f.from[0]) < 0.05 && Math.abs(e.b[0] - e.a[0]) < 1e-6 && Math.abs(dx) < 1e-6));
    const onPart = (lv.partitions || []).some(p => (Math.abs(p.from[1] - p.to[1]) < 1e-6 && Math.abs(dz) < 1e-6 && Math.abs(p.from[1] - f.from[1]) < 0.05) || (Math.abs(p.from[0] - p.to[0]) < 1e-6 && Math.abs(dx) < 1e-6 && Math.abs(p.from[0] - f.from[0]) < 0.05));
    const off = onEdge ? WALL_HALF : onPart ? 0.07 : 0;
    const kind = f.kind, depth = f.d ?? (kind === 'window-seat' ? 0.55 : kind === 'media-wall' ? 0.45 : kind === 'niche' ? 0.25 : 0.38);
    const top = f.h ?? (kind === 'window-seat' ? 0.45 : kind === 'media-wall' ? 2.2 : kind === 'niche' ? 1.9 : H - 0.2);
    const cx = (f.from[0] + f.to[0]) / 2 + faceV[0] * (off + depth / 2), cz = (f.from[1] + f.to[1]) / 2 + faceV[1] * (off + depth / 2);
    const carcass = am.paint(hexOf(f.color, 0xefe9df), { roughness: 0.6 }), r = mulberry32(fnv1a(`${spec.id}:${lv.id}:builtin:${i}`));
    const g = put(() => {
      // local frame: +x along from → to, +z out of the wall into the room, the unit's back at z = −depth/2
      const gg = group(`Built-in ${kind} (${lv.id})`, { category: 'Furniture' });
      const a = -len / 2, b = len / 2;
      if (kind === 'bookcase-wall') shelving(gg, { a, b, top, depth, carcass, r, back: carcass });
      else if (kind === 'niche') {
        box(gg, len, top, 0.05, 0, top / 2, -depth / 2 + 0.025, am.paint(0x6b5a4a, { roughness: 0.8 }));
        for (const x of [a + 0.04, b - 0.04]) box(gg, 0.08, top, depth, x, top / 2, 0, carcass);
        box(gg, len, 0.08, depth, 0, top - 0.04, 0, carcass); box(gg, len, 0.08, depth, 0, 0.04, 0, carcass);
        for (let k = 1; k < 4; k++) box(gg, len - 0.16, 0.03, depth - 0.05, 0, top * k / 4, 0.02, carcass, false);
      } else if (kind === 'wine-wall') {
        const cell = 0.25, nx = Math.max(1, Math.floor(len / cell)), ny = Math.max(1, Math.floor(top / cell)), wood = am.paint(hexOf(f.color, 0x4a3426), { roughness: 0.6 });
        for (let ix = 0; ix <= nx; ix++) box(gg, 0.02, top, depth, a + (len * ix) / nx, top / 2, 0, wood);
        for (let iy = 0; iy <= ny; iy++) box(gg, len, 0.02, depth, 0, top * iy / ny, 0, wood, false);
        const glassB = new THREE.MeshStandardMaterial({ color: 0x1e3b2a, roughness: 0.2, metalness: 0.2 });
        for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) if (r() < 0.7) { const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, depth * 0.8, 8), glassB); bt.rotation.x = Math.PI / 2; bt.position.set(a + len * (ix + 0.5) / nx, top * (iy + 0.3) / ny, 0.02); gg.add(bt); }
      } else if (kind === 'window-seat') {
        const cush = am.paint(hexOf(f.color, 0x9a8f80), { roughness: 0.95 });
        const cup = len > 2.2 ? 0.55 : 0;
        box(gg, len - 2 * cup, top, depth, 0, top / 2, 0, carcass); box(gg, len - 2 * cup - 0.04, 0.1, depth - 0.04, 0, top + 0.05, 0.01, cush);
        if (cup) for (const x of [a + cup / 2, b - cup / 2]) box(gg, cup, 1.0, depth, x, 0.5, 0, carcass);
      } else {   // media-wall
        const low = am.paint(hexOf(f.color, 0x3d3a36), { roughness: 0.6 }), tall = Math.min(0.6, len * 0.18);
        box(gg, len - 2 * tall, 0.5, depth, 0, 0.25, 0, low);
        for (const x of [a + tall / 2, b - tall / 2]) shelving(gg, { a: x - tall / 2, b: x + tall / 2, top, depth: 0.35, carcass: low, r, back: low });
        const tv = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.25, metalness: 0.4 });
        box(gg, Math.min(1.6, len - 2 * tall - 0.3), 0.9, 0.04, 0, 1.35, -depth / 2 + 0.05, tv);
      }
      return gg;
    }, cx, cz, y, null, 'item');
    g.rotation.y = Math.atan2(faceV[0], faceV[1]);
    g.userData.itemType = `builtin-${kind}`;
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    if (bb.max.y > y + 1.1) (anchors.solids[lv.id] ||= []).push({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z, top: bb.max.y, type: `builtin-${kind}` });
    anchors.arch.features.push({ type: 'builtin', level: lv.id, kind, from: f.from, to: f.to, face: f.face || 'left', h: r3(top), d: r3(depth) });
  }

  // ---- with the roofs: porches, bay roofs, chimney stacks -----------------------------------------------------------------
  function houseFeatures({ spec, kit, palette, put, anchors }) {
    const feats = (spec.features || []).map((f, i) => ({ f, i })).filter(({ f }) => f);
    const stacks = [];
    for (const { f, i } of feats) {
      if (f.type === 'porch') porch({ spec, f, i, kit, palette, put, anchors });
      else if (f.type === 'bay' && f.roof !== 'none') bayRoof({ spec, f, i, kit, palette, put });
      else if (f.type === 'fireplace' && f.chimney !== false && Array.isArray(f.at)) stacks.push({ lv: featureLevel(spec, f), at: f.at, rot: f.rot || 0, c: typeof f.chimney === 'object' ? f.chimney : {}, stack: f.stack, w: f.w || 1.8 });
    }
    // a fireplace room item with `chimney` (true or a chimney object) raises its stack too
    for (const lv of spec.levels || []) for (const room of lv.rooms || []) for (const it of room.items || []) if (it.type === 'fireplace' && it.chimney && Array.isArray(it.at)) stacks.push({ lv, at: it.at, rot: it.rot || 0, c: typeof it.chimney === 'object' ? it.chimney : {}, stack: undefined, w: 1.6, item: true });
    if (stacks.length) { const models = planRoofModels(spec); for (const s of stacks) chimneyStack({ spec, s, models, palette, put, anchors, kit }); }
  }

  // roofs.ts on a one-roof spec: the feature's plan as the storey it caps, the house's storeys beside it (so a side
  // against the house abuts), nothing else
  function featureRoof({ spec, id, rect, eave, roof, kit, palette, put, name }) {
    const synth = { id: `${spec.id}:${id}`, defaults: spec.defaults, entry: spec.entry, site: [], features: [], levels: [{ id: `__${id}`, y: 0, height: eave, footprint: [rect] }, ...(spec.levels || [])], roofs: [roof] };
    for (const r of buildRoofs(synth, { THREE, kit, palette })) {
      r.group.name = `${name} · ${r.group.name}`;
      const o = put(() => r.group, r.x, r.z, r.y);
      registerRoof(o);
    }
  }

  function porch({ spec, f, i, kit, palette, put, anchors }) {
    const plan = porchPlan(spec, f);
    if (!plan) return;
    const { lv, a0, a1, depth, horiz, nn, line, floorY, roofType, stepsOn, stepAt, stepW, size, posts, eave, pitch, beamH, postTop } = plan;
    const ow = plan.ow, owR = offWallRect(lv, f.side, a0, a1, depth, true);
    const R = ow.rect;
    const deckMat = kit.floor('deck', f.floorColor ? { color: hexOf(f.floorColor, 0) } : {});
    const skirtMat = std(0xd8d2c7, { roughness: 0.85 });
    const trim = hexOf(palette.trim, 0x2b2f33);
    const postCol = hexOf(f.posts && f.posts.color, 0xf2efe9), postMat = std(postCol, { roughness: 0.55 });
    const frontLine = line + nn * (WALL_HALF + depth);
    const W = (a: number, o: number) => (horiz ? [a, o] : [o, a]);   // (along, across) → plan
    const g = put(() => {
      const gg = group(`Porch (${lv.id} ${f.side} ${a0}–${a1})`, { category: 'Architecture' });
      // the deck on its skirt
      const skirtH = Math.max(0.02, floorY - 0.04);
      box(gg, R.w, skirtH, R.d, R.x + R.w / 2, skirtH / 2, R.z + R.d / 2, skirtMat);
      const top = box(gg, R.w + 0.04, 0.04, R.d + 0.02, R.x + R.w / 2, floorY - 0.02, R.z + R.d / 2 + (horiz ? nn * 0.01 : 0), deckMat); top.castShadow = false;
      // posts and the header
      if (roofType !== 'none') {
        const style = (f.posts && f.posts.style) || 'square';
        for (const p of posts) {
          const [px, pz] = W(p, frontLine - nn * (size / 2 + 0.06)), ph = postTop - floorY;
          if (style === 'round' || style === 'turned') {
            const c = new THREE.Mesh(new THREE.CylinderGeometry(size / 2 * 0.85, size / 2, ph, 16), postMat); c.position.set(px, floorY + ph / 2, pz); c.castShadow = true; gg.add(c);
            box(gg, size * 1.3, 0.08, size * 1.3, px, floorY + 0.04, pz, postMat); box(gg, size * 1.3, 0.08, size * 1.3, px, postTop - 0.04, pz, postMat);
          } else if (style === 'tapered') {
            box(gg, size * 1.6, 0.9, size * 1.6, px, floorY + 0.45, pz, std(0x9d968b, { roughness: 0.9 }));
            const c = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.45, size * 0.75, ph - 0.9, 4), postMat); c.rotation.y = Math.PI / 4; c.position.set(px, floorY + 0.9 + (ph - 0.9) / 2, pz); c.castShadow = true; gg.add(c);
          } else box(gg, size, ph, size, px, floorY + ph / 2, pz, style === 'steel' ? std(hexOf(f.posts && f.posts.color, 0x1f2226), { roughness: 0.4, metalness: 0.6 }) : postMat);
        }
        const [hx, hz] = W((a0 + a1) / 2, frontLine - nn * (size / 2 + 0.06));
        box(gg, horiz ? a1 - a0 : 0.18, beamH, horiz ? 0.18 : a1 - a0, hx, postTop + beamH / 2, hz, std(hexOf(f.posts && f.posts.color, 0xf2efe9), { roughness: 0.6 }));
        for (const a of [a0 + 0.09, a1 - 0.09]) { const [bx, bz] = W(a, (line + nn * WALL_HALF + frontLine) / 2); box(gg, horiz ? 0.18 : depth, beamH * 0.8, horiz ? depth : 0.18, bx, postTop + beamH * 0.4, bz, std(hexOf(f.posts && f.posts.color, 0xf2efe9), { roughness: 0.6 })); }
      }
      // steps to grade
      if (stepsOn) {
        const nSteps = Math.max(1, Math.round(floorY / 0.17)), rise = floorY / (nSteps + 0), run = 0.3;
        for (let k = 1; k < nSteps + 1; k++) {
          const hh = floorY - rise * k; if (hh < 0.02) break;
          const [sx, sz] = W(stepAt, frontLine + nn * (run * (k - 0.5)));
          box(gg, horiz ? stepW : run, hh, horiz ? run : stepW, sx, hh / 2, sz, skirtMat);
          const tr = box(gg, horiz ? stepW + 0.02 : run + 0.02, 0.03, horiz ? run + 0.02 : stepW + 0.02, sx, hh - 0.015 + 0.03, sz, deckMat); tr.castShadow = false;
        }
      }
      return gg;
    }, 0, 0, 0, null, 'structure');
    // rails
    const railStyle = f.rail === false ? 'none' : typeof f.rail === 'object' ? (f.rail.style || 'spindle') : f.rail === true || floorY > 0.45 ? 'spindle' : 'none';
    if (railStyle !== 'none') {
      const rh = (typeof f.rail === 'object' && f.rail.h) || 0.9, rc = typeof f.rail === 'object' ? f.rail.color : undefined;
      const along = [a0 + 0.1, ...posts, a1 - 0.1].sort((p, q) => p - q);
      const fl = frontLine - nn * (size / 2 + 0.06);
      for (let k = 0; k < along.length - 1; k++) {
        let p = along[k] + size / 2, q = along[k + 1] - size / 2;
        if (stepsOn && p < stepAt + stepW / 2 && q > stepAt - stepW / 2) { if (stepAt - stepW / 2 - p > 0.2) placeRail(put, railStyle, W(p, fl), W(stepAt - stepW / 2, fl), floorY, rh, rc); if (q - (stepAt + stepW / 2) > 0.2) placeRail(put, railStyle, W(stepAt + stepW / 2, fl), W(q, fl), floorY, rh, rc); continue; }
        if (q - p > 0.2) placeRail(put, railStyle, W(p, fl), W(q, fl), floorY, rh, rc);
      }
      for (const a of [a0 + 0.1, a1 - 0.1]) placeRail(put, railStyle, W(a, line + nn * (WALL_HALF + 0.05)), W(a, fl - nn * size / 2), floorY, rh, rc);
    }
    // the roof
    let roofOver = null;
    if (roofType !== 'none' && owR) {
      const oh = 0.28, Rr = owR.rect, wallSide = OPP[f.side];
      const over = { x: Rr.x - (horiz ? oh : (nn > 0 ? 0 : oh)), z: Rr.z - (horiz ? (nn > 0 ? 0 : oh) : oh), w: Rr.w + (horiz ? 2 * oh : oh), d: Rr.d + (horiz ? oh : 2 * oh) };
      roofOver = { x: r3(over.x), z: r3(over.z), w: r3(over.w), d: r3(over.d) };
      const roof: any = { over, y: eave, overhang: oh, pitch, color: f.roofColor || palette.roof, gableWindow: false, ends: { [wallSide]: 'abut' } };
      if (f.finish) roof.finish = f.finish;
      if (f.ceiling) roof.soffit = f.ceiling;
      if (roofType === 'flat') Object.assign(roof, { type: 'flat', parapet: 0 });
      else if (roofType === 'hip') roof.type = 'hip';
      else if (roofType === 'gable') Object.assign(roof, { type: 'gable', ridge: horiz ? 'z' : 'x' });
      else Object.assign(roof, { type: 'shed', high: wallSide });
      featureRoof({ spec, id: `porch${i}`, rect: Rr, eave, roof, kit, palette, put, name: `Porch roof (${f.side})` });
    }
    anchors.arch.features.push({ type: 'porch', level: lv.id, side: f.side, rect: { x: r3(R.x), z: r3(R.z), w: r3(R.w), d: r3(R.d) }, floorY: r3(floorY), posts: posts.map(p => W(p, frontLine - nn * (size / 2 + 0.06)).map(r3)), postSize: r3(size),
      roof: roofType, eave: r3(eave), pitch: roofType === 'flat' ? 0 : r3(pitch), roofOver, roofColor: f.roofColor || palette.roof, rail: railStyle === 'none' ? null : railStyle, steps: stepsOn ? { at: r3(stepAt), w: stepW, n: Math.max(1, Math.round(floorY / 0.17)), run: 0.3 } : null });
  }

  function bayRoof({ spec, f, i, kit, palette, put }) {
    const lv = featureLevel(spec, f), y = lv.y || 0, H = lv.height || 2.8, h = f.h ?? H - 0.3;
    const ow = offWallRect(lv, f.side, f.at - f.w / 2, f.at + f.w / 2, f.depth, true);
    if (!ow) return;
    const R = ow.rect, horiz = ow.horiz, nn = horiz ? OUT[f.side][1] : OUT[f.side][0], oh = 0.2, wallSide = OPP[f.side];
    const over = { x: R.x - (horiz ? oh : (nn > 0 ? 0 : oh)), z: R.z - (horiz ? (nn > 0 ? 0 : oh) : oh), w: R.w + (horiz ? 2 * oh : oh), d: R.d + (horiz ? oh : 2 * oh) };
    const type = f.roof || 'hip';
    const roof: any = { over, y: y + h, overhang: oh, pitch: type === 'shed' ? 18 : 24, color: f.roofColor || palette.roof, gableWindow: false, ends: { [wallSide]: 'abut' } };
    if (type === 'flat') Object.assign(roof, { type: 'flat', parapet: 0 });
    else if (type === 'shed') Object.assign(roof, { type: 'shed', high: wallSide });
    else if (type === 'gable') Object.assign(roof, { type: 'gable', ridge: horiz ? 'z' : 'x' });
    else roof.type = 'hip';
    featureRoof({ spec, id: `bay${i}`, rect: R, eave: y + h, roof, kit, palette, put, name: `Bay roof (${f.side} ${f.at})` });
  }

  // ---- a chimney stack for a hearth: outside an exterior wall (shouldered, from grade) or up through the storeys,
  // always out through the roof over it; the part above the eave fades with the roofs
  function chimneyStack({ spec, s, models, palette, put, anchors, kit }) {
    const { lv, at, rot, c } = s, y = lv.y || 0, H = lv.height || 2.8;
    const { fwd, wall } = fireplaceFrame(spec, lv, at, rot);
    const outside = wall && wall.exterior && s.stack !== 'inside';
    const am = createArchMaterials(THREE, kit);
    const brick = () => { const mt = kit && kit.textures && kit.textures.set('brick', { color: hexOf(c.color, 0x8a4a38) }); if (!mt) return fresh(hexOf(c.color, 0x8a4a38), { roughness: 0.9 }); const m = new THREE.MeshStandardMaterial({ map: mt.map, normalMap: mt.normalMap, roughnessMap: mt.roughnessMap, roughness: 1 }); return worldMapped(m, mt); };
    // a fresh material per part: the part above the eave is registered as a roof, and the fade writes to its materials
    const matFor = () => c.material === 'stone' ? am.own(am.cladding({ kind: 'stone', color: c.color || '#a39d92' })) : c.material === 'stucco' ? am.own(am.cladding({ kind: 'stucco', color: c.color || palette.wall || '#e7e2d8' })) : brick();
    // plan: outside — against the wall's outer face, centred on the hearth; inside — behind the hearth, in the breast
    // `w` is the stack's width along its wall, `d` its depth out of it: on a S or N wall that is x then z, on an E or W wall z then x
    const sw = c.w ?? (outside ? 0.9 : 0.75), sd = c.d ?? 0.6;
    const alongX = outside ? (wall.side === 'S' || wall.side === 'N') : Math.abs(fwd[1]) >= Math.abs(fwd[0]);   // (inside: across the hearth's heading)
    const ex = (a: number, o: number) => (alongX ? a : o), ez = (a: number, o: number) => (alongX ? o : a);   // (along, out) sizes → plan x, z
    let cx, cz;
    if (outside) { const n = OUT[wall.side]; cx = at[0] - fwd[0] * wall.d + n[0] * (WALL_HALF + sd / 2); cz = at[1] - fwd[1] * wall.d + n[1] * (WALL_HALF + sd / 2); if (alongX) cx = at[0]; else cz = at[1]; }
    else { cx = at[0] - fwd[0] * ((wall ? wall.d - wall.half : 0.2) - 0.25); cz = at[1] - fwd[1] * ((wall ? wall.d - wall.half : 0.2) - 0.25); }
    const hx = ex(sw, sd) / 2, hz = ez(sw, sd) / 2;
    const pts = [[cx - hx, cz - hz], [cx + hx, cz - hz], [cx - hx, cz + hz], [cx + hx, cz + hz], [cx, cz]];
    const tops = pts.map(([x, z]) => roofTopAt(models, x, z)).filter(v => v !== null);
    const topStorey = (spec.levels || []).reduce((m2, l) => (l.footprint || []).some(r => inR(cx, cz, r, outside ? 0.9 : 0.05)) ? Math.max(m2, (l.y || 0) + (l.height || 2.8)) : m2, y + H);
    const roofHi = tops.length ? Math.max(...tops) : topStorey + 0.25;
    const topY = roofHi + (c.h ?? 0.9);
    const eaveY = tops.length ? Math.min(...pts.map(([x, z]) => roofUnderAt(models, x, z)).filter(v => v !== null)) : topStorey;
    const matOf = () => c.material === 'metal' ? std(hexOf(c.color, 0x9aa1a8), { roughness: 0.35, metalness: 0.8 }) : matFor();
    const base = outside ? 0 : y + H - 0.02;
    const split = Math.max(base + 0.1, Math.min(topY - 0.4, eaveY - 0.05));
    const build = (y0: number, y1: number, name: string, withCap: boolean) => {
      const gg = group(name, { category: 'Architecture' }), mat = matOf();
      if (c.material === 'metal') { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, y1 - y0, 16), mat); p.position.set(cx, (y0 + y1) / 2, cz); p.castShadow = true; gg.add(p); if (withCap) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 16), mat); cone.position.set(cx, y1 + 0.07, cz); gg.add(cone); } return gg; }
      if (outside && y0 < topStorey - 0.6 && y1 > topStorey - 0.6) {
        // a shouldered stack: wide below the top storey's head, the flue above
        const sh = topStorey - 0.6, wide = sw + 0.4;
        box(gg, ex(wide, sd + 0.1), sh - y0, ez(wide, sd + 0.1), cx, (y0 + sh) / 2, cz, mat); box(gg, ex(sw, sd), y1 - sh, ez(sw, sd), cx, (sh + y1) / 2, cz, mat);
      } else { const wide = outside && y1 < topStorey - 0.6; box(gg, ex(wide ? sw + 0.4 : sw, wide ? sd + 0.1 : sd), y1 - y0, ez(wide ? sw + 0.4 : sw, wide ? sd + 0.1 : sd), cx, (y0 + y1) / 2, cz, mat); }
      if (withCap) {
        box(gg, ex(sw + 0.06, sd + 0.06), 0.15, ez(sw + 0.06, sd + 0.06), cx, y1 - 0.2, cz, mat);
        if (c.cap === 'metal') { const cm = std(0x3a3d40, { roughness: 0.4, metalness: 0.7 }); box(gg, ex(sw + 0.14, sd + 0.14), 0.04, ez(sw + 0.14, sd + 0.14), cx, y1 + 0.24, cz, cm); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(gg, 0.03, 0.22, 0.03, cx + dx * (hx - 0.05), y1 + 0.11, cz + dz * (hz - 0.05), cm, false); }
        else { box(gg, ex(sw + 0.12, sd + 0.12), 0.08, ez(sw + 0.12, sd + 0.12), cx, y1 + 0.04, cz, std(0x8d877f, { roughness: 0.9 })); if (c.cap !== 'stone') { const pot = std(0x7a4a3a, { roughness: 0.85 }); for (const [dx, dz] of [[0.14, -0.1], [-0.13, 0.1]]) { const f2 = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.28, 10), pot); f2.position.set(cx + (alongX ? dx : dz), y1 + 0.22, cz + (alongX ? dz : dx)); gg.add(f2); } } }
      }
      return gg;
    };
    if (outside) put(() => build(base, split, `Chimney stack (${lv.id})`, false), 0, 0, 0, null, 'structure');
    else {
      // through each storey above the hearth's: a flue box in the room it rises through
      for (const up of (spec.levels || []).filter(l => (l.y || 0) > y + 0.5 && (l.footprint || []).some(r => inR(cx, cz, r, 0.05)))) {
        const uy = up.y || 0, uh = up.height || 2.8;
        put(() => build(uy - 0.2, uy + uh - 0.01, `Chimney breast (${up.id})`, false), 0, 0, 0, null, 'structure');
      }
    }
    const above = put(() => build(outside ? split : Math.min(split, eaveY - 0.3), topY, `Chimney (${lv.id})`, true), 0, 0, 0, null, null);
    above.userData.isRoof = true; registerRoof(above);
    // w, d: the flue's plan extents (x, z); shoulder: the stack's plan extents below the top storey's head
    anchors.arch.features.push({ type: 'chimney', level: lv.id, at: [r3(cx), r3(cz)], w: r3(ex(sw, sd)), d: r3(ez(sw, sd)), shoulder: outside ? [r3(ex(sw + 0.4, sd + 0.1)), r3(ez(sw + 0.4, sd + 0.1))] : undefined, side: outside ? wall.side : undefined, top: r3(topY), base: r3(outside ? 0 : y + H), outside: !!outside, material: c.material || 'brick', color: c.color, hearth: at });
  }
  function worldMapped(m, set) {
    m.map = set.map; m.normalMap = set.normalMap; m.roughnessMap = set.roughnessMap; m.roughness = 1;
    if (set.normalMap) m.normalScale = new THREE.Vector2(set.normalScale, set.normalScale);
    return worldUV(THREE, m, { period: set.period, mode: 'auto' });
  }

  return { partition, levelFeatures, houseFeatures, railGroup, placeRail };
}
