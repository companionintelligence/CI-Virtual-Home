// The publish-day catalog re-check, as pure functions (no network, no git): compare content/story/catalog-apps.json with
// the live store listing and the HUB/CI-Marketplace manifests. scripts/story/build-catalog-snapshot.mts does the I/O and
// calls these; scripts/test-stories.mts calls them with synthetic data.
//
// The catalog is curated (storySafe, caveats, agent link, QA status are judgements made by reading each manifest), so
// this never regenerates it from the API. It answers three questions a snapshot must answer on the day a story goes
// live: is every app a story can name still in the production store, did a manifest change what the app replaces, and
// what is new in the store that a writer might want to curate next.
import type { CatalogFile } from './context.mts';

export interface LiveApp { id: string; title?: string; name?: string; available?: boolean }
export interface Manifest { id: string; name?: string; available?: boolean; visibility?: string; replaces?: string[] }

export interface CatalogDiff {
  /** in the catalog, not in the live store listing: a story naming it would send a customer to a missing app */
  removed: string[];
  /** in the catalog, in the live store, but the manifest on main is dev_only or unavailable (the store is ahead of main; re-check) */
  notOnMain: string[];
  /** in the catalog and the store, no manifest found at all (file-browser and runtipi are known to be like this) */
  noManifest: string[];
  /** the manifest names the app differently from the catalog */
  renamed: { id: string; catalog: string; manifest: string }[];
  /** catalog `replaces` names the manifest no longer lists: a chip claiming them would be wrong */
  replacesDropped: { id: string; names: string[] }[];
  /** live store apps that are neither curated into the catalog nor on its excluded / not-in-store lists: candidates to curate */
  newInStore: string[];
  /** apps the catalog lists as not in the store that the live store now has */
  nowInStore: string[];
  liveCount: number;
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export function diffCatalog(catalog: CatalogFile, live: LiveApp[], manifests: Map<string, Manifest>): CatalogDiff {
  const liveIds = new Set(live.map((a) => a.id));
  const known = new Set<string>([...catalog.apps.map((a) => a.id), ...(catalog.excluded ?? []).map((a) => a.id)]);
  const notInStore = new Set((catalog.notInStore?.apps ?? []).map((a) => a.id));
  const d: CatalogDiff = { removed: [], notOnMain: [], noManifest: [], renamed: [], replacesDropped: [], newInStore: [], nowInStore: [], liveCount: liveIds.size };
  for (const a of catalog.apps) {
    if (!liveIds.has(a.id)) { d.removed.push(a.id); continue; }
    const m = manifests.get(a.id);
    if (!m) { d.noManifest.push(a.id); continue; }
    if (m.available === false || m.visibility === 'dev_only') d.notOnMain.push(a.id);
    if (m.name && norm(m.name) !== norm(a.name) && !(a.id === 'ci-openclaw' && /openclaw/i.test(m.name))) d.renamed.push({ id: a.id, catalog: a.name, manifest: m.name });
    if (m.replaces) {
      const have = new Set(m.replaces.map(norm));
      const gone = a.replaces.filter((r) => !have.has(norm(r)));
      if (gone.length) d.replacesDropped.push({ id: a.id, names: gone });
    }
  }
  for (const id of liveIds) if (!known.has(id) && !notInStore.has(id)) d.newInStore.push(id);
  for (const id of notInStore) if (liveIds.has(id)) d.nowInStore.push(id);
  for (const k of ['removed', 'notOnMain', 'noManifest', 'newInStore', 'nowInStore'] as const) d[k].sort();
  return d;
}

/** Does the diff mean a story could be wrong today? (new apps and renames are information; the rest is not.) */
export const diffBlocks = (d: CatalogDiff): boolean => d.removed.length > 0 || d.replacesDropped.length > 0;

/** The catalog with the machine-checkable fields refreshed: `inLiveStore` per app and the snapshot date. Curated fields are untouched. */
export function applyDiff<T extends CatalogFile>(catalog: T, live: LiveApp[], date: string): T {
  const liveIds = new Set(live.map((a) => a.id));
  const out: T = JSON.parse(JSON.stringify(catalog));
  for (const a of out.apps) a.inLiveStore = liveIds.has(a.id);
  if (out.meta) {
    out.meta.generated = date;
    out.meta.recheck = { date, liveStoreApps: liveIds.size, note: 'inLiveStore refreshed by scripts/story/build-catalog-snapshot.mts; curated fields (storySafe, caveats, agent, qa) are unchanged.' };
  }
  return out;
}

export function renderDiff(d: CatalogDiff): string {
  const lines: string[] = [`Live store: ${d.liveCount} apps.`];
  const sec = (title: string, items: string[]): void => { if (items.length) lines.push('', `${title} (${items.length}):`, ...items.slice(0, 40).map((x) => `  ${x}`), ...(items.length > 40 ? [`  ... and ${items.length - 40} more`] : [])); };
  sec('REMOVED from the live store, stories must not name these', d.removed);
  sec('REPLACES DROPPED by the manifest, fix any chip that claims them', d.replacesDropped.map((r) => `${r.id}: ${r.names.join(', ')}`));
  sec('Not on main (dev_only or unavailable there) but in the live store', d.notOnMain);
  sec('No manifest found', d.noManifest);
  sec('Renamed in the manifest', d.renamed.map((r) => `${r.id}: "${r.catalog}" is now "${r.manifest}"`));
  sec('Now in the live store (the catalog listed them as not in the store)', d.nowInStore);
  sec('New in the live store and not curated yet', d.newInStore);
  if (!d.removed.length && !d.replacesDropped.length) lines.push('', 'Nothing a story relies on has gone.');
  return lines.join('\n');
}
