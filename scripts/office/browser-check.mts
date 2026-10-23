#!/usr/bin/env -S node --experimental-strip-types
// The draft office in a real browser (reference/office/office-contract-m0.md): by hand, not part of `pnpm run test:node` (it needs Playwright's Chromium, which pnpm run test:node never starts).
//
//   node --experimental-strip-types scripts/office/browser-check.mts [--out <dir of a build made with --offices>] [--keep]
//
// It builds the site with --offices into a temporary folder (or reads `--out`), serves it under /ci-virtual-home/ and checks, at 15 widths from 320 to 1440 px, that no page of the office or of
// the homes has a header whose links overlap or leave the screen, or a page that scrolls sideways; then drives /office as a person does (the search, the sizes, the jobs, Clear, the keys,
// a campaign's tags in the address, an address that carries a state, a card's link) and reads it with JavaScript off. Exit 1 on any failure. Where the pinned Chromium is missing, point
// PLAYWRIGHT_BROWSERS_PATH at a folder that links the build you have under the name Playwright wants (the README's own step is to install the pinned one).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, loadPlaywright, parseArgs, serve } from '../portal-lib.mts';

const args = parseArgs(process.argv.slice(2));
const out = args.out && args.out !== 'true' ? path.resolve(args.out) : fs.mkdtempSync(path.join(os.tmpdir(), 'office-browser-'));
if (!(args.out && args.out !== 'true')) {
  const b = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'build-portal.mts'), '--offices', '--out', out], { encoding: 'utf8', cwd: ROOT });
  if (b.status !== 0) { console.error(`the build with --offices failed:\n${b.stdout}${b.stderr}`); process.exit(2); }
}
const { chromium } = await loadPlaywright();
const srv = await serve(out, '/ci-virtual-home/');
const browser = await chromium.launch();
let fails = 0;
const ok = (c: boolean, m: string): void => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };

// ---- the header and the width of every page that has the switcher
const PAGES = ['office', 'company/reelwick', 'company/lintel-and-sill', '', 'homes/aurora', 'family/brennan', '404.html'];
const WIDTHS = [320, 360, 375, 390, 414, 600, 700, 768, 800, 900, 1024, 1100, 1180, 1280, 1440];
{
  let bad = 0;
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(String(e)));
    page.on('console', (m: any) => { if (m.type() === 'error') errors.push(m.text()); });
    for (const p of PAGES) {
      await page.goto(srv.url(p), { waitUntil: 'load' });
      const r = await page.evaluate(() => {
        const vis = (el: Element): boolean => { const cs = getComputedStyle(el), b = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
        const items = Array.from(document.querySelectorAll('.site-head .brand a, .site-head .site-nav a')).filter(vis).map((el) => { const b = el.getBoundingClientRect(); return { c: el.className, l: Math.round(b.left), r: Math.round(b.right) }; }).sort((a, b) => a.l - b.l);
        const overlaps: string[] = [];
        for (let i = 1; i < items.length; i++) if (items[i].l < items[i - 1].r - 0.5) overlaps.push(`${items[i - 1].c}/${items[i].c}`);
        const outside = items.filter((i) => i.r > innerWidth + 0.5 || i.l < -0.5).map((i) => i.c);
        return { sw: document.documentElement.scrollWidth, iw: innerWidth, overlaps, outside, nav: document.querySelectorAll('.site-nav .nav-offices').length };
      });
      if (p !== '404.html' && r.nav !== 1) { bad++; console.log(`✗ ${w} ${p || '(front page)'}: ${r.nav} Offices links`); }
      if (r.sw > r.iw + 0.5 || r.overlaps.length || r.outside.length) { bad++; console.log(`✗ ${w} ${p || '(front page)'}:${r.sw > r.iw + 0.5 ? ' scrolls sideways' : ''}${r.overlaps.length ? ` overlap ${r.overlaps.join(',')}` : ''}${r.outside.length ? ` outside ${r.outside.join(',')}` : ''}`); }
    }
    if (errors.length) { bad++; console.log(`✗ ${w}: console errors: ${[...new Set(errors)].slice(0, 3).join(' | ')}`); }
    await ctx.close();
  }
  ok(bad === 0, `the header and the width: ${WIDTHS.length} widths on ${PAGES.length} pages, nothing overlaps, nothing leaves the screen, nothing scrolls sideways${bad ? ` (${bad} problems)` : ''}`);
}

