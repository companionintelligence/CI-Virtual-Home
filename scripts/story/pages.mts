// The HTML the story site's build writes: the chrome every page shares (header, fiction bar, footer), the static family
// page, the credits page, and the fragments index.html has built into it. Pure functions of the data; scripts/story/site.mts
// calls them. Every string a visitor reads is in the Uncloud voice (no dashes, sentence case headings) and every claim is
// on the fact sheet or in the family's own file; the checks in scripts/story/check-copy.mts lint the output.
import type { Story, Beat, Member } from '../../assets/story/types.ts';
import { FICTIONAL_LINE, BETA_LINE } from '../../assets/story/types.ts';
import type { Loaded, Card } from './site-lib.mts';
import { esc, familyTitle, addressLine, disclosure, TOPIC_LABEL, HOUSEHOLD_LABEL, TOPICS } from './site-lib.mts';

export const SITE_NAME = 'Companion Intelligence';
export const PRODUCT = 'Companion Core';
export const HUB_URL = 'https://hub.ci.computer/store';
export const ALTERNATIVES_URL = 'https://hub.ci.computer/store?category=alternatives';
export const CORE_URL = 'https://ci.computer/core';
export const SIGNOFF = 'UnCloud your life.';
export const LANDING_TITLE = 'Uncloud your life with Companion Core home servers';
export const LANDING_DESC = 'Thirty fictional families, real software. Walk through their homes and see how a Companion Core keeps your apps, agents and memory off the cloud.';
export const LEDE = 'Companion Core is a 4.3 litre computer that holds large local models in unified memory, runs your apps and your agents, and answers only to the person in the room.';

const MEMBER_ROLE: Record<string, string> = { parent: 'Parent', partner: 'Partner', 'adult-child': 'Adult child', teen: 'Teen', child: 'Child', baby: 'Baby', grandparent: 'Grandparent', housemate: 'Housemate', visitor: 'Visitor' };

