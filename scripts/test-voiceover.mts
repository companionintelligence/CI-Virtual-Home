#!/usr/bin/env -S node --experimental-strip-types
// Tests for the family voice-over tooling: the lexicon, the voice registry, the clip list, the encode and QA path, the lock, and
// every lock that is committed (content/families/<slug>.voice.json).
// Usage: pnpm run test:voiceover   (or node --experimental-strip-types --test scripts/test-voiceover.mts)
//
// It needs no GPU, no network and not Kokoro. The ffmpeg tests skip themselves on a machine without ffmpeg. Set VOICE_TEST_DEEP=1
// to also decode every committed clip and re-measure its loudness and true peak (about 0.3 s a clip).
// @check-house node-test
// @check-house quick
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SIGNOFF, VOICE_KEYS } from '../assets/story/types.ts';
import type { Story } from '../assets/story/types.ts';
import { CLIP_FILE_RE, familiesDir, GB_VOCAB, ROOT, audioDir, budgetBytes, clipsOf, hash10, listSlugs, loadLexicon, loadStory, loadVoices, lexiconSha, lockPath, lockSlugs, minSeconds, readLock, sha256, spokenForm, statusOf, storyShaOf, stringifyLock, syllables } from './voice/lib.mts';
import type { Lock } from './voice/lib.mts';
import { GATE, TARGET_LUFS, decodedStats, gate, have, measure, normaliseAndEncode, probe } from './voice/audio.mts';
import { finish, lockClip } from './voice/engine.mts';
import type { Synth } from './voice/engine.mts';
import shipAudio from './story/ship/audio.mts';

const FIXTURE = path.join(ROOT, 'test', 'fixtures', 'stories', 'exemplar.json');
const fixture = (): Story => JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Story;
const reg = loadVoices();
const lex = loadLexicon();
const ffmpeg = have('ffmpeg') && have('ffprobe');

// ---- the lexicon -----------------------------------------------------------------------------------------------------------------
test('lexicon: shape, alphabet and the names the owner listed', () => {
  assert.equal(lex.v, 1);
  const seen = new Set<string>();
  for (const e of lex.entries) {
    assert.ok(e.word && e.ph, `entry ${JSON.stringify(e)} needs word and ph`);
    assert.ok(!seen.has(e.word.toLowerCase()), `duplicate lexicon word ${e.word}`);
    seen.add(e.word.toLowerCase());
    for (const ch of e.ph) assert.ok(GB_VOCAB.has(ch), `${e.word}: "${ch}" is not in misaki's British phoneme set`);
    assert.ok(e.ph.includes('ˈ'), `${e.word}: needs a primary stress, got "${e.ph}"`);
    assert.ok(!/[\[\]()\/]/.test(e.ph), `${e.word}: phonemes must not contain markdown characters`);
    assert.ok(!/[–—]/.test(`${e.say ?? ''}${e.note ?? ''}`), 'no dashes in any string');
  }
  for (const w of ['Odoo', 'Koodo', 'Spliit', 'SearXNG', 'Keila', 'Affine', 'n8n']) assert.ok(seen.has(w.toLowerCase()), `lexicon is missing ${w}`);
  assert.equal(lexiconSha(lex), lexiconSha({ ...lex, entries: [...lex.entries].reverse() }), 'order does not change the lexicon hash');
});

test('lexicon: whole words only, surface form kept, possessives and sentence ends handled', () => {
  const l = { v: 1 as const, entries: [{ word: 'Odoo', ph: 'ˈuːduː' }, { word: 'n8n', ph: 'ɛnˈAtˌɛn' }] };
  assert.equal(spokenForm('Mika opens Odoo.', l).spoken, 'Mika opens [Odoo](/ˈuːduː/).');
  assert.equal(spokenForm("Odoo's list, then ODOO.", l).spoken, "[Odoo](/ˈuːduː/)'s list, then [ODOO](/ˈuːduː/).");
  assert.equal(spokenForm('Odoos and Odoo-like stay as they are.', l).spoken, 'Odoos and Odoo-like stay as they are.');
  assert.equal(spokenForm('A flow in n8n runs.', l).applied.join(), 'n8n');
  assert.equal(spokenForm('No names here.', l).spoken, 'No names here.');
  assert.equal(spokenForm("Core’s  footprint\n", l).spoken, "Core's footprint", 'typographic apostrophe and spacing are normalised');
});

