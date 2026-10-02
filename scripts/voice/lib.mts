// Shared by scripts/build-voiceover.mts, scripts/test-voiceover.mts and scripts/story/ship/audio.mts.
// Pure Node, no ffmpeg and no Python here, so the test and the site build can use it on a machine with neither.
//
// What it owns: where the voice files live, the clip list of a story (what is spoken, in which voice), the lexicon,
// the hashes that decide whether a recorded clip is still current, and the lock file format.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SIGNOFF, VOICE_KEYS } from '../../assets/story/types.ts';
import type { ClipId, Story, VoiceKey, VoiceLock, Clip } from '../../assets/story/types.ts';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
/** content/families, read each call so a test can point it at a temp folder with CI_STORY_FAMILIES_DIR (nothing else sets it). */
export const familiesDir = (): string => process.env.CI_STORY_FAMILIES_DIR ? path.resolve(process.env.CI_STORY_FAMILIES_DIR) : path.join(ROOT, 'content', 'families');
export const STORY_DIR = path.join(ROOT, 'content', 'story');

export const sha256 = (data: string | Uint8Array): string => crypto.createHash('sha256').update(data).digest('hex');
export const hash10 = (bytes: Uint8Array): string => sha256(bytes).slice(0, 10);

// ---- paths -------------------------------------------------------------------------------------------------------
export const storyPath = (slug: string) => path.join(familiesDir(), `${slug}.json`);
export const lockPath = (slug: string) => path.join(familiesDir(), `${slug}.voice.json`);
export const audioDir = (slug: string) => path.join(familiesDir(), slug, 'audio');
/** `<clipId>.<hash10>.m4a`: the name carries the hash, so a re-record never overwrites a file a deployed page may hold. */
export const clipFileName = (id: ClipId, bytes: Uint8Array) => `${id}.${hash10(bytes)}.m4a`;
/** Content-hashed name check: the 10 hex before `.m4a` must be the first 10 of the sha256 of the bytes. */
export const CLIP_FILE_RE = /^(?<id>[a-z0-9][a-z0-9.-]*?)\.(?<hash>[0-9a-f]{10})\.m4a$/;

/** Slugs that have an authored story file (voice, bake, films and other generated files in the same folder are not stories). */
export function listSlugs(): string[] {
  if (!fs.existsSync(familiesDir())) return [];
  return fs.readdirSync(familiesDir())
    .filter(f => f.endsWith('.json') && !/\.(voice|bake)\.json$/.test(f) && f !== 'films.json')
    .map(f => f.slice(0, -5)).sort();
}
export const lockSlugs = (): string[] => fs.existsSync(familiesDir())
  ? fs.readdirSync(familiesDir()).filter(f => f.endsWith('.voice.json')).map(f => f.slice(0, -'.voice.json'.length)).sort() : [];

// ---- the voice registry (content/story/voices.json) ----------------------------------------------------------------------
export interface VoiceEntry { kokoro: string; speed: number; sex?: string; f0Hz?: number; grade?: string; accent?: string; status?: string; agentFits?: string[]; narratorFor?: number }
export interface VoiceRegistry {
  engine: { name: string; model: string; modelRevision: string; weightsSha256?: string };
  voices: Record<string, VoiceEntry>;
  encoding: { trimLeadMs: number; budgetBytes?: number; [k: string]: unknown };
}
export function loadVoices(): VoiceRegistry {
  const v = JSON.parse(fs.readFileSync(path.join(STORY_DIR, 'voices.json'), 'utf8')) as VoiceRegistry;
  return v;
}
export const budgetBytes = (reg: VoiceRegistry): number => reg.encoding.budgetBytes ?? 700_000;

