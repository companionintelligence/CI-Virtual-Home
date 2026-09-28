// Visibility — what the editor and a shot show of a house: the wall modes (up / cutaway / down, and the Sims rule
// that cuts per wall, per frame), the roof and ceiling registries and the shot's roof fade, the floor-layer filter,
// the shotHidden() hook, and the isometric camera's placement.
//
// Moved out of room-creator.html (plan S0, Completeness C4): the page creates one with createVisibility(deps) and
// destructures the same names it used to declare, so every caller is unchanged. Owner: S6 (ui). S5 owns the
// decisions a shot makes and this module applies: the roof's opacity frame by frame (shot-track.ts shotRoofAlpha,
// shotEnterS) and what a shot hides (shotHidden()). S2 tags roles on what it builds (a role set before
// registerTrackedWall is kept — a 'finish' liner registers for the cutaway and stays a liner) and registers roofs
// through registerRoof.
//
// The page keeps the state other regions read — currentWallMode, currentLayerFilter, FLOOR2_THRESHOLD, activeShot,
// activeHouse, activeEyeSpline, placedItems — and hands this module accessors to it.

// The true isometric view: yaw 45°, pitch atan(1 / √2) ≈ 35.264°, 35 m out, looking at (0, 1.2, 0).
export const ISO_VIEW = {
  ISO_DIST: 35,
  ISO_PITCH: Math.asin(1 / Math.sqrt(3)), // 35.264 deg
  ISO_YAW: Math.PI / 4, // 45 deg
};
export function placeIsoCamera(orthoCamera, angleYaw = Math.PI / 4) {
  const { ISO_DIST, ISO_PITCH } = ISO_VIEW;
  const radius = ISO_DIST;
  const x = radius * Math.cos(ISO_PITCH) * Math.sin(angleYaw);
  const y = radius * Math.sin(ISO_PITCH);
  const z = radius * Math.cos(ISO_PITCH) * Math.cos(angleYaw);
  orthoCamera.position.set(x, y, z);
  orthoCamera.lookAt(0, 1.2, 0);
}

import { shotEnterS, shotRoofAlpha } from './shot-track.js';

