// Office — the working room: a standing desk with a monitor arm, a filing cabinet, a printer, a whiteboard, a short
// server rack, twin screens on an arm, a stage keyboard, a turntable, a TV stand, a projector, a laptop, a pin
// board. Contract: index.js; decor.js is the worked example.
//   • Every prop's origin is the floor centre of its footprint (the surface centre for surface: true props) and it
//     faces SOUTH (+z) at rot 0: drawer fronts, keys and screens open toward +z, a wall-mounted prop has the wall
//     behind it at −z (back at z = 0, growing into +z).
//   • Wall-mounted props (whiteboard, pin-board) take `y` as the mount height of the piece's CENTRE (like wall-tv /
//     wall-art). house-builder and the iso twin lift the origin by it.y themselves, so with y set the piece is
//     centred on the local origin; without it (the sheet, the catalog, a spec that leaves it out) a per-prop default
//     (1.2 / 1.4) is applied here. The iso hints are written for that no-y case.
//   • Screens are one material: dark, glossy, a faint indigo glow — no lights, no textures.
//   • Big surfaces take role colours (wood, cabinet, linen, metal, trim, accent, fabric) or it.color; only LEDs,
//     lenses, cork, pins and sticky notes are literals. Seeded variation comes from ctx.rng — never Math.random.
//   • None of the dark literals below is one of the material kit's role keys (0x0f172a / 0x1e293b / 0x334155 …),
//     so kit.theme() leaves bezels and rack faces dark whatever the house's cabinet colour is.
import { registerProps } from './registry.js';

// ---- small builders shared by the props below
const cyl = (THREE, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
};
// a cylinder between two points (arms, stand bars, a tonearm)
const strut = (THREE, a, b, r, mat, seg = 8) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; return m;
};
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
// every display in this module: dark glass with a faint indigo glow
const screenMat = std => std(0x0b1220, { roughness: 0.12, metalness: 0.3, emissive: 0x1e3a8a, emissiveIntensity: 0.22 });
const bezelMat = std => std(0x111827, { roughness: 0.4, metalness: 0.3 });
const darkPlastic = (std, extra = {}) => std(0x1f2937, { roughness: 0.55, ...extra });
// brushed aluminium (the task chair's metal); colors.metal with metalness > 0.5 stays metal through kit.theme()
const alu = std => std(0x94a3b8, { metalness: 0.85, roughness: 0.25 });
const steel = (std, colors) => std(colors.metal, { metalness: 0.8, roughness: 0.3 });
// a screen: bezel slab + glass face, centred at (x, y, z), face toward +z
function screen(g, { std, box }, w, h, x, y, z, t = 0.025) {
  g.add(box(w, h, t, bezelMat(std), x, y, z));
  g.add(box(w - 0.02, h - 0.02, 0.006, screenMat(std), x, y, z + t / 2 + 0.002));
}

