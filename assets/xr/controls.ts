// assets/xr/controls.ts : the Enter VR button (top bar) and pill (dock), built only where VR is supported. Loaded by entry.ts after
// the probe says so, so the entry itself stays tiny and a browser with no VR never parses the icon, the CSS or this.
import { XR_CSS } from './style.js';

const ICON = '<svg class="vh-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v6a2.5 2.5 0 0 1-2.5 2.5h-3.2a2 2 0 0 1-1.7-.9L12 15l-1.6 1.1a2 2 0 0 1-1.7.9H5.5A2.5 2.5 0 0 1 3 14.5z"/><circle cx="8" cy="11.5" r="1.4"/><circle cx="16" cy="11.5" r="1.4"/></svg>';

/** show (or hide) the controls. `highlight`: ?xr=vr, which only draws the eye to them (a session still needs the tap). `warm`: start loading the session modules. */
export function showControls(api: any, on: boolean, highlight: boolean, warm: () => void): void {
  const els = Array.from(document.querySelectorAll<HTMLElement>('.vh-xr'));
  if (els.length || !on) { for (const e of els) e.hidden = !on; return; }
  const bar = document.querySelector('.vh-actions'), row = document.querySelector('.vh-row-chips');
  if (!bar) return;
  const st = document.createElement('style'); st.dataset.xr = ''; st.textContent = XR_CSS; document.head.append(st);
  const make = (cls: string, html: string) => {
    const b = document.createElement('button'); b.className = cls + ' vh-xr' + (highlight ? ' vh-xr-hl' : ''); b.type = 'button';
    b.title = 'Enter VR'; b.setAttribute('aria-label', 'Enter VR'); b.innerHTML = html;
    b.addEventListener('click', () => { api.enter('vr'); });
    for (const ev of ['pointerenter', 'focus', 'touchstart']) b.addEventListener(ev, warm, { passive: true, once: true });
    return b;
  };
  bar.insertBefore(make('vh-iconbtn', ICON), bar.querySelector('[data-act="share"]'));
  if (row) row.append(make('vh-pill vh-xr-pill', ICON + '<span>Enter VR</span>'));
  const sync = () => { const busy = api.state !== 'idle'; for (const e of document.querySelectorAll<HTMLElement>('.vh-xr')) { e.toggleAttribute('disabled', busy); e.setAttribute('aria-busy', String(busy)); } };
  for (const s of ['starting', 'started', 'ended', 'error']) api.on(s, sync);
  sync();
}
