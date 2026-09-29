// Decor — the small things a room reads by. Reference module for the prop registry: three props showing the
// contract (floor origin, faces +z at rot 0, role colours from ctx.colors, seeded detail from ctx.rng, an iso hint).
import { registerProps } from './registry.js';

// a lamp variant's emissive shade is driven by the environment's lamp gain, like assets/props/lighting.ts's lamps: every
// mesh with an emissive material is tagged a lamp fixture and remembers its base intensity
const litLamp = (g: any) => g.traverse((m: any) => {
  const mat = m.isMesh && m.material;
  if (!mat || Array.isArray(mat) || !mat.emissive || !(mat.emissiveIntensity > 0) || mat.emissive.getHex() === 0) return;
  m.userData.fixture = 'lamp';
  if (mat.userData.fixtureBase === undefined) mat.userData.fixtureBase = mat.emissiveIntensity;
});

registerProps({
  'side-table': {
    footprint: [0.5, 0.5], height: 0.55, params: ['w', 'color'], tags: ['living', 'bedroom'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const w = it.w || 0.5, g = group('Side Table');
      const wood = std(it.color ? hex(it.color) : colors.wood, { roughness: 0.5 });
      g.add(box(w, 0.04, w, wood, 0, 0.53, 0));
      const legMat = std(colors.metal, { metalness: 0.8, roughness: 0.3 });
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(box(0.03, 0.51, 0.03, legMat, sx * (w / 2 - 0.04), 0.255, sz * (w / 2 - 0.04)));
      return g;
    },
    iso: [{ shape: 'box', box: [-0.25, 0.51, -0.25, 0.25, 0.55, 0.25], color: 'role:wood' }],
  },
  'table-lamp': {
    footprint: [0.3, 0.3], height: 0.5, surface: true, params: ['color'], tags: ['living', 'bedroom', 'office'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Table Lamp');
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.03, 16), std(colors.metal, { metalness: 0.7, roughness: 0.35 })); base.position.y = 0.015; g.add(base);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), std(colors.metal, { metalness: 0.7, roughness: 0.35 })); stem.position.y = 0.17; g.add(stem);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.2, 18, 1, true), std(it.color ? hex(it.color) : colors.linen, { side: THREE.DoubleSide, roughness: 0.9, emissive: 0xfff1d6, emissiveIntensity: 0.25 })); shade.position.y = 0.4; g.add(shade);
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.15, 0.3, -0.15, 0.15, 0.5, 0.15], color: 'role:linen' }],
  },
  'floor-cushion': {
    footprint: [0.6, 0.6], height: 0.18, params: ['color'], tags: ['living', 'kids'],
    create(it, { THREE, std, group, colors, hex, rng }) {
      const g = group('Floor Cushion');
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.6, 3, 1, 3), std(it.color ? hex(it.color) : (rng() < 0.5 ? colors.fabric : colors.accent), { roughness: 0.95 }));
      m.position.y = 0.09; m.rotation.y = (rng() - 0.5) * 0.4; m.castShadow = true; g.add(m); return g;
    },
    iso: [{ shape: 'box', box: [-0.3, 0, -0.3, 0.3, 0.18, 0.3], color: 'role:fabric' }],
  },

  // ---- table-lamp alternatives (plan S3: the fleet's 258 table lamps were one type) --------------------------------------
  // Same contract as table-lamp: a surface prop (placed at the top of what it stands on), a linen shade lit a little, the
  // shade tagged as a lamp fixture so the environment's lamp gain drives it (assets/props/lighting.ts's convention).
  // Ginger-jar lamp — a glazed lathe-turned jar, a brass cap and a linen drum (cottage, farmhouse, traditional).
  'ginger-lamp': {
    footprint: [0.34, 0.34], height: 0.58, surface: true, params: ['color', 'h'], tags: ['living', 'bedroom', 'hall'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Ginger Lamp'), V = (x, y) => new THREE.Vector2(x, y);
      const glaze = std(it.color ? hex(it.color) : colors.accent, { roughness: 0.25, flatShading: false });
      const jar = new THREE.Mesh(new THREE.LatheGeometry([V(0, 0), V(0.07, 0), V(0.1, 0.03), V(0.125, 0.11), V(0.125, 0.18), V(0.1, 0.25), V(0.06, 0.29), V(0.05, 0.3), V(0, 0.3)], 20), glaze);
      jar.castShadow = true; g.add(jar);
      const brass = std(colors.metal, { metalness: 0.7, roughness: 0.35 });
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.03, 14), brass); cap.position.y = 0.315; g.add(cap);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 8), brass); stem.position.y = 0.38; g.add(stem);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.2, 20, 1, true), std(colors.linen, { side: THREE.DoubleSide, roughness: 0.9, emissive: 0xfff1d6, emissiveIntensity: 0.25 }));
      shade.position.y = 0.47; g.add(shade); litLamp(g);
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.125, 0, -0.125, 0.125, 0.3, 0.125], color: 'role:accent' }, { shape: 'cyl', box: [-0.17, 0.37, -0.17, 0.17, 0.57, 0.17], color: 'role:linen' }],
  },
  // Column lamp — a fluted brass column on a square plinth under an empire shade (traditional, mid-century).
  'column-lamp': {
    footprint: [0.32, 0.32], height: 0.56, surface: true, params: ['color'], tags: ['living', 'bedroom', 'hall', 'study'],
    create(it, { THREE, std, box, group, colors, hex }) {
      const g = group('Column Lamp'), brass = std(colors.metal, { metalness: 0.75, roughness: 0.3 });
      g.add(box(0.13, 0.03, 0.13, brass, 0, 0.015, 0));
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.3, 8), brass); col.position.y = 0.18; col.castShadow = true; g.add(col);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), brass); ball.position.y = 0.34; g.add(ball);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 18, 1, true), std(it.color ? hex(it.color) : colors.linen, { side: THREE.DoubleSide, roughness: 0.9, emissive: 0xfff1d6, emissiveIntensity: 0.25 }));
      shade.position.y = 0.45; g.add(shade); litLamp(g);
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.03, 0, -0.03, 0.03, 0.35, 0.03], color: 'role:metal' }, { shape: 'cyl', box: [-0.16, 0.35, -0.16, 0.16, 0.55, 0.16], color: 'role:linen' }],
  },
  // Globe lamp — an opal glass globe on a slim tapered stem (modern, scandi).
  'globe-lamp': {
    footprint: [0.3, 0.3], height: 0.5, surface: true, params: ['color'], tags: ['living', 'bedroom', 'office'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Globe Lamp'), foot = std(it.color ? hex(it.color) : colors.metal, { metalness: 0.6, roughness: 0.4 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.025, 20), foot); base.position.y = 0.0125; g.add(base);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.25, 10), foot); stem.position.y = 0.15; stem.castShadow = true; g.add(stem);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 22, 16), std(0xf5f2ea, { roughness: 0.2, emissive: 0xfff1d6, emissiveIntensity: 0.3 }));
      globe.position.y = 0.37; g.add(globe); litLamp(g);
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.02, 0, -0.02, 0.02, 0.28, 0.02], color: 'role:metal' }, { shape: 'blob', box: [-0.13, 0.24, -0.13, 0.13, 0.5, 0.13], color: '#f5f2ea' }],
  },
  // Mushroom lamp — a lacquered dome on a stalk, the light shining down under it (mid-century, modern, industrial).
  'mushroom-lamp': {
    footprint: [0.36, 0.36], height: 0.4, surface: true, params: ['color'], tags: ['living', 'bedroom', 'office'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Mushroom Lamp'), lac = std(it.color ? hex(it.color) : colors.accent, { roughness: 0.3, metalness: 0.15 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 22), lac); base.position.y = 0.015; g.add(base);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.17, 18), lac); stalk.position.y = 0.115; stalk.castShadow = true; g.add(stalk);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.18, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), lac); dome.position.y = 0.2; dome.scale.y = 0.75; dome.castShadow = true; g.add(dome);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), std(0xfff1d6, { side: THREE.DoubleSide, roughness: 0.6, emissive: 0xfff1d6, emissiveIntensity: 0.4 }));
      glow.rotation.x = Math.PI / 2; glow.position.y = 0.198; g.add(glow); litLamp(g);
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.06, 0, -0.06, 0.06, 0.2, 0.06], color: 'role:accent' }, { shape: 'blob', box: [-0.18, 0.2, -0.18, 0.18, 0.34, 0.18], color: 'role:accent' }],
  },
  // Tripod table lamp — three splayed wooden legs under a drum shade (scandi, mid-century, cottage).
  'tripod-table-lamp': {
    footprint: [0.34, 0.34], height: 0.56, surface: true, params: ['color'], tags: ['living', 'bedroom', 'study'],
    create(it, { THREE, std, group, colors, hex }) {
      const g = group('Tripod Table Lamp'), wood = std(colors.wood, { roughness: 0.5 });
      const V = (x, y, z) => new THREE.Vector3(x, y, z);
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + Math.PI / 6, A = V(Math.sin(a) * 0.13, 0.01, Math.cos(a) * 0.13), B = V(0, 0.32, 0), d = B.clone().sub(A);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.015, d.length(), 8), wood);
        m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); m.castShadow = true; g.add(m);
      }
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 22, 1, true), std(it.color ? hex(it.color) : colors.linen, { side: THREE.DoubleSide, roughness: 0.9, emissive: 0xfff1d6, emissiveIntensity: 0.25 }));
      shade.position.y = 0.42; g.add(shade); litLamp(g);
      return g;
    },
    iso: [{ shape: 'cyl', box: [-0.13, 0, -0.13, 0.13, 0.32, 0.13], color: 'role:wood' }, { shape: 'cyl', box: [-0.14, 0.32, -0.14, 0.14, 0.52, 0.14], color: 'role:linen' }],
  },
});
