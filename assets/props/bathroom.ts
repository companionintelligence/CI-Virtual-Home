// Bathroom & laundry — the wet room and the utility corner. Same contract as decor.js: floor origin at the
// footprint centre, faces +z (south) at rot 0, big surfaces take a role colour from ctx.colors (or it.color), only
// fittings and trims use literals, and any variation comes from ctx.rng so frames stay deterministic.
//   ceramics  → colors.linen        cabinetry → colors.cabinet       taps, rails, rings → colors.metal
//   towels    → accent / fabric2    mats      → rug / accent         baskets → the kit's wood, lifted to rattan
// Chrome is metalness ≥ 0.7 on purpose: the kit's theme pass re-paints any material whose colour is a role literal
// (colors.metal is one) unless it is metallic. Glass is a MeshPhysicalMaterial at opacity 0.35 with no
// transmission, and casts no shadow (a shadow-casting pane reads as a solid wall).
//
// Wall-mounted props (towel-rail, heated-towel-rail, mirror-cabinet) keep their back at z = 0 and extend into +z.
// house-builder lifts an item's origin by it.y, so:
//   y given  → the origin IS the mount point: bottom edge at local y = 0, the spec's y is the mounting height
//              (0 is a valid mount — a floor-standing heated towel rail props flush against the wall at y: 0)
//   no y     → the prop hangs itself at its natural height above the floor origin (the sheet, the catalog, terse specs)
// `height` is the prop's own extent either way; the iso hints are written for the no-y case.
import { registerProps } from './registry.js';
import { softkit, softMat, put, splitRng, drapeTowel } from './softkit.js';

// ---- small builders shared by the props below
const cyl = (THREE, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 20, shadow = true) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m;
};
// an oval: a cylinder scaled to rx × rz, optionally tapered toward the foot (tubs, basins, bowls)
const oval = (THREE, rx, rz, h, mat, x = 0, y = 0, z = 0, taper = 1, seg = 32) => {
  const m = cyl(THREE, 1, taper, h, mat, x, y, z, seg); m.scale.set(rx, 1, rz); return m;
};
// a horizontal tube along x (rails) or along z (spouts, shower arms)
const bar = (THREE, r, len, mat, x, y, z, axis = 'x', seg = 10) => {
  const m = cyl(THREE, r, r, len, mat, x, y, z, seg); if (axis === 'x') m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2; return m;
};
// a flat ring (basket rims); a torus faces +z by default, so rotate it down
const ring = (THREE, r, tube, mat, x, y, z, seg = 24) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.castShadow = true; return m;
};
// a disc facing +z (dials, drum doors, portholes)
const disc = (THREE, r, h, mat, x, y, z, seg = 24) => { const m = cyl(THREE, r, r, h, mat, x, y, z, seg); m.rotation.x = Math.PI / 2; return m; };
const chrome = (std, color, extra = {}) => std(color, { metalness: 0.85, roughness: 0.28, ...extra });
const ceramic = (std, color) => std(color, { roughness: 0.32 });
const mirrorMat = std => std(0xe2e8f0, { metalness: 0.9, roughness: 0.08 });
const glassMat = (THREE, color = 0xc9e6ea) => new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0, side: THREE.DoubleSide });
const mountY = (it, natural) => (it.y !== undefined ? 0 : natural);
const towelColor = (colors, rng) => (rng() < 0.5 ? colors.accent : colors.fabric2);

// ---- the laundry pair share one carcass: a 60 cm cube with a plinth, a control strip and a porthole. The washer's
// door is a dark drum behind a glass dome, the dryer's a solid disc over a vent grille; both flat-topped so the
// dryer stacks (spec y: 0.85).
function appliance(kind, it, { THREE, std, box, group, colors, hex, mix }) {
  const g = group(kind === 'washer' ? 'Washing Machine' : 'Tumble Dryer');
  const body = it.color ? hex(it.color) : colors.linen;
  const shell = std(body, { roughness: 0.45 }), dark = std(0x2a3140, { roughness: 0.5 }), metal = chrome(std, colors.metal);
  g.add(box(0.56, 0.03, 0.56, dark, 0, 0.015, 0));                                                     // plinth
  g.add(box(0.6, 0.82, 0.6, shell, 0, 0.44, 0));                                                       // body 0.03–0.85
  g.add(box(0.58, 0.1, 0.012, dark, 0, 0.78, 0.306));                                                  // control strip
  g.add(disc(THREE, 0.032, 0.02, metal, 0.2, 0.78, 0.316, 18));                                        // dial
  g.add(box(0.06, 0.028, 0.006, std(colors.accent, { emissive: colors.accent, emissiveIntensity: 0.5 }), 0.02, 0.78, 0.315));   // display
  g.add(box(0.16, 0.05, 0.01, std(mix(body, 0x000000, 0.1), { roughness: 0.5 }), -0.18, 0.78, 0.313));   // detergent drawer / filter flap
  const porthole = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 8, 32), metal); porthole.position.set(0, 0.42, 0.31); porthole.castShadow = true; g.add(porthole);
  if (kind === 'washer') {
    g.add(disc(THREE, 0.2, 0.01, dark, 0, 0.42, 0.305, 24));                                            // the drum, seen through the glass
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 12), glassMat(THREE, 0x9fb4c7)); dome.scale.set(1, 1, 0.3); dome.position.set(0, 0.42, 0.32); dome.castShadow = false; g.add(dome);
  } else {
    g.add(disc(THREE, 0.2, 0.03, std(mix(body, 0x000000, 0.08), { roughness: 0.4 }), 0, 0.42, 0.33, 24));   // solid door
    for (let i = 0; i < 4; i++) g.add(box(0.28, 0.008, 0.006, dark, 0, 0.1 + i * 0.03, 0.304));       // vent grille
  }
  g.add(box(0.05, 0.12, 0.02, metal, 0.19, 0.42, 0.345));                                              // door handle
  return g;
}

