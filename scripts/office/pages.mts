// The pages of a build made with --offices (reference/office/office-contract-m0.md): /office (office.html), a company's page (company/<slug>.html), and the switcher that
// goes into the header of the pages of the homes. Static HTML, pure functions of the cards: a rebuild is byte-identical. Every URL is relative; the four company links are on every page;
// a count is a word; every sentence is either claims.json's or written here and read by the copy lint (pnpm run story:copy -- dist). The pages are noindex.
import { LINKS, SITE_NAME, TWITTER_SITE, TITLE_MAX, esc, numberWord } from '../portal-pages.mts';
import { coreLine } from '../story/lib/fine-print.mts';
import { FICTIONAL_COMPANY_LINE } from '../story/lib/co/consts.mts';
import { CARD_LIMITS, SIZE_LABELS, companiesLine, officesWord, type Card } from './data.mts';
import { SIZES } from '../story/lib/co/consts.mts';
import { companyLong, officeFinePrint } from './fine-print.mts';
import { functionsFor } from '../story/lib/kinds.mts';

/** "../" for a page one level down (company/<slug>), "./" for the site's root */
export type Up = './' | '../';

const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></symbol>
    <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
  </defs></svg>`;

const initial = (n: string): string => (Array.from(n.trim())[0] || '?').toUpperCase();

/** The two links of the switcher, Homes then Offices; `current` marks the section, `page` the exact page (the gallery, /office). */
export function switcherLinks(up: Up, current: 'homes' | 'offices', page: boolean): string {
  const mark = (which: 'homes' | 'offices'): string => (which === current ? ` aria-current="${page ? 'page' : 'true'}"` : '');
  return `<a class="nav-homes" href="${up}#homes" data-campaign${mark('homes')}>Homes</a>\n      <a class="nav-offices" href="${up}office" data-campaign${mark('offices')}>Offices</a>`;
}

/**
 * What the switcher needs, and no more. The pages of the homes load none of this sheet, so a flagged build gives each of them these rules inline (and the office's pages the same):
 * the section the visitor is in is marked; the Homes link, which the homes' sheets hide below 1100 px, stays (the switcher is the one thing the bar must keep); the short labels
 * start at 1100 px and the title beside the lockup goes at 800 px (two more links need the room); and on a phone the bar is the lockup, Homes, Offices and Buy Core (Download is
 * in the Core band and the footer). scripts/story/portal-tests/ keeps no check of this yet: the header sweep in the status notes (320 to 1440 px, no overlap, no sideways scroll) did.
 */
export const SWITCH_CSS = `.site-nav a[aria-current] { color: var(--foreground); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 0.35em; }
.site-nav .nav-homes { display: inline-flex; }
@media (max-width: 1100px) { .nav-long { display: none; } .nav-short { display: inline; } }
@media (max-width: 800px) { .brand .brand-title, .brand-sep { display: none; } }
@media (max-width: 520px) { .site-nav .nav-download { display: none; } .site-head { gap: 4px; } .brand-logo { height: 34px; } .site-nav a { padding: 0 6px; font-size: 14px; } .site-nav .nav-buy { padding: 0 9px; margin-left: 2px; } }
@media (max-width: 359px) { .brand-logo { height: 28px; } .site-nav a { padding: 0 5px; } .site-nav .nav-buy { padding: 0 8px; } }`;

const header = (up: Up, current: 'offices'): string => `<header class="site-head">
    <div class="brand">
      <a class="brand-ci" href="${LINKS.site}" aria-label="${SITE_NAME}"><picture><source srcset="${up}assets/brand/ci-logo-white-banner.svg" media="(prefers-color-scheme: dark)"><img class="brand-logo" src="${up}assets/brand/ci-logo-black-banner.svg" alt="" width="151" height="48"></picture></a>
      <span class="brand-sep" aria-hidden="true"></span>
      <a class="brand-title" href="${up}office" data-campaign>Virtual offices</a>
    </div>
    <nav class="site-nav" aria-label="Site">
      ${switcherLinks(up, current, up === './')}
      <a class="nav-docs" href="${LINKS.docs}">Docs</a>
      <a class="nav-download" href="${LINKS.download}"><span class="nav-long">Download Companion</span><span class="nav-short">Download</span></a>
      <a class="nav-buy" href="${LINKS.core}"><span class="nav-long">Buy Companion Core</span><span class="nav-short">Buy Core</span></a>
    </nav>
  </header>`;

const coreBand = (): string => `<section class="cta-band" id="core" aria-labelledby="cta-title">
      <div class="cta-copy">
        <h2 id="cta-title">Meet the Companion Core.</h2>
        <p>${esc(coreLine('the desk'))}</p>
      </div>
      <div class="cta-actions">
        <a class="btn btn-buy" href="${LINKS.core}">Buy Companion Core</a>
        <a class="btn btn-ghost" href="${LINKS.download}">Download Companion</a>
        <a class="cta-docs" href="${LINKS.docs}">Read the docs</a>
      </div>
    </section>`;

const footer = (up: Up, fine: string): string => `<footer class="site-foot">
    <div class="foot-grid">
      <div>
        <p class="foot-brand"><img src="${up}assets/brand/ci-logo-mark.svg" alt="" width="20" height="20"><b>${SITE_NAME}</b></p>
      </div>
      <nav class="foot-links" aria-label="${SITE_NAME}">
        <ul>
          <li><a href="${LINKS.site}">ci.computer</a></li>
          <li><a href="${LINKS.core}">Buy Companion Core</a></li>
          <li><a href="${LINKS.download}">Download Companion</a></li>
          <li><a href="${LINKS.docs}">Docs</a></li>
          <li><a href="${LINKS.privacy}">Privacy</a></li>
          <li><a href="${LINKS.terms}">Terms</a></li>
        </ul>
      </nav>
      <div class="foot-notes" style="grid-column: 1 / -1">
        ${fine}
      </div>
    </div>
    <p class="legal">© 2026 LifeScope Inc., DBA Companion Intelligence.</p>
  </footer>`;

interface Head { title: string; description: string; up: Up; styles: string[]; scripts: string[] }
const head = (h: Head): string => `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(h.title)}</title>
  <meta name="description" content="${esc(h.description)}">
  <meta name="robots" content="noindex, nofollow">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE_NAME)}">
  <meta property="og:title" content="${esc(h.title)}">
  <meta property="og:description" content="${esc(h.description)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:site" content="${TWITTER_SITE}">
  <meta name="twitter:title" content="${esc(h.title)}">
  <meta name="twitter:description" content="${esc(h.description)}">
  <meta name="theme-color" content="#f3faf7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#041620" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="${h.up}assets/brand/ci-logo-mark.svg" type="image/svg+xml">
  <link rel="icon" href="${h.up}portal/icons/favicon.ico" sizes="48x48">
  <link rel="apple-touch-icon" href="${h.up}portal/icons/apple-touch-icon.png">
  <link rel="manifest" href="${h.up}portal/site.webmanifest">
