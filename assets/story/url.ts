// The tour's part of the address bar: ?family=<slug>&beat=<id or number> and ?family=<slug>&member=<id>.
//
// The player (assets/viewer.ts) already owns family, shot, t and tod and rewrites them with replaceState; the tour adds two
// parameters. `beat` it keeps current as the tour moves (when the player rewrites the address without it, a time-of-day change does, the
// director writes it back on its next tick: `sync`). `member` only says where a tour opens (the family's page links "Start with Sally"
// to it); it is read once, at boot, and is not kept in the address.
//
// A beat is named by its id (a link that survives a story edit that reorders the beats) or, in a hand-made link, by its
// 1-based number. The id of an unknown beat is ignored: the tour opens at the start. So does the id of an unknown member.
//
// Everything else in the address is not the tour's and is not the player's either (a campaign's utm_*, fbclid, ttclid, gclid and
// msclkid, anything a link carried): `foreignParams` names it, so a place that builds an address keeps it (the player's own url() does
// the same, in assets/viewer.ts; the end card's "Next family" does it here).
//
// Pure where it can be: the parsing functions touch no `location`, so scripts/test-story-url.mts runs them in Node.
import type { RuntimeBeat } from './runtime.js';

/** The parameters of the player and the tour. The same list is in assets/viewer.ts (url()); the test keeps the two equal. */
export const OWN_PARAMS: readonly string[] = ['mode', 'house', 'family', 'shot', 't', 'tod', 'play', 'beat', 'member'];

/** The beat a link asks for, as an index into `beats`, or -1. */
export function beatFromQuery(q: URLSearchParams, beats: Array<Pick<RuntimeBeat, 'id'>>): number {
  const v = q.get('beat');
  if (!v) return -1;
  const byId = beats.findIndex(b => b.id === v);
  if (byId >= 0) return byId;
  if (/^[0-9]{1,3}$/.test(v)) { const n = Number(v) - 1; if (n >= 0 && n < beats.length) return n; }
  return -1;
}

// ---- members: where "Start with <name>" opens ------------------------------------------------------------------------------
type ChapterLike = { id: string; kind: string; title?: string };
type BeatLike = { id: string; chapter: string; member?: string };

/**
 * The chapter that is a member's own room: where most of their beats are, not counting the first run and the closing (the first run
 * is everyone's, and the closing is nobody's); the earlier chapter wins a tie. A member with no beat of their own has none (null).
 * A shared room (the kitchen) is a member's own only when they have more beats there than anywhere else.
 */
export function memberChapter(chapters: ChapterLike[], beats: BeatLike[], member: string): ChapterLike | null {
  const counts = new Map<string, number>();
  for (const b of beats) if (b.member === member) counts.set(b.chapter, (counts.get(b.chapter) || 0) + 1);
  let best: ChapterLike | null = null, most = 0;
  for (const c of chapters) {
    if (c.kind === 'ftue' || c.kind === 'outro') continue;
    const n = counts.get(c.id) || 0;
    if (n > most) { best = c; most = n; }
  }
  return best;
}

/** The index of a member's first beat in their own chapter (see memberChapter), or -1: where "Start with <name>" opens the tour. */
export function memberBeat(chapters: ChapterLike[], beats: BeatLike[], member: string): number {
  const ch = memberChapter(chapters, beats, member);
  return ch ? beats.findIndex(b => b.member === member && b.chapter === ch.id) : -1;
}

/** The beat `?member=<id>` asks for, as an index into `beats`, or -1 (no such parameter, an id that is not a member of the family, a member with no beat of their own). */
export function memberFromQuery(q: URLSearchParams, members: Array<{ id: string }>, chapters: ChapterLike[], beats: BeatLike[]): number {
  const v = q.get('member');
  if (!v || !members.some(m => m.id === v)) return -1;
  return memberBeat(chapters, beats, v);
}

// ---- the rest of the address -------------------------------------------------------------------------------------------------
/** Every parameter of an address that is not the player's or the tour's, in the order it came (a repeated one stays repeated). */
export function foreignParams(search: string | URLSearchParams): [string, string][] {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const own = new Set(OWN_PARAMS);
  const out: [string, string][] = [];
  q.forEach((v, k) => { if (!own.has(k)) out.push([k, v]); });
  return out;
}

/** The player's address for a family's tour: `page` is the player's own file name as the address names it ("room-creator", or "room-creator.html" in a checkout), the rest of the address's parameters are kept. Relative, so it works at any depth the site is served at. */
export function tourHref(page: string, house: string, family: string, search: string | URLSearchParams = '', extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  q.set('mode', 'view'); q.set('house', house); q.set('family', family);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  for (const [k, v] of foreignParams(search)) q.append(k, v);
  return `./${page}?${q.toString()}`;
}

/** The family that follows `slug` among the families that have a tour (the manifest's order, round the end), or null when there is none but this one. */
export function nextTour(byFamily: Record<string, { house?: string; story?: string }>, slug: string): { slug: string; house: string } | null {
  const all = Object.keys(byFamily), at = all.indexOf(slug);
  const order = at < 0 ? all : [...all.slice(at + 1), ...all.slice(0, at)];
  const next = order.find(s => s !== slug && byFamily[s] && byFamily[s].story && byFamily[s].house);
  return next ? { slug: next, house: byFamily[next].house as string } : null;
}

// ---- the address bar (browser only) ------------------------------------------------------------------------------------------
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
