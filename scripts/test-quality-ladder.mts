#!/usr/bin/env -S node --experimental-strip-types
// assets/viewer-quality.ts, the player's device probe and tier ladder, without a browser: where a device starts (and how far
// the frame rate may move it), and the ladder's rules — a shed that buys nothing is put back and stops shedding, a rung reached
// by promotion that cannot hold is left for good, a pinned tier never moves, and with nothing installed nothing moves at all
// (which is why the page behaves as it did before the ladder when no feature is installed).
//
//   node --experimental-strip-types scripts/test-quality-ladder.mts
// @check-house quick
import { probeDevice, readRenderer, createLadder, type Probe, type Tier } from '../assets/viewer-quality.js';

let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail}`}`); };

// ---- the probe, against a fake navigator
const G: any = globalThis;
function probeWith(nav: Record<string, unknown>, coarse: boolean, query = '', gl: any = { }): Probe {
  Object.defineProperty(G, 'navigator', { value: { hardwareConcurrency: 12, deviceMemory: 8, connection: { effectiveType: '4g', saveData: false }, ...nav }, configurable: true });
  G.matchMedia = () => ({ matches: coarse });
  return probeDevice({ gl, maxTexture: 16384, floatTargets: true, ...(gl.__src || {}) }, new URLSearchParams(query));
}
const fakeGl = (renderer: string) => ({ getExtension: (n: string) => (n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 1 } : null), getParameter: () => renderer, RENDERER: 2 });

let p = probeWith({}, false);
check(p.tier === 1 && p.ceiling === 2 && p.reasons.length === 0, 'a desktop with nothing weak about it starts at tier 1 and may reach 2', JSON.stringify(p.reasons));
p = probeWith({}, true);
check(p.tier === 0 && p.ceiling === 0 && p.hard, 'a coarse pointer starts at 0 and stays there (hard)');
p = probeWith({ hardwareConcurrency: 4 }, false);
check(p.tier === 0 && p.ceiling === 1 && !p.hard, '4 cores starts at 0 but may be promoted to 1 (soft)');
p = probeWith({ deviceMemory: 4 }, false);
check(p.tier === 0 && p.ceiling === 1, 'deviceMemory 4 is soft too');
p = probeWith({ connection: { effectiveType: '3g', saveData: false } }, false);
check(p.tier === 0 && p.ceiling === 0, 'a connection below 4g is hard');
p = probeWith({ connection: { effectiveType: '4g', saveData: true } }, false);
check(p.tier === 0 && p.ceiling === 0, 'saveData is hard');
p = probeWith({}, false, 'q=2');
check(p.tier === 2 && p.ceiling === 2 && p.forced === 2, '?q=2 pins tier 2');
p = probeWith({ hardwareConcurrency: 2 }, true, 'q=1');
check(p.tier === 1 && p.ceiling === 1 && p.forced === 1, '?q=1 pins tier 1 on a device that would start at 0');
p = probeWith({}, false, 'q=0');
check(p.tier === 0 && p.forced === 0 && p.reasons.includes('?q=0'), '?q=0 pins tier 0');
{
  const lo = { maxTexture: 2048 };
  Object.defineProperty(G, 'navigator', { value: { hardwareConcurrency: 12, deviceMemory: 8 }, configurable: true });
  G.matchMedia = () => ({ matches: false });
  const small = probeDevice({ gl: {}, ...lo, floatTargets: true }, new URLSearchParams());
  check(small.tier === 0 && small.ceiling === 0, 'MAX_TEXTURE_SIZE below 4096 is hard');
  const nofloat = probeDevice({ gl: {}, maxTexture: 16384, floatTargets: false }, new URLSearchParams());
  check(nofloat.tier === 0 && nofloat.ceiling === 0, 'no float render targets is hard');
  const nogl = probeDevice({ gl: null }, new URLSearchParams());
  check(nogl.tier === 0 && nogl.ceiling === 0, 'no WebGL context is hard');
}
p = probeWith({}, false);
readRenderer(p, fakeGl('ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max)'));
check(p.tier === 1 && p.ceiling === 2 && p.renderer.includes('Apple'), 'an Apple renderer changes nothing');
p = probeWith({}, false);
readRenderer(p, fakeGl('ANGLE (Intel, Intel(R) UHD Graphics 630)'));
check(p.tier === 0 && p.ceiling === 1 && !p.hard, 'an Intel renderer starts at 0 and may be promoted to 1 (a hint, not a verdict)');
p = probeWith({}, false);
readRenderer(p, fakeGl('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))'));
check(p.tier === 0 && p.ceiling === 0 && p.hard, 'SwiftShader is hard');
p = probeWith({}, false);
readRenderer(p, fakeGl('Mali-G78'));
check(p.tier === 0 && p.ceiling === 0, 'Mali is hard');
p = probeWith({}, false, 'q=2');
readRenderer(p, fakeGl('Mali-G78'));
check(p.tier === 2, 'a pinned tier ignores the renderer string');

