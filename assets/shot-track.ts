// A shot as a baked track — the format the spline planner v2 bakes (plan §3.2) and the editor's timeline reads
// (window.__houseShotTrack, plan S6):
//
//   { version: 2, planner, duration, fps, samples, dt,
//     s, pos, look, fov, roofAlpha,          // one entry (pos, look: three) per sample, sample i at i·dt seconds
//     beats: [{ name, t0, t1, subject }],     // seconds
//     events: { enterT, stairT: [], pressT, settleT },   // seconds (null where the shot has none)
//     metrics: { … } }
//
// Until S5's planner v2 lands, trackFromV1 samples a v1 shot exactly the way room-creator.html's applySplineFrame
// flies it — the preset's own frameAt (a timed shot) or its Catmull-Rom pair under the page's ease, the dolly-zoom
// field of view, and the roof fade applyShotCutaway computes — at 120 Hz, with no beats. It reads the preset and
// never writes it (unlike the page's shotEnterT, it does not cache enterT), touches no scene object, and is a pure
// function of its inputs, so asking for a track never changes a frame.
//
// Owner: S5 (shot). THREE is injected (only CatmullRomCurve3 and Vector3 are used), so it runs in Node too.

const DEG = Math.PI / 180;
// room-creator.html's easeInOutCubic: door-to-core without timing plays under it
const easeInOutCubic = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export type ShotTrack = {
  version: 2;
  planner: 'v1' | 'v2';
  type: string;
  duration: number;
  fps: number;
  samples: number;
  dt: number;
  s: Float32Array;
  pos: Float32Array;
  look: Float32Array;
  fov: Float32Array;
  roofAlpha: Float32Array;
  beats: Array<{ name: string; t0: number; t1: number; subject: [number, number, number] | null }>;
  events: { enterT: number | null; stairT: number[]; pressT: number | null; settleT: number | null };
  metrics: Record<string, number | null>;
};

export function trackFromV1(THREE, preset, { type = '', duration = 10, fps = 120, aspect = 16 / 9, houseInside = null as null | ((p: any) => boolean) } = {}): ShotTrack {
  const n = Math.max(2, Math.round(duration * fps) + 1), dt = duration / (n - 1);
  const flythrough = type === 'door-to-core' || type === 'sunset-timelapse';
  const eyeC = preset.frameAt ? null : new THREE.CatmullRomCurve3(preset.eyePoints, preset.closed, 'centripetal');
  const tgtC = preset.frameAt ? null : new THREE.CatmullRomCurve3(preset.targetPoints, preset.closed, 'centripetal');
  // the roof fade, as applyShotCutaway decides it (enter: the first of 241 steps along the eye curve under a ceiling)
  const d = preset.dressing || { walls: 'up', roof: 'auto' };
  const roof = d.roof === 'auto' && d.walls === 'sims' ? 'off' : (d.roof || 'auto');
  let enterS = preset.enterT;
  if (roof === 'auto' && enterS === undefined) {
    enterS = Infinity;
    const curve = new THREE.CatmullRomCurve3(preset.eyePoints, preset.closed, 'centripetal');
    if (houseInside) for (let i = 0; i <= 240; i++) { const sv = i / 240; if (houseInside(curve.getPointAt(sv))) { enterS = sv; break; } }
  }
  const roofAt = sv => {
    if (roof === 'off') return 0;
    if (roof !== 'auto') return 1;
    const fadeStart = enterS - 0.05;
    return enterS === Infinity ? 1 : sv <= fadeStart ? 1 : sv >= enterS ? 0 : 1 - ((sv - fadeStart) / 0.05) ** 2;
  };

  const S = new Float32Array(n), pos = new Float32Array(3 * n), look = new Float32Array(3 * n), fov = new Float32Array(n), roofAlpha = new Float32Array(n);
  let enterT = null, outside = 0, length = 0, maxSpeed = 0, maxYawRate = 0, firstSecond = 0, prevYaw = null;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const fr = preset.frameAt ? preset.frameAt(t, aspect) : null;
    const sv = fr ? fr.s : flythrough ? easeInOutCubic(t) : t;
    const e = fr ? fr.eye : eyeC.getPointAt(sv), g = fr ? fr.target : tgtC.getPointAt(sv);
    S[i] = sv;
    pos[3 * i] = e.x; pos[3 * i + 1] = e.y; pos[3 * i + 2] = e.z;
    look[3 * i] = g.x; look[3 * i + 1] = g.y; look[3 * i + 2] = g.z;
    fov[i] = type === 'door-to-core' ? 46 - sv * 6 : 42;
    roofAlpha[i] = roofAt(sv);
    const inside = houseInside ? houseInside(e) : false;
    if (!inside) outside++;
    if (inside && enterT === null) enterT = i * dt;
    const yaw = Math.atan2(g.x - e.x, g.z - e.z);
    if (i) {
      const step = Math.hypot(e.x - pos[3 * i - 3], e.y - pos[3 * i - 2], e.z - pos[3 * i - 1]);
      length += step; maxSpeed = Math.max(maxSpeed, step / dt);
      if (i * dt <= 1 + 1e-9) firstSecond += step;
      const dy = Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw));
      maxYawRate = Math.max(maxYawRate, Math.abs(dy) / DEG / dt);
    }
    prevYaw = yaw;
  }
  const pw = preset.power;
  const r3 = v => +v.toFixed(3);
  return {
    version: 2, planner: 'v1', type, duration, fps, samples: n, dt,
    s: S, pos, look, fov, roofAlpha,
    beats: [],
    events: { enterT: enterT === null ? null : r3(enterT), stairT: [], pressT: pw && pw.at >= 0 ? r3(pw.at * duration) : null, settleT: null },
    metrics: {
      length: r3(length), maxSpeed: r3(maxSpeed), firstSecondTravel: r3(firstSecond),
      maxYawRate: r3(maxYawRate), outsideShare: houseInside ? r3(outside / n) : null,
    },
  };
}
