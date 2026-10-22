// The story part of `pnpm run portal:build`: everything that turns the authored families (content/families/<slug>.json) into
// pages and tour data. One call from scripts/build-portal.mts (step 5c2, after the homes' own pages), which keeps the gallery, the
// homes' pages, the player's head, the search tags and every check exactly as they are; this adds to them.
//
//   content/families/<slug>.json     the authored stories (or --families <dir>)
//   content/story/*                  casting, claims, catalog, roles, voices, lexicon
//   portal/previews, portal/og       the homes' pictures (the family page's poster) and the committed link-preview images
//
//   -> <out>/family/<slug>.html                      a family's page (scripts/story/pages.mts), keyed by the FAMILY's slug. It reads the app media
//                                                    manifest (real logos and screenshots) and its home's room bounds (the floor plan)
//      <out>/story/manifest.json                     the one un-hashed data file (type SiteManifest, plus `house` per family). `narration: false` on a family
//                                                    with a tour and no voice lock: a captions-only tour from reading-time durations (ship/player.mts)
//      <out>/story/families.<hash10>.json            the family cards (type FamiliesIndex): what a families front page reads
//      <out>/story/<slug>.<hash10>.json              the runtime tour (scripts/story/ship/player.mts)
//      <out>/audio/<slug>/*  <out>/film/<slug>/*     the voice-over and the films' small files (ship/audio.mts, ship/films.mts)
//      <out>/portal/og/<slug>.<hash10>.jpg           the family's link-preview image, when it is current (portal:og)
//   and whatever else scripts/story/ship/*.mts add through the ShipCtx seam (scripts/story/hooks.ts).
//
// What it does NOT do: the salvage's public build hid every home and house id (sanitised specs, a legacy-link map, a stub of
// home-names). The homes portal names its homes, so a family's page names its home by its display name and links its page
// (pages.mts homeNote). No builder is named anywhere on the site, and the specs ship without their `author` and `source`
// (scripts/portal-redact.mts, build-portal.mts step 5; the guard in step 8 fails the build if one gets through). What stays of the
// rule: the STORY's words never name a home or a builder (scripts/story/check-leaks.mts, the validator's internal-ids rule), and a
// family's page is keyed by the family's slug, never by a house id.
//
// STALE FAMILIES. A family is shipped only when it is current: in the casting, set in a house that exists, its apps in the live
// store, the validator clean (scripts/story/lib/validate.mts), its words clean (check-leaks.mts). One that is not is STALE: it
// gets no page and no tour, and the build says so, with the first reason each (`--stale-report` prints all of them). That is not
// an error by default, because a family written for a house that has since been re-laid, or one the casting no longer names, is
// the ordinary state of a re-cast. `--strict-families` (or CI_STORY_STRICT=1) makes every stale family, every casting family
// without a file and every note of a ship step an error: use it where the whole cast is meant to be there (the production deploy).
// A family's tour, voice-over and film follow the same rule: a stale lock is a note by default (the page plays the Orbit) and an
// error in strict mode (ship/player.mts reads `partial`, which here means "not strict"). A family with NO voice lock is not stale: its tour
// is captions-only, on purpose, in strict mode too (no voice-over has been recorded in this pass), and the manifest says `narration: false`.
//
// A family's page is the landing page of an ad (pages.mts). Three homes carry one family name, so the page's title and its neighbours' links
// use the name no other family shares (`uniqueLabels`, "The Brennan family of Wrenfield"); the build fails on two pages with one title.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FamiliesIndex, SiteManifest, Story } from '../../assets/story/types.ts';
import type { ShipCtx, ShipFn, ManifestKey } from './hooks.ts';
import { SHIP_GLOB } from './hooks.ts';
import { hash10, readJson, slugProblem, loadAll, storyFiles, cardOf, ogKey, ogText } from './site-lib.mts';
import type { Card } from './site-lib.mts';
import * as pg from './pages.mts';
import { readMedia } from './lib/media.mts';
import { needles, storyCopyLeaks } from './check-leaks.mts';
import type { House } from '../portal-pages.mts';

export type BuildArgs = Record<string, string>;
/** `title` is the card's ("The Brennan family"); `label` is the name no other family shares ("The Brennan family of Wrenfield" while three homes carry one name): a page's <title> and a link that must tell families apart use it. */
export type BuiltFamily = { slug: string; house: string; title: string; label: string; file: string; url: string; poster: string; og: string; hasTour: boolean; narration: boolean };
export type StaleFamily = { slug: string; reasons: string[] };
export type StoryResult = {
  files: number; bytes: number;
  /** the families that have a page, in the order of the sibling links */
  built: BuiltFamily[];
  stale: StaleFamily[];
  /** story/families.<hash>.json, and the cards in it (the hook for a families front page: see build-portal.mts) */
  familiesUrl: string; cards: Card[];
  strict: boolean;
};
type ManifestEntry = SiteManifest['byFamily'][string] & { house: string };

const reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The validator's findings for one family as lines (errors, and the `review` ones the allow-list does not clear), or null when it cannot run. */
async function loadValidator(): Promise<{ run: (story: unknown) => string[]; why: string } | { run: null; why: string }> {
  try {
    const { loadContext } = await import('./lib/context.mts');
    const { validateStory } = await import('./lib/validate.mts');
    const ctx = loadContext();
    return { run: (story: unknown) => { const r = validateStory(story, ctx); return [...r.errors, ...r.review].map(f => r.line(f)); }, why: '' };
  } catch (err) { return { run: null, why: (err as Error).message.split('\n')[0] }; }
}

export async function buildStorySite(o: { ROOT: string; OUT: string; SITE: string; args: BuildArgs; problems: string[]; houses: House[] }): Promise<StoryResult> {
  const { ROOT, OUT, SITE, args, problems, houses } = o;
  let files = 0, bytes = 0;
  const strict = args['strict-families'] === 'true' || process.env.CI_STORY_STRICT === '1';
  const posix = (p: string): string => p.split(path.sep).join('/');
  const put = (rel: string, data: Uint8Array | string): string => {
    const to = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, data);
    files++; bytes += typeof data === 'string' ? Buffer.byteLength(data) : data.length;
    return posix(rel);
  };
  const putHashed = (srcAbs: string, dstDir: string, name?: string): string => {
    const buf = fs.readFileSync(srcAbs);
    const base = name || path.basename(srcAbs).replace(/\.[0-9a-f]{10}(\.[^.]+)$/, '$1');
    const ext = path.extname(base);
    return put(path.join(dstDir, `${base.slice(0, base.length - ext.length)}.${hash10(buf)}${ext}`), buf);
  };
  const pic = (rel: string): string => path.join(ROOT, rel);
  const houseById = new Map(houses.map(h => [h.id, h]));
  const empty: StoryResult = { files: 0, bytes: 0, built: [], stale: [], familiesUrl: '', cards: [], strict };

  // ---- the families on disk, and the inputs the checks read
  const dir = path.resolve(ROOT, args.families && args.families !== 'true' ? args.families : path.join('content', 'families'));
  // (the ship steps and the voice tools find a family's locks, clips and film through this variable; --families points all of them at one folder)
  if (args.families && args.families !== 'true') process.env.CI_STORY_FAMILIES_DIR ||= dir;
  let L: ReturnType<typeof loadAll>;
  try { L = loadAll(ROOT, dir); } catch (err) { problems.push(`story: cannot read the story inputs (content/story/*, ${path.relative(ROOT, dir)}): ${(err as Error).message}`); return empty; }
  const { stories, casting, claims, catalog } = L;
  const validator = await loadValidator();
  const leakNeedles = needles(ROOT);

  // ---- which of them are current
  const stale: StaleFamily[] = [];
  const fresh: Story[] = [];
  const seen = new Set<string>();
  for (const s of stories) {
    const why: string[] = [];
    const sp = slugProblem(s.slug); if (sp) why.push(sp);
    if (seen.has(s.slug)) why.push('another family has the same slug'); seen.add(s.slug);
    if (houses.some(h => new RegExp(`(^|-)${reEsc(h.id)}(-|$)`).test(s.slug))) why.push('its slug names a house (a family page is keyed by the family)');
    const c = casting[s.slug];
    if (!c) why.push('it is not in content/story/casting.json');
    else if (s.house !== c.house) why.push('its house is not the one the casting gives it');
    if (!houseById.has(s.house)) why.push('its house is not one of the homes');
    else if (!fs.existsSync(pic(path.join('portal', 'previews', `${s.house}.jpg`)))) why.push('its house has no link-preview picture (pnpm run portal:thumbs)');
    if (s.schema !== 'family/v1' || s.fictional !== true) why.push('it is not a family/v1 file with fictional: true');
    for (const b of s.beats || []) {
      if (b.app && !catalog[b.app.id]) why.push(`${b.id}: the app ${b.app.id} is not in the Companion Hub catalog snapshot`);
      else if (b.app && (catalog[b.app.id] as any).inLiveStore === false) why.push(`${b.id}: the app ${b.app.id} is not in the live store`);
    }
    if (validator.run) { try { why.push(...validator.run(s).map(l => `validator: ${l}`)); } catch (err) { why.push(`validator: ${(err as Error).message.split('\n')[0]}`); } }
    try { why.push(...storyCopyLeaks(s, leakNeedles).map(l => `copy: ${l}`)); } catch (err) { why.push(`copy check: ${(err as Error).message.split('\n')[0]}`); }
    if (why.length) stale.push({ slug: s.slug, reasons: why }); else fresh.push(s);
  }
  const castingSlugs = Object.keys(casting);
  const missing = castingSlugs.filter(slug => !stories.some(s => s.slug === slug));
  if (!validator.run && !strict) console.log(`story: the validator did not load (${validator.why}); families are not validated in this build`);
  if (!validator.run && strict) problems.push(`story: --strict-families, and the validator did not load (${validator.why})`);
  if (strict) {
    for (const f of stale) problems.push(`story: ${f.slug} is stale: ${f.reasons[0]}${f.reasons.length > 1 ? ` (and ${f.reasons.length - 1} more: pnpm run story:validate -- ${f.slug})` : ''}`);
    for (const slug of missing) problems.push(`story: ${slug} is in the casting but has no content/families/${slug}.json`);
  }

  // ---- the order (the casting's, flagship families first) and the pictures
  const rank = (slug: string): number => (casting[slug] as any)?.flagship ? 0 : 1;
  const order = fresh.map(s => s.slug).sort((a, b) => rank(a) - rank(b) || castingSlugs.indexOf(a) - castingSlugs.indexOf(b));
  const sorted = order.map(slug => fresh.find(s => s.slug === slug)!);
  const ogManifestPath = pic(path.join('portal', 'og', 'manifest.json'));
  const ogManifest: Record<string, { key: string; file: string }> = fs.existsSync(ogManifestPath) ? readJson(ogManifestPath) : {};
  const posterOf = (house: string): string => `portal/previews/${house}.jpg`;
  const ogUrl: Record<string, string> = {};
  const ogStale: string[] = [];
  for (const s of sorted) {
    const base = pic(posterOf(s.house)), ogFile = pic(path.join('portal', 'og', `${s.slug}.jpg`)), entry = ogManifest[s.slug];
    // the link-preview picture is committed by `pnpm run portal:og`; its manifest says what text and picture it was drawn from
    if (fs.existsSync(ogFile) && entry && entry.key === ogKey(ogText('family', s), fs.readFileSync(base))) ogUrl[s.slug] = putHashed(ogFile, path.join('portal', 'og'), `${s.slug}.jpg`);
    else ogStale.push(s.slug);
  }

  // (the pages are set in Manrope alone since the October 2026 restyle: portal/fonts/archivo-black.woff2 stays in the repo for the link-preview images, scripts/story/build-og.mts, and is not shipped)

  // ---- the cards, the data files, the manifest
  const cards: Card[] = sorted.map(s => cardOf(s, { catalog, order, thumb: `portal/thumbs/${s.house}.webp`, og: ogUrl[s.slug] || '' }));
  const cardBy = Object.fromEntries(cards.map(c => [c.slug, c]));
  const familiesIndex: FamiliesIndex = { v: 1, families: cards };
  const familiesUrl = put(path.join('story', `families.${hash10(JSON.stringify(familiesIndex))}.json`), JSON.stringify(familiesIndex));
  // (`legacy` is the salvage's map from an old ?house= link to a family; the homes keep their ids, so there is none)
  const manifest: { v: 1; families: string; legacy: string; byFamily: Record<string, ManifestEntry> } = { v: 1, families: familiesUrl, legacy: '', byFamily: {} };
  for (const s of sorted) manifest.byFamily[s.slug] = { house: s.house, spec: `content/houses/${s.house}.json`, story: '', poster: posterOf(s.house), og: ogUrl[s.slug] || '', audio: {} };

  // ---- the seams: every scripts/story/ship/*.mts adds its files and registers their URLs
  const shipNotes: string[] = [];
  const registerKey = (slug: string, key: ManifestKey, url: string): void => {
    const m = manifest.byFamily[slug]; if (!m) { problems.push(`story ship: ${slug} is not a family of this build`); return; }
    if (key.startsWith('audio:')) m.audio[key.slice(6)] = url;
    else if (key.startsWith('film.')) { m.film ||= { durationMs: 0, bytes: 0 }; (m.film as any)[key.slice(5)] = url; }
    else (m as any)[key] = url;
  };
  const ctx: ShipCtx = {
    ROOT, OUT, site: SITE, partial: !strict, stories: sorted, casting,
    addHashed: (src, dstDir) => putHashed(src, dstDir),
    addFile: (rel, data) => put(rel, data),
    register: registerKey,
    registerFilm: (slug, film) => { const m = manifest.byFamily[slug]; if (m) m.film = { ...(m.film || {}), ...film }; },
    setNarration: (slug, on) => { const m = manifest.byFamily[slug]; if (m) m.narration = on; },
    // a stale lock, a clip recorded from older text: a note while families are being re-cast, an error where the whole cast is meant to be current
    problem: msg => { if (strict) problems.push(`story ship: ${msg}`); else shipNotes.push(msg); },
  };
  const shipDir = path.join(ROOT, SHIP_GLOB);
  for (const f of fs.existsSync(shipDir) ? fs.readdirSync(shipDir).filter(f => f.endsWith('.mts')).sort() : []) {
    try { const mod = await import(pathToFileURL(path.join(shipDir, f)).href); await (mod.default as ShipFn)(ctx); }
    catch (err) { problems.push(`scripts/story/ship/${f}: ${(err as Error).message}`); }
  }

  // ---- the pages
  // (portal/campaign.js is the front page's: a family's page loads it when it is in the tree and is written the same without it)
  const campaign = fs.existsSync(pic(path.join('portal', 'campaign.js')));
  // story v2: the real logos and screenshots (content/story/app-media.json, `pnpm run story:media`; absent: the pages show none) and each home's spec, whose
  // room bounds draw the floor plan. The source spec is read (not the shipped copy), but only its storeys and rooms are used: nothing of its identity.
  const media = readMedia(ROOT);
  const specOf = (id: string): any => { const f = pic(path.join('content', 'houses', `${id}.json`)); try { return fs.existsSync(f) ? readJson(f) : null; } catch { return null; } };
  const labels = pg.uniqueLabels(cards, Object.fromEntries(sorted.map(s => [s.slug, s.family.address.place])));
  const built: BuiltFamily[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i], m = manifest.byFamily[s.slug], house = houseById.get(s.house)!;
    const og = m.og || posterOf(s.house);
    const film = m.film && (m.film.src169 || m.film.src916) ? m.film : undefined;
    const prev = cards[(i + cards.length - 1) % cards.length], next = cards[(i + 1) % cards.length];
    // a family with no tour has no narration to speak of; one with a tour says so in the manifest (ship/player.mts)
    const narration = !!m.story && m.narration !== false && Object.keys(m.audio).length > 0;
    const html = pg.familyPage({
      s, card: cardBy[s.slug], prev, next, site: SITE, claims, catalog,
      house, poster: posterOf(s.house), og: new URL(og, SITE).href, film,
      casting: casting[s.slug], label: labels[s.slug], prevLabel: labels[prev.slug], nextLabel: labels[next.slug], narration, campaign,
      media, spec: specOf(s.house),
    });
    const file = put(path.join('family', `${s.slug}.html`), html);
    built.push({ slug: s.slug, house: s.house, title: cardBy[s.slug].title, label: labels[s.slug], file, url: pg.familyUrl(SITE, s.slug), poster: posterOf(s.house), og: m.og, hasTour: !!m.story, narration });
  }
  put(path.join('story', 'manifest.json'), JSON.stringify(manifest));

  // ---- what happened, in words
  console.log(`story: ${built.length} famil${built.length === 1 ? 'y has' : 'ies have'} a page${built.length ? ` (${built.filter(b => b.hasTour).length} with a tour)` : ''}; ${stale.length} stale and not shipped; ${missing.length} of the casting's ${castingSlugs.length} ${missing.length === 1 ? 'has' : 'have'} no file${strict ? ' (strict)' : ''}`);
  if (stale.length) {
    const all = args['stale-report'] === 'true';
    for (const f of (all ? stale : stale.slice(0, 4))) console.log(`  stale ${f.slug}: ${all ? f.reasons.join(' | ') : f.reasons[0] + (f.reasons.length > 1 ? ` (+${f.reasons.length - 1})` : '')}`);
    if (!all && stale.length > 4) console.log(`  ... and ${stale.length - 4} more (--stale-report prints every reason; pnpm run story:validate -- <slug> says how to fix one)`);
  }
  if (shipNotes.length) console.log(`story: ${shipNotes.length} note${shipNotes.length === 1 ? '' : 's'} from the ship steps (errors with --strict-families)${shipNotes.slice(0, 3).map(n => `\n  ${n}`).join('')}${shipNotes.length > 3 ? '\n  ...' : ''}`);
  if (ogStale.length && built.length) console.log(`story: ${ogStale.length} link-preview image${ogStale.length === 1 ? ' is' : 's are'} not current (pnpm run portal:og); those pages use the home's own picture`);
  return { files, bytes, built, stale, familiesUrl, cards, strict };
}
