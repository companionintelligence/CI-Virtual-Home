// The film's cards, drawn in Canvas2D: the popup card (and its phone variant), the title card and the end card.
//
// The popup card shows what the live tour's popup shows (assets/story/popup.ts): who is in the scene and which companion helps (the kicker), the title,
// the app chips, the one-line note, and for a phone beat the stylised phone. It does NOT repeat the narration: in a film the spoken words are the
// caption strip (overlay.ts), the same words in one place. Sizes are in design units (a unit is a pixel of the 1080-short-edge frame) times
// FilmFormat.k, so a 540 test render is the same picture as the 1080 one.
//
// Colours are the canon's dark set (CI-Common styles/tokens, the same values portal/site.css uses in dark): ink #041620 glass, text #e8f2f4,
// muted #a3babf (6:1 on the glass at its worst), sage #c5e8dc. Heat appears nowhere in a film. Type is Manrope (assets/fonts), loaded before the first
// frame. No faces, no photographs, no app screenshots: a member is a monogram disc and the phone is a drawing.
// Owner: video-tool.
import type { FilmFormat } from './layout.js';

export const INK = '#041620', INK_2 = '#0c323c', FG = '#e8f2f4', MUTED = '#a3babf', SAGE = '#c5e8dc', TEAL = '#409b9b';
export const GLASS = 'rgba(4,22,32,0.88)', EDGE = 'rgba(197,232,220,0.34)';
/** member colour tokens chart-1..5, canon dark values, with the text colour that holds 4.5:1 on each */
export const DISC: Record<string, [string, string]> = { 'chart-1': ['#c5e8dc', '#041620'], 'chart-2': ['#409b9b', '#041620'], 'chart-3': ['#079d99', '#041620'], 'chart-4': ['#70a6af', '#041620'], 'chart-5': ['#066c80', '#f0fdf4'] };
export const FONT = 'Manrope, system-ui, sans-serif';
export const WEIGHTS = [500, 600, 700, 800];
export const font = (w: number, px: number) => `${w} ${px}px ${FONT}`;

export type Ctx = CanvasRenderingContext2D;

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
export function pill(g: Ctx, x: number, y: number, text: string, px: number, k: number, filled: boolean): number {
  g.font = font(600, px);
  const padX = 16 * k, h = px * 1.7, w = g.measureText(text).width + 2 * padX;
  rrect(g, x, y, w, h, h / 2);
  if (filled) { g.fillStyle = SAGE; g.fill(); } else { g.lineWidth = Math.max(1, 2 * k); g.strokeStyle = 'rgba(197,232,220,0.7)'; g.stroke(); }
  g.fillStyle = filled ? INK : SAGE; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(text, x + padX, y + h / 2 + px * 0.03);
  return w;
}
export function disc(g: Ctx, cx: number, cy: number, r: number, name: string, colour: string) {
  const [bg, fg] = DISC[colour] || DISC['chart-1'];
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = bg; g.fill();
  g.fillStyle = fg; g.font = font(800, r * 1.05); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((name[0] || '?').toUpperCase(), cx, cy + r * 0.05);
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
  w: number; h: number; k: number; s: number; model: CardModel; pad: number;
  titleLines: string[]; titlePx: number; noteLines: string[]; notePx: number;
  chips: Array<{ text: string; x: number; y: number; filled: boolean }>; chipPx: number;
  textW: number; phone: Box | null; yTitle: number; yChips: number; yNote: number; kick: number;
};

/** Measure a card for `width` pixels (design units * k). A phone beat is two columns: the words on the left, the drawing on the right. */
export const CARD_LEVELS = 3;
/** `level` 0 is the card as designed; 1 and 2 are the same card smaller (type and padding scale by 0.86 and 0.74; level 2 drops the phone drawing and
 *  keeps its words), for a frame where the full card would cover the subject. The placer tries them in order. */
