// T-FAULT : the session survives what real headsets do, and the harness notices when it does not.
//   throw    an exception inside an XR event handler is a page error and fails the case (the harness's own negative control)
//   lost     a controller (or the pinching hand) lost in the middle of a press CANCELS the press: nothing is selected, and the
//            session keeps running and takes the next press
//   hidden   visibilitychange "hidden" (system menu, headset off the face) cancels a press in progress; the session keeps
//            running and takes the next press when visible again
//   end      the SYSTEM ends the session (not the page): the player is left exactly as it was (the T-X6a comparison)
// With the product's own XR module the press-level assertions need its UI (xr-ui, 30-ui.mts asserts RayTarget.onRelease(cancelled));
// here the product is held to what any module must satisfy: no page error, the session keeps running or ends cleanly, frames keep
// coming, and state is restored. With the in-page bed (xrbed.js) the press cancel is asserted directly.
// @check-house skip — needs the built dist and a GPU browser; run pnpm run xr:test
import { defineCase, enterSession, endSession, tickFrames, settledSnapshot, equal, fmtDiff, sleep, until, type P, type Entered } from '../xr-harness/lib.mts';

const bed = (p: P) => p.page.evaluate(() => { const B = (window as any).__bed; return B && B.state ? { down: B.state.down, pressed: B.pressed.slice(), cancelled: B.cancelled || 0 } : null; });
const buttonLocal = (p: P) => p.page.evaluate(() => {
  const B = (window as any).__bed, T = (window as any).__THREE; const b = B.buttons.find((x: any) => x.id === 'pause');
  const v = new T.Vector3((b.x + b.w / 2) / 1024 * 0.9 - 0.45, (1 - (b.y + b.h / 2) / 456) * 0.4 - 0.2, 0); B.panel.localToWorld(v); return B.rig.worldToLocal(v).toArray() as number[];
});

// hold a press on the Pause button (controller trigger, or a pinch on the Vision profile), run `during`, release. Returns when released.
async function pressWith(p: P, vision: boolean, during: () => Promise<void>) {
  const [x, y, z] = await buttonLocal(p);
  await p.page.evaluate(async ([a, b, c]: number[]) => { const d = (window as any).__xrdev; if (!d.hands || !(window as any).__visionDevice) await d.remote.dispatch('look_at', { device: 'controller-right', target: { x: a, y: b, z: c } }); }, [x, y, z]);
  if (vision) {
    await p.page.evaluate(([a, b, c]: number[]) => { (window as any).__duringDone = false; (window as any).__pinch = (window as any).__xrdev.transientPinch('right', { x: a, y: b, z: c }, 700, async () => { (window as any).__duringDone = 'ready'; await new Promise<void>(r => { (window as any).__release = r; }); }); }, [x, y, z]);
    await until(p, () => (window as any).__duringDone === 'ready', 'the pinch to be held', 10000);
    await during();
    await p.page.evaluate(async () => { (window as any).__release(); await (window as any).__pinch; });
  } else {
    await p.page.evaluate(() => (window as any).__xrdev.controllers.right.updateButtonValue('trigger', 1));
    await sleep(250);
    await during();
    await p.page.evaluate(() => (window as any).__xrdev.controllers.right.updateButtonValue('trigger', 0));
  }
  await sleep(300);
}
const tapOnce = async (p: P, vision: boolean) => pressWith(p, vision, async () => { await sleep(100); });

export const faultThrow = defineCase({
  id: 'T-FAULT-throw', title: 'an exception inside an XR event handler is a page error and fails the case',
  async run(t) {
    const p = await t.open({ kind: 'player', treeName: 'dist' });
    const e = await enterSession(p);
    await tickFrames(p, 20);
    t.check(p.errors.length === 0, `errors before the control: ${p.errors.join(' | ')}`);
    await p.page.evaluate(() => { (window as any).__xrh.current.addEventListener('select', () => { throw new Error('boom in select handler'); }); });
    if (t.device === 'vision') await p.page.evaluate(() => (window as any).__xrdev.transientPinch('right', { x: 0, y: 1.4, z: -1.5 }, 150));
    else await p.page.evaluate(async () => { await (window as any).__xrdev.remote.dispatch('select', { device: 'controller-right', duration: 0.1 }); });
    await sleep(500);
    const hit = p.expect(/boom in select handler/);
    t.check(hit.length >= 1, 'NEGATIVE CONTROL FAILED: an exception thrown in a select handler was not reported as a page error, so the harness cannot see a crash in a handler');
    t.check(p.errors.length === 0, `other errors: ${p.errors.join(' | ')}`);
    await tickFrames(p, 10);   // the session keeps delivering frames after the handler threw
    await endSession(p, e);
    t.note('pageerrors', hit.length);
  },
});

