#!/usr/bin/env -S node --experimental-strip-types
// story:film. One short film per family, from the family's own files: the story, its voice lock and its bake lock.
//
//   pnpm run story:film -- <slug> [<slug> ...]       these families        pnpm run story:film -- --all    every family that has a bake lock
//        [--aspect 16x9|9x16|both]   (default both: 1920x1080 and 1080x1920, 30 fps)
//        [--master]        also keep the CRF 18 master (AAC 128k stereo) in video/families/master/
//        [--res 1080]      frame height of the short edge (540 renders the same picture at a quarter of the cost: for looking, not for shipping)
//        [--jobs 1]        families at once (one browser either way; the GPU's ceiling on this machine is 3)
//        [--gl default|software]   default: the machine's own GPU through ANGLE (Linux: the Intel iGPU here); software is the repo's SwiftShader flags, hours a film. FILM_GL sets it too.
//                          A software rasteriser under `default` is warned about; a blank first frame stops the render (the GPU path that draws nothing). Never --use-angle=vulkan.
//        [--silent]        a captioned film with NO sound: no voice lock needed, the clock and the karaoke captions are timed by the bake lock's estimated durations, no audio stream,
//                          the sound gates are skipped, films.json records `sound: false` and the file is <slug>.<aspect>.silent.<hash10>.mp4. A family with no voice lock is filmed this
//                          way on its own, with a notice. A voiced film still refuses estimated durations.
//        [--probe [seconds]]   render N seconds (default 3) of the first film beats at --res 540 (and a short run at 1080) into $CI_FILM_PROBE_OUT (default video/families/probe/), print
//                          seconds per frame, the renderer and a projected time for the full 1080 p two-aspect film. Writes nothing to content/families.
//        [--no-spline-gate]   render a family whose camera fails `pnpm run story:spline` (by default a film needs the gate to pass; --stills and --dry-run do not)
//        [--force]         render even when films.json says the film is current   [--dry-run] build the sound, the captions and the timeline only
//        [--stills <dir> [--at 1,3.2,20]]   write single frames (title, each film beat, the end card unless --at says otherwise) as JPEG + a report, no film
//
// How it works (reference/story/film.md): the house opens in the EDITOR page (not the player). assets/story/film/index.js registers the same story
// camera the live tour uses (trackFrameAt) as a shot preset whose film seconds map onto the tour's, plays only the beats the story flags `film`, and
// draws a Canvas2D overlay (popup card, leader, karaoke caption, corner mark, title card, end card) on the frame __houseRenderFrames leaves on the canvas.
// Each frame is a pure function of the tree and its index (random access), so two fresh runs give the same bytes on one machine profile.
// Sound is the SAME m4a clips the tour plays, laid at the bake lock's offsets, normalised to -14 LUFS / -1 dBTP by the two-pass method (a --silent film has none).
//
// Outputs: video/families/web/<slug>.<aspect>[.silent].<hash10>.mp4 (H.264 High CRF 28, 1.5 Mbit/s cap, AAC 64k unless silent, under 24 MiB; hosted OUTSIDE the Pages deploy,
// FILM_BASE_URL), content/families/<slug>/film/{poster*.<hash10>.jpg, captions.<hash10>.vtt} and content/families/films.json (all committed; films are not).
// Playwright resolves as story-bake does. ffmpeg and ffprobe must be on PATH. ONE GPU process of this script's own.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, loadPlaywright, serve, stubGoogleFonts, type Served } from './portal-lib.mts';
import { FILM, FILM_KEYS, filmClock, audioPlacements, captionCues, toVtt, overCap, formatFor, type FilmKey } from '../assets/story/film/layout.js';
import {
  loadFamily, filmableSlugs, filmText, clipPath, familiesDir, videoDir, readFilms, writeFilms, aspectLabel, webFileName, sideName, posterFileName, vttFileName, sha256, inputsShaOf, isFilmLighting, FILM_LIGHTING, FILM_LIGHTINGS,
  filmsProblems, hasVoiceLock, captionProblems, type Family, type FilmEntry, type FilmAspect,
} from './film/lib.mts';
import { buildAudio, encodeArgs } from './film/mux.mts';
import { gate } from './film/qa.mts';
import { glArgs, glMode, chromiumFor, type GlMode } from './film/ads-lib.mts';
import { BLANK_STD } from './film/ads-qa.mts';
import { CANVAS_TYPE_MIN } from '../assets/story/place.js';
import { gradeSlug, defaultDirs } from './story/spline-report.mts';

