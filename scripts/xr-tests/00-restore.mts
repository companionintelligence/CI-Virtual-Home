// T-X6a : leaving XR leaves nothing behind. three's WebXRManager overwrites the camera's fov, near, far, zoom and projection every
// XR frame and never restores them, and the module also changes the renderer (XR enabled, framebuffer, foveation, pixel ratio,
// shadow map, tone mapping, the scene graph, textures). After a session ends, the next MONO frame must have the identical draw
// calls, triangles and pixel hash it had before, and every one of those settings must be back.
// @check-house skip — needs the built dist and a GPU browser; run pnpm run xr:test
import { defineCase, enterSession, endSession, tickFrames, snapshot, settledSnapshot, equal, fmtDiff, sleep } from '../xr-harness/lib.mts';

export const restore = defineCase({
  id: 'T-X6a', title: 'after a session ends the next mono frame is identical (calls, triangles, pixels) and the camera and renderer are restored',
  async run(t) {
    // ?no=adapt: the player's own pixel-ratio controller would otherwise move the baseline between two idle snapshots
    const p = await t.open({ kind: 'player', treeName: 'dist', query: 'no=adapt' });
    const before = await settledSnapshot(p);

    // the comparator can fail: a one-field change to a copy of the baseline is reported (so "no diff" below means something)
    const mutated = JSON.parse(JSON.stringify(before)); mutated.camera.near = before.camera.near * 2; mutated.render.hash = before.render.hash ^ 1;
    t.check(equal(before, mutated).length === 2, 'the snapshot comparator did not flag two planted differences');

    const e = await enterSession(p);
    await tickFrames(p, 60);
    // not vacuous: while presenting, three really did take over the camera
    const during = await p.page.evaluate(() => { const { renderer, camera } = (window as any).__houseDebug(); return { presenting: renderer.xr.isPresenting, proj: camera.projectionMatrix.elements.slice(0, 16), fov: camera.fov }; });
    t.check(during.presenting, 'the session is not presenting');
    t.check(JSON.stringify(during.proj.map((v: number) => +v.toFixed(5))) !== JSON.stringify(before.camera.proj), 'the camera projection is the same during the session as before it: nothing was overwritten, so the restore check is vacuous');
    t.note('driver', e.driver);
    await t.screenshot(p, `restore-${t.device}-${e.driver}-in-session`);   // both eyes side by side, for a human to look at
    await endSession(p, e);
    await sleep(500);

    const after = await settledSnapshot(p);
    const diff = equal(before, after);
    // memory is judged below (a leak is growth PER session; three keeps a couple of lazily built internals after the first one)
    const hard = diff.filter(d => d.group !== 'memory');
    t.check(hard.length === 0, `state differs after the session: ${fmtDiff(hard)}`);
    t.check(after.render.calls === before.render.calls && after.render.tris === before.render.tris, `draw calls/triangles ${before.render.calls}/${before.render.tris} -> ${after.render.calls}/${after.render.tris}`);
    t.check(after.render.hash === before.render.hash, `the next mono frame's pixel hash changed (${before.render.hash} -> ${after.render.hash})`);
    for (const k of ['fov', 'near', 'far', 'zoom', 'aspect'] as const) t.check(after.camera[k] === before.camera[k], `camera.${k} ${before.camera[k]} -> ${after.camera[k]}`);
    t.check(JSON.stringify(after.camera.proj) === JSON.stringify(before.camera.proj), 'camera.projectionMatrix was not restored');
    t.check(after.camera.parent === before.camera.parent && after.camera.parentName === before.camera.parentName, `the camera is parented to ${after.camera.parent}/${after.camera.parentName}, was ${before.camera.parent}/${before.camera.parentName}`);
    t.check(!after.renderer.xrEnabled && !after.renderer.presenting, 'renderer.xr is still enabled or presenting');
    t.note('callsTris', `${after.render.calls}/${after.render.tris}`); t.note('hash', after.render.hash);
    const lazy = { geometries: after.memory.geometries - before.memory.geometries, textures: after.memory.textures - before.memory.textures };
    t.note('lazyAfterFirstSession', lazy);
    t.check(lazy.geometries <= 16 && lazy.textures <= 4, `the first session left ${lazy.geometries} geometries and ${lazy.textures} textures behind: more than three's lazily built internals`);

    // a second session must leave exactly what the first left: per-session growth is a leak (geometries, textures, scene children)
    const e2 = await enterSession(p, { driver: e.driver === 'bed' ? 'bed' : 'session' });
    await tickFrames(p, 30); await endSession(p, e2); await sleep(500);
    const after2 = await settledSnapshot(p);
    const d2 = equal(after, after2);
    t.check(d2.length === 0 || d2.every(d => d.kind === 'shrunk'), `a second session changed state again: ${fmtDiff(d2)}`);

    // the page comes back to life: a nudge of the free camera must draw again (the 2D loop was resumed, not left paused)
    const f0 = await p.page.evaluate(() => (window as any).__houseDebug().renderer.info.render.frame);
    const box = await p.page.evaluate(() => { const r = (window as any).__houseDebug().renderer.domElement.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await p.page.mouse.move(box[0], box[1]); await p.page.mouse.down(); await p.page.mouse.move(box[0] + 12, box[1]); await p.page.mouse.up();
    await p.page.waitForFunction((f: number) => (window as any).__houseDebug().renderer.info.render.frame > f, f0, { timeout: 8000, polling: 50 }).catch(() => undefined);
    const f1 = await p.page.evaluate(() => (window as any).__houseDebug().renderer.info.render.frame);
    await sleep(600);
    const f2 = await p.page.evaluate(() => (window as any).__houseDebug().renderer.info.render.frame);
    t.check(f2 > f0 || f1 > f0, `no frame was drawn after a camera nudge following the session (render.frame ${f0} -> ${f2}): the 2D loop did not resume`);

    // NEGATIVE CONTROL. (a) the comparator catches a camera left as XR left it
    await p.page.evaluate(() => { const { camera } = (window as any).__houseDebug(); (window as any).__keep = [camera.near, camera.far]; camera.near *= 3; camera.updateProjectionMatrix(); });
    const bad = equal(before, await snapshot(p));
    t.check(bad.some(d => d.group === 'camera'), 'NEGATIVE CONTROL FAILED: a camera whose near plane was left changed is not flagged');
    await p.page.evaluate(() => { const { camera } = (window as any).__houseDebug(); camera.near = (window as any).__keep[0]; camera.updateProjectionMatrix(); });
    // (b) with the bed, its own "do not restore" switch is the control: three's overwrite must then show up as a diff
    if (e.driver === 'bed') {
      const p2 = await t.open({ kind: 'player', treeName: 'dist', query: 'no=adapt' });
      const b2 = await settledSnapshot(p2);
      await p2.page.evaluate(() => { (window as any).__bedNoCamRestore = true; });
      const e2 = await enterSession(p2, { driver: 'bed' });
      await tickFrames(p2, 30); await endSession(p2, e2); await sleep(400);
      const d2 = equal(b2, await settledSnapshot(p2));
      t.check(d2.some(d => d.group === 'camera'), 'NEGATIVE CONTROL FAILED: a session that does not restore the camera passed the restore check');
      t.note('unrestoredFlagged', d2.filter(d => d.group === 'camera').map(d => d.key));
    }
  },
});
