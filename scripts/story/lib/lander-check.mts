// What the BUILT front page must hold (reference/story/lander.md, "Checks"). Pure over the page's HTML, so scripts/build-portal.mts (step 7) and
// scripts/test-lander-page.mts run the same rules on the real page and on a fixture with each rule broken. The browser's checks (the fold, the filters, the
// campaign tags) are scripts/story/portal-tests/lander.mts.
import type { LanderData, ClaimsLite } from './lander.mts';
import type { AppLite, ServiceLite } from './pairs.mts';
import { pairLine } from './pairs.mts';

export const decode = (s: string): string => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const text = (html: string): string => decode(html.replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
/** The blocks of `main`, in order, by the marker each has. */
const BLOCKS: [string, RegExp][] = [
  ['hero', /<section class="hero"/], ['argument', /<section class="argument" id="argument"/], ['proof', /<section class="proof" id="proof"/],
  ['core', /<section class="cta-band(?: has-fig)?" id="core"/], ['swap', /<section class="swap" id="swap"/], ['homes', /<section class="homes" id="homes"/],
];
export const slice = (g: string, from: RegExp, to: RegExp | null): string => {
  const a = g.search(from);
  if (a < 0) return '';
  const rest = g.slice(a + 1), b = to ? rest.search(to) : -1;
  return b < 0 ? g.slice(a) : g.slice(a, a + 1 + b);
};

export interface LanderCheckCtx {
  data: LanderData; claims: ClaimsLite; services: readonly ServiceLite[]; apps: readonly AppLite[];
  links: { site: string; core: string; download: string; docs: string };
  /** the fine-print helper's check: the disclosures a surface owes that the html lacks */
  missingFine: (html: string, surface: 'lander-hero' | 'lander-core' | 'lander-footer') => string[];
}

/** Every complaint about a built front page; empty when it holds. */
export function landerChecks(g: string, c: LanderCheckCtx): string[] {
  const out: string[] = [];
  const bad = (m: string): void => { out.push(`index.html: ${m}`); };

  // one h1, which is the plan's first message, which is a claim
  const h1s = [...g.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  const msg = Object.values(c.data.messages)[0];
  if (h1s.length !== 1) bad(`${h1s.length} h1 elements (one)`);
  else if (msg && text(h1s[0][1]) !== msg.text) bad(`the h1 is "${text(h1s[0][1])}", not the claim ${msg.claim} ("${msg.text}")`);
  if (!msg) bad('the plan has no first message (the h1)');

  // the order of the blocks: hero, argument, proof (when there is one), the Core, the chooser, the families, then the footer
  const at = BLOCKS.map(([id, re]) => [id, g.search(re)] as const);
  const want = BLOCKS.map(([id]) => id).filter((id) => id !== 'proof' || c.data.proof);
  const have = at.filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  if (have.join() !== want.join()) bad(`the blocks are ${have.join(', ')}; they must be ${want.join(', ')}, in that order`);
  if (g.indexOf('<footer') < g.search(/<section class="homes"/)) bad('the footer comes before the families');

  // a claim is the claim, a disclosure is the disclosure
  const claim = new Map(c.claims.allowedClaims.map((x) => [x.id, x.text]));
  const disc = new Map(c.claims.disclosures.map((x) => [x.id, x.text]));
  for (const m of g.matchAll(/<(\w+)\b[^>]*\bdata-claim="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    if (!claim.has(m[2])) bad(`data-claim="${m[2]}" names no claim in claims.json`);
    else if (text(m[3]) !== claim.get(m[2])) bad(`data-claim="${m[2]}" says "${text(m[3])}", not the claim's "${claim.get(m[2])}"`);
  }
  for (const m of g.matchAll(/<(\w+)\b[^>]*\bdata-fine="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    if (!disc.has(m[2])) bad(`data-fine="${m[2]}" names no disclosure in claims.json`);
    else if (text(m[3]) !== disc.get(m[2])) bad(`data-fine="${m[2]}" says "${text(m[3])}", not the disclosure's`);
  }
  const hero = slice(g, /<section class="hero"/, /<section class="argument"/), core = slice(g, /<section class="cta-band(?: has-fig)?" id="core"/, /<section class="swap"/), foot = g.slice(g.indexOf('<footer'));
  for (const [surface, html] of [['lander-hero', hero], ['lander-core', core], ['lander-footer', foot]] as const) for (const id of c.missingFine(html, surface)) bad(`${surface}: the ${id} line is missing from its block`);

  // say it once: three offers, none in the argument, the proof, the chooser or the families
  const n = (url: string): number => g.split(`href="${url}"`).length - 1;
  if (n(c.links.core) !== 3) bad(`${n(c.links.core)} links to ${c.links.core} (the header, the band and the footer: three)`);
  if (n(c.links.download) !== 3) bad(`${n(c.links.download)} links to ${c.links.download} (three)`);
  if (n(c.links.docs) !== 3) bad(`${n(c.links.docs)} links to the docs (the header, the band and the footer: three)`);
  if (n(c.links.site) !== 2) bad(`${n(c.links.site)} links to ${c.links.site} (the brand and the footer: two)`);
  for (const [id, re, to] of [['hero', /<section class="hero"/, /<section class="argument"/], ['argument', /<section class="argument"/, /<section class="proof"|<section class="cta-band/], ['proof', /<section class="proof"/, /<section class="cta-band/],
    ['swap', /<section class="swap"/, /<section class="homes"/], ['homes', /<section class="homes"/, /<footer/]] as [string, RegExp, RegExp][]) {
    const block = slice(g, re, to);
    for (const url of [c.links.site, c.links.core, c.links.download, c.links.docs]) if (block.includes(`href="${url}"`)) bad(`the ${id} block links ${url} (Buy, Download and the docs are in the header, the band and the footer only)`);
  }
  const hs = hero.match(/<a\b[^>]*\bbtn\b[^>]*>/g) || [];
  if (hs.length !== 1) bad(`the hero has ${hs.length} buttons (the tour is the one action)`);

  // no logo, screenshot or count of apps; "alternative to", never "replaces"; no digit beside a service
  if (/<img\b[^>]*src="[^"]*portal\/(apps|ci)\//.test(g)) bad('an image from portal/apps or portal/ci (the front page names apps in text only)');
  if (/\bdata-stat=/.test(g)) bad('a data-stat figure (counts are words)');
  const visible = text(g.slice(g.indexOf('<body')));
  if (/\breplace[sd]?\b/i.test(visible)) bad('the word "replaces" is on the page (the pair wording is "alternative to")');
  for (const m of g.matchAll(/<button\b[^>]*class="(?:pair|tag persona)[^"]*"[^>]*>([\s\S]*?)<\/button>/g)) if (/\d/.test(text(m[1]))) bad(`a chip shows a digit: "${text(m[1])}"`);
  const count = (g.match(/id="homes-count">([\s\S]*?)<\/p>/) || [])[1] || '';
  if (text(count) !== c.data.count) bad(`the count line is "${text(count)}", the data says "${c.data.count}"`);

  // nothing held is on the page as a pair (the card lines, the proof, the chips, the search words)
  const svc = new Map(c.services.map((s) => [s.id, s])), app = new Map(c.apps.map((a) => [a.id, a]));
  for (const h of c.data.plan.hold) {
    const [s, a] = h.split('|');
    if (svc.has(s) && app.has(a) && visible.includes(pairLine({ service: svc.get(s)!, app: app.get(a)! }))) bad(`the held pair "${pairLine({ service: svc.get(s)!, app: app.get(a)! })}" is on the page`);
    for (const m of g.matchAll(/\bdata-find="([^"]*)"/g)) if (decode(m[1]).includes(`${(app.get(a)?.name || a).toLowerCase()} `) && new RegExp(`\\b${(svc.get(s)?.name || s).toLowerCase()}\\b`).test(decode(m[1])) && !c.data.index.shown.some((p) => p.service.id === s && p.app.id === a)) bad(`a card's search words carry the held pair ${h}`);
  }

  // the featured cards are the plan's, and the proof is the data's
  const featured = [...g.matchAll(/<li class="card card-family is-featured" data-id="[^"]+" data-slug="([^"]+)"/g)].map((m) => m[1]);
  if (featured.join() !== c.data.featured.slugs.join()) bad(`the featured cards are ${featured.join(', ')}; the plan chose ${c.data.featured.slugs.join(', ')}`);
  if (c.data.proof) {
    const p = (g.match(/<section class="proof" id="proof"[^>]*data-beat="([^"]+)"/) || [])[1];
    if (p !== c.data.proof.beat) bad(`the proof block is the beat ${p}, the data chose ${c.data.proof.beat}`);
    if (!new RegExp(`data-cta="tour-proof" data-campaign href="[^"]*&amp;beat=${c.data.proof.beat}"`).test(g)) bad('the proof\'s "Watch this moment" does not carry &beat=<id> and data-campaign');
  } else if (/<section class="proof"/.test(g)) bad('a proof block with no proof in the data');
  const chips = [...g.matchAll(/<button\b[^>]*class="pair"/g)].length;
  if (chips !== c.data.strip.length) bad(`${chips} service chips; the strip has ${c.data.strip.length}`);
  return out;
}

/** The pieces of the head the lander owes: a description a search result keeps whole, and a title that carries the message and the Core. */
export function landerHeadChecks(g: string, msgText: string): string[] {
  const out: string[] = [];
  const title = decode((g.match(/<title>([^<]*)<\/title>/) || [])[1] || ''), desc = decode((g.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '');
  if (!title.includes(msgText.replace(/\.$/, ''))) out.push(`index.html: the title "${title}" does not carry the message "${msgText}"`);
  if (!/Companion Core/.test(title)) out.push(`index.html: the title "${title}" does not name the Companion Core`);
  if (desc.length < 120 || desc.length > 160) out.push(`index.html: the description is ${desc.length} characters; a search result keeps 120 to 160`);
  if (!desc.includes('Fictional family. Real software.')) out.push('index.html: the description does not carry "Fictional family. Real software."');
  if (/\d/.test(desc)) out.push('index.html: a digit in the description (counts are words)');
  return out;
}
