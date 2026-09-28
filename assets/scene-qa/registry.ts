// The scene QA registry (plan Completeness C6). window.__houseSceneQA (room-creator.html) reads the built scene and
// reports what no camera path would catch — dressing, furniture buried in walls, planting on a grid — and then runs
// every check registered here, so a stream adds a scene check in its own module instead of editing the page:
//
//   registerSceneCheck('hero-float', ctx => issues)   // assets/scene-qa/kit.ts (S1), site.ts (S4) …
//
// A check gets the context below and returns its issues (or nothing); the code it was registered under is attached
// to each, and an error fails the gate like the page's own. Checks run in registration order (the import order in
// index.ts, then any registered at run time through __houseSceneQA.register); a check that throws is reported as
// an error under its code rather than taking the others down. With nothing registered the report is unchanged.
//
// Owned by S0 and frozen. The checks themselves belong to their streams.

export type SceneIssue = { level: 'error' | 'warn'; message: string; subject?: string };

export type SceneQAContext = {
  THREE: any;
  scene: any;
  /** { id, spec, anchors, shots } — the house on screen */
  house: any;
  /** every object the builder placed (userData.role: ground, floor, structure, wall, item, fixture, site, hero …) */
  placedItems: any[];
  trackedWalls: any[];
  trackedRoofs: any[];
  trackedCeilings: Array<{ obj: any; y: number }>;
  /** the dressing the check runs under: { walls, roof } */
  dressing: { walls: string; roof: string };
  /** visible on screen: the object and every ancestor visible */
  shown: (o: any) => boolean;
};

export type SceneCheck = (ctx: SceneQAContext) => SceneIssue[] | void;

const CHECKS = new Map<string, SceneCheck>();

/** Register (or, under a code already registered, replace) a scene check. */
export function registerSceneCheck(code: string, fn: SceneCheck) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(code)) throw new Error(`scene check code "${code}": kebab-case, please`);
  if (typeof fn !== 'function') throw new Error(`scene check "${code}": not a function`);
  CHECKS.set(code, fn);
}

export const sceneCheckCodes = () => [...CHECKS.keys()];

/** Every registered check against ctx → [{ code, level, message, subject }] */
export function runSceneChecks(ctx: SceneQAContext) {
  const out: Array<SceneIssue & { code: string }> = [];
  for (const [code, fn] of CHECKS) {
    let issues;
    try { issues = fn(ctx) || []; } catch (e) { out.push({ code, level: 'error', message: `scene check threw: ${e && e.message}`, subject: code }); continue; }
    for (const is of issues) out.push({ code, level: is.level === 'error' ? 'error' : 'warn', message: is.message, subject: is.subject ?? '' });
  }
  return out;
}
