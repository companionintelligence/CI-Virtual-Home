// xrbed.js : the in-page XR test bed. A MINIMAL stand-in for the player's XR module, used (a) to prove the harness itself
// (the negative controls fail as they must, the Vision profile never hovers, the comfort check can fail), and (b) by
// scripts/test-xr.mts --driver bed on a tree that has no assets/xr/ yet. When the player has its own session module the
// tests drive THAT (lib.mts enterSession); the bed is then used only by 00-selftest.mts.
//
// It models, in about 130 lines, exactly what the plan asks of the product: a dolly rig that carries the camera (the person is
// moved by moving the rig, never the XR camera), a Canvas2D panel with three buttons, ray hover (tracked-pointer sources ONLY:
// visionOS has no hover), select/press, haptics, a blink teleport whose rig move happens on a fully black frame, and a stop()
// that puts the camera, renderer and page loop back. It uses only the player's public debug hook (__houseDebug) and three from
// window.__THREE; it touches nothing else, and is never shipped (it lives under scripts/).
window.__bed = (function () {
  const THREE = window.__THREE, T = THREE;
  const B = { log: [], frames: 0, events: [], hover: null, pressed: [], haptics: 0, hoverEver: [] };
  B.start = async function ({ mode = 'immersive-vr', features = ['local-floor', 'hand-tracking'], panelDist = 1.5, pausePageRaf = true } = {}) {
    const { renderer, scene, camera } = window.__houseDebug();
    B.renderer = renderer; B.scene = scene; B.camera = camera;
    B.savedParent = camera.parent; B.savedPos = camera.position.clone(); B.savedQuat = camera.quaternion.clone();
    B.savedCam = { fov: camera.fov, near: camera.near, far: camera.far, zoom: camera.zoom, aspect: camera.aspect, view: camera.view ? Object.assign({}, camera.view) : null, proj: camera.projectionMatrix.clone() };
    B.savedXr = renderer.xr.enabled;
    // dolly: the camera goes inside a rig placed at the player's current eye, floor-relative
    const rig = B.rig = new THREE.Group(); rig.name = 'xr-rig';
    const wp = new THREE.Vector3(); camera.getWorldPosition(wp);
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    rig.position.set(wp.x, wp.y - 1.6, wp.z); rig.rotation.y = Math.atan2(-dir.x, -dir.z);
    scene.add(rig); rig.add(camera); camera.position.set(0, 0, 0); camera.quaternion.identity();
    // panel (Canvas2D texture) 0.9 x 0.4 m, panelDist ahead of the head, at eye height
    const W = 1024, H = 456, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const buttons = [{ id: 'prev', label: 'Back', x: 40, y: 280, w: 280, h: 130 }, { id: 'pause', label: 'Pause', x: 372, y: 280, w: 280, h: 130 }, { id: 'next', label: 'Next', x: 704, y: 280, w: 280, h: 130 }];
    B.buttons = buttons; B.state = { hover: null, down: null, last: null, count: 0 };
    const draw = () => {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(14,18,28,0.92)'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 40); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '600 52px Manrope, sans-serif'; ctx.fillText('The kitchen', 40, 90);
      ctx.font = '400 38px Manrope, sans-serif'; ctx.fillStyle = '#d6dbe6'; ctx.fillText('Select a button with the ray.', 40, 160); ctx.fillText('pressed: ' + B.state.count + ' last: ' + (B.state.last || '-'), 40, 215);
      for (const b of buttons) { ctx.fillStyle = b.id === B.state.down ? '#ff8a3d' : b.id === B.state.hover ? '#3b82f6' : '#2a3347'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 28); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '600 46px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 16); ctx.textAlign = 'left'; }
      tex.needsUpdate = true;
    };
    draw();
    const panel = B.panel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
    panel.position.set(0, 1.5, -panelDist); panel.name = 'xr-panel'; rig.add(panel); B.draw = draw; B.tex = tex;
    // controllers (rays) on the rig. userData.src is set while a source is connected: its targetRayMode decides whether hover exists.
    B.ctrl = [0, 1].map(i => {
      const c = renderer.xr.getController(i); rig.add(c);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -3)]), new THREE.LineBasicMaterial({ color: 0xffffff })); line.name = 'ray'; c.add(line);
      const mk = (name) => (e) => { B.events.push({ n: name, i, t: performance.now(), src: e.data ? e.data.handedness + '/' + e.data.targetRayMode : null }); };
      c.addEventListener('connected', (e) => { c.userData.src = e.data; B.events.push({ n: 'connected', i, h: e.data.handedness, m: e.data.targetRayMode }); });
      c.addEventListener('disconnected', () => { c.userData.src = null; B.events.push({ n: 'disconnected', i }); if (B.state.down && B.downBy === i) { B.state.down = null; B.cancelled = (B.cancelled || 0) + 1; draw(); } });
      c.addEventListener('selectstart', (e) => { mk('selectstart')(e); const h = B.hit(c); if (h) { B.state.down = h.id; B.downBy = i; draw(); B.buzz(c, 0.3, 30); } });
      c.addEventListener('selectend', (e) => { mk('selectend')(e); if (B.state.down) { B.state.down = null; draw(); } });
      // a press that was cancelled (source lost / system overlay) must not count as a select
      c.addEventListener('select', (e) => { mk('select')(e); if (B.hidden) return; const h = B.hit(c); if (h) { B.state.last = h.id; B.state.count++; B.pressed.push(h.id); draw(); } });
      return c;
    });
    B.ray = new THREE.Raycaster(); const m4 = new THREE.Matrix4();
    B.hitPanel = (c) => {               // where the controller's ray meets the panel, whatever the source type
      m4.identity().extractRotation(c.matrixWorld); B.ray.ray.origin.setFromMatrixPosition(c.matrixWorld); B.ray.ray.direction.set(0, 0, -1).applyMatrix4(m4);
      const h = B.ray.intersectObject(panel, false)[0]; if (!h) return null;
      const px = h.uv.x * W, py = (1 - h.uv.y) * H; return buttons.find(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) || null;
    };
    B.hit = (c) => (c.userData.src ? B.hitPanel(c) : null);   // only a connected source can press
    B.buzz = (c, intensity, ms) => { try { const g = c.userData.src && c.userData.src.gamepad; const a = g && (g.hapticActuators && g.hapticActuators[0]); if (a && a.pulse) { a.pulse(intensity, ms); B.haptics++; } else if (g && g.vibrationActuator) { g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: intensity, weakMagnitude: intensity }); B.haptics++; } } catch (e) { B.hapticErr = String(e); } };
    renderer.xr.enabled = true;
    const sess = B.session = await navigator.xr.requestSession(mode, { optionalFeatures: features });
    sess.addEventListener('end', () => B.events.push({ n: 'session-end' }));
    sess.addEventListener('visibilitychange', () => { B.hidden = sess.visibilityState === 'hidden'; if (B.hidden && B.state.down) { B.state.down = null; B.cancelled = (B.cancelled || 0) + 1; draw(); } });
    await renderer.xr.setSession(sess);
    // page rAF is paused during a headset session: emulate that, but let IWER's own device frame through
    if (pausePageRaf) { B.realRaf = window.requestAnimationFrame; const real = B.realRaf.bind(window); window.requestAnimationFrame = (cb) => (cb && cb.name === 'onDeviceFrame') ? real(cb) : 0; }
    const gl = renderer.getContext();
    B.initBlink();
    // renderer.xr.setAnimationLoop, not renderer.setAnimationLoop: the latter also starts a SECOND loop on the page's rAF (measured)
    renderer.xr.setAnimationLoop((t, frame) => {
      const c0 = performance.now(); B.frames++; B.stepBlink(c0);
      for (let i = 0; i < 2; i++) {
        const c = B.ctrl[i]; const src = c.userData.src;
        // hover exists for tracked-pointer sources ONLY (visionOS transient-pointer has no hover; a gaze source has none either)
        const id = (src && src.targetRayMode === 'tracked-pointer' && !B.hidden) ? ((B.hitPanel(c) || {}).id || null) : null;
        if (src && src.targetRayMode === 'tracked-pointer' && (i === 1 || !B.ctrl[1].userData.src)) if (id !== B.state.hover) { B.state.hover = id; if (id) B.hoverEver.push(id); draw(); }
      }
      renderer.render(scene, camera); if (B.logOn) B.logMotion();
      B.last = { cpu: performance.now() - c0, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geoms: renderer.info.memory.geometries, tex: renderer.info.memory.textures, programs: renderer.info.programs.length, err: gl.getError() };
    });
    return { mode, sources: sess.inputSources.length };
  };
  B.eyes = () => { const xc = B.renderer.xr.getCamera(); return xc.cameras.map(c => ({ vp: c.viewport.toArray(), pos: c.matrixWorld.elements.slice(12, 15).map(v => +v.toFixed(4)), fovy: +(2 * Math.atan(1 / c.projectionMatrix.elements[5]) * 180 / Math.PI).toFixed(2), proj0: c.projectionMatrix.elements[0] })); };
  // project a panel point into the left eye's viewport pixel and read it back from the default framebuffer
  B.pixelAtButton = (id) => {
    const b = B.buttons.find(x => x.id === id);
    const p = new THREE.Vector3((b.x + b.w / 2) / 1024 * 0.9 - 0.45, (1 - (b.y + b.h / 2) / 456) * 0.4 - 0.2, 0); B.panel.localToWorld(p);
    const cam = B.renderer.xr.getCamera().cameras[0]; const v = p.clone().project(cam); const vp = cam.viewport;
    const x = Math.round(vp.x + (v.x * 0.5 + 0.5) * vp.z), y = Math.round(vp.y + (v.y * 0.5 + 0.5) * vp.w);
    const gl = B.renderer.getContext(); const buf = new Uint8Array(4); gl.finish(); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf); return { x, y, rgba: Array.from(buf) };
  };
  B.eyeDiff = () => { // left half vs right half of the default framebuffer along the middle row: stereo parallax proof
    const gl = B.renderer.getContext(), cv = B.renderer.domElement, w = cv.width, h = cv.height, half = w >> 1; const row = Math.floor(h * 0.5);
    gl.finish(); gl.bindFramebuffer(gl.FRAMEBUFFER, null); const a = new Uint8Array(half * 4), b = new Uint8Array(half * 4);
    gl.readPixels(0, row, half, 1, gl.RGBA, gl.UNSIGNED_BYTE, a); gl.readPixels(half, row, half, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
    let d = 0, nz = 0; for (let i = 0; i < a.length; i += 4) { d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); if (a[i] + a[i + 1] + a[i + 2] > 12) nz++; } return { w, h, diffPerPx: +(d / half).toFixed(2), litLeft: nz / half };
  };

  // ---- comfort: blink teleport with a fade; the rig moves only on a fully black frame ----------------------------------------
  B.blink = { phase: 'idle', t0: 0, alpha: 0, target: null, outMs: 120, inMs: 140, done: null };
  B.motionLog = [];
  B.initBlink = function () {
    const m = new T.Mesh(new T.PlaneGeometry(4, 4), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
    m.renderOrder = 9999; m.frustumCulled = false; m.position.set(0, 0, -0.12); m.name = 'xr-fade'; B.camera.add(m); B.fade = m;   // the harness finds the fade by this name
  };
  B.blinkTo = function (feet, yawRad) {   // feet: rig-world position the HEAD must end above; yaw: where the head should look (radians, about +y)
    return new Promise((res) => { B.blink = Object.assign(B.blink, { phase: 'out', t0: performance.now(), target: { feet, yaw: yawRad }, done: res }); });
  };
  B.stepBlink = function (now) {
    const b = B.blink; if (b.phase === 'idle') return; const e = now - b.t0;
    if (b.phase === 'out') { b.alpha = Math.min(1, e / b.outMs); if (b.alpha >= 1) { b.phase = 'swap'; } }
    else if (b.phase === 'swap') {   // this frame is fully black: move the rig now (head-relative so the head, not the rig origin, lands on target)
      const xr = B.renderer.xr.getCamera(); const head = new T.Vector3().setFromMatrixPosition(xr.matrixWorld); const rig = B.rig;
      const headLocal = rig.worldToLocal(head.clone()); const fwd = new T.Vector3(0, 0, -1).applyQuaternion(B.camera.quaternion);
      const headYaw = Math.atan2(-fwd.x, -fwd.z); rig.rotation.y = b.target.yaw - headYaw;
      const hl = new T.Vector3(headLocal.x, 0, headLocal.z).applyAxisAngle(new T.Vector3(0, 1, 0), rig.rotation.y);
      rig.position.set(b.target.feet[0] - hl.x, b.target.feet[1], b.target.feet[2] - hl.z); rig.updateMatrixWorld(true);
      b.phase = 'in'; b.t0 = now;
    } else if (b.phase === 'in') { b.alpha = Math.max(0, 1 - (now - b.t0) / b.inMs); if (b.alpha <= 0) { b.phase = 'idle'; const d = b.done; b.done = null; d && d(true); } }
    B.fade.material.opacity = b.alpha;
  };
  B.logMotion = function () {
    const xr = B.renderer.xr.getCamera(); const p = new T.Vector3().setFromMatrixPosition(xr.matrixWorld); B.motionLog.push({ f: B.frames, a: +B.blink.alpha.toFixed(3), p: [p.x, p.y, p.z], ph: B.blink.phase });
  };

  B.stop = async function () {
    const { renderer, scene, camera } = B; const s = B.session;
    await s.end(); await new Promise(r => setTimeout(r, 200));
    renderer.xr.setAnimationLoop(null); renderer.xr.enabled = B.savedXr; if (B.realRaf) window.requestAnimationFrame = B.realRaf;
    B.rig.remove(camera); if (B.savedParent) B.savedParent.add(camera); camera.position.copy(B.savedPos); camera.quaternion.copy(B.savedQuat);
    // three's WebXRManager overwrites fov/near/far/aspect/projection and never restores them: the bed does (window.__bedNoCamRestore = true is the negative control)
    if (!window.__bedNoCamRestore) { const c = B.savedCam; camera.fov = c.fov; camera.near = c.near; camera.far = c.far; camera.zoom = c.zoom; camera.aspect = c.aspect; camera.updateProjectionMatrix(); }
    B.rig.removeFromParent(); B.panel.geometry.dispose(); B.panel.material.dispose(); B.tex.dispose();
    for (const c of B.ctrl) { c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); c.removeFromParent(); } if (B.fade) { B.camera.remove(B.fade); B.fade.geometry.dispose(); B.fade.material.dispose(); B.fade = null; }
    return { presenting: renderer.xr.isPresenting, camParentIsScene: camera.parent === scene };
  };
  return B;
})();
