// The film's standing overlay, in Canvas2D: the corner mark, the karaoke caption strip, the leader line and its dot, and the dip between scenes.
// Everything is a pure function of the film second, the cue list and the frame's format: draw frame i twice and the pixels are the same.
// Owner: video-tool.
import { captionBox, badgeBox, type Cue, type FilmFormat, type CueWord } from './layout.js';
import { INK, FG, SAGE, GLASS, EDGE, font, rrect, type Ctx } from './cards.js';

/** the colour of a word still to be spoken: solid, so its contrast on the glass is the same wherever the scene behind is bright */
const UPCOMING = '#9db4ba';

/** "Fictional family. Real software." in the top left, on every frame except the ones that carry the line big (the title and the end card). */
export function drawBadge(g: Ctx, f: FilmFormat, text: string, alpha: number) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha *= alpha;
  g.font = font(700, Math.round(26 * f.k));
  const b = badgeBox(f, g.measureText(text).width), r = b.h / 2;
  rrect(g, b.x, b.y, b.w, b.h, r); g.fillStyle = GLASS; g.fill(); g.lineWidth = Math.max(1, 2 * f.k); g.strokeStyle = EDGE; g.stroke();
  g.beginPath(); g.arc(b.x + r * 0.95, b.y + r, b.font * 0.2, 0, Math.PI * 2); g.fillStyle = SAGE; g.fill();
  g.fillStyle = FG; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(text, b.x + r * 0.95 + b.font * 0.5, b.y + r + b.font * 0.04);
  g.restore();
}

/** The cue on screen at ft, if any. Cues are sorted and do not overlap, so the last one that has started is the only candidate. */
export function cueAt(cues: Cue[], ft: number): Cue | null {
  let lo = 0, hi = cues.length - 1, at = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (cues[m].start <= ft) { at = m; lo = m + 1; } else hi = m - 1; }
  return at >= 0 && ft < cues[at].end ? cues[at] : null;
}

type Placed = { word: CueWord; x: number; line: number; w: number };
/** Break a cue's words into lines no wider than maxW; returns each word's x within its line. */
function layoutWords(g: Ctx, words: CueWord[], maxW: number): { placed: Placed[]; lines: number[] } {
  const space = g.measureText(' ').width, placed: Placed[] = [], lines: number[] = [];
  let x = 0, line = 0;
  for (const w of words) {
    const ww = g.measureText(w.text).width;
    if (x > 0 && x + ww > maxW) { lines[line] = x - space; line++; x = 0; }
    placed.push({ word: w, x, line, w: ww }); x += ww + space;
  }
  lines[line] = x - space;
  return { placed, lines };
}

/** The caption strip: the cue's words, those spoken in white, the one being spoken on a sage highlight, the rest muted. An agent's line carries its speaker
 *  and the word "Scripted". Returns the strip's rectangle (null when nothing is on screen). */
export function drawCaption(g: Ctx, f: FilmFormat, cue: Cue | null, ft: number, alpha = 1): { x: number; y: number; w: number; h: number } | null {
  if (!cue) return null;
  const a = alpha * Math.min(1, (ft - cue.start) / 0.12 + 0.0001) * Math.min(1, (cue.end - ft) / 0.2 + 0.0001);
  if (a <= 0.002) return null;
  const cb = captionBox(f), px = cb.font, lh = cb.line, pad = cb.pad;
  g.save(); g.globalAlpha *= Math.max(0, Math.min(1, a));
  g.font = font(700, px); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const innerW = cb.w - 2 * pad - 8 * f.k;
  const { placed, lines } = layoutWords(g, cue.words, innerW);
  const tag = cue.speaker ? lh * 0.9 : 0;
  const h = lines.length * lh + 2 * pad + tag, w = Math.min(cb.w, Math.max(...lines) + 2 * pad + 8 * f.k);
  const x = Math.round((f.w - w) / 2), y = cb.y + cb.h - h;
  rrect(g, x, y, w, h, 22 * f.k); g.fillStyle = 'rgba(4,22,32,0.86)'; g.fill(); g.lineWidth = Math.max(1, 2 * f.k); g.strokeStyle = EDGE; g.stroke();
  let top = y + pad;
  if (cue.speaker) {
    g.font = font(700, px * 0.62); g.fillStyle = SAGE;
    const label = `${cue.speaker}`, lw = g.measureText(label).width;
    g.fillText(label, x + pad + 4 * f.k, top + px * 0.62);
    const tx = x + pad + 4 * f.k + lw + 14 * f.k, th = px * 0.62 * 1.5;
    g.font = font(600, px * 0.5); const sw = g.measureText('Scripted').width + 22 * f.k;
    rrect(g, tx, top + px * 0.62 - th * 0.78, sw, th, th / 2); g.lineWidth = Math.max(1, 1.6 * f.k); g.strokeStyle = 'rgba(197,232,220,0.7)'; g.stroke();
    g.fillStyle = SAGE; g.fillText('Scripted', tx + 11 * f.k, top + px * 0.62 - th * 0.1);
    top += tag;
  }
  g.font = font(700, px);
  // the word being spoken: the last whose start has passed
  let cur = -1; placed.forEach((p, i) => { if (p.word.s <= ft + 0.02) cur = i; });
  const space = g.measureText(' ').width;
  placed.forEach((p, i) => {
    const lineW = lines[p.line], x0 = x + (w - lineW) / 2 + p.x, by = top + lh * p.line + px * 1.02;
    if (i === cur) { rrect(g, x0 - space * 0.4, by - px * 0.96, p.w + space * 0.8, px * 1.28, 9 * f.k); g.fillStyle = SAGE; g.fill(); }
    g.fillStyle = i === cur ? INK : i < cur ? '#ffffff' : UPCOMING;
    g.fillText(p.word.text, x0, by);
  });
  g.restore();
  return { x, y, w, h };
}

/** The leader: a line from the card's edge to the subject, ending in a dot with a ring. In a portrait film only the dot. */
export function drawLeader(g: Ctx, f: FilmFormat, from: [number, number] | null, to: [number, number], alpha: number, ft: number) {
  if (alpha <= 0.002) return;
  const k = f.k; g.save(); g.globalAlpha *= alpha;
  if (from) {
    g.beginPath(); g.moveTo(from[0], from[1]); g.lineTo(to[0], to[1]);
    g.lineCap = 'round'; g.lineWidth = 6 * k; g.strokeStyle = 'rgba(4,22,32,0.7)'; g.stroke();
    g.lineWidth = 3 * k; g.strokeStyle = SAGE; g.stroke();
  }
  // the ring breathes with the film's clock, not the wall's
  const breathe = 0.5 + 0.5 * Math.sin(ft * Math.PI * 1.6);
  g.beginPath(); g.arc(to[0], to[1], (17 + 4 * breathe) * k, 0, Math.PI * 2); g.lineWidth = 2.5 * k; g.strokeStyle = `rgba(197,232,220,${0.55 - 0.2 * breathe})`; g.stroke();
  g.beginPath(); g.arc(to[0], to[1], 9 * k, 0, Math.PI * 2); g.fillStyle = SAGE; g.fill(); g.lineWidth = 3 * k; g.strokeStyle = INK; g.stroke();
  g.restore();
}

/** The dip between scenes: the frame darkened toward ink by `amount` (0 clear, 1 black). */
export function drawDip(g: Ctx, f: FilmFormat, amount: number) {
  if (amount <= 0.002) return;
  g.save(); g.globalAlpha = Math.min(1, amount); g.fillStyle = INK; g.fillRect(0, 0, f.w, f.h); g.restore();
}

