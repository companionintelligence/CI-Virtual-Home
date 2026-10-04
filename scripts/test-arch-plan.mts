#!/usr/bin/env -S node --experimental-strip-types
// S2's plan geometry, tested in Node (no browser): the holes a storey's slab has and where a floor may be laid, the void a flight
// asks for, a porch's roof, and what the validator says of the architecture fields — the review's cases, each as it was found.
// @check-house quick
//
//   node --experimental-strip-types scripts/test-arch-plan.mts        (any cwd; ~2 s; needs `pnpm run build` for assets/*.js)
import fs from 'node:fs';
import path from 'node:path';
import { validate } from './validate-house-spec.mts';
import { insideOutline, subtractRects, slabHoles, openingRects, sunkRooms, porchPlan, mergeRects } from '../assets/arch-plan.js';
import { stairPlan } from '../assets/stairs.js';

const ROOT = path.resolve(import.meta.dirname, '..');
let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail}`}`); if (!ok) bad++; };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const area = (rs: any[]) => rs.reduce((s, r) => s + r.w * r.d, 0);
const real = (id: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', `${id}.json`), 'utf8'));

// ---- holes clipped to the slab's outline ----------------------------------------------------------------------------------------
const box = { id: 'l2', y: 2.8, footprint: [{ x: -8, z: -5, w: 16, d: 10 }] };
const inside = insideOutline(box, [{ x: 2, z: -3, w: 1.2, d: 3 }]);
check(inside.length === 1 && near(inside[0].x, 2) && near(inside[0].w, 1.2), 'a hole inside the outline comes back whole (one rect)', JSON.stringify(inside));
const flush = insideOutline(box, [{ x: 6.9, z: -3.7, w: 1.1, d: 2.6 }]);
check(flush.length === 1 && near(flush[0].x + flush[0].w, 7.92), 'a hole against the east wall stops at the wall\'s inner face (7.92)', JSON.stringify(flush));
check(insideOutline(box, [{ x: 10, z: 0, w: 2, d: 2 }]).length === 0, 'a hole wholly outside the outline is dropped');
const overN = insideOutline(box, [{ x: 0, z: -6, w: 2, d: 3 }]);
check(overN.length === 1 && near(overN[0].z, -4.92), 'a hole past the north wall is trimmed to its face (z -4.92)', JSON.stringify(overN));
const two = { id: 'l2', y: 2.8, footprint: [{ x: 0, z: 0, w: 4, d: 4 }, { x: 4, z: 0, w: 4, d: 4 }] };
const across = insideOutline(two, [{ x: 3, z: 1, w: 2, d: 1 }]);
check(across.length === 1 && near(across[0].w, 2), 'a hole across two footprint rects that meet is one rect again', JSON.stringify(across));
check(mergeRects([{ x: 0, z: 0, w: 1, d: 1 }, { x: 1, z: 0, w: 1, d: 1 }]).length === 1, 'mergeRects joins rects that share a side');
const cut = subtractRects({ x: 0, z: 0, w: 10, d: 10 }, [{ x: 3, z: 3, w: 2, d: 2 }]);
check(near(area(cut), 96) && cut.every(r => !(r.x < 5 && r.x + r.w > 3 && r.z < 5 && r.z + r.d > 3)), 'subtractRects leaves the rect less the hole, none of it in the hole', `area ${area(cut)}`);

// ---- mesamariposa: a void on the outline (its stair came out under a solid slab) ----------------------------------------------
{
  const spec = real('mesamariposa'), l2 = spec.levels.find(l => l.id === 'l2');
  const rects = openingRects(spec, l2);
  check(rects !== null && rects.length >= 1, 'mesamariposa: l2\'s void, on the outline, is routed through the clipped path', JSON.stringify(rects));
  const holes = slabHoles(spec, l2);
  check(holes.length > 0 && holes.every(h => h.x + h.w <= 3.4 - 0.019), 'mesamariposa: the hole ends 2 cm inside the outline (x 3.4)', JSON.stringify(holes));
  const vanilla = real('vanilla'), v2 = vanilla.levels.find(l => l.id === 'l2');
  check(openingRects(vanilla, v2) === null, 'vanilla: a void wholly inside the outline is built as it always was (null: v1\'s path)');
}

// ---- a room's floor is laid less the slab's holes ---------------------------------------------------------------------------------
{
  const lv = { id: 'l2', y: 2.8, footprint: [{ x: -8, z: -5, w: 16, d: 10 }], voids: [{ x: 2, z: -3, w: 1.2, d: 3 }], rooms: [] };
  const spec = { id: 't', levels: [{ id: 'l1', y: 0, footprint: lv.footprint }, lv] };
  const holes = slabHoles(spec, lv), room = { x: -8, z: -5, w: 16, d: 6 };
  const parts = subtractRects(room, holes);
  check(near(area(parts), 16 * 6 - 3.6) && parts.every(p => !holes.some(h => p.x < h.x + h.w - 1e-6 && p.x + p.w > h.x + 1e-6 && p.z < h.z + h.d - 1e-6 && p.z + p.d > h.z + 1e-6)), 'a room whose bounds hold the void is floored round it (none of the floor over the hole)', `area ${area(parts)}`);
  const sunk = { ...lv, voids: [], rooms: [{ name: 'Pit', bounds: { x: -8, z: -5, w: 4, d: 4 }, floorOffset: -0.4 }] };
  const sspec = { id: 't', levels: [{ id: 'l1', y: 0, footprint: lv.footprint }, sunk] };
  check(sunkRooms(sspec, sunk).length === 1 && slabHoles(sspec, sunk).length > 0, 'a sunken room over a lower storey opens the slab over its pit');
  const flat = { id: 't', levels: [{ ...sunk, y: 0 }] };
  check(sunkRooms(flat, flat.levels[0]).length === 0, 'a sunken room on the ground floor is not built sunken (nothing to sink into)');
}

// ---- flights: the void starts at the first tread that is too low, and a diagonal flight keeps its step-off ----------------------
{
  const lv = { id: 'l1', y: 0, footprint: [{ x: -8, z: -5, w: 16, d: 10 }] }, up = { id: 'l2', y: 2.8, footprint: lv.footprint }, by = { l1: lv, l2: up };
  const p = stairPlan({ type: 'timber', at: [3, -4.2], rot: 0, w: 1.1, to: 'l2' }, lv, by)!;
  const f = p.flights[0], rh = f.rise / f.steps, going = f.run / f.steps, h0 = p.rise - 0.18 - 2.0;
  const first = Math.floor(h0 / rh + 1e-9), void0 = p.voidRects[0];
  check(p.voidRects.length === 1 && near(void0.z, -4.2 + first * going, 1e-3), `a straight flight's void starts at the near edge of the first tread over ${h0.toFixed(2)} m (tread ${first}: z ${(-4.2 + first * going).toFixed(2)})`, JSON.stringify(void0));
  check((first + 1) * rh > h0 && first * rh <= h0 + 1e-9, 'that tread is the first one whose top is over the limit');
  const d = stairPlan({ type: 'timber', at: [-3.4, -2.6], rot: 45, w: 1.0, to: 'l2' }, lv, by)!;
  const inV = (x: number, z: number) => d.voidRects.some(r => x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d);
  check(d.voidRects.length > 4 && !inV(d.stepOff[0], d.stepOff[1]), 'a stair at 45° has a staircase-edged void that leaves its step-off open floor', `${d.voidRects.length} rects, step-off ${d.stepOff}`);
}

// ---- porches: the roof the spec gets ----------------------------------------------------------------------------------------------
{
  const spec = (levels2: boolean, f: any) => ({ id: 't', entry: { level: 'l1', side: 'S', at: 0 },
    levels: [{ id: 'l1', y: 0, height: 2.8, footprint: [{ x: -6, z: -4, w: 12, d: 8 }], openings: [{ side: 'S', at: 0, type: 'door', w: 1, style: 'entry' }] },
      ...(levels2 ? [{ id: 'l2', y: 2.8, height: 2.8, footprint: [{ x: -6, z: -4, w: 12, d: 8 }] }] : [])], features: [f] });
  const wide = porchPlan(spec(true, { type: 'porch', side: 'S', from: -5.5, to: 5.5, depth: 2, roof: 'gable' }), { type: 'porch', side: 'S', from: -5.5, to: 5.5, depth: 2, roof: 'gable' })!;
  check(wide.top <= wide.yHigh + 0.2, `an 11 m gable porch's ridge stays under the wall it leans on (${wide.top.toFixed(2)} m, yHigh ${wide.yHigh.toFixed(2)})`);
  const cott = { type: 'porch', side: 'S', from: -3, to: 3, depth: 2.4, roof: 'shed', pitch: 12, floorY: 0.5 };
  const c = porchPlan(spec(false, cott), cott)!;
  check(c.pitch < c.asked && c.clear < 2.0, `a raised deck on a single storey: pitch ${c.pitch.toFixed(1)}° of ${c.asked}° asked, ${c.clear} m clear — a lint, not a silent override`);
  const grade = { type: 'porch', side: 'S', from: -3, to: 3, depth: 2.4, roof: 'shed' };
  const g = porchPlan(spec(false, grade), grade)!;
  check(g.clear >= 2.0, `a porch at grade on a single storey keeps ${g.clear} m of clear height under its header`);
}

// ---- the validator: the review's typos and mislocations are errors, the good cases are not ------------------------------------------
{
  const base = () => { const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'houses', 's2-arch-sections.json'), 'utf8')); return s; };
  const errs = (mut: (s: any) => void) => { const s = base(); mut(s); return validate(s, 's2-arch-sections.json').errors as string[]; };
  const warns = (mut: (s: any) => void) => { const s = base(); mut(s); return validate(s, 's2-arch-sections.json').warnings as string[]; };
  check(errs(() => {}).length === 0, 'the sections fixture validates clean');
  check(errs(s => { s.features[3].roof = 'mansard'; }).some(e => /roof "mansard"/.test(e)), 'a porch roof of "mansard" is an error');
  check(errs(s => { s.features[3].posts = { style: 'colonnade' }; }).some(e => /posts\.style/.test(e)), 'a porch posts.style of "colonnade" is an error');
  check(errs(s => { s.features[3].rail = { style: 'picket' }; }).some(e => /rail\.style/.test(e)), 'a porch rail.style of "picket" is an error');
  check(errs(s => { s.features[3].pitch = -5; }).some(e => /pitch/.test(e)), 'a porch pitch of −5 is an error');
  check(errs(s => { s.features[3].roofColor = 'red'; }).some(e => /roofColor/.test(e)), 'a porch roofColor of "red" is an error');
  check(errs(s => { s.features[3].steps = { at: 'x' }; }).some(e => /steps\.at/.test(e)), 'a porch steps.at of "x" is an error');
  check(errs(s => { s.features[1].h = 0.2; }).some(e => /bay.*h 0\.2/.test(e)), 'a bay h of 0.2 is an error');
  check(errs(s => { s.features[1].at = 99; }).some(e => /no wall/.test(e)), 'a bay at 99 stands on no wall: an error');
  check(errs(s => { s.features[1].at = -7; }).some(e => /past the ends/.test(e)), 'a bay running past the end of its wall is an error');
  check(errs(s => { s.features[0].at = [500, 500]; }).some(e => /outside/.test(e)), 'a fireplace at [500, 500] is an error');
  check(errs(s => { s.features.push({ type: 'builtin', level: 'l1', kind: 'niche', from: [80, 80], to: [81, 80] }); }).some(e => /outside/.test(e)), 'a built-in at [80, 80] is an error');
  check(errs(s => { s.features.push({ type: 'terrace', level: 'l2', rect: { x: 90, z: 0, w: 3, d: 3 } }); }).some(e => /nowhere near/.test(e)), 'a terrace 90 m away is an error');
  check(errs(s => { s.levels[0].stairs[0].landing = -1; }).some(e => /landing/.test(e)), 'a stair landing of −1 is an error');
  check(errs(s => { s.features[1].roof = 'none'; }).length === 0, 'a bay with roof "none" is valid');
  check(warns(s => { s.features[2].roof = 'hip'; s.features[1].roof = 'hip'; }).some(w => /feature-wall/.test(w)), 'a bay over a bay whose roof runs into its wall is a warning');
  check(warns(s => { s.levels[1].voids = [{ x: 6, z: -3, w: 2, d: 2 }]; }).some(w => /void-outline/.test(w)), 'a void that runs to the outline is a warning');
  check(warns(s => { s.levels[1].rooms[2].walls = { kind: 'wainscot', feature: { side: 'E', kind: 'brick' } }; }).some(w => /room-feature/.test(w)), 'a walls.feature on a side with no wall to line is a warning');
  check(warns(s => { s.levels[0].rooms[0].floorOffset = -0.3; }).some(w => /not built sunken/.test(w)), 'a sunken room on the ground floor says it stays flat');
  check(warns(s => { s.roofs.pop(); s.levels.pop(); s.features.pop(); s.features.pop(); s.roofs[0].clip = undefined; }).every(w => !/roof-open-sky/.test(w)), 'a roof clipped round nothing says nothing');
  // the inverse, same fixture: drop only the roof that used to cover the clipped storey (l3 still rises through
  // roofs[0]'s clip) so that storey is left with no roof of its own. (Was epiphany.json forced to defaults 2, a real
  // content house happening to exhibit this — but layout pass 4/5 re-laid its roof as part of the fleet-wide fix and
  // it no longer does; a fixture mutation that builds the condition on purpose doesn't drift with the fleet.)
  check(warns(s => { s.roofs.pop(); }).some(w => /roof-open-sky/.test(w)), 'a roof clipped round a storey that lost its own roof is a warning');
}

console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
process.exit(bad ? 1 : 0);
