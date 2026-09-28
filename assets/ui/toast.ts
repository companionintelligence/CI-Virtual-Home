// Toasts (plan §6 P2 16: toasts, never a browser alert or confirm dialog). One region in the corner of the window, announced to
// screen readers (the region is aria-live polite; an error toast is role="alert"). A toast can carry one action (Undo, Download …)
// and a progress toast a bar and Cancel — the Record button's (plan §6 P0 1).
//
// Icons are the page's lucide sprite (<use href="#i-…">). Styles: room-creator.html, .rc-toast*.

export type ToastKind = 'info' | 'success' | 'error';
export type ToastAction = { label: string; onClick: () => void };
export type ToastHandle = { el: HTMLElement; close: () => void };
export type ProgressHandle = ToastHandle & {
  update: (fraction: number, text?: string) => void;
  done: (message: string, opts?: { kind?: ToastKind; action?: ToastAction; timeout?: number }) => void;
};

const ICON: Record<ToastKind, string> = { info: 'info', success: 'check', error: 'alert' };
const svg = (name: string) => `<svg class="i" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

export function createToasts(root: HTMLElement) {
  root.classList.add('rc-toasts');
  root.setAttribute('aria-label', 'Notifications');
  root.setAttribute('aria-live', 'polite');   // a new toast is announced; an error toast interrupts (role="alert")

  function frame(kind: ToastKind): HTMLElement {
    const el = document.createElement('div');
    el.className = `rc-toast rc-toast-${kind}`;
    if (kind === 'error') el.setAttribute('role', 'alert');
    root.appendChild(el);
    return el;
  }
  function body(el: HTMLElement, kind: ToastKind, text: string) {
    el.innerHTML = `${svg(ICON[kind])}<div class="rc-toast-body"><p class="rc-toast-text"></p></div><div class="rc-toast-actions"></div>`;
    el.querySelector('.rc-toast-text')!.textContent = text;
  }
  function addAction(el: HTMLElement, a: ToastAction, close: () => void, closes = true) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rc-toast-btn'; b.textContent = a.label;
    b.addEventListener('click', () => { a.onClick(); if (closes) close(); });
    el.querySelector('.rc-toast-actions')!.appendChild(b);
    return b;
  }
  function addClose(el: HTMLElement, close: () => void) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rc-toast-x'; b.setAttribute('aria-label', 'Dismiss'); b.title = 'Dismiss';
    b.innerHTML = svg('x');
    b.addEventListener('click', close);
    el.querySelector('.rc-toast-actions')!.appendChild(b);
  }

  function show(text: string, { kind = 'info' as ToastKind, action = null as ToastAction | null, timeout = kind === 'error' ? 9000 : 5000 } = {}): ToastHandle {
    const el = frame(kind);
    let timer = 0;
    const close = () => { clearTimeout(timer); el.remove(); };
    body(el, kind, text);
    if (action) addAction(el, action, close);
    addClose(el, close);
    if (timeout > 0) {
      timer = window.setTimeout(close, timeout);
      // a pointer or focus on the toast holds it
      el.addEventListener('pointerenter', () => clearTimeout(timer));
      el.addEventListener('focusin', () => clearTimeout(timer));
    }
    return { el, close };
  }

  function progress(text: string, { onCancel = null as null | (() => void) } = {}): ProgressHandle {
    const el = frame('info');
    el.classList.add('rc-toast-progress');
    body(el, 'info', text);
    el.querySelector('svg.i')!.outerHTML = svg('loader').replace('class="i"', 'class="i rc-spin"');
    const bar = document.createElement('div');
    bar.className = 'rc-toast-bar';
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.setAttribute('aria-valuenow', '0');
    bar.setAttribute('aria-label', text);
    bar.innerHTML = '<span></span>';
    el.querySelector('.rc-toast-body')!.appendChild(bar);
    const detail = document.createElement('p');
    detail.className = 'rc-toast-detail';
    el.querySelector('.rc-toast-body')!.appendChild(detail);
    const close = () => el.remove();
    let cancel: HTMLButtonElement | null = null;
    if (onCancel) cancel = addAction(el, { label: 'Cancel', onClick: onCancel }, close, false);
    let lastPct = -1;
    return {
      el, close,
      update(fraction: number, t?: string) {
        const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
        (bar.firstElementChild as HTMLElement).style.width = `${pct}%`;
        if (pct !== lastPct) { bar.setAttribute('aria-valuenow', String(pct)); lastPct = pct; }
        if (t !== undefined) detail.textContent = t;
      },
      done(message: string, { kind = 'success' as ToastKind, action = null as ToastAction | null, timeout = 12000 } = {}) {
        el.remove();
        show(message, { kind, action, timeout });
        cancel = null;
      },
    };
  }

  return { show, progress };
}
