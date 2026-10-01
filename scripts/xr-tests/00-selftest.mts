// The harness proves itself before anything is proved with it. These cases always use the in-page bed (xrbed.js), not the
// product's session: they test the EMULATION and the CHECKS (stereo geometry, hover and press on controllers versus the transient
// profile, the blink-comfort check and its negative control), so a later green result for the product means something.
// @check-house skip — needs the built dist and a GPU browser; run pnpm run xr:test
import { defineCase, enterSession, endSession, tickFrames, eyes, startComfort, comfortReport, stopComfort, xrFrames, sleep, until, type P } from '../xr-harness/lib.mts';

const IPD = 0.063;     // IWER's default inter-pupillary distance in metres; the Quest and Vision profiles both use it

// the panel button's centre in the rig's local (IWER) space: what an input source has to aim at
const buttonLocal = (p: P, id: string) => p.page.evaluate((bid: string) => {
  const B = (window as any).__bed, T = (window as any).__THREE; const b = B.buttons.find((x: any) => x.id === bid);
  const v = new T.Vector3((b.x + b.w / 2) / 1024 * 0.9 - 0.45, (1 - (b.y + b.h / 2) / 456) * 0.4 - 0.2, 0); B.panel.localToWorld(v); return B.rig.worldToLocal(v).toArray() as number[];
}, id);
const bedState = (p: P) => p.page.evaluate(() => { const B = (window as any).__bed; return { hover: B.state.hover, down: B.state.down, pressed: B.pressed.slice(), hoverEver: B.hoverEver.slice(), cancelled: B.cancelled || 0, sources: B.session.inputSources.length }; });

export const stereo = defineCase({
  id: 'XSELF-stereo', title: 'the emulated session enters, delivers 90 frames in stereo (viewports are halves, eyes 0.063 m apart) and ends cleanly',
  async run(t) {
    const p = await t.open({ kind: 'player', treeName: 'dist' });
    t.check(await p.page.evaluate(async () => { const x = (navigator as any).xr; return !!x && await x.isSessionSupported('immersive-vr'); }), 'navigator.xr.isSessionSupported("immersive-vr") is not true under the emulated device');
    t.note('ar', await p.page.evaluate(async () => await (navigator as any).xr.isSessionSupported('immersive-ar')));   // reported, never relied on: IWER has no dom-overlay, so AR is untestable here
    const e = await enterSession(p, { driver: 'bed' });
    const f0 = await xrFrames(p);
    await tickFrames(p, 90);
    t.note('frames', (await xrFrames(p)) - f0);
    const ey = await eyes(p);
    t.check(ey.n === 2, `${ey.n} eye cameras, expected 2 (stereoEnabled is on)`);
    const [cw, ch] = ey.canvas;
    t.check(ey.vp[0][0] === 0 && ey.vp[0][2] === cw / 2 && ey.vp[1][0] === cw / 2 && ey.vp[1][2] === cw / 2 && ey.vp[0][3] === ch && ey.vp[1][3] === ch, `viewports are not the two halves of the ${cw}x${ch} framebuffer: ${JSON.stringify(ey.vp)}`);
    t.check(Math.abs(ey.ipd - IPD) < 0.002, `eye separation ${ey.ipd.toFixed(4)} m, expected ${IPD} m`);
    t.check(ey.pos[0].some((v, i) => Math.abs(v - ey.pos[1][i]) > 1e-4), 'the two eye matrices are identical');
    const px = await p.page.evaluate(() => (window as any).__bed.eyeDiff());
    t.check(px.diffPerPx > 0.5 && px.litLeft > 0.2, `the left and right halves of the framebuffer do not differ (diff/px ${px.diffPerPx}, lit ${px.litLeft.toFixed(2)}): not stereo`);
    t.note('ipd_m', +ey.ipd.toFixed(4)); t.note('eyeDiffPerPx', px.diffPerPx); t.note('fovy', ey.fovy.map(v => +v.toFixed(1)));
    await t.screenshot(p, `selftest-${t.device}-in-session`);
    await endSession(p, e);
    const after = await p.page.evaluate(() => ({ presenting: (window as any).__houseDebug().renderer.xr.isPresenting, ended: (window as any).__xrh.ended }));
    t.check(!after.presenting && after.ended === 1, `after end: presenting ${after.presenting}, end events ${after.ended}`);
  },
});

