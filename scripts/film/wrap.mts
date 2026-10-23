#!/usr/bin/env -S node --experimental-strip-types
// story:film:wrap. The compliance wrap around CI-Common's video-kit: a family's (or a home's) plates.json goes through `ci-video import-home`, `build`, `check` and `render`, and
// what comes out is held to this repository's rules before it is kept. This replaces scripts/film-bookends.mts (which only found the kit and ran its `doctor`).
//
//   pnpm run story:film:wrap -- <id> [<id> ...]        id = a family slug, or a home's film id (garden-flat), whose plates.json `story:film -- <id> --plates` wrote
//        [--kit <dir>]        a CI-Common checkout (or its packages/video-kit) with video-kit 0.35.0 or newer: `import-home` is CI-Common #429. $CI_COMMON_KIT sets it too.
//                             Default: video/kit/ci-common, made by `--setup-kit` (a detached worktree of $CI_COMMON_REF, default consolidate/virtual-home-source, until #429 is on main)
//        [--setup-kit]        make that worktree and install the kit's dependencies (no scripts, no browser download), then exit
//        [--quality draft|high]   the kit's render quality (default high; draft is for looking)
//        [--recipe film|cut30|cut15|all]   the kit's cuts beside the film (default: every cut the manifest can make)
//        [--no-render]        import, build, check and run the compliance checks; do not render      [--checks-only] only the compliance checks of an existing project (nothing is run)
//        [--strict-cuts]      a short cut the kit's own gate refuses is an error (default: it is left out of the render, said in the report, and the film is kept)
//
// What it checks (every one is an error, and none has an override): the disclosures the kit prints equal claims.json's words, in the order the film prints them, and are the ones this film owes
// (a family film: the fictional line, scripted scenes, the stylised Core, the agents' attribution when an agent is named; a home with no family: the stylised Core only); the label on every
// frame is the fictional line (a home: its display name); the lighting is day; the one link is exactly ci.computer/core and no other address is printed; the copy lint of
// scripts/story/check-copy.mts (claims.json's rules and the extra ones, the word "beta" among them) over the storyboard and every WebVTT; the credit scan (no builder handle, no "Sims", no
// "Base Game") over the storyboard, the manifest, the subtitles and every file's metadata; and the picture gates of scripts/film/qa.mts (ffprobe, freezedetect, the size, a blank first or last
// frame) over every MP4 the kit wrote, with the frames and the length the kit's own `build` said each would have. The kit's `check` (the caption-versus-subject gate among them) must pass too.
// Needs ffmpeg, ffprobe, Node, and the kit's own requirements (HyperFrames, its Chrome). Nothing here is a dependency of the repository: the kit is a tool found through a path.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, loadClaims, loadFamily, filmDisclosureIds, sha256, type Claims } from './lib.mts';
import { probe, gate as filmGate } from './qa.mts';
import { edgeSpread, BLANK_STD } from './ads-qa.mts';
import { builderHandles, guardTerms, scanText, type GuardTerm } from '../portal-redact.mts';
import { FILM } from '../../assets/story/film/layout.js';
import { platesDir, kitProjectsRoot, copyProblems, canon } from './plates/lib.mts';

export const KIT_ENV = 'CI_COMMON_KIT';
export const KIT_MIN = [0, 35, 0] as const;
/** the link a home film's end card carries, and the one nothing else may print */
export const LINK = 'ci.computer/core';
/**
 * A picture that does not change for this long is a fault in a film made through the kit; one shorter is said. The repository's own film refuses 2 s (qa.mts FREEZE_S) because a karaoke highlight moves on
 * every frame of it, so a stopped picture can only be a stuck render; the kit's subtitles change once a cue, and the bake rests the camera while a caption is read, so a captioned room at rest holds still for
 * the length of a cue (measured on the Brennan homes of the pilot: none, 1.7 to 1.9 s and 2.0 to 3.0 s). This is the one gate the wrap reads differently from the film's, and the film.md says so.
 * (The film's length cap is NOT read differently: a kit film is at most FILM.maxS, as the film is, and the plates select their beats to fit it.)
 */
