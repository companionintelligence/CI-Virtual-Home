// Build and check content/story/services.json, the registry of the services the stories' apps are the alternative to
// (reference/story/story-v3.md, "The registry").
//
//   content/story/services.json    authored facts (id, name, aliases, category, homepage and its check, link, flags, the alternative-to form,
//                                  the mark) and DERIVED columns that this script computes and the check verifies:
//   apps          the store apps that list the service in `replaces`. The catalog (content/story/catalog-apps.json, apps and excluded) is
//                 the source for every app it knows; the apps of the 2026-10-18 store scan that the catalog does not know are carried as
//                 they are (this script cannot reach the live store). The union, sorted.
//   storyApps     the catalog apps in `apps` that are not marked avoid (the apps a story may name)
//   storyStatus   ok when storyApps is not empty; excluded-only when every app is a catalog exclusion; else uncurated-only
//   incumbentNameList  the name or an alias holds a word of the incumbent-attack list of content/story/claims.json (only the neutral form may use it)
//   fleetHomes    the homes whose ledger names the service: a beat's `service`, else the names in its app.replaces
//   rank, top80   order by distinct apps (a duplicate listing counts once), then story apps, then usable before stale or story-excluded, then name;
//                 top80 is rank 80 or better. (The research seed also broke ties by the Portal alternatives file, which this repository does not hold.)
//
//   node --experimental-strip-types scripts/story/build-services.mts            recompute the derived columns and write the file
//   node --experimental-strip-types scripts/story/build-services.mts --check    exit 1 when the file differs from what the sources give, or an invariant fails
//   node --experimental-strip-types scripts/story/build-services.mts --stdout   print the file, write nothing
//
// Deterministic: no wall clock in the output (`generated` and `checked` are the file's own dates). The homepage age rule reads the clock
// (SERVICES_TODAY=YYYY-MM-DD overrides it for a test). Needs no network and no GPU.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_ID_PATTERN } from '../../assets/story/types.ts';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');

export const REGISTRY_CATEGORIES = ['ai', 'utilities', 'data', 'development', 'productivity', 'communication', 'creative', 'finance', 'notes', 'media', 'documents', 'identity', 'marketing', 'publishing', 'home', 'monitoring', 'network', 'travel', 'health', 'security', 'gaming', 'photos', 'books', 'food', 'commerce', 'automation'] as const;
const FLAGS = ['stale', 'story-excluded', 'ordinary-word', 'renamed'];
/** The second listing of a product that the store lists twice: it counts once in the rank. */
export const DUPLICATE_LISTINGS = new Set(['fireflyiii', 'agentzero', 'fish-speech-cpu', 'opencode-web']);
/** The homepage check of a service with `link: yes` is fresh for this many days (a warning from the first, an error from the second). */
export const HOMEPAGE_WARN_DAYS = 30;
export const HOMEPAGE_ERROR_DAYS = 90;
export const TOP = 80;

export interface RegistryService {
  id: string; name: string; aliases: string[]; category: string; homepage: string; homepageChecked: string; link: string; flags: string[];
  alternativeToForm: string; storyStatus: string;
  mark: { mode: string; glyph: string; logoAllowed: boolean; cleared: boolean; ownedFile: string | null; ownedKind: string };
  incumbentNameList: boolean; apps: string[]; storyApps: string[]; fleetHomes: string[]; rank: number; top80: boolean;
}
export interface RegistryFile { v: number; generated: string; checked: string; services: RegistryService[] }

interface CatalogEntry { id: string; replaces?: string[]; storySafe?: string; inLiveStore?: boolean }
interface FamilyLite { slug: string; beats: { id: string; service?: string; app?: { id: string; replaces?: string[] } }[] }
export interface Inputs { file: RegistryFile; catalog: CatalogEntry[]; excluded: CatalogEntry[]; incumbentWords: string[]; families: FamilyLite[]; portalServices: Set<string> }

const readJson = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));
/** "GitLab (SaaS)" -> "GitLab" */
const clean = (n: string): string => n.replace(/\s*\(.*?\)\s*/g, ' ').trim();
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Read every input from a repo root. */
export function readInputs(root: string = ROOT): Inputs {
  const S = (...p: string[]): string => path.join(root, 'content', 'story', ...p);
  const catalog = readJson(S('catalog-apps.json'));
  const claims = readJson(S('claims.json'));
  const pattern: string = claims.bannedPhrases.find((b: { id: string }) => b.id === 'incumbent-attack').pattern;
  const alt = pattern.match(/^\\b\((.*?)\)\\b/);
  const dir = path.join(root, 'content', 'families');
  const families: FamilyLite[] = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /^[a-z0-9][a-z0-9-]*\.json$/.test(f) && f !== 'films.json').sort().map((f) => readJson(path.join(dir, f)))
    : [];
  const svcDir = path.join(root, 'portal', 'services');
  const portalServices = new Set<string>(fs.existsSync(svcDir) ? fs.readdirSync(svcDir).map((f) => f.replace(/\.[^.]+$/, '')) : []);
  return {
    file: readJson(S('services.json')), catalog: catalog.apps, excluded: catalog.excluded ?? [],
    incumbentWords: alt ? alt[1].split('|') : [], families, portalServices,
  };
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const uniqSorted = (xs: Iterable<string>): string[] => [...new Set(xs)].sort(cmp);

