// The structure — per storey: the floor slab (an upper storey's from its outline, voids cut out), the perimeter
// walls with their openings (or the opt-in graph walls), partitions, stairs and balustrades; then, once for the
// house, the ceilings under open sky and the roofs.
// Writes anchors.levels, anchors.bounds, anchors.entry and anchors.stairs.
//
// Seam module (plan S0): moved verbatim out of house-builder.ts. Owner: S2 (architecture).
import { perimeterEdges, edgeForOpening, outlineLoops, unionBounds, rectCentre, inRect } from './house-geometry.js';
import { FloorplanGraph } from './floorplan-graph.js';
import { createWallCompiler } from './wall-compiler.js';
import { buildRoofs } from './roofs.js';
import { DEG, hex, mix } from './build-context.js';
import { specDefaults } from './spec/index.js';

// kitb (kit-build.ts, S1) turns the spec's doors, colours and finishes into the parameters below; this module
// keeps the geometry round each call.
export function createStructureBuild(bctx, { kitb }) {
  const { THREE, AssetFactory, ProceduralArchitecture, registerTrackedWall, registerRoof, registerCeiling, textures, useGraphWalls, std, group } = bctx;

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
    const y = lv.y || 0, H = lv.height || 2.8;
    const wallColor = hex(lv.wallColor || palette.wall), trimColor = hex(lv.trimColor || palette.trim);
    // interior paint: palette.interior / lv.interior, else the wall colour lifted toward off-white when the
    // exterior is dark (a brick-red or charcoal house is not brick-red inside)
    const lumOf = c => ((c >> 16 & 255) * 0.2126 + (c >> 8 & 255) * 0.7152 + (c & 255) * 0.0722) / 255;
    const interior = hex(lv.interior || palette.interior || (lumOf(wallColor) < 0.6 ? mix(wallColor, 0xf5f5f4, 0.82) : mix(wallColor, 0xffffff, 0.25)));
    const edges = perimeterEdges(lv.footprint);
    const b = unionBounds(lv.footprint);
    anchors.levels[lv.id] = { y, height: H, bounds: b, centre: [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2] };
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
        for (const v of lv.voids || []) shape.holes.push(new THREE.Path([[v.x, v.z], [v.x + v.w, v.z], [v.x + v.w, v.z + v.d], [v.x, v.z + v.d]].map(p => new THREE.Vector2(p[0], p[1]))));
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
      // perimeter walls with openings
      const ops = (lv.openings || []).map(op => ({ ...op, edge: edgeForOpening(edges, op.side, op.at) })).filter(o => o.edge);
      for (const e of edges) {
        const horiz = e.side === 'S' || e.side === 'N';
        const mid = horiz ? (e.a[0] + e.b[0]) / 2 : (e.a[1] + e.b[1]) / 2;
        const cx = horiz ? mid : e.a[0], cz = horiz ? e.a[1] : mid;
        const mine = ops.filter(o => o.edge === e);
        const isEntry = op => spec.entry && spec.entry.level === lv.id && spec.entry.side === op.side && Math.abs(spec.entry.at - op.at) < 1e-6;
        const openings = mine.map(op => ({ ...kitb.openingParams(op, H, isEntry(op), { spec, defaults, lv }), offset: localOffset(e.side, op.at, mid) }));
        // is the wall's local +x end an outside corner? (beyond that end, on both sides of the wall line, is
        // outside the footprint) — the wall fills and trims that corner (createParametricWall)
        const dx = { S: [1, 0], N: [-1, 0], E: [0, -1], W: [0, 1] }[e.side], nv = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[e.side];
        const pe = e.a[0] * dx[0] + e.a[1] * dx[1] > e.b[0] * dx[0] + e.b[1] * dx[1] ? e.a : e.b;
        const outerCorner = [1, -1].every(k => { const px = pe[0] + dx[0] * 0.05 + k * nv[0] * 0.05, pz = pe[1] + dx[1] * 0.05 + k * nv[1] * 0.05; return !lv.footprint.some(r => px > r.x && px < r.x + r.w && pz > r.z && pz < r.z + r.d); });
        const w = put(() => ProceduralArchitecture.createParametricWall({
          length: e.length, height: H, wallColor: interior, trimColor, baseboardColor: mix(interior, 0xffffff, 0.5),
          orientation: SIDE_ORI[e.side], openings, cladding: kitb.wallCladding(kit, { spec, defaults, lv, edge: e }), exteriorColor: wallColor, outerCorner
        }), cx, cz, y);
        w.rotation.y = SIDE_ROT[e.side];
        registerTrackedWall(w, SIDE_ORI[e.side], H, 0.85);
        mine.forEach((op, i) => kitb.noteOpening({ spec, defaults, lv, anchors, op, param: openings[i], side: e.side, y, isEntry: isEntry(op) }));
        for (const op of mine) if (isEntry(op)) {
          const out = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[op.side];
          // an entry slider opens on its local −x half (see createParametricWall): the door axis the shot
          // flies through moves a quarter width that way (world: S −x, N +x, E +z, W −z)
          const slider = op.type === 'slider' || op.style === 'glass-slider';
          const shift = slider ? (op.w || 1.2) / 4 : 0;
          anchors.entry = { x: (horiz ? op.at : e.a[0]) + (horiz ? (op.side === 'S' ? -shift : shift) : 0), y, z: (horiz ? e.a[1] : op.at) + (horiz ? 0 : (op.side === 'E' ? shift : -shift)), out, side: op.side, level: lv.id, width: op.w };
        }
      }

      // partitions
      for (const p of lv.partitions || []) {
        const alongX = Math.abs(p.from[1] - p.to[1]) < 1e-6;
        const len = Math.abs(alongX ? p.to[0] - p.from[0] : p.to[1] - p.from[1]);
        const cx = (p.from[0] + p.to[0]) / 2, cz = (p.from[1] + p.to[1]) / 2;
        // door = distance from `from` (HOUSE-SPEC). The wall's local +x runs along its length; an along-Z wall is
        // turned +90°, which maps local +x onto world −z, so the offset flips sign there (and for a `from` that
        // sits past `to`). Without this every N–S partition had its doorway mirrored about the wall's middle.
        const dir = alongX ? Math.sign(p.to[0] - p.from[0]) || 1 : -(Math.sign(p.to[1] - p.from[1]) || 1);
        const door = p.door === null || p.door === undefined ? null : dir * (p.door - len / 2);
        const wall = put(() => ProceduralArchitecture.createInteriorPartitionWall({
          length: len, height: p.height || H - 0.1, ...kitb.partitionParams(p, { spec, defaults, lv, interior, trimColor }), doorOffset: door
        }), cx, cz, y);
        if (!alongX) wall.rotation.y = Math.PI / 2;
        registerTrackedWall(wall, 'partition', p.height || H - 0.1, 0.85);
      }
    }

    // stairs
    if (lv.stairs) {
      const to = levelById[lv.stairs.to];
      const total = to ? (to.y - y) : 2.8;
      const st = lv.stairs;
      const fn = st.type === 'colonial' ? () => ProceduralArchitecture.createColonialStairs({ totalHeight: total, steps: Math.round(total / 0.2), width: st.w || 1.2, run: st.run || 3.36 })
        : st.type === 'spiral' ? () => ProceduralArchitecture.createSpiralStairs({ totalHeight: total, steps: Math.round(total / 0.18) })
        : () => ProceduralArchitecture.createFloatingTimberStairs({ totalHeight: total, steps: Math.round(total / 0.2), width: st.w || 1.1, run: st.run || 3.36 });
      const s = put(fn, st.at[0], st.at[1], y, null, 'structure');
      s.rotation.y = (st.rot || 0) * DEG;
      s.userData.stair = true;   // the shot gate's stair-clip test and door-to-core's clip repair look for it
      // top-of-stairs position: run along the ascent direction (rot 0 → +Z)
      const run = st.type === 'spiral' ? 0 : (st.run || 3.36);
      const dir = [Math.sin((st.rot || 0) * DEG), Math.cos((st.rot || 0) * DEG)];
      // plan: the flight's footprint on its own storey — somewhere a walk there must go round, not under
      s.updateMatrixWorld(true);
      const sb = new THREE.Box3().setFromObject(s);
      anchors.stairs.push({ from: lv.id, to: st.to, bottom: [st.at[0], y, st.at[1]], top: [st.at[0] + dir[0] * run, y + total, st.at[1] + dir[1] * run], dir,
        plan: { minX: sb.min.x, maxX: sb.max.x, minZ: sb.min.z, maxZ: sb.max.z } });
    }

    // balustrades
    for (const bl of lv.balustrades || []) {
      const alongX = Math.abs(bl.from[1] - bl.to[1]) < 1e-6;
      const len = Math.abs(alongX ? bl.to[0] - bl.from[0] : bl.to[1] - bl.from[1]);
      const cx = (bl.from[0] + bl.to[0]) / 2, cz = (bl.from[1] + bl.to[1]) / 2;
      const g = put(() => bl.style === 'colonial' ? ProceduralArchitecture.createColonialBalustrade(len, 0.95, y) : ProceduralArchitecture.createGlassBalustrade(len, 1.0, y), cx, cz, y, null, 'structure');
      if (!alongX) g.rotation.y = Math.PI / 2;
    }
    return { y, H };
  }

  function buildCeilings({ spec, put }) {
    const defaults = specDefaults(spec);
    // ---- ceilings: wherever a storey has no storey above it. With the roofs on they are hidden under the
    // roof; once a shot fades the roofs out (eye under a ceiling) the storey would otherwise open to the sky.
    // Built from 0.25 m cells of the storey's footprint not covered by any higher storey — robust for every
    // footprint shape, and a thin DoubleSide sheet so it reads from below.
    for (const lv of spec.levels || []) {
      const y = lv.y || 0, H = lv.height || 2.8, above = (spec.levels || []).filter(o => (o.y || 0) > y + 0.5);
      if (!Array.isArray(lv.footprint) || !lv.footprint.length) continue;
      const b = unionBounds(lv.footprint), C = 0.25, quads = [];
      for (let x = b.minX; x < b.maxX - 1e-6; x += C) for (let z = b.minZ; z < b.maxZ - 1e-6; z += C) {
        const mx = x + C / 2, mz = z + C / 2;
        if (!lv.footprint.some(r => inRect(mx, mz, r, 0))) continue;
        if (above.some(o => (o.footprint || []).some(r => inRect(mx, mz, r, 0.05)))) continue;
        quads.push([x, z, Math.min(x + C, b.maxX), Math.min(z + C, b.maxZ)]);
      }
      if (!quads.length) continue;
      const pos = new Float32Array(quads.length * 18); let k = 0;
      for (const [x0, z0, x1, z1] of quads) for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]]) { pos[k++] = px; pos[k++] = 0; pos[k++] = pz; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals();
      const ceil = put(() => { const g = group(`Ceiling (${lv.id})`, { category: 'Architecture' }); const m = new THREE.Mesh(geo, kitb.ceilingMaterial({ spec, defaults, lv, where: 'ceiling' })); m.receiveShadow = true; g.add(m); return g; }, 0, 0, y + H - 0.02);
      if (typeof registerCeiling === 'function') registerCeiling(ceil, y + H - 0.02);
    }
  }

  function placeRoofs({ spec, kit, palette, put }) {
    // ---- roofs (assets/roofs.ts): planned together, since a downspout may land on a lower roof
    for (const r of buildRoofs(spec, { THREE, kit, palette })) {
      const o = put(() => r.group, r.x, r.z, r.y);
      registerRoof(o);
    }
  }

  return { buildLevel, buildCeilings, placeRoofs };
}
