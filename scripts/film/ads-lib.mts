// The ad kit's plain helpers: where things are, how a family is read for a cut (its story, and its bake lock when it has one), the cuts' plan for every family, the
// manifest (content/story/ads.json), the hash that says a cut is stale, the copy lint of what a cut prints, and the record of what this machine has rendered.
// Pure Node: no browser, no ffmpeg (those are ads-encode.mts and ads-qa.mts), so scripts/test-ads.mts imports it without a GPU. Owner: ad-kit.
//
// A cut needs no voice (it is silent) and no voice lock: it is made from content/families/<slug>.json, and, to be rendered, from the bake lock beside it
// (estimated durations are fine: a cut reads at the bake's 150 words a minute). Families that are being written, or do not parse, are listed and skipped, never fatal.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { joinRuntime, type RuntimeStory } from '../../assets/story/runtime.js';
import type { Story, BakeLock } from '../../assets/story/types.js';
import { CUT, CUT_KEYS, DESIGN, planFamilyCuts, type CutPlan, type CutKey, type BeatTimes } from '../../assets/story/film/cut/plan.js';
import os from 'node:os';
import { ROOT, familiesDir, sha256, readJson, loadClaims, type Claims } from './lib.mts';
import { LAUNCH_ARGS } from '../portal-lib.mts';

export { ROOT, sha256, loadClaims, type Claims };
export const MANIFEST_V = 1;
export const adsJsonPath = (): string => process.env.CI_ADS_MANIFEST ? path.resolve(process.env.CI_ADS_MANIFEST) : path.join(ROOT, 'content', 'story', 'ads.json');
/** rendered cuts: outside git (video/* is ignored, as video/families is) and outside dist: videos do not ship with the site (reference/story/ads.md) */
export const adsOutDir = (): string => process.env.CI_ADS_OUT ? path.resolve(process.env.CI_ADS_OUT) : path.join(ROOT, 'video', 'ads');
export const rendersPath = (): string => path.join(adsOutDir(), 'renders.json');

/** the ad's defaults, in the manifest: what a cut is rendered with unless a flag says otherwise */
export const DEFAULTS = {
  fps: CUT.fps, aspects: CUT_KEYS, lighting: 'day', audio: 'none', hookS: CUT.hookS, minS: CUT.minS, maxS: CUT.maxS,
  codec: 'h264 high yuv420p, crf 18, maxrate 12M', label: 'Fictional family. Real software.',
} as const;

// ---- reading a family -------------------------------------------------------------------------------------------------------------------
export type AdFamily = {
  slug: string; story: Story; bake: BakeLock | null; rs: RuntimeStory | null;
  /** why there is no bake to render from (null: there is one) */
  bakeWhy: string | null;
  shas: { story: string; bake: string | null };
};
export type Unreadable = { slug: string; why: string };

/** every authored story file of the families folder (not the voice and bake locks, not films.json) */
export function storySlugs(dir = familiesDir()): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^[a-z][a-z-]*\.json$/.test(f) && !/\.(voice|bake)\.json$/.test(f) && f !== 'films.json').map(f => f.replace(/\.json$/, '')).sort() : [];
}

/** Read one family for the cuts: its story always, its bake lock when it has a fresh-shaped one. Returns a reason instead of throwing for a file in progress. */
export function loadAdFamily(slug: string, dir = familiesDir()): AdFamily | Unreadable {
  const sp = path.join(dir, `${slug}.json`), bp = path.join(dir, `${slug}.bake.json`);
  let story: Story;
  try { story = readJson(sp); } catch (e: any) { return { slug, why: `does not parse: ${String(e.message).slice(0, 80)}` }; }
  if (!story || story.schema !== 'family/v1' || story.slug !== slug) return { slug, why: 'not a family/v1 story of this slug' };
  if (!Array.isArray(story.members) || !Array.isArray(story.beats) || !Array.isArray(story.chapters) || !story.family || !story.closing || !story.closing.cta) return { slug, why: 'has no members, chapters, beats, family or closing yet' };
  let bake: BakeLock | null = null, rs: RuntimeStory | null = null, bakeWhy: string | null = 'no bake lock (pnpm run story:bake -- ' + slug + ')', bakeSha: string | null = null;
  if (fs.existsSync(bp)) {
    try {
      bake = readJson(bp); bakeSha = sha256(fs.readFileSync(bp));
      rs = joinRuntime(story, null, bake!); bakeWhy = null;
    } catch (e: any) { bake = null; rs = null; bakeWhy = `the bake lock does not fit the story (${String(e.message).slice(0, 90)})`; }
  }
  return { slug, story, bake, rs, bakeWhy, shas: { story: sha256(fs.readFileSync(sp)), bake: bake ? bakeSha : null } };
}
export const isFamily = (x: AdFamily | Unreadable): x is AdFamily => !('why' in x);

