// assets/xr/ui/paint.ts : everything the in-world UI DRAWS, as plain data and Canvas2D calls. No THREE, no DOM except the CanvasRenderingContext2D
// handed in, no clock: the story's film overlay can call paintCard() on its own canvas, and a Node test can lay a card out with
// approxMeasure() and judge the result (does a 30-word body fit at 1.4 degrees? is every text pair 7:1?).
//
// WHY Canvas2D and not a text library. Measured against troika-three-text, three-mesh-ui and uikit on r169 for this kit's cards: one draw
// call per card against three to eight, 0 KB of JS, and as sharp once the canvas is drawn at 1.5x the headset's pixels per degree with
// mipmaps and anisotropy 8. troika's default font fallback also fetches from jsdelivr, and this site asks no third party for anything.
//
// SIZES come from presenter.ts and nowhere else: XR_LEGIBILITY gives the em of each role in DEGREES of visual angle, XR_COMFORT and
// XR_BUDGET the rest, and emMetres() turns an angle into metres at the panel's distance (raising it to the pixel floor on a coarse
// headset). A canvas pixel is `texelsPerDeg` of a degree: clamp(1.5 x the device's pixels per degree, 24, 40).
import type { BeatView, Disclosure, EndView, PresenterStory } from '../presenter.js';
import { XR_LEGIBILITY, emMetres, metresAt } from '../presenter.js';

export const FONT_FAMILY = '"VH Manrope", "Manrope", system-ui, sans-serif';

// ------------------------------------------------------------------------------------------------------------------------ colour
/** The player's own dark glass (room-creator.html's tokens: --ci-bg-deep, --foreground, --primary, --muted-foreground, --chart-1 to 5). A headset has no page behind it, so there is no light theme. */
export interface Theme {
  name: 'normal' | 'high';
  bg: string; bgAlpha: number; line: string; lineW: number;
  text: string; muted: string; faint: string;
  accent: string; onAccent: string;
  btn: string; btnHover: string; btnPressed: string; onBtn: string;
  focus: string; warn: string; danger: string; scrim: string;
}
export const THEMES: Record<'normal' | 'high', Theme> = {
  normal: {
    name: 'normal', bg: '#021018', bgAlpha: 0.95, line: '#3f6670', lineW: 2, text: '#e8f2f4', muted: '#a3babf', faint: '#7f989e',
    accent: '#c5e8dc', onAccent: '#041620', btn: '#143e48', btnHover: '#1f5663', btnPressed: '#0a2a32', onBtn: '#e8f2f4',
    focus: '#ffffff', warn: '#fbbf24', danger: '#ef7070', scrim: 'rgba(2,16,24,0.55)',
  },
  high: {
    name: 'high', bg: '#000000', bgAlpha: 1, line: '#ffffff', lineW: 4, text: '#ffffff', muted: '#e6f0f2', faint: '#b9c8cc',
    accent: '#ffffff', onAccent: '#000000', btn: '#000000', btnHover: '#2a2a2a', btnPressed: '#4a4a4a', onBtn: '#ffffff',
    focus: '#ffe14d', warn: '#ffe14d', danger: '#ff9a9a', scrim: 'rgba(0,0,0,0.7)',
  },
};
const CHART: Record<string, string> = { 'chart-1': '#c5e8dc', 'chart-2': '#409b9b', 'chart-3': '#079d99', 'chart-4': '#70a6af', 'chart-5': '#066c80' };

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance(hex: string): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const [r, g, b] = rgb(hex); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** WCAG contrast ratio of two #rrggbb colours */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** a member's disc: the family's chart colour and whichever of ink and white reads on it at 7:1 or better (the best of the two) */
export function memberFill(colour: string): { fill: string; ink: string } {
  const fill = CHART[colour] || (/^#[0-9a-f]{6}$/i.test(colour) ? colour : CHART['chart-1']);
  return { fill, ink: contrastRatio(fill, '#041620') >= contrastRatio(fill, '#ffffff') ? '#041620' : '#ffffff' };
}
/** every (text, backing) pair the kit paints, for the contrast test */
export function textPairs(t: Theme): Array<[string, string, string]> {
  return [
    ['text on panel', t.text, t.bg], ['muted on panel', t.muted, t.bg], ['accent on panel', t.accent, t.bg],
    ['label on primary', t.onAccent, t.accent], ['label on button', t.onBtn, t.btn], ['label on hovered button', t.onBtn, t.btnHover], ['label on pressed button', t.onBtn, t.btnPressed],
  ];
}

// ------------------------------------------------------------------------------------------------------------------------ metrics
export type Role = 'min' | 'small' | 'body' | 'caption' | 'title' | 'heading';
const ROLE_DEG: Record<Role, number> = {
  min: XR_LEGIBILITY.minEmDeg, small: (XR_LEGIBILITY.minEmDeg + XR_LEGIBILITY.bodyEmDeg) / 2, body: XR_LEGIBILITY.bodyEmDeg,
  caption: XR_LEGIBILITY.captionEmDeg, title: XR_LEGIBILITY.titleEmDeg, heading: XR_LEGIBILITY.headingEmDeg,
};

export interface Metrics {
  /** canvas pixels per degree of visual angle */
  texelsPerDeg: number;
  /** the panel's distance from the head, metres (what turns an angle into the metres emMetres() wants) */
  distanceM: number;
  textScale: number;
  theme: Theme;
  /** the em of a role, in canvas pixels */
  px(role: Role): number;
  /** the least size of an interactive target, canvas pixels (ray 3.5 degrees, hand ray 4.5, gaze + pinch 5; never under 0.05 m) */
  targetPx: number; gapPx: number; padPx: number; radiusPx: number;
  /** draw buttons and their states; false for a caption-only surface (the film) */
  interactive: boolean;
  hover: string | null; pressed: string | null;
}

export interface MetricsInput {
  texelsPerDeg: number; distanceM: number; textScale?: number; ppd?: number; contrast?: 'normal' | 'high';
  targetDeg?: number; interactive?: boolean; hover?: string | null; pressed?: string | null;
}
export function makeMetrics(o: MetricsInput): Metrics {
  const ts = o.textScale ?? 1, d = o.distanceM, tpd = o.texelsPerDeg, ppd = o.ppd ?? 20;
  const unit = metresAt(1, d);   // metres in one degree at this distance
  const px = (role: Role) => (emMetres(ROLE_DEG[role], d, ts, ppd) / unit) * tpd;
  const targetM = Math.max(0.05, metresAt(o.targetDeg ?? XR_LEGIBILITY.targetDeg.ray, d));
  return {
    texelsPerDeg: tpd, distanceM: d, textScale: ts, theme: THEMES[o.contrast ?? 'normal'], px,
    targetPx: Math.ceil((targetM / unit) * tpd), gapPx: Math.round(XR_LEGIBILITY.targetGapDeg * tpd), padPx: Math.round(0.9 * px('body')), radiusPx: Math.round(0.6 * px('body')),
    interactive: o.interactive !== false, hover: o.hover ?? null, pressed: o.pressed ?? null,
  };
}

export const fontOf = (px: number, weight = 500) => `${weight} ${Math.round(px * 10) / 10}px ${FONT_FAMILY}`;

// ------------------------------------------------------------------------------------------------------------------------ text
export type Measure = (font: string, text: string) => number;
/** Node and tests: Manrope is about 0.56 em per character, narrower for i l . , ' and wider for capitals and digits. An estimate, said so wherever it is used. */
export const approxMeasure: Measure = (font, text) => {
  const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] || '16'), bold = /^(6|7|8)00/.test(font) ? 1.05 : 1;
  let w = 0;
  for (const ch of text) w += /[il.,'|:;!]/.test(ch) ? 0.28 : ch === ' ' ? 0.27 : /[A-Z]/.test(ch) ? 0.68 : /[0-9]/.test(ch) ? 0.6 : /[mwMW]/.test(ch) ? 0.82 : 0.55;
  return w * px * bold;
};
export function ctxMeasure(ctx: CanvasRenderingContext2D): Measure {
  return (font, text) => { if (ctx.font !== font) ctx.font = font; return ctx.measureText(text).width; };
}
/** greedy word wrap; a word wider than the line is cut by characters */
export function wrapText(measure: Measure, font: string, text: string, maxW: number): string[] {
  const out: string[] = []; let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const t = line ? line + ' ' + word : word;
    if (measure(font, t) <= maxW) { line = t; continue; }
    if (line) { out.push(line); line = ''; }
    if (measure(font, word) <= maxW) { line = word; continue; }
    let part = '';
    for (const ch of word) { if (measure(font, part + ch) > maxW && part) { out.push(part); part = ch; } else part += ch; }
    line = part;
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}
function clampLines(measure: Measure, font: string, lines: string[], max: number, maxW: number): { lines: string[]; cut: boolean } {
  if (lines.length <= max) return { lines, cut: false };
  const keep = lines.slice(0, max); let last = keep[max - 1] + '…';
  while (last.length > 2 && measure(font, last) > maxW) last = last.slice(0, -2) + '…';
  keep[max - 1] = last; return { lines: keep, cut: true };
}

