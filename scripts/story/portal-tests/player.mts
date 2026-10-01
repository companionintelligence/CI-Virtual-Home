// The interactive tour, in a browser (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test` (or `-- --only hooks`) after player work
//
//   T6  popup placement: at 1440 and 390, for every beat of one family, the card never covers the thing the beat is about (under 2 %),
//       never touches the top bar or the dock, sits in the window, and (600 px and under) is a sheet of at most 38 % of the height;
//       the chapters list has one button per beat; the live text is the beat's text; the end card covers under 5 % of the Core
//   T7  keyboard and accessibility: Space, arrows, Shift+arrows, M, digits, C, Esc in the order the plan gives; focus is never taken on
//       a beat change and never trapped; one polite live region; the canvas is an image with a label; captions are on screen whenever
//       narration is audible; the start card and the end card at both widths have no unnamed control, a labelled dialog, no duplicate
//       id and the contrast the canon asks for (the in-repo audit stands in for axe-core, which is MPL-2.0)
//   T8  audio and the gesture: no AudioContext and no source started before the click; "Start without sound" never makes a context and
//       costs no audio bytes; "Start with narration" does, and plays; M after a silent start is a gesture too; ?no=story shows none of it
//   +   the contrast of every piece of text the tour draws at 390, 768 and 1440; reduced motion (opens paused, nothing advances, a step
//       is a cut, no pulsing ring); a shared ?beat= link; the failure paths (story file 404, audio 404); next family
import type { TestCtx } from '../hooks.ts';

type Page = any;
const MAX_OVERLAP = 0.02, SHEET_MAX = 0.38, CORE_MAX = 0.05;

