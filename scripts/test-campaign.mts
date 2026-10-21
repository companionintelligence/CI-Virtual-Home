#!/usr/bin/env -S node --experimental-strip-types
// portal/campaign.js, run as it is in a tiny DOM stub (no browser, no network), and the pages that load it:
// @check-house quick
//
//   node --experimental-strip-types scripts/test-campaign.mts       (any cwd)
//
// The ad's tags (utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, ttclid, gclid, msclkid) must survive the visit:
//   capture      the listed tags are read from the address and kept in sessionStorage under one key; nothing else is
//   rewrite      every link to https://ci.computer, /core and /download (not the docs, privacy or terms, not another host) and every
//                relative link marked data-campaign gets them, in the page's DOM, with the fragment and the query it had intact
//   no double    a tag a link already has is left alone, and running again changes nothing
//   blocked      with sessionStorage throwing, the page still works: the address's tags still ride on its links
//   dynamic      a link added or changed after the script ran (the gallery draws cards later) is rewritten as it arrives
//   organic      no tags, nothing watched and nothing rewritten
//   pages        index.html, a home's page and the 404 load it with defer and data-cfasync="false" (the family pages' tag is the
//                family build's: scripts/story/portal-tests), and the built hrefs to /core and /download have no query
//   player       the player draws its end card and About panel after the page loads: those links are tagged as they arrive and when
//                clicked (the tag in the player's head is portal:build's, held at its step 7 and by scripts/story/portal-tests/campaign-player.mts)
//   rules        portal/campaign.json (version, rules [{match, to, from, until}]) ships empty; a rule maps /core, /download or the main
//                site at run time, only inside its dates, keeps the link's query and fragment, adds the tags only on ci.computer, never
//                touches the docs, privacy or terms links, and a bad or stale file changes nothing; portal:build's validator refuses
//                an expired, too long, overlapping or malformed rule
// Exit 0 when all hold; 1 otherwise.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { LINKS, homePage, notFoundPage } from './portal-pages.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'portal', 'campaign.js'), 'utf8');

