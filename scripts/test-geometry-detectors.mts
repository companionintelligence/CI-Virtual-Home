#!/usr/bin/env -S node --experimental-strip-types
// The geometry behind the z-fighting and collision detectors (scripts/review/geom-lib.mts, collide-lib.mts), tested in Node on shapes whose
// answers are known. No browser, no GPU, no built assets: the browser halves (zfight.mts, collide.mts) are proved by their --selftest.
//   depth precision   the quantum of a 24-bit depth buffer at a distance, and the distance at which a gap stops being resolved
//   coplanar overlap  two triangles in one plane: the overlap area, who faces which way, a 1 mm gap in and a 3 mm gap out, a double-sided pane
//   hulls and SAT     an oriented box exactly, a hull from a triangle soup (cube, cylinder), the minimum translation distance of boxes (aligned,
//                     rotated), a pane poked through, separated shapes, the shared volume, the depth of a concave mesh's vertices
//   collisions        a scene dump with a sofa through a wall, a lamp sunk into a table, a dresser 1.5 cm into the wall, a lamp resting on a table,
//                     a chair under a table, a rug, a door swing, a slab void, an item under its floor: what is found and what the whitelist lets through
// @check-house quick
//
//   node --experimental-strip-types scripts/test-geometry-detectors.mts        (any cwd; about a second)
import { quantumAt, flickerBeyond, coplanarPairs, triOverlap, boxHull, boxFrom, meshHull, satPenetration, overlapVolume, sampleDepth, inside, type Vec3 } from './review/geom-lib.mts';
import { findCollisions, buildParts, type SceneDump, type Ent, type PartIn, type Catalog } from './review/collide-lib.mts';

let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail.split('\n').join('\n    ')}`}`); if (!ok) bad++; };
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ---- depth precision --------------------------------------------------------------------------------------------------------------------
{
  const q10 = quantumAt(10, 0.2, 160), q100 = quantumAt(100, 0.2, 160);
  check(near(q10, 100 / (0.2 * 2 ** 24) * (159.8 / 160), 1e-9) && q10 > 2.9e-5 && q10 < 3.0e-5, 'quantumAt: 30 um at 10 m (near 0.2, far 160)', String(q10));
  check(near(q100 / q10, 100, 1e-6), 'quantumAt grows with the square of the distance', String(q100 / q10));
  check(near(quantumAt(10, 0.05, 160) / q10, 4, 0.01), 'a near plane four times closer is four times coarser', String(quantumAt(10, 0.05, 160) / q10));
  check(flickerBeyond(0, 0.2, 160) === 0, 'coplanar surfaces fight at every distance');
  const g = 0.001, z = flickerBeyond(g, 0.2, 160);
  check(near(quantumAt(z, 0.2, 160), g, 1e-9) && z > 55 && z < 60, 'flickerBeyond: a 1 mm gap is lost beyond about 58 m, and quantumAt agrees there', `${z}`);
}

