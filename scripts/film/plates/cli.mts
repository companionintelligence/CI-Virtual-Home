#!/usr/bin/env -S node --experimental-strip-types
// story:film --plates. The overlay-free PLATES of a family's film (or of a home with no family), and the plates.json the CI-Common video-kit reads.
//
//   pnpm run story:film -- <slug> [<slug> ...] --plates          a family's plates: one 3D pass, one clip per beat and aspect, plates.json v1
//   pnpm run story:film -- <house> --plates                      a home with no family (the apartments): its own door-to-core, orbit and hero shots, a title, the sanctioned end card
//   pnpm run story:film -- --all --plates                        every family with a bake lock, then every home without a family
//        [--aspect 16x9,9x16[,1x1]]   default 16x9,9x16 (landscape and portrait); 1x1 adds the square the 15 s and 30 s cuts use
//        [--res 1080]       the short edge: 540 renders the same picture at a quarter of the cost (a draft to look at)
//        [--gl default|nvidia|software]   default: ANGLE picks the machine's GPU (the Intel iGPU here); nvidia: the discrete GPU through ANGLE's GL backend; software: SwiftShader (hours). FILM_GL sets it too.
//        [--only a,b]       draw only these plates (their segment ids), to look at them: no plates.json is written
//        [--force]          draw every plate again   [--dry-run] the plan, the keys and what is current; no browser   [--no-render] fail if any plate would have to be drawn
//        [--inserts 2]      at most this many labelled screenshots in the manifest (only the app-media manifest's shipped shots, with its exact caption)
//        [--probe [seconds]]   draw N seconds (default 1) of the first plate at each --gl in a comma list and print seconds a frame, the renderer and a projected time
//        [--home-tour]      the ids are homes, whether or not a family lives there     [--no-spline-gate]   draw a family whose camera fails story:spline
//
// A family's plates are the beats the kit's film PLAYS, not always every flagged one: the kit's film is never longer than the film's 110 s (FILM.maxS), so when every flagged beat does not fit, the closing,
// the rooms that show no pair, then the pairs are given up (lib.mts selectBeats; reference/story/film.md "The cap"). Nothing is drawn for a beat that is given up. A home is named by its house id or its film id.
// A home tour's plate declares what it is about as MEASURED (the Core, through the camera that drew it) or no subject at all.
//
// Outputs (outside git, `video/plates/<id>/`, or $CI_PLATES_OUT): plates/<aspect>/<beat>.<key8>.mp4 (H.264, no overlay), logos/, inserts/, cache.json (what each plate was made from: a plate
// whose key has not moved is never drawn again), report.json, and plates.json, written last. reference/story/film.md ("Plates and the home-tour wrap") is the contract.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FILM, filmClock, audioPlacements, captionCues, type FilmClock } from '../../../assets/story/film/layout.js';
import { plateSize, KIT_NAME, PLATE_KEYS, type PlateKey } from '../../../assets/story/film/plates/format.js';
import { loadFamily, filmableSlugs, captionProblems, filmText, FILM_LIGHTING, isFilmLighting, FILM_LIGHTINGS, type Family } from '../lib.mts';
import { gradeSlug, defaultDirs } from '../../story/spline-report.mts';
import { builderHandles, guardTerms, scanText } from '../../portal-redact.mts';
import { shotCaption } from '../../story/lib/media.mts';
import { PLATE_GLS, plateGl, openRig, closeRig, openHouse, warm, renderRange, sampleShot, machine, chromiumId, RigHolder, type PlateGl, type Rig } from './render.mts';
import {
  ROOT, platesDir, segmentsOf, cameraFingerprint, powerRel, segmentKey, doorsSha, engineSha, toolSha, houseSha, composeBeat, cuesOf, familyText, loadCtx, chipsOf, logoFileOf, memberOf,
  buildFamilyManifest, buildHomeManifest, homeBeats, digestOf, manifestProblems, canon, sha256, hash10, familiesDir, homeInfo, homeText, homesWithoutFamily, HOME_TOUR_SHOTS, DEFAULT_SUBJECT, PLATE_KEYS_DEFAULT,
  selectBeats, kitFilmLength, disclosureWords, resolveHome, measureSubject, SUBJECT_V, SUBJECT_SAMPLES,
  type Segment, type Composed, type BeatEntry, type PlateEntry, type InsertEntry, type Profile, type Ctx, type PlatesText, type Chip, type PlanBeat, type Selection, type Measured,
} from './lib.mts';

export const CACHE_V = 1;
/** what the cache remembers about one drawn plate */
export type CacheEntry = { key: string; doorsSha: string | null; file: string; sha256: string; frames: number; durationS: number; bytes: number; width: number; height: number; gl: string; renderer: string; wallSeconds: number; /** a home tour's plate: what it is about, measured from the camera that drew it (lib.mts measureSubject) */ measured?: Measured };
export type Cache = { v: 1; id: string; /** per aspect: a hash of the whole film's camera path, which is what a door's opening is a function of */ pathShas: Record<string, string>; shots?: string[]; entries: Record<string, CacheEntry> };
export const cachePath = (id: string): string => path.join(platesDir(id), 'cache.json');
export function readCache(id: string): Cache {
  const f = cachePath(id);
  try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); if (c && c.v === CACHE_V && c.id === id) return c; } catch { /* none, or not ours */ }
  return { v: CACHE_V, id, pathShas: {}, entries: {} };
}
export function writeCache(c: Cache) {
  fs.mkdirSync(platesDir(c.id), { recursive: true });
  const sorted: Cache = { ...c, entries: Object.fromEntries(Object.keys(c.entries).sort().map(k => [k, c.entries[k]])) };
  const f = cachePath(c.id); fs.writeFileSync(`${f}.part`, JSON.stringify(sorted, null, 1) + '\n'); fs.renameSync(`${f}.part`, f);
}

