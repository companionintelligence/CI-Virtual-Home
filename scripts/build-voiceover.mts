#!/usr/bin/env -S node --experimental-strip-types
// Records the voice-over of the family stories, locally, with Kokoro-82M.
//
//   pnpm run story:voice -- <slug> [<slug> ...]      record every clip of those families (re-record + verify determinism)
//   pnpm run story:voice -- --all                    every family that has a story file
//   pnpm run story:voice -- <slug> --stale           record only clips whose text, spoken form, voice or speed changed
//   pnpm run story:voice -- <slug> --only <clipId>   record one clip (with --stale: only if it is stale)
//   pnpm run story:voice -- <slug> --dry-run         say what would be recorded, touch nothing
//   pnpm run story:voice -- --sheet [--out DIR]      write a listening sheet (8 voices) outside the repo, for a human to listen to
//
// Per family it reads content/families/<slug>.json, and writes content/families/<slug>.voice.json (the lock) and
// content/families/<slug>/audio/<clipId>.<hash10>.m4a. The clips: one per beat (popup.body, read by the family narrator),
// one per agent line (`<beat>.say`, read by that companion's voice) and `closing` (closing.body + " UnCloud your life.").
//
// There is deliberately no --force. A clip that is current is never re-recorded by --stale, and a plain run only replaces a
// file when the new bytes differ (they should not: same text, same voice, same seed, same toolchain gives the same bytes).
//
// Exit codes: 0 done, 1 a clip failed a QA gate or the family is over its audio budget, 2 usage, 3 the Kokoro environment is missing.
import fs from 'node:fs';
import path from 'node:path';
import type { ClipId } from '../assets/story/types.ts';
import { CLIP_FILE_RE, audioDir, budgetBytes, clipsOf, familiesDir, listSlugs, loadLexicon, loadStory, loadVoices, lexiconSha, lockPath, readLock, ROOT, statusOf, storyShaOf, stringifyLock } from './voice/lib.mts';
import type { Expected, Lock, LockClip, Status } from './voice/lib.mts';
import { EngineMissing, engineBlock, finish, hashName, lockClip, requireEngine, scratch, synthesise } from './voice/engine.mts';
import type { Item } from './voice/engine.mts';
import { buildSheet } from './voice/sheet.mts';

interface Args { slugs: string[]; all: boolean; stale: boolean; only: string[]; dryRun: boolean; sheet: boolean; out?: string }

function parseArgs(argv: string[]): Args {
  const a: Args = { slugs: [], all: false, stale: false, only: [], dryRun: false, sheet: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--') continue;
    else if (v === '--all') a.all = true;
    else if (v === '--stale') a.stale = true;
    else if (v === '--dry-run') a.dryRun = true;
    else if (v === '--sheet') a.sheet = true;
    else if (v === '--only') a.only.push(...String(argv[++i] ?? '').split(',').filter(Boolean));
    else if (v === '--out') a.out = argv[++i];
    else if (v === '--force') usage('there is no --force: a clip is re-recorded because its text, voice or speed changed, not on demand');
    else if (v.startsWith('-')) usage(`unknown option ${v}`);
    else a.slugs.push(v);
  }
  return a;
}
function usage(msg?: string): never {
  if (msg) console.error(`story:voice: ${msg}\n`);
  console.error('usage: pnpm run story:voice -- <slug ...|--all> [--stale] [--only <clipId>] [--dry-run]\n       pnpm run story:voice -- --sheet [--out DIR]');
  process.exit(2);
}

const args = parseArgs(process.argv.slice(2));
const reg = loadVoices();
const lex = loadLexicon();

if (args.sheet) {
  try {
    const env = requireEngine();
    const out = args.out ?? path.join(process.env.TMPDIR ?? '/tmp', 'ci-story-voice-sheet');
    await buildSheet(env, reg, lex, out);
    process.exit(0);
  } catch (e) { fail(e); }
}

if (!args.all && args.slugs.length === 0) usage('name a family slug, or --all');
if (args.all && args.slugs.length) usage('give slugs or --all, not both');
const slugs = args.all ? listSlugs() : args.slugs;
if (slugs.length === 0) { console.error(`story:voice: no story files in ${path.relative(ROOT, familiesDir())}`); process.exit(2); }
if (args.only.length && slugs.length !== 1) usage('--only takes exactly one family');

