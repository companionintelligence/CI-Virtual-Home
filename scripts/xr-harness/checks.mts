// Checks that more than one case runs, written once: T-LAZY runs checkLazy on the real dist, and the harness self-test runs it on
// fake trees (fake-xr.mts) that are lazy (it must pass) and eager / heavy / fetching from a CDN (it must fail, each for its own reason).
import { Fail, foreign, openPage, enterSession, endSession, tickFrames, findEnterButton, hasProductXr, xrRequests, rel, textWeight, sleep, type Ctx, type Tree, type Req } from './lib.mts';

/** assets/xr/ and its dependencies a session may legitimately pull in; anything else new after the tap is not an XR module. */
const XR_OK = /^(assets\/xr\/|assets\/platform[^/]*\.js$|assets\/vendor\/three\/webxr\/)/;
export const WEIGHT_BUDGET_BYTES = 1500;     // gzip, entry.js and whatever else loads for XR at first player load

export interface LazyResult { entryLoaded: boolean; firstLoadXr: string[]; afterTapXr: string[]; deltaBytes: number; weightXr: number; weightNoXr: number }

async function settleAfterReady(ms = 1200) { await sleep(ms); }

/** The four promises of N7 plus the landing page's zero. Throws Fail on the first broken one, naming the URLs. */
export async function checkLazy(t: Ctx, tree: Tree, o: { house?: string } = {}): Promise<LazyResult> {
  const house = o.house || t.house;
  const browser = null; void browser;
  // 1. first player load: the entry may mount, the session may not load
  const a = await t.open({ kind: 'player', tree, house });
  await settleAfterReady();
  const first = xrRequests(tree, a.requests).map(r => rel(tree, r.url).split('?')[0]);
  const sessionEarly = first.filter(f => /^assets\/xr\/session/.test(f));
  if (sessionEarly.length) throw new Fail(`the first player load requested ${sessionEarly.join(', ')}: the session module must wait for the Enter VR tap`);
  const heavyEarly = first.filter(f => !/^assets\/xr\/(entry|style|types|host)\.js$/.test(f));
  if (heavyEarly.length) throw new Fail(`the first player load requested XR modules beyond the entry: ${heavyEarly.join(', ')}`);
  const entryLoaded = first.includes('assets/xr/entry.js');
  if (tree.hasXr && !entryLoaded) throw new Fail('the tree has assets/xr/ but the first player load never requested assets/xr/entry.js: no Enter VR button can appear');
  const weightXr = textWeight(tree, a.requests).total;

  // 2. ?no=xr: nothing under assets/xr/, no API, no button
  const b = await t.open({ kind: 'player', tree, house, query: 'no=xr' });
  await settleAfterReady();
  const killed = xrRequests(tree, b.requests).map(r => rel(tree, r.url));
  if (killed.length) throw new Fail(`with ?no=xr the page requested ${killed.join(', ')}`);
  if (await hasProductXr(b)) throw new Fail('with ?no=xr window.__houseViewer.xr exists');
  if (await findEnterButton(b)) throw new Fail('with ?no=xr an Enter VR button exists');
  const weightNoXr = textWeight(tree, b.requests).total;
  await b.close();

  // 3. the tap: exactly the XR modules load, from this origin
  if (!(await hasProductXr(a, 10000))) throw new Fail('after the first load window.__houseViewer.xr is missing (the entry never mounted)');
  const m = a.mark();
  const e = await enterSession(a, { driver: 'session' });
  await tickFrames(a, 30);
  const after = a.since(m);
  const afterXr = xrRequests(tree, after).map(r => rel(tree, r.url).split('?')[0]);
  if (!afterXr.some(f => /^assets\/xr\/session/.test(f))) throw new Fail(`after the Enter VR tap no assets/xr/session*.js was requested (got: ${afterXr.join(', ') || 'nothing under assets/xr/'})`);
  const out = foreign(after, tree.srv.origin);
  if (out.length) throw new Fail(`after the tap the page asked another origin: ${out.map(r => r.url).join(', ')}`);
  const stray = after.filter((r: Req) => r.url.startsWith(tree.srv.origin) && /\.(js|mjs)(\?|$)/.test(r.url) && !XR_OK.test(rel(tree, r.url)));
  if (stray.length) throw new Fail(`after the tap these scripts loaded that are not XR modules: ${stray.map(r => rel(tree, r.url)).join(', ')}`);
  await endSession(a, e);
  await a.close();

  // 4. weight: what XR adds to the FIRST load (the entry, and anything else that loads before a tap), gzip
  const delta = weightXr - weightNoXr;
  if (delta > WEIGHT_BUDGET_BYTES) throw new Fail(`XR adds ${delta} bytes (gzip) to the first player load, over the ${WEIGHT_BUDGET_BYTES} byte budget`);
  return { entryLoaded, firstLoadXr: first, afterTapXr: afterXr, deltaBytes: delta, weightXr, weightNoXr };
}

/** The gallery and the editor never load platform.js or anything under assets/xr/ (landing weight 0; N4, N5, N8). */
export async function checkNoXrOnPages(t: Ctx, tree: Tree): Promise<{ gallery: number; editor: number }> {
  const g = await t.open({ kind: 'gallery', tree });
  await sleep(800);
  const gal = g.requests.filter(r => /\/assets\/(xr\/|platform[^/]*\.js)/.test(r.url));
  if (gal.length) throw new Fail(`the gallery page loaded ${gal.map(r => rel(tree, r.url)).join(', ')}: the landing page carries no platform.js and no XR code`);
  return { gallery: g.requests.length, editor: 0 };
}

/** Run a check that MUST fail (a negative control) and make sure it failed for the stated reason, not for some other one. */
export async function expectFail(what: string, re: RegExp, fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); } catch (e: any) {
    if (!(e instanceof Fail)) throw e;
    if (!re.test(e.message)) throw new Fail(`NEGATIVE CONTROL "${what}" failed for the wrong reason: ${e.message}`);
    return e.message;
  }
  throw new Fail(`NEGATIVE CONTROL FAILED: "${what}" passed, the check cannot fail`);
}
