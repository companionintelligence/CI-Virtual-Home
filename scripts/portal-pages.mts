// The pages scripts/build-portal.mts writes itself (a home's own page, the 404, the gallery's static list of homes) and the
// pieces they share with the hand-written index.html: where the site sends a visitor, the structured data, the number written out.
// Pure functions of index.json and the site's address, so a rebuild is byte-identical.
import { displayName, buildCredit } from '../assets/home-names.js';

// Where this site sends a visitor. Exactly these addresses, on every page and in the player (assets/viewer.ts has the same
// four): /core redirects to the product page and is still the address to link; the docs have no page for the virtual homes
// yet, so "Docs" is the first-party apps overview (docs.ci.computer/docs itself answers 404). portal:build checks the built
// pages for each of them.
export const LINKS = {
  site: 'https://ci.computer',
  core: 'https://ci.computer/core',
  download: 'https://ci.computer/download',
  docs: 'https://docs.ci.computer/docs/apps-available/first-party-apps',
  privacy: 'https://ci.computer/privacy-policy',
  terms: 'https://ci.computer/terms-of-service',
} as const;
// the profiles ci.computer itself links
const SAME_AS = ['https://www.linkedin.com/company/companionintelligence/', 'https://x.com/companionintel', 'https://www.youtube.com/@companionintelligence', 'https://www.instagram.com/companionintelligence/'];
export const TWITTER_SITE = '@companionintel';
export const SITE_NAME = 'Companion Intelligence';
export const SITE_TITLE = 'Virtual homes · Companion Intelligence';
export const PLAYER_TITLE = 'Virtual homes player · Companion Intelligence';

export type House = { id: string; name?: string; author?: string; style?: string; storeys?: number; areaSqm?: number; source?: string };

export const esc = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const nf = new Intl.NumberFormat('en');

// the first clause of the spec's style paragraph (gallery.js shortStyle)
export const shortStyle = (s?: string): string => (s || '').split(/[:;,(]| with | over | under /)[0].trim();

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
// 30 → "thirty": the copy says "thirty homes" in words; this is what the data's count reads as, so a page that still says
// "thirty" after the collection changes is found by the build (build-portal.mts checks index.html's hand-written copy)
export function numberWord(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
}
export const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// a link-preview description fits a search result: one sentence on the style, one on what the page does, under 160 characters.
// The Sims build's own title and its builder are credited in the page's body, not here.
export function homeDescription(h: House): string {
  const tail = 'Built live in 3D in your browser: fly its camera paths and change the hour.';
  let style = shortStyle(h.style);
  const room = 155 - tail.length - 2;
  if (style.length > room) style = `${style.slice(0, room - 1).replace(/\s+\S*$/, '')}…`;
  return `${style ? `${style}. ` : ''}${tail}`;
}
export const homeTitle = (h: House): string => `${displayName(h)} · Virtual homes · ${SITE_NAME}`;

export const homeUrl = (site: string, id: string): string => new URL(`homes/${id}`, site).href;

// ---- structured data. Escaped so that no "<" can close the script tag.
const ldScript = (graph: object[]): string => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;
const orgLd = (site: string): object => ({ '@type': 'Organization', '@id': `${site}#organization`, name: SITE_NAME, url: LINKS.site, logo: new URL('portal/icons/icon-512.png', site).href, sameAs: SAME_AS });
const siteLd = (site: string): object => ({ '@type': 'WebSite', '@id': `${site}#website`, name: 'Virtual homes', url: site, inLanguage: 'en', publisher: { '@id': `${site}#organization` } });
// the gallery: the site, its publisher and the list of homes
export function galleryLd(site: string, houses: House[], title: string, desc: string): string {
  return ldScript([orgLd(site), siteLd(site), {
    '@type': 'CollectionPage', '@id': `${site}#collection`, url: site, name: title, description: desc, isPartOf: { '@id': `${site}#website` },
    mainEntity: { '@type': 'ItemList', numberOfItems: houses.length, itemListElement: houses.map((h, i) => ({ '@type': 'ListItem', position: i + 1, url: homeUrl(site, h.id), name: displayName(h) })) },
  }]);
}
// a home's page: the site, its publisher, the page with its picture, and where it sits
export function homeLd(site: string, h: House, image: string, title: string, desc: string): string {
  const url = homeUrl(site, h.id);
  return ldScript([orgLd(site), siteLd(site), {
    '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description: desc, inLanguage: 'en', isPartOf: { '@id': `${site}#website` },
    primaryImageOfPage: { '@type': 'ImageObject', url: image, width: 1200, height: 630 }, breadcrumb: { '@id': `${url}#breadcrumb` },
  }, {
    '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Virtual homes', item: site }, { '@type': 'ListItem', position: 2, name: displayName(h), item: url }],
  }]);
}
// the player's address and the editor's: the publisher alone (a home's page is where its entry is)
export const playerLd = (site: string): string => ldScript([orgLd(site), siteLd(site)]);