// ---- the options ---------------------------------------------------------------------------------------------------------------------------------
export type Opts = {
  aspects: PlateKey[]; res: number; gl: PlateGl; lighting: string; force: boolean; dryRun: boolean; noRender: boolean; inserts: number; splineGate: boolean; homeTour: boolean;
  /** draw only these plates (for looking at one: no manifest is written) */ only: string[] | null;
  log: (m: string) => void;
};
export function parseAspects(v: string | undefined): PlateKey[] {
  if (!v || v === 'both') return PLATE_KEYS_DEFAULT.slice();
  if (v === 'all') return PLATE_KEYS.slice();
  const out = v.split(',').map(s => s.trim()) as PlateKey[];
  for (const a of out) if (!PLATE_KEYS.includes(a)) throw new Error(`--aspect must be a list of ${PLATE_KEYS.join(', ')} (or both, all), got ${a}`);
  return out;
}
export function parseOpts(flags: Record<string, string>, log: Opts['log'] = m => console.log(m)): Opts {
  const lighting = flags.lighting || process.env.FILM_LIGHTING || FILM_LIGHTING;
  if (!isFilmLighting(lighting)) throw new Error(`--lighting must be ${FILM_LIGHTINGS.join(' or ')}: a film is held to daylight and warm light (got ${lighting})`);
  if (lighting !== 'day') throw new Error('plates are lit as day: the owner\'s ruling of 2026-10-22 (the kit refuses anything else)');
  const res = +(flags.res || 1080);
  plateSize('16x9', res);          // throws for a size the page does not know
  return {
    aspects: parseAspects(flags.aspect), res, gl: plateGl(flags.gl && flags.gl.includes(',') ? flags.gl.split(',')[0] : flags.gl), lighting,
    force: flags.force === 'true', dryRun: flags['dry-run'] === 'true', noRender: flags['no-render'] === 'true',
    inserts: flags.inserts !== undefined ? Math.max(0, +flags.inserts) : 2, splineGate: flags['no-spline-gate'] !== 'true', homeTour: flags['home-tour'] === 'true', only: flags.only ? flags.only.split(',') : null, log,
  };
}

// ---- one plate's place ------------------------------------------------------------------------------------------------------------------------------
export const plateFile = (aspect: PlateKey, id: string, key: string): string => `plates/${KIT_NAME[aspect]}/${id}.${key.slice(0, 8)}.mp4`;
const exists = (id: string, rel: string): boolean => fs.existsSync(path.join(platesDir(id), rel));
const sha256File = (f: string): string => sha256(fs.readFileSync(f));

/** Is the plate this cache entry names still on disk, byte for byte, and the one this key asks for? */
export function entryCurrent(id: string, e: CacheEntry | undefined, key: string): e is CacheEntry {
  if (!e || e.key !== key || !exists(id, e.file)) return false;
  return sha256File(path.join(platesDir(id), e.file)) === e.sha256;
}

// ---- a family -------------------------------------------------------------------------------------------------------------------------------------------
export type FamilyPlan = {
  /** `segs` are the segments the kit's film plays (the approach and the beats the selection keeps); `allSegs` are all of the film's, whose camera path the doors are a function of */
  fam: Family; clock: FilmClock; segs: Segment[]; allSegs: Segment[]; selection: Selection; text: PlatesText; ctx: Ctx; notes: string[];
  cues: ReturnType<typeof captionCues>;
  /** per aspect: each segment, its size and its key */
  jobs: Record<string, Array<{ seg: Segment; size: ReturnType<typeof plateSize>; key: string; camera: string; /** the plate's camera is the film's turned down by this much (radians) to clear the kit's text */ tilt: number; compose: Composed | null }>>;
  pathShas: Record<string, string>; tool: string; engine: string; house: string; chromium: string;
};
/** Everything about a family's plates that needs no browser: the clock, the segments, the words, the keys. Throws with the reason a family cannot be filmed. */
export async function planFamily(slug: string, o: Opts, chromium: string, ctx?: Ctx): Promise<FamilyPlan> {
  const fam = await loadFamily(slug, { silent: true }), clock = filmClock(fam.rs, { silent: true }), notes: string[] = [];
  const { placements, problems } = audioPlacements(fam.rs, clock);
  if (problems.length) throw new Error(`${slug}: ${problems.join('; ')}`);
  const ft = filmText(fam.rs, undefined, { silent: true }), cues = captionCues(fam.rs, placements, ft.names), caps = captionProblems(cues, clock.duration);
  if (caps.errors.length) throw new Error(`${slug}: ${caps.errors.slice(0, 3).join('; ')}`);
  const c = ctx ?? loadCtx(ROOT, [fam.story]), text = familyText(fam.rs, c.claims), allSegs = segmentsOf(clock);
  // Which beats the kit's film plays. The kit adds a title, the apps, the end card and the disclosures to the plates (about 25 to 40 s), and a film is never longer than FILM.maxS: when every flagged beat
  // does not fit, they are given up in a fixed order (lib.mts DROP_ORDER) and a family that cannot fit even then is refused. Nothing is drawn for a beat that is given up.
  const kindOfChapter = new Map(fam.rs.chapters.map(ch => [ch.id, ch.kind as string])), approach = allSegs[0];
  const planBeats: PlanBeat[] = allSegs.filter(s => s.part).map(s => {
    const b = fam.rs.beats[s.part!.idx], chips = chipsOf(fam.story, b, c, []);
    return { id: s.id, seconds: s.durationS, member: memberOf(fam.rs, b)?.id ?? null, chapter: kindOfChapter.get(b.chapter) ?? 'room', apps: chips.map(x => x.app), pair: chips.some(x => !!x.pairText) };
  });
  const selection = selectBeats({ approachS: approach.durationS, beats: planBeats, disclosureWords: disclosureWords(text.disclosures), slug });
  if (selection.dropped.length) notes.push(`the kit's film would be ${selection.fullS.toFixed(1)} s with all ${planBeats.length} flagged beats and the cap is ${FILM.maxS} s: ${selection.dropped.map(d => `${d.id} (${d.rank}, ${d.seconds.toFixed(1)} s)`).join(', ')} given up, ${selection.keptS.toFixed(1)} s`);
  const segs = allSegs.filter(s => s.kind === 'approach' || selection.kept.includes(s.id));
  const tool = toolSha(), engine = engineSha(), house = houseSha(fam.story.house), jobs: FamilyPlan['jobs'] = {}, pathShas: Record<string, string> = {};
  for (const aspect of o.aspects) {
    const size = plateSize(aspect, o.res), pathParts: unknown[] = [];
    jobs[aspect] = [];
    // (the camera path of the WHOLE film is hashed, the beats given up included: a door opens once, at the first crossing of the whole path)
    for (const seg of allSegs) {
      const kept = segs.includes(seg);
      // the plate is composed for the kit's text: its camera is the film's, turned down just far enough that the beat's subject is clear of the caption and the subtitles
      const b = seg.part ? fam.rs.beats[seg.part.idx] : null, compose = kept && b ? composeBeat(fam.rs, b, size, { title: b.popup.title, cues: cuesOf(cues, seg, clock.fps).map(c => c.text) }) : null, tilt = compose ? compose.tilt : 0;
      const camera = cameraFingerprint(fam.rs, clock, seg, size.aspect, tilt), power = powerRel(fam.rs, clock, seg);
      pathParts.push([seg.id, seg.f0, seg.f1, camera]);
      if (kept) jobs[aspect].push({ seg, size, camera, tilt, compose, key: segmentKey({ house, engine, tool, gl: o.gl, chromium, aspect, w: size.w, h: size.h, fps: clock.fps, lighting: o.lighting, frames: seg.frames, camera, power }) });
    }
    pathShas[aspect] = digestOf(pathParts);
  }
  return { fam, clock, segs, allSegs, selection, text, ctx: c, notes, cues, jobs, pathShas, tool, engine, house, chromium };
}

