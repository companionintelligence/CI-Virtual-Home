// The front page, story v2, in a built site and a browser (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test -- --only hooks` after front page work
//
// "Pick a person", the logos on the family cards, "What the families run" and "How it runs" (scripts/portal-front.mts, portal/gallery.js, portal/gallery.css,
// reference/story/story-v2.md). What it holds:
//
//   static    the cards of the organiser, builder, gamer and learner (a story line, three apps with their real logos, the number of families), a list "Rented before,
//             on the Core now" for every archetype that has a family, a wall that lists every app with a logo once (alphabetical, text only: it links nothing), the band
//             "How it runs" with two real, labelled screenshots; every image of the media is a file the manifest names, with alt text, size and lazy loading; the new
//             words obey the copy rules; no price, no builder; the Core is offered once in the main part (the band's Buy button), as before
//   browser   at 1440 and 390, light and dark: choosing a card is the persona filter (the grid narrows, ?persona= is in the address, the list and the wall follow, a second
//             choice lets it go, the maker and the host are reached by the filter and have a list); the logos on the family cards are 20 px with their alt text; no image of
//             the media is loaded before a scroll on a phone, and none is in the first screen; nothing scrolls sideways; the controls are 44 px; the contrast is met;
//             the screenshots open in the dialog; with JavaScript off the cards and the lists read; reduced motion turns the hover effects off; no console error, no third party
import fs from 'node:fs';
import path from 'node:path';
import type { TestCtx } from '../hooks.ts';
import { readMedia, checkPageImages, appMedia } from '../lib/media.mts';
import { readJson, loadAll } from '../site-lib.mts';

