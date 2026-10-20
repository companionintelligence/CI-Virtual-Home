#!/usr/bin/env -S node --experimental-strip-types
// The pair index (scripts/story/lib/pairs.mts): which service each app in the families' stories is an alternative to, and which of those pairs a page may show.
// Held on small fixtures (each rule, with the case that should fail it) and on the real tree (the same ledger as the registry's `fleetHomes`, no avoid app and no
// held pair in what may show, the strip's caps). No browser, no built site. Pure Node.
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildPairIndex, stripOf, findOf, pairLine, pairKey, brandOf, serviceOk, familiesOf } from './story/lib/pairs.mts';
import type { AppLite, ServiceLite, StoryLite, PairPlan } from './story/lib/pairs.mts';
import { bansOf } from './story/lib/lander.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const svc = (id: string, name: string, o: Partial<ServiceLite> = {}): ServiceLite => ({ id, name, aliases: [], category: 'data', link: 'yes', flags: [], alternativeToForm: 'ok', storyStatus: 'ok', ...o });
const app = (id: string, name: string, o: Partial<AppLite> = {}): AppLite => ({ id, name, storySafe: 'yes', inLiveStore: true, ...o });
const story = (slug: string, beats: StoryLite['beats']): StoryLite => ({ slug, beats });
const plan = (o: Partial<PairPlan> = {}): PairPlan => ({ hold: [], primary: {}, strip: { size: 10, minFamilies: 2, maxPerApp: 1, maxPerRegistryCategory: 2, maxPerBrand: 2, pin: [] }, ...o });

const SERVICES = [
  svc('google-photos', 'Google Photos', { aliases: ['Google Photo'], category: 'photos' }),
  svc('google-drive', 'Google Drive', { category: 'data' }),
  svc('google-keep', 'Google Keep', { category: 'notes' }),
  svc('dropbox', 'Dropbox', { category: 'data' }),
  svc('evernote', 'Evernote', { category: 'notes' }),
  svc('ourhome', 'OurHome', { flags: ['stale'] }),
  svc('mint', 'Mint', { storyStatus: 'uncurated-only' }),
  svc('chatgpt', 'ChatGPT', { category: 'ai' }),
  svc('gitlab', 'GitLab', { aliases: ['GitLab (SaaS)'], category: 'development' }),
];
const APPS = [app('immich', 'Immich'), app('nextcloud', 'Nextcloud'), app('paperless', 'Paperless-ngx'), app('kiwix', 'Kiwix', { storySafe: 'avoid' }), app('old', 'Old app', { inLiveStore: false }),
  app('open-webui', 'Open WebUI'), app('forgejo', 'Forgejo'), app('homehub', 'HomeHub')];

test('a beat names its service by `service`, else by app.replaces[0] by name or alias; counts are families, not beats', () => {
  const stories = [
    story('a', [{ id: 'a1', service: 'google-photos', app: { id: 'immich' } }, { id: 'a2', service: 'google-photos', app: { id: 'immich' } }, { id: 'a3', app: { id: 'forgejo', replaces: ['GitLab (SaaS)'] } }]),
    story('b', [{ id: 'b1', app: { id: 'immich', replaces: ['Google Photo'] } }, { id: 'b2', app: { id: 'nextcloud', replaces: ['Dropbox'] } }]),
  ];
  const ix = buildPairIndex({ stories, services: SERVICES, apps: APPS, plan: plan() });
  const photos = ix.byService.get('google-photos')!;
  assert.equal(photos.length, 1);
  assert.deepEqual(photos[0].families, ['a', 'b'], 'two beats in one family are one family');
  assert.equal(photos[0].beats.a, 'a1', 'the first beat that shows it');
  assert.equal(ix.byService.get('gitlab')![0].app.id, 'forgejo', 'an alias with a bracket resolves');
  assert.deepEqual(ix.byFamily.get('a')!.map((p) => p.service.id), ['google-photos', 'gitlab'], 'a family lists its pairs in the order of its beats');
  assert.equal(pairLine(photos[0]), 'Immich, alternative to Google Photos');
});

