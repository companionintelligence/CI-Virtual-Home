// assets/story/types.ts : the FINAL type contract of the family-story system. Browser and Node, no THREE, no imports.
// Owner after the contract commit: story-validator (changes here are contract changes: announce them in the progress log).
// Mirrors content/story/schema/family.schema.json (authored file) and defines the generated files and the site files.
// A test in scripts/test-stories.mts keeps every constant array below equal to the matching enum in the schema.

// ---- enumerations (single source for code; the schema holds the same lists) ---------------------------------------------
export const VOICE_KEYS = ['v-warm-f', 'v-clear-f', 'v-bright-f', 'v-young-f', 'v-steady-m', 'v-storyteller-m', 'v-deep-m', 'v-light-m'] as const;
export const HOUSEHOLDS = ['solo-or-couple', 'young-family', 'older-kids', 'grandparents'] as const;
export const CATEGORIES = ['setup', 'home', 'food', 'iot', 'productivity', 'money', 'privacy', 'kids', 'media', 'creative', 'small-business'] as const;
export const SEGMENTS = ['consumer', 'small-business'] as const;
export const ROOM_ROLES = ['entry', 'living', 'kitchen', 'dining', 'office', 'bedroom', 'kids', 'garage', 'laundry', 'bath', 'garden', 'patio', 'street'] as const;
export const ROLE_IDS = ['street', 'front-door', 'core', 'room', 'couch', 'tv', 'fireplace', 'bookshelf', 'fridge', 'range', 'kitchen-island', 'counter', 'dining-table', 'desk', 'bed', 'crib', 'toys', 'music', 'laundry', 'bicycle', 'easel', 'telescope', 'patio-seat', 'garden', 'driveway', 'pool', 'deck'] as const;
export const MEMBER_ROLES = ['parent', 'partner', 'adult-child', 'teen', 'child', 'baby', 'grandparent', 'housemate', 'visitor'] as const;
export const CHAPTER_KINDS = ['ftue', 'room', 'outside', 'outro'] as const;
export const COLOURS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;
export const RUNTIMES = ['Hermes', 'OpenClaw'] as const;
/**
 * The job a member does on the family's one Companion Core (reference/story/personas.md; content/story/personas.json). The first six are the original cast,
 * the next eight are story v3, the last twelve are the persona expansion (reference/story/personas/index.md). Which front-page category each belongs to
 * is content/story/categories.json.
 */
export const ARCHETYPES = ['organiser', 'builder', 'gamer', 'learner', 'maker', 'host', 'tech-family', 'business-owner', 'creative', 'contractor', 'marketer', 'lawyer', 'journalist', 'educator', 'money-keeper', 'housemate', 'carer', 'community-lead', 'researcher', 'seller', 'translator', 'archivist', 'traveller', 'athlete', 'collector', 'shift-worker'] as const;
/** Story v2 (reference/story/story-v2.md): the parts of the day a `family.day` entry can be at, daylight only, in this order. */
export const DAY_PARTS = ['morning', 'midday', 'afternoon', 'after-school', 'weekend'] as const;
/**
 * Story v3 (reference/story/story-v3.md), mirrored by the schema (beat.service.pattern, popup.chips items maxLength) and kept equal by a test:
 * the shape of a registry service id (content/story/services.json), the longest chip, and the words a pair beat's second chip starts with.
 */
export const SERVICE_ID_PATTERN = '^[a-z0-9][a-z0-9-]{1,38}$' as const;
export const CHIP_MAX_LENGTH = 48 as const;
export const ALTERNATIVE_CHIP_PREFIX = 'alternative to ' as const;

// ---- office enumerations (office-build-contract.md section 3) -------------------------------------------
export const SIZES = ['startup', 'small', 'medium'] as const;
export const SCOPES = ['company', 'site', 'department'] as const;
export const FUNCTIONS = ['owner', 'operations', 'finance', 'sales', 'marketing', 'support', 'engineering', 'design', 'projects', 'people', 'legal', 'it'] as const;
export const CO_CATEGORIES = ['setup', 'documents', 'communication', 'customers', 'money', 'projects', 'engineering', 'design', 'marketing', 'people', 'it'] as const;
export const CO_DAY_PARTS = ['arrival', 'morning', 'midday', 'afternoon', 'close'] as const;
export const OFFICE_ROOM_ROLES = ['entry', 'living', 'kitchen', 'dining', 'office', 'bedroom', 'kids', 'garage', 'laundry', 'bath', 'garden', 'patio', 'street', 'reception', 'workfloor', 'meeting', 'server', 'workshop', 'store'] as const;
export const OFFICE_ROLE_IDS = ['street', 'front-door', 'core', 'room', 'couch', 'tv', 'fireplace', 'bookshelf', 'fridge', 'range', 'kitchen-island', 'counter', 'dining-table', 'desk', 'bed', 'crib', 'toys', 'music', 'laundry', 'bicycle', 'easel', 'telescope', 'patio-seat', 'garden', 'driveway', 'pool', 'deck', 'workstation', 'meeting-table', 'whiteboard', 'server-rack', 'reception-desk', 'printer', 'workbench'] as const;