// ---- the lexicon (content/story/lexicon.json) ----------------------------------------------------------------------------
// Pronunciation overrides for names the G2P gets wrong. `ph` is in misaki's phoneme alphabet for British English
// (the voices are all `b*`): the same symbols as GB_VOCAB below. The text handed to the engine becomes
// `[Odoo](/ˈuːduː/)`, so the word stays in the token list and keeps its timing.
export interface LexEntry { word: string; ph: string; say?: string; note?: string }
export interface Lexicon { v: 1; entries: LexEntry[] }
/** misaki.en GB_VOCAB: every symbol Kokoro's British front end accepts in a phoneme override. */
export const GB_VOCAB = new Set('AIQWYabdfhijklmnpstuvwzðŋɑɒɔəɛɜɡɪɹʃʊʌʒʤʧˈˌːθᵊ'.split(''));

export function loadLexicon(): Lexicon {
  const f = path.join(STORY_DIR, 'lexicon.json');
  if (!fs.existsSync(f)) return { v: 1, entries: [] };
  return JSON.parse(fs.readFileSync(f, 'utf8')) as Lexicon;
}
/** Over the entries only (word and phonemes, sorted), so a note or a reordering does not read as a change. */
export const lexiconSha = (lex: Lexicon): string =>
  sha256(JSON.stringify([...lex.entries].map(e => [e.word, e.ph]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))));

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A name is replaced only as a whole word: not inside another word, and not as the tail of a hyphenated one. */
const wordRe = (w: string) => new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRe(w)}(?![\\p{L}\\p{N}_-])`, 'giu');

/** The string handed to Kokoro. Typographic apostrophes become plain ones; lexicon names become `[Name](/phonemes/)`. */
export function spokenForm(text: string, lex: Lexicon): { spoken: string; applied: string[] } {
  let spoken = text.trim().replace(/\s+/g, ' ').replace(/[‘’]/g, "'");
  const applied: string[] = [];
  // longest names first so "Paperless-ngx" is tried before a hypothetical "Paperless"
  for (const e of [...lex.entries].sort((a, b) => b.word.length - a.word.length)) {
    const re = wordRe(e.word);
    if (re.test(spoken)) {
      applied.push(e.word);
      re.lastIndex = 0;
      // keep the surface form as written: the token text (and the caption highlight) must match the page
      spoken = spoken.replace(re, m => `[${m}](/${e.ph}/)`);
    }
  }
  return { spoken, applied };
}

// ---- stories and the clip list ---------------------------------------------------------------------------------------------
export function loadStory(slug: string): Story {
  const f = storyPath(slug);
  if (!fs.existsSync(f)) throw new Error(`no story for "${slug}": ${path.relative(ROOT, f)} does not exist`);
  return JSON.parse(fs.readFileSync(f, 'utf8')) as Story;
}

/** One thing to record: what is said, who says it, and everything that decides whether a recording is still current. */
export interface Expected {
  id: ClipId; speaker: 'narrator' | string; voice: VoiceKey; kokoro: string; speed: number;
  text: string; textSha: string; spoken: string; spokenSha: string; applied: string[];
}

/**
 * The clips of a story, in tour order: for each beat its narration (`popup.body`, read by the family narrator) and its
 * agent line `<beat>.say` (read by that companion's voice), then `closing`. Children are never voiced: a `say` line
 * must belong to a member with a companion, and the schema gives companions only to adults and teens.
 */
export function clipsOf(story: Story, reg: VoiceRegistry = loadVoices(), lex: Lexicon = loadLexicon()): Expected[] {
  const out: Expected[] = [];
  const add = (id: ClipId, speaker: string, voice: VoiceKey, raw: string) => {
    const entry = reg.voices[voice];
    if (!(VOICE_KEYS as readonly string[]).includes(voice) || !entry) throw new Error(`${story.slug}: clip ${id} uses voice "${voice}", which is not in the registry`);
    const text = raw.trim();
    if (!text) throw new Error(`${story.slug}: clip ${id} has no text`);
    const { spoken, applied } = spokenForm(text, lex);
    out.push({ id, speaker, voice, kokoro: entry.kokoro, speed: entry.speed, text, textSha: sha256(text), spoken, spokenSha: sha256(spoken), applied });
  };
  const narrator = story.family.narrator;
  for (const b of story.beats) {
    add(b.id, 'narrator', narrator, b.popup.body);
    if (b.say) {
      const who = story.members.find(m => m.id === b.say!.speaker);
      if (!who?.companion) throw new Error(`${story.slug}: beat ${b.id} say.speaker "${b.say.speaker}" is not a member with a companion`);
      add(`${b.id}.say`, b.say.speaker, who.companion.voice, b.say.text);
    }
  }
  add('closing', 'narrator', narrator, `${story.closing.body.trim()} ${SIGNOFF}`);
  const seen = new Set<string>();
  for (const c of out) { if (seen.has(c.id)) throw new Error(`${story.slug}: duplicate clip id ${c.id}`); seen.add(c.id); }
  return out;
}

/** Changes only when something spoken changes: the ids, voices and texts, in order. Not when a chip or a title is edited. */
export const storyShaOf = (clips: Expected[]): string => sha256(JSON.stringify(clips.map(c => [c.id, c.voice, c.textSha])));

// ---- the lock ------------------------------------------------------------------------------------------------------------------
/** The lock as written: VoiceLock plus one field per clip, `spokenSha`, the hash of the lexicon-applied string. A lexicon
 *  edit then re-records exactly the clips whose spoken form changed, instead of every clip in the fleet. */
export type LockClip = Clip & { spokenSha: string };
export type Lock = Omit<VoiceLock, 'clips'> & { clips: Record<ClipId, LockClip> };

export function readLock(slug: string): Lock | null {
  const f = lockPath(slug);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Lock) : null;
}

/** Pretty JSON with every [word, start, end] triple on one line, so a lock diff reads word by word. */
export function stringifyLock(lock: Lock): string {
  const s = JSON.stringify(lock, null, 2);
  return s.replace(/\[\s+("(?:[^"\\]|\\.)*"),\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2, $3]')
    .replace(/\{\s+"I": (-?[\d.]+),\s+"TP": (-?[\d.]+)\s+\}/g, '{ "I": $1, "TP": $2 }') + '\n';
}

export type Why = 'new' | 'text' | 'spoken' | 'voice' | 'speed' | 'file';
export interface Status { id: ClipId; ok: boolean; why: Why[] }

/** Is each expected clip recorded, current and intact? `why` lists every reason a clip is stale. */
export function statusOf(slug: string, expected: Expected[], lock: Lock | null): Status[] {
  return expected.map(e => {
    const c = lock?.clips[e.id];
    if (!c) return { id: e.id, ok: false, why: ['new' as Why] };
    const why: Why[] = [];
    if (c.textSha !== e.textSha) why.push('text');
    if (c.spokenSha !== e.spokenSha) why.push('spoken');
    if (c.voice !== e.voice || c.kokoro !== e.kokoro) why.push('voice');
    if (c.speed !== e.speed) why.push('speed');
    const f = path.join(familiesDir(), slug, c.file);
    if (!fs.existsSync(f) || sha256(fs.readFileSync(f)) !== c.sha256) why.push('file');
    return { id: e.id, ok: why.length === 0, why };
  });
}

// ---- the truncation guard -----------------------------------------------------------------------------------------------------
// Ported from CI-Common packages/video-kit/src/narrate.ts (same organisation): a vowel-group syllable estimate, and the
// fastest read anyone should believe. A file shorter than this is cut off, not fast.
const syllablesInWord = (word: string): number => {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
};
export const syllables = (text: string): number => text.trim().split(/\s+/).filter(Boolean).reduce((n, w) => n + syllablesInWord(w), 0);
export const MAX_SYLLABLES_PER_SECOND = 7.0;
export const MIN_CLIP_SECONDS = 0.8;
export const minSeconds = (text: string): number => Math.max(syllables(text) / MAX_SYLLABLES_PER_SECOND, MIN_CLIP_SECONDS);
