// assets/xr/entry.ts : the only XR code a visitor downloads before asking for it. Loaded by viewer.ts unless ?no=xr.
//
// viewer.ts imports it ONLY where navigator.xr.isSessionSupported('immersive-vr') said yes in a secure context (and again on the
// browser's 'devicechange', a PC headset plugged in): on a phone, a laptop with no headset and iPhone Safari (no navigator.xr at
// all) this file is never requested and the page is exactly what it was, with no dead control. Where VR exists it adds an "Enter
// VR" icon button to the top bar and a primary pill in the dock (style.ts; in a headset browser the 2D page is a floating window,
// so finding the way in is the whole problem), and a facade at window.__houseViewer.xr that the story director and the tests
// drive. Everything else (session, bake, locomotion, UI kit) is imported on the first tap.
//
// The tap: requestSession is called HERE, synchronously, inside the click. A session needs a user gesture; a gesture is spent
// by time and, in some browsers, by awaiting a network import. So the request goes out first and the modules load while the
// browser asks the person. (?xr=vr only highlights the button: a session cannot start without a tap.)
// Size matters (this is on every first load, and test-session's `weight` checks it): no comments below this line, no helpers.
let api: any;

export function mountXr(host: any): any {
  if (api) return api;
  const xr: any = (navigator as any).xr, G: any = globalThis, html = document.documentElement;
  let real: any, busy = false, mod: Promise<any>;
  const frame = new Set(), none = () => null, load = () => (mod ||= import('./session.js'));
  api = {
    get state() { return busy ? 'starting' : 'idle'; }, mode: null, tier: null, end: () => Promise.resolve(), ui: none, locomotion: none, rig: none, debug: none,
    on: (ev: string, cb: (d: any) => void) => { const f = (e: any) => { if (e.detail.state === ev) cb(e.detail); }; addEventListener('vh:xr', f); return () => removeEventListener('vh:xr', f); },
    onFrame: (cb: any) => { frame.add(cb); return () => frame.delete(cb); },
    enter(mode: string) {
      const done = (r: any) => { busy = false; html.toggleAttribute('data-xr-busy', false); if (!r.ok) host.toast(r.message); return r; };
      if (api.state !== 'idle' || html.dataset.viewer !== 'ready') return Promise.resolve(done({ message: 'Wait a moment, then try again.' }));
      const layers = G.XRWebGLBinding?.prototype.createProjectionLayer && host.params.get('xrlayers') !== '0' ? ['layers'] : [];
      busy = true; html.toggleAttribute('data-xr-busy', true);
      const req = mode === 'vr' ? xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', ...layers] }) : null;
      req?.catch(none);
      return load().then(m => {
        if (!real) { real = m.createSession(host, frame); for (const k of ['state', 'mode', 'tier', 'end', 'ui', 'locomotion', 'rig', 'debug']) Object.defineProperty(api, k, Object.getOwnPropertyDescriptor(real, k)!); }
        return real.enter(mode, req);
      }, () => { req?.then((s: any) => s.end(), none); return { message: 'The player could not load VR. Check the connection.' }; }).then(done);
    },
  };
  G.__houseViewer.xr = api;
  import('./style.js').then(m => m.controls(() => api.enter('vr'), host.params.get('xr') === 'vr', load));
  return api;
}
