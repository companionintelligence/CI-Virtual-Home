// The film script's plain helpers: where things are, how a family's three inputs are read and joined, the strings the film prints that are not in
// the family's file, films.json, and the size guard. Pure Node: no browser, no ffmpeg (those are mux.mts and qa.mts), so scripts/test-film.mts can
// import it without a GPU. Owner: video-tool.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { joinRuntime, voiceShaOf, type RuntimeStory } from '../../assets/story/runtime.js';
import type { Story, VoiceLock, BakeLock } from '../../assets/story/types.js';
import { FILM_KEYS, silentStory, type FilmKey, type Cue } from '../../assets/story/film/layout.js';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
/** the authored files, the locks and the films.json: content/families, or $CI_STORY_FAMILIES_DIR (the voice-over tool's switch, kept the same) */
export const familiesDir = (): string => process.env.CI_STORY_FAMILIES_DIR ? path.resolve(process.env.CI_STORY_FAMILIES_DIR) : path.join(ROOT, 'content', 'families');
/** rendered films: outside git (gitignored like video/houses) and outside dist */
export const videoDir = (): string => process.env.CI_FILM_OUT ? path.resolve(process.env.CI_FILM_OUT) : path.join(ROOT, 'video', 'families');
export const filmsJsonPath = (): string => path.join(familiesDir(), 'films.json');

/** Cloudflare Pages caps a file at 25 MiB; a web film is held to 24 so a few bytes of headers never decide it. */
export const WEB_MAX_BYTES = 24 * 1024 * 1024;
export const FILM_BASE_URL_ENV = 'FILM_BASE_URL';

export const sha256 = (data: string | Uint8Array): string => crypto.createHash('sha256').update(data).digest('hex');
export const hash10 = (data: string | Uint8Array): string => sha256(data).slice(0, 10);
export const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

// ---- the names ---------------------------------------------------------------------------------------------------------------------------
export const aspectLabel = (k: FilmKey): string => (k === '16x9' ? '16:9' : '9:16');
/** the web file's name: content-hashed, so it can be cached for a year wherever it is hosted. A silent film carries `.silent` before the hash, so it can never be
 *  mistaken for (or overwrite) the voiced film of the same family. */
export const webFileName = (slug: string, k: FilmKey, bytes: Uint8Array, silent = false): string => `${slug}.${k}${silent ? '.silent' : ''}.${hash10(bytes)}.mp4`;
export const posterFileName = (k: FilmKey, bytes: Uint8Array): string => (k === '16x9' ? 'poster' : 'poster-9x16') + `.${hash10(bytes)}.jpg`;
export const vttFileName = (bytes: Uint8Array): string => `captions.${hash10(bytes)}.vtt`;
export const FILM_FILE_RE = /^(?<slug>[a-z][a-z0-9-]*)\.(?<aspect>16x9|9x16)(?<silent>\.silent)?\.(?<hash>[0-9a-f]{10})\.mp4$/;
/** the name of a rendering's side files (the gates' report, a rejected film): silent ones are their own */
export const sideName = (slug: string, k: FilmKey, silent: boolean): string => `${slug}.${k}${silent ? '.silent' : ''}`;

// ---- reading a family -----------------------------------------------------------------------------------------------------------------------
export type Family = {
  slug: string; story: Story; voice: VoiceLock | null; bake: BakeLock; rs: RuntimeStory;
  /** a silent film: no voice lock is needed, the bake's estimated durations time the clock and the captions (rs has the estimated clips filled in) */
  silent: boolean;
  shas: { story: string; voice: string; bake: string };
};

/** Does the family have a voice lock? (`--silent` is chosen for it, with a notice, when it does not.) */
export const hasVoiceLock = (slug: string): boolean => fs.existsSync(path.join(familiesDir(), `${slug}.voice.json`));

/**
 * A voiced film needs all three of a family's files, and a bake made from THIS voice lock (else the offsets under the sound are someone else's); it refuses estimated
 * durations. A silent film (`opts.silent`) needs the story and the bake lock only: estimated durations are accepted here and only here, and the voice lock, if there is one and
 * the bake was made from it, still times the picture (the film then simply has no sound).
 */
