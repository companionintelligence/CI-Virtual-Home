# Voice-over: how it is made and how to change it

The families are narrated by synthetic voices generated **locally** with Kokoro-82M. There is no cloud text-to-speech service
and no API key. The tool is `scripts/build-voiceover.mts` (`pnpm run story:voice`); it reads a family's story and writes a lock
file and a set of content-hashed audio clips beside it.

## What gets recorded

For `content/families/<slug>.json`:

| Clip id | Text | Voice |
|---|---|---|
| `<beatId>` | `popup.body` (this is also the caption) | the family narrator, `family.narrator` |
| `<beatId>.say` | `say.text` | that companion's `voice` (the member named in `say.speaker`) |
| `closing` | `closing.body` + " UnCloud your life." | the family narrator |

Children are never voiced: a `say` line must belong to a member who has a companion, and the schema only gives companions to
people aged 13 and over.

Outputs, all committed:

```
content/families/<slug>.voice.json                          the lock (VoiceLock in assets/story/types.ts)
content/families/<slug>/audio/<clipId>.<hash10>.m4a         hash10 = first 10 hex of sha256 of the file bytes
```

The lock holds, per clip: `text`, `textSha`, `voice`, `kokoro` (engine voice), `speed`, `file`, `sha256`, `bytes`, `durationMs`,
`trimmedLeadMs`, `words` (`[word, startMs, endMs]`), `loudness` (`I`, `TP` of the decoded file) and `spokenSha` (see below). The
top level has `storySha`, `lexiconSha` and the `engine` block (versions, model revision, weights hash, ffmpeg).

`words` are in the timeline of the file as shipped: Kokoro's per-token times minus `trimmedLeadMs`, clamped to the file length.
`trimmedLeadMs` is how many milliseconds were cut from the start of the raw synthesis (negative if silence was added), so a
consumer that wants the raw time adds it back. Every file starts with 80 ms of silence and ends with at most 150 ms.

## Commands

```bash
pnpm run story:voice -- vance-takahashi            # record every clip of one family
pnpm run story:voice -- --all                      # every family that has a story file
pnpm run story:voice -- <slug> --stale             # only clips whose text, spoken form, voice or speed changed
pnpm run story:voice -- <slug> --only <clipId>     # one clip (with --stale: only if it is stale)
pnpm run story:voice -- <slug> --dry-run           # what would be recorded; touches nothing
pnpm run story:voice -- --sheet [--out DIR]        # a listening sheet of the 8 voices, written outside the repo
pnpm run test:voiceover                             # checks every committed lock (also part of check:quick)
```

There is no `--force`. A clip is re-recorded because something it depends on changed, never on demand. A plain run (no `--stale`)
re-records the whole family and tells you whether each clip came out **identical to the lock**; it should always say so, because
the same text, voice, speed, seed, thread count and toolchain give the same bytes. If it says `BYTES CHANGED` for a clip whose
text did not change, the toolchain moved: read the `engine` block of the lock against the new run.

**What makes a clip stale** (`--stale` records exactly these): it is not in the lock, or its `textSha`, `voice`, engine voice or
`speed` differs, or its `spokenSha` differs (the lexicon changed the way this clip is spoken), or its file is missing or does not
match `sha256`. Editing a title, a chip or a note does not make anything stale, because none of them is spoken. Clips that are in the
lock but no longer in the story are removed (their file too) on the next real run.

