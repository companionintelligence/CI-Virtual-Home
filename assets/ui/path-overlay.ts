// The camera path, drawn over the viewport (plan §6 P1 7): a 3 px screen-space line on a 2D canvas laid over the
// WebGL one. It is never depth-tested (a wall cannot hide it), and since it is not in the 3D scene at all it can
// never reach a render, a still or a preview — those read the WebGL canvas. Waypoints are dots, the first and last
// larger; the playhead is a ring.
//
// Projection is done here from the camera's own matrices (matrixWorldInverse, projectionMatrix): segments behind the
// near plane are clipped in view space first, so a path that passes behind the camera never draws a line across the
// screen. Works for the perspective and the orthographic camera alike. THREE-free.

type V3 = { x: number; y: number; z: number };
type Cam = { near: number; matrixWorldInverse: { elements: ArrayLike<number> }; projectionMatrix: { elements: ArrayLike<number> }; isOrthographicCamera?: boolean };

export function createPathOverlay(canvas: HTMLCanvasElement) {
  let points: V3[] = [], waypoints: V3[] = [], playhead: V3 | null = null, visible = false;
  const css = (n: string) => getComputedStyle(canvas).getPropertyValue(n).trim();

  const view = (m: ArrayLike<number>, p: V3): [number, number, number] => [
    m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12], m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13], m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]];
  function toScreen(P: ArrayLike<number>, v: [number, number, number], w: number, h: number): [number, number] {
    const x = P[0] * v[0] + P[4] * v[1] + P[8] * v[2] + P[12], y = P[1] * v[0] + P[5] * v[1] + P[9] * v[2] + P[13], wc = P[3] * v[0] + P[7] * v[1] + P[11] * v[2] + P[15];
    return [(x / wc * 0.5 + 0.5) * w, (1 - (y / wc * 0.5 + 0.5)) * h];
  }

  function draw(camera: Cam | null) {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    if (!visible || !camera || points.length < 2) return;
    const V = camera.matrixWorldInverse.elements, P = camera.projectionMatrix.elements, zn = -(camera.near || 0.1) - 1e-3;
    const w = r.width, h = r.height;
    // polyline in view space, clipped against the near plane (view z < zn is in front)
    const segs: Array<Array<[number, number]>> = [];
    let cur: Array<[number, number]> | null = null, prev: [number, number, number] | null = null;
    const ortho = !!camera.isOrthographicCamera;
    for (const p of points) {
      const v = view(V, p);
      const inFront = ortho || v[2] < zn;
      if (prev) {
        const prevIn = ortho || prev[2] < zn;
        if (prevIn && inFront) cur!.push(toScreen(P, v, w, h));
        else if (prevIn !== inFront) {
          const k = (zn - prev[2]) / (v[2] - prev[2]);
          const c: [number, number, number] = [prev[0] + (v[0] - prev[0]) * k, prev[1] + (v[1] - prev[1]) * k, zn];
          if (prevIn) { cur!.push(toScreen(P, c, w, h)); cur = null; }
          else { cur = [toScreen(P, c, w, h), toScreen(P, v, w, h)]; segs.push(cur); }
        }
      } else if (inFront) { cur = [toScreen(P, v, w, h)]; segs.push(cur); }
      prev = v;
    }
    const stroke = (col: string, width: number) => {
      g.strokeStyle = col; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
      for (const s of segs) { if (s.length < 2) continue; g.beginPath(); g.moveTo(s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) g.lineTo(s[i][0], s[i][1]); g.stroke(); }
    };
    stroke(css('--background'), 5);      // a halo, so the line reads on a white wall and on the lawn
    stroke(css('--chart-2'), 3);
    const dot = (p: V3, rad: number, fill: string) => {
      const v = view(V, p); if (!ortho && v[2] >= zn) return;
      const [x, y] = toScreen(P, v, w, h);
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 1.5; g.strokeStyle = css('--background'); g.stroke();
    };
    waypoints.forEach((p, i) => dot(p, i === 0 || i === waypoints.length - 1 ? 5 : 3.5, css(i === waypoints.length - 1 ? '--chart-1' : '--foreground')));
    if (playhead) {
      const v = view(V, playhead);
      if (ortho || v[2] < zn) {
        const [x, y] = toScreen(P, v, w, h);
        g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.lineWidth = 2.5; g.strokeStyle = css('--foreground'); g.stroke();
      }
    }
  }

  return {
    setPath(pts: V3[], wps: V3[] = []) { points = pts.map(p => ({ x: p.x, y: p.y, z: p.z })); waypoints = wps.map(p => ({ x: p.x, y: p.y, z: p.z })); },
    setPlayhead(p: V3 | null) { playhead = p ? { x: p.x, y: p.y, z: p.z } : null; },
    setVisible(v: boolean) { visible = v; canvas.hidden = !v; },
    get visible() { return visible; },
    draw,
  };
}
