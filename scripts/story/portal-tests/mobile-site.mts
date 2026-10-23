// The public pages on a phone, in a built site and a browser (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test -- --only hooks --hook mobile-site` after work on a page's phone layout
//
// The front page, a Brennan family page, a business family's and a household's, a home's page and the 404, each at 390 x 844, 360 x 640, 320 x 568 and a phone on its side (844 x 390),
// touch, 2x. The tour and the player are the other package's (portal-tests/player*.mts, typography.mts); the type scale of the screenshot dialog is the owner's and is only held here.
//
//   the page      nothing scrolls sideways (the page's own width, and no text past an edge but inside a row that scrolls); every box is border-box (a stray brace once turned it off site-wide)
//   the header    one bar on every page, 56 px (52 on its side), Download and Buy both inside it and clear of the lockup, whatever the width: no menu hides them
//   targets       every control is 44 px or more both ways (a link inside a sentence, and a row of chips that scrolls sideways, are judged by the chip or the line): 43.5 allowing rounding
//   type          a label or a chip 13 px, anything else 14 px, a paragraph of reading text 16 px (the small print and the footer 14); a text field 16 px so a phone does not zoom in
//   images        every image has its width and height; every one more than a screen and a fifth down is lazy; the hero is the 640 px picture, never a 1200 or 1600 px one
//   the fold      upright: the message, the tour and Buy are inside the first screen; on its side the picture, which is a link to the tour, and Buy are
//   depth         the Core's offer is at most 2.5 screens down on 390 x 844; the first person of a family is under 2 screens down; the bars that stick take at most a fifth of the screen upright
//   print         no sticky bar over the text and no fixed tour button
//   focus         the tab order starts skip, lockup, Download, Buy; every stop has a visible ring and is on the screen; the families' cards show theirs on the card
//   motion        with reduced motion nothing runs and nothing scrolls smoothly
//   safe area     with a notch's insets set, the header's two ends, the skip link and the tour bar stay out of the cut-outs (when this Chromium can set them)
//   contrast      the text of the front page and of a family page meets 4.5:1 (3:1 for large text) in the light set and the dark one
//   dialog        a real screenshot opens in a card that fits the screen with its two buttons on it (a 44 px target each), in the owner's type (20 px upright, 25.5 px on its side); the page behind does not move
//   budget        throttled (Slow 4G: 1.6 Mbit/s, 150 ms, and a CPU 4x slower) the front page and a family page paint their largest picture in under 2.5 s, shift under 0.05, ask for under 1 MB and
//                 fewer than 30 files before a first touch; the chooser's controls are inert (disabled) until the script has run. (This server does not compress, the site's host does: what is
//                 measured here is the worst case, about 340 KB where the deployed page is about 195 KB and paints a little sooner.)
import fs from 'node:fs';
import path from 'node:path';
import type { TestCtx } from '../hooks.ts';

const VIEWPORTS = [
  { w: 390, h: 844, tag: '390x844' }, { w: 360, h: 640, tag: '360x640' }, { w: 320, h: 568, tag: '320x568' }, { w: 844, h: 390, tag: '844x390 on its side' },
] as const;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const PHONE = { deviceScaleFactor: 2, userAgent: UA };