export const faultLost = defineCase({
  id: 'T-FAULT-lost', title: 'a controller or hand lost mid-press cancels the press; the session keeps running and takes the next press',
  async run(t) {
    const vision = t.device === 'vision';
    const p = await t.open({ kind: 'player', treeName: 'dist' });
    const e = await enterSession(p);
    await tickFrames(p, 20);
    await p.page.evaluate((v: boolean) => { (window as any).__visionDevice = v; }, vision);
    const ev0 = await p.page.evaluate(() => (window as any).__xrh.events.length);
    await pressWith(p, vision, async () => {
      if (e.driver === 'bed') t.check((await bed(p))!.down === 'pause', 'the press did not arm on Pause (the test would prove nothing about cancel)');
      // the source is lost while pressed
      await p.page.evaluate((v: boolean) => { const d = (window as any).__xrdev; if (v) d.hands.right.connected = false; else d.controllers.right.connected = false; }, vision);
      await sleep(400);
      if (e.driver === 'bed') t.check((await bed(p))!.down === null, 'the press was still down after its source was lost');
    });
    await p.page.evaluate((v: boolean) => { const d = (window as any).__xrdev; if (!v) d.controllers.right.connected = true; }, vision);   // controllers come back; a hand only returns with the next pinch
    await sleep(400);
    await tickFrames(p, 10);
    if (e.driver === 'bed') {
      const s = (await bed(p))!;
      t.check(s.pressed.length === 0, `a press whose source was lost mid-press selected ${JSON.stringify(s.pressed)}`);
      t.check(s.cancelled >= 1, `no cancel was recorded for the lost source (${s.cancelled})`);
      await p.page.evaluate(async () => { const d = (window as any).__xrdev; if (d.controllers && d.controllers.right) { d.controllers.right.connected = true; } });
      await tapOnce(p, vision);
      const again = (await bed(p))!;
      t.check(again.pressed.join() === 'pause', `after the loss the next press did not select Pause (${JSON.stringify(again.pressed)}): the input is stuck`);
    } else {
      await tapOnce(p, vision);
      t.note('pressSemantics', 'asserted on the product by 30-ui.mts (onRelease cancelled), not here');
    }
    const state = await p.page.evaluate(() => { const x = (window as any).__houseViewer && (window as any).__houseViewer.xr; return { api: x ? x.state : 'bed', presenting: (window as any).__houseDebug().renderer.xr.isPresenting }; });
    t.check(state.presenting && (state.api === 'running' || state.api === 'bed'), `the session did not survive the loss: ${JSON.stringify(state)}`);
    t.note('driver', e.driver); t.note('events', (await p.page.evaluate((n: number) => (window as any).__xrh.events.slice(n).map((x: any) => x.n), ev0)).join(','));
    await endSession(p, e);
  },
});

export const faultHidden = defineCase({
  id: 'T-FAULT-hidden', title: 'visibilitychange hidden cancels a press in progress; the session keeps running and takes the next press when visible',
  async run(t) {
    const vision = t.device === 'vision';
    const p = await t.open({ kind: 'player', treeName: 'dist' });
    const e = await enterSession(p);
    await tickFrames(p, 20);
    await p.page.evaluate((v: boolean) => { (window as any).__visionDevice = v; }, vision);
    await pressWith(p, vision, async () => {
      await p.page.evaluate(() => (window as any).__xrdev.updateVisibilityState('hidden'));
      await sleep(400);
      if (e.driver === 'bed') t.check((await bed(p))!.down === null, 'the press was still down while the session was hidden');
    });
    await p.page.evaluate(() => (window as any).__xrdev.updateVisibilityState('visible'));
    await sleep(400);
    const vis = await p.page.evaluate(() => (window as any).__xrh.visibility.slice());
    t.check(vis.includes('hidden') && vis[vis.length - 1] === 'visible', `visibility events: ${JSON.stringify(vis)}`);
    if (e.driver === 'bed') {
      const s = (await bed(p))!;
      t.check(s.pressed.length === 0, `a press that was hidden mid-way selected ${JSON.stringify(s.pressed)}`);
      await tapOnce(p, vision);
      t.check((await bed(p))!.pressed.join() === 'pause', 'after the session became visible again the next press did not select Pause');
    } else { await tapOnce(p, vision); }
    await tickFrames(p, 10);
    t.check(await p.page.evaluate(() => (window as any).__houseDebug().renderer.xr.isPresenting), 'the session ended when it was hidden and shown again');
    t.note('visibility', vis);
    await endSession(p, e);
  },
});

export const faultEnd = defineCase({
  id: 'T-FAULT-end', title: 'when the system ends the session the player is left exactly as it was before it',
  async run(t) {
    const p = await t.open({ kind: 'player', treeName: 'dist', query: 'no=adapt' });
    const before = await settledSnapshot(p);
    const e: Entered = await enterSession(p);
    await tickFrames(p, 30);
    await p.page.evaluate(async () => { await (window as any).__xrdev.remote.dispatch('end_session', {}); });
    await until(p, () => !(window as any).__houseDebug().renderer.xr.isPresenting && (window as any).__xrh.ended >= 1, 'the session to end when the system ended it', 20000);
    if (e.driver === 'session') await until(p, () => (window as any).__houseViewer.xr.state === 'idle', 'the XR module to go back to idle', 20000);
    await sleep(600);
    const after = await settledSnapshot(p);
    const hard = equal(before, after).filter(d => d.group !== 'memory');
    t.check(hard.length === 0, `after a system-ended session the player differs: ${fmtDiff(hard)}`);
    t.note('driver', e.driver);
  },
});
