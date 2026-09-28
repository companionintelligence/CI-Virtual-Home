// The item map — spec item `type` → the page's AssetFactory builder (plus DESK_TOP and the on-surface set the
// rooms loop and the hero read). Registry props (assets/props/) are looked up after this map, by the rooms loop.
//
// Seam module (plan S0): moved verbatim out of house-builder.ts. Owner: S1 (kit). The page builders' honoured
// parameters are published to the catalog from here.
import { hex } from './build-context.js';

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
  const ON_SURFACE = new Set(['curved-monitor', 'chalk-tower', 'charcoal-tower', 'strix-mini', 'speakers']);

  return { ITEMS, DESK_TOP, ON_SURFACE };
}