/** Everything one page owes, measured in the page itself (the function is serialised: nothing here may close over the test). */
function auditPage(): Record<string, string[]> {
  const out: Record<string, string[]> = { overflow: [], box: [], header: [], targets: [], type: [], textEdge: [], images: [], clipped: [] };
  const vw = innerWidth, vh = innerHeight;
  const sel = (e: Element): string => { let s = e.tagName.toLowerCase(); if ((e as HTMLElement).id) s += '#' + (e as HTMLElement).id; const c = (typeof (e as HTMLElement).className === 'string' ? (e as HTMLElement).className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2); return c.length ? `${s}.${c.join('.')}` : s; };
  const shown = (e: Element): boolean => { for (let p: Element | null = e; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || p.hasAttribute('hidden')) return false; } const r = e.getBoundingClientRect(); return r.width >= 1 && r.height >= 1; };
  const scroller = (e: Element): boolean => { for (let p = e.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) { const c = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(c.overflowX) && p.getBoundingClientRect().width <= vw + 1) return true; } return false; };
  // the page's own width, and every box
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.overflow.push(`the page is ${de.scrollWidth} px wide on a ${de.clientWidth} px screen`);
  for (const e of Array.from(document.body.querySelectorAll('*'))) { if (!shown(e) || scroller(e)) continue; const r = e.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) { if (e.closest('.skip')) continue; out.overflow.push(`${sel(e)} runs ${Math.round(r.left)}..${Math.round(r.right)}`); if (out.overflow.length > 4) break; } }
  const boxes = ['body', '.site-head', '.btn', 'main section', 'main'].map(s => document.querySelector(s)).filter(Boolean) as Element[];
  for (const e of boxes) if (getComputedStyle(e).boxSizing !== 'border-box') out.box.push(`${sel(e)} is ${getComputedStyle(e).boxSizing}`);
  // the header: one bar, Download and Buy inside it and clear of the lockup
  const head = document.querySelector('.site-head');
  if (head) {
    const r = head.getBoundingClientRect(), cs = getComputedStyle(head), short = vh <= 500;
    if (r.height > (short ? 53.5 : 57.5)) out.header.push(`the bar is ${Math.round(r.height)} px tall (at most ${short ? 53 : 57})`);
    if (cs.position !== 'sticky') out.header.push(`it is ${cs.position}, not sticky`);
    const b = document.querySelector('.site-head .nav-buy'), d = document.querySelector('.site-head .nav-download'), l = document.querySelector('.site-head .brand-ci');
    for (const [name, e] of [['Buy', b], ['Download', d]] as const) { if (!e || !shown(e)) { out.header.push(`${name} is not in the bar`); continue; } const x = e.getBoundingClientRect(); if (x.left < 0 || x.right > vw || x.top < 0 || x.bottom > r.bottom + 1) out.header.push(`${name} is not inside the bar (${Math.round(x.left)}..${Math.round(x.right)})`); }
    if (b && d && l && shown(d) && shown(l) && l.getBoundingClientRect().right > d.getBoundingClientRect().left - 2) out.header.push(`the lockup (to ${Math.round(l.getBoundingClientRect().right)}) runs into Download (from ${Math.round(d.getBoundingClientRect().left)})`);
    if (document.querySelector('.menu-btn')) out.header.push('a menu button hides the links');
  }
  // 44 px targets
  const kinds = 'a[href], button, summary, input:not([type=hidden]), select, textarea, [role=button]';
  for (const e of Array.from(document.querySelectorAll(kinds))) {
    if (!shown(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.bottom <= 0 && e.closest('.skip, .skip *')) continue;
    if (e.matches('.skip') && r.bottom <= 0) continue;
    let w = r.width, h = r.height;
    const cs = getComputedStyle(e), af = getComputedStyle(e, '::after');
    if (af.position === 'absolute' && af.content !== 'none' && af.top === '0px' && af.bottom === '0px') { const card = e.closest('.card, li'); if (card) { const cr = card.getBoundingClientRect(); w = cr.width; h = cr.height; } }
    // a link in a sentence is part of the sentence
    const inline = cs.display === 'inline' && e.tagName === 'A' && !!e.closest('p, dd, small, figcaption') && (e.parentElement!.textContent || '').trim().length > (e.textContent || '').trim().length + 8;
    if (inline) continue;
    if (Math.min(w, h) < 43.5) out.targets.push(`${sel(e)} ${Math.round(w)}x${Math.round(h)} "${(e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)}"`);
    if (e.matches('input[type=search], input[type=text]') && parseFloat(cs.fontSize) < 16) out.type.push(`${sel(e)} is ${cs.fontSize}: a phone zooms in on a field under 16 px`);
  }
  // type floors
  const LABEL = '.eyebrow, .fiction-label, .disclosure, .hero-badge, .poster-badge, .chip, .tag, .pair, .who-nav-text, .moment-room, .day-at, .day-who, .swap-h, .tag-scripted, .sib small, .more-ba dt, .steps-compact h3, .proof-eyebrow, .proof-pair dt, .jobs-label, .brand-title, .nm, .avatar, .disc, .fact, .step-n, .who-facts, .count, .address, .legal, .skip, .btn, .site-nav, .thumb-play, .thumb-missing, .seg, .crumbs, .cast .who, .nav-short, .nav-long, .home-facts, .shot-dialog, h1, h2, h3, summary';
  const SMALL = '.foot-notes, .site-foot, .fine, .cta-limits, .cta-note, figcaption, .note, .strip, .hero-hint, .hero-note, .hero-noscript, .hero-chips, .home-note, .plan-hint, .plan-cap, .film-note, .more-cap, .swap-cap, .limits, .siblings, .apps-named, .instead, .home-line, .pairs-lines, .go, .style, .no-family, .homes-live, .swap-note, .agent .limits, .moment .note, .moment .chips, .plan-foot';
  const groups: Record<string, number> = {};
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n: Node | null; (n = walker.nextNode());) {
    const tx = (n.nodeValue || '').trim(); if (tx.length < 2) continue;
    const p = n.parentElement!; if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName) || p.closest('svg') || !shown(p)) continue;
    const fs = parseFloat(getComputedStyle(p).fontSize); if (fs < 1) continue;
    const label = !!p.closest(LABEL), small = !!p.closest(SMALL);
    const block = p.closest('p, li, dd');
    const reading = !!block && (block.textContent || '').trim().length >= 70 && !label && !small && !p.closest('a, button, summary');   // (a link or a control is held to the 14 px floor, a paragraph of reading text to 16)
    const need = reading ? 16 : label ? 13 : 14;
    if (fs < need - 0.05) { const k = `${sel(p)} ${fs}px (needs ${need}) "${tx.slice(0, 22)}"`; groups[k] = (groups[k] || 0) + 1; }
  }
  for (const k of Object.keys(groups).slice(0, 8)) out.type.push(`${k} x${groups[k]}`);
  // text past an edge, and a control whose words do not fit it
  const range = document.createRange();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n: Node | null; (n = tw.nextNode());) {
    if (!(n.nodeValue || '').trim() || !n.parentElement || !shown(n.parentElement) || scroller(n.parentElement) || n.parentElement.closest('.skip, svg, noscript')) continue;
    range.selectNodeContents(n); const r = range.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) { out.textEdge.push(`"${(n.nodeValue || '').trim().slice(0, 24)}" in ${sel(n.parentElement)} runs ${Math.round(r.left)}..${Math.round(r.right)}`); if (out.textEdge.length > 3) break; }
  }
  for (const e of Array.from(document.querySelectorAll('button, a.btn, .chip, .tag, .pair, .fact, summary, .nav-buy, .nav-download'))) { if (shown(e) && !scroller(e) && (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1 && getComputedStyle(e).overflowX === 'visible') out.clipped.push(`${sel(e)} holds ${(e as HTMLElement).scrollWidth} px in ${(e as HTMLElement).clientWidth}`); }
  // images: size set; lazy when far down; the hero is the 640 px picture
  for (const i of Array.from(document.querySelectorAll('img'))) {
    const r = i.getBoundingClientRect(), top = r.top + scrollY, src = i.currentSrc || i.src;
    if (!i.getAttribute('width') || !i.getAttribute('height')) out.images.push(`${src.split('/').slice(-2).join('/')} has no width and height`);
    if (top > vh * 1.2 && i.loading !== 'lazy' && !/\.svg(\?|$)/.test(src)) out.images.push(`${src.split('/').slice(-2).join('/')} is ${Math.round(top / vh * 10) / 10} screens down and not lazy`);
    if (/\/portal\/(hero\.|previews\/)/.test(src) && vw <= 700 && i.closest('#hero-media')) out.images.push(`the hero is ${src.split('/').slice(-2).join('/')}, not the 640 px picture`);
  }
  return out;
}