export const KIT_FREEZE_MAX_S = 4;

// ---- the kit --------------------------------------------------------------------------------------------------------------------------------------------
export type Kit = { dir: string; bin: string; version: string };
const vnum = (v: string): number[] => v.split('.').map(n => parseInt(n, 10) || 0);
export const versionAtLeast = (v: string, min: readonly number[]): boolean => { const a = vnum(v); for (let i = 0; i < min.length; i++) { if ((a[i] ?? 0) !== min[i]) return (a[i] ?? 0) > min[i]; } return true; };
export const defaultKitDir = (): string => path.join(ROOT, 'video', 'kit', 'ci-common');

/** Find the kit: a path to a CI-Common checkout or to its packages/video-kit. Throws with the way to get one. */
export function findKit(flag?: string, env: Record<string, string | undefined> = process.env): Kit {
  const given = flag || env[KIT_ENV] || defaultKitDir(), root = path.resolve(given);
  for (const dir of [root, path.join(root, 'packages', 'video-kit')]) {
    const bin = path.join(dir, 'bin', 'ci-video.ts'), pkg = path.join(dir, 'package.json');
    if (!fs.existsSync(bin) || !fs.existsSync(pkg)) continue;
    const version = JSON.parse(fs.readFileSync(pkg, 'utf8')).version as string;
    if (!versionAtLeast(version, KIT_MIN)) throw new Error(`the video-kit at ${dir} is ${version}; plates need ${KIT_MIN.join('.')} or newer (CI-Common #429, branch consolidate/virtual-home-source, until it is on main)`);
    if (!/import-home/.test(fs.readFileSync(path.join(dir, 'bin', 'usage.txt'), 'utf8'))) throw new Error(`the video-kit at ${dir} has no \`import-home\` (CI-Common #429)`);
    return { dir, bin, version };
  }
  throw new Error(`no video-kit found at ${root}; point ${KIT_ENV} (or --kit) at a CI-Common checkout, or run \`pnpm run story:film:wrap -- --setup-kit\``);
}

/** `--setup-kit`: a detached worktree of CI-Common at $CI_COMMON_REF and the kit's dependencies, installed with no scripts (no browser is downloaded). */
export function setupKit(env: Record<string, string | undefined> = process.env): string {
  const repo = path.resolve(env.CI_COMMON_REPO || path.join(ROOT, '..', 'CI-Common')), ref = env.CI_COMMON_REF || 'consolidate/virtual-home-source', dir = defaultKitDir();
  if (!fs.existsSync(path.join(repo, '.git'))) throw new Error(`no CI-Common repository at ${repo} (set CI_COMMON_REPO)`);
  if (fs.existsSync(dir)) { console.log(`wrap: ${dir} exists`); return dir; }
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const w = spawnSync('git', ['-C', repo, 'worktree', 'add', '--detach', dir, ref], { stdio: 'inherit' });
  if (w.status !== 0) throw new Error(`git worktree add ${ref} failed`);
  const i = spawnSync('pnpm', ['--dir', dir, 'install', '--frozen-lockfile', '--prefer-offline', '--filter', '@companionintelligence/video-kit...', '--ignore-scripts'], { stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });
  if (i.status !== 0) throw new Error('pnpm install in the kit failed');
  return dir;
}

type Step = { code: number; out: string };
/** Run one `ci-video` command on a project. The output goes to <project>/wrap.<step>.log as well as back to the caller. */
export function runKit(kit: Kit, project: string, args: string[], o: { env?: Record<string, string>; timeoutMs?: number; log?: boolean } = {}): Promise<Step> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', kit.bin, ...args, '--project', project], { env: { ...process.env, ...(o.env || {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; const take = (d: Buffer) => { out += d; };
    child.stdout.on('data', take); child.stderr.on('data', take);
    const timer = o.timeoutMs ? setTimeout(() => child.kill('SIGKILL'), o.timeoutMs) : null;
    child.on('close', code => { if (timer) clearTimeout(timer); fs.mkdirSync(project, { recursive: true }); fs.writeFileSync(path.join(project, `wrap.${args[0]}.log`), out); resolve({ code: code ?? 1, out }); });
  });
}