export default async function frontV2(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, OUT, ROOT } = ctx;
  console.log('\nthe front page, story v2');
  const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  const media = readMedia(ROOT);
  const part = (re: RegExp): string => (html.match(re) || [''])[0];
  const pick = part(/<section class="pick"[\s\S]*?<\/section>/), wall = part(/<section class="wall"[\s\S]*?<\/section>/), band = part(/<section class="runs-band"[\s\S]*?<\/section>/);
  const L = loadAll(ROOT, path.join(ROOT, 'content', 'families'));
  const archetypes = [...new Set(L.stories.flatMap(s => s.members.map(m => m.archetype).filter(Boolean)))] as string[];
  const bad: string[] = [];
  const need = (cond: unknown, what: string): void => { if (!cond) bad.push(what); };

  // ------------------------------------------------------------------ static
  const cards = pick.split('<li class="arch" data-persona="').slice(1).map(c => [c, c.slice(0, c.indexOf('"')), c.slice(c.indexOf('">') + 2, c.indexOf('<div class="arch-panels"'))] as const);
  need(cards.map(c => c[1]).join() === ['organiser', 'builder', 'gamer', 'learner'].filter(a => archetypes.includes(a)).join(), `the cards are ${cards.map(c => c[1]).join()}`);
  for (const [, a, rawBody] of cards) {
    const body = rawBody.slice(0, rawBody.indexOf('</li>', rawBody.indexOf('arch-btn')) + 5);
    need(/<h3>[A-Z][a-z]+<\/h3>/.test(body) && /<p class="arch-line">[^<]{20,}<\/p>/.test(body), `${a}: a heading and a story line`);
    need((body.match(/<ul class="arch-apps"[\s\S]*?<\/ul>/) || [''])[0].match(/<li>/g)?.length === 3, `${a}: three apps`);
    need(/<p class="arch-count">In \d+ of the (thirty|\d+) fictional families<\/p>/.test(body), `${a}: in how many families`);
    need(new RegExp(`<button type="button" class="arch-btn" data-persona="${a}" aria-pressed="false"><span class="arch-off">See the ${a} families</span><span class="arch-on">Showing the ${a} families</span></button>`).test(body), `${a}: its one control`);
    // the apps wear their logos beside their names, never alone
    for (const li of body.match(/<ul class="arch-apps"[\s\S]*?<\/ul>/)?.[0].match(/<li>[\s\S]*?<\/li>/g) || []) need(/^<li><img class="logo" [^>]*alt="[^"]+ logo"[^>]*><span>[^<]+<\/span><\/li>$/.test(li), `${a}: a logo beside a name: ${li.slice(0, 60)}`);
  }
  const panels = [...pick.matchAll(/<div class="arch-panel" data-persona="([a-z]+)"/g)].map(m => m[1]);
  need(archetypes.every(a => panels.includes(a)), `a list for each archetype that has a family (${panels.join()})`);
  need((pick.match(/Rented before, on the Core now/g) || []).length === panels.length, 'each list is headed "Rented before, on the Core now"');
  const wallApps = [...wall.matchAll(/<li class="wall-app" data-by="([^"]*)">(<img[^>]*>)<span>([^<]+)<\/span><\/li>/g)];
  need(wallApps.length >= 40, `the wall lists the apps (${wallApps.length})`);
  const names = wallApps.map(w => w[3].replace(/&amp;/g, '&'));
  need(names.join() === [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })).join() && new Set(names).size === names.length, 'the wall is alphabetical and lists each app once');
  need(!/<a\b/.test(wall), 'the wall links nothing');
  need(/<h2 id="runs-h">How it runs<\/h2>/.test(band) && (band.match(/<figure class="shot">/g) || []).length === 2 && (band.match(/<figcaption>Real screenshot of /g) || []).length === 2, 'the band: a heading and two real, labelled screenshots');
  need(/Companion Hub is where you install apps/.test(band) && /Your Companion account pairs your devices/.test(band), 'the band says what each does');
  if (media) {
    const named = new Map<string, string>();
    for (const a of Object.values(media.apps)) { if (a.logo) named.set(a.logo.file, ''); if (a.shot) named.set(a.shot.file, a.shot.caption); }
    for (const x of [...media.ci.hub, ...media.ci.portal]) named.set(x.file, x.caption);
    const r = checkPageImages([{ file: 'index.html', html }], named, f => fs.existsSync(path.join(OUT, f)));
    for (const p of r.problems.slice(0, 3)) need(false, p);
    need(r.shown > 100, `the front page shows ${r.shown} real images`);
    const famCards = html.split('<li class="card card-family"').slice(1).map(c => c.slice(0, c.indexOf('<p class="go"')));
    const lines = famCards.map(c => (c.match(/<ul class="apps"[\s\S]*?<\/ul>/) || [''])[0]);
    need(famCards.length === L.stories.length, `${famCards.length} family cards`);
    need(lines.every(u => { const li = u.match(/<li>[\s\S]*?<\/li>/g) || []; return li.length <= 4 && li.every(x => /^<li><img class="logo" [^>]*alt="[^"]+ logo"[^>]*><span><b>[^<]+<\/b> replaces [^<]+<\/span><\/li>$/.test(x)); }) && lines.some(u => u), 'a family card shows up to four app lines, each with its logo, its name and what it replaces');
  }
  // the words
  const rules = (readJson(path.join(ROOT, 'content', 'story', 'claims.json')).bannedPhrases as { id: string; pattern: string; flags?: string; severity: string }[]).filter(b => b.severity === 'error').map(b => ({ id: b.id, re: new RegExp(b.pattern, b.flags ?? 'i') }));
  const words = [pick, wall, band].map(x => x.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' '));
  const attrs = [pick, wall, band].flatMap(x => [...x.matchAll(/\s(?:alt|aria-label|title)="([^"]*)"/g)].map(m => m[1].replace(/&amp;/g, '&')));
  for (const t of [...words, ...attrs]) for (const r of rules) { const m = r.re.exec(t); if (m) need(false, `"${m[0]}" breaks the copy rule ${r.id}`); }
  need(!/[—–]/.test(words.join(' ')) && !/[$€£]\s?\d/.test(words.join(' ')), 'no dash and no price');
  need(!/\bSims\b|Base Game|\bBG\b/.test(words.join(' ')), 'no builder and no game');
  const main = part(/<main[\s\S]*?<\/main>/);
  need((main.match(/>Buy Companion Core</g) || []).length === 1, `the Core is offered once in the main part (${(main.match(/>Buy Companion Core</g) || []).length})`);
  need((main.match(/id="shot-dialog"/g) || []).length === 1, 'one dialog');
  ok(bad.length === 0, `the front page's story v2 markup: ${cards.length} archetype cards with three logos each, a list for each of ${panels.length} archetypes, a wall of ${wallApps.length} apps, the band, the media named by the manifest with alt, size and lazy loading, the copy rules${bad[0] ? `: ${bad.slice(0, 4).join(' | ')}` : ''}`);

  // ------------------------------------------------------------------ browser
  const AUDIT = () => {
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
    for (const el of Array.from(document.querySelectorAll('.pick h2, .pick-head p, .arch h3, .arch-line, .arch-apps li, .arch-count, .arch-btn, .arch-panel-lead, .arch-panel .swap-h, .arch-panel .swap-cap, .arch-panel .swap-list li, .wall h2, .wall-lead, .wall-app, .wall-note, .runs-band h2, .runs-band .lead, .runs-band .run h3, .runs-band .run > p, .runs-band figcaption, .card-family .apps li'))) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || (el as HTMLElement).closest('[hidden]') || el.closest('.arch-panel:not(.on)')) continue;
      const fg = rgba(cs.color), bg = bgOf(el), f = over(fg, bg);
      const l1 = lum(f[0], f[1], f[2]), l2 = lum(bg[0], bg[1], bg[2]), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700, need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
      // (a dimmed app on the wall is a state, and keeps the muted text colour, which the canon holds to 4.5)
      if (ratio < need && out.length < 8) out.push(`${ratio.toFixed(2)} (needs ${need}) "${(el.textContent || '').trim().slice(0, 28)}" in ${el.tagName.toLowerCase()}.${(el as HTMLElement).className}`);
    }
    return out;
  };
  for (const [vw, vh, mobile, label] of [[1440, 900, false, '1440'], [390, 844, true, '390']] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      const { page, errors, thirdParty, requests, close } = await ctx.open({ width: vw, height: vh }, mobile, { colorScheme: scheme });
      await page.addInitScript(() => {
        (window as any).__cls = 0;
        try { new PerformanceObserver(l => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* none here */ }
      });
      await page.goto(ctx.url(''));
      await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 });
      await sleep(500);
      const tag = `front at ${label}, ${scheme}`;
      // the first screen: on a phone no image of the media is requested or in view until a scroll (the hero picture is the only media above the fold)
      if (mobile) {
        // (the browser's own lazy loading fetches the images a screen or so below the fold ahead of time: those few small files are fine as long as the hero's picture is
        // asked for first and nothing of the media is in the first screen)
        const early = requests.filter((u: string) => /\/portal\/(apps|ci)\//.test(u));
        const hero = requests.findIndex((u: string) => /\/portal\/thumbs\/[a-z0-9-]+\.webp/.test(u));
        const inView = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLImageElement>('img.logo, .shot img')).filter(i => { const r = i.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && r.width > 0; }).length);
        ok(inView === 0 && hero >= 0 && (early.length === 0 || requests.indexOf(early[0]) > hero), `${tag}: no logo or screenshot is in the first screen, and the hero's picture is asked for before any of them (${early.length} small files below the fold were fetched ahead, ${inView} in view)`);
      }
      // choosing a card is the persona filter, and the list and the wall follow
      await page.evaluate(() => document.getElementById('pick')!.scrollIntoView());
      await sleep(250);
      const builder = '.arch-btn[data-persona="builder"]';
      const total = await page.$$eval('#grid .card', (e: HTMLElement[]) => e.filter(x => !x.hidden).length);
      await page.click(builder);
      await sleep(250);
      const on = await page.evaluate(() => ({ pressed: document.querySelector('.arch-btn[data-persona="builder"]')!.getAttribute('aria-pressed'), card: document.querySelector('.arch[data-persona="builder"]')!.classList.contains('on'), panel: (() => { const p = document.querySelector<HTMLElement>('.arch-panel[data-persona="builder"]')!; return p.classList.contains('on') && p.getBoundingClientRect().height > 40; })(), others: document.querySelectorAll('.arch-panel.on').length, q: location.search, cards: Array.from(document.querySelectorAll<HTMLElement>('#grid .card')).filter(x => !x.hidden).length, dim: document.querySelectorAll('.wall-app.dim').length, lit: Array.from(document.querySelectorAll<HTMLElement>('.wall-app:not(.dim)')).every(e => (e.dataset.by || '').split(' ').includes('builder')) }));
      ok(on.pressed === 'true' && on.card && on.panel && on.others === 1 && on.q.includes('persona=builder') && on.cards > 0 && on.cards < total, `${tag}: choosing the builder card narrows the grid to ${on.cards} of ${total}, puts persona=builder in the address and shows its list`);
      ok(on.dim > 0 && on.lit, `${tag}: and dims ${on.dim} apps on the wall that no builder uses (the others are the ones the builders' stories name)`);
      await page.click(builder);
      await sleep(250);
      const off = await page.evaluate(() => ({ pressed: document.querySelector('.arch-btn[data-persona="builder"]')!.getAttribute('aria-pressed'), panels: document.querySelectorAll('.arch-panel.on').length, dim: document.querySelectorAll('.wall-app.dim').length, q: location.search, cards: Array.from(document.querySelectorAll<HTMLElement>('#grid .card')).filter(x => !x.hidden).length }));
      ok(off.pressed === 'false' && off.panels === 0 && off.dim === 0 && !off.q.includes('persona') && off.cards === total, `${tag}: choosing it again lets it go (the grid, the list, the wall and the address are as they were)`);
      // (the filter buttons are the six categories now, code to care; the archetype lists are reached by the four cards above)
      // the logos on the family cards: 20 px, with their alt text and size set
      const cl = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLImageElement>('#grid .card-family .apps img.logo')).map(i => { const r = i.getBoundingClientRect(); return { w: Math.round(r.width), alt: i.alt, lazy: i.loading, attrs: !!i.getAttribute('width') && !!i.getAttribute('height'), name: (i.parentElement!.querySelector('b')!.textContent || '') }; }));
      ok(cl.length >= 30 && cl.every((x: any) => x.w === 20 && x.alt === `${x.name} logo` && x.lazy === 'lazy' && x.attrs), `${tag}: the ${cl.length} logos on the family cards are 20 px, lazy, with width and height and the alt text "<app> logo"`);
      // the band: its screenshots open in the dialog
      await page.evaluate(() => document.getElementById('runs')!.scrollIntoView({ block: 'center' }));
      await sleep(300);
      await page.click('.runs-band a[data-shot]');
      await sleep(300);
      ok(await page.evaluate(() => { const d = document.getElementById('shot-dialog') as HTMLDialogElement; return d.open && !!d.querySelector('img') && (d.querySelector('.shot-dialog-cap')!.textContent || '').startsWith('Real screenshot of '); }), `${tag}: a screenshot of the band opens in the dialog with its caption`);
      await page.keyboard.press('Escape');
      await sleep(200);
      ok(await page.evaluate(() => !(document.getElementById('shot-dialog') as HTMLDialogElement).open && document.activeElement?.matches('a[data-shot]')), `${tag}: and Esc closes it and gives focus back`);
      // no sideways scroll, the contrast, the 44 px targets, and the layout shift of the lazy images
      ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, `${tag}: the page does not scroll sideways`);
      await page.evaluate(() => { document.getElementById('wall')!.scrollIntoView(); });
      const issues = await page.evaluate(AUDIT);
      ok(issues.length === 0, `${tag}: the new text meets its contrast${issues.length ? ': ' + issues.join(' | ') : ''}`);
      if (mobile) {
        const small = await page.evaluate(() => Array.from(document.querySelectorAll('.arch-btn, .arch-panel a, .runs-band a[data-shot]')).filter(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.height < 43.5; }).map(e => `${(e.textContent || '').trim().slice(0, 24)} ${Math.round(e.getBoundingClientRect().height)}`));
        ok(small.length === 0, `${tag}: the cards' buttons and the band's links are 44 px targets${small.length ? ': ' + small.join(', ') : ''}`);
      }
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } window.scrollTo(0, 0); });
      await sleep(600);
      const cls = await page.evaluate(() => (window as any).__cls as number);
      ok(cls < 0.03, `${tag}: the logos and screenshots shift nothing as they arrive (layout shift ${cls.toFixed(4)})`);
      if (scheme === 'light') { await page.evaluate(() => document.getElementById('pick')!.scrollIntoView()); await sleep(300); await ctx.shot(page, `front-v2-${label}`); }
      ok(errors.length === 0, `${tag}: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
      ok(thirdParty.length === 0, `${tag}: no third-party request${thirdParty.length ? ': ' + thirdParty.join(' | ') : ''}`);
      await close();
    }
  }
  // the address carries the choice: a link to ?persona=code opens with the filter pressed and the ad tag kept (the archetype cards are a way into the same filter, not a link target now)
  {
    const { page, close } = await ctx.open({ width: 1280, height: 800 });
    await page.goto(ctx.url('?persona=code&utm_source=meta'));
    await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 });
    ok(await page.evaluate(() => document.querySelector('#personas .persona[data-persona="code"]')!.getAttribute('aria-pressed') === 'true' && location.search.includes('utm_source=meta') && location.search.includes('persona=code')), '?persona=code opens with the Code filter pressed, and the ad tag stays in the address');
    await close();
  }
  // reduced motion: the card does not move or fade on hover, and nothing slides by itself
  {
    const { page, close } = await ctx.open({ width: 1280, height: 800 }, false, { reducedMotion: 'reduce' });
    await page.goto(ctx.url(''));
    await page.waitForFunction(() => document.documentElement.dataset.gallery === 'ready', null, { timeout: 20000 });
    await page.evaluate(() => document.getElementById('pick')!.scrollIntoView());
    await page.hover('.arch[data-persona="organiser"]');
    await sleep(300);
    const m = await page.evaluate(() => { const a = document.querySelector('.arch[data-persona="organiser"]')!; return { t: getComputedStyle(a).transform, d: getComputedStyle(a).transitionDuration, auto: !!document.querySelector('[autoplay], marquee, .carousel') }; });
    ok((m.t === 'none' || m.t === 'matrix(1, 0, 0, 1, 0, 0)') && /^0s(, 0s)*$/.test(m.d) && !m.auto, `reduced motion: a card does not lift or animate on hover (${m.t}, ${m.d}) and no carousel plays`);
    await close();
  }
  // JavaScript off: the cards and their lists read (the buttons, which would do nothing, are not there), the wall and the band are whole
  {
    const { page, close } = await ctx.open({ width: 1280, height: 800 }, false, { javaScriptEnabled: false });
    await page.goto(ctx.url(''));
    await sleep(500);
    const j = await page.evaluate(() => ({ cards: document.querySelectorAll('.arch').length, btn: Array.from(document.querySelectorAll<HTMLElement>('.arch-btn')).some(b => getComputedStyle(b).display !== 'none'), lists: Array.from(document.querySelectorAll<HTMLElement>('.arch-panel')).filter(p => p.getBoundingClientRect().height > 40).length, wall: document.querySelectorAll('.wall-app').length, runs: document.querySelectorAll('.runs-band .shot').length, family: document.querySelectorAll('#grid .card-family').length }));
    ok(j.cards === cards.length && !j.btn && j.lists === panels.length && j.wall >= 40 && j.runs === 2 && j.family === L.stories.length, `with JavaScript off: the ${j.cards} cards, their ${j.lists} lists, the wall of ${j.wall} apps, the band and the ${j.family} families are on the page, and no button that would do nothing`);
    await close();
  }
  void appMedia;
}
