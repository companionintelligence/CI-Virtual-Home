// Scene QA checks — owned by S1 (kit). Register each with registerSceneCheck(code, ctx => issues); see registry.ts.
// Starts empty (plan S0). New checks arrive as warnings until the layout pass promotes them (plan §2.0).
// Planned: hero-float, leaf-in-lane.
import { registerSceneCheck } from './registry.js';

// registerSceneCheck('my-check', ({ house, placedItems, shown }) => [{ level: 'warn', message: '…', subject: '…' }]);