test('each rule that stops a pair stops it for its own reason, and the rest are untouched', () => {
  const stories = [story('a', [
    { id: '1', service: 'ourhome', app: { id: 'immich' } },                       // a stale service
    { id: '2', service: 'mint', app: { id: 'immich' } },                          // a service no safe app is curated for
    { id: '3', service: 'google-keep', app: { id: 'kiwix' } },                    // an avoid app
    { id: '4', service: 'dropbox', app: { id: 'old' } },                          // not in the live store
    { id: '5', service: 'dropbox', app: { id: 'ghost' } },                        // not in the catalog
    { id: '6', service: 'chatgpt', app: { id: 'open-webui' } },                   // held
    { id: '7', app: { id: 'homehub', replaces: ['Cozi'] } },                      // a name the registry does not know
    { id: '8', service: 'evernote', app: { id: 'paperless' } },                   // fine
    { id: '9', service: 'google-drive', app: { id: 'nextcloud' } },               // stopped by a copy rule
  ])];
  const ix = buildPairIndex({ stories, services: SERVICES, apps: APPS, plan: plan({ hold: ['chatgpt|open-webui'] }), bans: [/alternative to Google Drive/] });
  const why = Object.fromEntries(ix.rejected.map((r) => [pairKey(r.service, r.app), r.why]));
  assert.deepEqual(why, {
    'ourhome|immich': 'service-not-ok', 'mint|immich': 'service-not-ok', 'google-keep|kiwix': 'app-avoid', 'dropbox|old': 'app-not-live', 'dropbox|ghost': 'unknown-app',
    'chatgpt|open-webui': 'held', '?cozi|homehub': 'unknown-service', 'google-drive|nextcloud': 'copy-rule',
  });
  assert.deepEqual(ix.shown.map((p) => pairKey(p.service.id, p.app.id)), ['evernote|paperless']);
  assert.equal(serviceOk(svc('x', 'X', { link: 'never' })), false);
  assert.equal(serviceOk(svc('x', 'X', { flags: ['story-excluded'] })), false);
  assert.equal(serviceOk(svc('x', 'X', { flags: ['renamed'] })), true, 'a flag that is not a stop does not stop');
  assert.equal(serviceOk(svc('x', 'X', { alternativeToForm: 'review' })), false);
});

test('the strip: services with enough families, most families first, one chip for each app, capped by registry category and brand, `pin` first, `primary` decides the app', () => {
  const mk = (slug: string, pairs: [string, string][]): StoryLite => story(slug, pairs.map(([s, a], i) => ({ id: `${slug}${i}`, service: s, app: { id: a } })));
  const stories = [
    mk('f1', [['google-photos', 'immich'], ['google-drive', 'nextcloud'], ['evernote', 'paperless'], ['google-keep', 'paperless']]),
    mk('f2', [['google-photos', 'immich'], ['google-drive', 'nextcloud'], ['evernote', 'paperless'], ['google-keep', 'paperless']]),
    mk('f3', [['google-photos', 'immich'], ['google-drive', 'paperless'], ['dropbox', 'nextcloud']]),
    mk('f4', [['google-photos', 'immich'], ['gitlab', 'forgejo']]),
  ];
  const ix = buildPairIndex({ stories, services: SERVICES, apps: APPS, plan: plan() });
  // google-photos 4, google-drive 3, evernote 2, google-keep 2; dropbox and gitlab have one family and fall under minFamilies
  const chips = stripOf(ix, plan());
  assert.deepEqual(chips.map((c) => c.service.id), ['google-photos', 'google-drive', 'evernote'], 'google-keep is Paperless again, and an app heads one chip only');
  assert.equal(chips[1].app.id, 'nextcloud', 'the app most families use (Nextcloud 2, Paperless 1)');
  assert.deepEqual(familiesOf(ix.byService.get('google-drive')!), ['f1', 'f2', 'f3']);
  // pin goes first even when it has fewer families, and its app is then taken (an app heads one chip): Google Drive falls back to Nextcloud
  const pinned = stripOf(ix, plan({ strip: { ...plan().strip, pin: ['evernote'] } }));
  assert.equal(pinned[0].service.id, 'evernote');
  assert.equal(pinned.find((c) => c.service.id === 'google-drive')?.app.id, 'nextcloud');
  // primary decides which app a chip shows when the stories use several; Evernote, whose only app that is, then has none left and is skipped
  const primary = stripOf(ix, plan({ primary: { 'google-drive': 'paperless' } }));
  assert.equal(primary.find((c) => c.service.id === 'google-drive')?.app.id, 'paperless', 'the plan\'s app wins when the stories use several');
  assert.ok(!primary.some((c) => c.service.id === 'evernote'));
  // a brand cap: three Google rows, two allowed
  const capped = stripOf(buildPairIndex({ stories: [mk('f1', [['google-photos', 'immich'], ['google-drive', 'nextcloud'], ['google-keep', 'paperless']]), mk('f2', [['google-photos', 'immich'], ['google-drive', 'nextcloud'], ['google-keep', 'paperless']])], services: SERVICES, apps: APPS, plan: plan() }), plan());
  assert.equal(capped.filter((c) => brandOf(c.service.name) === 'google').length, 2, 'two Google rows, not three');
  assert.equal(brandOf('Microsoft Office'), 'microsoft');
  assert.equal(brandOf('Audible'), 'audible');
  // size
  assert.equal(stripOf(ix, plan({ strip: { ...plan().strip, size: 1 } })).length, 1);
});