// ---- reading what the kit made --------------------------------------------------------------------------------------------------------------------------
type Scene = Record<string, any>;
type Board = { app?: any; source?: any; meta?: any; chapters?: Record<string, string>; scenes: Scene[]; deliverables?: Array<{ id: string; kind: string; name?: string; formats?: string[]; scenes: Scene[] }> };
/** every cut of a storyboard, the film first: its id and its scenes */
export const cutsOf = (sb: Board): Array<{ id: string; scenes: Scene[] }> => [{ id: sb.app?.id ?? 'film', scenes: sb.scenes }, ...(sb.deliverables || []).map(d => ({ id: d.id, scenes: d.scenes }))];

/** The keys of a scene whose strings a viewer reads. (Paths, ids, kinds and the motion words are not words.) */
const READ_KEYS = new Set(['title', 'caption', 'tagline', 'cta', 'label', 'alt', 'text', 'name', 'value', 'narration', 'kicker']);
/** Every string a viewer can read in a storyboard, with where it is. The link is read separately (`linkProblems`). */
export function readableStrings(sb: Board): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (v: any, at: string, key = '') => {
    if (typeof v === 'string') { if (READ_KEYS.has(key)) out.push([at, v]); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`, key)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`, k);
  };
  if (sb.meta?.label) out.push(['meta.label', sb.meta.label]);
  for (const [k, v] of Object.entries(sb.chapters || {})) out.push([`chapters.${k}`, v]);
  if (sb.app?.name) out.push(['app.name', sb.app.name]);
  for (const c of cutsOf(sb)) c.scenes.forEach((s, i) => walk(s, `${c.id} scene ${s.id ?? i}`));
  for (const d of sb.deliverables || []) if (d.name) out.push([`${d.id} name`, d.name]);
  return out;
}

/** The cue text of a WebVTT file (no timing lines, no header, the voice tags and entities taken out). */
export function vttLines(vtt: string): string[] {
  return vtt.split(/\r?\n/).filter(l => l.trim() && l !== 'WEBVTT' && !/-->/.test(l) && !/^\d+$/.test(l.trim())).map(l => l.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim());
}

// ---- the compliance checks ------------------------------------------------------------------------------------------------------------------------------
export type Expect = { ids: string[]; label: string; cta: string; tagline: string; kind: 'family-film' | 'home-tour' };
/** What a film OWES, from this repository (never from the manifest being checked): the disclosures of the family's film, or of a home with no family. */
export async function expectationOf(manifest: any, claims: Claims & { style?: any } = loadClaims() as any): Promise<Expect> {
  const style = (claims as any).style || {}, text = (id: string) => claims.disclosures.find(d => d.id === id)?.text;
  if (manifest.kind === 'home-tour') return { kind: 'home-tour', ids: ['stylised-art'], label: manifest.displayName, cta: style.signOff || 'UnCloud your life.', tagline: 'See Companion Core' };
  const fam = await loadFamily(manifest.family?.slug ?? manifest.id, { silent: true });
  return { kind: 'family-film', ids: filmDisclosureIds(fam.rs, true), label: text('fictional-family')!, cta: style.signOff || 'UnCloud your life.', tagline: fam.rs.closing.cta.label };
}