export type Status = { aspect: PlateKey; seg: Segment; key: string; current: boolean; why?: string };
/** What a plan would draw: every (aspect, segment) with its key, and whether the disk already has that plate. */
export function statusOf(id: string, jobs: FamilyPlan['jobs'], cache: Cache, force: boolean): Status[] {
  const out: Status[] = [];
  for (const [aspect, list] of Object.entries(jobs)) for (const j of list) {
    const e = cache.entries[`${aspect}/${j.seg.id}`], ok = !force && entryCurrent(id, e, j.key);
    out.push({ aspect: aspect as PlateKey, seg: j.seg, key: j.key, current: ok, ...(ok ? {} : { why: force ? 'forced' : !e ? 'not drawn yet' : e.key !== j.key ? 'its inputs changed' : 'the file is missing or not the bytes recorded' }) });
  }
  return out;
}

export const insertsFor = (plan: FamilyPlan, n: number, notes: string[], dir: string): InsertEntry[] => {
  const media = plan.ctx.media, out: InsertEntry[] = [], seen = new Set<string>();
  if (!media || n <= 0) return out;
  for (const b of plan.segs.flatMap(s => (s.part ? [plan.fam.rs.beats[s.part.idx]] : []))) {
    for (const id of [b.app?.id, ...(b.with || [])].filter((x): x is string => !!x)) {
      if (out.length >= n || seen.has(id)) continue;
      seen.add(id);
      const m = media.apps[id], shot = m?.shot;
      if (!m || !shot) continue;
      // only the manifest's own shot, with the manifest's exact caption for where it came from (a QA run's, or a first-party app's own documentation's: media.mts `shotCaption`, never a wording of this file): the kit prints it for as long as the picture is up
      if (shot.caption !== shotCaption(m.name, shot.source || '')) { notes.push(`${id}: the screenshot's caption is not the manifest's wording for ${m.name}; it is not used`); continue; }
      const src = path.join(ROOT, shot.file);
      if (!fs.existsSync(src)) { notes.push(`${id}: ${shot.file} is not in the tree; the screenshot is not used`); continue; }
      const bytes = fs.readFileSync(src), name = `inserts/shot-${id}.${hash10(bytes)}.webp`;
      if (!path.basename(shot.file).includes(`.${hash10(bytes)}.`)) { notes.push(`${id}: ${shot.file} is not the bytes its name says (run pnpm run story:media); the screenshot is not used`); continue; }
      fs.mkdirSync(path.join(dir, 'inserts'), { recursive: true }); fs.writeFileSync(path.join(dir, name), bytes);
      out.push({ id: `shot-${id}`, app: m.name, file: name, sha256: sha256(bytes), width: shot.w, height: shot.h, alt: shot.alt, label: shot.caption });
    }
  }
  return out;
};

/** Copy an app's real logo beside the manifest (hash-named, as the app-media manifest names it) and return its path there. */
function stageLogo(plan: { ctx: Ctx }, appId: string, dir: string, notes: string[]): string | undefined {
  const file = logoFileOf(plan.ctx.media, appId);
  if (!file) { notes.push(`${appId}: no logo in content/story/app-media.json (the app is shown by its name alone)`); return undefined; }
  const src = path.join(ROOT, file);
  if (!fs.existsSync(src)) { notes.push(`${appId}: ${file} is not in the tree (pnpm run story:media); the app is shown by its name alone`); return undefined; }
  const bytes = fs.readFileSync(src), h = hash10(bytes);
  if (!path.basename(file).includes(`.${h}.`)) { notes.push(`${appId}: ${file} is not the bytes its name says (pnpm run story:media); the app is shown by its name alone`); return undefined; }
  const rel = `logos/${appId}.${h}.webp`;
  fs.mkdirSync(path.join(dir, 'logos'), { recursive: true }); fs.writeFileSync(path.join(dir, rel), bytes);
  return rel;
}