// ---- the registry ------------------------------------------------------------------------------------------------------------------
test('voices.json: keys equal VOICE_KEYS, every voice is British and pinned', () => {
  assert.deepEqual(Object.keys(reg.voices).sort(), [...VOICE_KEYS].sort(), 'the keys are a contract');
  for (const [k, v] of Object.entries(reg.voices)) {
    assert.match(v.kokoro, /^b[fm]_[a-z]+$/, `${k}: lang_code "b" only takes bf_ and bm_ voices`);
    assert.ok(v.speed >= 0.8 && v.speed <= 1.1, `${k}: speed ${v.speed} should stay near natural`);
  }
  assert.equal(reg.engine.modelRevision, 'f3ff3571791e39611d31c381e3a41a3af07b4987');
  assert.match(reg.engine.weightsSha256 ?? '', /^496dba11[0-9a-f]{56}$/);
  assert.equal(reg.encoding.trimLeadMs, 80);
  assert.equal(budgetBytes(reg), 700_000);
});

// ---- the clip list -------------------------------------------------------------------------------------------------------------------
test('clips: one per beat, one per say line, then closing; narrator and companion voices; sign-off added', () => {
  const s = fixture();
  const clips = clipsOf(s, reg, lex);
  const ids = clips.map(c => c.id);
  const expected = [...s.beats.flatMap(b => b.say ? [b.id, `${b.id}.say`] : [b.id]), 'closing'];
  assert.deepEqual(ids, expected);
  assert.equal(new Set(ids).size, ids.length);
  for (const b of s.beats) {
    const c = clips.find(x => x.id === b.id)!;
    assert.equal(c.text, b.popup.body);
    assert.equal(c.speaker, 'narrator');
    assert.equal(c.voice, s.family.narrator);
    if (b.say) {
      const say = clips.find(x => x.id === `${b.id}.say`)!;
      const owner = s.members.find(m => m.id === b.say!.speaker)!;
      assert.equal(say.voice, owner.companion!.voice, 'a say line is read by its companion');
      assert.equal(say.text, b.say.text);
    }
  }
  const closing = clips.at(-1)!;
  assert.equal(closing.text, `${s.closing.body} ${SIGNOFF}`);
  assert.ok(closing.spoken.includes('[UnCloud]'), 'the sign-off goes through the lexicon');
  assert.equal(storyShaOf(clips), storyShaOf(clipsOf(s, reg, lex)), 'story hash is stable');
});

test('clips: a say line from a member without a companion is an error, children are never voiced', () => {
  const s = fixture();
  const child = { id: 'kid', name: 'Kid', age: 6, role: 'child', colour: 'chart-1' };
  s.members.push(child as never);
  s.beats[0].say = { speaker: 'kid', text: 'Hello.' };
  assert.throws(() => clipsOf(s, reg, lex), /not a member with a companion/);
});

