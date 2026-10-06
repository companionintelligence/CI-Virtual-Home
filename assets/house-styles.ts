// House styles — the furniture style bundles the composer (assets/room-composer.ts) furnishes a room in: which
// catalog types suit it (their placement `styles`, assets/props/placement.ts), a curated fabric / wood / accent
// palette a room's colours are drawn from, the rug patterns and art motifs it uses, and finish hints for S2's
// per-room finishes. Published for every other consumer as content/house-styles.json (pnpm run catalog writes it;
// test-room-composer.mts fails when the two drift).
//
// A room's style: rooms[].style, else spec.styleKey, else read off the spec's free-text `style` ("farmhouse",
// "mid-century" …) by styleFromText, else 'modern'. THREE-free, so the composer runs in Node.
//
// Colours are muted, product-render colours (the kit's restraint band), because a colour the composer sets on an
// item is kept as authored (kit-build.ts themeItem skips an item with `color`).
//
// Owner: S3 (compose).

export interface StyleBundle {
  key: string;
  label: string;
  /** the furniture style tags a catalog type's placement `styles` is matched against (the key itself first) */
  tags: string[];
  /** upholstery, linen and cushions */
  fabric: string[];
  /** table tops, frames, case goods */
  wood: string[];
  /** cushions, rugs, art */
  accent: string[];
  /** hardware and lamp bases */
  metal: 'black' | 'brass' | 'chrome' | 'bronze' | 'steel';
  /** patterned-rug patterns, in order of preference */
  rugs: string[];
  /** wall-art motifs (the motif library in assets/props/soft.ts), in order of preference */
  art: string[];
  /** hints for per-room finishes (S2 rooms[].floor / walls): floor kinds and wall treatments that suit the style */
  finish: { floor: string[]; wall: string[]; kitchenTop: string; cabinet: string[] };
}

export const STYLES: Record<string, StyleBundle> = {
  modern: {
    key: 'modern', label: 'Modern', tags: ['modern', 'contemporary'],
    fabric: ['#d9d6d0', '#8c8f93', '#3f4650', '#b9b2a6', '#6b7078'], wood: ['#2e2622', '#6f5a48', '#c4b19a'], accent: ['#7a8f86', '#a8715a', '#4b5d73'],
    metal: 'black', rugs: ['solid', 'border', 'abstract'], art: ['abstract', 'geometric', 'line', 'landscape'],
    finish: { floor: ['oak', 'concrete', 'tile'], wall: ['paint'], kitchenTop: 'quartz', cabinet: ['#24272b', '#efede8', '#8a8580'] },
  },
  farmhouse: {
    key: 'farmhouse', label: 'Farmhouse', tags: ['farmhouse', 'traditional', 'rustic'],
    fabric: ['#e8e2d6', '#c9bfae', '#9aa596', '#7d8b99', '#b8a58c'], wood: ['#9c7f62', '#7d6147', '#c4b19a'], accent: ['#6d8a74', '#8b5e3c', '#4f6b85'],
    metal: 'black', rugs: ['check', 'stripe', 'border'], art: ['botanical', 'landscape', 'animal', 'sunset'],
    finish: { floor: ['oak', 'herringbone'], wall: ['board-and-batten', 'paint'], kitchenTop: 'butcher', cabinet: ['#efede8', '#8b978e', '#3a4656'] },
  },
  cottage: {
    key: 'cottage', label: 'Cottage', tags: ['cottage', 'traditional', 'farmhouse'],
    fabric: ['#efe6da', '#d8c3b5', '#a9b8a0', '#b6c4d1', '#e3d3b8'], wood: ['#c4b19a', '#9c7f62', '#e1d5c3'], accent: ['#b56a6a', '#6f8f6a', '#5f7fa8'],
    metal: 'brass', rugs: ['medallion', 'stripe', 'dots'], art: ['botanical', 'seascape', 'landscape', 'animal'],
    finish: { floor: ['oak', 'carpet'], wall: ['wallpaper', 'wainscot'], kitchenTop: 'marble', cabinet: ['#dcd7cf', '#a9b8a0', '#efede8'] },
  },
  mediterranean: {
    key: 'mediterranean', label: 'Mediterranean', tags: ['mediterranean', 'traditional', 'rustic'],
    fabric: ['#e9dfcf', '#cdb99c', '#a6795a', '#c7b299', '#7f8c6a'], wood: ['#5b4636', '#7d6147', '#6f5a48'], accent: ['#b8603a', '#3f6a8a', '#8a7a3a'],
    metal: 'bronze', rugs: ['kilim', 'medallion', 'border'], art: ['landscape', 'seascape', 'abstract', 'sunset'],
    finish: { floor: ['terracotta', 'stone', 'tile'], wall: ['paint'], kitchenTop: 'terrazzo', cabinet: ['#efede8', '#6f5a48', '#8b978e'] },
  },
  'mid-century': {
    key: 'mid-century', label: 'Mid-century', tags: ['mid-century', 'modern', 'scandi'],
    fabric: ['#c98b4a', '#6f7f5a', '#3f5d73', '#d8cbb4', '#8a5a3a'], wood: ['#8b5a3c', '#6f4a30', '#a0714a'], accent: ['#d1943a', '#3b6e6a', '#b5553a'],
    metal: 'brass', rugs: ['diamond', 'abstract', 'solid'], art: ['geometric', 'abstract', 'sunburst', 'line'],
    finish: { floor: ['oak', 'herringbone'], wall: ['paint'], kitchenTop: 'terrazzo', cabinet: ['#8b5a3c', '#efede8', '#3f5d73'] },
  },
  industrial: {
    key: 'industrial', label: 'Industrial', tags: ['industrial', 'modern', 'rustic'],
    fabric: ['#5a534c', '#8b8a86', '#3a3d40', '#a39a8b', '#6b4a36'], wood: ['#5b4636', '#3a2e27', '#7d6147'], accent: ['#a0522d', '#5c6b73', '#b08d57'],
    metal: 'steel', rugs: ['solid', 'kilim', 'border'], art: ['map', 'line', 'abstract', 'geometric'],
    finish: { floor: ['concrete', 'oak'], wall: ['painted-brick', 'paint'], kitchenTop: 'concrete', cabinet: ['#24272b', '#3f3a33', '#8a8580'] },
  },
  scandi: {
    key: 'scandi', label: 'Scandinavian', tags: ['scandi', 'modern', 'mid-century'],
    fabric: ['#ecebe7', '#cfcac1', '#a9b0a8', '#8d99a3', '#d8cfc2'], wood: ['#c4b19a', '#d9c8ae', '#b39c7e'], accent: ['#7f9a8a', '#c28a6e', '#5a6b7a'],
    metal: 'black', rugs: ['stripe', 'diamond', 'solid'], art: ['line', 'botanical', 'landscape', 'geometric'],
    finish: { floor: ['oak', 'white-oak'], wall: ['paint'], kitchenTop: 'stone', cabinet: ['#efede8', '#dcd7cf', '#8b978e'] },
  },
  tropical: {
    key: 'tropical', label: 'Tropical', tags: ['tropical', 'mediterranean', 'cottage'],
    fabric: ['#e8e0cc', '#b9c4a0', '#7f9a6a', '#d6b98c', '#5f7f6a'], wood: ['#7d6147', '#9c7f62', '#c4a57a'], accent: ['#3f7f6a', '#c47a4a', '#d1a13a'],
    metal: 'bronze', rugs: ['stripe', 'solid', 'kilim'], art: ['botanical', 'seascape', 'abstract', 'sunset'],
    finish: { floor: ['oak', 'stone', 'deck'], wall: ['paint'], kitchenTop: 'stone', cabinet: ['#efede8', '#7d6147', '#8b978e'] },
  },
  craftsman: {
    key: 'craftsman', label: 'Craftsman', tags: ['craftsman', 'traditional', 'rustic'],
    fabric: ['#8b6a4a', '#6f7a5a', '#a8956f', '#5a4a3a', '#c2ae8a'], wood: ['#6f4a30', '#5b4636', '#7d5a3a'], accent: ['#7a3a2a', '#4f6a4a', '#b08d57'],
    metal: 'bronze', rugs: ['medallion', 'border', 'kilim'], art: ['landscape', 'botanical', 'map', 'animal'],
    finish: { floor: ['oak', 'herringbone'], wall: ['wainscot', 'paint'], kitchenTop: 'butcher', cabinet: ['#5b4636', '#8b978e', '#efede8'] },
  },
};
export const STYLE_KEYS = Object.keys(STYLES);

