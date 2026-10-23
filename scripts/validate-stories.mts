#!/usr/bin/env -S node --experimental-strip-types
// The story gate: every authored family file (content/families/<slug>.json) against the schema, the voice, the claims,
// the catalog and its own house. Writers run it per family; CI runs it through test-stories.mts; the integration runs
// it with --complete.
//
//   pnpm run story:validate                         every content/families/*.json (none yet is a pass, with a note)
//   pnpm run story:validate -- vance-takahashi      one family by slug
//   pnpm run story:validate -- path/to/family.json  one file by path (fixtures, work in progress)
//   pnpm run story:validate -- --fleet              also the cross-family metrics (uniqueness gates; counts are informational)
//   pnpm run story:validate -- --complete           every casting slug must have a family file and the fleet counts gate (implies --fleet)
//   pnpm run story:validate -- --strict-families    a casting family without a content/families/<slug>.json is an error, not a note
//                                                   (CI_STORY_STRICT=1 does the same; the same switch as portal:build's, scripts/story/site.mts)
//   ... --json                                      the same result as JSON on stdout (no other output)
//   ... --world <dir>                               read casting.json and houses/ from <dir> instead of content/story and content/houses
//                                                   (a file inside test/fixtures/stories picks that folder's `world/` by itself)
//
// Exit 1 on any error, and on any `review` finding that is not on content/story/reviewed.json. Warnings print and never fail.
// A family the casting plan names that has no file yet (the plan is ahead of the writers: the six apartments were cast before their stories were
// written) is a NOTE on a whole-set run, because that is the ordinary state of a re-cast; it is an error under --strict-families, which is
// where the whole cast must be there (the production deploy). Validating one family or one file by name says nothing about the others.
// The rule catalogue, the fixes and how to add a rule: reference/story/validator.md. Needs no GPU and no network.
import fs from 'node:fs';
import path from 'node:path';
import { loadContext, ROOT } from './story/lib/context.mts';
import { validateStory } from './story/lib/validate.mts';
import { checkSchema } from './story/lib/schema-lite.mts';
import { fleetMetrics, renderFleet, type FleetResult } from './story/lib/fleet.mts';
import { checkCategories, loadCategories, repoRules } from './story/lib/categories.mts';
import type { Finding, Report } from './story/lib/report.mts';
import type { Story } from '../assets/story/types.ts';

// a bare `--` (from `pnpm run story:validate -- <file>`) is only the separator
const argv = process.argv.slice(2).filter((a) => a !== '--');
const flag = (n: string): boolean => argv.includes(`--${n}`);
const JSON_OUT = flag('json');
const COMPLETE = flag('complete');
const FLEET = flag('fleet') || COMPLETE;
const STRICT = flag('strict-families') || process.env.CI_STORY_STRICT === '1';
const worldAt = argv.indexOf('--world');
const worldArg = worldAt >= 0 ? argv[worldAt + 1] : undefined;
if (worldAt >= 0 && (!worldArg || worldArg.startsWith('--'))) { console.error('--world needs a directory'); process.exit(2); }
const positional = argv.filter((a, i) => !a.startsWith('--') && !(worldAt >= 0 && i === worldAt + 1));
for (const a of argv) if (a.startsWith('--') && !['--json', '--complete', '--fleet', '--strict-families', '--world'].includes(a)) { console.error(`unknown flag ${a}\nusage: story:validate [-- <slug|file>...] [--json] [--complete] [--fleet] [--strict-families] [--world <dir>]`); process.exit(2); }

const FAMILIES = path.join(ROOT, 'content', 'families');
// content/families also holds generated files (<slug>.voice.json, <slug>.bake.json) and films.json; an authored file is <slug>.json
const NOT_AUTHORED = new Set(['films']);
const authored = (): string[] => (fs.existsSync(FAMILIES) ? fs.readdirSync(FAMILIES).filter((f) => /^[a-z0-9][a-z0-9-]*\.json$/.test(f) && !NOT_AUTHORED.has(f.replace(/\.json$/, ''))).sort().map((f) => path.join(FAMILIES, f)) : []);

// A world is a stand-in for the shipped casting and houses (test/fixtures/stories/world). It is used when asked for, and when
// every file named is in a folder that has a world/casting.json beside it (the fixtures); a family in content/families never is.
const worldFor = (file: string): string | null => { const w = path.join(path.dirname(file), 'world'); return fs.existsSync(path.join(w, 'casting.json')) ? w : null; };
const fileArgs = positional.filter((a) => /\.json$/.test(a) || a.includes('/')).map((a) => path.resolve(process.cwd(), a));
const autoWorlds = new Set(fileArgs.map(worldFor));
const world = worldArg ? path.resolve(process.cwd(), worldArg) : fileArgs.length === positional.length && autoWorlds.size === 1 ? [...autoWorlds][0] : null;
if (world && !fs.existsSync(path.join(world, 'casting.json'))) { console.error(`no casting.json in ${world}`); process.exit(2); }
const ctx = loadContext(ROOT, world ? { world } : {});
const rel = (p: string): string => path.relative(ROOT, p) || p;

interface Item { file: string; data: unknown; parseError?: string }
function readItem(file: string): Item {
  try { return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) }; }
  catch (e) { return { file, data: null, parseError: (e as Error).message }; }
}

// ---- which files to validate
let targets: string[];
const notFound: string[] = [];
if (positional.length) {
  targets = positional.map((a) => {
    const asPath = path.resolve(process.cwd(), a);
    if (/\.json$/.test(a) || a.includes('/')) return asPath;
    return path.join(FAMILIES, `${a}.json`);
  });
  for (const t of targets) if (!fs.existsSync(t)) notFound.push(t);
  targets = targets.filter((t) => fs.existsSync(t));
} else targets = authored();

