#!/usr/bin/env -S node --experimental-strip-types
// Live check for the "ao" realism feature: the baked ambient-occlusion volume and the contact shadows
// (assets/realism-ao.ts, viewer-ao.ts, viewer-contact.ts, scripts/bake-ao.mts).
//
//   node --experimental-strip-types scripts/live-checks/ao.mts [--house aurora,cocoon] [--all] [--baseline <checkout>] [--root <dir>]
//
//   --all        open every house (30) instead of the default five
//   --baseline   a checkout of the tree BEFORE this feature (03edd3b, built): with ?no=ao,contact this tree must draw the
//                same pixels as it does (the kill switch changes nothing)
//
// What it proves, each with a ✓ / ✗ line:
//   switch      ?no=ao and ?no=contact leave no trace: no define on any material, no contact mesh, the shader chunks
//               untouched, and the baseline's pixels (with --baseline)
//   restore     with the feature on, taking it back the way the page's __houseRender* hooks do (viewer.beforeExternalRender)
//               gives the exact pixels of a page that never had it, and giving it back (afterExternalRender) restores it
//   volume      the five heavy houses (or all) open with the volume on, from exactly the manifest and the one file it lists;
//               ?no=batch, ?no=glass and the four hours of the day do not change the fingerprint (the volume is still used)
//   failure     a deleted or unreadable .bin, a 404 manifest, and a stale volume (a manifest whose fingerprint is not the
//               tree's) load throw-free and draw without AO
//   bake        the bake is byte-identical for 1 and 6 workers and across reruns, and `--check` calls a changed manifest stale
//   guard       the portal's file check (scripts/ao-files.mts) fails an unlisted, a missing and a mis-hashed volume
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const args: Record<string, string> = {};
argv.forEach((a, i) => { if (a.startsWith('--')) args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'; });
const ROOT = path.resolve(args.root || path.join(import.meta.dirname, '..', '..'));
const { loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts, houseIds } = await import(path.join(ROOT, 'scripts', 'portal-lib.mts'));
const { aoProblems } = await import(path.join(ROOT, 'scripts', 'ao-files.mts'));

const HOUSES: string[] = args.all ? houseIds() : (args.house || 'aurora,cocoon,lakecabin,mirage,vanilla').split(',').filter(Boolean);
let passes = 0, failures = 0;
const ok = (cond: unknown, what: string) => { if (cond) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${what}`); } else { failures++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };
const sha = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);

/** `pnpm run test:live` imports this file: run the standalone check in a child process and report its ✓ / ✗ lines */
export default async function check(env: { ROOT: string; base: { dir?: string } | null }): Promise<{ name: string; ok: boolean; detail?: string }[]> {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', import.meta.filename, '--root', env.ROOT, ...(args.all ? ['--all'] : [])], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 1800000 });
  const out: { name: string; ok: boolean; detail?: string }[] = [];
  for (const line of (r.stdout || '').split('\n')) {
    const m = /^\s*(?:\x1b\[\d+m)*(✓|✗)\s*(.*?)(?:\x1b\[\d+m)*$/.exec(line);
    if (m) out.push({ name: m[2].replace(/\x1b\[\d+m/g, ''), ok: m[1] === '✓' });
  }
  if (r.status !== 0 && !out.some(o => !o.ok)) out.push({ name: `ao live check exited ${r.status}`, ok: false, detail: (r.stderr || r.stdout || '').slice(-300) });
  if (!out.length) out.push({ name: 'ao live check printed nothing', ok: false });
  return out;
}
if (path.resolve(process.argv[1] || '') === import.meta.filename) await standalone();

async function standalone(): Promise<void> {
const srv = await serve(ROOT, '/');
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: LAUNCH_ARGS });
let base: Awaited<ReturnType<typeof serve>> | null = null;
if (args.baseline) base = await serve(path.resolve(args.baseline), '/');

type Page = { page: any; errors: string[]; requests: string[]; close: () => Promise<void> };
async function open(server: typeof srv, house: string, query: string, route?: (page: any) => Promise<void>, shot = 'door-to-core'): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(`page error: ${e.message.split('\n')[0]}`));
  page.on('console', (m: any) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`); });
  page.on('request', (r: any) => requests.push(r.url()));
  await stubGoogleFonts(page, server.origin);
  if (route) await route(page);
  await page.goto(`${server.url('room-creator.html')}?mode=view&house=${house}&shot=${shot}&t=0.5&play=0${query ? '&' + query : ''}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => document.documentElement.dataset.viewer === 'ready' || document.querySelector('.vh-error:not([hidden])') !== null, null, { timeout: 240000 });
  return { page, errors, requests, close: () => ctx.close() };
}
const realism = (page: any) => page.evaluate(() => { const r = (window as any).__houseViewer?.effects?.features; return r && r.ao ? JSON.parse(JSON.stringify(r.ao)) : null; });
const defineCount = (page: any) => page.evaluate(() => { let n = 0; (window as any).__houseDebug().scene.traverse((o: any) => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.defines && 'VH_AO' in m.defines) n++; }); return n; });
const hasContact = (page: any) => page.evaluate(() => { let n = 0; (window as any).__houseDebug().scene.traverse((o: any) => { if (o.userData && o.userData.contact) n++; }); return n; });
const chunksTouched = (page: any) => page.evaluate(() => !!(window as any).__THREE.ShaderChunk.__vhAoShared);
/** the pixels of one plain render from the player's camera, after the page has settled (a PNG data URL) */
async function pixels(page: any, external: boolean): Promise<string> {
  return page.evaluate(async (external: boolean) => {
    const v = (window as any).__houseViewer, d = (window as any).__houseDebug();
    if (external) v.external.before();
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    d.renderer.render(d.scene, d.camera);
    const url = d.renderer.domElement.toDataURL('image/png');
    if (external) v.external.after();
    return url;
  }, external);
}

try {
  // ------------------------------------------------------------------ switch
  console.log('\nswitch');
  {
    const h = HOUSES[0];
    const off = await open(srv, h, 'no=ao,contact');
    ok((await defineCount(off.page)) === 0 && (await hasContact(off.page)) === 0 && !(await chunksTouched(off.page)), `?no=ao,contact on ${h}: no define, no contact mesh, shader chunks untouched`);
    ok(!off.requests.some(u => u.includes('/content/ao/')), 'and nothing is downloaded from content/ao/');
    const offPx = await pixels(off.page, true);
    ok(off.errors.length === 0, `no errors${off.errors.length ? ': ' + off.errors.join(' | ') : ''}`);
    await off.close();
    const noAo = await open(srv, h, 'no=ao');
    ok((await defineCount(noAo.page)) === 0 && (await hasContact(noAo.page)) === 0, '?no=ao alone takes the contact shadows with it (they are one feature)');
    await noAo.close();
    const noContact = await open(srv, h, 'no=contact');
    ok((await defineCount(noContact.page)) > 50 && (await hasContact(noContact.page)) === 0, '?no=contact keeps the volume and drops the pads');
    await noContact.close();
    if (base) {
      const b = await open(base, h, '');
      const bPx = await pixels(b.page, false);
      await b.close();
      const mine = await open(srv, h, 'no=ao,contact');
      const mPx = await pixels(mine.page, false);
      await mine.close();
      ok(bPx === mPx, `?no=ao,contact draws the baseline's pixels (${sha(bPx)} / ${sha(mPx)})`);
    } else console.log('  (no --baseline: the pixel identity against the pre-feature tree was not run)');

    // ------------------------------------------------------------------ restore
    console.log('\nrestore');
    const on = await open(srv, h, '');
    const onPx = await pixels(on.page, false);
    ok((await defineCount(on.page)) > 50 && (await hasContact(on.page)) === 1, `the feature is on in a default load (${await defineCount(on.page)} materials, contact mesh in)`);
    ok(onPx !== offPx, 'and it changes the picture');
    const within = await pixels(on.page, true);
    ok(within === offPx, `taken back for an external render the frame is the one of a page that never had it (${sha(within)} / ${sha(offPx)})`);
    ok((await defineCount(on.page)) > 50 && (await hasContact(on.page)) === 1, 'and it is back after the render');
    const again = await pixels(on.page, false);
    ok(again === onPx, 'with the same picture as before (restore and apply lose nothing)');
    await on.page.evaluate(() => { const v = (window as any).__houseViewer; v.external.before(); });
    ok((await defineCount(on.page)) === 0 && (await hasContact(on.page)) === 0, 'during an external render no material has the define and the pads are out of the scene');
    await on.page.evaluate(() => { (window as any).__houseViewer.external.after(); });
    ok(on.errors.length === 0, `no errors${on.errors.length ? ': ' + on.errors.join(' | ') : ''}`);
    await on.close();
  }

  // ------------------------------------------------------------------ volume
  console.log('\nvolume');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'ao', 'manifest.json'), 'utf8'));
  for (const id of HOUSES) {
    const p = await open(srv, id, '');
    const st = await realism(p.page);
    const asked = p.requests.filter(u => u.includes('/content/ao/')).map(u => u.slice(u.indexOf('/content/ao/') + 12));
    const want = manifest.houses[id] && manifest.houses[id].file;
    ok(st && st.volume === 'on' && asked.length === 2 && asked.includes('manifest.json') && asked.includes(want), `${id}: volume on from ${want}${st ? ` (${st.volumeMs} ms, ${st.ao ? st.ao.materials : '?'} materials${st.contact ? `, ${st.contact.items} pads` : ''})` : ''}`);
    ok(p.errors.length === 0, `${id}: no errors${p.errors.length ? ': ' + p.errors.join(' | ') : ''}`);
    await p.close();
  }
  // the state the page leaves the house in at install depends on the shot it opens on (ceilings on or off, a wall mode): the volume must not
  for (const id of [HOUSES[0], 'mirage'].filter((v, i, a) => a.indexOf(v) === i && houseIds().includes(v))) for (const shot of ['orbit', 'door-to-core', 'hero-reveal', 'walkthrough', 'core-orbit']) {
    const p = await open(srv, id, '', undefined, shot);
    const st = await realism(p.page);
    ok(st && st.volume === 'on', `${id} opened on ${shot}: the volume is used (${st && st.volume})`);
    await p.close();
  }
  for (const [label, q] of [['?no=batch', 'no=batch'], ['?no=glass', 'no=glass'], ['night', 'tod=night'], ['dusk', 'tod=dusk'], ['golden', 'tod=golden']] as const) {
    const id = HOUSES[Math.min(1, HOUSES.length - 1)];
    const p = await open(srv, id, q);
    const st = await realism(p.page);
    ok(st && st.volume === 'on', `${id} ${label}: the fingerprint still matches (volume ${st && st.volume})`);
    await p.close();
  }

  // ------------------------------------------------------------------ failure
  console.log('\nfailure');
  {
    const id = HOUSES[0];
    const cases: [string, (page: any) => Promise<void>, string][] = [
      ['a deleted .bin', async page => { await page.route('**/content/ao/*.bin', (r: any) => r.fulfill({ status: 404, body: 'gone' })); }, 'none'],
      ['a 404 manifest', async page => { await page.route('**/content/ao/manifest.json', (r: any) => r.fulfill({ status: 404, body: 'gone' })); }, 'none'],
      ['a truncated .bin', async page => { await page.route('**/content/ao/*.bin', async (r: any) => { const res = await r.fetch(); const b = await res.body(); await r.fulfill({ status: 200, body: b.subarray(0, 100) }); }); }, 'error'],
      ['a stale volume', async page => { await page.route('**/content/ao/manifest.json', async (r: any) => { const res = await r.fetch(); const m = await res.json(); for (const e of Object.values<any>(m.houses)) e.fp.n += 5; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m) }); }); }, 'stale'],
    ];
    for (const [label, route, expect] of cases) {
      const p = await open(srv, id, '', route);
      const st = await realism(p.page);
      const n = await defineCount(p.page);
      ok(!p.errors.some(e => e.startsWith('page error')) && n === 0 && (!st || st.volume === expect), `${label}: the player opens, no uncaught error, no AO (volume: ${st ? st.volume : 'feature absent'}, ${n} defines)`);
      await p.close();
    }
  }

  // ------------------------------------------------------------------ bake
  console.log('\nbake');
  {
    const id = 'cutestarter';
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-live-'));
    const run = (workers: number, dir: string) => spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'bake-ao.mts'), '--house', id, '--workers', String(workers), '--out-dir', dir, '--quiet'], { encoding: 'utf8' });
    const outs: string[] = [];
    for (const [i, w] of [1, 6, 6].entries()) {
      const dir = path.join(tmp, `r${i}`);
      const r = run(w, dir);
      if (r.status !== 0) { ok(false, `bake with ${w} workers exited ${r.status}: ${(r.stderr || r.stdout).slice(0, 200)}`); break; }
      outs.push(sha(Buffer.concat(fs.readdirSync(dir).sort().map(f => fs.readFileSync(path.join(dir, f))))));
    }
    ok(outs.length === 3 && outs[0] === outs[1] && outs[1] === outs[2], `1 worker, 6 workers and a rerun give the same bytes (${outs.join(' / ')})`);
    const committed = manifest.houses[id];
    const fresh = JSON.parse(fs.readFileSync(path.join(tmp, 'r1', 'manifest.json'), 'utf8')).houses[id];
    ok(committed && fresh && committed.file === fresh.file, `and they are the committed file (${committed && committed.file})`);
    // --check against a manifest that is not this tree's
    const bad = JSON.parse(JSON.stringify(manifest)); bad.houses[id].fp.c[0] += 50;
    fs.writeFileSync(path.join(tmp, 'bad.json'), JSON.stringify(bad));
    const chk = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'bake-ao.mts'), '--check', '--house', id, '--manifest', path.join(tmp, 'bad.json')], { encoding: 'utf8' });
    ok(chk.status === 1 && /stale/.test(chk.stdout), '--check calls a manifest with a moved fingerprint stale (exit 1)');
    const good = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'bake-ao.mts'), '--check', '--house', id], { encoding: 'utf8' });
    ok(good.status === 0, '--check passes on the committed manifest');
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // ------------------------------------------------------------------ guard
  console.log('\nguard');
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-guard-'));
    const dir = path.join(tmp, 'ao'); fs.mkdirSync(dir);
    const body = Buffer.from('x'.repeat(64));
    const name = `h.${crypto.createHash('sha256').update(body).digest('hex').slice(0, 8)}.bin`;
    fs.writeFileSync(path.join(dir, name), body);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ houses: { h: { file: name, bytes: body.length } } }));
    ok(aoProblems(dir, ['h']).length === 0, 'a consistent directory has no problems');
    fs.writeFileSync(path.join(dir, 'stray.bin'), 'y');
    ok(aoProblems(dir, ['h']).some((p: string) => /stray\.bin.*not in the manifest/.test(p)), 'an unlisted file fails');
    fs.rmSync(path.join(dir, 'stray.bin'));
    fs.rmSync(path.join(dir, name));
    ok(aoProblems(dir, ['h']).some((p: string) => /missing/.test(p)), 'a missing file fails');
    fs.writeFileSync(path.join(dir, name), Buffer.from('z'.repeat(64)));
    ok(aoProblems(dir, ['h']).some((p: string) => /not the one in its name/.test(p)), 'a mis-hashed file fails');
    fs.writeFileSync(path.join(dir, name), body);
    ok(aoProblems(dir, ['h', 'other']).some((p: string) => /no AO volume for other/.test(p)), 'a house without an entry fails');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
} catch (err) {
  failures++;
  console.error(`\n\x1b[31m${(err as Error).stack || err}\x1b[0m`);
} finally {
  await browser.close(); await srv.close(); if (base) await base.close();
}
console.log(`\n${failures ? `\x1b[31m${failures} failed\x1b[0m, ` : ''}${passes} passed`);
process.exit(failures ? 1 : 0);
}
