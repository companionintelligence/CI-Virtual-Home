// What the portal calls a home. The spec files in the repository (content/houses/<id>.json `name`, which index.json copies)
// keep the title each home was first filed under, with its pack tag, budget or bed/bath shorthand: that is an internal
// record, and on a card, in the player and in a link preview it is noise, and several of the titles are near twins.
//
// displayName() is the one place that decides: a hand-picked name where the stripped title would be empty, generic, a twin
// of another or read as a typo (read from the home's style), else the title with the shorthand taken out. Used by the
// gallery (portal/gallery.js), the player (viewer.ts), room-creator.html's pre-mount loader and the pages portal:build writes,
// so a home has one name everywhere. portal:build also writes it as the `name` of the specs it ships
// (scripts/portal-redact.mts), so the files the site serves never carry the repository's title; displayName of a display name
// is itself.
//
// No builder is named on the site: the specs' `author` and `source` fields stay in the repository as internal records and are
// redacted from what is shipped.

export type NamedHome = { id: string; name?: string };

// id → display name, where stripping alone would not do. The six apartments (city-one-bed, corner-penthouse, garden-flat, studio-loft,
// two-bed-flat, walkup-duplex: Companion Intelligence's own, reference/APARTMENTS.md) are pinned although their filed titles are already
// clean, so a later edit of a spec's title never moves the name a visitor, a link and a search result already know.
const NAMES: Record<string, string> = {
  'asymmetry': 'Modern Asymmetry House',
  'bgfamily': 'Stone Gable House',          // white siding and grey stone under steep black gables
  'bghouse-olcia': 'Twin Gable House',      // nothing is left of the filed title once the shorthand goes
  'city-one-bed': 'City One-Bedroom',
  'corner-penthouse': 'Corner Penthouse',
  'cutestarter': 'Cute Starter Cottage',
  'familyhome': 'Yellow Family Home',       // butter-yellow homestead; a twin of familyhouse-nora's name
  'familyhouse-nora': 'Split-Level Family House',
  'garden-flat': 'Garden Flat',
  'mediterranean': 'Mediterranean Villa',
  'modernhome-nora': 'Black Tower Modern',  // white box over a carport beside a tall black stair tower
  'modernhouse-nora': 'Modern Pavilion',    // low pavilion under opposing shed roofs
  'modernhouse1': 'Modern Studio House',    // cantilevered studio box and an A-frame fin
  'neweco': 'New Eco House',
  'onestory': 'Blue Dormer Cottage',        // "One-Story House" is a storey and a half
  'palnknoll': 'Palm Knoll',                // "Paln Knoll of Ermosa" reads as a typo to a visitor; palms on a knoll
  'starter18k': 'Grey Starter Cottage',     // a build budget and a bed/bath count
  'studio-loft': 'Warehouse Loft',          // (reference/APARTMENTS.md: a name no family's words contain)
  'two-bed-flat': 'Two-Bedroom Flat',
  'walkup-duplex': 'Walk-up Duplex',
};

// The shorthand a filed title carries, as whole words: the pack tag, a build budget ("18k"), a bed/bath count ("2/1"),
// "Fix" (a re-upload), and brackets left empty by the rest. (The first pattern also takes the spelling with no space.)
const JARGON = [/\bbase\s*game\b/gi, /\bBG\b/g, /\b\d+k\b/gi, /\b\d\/\d\b/g, /\bfix\b/gi];

export function displayName(h: NamedHome): string {
  if (h.id && NAMES[h.id]) return NAMES[h.id];
  let s = (h.name || h.id || '').trim();
  for (const re of JARGON) s = s.replace(re, ' ');
  s = s.replace(/\(\s*\)/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-:·,]+|[\s\-:·,]+$/g, '').trim();
  if (!s || /^(the\s+)?(house|home)$/i.test(s)) s = (h.id || 'Home').replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
  return s;
}
