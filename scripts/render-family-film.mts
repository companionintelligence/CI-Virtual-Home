#!/usr/bin/env -S node --experimental-strip-types
// story:film. One short film per family, from the family's own files: the story, its voice lock and its bake lock.
//
//   pnpm run story:film -- <slug> [<slug> ...]       these families        pnpm run story:film -- --all    every family that has a bake lock
//        [--aspect 16x9|9x16|both]   (default both: 1920x1080 and 1080x1920, 30 fps)
//        [--master]        also keep the CRF 18 master (AAC 128k stereo) in video/families/master/
//        [--res 1080]      frame height of the short edge (540 renders the same picture at a quarter of the cost: for looking, not for shipping)
//        [--jobs 1]        families at once (one browser either way; the GPU's ceiling on this machine is 3)
//        [--force]         render even when films.json says the film is current   [--dry-run] build the sound, the captions and the timeline only
//        [--stills <dir> [--at 1,3.2,20]]   write single frames (title, each film beat, the end card unless --at says otherwise) as JPEG + a report, no film
//
// How it works (reference/story/film.md): the house opens in the EDITOR page (not the player). assets/story/film/index.js registers the same story
// camera the live tour uses (trackFrameAt) as a shot preset whose film seconds map onto the tour's, plays only the beats the story flags `film`, and
// draws a Canvas2D overlay (popup card, leader, karaoke caption, corner mark, title card, end card) on the frame __houseRenderFrames leaves on the canvas.
// Each frame is a pure function of the tree and its index (random access), so two fresh runs give the same bytes on one machine profile.
// Sound is the SAME m4a clips the tour plays, laid at the bake lock's offsets, normalised to -14 LUFS / -1 dBTP by the two-pass method.
//
// Outputs: video/families/web/<slug>.<aspect>.<hash10>.mp4 (H.264 High CRF 28, 1.5 Mbit/s cap, AAC 64k, under 24 MiB; hosted OUTSIDE the Pages deploy,
// FILM_BASE_URL), content/families/<slug>/film/{poster*.<hash10>.jpg, captions.<hash10>.vtt} and content/families/films.json (all committed; films are not).
// Playwright resolves as story-bake does. ffmpeg and ffprobe must be on PATH. ONE GPU process of this script's own.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, loadPlaywright, LAUNCH_ARGS, serve, stubGoogleFonts, type Served } from './portal-lib.mts';
import { FILM, FILM_KEYS, filmClock, audioPlacements, captionCues, toVtt, overCap, formatFor, type FilmKey } from '../assets/story/film/layout.js';
import {
  loadFamily, filmableSlugs, filmText, clipPath, familiesDir, videoDir, readFilms, writeFilms, aspectLabel, webFileName, posterFileName, vttFileName, sha256, inputsShaOf, toolSha,
  filmsProblems, type Family, type FilmEntry, type FilmAspect,
} from './film/lib.mts';
import { buildAudio, encodeArgs } from './film/mux.mts';
import { gate } from './film/qa.mts';

const FRAMES_PER_CALL = 12;
const JPEG_QUALITY = 0.95;

// ---- arguments ----------------------------------------------------------------------------------------------------------------------------
const argv = process.argv.slice(2), valued = new Set(['aspect', 'res', 'jobs', 'stills', 'at']);
const flags: Record<string, string> = {}, slugs: string[] = [];
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); flags[k] = valued.has(k) ? argv[++i] : 'true'; } else slugs.push(a); }
const RES = +(flags.res || 1080), JOBS = Math.max(1, +(flags.jobs || 1));
const ASPECTS: FilmKey[] = !flags.aspect || flags.aspect === 'both' ? FILM_KEYS : [flags.aspect as FilmKey];
if (ASPECTS.some(a => !FILM_KEYS.includes(a))) { console.error(`--aspect must be 16x9, 9x16 or both (got ${flags.aspect})`); process.exit(2); }
const log = (slug: string, msg: string) => console.log(`${JOBS > 1 ? `[${slug}] ` : ''}${msg}`);

for (const t of ['ffmpeg', 'ffprobe']) if (spawnSync(t, ['-version'], { stdio: 'ignore' }).status !== 0) { console.error(`${t} is not on PATH`); process.exit(2); }

