// The fine print the office pages owe, from claims.json's words (the base disclosures the families' pages print, and the office's own `fictional-company`). The families' rule table
// (assets/story/fine-print.ts) is shipped and is not touched in M0, so the office keeps its own small table here; when the player needs the label (M1) the rows move there.
//
//   officeFinePrint('office-footer').html          → <p data-fine="launch-not-offer">…</p>…
//   companyLong('Reelwick')                        → "Reelwick is a fictional company. The people in it are characters, not customers. The software is real."
import { disclosureText, finePrintHtml, loadClaims } from '../story/lib/fine-print.mts';

export type OfficeSurface = 'office-fold' | 'office-footer' | 'company-fold' | 'company-footer';
type Row = { id: string; when?: 'agents' };
const r = (id: string, when?: 'agents'): Row => ({ id, when });
/**
 * Which disclosures each surface of the office carries, in print order (claims.json `where` in the comment):
 *  - the first screen of /office and of a company: the label (fictional-company: "the /office page's hero", "every company page's header")
 *  - the footers: the page names real services and apps and quotes written scenes, and the Companion Core has a Buy link (launch-not-offer: footer; scripted-scenes: landing page footer;
 *    names-logos-owners: footer; third-party-apps: landing page footer; apps-availability: credits; attribution-agents: when Hermes or OpenClaw is named)
 */
export const OFFICE_SURFACES: Record<OfficeSurface, Row[]> = {
  'office-fold': [r('fictional-company')],
  'office-footer': [r('launch-not-offer'), r('scripted-scenes'), r('names-logos-owners'), r('third-party-apps')],
  'company-fold': [r('fictional-company')],
  'company-footer': [r('launch-not-offer'), r('scripted-scenes'), r('names-logos-owners'), r('third-party-apps'), r('apps-availability'), r('attribution-agents', 'agents')],
};

export const owedIds = (surface: OfficeSurface, facts: { agents?: boolean } = {}): string[] => OFFICE_SURFACES[surface].filter((x) => !x.when || facts[x.when]).map((x) => x.id);

export function officeFinePrint(surface: OfficeSurface, facts: { agents?: boolean } = {}, o: { tag?: string; cls?: string } = {}): { items: { id: string; text: string }[]; html: string } {
  const claims = loadClaims();
  const items = owedIds(surface, facts).map((id) => ({ id, text: disclosureText(id, claims) }));
  return { items, html: finePrintHtml(items, o) };
}

/** The label's long form for one company: claims.json's `long` with the name in. */
export function companyLong(name: string): string {
  const d = loadClaims().disclosures.find((x) => x.id === 'fictional-company') as { long?: string } | undefined;
  if (!d?.long) throw new Error('claims.json has no fictional-company disclosure with a long form');
  return d.long.replace('{company}', name);
}
