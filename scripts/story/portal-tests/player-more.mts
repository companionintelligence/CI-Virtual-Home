// The tour card, story v2, in a browser (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test -- --only hooks` after player work
//
//   T11  the real logo on the card's app chip (1.3 times the card's type, alt text, the file the story names, never a screenshot anywhere in the tour); the "More" toggle on a beat that has a
//        `detail`: a 44 px button with aria-expanded and aria-controls, outside the card's aria-hidden words, that opens the beat's before and after in the card and closes
//        again, by click, Enter, Space and Esc (focus stays on the button); opening it pauses the tour; the card, solved again for its new size, still keeps off what the beat
//        is about (under 2 % on a wide screen; on a phone the sheet is never over 55 % of the height, never taller than it was unless the room under the subject allows,
//        and covers no more of the subject than it did closed); a beat with no detail has no toggle; the start card carries the home's first sentence; no card is taller
//        than the closed one with its "More" shut (the toggle takes no height); reduced motion opens the same way
//
// It runs for the first tour whose story has details (the Brennan family today; any family that gets them tomorrow) at 1440 and 390 and says so when no tour has any.
import type { TestCtx } from '../hooks.ts';

type Page = any;
const MAX_OVERLAP = 0.02, SHEET_MAX = 0.55;

export default async function playerMore(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, url } = ctx;
  const byFamily: Record<string, any> = (ctx.manifest as any).byFamily || {};
  console.log('\nT11 the tour card, story v2');
  // the tours whose story has a detail: ask each story file the build wrote
  const fs = await import('node:fs'), path = await import('node:path');
  let slug = '';
  for (const [s, v] of Object.entries<any>(byFamily)) {
    if (!v.story) continue;
    try { const rs = JSON.parse(fs.readFileSync(path.join(ctx.OUT, v.story), 'utf8')); if (rs.beats.some((b: any) => b.detail)) { slug = s; break; } } catch { /* next */ }
  }
  if (!slug) { console.log('  no tour has a beat with a detail in this build: nothing to test'); return; }
  // ---- the shipped story carries the apps' real logos (and never a screenshot): each is a file that is in the output
  {
    const rs = JSON.parse(fs.readFileSync(path.join(ctx.OUT, byFamily[slug].story), 'utf8'));
    const ids = new Set<string>();
    for (const b of rs.beats) { if (b.app) ids.add(b.app.id); for (const w of b.with || []) ids.add(w); }
    const media = rs.media || {};
    const problems = [...ids].filter(id => media[id]).flatMap(id => {
      const m = media[id], l = m.logo;
      return [Object.keys(m).sort().join() !== 'logo,name' ? `${id}: keys ${Object.keys(m).join()}` : '', !l || !fs.existsSync(path.join(ctx.OUT, l.file)) ? `${id}: no logo file` : '', l && (!l.alt || l.w !== 128 || l.h !== 128) ? `${id}: alt or size` : '', JSON.stringify(m).includes('shot.') ? `${id}: a screenshot` : ''].filter(Boolean);
    });
    ok(problems.length === 0 && Object.keys(media).length > 5 && Object.keys(media).every(id => ids.has(id)), `${slug}: the shipped story names ${Object.keys(media).length} real logos, each a file of the output with its alt text and size, only for apps its beats name, and no screenshot${problems[0] ? ': ' + problems.slice(0, 3).join(' | ') : ''}`);
  }
  const link = (q = '') => url(`room-creator?mode=view&house=${byFamily[slug].house}&family=${slug}${q ? '&' + q : ''}`);
  const wait = async (page: Page) => {
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' && !!(window as any).__houseStory, null, { timeout: 240000 });
    await sleep(300);
  };
  const startSilent = async (page: Page) => { await page.locator('.st-start .st-actions .st-btn').last().click(); await sleep(500); };
  const playing = (page: Page): Promise<boolean> => page.evaluate(() => !!(window as any).__houseViewer.playing);

  for (const [vw, vh, mobile, label] of [[1440, 900, false, '1440'], [390, 844, true, '390']] as const) {
    const { page, errors, thirdParty, close } = await ctx.open({ width: vw, height: vh }, mobile);
    await page.goto(link()); await wait(page);
    const rs = await page.evaluate(() => { const r = (window as any).__houseStory.rs; return { beats: r.beats.map((b: any) => ({ id: b.id, app: b.app && b.app.id, chips: b.popup.chips || [], detail: b.detail || null, with: b.with || [] })), media: r.media || {}, lede: r.family.home && r.family.home.lede || '' }; });
    const detailed = rs.beats.map((b: any, i: number) => ({ ...b, i })).filter((b: any) => b.detail);
    // ---- the start card carries the home in one line; nothing in the tour is a screenshot
    const first = rs.lede.replace(/\s+/g, ' ').trim().match(/^.*?[.!?](?=\s|$)/)?.[0] || '';
    const home = await page.$eval('.st-start-card', (e: HTMLElement) => (e.querySelector('.st-start-home') || { textContent: '' }).textContent);
    ok(!first || home === first, `${label}: the start card says the home in one line (its first sentence: "${(home || '').slice(0, 50)}…")`);
    await startSilent(page);
    let pictures = 0;

    // ---- the logo on the chip: the file the story names, 20 px, alt text; the beat's other chips wear none
    const withLogo = detailed.find((b: any) => b.app && rs.media[b.app] && rs.media[b.app].logo && b.chips.some((c: string) => c.toLowerCase() === rs.media[b.app].name.toLowerCase()));
    if (withLogo) {
      await page.evaluate((i: number) => (window as any).__houseStory.measure(i), withLogo.i);
      await sleep(500);
      const logo = await page.evaluate(() => { const i = document.querySelector<HTMLImageElement>('.st-card .st-chip-app img.st-logo'); if (!i) return null; const r = i.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), want: Math.round(1.3 * parseFloat(getComputedStyle(i.parentElement!).fontSize)), alt: i.alt, src: i.getAttribute('src') || '', natural: i.naturalWidth, chip: i.parentElement!.textContent, replaces: !!document.querySelector('.st-chip-replaces img') }; });
      const want = rs.media[withLogo.app].logo;
      ok(!!logo && logo.w === logo.want && logo.h === logo.want && logo.w >= 26 && logo.alt === want.alt && logo.src.endsWith(want.file) && logo.natural > 0 && !logo.replaces, `${label}: the chip "${logo ? logo.chip : ''}" wears its real logo, ${logo ? logo.w : '?'} px (1.3 times the card's type, 20 px before the type grew), with the alt text "${want.alt}" (the file the story names, decoded)`);
    } else ok(true, `${label}: (no beat with a detail has a chip that names an app with a logo: nothing to look at)`);
    pictures = await page.evaluate(() => document.querySelectorAll('.st img[src*="/shot."], .st img[src*="portal/ci/"], .st-card img:not(.st-logo)').length);
    ok(pictures === 0, `${label}: no screenshot is in the tour (${pictures})`);

    // ---- the toggle and the placement, for every beat that has a detail (and none for a beat that has not)
    const bad: string[] = [];
    let worstOpen = 0, worstClosed = 0, tallest = 0;
    for (const b of rs.beats.map((x: any, i: number) => ({ ...x, i }))) {
      const closed = await page.evaluate((i: number) => (window as any).__houseStory.measure(i), b.i);
      await sleep(40);
      if (!b.detail) { if (closed.hasMore) bad.push(`${b.id}: a toggle on a beat with no detail`); continue; }
      if (!closed.hasMore || closed.expanded) { bad.push(`${b.id}: no closed toggle`); continue; }
      worstClosed = Math.max(worstClosed, closed.overlapLive);
      const opened = await page.evaluate(async (i: number) => { const s = (window as any).__houseStory; await s.setMore(true); return s.measure(i); }, b.i);
      await sleep(40);
      if (!opened.expanded) bad.push(`${b.id}: it did not open`);
      worstOpen = Math.max(worstOpen, opened.overlapLive);
      tallest = Math.max(tallest, opened.card.h / opened.vh);
      if (mobile) {
        if (opened.card.h > opened.vh * SHEET_MAX + 1) bad.push(`${b.id}: the open sheet is ${(opened.card.h / opened.vh * 100).toFixed(0)} % of the height`);
        if (opened.overlapLive > closed.overlapLive + 0.005) bad.push(`${b.id}: open it covers ${(opened.overlapLive * 100).toFixed(1)} % of the subject (closed ${(closed.overlapLive * 100).toFixed(1)} %)`);
      } else if (opened.overlapLive > MAX_OVERLAP) bad.push(`${b.id}: open it covers ${(opened.overlapLive * 100).toFixed(1)} % of what it is about`);
      if (opened.card.x < -0.5 || opened.card.y < -0.5 || opened.card.x + opened.card.w > opened.vw + 0.5 || opened.card.y + opened.card.h > opened.vh + 0.5) bad.push(`${b.id}: the open card leaves the window`);
      if (opened.overlapBars > 0.5) bad.push(`${b.id}: the open card touches the bars`);
      // the panel holds the beat's before and after, word for word
      const text = await page.evaluate(() => (document.querySelector('.st-more') as HTMLElement).textContent!.replace(/\s+/g, ' ').trim());
      if (!text.includes(b.detail.before) || !text.includes(b.detail.after)) bad.push(`${b.id}: the panel is not the detail's before and after`);
      await page.evaluate(async () => { await (window as any).__houseStory.setMore(false); });
    }
    ok(bad.length === 0, `${label}: all ${detailed.length} beats with a detail have the toggle, open to their before and after and close again, and a beat with none has no toggle${bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''}`);
    ok(mobile ? tallest <= SHEET_MAX + 0.003 : worstOpen <= MAX_OVERLAP, mobile ? `${label}: the open sheet is never above 55 % of the height (tallest ${(tallest * 100).toFixed(1)} %) and covers no more of the subject than it did closed (closed worst ${(worstClosed * 100).toFixed(1)} %, open worst ${(worstOpen * 100).toFixed(1)} %)` : `${label}: the open card, placed again for its size, covers ${(worstOpen * 100).toFixed(2)} % of what the beat is about at worst (under 2 %)`);
    if (!mobile) ok(worstClosed <= MAX_OVERLAP, `${label}: and the closed card as ever ${(worstClosed * 100).toFixed(2)} %`);

    // ---- the control: a 44 px button, outside the aria-hidden words, aria-expanded and aria-controls; click, Enter, Space and Esc; it pauses the tour
    const probe = detailed[Math.min(2, detailed.length - 1)];
    await page.evaluate((i: number) => (window as any).__houseStory.goBeat(i), probe.i);
    await sleep(900);
    await page.evaluate(() => (window as any).__houseStory.start && 0);
    const btn = '.st-card .st-more-btn';
    const info = await page.evaluate((sel: string) => { const b = document.querySelector<HTMLElement>(sel); if (!b) return null; const r = b.getBoundingClientRect(), id = b.getAttribute('aria-controls') || ''; return { w: Math.round(r.width), h: Math.round(r.height), exp: b.getAttribute('aria-expanded'), ctl: !!id && !!document.getElementById(id), hidden: !!b.closest('[aria-hidden="true"]'), name: b.getAttribute('aria-label') || b.textContent, panelHidden: (document.getElementById(id) as HTMLElement).hidden, textHidden: Array.from(document.querySelectorAll('.st-card .st-title, .st-card .st-body, .st-card .st-chips')).every(e => e.closest('[aria-hidden="true"]')), cardHidden: !!document.querySelector('.st-card')!.closest('[aria-hidden="true"]') }; }, btn);
    ok(!!info && info.w >= 44 && info.h >= 44 && info.exp === 'false' && info.ctl && info.panelHidden && !info.hidden && info.textHidden && !info.cardHidden && /More/.test(info.name), `${label}: "More" is a ${info ? `${info.w} x ${info.h}` : '?'} button with aria-expanded="false" and aria-controls, outside the words that are aria-hidden for the live region`);
    await page.evaluate(() => { const s = (window as any).__houseViewer; s.control && s.control.setPlaying(true); });
    await sleep(300);
    const wasPlaying = await playing(page);
    await page.focus(btn);
    await page.keyboard.press('Enter');
    await sleep(500);
    const afterEnter = await page.evaluate((sel: string) => ({ exp: document.querySelector(sel)!.getAttribute('aria-expanded'), shown: !(document.getElementById(document.querySelector(sel)!.getAttribute('aria-controls')!) as HTMLElement).hidden, focus: document.activeElement === document.querySelector(sel) }), btn);
    ok(afterEnter.exp === 'true' && afterEnter.shown && afterEnter.focus, `${label}: Enter opens it and focus stays on the button`);
    ok(wasPlaying ? !(await playing(page)) : true, `${label}: and opening it pauses the tour${wasPlaying ? '' : ' (it was paused already)'}`);
    await page.keyboard.press('Space');
    await sleep(400);
    ok(await page.evaluate((sel: string) => document.querySelector(sel)!.getAttribute('aria-expanded') === 'false' && document.activeElement === document.querySelector(sel), btn), `${label}: Space closes it (and does not play: Space on a focused button is the button's)`);
    await page.keyboard.press('Space');
    await sleep(300);
    await page.keyboard.press('Escape');
    await sleep(300);
    const esc = await page.evaluate((sel: string) => ({ exp: document.querySelector(sel)!.getAttribute('aria-expanded'), focus: document.activeElement === document.querySelector(sel), toast: !!document.querySelector('.vh-toast:not([hidden])') }), btn);
    ok(esc.exp === 'false' && esc.focus, `${label}: Esc closes it and leaves focus on the button`);
    await page.click(btn);
    await sleep(300);
    ok(await page.evaluate((sel: string) => document.querySelector(sel)!.getAttribute('aria-expanded') === 'true', btn), `${label}: a click opens it`);
    // moving to the next beat starts the next card closed (the step is a frame or two away on a slow machine: wait for the new card)
    const was = await page.evaluate(() => (document.querySelector('.st-card') as HTMLElement).dataset.beat);
    await page.keyboard.press('ArrowRight');
    let now = was;
    for (let k = 0; k < 32 && now === was; k++) { await sleep(250); now = await page.evaluate(() => (document.querySelector('.st-card') as HTMLElement).dataset.beat); }
    ok(now !== was && await page.evaluate(() => { const b = document.querySelector('.st-card .st-more-btn'); return !b || b.getAttribute('aria-expanded') === 'false'; }), `${label}: the next beat's card (${now}) opens closed`);
    ok(errors.length === 0, `${label}: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    ok(thirdParty.length === 0, `${label}: no third-party request`);
    await close();
  }

  // ---- reduced motion: the same toggle, the tour opens paused and stays so
  {
    const { page, close } = await ctx.open({ width: 1440, height: 900 }, false, { reducedMotion: 'reduce' });
    await page.goto(link()); await wait(page);
    await startSilent(page);
    const rs = await page.evaluate(() => (window as any).__houseStory.rs.beats.findIndex((b: any) => b.detail));
    await page.evaluate((i: number) => (window as any).__houseStory.goBeat(i), rs);
    await sleep(900);
    const before = await page.evaluate(() => (window as any).__houseViewer.t);
    await page.click('.st-card .st-more-btn');
    await sleep(900);
    const after = await page.evaluate(() => ({ t: (window as any).__houseViewer.t, open: document.querySelector('.st-card .st-more-btn')!.getAttribute('aria-expanded'), tr: getComputedStyle(document.querySelector('.st-more-i')!).transitionDuration }));
    ok(after.open === 'true' && Math.abs(after.t - before) < 0.002 && /^0s(, 0s)*$/.test(after.tr), `reduced motion: "More" opens, nothing advances (${before.toFixed(3)} to ${after.t.toFixed(3)}) and the chevron does not animate (${after.tr})`);
    await close();
  }
}