function fail(e: unknown): never {
  if (e instanceof EngineMissing) { console.error(e.message); process.exit(3); }
  console.error(`story:voice: ${(e as Error).message}`);
  process.exit(1);
}

// ---- plan -------------------------------------------------------------------------------------------------------------
interface Plan { slug: string; expected: Expected[]; lock: Lock | null; status: Status[]; record: Expected[]; orphans: ClipId[] }
const plans: Plan[] = [];
for (const slug of slugs) {
  let expected: Expected[];
  try { expected = clipsOf(loadStory(slug), reg, lex); } catch (e) { fail(e); }
  const lock = readLock(slug);
  const status = statusOf(slug, expected, lock);
  const bad = new Set(status.filter(s => !s.ok).map(s => s.id));
  for (const id of args.only) if (!expected.some(e => e.id === id)) usage(`${slug} has no clip "${id}" (clips: ${expected.map(e => e.id).join(', ')})`);
  let record = expected;
  if (args.only.length) record = record.filter(e => args.only.includes(e.id));
  if (args.stale) record = record.filter(e => bad.has(e.id));
  const orphans = Object.keys(lock?.clips ?? {}).filter(id => !expected.some(e => e.id === id));
  plans.push({ slug, expected, lock, status, record, orphans });
}

for (const p of plans) {
  const words = p.expected.reduce((n, e) => n + e.text.split(/\s+/).length, 0);
  const stale = p.status.filter(s => !s.ok);
  console.log(`${p.slug}: ${p.expected.length} clips, ${words} words, about ${Math.round((words / 150) * 60)} s of speech; ${p.lock ? `${p.status.length - stale.length} current, ${stale.length} stale` : 'no lock yet'}${p.orphans.length ? `; ${p.orphans.length} orphan(s) in the lock` : ''}`);
  for (const s of stale) console.log(`  stale  ${s.id.padEnd(28)} ${s.why.join(', ')}`);
  for (const o of p.orphans) console.log(`  orphan ${o} (no longer in the story; its entry and file are removed on a real run)`);
  console.log(`  -> ${args.dryRun ? 'would record' : 'recording'} ${p.record.length} clip(s)${p.record.length ? ': ' + p.record.map(r => r.id).join(', ') : ''}`);
  const applied = [...new Set(p.expected.flatMap(e => e.applied))];
  if (applied.length) console.log(`  lexicon applied: ${applied.join(', ')}`);
}
if (args.dryRun) process.exit(0);