// ------------------------------------------------------------------------------------------------------------------------ drawing ops
export type Op =
  | { k: 'rect'; x: number; y: number; w: number; h: number; r: number; fill?: string; alpha?: number; stroke?: string; lw?: number; dash?: number[] }
  | { k: 'text'; x: number; y: number; s: string; font: string; fill: string; align?: 'left' | 'center' | 'right' }
  | { k: 'circle'; x: number; y: number; r: number; fill?: string; stroke?: string; lw?: number }
  | { k: 'line'; x0: number; y0: number; x1: number; y1: number; stroke: string; lw: number; dash?: number[]; cap?: 'round' | 'butt' }
  | { k: 'poly'; pts: number[]; stroke: string; lw: number };

export function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function execOps(g: CanvasRenderingContext2D, ops: readonly Op[]): void {
  g.textBaseline = 'alphabetic';
  for (const o of ops) {
    if (o.k === 'rect') {
      roundRectPath(g, o.x, o.y, o.w, o.h, o.r);
      if (o.fill) { g.globalAlpha = o.alpha ?? 1; g.fillStyle = o.fill; g.fill(); g.globalAlpha = 1; }
      if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw ?? 2; g.setLineDash(o.dash || []); g.stroke(); g.setLineDash([]); }
    } else if (o.k === 'text') {
      g.font = o.font; g.fillStyle = o.fill; g.textAlign = o.align || 'left'; g.fillText(o.s, o.x, o.y); g.textAlign = 'left';
    } else if (o.k === 'circle') {
      g.beginPath(); g.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      if (o.fill) { g.fillStyle = o.fill; g.fill(); }
      if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw ?? 2; g.stroke(); }
    } else if (o.k === 'line') {
      g.strokeStyle = o.stroke; g.lineWidth = o.lw; g.lineCap = o.cap || 'butt'; g.setLineDash(o.dash || []); g.beginPath(); g.moveTo(o.x0, o.y0); g.lineTo(o.x1, o.y1); g.stroke(); g.setLineDash([]); g.lineCap = 'butt';
    } else if (o.k === 'poly') {
      g.strokeStyle = o.stroke; g.lineWidth = o.lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(o.pts[0], o.pts[1]);
      for (let i = 2; i < o.pts.length; i += 2) g.lineTo(o.pts[i], o.pts[i + 1]);
      g.stroke(); g.lineCap = 'butt';
    }
  }
}

