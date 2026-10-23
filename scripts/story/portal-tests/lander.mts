// The front page, the Companion Core's lander, in a built site and a browser (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test -- --only hooks` after front page work
//
// What the page promises (reference/story/lander.md), held where a person meets it:
//   the fold      at 1440 × 900 and 390 × 844 the message, the label, what a Core is, "Take the tour" and Buy (and Download) are inside the first screen
//   depth         the Core's offer is at most 3 screens down on a desktop and 2.5 on a phone, the whole page at most 5 and 7.5 (it was 9.6 and 23.5 down); the sticky header keeps
//                 Buy and Download in reach after two screens of scroll; nothing scrolls sideways at 320, 390, 768 and 1440
//   the chooser   a chip narrows the families and puts service= in the address with every other parameter (an ad's tags) kept byte for byte; the cards shown are the chip's
//                 count; a second press lets go; a job chip narrows the chips; "Clear filters" resets; the search finds the same families as the chip; ?service= from an ad lights
//                 the chip and brings the first result into view; a held service, an unknown id or an old archetype id never breaks the page
//   no script     everything that argues, proves and offers reads, the details opens by a click, the controls are inert (disabled), the noscript lines show
//   failing       with index.json refused, the failure line shows and the blocks and the families stay
//   people        heading levels without a skip, labelled blocks, the header's tab order, 44 px targets on a phone, no console error, no third party
import fs from 'node:fs';
import path from 'node:path';
import type { TestCtx } from '../hooks.ts';