/** the bake's beat times in the shape the plan takes (the RuntimeBeat fields) */
export function timesOf(rs: RuntimeStory): Record<string, BeatTimes> {
  const out: Record<string, BeatTimes> = {};
  for (const b of rs.beats) out[b.id] = { t0: b.t0, t1: b.t1, travel: b.travel, rest: b.rest, speechAt: b.speechAt, popupAt: b.popupAt };
  return out;
}

// ---- the words a cut prints, and the lint ----------------------------------------------------------------------------------------------------
const disclosureText = (c: Claims, id: string): string => { const d = c.disclosures.find(x => x.id === id); if (!d) throw new Error(`claims.json has no disclosure "${id}"`); return d.text; };
/** the strings the end card prints, from claims.json (never typed in a family file) */
export function endModelOf(plan: CutPlan, claims: Claims = loadClaims()) {
  const fictional = disclosureText(claims, 'fictional-family');
  return {
    cta: plan.cta.label, url: plan.cta.url.replace(/^https?:\/\//, ''), fictional,
    lines: plan.disclosures.filter(d => d !== 'fictional-family').map(d => disclosureText(claims, d)),
  };
}
export const badgeOf = (claims: Claims = loadClaims()): string => disclosureText(claims, 'fictional-family');

/** the credits the public site may not carry (CLAUDE.md "No credits on the public site"): a cut is public */
const CREDIT_RE = /\bSims?\b|Base Game|\bBG\b/;
/** Every string a cut shows or hides in its words, with the claims.json error rules and the credit guard applied. Returns the problems (an empty list: clean). */
export function copyProblems(plan: CutPlan, claims: Claims & { bannedPhrases?: any[] } = loadClaims() as any): string[] {
  const rules = ((claims as any).bannedPhrases as Array<{ id: string; pattern: string; flags?: string; severity: string }>).filter(b => b.severity === 'error').map(b => ({ id: b.id, re: new RegExp(b.pattern, b.flags ?? 'i') }));
  const end = endModelOf(plan, claims);
  const strings: Array<[string, string]> = [['hook', plan.hook.text], ['cta', end.cta], ['label', end.fictional], ...end.lines.map((l, i): [string, string] => [`end line ${i}`, l])];
  for (const p of plan.parts) { strings.push([`${p.beat} caption`, p.text], [`${p.beat} title`, p.card.title], [`${p.beat} note`, p.card.note || '']); p.card.chips.forEach((c, i) => strings.push([`${p.beat} chip ${i}`, c])); }
  const out: string[] = [];
  for (const [at, raw] of strings) {
    const t = raw.replace(/<[^>]*>/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    for (const r of rules) if (r.re.test(t)) out.push(`${at}: ${r.id}`);
    if (CREDIT_RE.test(t)) out.push(`${at}: names a source of the build`);
  }
  return out;
}

// ---- every family's cuts ---------------------------------------------------------------------------------------------------------------------------
export type Built = { plans: Map<string, { fam: AdFamily; cuts: CutPlan[]; skipped: Array<{ member: string; why: string }> }>; unreadable: Unreadable[] };
/** The cuts of every readable family (or of `only`), with their copy lint applied: a cut whose words fail it is `blocked`. */
export function buildPlans(only?: string[], claims: Claims = loadClaims(), dir = familiesDir()): Built {
  const plans: Built['plans'] = new Map(), unreadable: Unreadable[] = [];
  for (const slug of storySlugs(dir)) {
    if (only && !only.includes(slug)) continue;
    const fam = loadAdFamily(slug, dir);
    if (!isFamily(fam)) { unreadable.push(fam); continue; }
    const { cuts, skipped } = planFamilyCuts(fam.story, fam.rs ? timesOf(fam.rs) : null);
    for (const c of cuts) {
      const why = copyProblems(c, claims);
      if (why.length) { c.status = 'blocked'; c.notes.push(`blocked by the copy lint: ${why.slice(0, 4).join('; ')}`); }
    }
    plans.set(slug, { fam, cuts, skipped });
  }
  return { plans, unreadable };
}

// ---- the hash ---------------------------------------------------------------------------------------------------------------------------------------
/** JSON with sorted keys: the same value is the same text on every machine */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${canon((v as any)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
/**
 * The hash of everything a cut's PICTURE is made from that is not code: its plan (the words, the times, the camera's tour seconds), the bake lock's hashes (the
 * camera, the house, the roles), the claims.json texts the end card prints and the frames' design (safe areas). A change in any makes the cut stale.
 * The code that draws it (assets/story/film/cut/*.ts and the scripts) is `toolSha`, kept with each render and not here, so a code change does not rewrite the committed manifest.
 */
export function cutHash(plan: CutPlan, fam: AdFamily, claims: Claims = loadClaims()): string {
  const b = fam.bake;
  return sha256(canon({
    v: MANIFEST_V, plan, design: DESIGN, defaults: DEFAULTS, end: endModelOf(plan, claims),
    bake: b ? { durations: b.durations, trackSha: b.timeline.trackSha, specSha: b.specSha, worldSha: b.worldSha, rolesSha: b.rolesSha, anchorsSha: b.anchorsSha, voiceSha: b.voiceSha } : null,
  }));
}
/** A hash of the code that draws a cut: the page modules, the encoder and gates, the CLI and what they read of the film's own. Kept with a render, never in the manifest. */
export function toolSha(): string {
  const files: string[] = [];
  const add = (dir: string, re: RegExp) => { if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (re.test(f)) files.push(path.join(dir, f)); };
  add(path.join(ROOT, 'assets', 'story', 'film', 'cut'), /\.ts$/);
  add(path.join(ROOT, 'scripts', 'film'), /^ads-.*\.mts$/);
  files.push(path.join(ROOT, 'scripts', 'render-persona-cuts.mts'), path.join(ROOT, 'assets', 'story', 'film', 'layout.ts'), path.join(ROOT, 'assets', 'story', 'film', 'cards.ts'), path.join(ROOT, 'assets', 'story', 'track.ts'), path.join(ROOT, 'assets', 'story', 'place.ts'));
  const h = crypto.createHash('sha256');
  for (const f of files) if (fs.existsSync(f)) h.update(path.relative(ROOT, f)).update(fs.readFileSync(f));
  return h.digest('hex');
}

// ---- the manifest -----------------------------------------------------------------------------------------------------------------------------------
export type ManifestCut = {
  id: string; member: string; name: string; archetype: string | null; status: CutPlan['status'];
  hook: CutPlan['hook']; beats: string[]; captions: string[]; chips: string[]; apps: CutPlan['apps']; disclosures: string[]; cta: CutPlan['cta'];
  aspects: CutKey[]; durationS: number; frames: number;
  timeline: { parts: Array<{ beat: string; kind: string; at: number; end: number; narrAt: number; narrEnd: number; sentences: string; tour: { from: number; to: number } | null }>; pads: CutPlan['pads']; end: CutPlan['end'] };
  notes: string[]; hash: string;
};
export type Manifest = {
  v: 1; note: string; defaults: typeof DEFAULTS;
  families: Record<string, { bake: 'estimated' | 'voice' | null; cuts: ManifestCut[] }>;
};
export function manifestCut(plan: CutPlan, fam: AdFamily, claims: Claims = loadClaims()): ManifestCut {
  return {
    id: plan.id, member: plan.member, name: plan.name, archetype: plan.archetype, status: plan.status,
    hook: plan.hook, beats: plan.parts.map(p => p.beat), captions: plan.parts.map(p => p.text), chips: plan.chips, apps: plan.apps, disclosures: plan.disclosures, cta: plan.cta,
    aspects: CUT_KEYS.slice(), durationS: plan.duration, frames: plan.frames,
    timeline: {
      parts: plan.parts.map(p => ({ beat: p.beat, kind: p.kind, at: p.at, end: p.end, narrAt: p.narrAt, narrEnd: p.narrEnd, sentences: `${p.sentences}/${p.of}`, tour: p.tour ? { from: p.tour.from, to: p.tour.to } : null })),
      pads: plan.pads, end: plan.end,
    },
    notes: plan.notes, hash: cutHash(plan, fam, claims),
  };
}
export function buildManifest(built: Built, claims: Claims = loadClaims()): Manifest {
  const families: Manifest['families'] = {};
  for (const slug of [...built.plans.keys()].sort()) {
    const { fam, cuts } = built.plans.get(slug)!;
    if (!cuts.length) continue;
    families[slug] = { bake: fam.bake ? fam.bake.durations : null, cuts: cuts.map(c => manifestCut(c, fam, claims)) };
  }
  return {
    v: 1, note: 'Generated by pnpm run story:ads (scripts/render-persona-cuts.mts) from content/families/*.json and their bake locks. Never hand-edit; reference/story/ads.md says what each field is.',
    defaults: DEFAULTS, families,
  };
}
export const readManifest = (): Manifest | null => (fs.existsSync(adsJsonPath()) ? readJson(adsJsonPath()) : null);
export const manifestText = (m: Manifest): string => JSON.stringify(m, null, 2) + '\n';
export function writeManifest(m: Manifest) { fs.mkdirSync(path.dirname(adsJsonPath()), { recursive: true }); fs.writeFileSync(adsJsonPath(), manifestText(m)); }

/** What differs between the committed manifest and the one the families make now (empty: it is current). */
export function manifestDrift(old: Manifest | null, now: Manifest): string[] {
  if (!old) return ['content/story/ads.json does not exist'];
  const why: string[] = [], ids = (m: Manifest) => new Map(Object.entries(m.families).flatMap(([s, f]) => f.cuts.map((c): [string, ManifestCut] => [c.id, c])));
  const a = ids(old), b = ids(now);
  for (const [id, c] of b) { const o = a.get(id); if (!o) why.push(`${id}: new`); else if (o.hash !== c.hash) why.push(`${id}: changed`); else if (canon(o) !== canon(c)) why.push(`${id}: its record changed`); }
  for (const id of a.keys()) if (!b.has(id)) why.push(`${id}: gone`);
  if (canon(old.defaults) !== canon(now.defaults)) why.push('the defaults changed');
  return why;
}

/** Problems with a manifest's shape (an empty list: it is well formed). Used by the tests. */
export function manifestProblems(m: Manifest): string[] {
  const why: string[] = [];
  if (!m || m.v !== 1 || typeof m.families !== 'object') return ['ads.json: not { v: 1, families: {} }'];
  for (const [slug, f] of Object.entries(m.families)) {
    for (const c of f.cuts) {
      const at = (x: string) => why.push(`ads.json ${c.id}: ${x}`);
      if (c.id !== `${slug}-${c.member}`) at('the id is not <slug>-<member>');
      if (!/^[0-9a-f]{64}$/.test(c.hash || '')) at('no hash');
      if (!(c.durationS >= CUT.minS - 1e-9 && c.durationS <= CUT.maxS + 1e-9) && c.status !== 'short') at(`${c.durationS} s is not within ${CUT.minS} to ${CUT.maxS}`);
      if (!c.hook || !c.hook.text) at('no hook');
      if (!c.beats.length || c.beats.length !== c.captions.length) at('beats and captions do not match');
      if (!c.disclosures.includes('fictional-family') || !c.disclosures.includes('beta-short')) at('the label or the beta line is missing');
      if (c.cta.label !== 'See Companion Core' || c.cta.url !== 'https://ci.computer/core') at('the call to action is not See Companion Core at ci.computer/core');
      if (!c.aspects.length || c.aspects.some(a => !CUT_KEYS.includes(a))) at('aspects');
    }
  }
  return why;
}

// ---- what this machine has rendered ----------------------------------------------------------------------------------------------------------
export type RenderRecord = {
  /** the cut's hash and the code's hash it was made from: either moving makes the file stale */
  hash: string; tool: string; file: string; sha256: string; bytes: number; width: number; height: number; durationS: number; frames: number;
  res: number; lighting: string; audio: string; gl: string; renderer: string; wallSeconds: number; frameDigest: string;
};
export type Renders = { v: 1; renders: Record<string, RenderRecord> };
/** one file and one record for each (cut, aspect, short edge, audio): a silent-AAC file is its own file, the hour is not part of the name (the last hour rendered is the one kept) */
export const renderKey = (id: string, aspect: CutKey, res: number, audio: string = 'none') => `${id}.${aspect}.${res}${audio === 'silent' ? '.silent' : ''}`;
export const outName = (id: string, aspect: CutKey, res: number, audio: string = 'none') => `${id}.${aspect}${res === 1080 ? '' : `.r${res}`}${audio === 'silent' ? '.silent' : ''}.mp4`;
export function readRenders(): Renders { const f = rendersPath(); return fs.existsSync(f) ? readJson(f) : { v: 1, renders: {} }; }
export function writeRenders(r: Renders) {
  const sorted: Renders = { v: 1, renders: Object.fromEntries(Object.keys(r.renders).sort().map(k => [k, r.renders[k]])) };
  fs.mkdirSync(path.dirname(rendersPath()), { recursive: true }); fs.writeFileSync(rendersPath(), JSON.stringify(sorted, null, 2) + '\n');
}
/** Is the file this machine rendered for (cut, aspect, res) still the one the plan and the code make? */
export function renderState(rec: RenderRecord | undefined, hash: string, tool: string, opts: { lighting: string; audio: string }): 'current' | 'stale' | 'missing' {
  if (!rec || !fs.existsSync(path.join(adsOutDir(), rec.file))) return 'missing';
  return rec.hash === hash && rec.tool === tool && rec.lighting === opts.lighting && rec.audio === opts.audio ? 'current' : 'stale';
}

// ---- the browser -----------------------------------------------------------------------------------------------------------------------------
export type GlMode = 'default' | 'software';
export const GL_MODES: GlMode[] = ['default', 'software'];
/**
 * The Chromium flags for the GPU. `software` is the repo's own (portal-lib.mts LAUNCH_ARGS: ANGLE on SwiftShader, the CPU: hours a film on this machine).
 * `default` lets ANGLE choose the machine's own GPU: on Linux the Intel iGPU here (about 46 s for a 12 s 9:16 clip at 1080 wide). NEVER `--use-angle=vulkan`:
 * on the NVIDIA it gives blank frames (and renderFrames would not know), which is why the renderer also checks the first and last frame for a spread.
 */
export function glArgs(mode: GlMode, platform: string = process.platform): string[] {
  if (mode === 'default' && platform === 'linux') return ['--use-gl=angle', '--use-angle=default', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-gpu-watchdog', '--no-sandbox'];
  return LAUNCH_ARGS.slice();
}
/** the mode from a flag or PERSONA_CUT_GL; `default` where nothing says */
export function glMode(flag: string | undefined, env: NodeJS.ProcessEnv = process.env): GlMode {
  const v = (flag || env.PERSONA_CUT_GL || 'default') as GlMode;
  if (!GL_MODES.includes(v)) throw new Error(`--gl (or PERSONA_CUT_GL) must be one of ${GL_MODES.join(', ')}, got ${v}`);
  return v;
}
/**
 * The Chromium to launch. Playwright's own when it is installed; otherwise the newest Chromium in the browsers folder ($PLAYWRIGHT_BROWSERS_PATH, then ~/.cache/ms-playwright):
 * the pinned Playwright asks for a build that a machine may not have, and a render needs a browser, not that revision. Never downloads anything.
 */
export function chromiumFor(pw: any, env: NodeJS.ProcessEnv = process.env): { executablePath?: string; note: string } {
  let own: string | undefined; try { own = pw.chromium.executablePath(); } catch { /* none */ }
  if (own && fs.existsSync(own)) return { note: `Playwright's own Chromium (${own})` };
  const roots = [env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), '.cache', 'ms-playwright')].filter((x): x is string => !!x && fs.existsSync(x));
  const found: Array<{ rev: number; exe: string; shell: boolean }> = [];
  for (const root of roots) for (const d of fs.readdirSync(root)) {
    const m = /^(chromium_headless_shell|chromium)-(\d+)$/.exec(d); if (!m) continue;
    const shell = m[1] === 'chromium_headless_shell';
    for (const sub of fs.readdirSync(path.join(root, d))) {
      const exe = path.join(root, d, sub, shell ? 'chrome-headless-shell' : 'chrome');
      if (sub.startsWith('chrome') && fs.existsSync(exe)) found.push({ rev: +m[2], exe, shell });
    }
  }
  found.sort((a, b) => (b.shell === a.shell ? b.rev - a.rev : a.shell ? -1 : 1));
  if (!found.length) return { note: 'no Chromium found (pnpm exec playwright install chromium: a download the owner approves)' };
  return { executablePath: found[0].exe, note: `${found[0].exe} (the pinned Playwright's own build is not installed)` };
}
