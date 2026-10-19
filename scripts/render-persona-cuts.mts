#!/usr/bin/env -S node --experimental-strip-types
// story:ads. The persona cuts: one member's story as a 15 to 25 second SILENT ad, from the family's own files (its story and its bake lock), for the social placements.
//
//   pnpm run story:ads                              refresh content/story/ads.json and print the plan (rendering needs a choice: a family, a member or --all)
//   pnpm run story:ads -- --all                     render the stale 9:16 cuts of every family that has a bake lock (hours: a cut is minutes)
//        [--family brennan,...] [--member sally,...]  only these (a family may also be named on its own: pnpm run story:ads -- brennan)
//        [--aspect 9x16|1x1|4x5|16x9|all]           (default 9x16, the one the campaign leads with; several: --aspect 9x16,1x1)
//        [--res 1080]                               the short edge in pixels: 360, 540, 720, 1080, 1440 or 2160 (540 renders the same picture at a quarter of the cost, to look at)
//        [--gl default|software]                    the GPU path (default; PERSONA_CUT_GL): `default` is the machine's own GPU through ANGLE, `software` the repo's SwiftShader (hours a cut)
//        [--lighting day|golden]                    the hour every cut is lit at (default day: the houses' own preset may be dusk, which an ad may not use)
//        [--audio none|silent]                      no audio stream (default) or one silent AAC track, for a placement that insists on audio
//        [--force]                                  render even when renders.json says the file is current
//        [--dry-run]                                the plan and what would be rendered; writes nothing, starts no browser
//        [--manifest]                               write content/story/ads.json and stop        [--check]  exit 1 when ads.json is not what the families make now
//        [--stills <dir> [--at 0,1.2,6]]            single frames (the first, the hook, mid caption, the dip, the end card, the last) + the card placements, no video
//        [--allow-short]                            render a cut under 15 s (one that has no later beat to extend with)   [--out <dir>] where the files go (default video/ads)
//
// How it works (reference/story/ads.md): the house opens in the EDITOR page (not the player), with `lighting=` set so the hour is the cut's and not the house's own.
// assets/story/film/cut/page.js registers the same story camera the live tour uses (trackFrameAt) as a shot preset whose seconds map onto the tour's, and draws a Canvas2D
// overlay (hook, popup card, karaoke caption, leader, corner mark, end card) on the frame __houseRenderFrames leaves on the canvas. Each frame is a pure function of the
// tree and its index, so two fresh runs give the same file on one machine profile. No voice and no voice lock is needed; Playwright resolves as story-bake does.
// Outputs: video/ads/<slug>-<member>.<aspect>[.r<res>].mp4 (gitignored: videos do not ship in git or on Pages), a report.json beside each, video/ads/renders.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, loadPlaywright, serve, stubGoogleFonts, type Served } from './portal-lib.mts';
import { cutFormat, CUT_KEYS, CUT_RES, type CutKey, type CutPlan } from '../assets/story/film/cut/plan.js';
import {
  buildPlans, buildManifest, readManifest, writeManifest, manifestDrift, manifestText, adsJsonPath, adsOutDir, cutHash, toolSha, endModelOf, badgeOf, loadClaims, DEFAULTS,
  readRenders, writeRenders, renderKey, renderState, outName, glArgs, glMode, chromiumFor, type AdFamily, type GlMode, type RenderRecord,
} from './film/ads-lib.mts';
import { encodeArgs, type AudioMode } from './film/ads-encode.mts';
import { gate, BLANK_STD } from './film/ads-qa.mts';

const FRAMES_PER_CALL = 12, JPEG_QUALITY = 0.95;

