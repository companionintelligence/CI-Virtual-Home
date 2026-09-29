// Engine-independent elementary functions for the spline planner v2 and QA v2 (S5).
//
// Why: the planner bakes a track the page plays and the Node harness also bakes (scripts/test-shot-planner.mts proves the
// two are the same film), and the ECMAScript spec leaves Math.sin, cos, tan, atan, atan2, asin, acos, exp, log, pow and
// hypot implementation-approximated: V8 in Node 22 and V8 in Chromium 154 return results that differ in the last bit for
// a share of inputs. A last-bit difference is enough to flip a probe, a visibility test, a `>` between two equal scores,
// and the two engines then bake different looks (0.15 m at a look target, seen on a spiral stair). Every function here
// is built from + − × ÷ and sqrt only, which IEEE 754 fixes to the last bit, so every engine returns the same doubles.
//
// Accuracy is about 1e-16 relative (a few ulp) — the point is agreement, not the last digit.
//
// Use: `import { Math } from './detmath.js';` at the top of a module shadows the global Math in that module with this one
// (every other member — sqrt, abs, min, max, floor, round, PI … — is the engine's own, and exact).
//
// Owner: S5 (shot). THREE-free.
const PI = 3.141592653589793, PIO2 = PI / 2;
// pi/2 as three parts (fdlibm's pio2_1, pio2_1t: the first is a 33-bit head, so k × it is exact for |k| < 2^20)
const PIO2_1 = 1.57079632673412561417e+00, PIO2_1T = 6.07710050650619224932e-11;
const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10;
const M = globalThis.Math;
const sqrt = M.sqrt, floor = M.floor, round = M.round, abs = M.abs;

// 1 / n! by division (each an IEEE result)
const INV_FACT: number[] = [1];
for (let n = 1; n < 30; n++) INV_FACT.push(INV_FACT[n - 1] / n);

/** sin r and cos r for |r| ≤ π/4 (Taylor, to r^17 and r^16) */
function sinPoly(r: number) { const z = r * r; let s = 0; for (let n = 8; n >= 0; n--) s = s * z + (n % 2 === 0 ? 1 : -1) * INV_FACT[2 * n + 1]; return r * s; }
function cosPoly(r: number) { const z = r * r; let s = 0; for (let n = 8; n >= 0; n--) s = s * z + (n % 2 === 0 ? 1 : -1) * INV_FACT[2 * n]; return s; }
/** x = k × π/2 + r, |r| ≤ π/4 */
function reduce(x: number) { const k = round(x * (2 / PI)); return { q: ((k % 4) + 4) % 4, r: (x - k * PIO2_1) - k * PIO2_1T }; }

export function sin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  if (x === 0) return x;
  const { q, r } = reduce(x);
  return q === 0 ? sinPoly(r) : q === 1 ? cosPoly(r) : q === 2 ? -sinPoly(r) : -cosPoly(r);
}
export function cos(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  const { q, r } = reduce(x);
  return q === 0 ? cosPoly(r) : q === 1 ? -sinPoly(r) : q === 2 ? -cosPoly(r) : sinPoly(r);
}
export function tan(x: number): number { return sin(x) / cos(x); }

/** atan for any x: the argument brought inside [−1, 1] by the reciprocal, then halved twice (atan x = 2 atan(x / (1 + √(1 + x²))))
 *  to under 0.2, where the series converges in a handful of terms */