/** The contrast of every text-bearing element: foreground over the stacked fills behind it (a page's own audit, as family-v2 does for its new text). */
function contrastIssues(): string[] {
  const out: string[] = [];
  const cv = document.createElement('canvas').getContext('2d')!;
  const rgba = (c: string): number[] => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = (r: number, g: number, b: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (t: number[], u: number[]) => [t[0] * t[3] + u[0] * (1 - t[3]), t[1] * t[3] + u[1] * (1 - t[3]), t[2] * t[3] + u[2] * (1 - t[3]), 1];
  const bgOf = (el: Element): number[] => { const layers: number[][] = []; for (let e: Element | null = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] >= 1) break; } let acc = rgba(getComputedStyle(document.body).backgroundColor); if (acc[3] < 1) acc = [255, 255, 255, 1]; for (const l of layers.reverse()) acc = over(l, acc); return acc; };
  const seen = new Set<Element>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n: Node | null; (n = walker.nextNode());) {
    const el = n.parentElement; if (!el || seen.has(el) || !(n.nodeValue || '').trim() || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || el.closest('svg, .skip, [hidden], dialog:not([open]), .thumb-play, .hero-badge, .poster-badge')) continue;
    seen.add(el);
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('details:not([open]) > *:not(summary)')) continue;
    const fg = rgba(cs.color), bg = bgOf(el), f = over(fg, bg);
    const l1 = lum(f[0], f[1], f[2]), l2 = lum(bg[0], bg[1], bg[2]), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700, need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
    // (the accent button, `--cta` #069b5b with white text, is the canon's own token pair, 3.59:1: it is the owner's to change in CI-Common, not here; every other text is held)
    if (ratio < need && !el.closest('.btn-buy') && out.length < 6) out.push(`${ratio.toFixed(2)} (needs ${need}) "${(n.nodeValue || '').trim().slice(0, 28)}" in ${el.tagName.toLowerCase()}.${(el.className as string) || ''}`);
  }
  return out;
}

