// probe.js : the harness's in-page instrumentation, injected as an init script after IWER (so navigator.xr is IWER's).
// It touches nothing the product draws: it wraps navigator.xr.requestSession so every session object it hands out counts its
// frames and, after each frame callback, samples what the comfort check needs. It works the same whether the session was
// started by the player's own XR module or by the in-page bed (xrbed.js), which is the point: the tests read what happened,
// not what a particular module says happened.
(() => {
  if (window.__xrh) return;
  const X = window.__xrh = {
    frames: 0, sessions: 0, ended: 0, events: [], visibility: [],
    comfort: null,                                    // set by the harness: { log: [], on: true }
    lastFrameAt: 0, dts: [],
    readFade() {                                      // 0..1 black over the view, or null when the page has no fade quad at all
      try { const x = window.__houseViewer && window.__houseViewer.xr; const r = x && (typeof x.rig === 'function' ? x.rig() : x.rig); const f = r && r.fade; if (f && f.get) return f.get(); } catch (e) { /* fall through */ }
      try { const cam = window.__houseDebug().camera; const q = (cam.getObjectByName('xr: fade') || cam.getObjectByName('xr-fade')); if (q && q.material) return q.material.opacity; } catch (e) { /* none */ }
      return null;
    },
  };
  const sample = () => {
    const c = X.comfort; if (!c || !c.on) return;
    let p = null;
    try { const e = window.__houseDebug().renderer.xr.getCamera().matrixWorld.elements; p = [e[12], e[13], e[14]]; } catch (err) { return; }
    c.log.push({ f: X.frames, a: X.readFade(), p });
  };
  const instrument = (s, mode) => {
    X.sessions++; X.current = s; X.mode = mode;
    const raf = s.requestAnimationFrame.bind(s);
    s.requestAnimationFrame = (cb) => raf((t, frame) => {
      X.frames++; const now = performance.now(); if (X.lastFrameAt) { X.dts.push(now - X.lastFrameAt); if (X.dts.length > 600) X.dts.shift(); } X.lastFrameAt = now;
      try { cb(t, frame); } finally { sample(); }   // an exception in the app's frame still reaches the page (a pageerror) and still fails the test
    });
    s.addEventListener('end', () => { X.ended++; X.events.push({ n: 'end', f: X.frames }); });
    s.addEventListener('visibilitychange', () => { X.visibility.push(s.visibilityState); X.events.push({ n: 'visibility:' + s.visibilityState, f: X.frames }); });
    for (const n of ['inputsourceschange', 'selectstart', 'select', 'selectend', 'squeezestart', 'squeezeend']) s.addEventListener(n, (e) => X.events.push({ n, f: X.frames, srcs: s.inputSources.length }));
  };
  if (navigator.xr && navigator.xr.requestSession) {
    const orig = navigator.xr.requestSession.bind(navigator.xr);
    navigator.xr.requestSession = async (mode, init) => { const s = await orig(mode, init); instrument(s, mode); return s; };
  }
})();
