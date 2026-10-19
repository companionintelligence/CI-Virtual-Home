// The persona cut's overlay, drawn in Canvas2D over the room: the corner mark, the hook, the popup card, the karaoke caption strip, the leader, the dip
// between scenes and the end card. Everything is a pure function of the cut second, the plan and the frame's format: draw frame i twice and the pixels
// are the same.
//
// The look is the canon's LIGHT set (portal/site.css :root; scripts/test-ads.mts holds these seven values to it): chalk panels, ink text, the phthalo
// primary for the one accent. It is the daylight set because an ad is held to daylight (CI-Common ADS.md 9.1: light grounds, no neon, no glow, no RGB), and
// the family films' dark glass is theirs. Type is Manrope 500, 600 and 700 (the canon's weights; assets/fonts). No faces, no photographs, no app screens,
// no phone drawing: a member is a monogram disc, the popup is words and chips.
// Owner: ad-kit.
import { font, wrap, rrect, type Ctx } from '../cards.js';
import { cutBadgeBox, cutCaptionBox, type CutFormat } from './plan.js';
import type { Cue, CueWord } from '../layout.js';

/** the canon's light tokens: --background, --foreground, --card, --primary, --primary-foreground, --muted, --muted-foreground (portal/site.css :root) */
export const PAL = { bg: '#f3faf7', fg: '#0a222e', card: '#f0f9f5', primary: '#0a6358', onPrimary: '#f0fdf4', muted: '#e8f2ec', mutedFg: '#3a524b' } as const;
export const WEIGHTS = [500, 600, 700];
const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
export const rgba = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
const GLASS = rgba(PAL.card, 0.95), EDGE = rgba(PAL.fg, 0.16);

/** a chalk panel with a hairline edge and a soft drop shadow (a shadow, not a glow: it is dark and sits below the panel) */
function panel(g: Ctx, x: number, y: number, w: number, h: number, r: number, k: number) {
  g.save();
  g.shadowColor = rgba(PAL.fg, 0.26); g.shadowBlur = 30 * k; g.shadowOffsetY = 8 * k;
  rrect(g, x, y, w, h, r); g.fillStyle = GLASS; g.fill();
  g.shadowColor = 'transparent'; rrect(g, x, y, w, h, r); g.lineWidth = Math.max(1, 2 * k); g.strokeStyle = EDGE; g.stroke();
  g.restore();
}
function pill(g: Ctx, x: number, y: number, text: string, px: number, k: number, filled: boolean): number {
  g.font = font(600, px);
  const padX = 16 * k, h = px * 1.7, w = g.measureText(text).width + 2 * padX;
  rrect(g, x, y, w, h, h / 2);
  if (filled) { g.fillStyle = PAL.primary; g.fill(); } else { g.lineWidth = Math.max(1.5, 2.5 * k); g.strokeStyle = PAL.primary; g.stroke(); }
  g.fillStyle = filled ? PAL.onPrimary : PAL.primary; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(text, x + padX, y + h / 2 + px * 0.03);
  return w;
}
function disc(g: Ctx, cx: number, cy: number, r: number, name: string) {
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = PAL.primary; g.fill();
  g.fillStyle = PAL.onPrimary; g.font = font(700, r * 1.05); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((name[0] || '?').toUpperCase(), cx, cy + r * 0.05);
  g.textAlign = 'left';
}

