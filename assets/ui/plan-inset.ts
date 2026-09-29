// The plan inset (plan §6 P1 7): a small top-down drawing of the storey the camera is on — the lot, the storey's
// footprint, its rooms and partitions, the stairs and the Companion Core — with the shot's route (the eye's path from
// the baked track, or the navigation route S5's planner exports as anchors.nav when it has one), the playhead and
// the camera's field of view as a wedge. Rooms the spec names in `showcase` (S5's knob) are tinted, and the Core's room
// always is. A click on the route seeks the timeline to the nearest point of it on that storey.
//
// Pure 2D canvas: nothing here touches the 3D scene, so it can never reach a render. Colours are the page's canon
// tokens. THREE-free: it reads the spec, the track's Float32Arrays and plain numbers.

type Rect = { x: number; z: number; w: number; d: number };
export type InsetTrack = { samples: number; dt: number; duration: number; pos: ArrayLike<number>; look: ArrayLike<number>; fov?: ArrayLike<number> };

export function levelAt(levels: Array<{ id: string; y: number; height: number }>, y: number): number {
  let best = 0;
  for (let i = 0; i < levels.length; i++) if (y >= (levels[i].y || 0) - 0.3) best = i;
  return best;
}
/** The storey the camera is on: by height where it stands over the house, the entry's storey while it is outside
 *  (an establishing shot 8 m up is looking at the front door, not at the loft). */
export function storeyOf(spec: any, eye: [number, number, number]): number {
  const levels = (spec && spec.levels) || [];
  const over = levels.some((lv: any) => (lv.footprint || []).some((r: any) => eye[0] >= r.x - 0.3 && eye[0] <= r.x + r.w + 0.3 && eye[2] >= r.z - 0.3 && eye[2] <= r.z + r.d + 0.3));
  if (over) return levelAt(levels, eye[1]);
  const entry = spec && spec.entry && levels.findIndex((lv: any) => lv.id === spec.entry.level);
  return entry > 0 ? entry : 0;
}

