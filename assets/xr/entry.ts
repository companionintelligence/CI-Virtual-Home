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

const ICON = '<svg class="vh-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v6a2.5 2.5 0 0 1-2.5 2.5h-3.2a2 2 0 0 1-1.7-.9L12 15l-1.6 1.1a2 2 0 0 1-1.7.9H5.5A2.5 2.5 0 0 1 3 14.5z"/><circle cx="8" cy="11.5" r="1.4"/><circle cx="16" cy="11.5" r="1.4"/></svg>';

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

  // ---- the controls, only where VR is (re-asked when a PC headset is plugged in)
  let btn: HTMLElement | null = null, pill: HTMLElement | null = null, styled = false;
  const hl = host.params.get('xr') === 'vr';
  async function show(on: boolean) {
    if (!on) { if (btn) btn.hidden = true; if (pill) pill.hidden = true; return; }
    if (btn) { btn.hidden = false; if (pill) pill.hidden = false; return; }
    const bar = document.querySelector('.vh-actions'), row = document.querySelector('.vh-row-chips');
    if (!bar) return;
    if (!styled) { styled = true; const st = document.createElement('style'); st.dataset.xr = ''; st.textContent = (await import('./style.js')).XR_CSS; document.head.append(st); }
    const make = (tag: string, cls: string, html: string, label: string) => {
      const b = document.createElement(tag); b.className = cls + ' vh-xr' + (hl ? ' vh-xr-hl' : ''); (b as HTMLButtonElement).type = 'button';
      b.title = label; b.setAttribute('aria-label', label); b.innerHTML = html;
      b.addEventListener('click', () => { api.enter('vr'); });
      for (const ev of ['pointerenter', 'focus', 'touchstart']) b.addEventListener(ev, () => { void load(); }, { passive: true, once: true });
      return b;
    };
    btn = make('button', 'vh-iconbtn', ICON, 'Enter VR');
    bar.insertBefore(btn, bar.querySelector('[data-act="share"]'));
    if (row) { pill = make('button', 'vh-pill vh-xr-pill', ICON + '<span>Enter VR</span>', 'Enter VR'); row.append(pill); }
    const sync = () => { const b = api.state !== 'idle'; for (const e of [btn, pill]) if (e) { e.toggleAttribute('disabled', b); e.setAttribute('aria-busy', String(b)); } };
    for (const s of ['starting', 'started', 'ended', 'error']) api.on(s, sync);
    sync();
  }
  const probe = () => probeXr().then(p => show(!!(p.xr.vr && p.signals.secure)), () => {});
  void probe();
  xr.addEventListener?.('devicechange', probe);
  return api;
}
