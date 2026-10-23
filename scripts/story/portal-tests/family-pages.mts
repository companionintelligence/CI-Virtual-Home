// The family pages of a built site (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test` (or `-- --only hooks`) after story work
//
// A family's page is the landing page of an ad. This holds it to that:
//
//   static    every family that has a page has family/<slug>.html and a sitemap entry without ".html"; the slugs are unique, the
//             pattern, and name no house; each page carries the four links, privacy and terms, one h1 and one main, a canonical
//             and a tour link that names the house and the family; a title no other page has; its fine print names the home and links
//             homes/<id> and credits no one (no builder, no build); the copy lint of the whole built site (scripts/story/lib/site-copy.mts: banned phrases, sentence case headings, the disclosures);
//             the story's words name no home and no builder; every app is in the Companion Hub catalog and the live store
//             the lander: the name, the tagline and the picture; "Take the tour" and "See Companion Core" (exactly https://ci.computer/core);
//             the one honest line about the 3D, and nothing "streamed"; the label and the footer's fine print from claims.json; a section for each person
//             whose id is theirs, "Start with <name>" (&member=) and, for each of their moments, "Watch this moment" (&beat=); what runs on
//             the Core; the chrome's own labels (Buy Companion Core, Download Companion) and the story's calls (See Companion Core); every
//             link into the player carries data-campaign, and portal/campaign.js loads first when the build has it; no price, no customer, no
//             third-party image that is not a real logo or screenshot of the manifest (story v2: alt, size, lazy, caption: the build checks it, this
//             checks each page's sections); the manifest's `narration` flag matches the voice; valid JSON-LD
//   browser   a family page at 1440 and 390 with no console error and no third-party request; the first screen of a phone holds the name, the
//             picture and both buttons; no sideways scroll; touch targets of 44 px; with JavaScript off the page is whole and a member's
//             #anchor lands on their section; light and dark; a campaign's tags ride from the page to the tour's address; the tour button, a
//             "Start with <name>", a "Watch this moment" and a shared moment (?t= ?beat= ?member=) all open the player on that house with the family
//
// A build with no family page (none is current yet) has nothing to test here and says so.
import fs from 'node:fs';
import path from 'node:path';
import type { TestCtx } from '../hooks.ts';
import { copyLint } from '../check-copy.mts';
import { needles, storyCopyLeaks } from '../check-leaks.mts';
import { loadAll, slugProblem } from '../site-lib.mts';
import { TOUR_NOTE } from '../pages.mts';
import { builderHandles, guardTerms, scanText } from '../../portal-redact.mts';

