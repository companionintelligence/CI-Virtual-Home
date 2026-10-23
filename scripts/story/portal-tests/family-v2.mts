// A family's page, story v2, in a built site and a browser (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test -- --only hooks` after page work
//
// The contract is reference/story/story-v2.md and the header of scripts/story/pages.mts. The node test (scripts/test-story-pages.mts) holds the writer to it
// on the Brennan family; this holds the BUILT pages and the way they behave:
//
//   static    every family page has the people's nav and a section for each person; every real image on every page is a file the manifest names with its alt text,
//             size, lazy loading and (a screenshot) its caption; every pin of every floor plan is one person's link to a section that exists, one pin for each person
//             the plan can place; the dialog skeleton is there exactly when a screenshot is
//   browser   the Brennan page at 1440 and 390, light and dark: the person nav sticks under the header and follows the scroll with aria-current and no change
//             of size; a person's anchor lands under the bars; "More about this moment" opens and closes (with JavaScript off too); a screenshot opens in the native
//             dialog with its caption, Esc closes it and focus goes back to the link; the floor plan has a 44 px pin for each person that goes to their section
//             and covers no room name; nothing scrolls sideways on a phone but the plan; every control is a 44 px target on touch; the contrast of the new text is
//             met in both themes; no layout shift from the lazy images; no console error and no third-party request; reduced motion turns every transition off
import fs from 'node:fs';
import path from 'node:path';
import type { TestCtx } from '../hooks.ts';
import { loadAll } from '../site-lib.mts';
import { readMedia, checkPageImages, shotCaption } from '../lib/media.mts';
import { readPlan, placePins } from '../lib/plan-map.mts';
import { builderHandles, guardTerms, scanText } from '../../portal-redact.mts';