export async function runFamily(slug: string, o: Opts, holder: RigHolder = new RigHolder(o.gl)): Promise<{ ok: boolean; id: string; dir: string; manifest?: any; error?: string; seconds: number; drawn: number; current: number; notes: string[] }> {
  const t0 = Date.now(), log = (m: string) => o.log(`${slug}: ${m}`);
  let plan: FamilyPlan | null = null;
  try {
    // the camera gate (reference/story/spline.md): a film is drawn only from a family whose tour passes it
    if (o.splineGate && !o.dryRun) {
      const sp = await gradeSlug(slug, { ...defaultDirs(), families: familiesDir() }), fails = sp.defects.filter(d => d.sev === 'fail');
      if (fails.length) throw new Error(`the camera spline gate fails (${fails.length}): ${fails.slice(0, 3).map(d => `${d.rule}${d.beat ? ` [${d.beat}]` : ''}: ${d.msg}`).join(' | ')}${fails.length > 3 ? ' | ...' : ''} (pnpm run story:spline -- ${slug}; --no-spline-gate to draw anyway)`);
      log(`camera gate: ${sp.status} (${sp.warns} warnings)`);
    }
    plan = await planFamily(slug, o, await chromiumId());
    const dir = platesDir(slug), cache = readCache(slug), id = slug;
    for (const n of plan.notes) log(`note: ${n}`);
    if (o.only) for (const a of o.aspects) plan.jobs[a] = plan.jobs[a].filter(j => o.only!.includes(j.seg.id));
    let status = statusOf(id, plan.jobs, cache, o.force);
    // the browser is started only when a plate has to be drawn, or when the camera path moved and the doors have to be compared
    const pathMoved = o.aspects.some(a => cache.pathShas[a] !== plan!.pathShas[a]);
    const stale = status.filter(s => !s.current);
    if (o.dryRun) {
      log(`${plan.segs.length} plates x ${o.aspects.length} aspects: ${status.length - stale.length} current, ${stale.length} to draw (${stale.reduce((a, s) => a + s.seg.frames, 0)} of ${plan.segs.reduce((a, s) => a + s.frames, 0) * o.aspects.length} frames)${pathMoved && !stale.length ? '; the camera path moved, so the doors would be compared' : ''}`);
      for (const s of stale.slice(0, 40)) log(`  ${s.aspect} ${s.seg.id}: ${s.why}`);
      return { ok: true, id, dir, seconds: (Date.now() - t0) / 1000, drawn: 0, current: status.length - stale.length, notes: plan.notes };
    }
    let drawn = 0, rigInfo: { chromium: string; ffmpeg: string; gl: string } | null = null;
    if (stale.length || pathMoved) {
      if (o.noRender) throw new Error('--no-render: a plate would have to be drawn');
      const rig = await holder.get();
      rigInfo = { chromium: rig.chromium, ffmpeg: rig.ffmpeg, gl: rig.gl };
      const home = await openHouse(rig, plan.fam.story.house, { res: o.res, lighting: o.lighting, log }), renderer = home.renderer;
      try {
        for (const aspect of o.aspects) {
          const jobs = plan.jobs[aspect], size = jobs[0].size;
          await warm(home.page, aspect, size.pageRes);
          const info = await home.page.evaluate(async (a: any) => { // @ts-ignore (a URL in the page, not a module of this script)
            const P = await import('/assets/story/film/plates/index.js'); (window as any).__plates = P; return P.prepare(a); }, { rs: plan.fam.rs, key: aspect, res: o.res, silent: true, tilts: jobs.map(j => ({ f0: j.seg.f0, f1: j.seg.f1, rad: j.tilt })) });
          if (info.frames !== plan.clock.frames) throw new Error(`the page has ${info.frames} frames, the clock ${plan.clock.frames}`);
          for (const j of jobs) {
            const k = `${aspect}/${j.seg.id}`, e = cache.entries[k], ds = doorsSha(info.doors, j.seg);
            // a plate is current when its key is and the doors the whole path plans for its frames are the ones it was drawn with
            if (!o.force && entryCurrent(id, e, j.key) && e.doorsSha === ds && e.renderer === renderer) continue;
            const file = plateFile(aspect, j.seg.id, j.key), out = path.join(dir, file);
            log(`${aspect} ${j.seg.id}: drawing ${j.seg.frames} frames (${j.seg.durationS.toFixed(1)} s)`);
            const r = await renderRange(home.page, j.seg.f0, j.seg.f1, out, { fps: plan.clock.fps, label: `${aspect} ${j.seg.id}`, onProgress: (d, t) => { if (d === t || d % 120 < 12) process.stdout.write(`\r  ${aspect} ${j.seg.id}: ${d} / ${t}   `); } });
            process.stdout.write('\n');
            cache.entries[k] = { key: j.key, doorsSha: ds, file, sha256: r.sha256, frames: r.frames, durationS: j.seg.durationS, bytes: r.bytes, width: size.w, height: size.h, gl: rig.gl, renderer, wallSeconds: +r.wallSeconds.toFixed(1) };
            writeCache(cache);
            drawn++;
            log(`  ${(r.bytes / 1048576).toFixed(1)} MiB, ${r.wallSeconds.toFixed(0)} s wall (${(r.wallSeconds / r.frames).toFixed(2)} s a frame)`);
          }
          await home.page.evaluate(() => (window as any).__plates.end());
          if (!o.only) { cache.pathShas[aspect] = plan.pathShas[aspect]; writeCache(cache); }
        }
      } finally { await home.ctx.close().catch(() => {}); }
    }
    // every plate must be there now
    status = statusOf(id, plan.jobs, cache, false);
    if (o.only) return { ok: true, id, dir, seconds: (Date.now() - t0) / 1000, drawn, current: status.length - drawn, notes: plan.notes };      // (a look at some plates: no manifest)
    const missing = status.filter(s => !s.current);
    if (missing.length) throw new Error(`${missing.length} plate(s) are not drawn: ${missing.slice(0, 4).map(s => `${s.aspect} ${s.seg.id}`).join(', ')}`);
    const manifest = writeFamilyManifest(plan, cache, rigInfo, o, log);
    return { ok: true, id, dir, manifest, seconds: (Date.now() - t0) / 1000, drawn, current: status.length - drawn, notes: plan.notes };
  } catch (e: any) {
    return { ok: false, id: slug, dir: platesDir(slug), error: e.message, seconds: (Date.now() - t0) / 1000, drawn: 0, current: 0, notes: plan?.notes || [] };
  }
}

