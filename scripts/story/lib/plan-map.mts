// The schematic floor plan of a family's home: one drawing per storey, with a pin for each person in the room they use.
//
// A pure function of the HouseSpec's room bounds (content/houses/<id>.json: levels[].rooms[].bounds, levels[].footprint), so the same spec gives the
// same bytes (no clock, no random, numbers written with a fixed number of decimals). Build time only: the family page (scripts/story/pages.mts) writes it
// into the page as static HTML; nothing here runs in the browser.
//
// What it draws, and what it does not:
//   - the rooms as rectangles with their names (the spec's, in sentence case: "Master Suite" is the "Primary suite"), and the storey's footprint under them;
//   - it is a diagram, not a plan: no walls, doors, stairs or furniture, and it says so in its caption. The 3D tour is the picture of the home;
//   - the pins are NOT in the SVG. They are plain HTML links laid over it by percentage (pages.mts), so each can be a 44 px target and a real link
//     (`#sally`) whatever size the drawing is shown at. `placePins` gives their level and position.
//   - colours are the page's tokens (portal/family.css: .plan-*), never a value written here.
//
// Units: the spec's metres. x runs right, z runs down the page (towards the front of the house). The SVG's user unit is SCALE per metre.
// Every storey is drawn in the same view box (the union of all storeys), so the storeys line up and a pin's percentage is the same shape on each.

export const SCALE = 20;
/** the padding round the union of the storeys, metres */
export const PAD = 0.6;

export type Rect = { x: number; z: number; w: number; d: number };
export type PlanRoom = Rect & { name: string; label: string; cx: number; cz: number };
export type PlanLevel = { id: string; name: string; label: string; index: number; rooms: PlanRoom[]; footprint: Rect[] };
export type Plan = { levels: PlanLevel[]; view: Rect };
export type PinIn = { id: string; name: string; room: string };
export type Pin = PinIn & { level: string; roomLabel: string; xPct: number; yPct: number };

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const r2 = (v: number): number => Math.round(v * 100) / 100;
/** fixed-decimal text, no "-0" and no trailing zeros: the same number is always the same bytes */
const f1 = (v: number): string => { const s = (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, ''); return s === '-0' ? '0' : s; };
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * What the page calls a room. The spec's name in sentence case; "Master" is not a word the site uses ("Primary suite"), nor is "Portal" (the copy rules keep it for
 * the Companion account page; a room called "Portal Frame" is an archway); `labels` is the casting's label for the rooms the family lives in ("Boy's Room" is
 * "Steve's room").
 */
export function roomLabel(name: string, labels: Record<string, string> = {}): string {
  if (labels[name]) return labels[name];
  const t = name.replace(/\s+/g, ' ').trim().replace(/^Master\b/i, 'Primary').replace(/\bPortal\b/gi, 'Archway');
  return t.replace(/^(\S+)(.*)$/, (_a, first: string, rest: string) => first + rest.toLowerCase());
}

/** "Ground Floor Plan" is the "Ground floor"; a name with no storey word keeps its words ("Penthouse"). */
export function levelLabel(name: string | undefined, index: number): string {
  const t = (name || '').replace(/\s+plan$/i, '').replace(/\s+/g, ' ').trim();
  if (!t) return `Level ${index + 1}`;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

const rectOf = (b: any): Rect | null => (b && typeof b.x === 'number' && typeof b.z === 'number' && num(b.w) > 0 && num(b.d) > 0 ? { x: b.x, z: b.z, w: b.w, d: b.d } : null);

/** The plan of a HouseSpec: its storeys with their rooms (those with bounds), in the spec's order, and the shared view box. Null when the spec has no room with bounds. */
export function readPlan(spec: any, labels: Record<string, string> = {}): Plan | null {
  const levels: PlanLevel[] = [];
  const seenLabel = new Map<string, number>();
  (Array.isArray(spec?.levels) ? spec.levels : []).forEach((l: any, index: number) => {
    const rooms: PlanRoom[] = [];
    for (const r of Array.isArray(l?.rooms) ? l.rooms : []) {
      const b = rectOf(r?.bounds);
      if (!b || !r.name) continue;
      rooms.push({ ...b, name: String(r.name), label: roomLabel(String(r.name), labels), cx: r2(b.x + b.w / 2), cz: r2(b.z + b.d / 2) });
    }
    if (!rooms.length) return;
    const footprint = (Array.isArray(l?.footprint) ? l.footprint : []).map(rectOf).filter(Boolean) as Rect[];
    let label = levelLabel(l?.name, index);
    const n = (seenLabel.get(label) || 0) + 1; seenLabel.set(label, n);
    if (n > 1) label = `${label} ${n}`;
    levels.push({ id: String(l?.id || `l${index + 1}`), name: String(l?.name || ''), label, index, rooms, footprint });
  });
  if (!levels.length) return null;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const l of levels) for (const r of [...l.rooms, ...l.footprint]) { x0 = Math.min(x0, r.x); z0 = Math.min(z0, r.z); x1 = Math.max(x1, r.x + r.w); z1 = Math.max(z1, r.z + r.d); }
  return { levels, view: { x: r2(x0 - PAD), z: r2(z0 - PAD), w: r2(x1 - x0 + 2 * PAD), d: r2(z1 - z0 + 2 * PAD) } };
}

