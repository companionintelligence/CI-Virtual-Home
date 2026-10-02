// A FAKE product XR module, for validating the harness itself before (and independent of) the real one. It copies a built dist/
// to a temp directory and adds assets/xr/entry.js + assets/xr/session.js and a one-line mount in room-creator.html, in the shape the
// plan gives the product: the entry is tiny and mounts after the player is ready (unless ?no=xr), shows an Enter VR button when
// immersive-vr is supported, and imports session.js ONLY when the button is tapped; session.js is the in-page bed (xrbed.js).
// Variants are NEGATIVE CONTROLS for the lazy-loading test: `eager` imports session.js at once, `heavy` pads entry.js by ~4 KB
// of incompressible text, `cdn` makes the session fetch from cdn.jsdelivr.net. None of this is ever shipped: it lives in $TMPDIR.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { HERE } from './lib.mts';

export interface FakeOpts { eager?: boolean; heavy?: boolean; cdn?: boolean }

export function makeFakeXrTree(srcDist: string, o: FakeOpts = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xr-fake-'));
  fs.cpSync(srcDist, dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets', 'xr'), { recursive: true });
  const pad = o.heavy ? `\n/* ${crypto.randomBytes(3200).toString('base64')} */\n` : '';
  fs.writeFileSync(path.join(dir, 'assets', 'xr', 'entry.js'), `// fake entry (harness validation only)
export async function mountXr() {
  const V = window.__houseViewer; if (!V) return;
  const xr = V.xr = { state: 'idle', mode: null, tier: null, _l: {},
    async enter(mode) { if (xr.state !== 'idle') return { ok: false, reason: 'error', message: 'busy' }; xr.state = 'starting'; const m = await import('./session.js'); return m.enter(xr, mode); },
    async end(why) { if (xr.state === 'idle') return; const m = await import('./session.js'); return m.end(xr, why); },
    on(ev, cb) { (xr._l[ev] ||= []).push(cb); return () => {}; }, onFrame() { return () => {}; }, ui() { return null; }, locomotion() { return null; } };
  if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-vr').catch(() => false))) return;
  const b = document.createElement('button'); b.setAttribute('data-xr-enter', ''); b.textContent = 'Enter VR';
  b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:50;padding:10px 14px'; b.addEventListener('click', () => xr.enter('vr')); document.body.appendChild(b);
${o.eager ? "  await import('./session.js');" : ''}
}
${pad}`);
  const bed = fs.readFileSync(path.join(HERE, 'xrbed.js'), 'utf8');
  fs.writeFileSync(path.join(dir, 'assets', 'xr', 'session.js'), `// fake session (harness validation only): the bed
${bed}
${o.cdn ? "try { fetch('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/webxr/XRControllerModelFactory.js').catch(() => {}); } catch (e) {}" : ''}
export async function enter(xr, mode) {
  try { await window.__bed.start({}); } catch (e) { xr.state = 'idle'; return { ok: false, reason: 'error', message: String(e) }; }
  xr.state = 'running'; xr.mode = 'vr'; xr.tier = { name: 'xr-standalone', gen: 'gen2' };
  window.dispatchEvent(new CustomEvent('vh:xr', { detail: { state: 'started', mode: 'vr' } })); return { ok: true };
}
export async function end(xr, why) { xr.state = 'ending'; await window.__bed.stop(); xr.state = 'idle'; xr.mode = null; window.dispatchEvent(new CustomEvent('vh:xr', { detail: { state: 'ended', mode: 'vr', reason: why } })); }
`);
  const html = path.join(dir, 'room-creator.html');
  const s = fs.readFileSync(html, 'utf8');
  const mount = `<script type="module">if (!(new URLSearchParams(location.search).get('no') || '').split(',').includes('xr')) { const w = setInterval(() => { if (document.documentElement.dataset.viewer === 'ready') { clearInterval(w); import('./assets/xr/entry.js').then(m => m.mountXr()); } }, 50); }</script>`;
  fs.writeFileSync(html, s.replace('</body>', mount + '\n</body>'));
  return dir;
}
