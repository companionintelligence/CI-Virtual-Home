// The fine print a surface of the site owes, in one place. Which of claims.json's disclosures each surface carries is the SURFACES table below (the
// `where` of a disclosure in claims.json is prose; this is the same rule as code, and scripts/test-fine-print.mts holds the two to each other). The words are
// never typed here: they are claims.json's, word for word. The Node side (scripts/story/lib/fine-print.mts) reads claims.json itself; the player cannot, so
// it uses CLAIMS_SNAPSHOT below, a mirror of the few fields it needs that `node --experimental-strip-types scripts/story/lib/fine-print.mts --write` rewrites
// and that test-fine-print fails on when it is stale. No imports: the page writers (Node) and the player (browser, behind VIEW_MODE) both load this file.
//
// A new surface gets a row in SURFACES and a call to `finePrintItems(claims, surface, facts)`; the tests then fail when its page leaves one out.

export type Disclosure = { id: string; text: string; required?: boolean };
export type ClaimsDoc = { disclosures: Disclosure[]; allowedClaims?: { id: string; text: string }[] };
export type Item = { id: string; text: string };

/** What a page knows that changes what it owes: a voice-over (synthetic-voice), a named agent (attribution-agents, not-frontier, internet-steps), a logo (names-logos-owners), the tour (the player's About). */
export type Facts = { narration?: boolean; agents?: boolean; logos?: boolean; tour?: boolean };
type Rule = { id: string; when?: keyof Facts };
const r = (id: string, when?: keyof Facts): Rule => ({ id, when });

/**
 * Every surface and the disclosures it prints, in the order it prints them (claims.json `where` in the comment).
 * The lander (index.html) is another package's: its rows say what it must print from this table.
 */
export const SURFACES = {
  /** the first screen of a family's page: the label (the header chip) and the beta line (every page that names any of the three) */
  'family-fold': [r('fictional-family'), r('beta-short')],
  /** "How the Core starts" on a family's page, once an agent is named (internet-steps: "FTUE page", "any scene where Hermes or OpenClaw reaches outside the house") */
  'family-start': [r('internet-steps', 'agents')],
  /** the footer of a family's page (launch-not-offer: footer; beta-full: About or footer, once; scripted-scenes and stylised-art: family page footer; synthetic-voice: near the audio, here too;
   *  names-owners stands with names-logos-owners until the pages say "alternative to"; not-frontier: the honesty clause, with the first agent) */
  'family-footer': [r('launch-not-offer'), r('beta-full'), r('scripted-scenes'), r('stylised-art'), r('synthetic-voice', 'narration'), r('attribution-agents', 'agents'),
    r('not-frontier', 'agents'), r('apps-availability'), r('names-owners'), r('names-logos-owners', 'logos')],
  /** the Core band of a home's own page (beta-short: every page that names any of the three) */
  'home-band': [r('beta-short')],
  /** the footer of a home's own page (launch-not-offer: footer; beta-full: footer, once) */
  'home-footer': [r('launch-not-offer'), r('beta-full')],
  /** the 404 page, which offers Buy Companion Core (launch-not-offer: footer) */
  'not-found': [r('launch-not-offer')],
  /** the player's About panel (launch-not-offer, beta-full, not-frontier: About; the tour adds what a family and its scenes owe) */
  'player-about': [r('launch-not-offer'), r('beta-full'), r('not-frontier'), r('fictional-family', 'tour'), r('scripted-scenes', 'tour'), r('stylised-art', 'tour'),
    r('attribution-agents', 'tour'), r('names-logos-owners', 'tour')],
  /** the card at the end of a shot: it names the Core and offers Buy */
  'player-end': [r('beta-short')],
  /** the tour's start card (assets/story/popup.ts FINE_PRINT is these four, in this order) */
  'tour-start': [r('scripted-scenes'), r('synthetic-voice', 'narration'), r('stylised-art'), r('beta-short')],
  /** THE LANDER (index.html, scripts/portal-front.mts): the hero chip, the Core band with what a Core is not, the footer. Printed by the lander's package from this row. */
  'lander-hero': [r('fictional-family'), r('beta-short')],
  'lander-core': [r('beta-short'), r('not-frontier')],
  'lander-footer': [r('launch-not-offer'), r('beta-full'), r('names-logos-owners')],
} as const satisfies Record<string, readonly Rule[]>;
export type Surface = keyof typeof SURFACES;
export const SURFACE_IDS = Object.keys(SURFACES) as Surface[];

