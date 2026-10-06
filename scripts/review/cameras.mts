// The fixed cameras and the fixed review set (plan 5.1 R1, R3, 8.1). THREE-free and pure: a camera is a function of a room's
// bounds, so BEFORE and AFTER are taken from the same eye whatever the product code did in between.
//
// The eye-level corner view is the audit's own (repo-recon/interior-look/capture.mts), so the 199 audit jpgs stay a comparable
// second BEFORE: the eye stands in one corner, 1.5 m up, inset by min(0.55, 20 % of the shorter side), 60 degrees vertical, and
// looks at the far quarter of the room, 0.45 m below eye height. NW stands at the (min x, min z) corner and looks to the SE; SE is
// the opposite corner.

export const EYE = 1.5;
export const FOV = 60;
export const NEAR = 0.05;
export const RES = '720';          // __houseSnapshot's res: 1280 x 720
export const QUALITY = 0.93;       // the audit's JPEG quality
export const SIZE = { w: 1280, h: 720 };

export type Corner = 'NW' | 'SE' | 'NE' | 'SW';
export type Tod = 'day' | 'dusk' | 'night' | 'golden';
export interface Bounds { x: number; z: number; w: number; d: number }
export interface Cam { pos: [number, number, number]; target: [number, number, number]; fov: number; near: number; eye: number; corner: Corner }

const FLIP: Record<Corner, [number, number]> = { NW: [0, 0], SE: [1, 1], NE: [1, 0], SW: [0, 1] };
const mm = (v: number) => Math.round(v * 1000) / 1000;

/** the corner camera of a room whose floor is at height `y` (the storey's y) */
export function cornerCam(b: Bounds, y: number, corner: Corner, { eye = EYE, fov = FOV }: { eye?: number; fov?: number } = {}): Cam {
  const [fx, fz] = FLIP[corner], m = Math.min(0.55, Math.min(b.w, b.d) * 0.2);
  const x = fx ? b.x + b.w - m : b.x + m, z = fz ? b.z + b.d - m : b.z + m;
  return {
    pos: [mm(x), mm(y + eye), mm(z)],
    target: [mm(b.x + b.w * (fx ? 0.25 : 0.75)), mm(y + eye - 0.45), mm(b.z + b.d * (fz ? 0.25 : 0.75))],
    fov, near: NEAR, eye, corner,
  };
}

// ---- R24: 24 rooms across the nine audited homes -------------------------------------------------------------------------
export interface ReviewRoom { id: string; house: string; room: string; kind: string; bench?: boolean }
/** Every kind the plan names is here: living 4, primary bedroom 5 and kids 1 (the six bedrooms of G-BED), kitchen 3, dining 3,
 *  bath 3, hall or foyer 2, garage, laundry. All nine audited homes appear. `bench` marks the five rooms whose dusk and night
 *  frames LIGHT's acceptance reads (light-and-finish design, section 8). */