// Lucide path data (ISC, see THIRD_PARTY.md), the subset the static pages use.
const SPRITE: Record<string, string> = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  retry: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
};
export function sprite(ids: string[]): string {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${ids.map(i => `<symbol id="i-${i}" viewBox="0 0 24 24">${SPRITE[i]}</symbol>`).join('')}</defs></svg>`;
}
export const icon = (name: string, cls = ''): string => `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** Keep a catalog sentence out of the page when it breaks a copy rule (the catalog is not written in our voice). */
export function plainCatalog(text: string | undefined, rules: RegExp[]): string {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return rules.some(r => r.test(t)) ? '' : t;
}
export function errorRules(claims: any): RegExp[] {
  return (claims.bannedPhrases as { pattern: string; flags?: string; severity: string }[]).filter(b => b.severity === 'error').map(b => new RegExp(b.pattern, b.flags ?? 'i'));
}

export function header(rel: string): string {
  return `<a class="skip" href="#main">Skip to the content</a>
  <header class="site-head">
    <a class="brand" href="${rel}index.html" aria-label="${PRODUCT}, home"><img src="${rel}assets/brand/ci-logo-mark.svg" alt="" width="28" height="28"><span class="brand-text"><b>${PRODUCT}</b><span>${SITE_NAME}</span></span></a>
    <nav class="site-nav" aria-label="Site" id="site-nav">
      <a href="${rel}index.html#families">Families</a>
      <a href="${rel}index.html#start">How it starts</a>
      <a href="${rel}index.html#local">Why local</a>
      <a href="${HUB_URL}" rel="noopener">${'Companion Hub'}${icon('out', 'i-out')}</a>
    </nav>
    <a class="btn btn-primary btn-sm head-cta" href="${CORE_URL}" rel="noopener">See ${PRODUCT}</a>
    <button type="button" class="menu-btn" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${icon('menu')}</button>
  </header>
  <div class="fiction-bar" role="note"><p>Fictional families. Real software. ${BETA_LINE}</p></div>`;
}

export function footer(rel: string, claims: any, opts: { scripted?: boolean } = {}): string {
  const d = (id: string) => esc(disclosure(claims, id));
  return `<footer class="site-foot">
    <div class="foot-grid">
      <div>
        <p class="foot-brand"><img src="${rel}assets/brand/ci-logo-mark.svg" alt="" width="20" height="20"><b>${SITE_NAME}</b></p>
        <p>The 3D homes are drawn on your device with three.js. Nothing is streamed. ${d('site-practises')}</p>
        <p class="foot-links"><a href="https://ci.computer" rel="noopener">ci.computer</a> <a href="https://docs.ci.computer" rel="noopener">docs.ci.computer</a> <a href="${HUB_URL}" rel="noopener">Companion Hub store</a> <a href="${rel}credits.html">Credits</a> <a href="${rel}index.html#disclosures">Disclosures</a></p>
      </div>
      <div class="foot-notes">
        <p><b>${esc(FICTIONAL_LINE)}</b> The families on this site are made up. They are not customers.</p>
        <p>${esc(BETA_LINE)} ${d('apps-availability')}</p>
        ${opts.scripted ? `<p>${d('scripted-scenes')}</p><p>${d('stylised-art')}</p><p>${d('synthetic-voice')}</p>` : ''}
        <p>${d('names-owners')}</p>
      </div>
    </div>
    <p class="legal">© 2026 LifeScope Inc., DBA Companion Intelligence. <a href="https://ci.computer">ci.computer</a></p>
  </footer>`;
}

const head = (o: { title: string; ogTitle?: string; desc: string; canonical: string; image: string; imageAlt: string; rel: string; noindex: boolean; ld: object; css: string[]; type?: string }): string => `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.desc)}">
  <meta name="robots" content="${o.noindex ? 'noindex,follow' : 'index,follow'}">
  <link rel="canonical" href="${esc(o.canonical)}">
  <meta property="og:type" content="${o.type || 'website'}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${esc(o.ogTitle || o.title)}">
  <meta property="og:description" content="${esc(o.desc)}">
  <meta property="og:url" content="${esc(o.canonical)}">
  <meta property="og:image" content="${esc(o.image)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(o.imageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#f3faf7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#041620" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="${o.rel}assets/brand/ci-logo-mark.svg" type="image/svg+xml">
  <link rel="preload" href="${o.rel}assets/fonts/manrope-latin-var.woff2" as="font" type="font/woff2" crossorigin>
${o.css.map(c => `  <link rel="stylesheet" href="${o.rel}portal/${c}">`).join('\n')}
  <script type="application/ld+json">${JSON.stringify(o.ld).replace(/</g, '\\u003c')}</script>`;

// ---------------------------------------------------------------------------------------------------- the family page
const MOMENT = ['t', 'shot', 'tod', 'play', 'beat'];
export type FamilyPageCtx = {
  s: Story; card: Card; prev: Card; next: Card; site: string; claims: Loaded['claims']; catalog: Loaded['catalog'];
  poster: string; og: string; noindex: boolean; film?: { src169?: string; src916?: string; vtt?: string; poster?: string; durationMs: number; bytes: number };
};
const memberName = (s: Story, id?: string): string => (id && s.members.find(m => m.id === id)?.name) || '';
const initial = (n: string): string => n.trim().charAt(0).toUpperCase();
const sentence = (t: string): string => t.replace(/\s+/g, ' ').trim();

export function memberHtml(m: Member): string {
  const c = m.companion;
  return `<li class="member">
          <span class="avatar" style="--disc:var(--${m.colour})" aria-hidden="true">${esc(initial(m.name))}</span>
          <div class="member-body">
            <h3>${esc(m.name)}</h3>
            <p class="member-meta">${esc(MEMBER_ROLE[m.role] || m.role)}, ${m.age}</p>
            ${m.work ? `<p>${esc(sentence(m.work).replace(/^./, ch => ch.toUpperCase()))}.</p>` : ''}
            ${c ? `<p class="agent"><b>${esc(c.name)}</b> is ${esc(m.name)}'s ${c.runtime === 'Hermes' ? 'Hermes' : 'OpenClaw'} agent. ${esc(sentence(c.job))} <span class="limits">${esc(sentence(c.limits))}</span></p>` : ''}
          </div>
        </li>`;
}

export function beatHtml(s: Story, b: Beat, slug: string, catalog: Loaded['catalog']): string {
  const who = memberName(s, b.member) || (b.agent ? memberName(s, b.agent) : '');
  const chips = (b.popup.chips || []).map((c, i) => {
    const app = b.app && i === 0 ? catalog[b.app.id] : null;
    return app && app.storeUrl ? `<a class="chip" href="${esc(app.storeUrl)}" rel="noopener">${esc(c)}</a>` : `<span class="chip">${esc(c)}</span>`;
  }).join('');
  const say = b.say ? s.members.find(m => m.id === b.say!.speaker)?.companion : null;
  const rows = b.popup.phone ? `<ul class="phone-rows" aria-label="${esc(b.popup.phone.header)}">${b.popup.phone.rows.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
  return `<li class="beat" id="b-${esc(b.id)}">
            <h4>${esc(b.popup.title)}</h4>
            ${who ? `<p class="beat-who">${esc(who)}</p>` : ''}
            <p>${esc(b.popup.body)}</p>${rows}
            ${chips ? `<p class="chips">${chips}</p>` : ''}
            ${b.say && say ? `<p class="say"><span class="tag-scripted">Scripted</span> ${esc(say.name)}: “${esc(b.say.text)}”</p>` : ''}
            ${b.popup.note ? `<p class="note">${esc(b.popup.note)}</p>` : ''}
            <a class="play-from" href="../room-creator.html?mode=view&amp;family=${slug}&amp;beat=${esc(b.id)}">Play from here${icon('play', 'i-fill')}</a>
          </li>`;
}

export function familyPage(c: FamilyPageCtx): string {
  const { s, card, claims, catalog } = c;
  const url = new URL(`family/${s.slug}`, c.site).href;
  const title = `${card.title} · ${PRODUCT}`;
  const desc = `${s.family.tagline} ${FICTIONAL_LINE}`;
  const rules = errorRules(claims);
  const chapters = s.chapters.map(ch => {
    const beats = s.beats.filter(b => b.chapter === ch.id);
    if (!beats.length) return '';
    return `<section class="chapter" aria-labelledby="ch-${esc(ch.id)}"><h3 id="ch-${esc(ch.id)}">${esc(ch.title)}</h3><ol class="beats">
          ${beats.map(b => beatHtml(s, b, s.slug, catalog)).join('\n          ')}
        </ol></section>`;
  }).join('\n        ');
  const apps = card.apps.map(a => {
    const cat = catalog[a.id];
    const desc1 = plainCatalog(cat?.description, rules);
    const inst = a.replaces.length ? `<span class="instead">Instead of ${esc(a.replaces.join(', '))}</span>` : '';
    return `<li class="app"><a class="app-name" href="${esc((cat && cat.storeUrl) || HUB_URL)}" rel="noopener">${esc(a.name)}${icon('out', 'i-out')}</a>${inst}${desc1 ? `<span class="app-desc">${esc(desc1)}</span>` : ''}</li>`;
  }).join('\n          ');
  const film = c.film && (c.film.src169 || c.film.src916) ? `
        <div class="film" id="film" hidden>
          <video controls preload="none" playsinline poster="../${esc(c.film.poster || c.poster)}" ${c.film.src169 ? `src="../${esc(c.film.src169)}"` : ''}>
            ${c.film.vtt ? `<track kind="captions" srclang="en" label="English" src="../${esc(c.film.vtt)}" default>` : ''}
          </video>
          <p class="film-note">${esc(disclosure(claims, 'synthetic-voice'))}</p>
        </div>` : '';
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc, inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: `${PRODUCT} · ${SITE_NAME}`, url: c.site }, primaryImageOfPage: { '@type': 'ImageObject', url: c.og },
    ...(c.film ? { video: { '@type': 'VideoObject', name: `${card.title}, a short film`, description: desc, thumbnailUrl: new URL(c.film.poster || c.poster, c.site).href, uploadDate: new Date().toISOString().slice(0, 10), duration: `PT${Math.round(c.film.durationMs / 1000)}S`, contentUrl: new URL(c.film.src169 || c.film.src916 || '', c.site).href } } : {}),
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${head({ title, ogTitle: card.title, desc, canonical: url, image: c.og, imageAlt: `The ${s.family.surname} family home in 3D. ${FICTIONAL_LINE}`, rel: '../', noindex: c.noindex, ld, css: ['site.css', 'family.css'] })}
  <script>
    // A shared moment (?t= ?shot= ?tod= ?play= ?beat=) goes straight to the tour; the plain page needs no script at all.
    (function () {
      var q = location.search; if (!/[?&](t|shot|tod|play|beat)=/.test(q)) return;
      var base = location.pathname.replace(/family\\/[^\\/]*\\/?$/, '');
      location.replace(base + 'room-creator.html?mode=view&family=${s.slug}' + (q ? '&' + q.slice(1) : '') + location.hash);
    })();
  </script>
  <script type="module" src="../portal/site.js"></script>
</head>
<body class="page-family">
  ${sprite(['out', 'play', 'next', 'prev', 'menu', 'film'])}
  ${header('../')}
  <main id="main">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="../index.html">${PRODUCT}</a></li><li><a href="../index.html#families">Families</a></li><li aria-current="page">${esc(card.title)}</li></ol></nav>

    <header class="fh">
      <h1>${esc(card.title)}</h1>
      <p class="disclosure"><strong>${esc(FICTIONAL_LINE)}</strong></p>
      <p class="address">${esc(addressLine(s))}</p>
      <p class="tagline">${esc(s.family.tagline)}</p>
    </header>

    <section class="stage" aria-label="The tour">
      <a class="poster" href="../room-creator.html?mode=view&amp;family=${s.slug}" aria-label="Take the tour of the ${esc(s.family.surname)} family home, in 3D">
        <img src="../${esc(c.poster)}" alt="An aerial view of the ${esc(s.family.surname)} family home, drawn in 3D." width="1200" height="630" fetchpriority="high">
        <span class="poster-badge">${icon('box')}Interactive 3D tour</span>
        <span class="poster-play" aria-hidden="true">${icon('play', 'i-fill')}</span>
      </a>
      <div class="stage-actions">
        <a class="btn btn-primary" href="../room-creator.html?mode=view&amp;family=${s.slug}">${icon('play', 'i-fill')}<span>Take the tour</span></a>
        ${c.film && (c.film.src169 || c.film.src916) ? `<button type="button" class="btn btn-ghost" id="film-open" aria-controls="film" aria-expanded="false">${icon('film')}<span>Watch the film</span></button>` : ''}
      </div>${film}
    </section>

    <section class="block" aria-labelledby="meet">
      <h2 id="meet">Meet the family</h2>
      <p class="lead">${esc(s.family.story)}</p>
      <ul class="members">
        ${s.members.map(memberHtml).join('\n        ')}
      </ul>
    </section>

    <section class="block" aria-labelledby="rooms">
      <h2 id="rooms">Their Core, room by room</h2>
      <p class="lead">Every scene below is also a stop in the tour. The text is the same as the captions.</p>
      ${chapters}
    </section>

    <section class="block" aria-labelledby="apps">
      <h2 id="apps">Apps in this home</h2>
      <p class="lead">Each one is in the Companion Hub store. Other software is named in text only.</p>
      <ul class="apps">
          ${apps}
      </ul>
    </section>

    <section class="block" aria-labelledby="firstrun">
      <h2 id="firstrun">How the Core starts</h2>
      <ol class="steps steps-compact">
          ${stepsHtml(true)}
      </ol>
      <p class="note">${esc(BETA_LINE)}</p>
    </section>

    <nav class="siblings" aria-label="Other families">
      <a class="sib" rel="prev" href="./${c.prev.slug}">${icon('prev')}<span><small>Previous family</small><b>${esc(c.prev.title)}</b></span></a>
      <a class="sib sib-next" rel="next" href="./${c.next.slug}"><span><small>Next family</small><b>${esc(c.next.title)}</b></span>${icon('next')}</a>
    </nav>

    <section class="closing" aria-labelledby="closing-title">
      <h2 id="closing-title">${esc(SIGNOFF)}</h2>
      <p>${esc(s.closing.body)}</p>
      <p><a class="btn btn-heat" href="${esc(s.closing.cta.url)}" rel="noopener">${esc(s.closing.cta.label)}</a></p>
    </section>
  </main>
  ${footer('../', claims, { scripted: true })}
  <script>
    (function () {
      var b = document.getElementById('film-open'), f = document.getElementById('film');
      if (!b || !f) return;
      f.hidden = true;
      b.addEventListener('click', function () {
        var open = f.hidden; f.hidden = !open; b.setAttribute('aria-expanded', String(open));
        var v = f.querySelector('video'); if (open) { document.body.classList.add('film-on'); f.scrollIntoView({ block: 'nearest' }); } else { document.body.classList.remove('film-on'); if (v) v.pause(); }
      });
    })();
  </script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------------------------------- credits
export function creditsPage(claims: any, site: string, noindex: boolean): string {
  const d = (id: string) => esc(disclosure(claims, id));
  const url = new URL('credits.html', site).href;
  const rows: [string, string, string][] = [
    ['three.js', 'MIT', 'draws the 3D homes in your browser'],
    ['Manrope', 'OFL-1.1', 'the typeface of this site'],
    ['Archivo Black', 'OFL-1.1', 'headlines and big numbers'],
    ['JetBrains Mono', 'OFL-1.1', 'code and keyboard keys in the tour'],
    ['Lucide', 'ISC', 'icons'],
    ['Kokoro-82M', 'Apache-2.0', 'the open text-to-speech model that reads the stories aloud, run on our own machines'],
  ];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${head({ title: `Credits · ${PRODUCT}`, desc: 'What this site is built with, and who made the software its families use.', canonical: url, image: new URL('portal/og/home.jpg', site).href, imageAlt: `${PRODUCT}. ${FICTIONAL_LINE}`, rel: './', noindex, ld: { '@context': 'https://schema.org', '@type': 'WebPage', name: `Credits · ${PRODUCT}`, url }, css: ['site.css', 'family.css'] })}
  <script type="module" src="./portal/site.js"></script>
</head>
<body class="page-family page-credits">
  ${sprite(['out', 'menu'])}
  ${header('./')}
  <main id="main">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="./index.html">${PRODUCT}</a></li><li aria-current="page">Credits</li></ol></nav>
    <header class="fh"><h1>Credits</h1><p class="disclosure"><strong>${esc(FICTIONAL_LINE)}</strong></p></header>
    <section class="block" aria-labelledby="built"><h2 id="built">Built with</h2>
      <ul class="credit-list">
        ${rows.map(([n, l, w]) => `<li><b>${esc(n)}</b> <span class="lic">${esc(l)}</span> <span>${esc(w)}</span></li>`).join('\n        ')}
      </ul>
      <p>${d('synthetic-voice')}</p>
    </section>
    <section class="block" aria-labelledby="agents"><h2 id="agents">The agents and the apps</h2>
      <p>${d('attribution-agents')}</p>
      <p>${d('third-party-apps')}</p>
      <p>${d('names-owners')}</p>
      <p>${d('apps-availability')}</p>
    </section>
  </main>
  ${footer('./', claims)}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------------------------------- landing fragments
/** The landing's head tags: everything index.html leaves to the build because it needs an address or a hash. */
export function landingHead(o: { site: string; families: string; og: string; noindex: boolean; cards: Card[]; hero: string }): string {
  const url = o.site;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: `${PRODUCT} · ${SITE_NAME}`, url },
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: LANDING_TITLE, url, description: LANDING_DESC, inLanguage: 'en',
      mainEntity: { '@type': 'ItemList', numberOfItems: o.cards.length, itemListElement: o.cards.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.title, url: new URL(`family/${c.slug}`, o.site).href })) } },
  ];
  return `<meta name="robots" content="${o.noindex ? 'noindex,follow' : 'index,follow'}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${esc(LANDING_TITLE)}">
  <meta property="og:description" content="${esc(LANDING_DESC)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(o.og)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(`${LANDING_TITLE}. ${FICTIONAL_LINE}`)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preload" href="./${esc(o.families)}" as="fetch" crossorigin>
  <link rel="preload" href="./${esc(o.hero)}" as="image" fetchpriority="high">
  ${ld.map(x => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n  ')}`;
}

