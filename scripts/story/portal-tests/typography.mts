// The type of every modal, in a browser (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test -- --only hooks` after type or card work
//
// The owner asked for modals with 36 px text and, seeing them, said that was 30 percent too big and to reference the website. The scale is the CI canon's now, rem of its org-wide
// 17 px root: reading text in a modal 1.5rem = 25.5 px at 768 px and wider, clamp(20px, 5.4vw, 25.5px) on a phone; a card's title 2.25rem, the start and end cards' heading 2.6rem
// (phones: 1.9rem and 2.1rem). A person's name is a kicker: all capitals by CSS (the text in the page and every aria-label stay as written), 0.2em of tracking, bold. This file
// walks the text of the real DOM, in Chromium, for each of them:
//
//   T13  at 1440x900, 1024x768 and 390x844 (a touch phone): every text node inside the tour's start card, three beat cards (the first, a film beat, one with "More", which is
//        opened and audited again) and the end card, and the About dialog, is at least 25 px (20 px on the phone: the token there is 21 px at 390) with the weights and the canon's
//        0.2pt tracking on what is not a name; the failure card the same; every person's name in them (the card's kicker, the start card's person buttons and its "Starting with"
//        line) is uppercase by CSS, bold, at least 0.15em of tracking, in the real name's own letters in the text and the aria-label, at the reading size; the cards are 360 to 560 px
//        wide (a quarter to a third and a bit of a wide window) and a phone's sheet is at most 55 % of the height; no card or dialog wider than the window.
//        The family page, at the same three sizes in the light and the dark set: every name (`.nm`) is uppercase, bold and tracked at least 0.15em, in contrast with its page (4.5:1),
//        the heading ones at 1.5rem or more and the nav chips and section labels at 0.85rem or more; the screenshot dialog's text is the same size as a card's, and its buttons are 44 px.
//        The player always takes the dark set (room-creator.html), so its modals are audited once.
//   T13b the glass pass (the owner's mockup, 2026-10): on the three Brennan tours at the same three sizes, the start card, the first three beat cards, one with "More" open, the end
//        card, the chapters panel, the tools sheet, the About dialog, the top bar and the dock: every border-radius is 0, 5 px or 3 px, nothing in a card is nowrap or cut with an
//        ellipsis (the top bar's title and the dock's chips are one-line controls), no text line or box leaves a card's padding box (a row that scrolls sideways by design is judged by
//        its own box), a card that is not a phone's full-width sheet is trimmed to its widest line (at most 3 px spare, never wider than `data-solved-w`), no card covers more than
//        2 % of its subject, and an open card's stuck head is opaque.
//
// It prints the type table (the tokens in px at each width) so the numbers in reference/story/player.md are the measured ones.
import type { TestCtx } from '../hooks.ts';

type Page = any;
const FLOOR = { wide: 25, phone: 20 }, NAME_TRACK = 0.15, CANON_TRACK_PX = 0.2 * 96 / 72, PHONE_SHEET_MAX = 0.55;

