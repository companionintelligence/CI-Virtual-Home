# Site test families

Stories the site tests build pages and tours from (`scripts/test-story-pages.mts`, the portal tests). They are fixtures: nothing here ships.

## vance-takahashi still says "beta" in two spoken lines

`vance-takahashi.json` has two beats whose spoken body says "Companion Memory (beta)" (`ftue-pick`, `office-reply`). The voice lock beside it
(`vance-takahashi.voice.json`) and the m4a clips under `vance-takahashi/audio/` were recorded from exactly that text, and the lock holds the text,
its hash and the word timings of the recording. The owner took the beta requirement out of the rules on 2026-10-22, and every other word of the
fixture follows it (the plug-in note and the phone row are clean, and `test/fixtures/stories/exemplar.json` is clean).

These two lines are left as recorded on purpose. A clip is a recording of its text, so changing the text without recording it again would make the
lock say something the audio does not, and the voice is made locally with Kokoro-82M, a model download the owner has not approved on this machine.
Nothing reads the words for what they claim: the fixture exists to give the page and the tour a voiced family to lay out.

To finish it, on a machine with Kokoro: take "(beta)" out of the two bodies in `vance-takahashi.json`, then run
`pnpm run story:voice -- vance-takahashi --stale` against this folder (`CI_STORY_FAMILIES_DIR`) and commit the new lock and clips. Until then the
`release-status-beta` rule of `story:copy` does not trip on this folder, because it reads the built site, which is made from `content/families`, and the
real families have no beta anywhere.
