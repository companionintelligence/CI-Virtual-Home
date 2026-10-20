// The campaign's tags in the PLAYER, in a browser (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test -- --only hooks` after player or campaign work
//
// portal/campaign.js is loaded by every page of the site, the player included (portal:build adds the tag to room-creator.html's head: the source page is
// the editor's and is not touched). The player draws its end card, its About panel and its header after the page loads, so:
//   - an ad's tags in the address (utm_*, fbclid, ...) are kept for the visit and sit on every link to ci.computer, /core and /download the player has
//     (the end card, the About panel, the header), never on the docs; a plain player and a family's tour alike
//   - a visit without tags changes no link; a page that cannot read sessionStorage still tags what the address carries
//   - a link rule in portal/campaign.json (served here by the test: the shipped list is empty) maps the Buy link inside its dates and keeps the tags
//   - with JavaScript off, a tour link shows the noscript message and nothing of the editor under it
// (scripts/test-campaign.mts runs the script itself in a stub; the `campaign` leg of portal:test is the front page, the home pages and the 404.)
import type { TestCtx } from '../hooks.ts';

export default async function campaignPlayer(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, url } = ctx;
  const byFamily: Record<string, any> = (ctx.manifest as any).byFamily || {};
  const tours = Object.entries<any>(byFamily).filter(([, v]) => v && v.story).map(([slug]) => slug);
  console.log('\ncampaign in the player');
  if (!tours.length) { console.log('  no family has a tour in this build: nothing to test'); return; }
  const slug = tours[0], house: string = byFamily[slug].house;
  const TAGS = 'utm_source=meta&utm_medium=paid&utm_campaign=lander&utm_content=ad1&fbclid=AbC_123';
  const ready = (page: any) => page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 240000 });
  const ci = (page: any): Promise<string[]> => page.$$eval('a[href^="https://ci.computer"]', (as: HTMLAnchorElement[]) => as.map(a => a.getAttribute('href') || ''));
  const day = (n: number): string => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  // a family's tour with an ad's tags
  {
    const { page, errors, close } = await ctx.open({ width: 1440, height: 900 }, false);
    await page.goto(url(`room-creator?mode=view&house=${house}&family=${slug}&${TAGS}`)); await ready(page); await sleep(300);
    ok((await page.evaluate(() => typeof (window as any).CICampaign)) === 'object', 'the player loads portal/campaign.js (window.CICampaign exists)');
    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ci-campaign') || '{}'));
    ok(Object.keys(stored).join() === 'utm_source,utm_medium,utm_campaign,utm_content,fbclid' && stored.fbclid === 'AbC_123', 'the visit keeps the tags under "ci-campaign"');
    const links = await ci(page);
    const core = links.filter(h => h.startsWith('https://ci.computer/core')), dl = links.filter(h => h.startsWith('https://ci.computer/download')), site = links.filter(h => /^https:\/\/ci\.computer(\?|$)/.test(h));
    ok(core.length >= 2 && dl.length >= 2 && site.length >= 1 && links.every(h => h.includes(`?${TAGS}`)), `the end card's and the About panel's links to /core (${core.length}), /download (${dl.length}) and the main site (${site.length}) carry the tags`);
    const docs = await page.$$eval('a[href^="https://docs.ci.computer"]', (as: HTMLAnchorElement[]) => as.map(a => a.getAttribute('href') || ''));
    ok(docs.length >= 1 && docs.every(h => !/utm_|fbclid/.test(h)), 'the docs link does not');
    const out = await page.evaluate(() => (window as any).CICampaign.decorate('https://ci.computer/core'));
    ok(out === `https://ci.computer/core?${TAGS}`, 'a link the player builds as a string is tagged by decorate()');
    // a link that is made after everything else (the tour's end card is made when the tour ends) is tagged as it arrives
    await page.evaluate(() => { const a = document.createElement('a'); a.id = 'late-link'; a.href = 'https://ci.computer/download'; a.textContent = 'late'; document.body.appendChild(a); });
    await sleep(100);
    ok((await page.getAttribute('#late-link', 'href')) === `https://ci.computer/download?${TAGS}`, 'a link drawn later is tagged as it arrives');
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }
  // the plain player, and storage blocked: the address's tags still ride on the links
  {
    const { page, errors, close } = await ctx.open({ width: 390, height: 844 }, true);
    await page.addInitScript("Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });");
    await page.goto(url(`room-creator?mode=view&house=${house}&${TAGS}`)); await ready(page); await sleep(300);
    const links = await ci(page);
    ok(links.length >= 5 && links.every(h => h.includes(`?${TAGS}`)), `a plain player with storage blocked: its ${links.length} links to ci.computer carry the address's tags`);
    ok(errors.length === 0, `and raises no console error${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }
  // an organic visit: not one link is touched, and no extra request but campaign.json
  {
    const { page, close } = await ctx.open({ width: 1440, height: 900 }, false);
    await page.goto(url(`room-creator?mode=view&house=${house}&family=${slug}`)); await ready(page); await sleep(300);
    const links = await ci(page);
    ok(links.length >= 5 && links.every(h => !/utm_|fbclid|gclid|ttclid|msclkid/.test(h)) && links.includes('https://ci.computer/core') && links.includes('https://ci.computer/download') && links.includes('https://ci.computer'), 'without tags in the address no link of the player is changed');
    await close();
  }
  // a link rule (the shipped list is empty; the test serves one): inside its dates the Buy link goes where the rule says, with the tags; the docs link stays
  for (const [what, from, until, mapped] of [['active', day(-1), day(30), true], ['expired', day(-30), day(-1), false]] as const) {
    const { page, close } = await ctx.open({ width: 1440, height: 900 }, false);
    let asked = 0;
    await page.route('**/portal/campaign.json', (r: any) => { asked++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 1, rules: [{ match: 'https://ci.computer/core', to: 'https://ci.computer/store/p/core', from, until }] }) }); });
    await page.goto(url(`room-creator?mode=view&house=${house}&${TAGS}`)); await ready(page); await sleep(500);
    const links = await ci(page);
    const buy = links.filter(h => h.startsWith('https://ci.computer/core') || h.startsWith('https://ci.computer/store/p/core'));
    ok(asked === 1, `${what} rule: campaign.json is read once`);
    ok(buy.length >= 2 && buy.every(h => (mapped ? h === `https://ci.computer/store/p/core?${TAGS}` : h === `https://ci.computer/core?${TAGS}`)), `${what} rule: the player's Buy links ${mapped ? 'go to the mapped address with the tags' : 'stay on /core with the tags'} (${buy[0]})`);
    ok(links.filter(h => h.startsWith('https://ci.computer/download')).every(h => h === `https://ci.computer/download?${TAGS}`), `${what} rule: the Download links are as before`);
    const docs = await page.$$eval('a[href^="https://docs.ci.computer"]', (as: HTMLAnchorElement[]) => as.map(a => a.getAttribute('href') || ''));
    ok(docs.every(h => h === 'https://docs.ci.computer/docs/apps-available/first-party-apps'), `${what} rule: the docs link is untouched`);
    await close();
  }
  // no JavaScript: the message and its links, nothing of the editor under it
  {
    const { page, close } = await ctx.open({ width: 1280, height: 800 }, false, { javaScriptEnabled: false });
    await page.goto(url(`room-creator?mode=view&house=${house}&family=${slug}`));
    await sleep(500);
    const noscript = await page.isVisible('noscript nav');
    const hidden = await page.$$eval('body > :not(noscript)', (els: HTMLElement[]) => els.filter(e => getComputedStyle(e).display !== 'none').length).catch(() => -1);
    ok(noscript, 'with JavaScript off the message and its links are shown');
    ok(hidden === 0, `and every other element of the body is hidden, so no dead editor under it (${hidden} left)`);
    await close();
  }
}
