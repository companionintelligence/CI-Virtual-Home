// App rules: every app a story names is a real Companion Hub store app, is used inside its catalog caveats, and is
// declared, so the family page can list exactly the apps a visitor will meet. STORY-BIBLE section 10.
// The catalog is content/story/catalog-apps.json, a snapshot of the live store AND the manifests on main; re-check it on
// publish day with scripts/story/build-catalog-snapshot.mts.
import { ALTERNATIVE_CHIP_PREFIX, FIRST_PARTY, type Beat, type Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Report, Severity } from './report.mts';
import { detailStrings, plain } from './text.mts';
import { isV3Story, v3Severity } from './v3.mts';
import { pairNames } from './services.mts';

const FIRST_PARTY_IDS = new Set<string>(FIRST_PARTY);

// Phrases that name Bitwarden without naming the product: VaultWarden is Bitwarden-compatible (STORY-BIBLE section 10, item 4).
const BITWARDEN_COMPAT = /\bthe Bitwarden apps\b|\bBitwarden-compatible\b/g;

/** The app names a piece of text mentions, as catalog ids. */
export function namedApps(text: string, ctx: Ctx): Set<string> {
  const named = new Set<string>();
  for (const m of ctx.appMatchers) if (m.re.test(text)) named.add(m.id);
  // Paperless-ngx is the one catalog app whose short name is a common word; a bare "Paperless" is flagged by checkAppNames
  return named;
}

/** Apps that cannot be named at all: not in the production store. */
function notInStoreHits(text: string, ctx: Ctx): string[] {
  const t = text.replace(BITWARDEN_COMPAT, ' ');
  return ctx.notInStore.filter((n) => n.re.test(t)).map((n) => n.name);
}

function checkAppUse(b: Beat, id: string, ctx: Ctx, out: Report, main: boolean, avoidSeverity: Severity): void {
  const a = ctx.apps.get(id);
  if (!a) { out.E('app-unknown', b.id, main ? `app ${id} is not in the catalog snapshot (content/story/catalog-apps.json)` : `with: ${id} is not in the catalog snapshot`, 'Use the id exactly as the catalog has it (paperless, not paperless-ngx).'); return; }
  if (a.inLiveStore === false) out.E('app-not-in-store', b.id, `${a.id} is no longer in the live store (catalog snapshot re-check)`, 'Choose an app a customer can install today.');
  // an error in a v3 family, a warning in every other (isV3Story): the families written before v3 stay valid until each is rewritten
  if (a.storySafe === 'avoid') out.add(avoidSeverity, 'app-avoid', b.id, `${a.id} is marked avoid in the catalog`, 'Choose another app.');
  if (a.qa === 'not-boot-tested') out.E('app-qa', b.id, `${a.id} says it was not boot-tested on a live Hub device`, 'Choose an app that was.');
  if (a.qa === 'no-screenshot') out.R('app-qa-screenshot', b.id, `${a.id} has no QA screenshot; the owner must list the beat in content/story/reviewed.json`, 'Prefer an app with a QA screenshot, or ask the owner to review the beat.');
  if (main && a.storySafe === 'with-caveat') {
    const kinds = [...new Set(a.caveats.map((c) => c.kind).filter((k) => k !== 'note'))];
    if (kinds.some((k) => ['public-access', 'hardware'].includes(k)) && !b.capability) out.W('app-caveat', b.id, `${a.id} carries caveats ${kinds.join(', ')}`, 'Write the capability and read the caveats in catalog-apps.json before using this app.');
  }
}

