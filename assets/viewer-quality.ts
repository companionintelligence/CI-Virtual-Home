// The player's quality tier: a quick device probe that picks where to start, and the ladder that moves between
// tiers while the page runs. assets/realism.ts holds the effects; this decides how many of them a device gets.
//
//   tier 0  today's page. Nothing from the realism registry whose minTier is above 0 runs.
//   tier 1  the cheap effects (a package's budget at this tier: 0.4 ms of CPU and 8 draw calls).
//   tier 2  everything: the lazily loaded heavy parts (ocean, big textures) and the dearer paths.
//
// START. Tier 0 on any sign of a weak device (below), tier 1 otherwise; tier 2 is only ever reached by promotion,
// after the page has shown it holds the frame rate. The probe is a hint: the renderer string in particular decides
// nothing alone, because the frame rate corrects it in both directions. A device that failed only the SOFT checks (an
// integrated Intel GPU, few cores, little memory) may be promoted as far as tier 1; one that failed a HARD check (a
// touch screen, saved data, a software or mobile GPU, no float render targets, small textures) stays where it is.
// ?q=0|1|2 pins the tier (the ladder then never moves it): for tests, for A/B timing, and for anyone who wants it.
//
// MOVING. viewer.ts's ADAPT block calls shed() on a window below 42 fps, BEFORE it touches the pixel ratio, and
// promote() after 3 s of >= 58 fps. A rung is a trial: a shed that does not buy 10% more frames is put back and the
// ladder stops shedding (the pixel ratio logic takes over, as before); a rung reached by promotion that cannot hold
// the frame rate is left again and stays off for the session. With nothing installed there is nothing to move, so
// both return false and the page behaves exactly as it did before the ladder existed.
export type Tier = 0 | 1 | 2;

export type Probe = {
  tier: Tier;              // where the page starts
  ceiling: Tier;           // the highest tier promotion may reach
  forced: Tier | null;     // ?q=
  reasons: string[];       // why tier 0, empty at tier 1
  hard: boolean;
  renderer: string;        // the unmasked renderer string, a hint
  maxTexture: number;
  floatTargets: boolean;
  cores: number;
  memoryGb: number | null;
  coarse: boolean;
  saveData: boolean;
  effectiveType: string | null;
  ms: number;              // what the probe cost
  msGl: number;            // …of which the part that asks the GPU process (the renderer string)
};

const HARD_RENDERER = /swiftshader|mali|adreno|llvmpipe|software/i;
const SOFT_RENDERER = /intel/i;

// What the probe reads of the renderer: its context (for the unmasked renderer string, the one call that has to ask the
// GPU process) and the numbers three.js has already cached, so the rest costs nothing.
export type ProbeSource = { gl: any; maxTexture?: number; floatTargets?: boolean };

