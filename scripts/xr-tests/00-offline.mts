// T-OFFLINE : the offline pipeline (goldens, fixtures, __houseRenderFrames, films, stills) is untouched by anything XR or platform
// (N8). Three things, all on the EDITOR page (the page with no ?mode=view, the only one that has the render hooks):
//   1. it requests nothing under assets/xr/ and no platform.js, on the repo tree and on the built dist, and mounts no XR API;
//   2. a fresh page's __houseRenderFrames(0) is byte-identical to the reference commit's (03edd3b): compared with the pixel hash
//      recorded from that commit on this machine (scripts/xr-harness/offline-baseline.json, keyed by platform and Chromium build),
//      or with a live render of a built reference tree given as --ref-dir (a dist/ or a repo checkout of 03edd3b);
//   3. in the player (?mode=view) __houseRenderBegin throws, so a session can never be mid-way through an offline frame.
// Record the baseline (from a tree whose app code IS the reference commit) with:  pnpm run xr:test -- --only T-OFFLINE --record-offline
// @check-house skip — needs the built dist and a GPU browser; run pnpm run xr:test
import fs from 'node:fs';
import path from 'node:path';
import { defineCase, serve, rel, sleep, Fail } from '../xr-harness/lib.mts';
import { renderFrame0, machineKey, readBaseline, OFFLINE_BASELINE, OFFLINE_SHOT, OFFLINE_RES, goldenProfile } from '../xr-harness/checks.mts';

export const offline = defineCase({
  id: 'T-OFFLINE', devices: ['quest3'], title: 'the editor loads no XR or platform code; frame 0 of a fresh page is byte-identical to the reference commit; the player has no offline hook',
  async run(t) {
    // 1. requests and globals, on both trees
    for (const name of ['root', 'dist'] as const) {
      const tree = await t.tree(name);
      const p = await t.open({ kind: 'editor', tree });
      await sleep(600);
      const bad = p.requests.filter(r => /\/assets\/(xr\/|platform[^/]*\.js)/.test(r.url));
      t.check(bad.length === 0, `the editor page (${name}) requested ${bad.map(r => rel(tree, r.url)).join(', ')}`);
      const g = await p.page.evaluate(() => ({ xr: !!((window as any).__houseViewer && (window as any).__houseViewer.xr), viewer: !!(window as any).__houseViewer, render: typeof (window as any).__houseRenderFrames }));
      t.check(!g.xr, `the editor page (${name}) has window.__houseViewer.xr`);
      t.check(g.render === 'function', `the editor page (${name}) lost __houseRenderFrames`);
      if (name === 'dist') await p.close();
    }

    // 2. byte-identical frame 0 (root tree, as the goldens serve it)
    const root = await t.tree('root');
    const p = await t.open({ kind: 'editor', tree: root });
    const ver: string = p.ctx.browser().version();
    const key = machineKey(ver);
    const got = await renderFrame0(p);
    t.note('frame0', `${got.sha.slice(0, 16)} (${got.w}x${got.h})`);
    const frameKey = `${t.house}/${OFFLINE_SHOT}@${OFFLINE_RES}#0`;
    if (t.args['record-offline'] === 'true') {
      const b = readBaseline(); b.note = 'sha256 of the raw RGBA of frame 0, drawn as scripts/test-goldens.mts draws it, from the reference commit 03edd3b. Per machine: the GPU is part of the render. Written by: pnpm run xr:test -- --only T-OFFLINE --record-offline';
      b.reference = '03edd3b'; b.goldenProfile = goldenProfile();
      b.frames ||= {}; (b.frames[key] ||= {})[frameKey] = got.sha;
      fs.writeFileSync(OFFLINE_BASELINE, JSON.stringify(b, null, 2) + '\n');
      t.note('recorded', `${key} ${frameKey}`);
    } else {
      let want: string | null = null, source = '';
      const refDir = t.args['ref-dir'] && t.args['ref-dir'] !== 'true' ? path.resolve(t.args['ref-dir']) : null;
      if (refDir) {
        if (!fs.existsSync(path.join(refDir, 'room-creator.html'))) throw new Fail(`--ref-dir ${refDir} has no room-creator.html`);
        const srv = await serve(refDir, '/');
        try {
          const rp = await t.open({ kind: 'editor', tree: { dir: refDir, base: '/', srv, hasXr: false, name: 'root' } });
          want = (await renderFrame0(rp)).sha; source = `live render of --ref-dir ${refDir}`;
        } finally { await srv.close(); }
      } else {
        const b = readBaseline();
        want = b.frames && b.frames[key] && b.frames[key][frameKey] || null; source = `${path.relative(process.cwd(), OFFLINE_BASELINE)} (${key})`;
        if (!want) t.skip(`no byte baseline for ${key} / ${frameKey}: record one from a tree at the reference commit (--record-offline) or pass --ref-dir`);
      }
      t.check(got.sha === want, `frame 0 of ${t.house}/${OFFLINE_SHOT} is NOT byte-identical to the reference (${got.sha.slice(0, 16)} vs ${String(want).slice(0, 16)}; source: ${source}); the goldens will show where`);
      t.note('identicalTo', source);
    }

    // 3. the player has no offline hook
    const pl = await t.open({ kind: 'player', treeName: 'dist' });
    const threw = await pl.page.evaluate(() => { try { (window as any).__houseRenderBegin({ shot: 'orbit', res: '360' }); return null; } catch (e: any) { return String(e && e.message); } });
    t.check(!!threw && /not available in the player/.test(threw), `__houseRenderBegin in the player did not throw the player-mode error (got ${JSON.stringify(threw)})`);
  },
});
