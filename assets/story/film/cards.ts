// The film's cards, drawn in Canvas2D: the popup card (and its phone drawing), the title card and the end card.
//
// The popup card shows what the live tour's popup shows (assets/story/popup.ts): who is in the scene and which companion helps (the kicker), the title,
// the app chips, the one-line note, and for a first-run beat the stylised phone screen. It does NOT repeat the narration: in a film the spoken words are the
// caption strip (overlay.ts), the same words in one place. Sizes are in design units (a unit is a pixel of the 1080-short-edge frame) times
// FilmFormat.k, so a 540 test render is the same picture as the 1080 one.
//
// THE TYPE FLOOR (live pass 3). A canvas is a picture shown scaled down (a 1080 px canvas is about 390 px wide on a phone), so every line of reading text in it is at least
// 36 design px (`CANVAS_TYPE_MIN`, assets/story/place.ts): the chips, the note, the kicker, the fine print. The popup title is 56. A card never shrinks its type to fit a frame:
// layout.ts offers it as variants (padding, width, the phone drawing left out) and the solver refuses one under the floor. The live cards are 25.5 px on a desktop (the canon's
// 1.5rem of the 17 px root); a canvas is not reduced by the same 30 % because it is itself reduced on a phone, which is already smaller on screen than the live modal (film.md).
//
// THE NAME IS A KICKER: a person's name on a card (and the family's on the title card) is drawn in capitals, bold, with 0.2em of tracking, in the accent (sage on this dark glass),
// as the live tour's cards draw it. The string in the model stays as written (only the drawn text is uppercased); the tracking is `ctx.letterSpacing` when the rendering
// Chromium has it and, when it has not, the same letters drawn one by one at a fixed advance (`kickWidth` and `drawKick` measure and draw by the same rule either way).
//
// Colours are the canon's dark set (CI-Common styles/tokens, the same values portal/site.css uses in dark): ink #041620 glass, text #e8f2f4,
// muted #a3babf (6:1 on the glass at its worst), sage #c5e8dc. Heat appears nowhere in a film. Type is Manrope (assets/fonts), loaded before the first
// frame. No faces, no photographs, no app screenshots: a member is a monogram disc and the phone is a drawing.
// Owner: video-tool.
import type { FilmFormat } from './layout.js';
import { CANVAS_TYPE_MIN } from '../place.js';

export const INK = '#041620', INK_2 = '#0c323c', FG = '#e8f2f4', MUTED = '#a3babf', SAGE = '#c5e8dc', TEAL = '#409b9b';
export const GLASS = 'rgba(4,22,32,0.88)', EDGE = 'rgba(197,232,220,0.34)';
/** member colour tokens chart-1..5, canon dark values, with the text colour that holds 4.5:1 on each */
export const DISC: Record<string, [string, string]> = { 'chart-1': ['#c5e8dc', '#041620'], 'chart-2': ['#409b9b', '#041620'], 'chart-3': ['#079d99', '#041620'], 'chart-4': ['#70a6af', '#041620'], 'chart-5': ['#066c80', '#f0fdf4'] };
export const FONT = 'Manrope, system-ui, sans-serif';
export const WEIGHTS = [500, 600, 700, 800];
export const font = (w: number, px: number) => `${w} ${px}px ${FONT}`;

export type Ctx = CanvasRenderingContext2D;

// ---- the type table: design units at the 1080 px short edge, every one at or above the floor ---------------------------------------------------------
/** The floor, in design px: nothing a canvas prints to be read is set smaller (mirrors place.ts `CANVAS_TYPE_MIN`). */
export const FLOOR = CANVAS_TYPE_MIN;
export const TYPE = {
  /** a card's kicker (the name), the "with <companion>" line, the chips, the note, the phone drawing's words, the fine print and the corner mark */
  read: 36,
  /** a card's title (the live one is 1.5 times its text; here 56 of 36) */
  title: 56,
  /** the title card's lines: the family's name (a kicker, fitted down from here), the address, the tagline */
  titleHead: [92, 84, 76, 68, 60, 52, 46, 42, 38] as number[], address: 42, tagline: 38,
  /** the end card: the sign-off and the address, and the 36 px pill and fine print */
  signoff: 100, url: 52,
} as const;
/** the monogram disc: 60 design px across, its letter 36 */
export const DISC_D = 60;
/** the chip: the text and 20 design px of padding a side; a chip is 1.6 times the type tall */
export const CHIP_PAD = 20, CHIP_H = 1.6;
/** the kicker's tracking: 0.2em */
export const KICK_EM = 0.2;