${h.styles.map((s) => `  <link rel="stylesheet" href="${h.up}portal/${s}">`).join('\n')}
${h.scripts.map((s) => `  <script src="${h.up}portal/${s}" defer data-cfasync="false"></script>`).join('\n')}
  <style data-office-switch>${SWITCH_CSS}</style>
</head>`;

const clip = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`);

// ---------------------------------------------------------------------------------------------------------------------------------- /office
export const OFFICE_TITLE = 'Virtual offices · Companion Intelligence';
export const officeDescription = (n: number): string => `${officesWord(n)}, each with a fictional company that keeps its jobs on one Companion Core. ${FICTIONAL_COMPANY_LINE}`;
export const DRAFT_NOTE = 'Draft for review. This page is not public. The buildings, the tours and the company names are placeholders.';

const plate = (c: Card): string => `<div class="thumb plate" aria-hidden="true"><span class="plate-mono">${esc(initial(c.name))}</span><span class="plate-kind">${esc(c.building.kind)}</span><span class="plate-note">Building not drawn yet</span></div>`;

/** a company's card: its plate, its size, its name as the link stretched over the card, what it does and where, who works there, the pairs that tell it */
export function companyCard(c: Card): string {
  const cast = c.people.slice(0, CARD_LIMITS.people).map((p) => `<li><span class="disc" aria-hidden="true">${esc(initial(p.name))}</span><span class="who"><b>${esc(p.name)}</b><span>${esc(p.title)}</span></span></li>`).join('');
  const lines = c.pairList.slice(0, CARD_LIMITS.pairs).map((p) => `<li>${esc(p.line)}</li>`).join('');
  return `<li class="card card-family card-company" data-slug="${esc(c.slug)}" data-name="${esc(c.name)}" data-size="${esc(c.size)}" data-fn="${esc(c.functionIds.join(' '))}" data-find="${esc(c.find)}">`
    + plate(c)
    + `<div class="card-body"><p class="size-tag">${esc(c.sizeLabel)}</p><h3><a href="./company/${esc(encodeURIComponent(c.slug))}" data-campaign aria-label="${esc(`${c.name}, ${c.sector.charAt(0).toLowerCase()}${c.sector.slice(1)}. Meet the company`)}">${esc(c.name)}</a></h3>`
    + `<p class="home-line">${esc(`${c.sector} · ${c.place}`)}</p>`
    + `<p class="scope-line">${esc(c.scopeLine)}</p>`
    + `<ul class="cast" aria-label="Who works here">${cast}</ul>`
    + (lines ? `<ul class="pairs-lines" aria-label="Apps and the services they are alternatives to">${lines}</ul>` : '')
    + `<p class="go" aria-hidden="true"><span>Meet the company</span><svg class="i"><use href="#i-arrow"/></svg></p></div></li>`;
}

