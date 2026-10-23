// Banned phrases that content/story/claims.json does not carry yet and the audit of 2026-10 (W5-compliance-13) found shipping: sentences that
// promise what the catalog's caveats say the app does not do. They run beside claims.json's own rules in the built-site lint (lib/site-copy.mts): the caveats as
// WARNINGS, which a writer sees and nothing fails on until the families that still say them are rewritten, the held claim and the word "beta" as errors. They are
// not in the story validator on purpose: test/fixtures/stories/ok-6 and ok-9 (the frozen Brennan with every field) say "a cloud gaming service" and
// must stay at 0 warnings, so moving a rule into claims.json (the owner's file) is what puts it in the validator too. When claims.json takes them over (the owner edits that file), delete the entry here; a rule with the same id in
// claims.json wins and this one is dropped (`withExtraBans`).
export interface ExtraBan { id: string; pattern: string; flags: string; severity: 'error' | 'review' | 'warn'; why: string; fix: string }

export const EXTRA_BANS: ExtraBan[] = [
  {
    // 2026-10-22 (the owner): no page, film or ad is required to carry a beta line or label, and no copy says beta. This is the check that holds it: story:copy reads every
    // string a visitor reads (the pages, the tours, the cards, the ad plan, the player's source) and the lander plan reads the same list through `bansOf`.
    id: 'release-status-beta', pattern: '\\bbeta\\b', flags: 'i', severity: 'error',
    why: 'The owner took the beta requirement out of the rules (2026-10-22): the site does not say a product is in beta, in a beta program or has a beta label.',
    fix: 'Delete the clause or the sentence, or say the same thing without the word. Do not replace it with a statement about availability, price or readiness that the sentence did not already make.',
  },
  {
    id: 'cap-cloud-gaming', pattern: '\\bcloud[- ]gaming\\b', flags: 'i', severity: 'warn',
    why: 'Steam Headless runs a session on the Core from the family\'s own Steam library; the catalog caveat is that it is never a cloud gaming replacement.',
    fix: 'Say what runs where ("Steam Headless runs the session on the Core") and do not name or compare a cloud gaming service.',
  },
  {
    id: 'cap-photo-sorting', pattern: '\\bsorts?\\s+(?:out\\s+)?(?:the|your|their|his|her|our|all)?\\s*(?:photos|pictures)\\b', flags: 'i', severity: 'warn',
    why: 'The catalog caveat for the photo apps: no AI sorts the photos. They organise by date, place and album.',
    fix: 'Say "organises" (by date, place, album), not "sorts".',
  },
  {
    // W8-product-truth-02: the Core's no-activation claim is on hold in claims.json (core-no-activation) and the product screens say "CI Account"
    id: 'held-no-account', pattern: '\\bno (?:vendor )?account (?:needed|required|is needed)\\b|\\bwithout (?:creating |making )?an? (?:vendor )?account\\b|\\bwithout the internet\\b|\\bno (?:first-boot )?activation\\b', flags: 'i', severity: 'error',
    why: 'The "no vendor account, no first-boot activation" line is on hold in claims.json (core-no-activation): the first run pairs the Core with a CI Account.',
    fix: 'Say what the first run does (plug in, pair, pick agents and apps) and leave out what it does not need.',
  },
  {
    // W3-content-27: the catalog caveat for Wallos is that it lists subscriptions and promises no saving
    id: 'cap-decide-to-cancel', pattern: '\\bdecide[sd]? to cancel\\b', flags: 'i', severity: 'warn',
    why: 'A subscription tracker shows what renews; it does not promise a saving (the Wallos caveat).',
    fix: 'Say "decide whether to keep it".',
  },
  {
    id: 'cap-small-script', pattern: '\\ba small script on the Core\\b', flags: 'i', severity: 'warn',
    why: 'No listed app promises a script; an automation is a workflow in n8n or a Home Assistant automation.',
    fix: 'Name the app that runs the automation.',
  },
];

/** claims.json's rules plus the extra ones whose id it does not already have. */
export function withExtraBans<T extends { id: string }>(rules: T[], mk: (e: ExtraBan) => T): T[] {
  const have = new Set(rules.map((r) => r.id));
  return [...rules, ...EXTRA_BANS.filter((e) => !have.has(e.id)).map(mk)];
}
