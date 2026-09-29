// Lighting — lamps, pendants, sconces and the small glowing things. Every shade is an emissive
// MeshStandardMaterial (emissiveIntensity ≈ 0.3, neon higher): the scene caps dynamic lights, so nothing here adds
// a PointLight. Same contract as decor.js: floor origin, faces +z at rot 0, role colours from ctx.colors, seeded
// detail from ctx.rng, an iso hint per prop.
//
// Ceiling-hung props (pendant-lamp, chandelier, ceiling-light). house-builder lifts an item's origin by it.y, so:
//   y given  → the origin IS the ceiling anchor and the fixture hangs down from local y = 0 (spec y = ceiling
//              height; 0 is a valid anchor, not "no y")
//   no y     → the origin is the floor and the fixture hangs from ctx.H (the level's ceiling — house-builder's
//              propCtx threads it through) or else a 2.5 m ceiling (the sheet, the catalog, quick specs)
// Either way the measured box is the drop, which is what `height` declares. The iso hints are written for the
// floor-origin case (canopy at 2.5).
// Wall-mounted props (wall-sconce, neon-sign) keep their back at z = 0 and extend into +z. Same y rule as
// bathroom.js's mountY: with y set the bottom edge sits at local y = 0 and the spec's y is the mounting height of
// that edge; without it the prop mounts itself at its natural height above the floor origin (sconce 1.5, sign 1.3),
// so a terse spec never leaves a sconce on the floor. `height` is the prop's own extent either way; the iso hints
// are written for the no-y case.
import { registerProps } from './registry.js';

const CEILING = 2.5;
const ceilingTop = (it, ctx) => (it.y !== undefined ? 0 : (ctx && ctx.H > 0 ? ctx.H : CEILING));
const mountY = (it, natural) => (it.y !== undefined ? 0 : natural);

// ---- small builders shared by the props below
const cyl = (THREE, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16, open = false) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
};
const ball = (THREE, r, mat, x = 0, y = 0, z = 0, seg = 12) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m;
};
// a cylinder from point a to point b (legs, arms, struts)
const strut = (THREE, a, b, r, mat, seg = 8) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true; return m;
};
const tube = (THREE, curve, r, mat, segs = 24, radial = 8, closed = false) => {
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, radial, closed), mat); m.castShadow = true; return m;
};
const shadeMat = (THREE, std, color, extra = {}) => std(color, { side: THREE.DoubleSide, roughness: 0.9, emissive: 0xfff1d6, emissiveIntensity: 0.3, ...extra });
// the default fabric shade: the linen role warmed a touch, so a lit drum reads as cloth rather than paper
const linenShade = (mix, colors) => mix(colors.linen, 0xfde68a, 0.12);
// an open drum shade with a top cap and slim metal rims top and bottom (the rims give a white drum an edge)
// Every part of a lamp's head (the shade, its rims, the bulb) is tagged userData.lampHead — the shade itself 'shade' —
// so fixtures.ts can swap the head for another kind (rooms[].fixtures.lamp, or a seeded pick under `defaults: 2`: a
// globe, a cone, a mushroom dome, a tripod) on the floor, arc, tripod and table lamps houses actually place.
const headOf = (m, what: true | 'shade' = true) => { m.userData.lampHead = what; return m; };
const drum = (THREE, std, g, r, h, y, z, shade, metal, seg = 24) => {
  g.add(headOf(cyl(THREE, r, r, h, shade, 0, y, z, seg, true), 'shade'));
  g.add(headOf(cyl(THREE, r, r, 0.01, shade, 0, y + h / 2 - 0.005, z, seg)));
  const rim = metalMat(std, metal, { side: THREE.DoubleSide });
  g.add(headOf(cyl(THREE, r + 0.004, r + 0.004, 0.012, rim, 0, y + h / 2 - 0.006, z, seg, true)));
  g.add(headOf(cyl(THREE, r + 0.004, r + 0.004, 0.012, rim, 0, y - h / 2 + 0.006, z, seg, true)));
};
const metalMat = (std, color, extra = {}) => std(color, { metalness: 0.75, roughness: 0.35, ...extra });
const bulbMat = std => std(0xfff4dc, { emissive: 0xffe2a8, emissiveIntensity: 0.9, roughness: 0.4 });
const flameMat = std => std(0xffc25c, { emissive: 0xff9f2e, emissiveIntensity: 1.2, roughness: 0.5 });
const flame = (THREE, std, x, y, z, r = 0.014) => { const f = ball(THREE, r, flameMat(std), x, y, z, 8); f.scale.y = 1.6; f.castShadow = false; return f; };
const STONE = 0xd6d3d1, CABLE = 0x1f2937;