// ---- the gallery's list of homes, written into index.html so a visitor without JavaScript, and a crawler that does not run it,
// see the homes and can follow each to its page. portal/gallery.js replaces them with the same cards, whose links go straight to
// the player (same markup as its card(): a swap that does not move anything).
export function galleryCards(houses: House[]): string {
  return houses.map((h, i) => {
    const name = displayName(h), storeys = h.storeys || 1;
    const tip = [buildCredit(h), h.source].filter(Boolean).join(', ');
    return `<li class="card" data-id="${esc(h.id)}"><a href="./homes/${esc(encodeURIComponent(h.id))}" aria-label="${esc(`${name}. ${shortStyle(h.style)}. Open its page`)}">`
      + `<div class="thumb"><img src="./portal/thumbs/${esc(encodeURIComponent(h.id))}.webp" alt="" width="640" height="360" decoding="async"${i > 5 ? ' loading="lazy"' : ''}>`
      + `<span class="thumb-play"><svg class="i i-fill"><use href="#i-play"/></svg>Play in 3D</span></div>`
      + `<div class="card-body"><h3>${esc(name)}</h3><p class="style" title="${esc(h.style || '')}">${esc(shortStyle(h.style))}</p>`
      + `<p class="facts"><span class="fact">${storeys} ${storeys === 1 ? 'storey' : 'storeys'}</span>${h.areaSqm ? `<span class="fact">${nf.format(h.areaSqm)} m²</span>` : ''}`
      + `<span class="credit" title="${esc(tip)}">${h.author ? `by <b>${esc(h.author)}</b>` : ''}</span></p></div></a></li>`;
  }).join('\n        ');
}