export function measureCard(g: Ctx, m: CardModel, f: FilmFormat, width: number, level = 0): CardLayout {
  const s = [1, 0.86, 0.74][level] ?? 0.74, k = f.k, pad = 30 * k * s, titlePx = 40 * k * s, chipPx = 23 * k * s, notePx = 24 * k * s, kick = 46 * k * s;
  if (level >= 2 && m.phone) m = { ...m, phone: null, note: m.note || m.phone.rows.join('. ') + '.' };
  const phoneW = m.phone ? 250 * k * s : 0, gutter = m.phone ? 26 * k * s : 0;
  const textW = width - 2 * pad - phoneW - gutter;
  g.font = font(800, titlePx);
  const titleLines = wrap(g, m.title, textW);
  let y = pad + kick + 16 * k;
  const yTitle = y; y += titleLines.length * titlePx * 1.16 + 14 * k;
  const chips: CardLayout['chips'] = []; const yChips = y;
  if (m.chips.length) {
    g.font = font(600, chipPx);
    let x = 0, row = 0; const hh = chipPx * 1.7;
    m.chips.forEach((c, i) => {
      const w = g.measureText(c).width + 32 * k;
      if (x > 0 && x + w > textW) { x = 0; row++; }
      chips.push({ text: c, x, y: row * (hh + 10 * k), filled: i === 0 });
      x += w + 10 * k;
    });
    y += (row + 1) * (chipPx * 1.7 + 10 * k) + 6 * k;
  }
  const yNote = y;
  let noteLines: string[] = [];
  if (m.note) { g.font = font(500, notePx); noteLines = wrap(g, m.note, textW); y += noteLines.length * notePx * 1.32 + 6 * k; }
  let h = y + pad - 6 * k;
  let phone: Box | null = null;
  if (m.phone) {
    const ph = Math.max(380 * k * s, h - 2 * pad + 4 * k);
    phone = { x: width - pad - phoneW, y: pad, w: phoneW, h: Math.min(ph, 460 * k * s) };
    h = Math.max(h, phone.y + phone.h + pad);
  }
  return { w: width, h: Math.ceil(h), k, s, model: m, pad, titleLines, titlePx, noteLines, notePx, chips, chipPx, textW, phone, yTitle, yChips, yNote, kick };
}

/** Draw a measured card at (x, y). `alpha` fades it; `progress` (0..1, how far through the narration) ticks the phone's rows off one by one. */
export function drawCard(g: Ctx, L: CardLayout, x: number, y: number, alpha: number, progress: number) {
  if (alpha <= 0.002) return;
  const k = L.k, m = L.model;
  g.save(); g.globalAlpha *= alpha;
  glass(g, x, y, L.w, L.h, 24 * k, k);
  // kicker
  const r = L.kick / 2, cx = x + L.pad + r, cy = y + L.pad + r;
  g.textBaseline = 'middle'; g.textAlign = 'left';
  if (m.member) {
    disc(g, cx, cy, r, m.member.name, m.member.colour);
    g.font = font(700, 28 * k * L.s); g.fillStyle = FG;
    const nameW = g.measureText(m.member.name).width;
    g.fillText(m.member.name, x + L.pad + L.kick + 14 * k, cy + 1 * k);
    if (m.companion) { g.font = font(500, 26 * k * L.s); g.fillStyle = MUTED; g.fillText(`with ${m.companion}`, x + L.pad + L.kick + 14 * k + nameW + 12 * k, cy + 1 * k); }
  } else {
    g.font = font(700, 27 * k * L.s); g.fillStyle = SAGE; g.fillText(m.chapter, x + L.pad, cy + 1 * k);
  }
  // title
  g.textBaseline = 'alphabetic'; g.font = font(800, L.titlePx); g.fillStyle = '#ffffff';
  L.titleLines.forEach((t, i) => g.fillText(t, x + L.pad, y + L.yTitle + L.titlePx * (0.92 + 1.16 * i)));
  // chips
  g.textBaseline = 'middle';
  for (const c of L.chips) pill(g, x + L.pad + c.x, y + L.yChips + c.y, c.text, L.chipPx, k, c.filled);
  // note
  g.textBaseline = 'alphabetic'; g.font = font(500, L.notePx); g.fillStyle = MUTED;
  L.noteLines.forEach((t, i) => g.fillText(t, x + L.pad, y + L.yNote + L.notePx * (1 + 1.32 * i)));
  if (L.phone && m.phone) drawPhone(g, { x: x + L.phone.x, y: y + L.phone.y, w: L.phone.w, h: L.phone.h }, m.phone, k * L.s, progress);
  g.restore();
}

