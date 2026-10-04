// Canonical JSON and the hashes the bake records. Shared by bake.mts (writes outSha256), emit-ts.mts and scripts/test-baked.mts
// (recompute it from the committed module), so "the committed bytes are the baked bytes" has exactly one definition.
import crypto from 'node:crypto';

/** JSON with every object's keys sorted, no whitespace: the same value always prints the same bytes. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

export const sha256 = (s: string | Uint8Array): string => crypto.createHash('sha256').update(s).digest('hex');

/** The record's own hash: the sha256 of its canonical JSON without its `sha` field. */
export function recordSha(rec: Record<string, unknown>): string {
  const { sha: _sha, ...rest } = rec;
  return sha256(canonical(rest));
}