export const R24: ReviewRoom[] = [
  { id: 'aurora-living', house: 'aurora', room: 'Living', kind: 'living', bench: true },
  { id: 'aurora-primary-bedroom', house: 'aurora', room: 'Primary Bedroom', kind: 'bedroom', bench: true },
  { id: 'aurora-kitchen', house: 'aurora', room: 'Kitchen', kind: 'kitchen', bench: true },
  { id: 'aurora-dining', house: 'aurora', room: 'Dining', kind: 'dining' },
  { id: 'aurora-bath', house: 'aurora', room: 'Bath', kind: 'bath' },
  { id: 'aurora-hall', house: 'aurora', room: 'Hall', kind: 'hall' },
  { id: 'cutestarter-living', house: 'cutestarter', room: 'Living Room', kind: 'living' },
  { id: 'cutestarter-bedroom', house: 'cutestarter', room: 'Bedroom', kind: 'bedroom', bench: true },
  { id: 'cutestarter-kids-corner', house: 'cutestarter', room: 'Kids Corner', kind: 'kids' },
  { id: 'cutestarter-bath', house: 'cutestarter', room: 'Bath', kind: 'bath' },
  { id: 'seraphine-living', house: 'seraphine', room: 'Living Room', kind: 'living', bench: true },
  { id: 'seraphine-master-suite', house: 'seraphine', room: 'Master Suite', kind: 'bedroom' },
  { id: 'seraphine-kitchen', house: 'seraphine', room: 'Kitchen', kind: 'kitchen' },
  { id: 'riverbend-family-room', house: 'riverbend', room: 'Family Room', kind: 'living' },
  { id: 'riverbend-primary-suite', house: 'riverbend', room: 'Primary Suite', kind: 'bedroom' },
  { id: 'riverbend-mudroom-laundry', house: 'riverbend', room: 'Mudroom & Laundry', kind: 'laundry' },
  { id: 'riverbend-foyer', house: 'riverbend', room: 'Foyer & Stair Hall', kind: 'foyer' },
  { id: 'lakecabin-master-bedroom', house: 'lakecabin', room: 'Master Bedroom', kind: 'bedroom' },
  { id: 'lakecabin-kitchen', house: 'lakecabin', room: 'Kitchen', kind: 'kitchen' },
  { id: 'mediterranean-dining', house: 'mediterranean', room: 'Dining Room', kind: 'dining' },
  { id: 'mesamariposa-garage', house: 'mesamariposa', room: 'Garage', kind: 'garage' },
  { id: 'neweco-dining', house: 'neweco', room: 'Dining Room', kind: 'dining' },
  { id: 'vanilla-living-dining', house: 'vanilla', room: 'Living & Dining', kind: 'living' },
  { id: 'vanilla-bathroom', house: 'vanilla', room: 'Bathroom', kind: 'bath' },
];
export const CORNERS_R24: Corner[] = ['NW', 'SE'];
/** dusk and night, both corners, on the bench rooms; day on all of them */
export const TODS_BENCH: Tod[] = ['dusk', 'night'];

export interface Shot { id: string; file: string; room: string; house: string; tod: Tod; corner: Corner; kind: 'eye' | 'scale' }
export const shotId = (room: string, corner: Corner, tod: Tod, kind: 'eye' | 'scale' = 'eye') => `${room}/${corner}/${tod}${kind === 'scale' ? '/scale' : ''}`;
export const shotFile = (room: string, corner: Corner, tod: Tod, kind: 'eye' | 'scale' = 'eye') => `${room}__${corner}-${tod}${kind === 'scale' ? '-scale' : ''}.jpg`;

/** the frames of the set, in a fixed order: house, room, day then dusk then night, NW then SE; then each room's NW day frame with
 *  the mannequin (the scale reference the sheets use) */
export function r24Shots(): Shot[] {
  const out: Shot[] = [];
  for (const r of R24) {
    const tods: Tod[] = r.bench ? ['day', ...TODS_BENCH] : ['day'];
    for (const tod of tods) for (const corner of CORNERS_R24) out.push({ id: shotId(r.id, corner, tod), file: shotFile(r.id, corner, tod), room: r.id, house: r.house, tod, corner, kind: 'eye' });
  }
  for (const r of R24) out.push({ id: shotId(r.id, 'NW', 'day', 'scale'), file: shotFile(r.id, 'NW', 'day', 'scale'), room: r.id, house: r.house, tod: 'day', corner: 'NW', kind: 'scale' });
  return out;
}

// ---- R3: twelve fixed interior cameras per house -----------------------------------------------------------------------
/** what a room is, for choosing cameras: the program the spec carries or the composer infers from the name */
const PRIORITY = ['living', 'kitchen', 'bed-primary', 'dining', 'bath', 'ensuite', 'hall', 'foyer', 'bed-kid', 'bed-guest', 'den', 'media', 'study', 'library', 'laundry', 'garage', 'nursery', 'playroom', 'bar', 'sunroom', 'powder', 'greenhouse', 'gym', 'studio'];
export interface CostRoom { level: string; y: number; name: string; program: string | null; b: Bounds }
export interface CostCam { key: string; level: string; room: string; program: string | null; cam: Cam }
/** Twelve cameras for one house: one NW eye view per room in program order (a program gets its next room only after every
 *  program has had one), and when the house has fewer than twelve eligible rooms the SE view of the first rooms fills the rest.
 *  A function of the rooms' names, programs and bounds only, never of their items, so dressing a house later moves no camera. */
