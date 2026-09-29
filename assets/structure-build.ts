// The structure — per storey: the floor slab (an upper storey's from its outline, voids cut out), the perimeter
// walls with their openings (or the opt-in graph walls), partitions, stairs and balustrades; then, once for the
// house, the ceilings under open sky and the roofs.
// Writes anchors.levels, anchors.bounds, anchors.entry and anchors.stairs.
//
// Seam module (plan S0): moved verbatim out of house-builder.ts. Owner: S2 (architecture).
import { perimeterEdges, edgeForOpening, outlineLoops, unionBounds, rectCentre, inRect } from './house-geometry.js';
import { FloorplanGraph } from './floorplan-graph.js';
import { createWallCompiler } from './wall-compiler.js';
import { buildRoofs, planRoofModels, roofUnderAt } from './roofs.js';
import { DEG, hex, mix } from './build-context.js';
import { specDefaults } from './spec/index.js';
import { levelStairs, stairPlan, createStairBuilder, autoVoidsFor } from './stairs.js';
import { slabOpenings, insideOutline, sunkRooms, pitRects, archEdges, edgeFor, rectOfEdge, edgeHeight, wallPieces, volumeSteps, doubleRoomsUnder, featureOpenings } from './arch-plan.js';
import { createFacade, facadeWanted } from './facade.js';
import { createArchMaterials } from './arch-materials.js';
import { createFeatures } from './features.js';
import { createRoomFinish, ownCeilingAt, noteRoom } from './room-finish.js';

