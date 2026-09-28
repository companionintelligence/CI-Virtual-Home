// Fleet metrics — owned by S1 (kit): colours, doors, claddings and lighting, as the builder renders them today.
// See _types.mts for the contract. The "what renders" mirrors below restate the builder's own rules; S1 keeps them
// in step as it changes those rules (per-level cladding, the door family, restraint, lighting bearings).
import type { Metric, Fleet, House } from './_types.mts';
import { restrainPalette, colourMath } from '../../assets/materials.js';
import { TIME_OF_DAY, lightingName } from '../../assets/environment.js';

// ---- what renders, per role -------------------------------------------------------------------------------------
// house-builder.ts build(): the palette defaults, then restrainPalette (materials.ts)
const builtPalette = (spec: any) => restrainPalette({ wall: '#f8fafc', trim: '#1e293b', roof: '#3f2a1d', accent: '#0f766e', ...(spec.palette || {}) });
// roofs.ts: a roof's colour is its own `color`, else a per-type default (not palette.roof); materials.ts
// roofMaterial() then restrains it and pulls a dark shingle / seam / membrane 42 % toward charcoal
const ROOF_DEFAULT = { gable: 0x3f2a1d, hip: 0x3f2a1d, shed: 0x334155, flat: 0x334155, 'aframe-glass': 0x0f172a, terracotta: 0xb45309 };
const ROOF_KIND = { gable: 'asphalt-shingle', hip: 'asphalt-shingle', shed: 'standing-seam', terracotta: 'clay-tile', flat: 'membrane' };
const { mix, lum, restrain } = colourMath;   // materials.ts's own colour maths
function roofRendered(rf: any, hex: (c: any) => number): number | null {
  if (rf.type === 'aframe-glass') return null;
  const kind = ROOF_KIND[rf.type] || 'asphalt-shingle';
  const c0 = hex(rf.color || ROOF_DEFAULT[rf.type] || 0x3f2a1d), dark = lum(c0) < 0.35;
  return kind === 'clay-tile' ? mix(restrain(c0, 0.22, 0.25), 0x3a3531, 0.12)
    : kind === 'membrane' ? (dark ? mix(restrain(c0, 0.12, 0.3), 0x34363a, 0.4) : restrain(c0, 0.15, 0.3))
    : dark ? mix(restrain(c0, 0.12, 0.3), kind === 'standing-seam' ? 0x31353b : 0x282b31, 0.42) : restrain(c0, 0.2, 0.35);
}
// the house's main roof: the one over the largest plan area
const mainRoof = (spec: any) => (spec.roofs || []).slice().sort((a, b) => b.over.w * b.over.d - a.over.w * a.over.d)[0] || null;
// room-creator.html createParametricWall: a hinged leaf (≤ 1.1 m) is the opening's `color`, else teal 0x0f766e; a
// wider door is a cased opening with no leaf; a slider is glass
const DEFAULT_LEAF = '#0f766e';
function entryDoor(spec: any): { kind: 'leaf' | 'cased' | 'slider' | 'garage' | 'none'; colour: string | null } {
  const e = spec.entry, lv = e && (spec.levels || []).find(l => l.id === e.level);
  const op = lv && (lv.openings || []).find(o => o.side === e.side && Math.abs(o.at - e.at) < 1e-6);
  if (!op) return { kind: 'none', colour: null };
  if (op.type === 'slider' || op.style === 'glass-slider') return { kind: 'slider', colour: null };
  if (op.type === 'garage') return { kind: 'garage', colour: null };
  if (op.w > 1.1) return { kind: 'cased', colour: null };
  return { kind: 'leaf', colour: (op.color || DEFAULT_LEAF).toLowerCase() };
}

// colours within ΔE < 3 of one already counted are the same colour (a just-noticeable difference, give or take)
function distinct(cols: string[], deltaE: Fleet['deltaE']): string[] {
  const out: string[] = [];
  for (const c of cols) if (!out.some(o => deltaE(o, c) < 3)) out.push(c);
  return out;
}
const median = (xs: number[]) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

const roles = (h: House, f: Fleet) => {
  const p = builtPalette(h.spec), rf = mainRoof(h.spec), roof = rf ? roofRendered(rf, f.hex) : null, door = entryDoor(h.spec);
  return { wall: String(p.wall).toLowerCase(), trim: String(p.trim).toLowerCase(), roof: roof === null ? null : f.css(roof), door: door.colour };
};