// ------------------------------------------------------------------------------------------------------------------------ widgets
export type Icon = 'back' | 'next' | 'close' | 'check' | 'exit' | 'up' | 'down' | 'menu' | 'play';
export interface Widget {
  id: string; kind: 'button' | 'toggle' | 'row' | 'segment';
  x: number; y: number; w: number; h: number;
  label: string; value?: string;
  enabled: boolean; primary?: boolean; on?: boolean; icon?: Icon; iconRight?: boolean;
}
export type WState = 'idle' | 'hover' | 'pressed' | 'disabled';
export const stateOf = (w: Widget, m: Pick<Metrics, 'hover' | 'pressed'>): WState => !w.enabled ? 'disabled' : m.pressed === w.id ? 'pressed' : m.hover === w.id ? 'hover' : 'idle';

function iconOps(icon: Icon, cx: number, cy: number, s: number, stroke: string, lw: number): Op[] {
  const h = s / 2;
  switch (icon) {
    case 'back': return [{ k: 'poly', pts: [cx + h * 0.4, cy - h, cx - h * 0.6, cy, cx + h * 0.4, cy + h], stroke, lw }];
    case 'next': return [{ k: 'poly', pts: [cx - h * 0.4, cy - h, cx + h * 0.6, cy, cx - h * 0.4, cy + h], stroke, lw }];
    case 'up': return [{ k: 'poly', pts: [cx - h, cy + h * 0.4, cx, cy - h * 0.6, cx + h, cy + h * 0.4], stroke, lw }];
    case 'down': return [{ k: 'poly', pts: [cx - h, cy - h * 0.4, cx, cy + h * 0.6, cx + h, cy - h * 0.4], stroke, lw }];
    case 'close': return [{ k: 'poly', pts: [cx - h * 0.8, cy - h * 0.8, cx + h * 0.8, cy + h * 0.8], stroke, lw }, { k: 'poly', pts: [cx + h * 0.8, cy - h * 0.8, cx - h * 0.8, cy + h * 0.8], stroke, lw }];
    case 'check': return [{ k: 'poly', pts: [cx - h, cy + h * 0.05, cx - h * 0.3, cy + h * 0.75, cx + h, cy - h * 0.7], stroke, lw }];
    case 'exit': return [{ k: 'poly', pts: [cx - h * 0.2, cy - h, cx - h, cy - h, cx - h, cy + h, cx - h * 0.2, cy + h], stroke, lw }, { k: 'poly', pts: [cx - h * 0.1, cy, cx + h, cy], stroke, lw }, { k: 'poly', pts: [cx + h * 0.35, cy - h * 0.55, cx + h, cy, cx + h * 0.35, cy + h * 0.55], stroke, lw }];
    case 'menu': return [-0.6, 0, 0.6].map(dy => ({ k: 'poly' as const, pts: [cx - h, cy + h * dy, cx + h, cy + h * dy], stroke, lw }));
    case 'play': return [{ k: 'poly', pts: [cx - h * 0.5, cy - h, cx + h * 0.8, cy, cx - h * 0.5, cy + h, cx - h * 0.5, cy - h], stroke, lw }];
  }
}

/** One widget as drawing ops. A state is never colour alone: hover adds a heavy outline and an underline bar, pressed sinks the label, disabled is dashed. */
export function widgetOps(w: Widget, st: WState, m: Metrics): Op[] {
  const t = m.theme, ops: Op[] = [], r = Math.min(m.radiusPx, w.h / 2);
  const primary = !!w.primary;
  const fill = st === 'pressed' ? (primary ? (t.name === 'high' ? '#cfcfcf' : '#9bd0be') : t.btnPressed) : st === 'hover' ? (primary ? (t.name === 'high' ? '#ffe14d' : '#e8fff6') : t.btnHover) : primary ? t.accent : (w.kind === 'row' ? t.btn : t.btn);
  const ink = st === 'disabled' ? t.faint : primary ? t.onAccent : t.onBtn;
  const dy = st === 'pressed' ? Math.round(m.px('min') * 0.12) : 0;
  const lw = t.lineW;
  ops.push({ k: 'rect', x: w.x, y: w.y + dy, w: w.w, h: w.h, r, fill: st === 'disabled' ? t.bg : fill, stroke: st === 'disabled' ? t.faint : st === 'hover' ? t.focus : primary ? undefined : t.line, lw: st === 'hover' ? lw * 2 : lw, dash: st === 'disabled' ? [lw * 3, lw * 3] : undefined });
  if (st === 'hover') ops.push({ k: 'line', x0: w.x + r, y0: w.y + w.h - lw * 3, x1: w.x + w.w - r, y1: w.y + w.h - lw * 3, stroke: primary ? t.onAccent : t.focus, lw: lw * 1.5, cap: 'round' });
  const em = m.px('body'), cy = w.y + dy + w.h / 2;
  const icon = w.icon ? iconOps(w.icon, 0, 0, em * 0.62, ink, Math.max(3, em * 0.1)) : null;
  if (w.kind === 'toggle' || w.kind === 'segment') {
    // a toggle is a label and a switch whose position AND words say its state; a segment is a button that shows a check when chosen
    if (w.kind === 'toggle') {
      const sw = em * 2.1, sh = em * 1.05, sx = w.x + w.w - m.padPx - sw, sy = cy - sh / 2;
      ops.push({ k: 'text', x: w.x + m.padPx, y: cy + em * 0.34, s: w.label, font: fontOf(em, 600), fill: ink });
      ops.push({ k: 'rect', x: sx, y: sy, w: sw, h: sh, r: sh / 2, fill: w.on ? (primary ? t.onAccent : t.accent) : t.bg, stroke: ink, lw: Math.max(2, lw) });
      ops.push({ k: 'circle', x: w.on ? sx + sw - sh / 2 : sx + sh / 2, y: cy, r: sh * 0.34, fill: w.on ? (primary ? t.accent : t.onAccent) : ink });
      ops.push({ k: 'text', x: sx - em * 0.4, y: cy + em * 0.3, s: w.on ? 'On' : 'Off', font: fontOf(m.px('small'), 700), fill: ink, align: 'right' });
    } else {
      ops.push({ k: 'text', x: w.x + w.w / 2 + (w.on ? em * 0.5 : 0), y: cy + em * 0.34, s: w.label, font: fontOf(em, w.on ? 800 : 600), fill: ink, align: 'center' });
      if (w.on) for (const o of iconOps('check', w.x + w.w / 2 - measureHalf(w.label, em) - em * 0.55, cy, em * 0.55, ink, Math.max(3, em * 0.1))) ops.push(o);
    }
    return ops;
  }
  if (w.kind === 'row') {
    ops.push({ k: 'text', x: w.x + m.padPx, y: cy + em * 0.34, s: w.label, font: fontOf(em, 600), fill: ink });
    if (w.value) ops.push({ k: 'text', x: w.x + w.w - m.padPx - (w.icon ? em * 1.1 : 0), y: cy + em * 0.3, s: w.value, font: fontOf(m.px('small'), 600), fill: st === 'disabled' ? t.faint : t.muted, align: 'right' });
    if (icon) for (const o of iconOps(w.icon!, w.x + w.w - m.padPx - em * 0.35, cy, em * 0.62, ink, Math.max(3, em * 0.1))) ops.push(o);
    return ops;
  }
  // button: label centred, icon beside it
  const label = w.label, gap = em * 0.5, tw = approxHalf(label, em) * 2, iw = icon ? em * 0.62 : 0;
  const total = tw + (icon ? gap + iw : 0), x0 = w.x + w.w / 2 - total / 2;
  const leftIcon = !!icon && !w.iconRight;
  const tx = x0 + (leftIcon ? iw + gap : 0);
  ops.push({ k: 'text', x: tx, y: cy + em * 0.34, s: label, font: fontOf(em, 700), fill: ink });
  if (icon) for (const o of iconOps(w.icon!, leftIcon ? x0 + iw / 2 : x0 + tw + gap + iw / 2, cy, em * 0.62, ink, Math.max(3, em * 0.1))) ops.push(o);
  return ops;
}
// (the label's width for centring: the same estimate in the browser and in Node; a pixel or two of centring error is invisible, and it keeps widgetOps pure)
const approxHalf = (s: string, em: number) => approxMeasure(fontOf(em, 700), s) / 2;
const measureHalf = (s: string, em: number) => approxMeasure(fontOf(em, 600), s) / 2;

