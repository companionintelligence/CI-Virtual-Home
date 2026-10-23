// What the company validator reads, loaded once: the schema, the claims' ban list (and the site lint's extra ones), the catalog, the registry of replaced services, the twelve
// functions, the merged roles table, the company names and the names the fleet already uses. Every path resolves from the repository root, so any cwd works.
import fs from 'node:fs';
import path from 'node:path';
import type { Schema } from '../schema-lite.mts';
import { reviewKey, type ReviewedEntry } from '../report.mts';
import { ROOT, type Ban, type CatalogApp, type ClaimsFile, type Service } from '../context.mts';
import { EXTRA_BANS } from '../extra-bans.mts';
import { functionsFor, rolesFor, type FunctionDef } from '../kinds.mts';
import type { RolesTable } from '../../../../assets/story/roles.ts';

export { ROOT };
export interface CompanyNames { deny: string[]; proposals: { slug: string; name: string; size: string; building: string }[] }
export interface CoCtx {
  root: string;
  schema: Schema; claims: ClaimsFile; bans: Ban[];
  apps: Map<string, CatalogApp>; services: { byId: Map<string, Service>; byName: Map<string, Service> };
  functions: FunctionDef[]; roles: RolesTable; names: CompanyNames;
  /** lower case: the families' slugs, their surnames, the first names and companion names the families use, and the ids of every spec in content/houses */
  familySlugs: Set<string>; familySurnames: Set<string>; familyFirstNames: Set<string>; familyCompanions: Set<string>; houseIds: Set<string>;
  reviewedList: ReviewedEntry[]; reviewed: Set<string>;
}

const J = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));

/**
 * The office's own banned phrases, beside the claims' (the claims canon is not edited for them): a pair reads "<app>, alternative to <service>", and no company text says "replaces"
 * (owner decision O7 and story v3; the store's own `replaces` rows are data, not words a visitor reads).
 */
const OFFICE_BANS: Ban[] = [{
  id: 'co-replaces', pattern: '\\breplaces\\b', flags: 'i', severity: 'error',
  why: 'A pair reads "<app>, alternative to <service>": no text of a company says an app "replaces" a service (owner decision O7, story v3).',
  fix: 'Say "alternative to", or say what the person does now.', re: /\breplaces\b/i,
}];

export function loadCompanyContext(root: string = ROOT): CoCtx {
  const S = path.join(root, 'content', 'story');
  const claims: ClaimsFile = J(path.join(S, 'claims.json'));
  const catalog = J(path.join(S, 'catalog-apps.json')) as { apps: CatalogApp[] };
  const services = J(path.join(S, 'services.json')) as { services: Service[] };
  const casting = J(path.join(S, 'casting.json')) as { families: { slug: string; surname: string }[] };
  const bans: Ban[] = [
    ...claims.bannedPhrases.map((b) => ({ ...b, re: new RegExp(b.pattern, b.flags) })),
    ...EXTRA_BANS.filter((e) => !claims.bannedPhrases.some((b) => b.id === e.id)).map((e) => ({ id: e.id, pattern: e.pattern, flags: e.flags, severity: e.severity, why: e.why, fix: e.fix, re: new RegExp(e.pattern, e.flags) })),
    ...OFFICE_BANS,
  ];
  const svc = { byId: new Map<string, Service>(), byName: new Map<string, Service>() };
  for (const sv of services.services) { svc.byId.set(sv.id, sv); for (const n of [sv.name, ...sv.aliases]) svc.byName.set(n.toLowerCase(), sv); }
  const reviewedFile = path.join(S, 'reviewed.json');
  const reviewedList: ReviewedEntry[] = fs.existsSync(reviewedFile) ? J(reviewedFile) : [];
  const reviewed = new Set(reviewedList.filter((e) => e && e.slug && e.at && e.rule && e.by).map((e) => reviewKey(e.slug, e.at, e.rule)));
  // the people of the families (content/families/<slug>.json): first names and companion names are unique across the fleet
  const familyFiles = fs.existsSync(path.join(root, 'content', 'families')) ? fs.readdirSync(path.join(root, 'content', 'families')).filter((f) => /^[a-z0-9][a-z0-9-]*\.json$/.test(f) && !/(\.bake|\.voice)\.json$/.test(f) && f !== 'films.json') : [];
  const first = new Set<string>(), comp = new Set<string>();
  for (const f of familyFiles) {
    try { const st = J(path.join(root, 'content', 'families', f)); for (const m of st.members ?? []) { if (m.name) first.add(String(m.name).toLowerCase()); if (m.companion?.name) comp.add(String(m.companion.name).toLowerCase()); } } catch { /* a file that is not a story is the family validator's to report */ }
  }
  const housesDir = path.join(root, 'content', 'houses');
  const houseIds = new Set(fs.existsSync(housesDir) ? fs.readdirSync(housesDir).filter((f) => f.endsWith('.json') && f !== 'index.json' && !f.endsWith('.plan.json')).map((f) => f.replace(/\.json$/, '').toLowerCase()) : []);
  return {
    root, schema: J(path.join(S, 'schema', 'company.schema.json')), claims, bans,
    apps: new Map(catalog.apps.map((a) => [a.id, a])), services: svc, functions: functionsFor(), roles: rolesFor('company'), names: J(path.join(S, 'company-names.json')),
    familySlugs: new Set([...casting.families.map((f) => f.slug.toLowerCase()), ...familyFiles.map((f) => f.replace(/\.json$/, ''))]),
    familySurnames: new Set(casting.families.map((f) => String(f.surname).toLowerCase())), familyFirstNames: first, familyCompanions: comp, houseIds,
    reviewedList, reviewed,
  };
}