// The first run, as the owner specified it (STORY-BIBLE section 7). Stylised line drawings, never a product render.
const DRAW: Record<string, string> = {
  plug: '<rect x="14" y="30" width="64" height="26" rx="6"/><circle cx="66" cy="43" r="3"/><path d="M14 43H6"/><path d="M78 43c14 0 14-16 26-16"/><path d="M104 21v12"/><path d="M110 21v12"/><path d="M101 27h12"/>',
  wifi: '<rect x="44" y="14" width="32" height="58" rx="6"/><path d="M56 64h8"/><path d="M52 34a12 12 0 0 1 16 0"/><path d="M48 28a18 18 0 0 1 24 0"/><circle cx="60" cy="40" r="1.5"/><rect x="6" y="52" width="26" height="16" rx="4"/><rect x="88" y="52" width="26" height="16" rx="4"/>',
  apps: '<rect x="18" y="14" width="24" height="24" rx="6"/><rect x="48" y="14" width="24" height="24" rx="6"/><rect x="78" y="14" width="24" height="24" rx="6"/><rect x="18" y="44" width="24" height="24" rx="6"/><rect x="48" y="44" width="24" height="24" rx="6"/><path d="M84 56l6 6 12-14"/>',
};
export const STEPS: { n: number; title: string; body: string; draw: string }[] = [
  { n: 1, title: 'Plug it in.', body: 'The parcel holds the Companion Core, a power cable, a quick-start guide and a recovery USB drive. Companion OS is already on its drive. Plug it in and press the button.', draw: 'plug' },
  { n: 2, title: 'Join its Wi-Fi.', body: 'The Core opens its own Wi-Fi network. Join it from a phone, choose your home network from the list and enter its password.', draw: 'wifi' },
  { n: 3, title: 'Pick your apps and run.', body: 'In the Companion Hub store, pick your first agents and apps. Then walk away. Installing apps uses the internet.', draw: 'apps' },
];
export function stepsHtml(compact = false): string {
  return STEPS.map(t => `<li class="step">
            <span class="step-n" aria-hidden="true">${t.n}</span>
            ${compact ? '' : `<svg class="step-draw" viewBox="0 0 120 80" role="img" aria-label="" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DRAW[t.draw]}</svg>`}
            <h3>${esc(t.title)}</h3>
            <p>${esc(t.body)}</p>
          </li>`).join('\n          ');
}