// ---- one family -------------------------------------------------------------------------------------------------------------------------------
const finished = new Map<string, Set<FilmKey>>();
type Result = { slug: string; ok: boolean; skipped?: boolean; error?: string; entry?: FilmEntry; seconds: Record<string, number> };

/** The film's sound, captions and timeline: everything a film needs that is not a picture. Throws with the reason a family cannot be filmed. */
function plan(fam: Family) {
  const { rs } = fam, clock = filmClock(rs), cap = overCap(rs, clock);
  if (cap) throw new Error(cap);
  const { placements, problems } = audioPlacements(rs, clock);
  if (problems.length) throw new Error(`${fam.slug}: ${problems.join('; ')}`);
  for (const p of placements) {
    const f = clipPath(fam.slug, p.clip.file);
    if (!fs.existsSync(f)) throw new Error(`${fam.slug}: ${p.id}: ${path.relative(ROOT, f)} does not exist`);
    if (sha256(fs.readFileSync(f)) !== p.clip.sha256) throw new Error(`${fam.slug}: ${p.id}: the file does not match the voice lock's sha256 (run pnpm run story:voice -- ${fam.slug})`);
  }
  const text = filmText(rs), cues = captionCues(rs, placements, text.names);
  return { clock, placements, text, cues, vtt: toVtt(cues) };
}

