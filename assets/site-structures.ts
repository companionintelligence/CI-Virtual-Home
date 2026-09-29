// Site structures — the hard landscape S4 adds to the lot (HOUSE-SPEC → Site (S4)), built by site-build.ts's loop:
//
//   rails      level or sloped runs in five styles (glass, metal, timber, cable, colonial) and a colour — decks per
//              side, terrace edges, exterior stairs
//   fences     picket, privacy, slat-h, post-rail, metal, glass, stone-wall; along from → to at any angle or a `path`
//   walls      wall-low in a surface (stone, brick, stucco, concrete, render) and colour, straight or along a path
//   terraces   A3: a raised plateau over a polygon, its edge a retaining wall, a planted or a grass bank, or a railed
//              wall; the ground follows it (site-build.ts lifts what stands on it)
//   stairs     steps that honour `h` / `d`, and the exterior `stair` (from [x, z, y0] to [x, z, y1], a landing when long)
//   water      pools in a shape (rect, lap, kidney, free, poly, basin) with coping, a formal basin's island and jets,
//              a rill — each a basin you can see into, the lawn and any slab over it cut round it
//   decks      raised to `y` on posts to the ground, or none, rails per side in a style and a colour, holes for water
//
// Pure builders over THREE and the kit's materials (handed in by site-build.ts); a house that uses none of this
// builds nothing here.
import { type P2, ccw, offsetLoop, polyArea, centroid, inPoly, bbox, rectPoly, dist, lengthOf, resample, segmentsOf } from './site-geom.js';

