// The office, added to a portal build (scripts/build-portal.mts calls buildOfficeSite once, only when the build is made with --offices; reference/office/office-contract-m0.md):
//   <out>/office.html               /office: the cards, the filters, the Core band
//   <out>/company/<slug>.html      a company's page
//   <out>/portal/office.css|js     the page's style and its filter script (sources in scripts/office/assets/, never in portal/: step 3 of the build copies every file of portal/)
// and the switcher (Homes · Offices) in the header of the pages of the homes, injected into the built copies. Nothing is added to sitemap.xml or robots.txt, the pages are noindex, and the
// build refuses to run with --strict-families (what a push to main builds): the office is not public. Without --offices none of this runs and the output is byte for byte what it was.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { LINKS, TITLE_MAX } from '../portal-pages.mts';
import { FICTIONAL_COMPANY_LINE } from '../story/lib/co/consts.mts';
import { loadCards, type Card } from './data.mts';
import { SWITCH_CSS, companyPage, officePage, switcherLinks } from './pages.mts';

export const ASSETS = ['office.css', 'office.js'] as const;
export interface OfficeBuild { files: number; bytes: number; /** the pages written, relative to the output */ pages: string[]; cards: Card[] }

const decode = (s: string): string => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

/** the switcher goes into the header's nav: it replaces the Homes link a page has, or goes first when it has none; one rule makes the current section visible */
export function injectSwitcher(html: string, o: { up: './' | '../'; current: 'homes' | 'offices'; page: boolean }): string | null {
  const links = switcherLinks(o.up, o.current, o.page);
  const homes = /<a class="nav-homes"[^>]*>Homes<\/a>/;
  let out: string;
  if (homes.test(html)) out = html.replace(homes, () => links);
  else if (/<nav class="site-nav" aria-label="Site">/.test(html)) out = html.replace(/(<nav class="site-nav" aria-label="Site">)/, (_m, open: string) => `${open}\n      ${links}`);
  else return null;
  if (!out.includes('</head>')) return null;
  return out.replace('</head>', () => `  <style data-office-switch>${SWITCH_CSS}</style>\n</head>`);
}