/** The index that resolves a name (or an alias, or a name without its bracket) to a service. */
export function nameIndex(services: { id: string; name: string; aliases: string[] }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of services) for (const n of [s.name, ...s.aliases]) if (!m.has(n.toLowerCase())) m.set(n.toLowerCase(), s.id);
  return m;
}
const resolve = (idx: Map<string, string>, name: string): string | undefined => idx.get(name.toLowerCase()) ?? idx.get(clean(name).toLowerCase());

export interface Built { file: RegistryFile; problems: string[]; warnings: string[] }

/** Recompute the derived columns and check the invariants. The returned file is what the repository must hold. */
export function build(inp: Inputs, today: string = process.env.SERVICES_TODAY ?? new Date().toISOString().slice(0, 10)): Built {
  const problems: string[] = [];
  const warnings: string[] = [];
  const src = inp.file;
  const idx = nameIndex(src.services);

  // ---- what the catalog says each service is replaced by
  const live = (e: CatalogEntry): boolean => e.inLiveStore !== false;
  const catalogIds = new Set(inp.catalog.map((a) => a.id));
  const fromCatalog = new Map<string, Set<string>>();
  const unresolved = new Map<string, string[]>();
  for (const e of [...inp.catalog, ...inp.excluded]) {
    if (!live(e)) continue;
    for (const r of e.replaces ?? []) {
      const id = resolve(idx, r);
      if (!id) { unresolved.set(r, [...(unresolved.get(r) ?? []), e.id]); continue; }
      if (!fromCatalog.has(id)) fromCatalog.set(id, new Set());
      fromCatalog.get(id)!.add(e.id);
    }
  }
  for (const [name, ids] of unresolved) problems.push(`the catalog app${ids.length > 1 ? 's' : ''} ${ids.join(', ')} replace${ids.length > 1 ? '' : 's'} "${name}", which is not a service or alias in the registry`);
  const safe = new Set(inp.catalog.filter((a) => live(a) && a.storySafe !== 'avoid').map((a) => a.id));
  const excludedIds = new Set(inp.excluded.map((e) => e.id));

  // ---- the ledger of the homes
  const homes = new Map<string, Set<string>>();
  for (const f of inp.families) for (const b of f.beats) {
    const named = b.service ? [b.service] : (b.app?.replaces ?? []).flatMap((r) => { const id = resolve(idx, r); return id ? [id] : []; });
    for (const id of named) { if (!homes.has(id)) homes.set(id, new Set()); homes.get(id)!.add(f.slug); }
  }

  // ---- incumbent-attack names
  const wordRe = inp.incumbentWords.length ? new RegExp(`\\b(${inp.incumbentWords.map(escapeRe).join('|')})\\b`, 'i') : null;

  const derived = src.services.map((s) => {
    const apps = uniqSorted([...s.apps, ...(fromCatalog.get(s.id) ?? [])]);
    const storyApps = apps.filter((a) => catalogIds.has(a) && safe.has(a));
    const storyStatus = storyApps.length ? 'ok' : apps.length && apps.every((a) => excludedIds.has(a)) ? 'excluded-only' : 'uncurated-only';
    return {
      ...s, storyStatus, apps, storyApps,
      incumbentNameList: wordRe ? [s.name, ...s.aliases].some((n) => wordRe.test(n)) : s.incumbentNameList,
      fleetHomes: uniqSorted(homes.get(s.id) ?? []),
    };
  });
  const distinct = (s: { apps: string[] }): number => s.apps.filter((a) => !DUPLICATE_LISTINGS.has(a)).length;
  // at equal counts a service a story may name (not stale, not story-excluded, not a blocked form) comes before one it may not
  const usable = (s: { flags: string[]; alternativeToForm: string }): number => (s.flags.includes('stale') || s.flags.includes('story-excluded') || s.alternativeToForm === 'blocked' ? 1 : 0);
  const ranked = [...derived].sort((a, b) => distinct(b) - distinct(a) || b.storyApps.length - a.storyApps.length || usable(a) - usable(b) || cmp(a.name.toLowerCase(), b.name.toLowerCase()) || cmp(a.id, b.id));
  const rank = new Map(ranked.map((s, i) => [s.id, i + 1]));
  const services: RegistryService[] = derived.map((s) => ({ ...s, rank: rank.get(s.id)!, top80: rank.get(s.id)! <= TOP }));
  const file: RegistryFile = { v: src.v, generated: src.generated, checked: src.checked, services };

  // ---- invariants
  const seenId = new Set<string>();
  const owner = new Map<string, string>();
  const idRe = new RegExp(SERVICE_ID_PATTERN);
  const age = Math.round((Date.parse(today) - Date.parse(src.checked)) / 86_400_000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(src.checked ?? '') || Number.isNaN(age)) problems.push('`checked` must be the date of the homepage check, YYYY-MM-DD');
  for (const s of services) {
    const at = s.id;
    if (!idRe.test(s.id)) problems.push(`${at}: the id does not match ${SERVICE_ID_PATTERN}`);
    if (seenId.has(s.id)) problems.push(`${at}: duplicate id`);
    seenId.add(s.id);
    for (const n of [s.name, ...s.aliases]) {
      const k = n.toLowerCase();
      const o = owner.get(k);
      if (o && o !== s.id) problems.push(`${at}: the name or alias "${n}" is also the name or an alias of ${o} (names are unique case-insensitively across services)`);
      owner.set(k, s.id);
    }
    if (!(REGISTRY_CATEGORIES as readonly string[]).includes(s.category)) problems.push(`${at}: category "${s.category}" is not a registry category`);
    for (const f of s.flags) if (!FLAGS.includes(f)) problems.push(`${at}: unknown flag "${f}"`);
    if (!['yes', 'text-only', 'never'].includes(s.link)) problems.push(`${at}: link must be yes, text-only or never`);
    if (!['ok', 'review', 'blocked'].includes(s.alternativeToForm)) problems.push(`${at}: alternativeToForm must be ok, review or blocked`);
    if (!/^https:\/\//.test(s.homepage)) problems.push(`${at}: the homepage must be an https URL`);
    if (s.link === 'yes' && s.homepageChecked !== 'ok') problems.push(`${at}: link is yes but the homepage check says "${s.homepageChecked}" (a link needs an ok check)`);
    if (s.link === 'yes' && s.flags.includes('renamed')) problems.push(`${at}: a renamed service is text-only until the owner decides`);
    if (s.link === 'yes' && !Number.isNaN(age)) {
      if (age >= HOMEPAGE_ERROR_DAYS) problems.push(`${at}: the homepage check is ${age} days old (a link needs a check under ${HOMEPAGE_ERROR_DAYS} days); re-check the homepages`);
      else if (age >= HOMEPAGE_WARN_DAYS) warnings.push(`${at}: the homepage check is ${age} days old`);
    }
    const barred = s.flags.includes('stale') || s.flags.includes('story-excluded') || s.alternativeToForm === 'blocked';
    if (barred && s.mark.logoAllowed) problems.push(`${at}: logoAllowed must be false for a stale, story-excluded or blocked service`);
    if (s.mark.mode === 'logo') {
      if (!s.mark.logoAllowed || !s.mark.cleared) problems.push(`${at}: mark.mode is logo and the mark is not allowed and cleared`);
      if (!inp.portalServices.has(s.id)) problems.push(`${at}: mark.mode is logo and portal/services/${s.id}.(svg|png) does not exist`);
    }
    if (s.mark.cleared && !s.mark.logoAllowed) problems.push(`${at}: cleared is set on a mark that is not allowed`);
  }
  for (const f of inp.families) for (const b of f.beats) if (b.service && !seenId.has(b.service)) problems.push(`${f.slug}/${b.id}: service "${b.service}" is not in the registry`);
  return { file, problems, warnings };
}

// ---- the file's text: one line for a short array or a mark, one key per line, so a diff of the registry reads
const inline = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }`;
  return JSON.stringify(v);
};
export function render(f: RegistryFile): string {
  const rows = f.services.map((s) => `    {\n${Object.entries(s).map(([k, v]) => `      ${JSON.stringify(k)}: ${inline(v)}`).join(',\n')}\n    }`);
  return `{\n  "v": ${f.v},\n  "generated": ${JSON.stringify(f.generated)},\n  "checked": ${JSON.stringify(f.checked)},\n  "services": [\n${rows.join(',\n')}\n  ]\n}\n`;
}

function main(): void {
  const args = process.argv.slice(2);
  const file = path.join(ROOT, 'content', 'story', 'services.json');
  const built = build(readInputs());
  const text = render(built.file);
  for (const w of built.warnings) console.log(`warn: ${w}`);
  if (built.problems.length) console.error(built.problems.map((p) => `problem: ${p}`).join('\n'));
  if (args.includes('--stdout')) { process.stdout.write(text); process.exit(built.problems.length ? 1 : 0); }
  if (args.includes('--check')) {
    const have = fs.readFileSync(file, 'utf8');
    if (have !== text) { console.error('content/story/services.json is out of date (a derived column differs from the catalog and the families). Run: node --experimental-strip-types scripts/story/build-services.mts'); process.exit(1); }
    if (built.problems.length) process.exit(1);
    console.log(`services.json is current: ${built.file.services.length} services, ${built.file.services.filter((s) => s.fleetHomes.length).length} named by a home, ${built.warnings.length} warnings`);
    return;
  }
  fs.writeFileSync(file, text);
  console.log(`wrote content/story/services.json: ${built.file.services.length} services, ${built.file.services.filter((s) => s.top80).length} in the top ${TOP}, ${built.file.services.filter((s) => s.fleetHomes.length).length} named by a home`);
  if (built.problems.length) process.exit(1);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