export type Id = string;
export type AppId = string;
export type VoiceKey = (typeof VOICE_KEYS)[number];
export type Household = (typeof HOUSEHOLDS)[number];
export type Category = (typeof CATEGORIES)[number];
export type Segment = (typeof SEGMENTS)[number];
export type RoomRole = (typeof ROOM_ROLES)[number];
export type RoleId = (typeof ROLE_IDS)[number];
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type ChapterKind = (typeof CHAPTER_KINDS)[number];
export type Colour = (typeof COLOURS)[number];
export type Runtime = (typeof RUNTIMES)[number];
export type Archetype = (typeof ARCHETYPES)[number];
export type DayPart = (typeof DAY_PARTS)[number];

export type CompanySize = (typeof SIZES)[number];
export type CompanyScope = (typeof SCOPES)[number];
export type CompanyFunction = (typeof FUNCTIONS)[number];
export type CompanyCategory = (typeof CO_CATEGORIES)[number];
export type CompanyDayPart = (typeof CO_DAY_PARTS)[number];
export type OfficeRoomRole = (typeof OFFICE_ROOM_ROLES)[number];
export type OfficeRoleId = (typeof OFFICE_ROLE_IDS)[number];

// ---- the authored file: content/families/<slug>.json -------------------------------------------------------------------
export interface AnchorLeaf { role: RoleId; room?: RoomRole; nth?: number }
export interface AnchorRef extends AnchorLeaf { fallback?: AnchorLeaf[] }
export interface CameraHint { framing?: 'wide' | 'medium' | 'close'; from?: 'front' | 'left' | 'right' | 'behind' | 'above'; side?: 'left' | 'right' | 'auto'; eye?: 'standing' | 'seated' | 'low' | 'aerial' }

export interface Companion {
  name: string; runtime: Runtime; job: string; personality: [string, string, string]; voice: VoiceKey; memory: boolean; limits: string;
}
/** Story v2. Optional on a member: who they are and how they use the Core (at most 45 words, third person, no age). */
export interface MemberProfile { bio: string }
export interface Member {
  id: Id; name: string; age: number; role: MemberRole; work?: string; colour: Colour; companion?: Companion;
  /** Story v2 (optional). */
  profile?: MemberProfile;
  /** Optional. The persona model (reference/story/personas.md): what this member does on the Core. A member with one is held to the persona rules. */
  archetype?: Archetype;
}
export interface Chapter { id: Id; kind: ChapterKind; room?: RoomRole; title: string }
export interface PhoneScreen { header: string; rows: string[] }
export interface Popup { kind?: 'card' | 'phone'; title: string; body: string; chips?: string[]; note?: string; phone?: PhoneScreen }
export interface Say { speaker: Id; text: string }
/**
 * Story v2 (optional, reference/story/story-v2.md): what a visitor who stays opens up. All four are present when `detail` is.
 * before and after at most 28 words each, steps 2 to 4 items of at most 12 words, fact at most 28 words. The popup (the narration) is untouched.
 */
export interface BeatDetail { before: string; after: string; steps: string[]; fact: string }
export interface Beat {
  id: Id; chapter: Id; member?: Id; agent?: Id; approval?: Id;
  category: Category; segment: Segment;
  app?: { id: AppId; replaces: string[] }; with?: AppId[]; capability?: string;
  /** Story v3 (optional): the id of the replaced service this beat's app is the alternative to. A story with one is a v3 story (isV3Story). */
  service?: string;
  anchor: AnchorRef; camera?: CameraHint;
  popup: Popup; say?: Say;
  /** Story v2 (optional). */
  detail?: BeatDetail;
  emphasis?: { ring?: boolean; wake?: boolean };
  film?: boolean; minSeconds?: number;
}
export interface Closing { body: string; cta: { label: string; url: 'https://ci.computer/core' } }
/** Story v2: a room of the house and one line about it. `room` is an exact room name of the house; the line is at most 16 words. */
export interface HomeSpot { room: string; line: string }
/** Story v2 (optional): the house told true to its spec. `lede` at most 50 words, 2 to 5 spots. */
export interface FamilyHome { lede: string; spots: HomeSpot[] }
/** Story v2 (optional): one entry of a day in the house, 5 to 10 in time order; `beat` is an existing beat id, `line` at most 14 words. */
export interface DayEntry { at: DayPart; beat: Id; line: string }
export interface FamilyInfo {
  surname: string; tagline: string; household: Household; business: boolean; story: string;
  address: { line: string; place: string }; narrator: VoiceKey;
  /** Story v2 (optional). */
  home?: FamilyHome; day?: DayEntry[];
}
export interface Story {
  schema: 'family/v1'; slug: string; house: Id; fictional: true;
  family: FamilyInfo; members: Member[]; chapters: Chapter[]; beats: Beat[]; closing: Closing; notes?: string[];
}