/** place widgets in a row: equal widths, the target height, the gap between */
export function rowOfButtons(items: Array<Omit<Widget, 'x' | 'y' | 'w' | 'h'>>, x: number, y: number, w: number, m: Metrics): Widget[] {
  const n = items.length, each = (w - (n - 1) * m.gapPx) / n;
  return items.map((it, i) => ({ ...it, x: x + i * (each + m.gapPx), y, w: each, h: m.targetPx }));
}

// ------------------------------------------------------------------------------------------------------------------------ the card
/** what a card needs, derived from the Director's BeatView: nothing here is the presenter's to edit */
export interface CardView {
  beat: BeatView; disclosure: Disclosure;
  canPrev: boolean; canNext: boolean; nextLabel?: string; nextInS?: number | null;
  /** the chapter's title, for a beat that is about no member */
  kicker?: string;
  /** the subject is farther than a person stands from it (a 'held' beat): say how far */
  far?: string;
  /** the phone's screen as one line of text instead of a drawing (the DOM card's compact variant): for a card that would be taller than the view allows */
  compact?: boolean;
}
export interface Layout {
  w: number; h: number; ops: Op[]; widgets: Widget[];
  /** the strings of the BEAT, in reading order (kicker, button labels and counters are chrome: see `chrome`) */
  texts: string[]; chrome: string[];
  /** a text was cut, or the card is taller than the budget allows */
  overflow: boolean;
  lines: { title: number; body: number };
}
const MAX_BODY_LINES = 12;

export type RectOp = Extract<Op, { k: 'rect' }>;
export function panelBackOp(W: number, m: Metrics): RectOp { return { k: 'rect', x: 1, y: 1, w: W - 2, h: 10, r: m.radiusPx * 1.4, fill: m.theme.bg, alpha: m.theme.bgAlpha, stroke: m.theme.line, lw: m.theme.lineW }; }