/** plates.json, from the cache and the words as they are now. Written last, so a manifest is only ever beside plates that exist. */
export function writeFamilyManifest(plan: FamilyPlan, cache: Cache, rigInfo: { chromium: string; ffmpeg: string; gl: string } | null, o: Opts, log: (m: string) => void): any {
  const { fam } = plan, id = fam.slug, dir = platesDir(id), rs = fam.rs, notes: string[] = [];
  const prev = readPrevProfile(id);
  const profile: Profile = rigInfo ? { chromium: rigInfo.chromium, renderer: Object.values(cache.entries)[0]?.renderer ?? 'unknown', ffmpeg: rigInfo.ffmpeg, gl: rigInfo.gl, machine: machine() } : prev || { chromium: 'unrecorded', renderer: Object.values(cache.entries)[0]?.renderer ?? 'unknown', ffmpeg: 'unrecorded', gl: o.gl };
  const beats: BeatEntry[] = [];
  const logos = new Map<string, string | undefined>();
  const logoOf = (appId: string) => { if (!logos.has(appId)) logos.set(appId, stageLogo(plan, appId, dir, notes)); return logos.get(appId); };
  for (const seg of plan.segs) {
    const plates: BeatEntry['plates'] = {};
    for (const aspect of o.aspects) {
      const e = cache.entries[`${aspect}/${seg.id}`], j = plan.jobs[aspect].find(x => x.seg.id === seg.id)!;
      const sj = j.compose ?? { subject: DEFAULT_SUBJECT[aspect], declared: true, camera: { preset: 'story-track', tourFromS: 0, tourToS: plan.clock.establish, note: 'the approach to the front door' } };
      plates[KIT_NAME[aspect]] = {
        file: e.file, sha256: e.sha256, durationS: e.durationS, width: e.width, height: e.height, subject: sj.subject,
        camera: { ...sj.camera, subjectDeclared: sj.declared, ...(j.compose ? { clearOfKitText: j.compose.cleared } : {}), segmentKey: e.key, frames: [seg.f0, seg.f1] },
      } as PlateEntry;
    }
    if (seg.kind === 'approach') {
      beats.push({ id: seg.id, member: null, title: rs.family.address.place, chips: [], plates });
      continue;
    }
    const b = rs.beats[seg.part!.idx], chips: Chip[] = chipsOf(fam.story, b, plan.ctx, notes).map(c => {
      const logo = logoOf(c.id);
      return { app: c.app, ...(logo ? { logo } : {}), ...(c.pairText ? { pairText: c.pairText } : {}) };
    });
    const cues = cuesOf(plan.cues, seg, plan.clock.fps);
    beats.push({ id: seg.id, member: memberOf(rs, b), title: b.popup.title, body: b.popup.body, chips, ...(cues.length ? { cues } : {}), plates });
  }
  // The kit's film, counted before it is rendered (lib.mts kitFilmLength, the kit's own recipe): it is never over the cap. The beats were chosen to fit without screenshots (selectBeats); a screenshot is 6 s
  // and is added only while the film stays under the cap, after the story is chosen. A manifest that would break the cap is not written, whatever chose its beats.
  const apps = new Set(beats.flatMap(b => b.chips.map(c => c.app))).size, words = disclosureWords(plan.text.disclosures);
  const kitBeats = beats.map(b => ({ seconds: Math.max(...Object.values(b.plates).map(p => p!.durationS)), member: b.member?.id ?? null }));
  const kitS = (n: number) => kitFilmLength({ beats: kitBeats, apps, inserts: n, disclosureWords: words });
  if (kitS(0) > FILM.maxS) throw new Error(`the kit's film for ${id} would be ${kitS(0).toFixed(1)} s, over the ${FILM.maxS} s cap: no manifest is written`);
  let want = o.inserts;
  while (want > 0 && kitS(want) > FILM.maxS) want--;
  if (want < o.inserts) notes.push(`the kit's film would run past ${FILM.maxS} s with ${o.inserts} screenshots; ${want} written`);
  const inserts = insertsFor(plan, want, notes, dir);
  notes.push(`the kit's film: ${kitS(inserts.length).toFixed(1)} s (the cap is ${FILM.maxS} s)`);
  const platesSha = digestOf(beats.map(b => Object.entries(b.plates).map(([a, p]) => [b.id, a, p!.sha256])));
  const manifest = buildFamilyManifest({
    fam, beats, inserts, text: plan.text, profile, platesSha, claimsSha: digestOf(plan.text),
    inputsSha: digestOf({ story: fam.shas.story, bake: fam.shas.bake, voice: fam.shas.voice, tool: plan.tool, engine: plan.engine, house: plan.house, res: o.res, aspects: o.aspects, lighting: o.lighting, text: plan.text, inserts: inserts.map(i => i.sha256), logos: [...logos.values()] }),
  });
  lintAndWrite(manifest, plan.ctx, id, dir, notes, log);
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ id, kind: 'family-film', res: o.res, aspects: o.aspects, selection: { fullS: plan.selection.fullS, keptS: plan.selection.keptS, capS: plan.selection.capS, dropped: plan.selection.dropped }, gl: profile.gl, renderer: profile.renderer, notes: [...plan.notes, ...notes], plates: Object.fromEntries(Object.entries(cache.entries).map(([k, e]) => [k, { frames: e.frames, bytes: e.bytes, wallSeconds: e.wallSeconds, spf: +(e.wallSeconds / Math.max(1, e.frames)).toFixed(3) }])) }, null, 1) + '\n');
  return manifest;
}
const prevProfilePath = (id: string) => path.join(platesDir(id), 'plates.json');
function readPrevProfile(id: string): Profile | null { try { return JSON.parse(fs.readFileSync(prevProfilePath(id), 'utf8')).profile; } catch { return null; } }

