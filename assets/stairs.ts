// Stairs — a storey's flights as plan geometry, and the flights built from the page's stair builders.
//
// `levels[].stairs` is one flight (as it always was) or an array of them (plan Completeness A2: a second stair, a
// split level's half-flight). A flight is straight (timber, colonial, closed), a spiral, or turns: `L` (a quarter
// turn on a landing) and `U` (a half turn, the second flight running back beside the first). Every flight climbs
// from its own storey to `to`; its rise is the difference of the two storeys' elevations, so a half-storey level
// (a split level 1.4 m up) takes a half-flight with no extra field.
//
// stairPlan() is THREE-free: the builder, the validator (scripts/validate/arch.mts), the plan export and the Node
// harnesses all read the same geometry — each flight's run, the landings, the walking line (`path`) from the first
// step to the last, the plan outline, where the storey above must be open for headroom (`voidRects`), and the
// step-off point 0.3 m past the top step, which must be open floor on the storey above.
//
// Conventions (the page builders'): a flight is built in its own frame climbing +z from its first riser at z 0 to
// z = run, width along x centred on 0; placed at `at` and turned by `rot` degrees, so it climbs toward
// (sin rot, cos rot). Seen climbing, "left" is (cos rot, −sin rot) — east for a flight climbing south.
//
// Owner: S2 (architecture).

export const DEG = Math.PI / 180;
export const RISER = 0.2;          // straight flights: steps = round(rise / 0.2) (the builder's rule since v1)
export const SPIRAL_RISER = 0.18;
export const TREAD = 0.24;         // default going per step: 3.36 m for the 14 steps of a 2.8 m storey
export const HEADROOM = 2.0;       // clear height a walker needs over a tread
export const SLAB = 0.18;          // an upper slab's depth (structure-build.ts)

type V2 = [number, number];
export type Flight = {
  /** first riser (plan) and the flight's heading, degrees */
  at: V2; rot: number;
  run: number; rise: number; steps: number; w: number;
  /** height of its first riser's foot over the storey's floor */
  y0: number;
  style: 'timber' | 'colonial' | 'closed' | 'spiral';
};
export type Landing = { x: number; z: number; w: number; d: number; y: number; rot: number; cx: number; cz: number; along: number; across: number };
export type StairPlan = {
  index: number; type: string; shape: 'straight' | 'L' | 'U' | 'spiral';
  from: string; to: string; y: number; rise: number; w: number;
  flights: Flight[]; landings: Landing[];
  /** the walking line, [x, height over the storey's floor, z], first step to last */
  path: Array<[number, number, number]>;
  /** first step, last step (plan), and the heading off the top */
  bottom: V2; top: V2; dir: V2; dir0: V2;
  /** plan outline of every flight and landing (oriented rectangles as 4 corners each) */
  outline: V2[][];
  /** axis-aligned plan box of the outline */
  box: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** where the storey above must be open (tread height over its slab's underside − headroom): plan rects */
  voidRects: Array<{ x: number; z: number; w: number; d: number }>;
  /** 0.3 m past the top step: open floor on the storey above */
  stepOff: V2;
  /** total going (plan length of every flight, landings excluded) */
  run: number;
};

/** A storey's flights, always as an array (one object or several; none → []) */
export function levelStairs(lv: any): any[] {
  const s = lv && lv.stairs;
  if (!s) return [];
  return (Array.isArray(s) ? s : [s]).filter(x => x && typeof x === 'object');
}

const dirOf = (rot: number): V2 => [Math.sin(rot * DEG), Math.cos(rot * DEG)];
const leftOf = (rot: number): V2 => [Math.cos(rot * DEG), -Math.sin(rot * DEG)];
const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** the 4 plan corners of a rectangle on a frame: origin o, heading rot, across [a0, a1] (along left), along [b0, b1] */
function frameRect(o: V2, rot: number, a0: number, a1: number, b0: number, b1: number): V2[] {
  const d = dirOf(rot), l = leftOf(rot);
  const P = (a: number, b: number): V2 => [r3(o[0] + l[0] * a + d[0] * b), r3(o[1] + l[1] * a + d[1] * b)];
  return [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)];
}
const boxOf = (pts: V2[]) => ({ minX: Math.min(...pts.map(p => p[0])), maxX: Math.max(...pts.map(p => p[0])), minZ: Math.min(...pts.map(p => p[1])), maxZ: Math.max(...pts.map(p => p[1])) });
const rectOfBox = (b: { minX: number; maxX: number; minZ: number; maxZ: number }) => ({ x: r3(b.minX), z: r3(b.minZ), w: r3(b.maxX - b.minX), d: r3(b.maxZ - b.minZ) });