export const input = defineCase({
  id: 'XSELF-input', title: 'a Canvas2D panel button under the ray hovers and presses on controllers and never hovers on the transient profile',
  async run(t) {
    const p = await t.open({ kind: 'player', treeName: 'dist' });
    const e = await enterSession(p, { driver: 'bed' });
    await tickFrames(p, 20);
    const vision = t.device === 'vision';
    const [x, y, z] = await buttonLocal(p, 'pause');
    if (!vision) {
      const kinds = await p.page.evaluate(() => (window as any).__bed.session.inputSources.map((s: any) => s.targetRayMode + '/' + s.handedness));
      t.check(kinds.includes('tracked-pointer/right'), `no tracked-pointer controller under the ${t.device} profile: ${JSON.stringify(kinds)}`);
      // aim the right controller at Pause: it hovers; then pull the trigger: it presses
      await p.page.evaluate(async ([a, b, c]: number[]) => { await (window as any).__xrdev.remote.dispatch('look_at', { device: 'controller-right', target: { x: a, y: b, z: c } }); }, [x, y, z]);
      await until(p, () => (window as any).__bed.state.hover === 'pause', 'the Pause button to hover under the controller ray', 15000);
      await p.page.evaluate(async () => { await (window as any).__xrdev.remote.dispatch('select', { device: 'controller-right', duration: 0.12 }); });
      await sleep(400);
      let s = await bedState(p);
      t.check(s.pressed.join() === 'pause', `a trigger pull on Pause pressed ${JSON.stringify(s.pressed)}`);
      // aim at a wall: no hover, and a press there is not a press
      await p.page.evaluate(async () => { await (window as any).__xrdev.remote.dispatch('look_at', { device: 'controller-right', target: { x: -4, y: 1.3, z: -1 } }); });
      await until(p, () => (window as any).__bed.state.hover === null, 'the hover to clear when the ray leaves the panel', 15000);
      await p.page.evaluate(async () => { await (window as any).__xrdev.remote.dispatch('select', { device: 'controller-right', duration: 0.12 }); });
      await sleep(300);
      s = await bedState(p);
      t.check(s.pressed.join() === 'pause', `a pull aimed at the wall changed the pressed list: ${JSON.stringify(s.pressed)}`);
      t.note('haptics', await p.page.evaluate(() => (window as any).__bed.haptics));
    } else {
      const idle = await bedState(p);
      t.check(idle.sources === 0, `the vision profile has ${idle.sources} input sources before any pinch: it must have none (no controllers, hands only while pinching)`);
      // a pinch aimed at Pause: the source exists only for the pinch; while it exists its ray IS on the button, and still nothing hovers
      let during: any = null;
      await p.page.evaluate(([a, b, c]: number[]) => {
        (window as any).__sampleDuring = null;
        return (window as any).__xrdev.transientPinch('right', { x: a, y: b, z: c }, 600, async () => {
          const B = (window as any).__bed; const ctrl = B.ctrl.find((k: any) => k.userData.src);
          (window as any).__sampleDuring = { kind: ctrl && ctrl.userData.src.targetRayMode, rayOn: ctrl ? (B.hitPanel(ctrl) || {}).id : null, hover: B.state.hover, down: B.state.down, sources: B.session.inputSources.length };
        });
      }, [x, y, z]);
      during = await p.page.evaluate(() => (window as any).__sampleDuring);
      t.check(during && during.kind === 'transient-pointer', `the pinch source is "${during && during.kind}", expected transient-pointer`);
      t.check(during.rayOn === 'pause', `the pinch ray is on "${during.rayOn}", not on Pause: the test would prove nothing about hover`);
      t.check(during.hover === null, `Pause hovers ("${during.hover}") under a transient-pointer ray: visionOS has no hover`);
      await sleep(300);
      const s = await bedState(p);
      t.check(s.pressed.join() === 'pause', `a pinch on Pause pressed ${JSON.stringify(s.pressed)}`);
      t.check(s.hoverEver.length === 0, `the panel hovered ${JSON.stringify(s.hoverEver)} at some point during the vision session`);
      t.check(s.sources === 0, `${s.sources} input sources remain after the pinch ended`);
      t.note('duringPinch', { ray: during.rayOn, hover: during.hover, down: during.down });
    }
    await endSession(p, e);
  },
});

export const comfort = defineCase({
  id: 'XSELF-comfort', title: 'blink teleport moves the viewpoint only on fully black frames; a smooth move is flagged by the same check',
  async run(t) {
    const p = await t.open({ kind: 'player', treeName: 'dist' });
    const e = await enterSession(p, { driver: 'bed' });
    await tickFrames(p, 20);
    await startComfort(p);
    const head = () => p.page.evaluate(() => { const T = (window as any).__THREE, B = (window as any).__bed; const v = new T.Vector3().setFromMatrixPosition(B.renderer.xr.getCamera().matrixWorld); return v.toArray() as number[]; });
    const h0 = await head();
    const target = [h0[0] + 6, h0[1] - 1.6, h0[2] - 2];
    const ms = await p.page.evaluate(async (tg: number[]) => { const B = (window as any).__bed; const t0 = performance.now(); await B.blinkTo(tg, Math.PI / 2); return performance.now() - t0; }, target);
    await tickFrames(p, 10);
    await p.page.evaluate(async (tg: number[]) => { await (window as any).__bed.blinkTo([tg[0] - 6, tg[1], tg[2] + 2], 0); }, target);
    await tickFrames(p, 10);
    const h1 = await head();
    const good = await comfortReport(p);
    t.check(good.moves >= 2, `the blink checker saw ${good.moves} viewpoint moves, expected the two teleports: the check is not looking`);
    t.check(good.movesWhileVisible === 0, `${good.movesWhileVisible} of ${good.moves} viewpoint moves happened while the view was visible (worst step ${good.worst.toFixed(3)} m)`);
    t.check(Math.hypot(h1[0] - h0[0], h1[2] - h0[2]) < 0.05, `the second blink did not return the head to where it started (${h0} -> ${h1})`);
    t.note('blinks', good.moves); t.note('blink_ms', Math.round(ms));
    await stopComfort(p);
    // NEGATIVE CONTROL: the thing the product must never do, a smooth rig move, must be flagged by this very check
    await startComfort(p);
    await p.page.evaluate(async () => { const B = (window as any).__bed; await new Promise<void>(res => { let n = 0; const step = () => { B.rig.position.x += 0.02; if (++n < 40) setTimeout(step, 16); else res(); }; setTimeout(step, 16); }); });
    await tickFrames(p, 10);
    const bad = await comfortReport(p);
    t.check(bad.movesWhileVisible >= 10, `NEGATIVE CONTROL FAILED: a 0.8 m smooth move was flagged only ${bad.movesWhileVisible} times; the comfort check cannot fail`);
    t.note('smoothFlagged', bad.movesWhileVisible);
    await stopComfort(p);
    await endSession(p, e);
  },
});