test('clips: textSha, voice and the lexicon decide what is stale; a title edit does not', () => {
  const s = fixture();
  const a = clipsOf(s, reg, lex);
  const lock = { v: 1, slug: s.slug, storySha: '', lexiconSha: '', engine: {}, clips: Object.fromEntries(a.map(e => [e.id, { text: e.text, textSha: e.textSha, spokenSha: e.spokenSha, voice: e.voice, kokoro: e.kokoro, speed: e.speed, file: 'audio/none.m4a', sha256: 'x' }])) } as unknown as Lock;
  // statusOf also checks the file, which does not exist here; take the logical reasons only
  const why = (st: ReturnType<typeof statusOf>) => Object.fromEntries(st.map(x => [x.id, x.why.filter(w => w !== 'file').join()]));
  const none = why(statusOf(s.slug, a, lock));
  assert.ok(Object.values(none).every(w => w === ''), 'nothing is stale when nothing changed');
  s.beats[1].popup.title = 'A different title';
  assert.deepEqual(why(statusOf(s.slug, clipsOf(s, reg, lex), lock)), none, 'titles are not spoken');
  s.beats[1].popup.body = s.beats[1].popup.body + ' Added.';
  assert.equal(why(statusOf(s.slug, clipsOf(s, reg, lex), lock))[s.beats[1].id], 'text,spoken');
  const lex2 = { v: 1 as const, entries: [...lex.entries, { word: 'Immich', ph: 'ɪmˈɪʧ' }] };
  const touched = statusOf(s.slug, clipsOf(fixture(), reg, lex2), lock).filter(x => x.why.includes('spoken')).map(x => x.id);
  const mentions = fixture().beats.filter(b => /\bImmich\b/i.test(b.popup.body)).map(b => b.id);
  assert.deepEqual(touched, mentions, 'a lexicon edit re-records exactly the clips whose spoken text it changes');
  const reg2 = JSON.parse(JSON.stringify(reg)); reg2.voices[fixture().family.narrator].kokoro = 'bf_lily';
  assert.ok(statusOf(s.slug, clipsOf(fixture(), reg2, lex), lock).some(x => x.why.includes('voice')), 'swapping a voice makes its clips stale');
});

test('syllable floor: ported estimate and the truncation guard', () => {
  assert.equal(syllables('The Core wakes.'), 3);
  assert.ok(minSeconds('Here is a draft. Please read it before you send it.') > 1.2);
  assert.equal(minSeconds('Hi.'), 0.8, 'the absolute floor');
});

test('lock text: stable key order, word triples on one line, hash names', () => {
  const lock = { v: 1, slug: 'x', storySha: 'a', lexiconSha: 'b', engine: { name: 'kokoro' }, clips: { c: { words: [['Mika', 70, 380], ['opens', 380, 900]], loudness: { I: -16, TP: -2 } } } } as unknown as Lock;
  const t = stringifyLock(lock);
  assert.ok(t.includes('["Mika", 70, 380]'));
  assert.ok(t.includes('"loudness": { "I": -16, "TP": -2 }'));
  assert.deepEqual(JSON.parse(t), lock);
  assert.match('ftue-hello.say.0123456789.m4a', CLIP_FILE_RE);
  assert.equal(hash10(new Uint8Array([1, 2, 3])), sha256(new Uint8Array([1, 2, 3])).slice(0, 10));
});

// ---- encode and QA, on synthetic speech-like audio (no Kokoro needed) ----------------------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-voiceover-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

/** A 24 kHz mono float WAV that behaves like speech for the gates: a voiced tone with syllable-rate amplitude modulation. */
function speechLike(file: string, seconds: number, amp = 0.3, f = 140) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `aevalsrc=${amp}*sin(2*PI*${f}*t)*(0.55+0.45*sin(2*PI*3.5*t))+${amp * 0.4}*sin(2*PI*${f * 2.7}*t)*(0.5+0.5*sin(2*PI*3.5*t)):s=24000:d=${seconds}`, '-c:a', 'pcm_f32le', file]);
  assert.equal(r.status, 0, String(r.stderr));
}