/**
 * The plan of one flight `st` climbing from storey `lv` (levelById: id → level). null when it has no `at`.
 * Straight flights keep the v1 numbers exactly: steps round(rise / 0.2), run `st.run` or 3.36, width 1.2 colonial /
 * 1.1 otherwise; the top is at + dir × run.
 */
export function stairPlan(st: any, lv: any, levelById: Record<string, any>, index = 0): StairPlan | null {
  if (!st || !Array.isArray(st.at) || st.at.length < 2) return null;
  const y = lv.y || 0, toLv = levelById[st.to];
  const rise = toLv ? (toLv.y || 0) - y : 2.8;
  const rot = st.rot || 0, at: V2 = [st.at[0], st.at[1]];
  const type = st.type || 'timber';
  const shape: StairPlan['shape'] = type === 'spiral' ? 'spiral' : type === 'L' ? 'L' : type === 'U' ? 'U' : 'straight';
  const style = (shape === 'L' || shape === 'U' ? (st.style || 'timber') : type === 'spiral' ? 'spiral' : type) as Flight['style'];
  const w = st.w || (style === 'colonial' ? 1.2 : 1.1);
  const d0 = dirOf(rot);
  const flights: Flight[] = [], landings: Landing[] = [], outline: V2[][] = [];
  const path: Array<[number, number, number]> = [];
  let top: V2, dir: V2 = d0;
  if (shape === 'spiral') {
    const steps = Math.round(rise / SPIRAL_RISER);
    flights.push({ at, rot, run: 0, rise, steps, w: 0.95 * 2, y0: 0, style: 'spiral' });
    outline.push(frameRect(at, 0, -1, 1, -1, 1));
    top = [...at] as V2;
    path.push([at[0], 0, at[1]], [at[0], rise, at[1]]);
  } else if (shape === 'straight') {
    const steps = Math.round(rise / RISER), run = st.run || 3.36;
    flights.push({ at, rot, run, rise, steps, w, y0: 0, style });
    outline.push(frameRect(at, rot, -w / 2, w / 2, 0, run));
    top = [at[0] + d0[0] * run, at[1] + d0[1] * run];
    path.push([at[0], 0, at[1]], [top[0], rise, top[1]]);
  } else {
    // turning flights: whole risers either side of the landing
    const N = Math.max(4, Math.round(rise / RISER)), riser = rise / N;
    const n1 = shape === 'U' ? Math.ceil(N / 2) : Math.min(N - 2, Math.max(2, Math.round(N * (st.split ?? 0.5))));
    const n2 = N - n1;
    const going = st.run ? st.run / N : TREAD;   // `run`: the total going of both flights
    const run1 = n1 * going, run2 = st.run2 || n2 * going, rise1 = n1 * riser, rise2 = n2 * riser;
    const L = st.landing || w, sgn = st.turn === 'right' ? -1 : 1, l0 = leftOf(rot);
    flights.push({ at, rot, run: run1, rise: rise1, steps: n1, w, y0: 0, style });
    outline.push(frameRect(at, rot, -w / 2, w / 2, 0, run1));
    const p1: V2 = [at[0] + d0[0] * run1, at[1] + d0[1] * run1];
    path.push([at[0], 0, at[1]], [p1[0], rise1, p1[1]]);
    if (shape === 'L') {
      // the landing: along the first flight [run1, run1 + L], across its width; the second flight leaves its side
      const lr = frameRect(at, rot, -w / 2, w / 2, run1, run1 + L);
      outline.push(lr);
      const c: V2 = [at[0] + d0[0] * (run1 + L / 2), at[1] + d0[1] * (run1 + L / 2)];
      const rot2 = rot + sgn * 90, d2 = dirOf(rot2);
      const a2: V2 = [r3(c[0] + d2[0] * w / 2), r3(c[1] + d2[1] * w / 2)];
      landings.push({ ...rectOfBox(boxOf(lr)), y: rise1, rot, cx: c[0], cz: c[1], along: L, across: w });
      flights.push({ at: a2, rot: rot2, run: run2, rise: rise2, steps: n2, w: Math.min(w, L), y0: rise1, style });
      outline.push(frameRect(a2, rot2, -Math.min(w, L) / 2, Math.min(w, L) / 2, 0, run2));
      top = [a2[0] + d2[0] * run2, a2[1] + d2[1] * run2]; dir = d2;
      path.push([c[0], rise1, c[1]], [a2[0], rise1, a2[1]], [top[0], rise, top[1]]);
    } else {
      // U: the landing spans both flights; the second runs back beside the first, `gap` apart
      const gap = st.gap ?? 0.1, off = sgn * (w + gap);
      const lr = frameRect(at, rot, sgn > 0 ? -w / 2 : off - w / 2, sgn > 0 ? off + w / 2 : w / 2, run1, run1 + L);
      outline.push(lr);
      const lb = boxOf(lr);
      const c: V2 = [(lb.minX + lb.maxX) / 2, (lb.minZ + lb.maxZ) / 2];
      landings.push({ ...rectOfBox(lb), y: rise1, rot, cx: c[0], cz: c[1], along: L, across: 2 * w + gap });
      const rot2 = rot + 180, d2 = dirOf(rot2);
      const a2: V2 = [r3(at[0] + l0[0] * off + d0[0] * run1), r3(at[1] + l0[1] * off + d0[1] * run1)];
      flights.push({ at: a2, rot: rot2, run: run2, rise: rise2, steps: n2, w, y0: rise1, style });
      outline.push(frameRect(a2, rot2, -w / 2, w / 2, 0, run2));
      top = [a2[0] + d2[0] * run2, a2[1] + d2[1] * run2]; dir = d2;
      const m1: V2 = [p1[0] + d0[0] * L / 2, p1[1] + d0[1] * L / 2], m2: V2 = [a2[0] - d2[0] * L / 2, a2[1] - d2[1] * L / 2];
      path.push([m1[0], rise1, m1[1]], [m2[0], rise1, m2[1]], [a2[0], rise1, a2[1]], [top[0], rise, top[1]]);
    }
  }
  const all = outline.flat(), box = boxOf(all);
  // headroom: every part of the stair whose tread is higher than (rise − slab − headroom) is under an opening in the
  // storey above — each flight's upper part, and a landing that high
  const h0 = rise - SLAB - HEADROOM, voidRects = [];
  if (shape !== 'spiral') {
    for (const f of flights) {
      const top0 = f.y0 + f.rise;
      if (top0 <= h0) continue;
      const b0 = f.y0 >= h0 ? 0 : (h0 - f.y0) / f.rise * f.run;
      voidRects.push(rectOfBox(boxOf(frameRect(f.at, f.rot, -f.w / 2 - 0.05, f.w / 2 + 0.05, b0, f.run))));
    }
    for (const ld of landings) if (ld.y > h0) voidRects.push({ x: r3(ld.x - 0.05), z: r3(ld.z - 0.05), w: r3(ld.w + 0.1), d: r3(ld.d + 0.1) });
  } else voidRects.push(rectOfBox({ minX: at[0] - 1.05, maxX: at[0] + 1.05, minZ: at[1] - 1.05, maxZ: at[1] + 1.05 }));
  const run = flights.reduce((s, f) => s + f.run, 0);
  return {
    index, type, shape, from: lv.id, to: st.to, y, rise, w, flights, landings, path: path.map(p => [r3(p[0]), r3(p[1]), r3(p[2])] as [number, number, number]),
    bottom: at, top: [r3(top[0]), r3(top[1])], dir: [r3(dir[0]), r3(dir[1])], dir0: [r3(d0[0]), r3(d0[1])],
    outline, box, voidRects, stepOff: [r3(top[0] + dir[0] * 0.3), r3(top[1] + dir[1] * 0.3)], run: r3(run),
  };
}