// ---- a home's own page: homes/<id>.html, served at homes/<id>. A page of its own for a search engine and a person (name, what
// it is, its picture, a way in), and the address the player's share button hands out: a link that carries a moment (shot, t,
// tod) forwards to the player with it, so a shared moment still opens in the player.
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <symbol id="i-play" viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"/></symbol>
    <symbol id="i-box" viewBox="0 0 24 24"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></symbol>
  </defs></svg>`;

// the header and footer of the pages in homes/, which sit one level down (../ reaches the site's root)
const header = (): string => `<header class="site-head">
    <div class="brand">
      <a class="brand-ci" href="${LINKS.site}" aria-label="${SITE_NAME}"><img src="../assets/brand/ci-logo-mark.svg" alt="" width="28" height="28"><span>${SITE_NAME}</span></a>
      <span class="brand-sep" aria-hidden="true">/</span>
      <a class="brand-title" href="../">Virtual homes</a>
    </div>
    <nav class="site-nav" aria-label="Site">
      <a class="nav-homes" href="../#homes">Homes</a>
      <a class="nav-docs" href="${LINKS.docs}">Docs</a>
      <a class="nav-download" href="${LINKS.download}">Download Companion</a>
      <a class="nav-buy" href="${LINKS.core}"><span class="nav-long">Buy Companion Core</span><span class="nav-short">Buy Core</span></a>
    </nav>
  </header>`;
const ctaBand = (): string => `<section class="cta-band" aria-labelledby="cta-title">
      <div class="cta-copy">
        <h2 id="cta-title">Meet the Companion Core.</h2>
        <p>The small computer on your desk runs your own AI, apps and memory at home, not in someone else's cloud.</p>
      </div>
      <div class="cta-actions">
        <a class="btn btn-buy" href="${LINKS.core}">Buy Companion Core</a>
        <a class="btn btn-ghost" href="${LINKS.download}">Download Companion</a>
        <a class="cta-docs" href="${LINKS.docs}">Read the docs</a>
      </div>
    </section>`;
const footer = (): string => `<footer class="site-foot">
    <div class="foot-grid">
      <div>
        <p class="foot-brand"><a href="${LINKS.site}"><img src="../assets/brand/ci-logo-mark.svg" alt="" width="20" height="20"><b>${SITE_NAME}</b></a></p>
        <p>Every frame is drawn on your device, with three.js and WebGL. Nothing is streamed: your browser builds each home from its spec.</p>
      </div>
      <nav class="foot-links" aria-label="${SITE_NAME}">
        <p><b>${SITE_NAME}</b></p>
        <ul>
          <li><a href="${LINKS.site}">ci.computer</a></li>
          <li><a href="${LINKS.core}">Buy Companion Core</a></li>
          <li><a href="${LINKS.download}">Download Companion</a></li>
          <li><a href="${LINKS.docs}">Docs</a></li>
          <li><a href="${LINKS.privacy}">Privacy</a></li>
          <li><a href="${LINKS.terms}">Terms</a></li>
        </ul>
      </nav>
      <div>
        <p><b>Credits</b></p>
        <p>Each home is a HouseSpec written by hand from a Sims 4 gallery build, and each card names its builder. No files, textures or screenshots from those builds or from The Sims are used.</p>
      </div>
    </div>
    <p class="legal">© 2026 LifeScope Inc., DBA Companion Intelligence. <a href="${LINKS.site}">ci.computer</a></p>
  </footer>`;

export function homePage(h: House, site: string): string {
  const id = h.id, name = displayName(h), title = homeTitle(h), desc = homeDescription(h);
  const image = new URL(`portal/previews/${id}.jpg`, site).href;
  const player = `../room-creator?mode=view&house=${id}`;
  const storeys = h.storeys || 1;
  const credit = buildCredit(h);
  const alt = `An aerial view of ${name}, rendered in the browser.`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE_NAME)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(alt)}">
  <meta property="og:url" content="${esc(homeUrl(site, id))}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${TWITTER_SITE}">
  <meta name="twitter:image:alt" content="${esc(alt)}">
  <meta name="theme-color" content="#f3faf7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#041620" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="../assets/brand/ci-logo-mark.svg" type="image/svg+xml">
  <link rel="icon" href="../portal/icons/favicon.ico" sizes="48x48">
  <link rel="apple-touch-icon" href="../portal/icons/apple-touch-icon.png">
  <link rel="manifest" href="../portal/site.webmanifest">
  <link rel="stylesheet" href="../portal/gallery.css">
  <!-- a shared moment (the player's share button adds shot, t and tod) opens in the player; the page itself is for everyone else.
       data-cfasync="false": Cloudflare's Rocket Loader would otherwise run this late, after the page had painted -->
  <script data-cfasync="false">if (/[?&](shot|t|tod|play)=/.test(location.search)) location.replace(${JSON.stringify(player)} + '&' + location.search.slice(1) + location.hash);</script>
</head>
<body>
  ${SPRITE}
  <a class="skip" href="#main">Skip to the home</a>
  ${header()}

  <main id="main" class="home-page">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="../">Virtual homes</a></li><li><span aria-current="page">${esc(name)}</span></li></ol></nav>
    <section class="hero" aria-labelledby="home-title">
      <div class="hero-copy">
        <p class="eyebrow">Virtual home</p>
        <h1 id="home-title">${esc(name)}</h1>
        ${h.style ? `<p class="lede">${esc(/[.!?]$/.test(h.style) ? h.style : `${h.style}.`)}</p>` : ''}
        <ul class="home-facts" aria-label="Facts">
          <li class="fact">${storeys} ${storeys === 1 ? 'storey' : 'storeys'}</li>${h.areaSqm ? `\n          <li class="fact">${nf.format(h.areaSqm)} m²</li>` : ''}
        </ul>
        <div class="hero-cta">
          <a class="btn btn-primary" href="${esc(player)}"><svg class="i i-fill" aria-hidden="true"><use href="#i-play"/></svg><span>Open ${esc(name)} in 3D</span></a>
          <a class="btn btn-ghost" href="../#homes"><span>All homes</span></a>
        </div>
        <p class="home-credit">Built live in your browser from one spec file${credit ? `. Credit: ${esc(credit)}` : ''}. No files, textures or screenshots from that build or from The Sims are used.</p>
      </div>
      <a class="hero-media" href="${esc(player)}" aria-label="Open ${esc(name)} in 3D">
        <img src="../portal/previews/${esc(id)}.jpg" alt="${esc(alt)}" width="1200" height="630" fetchpriority="high">
        <span class="hero-badge"><svg class="i" aria-hidden="true"><use href="#i-box"/></svg>Interactive 3D</span>
        <span class="hero-play" aria-hidden="true"><svg class="i i-fill"><use href="#i-play"/></svg></span>
      </a>
    </section>

    ${ctaBand()}
  </main>

  ${footer()}
</body>
</html>
`;
}

