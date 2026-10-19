// Who a home is, on every public surface: the one place the player (assets/viewer.ts) gets a name, a place, a
// title, an address in the address bar, a share link, a poster and the words of its errors.
//
// The site is about thirty FICTIONAL families, not about the builds the specs were written from, so a visitor never
// sees a home's name, a builder, a source reference or the internal id the specs and the goldens are keyed by. The
// public build (scripts/story/site.mts) hands the page the family list, and this module turns an entry of it into
// the strings the player shows. Keeping it all here means every attribution or identity edit in viewer.ts is a
// one-line call, and the merge with the graphics branch (which edits viewer.ts elsewhere) stays trivial.
//
// Two modes, told by window.__VH_PUBLIC (the build writes it into dist/room-creator.html, nothing else does):
//   public    room-creator.html?mode=view&family=<slug>. The player's "house id" IS the slug: the head script
//             (room-creator.html) builds window.__vhIndex from the family list, `{ houses: [{ id: slug, title,
//             address, thumb }] }`, sets window.__vhWant to the slug the address asks for, and loadHouse(slug) fetches the sanitised spec by the URL the manifest
//             names (window.__vhSpecUrl). The internal id appears in no URL, no text and no attribute.
//   checkout  room-creator.html?mode=view&house=<id>, as before, for development and the perf tools. No family
//             list exists there, so an entry is the bare id and the title is the id, spelled out. Still no credit.
//
// Browser only (it reads window); no THREE and no imports, so any module can take it.

export type Entry = {
  id: string;
  /** "The Okafor-Reyes family" (public). Absent in a checkout. */
  title?: string;
  /** "14 Larkfield Lane, Marlow Bend" (public) */
  address?: string;
  /** the hashed thumbnail, relative to the site root (public) */
  thumb?: string;
  storeys?: number;
  areaSqm?: number;
};

/** The disclosure that is on screen wherever a family is (claims.json disclosures, id fictional-family). */
export const FICTIONAL_LINE = 'Fictional family. Real software.';
export const SITE_SUFFIX = 'Companion Core';

const w = (): any => (typeof window === 'undefined' ? {} : window);
export const isPublic = (): boolean => !!w().__VH_PUBLIC;

const spell = (id: string): string => id.replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());

/** The title of a family or, in a checkout, of a home: the H1 of the player, the tab and the loader. */
export function title(e: Entry | null | undefined): string {
  if (!e) return 'Loading';
  return e.title || (isPublic() ? 'Family' : spell(e.id));
}
/** The two parts of the line under the title: the address, then the disclosure (public); the id's facts (checkout). */
export function metaParts(e: Entry | null | undefined): [string, string] {
  if (!e) return ['', ''];
  if (isPublic()) return [e.address || '', FICTIONAL_LINE];
  return [[e.storeys ? `${e.storeys} ${e.storeys === 1 ? 'storey' : 'storeys'}` : '', e.areaSqm ? `${e.areaSqm} m²` : ''].filter(Boolean).join(' · '), ''];
}
export const metaLine = (e: Entry | null | undefined): string => metaParts(e).filter(Boolean).join(' · ');
/** The tab title: `<title> · Companion Core`. */
export const pageTitle = (name: string): string => `${name} · ${SITE_SUFFIX}`;

/** Write the id into the player's query: `family=<slug>` on the public site, `house=<id>` in a checkout. */
export function setId(q: URLSearchParams, id: string): void {
  q.set(isPublic() ? 'family' : 'house', id);
}
/**
 * What the player is asked to open. Public: the slug the head script settled on (window.__vhWant, set once the family
 * list is in: the `family` parameter, or an old `house` link looked up by its hash), or null when the address names
 * nothing the site has. Checkout: `house`, else aurora.
 */
export function wantId(params: URLSearchParams): string | null {
  if (isPublic()) return w().__vhWant ?? null;
  return params.get('house') || 'aurora';
}
/**
 * The link the share button hands out. Public: the family's own page (a static page with the family's title,
 * description and picture for link previews, which forwards to the tour when the query carries a moment).
 * Checkout: the player's own address, as before. `playerUrl` is the player's URL with t, shot and tod in it.
 */
export function shareUrl(id: string, playerUrl: string): string {
  const abs = new URL(playerUrl, location.href);
  if (!isPublic()) return abs.href;
  const q = new URLSearchParams(abs.search);
  q.delete('mode'); q.delete('family'); q.delete('house');
  return new URL(`./family/${encodeURIComponent(id)}?${q.toString()}`, location.href).href;
}
/** The loader's poster for a family, absolute (the head script sets it for the first one). Empty when it has none. */
export function poster(e: Entry | null | undefined): string {
  return e && e.thumb ? new URL(`./${e.thumb}`, location.href).href : '';
}
/** Where the player's "back" and "see all" go. */
export const LIST_HREF = './index.html#families';

/** The words of every error the player can show. None of them repeats what the address said. */
export const errors = {
  unknown: 'There is no family at this address. Pick one from the list.',
  notLoaded: 'This family did not load. Check the connection and try again.',
  notOpened: 'That family could not be opened. Pick another from the list.',
  stillOk: 'That family could not be opened.',
  noShots: 'This home has no camera shots.',
  broke: 'Something went wrong while opening this family.',
} as const;