let failures = 0, passes = 0;
const ok = (cond: unknown, what: string): void => { if (cond) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${what}`); } else { failures++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };

// ---- the stub: just what campaign.js touches -----------------------------------------------------------------------------
class Anchor {
  nodeType = 1; nodeName = 'A'; parentNode: any = null;
  attrs: Record<string, string>;
  constructor(attrs: Record<string, string>) { this.attrs = attrs; }
  getAttribute(k: string): string | null { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k: string, v: string): void { this.attrs[k] = String(v); sets++; }
  hasAttribute(k: string): boolean { return k in this.attrs; }
  matches(sel: string): boolean { return sel === 'a[href]' && 'href' in this.attrs; }
  querySelectorAll(): Anchor[] { return []; }
}
let sets = 0;
const a = (href: string, data = false): Anchor => new Anchor({ href, ...(data ? { 'data-campaign': '' } : {}) });

type Page = { ctx: any; doc: any; fire: (type: string, target: any) => void; mutate: (records: any[]) => void; observers: number; store: Map<string, string>; fetched: string[] };
// rules: what portal/campaign.json answers (a value, or 'fail' for a network error, 'missing' for a 404); today: the UTC date the page sees; script: the address campaign.js was loaded from
function load(o: { search: string; links: Anchor[]; store?: Map<string, string>; blocked?: boolean; origin?: string; readyState?: string; rules?: unknown; today?: string; script?: string }): Page {
  const store = o.store || new Map<string, string>();
  const listeners: Record<string, ((e: any) => void)[]> = {};
  let observer: ((records: any[]) => void) | null = null;
  const page: Page = { ctx: null, doc: null, fire: () => {}, mutate: () => {}, observers: 0, store, fetched: [] };
  const doc: any = {
    currentScript: o.script ? { src: o.script } : null,
    readyState: o.readyState || 'complete', documentElement: { nodeType: 1 }, body: { nodeType: 1 },
    querySelectorAll: () => o.links,
    addEventListener: (type: string, fn: (e: any) => void) => { (listeners[type] ||= []).push(fn); },
  };
  const sessionStorage = { getItem: (k: string) => (store.has(k) ? store.get(k)! : null), setItem: (k: string, v: string) => { store.set(k, String(v)); } };
  const g: any = {
    document: doc, location: { search: o.search, origin: o.origin || 'https://homes.ci.computer' },
    MutationObserver: function (cb: (r: any[]) => void) { observer = cb; page.observers++; this.observe = () => {}; },
    console,
  };
  if (o.today) g.Date = class { static parse(x: string) { return Date.parse(x); } constructor(t?: number) { this.t = t === undefined ? Date.parse(o.today + 'T12:00:00Z') : t; } t: number; toISOString() { return new Date(this.t).toISOString(); } };
  if (o.rules !== undefined) g.fetch = (url: string) => {
    page.fetched.push(url);
    if (o.rules === 'fail') return Promise.reject(new Error('network'));
    if (o.rules === 'missing') return Promise.resolve({ ok: false, json: () => Promise.reject(new Error('404')) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(o.rules))) });
  };
  Object.defineProperty(g, 'sessionStorage', o.blocked ? { get() { throw new Error('SecurityError: blocked'); } } : { value: sessionStorage });
  g.globalThis = g;
  page.ctx = vm.createContext(g);
  vm.runInContext(SOURCE, page.ctx, { filename: 'portal/campaign.js' });
  page.doc = doc;
  page.fire = (type, target) => (listeners[type] || []).forEach(fn => fn({ target }));
  page.mutate = records => { if (observer) observer(records); };
  return page;
}
const href = (x: Anchor): string => x.getAttribute('href')!;
const settle = async (): Promise<void> => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };

// ---- capture ---------------------------------------------------------------------------------------------------------
console.log('capture');
{
  const all = 'utm_source=meta&utm_medium=paid&utm_campaign=autumn%20test&utm_content=ad-1&utm_term=uncloud&fbclid=AbC_1-2&ttclid=T1&gclid=G1&msclkid=M1';
  const p = load({ search: `?${all}&persona=code&q=sally&other=1`, links: [] });
  const got = p.ctx.CICampaign.params();
  ok(Object.keys(got).join() === 'utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbclid,ttclid,gclid,msclkid', 'the nine listed tags are read');
  ok(got.utm_campaign === 'autumn test' && got.fbclid === 'AbC_1-2', 'values are decoded once');
  const stored = JSON.parse(p.store.get('ci-campaign') || '{}');
  ok(Object.keys(stored).length === 9 && !('persona' in stored) && !('q' in stored) && !('other' in stored), 'they are stored under one key, and nothing else is');
  ok(p.ctx.CICampaign.query() === 'utm_source=meta&utm_medium=paid&utm_campaign=autumn%20test&utm_content=ad-1&utm_term=uncloud&fbclid=AbC_1-2&ttclid=T1&gclid=G1&msclkid=M1', 'query() writes them in the listed order, encoded');
  const none = load({ search: '?persona=code&q=sally&utm_unknown=1&UTM_SOURCE=x', links: [] });
  ok(Object.keys(none.ctx.CICampaign.params()).length === 0 && !none.store.has('ci-campaign'), 'other parameters (and a different case) are not read or stored');
  const long = load({ search: `?utm_source=${'x'.repeat(5000)}&utm_medium=%0Abad%00`, links: [] });
  ok(long.ctx.CICampaign.params().utm_source.length === 300 && long.ctx.CICampaign.params().utm_medium === 'bad', 'a value is cut at 300 characters and loses control characters');
  const empty = load({ search: '?utm_source=&utm_medium', links: [] });
  ok(Object.keys(empty.ctx.CICampaign.params()).length === 0, 'an empty tag is no tag');
}

// ---- rewrite ---------------------------------------------------------------------------------------------------------
console.log('rewrite');
{
  const outbound = ['https://ci.computer', 'https://ci.computer/', 'https://ci.computer/core', 'https://ci.computer/download', 'https://ci.computer/core/', 'https://ci.computer/download#plans'].map(h => a(h));
  const left = [LINKS.docs, LINKS.privacy, LINKS.terms, 'https://hub.ci.computer/store', 'https://example.com/?x=1', 'https://ci.computer.evil.example/core', 'http://ci.computer/core', 'https://ci.computer/pricing', 'https://www.ci.computer/core', 'mailto:hi@ci.computer'].map(h => a(h, true));
  const inside = [a('./family/brennan', true), a('../room-creator?mode=view&house=aurora&family=brennan', true), a('../#homes', true), a('./family/brennan#tour', true), a('https://homes.ci.computer/', true)];
  const plain = [a('./family/kovacs'), a('#core', true), a('../#homes')];
  const p = load({ search: '?utm_source=meta&utm_campaign=test', links: [...outbound, ...left, ...inside, ...plain] });
  const tag = 'utm_source=meta&utm_campaign=test';
  ok(outbound.map(href).join('|') === [`https://ci.computer?${tag}`, `https://ci.computer/?${tag}`, `https://ci.computer/core?${tag}`, `https://ci.computer/download?${tag}`, `https://ci.computer/core/?${tag}`, `https://ci.computer/download?${tag}#plans`].join('|'), 'ci.computer, /core and /download get the tags (before a fragment)');
  ok(left.map(href).join('|') === [LINKS.docs, LINKS.privacy, LINKS.terms, 'https://hub.ci.computer/store', 'https://example.com/?x=1', 'https://ci.computer.evil.example/core', 'http://ci.computer/core', 'https://ci.computer/pricing', 'https://www.ci.computer/core', 'mailto:hi@ci.computer'].join('|'), 'the docs, privacy, terms, other pages, other hosts, http and mailto do not');
  ok(inside.map(href).join('|') === [`./family/brennan?${tag}`, `../room-creator?mode=view&house=aurora&family=brennan&${tag}`, `../?${tag}#homes`, `./family/brennan?${tag}#tour`, `https://homes.ci.computer/?${tag}`].join('|'), 'a link marked data-campaign keeps its query and fragment and gains the tags (a full address on this origin too)');
  ok(plain.map(href).join('|') === './family/kovacs|#core|../#homes', 'a relative link without data-campaign, and a bare fragment, are left alone');
}

