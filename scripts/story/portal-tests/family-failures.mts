// When the tour cannot start, the family's story is still there to read (scripts/test-portal.mts loads this file: every
// scripts/story/portal-tests/*.mts is a hook).
// @check-house skip — it tests dist/, which `pnpm run portal:build` makes; run `pnpm run portal:test` (or `-- --only hooks`) after story work
//
//   a link that asks for a family's tour (&family=<slug>) and cannot start (no WebGL 2, a module that did not download) ends on the player's
//   failure card, never an endless loader, and the card has one more button, "Read the family's story", a 44 px target that goes to
//   family/<slug>; with no WebGL 2 it is the first (the primary) button, since Try again could not help. A link with no family has no such
//   button, and a family that is not the shape a slug has is not linked.
//   The drawing context taken back after the player has started (a GPU reset, a phone that gave its graphics memory away) ends on the same
//   card after six seconds of looking at the page, and not at all when the browser gives it back first. Nothing here touches the renderer.
import type { TestCtx } from '../hooks.ts';

export default async function familyFailures(ctx: TestCtx): Promise<void> {
  const { check: ok, sleep } = ctx;
  const by: Record<string, { house: string; story?: string }> = (ctx.manifest as any).byFamily || {};
  const slug = Object.keys(by).find(s => by[s].story) || Object.keys(by)[0];
  console.log('\nthe family story on the failure card');
  if (!slug) { console.log('  no family has a page in this build: nothing to test'); return; }
  const house = by[slug].house;
  const player = (q = '') => ctx.url(`room-creator?mode=view&house=${house}${q}`);
  const noGl2 = (page: any) => page.addInitScript(() => {
    const g = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as any).getContext = function (t: string, ...a: any[]) { return t === 'webgl2' ? null : (g as any).call(this, t, ...a); };
  });
  const card = async (page: any) => page.evaluate(() => {
    const box = document.querySelector('.vh-fail'), story = box?.querySelector<HTMLAnchorElement>('a.vh-fail-story');
    return {
      state: document.documentElement.dataset.viewer || '', title: box?.querySelector('h2')?.textContent || '',
      actions: Array.from(box?.querySelectorAll('.vh-fail-actions > *') || []).map(e => (e.textContent || '').trim()),
      story: story ? { text: (story.textContent || '').trim(), href: story.getAttribute('href'), h: story.getBoundingClientRect().height, first: story === story.parentElement!.firstElementChild, bg: getComputedStyle(story).backgroundColor } : null,
    };
  });

  // no WebGL 2, with the family in the link
  {
    const { page, close } = await ctx.open({ width: 390, height: 844 }, true);
    await noGl2(page);
    await page.goto(player(`&family=${slug}`));
    await page.waitForSelector('.vh-fail', { timeout: 30000 });
    const c = await card(page);
    ok(c.state === 'no-webgl' && c.story && c.story.text === "Read the family's story" && c.story.href === `./family/${slug}`, `no WebGL 2, ?family=${slug}: the card offers "Read the family's story" to family/${slug} (${c.actions.join(' | ')})`);
    ok(c.story && c.story.h >= 43.5 && c.story.first && c.actions[c.actions.length - 1] === 'See all homes', 'it is a 44 px target, the first (primary) button, and See all homes is still there');
    await ctx.shot(page, 'failure-nowebgl-family');
    await page.click('a.vh-fail-story');
    await page.waitForURL(new RegExp(`family/${slug}$`), { timeout: 30000 });
    ok((await page.textContent('h1')) !== null && (await page.isVisible('.hero-actions .btn-primary')), 'and it opens the family page, which is whole without any 3D');
    await close();
  }
  // no family in the link: the card is the player's own; a "family" that is not a slug is not linked
  for (const q of ['', '&family=..%2F..%2Fx', '&family=Brennan', '&family=a-b-c-d']) {
    const { page, close } = await ctx.open({ width: 1280, height: 800 });
    await noGl2(page);
    await page.goto(player(q));
    await page.waitForSelector('.vh-fail', { timeout: 30000 });
    const c = await card(page);
    ok(c.state === 'no-webgl' && c.story === null && c.actions.join() === 'See all homes', `no WebGL 2, ${q ? q.slice(1) : 'no family'}: no story button, just See all homes`);
    await close();
  }
  // a module that does not download: Try again, the story, See all homes, in that order
  {
    const { page, close } = await ctx.open({ width: 1280, height: 800 });
    await page.route((u: URL) => u.pathname.endsWith('/assets/viewer.js'), (r: any) => r.abort());
    await page.goto(player(`&family=${slug}`));
    await page.waitForSelector('.vh-fail', { timeout: 60000 });
    const c = await card(page);
    ok(c.state === 'failed' && c.actions.join() === `Try again,Read the family's story,See all homes` && c.story && c.story.h >= 43.5, `a module that does not download: ${c.actions.join(' | ')}`);
    await close();
  }
  // the drawing context taken back after the player started
  {
    const { page, close } = await ctx.open({ width: 1280, height: 800 });
    await page.goto(player(`&family=${slug}`));
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 240000 });
    await sleep(500);
    ok(!(await page.$('.vh-fail')), 'the player is up and there is no failure card');
    const lost = await page.evaluate(() => {
      const gl = (document.querySelector('canvas') as HTMLCanvasElement).getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_lose_context');
      if (!gl || !ext) return false;
      ext.loseContext(); (window as any).__ext = ext;
      return gl.isContextLost();
    });
    ok(lost, 'the drawing context is taken away');
    await sleep(6600);
    const c = await card(page);
    ok(c.state === 'failed' && c.title === 'The 3D view stopped.' && c.actions[0] === 'Try again' && c.story?.href === `./family/${slug}`, `after six seconds the card says "${c.title}" and offers ${c.actions.join(' | ')}`);
    await ctx.shot(page, 'failure-contextlost-family');
    await close();
  }
  // ... and not when the browser gives it back in time
  {
    const { page, close } = await ctx.open({ width: 1280, height: 800 });
    await page.goto(player(`&family=${slug}`));
    await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready', null, { timeout: 240000 });
    await sleep(500);
    await page.evaluate(() => {
      const gl = (document.querySelector('canvas') as HTMLCanvasElement).getContext('webgl2'), ext = gl!.getExtension('WEBGL_lose_context')!;
      ext.loseContext(); setTimeout(() => ext.restoreContext(), 1200);
    });
    await sleep(8000);
    const c = await card(page);
    ok(c.title === '' && c.state === 'ready', `the context given back within the six seconds: no card, the player carries on (${c.state})`);
    await close();
  }
}
