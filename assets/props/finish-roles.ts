// Finish roles — one table of what each material ROLE looks like, as numbers (plan 5.2 L0, light-and-finish 4.7).
//
// Data only: no THREE, no import, no side effect, so Node tests, the baker (scripts/bake) and any builder can read it. It is the
// single answer to "how rough is a cushion, how shiny is brass": procedural props, the softkit, the dress-kit and baked models are
// meant to agree with it (IDENT's R-MAT rule). Nothing in the product reads it yet (L0 changes no pixel); later LIGHT tasks wire the
// metal rows (F1) and the other streams adopt the rest as they land. Owner: LIGHT. Every other stream reads it, never edits it.
//
// A row is { rough, metal } for the PBR material plus, where it matters, `albedoCap` (the brightest sRGB luma-ish channel a surface
// of this role may carry: pure white has no fold or shadow to read and clips at dusk, so linen stops at 0.80), `opaque` (no alpha
// card: GTAO's normal pre-pass turns a cut-out leaf into a solid quad) and `glow` (the role is a light source, driven by lampGain).
export interface FinishRole {
  /** MeshStandardMaterial.roughness */
  rough: number;
  /** MeshStandardMaterial.metalness */
  metal: number;
  /** the albedo (0..1, max channel) a surface of this role is held under; omitted = no cap */
  albedoCap?: number;
  /** true: never an alpha-tested or transparent material (leaf cards break the AO pre-pass) */
  opaque?: boolean;
  /** true: an emissive source tagged userData.fixture and scaled by the lamp gain */
  glow?: boolean;
  /** what it is for, in a few words */
  note: string;
}

export const FINISH_ROLES = {
  fabric: { rough: 0.92, metal: 0, note: 'upholstery, cushions, curtains' },
  fabric2: { rough: 0.9, metal: 0, note: 'the second fabric of a house' },
  linen: { rough: 0.9, metal: 0, albedoCap: 0.80, note: 'sheets, towels, shades: a soft white, never 0.95' },
  rug: { rough: 0.95, metal: 0, note: 'rugs and mats' },
  leather: { rough: 0.55, metal: 0, note: 'leather and vinyl seating (fabric2 darkened)' },
  wood: { rough: 0.55, metal: 0, note: 'oiled and matte timber' },
  lacquer: { rough: 0.35, metal: 0, note: 'painted and lacquered case goods (the cabinet role)' },
  ceramic: { rough: 0.3, metal: 0, note: 'toilet, basin, tub, enamel cookware, vases' },
  glass: { rough: 0.04, metal: 0, note: 'window and shower glass: transparent, kept out of the AO pass' },
  rubber: { rough: 0.7, metal: 0, note: 'rubber and black plastic: appliances, cables, bins' },
  leaf: { rough: 0.8, metal: 0, opaque: true, note: 'foliage: closed, opaque lens leaves, never an alpha card' },
  emissive: { rough: 0.5, metal: 0, glow: true, note: 'lamp shades, cans, window glow: userData.fixture and lampGain' },
} as const satisfies Record<string, FinishRole>;
export type FinishRoleName = keyof typeof FINISH_ROLES;

// ---- metals: one kind per house (house-styles.ts StyleBundle.metal, wired by the scheme), architecture metal stays black ----
export interface MetalKind {
  /** sRGB hex of the base colour */
  color: number;
  rough: number;
  metal: number;
  /** envMapIntensity: the sky IBL is faint indoors, so brass and chrome need a lift to read as metal at 720p */
  env: number;
}
export const METAL_KINDS = {
  black: { color: 0x2b2f33, rough: 0.35, metal: 0.75, env: 1 },
  brass: { color: 0xb8964f, rough: 0.26, metal: 1, env: 1.8 },
  chrome: { color: 0xc9ced4, rough: 0.1, metal: 1, env: 1.8 },
  bronze: { color: 0x6b4c36, rough: 0.32, metal: 0.95, env: 1.8 },
  steel: { color: 0x8d9399, rough: 0.3, metal: 1, env: 1.8 },
} as const satisfies Record<string, MetalKind>;
export type MetalKindName = keyof typeof METAL_KINDS;
export const METAL_KIND_NAMES = Object.keys(METAL_KINDS) as MetalKindName[];
/** a style's `metal` (or anything else) to a known kind: unknown and absent are black, today's constant */
export const metalKindOf = (k: unknown): MetalKindName => (typeof k === 'string' && k in METAL_KINDS ? (k as MetalKindName) : 'black');