export function createPlanInset(canvas: HTMLCanvasElement, { onSeek, onLevel }: { onSeek: (t: number) => void; onLevel?: (label: string) => void }) {
  let spec: any = null, anchors: any = null, track: InsetTrack | null = null;
  let t = 0, eye: [number, number, number] | null = null, look: [number, number, number] | null = null, hfov = 0.7, level = 0;
  let view = { cx: 0, cz: 0, s: 1, w: 1, h: 1 };
  const css = (n: string) => getComputedStyle(canvas).getPropertyValue(n).trim();

  function fit(w: number, h: number) {
    const lot = (spec && spec.lot) || { w: 30, d: 24 };
    let minX = -lot.w / 2, maxX = lot.w / 2, minZ = -lot.d / 2, maxZ = lot.d / 2;
    if (track) for (let i = 0; i < track.samples; i += 4) { const x = track.pos[3 * i], z = track.pos[3 * i + 2]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    const pad = 8, s = Math.min((w - 2 * pad) / Math.max(1, maxX - minX), (h - 2 * pad) / Math.max(1, maxZ - minZ));
    view = { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, s, w, h };
  }
  const X = (x: number) => view.w / 2 + (x - view.cx) * view.s;
  const Z = (z: number) => view.h / 2 + (z - view.cz) * view.s;
  const rect = (g: CanvasRenderingContext2D, r: Rect) => g.rect(X(r.x), Z(r.z), r.w * view.s, r.d * view.s);

  function draw() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (r.width < 2 || r.height < 2) return;
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    if (!spec) {   // a studio scene has no spec: no storeys to draw (the page turns the button off; this is what a scripted call sees)
      g.fillStyle = css('--muted-foreground'); g.font = `500 12px ${css('--font-sans') || 'sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('A studio scene has no plan', r.width / 2, r.height / 2); g.textAlign = 'start';
      return;
    }
    fit(r.width, r.height);
    const fg = css('--foreground'), muted = css('--muted-foreground'), hair = css('--rc-hairline-strong'), route = css('--chart-2'), core = css('--chart-1');
    const levels = spec.levels || [];
    const L = Math.max(0, level), lv = levels[L];
    // the lot
    const lot = spec.lot || { w: 30, d: 24 };
    g.strokeStyle = hair; g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); rect(g, { x: -lot.w / 2, z: -lot.d / 2, w: lot.w, d: lot.d }); g.stroke(); g.setLineDash([]);
    // the other storeys' footprints, faint
    g.strokeStyle = hair;
    for (const [i, o] of levels.entries()) if (i !== L) { g.beginPath(); for (const f of o.footprint || []) rect(g, f); g.stroke(); }
    if (lv) {
      // this storey: footprint, rooms (the showcase ones and the Core's tinted), partitions, stairs
      g.fillStyle = css('--rc-tile'); g.beginPath(); for (const f of lv.footprint || []) rect(g, f); g.fill();
      const showcase = new Set((spec.showcase || []).map((s: string) => String(s).toLowerCase()));
      const hero = spec.hero || {};
      for (const room of lv.rooms || []) {
        const b = room.bounds; if (!b) continue;
        const isHero = hero.level === lv.id && Array.isArray(hero.at) && hero.at[0] >= b.x && hero.at[0] <= b.x + b.w && hero.at[1] >= b.z && hero.at[1] <= b.z + b.d;
        if (isHero || showcase.has(String(room.name).toLowerCase()) || showcase.has(String(room.no || ''))) {
          g.save(); g.globalAlpha = isHero ? 0.22 : 0.16; g.fillStyle = core; g.beginPath(); rect(g, b); g.fill(); g.restore();
        }
        g.strokeStyle = hair; g.beginPath(); rect(g, b); g.stroke();
        const label = room.name || '';
        g.font = `500 11px ${css('--font-sans') || 'sans-serif'}`;
        const tw = g.measureText(label).width;
        if (tw + 12 < b.w * view.s && b.d * view.s > 22) {   // the name sits on a chip, in from the corner, clear of the walls
          g.fillStyle = css('--rc-float'); g.beginPath(); g.roundRect(X(b.x) + 4, Z(b.z) + 4, tw + 8, 15, 3); g.fill();
          g.fillStyle = muted; g.textBaseline = 'top'; g.fillText(label, X(b.x) + 8, Z(b.z) + 6);
        }
      }
      g.strokeStyle = muted; g.lineWidth = 1.5;
      for (const p of lv.partitions || []) { g.beginPath(); g.moveTo(X(p.from[0]), Z(p.from[1])); g.lineTo(X(p.to[0]), Z(p.to[1])); g.stroke(); }
      g.strokeStyle = fg; g.lineWidth = 1.5; g.beginPath(); for (const f of lv.footprint || []) rect(g, f); g.stroke();
      const flights = Array.isArray(lv.stairs) ? lv.stairs : lv.stairs ? [lv.stairs] : [];
      for (const st of flights) if (Array.isArray(st.at)) {
        const a = ((st.rot || 0) * Math.PI) / 180, len = (st.run || 3) * view.s, x = X(st.at[0]), z = Z(st.at[1]);
        g.strokeStyle = muted; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, z); g.lineTo(x + Math.sin(a) * len, z + Math.cos(a) * len); g.stroke();
        g.beginPath(); g.arc(x + Math.sin(a) * len, z + Math.cos(a) * len, 2.5, 0, Math.PI * 2); g.fillStyle = muted; g.fill();
      }
      if (hero.level === lv.id && Array.isArray(hero.at)) { g.fillStyle = core; g.beginPath(); g.arc(X(hero.at[0]), Z(hero.at[1]), 4, 0, Math.PI * 2); g.fill(); }
    }
    // the route: the nav route when the planner exports one, else the eye's path — solid on this storey, faint off it
    const nav = anchors && anchors.nav && Array.isArray(anchors.nav.route) ? anchors.nav.route : null;
    if (track) {
      g.lineWidth = 2.5; g.lineJoin = 'round'; g.lineCap = 'round';
      let prevOn: boolean | null = null;
      g.beginPath();
      for (let i = 0; i < track.samples; i += 2) {
        const x = X(track.pos[3 * i]), z = Z(track.pos[3 * i + 2]), on = storeyOf(spec, [track.pos[3 * i], track.pos[3 * i + 1], track.pos[3 * i + 2]]) === L;
        if (on !== prevOn) { if (prevOn !== null) { g.lineTo(x, z); g.strokeStyle = route; g.globalAlpha = prevOn ? 1 : 0.3; g.stroke(); } g.beginPath(); g.moveTo(x, z); prevOn = on; }
        else g.lineTo(x, z);
      }
      g.strokeStyle = route; g.globalAlpha = prevOn ? 1 : 0.3; g.stroke(); g.globalAlpha = 1;
    }
    if (nav) { g.strokeStyle = fg; g.lineWidth = 1; g.setLineDash([2, 3]); g.beginPath(); nav.forEach((p: number[], i: number) => (i ? g.lineTo(X(p[0]), Z(p[p.length - 1])) : g.moveTo(X(p[0]), Z(p[p.length - 1])))); g.stroke(); g.setLineDash([]); }
    // the camera: a wedge of the horizontal field of view toward the look point, and the playhead
    if (eye && look) {
      const ex = X(eye[0]), ez = Z(eye[2]), a = Math.atan2(look[0] - eye[0], look[2] - eye[2]), R = 26;
      g.save(); g.globalAlpha = 0.28; g.fillStyle = fg; g.beginPath(); g.moveTo(ex, ez);
      g.arc(ex, ez, R, Math.PI / 2 - a - hfov, Math.PI / 2 - a + hfov); g.closePath(); g.fill(); g.restore();
      g.fillStyle = fg; g.strokeStyle = css('--background'); g.lineWidth = 2; g.beginPath(); g.arc(ex, ez, 4, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }

  canvas.addEventListener('click', e => {
    if (!track || !spec) return;
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = -1, bd = 14 * 14;
    for (let i = 0; i < track.samples; i++) {
      if (storeyOf(spec, [track.pos[3 * i], track.pos[3 * i + 1], track.pos[3 * i + 2]]) !== Math.max(0, level)) continue;
      const dx = X(track.pos[3 * i]) - mx, dz = Z(track.pos[3 * i + 2]) - my, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) onSeek((best * track.dt) / track.duration);
  });

  return {
    setHouse(s: any, a: any) { spec = s; anchors = a; level = -1; draw(); },   // -1: the next setView names its storey
    setTrack(tr: InsetTrack | null) { track = tr; draw(); },
    /** the playhead: t (0…1), the eye and look points, the vertical field of view (degrees) and the view's aspect */
    setView(v: number, e: [number, number, number] | null, l: [number, number, number] | null, fovDeg = 42, aspect = 16 / 9) {
      t = v; eye = e; look = l;
      hfov = Math.atan(Math.tan((fovDeg * Math.PI) / 360) * aspect);
      const lvIdx = spec && e ? storeyOf(spec, e) : 0;
      if (lvIdx !== level) { level = lvIdx; onLevel?.(spec ? (((spec.levels || [])[level] || {}).name || `Level ${level + 1}`) : ''); }
      draw();
    },
    get level() { return Math.max(0, level); },
    get time() { return t; },
    draw,
  };
}