// ---- coplanar overlap ---------------------------------------------------------------------------------------------------------------------
const quad = (x0: number, z0: number, x1: number, z1: number, y: number, up = true): { pos: number[]; index: number[] } => ({
  pos: [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1],
  index: up ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3],   // (0,2,1): normal +y, (0,1,2): normal -y
});
{
  const a = quad(0, 0, 2, 2, 0), b = quad(1, 1, 3, 3, 0);
  const p = coplanarPairs([{ id: 1, ...a }, { id: 2, ...b }]);
  check(p.length === 1 && near(p[0].area, 1, 1e-9) && p[0].a === 1 && p[0].b === 2, 'two unit-offset squares in one plane: 1 m2 of overlap, one pair', JSON.stringify(p.map(x => [x.a, x.b, x.area])));
  check(near(p[0].gapMax, 0, 1e-12) && !p[0].opposed, 'gap 0, facing the same way');
  check(near(p[0].at[0], 1.5, 1e-6) && near(p[0].at[2], 1.5, 1e-6), 'the overlap is centred where it is', JSON.stringify(p[0].at));
  const c = coplanarPairs([{ id: 1, ...a }, { id: 2, ...quad(1, 1, 3, 3, 0.001) }]);
  check(c.length === 1 && near(c[0].gapMax, 0.001, 1e-9), 'a 1 mm gap is inside the 2 mm tolerance', JSON.stringify(c.map(x => x.gapMax)));
  check(coplanarPairs([{ id: 1, ...a }, { id: 2, ...quad(1, 1, 3, 3, 0.003) }]).length === 0, 'a 3 mm gap is outside it');
  check(coplanarPairs([{ id: 1, ...a }, { id: 2, ...quad(0, 0, 2, 2, 0, false) }]).length === 0, 'back to back (opposite facing, front faces only): not a fight');
  const d = coplanarPairs([{ id: 1, ...a }, { id: 2, ...quad(0, 0, 2, 2, 0, false), side: 2 }]);
  check(d.length === 1 && d[0].opposed && near(d[0].area, 4, 1e-9), 'a double-sided surface shows through the one behind it', JSON.stringify(d.map(x => [x.area, x.opposed])));
  check(coplanarPairs([{ id: 1, ...a }, { id: 2, ...quad(2, 0, 4, 2, 0) }]).length === 0, 'neighbours that only share an edge do not overlap');
  check(coplanarPairs([{ id: 1, pos: [...a.pos, ...quad(0, 0, 1, 1, 0).pos], index: [...a.index, ...[4, 6, 5, 4, 7, 6]] }]).length === 0, 'two triangle sets of one mesh never fight each other');
  check(coplanarPairs([{ id: 1, ...a }, { id: 2, ...quad(0, 0, 2, 2, 0.0005), side: 1 }]).length === 0, 'a back-face-only surface and a front-face-only surface do not meet in view');
  const t1 = triOverlap([0, 0, 0, 2, 0, 0, 0, 0, 2], [0, 0, 0, 2, 0, 0, 0, 0, 2], [0, -1, 0]);
  check(!!t1 && near(t1.area, 2, 1e-9), 'triOverlap of a triangle with itself is its area', JSON.stringify(t1));
}

