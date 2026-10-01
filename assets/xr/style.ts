// assets/xr/style.ts : the Enter VR controls (their CSS and their two buttons), loaded by entry.ts only when a headset or a PC VR
// runtime is really there, so a phone or a laptop with none downloads and parses none of it, and there is no CSS file to hash,
// ship or keep in step with portal/viewer.css. It reuses the player's own classes and tokens (.vh-iconbtn, .vh-pill, .vh-i,
// --primary). Size matters (it is the second thing a headset browser loads on every visit): no comments below this line.
export const XR_CSS = `
.vh-xr-pill { flex: none; margin-left: 6px; padding: 0 14px 0 11px; white-space: nowrap; }
[data-xr-busy] .vh-xr { opacity: 0.6; pointer-events: none; }
.vh-xr-hl { box-shadow: 0 0 0 2px var(--primary), 0 0 0 7px #7773; }
@media (max-width: 760px) { .vh-xr-pill { display: none; } }`;

const ICON = '<svg class="vh-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3l-2-3h-4l-2 3H5a2 2 0 0 1-2-2z"/></svg>';

export function controls(enter: () => void, highlight: boolean, warm: () => void): void {
  const bar = document.querySelector('.vh-actions'), row = document.querySelector('.vh-row-chips');
  if (!bar) return;
  document.head.append(Object.assign(document.createElement('style'), { textContent: XR_CSS }));
  const make = (cls: string, html: string) => {
    const b = Object.assign(document.createElement('button'), { className: cls + ' vh-xr' + (highlight ? ' vh-xr-hl' : ''), title: 'Enter VR', innerHTML: html, onclick: enter, onpointerenter: warm, onfocus: warm });
    b.setAttribute('aria-label', 'Enter VR');
    return b;
  };
  bar.insertBefore(make('vh-iconbtn', ICON), bar.querySelector('[data-act="share"]'));
  row?.append(make('vh-pill vh-xr-pill', ICON + '<span>Enter VR</span>'));
}