registerProps({
  // ---------------------------------------------------------------------------------------------------------------
  // Freestanding oval bathtub — a tapered oval shell on an inset plinth, a shaded well, a rim-mounted filler at the
  // foot end and a folded towel over the front rim. w × d is the shell; the filler tops out at 0.8.
  'bathtub': {
    footprint: [1.7, 0.8], height: 0.8, params: ['w', 'd', 'color'], tags: ['bathroom'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 1.7, d = it.d || 0.8, g = group('Bathtub');
      const base = it.color ? hex(it.color) : colors.linen;
      const shell = ceramic(std, base), well = std(mix(base, 0x334155, 0.22), { roughness: 0.3 }), metal = chrome(std, colors.metal);
      g.add(oval(THREE, w / 2 * 0.9, d / 2 * 0.9, 0.04, std(mix(base, 0x000000, 0.18), { roughness: 0.5 }), 0, 0.02, 0, 0.98));   // plinth
      g.add(oval(THREE, w / 2, d / 2, 0.56, shell, 0, 0.32, 0, 0.9));                                   // shell, 0.04–0.6, narrowing to the foot
      g.add(oval(THREE, w / 2 - 0.08, d / 2 - 0.08, 0.02, well, 0, 0.595, 0));                          // the well
      const tx = -w / 2 + 0.16;                                                                          // filler on the rim at the foot end
      g.add(cyl(THREE, 0.014, 0.014, 0.2, metal, tx, 0.7, 0, 12));
      g.add(bar(THREE, 0.011, 0.18, metal, tx + 0.08, 0.79, 0, 'x'));
      g.add(cyl(THREE, 0.011, 0.011, 0.04, metal, tx + 0.16, 0.77, 0, 10));
      g.add(bar(THREE, 0.008, 0.08, metal, tx, 0.7, 0.05, 'z'));                                        // lever
      const towel = std(towelColor(colors, rng), { roughness: 0.95 }), twx = w / 2 - 0.5;               // folded over the front (+z) rim
      g.add(box(0.32, 0.05, 0.22, towel, twx, 0.625, d / 2 - 0.11));
      g.add(box(0.32, 0.26, 0.03, towel, twx, 0.48, d / 2 + 0.005));
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.85, 0, -0.4, 0.85, 0.6, 0.4], color: 'role:linen' },
      { shape: 'box', box: [-0.77, 0.58, -0.32, 0.77, 0.61, 0.32], color: '#aab4c3' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Shower cubicle — a low stone tray, a tiled back panel on the wall (−z), frameless glass on the other three
  // sides (the front is a fixed pane plus a sliding door with a bar handle under a top rail), a riser with a
  // rain head and a mixer. h is the glass height.
  'shower-cubicle': {
    footprint: [0.9, 0.9], height: 2.0, params: ['w', 'd', 'h'], tags: ['bathroom'],
    create(it, { THREE, std, box, group, colors, mix }) {
      const w = it.w || 0.9, d = it.d || 0.9, h = it.h || 2.0, g = group('Shower Cubicle');
      const metal = chrome(std, colors.metal), glass = glassMat(THREE), t = 0.012;
      g.add(box(w, 0.06, d, std(mix(colors.linen, 0x64748b, 0.25), { roughness: 0.4 }), 0, 0.03, 0));   // tray
      g.add(cyl(THREE, 0.045, 0.045, 0.006, metal, 0, 0.063, 0.1, 16));                                  // drain
      g.add(box(w, h, 0.02, std(colors.rug, { roughness: 0.35 }), 0, h / 2, -d / 2 + 0.01));            // tiled back panel
      const gh = h - 0.06, gy = 0.06 + gh / 2;
      for (const s of [-1, 1]) g.add(box(t, gh, d - 0.02 - t, glass, s * (w / 2 - t / 2), gy, (0.02 - t) / 2, false));   // side panes
      g.add(box(w * 0.45, gh, t, glass, -w / 2 + w * 0.225, gy, d / 2 - t / 2, false));                 // fixed front pane
      g.add(box(w * 0.55, gh, t, glass, w / 2 - w * 0.275, gy, d / 2 + t / 2, false));                  // sliding door, proud of the fixed pane
      g.add(box(w, 0.03, 0.03, metal, 0, h - 0.015, d / 2));                                            // top rail
      g.add(cyl(THREE, 0.01, 0.01, 0.3, metal, -w / 2 + w * 0.45 + 0.06, 1.1, d / 2 + t + 0.03, 10));   // door handle
      const bz = -d / 2 + 0.05;                                                                          // fittings on the back wall
      g.add(cyl(THREE, 0.012, 0.012, h - 0.2 - 1.05, metal, 0, (h - 0.2 + 1.05) / 2, bz, 10));          // riser
      g.add(box(0.16, 0.08, 0.05, metal, 0, 1.1, bz - 0.015));                                          // mixer
      g.add(bar(THREE, 0.01, 0.08, metal, 0, 1.1, bz + 0.05, 'z'));                                     // lever
      g.add(bar(THREE, 0.012, 0.32, metal, 0, h - 0.2, bz + 0.16, 'z'));                                // arm
      g.add(cyl(THREE, 0.11, 0.11, 0.02, metal, 0, h - 0.21, bz + 0.31, 24));                           // rain head
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.45, 0, -0.45, 0.45, 0.06, 0.45], color: '#cbd5e1' },
      { shape: 'box', box: [-0.45, 0, -0.45, 0.45, 2.0, -0.43], color: 'role:rug' },
      { shape: 'box', box: [0.44, 0.06, -0.43, 0.45, 2.0, 0.45], color: '#c9e6ea' },
      { shape: 'box', box: [-0.45, 0.06, 0.44, 0.45, 2.0, 0.45], color: '#c9e6ea' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Vanity sink — a two-drawer vanity on a recessed plinth under a stone counter, a vessel basin, a tall tap, a framed mirror on
  // the wall above (the back edge of the footprint is the wall), a hand towel and a soap bottle on the counter.
  'vanity-sink': {
    footprint: [0.9, 0.5], height: 1.9, params: ['w', 'd', 'color'], tags: ['bathroom'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 0.9, d = it.d || 0.5, g = group('Vanity Sink');
      const cab = it.color ? hex(it.color) : colors.cabinet;
      const cabMat = std(cab, { roughness: 0.55 }), front = std(mix(cab, 0xffffff, 0.08), { roughness: 0.5 });
      const stone = std(colors.linen, { roughness: 0.25 }), metal = chrome(std, colors.metal), bz = -d / 2;
      g.add(box(w - 0.08, 0.1, d - 0.1, std(mix(cab, 0x000000, 0.35), { roughness: 0.6 }), 0, 0.05, -0.03));   // recessed plinth
      g.add(box(w, 0.75, d - 0.03, cabMat, 0, 0.475, -0.015));                                          // carcass 0.1–0.85
      for (const y of [0.295, 0.665]) {
        g.add(box(w - 0.03, 0.35, 0.02, front, 0, y, d / 2 - 0.02));                                    // drawer front
        g.add(box(Math.min(0.3, w * 0.35), 0.012, 0.014, metal, 0, y + 0.11, d / 2 - 0.004));           // bar pull
      }
      g.add(box(w, 0.04, d, stone, 0, 0.87, 0));                                                        // counter, top 0.89
      g.add(oval(THREE, 0.21, 0.16, 0.12, ceramic(std, colors.linen), 0, 0.95, 0.02, 0.85, 28));        // vessel basin
      g.add(oval(THREE, 0.18, 0.13, 0.012, std(mix(colors.linen, 0x334155, 0.2), { roughness: 0.3 }), 0, 1.012, 0.02));
      g.add(cyl(THREE, 0.012, 0.012, 0.3, metal, 0, 1.04, bz + 0.08, 12));                              // tap riser
      g.add(bar(THREE, 0.01, 0.2, metal, 0, 1.19, bz + 0.18, 'z'));                                     // spout over the basin
      g.add(cyl(THREE, 0.01, 0.01, 0.05, metal, 0, 1.165, bz + 0.27, 10));
      g.add(box(w * 0.8 + 0.04, 0.74, 0.015, cabMat, 0, 1.53, bz + 0.0075));                            // mirror frame on the wall, top at 1.9
      g.add(box(w * 0.8, 0.7, 0.012, mirrorMat(std), 0, 1.53, bz + 0.021));
      if (w >= 0.8) g.add(box(0.22, 0.05, 0.15, std(towelColor(colors, rng), { roughness: 0.95 }), w / 2 - 0.14, 0.915, 0.08));   // hand towel
      g.add(cyl(THREE, 0.028, 0.028, 0.12, std(colors.accent, { roughness: 0.4 }), -w / 2 + 0.14, 0.95, 0.04, 14));   // soap bottle
      g.add(cyl(THREE, 0.008, 0.008, 0.03, metal, -w / 2 + 0.14, 1.025, 0.04, 8));
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.45, 0.1, -0.25, 0.45, 0.85, 0.235], color: 'role:cabinet' },
      { shape: 'box', box: [-0.45, 0.85, -0.25, 0.45, 0.89, 0.25], color: 'role:linen' },
      { shape: 'cyl', box: [-0.21, 0.89, -0.14, 0.21, 1.01, 0.18], color: 'role:linen' },
      { shape: 'box', box: [-0.38, 1.16, -0.25, 0.38, 1.9, -0.23], color: '#dbe4ee' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Toilet — close-coupled: a pedestal, an oval bowl with a closed seat and lid, the pan's back rising to the wall
  // (−z) under a cistern with a chrome flush button.
  'toilet': {
    footprint: [0.4, 0.7], height: 0.8, params: ['color'], tags: ['bathroom'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Toilet'), base = it.color ? hex(it.color) : colors.linen;
      const cer = ceramic(std, base), lid = std(mix(base, 0x000000, 0.06), { roughness: 0.35 }), metal = chrome(std, colors.metal);
      g.add(oval(THREE, 0.15, 0.2, 0.32, cer, 0, 0.16, 0.02, 0.85, 24));                              // pedestal, narrowing to the floor
      g.add(box(0.3, 0.44, 0.2, cer, 0, 0.22, -0.25));                                                  // the pan's back: floor to cistern, so the cistern never floats
      g.add(oval(THREE, 0.19, 0.27, 0.14, cer, 0, 0.36, 0.04, 0.8, 24));                                // bowl 0.29–0.43
      g.add(oval(THREE, 0.19, 0.27, 0.03, lid, 0, 0.445, 0.04, 1, 24));                                 // seat
      g.add(oval(THREE, 0.185, 0.26, 0.025, lid, 0, 0.472, 0.04, 1, 24));                               // lid
      g.add(box(0.38, 0.34, 0.17, cer, 0, 0.61, -0.265));                                               // cistern 0.44–0.78
      g.add(box(0.39, 0.02, 0.18, lid, 0, 0.79, -0.265));                                               // cistern lid
      g.add(cyl(THREE, 0.02, 0.02, 0.01, metal, 0.06, 0.805, -0.265, 14));                              // flush button
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.15, 0, -0.35, 0.15, 0.44, -0.15], color: 'role:linen' },
      { shape: 'cyl', box: [-0.15, 0, -0.18, 0.15, 0.32, 0.22], color: 'role:linen' },
      { shape: 'cyl', box: [-0.19, 0.29, -0.23, 0.19, 0.485, 0.31], color: 'role:linen' },
      { shape: 'box', box: [-0.19, 0.44, -0.35, 0.19, 0.8, -0.18], color: 'role:linen' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Towel rail — two wall brackets, a chrome bar, a towel folded over it. Back on the wall at z = 0; hangs at 0.72
  // (bar at 1.09) unless the spec gives y.
  'towel-rail': {
    footprint: [0.6, 0.14], height: 0.37, params: ['w', 'y', 'color'], tags: ['bathroom'],
    // softkit: the brackets and the bar are one chrome mesh, the towel one closed lens draped over the bar (drapeTowel): 2 meshes where the boxes were 8
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = softkit(THREE);
      const w = it.w || 0.6, g = group('Towel Rail'), y0 = mountY(it, 0.72), by = y0 + 0.37;
      const hard = new K.Acc();
      for (const s of [-1, 1]) { K.slab(hard, s * (w / 2 - 0.04), by, 0.005, 0.05, 0.05, 0.01); K.slab(hard, s * (w / 2 - 0.04), by, 0.045, 0.024, 0.024, 0.08); }
      K.strut(hard, [-w / 2, by, 0.09], [w / 2, by, 0.09], 0.012, 0.012, 12);
      put(g, hard, chrome(std, colors.metal, { vertexColors: true }), 'hardware', { receive: false });
      const col = it.color ? hex(it.color) : towelColor(colors, rng), r = splitRng(rng), tw = new K.Acc();
      drapeTowel(THREE, tw, { by, zb: 0.09, rb: 0.012, tw: w * 0.55, L1: 0.335, L2: 0.285, belly: 0.01, ph: r() * 6.28 });
      put(g, tw, softMat(ctx, col, { roughness: 0.96 }), 'towel');
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.3, 1.078, 0.078, 0.3, 1.102, 0.102], color: 'role:metal' },
      { shape: 'box', box: [-0.165, 0.755, 0.045, 0.165, 1.125, 0.135], color: 'role:accent' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Bath mat — a flat pile mat, a lighter inset reading as the pile; rug colour or the accent.
  'bath-mat': {
    footprint: [0.8, 0.5], height: 0.03, params: ['w', 'd', 'color'], tags: ['bathroom'],
    create(it, { std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 0.8, d = it.d || 0.5, g = group('Bath Mat');
      const c = it.color ? hex(it.color) : (rng() < 0.4 ? colors.accent : colors.rug);
      g.add(box(w, 0.018, d, std(c, { roughness: 1 }), 0, 0.009, 0, false));
      g.add(box(w - 0.06, 0.014, d - 0.06, std(mix(c, 0xffffff, 0.1), { roughness: 1 }), 0, 0.025, 0, false));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.4, 0, -0.25, 0.4, 0.03, 0.25], color: 'role:rug' }],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Mirror cabinet — a wall box with two mirrored doors and a chrome light ledge underneath. Back on the wall at
  // z = 0; mounts with its bottom edge at 1.15 unless the spec gives y.
  'mirror-cabinet': {
    footprint: [0.6, 0.14], height: 0.7, params: ['w', 'h', 'y', 'color'], tags: ['bathroom'],
    create(it, { std, box, group, colors, hex }) {
      const w = it.w || 0.6, h = it.h || 0.7, g = group('Mirror Cabinet');
      const y0 = mountY(it, 1.15), cab = std(it.color ? hex(it.color) : colors.cabinet, { roughness: 0.55 }), metal = chrome(std, colors.metal);
      g.add(box(w, h, 0.12, cab, 0, y0 + h / 2, 0.06));
      const dw = w / 2 - 0.008;
      for (const s of [-1, 1]) g.add(box(dw, h - 0.03, 0.014, mirrorMat(std), s * (dw / 2 + 0.004), y0 + h / 2, 0.127));
      g.add(box(w, 0.016, 0.14, metal, 0, y0 + 0.008, 0.07));                                            // light ledge
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.3, 1.15, 0, 0.3, 1.85, 0.12], color: 'role:cabinet' },
      { shape: 'box', box: [-0.3, 1.165, 0.12, 0.3, 1.835, 0.134], color: '#dbe4ee' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Washing machine — front loader: porthole with a glass dome over a dark drum, dial, display, detergent drawer.
  'washing-machine': {
    footprint: [0.6, 0.65], height: 0.85, params: ['color'], tags: ['bathroom', 'laundry', 'kitchen'],
    create(it, ctx) { return appliance('washer', it, ctx); },
    iso: [
      { shape: 'box', box: [-0.3, 0.03, -0.3, 0.3, 0.85, 0.3], color: 'role:linen' },
      { shape: 'box', box: [-0.29, 0.73, 0.3, 0.29, 0.83, 0.31], color: '#2a3140' },
      { shape: 'box', box: [-0.23, 0.19, 0.3, 0.23, 0.65, 0.38], color: '#2a3140' },
    ],
  },

  // Tumble dryer — the same carcass with a solid door and a vent grille; flat top and bottom so it stacks on the
  // washer (spec y: 0.85 — house-builder lifts the origin).
  'dryer': {
    footprint: [0.6, 0.65], height: 0.85, params: ['color', 'y'], tags: ['bathroom', 'laundry', 'kitchen'],
    create(it, ctx) { return appliance('dryer', it, ctx); },
    iso: [
      { shape: 'box', box: [-0.3, 0.03, -0.3, 0.3, 0.85, 0.3], color: 'role:linen' },
      { shape: 'box', box: [-0.29, 0.73, 0.3, 0.29, 0.83, 0.31], color: '#2a3140' },
      { shape: 'box', box: [-0.23, 0.19, 0.3, 0.23, 0.65, 0.35], color: '#cbd5e1' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Laundry basket — a tapered faceted rattan basket, open at the top (the weave is a two-sided open cylinder
  // over a base disc) with a rim and two side loops; inside, a heap of laundry just under the rim with a few
  // seeded bundles peeking over it.
  'laundry-basket': {
    footprint: [0.55, 0.45], height: 0.6, params: ['color'], tags: ['bathroom', 'bedroom', 'laundry'],
    create(it, { THREE, std, group, colors, hex, mix, rng }) {
      const g = group('Laundry Basket');
      const rattan = it.color ? hex(it.color) : mix(colors.wood, 0xd9b98a, 0.55);
      const weave = std(rattan, { roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), rim = std(mix(rattan, 0x000000, 0.2), { roughness: 0.8 });
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.54, 12, 1, true), weave);   // open-topped
      wall.position.y = 0.29; wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
      g.add(cyl(THREE, 0.185, 0.185, 0.02, rim, 0, 0.01, 0, 12));                                       // base
      g.add(ring(THREE, 0.22, 0.016, rim, 0, 0.565, 0, 12));
      for (const s of [-1, 1]) {                                                                         // side loops
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 12, Math.PI), rim);
        h.position.set(s * 0.225, 0.44, 0); h.rotation.z = -s * Math.PI / 2; h.castShadow = true; g.add(h);
      }
      const picks = [colors.linen, colors.fabric, colors.fabric2, colors.accent];
      g.add(cyl(THREE, 0.2, 0.19, 0.04, std(colors.linen, { roughness: 1 }), 0, 0.47, 0, 12));            // the heap, just under the rim (linen, so it never reads as a lid)
      const n = 3 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, r = 0.03 + rng() * 0.07;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.065 + rng() * 0.03, 8, 6), std(picks[Math.floor(rng() * picks.length)], { roughness: 1, flatShading: true }));
        b.position.set(Math.cos(a) * r, 0.54, Math.sin(a) * r); b.scale.y = 0.7; b.castShadow = true; g.add(b);
      }
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.22, 0, -0.22, 0.22, 0.56, 0.22], color: '#c9a26b' },
      { shape: 'blob', box: [-0.13, 0.5, -0.13, 0.13, 0.6, 0.13], color: 'role:linen' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Heated towel rail — a ladder radiator on four wall brackets, rungs in two runs with a gap, a towel over the
  // rung above the gap. Chrome unless the spec colours it (a painted rail). Bottom at 0.25 unless y is given.
  'heated-towel-rail': {
    footprint: [0.5, 0.11], height: 1.0, params: ['w', 'h', 'y', 'color'], tags: ['bathroom'],
    // softkit: uprights, rungs and brackets are one metal mesh, the towel one lens over the rung above the gap: 2 meshes where there were ~16
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = softkit(THREE);
      const w = it.w || 0.5, h = it.h || 1.0, g = group('Heated Towel Rail');
      const y0 = mountY(it, 0.25), metal = it.color ? std(hex(it.color), { roughness: 0.35, vertexColors: true }) : chrome(std, colors.metal, { vertexColors: true });
      const hard = new K.Acc();
      for (const s of [-1, 1]) K.strut(hard, [s * (w / 2 - 0.013), y0, 0.07], [s * (w / 2 - 0.013), y0 + h, 0.07], 0.013, 0.013, 10);   // uprights
      const n = Math.max(4, Math.round(h / 0.11)), rungs: number[] = [];
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; if (t > 0.42 && t < 0.58) continue; rungs.push(y0 + 0.05 + t * (h - 0.1)); }
      for (const y of rungs) K.strut(hard, [-(w / 2 - 0.02), y, 0.07], [w / 2 - 0.02, y, 0.07], 0.009, 0.009, 8, 1, 1, false);
      for (const [sx, ty] of [[-1, 0.15], [1, 0.15], [-1, 0.85], [1, 0.85]]) K.slab(hard, sx * (w / 2 - 0.013), y0 + ty * h, 0.03, 0.026, 0.026, 0.06);   // brackets
      put(g, hard, metal, 'hardware', { receive: false });
      const col = rng() < 0.5 ? colors.accent : colors.linen, ty = rungs[Math.floor(rungs.length / 2)], r = splitRng(rng), tw = new K.Acc();
      drapeTowel(THREE, tw, { by: ty, zb: 0.07, rb: 0.009, tw: w * 0.6, L1: 0.285, L2: 0.2, belly: 0.008, ph: r() * 6.28 });
      put(g, tw, softMat(ctx, col, { roughness: 0.96 }), 'towel');
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.25, 0.25, 0.057, 0.25, 1.25, 0.083], color: 'role:metal' },
      { shape: 'box', box: [-0.15, 0.565, 0.085, 0.15, 0.88, 0.11], color: 'role:accent' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Soap set — on a counter (surface prop): a wooden tray with a pump dispenser, a glass tumbler with a toothbrush,
  // and a soap dish with a bar.
  'soap-set': {
    footprint: [0.3, 0.16], height: 0.2, surface: true, params: ['color'], tags: ['bathroom', 'kitchen'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Soap Set'), metal = chrome(std, colors.metal), c = it.color ? hex(it.color) : colors.accent;
      g.add(box(0.3, 0.012, 0.16, std(colors.wood, { roughness: 0.5 }), 0, 0.006, 0));                    // tray
      g.add(cyl(THREE, 0.03, 0.03, 0.14, std(c, { roughness: 0.4 }), -0.1, 0.082, 0, 16));                // dispenser
      g.add(cyl(THREE, 0.008, 0.008, 0.035, metal, -0.1, 0.17, 0, 8));                                    // pump
      g.add(box(0.05, 0.012, 0.012, metal, -0.08, 0.19, 0));
      g.add(cyl(THREE, 0.026, 0.022, 0.09, glassMat(THREE), 0, 0.057, 0, 16, false));                     // tumbler
      const brush = cyl(THREE, 0.005, 0.005, 0.17, std(c, { roughness: 0.5 }), 0.012, 0.1, 0, 6); brush.rotation.z = -0.22; g.add(brush);
      g.add(box(0.09, 0.02, 0.07, ceramic(std, colors.linen), 0.1, 0.022, 0));                            // dish
      g.add(box(0.06, 0.02, 0.04, std(mix(colors.linen, c, 0.35), { roughness: 0.6 }), 0.1, 0.042, 0));   // soap
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.15, 0, -0.08, 0.15, 0.012, 0.08], color: 'role:wood' },
      { shape: 'cyl', box: [-0.13, 0.012, -0.03, -0.07, 0.19, 0.03], color: 'role:accent' },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Linen tower — a tall narrow cabinet: a cupboard below with a bar pull, open shelves above stacked with folded
  // towels in seeded colours. Back at −d/2 (the wall).
  'linen-tower': {
    footprint: [0.45, 0.38], height: 1.8, params: ['w', 'h', 'color'], tags: ['bathroom', 'laundry'],
    create(it, { std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 0.45, h = it.h || 1.8, d = 0.38, t = 0.02, g = group('Linen Tower');
      const cab = it.color ? hex(it.color) : colors.cabinet;
      const cabMat = std(cab, { roughness: 0.55 }), inner = std(mix(cab, 0xffffff, 0.12), { roughness: 0.6 }), metal = chrome(std, colors.metal);
      for (const s of [-1, 1]) g.add(box(t, h, d, cabMat, s * (w / 2 - t / 2), h / 2, 0));               // sides
      g.add(box(w - 2 * t, t, d, cabMat, 0, h - t / 2, 0));                                               // top
      g.add(box(w - 2 * t, h - t, 0.012, inner, 0, (h - t) / 2, -d / 2 + 0.006));                         // back
      g.add(box(w - 2 * t, 0.06, d - 0.02, cabMat, 0, 0.03, -0.01));                                      // plinth
      g.add(box(w - 2 * t - 0.006, 0.66, t, std(mix(cab, 0xffffff, 0.08), { roughness: 0.5 }), 0, 0.41, d / 2 - t / 2));   // cupboard door 0.08–0.74
      g.add(box(0.012, 0.16, 0.012, metal, w / 2 - 0.08, 0.41, d / 2 + 0.006));                           // bar pull
      const shelves = [0.76]; for (let y = 0.76 + 0.34; y < h - 0.2; y += 0.34) shelves.push(y);
      const picks = [colors.linen, colors.accent, colors.fabric2, colors.linen];
      for (const y of shelves) {
        g.add(box(w - 2 * t, t, d - 0.01, cabMat, 0, y, 0));
        for (let k = 0; k < 2; k++) g.add(box(w - 0.12, 0.05, d - 0.12, std(picks[Math.floor(rng() * picks.length)], { roughness: 0.95 }), 0, y + t / 2 + 0.025 + k * 0.05, 0.01));
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.225, 0, -0.19, 0.225, 1.8, 0.19], color: 'role:cabinet' },
      { shape: 'box', box: [-0.17, 0.78, -0.13, 0.17, 0.88, 0.13], color: 'role:linen' },
      { shape: 'box', box: [-0.17, 1.12, -0.13, 0.17, 1.22, 0.13], color: 'role:accent' },
    ],
  },
});

// =================================================================================================================
// Pass 4 (S3 compose): the freestanding tubs a spa bath is built round (clawfoot for the traditional styles, a
// modern soaking tub), a pedestal sink for small traditional baths and powder rooms, and a double vanity.
// =================================================================================================================
// an open freestanding tub: an elliptical wall (outside `outer`, inside enamel), a floor inside it, water at `water`,
// and a rolled rim (a tube round the ellipse) — the pieces a solid oval would hide
function openTub({ THREE, std }, { rx, rz, y0, y1, taper, outer, inner, water, rim = 0.03 }) {
  const g = new THREE.Group(), h = y1 - y0;
  const wall = (mat, s, side) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, taper, h, 40, 1, true), side === THREE.BackSide ? std(mat.color.getHex(), { roughness: mat.roughness, side }) : mat); m.scale.set(rx * s, 1, rz * s); m.position.y = y0 + h / 2; m.castShadow = true; m.receiveShadow = true; return m; };
  g.add(wall(outer, 1, THREE.FrontSide));
  g.add(wall(inner, 0.94, THREE.BackSide));
  const floor = oval(THREE, rx * 0.94 * taper, rz * 0.94 * taper, 0.02, inner, 0, y0 + 0.08, 0, 1, 32); g.add(floor);
  g.add(oval(THREE, rx * 0.9, rz * 0.9, 0.01, std(0xcfe0e6, { roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.7 }), 0, water, 0, 1, 36));
  const pts = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rx * 0.97, y1, Math.sin(a) * rz * 0.97)); }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, rim, 8, true), inner); tube.castShadow = true; g.add(tube);
  return g;
}

