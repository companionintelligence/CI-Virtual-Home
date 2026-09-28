// QA surfacing (plan §6 P0 3): the editor runs the page's own gates once a home is built — scene QA
// (window.__houseSceneQA) and shot QA for each of the home's shots (window.__houseShotQA; v2 when S5's planner
// lands, the same shape) — and shows what they found: a badge with the error and warning counts (errors in heat,
// the one place the UI uses it; warnings in chart-4), a panel listing every issue, and markers on the timeline.
// An issue with a time jumps the timeline there.

export type QaIssue = { level: 'error' | 'warn'; code: string; message: string; shot: string | null; t: number | null; tEnd: number | null; subject?: string };
export type QaReport = { scene: { errors: any[]; warnings: any[] } | null; shots: Record<string, { errors: any[]; warnings: any[] } | { failed: string }> };

/** Flatten the gates' results into one list: errors first, then warnings; within each, the scene's and then each
 *  shot's in the order given, by time. */
export function collectIssues(report: QaReport): QaIssue[] {
  const out: QaIssue[] = [];
  const take = (list: any[], level: 'error' | 'warn', shot: string | null) => {
    for (const e of list || []) out.push({ level, code: e.code, message: e.message || '', shot, t: typeof e.t === 'number' ? e.t : null, tEnd: typeof e.tEnd === 'number' ? e.tEnd : null, subject: e.subject || '' });
  };
  if (report.scene) { take(report.scene.errors, 'error', null); take(report.scene.warnings, 'warn', null); }
  for (const [shot, r] of Object.entries(report.shots)) {
    if ('failed' in r) { out.push({ level: 'error', code: 'qa-failed', message: r.failed, shot, t: null, tEnd: null }); continue; }
    take(r.errors, 'error', shot); take(r.warnings, 'warn', shot);
  }
  const shotOrder = [null, ...Object.keys(report.shots)];
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1) || shotOrder.indexOf(a.shot) - shotOrder.indexOf(b.shot) || (a.t ?? -1) - (b.t ?? -1));
}
export const qaCounts = (issues: QaIssue[]) => ({ errors: issues.filter(i => i.level === 'error').length, warnings: issues.filter(i => i.level === 'warn').length });

const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const svg = (name: string) => `<svg class="i" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

/** The panel's list. `label(shot)` names a shot; `duration(shot)` gives its length for the time readout; onJump(shot, t)
 *  is called when an issue with a time is chosen. */
export function renderQaList(el: HTMLElement, issues: QaIssue[], { label, duration, onJump, pending = false }: {
  label: (shot: string) => string; duration: (shot: string) => number; onJump: (shot: string, t: number) => void; pending?: boolean;
}) {
  if (pending) { el.innerHTML = `<p class="qa-empty">${svg('loader').replace('class="i"', 'class="i rc-spin"')}Checking the home…</p>`; return; }
  if (!issues.length) { el.innerHTML = `<p class="qa-empty">${svg('check')}No issues: every shot and the scene pass.</p>`; return; }
  el.innerHTML = '';
  const ul = document.createElement('ul');
  ul.className = 'qa-list';
  for (const i of issues) {
    const li = document.createElement('li');
    li.className = `qa-item qa-${i.level}`;
    const where = i.shot ? label(i.shot) : 'Scene';
    const secs = i.shot && i.t !== null ? i.t * duration(i.shot) : null;
    const when = secs !== null ? `${secs.toFixed(1)} s` : '';
    const text = `<span class="qa-code">${esc(i.code)}</span><span class="qa-where">${esc(where)}${when ? ' · ' + when : ''}</span><span class="qa-msg">${esc(i.message)}</span>`;
    const icon = svg(i.level === 'error' ? 'alert' : 'info');
    if (i.shot && i.t !== null) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'qa-jump';
      b.innerHTML = icon + `<span class="qa-text">${text}</span>`;
      b.setAttribute('aria-label', `${i.level === 'error' ? 'Error' : 'Warning'} ${i.code} in ${where} at ${when}: jump there`);
      b.addEventListener('click', () => onJump(i.shot!, i.t!));
      li.appendChild(b);
    } else li.innerHTML = `<div class="qa-static">${icon}<span class="qa-text">${text}</span></div>`;
    ul.appendChild(li);
  }
  el.appendChild(ul);
}