const LINKS = ['https://ci.computer', 'https://ci.computer/core', 'https://ci.computer/download', 'https://docs.ci.computer/docs/apps-available/first-party-apps', 'https://ci.computer/privacy-policy', 'https://ci.computer/terms-of-service'];
const decode = (v: string): string => v.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export default async function familyPages(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, OUT, ROOT } = ctx;
  const terms = guardTerms(builderHandles(ROOT));   // the builders' handles (from the specs), "Sims", "Base Game", "BG "
  const by: Record<string, { house: string; story?: string; audio?: Record<string, string>; narration?: boolean }> = (ctx.manifest as any).byFamily || {};
  const slugs = Object.keys(by);
  console.log('\nthe family pages');
  if (!slugs.length) { console.log('  no family has a page in this build (none is current yet): nothing to test'); return; }

  // ------------------------------------------------------------------ static
  const index = JSON.parse(fs.readFileSync(path.join(OUT, 'content', 'houses', 'index.json'), 'utf8'));
  const houseIds: string[] = index.houses.map((h: { id: string }) => h.id);
  const onDisk = fs.existsSync(path.join(OUT, 'family')) ? fs.readdirSync(path.join(OUT, 'family')).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, '')).sort() : [];
  ok(onDisk.join() === [...slugs].sort().join(), `family/ holds a page for each of the ${slugs.length} families the manifest lists, and no other`);
  const bad = slugs.map(slugProblem).filter(Boolean);
  const naming = slugs.filter(s => houseIds.some(id => new RegExp(`(^|-)${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-|$)`).test(s)));
  ok(new Set(slugs).size === slugs.length && bad.length === 0 && naming.length === 0, `the slugs are unique, the pattern, and name no house${bad[0] ? ` (${bad[0]})` : naming[0] ? ` (${naming[0]})` : ''}`);
  const sitemap = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  ok(slugs.every(s => locs.some(l => l.endsWith(`/family/${s}`))) && !locs.some(l => /\.html$/.test(l)), 'the sitemap lists every family page, extensionless');
  const read = (slug: string): string => fs.readFileSync(path.join(OUT, 'family', `${slug}.html`), 'utf8');
  const problems: string[] = [];
  for (const slug of slugs) {
    const t = read(slug), house = by[slug].house;
    for (const l of LINKS) if (!t.includes(`href="${l}"`)) problems.push(`${slug}: no link to ${l}`);
    if ((t.match(/<h1\b/g) || []).length !== 1 || (t.match(/<main\b/g) || []).length !== 1) problems.push(`${slug}: not exactly one h1 and one main`);
    if (!new RegExp(`<link rel="canonical" href="[^"]*/family/${slug}">`).test(t)) problems.push(`${slug}: its canonical is not family/${slug}`);
    if (/<meta name="robots"/.test(t)) problems.push(`${slug}: a robots tag on a page that is meant to be found`);
    if (!t.includes(`href="../room-creator?mode=view&amp;house=${house}&amp;family=${slug}"`)) problems.push(`${slug}: its tour link does not name the house and the family`);
    if (!t.includes(`<p class="home-note">The home is <a href="../homes/${house}">`)) problems.push(`${slug}: the fine print does not name the home and link homes/${house}`);
    if (/home-credit|\bCredit:/i.test(t) || scanText(`family/${slug}.html`, t, terms).length) problems.push(`${slug}: it credits a builder or names a build (${scanText(`family/${slug}.html`, t, terms)[0] || 'a credit line'})`);
    if (/href="[^"]*(index|room-creator)\.html/.test(t)) problems.push(`${slug}: a link names a .html page`);
    if (/\b(src|href)="\/(?!\/)/.test(t)) problems.push(`${slug}: a root-relative URL`);
  }
  // the link previews: an absolute JPEG that is in the output, and the twitter card's own tags
  const preview: string[] = [];
  for (const slug of slugs) {
    const t = read(slug), og = (t.match(/<meta property="og:image" content="([^"]*)"/) || [])[1] || '';
    let file = '';
    try { file = path.join(OUT, decodeURIComponent(new URL(og).pathname.replace(/^\//, ''))); } catch { /* reported below */ }
    const bytes = file && fs.existsSync(file) ? fs.readFileSync(file).subarray(0, 2) : Buffer.alloc(0);
    if (!/^https?:\/\//.test(og) || bytes[0] !== 0xff || bytes[1] !== 0xd8) preview.push(`${slug}: og:image ${og || '(none)'} is not an absolute JPEG in the output`);
    for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt', 'og:url', 'og:image:alt']) if (!new RegExp(`<meta (?:name|property)="${tag}"`).test(t)) preview.push(`${slug}: no ${tag}`);
  }
  ok(preview.length === 0, `each family page previews with an absolute JPEG that is in the output, and carries the card's tags${preview[0] ? `: ${preview.slice(0, 3).join(' | ')}` : ''}`);
  ok(problems.length === 0, `each family page carries the four links, privacy and terms, one h1 and one main, a canonical, a tour link, the home's name in the fine print and no credit${problems[0] ? `: ${problems.slice(0, 3).join(' | ')}` : ''}`);
  const lint = copyLint({ dir: OUT });
  ok(lint.length === 0, `the copy lint is clean over the whole built site (the front page, the homes' pages, ${slugs.length} family pages, the 404, the player's HTML, the tours' data, the cards and the strings of the player's source)${lint.length ? `: ${lint.slice(0, 3).join(' | ')}` : ''}`);
  const L = loadAll(ROOT, path.join(ROOT, 'content', 'families'));
  const n = needles(ROOT);
  const leaks = L.stories.filter(s => by[s.slug]).flatMap(s => storyCopyLeaks(s, n));
  ok(leaks.length === 0, `the story's words name no home and no builder${leaks.length ? `: ${leaks.slice(0, 3).join(' | ')}` : ''}`);

  // ---- the lander: what an ad's visitor reads
  const titles = slugs.map(s => (read(s).match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  ok(new Set(titles).size === titles.length && titles.every(t => t.length > 0 && t.length <= 60), `every family page has a title of its own, at most 60 characters (${slugs.length} titles, ${new Set(titles).size} different)`);
  const claim = (id: string): string => (L.claims.disclosures as { id: string; text: string }[]).find(d => d.id === id)!.text;
  const campaignJs = fs.existsSync(path.join(OUT, 'portal', 'campaign.js'));
  const lander: string[] = [];
  for (const s of L.stories.filter(x => by[x.slug])) {
    const t = read(s.slug), hero = (t.match(/<section class="hero"[\s\S]*?<\/section>/) || [''])[0], main = (t.match(/<main[\s\S]*?<\/main>/) || [''])[0], head = (t.match(/<header class="site-head">[\s\S]*?<\/header>/) || [''])[0], foot = (t.match(/<footer[\s\S]*?<\/footer>/) || [''])[0];
    const words = decode(main.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    const need = (cond: unknown, what: string): void => { if (!cond) lander.push(`${s.slug}: ${what}`); };
    need(hero.includes(`>The ${s.family.surname} family</h1>`) && words.includes(s.family.tagline) && hero.includes(`/portal/previews/${s.house}.jpg"`.replace(/^\//, '')), 'the hero: the name, the tagline and the home\'s picture');
    need(/<span>Take the tour<\/span>/.test(hero) && hero.includes(`href="${LINKS[1]}" data-campaign>See Companion Core</a>`) && (hero.match(/btn-primary/g) || []).length === 1, 'the hero: one primary button, "Take the tour", and "See Companion Core" to exactly https://ci.computer/core');
    need(hero.includes(TOUR_NOTE) && !/streamed/i.test(hero), `the one honest line (${TOUR_NOTE}) and nothing "streamed" in the hero (a moment may say what a rival cloud service streams: brennan-hollin's GeForce Now)`);
    // the label is the header's chip (once), and the rest of the fine print is the footer's (scripts/story/lib/fine-print.mts, surfaces family-fold and family-footer)
    for (const id of ['fictional-family']) need(words.includes(claim(id)), `the first screen's ${id} line, from claims.json`);
    const footWords = decode(foot.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    for (const id of ['launch-not-offer', 'scripted-scenes', 'stylised-art']) need(footWords.includes(claim(id)), `the footer's ${id} line, from claims.json`);
    for (const m of s.members) {
      const sec = (t.match(new RegExp(`<section class="who[^"]*" id="${m.id}"[\\s\\S]*?</section>`)) || [''])[0];
      need(sec && sec.includes(`<h2 id="${m.id}-h" class="nm">${m.name}</h2>`) && sec.includes(`Age ${m.age}`), `${m.id}: a section with their id, their name (as written: the kicker's capitals are CSS) and age`);
      const mine = s.beats.filter(b => b.member === m.id && !['ftue', 'outro'].includes(s.chapters.find(c => c.id === b.chapter)?.kind || ''));
      if (mine.length) need(sec.includes(`&amp;family=${s.slug}&amp;member=${m.id}"`), `${m.id}: "Start with ${m.name}" (&member=${m.id})`);
      for (const b of mine) need(sec.includes(`id="b-${b.id}"`) && sec.includes(`&amp;family=${s.slug}&amp;beat=${b.id}" data-campaign`), `${m.id}: ${b.id} is a block with "Watch this moment" (&beat=${b.id})`);
    }
    need(/id="apps"/.test(t) && /What runs on the Core/.test(t) && /hub\.ci\.computer\/store\//.test(t), 'what runs on the Core, with the Companion Hub store pages');
    need(/>Buy Companion Core</.test(head) && />Buy Companion Core</.test(foot) && />Download Companion</.test(head) && !/Buy Companion Core/.test(main), 'the chrome keeps "Buy Companion Core" and "Download Companion"; the story says "See Companion Core"');
    // (story v2: the real, labelled files of content/story/app-media.json are the only third-party images. Every other image is the brand mark twice and the home's picture.)
    const imgs = (t.match(/<img\b[^>]*>/g) || []).filter(i => !/src="\.\.\/portal\/(apps|ci)\//.test(i));
    need(imgs.length === 3, `no third-party image that is not a real logo or screenshot of the manifest (three others: the brand mark twice and the home), got ${imgs.length}`);
    need(!/[$€£]\s?\d|\b\d[\d,.]*\s?(USD|dollars?|euros?|pounds?)\b/i.test(words), 'no price (an amount of money)');
    need(!/analytics|no cookies|no third-party/i.test(words), 'no claim about analytics, cookies or third parties (the deployed site adds Google Analytics)');
    for (const a of t.match(/<a\b[^>]*href="\.\.\/room-creator[^"]*"[^>]*>/g) || []) need(/ data-campaign/.test(a), `a link into the player has no data-campaign: ${a.slice(0, 80)}`);
    if (campaignJs) need(/<script src="\.\.\/portal\/campaign\.js\?v=[0-9a-f]{10}" defer data-cfasync="false"><\/script>/.test(t) && t.indexOf('campaign.js') < t.indexOf('location.replace('), 'portal/campaign.js loads, hashed, before the script that forwards a shared moment');
    const voiced = !!by[s.slug].story && Object.keys(by[s.slug].audio || {}).length > 0;
    need(by[s.slug].story ? by[s.slug].narration === voiced : by[s.slug].narration === undefined, `the manifest says ${by[s.slug].narration} for narration of a tour that ${voiced ? 'has' : 'has no'} voice`);
    need(words.includes('Narration is generated locally') === voiced, `the synthetic voice line is on the page exactly when the tour has a voice (${voiced})`);
    for (const m of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { const j = JSON.parse(m[1]); const g = j['@graph'] || [j]; if (!g.some((x: any) => x['@type'] === 'WebPage') || !g.some((x: any) => x['@type'] === 'BreadcrumbList')) need(false, 'JSON-LD without a WebPage and a BreadcrumbList'); } catch { need(false, 'JSON-LD that is not JSON'); } }
  }
  ok(lander.length === 0, `each family page is a lander: the hero with the label from claims.json, a section for each person with "Start with" and "Watch this moment", the apps, the chrome's labels, no price or logo${lander[0] ? `: ${lander.slice(0, 3).join(' | ')}` : ''}`);

  // ------------------------------------------------------------------ browser
  const slug = slugs.find(s => by[s].story) || slugs[0], house = by[slug].house;
  const story = L.stories.find(s => s.slug === slug);
  const second = story ? story.members[Math.min(1, story.members.length - 1)] : null;
  for (const [vw, vh, mobile, label] of [[1440, 900, false, '1440'], [390, 844, true, '390']] as const) {
    const { page, errors, thirdParty, close } = await ctx.open({ width: vw, height: vh }, mobile);
    await page.goto(ctx.url(`family/${slug}`));
    await sleep(500);
    ok((await page.$$eval('h1', (e: Element[]) => e.length)) === 1 && (await page.isVisible('.poster img')) && (await page.isVisible('.hero-actions .btn-primary')) && (await page.isVisible('.hero-actions a[href="https://ci.computer/core"]')), `${slug} at ${label}: the page shows its heading, its picture, the tour button and See Companion Core`);
    // (a phone's header is the same bar as a laptop's, with the short forms "Download" and "Buy Core": both stay in reach, and the closing band offers the Core again)
    ok(await page.isVisible('.site-nav .nav-buy') && await page.isVisible('.site-nav .nav-download') && await page.isVisible('.closing a[href="https://ci.computer/core"]') && await page.isVisible('.home-note a'), 'it offers the Companion Core and its fine print links the home');
    const fold = await page.evaluate((vh: number) => {
      const b = (sel: string) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, w: r.width, h: r.height }; };
      return { h1: b('.hero h1'), tag: b('.hero .tagline'), poster: b('.hero .poster'), tour: b('.hero-actions .btn-primary'), core: b('.hero-actions a[href="https://ci.computer/core"]'), label: b('.hero .disclosure strong'), note: b('.hero-note'), scrollX: document.documentElement.scrollWidth - innerWidth, vh };
    }, vh);
    if (mobile) {
      const inFold = ['h1', 'tag', 'poster', 'tour', 'core', 'label'].filter(k => !(fold as any)[k] || (fold as any)[k].bottom > vh);
      ok(inFold.length === 0, `at 390 x 844 the first screen holds the label, the name, the tagline, the picture and both buttons${inFold.length ? ` (below the fold: ${inFold.join(', ')})` : ''}`);
      const small = [['tour', fold.tour], ['core', fold.core]].filter(([, r]: any) => !r || r.h < 43.5);
      ok(small.length === 0, 'and the two buttons are 44 px targets');
    } else ok(fold.poster && fold.tour && fold.poster.top < 600 && fold.tour.bottom < vh, 'at 1440 the picture and the tour button are above the fold');
    ok(fold.scrollX <= 1, `no sideways scroll (${Math.round(fold.scrollX)} px over)`);
    if (mobile) {
      // the touch targets of the whole page: the people's links, "Start with", "Watch this moment", the store links, the neighbours
      const small = await page.evaluate(() => Array.from(document.querySelectorAll('main a[href], .site-nav a')).filter(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && !e.closest('[hidden]') && r.height < 43.5 && !(e as HTMLElement).closest('.site-nav'); }).map(e => `${(e.textContent || '').trim().slice(0, 24)} ${Math.round(e.getBoundingClientRect().height)}`));
      ok(small.length === 0, `every link and button of the page is a 44 px target on a phone${small.length ? ': ' + small.slice(0, 4).join(', ') : ''}`);
    }
    await ctx.shot(page, `family-${label}`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    ok(thirdParty.length === 0, `no third-party request${thirdParty.length ? ': ' + thirdParty.join(' | ') : ''}`);
    await close();
  }
  // light and dark: the same page, the dark set of the canon when the system asks for it; the text readable in both
  for (const scheme of ['light', 'dark'] as const) {
    const { page, errors, close } = await ctx.open({ width: 390, height: 844 }, true, { colorScheme: scheme });
    await page.goto(ctx.url(`family/${slug}`)); await sleep(400);
    const c = await page.evaluate(() => {
      const rgb = (v: string) => (v.match(/[\d.]+/g) || []).map(Number);
      const lum = (c: number[]) => { const f = (x: number) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const ratio = (a: number[], b: number[]) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const bg = rgb(getComputedStyle(document.body).backgroundColor);
      const worst = (sel: string) => Math.min(...Array.from(document.querySelectorAll(sel)).map(e => ratio(rgb(getComputedStyle(e).color), bg)));
      return { bg, body: ratio(rgb(getComputedStyle(document.body).color), bg), h1: worst('.hero h1'), muted: worst('.tagline, .who-facts, .hero-note'), link: worst('.play-from') };
    });
    // (the page's one heading is the family's name as a kicker, in the accent: large bold text, so the 4.5:1 that is AAA for it; the accent is 6.7:1 on the light set, like the links)
    ok(c.body >= 7 && c.h1 >= 4.5 && c.muted >= 4.5 && c.link >= 4.5, `${scheme}: the text is readable on the page's own background (body ${c.body.toFixed(1)}, heading ${c.h1.toFixed(1)}, muted ${c.muted.toFixed(1)}, links ${c.link.toFixed(1)})`);
    await ctx.shot(page, `family-${scheme}-390`);
    ok(errors.length === 0, `${scheme}: no console errors`);
    await close();
  }
  // no JavaScript: nothing of the page waits for a script (the tour link is an enhancement), and a person's address lands on their section
  {
    const { page, close } = await ctx.open({ width: 1280, height: 800 }, false, { javaScriptEnabled: false });
    await page.goto(ctx.url(`family/${slug}${second ? `#${second.id}` : ''}`)); await sleep(500);
    const info = await page.evaluate((id: string | null) => ({
      people: Array.from(document.querySelectorAll('section.who')).map(e => e.id), moments: document.querySelectorAll('.moment').length,
      tour: !!document.querySelector('.hero-actions a.btn-primary[href*="room-creator"]'), label: (document.querySelector('.hero .disclosure')?.textContent || '').includes('Fictional family. Real software.'),
      at: id ? (document.getElementById(id)?.getBoundingClientRect().top ?? 9999) : 0, bar: getComputedStyle(document.getElementById('tourbar')!).display,
    }), second ? second.id : null);
    ok(story ? story.members.every(m => info.people.includes(m.id)) && info.moments > 0 && info.tour && info.label : info.tour, 'with JavaScript off the page is whole: the people, their moments, the tour link and the label');
    // (the page scrolls smoothly to an address's fragment: give it a moment to arrive)
    let at = info.at;
    for (let k = 0; second && k < 12 && !(at >= -2 && at < 200); k++) { await sleep(250); at = await page.evaluate((id: string) => document.getElementById(id)?.getBoundingClientRect().top ?? 9999, second.id); }
    ok(!second || (at >= -2 && at < 200), `and #${second ? second.id : ''} lands on that person's section (${Math.round(at)} px from the top)`);
    ok(info.bar === 'none', 'the phone\'s sticky tour button is not there without a script');
    await close();
  }
  // a campaign's tags ride from the page to the tour and on to ci.computer (portal/campaign.js) when the build has it
  {
    const { page, errors, close } = await ctx.open({ width: 1280, height: 800 });
    await page.goto(ctx.url(`family/${slug}?utm_source=meta&utm_campaign=uncloud&fbclid=zz9`)); await sleep(600);
    const hrefs = await page.evaluate(() => ({ tour: document.querySelector<HTMLAnchorElement>('.hero-actions .btn-primary')!.getAttribute('href'), core: document.querySelector<HTMLAnchorElement>('.hero-actions a[href^="https://ci.computer/core"]')!.getAttribute('href'), start: document.querySelector<HTMLAnchorElement>('.who-start')?.getAttribute('href') || '', watch: document.querySelector<HTMLAnchorElement>('.play-from')?.getAttribute('href') || '' }));
    if (campaignJs) {
      ok(['utm_source=meta', 'utm_campaign=uncloud', 'fbclid=zz9'].every(k => hrefs.tour!.includes(k) && hrefs.start.includes(k) && hrefs.watch.includes(k) && hrefs.core!.includes(k)), `the ad's tags are on the tour, "Start with", "Watch this moment" and See Companion Core (${hrefs.core})`);
      await page.click('.hero-actions .btn-primary');
      await page.waitForURL(/room-creator\?mode=view/, { waitUntil: 'commit', timeout: 30000 });
      await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 240000 });
      await sleep(800);
      const q = new URL(page.url()).searchParams;
      ok(q.get('utm_source') === 'meta' && q.get('utm_campaign') === 'uncloud' && q.get('fbclid') === 'zz9' && q.get('family') === slug, `and the player's own rewriting of its address keeps them (${page.url().replace(/^.*\?/, '?').slice(0, 120)})`);
    } else ok(!/utm_|fbclid/.test(hrefs.tour || ''), '(no campaign.js in this build: the links are as built)');
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }
  {
    const { page, errors, close } = await ctx.open({ width: 1280, height: 800 });
    await page.goto(ctx.url(`family/${slug}`));
    await page.click('.hero-actions .btn-primary');
    await page.waitForURL(/room-creator\?mode=view/, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 240000 });
    const q = new URL(page.url()).searchParams;
    ok(q.get('house') === house && (q.get('family') === slug || !by[slug].story), `the tour button opens the player on ${house}${by[slug].story ? ' with the family in the address' : ''}`);
    ok(errors.length === 0, `no console errors in the player${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }
  // "Start with <name>" and "Watch this moment" open the player at that person and that beat; the page forwards a shared moment likewise
  if (story && second) {
    const mine = story.beats.find(b => b.member === second.id && !['ftue', 'outro'].includes(story.chapters.find(c => c.id === b.chapter)?.kind || ''));
    for (const [sel, param, want] of [[`#${second.id} .who-start`, 'member', second.id], [`#b-${mine?.id} .play-from`, 'beat', mine?.id || '']] as const) {
      const { page, close } = await ctx.open({ width: 1280, height: 800 });
      await page.goto(ctx.url(`family/${slug}`));
      if (param === 'beat' && !mine) { await close(); continue; }
      await page.click(sel);
      await page.waitForURL(/room-creator\?mode=view/, { waitUntil: 'commit', timeout: 30000 });
      const q = new URL(page.url()).searchParams;
      ok(q.get('house') === house && q.get('family') === slug && q.get(param) === want, `${sel.replace(/#b-[^ ]+/, '#b-<beat>')} opens the player on ${house} with ${param}=${want}`);
      await close();
    }
  }
  for (const [qs, key, want] of [['t=0.5&shot=orbit', 'shot', 'orbit'], ...(story && second ? [[`beat=${story.beats[2].id}`, 'beat', story.beats[2].id], [`member=${second.id}`, 'member', second.id]] : [])] as [string, string, string][]) {
    const { page, close } = await ctx.open({ width: 1280, height: 800 });
    await page.goto(ctx.url(`family/${slug}?${qs}`), { waitUntil: 'commit' });
    await page.waitForURL(/room-creator\?mode=view/, { waitUntil: 'commit', timeout: 30000 });
    const q = new URL(page.url()).searchParams;
    ok(q.get('house') === house && q.get('family') === slug && q.get(key) === want, `a shared moment on a family page (?${qs}) forwards to the player with the house, the family and the moment`);
    await close();
  }
}
