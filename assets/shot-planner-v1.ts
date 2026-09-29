// Shot planner v1 — the camera splines derived from a built house's anchors: door-to-core (establishing shot,
// street, door, a routed walk through the storeys and up the stairs, the push-in and the orbit round the Core),
// orbit, core-orbit, hero-reveal and walkthrough, in the SplinePresets format (eyePoints / targetPoints, timing,
// compose, orbit, power). Also the nav helpers the walk uses: clearPoint, blockedTest, routeOn.
//
// Seam module (plan S0): moved verbatim out of house-builder.ts, with the Core-orbit wiring (assets/core-orbit.ts)
// and the timing (assets/shot-path.ts) it calls. Owner: S5 (shot). v1 stays the default planner until the
// integration flips it to v2.
import { perimeterEdges, unionBounds, rectCentre, inRect } from './house-geometry.js';
import { createOrbitProbe, planOrbit, arcWaypoints, orbitPoint, sweepFrom } from './core-orbit.js';
import { attachFrameAt, knotArcLengths, monotoneCubic } from './shot-path.js';
import { DEG } from './build-context.js';
import { digestWorld } from './shot-world.js';
import { planDoorToCore, presetFromTrack, shotOptions } from './shot-planner.js';
import { planHeroReveal, planWalkthrough } from './shot-planner-tour.js';
import { navAnchor } from './shot-nav.js';