export const metrics: Metric[] = [
  {
    id: 'palette-spread', title: 'Palette spread (wall, trim, roof, door as rendered)', stream: 'S1',
    compute(f) {
      const per = f.houses.map(h => roles(h, f));
      const rows = [];
      for (const role of ['wall', 'trim', 'roof', 'door'] as const) {
        const cols = per.map(r => r[role]).filter(Boolean) as string[];
        const d: number[] = [];
        for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) d.push(f.deltaE(cols[i], cols[j]));
        const close = d.length ? d.filter(x => x < 5).length / d.length : 0;
        rows.push([role, cols.length, distinct(cols, f.deltaE).length, median(d).toFixed(1), `${(close * 100).toFixed(0)} %`]);
      }
      return {
        value: rows.map(r => `${r[0]} ${r[2]} distinct`).join(' · '), pass: null,   // reported (the door's target is door-colours)
        detail: 'Pairwise CIEDE2000 across the houses. Wall: the palette after restraint (materials.ts restrainPalette). Roof: the largest roof, its own colour or the per-type default, after roofMaterial\'s restraint and charcoal pull. Door: the entry leaf (teal when the spec gives none; cased openings and sliders have no leaf).',
        table: { head: ['role', 'houses', 'distinct (ΔE ≥ 3)', 'median ΔE', 'pairs under ΔE 5'], rows },
      };
    },
  },
  {
    id: 'door-colours', title: 'Entry-door colours', stream: 'S1', target: '≥ 20 distinct across the fleet',
    compute(f) {
      const doors = f.houses.map(h => ({ id: h.id, ...entryDoor(h.spec) }));
      const leaves = doors.filter(d => d.kind === 'leaf');
      const byColour = new Map<string, string[]>();
      for (const d of leaves) byColour.set(d.colour, [...(byColour.get(d.colour) || []), d.id]);
      const n = distinct(leaves.map(d => d.colour), f.deltaE).length;
      const other = ['cased', 'slider', 'garage', 'none'].map(k => [k, doors.filter(d => d.kind === k).length]).filter(([, c]) => c);
      return {
        value: `${n} distinct leaf colours (${leaves.filter(d => d.colour === DEFAULT_LEAF).length} of ${leaves.length} leaves are the default teal)`, measure: n, pass: n >= 20,
        detail: `Entries without a leaf: ${other.map(([k, c]) => `${c} ${k}`).join(', ') || 'none'}.`,
        table: { head: ['leaf colour', 'houses', 'ids'], rows: [...byColour.entries()].sort((a, b) => b[1].length - a[1].length).map(([c, ids]) => [`\`${c}\`${c === DEFAULT_LEAF ? ' (default)' : ''}`, ids.length, ids.join(', ')]) },
      };
    },
  },
  {
    id: 'claddings', title: 'Claddings per house', stream: 'S1', target: 'median ≥ 2',
    compute(f) {
      // declared: palette.material and the per-level / per-volume / facade fields S1 and S2 add; the builder renders
      // ONE today (kit.cladding() is a single cached material per house), whatever a level asks for
      const counts = f.houses.map(h => {
        const s = h.spec, set = new Set<string>([s.palette && s.palette.material || 'stucco']);
        for (const lv of s.levels || []) { if (lv.material) set.add(lv.material); for (const r of lv.footprint || []) if (r.material) set.add(r.material); }
        for (const z of Array.isArray(s.facade) ? s.facade : []) if (z && z.material) set.add(z.material);
        return { id: h.id, n: set.size, kinds: [...set] };
      });
      const kinds = new Map<string, number>();
      for (const c of counts) for (const k of c.kinds) kinds.set(k, (kinds.get(k) || 0) + 1);
      const med = median(counts.map(c => c.n));
      return {
        value: `median ${med} (${counts.filter(c => c.n >= 2).length} of ${counts.length} houses declare 2 or more)`, measure: med, pass: med >= 2,
        detail: 'Declared in the spec (palette.material, levels[].material, footprint[].material, facade[].material). Rendered today: one per house — kit.cladding() caches a single material.',
        table: { head: ['cladding', 'houses'], rows: [...kinds.entries()].sort((a, b) => b[1] - a[1]) },
      };
    },
  },
  {
    id: 'lighting-share', title: 'Lighting presets and sun bearings', stream: 'S1', target: 'no preset above 40 % of houses, no 15° sun-bearing bucket above 25 %',
    compute(f) {
      const FRONT = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
      const rows = f.houses.map(h => {
        const preset = lightingName(typeof h.spec.lighting === 'string' ? h.spec.lighting : h.spec.lighting && h.spec.lighting.preset), fr = FRONT[(h.spec.entry || {}).side] || [0, 1];
        // environment.ts sunDirection: the entry's bearing plus the preset's swing
        const bearing = ((Math.atan2(fr[0], fr[1]) * 180 / Math.PI + TIME_OF_DAY[preset].sun.swing) % 360 + 360) % 360;
        return { id: h.id, preset, bearing, bucket: Math.floor(bearing / 15) * 15, alias: typeof h.spec.lighting === 'string' && h.spec.lighting !== preset };
      });
      const share = (key: string) => { const m = new Map<string | number, number>(); for (const r of rows) m.set(r[key], (m.get(r[key]) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
      const presets = share('preset'), buckets = share('bucket'), n = rows.length || 1;
      const topP = presets[0] ? presets[0][1] / n : 0, topB = buckets[0] ? buckets[0][1] / n : 0;
      return {
        value: `top preset ${presets[0] ? presets[0][0] : '—'} ${(topP * 100).toFixed(0)} %, top sun bucket ${buckets[0] ? buckets[0][0] + '°' : '—'} ${(topB * 100).toFixed(0)} %`,
        measure: +Math.max(topP, topB).toFixed(4), pass: topP <= 0.4 && topB <= 0.25,
        detail: `${rows.filter(r => r.alias).length} specs name their preset by a legacy alias. The sun stands at the entry's bearing plus the preset's swing (environment.ts sunDirection), so houses whose entries face one way share one sun per preset.`,
        table: { head: ['preset', 'houses', 'share'], rows: presets.map(([p, c]) => [p, c, `${(c / n * 100).toFixed(0)} %`]).concat(buckets.map(([b, c]) => [`sun ${b}°–${+b + 15}°`, c, `${(c / n * 100).toFixed(0)} %`])) },
      };
    },
  },
];