// ---- arguments ----------------------------------------------------------------------------------------------------------------------------
const argv = process.argv.slice(2), valued = new Set(['family', 'member', 'aspect', 'res', 'gl', 'lighting', 'audio', 'stills', 'at', 'out']);
const flags: Record<string, string> = {}, positional: string[] = [];
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); flags[k] = valued.has(k) ? argv[++i] : 'true'; } else positional.push(a); }
const bad = (m: string): never => { console.error(m); process.exit(2); };
const RES = +(flags.res || 1080);
if (!CUT_RES.includes(RES)) bad(`--res must be one of ${CUT_RES.join(', ')} (the sizes the page renders at), got ${flags.res}`);
const ASPECTS: CutKey[] = !flags.aspect ? ['9x16'] : flags.aspect === 'all' ? CUT_KEYS.slice() : flags.aspect.split(',') as CutKey[];
if (ASPECTS.some(a => !CUT_KEYS.includes(a))) bad(`--aspect must be ${CUT_KEYS.join(', ')} or all (got ${flags.aspect})`);
const LIGHTING = flags.lighting || DEFAULTS.lighting;
if (!['day', 'golden'].includes(LIGHTING)) bad(`--lighting must be day or golden: an ad is held to daylight and warm light (got ${LIGHTING})`);
const AUDIO = (flags.audio || DEFAULTS.audio) as AudioMode;
if (!['none', 'silent'].includes(AUDIO)) bad(`--audio must be none or silent (got ${flags.audio})`);
let GL: GlMode; try { GL = glMode(flags.gl); } catch (e: any) { bad(e.message); }
if (flags.out) process.env.CI_ADS_OUT = flags.out;
const families = [...(flags.family ? flags.family.split(',') : []), ...positional], members = flags.member ? flags.member.split(',') : null;
const DRY = flags['dry-run'] === 'true', STILLS = flags.stills ? path.resolve(flags.stills) : null;
const log = (m: string) => console.log(m);

for (const t of ['ffmpeg', 'ffprobe']) if (!DRY && spawnSync(t, ['-version'], { stdio: 'ignore' }).status !== 0) bad(`${t} is not on PATH`);

// ---- the plan and the manifest ---------------------------------------------------------------------------------------------------------------
const claims = loadClaims(), built = buildPlans(undefined, claims), manifest = buildManifest(built, claims);
for (const u of built.unreadable) log(`  (skipped ${u.slug}: ${u.why})`);
if (flags.check === 'true') {
  const why = manifestDrift(readManifest(), manifest);
  if (why.length) { console.error(`content/story/ads.json is not what the families make now:\n  ${why.join('\n  ')}\nrun: pnpm run story:ads -- --manifest`); process.exit(1); }
  log(`content/story/ads.json is current (${Object.values(manifest.families).reduce((n, f) => n + f.cuts.length, 0)} cuts)`); process.exit(0);
}
if (!DRY && !STILLS || flags.manifest === 'true') {
  const old = fs.existsSync(adsJsonPath()) ? fs.readFileSync(adsJsonPath(), 'utf8') : '';
  if (old !== manifestText(manifest)) { writeManifest(manifest); log(`wrote ${path.relative(ROOT, adsJsonPath())}`); } else log(`${path.relative(ROOT, adsJsonPath())} is current`);
  if (flags.manifest === 'true') process.exit(0);
}

// ---- what to render --------------------------------------------------------------------------------------------------------------------------
type Job = { fam: AdFamily; plan: CutPlan; aspect: CutKey; hash: string; key: string; state: 'current' | 'stale' | 'missing' };
const TOOL = toolSha(), renders = readRenders(), jobs: Job[] = [], notReady: string[] = [];
for (const [slug, { fam, cuts }] of built.plans) {
  if (families.length && !families.includes(slug)) continue;
  for (const plan of cuts) {
    if (members && !members.includes(plan.member)) continue;
    if (plan.status === 'no-bake') { notReady.push(`${plan.id}: ${fam.bakeWhy || 'the bake lock has no times for one of its beats'}`); continue; }
    if (plan.status === 'blocked') { notReady.push(`${plan.id}: ${plan.notes[plan.notes.length - 1]}`); continue; }
    if (plan.status === 'short' && flags['allow-short'] !== 'true') { notReady.push(`${plan.id}: ${plan.duration.toFixed(1)} s is under 15 s (--allow-short renders it anyway)`); continue; }
    const hash = cutHash(plan, fam, claims);
    for (const aspect of ASPECTS) { const key = renderKey(plan.id, aspect, RES, AUDIO); jobs.push({ fam, plan, aspect, hash, key, state: renderState(renders.renders[key], hash, TOOL, { lighting: LIGHTING, audio: AUDIO }) }); }
  }
}
{ // one line a family, not one a cut: the families being written have no bake lock yet
  const byWhy = new Map<string, number>(); for (const n of notReady) { const why = n.replace(/^[^:]*: /, '').replace(/\(pnpm run story:bake -- [a-z-]+\)/, '').trim(); byWhy.set(why, (byWhy.get(why) || 0) + 1); }
  for (const [why, n] of byWhy) log(`  (not rendered: ${n} cut${n === 1 ? '' : 's'}, ${why})`);
  if (flags.verbose === 'true') for (const n of notReady) log(`    ${n}`);
}
const todo = jobs.filter(j => STILLS || flags.force === 'true' || j.state !== 'current');
const table = (j: Job) => `${j.plan.id.padEnd(22)} ${j.aspect.padEnd(5)} ${j.plan.duration.toFixed(2).padStart(6)} s ${String(j.plan.frames).padStart(4)} f  ${j.plan.parts.map(p => p.beat).join(' + ').padEnd(34)} ${j.state}`;
log(`${jobs.length} cut${jobs.length === 1 ? '' : 's'} planned at ${RES} (${ASPECTS.join(', ')}), ${todo.length} to render${STILLS ? ' as stills' : ''}`);
for (const j of jobs) log(`  ${table(j)}${todo.includes(j) ? '' : '  (skipped: current)'}`);
const SELECTED = families.length > 0 || !!members || flags.all === 'true';
if (!DRY && !SELECTED) log('nothing is rendered without a choice: name a family (brennan, or --family), a member (--member), or --all. This was the plan only.');
if (DRY || !SELECTED || !todo.length) process.exit(0);