// ---- no double append -------------------------------------------------------------------------------------------------
console.log('no double append');
{
  const own = a('https://ci.computer/core?utm_source=email&utm_term=x');
  const dup = a('./family/brennan?utm_source=meta', true);
  const p = load({ search: '?utm_source=meta&utm_medium=paid', links: [own, dup] });
  ok(href(own) === 'https://ci.computer/core?utm_source=email&utm_term=x&utm_medium=paid' && href(dup) === './family/brennan?utm_source=meta&utm_medium=paid', 'a tag a link already has keeps its value; the missing ones are added');
  const before = [href(own), href(dup)].join();
  sets = 0;
  p.ctx.CICampaign.apply(p.doc); p.ctx.CICampaign.apply(p.doc);
  p.mutate([{ type: 'attributes', target: own }, { type: 'attributes', target: dup }]);
  p.fire('click', own);
  ok([href(own), href(dup)].join() === before && sets === 0, 'running again, a mutation and a click change nothing and set nothing');
  ok(p.ctx.CICampaign.decorate(`https://ci.computer/core?utm_source=meta&utm_medium=paid`) === 'https://ci.computer/core?utm_source=meta&utm_medium=paid', 'decorate() of a decorated address is itself');
}

// ---- storage blocked --------------------------------------------------------------------------------------------------
console.log('storage blocked');
{
  const l = [a('https://ci.computer/core'), a('./family/brennan', true)];
  let threw = '';
  let p: Page | null = null;
  try { p = load({ search: '?utm_source=meta&gclid=G1', links: l, blocked: true }); } catch (e) { threw = (e as Error).message; }
  ok(!threw && !!p, `the script runs with sessionStorage throwing${threw ? `: ${threw}` : ''}`);
  ok(href(l[0]) === 'https://ci.computer/core?utm_source=meta&gclid=G1' && href(l[1]) === './family/brennan?utm_source=meta&gclid=G1', 'the address\'s tags still ride on this page\'s links');
  const next = load({ search: '', links: [a('https://ci.computer/core')], blocked: true });
  ok(Object.keys(next.ctx.CICampaign.params()).length === 0, 'on the next page, with no storage and no tags in the address, there is nothing to carry (and nothing throws)');
}

