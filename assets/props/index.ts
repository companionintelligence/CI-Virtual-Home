// Prop registry — every prop that is not one of the page's 56 AssetFactory builders lives in a module under
// assets/props/, registered here by type. house-builder.js looks a room item's type up in ITEMS first, then in
// this registry; the validator, the catalog builder and the isometric twin read the same definitions, so a prop
// is added in exactly one place.
//
// A definition:
//   {
//     create(it, ctx)   → THREE.Object3D, origin at floor centre, facing SOUTH (+z) at rot 0 like every catalog item
//     footprint: [w, d] metres at rot 0 (the validator and the catalog read this)
//     height:    metres (≥ 1.1 makes it a routing obstacle for the door-to-core walk)
//     surface:   true when it sits on a desk / counter (placed at DESK_TOP, never an obstacle)
//     mountY:    metres — a wall-mounted prop's default height when the spec gives no `y` (wall-art 1.5, sconce 1.7 …)
//     params:    ['w', 'd', 'color', …] the spec keys it honours
//     iso:       [{ shape: 'box'|'blob'|'cyl', box: [x0, y0, z0, x1, y1, z1], color: '#hex' | 'role:wood' }, …]
//                local-space parts for generate_house_iso.py (defaults to one box of footprint × height)
//     tags:      ['living', 'kitchen', …]
//   }
// ctx = { THREE, std(color, extra), box(w,h,d,mat,x,y,z), group(name), mix(a,b,t), hex(c), colors (the material
// kit's role colours: fabric, fabric2, wood, cabinet, rug, accent, linen, metal, wall, trim), rng() seeded per item }
//
// Modules register with registerProps({ type: def, … }) and are imported below — add a line per category.
export { PROPS, registerProps, propTypes } from './registry.js';

// one line per category module — each registers its props on import
import './decor.js';
import './seating.js';
import './tables.js';
import './storage.js';
import './beds.js';
import './kitchen.js';
import './bathroom.js';
import './lighting.js';
import './soft.js';
import './plants.js';
import './kids.js';
import './office.js';
import './outdoor.js';
import './hobby.js';

// BAKED LAST — assets/props/baked.ts overrides registered types in place, so it stays the last import; another stream's module goes ABOVE this line
import './baked.js';