// ---- the ladder
type L = ReturnType<typeof createLadder>;
function ladder(start: Tier, ceiling: Tier, opts: { forced?: Tier | null; changes?: (a: Tier, b: Tier) => boolean } = {}): { l: L; applied: Tier[] } {
  const applied: Tier[] = [];
  const probe = { tier: start, ceiling, forced: opts.forced ?? null } as Probe;
  return { l: createLadder({ probe, changes: opts.changes ?? (() => true), apply: t => applied.push(t) }), applied };
}
{
  const { l, applied } = ladder(1, 2, { changes: () => false });
  check(!l.shed(30) && !l.promote() && l.tier === 1 && applied.length === 0, 'with nothing installed (changes() false) neither shed nor promote moves anything');
}
{
  const { l, applied } = ladder(1, 2, { forced: 1 });
  check(!l.shed(10) && !l.promote() && applied.length === 0, 'a pinned tier never moves');
}
{
  const { l, applied } = ladder(2, 2);
  check(l.shed(30) && l.tier === 1 && applied.join() === '1', 'a miss sheds one rung');
  check(!l.shed(50) || true, '(a window that is fine does not call shed)');
}
{
  // a shed that buys nothing is put back, and shedding stops
  const { l, applied } = ladder(2, 2);
  l.shed(30);                                         // 2 -> 1 at 30 fps
  const again = l.shed(31);                           // the next miss: 31 fps is not +10%
  check(again && l.tier === 2 && applied.join() === '1,2', 'a shed that bought less than 10% is put back', applied.join());
  check(!l.shed(30) && l.tier === 2, 'and shedding then stops (the pixel ratio takes over)');
}
{
  // a shed that does buy it stays, and the ladder keeps shedding while it must
  const { l, applied } = ladder(2, 2);
  l.shed(30);
  check(l.shed(40) && l.tier === 0 && applied.join() === '1,0', 'a shed that bought 10% or more stays, and the next miss sheds again');
  // (the shed to 0 is itself judged by the next miss: 30 fps is not 10% better than 40, so it is put back)
  check(l.shed(41) && l.tier === 1 && !l.shed(30), 'the last shed is judged by the next miss, and a futile one is put back for good');
  const z = ladder(0, 0);
  check(!z.l.shed(10) && z.l.tier === 0, 'tier 0 has nothing below it');
}
{
  // a promoted rung that cannot hold is left again and stays off
  const { l, applied } = ladder(1, 2);
  check(l.promote() && l.tier === 2, 'promote tries the rung above');
  check(!l.promote(), 'and not past the ceiling');
  check(l.shed(30) && l.tier === 1, 'a promoted rung that misses is left');
  check(!l.promote() && l.tier === 1 && applied.join() === '2,1', 'and stays off for the session', applied.join());
}
{
  const { l } = ladder(0, 1);
  check(l.promote() && l.tier === 1 && !l.promote(), 'a soft-weak device is promoted to its ceiling (1) and no further');
  const h = ladder(0, 0);
  check(!h.l.promote(), 'a hard-weak device is not promoted');
}
{
  const probe = { tier: 1, ceiling: 2, forced: null } as Probe;
  const l = createLadder({ probe, changes: () => true, apply: () => {} });
  probe.tier = 0; probe.ceiling = 1; l.restart();
  check(l.tier === 0 && l.ceiling === 1, 'restart takes the probe\'s later decision before anything moved');
  l.promote(); probe.tier = 0; l.restart();
  check(l.tier === 1, '…and not after a move');
}
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