export function atan(x: number): number {
  if (x !== x) return NaN;
  if (x === 0) return x;
  const neg = x < 0, a = neg ? -x : x;
  let res: number;
  if (a === Infinity) res = PIO2;
  else {
    const inv = a > 1, u = inv ? 1 / a : a;
    let z = u / (1 + sqrt(1 + u * u)); z = z / (1 + sqrt(1 + z * z));
    const z2 = z * z; let s = 0; for (let n = 12; n >= 0; n--) s = s * z2 + (n % 2 === 0 ? 1 : -1) / (2 * n + 1);
    const t = 4 * z * s;
    res = inv ? PIO2 - t : t;
  }
  return neg ? -res : res;
}
export function atan2(y: number, x: number): number {
  if (x !== x || y !== y) return NaN;
  if (y === 0) return (x > 0 || (x === 0 && 1 / x > 0)) ? y : (1 / y > 0 ? PI : -PI);
  if (x === 0) return y > 0 ? PIO2 : -PIO2;
  if (x === Infinity) return y === Infinity || y === -Infinity ? (y > 0 ? PI / 4 : -PI / 4) : (y > 0 ? 0 : -0);
  if (x === -Infinity) return y === Infinity || y === -Infinity ? (y > 0 ? 3 * PI / 4 : -3 * PI / 4) : (y > 0 ? PI : -PI);
  if (y === Infinity) return PIO2; if (y === -Infinity) return -PIO2;
  const a = atan(y / x);
  return x > 0 ? a : y >= 0 ? a + PI : a - PI;
}
export function asin(x: number): number {
  if (!(abs(x) <= 1)) return NaN;
  if (x === 1) return PIO2; if (x === -1) return -PIO2;
  return atan2(x, sqrt((1 - x) * (1 + x)));
}
export function acos(x: number): number {
  if (!(abs(x) <= 1)) return NaN;
  if (x === 1) return 0; if (x === -1) return PI;
  return atan2(sqrt((1 - x) * (1 + x)), x);
}

/** 2^k exactly (k integer, −1022 … 1023), from the bit pattern */
const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
const LE = (() => { f64[0] = 1; return u32[1] === 0x3ff00000; })();   // (the high word's index; the same on every platform this runs on)
const HI = LE ? 1 : 0, LO = LE ? 0 : 1;
const pow2 = (k: number) => { u32[HI] = (k + 1023) << 20; u32[LO] = 0; return f64[0]; };
export function exp(x: number): number {
  if (x !== x) return NaN;
  if (x > 709.78) return Infinity; if (x < -745) return 0;
  const k = round(x / M.LN2), r = (x - k * LN2_HI) - k * LN2_LO;
  let s = 0; for (let n = 16; n >= 0; n--) s = s * r + INV_FACT[n];
  // (k split in two so 2^k stays a normal number at the ends of the range)
  const k1 = floor(k / 2), k2 = k - k1;
  return s * pow2(k1) * pow2(k2);
}
/** the natural log, x > 0: x = m × 2^e with m in [√½, √2), log m = 2 atanh((m − 1)/(m + 1)) */
export function log(x: number): number {
  if (x !== x || x < 0) return NaN;
  if (x === 0) return -Infinity; if (x === Infinity) return Infinity;
  let e = 0, m = x;
  if (m < 2.2250738585072014e-308) { m *= 18014398509481984; e -= 54; }   // (a subnormal, scaled up by 2^54)
  f64[0] = m; const hi = u32[HI]; e += ((hi >>> 20) & 0x7ff) - 1023; u32[HI] = (hi & 0x000fffff) | 0x3ff00000; m = f64[0];
  if (m > 1.4142135623730951) { m *= 0.5; e += 1; }
  const s = (m - 1) / (m + 1), s2 = s * s; let t = 0; for (let n = 12; n >= 0; n--) t = t * s2 + 1 / (2 * n + 1);
  return e * LN2_HI + (e * LN2_LO + 2 * s * t);
}
/** x^y: an integer power by repeated squaring (exact IEEE products), otherwise exp(y log x) for x > 0 */
export function pow(x: number, y: number): number {
  if (y === 0) return 1;
  if (x !== x || y !== y) return NaN;
  if (Number.isInteger(y) && abs(y) <= 1024) {
    let n = abs(y), b = x, r = 1; while (n) { if (n & 1) r *= b; b *= b; n = floor(n / 2); }
    return y < 0 ? 1 / r : r;
  }
  if (x > 0) return exp(y * log(x));
  if (x === 0) return y > 0 ? 0 : Infinity;
  return NaN;
}
/** √(a² + b² + c² + d²), summed left to right (an absent argument adds an exact 0): the engines' own hypot may differ in the last bit between versions */
export function hypot(a: number, b = 0, c = 0, d = 0): number { return sqrt(a * a + b * b + c * c + d * d); }

/** the shadow: `import { Math } from './detmath.js'` — this module's members over the engine's for everything that is not exact */
export const Math: typeof globalThis.Math = Object.assign(Object.create(M), { sin, cos, tan, atan, atan2, asin, acos, exp, log, pow, hypot });