// ---- the audit: what was really painted ----------------------------------------------------------------------------------------------------------
export type TypeAudit = {
  /** the smallest type drawn so far, in design units (px of the canvas divided by the frame's k), and the text it was drawn for */
  min: number; text: string;
  /** every distinct size drawn, in design units, with how many strings were drawn at it */
  sizes: Record<string, number>; drawn: number;
};
/**
 * Wrap `fillText` of a canvas so the size of every string it paints is recorded. A render asks the audit after the frames it draws: the floor is then a statement about the pixels
 * (`min` is at or above 36 design px) and not only about the sizes the layout meant to use. Returns the live record (read `min` at any time).
 */
export function auditType(g: Ctx, k: number): TypeAudit {
  const rec: TypeAudit = { min: Infinity, text: '', sizes: {}, drawn: 0 }, orig = g.fillText.bind(g);
  (g as any).fillText = (text: string, x: number, y: number, maxWidth?: number) => {
    const m = /(\d+(?:\.\d+)?)px/.exec(g.font);
    if (m && text.trim()) {
      const d = +m[1] / k; rec.drawn++; const key = String(+d.toFixed(2)); rec.sizes[key] = (rec.sizes[key] || 0) + 1;
      if (d < rec.min) { rec.min = d; rec.text = text; }
    }
    if (maxWidth === undefined) orig(text, x, y); else orig(text, x, y, maxWidth);
  };
  return rec;
}

