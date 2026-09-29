// The ShotWorld files the Node harnesses plan on (plan §3.15): test/qa/shot-worlds/<id>.world.json, one per house (or
// fixture), made by building the house in the page and asking it for anchors.shotWorld (assets/shot-world.ts digestWorld:
// the storeys, the entry, the Core's box, the flights and every solid as boxes). The planner and QA v2 read nothing else,
// so what test-shot-planner.mts, camera-audit.mts and scripts/fleet/shots.mts bake in Node is the track the page bakes.
//
// A world is remade when its file is missing or older than what it was built from: the house's spec, room-creator.html
// or any assets/**/*.ts (`pnpm run build` compiles them, so the .ts are the sources). The files are gitignored (test/qa/);
// the committed plans' `shots` key (assets/plan-export/shots.ts) carries the same JSON for whoever regenerates them.
//
//   import { ensureWorlds } from './shot-worlds.mts'; const worlds = await ensureWorlds(ids);
//   node --experimental-strip-types scripts/shot-worlds.mts [--house a,b] [--rebuild] [--stale-ok] [--fixtures]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts, parseArgs, houseIds } from './portal-lib.mts';

export const WORLDS = path.join(ROOT, 'test', 'qa', 'shot-worlds');
export const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'houses');
export const worldFile = (id: string) => path.join(WORLDS, `${id}.world.json`);
export const fixtureIds = () => fs.existsSync(FIXTURES) ? fs.readdirSync(FIXTURES).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort() : [];
export const specFile = (id: string) => fs.existsSync(path.join(FIXTURES, `${id}.json`)) ? path.join(FIXTURES, `${id}.json`) : path.join(ROOT, 'content', 'houses', `${id}.json`);

function newestSource(): number {
  let m = fs.statSync(path.join(ROOT, 'room-creator.html')).mtimeMs;
  const walk = (dir: string) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) { if (f.name !== 'vendor' && f.name !== 'fonts') walk(p); } else if (f.name.endsWith('.ts')) m = Math.max(m, fs.statSync(p).mtimeMs); } };
  walk(path.join(ROOT, 'assets'));
  return m;
}
export function isFresh(id: string): boolean {
  const f = worldFile(id); if (!fs.existsSync(f)) return false;
  const t = fs.statSync(f).mtimeMs;
  return t >= newestSource() && t >= fs.statSync(specFile(id)).mtimeMs;
}
export function readWorld(id: string): any { return JSON.parse(fs.readFileSync(worldFile(id), 'utf8')); }

/** Make the worlds of `ids` that are missing or stale (all of them with `rebuild`) in one browser; returns id → world. */
export async function ensureWorlds(ids: string[], { rebuild = false, log = true, staleOk = false }: { rebuild?: boolean; log?: boolean; staleOk?: boolean } = {}): Promise<Map<string, any>> {
  // staleOk: a world file that exists is used as it is (planner work that does not change what the digest reads)
  const todo = ids.filter(id => rebuild || (staleOk ? !fs.existsSync(worldFile(id)) : !isFresh(id)));
  if (todo.length) {
    fs.mkdirSync(WORLDS, { recursive: true });
    const srv = await serve(ROOT, '/');
    const pw = await loadPlaywright();
    const browser = await pw.chromium.launch({ headless: true, args: LAUNCH_ARGS });
    try {
      const page = await (await browser.newContext({ viewport: { width: 1200, height: 700 } })).newPage();
      page.on('pageerror', (e: Error) => console.error('  page error:', e.message));
      await stubGoogleFonts(page, srv.origin);
      // a fixture is served in place of content/houses/<id>.json, as test-fixtures.mts does
      await page.route(/\/content\/houses\/[^/]+\.json(\?.*)?$/, (route: any) => {
        const id = new URL(route.request().url()).pathname.split('/').pop()!.replace(/\.json$/, '');
        if (fs.existsSync(path.join(FIXTURES, `${id}.json`))) route.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(FIXTURES, `${id}.json`), 'utf8') });
        else route.continue();
      });
      for (const id of todo) {
        if (log) console.log(`  world ${id} …`);
        await page.goto(srv.url(`room-creator.html?house=${id}`), { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, id, { timeout: 120000 });
        const world = await page.evaluate(() => (window as any).__houseShotWorld());
        fs.writeFileSync(worldFile(id), JSON.stringify(world));
      }
    } finally { await browser.close(); await srv.close(); }
  }
  return new Map(ids.map(id => [id, readWorld(id)]));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const ids = args.house ? args.house.split(',') : [...houseIds(), ...(args.fixtures === 'true' ? fixtureIds() : [])];
  const t = Date.now();
  const w = await ensureWorlds(ids, { rebuild: args.rebuild === 'true', staleOk: args['stale-ok'] === 'true' });
  console.log(`${w.size} worlds in ${path.relative(process.cwd(), WORLDS)} (${((Date.now() - t) / 1000).toFixed(0)} s)`);
}