export default async function familyV2(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, OUT, ROOT } = ctx;
  const by: Record<string, { house: string }> = (ctx.manifest as any).byFamily || {};
  const slugs = Object.keys(by);
  console.log('\nthe family pages, story v2');
  if (!slugs.length) { console.log('  no family has a page in this build: nothing to test'); return; }
  const media = readMedia(ROOT);
  const L = loadAll(ROOT, path.join(ROOT, 'content', 'families'));
  const casting = Object.fromEntries((JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'story', 'casting.json'), 'utf8')).families as any[]).map(f => [f.slug, f]));
  const terms = guardTerms(builderHandles(ROOT));
  const read = (slug: string): string => fs.readFileSync(path.join(OUT, 'family', `${slug}.html`), 'utf8');

  // ------------------------------------------------------------------ static, every page
  const named = new Map<string, string>();
  if (media) {
    for (const a of Object.values(media.apps)) { if (a.logo) named.set(a.logo.file, ''); if (a.shot) named.set(a.shot.file, a.shot.caption); }
    for (const x of [...media.ci.hub, ...media.ci.portal]) named.set(x.file, x.caption);
  }
  const bad: string[] = [];
  let logos = 0, shots = 0, pinsTotal = 0, plans = 0;
  for (const slug of slugs) {
    const t = read(slug), s = L.stories.find(x => x.slug === slug);
    if (!s) continue;
    const need = (cond: unknown, what: string): void => { if (!cond) bad.push(`${slug}: ${what}`); };
    // the people's nav and a section for each person, with the nav the first thing of the people
    const nav = (t.match(/<nav class="who-nav"[\s\S]*?<\/nav>/) || [''])[0];
    need(/<div class="people">\s*<nav class="who-nav"/.test(t), 'the nav is not first in .people');
    for (const m of s.members) need(nav.includes(`<li><a href="#${m.id}"`) && t.includes(`<section class="who" id="${m.id}"`), `${m.id}: nav link or section`);
    // real media: named, with alt, size, loading; a screenshot has its caption (the build checks this too; a page that shows none passes)
    if (media) {
      const r = checkPageImages([{ file: `family/${slug}.html`, html: t }], named, f => fs.existsSync(path.join(OUT, f)));
      for (const p of r.problems.slice(0, 2)) need(false, p);
      logos += (t.match(/<img class="logo"/g) || []).length;
      for (const m of t.matchAll(/<a class="shot-open"[^>]*><img[^>]*src="\.\.\/(portal\/apps\/([a-z0-9-]+)\/shot\.[0-9a-f]{10}\.webp)"/g)) {
        shots++;
        const a = media.apps[m[2]];
        need(a && a.shot && t.includes(`<figcaption>${shotCaption(a.name, a.shot.source)}</figcaption>`), `${m[2]}: the exact caption`);
      }
      need((t.match(/<dialog\b/g) || []).length === 1, 'one dialog');
    }
    // the plan: one pin for each person the plan can place, each a link to a section that exists; the storeys are plain anchors
    const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', `${s.house}.json`), 'utf8'));
    const plan = readPlan(spec);
    need(!!plan && /<section class="block" id="home"/.test(t), 'The home section with a plan');
    if (plan) {
      plans += plan.levels.length;
      const cast = (casting[slug]?.members || []).filter((m: any) => m.id && m.room && s.members.some(x => x.id === m.id)).map((m: any) => ({ id: m.id, name: s.members.find(x => x.id === m.id)!.name, room: m.room }));
      const want = placePins(plan, cast).pins;
      const pins = [...t.matchAll(/<a class="pin" href="#([a-z]+)"/g)].map(m => m[1]);
      pinsTotal += pins.length;
      need([...pins].sort().join() === want.map(p => p.id).sort().join(), `pins ${pins.join()} are not the placed people ${want.map(p => p.id).join()}`);
      for (const id of pins) need(t.includes(`<section class="who" id="${id}"`), `a pin goes to #${id}, which has no section`);
      need((t.match(/<figure class="plan" id="plan-/g) || []).length === plan.levels.length, 'a figure for each storey');
      need(plan.levels.length < 2 || /<nav class="plan-floors"/.test(t), 'the storeys are plain anchors');
    }
    need(scanText(`family/${slug}.html`, t, terms).length === 0, 'a builder or a build is named');
    need(!/\bSims\b|Base Game|\bBG\b/.test(t.replace(/<head[\s\S]*?<\/head>/, '').replace(/<script[\s\S]*?<\/script>/g, '')), 'a Sims word');
  }
  ok(bad.length === 0, `${slugs.length} family pages: the people's nav, a section for each person, the real images (${logos} logos, ${shots} screenshots) named by the manifest with alt, size, lazy loading and the exact caption, ${pinsTotal} pins on ${plans} plans each a link to a person, no builder${bad[0] ? `: ${bad.slice(0, 3).join(' | ')}` : ''}`);

  // ------------------------------------------------------------------ browser, the Brennan page (or the first family that has the v2 fields)
  const slug = slugs.includes('brennan') ? 'brennan' : slugs[0];
  const story = L.stories.find(x => x.slug === slug)!;
  const people = story.members.map(m => m.id);
  const hasDetail = story.beats.some(b => b.detail);
  const hasShots = !!media && /class="shot-open"/.test(read(slug));
  const url = ctx.url(`family/${slug}`);

  // the page's own audit: contrast of the new text against its real background (the ancestors' fills stacked over the page's), 44 px targets on touch, sideways scroll
  const AUDIT = (touch: boolean) => {
    const out: string[] = [];
    const cv = document.createElement('canvas').getContext('2d')!;
    const rgba = (c: string): number[] => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const lum = (r: number, g: number, b: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const over = (top: number[], under: number[]) => [top[0] * top[3] + under[0] * (1 - top[3]), top[1] * top[3] + under[1] * (1 - top[3]), top[2] * top[3] + under[2] * (1 - top[3]), 1];
    const bgOf = (el: Element): number[] => {
      const layers: number[][] = [];
      for (let e: Element | null = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] >= 1) break; }
      let acc = rgba(getComputedStyle(document.body).backgroundColor); if (acc[3] < 1) acc = [255, 255, 255, 1];
      for (const l of layers.reverse()) acc = over(l, acc);
      return acc;
    };
    const sel = '.swap-h, .swap-cap, .swap-list li, .more summary, .more-ba dt, .more-ba dd, .more-cap, .more-steps li, .more-fact, .day-at, .day-who, .day-line, .day-link, .home-facts li, .spot h3, .spot p, .plan-cap, .plan-hint, .shot figcaption, .run > p, .run h3, .who-bio, .who-nav-text small, .who-nav-text b, .moment-body, .chip, .shots h3';
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || el.closest('[hidden]') || el.closest('details:not([open])') && !el.matches('summary') && !el.closest('summary')) continue;
      const fg = rgba(cs.color), bg = bgOf(el), f = over(fg, bg);
      const l1 = lum(f[0], f[1], f[2]), l2 = lum(bg[0], bg[1], bg[2]), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700, need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
      if (ratio < need && out.length < 8) out.push(`${ratio.toFixed(2)} (needs ${need}) "${(el.textContent || '').trim().slice(0, 30)}" in ${el.tagName.toLowerCase()}.${el.className}`);
    }
    if (touch) {
      for (const e of Array.from(document.querySelectorAll('.pin, .day-link, .more summary, .plan-floors a, .who-nav a, .shot-open, .play-from, .who-start, .app-name'))) {
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || (e as HTMLElement).closest('[hidden]')) continue;
        if (r.height < 43.5 || r.width < 43.5) out.push(`${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)} is ${Math.round(r.width)} x ${Math.round(r.height)}`);
      }
    }
    return out;
  };

  for (const [vw, vh, mobile, label] of [[1440, 900, false, '1440'], [390, 844, true, '390']] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      const { page, errors, thirdParty, close } = await ctx.open({ width: vw, height: vh }, mobile, { colorScheme: scheme });
      await page.addInitScript(() => {
        (window as any).__cls = 0;
        try { new PerformanceObserver(l => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* no layout-shift entries here */ }
      });
      await page.goto(url);
      await sleep(500);
      const tag = `${slug} at ${label}, ${scheme}`;
      // lazy images with their size set do not move the page: read the layout shift of the load and of a scroll through the whole page, before anything is opened
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, 0); });
      await sleep(800);
      const cls = await page.evaluate(() => (window as any).__cls as number);
      ok(cls < 0.03, `${tag}: the lazy images shift nothing as they arrive (layout shift ${cls.toFixed(4)})`);
      // the nav sticks under the header, follows the scroll, and does not change size
      const navBox = () => page.evaluate(() => { const n = document.querySelector('.who-nav')!, r = n.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), pos: getComputedStyle(n).position, cur: (document.querySelector('.who-nav a[aria-current]') as HTMLElement | null)?.getAttribute('href') || '' }; });
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
      const first = await navBox();
      const sizes: string[] = [`${first.h}x${first.w}`];
      const followed: string[] = [];
      for (const id of people) {
        await page.evaluate((id: string) => { const e = document.getElementById(id)!; window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 140); }, id);
        await sleep(450);
        const n = await navBox();
        sizes.push(`${n.h}x${n.w}`);
        followed.push(n.cur === `#${id}` && n.pos === 'sticky' && n.top >= 54 && n.top <= 58 ? 'ok' : `${id}: ${JSON.stringify(n)}`);
      }
      ok(followed.every(x => x === 'ok'), `${tag}: the person nav sticks under the header and its aria-current follows the scroll through ${people.join(', ')}${followed.some(x => x !== 'ok') ? ' (' + followed.filter(x => x !== 'ok').join(' | ') + ')' : ''}`);
      ok(new Set(sizes).size === 1, `${tag}: and it never changes size as it follows (${[...new Set(sizes)].join(', ')})`);
      // a person's anchor lands under the bars, not behind them
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate((id: string) => { location.hash = `#${id}`; }, people[people.length - 1]);
      await sleep(500);
      const landed = await page.evaluate((id: string) => ({ top: Math.round(document.getElementById(id)!.getBoundingClientRect().top), nav: Math.round(document.querySelector('.who-nav')!.getBoundingClientRect().bottom) }), people[people.length - 1]);
      ok(landed.top >= landed.nav - 2 && landed.top < landed.nav + 90, `${tag}: #${people[people.length - 1]} lands just under the sticky bars (${landed.top} px, the bars end at ${landed.nav})`);
      // the nav lets go at the end of the people: it does not cover the home or the apps
      await page.evaluate(() => { const e = document.getElementById('apps')!; window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 100); });
      await sleep(300);
      ok(await page.evaluate(() => document.querySelector('.who-nav')!.getBoundingClientRect().bottom <= 60), `${tag}: the nav is gone from the screen past the people`);

      // "More about this moment": a native disclosure
      if (hasDetail) {
        const d = await page.evaluate(() => { const e = document.querySelector<HTMLDetailsElement>('.moment .more')!; e.scrollIntoView({ block: 'center' }); const s = e.querySelector('summary')!, r = s.getBoundingClientRect(); return { open: e.open, h: r.height, text: s.textContent!.trim(), steps: e.querySelectorAll('.more-steps li').length }; });
        await page.click('.moment .more summary');
        const open = await page.evaluate(() => { const e = document.querySelector<HTMLDetailsElement>('.moment .more')!; const b = e.querySelector('.more-body')!.getBoundingClientRect(); return { open: e.open, h: b.height }; });
        await page.click('.moment .more summary');
        const shut = await page.evaluate(() => document.querySelector<HTMLDetailsElement>('.moment .more')!.open);
        ok(!d.open && open.open && open.h > 40 && !shut && d.text === 'More about this moment' && d.steps >= 2 && d.h >= 43.5, `${tag}: "More about this moment" is closed, opens to show its words and closes again, and its line is a 44 px target`);
      }
      // a screenshot opens in the native dialog with its caption; Esc closes it; focus goes back
      if (hasShots) {
        await page.evaluate(() => { const a = document.querySelector('a[data-shot]')!; a.scrollIntoView({ block: 'center' }); });
        await sleep(300);
        const link = await page.evaluate(() => { const a = document.querySelector<HTMLAnchorElement>('a[data-shot]')!; return { href: a.getAttribute('href'), cap: a.closest('figure')!.querySelector('figcaption')!.textContent, loading: a.querySelector('img')!.getAttribute('loading'), w: a.querySelector('img')!.getAttribute('width'), h: a.querySelector('img')!.getAttribute('height'), alt: a.querySelector('img')!.getAttribute('alt') }; });
        await page.focus('a[data-shot]');
        await page.keyboard.press('Enter');
        await sleep(400);
        const dlg = await page.evaluate(() => { const d = document.getElementById('shot-dialog') as HTMLDialogElement, i = d.querySelector('img'); return { open: d.open, src: i ? i.getAttribute('src') : '', cap: d.querySelector('.shot-dialog-cap')!.textContent, inside: d.contains(document.activeElement), w: Math.round(d.getBoundingClientRect().width), vw: innerWidth, named: !!d.getAttribute('aria-label'), full: d.querySelector('.shot-full')!.getAttribute('href') }; });
        ok(dlg.open && dlg.src === link.href && dlg.cap === link.cap && dlg.inside && dlg.w <= dlg.vw && dlg.named && dlg.full === link.href, `${tag}: Enter on a screenshot opens the dialog with the same picture, its exact caption and a link to the file; focus is inside it`);
        ok(!!link.loading && link.loading === 'lazy' && Number(link.w) > 0 && Number(link.h) > 0 && !!link.alt, `${tag}: the screenshot is lazy, with its width and height and alt text (${link.w} x ${link.h})`);
        await page.keyboard.press('Escape');
        await sleep(300);
        const back = await page.evaluate(() => ({ open: (document.getElementById('shot-dialog') as HTMLDialogElement).open, on: (document.activeElement as HTMLElement | null)?.matches('a[data-shot]') }));
        ok(!back.open && back.on, `${tag}: Esc closes it and focus goes back to the screenshot's link`);
        await page.click('a[data-shot]');
        await sleep(300);
        await page.click('.shot-close');
        ok(!(await page.evaluate(() => (document.getElementById('shot-dialog') as HTMLDialogElement).open)), `${tag}: and the Close button closes it too`);
      }
      // the floor plan: a 44 px pin for each person, a link to their section, over no room name
      const plan = await page.evaluate(() => { document.querySelector('.plan-block')!.scrollIntoView({ block: 'center' }); const pins = Array.from(document.querySelectorAll<HTMLAnchorElement>('.pin')); const names = Array.from(document.querySelectorAll('.plan-name')).map(e => e.getBoundingClientRect()); const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; return { n: pins.length, hrefs: pins.map(p => p.getAttribute('href')), size: pins.map(p => { const r = p.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }), over: pins.filter(p => { const c = p.querySelector('.avatar')!.getBoundingClientRect(); return names.some(n => hit(c, n)); }).map(p => p.getAttribute('href')), scroll: Array.from(document.querySelectorAll<HTMLElement>('.plan-scroll')).map(e => e.scrollWidth > e.clientWidth + 1) }; });
      ok(plan.n === people.length && plan.hrefs.join() === people.map(p => `#${p}`).join() && plan.size.every((x: string) => x === '44x44'), `${tag}: the plan has a 44 px pin for each person, each a link to their section (${plan.hrefs.join(' ')})`);
      ok(plan.over.length === 0, `${tag}: and no pin covers a room's name${plan.over.length ? ' (' + plan.over.join(' ') + ')' : ''}`);
      ok(mobile ? plan.scroll.every(Boolean) : !plan.scroll.some(Boolean), `${tag}: the plan ${mobile ? 'scrolls sideways inside its box on a phone' : 'fits its box on a laptop'}`);
      await page.click(`.pin[href="#${people[1]}"]`);
      await sleep(600);
      ok((await page.evaluate(() => location.hash)) === `#${people[1]}`, `${tag}: a pin goes to the person's section (#${people[1]})`);
      // nothing scrolls sideways but the plan and the strips; the contrast of the new text is met; the touch targets are 44 px
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(sideways <= 1, `${tag}: the page does not scroll sideways (${sideways} px over)`);
      await page.evaluate(() => { document.querySelectorAll('details.more').forEach(d => ((d as HTMLDetailsElement).open = true)); });
      const issues = await page.evaluate(AUDIT, mobile);
      ok(issues.length === 0, `${tag}: the new text meets its contrast${mobile ? ' and every control is a 44 px target' : ''}${issues.length ? ': ' + issues.join(' | ') : ''}`);
      if (scheme === 'light') await ctx.shot(page, `family-v2-${label}`);
      ok(errors.length === 0, `${tag}: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
      ok(thirdParty.length === 0, `${tag}: no third-party request${thirdParty.length ? ': ' + thirdParty.join(' | ') : ''}`);
      await close();
    }
  }

  // reduced motion: no transition runs (the nav chips, the pins, the screenshots), and nothing moves by itself
  {
    const { page, close } = await ctx.open({ width: 1440, height: 900 }, false, { reducedMotion: 'reduce' });
    await page.goto(url); await sleep(400);
    const t = await page.evaluate(() => ['.who-nav a', '.pin .avatar', '.shot-open img', '.more summary::before'].map(s => { const e = document.querySelector(s.replace('::before', '')); return e ? getComputedStyle(e, s.endsWith('::before') ? '::before' : null).transitionDuration : '0s'; }));
    ok(t.every((x: string) => /^0s(, 0s)*$/.test(x)), `reduced motion: no transition on the nav chips, the pins, the screenshots or the disclosure's mark (${t.join(' | ')})`);
    ok(!(await page.evaluate(() => document.querySelector('[autoplay], marquee, .carousel'))), 'and nothing autoplays or slides');
    await close();
  }
  // JavaScript off: the details still open, a screenshot is a link to its picture, the pins and the people's nav are links
  {
    const { page, close } = await ctx.open({ width: 1280, height: 800 }, false, { javaScriptEnabled: false });
    await page.goto(url); await sleep(500);
    if (hasDetail) {
      await page.click('.moment .more summary');
      ok(await page.evaluate(() => document.querySelector<HTMLDetailsElement>('.moment .more')!.open && document.querySelector('.moment .more .more-body')!.getBoundingClientRect().height > 40), 'with JavaScript off a moment still opens its detail');
    }
    const info = await page.evaluate(() => ({ shot: (document.querySelector('a[data-shot]') as HTMLAnchorElement | null)?.getAttribute('href') || '', pins: document.querySelectorAll('.pin[href^="#"]').length, nav: document.querySelectorAll('.who-nav a[href^="#"]').length, dialogShown: (() => { const d = document.getElementById('shot-dialog') as HTMLElement | null; return d ? getComputedStyle(d).display !== 'none' : false; })() }));
    ok(info.pins === people.length && info.nav === people.length && (!hasShots || /portal\/apps\/.+\.webp$/.test(info.shot)) && !info.dialogShown, `with JavaScript off: the nav and the pins are plain links (${info.nav}, ${info.pins}), a screenshot is a link to its picture and the dialog stays shut`);
    await close();
  }
}
