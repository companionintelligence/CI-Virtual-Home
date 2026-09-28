// Small pure helpers the editor's UI shares: export sizes, download names, shot labels, time readouts, and the v1
// shot's phases for the timeline. DOM-free and THREE-free (scripts/test-ui-units.mts runs them in Node).

/** What a shot is called in the editor: plain words (plan §6 P2 17), never the planner's own name (which carries
 *  the spec's emoji and title). An alias a spec adds keeps its own id. */
export const SHOT_LABELS: Record<string, string> = {
  'door-to-core': 'Door to Core', 'orbit': 'Orbit', 'hero-reveal': 'Reveal', 'walkthrough': 'Walkthrough', 'core-orbit': 'Core orbit',
};
export const SHOT_HINTS: Record<string, string> = {
  'door-to-core': 'In through the front door to the Companion Core, then round it',
  'orbit': 'Round the whole home from above',
  'hero-reveal': 'Down onto the desk and the Companion Core',
  'walkthrough': 'Through each room, ending at the Companion Core',
  'core-orbit': 'Close round the Companion Core',
};
export const shotLabel = (type: string, id = type): string => SHOT_LABELS[id] || SHOT_LABELS[type] || id.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());

/** A still's pixel size (plan §6 P0 2): `res` is the short side (1080, 1440, 2160) and the long side is capped at 3840,
 *  so 4K is 3840 × 2160 landscape and 2160 × 3840 portrait. Both sides even (video and PNG alike). */
export function exportSize(res: number | string, aspect: string): { w: number; h: number } {
  const [a, b] = String(aspect).split(':').map(Number);
  const ratio = a > 0 && b > 0 ? a / b : 16 / 9;
  let short = Math.max(2, Number(res) || 1080), long = short * Math.max(ratio, 1 / ratio);
  if (long > 3840) { long = 3840; short = 3840 / Math.max(ratio, 1 / ratio); }
  const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);
  return ratio >= 1 ? { w: even(long), h: even(short) } : { w: even(short), h: even(long) };
}

/** yyyymmdd-hhmmss in local time: a download name with no colons (plan §6 P0 1) */
export function stamp(d: Date): string {
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
const slug = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scene';
/** <house>-<shot>-<time of day>-<yyyymmdd-hhmmss>.<ext> — the time of day in the name too (Completeness J) */
export function downloadName({ house, shot, tod, date, ext, extra = '' }: { house: string; shot: string; tod?: string | null; date: Date; ext: string; extra?: string }): string {
  return [slug(house), slug(shot), tod ? slug(tod) : '', extra ? slug(extra) : '', stamp(date)].filter(Boolean).join('-') + '.' + ext;
}

/** 4.25 → "0:04.25" (seconds to minutes, seconds and hundredths) */
export function fmtClock(sec: number): string {
  const s = Math.max(0, sec), m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`;
}

export type Phase = { name: string; t0: number; t1: number; derived?: boolean };
/** The coarse phases of a v1 shot, for the timeline until the v2 planner bakes beats (plan §3.3): read off the shot's
 *  own structure — outside until the eye first goes under a ceiling (track events.enterT), then the walk, the push-in
 *  and the orbit round the Core (preset.orbit.tIn / t0). Fractions of the shot, each marked `derived`. */
export function v1Phases(type: string, preset: any, track: { duration: number; events?: { enterT?: number | null } } | null): Phase[] {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const orbit = preset && preset.orbit, enter = track && track.events && track.events.enterT != null && track.duration > 0 ? clamp(track.events.enterT / track.duration) : null;
  const out: Phase[] = [];
  const add = (name: string, t0: number, t1: number) => { if (t1 - t0 > 1e-3) out.push({ name, t0: clamp(t0), t1: clamp(t1), derived: true }); };
  if (type === 'door-to-core') {
    const tIn = orbit && orbit.tIn != null ? orbit.tIn : orbit ? orbit.t0 : 1, t0 = orbit ? orbit.t0 : 1;
    if (enter != null) { add('outside', 0, enter); add('inside', enter, tIn); } else add('walk', 0, tIn);
    if (orbit) { add('push-in', tIn, t0); add('orbit', t0, 1); }
  } else if (type === 'core-orbit' && orbit) {
    add('push-in', 0, orbit.t0); add('orbit', orbit.t0, 1);
  } else if (type === 'orbit') add('orbit', 0, 1);
  else if (type === 'hero-reveal') add('descent', 0, 1);
  else if (type === 'walkthrough') add('walk', 0, 1);
  else add('path', 0, 1);
  return out;
}

/** Speed (m/s) and yaw rate (°/s) per track sample, smoothed over `window` seconds — the timeline's sparklines. */
export function trackRates(track: { samples: number; dt: number; pos: ArrayLike<number>; look: ArrayLike<number> }, window = 0.1): { speed: Float32Array; yaw: Float32Array } {
  const n = track.samples, dt = track.dt, speed = new Float32Array(n), yaw = new Float32Array(n);
  const yawAt = (i: number) => Math.atan2(track.look[3 * i] - track.pos[3 * i], track.look[3 * i + 2] - track.pos[3 * i + 2]);
  for (let i = 1; i < n; i++) {
    speed[i] = Math.hypot(track.pos[3 * i] - track.pos[3 * i - 3], track.pos[3 * i + 1] - track.pos[3 * i - 2], track.pos[3 * i + 2] - track.pos[3 * i - 1]) / dt;
    const d = yawAt(i) - yawAt(i - 1);
    yaw[i] = Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * 180 / Math.PI / dt;
  }
  speed[0] = speed[1] || 0; yaw[0] = yaw[1] || 0;
  const k = Math.max(0, Math.round(window / dt / 2));
  const smooth = (a: Float32Array) => { if (!k) return a; const o = new Float32Array(n); let sum = 0, cnt = 0; for (let i = 0; i < Math.min(n, k); i++) { sum += a[i]; cnt++; } for (let i = 0; i < n; i++) { if (i + k < n) { sum += a[i + k]; cnt++; } if (i - k - 1 >= 0) { sum -= a[i - k - 1]; cnt--; } o[i] = sum / cnt; } return o; };
  return { speed: smooth(speed), yaw: smooth(yaw) };
}