/** The room names of the whole plan, in order (the test's "rooms exist"). */
export const roomNames = (plan: Plan): string[] => plan.levels.flatMap(l => l.rooms.map(r => r.name));

/** The view box's aspect, width over height, for a box that holds the drawing and the pins at the same shape. */
export const aspect = (plan: Plan): number => Math.round((plan.view.w / plan.view.d) * 1000) / 1000;

/**
 * One pin for each person whose room is in the plan. The pin sits at the room's centre; people in one room are spread along its longer side so no
 * two share a spot. A person whose room is not in the plan has no pin and is listed in `missing` (the page then simply has no pin for them).
 * Positions are percentages of the view box: left = xPct, top = yPct.
 */
export function placePins(plan: Plan, people: PinIn[]): { pins: Pin[]; missing: string[] } {
  const find = (name: string): { level: PlanLevel; room: PlanRoom } | null => {
    for (const level of plan.levels) { const room = level.rooms.find(r => r.name === name); if (room) return { level, room }; }
    return null;
  };
  const here = new Map<string, PinIn[]>();
  const missing: string[] = [];
  for (const p of people) {
    if (!find(p.room)) { missing.push(p.id); continue; }
    here.set(p.room, [...(here.get(p.room) || []), p]);
  }
  const GAP = 1.8;   // metres between two pins of one room
  const pins: Pin[] = [];
  for (const p of people) {
    const at = find(p.room); if (!at) continue;
    const group = here.get(p.room)!, i = group.indexOf(p), n = group.length;
    const along = at.room.w >= at.room.d ? 'x' : 'z';
    const off = (i - (n - 1) / 2) * Math.min(GAP, (along === 'x' ? at.room.w : at.room.d) / Math.max(1, n));
    const cx = at.room.cx + (along === 'x' ? off : 0), cz = at.room.cz + (along === 'z' ? off : 0);
    pins.push({ ...p, level: at.level.id, roomLabel: at.room.label, xPct: r2(((cx - plan.view.x) / plan.view.w) * 100), yPct: r2(((cz - plan.view.z) / plan.view.d) * 100) });
  }
  return { pins, missing };
}

// ------------------------------------------------------------------------------------------------------------------------ the drawing

const FONT = 11;            // user units: the room names. The drawing is shown at about 1.2 px a unit on a laptop and 0.6 on a phone (which scrolls it sideways).
const CHAR = 0.58;          // an average glyph's width in ems

/** The half-height of a pin in drawing units: a room that carries a pin keeps its name above it (see `levelSvg`). A pin is 30 px; the drawing is shown at about 1.2 px a unit or more. */
export const PIN_R = 14;
/**
 * A name set in a room: the lines it breaks into at the room's width, and the font size that fits them (never under MIN_FONT: below that a drawing's text cannot
 * be read). `availH` is the height the text may take, in units (default the room's own); a room with a pin gives it the part above the pin. `fits` is false when
 * the name does not fit the room even at MIN_FONT (a closet, a thin strip): the drawing then prints no text there and the room's name is in the drawing's label
 * and in a tooltip.
 */
