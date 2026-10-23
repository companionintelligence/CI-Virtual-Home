// The tour and the player on a phone, measured (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test -- --only hooks --hook phone` after phone work
//
//   Each criterion of reference/story/player.md "On a phone" is a check here, at 390 x 844, 360 x 640 and 320 x 568 (touch) and on its side at 844 x 390 and 740 x 360:
//   P1  the start sheet: at most half the window, the home in view above it (the top half is only the player's own bars), the title and the tagline, the primary action 44 px or taller
//       in the bottom third, the family as ONE row of 44 px chips (sideways scroll, one line each), the long copy behind "About this family" (a <details>, 44 px summary) with every
//       line the fine print owes still in the page (and shown when it is opened, with the primary action still in view under it), no sideways scroll, no text past its card; the scrim
//       veils the player's own bars (the dialog takes every tap, so they must look put away); on its side a panel of at most 45 % of the width
//   P2  the beat sheet: for every beat of the tour, at most 40 % of the window (a panel at most 45 % of the width on its side), clear of what the beat is about (under 2 %), of the
//       bars and of the window's edges; as tall as its words (no dead space: within 8 px, or it scrolls); a one-line kicker; "More" a 44 px target in the card; the agent's line grows the
//       sheet downward and moves nothing that is being read; a sheet taller than its room follows the beat's time down its words, with "More" in reach
//   P3  the dock and the top bar: while the tour runs the hour chips and the speed control are away and the dock is one row; the home's name is shown whole (wraps, never an ellipsis,
//       no word broken, always the player's own 14 px) for every home's display name; on a phone held upright Previous and Next home are in the More sheet, on its side they stay in the
//       top bar; none of it is true of the plain player (and all of it is back when the tour's flag is)
//   P10 the More sheet is inside the window and every row of it can be reached, at every size (a phone on its side as short as 320 px); the end card's call to action is on screen without a
//       scroll and a tap on it lands on it, and Download Companion can be scrolled to, at every size (the narrowest phones on their side included)
//   P4  every control a 44 px target (chips that scroll sideways are judged by their own row), focus order (the action, the family, the disclosure) and a visible focus ring
//   P5  safe areas: with the notch's insets set (CDP Emulation.setSafeAreaInsetsOverride) no bar, sheet or panel is under them
//   P6  prefers-reduced-motion: no transition or animation on the sheet, and a sheet taller than its room does not scroll by itself
//   P7  no layout shift when the start sheet and the first beat's sheet open (the player's own bars and the dock stay where they were)
//   P8  the loader's card is on screen at once (before the player's module has loaded)
import type { TestCtx } from '../hooks.ts';

type Page = any;
const PHONE_SHEET = 0.4, START_SHEET = 0.5, SIDE_PANEL = 0.45, MAX_OVERLAP = 0.02;