export function probeDevice(src: ProbeSource, params: URLSearchParams): Probe {
  const gl = src.gl;
  const t0 = performance.now();   // the player's clock, for the report only
  const nav: any = navigator;
  const reasons: string[] = [];
  let hard = false;
  const soft = (why: string) => { reasons.push(why); };
  const harden = (why: string) => { reasons.push(why); hard = true; };

  const coarse = !!matchMedia('(pointer: coarse)').matches;
  if (coarse) harden('coarse pointer');
  const memoryGb = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  if (memoryGb !== null && memoryGb <= 4) soft(`deviceMemory ${memoryGb}`);
  const cores = Number(nav.hardwareConcurrency) || 0;
  if (cores && cores <= 4) soft(`hardwareConcurrency ${cores}`);
  const c = nav.connection;
  const saveData = !!(c && c.saveData);
  const effectiveType: string | null = c && typeof c.effectiveType === 'string' ? c.effectiveType : null;
  if (saveData) harden('saveData');
  if (effectiveType && effectiveType !== '4g') harden(`effectiveType ${effectiveType}`);

  let maxTexture = 0, floatTargets = false;
  try {
    if (gl) {
      maxTexture = src.maxTexture ?? (Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0);
      floatTargets = src.floatTargets ?? (!!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float'));
    }
  } catch { /* a lost context: the checks below treat it as weak */ }
  if (!gl) harden('no WebGL context');
  else {
    if (maxTexture < 4096) harden(`MAX_TEXTURE_SIZE ${maxTexture}`);
    if (!floatTargets) harden('no float render targets');
  }

  const q = params.get('q');
  const forced: Tier | null = q === '0' || q === '1' || q === '2' ? (Number(q) as Tier) : null;
  if (forced === 0) reasons.push('?q=0');
  const probe: Probe = { tier: 1, ceiling: 2, forced, reasons, hard, renderer: '', maxTexture, floatTargets, cores, memoryGb, coarse, saveData, effectiveType, ms: 0, msGl: 0 };
  decide(probe);
  probe.ms = Math.round((performance.now() - t0) * 100) / 100;
  return probe;
}

// (re)decide where the page starts from what the probe has seen so far
function decide(p: Probe): void {
  const weak = p.reasons.length > 0 || p.forced === 0;
  p.tier = p.forced !== null ? p.forced : weak ? 0 : 1;
  p.ceiling = p.forced !== null ? p.forced : p.hard ? 0 : weak ? 1 : 2;
}

/**
 * The renderer string, read later than the rest of the probe on purpose: the first query on a context that has commands in
 * flight waits for them (6 to 9 ms measured at mount while the house builds, a few tenths once it is built), so it is asked
 * at the first install, before any feature is. It only ever lowers the start (an Intel or software GPU), and a renderer
 * string that is not on the lists changes nothing: the frame rate decides from there.
 */
export function readRenderer(p: Probe, gl: any): void {
  if (p.renderer || !gl) return;
  const t0 = performance.now();
  try {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    p.renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
  } catch { /* a lost context */ }
  if (HARD_RENDERER.test(p.renderer)) { p.reasons.push(`renderer ${p.renderer}`); p.hard = true; }
  else if (SOFT_RENDERER.test(p.renderer)) p.reasons.push(`renderer ${p.renderer}`);
  decide(p);
  p.msGl = Math.round((performance.now() - t0) * 100) / 100;
  p.ms = Math.round((p.ms + p.msGl) * 100) / 100;
}

export type Ladder = {
  readonly tier: Tier;
  readonly ceiling: Tier;
  /** a window below the frame-rate floor: lower a rung if that changes anything. true: the tier moved (skip the pixel-ratio step). */
  shed(fps: number): boolean;
  /** a long run at full speed: try the rung above. true: the tier moved. */
  promote(): boolean;
  /** the probe learned something (the renderer string) before anything was installed: start from its tier */
  restart(): void;
  stats(): { tier: Tier; start: Tier; ceiling: Tier; forced: boolean; banned: Tier[]; futile: boolean; moves: string[] };
};

export const SHED_GAIN = 1.10;   // a shed must buy this much, or it is put back

export function createLadder(o: {
  probe: Probe;
  /** would moving from → to change anything (a handle to switch or lighten, a feature to install)? */
  changes(from: Tier, to: Tier): boolean;
  apply(to: Tier): void;
}): Ladder {
  const { probe } = o;
  const forced = probe.forced !== null;
  let tier: Tier = probe.tier;
  const banned = new Set<Tier>();
  let futile = false;
  let pending: { from: Tier; fps: number } | null = null;   // the last shed, not yet judged
  let promotedTo: Tier | null = null;                       // the rung the last promotion reached, not yet proven
  const moves: string[] = [];
  const move = (to: Tier, why: string) => {
    moves.push(`${tier}→${to} ${why}`);
    if (moves.length > 12) moves.shift();
    tier = to;
    o.apply(to);
  };
  return {
    get tier() { return tier; },
    get ceiling() { return probe.ceiling; },
    shed(fps) {
      if (forced) return false;
      if (pending) {
        const p = pending; pending = null;
        if (fps < p.fps * SHED_GAIN && tier < p.from) { futile = true; move(p.from, `shed bought ${(fps / p.fps).toFixed(2)}x, put back`); return true; }
      }
      if (tier === 0 || futile || !o.changes(tier, (tier - 1) as Tier)) return false;
      const from = tier, wasPromoted = promotedTo === tier;
      move((tier - 1) as Tier, `${Math.round(fps)} fps`);
      if (wasPromoted) { banned.add(from); promotedTo = null; } else pending = { from, fps };
      return true;
    },
    promote() {
      if (forced || tier >= probe.ceiling || banned.has((tier + 1) as Tier) || !o.changes(tier, (tier + 1) as Tier)) return false;
      pending = null;
      move((tier + 1) as Tier, 'promoted');
      promotedTo = tier;
      return true;
    },
    restart() { if (!moves.length && !forced) tier = probe.tier; },
    stats: () => ({ tier, start: probe.tier, ceiling: probe.ceiling, forced, banned: [...banned], futile, moves: moves.slice() }),
  };
}
