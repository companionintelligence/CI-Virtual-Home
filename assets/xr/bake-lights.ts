// assets/xr/bake-lights.ts : the light and shadow budget of an XR frame.
//
// A house has 10 to 20 lights: ambient, a hemisphere, the sun (with the shadow map), a shadowless fill, and one SpotLight per lit room
// (assets/fixtures.ts) plus the odd PointLight. three evaluates every one of them in EVERY fragment of every material, per eye. On a
// mobile GPU that is the frame. So a headset keeps the sky lights, the sun and the nearest `maxSpots` punctual lights, and no more.
//
// Two hard facts shape this file:
//   - three's program cache key contains the NUMBER of spot, point and directional lights (and of shadow-casting ones). Changing that
//     number recompiles every material. So the count is chosen ONCE (at apply, behind the veil) and every later change of place only
//     swaps WHICH lights are on, never how many. (visible flips of equal count change uniforms only: lights.state.version moves
//     only when a count moves.)
//   - a hidden light is not collected at all (WebGLRenderer.projectObject returns at object.visible === false), so `visible` is the
//     switch, nothing else about the light is touched.
//
// The sun's shadow map is resized to the tier's size and, on the standalone and Vision tiers, rendered ONCE: autoUpdate off and a
// needsUpdate on the entry and whenever the caster set changes (a roof or door moved, a refocus hid cells, the lighting changed).
// The tethered tier redraws it every third frame from scene.onBeforeRender, which runs once per frame BEFORE shadowMap.render, so
// never between the two eyes. Everything this file changes is returned as undo steps.
import type { XrBudget } from '../platform-types.js';

export interface LightBudget {
  all: any[];                  // every light that was visible when the bake began (what restore() puts back)
  punctual: any[];             // the spot and point lights among them: the ones that are rationed
  n: number;                   // how many punctual lights stay on, fixed for the session
  on: Set<any>;
}

const worldPos = (THREE: any, l: any) => l.getWorldPosition(new THREE.Vector3());

/** The lights that count (visible, in the scene). Call after the scene is in its XR dress. */
export function collectLights(THREE: any, scene: any, budget: XrBudget): LightBudget {
  const all: any[] = [], punctual: any[] = [];
  scene.updateMatrixWorld(true);
  scene.traverseVisible((o: any) => {
    if (!o.isLight) return;
    all.push(o);
    if ((o.isSpotLight || o.isPointLight) && !o.castShadow) punctual.push(o);
  });
  return { all, punctual, n: Math.min(budget.maxSpots, punctual.length), on: new Set() };
}

/** The `n` nearest punctual lights to the head. A light on another storey counts as 4x as far in height: a lamp through a floor lights
 *  nothing (the cone cannot cross the slab) but would otherwise outrank the one in the next room. */
export function pickLights(THREE: any, lb: LightBudget, head: { x: number; y: number; z: number }): any[] {
  const p = new THREE.Vector3();
  const scored = lb.punctual.map(l => { l.getWorldPosition(p); const dy = (p.y - head.y) * 4; return { l, d: (p.x - head.x) ** 2 + dy * dy + (p.z - head.z) ** 2 }; });
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, lb.n).map(s => s.l);
}

/** Switch the punctual lights to `chosen`. Only `visible` flips, and the number on never changes. Returns how many flipped. */
export function setLights(lb: LightBudget, chosen: any[]): number {
  const want = new Set(chosen);
  let flipped = 0;
  for (const l of lb.punctual) {
    const on = want.has(l);
    if (l.visible !== on) { l.visible = on; flipped++; }
  }
  lb.on = want;
  return flipped;
}

export function restoreLights(lb: LightBudget): void {
  for (const l of lb.all) l.visible = true;
}

export interface ShadowPlan { suns: any[]; undo: () => void; hookInstalled: boolean }

/** Resize the sun's map to the tier's, make it static (or every third frame), and ask for the first render. */
export function configureShadow(THREE: any, renderer: any, scene: any, budget: XrBudget): ShadowPlan {
  const suns: any[] = [];
  scene.traverseVisible((o: any) => { if (o.isLight && o.castShadow && o.shadow) suns.push(o); });
  const saved = suns.map(l => ({ l, w: l.shadow.mapSize.x, h: l.shadow.mapSize.y, nb: l.shadow.normalBias, bias: l.shadow.bias }));
  const sm = renderer.shadowMap, prevAuto = sm.autoUpdate, prevNeeds = sm.needsUpdate;
  const size = budget.sunShadow.size;
  let resized = false;
  for (const s of saved) {
    if (s.w === size && s.h === size) continue;
    resized = true;
    s.l.shadow.mapSize.set(size, size);
    // normalBias is "about 1.5 texels along the normal" (room-creator refitShadow): a bigger texel needs a proportionally bigger offset
    s.l.shadow.normalBias = s.nb * (s.w / size);
    if (s.l.shadow.map) { s.l.shadow.map.dispose(); s.l.shadow.map = null; }
    if (s.l.shadow.mapPass) { s.l.shadow.mapPass.dispose(); s.l.shadow.mapPass = null; }
  }
  sm.autoUpdate = false; sm.needsUpdate = true;
  // tethered: every third frame, from the scene's own pre-render hook (once per renderer.render, before the shadow pass)
  let hookInstalled = false, prevHook: any = null, n = 0;
  if (budget.sunShadow.refresh === 'every-3rd') {
    prevHook = scene.onBeforeRender; hookInstalled = true;
    scene.onBeforeRender = function (...a: any[]) { if (n++ % 3 === 0) sm.needsUpdate = true; if (prevHook) return prevHook.apply(this, a); };
  }
  return {
    suns, hookInstalled,
    undo() {
      if (hookInstalled) scene.onBeforeRender = prevHook;
      for (const s of saved) {
        if (s.l.shadow.mapSize.x !== s.w || s.l.shadow.mapSize.y !== s.h) {
          s.l.shadow.mapSize.set(s.w, s.h);
          if (s.l.shadow.map) { s.l.shadow.map.dispose(); s.l.shadow.map = null; }
          if (s.l.shadow.mapPass) { s.l.shadow.mapPass.dispose(); s.l.shadow.mapPass = null; }
        }
        s.l.shadow.normalBias = s.nb; s.l.shadow.bias = s.bias;
      }
      // (a map dropped above is made again at its own size by the next shadow render, so ask for one; otherwise leave the flag as it was)
      sm.autoUpdate = prevAuto; sm.needsUpdate = resized ? true : prevNeeds;
    },
  };
}
