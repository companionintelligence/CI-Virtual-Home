// The scene QA checks every stream registers, in a fixed order (the order they report in). room-creator.html
// imports this; a stream adds checks in its own file below, never here.
import './kit.js';
import './arch.js';
import './compose.js';
import './site.js';
import './shots.js';

export { registerSceneCheck, runSceneChecks, sceneCheckCodes } from './registry.js';
export type { SceneCheck, SceneIssue, SceneQAContext } from './registry.js';
