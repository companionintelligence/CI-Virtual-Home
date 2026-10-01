// The tour's part of the address bar: ?family=<slug>&beat=<id or number>.
//
// The player (assets/viewer.ts) already owns family, shot, t and tod and rewrites them with replaceState; the tour adds one
// parameter, `beat`, and keeps it current as the tour moves. It never touches the others, and when the player rewrites the
// address without it (a time-of-day change does), the director writes it back on its next tick (`sync`).
//
// A beat is named by its id (a link that survives a story edit that reorders the beats) or, in a hand-made link, by its
// 1-based number. The id of an unknown beat is ignored: the tour opens at the start.
import type { RuntimeBeat } from './runtime.js';

/** The beat a link asks for, as an index into `beats`, or -1. */
export function beatFromQuery(q: URLSearchParams, beats: Array<Pick<RuntimeBeat, 'id'>>): number {
  const v = q.get('beat');
  if (!v) return -1;
  const byId = beats.findIndex(b => b.id === v);
  if (byId >= 0) return byId;
  if (/^[0-9]{1,3}$/.test(v)) { const n = Number(v) - 1; if (n >= 0 && n < beats.length) return n; }
  return -1;
}

/** Write `beat` into the address bar, keeping everything else, without adding a history entry. Returns whether it changed anything. */
export function writeBeat(id: string | null): boolean {
  try {
    const u = new URL(location.href);
    const cur = u.searchParams.get('beat');
    if ((id || null) === cur) return false;
    if (id) u.searchParams.set('beat', id); else u.searchParams.delete('beat');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    return true;
  } catch { return false; /* a sandboxed frame */ }
}

/** The beat the address bar names right now (the id, or null) */
export const beatInUrl = (): string | null => { try { return new URL(location.href).searchParams.get('beat'); } catch { return null; } };

/** The family's own page, which is what a shared link opens first: `family/<slug>` beside the player, with the beat if one is named. */
export function familyPageUrl(slug: string, beatId?: string | null): string {
  const u = new URL(`./family/${encodeURIComponent(slug)}`, location.href);
  if (beatId) u.searchParams.set('beat', beatId);
  return u.href;
}