// ---- the browser ------------------------------------------------------------------------------------------------------------------------------
const pw = await loadPlaywright(), cr = chromiumFor(pw);
if (!cr.executablePath && cr.note.startsWith('no Chromium')) bad(cr.note);
log(`browser: ${cr.note}; gl: ${GL}${process.platform === 'linux' && GL === 'software' ? ' (SwiftShader on the CPU: hours a cut; PERSONA_CUT_GL=default uses the GPU)' : ''}`);
const srv = await serve(ROOT);
const browser = await pw.chromium.launch({ headless: true, executablePath: cr.executablePath, args: [...glArgs(GL), '--autoplay-policy=no-user-gesture-required'] });
const outDir = adsOutDir(); fs.mkdirSync(outDir, { recursive: true });
const failures: string[] = []; let doneN = 0; const t00 = Date.now();

async function rendererOf(page: any): Promise<string> {
  return page.evaluate(() => { const c = document.createElement('canvas'); const g: any = c.getContext('webgl2') || c.getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : 'unknown'; });
}

async function renderFamily(slug: string, list: Job[]) {
  const fam = list[0].fam, story = fam.story, rs = fam.rs!, t0 = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(0); page.on('pageerror', (e: Error) => console.error('  page error:', e.message));
  try {
    await stubGoogleFonts(page, srv.origin);
    // ?lighting= is the page's own override ("re-lights every house the page builds, whatever its spec says"): the cut's hour, not the house's
    await page.goto(`${srv.origin}/room-creator.html?house=${story.house}&shot=orbit&res=1080&aspect=16:9&lighting=${LIGHTING}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, story.house, { timeout: 300000 });
    const renderer = await rendererOf(page), lit = await page.evaluate(() => (window as any).__houseLighting && (window as any).__houseLighting.preset);
    if (lit && lit !== LIGHTING) throw new Error(`the page is lit at ${lit}, not ${LIGHTING}`);
    log(`${slug}: ${story.house} ready in ${((Date.now() - t0) / 1000).toFixed(0)} s, lit at ${lit}, gpu: ${renderer}`);
    if (GL === 'default' && /swiftshader|llvmpipe|software/i.test(renderer)) log(`  warning: --gl default fell back to a software rasteriser (${renderer}); this will be slow`);
    for (const j of list) {
      const f = cutFormat(j.aspect, RES), tj = Date.now(), end = endModelOf(j.plan, claims);
      try {
        await page.evaluate(([r, a]: string[]) => (window as any).__houseComposerWarm({ res: r, aspect: a }), [f.page.res, f.page.aspect]);
        const info = await page.evaluate(async (a: any) => { // @ts-ignore (a URL in the page, not a module of this script)
          const F = await import('/assets/story/film/cut/page.js'); (window as any).__cut = F; return F.prepare(a); },
          { rs, plan: j.plan, key: j.aspect, res: RES, end, badge: badgeOf(claims) });
        if (info.unsafe.length) throw new Error(`${j.plan.id} ${j.aspect}: outside the safe area: ${info.unsafe.join(', ')}`);
        if (STILLS) { await stills(page, j, info); await page.evaluate(() => (window as any).__cut.end()); continue; }
        await encode(page, j, f, info, tj, renderer);
        await page.evaluate(() => (window as any).__cut.end());
      } catch (e: any) { failures.push(`${j.plan.id} ${j.aspect}: ${e.message}`); console.error(`\n  failed: ${j.plan.id} ${j.aspect}: ${e.message}`); try { await page.evaluate(() => (window as any).__cut && (window as any).__cut.end()); } catch { /* the page may be gone */ } }
    }
  } finally { await ctx.close().catch(() => {}); }
}

async function encode(page: any, j: Job, f: ReturnType<typeof cutFormat>, info: any, tj: number, renderer: string) {
  const name = outName(j.plan.id, j.aspect, RES, AUDIO), tmp = path.join(outDir, `.${name}.part.mp4`), final = path.join(outDir, name);
  const ff = spawn('ffmpeg', encodeArgs({ fps: info.fps, from: { w: f.w, h: f.h }, out: f.out, file: tmp, audio: AUDIO, durationS: info.duration }), { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = ''; ff.stderr.on('data', (d: any) => (ffErr += d));
  const ffDone = new Promise<void>((resolve, reject) => { ff.on('error', reject); ff.on('close', (code, sig) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code ?? sig}: ${ffErr.trim()}`)))); });
  ffDone.catch(() => {}); ff.stdin.on('error', () => {});
  // (a dead ffmpeg ends the wait with its own error: its stdin never drains again)
  const write = (buf: Buffer): Promise<void> => (ff.stdin.write(buf) ? Promise.resolve() : Promise.race([new Promise<void>(r => ff.stdin.once('drain', () => r())), ffDone.then(() => { throw new Error('ffmpeg ended before the frames did'); })]));
  const digest = crypto.createHash('sha256'), spread: Array<[number, number]> = [];
  try {
    for (let from = 0; from < info.frames; from += FRAMES_PER_CALL) {
      const out: { jpgs: string[]; st: Array<[number, number]> } = await page.evaluate(([a, n, q, total]: number[]) => {
        const F = (window as any).__cut, jpgs: string[] = [], st: Array<[number, number]> = [];
        for (let i = a; i < Math.min(a + n, total); i++) { jpgs.push(F.frame(i, q)); const s = F.stats(); st.push([s.mean, s.std]); }
        return { jpgs, st };
      }, [from, FRAMES_PER_CALL, JPEG_QUALITY, info.frames]);
      for (const jpg of out.jpgs) { const b = Buffer.from(jpg, 'base64'); digest.update(b); await write(b); }
      spread.push(...out.st);
      // a blank render is caught on the first frames at once, not after the whole cut
      if (from === 0 && out.st[0][1] < BLANK_STD) throw new Error(`the first frame is blank (room spread ${out.st[0][1]}): the GPU path draws nothing (--gl default uses ${renderer}; never use --use-angle=vulkan)`);
      if (from % (FRAMES_PER_CALL * 10) === 0) process.stdout.write(`\r  ${j.plan.id} ${j.aspect}: frame ${Math.min(info.frames, from + FRAMES_PER_CALL)} / ${info.frames}   `);
    }
    ff.stdin.end(); await ffDone; process.stdout.write('\n');
  } catch (e) { ff.kill('SIGKILL'); fs.rmSync(tmp, { force: true }); throw e; }
  const blanks = spread.filter(s => s[1] < BLANK_STD).length;
  if (spread[spread.length - 1][1] < BLANK_STD) { fs.rmSync(tmp, { force: true }); throw new Error(`the last frame is blank (room spread ${spread[spread.length - 1][1]})`); }
  if (blanks > spread.length * 0.05) { fs.rmSync(tmp, { force: true }); throw new Error(`${blanks} of ${spread.length} frames are blank`); }
  const rep = gate(tmp, { w: f.out.w, h: f.out.h, fps: info.fps, frames: info.frames, durationS: info.duration, audio: AUDIO });
  for (const w of rep.warnings) log(`  ${j.plan.id} ${j.aspect} warn: ${w}`);
  if (blanks) log(`  ${j.plan.id} ${j.aspect} warn: ${blanks} frame(s) with no spread in the room`);
  if (rep.errors.length) {
    const rej = path.join(outDir, 'rejected'); fs.mkdirSync(rej, { recursive: true }); fs.renameSync(tmp, path.join(rej, name));
    throw new Error(`failed its gates: ${rep.errors.join('; ')} (kept in ${path.relative(ROOT, rej)})`);
  }
  fs.renameSync(tmp, final);
  const bytes = fs.readFileSync(final), sha = crypto.createHash('sha256').update(bytes).digest('hex'), wall = (Date.now() - tj) / 1000;
  const rec: RenderRecord = { hash: j.hash, tool: TOOL, file: name, sha256: sha, bytes: bytes.length, width: f.out.w, height: f.out.h, durationS: +rep.probe.duration.toFixed(3), frames: info.frames, res: RES, lighting: LIGHTING, audio: AUDIO, gl: GL, renderer, wallSeconds: +wall.toFixed(1), frameDigest: digest.digest('hex') };
  const all = readRenders(); all.renders[j.key] = rec; writeRenders(all);
  fs.writeFileSync(path.join(outDir, name.replace(/\.mp4$/, '.report.json')), JSON.stringify({ cut: j.plan.id, aspect: j.aspect, hash: j.hash, record: rec, gates: rep, cards: info.cards, hook: info.hook, endCard: info.end, captions: info.captions, spreadMin: Math.min(...spread.map(s => s[1])), blankFrames: blanks, browser: cr.note }, null, 1));
  doneN++;
  log(`  ${j.plan.id} ${j.aspect}: ${f.out.w}x${f.out.h}, ${(bytes.length / 1048576).toFixed(1)} MiB, ${rep.probe.duration.toFixed(2)} s, ${wall.toFixed(0)} s wall (${(wall / (info.frames / info.fps)).toFixed(1)} s per second of film)`);
}