// ---- 404.html: Pages answers an unknown path with it and a 404 status (without one it answers 200 with the gallery). It is served at any
// depth, so it is self-contained: inline style (the canon's two token sets, as the gallery's), no relative URL, absolute links out.
export function notFoundPage(site: string, word: string): string {
  const desc = `That page does not exist. The virtual homes gallery has all ${word} homes, each built live in your browser.`;
  const title = `Page not found · ${SITE_NAME}`;
  const hero = new URL('portal/hero.jpg', site).href;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="noindex">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE_NAME)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(hero)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${TWITTER_SITE}">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(hero)}">
  <meta name="theme-color" content="#f3faf7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#041620" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="${esc(new URL('assets/brand/ci-logo-mark.svg', site).href)}" type="image/svg+xml">
  <style>
    :root { color-scheme: light dark; --bg: #f3faf7; --fg: #0a222e; --muted: #3a524b; --primary: #0a6358; --on-primary: #f0fdf4; --line: rgba(10, 34, 46, 0.14); }
    @media (prefers-color-scheme: dark) { :root { --bg: #041620; --fg: #e8f2f4; --muted: #a3babf; --primary: #c5e8dc; --on-primary: #041620; --line: rgba(232, 242, 244, 0.18); } }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; background: var(--bg); color: var(--fg);
      font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; }
    main { display: grid; gap: 12px; justify-items: center; max-width: 42em; text-align: center; }
    h1 { margin: 0; font-size: 28px; }
    p { margin: 0; color: var(--muted); }
    a { color: var(--primary); font-weight: 600; text-underline-offset: 3px; }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 8px; }
    .btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 20px; border-radius: 999px; text-decoration: none; font-weight: 700;
      background: var(--primary); color: var(--on-primary); }
    .btn.ghost { background: transparent; color: var(--fg); box-shadow: inset 0 0 0 1px var(--line); }
    .more { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; margin-top: 8px; font-size: 14px; }
    a:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 6px; }
  </style>
</head>
<body>
  <main>
    <h1>Page not found</h1>
    <p>${esc(desc)}</p>
    <div class="actions">
      <a class="btn" href="${esc(site)}">See the virtual homes</a>
      <a class="btn ghost" href="${LINKS.core}">Buy Companion Core</a>
      <a class="btn ghost" href="${LINKS.download}">Download Companion</a>
    </div>
    <p class="more"><a href="${LINKS.site}">${SITE_NAME}</a> <a href="${LINKS.docs}">Docs</a></p>
  </main>
</body>
</html>
`;
}