export default async function phone(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, url } = ctx;
  const byFamily: Record<string, any> = (ctx.manifest as any).byFamily || {};
  const tours = Object.entries<any>(byFamily).filter(([, v]) => v && v.story).map(([slug]) => slug);
  if (!tours.length) { console.log('  no family has a tour in this build: nothing to test'); return; }
  const FAM = tours.includes('brennan') ? 'brennan' : tours[0];
  // the longest display name of any home (Split-Level Family House), when the build has a family there: the top bar must show it whole
  const LONG = tours.find(s => byFamily[s].house === 'familyhouse-nora') || FAM;
  const ua = ctx.pw.devices?.['iPhone 13']?.userAgent as string | undefined;
  const link = (slug: string, q = '') => url(`room-creator?mode=view&house=${byFamily[slug].house}&family=${slug}${q ? '&' + q : ''}`);
  const wait = async (page: Page) => {
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' && !!(window as any).__houseStory, null, { timeout: 240000 });
    await sleep(500);
  };
  const names: string[] = await (async () => {
    try {
      const idx = JSON.parse((await import('node:fs')).readFileSync(`${ctx.OUT}/content/houses/index.json`, 'utf8'));
      return Array.from(new Set<string>((idx.houses || idx).map((h: any) => String(h.name)))).sort((a, b) => b.length - a.length);
    } catch { return []; }
  })();

  // ------------------------------------------------------------------ what a phone view must satisfy, measured in the page
  const VIEW = () => {
    const vw = innerWidth, vh = innerHeight, de = document.documentElement;
    const vis = (e: Element) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]') && Number(s.opacity) > 0.01; };
    const box = (e: Element | null) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
    // text past the card it is in (a row that scrolls sideways is judged by its own box)
    const clip: string[] = [], broken: string[] = [];
    for (const card of Array.from(document.querySelectorAll('.st-card, .st-start-card, .st-end, .vh-help'))) {
      if (!vis(card)) continue; const cr = card.getBoundingClientRect();
      const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!(n.textContent || '').trim()) continue; const e = n.parentElement; if (!e || e.closest('[hidden]') || e.closest('.st-members-list, .st-chips, .st-live-region')) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const r of Array.from(rg.getClientRects())) if (r.width > 0 && (r.right > cr.right + 0.5 || r.left < cr.left - 0.5)) { clip.push(`${(card as HTMLElement).className}: ${(n.textContent || '').trim().slice(0, 30)}`); break; }
        // a word broken in the middle (overflow-wrap: anywhere does it to a word wider than its line): a word, or a part of one up to its hyphen, whose box is on two lines. A page's own text only (not what scrolls out of view in a card).
        if (e.closest('.st-live-region')) continue;
        const text = n.textContent || '';
        for (const m of text.matchAll(/[^\s-]+-?/g)) {
          const wr = document.createRange(); wr.setStart(n, m.index!); wr.setEnd(n, m.index! + m[0].length);
          const tops = new Set(Array.from(wr.getClientRects()).filter(q => q.width > 0.5).map(q => Math.round(q.top / 4)));
          if (tops.size > 1) { broken.push(`${(card as HTMLElement).className.split(' ')[0]}: ${m[0]}`); break; }
        }
      }
    }
    return { vw, vh, hOverflow: de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1, clip, broken };
  };
  const SMALL = (scope: string) => {
    const out: string[] = [];
    for (const e of Array.from(document.querySelectorAll(`${scope} button, ${scope} a[href], ${scope} summary, ${scope} input`))) {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none' || (e as HTMLElement).closest('[hidden], .vh-loading, .vh-help[hidden]')) continue;
      // a chip on the dock keeps its drawn size and takes a 44 px target with an ::after (portal/viewer.css); the chapters list's rows are 44 px on a touch screen by their own rule
      const after = getComputedStyle(e, '::after');
      let h = r.height; if (after.content !== 'none' && after.position === 'absolute') h = r.height - (parseFloat(after.top) || 0) - (parseFloat(after.bottom) || 0);
      if (e.matches('.st-ch')) h = Math.max(h, 44);
      if (h < 43.5 || (r.width < 43.5 && !e.matches('input'))) out.push(`${((e.getAttribute('aria-label') || e.textContent || e.className) as string).trim().slice(0, 28)} ${Math.round(r.width)}x${Math.round(h)}`);
    }
    return out;
  };

  // ================================================================== P1 to P4 at each phone size
  // (`light`: the two narrowest phones on their side, which the end card's call to action and the More sheet are tightest at: every check but the sweep of all the beats, which is five beats there)
  const sizes: Array<{ w: number; h: number; side: boolean; label: string; light?: boolean }> = [
    { w: 390, h: 844, side: false, label: '390 x 844' }, { w: 360, h: 640, side: false, label: '360 x 640' }, { w: 320, h: 568, side: false, label: '320 x 568' },
    { w: 844, h: 390, side: true, label: '844 x 390 (on its side)' }, { w: 740, h: 360, side: true, label: '740 x 360 (on its side)' },
    { w: 667, h: 375, side: true, label: '667 x 375 (on its side)', light: true }, { w: 568, h: 320, side: true, label: '568 x 320 (on its side)', light: true },
  ];
  let first = true;
  const shifted: number[] = [];    // beat 6's subject centre and the window's height at 390 x 844, for the kill switch's check below
  // (PHONE_SIZES=390x844,568x320 runs only those sizes of this loop, for work on one of them; the other sections run as ever)
  const only = (process.env.PHONE_SIZES || '').split(',').filter(Boolean);
  for (const sz of sizes.filter(s => !only.length || only.includes(`${s.w}x${s.h}`))) {
    const slug = sz.w === 390 || sz.w === 844 ? FAM : LONG;
    console.log(`\nP1-P4 the tour on a phone: ${sz.label}, ${slug}`);
    const { page, errors, close } = await ctx.open({ width: sz.w, height: sz.h }, true, ua ? { userAgent: ua } : {});
    // (each shift is kept with the element that moved, so a failure says what shifted and from where to where)
    await page.addInitScript(() => {
      (window as any).__cls = [];
      const d = (n: any) => { const e = n as HTMLElement | null; return e && e.tagName ? `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]}` : '?'; };
      try { new PerformanceObserver(l => { for (const e of l.getEntries() as any[]) (window as any).__cls.push({ v: e.value, t: e.startTime, input: !!e.hadRecentInput, src: (e.sources || []).slice(0, 2).map((s: any) => `${d(s.node)} y ${Math.round(s.previousRect.y)} to ${Math.round(s.currentRect.y)}, h ${Math.round(s.previousRect.height)} to ${Math.round(s.currentRect.height)}`).join('; ') }); }).observe({ type: 'layout-shift', buffered: true } as any); } catch { /* no layout-shift entries here */ }
    });
    await page.goto(link(slug)); await wait(page);
    const quiet = await page.evaluate(() => { const bar = (document.querySelector('.vh-top') as HTMLElement).getBoundingClientRect(), d = (document.querySelector('.vh-dock') as HTMLElement).getBoundingClientRect(); return { bar: [bar.left, bar.top, bar.width, bar.height], dock: [d.left, d.top, d.width, d.height], t: performance.now() }; });
    // ---- P1 the start sheet
    const st = await page.evaluate(() => {
      const c = document.querySelector('.st-start-card') as HTMLElement, r = c.getBoundingClientRect(), vh = innerHeight, vw = innerWidth;
      const prim = document.querySelector('.st-start .st-primary') as HTMLElement, pr = prim.getBoundingClientRect();
      const chips = Array.from(document.querySelectorAll('.st-member')).map(b => { const q = b.getBoundingClientRect(); return { top: q.top, h: q.height, w: q.width, name: b.querySelector('.st-member-name')?.textContent || '', ws: getComputedStyle(b).whiteSpace }; });
      const row = document.querySelector('.st-members-list') as HTMLElement | null;
      const det = document.querySelector('.st-about') as HTMLDetailsElement | null, sum = det?.querySelector('summary') as HTMLElement | null;
      const fine = Array.from(document.querySelectorAll('.st-fine li')).map(l => l.textContent || '');
      const meta = document.querySelector('.st-start-meta')?.textContent || '';
      const visibleText = (e: Element | null) => { if (!e) return false; const q = e.getBoundingClientRect(); return q.height > 0; };
      const kick = document.querySelector('.st-start-kick'), h = document.querySelector('#st-start-h'), p = document.querySelector('#st-start-p');
      return {
        layout: c.dataset.layout, top: r.top, bottom: r.bottom, h: r.height, w: r.width, left: r.left, right: r.right, vh, vw,
        prim: { top: pr.top, bottom: pr.bottom, h: pr.height, w: pr.width }, chips, rowScrolls: row ? row.scrollWidth > row.clientWidth + 1 : false, rowOverflowX: row ? getComputedStyle(row).overflowX : '',
        hasDetails: !!det, detOpen: det?.open, sumH: sum ? sum.getBoundingClientRect().height : 0, fine, meta, home: document.querySelector('.st-start-home')?.textContent || '',
        kick: kick?.textContent, title: h?.textContent, tag: p?.textContent, titleShown: visibleText(h), tagShown: visibleText(p),
        label: document.querySelector('#st-members-h')?.textContent || '', scrim: getComputedStyle(document.querySelector('.st-start')!).backgroundImage,
        // the player's own bars under the scrim: the bottom of the top bar and of the home's label chip, and what the scrim's hit test gives at the top bar's buttons (the dialog takes every tap)
        barsBottom: Math.max(...Array.from(document.querySelectorAll('.vh-top > *, .vh-fiction')).map(e => e.getBoundingClientRect().bottom)),
        hits: Array.from(document.querySelectorAll('.vh-top button')).filter(b => b.getBoundingClientRect().width > 0).map(b => { const q = b.getBoundingClientRect(), x = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!x && !!x.closest('.st-start'); }),
        // the home is in view: the area of the window the sheet does not cover, minus the player's own bars at the top
        bodyScrolls: c.scrollHeight > c.clientHeight + 1,
      };
    });
    const label = `${sz.label}`;
    if (!sz.side) {
      ok(st.layout === 'sheet' && st.h <= st.vh * START_SHEET + 1 && st.bottom <= st.vh + 0.5, `${label}: the start card is a bottom sheet of ${Math.round(st.h / st.vh * 100)} % of the height (at most 50 %), inside the window`);
      ok(st.top >= st.vh * 0.5 - 1, `${label}: the home shows above it (the sheet starts at ${Math.round(st.top / st.vh * 100)} % of the height)`);
      ok(st.prim.top >= st.vh * 2 / 3 - 1 && st.prim.bottom <= st.vh && st.prim.h >= 43.5, `${label}: the primary action is ${Math.round(st.prim.h)} px tall and in the bottom third (its top at ${Math.round(st.prim.top / st.vh * 100)} % of the height)`);
    } else {
      // (at most 45 % of the width, but never narrower than 17.5rem = 297.5 px, where 45 % is too narrow for the kicker's first word: a window under 660 px wide)
      const panelMax = Math.max(st.vw * SIDE_PANEL, 17.5 * 17);
      ok(st.layout === 'panel' && st.w <= panelMax + 0.5 && st.right <= panelMax + 8 + 0.5 && st.h <= st.vh + 0.5, `${label}: the start card is a side panel ${Math.round(st.w)} px wide, ${(st.w / st.vw * 100).toFixed(1)} % of the width (at most 45 %, or 17.5rem on a window under 660 px wide), inside the window`);
      ok(st.prim.h >= 43.5 && st.prim.bottom <= st.vh && st.prim.top >= 0, `${label}: the primary action is ${Math.round(st.prim.h)} px tall and in view`);
    }
    ok(st.kick === 'Interactive tour' && !!st.title && !!st.tag && st.titleShown && st.tagShown, `${label}: the kicker, the title ("${st.title}") and the tagline are on the sheet`);
    ok(st.chips.length > 1 && st.chips.every((c: any) => Math.abs(c.top - st.chips[0].top) < 1) && st.chips.every((c: any) => c.h >= 43.5), `${label}: the family is one row of ${st.chips.length} chips, each ${Math.round(Math.min(...st.chips.map((c: any) => c.h)))} px tall${st.rowScrolls ? ', scrolling sideways' : ''}`);
    ok(st.rowOverflowX === 'auto' || st.rowOverflowX === 'scroll', `${label}: the row scrolls sideways when the family is wider than the sheet (${st.rowOverflowX})`);
    ok(st.label.startsWith('Or start with one person') && st.chips.every((c: any) => c.ws === 'nowrap'), `${label}: the row's label is "${st.label}" and each chip keeps one line`);
    ok(st.hasDetails && st.detOpen === false && st.sumH >= 43.5, `${label}: the long copy is behind "About this family", a closed <details> with a ${Math.round(st.sumH)} px summary`);
    // (the lines the claims owe this card today; a line that claims.json stops owing, as the beta sentence was by #49, is not listed here: the count printed below is whatever the page carries)
    const owed = ['Scenes are written for this site.', 'They are not recordings of a real session.', 'The Companion Core is drawn as a stylised illustration, not a photograph.'];
    ok(owed.every(t => st.fine.some((l: string) => l.includes(t))) && /Fictional family\. Real software\./.test(st.meta) && /\d+ stops, about \d+ minutes?/.test(st.meta) && st.home.length > 20, `${label}: nothing is cut: the facts, the home's line and all ${st.fine.length} lines of fine print are in the page behind the disclosure`);
    // (the scrim is a dialog's: it takes every tap, so the player's own bars under it are veiled and do not look live)
    const alpha0 = Number((/\/ ([\d.]+)\)/.exec(st.scrim) || [])[1]), band = Number((/\/ [\d.]+\) ([\d.]+)px/.exec(st.scrim) || [])[1]);
    ok(alpha0 >= 0.2 && band >= st.barsBottom - 0.5 && st.hits.length > 0 && st.hits.every(Boolean), `${label}: the dialog takes the taps over the top bar and the scrim veils it (${(alpha0 * 100).toFixed(0)} % to ${band} px, where the bar and the home's label end at ${Math.round(st.barsBottom)} px), so the bar does not look live while it is dead`);
    const v1 = await page.evaluate(VIEW);
    ok(!v1.hOverflow && v1.clip.length === 0 && v1.broken.length === 0, `${label}: no sideways scroll, no text past its card and no word broken in the middle on the start sheet${v1.clip.length ? ': ' + v1.clip.slice(0, 2).join(' | ') : ''}${v1.broken.length ? ': broken ' + v1.broken.slice(0, 3).join(' | ') : ''}`);
    const small1 = await page.evaluate(SMALL, '.st-start');
    ok(small1.length === 0, `${label}: every control of the start sheet is a 44 px target${small1.length ? ': ' + small1.join(', ') : ''}`);
    // the disclosure opens, and its words are in view (the sheet scrolls to them), still inside the limit
    await page.locator('.st-about-sum').tap();
    // (the sheet scrolls to the opened words smoothly, in steps a loaded machine spaces out: wait for the last line to be in view and clear of the action bar that sticks under it, up to six seconds, rather than for a fixed time)
    for (let k = 0; k < 40; k++) { await sleep(150); if (await page.evaluate(() => { const c = document.querySelector('.st-start-card') as HTMLElement, cr = c.getBoundingClientRect(), f = (document.querySelector('.st-fine li:last-child') as HTMLElement).getBoundingClientRect(), p = (document.querySelector('.st-start .st-primary') as HTMLElement).getBoundingClientRect(); return f.bottom <= Math.min(cr.bottom, p.top) + 1 && f.top >= cr.top - 1; })) break; }
    const op = await page.evaluate(() => {
      const c = document.querySelector('.st-start-card') as HTMLElement, cr = c.getBoundingClientRect(), f = (document.querySelector('.st-fine li:last-child') as HTMLElement).getBoundingClientRect();
      const p = document.querySelector('.st-start .st-primary') as HTMLElement, pr = p.getBoundingClientRect(), hit = document.elementFromPoint(pr.left + pr.width / 2, pr.top + pr.height / 2);
      return { open: (document.querySelector('.st-about') as HTMLDetailsElement).open, h: cr.height, vh: innerHeight, lastIn: f.bottom <= cr.bottom + 1 && f.top >= cr.top - 1, scrolls: c.scrollHeight > c.clientHeight + 1,
        primIn: pr.top >= cr.top - 1 && pr.bottom <= cr.bottom + 1 && pr.height >= 43.5, primHit: hit === p || p.contains(hit), primBelowFine: pr.top >= f.bottom - 1,
        order: Array.from(document.querySelectorAll('.st-start button, .st-start summary, .st-start a')).filter(e => e.getBoundingClientRect().height > 0).map(e => (e as HTMLElement).className.split(' ')[0]) };
    });
    ok(op.open && op.lastIn && (sz.side || op.h <= op.vh * START_SHEET + 1), `${label}: "About this family" opens and its last line is in view inside the sheet (${Math.round(op.h / op.vh * 100)} % of the height)`);
    // (the action bar goes to the end of the sheet while the disclosure is open and sticks to its bottom edge: the primary action is in view and tappable while the long copy is read)
    ok(op.primIn && op.primHit && op.primBelowFine, `${label}: with "About this family" open the primary action is still in view, under the words, and a tap on it lands on it`);
    { const at = op.order.lastIndexOf('st-about-sum'), tail = op.order.slice(at + 1);
      ok(op.order[0] === 'st-member' && at > 0 && tail.length >= 1 && tail.every((c: string) => c === 'st-btn'), `${label}: and the focus order is the order on screen (the family, the disclosure, the action: ${op.order.join(', ')})`); }
    await page.locator('.st-about-sum').tap(); await sleep(250);

    // ---- P4 the keyboard: the action, the family, the disclosure, each with a visible ring
    const order = await page.evaluate(() => Array.from(document.querySelectorAll('.st-start button, .st-start summary, .st-start a')).filter(e => (e as HTMLElement).getBoundingClientRect().height > 0).map(e => (e as HTMLElement).className.split(' ')[0]));
    ok(order[0] === 'st-btn' && order.slice(1, -1).every((c: string) => c === 'st-member') && order[order.length - 1] === 'st-about-sum', `${label}: the focus order is the action, the family, then the disclosure (${order.join(', ')})`);
    if (first) {
      // (the ring is :focus-visible: it shows for a stop reached with the keyboard, so each stop is reached by Tab from the one before; the action is reached by Shift+Tab from the family's first chip)
      await page.evaluate(() => (document.querySelector('.st-start .st-primary') as HTMLElement).focus());
      const rings: string[] = [];
      const ring = async () => page.evaluate(() => { const a = document.activeElement as HTMLElement; const cs = getComputedStyle(a); const r = a.getBoundingClientRect(); const c = (document.querySelector('.st-start-card') as HTMLElement).getBoundingClientRect(); return { cls: a.className.split(' ')[0], ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1.9, inView: r.bottom <= c.bottom + 1 && r.top >= c.top - 1 }; });
      for (let i = 1; i < order.length; i++) {
        await page.keyboard.press('Tab'); await sleep(120);
        const f = await ring(); if (!f.ring || !f.inView) rings.push(`${f.cls}${f.ring ? '' : ' (no ring)'}${f.inView ? '' : ' (out of view)'}`);
      }
      for (let i = 1; i < order.length; i++) { await page.keyboard.press('Shift+Tab'); await sleep(80); }
      { const f = await ring(); if (f.cls !== 'st-btn' || !f.ring || !f.inView) rings.push(`the action ${f.ring ? '' : '(no ring)'}`); }
      ok(rings.length === 0, `${label}: every stop of the keyboard path has a visible focus ring and is in view${rings.length ? ': ' + rings.join(', ') : ''}`);
      first = false;
    }

    // ---- P3 the dock and the top bar while the tour runs
    const chrome = await page.evaluate(() => {
      const vis = (e: Element | null) => { if (!e) return false; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
      const dock = document.querySelector('.vh-dock') as HTMLElement, d = dock.getBoundingClientRect();
      const top = document.querySelector('.vh-actions') as HTMLElement;
      const tool = (a: string) => vis(document.querySelector(`.vh-tools [data-act="${a}"]`));
      return {
        tods: vis(document.querySelector('.vh-tods')), shots: vis(document.querySelector('.vh-shots')), speed: vis(document.querySelector('.vh-tool[data-act="speed"]')), play: vis(document.querySelector('.vh-play')), scrub: vis(document.querySelector('.vh-scrub input')), chapters: vis(document.querySelector('.st-btn-chapters')),
        dockH: d.height, dockRows: getComputedStyle(dock).flexDirection, rowsVisible: Array.from(dock.querySelectorAll(':scope > .vh-row')).filter(vis).length,
        topPrev: vis(top.querySelector('[data-act="prev"]')), topNext: vis(top.querySelector('[data-act="next"]')), toolPrev: tool('prev'), toolNext: tool('next'),
      };
    });
    ok(!chrome.tods && !chrome.shots && !chrome.speed && chrome.play && chrome.scrub && chrome.chapters, `${label}: the dock keeps play, the seek bar and the chapters button; the hour chips, the shot chips and the speed control are away while the tour runs`);
    ok(chrome.rowsVisible === 1 && chrome.dockH <= 70, `${label}: the dock is one row (${Math.round(chrome.dockH)} px tall)`);
    // (a phone held upright sends Previous and Next home to the More sheet to give the name room; on its side the bar is wide and the sheet short, so they stay in the bar and are not rows of the sheet)
    if (!sz.side) ok(!chrome.topPrev && !chrome.topNext, `${label}: Previous home and Next home have left the top bar (the name has the room)`);
    else ok(chrome.topPrev && chrome.topNext && !chrome.toolPrev && !chrome.toolNext, `${label}: on its side Previous home and Next home stay in the top bar, which is wide, and are not rows of the More sheet, which is short`);
    // the name: whole, wrapping, never an ellipsis, no word broken, the player's own 14 px, for the longest names there are
    if (names.length) {
      const bad = await page.evaluate((list: string[]) => {
        const el = document.querySelector('.vh-name') as HTMLElement, was = el.textContent, out: string[] = [], bar = document.querySelector('.vh-top') as HTMLElement;
        const fs = getComputedStyle(el).fontSize, wrap = getComputedStyle(el).whiteSpace;
        for (const n of list.slice(0, 8)) {
          el.textContent = n; const cs = getComputedStyle(el), lines = Math.round((el.getBoundingClientRect().height) / (parseFloat(cs.lineHeight) || 17));
          // (and the bar stays the 46 px the player's other chrome (the label chip, the free-camera bar, the toast, About) is positioned from: a taller bar would put them under it)
          const over = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 || cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap' || lines > 2 || bar.getBoundingClientRect().height > 46.5, sw = el.scrollWidth, cw = el.clientWidth;
          // (a word wider than the box is broken in the middle by overflow-wrap: a name may wrap between its words and after a hyphen, never inside one)
          const probe = document.createElement('span'); probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:0;top:0'; el.append(probe);
          const broken = n.split(/(?<=-)|\s+/).filter(Boolean).filter(t => { probe.textContent = t; return probe.getBoundingClientRect().width > cw + 0.5; });
          probe.remove();
          if (over || broken.length) out.push(`${n}: ${lines} lines, ${sw} in ${cw}, the bar ${Math.round(bar.getBoundingClientRect().height)} px${broken.length ? ', would break ' + broken.join('/') : ''}`);
        }
        el.textContent = was;
        return { out, fs, wrap, barH: bar.getBoundingClientRect().height };
      }, names);
      ok(bad.out.length === 0, `${label}: the longest home names (${names.slice(0, 3).join(', ')} ...) show whole in the top bar on at most two lines, no ellipsis, no word broken, the bar no taller than 46 px${bad.out.length ? ': ' + bad.out.join(' | ') : ''}`);
      ok(bad.fs === '14px' && bad.wrap === 'normal', `${label}: the name is the player's own ${bad.fs} (not made smaller at any width) and wraps in the tour (${bad.wrap})`);
    }

    // ---- start the tour: the first beat's sheet
    await page.locator('.st-start .st-primary').tap(); await sleep(600);
    await page.waitForFunction(() => { const c = document.querySelector('.st-card') as HTMLElement | null; return !!c && !c.hidden && c.classList.contains('st-in'); }, null, { timeout: 60000 }).catch(() => {});
    // ---- P7 the sheets opened: from the page being ready to the first beat's sheet on screen the layout did not shift (the card moving from one beat to the next is placed anew each beat, by design)
    // (the standard measure: a shift within half a second of a tap or a key is the person's own, as opening "About this family" is; every other one counts)
    const shifts: Array<{ v: number; t: number; input: boolean; src: string }> = (await page.evaluate(() => (window as any).__cls || [])).filter((e: any) => !e.input), opened = shifts.reduce((a, e) => a + e.v, 0);
    ok(opened < 0.02, `${label}: layout shift while the start sheet and the first beat's sheet open: ${opened.toFixed(4)} (under 0.02)${opened >= 0.02 ? ': ' + shifts.filter(e => e.v > 0.002).slice(0, 3).map(e => `${e.v.toFixed(3)} at ${Math.round(e.t)} ms, ${e.src}`).join(' | ') : ''}`);
    // ---- P2 every beat
    const n: number = await page.evaluate(() => (window as any).__houseStory.rs.beats.length);
    const rows: any[] = [];
    // (the two narrowest phones on their side: five beats, the first, the family's rooms and the last; every other size, every beat)
    for (const i of sz.light ? [0, 5, 12, 20, n - 1] : Array.from({ length: n }, (_, k) => k)) {
      rows.push(await page.evaluate(async (i: number) => {
        const api = (window as any).__houseStory, m = await api.measure(i), c = document.querySelector('.st-card') as HTMLElement, vh = innerHeight, vw = innerWidth, r = c.getBoundingClientRect(), cs = getComputedStyle(c);
        // (what a person can see: a line held a room but not drawn, visibility hidden or opacity 0, is dead space, and is what this check is for)
        const kids = Array.from(c.children).filter(k => { const s = getComputedStyle(k); return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.01 && k.getBoundingClientRect().height > 0; });
        const bottom = kids.reduce((a, k) => Math.max(a, k.getBoundingClientRect().bottom), 0), dead = r.bottom - (parseFloat(cs.paddingBottom) || 0) - bottom;
        const k = c.querySelector('.st-kicker') as HTMLElement | null, disc = c.querySelector('.st-disc') as HTMLElement | null, mb = c.querySelector('.st-more-btn') as HTMLElement | null, mr = mb ? mb.getBoundingClientRect() : null;
        return {
          i, id: m.beat, mode: c.dataset.mode, h: r.height, w: r.width, left: r.left, right: r.right, top: r.top, bottom: r.bottom, vh, vw, scrolls: c.scrollHeight > c.clientHeight + 1, dead,
          kick: k ? k.getBoundingClientRect().height : 0, disc: disc ? disc.getBoundingClientRect().height : 0, more: !!mb, moreH: mr ? mr.height : 0, moreIn: mr ? mr.top >= r.top - 1 && mr.bottom <= r.bottom + 1 && mr.left >= r.left && mr.right <= r.right + 1 : true,
          overlapLive: m.overlapLive, overlapBars: m.overlapBars, planned: m.planned, liveC: m.live ? m.live.y + m.live.h / 2 : null, barB: (document.querySelector(".vh-top > .vh-title") as HTMLElement).getBoundingClientRect().bottom,
        };
      }, i));
    }
    const maxH = Math.max(...rows.map(r => r.h / r.vh)), cap = sz.side ? 1 : PHONE_SHEET;
    if (!sz.side) {
      // the picture is shifted up (a camera view offset, `?no=shift` kills it) so that what a beat is about stands in the room above the sheet: its centre is under the top bar and over the sheet
      const seen = rows.filter(r => r.liveC !== null);
      ok(seen.length > rows.length * 0.8 && seen.every(r => r.liveC > r.barB && r.liveC < r.top), `${label}: in ${seen.length} of ${rows.length} beats the subject's centre is below the top bar and above the sheet (the highest at ${Math.round(Math.min(...seen.map(r => r.liveC)))} px, the lowest ${Math.round(Math.max(...seen.map(r => r.liveC - r.top)))} px above the sheet's top)`);
      if (sz.w === 390) shifted.push(rows[5].liveC, sz.h);
      ok(rows.every(r => r.mode === 'sheet') && maxH <= cap + 0.004, `${label}: all ${rows.length} beats are a sheet of at most 40 % of the height (the tallest is ${(maxH * 100).toFixed(1)} %)`);
      const fat = rows.filter(r => !r.scrolls && r.dead > 8);
      ok(fat.length === 0, `${label}: a sheet is as tall as its words, within 8 px (${rows.filter(r => !r.scrolls).length} beats fit, the most dead space is ${Math.round(Math.max(0, ...rows.filter(r => !r.scrolls).map(r => r.dead)))} px; ${rows.filter(r => r.scrolls).length} beats are taller than their room and scroll inside)${fat.length ? ': ' + fat.slice(0, 3).map(r => `${r.id} ${Math.round(r.dead)}`).join(', ') : ''}`);
      // (a person's kicker, the monogram and the name: one line. A beat with no person has its chapter's title there, in capitals and tracked, and a long title is allowed its second line)
      const people = rows.filter(r => r.disc > 0), twoLine = people.filter(r => r.kick > r.disc * 1.25 + 2);
      ok(people.length > 0 && twoLine.length === 0, `${label}: a person's kicker is one line in ${people.length - twoLine.length} of ${people.length} beats (${rows.length - people.length} beats carry a chapter's title there${rows.some(r => r.disc === 0 && r.kick > 40) ? ', ' + rows.filter(r => r.disc === 0 && r.kick > 40).length + ' of them on two lines' : ''})`);
    } else {
      ok(rows.every(r => r.mode === 'card' && r.w <= r.vw * SIDE_PANEL + 0.5), `${label}: all ${rows.length} beats are a side panel of at most 45 % of the width (the widest is ${(Math.max(...rows.map(r => r.w / r.vw)) * 100).toFixed(1)} %), never a sheet over the scene's height`);
    }
    const unplaced = rows.filter(r => r.planned && !r.planned.ok);
    ok(rows.every(r => r.overlapLive <= MAX_OVERLAP + 1e-9 || (r.planned && !r.planned.ok)), `${label}: no card covers more than 2 % of what its beat is about (the worst is ${(Math.max(...rows.map(r => r.overlapLive)) * 100).toFixed(2)} %; the solver found no clear place for ${unplaced.length} of ${rows.length}${unplaced.length ? ': ' + unplaced.slice(0, 4).map(r => r.id).join(', ') : ''})`);
    if (!sz.side) ok(unplaced.length === 0, `${label}: the solver found a clear place for all ${rows.length} beats`);
    ok(rows.every(r => r.overlapBars === 0), `${label}: no card touches the top bar or the dock`);
    ok(rows.every(r => r.left >= -0.5 && r.right <= r.vw + 0.5 && r.top >= -0.5 && r.bottom <= r.vh + 0.5), `${label}: every card is inside the window`);
    const withMore = rows.filter(r => r.more);
    ok(withMore.length > 0 && withMore.every(r => r.moreH >= 43.5 && r.moreIn), `${label}: "More" is a 44 px target inside the card in all ${withMore.length} beats that have one`);
    // the card's own words never leave it
    const v2 = await page.evaluate(VIEW);
    ok(!v2.hOverflow && v2.clip.length === 0 && v2.broken.length === 0, `${label}: no sideways scroll, no text past its card and no word broken in the middle on the beat sheet${v2.clip.length ? ': ' + v2.clip.slice(0, 2).join(' | ') : ''}${v2.broken.length ? ': broken ' + v2.broken.slice(0, 3).join(' | ') : ''}`);
    // the agent's line grows the sheet downward and moves nothing that is read
    const grow = await page.evaluate(async () => {
      const api = (window as any).__houseStory, rs = api.rs; const i = rs.beats.findIndex((b: any) => b.say); if (i < 0) return null;
      await api.measure(i); const c = document.querySelector('.st-card') as HTMLElement, say = c.querySelector('.st-say') as HTMLElement, t0 = c.getBoundingClientRect(), k0 = (c.querySelector('.st-title') as HTMLElement).getBoundingClientRect().top;
      say.classList.add('st-on'); await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r));
      const t1 = c.getBoundingClientRect(), k1 = (c.querySelector('.st-title') as HTMLElement).getBoundingClientRect().top; say.classList.remove('st-on');
      return { top0: t0.top, top1: t1.top, h0: t0.height, h1: t1.height, titleMoved: Math.abs(k1 - k0), vh: innerHeight, bottom1: t1.bottom, mode: c.dataset.mode };
    });
    if (grow && grow.mode === 'sheet') ok(Math.abs(grow.top1 - grow.top0) < 0.5 && grow.titleMoved < 0.5 && grow.h1 >= grow.h0 && grow.h1 <= grow.vh * PHONE_SHEET + 1, `${label}: the agent's line grows the sheet downward (${Math.round(grow.h0)} to ${Math.round(grow.h1)} px) and the words above it do not move`);
    // a sheet taller than its room follows the beat's time down its words when no voice does (and not before the first third of the beat; the stuck head keeps "More" in reach as it goes)
    if (!sz.side) {
      const idx = rows.find(r => r.scrolls);
      if (idx) {
        const f = await page.evaluate(async (i: number) => {
          const api = (window as any).__houseStory; await api.measure(i); const c = document.querySelector('.st-card') as HTMLElement;
          c.scrollTop = 0; const early = api.follow(0.1), late = api.follow(0.9), max = c.scrollHeight - c.clientHeight;
          const mb = c.querySelector('.st-more-btn') as HTMLElement | null, mr = mb ? mb.getBoundingClientRect() : null, cr = c.getBoundingClientRect();
          return { early, late, max, moreIn: !mr || (mr.top >= cr.top - 1 && mr.bottom <= cr.bottom + 1) };
        }, idx.i);
        ok(f.early === 0 && f.late >= f.max - 2 && f.max > 2 && f.moreIn, `${label}: the sheet of beat ${idx.id} follows the beat down its words (at 10 % of the beat at ${Math.round(f.early)} px, at 90 % at ${Math.round(f.late)} of ${Math.round(f.max)} px) and "More" is still in reach`);
      } else ok(true, `${label}: no beat's sheet scrolls here (nothing to follow)`);
    }
    // the More sheet of the player (P10): inside the window with every row reachable (a phone on its side is 360 px tall or less: if the rows are more than that holds, the sheet scrolls, it does not
    // run off the top of the window), the rows 44 px targets; on a phone held upright Previous and Next home are rows of it, on its side they are not (they stay in the top bar)
    {
      await page.locator('[data-act="more"]').tap(); await sleep(500);
      const mt = await page.evaluate(() => {
        const t = document.querySelector('.vh-tools') as HTMLElement;
        const rowEls = Array.from(t.querySelectorAll('.vh-tool')).filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; }) as HTMLElement[];
        const unreachable: string[] = [];
        for (const e of rowEls) { t.scrollTop = Math.max(0, e.offsetTop - 6); const r = e.getBoundingClientRect(), q = t.getBoundingClientRect(); if (r.top < q.top - 1 || r.bottom > q.bottom + 1 || r.top < -0.5 || r.bottom > innerHeight + 0.5) unreachable.push(String(e.dataset.act)); }
        t.scrollTop = 0;
        const q = t.getBoundingClientRect(), row = (a: string) => { const e = rowEls.find(x => x.dataset.act === a); return e ? { h: e.getBoundingClientRect().height } : null; };
        return { top: q.top, bottom: q.bottom, left: q.left, right: q.right, vw: innerWidth, vh: innerHeight, acts: rowEls.map(e => e.dataset.act), scrolls: t.scrollHeight > t.clientHeight + 1, unreachable, prev: row('prev'), next: row('next') };
      });
      ok(mt.top >= -0.5 && mt.bottom <= mt.vh + 0.5 && mt.left >= -0.5 && mt.right <= mt.vw + 0.5 && mt.unreachable.length === 0, `${label}: the More sheet (${mt.acts.length} rows${mt.scrolls ? ', scrolling inside' : ''}) is inside the window, ${Math.round(mt.top)} to ${Math.round(mt.bottom)} px of ${mt.vh}, and every row can be reached${mt.unreachable.length ? ': not ' + mt.unreachable.join(', ') : ''}`);
      if (!sz.side) ok(!!mt.prev && !!mt.next && mt.prev.h >= 43.5 && mt.next.h >= 43.5, `${label}: the More sheet has Previous home and Next home, ${mt.next ? Math.round(mt.next.h) : 0} px tall`);
      else ok(!mt.prev && !mt.next, `${label}: the More sheet on its side has ${mt.acts.length} rows and not Previous home and Next home (${mt.acts.join(', ')})`);
      const small = await page.evaluate(SMALL, '.vh-tools');
      ok(small.length === 0, `${label}: every row of the More sheet is a 44 px target${small.length ? ': ' + small.join(', ') : ''}`);
      await page.locator('[data-act="more"]').tap(); await sleep(300);
    }
    // ---- P4 the dock and the card, at rest
    const small2 = await page.evaluate(SMALL, '.vh-dock'), small3 = await page.evaluate(SMALL, '.st-card'), small4 = await page.evaluate(SMALL, '.vh-top');
    ok(small2.length + small3.length + small4.length === 0, `${label}: every control of the dock, the card and the top bar is a 44 px target${[...small2, ...small3, ...small4].length ? ': ' + [...small2, ...small3, ...small4].join(', ') : ''}`);
    // the chapters panel is a sheet that takes the card's place, inside the window
    await page.locator('.st-btn-chapters').tap(); await sleep(500);
    const ch = await page.evaluate(() => { const p = document.querySelector('.st-chapters') as HTMLElement | null; if (!p) return null; const r = p.getBoundingClientRect(), d = (document.querySelector('.vh-dock') as HTMLElement).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, dockTop: d.top }; });
    ok(!!ch && ch.left >= 0 && ch.right <= ch.vw + 0.5 && ch.top >= 0 && ch.bottom <= ch.dockTop + 1, `${label}: the chapters panel is inside the window, above the dock`);
    const smallC = await page.evaluate(SMALL, '.st-chapters');
    ok(smallC.length === 0, `${label}: every chapter row is a 44 px target${smallC.length ? ': ' + smallC.slice(0, 3).join(', ') : ''}`);
    await page.locator('.st-btn-chapters').tap(); await sleep(400);
    // the end card is a sheet (a panel on its side) that never covers the Core
    const end = await page.evaluate(async () => {
      const api = (window as any).__houseStory, m = await api.measureEnd(); await new Promise(r => setTimeout(r, 600));    // (the card fades in over 0.3 s)
      const card = document.querySelector('.st-end') as HTMLElement, cr = card.getBoundingClientRect();
      const share = (b: DOMRect) => Math.max(0, Math.min(b.bottom, cr.bottom) - Math.max(b.top, cr.top)) / Math.max(1, b.height);
      const cta = card.querySelector('.st-primary') as HTMLElement, cb = cta.getBoundingClientRect(), chit = document.elementFromPoint(cb.left + cb.width / 2, cb.top + cb.height / 2);
      // Download Companion is scrolled to the top of the card's own room (the call to action's bar, which sticks to the bottom on its side, is under the rest)
      const dl = Array.from(card.querySelectorAll('a.st-btn')).find(a => /Download/.test(a.textContent || '')) as HTMLElement;
      card.scrollTop = Math.max(0, dl.offsetTop - 8); await new Promise(r => requestAnimationFrame(r));
      const db = dl.getBoundingClientRect(), dhit = document.elementFromPoint(db.left + db.width / 2, db.top + db.height / 2), dlSeen = share(db);
      const bar = card.querySelector('.st-go') as HTMLElement | null;
      const rest = Array.from(card.querySelectorAll('.st-btn')).map(b => b.getBoundingClientRect().height);
      card.scrollTop = 0;
      return { overlapCore: m.overlapCore, card: m.card, vw: m.vw, vh: m.vh, visible: m.visible, mode: card.dataset.mode, side: card.dataset.side, bars: m.bars,
        ctaSeen: share(cb), ctaHit: chit === cta || cta.contains(chit), ctaH: cb.height, ctaText: (cta.textContent || '').trim(), ctaInBar: !!bar && bar.contains(cta), barSticky: bar ? getComputedStyle(bar).position : '',
        dlSeen, dlHit: dhit === dl || dl.contains(dhit), dlH: db.height, minBtn: Math.min(...rest), scrolls: card.scrollHeight > card.clientHeight + 1 };
    });
    ok(end.visible && end.overlapCore < 0.05 && end.card.x >= -0.5 && end.card.x + end.card.w <= end.vw + 0.5 && end.card.y >= -0.5 && end.card.y + end.card.h <= end.vh + 0.5 && end.bars === 0, `${label}: the end card (${end.mode}) is inside the window, covers ${(end.overlapCore * 100).toFixed(1)} % of the Core and touches no bar`);
    if (sz.side) ok(end.mode === 'card' && end.card.w <= end.vw * SIDE_PANEL + 0.5, `${label}: and on its side it is a panel of ${(end.card.w / end.vw * 100).toFixed(1)} % of the width`);
    // P10 the end card's call to action is on screen without a scroll and a tap lands on it (on its side it is a bar that sticks to the panel's bottom edge); Download Companion can be scrolled to
    ok(end.ctaSeen >= 0.99 && end.ctaHit && end.ctaH >= 43.5, `${label}: the end card's call to action ("${end.ctaText}") is ${Math.round(end.ctaSeen * 100)} % on screen without a scroll, ${Math.round(end.ctaH)} px tall, and a tap on its middle lands on it`);
    ok(end.dlSeen >= 0.99 && end.dlHit && end.dlH >= 43.5, `${label}: Download Companion can be scrolled to and tapped (${Math.round(end.dlSeen * 100)} % in view, ${Math.round(end.dlH)} px tall${end.scrolls ? ', the card scrolls' : ''})`);
    ok(end.minBtn >= 43.5, `${label}: every button of the end card is a 44 px target (the smallest is ${Math.round(end.minBtn)} px)`);
    if (sz.side) ok(end.side === '1' && end.ctaInBar && end.barSticky === 'sticky', `${label}: on its side the call to action is the bar that sticks to the bottom edge of the panel (${end.barSticky})`);
    else ok(end.side !== '1' && !end.ctaInBar, `${label}: held upright the call to action is the first button of the row, as it always was`);
    const v3 = await page.evaluate(VIEW);
    ok(!v3.hOverflow && v3.clip.length === 0 && v3.broken.length === 0, `${label}: no sideways scroll, no text past its card and no word broken in the middle on the end card${v3.clip.length ? ': ' + v3.clip.slice(0, 2).join(' | ') : ''}${v3.broken.length ? ': broken ' + v3.broken.slice(0, 3).join(' | ') : ''}`);
    // no layout shift on the way in: the player's own bars stayed where they were (the sheets are over the scene, not in the page's flow)
    const after = await page.evaluate(() => { const bar = (document.querySelector('.vh-top') as HTMLElement).getBoundingClientRect(), d = (document.querySelector('.vh-dock') as HTMLElement).getBoundingClientRect(); return { bar: [bar.left, bar.top, bar.width, bar.height], dock: [d.left, d.top, d.width, d.height], cls: ((window as any).__cls || []).filter((e: any) => e.t >= 0).reduce((a: number, e: any) => a + e.v, 0) }; });
    ok(JSON.stringify(after.bar.map(Math.round)) === JSON.stringify(quiet.bar.map(Math.round)) && JSON.stringify(after.dock.map(Math.round)) === JSON.stringify(quiet.dock.map(Math.round)), `${label}: the top bar and the dock did not move from the start sheet to the end card`);
    ok(errors.length === 0, `${label}: no console errors${errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''}`);
    await close();
  }

  // ================================================================== P3 the plain player is as it was, and the tour's flag is all that changes it
  {
    console.log('\nP3 the plain player on a phone, and the tour\'s away');
    const { page, errors, close } = await ctx.open({ width: 390, height: 844 }, true, ua ? { userAgent: ua } : {});
    await page.goto(url(`room-creator?mode=view&house=${byFamily[FAM].house}&no=story`));
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 240000 }); await sleep(500);
    const vis = (sel: string) => page.evaluate((s: string) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden'; }, sel);
    ok(await vis('.vh-tods') && await vis('.vh-actions [data-act="next"]') && await vis('.vh-actions [data-act="prev"]') && !(await vis('.vh-tools [data-act="next"]')), 'the plain player (?no=story) keeps the hour chips and the top bar\'s Previous and Next home');
    // the plain player's top bar is the player's: its name is one line with an ellipsis, at the player's own 14 px, as it was before the tour's phone pass (the tour's wrap is behind html[data-story])
    const pn = await page.evaluate((list: string[]) => {
      const el = document.querySelector('.vh-name') as HTMLElement, bar = document.querySelector('.vh-top') as HTMLElement, was = el.textContent, h0 = bar.getBoundingClientRect().height;
      el.textContent = list[0] || was; const cs = getComputedStyle(el), h1 = bar.getBoundingClientRect().height, lines = Math.round(el.getBoundingClientRect().height / (parseFloat(cs.lineHeight) || 17));
      const out = { ws: cs.whiteSpace, to: cs.textOverflow, ov: cs.overflow, fs: cs.fontSize, lines, h0, h1 }; el.textContent = was; return out;
    }, names);
    ok(pn.ws === 'nowrap' && pn.to === 'ellipsis' && pn.ov === 'hidden' && pn.fs === '14px' && pn.lines === 1 && pn.h1 <= pn.h0 + 0.5, `the plain player's name is unchanged: one line, an ellipsis, ${pn.fs}, and the top bar does not grow for a long name (${Math.round(pn.h0)} px with the home's own name, ${Math.round(pn.h1)} px with the longest)`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''}`);
    await close();
    // and the same page with the tour: the tour's stylesheet puts them away, and the flag it sets on <html> (which goes when the tour does) is all that holds them there
    const t = await ctx.open({ width: 390, height: 844 }, true, ua ? { userAgent: ua } : {});
    await t.page.goto(link(FAM)); await wait(t.page);
    const tv = (sel: string) => t.page.evaluate((s: string) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden'; }, sel);
    ok(!(await tv('.vh-tods')) && !(await tv('.vh-actions [data-act="next"]')) && await tv('.vh-tools [data-act="next"]') === false, 'with the tour running the hour chips and the top bar\'s Previous and Next home are away (Next home is a row of the More sheet, which is shut)');
    await t.page.evaluate(() => { delete document.documentElement.dataset.story; }); await sleep(200);
    ok(await tv('.vh-tods') && await tv('.vh-actions [data-act="next"]'), 'with the tour\'s flag gone they are back (the tour ends: nothing is left behind)');
    await t.page.evaluate(() => { document.documentElement.dataset.story = '1'; }); await sleep(200);
    ok(!(await tv('.vh-tods')) && !(await tv('.vh-actions [data-act="next"]')), 'and with the flag set again they are away');
    await t.close();
  }

  // ================================================================== P5 safe areas
  for (const ins of [{ top: 47, bottom: 34, left: 0, right: 0, label: 'a notch and a home bar (portrait)', w: 390, h: 844 }, { top: 0, bottom: 21, left: 47, right: 47, label: 'a notch at each end (on its side)', w: 844, h: 390 }]) {
    console.log(`\nP5 safe areas: ${ins.label}`);
    const { page, errors, close } = await ctx.open({ width: ins.w, height: ins.h }, true, ua ? { userAgent: ua } : {});
    let supported = true;
    try { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: ins.top, bottom: ins.bottom, left: ins.left, right: ins.right } }); } catch { supported = false; }
    if (!supported) { console.log('  this Chromium cannot emulate safe-area insets (Emulation.setSafeAreaInsetsOverride): not tested'); await close(); continue; }
    await page.goto(link(FAM)); await wait(page);
    const edge = (rr: any) => ({ top: rr.top >= ins.top - 0.5, left: rr.left >= ins.left - 0.5, right: rr.right <= ins.w - ins.right + 0.5, bottom: rr.bottom <= ins.h - ins.bottom + 0.5 });
    const inside = async (sel: string) => page.evaluate((s: string) => { const out: any[] = []; for (const e of Array.from(document.querySelectorAll(s))) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) out.push({ top: r.top, left: r.left, right: r.right, bottom: r.bottom }); } return out; }, sel);
    const all = async (sel: string, what: string) => { const rs = await inside(sel); ok(rs.length > 0 && rs.every(r => Object.values(edge(r)).every(Boolean)), `${what} keeps out of the insets (${rs.map(r => `${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}`).join(' ')})`); };
    await all('.vh-top > *', 'the top bar'); await all('.vh-dock', 'the dock'); await all('.vh-fiction', 'the home\'s label'); await all('.st-start-card', 'the start card');
    await page.locator('.st-start .st-primary').tap(); await sleep(800);
    await page.waitForFunction(() => { const c = document.querySelector('.st-card') as HTMLElement | null; return !!c && !c.hidden; }, null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(async () => { await (window as any).__houseStory.measure(5); });
    await all('.st-card', 'a beat\'s card');
    await page.locator('.st-btn-chapters').tap(); await sleep(500); await all('.st-chapters', 'the chapters panel'); await page.locator('.st-btn-chapters').tap(); await sleep(300);
    await page.evaluate(async () => { await (window as any).__houseStory.measureEnd(); }); await sleep(300); await all('.st-end', 'the end card');
    await page.locator('[data-act="more"]').tap(); await sleep(400); await all('.vh-tools', 'the More sheet');
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''}`);
    await close();
  }

  // ================================================================== P6 reduced motion
  {
    console.log('\nP6 reduced motion on a phone');
    const { page, errors, close } = await ctx.open({ width: 360, height: 640 }, true, { reducedMotion: 'reduce', ...(ua ? { userAgent: ua } : {}) });
    await page.goto(link(FAM)); await wait(page);
    await page.locator('.st-start .st-primary').tap(); await sleep(1200);
    const rm = await page.evaluate(async () => {
      const api = (window as any).__houseStory; await api.measure(4);
      const c = document.querySelector('.st-card') as HTMLElement, cs = getComputedStyle(c), say = c.querySelector('.st-say') as HTMLElement | null;
      const scrolls = c.scrollHeight > c.clientHeight + 1, t0 = c.scrollTop;
      return { dur: cs.transitionDuration, anim: say ? getComputedStyle(say).animationName : 'none', scrolls, t0, state: api.state };
    });
    await sleep(2500);
    const t1 = await page.evaluate(() => (document.querySelector('.st-card') as HTMLElement).scrollTop);
    ok(/^0s(, 0s)*$/.test(rm.dur), `reduced motion: the sheet has no transition (${rm.dur})`);
    ok(rm.anim === 'none' || rm.anim === '', `reduced motion: the agent's line has no entrance animation (${rm.anim})`);
    ok(t1 === rm.t0, `reduced motion: a sheet taller than its room does not scroll by itself (${rm.scrolls ? 'it scrolls: ' : 'it fits: '}${rm.t0} then ${t1})`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''}`);
    await close();
  }

  // ================================================================== P9 the kill switch of the picture's shift
  if (shifted.length === 2) {
    console.log('\nP9 ?no=shift');
    const { page, errors, close } = await ctx.open({ width: 390, height: 844 }, true, ua ? { userAgent: ua } : {});
    await page.goto(link(FAM, 'no=shift')); await wait(page);
    await page.locator('.st-start .st-primary').tap(); await sleep(800);
    const m = await page.evaluate(async () => { const r = await (window as any).__houseStory.measure(5); return { c: r.live ? r.live.y + r.live.h / 2 : null }; });
    const [c1, vh] = shifted;
    ok(m.c !== null && m.c - c1 > vh * 0.12 && m.c - c1 < vh * 0.22, `?no=shift: the subject of beat 6 stands ${m.c !== null ? Math.round(m.c - c1) : '?'} px lower (${m.c !== null ? ((m.c - c1) / vh * 100).toFixed(1) : '?'} % of the height; the shift is 17 %)`);
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''}`);
    await close();
  }

  // ================================================================== P8 the loader at once
  {
    console.log('\nP8 the loading card');
    const { page, errors, close } = await ctx.open({ width: 390, height: 844 }, true, ua ? { userAgent: ua } : {});
    await page.goto(link(FAM), { waitUntil: 'commit' });
    // before the player's module has loaded the page draws its own card (the head script's pseudo-elements: a mark, the home's name, the facts, a moving bar)
    let seen: any = null;
    for (let i = 0; i < 40 && !seen; i++) {
      seen = await page.evaluate(() => {
        const de = document.documentElement; if (de.dataset.viewer === 'ready' || de.dataset.viewer === 'mounted' || !document.body) return null;
        const b = getComputedStyle(document.body, '::before'), bar = getComputedStyle(document.body, '::after');
        return b.content && b.content !== 'none' && b.content !== 'normal' ? { name: b.content, bar: bar.content, boot: getComputedStyle(de).getPropertyValue('--vh-boot-name'), poster: getComputedStyle(de).getPropertyValue('--vh-poster').slice(0, 40), t: performance.now() } : null;
      }).catch(() => null);
      if (!seen) await sleep(50);
    }
    ok(!!seen && seen.t < 3000, `the loading card (the home's name, the bar) is drawn ${seen ? Math.round(seen.t) : '?'} ms in, before the player has loaded: name ${seen ? seen.name : ''}`);
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 240000 });
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''}`);
    await close();
  }
}
