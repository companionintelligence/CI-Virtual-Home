// Storage — dressers, cabinets, shelving, racks and boxes: the props a room keeps its things in.
//
// Contract (index.js): origin at the floor centre of the footprint; fronts (doors, drawers, open bays, shoe toes,
// bottle necks) face SOUTH (+z) at rot 0. A wall-mounted prop (wall-hooks) has its back at z = 0 and extends into
// +z, built from local y = 0 — the spec's `y` is the mount height (house-builder lifts the group by it).
// Big surfaces take role colours from ctx.colors (or it.color); small details may be literals; every seeded pick
// goes through ctx.rng, never Math.random. The room's theme() also maps a few literals to roles (0x334155 → fabric,
// 0x0f766e → accent, 0x1e293b non-metal → cabinet), so dark non-metal details use INK to stay put.
import { registerProps } from './registry.js';

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const BOOKS = [0x1e3a5f, 0xb45309, 0x7f9a8a, 0x334155, 0x9a3412, 0xc9a26b, 0x0f766e, 0x8c6d62, 0xe7e5e4, 0x5f6f8f];
const SHOES = [0x2b2622, 0xe7e5e4, 0x7c2d12, 0x334155, 0xb45309, 0xf1f5f9, 0x0c4a6e];
const GLASS = [0x1f3d2b, 0x4a1c2a, 0x2c3e1f, 0x5b2333, 0xc9d6c0];
const INK = 0x2b2622;   // dark non-metal detail — warm near-black, not in the theme map
const RATTAN = 0xc4a072;

const lum = c => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;
const contrast = body => (lum(body) < 0.4 ? 0xd6d3d1 : 0x1e293b);            // a handle that reads against the body
const relief = (mix, body) => mix(body, lum(body) < 0.5 ? 0xffffff : 0x000000, 0.08);   // door / drawer front tone
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

const cyl = (THREE, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 14) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
};
const ball = (THREE, r, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
  m.position.set(x, y, z); m.castShadow = true; return m;
};
// a row of upright books from x0 rightwards, spines to +z, standing on y; returns the right edge reached
function books(g, { std, box, rng }, x0, y, z, maxW, depth = 0.16, n = 5) {
  let x = x0;
  for (let i = 0; i < n; i++) {
    const t = 0.02 + rng() * 0.03, h = 0.17 + rng() * 0.09;
    if (x + t > x0 + maxW) break;
    g.add(box(t, h, depth, std(pick(rng, BOOKS), { roughness: 0.7 }), x + t / 2, y + h / 2, z));
    x += t + 0.004;
  }
  return x;
}
// a potted plant: pot + one flat-shaded foliage blob (2 meshes)
function plant(g, { THREE, std }, x, y, z, s = 1) {
  g.add(cyl(THREE, 0.05 * s, 0.04 * s, 0.1 * s, std(0xd6d3d1, { roughness: 0.8 }), x, y + 0.05 * s, z, 12));
  const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085 * s, 0), std(0x4d7c3a, { roughness: 0.9, flatShading: true }));
  f.position.set(x, y + 0.17 * s, z); f.castShadow = true; g.add(f);
}