// kitb (kit-build.ts, S1) turns the spec's doors, colours and finishes into the parameters below; this module
// keeps the geometry round each call.
export function createStructureBuild(bctx, { kitb }) {
  const { THREE, AssetFactory, ProceduralArchitecture, registerTrackedWall, registerRoof, registerCeiling, textures, useGraphWalls, std, group } = bctx;
  const stairBuilder = createStairBuilder({ THREE, ProceduralArchitecture, textures });
  const features = createFeatures(bctx);
  const finish = createRoomFinish(bctx);
  const facade = createFacade(bctx);
  const kitOf = new WeakMap();   // spec → its kit, for the build steps the orchestrator calls without one (buildCeilings)
  const anchorsOf = new WeakMap();   // spec → its anchors (placeRoofs has none)
  const FULL = [{ lo: 0, hi: 0, party: false }];   // a v1 wall: one piece, the storey's full height
  const rnd = (v: number) => Math.round(v * 1000) / 1000;

  // ---- S2's wall helpers ----------------------------------------------------------------------------------------
  // a lower wall (a knee wall, a low volume): its openings stop under its head
  const clipOpenings = (openings, hh) => openings.map(o => {
    if (o.type === 'window') { const top = (o.sillY ?? 0.9) + (o.height ?? 1.2); return top > hh - 0.08 ? { ...o, height: Math.max(0.2, hh - 0.08 - (o.sillY ?? 0.9)) } : o; }
    return (o.height ?? 2.1) > hh - 0.08 ? { ...o, height: hh - 0.08 } : o;
  });
  // the openings that reach a band [lo, hi] of a wall, in the band's own frame
  const bandHoles = (openings, lo, hi) => openings.map(o => {
    const b0 = o.type === 'window' ? (o.sillY ?? 0.9) : 0, b1 = b0 + (o.height ?? (o.type === 'window' ? 1.2 : 2.1));
    const y0 = Math.max(0, b0 - lo), y1 = Math.min(hi - lo, b1 - lo);
    return y1 - y0 > 0.03 ? { x0: o.offset - o.width / 2, x1: o.offset + o.width / 2, y0, y1, glazed: o.type === 'window' } : null;
  }).filter(Boolean);
  // A plain wall band — a strip of a shared split-level wall, or the wall a tower stands on over a lower wing: boxes
  // round its holes, paint inside, the cladding (or paint: a party band) outside, a white section on top. Built in the
  // wall frame (local +z out), its base at local y 0.
  function bandWall({ length, h, holes, inside, outside, name }) {
    const g = group(name, { category: 'Architecture', isWall: true, band: true });
    const T = 0.16, paint = std(inside, { roughness: 0.7 }), cap = std(0xf6f5f2, { roughness: 0.92 });
    const mats = [paint, paint, cap, paint, outside || paint, paint];
    const xs = [...new Set([-length / 2, length / 2, ...holes.flatMap(o => [Math.max(-length / 2, o.x0), Math.min(length / 2, o.x1)])])].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], xm = (x0 + x1) / 2;
      if (x1 - x0 < 0.005) continue;
      const cut = holes.filter(o => xm > o.x0 && xm < o.x1).map(o => [o.y0, o.y1]).sort((a, b) => a[0] - b[0]);
      let yy = 0;
      for (const [c0, c1] of [...cut, [h, h]]) {
        if (c0 - yy > 0.005) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, c0 - yy, T), mats); m.position.set(xm, (yy + c0) / 2, 0); m.castShadow = true; m.receiveShadow = true; g.add(m); }
        yy = Math.max(yy, c1);
      }
    }
    const frame = std(0x2b2f33, { roughness: 0.5 });
    for (const o of holes.filter(o => o.glazed)) {
      const w = o.x1 - o.x0, hh = o.y1 - o.y0, xm = (o.x0 + o.x1) / 2, ym = (o.y0 + o.y1) / 2;
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, hh - 0.1), bctx.glassMat()); gl.position.set(xm, ym, 0.045); gl.userData.windowGlow = true; g.add(gl);
      for (const [bw, bh, bx, by] of [[w, 0.05, xm, o.y0 + 0.025], [w, 0.05, xm, o.y1 - 0.025], [0.05, hh, o.x0 + 0.025, ym], [0.05, hh, o.x1 - 0.025, ym]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.06), frame); b.position.set(bx, by, 0.045); g.add(b); }
    }
    return g;
  }

  // Roofs: assets/roofs.ts (eaves hung below the wall top, fascia, gutters and downspouts, ridge caps, gable ends).

  // ---------------------------------------------------------------------------------------
  // Wall placement helpers
  // ---------------------------------------------------------------------------------------
  // rotation.y and local-offset sign so that the wall's local +Z faces OUTWARD for each side
  const SIDE_ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
  const SIDE_ORI = { S: 'south', N: 'north', E: 'east', W: 'west' };
  const localOffset = (side, at, mid) => (side === 'S' || side === 'W') ? at - mid : -(at - mid);

  // ---------------------------------------------------------------------------------------
  // Graph walls (opt-in: deps.useGraphWalls, off by default — houses look exactly as before
  // without it). FloorplanGraph.fromLevel + WallCompiler replace the pier/lintel box
  // decomposition with one mitred mesh per wall; door/window holes are cut through the solid.
  // Not yet wired: the parametric door/window units (compiled.openings says where they go) and
  // clipping-plane cutaway (walls register with registerTrackedWall, so the page's scale-Y
  // wall modes still apply; a page with renderer.localClippingEnabled can call applyCutaway).
  // ---------------------------------------------------------------------------------------
  const wallCompiler = useGraphWalls ? createWallCompiler({ THREE }) : null;
  function buildGraphWalls(spec, lv, y, H, wallColor, anchors, put) {
    const graph = FloorplanGraph.fromLevel(lv, { entry: spec.entry, partitionHeight: H - 0.1 });
    const compiled = wallCompiler.compileGraph(graph, { baseY: y });
    for (const w of compiled.walls) {
      w.mesh.material.color.setHex(w.exterior ? wallColor : mix(wallColor, 0xffffff, 0.3));
      const o = put(() => w.mesh, 0, 0, y);
      registerTrackedWall(o, w.facing, w.mesh.userData.fullHeight, 0.85);
    }
    const entry = compiled.openings.find(o => o.entry);
    if (entry) anchors.entry = { x: entry.worldRect.x, y, z: entry.worldRect.z, out: [...entry.worldRect.normal], side: entry.side, level: lv.id, width: entry.worldRect.w };
    return { graph, compiled };
  }

  // One storey: slab, walls and openings (anchors.entry), partitions, stairs (anchors.stairs), balustrades.
  // Returns the storey's elevation and wall height, which its rooms and fixtures are built at.
  function buildLevel({ spec, lv, levelById, palette, kit, anchors, put, graphs }) {
    const floorTex = name => textures[name === 'oak' ? 'oak' : name] || kit.floorTexture(name) || textures.oak;
    const defaults = specDefaults(spec);
    let _am = null; const am = () => _am || (_am = createArchMaterials(THREE, kit));   // S2's materials, made only when asked for
    kitOf.set(spec, kit); anchorsOf.set(spec, anchors);
    // S2's export (arch key of <id>.plan.json; plan Exported API): anchors.features (also anchors.arch.features), anchors.arch.rooms
    // (finishes), .volumes, .plinths, .stoop; the flights are on anchors.stairs
    if (!anchors.arch) { anchors.arch = { rooms: [], features: [] }; anchors.features = anchors.arch.features; }
    const y = lv.y || 0, H = lv.height || 2.8;
    const wallColor = hex(lv.wallColor || palette.wall), trimColor = hex(lv.trimColor || palette.trim);
    // interior paint: palette.interior / lv.interior, else the wall colour lifted toward off-white when the
    // exterior is dark (a brick-red or charcoal house is not brick-red inside)
    const lumOf = c => ((c >> 16 & 255) * 0.2126 + (c >> 8 & 255) * 0.7152 + (c & 255) * 0.0722) / 255;
    const interior = hex(lv.interior || palette.interior || (lumOf(wallColor) < 0.6 ? mix(wallColor, 0xf5f5f4, 0.82) : mix(wallColor, 0xffffff, 0.25)));
    const edges = perimeterEdges(lv.footprint);
    const b = unionBounds(lv.footprint);
    anchors.levels[lv.id] = { y, height: H, bounds: b, centre: [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2] };
    for (const r of lv.footprint || []) if (r.h !== undefined) (anchors.arch.volumes ||= []).push({ level: lv.id, rect: { x: r.x, z: r.z, w: r.w, d: r.d }, h: r.h, material: r.material, color: r.color });
    anchors.bounds = anchors.bounds ? {
      minX: Math.min(anchors.bounds.minX, b.minX), maxX: Math.max(anchors.bounds.maxX, b.maxX),
      minZ: Math.min(anchors.bounds.minZ, b.minZ), maxZ: Math.max(anchors.bounds.maxZ, b.maxZ)
    } : { ...b };

    // floor slab(s): one kit floor per level (PBR, world-mapped), boards along the level's long axis
    const floorMat = kit.floor(lv.floor || 'oak', { rotation: (b.maxX - b.minX) > (b.maxZ - b.minZ) ? Math.PI / 2 : null });
    const withFloor = g => { g.traverse(o => { if (o.isMesh) { o.material.dispose(); o.material = floorMat; } }); return g; };
    if (y <= 0.001) {
      for (const r of lv.footprint) { const [cx, cz] = rectCentre(r); put(() => withFloor(AssetFactory.createFloorSlab(r.w, r.d, lv.floor || 'oak', floorTex(lv.floor || 'oak'))), cx, cz, y, null, 'floor'); }
    } else {
      // upper slab from the outline polygon with voids as holes
      const loops = outlineLoops(edges);
      put(() => {
        const g = group(`Upper Floor Slab (${lv.id} @ y=${y})`, { category: 'Architecture' });
        const shape = new THREE.Shape(loops.outer.map(p => new THREE.Vector2(p[0], p[1])));
        for (const h of loops.holes) shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
        const openings = slabOpenings(spec, lv);
        if (!openings) for (const v of lv.voids || []) shape.holes.push(new THREE.Path([[v.x, v.z], [v.x + v.w, v.z], [v.x + v.w, v.z + v.d], [v.x, v.z + v.d]].map(p => new THREE.Vector2(p[0], p[1]))));
        // S2: flights with autoVoid and double-height rooms below open the slab too — the union of every opening, one
        // hole per loop (overlapping holes break the triangulation)
        else for (const loop of openings) shape.holes.push(new THREE.Path(loop.map(p => new THREE.Vector2(p[0], p[1]))));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
        geo.rotateX(Math.PI / 2); // shape XY → plan XZ (y down by depth)
        const mesh = new THREE.Mesh(geo, floorMat); mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.position.y = 0; // extrude goes from y=0 downward after rotateX → top at slab elevation
        g.add(mesh);
        // ceiling underside
        const ceil = new THREE.Mesh(new THREE.ShapeGeometry(shape), kitb.ceilingMaterial({ spec, defaults, lv, where: 'slab-underside' }));
        ceil.rotation.x = Math.PI / 2; ceil.position.y = -0.185; g.add(ceil);
        return g;
      }, 0, 0, y, null, 'floor');
    }

    if (useGraphWalls) {
      graphs[lv.id] = buildGraphWalls(spec, lv, y, H, wallColor, anchors, put);
    } else {
      // perimeter walls with openings. S2 splits a wall where the volume behind it changes (footprint[i].material,
      // .color, .h), lowers it for knee walls, and in a split-level house builds only the bands of a wall another
      // storey does not (arch-plan.ts wallEdges / wallPieces). For a storey that asks for none of it every edge is one
      // piece, full height — the v1 wall, built by the v1 call.
      const wallEdges = archEdges(spec, lv, edges);
      const special = wallEdges !== edges || lv.knee !== undefined;
      const ops = [...(lv.openings || []), ...featureOpenings(spec, lv)].map(op => ({ ...op, edge: edgeFor(wallEdges, op) })).filter(o => o.edge);
      for (const e of wallEdges) {
        const horiz = e.side === 'S' || e.side === 'N';
        const mid = horiz ? (e.a[0] + e.b[0]) / 2 : (e.a[1] + e.b[1]) / 2;
        const cx = horiz ? mid : e.a[0], cz = horiz ? e.a[1] : mid;
        const mine = ops.filter(o => o.edge === e);
        const isEntry = op => spec.entry && spec.entry.level === lv.id && spec.entry.side === op.side && Math.abs(spec.entry.at - op.at) < 1e-6;
        const rect = special ? rectOfEdge(lv, e) : null;
        const Hw = special ? edgeHeight(lv, rect, H) : H;
        const openings = mine.map(op => ({ ...kitb.openingParams(op, Hw, isEntry(op), { spec, defaults, lv }), offset: localOffset(e.side, op.at, mid) }));
        // is the wall's local +x end an outside corner? (beyond that end, on both sides of the wall line, is
        // outside the footprint) — the wall fills and trims that corner (createParametricWall)
        const dx = { S: [1, 0], N: [-1, 0], E: [0, -1], W: [0, 1] }[e.side], nv = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[e.side];
        const pe = e.a[0] * dx[0] + e.a[1] * dx[1] > e.b[0] * dx[0] + e.b[1] * dx[1] ? e.a : e.b;
        const outerCorner = [1, -1].every(k => { const px = pe[0] + dx[0] * 0.05 + k * nv[0] * 0.05, pz = pe[1] + dx[1] * 0.05 + k * nv[1] * 0.05; return !lv.footprint.some(r => px > r.x && px < r.x + r.w && pz > r.z && pz < r.z + r.d); });
        // the volume's own cladding (per-volume cladding), else the kit's
        const volClad = rect && (rect.material !== undefined || rect.color !== undefined) ? am().cladding({ kind: rect.material || palette.material || 'stucco', color: rect.color || lv.wallColor || palette.wall }) : null;
        const extColor = rect && rect.color !== undefined ? hex(rect.color) : wallColor;
        let w = null;
        for (const pc of special ? wallPieces(spec, lv, e, Hw) : FULL) {
          if (!special || (pc.lo === 0 && !pc.party)) {
            const hh = special ? pc.hi : H;
            w = put(() => ProceduralArchitecture.createParametricWall({
              length: e.length, height: hh, wallColor: interior, trimColor, baseboardColor: mix(interior, 0xffffff, 0.5),
              orientation: SIDE_ORI[e.side], openings: special ? clipOpenings(openings, hh) : openings, cladding: volClad || kitb.wallCladding(kit, { spec, defaults, lv, edge: e }), exteriorColor: extColor, outerCorner
            }), cx, cz, y);
            w.rotation.y = SIDE_ROT[e.side];
            registerTrackedWall(w, SIDE_ORI[e.side], hh, 0.85);
          } else {
            // a band of a shared (split-level) wall, or a party band: its own box work round the openings that reach it
            const band = put(() => bandWall({ length: e.length, h: pc.hi - pc.lo, holes: bandHoles(openings, pc.lo, pc.hi), inside: interior,
              outside: pc.party ? null : (volClad || kitb.wallCladding(kit, { spec, defaults, lv, edge: e })), name: `Wall band (${e.side} ${lv.id} +${+pc.lo.toFixed(2)}–${+pc.hi.toFixed(2)}m${pc.party ? ', party' : ''})` }), cx, cz, y + pc.lo, null, null);
            band.rotation.y = SIDE_ROT[e.side];
            registerTrackedWall(band, pc.party ? 'partition' : SIDE_ORI[e.side], pc.hi - pc.lo, Math.min(0.85, pc.hi - pc.lo));
            if (!w) w = band;
          }
        }
        // `wall` is the placed wall (turned, tracked): the hook reads the leaf groups off it, so it needs no second copy of the hinge geometry
        mine.forEach((op, i) => kitb.noteOpening({ spec, defaults, lv, anchors, op, param: openings[i], side: e.side, y, isEntry: isEntry(op),
          wall: w, edge: e, centre: [cx, cz], rotY: SIDE_ROT[e.side] }));
        for (const op of mine) if (isEntry(op)) {
          const out = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[op.side];
          // an entry slider opens on its local −x half (see createParametricWall): the door axis the shot
          // flies through moves a quarter width that way (world: S −x, N +x, E +z, W −z)
          const slider = op.type === 'slider' || op.style === 'glass-slider';
          const shift = slider ? (op.w || 1.2) / 4 : 0;
          anchors.entry = { x: (horiz ? op.at : e.a[0]) + (horiz ? (op.side === 'S' ? -shift : shift) : 0), y, z: (horiz ? e.a[1] : op.at) + (horiz ? 0 : (op.side === 'E' ? shift : -shift)), out, side: op.side, level: lv.id, width: op.w };
        }
      }
      // per-rect heights: where a taller volume stands over a lower one, the wall between them above the lower
      for (const st of volumeSteps(lv, H)) {
        const horiz = st.side === 'S' || st.side === 'N', m = (horiz ? st.a[0] + st.b[0] : st.a[1] + st.b[1]) / 2;
        const clad = st.rect.material !== undefined || st.rect.color !== undefined ? am().cladding({ kind: st.rect.material || palette.material || 'stucco', color: st.rect.color || lv.wallColor || palette.wall }) : kitb.wallCladding(kit, { spec, defaults, lv, edge: st });
        const band = put(() => bandWall({ length: st.length + 0.16, h: st.hi - st.lo, holes: [], inside: interior, outside: clad, name: `Volume step (${st.side} ${lv.id} +${+st.lo.toFixed(2)}–${+st.hi.toFixed(2)}m)` }),
          horiz ? m : st.a[0], horiz ? st.a[1] : m, y + st.lo, null, null);
        band.rotation.y = SIDE_ROT[st.side];
        registerTrackedWall(band, SIDE_ORI[st.side], st.hi - st.lo, Math.min(0.85, st.hi - st.lo));
      }

      // partitions (a partition with a `style` other than solid is built by features.ts)
      const topStorey = !(spec.levels || []).some(o => (o.y || 0) > y + 0.5);
      (lv.partitions || []).forEach((p, pi) => {
        if (p.style && p.style !== 'solid') { features.partition({ spec, lv, p, index: pi, y, H, interior, trimColor, put, am: am(), kitb, defaults }); return; }
        const alongX = Math.abs(p.from[1] - p.to[1]) < 1e-6;
        const len = Math.abs(alongX ? p.to[0] - p.from[0] : p.to[1] - p.from[1]);
        const cx = (p.from[0] + p.to[0]) / 2, cz = (p.from[1] + p.to[1]) / 2;
        // door = distance from `from` (HOUSE-SPEC). The wall's local +x runs along its length; an along-Z wall is
        // turned +90°, which maps local +x onto world −z, so the offset flips sign there (and for a `from` that
        // sits past `to`). Without this every N–S partition had its doorway mirrored about the wall's middle.
        const dir = alongX ? Math.sign(p.to[0] - p.from[0]) || 1 : -(Math.sign(p.to[1] - p.from[1]) || 1);
        const door = p.door === null || p.door === undefined ? null : dir * (p.door - len / 2);
        // under `defaults: 2` a top storey's partition meets its ceiling (the 8 cm slot under it read as a black line)
        const ph = p.height || (defaults >= 2 && topStorey ? H - 0.025 : H - 0.1);
        let wall;
        if (Array.isArray(p.doors) && p.doors.length) {
          // more than one doorway: the partition's wall unit with every door in it (S1's partition params spread)
          const pp = kitb.partitionParams(p, { spec, defaults, lv, interior, trimColor });
          const doors = [...(door !== null ? [{ offset: door, width: pp.doorWidth }] : []), ...p.doors.map(d => ({ offset: dir * (d.at - len / 2), width: d.w || pp.doorWidth, height: d.h }))];
          wall = put(() => ProceduralArchitecture.createParametricWall({
            length: len, height: ph, thickness: 0.14, wallColor: pp.wallColor, trimColor: pp.trimColor, baseboardColor: pp.baseboardColor ?? 0xe2e8f0, orientation: 'partition',
            openings: doors.map(d => ({ type: 'door', offset: d.offset, width: d.width, height: d.height || pp.doorHeight || 2.1, style: 'cased', open: true, ...(pp.leafColor !== undefined ? { leafColor: pp.leafColor } : {}) }))
          }), cx, cz, y);
        } else wall = put(() => ProceduralArchitecture.createInteriorPartitionWall({
          length: len, height: ph, ...kitb.partitionParams(p, { spec, defaults, lv, interior, trimColor }), doorOffset: door
        }), cx, cz, y);
        if (!alongX) wall.rotation.y = Math.PI / 2;
        registerTrackedWall(wall, 'partition', ph, 0.85);
        kitb.notePartition({ spec, defaults, lv, anchors, p, wall, y, centre: [cx, cz], len, alongX, doorOffset: door });
      });
    }

    // stairs (stairs.ts): one flight or several (levels[].stairs may be an array: Completeness A2); straight,
    // spiral, L and U. A single straight or spiral flight is built with the v1 call and anchored with the v1
    // numbers exactly — the shot planner reads them.
    levelStairs(lv).forEach((st, index) => {
      const p = stairPlan(st, lv, levelById, index);
      if (!p) return;
      const s = put(() => stairBuilder.build(p, st, { tread: st.treadWood ? am().floor({ kind: st.treadWood }) : null }), st.at[0], st.at[1], y, null, 'structure');
      s.rotation.y = (st.rot || 0) * DEG;
      s.userData.stair = true;   // the shot gate's stair-clip test and door-to-core's clip repair look for it
      const total = p.rise;
      // top-of-stairs position: run along the ascent direction (rot 0 → +Z); a turning flight: its last step, and the
      // heading off it
      const turning = p.shape === 'L' || p.shape === 'U';
      const run = st.type === 'spiral' ? 0 : (st.run || 3.36);
      const dir = turning ? p.dir : [Math.sin((st.rot || 0) * DEG), Math.cos((st.rot || 0) * DEG)];
      const topXZ = turning ? p.top : [st.at[0] + dir[0] * run, st.at[1] + dir[1] * run];
      // plan: the flight's footprint on its own storey — somewhere a walk there must go round, not under
      s.updateMatrixWorld(true);
      const sb = new THREE.Box3().setFromObject(s);
      anchors.stairs.push({ from: lv.id, to: st.to, bottom: [st.at[0], y, st.at[1]], top: [topXZ[0], y + total, topXZ[1]], dir,
        plan: { minX: sb.min.x, maxX: sb.max.x, minZ: sb.min.z, maxZ: sb.max.z },
        // S2's own (Completeness A2, for S5's routing and S6's plan inset): what the flight is, its first heading, the
        // walking line first step to last (world, y absolute), landings, outline, the void it needs, its step-off
        ...(p.shape !== 'straight' || index > 0 || Array.isArray(lv.stairs) ? { type: p.type, shape: p.shape, index, dir0: p.dir0, w: p.w,
          flights: p.flights.map(fl => ({ at: fl.at, rot: ((fl.rot % 360) + 360) % 360, run: rnd(fl.run), rise: rnd(fl.rise), steps: fl.steps, w: fl.w, y0: rnd(y + fl.y0), style: fl.style })),
          path: p.path.map(([px, py, pz]) => [px, rnd(y + py), pz]), landings: p.landings.map(l => ({ ...l, y: rnd(y + l.y) })),
          outline: p.outline, voidRects: p.voidRects, stepOff: p.stepOff } : {}) });
    });

    // balustrades
    for (const bl of lv.balustrades || []) {
      const alongX = Math.abs(bl.from[1] - bl.to[1]) < 1e-6;
      const len = Math.abs(alongX ? bl.to[0] - bl.from[0] : bl.to[1] - bl.from[1]);
      const cx = (bl.from[0] + bl.to[0]) / 2, cz = (bl.from[1] + bl.to[1]) / 2;
      const g = put(() => bl.style === 'colonial' ? ProceduralArchitecture.createColonialBalustrade(len, 0.95, y) : ProceduralArchitecture.createGlassBalustrade(len, 1.0, y), cx, cz, y, null, 'structure');
      if (!alongX) g.rotation.y = Math.PI / 2;
    }

    // ---- S2: room finishes (room-finish.ts) — only for rooms that ask, or every room under defaults: 2
    const gen2 = defaults >= 2;
    if (gen2 || (lv.rooms || []).some(r => r.floor || r.floorOffset)) finish.floors({ spec, lv, y, put, am: am(), anchors, gen2 });
    if ((lv.rooms || []).some(r => r.walls)) {
      const ups = (spec.levels || []).filter(o => (o.y || 0) > y + 0.5);
      const ceilingAt = (a, side, line) => { const horiz = side === 'N' || side === 'S', px = horiz ? a : line, pz = horiz ? line : a; const up = ups.filter(o => (o.footprint || []).some(r => inRect(px, pz, r, 0.05))).sort((p, q) => (p.y || 0) - (q.y || 0))[0]; return up ? (up.y || 0) - 0.185 : y + H - 0.02; };
      finish.walls({ spec, lv, y, H, put, am: am(), anchors, ceilingAt });
    }
    const dbl = doubleRoomsUnder(spec, lv);
    if (dbl.length) finish.galleryRails({ spec, lv, y, put, ProceduralArchitecture, doubleRooms: dbl });
    // the openings this storey's slab has beyond its own `voids` (a flight's autoVoid, a double-height room below): the plan twins draw them
    // (as built: clipped to the slab's outline, arch-plan.ts insideOutline; a sunken room's pit is a hole too)
    const autoV = insideOutline(lv, autoVoidsFor(spec, lv.id)).map(r => ({ x: rnd(r.x), z: rnd(r.z), w: rnd(r.w), d: rnd(r.d) }));
    const pitV = sunkRooms(spec, lv).flatMap(r => pitRects(lv, r).map(q => ({ x: rnd(q.x), z: rnd(q.z), w: rnd(q.w), d: rnd(q.d), room: r.name })));
    if (autoV.length || dbl.length || pitV.length) (anchors.arch.voids ||= []).push({ level: lv.id, auto: autoV, double: dbl.map(d => ({ x: rnd(d.rect.x), z: rnd(d.rect.z), w: rnd(d.rect.w), d: rnd(d.rect.d), room: d.room.name })), ...(pitV.length ? { pits: pitV } : {}) });
    // ---- S2: the storey's facade (facade.ts) and its features (features.ts: bays, balconies, fireplaces, built-ins)
    const lowestY = Math.min(...(spec.levels || []).map(l => l.y || 0));
    if (facadeWanted(spec, lv, lowestY)) facade.levelFacade({ spec, lv, y, H, palette, am: am(), put, anchors, lowestY });
    if ((spec.features || []).some(f => f && f.type !== 'porch')) features.levelFeatures({ spec, lv, y, H, palette, kit, am: am(), put, anchors, kitb, interior, wallColor, trimColor, defaults });
    return { y, H };
  }

  function buildCeilings({ spec, put }) {
    const defaults = specDefaults(spec);
    let models = null; const roofModels = () => models || (models = planRoofModels(spec));
    // ---- ceilings: wherever a storey has no storey above it. With the roofs on they are hidden under the
    // roof; once a shot fades the roofs out (eye under a ceiling) the storey would otherwise open to the sky.
    // Built from 0.25 m cells of the storey's footprint not covered by any higher storey — robust for every
    // footprint shape, and a thin DoubleSide sheet so it reads from below.
    // S2: a vaulted or trayed room builds its own (its cells are left out), a volume with its own height `h` has its
    // sheet at that height, and a knee-walled storey's ceiling follows the roof's underside down to the knee walls.
    for (const lv of spec.levels || []) {
      const y = lv.y || 0, H = lv.height || 2.8, above = (spec.levels || []).filter(o => (o.y || 0) > y + 0.5);
      if (!Array.isArray(lv.footprint) || !lv.footprint.length) continue;
      const own = (lv.rooms || []).filter(r => r.bounds && r.ceiling && (r.ceiling.kind === 'vault' || r.ceiling.kind === 'tray'));
      const s2 = lv.knee !== undefined || lv.footprint.some(r => r.h !== undefined) || own.length > 0;
      const b = unionBounds(lv.footprint), C = 0.25, quads = [];
      for (let x = b.minX; x < b.maxX - 1e-6; x += C) for (let z = b.minZ; z < b.maxZ - 1e-6; z += C) {
        const mx = x + C / 2, mz = z + C / 2;
        if (!lv.footprint.some(r => inRect(mx, mz, r, 0))) continue;
        if (above.some(o => (o.footprint || []).some(r => inRect(mx, mz, r, 0.05)))) continue;
        if (s2 && own.some(r => inRect(mx, mz, r.bounds, -0.01))) continue;
        quads.push([x, z, Math.min(x + C, b.maxX), Math.min(z + C, b.maxZ)]);
      }
      if (!quads.length) continue;
      if (!s2) {
        const pos = new Float32Array(quads.length * 18); let k = 0;
        for (const [x0, z0, x1, z1] of quads) for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]]) { pos[k++] = px; pos[k++] = 0; pos[k++] = pz; }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals();
        const ceil = put(() => { const g = group(`Ceiling (${lv.id})`, { category: 'Architecture' }); const m = new THREE.Mesh(geo, kitb.ceilingMaterial({ spec, defaults, lv, where: 'ceiling' })); m.receiveShadow = true; g.add(m); return g; }, 0, 0, y + H - 0.02);
        if (typeof registerCeiling === 'function') registerCeiling(ceil, y + H - 0.02);
        continue;
      }
      // S2: heights per vertex (absolute): a volume's own h, or under a knee-walled storey the roof's underside
      const hAt = (px: number, pz: number) => {
        const r = [...lv.footprint].reverse().find(q => q.h !== undefined && inRect(px, pz, q, 0.001));
        const flat = y + (r ? r.h : H) - 0.02;
        if (lv.knee === undefined) return flat;
        const u = roofUnderAt(roofModels(), px, pz);
        return u === null ? flat : Math.max(y + lv.knee - 0.02, Math.min(flat, u - 0.03));
      };
      const pos = new Float32Array(quads.length * 18); let k = 0, hi = -Infinity;
      for (const [x0, z0, x1, z1] of quads) {
        // a cell takes its centre's volume (no seam through a cell where two heights meet)
        const hc = lv.knee === undefined ? hAt((x0 + x1) / 2, (z0 + z1) / 2) : null;
        for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]]) { const h = hc ?? hAt(px, pz); hi = Math.max(hi, h); pos[k++] = px; pos[k++] = h; pos[k++] = pz; }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals();
      const ceil = put(() => { const g = group(`Ceiling (${lv.id})`, { category: 'Architecture' }); const m = new THREE.Mesh(geo, kitb.ceilingMaterial({ spec, defaults, lv, where: 'ceiling' })); m.receiveShadow = true; g.add(m); return g; }, 0, 0, 0);
      if (typeof registerCeiling === 'function') registerCeiling(ceil, hi);
    }
    // ---- S2: each room's own ceiling (room-finish.ts): timber, beams, a vault or a tray, a painted colour
    const kit = kitOf.get(spec);
    for (const lv of spec.levels || []) {
      const y = lv.y || 0, H = lv.height || 2.8;
      for (const room of lv.rooms || []) {
        const c = room.ceiling;
        if (c && room.bounds && anchorsOf.get(spec)) noteRoom(anchorsOf.get(spec), lv, room, { ceiling: c.kind, ceilingColor: c.color });
        if (!c || !room.bounds || c.kind === 'double' || (c.kind === 'flat' && c.color === undefined) || !kit) continue;
        const cx = room.bounds.x + room.bounds.w / 2, cz = room.bounds.z + room.bounds.d / 2;
        const up = (spec.levels || []).filter(o => (o.y || 0) > y + 0.5 && (o.footprint || []).some(r => inRect(cx, cz, r, 0.05))).sort((p, q) => (p.y || 0) - (q.y || 0))[0];
        const r = [...lv.footprint].reverse().find(q => q.h !== undefined && inRect(cx, cz, q, 0.001));
        const at = up ? (up.y || 0) - 0.185 : y + (r ? r.h : H) - 0.02;
        const cg = finish.ceiling({ spec, lv, room, y, H, at, top: !up, put, am: createArchMaterials(THREE, kit), roofUnder: (x, z) => roofUnderAt(roofModels(), x, z) });
        // S1's fixtures hang from the flat ceiling (fixtures.ts knows nothing of vaults and trays yet): lift the room's
        // fans and pendants, and the cans over it, onto the ceiling this room really has
        if (cg && !up && (c.kind === 'vault' || c.kind === 'tray') && cg.userData.rise > 0) liftFixtures({ spec, lv, room, flat: at, rise: cg.userData.rise });
      }
    }
  }

  function liftFixtures({ spec, lv, room, flat, rise }) {
    const anchors = anchorsOf.get(spec), placed = anchors && anchors.placed;
    if (!placed) return;
    const at = (x, z) => ownCeilingAt(room, flat, rise, x, z);
    for (const o of placed) {
      const u = o.userData || {};
      if (u.role !== 'fixture') continue;
      if (u.room === room.name) {   // a fan or a pendant cluster, placed at its room's centre: it hangs from the ceiling over it
        const h = at(o.position.x, o.position.z);
        if (h !== null) o.position.y += h - flat;
      } else if (u.level === lv.id) {   // the storey's cans, one instanced set per ceiling height
        o.traverse(m => {
          if (!m.isInstancedMesh) return;
          const M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
          for (let i = 0; i < m.count; i++) {
            m.getMatrixAt(i, M); M.decompose(p, q, sc);
            const h = at(p.x + o.position.x, p.z + o.position.z);
            if (h === null) continue;
            // on a vault's slope the can tilts with it
            const e = 0.05, dx = (at(p.x + o.position.x + e, p.z + o.position.z) ?? h) - (at(p.x + o.position.x - e, p.z + o.position.z) ?? h), dz = (at(p.x + o.position.x, p.z + o.position.z + e) ?? h) - (at(p.x + o.position.x, p.z + o.position.z - e) ?? h);
            const n = new THREE.Vector3(-dx / (2 * e), 1, -dz / (2 * e)).normalize();
            q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
            p.y += h - flat; M.compose(p, q, sc); m.setMatrixAt(i, M);
          }
          m.instanceMatrix.needsUpdate = true; m.computeBoundingBox(); m.computeBoundingSphere();
        });
      }
    }
  }

  function placeRoofs({ spec, kit, palette, put }) {
    // ---- roofs (assets/roofs.ts): planned together, since a downspout may land on a lower roof
    for (const r of buildRoofs(spec, { THREE, kit, palette })) {
      const o = put(() => r.group, r.x, r.z, r.y);
      registerRoof(o);
    }
    // ---- S2: porches (their roofs), bay roofs and chimney stacks (features.ts)
    if ((spec.features || []).length || (spec.levels || []).some(l => (l.rooms || []).some(r => (r.items || []).some(it => it.type === 'fireplace' && it.chimney)))) {
      const anchors = anchorsOf.get(spec);
      if (anchors) features.houseFeatures({ spec, kit, palette, put, anchors });
    }
  }

  return { buildLevel, buildCeilings, placeRoofs };
}