export async function loadFamily(slug: string, opts: { silent?: boolean } = {}): Promise<Family> {
  const dir = familiesDir(), p = (ext: string) => path.join(dir, `${slug}${ext}`), silent = !!opts.silent;
  const need: Array<[string, string]> = [['.json', 'the authored story'], ['.bake.json', `the bake lock (pnpm run story:bake -- ${slug})`]];
  if (!silent) need.splice(1, 0, ['.voice.json', `the voice lock (pnpm run story:voice -- ${slug}; or --silent for a captioned film with no sound)`]);
  for (const [ext, how] of need) if (!fs.existsSync(p(ext))) throw new Error(`${slug}: no ${how}: ${path.relative(ROOT, p(ext))}`);
  const story: Story = readJson(p('.json')), bake: BakeLock = readJson(p('.bake.json'));
  const voice: VoiceLock | null = fs.existsSync(p('.voice.json')) ? readJson(p('.voice.json')) : null;
  if (!silent && bake.durations !== 'voice') throw new Error(`${slug}: the bake lock used estimated durations; record the voice (pnpm run story:voice -- ${slug}) and bake again, or render a silent film (--silent)`);
  // the voice only counts when the bake was made from it; an estimated bake is joined without it (its offsets are the estimate's)
  let joinWith: VoiceLock | null = null;
  if (bake.durations === 'voice') {
    if (!voice) throw new Error(`${slug}: the bake lock was made from a voice lock that is not there (${path.relative(ROOT, p('.voice.json'))})`);
    const now = await voiceShaOf(story, voice);
    if (bake.voiceSha !== now) throw new Error(`${slug}: the bake lock was made from a different voice lock; run pnpm run story:bake -- ${slug}`);
    joinWith = voice;
  }
  const joined = joinRuntime(story, joinWith, bake), rs = silent ? silentStory(joined) : joined;
  const sha = (ext: string) => (fs.existsSync(p(ext)) ? sha256(fs.readFileSync(p(ext))) : '');
  return { slug, story, voice: joinWith, bake, rs, silent, shas: { story: sha('.json'), voice: joinWith ? sha('.voice.json') : '', bake: sha('.bake.json') } };
}

/** every slug with a bake lock (the film needs one): `--all` */
export function filmableSlugs(): string[] {
  const dir = familiesDir();
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.bake.json')).map(f => f.replace(/\.bake\.json$/, '')).sort() : [];
}
export const clipPath = (slug: string, file: string): string => path.join(familiesDir(), slug, file);

// ---- the strings a film prints that are not in the family's file ---------------------------------------------------------------------------
export type Claims = { disclosures: Array<{ id: string; text: string }> };
export const loadClaims = (): Claims => readJson(path.join(ROOT, 'content', 'story', 'claims.json'));
const disclosure = (c: Claims, id: string): string => { const d = c.disclosures.find(x => x.id === id); if (!d) throw new Error(`claims.json has no disclosure "${id}"`); return d.text; };