/** The renderer's own checks on its manifest (the kit's `import-home` runs its own on top), then the file, last. */
function lintAndWrite(manifest: any, ctx: Ctx, id: string, dir: string, notes: string[], log: (m: string) => void) {
  const terms = guardTerms(builderHandles(ROOT)), credit = new RegExp(terms.map(t => `(?:${t.re.source})`).join('|'), 'i');
  const problems = manifestProblems(manifest, ctx.claims as any, credit);
  for (const t of terms) problems.push(...scanText('plates.json', JSON.stringify(manifest), [t]));
  if (problems.length) throw new Error(`plates.json for ${id} breaks the film's rules:\n    ${problems.slice(0, 12).join('\n    ')}`);
  const out = path.join(dir, 'plates.json');
  fs.writeFileSync(`${out}.part`, JSON.stringify(manifest, null, 2) + '\n'); fs.renameSync(`${out}.part`, out);
  for (const n of notes) log(`note: ${n}`);
  // plates no manifest names any more (an older key's file) go
  const named = new Set<string>(manifest.beats.flatMap((b: any) => Object.values<any>(b.plates).map(p => p.file)));
  for (const k of ['landscape', 'portrait', 'square']) {
    const d = path.join(dir, 'plates', k);
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (!named.has(`plates/${k}/${f}`)) fs.rmSync(path.join(d, f), { force: true });
  }
  log(`plates.json: ${manifest.beats.length} beats, ${manifest.beats.reduce((n: number, b: any) => n + Object.keys(b.plates).length, 0)} plates, ${(manifest.inserts || []).length} screenshots -> ${path.relative(ROOT, out)}`);
}