export function filtersHtml(): string {
  return `<fieldset class="facet" id="household"><legend>Who lives there</legend>
          <div class="radios" role="radiogroup" aria-label="Who lives there">
            <button type="button" role="radio" aria-checked="true" data-household="" tabindex="0">Any</button>
            ${(Object.keys(HOUSEHOLD_LABEL) as (keyof typeof HOUSEHOLD_LABEL)[]).map(k => `<button type="button" role="radio" aria-checked="false" data-household="${k}" tabindex="-1">${esc(HOUSEHOLD_LABEL[k])}<small></small></button>`).join('\n            ')}
          </div>
        </fieldset>
        <fieldset class="facet" id="topics"><legend>What they do with it</legend>
          <div class="chips-row">
            ${TOPICS.map(t => `<button type="button" class="topic" data-topic="${t}" aria-pressed="false">${esc(TOPIC_LABEL[t])}<small></small></button>`).join('\n            ')}
          </div>
        </fieldset>`;
}

export function noscriptList(cards: Card[]): string {
  return `<noscript><div class="block"><p>The family list needs JavaScript. Each family also has its own page.</p><ul class="plain">${cards.map(c => `<li><a href="./family/${c.slug}">${esc(c.title)}</a>, ${esc(c.address)}. ${esc(c.tagline)}</li>`).join('')}</ul></div></noscript>`;
}