registerProps({
  // ---- filing cabinet: an enamelled steel pedestal, drawer fronts toward +z with bar pulls and label slots
  'filing-cabinet': {
    footprint: [0.45, 0.63], height: 1.05, params: ['w', 'd', 'h', 'drawers', 'color'], tags: ['office', 'study'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const w = it.w || 0.45, d = it.d || 0.6, h = it.h || 1.05, n = Math.max(1, Math.min(5, it.drawers | 0 || 3)), g = group('Filing Cabinet');
      const body = std(it.color ? hex(it.color) : colors.cabinet, { roughness: 0.4, metalness: 0.3 });
      const plinth = 0.06;
      g.add(box(w - 0.04, plinth, d - 0.06, darkPlastic(std), 0, plinth / 2, -0.02));                 // recessed plinth
      g.add(box(w, h - plinth, d - 0.02, body, 0, plinth + (h - plinth) / 2, -0.01));               // carcass
      const dh = (h - plinth - 0.02) / n, pull = steel(std, colors), label = std(colors.linen, { roughness: 0.6 });
      for (let i = 0; i < n; i++) {
        const y = plinth + 0.01 + (i + 0.5) * dh;
        g.add(box(w - 0.03, dh - 0.015, 0.02, body, 0, y, d / 2 - 0.01));                          // drawer front
        g.add(box(Math.min(0.16, w * 0.35), 0.018, 0.02, pull, 0, y + dh * 0.32, d / 2 + 0.01));   // bar pull
        g.add(box(0.05, 0.022, 0.006, label, -w * 0.3, y + dh * 0.32, d / 2 + 0.003));            // label slot
      }
      const lock = cyl(THREE, 0.011, 0.011, 0.006, alu(std), w * 0.3, h - 0.035, d / 2 + 0.003, 10); lock.rotation.x = Math.PI / 2; g.add(lock);   // lock
      return g;
    },
    iso: [{ shape: 'box', box: [-0.225, 0, -0.3, 0.225, 1.05, 0.3], color: 'role:cabinet' }, { shape: 'box', box: [-0.08, 0.32, 0.3, 0.08, 0.34, 0.32], color: '#94a3b8' }, { shape: 'box', box: [-0.08, 0.65, 0.3, 0.08, 0.67, 0.32], color: '#94a3b8' }],
  },

  // ---- printer (on a surface): a desktop inkjet, paper standing in the rear feed, output tray out the front,
  // a small control panel with a lit display
  'printer': {
    footprint: [0.44, 0.48], height: 0.32, surface: true, params: ['color'], tags: ['office', 'study'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Printer');
      const shell = std(it.color ? hex(it.color) : mix(colors.linen, 0x64748b, 0.22), { roughness: 0.5 });
      const dark = darkPlastic(std), paper = std(colors.linen, { roughness: 0.9 });
      // the body sits back of the origin so the output tray's overhang keeps the footprint centred (z −0.24 … 0.24)
      const b = group('Body'); b.position.z = -0.06; g.add(b);
      b.add(box(0.44, 0.16, 0.32, shell, 0, 0.08, -0.02));                                        // body, on the surface
      b.add(box(0.4, 0.03, 0.24, dark, 0, 0.175, -0.04));                                          // scanner lid (stops short of the front)
      b.add(box(0.34, 0.03, 0.005, dark, -0.03, 0.06, 0.142));                                     // output slot
      b.add(box(0.28, 0.008, 0.16, shell, -0.03, 0.045, 0.22));                                    // output tray
      b.add(box(0.21, 0.0025, 0.14, paper, -0.03, 0.051, 0.22));                                   // a printed sheet
      const feed = box(0.24, 0.16, 0.012, dark, 0, 0.24, -0.15); feed.rotation.x = -0.22; b.add(feed);   // rear feed, leaning back
      const sheet = box(0.21, 0.15, 0.004, paper, 0, 0.245, -0.14); sheet.rotation.x = -0.22; b.add(sheet);
      b.add(box(0.12, 0.012, 0.05, dark, 0.13, 0.166, 0.11));                                      // control panel, on the body in front of the lid
      b.add(box(0.06, 0.004, 0.03, screenMat(std), 0.11, 0.174, 0.11));                            // its display
      b.add(cyl(THREE, 0.008, 0.008, 0.004, std(0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 1.2 }), 0.175, 0.174, 0.11, 10));   // power light
      return g;
    },
    iso: [{ shape: 'box', box: [-0.22, 0, -0.24, 0.22, 0.16, 0.08], color: '#e2e8f0' }, { shape: 'box', box: [-0.2, 0.16, -0.22, 0.2, 0.19, 0.02], color: '#1f2937' }, { shape: 'box', box: [-0.12, 0.16, -0.23, 0.12, 0.32, -0.2], color: '#334155' }, { shape: 'box', box: [-0.17, 0.04, 0.08, 0.11, 0.05, 0.24], color: '#e2e8f0' }],
  },

  // ---- standing desk: a sit-stand frame at 1.1 m, two telescoping T-legs on skid feet, a keypad under the front
  // edge, a monitor arm clamped to the back edge, keyboard and mouse on top. Not the hero walnut desk.
  'standing-desk': {
    footprint: [1.4, 0.7], height: 1.68, params: ['w', 'd', 'h', 'color'], tags: ['office', 'study'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const w = it.w || 1.4, d = it.d || 0.7, h = it.h || 1.1, g = group('Standing Desk');
      const top = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.45 }), frame = steel(std, colors);
      g.add(box(w, 0.03, d, top, 0, h - 0.015, 0));                                                // desktop
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - 0.22);
        g.add(box(0.08, 0.03, d - 0.12, frame, x, 0.015, 0));                                      // skid foot
        g.add(box(0.08, 0.5, 0.08, frame, x, 0.28, 0));                                            // lower column
        g.add(box(0.06, h - 0.55, 0.06, frame, x, 0.53 + (h - 0.55) / 2 - 0.015, 0));              // upper (telescoping) column
        g.add(box(0.12, 0.03, 0.4, frame, x, h - 0.045, 0));                                       // top bracket
      }
      g.add(box(w - 0.6, 0.04, 0.06, frame, 0, h - 0.05, -0.12));                                  // crossbar
      g.add(box(0.1, 0.02, 0.06, darkPlastic(std), w / 2 - 0.35, h - 0.04, d / 2 - 0.05));         // height keypad
      // monitor arm: a clamp on the back edge, a post, an arm reaching forward, one screen
      const zc = -d / 2 + 0.07;
      g.add(box(0.06, 0.1, 0.07, frame, 0, h + 0.02, zc));                                         // clamp
      g.add(cyl(THREE, 0.016, 0.016, 0.36, frame, 0, h + 0.24, zc, 12));                           // post
      g.add(strut(THREE, [0, h + 0.4, zc], [0, h + 0.4, zc + 0.16], 0.014, frame));                // arm
      screen(g, { std, box }, 0.62, 0.36, 0, h + 0.4, zc + 0.18);
      g.add(box(0.42, 0.014, 0.14, darkPlastic(std), -0.06, h + 0.007, 0.13));                     // keyboard
      g.add(box(0.06, 0.03, 0.1, darkPlastic(std), 0.3, h + 0.015, 0.13));                         // mouse
      return g;
    },
    iso: [{ shape: 'box', box: [-0.7, 1.07, -0.35, 0.7, 1.1, 0.35], color: 'role:wood' }, { shape: 'box', box: [-0.52, 0, -0.29, -0.44, 1.07, 0.29], color: 'role:metal' }, { shape: 'box', box: [0.44, 0, -0.29, 0.52, 1.07, 0.29], color: 'role:metal' }, { shape: 'box', box: [-0.31, 1.32, -0.11, 0.31, 1.68, -0.08], color: '#111827' }],
  },

  // ---- whiteboard (wall-mounted): an aluminium-framed board with a marker tray, a few seeded strokes on it.
  // Back at z = 0; `y` is the centre height (default 1.2)
  'whiteboard': {
    footprint: [1.2, 0.07], height: 0.92, params: ['w', 'h', 'y', 'color'], tags: ['office', 'study', 'kids'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const w = it.w || 1.2, h = it.h || 0.9, cy = it.y !== undefined ? 0 : 1.2, g = group('Whiteboard');
      const rail = alu(std), bar = 0.025, depth = 0.03;
      g.add(box(w, bar, depth, rail, 0, cy + h / 2 - bar / 2, depth / 2));
      g.add(box(w, bar, depth, rail, 0, cy - h / 2 + bar / 2, depth / 2));
      g.add(box(bar, h - 2 * bar, depth, rail, -w / 2 + bar / 2, cy, depth / 2));
      g.add(box(bar, h - 2 * bar, depth, rail, w / 2 - bar / 2, cy, depth / 2));
      g.add(box(w - 2 * bar, h - 2 * bar, 0.02, std(it.color ? hex(it.color) : colors.linen, { roughness: 0.2, metalness: 0.05 }), 0, cy, 0.015));   // the board
      // three strokes: a heading line, a box, a tick of accent — jittered per item
      const ink = [std(colors.accent, { roughness: 0.8 }), std(colors.fabric, { roughness: 0.8 }), std(0xdc2626, { roughness: 0.8 })];
      const z = 0.027, ox = (rng() - 0.5) * 0.1, oy = (rng() - 0.5) * 0.06, cw = w - 0.2;
      g.add(box(cw * 0.42, 0.012, 0.004, pick(rng, ink), -cw * 0.22 + ox, cy + h * 0.3 + oy, z));
      g.add(box(cw * 0.3, 0.012, 0.004, pick(rng, ink), -cw * 0.28 + ox, cy + h * 0.14 + oy, z));
      g.add(box(0.012, h * 0.28, 0.004, pick(rng, ink), cw * 0.16 + ox, cy - h * 0.02 + oy, z));
      g.add(box(0.012, h * 0.28, 0.004, pick(rng, ink), cw * 0.38 + ox, cy - h * 0.02 + oy, z));
      g.add(box(cw * 0.22, 0.012, 0.004, pick(rng, ink), cw * 0.27 + ox, cy + h * 0.12 + oy, z));
      // marker tray with two markers and an eraser
      const ty = cy - h / 2 - 0.01;
      g.add(box(w * 0.55, 0.02, 0.06, rail, 0, ty, 0.04));
      for (const [i, m] of [[0, ink[0]], [1, ink[2]]]) { const mk = cyl(THREE, 0.009, 0.009, 0.13, m, -w * 0.18 + i * 0.16, ty + 0.019, 0.045, 10); mk.rotation.z = Math.PI / 2; g.add(mk); }
      g.add(box(0.1, 0.03, 0.045, darkPlastic(std), w * 0.16, ty + 0.025, 0.045));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.6, 0.75, 0, 0.6, 1.65, 0.03], color: '#94a3b8' }, { shape: 'box', box: [-0.57, 0.78, 0.02, 0.57, 1.62, 0.035], color: 'role:linen' }, { shape: 'box', box: [-0.33, 0.73, 0.01, 0.33, 0.75, 0.07], color: '#94a3b8' }],
  },

  // ---- server rack: a short 12U enclosure on casters, open front, a stack of 1U/2U units each with a lit LED
  // strip (seeded colour and brightness, so a row reads as blinking)
  'server-rack': {
    footprint: [0.6, 0.8], height: 0.68, params: ['units', 'color'], tags: ['office', 'study', 'garage'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const U = 0.0445, n = Math.max(6, Math.min(24, it.units | 0 || 12)), w = 0.6, d = 0.8, g = group('Server Rack');
      const frame = std(it.color ? hex(it.color) : colors.trim, { roughness: 0.4, metalness: 0.6 });
      const face = darkPlastic(std, { roughness: 0.45 });
      const base = 0.1, railTop = base + n * U;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(cyl(THREE, 0.03, 0.03, base - 0.04, face, sx * (w / 2 - 0.08), (base - 0.04) / 2, sz * (d / 2 - 0.1), 12));   // casters, floor to base panel
      g.add(box(w, 0.04, d, frame, 0, base - 0.02, 0));                                            // base panel
      g.add(box(w, 0.04, d, frame, 0, railTop + 0.02, 0));                                         // top panel
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.04, n * U, 0.04, frame, sx * (w / 2 - 0.02), base + n * U / 2, sz * (d / 2 - 0.02)));   // posts
      for (const sx of [-1, 1]) g.add(box(0.015, n * U, d - 0.08, frame, sx * (w / 2 - 0.0075), base + n * U / 2, 0));   // side panels — the enclosure is one colour (trim, or it.color)
      // the units, bottom up: a 2U UPS, then 1U/2U servers with a patch panel and a switch near the top
      const leds = [0x22c55e, 0x22c55e, 0x3b82f6, 0xf59e0b, 0x22c55e];
      let u = 0, k = 0;
      while (u < n && k < 20) {
        const size = u === 0 ? 2 : (rng() < 0.4 ? 2 : 1), uh = Math.min(size, n - u) * U;   // ~9 units for 12U, ≈ 33 meshes
        const y = base + (u + Math.min(size, n - u) / 2) * U;
        g.add(box(w - 0.1, uh - 0.006, d - 0.2, face, 0, y, 0.02));                                // chassis, front flush with the posts
        const c = pick(rng, leds);
        g.add(box(0.05, 0.006, 0.004, std(c, { emissive: c, emissiveIntensity: 1.2 + rng() * 1.6 }), -w / 2 + 0.12, y, d / 2 - 0.079));   // LED strip
        if (size === 1 && k % 2 === 0) g.add(box(0.18, 0.008, 0.004, std(0x374151, { roughness: 0.3 }), 0.06, y, d / 2 - 0.079));         // port row
        u += size; k++;
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.3, 0.06, -0.4, 0.3, 0.68, 0.4], color: 'role:trim' }, { shape: 'box', box: [-0.25, 0.1, 0.3, 0.25, 0.63, 0.4], color: '#1f2937' }, { shape: 'box', box: [-0.2, 0.2, 0.4, -0.14, 0.21, 0.41], color: '#22c55e' }],
  },

  // ---- dual monitor arm (on a surface): a clamp at the back edge, one post, two arms, two screens toed in
  'dual-monitor-arm': {
    footprint: [1.1, 0.3], height: 0.45, surface: true, params: ['color'], tags: ['office', 'study'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Dual Monitor Arm');
      const metal = it.color ? std(hex(it.color), { metalness: 0.8, roughness: 0.3 }) : steel(std, colors);
      const zc = -0.12, sw = 0.54, sh = 0.32, toe = 0.2, cy = 0.29;   // screens' bottom edge ≈ 0.13 above the desk
      g.add(box(0.1, 0.05, 0.1, metal, 0, 0.025, zc));                                              // clamp block
      g.add(cyl(THREE, 0.016, 0.016, cy - 0.04, metal, 0, 0.05 + (cy - 0.04) / 2, zc, 12));        // post
      for (const sx of [-1, 1]) {
        const x = sx * 0.28, z = zc + 0.1;
        g.add(strut(THREE, [0, cy, zc], [x * 0.9, cy, z - 0.02], 0.014, metal));                    // arm
        const s = group('Screen'); s.position.set(x, cy, z); s.rotation.y = -sx * toe;
        screen(s, { std, box }, sw, sh, 0, 0, 0);
        g.add(s);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.55, 0.13, -0.06, -0.01, 0.45, -0.02], color: '#111827' }, { shape: 'box', box: [0.01, 0.13, -0.06, 0.55, 0.45, -0.02], color: '#111827' }, { shape: 'cyl', box: [-0.02, 0, -0.14, 0.02, 0.29, -0.1], color: 'role:metal' }],
  },

  // ---- keyboard piano: a stage keyboard on an X-stand, keys toward +z, a music rest behind
  'keyboard-piano': {
    footprint: [1.3, 0.44], height: 0.96, params: ['w', 'color'], tags: ['office', 'living', 'kids', 'studio'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const w = it.w || 1.3, g = group('Keyboard Piano');
      const body = std(it.color ? hex(it.color) : mix(colors.cabinet, 0x111827, 0.6), { roughness: 0.45 });
      const stand = steel(std, colors), white = std(colors.linen, { roughness: 0.35 }), black = std(0x111827, { roughness: 0.4 });
      for (const sx of [-1, 1]) {                                                                  // X-stand: two crossed bars a side
        const x = sx * (w / 2 - 0.2);
        g.add(box(0.03, 0.03, 0.44, stand, x, 0.015, 0));                                          // foot
        g.add(strut(THREE, [x, 0.03, 0.2], [x, 0.64, -0.13], 0.014, stand));
        g.add(strut(THREE, [x, 0.03, -0.2], [x, 0.64, 0.13], 0.014, stand));
        g.add(box(0.03, 0.03, 0.3, stand, x, 0.655, 0));                                           // top rail
      }
      g.add(box(w, 0.08, 0.34, body, 0, 0.71, 0));                                                 // the instrument
      const kw = w - 0.14, kz = 0.09;
      g.add(box(kw, 0.018, 0.15, white, 0, 0.759, kz));                                            // white keys
      const octaves = Math.max(3, Math.round(kw / 0.232)), ow = kw / octaves, wk = ow / 7;
      for (let o = 0; o < octaves; o++) {
        const x0 = -kw / 2 + o * ow;
        g.add(box(wk * 1.7, 0.012, 0.085, black, x0 + wk * 1.5, 0.774, kz - 0.03));                // the pair
        g.add(box(wk * 2.7, 0.012, 0.085, black, x0 + wk * 5.0, 0.774, kz - 0.03));                // the triple
      }
      g.add(box(kw, 0.006, 0.1, black, 0, 0.753, -0.1));                                           // control panel
      for (let i = 0; i < 4; i++) g.add(cyl(THREE, 0.011, 0.011, 0.012, alu(std), -kw / 2 + 0.06 + i * 0.05, 0.762, -0.1, 10));   // knobs
      g.add(box(0.08, 0.004, 0.03, screenMat(std), kw * 0.2, 0.759, -0.1));                        // display
      const rest = box(0.5, 0.2, 0.008, black, 0, 0.855, -0.14); rest.rotation.x = -0.3; g.add(rest);   // music rest
      return g;
    },
    iso: [{ shape: 'box', box: [-0.65, 0.67, -0.17, 0.65, 0.75, 0.17], color: '#1f2937' }, { shape: 'box', box: [-0.58, 0.75, 0.01, 0.58, 0.77, 0.17], color: 'role:linen' }, { shape: 'box', box: [-0.47, 0, -0.02, -0.43, 0.67, 0.02], color: 'role:metal' }, { shape: 'box', box: [0.43, 0, -0.02, 0.47, 0.67, 0.02], color: 'role:metal' }],
  },

  // ---- record player (on a surface): a plinth, platter, a record with a coloured label, tonearm, two knobs
  'record-player': {
    footprint: [0.45, 0.36], height: 0.11, surface: true, params: ['color'], tags: ['office', 'living', 'bedroom', 'studio'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const g = group('Record Player');
      const plinth = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.4 }), metal = alu(std);
      g.add(box(0.45, 0.06, 0.36, plinth, 0, 0.03, 0));
      g.add(cyl(THREE, 0.145, 0.145, 0.012, darkPlastic(std), -0.04, 0.066, 0.01, 36));            // platter
      g.add(cyl(THREE, 0.15, 0.15, 0.004, std(0x0b0f19, { roughness: 0.2, metalness: 0.2 }), -0.04, 0.074, 0.01, 40));   // the record
      g.add(cyl(THREE, 0.05, 0.05, 0.002, std(pick(rng, [colors.accent, colors.fabric, 0xeab308, 0xdc2626, 0xf8fafc]), { roughness: 0.7 }), -0.04, 0.077, 0.01, 24));   // label
      g.add(cyl(THREE, 0.004, 0.004, 0.02, metal, -0.04, 0.08, 0.01, 8));                           // spindle
      g.add(cyl(THREE, 0.028, 0.028, 0.03, metal, 0.17, 0.075, -0.11, 16));                         // tonearm pivot
      g.add(strut(THREE, [0.17, 0.095, -0.11], [0.04, 0.088, 0.05], 0.005, metal));                 // tonearm
      g.add(box(0.024, 0.012, 0.03, darkPlastic(std), 0.035, 0.084, 0.055));                       // headshell
      for (const x of [0.15, 0.19]) g.add(cyl(THREE, 0.011, 0.011, 0.012, metal, x, 0.066, 0.13, 12));   // knobs
      return g;
    },
    iso: [{ shape: 'box', box: [-0.225, 0, -0.18, 0.225, 0.06, 0.18], color: 'role:wood' }, { shape: 'cyl', box: [-0.19, 0.06, -0.14, 0.11, 0.078, 0.16], color: '#0b0f19' }],
  },

  // ---- TV stand: a low unit on tapered legs, a closed cabinet at each end, an open centre bay with a console
  // in it, and (tv: true, the default) a flat TV standing on top
  'tv-stand': {
    footprint: [1.6, 0.44], height: 1.06, params: ['w', 'd', 'color', 'tv'], tags: ['office', 'living', 'bedroom', 'kids'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const w = it.w || 1.6, d = it.d || 0.42, tv = it.tv !== false && it.tv !== 'false', g = group('TV Stand');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.45 }), door = std(colors.cabinet, { roughness: 0.5 });
      const legMat = steel(std, colors), legH = 0.12, ch = 0.36, cw = w * 0.3;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(cyl(THREE, 0.012, 0.02, legH, legMat, sx * (w / 2 - 0.08), legH / 2, sz * (d / 2 - 0.08), 10));
      g.add(box(w, 0.03, d, wood, 0, legH + 0.015, 0));                                            // bottom panel
      g.add(box(w, ch, 0.02, wood, 0, legH + ch / 2, -d / 2 + 0.01));                              // back panel
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - cw / 2);
        g.add(box(cw, ch - 0.03, d, wood, x, legH + 0.03 + (ch - 0.03) / 2, 0));                   // end cabinet
        g.add(box(cw - 0.03, ch - 0.06, 0.02, door, x, legH + ch / 2 + 0.005, d / 2 + 0.01));      // its door
        g.add(box(0.012, 0.1, 0.02, legMat, x - sx * (cw / 2 - 0.05), legH + ch / 2, d / 2 + 0.03));   // pull
      }
      g.add(box(w - 2 * cw, 0.02, d - 0.05, wood, 0, legH + ch / 2 + 0.02, -0.01));                // mid shelf in the open bay
      g.add(box(0.34, 0.055, 0.26, darkPlastic(std), 0, legH + 0.03 + 0.0275, 0.02));              // a console / receiver
      g.add(box(0.1, 0.006, 0.004, screenMat(std), -0.06, legH + 0.06, 0.152));                    // its display
      const topY = legH + ch;
      g.add(box(w + 0.02, 0.03, d + 0.02, wood, 0, topY + 0.015, 0));                              // top slab
      if (tv) {
        const tw = Math.min(0.9, w - 0.5), th = tw * 0.56, base = topY + 0.03;
        g.add(box(tw * 0.5, 0.015, 0.16, bezelMat(std), 0, base + 0.0075, 0));                     // foot
        g.add(box(0.1, 0.06, 0.03, bezelMat(std), 0, base + 0.04, -0.02));                         // neck
        screen(g, { std, box }, tw, th, 0, base + 0.05 + th / 2, -0.02, 0.03);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.8, 0.12, -0.21, 0.8, 0.51, 0.21], color: 'role:wood' }, { shape: 'box', box: [-0.78, 0.15, 0.21, -0.32, 0.45, 0.23], color: 'role:cabinet' }, { shape: 'box', box: [0.32, 0.15, 0.21, 0.78, 0.45, 0.23], color: 'role:cabinet' }, { shape: 'box', box: [-0.45, 0.56, -0.035, 0.45, 1.06, -0.005], color: '#111827' }],
  },

  // ---- projector (on a surface): a small box, lens ring at the front (+z), vent, two buttons
  'projector': {
    footprint: [0.32, 0.27], height: 0.1, surface: true, params: ['color'], tags: ['office', 'living', 'study'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Projector');
      const shell = std(it.color ? hex(it.color) : mix(colors.linen, 0x64748b, 0.18), { roughness: 0.5 });
      for (const [x, z] of [[-0.12, 0.06], [0.12, 0.06], [-0.12, -0.09], [0.12, -0.09]]) g.add(cyl(THREE, 0.015, 0.015, 0.012, darkPlastic(std), x, 0.006, z, 10));   // four feet
      g.add(box(0.32, 0.08, 0.24, shell, 0, 0.052, 0));                                            // body
      const ring = cyl(THREE, 0.036, 0.036, 0.025, alu(std), 0.09, 0.055, 0.125, 20); ring.rotation.x = Math.PI / 2; g.add(ring);   // lens ring
      const lens = cyl(THREE, 0.027, 0.027, 0.012, std(0x0b1220, { roughness: 0.05, metalness: 0.4, emissive: 0x2563eb, emissiveIntensity: 0.45 }), 0.09, 0.055, 0.134, 20); lens.rotation.x = Math.PI / 2; g.add(lens);
      g.add(box(0.1, 0.035, 0.006, darkPlastic(std), -0.09, 0.055, 0.122));                        // front vent
      for (const x of [-0.06, -0.02]) g.add(cyl(THREE, 0.012, 0.012, 0.006, darkPlastic(std), x, 0.094, -0.06, 12));   // buttons
      g.add(cyl(THREE, 0.008, 0.008, 0.004, std(0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 1.2 }), 0.04, 0.094, -0.06, 10));   // power light
      return g;
    },
    iso: [{ shape: 'box', box: [-0.16, 0, -0.12, 0.16, 0.1, 0.12], color: '#e2e8f0' }, { shape: 'cyl', box: [0.055, 0.02, 0.12, 0.125, 0.09, 0.14], color: '#111827' }],
  },

  // ---- laptop (on a surface): an open aluminium laptop, keyboard toward +z, lid leaning back
  'laptop': {
    footprint: [0.32, 0.28], height: 0.22, surface: true, params: ['color'], tags: ['office', 'study', 'bedroom', 'living'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Laptop');
      const shell = std(it.color ? hex(it.color) : 0xcbd5e1, { metalness: 0.6, roughness: 0.35 });
      g.add(box(0.32, 0.015, 0.22, shell, 0, 0.0075, 0));                                          // base
      g.add(box(0.26, 0.004, 0.1, std(0x111827, { roughness: 0.6 }), 0, 0.016, -0.02));            // keyboard
      g.add(box(0.1, 0.003, 0.06, std(0x94a3b8, { roughness: 0.3, metalness: 0.5 }), 0, 0.0155, 0.075));   // trackpad
      const lid = group('Lid'); lid.position.set(0, 0.012, -0.108); lid.rotation.x = -0.32;        // hinged at the back edge, leaning back
      lid.add(box(0.32, 0.21, 0.01, shell, 0, 0.105, 0));
      lid.add(box(0.3, 0.19, 0.004, screenMat(std), 0, 0.108, 0.007));
      g.add(lid);
      return g;
    },
    iso: [{ shape: 'box', box: [-0.16, 0, -0.11, 0.16, 0.015, 0.11], color: '#cbd5e1' }, { shape: 'box', box: [-0.16, 0.015, -0.17, 0.16, 0.22, -0.1], color: '#111827' }],
  },

  // ---- pin board (wall-mounted): a wood-framed cork board with seeded sticky notes and pins. Back at z = 0; `y`
  // is the centre height (default 1.4)
  'pin-board': {
    footprint: [0.9, 0.05], height: 0.6, params: ['w', 'h', 'y', 'color'], tags: ['office', 'study', 'kitchen', 'kids'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const w = it.w || 0.9, h = it.h || 0.6, cy = it.y !== undefined ? 0 : 1.4, g = group('Pin Board');
      const frame = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 }), bar = 0.03, depth = 0.035;
      g.add(box(w, bar, depth, frame, 0, cy + h / 2 - bar / 2, depth / 2));
      g.add(box(w, bar, depth, frame, 0, cy - h / 2 + bar / 2, depth / 2));
      g.add(box(bar, h - 2 * bar, depth, frame, -w / 2 + bar / 2, cy, depth / 2));
      g.add(box(bar, h - 2 * bar, depth, frame, w / 2 - bar / 2, cy, depth / 2));
      g.add(box(w - 2 * bar, h - 2 * bar, 0.02, std(0xc8a170, { roughness: 0.95 }), 0, cy, 0.015));   // cork
      // sticky notes and a couple of pinned sheets, jittered per item
      const paper = [colors.linen, 0xfde68a, 0xfde68a, colors.accent, colors.fabric2, 0xfca5a5, 0xbfdbfe];
      const pin = std(0xdc2626, { roughness: 0.4 }), pin2 = alu(std), n = 6 + Math.floor(rng() * 3), cw = w - 2 * bar - 0.1, ch = h - 2 * bar - 0.1;
      for (let i = 0; i < n; i++) {
        const nw = 0.08 + rng() * 0.07, nh = 0.08 + rng() * 0.06;
        const x = -cw / 2 + ((i + 0.5) / n) * cw + (rng() - 0.5) * 0.04, y = cy + (rng() - 0.5) * ch;
        const note = box(nw, nh, 0.004, std(pick(rng, paper), { roughness: 0.9 }), x, y, 0.027); note.rotation.z = (rng() - 0.5) * 0.3; g.add(note);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), rng() < 0.6 ? pin : pin2); p.position.set(x, y + nh / 2 - 0.008, 0.031); g.add(p);
      }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.45, 1.1, 0, 0.45, 1.7, 0.035], color: 'role:wood' }, { shape: 'box', box: [-0.42, 1.13, 0.02, 0.42, 1.67, 0.04], color: '#c8a170' }, { shape: 'box', box: [-0.2, 1.36, 0.04, -0.12, 1.44, 0.045], color: '#fde68a' }],
  },
});

