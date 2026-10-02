One file per realism package, named `<key>.mts` (ao, water, sky, grass, assets, frame). `pnpm run test:live` runs every
`*.mts` here that exports `default async function check(env)` and prints its results. The environment (`env`) is built in
scripts/test-live-effects.mts: a served tree, a launched Chromium with the real-GPU flags, `open(query)` to load a
player page and `hash(page)` to read its canvas. A check returns an array of `{ name, ok, detail }`.
