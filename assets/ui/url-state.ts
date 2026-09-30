// The editor's URL state (plan §6 P0 4): ?house=&shot=&t=&lighting=&mode= round-trips, so a link reopens the same
// home, shot, moment, time of day and mode. mode is 'review' or 'edit' — 'view' is the portal's player, which this
// module never writes. Every other parameter a URL carries (res, aspect, tone, preset, flythrough …) is kept as it is.

export type UiMode = 'review' | 'edit';
export type UiState = { house?: string | null; shot?: string | null; t?: number | null; lighting?: string | null; mode?: UiMode | null };
const ORDER = ['house', 'shot', 't', 'lighting', 'mode'] as const;

export function readUiState(search: string): UiState {
  const q = new URLSearchParams(search);
  const t = q.has('t') ? Number(q.get('t')) : null;
  const mode = q.get('mode');
  return {
    house: q.get('house'),
    shot: q.get('shot'),
    t: t !== null && Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : null,
    lighting: q.get('lighting'),
    mode: mode === 'review' || mode === 'edit' ? mode : null,
  };
}

/** The query string for `state` over `search`: the five keys first, in order (null or '' removes one), then the rest. */
export function stateSearch(search: string, state: UiState): string {
  const q = new URLSearchParams(search), out = new URLSearchParams();
  const merged: Record<string, string | null> = {};
  for (const k of ORDER) merged[k] = q.get(k);
  for (const k of ORDER) if (k in state) {
    const v = (state as any)[k];
    merged[k] = v === null || v === undefined || v === '' ? null : k === 't' ? String(+(+v).toFixed(3)) : String(v);
  }
  for (const k of ORDER) if (merged[k] !== null) out.set(k, merged[k]!);
  q.forEach((v, k) => { if (!(ORDER as readonly string[]).includes(k)) out.append(k, v); });
  const s = out.toString();
  return s ? `?${s}` : '';
}

/** Write `state` into the address bar without a navigation (history.replaceState). Returns the new search. */
export function writeUiState(state: UiState): string {
  const search = stateSearch(location.search, state);
  if (search !== location.search) history.replaceState(history.state, '', `${location.pathname}${search}${location.hash}`);
  return search;
}