test('encode: -16 LUFS, decoded true peak under -1 dBTP, AAC-LC mono 24 kHz about 32 kbps, no metadata, byte-reproducible', { skip: !ffmpeg }, () => {
  for (const [amp, label] of [[0.05, 'quiet'], [0.3, 'normal'], [0.95, 'hot']] as const) {
    const wav = path.join(tmp, `${label}.wav`);
    speechLike(wav, 4, amp);
    const a = path.join(tmp, `${label}-a.m4a`), b = path.join(tmp, `${label}-b.m4a`);
    const enc = normaliseAndEncode(wav, a);
    normaliseAndEncode(wav, b);
    assert.equal(sha256(fs.readFileSync(a)), sha256(fs.readFileSync(b)), `${label}: same samples, same bytes`);
    assert.ok(Math.abs(enc.loudness.I - TARGET_LUFS) <= GATE.loudnessLU, `${label}: decoded ${enc.loudness.I} LUFS`);
    assert.ok(enc.loudness.TP <= GATE.truePeakDb, `${label}: decoded true peak ${enc.loudness.TP}`);
    const p = probe(a);
    assert.equal(p.codec, 'aac'); assert.equal(p.profile, 'LC'); assert.equal(p.channels, 1); assert.equal(p.sampleRate, 24000);
    assert.ok(p.bitRate > 28_000 && p.bitRate < 40_000, `${label}: ${p.bitRate} bps`);
    assert.deepEqual(p.tags, [], 'no metadata tags');
    assert.ok(Math.abs(p.duration - 4) < 0.05, `duration ${p.duration}`);
    assert.deepEqual(gate('The Core wakes and opens its own network.', enc, { clippedBeforeEncode: 0, samplesBeforeEncode: 96000 }), [], `${label} passes its gates`);
  }
});

test('gates: truncation, silence, clipping, peak and loudness each fail on their own', { skip: !ffmpeg }, () => {
  const wav = path.join(tmp, 'g.wav');
  speechLike(wav, 4);
  const enc = normaliseAndEncode(wav, path.join(tmp, 'g.m4a'));
  const text = 'The Core wakes and opens its own Wi-Fi network.';
  const run = (patch: object, o = { clippedBeforeEncode: 0, samplesBeforeEncode: 96000 }) => gate(text, { ...enc, ...patch, loudness: { ...enc.loudness, ...(patch as { loudness?: object }).loudness }, decoded: { ...enc.decoded, ...((patch as { decoded?: object }).decoded) } }, o);
  assert.deepEqual(run({}), []);
  assert.match(run({ decoded: { durationMs: 700 } }).join(), /syllable floor/);
  assert.match(run({ decoded: { rmsDb: -70 } }).join(), /mostly silent/);
  assert.match(run({ decoded: { speechFraction: 0.05 } }).join(), /mostly silent/);
  assert.match(run({}, { clippedBeforeEncode: 3, samplesBeforeEncode: 96000 }).join(), /clipped/);
  assert.match(run({ decoded: { clipped: 2 } }).join(), /clipped/);
  assert.match(run({ loudness: { TP: -0.1 } }).join(), /true peak -0\.10 dBTP/, 'the prototype overshot to -0.1 dBTP after AAC');
  assert.match(run({ loudness: { I: -14.9 } }).join(), /LU from -16/);
  assert.deepEqual(run({ loudness: { I: -16.6 } }), [], '0.6 LU is inside the 0.7 LU gate');
});

test('decode: measures what a listener receives', { skip: !ffmpeg }, () => {
  const wav = path.join(tmp, 'd.wav');
  speechLike(wav, 3, 0.3);
  const d = decodedStats(wav);
  assert.equal(d.durationMs, 3000);
  assert.ok(d.peak > 0.2 && d.peak < 0.9 && d.clipped === 0);
  assert.ok(Math.abs(measure(wav).I) < 40);
});

