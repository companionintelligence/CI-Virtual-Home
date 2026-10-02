// The tour's entry point. assets/viewer.ts imports this file lazily (only for ?family=<slug> without ?no=story), so the landing page and
// the families' pages never load a byte of it, and calls `prepare(api, house)` once per house it opens.
//
// prepare():
//   1. finds the family in story/manifest.json and fetches its runtime story (story/<slug>.<hash10>.json: the authored story, the clip
//      URLs, the word timings, the poses, the timeline and the camera track, joined by scripts/story/ship/player.mts);
//   2. loads the tour's stylesheet (its own <link>, named by a content hash inside that file, so the player's CSS is not touched);
//   3. registers the camera track as a shot called `story` on the house (api.house().shots, and the page's SplinePresets), BEFORE the
//      player lists the house's shots, so the player's own loop, scrubber and fly camera play it with no engine change;
//   4. when the player says it is ready, mounts the Director over it.
// Anything that fails on the way leaves the player exactly as it was (the Orbit, no tour) and says so in a toast: a story that 404s, a
// track that does not build. ?no=story is the kill switch (viewer.ts never imports this file then).
import { presetFromStory, type RuntimeStory } from './runtime.js';
import { Director, type Control } from './director.js';

type Shipped = RuntimeStory & { css?: string };
// The address as the page was opened. The player rewrites the address bar as soon as it has a shot (it keeps its own parameters and drops
// ours), so the beat a shared link asks for is read here, when this module is first evaluated, which is at boot.
const BOOT_QUERY = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
let current: { slug: string; director: Director } | null = null;
let opened = false;                                         // the first tour of this page view reads the boot address; a later one (next family) starts at its beginning
let manifestP: Promise<any> | null = null;

const siteUrl = (rel: string): string => new URL(rel, location.href).href;
function manifest(): Promise<any> {
  // (room-creator.html's head script reads the same file; the browser answers the second request from its cache after a revalidation)
  return (manifestP ||= fetch(siteUrl('./story/manifest.json')).then(r => (r.ok ? r.json() : null), () => null));
}
async function fetchStory(url: string): Promise<Shipped | null> {
  try { const r = await fetch(siteUrl(`./${url}`)); return r.ok ? await r.json() : null; } catch { return null; }
}
function loadCss(href: string): Promise<void> {
  return new Promise(res => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = siteUrl(`./${href}`); link.dataset.story = '1';
    const done = () => res();
    link.onload = done; link.onerror = done;
    document.head.append(link);
    setTimeout(done, 3000);          // a stylesheet that never answers does not hold the tour back
  });
}
function whenReady(root: HTMLElement): Promise<void> {
  const ok = () => root.dataset.state === 'ready';
  if (ok()) return Promise.resolve();
  return new Promise(res => { const mo = new MutationObserver(() => { if (ok()) { mo.disconnect(); res(); } }); mo.observe(root, { attributes: true, attributeFilter: ['data-state'] }); });
}

export function teardown(): void {
  if (current) { current.director.destroy(); current = null; }
  delete (window as any).__houseStory;
  delete document.documentElement.dataset.story;
  for (const l of Array.from(document.querySelectorAll('link[data-story]'))) l.remove();
}

export async function prepare(api: any, house: any): Promise<void> {
  const slug: string = house && house.id;
  if (current && current.slug === slug) return;              // the player opens the same house twice when a load fails once
  teardown();
  const stats = (window as any).__houseViewer, control: Control | undefined = stats && stats.control;
  const root = document.querySelector<HTMLElement>('.vh');
  if (!slug || !control || !root) return;
  try {
    const m = await manifest();
    const entry = m && m.byFamily && m.byFamily[slug];
    if (!entry || !entry.story) return;                      // a family with no recorded tour plays as the player always has
    const rs = await fetchStory(entry.story);
    if (!rs || !rs.track || !Array.isArray(rs.beats)) { control.toast('The narrated tour could not load. Here is the house tour instead.', 5000); return; }
    if (rs.css) await loadCss(rs.css);
    const preset = presetFromStory(api.THREE, rs.track, { name: 'Family tour', world: house.anchors && house.anchors.shotWorld });
    preset.fovFitted = true;                                 // the track widens its own lens for a narrow window; the player must not do it twice
    house.shots = house.shots || {};
    house.shots.story = preset;
    const dbg = typeof (window as any).__houseDebug === 'function' ? (window as any).__houseDebug() : null;
    if (dbg && dbg.presets) dbg.presets[`house:${house.id}:story`] = preset;
    document.documentElement.dataset.story = '1';
    const index = await Promise.resolve((window as any).__vhIndex).then((j: any) => (j && j.houses) || [], () => []);
    void whenReady(root).then(() => {
      if (current && current.slug === slug) return;
      const director = new Director({ api, stats, root, rs, control, slug, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, hasNext: index.length > 1, query: !opened && BOOT_QUERY.get('family') === slug ? BOOT_QUERY : new URLSearchParams(), audioBase: '' });
      current = { slug, director }; opened = true;
      (window as any).__houseStory = director.api();
    });
  } catch (err) {
    console.warn('story: the tour could not start', err);
    delete document.documentElement.dataset.story;
    try { control.toast('The narrated tour could not start. Here is the house tour instead.', 5000); } catch { /* */ }
  }
}