// ---- /office as a person uses it
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push(m.text()); });
  const shown = (): Promise<string[]> => page.$$eval('#grid li.card', (els: HTMLElement[]) => els.filter((e) => !e.hidden).map((e) => e.dataset.slug as string));
  const search = (): Promise<string> => page.evaluate(() => location.search);
  await page.goto(srv.url('office?utm_source=news&gclid=abc'), { waitUntil: 'load' });
  ok(await page.evaluate(() => document.documentElement.hasAttribute('data-office')), 'the script ran');
  ok((await shown()).join() === 'reelwick,lintel-and-sill', 'both cards show');
  ok((await page.$$eval('#sizes button', (bs: HTMLButtonElement[]) => bs.map((b) => b.disabled))).join() === 'false,false,false,true', 'Any, Startup and Small business are on; Medium business, which no company is, is off');
  await page.fill('#q', 'forgejo');
  ok((await shown()).join() === 'reelwick' && (await search()) === '?utm_source=news&gclid=abc&q=forgejo', `a search shows the one company, and the address keeps a campaign's tags in order (${await search()})`);
  ok((await page.textContent('#live')) === 'Showing one of two', 'the live region says how many, in words');
  ok(await page.$eval('#sizes button[data-size="small"]', (e: HTMLButtonElement) => e.disabled), 'a size that would show nothing is off');
  await page.fill('#q', 'nothing like this');
  ok((await shown()).length === 0 && (await page.$eval('#empty', (e: HTMLElement) => !e.hidden)), 'no match: the empty state');
  await page.click('#clear-empty');
  ok((await shown()).length === 2 && (await search()) === '?utm_source=news&gclid=abc', 'Clear brings both back and takes q out of the address');
  await page.click('#sizes button[data-size="small"]');
  ok((await shown()).join() === 'lintel-and-sill' && (await search()) === '?utm_source=news&gclid=abc&size=small', 'a size filters');
  ok(await page.$eval('#jobs button[data-fn="engineering"]', (e: HTMLButtonElement) => e.disabled), 'a job nobody in that size has is off');
  await page.click('#jobs button[data-fn="legal"]');
  ok((await search()).endsWith('&size=small&fn=legal') && (await page.$eval('#jobs button[data-fn="legal"]', (e: HTMLElement) => e.getAttribute('aria-pressed'))) === 'true', 'a job filters and says it is pressed');
  await page.click('#jobs button[data-fn="legal"]');
  ok((await search()) === '?utm_source=news&gclid=abc&size=small', 'a second click lets it go');
  await page.goto(srv.url('office?q=quenby&fn=design&size=small&utm_campaign=x'), { waitUntil: 'load' });
  ok((await shown()).join() === 'lintel-and-sill' && (await page.inputValue('#q')) === 'quenby' && (await search()) === '?utm_campaign=x&q=quenby&size=small&fn=design', 'an address that carries a state restores it, and the campaign comes first');
  await page.goto(srv.url('office?size=medium&fn=nonsense'), { waitUntil: 'load' });
  ok((await shown()).length === 0 && (await search()) === '?size=medium', 'a size no company is shows nothing and says so; a job nobody has is not a filter');
  await page.goto(srv.url('office'), { waitUntil: 'load' });
  await page.keyboard.press('/');
  ok(await page.evaluate(() => document.activeElement?.id === 'q'), '/ focuses the search');
  await page.keyboard.type('forg');
  await page.keyboard.press('Escape');
  ok((await page.inputValue('#q')) === '' && (await shown()).length === 2, 'Escape clears it');
  await page.click('#grid li.card[data-slug="reelwick"] h3 a');
  await page.waitForLoadState('load');
  ok(/\/company\/reelwick(\?|$)/.test(page.url()) && (await page.textContent('h1')) === 'Reelwick', 'a card opens its company page');
  ok(await page.$eval('.nav-offices', (e: HTMLElement) => e.getAttribute('aria-current') === 'true'), 'where the Offices link is current as a section');
  ok(errors.length === 0, `no console error${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
  // JavaScript off: the page is whole, and says what the filters need
  const nojs = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  const p2 = await nojs.newPage();
  await p2.goto(srv.url('office'), { waitUntil: 'load' });
  ok((await p2.$$eval('#grid li.card', (els: HTMLElement[]) => els.filter((e) => e.offsetParent !== null).length)) === 2, 'with JavaScript off both cards are on the page');
  ok(await p2.$eval('noscript p.empty', (e: HTMLElement) => /Every company is listed here/.test(e.textContent || '')), 'and the page says the filters need JavaScript');
  await nojs.close();
}

await browser.close();
await srv.close();
if (!(args.out && args.out !== 'true') && args.keep !== 'true') fs.rmSync(out, { recursive: true, force: true });
console.log(fails ? `\n${fails} check${fails === 1 ? '' : 's'} failed` : '\nthe draft office checks out in a browser');
process.exit(fails ? 1 : 0);
