// A camera shot as a pure function of its shot fraction t: frameAt(t, aspect) → { eye, target, s }.
//
// Shots are authored as eye and target waypoints on centripetal Catmull-Rom curves (house-builder.ts shotsFor,
// drawn by room-creator.html). Played back arc-length-uniform under one global ease, every metre of the path
// costs the same time: a 30 m walk from the street and a 2 m orbit round the Core share one speed, so either the
// walk crawls or the orbit races, and a cubic ease-in-out makes the first quarter of the shot all but stand
// still. A shot that carries `timing` pins each eye waypoint to a moment instead:
//
//   timing.times       one time per eye waypoint, 0 … 1, strictly increasing
//   timing.startSpeed  speed at t = 0 as a multiple of the first segment's mean (default 1 — moving from frame 0)
//   timing.endSpeed    the same at t = 1, against the last segment
//
// A monotone cubic (Fritsch–Carlson, the PCHIP slopes) through the (time, arc length) knots gives a C1 speed
// profile that never runs backwards: an orbit whose waypoints are evenly spaced in angle and in time keeps a
// steady angular speed, and the walk before it slows into it rather than stopping.
//
// Where the eye LOOKS is waypoint k's target when the eye is at waypoint k, and in between the look direction
// turns: its heading and pitch are PCHIP-interpolated — against the shot's time when it carries `timing` (so a
// turn is spread over exactly the seconds the timing gave it, however the eye's speed varies along the leg),
// along the eye's curve parameter otherwise — the heading unwrapped, so a turn takes the short way round. Not the
// target points: a target that swings from ahead of the eye to behind it (the foot of a switchback stair) would
// otherwise pass over the eye's head and flip the camera.
// Consecutive waypoints that share one target (an orbit round the Core) look exactly at it.
//
// `compose` frames the subject off-centre where the shot asks for it: { subject, ndcX, fov, weights } — weights
// (one per eye waypoint, interpolated along the curve) fade it in; ndcX is where the subject's centre should sit
// across the frame (−1 … 1, + = right), and the look direction is turned by the angle that puts it there for
// the frame's aspect, so a 9:16 render keeps the Core in frame as a 16:9 one does.
//
// No state: frame t is computed from t alone (the frame-hash test renders frames 0, 200 and 719 cold), and
// nothing here reads a clock or a random number.

const DEG = Math.PI / 180;

// Arc length along `curve` at each of its n waypoints (curve parameter k / segments), read off the same
// cumulative table getUtoTmapping inverts — so getPointAt(knot / length) lands exactly on waypoint k.
export function knotArcLengths(curve, n, closed = false) {
  const lens = curve.getLengths();
  const D = lens.length - 1, segs = closed ? n : n - 1;
  const out = [];
  for (let k = 0; k < n; k++) {
    const f = (k / segs) * D, i = Math.min(Math.floor(f), D - 1);
    out.push(k === 0 ? 0 : lens[i] + (lens[i + 1] - lens[i]) * (f - i));
  }
  return out;
}

// Shape-preserving cubic Hermite (PCHIP) through (xs, ys), xs strictly increasing: interior slopes are
// Fritsch–Butland's weighted harmonic means of the neighbouring secants, zero at a local extremum, so it never
// overshoots — monotone data stays monotone. The end slopes are the given multiples of the end secants.
export function monotoneCubic(xs, ys, startScale = 1, endScale = 1) {
  const n = xs.length;
  if (n < 2) return () => ys[0] ?? 0;
  const h = [], d = [];
  for (let k = 0; k < n - 1; k++) { h.push(xs[k + 1] - xs[k]); d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k])); }
  const m = new Array(n).fill(0);
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) { m[k] = 0; continue; }
    const w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1];
    m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
  }
  m[0] = Math.min(3, Math.max(0, startScale)) * d[0];
  m[n - 1] = Math.min(3, Math.max(0, endScale)) * d[n - 2];
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
    const hh = h[lo], t = (x - xs[lo]) / hh, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * hh * m[lo] + (-2 * t3 + 3 * t2) * ys[lo + 1] + (t3 - t2) * hh * m[lo + 1];
  };
}

// A shot's timing is usable: one time per eye waypoint, strictly increasing, from ≥ 0 to ≤ 1.
export function timingValid(shot) {
  const tm = shot && shot.timing, n = shot && shot.eyePoints ? shot.eyePoints.length : 0;
  if (!tm || !Array.isArray(tm.times) || tm.times.length !== n) return false;
  return tm.times.every((t, i) => Number.isFinite(t) && (i === 0 ? t >= 0 : t > tm.times[i - 1])) && tm.times[n - 1] <= 1;
}