// ---- hulls and SAT ------------------------------------------------------------------------------------------------------------------------
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const at = (x: number, y: number, z: number, rotY = 0) => { const c = Math.cos(rotY), s = Math.sin(rotY); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1]; };
{
  const A = boxHull(at(0, 0, 0), [0.5, 0.5, 0.5]), B = boxHull(at(0.8, 0, 0), [0.5, 0.5, 0.5]);
  const p = satPenetration(A, B);
  check(!!p && near(p.depth, 0.2, 1e-9) && near(p.axis[0], 1, 1e-9), 'two unit cubes 0.8 apart overlap by 0.2 along x', JSON.stringify(p));
  check(satPenetration(A, boxHull(at(1.2, 0, 0), [0.5, 0.5, 0.5])) === null, 'cubes 1.2 apart are separated');
  check(satPenetration(A, boxHull(at(1.0, 0, 0), [0.5, 0.5, 0.5])) === null, 'cubes that only touch do not overlap');
  // a unit cube yawed 45 deg with its centre 0.6 from a thick wall's face: its far corner reaches sqrt(2)/2 = 0.7071 -> 0.1071 in
  const wall = boxHull(at(0, 0, 0), [5, 1.4, 0.08]);   // face at z = 0.08 -> z = +0.08 is the slab's near face; put the cube on the other side
  const cube = boxHull(at(0, 0, 0.08 + 0.6, Math.PI / 4), [0.5, 0.5, 0.5]);
  const r = satPenetration(wall, cube);
  check(!!r && near(r.depth, Math.SQRT1_2 - 0.6, 1e-9), 'a yawed cube: depth is the corner (0.7071) minus the gap (0.6)', JSON.stringify(r));
  // a rotated box at the diagonal has no edge-edge axis shorter than its face axes here, but a wedge needs one: two boxes crossing at 45 deg
  const X = boxHull(at(0, 0, 0), [1, 0.1, 0.1]), Y = boxHull(at(0, 0, 0, Math.PI / 2), [1, 0.1, 0.1]);
  const cr = satPenetration(X, Y);
  check(!!cr && near(cr.depth, 0.2, 1e-9), 'two bars crossing: the push to clear is the bar\'s own width (0.2 along y, or the cross axis)', JSON.stringify(cr));
  // a pane (no thickness) with a box poked 0.3 through it
  const pane = meshHull([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]);
  const poke = boxHull(at(0, 0.1, 0), [0.2, 0.4, 0.2]);   // y -0.3 .. 0.5: 0.3 below, 0.5 above the pane
  const pp = satPenetration(pane!, poke);
  check(!!pane && pane.flat && !!pp && near(pp.depth, 0.3, 1e-9), 'a box through a pane: the shorter way out (0.3)', JSON.stringify(pp));
  check(near(overlapVolume(A, B, 20), 0.2, 0.2 * 0.08), 'overlapVolume of the two cubes: 0.2 m3', String(overlapVolume(A, B, 20)));
  check(overlapVolume(A, boxHull(at(2, 0, 0), [0.5, 0.5, 0.5])) === 0, 'no volume when they do not touch');
  check(inside(A, [0.4, 0.4, -0.4]) && !inside(A, [0.6, 0, 0]), 'inside() on a box');
}
{
  // a hull from a soup: the eight corners of a unit cube, and a 16-sided cylinder
  const corners: number[] = []; for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) corners.push(x, y, z);
  const hc = meshHull(corners)!;
  check(!hc.flat && hc.verts.length === 24 && hc.planes.length === 24 && near(overlapVolume(hc, boxHull(at(0.5, 0.5, 0.5), [0.5, 0.5, 0.5]), 12), 1, 0.05), 'meshHull of eight corners is the cube: six planes, 1 m3', `${hc.verts.length / 3} verts, ${hc.planes.length / 4} planes`);
  const cyl: number[] = []; const n = 16;
  for (let i = 0; i < n; i++) for (const y of [0, 1]) cyl.push(0.3 * Math.cos((i / n) * Math.PI * 2), y, 0.3 * Math.sin((i / n) * Math.PI * 2));
  const hy = meshHull(cyl)!;
  check(!hy.flat && hy.verts.length === 32 * 3 && hy.planes.length / 4 === 18, 'meshHull of a 16-sided cylinder: 16 sides and two caps', `${hy.verts.length / 3} verts, ${hy.planes.length / 4} planes`);
  // a round leg against a wall: the cylinder's own extent (0.3), not a box's corner
  const wallH = boxHull(at(0, 0.5, 0.4 + 0.2), [3, 1, 0.5]);   // z from 0.1 to 1.1 -> the near face at z = 0.1 (so 0.2 of the radius 0.3 is inside)... 
  const pen = satPenetration(hy, wallH);
  check(!!pen && near(pen.depth, 0.2, 1e-6), 'a cylinder of radius 0.3 against a face 0.1 from its axis: 0.2 deep (yaw does not matter)', JSON.stringify(pen));
  // a plant of two fronds: a concave mesh. Its hull is a big box; its vertices are two tips.
  const plant = [0, 0, 0, 0.1, 1, 0, -0.1, 1, 0,   0.6, 0.3, 0, 0.9, 0.35, 0.02, 0.6, 0.4, 0];   // a stem, and a frond reaching out at x 0.9
  const wall2 = boxHull(at(0.8, 0.5, 0), [0.3, 1, 1]);   // x from 0.5 to 1.1
  const hullPlant = meshHull(plant)!;
  const sat = satPenetration(hullPlant, wall2)!;
  const idx = [0, 1, 2, 3, 4, 5];
  const sd = sampleDepth(plant, idx, wall2);
  check(!!sat && sat.depth > 0.3 && near(sd, 0.2, 0.02), 'a concave mesh: the hull says deeper than its vertices do (frond tip 0.2 from the wall\'s far face)', `hull ${sat.depth.toFixed(3)} vs vertices ${sd.toFixed(3)}`);
}