// A lamp is switched on by the hour, not by the prop: every glowing part of the lamps below (shades, bulbs, the
// string lights' bulbs) is tagged userData.fixture = 'lamp', so the environment scales its emissive by the lamp
// gain — off in daylight, warm at dusk — like the ceiling fixtures in assets/fixtures.ts. The authored intensity
// is kept in material.userData.fixtureBase. Candles, the lantern's flame and neon glow whatever the hour.
const ALWAYS_LIT = new Set(['candle-set', 'lantern', 'neon-sign']);
const switchedByGain = (defs: Record<string, any>) => {
  for (const [type, def] of Object.entries(defs)) {
    if (ALWAYS_LIT.has(type)) continue;
    const create = def.create;
    def.create = (it, ctx) => {
      const g = create(it, ctx);
      g.traverse(m => {
        const mat = m.isMesh && m.material;
        if (!mat || Array.isArray(mat) || !mat.emissive || !(mat.emissiveIntensity > 0) || mat.emissive.getHex() === 0) return;
        m.userData.fixture = 'lamp';
        if (mat.userData.fixtureBase === undefined) mat.userData.fixtureBase = mat.emissiveIntensity;
      });
      return g;
    };
  }
  return defs;
};

registerProps(switchedByGain({
  // Slim floor lamp: metal disc base, one stem, a linen drum. The default lamp a room asks for.
  'floor-lamp': {
    footprint: [0.4, 0.4], height: 1.65, params: ['color', 'h'], tags: ['living', 'bedroom', 'office', 'hall'],
    create(it, { THREE, std, group, colors, hex, mix }) {
      const g = group('Floor Lamp'), h = it.h || 1.65, metal = metalMat(std, colors.metal);
      g.add(cyl(THREE, 0.13, 0.15, 0.025, metal, 0, 0.0125, 0, 20));
      g.add(cyl(THREE, 0.012, 0.012, h - 0.3 - 0.025, metal, 0, (h - 0.3 + 0.025) / 2, 0, 8));
      drum(THREE, std, g, 0.2, 0.3, h - 0.15, 0, shadeMat(THREE, std, it.color ? hex(it.color) : linenShade(mix, colors)), colors.metal);
      g.add(headOf(ball(THREE, 0.035, bulbMat(std), 0, h - 0.2, 0, 10)));
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.15, 0, -0.15, 0.15, 0.03, 0.15], color: 'role:metal' },
      { shape: 'cyl', box: [-0.2, 1.35, -0.2, 0.2, 1.65, 0.2], color: 'role:linen' },
    ],
  },

  // Arc lamp: a stone block at the back, a stem, a steel arc that reaches forward (+z) over whatever sits in
  // front of it, and a drum shade hanging from the tip. Origin is the footprint centre, so the base sits at −z.
  'arc-floor-lamp': {
    footprint: [0.45, 1.55], height: 2.15, params: ['color'], tags: ['living', 'office', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Arc Floor Lamp'), metal = metalMat(std, colors.metal), bz = -0.6, tz = 0.55;
      g.add(box(0.36, 0.05, 0.36, std(STONE, { roughness: 0.4 }), 0, 0.025, bz));
      g.add(cyl(THREE, 0.016, 0.016, 1.25, metal, 0, 0.05 + 0.625, bz, 10));
      // rises vertically, sweeps forward, and comes straight down into the shade
      const arc = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 1.3, bz), new THREE.Vector3(0, 2.25, bz), new THREE.Vector3(0, 2.25, tz), new THREE.Vector3(0, 1.96, tz));
      g.add(tube(THREE, arc, 0.016, metal, 28, 8));
      g.add(cyl(THREE, 0.006, 0.006, 0.09, std(CABLE), 0, 1.92, tz, 6));
      drum(THREE, std, g, 0.22, 0.22, 1.77, tz, shadeMat(THREE, std, it.color ? hex(it.color) : linenShade(mix, colors)), colors.metal);
      g.add(headOf(ball(THREE, 0.035, bulbMat(std), 0, 1.74, tz, 10)));
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.18, 0, -0.78, 0.18, 0.05, -0.42], color: '#d6d3d1' },
      { shape: 'box', box: [-0.02, 0.05, -0.62, 0.02, 2.1, -0.58], color: 'role:metal' },
      { shape: 'box', box: [-0.02, 2.07, -0.6, 0.02, 2.15, 0.55], color: 'role:metal' },
      { shape: 'cyl', box: [-0.22, 1.66, 0.33, 0.22, 1.89, 0.77], color: 'role:linen' },
    ],
  },

  // Tripod lamp: three splayed timber legs into a steel collar, a wide drum on top.
  'tripod-floor-lamp': {
    footprint: [0.5, 0.52], height: 1.64, params: ['color'], tags: ['living', 'bedroom', 'office'],
    create(it, { THREE, std, group, colors, hex, mix }) {
      const g = group('Tripod Floor Lamp'), metal = metalMat(std, colors.metal), wood = std(colors.wood, { roughness: 0.55 });
      for (let k = 0; k < 3; k++) {
        const a = Math.PI / 2 + k * 2 * Math.PI / 3, fx = 0.26 * Math.cos(a), fz = 0.26 * Math.sin(a);
        g.add(cyl(THREE, 0.025, 0.025, 0.02, metal, fx, 0.01, fz, 10));
        g.add(strut(THREE, [fx, 0.02, fz], [0.03 * Math.cos(a), 1.2, 0.03 * Math.sin(a)], 0.02, wood, 8));
      }
      g.add(cyl(THREE, 0.05, 0.05, 0.08, metal, 0, 1.2, 0, 14));
      g.add(cyl(THREE, 0.012, 0.012, 0.12, metal, 0, 1.29, 0, 8));
      drum(THREE, std, g, 0.24, 0.3, 1.49, 0, shadeMat(THREE, std, it.color ? hex(it.color) : linenShade(mix, colors)), colors.metal);
      g.add(headOf(ball(THREE, 0.035, bulbMat(std), 0, 1.44, 0, 10)));
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.03, 0, 0.2, 0.03, 1.2, 0.28], color: 'role:wood' },
      { shape: 'box', box: [-0.26, 0, -0.16, -0.2, 1.2, -0.1], color: 'role:wood' },
      { shape: 'box', box: [0.2, 0, -0.16, 0.26, 1.2, -0.1], color: 'role:wood' },
      { shape: 'cyl', box: [-0.05, 1.16, -0.05, 0.05, 1.34, 0.05], color: 'role:metal' },
      { shape: 'cyl', box: [-0.24, 1.34, -0.24, 0.24, 1.64, 0.24], color: 'role:linen' },
    ],
  },

  // Pendant: canopy at the ceiling, a cord, a cone shade in the accent colour. y = ceiling height (see header).
  'pendant-lamp': {
    footprint: [0.4, 0.4], height: 0.75, params: ['y', 'drop', 'w', 'color'], tags: ['kitchen', 'dining', 'living', 'hall', 'bedroom'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex } = ctx;
      const g = group('Pendant Lamp'), top = ceilingTop(it, ctx), drop = it.drop || 0.75, w = it.w || 0.4, metal = metalMat(std, colors.metal);
      const shadeH = 0.22, shadeTop = top - drop + shadeH;
      g.add(cyl(THREE, 0.06, 0.06, 0.02, metal, 0, top - 0.01, 0, 16));
      g.add(cyl(THREE, 0.006, 0.006, top - 0.02 - shadeTop, std(CABLE), 0, (top - 0.02 + shadeTop) / 2, 0, 6));
      const c = it.color ? hex(it.color) : colors.accent;
      g.add(cyl(THREE, 0.06, w / 2, shadeH, shadeMat(THREE, std, c, { roughness: 0.6, emissive: c, emissiveIntensity: 0.3 }), 0, top - drop + shadeH / 2, 0, 24, true));
      g.add(ball(THREE, 0.035, bulbMat(std), 0, top - drop + 0.07, 0, 10));
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.06, 2.48, -0.06, 0.06, 2.5, 0.06], color: 'role:metal' },
      { shape: 'cyl', box: [-0.2, 1.75, -0.2, 0.2, 1.97, 0.2], color: 'role:accent' },
    ],
  },

  // Chandelier: canopy, stem, a hub with six rising arms, a candle and a glowing bulb on each, a finial below.
  'chandelier': {
    footprint: [0.8, 0.8], height: 0.9, params: ['y', 'drop', 'w', 'color'], tags: ['dining', 'living', 'hall', 'bedroom'],   // 29 meshes
    create(it, ctx) {
      const { THREE, std, group, colors, hex } = ctx;
      const g = group('Chandelier'), top = ceilingTop(it, ctx), drop = it.drop || 0.9, w = it.w || 0.8;
      const metal = metalMat(std, it.color ? hex(it.color) : colors.metal), wax = std(colors.linen, { roughness: 0.8 }), bulb = bulbMat(std);
      const hubY = top - drop + 0.25;
      g.add(cyl(THREE, 0.07, 0.07, 0.025, metal, 0, top - 0.0125, 0, 16));
      g.add(cyl(THREE, 0.01, 0.01, top - 0.025 - hubY, metal, 0, (top - 0.025 + hubY) / 2, 0, 8));
      g.add(ball(THREE, 0.07, metal, 0, hubY, 0, 14));
      g.add(cyl(THREE, 0.012, 0.012, 0.16, metal, 0, hubY - 0.13, 0, 8));
      g.add(ball(THREE, 0.045, metal, 0, hubY - 0.205, 0, 12));
      const R = w / 2 - 0.03;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.01, 8, 36), metal); ring.rotation.x = Math.PI / 2; ring.position.y = hubY + 0.12; ring.castShadow = true; g.add(ring);
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3, tx = R * Math.cos(a), tz = R * Math.sin(a), ty = hubY + 0.12;
        g.add(strut(THREE, [0.05 * Math.cos(a), hubY, 0.05 * Math.sin(a)], [tx, ty, tz], 0.015, metal, 8));
        g.add(cyl(THREE, 0.03, 0.02, 0.03, metal, tx, ty + 0.015, tz, 12));
        g.add(cyl(THREE, 0.016, 0.016, 0.13, wax, tx, ty + 0.03 + 0.065, tz, 10));
        g.add(ball(THREE, 0.025, bulb, tx, ty + 0.19, tz, 10));
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.02, 1.85, -0.02, 0.02, 2.5, 0.02], color: 'role:metal' },
      { shape: 'blob', box: [-0.4, 1.8, -0.4, 0.4, 2.05, 0.4], color: 'role:metal' },
    ],
  },

  // Flush ceiling light: a shallow linen drum under a metal rim. y = ceiling height (see header).
  'ceiling-light': {
    footprint: [0.38, 0.38], height: 0.1, params: ['y', 'w', 'color'], tags: ['hall', 'bedroom', 'bathroom', 'kitchen', 'office', 'kids'],
    create(it, ctx) {
      const { THREE, std, group, colors, hex, mix } = ctx;
      const g = group('Ceiling Light'), top = ceilingTop(it, ctx), r = (it.w || 0.38) / 2;
      g.add(cyl(THREE, r - 0.004, r - 0.03, 0.1, shadeMat(THREE, std, it.color ? hex(it.color) : linenShade(mix, colors), { emissiveIntensity: 0.4 }), 0, top - 0.05, 0, 24));
      g.add(cyl(THREE, r, r - 0.01, 0.025, metalMat(std, colors.metal, { side: THREE.DoubleSide }), 0, top - 0.02, 0, 24, true));
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.19, 2.4, -0.19, 0.19, 2.5, 0.19], color: 'role:linen' }],
  },

  // Wall sconce: back plate on the wall (z = 0), a short arm, a small drum shade. Bottom edge at local y = 0 when
  // the spec gives y (the mounting height); without y it mounts itself at 1.5 (bottom edge, so the shade sits at eye height).
  'wall-sconce': {
    footprint: [0.18, 0.24], height: 0.3, params: ['y', 'color'], tags: ['hall', 'bedroom', 'living', 'bathroom', 'dining'],
    create(it, { THREE, std, box, group, colors, hex, mix }) {
      const g = group('Wall Sconce'), metal = metalMat(std, colors.metal), m = mountY(it, 1.5);
      g.add(box(0.12, 0.26, 0.02, metal, 0, m + 0.13, 0.01));
      g.add(box(0.02, 0.02, 0.12, metal, 0, m + 0.2, 0.08));
      drum(THREE, std, g, 0.09, 0.2, m + 0.2, 0.15, shadeMat(THREE, std, it.color ? hex(it.color) : linenShade(mix, colors)), colors.metal, 20);
      g.add(ball(THREE, 0.03, bulbMat(std), 0, m + 0.17, 0.15, 10));
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.06, 1.5, 0, 0.06, 1.76, 0.02], color: 'role:metal' },
      { shape: 'cyl', box: [-0.09, 1.6, 0.06, 0.09, 1.8, 0.24], color: 'role:linen' },
    ],
  },

  // Articulated desk lamp on a surface: disc base, two arms over a knuckle, a cone head aimed down and forward.
  'desk-lamp': {
    footprint: [0.18, 0.4], height: 0.46, surface: true, params: ['color'], tags: ['office', 'bedroom', 'kids'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Desk Lamp'), metal = metalMat(std, colors.metal), bz = -0.06;
      g.add(cyl(THREE, 0.085, 0.09, 0.02, metal, 0, 0.01, bz, 20));
      g.add(ball(THREE, 0.02, metal, 0, 0.03, bz, 10));
      g.add(strut(THREE, [0, 0.03, bz], [0, 0.3, -0.14], 0.011, metal));
      g.add(ball(THREE, 0.022, metal, 0, 0.3, -0.14, 10));
      g.add(strut(THREE, [0, 0.3, -0.14], [0, 0.42, 0.12], 0.011, metal));
      g.add(ball(THREE, 0.02, metal, 0, 0.42, 0.12, 10));
      // the head is plain metal, DoubleSide so the mouth shows its inside; the glow is the disc in the mouth
      // (metalness stays > 0.5: the material kit's theme() would otherwise repaint a colors.metal head as 'cabinet')
      const head = cyl(THREE, 0.02, 0.07, 0.12, metalMat(std, it.color ? hex(it.color) : colors.metal, { side: THREE.DoubleSide, roughness: 0.4 }), 0, 0.38, 0.15, 18, true);
      head.rotation.x = -0.7; g.add(head);
      const disc = cyl(THREE, 0.055, 0.055, 0.006, bulbMat(std), 0, 0.335, 0.19, 18); disc.rotation.x = -0.7; disc.castShadow = false; g.add(disc);
      return g;
    },
    iso: [
      { shape: 'cyl', box: [-0.09, 0, -0.15, 0.09, 0.02, 0.03], color: 'role:metal' },
      { shape: 'box', box: [-0.012, 0.02, -0.15, 0.012, 0.42, 0.12], color: 'role:metal' },
      { shape: 'cyl', box: [-0.07, 0.3, 0.1, 0.07, 0.44, 0.25], color: 'role:metal' },
    ],
  },

  // Floor lantern: a steel frame with glass sides, a pyramid lid and a carry ring, a candle burning inside.
  'lantern': {
    footprint: [0.22, 0.22], height: 0.57, params: ['w', 'color'], tags: ['outdoor', 'patio', 'living', 'bedroom', 'bathroom', 'hall'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Lantern'), s = it.w || 0.22, metal = metalMat(std, it.color ? hex(it.color) : colors.metal);
      g.add(box(s, 0.03, s, metal, 0, 0.015, 0));
      g.add(box(s, 0.03, s, metal, 0, 0.395, 0));
      const lid = new THREE.Mesh(new THREE.ConeGeometry(s * 0.5 * Math.SQRT2 * 0.96, 0.07, 4).rotateY(Math.PI / 4), metal); lid.position.y = 0.445; lid.castShadow = true; g.add(lid);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 20), metal); ring.position.y = 0.51; ring.castShadow = true; g.add(ring);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.015, 0.35, 0.015, metal, sx * (s / 2 - 0.0075), 0.205, sz * (s / 2 - 0.0075)));
      g.add(box(s - 0.03, 0.35, s - 0.03, std(0xdbeafe, { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1 }), 0, 0.205, 0, false));
      g.add(cyl(THREE, 0.03, 0.03, 0.12, std(colors.linen, { roughness: 0.8 }), 0, 0.09, 0, 12));
      g.add(flame(THREE, std, 0, 0.17, 0));
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.11, 0, -0.11, 0.11, 0.41, 0.11], color: '#dbeafe' },
      { shape: 'box', box: [-0.06, 0.41, -0.06, 0.06, 0.57, 0.06], color: 'role:metal' },
    ],
  },

  // String lights: a cable swagged between two timber posts on weighted bases, warm bulbs along the sag. The swag
  // runs left-right (along x), so at rot 0 it is seen face-on from +z. w = span between the posts.
  'string-lights': {
    footprint: [3.3, 0.3], height: 2.2, params: ['w', 'h'], tags: ['outdoor', 'patio', 'garden', 'balcony', 'kids'],
    create(it, { THREE, std, box, group, colors, rng }) {
      const g = group('String Lights'), w = it.w || 3, h = it.h || 2.2, wood = std(colors.wood, { roughness: 0.6 }), base = std(0x374151, { roughness: 0.8 });
      for (const sx of [-1, 1]) {
        g.add(box(0.3, 0.06, 0.3, base, sx * w / 2, 0.03, 0));
        g.add(cyl(THREE, 0.03, 0.03, h - 0.06, wood, sx * w / 2, 0.06 + (h - 0.06) / 2, 0, 10));
      }
      const sag = 0.08 + 0.06 * w, topY = h - 0.05;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w / 2, topY, 0), new THREE.Vector3(0, topY - 2 * sag, 0), new THREE.Vector3(w / 2, topY, 0));
      g.add(tube(THREE, curve, 0.008, std(CABLE), 32, 6));
      const n = Math.max(4, Math.min(24, Math.round(w / 0.3)));
      for (let i = 1; i <= n; i++) {
        const p = curve.getPoint(i / (n + 1));
        const warm = 0.75 + rng() * 0.4;
        const b = ball(THREE, 0.042, std(0xffeab8, { emissive: 0xffc978, emissiveIntensity: warm, roughness: 0.4 }), p.x, p.y - 0.055, p.z, 10);
        b.scale.y = 1.3; b.castShadow = false; g.add(b);
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-1.65, 0, -0.15, -1.35, 2.2, 0.15], color: 'role:wood' },
      { shape: 'box', box: [1.35, 0, -0.15, 1.65, 2.2, 0.15], color: 'role:wood' },
      { shape: 'box', box: [-1.5, 1.85, -0.03, 1.5, 2.15, 0.03], color: '#fde68a' },
    ],
  },

  // Candle set on a surface: three pillar candles of stepped height on a metal tray, each with a flame.
  'candle-set': {
    footprint: [0.3, 0.16], height: 0.26, surface: true, params: ['color'], tags: ['living', 'dining', 'bedroom', 'bathroom'],
    create(it, { THREE, std, box, group, colors, hex, rng }) {
      const g = group('Candle Set'), wax = std(it.color ? hex(it.color) : colors.linen, { roughness: 0.85 });
      g.add(box(0.3, 0.015, 0.16, metalMat(std, colors.metal), 0, 0.0075, 0));
      const spec = [[-0.09, 0.22, 0.04], [0.01, 0.16, 0.035], [0.09, 0.12, 0.03]];
      for (const [x, h0, r] of spec) {
        const h = h0 * (0.9 + rng() * 0.2), z = (rng() - 0.5) * 0.04;
        g.add(cyl(THREE, r, r, h, wax, x, 0.015 + h / 2, z, 14));
        g.add(cyl(THREE, 0.002, 0.002, 0.012, std(0x1f2937), x, 0.015 + h + 0.006, z, 4));
        g.add(flame(THREE, std, x, 0.015 + h + 0.02, z, 0.011));
      }
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.15, 0, -0.08, 0.15, 0.015, 0.08], color: 'role:metal' },
      { shape: 'cyl', box: [-0.13, 0.015, -0.04, -0.05, 0.24, 0.04], color: 'role:linen' },
      { shape: 'cyl', box: [-0.025, 0.015, -0.035, 0.045, 0.18, 0.035], color: 'role:linen' },
      { shape: 'cyl', box: [0.06, 0.015, -0.03, 0.12, 0.14, 0.03], color: 'role:linen' },
    ],
  },

  // Neon sign: a glowing accent tube (heart | bolt | wave) on a clear acrylic panel with four standoffs, back on
  // the wall at z = 0. With a spec y the bottom edge is at local y = 0 (y ≈ 1.3 puts it above a credenza);
  // without one it mounts itself at 1.3.
  'neon-sign': {
    footprint: [0.7, 0.06], height: 0.5, params: ['y', 'w', 'h', 'shape', 'color'], tags: ['living', 'kids', 'office', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Neon Sign'), w = it.w || 0.7, h = it.h || 0.5, c = it.color ? hex(it.color) : colors.accent, m = mountY(it, 1.3);
      g.add(box(w, h, 0.01, std(0xffffff, { transparent: true, opacity: 0.12, roughness: 0.1 }), 0, m + h / 2, 0.005, false));
      const metal = metalMat(std, colors.metal);
      for (const [sx, sy] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { const s = cyl(THREE, 0.01, 0.01, 0.03, metal, sx * (w / 2 - 0.04), m + (sy ? h - 0.04 : 0.04), 0.015, 10); s.rotation.x = Math.PI / 2; g.add(s); }
      // glyph: normalised 2D points in [-0.5, 0.5] × [0, 1]; heart and wave are smooth tubes, the bolt is a polyline
      // drawn as struts with a ball at each corner (a TubeGeometry over sharp corners pinches and twists)
      const shape = it.shape || 'heart', glow = std(c, { emissive: c, emissiveIntensity: 1.6, roughness: 0.3 });
      const gw = w - 0.12, gh = h - 0.12, P = ([x, y]) => [x * gw, m + 0.06 + y * gh, 0.035];
      if (shape === 'bolt') {
        const v = [[0.18, 1], [-0.2, 0.48], [0.06, 0.48], [-0.18, 0]].map(P);
        for (let i = 1; i < v.length; i++) { g.add(strut(THREE, v[i - 1], v[i], 0.014, glow, 8)); if (i < v.length - 1) g.add(ball(THREE, 0.014, glow, ...v[i], 8)); }
        return g;
      }
      let pts, closed = false;
      if (shape === 'wave') { pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([t - 0.5, 0.5 + 0.4 * Math.sin(t * Math.PI * 3)]); } }
      else { closed = true; pts = []; for (let i = 0; i < 28; i++) { const t = i / 28 * Math.PI * 2; pts.push([16 * Math.sin(t) ** 3 / 34, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 17) / 30]); } }
      g.add(tube(THREE, new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...P(q))), closed, 'centripetal'), 0.014, glow, 64, 8, closed));
      return g;
    },
    iso: [
      { shape: 'box', box: [-0.35, 1.3, 0, 0.35, 1.8, 0.01], color: '#e2e8f0' },
      { shape: 'blob', box: [-0.22, 1.38, 0.02, 0.22, 1.76, 0.05], color: 'role:accent' },
    ],
  },
}));