export function costCameras(rooms: CostRoom[], n = 12): CostCam[] {
  const ok = rooms.filter(r => r.program !== 'outdoor' && r.b.w * r.b.d >= 4 && r.b.w >= 1.4 && r.b.d >= 1.4);
  const rank = (p: string | null) => { const i = PRIORITY.indexOf(p || ''); return i < 0 ? PRIORITY.length : i; };
  const byProg = new Map<string, CostRoom[]>();
  for (const r of ok) { const k = r.program || '-'; (byProg.get(k) || byProg.set(k, []).get(k)!).push(r); }
  for (const l of byProg.values()) l.sort((a, b) => b.b.w * b.b.d - a.b.w * a.b.d || (a.level + a.name < b.level + b.name ? -1 : 1));
  const progs = [...byProg.keys()].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
  const picked: CostRoom[] = [];
  for (let round = 0; picked.length < n; round++) {
    let any = false;
    for (const p of progs) { const r = byProg.get(p)![round]; if (r && picked.length < n) { picked.push(r); any = true; } }
    if (!any) break;
  }
  const cams: CostCam[] = picked.map(r => ({ key: `${r.level}/${r.name}/NW`, level: r.level, room: r.name, program: r.program, cam: cornerCam(r.b, r.y, 'NW') }));
  for (let i = 0; cams.length < n && i < picked.length; i++) { const r = picked[i]; cams.push({ key: `${r.level}/${r.name}/SE`, level: r.level, room: r.name, program: r.program, cam: cornerCam(r.b, r.y, 'SE') }); }
  return cams;
}

// ---- R5: the procedural mannequin ----------------------------------------------------------------------------------------
export const MANNEQUIN_HEIGHT = 1.7;
export interface MPart { shape: 'cyl' | 'sphere' | 'box'; /** radiusTop, radiusBottom, height | radius | w,h,d */ dims: number[]; at: [number, number, number]; scale?: [number, number, number]; rotZ?: number }
/** A neutral matte figure, 1.70 m to the crown, built from primitives (the Characters pack is never used). Origin on the floor.
 *  Parts are plain data so the page builds it with its own THREE and Node tests can check the height without one. */
export const MANNEQUIN: MPart[] = [
  { shape: 'cyl', dims: [0.07, 0.048, 0.84], at: [-0.095, 0.42, 0] },                 // legs
  { shape: 'cyl', dims: [0.07, 0.048, 0.84], at: [0.095, 0.42, 0] },
  { shape: 'box', dims: [0.10, 0.045, 0.2], at: [-0.095, 0.0225, 0.03] },               // feet
  { shape: 'box', dims: [0.10, 0.045, 0.2], at: [0.095, 0.0225, 0.03] },
  { shape: 'cyl', dims: [0.165, 0.15, 0.2], at: [0, 0.94, 0], scale: [1.15, 1, 0.78] },  // hips
  { shape: 'cyl', dims: [0.175, 0.16, 0.5], at: [0, 1.29, 0], scale: [1.18, 1, 0.74] },  // torso
  { shape: 'sphere', dims: [0.075], at: [-0.215, 1.50, 0] },                           // shoulders
  { shape: 'sphere', dims: [0.075], at: [0.215, 1.50, 0] },
  { shape: 'cyl', dims: [0.04, 0.034, 0.62], at: [-0.255, 1.20, 0] },                  // arms
  { shape: 'cyl', dims: [0.04, 0.034, 0.62], at: [0.255, 1.20, 0] },
  { shape: 'cyl', dims: [0.048, 0.055, 0.12], at: [0, 1.57, 0] },                      // neck
  { shape: 'sphere', dims: [0.105], at: [0, 1.595, 0], scale: [0.9, 1.08, 1] },        // head, crown at 1.595 + 0.105 * 1.08 = 1.7085
];
/** the figure's own top (metres): the test pins it to 1.70 within 1 cm */
export function mannequinTop(parts: MPart[] = MANNEQUIN): number {
  let top = 0;
  for (const p of parts) {
    const sy = p.scale ? p.scale[1] : 1;
    const half = p.shape === 'sphere' ? p.dims[0] * sy : p.shape === 'cyl' ? (p.dims[2] / 2) * sy : (p.dims[1] / 2) * sy;
    top = Math.max(top, p.at[1] + half);
  }
  return top;
}
