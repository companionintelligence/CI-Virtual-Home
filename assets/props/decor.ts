// Decor — the small things a room reads by. Reference module for the prop registry: three props showing the
// contract (floor origin, faces +z at rot 0, role colours from ctx.colors, seeded detail from ctx.rng, an iso hint).
import { registerProps } from './registry.js';

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
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.2, 18, 1, true), std(it.color ? hex(it.color) : colors.linen, { side: THREE.DoubleSide, roughness: 0.9, emissive: 0xfff1d6, emissiveIntensity: 0.25 })); shade.position.y = 0.4; shade.userData.lampHead = 'shade'; g.add(shade);   // lampHead: fixtures.ts may swap the shade for another lamp kind
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
});