// ---- a home with no family ---------------------------------------------------------------------------------------------------------------------------
export async function runHome(houseId: string, o: Opts, holder: RigHolder = new RigHolder(o.gl)) {
  const t0 = Date.now(), info = homeInfo(houseId), id = info.id, log = (m: string) => o.log(`${id}: ${m}`);
  let rig: Rig | null = null;
  try {
    const chromium0 = await chromiumId();
    const dir = platesDir(id), cache = readCache(id), tool = toolSha(), engine = engineSha(), house = houseSha(houseId), claims = loadCtx(ROOT).claims;
    const keyOf = (shot: string, aspect: PlateKey, chromium: string) => { const size = plateSize(aspect, o.res); return segmentKey({ house, engine, tool, gl: o.gl, chromium, aspect, w: size.w, h: size.h, fps: FILM.fps, lighting: o.lighting, frames: 0, camera: shot, power: null, shot }); };
    const wanted = cache.shots && cache.shots.length ? cache.shots : HOME_TOUR_SHOTS.slice();
    const statusNow = (chromium: string) => o.aspects.flatMap(a => wanted.map(shot => { const k = keyOf(shot, a, chromium), e = cache.entries[`${a}/${shot}`]; return { aspect: a, shot, key: k, current: !o.force && entryCurrent(id, e, k) }; }));
    const status = statusNow(chromium0);
    if (o.dryRun) { log(`${wanted.length} shots x ${o.aspects.length} aspects: ${status.filter(s => s.current).length} current`); return { ok: true, id, dir, seconds: 0, drawn: 0 }; }
    // a plate is also unfinished until its subject is measured (from the camera that drew it: a picture that is current needs the page opened, not drawn again)
    const unmeasured = (e: CacheEntry | undefined) => !e || !e.measured || e.measured.v !== SUBJECT_V;
    const need = status.filter(s => !o.only || o.only.includes(s.shot)).some(s => !s.current || unmeasured(cache.entries[`${s.aspect}/${s.shot}`])) || !cache.shots;
    let drawn = 0, renderer = Object.values(cache.entries)[0]?.renderer ?? 'unknown';
    if (need) {
      if (o.noRender) throw new Error('--no-render: a plate would have to be drawn');
      rig = await holder.get();
      const home = await openHouse(rig, houseId, { res: o.res, lighting: o.lighting, log });
      renderer = home.renderer;
      try {
        const present: string[] = await home.page.evaluate((shots: string[]) => { const d = (window as any).__houseDebug(); return shots.filter(s => d.presets[`house:${d.house.id}:${s}`]); }, HOME_TOUR_SHOTS.slice());
        cache.shots = present;
        for (const aspect of o.aspects) {
          const size = plateSize(aspect, o.res);
          await warm(home.page, aspect, size.pageRes);
          for (const shot of present.filter(x => !o.only || o.only.includes(x))) {
            const key = keyOf(shot, aspect, chromium0), k = `${aspect}/${shot}`, e = cache.entries[k];
            const have = !o.force && entryCurrent(id, e, key) && e.renderer === renderer;
            if (have && !unmeasured(e)) continue;
            const info2 = await home.page.evaluate(async (a: any) => { // @ts-ignore (a URL in the page, not a module of this script)
              const P = await import('/assets/story/film/plates/index.js'); (window as any).__plates = P; return P.prepareShot(a); }, { shot: `house:${houseId}:${shot}`, key: aspect, res: o.res, fps: FILM.fps });
            let entry: CacheEntry = e;
            if (!have) {
              const file = plateFile(aspect, shot, key), out = path.join(dir, file);
              log(`${aspect} ${shot}: drawing ${info2.frames} frames (${info2.duration.toFixed(1)} s)`);
              const r = await renderRange(home.page, 0, info2.frames, out, { fps: FILM.fps, label: `${aspect} ${shot}`, onProgress: (d, t) => { if (d === t || d % 120 < 12) process.stdout.write(`\r  ${aspect} ${shot}: ${d} / ${t}   `); } });
              process.stdout.write('\n');
              entry = { key, doorsSha: null, file, sha256: r.sha256, frames: r.frames, durationS: +(info2.frames / FILM.fps).toFixed(3), bytes: r.bytes, width: size.w, height: size.h, gl: rig!.gl, renderer, wallSeconds: +r.wallSeconds.toFixed(1) };
              drawn++;
              log(`  ${(r.bytes / 1048576).toFixed(1)} MiB, ${r.wallSeconds.toFixed(0)} s wall (${(r.wallSeconds / r.frames).toFixed(2)} s a frame)`);
            }
            // what the plate is about: the Core, in the camera that drew the plate (read back after the plate is drawn, so no pixel of it depends on this)
            const sm = await sampleShot(home.page, info2.frames, SUBJECT_SAMPLES), measured = measureSubject(sm.samples as any, sm.core, size, shot);
            await home.page.evaluate(() => (window as any).__plates.end());
            cache.entries[k] = { ...entry, measured }; writeCache(cache);
            log(`${aspect} ${shot}: ${measured.subject ? `about the Core, ${JSON.stringify(measured.subject)} (in view in ${(measured.camera as any).coreInView} of ${SUBJECT_SAMPLES} frames)` : `no subject: ${(measured.camera as any).why}`}`);
          }
        }
      } finally { await home.ctx.close().catch(() => {}); }
    }
    writeCache(cache);
    if (o.only) return { ok: true, id, dir, seconds: (Date.now() - t0) / 1000, drawn };      // (a look at some plates: no manifest)
    const shots = cache.shots || [], beats = homeBeats(info, shots, shot => {
      const plates: BeatEntry['plates'] = {};
      for (const aspect of o.aspects) {
        const e = cache.entries[`${aspect}/${shot}`];
        if (!e) throw new Error(`${aspect} ${shot} is not drawn`);
        if (unmeasured(e)) throw new Error(`${aspect} ${shot}: its subject is not measured`);
        // (the subject is the Core as measured, or none: the kit has then nothing to protect, and the record says why. Never a rectangle this renderer chose.)
        plates[KIT_NAME[aspect]] = { file: e.file, sha256: e.sha256, durationS: e.durationS, width: e.width, height: e.height, ...(e.measured!.subject ? { subject: e.measured!.subject } : {}), camera: { ...e.measured!.camera, segmentKey: e.key } };
      }
      return plates;
    });
    if (!beats.length) throw new Error('the home has none of its own shots');
    const text = homeText(info, claims);
    const platesSha = digestOf(beats.map(b => Object.entries(b.plates).map(([a, p]) => [b.id, a, p!.sha256])));
    const profile: Profile = { chromium: rig?.chromium ?? readPrevProfile(id)?.chromium ?? 'unrecorded', renderer, ffmpeg: rig?.ffmpeg ?? readPrevProfile(id)?.ffmpeg ?? 'unrecorded', gl: rig?.gl ?? o.gl, ...(rig ? { machine: machine() } : {}) };
    const manifest = buildHomeManifest({ info, beats, text, profile, lighting: o.lighting, platesSha, claimsSha: digestOf(text), inputsSha: digestOf({ tool, engine, house, res: o.res, aspects: o.aspects, lighting: o.lighting, text, shots }) });
    lintAndWrite(manifest, { claims, catalog: new Map(), media: null, index: null, root: ROOT } as any, id, dir, [], log);
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ id, kind: 'home-tour', house: houseId, res: o.res, aspects: o.aspects, gl: profile.gl, renderer, shots, subjects: Object.fromEntries(Object.entries(cache.entries).map(([k, e]) => [k, e.measured ? { subject: e.measured.subject, ...(e.measured.camera as object) } : null])), plates: Object.fromEntries(Object.entries(cache.entries).map(([k, e]) => [k, { frames: e.frames, bytes: e.bytes, wallSeconds: e.wallSeconds, spf: +(e.wallSeconds / Math.max(1, e.frames)).toFixed(3) }])) }, null, 1) + '\n');
    return { ok: true, id, dir, manifest, seconds: (Date.now() - t0) / 1000, drawn };
  } catch (e: any) { return { ok: false, id, dir: platesDir(id), error: e.message, seconds: (Date.now() - t0) / 1000, drawn: 0 }; }
}

