// HouseBuilder — compiles a HouseSpec v1 JSON (reference/HOUSE-SPEC.md) into the
// Room Creator scene: ground, floor slabs, perimeter walls with openings, partitions, stairs,
// upper slabs with voids, balustrades, roofs, site items, furniture, the Companion Core hero,
// and auto-generated camera splines (door → core, orbit, hero reveal, walkthrough).
//
// It is deliberately a *compiler* over the page's existing procedural primitives
// (ProceduralArchitecture / AssetFactory) so hand-built presets and spec-driven houses share
// one asset library, one wall-mode system and one exporter.

import { perimeterEdges, edgeForOpening, outlineLoops, unionBounds, rectCentre, inRect } from './house-geometry.js';
import { createMaterialKit, restrainPalette } from './materials.js';
import { createSiteKit } from './site.js';
import { buildWorld } from './world.js';
import { PROPS } from './props/index.js';
import { FloorplanGraph } from './floorplan-graph.js';
import { createWallCompiler } from './wall-compiler.js';
import { buildRoofs } from './roofs.js';
import { dressLevel } from './fixtures.js';
import { createOrbitProbe, planOrbit, arcWaypoints, orbitPoint, sweepFrom } from './core-orbit.js';
import { attachFrameAt, knotArcLengths } from './shot-path.js';

