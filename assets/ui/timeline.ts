// The shot timeline (plan §6 P1 6): under the scrubber, the shot's beats as bands (chart-1…5), its events as ticks
// (in the door, on a stair, the press), the QA findings as markers (errors in heat, warnings in chart-4 — plan §6 P0 3)
// and two sparklines from the track: the camera's speed and how fast it turns. Everything is read from the shot's
// baked track (window.__houseShotTrack): beats and events in seconds, 120 samples a second of position and look.
// Until S5's planner v2 bakes beats (plan §3.3), a v1 shot shows its coarse phases instead (format.ts v1Phases),
// drawn hatched and named "phases" so they are never mistaken for beats.
//
// The scrubber is a native range input (keyboard, screen readers); the page steps it a frame at a time (← →, and a
// second with Shift). Markers are buttons: focusable, named, and a click seeks to them. Colours come from the page's
// canon tokens (CSS custom properties), never literals.
import { trackRates, type Phase } from './format.js';

export type TimelineTrack = {
  duration: number; samples: number; dt: number; pos: ArrayLike<number>; look: ArrayLike<number>;
  beats?: Array<{ name: string; t0: number; t1: number }>;
  events?: { enterT?: number | null; stairT?: number[]; pressT?: number | null; settleT?: number | null };
};
export type TimelineIssue = { level: 'error' | 'warn'; code: string; message: string; t: number; tEnd?: number | null };
export type Band = Phase & { beat: boolean };

