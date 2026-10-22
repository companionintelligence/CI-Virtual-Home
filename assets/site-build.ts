// The site — the lot's ground (pools and the ground storey cut out of it), the world round it, the page's site
// builders (pools, decks, patios, porches, fences …) and the site loop, which hands the seeded planting types to
// the site kit (assets/site.ts) and records their resolved instances (anchors.siteInstances → <id>.plan.json).
//
// Seam module (plan S0): moved verbatim out of house-builder.ts. Owner: S4 (site).
//
// Pass 4 (S4) adds, every one of them behind a field a spec has to ask for (a house that uses none builds exactly
// as before): terraces the ground follows (A3), shaped pools and basins with coping, rills, decks raised on posts
// or none with rails per side, fences and garden walls in a style at any angle or along a path, gazebo colours, the
// open pergola (`cabana` is the old one), steps that honour `h` / `d` and climb a terrace, the exterior `stair`,
// every outdoor registry prop as a site item, and — for every house — anchors.siteSolids (what stands on the lot,
// for the shot planner) and anchors.siteEdges (the outlines as built, for the fleet metrics).
//
// The validator lists the site types by calling createSiteBuild with a PROBE context (scripts/probe-context.mts: every
// property of it is a callable stand-in), so the factory may build at factory scope, but nothing it needs at import
// time may come from the real page; scripts/test-builder-seams.mts checks SITE_KIT_TYPES (site.ts) against the kit's
// build() cases.
import { perimeterEdges, outlineLoops, rectCentre } from './house-geometry.js';
import { createSiteKit } from './site.js';
import { buildWorld } from './world.js';
import { DEG, hex, mix } from './build-context.js';
import { createSiteStructures } from './site-structures.js';
import { waterOutline, isShapedWater, createSiteContext } from './site-planting.js';
import { type P2, offsetLoop, rectPoly, turn, inPoly as inPolyG, bbox as bboxG, halfPlane, centroid, resample, lengthOf, tensionOf, smoothLine, dist } from './site-geom.js';
import { worldUV } from './textures.js';
import { PROPS } from './props/index.js';
import { OUTDOOR_TYPES } from './props/outdoor.js';
import { defaultsAtLeast } from './spec/index.js';

// The site types buildSite() builds itself, beside SITE's and the site kit's (the validator reads all three lists)
export const SITE_LOOP_TYPES: readonly string[] = ['fence', 'wall-low', 'terrace', 'stair', 'rill', 'channel', ...OUTDOOR_TYPES];

const GROUND_COLORS = { lawn: 0x384a2c, desert: 0xc5ae88, forest: 0x3b4a2c, urban: 0x9c9b97, waterfront: 0x384a2c };   // restrained fallbacks; gcol is the kit surface's mean

