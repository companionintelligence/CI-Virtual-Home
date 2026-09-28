// The site — the lot's ground (pools and the ground storey cut out of it), the world round it, the page's site
// builders (pools, decks, patios, porches, fences …) and the site loop, which hands the seeded planting types to
// the site kit (assets/site.ts) and records their resolved instances (anchors.siteInstances → <id>.plan.json).
//
// Seam module (plan S0): moved verbatim out of house-builder.ts. Owner: S4 (site).
import { perimeterEdges, outlineLoops, rectCentre } from './house-geometry.js';
import { createSiteKit } from './site.js';
import { buildWorld } from './world.js';
import { DEG, hex, mix } from './build-context.js';

const GROUND_COLORS = { lawn: 0x384a2c, desert: 0xc5ae88, forest: 0x3b4a2c, urban: 0x9c9b97, waterfront: 0x384a2c };   // restrained fallbacks; gcol is the kit surface's mean

export function createSiteBuild(bctx) {
  const { THREE, AssetFactory, ProceduralArchitecture, textures, std, box, group } = bctx;
  let kitNow = null;   // the current build's material kit (assets/materials.ts), for the site builders below
  const waterMat = () => new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.8, roughness: 0.15, metalness: 0.1 });
  // build() hands each house's kit over before anything below is built
  const setKit = kit => { kitNow = kit; };

  // ---------------------------------------------------------------------------------------
  // Site builders
  // ---------------------------------------------------------------------------------------
  function lollipopTree(h = 5, canopy = 0x2f6b2f) {
    const g = group('Tree');
    g.add(box(0.3, h * 0.45, 0.3, std(0x5b3a1e), 0, h * 0.225, 0));
    const c = new THREE.Mesh(new THREE.SphereGeometry(h * 0.32, 14, 10), std(canopy, { roughness: 0.9 }));
    c.position.y = h * 0.62; c.castShadow = true; g.add(c);
    const c2 = new THREE.Mesh(new THREE.SphereGeometry(h * 0.22, 12, 8), std(mix(canopy, 0xffffff, 0.15)));
    c2.position.set(h * 0.12, h * 0.8, h * 0.05); c2.castShadow = true; g.add(c2);
    return g;
  }
  function palmTree(h = 6) {
    const g = group('Palm');
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, h, 8), std(0x8b6a3e));
    trunk.position.y = h / 2; trunk.rotation.z = 0.06; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 8; i++) {
      const f = box(2.6, 0.06, 0.5, std(0x3b7d2a), 0, 0, 0);
      f.geometry.translate(1.2, 0, 0);
      f.rotation.y = i * Math.PI / 4; f.rotation.z = -0.55;
      f.position.y = h; g.add(f);
    }
    return g;
  }
  function shrub(r = 0.6) {
    const g = group('Shrub');
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), std(0x3f7d3a, { roughness: 1 }));
    m.position.y = r * 0.8; m.castShadow = true; g.add(m); return g;
  }
  function planter(w = 1.2, d = 0.5) {
    const g = group('Planter');
    g.add(box(w, 0.5, d, std(0x374151), 0, 0.25, 0));
    const s = shrub(Math.min(w, d) * 0.5); s.position.y = 0.4; g.add(s); return g;
  }
  function pond(w, d) {
    const g = group('Pond');
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 32), waterMat());
    m.scale.set(w / 2, 1, d / 2); m.position.y = 0.04; g.add(m);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), std(0x6b7280));
      rock.position.set(Math.cos(a) * (w / 2 + 0.2), 0.18, Math.sin(a) * (d / 2 + 0.2)); rock.castShadow = true; g.add(rock);
    }
    return g;
  }
  function hotTub(r = 1.1) {
    const g = group('Hot Tub');
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.8, 24), std(0x475569)); shell.position.y = 0.4; shell.castShadow = true; g.add(shell);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.12, r - 0.12, 0.06, 24), waterMat()); water.position.y = 0.78; g.add(water);
    return g;
  }
  // `color` may be a material (a kit surface) instead of a colour
  const slabMat = color => (color && color.isMaterial ? color : std(color, { roughness: 0.95 }));
  function slab(w, d, color, h = 0.08, y = 0) { const g = group('Slab'); g.add(box(w, h, d, slabMat(color), 0, y + h / 2, 0, false)); return g; }
  function deck(w, d, h = 0.12) {
    // `h` is the deck's elevation (HOUSE-SPEC): a low deck is a slab that thick; a raised one (a balcony at the
    // upper floor, a stilted terrace) is a 0.15 m platform whose top sits at h, on posts, railed on its S and E
    // edges — the same read as generate_house_iso.py's site_deck. It used to be a solid block h tall, which put a
    // 3 m timber wall in front of five houses' doors.
    const g = group('Deck');
    const tex = textures.oak;
    const mat = kitNow ? kitNow.floor('deck', { rotation: w >= d ? Math.PI / 2 : 0 }) : tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }) : std(0x8b5e34);
    if (h <= 0.35) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.y = h / 2; m.receiveShadow = true; g.add(m); return g;
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), mat);
    slab.position.y = h - 0.075; slab.receiveShadow = true; slab.castShadow = true; g.add(slab);
    const post = std(0x4a3524), x0 = -w / 2, z0 = -d / 2;
    const posts = [], nx = Math.max(1, Math.ceil(w / 2.5)), nz = Math.max(1, Math.ceil(d / 2.5));   // evenly spaced, ≤ 2.5 m apart
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) if (i === 0 || i === nx || j === 0 || j === nz) posts.push([x0 + 0.15 + (w - 0.3) * i / nx, z0 + 0.15 + (d - 0.3) * j / nz]);
    for (const [px, pz] of posts) g.add(box(0.15, h - 0.15, 0.15, post, px, (h - 0.15) / 2, pz));
    // rail along the S and E edges
    const rail = (len, cx, cz, alongX) => { const r = ProceduralArchitecture.createColonialBalustrade(len, 0.95, 0); r.position.set(cx, h, cz); if (!alongX) r.rotation.y = Math.PI / 2; g.add(r); };
    rail(w, 0, z0 + d - 0.05, true); rail(d, x0 + w - 0.05, 0, false);
    return g;
  }
  // the page's porch paints its floor one flat timber colour (0x78350f): lay the kit's deck boards instead
  function deckBoards(g) {
    if (!kitNow) return g;
    let mat = null;
    g.traverse(o => { if (o.isMesh && !o.material.map && o.material.color && o.material.color.getHex() === 0x78350f) { mat ||= kitNow.floor('deck'); o.material = mat; } });
    return g;
  }
  function steps(w = 1.6, n = 3) {
    const g = group('Steps');
    const mat = kitNow ? kitNow.surface('steps') : std(0x9ca3af);
    for (let i = 0; i < n; i++) g.add(box(w, 0.16, 0.32, mat, 0, 0.08 + i * 0.16, -(i * 0.32)));
    return g;
  }
  function picketFence(len, h = 1.0) {
    const g = group(`Fence (${len}m)`);
    const white = std(0xf8fafc);
    const n = Math.max(2, Math.round(len / 0.22));
    for (let i = 0; i <= n; i++) g.add(box(0.07, h, 0.03, white, -len / 2 + i * (len / n), h / 2, 0, false));
    g.add(box(len, 0.06, 0.03, white, 0, h * 0.35, 0.02, false));
    g.add(box(len, 0.06, 0.03, white, 0, h * 0.8, 0.02, false));
    return g;
  }

  // Pools sit IN the ground (createPoolSlab's basin top is at y = 0, the turtle pool's mosaic floor at
  // −0.79), so the lot slab (−0.06..0) z-fights them and a patio / driveway box (0.08 m) over the same
  // rect buries them. Those slabs therefore get a hole punched for every overlapping water body (a sunken
  // pool in a terrace). Ponds sit ON the ground (0..0.08) so only patio/driveway need a hole for them;
  // decks are exempt on purpose — a `deck` over a `pond` is a dock. `floor` is the lowest surface you can see
  // of it: a pool's basin is a closed box, so that is its rim (its `y`); the turtle pool is open down to its
  // mosaic, 0.79 m below the rim.
  const waterRect = s => {
    if (!['pool', 'turtle-pool', 'pond'].includes(s.type) || !Array.isArray(s.at)) return null;
    const rot90 = Math.round(((s.rot || 0) % 180) / 90) === 1;
    const w0 = s.w || (s.type === 'turtle-pool' ? 8 : s.type === 'pond' ? 4 : 6), d0 = s.d || (s.type === 'turtle-pool' ? 6 : s.type === 'pond' ? 3 : 4);
    const w = rot90 ? d0 : w0, d = rot90 ? w0 : d0;
    return { x: s.at[0] - w / 2, z: s.at[1] - d / 2, w, d, ellipse: s.type === 'pond', floor: (s.y ?? 0) - (s.type === 'turtle-pool' ? 0.79 : 0) };
  };
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.z < b.z + b.d && a.z + a.d > b.z;
  function slabWithHoles(rect, holes, color, h, y = 0, polys = []) {
    const g = group('Slab');
    const [cx, cz] = rectCentre(rect);
    const shape = new THREE.Shape([[-rect.w / 2, -rect.d / 2], [rect.w / 2, -rect.d / 2], [rect.w / 2, rect.d / 2], [-rect.w / 2, rect.d / 2]].map(p => new THREE.Vector2(p[0], p[1])));
    for (const poly of polys) shape.holes.push(new THREE.Path(poly.map(p => new THREE.Vector2(p[0] - cx, p[1] - cz))));   // building outlines
    for (const hl of holes) {
      const path = new THREE.Path();
      if (hl.ellipse) path.absellipse(hl.x + hl.w / 2 - cx, hl.z + hl.d / 2 - cz, hl.w / 2 + 0.3, hl.d / 2 + 0.3, 0, Math.PI * 2, false);
      else path.setFromPoints([[hl.x - cx, hl.z - cz], [hl.x + hl.w - cx, hl.z - cz], [hl.x + hl.w - cx, hl.z + hl.d - cz], [hl.x - cx, hl.z + hl.d - cz]].map(p => new THREE.Vector2(p[0], p[1])));
      shape.holes.push(path);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);                 // shape XY → plan XZ; extrusion runs downward from y = 0
    const m = new THREE.Mesh(geo, slabMat(color));
    m.position.y = y + h; m.receiveShadow = true; g.add(m);   // top face at y (+h), extrusion hangs below it
    return g;
  }
  // patio / driveway: plain box unless a water body overlaps it
  function groundSlab(s, color, h, water) {
    const w = s.w || 4, d = s.d || 3, rect = { x: s.at[0] - w / 2, z: s.at[1] - d / 2, w, d };
    const holes = (water || []).filter(r => overlaps(rect, r));
    return holes.length ? slabWithHoles(rect, holes, color, h) : slab(w, d, color, h);
  }

  const SITE = {
    'pool':        s => AssetFactory.createPoolSlab(s.w || 6, s.d || 4),
    'turtle-pool': s => AssetFactory.createTurtleMosaicPool(s.w || 8, s.d || 6),
    'pond':        s => pond(s.w || 4, s.d || 3),
    'hottub':      s => hotTub(s.r || 1.1),
    'deck':        s => deck(s.w || 4, s.d || 3, s.h || 0.12),
    'patio':       (s, water) => groundSlab(s, kitNow ? kitNow.surface('patio') : 0xd6d3d1, 0.08, water),
    'driveway':    (s, water) => groundSlab(s, kitNow ? kitNow.surface('driveway') : 0xa8a29e, 0.06, water),
    'turf':        s => AssetFactory.createTurfPitch(s.w || 6, s.d || 4),
    'porch':       s => deckBoards(AssetFactory.createColonnadePorch(s.w || 6, s.d || 2.5)),
    'pergola':     s => AssetFactory.createCabanaLounge(s.w || 4, s.d || 3),
    'gazebo':      s => AssetFactory.createWaterfrontGazebo(s.r || 2.2, s.h || 3.2),
    'greenhouse':  s => AssetFactory.createGardenGreenhouse(s.w || 3.6, s.d || 2.4, s.h || 2.7),
    'garden-beds': s => AssetFactory.createRaisedGardenBeds(s.count || 4),
    'monkeybars':  s => AssetFactory.createPlaygroundMonkeyBars(),
    'firepit':     s => AssetFactory.createFirePitLounge(s.r || 2.4),
    'loungers':    s => { const g = group('Loungers'); const a = AssetFactory.createSunLounger(); a.position.x = -0.6; const b = AssetFactory.createSunLounger(); b.position.x = 0.6; g.add(a, b); return g; },
    'bench':       s => AssetFactory.createBench(s.w || 1.8, 0.45, 0.5),
    'car':         s => AssetFactory.createSportsCar(s.color ? hex(s.color) : undefined),
    'planter':     s => planter(s.w || 1.2, s.d || 0.5),
    'steps':       s => steps(s.w || 1.6, s.n || 3),
    'bridge':      s => AssetFactory.createSteppingBridge(s.w || 1.2, s.d || 2.6),
    'soccer-goal': s => AssetFactory.createSoccerGoal(),
    'cactus':      s => AssetFactory.createCactusGroup(),
    'cypress':     s => AssetFactory.createCypressTree(s.h || 4.2),
    'palm':        s => palmTree(s.h || 6)
    // tree, shrub, flowers, rock, bed, path, hedge, scatter, grove: assets/site.js (seeded variation)
  };

  // the site kit for one build
  function siteKitFor(spec) {
    // seeded vegetation, beds, hedges, paths; a bed keeps its plants clear of the ground storey's walls
    const groundRects = (spec.levels || []).filter(l => (l.y || 0) <= 0.001 && Array.isArray(l.footprint)).flatMap(l => l.footprint);
    const siteKit = createSiteKit({ THREE, seed: spec.id, std, mix, keepOut: groundRects });
    return siteKit;
  }

  // The lot's ground and the world round it; returns the water bodies (pools, ponds) the site loop's patios and
  // driveways cut round.
  function buildGround({ spec, kit, put }) {
    // ---- ground (pools are cut out of the lot slab: their basins sit in the ground, top flush with it)
    const lot = spec.lot || { w: 30, d: 24, ground: 'lawn' };
    // gmat: the textured lawn / sand / litter in world metres. gcol stays a COLOUR — the mean albedo of that
    // surface — for anything that has to blend into the lot as a flat material (the world's ground disc).
    const gmat = kit.surface(lot.ground || 'lawn');
    const gcol = kit.surfaceColor(lot.ground || 'lawn') ?? GROUND_COLORS[lot.ground] ?? GROUND_COLORS.lawn;
    const water = (spec.site || []).map(waterRect).filter(Boolean);
    const lotRect = { x: -lot.w / 2, z: -lot.d / 2, w: lot.w, d: lot.d };
    // The ground storey's outline is punched out of the lawn (the pool mechanism): its floor slab's top face and
    // the lawn's were both at y = 0 and z-fought under the house. Courtyards inside that outline get their lawn back.
    const groundLoops = (spec.levels || []).filter(l => (l.y || 0) <= 0.001 && Array.isArray(l.footprint) && l.footprint.length).map(l => outlineLoops(perimeterEdges(l.footprint)));
    const lotPolys = groundLoops.flatMap(l => [l.outer, ...l.holes]).filter(l => l.length >= 4);
    const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    const courtyards = lotPolys.filter(l => lotPolys.some(o => o !== l && inPoly(l[0][0], l[0][1], o)));
    // A water body is cut out of the lawn only where it sits IN the lawn. Not when it is raised clear of it (a pool
    // on a roof terrace or a plinth: a hole there only opens the ground beneath it), and not under the house, whose
    // outline is already a hole. A hole inside that one is garbage to earcut, which filled the house with lawn
    // triangles at y = 0 that z-fought the floor slab. The patio round a raised pool still cuts it (groundSlab).
    // every corner (nudged 1 cm in, off a flush wall) inside an odd number of loops: in the house, not a courtyard
    const underHouse = ({ x, z, w, d }) => [[x + 0.01, z + 0.01], [x + w - 0.01, z + 0.01], [x + w - 0.01, z + d - 0.01], [x + 0.01, z + d - 0.01]]
      .every(([px, pz]) => lotPolys.filter(p => inPoly(px, pz, p)).length % 2 === 1);
    const lotHoles = water.filter(r => !r.ellipse && r.floor < 0.05 && overlaps(lotRect, r) && !underHouse(r));
    put(() => {
      const g = (lotHoles.length || lotPolys.length) ? slabWithHoles(lotRect, lotHoles, gmat, 0.06, 0, lotPolys) : slab(lot.w, lot.d, gmat, 0.06);
      for (const c of courtyards) {   // lawn inside an enclosed courtyard
        const shape = new THREE.Shape(c.map(pt => new THREE.Vector2(pt[0], pt[1])));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }); geo.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(geo, gmat); m.position.y = 0.06; m.receiveShadow = true; g.add(m);
      }
      g.name = `Lot (${lot.w}×${lot.d} ${lot.ground || 'lawn'})`; g.userData.category = 'Site'; return g;
    }, 0, 0, -0.06, null, 'ground');
    if (lot.ground === 'waterfront') put(() => { const g = slab(lot.w + 30, 12, 0x0ea5e9, 0.04, -0.09); g.name = 'Water'; return g; }, 0, -lot.d / 2 - 6, 0, null, 'ground');
    // ---- world: the street on the entry side, 2–4 neighbours, a tree line, ground to the horizon — all outside the
    // lot and clear of the shots' camera paths (assets/world.ts); its ground is the lot's own (colour or kit material)
    put(() => buildWorld({ THREE, spec, std, kit, ground: gcol }), 0, 0, 0, null, 'ground');   // gcol: a colour, or a kit surface
    return water;
  }

  function buildSite({ spec, kit, siteKit, put, anchors, water }) {
    // ---- site
    (spec.site || []).forEach((s, si) => {
      // the site kit's types (tree, shrub, flowers, rock, bed, path, hedge, scatter, grove) — seeded per item
      const own = siteKit.build(s, si);
      if (own) {
        const anchored = siteKit.anchored(s.type);
        const o = put(() => own, anchored ? 0 : s.at[0], anchored ? 0 : s.at[1], s.y ?? 0, null, 'site');
        if (!anchored) o.rotation.y = (s.rot || 0) * DEG + o.rotation.y;
        o.userData.category = 'Site'; o.userData.siteType = s.type;
        // resolved instances for the isometric twin (scripts/build-house-plan.mts → <id>.plan.json): one entry
        // per mesh with its world box, shape and colour — the Python generator draws these instead of porting
        // the seeded builders
        o.updateMatrixWorld(true);
        // (an InstancedMesh contributes the box round all its instances; the kit marks parts to skip with
        // userData.iso = false and names a shape its geometry type does not say with userData.isoShape)
        o.traverse(m => {
          if (!m.isMesh || m.userData.iso === false) return;
          const bb = m.isInstancedMesh ? (m.computeBoundingBox(), m.boundingBox) : (m.geometry.computeBoundingBox(), m.geometry.boundingBox), b = bb.clone().applyMatrix4(m.matrixWorld);
          const gt = m.geometry.type, shape = m.userData.isoShape || (/Icosahedron|Sphere|Dodecahedron/.test(gt) ? 'blob' : /Cone/.test(gt) ? 'cone' : /Cylinder/.test(gt) ? 'cyl' : 'box');
          const mat = Array.isArray(m.material) ? m.material[0] : m.material;
          (anchors.siteInstances ||= []).push({ site: si, type: s.type, part: m.parent && m.parent.name || '', shape, color: '#' + (mat && mat.color ? mat.color.getHexString() : '888888'), box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(v => +v.toFixed(3)) });
        });
        return;
      }
      if (s.type === 'fence' || s.type === 'wall-low') {
        const alongX = Math.abs(s.from[1] - s.to[1]) < 1e-6;
        const len = Math.abs(alongX ? s.to[0] - s.from[0] : s.to[1] - s.from[1]);
        const cx = (s.from[0] + s.to[0]) / 2, cz = (s.from[1] + s.to[1]) / 2;
        const o = put(() => s.type === 'fence' ? (s.style === 'privacy' ? ProceduralArchitecture.createPrivacyFence(len, s.h || 1.8) : picketFence(len, s.h || 1.0)) : AssetFactory.createLowPartitionWall(len, s.h || 0.6), cx, cz, 0, null, 'site');
        if (!alongX) o.rotation.y = Math.PI / 2;
        if (s.color === undefined) kit.mute(o);
        return;
      }
      const fn = SITE[s.type]; if (!fn) return;
      const o = put(() => fn(s, water), s.at[0], s.at[1], s.y ?? 0, null, 'site');
      o.rotation.y = (s.rot || 0) * DEG;
      if (s.type === 'cypress' || s.type === 'palm') siteKit.vary(o, s, si);   // seeded scale / lean / spin
      if (s.type !== 'car' && s.color === undefined) kit.mute(o);   // restrained palette: no orange porch decks, no cyan basins
      o.userData.category = 'Site';
    });
  }

  return { SITE, setKit, siteKitFor, buildGround, buildSite };
}