const FRAMES_PER_CALL = 12;
const JPEG_QUALITY = 0.95;

// ---- arguments ----------------------------------------------------------------------------------------------------------------------------
const argv = process.argv.slice(2), valued = new Set(['aspect', 'res', 'jobs', 'stills', 'at', 'gl', 'lighting']);
const flags: Record<string, string> = {}, slugs: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (k === 'probe') flags[k] = /^\d+(\.\d+)?$/.test(argv[i + 1] || '') ? argv[++i] : 'true';      // --probe [seconds]
    else flags[k] = valued.has(k) ? argv[++i] : 'true';
  } else slugs.push(a);
}
const PROBE = !!flags.probe, PROBE_S = flags.probe && flags.probe !== 'true' ? +flags.probe : 3;
const RES = +(flags.res || (PROBE ? 540 : 1080)), JOBS = Math.max(1, +(flags.jobs || 1));
let GL: GlMode; try { GL = glMode(flags.gl || process.env.FILM_GL); } catch (e: any) { console.error(e.message); process.exit(2); }
// the hour the film is lit at: the page's own ?lighting= override ("re-lights every house the page builds, whatever its spec says"), as the ad cuts do. A house's own preset may be dusk, which a film (held to daylight and warm light like the ads) may not use.
const LIGHTING_ASKED = flags.lighting || process.env.FILM_LIGHTING || FILM_LIGHTING;
if (!isFilmLighting(LIGHTING_ASKED)) { console.error(`--lighting must be ${FILM_LIGHTINGS.join(' or ')}: a film is held to daylight and warm light (got ${LIGHTING_ASKED})`); process.exit(2); }
const LIGHTING = LIGHTING_ASKED;
const ASPECTS: FilmKey[] = !flags.aspect || flags.aspect === 'both' ? FILM_KEYS : [flags.aspect as FilmKey];
if (ASPECTS.some(a => !FILM_KEYS.includes(a))) { console.error(`--aspect must be 16x9, 9x16 or both (got ${flags.aspect})`); process.exit(2); }
const log = (slug: string, msg: string) => console.log(`${JOBS > 1 ? `[${slug}] ` : ''}${msg}`);

for (const t of ['ffmpeg', 'ffprobe']) if (spawnSync(t, ['-version'], { stdio: 'ignore' }).status !== 0) { console.error(`${t} is not on PATH`); process.exit(2); }

// ---- one family -------------------------------------------------------------------------------------------------------------------------------
const finished = new Map<string, Set<FilmKey>>();
type Result = { slug: string; ok: boolean; skipped?: boolean; error?: string; entry?: FilmEntry; seconds: Record<string, number> };

/** Silent when asked, and on its own (with a notice) when the family has no voice lock: the voiced film needs the recorded voice, the silent one needs only the story and the bake. */
function silentFor(slug: string): boolean {
  if (flags.silent === 'true') return true;
  if (hasVoiceLock(slug)) return false;
  log(slug, `${slug}: no voice lock (${slug}.voice.json), so this is a SILENT captioned film: no sound, timed by the bake lock's estimated durations (pnpm run story:voice -- ${slug} for a voiced one)`);
  return true;
}

/** The film's sound, captions and timeline: everything a film needs that is not a picture. Throws with the reason a family cannot be filmed. */
function plan(fam: Family) {
  const { rs } = fam, clock = filmClock(rs, { silent: fam.silent }), cap = overCap(rs, clock);
  if (cap) throw new Error(cap);
  const { placements, problems } = audioPlacements(rs, clock);
  if (problems.length) throw new Error(`${fam.slug}: ${problems.join('; ')}`);
  if (!fam.silent) for (const p of placements) {
    const f = clipPath(fam.slug, p.clip.file);
    if (!fs.existsSync(f)) throw new Error(`${fam.slug}: ${p.id}: ${path.relative(ROOT, f)} does not exist`);
    if (sha256(fs.readFileSync(f)) !== p.clip.sha256) throw new Error(`${fam.slug}: ${p.id}: the file does not match the voice lock's sha256 (run pnpm run story:voice -- ${fam.slug})`);
  }
  const text = filmText(rs, undefined, { silent: fam.silent }), cues = captionCues(rs, placements, text.names), caps = captionProblems(cues, clock.duration);
  if (caps.errors.length) throw new Error(`${fam.slug}: ${caps.errors.slice(0, 3).join('; ')}`);
  return { clock, placements, text, cues, vtt: toVtt(cues), caps };
}

