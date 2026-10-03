// T-X7 : the site asks no third party for anything, and that includes a headset session. Controller models normally come from
// cdn.jsdelivr.net (three's XRControllerModelFactory fetches webxr-input-profiles from there at runtime): this site draws its own.
// Zero requests outside the page's origin during the whole player load and the session, and none to cdn.jsdelivr.net.
// @check-house skip — needs the built dist and a GPU browser; run pnpm run xr:test
import fs from 'node:fs';
import path from 'node:path';
import { defineCase, enterSession, endSession, tickFrames, foreign, sleep, type Req } from '../xr-harness/lib.mts';

const THIRD_PARTY_HOSTS = /(^|\.)(jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|githubusercontent\.com|gstatic\.com|googleapis\.com|github\.io)$/;
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return ''; } };

export const network = defineCase({
  id: 'T-X7', title: 'zero requests outside the origin while loading the player and during a session; none to cdn.jsdelivr.net',
  async run(t) {
    const tree = await t.tree('dist');
    const p = await t.open({ kind: 'player', tree });
    const loadAll = p.requests.length;
    const f0 = foreign(p.requests, tree.srv.origin);
    t.check(f0.length === 0, `${f0.length} request(s) outside the origin while the player loaded: ${f0.slice(0, 3).map(r => r.url).join(' ')}`);

    const m = p.mark();
    const e = await enterSession(p);
    await tickFrames(p, 90);
    // use it: a trigger pull and a thumbstick push on whatever the session built (controller models, rays, panels, menus)
    await p.page.evaluate(async () => { const d = (window as any).__xrdev; if (d.controllers && d.controllers.right) { await d.remote.dispatch('select', { device: 'controller-right', duration: 0.1 }); d.controllers.right.updateAxes && d.controllers.right.updateAxes('thumbstick', 0, -1); } });
    await sleep(300);
    await p.page.evaluate(() => { const d = (window as any).__xrdev; if (d.controllers && d.controllers.right && d.controllers.right.updateAxes) d.controllers.right.updateAxes('thumbstick', 0, 0); });
    await tickFrames(p, 30);
    await endSession(p, e);
    await sleep(300);
    const during = p.since(m);
    const out = foreign(during, tree.srv.origin);
    t.check(out.length === 0, `${out.length} request(s) outside the origin during the session: ${out.slice(0, 3).map(r => r.url).join(' ')}`);
    const cdn = p.requests.filter(r => /jsdelivr/i.test(r.url));
    t.check(cdn.length === 0, `a request to jsdelivr: ${cdn[0] && cdn[0].url}`);
    const third = p.requests.filter(r => THIRD_PARTY_HOSTS.test(hostOf(r.url)));
    t.check(third.length === 0, `a request to a known third-party host: ${third[0] && third[0].url}`);
    t.note('driver', e.driver); t.note('requestsOnLoad', loadAll); t.note('requestsInSession', during.length);

    // the dist's headers must not switch WebXR off for the page (N4): a Permissions-Policy that lists xr-spatial-tracking must grant it
    const hp = path.join(tree.dir, '_headers');
    if (fs.existsSync(hp)) {
      const h = fs.readFileSync(hp, 'utf8');
      const pp = h.split('\n').filter(l => /permissions-policy/i.test(l) && /xr-spatial-tracking/i.test(l));
      t.check(pp.every(l => !/xr-spatial-tracking\s*=\s*\(\s*\)/i.test(l)), `_headers disables xr-spatial-tracking: ${pp[0]}`);
    }

    // NEGATIVE CONTROL: the check must see a request the code should never make (blocked before it leaves the machine)
    const m2 = p.mark();
    const outcome = await p.page.evaluate(async () => { try { await fetch('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/webxr/XRControllerModelFactory.js'); return 'fetched'; } catch (err) { return 'blocked'; } });
    await sleep(200);
    p.expect(/Failed to load resource|ERR_BLOCKED|jsdelivr/i);
    const seen: Req[] = foreign(p.since(m2), tree.srv.origin);
    t.check(seen.length === 1 && /jsdelivr/.test(seen[0].url), 'NEGATIVE CONTROL FAILED: a fetch to cdn.jsdelivr.net was not seen by the third-party check');
    t.check(outcome === 'blocked', 'the harness let a third-party request reach the network');
    t.note('controlSeen', seen.map(r => hostOf(r.url)));
  },
});