export const MIN_FONT = 7;
export function labelFor(label: string, w: number, d: number, availH?: number): { lines: string[]; size: number; fits: boolean } {
  const wu = w * SCALE - 6, du = availH ?? d * SCALE - 4;
  const words = label.split(' ');
  const fit = (size: number): string[] | null => {
    const per = Math.max(1, Math.floor(wu / (size * CHAR)));
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      if (word.length > per) return null;
      if (!cur) cur = word;
      else if ((cur + ' ' + word).length <= per) cur += ' ' + word;
      else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    return lines.length * size * 1.25 <= du ? lines : null;
  };
  for (let size = FONT; size >= MIN_FONT; size -= 0.5) { const lines = fit(size); if (lines) return { lines, size, fits: true }; }
  return { lines: words, size: MIN_FONT, fits: false };
}

export type SvgOpts = {
  /** the room (by name) the Companion Core sits in: marked with a small stylised box at the foot of the room */
  core?: string;
  /** the rooms (by name) that carry a pin on this storey: their name is set at the top of the room, above the pin, which sits at the room's centre */
  pinned?: string[];
};

/**
 * One storey as an `<svg>`. Classes only (portal/family.css .plan-*): `plan-foot` the storey's footprint, `plan-room` a room, `plan-name` its name,
 * `plan-core` the Core's mark. The label is for a screen reader: the rooms in words, since the drawing is a picture of them.
 */
export function levelSvg(plan: Plan, level: PlanLevel, o: SvgOpts = {}): string {
  const v = plan.view;
  const X = (x: number): string => f1((x - v.x) * SCALE), Z = (z: number): string => f1((z - v.z) * SCALE);
  const W = (w: number): string => f1(w * SCALE);
  const coreRoom = o.core ? level.rooms.find(r => r.name === o.core) : undefined;
  const rooms = `${level.rooms.map(r => r.label).join(', ')}.${coreRoom ? ` The Companion Core is in the ${coreRoom.label}.` : ''}`;
  const parts: string[] = [];
  for (const f of level.footprint) parts.push(`<rect class="plan-foot" x="${X(f.x)}" y="${Z(f.z)}" width="${W(f.w)}" height="${W(f.d)}" rx="2"/>`);
  const pinned = new Set(o.pinned || []);
  for (const r of level.rooms) {
    parts.push(`<rect class="plan-room" x="${X(r.x)}" y="${Z(r.z)}" width="${W(r.w)}" height="${W(r.d)}" rx="1.5"><title>${esc(r.label)}</title></rect>`);
    const up = pinned.has(r.name);
    // (a room with a pin keeps its name above the pin, which is at the room's centre; any other room has its name at the centre)
    const t = up ? labelFor(r.label, r.w, r.d, Math.max(8, (r.d * SCALE) / 2 - PIN_R - 6)) : labelFor(r.label, r.w, r.d);
    const lh = t.size * 1.25;
    const y0 = up ? (r.z - v.z) * SCALE + 4 + t.size * 0.9 : (r.cz - v.z) * SCALE - ((t.lines.length - 1) * lh) / 2 + t.size * 0.35;
    if (t.fits) parts.push(`<text class="plan-name" x="${X(r.cx)}" y="${f1(y0)}" text-anchor="middle" font-size="${f1(t.size)}">${t.lines.map((ln, i) => `<tspan x="${X(r.cx)}" dy="${i === 0 ? 0 : f1(lh)}">${esc(ln)}</tspan>`).join('')}</text>`);
    if (o.core && o.core === r.name) {
      const s = Math.min(9, r.w * SCALE * 0.28, r.d * SCALE * 0.2), cx = (r.cx - v.x) * SCALE, cy = (r.z + r.d - v.z) * SCALE - s - 4;
      parts.push(`<g class="plan-core"><rect x="${f1(cx - s / 2)}" y="${f1(cy)}" width="${f1(s)}" height="${f1(s)}" rx="${f1(s * 0.22)}"/><circle cx="${f1(cx)}" cy="${f1(cy + s / 2)}" r="${f1(s * 0.14)}"/></g>`);
    }
  }
  return `<svg class="plan-svg" viewBox="0 0 ${f1(v.w * SCALE)} ${f1(v.d * SCALE)}" role="img" aria-label="${esc(`${level.label}: ${rooms}`)}" focusable="false" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}