export type Checked = { errors: string[]; warnings: string[] };
export function wrapChecks(o: { storyboard: Board; manifest: any; vtts: Array<{ file: string; text: string }>; claims: Claims; expect: Expect; terms: GuardTerm[]; extraText?: Array<[string, string]> }): Checked {
  const errors: string[] = [], warnings: string[] = [], { storyboard: sb, manifest: m, claims, expect } = o;
  const claimText = (id: string) => claims.disclosures.find(d => d.id === id)?.text;
  const want = expect.ids.map(id => ({ id, text: claimText(id) }));
  for (const w of want) if (!w.text) errors.push(`claims.json has no disclosure "${w.id}"`);
  // 1. the disclosures: the manifest's list is the film's, in order, and every word is claims.json's
  const have = (m.text?.disclosures || []) as Array<{ id: string; text: string }>;
  if (canon(have.map(d => d.id)) !== canon(want.map(w => w.id))) errors.push(`the manifest lists the disclosures ${have.map(d => d.id).join(', ')}; this film owes ${want.map(w => w.id).join(', ')}`);
  for (const d of have) if (claimText(d.id) !== d.text) errors.push(`the manifest's disclosure ${d.id} is not claims.json's words`);
  // 2. what the kit actually prints: the coda of every cut
  for (const c of cutsOf(sb)) {
    const coda = c.scenes.find(s => s.coda || s.id === 'plainly');
    if (!coda) { errors.push(`${c.id}: no disclosure card (the coda) in the storyboard`); continue; }
    const printed = (coda.items || []).map((x: any) => x.label);
    if (canon(printed) !== canon(want.map(w => w.text))) errors.push(`${c.id}: the disclosure card prints ${JSON.stringify(printed)}, not claims.json's ${JSON.stringify(want.map(w => w.text))}`);
    if (!(coda.seconds >= 5)) errors.push(`${c.id}: the disclosure card is up for ${coda.seconds} s; it holds at least 5 s`);
    const outro = c.scenes.find(s => s.kind === 'outro' || s.id === 'close');
    if (!outro) errors.push(`${c.id}: no end card`);
    else {
      if (outro.url !== LINK) errors.push(`${c.id}: the end card's link is ${JSON.stringify(outro.url)}, not ${LINK}`);
      if (outro.cta !== expect.cta) errors.push(`${c.id}: the end card's call to action is ${JSON.stringify(outro.cta)}, not ${JSON.stringify(expect.cta)}`);
      if (outro.tagline !== expect.tagline) errors.push(`${c.id}: the end card's line is ${JSON.stringify(outro.tagline)}, not ${JSON.stringify(expect.tagline)}`);
    }
  }
  // 3. the label on every frame, and the light
  if (sb.meta?.label !== expect.label) errors.push(`the label on every frame is ${JSON.stringify(sb.meta?.label)}, not ${JSON.stringify(expect.label)}`);
  for (const d of sb.deliverables || []) if (d.scenes && (d as any).meta?.label !== undefined && (d as any).meta.label !== expect.label) errors.push(`${d.id}: its label is not ${JSON.stringify(expect.label)}`);
  if (sb.source?.lighting !== 'day' || m.lighting !== 'day') errors.push(`the lighting is ${sb.source?.lighting}/${m.lighting}; a film is lit as day`);
  // 4. the one link: every `url` is ci.computer/core and no other address is printed
  // (an address: a URL, a www name, or anything on the company's own domain. A service's name with a dot in it, Raindrop.io, is a name and not a link.)
  const ADDRESS = /\bhttps?:\/\/\S+|\bwww\.\S+|\b(?:[a-z0-9-]+\.)*ci\.computer\b(?:\/[^\s,;]*)?/gi;
  const strings = [...readableStrings(sb), ...(o.extraText || [])];
  for (const v of o.vtts) vttLines(v.text).forEach((l, i) => strings.push([`${v.file} line ${i + 1}`, l]));
  for (const [where, t] of strings) for (const hit of t.match(ADDRESS) || []) if (hit.replace(/[.,;]+$/, '') !== LINK) errors.push(`${where}: prints the address ${hit}; the only link is ${LINK}`);
  // 5. the copy lint (claims.json's rules, the word beta, dashes) over every readable string and every caption
  errors.push(...copyProblems(strings, claims as any));
  // 6. no price, performance figure or availability that is not on the fact sheet: claims.json's rules above cover price, savings and security words; a digit beside a service is a usage figure
  for (const [where, t] of strings) if (/[$£€]\s?\d|\b\d+\s?(?:%|percent|GB|TB|tokens)\b/i.test(t)) errors.push(`${where}: "${t}" carries a price or a figure that is not on the fact sheet`);
  // 7. the credit scan over the same words, the storyboard and the manifest as files
  const blob = JSON.stringify({ sb, m });
  for (const [where, t] of strings) errors.push(...scanText(where, t, o.terms));
  errors.push(...scanText('storyboard.json and plates.json', blob, o.terms));
  // 8. an approach plate or a beat that shows an app says so in words a viewer can read: the film is captioned (no word of the film is only in the picture)
  for (const c of cutsOf(sb)) for (const s of c.scenes) if (s.kind === 'clip' && !s.caption && !s.ref) warnings.push(`${c.id}: scene ${s.id} has no caption`);
  return { errors, warnings };
}

