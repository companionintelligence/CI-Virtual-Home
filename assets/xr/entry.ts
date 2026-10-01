// assets/xr/entry.ts : the only XR code a visitor downloads before asking for it (about 1 KB). Loaded by viewer.ts unless ?no=xr.
//
// It shows NOTHING unless the browser says immersive-vr is supported in a secure context: on a phone, a laptop with no headset
// and iPhone Safari (no navigator.xr at all) the page is exactly what it was, with no dead control. Where VR exists it adds
// an "Enter VR" icon button to the top bar and a primary "Enter VR" pill in the dock (in a headset browser the 2D page is a
// floating window, so finding the way in is the whole problem), and a facade at window.__houseViewer.xr that the story
// director and the tests drive. Everything else (session, bake, locomotion, UI kit) is imported on the first tap.
//
// The tap: requestSession is called HERE, synchronously, inside the click. A session needs a user gesture; a gesture is spent
// by time and, in some browsers, by awaiting a network import. So the request goes out first and the modules load while the
// browser asks the person. (?xr=vr only highlights the button: a session cannot start without a tap.)
import { probeXr } from '../platform.js';
import type { XrPlayerHost, XrBus, XrSessionImpl } from './session.js';

export function mountXr(host: XrPlayerHost): any {
  const xr: any = (navigator as any).xr;
  if (!xr || !(globalThis as any).isSecureContext) return null;
  let real: XrSessionImpl | null = null, busy = false, loading: Promise<typeof import('./session.js')> | null = null;
  const load = () => (loading ||= import('./session.js'));
  const bus: XrBus = {
    frame: new Set(),
    emit: (state, detail) => window.dispatchEvent(new CustomEvent('vh:xr', { detail: { state, ...detail } })),
  };
  const sessionInit = () => ({ optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', ...(typeof (globalThis as any).XRWebGLBinding === 'function' && (globalThis as any).XRWebGLBinding.prototype.createProjectionLayer && host.params.get('xrlayers') !== '0' ? ['layers'] : [])] });
  const api: any = {
    get state() { return real && real.state !== 'idle' ? real.state : busy ? 'starting' : 'idle'; },
    get mode() { return real ? real.mode : null; },
    get tier() { return real ? real.tier : null; },
    enter(mode: 'vr' | 'ar') {
      const no = (reason: string, message: string) => { host.toast(message); return Promise.resolve({ ok: false, reason, message }); };
      if (busy || (real && real.state !== 'idle')) return no('error', 'VR is already starting.');
      if (mode !== 'vr') return no('unsupported', 'Augmented reality is not available yet.');
      if (document.documentElement.dataset.viewer !== 'ready') return no('error', 'Wait for the home to finish loading, then try again.');
      busy = true;
      const req = xr.requestSession('immersive-vr', sessionInit());   // inside the gesture, before any await
      req.catch(() => {});
      return load().then(m => (real ||= m.createSession(host, bus)).enter(mode, req), () => {
        req.then((s: any) => s.end(), () => {});
        return { ok: false, reason: 'error', message: 'Part of the player did not download. Check the connection and try again.' };
      }).then((r: any) => { busy = false; if (!r.ok) host.toast(r.message); return r; });
    },
    end: (why: string) => (real ? real.end(why) : Promise.resolve()),
    on: (ev: string, cb: (d: any) => void) => { const f = (e: any) => { if (e.detail && e.detail.state === ev) cb(e.detail); }; window.addEventListener('vh:xr', f); return () => window.removeEventListener('vh:xr', f); },
    onFrame: (cb: any) => { bus.frame.add(cb); return () => { bus.frame.delete(cb); }; },
    ui: () => (real ? real.ui() : null),
    locomotion: () => (real ? real.locomotion() : null),
    rig: () => (real ? real.rig() : null),
    debug: () => (real ? real.debug() : null),
  };
  (window as any).__houseViewer.xr = api;

  const probe = () => probeXr().then(p => p.xr.vr && p.signals.secure ? import('./controls.js').then(c => c.showControls(api, true, host.params.get('xr') === 'vr', () => { void load(); })) : null, () => {});
  void probe();
  // a PC headset plugged in or out later
  xr.addEventListener?.('devicechange', () => probeXr().then(p => {
    const on = !!(p.xr.vr && p.signals.secure);
    if (on) import('./controls.js').then(c => c.showControls(api, true, false, () => { void load(); }));
    else document.querySelectorAll<HTMLElement>('.vh-xr').forEach(e => { e.hidden = true; });
  }));
  return api;
}
