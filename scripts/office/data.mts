// What the /office page draws, as data: a card for each company, read from the fixtures (test/fixtures/site/offices/<slug>.json, schema "office-card/v0") and held to the same
// registries and rules as a company's story (reference/office/office-contract-m0.md): the pairs are the store's own and never the plan's held ones, the name is not a stock example
// or a service, every string passes the claims' banned phrases. In M1 a card is derived from the company's story, the casting and the building; the card's shape stays.
//
//   const { cards, problems } = loadCards(ROOT);          // sorted startups first, then small, then medium; problems is empty when every card is sound
import fs from 'node:fs';
import path from 'node:path';
import { loadCompanyContext, type CoCtx } from '../story/lib/co/context.mts';
import { heldPairs, lintStrings, nameProblems, pairProblems } from '../story/lib/co/validate.mts';
import { COLOURS, FLOOR_MAX, FUNCTIONS, SCOPES, SIZES, SIZE_BANDS, type Fn, type Scope, type Size } from '../story/lib/co/consts.mts';
import { checkSchema } from '../story/lib/schema-lite.mts';
import { numberWord, capital } from '../portal-pages.mts';

export const CARD_SCHEMA = 'office-card/v0';
export const SIZE_LABELS: Record<Size, string> = { startup: 'Startup', small: 'Small business', medium: 'Medium business' };
/** a card shows this many people and this many pairs; the company's page shows them all */
export const CARD_LIMITS = { people: 6, pairs: 4 } as const;

export interface CardPerson { id: string; name: string; function: Fn; title: string; colour: string; ownsCore: boolean }
export interface CardFixture {
  schema: typeof CARD_SCHEMA; note?: string; slug: string; name: string; tagline: string; sector: string; size: Size; scope: Scope; headcount: number; floor: number;
  address: { line: string; place: string }; building: { kind: string; concept: string }; story: string; people: CardPerson[]; pairs: { app: string; service: string }[]; limits: string[];
}
export interface CardPair { app: { id: string; name: string }; service: { id: string; name: string }; /** "<App>, alternative to <Service>" */ line: string }
export interface Card extends CardFixture {
  place: string; sizeLabel: string; scopeLine: string;
  /** the function ids some person of the company has, in the order of FUNCTIONS */
  functionIds: string[];
  pairList: CardPair[];
  /** what the search finds the card by: lower case, one line */
  find: string;
}

const nameWords = (n: number): string => (n < 100 ? numberWord(n) : n < 200 ? `a hundred${n % 100 ? ` and ${numberWord(n % 100)}` : ''}` : `two hundred${n % 100 ? ` and ${numberWord(n % 100)}` : ''}`);
/** The line under a card's name: how many people, and where. Counts are words, never digits. */
export function scopeLineOf(c: Pick<CardFixture, 'scope' | 'headcount' | 'floor'>): string {
  if (c.scope === 'site') return `One site of a firm of about ${nameWords(c.headcount)}`;
  if (c.scope === 'department') return `One department of a firm of about ${nameWords(c.headcount)}`;
  return c.floor === c.headcount ? `About ${nameWords(c.headcount)} people, all in this office` : `About ${nameWords(c.headcount)} people, ${nameWords(c.floor)} of them in this office`;
}

const sizeRank = (s: string): number => SIZES.indexOf(s as Size);

