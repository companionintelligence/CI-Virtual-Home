// Prop registry store — kept apart from index.js so category modules can import it without a cycle
// (index.js imports the categories; the categories import this).
export const PROPS: Map<string, any> = new Map();
// `defaults` is what a whole category has in common — plants.js marks its props foliage, so the scene QA
// knows a bounding box is a poor stand-in for their shape.
export function registerProps(defs: Record<string, any>, defaults: any = {}) {
  for (const [type, def] of Object.entries(defs)) {
    if (!def || typeof def.create !== 'function' || !Array.isArray(def.footprint)) throw new Error(`prop "${type}": needs create() and footprint [w, d]`);
    PROPS.set(type, { height: 0.8, surface: false, params: [], tags: [], foliage: false, ...defaults, ...def });
  }
}
export const propTypes = () => [...PROPS.keys()];

