// collide.mts --selftest: plant a known collision, prove the detector finds it, and that a clean plan does not.
//   A. a scratch scene (the home taken out of the page, a wall and a few props put in): the clean variant has every legitimate contact the
//      whitelist is for (a sofa 5 mm off the wall, a dresser 1.5 cm into it, a lamp 1 cm into a table, a chair 9 cm under a table, a leg in a
//      rug, a frame in the wall plane) and must report nothing; the dirty variant adds a sofa through the wall and a lamp sunk 8 cm into the table
//      and must report exactly those two, at the right depth
//   B. the real plan (aurora): a box put through a ground-floor wall is found against that wall, and the findings are the same as before once
//      it is taken out again
import { startGeoSession } from './geom-page.mts';
import { extractDump, loadCatalog } from './collide-io.mts';
import { findCollisions } from './collide-lib.mts';

export async function selftest(sess: Awaited<ReturnType<typeof startGeoSession>>): Promise<boolean> {
  let ok = true; const check = (name: string, pass: boolean, detail = '') => { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!pass) ok = false; };
  console.log('\n== collide self-test');
  const cat = loadCatalog();
  const h = await sess.open('aurora');
  try {
    const pg = h.page;
    const item = (type: string, size: number[], pos: number[], extra: any = {}) => ({ kind: 'box', size, pos, name: type, color: 0x99aabb, userData: { role: 'item', itemType: type, room: 'Scratch', ...(extra.userData || {}) }, ...extra });
    const base = [
      item('sofa', [2.0, 0.8, 0.9], [-3.0, 0.4, 3.545]),                 // back 5 mm off the wall face (z 4.0): clean
      item('dresser', [1.2, 0.9, 0.5], [-0.5, 0.45, 3.765]),              // back 1.5 cm into the wall: against-wall contact
      item('side-table', [0.6, 0.55, 0.6], [2.0, 0.275, 1.0]),           // a table...
      item('table-lamp', [0.25, 0.5, 0.25], [2.0, 0.79, 1.0]),           // ...with a lamp standing on it, 1 cm into the top (base y 0.54, top 0.55)
      item('round-dining-table', [1.4, 0.75, 1.4], [-3.5, 0.375, 0.0]),  // a dining table...
      item('dining-chair', [0.45, 0.5, 0.5], [-3.5, 0.45, 0.7 + 0.25 - 0.09]),   // ...a chair 9 cm under its edge (the table spans z -0.7..0.7)
      item('area-rug', [2.0, 0.02, 2.0], [0.0, 0.01, 0.0]),               // a rug...
      item('side-table', [0.5, 0.5, 0.5], [0.0, 0.26, 0.0]),              // ...and a table standing on it, 1 cm into the pile
      item('wall-art', [0.8, 0.6, 0.04], [2.5, 1.5, 3.99]),               // a frame flush with the wall face (4 mm in)
    ];
    const run = async (extra: any[]) => {
      await pg.evaluate((a: any) => {
        const g = (window as any).__geo; g.sandboxOn();
        g.sandboxAdd({ kind: 'box', size: [10, 0.2, 10], pos: [0, -0.1, 0], color: 0xb08a5a, name: 'floor', userData: { role: 'floor' } });
        g.sandboxAdd({ kind: 'box', size: [10, 2.8, 0.16], pos: [0, 1.4, 4.08], color: 0xe8e4dc, name: 'Scratch wall', userData: { role: 'wall', isWall: true } });
        for (const it of a) g.sandboxAdd(it);
        g.rebuildRegistry();
      }, [...base, ...extra]);
      const { dump } = await extractDump(h);
      const res = findCollisions(dump, cat, { minDepth: 0.01 });
      await pg.evaluate(() => (window as any).__geo.sandboxOff());
      return res;
    };
    const clean = await run([]);
    check('clean scratch room (every legitimate contact): nothing reported', clean.findings.length === 0, `${clean.findings.length} findings: ${clean.findings.map(f => `${f.kind} ${f.a.type}/${f.b?.type ?? ''} ${f.depth_cm} cm`).join('; ')}`);
    check('clean scratch room: the whitelist did the work', clean.allowed.length >= 3, clean.allowed.map(a => `${a.count} ${a.rule}`).join(', '));
    const dirty = await run([
      item('sofa', [2.2, 0.8, 0.95], [3.0, 0.4, 3.95]),                          // z 3.475 .. 4.425: through the 0.16 slab (4.0 .. 4.16) and out of its far side
      item('side-table', [0.6, 0.55, 0.6], [0.0, 0.275, -3.0]),                  // a second table with a lamp 8 cm into its top (base y 0.47, top 0.55)
      item('table-lamp', [0.25, 0.5, 0.25], [0.0, 0.72, -3.0]),
    ]);
    const sofa = dirty.findings.find(f => f.a.type === 'sofa' && f.b && /wall/i.test(f.b.name));
    check('planted sofa through the wall: found', !!sofa && sofa.kind === 'prop-wall', sofa ? `${sofa.depth_cm} cm, ${sofa.visible}` : 'not found');
    check('planted sofa: depth is the push to clear (42.5 cm)', !!sofa && Math.abs(sofa.depth_cm - 42.5) < 1.5, sofa ? `${sofa.depth_cm}` : '');
    check('planted sofa: it comes out of the far side', !!sofa && /pokes out/.test(sofa.visible || ''));
    const lamp = dirty.findings.find(f => f.a.type === 'table-lamp' || f.b?.type === 'table-lamp');
    check('planted lamp sunk 8 cm into its table: found', !!lamp && lamp.kind === 'prop-prop' && Math.abs(lamp.depth_cm - 8) < 1.5, lamp ? `${lamp.depth_cm} cm` : 'not found');
    check('exactly the two planted findings', dirty.findings.length === 2, `${dirty.findings.length} findings: ${dirty.findings.map(f => `${f.kind} ${f.a.name}${f.b ? ' x ' + f.b.name : ''} ${f.depth_cm} cm`).join('; ')}`);
    // B. the real plan
    const before = await (async () => { const { dump } = await extractDump(h); return findCollisions(dump, cat, { minDepth: 0.01 }); })();
    const pl = await pg.evaluate(() => (window as any).__geo.plantBoxThroughWall([1.2, 0.8, 1.0], 'sofa'));
    check('real plan: a ground-floor wall to put a box through was found', !!pl, pl ? `${pl.wall}` : '');
    const after = await (async () => { const { dump } = await extractDump(h); return findCollisions(dump, cat, { minDepth: 0.01 }); })();
    const hit = after.findings.find(f => f.a.name.startsWith('PLANTED') && f.kind === 'prop-wall');
    check('real plan, box through a wall of aurora: found against a wall', !!hit && hit.depth_cm > 25, hit ? `${hit.depth_cm} cm against ${hit.b?.name}` : 'not found');
    const key = (f: any) => `${f.kind}|${f.a.id}|${f.b ? f.b.id : ''}|${f.depth_cm}`;
    const was = new Set(before.findings.map(key)), extra = after.findings.filter(f => !was.has(key(f)) && !f.a.name.startsWith('PLANTED') && !(f.b && f.b.name.startsWith('PLANTED')));
    check('real plan: nothing else changed', extra.length === 0, `${before.findings.length} -> ${after.findings.length}${extra.length ? '; new: ' + extra.map(f => `${f.kind} ${f.a.name} ${f.b?.name ?? ''} ${f.depth_cm}`).join('; ') : ''}`);
    await pg.evaluate(() => (window as any).__geo.removePlanted());
    const gone = await (async () => { const { dump } = await extractDump(h); return findCollisions(dump, cat, { minDepth: 0.01 }); })();
    check('real plan, box removed: the findings are the ones before', gone.findings.length === before.findings.length && JSON.stringify(gone.findings.map(f => f.depth_cm)) === JSON.stringify(before.findings.map(f => f.depth_cm)), `${before.findings.length} -> ${gone.findings.length}`);
  } finally { await h.close(); }
  console.log(ok ? 'collide self-test: PASS' : 'collide self-test: FAIL');
  return ok;
}
