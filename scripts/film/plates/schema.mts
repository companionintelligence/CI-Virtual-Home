// A zero-dependency checker for the JSON Schema keywords the kit's plates schema (virtual-home-plates.schema.json, a copy of CI-Common packages/video-kit/schema/) uses, so a manifest can be
// held to the contract without the kit installed (the repository has no runtime dependencies beyond three.js tooling). A keyword outside the list is reported: a schema that grew something
// no checker here enforces must not pass quietly (scripts/story/lib/schema-lite.mts makes the same promise for the family schema; this one adds `oneOf`, `definitions`, `exclusiveMinimum` and `multipleOf`).
//
// The contract is `packages/video-kit/PLATES.md` and the kit's code is what is enforced; the schema is "for editors". The mirror is a second line: a manifest that fails it is wrong, and one that passes it
// is not thereby right (the kit's own checks are the first line: scripts/film/wrap.mts runs them through `ci-video import-home`).
export type Schema = { [key: string]: any };
const KEYWORDS = new Set(['$schema', '$id', '$ref', '$comment', 'definitions', 'title', 'description', 'default', 'type', 'enum', 'const', 'required', 'properties', 'additionalProperties', 'items', 'minItems', 'maxItems',
  'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum', 'multipleOf', 'oneOf']);

export function checkPlates(data: unknown, root: Schema): string[] {
  const errs: string[] = [];
  const resolve = (s: Schema): Schema => {
    while (s && s.$ref) {
      let t: any = root;
      for (const k of String(s.$ref).replace(/^#\//, '').split('/')) t = t?.[k];
      if (!t) { errs.push(`schema: unresolved $ref ${s.$ref}`); return {}; }
      const { $ref: _r, ...rest } = s; s = { ...t, ...rest };
    }
    return s;
  };
  const isType = (v: any, t: string): boolean => t === 'null' ? v === null : t === 'array' ? Array.isArray(v) : t === 'integer' ? Number.isInteger(v) : t === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v) : typeof v === t;
  // returns the problems of v against s (so oneOf can try each branch without touching the shared list)
  const check = (v: any, s0: Schema, at: string): string[] => {
    const s = resolve(s0), out: string[] = [];
    for (const k of Object.keys(s)) if (!KEYWORDS.has(k)) out.push(`${at}: the schema uses the keyword ${k}, which this checker does not enforce`);
    if (s.oneOf) {
      const results = s.oneOf.map((b: Schema) => check(v, b, at)), ok = results.filter((r: string[]) => !r.length).length;
      if (ok !== 1) out.push(`${at}: matches ${ok} of the ${s.oneOf.length} shapes it may have (${results.map((r: string[]) => r[0] || 'ok').join(' | ')})`);
    }
    if (s.type) { const ts = [].concat(s.type); if (!ts.some(t => isType(v, t))) return [...out, `${at}: is ${v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v}, not ${ts.join(' or ')}`]; }
    if ('const' in s && JSON.stringify(v) !== JSON.stringify(s.const)) out.push(`${at}: must be ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.some((e: any) => JSON.stringify(e) === JSON.stringify(v))) out.push(`${at}: must be one of ${s.enum.join(', ')}`);
    if (typeof v === 'string') {
      if (s.minLength !== undefined && v.length < s.minLength) out.push(`${at}: shorter than ${s.minLength}`);
      if (s.maxLength !== undefined && v.length > s.maxLength) out.push(`${at}: longer than ${s.maxLength}`);
      if (s.pattern && !new RegExp(s.pattern).test(v)) out.push(`${at}: ${JSON.stringify(v)} does not match ${s.pattern}`);
    }
    if (typeof v === 'number') {
      if (s.minimum !== undefined && v < s.minimum) out.push(`${at}: below ${s.minimum}`);
      if (s.maximum !== undefined && v > s.maximum) out.push(`${at}: above ${s.maximum}`);
      if (s.exclusiveMinimum !== undefined && !(v > s.exclusiveMinimum)) out.push(`${at}: not above ${s.exclusiveMinimum}`);
      if (s.multipleOf !== undefined && Math.abs(v / s.multipleOf - Math.round(v / s.multipleOf)) > 1e-9) out.push(`${at}: not a multiple of ${s.multipleOf}`);
    }
    if (Array.isArray(v)) {
      if (s.minItems !== undefined && v.length < s.minItems) out.push(`${at}: fewer than ${s.minItems} items`);
      if (s.maxItems !== undefined && v.length > s.maxItems) out.push(`${at}: more than ${s.maxItems} items`);
      if (s.items) v.forEach((x, i) => out.push(...check(x, s.items, `${at}[${i}]`)));
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const k of s.required || []) if (!(k in v)) out.push(`${at}: missing ${k}`);
      for (const [k, x] of Object.entries(v)) {
        if (s.properties && k in s.properties) out.push(...check(x, s.properties[k], `${at}.${k}`));
        else if (s.additionalProperties === false) out.push(`${at}: unknown field "${k}" (the contract is closed)`);
        else if (s.additionalProperties && typeof s.additionalProperties === 'object') out.push(...check(x, s.additionalProperties, `${at}.${k}`));
      }
    }
    return out;
  };
  errs.push(...check(data, root, 'plates.json'));
  return errs;
}
