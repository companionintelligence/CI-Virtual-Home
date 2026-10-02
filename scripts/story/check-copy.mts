#!/usr/bin/env -S node --experimental-strip-types
// T3 (copy lint) and T4 (apps are real) over a built site, run by portal:test and usable alone:
//
//   node --experimental-strip-types scripts/story/check-copy.mts [dist] [--families <dir>]
//
// T3  Every word a visitor can read (the landing, the family pages, the credits, the card data, and the alt text, labels and
//     descriptions) goes through claims.json's banned-phrase rules of severity `error` (dashes, buzzwords, "log in",
//     "chatbot", "assistant", price and savings words, security absolutes, ...); headings are sentence case; and each kind of
//     page carries the exact disclosure strings it owes (STORY-BIBLE section 4). The page title and H1 of the landing are the
//     owner's words ("home servers") and are the one place that vocabulary rule does not apply.
// T4  Every app a family names is in the Companion Hub catalog snapshot and in the live store, and so is every app of the
//     landing's "Instead of / Run at home" table.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT as REPO, readJson, loadAll, storyFiles, disclosure } from './site-lib.mts';
import { walkFiles } from './check-leaks.mts';
import { LANDING_TITLE } from './pages.mts';
import { FICTIONAL_LINE, BETA_LINE } from '../../assets/story/types.ts';

const decode = (s: string): string => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