// ---- finish -> lock -> status -> ship, end to end in a temporary families folder ----------------------------------------------------------------------
test('record, lock and ship: a lock built from real encodes is current; editing the story makes it stale; ship reports it', { skip: !ffmpeg }, async () => {
  const base = fixture();
  base.slug = 'test-family';
  base.beats = [base.beats[0], base.beats[5]];          // ftue-delivery, and ftue-hello (which has an agent line)
  const dir = path.join(tmp, 'families');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'test-family.json'), JSON.stringify(base));
  const old = process.env.CI_STORY_FAMILIES_DIR;
  process.env.CI_STORY_FAMILIES_DIR = dir;
  try {
    const exp = clipsOf(loadStory('test-family'), reg, lex);
    assert.deepEqual(exp.map(e => e.id), ['ftue-delivery', 'ftue-hello', 'ftue-hello.say', 'closing']);
    const work = path.join(tmp, 'enc'); fs.mkdirSync(work, { recursive: true });
    const clips: Lock['clips'] = {};
    exp.forEach((e, n) => {
      const wav = path.join(tmp, `c${n}.wav`);
      const secs = Math.ceil(minSeconds(e.text) * 1.6) + 1;      // comfortably above the truncation floor
      speechLike(wav, secs);
      const ws = e.text.split(/\s+/);
      const span = (secs - 0.4) * 1000;
      const words = ws.map((w, i) => [w, 80 + (i * span) / ws.length, 80 + ((i + 1) * span) / ws.length] as [string, number, number]);
      const synth: Synth = { wav, samples: secs * 24000, trimmedLeadMs: 120, peak: 0.5, clippedSamples: 0, words, untimed: 0, phonemes: '' };
      const r = finish(e.id, e.text, synth, work, n);
      assert.ok(r.ok, `${e.id}: ${r.why.join('; ')}`);
      const entry = lockClip(e, r);
      fs.mkdirSync(audioDir('test-family'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'test-family', entry.file), r.bytes);
      clips[e.id] = entry;
      assert.match(entry.file, new RegExp(`^audio/${e.id.replace('.', '\\.')}\\.[0-9a-f]{10}\\.m4a$`));
      assert.equal(entry.trimmedLeadMs, 120);
      assert.equal(entry.words.length, ws.length);
    });
    const lock: Lock = { v: 1, slug: 'test-family', storySha: storyShaOf(exp), lexiconSha: lexiconSha(lex), engine: { name: 'kokoro', encoder: 'test', normalise: 'test' }, clips };
    fs.writeFileSync(lockPath('test-family'), stringifyLock(lock));
    assert.deepEqual(statusOf('test-family', exp, readLock('test-family')).filter(x => !x.ok), [], 'a fresh lock is current');

    const run = async () => {
      const added: string[] = [], registered: string[] = [], problems: string[] = [];
      await shipAudio({ addHashed: (src: string, dstDir: string) => { assert.ok(fs.statSync(src).size > 1000); const u = `${dstDir}/${path.basename(src)}`; added.push(u); return u; }, register: (s: string, k: `audio:${string}`, u: string) => { registered.push(`${s} ${k} ${u}`); }, problem: (m: string) => problems.push(m), stories: [{ slug: 'test-family' }] });
      return { added, registered, problems };
    };
    const ok = await run();
    assert.deepEqual(ok.problems, []);
    assert.equal(ok.added.length, 4);
    assert.ok(ok.registered.includes(`test-family audio:ftue-hello.say ${ok.added[2]}`));
    assert.ok(ok.added.every(a => /^audio\/test-family\/[a-z0-9.-]+\.[0-9a-f]{10}\.m4a$/.test(a)), 'relative URL, hashed name');

    // edit the story: that clip is stale, ship says so and names the command
    base.beats[0].popup.body = base.beats[0].popup.body + ' It is heavy.';
    fs.writeFileSync(path.join(dir, 'test-family.json'), JSON.stringify(base));
    const stale = await run();
    assert.match(stale.problems.join('\n'), /ftue-delivery is stale \(text, spoken\); run: pnpm run story:voice -- test-family --stale/);
    assert.ok(!stale.problems.join().includes('ftue-hello'), 'only the edited clip is stale');

    // tamper with a clip: the name no longer matches the bytes
    const f = path.join(dir, 'test-family', clips['closing'].file);
    fs.appendFileSync(f, Buffer.from([0]));
    assert.match((await run()).problems.join('\n'), /closing is stale \(file\)/);
  } finally {
    if (old === undefined) delete process.env.CI_STORY_FAMILIES_DIR; else process.env.CI_STORY_FAMILIES_DIR = old;
  }
});