// ---- the files the kit rendered --------------------------------------------------------------------------------------------------------------------------
export const FORMAT_ASPECT: Record<string, number> = { landscape: 16 / 9, portrait: 9 / 16, square: 1 };
export type OutputReport = { file: string; cut: string; format: string; bytes: number; seconds: number; frames: number; width: number; height: number; errors: string[]; warnings: string[]; tags: Record<string, string> };
/** The metadata the file carries: the strings a credit could hide in. */
export function fileTags(file: string): Record<string, string> {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags:stream_tags', '-of', 'json', file], { encoding: 'utf8' });
  try { const j = JSON.parse(r.stdout); return { ...(j.format?.tags || {}), ...Object.assign({}, ...(j.streams || []).map((s: any) => s.tags || {})) }; } catch { return {}; }
}
/**
 * The picture gates of scripts/film/qa.mts over one rendered file (one H.264 yuv420p stream, no audio, 30 fps, the frames its length gives, the cap of 110 s, a picture that moves), plus a blank
 * first or last frame, the aspect the format asks for, and the credit scan of the file's metadata. `expectSeconds` is the kit's own `build` figure for the file.
 */
export function gateOutput(file: string, o: { cut: string; format: string; fps: number; expectSeconds: number | null; terms: GuardTerm[]; minShort?: number }): OutputReport {
  const p = probe(file), v = p.video, errors: string[] = [], warnings: string[] = [];
  if (!v) return { file, cut: o.cut, format: o.format, bytes: p.bytes, seconds: p.duration, frames: 0, width: 0, height: 0, errors: ['no video stream'], warnings, tags: {} };
  const want = FORMAT_ASPECT[o.format];
  if (!want || Math.abs(v.w / v.h - want) > 0.01 * want) errors.push(`the picture is ${v.w}x${v.h}, not ${o.format}`);
  if (Math.min(v.w, v.h) < (o.minShort ?? 540)) errors.push(`the short edge is ${Math.min(v.w, v.h)} px`);
  // the kit renders a whole number of frames that covers its length (a 109.567 s film is 3288 frames at 30), so the frames it has are accepted when they are the length's, to one frame
  const seconds = o.expectSeconds ?? p.duration, wantFrames = seconds * o.fps, frames = Math.abs(v.frames - wantFrames) <= 1.01 ? v.frames : Math.round(wantFrames);
  const rep = filmGate(file, { w: v.w, h: v.h, fps: o.fps, frames, durationS: seconds, titleEnd: 0, outroTail: 0, web: false, channels: 0, silent: true });
  for (const e of rep.errors) {
    // The film's cap (110 s) is a hard error here as it is for the film: the plates choose their beats so that the kit's film fits it (plates/lib.mts selectBeats), and nothing in this file widens it.
    // A silent film's room rests while a caption is read (the bake holds a beat's camera at rest), so a still picture of a cue's length is the film, not a fault; a render that stuck is far longer (KIT_FREEZE_MAX_S).
    const frozen = /the picture is frozen for ([\d.]+) s/.exec(e);
    if (frozen && +frozen[1] < KIT_FREEZE_MAX_S) { warnings.push(`${e.replace('is frozen', 'holds still')} (a captioned room at rest; refused from ${KIT_FREEZE_MAX_S} s)`); continue; }
    errors.push(e);
  }
  for (const w of rep.warnings) if (!/under the 75 s a family film is designed for/.test(w)) warnings.push(w);
  if (o.expectSeconds === null) warnings.push('the kit did not say how long this file should be: the length is its own');
  const sp = edgeSpread(file, v.frames);
  if (sp.first < BLANK_STD) errors.push(`the first frame is blank (spread ${sp.first.toFixed(1)})`);
  if (sp.last < BLANK_STD) errors.push(`the last frame is blank (spread ${sp.last.toFixed(1)})`);
  const tags = fileTags(file);
  for (const [k, t] of Object.entries(tags)) errors.push(...scanText(`${path.basename(file)} tag ${k}`, String(t), o.terms));
  return { file, cut: o.cut, format: o.format, bytes: p.bytes, seconds: p.duration, frames: v.frames, width: v.w, height: v.h, errors, warnings, tags };
}