/** The readable strings of a page: its text, and the attributes a screen reader or a link preview reads. */
export function readable(html: string): { text: string; attrs: string[]; headings: string[] } {
  const attrs = [...html.matchAll(/\s(?:alt|aria-label|title|placeholder)="([^"]*)"/g)].map(m => decode(m[1]))
    .concat([...html.matchAll(/<meta (?:name|property)="(?:description|og:description|og:title|og:image:alt)" content="([^"]*)"/g)].map(m => decode(m[1])));
  const body = html.replace(/<head[\s\S]*?<\/head>/, '').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const headings = [...body.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/g)].map(m => decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
  const text = decode(body.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return { text, attrs, headings };
}

// Words a heading may capitalise beyond its first: product nouns, the sign-off, brand and place names.
const PRODUCT_WORDS = new Set(['Companion', 'Core', 'Hub', 'Memory', 'OS', 'OpenClaw', 'Hermes', 'Wi-Fi', 'WiFi', 'UnCloud', 'USB', 'Alternatives', 'Fictional', 'Real', 'Intelligence', 'I', 'Core.']);
export function headingProblems(headings: string[], proper: Set<string>): string[] {
  const out: string[] = [];
  for (const h of headings) {
    const words = h.replace(/Wi-Fi/g, 'WiFi').split(/[\s-]+/).slice(1).map(w => w.replace(/[.,;:!?'’“”"()]/g, '')).filter(Boolean);
    const caps = words.filter(w => /^[A-Z]/.test(w) && !PRODUCT_WORDS.has(w) && !proper.has(w) && !/^[A-Z0-9-]+$/.test(w));
    if (caps.length >= 1 && words.length > 1 && caps.length >= Math.ceil(words.length / 2)) out.push(`heading "${h}" is not sentence case`);
  }
  return out;
}

export type CopyArgs = { dir: string; root?: string; families?: string };
export function copyLint({ dir, root = REPO, families }: CopyArgs): string[] {
  const out: string[] = [];
  const claims = readJson(path.join(root, 'content', 'story', 'claims.json'));
  const rules = (claims.bannedPhrases as { id: string; pattern: string; flags?: string; severity: string }[]).filter(b => b.severity === 'error').map(b => ({ id: b.id, re: new RegExp(b.pattern, b.flags ?? 'i') }));
  const manifest = readJson(path.join(dir, 'story', 'manifest.json'));
  const list = readJson(path.join(dir, manifest.families));
  const proper = new Set<string>();
  for (const f of list.families) {
    for (const w of `${f.surname} ${f.address} ${f.members.map((m: any) => `${m.name} ${m.companion || ''}`).join(' ')} ${f.apps.map((a: any) => a.name).join(' ')}`.split(/[\s,-]+/)) if (w) proper.add(w.replace(/[.,]/g, ''));
  }
  const checkText = (where: string, text: string, exempt: string[] = []): void => {
    let t = text;
    for (const e of exempt) t = t.split(e).join(' ');
    for (const r of rules) { const m = r.re.exec(t); if (m) out.push(`${where}: "${m[0]}" breaks the copy rule ${r.id}`); }
    if (/\blog ?in\b/i.test(t)) out.push(`${where}: "log in" (say sign in)`);
  };

  // pages
  const pages = ['index.html', 'credits.html', ...walkFiles(dir, 'family').map(f => f)].filter(f => f.endsWith('.html'));
  const own = [LANDING_TITLE, 'Uncloud your life with Companion Core home servers'];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(dir, p), 'utf8');
    const r = readable(html);
    checkText(p, r.text, [...own, '©']);
    r.attrs.forEach(a => checkText(`${p} (attribute)`, a, own));
    out.push(...headingProblems(r.headings, proper).map(x => `${p}: ${x}`));
    const must = (s: string, why: string): void => { if (!r.text.includes(s)) out.push(`${p}: the ${why} line is missing: "${s}"`); };
    must(FICTIONAL_LINE, 'fictional-family');
    must(BETA_LINE, 'beta');
    if (p.startsWith('family/')) for (const id of ['scripted-scenes', 'stylised-art', 'synthetic-voice', 'names-owners']) must(disclosure(claims, id), id);
    if (p === 'index.html') for (const id of ['scripted-scenes', 'stylised-art', 'beta-short', 'names-owners', 'apps-availability']) must(disclosure(claims, id), id);
    if (!/<footer/.test(html)) out.push(`${p}: no footer`);
  }
  // data
  const strings: string[] = [];
  const collect = (v: unknown): void => { if (typeof v === 'string') strings.push(v); else if (Array.isArray(v)) v.forEach(collect); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
  collect(list.families.map((f: any) => [f.title, f.address, f.tagline, f.members.map((m: any) => m.companion), f.rooms]));
  strings.forEach(s => checkText('story/families.json', s));

  // T4: the apps
  const L = loadAll(root, families ? path.resolve(families) : path.join(root, 'content', 'families'));
  const byName = new Map(Object.values(L.catalog).map(a => [a.name.toLowerCase(), a]));
  const dirStories = families && storyFiles(path.resolve(families)).length ? L.stories : [];
  for (const s of dirStories) {
    for (const b of s.beats) for (const id of [b.app?.id, ...(b.with || [])].filter(Boolean) as string[]) {
      const a = L.catalog[id];
      if (!a) out.push(`${s.slug}/${b.id}: the app ${id} is not in the Companion Hub catalog`);
      else if ((a as any).inLiveStore === false) out.push(`${s.slug}/${b.id}: the app ${id} is not in the live store`);
      else if ((a as any).storySafe === 'avoid') out.push(`${s.slug}/${b.id}: the app ${id} is marked storySafe: avoid`);
    }
  }
  const index = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const table = index.match(/<table class="swap">[\s\S]*?<\/table>/)?.[0] || '';
  const runAtHome = [...table.matchAll(/<tr><td>[^<]*<\/td><td>([^<]*)<\/td><\/tr>/g)].flatMap(m => m[1].split(',').map(x => x.trim()));
  const aliases: Record<string, string> = { 'jitsi meet': 'jitsi', 'open webui': 'open-webui', 'openclaw': 'openclaw webcli' };
  for (const name of runAtHome) {
    const k = name.toLowerCase();
    const found = byName.has(k) || byName.has(aliases[k] || '') || Object.keys(L.catalog).some(id => id === k.replace(/\s+/g, '-') || id === k.replace(/\s+/g, ''));
    if (!found) out.push(`index.html: "${name}" in the Instead of table is not a catalog app`);
  }
  if (runAtHome.length < 8) out.push(`index.html: the Instead of table has ${runAtHome.length} apps`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const dir = path.resolve(argv.find(a => !a.startsWith('--')) || path.join(REPO, 'dist'));
  const fi = argv.indexOf('--families');
  const found = copyLint({ dir, families: fi >= 0 ? argv[fi + 1] : undefined });
  if (found.length) { console.error(found.map(x => `  ✗ ${x}`).join('\n')); process.exit(1); }
  console.log('copy lint: the pages, the card data and the apps are clean');
}