test('findOf: a family is found by every service and app it shows, and by an alias', () => {
  const stories = [story('a', [{ id: '1', service: 'google-photos', app: { id: 'immich' } }, { id: '2', service: 'dropbox', app: { id: 'nextcloud' } }]), story('b', [{ id: '1', service: 'evernote', app: { id: 'paperless' } }])];
  const ix = buildPairIndex({ stories, services: SERVICES, apps: APPS, plan: plan() });
  const words = findOf(ix, 'a');
  for (const w of ['google photos', 'google photo', 'immich', 'dropbox', 'nextcloud']) assert.ok(words.includes(w), w);
  assert.ok(!words.includes('evernote'), 'not another family\'s service');
  assert.equal(findOf(ix, 'nobody'), '');
});

// ------------------------------------------------------------------------------------------------------------------------ the real tree

const J = (...p: string[]): any => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));
const registry: ServiceLite[] = J('content', 'story', 'services.json').services;
const catalog: AppLite[] = J('content', 'story', 'catalog-apps.json').apps;
const claims = J('content', 'story', 'claims.json');
const dir = path.join(ROOT, 'content', 'families');
const stories: StoryLite[] = fs.readdirSync(dir).filter((f) => /^[a-z]+(-[a-z]+)*\.json$/.test(f) && f !== 'films.json').sort().map((f) => J('content', 'families', f));
const landerPlan = J('content', 'story', 'lander.json');
const real = buildPairIndex({ stories, services: registry, apps: catalog, plan: landerPlan, bans: bansOf(claims) });

test('on the tree: the ledger is a subset of the registry\'s fleetHomes, and what may show holds every rule', () => {
  const home = new Map(registry.map((s) => [s.id, new Set((s as any).fleetHomes as string[])]));
  for (const r of [...real.shown.map((p) => ({ service: p.service.id, families: p.families })), ...real.rejected.filter((r) => !r.service.startsWith('?'))]) {
    for (const f of r.families) assert.ok(home.get(r.service)?.has(f), `${f} shows ${r.service} but the registry does not list it in fleetHomes (pnpm run story:services)`);
  }
  const held = new Set(landerPlan.hold as string[]);
  for (const p of real.shown) {
    assert.notEqual(p.app.storySafe, 'avoid', `${pairKey(p.service.id, p.app.id)}: an avoid app may not show`);
    assert.ok(serviceOk(p.service), `${p.service.id} is not a service a story may name`);
    assert.ok(!held.has(pairKey(p.service.id, p.app.id)), `${pairKey(p.service.id, p.app.id)} is held`);
    assert.ok(p.families.length > 0);
  }
  assert.ok(real.shown.length > 40, `${real.shown.length} pairs may show`);
  for (const h of landerPlan.hold as string[]) assert.ok(!real.shown.some((p) => pairKey(p.service.id, p.app.id) === h), `${h} is on hold and is not shown`);
});

test('on the tree: the strip is at most ten chips, each with an app that heads one chip, and none is held or an avoid app', () => {
  const chips = stripOf(real, landerPlan);
  assert.ok(chips.length >= 6 && chips.length <= 10, `${chips.length} chips`);
  assert.equal(new Set(chips.map((c) => c.app.id)).size, chips.length, 'one chip for each app');
  const cats = new Map<string, number>(), brands = new Map<string, number>();
  for (const c of chips) {
    cats.set(c.service.category, (cats.get(c.service.category) ?? 0) + 1);
    brands.set(brandOf(c.service.name), (brands.get(brandOf(c.service.name)) ?? 0) + 1);
    assert.ok(c.families.length >= landerPlan.strip.minFamilies);
  }
  for (const [k, n] of cats) assert.ok(n <= landerPlan.strip.maxPerRegistryCategory, `${k}: ${n} chips`);
  for (const [k, n] of brands) assert.ok(n <= landerPlan.strip.maxPerBrand, `${k}: ${n} chips`);
  const counts = chips.map((c) => c.families.length);
  assert.deepEqual([...counts].sort((a, b) => b - a), counts, 'most families first');
  assert.ok(!chips.some((c) => c.app.storySafe === 'avoid'));
});
