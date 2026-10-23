// The persona cut's overlay, drawn in Canvas2D over the room: the corner mark, the hook, the popup card, the karaoke caption strip, the leader, the dip
// between scenes and the end card. Everything is a pure function of the cut second, the plan and the frame's format: draw frame i twice and the pixels
// are the same.
//
// The look is the canon's LIGHT set (portal/site.css :root; scripts/test-ads.mts holds these seven values to it): chalk panels, ink text, the phthalo
// primary for the one accent. It is the daylight set because an ad is held to daylight (CI-Common ADS.md 9.1: light grounds, no neon, no glow, no RGB), and
// the family films' dark glass is theirs. Type is Manrope 500, 600 and 700 (the canon's weights; assets/fonts). No faces, no photographs, no app screens,
// no phone drawing: a member is a monogram disc, the popup is words and chips.
//
// THE TYPE FLOOR (live pass 3). A cut is a picture shown scaled down (a 1080 px canvas is about 390 px wide on a phone), so every line of reading text in it is at least
// 36 design px at the 1080 px short edge (`CANVAS_TYPE_MIN`, assets/story/place.ts) times the frame's k: the corner mark, the card's kicker, chips and note, the caption (42 and 44),
// the pill and the disclosures. The card's title is 56. The cut does not take the live modals' 30 % reduction (25.5 px), because the canvas is reduced itself (reference/story/ads.md).
// A card never shrinks its type to fit: it is offered as variants (padding, width) and layout.ts's solver refuses one under the floor. `auditType` (cards.ts) records the smallest size
// the overlay really drew, so a render fails the floor on what was painted and not only on what was planned.
//
// THE NAME IS A KICKER: the member's name on the hook and the card is drawn in capitals, bold, tracked 0.2em, in the primary (phthalo on this light set), as the live cards draw it; the
// string in the plan stays as written.
// Owner: ad-kit.
import { font, wrap, rrect, drawKick, TYPE, CHIP_PAD, CHIP_H, DISC_D, FLOOR, type Ctx } from '../cards.js';
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
  const padX = CHIP_PAD * k, h = px * CHIP_H, w = g.measureText(text).width + 2 * padX;
  rrect(g, x, y, w, h, h / 2);
  if (filled) { g.fillStyle = PAL.primary; g.fill(); } else { g.lineWidth = Math.max(1.5, 2.5 * k); g.strokeStyle = PAL.primary; g.stroke(); }
  g.fillStyle = filled ? PAL.onPrimary : PAL.primary; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(text, x + padX, y + h / 2 + px * 0.03);
  return w;
}
function disc(g: Ctx, cx: number, cy: number, r: number, name: string) {
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = PAL.primary; g.fill();
  g.fillStyle = PAL.onPrimary; g.font = font(700, r * 1.2); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((name[0] || '?').toUpperCase(), cx, cy + r * 0.05);
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
export type HookLayout = { w: number; h: number; k: number; pad: number; px: number; lines: string[]; kick: number; kickPx: number; /** the smallest type in the panel, px of this canvas */ type: number; model: HookModel };
/** The hook: the member (a kicker: capitals, bold, tracked), then the beat's title as big as it goes in at most three lines (the sizes are in design units, scaled by k; the smallest is 42). */
export const hookSizes = (f: CutFormat): number[] => (f.sheet ? [92, 84, 76, 68, 60, 52, 46] : f.key === '1x1' ? [84, 76, 68, 60, 52, 46, 42] : [72, 64, 56, 48, 42]).map(s => s * f.k);
/** `cap` (px) keeps the title at or under that size: the placer asks for the next smaller panel when the biggest would cover the subject. */
export function measureHook(g: Ctx, m: HookModel, f: CutFormat, width: number, cap = Infinity): HookLayout {
  const k = f.k, pad = 34 * k, kick = DISC_D * k, inner = width - 2 * pad, kickPx = TYPE.read * k;
  const sizes = hookSizes(f).filter(s => s <= cap + 1e-6);
  let px = sizes[sizes.length - 1], lines: string[] = [];
  for (const s of sizes) {
    g.font = font(700, s); const ls = wrap(g, m.text, inner);
    if (ls.length <= 3 && ls.every(l => g.measureText(l).width <= inner + 0.5)) { px = s; lines = ls; break; }
  }
  if (!lines.length) { g.font = font(700, px); lines = wrap(g, m.text, inner); }   // (never cut a word off: more lines before fewer words)
  const h = pad + kick + 22 * k + lines.length * px * 1.12 + pad - 6 * k;
  return { w: width, h: Math.ceil(h), k, pad, px, lines, kick, kickPx, type: Math.min(px, kickPx), model: m };
}
export function drawHook(g: Ctx, L: HookLayout, x: number, y: number, alpha: number) {
  if (alpha <= 0.002) return;
  const k = L.k; g.save(); g.globalAlpha *= alpha;
  panel(g, x, y, L.w, L.h, 28 * k, k);
  const r = L.kick / 2, cx = x + L.pad + r, cy = y + L.pad + r;
  disc(g, cx, cy, r, L.model.name);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = PAL.primary; drawKick(g, L.model.name, x + L.pad + L.kick + 16 * k, cy + 1 * k, L.kickPx);
  g.textBaseline = 'alphabetic'; g.font = font(700, L.px); g.fillStyle = PAL.fg;
  L.lines.forEach((t, i) => g.fillText(t, x + L.pad, y + L.pad + L.kick + 22 * k + L.px * (0.9 + 1.12 * i)));
  g.restore();
}

// ---- the popup card -------------------------------------------------------------------------------------------------------------------------
export type CardModel = { name: string; companion: string | null; title: string; chips: string[]; note: string | null };
export type CardLayout = {
  w: number; h: number; k: number; tight: boolean; model: CardModel; pad: number; kick: number;
  /** a chip or a word is wider than the text column: this width is not a way to set the card */
  bad: boolean;
  /** the smallest type in the card, px of this canvas (the solver refuses a card under 36 design px) */
  type: number;
  titleLines: string[]; titlePx: number; noteLines: string[]; notePx: number; chipPx: number; kickPx: number;
  chips: Array<{ text: string; x: number; y: number; filled: boolean }>; yTitle: number; yChips: number; yNote: number;
};
/** The card's ways to be set: `tight` is the same card with its padding and gaps at 0.68 (the type is never touched; it is 36 design px for the kicker, the chips and the note and 56 for the title). */
export const CARD_PAD_TIGHT = 0.68;
/** Measure a card for `width` pixels. */
export function measureCard(g: Ctx, m: CardModel, f: CutFormat, width: number, tight = false): CardLayout {
  const k = f.k, s = tight ? CARD_PAD_TIGHT : 1, pad = 32 * k * s, gap = (tight ? 9 : 14) * k, px = TYPE.read * k, titlePx = TYPE.title * k, kick = DISC_D * k;
  const textW = width - 2 * pad;
  g.font = font(700, titlePx);
  const titleLines = wrap(g, m.title, textW);
  let y = pad + kick + 16 * k * s;
  const yTitle = y; y += titleLines.length * titlePx * 1.14 + gap;
  const chips: CardLayout['chips'] = [], yChips = y, ch = px * CHIP_H;
  if (m.chips.length) {
    g.font = font(600, px);
    let x = 0, row = 0;
    m.chips.forEach((c, i) => {
      const w = g.measureText(c).width + 2 * CHIP_PAD * k;
      if (x > 0 && x + w > textW) { x = 0; row++; }
      chips.push({ text: c, x, y: row * (ch + 10 * k * s), filled: i === 0 }); x += w + 10 * k * s;
    });
    y += (row + 1) * (ch + 10 * k * s) + 4 * k;
  }
  const yNote = y; let noteLines: string[] = [];
  if (m.note) { g.font = font(500, px); noteLines = wrap(g, m.note, textW); y += noteLines.length * px * 1.3 + 4 * k; }
  g.font = font(700, titlePx); const wide = Math.max(...m.title.split(/\s+/).map(t => g.measureText(t).width), 0) > textW + 0.5 || chips.some(c => { g.font = font(600, px); return g.measureText(c.text).width + 2 * CHIP_PAD * k > textW + 0.5; });
  return { w: width, h: Math.ceil(y + pad - 4 * k), k, tight, bad: wide, model: m, pad, kick, type: px, titleLines, titlePx, noteLines, notePx: px, chipPx: px, kickPx: px, chips, yTitle, yChips, yNote };
}
export function drawCard(g: Ctx, L: CardLayout, x: number, y: number, alpha: number) {
  if (alpha <= 0.002) return;
  const k = L.k, m = L.model; g.save(); g.globalAlpha *= alpha;
  panel(g, x, y, L.w, L.h, 26 * k, k);
  const r = L.kick / 2, cx = x + L.pad + r, cy = y + L.pad + r;
  disc(g, cx, cy, r, m.name);
  // the kicker: the name as capitals, bold, tracked, in the primary; "with <companion>" after it
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = PAL.primary;
  const tx = x + L.pad + L.kick + 16 * k, nameW = drawKick(g, m.name, tx, cy + 1 * k, L.kickPx);
  if (m.companion) { g.font = font(500, L.kickPx); g.fillStyle = PAL.mutedFg; g.textAlign = 'left'; g.fillText(`with ${m.companion}`, tx + nameW + 16 * k, cy + 1 * k); }
  g.textBaseline = 'alphabetic'; g.font = font(700, L.titlePx); g.fillStyle = PAL.fg;
  L.titleLines.forEach((t, i) => g.fillText(t, x + L.pad, y + L.yTitle + L.titlePx * (0.9 + 1.14 * i)));
  g.textBaseline = 'middle';
  for (const c of L.chips) pill(g, x + L.pad + c.x, y + L.yChips + c.y, c.text, L.chipPx, k, c.filled);
  g.textBaseline = 'alphabetic'; g.font = font(500, L.notePx); g.fillStyle = PAL.mutedFg;
  L.noteLines.forEach((t, i) => g.fillText(t, x + L.pad, y + L.yNote + L.notePx * (0.98 + 1.3 * i)));
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
 * The end card: the call to action as the headline, where to go, the fictional line on its own pill, and the plain disclosures (scripted scenes, stylised art, and the rest
 * the cut's beats require) at 36 design px. The headline and the address take the largest size that stays on one line. The panel sits between the corner mark and the bottom margin
 * (the corner mark is on every frame and must not be covered): if the disclosures at that size need more room than the frame has (a square), the panel goes tighter, never smaller in its
 * fine print: first its padding and spacing, then the disclosures run on as one paragraph, then the pill in the panel goes (the corner mark says it on the same frame).
 * Returns the panel's rectangle (the checks read it); `fit` says which of the three it took.
 */
export type EndFit = 'roomy' | 'tight' | 'run-on' | 'no-pill';
export function drawCutEnd(g: Ctx, f: CutFormat, m: EndModel, alpha: number): { x: number; y: number; w: number; h: number; fit: EndFit; lines: number } {
  const k = f.k, w = f.sheet || f.key === '1x1' ? f.w - f.safe.left - f.safe.right : Math.min(f.w - f.safe.left - f.safe.right, 1360 * k);
  const top = f.safe.top + cutBadgeBox(f, 0).h + 12 * k, room = f.h - f.safe.bottom - top, floor = FLOOR * k;
  const lay = (mode: EndFit) => {
    const tight = mode !== 'roomy', pad = (tight ? 28 : 40) * k, inner = w - 2 * pad;
    const fit = (text: string, weight: number, max: number) => { let px = max * k; g.font = font(weight, px); while (g.measureText(text).width > inner && px > floor * 1.1) { px -= 2 * k; g.font = font(weight, px); } return px; };
    const ctaPx = fit(m.cta, 700, (f.sheet ? 96 : 92) * (tight ? 0.84 : 1)), urlPx = fit(m.url, 700, (f.sheet ? 52 : 50) * (tight ? 0.9 : 1)), fx = TYPE.read * k, small = TYPE.read * k;
    g.font = font(500, small);
    const paras = mode === 'run-on' || mode === 'no-pill' ? [m.lines.join(' ')] : m.lines, wrapped = paras.map(l => wrap(g, l, inner)), nLines = wrapped.reduce((a, l) => a + l.length, 0);
    const lh = small * (tight ? 1.22 : 1.34), sp = (tight ? 3 : 6) * k, gaps = (tight ? [8, 14, 14] : [12, 24, 24]).map(v => v * k);
    g.font = font(700, fx); const pw = g.measureText(m.fictional).width + 2 * 26 * k, ph = fx * 1.75, pillH = mode === 'no-pill' ? 0 : ph + gaps[2];
    const h = pad + ctaPx * 1.0 + gaps[0] + urlPx * 1.25 + gaps[1] + pillH + nLines * lh + (wrapped.length - 1) * sp + pad - 6 * k;
    return { pad, inner, ctaPx, urlPx, fx, small, wrapped, nLines, lh, sp, gaps, pw, ph, h, mode };
  };
  let L = lay('roomy');
  for (const mode of ['tight', 'run-on', 'no-pill'] as EndFit[]) if (L.h > room) L = lay(mode);
  g.save(); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const h = L.h, x = Math.round((f.w - w) / 2), y = Math.round(f.h - f.safe.bottom - h);
  g.globalAlpha *= alpha; panel(g, x, y, w, h, 30 * k, k);
  let cy = y + L.pad + L.ctaPx * 0.82;
  g.font = font(700, L.ctaPx); g.fillStyle = PAL.primary; g.fillText(m.cta, x + L.pad, cy);
  cy += L.ctaPx * 0.18 + L.gaps[0] + L.urlPx * 0.95;
  g.font = font(700, L.urlPx); g.fillStyle = PAL.fg; g.fillText(m.url, x + L.pad, cy);
  cy += L.urlPx * 0.3 + L.gaps[1];
  if (L.mode !== 'no-pill') {
    rrect(g, x + L.pad, cy, L.pw, L.ph, L.ph / 2); g.fillStyle = PAL.primary; g.fill();
    g.font = font(700, L.fx); g.fillStyle = PAL.onPrimary; g.textBaseline = 'middle'; g.fillText(m.fictional, x + L.pad + 26 * k, cy + L.ph / 2 + L.fx * 0.04);
    g.textBaseline = 'alphabetic'; cy += L.ph + L.gaps[2];
  }
  cy += L.small * 0.95;
  g.font = font(500, L.small); g.fillStyle = PAL.mutedFg;
  for (const para of L.wrapped) { for (const ln of para) { g.fillText(ln, x + L.pad, cy); cy += L.lh; } cy += L.sp; }
  g.restore();
  return { x, y, w, h, fit: L.mode, lines: L.nLines };
}