// ---- the corner mark ------------------------------------------------------------------------------------------------------------------------
/** "Fictional family. Real software." in the top left inside the safe area, on every frame of the cut (drawn last, over the dip too). */
export function drawCutBadge(g: Ctx, f: CutFormat, text: string, alpha = 1) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha *= alpha;
  const px = cutBadgeBox(f, 0).font; g.font = font(700, px);
  const b = cutBadgeBox(f, g.measureText(text).width), r = b.h / 2;
  g.shadowColor = rgba(PAL.fg, 0.22); g.shadowBlur = 14 * f.k; g.shadowOffsetY = 3 * f.k;
  rrect(g, b.x, b.y, b.w, b.h, r); g.fillStyle = GLASS; g.fill();
  g.shadowColor = 'transparent'; rrect(g, b.x, b.y, b.w, b.h, r); g.lineWidth = Math.max(1, 2 * f.k); g.strokeStyle = EDGE; g.stroke();
  g.beginPath(); g.arc(b.x + r * 0.95, b.y + r, b.font * 0.2, 0, Math.PI * 2); g.fillStyle = PAL.primary; g.fill();
  g.fillStyle = PAL.fg; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(text, b.x + r * 0.95 + b.font * 0.5, b.y + r + b.font * 0.04);
  g.restore();
}
/** the width the corner mark's text takes (the placer keeps its bar clear of it) */
export function badgeTextWidth(g: Ctx, f: CutFormat, text: string): number { g.save(); g.font = font(700, cutBadgeBox(f, 0).font); const w = g.measureText(text).width; g.restore(); return w; }

// ---- the hook -------------------------------------------------------------------------------------------------------------------------------
export type HookModel = { name: string; text: string };
export type HookLayout = { w: number; h: number; k: number; pad: number; px: number; lines: string[]; kick: number; model: HookModel };
/** The hook: the member, then the beat's title as big as it goes in at most three lines (the sizes are in design units, scaled by k). */
export function measureHook(g: Ctx, m: HookModel, f: CutFormat, width: number): HookLayout {
  const k = f.k, pad = 34 * k, kick = 46 * k, inner = width - 2 * pad;
  const sizes = (f.sheet ? [92, 84, 76, 68, 60, 52, 46] : f.key === '1x1' ? [84, 76, 68, 60, 52, 46, 42] : [72, 64, 56, 48, 42]).map(s => s * k);
  let px = sizes[sizes.length - 1], lines: string[] = [];
  for (const s of sizes) {
    g.font = font(700, s); const ls = wrap(g, m.text, inner);
    if (ls.length <= 3 && ls.every(l => g.measureText(l).width <= inner + 0.5)) { px = s; lines = ls; break; }
  }
  if (!lines.length) { g.font = font(700, px); lines = wrap(g, m.text, inner); }   // (never cut a word off: more lines before fewer words)
  const h = pad + kick + 22 * k + lines.length * px * 1.12 + pad - 6 * k;
  return { w: width, h: Math.ceil(h), k, pad, px, lines, kick, model: m };
}
export function drawHook(g: Ctx, L: HookLayout, x: number, y: number, alpha: number) {
  if (alpha <= 0.002) return;
  const k = L.k; g.save(); g.globalAlpha *= alpha;
  panel(g, x, y, L.w, L.h, 28 * k, k);
  const r = L.kick / 2, cx = x + L.pad + r, cy = y + L.pad + r;
  disc(g, cx, cy, r, L.model.name);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = font(700, 30 * k); g.fillStyle = PAL.mutedFg; g.fillText(L.model.name, x + L.pad + L.kick + 16 * k, cy + 1 * k);
  g.textBaseline = 'alphabetic'; g.font = font(700, L.px); g.fillStyle = PAL.fg;
  L.lines.forEach((t, i) => g.fillText(t, x + L.pad, y + L.pad + L.kick + 22 * k + L.px * (0.9 + 1.12 * i)));
  g.restore();
}