/** `built <cut>/<format> <seconds>s` lines of `ci-video build`: what the kit says each file will be. */
export function builtSeconds(out: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of out.matchAll(/built\s+(\S+?)\/(landscape|portrait|square)\s+([\d.]+)s/g)) m.set(`${x[1]}/${x[2]}`, +x[3]);
  return m;
}
/** The kit's own figure for its film (from `build`) against the cap, for each format the film is built in: a sentence when it is over, else null. A film is never longer than FILM.maxS and there is no other number. */
export function kitCapProblem(built: Map<string, number>, filmId: string): string | null {
  for (const format of ['landscape', 'portrait']) {
    const s = built.get(`${filmId}/${format}`);
    if (s !== undefined && s > FILM.maxS) return `the kit's film (${format}) is ${s.toFixed(1)} s and the cap is ${FILM.maxS} s`;
  }
  return null;
}
/** `out/<cut>-<format>.mp4` -> [cut, format] */
export function outputOf(name: string): [string, string] | null { const m = /^(.*)-(landscape|portrait|square)\.mp4$/.exec(name); return m ? [m[1], m[2]] : null; }

// ---- one id ---------------------------------------------------------------------------------------------------------------------------------------------------------
export type WrapOpts = { kit: Kit; quality: 'draft' | 'high'; recipe: string | null; render: boolean; checksOnly: boolean; /** a short cut the kit's own gate refuses is an error (default: it is left out and said, and the film is kept) */ strictCuts?: boolean; log: (m: string) => void };
export type CutsReport = { passed: string[]; failed: Array<{ id: string; why: string }> };
export type WrapResult = { ok: boolean; id: string; quality: 'draft' | 'high'; project: string; errors: string[]; warnings: string[]; cuts: CutsReport; outputs: OutputReport[]; seconds: Record<string, number>; kit: { dir: string; version: string }; manifestSha256: string | null };

