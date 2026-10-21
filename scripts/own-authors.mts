// Who is not a "builder". The specs' `author` field is read as a builder handle by the site's credit rule (scripts/portal-redact.mts: no
// shipped file may contain one) and by the story's leak scan (scripts/story/check-leaks.mts: no family text may name one). A home that
// Companion Intelligence wrote itself (the apartments, reference/APARTMENTS.md) is credited to the company, and the company's own name
// is on every page of the site, so it is not a handle and neither scan may treat it as one.
//
// This is NOT an allowlist for a person or a pack: GUARD_ALLOW stays empty. It is the one name that is the site's own, matched whole
// (case-insensitive, trimmed), so "Companion Intelligence Fan" or "ci-original" are still handles. Add a name here only for the company.
export const OWN_AUTHORS: readonly string[] = ['Companion Intelligence'];

/** True when `author` is the company's own name (a home it wrote itself), not a builder's handle. */
export const isOwnAuthor = (author: unknown): boolean =>
  typeof author === 'string' && OWN_AUTHORS.some(o => o.toLowerCase() === author.trim().toLowerCase());