const svg = (name: string) => `<svg class="i" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
const EVENT_NAMES: Record<string, string> = { enterT: 'In the door', stairT: 'On the stairs', pressT: 'Core button pressed', settleT: 'Camera settles' };
const EVENT_ICONS: Record<string, string> = { enterT: 'door', stairT: 'stairs', pressT: 'power', settleT: 'pause' };

export function createTimeline(root: HTMLElement, { onSeek }: { onSeek: (t: number) => void }) {
  root.classList.add('rc-tl');
  root.innerHTML = `
    <div class="rc-tl-marks" aria-label="Events and QA findings"></div>
    <canvas class="rc-tl-bands" aria-hidden="true"></canvas>
    <input type="range" class="rc-tl-scrub" id="anim-timeline-slider" min="0" max="10000" step="1" value="0" aria-label="Shot time">
    <canvas class="rc-tl-spark" aria-hidden="true"></canvas>
    <div class="rc-tl-head" aria-hidden="true"></div>`;
  const marks = root.querySelector('.rc-tl-marks') as HTMLElement;
  const bandsCv = root.querySelector('.rc-tl-bands') as HTMLCanvasElement;
  const sparkCv = root.querySelector('.rc-tl-spark') as HTMLCanvasElement;
  const input = root.querySelector('.rc-tl-scrub') as HTMLInputElement;
  const head = root.querySelector('.rc-tl-head') as HTMLElement;

  let track: TimelineTrack | null = null, bands: Band[] = [], issues: TimelineIssue[] = [], rates: { speed: Float32Array; yaw: Float32Array } | null = null;
  let t = 0, duration = 10;

  const css = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
  function sizeCanvas(cv: HTMLCanvasElement) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w: r.width, h: r.height };
  }
  function drawBands() {
    const { g, w, h } = sizeCanvas(bandsCv);
    g.clearRect(0, 0, w, h);
    g.fillStyle = css('--rc-tile'); g.fillRect(0, 0, w, h);
    const font = `600 11px ${css('--font-sans') || 'sans-serif'}`;
    bands.forEach((b, i) => {
      const x0 = b.t0 * w, x1 = b.t1 * w, col = css(`--chart-${(i % 5) + 1}`);
      g.save();
      g.globalAlpha = b.beat ? 0.62 : 0.34;
      g.fillStyle = col; g.fillRect(x0 + 0.5, 1, Math.max(1, x1 - x0 - 1), h - 2);
      if (!b.beat) {   // derived phases: hatched, so they never read as the planner's beats
        g.globalAlpha = 0.35; g.strokeStyle = css('--foreground'); g.lineWidth = 1;
        g.beginPath(); g.rect(x0 + 0.5, 1, Math.max(1, x1 - x0 - 1), h - 2); g.clip();
        for (let x = x0 - h; x < x1; x += 6) { g.moveTo(x, h); g.lineTo(x + h, 0); }
        g.stroke();
      }
      g.restore();
      g.font = font; g.textBaseline = 'middle';
      const label = b.name, tw = g.measureText(label).width;
      if (tw + 8 < x1 - x0) { g.fillStyle = css('--foreground'); g.fillText(label, x0 + 4, h / 2 + 0.5); }
    });
  }
  function drawSpark() {
    const { g, w, h } = sizeCanvas(sparkCv);
    g.clearRect(0, 0, w, h);
    if (!rates || !track) return;
    const line = (a: Float32Array, col: string) => {
      let max = 0; for (let i = 0; i < a.length; i++) max = Math.max(max, a[i]);
      if (!(max > 0)) return;
      g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath();
      const n = a.length, step = Math.max(1, Math.floor(n / (w * 2)));
      for (let i = 0; i < n; i += step) { const x = (i / (n - 1)) * w, y = h - 1.5 - (a[i] / max) * (h - 3); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    };
    line(rates.speed, css('--chart-2'));
    line(rates.yaw, css('--chart-4'));
  }
  function drawMarks() {
    marks.innerHTML = '';
    const ev = (track && track.events) || {};
    const add = (cls: string, at: number, label: string, icon: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `rc-tl-mark ${cls}`; b.style.left = `${(Math.max(0, Math.min(1, at)) * 100).toFixed(3)}%`;
      b.title = label; b.setAttribute('aria-label', label);
      b.innerHTML = svg(icon);
      b.addEventListener('click', onClick);
      marks.appendChild(b);
    };
    const secs = (s: number) => `${s.toFixed(1)} s`;
    for (const k of ['enterT', 'pressT', 'settleT'] as const) {
      const s = (ev as any)[k];
      if (typeof s === 'number' && duration > 0) add('rc-tl-event', s / duration, `${EVENT_NAMES[k]} at ${secs(s)}`, EVENT_ICONS[k], () => onSeek(s / duration));
    }
    for (const s of ev.stairT || []) if (typeof s === 'number') add('rc-tl-event', s / duration, `${EVENT_NAMES.stairT} at ${secs(s)}`, EVENT_ICONS.stairT, () => onSeek(s / duration));
    for (const i of issues) add(`rc-tl-qa rc-tl-qa-${i.level}`, i.t, `${i.level === 'error' ? 'Error' : 'Warning'} ${i.code} at ${secs(i.t * duration)}: ${i.message}`, i.level === 'error' ? 'alert' : 'info', () => onSeek(i.t));
  }
  function place() { head.style.left = `${(t * 100).toFixed(3)}%`; input.style.setProperty('--tl-p', t.toFixed(4)); }
  function redraw() { drawBands(); drawSpark(); place(); }

  input.addEventListener('input', () => onSeek(Number(input.value) / Number(input.max)));
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => redraw()).observe(root);

  return {
    input,
    /** a shot's track (null: none yet), its bands (the v2 beats, or the v1 phases), and its QA findings (t: 0…1) */
    setShot({ track: tr, phases = [], qa = [], duration: d }: { track: TimelineTrack | null; phases?: Phase[]; qa?: TimelineIssue[]; duration: number }) {
      track = tr; duration = d || (tr && tr.duration) || 10;
      const beats = tr && tr.beats && tr.beats.length ? tr.beats.map(b => ({ name: b.name, t0: b.t0 / duration, t1: b.t1 / duration, beat: true })) : null;
      bands = beats || phases.map(p => ({ ...p, beat: false }));
      issues = qa.filter(i => typeof i.t === 'number');
      rates = tr ? trackRates(tr as any) : null;
      root.dataset.bands = beats ? 'beats' : bands.length ? 'phases' : 'none';
      drawMarks(); redraw();
    },
    setQA(qa: TimelineIssue[]) { issues = qa.filter(i => typeof i.t === 'number'); drawMarks(); },
    /** t: 0…1 */
    setTime(v: number) {
      t = Math.max(0, Math.min(1, v));
      const nv = String(Math.round(t * Number(input.max)));
      if (input.value !== nv) input.value = nv;
      place();
    },
    /** the band (beat or phase) the time t falls in — loop-beat plays inside it */
    bandAt(v: number): Band | null { return bands.find(b => v >= b.t0 && v < b.t1) || (v >= 1 ? bands[bands.length - 1] || null : null); },
    get bands() { return bands.slice(); },
    get rates() { return rates; },
    redraw,
  };
}
