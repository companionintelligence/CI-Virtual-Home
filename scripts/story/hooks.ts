// The seams of the story site (STORY-BIBLE section 14). Types only: every other package imports these and never edits
// scripts/build-portal.mts or scripts/test-portal.mts.
//
//   build   scripts/story/site.mts loads every scripts/story/ship/*.mts (alphabetical) and calls its default export
//           with a ShipCtx, after the family pages, the sanitised specs and the manifest skeleton exist and before
//           the manifest is written, so a ship file adds files and registers their URLs.
//   test    scripts/test-portal.mts loads every scripts/story/portal-tests/*.mts (alphabetical) and calls its default
//           export with a TestCtx, after the landing, family-page and leak checks and inside the one browser process.
//
// A ship file is `export default async function (ctx: ShipCtx): Promise<void> { ... }`, a test file
// `export default async function (ctx: TestCtx): Promise<void> { ... }`.
//
// URLs: every URL these hooks take or give is relative to the SITE ROOT with no leading `./` or `/`
// (`audio/okafor-reyes/intro.1a2b3c4d5e.m4a`). A page resolves it against its own location; a page at the root
// (room-creator.html) can use it as `./<url>`. Never write an absolute or root-relative URL: the site is tested
// under a sub-path.
import type { Story, CastingFamily, FamiliesIndex, SiteManifest, ClipId } from '../../assets/story/types.ts';

/** What the manifest can be told about a family (`SiteManifest.byFamily[slug]`). */
export type ManifestKey =
  | 'story'                       // the runtime story: story/<slug>.<hash10>.json
  | 'poster'                      // the tour's start-card and family-page poster
  | 'og'                          // the link-preview image
  | `audio:${ClipId}`             // one clip: audio/<slug>/<clip>.<hash10>.m4a
  | 'film.src916' | 'film.src169' | 'film.vtt' | 'film.poster';

export interface ShipCtx {
  /** the repo root (absolute) */
  ROOT: string;
  /** the output folder (absolute): dist/ */
  OUT: string;
  /** the site's address with a trailing slash: --site-url, else $SITE_URL, else https://homes.ci.computer/ */
  site: string;
  /** true when this is a development or preview build with fewer than all thirty families (`--allow-partial`) */
  partial: boolean;
  /** the authored families that are being built, in the landing's order */
  stories: Story[];
  /** content/story/casting.json by slug (the house id is INTERNAL: never put it in a name, a URL or a text) */
  casting: Record<string, CastingFamily>;
  /**
   * Copy a file into OUT/<dstDir>/ as `<name>.<hash10><ext>` (hash10 = first 10 hex of the sha256 of the bytes; a hash
   * already in the name is replaced) and return its site-root-relative URL. The same bytes twice give the same URL.
   */
  addHashed(srcAbs: string, dstDir: string): string;
  /** Write bytes or text to OUT/<dstRel> as they are (an un-hashed name; use sparingly) and return `dstRel`. */
  addFile(dstRel: string, bytes: Uint8Array | string): string;
  /** Record a hashed URL in `story/manifest.json` under byFamily[slug]. */
  register(slug: string, key: ManifestKey, url: string): void;
  /** Record a family's film (the numbers the page shows next to the player). */
  registerFilm(slug: string, film: { durationMs: number; bytes: number }): void;
  /** Report a failure; the build prints all of them and exits 1. */
  problem(msg: string): void;
}
export type ShipFn = (ctx: ShipCtx) => Promise<void>;

export interface TestOpen {
  page: any;
  /** console errors, page errors and 4xx/5xx responses, as strings */
  errors: string[];
  /** every request that left the site (nothing is allowed to) */
  thirdParty: string[];
  /** every request URL */
  requests: string[];
  close: () => Promise<void>;
}
export interface TestCtx {
  ROOT: string;
  /** the folder under test (dist/) */
  OUT: string;
  /** the served origin plus the sub-path, with a trailing slash: http://127.0.0.1:PORT/ci-virtual-home/ */
  base: string;
  /** a URL under base for a site-root-relative path */
  url: (p?: string) => string;
  /** Playwright's Chromium, launched with the portal's flags; one process, shared */
  browser: any;
  /** the Playwright module (for another engine, e.g. webkit) */
  pw: any;
  /** dist/story/families.<hash>.json, parsed */
  families: FamiliesIndex;
  /** dist/story/manifest.json, parsed */
  manifest: SiteManifest;
  /** open a page the way every check does: viewport, error and third-party tracking, Google Fonts stubbed */
  open: (viewport: { width: number; height: number }, mobile?: boolean, extra?: Record<string, unknown>) => Promise<TestOpen>;
  /** record a pass or a failure (counted in the run's total) */
  check: (ok: unknown, msg: string) => void;
  /** save a screenshot under test/portal/ (gitignored) */
  shot: (page: any, name: string) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
}
export type TestFn = (ctx: TestCtx) => Promise<void>;

/** The globs, in one place so the build and the test agree. Relative to the repo root. */
export const SHIP_GLOB = 'scripts/story/ship';
export const TEST_GLOB = 'scripts/story/portal-tests';
