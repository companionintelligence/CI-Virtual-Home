// Kids — the toys and small furniture a child's room reads by. See index.js for the contract and decor.js for a
// worked example. Every prop: origin at the floor centre of its footprint, faces SOUTH (+z) at rot 0, big surfaces
// from ctx.colors roles (or it.color), small details from a candy palette picked with the seeded rng.
import { registerProps } from './registry.js';

// muted primaries — saturated enough to read as "kids", dull enough for a product render
const CANDY = [0xe05252, 0xf2a93b, 0xf5d547, 0x4cae5b, 0x4a86e8, 0x9b6bd9, 0xf08a3e, 0xe66aa4, 0x2fb5a3];
const pickCandy = (rng, not = -1) => { let c = CANDY[Math.floor(rng() * CANDY.length)]; if (c === not) c = CANDY[(CANDY.indexOf(c) + 1) % CANDY.length]; return c; };
// a shadowed mesh from any geometry (ctx.box only makes boxes)
const mesh = (THREE, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
// a cylinder whose axis runs from a to b (poles, struts, mounting arms)
function strut(THREE, a, b, r, mat, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const m = mesh(THREE, new THREE.CylinderGeometry(r, r, L, seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
// a three-legged hardware stand (drum kit, guitar stand): post plus splayed legs, post top at y = h
function tripod(THREE, g, x, z, h, mat, spread = 0.14, legH = 0.06, r = 0.01) {
  g.add(strut(THREE, [x, legH, z], [x, h, z], r, mat));
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + Math.PI / 6; g.add(strut(THREE, [x, legH + 0.02, z], [x + Math.sin(a) * spread, 0.008, z + Math.cos(a) * spread], r * 0.8, mat, 6)); }
}

registerProps({
  // ---- toy box: an open chest with a hinged lid standing up at the back and toys peeking out
  'toy-box': {
    footprint: [0.8, 0.45], height: 0.89, params: ['w', 'd', 'color', 'open'], tags: ['kids', 'bedroom', 'living'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const w = it.w || 0.8, d = it.d || 0.45, h = 0.42, t = 0.025, open = it.open ?? 1.25;   // open: lid angle in radians, 0 = shut
      const g = group('Toy Box');
      const body = std(it.color ? hex(it.color) : colors.accent, { roughness: 0.6 });
      const lidCol = pickCandy(rng, it.color ? hex(it.color) : colors.accent);
      const lid = std(lidCol, { roughness: 0.6 });
      g.add(box(w, t, d, body, 0, t / 2, 0));
      g.add(box(w, h, t, body, 0, h / 2, -d / 2 + t / 2));
      g.add(box(w, h, t, body, 0, h / 2, d / 2 - t / 2));
      g.add(box(t, h, d - 2 * t, body, -w / 2 + t / 2, h / 2, 0));
      g.add(box(t, h, d - 2 * t, body, w / 2 - t / 2, h / 2, 0));
      // lid: hinged along the back top edge, swung up and back
      const pivot = new THREE.Group(); pivot.position.set(0, h, -d / 2); pivot.rotation.x = -open; g.add(pivot);
      pivot.add(box(w + 0.03, 0.035, d + 0.03, lid, 0, 0.0175, (d + 0.03) / 2 - 0.015));
      pivot.add(box(0.12, 0.02, 0.05, std(colors.linen, { roughness: 0.5 }), 0, 0.045, d + 0.015 - 0.035));   // grip
      // a soft pile fills the chest (a blanket); with the lid open the toys sit proud of the rim
      g.add(box(w - 2 * t, 0.3, d - 2 * t, std(colors.fabric2, { roughness: 0.95 }), 0, t + 0.15, 0));
      if (open < 0.7) return g;
      const ballCol = pickCandy(rng, lidCol);
      g.add(mesh(THREE, new THREE.SphereGeometry(0.09, 10, 8), std(ballCol, { roughness: 0.6, flatShading: true }), -w * 0.28, t + 0.3 + 0.085, 0.0));
      const b1 = box(0.13, 0.13, 0.13, std(pickCandy(rng, ballCol), { roughness: 0.6 }), w * 0.08, t + 0.3 + 0.065, 0.03); b1.rotation.y = 0.4; g.add(b1);
      const b2 = box(0.09, 0.09, 0.09, std(pickCandy(rng), { roughness: 0.6 }), w * 0.1, t + 0.3 + 0.175, 0.02); b2.rotation.y = -0.3; g.add(b2);
      const b3 = box(0.18, 0.06, 0.1, std(pickCandy(rng), { roughness: 0.6 }), w * 0.32, t + 0.3 + 0.03, -0.04); b3.rotation.y = 0.7; g.add(b3);
      const bear = std(0xb45309, { roughness: 0.95, flatShading: true });   // a bear peeking over the front-right corner
      g.add(mesh(THREE, new THREE.SphereGeometry(0.06, 8, 6), bear, w * 0.3, t + 0.3 + 0.1, 0.08));
      for (const sx of [-1, 1]) g.add(mesh(THREE, new THREE.SphereGeometry(0.022, 6, 5), bear, w * 0.3 + sx * 0.045, t + 0.3 + 0.148, 0.075));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.4, 0, -0.225, 0.4, 0.42, 0.225], color: 'role:accent' }, { shape: 'box', box: [-0.41, 0.42, -0.26, 0.41, 0.89, -0.1], color: '#f2a93b' }],
  },

  // ---- play kitchen: pastel body, timber doors, hob + sink on the counter, a shelf on the splashback
  'play-kitchen': {
    footprint: [0.9, 0.4], height: 0.95, params: ['w', 'd', 'color'], tags: ['kids', 'living'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const w = it.w || 0.9, d = it.d || 0.4, g = group('Play Kitchen'), doorW = Math.min(0.36, w * 0.42);   // two doors never meet in the middle
      const bodyCol = it.color ? hex(it.color) : mix(colors.accent, 0xffffff, 0.35);
      const body = std(bodyCol, { roughness: 0.6 }), wood = std(colors.wood, { roughness: 0.55 }), counter = std(colors.linen, { roughness: 0.4 });
      const dark = std(0x1f2937, { roughness: 0.5 }), metal = std(0xcbd5e1, { metalness: 0.8, roughness: 0.3 });   // not 0x1e293b: theme() reads that as the cabinet role
      g.add(box(w, 0.55, d, body, 0, 0.275, 0));
      g.add(box(w + 0.02, 0.03, d + 0.02, counter, 0, 0.565, 0));
      g.add(box(w, 0.37, 0.04, body, 0, 0.765, -d / 2 + 0.02));                     // splashback
      g.add(box(w - 0.1, 0.02, 0.12, wood, 0, 0.9, -d / 2 + 0.08));                  // shelf
      const potA = pickCandy(rng), potB = pickCandy(rng, potA);
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10), std(potA, { roughness: 0.5 }), -w * 0.3, 0.935, -d / 2 + 0.08));
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10), std(potB, { roughness: 0.5 }), w * 0.28, 0.93, -d / 2 + 0.08));
      // oven (left): timber door with a dark window and a bar handle
      g.add(box(doorW, 0.32, 0.02, wood, -w * 0.24, 0.21, d / 2 + 0.01));
      g.add(box(doorW - 0.1, 0.14, 0.006, std(0x0f172a, { roughness: 0.2, metalness: 0.4 }), -w * 0.24, 0.2, d / 2 + 0.023));
      const handle = mesh(THREE, new THREE.CylinderGeometry(0.008, 0.008, doorW - 0.06, 8), metal, -w * 0.24, 0.34, d / 2 + 0.04); handle.rotation.z = Math.PI / 2; g.add(handle);
      // cupboard (right): timber door with a round knob
      g.add(box(doorW, 0.42, 0.02, wood, w * 0.24, 0.27, d / 2 + 0.01));
      g.add(mesh(THREE, new THREE.SphereGeometry(0.018, 8, 6), std(colors.linen, { roughness: 0.4 }), w * 0.24 - doorW * 0.36, 0.3, d / 2 + 0.03));
      // knobs under the counter
      for (let i = 0; i < 3; i++) { const k = mesh(THREE, new THREE.CylinderGeometry(0.015, 0.015, 0.02, 10), std(colors.linen, { roughness: 0.4 }), -w * 0.3 + (i - 1) * 0.07, 0.49, d / 2 + 0.01); k.rotation.x = Math.PI / 2; g.add(k); }
      // hob (left) and sink (right) on the counter
      for (const [hx, hz] of [[-w * 0.3, -0.06], [-w * 0.16, 0.06]]) g.add(mesh(THREE, new THREE.CylinderGeometry(0.055, 0.055, 0.01, 18), dark, hx, 0.585, hz));
      g.add(box(0.26, 0.012, 0.2, metal, w * 0.24, 0.585, 0.01));
      g.add(strut(THREE, [w * 0.24, 0.58, -0.1], [w * 0.24, 0.72, -0.1], 0.009, metal));
      g.add(strut(THREE, [w * 0.24, 0.72, -0.1], [w * 0.24, 0.72, 0.0], 0.009, metal));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.45, 0, -0.2, 0.45, 0.58, 0.2], color: 'role:accent' }, { shape: 'box', box: [-0.45, 0.58, -0.2, 0.45, 0.95, -0.16], color: 'role:accent' }],
  },

  // ---- easel: A-frame with a leaning board, a crayon picture (sun, house, grass) and a tray of paint pots
  'easel': {
    footprint: [0.6, 0.5], height: 1.2, params: ['color'], tags: ['kids', 'office'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const g = group('Easel');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.55 });
      const H = 1.18;
      // legs: two front legs splayed in x and leaning back a touch, one back leg
      for (const s of [-1, 1]) g.add(strut(THREE, [s * 0.27, 0, 0.14], [s * 0.05, H, 0.0], 0.018, wood));
      g.add(strut(THREE, [0, 0, -0.27], [0, H - 0.04, -0.03], 0.018, wood));
      g.add(box(0.22, 0.03, 0.06, wood, 0, H, -0.01));                                // top block
      // board, tilted with the front legs, carrying the paper and picture
      const tilt = Math.atan2(0.14, H);
      const board = new THREE.Group(); board.position.set(0, 0.74, 0.14 * (1 - 0.74 / H) + 0.025); board.rotation.x = -tilt; g.add(board);
      board.add(box(0.5, 0.56, 0.02, std(colors.linen, { roughness: 0.7 }), 0, 0, 0));
      board.add(box(0.42, 0.46, 0.006, std(0xffffff, { roughness: 0.9 }), 0, 0, 0.013));                 // paper
      const sun = mesh(THREE, new THREE.CylinderGeometry(0.055, 0.055, 0.004, 14), std(0xf5d547, { roughness: 0.8 }), -0.13, 0.15, 0.018); sun.rotation.x = Math.PI / 2; board.add(sun);
      board.add(box(0.12, 0.1, 0.004, std(pickCandy(rng), { roughness: 0.8 }), 0.08, -0.06, 0.018));   // house
      const roof = mesh(THREE, new THREE.ConeGeometry(0.095, 0.07, 4), std(0xe05252, { roughness: 0.8 }), 0.08, 0.035, 0.018); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.06; board.add(roof);
      board.add(box(0.42, 0.05, 0.004, std(0x4cae5b, { roughness: 0.8 }), 0, -0.2, 0.018));              // grass
      // tray with three paint pots
      const trayZ = 0.14 * (1 - 0.44 / H) + 0.06;
      g.add(box(0.5, 0.025, 0.08, wood, 0, 0.44, trayZ));
      let last = -1; for (const px of [-0.15, 0, 0.15]) { const c = pickCandy(rng, last); last = c; g.add(mesh(THREE, new THREE.CylinderGeometry(0.025, 0.022, 0.045, 10), std(c, { roughness: 0.5 }), px, 0.475, trayZ)); }
      return g;
    },
    iso: [{ shape: 'box', box: [-0.27, 0, -0.27, 0.27, 0.04, 0.16], color: 'role:wood' }, { shape: 'box', box: [-0.25, 0.46, -0.05, 0.25, 1.02, 0.1], color: '#ffffff' }, { shape: 'box', box: [-0.11, 1.02, -0.04, 0.11, 1.2, 0.02], color: 'role:wood' }],
  },

  // ---- rocking horse: timber body on two curved runners, accent saddle, mane and tail, head to the front
  'rocking-horse': {
    footprint: [0.35, 0.95], height: 0.94, params: ['color'], tags: ['kids', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const g = group('Rocking Horse');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.55 }), accent = std(colors.accent, { roughness: 0.8 });
      // runners: an arc band, extruded thin, standing in the y-z plane
      const R = 0.9, band = 0.05, half = 0.5;
      const shape = new THREE.Shape();
      shape.absarc(0, R, R, -Math.PI / 2 - half, -Math.PI / 2 + half, false);
      shape.absarc(0, R, R - band, -Math.PI / 2 + half, -Math.PI / 2 - half, true);
      const runnerGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
      for (const s of [-1, 1]) { const r = mesh(THREE, runnerGeo, wood, s * 0.15 - 0.015, 0, 0); r.rotation.y = Math.PI / 2; g.add(r); }   // extrude runs +x from position.x
      for (const z of [-0.26, 0.26]) g.add(box(0.33, 0.03, 0.05, wood, 0, 0.075, z));   // cross braces
      for (const [x, z] of [[-0.1, -0.2], [0.1, -0.2], [-0.1, 0.2], [0.1, 0.2]]) g.add(box(0.04, 0.32, 0.04, wood, x, 0.25, z));
      g.add(box(0.2, 0.2, 0.5, wood, 0, 0.5, 0));                                     // body
      g.add(box(0.24, 0.05, 0.22, accent, 0, 0.625, -0.02));                          // saddle
      const neck = new THREE.Group(); neck.position.set(0, 0.68, 0.2); neck.rotation.x = 0.35; g.add(neck);
      neck.add(box(0.14, 0.26, 0.14, wood, 0, 0, 0));
      neck.add(box(0.04, 0.3, 0.06, accent, 0, 0.03, -0.09));                          // mane
      const bar = mesh(THREE, new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), std(0x1e293b, { metalness: 0.6, roughness: 0.4 }), 0, 0.08, 0); bar.rotation.z = Math.PI / 2; neck.add(bar);
      g.add(box(0.14, 0.15, 0.2, wood, 0, 0.8, 0.33));                                 // head
      g.add(box(0.1, 0.1, 0.12, wood, 0, 0.77, 0.47));                                  // snout
      for (const s of [-1, 1]) { const ear = mesh(THREE, new THREE.ConeGeometry(0.03, 0.07, 5), wood, s * 0.045, 0.905, 0.28); g.add(ear); }
      for (const s of [-1, 1]) g.add(mesh(THREE, new THREE.SphereGeometry(0.014, 6, 5), std(0x0f172a, { roughness: 0.3 }), s * 0.072, 0.84, 0.38));
      const tail = new THREE.Group(); tail.position.set(0, 0.58, -0.25); tail.rotation.x = 0.5; g.add(tail);   // hung from the top of the rump, swept back
      tail.add(box(0.05, 0.24, 0.05, accent, 0, -0.12, -0.02));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.17, 0, -0.43, 0.17, 0.1, 0.43], color: 'role:wood' }, { shape: 'box', box: [-0.1, 0.4, -0.25, 0.1, 0.6, 0.25], color: 'role:wood' }, { shape: 'box', box: [-0.07, 0.6, 0.15, 0.07, 0.94, 0.53], color: 'role:wood' }],
  },

  // ---- low bookshelf: two shelves of picture books, a flat stack, a ball on top — child height
  'low-bookshelf': {
    footprint: [0.9, 0.3], height: 0.87, params: ['w', 'color'], tags: ['kids', 'bedroom', 'living'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const w = it.w || 0.9, d = 0.3, h = 0.75, g = group('Low Bookshelf');
      const carcass = std(it.color ? hex(it.color) : colors.cabinet, { roughness: 0.6 });
      for (const s of [-1, 1]) g.add(box(0.02, h, d, carcass, s * (w / 2 - 0.01), h / 2, 0));
      for (const y of [0.04, 0.4, 0.74]) g.add(box(w - 0.04, 0.02, d - 0.02, carcass, 0, y, 0));
      g.add(box(w - 0.04, h - 0.04, 0.015, carcass, 0, h / 2, -d / 2 + 0.0075));
      // a row of upright books, then one leaning on the side panel; a flat stack on the top shelf
      const row = (y0, x0, x1, lean) => {
        let x = x0, last = -1;
        while (x < x1 - (lean ? 0.14 : 0.05)) {
          const bw = 0.03 + rng() * 0.03, bh = 0.18 + rng() * 0.1, c = pickCandy(rng, last); last = c;   // picture books are chunky
          g.add(box(bw, bh, 0.2 + rng() * 0.03, std(c, { roughness: 0.7 }), x + bw / 2, y0 + bh / 2, 0.01)); x += bw + 0.004;
        }
        if (!lean) return;
        // rotated by -th about z: its lowest corner sits on the shelf, its highest corner touches the panel's inner face
        const bw = 0.04, bh = 0.24, th = 0.22, panel = w / 2 - 0.02, sn = Math.sin(th), cs = Math.cos(th);
        const b = box(bw, bh, 0.2, std(pickCandy(rng, last), { roughness: 0.7 }), panel - (bw / 2) * cs - (bh / 2) * sn, y0 + (bw / 2) * sn + (bh / 2) * cs, 0.01);
        b.rotation.z = -th; g.add(b);
      };
      row(0.05, -w / 2 + 0.05, w / 2 - 0.05, true);
      row(0.41, -w / 2 + 0.05, w * 0.08, false);
      let c = -1; for (let i = 0; i < 3; i++) { c = pickCandy(rng, c); const b = box(0.22 - i * 0.02, 0.018, 0.17, std(c, { roughness: 0.7 }), w * 0.28, 0.41 + 0.009 + i * 0.018, 0.02); b.rotation.y = (rng() - 0.5) * 0.25; g.add(b); }
      g.add(mesh(THREE, new THREE.SphereGeometry(0.06, 10, 8), std(pickCandy(rng), { roughness: 0.6, flatShading: true }), w * 0.32, h + 0.06, 0.0));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.45, 0, -0.15, 0.45, 0.75, 0.15], color: 'role:cabinet' }, { shape: 'blob', box: [0.23, 0.75, -0.06, 0.35, 0.87, 0.06], color: '#f08a3e' }],
  },

  // ---- beanbag: a squashed blob with a higher back, faceted like the plants
  'beanbag': {
    footprint: [0.85, 0.85], height: 0.53, params: ['color'], tags: ['kids', 'living', 'bedroom'],
    create(it, { THREE, std, group, colors, hex, rng }) {
      const g = group('Beanbag');
      const fab = std(it.color ? hex(it.color) : (rng() < 0.5 ? colors.fabric : colors.fabric2), { roughness: 0.95, flatShading: true });
      // one lathe: flat base, full hips, a dimpled top. Heights scale with z so the back rises and the front sinks into a seat.
      const prof = [[0, 0], [0.34, 0], [0.42, 0.09], [0.41, 0.22], [0.35, 0.34], [0.25, 0.43], [0.13, 0.48], [0.05, 0.45], [0, 0.44]].map(([x, y]) => new THREE.Vector2(x, y));
      const geo = new THREE.LatheGeometry(prof, 14), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), z = pos.getZ(i); pos.setY(i, y * (1 - 0.32 * z / 0.42)); pos.setZ(i, z - 0.12 * y * y); }
      geo.computeVertexNormals();
      g.add(mesh(THREE, geo, fab));
      const label = mesh(THREE, new THREE.BoxGeometry(0.06, 0.03, 0.005), std(colors.linen, { roughness: 0.8 }), 0.13, 0.11, 0.395); label.rotation.y = 0.3; g.add(label);   // label
      return g;
    },
    iso: [{ shape: 'blob', box: [-0.42, 0, -0.42, 0.42, 0.53, 0.42], color: 'role:fabric' }],
  },

  // ---- play tent: a striped teepee with an open door to the front, poles crossing above the apex, a cushion inside
  'play-tent': {
    footprint: [1.1, 1.1], height: 1.55, params: ['color'], tags: ['kids', 'bedroom', 'living'],
    create(it, { THREE, std, box, group, colors, hex, mix, rng }) {
      const g = group('Play Tent');
      const R = 0.55, H = 1.35, N = 8, doorH = 0.72;
      const canvasA = std(mix(colors.linen, 0xc9a26b, 0.35), { roughness: 0.95, flatShading: true, side: THREE.DoubleSide });   // warm canvas, not page-white
      const canvasB = std(it.color ? hex(it.color) : colors.accent, { roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
      for (let i = 0; i < N; i++) {
        const t0 = -Math.PI / N + i * 2 * Math.PI / N, mat = i % 2 ? canvasB : canvasA;
        if (i === 0) { const r = R * (1 - doorH / H); g.add(mesh(THREE, new THREE.ConeGeometry(r, H - doorH, 1, 1, true, t0, 2 * Math.PI / N), mat, 0, doorH + (H - doorH) / 2, 0)); }   // above the door
        else g.add(mesh(THREE, new THREE.ConeGeometry(R, H, 1, 1, true, t0, 2 * Math.PI / N), mat, 0, H / 2, 0));
      }
      const pole = std(colors.wood, { roughness: 0.6 });
      for (let i = 0; i < N; i++) {
        const a = -Math.PI / N + i * 2 * Math.PI / N, foot = [Math.sin(a) * 0.565, 0, Math.cos(a) * 0.565], apex = [0, H, 0];
        const d = [apex[0] - foot[0], apex[1] - foot[1], apex[2] - foot[2]], L = Math.hypot(...d), k = (L + 0.2) / L;
        g.add(strut(THREE, foot, [foot[0] + d[0] * k, foot[1] + d[1] * k, foot[2] + d[2] * k], 0.014, pole, 6));
      }
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.22, 0.24, 0.07, 12), std(colors.fabric2, { roughness: 0.95 }), 0, 0.035, 0.06));   // cushion
      g.add(box(0.16, 0.09, 0.006, std(pickCandy(rng), { roughness: 0.8 }), 0.08, 1.47, 0.02));                                     // pennant
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.55, 0, -0.55, 0.55, 1.35, 0.55], color: 'role:accent' }, { shape: 'box', box: [-0.03, 1.35, -0.03, 0.03, 1.55, 0.03], color: 'role:wood' }],
  },

  // ---- drum kit: junior five-piece — bass drum to the front, snare and hi-hat on the left, floor tom right,
  // crash up front-right, stool behind
  'drum-kit': {
    footprint: [1.15, 0.95], height: 1.0, params: ['color'], tags: ['kids', 'living', 'garage'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const g = group('Drum Kit');
      const shell = std(it.color ? hex(it.color) : colors.accent, { roughness: 0.35, metalness: 0.1 });
      const head = std(colors.linen, { roughness: 0.7 }), hoop = std(0x1e293b, { metalness: 0.6, roughness: 0.4 });
      const chrome = std(0xcbd5e1, { metalness: 0.85, roughness: 0.3 }), brass = std(0xd6a742, { metalness: 0.7, roughness: 0.35 });
      // shell + the head and hoop you can see (the top, or the front of the bass drum); the far ones are hidden
      const drum = (r, h, x, y, z, tilt = 0, axisZ = false) => {
        const d = new THREE.Group(); d.position.set(x, y, z);
        d.add(mesh(THREE, new THREE.CylinderGeometry(r, r, h, 20, 1, true), shell));
        for (const s of axisZ ? [-1, 1] : [1]) d.add(mesh(THREE, new THREE.CylinderGeometry(r - 0.004, r - 0.004, 0.01, 20), head, 0, s * h / 2, 0));
        d.add(mesh(THREE, new THREE.CylinderGeometry(r + 0.01, r + 0.01, 0.025, 20, 1, true), hoop, 0, (axisZ ? -1 : 1) * (h / 2 - 0.01), 0));
        d.rotation.x = axisZ ? Math.PI / 2 : tilt; g.add(d); return d;
      };
      drum(0.2, 0.32, 0, 0.21, 0.14, 0, true);                                        // bass drum, heads facing ±z (front hoop at +z)
      drum(0.14, 0.1, -0.25, 0.48, -0.1);                                             // snare
      g.add(strut(THREE, [-0.25, 0.02, -0.1], [-0.25, 0.43, -0.1], 0.01, chrome));
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.11, 0.11, 0.015, 12), hoop, -0.25, 0.008, -0.1));
      for (const s of [-1, 1]) { drum(0.11, 0.12, s * 0.13, 0.6, 0.02, -0.3); g.add(strut(THREE, [s * 0.13, 0.4, 0.06], [s * 0.13, 0.54, 0.03], 0.008, chrome)); }   // rack toms
      drum(0.15, 0.28, 0.38, 0.36, -0.12);                                            // floor tom
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; g.add(strut(THREE, [0.38 + Math.sin(a) * 0.14, 0.3, -0.12 + Math.cos(a) * 0.14], [0.38 + Math.sin(a) * 0.18, 0.008, -0.12 + Math.cos(a) * 0.18], 0.007, chrome, 6)); }
      tripod(THREE, g, -0.45, -0.24, 0.76, chrome);                                   // hi-hat
      for (const y of [0.74, 0.775]) { const c = mesh(THREE, new THREE.CylinderGeometry(0.13, 0.13, 0.005, 20), brass, -0.45, y, -0.24); g.add(c); }
      tripod(THREE, g, 0.34, 0.24, 0.93, chrome);                                     // crash
      const crash = mesh(THREE, new THREE.CylinderGeometry(0.17, 0.17, 0.005, 20), brass, 0.34, 0.95, 0.24); crash.rotation.x = 0.18; crash.rotation.z = -0.1; g.add(crash);
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), std(colors.fabric2, { roughness: 0.8 }), 0, 0.48, -0.42));   // stool
      g.add(strut(THREE, [0, 0.02, -0.42], [0, 0.45, -0.42], 0.014, chrome));
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.13, 0.13, 0.015, 12), hoop, 0, 0.008, -0.42));
      for (const s of [-1, 1]) { const st = strut(THREE, [-0.25 + s * 0.03, 0.545, -0.28], [-0.25 + s * 0.09, 0.56, 0.02], 0.005, std(0xcbb59a, { roughness: 0.6 }), 6); g.add(st); }   // sticks
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.21, 0, -0.06, 0.21, 0.42, 0.34], color: 'role:accent' }, { shape: 'cyl', box: [-0.39, 0.4, -0.24, -0.11, 0.55, 0.04], color: 'role:accent' }, { shape: 'cyl', box: [0.23, 0.2, -0.27, 0.53, 0.5, 0.03], color: 'role:accent' }, { shape: 'cyl', box: [-0.14, 0.42, -0.56, 0.14, 0.5, -0.28], color: 'role:fabric2' }],
  },

  // ---- guitar stand with an acoustic on it, leaning back a little, face to the front
  'guitar-stand': {
    footprint: [0.4, 0.4], height: 1.05, params: ['color'], tags: ['kids', 'bedroom', 'living', 'office'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Guitar Stand');
      const chrome = std(0x1e293b, { metalness: 0.7, roughness: 0.35 });
      // stand: a tripod hub low down, two padded yoke arms in front, a post rising back to the neck cradle
      const hub = [0, 0.12, -0.02];
      g.add(strut(THREE, hub, [-0.17, 0.008, 0.13], 0.009, chrome)); g.add(strut(THREE, hub, [0.17, 0.008, 0.13], 0.009, chrome)); g.add(strut(THREE, hub, [0, 0.008, -0.21], 0.009, chrome));
      g.add(strut(THREE, hub, [0, 0.69, -0.075], 0.01, chrome));
      for (const s of [-1, 1]) { g.add(strut(THREE, hub, [s * 0.1, 0.09, 0.1], 0.008, chrome)); g.add(box(0.03, 0.05, 0.04, std(0x334155, { roughness: 0.9 }), s * 0.1, 0.1, 0.1)); }
      g.add(box(0.1, 0.03, 0.04, std(0x334155, { roughness: 0.9 }), 0, 0.7, -0.11));
      for (const s of [-1, 1]) g.add(box(0.02, 0.05, 0.05, std(0x334155, { roughness: 0.9 }), s * 0.045, 0.72, -0.09));
      // guitar: figure-eight body from two discs, neck, headstock, one flat box of strings
      const lean = -0.28, gtr = new THREE.Group(); gtr.position.set(0, 0.05, 0.1); gtr.rotation.x = lean; g.add(gtr);
      const top = std(it.color ? hex(it.color) : mix(colors.wood, 0xffffff, 0.35), { roughness: 0.4 }), dark = std(0x2a201a, { roughness: 0.5 });
      const lower = mesh(THREE, new THREE.CylinderGeometry(0.17, 0.17, 0.09, 24), top, 0, 0.17, 0); lower.rotation.x = Math.PI / 2; gtr.add(lower);
      const upper = mesh(THREE, new THREE.CylinderGeometry(0.13, 0.13, 0.09, 24), top, 0, 0.4, 0); upper.rotation.x = Math.PI / 2; gtr.add(upper);
      const hole = mesh(THREE, new THREE.CylinderGeometry(0.04, 0.04, 0.004, 16), std(0x0f172a, { roughness: 0.6 }), 0, 0.31, 0.046); hole.rotation.x = Math.PI / 2; gtr.add(hole);
      gtr.add(box(0.12, 0.012, 0.025, dark, 0, 0.19, 0.047));                          // bridge
      gtr.add(box(0.045, 0.42, 0.025, dark, 0, 0.7, 0.02));                             // neck
      gtr.add(box(0.045, 0.42, 0.006, std(0x3e2723, { roughness: 0.5 }), 0, 0.7, 0.035)); // fretboard
      const hs = box(0.065, 0.14, 0.018, dark, 0, 0.97, 0.014); hs.rotation.x = 0.12; gtr.add(hs);
      gtr.add(box(0.026, 0.72, 0.003, std(0xe2e8f0, { metalness: 0.6, roughness: 0.3 }), 0, 0.55, 0.05));   // strings
      return g;
    },
    iso: [{ shape: 'box', box: [-0.18, 0, -0.22, 0.18, 0.02, 0.14], color: '#1e293b' }, { shape: 'cyl', box: [-0.17, 0.05, 0.02, 0.17, 0.6, 0.16], color: 'role:wood' }, { shape: 'box', box: [-0.03, 0.6, -0.06, 0.03, 1.0, 0.04], color: '#2a201a' }],
  },

  // ---- gaming chair: racing bucket on a five-star base, high winged back, accent stripe and pillows
  'gaming-chair': {
    footprint: [0.66, 0.7], height: 1.22, params: ['color'], tags: ['kids', 'office', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Gaming Chair');
      const body = std(it.color ? hex(it.color) : colors.fabric, { roughness: 0.55 }), accent = std(colors.accent, { roughness: 0.6 });
      const metal = std(0x1e293b, { metalness: 0.7, roughness: 0.35 });
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.05, 0.06, 0.05, 12), metal, 0, 0.055, 0));
      for (let k = 0; k < 5; k++) {
        const a = k * Math.PI * 2 / 5 + Math.PI / 5, x = Math.sin(a) * 0.15, z = Math.cos(a) * 0.15;
        const sp = box(0.05, 0.03, 0.3, metal, x, 0.05, z); sp.rotation.y = a; g.add(sp);
        g.add(mesh(THREE, new THREE.SphereGeometry(0.03, 8, 6), std(0x0f172a, { roughness: 0.4 }), Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3));
      }
      g.add(mesh(THREE, new THREE.CylinderGeometry(0.03, 0.035, 0.34, 10), metal, 0, 0.25, 0));
      g.add(box(0.5, 0.1, 0.5, body, 0, 0.45, 0.02));                                 // seat
      g.add(box(0.12, 0.012, 0.44, accent, 0, 0.506, 0.03));                          // seat stripe
      for (const s of [-1, 1]) g.add(box(0.08, 0.14, 0.44, body, s * 0.25, 0.49, 0.02));   // bolsters
      const back = new THREE.Group(); back.position.set(0, 0.42, -0.22); back.rotation.x = -0.12; g.add(back);
      back.add(box(0.5, 0.76, 0.1, body, 0, 0.42, 0));
      back.add(box(0.12, 0.66, 0.012, accent, 0, 0.42, 0.055));                       // back stripe
      for (const s of [-1, 1]) back.add(box(0.08, 0.5, 0.14, body, s * 0.25, 0.3, 0.03));   // wings
      back.add(box(0.24, 0.1, 0.06, accent, 0, 0.7, 0.08));                           // headrest pillow
      back.add(box(0.3, 0.12, 0.06, accent, 0, 0.2, 0.08));                           // lumbar pillow
      for (const s of [-1, 1]) { g.add(box(0.04, 0.2, 0.04, metal, s * 0.31, 0.6, 0.02)); g.add(box(0.08, 0.03, 0.26, std(0x0f172a, { roughness: 0.6 }), s * 0.31, 0.715, 0.0)); }
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.33, 0, -0.33, 0.33, 0.06, 0.33], color: '#1e293b' }, { shape: 'box', box: [-0.29, 0.4, -0.2, 0.29, 0.56, 0.27], color: 'role:fabric' }, { shape: 'box', box: [-0.29, 0.5, -0.36, 0.29, 1.22, -0.14], color: 'role:fabric' }],
  },

  // ---- building blocks: a wobbly tower with a roof block, a couple more strewn beside it (y: 0.77 puts it on a desk)
  'building-blocks': {
    footprint: [0.3, 0.25], height: 0.38, params: ['y', 'color', 'n'], tags: ['kids', 'living', 'bedroom'],
    create(it, { THREE, std, box, group, hex, rng }) {
      const g = group('Building Blocks'), n = Math.max(2, Math.min(6, it.n || 4)), s = 0.08;
      let last = it.color ? hex(it.color) : -1;
      for (let i = 0; i < n; i++) {
        const c = i === 0 && it.color ? hex(it.color) : pickCandy(rng, last); last = c;
        const b = box(s, s, s, std(c, { roughness: 0.6 }), (rng() - 0.5) * 0.02, s / 2 + i * s, (rng() - 0.5) * 0.02); b.rotation.y = (rng() - 0.5) * 0.6; g.add(b);
      }
      const roof = mesh(THREE, new THREE.ConeGeometry(0.062, 0.06, 4), std(pickCandy(rng, last), { roughness: 0.6 }), 0, n * s + 0.03, 0); roof.rotation.y = Math.PI / 4 + (rng() - 0.5) * 0.4; g.add(roof);
      const b1 = box(s, s, s, std(pickCandy(rng), { roughness: 0.6 }), 0.1, s / 2, 0.08); b1.rotation.y = 0.5; g.add(b1);
      const b2 = box(0.1, 0.04, 0.05, std(pickCandy(rng), { roughness: 0.6 }), -0.09, 0.02, -0.07); b2.rotation.y = -0.6; g.add(b2);
      const cyl = mesh(THREE, new THREE.CylinderGeometry(0.03, 0.03, 0.08, 12), std(pickCandy(rng), { roughness: 0.6 }), -0.1, 0.04, 0.07); g.add(cyl);
      return g;
    },
    iso: [{ shape: 'box', box: [-0.05, 0, -0.05, 0.05, 0.38, 0.05], color: '#e05252' }, { shape: 'box', box: [-0.15, 0, -0.12, 0.15, 0.08, 0.14], color: '#4a86e8' }],
  },

  // ---- height chart: a wall-mounted growth ruler — back flat on the wall at z = 0, coloured marks up the side
  'height-chart': {
    footprint: [0.2, 0.04], height: 1.5, params: ['color'], tags: ['kids', 'bedroom', 'hall'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const g = group('Height Chart');
      const board = std(it.color ? hex(it.color) : colors.linen, { roughness: 0.7 });
      g.add(box(0.2, 1.48, 0.02, board, 0, 0.76, 0.01));
      const ink = std(0x1f2937, { roughness: 0.6 });   // not 0x1e293b: theme() reads that as the cabinet role
      for (let y = 0.2; y <= 1.5; y += 0.1) g.add(box(Math.abs(Math.round(y * 10)) % 5 === 0 ? 0.07 : 0.04, 0.008, 0.004, ink, -0.06, y, 0.022));   // ticks, long at every half metre
      let last = -1; for (const y of [0.55, 0.78, 0.96, 1.18]) { const c = pickCandy(rng, last); last = c; g.add(box(0.09, 0.03, 0.006, std(c, { roughness: 0.6 }), 0.04, y, 0.023)); }   // dated marks
      const star = mesh(THREE, new THREE.ConeGeometry(0.035, 0.05, 4), std(0xf5d547, { roughness: 0.6 }), 0.04, 1.42, 0.026); star.scale.z = 0.2; g.add(star);   // a flat star at the top, proud of the board face
      return g;
    },
    iso: [{ shape: 'box', box: [-0.1, 0.02, 0, 0.1, 1.5, 0.02], color: 'role:linen' }],
  },

  // ---- teddy bear: sat down, faceted spheres — on the floor, or y: sets it on a bed or shelf
  'teddy-bear': {
    footprint: [0.35, 0.3], height: 0.45, params: ['y', 'color'], tags: ['kids', 'bedroom'],
    create(it, { THREE, std, group, hex, rng }) {
      const g = group('Teddy Bear');
      const fur = it.color ? hex(it.color) : [0xb45309, 0x8b5a2b, 0xd9b48f, 0x6b7280][Math.floor(rng() * 4)];
      const furMat = std(fur, { roughness: 0.95, flatShading: true }), pale = std(0xe8d5b7, { roughness: 0.95, flatShading: true }), dark = std(0x1c1917, { roughness: 0.4 });
      const body = mesh(THREE, new THREE.SphereGeometry(0.12, 10, 8), furMat, 0, 0.15, 0); body.scale.set(1, 1.1, 0.9); g.add(body);
      g.add(mesh(THREE, new THREE.SphereGeometry(0.1, 10, 8), furMat, 0, 0.33, 0));
      for (const s of [-1, 1]) g.add(mesh(THREE, new THREE.SphereGeometry(0.035, 8, 6), furMat, s * 0.075, 0.41, -0.01));
      g.add(mesh(THREE, new THREE.SphereGeometry(0.045, 8, 6), pale, 0, 0.31, 0.08));
      g.add(mesh(THREE, new THREE.SphereGeometry(0.014, 6, 5), dark, 0, 0.32, 0.12));
      for (const s of [-1, 1]) g.add(mesh(THREE, new THREE.SphereGeometry(0.011, 6, 5), dark, s * 0.035, 0.355, 0.088));
      for (const s of [-1, 1]) { const arm = mesh(THREE, new THREE.SphereGeometry(0.045, 8, 6), furMat, s * 0.13, 0.17, 0.03); arm.scale.set(1, 1.3, 1); g.add(arm); }
      for (const s of [-1, 1]) { const leg = mesh(THREE, new THREE.SphereGeometry(0.055, 8, 6), furMat, s * 0.08, 0.055, 0.1); leg.scale.set(1, 1, 1.4); g.add(leg); }
      g.add(mesh(THREE, new THREE.SphereGeometry(0.03, 8, 6), pale, 0, 0.12, 0.1));   // tummy
      return g;
    },
    iso: [{ shape: 'blob', box: [-0.13, 0, -0.11, 0.13, 0.27, 0.18], color: '#b45309' }, { shape: 'blob', box: [-0.1, 0.23, -0.1, 0.1, 0.45, 0.1], color: '#b45309' }],
  },
});