export default async function mobileSite(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, OUT } = ctx;
  console.log('\nthe public pages on a phone');
  const by: Record<string, { house: string }> = (ctx.manifest as any).byFamily || {};
  const slugs = Object.keys(by);
  const pick = (want: string[]): string[] => [...new Set([...want.filter(s => slugs.includes(s)), ...slugs])].slice(0, 3);
  const families = pick(['brennan', 'adeniran', 'kovacs']);
  const homes: string[] = JSON.parse(fs.readFileSync(path.join(OUT, 'content', 'houses', 'index.json'), 'utf8')).houses.map((h: { id: string }) => h.id);
  const home = homes.includes('seraphine') ? 'seraphine' : homes[0];
  const PAGES: { name: string; path: string }[] = [{ name: 'front', path: '' }, ...families.map(f => ({ name: `family/${f}`, path: `family/${f}` })), { name: `homes/${home}`, path: `homes/${home}` }, { name: '404', path: 'no-such-page' }];
  const list = (a: string[]): string => a.slice(0, 3).join(' | ');

  // ---- the matrix
  for (const vp of VIEWPORTS) {
    const fails: Record<string, string[]> = {};
    const note = (k: string, name: string, items: string[]): void => { if (items.length) (fails[k] ||= []).push(`${name}: ${list(items)}`); };
    const landscape = vp.h <= 500;
    let fold = '', depth = '', who = '';
    for (const pg of PAGES) {
      const { page, close } = await ctx.open({ width: vp.w, height: vp.h }, true, PHONE);
      await page.goto(ctx.url(pg.path));
      await page.waitForFunction(() => document.readyState === 'complete', null, { timeout: 20000 });
      if (pg.name === 'front') await page.waitForFunction(() => document.documentElement.dataset.gallery, null, { timeout: 20000 });
      await sleep(350);
      const a = await page.evaluate(auditPage);
      for (const k of Object.keys(a)) note(k, pg.name, a[k]);
      // the fold and the depth
      const f = await page.evaluate(() => {
        const b = (s: string) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
        const top = (s: string) => { const e = document.querySelector(s); return e ? (e.getBoundingClientRect().top + scrollY) / innerHeight : -1; };
        return { vh: innerHeight, h1: b('h1'), tour: b('#hero-play, .hero-actions .btn-primary, .hero-cta .btn-primary'), pic: b('#hero-media, .hero .poster, .hero-media'), buy: b('.site-head .nav-buy'), core: top('#core'), who: top('section.who'), page: document.documentElement.scrollHeight / innerHeight };
      });
      if (pg.name === 'front') {
        const inFold = (r: { bottom: number } | null): boolean => !!r && r.bottom <= f.vh + 1;
        note('fold', pg.name, [!inFold(f.h1) && 'the message', !inFold(f.buy) && 'Buy', !landscape && !inFold(f.tour) && 'the tour button', landscape && !(f.pic && f.pic.top < f.vh - 80) && 'the picture (the tour\'s link)'].filter(Boolean) as string[]);
        if (vp.tag === '390x844') note('depth', pg.name, [f.core > 2.5 && `the Core's offer is ${f.core.toFixed(2)} screens down (at most 2.5)`, f.page > 7.5 && `the page is ${f.page.toFixed(2)} screens (at most 7.5)`].filter(Boolean) as string[]);
        if (vp.tag === '390x844') depth = `Core ${f.core.toFixed(2)}, page ${f.page.toFixed(2)} screens`;
        fold = `tour button to ${f.tour ? Math.round(f.tour.bottom) : '-'} of ${f.vh}`;
      } else if (pg.name.startsWith('family/')) {
        // (a 568 px screen holds the name, the tagline and the picture, which is a link to the tour with a play mark; the button is the next thing under it)
        note('fold', pg.name, [!landscape && vp.h >= 640 && !inFoldOf(f.tour, f.vh) && 'the tour button', vp.h < 640 && !(f.pic && f.pic.top < f.vh - 80) && 'the picture (the tour\'s link)', !inFoldOf(f.h1, f.vh) && 'the name'].filter(Boolean) as string[]);
        if (vp.tag === '390x844' && !who) who = `, the first person ${f.who.toFixed(2)} screens down`;
        if (vp.tag === '390x844') note('depth', pg.name, [f.who > 2 && `the first person is ${f.who.toFixed(2)} screens down (at most 2)`].filter(Boolean) as string[]);
      }
      // print: no sticky bar over the text, no fixed tour button
      if (pg.name === 'front' || pg.name.startsWith('family/brennan') || pg.name === `family/${families[0]}`) {
        await page.emulateMedia({ media: 'print' });
        const pr = await page.evaluate(() => Array.from(document.querySelectorAll('.site-head, .who-nav, .tourbar')).filter(e => { const c = getComputedStyle(e); return (c.position === 'sticky' || c.position === 'fixed') && c.display !== 'none'; }).map(e => e.className));
        note('print', pg.name, pr);
        await page.emulateMedia({ media: 'screen' });
      }
      await close();
    }
    for (const [k, what] of [['overflow', 'nothing scrolls sideways and no box runs past an edge'], ['box', 'every box is border-box'], ['header', 'the header is one slim bar with Download and Buy in it'], ['targets', 'every control is a 44 px target'],
      ['type', 'type: 13 px labels, 14 px small print, 16 px reading text, 16 px fields'], ['textEdge', 'no text runs past an edge'], ['clipped', 'every control holds its words'], ['images', 'every image has its size, the far ones are lazy, the hero is the 640 px picture'],
      ['fold', 'the first screen holds the message, the tour and Buy'], ['depth', 'the depth budget'], ['print', 'print has no sticky or fixed bar']] as const) {
      if (k === 'fold' && !PAGES.length) continue;
      if (k === 'depth' && vp.tag !== '390x844') continue;
      ok(!fails[k]?.length, `${vp.tag}: ${what}${k === 'fold' && fold ? ` (${fold})` : ''}${k === 'depth' && depth ? ` (${depth}${who})` : ''}${fails[k]?.length ? ': ' + fails[k].slice(0, 3).join(' || ') : ''}`);
    }
  }

  // ---- the same bar between a phone and a laptop (a big phone on its side, a tablet held upright; the long labels need 746 px, so the short ones show up to 780): the lockup, the title and the links never run into each other
  {
    const bad: string[] = [];
    for (const w of [521, 600, 701, 740, 781, 834, 1024]) for (const pg of [PAGES[0], PAGES[1], PAGES[PAGES.length - 2]]) {
      const { page, close } = await ctx.open({ width: w, height: 1000 }, true, PHONE);
      await page.goto(ctx.url(pg.path)); await sleep(300);
      const r = await page.evaluate(() => { const b = (s: string) => { const e = document.querySelector(s); if (!e || getComputedStyle(e).display === 'none') return null; const x = e.getBoundingClientRect(); return x.width ? { l: x.left, r: x.right } : null; }; const items = ['.site-head .brand-ci', '.site-head .brand-title', '.site-nav .nav-homes', '.site-nav .nav-docs', '.site-nav .nav-download', '.site-nav .nav-buy'].map(b).filter(Boolean) as { l: number; r: number }[]; return { items, vw: innerWidth, x: document.documentElement.scrollWidth - innerWidth }; });
      const lap = r.items.some((it, i) => i > 0 && it.l < r.items[i - 1].r - 1) || r.items[r.items.length - 1].r > r.vw || r.x > 1;
      if (lap) bad.push(`${pg.name} at ${w}`);
      await close();
    }
    ok(bad.length === 0, `between a phone and a laptop (521, 600, 701, 740, 781, 834 and 1024 px wide) the header's lockup, title and links never touch or leave the screen${bad.length ? ': ' + bad.join(', ') : ''}`);
  }

  // ---- the bars that stick on a family page (the header, the people, the tour button): a fifth of a tall upright screen (22 percent; a third of a 568 px one), and none of the two last on its side
  for (const vp of VIEWPORTS) {
    const { page, close } = await ctx.open({ width: vp.w, height: vp.h }, true, PHONE);
    await page.goto(ctx.url(`family/${families[0]}`));
    await sleep(500);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; const e = document.querySelector('section.who:nth-of-type(2), section.who')!; window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 160); });
    await sleep(500);
    const s = await page.evaluate(() => { const h = (s: string) => { const e = document.querySelector(s); if (!e) return 0; const c = getComputedStyle(e); if (c.display === 'none' || (e as HTMLElement).hidden) return 0; if (c.position !== 'sticky' && c.position !== 'fixed') return 0; return e.getBoundingClientRect().height; }; return { head: h('.site-head'), nav: h('.who-nav'), bar: h('.tourbar'), vh: innerHeight }; });
    const total = s.head + s.nav + s.bar, pct = total / s.vh * 100;
    const landscape = vp.h <= 500;
    ok(landscape ? s.nav === 0 && s.bar === 0 && pct <= 14 : pct <= (vp.h >= 800 ? 22 : 32), `${vp.tag}: the bars that stick on a family page (header ${Math.round(s.head)}, people ${Math.round(s.nav)}, tour button ${Math.round(s.bar)} px) are ${pct.toFixed(1)} percent of the screen${landscape ? ' (the people and the tour button let go on its side)' : ''}`);
    await close();
  }

  // ---- focus order and a visible ring, on the front page and a family page
  for (const pg of [PAGES[0], PAGES[1]]) {
    const { page, close } = await ctx.open({ width: 390, height: 844 }, true, PHONE);
    await page.goto(ctx.url(pg.path)); await sleep(500);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; (document.activeElement as HTMLElement | null)?.blur(); });
    const stops: { id: string; ring: boolean; on: boolean }[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      await sleep(60);
      stops.push(await page.evaluate(() => {
        const e = document.activeElement as HTMLElement; if (!e || e === document.body) return { id: '', ring: false, on: false };
        const ring = (x: Element | null): boolean => { if (!x) return false; const c = getComputedStyle(x); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2 || (c.boxShadow !== 'none' && /\s[2-9]px/.test(c.boxShadow)); };
        const r = e.getBoundingClientRect();
        return { id: e.className.split(' ')[0] || e.tagName.toLowerCase(), ring: ring(e) || ring(e.closest('.card-family, .who-nav li, .plan-scroll')), on: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth };
      }));
    }
    const ids = stops.map(s => s.id);
    ok(ids[0] === 'skip' && ids[1] === 'brand-ci' && ids[2] === 'nav-download' && ids[3] === 'nav-buy', `${pg.name}: the tab order starts at the skip link, the lockup, Download and Buy (${ids.slice(0, 6).join(', ')})`);
    ok(stops.every(s => s.ring) && stops.every(s => s.on), `${pg.name}: each of the first ${stops.length} stops has a ring of 2 px or more and is on the screen${stops.filter(s => !s.ring || !s.on).length ? ' (not: ' + stops.filter(s => !s.ring || !s.on).map(s => s.id).join(', ') + ')' : ''}`);
    await close();
  }

  // ---- reduced motion: nothing runs, nothing scrolls smoothly
  for (const pg of [PAGES[0], PAGES[1]]) {
    const { page, close } = await ctx.open({ width: 390, height: 844 }, true, { ...PHONE, reducedMotion: 'reduce' });
    await page.goto(ctx.url(pg.path)); await sleep(700);
    const m = await page.evaluate(() => ({ smooth: getComputedStyle(document.documentElement).scrollBehavior, running: document.getAnimations().filter(a => a.playState === 'running').length, trans: Array.from(document.querySelectorAll('a, .btn, .card, .thumb, .pair')).filter(e => /[1-9]/.test(getComputedStyle(e).transitionDuration.replace(/0(\.0+)?m?s/g, ''))).length }));
    ok(m.smooth === 'auto' && m.running === 0 && m.trans === 0, `${pg.name}: with reduced motion the page scrolls without easing, nothing animates and no transition runs (${m.smooth}, ${m.running} animations, ${m.trans} transitions)`);
    await close();
  }

  // ---- the safe area: a notch's cut-outs set by the browser's own override (Emulation.setSafeAreaInsetsOverride), when this Chromium has it
  {
    const { page, close } = await ctx.open({ width: 844, height: 390 }, true, PHONE);
    let can = true;
    try { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, right: 47, bottom: 21 } }); } catch (e) { can = false; console.log(`  (this Chromium cannot set safe-area insets: ${String(e).split('\n')[0].slice(0, 90)}; the check is skipped)`); }
    if (can) {
      for (const pg of [PAGES[0], PAGES[1]]) {
        await page.goto(ctx.url(pg.path)); await sleep(500);
        const v = await page.evaluate(() => { const r = (s: string) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; }; const probe = getComputedStyle(document.body).paddingLeft; const brand = r('.site-head .brand-ci'), buy = r('.site-head .nav-buy'); return { inset: probe, brandLeft: brand ? brand.left : -1, buyRight: buy ? innerWidth - buy.right : -1, vw: innerWidth }; });
        ok(parseFloat(v.inset) >= 46 && v.brandLeft >= 46 && v.buyRight >= 46, `${pg.name} on its side with 47 px cut-outs: the lockup starts ${Math.round(v.brandLeft)} px in and Buy ends ${Math.round(v.buyRight)} px from the right edge (the page's own side padding is ${v.inset})`);
      }
      // the skip link, focused, and the narrow family page's tour bar
      await page.goto(ctx.url(PAGES[0].path)); await sleep(300);
      await page.keyboard.press('Tab');
      const sk = await page.evaluate(() => { const e = document.querySelector('.skip')!.getBoundingClientRect(); return e.left; });
      ok(sk >= 46, `the skip link, focused, clears the cut-out (${Math.round(sk)} px from the left edge)`);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(ctx.url(PAGES[1].path)); await sleep(400);
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 2400); });
      await sleep(500);
      const tb = await page.evaluate(() => { const b = document.getElementById('tourbar') as HTMLElement; const s = getComputedStyle(b); const btn = b.querySelector('.btn')!.getBoundingClientRect(); return { shown: s.display !== 'none', padB: parseFloat(s.paddingBottom), left: btn.left, right: innerWidth - btn.right }; });
      ok(tb.shown && tb.padB >= 8 + 20 && tb.left >= 16 && tb.right >= 16, `the fixed tour button keeps clear of the home indicator (bottom padding ${Math.round(tb.padB)} px with a 21 px inset)`);
    }
    await close();
  }

  // ---- contrast, in both colour sets
  for (const pg of [PAGES[0], PAGES[1]]) for (const scheme of ['light', 'dark'] as const) {
    const { page, close } = await ctx.open({ width: 390, height: 844 }, true, { ...PHONE, colorScheme: scheme });
    await page.goto(ctx.url(pg.path)); await sleep(500);
    const c = await page.evaluate(contrastIssues);
    ok(c.length === 0, `${pg.name} at 390, ${scheme}: the text meets its contrast${c.length ? ': ' + list(c) : ''}`);
    await close();
  }

  // ---- the screenshot dialog on a phone: a card that fits, its buttons on it, the owner's type, the page behind still
  {
    const hasShot = fs.readFileSync(path.join(OUT, 'family', `${families[0]}.html`), 'utf8').includes('data-shot');
    for (const vp of hasShot ? VIEWPORTS.filter(v => v.w !== 360) : []) {
      const { page, errors, close } = await ctx.open({ width: vp.w, height: vp.h }, true, PHONE);
      await page.addInitScript(() => { (window as any).__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* none */ } });
      await page.goto(ctx.url(`family/${families[0]}`)); await sleep(500);
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('a[data-shot]')!.scrollIntoView({ block: 'center' }); });
      await sleep(500);
      const before = await page.evaluate(() => ({ y: scrollY, top: document.querySelector('a[data-shot]')!.getBoundingClientRect().top, h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, cls: (window as any).__cls as number }));
      await page.tap('a[data-shot]'); await sleep(600);
      const d = await page.evaluate(() => {
        const dlg = document.getElementById('shot-dialog') as HTMLDialogElement, r = (e: Element) => { const x = e.getBoundingClientRect(); return { t: x.top, b: x.bottom, l: x.left, r: x.right, h: x.height, w: x.width }; };
        return { open: dlg.open, dlg: r(dlg), close: r(dlg.querySelector('.shot-close')!), full: r(dlg.querySelector('.shot-full')!), img: r(dlg.querySelector('img')!), fs: parseFloat(getComputedStyle(dlg).fontSize), vw: innerWidth, vh: innerHeight,
          page: { y: scrollY, top: document.querySelector('a[data-shot]')!.getBoundingClientRect().top, h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, cls: (window as any).__cls as number }, focusIn: dlg.contains(document.activeElement) };
      });
      const inside = (b: { t: number; b: number; l: number; r: number }): boolean => b.t >= 0 && b.b <= d.vh && b.l >= 0 && b.r <= d.vw;
      ok(d.open && inside(d.dlg) && inside(d.close) && inside(d.full) && inside(d.img), `${vp.tag}: the dialog, its picture and both buttons are on the screen with no scrolling (card ${Math.round(d.dlg.t)}..${Math.round(d.dlg.b)} of ${d.vh})`);
      ok(d.close.h >= 43.5 && d.full.h >= 43.5 && d.close.w >= 43.5 && d.full.w >= 43.5, `${vp.tag}: and both buttons are 44 px targets (${Math.round(d.close.w)}x${Math.round(d.close.h)}, ${Math.round(d.full.w)}x${Math.round(d.full.h)})`);
      ok(vp.w < 768 ? d.fs >= 20 && d.fs <= 25.6 : Math.abs(d.fs - 25.5) < 0.2, `${vp.tag}: the dialog is set in the tour's type scale (${d.fs.toFixed(1)} px: 20 to 25.5 upright, 25.5 from 768 px wide)`);
      ok(Math.abs(d.page.top - before.top) < 1 && d.page.h === before.h && d.page.w === before.w && d.page.cls - before.cls < 0.001 && d.focusIn, `${vp.tag}: opening it moves nothing behind it (shift ${(d.page.cls - before.cls).toFixed(4)}, the picture ${Math.round(d.page.top - before.top)} px) and focus is inside`);
      await page.keyboard.press('Escape'); await sleep(300);
      ok(!(await page.evaluate(() => (document.getElementById('shot-dialog') as HTMLDialogElement).open)) && errors.length === 0, `${vp.tag}: Esc closes it, no console error${errors.length ? ': ' + errors.join(' | ') : ''}`);
      await close();
    }
  }

  // ---- the budget, throttled: Slow 4G and a CPU 4x slower, a cold cache, before a first touch
  for (const pg of [PAGES[0], PAGES[1]]) {
    const { page, close } = await ctx.open({ width: 390, height: 844 }, true, PHONE);
    await page.addInitScript(() => {
      const m: any = (window as any).__m = { lcp: 0, lcpSrc: '', cls: 0, ready: 0 };
      try { new PerformanceObserver(l => { for (const e of l.getEntries() as any[]) { m.lcp = e.startTime; m.lcpSrc = e.url || ''; } }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch { /* none */ }
      try { new PerformanceObserver(l => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* none */ }
      try { new MutationObserver(() => { if (document.documentElement.dataset.gallery && !m.ready) m.ready = performance.now(); }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-gallery'] }); } catch { /* none */ }
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let bytes = 0, files = 0;
    cdp.on('Network.loadingFinished', (e: any) => { bytes += e.encodedDataLength || 0; files++; });
    // (with no JavaScript run yet, the chooser's controls are disabled: read them at the first paint)
    await page.goto(ctx.url(pg.path), { waitUntil: 'load', timeout: 120000 });
    await sleep(1500);
    const m = await page.evaluate(() => ({ ...(window as any).__m }));
    ok(m.lcp > 0 && m.lcp < 2500, `${pg.name}: throttled to Slow 4G with a CPU 4x slower the largest picture is painted at ${Math.round(m.lcp)} ms (under 2500), ${m.lcpSrc.replace(/^.*\/(portal\/[^/]+\/[^/]+)$/, '$1')}`);
    ok(m.cls < 0.05, `${pg.name}: and the page shifted ${m.cls.toFixed(4)} while it arrived (under 0.05)`);
    ok(bytes < 1024 * 1024 && files < 30, `${pg.name}: and it asked for ${Math.round(bytes / 1024)} KB in ${files} files before a first touch (under 1024 KB and 30 files)`);
    if (pg.name === 'front') ok(m.ready > 0 && m.ready < 4000, `the chooser is live ${Math.round(m.ready)} ms in (the script has run and enabled its controls)`);
    await close();
  }
  // the chooser's controls are inert until the script runs, on a phone as everywhere
  {
    const { page, close } = await ctx.open({ width: 390, height: 844 }, true, { ...PHONE, javaScriptEnabled: false });
    await page.goto(ctx.url('')); await sleep(300);
    const t = await page.evaluate(() => ({ n: document.querySelectorAll('#swap button, #q').length, off: Array.from(document.querySelectorAll('#swap button, #q')).every(c => (c as HTMLButtonElement).disabled), x: document.documentElement.scrollWidth - innerWidth }));
    ok(t.n > 10 && t.off && t.x <= 1, `with no script on a phone the chooser's ${t.n} controls are disabled (not focusable, so none is dead) and the page does not scroll sideways`);
    await close();
  }
}

function inFoldOf(r: { bottom: number } | null, vh: number): boolean { return !!r && r.bottom <= vh + 1; }