// ---- the popup card -------------------------------------------------------------------------------------------------------------------------
export type CardModel = { name: string; companion: string | null; title: string; chips: string[]; note: string | null };
export type CardLayout = {
  w: number; h: number; k: number; s: number; model: CardModel; pad: number; kick: number;
  titleLines: string[]; titlePx: number; noteLines: string[]; notePx: number; chipPx: number;
  chips: Array<{ text: string; x: number; y: number; filled: boolean }>; yTitle: number; yChips: number; yNote: number;
};
export const CARD_LEVELS = 3;
/** Measure a card for `width` pixels. `level` 0 is the card as designed; 1 and 2 are the same card smaller (0.86 and 0.74), for a frame where the full card would cover the subject. */
export function measureCard(g: Ctx, m: CardModel, f: CutFormat, width: number, level = 0): CardLayout {
  const s = [1, 0.86, 0.74][level] ?? 0.74, k = f.k, pad = 32 * k * s, titlePx = 46 * k * s, chipPx = 26 * k * s, notePx = 27 * k * s, kick = 48 * k * s;
  const textW = width - 2 * pad;
  g.font = font(700, titlePx);
  const titleLines = wrap(g, m.title, textW);
  let y = pad + kick + 16 * k;
  const yTitle = y; y += titleLines.length * titlePx * 1.16 + 14 * k;
  const chips: CardLayout['chips'] = [], yChips = y;
  if (m.chips.length) {
    g.font = font(600, chipPx);
    let x = 0, row = 0; const hh = chipPx * 1.7;
    m.chips.forEach((c, i) => {
      const w = g.measureText(c).width + 32 * k * s;
      if (x > 0 && x + w > textW) { x = 0; row++; }
      chips.push({ text: c, x, y: row * (hh + 10 * k), filled: i === 0 }); x += w + 10 * k;
    });
    y += (row + 1) * (chipPx * 1.7 + 10 * k) + 6 * k;
  }
  const yNote = y; let noteLines: string[] = [];
  if (m.note) { g.font = font(500, notePx); noteLines = wrap(g, m.note, textW); y += noteLines.length * notePx * 1.32 + 6 * k; }
  return { w: width, h: Math.ceil(y + pad - 6 * k), k, s, model: m, pad, kick, titleLines, titlePx, noteLines, notePx, chipPx, chips, yTitle, yChips, yNote };
}
export function drawCard(g: Ctx, L: CardLayout, x: number, y: number, alpha: number) {
  if (alpha <= 0.002) return;
  const k = L.k, m = L.model; g.save(); g.globalAlpha *= alpha;
  panel(g, x, y, L.w, L.h, 26 * k, k);
  const r = L.kick / 2, cx = x + L.pad + r, cy = y + L.pad + r;
  disc(g, cx, cy, r, m.name);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = font(700, 29 * k * L.s); g.fillStyle = PAL.fg;
  const nameW = g.measureText(m.name).width; g.fillText(m.name, x + L.pad + L.kick + 14 * k, cy + 1 * k);
  if (m.companion) { g.font = font(500, 27 * k * L.s); g.fillStyle = PAL.mutedFg; g.fillText(`with ${m.companion}`, x + L.pad + L.kick + 14 * k + nameW + 12 * k, cy + 1 * k); }
  g.textBaseline = 'alphabetic'; g.font = font(700, L.titlePx); g.fillStyle = PAL.fg;
  L.titleLines.forEach((t, i) => g.fillText(t, x + L.pad, y + L.yTitle + L.titlePx * (0.92 + 1.16 * i)));
  g.textBaseline = 'middle';
  for (const c of L.chips) pill(g, x + L.pad + c.x, y + L.yChips + c.y, c.text, L.chipPx, k, c.filled);
  g.textBaseline = 'alphabetic'; g.font = font(500, L.notePx); g.fillStyle = PAL.mutedFg;
  L.noteLines.forEach((t, i) => g.fillText(t, x + L.pad, y + L.yNote + L.notePx * (1 + 1.32 * i)));
  g.restore();
}