export function createShotPath(THREE, shot) {
  const closed = !!shot.closed;
  const eye = new THREE.CatmullRomCurve3(shot.eyePoints, closed, 'centripetal');
  const tgt = new THREE.CatmullRomCurve3(shot.targetPoints, closed, 'centripetal');
  const n = shot.eyePoints.length, segs = closed ? n : n - 1;
  const paired = shot.targetPoints.length === n;   // the target can share the eye's parameter only waypoint for waypoint
  const length = eye.getLength();
  const knots = knotArcLengths(eye, n, closed);
  // (times that are not strictly increasing from ≥ 0 to ≤ 1 are ignored — timingValid says so, and the shot gate
  // fails the shot on it)
  const tm = timingValid(shot) ? shot.timing : null;
  const ease = tm
    ? monotoneCubic(tm.times, knots.map(k => k / length), tm.startSpeed ?? 1, tm.endSpeed ?? 1)
    : (x => x);
  // the look direction at each waypoint: heading (unwrapped), pitch and distance to its target
  const heads = [], pitches = [], dists = [], idx = [];
  for (let k = 0; k < (paired ? n : 0); k++) {
    const e = shot.eyePoints[k], g = shot.targetPoints[k];
    const dx = g.x - e.x, dy = g.y - e.y, dz = g.z - e.z, hz = Math.hypot(dx, dz);
    let yaw = hz > 1e-6 ? Math.atan2(dx, dz) : (heads[k - 1] ?? 0);
    if (k) yaw = heads[k - 1] + Math.atan2(Math.sin(yaw - heads[k - 1]), Math.cos(yaw - heads[k - 1]));
    heads.push(yaw); pitches.push(Math.atan2(dy, hz)); dists.push(Math.max(0.05, Math.hypot(dx, dz, dy))); idx.push(k);
  }
  // A timed shot turns its look against TIME, waypoint k's look at times[k]: against the curve parameter the turn
  // bunched up wherever the eye slowed within a leg (a 166° turn given 1.5 s peaked at 298°/s), and the time a
  // turn is given (house-builder.ts) is only honoured if the turn is spread over that time.
  const timed = !!tm && !closed;
  const keys = timed ? tm.times : idx;
  const headAt = paired ? monotoneCubic(keys, heads) : null, pitchAt = paired ? monotoneCubic(keys, pitches) : null;
  const same = k => { const a = shot.targetPoints[k], b = shot.targetPoints[(k + 1) % n]; return a.distanceToSquared(b) < 1e-8; };
  const lookAt = (u, e, tt) => {
    let k, f, x;
    if (timed) {
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (keys[mid] <= tt) lo = mid; else hi = mid; }
      k = lo; f = (tt - keys[k]) / (keys[k + 1] - keys[k]); x = tt;
    } else { const p = u * segs; k = Math.min(Math.max(0, Math.floor(p)), segs - 1); f = p - k; x = p; }
    if (same(k)) return shot.targetPoints[k].clone();
    const yaw = headAt(x), pitch = pitchAt(x), dist = dists[k] + (dists[(k + 1) % n] - dists[k]) * f;
    return new THREE.Vector3(e.x + Math.sin(yaw) * Math.cos(pitch) * dist, e.y + Math.sin(pitch) * dist, e.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  };
  const c = shot.compose || null;
  const weightAt = u => {
    if (!c || !c.weights) return c ? 1 : 0;
    const p = u * segs, i = Math.min(Math.max(0, Math.floor(p)), segs - 1), w = c.weights;
    const a = w[i % n] ?? 0, b = w[(i + 1) % n] ?? a;
    return a + (b - a) * (p - i);
  };
  return {
    length, knots,
    frameAt(t, aspect = 16 / 9) {
      const tt = Math.max(0, Math.min(1, t));
      const s = Math.max(0, Math.min(1, ease(tt)));
      const u = eye.getUtoTmapping(s);
      const e = eye.getPoint(u);
      const g = paired && !closed ? lookAt(u, e, tt) : tgt.getPointAt(s);
      const w = weightAt(u);
      if (c && w > 1e-4 && c.ndcX) {
        const vx = g.x - e.x, vz = g.z - e.z, dh = Math.hypot(vx, vz);
        if (dh > 1e-4) {
          // camera right = view × up = (−vz, 0, vx); to put the subject at +ndcX, look that far to its left
          const k = w * c.ndcX * Math.tan((c.fov || 40) * DEG / 2) * aspect * dh;
          g.x -= (-vz / dh) * k; g.z -= (vx / dh) * k;
        }
      }
      return { s, u, eye: e, target: g };
    }
  };
}

// A shot object's frameAt, built on first use — after shotsFor's spec overrides have had their say.
export function attachFrameAt(THREE, shot) {
  let path = null;
  shot.frameAt = (t, aspect) => (path ||= createShotPath(THREE, shot)).frameAt(t, aspect);
  return shot;
}
