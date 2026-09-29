// The item map — spec item `type` → the page's AssetFactory builder (plus DESK_TOP and the on-surface set the
// rooms loop and the hero read). Registry props (assets/props/) are looked up after this map, by the rooms loop.
//
// Seam module (plan S0): moved verbatim out of house-builder.ts. Owner: S1 (kit).
//
// What the page builders honour is published from here, at module scope where Node can read it without building
// anything: ITEM_PARAMS (the spec keys each builder reads: the same `params` a registry prop lists) and
// SURFACE_ITEMS (the types that stand on a desk). assets/item-meta.ts turns them into the catalog's entry for a page
// type, and scripts/build-prop-catalog.mts writes it — S3's placement metadata for page types sits beside it
// (assets/props/page-place.ts). scripts/test-builder-seams.mts fails when a builder reads a key that is not listed
// here, so a new parameter is published the day it is honoured.
//
// The validator lists the item types by calling createItemMap with a PROBE context (scripts/probe-context.mts: every
// property of it is a callable stand-in), so the factory may build anything at factory scope but must not depend on
// what it returns.
import { hex } from './build-context.js';

/** The spec keys each page builder honours (`at`, `rot` and `y` are the rooms loop's, for every type). One entry per
 *  ITEMS type, `[]` when it takes none. `color` is listed where the builder itself reads it; theming
 *  (kit-build.ts themeItem) leaves an explicitly coloured item its own colour whatever the builder does. */
export const ITEM_PARAMS: Readonly<Record<string, readonly string[]>> = {
  'sectional': [], 'club-chair': ['color'], 'coffee-table': ['w', 'd'], 'octagonal-table': [], 'dining-set': ['w', 'd'],
  'dining-table': ['w', 'd'], 'kitchen-island': ['w', 'd', 'color'], 'kitchen-cabinetry': ['w', 'd'], 'media-credenza': ['w', 'd'],
  'wall-tv': ['w', 'h'], 'fireplace': [], 'area-rug': ['w', 'd', 'color'], 'circular-rug': ['r', 'color'], 'concentric-rug': ['r'],
  'sun-lounger': [], 'bench': ['w', 'h', 'd'], 'platform-bed': ['w', 'd', 'color'], 'wardrobe': ['w', 'h', 'd'], 'crib': ['color'],
  'ensuite': ['w', 'd'], 'bookshelf': ['w', 'h', 'd'], 'walnut-desk': [], 'task-chair': [], 'curved-monitor': [],
  'chalk-tower': ['pose'], 'charcoal-tower': ['pose'], 'core-shelf': ['w', 'h', 'finish', 'pose'], 'strix-mini': [], 'speakers': [],
  'halo-lamp': [], 'fiddle-leaf': [], 'monstera': [], 'bonsai': [], 'bamboo': [], 'cactus-group': [], 'telescope': [],
  'soccer-goal': [], 'low-wall': ['w', 'h'], 'column': ['h', 'r', 'size', 'style', 'color'],
};

/** The types that stand ON a desk, credenza or island: they sit at DESK_TOP unless given a `y` (the catalog's `surface`
 *  for a page type; ON_SURFACE below is this as a Set) */
export const SURFACE_ITEMS: readonly string[] = ['curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers'];

// The hero desk set: the Companion Core's own pieces. The rooms loop skips a room-item copy of them at hero.at (the
// hero block places the real set), and theming leaves them their own colours (kit-build.ts themeItem, buildProp).
export const HERO_SET: ReadonlySet<string> = new Set(['walnut-desk', 'task-chair', 'curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers']);

export function createItemMap(bctx) {
  const { THREE, AssetFactory, ProceduralArchitecture, std, group } = bctx;

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
  const ON_SURFACE = new Set(SURFACE_ITEMS);

  return { ITEMS, DESK_TOP, ON_SURFACE };
}