registerProps({
  // ---- dresser: a cabinet-coloured carcass on turned wood legs, a wood top, 3 drawer rows (× 2 columns when wide)
  'dresser': {
    footprint: [1.2, 0.5], height: 0.85, params: ['w', 'd', 'h', 'color'], tags: ['bedroom', 'nursery', 'kids'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = it.w || 1.2, d = it.d || 0.5, h = it.h || 0.85, g = group('Dresser');
      const body = it.color ? hex(it.color) : colors.cabinet;
      const bodyMat = std(body, { roughness: 0.55 }), woodMat = std(colors.wood, { roughness: 0.5 });
      const legH = 0.12, topT = 0.03, carcH = h - legH - topT;
      g.add(box(w, carcH, d, bodyMat, 0, legH + carcH / 2, 0));
      g.add(box(w + 0.03, topT, d + 0.02, woodMat, 0, h - topT / 2, 0.01));
      for (const [sx, sz] of CORNERS) g.add(cyl(THREE, 0.018, 0.026, legH, woodMat, sx * (w / 2 - 0.08), legH / 2, sz * (d / 2 - 0.08), 10));
      const rows = 3, cols = w >= 0.9 ? 2 : 1, gap = 0.025;
      const fw = (w - gap * (cols + 1)) / cols, fh = (carcH - gap * (rows + 1)) / rows;
      const frontMat = std(relief(mix, body), { roughness: 0.55 }), handleMat = std(contrast(body), { metalness: 0.7, roughness: 0.3 });
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = -w / 2 + gap + fw / 2 + c * (fw + gap), y = legH + gap + fh / 2 + r * (fh + gap);
        g.add(box(fw, fh, 0.018, frontMat, x, y, d / 2 + 0.009));
        g.add(box(Math.min(0.16, fw * 0.4), 0.014, 0.014, handleMat, x, y, d / 2 + 0.03));
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.6, 0.12, -0.25, 0.6, 0.82, 0.25], color: 'role:cabinet' }, { shape: 'box', box: [-0.61, 0.82, -0.25, 0.61, 0.85, 0.27], color: 'role:wood' }],
  },

  // ---- tall cabinet: a full-height carcass on a recessed toe-kick, two doors with long bar handles
  'tall-cabinet': {
    footprint: [0.8, 0.45], height: 2.0, params: ['w', 'd', 'h', 'color'], tags: ['bedroom', 'hall', 'bathroom', 'laundry', 'kitchen'],
    create(it, { std, box, group, colors, hex, mix }) {
      const w = it.w || 0.8, d = it.d || 0.45, h = it.h || 2.0, g = group('Tall Cabinet');
      const body = it.color ? hex(it.color) : colors.cabinet;
      const bodyMat = std(body, { roughness: 0.55 }), plinthH = 0.08;
      g.add(box(w - 0.06, plinthH, d - 0.04, std(INK, { roughness: 0.6 }), 0, plinthH / 2, -0.02));
      g.add(box(w, h - plinthH, d, bodyMat, 0, plinthH + (h - plinthH) / 2, 0));
      const doors = w > 0.6 ? 2 : 1, gap = 0.02, dw = (w - gap * (doors + 1)) / doors, dh = h - plinthH - gap * 2;
      const doorMat = std(relief(mix, body), { roughness: 0.5 }), handleMat = std(contrast(body), { metalness: 0.7, roughness: 0.3 });
      for (let i = 0; i < doors; i++) {
        const x = -w / 2 + gap + dw / 2 + i * (dw + gap);
        g.add(box(dw, dh, 0.018, doorMat, x, plinthH + gap + dh / 2, d / 2 + 0.009));
        const hx = doors === 2 ? x + (i === 0 ? 1 : -1) * (dw / 2 - 0.05) : x + dw / 2 - 0.06;   // by the meeting stiles
        g.add(box(0.014, Math.min(0.4, dh * 0.3), 0.014, handleMat, hx, h * 0.5, d / 2 + 0.03));
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.4, 0, -0.225, 0.4, 2.0, 0.225], color: 'role:cabinet' }],
  },

  // ---- sideboard: a long low wood credenza on hairpin legs, `doors` door fronts, a vase and two books on top
  'sideboard': {
    footprint: [1.8, 0.45], height: 0.95, params: ['w', 'd', 'h', 'doors', 'color'], tags: ['dining', 'living', 'hall'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 1.8, d = it.d || 0.45, h = it.h || 0.8, g = group('Sideboard');
      const body = it.color ? hex(it.color) : colors.wood;
      const bodyMat = std(body, { roughness: 0.45 }), legH = 0.16, topT = 0.03, carcH = h - legH - topT;
      g.add(box(w, carcH, d, bodyMat, 0, legH + carcH / 2, 0));
      g.add(box(w + 0.02, topT, d + 0.02, bodyMat, 0, h - topT / 2, 0));
      const legMat = std(colors.metal, { metalness: 0.75, roughness: 0.3 });
      for (const [sx, sz] of CORNERS) g.add(cyl(THREE, 0.012, 0.018, legH, legMat, sx * (w / 2 - 0.1), legH / 2, sz * (d / 2 - 0.08), 8));
      const doors = it.doors || Math.max(2, Math.round(w / 0.45)), gap = 0.02, dw = (w - gap * (doors + 1)) / doors, dh = carcH - gap * 2;
      const doorMat = std(relief(mix, body), { roughness: 0.5 }), knobMat = std(contrast(body), { metalness: 0.7, roughness: 0.3 });
      for (let i = 0; i < doors; i++) {
        const x = -w / 2 + gap + dw / 2 + i * (dw + gap);
        g.add(box(dw, dh, 0.018, doorMat, x, legH + gap + dh / 2, d / 2 + 0.009));
        const side = (i % 2 || (doors % 2 && i === doors - 1)) ? -1 : 1;   // knobs meet in pairs; an odd last door hinges on the outside
        const knob = cyl(THREE, 0.012, 0.012, 0.025, knobMat, x + side * (dw / 2 - 0.06), legH + carcH / 2, d / 2 + 0.03, 10);
        knob.rotation.x = Math.PI / 2; g.add(knob);
      }
      // on top: a vase at one end, two stacked books at the other
      g.add(cyl(THREE, 0.045, 0.06, 0.15, std(colors.accent, { roughness: 0.4 }), w * 0.32, h + 0.075, 0, 14));
      for (let i = 0; i < 2; i++) {
        const b = box(0.22 - i * 0.03, 0.025, 0.16 - i * 0.02, std(pick(rng, BOOKS), { roughness: 0.7 }), -w * 0.32, h + 0.0125 + i * 0.025, 0.02);
        b.rotation.y = (rng() - 0.5) * 0.3; g.add(b);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.9, 0.16, -0.225, 0.9, 0.8, 0.225], color: 'role:wood' }, { shape: 'cyl', box: [0.52, 0.8, -0.06, 0.64, 0.95, 0.06], color: 'role:accent' }],
  },

  // ---- open shelving: an open-backed wood unit, a bay every ~0.42 m, each dressed with books, a plant, boxes, a basket
  'open-shelving': {
    footprint: [1.0, 0.35], height: 1.8, params: ['w', 'h', 'd', 'color'], tags: ['living', 'office', 'bedroom', 'kids', 'hall'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, rng } = ctx;
      const w = it.w || 1.0, h = it.h || 1.8, d = it.d || 0.35, g = group('Open Shelving');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 }), t = 0.03;
      for (const sx of [-1, 1]) g.add(box(t, h, d, wood, sx * (w / 2 - t / 2), h / 2, 0));
      const bays = Math.max(2, Math.round((h - 0.1) / 0.42)), y0 = 0.075, y1 = h - t / 2, tops = [];
      for (let i = 0; i <= bays; i++) { const y = y0 + (y1 - y0) * (i / bays); g.add(box(w - 2 * t, t, d, wood, 0, y, 0)); tops.push(y + t / 2); }
      const inner = w - 2 * t - 0.06, x0 = -inner / 2, zc = 0.01;
      const linen = std(colors.linen, { roughness: 0.9 }), fab = std(colors.fabric, { roughness: 0.9 }), fab2 = std(colors.fabric2, { roughness: 0.9 });
      for (let i = 0; i < bays; i++) {
        const y = tops[i], kind = (bays - 1 - i) % 4;   // count down from the top bay
        if (kind === 0) { books(g, ctx, x0, y, zc, inner * 0.55, Math.min(0.16, d - 0.1), 5); plant(g, ctx, inner / 2 - 0.09, y, zc, 0.9); }
        else if (kind === 1) { g.add(box(0.3, 0.2, Math.min(0.26, d - 0.06), fab, x0 + 0.16, y + 0.1, zc)); g.add(cyl(THREE, 0.04, 0.05, 0.16, std(colors.accent, { roughness: 0.4 }), inner / 2 - 0.12, y + 0.08, zc, 12)); }
        else if (kind === 2) { const xe = books(g, ctx, x0 + 0.05, y, zc, inner * 0.5, Math.min(0.16, d - 0.1), 4); const f = box(0.2, 0.15, 0.015, std(INK, { roughness: 0.5 }), Math.min(xe + 0.16, inner / 2 - 0.12), y + 0.075, zc - 0.03); f.rotation.x = -0.18; g.add(f); }
        else { g.add(box(0.28, 0.22, Math.min(0.26, d - 0.06), linen, x0 + 0.15, y + 0.11, zc)); g.add(box(0.28, 0.22, Math.min(0.26, d - 0.06), fab2, inner / 2 - 0.15, y + 0.11, zc)); }
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.5, 0, -0.175, 0.5, 1.8, 0.175], color: 'role:wood' }],
  },

  // ---- cube storage: a grid of 0.35 m cubbies (cols × rows from w × h in metres, or `cols`/`rows` outright) with fabric bins and books
  'cube-storage': {
    footprint: [0.76, 0.39], height: 0.76, params: ['w', 'h', 'd', 'cols', 'rows', 'color'], tags: ['kids', 'nursery', 'living', 'office', 'hall'],
    create(it, ctx) {
      const { std, box, group, colors, hex, mix, rng } = ctx;
      const CELL = 0.35, T = 0.02, P = CELL + T;
      const cols = it.cols || Math.max(1, Math.round(((it.w || 0.76) - T) / P)), rows = it.rows || Math.max(1, Math.round(((it.h || 0.76) - T) / P));
      const w = cols * P + T, h = rows * P + T, d = it.d || 0.39, g = group(`Cube Storage ${cols}×${rows}`);
      const body = it.color ? hex(it.color) : colors.cabinet, mat = std(body, { roughness: 0.55 });
      g.add(box(w, T, d, mat, 0, T / 2, 0)); g.add(box(w, T, d, mat, 0, h - T / 2, 0));
      for (const sx of [-1, 1]) g.add(box(T, h - 2 * T, d, mat, sx * (w / 2 - T / 2), h / 2, 0));
      g.add(box(w - 2 * T, h - 2 * T, 0.012, std(relief(mix, body), { roughness: 0.6 }), 0, h / 2, -d / 2 + 0.006));
      for (let c = 1; c < cols; c++) g.add(box(T, h - 2 * T, d - 0.012, mat, -w / 2 + c * P + T / 2, h / 2, 0.006));
      for (let r = 1; r < rows; r++) g.add(box(w - 2 * T, T, d - 0.012, mat, 0, r * P + T / 2, 0.006));
      const bins = [colors.fabric, colors.fabric2, colors.accent, colors.linen], bz = d / 2 - 0.155 - 0.03;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = -w / 2 + T + c * P + CELL / 2, y = T + r * P, u = rng();
        if (u < 0.6) g.add(box(0.31, 0.31, 0.31, std(pick(rng, bins), { roughness: 0.9 }), x, y + 0.155, bz));
        else if (u < 0.85) books(g, ctx, x - 0.15, y, bz, 0.3, Math.min(0.2, d - 0.1), 3);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.38, 0, -0.195, 0.38, 0.76, 0.195], color: 'role:cabinet' }],
  },

  // ---- shoe rack: two slatted wood tiers on slim metal posts, pairs of shoes toes-out (+z)
  'shoe-rack': {
    footprint: [0.8, 0.32], height: 0.5, params: ['w', 'color'], tags: ['hall', 'bedroom'],
    create(it, { std, box, group, colors, hex, rng }) {
      const w = it.w || 0.8, d = 0.32, g = group('Shoe Rack');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 }), post = std(colors.metal, { metalness: 0.75, roughness: 0.3 });
      for (const [sx, sz] of CORNERS) g.add(box(0.02, 0.41, 0.02, post, sx * (w / 2 - 0.01), 0.205, sz * (d / 2 - 0.01)));
      const tiers = [0.1, 0.4];
      for (const y of tiers) for (const z of [-0.11, 0, 0.11]) g.add(box(w - 0.04, 0.02, 0.05, wood, 0, y, z));
      const pitch = 0.24, pairs = Math.max(1, Math.floor((w - 0.06) / pitch));   // a pair is 0.18 m wide; centred on the rack
      for (const y of tiers) for (let p = 0; p < pairs; p++) {
        const m = std(pick(rng, SHOES), { roughness: 0.6 }), x0 = (p - (pairs - 1) / 2) * pitch - 0.05 + (rng() - 0.5) * 0.03, top = y + 0.01;
        for (const k of [0, 1]) { const x = x0 + k * 0.1; g.add(box(0.08, 0.035, 0.26, m, x, top + 0.0175, 0)); g.add(box(0.075, 0.05, 0.16, m, x, top + 0.06, -0.04)); }
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.4, 0, -0.16, 0.4, 0.42, 0.16], color: 'role:wood' }],
  },

  // ---- coat rack: a standing metal hall tree — disc base, pole, two rings of hooks, a coat on the front hook, a hat up top
  'coat-rack': {
    footprint: [0.45, 0.45], height: 1.8, params: ['color'], tags: ['hall', 'bedroom', 'office'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Coat Rack');
      const metal = std(it.color ? hex(it.color) : colors.metal, { metalness: 0.7, roughness: 0.35 });
      g.add(cyl(THREE, 0.19, 0.2, 0.025, metal, 0, 0.0125, 0, 20));
      g.add(cyl(THREE, 0.016, 0.02, 1.75, metal, 0, 0.9, 0, 10));
      g.add(ball(THREE, 0.03, metal, 0, 1.77, 0));
      const hook = (y, a, len, tilt = 0.35) => {
        const pivot = new THREE.Group(); pivot.position.y = y; pivot.rotation.y = -a;
        const arm = cyl(THREE, 0.008, 0.008, len, metal, len / 2 * Math.cos(tilt), len / 2 * Math.sin(tilt), 0, 8); arm.rotation.z = -(Math.PI / 2 - tilt);
        pivot.add(arm); pivot.add(ball(THREE, 0.016, metal, len * Math.cos(tilt), len * Math.sin(tilt), 0)); g.add(pivot);
      };
      for (let k = 0; k < 5; k++) hook(1.64, Math.PI / 2 + k * Math.PI * 2 / 5, 0.17);
      for (let k = 0; k < 3; k++) hook(1.38, Math.PI / 6 + k * Math.PI * 2 / 3, 0.14);
      // the coat hangs from the front hook: 0.4 m across the shoulders narrowing to the hem, flattened to half its
      // width so it hangs like cloth rather than a tube, a dark collar over the shoulders
      const coat = cyl(THREE, 0.2, 0.15, 0.8, std(colors.fabric, { roughness: 0.9 }), 0, 1.22, 0.11, 12); coat.scale.z = 0.5; g.add(coat);
      const ink = std(INK, { roughness: 0.85 });
      const collar = cyl(THREE, 0.07, 0.13, 0.08, ink, 0, 1.62, 0.11, 12); collar.scale.z = 0.5; g.add(collar);
      const placket = box(0.022, 0.76, 0.01, ink, 0, 1.21, 0.2); placket.rotation.x = Math.atan2(0.025, 0.8); g.add(placket);   // the front opening, following the taper
      const hatMat = std(colors.fabric2, { roughness: 0.85 }), ha = Math.PI / 2 + 3 * Math.PI * 2 / 5, hx = 0.15 * Math.cos(ha), hz = 0.15 * Math.sin(ha);
      g.add(cyl(THREE, 0.13, 0.13, 0.012, hatMat, hx, 1.71, hz, 16)); g.add(cyl(THREE, 0.075, 0.085, 0.08, hatMat, hx, 1.756, hz, 14));
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.2, 0, -0.2, 0.2, 0.03, 0.2], color: 'role:metal' }, { shape: 'cyl', box: [-0.02, 0, -0.02, 0.02, 1.8, 0.02], color: 'role:metal' }, { shape: 'cyl', box: [-0.2, 0.82, 0.01, 0.2, 1.66, 0.21], color: 'role:fabric' }],
  },

  // ---- ladder shelf: two rails leaning back to the wall (−z), four shelves that deepen toward the floor, dressed
  'ladder-shelf': {
    footprint: [0.6, 0.5], height: 1.8, params: ['w', 'h', 'color'], tags: ['living', 'office', 'bedroom', 'hall'],
    create(it, ctx) {
      const { THREE, std, box, group, colors, hex, rng } = ctx;
      const w = it.w || 0.6, h = it.h || 1.8, d = 0.5, g = group('Ladder Shelf');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 });
      const run = d - 0.04, tilt = Math.atan2(run, h), L = (h - 0.04 * Math.sin(tilt)) / Math.cos(tilt);   // the tilted rail's corners stay inside [0, h]
      for (const sx of [-1, 1]) { const rail = box(0.04, L, 0.04, wood, sx * (w / 2 - 0.02), h / 2, 0); rail.rotation.x = -tilt; g.add(rail); }
      const zRail = y => (d / 2 - 0.02) - (y / h) * run;   // the rail's centre line at height y
      const ys = [0.2, 0.6, 1.0, 1.4].map(v => v * (h / 1.8)), sw = w - 0.09, tops = [];
      for (const y of ys) { const front = zRail(y) + 0.02, back = -d / 2 + 0.01; g.add(box(sw, 0.025, front - back, wood, 0, y, (front + back) / 2)); tops.push({ y: y + 0.0125, zc: (front + back) / 2, depth: front - back }); }
      let s = tops[3]; plant(g, ctx, 0, s.y, s.zc, 0.9);
      s = tops[2]; books(g, ctx, -sw / 2 + 0.03, s.y, s.zc, sw - 0.06, Math.min(0.16, s.depth - 0.04), 4);
      s = tops[1]; { const f = box(0.22, 0.17, 0.015, std(INK, { roughness: 0.5 }), sw * 0.2, s.y + 0.085, s.zc - s.depth / 2 + 0.05); f.rotation.x = -0.2; g.add(f); g.add(cyl(THREE, 0.035, 0.045, 0.13, std(colors.accent, { roughness: 0.4 }), -sw * 0.25, s.y + 0.065, s.zc, 12)); }
      s = tops[0]; { const bk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.22, 10), std(RATTAN, { roughness: 0.9, flatShading: true })); bk.position.set(0, s.y + 0.11, s.zc); bk.castShadow = true; g.add(bk); }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.3, 0, -0.25, 0.3, 0.6, 0.25], color: 'role:wood' }, { shape: 'box', box: [-0.3, 0.6, -0.25, 0.3, 1.8, 0.05], color: 'role:wood' }],
  },

  // ---- wine rack: a wood rack with four rows of bottles lying necks-out (+z), a top board to set a glass on
  'wine-rack': {
    footprint: [0.5, 0.32], height: 0.9, params: ['w', 'color'], tags: ['kitchen', 'dining', 'living'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const w = it.w || 0.5, d = 0.32, g = group('Wine Rack');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 }), t = 0.02, pitch = 0.215;
      for (const sx of [-1, 1]) g.add(box(t, 0.8925, d - 0.02, wood, sx * (w / 2 - t / 2), 0.44625, 0));
      const profile = [[0, 0], [0.037, 0], [0.037, 0.19], [0.022, 0.235], [0.013, 0.25], [0.013, 0.305], [0.016, 0.305], [0.016, 0.315], [0, 0.315]].map(([x, y]) => new THREE.Vector2(x, y));
      const bottleGeo = new THREE.LatheGeometry(profile, 14);
      const slots = Math.max(1, Math.round((w - 2 * t) / 0.15)), pitchX = (w - 2 * t) / slots;
      for (let i = 0; i < 5; i++) {
        const y = 0.02 + i * pitch;
        g.add(box(w - 2 * t, 0.025, d - 0.02, wood, 0, y, 0));
        if (i === 4) break;
        g.add(box(w - 2 * t, 0.03, 0.015, wood, 0, y + 0.0275, d / 2 - 0.0175));   // front lip that keeps the row from rolling
        for (let s = 0; s < slots; s++) {
          if (rng() < 0.18) continue;
          const b = new THREE.Mesh(bottleGeo, std(pick(rng, GLASS), { roughness: 0.35 }));
          b.rotation.x = Math.PI / 2; b.position.set(-w / 2 + t + (s + 0.5) * pitchX, y + 0.0125 + 0.037, -d / 2 + 0.02); b.castShadow = true; g.add(b);
        }
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.25, 0, -0.16, 0.25, 0.9, 0.16], color: 'role:wood' }],
  },

  // ---- chest: a blanket box — wood body on block feet, a lipped lid with dark straps and a clasp, a folded blanket on top
  'chest': {
    footprint: [1.0, 0.45], height: 0.56, params: ['w', 'd', 'color'], tags: ['bedroom', 'living', 'hall', 'kids'],
    create(it, { std, box, group, colors, hex, rng }) {
      const w = it.w || 1.0, d = it.d || 0.45, g = group('Blanket Chest');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 }), strap = std(INK, { roughness: 0.5 });
      for (const [sx, sz] of CORNERS) g.add(box(0.06, 0.06, 0.06, strap, sx * (w / 2 - 0.05), 0.03, sz * (d / 2 - 0.05)));
      g.add(box(w, 0.38, d, wood, 0, 0.25, 0));
      g.add(box(w + 0.03, 0.06, d + 0.03, wood, 0, 0.47, 0));
      for (const sx of [-1, 1]) { g.add(box(0.03, 0.38, 0.006, strap, sx * w * 0.3, 0.25, d / 2 + 0.003)); g.add(box(0.03, 0.006, d + 0.03, strap, sx * w * 0.3, 0.503, 0)); }
      g.add(box(0.05, 0.06, 0.012, std(contrast(colors.wood), { metalness: 0.7, roughness: 0.3 }), 0, 0.4, d / 2 + 0.006));
      const bl = box(0.42, 0.06, 0.3, std(rng() < 0.5 ? colors.fabric2 : colors.fabric, { roughness: 0.95 }), w * 0.2, 0.53, 0); bl.rotation.y = (rng() - 0.5) * 0.25; g.add(bl);
      return g;
    },
    iso: [{ shape: 'box', box: [-0.5, 0, -0.225, 0.5, 0.5, 0.225], color: 'role:wood' }, { shape: 'box', box: [-0.01, 0.5, -0.15, 0.41, 0.56, 0.15], color: 'role:fabric2' }],
  },

  // ---- wall hooks (wall-mounted): a wood rail with metal pegs and a cap on one; back at z = 0, `y` is the mount height
  'wall-hooks': {
    footprint: [0.6, 0.11], height: 0.21, params: ['w', 'y', 'color'], tags: ['hall', 'bathroom', 'laundry', 'kids', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const w = it.w || 0.6, g = group('Wall Hooks');
      g.add(box(w, 0.08, 0.02, std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 }), 0, 0.1, 0.01));
      const metal = std(colors.metal, { metalness: 0.7, roughness: 0.3 }), n = Math.max(2, Math.round(w / 0.15));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (i + 0.5) * (w / n);
        const peg = cyl(THREE, 0.007, 0.007, 0.07, metal, x, 0.1, 0.055, 8); peg.rotation.x = Math.PI / 2; g.add(peg);
        g.add(ball(THREE, 0.014, metal, x, 0.1, 0.09));
      }
      // a straw hat hung on the second peg: brim disc flat to the wall, crown dome out into the room and deep
      // enough (apex z 0.11) to swallow the peg it hangs on; the brim stays above local y = 0
      const straw = std(0xd9b77a, { roughness: 0.9 }), hx = -w / 2 + 1.5 * (w / n);
      const brim = cyl(THREE, 0.1, 0.1, 0.008, straw, hx, 0.11, 0.034, 18); brim.rotation.x = Math.PI / 2; g.add(brim);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), straw);
      crown.rotation.x = Math.PI / 2; crown.position.set(hx, 0.11, 0.04); crown.castShadow = true; g.add(crown);
      return g;
    },
    iso: [{ shape: 'box', box: [-0.3, 0.06, 0, 0.3, 0.14, 0.11], color: 'role:wood' }],
  },

  // ---- laundry hamper: a flat-shaded rattan basket with a lid and two loop handles
  'laundry-hamper': {
    footprint: [0.42, 0.42], height: 0.62, params: ['color'], tags: ['bedroom', 'bathroom', 'laundry'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Laundry Hamper');
      const rattan = std(it.color ? hex(it.color) : RATTAN, { roughness: 0.9, flatShading: true });
      g.add(cyl(THREE, 0.2, 0.17, 0.56, rattan, 0, 0.28, 0, 10));
      g.add(cyl(THREE, 0.21, 0.21, 0.03, rattan, 0, 0.575, 0, 10));
      g.add(ball(THREE, 0.025, rattan, 0, 0.6, 0));
      const band = std(0x9c7a4f, { roughness: 0.9, flatShading: true });
      for (const y of [0.1, 0.46]) { const r = 0.17 + 0.03 * (y / 0.56) + 0.006; g.add(cyl(THREE, r, r, 0.025, band, 0, y, 0, 10)); }
      for (const sx of [-1, 1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 10), rattan); hd.position.set(sx * 0.2, 0.42, 0); hd.rotation.y = Math.PI / 2; hd.castShadow = true; g.add(hd); }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.21, 0, -0.21, 0.21, 0.6, 0.21], color: '#c4a072' }],
  },

  // ---- storage bench: a hall bench with two open cubbies below the seat, a fabric cushion, a basket and shoes tucked in
  'storage-bench': {
    footprint: [1.0, 0.4], height: 0.5, params: ['w', 'color'], tags: ['hall', 'bedroom', 'kids'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const w = it.w || 1.0, d = 0.4, g = group('Storage Bench');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 }), t = 0.03;
      for (const sx of [-1, 1]) g.add(box(t, 0.45, d, wood, sx * (w / 2 - t / 2), 0.225, 0));
      g.add(box(w - 2 * t, t, d, wood, 0, 0.435, 0));
      g.add(box(w - 2 * t, t, d, wood, 0, 0.085, 0));
      g.add(box(t, 0.35 - t, d - 0.02, wood, 0, 0.26, 0));
      g.add(box(w - 0.04, 0.05, d - 0.04, std(colors.fabric, { roughness: 0.95 }), 0, 0.475, 0));
      const bay = (w - 3 * t) / 2, xl = -w / 2 + t + bay / 2, xr = w / 2 - t - bay / 2;
      const bk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.24, 10), std(RATTAN, { roughness: 0.9, flatShading: true })); bk.position.set(xl, 0.1 + 0.12, 0); bk.castShadow = true; g.add(bk);
      const sm = std(pick(rng, SHOES), { roughness: 0.6 });
      for (const k of [-1, 1]) { const x = xr + k * 0.055; g.add(box(0.08, 0.035, 0.26, sm, x, 0.1175, 0.02)); g.add(box(0.075, 0.05, 0.16, sm, x, 0.16, -0.02)); }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.5, 0, -0.2, 0.5, 0.45, 0.2], color: 'role:wood' }, { shape: 'box', box: [-0.48, 0.45, -0.18, 0.48, 0.5, 0.18], color: 'role:fabric' }],
  },
});

