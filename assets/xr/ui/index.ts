// assets/xr/ui/index.ts : SEED STUB (no panels). Package xr-ui REPLACES this file (and adds panel.ts, paint.ts, button.ts, caption.ts, card.ts, menu.ts, toast.ts, tour-presenter.ts, demo.ts ...).
import type { XrHost, XrUi } from '../host.js';
export function createUi(_host: XrHost): XrUi {
  return { async mount() {}, tick() {}, toast() {}, showStatus() {}, presenter: () => null, unmount() {} };
}
