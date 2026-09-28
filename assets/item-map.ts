// The item map — spec item `type` → the page's AssetFactory builder (plus DESK_TOP and the on-surface set the
// rooms loop and the hero read). Registry props (assets/props/) are looked up after this map, by the rooms loop.
//
// Seam module (plan S0): moved verbatim out of house-builder.ts. Owner: S1 (kit). The page builders' honoured
// parameters are published to the catalog from here (ITEM_PARAMS: S3's build-prop-catalog.mts reads it), and the
// types a Core can stand on (SURFACE_TYPES: hero.surface, the validator's heroSurfaces).
import { hex } from './build-context.js';

// What each page builder honours, param → the defaults generation from which it does. 1: honoured whatever the spec
// says. 2: only under `"defaults": 2` — a `color` on a builder that used to ignore it (and switch theming off for
// the whole item: the "white" sectional that rendered slate), which kit-build.ts themeItem now paints on the part
// the builder marks (material.userData.colorParam) while the item's other roles take the house's theme. Every item
// also takes `type`, `at`, `rot` and `y`. scripts/validate/kit.mts warns on anything else (a silent parameter).
export const ITEM_PARAMS: Record<string, Record<string, 1 | 2>> = {
  'sectional': { w: 1, handed: 1, color: 2 },
  'club-chair': { color: 1 },
  'coffee-table': { w: 1, d: 1, color: 2 },
  'octagonal-table': {},
  'dining-set': { w: 1, d: 1 },
  'dining-table': { w: 1, d: 1, chairs: 1, color: 2 },
  'kitchen-island': { w: 1, d: 1, color: 1, stools: 1 },
  'kitchen-cabinetry': { w: 1, d: 1, h: 1, counter: 1, uppers: 1, sink: 1, cooktop: 1, color: 2 },
  'media-credenza': { w: 1, d: 1, turntable: 1, color: 2 },
  'wall-tv': { w: 1, h: 1, color: 2 },
  'fireplace': { style: 1, w: 1, color: 2 },
  'area-rug': { w: 1, d: 1, color: 1 },
  'circular-rug': { r: 1, color: 1 },
  'concentric-rug': { r: 1 },
  'sun-lounger': {},
  'bench': { w: 1, h: 1, d: 1, color: 2 },
  'platform-bed': { w: 1, d: 1, color: 1 },
  'wardrobe': { w: 1, h: 1, d: 1, color: 2 },
  'crib': { color: 1 },
  'ensuite': { w: 1, d: 1 },
  'bookshelf': { w: 1, h: 1, d: 1, color: 2 },
  'walnut-desk': {}, 'task-chair': {}, 'curved-monitor': {}, 'speakers': {}, 'strix-mini': {}, 'halo-lamp': {},
  'chalk-tower': { pose: 1 }, 'charcoal-tower': { pose: 1 },
  'core-shelf': { finish: 1, pose: 1, h: 1, w: 1 },
  'fiddle-leaf': {}, 'monstera': {}, 'bonsai': {}, 'bamboo': {}, 'cactus-group': {}, 'telescope': {}, 'soccer-goal': {},
  'low-wall': { w: 1, h: 1, color: 2 },
  'column': { h: 1, r: 1, size: 1, style: 1, color: 1 },
};
/** the style / enum values a page builder takes (scripts/validate/kit.mts: unknown style values) */
export const ITEM_ENUMS: Record<string, Record<string, readonly (string | number)[]>> = {
  'fireplace': { style: ['modern', 'mantel', 'stone', 'painted-brick', 'tv-breast'] },
  'sectional': { handed: ['left', 'right'] },
  'dining-table': { chairs: [0, 2, 4, 6, 8] },
  'kitchen-cabinetry': { uppers: ['shelf', 'solid', 'glass', 'none'] },
  'column': { style: ['modern', 'colonial', 'steel'] },
  'core-shelf': { finish: ['chalk', 'charcoal'], pose: ['prone', 'upright'] },
};

// The types a Companion Core can stand on (hero.surface names one, or an alias below), each with a flat top the
// hero block finds by casting down onto the built piece — so the Core's y is the piece's real top, whatever it is.
export const SURFACE_TYPES: readonly string[] = [
  'walnut-desk', 'media-credenza', 'kitchen-island', 'kitchen-cabinetry', 'dining-table', 'coffee-table',
  'console-table', 'counter-run', 'sideboard', 'dresser', 'side-table', 'nightstand', 'writing-desk', 'farmhouse-table',
  'round-dining-table', 'breakfast-bar', 'low-bookshelf', 'chest', 'bar-table', 'bistro-table', 'standing-desk',
];
/** hero.surface's own words → the type it builds ('desk' and 'shelf' are the hero block's own sets) */
export const SURFACE_ALIASES: Record<string, string> = { credenza: 'media-credenza', island: 'kitchen-island', console: 'console-table', counter: 'counter-run' };
export const HERO_SURFACES: readonly string[] = ['desk', 'shelf', 'none', ...Object.keys(SURFACE_ALIASES), ...SURFACE_TYPES];

// The hero desk set: the Companion Core's own pieces. The rooms loop skips a room-item copy of them at hero.at (the
// hero block places the real set), and theming leaves them their own colours (kit-build.ts themeItem, buildProp).
export const HERO_SET: ReadonlySet<string> = new Set(['walnut-desk', 'task-chair', 'curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers']);

export function createItemMap(bctx) {
  const { THREE, AssetFactory, ProceduralArchitecture, std, group } = bctx;

  // ---------------------------------------------------------------------------------------
  // Item catalog: spec item type → AssetFactory builder
  // ---------------------------------------------------------------------------------------
  const ITEMS = {
    'sectional':        it => AssetFactory.createModularSectional({ w: it.w, handed: it.handed }),
    'club-chair':       it => AssetFactory.createClubChair(it.color ? hex(it.color) : undefined),
    'coffee-table':     it => AssetFactory.createCoffeeTable(it.w, it.d),
    'octagonal-table':  it => AssetFactory.createOctagonalLatticeCoffeeTable(),
    'dining-set':       it => AssetFactory.createDiningSet(it.w, it.d),
    'dining-table':     it => AssetFactory.createDiningTable(it.w, it.d, { chairs: it.chairs }),
    'kitchen-island':   it => AssetFactory.createKitchenIsland(it.w, it.d, it.color ? hex(it.color) : undefined, { stools: it.stools }),
    'kitchen-cabinetry': it => AssetFactory.createKitchenCabinetry(it.w || 3.6, it.h || 0.9, it.d || 0.65, { counter: it.counter ? hex(it.counter) : undefined, uppers: it.uppers, sink: it.sink, cooktop: it.cooktop }),
    'media-credenza':   it => AssetFactory.createMediaCredenza(it.w, it.d, { turntable: it.turntable }),
    'wall-tv':          it => AssetFactory.createWallTV(it.w, it.h),
    'fireplace':        it => AssetFactory.createFireplace({ style: it.style, w: it.w }),
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

  return { ITEMS, DESK_TOP, ON_SURFACE };
}