// ---- company/v1 (office-build-contract.md section 3) -----------------------------------------------------
export interface CompanyMember {
  id: Id; name: string; function: CompanyFunction; title: string; colour: Colour; ownsCore?: boolean;
  companion?: Companion; profile?: MemberProfile;
}
export interface CompanyInfo {
  name: string; tagline: string; sector: string; size: CompanySize; scope: CompanyScope;
  headcount: number; floor: number; story: string;
  address: { line: string; place: string }; narrator: VoiceKey;
  office?: FamilyHome; day?: DayEntry[];
}
export interface CompanyStory {
  schema: 'company/v1'; slug: string; office: Id; fictional: true;
  company: CompanyInfo; members: CompanyMember[]; chapters: Chapter[]; beats: Beat[]; closing: Closing; notes?: string[];
}

// ---- clips: what is spoken -----------------------------------------------------------------------------------------------
/** ClipId: the beat id (narration = popup.body), `<beat id>.say` (agent line), or 'closing' (closing.body + ' ' + SIGNOFF). */
export type ClipId = string;
export const SIGNOFF = 'UnCloud your life.' as const;
export const FICTIONAL_LINE = 'Fictional family. Real software.' as const;
export const FICTIONAL_COMPANY_LINE = 'Fictional company. Real software.' as const;
export const INTERNET_NOTE = 'Installing apps uses the internet.' as const;
export const HERMES_NOTE = 'Messages pass through the chat service you choose.' as const;
export const OPENCLAW_WEB_NOTE = 'OpenClaw reaches websites over your home internet.' as const;
export const FIRST_PARTY = ['ci-memory', 'ci-hermes', 'ci-openclaw'] as const;
export interface Speech { id: ClipId; speaker: 'narrator' | Id; voice: VoiceKey; text: string }

// ---- generated by voiceover-tool: content/families/<slug>.voice.json ---------------------------------------------------
export type WordTiming = [word: string, startMs: number, endMs: number];
export interface Clip {
  text: string; textSha: string; voice: VoiceKey; kokoro: string; speed: number;
  /** relative to content/families/<slug>/ : audio/<clip id>.<hash10>.m4a (hash10 = first 10 hex of sha256 of the file bytes) */
  file: string; sha256: string; bytes: number; durationMs: number; trimmedLeadMs: number;
  words: WordTiming[]; loudness: { I: number; TP: number };
}
export interface VoiceLock {
  v: 1; slug: string; storySha: string; lexiconSha: string;
  engine: { name: 'kokoro' | 'say'; kokoro?: string; misaki?: string; torch?: string; model?: string; modelRevision?: string; seed?: 0; ffmpeg?: string; encoder: string; normalise: string; labelled?: string };
  clips: Record<ClipId, Clip>;
}

// ---- generated by story-bake: content/families/<slug>.bake.json --------------------------------------------------------
export interface Pose { eye: [number, number, number]; target: [number, number, number]; fov: number; level: string | null; tier: 0 | 1 | 2; resolved: { role: RoleId; type: string; viaFallback: number } }
export interface BeatTime { id: Id; t0: number; t1: number; travel: [t0: number, t1: number] | null }
export interface BakeLock {
  v: 1; slug: string;
  /** any change to the HouseSpec bytes, the plan.json world digest, roles.json or this story's anchors makes the lock stale */
  specSha: string; worldSha: string; rolesSha: string; anchorsSha: string;
  /** 'voice' when timings come from the voice lock; 'estimated' (150 wpm) otherwise. A release build fails on 'estimated'. */
  durations: 'voice' | 'estimated'; voiceSha: string | null;
  poses: Record<Id, Pose>;
  timeline: { duration: number; beats: BeatTime[]; filmBeats: Id[]; filmDuration: number; trackSha: string };
  /** the baked camera track, format owned by story-bake (assets/story/track.ts) */
  track: unknown;
}