/** the buttons of the filters: a size for each size (the ones no company has are disabled), a job for each function some company has. The script enables them. A count is a word, in the label. */
function filters(cards: Card[]): { sizes: string; jobs: string } {
  const labels = new Map(functionsFor().map((f) => [f.id, f.label]));
  const companies = (n: number): string => `${numberWord(n)} ${n === 1 ? 'company' : 'companies'}`;
  const sizes: [string, string, number][] = [['', 'Any size', cards.length], ...SIZES.map((id): [string, string, number] => [id, SIZE_LABELS[id], cards.filter((c) => c.size === id).length])];
  const fns = functionsFor().map((f) => ({ id: f.id, label: labels.get(f.id)!, n: cards.filter((c) => c.functionIds.includes(f.id)).length })).filter((f) => f.n > 0);
  return {
    sizes: `<div class="seg sizes" id="sizes" role="group" aria-label="Size of company">${sizes.map(([id, label, n]) => `<button type="button" data-size="${id}" aria-pressed="${id === '' ? 'true' : 'false'}" aria-label="${esc(`${label}, ${companies(n)}`)}" disabled>${esc(label)}</button>`).join('')}</div>`,
    jobs: fns.map((f) => `<button type="button" class="tag job" data-fn="${esc(f.id)}" data-label="${esc(f.label)}" aria-pressed="false" aria-label="${esc(`${f.label}, ${companies(f.n)}`)}" disabled>${esc(f.label)}</button>`).join('\n          '),
  };
}