// ---- the caption strip ---------------------------------------------------------------------------------------------------------------------
/** The cue on screen at ft, if any. Cues are sorted and do not overlap, so the last one that has started is the only candidate. */
export function cueAt(cues: Cue[], ft: number): Cue | null {
  let lo = 0, hi = cues.length - 1, at = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (cues[m].start <= ft) { at = m; lo = m + 1; } else hi = m - 1; }
  return at >= 0 && ft < cues[at].end ? cues[at] : null;
}
type Placed = { word: CueWord; x: number; line: number; w: number };
/** Break a cue's words into lines no wider than maxW. A cue that takes two lines is broken where the two come out most nearly equal (no one-word second line). */
function layoutWords(g: Ctx, words: CueWord[], maxW: number): { placed: Placed[]; lines: number[] } {
  const space = g.measureText(' ').width, ww = words.map(w => g.measureText(w.text).width);
  const placed: Placed[] = [], lines: number[] = [];
  let x = 0, line = 0;
  for (let i = 0; i < words.length; i++) {
    if (x > 0 && x + ww[i] > maxW) { lines[line] = x - space; line++; x = 0; }
    placed.push({ word: words[i], x, line, w: ww[i] }); x += ww[i] + space;
  }
  lines[line] = x - space;
  if (lines.length === 2) {
    const width = (a: number, b: number) => ww.slice(a, b).reduce((s, v) => s + v, 0) + space * Math.max(0, b - a - 1);
    let best = -1, bestW = Infinity;
    for (let k = 1; k < words.length; k++) { const l1 = width(0, k), l2 = width(k, words.length), m = Math.max(l1, l2); if (l1 <= maxW && l2 <= maxW && m < bestW) { bestW = m; best = k; } }
    if (best > 0) {
      let a = 0, b = 0; lines.length = 0;
      placed.forEach((p, i) => { if (i < best) { p.line = 0; p.x = a; a += ww[i] + space; } else { p.line = 1; p.x = b; b += ww[i] + space; } });
      lines[0] = a - space; lines[1] = b - space;
    }
  }
  return { placed, lines };
}
/** The caption strip: the words already spoken in ink, the one being read on the primary, the rest in the muted ink. Returns the strip's rectangle (null: nothing on screen). */
export function drawCaption(g: Ctx, f: CutFormat, cue: Cue | null, ft: number): { x: number; y: number; w: number; h: number } | null {
  if (!cue) return null;
  const a = Math.min(1, (ft - cue.start) / 0.12 + 0.0001) * Math.min(1, (cue.end - ft) / 0.2 + 0.0001);
  if (a <= 0.002) return null;
  const cb = cutCaptionBox(f), px = cb.font, lh = cb.line, pad = cb.pad, k = f.k;
  g.save(); g.globalAlpha *= Math.max(0, Math.min(1, a));
  g.font = font(700, px); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const innerW = cb.w - 2 * pad - 8 * k, { placed, lines } = layoutWords(g, cue.words, innerW);
  const h = lines.length * lh + 2 * pad, w = Math.min(cb.w, Math.max(...lines) + 2 * pad + 8 * k);
  const x = Math.round((f.w - w) / 2), y = cb.y + cb.h - h;
  panel(g, x, y, w, h, 22 * k, k);
  g.font = font(700, px);
  let cur = -1; placed.forEach((p, i) => { if (p.word.s <= ft + 0.02) cur = i; });
  const space = g.measureText(' ').width;
  placed.forEach((p, i) => {
    const x0 = x + (w - lines[p.line]) / 2 + p.x, by = y + pad + lh * p.line + px * 1.02;
    if (i === cur) { rrect(g, x0 - space * 0.4, by - px * 0.96, p.w + space * 0.8, px * 1.28, 9 * k); g.fillStyle = PAL.primary; g.fill(); }
    g.fillStyle = i === cur ? PAL.onPrimary : i < cur ? PAL.fg : PAL.mutedFg;
    g.fillText(p.word.text, x0, by);
  });
  g.restore();
  return { x, y, w, h };
}

// ---- the leader, the dip -------------------------------------------------------------------------------------------------------------------
/** A line from the card's edge to the subject and a dot with a ring on it; in a sheet frame only the dot. The ring breathes with the cut's clock. */
export function drawLeader(g: Ctx, f: CutFormat, from: [number, number] | null, to: [number, number], alpha: number, ft: number) {
  if (alpha <= 0.002) return;
  const k = f.k; g.save(); g.globalAlpha *= alpha;
  if (from) {
    g.beginPath(); g.moveTo(from[0], from[1]); g.lineTo(to[0], to[1]); g.lineCap = 'round';
    g.lineWidth = 7 * k; g.strokeStyle = rgba(PAL.bg, 0.9); g.stroke(); g.lineWidth = 3.5 * k; g.strokeStyle = PAL.primary; g.stroke();
  }
  const breathe = 0.5 + 0.5 * Math.sin(ft * Math.PI * 1.6);
  g.beginPath(); g.arc(to[0], to[1], (19 + 4 * breathe) * k, 0, Math.PI * 2); g.lineWidth = 3 * k; g.strokeStyle = rgba(PAL.primary, 0.75 - 0.2 * breathe); g.stroke();
  g.beginPath(); g.arc(to[0], to[1], 10 * k, 0, Math.PI * 2); g.fillStyle = PAL.primary; g.fill(); g.lineWidth = 4 * k; g.strokeStyle = PAL.bg; g.stroke();
  g.restore();
}
/** The dip between scenes: the frame faded toward chalk by `amount` (0 clear, 1 chalk). */
export function drawDip(g: Ctx, f: CutFormat, amount: number) {
  if (amount <= 0.002) return;
  g.save(); g.globalAlpha = Math.min(1, amount); g.fillStyle = PAL.bg; g.fillRect(0, 0, f.w, f.h); g.restore();
}