// ---- every committed lock ----------------------------------------------------------------------------------------------------------------------------
test('committed locks: story present, clip set equal, files hashed and intact, timings and budget sane', () => {
  const slugs = lockSlugs();
  const stories = new Set(listSlugs());
  for (const slug of slugs) {
    const lock = readLock(slug)!;
    assert.equal(lock.v, 1); assert.equal(lock.slug, slug);
    assert.ok(stories.has(slug), `${slug}.voice.json has no story ${slug}.json beside it`);
    if (lock.engine.name === 'say') assert.ok(lock.engine.labelled, 'macOS say is a last resort and must be labelled in engine.labelled');
    else assert.equal(lock.engine.name, 'kokoro');
    const exp = clipsOf(loadStory(slug), reg, lex);
    assert.deepEqual(Object.keys(lock.clips), exp.map(e => e.id), `${slug}: the lock's clips must be exactly the story's clips, in order (run: pnpm run story:voice -- ${slug} --stale)`);
    assert.deepEqual(statusOf(slug, exp, lock).filter(x => !x.ok).map(x => `${x.id}: ${x.why.join('+')}`), [], `${slug}: stale clips (run: pnpm run story:voice -- ${slug} --stale)`);
    assert.equal(lock.storySha, storyShaOf(exp), `${slug}: storySha`);
    let total = 0;
    for (const e of exp) {
      const c = lock.clips[e.id];
      const f = path.join(familiesDir(), slug, c.file);
      const data = fs.readFileSync(f);
      assert.equal(sha256(data), c.sha256, `${c.file}: sha256 does not match the bytes`);
      assert.equal(data.length, c.bytes);
      const m = CLIP_FILE_RE.exec(path.basename(c.file));
      assert.ok(m, `${c.file}: not <clipId>.<hash10>.m4a`);
      assert.equal(m!.groups!.hash, c.sha256.slice(0, 10), `${c.file}: the hash in the name is not the hash of the bytes`);
      assert.equal(m!.groups!.id, e.id);
      assert.equal(path.dirname(c.file), 'audio');
      assert.ok(c.durationMs >= minSeconds(c.text) * 1000, `${c.file}: shorter than the syllable floor`);
      assert.ok(c.words.length > 0 && c.words.every((w, i) => w[2] >= w[1] && (i === 0 || w[1] >= c.words[i - 1][1])), `${c.file}: word timings`);
      assert.ok(c.words.at(-1)![2] <= c.durationMs + 60);
      assert.ok(Math.abs(c.loudness.I - TARGET_LUFS) <= GATE.loudnessLU && c.loudness.TP <= GATE.truePeakDb, `${c.file}: loudness ${JSON.stringify(c.loudness)}`);
      total += c.bytes;
      if (ffmpeg) {
        const p = probe(f);
        assert.deepEqual([p.codec, p.profile, p.channels, p.sampleRate], ['aac', 'LC', 1, 24000], c.file);
        assert.ok(Math.abs(p.duration * 1000 - c.durationMs) < 30, `${c.file}: probe ${p.duration}s vs lock ${c.durationMs} ms`);
        assert.deepEqual(p.tags, [], `${c.file}: carries metadata`);
        if (process.env.VOICE_TEST_DEEP) {
          const l = measure(f);
          assert.ok(Math.abs(l.I - c.loudness.I) < 0.1 && Math.abs(l.TP - c.loudness.TP) < 0.1, `${c.file}: re-measured ${JSON.stringify(l)}`);
        }
      }
    }
    assert.ok(total <= budgetBytes(reg), `${slug}: ${total} bytes of audio is over the ${budgetBytes(reg)} byte family budget`);
    // no stray files: everything in the audio folder is a clip of this lock
    const have = fs.existsSync(audioDir(slug)) ? fs.readdirSync(audioDir(slug)).sort() : [];
    assert.deepEqual(have, Object.values(lock.clips).map(c => path.basename(c.file)).sort(), `${slug}: audio folder and lock disagree`);
  }
  // and every lock file name resolves
  for (const slug of slugs) assert.ok(fs.existsSync(lockPath(slug)));
});