export default async function typography(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, url } = ctx;
  const byFamily: Record<string, any> = (ctx.manifest as any).byFamily || {};
  const slug = byFamily.brennan?.story ? 'brennan' : Object.keys(byFamily).find(s => byFamily[s].story) || '';
  console.log('\nT13 the type of every modal (the canon\'s scale: 1.5rem of the 17 px root)');
  if (!slug) { console.log('  no tour in this build: nothing to test'); return; }
  const link = (q = '') => url(`room-creator?mode=view&house=${byFamily[slug].house}&family=${slug}${q ? '&' + q : ''}`);
  const wait = async (page: Page) => {
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' && !!(window as any).__houseStory, null, { timeout: 240000 });
    await sleep(300);
  };

  // ---- in the page: the text of a surface, node by node
  const WALK = ([sel, min]: [string, number]) => {
    const roots = Array.from(document.querySelectorAll(sel));
    const bad: string[] = [];
    let nodes = 0, smallest = Infinity, rootSeen = 0;
    for (const root of roots) {
      const rr = root.getBoundingClientRect();
      if ((root as HTMLElement).closest('[hidden]') || rr.width < 1 || rr.height < 1) continue;
      rootSeen++;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!(n.textContent || '').trim()) continue;
        const e = n.parentElement; if (!e) continue;
        if (e.closest('[hidden], .st-live-region, .vh-sr, svg, script, style')) continue;
        const cs = getComputedStyle(e), r = e.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 1 || r.height < 1) continue;
        const px = parseFloat(cs.fontSize);
        nodes++; smallest = Math.min(smallest, px);
        if (px + 0.05 < min && bad.length < 8) bad.push(`${px.toFixed(2)} px "${(n.textContent || '').trim().slice(0, 30)}" in <${e.tagName.toLowerCase()} class="${e.className}">`);
      }
    }
    return { roots: rootSeen, nodes, smallest: Number.isFinite(smallest) ? smallest : 0, bad };
  };
  /** the facts of every person-name element under `sel` (the name kicker) */
  const NAMES = (sel: string) => Array.from(document.querySelectorAll(sel)).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]'); }).map(e => {
    const cs = getComputedStyle(e), px = parseFloat(cs.fontSize), ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
    return { text: (e.textContent || '').trim(), upper: cs.textTransform === 'uppercase', track: ls / px, weight: Number(cs.fontWeight), px, cls: (e as HTMLElement).className };
  });
  /** the tokens, in px, and the weights and tracking of the parts of a card */
  const PROBE = () => {
    const px = (v: string) => { const d = document.createElement('div'); d.style.cssText = `position:absolute;visibility:hidden;font-size:${v}`; document.documentElement.append(d); const n = parseFloat(getComputedStyle(d).fontSize); d.remove(); return n; };
    const one = (sel: string) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return { px: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), track: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) }; };
    return { min: px('var(--st-min)'), title: px('var(--st-title)'), hook: px('var(--st-hook)'), root: parseFloat(getComputedStyle(document.documentElement).fontSize), body: one('.st-card .st-body, .st-start-p'), titleEl: one('.st-card .st-title'), chip: one('.st-chip'), btn: one('.st-btn'), note: one('.st-note'), more: one('.st-more-btn') };
  };
  /**
   * The glass pass's checks on one surface (the owner's mockup, 2026-10), run in the page: its corners (every border-radius of it and of everything in it is 0, 5 px or 3 px: no
   * 999px pill, no 50 % circle), text that is nowrap or cut with an ellipsis, text lines and boxes that leave its padding box, and how much room is left at the right of its widest line
   * (text lines, plus the right edges of the chips, buttons, monogram and logo; the "More" toggle and a person's button on the start card sit at the far end of a row and count by
   * what they need: the kicker's edge + the gap + their own width, content + their padding). Parts that are not on screen (hidden, the screen-reader text) are not judged.
   */
  const GLASS = (sel: string) => {
    const root = document.querySelector(sel) as HTMLElement | null; if (!root) return null;
    const rr = root.getBoundingClientRect(), cs = getComputedStyle(root);
    const bl = parseFloat(cs.borderLeftWidth) || 0, br = parseFloat(cs.borderRightWidth) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const pb = { l: rr.left + bl, r: rr.left + bl + root.clientWidth };          // the padding box, less a scrollbar
    const bar = Math.max(0, rr.width - root.clientWidth - bl - br);
    const skip = (e: Element) => !!e.closest('[hidden], .vh-sr, .st-live-region, svg');
    // a row that scrolls sideways by design (the dock's chips) clips what is past its edge: its items are judged by that row's box, which is held, and not by the surface's
    const scrolledAway = (e: Element) => { for (let a = e.parentElement; a && a !== root; a = a.parentElement) { const s = getComputedStyle(a); if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
    const name = (e: Element) => `${e.tagName.toLowerCase()}.${String((e as HTMLElement).className || '').split(' ')[0]}`;
    const radii: string[] = [], nowrap: string[] = [], escapes: string[] = [];
    let n = 0, widest = 0;
    const edge = (el: Element, extra: string): number => { let m = -Infinity; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let t = w.nextNode(); t; t = w.nextNode()) { if (!(t.textContent || '').trim() || skip(t.parentElement!)) continue; const g = document.createRange(); g.selectNodeContents(t); for (const q of Array.from(g.getClientRects())) if (q.width) m = Math.max(m, q.right); } el.querySelectorAll(extra).forEach(x => { const q = x.getBoundingClientRect(); if (q.width && !skip(x)) m = Math.max(m, q.right); }); return m; };
    for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
      if (skip(el)) continue;
      const s = getComputedStyle(el), b = el.getBoundingClientRect();
      if (s.display === 'none' || s.display === 'contents' || s.visibility === 'hidden' || (b.width === 0 && b.height === 0)) continue;
      n++;
      for (const k of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'] as const) { const v = (s as any)[k] as string; if (!/^(0px|5px|3px)( (0px|5px|3px))?$/.test(v)) { radii.push(`${name(el)} ${k.replace(/^border|Radius$/g, '')} ${v}`); break; } }
      if (s.whiteSpace === 'nowrap' || s.whiteSpace === 'pre' || s.textOverflow === 'ellipsis') nowrap.push(`${name(el)} (${s.whiteSpace}, ${s.textOverflow})`);
      if (el !== root && !scrolledAway(el) && (b.right > pb.r + 0.6 || b.left < pb.l - 0.6)) escapes.push(`box ${name(el)} ${Math.round(b.left - pb.l)}..${Math.round(b.right - pb.r)}`);
      if (el.matches('.st-chip, .st-btn, .st-disc, .st-logo, .vh-help a, .vh-help kbd')) widest = Math.max(widest, b.right - rr.left);
    }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      const e = t.parentElement; if (!e || !(t.textContent || '').trim() || skip(e) || getComputedStyle(e).display === 'none') continue;
      const g = document.createRange(); g.selectNodeContents(t);
      // (a line that sits in a box with its own right padding, such as a phone drawing's panel or the agent's quoted line, needs that room too: the box is what is at the card's edge)
      let tr = 0; for (let a: Element | null = e; a && a !== root; a = a.parentElement) { const as = getComputedStyle(a); tr += (parseFloat(as.paddingRight) || 0) + (parseFloat(as.borderRightWidth) || 0) + (parseFloat(as.marginRight) || 0); }
      for (const q of Array.from(g.getClientRects())) { if (!q.width) continue; widest = Math.max(widest, q.right - rr.left + tr); if (!scrolledAway(e) && (q.right > pb.r + 0.6 || q.left < pb.l - 0.6)) escapes.push(`text "${(t.textContent || '').trim().slice(0, 20)}" ${Math.round(q.left - pb.l)}..${Math.round(q.right - pb.r)}`); }
    }
    root.querySelectorAll<HTMLElement>('.st-more-btn').forEach(mb => { if (skip(mb)) return; const head = mb.parentElement!, kick = head.querySelector('.st-kicker')!; widest = Math.max(widest, edge(kick, '.st-disc') - rr.left + (parseFloat(getComputedStyle(head).columnGap) || 0) + mb.getBoundingClientRect().width); });
    root.querySelectorAll<HTMLElement>('.st-member').forEach(m => { if (skip(m)) return; const q = getComputedStyle(m); widest = Math.max(widest, edge(m, '.st-disc') - rr.left + (parseFloat(q.paddingRight) || 0) + (parseFloat(q.borderRightWidth) || 0)); });
    const padR = pr + br + bar;
    return { n, w: rr.width, solved: root.dataset.solvedW ? Number(root.dataset.solvedW) : null, widest: Math.ceil(widest), padR, spare: Math.round(rr.width - (widest + padR)), radii: radii.slice(0, 6), nowrap: nowrap.slice(0, 6), escapes: escapes.slice(0, 6) };
  };
  const PHONE = (vw: number) => vw < 768;
  const near = (a: number, b: number, e = 0.05) => Math.abs(a - b) <= e;

  // ======================================================================== the tour, at each size
  for (const [vw, vh, mobile] of [[1440, 900, false], [1024, 768, false], [390, 844, true]] as const) {
    const label = `${vw}x${vh}`, floor = PHONE(vw) ? FLOOR.phone : FLOOR.wide;
    const { page, errors, thirdParty, close } = await ctx.open({ width: vw, height: vh }, mobile);
    await page.goto(link()); await wait(page);
    const rs = await page.evaluate(() => (window as any).__houseStory.rs.beats.map((b: any, i: number) => ({ i, id: b.id, film: !!b.film, more: !!b.detail, member: b.member || '' })));
    const t = await page.evaluate(PROBE);
    console.log(`  type at ${label}: root ${t.root} px; --st-min ${t.min.toFixed(2)} px (${(t.min / t.root).toFixed(2)}rem), --st-title ${t.title.toFixed(2)} px, --st-hook ${t.hook.toFixed(2)} px`);
    if (PHONE(vw)) ok(near(t.min, Math.max(20, Math.min(25.5, vw * 0.054)), 0.1) && near(t.title, 1.9 * t.root, 0.1) && near(t.hook, 2.1 * t.root, 0.1), `${label}: the phone tokens are clamp(20px, 5.4vw, 25.5px), 1.9rem and 2.1rem (${t.min.toFixed(2)}, ${t.title.toFixed(2)}, ${t.hook.toFixed(2)})`);
    else ok(t.root === 17 && near(t.min, 25.5) && near(t.title, 38.25) && near(t.hook, 44.2), `${label}: the tokens are 1.5rem, 2.25rem and 2.6rem of the 17 px root = 25.5, 38.25 and 44.2 px (${t.min.toFixed(2)}, ${t.title.toFixed(2)}, ${t.hook.toFixed(2)})`);

    // ---- the start card
    let w = await page.evaluate(WALK, ['.st-start-card', floor] as [string, number]);
    ok(w.roots === 1 && w.nodes > 12 && w.bad.length === 0, `${label}: the start card's ${w.nodes} text nodes are all at least ${floor} px (smallest ${w.smallest.toFixed(2)})${w.bad[0] ? ': ' + w.bad.join(' | ') : ''}`);
    let names = await page.evaluate(NAMES, '.st-start-kick, .st-member-name');
    ok(names.length >= 2 && names.every((n: any) => n.upper && n.track >= NAME_TRACK && n.weight >= 700 && n.px + 0.05 >= floor), `${label}: the start card's ${names.length} names and its kicker line are uppercase by CSS, bold, tracked ${names.map((n: any) => n.track.toFixed(2)).join('/')}em, at the reading size`);
    const people = await page.evaluate(() => Array.from(document.querySelectorAll('.st-member')).map(b => ({ label: b.getAttribute('aria-label') || '', name: (b.querySelector('.st-member-name') || { textContent: '' }).textContent || '', h: b.getBoundingClientRect().height })));
    ok(people.length > 0 && people.every((p: any) => p.label.startsWith(`Start with ${p.name}`) && p.name !== p.name.toUpperCase() && p.h >= 43.5), `${label}: each person button keeps the real name in its text and its label ("${people[0]?.label}") and is 44 px or more`);
    const tb = await page.evaluate(PROBE);
    ok(tb.btn && tb.btn.px + 0.05 >= floor && near(tb.btn.track, CANON_TRACK_PX, 0.03) && (tb.btn.weight === 500 || tb.btn.weight === 600) && tb.body && tb.body.weight === 400 && near(tb.body.track, CANON_TRACK_PX, 0.03), `${label}: the canon's weights (400 body, 500 or 600 buttons) and its 0.2pt tracking on what is not a name (${tb.body && tb.body.track.toFixed(3)} px)`);
    ok(await page.evaluate(() => { const c = document.querySelector('.st-start-card')!.getBoundingClientRect(), v = document.documentElement.clientWidth; return c.width <= v + 0.5 && document.documentElement.scrollWidth <= v + 1; }), `${label}: the start card fits the window's width`);
    await ctx.shot(page, `type-${label}-start`);

    // ---- the beat cards: the first, a film beat, one with "More" (opened and audited again), and the last
    await page.locator('.st-start .st-actions .st-btn').last().click(); await sleep(500);
    const pick = new Set<number>([0]);
    const film = rs.find((b: any) => b.film), more = rs.find((b: any) => b.more && b.member) || rs.find((b: any) => b.more);
    if (film) pick.add(film.i);
    if (more) pick.add(more.i);
    pick.add(rs.length - 1);
    for (const i of pick) {
      const m = await page.evaluate((i: number) => (window as any).__houseStory.measure(i), i);
      await sleep(450);
      const b = rs[i], tag = `${label} beat ${i} (${b.id}${b.film ? ', a film beat' : ''})`;
      w = await page.evaluate(WALK, ['.st-card', floor] as [string, number]);
      ok(w.roots === 1 && w.nodes >= 3 && w.bad.length === 0, `${tag}: the card's ${w.nodes} text nodes are all at least ${floor} px (smallest ${w.smallest.toFixed(2)})${w.bad[0] ? ': ' + w.bad.join(' | ') : ''}`);
      names = await page.evaluate(NAMES, '.st-card .st-who');
      ok(names.length === 1 && names[0].upper && names[0].track >= NAME_TRACK && names[0].weight >= 700 && names[0].px + 0.05 >= floor, `${tag}: the card's kicker "${names[0] && names[0].text}" is uppercase by CSS, bold, tracked ${names[0] && names[0].track.toFixed(2)}em`);
      if (b.member) {
        const real = await page.evaluate(() => { const e = document.querySelector('.st-card .st-who'); return e ? e.textContent || '' : ''; });
        ok(real !== real.toUpperCase(), `${tag}: the name is in the page as written ("${real}"), the capitals are CSS`);
      }
      if (PHONE(vw) || vw < 1000 && vh > vw) ok(m.mode === 'sheet' && m.card.h <= vh * PHONE_SHEET_MAX + 1 && m.card.w <= vw, `${tag}: a sheet of at most 55 % of the height (${(m.card.h / vh * 100).toFixed(0)} %)`);
      else {
        // the solver's width is the clamp(420px, 32vw, 560px) or a narrower one (360 to 560 px); the card as drawn is trimmed to its widest line plus its padding (glass pass: the
        // container fits the text), so it is never wider than the width the solver chose, and never narrower than its widest line and padding (the solved width is `m.solvedW`)
        const g = await page.evaluate(GLASS, '.st-card');
        ok(m.mode === 'card' && m.solvedW >= 359 && m.solvedW <= 561 && m.card.w <= m.solvedW + 0.5 && g && g.spare >= -0.5 && m.card.w <= vw * 0.46 + 1 && m.card.x >= -0.5 && m.card.x + m.card.w <= vw + 0.5, `${tag}: a card of ${Math.round(m.card.w)} px (${(m.card.w / vw * 100).toFixed(0)} % of the window), the solver's ${m.solvedW} px trimmed to its widest line and padding (${g && Math.round(g.widest + g.padR)} px at least; the wanted clamp(420px, 32vw, 560px), or a narrower one)`);
      }
      if (i === 0) { const tc = await page.evaluate(PROBE); if (tc.titleEl) ok(near(tc.titleEl.px, t.title, 0.1) && tc.titleEl.weight === 700, `${label}: a card's title is --st-title (${tc.titleEl.px.toFixed(2)} px) in the canon's 700`); }
      if (more && i === more.i) {
        await ctx.shot(page, `type-${label}-beat-closed`);
        await page.evaluate(() => (window as any).__houseStory.setMore(true)); await sleep(450);
        w = await page.evaluate(WALK, ['.st-card', floor] as [string, number]);
        const open = await page.evaluate(() => { const p = document.querySelector('.st-more') as HTMLElement | null; return !!p && !p.hidden; });
        ok(open && w.bad.length === 0, `${tag}: with "More" open the card's ${w.nodes} text nodes are all at least ${floor} px (smallest ${w.smallest.toFixed(2)})${w.bad[0] ? ': ' + w.bad.join(' | ') : ''}`);
        await ctx.shot(page, `type-${label}-beat-more`);
        await page.evaluate(() => (window as any).__houseStory.setMore(false)); await sleep(300);
      } else if (i === 0 || film && i === film.i) await ctx.shot(page, `type-${label}-beat-${i}`);
    }

    // ---- the end card
    const e = await page.evaluate(() => (window as any).__houseStory.measureEnd()); await sleep(500);
    w = await page.evaluate(WALK, ['.st-end', floor] as [string, number]);
    ok(w.roots === 1 && w.nodes >= 6 && w.bad.length === 0, `${label}: the end card's ${w.nodes} text nodes are all at least ${floor} px (smallest ${w.smallest.toFixed(2)})${w.bad[0] ? ': ' + w.bad.join(' | ') : ''}`);
    ok(e.card.x >= -0.5 && e.card.x + e.card.w <= vw + 0.5 && e.card.y >= -0.5 && e.card.y + e.card.h <= vh + 0.5 && e.overlapCore < 0.05, `${label}: the end card is inside the window and covers ${(e.overlapCore * 100).toFixed(1)} % of the Core`);
    await ctx.shot(page, `type-${label}-end`);

    // ---- the chapters panel open over a beat's card (verify pass): a wide window puts the card beside the drawer and never off the window (it was put under the drawer, at
    //      y = 804 of 900, when the drawer counted as the top of the room); from 768 to 1099 px the panel is a wide sheet and takes the card's place, as it does on a phone
    if (!mobile) {
      await page.evaluate(() => (window as any).__houseStory.goBeat(1)); await sleep(900);
      await page.keyboard.press('c'); await sleep(1000);
      const cp = await page.evaluate(() => {
        const c = document.querySelector('.st-card') as HTMLElement, r = c.getBoundingClientRect(), d = document.querySelector('.st-chapters') as HTMLElement | null, dr = d ? d.getBoundingClientRect() : null;
        const ox = dr ? Math.max(0, Math.min(r.right, dr.right) - Math.max(r.left, dr.left)) : 0, oy = dr ? Math.max(0, Math.min(r.bottom, dr.bottom) - Math.max(r.top, dr.top)) : 0;
        return { open: !!d, hidden: getComputedStyle(c).visibility === 'hidden', top: r.top, bottom: r.bottom, left: r.left, right: r.right, overlap: ox * oy };
      });
      ok(cp.open && (vw < 1100 ? cp.hidden : (cp.top >= -0.5 && cp.bottom <= vh + 0.5 && cp.left >= -0.5 && cp.right <= vw + 0.5 && cp.overlap < 1)), `${label}: with the chapters panel open the card ${vw < 1100 ? 'gives way to the sheet (hidden)' : `is inside the window (${Math.round(cp.top)} to ${Math.round(cp.bottom)} of ${vh}) and keeps off the drawer`}`);
      await page.keyboard.press('Escape'); await sleep(400);
    }

    // ---- the About dialog (and the keys): opened the way a person does
    await page.evaluate(() => (window as any).__houseStory.goBeat(0)); await sleep(400);
    if (mobile) { await page.tap('[data-act="more"]'); await sleep(300); await page.tap('.vh-tools [data-act="help"]'); } else await page.click('[data-act="help"]');
    await sleep(500);
    w = await page.evaluate(WALK, ['.vh-help', floor] as [string, number]);
    ok(w.roots === 1 && w.nodes >= 5 && w.bad.length === 0, `${label}: the About dialog's ${w.nodes} text nodes are all at least ${floor} px (smallest ${w.smallest.toFixed(2)})${w.bad[0] ? ': ' + w.bad.join(' | ') : ''}`);
    ok(await page.evaluate(() => { const r = document.querySelector('.vh-help')!.getBoundingClientRect(), v = document.documentElement.clientWidth; return r.left >= -0.5 && r.right <= v + 0.5; }), `${label}: the About dialog fits the window's width`);
    await ctx.shot(page, `type-${label}-about`);
    ok(errors.length === 0 && thirdParty.length === 0, `${label}: no console error, nothing from a third party${errors[0] ? ': ' + errors[0] : ''}`);
    await close();
  }

  // ======================================================================== the failure card (no WebGL 2): the same scale
  for (const [vw, vh, mobile] of [[1440, 900, false], [390, 844, true]] as const) {
    const label = `${vw}x${vh}`, floor = PHONE(vw) ? FLOOR.phone : FLOOR.wide;
    const { page, close } = await ctx.open({ width: vw, height: vh }, mobile);
    await page.addInitScript(() => {
      const g = HTMLCanvasElement.prototype.getContext;
      (HTMLCanvasElement.prototype as any).getContext = function (t: string, ...a: any[]) { return t === 'webgl2' ? null : (g as any).call(this, t, ...a); };
    });
    await page.goto(link()); await page.waitForSelector('.vh-fail', { timeout: 30000 }); await sleep(300);
    const w = await page.evaluate(WALK, ['.vh-fail', floor] as [string, number]);
    const btns = await page.evaluate(() => Array.from(document.querySelectorAll('.vh-fail-actions > *')).map(b => b.getBoundingClientRect().height));
    ok(w.roots === 1 && w.nodes >= 3 && w.bad.length === 0 && btns.length >= 2 && btns.every((h: number) => h >= 43.5), `${label}: the failure card's ${w.nodes} text nodes are all at least ${floor} px (smallest ${w.smallest.toFixed(2)}) and its ${btns.length} buttons are 44 px${w.bad[0] ? ': ' + w.bad.join(' | ') : ''}`);
    await ctx.shot(page, `type-${label}-failure`);
    await close();
  }

  // ======================================================================== the glass pass (the owner's mockup, 2026-10): corners, words inside their box, a box that fits its words
  //   On the three Brennan tours at 1440, 1024 and 390, on the start card, the first three beats' cards (and one with "More" open), the end card, the chapters panel, the About
  //   dialog, the tools sheet and the top bar and dock: every border-radius is 0, 5 px or 3 px (no 999px, no 50 %: the scrubber's thumb is a pseudo-element and the pin an SVG circle,
  //   neither is a box), nothing in a card is nowrap or cut with an ellipsis, no text line or box leaves its card's padding box, and a card that is not a phone's full-width sheet is
  //   trimmed to its widest line (at most 3 px spare at the right of it) and never wider than the solver's width (`data-solved-w`), and no card covers its beat's subject.
  console.log('\nT13b the glass: corners, words inside their box, a box that fits its words');
  const brennans = ['brennan', 'brennan-hollin', 'brennan-merrow'].filter(s => byFamily[s]?.story);
  for (const fam of brennans) {
    for (const [vw, vh, mobile] of [[1440, 900, false], [1024, 768, false], [390, 844, true]] as const) {
      const label = `${fam} ${vw}x${vh}`, sheet = PHONE(vw) || (vw < 1000 && vh > vw);
      const { page, errors, close } = await ctx.open({ width: vw, height: vh }, mobile);
      await page.goto(url(`room-creator?mode=view&house=${byFamily[fam].house}&family=${fam}`)); await wait(page);
      const bad = (g: any, oneLine = false) => g ? [...g.radii.map((x: string) => 'radius ' + x), ...(oneLine ? [] : g.nowrap).map((x: string) => 'nowrap ' + x), ...g.escapes.map((x: string) => 'escape ' + x)] : ['not on screen'];
      // (`oneLine`: the top bar's title and the dock's scrolling chips are controls, not reading text: they keep their one line and their ellipsis; their corners and their box are still held)
      const clean = (g: any, what: string, oneLine = false) => ok(!!g && bad(g, oneLine).length === 0, `${label}: ${what}: only 5 px and 3 px corners, ${oneLine ? 'one-line controls allowed' : 'nothing nowrap or ellipsised'}, nothing past its padding box (${g ? g.n : 0} elements)${bad(g, oneLine)[0] ? ': ' + bad(g, oneLine).slice(0, 3).join(' | ') : ''}`);
      const fits = (g: any, what: string) => ok(!!g && g.spare >= -0.5 && g.spare <= 3 && (g.solved === null || g.w <= g.solved + 0.5), `${label}: ${what} fits its text: ${g && g.spare} px spare at the right of its widest line (${g && Math.round(g.w)} px of at most ${g && g.solved})`);
      // the start card, the top bar and the dock
      clean(await page.evaluate(GLASS, '.st-start-card'), 'the start card');
      fits(await page.evaluate(GLASS, '.st-start-card'), 'the start card');
      clean(await page.evaluate(GLASS, '.vh-top'), 'the top bar', true);
      clean(await page.evaluate(GLASS, '.vh-dock'), 'the dock', true);
      await page.locator('.st-start .st-actions .st-btn').last().click(); await sleep(500);
      // the first three beats, then the first with "More" (opened)
      const beats = await page.evaluate(() => (window as any).__houseStory.rs.beats.map((b: any, i: number) => ({ i, id: b.id, more: !!b.detail })));
      for (const i of [0, 1, 2]) {
        const m = await page.evaluate((k: number) => (window as any).__houseStory.measure(k), i); await sleep(450);
        const g = await page.evaluate(GLASS, '.st-card');
        clean(g, `beat ${i} (${beats[i].id}) card`);
        if (sheet) ok(m.mode === 'sheet' && Math.abs(m.card.w - (vw - 16)) <= 1, `${label}: beat ${i}'s sheet is full width (${Math.round(m.card.w)} of ${vw - 16} px)`);
        else fits(g, `beat ${i}'s card`);
        ok(m.overlapLive <= 0.02 && m.planned && m.planned.ok !== false, `${label}: beat ${i}'s card covers ${(m.overlapLive * 100).toFixed(2)} % of its subject (at most 2 %)`);
        if (i === 0) await ctx.shot(page, `glass-${fam}-${vw}-beat-0`);
      }
      const more = beats.find((b: any) => b.more);
      if (more) {
        await page.evaluate((k: number) => (window as any).__houseStory.measure(k), more.i); await sleep(350);
        await page.evaluate(() => (window as any).__houseStory.setMore(true)); await sleep(450);
        const m = await page.evaluate((k: number) => (window as any).__houseStory.measure(k), more.i); await sleep(250);
        clean(await page.evaluate(GLASS, '.st-card'), `beat ${more.i} (${more.id}) card with More open`);
        ok(m.overlapLive <= 0.02, `${label}: with More open the card covers ${(m.overlapLive * 100).toFixed(2)} % of its subject (at most 2 %)`);
        // (a card that scrolls: the head stuck at its top is an opaque light surface, so words that scroll under it are hidden)
        const head = await page.evaluate(() => { const h = document.querySelector('.st-card.st-open .st-head') as HTMLElement | null; if (!h) return null; const c = getComputedStyle(h).backgroundColor.match(/[\d.]+/g)!.map(Number); return { a: c[3] === undefined ? 1 : c[3], pos: getComputedStyle(h).position }; });
        ok(!!head && head.a === 1 && head.pos === 'sticky', `${label}: the open card's head is sticky and opaque (alpha ${head && head.a})`);
        await ctx.shot(page, `glass-${fam}-${vw}-more`);
        await page.evaluate(() => (window as any).__houseStory.setMore(false)); await sleep(300);
      }
      // the end card
      const e = await page.evaluate(() => (window as any).__houseStory.measureEnd()); await sleep(500);
      clean(await page.evaluate(GLASS, '.st-end'), 'the end card');
      if (sheet) ok(Math.abs(e.card.w - (vw - 16)) <= 1, `${label}: the end card's sheet is full width (${Math.round(e.card.w)} of ${vw - 16} px)`);
      else fits(await page.evaluate(GLASS, '.st-end'), 'the end card');
      ok(e.overlapCore < 0.05, `${label}: the end card covers ${(e.overlapCore * 100).toFixed(1)} % of the Core`);
      await ctx.shot(page, `glass-${fam}-${vw}-end`);
      // the chapters panel (a window wide enough to show a card beside it, and the sheet on a phone: both are the glass)
      await page.evaluate(() => (window as any).__houseStory.goBeat(1)); await sleep(700);
      await page.keyboard.press('c'); await sleep(900);
      clean(await page.evaluate(GLASS, '.st-chapters'), 'the chapters panel');
      await ctx.shot(page, `glass-${fam}-${vw}-chapters`);
      await page.keyboard.press('Escape'); await sleep(400);
      // the tools sheet (the compact layout) and the About dialog
      if (await page.isVisible('[data-act="more"]')) {
        await page.click('[data-act="more"]'); await sleep(400);
        clean(await page.evaluate(GLASS, '.vh-tools'), 'the tools sheet', true);
        await page.click('.vh-tools [data-act="help"]');
      } else await page.click('[data-act="help"]');
      await sleep(500);
      clean(await page.evaluate(GLASS, '.vh-help'), 'the About dialog');
      await ctx.shot(page, `glass-${fam}-${vw}-about`);
      ok(errors.length === 0, `${label}: no console error${errors[0] ? ': ' + errors[0] : ''}`);
      await close();
    }
  }

  // ======================================================================== the family page, in both sets, and the screenshot dialog
  for (const [vw, vh, mobile] of [[1440, 900, false], [1024, 768, false], [390, 844, true]] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      const label = `${vw}x${vh} ${scheme}`, floor = PHONE(vw) ? FLOOR.phone : FLOOR.wide;
      const { page, errors, close } = await ctx.open({ width: vw, height: vh }, mobile, { colorScheme: scheme });
      await page.goto(url(`family/${slug}`)); await sleep(500);
      const names = await page.evaluate(() => {
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
        return Array.from(document.querySelectorAll('.nm')).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(e => {
          const cs = getComputedStyle(e), px = parseFloat(cs.fontSize), ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
          const fg = rgba(cs.color), bg = bgOf(e), f = over(fg, bg), l1 = lum(f[0], f[1], f[2]), l2 = lum(bg[0], bg[1], bg[2]);
          return { text: (e.textContent || '').trim(), tag: e.tagName.toLowerCase(), cls: (e as HTMLElement).className, upper: cs.textTransform === 'uppercase', track: ls / px, weight: Number(cs.fontWeight), px, ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) };
        });
      });
      const heading = (n: any) => n.tag === 'h1' || n.tag === 'h2', rem = 17;
      ok(names.length >= 8 && names.every((n: any) => n.upper && n.track >= NAME_TRACK && n.weight >= 700), `${slug} family page ${label}: all ${names.length} names (hero, people nav, each person, the day, the next and previous family) are uppercase by CSS, bold, tracked at least 0.15em`);
      ok(names.filter(heading).every((n: any) => n.px + 0.05 >= 1.5 * rem) && names.filter((n: any) => !heading(n)).every((n: any) => n.px + 0.05 >= 0.85 * rem), `${slug} family page ${label}: a heading name is 1.5rem or more (smallest ${Math.min(...names.filter(heading).map((n: any) => n.px)).toFixed(1)} px), a nav chip or section label 0.85rem or more (smallest ${Math.min(...names.filter((n: any) => !heading(n)).map((n: any) => n.px)).toFixed(1)} px)`);
      const low = names.filter((n: any) => n.ratio < 4.5);
      ok(low.length === 0, `${slug} family page ${label}: every name is 4.5:1 or better against its page${low[0] ? ': ' + low.slice(0, 3).map((n: any) => `${n.ratio.toFixed(2)} "${n.text.slice(0, 20)}" ${n.cls}`).join(' | ') : ''}`);
      const real = await page.evaluate(() => Array.from(document.querySelectorAll('.who-nav a')).map(a => ({ label: a.getAttribute('aria-label') || '', text: (a.querySelector('.nm') || { textContent: '' }).textContent || '' })));
      ok(real.length > 0 && real.every((r: any) => r.label.startsWith(r.text) && r.text !== r.text.toUpperCase()), `${slug} family page ${label}: the people nav keeps each real name in its text and its aria-label ("${real[0]?.label}")`);
      // the screenshot dialog (a page with real screenshots opens one)
      const open = await page.$('.shot-open');
      if (open) {
        await open.scrollIntoViewIfNeeded(); await (mobile ? open.tap() : open.click()); await sleep(500);
        const w2 = await page.evaluate(WALK, ['dialog.shot-dialog[open]', floor] as [string, number]);
        const act = await page.evaluate(() => Array.from(document.querySelectorAll('dialog.shot-dialog[open] .shot-dialog-actions .btn')).map(b => b.getBoundingClientRect().height));
        const fit = await page.evaluate(() => { const r = document.querySelector('dialog.shot-dialog[open]')!.getBoundingClientRect(); return r.left >= -0.5 && r.right <= document.documentElement.clientWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5; });
        ok(w2.roots === 1 && w2.nodes >= 2 && w2.bad.length === 0 && act.length >= 1 && act.every((h: number) => h >= 43.5) && fit, `${slug} screenshot dialog ${label}: its ${w2.nodes} text nodes are all at least ${floor} px (smallest ${w2.smallest.toFixed(2)}), its ${act.length} buttons are 44 px and it fits the window${w2.bad[0] ? ': ' + w2.bad.join(' | ') : ''}`);
        await ctx.shot(page, `type-family-${vw}-${scheme}-dialog`);
      } else console.log(`  ${slug} has no screenshot on its page at ${label}: no dialog to measure`);
      await ctx.shot(page, `type-family-${vw}-${scheme}`);
      ok(errors.length === 0, `${slug} family page ${label}: no console error${errors[0] ? ': ' + errors[0] : ''}`);
      await close();
    }
  }
}