/** Single frames for the eye: the first frame, the hook, the middle of each part's captions, the dip, the end card and the last frame; JPEG into `dir` plus the card placements. */
async function stills(page: any, j: Job, info: any) {
  const out = path.join(STILLS!, j.plan.id); fs.mkdirSync(out, { recursive: true });
  const P = j.plan, mid = (p: CutPlan['parts'][0]) => +(p.narrAt + (p.narrEnd - p.narrAt) * 0.5).toFixed(2);
  const secs: number[] = flags.at ? flags.at.split(',').map(Number) : [
    0, 1.0, ...P.parts.flatMap(p => [+(p.card.at + 0.6).toFixed(2), mid(p), +(p.narrEnd - 0.2).toFixed(2)]), +(P.pads[P.pads.length - 1].t0 + 0.175).toFixed(2), +(P.end.t0 + 0.9).toFixed(2), +(P.end.t1 - 0.04).toFixed(2),
  ];
  for (const s of secs) {
    const i = Math.max(0, Math.min(info.frames - 1, Math.round(s * info.fps)));
    const jpg: string = await page.evaluate(([n]: number[]) => (window as any).__cut.frame(n, 0.92), [i]);
    fs.writeFileSync(path.join(out, `${j.aspect}.t${String(Math.round(s * 100)).padStart(5, '0')}.jpg`), Buffer.from(jpg, 'base64'));
  }
  fs.writeFileSync(path.join(out, `${j.aspect}.cards.json`), JSON.stringify({ plan: P, ...info, cues: undefined }, null, 1));
  log(`  ${j.plan.id} ${j.aspect}: ${secs.length} stills in ${path.relative(process.cwd(), out)} (${secs.map(s => s.toFixed(2)).join(', ')} s)`);
}

// ---- main ---------------------------------------------------------------------------------------------------------------------------------------------
const byFamily = new Map<string, Job[]>();
for (const j of todo) byFamily.set(j.plan.slug, [...(byFamily.get(j.plan.slug) || []), j]);
for (const [slug, list] of byFamily) {
  try { await renderFamily(slug, list); } catch (e: any) { failures.push(`${slug}: ${e.message}`); console.error(`${slug}: ${e.message}`); }
}
await browser.close(); await srv.close();
for (const f of failures) console.error(`✗ ${f}`);
log(`${STILLS ? 'stills for' : `${doneN} of`} ${todo.length} cut${todo.length === 1 ? '' : 's'}${failures.length ? `, ${failures.length} failed` : ' ok'} in ${((Date.now() - t00) / 1000).toFixed(0)} s`);
process.exit(failures.length ? 1 : 0);
