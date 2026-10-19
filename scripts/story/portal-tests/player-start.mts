// The tour's way in and the tour with no voice, in a browser (scripts/test-portal.mts loads this file: every scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test` (or `-- --only hooks`) after player work
//
//   T9  the way in at a person: ?member=<id> opens at the first beat of that person's own room ("Starting with John"), an unknown id at
//       the start; the start card lists the family (a monogram, the name, the archetype word) and "Start with <name>" starts there, silent;
//       the campaign's tags (utm_*, fbclid, ...) stay in the address as the player rewrites it; the tour opens in daylight; the end card has
//       See Companion Core, the one Download link, Replay, Next family (the next family that has a tour, tags kept) and Share
//   T10 no narration yet (a family with no voice lock, which is this pass's state): the tour starts captions-only from reading-time durations
//       with no error toast, no sound button, no AudioContext and no audio request, and the card holds the beat's whole text. The audio
//       checks (T7 sound, T8, the audio 404) run for a family that has a voice and say so when none does
// (The rest of the tour, placement, keys, audio and the gesture rule, the address bar, is scripts/story/portal-tests/player.mts.)
import type { TestCtx } from '../hooks.ts';
import { memberBeat } from '../../../assets/story/url.ts';

type Page = any;

export default async function playerStart(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep, url } = ctx;
  const byFamily: Record<string, any> = (ctx.manifest as any).byFamily || {};
  const tours = Object.entries<any>(byFamily).filter(([, v]) => v && v.story).map(([slug]) => slug);
  if (!tours.length) { console.log('  no family has a tour in this build: nothing to test'); return; }
  const SLUG = tours.includes('vance-takahashi') ? 'vance-takahashi' : tours[0];
  const noTv = tours.find(s => s === 'okonkwo-reid') || tours[1];
  const second = noTv && noTv !== SLUG ? noTv : null;
  const voiced = (slug: string): boolean => Object.keys((byFamily[slug] || {}).audio || {}).length > 0;
  const VOICE = voiced(SLUG);
  const houseOf = (slug: string): string => byFamily[slug].house;
  const link = (slug: string, q = '') => url(`room-creator?mode=view&house=${houseOf(slug)}&family=${slug}${q ? '&' + q : ''}`);
  const wait = async (page: Page) => {
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' && !!(window as any).__houseStory, null, { timeout: 240000 });
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

  // ================================================================== T9 a way in at a person, the campaign's tags, daylight, the end card
  {
    console.log('\nT9 start with a person, the campaign tags, daylight, the end card');
    const TAGS = 'utm_source=meta&utm_campaign=uncloud&fbclid=zz9&ttclid=t1&gclid=g1&msclkid=m1';
    const whole = (page: Page) => page.evaluate(() => {
      const r = (window as any).__houseStory.rs;
      return { members: r.members.map((m: any) => ({ id: m.id, name: m.name, archetype: m.archetype || '' })), chapters: r.chapters.map((c: any) => ({ id: c.id, kind: c.kind, title: c.title })), beats: r.beats.map((b: any) => ({ id: b.id, chapter: b.chapter, member: b.member || '', title: b.popup.title })) };
    });
    const { page, errors, close } = await ctx.open({ width: 1440, height: 900 }, false);
    await page.goto(link(SLUG, TAGS)); await wait(page);
    const full = await whole(page);
    const own = full.members.map((m: any) => ({ ...m, at: memberBeat(full.chapters, full.beats, m.id) })).filter((m: any) => m.at >= 0);
    // the player rewrote its address when it opened the house: the campaign's tags are still in it, and the tour opens by day
    let q = new URL(page.url()).searchParams;
    ok(['utm_source', 'utm_campaign', 'fbclid', 'ttclid', 'gclid', 'msclkid'].every(k => q.has(k)) && q.get('fbclid') === 'zz9' && q.get('family') === SLUG, `the address keeps the campaign's tags as the player rewrites it (${page.url().replace(/^.*\?/, '?').slice(0, 130)})`);
    ok(q.get('tod') === 'day', `and the tour opens in daylight (tod=${q.get('tod')})`);
    // the start card lists the people, each a button with a monogram, the name and the archetype word
    const list = await page.$$eval('.st-member', (els: HTMLElement[]) => els.map(e => ({ label: e.getAttribute('aria-label') || '', name: e.querySelector('.st-member-name')?.textContent || '', role: e.querySelector('.st-member-role')?.textContent || '', disc: e.querySelector('.st-disc')?.textContent || '', h: e.getBoundingClientRect().height })));
    ok(list.length === own.length && own.every((m: any, i: number) => list[i].name === m.name && list[i].label === `Start with ${m.name}${m.archetype ? `, ${m.archetype}` : ''}` && list[i].role === m.archetype && list[i].disc === m.name[0].toUpperCase()), `the start card lists the family: ${list.map(l => l.label).join(' | ')}`);
    ok(list.every(l => l.h >= 43.5), 'each is a 44 px button');
    ok((await page.textContent('.st-start-kick')) === 'Interactive tour', 'a plain link opens the plain start card');
    // "Start with <name>": begins at the first beat of that person's own room, silent
    const pick = own[Math.min(1, own.length - 1)];
    const spy2 = await page.$(`.st-member[data-member="${pick.id}"]`);
    await spy2!.click(); await sleep(1500);
    let st = await state(page);
    const chapOf = (b: any) => full.chapters.find((c: any) => c.id === b.chapter);
    ok(st.started && st.beat === pick.at && !st.sound && !st.audioCreated, `"Start with ${pick.name}" starts the tour at beat ${pick.at + 1}, ${full.beats[pick.at].id}, in "${chapOf(full.beats[pick.at]).title}", without sound`);
    ok((await page.textContent('.st-card .st-who')) === pick.name, `and the card is ${pick.name}'s`);
    q = new URL(page.url()).searchParams;
    ok(q.get('beat') === full.beats[pick.at].id && q.get('fbclid') === 'zz9', 'the address names the beat and still carries the tags');
    // the end card: the one call to action, the one download link, replay, the next family with its tags, share
    await page.evaluate(() => (window as any).__houseStory.measureEnd()); await sleep(600);
    const end = await page.$$eval('.st-end a, .st-end button', (els: HTMLElement[]) => els.map(e => ({ t: (e.textContent || '').trim(), href: e.getAttribute('href'), h: e.getBoundingClientRect().height })));
    ok(end.filter(e => e.href === 'https://ci.computer/core' && e.t === 'See Companion Core').length === 1 && end.filter(e => e.href === 'https://ci.computer/download' && e.t === 'Download Companion').length === 1, 'the end card has See Companion Core and the one Download Companion link, exactly');
    ok(['Replay', 'Share this family'].every(t => end.some(e => e.t === t)) && end.every(e => e.h >= 43.5), `and Replay and Share, every one a 44 px target (${end.map(e => e.t).join(', ')})`);
    ok(!end.some(e => /Buy|price|\$/.test(e.t)), 'and no Buy and no price');
    const other = tours.find(t => t !== SLUG);
    ok(end.some(e => e.t === 'Next family') === !!other, `Next family is offered ${other ? `(the next tour is ${other})` : 'only when another family has a tour (none does)'}`);
    if (other) {
      await page.click('.st-end button:has-text("Next family")', { noWaitAfter: true });   // (it is a page load: the player of the next family starts after the click returns)
      await page.waitForURL((u: URL) => u.searchParams.get('family') === other, { timeout: 60000 });
      const nq = new URL(page.url()).searchParams;
      ok(nq.get('house') === houseOf(other) && nq.get('fbclid') === 'zz9' && nq.get('utm_campaign') === 'uncloud' && !nq.has('beat'), `Next family opens ${other} on ${houseOf(other)} with the tags kept and no beat of the last family`);
      await wait(page);
      ok((await page.textContent('.st-start-kick')) === 'Interactive tour' && (await page.$$('.st-member')).length > 0, 'and it opens on its own start card, with its own family');
    }
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await close();

    // ?member=<id>: the same way in from a link (the family's page links "Start with John" to it)
    {
      const o = await ctx.open({ width: 1440, height: 900 }, false);
      const m = own.find((x: any) => full.beats.findIndex((b: any) => b.member === x.id) !== x.at) || own[0];   // a person whose first beat anywhere is not in their own room, when there is one
      await o.page.goto(link(SLUG, `member=${m.id}`)); await wait(o.page);
      ok((await o.page.textContent('.st-start-kick')) === `Starting with ${m.name}` && (await o.page.textContent('.st-start .st-primary')) === (VOICE ? 'Start with narration' : 'Start the tour'), `?member=${m.id}: the start card says "Starting with ${m.name}"`);
      await o.page.locator('.st-start .st-actions .st-btn').last().click(); await sleep(1500);
      st = await state(o.page);
      ok(st.started && st.beat === m.at && chapOf(full.beats[m.at]).kind === 'room', `and the tour starts in ${m.name}'s own room, at ${full.beats[m.at].id} ("${chapOf(full.beats[m.at]).title}")`);
      ok((await o.page.textContent('.st-card .st-who')) === m.name, `with ${m.name}'s card up`);
      ok(o.errors.length === 0 && !(await o.page.evaluate(() => document.querySelector('.vh-toast')?.textContent || '')), 'no console error and no toast');
      await o.close();
      // an unknown member, a member with no beat, and ?beat= over ?member=
      for (const [qs, kick, at] of [['member=nobody', 'Interactive tour', 0], [`member=${m.id}&beat=${full.beats[3].id}`, 'A shared moment', 3]] as [string, string, number][]) {
        const p = await ctx.open({ width: 1440, height: 900 }, false);
        await p.page.goto(link(SLUG, qs)); await wait(p.page);
        ok((await p.page.textContent('.st-start-kick')) === kick, `?${qs}: the start card reads "${kick}"`);
        await p.page.locator('.st-start .st-actions .st-btn').last().click(); await sleep(1200);
        ok((await state(p.page)).beat === at, `and the tour starts at beat ${at + 1}`);
        await p.close();
      }
    }
    // the hour is the link's when the link asks for one, and otherwise the day, whatever hour the home was written in
    for (const [slug, tod] of [[SLUG, ''], ...(second ? [[second, '']] : []), [SLUG, 'tod=golden']] as [string, string][]) {
      const o = await ctx.open({ width: 1440, height: 900 }, false);
      await o.page.goto(link(slug, tod)); await wait(o.page);
      const got = new URL(o.page.url()).searchParams.get('tod');
      ok(got === (tod ? 'golden' : 'day'), `${slug}${tod ? ` ?${tod}` : ''}: the tour opens at tod=${got}`);
      await o.close();
    }
  }

  // ================================================================== T10 no narration yet: the captions-only tour
  {
    const cap = tours.find(t => !voiced(t));
    console.log(`\nT10 captions only${cap ? `, ${cap}` : ''}`);
    if (!cap) { console.log('  every family with a tour has a voice: nothing to test'); }
    else {
      const m = (ctx.manifest as any).byFamily[cap];
      ok(m.narration === false && Object.keys(m.audio || {}).length === 0, `the manifest says narration: false for ${cap}, with no clip`);
      const { page, errors, requests, close } = await ctx.open({ width: 1440, height: 900 }, false);
      await spy(page);
      await page.goto(link(cap)); await wait(page);
      const info = await page.evaluate(() => ({ actions: Array.from(document.querySelectorAll('.st-start .st-actions .st-btn')).map(b => b.textContent), fine: Array.from(document.querySelectorAll('.st-fine li')).map(l => l.textContent), sound: !!document.querySelector('.st-btn-sound:not([hidden])'), mode: (window as any).__houseStory.rs.durations, audio: Object.keys((window as any).__houseStory.rs.audio).length, dur: (window as any).__houseStory.rs.duration }));
      ok(info.actions.length === 1 && info.actions[0] === 'Start the tour', `the start card has one button, "${info.actions.join(' | ')}": no sound to choose`);
      ok(!info.fine.some((l: string) => /Narration is generated/.test(l)) && info.fine.length === 3, 'and its fine print says nothing of a voice (three lines)');
      ok(info.mode === 'estimated' && info.audio === 0 && info.dur > 60, `the tour runs from reading-time durations (${info.mode}, ${Math.round(info.dur)} s, ${info.audio} clips)`);
      ok(!info.sound, 'there is no sound button');
      await page.click('.st-start .st-primary');
      const probe = () => page.evaluate(() => { const w = window as any; return { ac: w.__ac, src: w.__src, play: w.__play, toast: document.querySelector('.vh-toast')?.textContent || '', playing: !!w.__houseViewer.playing, text: (document.querySelector('.st-card .st-body')?.textContent || '').length, shown: !!document.querySelector('.st-card:not([hidden])') }; });
      let c = await probe();
      for (let k = 0; k < 40 && !(c.playing && c.shown && c.text > 20); k++) { await sleep(250); c = await probe(); }   // (a slow machine takes a few seconds to draw a first frame)
      await sleep(1500); c = await probe();
      const started = await state(page);
      ok(started.started && c.playing && c.shown && c.text > 20, `it starts and plays, with the beat's whole text on the card (${JSON.stringify({ started: started.started, playing: c.playing, shown: c.shown, text: c.text })})`);
      ok(c.toast === '' && c.ac === 0 && c.src === 0 && c.play === 0 && !requests.some((u: string) => /\.m4a/.test(u)), 'no error toast, no AudioContext, no audio request');
      await page.keyboard.press('m'); await sleep(300);
      ok(!(await state(page)).sound && !(await page.evaluate(() => document.querySelector('.vh-toast')?.textContent || '')), 'M says nothing and turns nothing on');
      // it reaches the end by itself (reading time, not a voice): jump near the end and wait for the end card
      await page.evaluate(() => { const c = (window as any).__houseViewer.control; c.seek(0.985); c.setPlaying(true); });
      await page.waitForSelector('.st-end:not([hidden])', { timeout: 90000 });
      ok(await page.isVisible('.st-end'), 'and it reaches its own end card');
      ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
      await close();
    }
  }
}