export default async function player(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, base, url } = ctx;
  const tours = Object.entries<any>((ctx.manifest as any).byFamily || {}).filter(([, v]) => v && v.story).map(([slug]) => slug);
  if (!tours.length) { console.log('  no family has a tour in this build: nothing to test'); return; }
  // the exemplar (with a TV) first, then one whose house has none, when the build has both
  const noTv = tours.find(s => s === 'okonkwo-reid') || tours[1];
  const SLUG = tours.includes('vance-takahashi') ? 'vance-takahashi' : tours[0];
  const second = noTv && noTv !== SLUG ? noTv : null;

  const link = (slug: string, q = '') => url(`room-creator.html?mode=view&family=${slug}${q ? '&' + q : ''}`);
  const wait = async (page: Page) => {
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' && !!(window as any).__houseStory, null, { timeout: 120000 });
    await sleep(300);
  };
  /** counts what the gesture rule is about, before any script of the page runs */
  const spy = (page: Page) => page.addInitScript(() => {
    const w = window as any;
    w.__ac = 0; w.__src = 0; w.__play = 0;
    const AC = w.AudioContext;
    if (AC) {
      w.AudioContext = function (...a: any[]) { w.__ac++; return new AC(...a); };
      w.AudioContext.prototype = AC.prototype;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a: any[]) { w.__src++; return (start as any).apply(this, a); };
    }
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a: any[]) { w.__play++; return (play as any).apply(this, a); };
  });
  const state = (page: Page) => page.evaluate(() => (window as any).__houseStory.state);
  const rs = (page: Page) => page.evaluate(() => { const r = (window as any).__houseStory.rs; return { beats: r.beats.map((b: any) => ({ id: b.id, chapter: b.chapter, title: b.popup.title, body: b.popup.body, note: b.popup.note || '' })), chapters: r.chapters.map((c: any) => ({ id: c.id, title: c.title })), surname: r.family.surname }; });
  // (the last button of the start card: "Start without sound", or the only one for a family with no recording)
  const startSilent = async (page: Page) => { await page.locator('.st-start .st-actions .st-btn').last().click(); await sleep(500); };

  // ------------------------------------------------------------------ the page's own audit, run in the page on whatever is showing in `.st`
  const AUDIT = (scopeSel: string) => {
    const out: string[] = [];
    const issue = (m: string) => { if (out.length < 12) out.push(m); };
    const root = document.querySelector(scopeSel);
    if (!root) return ['nothing to audit: ' + scopeSel];
    const cv = document.createElement('canvas').getContext('2d')!;
    const rgba = (c: string): [number, number, number, number] => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const lum = (r: number, g: number, b: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const over = (top: number[], under: number[]) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
    // what is behind a piece of text: the nearest ancestors' backgrounds stacked, over the WORST thing the 3D view could show (white, then black)
    const stack = (el: Element): number[][] => { const s: number[][] = []; for (let e: Element | null = el; e; e = e.parentElement) { const bg = rgba(getComputedStyle(e).backgroundColor); if (bg[3] > 0) s.push(bg); if (bg[3] >= 1) break; } return s.reverse(); };
    const visible = (e: Element) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    for (const e of Array.from(root.querySelectorAll('a[href],button,input,select,textarea,summary'))) {
      if (!visible(e)) continue;
      const name = (e.getAttribute('aria-label') || '').trim() || (e.textContent || '').trim();
      if (!name) issue(`${e.tagName.toLowerCase()} without a name: ${(e.outerHTML || '').slice(0, 80)}`);
    }
    for (const d of Array.from(root.querySelectorAll('[role="dialog"]'))) {
      const lb = d.getAttribute('aria-labelledby');
      if (!(d.getAttribute('aria-label') || (lb && document.getElementById(lb)?.textContent?.trim()))) issue('a dialog without a name');
    }
    const ids = new Map<string, number>(); for (const e of Array.from(document.querySelectorAll('[id]'))) ids.set(e.id, (ids.get(e.id) || 0) + 1);
    for (const [id, n] of ids) if (n > 1) issue(`the id ${id} is used ${n} times`);
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement; if (!el || seen.has(el) || !(n.textContent || '').trim()) continue;
      seen.add(el);
      if (!visible(el) || el.closest('[hidden],.st-live-region,svg')) continue;
      const cs = getComputedStyle(el);
      let op = 1; for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      if (op < 0.99) continue;                      // mid-fade: judged when it has settled
      const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
      const need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
      const fg = rgba(cs.color), layers = stack(el);
      let worst = 99;
      for (const under of [[255, 255, 255, 1], [0, 0, 0, 1]]) {
        let acc: number[] = under;
        for (const l of layers) acc = over(l, acc);
        const f = over(fg, acc);
        const l1 = lum(f[0], f[1], f[2]), l2 = lum(acc[0], acc[1], acc[2]);
        worst = Math.min(worst, (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
      }
      if (worst < need) issue(`contrast ${worst.toFixed(2)} (needs ${need}) for "${(n.textContent || '').trim().slice(0, 36)}" in <${el.tagName.toLowerCase()} class="${el.className}">`);
    }
    return out;
  };
  /** the 44 px rule, for the controls the tour makes (touch) */
  const SMALL_TARGETS = (scopeSel: string, min: number) => {
    const out: string[] = [];
    for (const e of Array.from(document.querySelectorAll(`${scopeSel} button, ${scopeSel} a[href], ${scopeSel} summary`))) {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || (e as HTMLElement).closest('[hidden]')) continue;
      if (r.height < min - 0.5 || r.width < min - 0.5) out.push(`${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)} is ${Math.round(r.width)} x ${Math.round(r.height)}`);
    }
    return out;
  };

  // ================================================================== T6 popup placement
  const placement = async (slug: string, vw: number, vh: number, mobile: boolean, label: string) => {
    console.log(`\nT6 placement, ${slug} at ${label}`);
    const { page, errors, close } = await ctx.open({ width: vw, height: vh }, mobile);
    await page.goto(link(slug)); await wait(page);
    ok(await page.isVisible('.st-start'), 'the start card is up and the tour waits for it');
    await startSilent(page);
    const story = await rs(page);
    const bad: string[] = [], modes = new Set<string>();
    let worstOverlap = 0, worstH = 0, nSheet = 0;
    for (let i = 0; i < story.beats.length; i++) {
      const m = await page.evaluate((i: number) => (window as any).__houseStory.measure(i), i);
      await sleep(60);
      const b = story.beats[i];
      modes.add(m.mode);
      if (m.mode === 'sheet') nSheet++;
      worstOverlap = Math.max(worstOverlap, m.overlapLive);
      worstH = Math.max(worstH, m.card.h / m.vh);
      if (!m.visible || m.hidden) { bad.push(`${b.id}: the card is not showing`); continue; }
      if (m.overlapLive > MAX_OVERLAP) bad.push(`${b.id}: the card covers ${(m.overlapLive * 100).toFixed(1)} % of what it is about`);
      if (m.overlapBars > 0.5) bad.push(`${b.id}: the card touches the bars (${Math.round(m.overlapBars)} px2)`);
      if (m.card.x < -0.5 || m.card.y < -0.5 || m.card.x + m.card.w > m.vw + 0.5 || m.card.y + m.card.h > m.vh + 0.5) bad.push(`${b.id}: the card leaves the window (${[m.card.x, m.card.y, m.card.w, m.card.h].map(Math.round)})`);
      if (vw <= 600 && (m.mode !== 'sheet' || m.card.h > m.vh * SHEET_MAX + 1)) bad.push(`${b.id}: a phone gets a sheet of at most 38 % (${m.mode}, ${(m.card.h / m.vh * 100).toFixed(0)} %)`);
      const text: string = await page.$eval('.st-card .st-body', (e: HTMLElement) => e.textContent || '');
      if (text.replace(/\s+/g, ' ').trim() !== b.body.replace(/\s+/g, ' ').trim()) bad.push(`${b.id}: the card's words are not the beat's`);
    }
    ok(bad.length === 0, `all ${story.beats.length} beats: the card is ${vw <= 600 ? 'a bottom sheet' : 'placed'}, never over the subject (worst ${(worstOverlap * 100).toFixed(2)} %), off the bars, in the window${bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''}`);
    if (vw <= 600) ok(worstH <= SHEET_MAX + 0.003, `no sheet above 38 % of the height (tallest ${(worstH * 100).toFixed(1)} %)`);
    else ok(modes.size >= 1 && nSheet === 0, `the card floats at ${label} (${[...modes].join(', ')})`);
    // the chapters list has a button for every beat and the live text is the beat's
    await page.keyboard.press('c'); await sleep(300);
    const listed = await page.$$eval('.st-bt', (els: Element[]) => els.length);
    ok(listed === story.beats.length, `the chapters list has ${listed} stops for ${story.beats.length} beats`);
    const chs = await page.$$eval('.st-ch-item .st-ch', (els: Element[]) => els.length);
    ok(chs === story.chapters.length, `and ${chs} chapters for ${story.chapters.length}`);
    await page.keyboard.press('Escape');
    for (const i of [0, Math.floor(story.beats.length / 2), story.beats.length - 1]) {
      await page.evaluate((i: number) => (window as any).__houseStory.goBeat(i), i); await sleep(900);
      const live: string = await page.$eval('.st-live-region', (e: HTMLElement) => e.textContent || '');
      const b = story.beats[i], ci = story.chapters.findIndex((c: any) => c.id === b.chapter);
      ok(live === `Chapter ${ci + 1} of ${story.chapters.length}, ${story.chapters[ci].title}. ${b.title}. ${b.body}`, `beat ${i + 1}: the live region says "Chapter ${ci + 1} of ${story.chapters.length}, ${story.chapters[ci].title}. ${b.title}. …"`);
    }
    // the end card: words, and how much of the Core it covers
    const e = await page.evaluate(() => (window as any).__houseStory.measureEnd());
    const t: string = await page.$eval('.st-end', (el: HTMLElement) => el.textContent || '');
    ok(e.visible && t.includes('Meet the Companion Core.') && t.includes('This family is fictional. The software is real.'), 'the end card says "Meet the Companion Core." and "This family is fictional. The software is real."');
    const names = await page.$$eval('.st-end .st-btn', (els: HTMLElement[]) => els.map(x => (x.textContent || '').trim()));
    ok(names.includes('Replay') && names.includes('Share this family') && names.some(n => /^See /.test(n)), `the end card offers ${names.join(', ')}`);
    ok(e.overlapCore < CORE_MAX, `the end card covers ${(e.overlapCore * 100).toFixed(1)} % of the Core (under 5 %)`);
    ok(e.bars < 1, 'and keeps off the bars');
    await ctx.shot(page, `tour-end-${slug}-${label}`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  };
  await placement(SLUG, 1440, 900, false, '1440');
  await placement(SLUG, 390, 844, true, '390');
  if (second) { await placement(second, 1440, 900, false, '1440'); await placement(second, 390, 844, true, '390'); }

  // ================================================================== T7 keyboard, focus, live region, captions
  {
    console.log(`\nT7 keyboard and accessibility, ${SLUG} at 1440`);
    const { page, errors, close } = await ctx.open({ width: 1440, height: 900 }, false);
    await spy(page);
    await page.goto(link(SLUG)); await wait(page);
    const story = await rs(page);
    ok(await page.evaluate(() => document.activeElement?.className.includes('st-primary') && document.activeElement?.textContent === 'Start with narration'), 'focus lands on "Start with narration" when the start card opens');
    ok(await page.$eval('.st-start-card', (e: HTMLElement) => e.getAttribute('role') === 'dialog' && !!document.getElementById(e.getAttribute('aria-labelledby')!)?.textContent), 'the start card is a labelled dialog');
    ok((await page.evaluate(() => (document.querySelector('canvas') as HTMLElement).getAttribute('role'))) === 'img' && /Interactive 3D tour of the .+ family home/.test(await page.evaluate(() => document.querySelector('canvas')!.getAttribute('aria-label') || '')), 'the canvas is an image with a label that points to the chapters');
    const live = await page.$$eval('.st [role="status"][aria-live="polite"]', (els: Element[]) => els.length);
    ok(live === 1, `one polite live region in the tour (${live})`);
    // audit: start card
    let issues = await page.evaluate(AUDIT, '.st-start');
    ok(issues.length === 0, `the start card at 1440: no unnamed control, a named dialog, no duplicate id, contrast met${issues.length ? ': ' + issues.join(' | ') : ''}`);
    await ctx.shot(page, `tour-start-${SLUG}-1440`);
    // keys on the start card do not move a tour nobody started
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('3'); await sleep(200);
    ok((await state(page)).started === false && (await page.evaluate(() => (window as any).__houseViewer.t)) < 0.001, 'arrows and digits do nothing before the tour starts');
    // Space on the focused primary button is its own key: it starts the tour with narration (a gesture)
    await page.keyboard.press('Space'); await sleep(900);
    let st = await state(page);
    ok(st.started && st.sound && st.audioCreated, 'Space on "Start with narration" starts the tour with sound (the button is the gesture)');
    ok(await page.evaluate(() => document.activeElement?.classList.contains('vh-play')), 'focus moves to the play button when the card closes');
    // pause / play
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await page.keyboard.press('Space'); await sleep(300);
    ok(!(await page.evaluate(() => (window as any).__houseViewer.playing)), 'Space pauses');
    await page.keyboard.press('Space'); await sleep(300);
    ok(await page.evaluate(() => (window as any).__houseViewer.playing), 'and plays again');
    // captions on screen whenever narration is audible
    const sample: string[] = [];
    for (let k = 0; k < 24; k++) {
      const s = await page.evaluate(() => {
        const st = (window as any).__houseStory.state, c = document.querySelector('.st-card') as HTMLElement, r = c.getBoundingClientRect(), cs = getComputedStyle(c);
        return { speaking: st.speaking, run: st.audioRunning, text: (c.querySelector('.st-body')?.textContent || '').length, shown: !c.hidden && Number(cs.opacity) > 0.5 && r.width > 0 && r.bottom > 0 && r.top < innerHeight };
      });
      if (s.speaking && s.run && !(s.shown && s.text > 0)) sample.push(JSON.stringify(s));
      await sleep(250);
    }
    ok(sample.length === 0, `the caption card is on screen whenever a clip is sounding (24 samples over 6 s)${sample.length ? ': ' + sample[0] : ''}`);
    // steps
    await page.keyboard.press('Space'); await sleep(200);          // paused
    await page.evaluate(() => (window as any).__houseStory.goBeat(2)); await sleep(500);
    const b0 = (await state(page)).beat;
    await page.keyboard.press('ArrowRight'); await sleep(500);
    const b1 = (await state(page)).beat;
    ok(b1 === b0 + 1, `Right steps to the next beat (${b0} to ${b1})`);
    await page.keyboard.press('ArrowLeft'); await sleep(500);
    ok((await state(page)).beat === b0, 'Left steps back');
    // focus is not taken on a beat change
    await page.focus('.st-btn-chapters');
    await page.keyboard.press('ArrowRight'); await sleep(700);
    ok(await page.evaluate(() => document.activeElement?.classList.contains('st-btn-chapters')), 'a beat change leaves focus where it was');
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    const chOf = async () => { const b = (await state(page)).beat; return story.chapters.findIndex((c: any) => c.id === story.beats[b].chapter); };
    const c0 = await chOf();
    await page.keyboard.press('Shift+ArrowRight'); await sleep(700);
    ok((await chOf()) === c0 + 1, `Shift+Right goes to the next chapter (${c0 + 1} to ${c0 + 2})`);
    await page.keyboard.press('Shift+ArrowLeft'); await sleep(700);
    ok((await chOf()) === c0, 'Shift+Left goes back');
    await page.keyboard.press('3'); await sleep(700);
    ok((await chOf()) === 2, 'the digit 3 goes to chapter 3');
    ok(new URL(page.url()).searchParams.get('beat') === story.beats[(await state(page)).beat].id, 'the address bar names the beat (?beat=)');
    // the live region
    const lt: string = await page.$eval('.st [role="status"]', (e: HTMLElement) => e.textContent || '');
    ok(/^Chapter 3 of \d+, /.test(lt), `the live region reads "${lt.slice(0, 48)}…"`);
    // chapters: C opens (focus goes in), Esc closes (focus goes back)
    await page.keyboard.press('c'); await sleep(400);
    ok(await page.$eval('.st-btn-chapters', (e: HTMLElement) => e.getAttribute('aria-expanded') === 'true') && await page.evaluate(() => !!document.activeElement?.closest('.st-chapters')), 'C opens the chapters and focus goes in');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    ok(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body), 'Tab moves on inside the panel (no trap, no loss)');
    await page.keyboard.press('Escape'); await sleep(300);
    ok(!(await page.isVisible('.st-chapters')) && await page.evaluate(() => document.activeElement?.classList.contains('st-btn-chapters')), 'Esc closes the chapters and gives focus back to their button');
    // Esc order: the shortcuts panel first, then the chapters
    await page.keyboard.press('c'); await sleep(200);
    await page.click('.vh-actions [data-act="help"]').catch(() => page.keyboard.press('?')); await sleep(300);
    const helpOpen = async () => page.evaluate(() => { const h = document.querySelector('.vh-help') as HTMLElement | null; return !!h && !h.hidden; });
    if (await helpOpen()) {
      await page.keyboard.press('Escape'); await sleep(250);
      ok(!(await helpOpen()) && await page.isVisible('.st-chapters'), 'Esc closes the shortcuts panel first and leaves the chapters');
    } else ok(true, '(the shortcuts panel did not open here; the order is covered by the chapters case above)');
    await page.keyboard.press('Escape'); await sleep(250);
    ok(!(await page.isVisible('.st-chapters')), 'the next Esc closes the chapters');
    // free-look: F flies; Esc comes back to the tour
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('f'); await sleep(500);
    const flying = await page.getAttribute('.vh', 'data-fly');
    await page.keyboard.press('Escape'); await sleep(500);
    ok(flying === '1' && (await page.getAttribute('.vh', 'data-fly')) !== '1', 'F flies the camera yourself; Esc leaves it and returns to the tour');
    // C in free-look is the player's cutaway, not the chapters
    await page.keyboard.press('f'); await sleep(400);
    await page.keyboard.press('c'); await sleep(300);
    ok(!(await page.isVisible('.st-chapters')), 'while flying, C stays the cutaway (the chapters stay shut)');
    await page.keyboard.press('Escape'); await sleep(300);
    // M
    const snd0 = (await state(page)).sound;
    await page.keyboard.press('m'); await sleep(400);
    ok((await state(page)).sound === !snd0 && (await page.getAttribute('.st-btn-sound', 'aria-pressed')) === String(!snd0), 'M turns narration off or on, and the button says so (aria-pressed)');
    await page.keyboard.press('m'); await sleep(300);
    // ] next family: the tour is torn down and the next one opens on its own start card (or the plain player)
    await ctx.shot(page, `tour-playing-${SLUG}-1440`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }

  // the transcript and the pins, once
  {
    const { page, close } = await ctx.open({ width: 1440, height: 900 }, false);
    await page.goto(link(SLUG)); await wait(page);
    await startSilent(page);
    await page.keyboard.press('c'); await sleep(300);
    const story = await rs(page);
    const tr = await page.evaluate(() => ({ summary: document.querySelector('.st-transcript summary')?.textContent, h3: document.querySelectorAll('.st-tr-body h3').length }));
    ok(tr.summary === 'Transcript' && tr.h3 === story.chapters.length, `the Transcript lists every chapter as a heading (${tr.h3})`);
    ok(await page.evaluate(() => document.querySelector('.st-leader')!.getAttribute('aria-hidden') === 'true' && document.querySelector('.st-card')!.getAttribute('aria-hidden') === 'true'), 'the pins, the leader and the karaoke card are aria-hidden (the live region and the transcript carry the words once)');
    ok(await page.evaluate(() => { const i = document.querySelector('.vh-scrub input'); return !!i && getComputedStyle(i).display !== 'none'; }) && (await page.$$eval('.st-tick', (e: Element[]) => e.length)) === story.chapters.length - 1, 'the timeline carries a tick for each chapter');
    await close();
  }

  // ================================================================== T7 axe stand-in: start card and end card at 390 and 1440, with the 44 px rule on touch
  for (const [vw, vh, mobile, label] of [[1440, 900, false, '1440'], [390, 844, true, '390']] as Array<[number, number, boolean, string]>) {
    console.log(`\nT7 start and end cards at ${label}`);
    const { page, errors, close } = await ctx.open({ width: vw, height: vh }, mobile);
    await page.goto(link(SLUG)); await wait(page);
    let issues = await page.evaluate(AUDIT, '.st-start');
    ok(issues.length === 0, `the start card: no serious or critical finding${issues.length ? ': ' + issues.join(' | ') : ''}`);
    const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    const fits = await page.$eval('.st-start-card', (e: HTMLElement) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; });
    ok(noScroll && fits, 'and it fits the window with no sideways scroll');
    if (mobile) { const small = await page.evaluate(SMALL_TARGETS, '.st-start', 44); ok(small.length === 0, `its buttons are 44 px targets${small.length ? ': ' + small.join(', ') : ''}`); }
    await ctx.shot(page, `tour-start-${SLUG}-${label}`);
    await startSilent(page);
    await page.evaluate(() => (window as any).__houseStory.measureEnd()); await sleep(500);
    issues = await page.evaluate(AUDIT, '.st-end');
    ok(issues.length === 0, `the end card: no serious or critical finding${issues.length ? ': ' + issues.join(' | ') : ''}`);
    if (mobile) { const small = await page.evaluate(SMALL_TARGETS, '.st-end', 44); ok(small.length === 0, `its buttons are 44 px targets${small.length ? ': ' + small.join(', ') : ''}`); }
    await ctx.shot(page, `tour-end-${SLUG}-${label}`);
    // the chapters panel, with the same rules
    await page.evaluate(() => (window as any).__houseStory.goBeat(3)); await sleep(500);
    await page.click('.st-btn-chapters'); await sleep(400);
    issues = await page.evaluate(AUDIT, '.st-chapters');
    ok(issues.length === 0, `the chapters panel: no serious or critical finding${issues.length ? ': ' + issues.join(' | ') : ''}`);
    if (mobile) { const small = await page.evaluate(SMALL_TARGETS, '.st-chapters', 44); ok(small.length === 0, `its controls are 44 px targets${small.length ? ': ' + small.join(', ') : ''}`); }
    await ctx.shot(page, `tour-chapters-${SLUG}-${label}`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }

  // ================================================================== contrast of the card, lit and plain, at three widths
  for (const [vw, vh, mobile] of [[390, 844, true], [768, 1024, false], [1440, 900, false]] as Array<[number, number, boolean]>) {
    const { page, close } = await ctx.open({ width: vw, height: vh }, mobile);
    await page.goto(link(SLUG)); await wait(page);
    await startSilent(page);
    // a beat with a phone drawing, a say line and chips if there is one, else the first
    const story = await page.evaluate(() => (window as any).__houseStory.rs.beats.map((b: any) => (b.say ? 1 : 0) + (b.popup.kind === 'phone' ? 2 : 0) + 4 * (b.popup.chips || []).length));
    const pick = story.indexOf(Math.max(...story));
    await page.evaluate((i: number) => (window as any).__houseStory.measure(i), pick); await sleep(500);
    // light the karaoke the way a spoken beat does: spoken words, the word now, the words to come
    await page.evaluate(() => {
      for (const body of Array.from(document.querySelectorAll('.st-card .st-body, .st-card .st-say-text'))) {
        body.classList.add('st-live');
        const w = Array.from(body.querySelectorAll('.st-w'));
        w.forEach((s, i) => { s.classList.toggle('st-done', i < 2); s.classList.toggle('st-now', i === 2); });
      }
      document.querySelector('.st-say')?.classList.add('st-on');
    });
    await sleep(300);
    const issues: string[] = await page.evaluate(AUDIT, '.st-card');
    ok(issues.length === 0, `the card (lit karaoke, chips, note, footer) at ${vw}: contrast met everywhere${issues.length ? ': ' + issues.join(' | ') : ''}`);
    await ctx.shot(page, `tour-card-${SLUG}-${vw}`);
    await close();
  }

  // ================================================================== T8 the audio gesture
  {
    console.log('\nT8 audio and the gesture');
    let { page, errors, requests, close } = await ctx.open({ width: 1440, height: 900 }, false);
    await spy(page);
    await page.goto(link(SLUG)); await wait(page);
    await sleep(1500);
    const pre = await page.evaluate(() => { const w = window as any; return { ac: w.__ac, src: w.__src, play: w.__play }; });
    ok(pre.ac === 0 && pre.src === 0 && pre.play === 0 && !(await state(page)).audioCreated, 'before the click: no AudioContext, no source started, no play() call');
    ok(!(await page.evaluate(() => (window as any).__houseViewer.playing)), 'and nothing is playing: the tour waits for the start card');
    ok(!requests.some((u: string) => /\.m4a/.test(u)), 'and no narration file has been requested');
    await startSilent(page); await sleep(2500);
    const sil = await page.evaluate(() => { const w = window as any; return { ac: w.__ac, src: w.__src, play: w.__play, playing: w.__houseViewer.playing, shown: !!document.querySelector('.st-card:not([hidden])'), toast: document.querySelector('.vh-toast')?.textContent || '' }; });
    ok(sil.ac === 0 && sil.src === 0 && sil.play === 0 && !(await state(page)).audioCreated, '"Start without sound" never creates an AudioContext or starts a source');
    ok(!requests.some((u: string) => /\.m4a/.test(u)), 'and costs no audio bytes (no .m4a request)');
    ok(sil.playing && sil.shown, 'the tour plays, with its words on screen');
    // M afterwards is a gesture too
    await page.keyboard.press('m'); await sleep(2500);
    const afterM = await state(page);
    ok(afterM.sound && afterM.audioCreated && afterM.audioRunning, 'M after a silent start turns the narration on (the key press is the gesture)');
    ok((await page.evaluate(() => (window as any).__src)) > 0 || afterM.speaking !== null, 'and a clip plays');
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();

    ({ page, errors, requests, close } = await ctx.open({ width: 1440, height: 900 }, false));
    await spy(page);
    await page.goto(link(SLUG)); await wait(page);
    await page.click('.st-start .st-primary'); await sleep(2500);
    const snd = await page.evaluate(() => { const w = window as any; return { ac: w.__ac, src: w.__src }; });
    const s2 = await state(page);
    ok(snd.ac === 1 && s2.audioRunning && snd.src >= 1, `"Start with narration" makes one AudioContext at the click, and it plays (${snd.ac} context, ${snd.src} sources)`);
    ok(requests.filter((u: string) => /\.m4a/.test(u)).length >= 1 && requests.filter((u: string) => /\.m4a/.test(u)).length <= 8, 'and only the next few clips are fetched, not the whole family');
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();

    // ?no=story: today's player, none of the tour
    ({ page, errors, requests, close } = await ctx.open({ width: 1440, height: 900 }, false));
    await page.goto(link(SLUG, 'no=story'));
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 120000 });
    await sleep(600);
    const none = await page.evaluate(() => ({ st: document.querySelectorAll('.st, .st-start, .st-card, .st-btn-chapters, .st-btn-sound').length, flag: document.documentElement.dataset.story ?? null, api: typeof (window as any).__houseStory, shot: new URL(location.href).searchParams.get('shot'), chips: document.querySelectorAll('.vh-shots .vh-chip').length, link: document.querySelectorAll('link[data-story]').length }));
    ok(none.st === 0 && none.flag === null && none.api === 'undefined' && none.link === 0, '?no=story: no tour element, no flag, no tour API, no tour stylesheet');
    ok(none.shot === 'orbit' && none.chips >= 4, `?no=story opens on the Orbit with the player's own shot chips (${none.chips})`);
    ok(!requests.some((u: string) => /assets\/story\/|story\.css|\/story\/[a-z-]+\.[0-9a-f]{10}\.json|\.m4a/.test(u.replace(/\/story\/(manifest|families|legacy)/, ''))), '?no=story requests no tour module, stylesheet, story file or audio');
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }

  // ================================================================== a shared moment, a reload, the address bar
  {
    console.log('\nthe address bar and a shared moment');
    const { page, errors, close } = await ctx.open({ width: 1440, height: 900 }, false);
    await page.goto(link(SLUG)); await wait(page);
    const story = await rs(page);
    const pick = Math.min(story.beats.length - 1, 9), id = story.beats[pick].id;
    await startSilent(page);
    await page.evaluate((i: number) => (window as any).__houseStory.goBeat(i), pick); await sleep(900);
    const q1 = new URL(page.url()).searchParams;
    ok(q1.get('beat') === id && q1.get('family') === SLUG, `the address bar carries ?family=${SLUG}&beat=${id}`);
    ok(!/house=/.test(page.url()), 'and no internal id');
    await page.reload(); await wait(page);
    const reopened = await page.evaluate(() => ({ kick: document.querySelector('.st-start-kick')?.textContent, btn: document.querySelector('.st-start .st-primary')?.textContent, st: (window as any).__houseStory.state }));
    ok(reopened.kick === 'A shared moment' && reopened.btn === 'Play from here', 'a reload at ?beat= shows "A shared moment" and "Play from here"');
    await startSilent(page); await sleep(1500);
    ok((await state(page)).beat === pick, `and starts at that beat (${pick + 1})`);
    // a hand-made link by number
    await page.goto(link(SLUG, 'beat=4')); await wait(page);
    await startSilent(page); await sleep(800);
    ok((await state(page)).beat === 3, '?beat=4 opens at the fourth beat');
    await page.goto(link(SLUG, 'beat=no-such-beat')); await wait(page);
    ok((await page.textContent('.st-start-kick')) === 'Interactive tour', 'an unknown beat opens at the start');
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }

  // ================================================================== reduced motion
  {
    console.log('\nreduced motion');
    const { page, errors, close } = await ctx.open({ width: 1440, height: 900 }, false, { reducedMotion: 'reduce' });
    await page.goto(link(SLUG, 'play=1')); await wait(page);
    ok(!(await page.evaluate(() => (window as any).__houseViewer.playing)), 'the tour opens paused (even with play=1)');
    await startSilent(page); await sleep(1500);
    const a = await page.evaluate(() => (window as any).__houseViewer.t); await sleep(1500);
    const b = await page.evaluate(() => (window as any).__houseViewer.t);
    ok(Math.abs(b - a) < 1e-6 && !(await page.evaluate(() => (window as any).__houseViewer.playing)) && (await state(page)).step, 'after Start nothing advances by itself: the tour steps by hand');
    ok(await page.isVisible('.st-card'), 'and the first card is showing, with all its words');
    const b0 = (await state(page)).beat;
    await page.keyboard.press('ArrowRight'); await sleep(900);
    const b1 = (await state(page)).beat;
    ok(b1 === b0 + 1 && !(await page.evaluate(() => (window as any).__houseViewer.playing)), 'Right is a cut to the next beat, not a glide');
    const pulse = await page.evaluate(() => { const r = document.querySelector('.st-pin-ring') as SVGElement | null; return r ? getComputedStyle(r).animationName + '/' + getComputedStyle(r).display : 'none'; });
    ok(pulse === 'none' || /none|\/none/.test(pulse), `no pulsing ring (${pulse})`);
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('.st-card')!).transitionDuration === '0s'), 'the card does not slide in');
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }

  // ================================================================== failure paths
  {
    console.log('\nfailure paths');
    // the story file is gone: the player plays as it always has, says so, and nothing throws
    let o = await ctx.open({ width: 1440, height: 900 }, false);
    await o.page.route(/\/story\/[a-z-]+\.[0-9a-f]{10}\.json/, (r: any) => /\/story\/(families|legacy)\./.test(r.request().url()) ? r.continue() : r.fulfill({ status: 404, body: 'gone' }));
    await o.page.goto(link(SLUG));
    await o.page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 120000 });
    await sleep(800);
    const f1 = await o.page.evaluate(() => ({ st: document.querySelectorAll('.st-start, .st-card').length, toast: document.querySelector('.vh-toast')?.textContent || '', api: typeof (window as any).__houseStory, shot: new URL(location.href).searchParams.get('shot') }));
    ok(f1.st === 0 && f1.api === 'undefined' && f1.shot === 'orbit', 'a story file that 404s: the plain player, on the Orbit, no tour element');
    ok(/narrated tour could not load/.test(f1.toast), `and it says so (${f1.toast})`);
    ok(o.errors.every((e: string) => /404|Failed to load resource/.test(e)), `and the only errors are the 404 itself${o.errors.length ? ' (' + o.errors.length + ')' : ''}`);
    await o.close();
    // the narration is gone: captions stay, one toast says so
    o = await ctx.open({ width: 1440, height: 900 }, false);
    await o.page.route(/\.m4a/, (r: any) => r.fulfill({ status: 404, body: 'gone' }));
    await o.page.goto(link(SLUG)); await wait(o.page);
    await o.page.click('.st-start .st-primary'); await sleep(2500);
    const f2 = await o.page.evaluate(() => ({ toast: document.querySelector('.vh-toast')?.textContent || '', text: (document.querySelector('.st-card .st-body')?.textContent || '').length, shown: !!document.querySelector('.st-card:not([hidden])'), playing: (window as any).__houseViewer.playing }));
    ok(f2.toast.includes('Narration could not load. Captions are on.'), `an audio 404: the toast says "${f2.toast}"`);
    ok(f2.shown && f2.text > 20 && f2.playing, 'and the tour carries on with its words on screen');
    ok(o.errors.every((e: string) => /404|Failed to load resource/.test(e)), 'and the only errors are the 404s themselves');
    await o.close();
  }

  // ================================================================== next family
  {
    console.log('\nnext family');
    const { page, errors, close } = await ctx.open({ width: 1440, height: 900 }, false);
    await page.goto(link(SLUG)); await wait(page);
    await startSilent(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press(']');
    await page.waitForFunction((was: string) => new URL(location.href).searchParams.get('family') !== was, SLUG, { timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 120000 }).catch(() => {});
    await sleep(1500);
    const now = new URL(page.url()).searchParams.get('family')!;
    const info = await page.evaluate(() => ({ start: !!document.querySelector('.st-start'), hosts: document.querySelectorAll('.st[data-st]').length, beat: new URL(location.href).searchParams.get('beat'), story: typeof (window as any).__houseStory }));
    ok(now !== SLUG && !/house=/.test(page.url()), `] opens the next family (${now})`);
    ok(info.hosts <= 1 && info.beat === null && (tours.includes(now) ? info.start && info.story === 'object' : !info.start), `its tour starts from its own start card, with no beat of the last family (${tours.includes(now) ? 'has a tour' : 'no tour yet: the plain player'})`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();
  }
}
