// Validator plugin — owned by S5 (shot). What the planner v2 knobs may say (plan §3.16), and the core's shot-duration rule
// (it takes over: `duration` may also be 'auto'). Everything here is a warning except a value the planner cannot read.
// This stream's `extend`: nothing (the shot types, walls and roofs are the core's).
import type { Check, Issue } from './_types.mts';

export const replaces = ['shot-duration'] as const;

const BEATS = ['establish', 'extStair', 'approach', 'threshold', 'reveal', 'route', 'stair', 'descend', 'roomReveal', 'hero', 'orbit', 'power'];
const STYLES = ['auto', 'axial', 'corner-left', 'corner-right', 'garden', 'dollhouse'];
const V2_SHOTS = ['door-to-core', 'hero-reveal', 'walkthrough'];
const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

const check: Check = (spec) => {
  const out: Issue[] = [];
  const err = (code: string, message: string) => out.push({ level: 'error', code, message });
  const warn = (code: string, message: string) => out.push({ level: 'warn', code, message });
  const rooms = new Set<string>(), itemTypes = new Set<string>();
  for (const lv of spec.levels || []) for (const r of lv.rooms || []) {
    if (r.name) rooms.add(String(r.name)); if (r.no !== undefined) rooms.add(String(r.no));
    for (const it of r.items || []) if (it.type) itemTypes.add(String(it.type));
  }
  if (spec.showcase !== undefined) {
    if (!Array.isArray(spec.showcase) || spec.showcase.some((x: unknown) => typeof x !== 'string')) err('shots:showcase', 'showcase must be a list of room names / numbers and item types');
    else for (const nm of spec.showcase) if (!rooms.has(nm) && !itemTypes.has(nm)) warn('shots:showcase', `showcase "${nm}" names no room, room number or item type in this spec`);
  }
  if (spec.hero && spec.hero.view !== undefined) {
    const v = spec.hero.view;
    if (!v || typeof v !== 'object' || Array.isArray(v)) err('shots:hero-view', 'hero.view must be { azimuth, dist, height }');
    else {
      if (v.azimuth !== undefined && !num(v.azimuth, -80, 80)) err('shots:hero-view', `hero.view.azimuth ${JSON.stringify(v.azimuth)} (degrees off the Core's front, −80…80)`);
      else if (typeof v.azimuth === 'number' && Math.abs(v.azimuth) < 10) warn('shots:hero-view', `hero.view.azimuth ${v.azimuth}: nearly dead-on (the finale wants 15–65° off the Core's front)`);
      if (v.dist !== undefined && !num(v.dist, 0.6, 2)) err('shots:hero-view', `hero.view.dist ${JSON.stringify(v.dist)} (m from the Core, 0.6–2)`);
      if (v.height !== undefined && !num(v.height, 0, 0.8)) err('shots:hero-view', `hero.view.height ${JSON.stringify(v.height)} (m over the Core's top, 0–0.8)`);
    }
  }
  for (const sh of spec.shots || []) {
    const S = `shot ${sh.id || sh.type}`;
    if (sh.duration !== undefined) {
      if (sh.duration === 'auto') { if (!V2_SHOTS.includes(sh.type)) err('shots:duration', `${S}: duration "auto" is for door-to-core, hero-reveal and walkthrough (planner v2)`); }
      else if (!num(sh.duration, 2, 60)) err('shots:duration', `${S}: duration ${JSON.stringify(sh.duration)} (seconds, 2–60, or "auto")`);
      // door-to-core walks the house, climbs its stairs and orbits the Core: under 8 s the walk is a blur of whip pans
      else if (sh.type === 'door-to-core' && sh.duration < 8) err('shots:duration', `${S}: duration ${sh.duration} (door-to-core needs at least 8 s)`);
    }
    if (sh.planner !== undefined) {
      if (sh.planner !== 'v1' && sh.planner !== 'v2') err('shots:planner', `${S}: planner ${JSON.stringify(sh.planner)} ("v1" | "v2")`);
      else if (sh.planner === 'v2' && !V2_SHOTS.includes(sh.type)) err('shots:planner', `${S}: planner "v2" flies door-to-core, hero-reveal and walkthrough; ${sh.type} keeps the v1 path`);
    }
    const knobs = ['establish', 'via', 'beats', 'route'].filter(k => sh[k] !== undefined);
    if (knobs.length && sh.type !== 'door-to-core') warn('shots:knob', `${S}: ${knobs.join(', ')} steer door-to-core only`);
    if (knobs.length && sh.type === 'door-to-core' && sh.planner === 'v1') warn('shots:knob', `${S}: ${knobs.join(', ')} are read by planner v2; this shot is pinned to v1`);
    if (sh.establish !== undefined) {
      const e = sh.establish;
      if (typeof e === 'string') { if (!STYLES.includes(e)) err('shots:establish', `${S}: establish "${e}" (${STYLES.join(' | ')} or { bearing, height, dist })`); }
      else if (!e || typeof e !== 'object' || Array.isArray(e)) err('shots:establish', `${S}: establish must be a style name or { bearing, height, dist }`);
      else {
        if (e.bearing !== undefined && !num(e.bearing, -90, 90)) err('shots:establish', `${S}: establish.bearing ${JSON.stringify(e.bearing)} (degrees off the door's axis, −90…90)`);
        if (e.height !== undefined && !num(e.height, 1.6, 20)) err('shots:establish', `${S}: establish.height ${JSON.stringify(e.height)} (m, 1.6–20)`);
        if (e.dist !== undefined && !num(e.dist, 0, 40)) err('shots:establish', `${S}: establish.dist ${JSON.stringify(e.dist)} (m from the facade, 0–40)`);
      }
    }
    if (sh.via !== undefined) {
      if (!Array.isArray(sh.via) || sh.via.some((x: unknown) => typeof x !== 'string')) err('shots:via', `${S}: via must be a list of room names or numbers`);
      else for (const nm of sh.via) if (!rooms.has(nm)) warn('shots:via', `${S}: via "${nm}" names no room in this spec`);
    }
    if (sh.beats !== undefined) {
      if (!sh.beats || typeof sh.beats !== 'object' || Array.isArray(sh.beats)) err('shots:beats', `${S}: beats must be { <beat>: seconds }`);
      else for (const [k, v] of Object.entries(sh.beats)) {
        if (!BEATS.includes(k)) err('shots:beats', `${S}: beats.${k} (${BEATS.join(' | ')})`);
        else if (!num(v, 0.4, 8)) err('shots:beats', `${S}: beats.${k} ${JSON.stringify(v)} (seconds, 0.4–8)`);
      }
    }
    if (sh.route !== undefined && !['auto', 'scenic', 'shortest'].includes(sh.route)) err('shots:route', `${S}: route ${JSON.stringify(sh.route)} ("auto" | "scenic" | "shortest")`);
  }
  return out;
};
export default check;
