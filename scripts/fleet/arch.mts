// Fleet metrics — owned by S2 (architecture): the vocabulary the photos need, fleet-wide. See _types.mts.
//
// All four read the specs (what a house says), never the browser: the plan sets no target for them yet, so each is reported for S2's
// PRs and the layout pass to move. `pass: null` until then.
import type { Metric } from './_types.mts';

// the finish a roof renders with today (materials.ts ROOF_KIND by roof `type`; roofs[].finish overrides it)
const FINISH = { gable: 'shingle', hip: 'shingle', shed: 'seam', terracotta: 'tile', flat: 'membrane', pent: 'seam', 'aframe-glass': 'glass' };
const finishOf = (rf: any): string => rf.finish || FINISH[rf.type] || 'shingle';
const floorKind = (r: any): string | null => (typeof r.floor === 'string' ? r.floor : r.floor && r.floor.kind) || null;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const pct = (n: number, d: number) => `${d ? Math.round(n / d * 100) : 0} %`;
const rooms = (h: any): any[] => (h.spec.levels || []).flatMap(l => l.rooms || []);
const openings = (h: any): any[] => (h.spec.levels || []).flatMap(l => l.openings || []);
const features = (h: any): any[] => (Array.isArray(h.spec.features) ? h.spec.features : []);

export const metrics: Metric[] = [
  {
    id: 'roof-finishes', title: 'Roof finishes', stream: 'S2',
    compute(f) {
      const per = f.houses.map(h => ({ id: h.id, finishes: [...new Set<string>((h.spec.roofs || []).map(finishOf))] }));
      const m = new Map<string, number>();
      for (const p of per) for (const k of p.finishes) m.set(k, (m.get(k) || 0) + 1);
      const rows = [...m.entries()].sort((a, b) => b[1] - a[1]), n = f.houses.length || 1;
      return {
        value: `${rows.map(([k, c]) => `${k} ${c}`).join(' · ')} (${per.filter(p => p.finishes.length >= 2).length} houses with two or more)`,
        pass: null,
        detail: 'Houses per finish (a house counts once per finish it uses): roofs[].finish, else the form (gable and hip → shingle, shed and pent → standing seam, terracotta → clay tile, flat → membrane).',
        table: { head: ['finish', 'houses', 'share'], rows: rows.map(([k, c]) => [k, c, `${(c / n * 100).toFixed(0)} %`]) },
      };
    },
  },
  {
    id: 'roof-composition', title: 'Roof composition', stream: 'S2',
    compute(f) {
      // what makes a roof more than a plain gable or hip: per-end forms, per-face pitches, a catslide sweep, glazed or open gables, a planted
      // surface, skylights, dormer styles, a coloured soffit or trim, a chimney that is not the default
      const marks = (rf: any): string[] => [rf.ends && 'ends', rf.pitches && 'pitches', rf.sweep && 'sweep', rf.gableGlass && 'glazed gable', rf.planted && 'planted', rf.skylights && 'skylights',
        (rf.dormers || []).some(d => d.style && d.style !== 'gable') && 'dormer styles', rf.soffit && 'soffit', rf.trim && 'trim', rf.gableCladding && 'gable cladding', rf.chimney && (rf.chimney.material || rf.chimney.cap) && 'chimney vocabulary'].filter(Boolean) as string[];
      const per = f.houses.map(h => ({ id: h.id, marks: [...new Set<string>((h.spec.roofs || []).flatMap(marks))] }));
      const using = per.filter(p => p.marks.length);
      const count = new Map<string, number>();
      for (const p of per) for (const k of p.marks) count.set(k, (count.get(k) || 0) + 1);
      return {
        value: `${using.length} of ${per.length} houses use roof vocabulary beyond the form`, measure: using.length, pass: null,
        detail: 'Roofs with per-end forms, per-face pitches, sweeps, glazed or open gables, planted surfaces, skylights, dormer styles, coloured trim or soffit, gable cladding, chimney material or cap (S2 fields).',
        table: { head: ['field', 'houses'], rows: [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => [k, c]) },
      };
    },
  },
  {
    id: 'room-finishes', title: 'Room finishes', stream: 'S2',
    compute(f) {
      const all = f.houses.map(h => ({ id: h.id, rooms: rooms(h) }));
      const total = all.reduce((s, h) => s + h.rooms.length, 0);
      const withFloor = all.reduce((s, h) => s + h.rooms.filter(r => floorKind(r)).length, 0);
      const withWalls = all.reduce((s, h) => s + h.rooms.filter(r => r.walls).length, 0);
      const withCeiling = all.reduce((s, h) => s + h.rooms.filter(r => r.ceiling).length, 0);
      const kinds = all.map(h => new Set(h.rooms.map(floorKind).filter(Boolean)).size);
      const defaults2 = f.houses.filter(h => h.spec.defaults === 2).length;
      return {
        value: `${pct(withFloor, total)} of rooms name a floor, ${pct(withWalls, total)} a wall finish, ${pct(withCeiling, total)} a ceiling; median ${median(kinds)} floor kinds a house`,
        measure: total ? withFloor / total : 0, pass: null,
        detail: `${total} rooms across ${all.length} houses. Under defaults: 2 (${defaults2} houses today) a room with none gets a seeded program-appropriate floor, so this counts what the specs say, not what builds; fleet-audit --built reads the resolved finishes from plan.json's arch.rooms.`,
      };
    },
  },
  {
    id: 'facade-vocabulary', title: 'Facade and massing vocabulary', stream: 'S2',
    compute(f) {
      const kinds = (h: any): string[] => {
        const s = h.spec, out = new Set<string>();
        for (const ft of features(h)) out.add(ft.type);
        if (s.facade) out.add('facade zones');
        if ((s.levels || []).some(l => (l.footprint || []).some(r => r.material || r.color))) out.add('per-volume cladding');
        if ((s.levels || []).some(l => l.plinth)) out.add('plinth');
        if (s.entry && s.entry.stoop) out.add('stoop');
        if (openings(h).some(o => o.shutters)) out.add('shutters');
        if (openings(h).some(o => o.box)) out.add('window boxes');
        if (openings(h).some(o => o.surround || (o.head && o.head !== 'flat'))) out.add('surrounds and heads');
        if (openings(h).some(o => o.canopy)) out.add('canopies');
        if ((s.levels || []).some(l => (l.footprint || []).some(r => r.h !== undefined))) out.add('towers (per-rect h)');
        if ((s.levels || []).some(l => Array.isArray(l.stairs) || (l.stairs && ['L', 'U', 'closed'].includes(l.stairs.type)))) out.add('turning or arrayed stairs');
        if (rooms(h).some(r => r.ceiling && r.ceiling.kind === 'double')) out.add('double-height rooms');
        return [...out];
      };
      const per = f.houses.map(h => ({ id: h.id, kinds: kinds(h) }));
      const count = new Map<string, number>();
      for (const p of per) for (const k of p.kinds) count.set(k, (count.get(k) || 0) + 1);
      return {
        value: `${per.filter(p => p.kinds.length).length} of ${per.length} houses use S2 facade vocabulary; median ${median(per.map(p => p.kinds.length))} kinds a house`,
        measure: median(per.map(p => p.kinds.length)), pass: null,
        detail: 'Kinds a house says it has: porch, bay, balcony, terrace, loggia, fireplace, built-ins, facade zones, per-volume cladding, plinth, stoop, shutters, window boxes, surrounds, canopies, towers, turning stairs, double-height rooms.',
        table: { head: ['kind', 'houses'], rows: [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => [k, c]) },
      };
    },
  },
];