export async function wrapOne(id: string, o: WrapOpts): Promise<WrapResult> {
  const t0 = Date.now(), log = (m: string) => o.log(`${id}: ${m}`), errors: string[] = [], warnings: string[] = [], outputs: OutputReport[] = [], seconds: Record<string, number> = {}, cuts: CutsReport = { passed: [], failed: [] };
  const manifestFile = path.join(platesDir(id), 'plates.json'), project = path.join(kitProjectsRoot(), id);
  const res = (): WrapResult => ({ ok: !errors.length, id, quality: o.quality, project, errors, warnings, cuts, outputs, seconds, kit: { dir: o.kit.dir, version: o.kit.version }, manifestSha256: fs.existsSync(manifestFile) ? sha256(fs.readFileSync(manifestFile)) : null });
  const done = (name: string, t: number) => { seconds[name] = +((Date.now() - t) / 1000).toFixed(1); };
  try {
    if (!fs.existsSync(manifestFile)) throw new Error(`no ${path.relative(ROOT, manifestFile)} (pnpm run story:film -- ${id} --plates)`);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')), claims = loadClaims(), terms = guardTerms(builderHandles(ROOT));
    const env: Record<string, string> = { CI_VIDEO_RENDER_JOBS: process.env.CI_VIDEO_RENDER_JOBS || '1' };
    let built = new Map<string, number>();
    if (!o.checksOnly) {
      // import: the kit checks every byte the manifest names, the contract's closed fields and its own text rules
      let t = Date.now();
      const imp = await runKit(o.kit, project, ['import-home', manifestFile, ...(o.recipe && o.recipe !== 'all' ? ['--recipe', o.recipe] : []), '--force'], { env });
      done('import', t); if (imp.code !== 0) throw new Error(`ci-video import-home failed:\n${imp.out.trim().split('\n').slice(-14).join('\n')}`);
      for (const l of imp.out.split('\n')) if (/^\s+(cut|!|scene)\s/.test(l)) log(l.trim());
      t = Date.now();
      const bld = await runKit(o.kit, project, ['build'], { env }); done('build', t);
      if (bld.code !== 0) throw new Error(`ci-video build failed:\n${bld.out.trim().split('\n').slice(-14).join('\n')}`);
      built = builtSeconds(bld.out);
      // the kit's own gates, the film first (it must pass) and then each short cut by itself: a cut the kit refuses (its disclosure card, with four long lines, does not fit a short portrait cut's band) is left out
      // and said, and the film is kept; --strict-cuts makes it an error
      t = Date.now();
      const sb0 = JSON.parse(fs.readFileSync(path.join(project, 'storyboard.json'), 'utf8')) as Board, filmId = sb0.app?.id ?? id;
      // the cap, from the kit's own figure and before an hour of rendering: a film is never longer than FILM.maxS (the plates' beats are chosen to fit it; this is the check that they did)
      const tooLong = kitCapProblem(built, filmId);
      if (tooLong) throw new Error(`${tooLong}: the plates in ${path.relative(ROOT, manifestFile)} are too long for it (pnpm run story:film -- ${id} --plates writes the beats that fit)`);
      const chk = await runKit(o.kit, project, ['check', '--cut', filmId], { env, timeoutMs: 30 * 60_000 });
      if (chk.code !== 0) throw new Error(`ci-video check failed for the film (the kit's own gates, the caption-versus-subject rule among them):\n${chk.out.trim().split('\n').slice(-24).join('\n')}`);
      for (const d of sb0.deliverables || []) {
        const r = await runKit(o.kit, project, ['check', '--cut', d.id], { env, timeoutMs: 30 * 60_000 });
        if (r.code === 0) cuts.passed.push(d.id);
        else {
          const why = r.out.split('\n').filter(l => /✗|% of the subject|covers/.test(l)).map(l => l.trim()).slice(0, 3).join(' | ') || r.out.trim().split('\n').slice(-2).join(' | ');
          cuts.failed.push({ id: d.id, why }); (o.strictCuts ? errors : warnings).push(`the kit's gate refuses the cut ${d.id}: ${why}`);
        }
      }
      done('check', t);
      log(`kit check: the film passes; cuts ${cuts.passed.length ? `${cuts.passed.join(', ')} pass` : 'none pass'}${cuts.failed.length ? `; ${cuts.failed.map(f => f.id).join(', ')} refused` : ''} (${seconds.check} s)`);
    }
    // the compliance checks, on what the kit wrote
    const sbFile = path.join(project, 'storyboard.json');
    if (!fs.existsSync(sbFile)) throw new Error(`no storyboard.json in ${project}`);
    const storyboard = JSON.parse(fs.readFileSync(sbFile, 'utf8')), expect = await expectationOf(manifest, claims as any);
    const vttDir = [path.join(project, 'out'), path.join(project, 'build')], vtts: Array<{ file: string; text: string }> = [];
    const seen = (d: string, rel = ''): void => { const dir = path.join(d, rel); if (!fs.existsSync(dir)) return; for (const n of fs.readdirSync(dir)) { const r = rel ? `${rel}/${n}` : n; if (fs.statSync(path.join(d, r)).isDirectory()) { if (n !== 'runtime') seen(d, r); } else if (n.endsWith('.vtt')) vtts.push({ file: `${path.basename(d)}/${r}`, text: fs.readFileSync(path.join(d, r), 'utf8') }); } };
    vttDir.forEach(d => seen(d));
    const c = wrapChecks({ storyboard, manifest, vtts, claims, expect, terms });
    errors.push(...c.errors); warnings.push(...c.warnings);
    log(`compliance: ${storyboard.deliverables?.length ?? 0} cuts besides the film, ${vtts.length} subtitle files, ${c.errors.length} errors, ${c.warnings.length} warnings`);
    if (o.render && !o.checksOnly && !errors.length) {
      const t = Date.now();
      const keep = [storyboard.app?.id ?? id, ...cuts.passed].join(',');
      const r = await runKit(o.kit, project, ['render', '--format', 'all', '--quality', o.quality, '--cut', keep], { env, timeoutMs: 90 * 60_000 }); done('render', t);
      if (r.code !== 0) throw new Error(`ci-video render failed:\n${r.out.trim().split('\n').slice(-14).join('\n')}`);
      log(`rendered in ${seconds.render} s`);
    }
    // the files: every MP4 the kit rendered
    const outDir = path.join(project, 'out');
    if (o.render && fs.existsSync(outDir)) {
      for (const f of fs.readdirSync(outDir).sort()) {
        const k = outputOf(f); if (!k || (k[0] !== (storyboard.app?.id ?? id) && !cuts.passed.includes(k[0]))) continue;
        const rep = gateOutput(path.join(outDir, f), { cut: k[0], format: k[1], fps: manifest.fps, expectSeconds: built.get(`${k[0]}/${k[1]}`) ?? null, terms });
        outputs.push(rep); errors.push(...rep.errors.map(e => `${f}: ${e}`)); warnings.push(...rep.warnings.map(w => `${f}: ${w}`));
        log(`${f}: ${rep.width}x${rep.height}, ${rep.seconds.toFixed(1)} s, ${(rep.bytes / 1048576).toFixed(1)} MiB${rep.errors.length ? `, ${rep.errors.length} errors` : ''}`);
      }
      if (!outputs.length) errors.push('the kit rendered no MP4');
    }
  } catch (e: any) { errors.push(e.message); }
  seconds.total = +((Date.now() - t0) / 1000).toFixed(1);
  const r = res();
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, 'wrap-report.json'), JSON.stringify(r, null, 1) + '\n');
  return r;
}

