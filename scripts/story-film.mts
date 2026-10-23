#!/usr/bin/env -S node --experimental-strip-types
// story:film. The one command for a family's film and for its plates.
//
//   pnpm run story:film -- <slug> ...            the overlay film, exactly as ever (scripts/render-family-film.mts)
//   pnpm run story:film -- <slug> --plates ...   the overlay-free plates the CI-Common video-kit composes (scripts/film/plates/cli.mts), and the home-tour plates of a home with no family
//
// This file is only the door. The film script is run unchanged and unread by the plates, and the plates' code lives where the film's pin (scripts/film/lib.mts toolSha) does not look, so
// drawing plates never makes a film on record stale, and the film's frames are the same bytes with or without them. reference/story/film.md ("Plates and the home-tour wrap").
const argv = process.argv.slice(2);
if (argv.includes('--plates')) {
  const { main } = await import('./film/plates/cli.mts');
  process.exit(await main(argv.filter(a => a !== '--plates')));
} else {
  await import('./render-family-film.mts');       // the film script runs at load and exits by itself
}