/** The renderer string the page's WebGL reports (what the GPU path really is). */
async function rendererOf(page: any): Promise<string> {
  return page.evaluate(() => { const c = document.createElement('canvas'); const g: any = c.getContext('webgl2') || c.getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : 'unknown'; });
}
const SOFTWARE_RE = /swiftshader|llvmpipe|software/i;

/** One browser context and page with the family's house built in the editor page; the renderer string, warned about when `--gl default` fell back to the CPU. */
async function openHouse(browser: any, srv: Served, fam: Family, slug: string, res: number) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(0); page.on('pageerror', (e: Error) => console.error('  page error:', e.message));
  try {
    await stubGoogleFonts(page, srv.origin);
    const t = Date.now();
    await page.goto(`${srv.origin}/room-creator.html?house=${fam.story.house}&shot=orbit&res=${res}&aspect=16:9&lighting=${LIGHTING}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, fam.story.house, { timeout: 300000 });
    const renderer = await rendererOf(page), lit = await page.evaluate(() => (window as any).__houseLighting && (window as any).__houseLighting.preset);
    if (lit && lit !== LIGHTING) throw new Error(`the page is lit at ${lit}, not ${LIGHTING}`);
    log(slug, `${slug}: house ready in ${((Date.now() - t) / 1000).toFixed(0)} s, lit at ${lit}, gpu: ${renderer}`);
    if (GL === 'default' && SOFTWARE_RE.test(renderer)) log(slug, `  warning: --gl default fell back to a software rasteriser (${renderer}); this will be slow`);
    return { ctx, page, renderer, readyS: (Date.now() - t) / 1000 };
  } catch (e) { await ctx.close().catch(() => {}); throw e; }
}

async function renderFamily(browser: any, srv: Served, slug: string): Promise<Result> {
  const t0 = Date.now(), res: Result = { slug, ok: false, seconds: {} };
  try {
    const silent = silentFor(slug), fam = await loadFamily(slug, { silent }), P = plan(fam), vdir = videoDir();
    const films = readFilms(), inputsSha = inputsShaOf(fam, RES, { lighting: LIGHTING }), prev = films.families[slug];   // the pin: scripts/film/lib.mts, which the ship step's freshness check uses too
    const webDir = path.join(vdir, 'web'), masterDir = path.join(vdir, 'master'), scratch = path.join(vdir, '.scratch', slug);
    fs.mkdirSync(webDir, { recursive: true }); fs.mkdirSync(scratch, { recursive: true });
    log(slug, `${slug}: ${fam.rs.beats.length} beats, ${P.clock.parts.length} in the film, ${P.clock.duration.toFixed(1)} s (title ${FILM.titleS} s, end card ${(P.clock.outro.t1 - P.clock.outro.t0).toFixed(1)} s), ${P.cues.length} captions${silent ? ', silent' : ''}`);
    for (const w of P.caps.warnings.slice(0, 6)) log(slug, `  caption warn: ${w}`);
    // already current: films.json agrees and the files are where it says
    const have = prev && prev.inputsSha === inputsSha && ASPECTS.every(a => prev.aspects[a] && fs.existsSync(path.join(webDir, prev.aspects[a]!.file)));
    if (have && flags.force !== 'true' && !flags.stills && flags['dry-run'] !== 'true') { log(slug, `${slug}: current (films.json), skipped; --force to render again`); return { ...res, ok: true, skipped: true, entry: prev }; }
    // the sound (a silent film has none)
    const wav = silent ? null : path.join(scratch, 'audio.wav');
    if (wav) {
      const aud = buildAudio(P.placements, p => clipPath(slug, p.clip.file), P.clock.duration, wav, scratch);
      log(slug, `  sound: ${aud.clips} clips, ${aud.loudness.I.toFixed(1)} LUFS, ${aud.loudness.TP.toFixed(1)} dBTP`);
    } else log(slug, `  sound: none (silent film); captions ${P.caps.maxCps} characters a second at most`);
    if (flags['dry-run'] === 'true') {
      fs.writeFileSync(path.join(scratch, `${slug}.vtt`), P.vtt);
      fs.writeFileSync(path.join(scratch, 'plan.json'), JSON.stringify({ silent, clock: P.clock, placements: P.placements.map(p => ({ id: p.id, kind: p.kind, atS: p.atS, endS: p.endS })), cues: P.cues.length, captions: P.caps }, null, 1));
      log(slug, `  dry run: ${path.relative(ROOT, scratch)}`); return { ...res, ok: true, seconds: { total: (Date.now() - t0) / 1000 } };
    }
    // the camera gate (reference/story/spline.md): a film is rendered only from a family whose tour passes it (stills, to look at a failing camera, and --no-spline-gate are exempt)
    if (!flags.stills && flags['no-spline-gate'] !== 'true') {
      const sp = await gradeSlug(slug, { ...defaultDirs(), families: familiesDir() }), fails = sp.defects.filter(d => d.sev === 'fail');
      if (fails.length) throw new Error(`${slug}: the camera spline gate fails (${fails.length}): ${fails.slice(0, 3).map(d => `${d.rule}${d.beat ? ` [${d.beat}]` : ''}: ${d.msg}`).join(' | ')}${fails.length > 3 ? ' | ...' : ''} (pnpm run story:spline -- ${slug}; --no-spline-gate to render anyway)`);
      log(slug, `  camera gate: ${sp.status} (${sp.warns} warnings)`);
    }
    // the picture, one browser context per family (a page crash costs one family)
    const { ctx, page, renderer } = await openHouse(browser, srv, fam, slug, RES);
    const aspects: Record<string, FilmAspect> = {};
    const filmDir = path.join(familiesDir(), slug, 'film'), vttBytes = Buffer.from(P.vtt), vName = vttFileName(vttBytes);
    if (!flags.stills) {
      // captions: one file for both shapes (the words and their times are the same)
      fs.mkdirSync(filmDir, { recursive: true });
      for (const old of fs.readdirSync(filmDir)) if (old.startsWith('captions.') && old !== vName) fs.rmSync(path.join(filmDir, old));
      fs.writeFileSync(path.join(filmDir, vName), vttBytes);
    }
    try {
      for (const key of ASPECTS) {
        if (finished.get(slug)?.has(key)) continue;          // done before a retry of this family
        const ta = Date.now(), f = formatFor(key, RES);
        await page.evaluate(([r, a]: string[]) => (window as any).__houseComposerWarm({ res: r, aspect: a }), [String(RES), aspectLabel(key)]);
        const info = await page.evaluate(async (a: any) => { // @ts-ignore (a URL in the page, not a module of this script)
          const F = await import('/assets/story/film/index.js'); (window as any).__film = F; return F.prepare(a); },
          { rs: fam.rs, format: key, res: RES, title: P.text.title, end: P.text.end, badge: P.text.badge, silent });
        if (info.unsafe.length) throw new Error(`${slug} ${key}: outside the safe area: ${info.unsafe.join(', ')}`);
        if (flags.stills) { await stills(page, slug, key, info, flags.stills); await page.evaluate(() => (window as any).__film.end()); continue; }
        const tmpWeb = path.join(scratch, `${key}.web.mp4`), tmpMaster = flags.master === 'true' ? path.join(scratch, `${key}.master.mp4`) : null;
        let posterJpg: Buffer | null = null, audit: { min: number; text: string; sizes: Record<string, number>; drawn: number } | null = null;
        const spread: number[] = [];
        const ff = spawn('ffmpeg', encodeArgs({ wav, fps: info.fps, web: tmpWeb, master: tmpMaster }), { stdio: ['pipe', 'ignore', 'pipe'] });
        let ffErr = ''; ff.stderr.on('data', (d: any) => (ffErr += d));
        const ffDone = new Promise<void>((resolve, reject) => { ff.on('error', reject); ff.on('close', (code, sig) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code ?? sig}: ${ffErr.trim()}`)))); });
        ffDone.catch(() => {});                       // (reported where it is awaited; a rejection nobody awaits yet must not end the process)
        ff.stdin.on('error', () => {});               // a dead ffmpeg surfaces as ffDone's error, not as a broken pipe here
        const write = (buf: Buffer) => new Promise<void>(r => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', () => r())));
        try {
          const posterW = key === '16x9' ? 1280 : 720;
          for (let from = 0; from < info.frames; from += FRAMES_PER_CALL) {
            const out: { jpgs: string[]; poster: string | null; std: number[] } = await page.evaluate(([a, n, q, pi, pw, total]: number[]) => {
              const F = (window as any).__film, jpgs: string[] = [], std: number[] = []; let poster: string | null = null;
              for (let i = a; i < Math.min(a + n, total); i++) { jpgs.push(F.frame(i, q)); std.push(F.stats().std); if (i === pi) poster = F.posterOf(pw); }
              return { jpgs, poster, std };
            }, [from, FRAMES_PER_CALL, JPEG_QUALITY, info.poster, posterW, info.frames]);
            if (out.poster) posterJpg = Buffer.from(out.poster, 'base64');
            spread.push(...out.std);
            // a blank render is caught on the first frames at once, not after the whole film: the GPU path that draws nothing gives a flat room whatever the overlay says
            if (from === 0 && out.std[0] < BLANK_STD) throw new Error(`the first frame is blank (room spread ${out.std[0]}): the GPU path draws nothing (--gl ${GL} uses ${renderer}; never use --use-angle=vulkan)`);
            for (const j of out.jpgs) await write(Buffer.from(j, 'base64'));
            if (from % (FRAMES_PER_CALL * 20) === 0) process.stdout.write(`\r  ${key}: frame ${Math.min(info.frames, from + FRAMES_PER_CALL)} / ${info.frames}   `);
          }
          const blanks = spread.filter(v => v < BLANK_STD).length;
          if (spread[spread.length - 1] < BLANK_STD) throw new Error(`the last frame is blank (room spread ${spread[spread.length - 1]})`);
          if (blanks > spread.length * 0.05) throw new Error(`${blanks} of ${spread.length} frames are blank`);
          // the floor is a statement about the pixels: the smallest type the overlay really painted in this film (the captions are in it), in design px at the 1080 short edge
          audit = await page.evaluate(() => (window as any).__film.typeAudit());
          if (audit!.min < CANVAS_TYPE_MIN - 0.01) throw new Error(`type under the ${CANVAS_TYPE_MIN} design px floor: ${audit!.min.toFixed(2)} painted for "${audit!.text}"`);
          ff.stdin.end(); await ffDone; process.stdout.write('\n');
        } catch (e) { ff.kill('SIGKILL'); throw e; }
        await page.evaluate(() => (window as any).__film.end());
        // the gates, on the web file (the one that ships)
        const rep = gate(tmpWeb, { w: f.w, h: f.h, fps: info.fps, frames: info.frames, durationS: info.duration, titleEnd: FILM.titleS + FILM.padS, outroTail: FILM.outroTailS, web: true, channels: 1, silent });
        const bytes = fs.readFileSync(tmpWeb);
        for (const w of rep.warnings) log(slug, `  ${key} warn: ${w}`);
        if (rep.errors.length) {
          const rej = path.join(vdir, 'rejected'); fs.mkdirSync(rej, { recursive: true }); fs.copyFileSync(tmpWeb, path.join(rej, `${sideName(slug, key, silent)}.mp4`));
          throw new Error(`${key} failed its gates: ${rep.errors.join('; ')} (kept in ${path.relative(ROOT, rej)})`);
        }
        const file = webFileName(slug, key, bytes, silent);
        fs.copyFileSync(tmpWeb, path.join(webDir, file));
        if (tmpMaster) { fs.mkdirSync(masterDir, { recursive: true }); fs.copyFileSync(tmpMaster, path.join(masterDir, `${sideName(slug, key, silent)}.mp4`)); }
        if (!posterJpg) throw new Error(`${key}: no poster frame`);
        const pName = posterFileName(key, posterJpg);
        for (const old of fs.readdirSync(filmDir)) if (old.startsWith(key === '16x9' ? 'poster.' : 'poster-9x16.') && old !== pName) fs.rmSync(path.join(filmDir, old));
        fs.writeFileSync(path.join(filmDir, pName), posterJpg);
        aspects[key] = { file, sha256: sha256(bytes), bytes: bytes.length, width: f.w, height: f.h, durationMs: Math.round(rep.probe.duration * 1000), poster: `film/${pName}`, ...(silent ? {} : { loudness: { I: +rep.loudness!.I.toFixed(1), TP: +rep.loudness!.TP.toFixed(1) } }) };
        res.seconds[key] = (Date.now() - ta) / 1000; finished.set(slug, (finished.get(slug) || new Set()).add(key));
        // recorded as soon as THIS shape is done, so a later failure keeps it (a film is only ever listed with the inputs it was made from)
        { const fl = readFilms(), cur = fl.families[slug]; const keep = cur && cur.inputsSha === inputsSha ? cur.aspects : {};
          fl.families[slug] = { sound: !silent, durationMs: Math.round(P.clock.duration * 1000), inputsSha, vtt: `film/${vName}`, aspects: { ...keep, [key]: aspects[key] } }; writeFilms(fl); }
        fs.writeFileSync(path.join(vdir, `${sideName(slug, key, silent)}.report.json`), JSON.stringify({ silent, gl: GL, renderer, gates: rep, captions: P.caps, cards: info.cards, placements: info.placements, tracking: info.tracking, typeFloor: CANVAS_TYPE_MIN, typePainted: audit, spreadMin: Math.min(...spread), wallSeconds: res.seconds[key] }, null, 1));
        log(slug, `  ${key}: ${(bytes.length / 1048576).toFixed(1)} MiB, ${rep.probe.duration.toFixed(1)} s, ${silent ? 'no sound' : `${rep.loudness!.I.toFixed(1)} LUFS / ${rep.loudness!.TP.toFixed(1)} dBTP`}, ${(res.seconds[key]).toFixed(0)} s wall (${(res.seconds[key] / info.frames).toFixed(2)} s a frame)`);
      }
      if (flags.stills) return { ...res, ok: true };
      res.entry = readFilms().families[slug];
    } finally { await ctx.close().catch(() => {}); }
    res.ok = true; res.seconds.total = (Date.now() - t0) / 1000;
    log(slug, `${slug}: done in ${res.seconds.total.toFixed(0)} s`);
    fs.rmSync(scratch, { recursive: true, force: true });
    return res;
  } catch (e: any) { return { ...res, ok: false, error: e.message }; }
}