// ---- the visit: stored tags, and a new ad -----------------------------------------------------------------------------
console.log('the visit');
{
  const store = new Map<string, string>();
  load({ search: '?utm_source=meta&utm_campaign=one', links: [], store });
  const l = [a('https://ci.computer/download'), a('./family/kovacs', true)];
  const second = load({ search: '?persona=code', links: l, store });
  ok(href(l[0]) === 'https://ci.computer/download?utm_source=meta&utm_campaign=one' && href(l[1]) === './family/kovacs?utm_source=meta&utm_campaign=one', 'a page with no tags in its address uses the ones stored for the visit');
  const l2 = [a('https://ci.computer/core')];
  load({ search: '?utm_source=tiktok&ttclid=T9', links: l2, store });
  ok(href(l2[0]) === 'https://ci.computer/core?utm_source=tiktok&ttclid=T9' && JSON.parse(store.get('ci-campaign')!).utm_campaign === undefined, 'a new ad starts a new set (the last one wins)');
  const garbage = new Map([['ci-campaign', '{"utm_source":"meta","evil":"x","gclid":5}']]);
  const g = load({ search: '', links: [], store: garbage });
  ok(JSON.stringify(g.ctx.CICampaign.params()) === '{"utm_source":"meta"}', 'what storage holds is checked: only listed keys with string values');
  const broken = load({ search: '', links: [], store: new Map([['ci-campaign', 'not json']]) });
  ok(Object.keys(broken.ctx.CICampaign.params()).length === 0, 'unreadable storage is no tags');
  void second;
}

// ---- dynamic ---------------------------------------------------------------------------------------------------------
console.log('dynamic');
{
  const p = load({ search: '?utm_source=meta', links: [] });
  ok(p.observers === 1, 'the page is watched');
  const card = a('./family/brennan', true);
  const holder: any = { nodeType: 1, nodeName: 'LI', matches: () => false, querySelectorAll: () => [card] };
  p.mutate([{ type: 'childList', addedNodes: [holder] }]);
  ok(href(card) === './family/brennan?utm_source=meta', 'a card added later is rewritten');
  const hero = a('./room-creator?mode=view&house=aurora', true);
  p.mutate([{ type: 'attributes', target: hero }]);
  ok(href(hero) === './room-creator?mode=view&house=aurora&utm_source=meta', 'a link whose href was set later is rewritten');
  const late = a('https://ci.computer/core');
  p.fire('click', late);
  ok(href(late) === 'https://ci.computer/core?utm_source=meta', 'a click sets it right before the browser reads it');
  const text: any = { nodeType: 3 };
  p.mutate([{ type: 'childList', addedNodes: [text] }]);
  ok(true, 'a text node is no problem');
  const loading = load({ search: '?utm_source=meta', links: [a('https://ci.computer')], readyState: 'loading' });
  ok(href(loading.doc.querySelectorAll()[0]) === 'https://ci.computer', 'while the document is loading nothing runs yet');
  loading.fire('DOMContentLoaded', null);
  ok(href(loading.doc.querySelectorAll()[0]) === 'https://ci.computer?utm_source=meta', 'it runs at DOMContentLoaded');
}