export default async function lander(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, OUT, ROOT } = ctx;
  console.log('\nthe lander');
  const J = (...p: string[]): any => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));
  const claims = J(ROOT, 'content', 'story', 'claims.json');
  const claim = (id: string): string => claims.allowedClaims.find((c: { id: string }) => c.id === id).text;
  const HOMES: number = J(OUT, 'content', 'houses', 'index.json').houses.length;
  const BLOCKS = ['hero', 'argument', 'proof', 'core', 'swap', 'homes'];
  const visible = (page: any): Promise<number> => page.$$eval('#grid .card, #grid-rest .card', (els: HTMLElement[]) => els.filter(e => !e.hidden).length);
  const slugsShown = (page: any): Promise<string[]> => page.$$eval('.card-family', (els: HTMLElement[]) => els.filter(e => !e.hidden).map(e => e.dataset.slug || '').sort());
  const ready = (page: any): Promise<unknown> => page.waitForFunction(() => document.documentElement.dataset.gallery, null, { timeout: 20000 });
  const TAGS = 'utm_source=meta&utm_campaign=lander&fbclid=AbC_123-xyz%2B';

  for (const [tag, viewport, mobile] of [['1440', { width: 1440, height: 900 }, false], ['390', { width: 390, height: 844 }, true]] as const) {
    const { page, errors, thirdParty, requests, close } = await ctx.open(viewport, mobile);
    await page.goto(ctx.url(''));
    await ready(page);
    // ---- the fold
    const fold = await page.evaluate(() => {
      const box = (sel: string) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
      return { vh: innerHeight, vw: innerWidth, h1: box('h1'), label: box('.fiction-label'), lede: box('.lede'), tour: box('#hero-play'), buy: box('.site-head .nav-buy'), dl: box('.site-head .nav-download'),
        dlShown: getComputedStyle(document.querySelector('.site-head .nav-download')!).display !== 'none', h1Text: document.querySelector('h1')!.textContent, lede1: document.querySelector('.lede')!.textContent };
    });
    const inView = (b: { top: number; bottom: number; right: number } | null): boolean => !!b && b.top >= 0 && b.bottom <= fold.vh && b.right <= fold.vw + 1;
    ok([fold.h1, fold.label, fold.lede, fold.tour, fold.buy, fold.dl].every(inView) && fold.dlShown, `${tag}: the message, the label, what a Core is, "Take the tour", Buy and Download are all inside the first screen`);
    ok(fold.h1Text === claim('rent-line') && /^A Companion Core is a small personal server\b/.test(fold.lede1 || ''), `${tag}: the message is claims.json's rent-line ("${fold.h1Text}") and the next sentence says what a Core is`);
    // ---- depth, the order of the blocks, and the sticky header
    const depth = await page.evaluate((blocks: string[]) => {
      const at = (id: string) => (id === 'hero' ? document.querySelector('.hero') : id === 'core' ? document.getElementById('core') : document.getElementById(id));
      const tops = blocks.map(id => { const e = at(id); return e ? e.getBoundingClientRect().top + scrollY : -1; });
      return { vh: innerHeight, tops, height: document.documentElement.scrollHeight };
    }, BLOCKS);
    const present = BLOCKS.filter((_, i) => depth.tops[i] >= 0);
    ok(present.map(b => depth.tops[BLOCKS.indexOf(b)]).every((t, i, a) => i === 0 || t > a[i - 1]) && present.includes('core') && present.includes('swap') && present.includes('homes'), `${tag}: the blocks are in order: ${present.join(', ')}`);
    const coreAt = depth.tops[BLOCKS.indexOf('core')] / depth.vh, pageAt = depth.height / depth.vh;
    ok(coreAt <= (mobile ? 2.5 : 3.0), `${tag}: the Core's offer is ${coreAt.toFixed(2)} screens down (at most ${mobile ? 2.5 : 3}; the page it replaces was ${mobile ? 23.5 : 9.6})`);
    ok(pageAt <= (mobile ? 7.5 : 5.0), `${tag}: the whole page is ${pageAt.toFixed(2)} screens (at most ${mobile ? 7.5 : 5})`);
    // (before any scroll: what the first load asks for, which is what a phone pays for) no media image from the app or Companion folders, no Core frame until it nears the screen
    const early = requests.map((u: string) => u.replace(ctx.base, ''));
    ok(!early.some((u: string) => /^portal\/(apps|ci)\//.test(u)), `${tag}: no logo or screenshot is asked for (the front page names apps in text)`);
    const restIds: string[] = await page.$$eval('#grid-rest .card', (els: HTMLElement[]) => els.map(e => e.dataset.id || ''));
    ok(restIds.length > 20 && !restIds.some(id => early.includes(`portal/thumbs/${id}.webp`)), `${tag}: the ${restIds.length} families and homes behind the closed disclosure are not asked for (${early.length} requests on the first load)`);
    ok(await page.$$eval('.core-fig img', (els: HTMLImageElement[]) => els.length === 1 && els[0].loading === 'lazy' && els[0].width > 0 && els[0].height > 0), `${tag}: the Core's picture is lazy and has its size, so nothing jumps when it comes`);
    await page.evaluate(() => window.scrollTo({ top: innerHeight * 2, behavior: 'instant' as ScrollBehavior }));
    await sleep(250);
    const sticky = await page.evaluate(() => { const r = (s: string) => document.querySelector(s)!.getBoundingClientRect(); const h = r('.site-head'), b = r('.nav-buy'), d = r('.nav-download'); return { top: h.top, buy: b.top >= 0 && b.bottom <= innerHeight, dl: d.height > 0 && d.top >= 0 && d.bottom <= innerHeight }; });
    ok(sticky.top === 0 && sticky.buy && sticky.dl, `${tag}: after two screens of scroll the header is still on top with Buy and Download in reach`);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
    // ---- people: heading levels, labelled blocks, the tab order of the header, touch targets
    const heads: number[] = await page.$$eval('h1, h2, h3', (els: Element[]) => els.map(e => Number(e.tagName[1])));
    ok(heads[0] === 1 && heads.every((h, i) => i === 0 || h <= heads[i - 1] + 1) && heads.filter(h => h === 1).length === 1, `${tag}: heading levels never skip (${heads.join('')})`);
    const labelled = await page.$$eval('main > section', (els: Element[]) => els.every(e => { const id = e.getAttribute('aria-labelledby'); return !!id && !!document.getElementById(id)?.textContent?.trim(); }));
    ok(labelled, `${tag}: every block of the page is labelled by its heading`);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const order: string[] = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const a = document.activeElement as HTMLAnchorElement; return a?.dataset?.cta || a?.className?.split(' ')[0] || a?.tagName || ''; })); }
    ok(order[0] === 'skip' && order[1] === 'brand-ci' && order.indexOf('download') > 1 && order.indexOf('buy') > order.indexOf('download'), `${tag}: the header's tab order is the skip link, the brand, then Docs, Download and Buy (${order.join(', ')})`);
    if (mobile) {
      const small = await page.evaluate(() => ['.pair', '.tag.persona', '.btn', '.hero-pointer', '.site-nav a', '.proof-actions a', '#clear', '#q', '#types button', '.foot-homes a', '.foot-links a', '.siblings a', '.foot-apps summary', '.all-homes summary'].flatMap(sel => Array.from(document.querySelectorAll(sel)).filter(e => (e as HTMLElement).offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return { sel, h: Math.round(r.height), w: Math.round(r.width) }; })).filter(x => x.h > 0 && (x.h < 43.5 || x.w < 43.5)));
      ok(small.length === 0, `390: every control is a 44 px target${small.length ? ` (${small.slice(0, 3).map(x => `${x.sel} ${x.w}x${x.h}`).join(', ')})` : ''}`);
    }
    ok(errors.length === 0, `${tag}: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    ok(thirdParty.length === 0, `${tag}: no third party is asked for anything${thirdParty.length ? ': ' + thirdParty.join(' | ') : ''}`);
    await close();
  }

  // ---- no sideways scroll at any width
  {
    const { page, close } = await ctx.open({ width: 1440, height: 900 });
    await page.goto(ctx.url(''));
    await ready(page);
    const wide: string[] = [];
    for (const w of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      await sleep(250);
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) wide.push(String(w));
    }
    ok(wide.length === 0, `nothing scrolls sideways at 320, 390, 768 and 1440${wide.length ? ` (it does at ${wide.join(', ')})` : ''}`);
    await close();
  }

  // ---- the chooser, with an ad's tags in the address
  {
    const { page, close } = await ctx.open({ width: 1440, height: 900 });
    await page.goto(ctx.url(`?${TAGS}&m=1`));
    await ready(page);
    const featuredN = await page.$$eval('#grid .card', (els: Element[]) => els.length);
    const chip = await page.evaluate(() => { const b = document.querySelector('#pairs .pair:not(:disabled)') as HTMLButtonElement; return { id: b.dataset.service!, label: b.getAttribute('aria-label')! }; });
    const want: string[] = await page.$$eval(`.card-family[data-service~="${chip.id}"]`, (els: HTMLElement[]) => els.map(e => e.dataset.slug || '').sort());
    await page.click(`#pairs .pair[data-service="${chip.id}"]`);
    await sleep(1200);
    const after = await page.evaluate(() => ({ search: location.search, open: (document.getElementById('all-homes') as HTMLDetailsElement).open, live: document.getElementById('homes-live')!.textContent || '', pressed: document.querySelector('#pairs .pair[aria-pressed="true"]')?.getAttribute('data-service') || '' }));
    ok(after.search.startsWith(`?${TAGS}&m=1`) && after.search.includes(`service=${chip.id}`) && after.pressed === chip.id, `a chip writes service=${chip.id} and keeps the ad's tags byte for byte (${after.search})`);
    const shown = await slugsShown(page);
    ok(JSON.stringify(shown) === JSON.stringify(want) && shown.length > 1 && after.open && /^Showing .+ of .+ fictional families\.$/.test(after.live), `it shows the ${shown.length} families that show that service, the details open, and says so in words ("${after.live}")`);
    const firstTop = await page.evaluate(() => { const li = Array.from(document.querySelectorAll('#grid .card, #grid-rest .card')).find(e => !(e as HTMLElement).hidden)!; const b = li.getBoundingClientRect(); return b.top; });
    ok(firstTop >= 0 && firstTop < 900, `the first result is brought into view (${Math.round(firstTop)} px from the top)`);
    ok(await page.evaluate((id: string) => Array.from(document.querySelectorAll('.card-family:not([hidden]) .pairs-lines li.hit')).length > 0 && Array.from(document.querySelectorAll('.card-family:not([hidden])')).every(c => !!c.querySelector(`.pairs-lines li[data-service="${id}"]:not([hidden])`)), chip.id), 'a card shows the pair that was asked for, whatever else it hides');
    await page.click(`#pairs .pair[data-service="${chip.id}"]`);
    await sleep(300);
    const back = await page.evaluate(() => ({ search: location.search, open: (document.getElementById('all-homes') as HTMLDetailsElement).open }));
    ok(back.search === `?${TAGS}&m=1` && !back.open && (await page.$$eval('#grid .card:not([hidden])', (els: Element[]) => els.length)) === featuredN, 'a second press lets go: the featured cards, the details closed and the address as it was');
    // a job narrows the chips; a chip narrows the families; Clear filters resets
    const labels = (): Promise<string[]> => page.$$eval('#pairs .pair', (els: HTMLButtonElement[]) => els.map(b => b.getAttribute('aria-label') || ''));
    const before = await labels();
    await page.click('#personas .persona[data-persona="play"]');
    const narrowed = await labels();
    const codeN = (await slugsShown(page)).length;
    const playN: number = await page.$$eval('.card-family[data-persona~="play"]', (els: Element[]) => els.length);
    ok(codeN === playN && codeN > 0 && codeN < 30 && narrowed.filter((l, i) => l !== before[i]).length >= 5, `a job chip narrows the families (${codeN}) and the count in each service chip's name (${narrowed.filter((l, i) => l !== before[i]).length} of ${before.length} changed)`);
    await page.click('#pairs .pair:not(:disabled)');
    ok((await slugsShown(page)).length <= codeN && (await page.evaluate(() => location.search)).includes('persona=play') && (await page.evaluate(() => location.search)).includes('service='), 'then a service chip narrows it further, both in the address');
    await page.click('#clear');
    const cleared = await page.evaluate(() => ({ search: location.search, pressed: document.querySelectorAll('[aria-pressed="true"]').length, any: document.querySelector('#types button[aria-pressed="true"]')?.getAttribute('data-type') }));
    ok(cleared.search === `?${TAGS}&m=1` && (await visible(page)) === HOMES && cleared.pressed <= 1, '"Clear filters" resets every choice and leaves the ad\'s tags');
    // the search for a service finds the same families as its chip
    await page.fill('#q', 'Google Photos');
    await sleep(300);
    const viaSearch = await slugsShown(page);
    const viaChip: string[] = await page.$$eval('.card-family[data-service~="google-photos"]', (els: HTMLElement[]) => els.map(e => e.dataset.slug || '').sort());
    ok(JSON.stringify(viaSearch) === JSON.stringify(viaChip) && viaSearch.length > 3, `searching "Google Photos" finds the ${viaSearch.length} families the chip does`);
    await page.fill('#q', '');
    await close();
  }
  // ---- a link an ad can carry: a service, an old archetype, a held service, an id nothing has
  for (const [query, expect, why] of [['service=google-photos', 'filtered', 'a service-targeted ad lights the chip and filters'], ['persona=gamer', 'filtered', 'an old archetype id still filters'], ['persona=code', 'filtered', 'a category id filters'],
    ['service=chatgpt', 'plain', 'a held service loads the page unfiltered'], ['service=nosuch&persona=nosuch&type=nosuch', 'plain', 'ids nothing has load the page unfiltered'], ['persona=Not%20An%20Id', 'plain', 'a malformed id is ignored']] as const) {
    const { page, errors, close } = await ctx.open({ width: 1440, height: 900 });
    await page.goto(ctx.url(`?${query}`));
    await ready(page);
    await sleep(500);
    const n = await visible(page);
    const featuredN = await page.$$eval('#grid .card', (els: Element[]) => els.length);
    const pressed = await page.$$eval('#pairs .pair[aria-pressed="true"], #personas .persona[aria-pressed="true"]', (els: Element[]) => els.length);
    ok(expect === 'filtered' ? n > 0 && n < HOMES && (query.startsWith('service=') ? pressed === 1 : true) : n === HOMES && pressed === 0, `?${query}: ${why} (${n} of ${HOMES} cards, ${pressed} chips pressed)`);
    ok(errors.length === 0, `?${query}: no console error`);
    await close();
  }

  // ---- no JavaScript: it all reads, the controls are inert, the details opens by a click
  {
    const { page, close } = await ctx.open({ width: 1440, height: 900 }, false, { javaScriptEnabled: false });
    await page.goto(ctx.url(''));
    const t = await page.evaluate(() => {
      const text = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.innerText || '';
      return { h1: text('h1'), argument: text('#argument').length, proof: text('#proof').length, core: text('#core').length, tour: !!document.querySelector('#hero-play'), noscript: text('.hero-noscript'), featured: document.querySelectorAll('#grid .card-family').length,
        rest: document.querySelectorAll('#grid-rest .card').length, inert: Array.from(document.querySelectorAll('#swap button, #q')).every(c => (c as HTMLButtonElement).disabled), familyLinks: document.querySelectorAll('a[href*="family/"]').length };
    });
    ok(t.h1 === claim('rent-line') && t.argument > 200 && t.core > 200 && t.tour && t.featured >= 1 && t.rest >= 20, `without JavaScript the message, the argument, the offer and the cards read (${t.featured} featured, ${t.rest} more behind the disclosure)`);
    ok(t.inert && /read the family's story/i.test(t.noscript) && t.familyLinks >= 30, `and the controls are inert (not focusable), the noscript line offers the family's story, every family has a link (${t.familyLinks})`);
    await page.click('#all-homes summary');
    ok(await page.evaluate(() => (document.getElementById('all-homes') as HTMLDetailsElement).open && Array.from(document.querySelectorAll('#grid-rest .card')).every(e => (e as HTMLElement).offsetParent !== null)), 'the details opens by a click and every other family and home shows');
    await close();
  }

  // ---- the list of homes refused: the page says so under the families, and the blocks and the families stay
  {
    const { page, close } = await ctx.open({ width: 1440, height: 900 });
    await page.route((u: URL) => u.pathname.endsWith('/content/houses/index.json'), (r: any) => r.fulfill({ status: 503, contentType: 'text/plain', body: 'down' }));
    await page.goto(ctx.url(''));
    await page.waitForFunction(() => document.documentElement.dataset.gallery === 'failed', null, { timeout: 20000 });
    const f = await page.evaluate(() => ({ failed: !(document.getElementById('failed') as HTMLElement).hidden, blocks: ['.hero', '#argument', '#core', '#swap', '#homes'].every(s => !!document.querySelector(s)), featured: document.querySelectorAll('#grid .card-family').length, h1: document.querySelector('h1')!.textContent }));
    ok(f.failed && f.blocks && f.featured >= 1 && f.h1 === claim('rent-line'), `with the list refused, the failure line shows and the message, the offer and the ${f.featured} featured families stay`);
    await close();
  }

  // ---- an ad's tags ride on every way into the tour and the family pages, and stay off the docs, privacy and terms
  {
    const { page, close } = await ctx.open({ width: 1440, height: 900 });
    await page.goto(ctx.url(`?${TAGS}`));
    await ready(page);
    const h = await page.evaluate(() => {
      const hrefs = (sel: string) => Array.from(document.querySelectorAll<HTMLAnchorElement>(sel)).map(a => a.getAttribute('href') || '');
      return { tour: hrefs('#hero-play, #hero-media, [data-cta="tour-proof"], #grid .card-family h3 a'), buy: hrefs('a[href^="https://ci.computer/core"]'), dl: hrefs('a[href^="https://ci.computer/download"]'), clean: hrefs('a[href*="docs.ci.computer"], a[href*="privacy-policy"], a[href*="terms-of-service"]') };
    });
    ok(h.tour.length >= 4 && h.tour.every(x => x.includes('utm_source=meta') && x.includes('fbclid=AbC_123-xyz%2B')), `the hero's tour, its picture, the proof's "Watch this moment" and every featured card carry the ad's tags (${h.tour.length} links)`);
    ok(h.buy.length === 3 && h.buy.every(x => x.includes('utm_campaign=lander')) && h.dl.length === 3 && h.dl.every(x => x.includes('utm_campaign=lander')) && h.clean.every(x => !/utm_|fbclid/.test(x)), 'Buy and Download carry them in the header, the band and the footer; the docs, privacy and terms do not');
    await close();
  }
}
