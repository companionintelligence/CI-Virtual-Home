#!/usr/bin/env -S node --experimental-strip-types
// The story copy never names a home, a builder or an internal house id. This reads the words of every authored family
// (content/families/<slug>.json, or --families <dir>) and reports each place one appears.
//
//   node --experimental-strip-types scripts/story/check-leaks.mts [--families <dir>]      (portal:build runs it per family)
//
// What it looks for: the twelve builders and the `source` strings of content/houses/index.json; every spec `name`; every
// hand-picked display name of assets/home-names.ts; `SimsTree`, `Sims 4`, `The Sims`, `Virtual homes`, `Base Game`; and a house id
// that carries a creator's name (an id that is also an English word, "aurora", is only a leak in a URL, never in a sentence).
//
// What it does NOT do (the salvage's rule that no home, builder or id is ever public is not the homes portal's): the built site
// names every home and credits its builder, on the gallery, in the player and on a family's page, which links the home's own page.
// So a built page is not scanned here; the story's WORDS are. The scan skips what is not copy: the structural keys (house, slug,
// ids, anchors, camera, app ids) and the authoring `notes`, which never ship.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT as REPO, readJson, storyFiles } from './site-lib.mts';
import type { Story } from '../../assets/story/types.ts';

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Needles = { names: string[]; ids: string[]; phrases: RegExp[]; fragmentIds: string[] };
export function needles(root = REPO): Needles {
  const index = readJson(path.join(root, 'content', 'houses', 'index.json'));
  const houses: { id: string; name?: string; author?: string; source?: string }[] = index.houses;
  const homeNames = fs.readFileSync(path.join(root, 'assets', 'home-names.ts'), 'utf8');
  const picked = [...homeNames.matchAll(/^\s*'[a-z0-9-]+':\s*'([^']+)'/gm)].map(m => m[1]);
  const specNames = houses.map(h => h.name).filter(Boolean) as string[];
  const names = [...new Set([...houses.map(h => h.author).filter(Boolean) as string[], ...houses.map(h => h.source).filter(Boolean) as string[], ...specNames, ...picked])];
  const ids = houses.map(h => h.id);
  return {
    names, ids,
    // (an id that is also an English word is only a leak in a URL, a file name or a data value, never in a sentence)
    fragmentIds: ids.filter(i => /nora|olcia/.test(i)),
    phrases: [/SimsTree/i, /Sims 4/i, /The Sims/i, /Virtual homes/i, /Base Game/i],
  };
}

/** What one chunk of prose says that it must not. `where` names it. */
export function scanText(text: string, where: string, n: Needles): string[] {
  const out: string[] = [];
  const hit = (what: string): void => { out.push(`${where}: ${what}`); };
  for (const name of n.names) if (new RegExp(escRe(name), 'i').test(text)) hit(`names "${name}"`);
  for (const re of n.phrases) if (re.test(text)) hit(`says ${re}`);
  for (const id of n.fragmentIds) if (text.includes(id)) hit(`has the internal id "${id}"`);
  return out;
}

// the keys of a story that are structure, not copy (ids and addresses a visitor never reads), and the authoring notes
const NOT_COPY = new Set(['notes', 'anchor', 'camera', 'house', 'slug', 'id', 'schema', 'chapter', 'member', 'agent', 'approval', 'speaker', 'colour', 'voice', 'narrator', 'role', 'kind', 'room', 'category', 'segment', 'capability', 'app', 'with', 'runtime', 'archetype']);
/** Every string of the story a visitor can read (a page, a caption, a card), each with where it is. */
export function copyOf(story: Story): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const walk = (v: unknown, at: string): void => {
    if (typeof v === 'string') out.push({ where: at, text: v });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!NOT_COPY.has(k)) walk(x, at ? `${at}.${k}` : k);
  };
  walk(story, story.slug);
  return out;
}

/** The findings for one family: nothing a visitor reads in it names a home or a builder. */
export function storyCopyLeaks(story: Story, n: Needles): string[] {
  return copyOf(story).flatMap(c => scanText(c.text, c.where, n));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const fi = argv.indexOf('--families');
  const dir = path.resolve(REPO, fi >= 0 && argv[fi + 1] ? argv[fi + 1] : path.join('content', 'families'));
  const n = needles();
  const files = storyFiles(dir);
  const found = files.flatMap(f => storyCopyLeaks(readJson(path.join(dir, f)) as Story, n));
  if (found.length) { console.error(found.map(x => `  ✗ ${x}`).join('\n')); process.exit(1); }
  console.log(`leak scan: the words of ${files.length} famil${files.length === 1 ? 'y' : 'ies'} in ${path.relative(REPO, dir) || dir} name no home and no builder`);
}
