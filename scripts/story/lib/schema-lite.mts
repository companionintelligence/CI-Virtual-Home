// A zero-dependency JSON Schema checker for the keyword subset that content/story/schema/family.schema.json uses
// (STORY-BIBLE section 12): $schema $id $ref $defs $comment title description type enum const required properties
// additionalProperties items minItems maxItems minLength maxLength pattern minimum maximum.
//
// WHY it exists instead of ajv: the repo has no runtime dependencies beyond three.js tooling and CI installs with a
// frozen lockfile; a 40-line walker over a closed keyword list is enough, runs under plain node, and makes the schema
// self-policing: a keyword outside the list is reported (the schema author used something no checker here enforces,
// which would silently weaken the contract). The schema was also checked under ajv 8 strict when it was written.

const KEYWORDS = new Set(['$schema', '$id', '$ref', '$defs', '$comment', 'title', 'description', 'type', 'enum', 'const', 'required', 'properties', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum']);

export type Schema = { [key: string]: any };

const regexCache = new Map<string, RegExp>();
// ajv compiles patterns with the u flag; do the same, and fall back to no flag for a pattern the u flag rejects.
function patternRe(p: string): RegExp {
  let re = regexCache.get(p);
  if (!re) {
    try { re = new RegExp(p, 'u'); } catch { re = new RegExp(p); }
    regexCache.set(p, re);
  }
  return re;
}

export function checkSchema(data: unknown, root: Schema): string[] {
  const errs: string[] = [];
  const resolve = (s: Schema): Schema => {
    while (s && s.$ref) {
      let t: any = root;
      for (const k of String(s.$ref).replace(/^#\//, '').split('/')) t = t?.[k];
      if (!t) { errs.push(`schema: unresolved $ref ${s.$ref}`); return {}; }
      // sibling keywords of a $ref (a description, say) are kept; the referenced keywords come first
      const { $ref: _ref, ...rest } = s;
      s = { ...t, ...rest };
    }
    return s;
  };
  const walk = (v: any, s0: Schema, at: string): void => {
    const s = resolve(s0);
    for (const k of Object.keys(s)) if (!KEYWORDS.has(k)) errs.push(`${at}: schema uses unsupported keyword ${k}`);
    if ('const' in s && v !== s.const) errs.push(`${at}: must equal ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.includes(v)) errs.push(`${at}: must be one of ${s.enum.join(', ')} (got ${JSON.stringify(v)})`);
    if (s.type) {
      const actual = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
      const ok = actual === s.type || (s.type === 'integer' && typeof v === 'number' && Number.isInteger(v)) || (s.type === 'number' && typeof v === 'number');
      if (!ok) { errs.push(`${at}: expected ${s.type}, got ${actual}`); return; }
    }
    if (typeof v === 'string') {
      if (s.minLength != null && v.length < s.minLength) errs.push(`${at}: shorter than ${s.minLength} characters (${v.length})`);
      if (s.maxLength != null && v.length > s.maxLength) errs.push(`${at}: longer than ${s.maxLength} characters (${v.length})`);
      if (s.pattern && !patternRe(s.pattern).test(v)) errs.push(`${at}: does not match ${s.pattern}`);
    }
    if (typeof v === 'number') {
      if (s.minimum != null && v < s.minimum) errs.push(`${at}: below ${s.minimum}`);
      if (s.maximum != null && v > s.maximum) errs.push(`${at}: above ${s.maximum}`);
    }
    if (Array.isArray(v)) {
      if (s.minItems != null && v.length < s.minItems) errs.push(`${at}: fewer than ${s.minItems} items (${v.length})`);
      if (s.maxItems != null && v.length > s.maxItems) errs.push(`${at}: more than ${s.maxItems} items (${v.length})`);
      if (s.items) v.forEach((x, i) => walk(x, s.items, `${at}[${i}]`));
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const k of s.required || []) if (!(k in v)) errs.push(`${at}: missing ${k}`);
      for (const k of Object.keys(v)) {
        if (s.properties && k in s.properties) walk(v[k], s.properties[k], `${at}.${k}`);
        else if (s.additionalProperties === false) errs.push(`${at}: unknown property ${k}`);
      }
    }
  };
  walk(data, root, '$');
  return errs;
}

/** Every keyword the schema file uses, for the test that keeps the schema inside the supported subset. */
export function schemaKeywordsUsed(root: Schema): Set<string> {
  const used = new Set<string>();
  const walk = (s: any, isMap: boolean): void => {
    if (!s || typeof s !== 'object') return;
    if (Array.isArray(s)) { s.forEach((x) => walk(x, false)); return; }
    for (const [k, v] of Object.entries(s)) {
      if (isMap) { walk(v, false); continue; }                    // a map of names -> schemas (properties, $defs): keys are names
      used.add(k);
      if (k === 'properties' || k === '$defs') walk(v, true);
      else if (k === 'items' || k === 'additionalProperties') walk(v, false);
    }
  };
  walk(root, false);
  return used;
}

export const SUPPORTED_KEYWORDS = KEYWORDS;
