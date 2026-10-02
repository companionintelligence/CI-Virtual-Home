// assets/xr/ui/button.ts : the kit's widgets as data. A widget is a rectangle with an id, a label and a state; paint.ts draws it
// (widgetOps) and the ray hub finds it (panel.hit). Button, Toggle, Segment and Row are one record with different `kind`s, so a layout is
// just a list, and a state is the same four words everywhere: idle, hover, pressed, disabled. Never colour alone: hover adds a heavy
// outline and an underline, pressed sinks the label, disabled is dashed and says so (paint.ts widgetOps).
import type { Icon, Metrics, Op, Widget } from './paint.js';

type Spec = Omit<Widget, 'x' | 'y' | 'w' | 'h'>;
export const button = (id: string, label: string, o: Partial<Spec> = {}): Spec => ({ id, kind: 'button', label, enabled: true, ...o });
export const toggle = (id: string, label: string, on: boolean, o: Partial<Spec> = {}): Spec => ({ id, kind: 'toggle', label, on, enabled: true, ...o });
export const segment = (id: string, label: string, on: boolean, o: Partial<Spec> = {}): Spec => ({ id, kind: 'segment', label, on, enabled: true, ...o });
export const row = (id: string, label: string, value?: string, icon?: Icon, o: Partial<Spec> = {}): Spec => ({ id, kind: 'row', label, value, icon, enabled: true, ...o });

/** items stacked top to bottom, one target-height row each, with the kit's gap between; returns the widgets and the y after the last */
export function stack(items: Spec[], x: number, y: number, w: number, m: Metrics): { widgets: Widget[]; y: number } {
  const widgets: Widget[] = [];
  for (const it of items) { widgets.push({ ...it, x, y, w, h: m.targetPx }); y += m.targetPx + m.gapPx; }
  return { widgets, y: y - (items.length ? m.gapPx : 0) };
}
/** items side by side, equal widths */
export function across(items: Spec[], x: number, y: number, w: number, m: Metrics): Widget[] {
  const n = items.length, each = (w - (n - 1) * m.gapPx) / n;
  return items.map((it, i) => ({ ...it, x: x + i * (each + m.gapPx), y, w: each, h: m.targetPx }));
}

/** A progress bar: a track and a fill, `p` from 0 to 1 */
export function progressOps(x: number, y: number, w: number, h: number, p: number, m: Metrics): Op[] {
  const t = m.theme;
  return [
    { k: 'rect', x, y, w, h, r: h / 2, fill: t.btn, stroke: t.line, lw: 1 },
    { k: 'rect', x, y, w: Math.max(h, w * Math.max(0, Math.min(1, p))), h, r: h / 2, fill: t.accent },
  ];
}