const esc = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The text of one disclosure. Throws when claims.json has none: a renamed id must break the build, not print nothing. */
export function disclosureText(claims: ClaimsDoc, id: string): string {
  const d = claims.disclosures.find(x => x.id === id);
  if (!d) throw new Error(`claims.json has no disclosure ${id}`);
  return d.text;
}

/** The ids a surface owes for these facts, in print order. */
export function owed(surface: Surface, facts: Facts = {}): string[] {
  return (SURFACES[surface] as readonly Rule[]).filter(x => !x.when || facts[x.when]).map(x => x.id);
}

/** The disclosures a surface must carry, from claims.json's words. */
export function finePrintItems(claims: ClaimsDoc, surface: Surface, facts: Facts = {}): Item[] {
  return owed(surface, facts).map(id => ({ id, text: disclosureText(claims, id) }));
}

/** Items as paragraphs (or any element): `data-fine` carries the disclosure's id, so a test, the build and a person with a screen reader's rotor can find each one. */
export function finePrintHtml(items: Item[], o: { tag?: string; cls?: string } = {}): string {
  const tag = o.tag || 'p';
  return items.map(i => `<${tag}${o.cls ? ` class="${esc(o.cls)}"` : ''} data-fine="${esc(i.id)}">${esc(i.text)}</${tag}>`).join('');
}

/** "The small computer on your desk is a Companion Core. Local by default: inference, memory and agents run on your hardware." The second sentence is claims.json's `local-by-default`, verbatim. */
export function coreLine(claims: ClaimsDoc, desk: 'your desk' | 'the desk' = 'your desk'): string {
  const c = (claims.allowedClaims || []).find(x => x.id === 'local-by-default');
  if (!c) throw new Error('claims.json has no allowed claim local-by-default');
  return `The small computer on ${desk} is a Companion Core. ${c.text}`;
}

// BEGIN claims snapshot (generated: node --experimental-strip-types scripts/story/lib/fine-print.mts --write)
export const CLAIMS_SNAPSHOT: ClaimsDoc = {
  "disclosures": [
    {
      "id": "fictional-family",
      "text": "Fictional family. Real software.",
      "required": true
    },
    {
      "id": "scripted-scenes",
      "text": "Scenes are written for this site. They show what the listed apps do. They are not recordings of a real session.",
      "required": true
    },
    {
      "id": "beta-short",
      "text": "Companion OS, Companion Memory and Companion Agents are in beta.",
      "required": true
    },
    {
      "id": "beta-full",
      "text": "Companion OS, Companion Agents and Companion Memory are in beta. They run on units in the field today. Some of what we want them to do is not built yet. We will tell you which is which in the updates rather than in the marketing. Companion Hub is shipping.",
      "required": true
    },
    {
      "id": "not-frontier",
      "text": "A Core runs capable open models, not the largest frontier models. If you need the best model in the world this month, a subscription buys that.",
      "required": true
    },
    {
      "id": "internet-steps",
      "text": "Some steps use the internet: installing apps from the Companion Hub store, and any website or messaging service your agent talks to.",
      "required": true
    },
    {
      "id": "launch-not-offer",
      "text": "Companion Core launches on Kickstarter in October 2026. This site is not an offer for sale. Campaign terms are on the campaign page.",
      "required": true
    },
    {
      "id": "stylised-art",
      "text": "The Companion Core is drawn as a stylised illustration, not a photograph.",
      "required": true
    },
    {
      "id": "synthetic-voice",
      "text": "Narration is generated locally with an open text-to-speech model. It is not a recording of a person.",
      "required": true
    },
    {
      "id": "names-owners",
      "text": "Product names belong to their owners. They are used to say what each app replaces. No endorsement is implied.",
      "required": true
    },
    {
      "id": "names-logos-owners",
      "text": "Product names, logos and brands are the property of their owners. Naming them does not imply endorsement.",
      "required": true
    },
    {
      "id": "attribution-agents",
      "text": "Hermes is from Nous Research. OpenClaw is from the OpenClaw Foundation. Companion Hub packages both.",
      "required": true
    },
    {
      "id": "apps-availability",
      "text": "Apps shown are in the Companion Hub store at the time of writing. Availability can change.",
      "required": true
    },
    {
      "id": "third-party-apps",
      "text": "The other apps in these stories are made by other people, most of them open-source projects. Companion Intelligence did not make them.",
      "required": true
    },
    {
      "id": "site-practises",
      "text": "This site makes no third-party requests, sets no cookies and runs no analytics."
    }
  ],
  "allowedClaims": [
    {
      "id": "local-by-default",
      "text": "Local by default: inference, memory and agents run on your hardware."
    }
  ]
};
// END claims snapshot