// ---- site data (built by landing-site; read by the player and the film) -------------------------------------------------
export interface FamilyCard {
  slug: string; surname: string; title: string; address: string; tagline: string; household: Household; business: boolean;
  topics: Category[]; members: { name: string; role: MemberRole; age: number; companion?: string }[];
  apps: { id: AppId; name: string; replaces: string[] }[]; beats: number; order: number; featured?: boolean;
  thumb: string; og: string;
}
export interface FamiliesIndex { v: 1; families: FamilyCard[] }
/** dist/story/manifest.json : the ONE un-hashed data file (revalidated). Everything it points to is content-hashed and immutable. */
export interface SiteManifest {
  v: 1; families: string; legacy: string;
  byFamily: Record<string, {
    spec: string; story: string; poster: string; og: string;
    /** clip id -> audio URL */ audio: Record<ClipId, string>;
    /** false: the tour has no narration yet (no voice-over has been recorded): it runs from reading-time durations, with captions. Set by scripts/story/ship/player.mts for a family with a tour. */
    narration?: boolean;
    film?: { src916?: string; src169?: string; vtt?: string; poster?: string; durationMs: number; bytes: number };
  }>;
}

// ---- inputs the writers and tools read (content/story/*.json) ----------------------------------------------------------
/** One person of casting.json (content/story/cast-plan.json, built by scripts/story/build-casting.mts). The older casting listed {role, age, work} only. */
export interface CastMember {
  id?: Id; name?: string; age: number | string; role: string; work: string;
  /** null or absent: no archetype (a child, a baby) */
  archetype?: Archetype | null;
  /** the room they live in, by the house's own name for it, and the storey */
  room?: string; level?: string; roomLabel?: string; roomKey?: string;
  /** the room roles that room plays (roles.json), and the anchor chain a beat of theirs can use: role ids, or `room:<room role>` */
  roomRoles?: RoomRole[]; anchors?: string[]; anchorGaps?: string[];
  sleepsIn?: string; companion?: string;
}
export interface CastingFamily {
  slug: string; house: Id; household: Household; business: boolean; narrator: VoiceKey; tenure: 'owner' | 'renter';
  /** The flagship family (Sally, John, Steve, Jean) lives in three homes; the fleet-unique name rules do not apply between flagship homes. Set in casting.json only, never in a family file. */
  flagship?: boolean;
  storeys: number; areaSqm: number; signatureApps: AppId[];
  coreSpot: { room: string; level: string; surface: 'shelf' | 'desk'; pose: string };
  frontDoor: { side: string; aboveGround: boolean };
  coreWalk: { metres: number; roomsPassed: string[]; seenFromDoor: boolean; awkwardScore: number };
  rooms: { name: string; level: string; kinds: string[]; areaSqm: number }[];
  roles: Record<string, number>;
  homeFlags: { no: 'tv' | 'kitchen-island' | 'garden' | 'dining-table' | 'desk'; status: string; say: string }[];
  /** Who lives here. The re-cast (content/story/cast-plan.json) gives every member an id, a name and an age as a number; a family file must tell exactly these people (rule `casting`). */
  members: CastMember[]; care: string; ftueExtra: string;
  /** The family's surname and the place of its address (a family file repeats both; rule `casting`). Present from the re-cast on. */
  surname?: string; place?: string;
  /** Why this home, and the apps the plan counts on (signatureApps) and one per required topic (beatApps). Information for writers; a story that leaves a planned app out is warned (rule `casting-apps`). */
  reason?: string; beatApps?: Record<string, AppId>; reviewNeeded?: string[]; coreRoom?: string; fitNote?: string;
  household_text: string; businessText: string | null; categoryHints: string[]; anchorsToUse: string[]; eyelessAnchors: string[]; homeStyle: string; lotGround: string;
}

/** content/story/personas.json: the machine-readable archetype table of reference/story/personas.md. */
export interface PersonaDef {
  label: string; description: string; example?: string;
  /** room roles where this archetype's own beats belong, preferred first */
  rooms: RoomRole[];
  /** counted only when the house has none of `rooms` (a studio flat without an office) */
  fallbackRooms: RoomRole[];
  /** anchor roles in preference order, then the fallbacks (information for casting and the film; the rule reads rooms) */
  anchorRoles: RoleId[]; fallbackAnchorRoles: RoleId[];
  /** Companion Hub store ids this archetype's story draws on; a member needs at least one beat whose app (or `with`) is in the pool */
  apps: AppId[];
}
export interface PersonasFile { v: 1; archetypes: Record<Archetype, PersonaDef> }