export async function buildOfficeSite(o: { ROOT: string; OUT: string; SITE: string; problems: string[]; dir?: string }): Promise<OfficeBuild> {
  const { ROOT, OUT, SITE, problems } = o;
  const { cards, problems: cardProblems } = loadCards(ROOT, o.dir);
  for (const p of cardProblems) problems.push(`offices: ${p}`);
  let files = 0, bytes = 0;
  const pages: string[] = [];
  const write = (rel: string, data: string | Buffer): void => {
    const to = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, data);
    files++; bytes += Buffer.byteLength(data);
  };
  const read = (rel: string): string => fs.readFileSync(path.join(OUT, rel), 'utf8');

  // 1. the page's own style and script
  for (const f of ASSETS) write(path.join('portal', f), fs.readFileSync(path.join(ROOT, 'scripts', 'office', 'assets', f)));
  // 2. the pages
  write('office.html', officePage(cards)); pages.push('office.html');
  cards.forEach((c, i) => { write(path.join('company', `${c.slug}.html`), companyPage(c, cards[i - 1], cards[i + 1])); pages.push(`company/${c.slug}.html`); });
  // 3. the sheets and scripts the pages name get a hash of their content, as the other pages' do (build-portal.mts, step 5e)
  const hashOf = (rel: string): string => crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT, rel))).digest('hex').slice(0, 10);
  for (const p of pages) {
    const text = read(p).replace(/((?:src|href)=")((?:\.\/|\.\.\/)portal\/[^"?#]+\.(?:js|css))(")/g, (whole, a: string, url: string, z: string) => {
      const rel = url.replace(/^(?:\.\/|\.\.\/)/, '');
      if (!fs.existsSync(path.join(OUT, rel))) { problems.push(`offices: ${p} names ${url}, which is not in the output`); return whole; }
      return `${a}${url}?v=${hashOf(rel)}${z}`;
    });
    fs.writeFileSync(path.join(OUT, p), text);
  }
  // 4. the switcher, into the pages of the homes and the families, the front page and the 404
  const inject = (rel: string, up: './' | '../', current: 'homes', page: boolean): void => {
    if (!fs.existsSync(path.join(OUT, rel))) return;
    const next = injectSwitcher(read(rel), { up, current, page });
    if (next === null) problems.push(`offices: ${rel} has no header nav to put the Homes and Offices switcher in`);
    else fs.writeFileSync(path.join(OUT, rel), next);
  };
  inject('index.html', './', 'homes', true);
  for (const dir of ['homes', 'family']) for (const f of fs.existsSync(path.join(OUT, dir)) ? fs.readdirSync(path.join(OUT, dir)).filter((x) => x.endsWith('.html')) : []) inject(path.join(dir, f), '../', 'homes', false);
  {
    // the 404 is served at any depth, so it offers the offices by the site's own address
    const rel = '404.html';
    if (fs.existsSync(path.join(OUT, rel))) {
      const t = read(rel), anchor = /(<a class="btn" href="[^"]*" data-campaign>See the virtual homes<\/a>)/;
      if (!anchor.test(t)) problems.push('offices: 404.html has no "See the virtual homes" button to put the offices beside');
      else fs.writeFileSync(path.join(OUT, rel), t.replace(anchor, (_m, a: string) => `${a}\n      <a class="btn ghost" href="${new URL('office', SITE).href}" data-campaign>See the virtual offices</a>`));
    }
  }

  // 5. what the office's pages must carry (the homes' pages' rules, build-portal.mts step 7, and the ones that keep it off the public site)
  for (const p of pages) {
    const t = read(p), title = (t.match(/<title>([^<]*)<\/title>/) || [])[1] || '', desc = (t.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
    const bad = (m: string): void => { problems.push(`offices: ${p}: ${m}`); };
    if (!title || !desc) bad('no title or description');
    if (decode(title).length > TITLE_MAX) bad(`the title "${title}" is over ${TITLE_MAX} characters`);
    if (decode(desc).length > 160) bad('the description is over 160 characters');
    const charset = t.search(/<meta charset=/i);
    if (charset < 0 || charset > 1024) bad(`<meta charset> is at byte ${charset}, past the 1024 a parser's prescan reads`);
    for (const [what, url] of [['Companion Intelligence', LINKS.site], ['Buy Companion Core', LINKS.core], ['Download Companion', LINKS.download], ['the docs', LINKS.docs], ['the privacy policy', LINKS.privacy], ['the terms', LINKS.terms]] as const) if (!t.includes(`href="${url}"`)) bad(`no link to ${what} (${url})`);
    if (/href="https:\/\/ci\.computer\/(core|download)[?#]/.test(t)) bad('a link to /core or /download carries a query or a fragment');
    if ((t.match(/<h1\b/g) || []).length !== 1 || (t.match(/<main\b/g) || []).length !== 1) bad('it needs exactly one <h1> and one <main>');
    for (const m of t.matchAll(/<script\b([^>]*)>/g)) if (!/type="(importmap|application\/ld\+json)"|data-cfasync="false"/.test(m[1])) bad(`${m[0].slice(0, 80)} lacks data-cfasync="false"`);
    if (!/<meta name="robots" content="noindex, nofollow">/.test(t)) bad('it is not noindex, nofollow: the office is not public');
    if (/<link rel="canonical"/.test(t)) bad('a canonical link on a page that is not to be found');
    if (!t.includes(FICTIONAL_COMPANY_LINE)) bad(`the label "${FICTIONAL_COMPANY_LINE}" is missing`);
    if (/(?:href|src)="\/(?!\/)[^"]*"|url\("?\/(?!\/)/.test(t)) bad('a root-relative URL breaks under a sub-path');
    if (/href="[^"]*\bindex\.html/.test(t)) bad('a link names index.html (Cloudflare Pages answers it with a 308)');
    if ((t.match(/class="nav-offices"/g) || []).length !== 1 || (t.match(/class="nav-homes"/g) || []).length !== 1) bad('the header needs one Homes link and one Offices link');
    for (const m of t.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:|data:|mailto:|#)/.test(u)) continue;
      const clean = u.split(/[?#]/)[0];
      if (!clean) continue;
      const target = path.normalize(path.join(path.dirname(p), clean));
      if (!fs.existsSync(path.join(OUT, target)) && !fs.existsSync(path.join(OUT, `${target}.html`))) bad(`${u} is linked but not in the output`);
    }
  }
  {
    const listed = [...read('office.html').matchAll(/<li class="card card-family card-company" data-slug="([^"]+)"/g)].map((m) => m[1]);
    if (listed.join() !== cards.map((c) => c.slug).join()) problems.push(`offices: office.html lists ${listed.length} cards, the companies are ${cards.length}, or in another order`);
    for (const f of ['sitemap.xml', 'robots.txt']) if (fs.existsSync(path.join(OUT, f)) && /office|company/i.test(read(f))) problems.push(`offices: ${f} mentions the office: a build with --offices adds nothing to it`);
  }
  console.log(`offices: ${cards.length} card${cards.length === 1 ? '' : 's'} on office.html and ${cards.length} company page${cards.length === 1 ? '' : 's'}, the switcher in the header of every page of the homes (not public: noindex, not in the sitemap)`);
  return { files, bytes, pages, cards };
}