async function renderFamily(browser: any, srv: Served, slug: string): Promise<Result> {
  const t0 = Date.now(), res: Result = { slug, ok: false, seconds: {} };
  try {
    const fam = await loadFamily(slug), P = plan(fam), vdir = videoDir();
    const films = readFilms(), tool = toolSha(), inputsSha = inputsShaOf(fam, RES, tool), prev = films.families[slug];
    const webDir = path.join(vdir, 'web'), masterDir = path.join(vdir, 'master'), scratch = path.join(vdir, '.scratch', slug);
    fs.mkdirSync(webDir, { recursive: true }); fs.mkdirSync(scratch, { recursive: true });
    log(slug, `${slug}: ${fam.rs.beats.length} beats, ${P.clock.parts.length} in the film, ${P.clock.duration.toFixed(1)} s (title ${FILM.titleS} s, end card ${(P.clock.outro.t1 - P.clock.outro.t0).toFixed(1)} s), ${P.cues.length} captions`);
    // already current: films.json agrees and the files are where it says
    const have = prev && prev.inputsSha === inputsSha && ASPECTS.every(a => prev.aspects[a] && fs.existsSync(path.join(webDir, prev.aspects[a]!.file)));
    if (have && flags.force !== 'true' && !flags.stills && flags['dry-run'] !== 'true') { log(slug, `${slug}: current (films.json), skipped; --force to render again`); return { ...res, ok: true, skipped: true, entry: prev }; }
    // the sound
    const wav = path.join(scratch, 'audio.wav');
    const aud = buildAudio(P.placements, p => clipPath(slug, p.clip.file), P.clock.duration, wav, scratch);
    log(slug, `  sound: ${aud.clips} clips, ${aud.loudness.I.toFixed(1)} LUFS, ${aud.loudness.TP.toFixed(1)} dBTP`);
    if (flags['dry-run'] === 'true') {
      fs.writeFileSync(path.join(scratch, `${slug}.vtt`), P.vtt);
      fs.writeFileSync(path.join(scratch, 'plan.json'), JSON.stringify({ clock: P.clock, placements: P.placements.map(p => ({ id: p.id, kind: p.kind, atS: p.atS, endS: p.endS })), cues: P.cues.length }, null, 1));
      log(slug, `  dry run: ${path.relative(ROOT, scratch)}`); return { ...res, ok: true, seconds: { total: (Date.now() - t0) / 1000 } };
    }
    // the picture, one browser context per family (a page crash costs one family)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); page.setDefaultTimeout(0); page.on('pageerror', (e: Error) => console.error('  page error:', e.message));
    const aspects: Record<string, FilmAspect> = {};
    const filmDir = path.join(familiesDir(), slug, 'film'), vttBytes = Buffer.from(P.vtt), vName = vttFileName(vttBytes);
    if (!flags.stills) {
      // captions: one file for both shapes (the words and their times are the same)
      fs.mkdirSync(filmDir, { recursive: true });
      for (const old of fs.readdirSync(filmDir)) if (old.startsWith('captions.') && old !== vName) fs.rmSync(path.join(filmDir, old));
      fs.writeFileSync(path.join(filmDir, vName), vttBytes);
    }
    try {
      await stubGoogleFonts(page, srv.origin);
      await page.goto(`${srv.origin}/room-creator.html?house=${fam.story.house}&shot=orbit&res=${RES}&aspect=16:9`, { waitUntil: 'domcontentloaded', timeout: 240000 });
      await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, fam.story.house, { timeout: 300000 });
      for (const key of ASPECTS) {
        if (finished.get(slug)?.has(key)) continue;          // done before a retry of this family
        const ta = Date.now(), f = formatFor(key, RES);
        await page.evaluate(([r, a]: string[]) => (window as any).__houseComposerWarm({ res: r, aspect: a }), [String(RES), aspectLabel(key)]);
        const info = await page.evaluate(async (a: any) => { // @ts-ignore (a URL in the page, not a module of this script)
          const F = await import('/assets/story/film/index.js'); (window as any).__film = F; return F.prepare(a); },
          { rs: fam.rs, format: key, res: RES, title: P.text.title, end: P.text.end, badge: P.text.badge });
        if (flags.stills) { await stills(page, slug, key, info, flags.stills); await page.evaluate(() => (window as any).__film.end()); continue; }
        const tmpWeb = path.join(scratch, `${key}.web.mp4`), tmpMaster = flags.master === 'true' ? path.join(scratch, `${key}.master.mp4`) : null;
        let posterJpg: Buffer | null = null;
        const ff = spawn('ffmpeg', encodeArgs({ wav, fps: info.fps, web: tmpWeb, master: tmpMaster }), { stdio: ['pipe', 'ignore', 'pipe'] });
        let ffErr = ''; ff.stderr.on('data', (d: any) => (ffErr += d));
        const ffDone = new Promise<void>((resolve, reject) => { ff.on('error', reject); ff.on('close', (code, sig) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code ?? sig}: ${ffErr.trim()}`)))); });
        ffDone.catch(() => {});                       // (reported where it is awaited; a rejection nobody awaits yet must not end the process)
        ff.stdin.on('error', () => {});               // a dead ffmpeg surfaces as ffDone's error, not as a broken pipe here
        const write = (buf: Buffer) => new Promise<void>(r => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', () => r())));
        try {
          const posterW = key === '16x9' ? 1280 : 720;
          for (let from = 0; from < info.frames; from += FRAMES_PER_CALL) {
            const out: { jpgs: string[]; poster: string | null } = await page.evaluate(([a, n, q, pi, pw, total]: number[]) => {
              const F = (window as any).__film, jpgs: string[] = []; let poster: string | null = null;
              for (let i = a; i < Math.min(a + n, total); i++) { jpgs.push(F.frame(i, q)); if (i === pi) poster = F.posterOf(pw); }
              return { jpgs, poster };
            }, [from, FRAMES_PER_CALL, JPEG_QUALITY, info.poster, posterW, info.frames]);
            if (out.poster) posterJpg = Buffer.from(out.poster, 'base64');
            for (const j of out.jpgs) await write(Buffer.from(j, 'base64'));
            if (from % (FRAMES_PER_CALL * 20) === 0) process.stdout.write(`\r  ${key}: frame ${Math.min(info.frames, from + FRAMES_PER_CALL)} / ${info.frames}   `);
          }
          ff.stdin.end(); await ffDone; process.stdout.write('\n');
        } catch (e) { ff.kill('SIGKILL'); throw e; }
        await page.evaluate(() => (window as any).__film.end());
        // the gates, on the web file (the one that ships)
        const rep = gate(tmpWeb, { w: f.w, h: f.h, fps: info.fps, frames: info.frames, durationS: info.duration, titleEnd: FILM.titleS + FILM.padS, outroTail: FILM.outroTailS, web: true, channels: 1 });
        const bytes = fs.readFileSync(tmpWeb);
        for (const w of rep.warnings) log(slug, `  ${key} warn: ${w}`);
        if (rep.errors.length) {
          const rej = path.join(vdir, 'rejected'); fs.mkdirSync(rej, { recursive: true }); fs.copyFileSync(tmpWeb, path.join(rej, `${slug}.${key}.mp4`));
          throw new Error(`${key} failed its gates: ${rep.errors.join('; ')} (kept in ${path.relative(ROOT, rej)})`);
        }
        const file = webFileName(slug, key, bytes);
        fs.copyFileSync(tmpWeb, path.join(webDir, file));
        if (tmpMaster) { fs.mkdirSync(masterDir, { recursive: true }); fs.copyFileSync(tmpMaster, path.join(masterDir, `${slug}.${key}.mp4`)); }
        if (!posterJpg) throw new Error(`${key}: no poster frame`);
        const pName = posterFileName(key, posterJpg);
        for (const old of fs.readdirSync(filmDir)) if (old.startsWith(key === '16x9' ? 'poster.' : 'poster-9x16.') && old !== pName) fs.rmSync(path.join(filmDir, old));
        fs.writeFileSync(path.join(filmDir, pName), posterJpg);
        aspects[key] = { file, sha256: sha256(bytes), bytes: bytes.length, width: f.w, height: f.h, durationMs: Math.round(rep.probe.duration * 1000), poster: `film/${pName}`, loudness: { I: +rep.loudness!.I.toFixed(1), TP: +rep.loudness!.TP.toFixed(1) } };
        res.seconds[key] = (Date.now() - ta) / 1000; finished.set(slug, (finished.get(slug) || new Set()).add(key));
        // recorded as soon as THIS shape is done, so a later failure keeps it (a film is only ever listed with the inputs it was made from)
        { const fl = readFilms(), cur = fl.families[slug]; const keep = cur && cur.inputsSha === inputsSha ? cur.aspects : {};
          fl.families[slug] = { durationMs: Math.round(P.clock.duration * 1000), inputsSha, vtt: `film/${vName}`, aspects: { ...keep, [key]: aspects[key] } }; writeFilms(fl); }
        fs.writeFileSync(path.join(vdir, `${slug}.${key}.report.json`), JSON.stringify({ gates: rep, cards: info.cards, placements: info.placements, wallSeconds: res.seconds[key] }, null, 1));
        log(slug, `  ${key}: ${(bytes.length / 1048576).toFixed(1)} MiB, ${rep.probe.duration.toFixed(1)} s, ${rep.loudness!.I.toFixed(1)} LUFS / ${rep.loudness!.TP.toFixed(1)} dBTP, ${(res.seconds[key]).toFixed(0)} s wall`);
      }
      if (flags.stills) return { ...res, ok: true };
      if (flags.stills) return { ...res, ok: true };
      res.entry = readFilms().families[slug];
    } finally { await ctx.close().catch(() => {}); }
    res.ok = true; res.seconds.total = (Date.now() - t0) / 1000;
    log(slug, `${slug}: done in ${res.seconds.total.toFixed(0)} s`);
    fs.rmSync(scratch, { recursive: true, force: true });
    return res;
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
if (!list.length) { console.log(`no families to film (a family needs content/families/<slug>.{json,voice.json,bake.json}); looked in ${path.relative(ROOT, familiesDir())}`); process.exit(0); }
const pw = flags['dry-run'] === 'true' ? null : await loadPlaywright();
const srv = await serve(ROOT);
const browser = pw ? await pw.chromium.launch({ headless: true, args: [...LAUNCH_ARGS, '--autoplay-policy=no-user-gesture-required'] }) : null;
const queue = [...list], results: Result[] = [], t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(JOBS, list.length) }, async () => {
  for (let s = queue.shift(); s; s = queue.shift()) {
    let r = await renderFamily(browser, srv, s);
    if (!r.ok && browser && /Timeout|crash|closed|Target page|navigation|ffmpeg exited/i.test(r.error || '')) { console.error(`${s}: ${r.error}\n${s}: trying once more on a fresh page`); r = await renderFamily(browser, srv, s); }
    results.push(r);
  }
}));
if (browser) await browser.close();
await srv.close();
const bad = results.filter(r => !r.ok);
for (const r of bad) console.error(`✗ ${r.slug}: ${r.error}`);
if (!flags.stills && flags['dry-run'] !== 'true') { const why = filmsProblems(readFilms()); for (const w of why) console.error(`✗ ${w}`); if (why.length) bad.push({ slug: 'films.json', ok: false, seconds: {} }); }
console.log(`${results.length - bad.length} of ${results.length} ok in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(bad.length ? 1 : 0);
