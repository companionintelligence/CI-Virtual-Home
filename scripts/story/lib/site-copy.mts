// The copy lint of the whole built site (W5-compliance-03/08, W6-technical-05): every place a visitor reads a word, held to content/story/claims.json.
//
// What it reads, in a built site directory (dist/ or any --out):
//   - every HTML page: the front page (index.html), each home's page (homes/*.html), each family's page (family/*.html), 404.html, and the player's
//     HTML (room-creator.html: its <title>, meta tags, <noscript> and the strings of its head script, which is the loader and the failure card;
//     the editor's own body is not marketing copy and is left out);
//   - on each page its text, the attributes a screen reader or a link preview reads (alt, aria-label, title, placeholder, the description and
//     title meta tags, twitter and og), the <title> and the JSON-LD;
//   - every tour (story/<slug>.<hash>.json): the strings of userStrings() (lib/text.mts), the same set the story validator reads;
//   - the cards the front page reads (story/families.<hash>.json);
//   - the strings of the player's and the tour's source (assets/viewer.ts, assets/story/**/*.ts: the About panel, the end card, the failure card,
//     the start card, the film's cards) and of the pages' own scripts (portal/*.js), found by the TypeScript parser (lib/ts-strings.mts).
//
// What it applies: claims.json's banned phrases at their own severity (error fails; review fails unless the exact finding is in SITE_REVIEWED
// below; warn is printed), plus the extra ones in lib/extra-bans.mts; headings in sentence case; and the disclosures claims.json says each kind of
// page owes (DISCLOSURES below). A home's display name is the portal's own (CLAUDE.md "The homes portal names its homes"), so it is taken out
// before the two internal-id rules read a page, and nowhere else.
//
// A disclosure claims.json owes a surface that nothing prints yet is `pending`: it is listed and does not fail, until `strict` (--strict, or
// CI_COPY_STRICT=1) makes it an error. The surfaces that print a disclosure today hold it as an error already.
import fs from 'node:fs';
import path from 'node:path';
import { userStrings, plain } from './text.mts';
import { isV3Story } from './v3.mts';
import { EXTRA_BANS } from './extra-bans.mts';
import { sourceStrings } from './ts-strings.mts';
import { FICTIONAL_LINE, type Story } from '../../../assets/story/types.ts';
import { FICTIONAL_COMPANY_LINE } from './co/consts.mts';

export const decode = (s: string): string => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
export const walkFiles = (dir: string, rel = ''): string[] => (fs.existsSync(path.join(dir, rel)) ? fs.readdirSync(path.join(dir, rel)) : []).flatMap((n) => {
  const r = rel ? `${rel}/${n}` : n;
  return fs.statSync(path.join(dir, r)).isDirectory() ? walkFiles(dir, r) : [r];
});
const norm = (s: string): string => plain(s).replace(/\s+/g, ' ').trim();

