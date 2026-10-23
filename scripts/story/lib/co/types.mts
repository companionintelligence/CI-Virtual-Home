// The shape of a company story (content/story/schema/company.schema.json) as the validator and the page writers read it. Loose where the schema is: the schema
// is the contract, these are the names the code uses. Node only (M0): the player's twins arrive with the tour (reference/office/office-contract-m0.md, section 2).
import type { Fn, Scope, Size } from './consts.mts';

export interface CoPopup { kind?: 'card' | 'phone'; title: string; body: string; chips?: string[]; note?: string; phone?: { header: string; rows: string[] } }
export interface CoAnchorLeaf { role: string; room?: string; nth?: number }
export interface CoAnchor extends CoAnchorLeaf { fallback?: CoAnchorLeaf[] }
export interface CoDetail { before: string; after: string; steps: string[]; fact: string }
export interface CoBeat {
  id: string; chapter: string; member?: string; agent?: string; approval?: string; category: string;
  app?: { id: string; replaces: string[] }; with?: string[]; capability?: string; service?: string;
  anchor: CoAnchor; camera?: Record<string, string>; popup: CoPopup; detail?: CoDetail; say?: { speaker: string; text: string };
  emphasis?: { ring?: boolean; wake?: boolean }; film?: boolean; minSeconds?: number;
}
export interface CoMember {
  id: string; name: string; function: Fn; title: string; colour: string; ownsCore: boolean; profile?: { bio: string };
  companion?: { name: string; runtime: 'Hermes' | 'OpenClaw'; job: string; personality: string[]; voice: string; memory: boolean; limits: string };
}
export interface CoChapter { id: string; kind: 'ftue' | 'room' | 'outside' | 'outro'; room?: string; title: string }
export interface CoCompany {
  name: string; tagline: string; sector: string; size: Size; scope: Scope; headcount: number; floor: number; story: string;
  address: { line: string; place: string }; narrator: string; office?: { lede: string; spots: { room: string; line: string }[] }; day?: { at: string; beat: string; line: string }[];
}
export interface CompanyStory {
  schema: 'company/v1'; slug: string; house: string; fictional: true; company: CoCompany; members: CoMember[]; chapters: CoChapter[]; beats: CoBeat[];
  closing: { body: string; cta: { label: string; url: string } }; notes?: string[];
}