// ---- the probe: what a film costs on this machine ---------------------------------------------------------------------------------------------------
type Sample = { frames: number; seconds: number; spf: number };
/** Time `n` frames from `i0` (after two untimed frames that warm the shaders), JPEG encode included. Optionally pipes them to `ff`. */
async function timeFrames(page: any, i0: number, n: number, ff?: { write(b: Buffer): Promise<void> }): Promise<Sample & { std: number[]; first?: string; last?: string }> {
  await page.evaluate((i: number) => { const F = (window as any).__film; F.frame(i, 0.9); F.frame(i, 0.9); }, i0);
  const std: number[] = []; let first: string | undefined, last: string | undefined; const t = Date.now();
  for (let from = 0; from < n; from += FRAMES_PER_CALL) {
    const out: { jpgs: string[]; std: number[] } = await page.evaluate(([a, k, q]: number[]) => {
      const F = (window as any).__film, jpgs: string[] = [], std: number[] = [];
      for (let i = a; i < a + k; i++) { jpgs.push(F.frame(i, q)); std.push(F.stats().std); }
      return { jpgs, std };
    }, [i0 + from, Math.min(FRAMES_PER_CALL, n - from), JPEG_QUALITY]);
    std.push(...out.std);
    if (!first) first = out.jpgs[0]; last = out.jpgs[out.jpgs.length - 1];
    if (ff) for (const j of out.jpgs) await ff.write(Buffer.from(j, 'base64'));
  }
  const seconds = (Date.now() - t) / 1000;
  return { frames: n, seconds, spf: seconds / n, std, first, last };
}

