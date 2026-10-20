#!/usr/bin/env -S node --experimental-strip-types
// The fine print a page owes, for the page writers (scripts/story/pages.mts, scripts/portal-pages.mts) and the lander's. ONE rule table, assets/story/fine-print.ts
// (the player loads that file too); ONE source of words, content/story/claims.json. This file reads claims.json and hands the pair over:
//
//   import { finePrint, finePrintItems, coreLine } from './lib/fine-print.mts';
//   finePrint('family-footer', { agents: true, narration: false })   // -> { items: [{ id, text }], html: '<p data-fine="launch-not-offer">…</p>…' }
//
// The player cannot read claims.json, so assets/story/fine-print.ts carries a mirror of the fields it needs (CLAIMS_SNAPSHOT). Regenerate it after a change to
// claims.json (a disclosure's text, the id of one):
//
//   node --experimental-strip-types scripts/story/lib/fine-print.mts --write      rewrite the snapshot
//   node --experimental-strip-types scripts/story/lib/fine-print.mts --check      fail when it is stale (scripts/test-fine-print.mts does the same)
//
// claims.json is not edited by this: where its wording is stale (launch-not-offer says October) the owner decides, and the pages follow.
import fs from 'node:fs';
import path from 'node:path';
import { CLAIMS_SNAPSHOT, SURFACES, SURFACE_IDS, coreLine as coreLineOf, disclosureText as disclosureTextOf, finePrintHtml, finePrintItems as itemsOf, owed } from '../../../assets/story/fine-print.ts';
import type { ClaimsDoc, Facts, Item, Surface } from '../../../assets/story/fine-print.ts';

export { SURFACES, SURFACE_IDS, finePrintHtml, owed, CLAIMS_SNAPSHOT };
export type { ClaimsDoc, Facts, Item, Surface };

export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const CLAIMS_PATH = path.join(ROOT, 'content', 'story', 'claims.json');
export const MODULE_PATH = path.join(ROOT, 'assets', 'story', 'fine-print.ts');
/** the allowed claims the pages quote (coreLine); the snapshot carries only these */
export const QUOTED_CLAIMS = ['local-by-default'] as const;

let cached: ClaimsDoc | null = null;
/** claims.json, read once per process */
export function loadClaims(): ClaimsDoc {
  return (cached ||= JSON.parse(fs.readFileSync(CLAIMS_PATH, 'utf8')));
}
const claimsOf = (c?: ClaimsDoc): ClaimsDoc => c || loadClaims();

/** The disclosures a surface must carry (claims.json's words). `claims` defaults to the file's own. */
export const finePrintItems = (surface: Surface, facts: Facts = {}, claims?: ClaimsDoc): Item[] => itemsOf(claimsOf(claims), surface, facts);
/** items and their HTML in one call */
export function finePrint(surface: Surface, facts: Facts = {}, claims?: ClaimsDoc, o: { tag?: string; cls?: string } = {}): { items: Item[]; html: string } {
  const items = finePrintItems(surface, facts, claims);
  return { items, html: finePrintHtml(items, o) };
}
export const disclosureText = (id: string, claims?: ClaimsDoc): string => disclosureTextOf(claimsOf(claims), id);
export const coreLine = (desk: 'your desk' | 'the desk' = 'your desk', claims?: ClaimsDoc): string => coreLineOf(claimsOf(claims), desk);

const decode = (t: string): string => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** The readable text of a page or a fragment: no tags, no scripts or styles, entities decoded, white space collapsed. */
export const readableText = (html: string): string => decode(html.replace(/<head[\s\S]*?<\/head>/, ' ').replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
/**
 * The ids a surface owes that a page's text does not carry, word for word (claims.json's text). The check the tests, and a build step that wants one, share:
 * a page that leaves one out names it here.
 */
export function missingFinePrint(html: string, surface: Surface, facts: Facts = {}, claims?: ClaimsDoc): string[] {
  const text = readableText(html);
  return finePrintItems(surface, facts, claims).filter(i => !text.includes(i.text)).map(i => i.id);
}

/** the fields of claims.json the player needs, in the order the file has them */
export function snapshotOf(claims: ClaimsDoc): ClaimsDoc {
  return {
    disclosures: claims.disclosures.map(d => ({ id: d.id, text: d.text, ...(d.required ? { required: true } : {}) })),
    allowedClaims: (claims.allowedClaims || []).filter(a => (QUOTED_CLAIMS as readonly string[]).includes(a.id)).map(a => ({ id: a.id, text: a.text })),
  };
}
const BEGIN = '// BEGIN claims snapshot';
const END = '// END claims snapshot';
const block = (claims: ClaimsDoc): string => `${BEGIN} (generated: node --experimental-strip-types scripts/story/lib/fine-print.mts --write)\nexport const CLAIMS_SNAPSHOT: ClaimsDoc = ${JSON.stringify(snapshotOf(claims), null, 2)};\n${END}`;
/** The module's source with its snapshot block as claims.json says it should be. */
export function renderModule(source: string, claims: ClaimsDoc): string {
  const a = source.indexOf(BEGIN), b = source.indexOf(END);
  if (a < 0 || b < a) throw new Error(`${MODULE_PATH} has no snapshot block`);
  return source.slice(0, a) + block(claims) + source.slice(b + END.length);
}
/** Is the committed snapshot what claims.json says? Returns the problem, or ''. */
export function snapshotProblem(): string {
  const want = JSON.stringify(snapshotOf(loadClaims())), have = JSON.stringify(CLAIMS_SNAPSHOT);
  return want === have ? '' : 'assets/story/fine-print.ts CLAIMS_SNAPSHOT is stale against content/story/claims.json: run node --experimental-strip-types scripts/story/lib/fine-print.mts --write';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (arg === '--write') {
    const src = fs.readFileSync(MODULE_PATH, 'utf8'), next = renderModule(src, loadClaims());
    if (next !== src) { fs.writeFileSync(MODULE_PATH, next); console.log('fine-print: rewrote the claims snapshot in assets/story/fine-print.ts'); } else console.log('fine-print: the claims snapshot is current');
  } else if (arg === '--check') {
    const p = snapshotProblem();
    if (p) { console.error(`  ✗ ${p}`); process.exit(1); }
    console.log('fine-print: the claims snapshot is current');
  } else {
    for (const s of SURFACE_IDS) console.log(`${s.padEnd(14)} ${owed(s, { narration: true, agents: true, logos: true, tour: true }).join(', ')}`);
  }
}