// free-text style → key: the specs describe themselves ("Single-storey brick cottage …", "desert villa …"). Each style
// scores the words it finds (a strong word counts 3, a weak one 1) and the highest score wins, ties going to the
// earlier style here; nothing scoring at all is null. An architectural word (gable, hip) says nothing about furniture.
const WORDS: Array<[string, Array<[RegExp, number]>]> = [
  ['mid-century', [[/mid-?century|\bmcm\b|atomic|eichler|sixties|split-level|raised ranch/i, 3], [/\branch\b|caramel|walnut|teak|retro/i, 1]]],
  ['craftsman', [[/craftsman|bungalow|arts[- ]and[- ]crafts|prairie|tudor|mission/i, 3], [/timber-frame|stone chimney|exposed beam/i, 1]]],
  ['tropical', [[/tropical|treehouse|bali|jungle|beach|palm/i, 3], [/\beco\b|stilt|lantern|lagoon|atrium|planted|thatch|bamboo/i, 1]]],
  ['mediterranean', [[/mediterranean|spanish|tuscan|adobe|hacienda|terracotta/i, 3], [/villa|stucco|desert|mesa|arch(?:ed|es)?\b|pavilion|courtyard/i, 1]]],
  ['farmhouse', [[/farmhouse|barn|homestead|cape cod|queen anne|colonial/i, 3], [/rustic|country|clapboard|traditional|family|lap-siding|dormer/i, 1]]],
  ['cottage', [[/cottage|storybook|english|cabin/i, 3], [/lake|shingle|board-and-batten|gable|porch|garden/i, 0.5]]],
  ['industrial', [[/industrial|warehouse|brutal|\bloft\b/i, 3], [/concrete|steel|corrugated|black-framed|exposed/i, 1]]],
  ['scandi', [[/scandi|nordic|scandinavian|hygge/i, 3], [/minimal|white-oak|pale timber|birch/i, 1]]],
  ['modern', [[/modern|contemporary/i, 3], [/glass|cube|flat|floating|cantilever|curtain-wall|sleek|slab|box/i, 1]]],
];
export function styleFromText(text: unknown): string | null {
  const s = String(text || ''); let best: string | null = null, top = 0;
  for (const [key, rules] of WORDS) {
    let sc = 0; for (const [re, w] of rules) if (re.test(s)) sc += w;
    if (sc > top) { top = sc; best = key; }
  }
  return best;
}

/** the style a room is furnished in */
export function styleOf(spec: any, room?: any): StyleBundle {
  const key = (room && room.style) || (spec && spec.styleKey) || styleFromText(spec && spec.style) || 'modern';
  return STYLES[key] || STYLES.modern;
}