/** The problems of one fixture; empty when it is sound. */
export function cardProblems(f: CardFixture, ctx: CoCtx, held: Set<string> = heldPairs(ctx.root)): string[] {
  const out: string[] = [];
  const at = f && typeof f === 'object' && typeof f.slug === 'string' ? f.slug : '(no slug)';
  const P = (m: string): void => { out.push(`${at}: ${m}`); };
  if (!f || typeof f !== 'object') return [`${at}: not an object`];
  if (f.schema !== CARD_SCHEMA) P(`schema is ${JSON.stringify(f.schema)}, not "${CARD_SCHEMA}"`);
  const need = (k: string, v: unknown, lo: number, hi: number): void => { if (typeof v !== 'string' || v.length < lo || v.length > hi) P(`${k} must be a string of ${lo} to ${hi} characters`); };
  if (typeof f.slug !== 'string' || !/^[a-z]+(-[a-z]+){0,2}$/.test(f.slug) || f.slug.length > 32) P('slug must be lower case words joined by hyphens (at most three)');
  for (const m of checkSchema(f.name, ctx.schema.$defs.company.properties.name)) P(`name ${m}`);
  need('tagline', f.tagline, 20, 80); need('sector', f.sector, 8, 48); need('story', f.story, 80, 320);
  if (typeof f.tagline === 'string' && !/[.]$/.test(f.tagline)) P('tagline ends with a full stop');
  if (!SIZES.includes(f.size)) P(`size ${JSON.stringify(f.size)} (${SIZES.join(', ')})`);
  if (!SCOPES.includes(f.scope)) P(`scope ${JSON.stringify(f.scope)} (${SCOPES.join(', ')})`);
  if (SIZES.includes(f.size)) {
    const band = SIZE_BANDS[f.size];
    if (!(f.headcount >= band.headcount[0] && f.headcount <= band.headcount[1])) P(`a ${f.size} company is told for ${band.headcount[0]} to ${band.headcount[1]} people, not ${f.headcount}`);
    if (!band.scopes.includes(f.scope)) P(`a ${f.size} business is told as ${band.scopes.join(' or ')}, not "${f.scope}"`);
  }
  if (!Number.isInteger(f.floor) || f.floor < 3 || f.floor > FLOOR_MAX || f.floor > f.headcount) P(`floor ${f.floor} (3 to ${FLOOR_MAX}, and at most the head count ${f.headcount})`);
  for (const m of checkSchema(f.address, ctx.schema.$defs.company.properties.address)) P(`address ${m}`);
  if (!f.building || typeof f.building.kind !== 'string' || !f.building.kind || typeof f.building.concept !== 'string' || !f.building.concept) P('building needs a kind and a concept');
  // the people
  if (!Array.isArray(f.people) || f.people.length < 3 || f.people.length > 8) P('3 to 8 people');
  else {
    const ids = new Set<string>(), names = new Set<string>();
    for (const p of f.people) {
      if (!/^[a-z][a-z0-9-]{1,31}$/.test(p.id) || ids.has(p.id)) P(`person id ${JSON.stringify(p.id)} is not a unique id`);
      ids.add(p.id);
      if (!/^[A-Z][a-zA-Z'’]{1,19}$/.test(p.name) || names.has(p.name.toLowerCase())) P(`person name ${JSON.stringify(p.name)} is not a unique first name`);
      names.add(String(p.name).toLowerCase());
      if (!FUNCTIONS.includes(p.function)) P(`${p.name}: function ${JSON.stringify(p.function)}`);
      if (typeof p.title !== 'string' || p.title.length < 3 || p.title.length > 40) P(`${p.name}: title of 3 to 40 characters`);
      if (!(COLOURS as readonly string[]).includes(p.colour)) P(`${p.name}: colour ${JSON.stringify(p.colour)}`);
      if (typeof p.ownsCore !== 'boolean') P(`${p.name}: ownsCore is true or false`);
    }
    if (f.people.filter((p) => p.ownsCore).length !== 1) P('exactly one person owns the Core');
    if (f.people.length > f.floor) P(`${f.people.length} featured people on a floor of ${f.floor}`);
  }
  // the pairs: the store's own, never a held one, each once
  if (!Array.isArray(f.pairs) || f.pairs.length < 1 || f.pairs.length > 8) P('1 to 8 pairs');
  else {
    const seen = new Set<string>();
    for (const pr of f.pairs) {
      const key = `${pr.service}|${pr.app}`;
      if (seen.has(key)) P(`the pair ${key} is listed twice`);
      seen.add(key);
      for (const m of pairProblems(pr.app, pr.service, ctx, held)) P(`pair ${pr.app} / ${pr.service}: ${m}`);
    }
  }
  if (!Array.isArray(f.limits) || f.limits.length < 1 || f.limits.length > 4 || f.limits.some((l) => typeof l !== 'string' || l.length < 12 || l.length > 160)) P('1 to 4 limits of 12 to 160 characters');
  for (const m of nameProblems(String(f.name), String(f.slug), ctx)) P(m);
  // every string a visitor reads of the card
  const strings: [string, string][] = [['name', f.name], ['tagline', f.tagline], ['sector', f.sector], ['story', f.story], ['address', `${f.address?.line}, ${f.address?.place}`], ['building', `${f.building?.kind}. ${f.building?.concept}`]];
  for (const p of f.people ?? []) strings.push([`${p.id}.name`, p.name], [`${p.id}.title`, p.title]);
  (f.limits ?? []).forEach((l, i) => strings.push([`limit${i}`, l]));
  for (const h of lintStrings(strings, ctx)) if (h.severity !== 'warn') P(`${h.at}: ${h.message} [${h.rule}]`);
  return out;
}

/** The fixtures of a folder, parsed. */
export function readFixtures(dir: string): CardFixture[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[a-z][a-z-]*\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) : [];
}

/** A card for each sound fixture, startups first, then small, then medium (by name within a size); the problems of every fixture that is not. */
export function loadCards(root: string, dir: string = path.join(root, 'test', 'fixtures', 'site', 'offices'), ctx: CoCtx = loadCompanyContext(root)): { cards: Card[]; problems: string[] } {
  const held = heldPairs(root), problems: string[] = [], cards: Card[] = [];
  const fx = readFixtures(dir);
  const slugs = new Set<string>(), dupes = fx.map((f) => f.slug).filter((s) => (slugs.has(s) ? true : (slugs.add(s), false)));
  for (const d of dupes) problems.push(`${d}: two fixtures have this slug`);
  for (const f of fx) {
    const p = cardProblems(f, ctx, held);
    if (p.length) { problems.push(...p); continue; }
    const pairList: CardPair[] = f.pairs.map((pr) => {
      const app = ctx.apps.get(pr.app)!, sv = ctx.services.byId.get(pr.service)!;
      return { app: { id: app.id, name: app.name }, service: { id: sv.id, name: sv.name }, line: `${app.name}, alternative to ${sv.name}` };
    });
    const labels = new Map(ctx.functions.map((x) => [x.id, x.label]));
    const functionIds = FUNCTIONS.filter((id) => f.people.some((p) => p.function === id));
    const find = [f.name, f.sector, f.address.place, f.building.kind, SIZE_LABELS[f.size], ...f.people.flatMap((p) => [p.name, p.title, labels.get(p.function) ?? '']), ...pairList.flatMap((p) => [p.app.name, p.service.name])]
      .join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
    cards.push({ ...f, place: f.address.place, sizeLabel: SIZE_LABELS[f.size], scopeLine: scopeLineOf(f), functionIds, pairList, find });
  }
  cards.sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.name.localeCompare(b.name, 'en'));
  return { cards, problems };
}

/** "Two offices", "One office": the count in words (never a digit), for the page's heading and description. */
export const officesWord = (n: number): string => `${capital(numberWord(n))} ${n === 1 ? 'office' : 'offices'}`;
/** "Two fictional companies." */
export const companiesLine = (n: number): string => `${capital(numberWord(n))} fictional ${n === 1 ? 'company' : 'companies'}.`;