async function probeFamily(browser: any, srv: Served, slug: string): Promise<Result> {
  const t0 = Date.now(), res: Result = { slug, ok: false, seconds: {} };
  try {
    const silent = silentFor(slug), fam = await loadFamily(slug, { silent }), P = plan(fam), key = ASPECTS[0], fps = P.clock.fps;
    const out = path.resolve(process.env.CI_FILM_PROBE_OUT || path.join(videoDir(), 'probe')); fs.mkdirSync(out, { recursive: true });
    const intFrames = Math.round(P.clock.parts.reduce((a, p) => a + (p.end - p.at), 0) * fps), extFrames = P.clock.frames - intFrames;
    const i0 = Math.round(P.clock.parts[0].at * fps), nInt = Math.min(Math.round(PROBE_S * fps), P.clock.frames - i0), nExt = Math.min(Math.round(1.5 * fps), i0);
    log(slug, `${slug}: probe at ${RES} p, ${aspectLabel(key)}: ${(nInt / fps).toFixed(1)} s from the first film beat (${P.clock.parts[0].id}, film second ${P.clock.parts[0].at.toFixed(1)}) and ${(nExt / fps).toFixed(1)} s of the title card`);
    const { ctx, page, renderer, readyS } = await openHouse(browser, srv, fam, slug, RES);
    try {
      const run = async (r: number, nI: number, nE: number, file: string | null) => {
        const f = formatFor(key, r);
        await page.evaluate(([rr, a]: string[]) => (window as any).__houseComposerWarm({ res: rr, aspect: a }), [String(r), aspectLabel(key)]);
        const tp = Date.now();
        const info = await page.evaluate(async (a: any) => { // @ts-ignore (a URL in the page, not a module of this script)
          const F = await import('/assets/story/film/index.js'); (window as any).__film = F; return F.prepare(a); },
          { rs: fam.rs, format: key, res: r, title: P.text.title, end: P.text.end, badge: P.text.badge, silent });
        const prepareS = (Date.now() - tp) / 1000;
        if (info.unsafe.length) throw new Error(`outside the safe area: ${info.unsafe.join(', ')}`);
        let ff: any = null, ffDone: Promise<void> | null = null, write: ((b: Buffer) => Promise<void>) | undefined;
        if (file) {
          ff = spawn('ffmpeg', encodeArgs({ wav: null, fps: info.fps, web: file }), { stdio: ['pipe', 'ignore', 'pipe'] });
          let err = ''; ff.stderr.on('data', (d: any) => (err += d));
          ffDone = new Promise<void>((resolve, reject) => { ff.on('error', reject); ff.on('close', (c: number) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}: ${err.trim()}`)))); }); ffDone.catch(() => {});
          ff.stdin.on('error', () => {}); write = (b: Buffer) => new Promise<void>(rs => (ff.stdin.write(b) ? rs() : ff.stdin.once('drain', () => rs())));
        }
        const interior = await timeFrames(page, i0, nI, write ? { write } : undefined);
        if (ff) { ff.stdin.end(); await ffDone; }
        const exterior = await timeFrames(page, Math.max(0, Math.round(FILM.posterS * fps) - Math.floor(nE / 2)), nE);
        await page.evaluate(() => (window as any).__film.end());
        if (interior.std[0] < BLANK_STD) throw new Error(`the first frame is blank (room spread ${interior.std[0]}): the GPU path draws nothing (--gl ${GL} uses ${renderer}; never use --use-angle=vulkan)`);
        if (file) { fs.writeFileSync(file.replace(/\.mp4$/, '.first.jpg'), Buffer.from(interior.first!, 'base64')); fs.writeFileSync(file.replace(/\.mp4$/, '.last.jpg'), Buffer.from(interior.last!, 'base64')); }
        return { res: r, w: f.w, h: f.h, prepareS: +prepareS.toFixed(1), interior: { frames: interior.frames, spf: +interior.spf.toFixed(3), spreadMin: Math.min(...interior.std) }, exterior: { frames: exterior.frames, spf: +exterior.spf.toFixed(3) } };
      };
      const probeFile = path.join(out, `${slug}.probe.${key}.r${RES}${silent ? '.silent' : ''}.mp4`);
      const at = await run(RES, nInt, nExt, probeFile);
      // the full size, measured too (a short run: 18 frames of each), unless that is the size asked for
      const full = RES === 1080 ? at : await run(1080, Math.min(18, nInt), Math.min(18, nExt), null);
      const proj = (m: typeof at, aspects: number) => aspects * (intFrames * m.interior.spf + extFrames * m.exterior.spf);
      const wallPerFilm = proj(full, 1);
      // one house build, the composer warm-up and the card layout per aspect, then the frames; the encode runs beside the render (ffmpeg is not the long pole)
      const total = readyS + 2 * (full.prepareS + 4) + proj(full, 2);
      const report = {
        slug, silent, aspect: key, renderer, gl: GL, probeSeconds: PROBE_S, houseReadyS: +readyS.toFixed(1),
        film: { frames: P.clock.frames, durationS: +P.clock.duration.toFixed(2), interiorFrames: intFrames, titleAndEndCardFrames: extFrames },
        atProbeRes: at, at1080: full,
        projection: { oneAspect1080Min: +(wallPerFilm / 60).toFixed(1), bothAspects1080Min: +(total / 60).toFixed(1), note: 'frames x measured seconds a frame at 1080 (interior and title/end-card frames costed separately), plus one house build and a composer warm-up per aspect. Measured with the machine at its current load.' },
        load: fs.readFileSync('/proc/loadavg', 'utf8').trim(),
      };
      fs.writeFileSync(path.join(out, `${slug}.probe.json`), JSON.stringify(report, null, 1) + '\n');
      log(slug, `  renderer: ${renderer}`);
      log(slug, `  ${at.w}x${at.h}: ${at.interior.spf.toFixed(2)} s a frame in the rooms (${at.interior.frames} frames), ${at.exterior.spf.toFixed(2)} s on the title card; prepare ${at.prepareS} s`);
      if (RES !== 1080) log(slug, `  ${full.w}x${full.h}: ${full.interior.spf.toFixed(2)} s a frame in the rooms, ${full.exterior.spf.toFixed(2)} s on the title card; prepare ${full.prepareS} s`);
      log(slug, `  projected, ${P.clock.frames} frames (${P.clock.duration.toFixed(1)} s) at 1080 p: ${(wallPerFilm / 60).toFixed(0)} min for one aspect, about ${(total / 60).toFixed(0)} min for 16:9 and 9:16 together (load ${report.load})`);
      log(slug, `  probe files: ${path.relative(ROOT, out).startsWith('..') ? out : path.relative(ROOT, out)}`);
    } finally { await ctx.close().catch(() => {}); }
    res.ok = true; res.seconds.total = (Date.now() - t0) / 1000; return res;
  } catch (e: any) { return { ...res, ok: false, error: e.message }; }
}

/** Single frames for the eye: the title, the middle of each film beat, the end card; JPEG into `dir` plus the card placements. */
async function stills(page: any, slug: string, key: FilmKey, info: any, dir: string) {
  const out = path.resolve(dir, slug); fs.mkdirSync(out, { recursive: true });
  const secs: number[] = flags.at ? flags.at.split(',').map(Number) : [
    0.4, 1.2, 3.2,
    ...info.clock.parts.map((p: any) => +(p.at + Math.min(p.end - p.at - 0.2, Math.max(1.8, (p.end - p.at) * 0.55))).toFixed(2)),
    info.clock.outro.t0 + 1, info.clock.outro.closingEnd - 1, info.clock.outro.panelAt + 1.2, info.clock.outro.t1 - 0.1,
  ];
  for (const s of secs) {
    const i = Math.max(0, Math.min(info.frames - 1, Math.round(s * info.fps)));
    const jpg: string = await page.evaluate(([n]: number[]) => (window as any).__film.frame(n, 0.92), [i]);
    fs.writeFileSync(path.join(out, `${key}.t${String(Math.round(s * 100)).padStart(5, '0')}.jpg`), Buffer.from(jpg, 'base64'));
  }
  fs.writeFileSync(path.join(out, `${key}.cards.json`), JSON.stringify({ cards: info.cards, clock: info.clock, placements: info.placements, cues: info.cues }, null, 1));
  console.log(`  ${key}: ${secs.length} stills in ${path.relative(process.cwd(), out)}`);
}

// ---- main ---------------------------------------------------------------------------------------------------------------------------------------
const list = flags.all === 'true' || !slugs.length ? filmableSlugs() : slugs;
if (!list.length) { console.log(`no families to film (a family needs content/families/<slug>.{json,bake.json}, and .voice.json for a film with sound); looked in ${path.relative(ROOT, familiesDir())}`); process.exit(0); }
const pw = flags['dry-run'] === 'true' ? null : await loadPlaywright();
const cr = pw ? chromiumFor(pw) : null;
if (cr && !cr.executablePath && cr.note.startsWith('no Chromium')) { console.error(cr.note); process.exit(2); }
if (cr) console.log(`browser: ${cr.note}; gl: ${GL}${process.platform === 'linux' && GL === 'software' ? ' (SwiftShader on the CPU: hours a film; --gl default uses the GPU)' : ''}`);
const srv = await serve(ROOT);
const browser = pw ? await pw.chromium.launch({ headless: true, executablePath: cr!.executablePath, args: [...glArgs(GL), '--autoplay-policy=no-user-gesture-required'] }) : null;
const queue = [...list], results: Result[] = [], t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(PROBE ? 1 : JOBS, list.length) }, async () => {
  for (let s = queue.shift(); s; s = queue.shift()) {
    const go = PROBE ? probeFamily : renderFamily;
    let r = await go(browser, srv, s);
    if (!r.ok && browser && /Timeout|crash|closed|Target page|navigation|ffmpeg exited/i.test(r.error || '')) { console.error(`${s}: ${r.error}\n${s}: trying once more on a fresh page`); r = await go(browser, srv, s); }
    results.push(r);
  }
}));
if (browser) await browser.close();
await srv.close();
const bad = results.filter(r => !r.ok);
for (const r of bad) console.error(`✗ ${r.slug}: ${r.error}`);
if (!PROBE && !flags.stills && flags['dry-run'] !== 'true') { const why = filmsProblems(readFilms()); for (const w of why) console.error(`✗ ${w}`); if (why.length) bad.push({ slug: 'films.json', ok: false, seconds: {} }); }
console.log(`${results.length - bad.length} of ${results.length} ok in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(bad.length ? 1 : 0);
