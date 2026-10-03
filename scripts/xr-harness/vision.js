// vision.js : an Apple Vision Pro-like device for IWER (installed by the harness as an init script after iwer.min.js).
// visionOS Safari has no controllers and no hover: the only input is a hand whose input source is "transient-pointer", which
// exists ONLY while the user pinches, with the ray from the hand toward the gaze target. IWER ships Quest profiles only, so
// this starts from the Quest 3 one and patches what differs: no controller config, hands report targetRayMode
// "transient-pointer" and start disconnected, a 90 Hz frame rate, Safari's user agent, and a `transientPinch` helper that
// plays one pinch (source appears, selectstart, select, selectend, source disappears).
// IWER quirks this works around, found when this was first run: it fires `select` BEFORE `selectstart`, and its userAgent
// override is what makes the page believe it is on Safari (the page must not sniff it; the probe is the capability).
(() => {
  const I = window.IWER;
  const cfg = Object.assign({}, I.metaQuest3, {
    name: 'Apple Vision Pro (emulated)', controllerConfig: undefined,
    supportedSessionModes: ['inline', 'immersive-vr'], supportedFeatures: ['viewer', 'local', 'local-floor', 'hand-tracking', 'unbounded'],
    supportedFrameRates: [90, 96, 100], internalNominalFrameRate: 90, isSystemKeyboardSupported: false,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  });
  const d = new I.XRDevice(cfg, { stereoEnabled: true });
  d.installRuntime({ forceInstall: true });
  d.primaryInputMode = 'hand';
  for (const side of ['left', 'right']) {
    const h = d.hands[side]; if (!h) continue;
    Object.defineProperty(h.inputSource, 'targetRayMode', { get: () => 'transient-pointer' });
    h.connected = false;   // no source until a pinch begins
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // targetLocal: {x,y,z} in IWER (rig-local, floor-relative) space. holdMs is how long the pinch is held: a test that wants to
  // sample the page WHILE the source exists (to prove nothing hovers) passes a longer one and reads in between.
  d.transientPinch = async (side, targetLocal, holdMs = 150, whileHeld) => {
    const h = d.hands[side];
    await d.remote.dispatch('set_transform', { device: 'hand-' + side, position: { x: side === 'right' ? 0.15 : -0.15, y: 1.25, z: -0.3 } });
    await d.remote.dispatch('look_at', { device: 'hand-' + side, target: targetLocal });
    h.connected = true; await sleep(120);                       // source appears
    h.updatePinchValue(1); await sleep(holdMs);                 // selectstart ...
    if (whileHeld) await whileHeld();
    h.updatePinchValue(0); await sleep(120);                    // select, selectend
    h.connected = false; await sleep(120);                      // source disappears
  };
  window.__xrdev = d;
  window.__xrdevice = 'vision';
})();