export function createShotPlannerV1(bctx) {
  const { THREE } = bctx;
  // ---------------------------------------------------------------------------------------
  // Camera splines derived from anchors (SplinePresets format: eyePoints/targetPoints)
  // ---------------------------------------------------------------------------------------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // Camera clearance against the spec's plan: keep an eye point inside its level's footprint and `margin`
  // away from the perimeter and from partition solids (door gaps are open). Two of the shipped door-to-core
  // paths put the post-stairs eye point inside the wall the stair lands against; this is what keeps it out.
  // Points are moved, never removed, so the shot's shape survives — only its wall-hugging does not.
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let clearanceMoves = [];   // [{ from: [x,z], to: [x,z], m }] per shotsFor call — reported on the shot for QA
  function clearPoint(p, lv, margin = 0.7) {
    if (!lv || !Array.isArray(lv.footprint) || !lv.footprint.length) return p;
    const out = clearPointRaw(p, lv, margin);
    const m = Math.hypot(out.x - p.x, out.z - p.z);
    if (m > 0.01) clearanceMoves.push({ from: [+p.x.toFixed(2), +p.z.toFixed(2)], to: [+out.x.toFixed(2), +out.z.toFixed(2)], m: +m.toFixed(2) });
    return out;
  }
  function clearPointRaw(p, lv, margin) {
    let x = p.x, z = p.z;
    const edges = perimeterEdges(lv.footprint);
    const INWARD = { S: [0, -1], N: [0, 1], E: [-1, 0], W: [1, 0] };
    for (let iter = 0; iter < 3; iter++) {
      if (!lv.footprint.some(r => inRect(x, z, r))) {
        // outside: jump to the nearest point that is `margin` inside some rect
        let best = null;
        for (const r of lv.footprint) {
          if (r.w < 2 * margin || r.d < 2 * margin) continue;
          const nx = clamp(x, r.x + margin, r.x + r.w - margin), nz = clamp(z, r.z + margin, r.z + r.d - margin);
          const d = Math.hypot(nx - x, nz - z);
          if (!best || d < best.d) best = { d, nx, nz };
        }
        if (best) { x = best.nx; z = best.nz; }
      }
      for (const e of edges) {
        const horiz = e.a[1] === e.b[1];
        const lo = Math.min(e.a[horiz ? 0 : 1], e.b[horiz ? 0 : 1]), hi = Math.max(e.a[horiz ? 0 : 1], e.b[horiz ? 0 : 1]);
        const along = horiz ? x : z, across = horiz ? z - e.a[1] : x - e.a[0];
        if (along < lo - 0.05 || along > hi + 0.05) continue;                    // the point must project onto the edge
        const n = INWARD[e.side]; const dist = across * (horiz ? n[1] : n[0]);   // (p − a) · inward: > 0 when inside
        if (dist > -margin && dist < margin) { const push = margin - dist; x += n[0] * push; z += n[1] * push; }   // only edges it is actually near
      }
      for (const pt of lv.partitions || []) {
        const ax = pt.from[0], az = pt.from[1], bx = pt.to[0], bz = pt.to[1];
        const len = Math.hypot(bx - ax, bz - az); if (len < 1e-6) continue;
        const ux = (bx - ax) / len, uz = (bz - az) / len;
        const t = (x - ax) * ux + (z - az) * uz;                 // along the wall from `from`
        if (t < -margin || t > len + margin) continue;
        if (pt.door !== null && pt.door !== undefined && Math.abs(t - pt.door) < (pt.doorW || 0.9) / 2 + 0.15) continue;   // in the doorway
        const side = (x - ax) * -uz + (z - az) * ux;             // signed distance across the wall
        if (Math.abs(side) < margin) { const push = margin - Math.abs(side), sg = side < 0 ? -1 : 1; x += -uz * sg * push; z += ux * sg * push; }
      }
    }
    return V(x, p.y, z);
  }

  // Route the eye across one storey: A* on a 0.25 m grid from `from` to `to`, staying off the perimeter, off
  // partitions except through their doorways, and out of anything tall enough to meet the eye (the solids
  // collected while placing items). Returns the interior corners of the string-pulled path, [] when the
  // straight line is already clear or no route exists (the caller then keeps its direct leg) — or, with
  // opts.strict, null when no route exists.
  // Is (x, z) somewhere the eye must not be on this storey: outside the footprint, within WALL of the perimeter,
  // within PART of a partition (except through its doorway), or within ITEM of something tall. opts overrides the
  // margins (wall, part, item) and adds `boxes` — plan boxes of the walls as built (jambs, an open door's leaf)
  // to keep `boxPad` off; the defaults are what every caller had before them.
  function blockedTest(lv, solids, opts: Record<string, any> = {}) {
    const WALL = opts.wall ?? 0.45, PART = opts.part ?? 0.4, ITEM = opts.item ?? 0.35, boxes = opts.boxes || [], PAD = opts.boxPad ?? 0.2;
    const edges = perimeterEdges(lv.footprint), parts = lv.partitions || [];
    const segDist = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); return Math.hypot(x - (ax + dx * t), z - (az + dz * t)); };
    return (x, z) => {
      if (!lv.footprint.some(r => inRect(x, z, r))) return true;
      for (const e of edges) if (segDist(x, z, e.a[0], e.a[1], e.b[0], e.b[1]) < WALL) return true;
      for (const pt of parts) {
        const ax = pt.from[0], az = pt.from[1], bx = pt.to[0], bz = pt.to[1];
        if (segDist(x, z, ax, az, bx, bz) >= PART) continue;
        if (pt.door !== null && pt.door !== undefined) {
          const len = Math.hypot(bx - ax, bz - az) || 1e-9, t = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / len;
          // through the doorway, keeping 0.25 m off the hinge jamb where the open leaf lies: the leaf hangs on
          // the wall's local −x jamb, which is the `from` end of an along-X wall and the `to` end of an
          // along-Z one (the +90° turn maps local +x onto world −z — same rule as the door offset)
          const alongX = Math.abs(az - bz) < 1e-6, dir = alongX ? Math.sign(bx - ax) || 1 : -(Math.sign(bz - az) || 1);
          const dw = pt.doorW || 0.9, hinge = pt.door - dir * dw / 2;
          if (Math.abs(t - pt.door) < dw / 2 - 0.05 && Math.abs(t - hinge) > 0.25) continue;
        }
        return true;
      }
      for (const so of solids) if (x > so.minX - ITEM && x < so.maxX + ITEM && z > so.minZ - ITEM && z < so.maxZ + ITEM) return true;
      for (const bx of boxes) if (x > bx.minX - PAD && x < bx.maxX + PAD && z > bx.minZ - PAD && z < bx.maxZ + PAD) return true;
      return false;
    };
  }
  // opts: blockedTest's, plus `strict` (null for no route) and `cache` (a Map keyed by `key`: the blocked grid of
  // a storey is the same for every route across it, and door-to-core asks for dozens while it picks an approach)
  function routeOn(lv, solids, from, to, opts: Record<string, any> = {}) {
    const none = opts.strict ? null : [];
    if (!lv || !Array.isArray(lv.footprint) || !lv.footprint.length) return none;
    const CELL = 0.25;
    const b = unionBounds(lv.footprint);
    const W = Math.ceil((b.maxX - b.minX) / CELL) + 1, H = Math.ceil((b.maxZ - b.minZ) / CELL) + 1;
    let base = opts.cache && opts.cache.get(opts.key);
    if (!base) {
      const blockedAt = blockedTest(lv, solids, opts);
      base = new Uint8Array(W * H);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) base[j * W + i] = blockedAt(b.minX + i * CELL, b.minZ + j * CELL) ? 1 : 0;
      if (opts.cache) opts.cache.set(opts.key, base);
    }
    const grid = base.slice();
    const cellOf = p => [Math.round((p.x - b.minX) / CELL), Math.round((p.z - b.minZ) / CELL)];
    const [si, sj] = cellOf(from), [gi, gj] = cellOf(to);
    const inside = (i, j) => i >= 0 && j >= 0 && i < W && j < H;
    if (!inside(si, sj) || !inside(gi, gj)) return none;
    grid[sj * W + si] = 0; grid[gj * W + gi] = 0;   // start and goal are where they are (a landing beside the stair, the desk approach)
    const free = (i, j) => inside(i, j) && !grid[j * W + i];
    // straight line clear? nothing to do
    const lineClear = (i0, j0, i1, j1) => { const n = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0)) * 2 || 1; for (let k = 0; k <= n; k++) { const i = Math.round(i0 + (i1 - i0) * k / n), j = Math.round(j0 + (j1 - j0) * k / n); if (!free(i, j)) return false; } return true; };
    if (lineClear(si, sj, gi, gj)) return [];
    // A*, 8-connected, no corner cutting
    const key = (i, j) => j * W + i, open = [[0, si, sj]], g = new Map([[key(si, sj), 0]]), came = new Map();
    const hcost = (i, j) => Math.hypot(i - gi, j - gj);
    const closed = new Uint8Array(W * H); let found = false;
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, i, j] = open.splice(bi, 1)[0]; const kk = key(i, j);
      if (closed[kk]) continue; closed[kk] = 1;
      if (i === gi && j === gj) { found = true; break; }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di, nj = j + dj; if (!free(ni, nj)) continue;
        if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
        const ng = g.get(kk) + Math.hypot(di, dj), nk = key(ni, nj);
        if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); came.set(nk, kk); open.push([ng + hcost(ni, nj), ni, nj]); }
      }
    }
    if (!found) return none;
    const cells = []; for (let k = key(gi, gj); k !== undefined; k = came.get(k)) cells.push([k % W, Math.floor(k / W)]);
    cells.reverse();
    // string-pull: keep only the corners the straight line cannot skip
    const corners = []; let a = 0;
    while (a < cells.length - 1) {
      let far = a + 1; for (let c = cells.length - 1; c > a + 1; c--) if (lineClear(cells[a][0], cells[a][1], cells[c][0], cells[c][1])) { far = c; break; }
      if (far < cells.length - 1) corners.push(cells[far]);
      a = far;
    }
    return corners.map(([i, j]) => [b.minX + i * CELL, b.minZ + j * CELL]);
  }

  function shotsForV1(spec, anchors) {
    const b = anchors.bounds || { minX: -6, maxX: 6, minZ: -4, maxZ: 4 };
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const hero = anchors.hero || { x: cx, y: 0.8, z: cz, level: spec.levels[0].id, fwd: [0, 1] };
    const entry = anchors.entry || { x: cx, y: 0, z: b.maxZ, out: [0, 1], level: spec.levels[0].id };
    const levelOf = id => spec.levels.find(l => l.id === id) || spec.levels[0];
    const heroLevel = levelOf(hero.level), entryLevel = levelOf(entry.level);
    const shots = {};

    // --- the Core orbit (assets/core-orbit.ts): door-to-core's finale and the core-orbit shot circle the Core at
    //     close range through whatever arc of the room is free round it
    const cY = hero.centreY ?? hero.y + 0.05;
    const orbitCtx = (() => {
      if (!anchors.hero || !anchors.hero.fwd || !heroLevel) return null;
      const core = (anchors.placed || []).find(o => o.userData && o.userData.role === 'hero');
      if (!core) return null;
      const centre = V(hero.x, cY, hero.z);
      return { core, centre, probe: createOrbitProbe({ THREE, level: heroLevel, placed: anchors.placed, core, centre }) };
    })();
    // radius: close enough that a 232 × 90 mm slab reads, far enough to see what it sits on; a shelf Core closer
    const ORBIT_R = { desk: 0.9, credenza: 0.95, island: 1.0, shelf: 0.8, none: 0.9 };
    const ORBIT_KIND = {
      // door-to-core's finale: ~120–150° at 25–40°/s, eye 0.45 → 0.36 m over the Core's centre (over the back of
      // the desk chair, which stands 1.05 m), ending on its front
      finale: { dr: 0, hs: [0.45, 0.36], sweep: { aMax: 150, aWant: 125, over: [15, 45] } },
      // the core-orbit product shot: wider, slower, a longer sweep and a gentle descent
      product: { dr: 0.2, hs: [0.52, 0.36], sweep: { aMax: 200, aWant: 160, over: [20, 45] } },
    };
    const heroAngle = p => { const vx = p.x - hero.x, vz = p.z - hero.z, f = hero.fwd || [0, 1]; return Math.atan2(vx * f[1] - vz * f[0], vx * f[0] + vz * f[1]) / DEG; };
    function heroOrbit(kind, arrive = null) {
      if (!orbitCtx) return null;
      const k0 = ORBIT_KIND[kind], r0 = (ORBIT_R[hero.surface] ?? 1.0) + k0.dr;
      // a low storey (an attic's 1.5 m knee walls under a flat ceiling) lowers the eye to keep it 0.32 m under
      const hMax = heroLevel.y + (heroLevel.height || 2.8) - 0.32 - cY;
      const k = { ...k0, hs: [Math.max(0.12, Math.min(k0.hs[0], hMax)), Math.max(0.1, Math.min(k0.hs[1], hMax - 0.04))] };
      const radii = [r0, r0 - 0.1, r0 + 0.1, r0 - 0.2, r0 + 0.2].filter(r => r >= 0.65 && r <= 1.5);
      // where the eye arrives from breaks a tie (a free-standing Core): start the orbit on that side
      const prefer = arrive === null ? -1 : heroAngle(arrive) >= 0 ? -1 : 1;
      const plan = planOrbit({ THREE, probe: orbitCtx.probe, centre: orbitCtx.centre, fwd: hero.fwd, radii, hs: k.hs, sweep: { ...k.sweep, prefer } });
      if (!plan) return null;
      const pts = arcWaypoints(THREE, orbitCtx.centre, hero.fwd, plan.r, plan.from, plan.to, k.hs[0], k.hs[1]);
      return { ...plan, pts, hs: k.hs, sweep: k.sweep, centre: orbitCtx.centre };
    }
    const orbitMeta = (plan, t0) => ({ t0: +t0.toFixed(4), t1: 1, centre: [plan.centre.x, plan.centre.y, plan.centre.z].map(v => +v.toFixed(3)), radius: +plan.r.toFixed(2), from: plan.from, to: plan.to, arc: plan.arc, dir: plan.dir, run: [plan.run.lo, plan.run.hi], full: plan.run.full });

    // --- door → core
    {
      clearanceMoves = [];
      const eye = [], tgt = [];
      const ex = entry.x, ez = entry.z, ox = entry.out[0], oz = entry.out[1], ey = entry.y;
      // Establishing shot kept close; it is still high enough to read the whole roofline, and the timing below
      // flies it in from the first frame.
      eye.push(V(ex + ox * (span * 0.45 + 5) + oz * (span * 0.35), span * 0.32 + 3.5, ez + oz * (span * 0.45 + 5) - ox * (span * 0.35))); tgt.push(V(cx, 1.2, cz));
      eye.push(V(ex + ox * 6 + oz * 2.0, ey + 2.2, ez + oz * 6 - ox * 2.0)); tgt.push(V(ex, ey + 1.3, ez));
      eye.push(V(ex + ox * 1.6, ey + 1.55, ez + oz * 1.6)); tgt.push(V(ex - ox * 2, ey + 1.3, ez - oz * 2));
      // two points on the door axis either side of the wall plane pin the curve through the opening (walls are
      // full height during the shot, so the eye has to pass between the jambs, not beside them)
      eye.push(V(ex + ox * 0.35, ey + 1.5, ez + oz * 0.35)); tgt.push(V(ex - ox * 3, ey + 1.25, ez - oz * 3));
      eye.push(V(ex - ox * 0.35, ey + 1.47, ez - oz * 0.35)); tgt.push(V(ex - ox * 3.5, ey + 1.2, ez - oz * 3.5));
      eye.push(V(ex - ox * 1.2, ey + 1.45, ez - oz * 1.2)); tgt.push(V(ex - ox * 4, ey + 1.2, ez - oz * 4));
      const heroLv = hero.level, entryLv = entry.level;
      const inDoor = eye.length - 1;
      eye[inDoor] = clearPoint(eye[inDoor], entryLevel, 0.6);   // just inside the door: off any partition beside it
      const fx = hero.fwd ? hero.fwd[0] : 0, fz = hero.fwd ? hero.fwd[1] : 1;
      const dx = hero.deskX ?? hero.x, dz = hero.deskZ ?? hero.z;
      // The finale orbits the Core (null: no Core to probe, or nothing round it is free — the old close-up).
      // The walk then ends at the approach: ~2 m out on the side the orbit starts from, somewhere the eye sees
      // the Core and the push-in to the orbit's first point is clear.
      const lastStair = heroLv !== entryLv ? (anchors.stairs || []).find(s => s.to === heroLv) : null;
      let fin = heroOrbit('finale', lastStair ? V(lastStair.top[0], 0, lastStair.top[2]) : eye[inDoor]);
      // The hero set (desk, monitor, shelf …) is placed outside the items loop, so it is not in anchors.solids;
      // the walk to an approach beside the desk has to steer round the monitor, which stands at eye height.
      // (Only this walk: hero-reveal's clear-run test keeps the old solids, and its path with them.)
      const heroSolids = [];
      if (orbitCtx) for (const o of anchors.placed || []) {
        if (o === orbitCtx.core || !o.userData || o.userData.role !== 'item') continue;
        const bb = new THREE.Box3().setFromObject(o);
        if (bb.isEmpty() || bb.max.y <= heroLevel.y + 1.1 || bb.min.y > heroLevel.y + 1.8) continue;
        if (Math.hypot(Math.max(bb.min.x - hero.x, 0, hero.x - bb.max.x), Math.max(bb.min.z - hero.z, 0, hero.z - bb.max.z)) > 1.6) continue;
        heroSolids.push({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z, top: bb.max.y, type: o.userData.itemType || o.name });
      }
      // A flight of stairs stands on the storey it climbs from, and a walk there goes round it to its foot, never
      // under it (lakecabin's route to the foot ran the length of its stair: the eye under the upper treads, then
      // through the spine and treads where the flight comes down to eye height). The climb itself is not routed.
      const stairSolidsOn = lv => (anchors.stairs || []).filter(st => st.from === lv.id && st.plan).map(st => ({ ...st.plan, top: lv.y + 3, type: 'stairs' }));
      const solidsOn = lv => ((anchors.solids || {})[lv.id] || []).concat(lv === heroLevel ? heroSolids : [], stairSolidsOn(lv));
      // The walls as built, in plan, where they stand at eye height: the jambs of every doorway and the open leaf
      // hung in it (0.8 m of door standing out into the room, which the spec's partition lines know nothing
      // about). The walk keeps WALL_PAD off them; the clip repair below tests the eye against them in 3D.
      const wallMeshes = [];
      for (const o of anchors.placed || []) if (o.userData && o.userData.role === 'wall') { o.updateMatrixWorld(true); o.traverse(m => { if (m.isMesh) { const bb = new THREE.Box3().setFromObject(m); if (!bb.isEmpty()) wallMeshes.push(bb); } }); }
      const wallBoxesOn = lv => wallMeshes.filter(bb => bb.max.y > lv.y + 0.9 && bb.min.y < lv.y + 2.0).map(bb => ({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z }));
      // Route a walk leg, easing off when the storey as furnished leaves no way through: the usual margins plus
      // 0.2 m off the built walls; then tighter margins; then squeezing between the pieces of furniture at eye
      // height (a monitor on a desk included); then walls and stairs alone (the eye brushes through furniture — a
      // warning — rather than through a wall, which is what "no route" used to mean: a straight line).
      const routeCache = new Map();
      const eyeItemsOn = lv => (anchors.placed || []).filter(o => o.userData && o.userData.role === 'item').map(o => new THREE.Box3().setFromObject(o))
        .filter(bb => !bb.isEmpty() && bb.max.y > lv.y + 1.0 && bb.min.y < lv.y + 1.9).map(bb => ({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z }));
      // (the last squeezes past an open door that stands across a corridor, 0.16 m off its edge and the wall
      // beyond it: lakecabin's only way to its stair foot, which a wider margin reads as no way at all — and the
      // straight line it fell back to went through the door)
      const TIERS = [{ boxPad: 0.2 }, { wall: 0.3, part: 0.3, item: 0.15, boxPad: 0.15 }, { wall: 0.3, part: 0.3, item: 0.02, boxPad: 0.12, eyeItems: true }, { wall: 0.3, part: 0.3, boxPad: 0.12, bare: true },
        { wall: 0.12, part: 0.12, boxPad: 0.07, bare: true }];
      const routeWalk = (lv, from, to) => {
        const boxes = wallBoxesOn(lv);
        for (const [i, tier] of TIERS.entries()) {
          const solids = tier.bare ? stairSolidsOn(lv) : tier.eyeItems ? solidsOn(lv).concat(eyeItemsOn(lv)) : solidsOn(lv);
          const corners = routeOn(lv, solids, from, to, { ...tier, boxes, strict: true, cache: routeCache, key: `${lv.id}:${i}` });
          if (corners) return corners;
        }
        return [];
      };
      // Candidate approaches for one sweep direction `opt`: d degrees on from the orbit's start `from` (d < 0:
      // beyond it, so the push-in spirals in), D metres out — somewhere the walk may stand, that sees the Core, and
      // whose push-in to the orbit is clear. Pushing in from across the Core to an orbit that starts behind it is
      // a whip pan, not a push-in, so the approach stands on the orbit's starting side; where nothing there works
      // the orbit starts later (a shorter sweep, down to FIN_MIN), and only failing that is the approach anywhere.
      // The approach stands at eye height — under the ceiling of a low storey (an attic's 1.5 m) — and keeps off
      // what stands tall enough to meet the eye there; a bed's 1.1 m headboard it may look over.
      const yA = heroLevel.y + Math.min(1.42, (heroLevel.height || 2.8) - 0.35);
      // the shortest finale sweep an approach may start (ORBIT_KIND.finale.sweep.aWant is the aim): a walk that comes
      // straight at the Core's front (starter18k) is met by 45° from the front to a three-quarter, not by a push-in that
      // hooks 15° one way for the orbit to sweep back
      const FIN_MIN = 45;
      let finChoice = null;    // how the chosen approach meets the orbit (reported in timing.stats)
      const blockedHero = fin ? blockedTest(heroLevel, solidsOn(heroLevel).filter(so => !(so.top < yA - 0.2))) : null;
      const approachCandidates = opt => {
        const out = [];
        const tryAt = (sw, ds, relaxed) => {
          const from = sw.from, S = orbitPoint(THREE, fin.centre, hero.fwd, fin.r, from, fin.centre.y + fin.hs[0]);
          // 1.2 m out is a last resort (a Core with furniture 1.5 m off its side): the push-in is then a nudge
          for (const d of ds) for (const D of [2.0, 1.7, 1.4, 1.2]) {
            if (D < fin.r + 0.3) continue;
            const p = orbitPoint(THREE, fin.centre, hero.fwd, D, from + opt.dir * d, yA);
            if (blockedHero(p.x, p.z) || !orbitCtx.probe.free(p.x, p.y, p.z) || !orbitCtx.probe.sees(p.x, p.y, p.z)) continue;
            const n = Math.ceil(p.distanceTo(S) / 0.1);
            let clear = true; for (let i = 1; i < n && clear; i++) { const q = p.clone().lerp(S, i / n); clear = orbitCtx.probe.free(q.x, q.y, q.z); }
            if (clear) out.push({ opt, sw, from, d, D, p, S, relaxed, arc: sw.arc });
          }
        };
        // the start moves round in 10° steps, the end's overshoot growing to keep the sweep near aWant — down to
        // FIN_MIN°: a walk that arrives near the front is better met by a short orbit that carries on the way
        // it was going than by a long one it has to double back round the Core for (chooseApproach weighs that)
        for (let from = opt.from; ; from += opt.dir * 10) {
          const sw = sweepFrom(fin.run, opt.dir, from, fin.sweep);
          if (!sw || sw.arc < Math.min(FIN_MIN, opt.arc) - 1e-6) break;
          tryAt(sw, [-10, 0, 15], false);
        }
        tryAt(opt, [30, 60, 90, 120], true);
        return out;
      };
      // What the end of the walk does round the Core, for one candidate, measured on the curve the shot will fly
      // (the centripetal Catmull-Rom through the route, the approach and the orbit's first points — it swings
      // wide of a sharp corner, which is where a hook back round the Core comes from): `wrong`, the degrees its
      // last WALK_TAIL metres and the push-in travel round the Core AGAINST the orbit's direction while the Core
      // is in sight and within SWING_R (the eye circles one way, stops, and the orbit sweeps it back over the same
      // arc; the walk through the next room, the Core behind a wall, is only a walk), and `near`, how close in plan
      // those metres pass the Core (a walk that crosses the desk in front of it shows the dark front before the
      // orbit brings it round).
      const WALK_TAIL = 4.0, SWING_R = 4.5;
      const wrapDeg = d => ((d + 540) % 360) - 180;
      // the Core is in sight from (x, z) when the line to it crosses no partition outside its doorway and no
      // outside wall (walls are full height during the shot)
      const sightWalls = perimeterEdges(heroLevel.footprint || []).map(e => ({ a: e.a, b: e.b, door: null, doorW: 0 }))
        .concat((heroLevel.partitions || []).map(pt => ({ a: pt.from, b: pt.to, door: pt.door ?? null, doorW: pt.doorW || 0.9 })));
      const coreInSight = (x, z) => !sightWalls.some(({ a, b, door, doorW }) => {
        const ex = b[0] - a[0], ez = b[1] - a[1], rx = hero.x - x, rz = hero.z - z, den = rx * ez - rz * ex;
        if (Math.abs(den) < 1e-9) return false;
        const t = ((a[0] - x) * ez - (a[1] - z) * ex) / den, u = ((a[0] - x) * rz - (a[1] - z) * rx) / den;
        if (t <= 0.02 || t >= 0.98 || u < 0 || u > 1) return false;
        return door === null || Math.abs(u * Math.hypot(ex, ez) - door) > doorW / 2 - 0.05;
      });
      const walkEnd = (start, corners, c, prefix = []) => {
        const n1 = Math.max(1, Math.ceil(c.arc / 15));
        const pts = [...prefix, V(start.x, prefix.length ? start.y : yA, start.z), ...corners.map(([x, z]) => V(x, yA, z)), V(c.p.x, yA, c.p.z), c.S.clone(),
          orbitPoint(THREE, fin.centre, hero.fwd, fin.r, c.from + c.sw.dir * c.arc / n1, c.S.y)];
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), segs = pts.length - 1, iP = segs - 2;
        // samples every ~5 cm up to the orbit's start, with the distance walked to each
        const samples = [];
        let walked = 0, prev = null;
        for (let k = 0; k < segs - 1; k++) {
          const n = Math.max(2, Math.ceil(pts[k].distanceTo(pts[k + 1]) / 0.05));
          for (let i = k ? 1 : 0; i <= n; i++) { const q = curve.getPoint((k + i / n) / segs); if (prev) walked += Math.hypot(q.x - prev.x, q.z - prev.z); samples.push({ q, walked, push: k === iP && i > 0 }); prev = q; }
        }
        const atP = samples.find(s => s.push)?.walked ?? walked, tail = samples.filter(s => s.walked >= atP - WALK_TAIL);
        const near = Math.min(...tail.filter(s => !s.push).map(({ q }) => Math.hypot(q.x - hero.x, q.z - hero.z)));
        let wrong = 0, last = null;
        for (const { q } of tail) {
          const a = heroAngle(q), seen = q.y > heroLevel.y + 0.6 && Math.hypot(q.x - hero.x, q.z - hero.z) < SWING_R && coreInSight(q.x, q.z);
          if (last !== null && seen) wrong += Math.max(0, -c.sw.dir * wrapDeg(a - last));
          last = a;
        }
        return { wrong, near, push: samples.filter(s => s.push).map(s => s.q) };
      };
      // The push-in as flown (the curve, not its chord) keeps the Core in sight and the eye clear, every 15 cm.
      const pushClear = push => push.filter((_, i) => i % 3 === 2 || i === push.length - 1).every(q => orbitCtx.probe.free(q.x, q.y, q.z) && orbitCtx.probe.sees(q.x, q.y, q.z));
      // The orbit and the approach the walk from `start` should end at, chosen together over both directions
      // round the Core: the longest sweep (every degree short of 120 counting half again), less 3 for every
      // degree past 8 the end of the walk travels round the Core against the orbit in sight of it (above — the
      // one thing a long sweep must never cost), 0.3 for every degree the route turns into the push-in (a route
      // that doubles back is a whip pan) and 0.4 for every degree over 90 the push-in turns into the orbit (it
      // hooks back on itself), 30 if its last straight leg is under 1.2 m and turns over 30° into the push-in
      // (it zig-zags round the desk into it), 40 if the walk passes within 1.1 m of the Core, 60 for an approach
      // off the orbit's starting side, 0.15 per degree it stands off the start (a push-in that spirals in the
      // orbit's direction earns it back), 0.3 for every degree under 45 the orbit travels before the front comes
      // round, 10 for an approach only 1.2 m out. The best whose push-in stays clear and in sight of the Core wins.
      const chooseApproach = (start, prefix = []) => {
        if (!fin) return null;
        const scored = [];
        for (const opt of fin.options) for (const c of approachCandidates(opt)) {
          const corners = routeWalk(heroLevel, start, c.p);
          const last = corners.length ? corners[corners.length - 1] : [start.x, start.z];
          const lx = c.p.x - last[0], lz = c.p.z - last[1], leg = Math.hypot(lx, lz);
          const px = c.S.x - c.p.x, pz = c.S.z - c.p.z, pl = Math.hypot(px, pz) || 1e-6;
          const turn = leg > 1e-6 ? Math.acos(Math.max(-1, Math.min(1, (lx * px + lz * pz) / (leg * pl)))) / DEG : 0;
          // the orbit's heading as it leaves S: d/dθ of centre + r(cos θ·fwd + sin θ·side), in the sweep's direction
          const a = c.from * DEG, f = hero.fwd, sd = [f[1], -f[0]], tx = c.sw.dir * (-Math.sin(a) * f[0] + Math.cos(a) * sd[0]), tz = c.sw.dir * (-Math.sin(a) * f[1] + Math.cos(a) * sd[1]);
          const entry = Math.acos(Math.max(-1, Math.min(1, (px * tx + pz * tz) / pl))) / DEG;
          // the degrees the orbit travels before it reaches the Core's front: under 45 and the front is shown at
          // the start and the orbit turns away from it
          const lead = -c.from * c.sw.dir;
          const { wrong, near, push } = walkEnd(start, corners, c, prefix);
          const score = Math.min(c.arc, 150) + 0.5 * Math.min(c.arc, 120) - 3 * Math.max(0, wrong - 8) - 0.3 * turn - 0.4 * Math.max(0, entry - 90) - (leg < 1.2 && turn > 30 ? 30 : 0)
            - (near < 1.1 ? 40 : 0) - (c.relaxed ? 60 : 0) - 0.15 * Math.abs(c.d) + 0.3 * Math.max(0, -c.d) - 0.3 * Math.max(0, 45 - lead) - (c.D < 1.4 ? 10 : 0);
          scored.push({ ...c, score, wrong, near, push });
        }
        scored.sort((a, b) => b.score - a.score);
        const best = scored.find(c => pushClear(c.push)) || scored[0];
        if (!best) return null;
        const { sw } = best;
        fin = { ...fin, dir: sw.dir, from: sw.from, to: sw.to, arc: sw.arc, pts: arcWaypoints(THREE, fin.centre, hero.fwd, fin.r, sw.from, sw.to, fin.hs[0], fin.hs[1]) };
        finChoice = { wrong: +best.wrong.toFixed(1), near: +best.near.toFixed(2), d: best.d, D: best.D };
        return best.p;
      };
      const fallbackApproach = () => clearPoint(V(dx + fx * 2.0, hero.y + (hero.surface === 'shelf' ? 0.5 : 0.9), dz + fz * 2.0), heroLevel, 0.5);   // 2 m in front of the hero
      let approach = null;
      const stairPts = new Set<number>();   // indices of eye points on a flight (a slower segment in the timing)
      const walkPts = new Set<number>();    // indices of routed corners (their look-ahead is smoothed below)
      // Walk each storey leg through its doorways and around tall furniture rather than straight across the
      // plan (a straight line from the door to the desk crossed bathrooms and wardrobes): the routed corners
      // go in at eye height, each looking at the next.
      const walk = (lv, from, to, lookAt) => {
        const corners = routeWalk(lv, from, to);
        corners.forEach((c, i) => { const nx = corners[i + 1]; walkPts.add(eye.length); eye.push(V(c[0], lv.y + 1.45, c[1])); tgt.push(nx ? V(nx[0], lv.y + 1.25, nx[1]) : lookAt); });
        return corners.length;
      };
      if (heroLv !== entryLv) {
        // every stair between the entry level and the hero level, in order (a third storey means two flights;
        // flying from the first landing straight to the desk went through the top slab)
        const chain = []; for (let lvId = entryLv, guard = 0; lvId !== heroLv && guard < 4; guard++) { const st = anchors.stairs.find(s => s.from === lvId) ; if (!st) break; chain.push(st); lvId = st.to; }
        if (!chain.length && anchors.stairs[0]) chain.push(anchors.stairs[0]);
        chain.forEach((st, i) => {
          const last = i === chain.length - 1, next = chain[i + 1];
          const [bx, by, bz] = st.bottom, [tx, ty, tz] = st.top;
          const after = last ? V(hero.x, hero.y + 0.3, hero.z) : V(next.bottom[0], next.bottom[1] + 1.2, next.bottom[2]);   // what the landing looks at
          const spiral = Math.hypot(tx - bx, tz - bz) < 0.1;
          // A spiral has no run: its "top" is its centre column. Climb beside it, on the side we leave toward.
          const u = spiral ? (() => { const d = [after.x - bx, after.z - bz], n = Math.hypot(d[0], d[1]) || 1; return [d[0] / n, d[1] / n]; })() : st.dir;
          const lvFrom = levelOf(st.from);
          const foot = clearPoint(spiral ? V(bx - u[0] * 1.6, by + 1.5, bz - u[1] * 1.6) : V(bx - u[0] * 1.5, by + 1.5, bz - u[1] * 1.5), lvFrom, 0.6);
          // The walk goes round the flight to its foot, never under it (stairSolidsOn). A flight whose first step
          // starts half a metre off a wall leaves nowhere to stand in line with it: the foot above clears back onto
          // the first step, inside the flight's plan, where no route can reach it — and the walk used to fall back
          // to a straight line, under the flight and through the partitions on the way. There it comes to the foot
          // from the side of the first steps, as lakecabin's used to along its south wall, and turns onto the flight.
          const pl = st.plan, M = 0.4;
          if (pl && !spiral && foot.x > pl.minX - M && foot.x < pl.maxX + M && foot.z > pl.minZ - M && foot.z < pl.maxZ + M) {
            const perp = [u[1], -u[0]], half = Math.abs(perp[0]) * (pl.maxX - pl.minX) / 2 + Math.abs(perp[1]) * (pl.maxZ - pl.minZ) / 2;
            const off = (foot.x - (pl.minX + pl.maxX) / 2) * perp[0] + (foot.z - (pl.minZ + pl.maxZ) / 2) * perp[1];
            const blocked = blockedTest(lvFrom, solidsOn(lvFrom), { boxes: wallBoxesOn(lvFrom), boxPad: 0.15, item: 0.2 });
            const from = eye[eye.length - 1];
            const sides = [1, -1].map(s => { const d = s * (half + 0.5) - off; return V(foot.x + perp[0] * d, lvFrom.y + 1.45, foot.z + perp[1] * d); })
              .filter(p => !blocked(p.x, p.z))
              .map(p => { const cs = routeWalk(lvFrom, from, p), pts = [[from.x, from.z], ...cs, [p.x, p.z]]; let L = 0; for (let j = 1; j < pts.length; j++) L += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); return { p, L }; })
              .sort((a, b) => a.L - b.L);
            if (sides.length) { const sp = sides[0].p; walk(lvFrom, from, sp, foot); walkPts.add(eye.length); eye.push(sp); tgt.push(foot.clone()); }
            else walk(lvFrom, from, foot, V(tx, ty + 0.8, tz));
          } else walk(lvFrom, eye[eye.length - 1], foot, V(tx, ty + 0.8, tz));   // door (or the last landing) → stair foot, through the rooms between
          eye.push(foot); tgt.push(V(tx, ty + 0.8, tz));
          // (spiral: a quarter-turn around the column at mid height, looking past it to the landing, so the
          // column is beside the lens rather than filling it)
          stairPts.add(eye.length);
          eye.push(spiral ? clearPoint(V(bx - u[1] * 1.7, (by + ty) / 2 + 1.3, bz + u[0] * 1.7), levelOf(st.to), 0.5) : V((bx + tx) / 2, (by + ty) / 2 + 1.4, (bz + tz) / 2)); tgt.push(V(tx + u[0] * 1.5, ty + 1.0, tz + u[1] * 1.5));
          // Landing: the stair often arrives 0.4 m short of a wall, so "0.8 m past the top" can sit inside it —
          // clear it against the upper plan, then blend one point toward where we go next so the turn out of
          // the stairwell is not a corner the Catmull-Rom overshoots into the wall beside the landing.
          // The landing sits 0.8 m past the top step — unless a wall stands closer than that (a stair that
          // arrives 0.6 m short of a partition): then it stays on the stair's side of it, 0.3 m past the top,
          // and the routed leg turns toward the doorway from there.
          const upper = levelOf(st.to), blockedUp = blockedTest(upper, (anchors.solids || {})[upper.id] || []);
          const reach = spiral ? 1.4 : [0.8, 0.55, 0.3].find(r => !blockedUp(tx + u[0] * r, tz + u[1] * r)) ?? 0.3;
          const landing = clearPoint(V(tx + u[0] * reach, ty + 1.5, tz + u[1] * reach), upper, Math.min(0.8, reach));
          stairPts.add(eye.length);
          eye.push(landing); tgt.push(after);
          if (last) {
            // landing → desk approach through the upper rooms; a straight leg keeps the old blend point (toward
            // the approach, where the orbit has one: toward the hero it could stand past the approach — a hook)
            // (the climb comes before the landing: a flight that lands beside the Core has already carried the eye
            // round it by the time the walk starts — lakecabin, modernhouse1, payorote)
            approach = chooseApproach(landing, eye.slice(-3, -1)) || fallbackApproach();
            const aim = fin ? approach : after, to = [aim.x - landing.x, aim.z - landing.z], dist = Math.hypot(to[0], to[1]);
            if (!walk(levelOf(st.to), landing, approach, V(hero.x, hero.y + 0.3, hero.z)) && dist > 3.5) { eye.push(clearPoint(V(landing.x + to[0] / dist * 1.6, ty + 1.45, landing.z + to[1] / dist * 1.6), levelOf(st.to), 0.7)); tgt.push(after); }
          }
        });
      } else if (!walk(heroLevel, eye[inDoor], approach = chooseApproach(eye[inDoor]) || fallbackApproach(), V(hero.x, hero.y + 0.3, hero.z)) && !fin) {
        // a straight leg: a blend point halfway to the hero (not with an orbit — the approach stands beside the
        // Core, and a point halfway to the Core can stand past it, which hooks the walk back on itself)
        eye.push(clearPoint(V((ex - ox * 1.2 + hero.x) / 2, ey + 1.45, (ez - oz * 1.2 + hero.z) / 2), heroLevel, 0.6)); tgt.push(V(hero.x, hero.y + 0.3, hero.z));
      }
      approach ||= fallbackApproach();   // (a chain of stairs that never reached the hero's storey)
      // what each waypoint is, for the timing and the repairs below: the fly-in, the street, the doorway, a routed
      // corner, a stair point, anything else on the way (`way`), the approach, the orbit
      const kind: string[] = eye.map((_, k) => k === 0 ? 'establish' : k === 1 ? 'fly' : k === 2 ? 'street' : k <= inDoor ? 'door' : stairPts.has(k) ? 'stair' : walkPts.has(k) ? 'walk' : 'way');
      const subject = fin ? V(fin.centre.x, fin.centre.y + 0.03, fin.centre.z) : null;
      if (fin) {
        eye.push(approach); tgt.push(subject.clone()); kind.push('approach');
        for (const w of fin.pts) { eye.push(w.p); tgt.push(subject.clone()); kind.push('orbit'); }
      } else {
        // no orbit: the last two points frame the surface, then the Core itself — a 232 × 90 mm slab, so close:
        // 0.7 m out, ¾ from above the middle of the slab (a shelf Core is met at its own height)
        const lift = hero.surface === 'shelf' ? 0.22 : 0.4;
        eye.push(approach); tgt.push(V(hero.x, cY + 0.1, hero.z)); kind.push('approach');
        if (hero.surface === 'desk') {
          // on a desk the monitor stands 0.55 m to the Core's left (−side): end with the Core mid-right in the
          // foreground and the screen waking behind it, so the last three seconds show both
          const sx = fz, sz = -fx;   // side = [fwd.z, −fwd.x], the desk's right
          // eye just right of the Core so the stand and chair stay out of the middle, aimed between the Core and the screen
          eye.push(clearPoint(V(hero.x + fx * 1.3 + sx * 0.04, cY + 0.35, hero.z + fz * 1.3 + sz * 0.04), heroLevel, 0.3)); tgt.push(V(hero.x - sx * 0.22, cY + 0.18, hero.z - sz * 0.22));
        } else {
          eye.push(clearPoint(V(hero.x + fx * 0.7 - fz * 0.24, cY + lift, hero.z + fz * 0.7 + fx * 0.24), heroLevel, 0.3)); tgt.push(V(hero.x, cY, hero.z));
        }
        kind.push('close');
      }
      // Clip repair. The waypoints keep off every wall, but the curve through them is a curve: where a routed
      // leg turns hard (into a doorway, at a stair foot) the centripetal Catmull-Rom swings a few centimetres
      // wide of its chord and can shave a jamb or a partition end. Walk the curve in 3 cm steps against the walls
      // as built, the stairs and the furniture (the QA gate's boxes: anything standing over 0.25 m) and, wherever it enters
      // one, add a waypoint on the chord there — the curve then hugs the (clear) chord. A few passes; the
      // orbit, vetted by its own probe, is left alone.
      {
        const hash = new Map(), cellKey = (i, j) => i * 100003 + j;
        const solidsNow = wallMeshes.concat((anchors.placed || []).filter(o => o.userData && o.userData.role === 'item').map(o => new THREE.Box3().setFromObject(o))
          .filter(bb => { if (bb.isEmpty()) return false; const sz = bb.getSize(new THREE.Vector3()); return sz.y > 0.25 && sz.x < 8 && sz.z < 8; }));
        solidsNow.forEach((bb, n) => { for (let i = Math.floor(bb.min.x); i <= Math.floor(bb.max.x); i++) for (let j = Math.floor(bb.min.z); j <= Math.floor(bb.max.z); j++) { const k = cellKey(i, j); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(n); } });
        // and the stairs, tread by tread in each mesh's own frame (a sloped spine's world box would swallow the
        // climb above it): the curve rounding a stair foot must not cut through the flight's low end
        const stairMeshes = [], local = new THREE.Vector3();
        for (const o of anchors.placed || []) if (o.userData && o.userData.stair) {
          o.updateMatrixWorld(true);
          o.traverse(m => { if (!m.isMesh || !m.geometry) return; m.geometry.computeBoundingBox(); stairMeshes.push({ wb: new THREE.Box3().setFromObject(m), inv: m.matrixWorld.clone().invert(), box: m.geometry.boundingBox }); });
        }
        const inStair = p => stairMeshes.some(s => s.wb.containsPoint(p) && s.box.containsPoint(local.copy(p).applyMatrix4(s.inv)));
        const inWall = p => (hash.get(cellKey(Math.floor(p.x), Math.floor(p.z))) || []).some(n => solidsNow[n].containsPoint(p)) || inStair(p);
        for (let pass = 0; pass < 6; pass++) {
          const curve = new THREE.CatmullRomCurve3(eye, false, 'centripetal'), segs = eye.length - 1, fixes = [];
          for (let k = 1; k < segs; k++) {
            if (kind[k + 1] === 'orbit' || kind[k] === 'orbit') continue;
            const n = Math.max(4, Math.ceil(eye[k].distanceTo(eye[k + 1]) / 0.03));
            let run = null;
            for (let i = 1; i < n; i++) { const f = i / n; if (inWall(curve.getPoint((k + f) / segs))) { run ||= { k, f0: f }; run.f1 = f; } else if (run) break; }
            if (run) { const f = (run.f0 + run.f1) / 2, q = eye[k].clone().lerp(eye[k + 1], f); if (!inWall(q)) fixes.push({ k, f, q }); }
          }
          if (!fixes.length) break;
          for (const { k, f, q } of fixes.reverse()) {   // back to front, so earlier indices stay put
            const kd = kind[k + 1] === 'approach' || kind[k + 1] === 'close' ? 'way' : kind[k + 1];
            eye.splice(k + 1, 0, q); tgt.splice(k + 1, 0, tgt[k].clone().lerp(tgt[k + 1], f)); kind.splice(k + 1, 0, kd);
          }
        }
      }
      const iA = kind.indexOf('approach'), lastDoor = kind.lastIndexOf('door');
      // 12 s, or what the spec pins (the timing below is in seconds, so it is laid out for the duration the shot
      // will actually play at — the spec's override is applied after shotsFor has built every shot). A long walk
      // (three storeys, 45 m of travel) is pinned at 14 s.
      const pinnedDur = (spec.shots || []).filter(s => s && s.type === 'door-to-core' && s.duration).map(s => s.duration).pop();
      const shot: Record<string, any> = { type: 'door-to-core', dressing: { walls: 'up', roof: 'auto' }, name: `${spec.emoji || '🏠'} ${spec.name}: Front Door → Companion Core`, duration: pinnedDur || 12, closed: false, eyePoints: eye, targetPoints: tgt, clearance: clearanceMoves };
      if (fin) {
        // push in to the orbit, then arc round the Core at a steady angular speed, ending on its front. The
        // target is the Core throughout; `compose` turns the view so the Core sits off-centre with the room it
        // is heading into on the other side.
        // A routed corner looked at the next one, which may be 0.7 m away round a bookcase: a turn that sharp
        // at walking pace is a whip pan. Look LOOK metres on along the path instead (the Core, once that is past
        // the approach), so the heading turns ahead of the corners rather than at them.
        const LOOK = 2.5;
        kind.forEach((kd, k) => {
          if (kd !== 'walk') return;
          let rem = LOOK, p = eye[k], ahead = null;
          for (let j = k + 1; j <= iA; j++) { const d = p.distanceTo(eye[j]); if (d >= rem) { ahead = p.clone().lerp(eye[j], rem / d); break; } rem -= d; p = eye[j]; }
          tgt[k] = ahead ? V(ahead.x, ahead.y - 0.2, ahead.z) : subject.clone();
        });
        // Timing (assets/shot-path.ts): the orbit gets about a third of the shot at 25–40°/s, the push-in a second
        // or so, the travel the rest — the fly-in and the street approach at 2.2× and 1.5× the indoor pace, the
        // doorway and the stairs a little under it — and the shot moves from its first frame. The look turns
        // against time (shot-path.ts), and no leg may turn it faster than TURN°/s at any moment: a leg over which it
        // swings round (the turn just inside a door, the U-turn at the foot of a switchback stair) is given the
        // seconds that keep its PEAK rate — yaw and pitch together, as the monotone cubic through the waypoints'
        // looks actually turns it — under TURN, and the straight legs make them up, at no more than VMAX. A shot
        // too short for all of that (asymmetry's two switchbacks in 14 s, or a spec that pins 8 s) first runs its
        // orbit at 40°/s, then raises the budget 10 % at a time, every turning leg alike, until it fits — a quicker
        // pan everywhere rather than one whip, or a walk left no time (the times always strictly increase).
        // validate-house-spec refuses a door-to-core under 8 s, and the gate warns over 125°/s (look-whip).
        const DUR = shot.duration;
        const knots = knotArcLengths(new THREE.CatmullRomCurve3(eye, false, 'centripetal'), eye.length);
        const len = k => Math.max(1e-3, knots[k + 1] - knots[k]);
        const PACE = { fly: 2.2, street: 1.5, door: 0.8, stair: 0.85 };
        const cost = []; for (let k = 0; k < iA; k++) cost.push(len(k) / (PACE[kind[k + 1]] ?? 1));   // the segment arriving at eye[k + 1]
        const TURN = 110, VMAX = 9, m = fin.pts.length - 1;
        // the shot's fractions at orbit rate w: the orbit, the push-in, the walk — which keeps at least half the
        // shot (at 5 s the orbit and the push-in share 2.5 s and the orbit runs over 40°/s: the gate's orbit-yaw-rate)
        const lay = w => {
          let fo = fin.arc / (w * DUR), fp = clamp(len(iA) / 1.2 / DUR, 0.05, 0.1);
          if (fo + fp > 0.5) { const sq = 0.5 / (fo + fp); fo *= sq; fp *= sq; }
          return { w: fin.arc / (fo * DUR), fo, fp, ft: 1 - fo - fp };
        };
        // every waypoint's look, heading unwrapped (as shot-path.ts turns it) and pitch
        const heads = [], pitches = [];
        for (let k = 0; k < eye.length; k++) {
          const dx = tgt[k].x - eye[k].x, dy = tgt[k].y - eye[k].y, dz = tgt[k].z - eye[k].z, h = Math.atan2(dx, dz);
          heads.push(k ? heads[k - 1] + Math.atan2(Math.sin(h - heads[k - 1]), Math.cos(h - heads[k - 1])) : h); pitches.push(Math.atan2(dy, Math.hypot(dx, dz)));
        }
        const layout = (tau, L) => {
          const times = [0];
          for (let k = 0; k < iA; k++) times.push(times[k] + tau[k] / DUR);
          times[iA] = L.ft;
          for (let i = 0; i <= m; i++) times.push(L.ft + L.fp + L.fo * i / m);
          times[times.length - 1] = 1;
          return times;
        };
        // the fastest the look turns over walk leg k (°/s), sampled along the cubics shot-path.ts builds
        const peakRates = times => {
          const hAt = monotoneCubic(times, heads), pAt = monotoneCubic(times, pitches);
          return cost.map((_, k) => {
            let peak = 0; const a = times[k], b = times[k + 1], N = 16;
            for (let i = 0; i < N; i++) {
              const t0 = a + (b - a) * i / N, t1 = a + (b - a) * (i + 1) / N, dt = (t1 - t0) * DUR;
              const dh = hAt(t1) - hAt(t0), dp = pAt(t1) - pAt(t0), pm = (pAt(t1) + pAt(t0)) / 2;
              peak = Math.max(peak, Math.hypot(dh * Math.cos(pm), dp) / DEG / dt);
            }
            return peak;
          });
        };
        // the degrees each leg turns the look, × 1.5 (a turn between two held looks peaks at 1.5× its mean rate)
        const turnDeg = cost.map((_, k) => 1.5 * Math.hypot((heads[k + 1] - heads[k]) * Math.cos((pitches[k] + pitches[k + 1]) / 2), pitches[k + 1] - pitches[k]) / DEG);
        // the seconds per leg at budget R°/s, or null when they do not fit: start every turning leg at its mean
        // rate, then pin each leg that still peaks over R at the seconds that scale its peak down to it, and lay the
        // rest out by distance again
        const solve = (L, R) => {
          const secs = L.ft * DUR, need = turnDeg.map(d => d / R), pinned = new Set<number>();
          let tau = cost.slice();
          for (let pass = 0; pass < 24; pass++) {
            const pinnedSecs = [...pinned].reduce((a, k) => a + need[k], 0), freeCost = cost.reduce((a, c, k) => a + (pinned.has(k) ? 0 : c), 0);
            if (pinnedSecs + freeCost / VMAX > secs) return null;
            tau = freeCost > 1e-9 ? cost.map((c, k) => (pinned.has(k) ? need[k] : (secs - pinnedSecs) * c / freeCost)) : need.map(nd => nd * secs / pinnedSecs);
            const more = tau.map((t, k) => (!pinned.has(k) && t < need[k] ? k : -1)).filter(k => k >= 0);
            if (more.length) { more.forEach(k => pinned.add(k)); continue; }
            const peaks = peakRates(layout(tau, L));
            const over = peaks.map((p, k) => (p > R * 1.02 ? k : -1)).filter(k => k >= 0);
            if (!over.length) return tau;
            for (const k of over) { need[k] = tau[k] * peaks[k] / R * 1.03; pinned.add(k); }
          }
          return tau;
        };
        let L = lay(clamp(fin.arc / (clamp(4 / DUR, 0.3, 0.33) * DUR), 25, 40)), R = TURN, tau = solve(L, R);
        if (!tau && L.w < 40) { L = lay(40); tau = solve(L, R); }
        while (!tau && R < 1000) { R *= 1.1; tau = solve(L, R); }
        if (!tau) { const sc = cost.reduce((a, c) => a + c, 0) || 1; tau = cost.map(c => L.ft * DUR * c / sc); }
        const { w, fo, fp, ft } = L;
        const times = layout(tau, L);
        shot.timing = { times: times.map(t => +t.toFixed(5)), startSpeed: 0.5, endSpeed: 1, stats: { travel: +(knots[iA] - knots[0]).toFixed(1), indoorSpeed: +((knots[iA] - knots[lastDoor]) / ((ft - times[lastDoor]) * DUR)).toFixed(2), orbitDegPerSec: +w.toFixed(1), lookBudgetDegPerSec: +R.toFixed(0), lookPeakDegPerSec: +Math.max(0, ...peakRates(times)).toFixed(0), approachDeg: +heroAngle(approach).toFixed(0), ...(finChoice ? { walkWrongDeg: finChoice.wrong, walkNear: finChoice.near } : {}) } };
        // the Core is framed off-centre (the room it is heading into on the other side) from the orbit's first
        // point: the turn that puts it there is made over the push-in, not on top of the last walk leg's
        shot.compose = { subject, ndcX: -fin.dir * 0.26, fov: 40, weights: eye.map((_, k) => (k > iA ? 1 : 0)) };
        shot.orbit = { ...orbitMeta(fin, ft + fp), tIn: +ft.toFixed(4) };
        // the Core wakes as its front comes round: the button is pressed when the eye is 55° off its face (at
        // once, if the orbit starts nearer than that), and no later than 1.8 s before the end, so the fan and
        // the screen are seen spinning up
        const frontAt = fin.pts.findIndex(p => Math.abs(p.deg) <= 55);
        let at = frontAt <= 0 ? ft + fp : (() => { const a = fin.pts[frontAt - 1], b = fin.pts[frontAt], f = (Math.abs(a.deg) - 55) / (Math.abs(a.deg) - Math.abs(b.deg)); return ft + fp + fo * (frontAt - 1 + f) / m; })();
        at = Math.min(at, 1 - 1.8 / DUR);
        shot.power = { at: +at.toFixed(4), ramp: 0.08 };
        attachFrameAt(THREE, shot);
      } else {
        // the Core is dark until the camera comes round the desk, then the button is pressed and it wakes
        shot.power = { at: 0.74, ramp: 0.08 };
      }
      shots['door-to-core'] = shot;
    }
    // --- orbit
    {
      const r = span * 0.95 + 4, h = span * 0.45 + 3, eye = [], tgt = [];
      for (let i = 0; i < 8; i++) { const a = Math.PI / 4 + i * Math.PI / 4; eye.push(V(cx + Math.cos(a) * r, h, cz + Math.sin(a) * r)); tgt.push(V(cx, 1.2, cz)); }
      shots['orbit'] = { type: 'orbit', dressing: { walls: 'up', roof: 'on' }, name: `${spec.emoji || '🏠'} ${spec.name}: 360° Orbit`, duration: 10, closed: true, eyePoints: eye, targetPoints: tgt, power: { at: -1 } };
    }
    // --- core orbit: a slow product orbit round the Core alone, powered on throughout — the same free-arc search
    //     as door-to-core's finale, a little wider, the whole free run up to 200°, easing in and out and ending
    //     on the Core's front
    {
      const co = heroOrbit('product');
      if (co) {
        const subject = V(co.centre.x, co.centre.y + 0.03, co.centre.z), m = co.pts.length - 1;
        const shot = { type: 'core-orbit', dressing: { walls: 'up', roof: 'auto' }, name: `${spec.emoji || '🏠'} ${spec.name}: Companion Core Orbit`, duration: 8, closed: false,
          eyePoints: co.pts.map(w => w.p), targetPoints: co.pts.map(() => subject.clone()), power: { at: -1 },
          timing: { times: co.pts.map((_, i) => i / m), startSpeed: 0.3, endSpeed: 0.3 },
          compose: { subject, ndcX: -co.dir * 0.12, fov: 42 }, orbit: orbitMeta(co, 0) };
        shots['core-orbit'] = attachFrameAt(THREE, shot);
      } else {
        // Nothing round the Core is free at any radius (a desk in a corner, the Core a hand's width off both
        // walls): a slow push-in on its front instead — door-to-core's close-up, from a little further out — so
        // every house has the shot the gate, the goldens and the player ask for; `note` says why, and the gate
        // warns (core-orbit-fallback) rather than failing on a shot that is not there.
        clearanceMoves = [];
        const fx = hero.fwd ? hero.fwd[0] : 0, fz = hero.fwd ? hero.fwd[1] : 1, sx = fz, sz = -fx;
        const desk = hero.surface === 'desk', lift = hero.surface === 'shelf' ? 0.22 : 0.4;
        const at = (d, s, h, margin) => clearPoint(V(hero.x + fx * d + sx * s, cY + h, hero.z + fz * d + sz * s), heroLevel, margin);
        // (on a desk from over the back of the chair, which stands 1.05 m between the eye and the Core)
        const eye = desk ? [at(1.9, 0.35, 0.85, 0.5), at(1.55, 0.2, 0.7, 0.4), at(1.2, 0.08, 0.55, 0.3)]
          : [at(1.5, -0.45, lift + 0.22, 0.4), at(1.1, -0.34, lift + 0.1, 0.35), at(0.7, -0.24, lift, 0.3)];
        const aim = V(hero.x, cY, hero.z);
        shots['core-orbit'] = attachFrameAt(THREE, { type: 'core-orbit', dressing: { walls: 'up', roof: 'auto' }, name: `${spec.emoji || '🏠'} ${spec.name}: Companion Core Close-up`, duration: 8, closed: false,
          eyePoints: eye, targetPoints: eye.map(() => aim.clone()), power: { at: -1 }, timing: { times: [0, 0.5, 1], startSpeed: 0.3, endSpeed: 0.3 }, clearance: clearanceMoves,
          note: 'no free arc round the Core at any radius (walls or furniture within reach on every side): a slow push-in on its front instead of an orbit' });
      }
    }
    // --- hero reveal: descend from above onto the core — or, when there is a storey over the desk, pull in
    //     from across the room just under its ceiling (the old descent went through the upper floor's slab)
    {
      clearanceMoves = [];
      const fx = hero.fwd ? hero.fwd[0] : 0, fz = hero.fwd ? hero.fwd[1] : 1;
      const cY = hero.centreY ?? hero.y + 0.05, lift = hero.surface === 'shelf' ? 0.2 : 0.38;
      // a storey above anywhere along the approach (the desk may sit under a single-storey part while the
      // pull-in crosses under the upper floor)
      const above = spec.levels.filter(l => l.id !== hero.level && l.y > hero.y + 1)
        .find(l => [0, 2, 4, 7].some(d => (l.footprint || []).some(r => inRect(hero.x + fx * d, hero.z + fz * d, r, 0.5))));
      let eye;
      // how far in front of the hero the room runs clear (walls are full height during a shot, so the pull-in
      // starts inside the hero's own room, not across a partition): the longest of 7…2.5 m whose whole line is clear
      const blockedHero = blockedTest(heroLevel, (anchors.solids || {})[heroLevel.id] || []);
      let run = 1.5;
      for (let d = 7; d >= 1.5; d -= 0.25) { let ok = true; for (let sd = 1.0; sd <= d + 1e-6; sd += 0.25) if (blockedHero(hero.x + fx * sd, hero.z + fz * sd)) { ok = false; break; } if (ok) { run = d; break; } }
      if (above) {
        const ceil = above.y - 0.6;   // slab is 0.18 m, and the curve overshoots its first point by ~0.15 m
        eye = [clearPoint(V(hero.x + fx * run, ceil, hero.z + fz * run), heroLevel, 0.7), clearPoint(V(hero.x + fx * run * 0.57, Math.min(ceil, hero.y + 2.0), hero.z + fz * run * 0.57), heroLevel, 0.6),
          clearPoint(V(hero.x + fx * 1.8, hero.y + 0.9, hero.z + fz * 1.8), heroLevel, 0.4), clearPoint(V(hero.x + fx * 0.68 + fz * 0.22, cY + lift, hero.z + fz * 0.68 - fx * 0.22), heroLevel, 0.3)];
      } else {
        // descends through the roof line (the roofs fade as the eye comes under the ceiling), then pulls in
        // along the clear run
        eye = [V(hero.x + fx * (run + 1), hero.y + 9, hero.z + fz * (run + 1)), V(hero.x + fx * run * 0.57, hero.y + 3.5, hero.z + fz * run * 0.57), clearPoint(V(hero.x + fx * 1.8, hero.y + 0.9, hero.z + fz * 1.8), heroLevel, 0.4), clearPoint(V(hero.x + fx * 0.68 + fz * 0.22, cY + lift, hero.z + fz * 0.68 - fx * 0.22), heroLevel, 0.3)];
      }
      const tgt = [V(hero.x, hero.y, hero.z), V(hero.x, cY + 0.05, hero.z), V(hero.x, cY + 0.03, hero.z), V(hero.x, cY, hero.z)];
      shots['hero-reveal'] = { type: 'hero-reveal', dressing: { walls: 'up', roof: 'auto' }, name: `${spec.emoji || '🏠'} ${spec.name}: Hero Reveal`, duration: 8, closed: false, eyePoints: eye, targetPoints: tgt, underCeiling: !!above, clearance: clearanceMoves, power: { at: 0.55, ramp: 0.1 } };
    }
    // --- walkthrough: entry → each room centre on the entry level → hero
    {
      const lv = spec.levels.find(l => l.id === entry.level) || spec.levels[0];
      const rooms = (lv.rooms || []).map(r => rectCentre(r.bounds));
      const eye = [V(entry.x + entry.out[0] * 2, entry.y + 1.5, entry.z + entry.out[1] * 2)], tgt = [V(entry.x, entry.y + 1.3, entry.z)];
      for (const [rx, rz] of rooms) { eye.push(V(rx, lv.y + 1.5, rz)); tgt.push(V(rx + 0.01, lv.y + 1.1, rz - 2)); }
      eye.push(V(hero.x + (hero.fwd ? hero.fwd[0] : 0) * 1.2, (hero.centreY ?? hero.y) + 0.45, hero.z + (hero.fwd ? hero.fwd[1] : 1) * 1.2)); tgt.push(V(hero.x, hero.centreY ?? hero.y + 0.05, hero.z));
      shots['walkthrough'] = { type: 'walkthrough', dressing: { walls: 'up', roof: 'auto' }, name: `${spec.emoji || '🏠'} ${spec.name}: Walkthrough`, duration: 14, closed: false, eyePoints: eye, targetPoints: tgt, power: { at: 0.8, ramp: 0.08 } };
    }
    // Spec overrides: duration, and the dressing the shot records with — `walls` up (full height, the eye
    // uses the doorways), `cutaway` (the editor's dollhouse: south/east walls cut to 0.85 m) or `sims`
    // (cut only the exterior walls the eye is actually looking through, per frame); `roof` on, off, or
    // `auto` (fades out just before the eye passes under a ceiling). `enterT` pins that moment by hand
    // when the automatic search picks the wrong one.
    // An alias keeps pointing at the same shot object, so it keeps the type the frame logic switches on —
    // a spec that names its opener "front-door" used to lose the ease and the dolly zoom, because the only
    // thing anyone could ask was whether the preset KEY contained "door-to-core".
    for (const s of spec.shots || []) {
      const sh = shots[s.type]; if (!sh) continue;
      sh.duration = s.duration || sh.duration;
      if (s.walls) sh.dressing.walls = s.walls;
      if (s.roof) sh.dressing.roof = s.roof;
      if (s.enterT !== undefined) sh.enterT = s.enterT;
      if (s.id && s.id !== s.type) shots[s.id] = sh;
    }
    return shots;
  }

  // ---------------------------------------------------------------------------------------
  // Planner v2 (assets/shot-planner.ts), behind a switch: a spec's shots[].planner ('v1' | 'v2') for that shot, else the
  // page's global switch (room-creator.html's S5 slot: ?planner=v2 or window.__houseShotPlanner), else v1 — the
  // default on this branch, so every golden stays v1's. The v1 shots are built either way (v1 is what a v2 shot falls
  // back to, with the reason on the preset as v2Error, which the QA gate reports).
  //
  // anchors.shotWorld is the ShotWorld digest v2 plans on (assets/shot-world.ts), made on first read and kept (plan.json's
  // `shots` key reads it: assets/plan-export/shots.ts).
  const globalPlanner = () => (typeof bctx.extra.shotPlanner === 'function' ? bctx.extra.shotPlanner() : bctx.extra.shotPlanner) || null;
  function worldOf(spec, anchors) {
    if (!Object.prototype.hasOwnProperty.call(anchors, 'shotWorld')) {
      let cache = null;
      Object.defineProperty(anchors, 'shotWorld', { configurable: true, enumerable: false, get: () => (cache ||= digestWorld(THREE, spec, anchors, anchors.placed || [])) });
    }
    return anchors.shotWorld;
  }
  function shotsFor(spec, anchors) {
    const shots = shotsForV1(spec, anchors);
    worldOf(spec, anchors);   // (defined, not made: made on first read)
    // anchors.nav: the grid the planner walks on and the route a shot flies (S6's plan inset), made on first read
    if (!Object.prototype.hasOwnProperty.call(anchors, 'nav')) {
      let cache = null;
      Object.defineProperty(anchors, 'nav', { configurable: true, enumerable: false, get: () => (cache ||= navAnchor(anchors.shotWorld, type => { const p = shots[type]; return p && p.eyePoints ? p.eyePoints.map(v => [v.x, v.y, v.z]) : null; })) });
    }
    // door-to-core, then hero-reveal (lands on the finale's framing ring) and walkthrough (routed on nav v2): plan Completeness B
    for (const [type, plan] of [['door-to-core', planDoorToCore], ['hero-reveal', planHeroReveal], ['walkthrough', planWalkthrough]] as Array<[string, (w: any, o: any) => any]>) {
      const so = shotOptions(spec, type, globalPlanner()), v1 = shots[type];
      if (so.planner !== 'v2' || !v1) continue;
      const r = plan(anchors.shotWorld, so.options);
      if (r.ok) {
        const pre = presetFromTrack(THREE, r.track, { type, name: v1.name, world: anchors.shotWorld, dressing: { ...v1.dressing } });
        for (const k of Object.keys(shots)) if (shots[k] === v1) shots[k] = pre;
      } else v1.v2Error = { code: r.code, message: r.message };
    }
    return shots;
  }

  return { shotsFor, shotsForV1, clearPoint, blockedTest, routeOn };
}