export function createSiteBuild(bctx) {
  const { THREE, AssetFactory, ProceduralArchitecture, textures, std, box, group } = bctx;
  let kitNow = null;   // the current build's material kit (assets/materials.ts), for the site builders below
  const waterMat = () => new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.8, roughness: 0.15, metalness: 0.1 });
  // build() hands each house's kit over before anything below is built
  let surfCache = new Map();
  const setKit = kit => { kitNow = kit; surfCache = new Map(); };

  // ---- the site materials S4's builders ask for by name: the kit's own surfaces where it has one, and the kit's
  // texture library tinted and mapped in world metres (as materials.ts's pbr() does) for the rest. Made on first ask,
  // one per name and colour per house, so a house that asks for none makes none.
  function siteMat(name, color = null) {
    if (!kitNow) return null;
    const key = name + ':' + color;
    if (surfCache.has(key)) return surfCache.get(key);
    const lib = kitNow.textures;
    const pbr = (kind, opts, { mode = 'plan', macro = 0 } = {}) => {
      const set = lib && lib.set(kind, opts); if (!set) return null;
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: set.metalness, normalScale: new THREE.Vector2(set.normalScale, set.normalScale) });
      worldUV(THREE, m, { period: set.period, mode, macro, macroMean: set.mean }); m.userData.surface = kind; return m;
    };
    const c = color == null ? null : hex(color);
    let m = null;
    switch (name) {
      case 'water': m = kitNow.water(); break;
      case 'lawn': m = kitNow.surface('lawn'); break;
      case 'litter': m = kitNow.surface('forest'); break;
      case 'meadow': m = pbr('lawn', { color: c ?? 0x6a7446, dry: 0x8a8150, deep: 0x4f5e36 }, { macro: 0.3 }); break;
      case 'gravel': m = pbr('sand', { color: c ?? 0xa39b8c }, { macro: 0.2 }); break;
      case 'concrete': m = c == null ? kitNow.surface('patio') : pbr('concrete', { exterior: true, period: 2.4, joints: 1.2, color: c }); break;
      case 'steps': m = c == null ? kitNow.surface('steps') : pbr('concrete', { exterior: true, period: 1.5, joints: 0, color: c }, { mode: 'auto' }); break;
      case 'brick': m = pbr('brick', { color: c ?? 0x8e5a48 }, { mode: 'auto' }); break;
      case 'terracotta': m = pbr('tile', { color: c ?? 0xb06a4c, size: 0.3, groutColor: 0x9c8f80 }); break;
      case 'stone': m = pbr('stone', { color: c ?? 0x9d968a }, { mode: 'auto' }); break;
      case 'stucco': case 'render': m = pbr('stucco', { color: c ?? 0xe8e4dc }, { mode: 'auto' }); break;
      case 'timber': m = pbr('timber', { color: c ?? 0x7a5a40 }, { mode: 'auto' }); break;
      case 'decking': case 'deck': m = kitNow.floor('deck'); break;
      case 'sand': case 'desert': m = kitNow.surface('desert'); break;
      default: m = null;
    }
    surfCache.set(key, m);
    return m;
  }
  const ST = createSiteStructures({ THREE, std, box, group, ProceduralArchitecture, mat: (n, c) => siteMat(n, c) });

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
    if (!['pool', 'turtle-pool', 'pond'].includes(s.type) || !Array.isArray(s.at) || isShapedWater(s)) return null;   // (shaped water: buildGround)
    const rot90 = Math.round(((s.rot || 0) % 180) / 90) === 1;
    const w0 = s.w || (s.type === 'turtle-pool' ? 8 : s.type === 'pond' ? 4 : 6), d0 = s.d || (s.type === 'turtle-pool' ? 6 : s.type === 'pond' ? 3 : 4);
    const w = rot90 ? d0 : w0, d = rot90 ? w0 : d0;
    return { x: s.at[0] - w / 2, z: s.at[1] - d / 2, w, d, ellipse: s.type === 'pond', floor: (s.y ?? 0) - (s.type === 'turtle-pool' ? 0.79 : 0) };
  };
  // a slab, a deck or the lawn cut round water stands 1.5 cm clear of the pool's wall: a hole face on the wall's own
  // plane z-fights it (tan deck boards showing through the tile)
  const JOINT = 0.015;
  // Every patio has one top (0.08) and every driveway another (0.06), so two of a kind that overlap, a patio laid on a patio, on a roof, or round a
  // stoop shared a plane and flickered. The site list's order breaks the tie: each ground slab gets a private copy of its material with a depth bias,
  // one step stronger than the slab before it, so the later slab wins. A bias is a draw state: lifting the slab by its index (0.6 mm) pushed
  // patios over 0.08 into the world digest as walkable boxes (plan.json shots.world and the bake locks' worldSha are mm-rounded boxes).
  const biasSlab = (o: any, rank: number) => o.traverse((m: any) => {
    if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
    const src = m.material, c = src.clone();
    if (src.onBeforeCompile) c.onBeforeCompile = src.onBeforeCompile;
    if (Object.prototype.hasOwnProperty.call(src, 'customProgramCacheKey')) c.customProgramCacheKey = src.customProgramCacheKey;
    c.polygonOffset = true; c.polygonOffsetFactor = 0; c.polygonOffsetUnits = -4 - 3 * rank;
    m.material = c;
  });
  const isGroundSlab = (q: any) => q && (q.type === 'patio' || q.type === 'driveway');
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.z < b.z + b.d && a.z + a.d > b.z;
  function slabWithHoles(rect, holes, color, h, y = 0, polys = []) {
    const g = group('Slab');
    const [cx, cz] = rectCentre(rect);
    const shape = new THREE.Shape([[-rect.w / 2, -rect.d / 2], [rect.w / 2, -rect.d / 2], [rect.w / 2, rect.d / 2], [-rect.w / 2, rect.d / 2]].map(p => new THREE.Vector2(p[0], p[1])));
    for (const poly of polys) shape.holes.push(new THREE.Path(poly.map(p => new THREE.Vector2(p[0] - cx, p[1] - cz))));   // building outlines
    for (const hl of holes) {
      const path = new THREE.Path();
      if (hl.poly) path.setFromPoints(offsetLoop(hl.poly, JOINT).map(p => new THREE.Vector2(p[0] - cx, p[1] - cz)));   // a shaped pool (S4), 1.5 cm clear of its wall
      else if (hl.ellipse) path.absellipse(hl.x + hl.w / 2 - cx, hl.z + hl.d / 2 - cz, hl.w / 2 + 0.3, hl.d / 2 + 0.3, 0, Math.PI * 2, false);
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
    'pool':        s => AssetFactory.createPoolSlab(s.w || 6, s.d || 4),   // (a pool with a shape, poly or coping: buildSite's water)
    'turtle-pool': s => AssetFactory.createTurtleMosaicPool(s.w || 8, s.d || 6),
    'pond':        s => pond(s.w || 4, s.d || 3),
    'hottub':      s => hotTub(s.r || 1.1),
    'deck':        s => deck(s.w || 4, s.d || 3, s.h || 0.12),
    'patio':       (s, water) => groundSlab(s, kitNow ? kitNow.surface('patio') : 0xd6d3d1, 0.08, water),
    'driveway':    (s, water) => groundSlab(s, kitNow ? kitNow.surface('driveway') : 0xa8a29e, 0.06, water),
    'turf':        s => AssetFactory.createTurfPitch(s.w || 6, s.d || 4),
    'porch':       s => deckBoards(AssetFactory.createColonnadePorch(s.w || 6, s.d || 2.5)),
    'cabana':      s => AssetFactory.createCabanaLounge(s.w || 4, s.d || 3),   // the curtained cabana `pergola` used to build; `pergola` is the kit's open frame now
    'gazebo':      s => paintGazebo(AssetFactory.createWaterfrontGazebo(s.r || 2.2, s.h || 3.2), s),
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

  // `color` roofs a gazebo (it was always slate #334155) and `trim` paints its columns and rails (white)
  function paintGazebo(g, s) {
    if (s.color === undefined && s.trim === undefined) return g;
    g.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.color) return;
      const c = o.material.color.getHex();
      if (c === 0x334155 && s.color !== undefined) { o.material = o.material.clone(); o.material.color.setHex(hex(s.color)); }
      else if (c === 0xf8fafc && s.trim !== undefined) { o.material = o.material.clone(); o.material.color.setHex(hex(s.trim)); }
    });
    return g;
  }

  // the site kit for one build
  function siteKitFor(spec) {
    // seeded vegetation, beds, hedges, paths; a bed keeps its plants clear of the ground storey's walls
    const groundRects = (spec.levels || []).filter(l => (l.y || 0) <= 0.001 && Array.isArray(l.footprint)).flatMap(l => l.footprint);
    const siteKit = createSiteKit({ THREE, seed: spec.id, std, mix, keepOut: groundRects, spec, surface: siteMat, gen2: defaultsAtLeast(spec, 2) });
    return siteKit;
  }

  // The lot's ground and the world round it; returns the water bodies (pools, ponds) the site loop's patios and
  // driveways cut round.
  function buildGround({ spec, kit, put }) {
    // ---- ground (pools are cut out of the lot slab: their basins sit in the ground, top flush with it)
    const lot = spec.lot || { w: 30, d: 24, ground: 'lawn' };
    // gmat: the textured lawn / sand / litter in world metres. gcol stays a COLOUR — the mean albedo of that
    // surface — for anything that has to blend into the lot as a flat material (the world's ground disc).
    // (S4's grounds: `meadow` a longer, drier grass; `gravel` a gravel lot — the kit has no surface for either)
    const own = lot.ground === 'meadow' || lot.ground === 'gravel';
    const gmat = own ? siteMat(lot.ground) : kit.surface(lot.ground || 'lawn');
    const gcol = own ? (lot.ground === 'meadow' ? 0x606a42 : 0x9b9385) : kit.surfaceColor(lot.ground || 'lawn') ?? GROUND_COLORS[lot.ground] ?? GROUND_COLORS.lawn;
    const water = (spec.site || []).map(waterRect).filter(Boolean);
    // shaped water (S4: pools with a shape or coping, basins, rills) — cut out of the lawn by its outline
    const ctx = createSiteContext(spec);
    const shaped = (spec.site || []).map((s, i) => waterOutline(s, i, spec.id, ctx.groundAt)).filter(Boolean);
    for (const w of shaped) { const b = bboxG(w.poly); water.push({ x: b.x0, z: b.z0, w: b.x1 - b.x0, d: b.z1 - b.z0, poly: w.poly, floor: w.rim - w.depth, rim: w.rim }); }
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
    // (a shaped pool raised on a plinth or set a step up still digs into the ground when its floor is below it — its tile
    // floor and walls would otherwise be a lawn under the water)
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
    // (lot.water — S4: water on any side, a river's far bank — is the world's to draw; this is the old lake edge)
    if (lot.ground === 'waterfront' && lot.water === undefined) put(() => { const g = slab(lot.w + 30, 12, 0x0ea5e9, 0.04, -0.09); g.name = 'Water'; return g; }, 0, -lot.d / 2 - 6, 0, null, 'ground');
    // ---- world: the street on the entry side, 2–4 neighbours, a tree line, ground to the horizon — all outside the
    // lot and clear of the shots' camera paths (assets/world.ts); its ground is the lot's own (colour or kit material)
    put(() => buildWorld({ THREE, spec, std, kit, ground: gcol, water: siteMat }), 0, 0, 0, null, 'ground');   // gcol: a colour, or a kit surface
    return water;
  }


  // ---- solids: what stands on the lot, for the shot planner's nav and QA (plan S4 contract; S5 reads them) ----------
  // { kind, x, z, r | w, d, rot (degrees, as a spec's), yMin, yMax } — trunks and crowns, posts, fences and walls,
  // hedges, structures, water (kind 'water': no eye goes through it), terraces (their `poly`) and their retaining faces.
  const r3 = v => +(+v).toFixed(3);
  const boxOf = o => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };
  function solidBox(kind, o) {
    const b = boxOf(o); if (b.isEmpty()) return null;
    return { kind, x: r3((b.min.x + b.max.x) / 2), z: r3((b.min.z + b.max.z) / 2), w: r3(b.max.x - b.min.x), d: r3(b.max.z - b.min.z), rot: 0, yMin: r3(b.min.y), yMax: r3(b.max.y) };
  }
  // a tree group: its trunk, and its crown (everything else)
  function treeSolids(t, out) {
    t.updateMatrixWorld(true);
    const trunk = new THREE.Box3(), crown = new THREE.Box3();
    t.traverse(m => { if (!m.isMesh) return; const bb = m.isInstancedMesh ? (m.computeBoundingBox(), m.boundingBox.clone().applyMatrix4(m.matrixWorld)) : new THREE.Box3().setFromObject(m); (m.name === 'Trunk' ? trunk : crown).union(bb); });
    if (!trunk.isEmpty()) out.push({ kind: 'trunk', x: r3((trunk.min.x + trunk.max.x) / 2), z: r3((trunk.min.z + trunk.max.z) / 2), r: r3(Math.max(0.12, (trunk.max.x - trunk.min.x + trunk.max.z - trunk.min.z) / 4)), yMin: r3(trunk.min.y), yMax: r3(trunk.max.y) });
    if (!crown.isEmpty()) out.push({ kind: 'crown', x: r3((crown.min.x + crown.max.x) / 2), z: r3((crown.min.z + crown.max.z) / 2), r: r3((crown.max.x - crown.min.x + crown.max.z - crown.min.z) / 4), yMin: r3(crown.min.y), yMax: r3(crown.max.y) });
  }
  // solids a builder recorded in its own frame (userData.solids), placed with its group
  function localSolids(o, out) {
    const list = o.userData && o.userData.solids; if (!list) return;
    o.updateMatrixWorld(true);
    const e = o.matrixWorld.elements, ry = Math.atan2(-e[8], e[0]) * 180 / Math.PI;   // the group's turn about y
    for (const q of list) {
      if (q.poly) { out.push({ ...q }); continue; }
      const p = new THREE.Vector3(q.x, 0, q.z).applyMatrix4(o.matrixWorld);
      out.push({ ...q, x: r3(p.x), z: r3(p.z), ...(q.w !== undefined ? { rot: r3((q.rot || 0) + ry) } : {}), yMin: r3(q.yMin + o.position.y), yMax: r3(q.yMax + o.position.y) });
    }
  }
  const TREE_TYPES = new Set(['tree', 'cypress', 'palm']);
  const STRUCTURE_SOLIDS = { gazebo: 'structure', greenhouse: 'structure', cabana: 'structure', porch: 'structure', car: 'car', monkeybars: 'play', 'soccer-goal': 'play', firepit: 'furniture', loungers: 'furniture', bench: 'furniture', planter: 'planter', cactus: 'plant', 'garden-beds': 'planter', hottub: 'water', pool: 'water', 'turtle-pool': 'water', pond: 'water', deck: 'deck', steps: 'stair', bridge: 'deck', turf: null, patio: null, driveway: null };

  function buildSite({ spec, kit, siteKit, put, anchors, water }) {
    // ---- site
    const site = spec.site || [], ctx = siteKit.context();
    anchors0 = anchors; siteKitNow = siteKit;
    // the ground follows the terraces (A3): what stands on one stands on it. With no terrace everything stands at its
    // own `y` or 0, exactly as before.
    const terraced = site.some(s => s.type === 'terrace');
    const groundAt = (x, z) => (terraced ? ctx.groundAt(x, z) : 0);
    const solids = anchors.siteSolids = [], edges = anchors.siteEdges = [];
    const rep = s => (Array.isArray(s.at) ? s.at : Array.isArray(s.poly) && s.poly.length ? centroid(s.poly) : Array.isArray(s.path) && s.path.length ? s.path[Math.floor(s.path.length / 2)] : Array.isArray(s.from) ? s.from : [0, 0]);
    const rot3 = (pts, rotDeg) => turn(pts, rotDeg);
    const buildItem = (s, si) => {
      // the site kit's types (tree, shrub, flowers, rock, bed, path, hedge, scatter, grove, planting …) — seeded per item
      const own = siteKit.build(s, si);
      if (own) {
        const anchored = siteKit.anchored(s.type, s);
        // an anchored item carries its world coordinates (a planting its plants' own heights); a bed, path or hedge on a
        // terrace is lifted onto it
        const lift = s.y ?? (anchored ? (['bed', 'path', 'pond'].includes(s.type) ? groundAt(...(rep(s) as [number, number])) : 0) : groundAt(s.at[0], s.at[1]));   // (a hedge's runs follow the ground each their own way — the kit sets their heights)
        const o = put(() => own, anchored ? 0 : s.at[0], anchored ? 0 : s.at[1], lift, null, 'site');
        if (!anchored) o.rotation.y = (s.rot || 0) * DEG + o.rotation.y;
        o.userData.category = 'Site'; o.userData.siteType = s.type;
        // resolved instances for the isometric twin (scripts/build-house-plan.mts → <id>.plan.json): one entry
        // per mesh with its world box, shape and colour — the Python generator draws these instead of porting
        // the seeded builders
        o.updateMatrixWorld(true);
        if (o.userData.isoParts) {
          // a generator's own list (a planting: its beds as polygons and one box per plant)
          for (const q of o.userData.isoParts) (anchors.siteInstances ||= []).push({ site: si, type: s.type, ...q });
        } else {
          // (an InstancedMesh contributes the box round all its instances; the kit marks parts to skip with
          // userData.iso = false and names a shape its geometry type does not say with userData.isoShape)
          o.traverse(m => {
            if (!m.isMesh || m.userData.iso === false) return;
            const bb = m.isInstancedMesh ? (m.computeBoundingBox(), m.boundingBox) : (m.geometry.computeBoundingBox(), m.geometry.boundingBox), b = bb.clone().applyMatrix4(m.matrixWorld);
            const gt = m.geometry.type, shape = m.userData.isoShape || (/Icosahedron|Sphere|Dodecahedron/.test(gt) ? 'blob' : /Cone/.test(gt) ? 'cone' : /Cylinder/.test(gt) ? 'cyl' : 'box');
            const mat = Array.isArray(m.material) ? m.material[0] : m.material;
            (anchors.siteInstances ||= []).push({ site: si, type: s.type, part: m.parent && m.parent.name || '', shape, color: '#' + (mat && mat.color ? mat.color.getHexString() : '888888'), box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(v => +v.toFixed(3)) });
          });
        }
        // solids and edges
        if (TREE_TYPES.has(s.type)) treeSolids(o, solids);
        else if (s.type === 'grove' || s.type === 'scatter' || s.type === 'planting') o.children.filter(c => /^(Tree|Cypress|Palm)/.test(c.name)).forEach(t => treeSolids(t, solids));
        if (s.type === 'shrub' || s.type === 'cypress') { const b = solidBox('plant', o); if (b && b.yMax - b.yMin > 1.1 && s.type === 'shrub') solids.push(b); }
        if (s.type === 'hedge') {
          const tt = tensionOf(s.smooth), pts = tt === null ? s.path || [] : smoothLine(s.path || [], tt, 0.9), w = s.w || 0.6, h = s.h || 1.0;
          for (let k = 0; k < pts.length - 1; k++) { const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1e-6) continue; solids.push({ kind: 'hedge', x: r3((ax + bx) / 2), z: r3((az + bz) / 2), w: r3(L + w * 0.6), d: w, rot: r3(-Math.atan2(bz - az, bx - ax) * 180 / Math.PI), yMin: r3(s.y ?? groundAt((ax + bx) / 2, (az + bz) / 2)), yMax: r3((s.y ?? groundAt((ax + bx) / 2, (az + bz) / 2)) + h) }); }
        }
        if (s.type === 'planting' && o.userData.plan) for (const b of o.userData.plan.beds) edges.push({ site: si, type: 'planting', closed: true, pts: b.poly.map(p => [r3(p[0]), r3(p[1])]), wall: b.wall });
        if (s.type === 'planting') o.traverse(m => { if (m.isInstancedMesh && /^Plants/.test(m.name)) { /* tall plants in a bed: kind 'plant' */ const tmp = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); for (let k = 0; k < m.count; k++) { m.getMatrixAt(k, tmp); tmp.decompose(pos, q, sc); if (sc.y > 1.1) solids.push({ kind: 'plant', x: r3(pos.x), z: r3(pos.z), r: r3(sc.x), yMin: r3(pos.y), yMax: r3(pos.y + sc.y) }); } } });
        if (s.type === 'bed') { const t = tensionOf(s.smooth), p0 = s.poly || [[s.at[0] - s.w / 2, s.at[1] - s.d / 2], [s.at[0] + s.w / 2, s.at[1] - s.d / 2], [s.at[0] + s.w / 2, s.at[1] + s.d / 2], [s.at[0] - s.w / 2, s.at[1] + s.d / 2]]; edges.push({ site: si, type: 'bed', closed: true, pts: (t === null ? p0 : ctx.terracePoly({ poly: p0, smooth: s.smooth })).map(p => [r3(p[0]), r3(p[1])]) }); }
        // (a `path` raised off the ground — a timber line on a facade, at its own `y` — is a trim, not a garden path: the
        // fleet's axis-aligned metric leaves it out)
        if (s.type === 'path' && !(s.y > 0.3)) edges.push({ site: si, type: 'path', closed: false, pts: ctx.pathLine(s).map(p => [r3(p[0]), r3(p[1])]) });
        localSolids(o, solids);
        return;
      }
      if (s.type === 'fence' || s.type === 'wall-low') {
        const diag = Array.isArray(s.from) && Array.isArray(s.to) && Math.abs(s.from[0] - s.to[0]) > 1e-6 && Math.abs(s.from[1] - s.to[1]) > 1e-6;
        const legacy = !s.path && !diag && s.y === undefined && s.color === undefined && !terraced && (s.type === 'fence' ? (s.style === undefined || s.style === 'picket' || s.style === 'privacy') : s.surface === undefined && s.cap === undefined);
        if (legacy) {
          const alongX = Math.abs(s.from[1] - s.to[1]) < 1e-6;
          const len = Math.abs(alongX ? s.to[0] - s.from[0] : s.to[1] - s.from[1]);
          const cx = (s.from[0] + s.to[0]) / 2, cz = (s.from[1] + s.to[1]) / 2;
          const o = put(() => s.type === 'fence' ? (s.style === 'privacy' ? ProceduralArchitecture.createPrivacyFence(len, s.h || 1.8) : picketFence(len, s.h || 1.0)) : AssetFactory.createLowPartitionWall(len, s.h || 0.6), cx, cz, 0, null, 'site');
          if (!alongX) o.rotation.y = Math.PI / 2;
          if (s.color === undefined) kit.mute(o);
          const b = solidBox(s.type === 'fence' ? 'fence' : 'wall', o); if (b) solids.push(b);
          return;
        }
        // S4: a style and a colour, at any angle, along a path (curved when `smooth`), at a `y`
        const tt = tensionOf(s.smooth), raw = Array.isArray(s.path) ? s.path : [s.from, s.to];
        const line = tt === null ? raw : smoothLine(raw, tt, 1.2);
        const g = group(s.type === 'fence' ? `Fence (${s.style || 'picket'})` : `Garden wall (${s.surface || 'stucco'})`); g.userData.category = 'Site';
        // a bend of the polyline is closed by running each of its two runs past the vertex by (t / 2)·tan(θ / 2), θ the turn
        // (a right angle: half the thickness, the notch on the outer corner); a smoothed line's small turns add almost nothing
        const thick = s.type === 'fence' ? ({ 'stone-wall': 0.45, privacy: 0.1, 'post-rail': 0.12, picket: 0.05 }[s.style || 'picket'] ?? 0.06) : s.t || 0.25;
        const joint = (k: number) => {
          if (k <= 0 || k >= line.length - 1) return 0;
          const p = line[k - 1], q = line[k], r = line[k + 1], a1 = Math.atan2(q[1] - p[1], q[0] - p[0]), a2 = Math.atan2(r[1] - q[1], r[0] - q[0]);
          let d = Math.abs(a2 - a1); d = d > Math.PI ? 2 * Math.PI - d : d;
          return d < 0.02 || d > 2.6 ? 0 : (thick / 2) * Math.tan(d / 2);
        };
        for (let k = 0; k < line.length - 1; k++) {
          const a = line[k], b = line[k + 1], y = s.y ?? groundAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), extA = joint(k), extB = joint(k + 1);
          solids.push(...(s.type === 'fence' ? ST.fenceRun(g, a, b, { style: s.style || 'picket', h: s.h ?? null, color: s.color ?? null, y, extA, extB }) : ST.wallRun(g, a, b, { h: s.h || 0.6, t: s.t || 0.25, surface: s.surface || 'stucco', color: s.color ?? null, cap: s.cap ?? null, y, extA, extB })));
        }
        const o = put(() => g, 0, 0, 0, null, 'site');
        if (s.color === undefined && s.type === 'fence' && (s.style || 'picket') !== 'stone-wall') kit.mute(o);
        return;
      }
      if (s.type === 'terrace') { buildTerrace(s, si, { spec, ctx, put, solids, kit }); return; }
      if (s.type === 'stair' && Array.isArray(s.from) && Array.isArray(s.to)) {
        const from = [s.from[0], s.from[1], s.from[2] ?? groundAt(s.from[0], s.from[1])], to = [s.to[0], s.to[1], s.to[2] ?? groundAt(s.to[0], s.to[1])];
        const g = ST.stair(from, to, { w: s.w || 1.2, style: s.style || 'stone', color: s.color ?? null, rail: s.rail ?? null, landing: s.landing !== false });
        const o = put(() => g, 0, 0, 0, null, 'site'); o.userData.category = 'Site'; localSolids(o, solids);
        return;
      }
      if (isShapedWater(s)) { buildWater(s, si, { spec, ctx, put, solids, siteKit }); return; }
      if (OUTDOOR_TYPES.includes(s.type) && Array.isArray(s.at)) {
        // an outdoor registry prop as a site item: built as a room item is (role colours, its own seeded stream)
        const prop = PROPS.get(s.type);
        const pctx = { THREE, std, box, group, mix, hex, colors: kit.colors, rng: kit.itemRng(`site:${s.type}:${si}`), H: 2.6 };
        const o = put(() => prop.create(s, pctx), s.at[0], s.at[1], s.y ?? groundAt(s.at[0], s.at[1]), null, 'site');
        o.rotation.y = (s.rot || 0) * DEG; o.userData.category = 'Site'; o.userData.siteType = s.type;
        if (s.color === undefined) kit.theme(o);
        const b = solidBox((prop.height || 0) > 1.1 ? 'structure' : 'furniture', o); if (b) solids.push(b);
        return;
      }
      if ((s.type === 'patio' || s.type === 'driveway') && (s.poly !== undefined || s.surface !== undefined || s.color !== undefined || s.smooth !== undefined)) { buildSlab(s, si, { put, water, groundAt, rank: site.slice(0, si).filter(isGroundSlab).length }); return; }
      if (s.type === 'deck' && newDeck(s, water)) { buildDeck(s, si, { put, water, solids, groundAt }); return; }
      if (s.type === 'steps' && newSteps(s, terraced, groundAt)) { buildSteps(s, si, { put, solids, groundAt }); return; }
      const fn = SITE[s.type];
      if (!fn) { (anchors.siteDropped ||= []).push({ site: si, type: s.type }); return; }   // never silently: the scene QA reports it
      const o = put(() => fn(s, water), s.at[0], s.at[1], s.y ?? groundAt(s.at[0], s.at[1]), null, 'site');
      if (isGroundSlab(s)) biasSlab(o, site.slice(0, si).filter(isGroundSlab).length);
      o.rotation.y = (s.rot || 0) * DEG;
      if (s.type === 'cypress' || s.type === 'palm') siteKit.vary(o, s, si);   // seeded scale / lean / spin
      if (s.type !== 'car' && s.color === undefined) kit.mute(o);   // restrained palette: no orange porch decks, no cyan basins
      o.userData.category = 'Site';
      if (s.type === 'cypress' || s.type === 'palm') treeSolids(o, solids);
      else if (STRUCTURE_SOLIDS[s.type]) {
        // the item's box in its own frame (unturned), then turned with it: the box round the turned mesh is not the item's
        // width and depth (a car turned 90° is 4.2 long in z, and the box round it says 4.2 in x)
        const ry = o.rotation.y; o.rotation.y = 0;
        const b = solidBox(STRUCTURE_SOLIDS[s.type], o);
        o.rotation.y = ry;
        if (b) {
          if (s.rot) { const [c] = turn([[b.x - s.at[0], b.z - s.at[1]]], s.rot); b.x = r3(s.at[0] + c[0]); b.z = r3(s.at[1] + c[1]); b.rot = s.rot; }
          solids.push(b);
        }
      }
    };
    // every solid a site item records names it (`site`: its index in spec.site), for whoever has to find the item behind one
    site.forEach((s, si) => { const n0 = solids.length; buildItem(s, si); for (let k = n0; k < solids.length; k++) solids[k].site = si; });
  }

  // ---- patios and driveways (S4): any outline (`poly`, curved when `smooth`), a surface and a colour, cut round water -
  function buildSlab(s, si, { put, water, groundAt, rank = 0 }) {
    const t = tensionOf(s.smooth), raw: P2[] = Array.isArray(s.poly) && s.poly.length >= 3 ? s.poly : rectPoly(s.at, s.w || 4, s.d || 3, s.rot || 0);
    const outline = t === null ? raw : ctxFor0(s);
    const h = s.type === 'patio' ? 0.08 : 0.06, c = centroid(outline), y = s.y ?? groundAt(c[0], c[1]);
    const mat = siteMat(s.surface || (s.type === 'patio' ? 'concrete' : 'concrete'), s.color ?? (s.type === 'driveway' && !s.surface ? 0xa2a19d : null)) || std(s.color !== undefined ? hex(s.color) : 0xd6d3d1, { roughness: 0.95 });
    // water it covers (its rim at or under the slab's top), cut out wherever the whole outline is inside the slab
    const holes = [];
    for (const r of water || []) {
      const rim = r.rim ?? r.floor ?? 0; if (rim > y + h + 0.02) continue;
      const poly = r.poly || (r.ellipse ? Array.from({ length: 32 }, (_, k) => { const a = k / 32 * Math.PI * 2; return [r.x + r.w / 2 + Math.cos(a) * (r.w / 2 + 0.3), r.z + r.d / 2 + Math.sin(a) * (r.d / 2 + 0.3)] as P2; }) : [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]] as P2[]);
      if (poly.every(p => inPolyG(p[0], p[1], outline))) holes.push(r.ellipse ? poly : offsetLoop(poly, JOINT));
    }
    const g = group(s.type === 'patio' ? 'Patio' : 'Driveway');
    const shape = new THREE.Shape(outline.map(p => new THREE.Vector2(p[0], p[1])));
    for (const hl of holes) shape.holes.push(new THREE.Path(hl.map(p => new THREE.Vector2(p[0], p[1]))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4 }); geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.position.y = y + h; m.receiveShadow = true; g.add(m);
    const o = put(() => g, 0, 0, 0, null, 'site'); o.userData.category = 'Site'; o.userData.siteType = s.type;
    biasSlab(o, rank);
    const b = bboxG(outline);
    (anchors0.siteInstances ||= []).push({ site: si, type: s.type, part: 'slab', shape: 'poly', poly: outline.map(p => [r3(p[0]), r3(p[1])]), color: '#' + (m.material.color ? m.material.color.getHexString() : 'cccccc'), box: [b.x0, y, b.z0, b.x1, y + h, b.z1].map(r3) });
  }
  const ctxFor0 = s => siteKitNow.context().terracePoly({ poly: s.poly || rectPoly(s.at, s.w || 4, s.d || 3, s.rot || 0), smooth: s.smooth });

  // ---- decks (S4): raised on posts to the ground or none, rails per side in a style, holes for the water in them ---
  const newDeck = (s, water) => s.posts !== undefined || s.rails !== undefined || s.railStyle !== undefined || s.railColor !== undefined || s.color !== undefined || deckHoles(s, water).length > 0;
  function deckHoles(s, water) {
    if (!Array.isArray(s.at)) return [];
    const w = s.w || 4, d = s.d || 3, h = s.h || 0.12, top = (s.y ?? 0) + h, rot = s.rot || 0;
    const mine = rectPoly(s.at, w, d, rot), mb = bboxG(mine), out = [];
    for (const r of water || []) {
      // only water the deck would bury: its rim at or under the deck's top, and a real overlap (not an edge touching)
      const rim = r.rim ?? (r.floor !== undefined ? (r.floor + (r.poly ? 0 : 0)) : 0);
      if (rim > top + 0.02 || r.ellipse) continue;
      if (r.x + r.w <= mb.x0 + 0.01 || r.x >= mb.x1 - 0.01 || r.z + r.d <= mb.z0 + 0.01 || r.z >= mb.z1 - 0.01) continue;
      const poly = offsetLoop(r.poly || [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]], JOINT);
      // into the deck's frame, clipped 2 cm inside its edges (a hole touching the outline is garbage to earcut)
      let local = turn(poly.map(p => [p[0] - s.at[0], p[1] - s.at[1]] as P2), -rot);
      for (const [nx, nz, c] of [[1, 0, w / 2 - 0.02], [-1, 0, w / 2 - 0.02], [0, 1, d / 2 - 0.02], [0, -1, d / 2 - 0.02]] as Array<[number, number, number]>) local = halfPlane(local, nx, nz, c);
      if (local.length >= 3 && Math.abs(local.reduce((a, p, i) => { const q = local[(i + 1) % local.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2 > 0.05) out.push(local);
    }
    return out;
  }
  function buildDeck(s, si, { put, water, solids, groundAt }) {
    const w = s.w || 4, d = s.d || 3, h = s.h || 0.12, y = s.y ?? groundAt(s.at[0], s.at[1]);
    const raised = h > 0.35;
    const boards = kitNow ? kitNow.floor('deck', { rotation: w >= d ? Math.PI / 2 : 0, ...(s.color !== undefined ? { color: s.color } : {}) }) : std(s.color !== undefined ? hex(s.color) : 0x8b5e34);
    // posts: true — to the ground under it; false — none (a deck cantilevered off the house, a roof deck); unset — the
    // old rule (a raised deck stands on posts to its own `y`)
    const ground = groundAt(s.at[0], s.at[1]), t = Math.min(0.15, h);
    const postsDown = s.posts === false ? 0 : s.posts === true || s.posts === 'ground' ? Math.max(0, y + h - t - ground) : raised ? h - t : 0;
    const rs = s.rails, sides = rs === 'none' || rs === false ? [] : rs === 'all' ? ['N', 'S', 'E', 'W'] : Array.isArray(rs) ? rs : rs && Array.isArray(rs.sides) ? rs.sides : rs === undefined && raised ? ['S', 'E'] : [];
    const style = (rs && typeof rs === 'object' && !Array.isArray(rs) && rs.style) || s.railStyle || 'colonial';
    const color = (rs && typeof rs === 'object' && !Array.isArray(rs) && rs.color) || s.railColor || null;
    const g = ST.deck(w, d, h, boards, { postsDown, sides, railStyle: style, railColor: color, holes: deckHoles(s, water) });
    const o = put(() => g, s.at[0], s.at[1], y, null, 'site'); o.rotation.y = (s.rot || 0) * DEG; o.userData.category = 'Site';
    solids.push({ kind: 'deck', x: r3(s.at[0]), z: r3(s.at[1]), w, d, rot: s.rot || 0, yMin: r3(y + h - t - postsDown), yMax: r3(y + h) });
  }
  // ---- steps (S4): `h` (the rise; the count follows at ~0.17 m risers), `d` (the run), a rail, a style; and on a
  // terraced lot a flight with no `h` climbs to the terrace its top reaches --------------------------------------------
  // (where the ground rises in front of a flight: the run to where it steps up, and how far. Null when it does not within 8 m)
  const stepsRise = (s, groundAt) => {
    const rot = s.rot || 0, [dir] = turn([[0, -1]], rot), at = s.at, base = s.y ?? groundAt(at[0] - dir[0] * 0.4, at[1] - dir[1] * 0.4), g0 = groundAt(at[0], at[1]);
    for (let k = 1; k <= 160; k++) { const q = k * 0.05, gy = groundAt(at[0] + dir[0] * q, at[1] + dir[1] * q); if (gy > g0 + 0.05) return { D: q, h: gy - base, base, dir }; }
    return null;
  };
  // a terraced lot turns a plain `steps { n }` into a climbing flight only where the ground does rise in front of it; every other
  // flight there is the old one, its `n` honoured
  const newSteps = (s, terraced, groundAt) => s.h !== undefined || s.d !== undefined || s.rail !== undefined || s.style !== undefined || s.color !== undefined || (terraced && stepsRise(s, groundAt) !== null);
  function buildSteps(s, si, { put, solids, groundAt }) {
    const rot = s.rot || 0, [dir] = turn([[0, -1]], rot), at = s.at;
    const base = s.y ?? groundAt(at[0] - dir[0] * 0.4, at[1] - dir[1] * 0.4);
    let h = s.h, run = s.d, n = 0;
    if (h === undefined) {
      // march up the flight's line to where the ground steps up (a terrace's edge): its rise, and the run to it
      const rise = stepsRise(s, groundAt);
      if (rise) { h = rise.h; n = s.n ?? Math.max(1, Math.round(h / 0.17)); run = run ?? Math.max(rise.D + 0.16, n * 0.28); }
      else { h = (s.n || 3) * 0.16; run = run ?? (s.n || 3) * 0.32; n = s.n || 3; }
    } else n = s.n ?? Math.max(1, Math.round(h / 0.17));
    const tread = (run ?? n * 0.32) / n;
    const m = siteMat(s.style === 'timber' ? 'decking' : s.style === 'brick' ? 'brick' : s.style === 'stone' ? 'stone' : 'steps', s.color ?? null) || std(s.color !== undefined ? hex(s.color) : 0x9ca3af);
    const g = ST.flight(s.w || 1.6, h, n, tread, m, { rails: s.rail ? { style: typeof s.rail === 'string' ? s.rail : s.rail.style || 'metal', color: typeof s.rail === 'object' ? s.rail.color : null } : null });
    const o = put(() => g, at[0], at[1], base, null, 'site'); o.rotation.y = rot * DEG; o.userData.category = 'Site';
    const [c] = turn([[0, -(n * tread) / 2 + 0.16]], rot);
    solids.push({ kind: 'stair', x: r3(at[0] + c[0]), z: r3(at[1] + c[1]), w: s.w || 1.6, d: r3(n * tread), rot, yMin: r3(base), yMax: r3(base + h) });
  }
  // ---- shaped water (S4): a pool in a shape with coping, a formal basin (island, jets), a rill -------------------------
  function buildWater(s, si, { spec, ctx, put, solids, siteKit }) {
    const W = waterOutline(s, si, spec.id, ctx.groundAt); if (!W) return;
    const g = ST.basin(W.poly, W.rim, W.depth, { water: siteMat('water') || std(0x184b57, { roughness: 0.1 }), dark: W.dark, coping: s.coping, tile: s.tile ?? null, copingDefault: s.type === 'rill' ? { w: 0.18, color: 0xcfc9bd } : { w: W.shape === 'basin' ? 0.45 : 0.35, color: 0xd9d4c8 } });
    g.name = s.type === 'pool' ? `Pool (${W.shape})` : s.type === 'rill' ? 'Rill' : 'Channel';
    if (W.shape === 'lap') {
      // lane lines on the floor, along the pool
      const c = centroid(W.poly), L = (s.w || 12) - 1, dd = s.d || 2.5, lm = std(0x1f3b44, { roughness: 0.6 });
      for (const off of [-dd / 4, dd / 4]) { const [[ox, oz]] = turn([[0, off]], s.rot || 0); const ln = box(L, 0.01, 0.12, lm, c[0] + ox, W.rim - W.depth + 0.006, c[1] + oz, false); ln.rotation.y = (s.rot || 0) * DEG; g.add(ln); }
    }
    if (W.shape === 'basin' && s.island) {
      // the island: a coped plinth standing out of the water, planted (a clipped ball, or lavender, or a tree)
      const c = Array.isArray(s.island.at) ? s.island.at : centroid(W.poly), iw = s.island.w || 1.4, id = s.island.d || iw, ih = s.island.h ?? 0.35;
      const plinth = box(iw, W.depth + ih, id, siteMat('stone', s.island.color ?? 0xcfc9bd) || std(0xcfc9bd), c[0], W.rim - W.depth + (W.depth + ih) / 2, c[1]); plinth.rotation.y = (s.rot || 0) * DEG; g.add(plinth);
      const sp = s.island.plants || 'topiary-ball';
      const plan = sp === 'tree' ? [{ sp: 'olive', x: c[0], z: c[1], y: W.rim + ih, h: 3.2, r: 1.3, rot: 0, tint: 1, bloom: null, layer: 'tree' }]
        : [{ sp, x: c[0], z: c[1], y: W.rim + ih, h: sp === 'lavender' ? 0.6 : 0.9, r: Math.min(iw, id) * 0.4, rot: 0, tint: 1, bloom: null, layer: 'mid' }];
      siteKit.drawPlants(g, plan, siteKit.rngFor(s, si), (c2, o2) => std(c2, o2), 0);
    }
    if (W.shape === 'basin' && s.fountains) {
      // jets on the basin's long axis, evenly spaced (clear of the island)
      const n = typeof s.fountains === 'number' ? s.fountains : 2, b = bboxG(W.poly), c = centroid(W.poly), along = b.x1 - b.x0 >= b.z1 - b.z0;
      const L = (along ? b.x1 - b.x0 : b.z1 - b.z0) * 0.7, pts: P2[] = [];
      for (let k = 0; k < n; k++) { const t = n === 1 ? 0 : -L / 2 + L * k / (n - 1); if (s.island && Math.abs(t) < 1) continue; pts.push(along ? [c[0] + t, c[1]] : [c[0], c[1] + t]); }
      ST.jets(g, pts, W.rim, s.jetH || 0.9);
    }
    const o = put(() => g, 0, 0, 0, null, 'site'); o.userData.category = 'Site'; o.userData.siteType = s.type;
    const b = bboxG(W.poly);
    solids.push({ kind: 'water', poly: W.poly.map(p => [r3(p[0]), r3(p[1])]), x: r3((b.x0 + b.x1) / 2), z: r3((b.z0 + b.z1) / 2), w: r3(b.x1 - b.x0), d: r3(b.z1 - b.z0), rot: 0, yMin: r3(W.rim - W.depth), yMax: r3(W.rim) });
    (anchors0.siteInstances ||= []).push({ site: si, type: s.type, part: 'water', shape: 'poly', poly: W.poly.map(p => [r3(p[0]), r3(p[1])]), color: '#2c6f86', box: [b.x0, W.rim - 0.06, b.z0, b.x1, W.rim, b.z1].map(r3) });
  }
  let anchors0: any = {};
  // ---- terraces (A3) --------------------------------------------------------------------------------------------------
  function buildTerrace(s, si, { spec, ctx, put, solids, kit }) {
    const poly = ctx.terracePoly(s); if (poly.length < 3 || typeof s.y !== 'number') return;
    if (!(s.y > 0.02)) { (anchors0.siteDropped ||= []).push({ site: si, type: 'terrace' }); return; }   // (a sunken court is not built: the validator refuses it)
    const lower = (spec.site || []).filter(o => o !== s && o.type === 'terrace' && typeof o.y === 'number' && o.y < s.y);
    // the ground it stands on at a point: the highest lower terrace under it, else the lot. One terrace can stand partly on
    // another and partly on the ground, so this is asked corner by corner
    const baseAt = (p: P2) => lower.reduce((y, o) => (o.y > y && inPolyG(p[0], p[1], ctx.terracePoly(o)) ? o.y : y), 0);
    const lot = spec.lot || {}, gname = { desert: 'desert', forest: 'litter', urban: 'concrete', meadow: 'meadow', gravel: 'gravel' }[lot.ground] || 'lawn';
    const top = siteMat(s.surface === 'decking' ? 'decking' : s.surface || gname, s.color ?? null) || std(0x4e6a3a);
    // a storey standing on it at its height: the plateau drops a centimetre so the floor slab wins
    const sink = (spec.levels || []).some(l => Math.abs((l.y || 0) - s.y) < 0.03 && (l.footprint || []).some(r => inPolyG(r.x + r.w / 2, r.z + r.d / 2, poly))) ? 0.01 : 0;
    // edges along a storey that stands on (or against) it are the house's wall: no retaining face, rail or bank there. Judged
    // piece by piece — an edge that runs along the house for part of its length has its rail and bank for the rest
    const houseRects = (spec.levels || []).filter(l => (l.y || 0) <= s.y + 0.05).flatMap(l => (l.footprint || []).map(r => ({ x0: r.x - 0.25, x1: r.x + r.w + 0.25, z0: r.z - 0.25, z1: r.z + r.d + 0.25 })));
    const atHouse = (p: P2) => houseRects.some(r => p[0] > r.x0 && p[0] < r.x1 && p[1] > r.z0 && p[1] < r.z1);
    const pieces = (a: P2, b: P2): Array<[number, number]> => {
      // the fractions of a → b outside every house rect (each clipped by slab: Liang–Barsky), pieces under 0.2 m dropped
      let cuts: Array<[number, number]> = [];
      for (const r of houseRects) {
        let t0 = 0, t1 = 1; const dx = b[0] - a[0], dz = b[1] - a[1];
        for (const [pp, qq] of [[-dx, a[0] - r.x0], [dx, r.x1 - a[0]], [-dz, a[1] - r.z0], [dz, r.z1 - a[1]]] as Array<[number, number]>) {
          if (Math.abs(pp) < 1e-12) { if (qq < 0) { t0 = 1; t1 = 0; break; } continue; }
          const t = qq / pp; if (pp < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
        }
        if (t0 < t1) cuts.push([t0, t1]);
      }
      cuts.sort((p, q) => p[0] - q[0]);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, keep: Array<[number, number]> = []; let at = 0;
      for (const [c0, c1] of cuts) { if (c0 > at) keep.push([at, c0]); at = Math.max(at, c1); }
      if (at < 1) keep.push([at, 1]);
      return keep.filter(([t0, t1]) => (t1 - t0) * L >= 0.2);
    };
    const edge = typeof s.edge === 'object' && s.edge ? s.edge : { kind: typeof s.edge === 'string' ? s.edge : 'retaining' };
    // the water dug into it: shaped water whose rim is at or above its top and whose floor is below it, and old slab pools set
    // at its height (2 cm inside it)
    const holes = [];
    (spec.site || []).forEach((o, oi) => {
      const w = waterOutline(o, oi, spec.id, ctx.groundAt);
      const outline = w ? (s.y > w.rim - w.depth + 0.05 && s.y <= w.rim + 0.06 ? w.poly : null)
        : (o.type === 'pool' || o.type === 'turtle-pool') && Array.isArray(o.at) && Math.abs((o.y ?? ctx.groundAt(o.at[0], o.at[1])) - s.y) < 0.06 ? rectPoly(o.at, o.w || (o.type === 'turtle-pool' ? 8 : 6), o.d || (o.type === 'turtle-pool' ? 6 : 4), o.rot || 0) : null;
      if (outline && outline.every(p => inPolyG(p[0], p[1], poly)) && offsetLoop(outline, 0.02).every(p => inPolyG(p[0], p[1], poly))) holes.push(offsetLoop(outline, JOINT));
    });
    const g = ST.terrace(poly, s.y, baseAt, { edge, top, sink, pieces, holes });
    const base = g.userData.base, baseV = g.userData.baseV;
    g.name = `Terrace (${edge.kind || 'retaining'}, ${s.y} m)`;
    if (edge.kind === 'planted' && g.userData.bank) {
      // plant the bank: groundcover, low shrubs and grasses across the slope, their heights following it
      const rng = siteKitNow.rngFor(s, si), outer = g.userData.bank.outer, ring = resample([...poly, poly[0]], 0.55, false), oring = resample([...outer, outer[0]], 0.55 * lengthOf([...outer, outer[0]]) / lengthOf([...poly, poly[0]]), false);
      const n = Math.min(ring.length, oring.length), plants = [], mixList = edge.mix === 'desert' ? ['succulent', 'agave', 'grass'] : ['groundcover', 'spreading', 'grass', 'lavender', 'groundcover'];
      // (the ground under the bank at a point of the ring: interpolated from the corners' — the lowest of them, for the top of the slope)
      const lowAt = (k: number) => { let m = Infinity, bi = 0; for (let i = 0; i < poly.length; i++) { const d = (ring[k][0] - poly[i][0]) ** 2 + (ring[k][1] - poly[i][1]) ** 2; if (d < m) { m = d; bi = i; } } return baseV ? baseV[bi] : base; };
      for (let k = 0; k < n; k++) {
        if (atHouse([(ring[k][0] + ring[(k + 1) % n][0]) / 2, (ring[k][1] + ring[(k + 1) % n][1]) / 2])) continue;
        const lo = lowAt(k);
        for (let q = 0; q < 2; q++) {
          const f = 0.15 + rng() * 0.7, x = ring[k][0] + (oring[k][0] - ring[k][0]) * f, z = ring[k][1] + (oring[k][1] - ring[k][1]) * f, sp = mixList[Math.floor(rng() * mixList.length)];
          plants.push({ sp, x, z, y: s.y - (s.y - lo) * f - 0.05, h: sp === 'spreading' ? 0.8 : 0.4 + rng() * 0.3, r: sp === 'spreading' ? 0.6 : 0.32 + rng() * 0.1, rot: rng() * 6.28, tint: 0.9 + rng() * 0.2, bloom: 0x8f7cb8, layer: 'front' });
        }
      }
      siteKitNow.drawPlants(g, plants, rng, (c2, o2) => std(c2, o2), 0);
    }
    const o = put(() => g, 0, 0, 0, null, 'site'); o.userData.category = 'Site'; o.userData.siteType = 'terrace';
    localSolids(o, solids);
    const b = bboxG(poly);
    (anchors0.siteInstances ||= []).push({ site: si, type: 'terrace', part: 'plateau', shape: 'poly', poly: poly.map(p => [r3(p[0]), r3(p[1])]), color: '#6f8a55', box: [b.x0, base, b.z0, b.x1, s.y, b.z1].map(r3) });
  }
  let siteKitNow: any = null;

  return { SITE, setKit, siteKitFor, buildGround, buildSite };
}