/** The readable strings of a page: its text, and the attributes a screen reader or a link preview reads. */
export function readable(html: string): { text: string; attrs: string[]; headings: string[] } {
  const attrs = [...html.matchAll(/\s(?:alt|aria-label|title|placeholder)="([^"]*)"/g)].map((m) => decode(m[1]))
    .concat([...html.matchAll(/<meta (?:name|property)="(?:description|og:description|og:title|og:image:alt|twitter:title|twitter:description|twitter:image:alt)" content="([^"]*)"/g)].map((m) => decode(m[1])));
  const body = html.replace(/<head[\s\S]*?<\/head>/, '').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const headings = [...body.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
  const text = decode(body.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return { text, attrs, headings };
}

/** The <title> and the string values of the JSON-LD blocks (a name, a description, a headline): what a search result reads. */
export function headCopy(html: string): string[] {
  const out: string[] = [];
  const title = html.match(/<title>([^<]*)<\/title>/);
  if (title) out.push(decode(title[1]));
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const walk = (v: unknown, key = ''): void => {
        if (typeof v === 'string') { if (/\s/.test(v) && !/^https?:/.test(v) && !/^(?:@|url|image|sameAs|logo|thumbnailUrl)/.test(key)) out.push(v); }
        else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
      };
      walk(JSON.parse(m[1]));
    } catch { /* a block that is not JSON is the build's own check */ }
  }
  return out;
}

// Words a heading may capitalise beyond its first: product nouns, the sign-off, brand and place names.
const PRODUCT_WORDS = new Set(['Companion', 'Core', 'Hub', 'Memory', 'OS', 'OpenClaw', 'Hermes', 'Wi-Fi', 'WiFi', 'UnCloud', 'USB', 'Alternatives', 'Fictional', 'Real', 'Intelligence', 'I', 'Core.']);
export function headingProblems(headings: string[], proper: Set<string>): string[] {
  const out: string[] = [];
  for (const h of headings) {
    const words = h.replace(/Wi-Fi/g, 'WiFi').split(/[\s-]+/).slice(1).map((w) => w.replace(/[.,;:!?'’“”"()]/g, '')).filter(Boolean);
    const caps = words.filter((w) => /^[A-Z]/.test(w) && !PRODUCT_WORDS.has(w) && !proper.has(w) && !/^[A-Z0-9-]+$/.test(w));
    if (caps.length >= 1 && words.length > 1 && caps.length >= Math.ceil(words.length / 2)) out.push(`heading "${h}" is not sentence case`);
  }
  return out;
}

// ---- the disclosures each kind of page owes (claims.json `disclosures[].where`, read as: which surface)
export type Surface = 'gallery' | 'home' | 'family' | 'notfound' | 'player' | 'office' | 'company';
/**
 * `enforced`: printed today on every page of the surface, so a page without it is an error. `pending`: claims.json owes it and nothing prints it yet.
 * `when` limits a row to pages that need it: `logos` (the page shows an app or service logo), `voice` (the family's tour has narration),
 * `family` (a home page that links a family).
 * Moving a row from pending to enforced is the whole of "the page now prints it" (every row is enforced today).
 */
export interface Owed { id: string; surface: Surface; level: 'enforced' | 'pending'; when?: 'logos' | 'voice' | 'family' }
export const DISCLOSURES: Owed[] = [
  { id: 'fictional-family', surface: 'gallery', level: 'enforced' },
  { id: 'fictional-family', surface: 'home', level: 'enforced', when: 'family' },
  { id: 'fictional-family', surface: 'family', level: 'enforced' },
  { id: 'fictional-family', surface: 'player', level: 'enforced' },
  { id: 'scripted-scenes', surface: 'family', level: 'enforced' },
  { id: 'stylised-art', surface: 'family', level: 'enforced' },
  { id: 'names-owners', surface: 'family', level: 'enforced' },
  { id: 'synthetic-voice', surface: 'family', level: 'enforced', when: 'voice' },
  { id: 'not-frontier', surface: 'player', level: 'enforced' },
  { id: 'launch-not-offer', surface: 'gallery', level: 'enforced' },
  { id: 'launch-not-offer', surface: 'home', level: 'enforced' },
  { id: 'launch-not-offer', surface: 'family', level: 'enforced' },
  { id: 'launch-not-offer', surface: 'notfound', level: 'enforced' },
  { id: 'launch-not-offer', surface: 'player', level: 'enforced' },
  { id: 'names-logos-owners', surface: 'gallery', level: 'enforced' },
  { id: 'scripted-scenes', surface: 'gallery', level: 'enforced' },
  { id: 'stylised-art', surface: 'gallery', level: 'enforced' },
  { id: 'not-frontier', surface: 'gallery', level: 'enforced' },
  { id: 'third-party-apps', surface: 'gallery', level: 'enforced' },
  { id: 'names-logos-owners', surface: 'family', level: 'enforced', when: 'logos' },
  { id: 'names-logos-owners', surface: 'player', level: 'enforced' },
  { id: 'scripted-scenes', surface: 'player', level: 'enforced' },
  { id: 'attribution-agents', surface: 'player', level: 'enforced' },
  // the draft office (a build made with --offices: office.html and company/<slug>.html; scripts/office/fine-print.mts is the table the pages print from)
  { id: 'fictional-company', surface: 'office', level: 'enforced' },
  { id: 'launch-not-offer', surface: 'office', level: 'enforced' },
  { id: 'scripted-scenes', surface: 'office', level: 'enforced' },
  { id: 'names-logos-owners', surface: 'office', level: 'enforced' },
  { id: 'third-party-apps', surface: 'office', level: 'enforced' },
  { id: 'fictional-company', surface: 'company', level: 'enforced' },
  { id: 'launch-not-offer', surface: 'company', level: 'enforced' },
  { id: 'scripted-scenes', surface: 'company', level: 'enforced' },
  { id: 'names-logos-owners', surface: 'company', level: 'enforced' },
  { id: 'third-party-apps', surface: 'company', level: 'enforced' },
  { id: 'apps-availability', surface: 'company', level: 'enforced' },
];

/** Findings the owner has read and accepted, so a `review` rule does not fail them: the exact rule, a page (glob of the built path) and the matched text. */
export interface SiteReviewed { page: string; rule: string; text: string; by: string }
export const SITE_REVIEWED: SiteReviewed[] = [];

export interface Ban { id: string; severity: 'error' | 'review' | 'warn'; re: RegExp }
export interface SiteCopyOptions { dir: string; root: string; strict?: boolean; /** the sources of the player's strings, relative to root (default: viewer.ts and assets/story/**) */ sources?: string[] }
export interface SiteCopyResult { errors: string[]; warnings: string[]; pending: string[]; counts: { pages: number; tours: number; strings: number; sourceStrings: number } }

const globRe = (g: string): RegExp => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*')}$`);

export function siteCopy(opts: SiteCopyOptions): SiteCopyResult {
  const { dir, root } = opts;
  const readJson = (f: string): any => JSON.parse(fs.readFileSync(f, 'utf8'));
  const claims = readJson(path.join(root, 'content', 'story', 'claims.json'));
  const bans: Ban[] = [
    ...(claims.bannedPhrases as { id: string; pattern: string; flags?: string; severity: Ban['severity'] }[]).map((b) => ({ id: b.id, severity: b.severity, re: new RegExp(b.pattern, b.flags ?? 'i') })),
    ...EXTRA_BANS.filter((e) => !claims.bannedPhrases.some((b: { id: string }) => b.id === e.id)).map((e) => ({ id: e.id, severity: e.severity, re: new RegExp(e.pattern, e.flags) })),
  ];
  const disc = (id: string): string => { const d = (claims.disclosures as { id: string; text: string }[]).find((x) => x.id === id); if (!d) throw new Error(`claims.json has no disclosure ${id}`); return d.text; };
  const res: SiteCopyResult = { errors: [], warnings: [], pending: [], counts: { pages: 0, tours: 0, strings: 0, sourceStrings: 0 } };
  const reviewed = SITE_REVIEWED.map((r) => ({ ...r, re: globRe(r.page) }));

  // a home's display name is the portal's own words: the two internal-id rules do not read it
  const manifest = fs.existsSync(path.join(dir, 'story', 'manifest.json')) ? readJson(path.join(dir, 'story', 'manifest.json')) : null;
  const housesFile = path.join(dir, 'content', 'houses', 'index.json');
  const homeNames: string[] = fs.existsSync(housesFile) ? (readJson(housesFile).houses as { name?: string }[]).map((h) => h.name || '').filter(Boolean).sort((a, b) => b.length - a.length) : [];
  const NAME_RULES = new Set(['internal-ids', 'internal-ids-ordinary']);
  // claims.json: the ordinary words that are also house ids are "fine in prose; never in ... alt text that names the house": that rule reads alt text only
  const ORDINARY = 'internal-ids-ordinary';
  const withoutNames = (t: string): string => homeNames.reduce((s, n) => s.split(n).join(' '), t);

  const check = (where: string, text0: string, o: { exempt?: string[]; legacyChip?: boolean; only?: string[] } = {}): void => {
    let text = text0;
    for (const e of o.exempt ?? []) text = text.split(e).join(' ');
    text = norm(text);
    if (!text) return;
    res.counts.strings++;
    const noNames = withoutNames(text);
    for (const b of bans) {
      if (o.only ? !o.only.includes(b.id) : b.id === ORDINARY) continue;
      const m = b.re.exec(NAME_RULES.has(b.id) ? noNames : text);
      if (!m) continue;
      const msg = `${where}: "${m[0]}" breaks the copy rule ${b.id}`;
      const sev = o.legacyChip && b.severity !== 'warn' ? 'warn' : b.severity;
      if (sev === 'warn') res.warnings.push(o.legacyChip ? `${msg} (a pass 1 chip, a warning until the family is told in the v3 shape)` : msg);
      else if (sev === 'review') { if (!reviewed.some((r) => r.rule === b.id && r.re.test(where.replace(/ \(.*$/, '')) && text.includes(r.text))) res.errors.push(`${msg} (review rule: fix it, or list it in SITE_REVIEWED with the owner's initials)`); }
      else res.errors.push(msg);
    }
    if (/\blog ?in\b/i.test(text)) res.errors.push(`${where}: "log in" (say sign in)`);
  };

  // ---- the words headings may capitalise: names of families, members, apps and homes
  const proper = new Set<string>();
  const addProper = (s: string): void => { for (const w of s.split(/[\s,-]+/)) if (w) proper.add(w.replace(/[.,]/g, '')); };
  homeNames.forEach(addProper);
  const cards = manifest && fs.existsSync(path.join(dir, manifest.families)) ? readJson(path.join(dir, manifest.families)) : { families: [] };
  for (const f of cards.families) addProper(`${f.surname} ${f.address} ${f.members.map((m: any) => `${m.name} ${m.companion || ''}`).join(' ')} ${f.apps.map((a: any) => a.name).join(' ')}`);

  // ---- pages
  const surfaceOf = (p: string): Surface | null => p === 'index.html' ? 'gallery' : p === '404.html' ? 'notfound' : p === 'office.html' ? 'office' : p.startsWith('homes/') ? 'home' : p.startsWith('family/') ? 'family' : p.startsWith('company/') ? 'company' : null;
  const pageFiles = ['index.html', '404.html', 'office.html', ...walkFiles(dir, 'homes').filter((f) => f.endsWith('.html')), ...walkFiles(dir, 'family').filter((f) => f.endsWith('.html')), ...walkFiles(dir, 'company').filter((f) => f.endsWith('.html'))].filter((f) => fs.existsSync(path.join(dir, f)));
  const missing = new Map<string, string[]>();          // "<id> on <surface>" -> pages without it
  const owe = (s: Surface, p: string, text: string, ctx: { logos: boolean; voice: boolean; family: boolean }): void => {
    for (const o of DISCLOSURES.filter((d) => d.surface === s)) {
      if (o.when === 'logos' && !ctx.logos) continue;
      if (o.when === 'voice' && !ctx.voice) continue;
      if (o.when === 'family' && !ctx.family) continue;
      const need = norm(disc(o.id));
      if (text.includes(need)) continue;
      const key = `${o.level}|${o.id} on ${s}`;
      missing.set(key, [...(missing.get(key) ?? []), p]);
    }
  };
  for (const p of pageFiles) {
    res.counts.pages++;
    // (a family page's home-note names the home it lives in, which is the portal's own word for it; a home's own page's note is ordinary copy and is read)
    const raw = fs.readFileSync(path.join(dir, p), 'utf8');
    const html = surfaceOf(p) === 'family' ? raw.replace(/<p class="home-note">[\s\S]*?<\/p>/, ' ') : raw;
    const r = readable(html);
    const surface = surfaceOf(p)!;
    // (a company's name is a proper name, in its page's heading and on its card)
    if (surface === 'office' || surface === 'company') for (const m of raw.matchAll(/data-(?:name|company)="([^"]*)"/g)) addProper(decode(m[1]));
    check(p, r.text, { exempt: ['©'] });
    r.attrs.forEach((a) => check(`${p} (attribute)`, a, { exempt: ['©'] }));
    [...html.matchAll(/\salt="([^"]*)"/g)].forEach((m) => check(`${p} (alt)`, decode(m[1]), { only: [ORDINARY] }));
    headCopy(html).forEach((t) => check(`${p} (title or JSON-LD)`, t));
    // the sentence case of headings: the front page, the family pages and the 404 (a home's page names its home, which is a proper name)
    if (surface !== 'home') for (const x of headingProblems(r.headings, proper)) res.errors.push(`${p}: ${x}`);
    if (surface === 'family' && !/<footer/.test(html)) res.errors.push(`${p}: no footer`);
    const slug = path.basename(p, '.html');
    owe(surface, p, norm(r.text), {
      logos: /<img[^>]+src="[^"]*portal\/apps\//.test(html),
      voice: Object.keys(manifest?.byFamily?.[slug]?.audio || {}).length > 0,
      family: /class="family-block"|meet-family|family\//.test(html) && surface === 'home' && /Fictional family\. Real software\./.test(r.text),
    });
    if (surface === 'family' || surface === 'gallery') if (!r.text.includes(FICTIONAL_LINE)) res.errors.push(`${p}: the line is missing: "${FICTIONAL_LINE}"`);
    if (surface === 'office' || surface === 'company') if (!r.text.includes(FICTIONAL_COMPANY_LINE)) res.errors.push(`${p}: the line is missing: "${FICTIONAL_COMPANY_LINE}"`);
  }

  // ---- the player's HTML: title, meta, <noscript>, the head script's strings (the loader and the failure card)
  if (fs.existsSync(path.join(dir, 'room-creator.html'))) {
    res.counts.pages++;
    const html = fs.readFileSync(path.join(dir, 'room-creator.html'), 'utf8');
    const headHtml = (html.match(/<head[\s\S]*?<\/head>/) ?? [''])[0];
    headCopy(html).forEach((t) => check('room-creator.html (title)', t));
    readable(`<html>${headHtml}</html>`).attrs.forEach((a) => check('room-creator.html (meta)', a));
    for (const m of html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)) check('room-creator.html (noscript)', readable(`<body>${m[1]}</body>`).text);
    [...headHtml.matchAll(/<script(?![^>]*\ssrc=)(?![^>]*type="(?:importmap|application\/ld\+json)")[^>]*>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
      for (const s of sourceStrings(`room-creator.html#head-script-${i}.ts`, m[1])) check(`room-creator.html (head script, line ${s.line})`, s.text);
    });
  }

  // ---- the tours and the cards the front page reads
  if (manifest) {
    for (const [slug, f] of Object.entries<any>(manifest.byFamily)) {
      const file = path.join(dir, f.story);
      if (!fs.existsSync(file)) { res.errors.push(`${f.story}: the manifest names a tour that is not there`); continue; }
      const story = readJson(file) as Story;
      res.counts.tours++;
      const v3 = isV3Story(story);
      for (const [at, raw] of userStrings(story)) check(`story/${slug} ${at}`, raw, { legacyChip: !v3 && /\.chip\d+$/.test(at) && /^replaces /i.test(raw) });
      for (const m of Object.values<any>((story as any).media ?? {})) if (m?.logo?.alt) check(`story/${slug} (logo alt)`, m.logo.alt);
    }
  }
  const collect = (v: unknown, out: string[]): void => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => collect(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out)); };
  const cardStrings: string[] = [];
  collect(cards.families.map((f: any) => [f.title, f.address, f.tagline, f.members.map((m: any) => m.companion), f.rooms]), cardStrings);
  cardStrings.forEach((s) => check('story/families.json', s));

  // ---- the ad plan: the words of every cut (content/story/ads.json, the plan the silent videos are rendered from)
  const adsFile = path.join(root, 'content', 'story', 'ads.json');
  if (fs.existsSync(adsFile)) {
    const ads = readJson(adsFile);
    if (ads.defaults?.label) check('content/story/ads.json (label)', ads.defaults.label);
    for (const [slug, fam] of Object.entries<any>(ads.families ?? {})) {
      const tour = manifest?.byFamily?.[slug]?.story && fs.existsSync(path.join(dir, manifest.byFamily[slug].story)) ? (readJson(path.join(dir, manifest.byFamily[slug].story)) as Story) : null;
      const v3 = tour ? isV3Story(tour) : false;
      for (const cut of fam.cuts ?? []) {
        const at = `content/story/ads.json ${cut.id}`;
        if (cut.hook?.text) check(`${at} (hook)`, cut.hook.text);
        for (const c of cut.captions ?? []) check(`${at} (caption)`, c);
        for (const c of cut.chips ?? []) check(`${at} (chip)`, c, { legacyChip: !v3 && /^replaces /i.test(c) });
        if (cut.cta?.label) check(`${at} (cta)`, cut.cta.label);
      }
    }
  }

  // ---- the player's and the tour's source strings
  const sources = opts.sources ?? [
    'assets/viewer.ts',
    ...walkFiles(path.join(root, 'assets', 'story')).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts')).map((f) => `assets/story/${f}`),
    ...walkFiles(path.join(root, 'portal')).filter((f) => /^[^/]+\.js$/.test(f)).map((f) => `portal/${f}`),      // the pages' own scripts (the gallery's filters, the family page)
  ];
  const corpus: string[] = [];
  for (const rel of sources) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    for (const s of sourceStrings(file)) { res.counts.sourceStrings++; corpus.push(norm(s.text)); check(`${rel}:${s.line}`, s.text); }
  }
  if (corpus.length) owe('player', 'assets/viewer.ts + assets/story', corpus.join(' '), { logos: false, voice: false, family: false });

  // ---- the disclosures
  for (const [key, pages] of missing) {
    const [level, what] = key.split('|');
    const list = pages.length > 3 ? `${pages.slice(0, 3).join(', ')} and ${pages.length - 3} more` : pages.join(', ');
    const msg = `${what}: claims.json owes it and ${pages.length === 1 ? 'this page does not print it' : `${pages.length} pages do not print it`} (${list})`;
    if (level === 'enforced' || opts.strict) res.errors.push(msg); else res.pending.push(msg);
  }
  return res;
}