const DEG = Math.PI / 180;
const hex = c => (typeof c === 'number' ? c : parseInt(String(c || '#ffffff').replace('#', ''), 16));
const mix = (a, b, t) => { // blend two hex colours
  const A = hex(a), B = hex(b);
  const r = ((A >> 16) & 255) * (1 - t) + ((B >> 16) & 255) * t, g = ((A >> 8) & 255) * (1 - t) + ((B >> 8) & 255) * t, bl = (A & 255) * (1 - t) + (B & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

const GROUND_COLORS = { lawn: 0x384a2c, desert: 0xc5ae88, forest: 0x3b4a2c, urban: 0x9c9b97, waterfront: 0x384a2c };   // restrained fallbacks; gcol is the kit surface's mean

export function createHouseBuilder(deps) {
  const {
    THREE, AssetFactory, ProceduralArchitecture, addItemToScene, registerTrackedWall, registerRoof, registerCeiling, fitShadow,
    setLightingPreset, textures = {}, useGraphWalls = false
  } = deps;

  // ---------------------------------------------------------------------------------------
  // Materials
  // ---------------------------------------------------------------------------------------
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color: hex(color), roughness: 0.75, ...extra });
  let kitNow = null;   // the current build's material kit (assets/materials.ts), for the site builders below
  const glassMat = () => new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.32, roughness: 0.06, transmission: 0.85, ior: 1.52 });
  const waterMat = () => new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.8, roughness: 0.15, metalness: 0.1 });

  const box = (w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m;
  };
  const group = (name, userData = {}) => { const g = new THREE.Group(); g.name = name; g.userData = { category: 'House', ...userData }; return g; };

  // ---------------------------------------------------------------------------------------
  // Item catalog: spec item type → AssetFactory builder
  // ---------------------------------------------------------------------------------------
  const ITEMS = {
    'sectional':        it => AssetFactory.createModularSectional(),
    'club-chair':       it => AssetFactory.createClubChair(it.color ? hex(it.color) : undefined),
    'coffee-table':     it => AssetFactory.createCoffeeTable(it.w, it.d),
    'octagonal-table':  it => AssetFactory.createOctagonalLatticeCoffeeTable(),
    'dining-set':       it => AssetFactory.createDiningSet(it.w, it.d),
    'dining-table':     it => AssetFactory.createDiningTable(it.w, it.d),
    'kitchen-island':   it => AssetFactory.createKitchenIsland(it.w, it.d, it.color ? hex(it.color) : undefined),
    'kitchen-cabinetry': it => AssetFactory.createKitchenCabinetry(it.w || 3.6, 0.9, it.d || 0.65),
    'media-credenza':   it => AssetFactory.createMediaCredenza(it.w, it.d),
    'wall-tv':          it => AssetFactory.createWallTV(it.w, it.h),
    'fireplace':        it => AssetFactory.createFireplace(),
    'area-rug':         it => AssetFactory.createAreaRug(it.w, it.d, it.color ? hex(it.color) : undefined),
    'circular-rug':     it => AssetFactory.createCircularRug(it.r, it.color ? hex(it.color) : undefined),
    'concentric-rug':   it => AssetFactory.createConcentricRug(it.r),
    'sun-lounger':      it => AssetFactory.createSunLounger(),
    'bench':            it => AssetFactory.createBench(it.w, it.h, it.d),
    'platform-bed':     it => AssetFactory.createPlatformBed(it.w, it.d, undefined, undefined, it.color ? hex(it.color) : undefined),
    'wardrobe':         it => AssetFactory.createWardrobeCloset(it.w || 2.2, it.h || 2.5, it.d || 0.6),
    'crib':             it => AssetFactory.createNurseryCrib(it.color ? hex(it.color) : undefined),
    'ensuite':          it => AssetFactory.createBathroomEnsuite(it.w, it.d),
    'bookshelf':        it => AssetFactory.createBookshelf(it.w || 1.2, it.h || 2.0, it.d || 0.35),
    'walnut-desk':      it => AssetFactory.createWalnutDesk(),
    'task-chair':       it => AssetFactory.createTaskChair(),
    'curved-monitor':   it => AssetFactory.createCurvedMonitor(),
    'chalk-tower':      it => AssetFactory.createChalkTower({ pose: it.pose || 'prone' }),
    'charcoal-tower':   it => AssetFactory.createCharcoalTower({ pose: it.pose || 'prone' }),
    // headless Core on a floating shelf, as furniture: `at` is the wall face, `rot` the heading the shelf backs onto
    // (same sense as hero.rot), finish chalk|charcoal, pose prone|upright, h shelf height
    'core-shelf':       it => {
      const g = group(`Core Shelf (${it.finish || 'chalk'})`, { category: 'Devices', tags: 'companion core, shelf' });
      const h = it.h || 0.8, w = it.w || 0.9;
      const shelf = AssetFactory.createFloatingShelf(w, 0.26, h); g.add(shelf);
      const core = (it.finish === 'charcoal' ? AssetFactory.createCharcoalTower : AssetFactory.createChalkTower)({ pose: it.pose || 'prone' });
      core.position.set(w / 2 - 0.25, h, 0.13); core.rotation.y = Math.PI; g.add(core);   // front toward the room (the plank's +Z)
      const books = group('Books'); for (const [i, c] of [0x8b5e3c, 0x3f5d73, 0xd9c9a3].entries()) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2 - i * 0.02, 0.15), std(c)); b.position.set(-w / 2 + 0.12 + i * 0.032, h + (0.2 - i * 0.02) / 2, 0.13); books.add(b); } g.add(books);
      g.userData.coreShelf = { core, h };
      return g;
    },
    'strix-mini':       it => AssetFactory.createStrixHaloMini(),
    'speakers':         it => AssetFactory.createStudioSpeakers(),
    'halo-lamp':        it => AssetFactory.createAmbientHaloLamp(),
    'fiddle-leaf':      it => AssetFactory.createFiddleLeafFig(),
    'monstera':         it => AssetFactory.createMonstera(),
    'bonsai':           it => AssetFactory.createBonsai(),
    'bamboo':           it => AssetFactory.createBambooGrove(),
    'cactus-group':     it => AssetFactory.createCactusGroup(),
    'telescope':        it => AssetFactory.createTelescope(),
    'soccer-goal':      it => AssetFactory.createSoccerGoal(),
    'low-wall':         it => AssetFactory.createLowPartitionWall(it.w || 3, it.h || 0.85),
    // Structural column (pilotis, colonnade, mezzanine post). Default height stops under an upper
    // slab (level height − 0.18 m slab); pass `h` for anything else. style: modern | colonial | steel.
    'column':           (it, lv) => ProceduralArchitecture.createStructuralColumn({
      height: it.h || lv.H - 0.18, radius: it.r || 0.16, size: it.size || null, style: it.style || 'modern',
      color: hex(it.color || (it.style === 'colonial' ? lv.palette.trim : it.style === 'steel' ? '#1e293b' : lv.palette.trim))
    })
  };
  const DESK_TOP = 0.77; // items that sit on a desk / credenza
  const ON_SURFACE = new Set(['curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers']);

  // Roofs: assets/roofs.ts (eaves hung below the wall top, fascia, gutters and downspouts, ridge caps, gable ends).

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
  // decks are exempt on purpose — a `deck` over a `pond` is a dock.
  const waterRect = s => {
    if (!['pool', 'turtle-pool', 'pond'].includes(s.type) || !Array.isArray(s.at)) return null;
    const rot90 = Math.round(((s.rot || 0) % 180) / 90) === 1;
    const w0 = s.w || (s.type === 'turtle-pool' ? 8 : s.type === 'pond' ? 4 : 6), d0 = s.d || (s.type === 'turtle-pool' ? 6 : s.type === 'pond' ? 3 : 4);
    const w = rot90 ? d0 : w0, d = rot90 ? w0 : d0;
    return { x: s.at[0] - w / 2, z: s.at[1] - d / 2, w, d, ellipse: s.type === 'pond' };
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

  // ---------------------------------------------------------------------------------------
  // Wall placement helpers
  // ---------------------------------------------------------------------------------------
  // rotation.y and local-offset sign so that the wall's local +Z faces OUTWARD for each side
  const SIDE_ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
  const SIDE_ORI = { S: 'south', N: 'north', E: 'east', W: 'west' };
  const localOffset = (side, at, mid) => (side === 'S' || side === 'W') ? at - mid : -(at - mid);

  function openingToParam(op, height, isEntry) {
    if (op.type === 'window') return { type: 'window', width: op.w, height: op.h || 1.2, sillY: op.sill ?? 0.9 };
    if (op.type === 'glass')  return { type: 'window', width: op.w, height: Math.min(op.h || height - 0.1, height - 0.1), sillY: 0.05 };
    if (op.type === 'slider') return { type: 'door', width: op.w, height: op.h || 2.2, style: 'glass-slider', entry: !!isEntry };
    if (op.type === 'garage') return { type: 'door', width: op.w, height: op.h || 2.2, style: 'garage' };
    return { type: 'door', width: op.w, height: op.h || 2.1, style: op.style || 'entry', open: isEntry || op.open === true, entry: !!isEntry, leafColor: op.color ? hex(op.color) : undefined };
  }

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

  // ---------------------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------------------
  function build(spec) {
    const palette = restrainPalette({ wall: '#f8fafc', trim: '#1e293b', roof: '#3f2a1d', accent: '#0f766e', ...(spec.palette || {}) });   // saturated walls/roofs pulled toward restraint
    const anchors: Record<string, any> = { spec: spec.id, entry: null, hero: null, stairs: [], levels: {}, bounds: null, lot: spec.lot, solids: {} };
    if (typeof fitShadow === 'function') fitShadow({ w: (spec.lot || {}).w || 30, d: (spec.lot || {}).d || 24 });   // the page fits the sun's shadow box to this lot
    // the material kit compiles the palette: exterior cladding, floor textures the page lacks, and role colours
    // (fabric, wood, cabinet, rug, accent) that theme every prop — seeded by the house id
    const kit = createMaterialKit({ THREE, palette, seed: spec.id });
    kitNow = kit;
    const siteKit = createSiteKit({ THREE, seed: spec.id, std, mix });   // seeded vegetation, beds, hedges, paths
    let propIndex = 0;
    const propCtx = (it, H) => ({ THREE, std, box, group, mix, hex, colors: kit.colors, rng: kit.itemRng(`${it.type}:${propIndex++}`), H });   // registry props (assets/props/)
    anchors.kit = { colors: kit.colors, cladding: kit.cladding().userData.cladding };
    const floorTex = name => textures[name === 'oak' ? 'oak' : name] || kit.floorTexture(name) || textures.oak;
    const placed = [];
    // shotsFor(spec, anchors) probes the built scene round the Core (assets/core-orbit.ts); non-enumerable, so
    // anything that serialises anchors (build-house-plan.mts) never walks the scene graph
    Object.defineProperty(anchors, 'placed', { value: placed, enumerable: false });
    const graphs = {};   // level id → { graph, compiled } when useGraphWalls
    // `role` is one word for what a thing IS — ground, floor, structure, item, site, hero. The QA gate used to
    // sort the scene with a twenty-term regex over display names, which missed anything a builder renamed and
    // caught anything whose label happened to contain "arch". Walls, roofs and ceilings carry their own flags
    // and the page derives their role from those.
    const put = (fn: any, x?: any, z?: any, y?: any, name?: any, role?: any) => { const o = addItemToScene(fn, x, z, y); if (name) o.name = name; if (role) o.userData.role = role; placed.push(o); return o; };

    // ---- ground (pools are cut out of the lot slab: their basins sit in the ground, top flush with it)
    const lot = spec.lot || { w: 30, d: 24, ground: 'lawn' };
    // gmat: the textured lawn / sand / litter in world metres. gcol stays a COLOUR — the mean albedo of that
    // surface — for anything that has to blend into the lot as a flat material (the world's ground disc).
    const gmat = kit.surface(lot.ground || 'lawn');
    const gcol = kit.surfaceColor(lot.ground || 'lawn') ?? GROUND_COLORS[lot.ground] ?? GROUND_COLORS.lawn;
    const water = (spec.site || []).map(waterRect).filter(Boolean);
    const lotRect = { x: -lot.w / 2, z: -lot.d / 2, w: lot.w, d: lot.d };
    const lotHoles = water.filter(r => !r.ellipse && overlaps(lotRect, r));
    // The ground storey's outline is punched out of the lawn (the pool mechanism): its floor slab's top face and
    // the lawn's were both at y = 0 and z-fought under the house. Courtyards inside that outline get their lawn back.
    const groundLoops = (spec.levels || []).filter(l => (l.y || 0) <= 0.001 && Array.isArray(l.footprint) && l.footprint.length).map(l => outlineLoops(perimeterEdges(l.footprint)));
    const lotPolys = groundLoops.flatMap(l => [l.outer, ...l.holes]).filter(l => l.length >= 4);
    const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    const courtyards = lotPolys.filter(l => lotPolys.some(o => o !== l && inPoly(l[0][0], l[0][1], o)));
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

    // ---- levels
    const levelById = Object.fromEntries((spec.levels || []).map(l => [l.id, l]));
    for (const lv of spec.levels || []) {
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
          const ceil = new THREE.Mesh(new THREE.ShapeGeometry(shape), std(0xf1f5f9, { side: THREE.DoubleSide }));
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
          const openings = mine.map(op => ({ ...openingToParam(op, H, isEntry(op)), offset: localOffset(e.side, op.at, mid) }));
          // is the wall's local +x end an outside corner? (beyond that end, on both sides of the wall line, is
          // outside the footprint) — the wall fills and trims that corner (createParametricWall)
          const dx = { S: [1, 0], N: [-1, 0], E: [0, -1], W: [0, 1] }[e.side], nv = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[e.side];
          const pe = e.a[0] * dx[0] + e.a[1] * dx[1] > e.b[0] * dx[0] + e.b[1] * dx[1] ? e.a : e.b;
          const outerCorner = [1, -1].every(k => { const px = pe[0] + dx[0] * 0.05 + k * nv[0] * 0.05, pz = pe[1] + dx[1] * 0.05 + k * nv[1] * 0.05; return !lv.footprint.some(r => px > r.x && px < r.x + r.w && pz > r.z && pz < r.z + r.d); });
          const w = put(() => ProceduralArchitecture.createParametricWall({
            length: e.length, height: H, wallColor: interior, trimColor, baseboardColor: mix(interior, 0xffffff, 0.5),
            orientation: SIDE_ORI[e.side], openings, cladding: kit.cladding(), exteriorColor: wallColor, outerCorner
          }), cx, cz, y);
          w.rotation.y = SIDE_ROT[e.side];
          registerTrackedWall(w, SIDE_ORI[e.side], H, 0.85);
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
            length: len, height: p.height || H - 0.1, wallColor: hex(p.color || interior), trimColor, doorOffset: door, doorWidth: p.doorW || 0.9
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
        // top-of-stairs position: run along the ascent direction (rot 0 → +Z)
        const run = st.type === 'spiral' ? 0 : (st.run || 3.36);
        const dir = [Math.sin((st.rot || 0) * DEG), Math.cos((st.rot || 0) * DEG)];
        anchors.stairs.push({ from: lv.id, to: st.to, bottom: [st.at[0], y, st.at[1]], top: [st.at[0] + dir[0] * run, y + total, st.at[1] + dir[1] * run], dir });
      }

      // balustrades
      for (const bl of lv.balustrades || []) {
        const alongX = Math.abs(bl.from[1] - bl.to[1]) < 1e-6;
        const len = Math.abs(alongX ? bl.to[0] - bl.from[0] : bl.to[1] - bl.from[1]);
        const cx = (bl.from[0] + bl.to[0]) / 2, cz = (bl.from[1] + bl.to[1]) / 2;
        const g = put(() => bl.style === 'colonial' ? ProceduralArchitecture.createColonialBalustrade(len, 0.95, y) : ProceduralArchitecture.createGlassBalustrade(len, 1.0, y), cx, cz, y, null, 'structure');
        if (!alongX) g.rotation.y = Math.PI / 2;
      }

      // rooms + items
      // The hero desk set (desk, chair, monitor, device, speakers) is placed by the hero block below from
      // hero.at/rot; 25 of the 30 specs ALSO list it as room items at the same spot. Skip those, as
      // generate_house_iso.py's draw_rooms does, or the two sets stack back-to-back and the item copy's
      // monitor back sits in front of the real screen.
      // 25 specs also list the desk set as room items at hero.at; whatever surface the hero uses, those are
      // the hero set's copy, not extra furniture (a shelf hero with a room-item desk under it is two heroes)
      const heroHere = spec.hero && spec.hero.level === lv.id;
      const HERO_SET = new Set(['walnut-desk', 'task-chair', 'curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers']);
      // The page's own plant builders (the registry marks its plants foliage itself): a splayed leaf's box
      // covers far more than the leaf, so the scene QA's box tests would call every plant near a wall a clash.
      const PAGE_FOLIAGE = new Set(['fiddle-leaf', 'monstera', 'bonsai', 'bamboo', 'cactus-group']);
      for (const room of lv.rooms || []) {
        for (const it of room.items || []) {
          if (heroHere && HERO_SET.has(it.type) && Math.hypot(it.at[0] - spec.hero.at[0], it.at[1] - spec.hero.at[1]) < 1.3) continue;
          const prop = PROPS.get(it.type);
          const fn = ITEMS[it.type] || (prop && (p => prop.create(p, propCtx(it, H)))); if (!fn) continue;
          const yy = y + ((ON_SURFACE.has(it.type) || (prop && prop.surface)) ? (it.y ?? DESK_TOP) : (it.y ?? (prop && prop.mountY) ?? 0));   // mountY: a wall-mounted prop's default height
          const o = put(() => fn(it, { H, y, palette }), it.at[0], it.at[1], yy, null, 'item');
          o.rotation.y = (it.rot || 0) * DEG;   // core-shelf: rot is the wall heading, the plank extends the other way
          o.userData.room = room.name;
          o.userData.itemType = it.type;
          o.userData.onSurface = ON_SURFACE.has(it.type) || !!(prop && prop.surface);
          o.userData.mounted = !!(prop && prop.mountY !== undefined);   // art, sconces, upper cabinets: they live IN the wall plane by design, whatever y they mount at
          o.userData.foliage = !!(prop && prop.foliage) || PAGE_FOLIAGE.has(it.type);
          kit.theme(o, { skip: HERO_SET.has(it.type) || it.type === 'core-shelf' || it.color !== undefined });   // props take the house's role colours; the Core and explicitly coloured items keep theirs
          // anything the door-to-core eye (1.45 m up) could meet is a routing obstacle on this storey — a desk
          // ornament sitting at DESK_TOP + its own height clears 1.1 m easily without blocking anything at floor
          // or eye level, so this reads o.userData.onSurface (registry surface: true included) rather than
          // re-testing the legacy ON_SURFACE set alone, which every registry prop fails by construction.
          o.updateMatrixWorld(true);
          const bb = new THREE.Box3().setFromObject(o);
          if (bb.max.y > y + 1.1 && !o.userData.onSurface) (anchors.solids[lv.id] ||= []).push({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z, top: bb.max.y, type: it.type });
          if (o.userData.coreShelf) {
            const a = o.userData.coreShelf.core.userData.core.anchors(), back = a.back, floor = y + 0.01, topY = yy + o.userData.coreShelf.h;
            put(() => AssetFactory.createCable([a.inlet, a.inlet.clone().add(back.clone().multiplyScalar(0.05)), new THREE.Vector3(a.inlet.x + back.x * 0.08, topY - 0.15, a.inlet.z + back.z * 0.08), new THREE.Vector3(a.inlet.x + back.x * 0.06, floor + 0.2, a.inlet.z + back.z * 0.06), new THREE.Vector3(a.inlet.x + back.x * 0.1, floor, a.inlet.z + back.z * 0.1)], 'power'), 0, 0, 0, 'Shelf Power Cord');
          }
        }
      }
      // ceiling fixtures, pendants, fans and each room's warm light; window glass tagged for the dusk glow (assets/fixtures.ts)
      dressLevel({ THREE, spec, lv, y, H, put, placed, anchors, registerCeiling });
    }

    // ---- hero (Companion Core)
    if (spec.hero) {
      const lv = levelById[spec.hero.level] || spec.levels[0];
      const y = lv ? lv.y : 0; const [hx, hz] = spec.hero.at;
      // Spec convention: hero.rot is the heading the desk BACKS onto — rot 0 puts the monitor/wall side
      // north (-Z) and the user south of it, rot 90 backs onto the west wall, etc. (that is how all 30
      // specs place their desks: `at` hugs a wall and rot names that wall). The asset library's
      // desk/monitor face -Z at rotation 0 with the chair north, so the assets turn 180° from the spec
      // heading; `fwd` — where the user sits and the camera approaches from — then points into the room.
      const rot = ((spec.hero.rot || 0) + 180) * DEG;
      const fwd = [-Math.sin(rot), -Math.cos(rot)];
      const surface = spec.hero.surface || 'desk';
      const side = [fwd[1], -fwd[0]]; // to the right of the desk
      // hero.device: chalk | charcoal (the Companion Core, 232 × 205 × 90 mm) | strix (the AMD reference mini PC).
      // hero.pose: prone (default — as marketed and drawn in the campaign) | upright (stood on its side).
      const pose = spec.hero.pose === 'upright' ? 'upright' : 'prone';
      const devFn = spec.hero.device === 'charcoal' ? () => AssetFactory.createCharcoalTower({ pose }) : spec.hero.device === 'strix' ? () => AssetFactory.createStrixHaloMini() : () => AssetFactory.createChalkTower({ pose });
      let cx = hx + side[0] * 0.55, cz = hz + side[1] * 0.55, dy = DESK_TOP, monitorBase = null;
      if (surface === 'desk') {
        const d = put(() => AssetFactory.createWalnutDesk(), hx, hz, y, 'Hero Desk'); d.rotation.y = rot;
        const ch = put(() => AssetFactory.createTaskChair(), hx + fwd[0] * 0.8, hz + fwd[1] * 0.8, y); ch.rotation.y = rot + Math.PI;
        const mon = put(() => AssetFactory.createCurvedMonitor(), hx - fwd[0] * 0.1, hz - fwd[1] * 0.1, y + DESK_TOP); mon.rotation.y = rot;
        monitorBase = [hx - fwd[0] * 0.1, y + DESK_TOP + 0.02, hz - fwd[1] * 0.1];
      } else if (surface === 'credenza') {
        const c = put(() => AssetFactory.createMediaCredenza(1.8, 0.45), hx, hz, y, 'Hero Credenza'); c.rotation.y = rot;
      } else if (surface === 'island') {
        put(() => AssetFactory.createKitchenIsland(2.4, 0.9), hx, hz, y, 'Hero Island'); dy = 0.92;
      } else if (surface === 'shelf') {
        // headless: a floating shelf on the wall the hero backs onto, the Core on it like a piece of furniture,
        // one power cord down the wall. hero.at is authored as a desk centre 0.4 m off the wall; the shelf's
        // back edge goes where the desk's did.
        // 0.8 m by default — console height, and under the 0.85 m cutaway line, so on a cut wall the shelf
        // still has a wall behind it; hero.shelfHeight raises it where the wall stays full height
        const sx = hx - fwd[0] * 0.4, sz = hz - fwd[1] * 0.4, shelfH = spec.hero.shelfHeight || 0.8;
        const sh = put(() => AssetFactory.createFloatingShelf(0.9, 0.26, shelfH), sx, sz, y, 'Hero Shelf'); sh.rotation.y = rot + Math.PI;   // plank extends local +Z = fwd, into the room
        cx = sx + fwd[0] * 0.13; cz = sz + fwd[1] * 0.13; dy = shelfH;
        // a couple of books to one side, so it reads as a shelf and not a mount
        const books = put(() => { const g = group('Books'); for (const [i, c] of [0x8b5e3c, 0x3f5d73, 0xd9c9a3].entries()) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2 - i * 0.02, 0.15), std(c)); b.position.set(i * 0.032, (0.2 - i * 0.02) / 2, 0); g.add(b); } return g; }, cx - side[0] * 0.3, cz - side[1] * 0.3, y + shelfH); books.rotation.y = rot;
      } else { dy = 0; }
      const dev = put(devFn, cx, cz, y + dy, 'Companion Core (Hero)', 'hero');
      dev.rotation.y = rot;
      // The hero anchor is the DEVICE (what the flythrough frames), not the desk centre. centreY is where the
      // camera should look: the middle of the slab in its pose.
      anchors.hero = { x: cx, y: y + dy, z: cz, deskX: hx, deskZ: hz, level: spec.hero.level, fwd, rot, surface, pose, centreY: y + dy + (pose === 'upright' ? 0.116 : 0.045) };

      // ---- cables: the Core is plugged in. Power from the PSU inlet at the rear, off the back of whatever it
      // sits on and down to the floor; on a desk also a display lead from the I/O plate to the monitor base.
      if (dev.userData.core) {
        const a = dev.userData.core.anchors(); const back = a.back;   // unit vector out of the rear panel
        const floor = y + 0.01, topY = y + dy;
        if (surface === 'shelf') {
          // straight down the wall from the shelf, a slight belly, into a floor socket
          put(() => AssetFactory.createCable([a.inlet, a.inlet.clone().add(back.clone().multiplyScalar(0.05)), new THREE.Vector3(a.inlet.x + back.x * 0.08, topY - 0.15, a.inlet.z + back.z * 0.08), new THREE.Vector3(a.inlet.x + back.x * 0.06, floor + 0.2, a.inlet.z + back.z * 0.06), new THREE.Vector3(a.inlet.x + back.x * 0.1, floor, a.inlet.z + back.z * 0.1)], 'power'), 0, 0, 0, 'Hero Power Cord');
        } else {
          const edge = surface === 'island' ? 0.45 : 0.4;   // distance from the surface centre to its back edge
          const dropX = hx - fwd[0] * (edge + 0.04) + side[0] * 0.3, dropZ = hz - fwd[1] * (edge + 0.04) + side[1] * 0.3;
          put(() => AssetFactory.createCable([a.inlet, a.inlet.clone().add(back.clone().multiplyScalar(0.05)), new THREE.Vector3(a.inlet.x + back.x * 0.12, topY + 0.004, a.inlet.z + back.z * 0.12), new THREE.Vector3((a.inlet.x + dropX) / 2, topY + 0.004, (a.inlet.z + dropZ) / 2), new THREE.Vector3(dropX, topY - 0.02, dropZ), new THREE.Vector3(dropX + back.x * 0.03, topY - 0.35, dropZ + back.z * 0.03), new THREE.Vector3(dropX + back.x * 0.05, floor, dropZ + back.z * 0.05)], 'power'), 0, 0, 0, 'Hero Power Cord');
          if (monitorBase) put(() => AssetFactory.createCable([a.io, a.io.clone().add(back.clone().multiplyScalar(0.04)), new THREE.Vector3((a.io.x + monitorBase[0]) / 2 + back.x * 0.1, topY + 0.003, (a.io.z + monitorBase[2]) / 2 + back.z * 0.1), new THREE.Vector3(monitorBase[0] - fwd[0] * 0.05, monitorBase[1], monitorBase[2] - fwd[1] * 0.05)], 'display'), 0, 0, 0, 'Hero Display Lead');
        }
      }
    }

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
      const ceil = put(() => { const g = group(`Ceiling (${lv.id})`, { category: 'Architecture' }); const m = new THREE.Mesh(geo, std(0xf1f5f9, { side: THREE.DoubleSide, roughness: 0.9 })); m.receiveShadow = true; g.add(m); return g; }, 0, 0, y + H - 0.02);
      if (typeof registerCeiling === 'function') registerCeiling(ceil, y + H - 0.02);
    }

    // ---- roofs (assets/roofs.ts): planned together, since a downspout may land on a lower roof
    for (const r of buildRoofs(spec, { THREE, kit, palette })) {
      const o = put(() => r.group, r.x, r.z, r.y);
      registerRoof(o);
    }

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

    // The preset says what the light is made of; the house says where it stands — the sun swings round
    // from the bearing the entry faces, so the façade the shots open on is the lit one. A spec without a
    // `lighting` still gets its sun aimed; it just keeps the default preset.
    if (setLightingPreset) setLightingPreset(spec.lighting, {
      front: anchors.entry ? anchors.entry.out : [0, 1],
      centre: anchors.bounds ? [(anchors.bounds.minX + anchors.bounds.maxX) / 2, (anchors.bounds.minZ + anchors.bounds.maxZ) / 2] : [0, 0],
    });
    return { anchors, placed, graphs };
  }

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

  function shotsFor(spec, anchors) {
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
      const solidsOn = lv => ((anchors.solids || {})[lv.id] || []).concat(lv === heroLevel ? heroSolids : []);
      // The walls as built, in plan, where they stand at eye height: the jambs of every doorway and the open leaf
      // hung in it (0.8 m of door standing out into the room, which the spec's partition lines know nothing
      // about). The walk keeps WALL_PAD off them; the clip repair below tests the eye against them in 3D.
      const wallMeshes = [];
      for (const o of anchors.placed || []) if (o.userData && o.userData.role === 'wall') { o.updateMatrixWorld(true); o.traverse(m => { if (m.isMesh) { const bb = new THREE.Box3().setFromObject(m); if (!bb.isEmpty()) wallMeshes.push(bb); } }); }
      const wallBoxesOn = lv => wallMeshes.filter(bb => bb.max.y > lv.y + 0.9 && bb.min.y < lv.y + 2.0).map(bb => ({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z }));
      // Route a walk leg, easing off when the storey as furnished leaves no way through: the usual margins plus
      // 0.2 m off the built walls; then tighter margins; then squeezing between the pieces of furniture at eye
      // height (a monitor on a desk included); then walls alone (the eye brushes through furniture — a warning —
      // rather than through a wall, which is what "no route" used to mean: a straight line).
      const routeCache = new Map();
      const eyeItemsOn = lv => (anchors.placed || []).filter(o => o.userData && o.userData.role === 'item').map(o => new THREE.Box3().setFromObject(o))
        .filter(bb => !bb.isEmpty() && bb.max.y > lv.y + 1.0 && bb.min.y < lv.y + 1.9).map(bb => ({ minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z }));
      const TIERS = [{ boxPad: 0.2 }, { wall: 0.3, part: 0.3, item: 0.15, boxPad: 0.15 }, { wall: 0.3, part: 0.3, item: 0.02, boxPad: 0.12, eyeItems: true }, { wall: 0.3, part: 0.3, boxPad: 0.12, bare: true }];
      const routeWalk = (lv, from, to) => {
        const boxes = wallBoxesOn(lv);
        for (const [i, tier] of TIERS.entries()) {
          const solids = tier.bare ? [] : tier.eyeItems ? solidsOn(lv).concat(eyeItemsOn(lv)) : solidsOn(lv);
          const corners = routeOn(lv, solids, from, to, { ...tier, boxes, strict: true, cache: routeCache, key: `${lv.id}:${i}` });
          if (corners) return corners;
        }
        return [];
      };
      // Candidate approaches for one sweep direction `opt`: d degrees on from the orbit's start `from` (d < 0:
      // beyond it, so the push-in spirals in), D metres out — somewhere the walk may stand, that sees the Core, and
      // whose push-in to the orbit is clear. Pushing in from across the Core to an orbit that starts behind it is
      // a whip pan, not a push-in, so the approach stands on the orbit's starting side; where nothing there works
      // the orbit starts later (a shorter sweep, down to 100°), and only failing that is the approach anywhere.
      const blockedHero = fin ? blockedTest(heroLevel, solidsOn(heroLevel)) : null;
      const approachCandidates = opt => {
        const out = [], yA = heroLevel.y + 1.42;
        const tryAt = (sw, ds, relaxed) => {
          const from = sw.from, S = orbitPoint(THREE, fin.centre, hero.fwd, fin.r, from, fin.centre.y + fin.hs[0]);
          for (const d of ds) for (const D of [2.0, 1.7, 1.4]) {
            if (D < fin.r + 0.35) continue;
            const p = orbitPoint(THREE, fin.centre, hero.fwd, D, from + opt.dir * d, yA);
            if (blockedHero(p.x, p.z) || !orbitCtx.probe.free(p.x, p.y, p.z) || !orbitCtx.probe.sees(p.x, p.y, p.z)) continue;
            const n = Math.ceil(p.distanceTo(S) / 0.1);
            let clear = true; for (let i = 1; i < n && clear; i++) { const q = p.clone().lerp(S, i / n); clear = orbitCtx.probe.free(q.x, q.y, q.z); }
            if (clear) out.push({ opt, sw, from, d, p, S, relaxed, arc: sw.arc });
          }
        };
        // the start moves round in 10° steps, the end's overshoot growing to keep the sweep near aWant
        for (let from = opt.from; ; from += opt.dir * 10) {
          const sw = sweepFrom(fin.run, opt.dir, from, fin.sweep);
          if (!sw || sw.arc < Math.min(100, opt.arc) - 1e-6) break;
          tryAt(sw, [-10, 0, 15], false);
        }
        tryAt(opt, [30, 60, 90, 120], true);
        return out;
      };
      // The orbit and the approach the walk from `start` should end at, chosen together over both directions
      // round the Core: the longest sweep (every degree short of 120 counting half again), less 0.3 for every
      // degree the route turns into the push-in (a route
      // that doubles back is a whip pan) and 0.4 for every degree over 90 the push-in turns into the orbit (it
      // hooks back on itself), 30 if its last straight leg is under 1.2 m (it zig-zags round the desk into it),
      // 60 for an approach off the orbit's starting side, 0.15 per degree it stands off the start.
      const chooseApproach = start => {
        if (!fin) return null;
        let best = null;
        for (const opt of fin.options) for (const c of approachCandidates(opt)) {
          const corners = routeWalk(heroLevel, start, c.p);
          const last = corners.length ? corners[corners.length - 1] : [start.x, start.z];
          const lx = c.p.x - last[0], lz = c.p.z - last[1], leg = Math.hypot(lx, lz);
          const px = c.S.x - c.p.x, pz = c.S.z - c.p.z, pl = Math.hypot(px, pz) || 1e-6;
          const turn = leg > 1e-6 ? Math.acos(Math.max(-1, Math.min(1, (lx * px + lz * pz) / (leg * pl)))) / DEG : 0;
          // the orbit's heading as it leaves S: d/dθ of centre + r(cos θ·fwd + sin θ·side), in the sweep's direction
          const a = c.from * DEG, f = hero.fwd, sd = [f[1], -f[0]], tx = c.sw.dir * (-Math.sin(a) * f[0] + Math.cos(a) * sd[0]), tz = c.sw.dir * (-Math.sin(a) * f[1] + Math.cos(a) * sd[1]);
          const entry = Math.acos(Math.max(-1, Math.min(1, (px * tx + pz * tz) / pl))) / DEG;
          const score = Math.min(c.arc, 150) + 0.5 * Math.min(c.arc, 120) - 0.3 * turn - 0.4 * Math.max(0, entry - 90) - (leg < 1.2 ? 30 : 0) - (c.relaxed ? 60 : 0) - 0.15 * Math.abs(c.d);
          if (!best || score > best.score) best = { ...c, score };
        }
        if (!best) return null;
        const { sw } = best;
        fin = { ...fin, dir: sw.dir, from: sw.from, to: sw.to, arc: sw.arc, pts: arcWaypoints(THREE, fin.centre, hero.fwd, fin.r, sw.from, sw.to, fin.hs[0], fin.hs[1]) };
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
          const foot = clearPoint(spiral ? V(bx - u[0] * 1.6, by + 1.5, bz - u[1] * 1.6) : V(bx - u[0] * 1.5, by + 1.5, bz - u[1] * 1.5), levelOf(st.from), 0.6);
          walk(levelOf(st.from), eye[eye.length - 1], foot, V(tx, ty + 0.8, tz));   // door (or the last landing) → stair foot, through the rooms between
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
            // landing → desk approach through the upper rooms; a straight leg keeps the old blend point
            const to = [after.x - landing.x, after.z - landing.z], dist = Math.hypot(to[0], to[1]);
            approach = chooseApproach(landing) || fallbackApproach();
            if (!walk(levelOf(st.to), landing, approach, V(hero.x, hero.y + 0.3, hero.z)) && dist > 3.5) { eye.push(clearPoint(V(landing.x + to[0] / dist * 1.6, ty + 1.45, landing.z + to[1] / dist * 1.6), levelOf(st.to), 0.7)); tgt.push(after); }
          }
        });
      } else if (!walk(heroLevel, eye[inDoor], approach = chooseApproach(eye[inDoor]) || fallbackApproach(), V(hero.x, hero.y + 0.3, hero.z))) {
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
      // as built and the furniture (the QA gate's boxes: anything standing over 0.25 m) and, wherever it enters
      // one, add a waypoint on the chord there — the curve then hugs the (clear) chord. A few passes; the
      // orbit, vetted by its own probe, is left alone.
      {
        const hash = new Map(), cellKey = (i, j) => i * 100003 + j;
        const solidsNow = wallMeshes.concat((anchors.placed || []).filter(o => o.userData && o.userData.role === 'item').map(o => new THREE.Box3().setFromObject(o))
          .filter(bb => { if (bb.isEmpty()) return false; const sz = bb.getSize(new THREE.Vector3()); return sz.y > 0.25 && sz.x < 8 && sz.z < 8; }));
        solidsNow.forEach((bb, n) => { for (let i = Math.floor(bb.min.x); i <= Math.floor(bb.max.x); i++) for (let j = Math.floor(bb.min.z); j <= Math.floor(bb.max.z); j++) { const k = cellKey(i, j); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(n); } });
        const inWall = p => (hash.get(cellKey(Math.floor(p.x), Math.floor(p.z))) || []).some(n => solidsNow[n].containsPoint(p));
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
      const shot: Record<string, any> = { type: 'door-to-core', dressing: { walls: 'up', roof: 'auto' }, name: `${spec.emoji || '🏠'} ${spec.name}: Front Door → Companion Core`, duration: 12, closed: false, eyePoints: eye, targetPoints: tgt, clearance: clearanceMoves };
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
        // Timing (assets/shot-path.ts): the orbit gets a third of the shot at 25–40°/s, the push-in a second or
        // so, the travel the rest — the fly-in and the street approach at 2.2× and 1.5× the indoor pace, the
        // doorway and the stairs a little under it — and the shot moves from its first frame. A leg over which
        // the look swings round (the turn just inside a door, the foot of a stair) is given at least the time a
        // TURN°/s pan takes, and the straight legs make it up.
        const DUR = shot.duration;
        const knots = knotArcLengths(new THREE.CatmullRomCurve3(eye, false, 'centripetal'), eye.length);
        const len = k => Math.max(1e-3, knots[k + 1] - knots[k]);
        const w = clamp(fin.arc / (0.33 * DUR), 25, 40), fo = fin.arc / (w * DUR);
        const fp = clamp(len(iA) / 1.2 / DUR, 0.05, 0.1), ft = 1 - fo - fp;
        const PACE = { fly: 2.2, street: 1.5, door: 0.8, stair: 0.85 };
        const cost = []; for (let k = 0; k < iA; k++) cost.push(len(k) / (PACE[kind[k + 1]] ?? 1));   // the segment arriving at eye[k + 1]
        const TURN = 110, secs = ft * DUR, heads = [];
        for (let k = 0; k <= iA; k++) { const h = Math.atan2(tgt[k].x - eye[k].x, tgt[k].z - eye[k].z); heads.push(k ? heads[k - 1] + Math.atan2(Math.sin(h - heads[k - 1]), Math.cos(h - heads[k - 1])) : h); }
        const need = cost.map((_, k) => Math.abs(heads[k + 1] - heads[k]) / DEG / TURN);
        const pinned = new Set<number>();
        let tau = cost.slice();
        for (let pass = 0; pass < 12; pass++) {
          const pinnedSecs = [...pinned].reduce((a, k) => a + need[k], 0), freeCost = cost.reduce((a, c, k) => a + (pinned.has(k) ? 0 : c), 0);
          if (pinnedSecs >= secs || freeCost <= 0) { const sum = need.reduce((a, c) => a + c, 0) || 1; tau = need.map(nd => secs * nd / sum); break; }
          tau = cost.map((c, k) => (pinned.has(k) ? need[k] : (secs - pinnedSecs) * c / freeCost));
          const more = tau.map((t, k) => (!pinned.has(k) && t < need[k] ? k : -1)).filter(k => k >= 0);
          if (!more.length) break;
          more.forEach(k => pinned.add(k));
        }
        const times = [0];
        for (let k = 0; k < iA; k++) times.push(times[k] + tau[k] / DUR);
        times[iA] = ft;
        const m = fin.pts.length - 1;
        for (let i = 0; i <= m; i++) times.push(ft + fp + fo * i / m);
        times[times.length - 1] = 1;
        shot.timing = { times: times.map(t => +t.toFixed(5)), startSpeed: 0.5, endSpeed: 1, stats: { travel: +(knots[iA] - knots[0]).toFixed(1), indoorSpeed: +((knots[iA] - knots[lastDoor]) / ((ft - times[lastDoor]) * DUR)).toFixed(2), orbitDegPerSec: +w.toFixed(1), approachDeg: +heroAngle(approach).toFixed(0) } };
        shot.compose = { subject, ndcX: -fin.dir * 0.26, fov: 40, weights: eye.map((_, k) => (k >= iA ? 1 : 0)) };
        shot.orbit = orbitMeta(fin, ft + fp);
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

  // One prop on its own, themed by a palette (the prop sheet, the catalog builder): registry props and the
  // page's ITEMS alike
  function buildProp(type, params = {}, palette = {}, seed = 'sheet') {
    const kit = createMaterialKit({ THREE, palette, seed });
    const it = { type, at: [0, 0], ...params };
    const prop = PROPS.get(type);
    const ctx = { THREE, std, box, group, mix, hex, colors: kit.colors, rng: kit.itemRng(type) };
    const o = prop ? prop.create(it, ctx) : ITEMS[type] ? ITEMS[type](it, { H: 2.8, y: 0, palette }) : null;
    if (o && !prop) kit.theme(o, { skip: HERO_SET_PUBLIC.has(type) });
    return o;
  }
  const HERO_SET_PUBLIC = new Set(['walnut-desk', 'task-chair', 'curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers', 'core-shelf']);
  return { build, shotsFor, buildProp, ITEMS, SITE, PROPS };
}
