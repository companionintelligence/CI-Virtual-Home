// What the portal calls a home. The specs keep the Sims 4 gallery build's own title (content/houses/<id>.json
// `name`, which index.json copies): "Base Game Aurora", "BG Modern Asymmetry House", "The Palms Base Game Fix".
// Those are the builders' titles and stay the credit, but on a card, in the player and in a link preview they
// are noise to a visitor: "Base Game" is the game's own jargon (built with no expansion packs), and several of
// them are near twins ("Base Game Modern Home", "… Modern House", "… Modern House 1").
//
// displayName() is the one place that decides: a hand-picked name where the stripped title would be empty,
// generic or a twin of another (read from the home's style), else the title with the Sims jargon taken out.
// Used by the gallery (portal/gallery.js), the player (viewer.ts), room-creator.html's pre-mount loader and the
// share pages portal:build writes, so a home has one name everywhere. The spec's own title is buildName().

export type NamedHome = { id: string; name?: string };

// id → display name, where stripping alone would not do
const NAMES: Record<string, string> = {
  'asymmetry': 'Modern Asymmetry House',
  'bgfamily': 'Stone Gable House',          // white siding and grey stone under steep black gables
  'bghouse-olcia': 'Twin Gable House',      // "Base Game House": nothing left once the jargon goes
  'cutestarter': 'Cute Starter Cottage',
  'familyhome': 'Yellow Family Home',       // butter-yellow homestead; a twin of familyhouse-nora's name
  'familyhouse-nora': 'Split-Level Family House',
  'mediterranean': 'Mediterranean Villa',
  'modernhome-nora': 'Black Tower Modern',  // white box over a carport beside a tall black stair tower
  'modernhouse-nora': 'Modern Pavilion',    // low pavilion under opposing shed roofs
  'modernhouse1': 'Modern Studio House',    // cantilevered studio box and an A-frame fin
  'neweco': 'New Eco House',
  'onestory': 'Blue Dormer Cottage',        // "One-Story House" is a storey and a half
  'starter18k': 'Grey Starter Cottage',     // "Starter 18k 2/1": a build budget and a bed/bath count
};

// Sims gallery shorthand, as whole words: the pack ("Base Game", "Basegame", "BG"), a build budget ("18k"),
// a bed/bath count ("2/1"), "Fix" (a re-upload), and brackets left empty by the rest.
const JARGON = [/\bbase\s*game\b/gi, /\bbasegame\b/gi, /\bBG\b/g, /\b\d+k\b/gi, /\b\d\/\d\b/g, /\bfix\b/gi];

export function buildName(h: NamedHome): string {
  return (h.name || h.id || '').trim();
}

export function displayName(h: NamedHome): string {
  if (h.id && NAMES[h.id]) return NAMES[h.id];
  let s = buildName(h);
  for (const re of JARGON) s = s.replace(re, ' ');
  s = s.replace(/\(\s*\)/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-:·,]+|[\s\-:·,]+$/g, '').trim();
  if (!s || /^(the\s+)?(house|home)$/i.test(s)) s = (h.id || 'Home').replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
  return s;
}

// The credit line's tooltip: the build's own title and who made it, when the display name differs from it.
export function buildCredit(h: NamedHome & { author?: string }): string {
  const own = buildName(h);
  const by = h.author ? ` by ${h.author}` : '';
  return own && own !== displayName(h) ? `After the Sims 4 build “${own}”${by}` : h.author ? `After a Sims 4 build${by}` : '';
}