// ---- organic ---------------------------------------------------------------------------------------------------------
console.log('organic visit');
{
  const l = [a('https://ci.computer/core'), a('./family/brennan', true)];
  sets = 0;
  const p = load({ search: '?q=sally', links: l });
  ok(p.observers === 0 && sets === 0 && href(l[0]) === 'https://ci.computer/core' && href(l[1]) === './family/brennan', 'no tags: nothing watched, nothing rewritten');
  ok(p.ctx.CICampaign.decorate('https://ci.computer/core') === 'https://ci.computer/core' && p.ctx.CICampaign.query() === '', 'the exported helpers are no-ops');
}

// ---- the player: links drawn after the page loaded ----------------------------------------------------------------------------
// room-creator.html (?mode=view) builds its end card, its About panel and its header with innerHTML long after DOMContentLoaded (assets/viewer.ts,
// assets/story/popup.ts); portal:build adds the script tag to that page and these are the links it must tag.
console.log('player');
{
  const tag = 'utm_source=meta&utm_medium=paid&utm_campaign=lander&utm_content=ad1&fbclid=ABC123';
  const p = load({ search: `?mode=view&house=gardennook&family=brennan&${tag}`, links: [] });
  const endCard = ['https://ci.computer/core', 'https://ci.computer/download'].map(h => a(h));
  const about = [a('https://ci.computer'), a('https://ci.computer/core'), a('https://ci.computer/download'), a(LINKS.docs)];
  const allHomes = a('../', false);
  const holder: any = { nodeType: 1, nodeName: 'DIV', matches: () => false, querySelectorAll: () => [...endCard, ...about, allHomes] };
  p.mutate([{ type: 'childList', addedNodes: [holder] }]);
  ok([...endCard, ...about.slice(0, 3)].every(x => href(x).endsWith(`?${tag}`)), 'the end card, About panel and header links to ci.computer, /core and /download are tagged as they are drawn');
  ok(href(about[3]) === LINKS.docs && href(allHomes) === '../', 'the docs link and a plain relative link are not');
  const late = a('https://ci.computer/core');
  for (const ev of ['click', 'auxclick', 'contextmenu', 'touchstart']) { late.attrs.href = 'https://ci.computer/core'; p.fire(ev, late); ok(href(late) === `https://ci.computer/core?${tag}`, `${ev}: a link nothing else reached is tagged right before the browser reads it`); }
  const inner: any = { nodeType: 1, nodeName: 'SPAN', parentNode: a('https://ci.computer/download') };
  p.fire('click', inner);
  ok(href(inner.parentNode) === `https://ci.computer/download?${tag}`, 'a click on the icon inside the link tags the link');
  ok(p.ctx.CICampaign.decorate('https://ci.computer/core') === `https://ci.computer/core?${tag}`, 'decorate() tags a link the player builds as a string');
  // nothing throws without the tags, or when the page has no CICampaign consumer
  const organic = load({ search: '?mode=view&house=gardennook&family=brennan', links: [] });
  organic.mutate([{ type: 'childList', addedNodes: [holder] }]);
  ok(organic.observers === 0 && organic.ctx.CICampaign.query() === '', 'an organic visit to the player watches nothing');
}