// =================================================================================================================
// Pass 4 (S3 compose): acoustic pianos — a grand for a salon or a library, an upright against a wall (mirage's
// photo) — each with its bench, so a music corner is one item.
// =================================================================================================================
registerProps({
  // Grand piano — the curved case on three legs, the lid propped open on the treble side, the keyboard and its bench
  // at +z (the pianist sits facing −z, into the piano). Footprint 1.56 × 2.4 with the bench.
  'grand-piano': {
    footprint: [1.56, 2.4], height: 1.66, params: ['color'], tags: ['living', 'library', 'studio'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Grand Piano'), oz = -0.2;   // oz: every z below is shifted so the footprint is centred
      const lacquer = std(it.color ? hex(it.color) : 0x141414, { roughness: 0.18, metalness: 0.1 });
      const white = std(colors.linen, { roughness: 0.35 }), black = std(0x0b0b0c, { roughness: 0.4 }), brass = std(0xb08d57, { metalness: 0.8, roughness: 0.3 });
      // the case outline in plan (x, z): the straight bass side at −x, the bentside curving in to the tail
      const s = new THREE.Shape();
      s.moveTo(-0.75, 0.75); s.lineTo(0.75, 0.75); s.lineTo(0.75, 0.25);
      s.bezierCurveTo(0.75, -0.1, 0.25, -0.2, 0.05, -0.45); s.bezierCurveTo(-0.15, -0.72, -0.2, -1.0, -0.45, -1.0);
      s.lineTo(-0.75, -0.95); s.lineTo(-0.75, 0.75);
      const slab = (depth, mat) => { const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 }); geo.rotateX(Math.PI / 2); const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
      const body = slab(0.34, lacquer); body.position.set(0, 0.95, oz); g.add(body);   // rotateX(π/2) sends the depth down, from y 0.95
      const lid = new THREE.Group(); lid.position.set(-0.75, 0.97, oz); lid.rotation.z = 0.5; g.add(lid);   // hinged along the bass side
      const lidSlab = slab(0.02, lacquer); lidSlab.position.set(0.75, 0.02, 0); lid.add(lidSlab);
      g.add(box(0.015, 0.02, 0.015, black, 0.6, 1.2, oz + 0.2));   // (the prop stick is hidden by the lid)
      for (const [x, z] of [[-0.62, 0.62], [0.62, 0.62], [-0.4, -0.85]]) { g.add(box(0.1, 0.62, 0.1, lacquer, x, 0.31, z + oz)); g.add(box(0.06, 0.04, 0.06, brass, x, 0.02, z + oz)); }
      g.add(box(1.46, 0.08, 0.24, lacquer, 0, 0.72, 0.87 + oz));                          // key bed
      g.add(box(1.34, 0.02, 0.15, white, 0, 0.77, 0.91 + oz));                            // keys
      for (let o = 0; o < 6; o++) { const x0 = -0.67 + o * 0.223, wk = 0.223 / 7; g.add(box(wk * 1.7, 0.014, 0.09, black, x0 + wk * 1.5, 0.786, 0.88 + oz)); g.add(box(wk * 2.7, 0.014, 0.09, black, x0 + wk * 5, 0.786, 0.88 + oz)); }
      for (const sx of [-1, 1]) g.add(box(0.06, 0.1, 0.24, lacquer, sx * 0.7, 0.8, 0.87 + oz));   // cheek blocks
      const desk = box(0.7, 0.26, 0.02, lacquer, 0, 1.08, 0.66 + oz); desk.rotation.x = -0.25; g.add(desk);   // music desk
      g.add(box(0.8, 0.06, 0.34, lacquer, 0, 0.47, 1.21 + oz));                           // bench seat
      g.add(box(0.76, 0.04, 0.3, std(0x2b2622, { roughness: 0.6 }), 0, 0.515, 1.21 + oz));
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.04, 0.44, 0.04, lacquer, sx * 0.36, 0.22, 1.21 + oz + sz * 0.13));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.78, 0.6, -1.2, 0.78, 0.95, 0.75], color: '#141414' }, { shape: 'box', box: [-0.4, 0, 0.83, 0.4, 0.53, 1.2], color: '#141414' }],
  },
  // Upright piano — a tall case against the wall (back at −z), the keyboard proud of it on two toe blocks, the bench
  // in front. Footprint 1.5 × 1.13 with the bench.
  'upright-piano': {
    footprint: [1.5, 1.13], height: 1.25, params: ['color'], tags: ['living', 'library', 'studio', 'kids'],
    create(it, { std, box, group, colors, hex }) {
      const g = group('Upright Piano'), oz = -0.265;
      const case_ = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.3 }), white = std(colors.linen, { roughness: 0.35 }), black = std(0x0b0b0c, { roughness: 0.4 });
      g.add(box(1.5, 1.25, 0.3, case_, 0, 0.625, -0.15 + oz));                             // the case, back at z −0.3
      g.add(box(1.5, 0.07, 0.27, case_, 0, 0.72, 0.135 + oz));                             // key bed
      g.add(box(1.36, 0.02, 0.15, white, 0, 0.765, 0.19 + oz));
      for (let o = 0; o < 6; o++) { const x0 = -0.68 + o * 0.227, wk = 0.227 / 7; g.add(box(wk * 1.7, 0.014, 0.09, black, x0 + wk * 1.5, 0.781, 0.16 + oz)); g.add(box(wk * 2.7, 0.014, 0.09, black, x0 + wk * 5, 0.781, 0.16 + oz)); }
      for (const sx of [-1, 1]) { g.add(box(0.07, 0.68, 0.06, case_, sx * 0.68, 0.34, 0.24 + oz)); g.add(box(0.07, 0.06, 0.28, case_, sx * 0.68, 0.03, 0.14 + oz)); }   // legs and toe blocks
      g.add(box(1.36, 0.36, 0.02, std(0x2b2622, { roughness: 0.5 }), 0, 1.0, 0.005 + oz));   // fall board / music rest panel
      g.add(box(0.76, 0.06, 0.34, case_, 0, 0.47, 0.655 + oz));                             // bench
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.04, 0.44, 0.04, case_, sx * 0.34, 0.22, 0.655 + oz + sz * 0.13));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.75, 0, -0.565, 0.75, 1.25, -0.265], color: 'role:wood' }, { shape: 'box', box: [-0.38, 0, 0.22, 0.38, 0.5, 0.565], color: 'role:wood' }],
  },
});
