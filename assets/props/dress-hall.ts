// Dress types for the hall: the floor at the door and the wall beside it (plan 5.5 SMALL). DORMANT, like every dress type; these stand on the floor.
import { registerDress, dressType, box, vessel } from './dress-kit.js';
import { umbrella, mat, shoe } from './tableware.js';

registerDress({
  // An umbrella stand with three furled umbrellas leaning in it.
  'umbrella-stand': dressType({
    name: 'umbrella-stand', footprint: [0.22, 0.2], height: 0.98, rolls: 4, tags: ['hall'],
    build(k, it, u) {
      k.add('metal', vessel([[0.088, 0], [0.095, 0.42]], { seg: 16, wall: 0.008, floor: 0.012, depth: 0.06 }));
      umbrella(k, { x: -0.025, y: 0.34, z: 0.0, rz: 0.06 + u[0] * 0.04, ry: 0.4 }, { role: 'fabric' });
      umbrella(k, { x: 0.03, y: 0.34, z: 0.02, rz: -0.07 - u[1] * 0.03, ry: 2.4 }, { role: 'fabric' });
      umbrella(k, { x: 0.0, y: 0.34, z: -0.03, rx: -0.07, ry: 4.4 + u[2] * 0.4 }, { role: 'fabric' });
    },
  }),
  // A door mat: a pile slab with a panel of the second fabric.
  'door-mat': dressType({
    name: 'door-mat', footprint: [0.75, 0.45], height: 0.02, params: ['w', 'd', 'color'], rolls: 1, paint: 'rug', tags: ['hall'], surface: false, group: 'rug',
    build(k, it) { mat(k, {}, { w: Math.max(0.4, it.w || 0.75), d: Math.max(0.3, it.d || 0.45) }); },
  }),
  // Three pairs of shoes in a row by the door: tan leather, darker leather, cream canvas.
  'shoe-row': dressType({
    name: 'shoe-row', footprint: [0.61, 0.27], height: 0.11, rolls: 6, tags: ['hall'], surface: false,
    build(k, it, u) {
      ([['leather', 1], ['leather', 0.62], ['linen', 0.92]] as const).forEach(([role, sh], i) => { const x = -0.2 + i * 0.2; shoe(k, { x: x - 0.052, ry: (u[i] - 0.5) * 0.2 }, { upper: role, shade: sh }); shoe(k, { x: x + 0.052, ry: (u[i + 3] - 0.5) * 0.2 }, { upper: role, shade: sh }); });
    },
  }),
  // A tall mirror leaning on the wall behind it: a wooden frame and a mirror panel, its top resting 0.16 m back.
  'leaner-mirror': dressType({
    name: 'leaner-mirror', footprint: [0.57, 0.2], height: 1.58, rolls: 1, tags: ['hall', 'bedroom'], surface: false,
    build(k) {
      k.with({ rx: -0.1 }, () => {
        k.add('wood', box(0.56, 1.58, 0.04), { z: 0.02 });                    // pivot at the bottom of the BACK face, so nothing dips under the floor
        k.add('mirror', box(0.48, 1.5, 0.042), { y: 0.04, z: 0.021 });
      });
    },
  }),
}, { group: 'decor', surface: false });