export function layoutBeatCard(measure: Measure, cv: CardView, m: Metrics, W: number): Layout {
  const b = cv.beat, t = m.theme, pad = m.padPx, cw = W - 2 * pad;
  const back = panelBackOp(W, m);
  const ops: Op[] = [back], widgets: Widget[] = [], texts: string[] = [], chrome: string[] = [];
  let y = pad, overflow = false;
  const emS = m.px('small'), emB = m.px('body'), emT = m.px('title'), emM = m.px('min');

  // ---- kicker : who the moment is about, with which companion, and where in the tour
  {
    const r = emS * 0.95, cy = y + r;
    let x = pad;
    if (b.member) {
      const f = memberFill(b.member.colour);
      ops.push({ k: 'circle', x: x + r, y: cy, r, fill: f.fill });
      ops.push({ k: 'text', x: x + r, y: cy + emS * 0.36, s: b.member.initial || b.member.name.slice(0, 1).toUpperCase(), font: fontOf(emS * 1.05, 800), fill: f.ink, align: 'center' });
      x += 2 * r + emS * 0.6;
      const name = b.member.name; chrome.push(name);
      ops.push({ k: 'text', x, y: cy + emS * 0.36, s: name, font: fontOf(emS, 700), fill: t.text });
      x += measure(fontOf(emS, 700), name) + emS * 0.6;
      if (b.companion) { const s = `with ${b.companion.name}`; chrome.push(s); ops.push({ k: 'text', x, y: cy + emS * 0.36, s, font: fontOf(emS, 500), fill: t.muted }); }
    } else {
      const s = cv.kicker || b.chapter.title; chrome.push(s);
      ops.push({ k: 'text', x, y: cy + emS * 0.36, s, font: fontOf(emS, 700), fill: t.muted });
    }
    const ctr = `${b.index + 1} / ${b.count}`; chrome.push(ctr);
    ops.push({ k: 'text', x: W - pad, y: cy + emS * 0.36, s: ctr, font: fontOf(emS, 600), fill: t.muted, align: 'right' });
    y += 2 * r + emS * 0.7;
  }

  // ---- title and body
  const tf = fontOf(emT, 700);
  const tl = clampLines(measure, tf, wrapText(measure, tf, b.popup.title, cw), 3, cw);
  overflow ||= tl.cut; texts.push(b.popup.title);
  for (const l of tl.lines) { ops.push({ k: 'text', x: pad, y: y + emT * 0.98, s: l, font: tf, fill: t.text }); y += emT * 1.22; }
  y += emB * 0.35;
  const bf = fontOf(emB, 500);
  const bl = clampLines(measure, bf, wrapText(measure, bf, b.popup.body, cw), MAX_BODY_LINES, cw);
  overflow ||= bl.cut; texts.push(b.popup.body);
  for (const l of bl.lines) { ops.push({ k: 'text', x: pad, y: y + emB * 1.0, s: l, font: bf, fill: t.text }); y += emB * 1.48; }
  y += emB * 0.45;

  // ---- the phone's screen (a stylised drawing, never a screenshot): a header and a few rows
  if (b.popup.kind === 'phone' && b.popup.phone && cv.compact) {
    const ph = b.popup.phone, pf = fontOf(emS, 600), line = `${ph.header}: ${ph.rows.join(' · ')}`;
    texts.push(ph.header, ...ph.rows);
    for (const l of clampLines(measure, pf, wrapText(measure, pf, line, cw), 3, cw).lines) { ops.push({ k: 'text', x: pad, y: y + emS, s: l, font: pf, fill: t.accent }); y += emS * 1.45; }
    y += emS * 0.4;
  } else if (b.popup.kind === 'phone' && b.popup.phone) {
    const ph = b.popup.phone, pw = Math.min(cw, Math.round(emB * 15)), px0 = pad;
    const rowH = Math.round(emS * 2.15), headH = Math.round(emS * 2.3), rows = ph.rows.slice(0, 5);
    const hh = headH + rows.length * (rowH + emM * 0.35) + emM * 0.6;
    ops.push({ k: 'rect', x: px0, y, w: pw, h: hh, r: emB * 0.9, fill: '#0c323c', stroke: t.line, lw: t.lineW });
    ops.push({ k: 'text', x: px0 + emS * 0.9, y: y + headH * 0.68, s: ph.header, font: fontOf(emS, 700), fill: t.text }); texts.push(ph.header);
    let ry = y + headH;
    for (const r of rows) {
      ops.push({ k: 'rect', x: px0 + emS * 0.6, y: ry, w: pw - emS * 1.2, h: rowH, r: rowH / 2, fill: '#143e48' });
      const rf = fontOf(emM * 1.05, 600), fit = clampLines(measure, rf, [r], 1, pw - emS * 3);
      ops.push({ k: 'text', x: px0 + emS * 1.2, y: ry + rowH * 0.66, s: fit.lines[0], font: rf, fill: t.text }); texts.push(r);
      ry += rowH + emM * 0.35;
    }
    y += hh + emB * 0.5;
  }

  // ---- the note, then the apps as chips ("replaces X" is drawn dashed)
  if (b.popup.note) {
    const nf = fontOf(emS, 500), nl = wrapText(measure, nf, b.popup.note, cw); texts.push(b.popup.note);
    for (const l of nl) { ops.push({ k: 'text', x: pad, y: y + emS, s: l, font: nf, fill: t.muted }); y += emS * 1.45; }
    y += emS * 0.4;
  }
  if (b.popup.chips.length) {
    const cf = fontOf(emM, 700), ch = Math.round(emM * 1.95), padX = emM * 0.8;
    let x = pad;
    for (const c of b.popup.chips) {
      const w = measure(cf, c) + 2 * padX;
      if (x + w > W - pad && x > pad) { x = pad; y += ch + emM * 0.4; }
      const repl = /^replaces /i.test(c);
      ops.push({ k: 'rect', x, y, w, h: ch, r: ch / 2, fill: repl ? undefined : '#143e48', stroke: repl ? t.muted : t.line, lw: Math.max(2, t.lineW - 1), dash: repl ? [emM * 0.3, emM * 0.25] : undefined });
      ops.push({ k: 'text', x: x + padX, y: y + ch * 0.66, s: c, font: cf, fill: repl ? t.muted : t.text });
      texts.push(c); x += w + emM * 0.5;
    }
    y += ch + emB * 0.55;
  }

  if (cv.far) {
    const ff = fontOf(emS, 700); chrome.push(cv.far);
    ops.push({ k: 'text', x: pad, y: y + emS, s: cv.far, font: ff, fill: t.accent }); y += emS * 1.7;
  }

  // ---- what the agent says, with its accent bar
  if (b.say) {
    const who = b.companion?.name || b.say.speaker || 'Companion', sf = fontOf(emB, 500);
    const sl = clampLines(measure, sf, wrapText(measure, sf, b.say.text, cw - emB * 0.9), 6, cw - emB * 0.9);
    overflow ||= sl.cut; chrome.push(who); texts.push(b.say.text);
    const top = y;
    ops.push({ k: 'text', x: pad + emB * 0.9, y: y + emS, s: who, font: fontOf(emS, 700), fill: t.accent }); y += emS * 1.5;
    for (const l of sl.lines) { ops.push({ k: 'text', x: pad + emB * 0.9, y: y + emB * 0.95, s: l, font: sf, fill: t.text }); y += emB * 1.45; }
    ops.push({ k: 'line', x0: pad + emB * 0.25, y0: top, x1: pad + emB * 0.25, y1: y - emB * 0.3, stroke: t.accent, lw: Math.max(4, emB * 0.14), cap: 'round' });
    y += emB * 0.5;
  }

  // ---- the disclosure, always
  {
    const ff = fontOf(emM, 600), fl = clampLines(measure, ff, wrapText(measure, ff, cv.disclosure.fictional, cw), 2, cw);
    texts.push(cv.disclosure.fictional);
    for (const l of fl.lines) { ops.push({ k: 'text', x: pad, y: y + emM, s: l, font: ff, fill: t.muted }); y += emM * 1.4; }
    y += emM * 0.5;
  }

  // ---- back and next
  if (m.interactive) {
    const nextLabel = cv.nextInS != null && cv.nextInS > 0 ? `Next in ${Math.ceil(cv.nextInS)}` : cv.nextLabel || 'Next';
    chrome.push('Back', nextLabel);
    widgets.push(...rowOfButtons([
      { id: 'prev', kind: 'button', label: 'Back', enabled: cv.canPrev, icon: 'back' },
      { id: 'next', kind: 'button', label: nextLabel, enabled: cv.canNext, primary: true, icon: 'next', iconRight: true },
    ], pad, y, cw, m));
    y += m.targetPx;
  }
  y += pad;
  back.h = Math.round(y) - 2;
  return { w: W, h: Math.round(y), ops, widgets, texts, chrome, overflow, lines: { title: tl.lines.length, body: bl.lines.length } };
}