// ---- the probe -----------------------------------------------------------------------------------------------------------------------------------------
/** Draw a few seconds of the first plate at each GL path and say what each costs: the only way to know whether a night on the Intel iGPU is the right night. */
export async function probe(slug: string, gls: PlateGl[], o: Opts, seconds: number) {
  const out: any[] = [];
  for (const gl of gls) {
    const rig = await openRig(gl);
    try {
      const plan = await planFamily(slug, { ...o, gl }, rig.chromium);
      const home = await openHouse(rig, plan.fam.story.house, { res: o.res, lighting: o.lighting, log: o.log });
      try {
        const aspect = o.aspects[0], size = plan.jobs[aspect][0].size, seg = plan.segs[1] ?? plan.segs[0], n = Math.max(6, Math.round(seconds * plan.clock.fps));
        await warm(home.page, aspect, size.pageRes);
        await home.page.evaluate(async (a: any) => { // @ts-ignore
          const P = await import('/assets/story/film/plates/index.js'); (window as any).__plates = P; return P.prepare(a); }, { rs: plan.fam.rs, key: aspect, res: o.res, silent: true });
        const f0 = seg.f0, tmp = path.join(platesDir('probe'), `${slug}.${gl}.mp4`);
        await home.page.evaluate((i: number) => { const P = (window as any).__plates; P.frame(i, 0.9); P.frame(i, 0.9); }, f0);   // two untimed frames warm the shaders
        const r = await renderRange(home.page, f0, f0 + n, tmp, { fps: plan.clock.fps, label: `probe ${gl}` });
        const total = plan.segs.reduce((a, s) => a + s.frames, 0) * o.aspects.length;
        const spf = r.wallSeconds / r.frames;
        out.push({ gl, renderer: home.renderer, aspect, res: o.res, frames: r.frames, seconds: +r.wallSeconds.toFixed(2), spf: +spf.toFixed(3), plateFramesPerFamily: total, projectedMinutes: +(total * spf / 60).toFixed(1), load: fs.readFileSync('/proc/loadavg', 'utf8').trim() });
        o.log(`probe ${gl}: ${home.renderer}: ${spf.toFixed(3)} s a frame at ${size.w}x${size.h}; ${total} plate frames for ${o.aspects.join(' + ')} is about ${(total * spf / 60).toFixed(0)} min`);
        await home.page.evaluate(() => (window as any).__plates.end());
      } finally { await home.ctx.close().catch(() => {}); }
    } finally { await closeRig(rig); }
  }
  // (named by the size too: the two GL paths swap places between 540 p and 1080 p, so a probe is a statement about one size)
  fs.mkdirSync(platesDir('probe'), { recursive: true });
  fs.writeFileSync(path.join(platesDir('probe'), `${slug}.probe.${o.res}.json`), JSON.stringify({ slug, res: o.res, results: out }, null, 1) + '\n');
  return out;
}

// ---- main --------------------------------------------------------------------------------------------------------------------------------------------------
export function parseArgv(argv: string[]): { flags: Record<string, string>; ids: string[] } {
  const valued = new Set(['aspect', 'res', 'gl', 'lighting', 'inserts', 'jobs', 'only']), flags: Record<string, string> = {}, ids: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { ids.push(a); continue; }
    const k = a.slice(2);
    if (k === 'probe') flags[k] = /^\d+(\.\d+)?$/.test(argv[i + 1] || '') ? argv[++i] : 'true';
    else flags[k] = valued.has(k) ? argv[++i] : 'true';
  }
  return { flags, ids };
}

/** What an id means: a family's slug (a family film) or a home's id (a home tour). */
export function kindOf(id: string, forceHome: boolean): 'family' | 'home' | null {
  if (!forceHome && fs.existsSync(path.join(familiesDir(), `${id}.bake.json`))) return 'family';
  return resolveHome(id) ? 'home' : null;
}

export async function main(argv: string[]): Promise<number> {
  const { flags, ids } = parseArgv(argv);
  let o: Opts;
  try { o = parseOpts(flags); } catch (e: any) { console.error(e.message); return 2; }
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0 && !o.dryRun) { console.error('ffmpeg is not on PATH'); return 2; }
  const list = [...ids];
  if (flags.all === 'true') list.push(...filmableSlugs(), ...homesWithoutFamily());
  else if (flags.homes === 'true') list.push(...homesWithoutFamily());
  if (!list.length) { console.error('no families or homes to film: name a family slug or a home id, or --all / --homes'); return 2; }
  if (flags.probe) {
    const gls = (flags.gl || 'default').split(',') as PlateGl[];
    for (const g of gls) if (!PLATE_GLS.includes(g)) { console.error(`--gl must be a list of ${PLATE_GLS.join(', ')}`); return 2; }
    await probe(list[0], gls, { ...o, aspects: o.aspects.slice(0, 1), res: +(flags.res || 540) }, flags.probe === 'true' ? 1 : +flags.probe);
    return 0;
  }
  const results: Array<{ ok: boolean; id: string; error?: string; seconds: number; drawn?: number }> = [], holder = new RigHolder(o.gl);
  try {
    for (const id of [...new Set(list)]) {
      const kind = kindOf(id, o.homeTour);
      if (!kind) { console.error(`✗ ${id}: not a family with a bake lock, nor a home`); results.push({ ok: false, id, error: 'unknown', seconds: 0 }); continue; }
      const r = kind === 'family' ? await runFamily(id, o, holder) : await runHome(resolveHome(id)!, o, holder);      // (a home by its house id or by its film id)
      results.push(r);
      if (!r.ok) console.error(`✗ ${id}: ${r.error}`);
      else console.log(`✓ ${id}: ${r.drawn ?? 0} plate(s) drawn in ${r.seconds.toFixed(0)} s`);
    }
  } finally { await holder.close(); }
  const bad = results.filter(r => !r.ok);
  console.log(`${results.length - bad.length} of ${results.length} ok`);
  return bad.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main(process.argv.slice(2)));