export function createVisibility({ THREE, placedItems, FLOOR2_THRESHOLD, wallMode, setWallMode, setLayerFilter, house, eyeSpline }) {
  const trackedWalls = [];

  function registerTrackedWall(mesh, orientation, fullH = 2.7, cutawayH = 0.85, downH = 0.15) {
    mesh.userData.isWall = true;
    if (!mesh.userData.role) mesh.userData.role = 'wall';   // a role the builder tagged first (S2's liners) is kept
    mesh.userData.orientation = orientation; // 'south' | 'east' | 'north' | 'west' | 'partition'
    mesh.userData.orientationExplicit = true;
    mesh.userData.fullHeight = fullH;
    mesh.userData.cutawayHeight = Math.min(cutawayH, fullH);
    mesh.userData.downHeight = Math.min(downH, fullH);
    if (!trackedWalls.includes(mesh)) trackedWalls.push(mesh);
    applyWallModeToMesh(mesh, wallMode());
    return mesh;
  }

  // Walls built by AssetFactory (solid / glass / low partition) tag themselves with
  // userData.isWall but do not know which side of the house they are on until they are
  // placed. addItemToScene calls this after positioning: it infers the orientation from
  // the world position (unless a preset registered it explicitly) and tracks the wall so
  // the cutaway / down / up modes apply to EVERY wall, not only parametric ones.
  function autoRegisterWall(obj) {
    if (!obj || !obj.userData || !obj.userData.isWall) return;
    if (!obj.userData.role) obj.userData.role = 'wall';
    if (!obj.userData.orientationExplicit) {
      const { x, z } = obj.position;
      const rotated = Math.abs(Math.sin(obj.rotation.y)) > 0.5; // runs along Z
      let ori;
      if (rotated) ori = x >= 0 ? 'east' : 'west';
      else ori = z >= 0 ? 'south' : 'north';
      if (obj.userData.partition) ori = 'partition';
      obj.userData.orientation = ori;
    }
    if (!trackedWalls.includes(obj)) trackedWalls.push(obj);
    applyWallModeToMesh(obj, wallMode());
  }

  // Roofs are hidden unless walls are fully up (Sims-style cutaway removes the roof).
  const trackedRoofs = [];
  // Ceilings (one per storey with nothing above it) show with the roofs in 'up' mode; during a shot each is
  // visible only while the eye is below it, so a descent from above never lands on it.
  const trackedCeilings = [];   // [{ obj, y }]
  function registerCeiling(obj, y) {
    obj.userData.isCeiling = true;
    obj.userData.role = 'ceiling';
    trackedCeilings.push({ obj, y });
    obj.visible = wallMode() === 'up';
  }
  function registerRoof(obj) {
    obj.userData.isRoof = true;
    obj.userData.role = 'roof';
    if (!trackedRoofs.includes(obj)) trackedRoofs.push(obj);
    // remember each material's own blend state (the A-frame glass roofs are transparent to begin with) so a
    // shot's fade can restore it exactly
    // An opaque roof fades by hashed-alpha dissolve (r169's own `alphaHash`), not by turning transparent.
    // A transparent roof drops out of the depth buffer and out of the GTAO pass — which skips transparent
    // materials — so the contact shadows indoors used to jump the instant the fade began, while the roof
    // was still fully drawn. Dissolving keeps the material opaque in every pass: the AO and the shadow
    // both go the moment the roof does. The threshold is hashed from object-space position, so the
    // pattern is stable under camera motion and identical run to run. Glass roofs start out transparent
    // and keep the alpha fade — GTAO already excludes them.
    obj.traverse(m => { if (!m.isMesh) return; for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) { if (!mat || mat.userData.orig) continue; mat.userData.orig = { transparent: mat.transparent, opacity: mat.opacity, depthWrite: mat.depthWrite }; if (!mat.transparent) { mat.alphaHash = true; mat.needsUpdate = true; } } });
    obj.visible = wallMode() === 'up';
  }

  // mode: 'up' | 'cutaway' | 'down' — the editor's global modes, where 'cutaway' means the south/east/
  // partition convention — or 'cut' | 'keep', where the caller has already decided about THIS wall (the
  // Sims rule below picks them per wall, per frame).
  function applyWallModeToMesh(mesh, mode) {
    if (!mesh || !mesh.userData) return;
    const ori = mesh.userData.orientation;
    const perWall = mode === 'cut' || mode === 'keep';
    const isCutawayTarget = perWall ? mode === 'cut' : (ori === 'south' || ori === 'east' || ori === 'partition');
    if (perWall) mode = 'cutaway';

    // 1. If parametric wall with discrete full, cutaway, and baseboard plan groups
    if (mesh.userData.fullGroup && mesh.userData.cutawayGroup && mesh.userData.baseboardGroup) {
      if (mode === 'cutaway') {
        if (isCutawayTarget) {
          mesh.userData.cutawayGroup.visible = true;
          mesh.userData.fullGroup.visible = false;
          mesh.userData.baseboardGroup.visible = false;
        } else {
          mesh.userData.cutawayGroup.visible = false;
          mesh.userData.fullGroup.visible = true;
          mesh.userData.baseboardGroup.visible = false;
        }
      } else if (mode === 'down') {
        mesh.userData.cutawayGroup.visible = false;
        mesh.userData.fullGroup.visible = false;
        mesh.userData.baseboardGroup.visible = true;
      } else { // 'up'
        mesh.userData.cutawayGroup.visible = false;
        mesh.userData.fullGroup.visible = true;
        mesh.userData.baseboardGroup.visible = false;
      }
      mesh.scale.set(1, 1, 1);
      // NOTE: never touch position.y here — upper-storey walls live at y = slab elevation.
      return;
    }

    // 2. Fallback for simple solid/partition mesh groups
    const fullH = mesh.userData.fullHeight || 2.7;
    const cutawayH = mesh.userData.cutawayHeight || 0.85;
    const downH = mesh.userData.downHeight || 0.15;

    let targetH = fullH;
    if (mode === 'down') {
      targetH = downH;
    } else if (mode === 'cutaway') {
      targetH = isCutawayTarget ? cutawayH : fullH;
    } else {
      targetH = fullH;
    }

    const scaleY = targetH / fullH;
    // Scaling about the group origin keeps the wall base on its own floor (local y = 0),
    // whether that floor is the ground or an upper slab.
    mesh.scale.y = scaleY;
  }

  // ---- Camera-aware cutaway for house shots -------------------------------------------------------------
  // While a house shot plays or renders, the manual wall mode is set aside: walls are full and the roofs are on
  // (the shot walks through doorways, so nothing needs cutting), and the roofs fade out over the last 5 % of the
  // approach before the eye passes under a ceiling, then stay off. Before this every video was recorded in the
  // 'cutaway' mode — S/E walls at 0.85 m and no roofs — so the houses read as dollhouses from the street.
  let shotCutaway = null;   // { savedMode, walls } while a house shot drives the camera
  function houseInside(eye) {
    const h = house(); if (!h) return false;
    for (const lv of h.spec.levels || []) {
      const y = lv.y || 0, H = lv.height || 2.8;
      if (eye.y < y - 0.2 || eye.y > y + H + 0.5) continue;
      if ((lv.footprint || []).some(r => eye.x >= r.x - 0.3 && eye.x <= r.x + r.w + 0.3 && eye.z >= r.z - 0.3 && eye.z <= r.z + r.d + 0.3)) return true;
    }
    return false;
  }
  // ---- Sims rule ---------------------------------------------------------------------------------
  // A shot can dress its exterior walls the way the game does: cut only the walls the eye is actually
  // looking through. A wall is cut when the eye stands on its outward side AND either the eye is above
  // the cut line (looking down into the plan) or the shot is aimed at something indoors. Interior
  // partitions stay up — cutting those as well turns the house into a floor plan.
  //
  // The decision is a pure function of this frame's eye and target. No hysteresis on t: frames are
  // rendered by random access (the hash test renders 0, 330 and 719 straight off), so anything stateful
  // would make frame 330 depend on whether 329 had been drawn. The 0.15 m dead band on the facing test
  // does the job the hysteresis was there for — a wall the eye slides along does not flicker.
  const WALL_OUT = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };
  const _simsBox = new THREE.Box3();
  function simsAnchor(wall) {
    if (wall.userData.simsAnchor) return wall.userData.simsAnchor;
    wall.updateWorldMatrix(true, false);
    _simsBox.setFromObject(wall);   // includes the hidden cutaway group: scaling never moves the base or the centre
    return (wall.userData.simsAnchor = { x: (_simsBox.min.x + _simsBox.max.x) / 2, z: (_simsBox.min.z + _simsBox.max.z) / 2, cut: _simsBox.min.y + (wall.userData.cutawayHeight || 0.85) });
  }
  function simsCut(wall, eye, target) {
    const n = WALL_OUT[wall.userData.orientation];
    if (!n || !eye) return false;
    const a = simsAnchor(wall);
    if (n[0] * (eye.x - a.x) + n[1] * (eye.z - a.z) <= 0.15) return false;   // eye indoors of it, or in its plane
    return eye.y > a.cut || (!!target && houseInside(target));
  }

  // first sample-space t at which the eye is under a ceiling (Infinity: the shot never goes in), cached on the preset
  function shotEnterT(preset) {
    if (preset.enterT !== undefined) return preset.enterT;
    const enter = shotEnterS(eyeSpline(), houseInside);
    preset.enterT = enter; return enter;
  }
  function setRoofOpacity(o) {
    for (const r of trackedRoofs) {
      r.visible = o > 0.01;
      r.traverse(m => { if (!m.isMesh) return; const mats = Array.isArray(m.material) ? m.material : [m.material]; for (const mat of mats) { if (!mat) continue; const orig = mat.userData.orig || { transparent: false, opacity: 1, depthWrite: true }; mat.opacity = orig.opacity * o; if (mat.alphaHash) continue;   // dissolves on opacity alone; stays opaque, keeps writing depth
        if (o < 0.999) { mat.transparent = true; mat.depthWrite = false; } else { mat.transparent = orig.transparent; mat.depthWrite = orig.depthWrite; } } });
    }
  }
  // The shot says what the walls and the roofs do; the editor's buttons no longer leak into the video.
  // dressing.walls: 'up' (full height — the eye uses the doorways) | 'cutaway' (the editor's dollhouse)
  //                 | 'down' | 'sims' (per wall, per frame, above)
  // dressing.roof:  'on' | 'off' | 'auto' (fades out over the 5 % of the shot before the eye goes indoors) — the
  //                 opacity is S5's rule, shot-track.ts shotRoofAlpha
  function applyShotCutaway(preset, sampleT, eye, target) {
    // put back what the last frame's shotHidden() hooks hid BEFORE this frame's dressing decides anything: the
    // roofs and ceilings below are placed objects too, and restoring after them would hand a ceiling the last
    // frame's visibility, not this one's (frame i would depend on frame i − 1)
    restoreShotHidden();
    const d = (preset && preset.dressing) || { walls: 'up', roof: 'auto' };
    if (!shotCutaway) shotCutaway = { savedMode: wallMode(), walls: null };
    if (d.walls === 'sims') {
      for (const w of trackedWalls) applyWallModeToMesh(w, simsCut(w, eye, target) ? 'cut' : 'keep');
      shotCutaway.walls = 'sims';
    } else if (shotCutaway.walls !== d.walls) {
      for (const w of trackedWalls) applyWallModeToMesh(w, d.walls === 'cutaway' || d.walls === 'down' ? d.walls : 'up');
      shotCutaway.walls = d.walls;
    }
    setRoofOpacity(shotRoofAlpha({ preset, s: sampleT, enter: () => shotEnterT(preset) }));
    for (const c of trackedCeilings) c.obj.visible = !eye || eye.y < c.y - 0.1;
    applyShotHidden({ preset, s: sampleT, eye, target });
  }
  function endShotCutaway() {
    restoreShotHidden();
    if (!shotCutaway) return;
    const mode = shotCutaway.savedMode; shotCutaway = null;
    setRoofOpacity(1);
    setGlobalWallMode(mode);
  }

  function setGlobalWallMode(mode) {
    setWallMode(mode);
    document.querySelectorAll('#wall-cutaway-ctrl-group .btn-ctrl').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-wall-${mode}`);
    if (activeBtn) activeBtn.classList.add('active');

    trackedWalls.forEach(w => applyWallModeToMesh(w, mode));
    trackedRoofs.forEach(r => { r.visible = (mode === 'up'); });
    trackedCeilings.forEach(c => { c.obj.visible = (mode === 'up'); });
  }

  // =========================================================================
  // FLOOR LAYER VISIBILITY
  // Toggle between all floors, ground floor only (L1), or upper floor only (L2)
  // Items at y >= FLOOR2_THRESHOLD are considered upper floor furniture.
  // =========================================================================
  function setGlobalLayerVisibility(layer) {
    setLayerFilter(layer);
    document.querySelectorAll('#floor-layer-ctrl-group .btn-ctrl').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-layer-${layer}`);
    if (activeBtn) activeBtn.classList.add('active');

    placedItems.forEach(obj => {
      if (!obj) return;
      if (layer === 'all') {
        obj.visible = true;
      } else if (layer === 'floor1') {
        // Show items on/near the ground floor (y < FLOOR2_THRESHOLD)
        obj.visible = obj.position.y < FLOOR2_THRESHOLD;
      } else if (layer === 'floor2') {
        // Show only upper-floor items (y >= FLOOR2_THRESHOLD)
        obj.visible = obj.position.y >= FLOOR2_THRESHOLD;
      }
    });
  }

  // ---- shotHidden(): what a shot hides, frame by frame (plan Completeness C4 — the hook is S5's) --------------
  // shotHidden(fn) registers fn(obj, frame) → true to hide a placed object for this frame of a shot, where frame is
  // { preset, s, eye, target } (s: the path's sample fraction, as the roof fade reads it). It returns a function
  // that unregisters it. Every frame first puts back what the last frame hid (applyShotCutaway's first step, before
  // its dressing sets the roofs' and ceilings' visibility), then dresses, then asks the hooks afresh — so frame i
  // never depends on frame i − 1 (__houseRenderFrames is random access); endShotCutaway puts everything back.
  // With nothing registered it does nothing at all.
  const shotHiddenHooks = [];
  let shotHiddenNow = [];   // [{ obj, visible }] hidden by the current frame
  function shotHidden(fn) {
    shotHiddenHooks.push(fn);
    return () => { const i = shotHiddenHooks.indexOf(fn); if (i !== -1) shotHiddenHooks.splice(i, 1); };
  }
  function restoreShotHidden() {
    for (const { obj, visible } of shotHiddenNow) obj.visible = visible;
    shotHiddenNow = [];
  }
  function applyShotHidden(frame) {   // after restoreShotHidden() and this frame's dressing
    if (!shotHiddenHooks.length) return;
    for (const obj of placedItems) if (obj && obj.visible && shotHiddenHooks.some(fn => fn(obj, frame))) { shotHiddenNow.push({ obj, visible: obj.visible }); obj.visible = false; }
  }

  return {
    trackedWalls, trackedRoofs, trackedCeilings,
    registerTrackedWall, autoRegisterWall, registerCeiling, registerRoof, applyWallModeToMesh,
    houseInside, simsCut, shotEnterT, setRoofOpacity, applyShotCutaway, endShotCutaway,
    setGlobalWallMode, setGlobalLayerVisibility, shotHidden,
  };
}
