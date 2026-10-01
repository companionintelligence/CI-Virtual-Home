// assets/xr/style.ts : the Enter VR controls' CSS, as a string. entry.ts injects it (a <style data-xr>) only when a headset or a
// PC VR runtime is really there, so a phone or a laptop with none downloads and parses none of it, and there is no CSS file to
// hash, ship or keep in step with portal/viewer.css. It reuses the player's own tokens and classes (.vh-iconbtn, .vh-pill,
// .vh-i): no colour or size of its own except where a state needs one.
export const XR_CSS = `
.vh-xr[hidden] { display: none; }
.vh-xr-pill { flex: none; margin-left: 6px; padding: 0 14px 0 11px; white-space: nowrap; cursor: pointer; }
.vh-xr-pill .vh-i { width: 17px; height: 17px; }
.vh-xr-pill[aria-busy="true"], .vh-xr[aria-busy="true"] { opacity: 0.6; pointer-events: none; }
.vh-xr[aria-busy="true"] .vh-i { animation: vh-xr-pulse 1s ease-in-out infinite; }
/* ?xr=vr (a link that was made to be watched in a headset): the control says so, but a session still needs the tap */
.vh-xr-hl { box-shadow: 0 0 0 2px var(--primary), 0 0 0 7px color-mix(in srgb, var(--primary) 28%, transparent); animation: vh-xr-glow 1.8s ease-in-out infinite; }
.vh-iconbtn.vh-xr-hl { color: var(--primary); }
@keyframes vh-xr-pulse { 50% { opacity: 0.35; } }
@keyframes vh-xr-glow { 50% { box-shadow: 0 0 0 2px var(--primary), 0 0 0 11px color-mix(in srgb, var(--primary) 8%, transparent); } }
@media (prefers-reduced-motion: reduce) { .vh-xr-hl, .vh-xr[aria-busy="true"] .vh-i { animation: none; } }
@media (max-width: 760px) { .vh-xr-pill { display: none; } }   /* a narrow window keeps the top bar's button; the dock row is for scroll-free room */
`;