// ---- link rules (portal/campaign.json) -----------------------------------------------------------------------------------
console.log('link rules');
{
  const shipped = JSON.parse(fs.readFileSync(path.join(ROOT, 'portal', 'campaign.json'), 'utf8'));
  ok(shipped.version === 1 && Array.isArray(shipped.rules) && shipped.rules.length === 0 && Object.keys(shipped).join() === 'version,rules', 'the shipped portal/campaign.json is version 1 with an empty list: nothing visible changes until the owner decides (decision D2)');
  const SCRIPT = 'https://homes.ci.computer/portal/campaign.js?v=0123456789';
  const rule = (o: Record<string, string> = {}) => ({ match: 'https://ci.computer/core', to: 'https://ci.computer/store/p/core', from: '2026-10-01', until: '2026-11-12', ...o });
  const file = (...rules: object[]) => ({ version: 1, rules });
  const tags = 'utm_source=meta&fbclid=AbC';
  const links = () => ({ core: a('https://ci.computer/core'), coreQ: a('https://ci.computer/core/?ref=nav#buy'), dl: a('https://ci.computer/download'), site: a('https://ci.computer'), docs: a(LINKS.docs, true), privacy: a(LINKS.privacy, true), terms: a(LINKS.terms, true), hub: a('https://hub.ci.computer/store', true), rel: a('./family/brennan', true) });

  // the default: an empty list is fetched, applied to nothing, and an organic visit stays unwatched
  { const l = links(); const p = load({ search: '', links: Object.values(l), rules: file(), today: '2026-10-20', script: SCRIPT }); await settle();
    ok(p.fetched.length === 1 && p.fetched[0] === 'https://homes.ci.computer/portal/campaign.json', 'campaign.json is read from next to the script (one same-origin request, the script\'s ?v= dropped)');
    ok(Object.values(l).every(x => !('utm_source' in x.attrs) && href(x) === x.attrs.href) && l.core.attrs.href === 'https://ci.computer/core' && p.observers === 0, 'an empty list changes no link and starts no watcher'); }

  // a rule is applied (organic visitor, no tags)
  { const l = links(); const p = load({ search: '', links: Object.values(l), rules: file(rule()), today: '2026-10-20', script: SCRIPT });
    ok(href(l.core) === 'https://ci.computer/core', 'before the file is read the link is as built');
    await settle();
    ok(href(l.core) === 'https://ci.computer/store/p/core', 'a rule maps the Buy link to its address');
    ok(href(l.coreQ) === 'https://ci.computer/store/p/core?ref=nav#buy', 'the link\'s own query and fragment ride along (trailing slash and all)');
    ok(href(l.dl) === 'https://ci.computer/download' && href(l.site) === 'https://ci.computer' && href(l.rel) === './family/brennan', 'other addresses are not touched');
    ok([l.docs, l.privacy, l.terms, l.hub].every(x => href(x) === x.attrs.href) && href(l.docs) === LINKS.docs && href(l.privacy) === LINKS.privacy && href(l.terms) === LINKS.terms && href(l.hub) === 'https://hub.ci.computer/store', 'the docs, privacy, terms and hub links are never touched');
    ok(p.observers === 1, 'a rule starts the watcher (the player draws its links later)');
    const late = a('https://ci.computer/core'); p.mutate([{ type: 'childList', addedNodes: [{ nodeType: 1, nodeName: 'DIV', matches: () => false, querySelectorAll: () => [late] }] }]);
    ok(href(late) === 'https://ci.computer/store/p/core', 'a link drawn later is mapped');
    const click = a('https://ci.computer/core'); p.fire('click', click);
    ok(href(click) === 'https://ci.computer/store/p/core', 'and one nothing else reached is mapped at click time');
    p.ctx.CICampaign.apply(p.doc); p.fire('click', l.core);
    ok(href(l.core) === 'https://ci.computer/store/p/core' && p.ctx.CICampaign.decorate('https://ci.computer/core') === 'https://ci.computer/store/p/core' && p.ctx.CICampaign.decorate(LINKS.docs) === LINKS.docs, 'a mapped link is mapped once; decorate() maps the same way and leaves the docs alone'); }

  // with the visitor's tags: the mapped address on ci.computer keeps them (that is the point of the mapping)
  { const l = links(); load({ search: `?${tags}`, links: Object.values(l), rules: file(rule()), today: '2026-10-20', script: SCRIPT }); await settle();
    ok(href(l.core) === `https://ci.computer/store/p/core?${tags}` && href(l.coreQ) === `https://ci.computer/store/p/core?ref=nav&${tags}#buy`, 'the tags are added to the mapped address on ci.computer, once');
    ok(href(l.dl) === `https://ci.computer/download?${tags}` && href(l.docs) === LINKS.docs, 'the other sanctioned links carry the tags as before, the docs do not'); }

  // a mapped link to another host: mapped, but the visitor's click ids are not sent there
  { const l = links(); load({ search: `?${tags}`, links: Object.values(l), rules: file(rule({ to: 'https://www.kickstarter.com/projects/x/y?ref=homes' })), today: '2026-10-20', script: SCRIPT }); await settle();
    ok(href(l.core) === 'https://www.kickstarter.com/projects/x/y?ref=homes' && href(l.coreQ) === 'https://www.kickstarter.com/projects/x/y?ref=homes&ref=nav#buy', 'a rule may point at another host; the visitor\'s tags do not follow'); }

  // the window: from..until, both days included, UTC
  for (const [day, mapped] of [['2026-09-30', false], ['2026-10-01', true], ['2026-11-12', true], ['2026-11-13', false]] as const) {
    const l = links(); load({ search: '', links: [l.core], rules: file(rule()), today: day, script: SCRIPT }); await settle();
    ok((href(l.core) === 'https://ci.computer/store/p/core') === mapped, `${day}: the rule ${mapped ? 'applies' : 'does not (outside 2026-10-01 to 2026-11-12)'}`);
  }

  // what the file may not do
  const bad: [string, object][] = [
    ['a rule that matches the docs', rule({ match: LINKS.docs })], ['privacy', rule({ match: LINKS.privacy })], ['terms', rule({ match: LINKS.terms })], ['the hub', rule({ match: 'https://hub.ci.computer/store' })], ['another page of ci.computer', rule({ match: 'https://ci.computer/pricing' })],
    ['a plain http target', rule({ to: 'http://example.com/x' })], ['a javascript: target', rule({ to: 'javascript:alert(1)' })], ['a target with a space', rule({ to: 'https://example.com/a b' })], ['a target with credentials', rule({ to: 'https://x@example.com/' })], ['a target that is itself a sanctioned address', rule({ to: 'https://ci.computer/download' })],
    ['no expiry', { match: 'https://ci.computer/core', to: 'https://ci.computer/store/p/core', from: '2026-10-01' }], ['an impossible date', rule({ until: '2026-02-30' })], ['an unknown key', { ...rule(), extra: 1 }], ['dates the wrong way round', rule({ from: '2026-11-12', until: '2026-10-01' })], ['a run of more than 180 days', rule({ until: '2027-06-01' })],
  ];
  for (const [what, r] of bad) {
    const l = links(); load({ search: '', links: Object.values(l), rules: file(r), today: '2026-10-20', script: SCRIPT }); await settle();
    ok(Object.values(l).every(x => href(x) === x.attrs.href) && l.core.attrs.href === 'https://ci.computer/core' && l.docs.attrs.href === LINKS.docs && l.hub.attrs.href === 'https://hub.ci.computer/store', `${what}: ignored, no link changes`);
  }
  // one bad rule beside a good one: the good one still applies
  { const l = links(); load({ search: '', links: [l.core, l.docs], rules: file(rule({ match: LINKS.docs }), rule()), today: '2026-10-20', script: SCRIPT }); await settle();
    ok(href(l.core) === 'https://ci.computer/store/p/core' && href(l.docs) === LINKS.docs, 'a bad rule does not take a good one down with it'); }
  // the first active rule for an address wins; a ruleless version or a wrong version is nothing
  { const l = links(); load({ search: '', links: [l.core], rules: file(rule({ to: 'https://example.com/one' }), rule({ to: 'https://example.com/two' })), today: '2026-10-20', script: SCRIPT }); await settle();
    ok(href(l.core) === 'https://example.com/one', 'the first active rule for an address wins'); }
  for (const [what, r] of [['version 2', { version: 2, rules: [rule()] }], ['no list', { version: 1 }], ['a list that is not a list', { version: 1, rules: 'x' }], ['null', null], ['a 404', 'missing'], ['a network error', 'fail']] as const) {
    const l = links(); load({ search: '', links: [l.core], rules: r as unknown, today: '2026-10-20', script: SCRIPT }); await settle();
    ok(href(l.core) === 'https://ci.computer/core', `${what}: the links stay as built and nothing throws`);
  }
  // no script address (a page that does not know where it was loaded from) or no fetch: nothing is read
  { const p = load({ search: '', links: [], rules: file(rule()), today: '2026-10-20' }); await settle(); ok(p.fetched.length === 0, 'without a script address no request is made'); }

  // portal:build's validator (the same functions): good, expired, stale, too long, overlapping, malformed
  const v = (data: unknown, day = '2026-10-20'): string[] => load({ search: '', links: [] }).ctx.CICampaign.validate(data, day);
  ok(v(file()).length === 0 && v(file(rule())).length === 0, 'validate(): the empty list and a good rule are clean');
  ok(v(file(rule({ until: '2026-10-19' }))).some(x => /expired on 2026-10-19/.test(x)) && v(file(rule({ until: '2026-10-20' }))).length === 0, 'validate(): a rule is stale the day after its last day, and the build refuses it');
  ok(v(file(rule({ until: '2027-06-01' }))).some(x => /more than 180 days/.test(x)) && v(file(rule({ from: '2026-10-01', until: '2027-03-29' }))).length === 0, 'validate(): a rule runs 180 days at most');
  ok(v(file(rule(), rule({ from: '2026-11-01', until: '2026-12-01' }))).some(x => /overlaps rule 1/.test(x)) && v(file(rule({ until: '2026-10-31' }), rule({ from: '2026-11-01', until: '2026-12-01' }))).length === 0, 'validate(): two rules for one address may not overlap in time');
  ok(bad.every(([, r]) => v(file(r)).length > 0), `validate(): each of the ${bad.length} malformed rules above is a problem`);
  ok(v({ version: 1, rules: [], extra: 1 }).length === 1 && v([]).length === 1 && v({ version: 2, rules: [] }).length === 1 && v({ version: 1, rules: 'x' }).length === 1, 'validate(): the file\'s own shape is held to version and rules');
  ok(v(shipped).length === 0, 'validate(): the shipped file passes');
}

