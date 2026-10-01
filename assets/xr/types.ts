// assets/xr/types.ts : SHIM for the story branch's assets/story/types.ts, so assets/xr/presenter.ts (a verbatim copy of the story-owned
// presenter contract) compiles on a tree that has no assets/story/. These definitions are copied from the story branch's types.ts
// (story/contract/types.ts) for ONLY the names presenter.ts imports. At the merge step this file and assets/xr/presenter.ts are
// DELETED and every `./presenter.js` / `./types.js` import under assets/xr/ is re-pointed to ../story/presenter.js / ../story/types.js.
// Do not add anything else here.
export type VoiceKey = string;                     // story: (typeof VOICE_KEYS)[number], a closed union of Kokoro voice ids
export type MemberRole = string;                   // story: (typeof MEMBER_ROLES)[number]
export type ChapterKind = string;                  // story: (typeof CHAPTER_KINDS)[number]
export type Colour = string;                       // story: (typeof COLOURS)[number]
export type Runtime = string;                      // story: (typeof RUNTIMES)[number]
export type ClipId = string;
export type WordTiming = [word: string, startMs: number, endMs: number];
export interface PhoneScreen { header: string; rows: string[] }
