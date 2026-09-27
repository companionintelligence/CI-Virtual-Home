// Pure 2D plan geometry shared by the browser HouseBuilder and the Node validator.
// Coordinates: metres, X east, Z south (+Z = front). Rects are {x, z, w, d} min-corner.

export const SIDES = ['S', 'N', 'E', 'W'];

export const inRect = (px, pz, r, tol = 0.01) =>
  px >= r.x - tol && px <= r.x + r.w + tol && pz >= r.z - tol && pz <= r.z + r.d + tol;

export function unionBounds(rects) {
  return {
    minX: Math.min(...rects.map(r => r.x)), maxX: Math.max(...rects.map(r => r.x + r.w)),
    minZ: Math.min(...rects.map(r => r.z)), maxZ: Math.max(...rects.map(r => r.z + r.d))
  };
}

/**
 * Perimeter edges of the union of axis-aligned rects.
 * Rasterises on a `cell` grid, emits boundary cell edges per outward side, merges collinear runs.
 * Returns [{ side, a:[x,z], b:[x,z], length }] where a→b runs +X for S/N edges and +Z for E/W edges.
 */
export function perimeterEdges(rects, cell = 0.1) {
  const { minX, maxX, minZ, maxZ } = unionBounds(rects);
  const nx = Math.round((maxX - minX) / cell), nz = Math.round((maxZ - minZ) / cell);
  const grid = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const cx = minX + (i + 0.5) * cell, cz = minZ + (k + 0.5) * cell;
    if (rects.some(r => inRect(cx, cz, r, -1e-9))) grid[i * nz + k] = 1;
  }
  const filled = (i, k) => i >= 0 && k >= 0 && i < nx && k < nz && grid[i * nz + k] === 1;
  const edges = [];
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    if (!filled(i, k)) continue;
    const x0 = minX + i * cell, x1 = x0 + cell, z0 = minZ + k * cell, z1 = z0 + cell;
    if (!filled(i, k + 1)) edges.push({ side: 'S', a: [x0, z1], b: [x1, z1] });
    if (!filled(i, k - 1)) edges.push({ side: 'N', a: [x0, z0], b: [x1, z0] });
    if (!filled(i + 1, k)) edges.push({ side: 'E', a: [x1, z0], b: [x1, z1] });
    if (!filled(i - 1, k)) edges.push({ side: 'W', a: [x0, z0], b: [x0, z1] });
  }
  const merged = [];
  for (const side of SIDES) {
    const horiz = side === 'S' || side === 'N';
    const runs = edges.filter(e => e.side === side).sort((p, q) =>
      horiz ? (p.a[1] - q.a[1]) || (p.a[0] - q.a[0]) : (p.a[0] - q.a[0]) || (p.a[1] - q.a[1]));
    let cur = null;
    for (const e of runs) {
      const sameLine = cur && Math.abs(horiz ? cur.a[1] - e.a[1] : cur.a[0] - e.a[0]) < 1e-6;
      const contiguous = cur && Math.abs(horiz ? cur.b[0] - e.a[0] : cur.b[1] - e.a[1]) < 1e-6;
      if (sameLine && contiguous) cur.b = e.b;
      else { if (cur) merged.push(cur); cur = { side, a: [...e.a], b: [...e.b] }; }
    }
    if (cur) merged.push(cur);
  }
  return merged.map(e => ({
    ...e,
    a: [round(e.a[0]), round(e.a[1])], b: [round(e.b[0]), round(e.b[1])],
    length: round(Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]))
  }));
}

const round = v => Math.round(v * 1000) / 1000;

/** The perimeter edge on `side` whose span contains world coordinate `at` (x for S/N, z for E/W). */
export function edgeForOpening(edges, side, at) {
  const horiz = side === 'S' || side === 'N';
  return edges.find(e => e.side === side && (horiz
    ? at >= e.a[0] - 1e-6 && at <= e.b[0] + 1e-6
    : at >= e.a[1] - 1e-6 && at <= e.b[1] + 1e-6)) || null;
}

/**
 * Closed loops (arrays of [x,z]) tracing the union outline, built by chaining perimeter edges.
 * Returns { outer, holes } — outer is the loop with the largest |area|, holes the rest.
 */
export function outlineLoops(edges) {
  const key = p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const byStart = new Map();
  // orient every edge so the interior is on a consistent side: S edges run +X, N edges run -X, E edges run -Z... use CCW seen from above (x right, z down => clockwise on screen)
  const oriented = edges.map(e => {
    if (e.side === 'S') return { a: e.a, b: e.b };          // +X along the south edge
    if (e.side === 'N') return { a: e.b, b: e.a };          // -X along the north edge
    if (e.side === 'E') return { a: e.b, b: e.a };          // -Z along the east edge
    return { a: e.a, b: e.b };                              // +Z along the west edge
  });
  oriented.forEach(e => { const k = key(e.a); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(e); });
  const used = new Set(); const loops = [];
  for (const start of oriented) {
    if (used.has(start)) continue;
    const loop = [start.a]; let cur = start; used.add(cur);
    for (let guard = 0; guard < 10000; guard++) {
      const nexts = (byStart.get(key(cur.b)) || []).filter(e => !used.has(e));
      if (!nexts.length) break;
      // prefer continuing straight, else turn (rectilinear polygons: at most 2 candidates)
      const dir = [Math.sign(cur.b[0] - cur.a[0]), Math.sign(cur.b[1] - cur.a[1])];
      nexts.sort((p, q) => {
        const dp = [Math.sign(p.b[0] - p.a[0]), Math.sign(p.b[1] - p.a[1])], dq = [Math.sign(q.b[0] - q.a[0]), Math.sign(q.b[1] - q.a[1])];
        const sp = dp[0] === dir[0] && dp[1] === dir[1] ? 0 : 1, sq = dq[0] === dir[0] && dq[1] === dir[1] ? 0 : 1;
        return sp - sq;
      });
      cur = nexts[0]; used.add(cur);
      if (key(cur.b) === key(loop[0])) { loop.push(cur.a); break; }
      loop.push(cur.a);
    }
    // drop collinear midpoints
    const clean = loop.filter((p, i) => {
      const prev = loop[(i - 1 + loop.length) % loop.length], next = loop[(i + 1) % loop.length];
      const collinear = (Math.abs(prev[0] - p[0]) < 1e-6 && Math.abs(next[0] - p[0]) < 1e-6) || (Math.abs(prev[1] - p[1]) < 1e-6 && Math.abs(next[1] - p[1]) < 1e-6);
      return !collinear;
    });
    if (clean.length >= 4) loops.push(clean);
  }
  const area = l => Math.abs(l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0) / 2);
  loops.sort((p, q) => area(q) - area(p));
  return { outer: loops[0] || [], holes: loops.slice(1) };
}

export function rectCentre(r) { return [r.x + r.w / 2, r.z + r.d / 2]; }
export function rectArea(rects) {
  // area of the union via the same raster (0.1 m cells)
  const { minX, maxX, minZ, maxZ } = unionBounds(rects); const cell = 0.1; let n = 0;
  const nx = Math.round((maxX - minX) / cell), nz = Math.round((maxZ - minZ) / cell);
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    if (rects.some(r => inRect(minX + (i + 0.5) * cell, minZ + (k + 0.5) * cell, r, -1e-9))) n++;
  }
  return n * cell * cell;
}