// =================================================================================================================
// Pass 4 (S3 compose): an armoire for bedrooms without a fitted wardrobe, a bedside table that is not the one
// nightstand every bedroom had, and a bar cart.
// =================================================================================================================
registerProps({
  // Armoire — a tall two-door wardrobe with a crown cornice, a drawer across the foot and bracket feet
  // (farmhouse, cottage, craftsman, mediterranean bedrooms). w, h, color.
  'armoire': {
    footprint: [1.1, 0.6], height: 2.1, params: ['w', 'h', 'color'], tags: ['bedroom', 'hall'],
    create(it, { std, box, group, colors, hex, mix }) {
      const w = it.w || 1.1, d = 0.58, h = it.h || 2.1, g = group('Armoire');
      const body = it.color ? hex(it.color) : colors.wood, bodyMat = std(body, { roughness: 0.55 }), front = std(relief(mix, body), { roughness: 0.5 });
      const handle = std(contrast(body), { metalness: 0.6, roughness: 0.35 });
      for (const [sx, sz] of CORNERS) g.add(box(0.08, 0.1, 0.08, bodyMat, sx * (w / 2 - 0.05), 0.05, sz * (d / 2 - 0.05)));   // bracket feet
      g.add(box(w, h - 0.18, d, bodyMat, 0, 0.1 + (h - 0.18) / 2, 0));
      g.add(box(w + 0.06, 0.08, d + 0.04, bodyMat, 0, h - 0.04, 0.01));                             // cornice
      g.add(box(w - 0.08, 0.2, 0.02, front, 0, 0.23, d / 2 + 0.01));                               // foot drawer
      g.add(box(0.14, 0.02, 0.02, handle, 0, 0.23, d / 2 + 0.03));
      const dh = h - 0.18 - 0.3;
      for (const s of [-1, 1]) {
        g.add(box(w / 2 - 0.06, dh, 0.02, front, s * (w / 4 - 0.005), 0.36 + dh / 2, d / 2 + 0.01));   // doors
        g.add(box(w / 2 - 0.16, dh - 0.16, 0.012, std(mix(body, 0x000000, 0.12), { roughness: 0.55 }), s * (w / 4 - 0.005), 0.36 + dh / 2, d / 2 + 0.024));   // panels
        g.add(box(0.016, 0.16, 0.02, handle, s * 0.05, 0.36 + dh / 2, d / 2 + 0.04));
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.55, 0, -0.3, 0.55, 2.1, 0.3], color: 'role:wood' }],
  },
  // Bedside table — an open box with one drawer on splayed legs (mid-century, scandi, modern). color.
  'bedside-table': {
    footprint: [0.45, 0.38], height: 0.56, params: ['color'], tags: ['bedroom', 'guest'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = 0.45, d = 0.38, g = group('Bedside Table'), body = it.color ? hex(it.color) : colors.wood;
      const mat = std(body, { roughness: 0.5 });
      for (const [sx, sz] of CORNERS) { const l = cyl(THREE, 0.018, 0.012, 0.26, mat, sx * (w / 2 - 0.05), 0.13, sz * (d / 2 - 0.05), 8); l.rotation.set(-sz * 0.1, 0, sx * 0.1); g.add(l); }
      g.add(box(w, 0.02, d, mat, 0, 0.27, 0));                                 // bottom
      g.add(box(w, 0.02, d, mat, 0, 0.55, 0));                                 // top
      for (const s of [-1, 1]) g.add(box(0.02, 0.28, d, mat, s * (w / 2 - 0.01), 0.41, 0));
      g.add(box(w - 0.04, 0.12, 0.02, std(relief(mix, body), { roughness: 0.5 }), 0, 0.47, d / 2 - 0.01));   // drawer
      g.add(box(0.06, 0.012, 0.015, std(contrast(body), { metalness: 0.6, roughness: 0.35 }), 0, 0.47, d / 2 + 0.005));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.225, 0.26, -0.19, 0.225, 0.56, 0.19], color: 'role:wood' }],
  },
  // Bar cart — two brass-edged trays on a slim frame with wheels, bottles and glasses on top (bar, living, dining).
  'bar-cart': {
    footprint: [0.8, 0.45], height: 0.95, params: ['color'], tags: ['bar', 'living', 'dining'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const w = 0.8, d = 0.45, g = group('Bar Cart'), frame = std(it.color ? hex(it.color) : colors.metal, { metalness: 0.85, roughness: 0.3 });
      const tray = std(colors.wood, { roughness: 0.4 });
      for (const [sx, sz] of CORNERS) g.add(box(0.02, 0.8, 0.02, frame, sx * (w / 2 - 0.02), 0.44, sz * (d / 2 - 0.02)));
      for (const y of [0.22, 0.76]) { g.add(box(w - 0.02, 0.015, d - 0.02, tray, 0, y, 0)); g.add(box(w, 0.03, 0.01, frame, 0, y + 0.02, d / 2 - 0.01)); g.add(box(w, 0.03, 0.01, frame, 0, y + 0.02, -d / 2 + 0.01)); }
      const handle = cyl(THREE, 0.012, 0.012, d, frame, w / 2 + 0.04, 0.86, 0, 8); handle.rotation.x = Math.PI / 2; g.add(handle);
      for (const [sx, sz] of [[-1, -1], [-1, 1]]) { const wh = cyl(THREE, 0.04, 0.04, 0.02, frame, sx * (w / 2 - 0.02), 0.04, sz * (d / 2 - 0.02), 14); wh.rotation.z = Math.PI / 2; g.add(wh); }
      for (let i = 0; i < 3; i++) { const c = pick(rng, GLASS); g.add(cyl(THREE, 0.035, 0.035, 0.24, std(c, { roughness: 0.2, metalness: 0.2 }), -0.25 + i * 0.1, 0.9, -0.08, 12)); g.add(cyl(THREE, 0.012, 0.012, 0.06, std(c, { roughness: 0.2 }), -0.25 + i * 0.1, 1.05, -0.08, 8)); }
      for (let i = 0; i < 2; i++) g.add(cyl(THREE, 0.03, 0.025, 0.09, std(0xe2e8f0, { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.6 }), 0.15 + i * 0.1, 0.815, 0.08, 12));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.4, 0, -0.225, 0.4, 0.8, 0.225], color: 'role:metal' }],
  },
});