// ---- the end card ---------------------------------------------------------------------------------------------------------------------------
export type EndModel = { cta: string; url: string; fictional: string; lines: string[] };
/**
 * The end card: the call to action as the headline, where to go, the fictional line on its own pill, and the plain disclosures (beta, scripted scenes, stylised art,
 * and the rest the cut's beats require). Sizes fit the frame: the headline and the address take the largest size that stays on one line.
 * Returns the panel's rectangle (the checks read it).
 */
export function drawCutEnd(g: Ctx, f: CutFormat, m: EndModel, alpha: number): { x: number; y: number; w: number; h: number } {
  const k = f.k, pad = 40 * k, w = f.sheet || f.key === '1x1' ? f.w - f.safe.left - f.safe.right : Math.min(f.w - f.safe.left - f.safe.right, 1360 * k), inner = w - 2 * pad;
  const fit = (text: string, weight: number, max: number) => { let px = max * k; g.font = font(weight, px); while (g.measureText(text).width > inner && px > 24 * k) { px -= 2 * k; g.font = font(weight, px); } return px; };
  const ctaPx = fit(m.cta, 700, f.sheet ? 96 : 92), urlPx = fit(m.url, 700, f.sheet ? 52 : 50), fx = (f.sheet ? 31 : 30) * k, small = (f.sheet ? 26 : 25) * k;
  g.save(); g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.font = font(500, small);
  const wrapped = m.lines.map(l => wrap(g, l, inner)), nLines = wrapped.reduce((a, l) => a + l.length, 0), lh = small * 1.34;
  g.font = font(700, fx); const pw = g.measureText(m.fictional).width + 2 * 26 * k, ph = fx * 1.75;
  const h = pad + ctaPx * 1.0 + 12 * k + urlPx * 1.25 + 24 * k + ph + 24 * k + nLines * lh + (wrapped.length - 1) * 6 * k + pad - 6 * k;
  const x = Math.round((f.w - w) / 2), y = Math.round(f.h - f.safe.bottom - h);
  g.globalAlpha *= alpha; panel(g, x, y, w, h, 30 * k, k);
  let cy = y + pad + ctaPx * 0.82;
  g.font = font(700, ctaPx); g.fillStyle = PAL.primary; g.fillText(m.cta, x + pad, cy);
  cy += ctaPx * 0.18 + 12 * k + urlPx * 0.95;
  g.font = font(700, urlPx); g.fillStyle = PAL.fg; g.fillText(m.url, x + pad, cy);
  cy += urlPx * 0.3 + 24 * k;
  rrect(g, x + pad, cy, pw, ph, ph / 2); g.fillStyle = PAL.primary; g.fill();
  g.font = font(700, fx); g.fillStyle = PAL.onPrimary; g.textBaseline = 'middle'; g.fillText(m.fictional, x + pad + 26 * k, cy + ph / 2 + fx * 0.04);
  g.textBaseline = 'alphabetic'; cy += ph + 24 * k + small * 0.95;
  g.font = font(500, small); g.fillStyle = PAL.mutedFg;
  for (const para of wrapped) { for (const ln of para) { g.fillText(ln, x + pad, cy); cy += lh; } cy += 6 * k; }
  g.restore();
  return { x, y, w, h };
}