/** The tallest a card may be, in degrees: the view's comfortable height is 70, and the caption bar needs the bottom of it */
export const MAX_CARD_DEG = 56;
/** Lay the card out; if it is taller than `maxDeg` (the room between the top of the caption bar and the top of the view: about 37 to 43 degrees), lay it out again with the phone's screen as one line of text. */
export function layoutBeatCardFit(measure: Measure, cv: CardView, m: Metrics, W: number, maxDeg = MAX_CARD_DEG): Layout {
  const L = layoutBeatCard(measure, cv, m, W);
  if (L.h / m.texelsPerDeg <= maxDeg || cv.compact || cv.beat.popup.kind !== 'phone') return L;
  const C = layoutBeatCard(measure, { ...cv, compact: true }, m, W);
  return C.h < L.h ? C : L;
}

/** width / height of the card at a width in degrees (memoised): what the placement solver asks when it tries wider cards */
export function cardAspectAt(measure: Measure, cv: CardView, m: Metrics, maxDeg = MAX_CARD_DEG): (widthDeg: number) => number {
  const memo = new Map<number, number>();
  return (widthDeg) => {
    let a = memo.get(widthDeg);
    if (a === undefined) { const L = layoutBeatCardFit(measure, cv, m, Math.round(widthDeg * m.texelsPerDeg), maxDeg); a = L.w / L.h; memo.set(widthDeg, a); }
    return a;
  };
}

/** The card, drawn. THREE-free: the browser's canvas here, the film's canvas in the story overlay. The canvas must be W x layout.h; call measureCard first to size it. */
export function paintCard(ctx: CanvasRenderingContext2D, cv: CardView, m: Metrics, W = ctx.canvas.width): Layout {
  const L = layoutBeatCard(ctxMeasure(ctx), cv, m, W);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  execOps(ctx, L.ops);
  if (m.interactive) for (const w of L.widgets) execOps(ctx, widgetOps(w, stateOf(w, m), m));
  return L;
}
export function measureCard(ctx: CanvasRenderingContext2D, cv: CardView, m: Metrics, W: number): Layout { return layoutBeatCard(ctxMeasure(ctx), cv, m, W); }

// ------------------------------------------------------------------------------------------------------------------------ start and end cards
export interface TitleView { story: PresenterStory; line?: string }
export function layoutStartCard(measure: Measure, v: TitleView, m: Metrics, W: number): Layout {
  const s = v.story, t = m.theme, pad = m.padPx, cw = W - 2 * pad, back = panelBackOp(W, m);
  const ops: Op[] = [back], texts: string[] = [], chrome: string[] = [];
  const emH = m.px('heading'), emB = m.px('body'), emS = m.px('small'), emM = m.px('min');
  let y = pad, overflow = false;
  const hf = fontOf(emH, 800), head = `The ${s.surname} family home`;
  const hl = clampLines(measure, hf, wrapText(measure, hf, head, cw), 3, cw); texts.push(head); overflow ||= hl.cut;
  for (const l of hl.lines) { ops.push({ k: 'text', x: pad, y: y + emH * 0.98, s: l, font: hf, fill: t.text }); y += emH * 1.18; }
  y += emB * 0.3;
  const bf = fontOf(emB, 500), tl = clampLines(measure, bf, wrapText(measure, bf, s.tagline, cw), 6, cw); texts.push(s.tagline); overflow ||= tl.cut;
  for (const l of tl.lines) { ops.push({ k: 'text', x: pad, y: y + emB, s: l, font: bf, fill: t.text }); y += emB * 1.48; }
  if (s.address) { const af = fontOf(emS, 500); texts.push(s.address); y += emS * 0.2; for (const l of clampLines(measure, af, wrapText(measure, af, s.address, cw), 2, cw).lines) { ops.push({ k: 'text', x: pad, y: y + emS, s: l, font: af, fill: t.muted }); y += emS * 1.45; } }
  y += emB * 0.5;
  // the members, a disc and a name each
  let x = pad; const r = emS * 0.95;
  for (const mem of s.members) {
    const f = memberFill(mem.colour), nf = fontOf(emS, 700), w = 2 * r + emS * 0.5 + measure(nf, mem.name) + emS * 0.9;
    if (x + w > W - pad && x > pad) { x = pad; y += 2 * r + emS * 0.5; }
    ops.push({ k: 'circle', x: x + r, y: y + r, r, fill: f.fill });
    ops.push({ k: 'text', x: x + r, y: y + r + emS * 0.36, s: mem.initial || mem.name.slice(0, 1), font: fontOf(emS * 1.05, 800), fill: f.ink, align: 'center' });
    ops.push({ k: 'text', x: x + 2 * r + emS * 0.5, y: y + r + emS * 0.36, s: mem.name, font: nf, fill: t.text });
    chrome.push(mem.name); x += w;
  }
  y += 2 * r + emB * 0.7;
  const meta = `${s.beatCount} stops`; chrome.push(meta);
  ops.push({ k: 'text', x: pad, y: y + emS, s: meta, font: fontOf(emS, 600), fill: t.muted }); y += emS * 1.6;
  const ff = fontOf(emM, 600); texts.push(v.line || 'Fictional');
  for (const l of wrapText(measure, ff, v.line || 'Fictional', cw)) { ops.push({ k: 'text', x: pad, y: y + emM, s: l, font: ff, fill: t.muted }); y += emM * 1.4; }
  y += pad; back.h = Math.round(y) - 2;
  return { w: W, h: Math.round(y), ops, widgets: [], texts, chrome, overflow, lines: { title: hl.lines.length, body: tl.lines.length } };
}