const results: { file: string; report: Report | null; parseError?: string }[] = targets.map((file) => {
  const item = readItem(file);
  return item.parseError ? { file, report: null, parseError: item.parseError } : { file, report: validateStory(item.data, ctx) };
});

// ---- the casting's families that have no file yet. Only a whole-set run says it: naming a family or a file asks about that one.
// A note by default, an error under --strict-families (see the header): the plan is allowed to be ahead of the writers.
const castSlugs = ctx.casting.families.map((f) => f.slug);
const castingWithoutFile: string[] = positional.length ? [] : (() => {
  const have = new Set(results.map((r) => r.report?.slug ?? path.basename(r.file, '.json')));
  return castSlugs.filter((s) => !have.has(s));
})();
const castingNote = castingWithoutFile.length
  ? `casting family without a file: ${castingWithoutFile.join(', ')} (${castingWithoutFile.length} of ${castSlugs.length} in casting.json have no content/families/<slug>.json yet; --strict-families makes this an error)`
  : '';

// ---- the fleet: every authored file in content/families that has the right shape
let fleet: FleetResult | null = null;
if (FLEET) {
  const stories: Story[] = authored().map(readItem).filter((i) => !i.parseError && checkSchema(i.data, ctx.schema).length === 0).map((i) => i.data as Story);
  fleet = fleetMetrics(stories, ctx, { complete: COMPLETE });
}

// ---- the front page's categories (content/story/categories.json): every archetype in exactly one, labels and blurbs in the house voice.
// It is not a family, so it is checked on every run; a world (fixtures) is the family's, the categories are the repository's own.
function categoryProblems(): string[] {
  if (world) return [];
  try { return checkCategories(loadCategories(ROOT), repoRules(ROOT)); }
  catch (e) { return [`content/story/categories.json could not be read: ${(e as Error).message}`]; }
}

// ---- totals
const count = (k: 'errors' | 'review' | 'warn' | 'allowed'): number => results.reduce((n, r) => n + (r.report ? r.report[k].length : 0), 0);
const problems: string[] = [
  ...ctx.reviewedProblems,
  ...categoryProblems(),
  ...notFound.map((f) => `no such family file: ${rel(f)}`),
  ...results.filter((r) => r.parseError).map((r) => `${rel(r.file)} is not valid JSON: ${r.parseError}`),
  ...(STRICT ? castingWithoutFile.map((s) => `casting family without a file: ${s} is in casting.json but has no content/families/${s}.json`) : []),
  ...(fleet ? fleet.findings.filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.message}`) : []),
];
const fleetWarnings: Finding[] = fleet ? fleet.findings.filter((f) => f.severity === 'warn') : [];
const ok = count('errors') === 0 && count('review') === 0 && problems.length === 0;

if (JSON_OUT) {
  const finding = (f: Finding) => ({ rule: f.rule, at: f.at, message: f.message, ...(f.fix ? { fix: f.fix } : {}) });
  console.log(JSON.stringify({
    ok,
    totals: { families: results.length, errors: count('errors'), review: count('review'), warnings: count('warn'), allowed: count('allowed'), problems: problems.length },
    families: results.map((r) => ({
      slug: r.report?.slug ?? null, file: rel(r.file),
      errors: r.report?.errors.map(finding) ?? [], review: r.report?.review.map(finding) ?? [], warnings: r.report?.warn.map(finding) ?? [], allowed: r.report?.allowed.map(finding) ?? [],
      stats: r.report?.stats ?? null,
    })),
    problems,
    casting: { families: castSlugs.length, withoutFile: castingWithoutFile, strict: STRICT },
    fleet: fleet ? { families: fleet.families, complete: fleet.complete, metrics: fleet.metrics, warnings: fleetWarnings.map(finding) } : undefined,
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

if (!results.length && !positional.length) console.log('No family files yet: content/families is empty, which is a pass. Writers add content/families/<slug>.json.');
for (const r of results) {
  if (!r.report) continue;
  const rep = r.report;
  console.log(`${rep.slug}  (${rel(r.file)})`);
  for (const [label, list] of [['ERROR ', rep.errors], ['REVIEW', rep.review], ['warn  ', rep.warn]] as const) {
    for (const f of list) { console.log(`  ${label} ${rep.line(f)}`); if (f.fix) console.log(`           fix: ${f.fix}`); }
  }
  for (const f of rep.allowed) console.log(`  allowed ${rep.line(f)} (reviewed)`);
  console.log(`  ${rep.errors.length || rep.review.length ? 'FAIL' : 'OK'}: ${rep.errors.length} errors, ${rep.review.length} review, ${rep.warn.length} warnings` + (rep.stats.filmSec ? `   [${rep.stats.beats} beats, film ~${rep.stats.filmSec} s, ${rep.stats.filmWords} spoken words]` : ''));
}
for (const p of problems) console.log(`ERROR  ${p}`);
if (castingNote && !STRICT) console.log(`note   ${castingNote}`);
for (const f of fleetWarnings) console.log(`warn   ${f.rule} ${f.message}`);
if (fleet) console.log(`\n${renderFleet(fleet)}`);
console.log(`\n${ok ? 'story:validate OK' : 'story:validate FAILED'}: ${results.length} family file${results.length === 1 ? '' : 's'}, ${count('errors') + problems.length} errors, ${count('review')} review, ${count('warn')} warnings, ${count('allowed')} allow-listed`);
process.exit(ok ? 0 : 1);