// ---- the collision engine ------------------------------------------------------------------------------------------------------------------
let eid = 0, pid = 0;
const dump = (): SceneDump => ({ entities: [], parts: [], doors: [], levels: [{ id: 'l1', y: 0, height: 2.8 }, { id: 'l2', y: 3, height: 2.8 }], rooms: [{ level: 0, levelId: 'l1', name: 'R', bounds: { x: -5, z: -5, w: 10, d: 10 }, program: 'living', floorOffset: 0, y: 0, height: 2.8 }], voids: [] });
const ent = (d: SceneDump, role: string, type: string | null, extra: Partial<Ent> = {}, name = type || 'thing'): number => {
  const e: Ent = { i: d.entities.length, name, role, cat: null, itemType: type, room: role === 'item' ? 'R' : null, level: 0, onSurface: false, mounted: false, foliage: false, dress: false, stair: false, isWall: role === 'wall', at: [0, 0, 0], rotY: 0, ...extra };
  d.entities.push(e); eid++; return e.i;
};
const box = (d: SceneDump, e: number, size: Vec3, c: Vec3, rotY = 0, extra: Partial<PartIn> = {}) => d.parts.push({ id: ++pid, e, unit: null, wp: null, glass: false, geom: 'BoxGeometry', box: { m: at(c[0], c[1], c[2], rotY), c: [0, 0, 0], h: [size[0] / 2, size[1] / 2, size[2] / 2] }, ...extra });
const CAT: Catalog = {
  sofa: { group: 'seating', against: 'free' }, dresser: { group: 'storage', against: 'wall' }, 'side-table': { group: 'table', against: 'free', top: 0.55 },
  'table-lamp': { group: 'lamp', onSurface: true, surfaces: ['table', 'storage', 'desk'] }, 'dining-chair': { group: 'chair', tucks: true }, 'round-dining-table': { group: 'table' },
  'area-rug': { group: 'rug' }, 'wall-art': { group: 'art', hangs: 'wall', mountY: 1.5 },
};
const scene = (): { d: SceneDump; wall: number } => { const d = dump(); const wall = ent(d, 'wall', null, { isWall: true }, 'Parametric Wall (10m · SOUTH)'); box(d, wall, [10, 2.8, 0.16], [0, 1.4, 4.08]); return { d, wall }; };
const kinds = (d: SceneDump) => findCollisions(d, CAT);
{
  const { d } = scene();
  const sofa = ent(d, 'item', 'sofa'); box(d, sofa, [2.2, 0.8, 0.95], [3, 0.4, 3.95]);                       // through the slab and out of its far side
  const lampTable = ent(d, 'item', 'side-table'); box(d, lampTable, [0.6, 0.55, 0.6], [0, 0.275, -3]);
  const lamp = ent(d, 'item', 'table-lamp'); box(d, lamp, [0.25, 0.5, 0.25], [0, 0.72, -3]);                // 8 cm into the top
  const r = kinds(d);
  const f1 = r.findings.find(f => f.a.type === 'sofa'), f2 = r.findings.find(f => f.a.type === 'side-table' || f.b?.type === 'table-lamp');
  check(r.findings.length === 2, 'a sofa through a wall and a lamp sunk into a table: those two and nothing else', r.findings.map(f => `${f.kind} ${f.depth_cm}`).join('; '));
  check(!!f1 && f1.kind === 'prop-wall' && near(f1.depth_cm, 42.5, 0.1) && /pokes out/.test(f1.visible || ''), 'the sofa: 42.5 cm, out of the far side of the 16 cm wall', JSON.stringify(f1 && [f1.kind, f1.depth_cm, f1.visible]));
  check(!!f2 && f2.kind === 'prop-prop' && near(f2.depth_cm, 8, 0.1), 'the lamp: 8 cm into its table', JSON.stringify(f2 && [f2.kind, f2.depth_cm]));
  check(!!f1 && f1.volume_cm3 > 100000, 'the shared volume is reported (sofa in slab ~0.16 x 2.2 x 0.8 = 0.28 m3 = 281600 cm3)', String(f1 && f1.volume_cm3));
}
{
  const { d } = scene();
  const dresser = ent(d, 'item', 'dresser'); box(d, dresser, [1.2, 0.9, 0.5], [-0.5, 0.45, 3.765]);           // 1.5 cm into the wall: against a wall
  const sofa = ent(d, 'item', 'sofa'); box(d, sofa, [2.0, 0.8, 0.9], [-3, 0.4, 3.545]);                      // 5 mm off it
  const t = ent(d, 'item', 'side-table'); box(d, t, [0.6, 0.55, 0.6], [2, 0.275, 1]);
  const l = ent(d, 'item', 'table-lamp'); box(d, l, [0.25, 0.5, 0.25], [2, 0.79, 1]);                        // 1 cm into the top: resting
  const dt = ent(d, 'item', 'round-dining-table'); box(d, dt, [1.4, 0.75, 1.4], [-3.5, 0.375, 0]);
  const ch = ent(d, 'item', 'dining-chair'); box(d, ch, [0.45, 0.5, 0.5], [-3.5, 0.45, 0.7 + 0.25 - 0.09]);   // 9 cm under the table's edge: tucks
  const rug = ent(d, 'item', 'area-rug'); box(d, rug, [2, 0.02, 2], [0, 0.01, 0]);
  const rt = ent(d, 'item', 'side-table'); box(d, rt, [0.5, 0.5, 0.5], [0, 0.26, 0]);                        // 1 cm into the pile
  const art = ent(d, 'item', 'wall-art', { mounted: true }); box(d, art, [0.8, 0.6, 0.04], [2.5, 1.5, 3.99]);   // 1 cm in the wall plane
  const r = kinds(d);
  check(r.findings.length === 0, 'every legitimate contact at once: nothing found', r.findings.map(f => `${f.kind} ${f.a.type}/${f.b?.type ?? ''} ${f.depth_cm}`).join('; '));
  const rules = new Set(r.allowed.map(a => a.rule));
  check(['against-wall', 'on-surface', 'tucks', 'rug-pile'].every(x => rules.has(x) || (x === 'on-surface' && rules.has('resting'))), 'the whitelist names what let each one through', [...rules].join(','));
}
{
  // the same dresser 6 cm into the wall is a finding; a chair 20 cm into a table is too; a sofa floating into a table's top is not resting
  const { d } = scene();
  const dresser = ent(d, 'item', 'dresser'); box(d, dresser, [1.2, 0.9, 0.5], [-0.5, 0.45, 3.81]);
  const dt = ent(d, 'item', 'round-dining-table'); box(d, dt, [1.4, 0.75, 1.4], [-3.5, 0.375, 0]);
  const ch = ent(d, 'item', 'dining-chair'); box(d, ch, [0.45, 0.5, 0.5], [-3.5, 0.45, 0.7 + 0.25 - 0.2]);
  const r = kinds(d);
  check(r.findings.length === 2 && r.findings.some(f => f.a.type === 'dresser' && near(f.depth_cm, 6, 0.1)) && r.findings.some(f => near(f.depth_cm, 20, 0.1)), 'past the allowance they are findings (dresser 6 cm, chair 20 cm)', r.findings.map(f => `${f.kind} ${f.a.type} ${f.depth_cm}`).join('; '));
}
{
  // the structural checks: a door swing, a slab void, an item under its floor, an item through the ceiling
  const d = dump();
  const sofa = ent(d, 'item', 'sofa'); box(d, sofa, [1, 0.8, 1], [0.5, 0.4, 0.5]);
  const leafPose = (angle: number) => { const c = Math.cos(angle), s = Math.sin(angle); return [{ m: [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1], c: [0.4, 1, 0] as Vec3, h: [0.4, 1, 0.02] as Vec3 }]; };
  d.doors.push({ id: 'd1', level: 'l1', kind: 'interior', leaf: 'single', hinge: [0, 0], y0: 0.02, h: 2, w: 0.8, open: false, closed: 0, openA: Math.PI / 2, poses: [0, 1, 2, 3, 4, 5, 6, 7].map(i => leafPose(-(i / 7) * (Math.PI / 2))) });   // the leaf swings toward +z (the sofa's side)
  const r = kinds(d);
  const sw = r.findings.find(f => f.kind === 'door-swing');
  check(!!sw && sw.a.type === 'sofa' && sw.depth_cm > 50, 'a door whose leaf sweeps through a sofa: a door-swing finding (at 45 deg the leaf is 73 cm inside)', JSON.stringify(sw && [sw.kind, sw.depth_cm, sw.parts && sw.parts.b]));
  const d2 = dump(); const far = ent(d2, 'item', 'sofa'); box(d2, far, [1, 0.8, 1], [3, 0.4, 3]); d2.doors = d.doors;
  check(!kinds(d2).findings.some(f => f.kind === 'door-swing'), 'the same door with the sofa out of its swing: nothing');
  const up = dump(); up.voids.push({ level: 1, rect: { x: 0, z: 0, w: 1.5, d: 2.5 }, kind: 'stairwell' });
  const plant = ent(up, 'item', 'sofa', { level: 1, at: [0.6, 3, 0.6] }); box(up, plant, [1, 0.8, 1], [0.6, 3.4, 0.6]);
  const ok = ent(up, 'item', 'sofa', { level: 1, at: [3, 3, 3] }); box(up, ok, [1, 0.8, 1], [3, 3.4, 3]);
  const v = kinds(up).findings.filter(f => f.kind === 'slab-void');
  check(v.length === 1 && v[0].a.i === plant, 'an item standing over a stairwell opening: found; one beside it: not', JSON.stringify(v.map(f => [f.a.i, f.depth_cm])));
  const sunk = dump(); const s = ent(sunk, 'item', 'sofa'); box(sunk, s, [1, 0.8, 1], [0, 0.4 - 0.1, 0]);
  check(kinds(sunk).findings.some(f => f.kind === 'floor' && near(f.depth_cm, 10, 0.2)), 'an item 10 cm under its floor: a floor finding');
  const tall = dump(); const t = ent(tall, 'item', 'sofa'); box(tall, t, [1, 3.2, 1], [0, 1.6, 0]);
  check(kinds(tall).findings.some(f => f.kind === 'ceiling' && near(f.depth_cm, 42, 0.5)), 'an item 3.2 m tall under a 2.8 m ceiling: a ceiling finding', JSON.stringify(kinds(tall).findings.map(f => [f.kind, f.depth_cm])));
}
{
  // the ceiling check (D2): a column is meant to be taller than its storey, and an outdoor room has no ceiling to go through; anything else still does
  const ceilings = (d: SceneDump) => kinds(d).findings.filter(f => f.kind === 'ceiling');
  const mk = (type: string, h: number, program: string, extra: Partial<Ent> = {}) => {
    const d = dump(); d.rooms[0].program = program;
    const e = ent(d, 'item', type, extra); box(d, e, [0.3, h, 0.3], [0, h / 2, 0]);
    return d;
  };
  check(ceilings(mk('column', 6.1, 'living')).length === 0, 'a 6.1 m column in a living room: no ceiling finding (it carries the storeys above)');
  check(ceilings(mk('sofa', 3.2, 'outdoor')).length === 0, 'a 3.2 m item in a room whose program is outdoor: no ceiling finding');
  check(ceilings(mk('sofa', 3.2, 'living')).length === 1, 'the same item in a living room still goes through the ceiling (the check is only skipped, not removed)', JSON.stringify(ceilings(mk('sofa', 3.2, 'living')).map(f => f.depth_cm)));
  check(ceilings(mk('column', 6.1, 'outdoor')).length === 0 && ceilings(mk('hanging-plant', 3.2, 'sunroom')).length === 1, 'a hanging plant through a sunroom ceiling is still found; the skip is not "any room that opens to the outside"');
}
{
  // D1, the level of an entity (the page reads it in scripts/review/geom-page.mts `levelOfObj`; its self-test is collide.mts --selftest, part C): a
  // cord on the second storey given to the engine as level 0 is 99.5 cm through the first storey's ceiling, given as level 1 it is clear
  const cord = (level: number) => { const d = dump(); const e = ent(d, 'item', null, { level, room: null, at: [0, 0, 0] }, 'Hero Power Cord'); box(d, e, [0.02, 0.75, 0.02], [1, 3.4, 1]); return kinds(d).findings.filter(f => f.kind === 'ceiling'); };
  check(cord(0).length === 1 && near(cord(0)[0].depth_cm, 99.5, 0.2), 'a cord up to y 3.775 read as level 0 is 99.5 cm through its ceiling (the page used to say so for 13 hero cords)', JSON.stringify(cord(0).map(f => f.depth_cm)));
  check(cord(1).length === 0, 'the same cord on its own storey (level 1) is clear');
}
{
  // determinism: the same dump twice is the same findings, byte for byte
  const { d } = scene(); const s = ent(d, 'item', 'sofa'); box(d, s, [2.2, 0.8, 0.95], [3, 0.4, 3.95]);
  check(JSON.stringify(kinds(d)) === JSON.stringify(kinds(d)), 'the same scene dump gives the same findings twice');
  check(buildParts(d).length === 2, 'buildParts: one part per mesh');
  void boxFrom; void identity; void eid;
}

if (bad) { console.error(`\n${bad} check(s) failed`); process.exit(1); }
console.log('\nall geometry-detector checks passed');