registerProps({
  // Clawfoot tub — a rolled-rim tub on four ball-and-claw feet, a standpipe tap at the +x end. Long axis along x;
  // color paints the outside of the shell (the inside stays enamel white).
  'clawfoot-tub': {
    footprint: [1.7, 0.78], height: 0.92, params: ['w', 'color'], tags: ['bathroom'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex } = ctx;
      const w = it.w || 1.7, g = group('Clawfoot Tub'), rx = w / 2 - 0.03, rz = 0.36;
      const metal = chrome(std, colors.metal);
      g.add(openTub(ctx, { rx, rz, y0: 0.17, y1: 0.68, taper: 0.82, outer: std(it.color ? hex(it.color) : colors.linen, { roughness: 0.3 }), inner: ceramic(std, colors.linen), water: 0.56 }));
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), metal); f.position.set(sx * (rx - 0.22), 0.05, sz * (rz - 0.1)); f.castShadow = true; g.add(f); g.add(cyl(THREE, 0.025, 0.035, 0.14, metal, sx * (rx - 0.22), 0.14, sz * (rz - 0.1), 10)); }
      g.add(cyl(THREE, 0.014, 0.014, 0.24, metal, rx - 0.05, 0.8, 0, 10));
      g.add(bar(THREE, 0.012, 0.14, metal, rx - 0.11, 0.91, 0, 'x'));
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.85, 0.1, -0.39, 0.85, 0.71, 0.39], color: 'role:linen' }],
  },
  // Soaking tub — a modern freestanding oval tub, thick-walled, a floor-standing filler at its +x front corner
  // (modern, scandi, spa baths). Long axis along x.
  'soaking-tub': {
    footprint: [1.65, 0.8], height: 0.95, params: ['w', 'color'], tags: ['bathroom'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex } = ctx;
      const w = it.w || 1.6, g = group('Soaking Tub'), rx = w / 2, rz = 0.4;
      const shell = ceramic(std, it.color ? hex(it.color) : colors.linen), metal = chrome(std, colors.metal);
      g.add(openTub(ctx, { rx, rz, y0: 0, y1: 0.58, taper: 0.9, outer: shell, inner: ceramic(std, colors.linen), water: 0.46, rim: 0.035 }));
      g.add(cyl(THREE, 0.02, 0.02, 0.95, metal, rx - 0.02, 0.475, rz - 0.04, 10));
      g.add(bar(THREE, 0.012, 0.16, metal, rx - 0.08, 0.94, rz - 0.04, 'x'));
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.8, 0, -0.4, 0.8, 0.58, 0.4], color: 'role:linen' }],
  },
  // Pedestal sink — a basin on a flared column, the tap behind, a mirror above (cottage, farmhouse, powder rooms).
  'pedestal-sink': {
    footprint: [0.56, 0.46], height: 1.8, params: ['color'], tags: ['bathroom'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Pedestal Sink'), por = ceramic(std, it.color ? hex(it.color) : colors.linen), metal = chrome(std, colors.metal), bz = -0.23;
      const profile = [[0.0, 0.0], [0.13, 0.0], [0.1, 0.06], [0.075, 0.3], [0.08, 0.62], [0.12, 0.72], [0.0, 0.72]].map(([x, y]) => new THREE.Vector2(x, y));
      const col = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), por); col.position.z = -0.05; col.castShadow = true; g.add(col);
      g.add(box(0.56, 0.12, 0.44, por, 0, 0.8, 0));                                                  // basin block
      g.add(oval(THREE, 0.2, 0.14, 0.012, std(mix(colors.linen, 0x334155, 0.2), { roughness: 0.3 }), 0, 0.862, 0.03));
      g.add(cyl(THREE, 0.012, 0.012, 0.14, metal, 0, 0.93, bz + 0.07, 10));
      g.add(bar(THREE, 0.009, 0.12, metal, 0, 0.99, bz + 0.13, 'z'));
      g.add(disc(THREE, 0.24, 0.02, std(colors.metal, { metalness: 0.7, roughness: 0.35 }), 0, 1.5, bz + 0.01, 32));   // round mirror
      g.add(disc(THREE, 0.22, 0.012, mirrorMat(std), 0, 1.5, bz + 0.022, 32));
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.13, 0, -0.18, 0.13, 0.74, 0.08], color: 'role:linen' }, { shape: 'box', box: [-0.28, 0.74, -0.22, 0.28, 0.86, 0.22], color: 'role:linen' }, { shape: 'blob', box: [-0.24, 1.26, -0.23, 0.24, 1.74, -0.21], color: '#dbe4ee' }],
  },
  // Double vanity — a wide cabinet with two basins, two taps and one long mirror (primary ensuites). w, color.
  'double-vanity': {
    footprint: [1.5, 0.52], height: 1.9, params: ['w', 'color'], tags: ['bathroom'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = it.w || 1.5, d = 0.52, g = group('Double Vanity');
      const cab = it.color ? hex(it.color) : colors.cabinet, cabMat = std(cab, { roughness: 0.55 }), front = std(mix(cab, 0xffffff, 0.08), { roughness: 0.5 });
      const stone = std(colors.linen, { roughness: 0.25 }), metal = chrome(std, colors.metal), bz = -d / 2;
      g.add(box(w - 0.08, 0.1, d - 0.1, std(mix(cab, 0x000000, 0.35), { roughness: 0.6 }), 0, 0.05, -0.03));
      g.add(box(w, 0.75, d - 0.03, cabMat, 0, 0.475, -0.015));
      for (const s of [-1, 1]) for (const y of [0.295, 0.665]) {
        g.add(box(w / 2 - 0.03, 0.35, 0.02, front, s * w / 4, y, d / 2 - 0.02));
        g.add(box(0.2, 0.012, 0.014, metal, s * w / 4, y + 0.11, d / 2 - 0.004));
      }
      g.add(box(w, 0.04, d, stone, 0, 0.87, 0));
      for (const s of [-1, 1]) {
        const x = s * w / 4;
        g.add(oval(THREE, 0.2, 0.15, 0.11, ceramic(std, colors.linen), x, 0.945, 0.02, 0.85, 28));
        g.add(cyl(THREE, 0.012, 0.012, 0.3, metal, x, 1.04, bz + 0.08, 12));
        g.add(bar(THREE, 0.01, 0.2, metal, x, 1.19, bz + 0.18, 'z'));
      }
      g.add(box(w * 0.9 + 0.04, 0.74, 0.015, cabMat, 0, 1.53, bz + 0.0075));
      g.add(box(w * 0.9, 0.7, 0.012, mirrorMat(std), 0, 1.53, bz + 0.021));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.75, 0.1, -0.26, 0.75, 0.85, 0.245], color: 'role:cabinet' }, { shape: 'box', box: [-0.75, 0.85, -0.26, 0.75, 0.89, 0.26], color: 'role:linen' }, { shape: 'box', box: [-0.7, 1.16, -0.26, 0.7, 1.9, -0.24], color: '#dbe4ee' }],
  },

  // Towel ladder — a floor-standing ladder rack leaning on the wall, a towel over one rung and another over a lower one
  // (the towel rail's alternative: farmhouse, cottage, tropical, scandi). Its back is at z = −d/2 at the top.
  'towel-ladder': {
    footprint: [0.55, 0.32], height: 1.6, params: ['color'], tags: ['bathroom'],
    // softkit: the two stiles and six rungs are one timber mesh, each towel one lens draped over its rung (two colours): 3 meshes where there were 14.
    // The stiles lean the way the rungs step (foot forward, top to the wall).
    create(it, ctx) {
      const { THREE, std, group, colors, hex, rng } = ctx, K = softkit(THREE);
      const w = 0.5, g = group('Towel Ladder'), wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.55, vertexColors: true });
      const hard = new K.Acc();
      for (const s of [-1, 1]) K.strut(hard, [s * w / 2, 0.02, 0.15], [s * w / 2, 1.6, -0.15], 0.018, 0.018, 10);
      const rungAt = (t: number) => [0.02 + 1.58 * t, 0.15 - 0.3 * t] as const;
      for (const t of [0.12, 0.3, 0.48, 0.66, 0.84, 0.97]) { const [y, z] = rungAt(t); K.strut(hard, [-w / 2, y, z], [w / 2, y, z], 0.011, 0.011, 8, 1, 1, false); }
      put(g, hard, wood, 'hardware');
      const c1 = towelColor(colors, rng), c2 = c1 === colors.accent ? colors.fabric2 : colors.accent, r = splitRng(rng);
      [[0.66, 0.52, c1], [0.3, 0.42, c2]].forEach(([t, len, col]: any) => {
        const [y, z] = rungAt(t), tw = new K.Acc();
        drapeTowel(THREE, tw, { by: y, zb: z, rb: 0.011, tw: w * 0.8, L1: len, L2: len * 0.85 - 0.03, belly: 0.008 + r() * 0.004, ph: r() * 6.28, cols: 5 });
        put(g, tw, softMat(ctx, col, { roughness: 0.96 }), 'towel');
      });
      return g;
    },
    iso: [{ shape: 'box', box: [-0.25, 0, -0.15, 0.25, 1.6, 0.15], color: 'role:wood' }],
  },
});