/** Every flight of every storey: [{ lv, st, plan }] in storey order, then array order */
export function houseStairs(spec: any) {
  const byId = Object.fromEntries((spec.levels || []).map(l => [l.id, l]));
  const out = [];
  for (const lv of spec.levels || []) levelStairs(lv).forEach((st, i) => { const plan = stairPlan(st, lv, byId, i); if (plan) out.push({ lv, st, plan }); });
  return out;
}

/** The openings a storey's slab has over the flights that climb to it with `autoVoid` (plan rects) */
export function autoVoidsFor(spec: any, lvId: string) {
  return houseStairs(spec).filter(s => s.plan.to === lvId && s.st.autoVoid).flatMap(s => s.plan.voidRects);
}

// ---------------------------------------------------------------------------------------------------------------------
// The builder: one flight group per stair, placed at its first step and turned by `rot` (a turning stair is one group
// with both flights and the landing in it, so the page's gates and the shot planner see one stair)
// ---------------------------------------------------------------------------------------------------------------------
export function createStairBuilder({ THREE, ProceduralArchitecture, textures = {} }: any) {
  const std = (c: number, extra: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...extra });
  const hexOf = (c: any, d: number) => c === undefined || c === null ? d : typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);

  // A boxed flight: treads and risers between closed stringers, the spandrel under it panelled in — the stair of a
  // cottage or a hall, not a floating one.
  function closedFlight({ totalHeight, steps, width, run, stringer, handrailSide = 'left' }) {
    const g = new THREE.Group(); g.name = `Closed Stairs (${+totalHeight.toFixed(2)}m)`;
    g.userData = { category: 'Architecture', tags: 'stairs, closed' };
    const rh = totalHeight / steps, td = run / steps;
    const treadMat = textures.oak ? new THREE.MeshStandardMaterial({ map: textures.oak, roughness: 0.4 }) : std(0x9c7f62, { roughness: 0.45 });
    const paint = std(hexOf(stringer, 0xefe9df), { roughness: 0.55 });
    for (let i = 0; i < steps; i++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, 0.035, td + 0.03), treadMat);
      tread.position.set(0, (i + 1) * rh - 0.0175, i * td + td / 2 - 0.015); g.add(tread);
      const riser = new THREE.Mesh(new THREE.BoxGeometry(width, rh - 0.035, 0.02), paint);
      riser.position.set(0, i * rh + (rh - 0.035) / 2, i * td + 0.01); g.add(riser);
    }
    // stringers + spandrels: one profile (the stepped underside's envelope), extruded 4 cm, on each side
    const prof = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(run, 0), new THREE.Vector2(run, totalHeight + 0.06), new THREE.Vector2(run - td * 0.5, totalHeight + 0.06), new THREE.Vector2(0, rh + 0.06)]);
    for (const sx of [-1, 1]) {
      const geo = new THREE.ExtrudeGeometry(prof, { depth: 0.04, bevelEnabled: false });
      const m = new THREE.Mesh(geo, paint);
      // shape (u, v) = (along, up) → plan: u → +z, v → +y, extruded along x
      m.rotation.y = -Math.PI / 2; m.position.set(sx * (width / 2 + 0.02) + 0.02, 0, 0);
      g.add(m);
    }
    const sides = handrailSide === 'both' ? [-1, 1] : handrailSide === 'none' ? [] : [handrailSide === 'right' ? 1 : -1];
    const diag = Math.hypot(run, totalHeight), inc = Math.atan2(totalHeight, run);
    for (const sx of sides) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, diag, 10), std(0x5b4636, { roughness: 0.4 }));
      rail.position.set(sx * (width / 2 + 0.02), totalHeight / 2 + 0.9, run / 2); rail.rotation.x = Math.PI / 2 - inc; g.add(rail);
      for (const [z, yb] of [[0.05, 0], [run - 0.05, totalHeight]]) {
        const newel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.09), paint); newel.position.set(sx * (width / 2 + 0.02), yb + 0.5, z); g.add(newel);
      }
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  // one flight, as the page builds it (the v1 calls, unchanged, when the spec adds nothing)
  function flightGroup(f: Flight, st: any, rail?: string) {
    const extra: any = {};
    if (st.treadWood) extra.treadWood = st.treadWood;
    const hs = st.handrailSide || rail;
    if (f.style === 'colonial') {
      const g = ProceduralArchitecture.createColonialStairs({ totalHeight: f.rise, steps: f.steps, width: f.w, run: f.run, ...(hs ? { handrail: hs === 'none' ? 'left' : hs } : {}) });
      if (st.stringer !== undefined) g.traverse(o => { if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 0.06 && o.geometry.parameters.height === 0.28) { o.material = o.material.clone(); o.material.color.setHex(hexOf(st.stringer, 0xf8fafc)); } });
      return g;
    }
    if (f.style === 'closed') return closedFlight({ totalHeight: f.rise, steps: f.steps, width: f.w, run: f.run, stringer: st.stringer, handrailSide: hs || 'left' });
    const g = ProceduralArchitecture.createFloatingTimberStairs({ totalHeight: f.rise, steps: f.steps, width: f.w, run: f.run, ...extra, ...(hs ? { handrailSide: hs } : {}) });
    if (st.stringer !== undefined) g.traverse(o => { if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 0.18 && o.geometry.parameters.height === 0.12) { o.material = o.material.clone(); o.material.color.setHex(hexOf(st.stringer, 0x1e242b)); } });
    if (st.riser === 'closed') {   // riser boards between the floating treads
      const rm = std(hexOf(st.stringer, 0xefe9df), { roughness: 0.55 }), rh = f.rise / f.steps, td = f.run / f.steps;
      for (let i = 0; i < f.steps; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(f.w, rh - 0.045, 0.02), rm); r.position.set(0, i * rh + (rh - 0.045) / 2, i * td + 0.01); r.castShadow = true; r.receiveShadow = true; g.add(r); }
    }
    return g;
  }

  /** The whole stair for plan `p` (stairPlan) in its own frame: place it at p.bottom, rotation.y = rot × DEG */
  function build(p: StairPlan, st: any) {
    if (p.shape === 'spiral') return ProceduralArchitecture.createSpiralStairs({ totalHeight: p.rise, steps: p.flights[0].steps });
    if (p.shape === 'straight') return flightGroup(p.flights[0], st);
    // turning: flights and landing in the first flight's frame (+z climbing, +x its left)
    const g = new THREE.Group(); g.name = `${p.shape}-Stairs (${+p.rise.toFixed(2)}m)`;
    g.userData = { category: 'Architecture', tags: `stairs, ${p.shape}` };
    const rot = st.rot || 0, sgn = st.turn === 'right' ? -1 : 1;
    // rails on the outside of the turn unless the spec says
    const outer = sgn > 0 ? 'left' : 'right';
    const [f1, f2] = p.flights;
    g.add(flightGroup(f1, st, outer));
    const f2g = flightGroup(f2, st, outer);
    // f2's first step in the local frame: invert the plan transform (world = at + left·x + dir·z)
    const d = dirOf(rot), l = leftOf(rot), dx = f2.at[0] - p.bottom[0], dz = f2.at[1] - p.bottom[1];
    f2g.position.set(dx * l[0] + dz * l[1], f2.y0, dx * d[0] + dz * d[1]);
    // local x runs along world −(left) · … : a group turned by rotation.y = θ maps local +x to (cos θ, −sin θ) = left
    // of heading 0, so a flight turned +90° relative climbs toward local +x (the left)
    f2g.rotation.y = (f2.rot - rot) * DEG;
    g.add(f2g);
    // the landing: a slab in the first flight's frame, on slim posts to the floor (a boxed stair: a solid base)
    const ld = p.landings[0];
    const cx = (ld.cx - p.bottom[0]) * l[0] + (ld.cz - p.bottom[1]) * l[1], cz = (ld.cx - p.bottom[0]) * d[0] + (ld.cz - p.bottom[1]) * d[1];
    const across = ld.across, along = ld.along, T = 0.12;
    const slabMat = f1.style === 'closed' || f1.style === 'colonial' ? std(hexOf(st.stringer, f1.style === 'colonial' ? 0xf8fafc : 0xefe9df), { roughness: 0.55 }) : std(0x1e242b, { metalness: 0.6, roughness: 0.35 });
    const topMat = f1.style === 'colonial' ? std(0x451a03, { roughness: 0.3, metalness: 0.05 }) : textures.oak ? new THREE.MeshStandardMaterial({ map: textures.oak, roughness: 0.35 }) : std(0x9c7f62);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(across, T, along), slabMat); slab.position.set(cx, ld.y - T / 2 - 0.03, cz); g.add(slab);
    const top = new THREE.Mesh(new THREE.BoxGeometry(across + 0.02, 0.035, along + 0.02), topMat); top.position.set(cx, ld.y - 0.0175, cz); g.add(top);
    if (f1.style === 'closed') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(across, ld.y - T - 0.03, along), slabMat); base.position.set(cx, (ld.y - T - 0.03) / 2, cz); g.add(base);
    } else {
      const post = std(f1.style === 'colonial' ? 0xf8fafc : 0x1e242b, f1.style === 'colonial' ? { roughness: 0.4 } : { metalness: 0.8, roughness: 0.3 });
      for (const [px, pz] of [[cx + across / 2 - 0.06, cz + along / 2 - 0.06], [cx - across / 2 + 0.06, cz + along / 2 - 0.06]]) {
        const pm = new THREE.Mesh(new THREE.BoxGeometry(0.07, ld.y - T, 0.07), post); pm.position.set(px, (ld.y - T) / 2, pz); g.add(pm);
      }
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  return { build, closedFlight };
}