export type RoomPick = { kind: string; label: string; slug: string; beat: string; title: string; body: string; family: string; app: string; replaces: string };
const ROOM_KINDS: [string, string, (b: Beat, s: Story) => boolean][] = [
  ['living', 'Living room', (b, s) => chapterRoom(s, b) === 'living'],
  ['kitchen', 'Kitchen', (b, s) => chapterRoom(s, b) === 'kitchen'],
  ['garden', 'Garden', (b, s) => ['garden', 'patio'].includes(chapterRoom(s, b) || '')],
  ['office', 'Home office', (b, s) => chapterRoom(s, b) === 'office'],
  ['kids', 'Kids\u2019 room', (b, s) => chapterRoom(s, b) === 'kids'],
  ['garage', 'Garage or shop', (b, s) => chapterRoom(s, b) === 'garage' || /\b(shop|workshop|garage)\b/i.test(s.chapters.find(c => c.id === b.chapter)?.title || '')],
];
const chapterRoom = (s: Story, b: Beat): string | undefined => s.chapters.find(c => c.id === b.chapter)?.room;
/** Six stories, one per kind of room, each from a different family where the data allows (deterministic, never random). */
export function pickRooms(stories: Story[], order: string[], catalog: Loaded['catalog']): RoomPick[] {
  const used = new Set<string>(), out: RoomPick[] = [];
  const list = order.map(slug => stories.find(s => s.slug === slug)!).filter(Boolean);
  ROOM_KINDS.forEach(([kind, label, test], k) => {
    const cands: { s: Story; b: Beat }[] = [];
    for (const s of list) for (const b of s.beats) if (b.app && b.chapter !== s.chapters[0].id && b.popup.kind !== 'phone' && test(b, s) && b.popup.body.split(/\s+/).length <= 30) cands.push({ s, b });
    const fresh = cands.filter(c => !used.has(c.s.slug));
    const pool = fresh.length ? fresh : cands;
    if (!pool.length) return;
    const pick = pool[(k * 5) % pool.length];
    used.add(pick.s.slug);
    const app = catalog[pick.b.app!.id];
    out.push({ kind, label, slug: pick.s.slug, beat: pick.b.id, title: pick.b.popup.title, body: pick.b.popup.body, family: familyTitle(pick.s), app: app ? app.name : pick.b.app!.id, replaces: (pick.b.app!.replaces || [])[0] || '' });
  });
  return out;
}
export function roomsHtml(picks: RoomPick[]): string {
  return picks.map(p => `<li class="story-card">
            <p class="story-room">${esc(p.label)}</p>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.body)}</p>
            <p class="chips"><span class="chip">${esc(p.app)}</span>${p.replaces ? `<span class="chip chip-quiet">replaces ${esc(p.replaces)}</span>` : ''}</p>
            <p class="story-foot"><span>${esc(p.family)}</span><a href="./family/${p.slug}?beat=${esc(p.beat)}">See it in the tour${icon('next')}</a></p>
          </li>`).join('\n          ');
}

export function sitemap(site: string, slugs: string[], date: string): string {
  const u = (p: string) => `  <url><loc>${esc(new URL(p, site).href)}</loc><lastmod>${date}</lastmod></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[u(''), ...slugs.map(s => u(`family/${s}`)), u('credits.html')].join('\n')}\n</urlset>\n`;
}
export const robots = (site: string, noindex: boolean): string => noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', site).href}\n`;