/** The stylised phone: a drawing, never a screenshot. Rows are the beat's own words; each is ticked as the narration reaches its share. */
function drawPhone(g: Ctx, b: Box, p: { header: string; rows: string[] }, k: number, progress: number) {
  g.save();
  rrect(g, b.x, b.y, b.w, b.h, 34 * k); g.fillStyle = '#021017'; g.fill(); g.lineWidth = 3 * k; g.strokeStyle = 'rgba(197,232,220,0.55)'; g.stroke();
  const sx = b.x + 12 * k, sy = b.y + 14 * k, sw = b.w - 24 * k, sh = b.h - 28 * k;
  rrect(g, sx, sy, sw, sh, 24 * k); g.fillStyle = INK_2; g.fill();
  // the notch
  rrect(g, b.x + b.w / 2 - 28 * k, sy + 8 * k, 56 * k, 9 * k, 5 * k); g.fillStyle = '#021017'; g.fill();
  g.fillStyle = '#ffffff'; g.font = font(800, 24 * k); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(p.header, b.x + b.w / 2, sy + 56 * k);
  g.textAlign = 'left';
  const rows = p.rows.slice(0, 4), rowH = Math.min(78 * k, (sh - 90 * k) / Math.max(1, rows.length));
  rows.forEach((t, i) => {
    const ry = sy + 78 * k + i * rowH, done = progress >= (i + 1) / (rows.length + 1);
    rrect(g, sx + 12 * k, ry, sw - 24 * k, rowH - 8 * k, 14 * k); g.fillStyle = done ? 'rgba(197,232,220,0.2)' : 'rgba(255,255,255,0.07)'; g.fill();
    g.beginPath(); g.arc(sx + 34 * k, ry + (rowH - 8 * k) / 2, 10 * k, 0, Math.PI * 2);
    if (done) { g.fillStyle = SAGE; g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5 * k; g.beginPath(); g.moveTo(sx + 29 * k, ry + (rowH - 8 * k) / 2); g.lineTo(sx + 33 * k, ry + (rowH - 8 * k) / 2 + 4 * k); g.lineTo(sx + 40 * k, ry + (rowH - 8 * k) / 2 - 5 * k); g.stroke(); }
    else { g.lineWidth = 2 * k; g.strokeStyle = 'rgba(197,232,220,0.6)'; g.stroke(); }
    g.font = font(600, 19 * k); g.fillStyle = FG; g.textBaseline = 'middle';
    const lines = wrap(g, t, sw - 24 * k - 56 * k).slice(0, 2);
    lines.forEach((ln, j) => g.fillText(ln, sx + 54 * k, ry + (rowH - 8 * k) / 2 + (j - (lines.length - 1) / 2) * 23 * k));
  });
  g.restore();
}

// ---- the title card ---------------------------------------------------------------------------------------------------------------------
export type TitleModel = { heading: string; address: string; tagline: string; fictional: string };
/** The title card over the exterior: a scrim that rises from the bottom, and the name, the address, the tagline and the fictional line stacked on it.
 *  `k` is progress through the card (0..1); everything is in by 0.35 s and out for the dip. */
export function drawTitle(g: Ctx, f: FilmFormat, t: TitleModel, ft: number, alpha: number) {
  if (alpha <= 0.002) return;
  const u = f.k, w = f.w - f.safe.left - f.safe.right, left = f.safe.left, bottom = f.h - (f.portrait ? f.safe.bottom * 0.62 : f.safe.bottom);
  const h1 = (f.portrait ? 78 : 92) * u, h2 = (f.portrait ? 40 : 42) * u, h3 = (f.portrait ? 32 : 34) * u, h4 = (f.portrait ? 30 : 32) * u;
  g.save(); g.globalAlpha *= alpha;
  const grad = g.createLinearGradient(0, f.h * (f.portrait ? 0.34 : 0.4), 0, f.h);
  grad.addColorStop(0, 'rgba(4,22,32,0)'); grad.addColorStop(0.55, 'rgba(4,22,32,0.7)'); grad.addColorStop(1, 'rgba(4,22,32,0.93)');
  g.fillStyle = grad; g.fillRect(0, f.h * (f.portrait ? 0.34 : 0.4), f.w, f.h * (f.portrait ? 0.66 : 0.6));
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  // the fictional line first: it is in view from the first half second
  const rise = (a: number, b: number) => { const q = Math.max(0, Math.min(1, (ft - a) / (b - a))); return q * q * (3 - 2 * q); };
  const items: Array<{ text: string; px: number; w: number; color: string; a: number; kind: 'text' | 'pill' }> = [
    { text: t.heading, px: h1, w: 800, color: '#ffffff', a: rise(0.25, 0.7), kind: 'text' },
    { text: t.address, px: h2, w: 700, color: SAGE, a: rise(0.45, 0.9), kind: 'text' },
    { text: t.tagline, px: h3, w: 500, color: FG, a: rise(0.65, 1.1), kind: 'text' },
  ];
  let y = bottom;
  // the pill, bottom-most
  g.font = font(700, h4);
  const pillH = h4 * 1.75, pillW = g.measureText(t.fictional).width + 2 * 26 * u;
  g.save(); g.globalAlpha *= rise(0.1, 0.5);
  rrect(g, left, y - pillH, pillW, pillH, pillH / 2); g.fillStyle = SAGE; g.fill();
  g.fillStyle = INK; g.textBaseline = 'middle'; g.fillText(t.fictional, left + 26 * u, y - pillH / 2 + h4 * 0.04);
  g.restore();
  y -= pillH + 30 * u;
  g.textBaseline = 'alphabetic';
  for (const it of items.slice().reverse()) {
    g.font = font(it.w, it.px);
    const lines = wrap(g, it.text, w).slice(0, it.px === h1 ? 3 : 3), lh = it.px * (it.px === h1 ? 1.06 : 1.28);
    y -= (lines.length - 1) * lh;
    g.save(); g.globalAlpha *= it.a; g.fillStyle = it.color;
    g.translate(0, (1 - it.a) * 14 * u);
    lines.forEach((ln, i) => g.fillText(ln, left, y + i * lh));
    g.restore();
    y -= it.px * 0.95 + (it.px === h1 ? 14 : 12) * u;
  }
  g.restore();
}