If the Kokoro environment is missing the tool prints how to install it (CI-Common's `packages/video-kit/scripts/kokoro-setup.sh`)
and stops with exit code 3. It downloads nothing itself; installing needs the owner's approval.

## Adding a lexicon entry

`content/story/lexicon.json`:

```json
{ "word": "Odoo", "ph": "ˈuːduː", "say": "oo-doo", "note": "Default read is oh-doo." }
```

1. Find out what the default does: run `pnpm run story:voice -- --sheet` and listen to the names line, or look at the phonemes
   with the venv (`~/.cache/ci-video-kit/kokoro/venv/bin/python`, `KPipeline(lang_code='b', model=False).g2p("Odoo")`).
2. Write `ph` in misaki's **British** phoneme alphabet (every voice here is `bf_` or `bm_`): `A` eɪ, `I` aɪ, `Q` əʊ, `W` aʊ, `Y` ɔɪ,
   `ˈ` primary stress (exactly one), `ˌ` secondary, `ː` long vowel; the rest is IPA for consonants and vowels (`test-voiceover.mts`
   checks every symbol against Kokoro's vocabulary).
3. Matching is whole word, case-insensitive. The word keeps its written form: the engine receives `[Odoo](/ˈuːduː/)`, so the token,
   its timing and its place in the caption are unchanged. `Odoo's` works; `Odoos` and `Odoo-like` are left alone.
4. Run `pnpm run story:voice -- --all --stale --dry-run`. Only the clips that mention the name show up as stale (`spoken`). Record them.

Add a name only when the default is wrong or unstable. A family file is validated for the apps it may name; the lexicon is where
how to say them lives.

## Swapping a voice

`content/story/voices.json` maps the eight registry keys (a contract; stories use keys, never engine names) to Kokoro voices and
speeds. To change what `v-warm-f` sounds like, edit its `kokoro` (or `speed`) and run `pnpm run story:voice -- --all --stale`: the
lock stores the engine voice and speed per clip, so exactly the clips of that key are stale. American voices (`af_heart` and
friends) need the owner to approve a download of small voice files first, and `lang_code` in `scripts/voice/synth.py`/`engine.mts`
is British (`b`) today; American voices need a second pipeline (`a`), which is a code change, not only a registry edit.

## What the gates check

Every clip, on the decoded file (the prototype measured fine before AAC and overshot to -0.1 dBTP after):

- duration above the syllable floor (at most seven syllables a second, at least 0.8 s: a cut-off file is shorter than a fast one)
- not silent (rms above -40 dBFS and at least a third of the 20 ms frames carry speech)
- no clipped samples, before encoding or after decoding
- true peak at most -1.0 dBTP and integrated loudness within 0.7 LU of -16 LUFS
- word timings spell the text, are in order and sit inside the file
- per family: at most 1,150,000 bytes of audio (`encoding.budgetBytes`; it was 700,000 until assembly, when the first full set of 30 tours came out at about 600 spoken words and 230 to 270 s each; clips load per beat, only after the viewer chooses sound)

A failing clip keeps its old lock entry (the test then reports it stale) and the command exits 1. Normalisation is a light
compressor (3:1) and a limiter at -3 dBFS before AAC; if AAC overshoots, the tool lowers the ceiling and re-encodes (up to four
passes). A deep voice with sparse peaks (`v-deep-m`) needs the most gain and the most limiting.

## What to listen for

Nothing in this pipeline can hear. The gates catch silence, clipping, truncation and loudness; whether a voice sounds good is a
human judgement. Use `--sheet`, open `index.html` and listen on a phone speaker as well as headphones:

- clear at normal volume; no buzz, hiss, pumping or swallowed consonants (the limiter works hardest on `v-deep-m`)
- pace unhurried (about 150 words a minute); sentence ends fall rather than rise
- the product names: Odoo, Koodo, Spliit, SearXNG, Keila, Affine, n8n, Immich, Nextcloud, Paperless-ngx, OpenClaw, Hermes
- "Wi-Fi", "UnCloud", "Core's", "Companion Memory (beta)"
- the agent voices sound different from the narrator and from each other
- four of the eight voices are graded D (`v-bright-f`, `v-young-f`, `v-light-m`) or D+ (`v-deep-m`) by the model card, and Kokoro has no
  emotion control: if one sounds wrong for a scene, change the key in the story, or swap the voice here

## Determinism

`synth.py` seeds torch immediately before each clip, pins the thread count (4), runs on CPU and blocks the network. `ffmpeg` runs with
`-fflags +bitexact`, so no encoder tag or creation time is written. Same inputs, same bytes. The lock records the toolchain so a change
of Kokoro, torch, ffmpeg or the weights is visible in a diff.

Fallback: macOS `say` is not wired in. If it is ever used, the lock must carry `engine.labelled`, and `test-voiceover.mts` fails
a `say` lock that does not.