// ---- main ----------------------------------------------------------------------------------------------------------------------------------------------------------
export async function main(argv: string[]): Promise<number> {
  const flags: Record<string, string> = {}, ids: string[] = [], valued = new Set(['kit', 'quality', 'recipe']);
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (!a.startsWith('--')) ids.push(a); else flags[a.slice(2)] = valued.has(a.slice(2)) ? argv[++i] : 'true'; }
  try {
    if (flags['setup-kit'] === 'true') { console.log(`wrap: the kit is at ${setupKit()}`); return 0; }
    if (!ids.length) { console.error('name a family slug or a home film id (the plates.json that `story:film -- <id> --plates` wrote)'); return 2; }
    const quality = (flags.quality || 'high') as 'draft' | 'high';
    if (quality !== 'draft' && quality !== 'high') { console.error('--quality must be draft or high'); return 2; }
    const kit = findKit(flags.kit);
    console.log(`wrap: video-kit ${kit.version} at ${kit.dir}`);
    let bad = 0;
    for (const id of ids) {
      const r = await wrapOne(id, { kit, quality, recipe: flags.recipe || null, render: flags['no-render'] !== 'true', checksOnly: flags['checks-only'] === 'true', strictCuts: flags['strict-cuts'] === 'true', log: m => console.log(m) });
      for (const w of r.warnings) console.log(`  warn: ${w}`);
      if (!r.ok) { bad++; console.error(`✗ ${id}:\n${r.errors.map(e => `    ${e}`).join('\n')}`); } else console.log(`✓ ${id}: ${r.outputs.length} file(s) in ${path.relative(ROOT, path.join(r.project, 'out'))} (${r.seconds.total} s)`);
    }
    return bad ? 1 : 0;
  } catch (e: any) { console.error(e.message); return 2; }
}
if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main(process.argv.slice(2)));