// ---- the pages that load it ---------------------------------------------------------------------------------------------
console.log('pages');
{
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const cam = index.indexOf('<script src="./portal/campaign.js" defer data-cfasync="false"></script>'), gal = index.indexOf('<script type="module" src="./portal/gallery.js"');
  ok(cam > 0 && gal > cam, 'index.html loads campaign.js with defer and data-cfasync="false", before gallery.js');
  ok(/<a\b(?=[^>]*\bid="hero-play")(?=[^>]*\bdata-campaign\b)[^>]*\bhref="\.\/room-creator/.test(index) && /<a\b(?=[^>]*\bid="hero-media")(?=[^>]*\bdata-campaign\b)[^>]*\bhref="\.\/room-creator/.test(index), 'its hero links into the tour are marked data-campaign');
  const h = { id: 'aurora', name: 'Aurora', storeys: 3, areaSqm: 336, style: 'A modern villa' };
  const home = homePage(h, 'https://homes.ci.computer/');
  ok(home.includes('<script src="../portal/campaign.js" defer data-cfasync="false"></script>') && /<a class="btn btn-primary" href="\.\.\/room-creator\?mode=view&amp;house=aurora" data-campaign>/.test(home), 'a home\'s page loads it one level down and marks its way into the player');
  const notFound = notFoundPage('https://homes.ci.computer/', 'thirty');
  ok(notFound.includes('<script src="https://homes.ci.computer/portal/campaign.js" defer data-cfasync="false"></script>'), 'the 404 page, served at any depth, loads it by the site\'s own address');
  for (const [name, html] of [['index.html', index], ['a home\'s page', home], ['the 404', notFound]] as const) {
    ok([LINKS.site, LINKS.core, LINKS.download].every(u => html.includes(`href="${u}"`)) && !/href="https:\/\/ci\.computer\/?(core|download)?[?#]/.test(html), `${name}: the source hrefs to ci.computer, /core and /download have no query or fragment (the tags are added in the browser)`);
  }
}

console.log(`\n${failures ? `\x1b[31m${failures} failed\x1b[0m, ` : ''}${passes} passed`);
process.exit(failures ? 1 : 0);