// ---- the name as a kicker ---------------------------------------------------------------------------------------------------------------------------
let MANUAL = false;
/** Force the glyph-by-glyph tracking (the fallback for a Chromium with no ctx.letterSpacing; the checks use it to compare the two). */
export function setManualTracking(on: boolean) { MANUAL = on; }
/** Does this context track its letters itself (ctx.letterSpacing, Chrome 99 and later), and is that the path in use? */
export const nativeTracking = (g: Ctx): boolean => !MANUAL && 'letterSpacing' in g;
/** The drawn string of a name or a kicker: capitals (the model's own string is never changed: the person is still "Sally" everywhere else). */
export const caps = (s: string): string => s.toLocaleUpperCase('en-US');
/** Width of `text` set as a kicker at `px`: capitals, bold, tracking between the letters and none after the last. */
export function kickWidth(g: Ctx, text: string, px: number, track = KICK_EM): number {
  const t = caps(text), gap = px * track;
  g.save(); g.font = font(700, px);
  let w: number;
  if (nativeTracking(g)) { (g as any).letterSpacing = `${gap}px`; w = g.measureText(t).width - gap; }
  else { const chars = [...t]; w = chars.reduce((a, c) => a + g.measureText(c).width, 0) + gap * Math.max(0, chars.length - 1); }
  g.restore();
  return w;
}
/** Draw a kicker at (x, y) in the current fill and baseline (left aligned). Returns its width. */
export function drawKick(g: Ctx, text: string, x: number, y: number, px: number, track = KICK_EM): number {
  const t = caps(text), gap = px * track;
  g.save(); g.font = font(700, px); g.textAlign = 'left';
  let w: number;
  if (nativeTracking(g)) { (g as any).letterSpacing = `${gap}px`; g.fillText(t, x, y); w = g.measureText(t).width - gap; }
  else { let cx = x; const chars = [...t]; for (const c of chars) { g.fillText(c, cx, y); cx += g.measureText(c).width + gap; } w = cx - x - gap; }
  g.restore();
  return w;
}
/** A kicker that may need more than one line (a chapter's title in place of a name): the words wrapped at `maxW`. */
export function wrapKick(g: Ctx, text: string, px: number, maxW: number): string[] {
  const out: string[] = []; let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w;
    if (line && kickWidth(g, t, px) > maxW) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

// ---- text and shapes -----------------------------------------------------------------------------------------------------------------
export function wrap(g: Ctx, text: string, maxW: number): string[] {
  const out: string[] = []; let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w;
    if (line && g.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
export function rrect(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + q, y); g.arcTo(x + w, y, x + w, y + h, q); g.arcTo(x + w, y + h, x, y + h, q); g.arcTo(x, y + h, x, y, q); g.arcTo(x, y, x + w, y, q); g.closePath();
}
export function glass(g: Ctx, x: number, y: number, w: number, h: number, r: number, k: number, alpha = 1) {
  g.save(); g.globalAlpha *= alpha;
  g.shadowColor = 'rgba(0,0,0,0.38)'; g.shadowBlur = 36 * k; g.shadowOffsetY = 10 * k;
  rrect(g, x, y, w, h, r); g.fillStyle = GLASS; g.fill();
  g.shadowColor = 'transparent'; rrect(g, x, y, w, h, r); g.lineWidth = Math.max(1, 2 * k); g.strokeStyle = EDGE; g.stroke();
  g.restore();
}
/** A chip: the text at `px` (never under the floor) on a pill, `CHIP_PAD` design units of padding a side. Returns its width. */
export function pill(g: Ctx, x: number, y: number, text: string, px: number, k: number, filled: boolean): number {
  g.font = font(600, px);
  const padX = CHIP_PAD * k, h = px * CHIP_H, w = g.measureText(text).width + 2 * padX;
  rrect(g, x, y, w, h, h / 2);
  if (filled) { g.fillStyle = SAGE; g.fill(); } else { g.lineWidth = Math.max(1, 2 * k); g.strokeStyle = 'rgba(197,232,220,0.7)'; g.stroke(); }
  g.fillStyle = filled ? INK : SAGE; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(text, x + padX, y + h / 2 + px * 0.03);
  return w;
}
/** The monogram disc: 60 design units across, the letter 36 (700). */
export function disc(g: Ctx, cx: number, cy: number, r: number, name: string, colour: string) {
  const [bg, fg] = DISC[colour] || DISC['chart-1'];
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = bg; g.fill();
  g.fillStyle = fg; g.font = font(700, r * 1.2); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((name[0] || '?').toUpperCase(), cx, cy + r * 0.05);
  g.textAlign = 'left';
}

// ---- the popup card ------------------------------------------------------------------------------------------------------------------------
export type CardModel = {
  member: { name: string; colour: string } | null;
  /** the companion that helps, by name ("with Odette") */
  companion: string | null;
  /** the kicker when nobody is named: the chapter's title */
  chapter: string;
  title: string; chips: string[]; note: string | null;
  phone: { header: string; rows: string[] } | null;
};
type Box = { x: number; y: number; w: number; h: number };
export type CardLayout = {
  w: number; h: number; k: number; model: CardModel; pad: number; tight: boolean;
  /** a chip or a word is wider than the text column: this width is not a way to set the card */
  bad: boolean;
  /** the smallest type in the card, px of this canvas (the solver refuses a card under 36 design px) */
  type: number;
  kickLines: string[]; kickPx: number; kickLh: number; nameW: number;
  titleLines: string[]; titlePx: number; noteLines: string[]; notePx: number;
  chips: Array<{ text: string; x: number; y: number; filled: boolean }>; chipPx: number;
  textW: number; phone: PhoneLayout | null; yKick: number; yTitle: number; yChips: number; yNote: number; yPhone: number;
};
type PhoneLayout = { x: number; y: number; w: number; h: number; head: string; px: number; rows: Array<{ lines: string[]; y: number; h: number }>; padX: number; padY: number; headH: number };

/**
 * Measure a card for `width` pixels (design units * k). `tight` is the same card with its padding and gaps at 0.68 (the type is not touched); `bare` leaves the phone drawing out and
 * keeps its words as the note. A first-run beat's phone screen is a panel under the note, as the live card has it: a header and up to four rows, in the card's own type.
 */
export function measureCard(g: Ctx, m: CardModel, f: FilmFormat, width: number, tight = false, bare = false): CardLayout {
  const k = f.k, s = tight ? 0.68 : 1, pad = 30 * k * s, gap = (tight ? 9 : 14) * k, px = TYPE.read * k, titlePx = TYPE.title * k, d = DISC_D * k;
  if (bare && m.phone) m = { ...m, phone: null, note: m.note || m.phone.rows.join('. ') + '.' };
  const textW = width - 2 * pad;
  // the kicker: the disc, the name (or the chapter), "with <companion>"
  let kickLines: string[] = [], kickLh = d, nameW = 0, yKick = pad;
  const name = m.member ? m.member.name : m.chapter, lead = m.member ? d + 16 * k : 0;
  if (m.member) { nameW = kickWidth(g, name, px); kickLines = [name]; }
  else { kickLines = wrapKick(g, name, px, textW); kickLh = Math.max(d * 0.62, px * 1.25) ; }
  let y = pad + (m.member ? d : kickLh * kickLines.length) + 16 * k * s;
  const yTitle = y;
  g.font = font(800, titlePx);
  const titleLines = wrap(g, m.title, textW);
  y += titleLines.length * titlePx * 1.14 + gap;
  const chips: CardLayout['chips'] = [], yChips = y, ch = px * CHIP_H;
  if (m.chips.length) {
    g.font = font(600, px);
    let x = 0, row = 0;
    m.chips.forEach((c, i) => {
      const w = g.measureText(c).width + 2 * CHIP_PAD * k;
      if (x > 0 && x + w > textW) { x = 0; row++; }
      chips.push({ text: c, x, y: row * (ch + 10 * k * s), filled: i === 0 });
      x += w + 10 * k * s;
    });
    y += (row + 1) * (ch + 10 * k * s) + 4 * k;
  }
  const yNote = y;
  let noteLines: string[] = [];
  if (m.note) { g.font = font(500, px); noteLines = wrap(g, m.note, textW); y += noteLines.length * px * 1.3 + 4 * k; }
  // the phone's screen: a panel under the note, header then rows (each at most two lines)
  const yPhone = y + (m.phone ? 6 * k : 0);
  let phone: PhoneLayout | null = null;
  if (m.phone) {
    const padX = 20 * k * s, padY = 14 * k * s, innerW = textW - 2 * padX - 24 * k - 14 * k, headH = px * 1.25 + 8 * k;
    g.font = font(500, px);
    let ry = padY + headH + 6 * k;
    const rows = m.phone.rows.slice(0, 4).map(t => {
      const lines = wrap(g, t, innerW).slice(0, 2), h = lines.length * px * 1.2 + 10 * k * s; const r = { lines, y: ry, h }; ry += h; return r;
    });
    phone = { x: 0, y: yPhone, w: textW, h: ry + padY, head: m.phone.header, px, rows, padX, padY, headH };
    y = yPhone + phone.h;
  }
  g.font = font(800, titlePx); const wide = Math.max(...m.title.split(/\s+/).map(t => g.measureText(t).width), 0) > textW + 0.5 || chips.some(c => { g.font = font(600, px); return g.measureText(c.text).width + 2 * CHIP_PAD * k > textW + 0.5; });
  const h = Math.ceil(y + pad - 4 * k);
  return { w: width, h, k, model: m, pad, tight, bad: wide, type: px, kickLines, kickPx: px, kickLh, nameW, titleLines, titlePx, noteLines, notePx: px, chips, chipPx: px, textW, phone, yKick, yTitle, yChips, yNote, yPhone };
}

/** Draw a measured card at (x, y). `alpha` fades it; `progress` (0..1, how far through the narration) ticks the phone's rows off one by one. */
export function drawCard(g: Ctx, L: CardLayout, x: number, y: number, alpha: number, progress: number) {
  if (alpha <= 0.002) return;
  const k = L.k, m = L.model, px = L.kickPx, d = DISC_D * k;
  g.save(); g.globalAlpha *= alpha;
  glass(g, x, y, L.w, L.h, 24 * k, k);
  // kicker: the disc and the name as capitals, bold, tracked, in the sage; "with <companion>" after it; with nobody named, the chapter's title in the same style
  g.textBaseline = 'middle'; g.textAlign = 'left';
  if (m.member) {
    const r = d / 2, cx = x + L.pad + r, cy = y + L.yKick + r;
    disc(g, cx, cy, r, m.member.name, m.member.colour);
    const tx = x + L.pad + d + 16 * k;
    g.fillStyle = SAGE; g.textBaseline = 'middle'; const nw = drawKick(g, m.member.name, tx, cy + 1 * k, px);
    if (m.companion) { g.font = font(500, px); g.fillStyle = MUTED; g.textAlign = 'left'; g.fillText(`with ${m.companion}`, tx + nw + 16 * k, cy + 1 * k); }
  } else {
    g.fillStyle = SAGE;
    L.kickLines.forEach((t, i) => drawKick(g, t, x + L.pad, y + L.yKick + L.kickLh * (i + 0.5) + 1 * k, px));
  }
  // title
  g.textBaseline = 'alphabetic'; g.font = font(800, L.titlePx); g.fillStyle = '#ffffff';
  L.titleLines.forEach((t, i) => g.fillText(t, x + L.pad, y + L.yTitle + L.titlePx * (0.9 + 1.14 * i)));
  // chips
  g.textBaseline = 'middle';
  for (const c of L.chips) pill(g, x + L.pad + c.x, y + L.yChips + c.y, c.text, L.chipPx, k, c.filled);
  // note
  g.textBaseline = 'alphabetic'; g.font = font(500, L.notePx); g.fillStyle = MUTED;
  L.noteLines.forEach((t, i) => g.fillText(t, x + L.pad, y + L.yNote + L.notePx * (0.98 + 1.3 * i)));
  if (L.phone && m.phone) drawPhone(g, { ...L.phone, x: x + L.pad, y: y + L.phone.y }, k, progress);
  g.restore();
}

/** The stylised phone screen: a drawing, never a screenshot. A header and the beat's own rows in the card's type; each row is ticked as the narration reaches its share. */
function drawPhone(g: Ctx, b: PhoneLayout, k: number, progress: number) {
  g.save();
  rrect(g, b.x, b.y, b.w, b.h, 18 * k); g.fillStyle = 'rgba(232,242,244,0.08)'; g.fill(); g.lineWidth = Math.max(1, 2 * k); g.strokeStyle = 'rgba(197,232,220,0.4)'; g.stroke();
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = font(700, b.px); g.fillStyle = SAGE;
  g.fillText(b.head, b.x + b.padX, b.y + b.padY + b.px * 0.98);
  g.beginPath(); g.moveTo(b.x + b.padX, b.y + b.padY + b.headH); g.lineTo(b.x + b.w - b.padX, b.y + b.padY + b.headH); g.lineWidth = Math.max(1, 1.5 * k); g.strokeStyle = 'rgba(197,232,220,0.3)'; g.stroke();
  const n = b.rows.length;
  b.rows.forEach((r, i) => {
    const done = progress >= (i + 1) / (n + 1), cy = b.y + r.y + (r.h - 10 * k) / 2, cx = b.x + b.padX + 12 * k;
    g.beginPath(); g.arc(cx, cy, 11 * k, 0, Math.PI * 2);
    if (done) { g.fillStyle = SAGE; g.fill(); g.strokeStyle = INK; g.lineWidth = 2.6 * k; g.beginPath(); g.moveTo(cx - 5.5 * k, cy); g.lineTo(cx - 1.5 * k, cy + 4.5 * k); g.lineTo(cx + 6 * k, cy - 5 * k); g.stroke(); }
    else { g.lineWidth = 2.2 * k; g.strokeStyle = 'rgba(197,232,220,0.65)'; g.stroke(); }
    g.font = font(500, b.px); g.fillStyle = done ? FG : MUTED; g.textBaseline = 'middle';
    r.lines.forEach((ln, j) => g.fillText(ln, b.x + b.padX + 38 * k, cy + (j - (r.lines.length - 1) / 2) * b.px * 1.2));
  });
  g.restore();
}

// ---- the title card ---------------------------------------------------------------------------------------------------------------------
export type TitleModel = { heading: string; address: string; tagline: string; fictional: string };
/** The title card over the exterior: a scrim that rises from the bottom, and the family's name (a kicker), the address, the tagline and the fictional line stacked on it, inside the
 *  safe area. `ft` is the film second (everything is in by 1.1 s and out for the dip). */
export function drawTitle(g: Ctx, f: FilmFormat, t: TitleModel, ft: number, alpha: number) {
  if (alpha <= 0.002) return;
  const u = f.k, w = f.w - f.safe.left - f.safe.right, left = f.safe.left, bottom = f.h - f.safe.bottom;
  const h2 = TYPE.address * u, h3 = TYPE.tagline * u, h4 = TYPE.read * u;
  g.save(); g.globalAlpha *= alpha;
  const top0 = f.h * (f.portrait ? 0.34 : 0.4);
  const grad = g.createLinearGradient(0, top0, 0, f.h);
  grad.addColorStop(0, 'rgba(4,22,32,0)'); grad.addColorStop(0.55, 'rgba(4,22,32,0.7)'); grad.addColorStop(1, 'rgba(4,22,32,0.93)');
  g.fillStyle = grad; g.fillRect(0, top0, f.w, f.h - top0);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const rise = (a: number, b: number) => { const q = Math.max(0, Math.min(1, (ft - a) / (b - a))); return q * q * (3 - 2 * q); };
  // the family's name, as a kicker, at the largest size that holds it in two lines
  let h1 = TYPE.titleHead[TYPE.titleHead.length - 1] * u, headLines: string[] = [];
  const sizes = (f.portrait ? TYPE.titleHead.filter(s => s <= 78) : TYPE.titleHead).map(s => s * u);
  for (const s of sizes) { const ls = wrapKick(g, t.heading, s, w); if (ls.length <= 2) { h1 = s; headLines = ls; break; } }
  if (!headLines.length) headLines = wrapKick(g, t.heading, h1, w);
  // (`up` is the room between an item and the one above it: the address needs more under the name's capitals than the tagline needs under the address)
  const items: Array<{ text: string[]; px: number; w: number; color: string; a: number; kick: boolean; lh: number; up: number }> = [
    { text: headLines, px: h1, w: 700, color: SAGE, a: rise(0.25, 0.7), kick: true, lh: 1.12, up: 0 },
    { text: wrap((g.font = font(700, h2), g), t.address, w), px: h2, w: 700, color: '#ffffff', a: rise(0.45, 0.9), kick: false, lh: 1.28, up: 26 },
    { text: wrap((g.font = font(500, h3), g), t.tagline, w).slice(0, 3), px: h3, w: 500, color: FG, a: rise(0.65, 1.1), kick: false, lh: 1.28, up: 12 },
  ];
  let y = bottom;
  // the pill, bottom-most; it is in view from the first half second
  g.font = font(700, h4);
  const pillH = h4 * 1.75, pillW = g.measureText(t.fictional).width + 2 * 26 * u;
  g.save(); g.globalAlpha *= rise(0.1, 0.5);
  rrect(g, left, y - pillH, pillW, pillH, pillH / 2); g.fillStyle = SAGE; g.fill();
  g.fillStyle = INK; g.textBaseline = 'middle'; g.fillText(t.fictional, left + 26 * u, y - pillH / 2 + h4 * 0.04);
  g.restore();
  y -= pillH + 30 * u;
  g.textBaseline = 'alphabetic';
  for (const it of items.slice().reverse()) {
    const lh = it.px * it.lh;
    y -= (it.text.length - 1) * lh;
    g.save(); g.globalAlpha *= it.a; g.fillStyle = it.color;
    g.translate(0, (1 - it.a) * 14 * u);
    it.text.forEach((ln, i) => { if (it.kick) drawKick(g, ln, left, y + i * lh, it.px); else { g.font = font(it.w, it.px); g.fillText(ln, left, y + i * lh); } });
    g.restore();
    y -= it.px * 0.95 + it.up * u;
  }
  g.restore();
}

// ---- the end card -------------------------------------------------------------------------------------------------------------------------
export type EndModel = { signoff: string; url: string; fictional: string; lines: string[] };
/** The end card: the sign-off, where to go, the fictional line, and the plain disclosures (scripted scenes, stylised art, synthetic voice, attribution) at 36 design px, inside
 *  the safe area (the bottom margin too: a portrait panel no longer takes a third of the band a phone's interface covers). A panel too tall for the room goes tighter (padding, the
 *  sign-off a size down), never smaller in its fine print. Returns the panel's rectangle (the film's QA reads it). */
export function drawEnd(g: Ctx, f: FilmFormat, m: EndModel, alpha: number): Box {
  const u = f.k, w = f.portrait ? f.w - f.safe.left - f.safe.right : Math.min(f.w - f.safe.left - f.safe.right, 1560 * u), room = f.h - f.safe.top - f.safe.bottom;
  const lay = (tight: boolean) => {
    const pad = (tight ? 28 : 40) * u, so = (f.portrait ? (tight ? 64 : 80) : (tight ? 84 : 100)) * u, urlPx = (f.portrait ? 44 : TYPE.url) * u, fx = TYPE.read * u, small = TYPE.read * u;
    g.font = font(500, small);
    const inner = w - 2 * pad, wrapped = m.lines.map(l => wrap(g, l, inner)), nLines = wrapped.reduce((a, l) => a + l.length, 0), lh = small * (tight ? 1.22 : 1.3);
    const sp = (tight ? 3 : 6) * u, gaps = (tight ? [8, 14, 14] : [14, 22, 24]).map(v => v * u);
    const h = pad + so * 1.0 + gaps[0] + urlPx * 1.3 + gaps[1] + fx * 1.75 + gaps[2] + nLines * lh + (wrapped.length - 1) * sp + pad - 4 * u;
    return { pad, so, urlPx, fx, small, inner, wrapped, lh, sp, gaps, h };
  };
  let L = lay(false); if (L.h > room) L = lay(true);
  g.save(); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const h = L.h, x = Math.round((f.w - w) / 2), y = Math.round(f.h - f.safe.bottom - h);
  g.globalAlpha *= alpha;
  glass(g, x, y, w, h, 30 * u, u);
  let cy = y + L.pad + L.so * 0.82;
  g.font = font(800, L.so); g.fillStyle = SAGE; g.fillText(m.signoff, x + L.pad, cy);
  cy += L.so * 0.18 + L.gaps[0] + L.urlPx * 0.95;
  g.font = font(700, L.urlPx); g.fillStyle = '#ffffff'; g.fillText(m.url, x + L.pad, cy);
  cy += L.urlPx * 0.35 + L.gaps[1];
  g.font = font(700, L.fx); const pw = g.measureText(m.fictional).width + 2 * 24 * u, ph = L.fx * 1.75;
  rrect(g, x + L.pad, cy, pw, ph, ph / 2); g.fillStyle = SAGE; g.fill();
  g.fillStyle = INK; g.textBaseline = 'middle'; g.fillText(m.fictional, x + L.pad + 24 * u, cy + ph / 2 + L.fx * 0.04);
  g.textBaseline = 'alphabetic';
  cy += ph + L.gaps[2] + L.small * 0.95;
  g.font = font(500, L.small); g.fillStyle = MUTED;
  for (const para of L.wrapped) { for (const ln of para) { g.fillText(ln, x + L.pad, cy); cy += L.lh; } cy += L.sp; }
  g.restore();
  return { x, y, w, h };
}
