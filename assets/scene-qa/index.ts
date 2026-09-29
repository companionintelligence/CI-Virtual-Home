// The scene QA checks every stream registers, in a fixed order (the order they report in). room-creator.html
// imports this — in the editor and the gates; the player (?mode=view) never runs the scene QA and never loads it, and
// loadHouse awaits it before the house is ready. A stream adds checks in its own file below, never here.
import './kit.js';
import './arch.js';
import './compose.js';
import './site.js';
import './shots.js';

export { registerSceneCheck, runSceneChecks, sceneCheckCodes } from './registry.js';
export type { SceneCheck, SceneIssue, SceneQAContext } from './registry.js';