export function layoutEndCard(measure: Measure, v: EndView, m: Metrics, W: number, o: { canReplay: boolean; hasCta: boolean }): Layout {
  const t = m.theme, pad = m.padPx, cw = W - 2 * pad, back = panelBackOp(W, m);
  const ops: Op[] = [back], widgets: Widget[] = [], texts: string[] = [], chrome: string[] = [];
  const emH = m.px('heading'), emB = m.px('body'), emM = m.px('min');
  let y = pad, overflow = false;
  const bf = fontOf(emB * 1.08, 600), bl = clampLines(measure, bf, wrapText(measure, bf, v.closing.body, cw), 8, cw); texts.push(v.closing.body); overflow ||= bl.cut;
  for (const l of bl.lines) { ops.push({ k: 'text', x: pad, y: y + emB * 1.05, s: l, font: bf, fill: t.text }); y += emB * 1.55; }
  y += emB * 0.4;
  const sf = fontOf(emH * 0.9, 800); texts.push(v.disclosure.signoff);
  for (const l of wrapText(measure, sf, v.disclosure.signoff, cw)) { ops.push({ k: 'text', x: pad, y: y + emH * 0.9, s: l, font: sf, fill: t.accent }); y += emH * 1.1; }
  y += emB * 0.5;
  // the claims, one line each, word for word from claims.json
  const cf = fontOf(emM, 500);
  for (const s of [v.disclosure.fictional, v.disclosure.scripted, v.disclosure.synthetic, v.disclosure.stylised, v.disclosure.beta]) {
    if (!s) continue; texts.push(s);
    for (const l of wrapText(measure, cf, s, cw)) { ops.push({ k: 'text', x: pad, y: y + emM, s: l, font: cf, fill: t.muted }); y += emM * 1.4; }
    y += emM * 0.3;
  }
  y += emB * 0.4;
  if (m.interactive) {
    const items: Array<Omit<Widget, 'x' | 'y' | 'w' | 'h'>> = [];
    if (o.hasCta) items.push({ id: 'cta', kind: 'button', label: v.closing.ctaLabel || 'Learn more', enabled: true, primary: true, icon: 'next', iconRight: true });
    const row2: Array<Omit<Widget, 'x' | 'y' | 'w' | 'h'>> = [];
    if (o.canReplay) row2.push({ id: 'replay', kind: 'button', label: 'Replay', enabled: true, icon: 'play' });
    if (v.hasNextFamily) row2.push({ id: 'next-family', kind: 'button', label: 'Next family', enabled: true, icon: 'next', iconRight: true });
    row2.push({ id: 'exit', kind: 'button', label: 'Exit VR', enabled: true, icon: 'exit' });
    for (const it of items) chrome.push(it.label); for (const it of row2) chrome.push(it.label);
    if (items.length) { widgets.push(...rowOfButtons(items, pad, y, cw, m)); y += m.targetPx + m.gapPx; }
    widgets.push(...rowOfButtons(row2, pad, y, cw, m)); y += m.targetPx;
  }
  y += pad; back.h = Math.round(y) - 2;
  return { w: W, h: Math.round(y), ops, widgets, texts, chrome, overflow, lines: { title: 0, body: bl.lines.length } };
}