export function createSiteStructures({ THREE, std, box, group, ProceduralArchitecture, mat }) {
  // mat(name, color?) → a site material (site-build.ts: the kit's surfaces, textured and world-mapped)
  const hex = c => (typeof c === 'number' ? c : parseInt(String(c || '#ffffff').replace('#', ''), 16));
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ---- one triangle soup per material, faces wound toward a given direction --------------------------------------
  function soup() {
    const pos = [];
    const tri = (a, b, c, want) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * want[0] + ny * want[1] + nz * want[2] >= 0) pos.push(...a, ...b, ...c); else pos.push(...a, ...c, ...b);
    };
    const quad = (a, b, c, d, want) => { tri(a, b, c, want); tri(a, c, d, want); };
    const mesh = (m, name) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      const o = new THREE.Mesh(g, m); o.name = name; o.castShadow = true; o.receiveShadow = true; return o;
    };
    return { tri, quad, mesh, empty: () => !pos.length };
  }
  // a member (box) from a to b (3D points), w × t across it
  function beam(a, b, w, t, m) {
    const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length() || 1e-6;
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, L, t), m);
    o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); o.castShadow = true; o.receiveShadow = true;
    return o;
  }
  const glassMat = () => new THREE.MeshPhysicalMaterial({ color: 0xbfd8d6, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });

  // ---- rails --------------------------------------------------------------------------------------------------
  // a run from a to b (each [x, y, z] — its FOOT, the deck or tread it stands on), h tall
  const RAIL_STYLES = ['glass', 'metal', 'timber', 'cable', 'colonial'];
  function rail(g, a, b, { h = 1.0, style = 'metal', color = null } = {}) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]); if (L < 0.05) return;
    const st = RAIL_STYLES.includes(style) ? style : 'metal';
    const c = color != null ? hex(color) : st === 'timber' ? 0x6b5440 : st === 'colonial' ? 0xf1efe9 : 0x2b2d30;
    const frame = std(c, { roughness: st === 'metal' || st === 'glass' ? 0.45 : 0.75, metalness: st === 'metal' || st === 'glass' ? 0.5 : 0 });
    const level = Math.abs(b[1] - a[1]) < 0.01;
    if (st === 'colonial' && level && ProceduralArchitecture && ProceduralArchitecture.createColonialBalustrade) {
      const r = ProceduralArchitecture.createColonialBalustrade(L, h, 0);
      r.position.set((a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2); r.rotation.y = -Math.atan2(b[2] - a[2], b[0] - a[0]);
      if (color != null) r.traverse(o => { if (o.isMesh) o.material = frame; });
      g.add(r); return;
    }
    const at = (t, y = 0) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + y, a[2] + (b[2] - a[2]) * t];
    const nPost = Math.max(1, Math.ceil(L / (st === 'glass' ? 1.8 : st === 'cable' ? 1.2 : 1.6)));
    const pw = st === 'timber' || st === 'colonial' ? 0.08 : 0.05;
    for (let i = 0; i <= nPost; i++) g.add(beam(at(i / nPost), at(i / nPost, h), pw, pw, frame));
    g.add(beam(at(0, h), at(1, h), st === 'timber' || st === 'colonial' ? 0.07 : 0.05, st === 'timber' || st === 'colonial' ? 0.09 : 0.05, frame));   // cap / handrail
    if (st === 'glass') {
      const s = soup(), n = [-(b[2] - a[2]), 0, b[0] - a[0]];
      for (let i = 0; i < nPost; i++) { const p0 = at(i / nPost + 0.004, 0.06), p1 = at((i + 1) / nPost - 0.004, 0.06), q1 = at((i + 1) / nPost - 0.004, h - 0.04), q0 = at(i / nPost + 0.004, h - 0.04); s.quad(p0, p1, q1, q0, n); }
      const m = s.mesh(glassMat(), 'Glass'); m.castShadow = false; g.add(m);
    } else if (st === 'cable') {
      for (let k = 1; k <= 8; k++) { const y = h * k / 9; const cab = beam(at(0, y), at(1, y), 0.008, 0.008, std(0x9a9a98, { metalness: 0.7, roughness: 0.3 })); cab.castShadow = false; g.add(cab); }
    } else {
      // balusters (one InstancedMesh a run) and a bottom rail
      g.add(beam(at(0, 0.08), at(1, 0.08), st === 'metal' ? 0.03 : 0.05, st === 'metal' ? 0.03 : 0.06, frame));
      const pitch = st === 'metal' ? 0.12 : 0.13, n = Math.max(1, Math.floor(L / pitch)), bw = st === 'metal' ? 0.018 : 0.04;
      const geo = new THREE.BoxGeometry(bw, 1, bw); geo.translate(0, 0.5, 0);
      const im = new THREE.InstancedMesh(geo, frame, n), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = V(), P = V();
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, p = at(t, 0.08); im.setMatrixAt(i, M4.compose(P.set(p[0], p[1], p[2]), Q, S.set(1, h - 0.12, 1))); }
      im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.name = 'Balusters'; g.add(im);
    }
  }

  // ---- fences -------------------------------------------------------------------------------------------------
  const FENCE_STYLES = ['picket', 'privacy', 'slat-h', 'post-rail', 'metal', 'glass', 'stone-wall'];
  // one straight run from a to b ([x, z]) at y, in a style; returns its solids
  function fenceRun(g, a, b, { style = 'picket', h = null, color = null, y = 0, extA = 0, extB = 0 } = {}) {
    const L0 = dist(a, b); if (L0 < 0.05) return [];
    // (`extA`, `extB`: the run reaches this far past its end, to close the bend it makes with the next — the outer corner of
    // a polyline is otherwise notched by half the thickness)
    const L = L0 + extA + extB, sh = (extB - extA) / 2, ux = (b[0] - a[0]) / L0, uz = (b[1] - a[1]) / L0;
    const st = FENCE_STYLES.includes(style) ? style : 'picket';
    const H = h ?? (st === 'privacy' ? 1.8 : st === 'slat-h' ? 1.6 : st === 'stone-wall' ? 0.9 : st === 'metal' ? 1.2 : st === 'glass' ? 1.1 : st === 'post-rail' ? 1.1 : 1.0);
    const run = new THREE.Group(); run.name = `Fence (${st}, ${L0.toFixed(1)}m)`;
    const c = color != null ? hex(color) : { picket: 0xf8fafc, privacy: 0x8a6a4e, 'slat-h': 0x7a5a40, 'post-rail': 0x6b5440, metal: 0x24262a, glass: 0x2b2d30, 'stone-wall': 0x9d968a }[st];
    const m = st === 'stone-wall' ? (mat('stone', c) || std(c, { roughness: 0.95 })) : std(c, { roughness: st === 'metal' || st === 'glass' ? 0.45 : 0.8, metalness: st === 'metal' || st === 'glass' ? 0.45 : 0 });
    // built along local +x from −L/2 to L/2, then turned onto a → b
    const posts = (every, pw) => { const n = Math.max(1, Math.ceil(L / every)); for (let i = 0; i <= n; i++) run.add(box(pw, H, pw, m, -L / 2 + L * i / n, H / 2, 0)); };
    if (st === 'picket') {
      const n = Math.max(2, Math.round(L / 0.22));
      for (let i = 0; i <= n; i++) run.add(box(0.07, H, 0.03, m, -L / 2 + i * (L / n), H / 2, 0, false));
      run.add(box(L, 0.06, 0.03, m, 0, H * 0.35, 0.02, false)); run.add(box(L, 0.06, 0.03, m, 0, H * 0.8, 0.02, false));
    } else if (st === 'privacy') {
      posts(2.0, 0.1); run.add(box(L, H - 0.1, 0.03, m, 0, (H - 0.1) / 2 + 0.05, 0.04));
      run.add(box(L + 0.05, 0.05, 0.1, m, 0, H, 0));
    } else if (st === 'slat-h') {
      posts(2.0, 0.08);
      for (let yy = 0.08; yy < H - 0.05; yy += 0.12) run.add(box(L, 0.095, 0.022, m, 0, yy + 0.05, 0.05, true));
    } else if (st === 'post-rail') {
      posts(2.4, 0.12);
      for (const k of [0.35, 0.65, 0.95]) run.add(box(L, 0.1, 0.05, m, 0, H * k, 0.07));
    } else if (st === 'metal') {
      posts(2.0, 0.06);
      for (const k of [0.1, 0.9]) run.add(box(L, 0.035, 0.035, m, 0, H * k, 0));
      const n = Math.max(2, Math.round(L / 0.12)), geo = new THREE.BoxGeometry(0.02, H * 0.95, 0.02); geo.translate(0, H * 0.475, 0);
      const im = new THREE.InstancedMesh(geo, m, n), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = V(1, 1, 1), P = V();
      for (let i = 0; i < n; i++) im.setMatrixAt(i, M4.compose(P.set(-L / 2 + (i + 0.5) * L / n, 0, 0), Q, S));
      im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.name = 'Pickets'; run.add(im);
    } else if (st === 'glass') {
      const np = Math.max(1, Math.ceil(L / 1.8));
      posts(1.8, 0.05); run.add(box(L, 0.04, 0.05, m, 0, H, 0));
      for (let i = 0; i < np; i++) { const x0 = -L / 2 + L * i / np + 0.03, x1 = -L / 2 + L * (i + 1) / np - 0.03; const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, H - 0.1), glassMat()); p.position.set((x0 + x1) / 2, (H - 0.1) / 2 + 0.03, 0); run.add(p); }
    } else {
      // a dry-stone garden wall: a battered body in the stone surface under an irregular row of cap stones
      const T = 0.45;
      const body = new THREE.Mesh(new THREE.BoxGeometry(L, H - 0.08, T), m); body.position.y = (H - 0.08) / 2; body.castShadow = true; body.receiveShadow = true; run.add(body);
      const cap = std(0x8a8479, { roughness: 1, flatShading: true });
      for (let x = -L / 2; x < L / 2 - 0.05;) { const w = Math.min(L / 2 - x, 0.35 + ((x * 7.13) % 0.2 + 0.2) * 0.5); run.add(box(w - 0.02, 0.1, T + 0.06, cap, x + w / 2, H - 0.05, 0)); x += w; }
    }
    run.position.set((a[0] + b[0]) / 2 + ux * sh, y, (a[1] + b[1]) / 2 + uz * sh); run.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    g.add(run);
    return [{ kind: st === 'stone-wall' ? 'wall' : 'fence', x: +((a[0] + b[0]) / 2 + ux * sh).toFixed(3), z: +((a[1] + b[1]) / 2 + uz * sh).toFixed(3), w: +L.toFixed(3), d: st === 'stone-wall' ? 0.45 : 0.1, rot: +(Math.atan2(b[1] - a[1], b[0] - a[0]) * -180 / Math.PI).toFixed(2), yMin: y, yMax: +(y + H).toFixed(3) }];
  }
  // a low garden wall run in a surface (stone, brick, stucco, concrete, render) with a coping
  function wallRun(g, a, b, { h = 0.6, t = 0.25, surface = 'stucco', color = null, cap = null, y = 0, extA = 0, extB = 0 } = {}) {
    const L0 = dist(a, b); if (L0 < 0.05) return [];
    const L = L0 + extA + extB, sh = (extB - extA) / 2, ux = (b[0] - a[0]) / L0, uz = (b[1] - a[1]) / L0;
    const run = new THREE.Group(); run.name = `Garden wall (${surface}, ${L0.toFixed(1)}m)`;
    const c = color != null ? hex(color) : { stone: 0x9d968a, brick: 0x8e5a48, stucco: 0xe8e4dc, render: 0xe8e4dc, concrete: 0xa5a4a0 }[surface] ?? 0xe8e4dc;
    const m = (surface === 'stone' || surface === 'brick' || surface === 'stucco' || surface === 'concrete') && mat(surface, c) || std(c, { roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(L, h, t), m); body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; run.add(body);
    run.add(box(L + 0.06, 0.05, t + 0.06, std(cap != null ? hex(cap) : 0xd8d3c8, { roughness: 0.8 }), 0, h + 0.025, 0));
    run.position.set((a[0] + b[0]) / 2 + ux * sh, y, (a[1] + b[1]) / 2 + uz * sh); run.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    g.add(run);
    return [{ kind: 'wall', x: +((a[0] + b[0]) / 2 + ux * sh).toFixed(3), z: +((a[1] + b[1]) / 2 + uz * sh).toFixed(3), w: +L.toFixed(3), d: t, rot: +(Math.atan2(b[1] - a[1], b[0] - a[0]) * -180 / Math.PI).toFixed(2), yMin: y, yMax: +(y + h + 0.05).toFixed(3) }];
  }

  // ---- terraces (A3) -----------------------------------------------------------------------------------------------
  // `poly` raised to `y` over the ground it stands on. edge.kind:
  //   retaining  vertical faces in edge.material / edge.color, a coping round the top (the default)
  //   rail       the same with a rail round it (edge.rail: a style, edge.railColor), except along the house
  //   slope      a grass bank falling outward at 1:1.6 instead of a wall
  //   planted    the same bank, planted (site-build.ts plants it through the kit)
  // `top` is the terrace's surface material; `sink` drops it a centimetre where a storey's floor stands at y.
  // `baseAt(p)` is the ground just outside the outline at p (0, or the top of a lower terrace it stands over: one
  // terrace can stand partly on another, partly on the lot), `pieces(a, b)` the parts of an outline edge that are NOT the
  // house's own wall — [t0, t1] fractions along a → b — which get their rail, bank and retaining solid.
  function terrace(poly0: P2[], y: number, baseAt: (p: P2) => number, { edge = {} as any, top, sink = 0, pieces = (a: P2, b: P2) => [[0, 1]] as Array<[number, number]>, holes = [] as P2[][] } = {} as any) {
    const g = group('Terrace'), poly = ccw(poly0), kind = edge.kind || 'retaining', solids = [];
    const wallM = mat(edge.material || 'stone', edge.color != null ? hex(edge.color) : null) || std(edge.color != null ? hex(edge.color) : 0x9d968a, { roughness: 0.95 });
    const yt = y - sink;
    const bank = kind === 'slope' || kind === 'planted';
    // the ground under each corner (just outside the outline), and under the whole plateau: its lowest
    const out1 = offsetLoop(poly, 0.15), baseV = poly.map((_, i) => Math.min(baseAt(out1[i]), y)), base = Math.min(...baseV);
    // the plateau: a prism from the lowest ground under it (sunk 2 cm) to its top; caps in `top`, sides in the wall (a bank
    // hides them). Where it stands over a lower terrace the part below that terrace's top is inside it, out of sight.
    {
      const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1])));
      // water dug into the terrace (a pool with its rim at the terrace's top) is cut out of it, as the lawn is cut
      for (const h of holes) shape.holes.push(new THREE.Path(ccw(h).reverse().map(p => new THREE.Vector2(p[0], p[1]))));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.02, yt - base + 0.02), bevelEnabled: false, curveSegments: 4 }); geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, [top, bank ? top : wallM]); m.position.y = yt; m.receiveShadow = true; m.castShadow = true; m.name = 'Terrace plateau'; g.add(m);
    }
    const n = poly.length, lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    let run = 0;
    if (bank) {
      // a bank outward from every edge (not along the house), falling to the ground under it at 1:1.6
      const N = poly.map((p, i) => [(out1[i][0] - p[0]) / 0.15, (out1[i][1] - p[1]) / 0.15] as P2);   // (the mitred outward normal at each corner)
      const reach = (i: number) => Math.max(0.3, (y - baseV[i]) * 1.6), outer = poly.map((p, i) => [p[0] + N[i][0] * reach(i), p[1] + N[i][1] * reach(i)] as P2), s = soup();
      run = Math.max(...poly.map((_, i) => reach(i)));
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        for (const [t0, t1] of pieces(poly[i], poly[j])) {
          const p0 = lerp2(poly[i], poly[j], t0), p1 = lerp2(poly[i], poly[j], t1), o0 = lerp2(outer[i], outer[j], t0), o1 = lerp2(outer[i], outer[j], t1);
          const b0 = baseV[i] + (baseV[j] - baseV[i]) * t0, b1 = baseV[i] + (baseV[j] - baseV[i]) * t1;
          s.quad([p0[0], yt, p0[1]], [p1[0], yt, p1[1]], [o1[0], b1 - 0.02, o1[1]], [o0[0], b0 - 0.02, o0[1]], [N[i][0], 1, N[i][1]]);
        }
      }
      if (!s.empty()) g.add(s.mesh(top, 'Terrace bank'));
      g.userData.bank = { outer, run };
    } else {
      // coping: a flat ring 5 cm proud of the faces, and the rail
      const cope = offsetLoop(poly, 0.05), cm = std(edge.coping != null ? hex(edge.coping) : 0xcfc9bd, { roughness: 0.8 });
      const shape = new THREE.Shape(ccw(cope).map(p => new THREE.Vector2(p[0], p[1]))); shape.holes.push(new THREE.Path(ccw(offsetLoop(poly, -0.25)).reverse().map(p => new THREE.Vector2(p[0], p[1]))));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false, curveSegments: 4 }); geo.rotateX(Math.PI / 2);
      const cmesh = new THREE.Mesh(geo, cm); cmesh.position.y = yt + 0.05; cmesh.castShadow = true; cmesh.receiveShadow = true; cmesh.name = 'Coping'; g.add(cmesh);
      if (kind === 'rail') for (let i = 0; i < n; i++) { const j = (i + 1) % n; for (const [t0, t1] of pieces(poly[i], poly[j])) { const a = lerp2(poly[i], poly[j], t0), b = lerp2(poly[i], poly[j], t1); rail(g, [a[0], yt + 0.05, a[1]], [b[0], yt + 0.05, b[1]], { h: 1.0, style: edge.rail || 'glass', color: edge.railColor ?? null }); } }
    }
    // a retaining wall stands only where the terrace has one: not along the house, not where the ground is a bank
    if (!bank) for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      for (const [t0, t1] of pieces(poly[i], poly[j])) {
        const a = lerp2(poly[i], poly[j], t0), b = lerp2(poly[i], poly[j], t1), b0 = Math.min(baseV[i], baseV[j]);
        solids.push({ kind: 'retaining', x: +((a[0] + b[0]) / 2).toFixed(3), z: +((a[1] + b[1]) / 2).toFixed(3), w: +dist(a, b).toFixed(3), d: 0.3, rot: +(Math.atan2(b[1] - a[1], b[0] - a[0]) * -180 / Math.PI).toFixed(2), yMin: b0, yMax: y });
      }
    }
    // the plateau: its outline and box (a bank falls off it by `bank` m: not solid, but the ground there is not level either)
    const bb = bbox(poly);
    g.userData.solids = [{ kind: 'terrace', poly: poly.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]), x: +((bb.x0 + bb.x1) / 2).toFixed(3), z: +((bb.z0 + bb.z1) / 2).toFixed(3), w: +(bb.x1 - bb.x0).toFixed(3), d: +(bb.z1 - bb.z0).toFixed(3), rot: 0, yMin: base, yMax: y, ...(bank ? { bank: +run.toFixed(2) } : {}) }, ...solids];
    g.userData.base = base; g.userData.baseV = baseV;
    return g;
  }

  // ---- steps and exterior stairs --------------------------------------------------------------------------------
  // a flight of steps at the origin rising toward −z: n risers of h / n, treads of d / n, `w` wide, solid to the
  // ground, in `m`; optional rails both sides
  function flight(w: number, h: number, n: number, tread: number, m, { rails = null, open = false, stringer = null } = {} as any) {
    const g = group('Steps'), riser = h / n;
    // (the top tread stands 8 mm under the surface the flight runs into — a terrace, a deck, a landing, the floor of a
    // door: a flight built longer than the gap to it would otherwise put its last treads coplanar with that surface, and
    // the two materials z-fight; hidden 8 mm down, an overrun is simply covered)
    const SINK = 0.008;
    for (let i = 0; i < n; i++) {
      const top = (i + 1) * riser - (i === n - 1 ? SINK : 0);
      if (open) g.add(box(w, 0.05, tread + 0.03, m, 0, top - 0.025, -(i * tread) - tread / 2 + 0.16));
      else g.add(box(w, top, tread, m, 0, top / 2, -(i * tread) - tread / 2 + 0.16));
    }
    if (open && stringer) for (const sx of [-w / 2 - 0.03, w / 2 + 0.03]) g.add(beam([sx, 0, 0.16], [sx, h, 0.16 - n * tread], 0.06, 0.22, stringer));
    if (rails) for (const sx of [-w / 2 + 0.03, w / 2 - 0.03]) rail(g, [sx, riser, 0.16 - tread / 2], [sx, h, 0.16 - n * tread + tread / 2], { h: 0.95, style: rails.style, color: rails.color });
    return g;
  }
  // `stair`: from [x, z, y0] to [x, z, y1]; a landing half way when it climbs more than 16 risers
  function stair(from: number[], to: number[], { w = 1.2, style = 'stone', color = null, rail: railSpec = null, landing = true } = {} as any) {
    const g = group('Exterior Stair'), y0 = from[2] ?? 0, y1 = to[2] ?? 0, H = Math.abs(y1 - y0), D = dist([from[0], from[1]], [to[0], to[1]]);
    const up = y1 >= y0, lo = up ? from : to, hi = up ? to : from, ylo = Math.min(y0, y1);
    const open = style === 'steel' || style === 'timber';
    const c = color != null ? hex(color) : style === 'steel' ? 0x2b2d30 : style === 'timber' ? 0x7a5a40 : style === 'concrete' ? 0xa9a8a3 : 0x9d968a;
    const m = !open && mat(style === 'concrete' ? 'steps' : 'stone', c) || std(c, { roughness: style === 'steel' ? 0.5 : 0.85, metalness: style === 'steel' ? 0.45 : 0 });
    const treadM = style === 'steel' ? std(0x5c5a55, { roughness: 0.7 }) : m;
    let n = Math.max(2, Math.ceil(H / 0.18));
    const split = landing && n > 16, L = 1.0;
    const rails = railSpec ? { style: typeof railSpec === 'string' ? railSpec : railSpec.style || 'metal', color: typeof railSpec === 'object' ? railSpec.color : null } : null;
    const ang = Math.atan2(hi[0] - lo[0], hi[1] - lo[1]);   // the flight is built rising toward −z; turned so −z runs lo → hi
    const put = (o, x, z, y) => { o.position.set(x, y, z); o.rotation.y = ang + Math.PI; g.add(o); };
    const dx = (hi[0] - lo[0]) / (D || 1), dz = (hi[1] - lo[1]) / (D || 1);
    if (!split) {
      const tread = D / n;
      put(flight(w, H, n, tread, open ? treadM : m, { rails, open, stringer: m }), lo[0] + dx * 0.16, lo[1] + dz * 0.16, ylo);
    } else {
      const n1 = Math.ceil(n / 2), n2 = n - n1, tread = (D - L) / n, h1 = H * n1 / n;
      put(flight(w, h1, n1, tread, open ? treadM : m, { rails, open, stringer: m }), lo[0] + dx * 0.16, lo[1] + dz * 0.16, ylo);
      const lx = lo[0] + dx * (n1 * tread + L / 2), lz = lo[1] + dz * (n1 * tread + L / 2);
      const pad = box(w, open ? 0.08 : h1, L, open ? treadM : m, 0, open ? h1 - 0.04 : h1 / 2, 0); const pg = group('Landing'); pg.add(pad);
      if (open) for (const [sx, sz] of [[-w / 2, -L / 2], [w / 2, -L / 2], [-w / 2, L / 2], [w / 2, L / 2]]) pg.add(box(0.08, h1, 0.08, m, sx, h1 / 2, sz));
      put(pg, lx, lz, ylo);
      put(flight(w, H - h1, n2, tread, open ? treadM : m, { rails, open, stringer: m }), lo[0] + dx * (n1 * tread + L + 0.16), lo[1] + dz * (n1 * tread + L + 0.16), ylo + h1);
      n = n1 + n2;
    }
    g.userData.solids = [{ kind: 'stair', x: +((lo[0] + hi[0]) / 2).toFixed(3), z: +((lo[1] + hi[1]) / 2).toFixed(3), w, d: +D.toFixed(3), rot: +(ang * 180 / Math.PI).toFixed(2), yMin: ylo, yMax: ylo + H }];
    g.userData.stair = { risers: n, rise: +(H / n).toFixed(3), tread: +((split ? D - L : D) / n).toFixed(3) };
    return g;
  }

  // ---- water -------------------------------------------------------------------------------------------------------
  // A basin you can see into: the water at rim − 6 cm, the walls and floor inside in a pale plaster (a pool) or dark
  // (a reflecting basin, a rill), and a coping ring round it. `poly` is its outline in plan, world coordinates.
  function basin(poly0: P2[], rim: number, depth: number, { water, dark = false, coping = null as any, copingDefault = { w: 0.35, color: 0xd9d4c8 }, tile = null as any } = {} as any) {
    const g = group('Pool'), poly = ccw(poly0);
    const wall = std(tile != null ? hex(tile) : dark ? 0x2a3336 : 0x9fb9bd, { roughness: 0.6 });
    const floorM = std(tile != null ? hex(tile) : dark ? 0x222a2c : 0x86a9ae, { roughness: 0.7 });
    // walls: a strip from the rim down, facing in
    const s = soup(), c = centroid(poly), yb = rim - depth;
    for (const [a, b] of segmentsOf(poly, true)) s.quad([a[0], rim, a[1]], [b[0], rim, b[1]], [b[0], yb, b[1]], [a[0], yb, a[1]], [c[0] - (a[0] + b[0]) / 2, 0, c[1] - (a[1] + b[1]) / 2]);
    g.add(s.mesh(wall, 'Pool walls'));
    const flat = (pts, y, m, name) => { const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])))); const o = new THREE.Mesh(geo, m); o.rotation.x = -Math.PI / 2; o.position.y = y; o.receiveShadow = true; o.name = name; return o; };
    g.add(flat(poly, yb, floorM, 'Pool floor'));
    g.add(flat(poly, rim - 0.06, water, 'Water'));
    const cp = coping === false ? null : { ...copingDefault, ...(typeof coping === 'object' && coping ? coping : {}) };
    if (cp) {
      const outer = offsetLoop(poly, cp.w), cm = cp.material && mat(cp.material, cp.color != null ? hex(cp.color) : null) || std(cp.color != null ? hex(cp.color) : 0xd9d4c8, { roughness: 0.8 });
      const shape = new THREE.Shape(ccw(outer).map(p => new THREE.Vector2(p[0], p[1]))); shape.holes.push(new THREE.Path(poly.slice().reverse().map(p => new THREE.Vector2(p[0], p[1]))));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 4 }); geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, cm); m.position.y = rim + 0.03; m.castShadow = false; m.receiveShadow = true; m.name = 'Coping'; g.add(m);
    }
    g.userData.outline = poly; g.userData.coping = cp ? cp.w : 0;
    return g;
  }
  // a formal basin's island (a coped box with a clipped ball or a planted bed on it) and its jets
  function jets(g, pts: P2[], rim: number, h = 0.9) {
    const col = new THREE.MeshPhysicalMaterial({ color: 0xe8f1f2, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false });
    for (const [x, z] of pts) {
      const j = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, h, 8, 1, true), col); j.position.set(x, rim - 0.06 + h / 2, z); j.castShadow = false; g.add(j);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), col); top.scale.set(1, 0.6, 1); top.position.set(x, rim - 0.06 + h, z); top.castShadow = false; g.add(top);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.3, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdfeaec, transparent: true, opacity: 0.35, depthWrite: false })); ring.position.set(x, rim - 0.055, z); g.add(ring);
    }
  }

  // ---- decks --------------------------------------------------------------------------------------------------------
  // at the origin, w × d: its top at h (above its own y), posts to `postsDown` below its underside (the ground under a
  // raised deck; 0: none), rails on the named sides (deck-local, before `rot`: S = +z, N = −z, E = +x, W = −x), a hole
  // for every `holes` polygon (deck-local).
  function deck(w: number, d: number, h: number, boardMat, { postsDown = 0, sides = [] as string[], railStyle = 'colonial', railColor = null, holes = [] as P2[][], postColor = null } = {} as any) {
    const g = group('Deck'), t = Math.min(0.15, h);
    const shape = new THREE.Shape([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(p => new THREE.Vector2(p[0], p[1])));
    for (const hl of holes) shape.holes.push(new THREE.Path(ccw(hl).reverse().map(p => new THREE.Vector2(p[0], p[1]))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 4 }); geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, boardMat); m.position.y = h; m.receiveShadow = true; m.castShadow = true; m.name = 'Deck boards'; g.add(m);
    if (postsDown > 0.05) {
      const pm = std(postColor != null ? hex(postColor) : 0x4a3524, { roughness: 0.85 }), nx = Math.max(1, Math.ceil(w / 2.5)), nz = Math.max(1, Math.ceil(d / 2.5)), L = postsDown;
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) if (i === 0 || i === nx || j === 0 || j === nz) g.add(box(0.15, L, 0.15, pm, -w / 2 + 0.15 + (w - 0.3) * i / nx, h - t - L / 2, -d / 2 + 0.15 + (d - 0.3) * j / nz));
    }
    const edges = { S: [[-w / 2, d / 2 - 0.05], [w / 2, d / 2 - 0.05]], N: [[-w / 2, -d / 2 + 0.05], [w / 2, -d / 2 + 0.05]], E: [[w / 2 - 0.05, -d / 2], [w / 2 - 0.05, d / 2]], W: [[-w / 2 + 0.05, -d / 2], [-w / 2 + 0.05, d / 2]] };
    for (const sd of sides) { const e = edges[sd]; if (e) rail(g, [e[0][0], h, e[0][1]], [e[1][0], h, e[1][1]], { h: 0.95, style: railStyle, color: railColor }); }
    return g;
  }

  return { rail, fenceRun, wallRun, terrace, flight, stair, basin, jets, deck, FENCE_STYLES, RAIL_STYLES };
}