// ---- record ------------------------------------------------------------------------------------------------------------
const work = plans.flatMap(p => p.record.map(e => ({ slug: p.slug, e })));
const tmp = scratch();
let failures = 0;
try {
  let synthEngine: Record<string, unknown> | null = null;
  const done = new Map<string, import('./voice/engine.mts').Recorded>();
  if (work.length) {
    const env = requireEngine();
    const items: Item[] = work.map(w => ({ key: `${w.slug}/${w.e.id}`, voice: w.e.kokoro, speed: w.e.speed, text: w.e.spoken }));
    console.log(`\nsynthesising ${items.length} clip(s) with Kokoro-82M (local, CPU) ...`);
    const res = await synthesise(env, reg, items, path.join(tmp, 'synth'));
    synthEngine = res.engine;
    console.log('\nencoding and checking ...');
    fs.mkdirSync(path.join(tmp, 'enc'), { recursive: true });
    work.forEach((w, n) => {
      const key = `${w.slug}/${w.e.id}`;
      const r = finish(key, w.e.text, res.clips[key], path.join(tmp, 'enc'), n);
      done.set(key, r);
    });
  }

  for (const p of plans) {
    const prior = p.lock;
    const clips: Record<ClipId, LockClip> = {};
    for (const e of p.expected) {
      const old = prior?.clips[e.id];
      const r = done.get(`${p.slug}/${e.id}`);
      if (!r) { if (old) clips[e.id] = old; continue; }           // not selected: untouched
      if (!r.ok) {
        failures++;
        console.error(`FAIL ${p.slug}/${e.id}: ${r.why.join('; ')}`);
        if (old) clips[e.id] = old;                                   // keep what was there; the test reports it stale
        continue;
      }
      const file = hashName(e.id, r.bytes);
      const dir = audioDir(p.slug);
      const why = p.status.find(x => x.id === e.id)?.why ?? [];
      const note = !old ? 'new' : why.some(w => w !== 'file') ? `re-recorded (${why.join(', ')} changed)` : old.sha256 === r.sha ? 'identical to the lock (deterministic)' : 'BYTES CHANGED with nothing to explain it: the toolchain moved';
      console.log(`ok   ${p.slug}/${e.id.padEnd(26)} ${(r.durationMs / 1000).toFixed(2)}s ${String(r.bytes.length).padStart(6)} B ${r.loudness.I.toFixed(1)} LUFS ${r.loudness.TP.toFixed(1)} dBTP  ${note}`);
      if (!old || old.sha256 !== r.sha || !fs.existsSync(path.join(dir, file))) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, file), r.bytes);
      }
      clips[e.id] = lockClip(e, r);
    }

    // an engine block from this run if we recorded anything, else the one that was there
    const engine = synthEngine && p.record.length ? engineBlock(synthEngine, prior?.engine as Record<string, unknown> | undefined) : prior?.engine;
    if (!engine) continue;                                             // nothing recorded and no lock: nothing to write
    if (prior && synthEngine && p.record.length < p.expected.length) {
      const was = prior.engine as Record<string, unknown>, now = engine as Record<string, unknown>;
      const drift = ['kokoro', 'misaki', 'torch', 'modelRevision', 'weightsSha256', 'ffmpeg', 'threads'].filter(k => was[k] !== now[k]);
      if (drift.length) console.warn(`warning: ${p.slug}: the toolchain changed since the other clips were recorded (${drift.join(', ')}); a full run (no --stale) re-records them all`);
    }
    const lock: Lock = { v: 1, slug: p.slug, storySha: prior?.storySha ?? '', lexiconSha: prior?.lexiconSha ?? '', engine, clips };
    const after = statusOf(p.slug, p.expected, lock);
    if (after.every(s => s.ok)) { lock.storySha = storyShaOf(p.expected); lock.lexiconSha = lexiconSha(lex); }
    // order the clips as the story is told
    lock.clips = Object.fromEntries(p.expected.filter(e => clips[e.id]).map(e => [e.id, clips[e.id]]));
    fs.mkdirSync(familiesDir(), { recursive: true });
    const lf = lockPath(p.slug);
    const body = stringifyLock(lock);
    if (!fs.existsSync(lf) || fs.readFileSync(lf, 'utf8') !== body) fs.writeFileSync(lf, body);

    // housekeeping: this folder holds only what the lock points at. A superseded or orphaned clip is a derived, content-hashed file
    // this tool wrote, so it goes; anything not named <clipId>.<hash10>.m4a is left alone.
    const keep = new Set(Object.values(lock.clips).map(c => path.basename(c.file)));
    if (fs.existsSync(audioDir(p.slug))) {
      for (const f of fs.readdirSync(audioDir(p.slug))) if (CLIP_FILE_RE.test(f) && !keep.has(f)) fs.rmSync(path.join(audioDir(p.slug), f), { force: true });
    }

    const total = Object.values(lock.clips).reduce((n, c) => n + c.bytes, 0);
    const budget = budgetBytes(reg);
    const secs = Object.values(lock.clips).reduce((n, c) => n + c.durationMs, 0) / 1000;
    console.log(`${p.slug}: ${Object.keys(lock.clips).length}/${p.expected.length} clips, ${secs.toFixed(1)} s, ${(total / 1024).toFixed(0)} KB of audio (budget ${(budget / 1024).toFixed(0)} KB)${after.every(s => s.ok) ? '' : '; NOT all clips are current'}`);
    if (total > budget) { failures++; console.error(`FAIL ${p.slug}: ${total} bytes of audio is over the family budget of ${budget} bytes. Shorten the narration (popup.body) or change encoding.budgetBytes in content/story/voices.json on purpose.`); }
  }
} catch (e) {
  fail(e);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(failures ? 1 : 0);
