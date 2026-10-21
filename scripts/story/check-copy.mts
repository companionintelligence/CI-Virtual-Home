#!/usr/bin/env -S node --experimental-strip-types
// The copy lint (T3) and "the apps are real" (T4) over a built site, run by portal:test (the hooks leg), by ci.yml after portal:build, and usable alone:
//
//   node --experimental-strip-types scripts/story/check-copy.mts [dist] [--families <dir>] [--strict]
//
// T3  Every word a visitor can read on the built site goes through claims.json's banned-phrase rules (dashes, buzzwords, "log in", "chatbot",
//     "assistant", price and savings words, security absolutes, a claim the Core cannot make ...): the front page, each home's page, each family's
//     page, the 404, the player's HTML, every tour's data (dist/story/<slug>.json), the cards the front page reads and the strings of the player's
//     source (assets/viewer.ts, assets/story/**). Headings are sentence case and each kind of page carries the disclosures claims.json owes it.
//     The rules and the page list are in lib/site-copy.mts; a disclosure that claims.json owes and nothing prints yet is listed as pending, and
//     `--strict` (or CI_COPY_STRICT=1) makes it an error. Rules of severity `review` fail too unless the finding is in SITE_REVIEWED; `warn` prints.
//     A home's display name is the portal's own words and is not read by the two internal-id rules.
// T4  Every app a family names is in the Companion Hub catalog snapshot and in the live store.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT as REPO, readJson, loadAll } from './site-lib.mts';
import { siteCopy, readable, headingProblems, walkFiles, type SiteCopyResult } from './lib/site-copy.mts';
import { isV3Story } from './lib/v3.mts';

export { readable, headingProblems, walkFiles };

export type CopyArgs = { dir: string; root?: string; families?: string; strict?: boolean };

/** Everything the lint found, by severity: `errors` fail, `warnings` and `pending` are listed. */
export function copyReport({ dir, root = REPO, families, strict = process.env.CI_COPY_STRICT === '1' }: CopyArgs): SiteCopyResult {
  const res = siteCopy({ dir, root, strict });
  const manifest = readJson(path.join(dir, 'story', 'manifest.json'));
  // T4: the apps
  const L = loadAll(root, families ? path.resolve(families) : path.join(root, 'content', 'families'));
  for (const s of L.stories.filter(x => manifest.byFamily[x.slug])) {
    for (const b of s.beats) for (const id of [b.app?.id, ...(b.with || [])].filter(Boolean) as string[]) {
      const a = L.catalog[id];
      if (!a) res.errors.push(`${s.slug}/${b.id}: the app ${id} is not in the Companion Hub catalog`);
      else if ((a as any).inLiveStore === false) res.errors.push(`${s.slug}/${b.id}: the app ${id} is not in the live store`);
      else if ((a as any).storySafe === 'avoid') (isV3Story(s) ? res.errors : res.warnings).push(`${s.slug}/${b.id}: the app ${id} is marked storySafe: avoid${isV3Story(s) ? '' : ' (a warning until the family is told in the v3 shape)'}`);
    }
  }
  return res;
}

/** The errors alone: empty when the site is clean (what the tests and portal:test ask). */
export const copyLint = (args: CopyArgs): string[] => copyReport(args).errors;

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const dir = path.resolve(argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--families') || path.join(REPO, 'dist'));
  const fi = argv.indexOf('--families');
  const res = copyReport({ dir, families: fi >= 0 ? argv[fi + 1] : undefined, strict: argv.includes('--strict') || process.env.CI_COPY_STRICT === '1' });
  const list = (label: string, xs: string[], cap = 12): void => { if (xs.length) console.log(`  ${label} (${xs.length})\n${xs.slice(0, cap).map(x => `    ${x}`).join('\n')}${xs.length > cap ? `\n    ... and ${xs.length - cap} more` : ''}`); };
  const quiet = argv.includes('--quiet');
  if (!quiet) { list('warnings', res.warnings); list('pending (claims.json owes it, nothing prints it yet; --strict makes these errors)', res.pending); }
  const c = res.counts;
  if (res.errors.length) { console.error(res.errors.map(x => `  ✗ ${x}`).join('\n')); console.error(`copy lint: ${res.errors.length} error(s) in ${c.pages} pages, ${c.tours} tours and ${c.sourceStrings} source strings`); process.exit(1); }
  console.log(`copy lint: ${c.pages} pages, ${c.tours} tours, the card data and ${c.sourceStrings} strings of the player's source are clean (${res.warnings.length} warnings, ${res.pending.length} pending disclosures)`);
}
