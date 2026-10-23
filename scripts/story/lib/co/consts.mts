// The enumerations of company/v1 (content/story/schema/company.schema.json), as constants for the Node side, and the office's label. scripts/test-company-contract.mts holds
// every one equal to its twin in the schema, so a value added to one and not the other fails there.
//
// They live here and not in assets/story/types.ts (where the family's twins are) for M0 only: every assets/**/*.js is copied to the built site, and the M0 rule
// (reference/office/office-contract-m0.md, I11) is that the default build ships the same bytes as before. M1 moves what the player needs into types.ts on purpose.
import { ROLE_IDS, ROOM_ROLES, VOICE_KEYS, COLOURS } from '../../../../assets/story/types.ts';

/** how big the company the story is about is: a startup has 3 to 12 people, a small business 10 to 30, a medium one 50 to 250 and is told as a site or a department */
export const SIZES = ['startup', 'small', 'medium'] as const;
export type Size = (typeof SIZES)[number];
/** what the story is about: the company, one site of a larger firm, or one department of one */
export const SCOPES = ['company', 'site', 'department'] as const;
export type Scope = (typeof SCOPES)[number];
/** what a person does at work (content/story/functions.json) */
export const FUNCTIONS = ['owner', 'operations', 'finance', 'sales', 'marketing', 'support', 'engineering', 'design', 'projects', 'people', 'legal', 'it'] as const;
export type Fn = (typeof FUNCTIONS)[number];
/** the topic of a beat */
export const CO_CATEGORIES = ['setup', 'documents', 'communication', 'customers', 'money', 'projects', 'engineering', 'design', 'marketing', 'people', 'it'] as const;
/** the parts of a working day a `day` entry may be at (daylight only) */
export const CO_DAY_PARTS = ['morning', 'mid-morning', 'midday', 'afternoon', 'late-afternoon'] as const;
/** the room roles an office adds to the family's thirteen (content/story/roles-office.json) */
export const OFFICE_ONLY_ROOM_ROLES = ['reception', 'workfloor', 'meeting', 'server', 'workshop', 'store'] as const;
export const OFFICE_ROOM_ROLES = [...ROOM_ROLES, ...OFFICE_ONLY_ROOM_ROLES] as const;
/** the anchor roles an office adds to the family's twenty-seven */
export const OFFICE_ONLY_ROLE_IDS = ['workstation', 'meeting-table', 'whiteboard', 'server-rack', 'reception-desk', 'printer', 'workbench'] as const;
export const OFFICE_ROLE_IDS = [...ROLE_IDS, ...OFFICE_ONLY_ROLE_IDS] as const;
/** the room roles that only a home has; a company story never anchors in one (rule co-rooms) and the merged table drops them */
export const HOME_ONLY_ROOM_ROLES = ['living', 'dining', 'bedroom', 'kids', 'garage', 'laundry', 'bath', 'garden', 'patio'] as const;

export { VOICE_KEYS, COLOURS };

/** The band of people each size is told in: `headcount` of the company, site or department, and the scope that goes with it (rule co-size). */
export const SIZE_BANDS: Record<Size, { headcount: [number, number]; scopes: readonly Scope[] }> = {
  startup: { headcount: [3, 12], scopes: ['company'] },
  small: { headcount: [10, 30], scopes: ['company'] },
  medium: { headcount: [50, 250], scopes: ['site', 'department'] },
};
/** the most people on the floor of a building a story is told in (owner decision O3) */
export const FLOOR_MAX = 25;

/** The label of every surface of a company: the `text` of the disclosure `fictional-company` in content/story/claims.json (owner decision O4, 2026-10-23); a test holds the two equal. */
export const FICTIONAL_COMPANY_LINE = 'Fictional company. Real software.' as const;
/** The id of that disclosure. */
export const FICTIONAL_COMPANY_ID = 'fictional-company' as const;