export function officePage(cards: Card[]): string {
  const n = cards.length, f = filters(cards);
  const fine = officeFinePrint('office-footer').html, fold = officeFinePrint('office-fold', {}, { cls: 'fiction-label' }).html;
  return `<!DOCTYPE html>
<html lang="en">
${head({ title: OFFICE_TITLE, description: officeDescription(n), up: './', styles: ['gallery.css', 'office.css'], scripts: ['campaign.js', 'office.js'] })}
<body>
  ${SPRITE}
  <a class="skip" href="#companies">Skip to the companies</a>
  ${header('./', 'offices')}
  <main id="main" class="office-page">
    <p class="draft-note" role="note">${esc(DRAFT_NOTE)}</p>
    <section class="hero hero-text" aria-labelledby="office-title">
      <div class="hero-copy">
        <div class="hero-chips">${fold}</div>
        <h1 id="office-title">${esc(officesWord(n))}. Each with a fictional company and a Companion Core.</h1>
        <p class="lede">Each company here is made up. Open a company to see which Companion Hub app does each job, and which service it is an alternative to.</p>
        <div class="hero-cta">
          <a class="btn btn-primary" id="hero-companies" href="#companies"><span>Meet the companies</span><svg class="i" aria-hidden="true"><use href="#i-down"/></svg></a>
          <a class="hero-pointer" href="#core"><span>See Companion Core</span><svg class="i" aria-hidden="true"><use href="#i-down"/></svg></a>
        </div>
        <p class="hero-hint">The buildings and their tours are not drawn yet.</p>
      </div>
    </section>
    <section class="homes companies" id="companies" aria-labelledby="companies-title">
      <div class="homes-head">
        <h2 id="companies-title">Meet the companies</h2>
        <p class="homes-count" id="count">${esc(companiesLine(n))}</p>
        <p class="homes-live" id="live" role="status" aria-live="polite"></p>
        <button type="button" class="btn btn-ghost btn-small" id="clear" hidden>Clear filters</button>
      </div>
      <label class="search office-search">
        <svg class="i" aria-hidden="true"><use href="#i-search"/></svg>
        <input type="search" id="q" disabled placeholder="Search a company, a job or an app" aria-label="Search the companies, jobs, apps and services" autocomplete="off" spellcheck="false">
        <kbd aria-hidden="true">/</kbd>
      </label>
      <div class="jobs" id="jobs" role="group" aria-label="What people do">
        <span class="jobs-label" aria-hidden="true">Choose a job</span>
        <div class="jobs-row">
          ${f.jobs}
        </div>
      </div>
      ${f.sizes}
      <ul class="grid" id="grid" aria-label="Companies">
        ${cards.map(companyCard).join('\n        ')}
      </ul>
      <div class="empty" id="empty" hidden>
        <p><b>No companies match.</b> Try fewer words, or clear the filters.</p>
        <button type="button" class="btn btn-ghost" id="clear-empty">Clear filters</button>
      </div>
      <noscript><p class="empty">Search and the filters need JavaScript. Every company is listed here.</p></noscript>
    </section>
    ${coreBand()}
  </main>
  ${footer('./', fine)}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------------------------------------------------------------- /company/<slug>
export const companyTitle = (c: Card): string => { const full = `${c.name} · Virtual offices · ${SITE_NAME}`; return full.length <= TITLE_MAX ? full : `${c.name} · Virtual offices`; };
export const companyDescription = (c: Card): string => clip(`${c.tagline} ${FICTIONAL_COMPANY_LINE}`, 160);

export function companyPage(c: Card, prev?: Card, next?: Card): string {
  const up: Up = '../';
  const labels = new Map(functionsFor().map((f) => [f.id, f.label]));
  const people = c.people.map((p) => `<li id="${esc(p.id)}"><span class="disc" aria-hidden="true">${esc(initial(p.name))}</span><span class="who"><b>${esc(p.name)}</b><span>${esc(p.title)}</span><span class="fn">${esc(labels.get(p.function) ?? p.function)}${p.ownsCore ? ' · looks after the Core' : ''}</span></span></li>`).join('');
  const pairs = c.pairList.map((p) => `<li>${esc(p.line)}</li>`).join('');
  const limits = c.limits.map((l) => `<li>${esc(l)}</li>`).join('');
  const fold = officeFinePrint('company-fold', {}, { cls: 'fiction-label' }).html, fine = `<p data-fine="fictional-company-long">${esc(companyLong(c.name))}</p>${officeFinePrint('company-footer').html}`;
  const near = [prev && `<a href="./${esc(encodeURIComponent(prev.slug))}" data-campaign rel="prev">Previous company: ${esc(prev.name)}</a>`, next && `<a href="./${esc(encodeURIComponent(next.slug))}" data-campaign rel="next">Next company: ${esc(next.name)}</a>`].filter(Boolean).join('');
  return `<!DOCTYPE html>
<html lang="en">
${head({ title: companyTitle(c), description: companyDescription(c), up, styles: ['gallery.css', 'office.css'], scripts: ['campaign.js'] })}
<body>
  ${SPRITE}
  <a class="skip" href="#main">Skip to the company</a>
  ${header(up, 'offices')}
  <main id="main" class="company-page" data-company="${esc(c.name)}">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="../office" data-campaign>Virtual offices</a></li><li><span aria-current="page">${esc(c.name)}</span></li></ol></nav>
    <p class="draft-note" role="note">${esc(DRAFT_NOTE)}</p>
    <section class="hero hero-text" aria-labelledby="company-title">
      <div class="hero-copy">
        <div class="hero-chips">${fold}</div>
        <h1 id="company-title">${esc(c.name)}</h1>
        <p class="lede">${esc(c.tagline)}</p>
        <p class="company-facts">${esc(`${c.sector} · ${c.place} · ${c.sizeLabel}`)}<br>${esc(c.scopeLine)}</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="${LINKS.core}"><span>See Companion Core</span></a>
          <a class="btn btn-ghost" href="../office" data-campaign><span>All offices</span></a>
        </div>
        <p class="hero-hint">The building and its tour are not drawn yet.</p>
      </div>
      ${plate(c).replace('class="thumb plate"', 'class="thumb plate plate-hero"')}
    </section>
    <section class="company-section" id="company" aria-labelledby="meet-title">
      <h2 id="meet-title">Meet the company</h2>
      <p class="company-story">${esc(c.story)}</p>
      <ul class="people" aria-label="Who works here">${people}</ul>
    </section>
    <section class="company-section" id="office" aria-labelledby="office-title2">
      <h2 id="office-title2">The office</h2>
      <p>${esc(c.building.concept)}</p>
      <p class="company-note">${esc(`${c.building.kind}. It is not drawn yet.`)}</p>
    </section>
    <section class="company-section" id="runs" aria-labelledby="runs-title">
      <h2 id="runs-title">What runs on the Core</h2>
      <ul class="pairs-lines pairs-all" aria-label="Apps and the services they are alternatives to">${pairs}</ul>
    </section>
    <section class="company-section" id="limits" aria-labelledby="limits-title">
      <h2 id="limits-title">What stays out there</h2>
      <ul class="limits">${limits}</ul>
    </section>
    ${near ? `<nav class="company-near" aria-label="Other companies">${near}</nav>` : ''}
    ${coreBand()}
  </main>
  ${footer(up, fine)}
</body>
</html>
`;
}