/** Does a film beat name Hermes or OpenClaw? Then its end card carries the attribution line (claims.json: attribution-agents). */
export function namesAgentRuntime(rs: RuntimeStory, partIds: string[]): boolean {
  for (const id of partIds) {
    const b = rs.beats.find(x => x.id === id); if (!b) continue;
    if (b.agent) return true;
    if (b.app && (b.app.id === 'ci-hermes' || b.app.id === 'ci-openclaw')) return true;
    if ((b.with || []).some(a => a === 'ci-hermes' || a === 'ci-openclaw')) return true;
  }
  return false;
}
export type FilmText = {
  title: { heading: string; address: string; tagline: string; fictional: string };
  end: { signoff: string; url: string; fictional: string; lines: string[] };
  badge: string;
  names: Record<string, string>;
};
/** A silent film has no voice, so it does not print the synthetic-voice line (claims.json places it on the end card of a film with narration; saying a voice was generated under a silent film would be false). */
export function filmText(rs: RuntimeStory, claims: Claims = loadClaims(), o: { silent?: boolean } = {}): FilmText {
  const fam = rs.family, fictional = disclosure(claims, 'fictional-family');
  const lines = [disclosure(claims, 'beta-short'), disclosure(claims, 'scripted-scenes'), disclosure(claims, 'stylised-art')];
  if (!o.silent) lines.push(disclosure(claims, 'synthetic-voice'));
  if (namesAgentRuntime(rs, rs.film.parts.map(p => p.id))) lines.push(disclosure(claims, 'attribution-agents'));
  const url = rs.closing.cta.url.replace(/^https?:\/\//, '');
  const names: Record<string, string> = {}; for (const m of rs.members) names[m.id] = m.companion ? m.companion.name : m.name;
  return {
    title: { heading: `The ${fam.surname} family`, address: `${fam.address.line}, ${fam.address.place}`, tagline: fam.tagline, fictional },
    end: { signoff: 'UnCloud your life.', url, fictional, lines }, badge: fictional, names,
  };
}

// ---- films.json -------------------------------------------------------------------------------------------------------------------------------
export type FilmAspect = {
  /** the web file's name (content-hashed); the URL is FILM_BASE_URL + '/' + file, decided when the site is built */
  file: string; sha256: string; bytes: number; width: number; height: number; durationMs: number;
  /** relative to content/families/<slug>/ : the committed poster */
  poster: string;
  /** the encoded file's loudness; a silent film has no audio stream and records none */
  loudness?: { I: number; TP: number };
};
export type FilmEntry = {
  /** false: a silent, captioned film (no audio stream, the clock timed by the bake's estimated durations); absent or true: it has the recorded voice under it */
  sound?: boolean;
  durationMs: number;
  /** a hash of everything the film was made from, so a stale film is found without rendering */
  inputsSha: string;
  /** relative to content/families/<slug>/ : the WebVTT captions (committed; small enough to ship with the site) */
  vtt: string;
  aspects: Partial<Record<FilmKey, FilmAspect>>;
};
export type FilmsFile = { v: 1; families: Record<string, FilmEntry> };

export function readFilms(): FilmsFile {
  const f = filmsJsonPath();
  return fs.existsSync(f) ? readJson(f) : { v: 1, families: {} };
}
export function writeFilms(films: FilmsFile) {
  const sorted: FilmsFile = { v: 1, families: Object.fromEntries(Object.keys(films.families).sort().map(k => [k, films.families[k]])) };
  fs.mkdirSync(path.dirname(filmsJsonPath()), { recursive: true });
  fs.writeFileSync(filmsJsonPath(), JSON.stringify(sorted, null, 2) + '\n');
}

/** Problems with a films.json (an empty list: it is well formed). Used by the tests and by the ship step. */
export function filmsProblems(films: FilmsFile, opts: { maxBytes?: number } = {}): string[] {
  const why: string[] = [], max = opts.maxBytes ?? WEB_MAX_BYTES;
  if (!films || films.v !== 1 || typeof films.families !== 'object') return ['films.json: not { v: 1, families: {} }'];
  for (const [slug, e] of Object.entries(films.families)) {
    const at = (m: string) => why.push(`films.json ${slug}: ${m}`);
    if (e.sound !== undefined && typeof e.sound !== 'boolean') at('sound must be true or false');
    const silent = e.sound === false;
    if (!/^[a-z][a-z0-9-]*$/.test(slug)) at('the slug is not a public slug');
    if (!(e.durationMs > 0)) at('no duration');
    if (!/^[0-9a-f]{64}$/.test(e.inputsSha || '')) at('no inputsSha');
    if (!/^film\/captions\.[0-9a-f]{10}\.vtt$/.test(e.vtt || '')) at('vtt must be film/captions.<hash10>.vtt');
    const keys = Object.keys(e.aspects || {});
    if (!keys.length) at('no aspect');
    for (const k of keys) {
      const a = (e.aspects as any)[k] as FilmAspect;
      if (!FILM_KEYS.includes(k as FilmKey)) { at(`unknown aspect ${k}`); continue; }
      const m = FILM_FILE_RE.exec(a.file || '');
      if (!m || m.groups!.slug !== slug || m.groups!.aspect !== k) at(`${k}: file ${a.file} is not ${slug}.${k}${silent ? '.silent' : ''}.<hash10>.mp4`);
      else if (!!m.groups!.silent !== silent) at(silent ? `${k}: a silent film's file must be ${slug}.${k}.silent.<hash10>.mp4 (got ${a.file})` : `${k}: ${a.file} is named as a silent film but the entry has sound`);
      else if (!/^[0-9a-f]{64}$/.test(a.sha256 || '') || a.sha256.slice(0, 10) !== m.groups!.hash) at(`${k}: the hash in the file name is not the sha256's first ten`);
      if (!(a.bytes > 0)) at(`${k}: no bytes`); else if (a.bytes > max) at(`${k}: ${(a.bytes / 1048576).toFixed(1)} MiB is over the ${(max / 1048576).toFixed(0)} MiB limit`);
      if (!(a.width > 0 && a.height > 0)) at(`${k}: no size`);
      if (k === '16x9' && a.width <= a.height) at('16x9 is not landscape'); if (k === '9x16' && a.width >= a.height) at('9x16 is not portrait');
      if (!(a.durationMs > 0)) at(`${k}: no duration`);
      if (!new RegExp(`^film/${k === '16x9' ? 'poster' : 'poster-9x16'}\\.[0-9a-f]{10}\\.jpg$`).test(a.poster || '')) at(`${k}: poster must be film/${k === '16x9' ? 'poster' : 'poster-9x16'}.<hash10>.jpg`);
      if (silent) { if (a.loudness) at(`${k}: a silent film has no loudness`); }
      else if (!a.loudness || !Number.isFinite(a.loudness.I)) at(`${k}: no loudness`);
    }
  }
  return why;
}

/** the 24 MiB guard on one file */
export function sizeGuard(bytes: number, what: string, max = WEB_MAX_BYTES): string | null {
  return bytes > max ? `${what} is ${(bytes / 1048576).toFixed(2)} MiB; a web film must stay under ${(max / 1048576).toFixed(0)} MiB (Cloudflare Pages caps a file at 25 MiB)` : null;
}

/** A hash of everything a film is made from: the three files, the code that draws it and the claims it prints. A change in any makes it stale. */
export function toolSha(): string {
  const files: string[] = [];
  const add = (dir: string, re: RegExp) => { if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (re.test(f)) files.push(path.join(dir, f)); };
  add(path.join(ROOT, 'assets', 'story', 'film'), /\.ts$/);
  add(path.join(ROOT, 'scripts', 'film'), /\.mts$/);
  files.push(path.join(ROOT, 'scripts', 'render-family-film.mts'), path.join(ROOT, 'content', 'story', 'claims.json'), path.join(ROOT, 'assets', 'story', 'track.ts'), path.join(ROOT, 'assets', 'story', 'place.ts'));
  const h = crypto.createHash('sha256');
  for (const f of files) if (fs.existsSync(f)) h.update(path.relative(ROOT, f)).update(fs.readFileSync(f));
  return h.digest('hex');
}
/** (a silent film hashes a marker too, so a silent and a voiced film of one family are never taken for each other; a voiced film's hash is what it always was) */
export const inputsShaOf = (fam: Family, res: number, tool = toolSha()): string => sha256(JSON.stringify([fam.shas.story, fam.shas.voice, fam.shas.bake, tool, res, ...(fam.silent ? ['silent'] : [])]));

// ---- the captions of a silent film ---------------------------------------------------------------------------------------------------------------
/** reading speed in characters a second: broadcast captions aim at 17 to 20 for adults; above WARN is hard to read, above FAIL cannot be read at all */
export const READ_CPS = { warn: 21, fail: 30 } as const;
/**
 * The caption legibility checks that need no pixels (the pixels are checked in the page: the painted type audit, which fails a film whose smallest type is under the 36 design px floor, and
 * the room's spread, which fails a blank render). A cue must end inside the film, must not overlap the one before it, must hold at least a second and a half for three or more words,
 * and must be readable at the rate its words are spoken. In a silent film the estimate is the reader's only clock, so this is the check that it is a slow enough one.
 */
export function captionProblems(cues: Cue[], durationS: number): { errors: string[]; warnings: string[]; maxCps: number } {
  const errors: string[] = [], warnings: string[] = []; let maxCps = 0;
  cues.forEach((c, i) => {
    const at = `caption ${i + 1} (${c.start.toFixed(1)} s)`, chars = c.text.length, shown = Math.max(1e-6, c.end - c.start), cps = chars / shown;
    maxCps = Math.max(maxCps, cps);
    if (c.end > durationS + 1e-6) errors.push(`${at} ends at ${c.end.toFixed(2)} s, after the film does`);
    if (i && c.start < cues[i - 1].end - 1e-6) errors.push(`${at} starts before the caption before it ends`);
    if (c.words.length >= 3 && shown < 1.5) warnings.push(`${at} is up for ${shown.toFixed(2)} s`);
    if (cps > READ_CPS.fail) errors.push(`${at} needs ${cps.toFixed(0)} characters a second to read`);
    else if (cps > READ_CPS.warn) warnings.push(`${at} needs ${cps.toFixed(0)} characters a second to read`);
  });
  return { errors, warnings, maxCps: +maxCps.toFixed(1) };
}