export function checkApps(story: Story, ctx: Ctx, out: Report): void {
  const avoid = v3Severity(story);
  const legacy: string[] = [];                              // beats whose second chip is the pass 1 form "replaces <X>" (chips-legacy)
  for (const b of story.beats) {
    const text = beatText(b);
    // ---- names that must not appear at all
    for (const n of notInStoreHits(text, ctx)) out.E('app-not-in-store', b.id, `${n} is not in the production store`, 'Name an app a customer can install today.');
    if (/\bPaperless\b(?!-ngx)/.test(text)) out.E('app-name', b.id, 'name the app Paperless-ngx, never bare "Paperless"', 'Write Paperless-ngx.');

    // ---- the one app of the scene
    const named = namedApps(text, ctx);
    if (b.app) {
      const a = ctx.apps.get(b.app.id);
      checkAppUse(b, b.app.id, ctx, out, true, avoid);
      if (!a) continue;                                   // unknown app: nothing else about it can be checked
      for (const r of b.app.replaces) if (!a.replaces.includes(r)) out.E('app-replaces', b.id, `${a.id} replaces ${a.replaces.join(', ') || 'nothing'} in the catalog, not "${r}"`, 'Use only names from the catalog entry.');
      const chips = b.popup.chips || [];
      if (b.service !== undefined && !chips.length) out.E('chips', b.id, `a beat with a service has two chips: "${a.name}", then "${ALTERNATIVE_CHIP_PREFIX}<Service>"`);
      if (chips.length) {
        if (chips[0].toLowerCase() !== a.name.toLowerCase() && !(a.id === 'ci-openclaw' && /openclaw/i.test(chips[0]))) out.E('chips', b.id, `the first chip must be the app name "${a.name}"`);
        const rest = chips.slice(1);
        if (b.service !== undefined) {
          // story v3: exactly two chips, the second "alternative to <Service>" with the registry name (or the alias app.replaces[0] uses)
          const svc = ctx.services.byId.get(b.service);
          if (rest.length !== 1) out.E('chips', b.id, `a beat with a service has exactly two chips: the app name, then "${ALTERNATIVE_CHIP_PREFIX}<Service>"`);
          else if (svc) { const want = pairNames(b, svc, ctx).map((n) => `${ALTERNATIVE_CHIP_PREFIX}${n}`); if (!want.includes(rest[0])) out.E('chips', b.id, `the second chip must read "${want[0]}"`, 'The chip names the registry service of the beat, not the pass 1 form "replaces <name>".'); }
          else if (!rest[0].startsWith(ALTERNATIVE_CHIP_PREFIX)) out.E('chips', b.id, `the second chip reads "${ALTERNATIVE_CHIP_PREFIX}<Service>"`);
        } else {
          for (const c of rest) {
            if (/^replaces /.test(c)) {
              legacy.push(b.id);
              const r = c.replace(/^replaces /, '');
              if (!b.app.replaces.includes(r)) out.E('chips', b.id, `chip names ${r}, which is not in app.replaces`);
            } else out.E('chips', b.id, `a second chip reads "${ALTERNATIVE_CHIP_PREFIX}<Service>" and needs a \`service\` on the beat (the pass 1 form "replaces <name>" is accepted without one)`);
          }
        }
      }
      if (b.app.replaces.length && !chips.some((c) => /^(replaces|alternative to) /.test(c))) out.W('chips', b.id, 'app.replaces is set but no chip shows it');
      if (!b.capability && b.category !== 'setup') out.W('capability', b.id, 'name the one thing the app does (capability)');
      if (b.capability) {
        const claimApp = ctx.claims.apps.find((x) => x.id === b.app!.id);
        const desc = `${a.description || ''} ${claimApp?.mayDescribeAs || ''}`.toLowerCase();
        const keys: string[] = b.capability.toLowerCase().match(/[a-z]{5,}/g) || [];
        if (keys.length && !keys.some((k) => desc.includes(k.slice(0, 5)))) out.W('capability', b.id, 'capability shares no word with the catalog description', 'Copy the capability from the catalog description.');
      }
      named.delete(b.app.id);
    } else {
      if (b.category !== 'setup') out.W('app', b.id, 'a beat outside the setup category without an app');
      if ((b.popup.chips || []).length) out.W('chips', b.id, 'chips without an app');
    }
    // ---- other apps the text names
    for (const w of b.with || []) {
      if (ctx.apps.has(w)) checkAppUse(b, w, ctx, out, false, avoid); else out.E('app-unknown', b.id, `with: ${w} is not in the catalog snapshot`);
      named.delete(w);
    }
    for (const id of FIRST_PARTY_IDS) named.delete(id);
    for (const id of named) out.E('app-undeclared', b.id, `the text names ${ctx.apps.get(id)!.name} but it is not app.id or in with`, 'Add it to "with", or take the name out of the text.');
  }

  // chips-legacy: an error beat by beat in a v3 family, one warning with the count in every other (the thirty families written before v3 use the old form)
  if (legacy.length) {
    if (isV3Story(story)) for (const id of legacy) out.E('chips-legacy', id, 'the second chip reads "replaces <X>", the pass 1 form', `Write "${ALTERNATIVE_CHIP_PREFIX}<Service>" and set the beat's service.`);
    else out.W('chips-legacy', legacy[0], `${legacy.length} beat${legacy.length === 1 ? '' : 's'} use the pass 1 chip "replaces <X>" (${legacy.slice(0, 4).join(', ')}${legacy.length > 4 ? ', ...' : ''}); an error once the family is told in the v3 shape`, `Write "${ALTERNATIVE_CHIP_PREFIX}<Service>" and set the beat's service.`);
  }

  // ---- the family-level strings: a name there must be a real app that some beat shows
  const shown = new Set<string>(story.beats.flatMap((b) => [...(b.app ? [b.app.id] : []), ...(b.with || [])]));
  const family: [string, string][] = [['family.tagline', story.family.tagline], ['family.story', story.family.story], ['closing.body', story.closing.body]];
  // story v2: the house lede and spots, the day and the profiles name apps only when some beat shows them
  if (story.family.home) family.push(['family.home.lede', story.family.home.lede], ...story.family.home.spots.map((s, i): [string, string] => [`family.home.spot${i}`, s.line]));
  (story.family.day || []).forEach((d, i) => family.push([`family.day${i}`, d.line]));
  story.members.forEach((m) => { if (m.profile) family.push([`member ${m.id}.profile`, m.profile.bio]); });
  story.members.forEach((m) => { if (m.work) family.push([`member ${m.id}.work`, m.work]); if (m.companion) family.push([`member ${m.id}.companion.job`, m.companion.job], [`member ${m.id}.companion.limits`, m.companion.limits]); });
  story.chapters.forEach((c) => family.push([`chapter ${c.id}`, c.title]));
  for (const [at, raw] of family) {
    const t = plain(raw);
    for (const n of notInStoreHits(t, ctx)) out.E('app-not-in-store', at, `${n} is not in the production store`);
    if (/\bPaperless\b(?!-ngx)/.test(t)) out.E('app-name', at, 'name the app Paperless-ngx, never bare "Paperless"');
    for (const id of namedApps(t, ctx)) if (!shown.has(id) && !FIRST_PARTY_IDS.has(id)) out.E('app-undeclared', at, `names ${ctx.apps.get(id)!.name}, which no beat shows`, 'Show the app in a beat, or leave its name out.');
  }
  out.stats.apps = [...shown].sort();
}

function beatText(b: Beat): string {
  // the text a visitor reads or hears in the beat, without the canned disclosure note
  return [b.popup.title, b.popup.body, ...(b.popup.chips || []), ...(b.popup.phone?.rows || []), b.say?.text || '', ...detailStrings(b)].map(plain).join(' ');
}