// ---- the end card -------------------------------------------------------------------------------------------------------------------------
export type EndModel = { signoff: string; url: string; fictional: string; lines: string[] };
/** The end card: the sign-off, where to go, the fictional line, and the plain disclosures (beta, scripted scenes, stylised art, synthetic voice, attribution).
 *  Returns the panel's rectangle (the film's QA reads it). */
export function drawEnd(g: Ctx, f: FilmFormat, m: EndModel, alpha: number): Box {
  const u = f.k, pad = 40 * u, w = f.portrait ? f.w - f.safe.left - f.safe.right : Math.min(f.w - f.safe.left - f.safe.right, 1560 * u);
  const so = (f.portrait ? 80 : 100) * u, urlPx = (f.portrait ? 40 : 46) * u, fx = (f.portrait ? 30 : 32) * u, small = (f.portrait ? 25 : 26) * u;
  g.save(); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.font = font(500, small);
  const inner = w - 2 * pad, wrapped = m.lines.map(l => wrap(g, l, inner));
  const nLines = wrapped.reduce((a, l) => a + l.length, 0), lh = small * 1.34;
  const h = pad + so * 1.0 + 14 * u + urlPx * 1.3 + 22 * u + fx * 1.75 + 24 * u + nLines * lh + (wrapped.length - 1) * 6 * u + pad;
  const x = Math.round((f.w - w) / 2), y = Math.round(f.portrait ? Math.min(f.h - f.safe.bottom * 0.7 - h, f.h * 0.58) : f.h - f.safe.bottom - h);
  g.globalAlpha *= alpha;
  glass(g, x, y, w, h, 30 * u, u);
  let cy = y + pad + so * 0.82;
  g.font = font(800, so); g.fillStyle = SAGE; g.fillText(m.signoff, x + pad, cy);
  cy += so * 0.18 + 14 * u + urlPx * 0.95;
  g.font = font(700, urlPx); g.fillStyle = '#ffffff'; g.fillText(m.url, x + pad, cy);
  cy += urlPx * 0.35 + 22 * u;
  g.font = font(700, fx); const pw = g.measureText(m.fictional).width + 2 * 24 * u, ph = fx * 1.75;
  rrect(g, x + pad, cy, pw, ph, ph / 2); g.fillStyle = SAGE; g.fill();
  g.fillStyle = INK; g.textBaseline = 'middle'; g.fillText(m.fictional, x + pad + 24 * u, cy + ph / 2 + fx * 0.04);
  g.textBaseline = 'alphabetic';
  cy += ph + 24 * u + small * 0.95;
  g.font = font(500, small); g.fillStyle = MUTED;
  for (const para of wrapped) { for (const ln of para) { g.fillText(ln, x + pad, cy); cy += lh; } cy += 6 * u; }
  g.restore();
  return { x, y, w, h };
}