// ------------------------------------------------------------------------------------------------------------------------ the caption bar
export interface CaptionView {
  words: string[]; wordIndex: number; speaker: string | null; fictional: string;
  /** 0..1 progress of the beat, drawn as a bar; null: none */
  progress: number | null;
}
export interface CaptionLayout extends Layout { firstLine: number; lineCount: number; wordLine: number[] }
export function layoutCaption(measure: Measure, v: CaptionView, m: Metrics, W: number): CaptionLayout {
  const t = m.theme, pad = Math.round(m.padPx * 0.8), cw = W - 2 * pad, back = panelBackOp(W, m);
  const ops: Op[] = [back], texts: string[] = [], chrome: string[] = [];
  const emC = m.px('caption'), emM = m.px('min'), cf = fontOf(emC, 600), cfB = fontOf(emC, 800);
  // break the words into lines once; the window shows the line being read and the one before it
  const lines: number[][] = []; let cur: number[] = [], curW = 0; const space = measure(cf, ' ');
  v.words.forEach((w, i) => {
    const ww = measure(cf, w);
    if (cur.length && curW + space + ww > cw) { lines.push(cur); cur = []; curW = 0; }
    curW += (cur.length ? space : 0) + ww; cur.push(i);
  });
  if (cur.length) lines.push(cur);
  const wordLine = new Array(v.words.length).fill(0); lines.forEach((l, li) => l.forEach(i => { wordLine[i] = li; }));
  const curLine = v.wordIndex >= 0 && v.wordIndex < v.words.length ? wordLine[v.wordIndex] : 0;
  const max = XR_LEGIBILITY.caption.maxLines;
  const first = lines.length > max ? Math.max(0, Math.min(curLine - 1, lines.length - max)) : 0;
  const shown = lines.slice(first, first + max);
  let y = pad;
  if (shown.length) y += emC * 0.15;
  shown.forEach((l, k) => {
    let x = pad; const base = y + emC * 1.0;
    for (const i of l) {
      const w = v.words[i], ww = measure(cf, w), spoken = i < v.wordIndex, now = i === v.wordIndex;
      ops.push({ k: 'text', x, y: base, s: w, font: now ? cfB : cf, fill: now ? t.accent : spoken ? t.text : t.muted });
      if (now) ops.push({ k: 'line', x0: x, y0: base + emC * 0.18, x1: x + ww, y1: base + emC * 0.18, stroke: t.accent, lw: Math.max(3, emC * 0.07), cap: 'round' });
      x += ww + space;
    }
    y += emC * 1.38; void k;
  });
  if (v.words.length) texts.push(v.words.slice(0, Math.max(0, v.wordIndex + 1)).join(' '));
  if (shown.length) y += emM * 0.3;
  // the footer row, always: the disclosure chip, who is speaking, the beat's progress
  const chipH = Math.round(emM * 1.9), chipF = fontOf(emM, 700), chipW = measure(chipF, v.fictional) + emM * 1.6;
  ops.push({ k: 'rect', x: pad, y, w: chipW, h: chipH, r: chipH / 2, fill: '#143e48', stroke: t.line, lw: Math.max(2, t.lineW - 1) });
  ops.push({ k: 'text', x: pad + emM * 0.8, y: y + chipH * 0.66, s: v.fictional, font: chipF, fill: t.text }); chrome.push(v.fictional);
  let x = pad + chipW + emM * 0.7;
  if (v.speaker) { chrome.push(v.speaker); ops.push({ k: 'text', x, y: y + chipH * 0.66, s: v.speaker, font: fontOf(emM, 700), fill: t.muted }); x += measure(fontOf(emM, 700), v.speaker) + emM * 0.9; }
  if (v.progress != null) {
    const bw = pad + cw - x, bh = Math.max(6, Math.round(emM * 0.28)), by = y + chipH / 2 - bh / 2;
    if (bw > emM * 4) {
      ops.push({ k: 'rect', x, y: by, w: bw, h: bh, r: bh / 2, fill: t.btn, stroke: t.line, lw: 1 });
      ops.push({ k: 'rect', x, y: by, w: Math.max(bh, bw * Math.max(0, Math.min(1, v.progress))), h: bh, r: bh / 2, fill: t.accent });
    }
  }
  y += chipH + pad * 0.85; back.h = Math.round(y) - 2;
  return { w: W, h: Math.round(y), ops, widgets: [], texts, chrome, overflow: false, lines: { title: 0, body: shown.length }, firstLine: first, lineCount: lines.length, wordLine };
}

// ------------------------------------------------------------------------------------------------------------------------ toast and status
export interface ToastView { text: string; kind: 'info' | 'warn' }
export function layoutToast(measure: Measure, v: ToastView, m: Metrics, W: number): Layout {
  const t = m.theme, pad = Math.round(m.padPx * 0.85), cw = W - 2 * pad - m.px('body') * 1.4, back = panelBackOp(W, m);
  const emB = m.px('body'), f = fontOf(emB, 600);
  const ops: Op[] = [back], lines = clampLines(measure, f, wrapText(measure, f, v.text, cw), 3, cw);
  let y = pad;
  const ix = pad + emB * 0.5, ic = v.kind === 'warn' ? t.warn : t.accent;
  ops.push({ k: 'circle', x: ix, y: y + emB * 0.55, r: emB * 0.5, stroke: ic, lw: Math.max(3, emB * 0.1) });
  ops.push({ k: 'text', x: ix, y: y + emB * 0.55 + emB * 0.3, s: v.kind === 'warn' ? '!' : 'i', font: fontOf(emB * 0.85, 800), fill: ic, align: 'center' });
  for (const l of lines.lines) { ops.push({ k: 'text', x: pad + emB * 1.4, y: y + emB, s: l, font: f, fill: t.text }); y += emB * 1.4; }
  y += pad; back.h = Math.round(y) - 2;
  return { w: W, h: Math.round(y), ops, widgets: [], texts: [v.text], chrome: [], overflow: lines.cut, lines: { title: 0, body: lines.lines.length } };
}
export interface StatusView { title: string; body?: string; progress?: number }
export function layoutStatus(measure: Measure, v: StatusView, m: Metrics, W: number): Layout {
  const t = m.theme, pad = m.padPx, cw = W - 2 * pad, back = panelBackOp(W, m);
  const emT = m.px('title'), emB = m.px('body');
  const ops: Op[] = [back], texts = [v.title];
  let y = pad;
  const tf = fontOf(emT, 800);
  for (const l of clampLines(measure, tf, wrapText(measure, tf, v.title, cw), 3, cw).lines) { ops.push({ k: 'text', x: pad, y: y + emT, s: l, font: tf, fill: t.text }); y += emT * 1.22; }
  if (v.body) {
    texts.push(v.body); const bf = fontOf(emB, 500); y += emB * 0.3;
    for (const l of clampLines(measure, bf, wrapText(measure, bf, v.body, cw), 5, cw).lines) { ops.push({ k: 'text', x: pad, y: y + emB, s: l, font: bf, fill: t.muted }); y += emB * 1.48; }
  }
  if (v.progress != null) {
    y += emB * 0.5; const bh = Math.max(10, Math.round(emB * 0.35));
    ops.push({ k: 'rect', x: pad, y, w: cw, h: bh, r: bh / 2, fill: t.btn, stroke: t.line, lw: 1 });
    ops.push({ k: 'rect', x: pad, y, w: Math.max(bh, cw * Math.max(0, Math.min(1, v.progress))), h: bh, r: bh / 2, fill: t.accent });
    y += bh;
  }
  y += pad; back.h = Math.round(y) - 2;
  return { w: W, h: Math.round(y), ops, widgets: [], texts, chrome: [], overflow: false, lines: { title: 1, body: 1 } };
}
