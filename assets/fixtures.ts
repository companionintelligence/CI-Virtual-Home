// Interior fixtures — the lights a lived-in house has on its ceilings, and the light they throw.
//
// dressLevel(ctx) runs once per storey from house-builder's rooms loop, after the storey's walls and room items
// are placed. Every room gets
//   recessed downlights  a grid of cans flush with the ceiling: white trim and a warm lens (emissive, tagged
//                        userData.fixture = 'recessed'), registered with the page as part of the ceiling so a cut
//                        view, which hides the ceiling, hides them too
//   pendants             over dining tables, islands and breakfast bars (the lit parts: fixture = 'pendant')
//   ceiling fans         living rooms, bedrooms and studies big enough to take one (the light kit: fixture = 'fan')
//   one warm light       at most one per room and LIGHT_CAP lights per house, no shadows, chosen by a fixed rule — room
//                        kind × √area, ties by storey then room order — so the same rooms light every run. It is
//                        a wide, fully soft SpotLight fill aimed straight down whose distance cutoff stops just past the
//                        room's side walls (see the room loop: the walls wash, the lawn and the lower roofs stay dark);
//                        a room with a lamp also gets a PointLight at the lamp head nearest its centre (the lamp's
//                        pool) and its fill drops to a fraction (plan 5.2 L1, L3)
// and the storey's existing things get two touch-ups: window glass is tagged userData.windowGlow (the environment
// gives it an emissive at dusk and night), and the catalog's halo lamp loses its cyan ring and blue PointLight —
// the rings read as UI markers in every room — and becomes a drum floor lamp the lamp gain drives like any other
// fixture.
//
// Contract with the environment (assets/environment.ts): it owns the lamp gain — window.__houseLighting.lampGain,
// re-announced by a 'house:lighting' event on window — and scales the EMISSIVE of every mesh tagged
// userData.fixture. This module drives its own lights from the same gain (base × lampGain), and leaves a
// fixture material's authored intensity in material.userData.fixtureBase so a scaler never compounds.
//
// Nothing here is per-frame: fans do not turn (the blade angle is seeded) and no light flickers, so
// __houseRenderFrames stays random access. Everything is seeded from the house id.
import { mulberry32, fnv1a } from './materials.js';
import { inRect } from './house-geometry.js';
import { programKind, fanPlan, lampPlan, REGISTRY_LAMPS, LAMP_ITEMS } from './kit-rules.js';
import { schemeOf } from './house-scheme.js';
import { heroFrame } from './hero-frame.js';

export const LIGHT_CAP = 16;          // dynamic lights per house (one per room at most)
const DAY_GAIN = 0.035;               // lamp gain when no environment has announced one (a daylight preset's)
// the colour of the house's lights is its scheme's lamp temperature (house-scheme.ts LAMP_COLORS: 3000 K is the ~2900 K warm white
// these pools have always had, so modern, mid-century and tropical homes are unchanged; cottage, craftsman, farmhouse and
// mediterranean homes go to 2700 K)
const ROOM_MIN_AREA = 2.5;            // m² — a cupboard gets no light
// The room's own light is a soft FILL, not a spot (plan 5.2 L1). Before, it was aimed straight down at about ten times the
// illuminance a sunlit wall receives, with a 0.45 penumbra: the nearest horizontal surface (a bed, a coffee table, an island)
// clipped to white and the cone's edge scalloped the wall. Now it is a wide, fully soft cone at 0.3 of that.
export const ROOM_FILL_K = 0.3;       // × the floor-illuminance target below (service 0.6 and hall 0.45 still scale it down)
export const FILL_PENUMBRA = 1.0;     // the whole cone is a falloff: no edge
export const FILL_ANGLE_MAX = 1.25;   // rad (~72°): a wider cone only lights the lawn
/** lampGain under which the room's light is off for good: day (0.035). Offline (composer, editor) the spot is then HIDDEN, so the
 *  day shader has no spot lights to loop over; the live player keeps it in the scene at intensity 0 (see applyLampGain). */
export const FILL_ON_GAIN = 0.1;
// Practical lamp pools (plan 5.2 L3): a room that has a lamp lights the way a room with a lamp is lit, from the lamp. One static
// PointLight at the lamp head nearest the room's centre (no camera dependence, no shadow), and the room's fill spot drops to
// LAMP_ROOM_FILL_K of its own floor target (0.12 against ROOM_FILL_K's 0.3 elsewhere). The pool's intensity scales with the room's
// size (to a cap) and its reach is a fixed fraction of the room's diagonal: no shadows, so what keeps it in its room is distance.
export const LAMP_ROOM_FILL_K = 0.12;
export const LAMP_POOL_I = 2.2;       // cd at gain 1, for a 3 m room; × √area / 3, at most × LAMP_POOL_MAX
export const LAMP_POOL_MAX = 1.6;
export const LAMP_POOL_REACH = 0.62;  // × the room's diagonal
export const LAMP_POOL_DECAY = 1.6;

// ---- the kind of room, from its name (the specs name rooms freely: "Sunset Terrace Suite", "Study & Bar") ----
const KINDS: Array<[string, RegExp]> = [
  ['service', /garage|workshop|store\b|storage|cellar|gym|utility|laundry|mudroom|trunk/i],
  ['bath', /bath|ensuite|en-suite|powder|\bwc\b|shower/i],
  ['bed', /bed|suite|nursery|kids|guest|sleeping|teen|dressing|master/i],
  ['kitchen', /kitchen|galley/i],
  ['dining', /dining|breakfast/i],
  ['living', /living|lounge|salon|family|great room|\bden\b|media|\btv\b|sitting|sunroom|solarium|conservatory|playroom|garden room|bar\b/i],
  ['work', /study|office|studio|atelier|library|console|pod\b|loft/i],
  ['hall', /hall|landing|entry|entrance|foyer|vestibule|stair|passage|lobby/i],
];
/** A room's kind: its rooms[].program when it has one (S3's program list; plan Completeness C2), else from its name.
 *  Takes the room, or (as before) just its name. */
export const roomKind = (room: any = ''): string => {
  if (room && typeof room === 'object') { const k = programKind(room.program); if (k) return k; room = room.name || ''; }
  const name = String(room || '');
  return (KINDS.find(([, re]) => re.test(name)) || ['room'])[0];
};
const WEIGHT = { living: 3, kitchen: 3, dining: 2.6, bed: 2.4, work: 2.2, room: 2, bath: 1.4, hall: 1.2, service: 0.8, outdoor: 0 };
const FAN_KINDS = new Set(['living', 'bed', 'room', 'work']);   // Pascal's cut views show a fan in nearly every bedroom, den and study
/** could this room take a ceiling fan at all (its kind and size; placement may still find no clear spot)? */
export const fanEligible = (room: any): boolean => {
  const b = room && room.bounds; if (!b) return false;
  return FAN_KINDS.has(roomKind(room)) && b.w * b.d >= 8 && Math.min(b.w, b.d) >= 2.6;
};
// what a pendant hangs over (catalog and registry types) and what already hangs from a ceiling
const PENDANT_OVER = { 'kitchen-island': 'island', 'breakfast-bar': 'island', 'dining-set': 'dining', 'dining-table': 'dining', 'farmhouse-table': 'dining', 'round-dining-table': 'round' };
const HUNG = new Set(['pendant-lamp', 'chandelier', 'ceiling-light']);

type Pt = { x: number; z: number };
const segDist = (p: Pt, a: Pt, b: Pt) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)); return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)); };

// ---- lamp gain: the environment's number, applied to the house built last --------------------------------------
let current: any = null;   // per-build state of the house on screen
const readGain = (): number => {
  const w: any = typeof window !== 'undefined' ? window : null;
  const g = w && w.__houseLighting && w.__houseLighting.lampGain;
  return typeof g === 'number' && Number.isFinite(g) ? g : DAY_GAIN;
};
/** Set every room light for a lamp gain. A light below FILL_ON_GAIN is off: hidden offline (the day frames drop their spot loop), and, in
 *  the live player (?mode=view), left in the scene at intensity 0, because a hidden light changes three's NUM_SPOT_LIGHTS and every lit
 *  material recompiles on the time-of-day switch (the hitch measured in the L1 commit). */
export const hideOffGain = (): boolean => {
  const w: any = typeof window !== 'undefined' ? window : null;
  if (w && typeof w.__fillHide === 'boolean') return w.__fillHide;   // a measurement hook (test-interior-light --hitch sets it before the build)
  return !(w && /[?&]mode=view\b/.test(w.location.search));
};
export function applyLampGain(gain: number = readGain()) {
  if (!current) return;
  current.gain = gain;
  const hide = hideOffGain();
  for (const { light, base } of current.lights) {
    light.intensity = gain >= FILL_ON_GAIN ? base * gain : (hide ? base * gain : 0);
    light.visible = !hide || gain >= FILL_ON_GAIN;
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('house:lighting', (e: any) => {
    const g = e && e.detail && e.detail.lampGain;
    applyLampGain(typeof g === 'number' && Number.isFinite(g) ? g : readGain());
  });
  (window as any).__houseFixtures = {   // QA hook: what the fixtures did, and a way to drive the gain by hand
    applyLampGain,
    stats: () => current && { ...current.stats, gain: current.gain, lights: current.lights.map(l => { const p = l.light.getWorldPosition(new l.light.position.constructor()); return { room: l.room, base: +l.base.toFixed(2), at: [p.x, p.y, p.z].map(v => +v.toFixed(2)) }; }) },
  };
}

// ---- per-build state: ranking, style picks, shared geometry and materials -------------------------------------
const states = new WeakMap();
function stateFor(ctx) {
  let s = states.get(ctx.anchors);
  if (s) return s;
  const { THREE, spec } = ctx;
  const rng = mulberry32(fnv1a(`${spec.id}:fixtures`));
  const pick = arr => arr[Math.floor(rng() * arr.length)];

  // which rooms get a light: room kind × √area, highest first, while LIGHT_CAP lights last. A room costs one light, two when it has a
  // lamp (its lamp's pool and its weak fill), so the house never runs more than LIGHT_CAP dynamic lights of ours
  const scheme = schemeOf(spec);
  const ranked = [];
  (spec.levels || []).forEach((lv, li) => (lv.rooms || []).forEach((r, ri) => {
    if (!r.bounds) return;
    const area = r.bounds.w * r.bounds.d; if (area < ROOM_MIN_AREA) return;
    const kind = roomKind(r); if (kind === 'outdoor') return;
    const lamp = (r.items || []).some(it => it && LAMP_ITEMS.has(it.type));
    ranked.push({ key: `${lv.id}#${ri}`, score: WEIGHT[kind] * Math.sqrt(area), li, ri, lamp });
  }));
  ranked.sort((a, b) => b.score - a.score || a.li - b.li || a.ri - b.ri);
  const lit = new Map<string, { lamp: boolean }>();
  for (let left = LIGHT_CAP, k = 0; k < ranked.length && left > 0; k++) {
    const r = ranked[k], cost = r.lamp && LAMP_ROOM_FILL_K > 0 ? 2 : 1;
    if (cost > left) continue;   // a cheaper room further down may still fit
    lit.set(r.key, { lamp: r.lamp }); left -= cost;
  }

  const mat = (o: any, fixtureBase?: number) => { const m = new THREE.MeshStandardMaterial(o); if (fixtureBase !== undefined) m.userData.fixtureBase = fixtureBase; return m; };
  const fanStyle = pick(['black', 'black', 'walnut']);
  const M = {
    trim: mat({ color: 0xf4f2ee, roughness: 0.45 }),
    lens: mat({ color: 0xfffaf0, emissive: 0xffe4bd, emissiveIntensity: 2.2, roughness: 0.3 }, 2.2),
    fanBody: mat({ color: fanStyle === 'walnut' ? 0x2e2620 : 0x1b1a19, roughness: 0.45, metalness: 0.55 }),
    fanBlade: mat({ color: fanStyle === 'walnut' ? 0x5a4130 : 0x232120, roughness: 0.6 }),
    fanGlow: mat({ color: 0xfbf6ee, emissive: 0xffe2b8, emissiveIntensity: 1.4, roughness: 0.35 }, 1.4),
    shade: mat({ color: 0x1c1b1a, roughness: 0.42, metalness: 0.6, side: THREE.DoubleSide }),
    shadeGlow: mat({ color: 0xfff6e8, emissive: 0xffd9a6, emissiveIntensity: 2.4, roughness: 0.4 }, 2.4),
    globe: mat({ color: 0xf8f5ef, emissive: 0xfff0d6, emissiveIntensity: 1.2, roughness: 0.25 }, 1.2),
    canopy: mat({ color: 0x1c1b1a, roughness: 0.5, metalness: 0.5 }),
    // the halo lamp, re-dressed as a drum floor lamp: blackened-bronze stand, linen shade, opal diffuser
    lampStand: mat({ color: 0x2b2723, roughness: 0.5, metalness: 0.6 }),
    drumShade: mat({ color: 0xebe2d2, emissive: 0xffd6a0, emissiveIntensity: 0.55, roughness: 0.92, side: THREE.DoubleSide }, 0.55),
    diffuser: mat({ color: 0xfff6ea, emissive: 0xffe0b8, emissiveIntensity: 1.5, roughness: 0.5 }, 1.5),
  };
  const G = {
    lens: new THREE.CircleGeometry(0.058, 20).rotateX(Math.PI / 2),                 // faces down
    trim: new THREE.RingGeometry(0.056, 0.088, 24).rotateX(Math.PI / 2),
    drum: new THREE.CylinderGeometry(0.155, 0.185, 0.3, 32, 1, true),
    diffuser: new THREE.CircleGeometry(0.178, 32).rotateX(Math.PI / 2),            // faces down, closes the drum's foot
  };
  s = {
    rng, pick, lit, scheme, warm: scheme.lampColor, M, G, fanStyle, diningStyle: pick(['dome', 'globe', 'dome']),
    lights: [], gain: readGain(),
    stats: { recessed: 0, pendants: 0, fans: 0, lights: 0, pools: 0, glass: 0, halos: 0, lamps: {} as Record<string, number> },
    // kit-rules.ts: which rooms may hang a fan (rooms[].fixtures.fan; under defaults 2 a seeded minority), and the
    // lamp kind each room's floor lamps become (rooms[].fixtures.lamp; defaults 2 seeded) — both keyed lv#room
    fans: fanPlan(spec, fanEligible), lamps: lampPlan(spec),
  };
  states.set(ctx.anchors, s);
  current = s;
  ctx.anchors.fixtures = s.stats;
  return s;
}

// ---- touch-ups on what the storey already has ----------------------------------------------------------------
// Window glass: every transmissive pane in a wall (windows, sliders, glazing spans — the parametric wall builds
// them all from one physical glass material). Tagged here rather than where the glass is built, so the tag holds
// whatever shape the window unit takes.
function tagWindowGlass(placed, s) {
  for (const w of placed) {
    const u = w.userData || {};
    if (!u.isWall || u.windowGlowTagged) continue;
    u.windowGlowTagged = true;
    w.traverse(m => {
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (mats.some(x => x && x.isMeshPhysicalMaterial && (x.transmission || 0) > 0)) { m.userData.windowGlow = true; s.stats.glass++; }
    });
  }
}
// The halo lamp (the page's createAmbientHaloLamp): a 3.0-emissive cyan ring on a rod plus a blue PointLight, in
// nearly every room of every house (265 of them across the 30 specs). Toned bronze, the ring still read as a UI
// marker: a glowing O at eye level indoors, a floating ellipse from above. It keeps its base and rod and becomes a
// drum floor lamp: an open linen shade round the rod's top with an opal diffuser across its foot, both lit by the
// lamp gain (fixture = 'lamp', like the registry's lamps). The drum stays inside the ring's old box (r 0.185
// against the base's 0.2, y 1.31–1.61 against 1.19–1.71), so nothing new meets the camera. The PointLight goes:
// this module's one-per-room lights replace it.
function toneHaloLamps(placed, s, THREE, lampOf) {
  for (const o of placed) {
    const u = o.userData || {};
    if (u.itemType !== 'halo-lamp' || u.haloToned) continue;
    u.haloToned = true;
    const kind = lampOf(o);
    const lights = [], rings = [];
    o.traverse(m => {
      if (m.isLight) lights.push(m);
      else if (m.isMesh && m.material && m.material.emissive && m.material.emissiveIntensity > 1) rings.push(m);
      else if (m.isMesh) m.material = s.M.lampStand;
    });
    for (const l of lights) l.parent.remove(l);
    for (const r of rings) {
      const at = r.parent, y0 = r.position.y + 0.01;
      at.remove(r);
      if (kind && kind !== 'drum') { at.add(lampHead(THREE, s, kind, y0)); continue; }
      const shade = new THREE.Mesh(s.G.drum, s.M.drumShade); shade.name = 'Drum Shade';
      shade.position.y = y0; shade.castShadow = true; shade.receiveShadow = true; shade.userData.fixture = 'lamp';
      const foot = new THREE.Mesh(s.G.diffuser, s.M.diffuser); foot.name = 'Diffuser';
      foot.position.y = y0 - 0.13; foot.userData.fixture = 'lamp';
      at.add(shade, foot);
    }
    o.name = `${kind && kind !== 'drum' ? kind[0].toUpperCase() + kind.slice(1) : 'Drum'} Floor Lamp`;
    s.stats.halos++;
    s.stats.lamps[kind || 'drum'] = (s.stats.lamps[kind || 'drum'] || 0) + 1;
  }
}

// The other lamp heads (kit-rules.ts LAMP_KINDS; rooms[].fixtures.lamp, or seeded per room under defaults 2), each
// inside the drum's old box so nothing new meets the camera: an opal globe, a spun-metal cone and a mushroom
// dome (both lit from inside, open underneath), and a tripod — a drum on three splayed legs round the old rod.
// `y0` is where the shade's centre was, `k` scales the head (a table lamp's is three quarters of a floor lamp's).
// `tint` (0xRRGGBB): the colour the spec gave the lamp — its shade colour stays whatever shape the head takes, so the
// globe's glass, the cone's and the dome's enamel and the drum's linen are painted in it.
function tintedMats(s, THREE, tint: number) {
  s.tints ||= new Map();
  if (!s.tints.has(tint)) {
    const paint = (m, extra: any = {}) => { const c = m.clone(); c.color.setHex(tint); Object.assign(c, extra); return c; };
    s.tints.set(tint, { globe: paint(s.M.globe), shade: paint(s.M.shade, { metalness: 0.1, roughness: 0.6 }), drumShade: paint(s.M.drumShade) });
  }
  return s.tints.get(tint);
}
function lampHead(THREE, s, kind: string, y0: number, k = 1, tint?: number) {
  const g = new THREE.Group(); g.name = `Lamp Head (${kind})`;
  const lit = (m) => { m.userData.fixture = 'lamp'; return m; };
  const M = tint === undefined ? s.M : { ...s.M, ...tintedMats(s, THREE, tint) };
  if (kind === 'globe') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.16 * k, 28, 18), M.globe); b.position.y = y0; b.castShadow = true; g.add(lit(b));
  } else if (kind === 'cone' || kind === 'mushroom') {
    const shell = kind === 'cone' ? new THREE.CylinderGeometry(0.05 * k, 0.18 * k, 0.26 * k, 28, 1, true) : new THREE.SphereGeometry(0.19 * k, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const sh = new THREE.Mesh(shell, M.shade); sh.position.y = kind === 'cone' ? y0 : y0 - 0.12 * k; sh.castShadow = true; g.add(sh);
    const glow = new THREE.Mesh(new THREE.CircleGeometry((kind === 'cone' ? 0.17 : 0.18) * k, 28).rotateX(Math.PI / 2), M.shadeGlow);
    glow.position.y = kind === 'cone' ? y0 - 0.12 * k : y0 - 0.11 * k; g.add(lit(glow));
  } else if (kind === 'tripod') {
    const shade = new THREE.Mesh(s.G.drum, M.drumShade); shade.position.y = y0; shade.scale.setScalar(k); shade.castShadow = true; g.add(lit(shade));
    const foot = new THREE.Mesh(s.G.diffuser, M.diffuser); foot.position.y = y0 - 0.13 * k; foot.scale.setScalar(k); g.add(lit(foot));
    for (let n = 0; n < 3; n++) {
      const a = Math.PI / 2 + n * 2 * Math.PI / 3, A = new THREE.Vector3(0.17 * k * Math.cos(a), 0.02, 0.17 * k * Math.sin(a)), B = new THREE.Vector3(0.02 * k * Math.cos(a), y0 - 0.2 * k, 0.02 * k * Math.sin(a));
      const d = B.clone().sub(A), leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, d.length(), 8), M.lampStand);
      leg.position.copy(A).add(B).multiplyScalar(0.5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); leg.castShadow = true; g.add(leg);
    }
  }
  return g;
}

// The lamps houses actually place — the registry's floor lamp, arc lamp, tripod lamp and table lamp (2 % of the
// specs' lamps are the halo lamp above; 98 % are these) — take their room's kind too: rooms[].fixtures.lamp, or under
// defaults 2 the seeded pick (kit-rules.ts lampPlan). Their heads are tagged userData.lampHead (assets/props/): the
// swap removes the drum shade, its rims and its bulb and hangs the kind's head where the shade's centre was, painted
// in the colour the spec gave the lamp (`color` on the item: the author's shade) when it gave one. A drum stays as it
// is, and so does a tripod lamp asked for a tripod. Nothing is added: the lamps a room already has change their heads, so a composed room
// (S3's program) is varied like any other.
function varyRegistryLamps(placed, s, THREE, lampOf) {
  for (const o of placed) {
    const u = o.userData || {};
    if (!REGISTRY_LAMPS.has(u.itemType) || u.lampVaried) continue;
    u.lampVaried = true;
    const asked = lampOf(o);
    let kind: string = asked || 'drum';
    const heads = []; let shade = null;
    o.traverse(m => { if (m.isMesh && m.userData && m.userData.lampHead) { heads.push(m); if (m.userData.lampHead === 'shade') shade = m; } });
    if (kind !== 'drum' && (!shade || (u.itemType === 'arc-floor-lamp' && kind === 'tripod'))) kind = 'drum';   // arc lamps hang their shade: no tripod
    if (u.itemType === 'tripod-floor-lamp' && kind === 'tripod') kind = 'drum';   // already one
    if (kind !== 'drum') {
      const at = shade.parent, head = lampHead(THREE, s, kind, shade.position.y, u.itemType === 'table-lamp' ? 0.75 : 1, typeof u.explicitColor === 'number' ? u.explicitColor : undefined);
      head.position.set(shade.position.x, 0, shade.position.z);
      for (const m of heads) m.parent.remove(m);
      at.add(head);
      o.name = `${kind[0].toUpperCase() + kind.slice(1)} ${u.itemType === 'table-lamp' ? 'Table' : 'Floor'} Lamp`;
    }
    s.stats.lamps[kind] = (s.stats.lamps[kind] || 0) + 1;
  }
}

// ---- builders (origin at the ceiling point; everything hangs into −y) -------------------------------------------
function ceilingFan(THREE, s, drop) {
  const g = new THREE.Group(); g.name = `Ceiling Fan (${s.fanStyle})`;
  const add = (geo, m, y, name?) => { const x = new THREE.Mesh(geo, m); x.position.y = y; x.castShadow = false; x.receiveShadow = true; if (name) x.name = name; g.add(x); return x; };
  add(new THREE.CylinderGeometry(0.07, 0.055, 0.05, 20), s.M.fanBody, -0.025);
  add(new THREE.CylinderGeometry(0.011, 0.011, drop, 8), s.M.fanBody, -0.05 - drop / 2);
  const my = -0.05 - drop - 0.06;
  add(new THREE.CylinderGeometry(0.115, 0.13, 0.12, 24), s.M.fanBody, my, 'motor');
  const a0 = s.rng() * Math.PI * 2;
  const bladeGeo = new THREE.BoxGeometry(0.56, 0.012, 0.125).rotateX(0.14).translate(0.43, 0, 0);
  const ironGeo = new THREE.BoxGeometry(0.16, 0.014, 0.035).translate(0.14, 0, 0);
  for (let k = 0; k < 5; k++) {
    const a = a0 + k * Math.PI * 2 / 5;
    const b = add(bladeGeo, s.M.fanBlade, my - 0.02, 'blade'); b.rotation.y = a;
    const i = add(ironGeo, s.M.fanBody, my - 0.035); i.rotation.y = a;
  }
  const kit = add(new THREE.SphereGeometry(0.095, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), s.M.fanGlow, my - 0.06, 'light kit');
  kit.userData.fixture = 'fan';
  g.userData.bladeY = my - 0.02;
  return g;
}
function pendant(THREE, s, style, drop, r) {
  const g = new THREE.Group(); g.name = `Pendant (${style})`;
  const add = (geo, m, y) => { const x = new THREE.Mesh(geo, m); x.position.y = y; x.castShadow = false; g.add(x); return x; };
  add(new THREE.CylinderGeometry(0.055, 0.055, 0.025, 16), s.M.canopy, -0.0125);
  add(new THREE.CylinderGeometry(0.004, 0.004, drop, 6), s.M.canopy, -drop / 2);
  if (style === 'globe') {
    add(new THREE.SphereGeometry(r, 24, 16), s.M.globe, -drop - r).userData.fixture = 'pendant';
  } else {
    // a spun-metal dome, open underneath: the inside of the rim glows, the outside stays dark from above
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), s.M.shade, -drop - 0.025);
    add(new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), s.M.shade, -drop - r);
    add(new THREE.CircleGeometry(r * 0.94, 24).rotateX(Math.PI / 2), s.M.shadeGlow, -drop - r + 0.01).userData.fixture = 'pendant';
    add(new THREE.SphereGeometry(0.04, 12, 8), s.M.shadeGlow, -drop - r + 0.05).userData.fixture = 'pendant';
  }
  return g;
}

// a chandelier: a canopy, a rod, and six opal globes on a ring (rooms[].fixtures.ceiling 'chandelier')
function chandelier(THREE, s, drop: number) {
  const g = new THREE.Group(); g.name = 'Chandelier';
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = false; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 18), s.M.canopy, 0, -0.015, 0);
  add(new THREE.CylinderGeometry(0.008, 0.008, drop, 8), s.M.canopy, 0, -drop / 2, 0);
  const ring = add(new THREE.TorusGeometry(0.34, 0.009, 8, 40).rotateX(Math.PI / 2), s.M.canopy, 0, -drop, 0);
  ring.castShadow = true;
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, x = 0.34 * Math.cos(a), z = 0.34 * Math.sin(a);
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), s.M.canopy, x, -drop + 0.035, z);
    add(new THREE.SphereGeometry(0.065, 18, 12), s.M.globe, x, -drop + 0.1, z).userData.fixture = 'pendant';
  }
  return g;
}


// The head of the lamp nearest (cx, cz): the centre of the box round a lamp's lit parts (its meshes tagged userData.fixture = 'lamp': a
// drum, globe, cone, mushroom or tripod head, or the halo lamp's drum and diffuser), for the registry's floor, arc, tripod and table lamps and the
// halo lamp (kit-rules.ts LAMP_ITEMS). null when the room has none placed (the spec lists one that did not fit).
function lampHead_(items: Array<{ o: any; type: string }>, cx: number, cz: number): { x: number; y: number; z: number } | null {
  let best: { x: number; y: number; z: number; d: number } | null = null;
  for (const it of items) {
    if (!LAMP_ITEMS.has(it.type)) continue;
    let box: any = null;
    it.o.traverse((m: any) => {
      if (!m.isMesh || !m.userData || m.userData.fixture !== 'lamp') return;
      m.updateWorldMatrix(true, false);
      const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox.clone().applyMatrix4(m.matrixWorld);
      box = box ? box.union(b) : b;
    });
    if (!box) continue;
    const x = (box.min.x + box.max.x) / 2, y = (box.min.y + box.max.y) / 2, z = (box.min.z + box.max.z) / 2, d = Math.hypot(x - cx, z - cz);
    if (!best || d < best.d - 1e-9) best = { x, y, z, d };
  }
  return best;
}

// ---- dressLevel ------------------------------------------------------------------------------------------------
export function dressLevel(ctx) {
  const { THREE, spec, lv, y, H, put, placed, anchors, registerCeiling } = ctx;
  const cans: Array<{ p: Pt; ceil: number }> = [];   // the storey's recessed cans, built after the rooms
  const s = stateFor(ctx);
  tagWindowGlass(placed, s);
  // a room's lamp kind (by its name on this storey — the rooms loop tags each item with its room's name); a room
  // with a program (S3's composer dresses its own lamps: plan Completeness C9) keeps what it placed
  // Two rooms may share a name on a storey ("Bedroom", "Bedroom"): the lamp's own plan position then settles which.
  const roomIndex = new Map<string, number[]>();
  (lv.rooms || []).forEach((r, ri) => roomIndex.set(r.name, [...(roomIndex.get(r.name) || []), ri]));
  const roomOfLamp = (o): number | undefined => {
    const c = roomIndex.get(o.userData && o.userData.room); if (!c) return undefined;
    if (c.length === 1) return c[0];
    const inside = c.find(ri => { const b = lv.rooms[ri].bounds; return b && o.position.x >= b.x && o.position.x <= b.x + b.w && o.position.z >= b.z && o.position.z <= b.z + b.d; });
    return inside ?? c[0];
  };
  const lampOf = (o) => { const ri = roomOfLamp(o); return ri === undefined ? null : s.lamps.get(`${lv.id}#${ri}`) || null; };
  const programmed = new Set((lv.rooms || []).filter(r => r.program).map(r => r.name));
  const onThisStorey = o => o.position.y > y - 0.05 && o.position.y < y + H;
  // a composed room (S3's program) keeps the halo lamp it was authored — the composer dresses its own lamps — but its
  // registry lamps take the room's kind like any room's
  toneHaloLamps(placed.filter(o => onThisStorey(o) && !(o.userData && programmed.has(o.userData.room))), s, THREE, lampOf);
  varyRegistryLamps(placed.filter(onThisStorey), s, THREE, lampOf);

  // the ceiling underside at (x, z): this storey's own ceiling, or the slab of a storey above (0.18 m thick,
  // ceiling sheet 5 mm under it). null over a stairwell void: nothing hangs in a stairwell.
  const above = (spec.levels || []).filter(o => (o.y || 0) > y + 0.5 && (o.y || 0) < y + H + 0.5);
  const ceilAt = (x, z) => {
    let c = y + H - 0.02;
    for (const o of above) {
      if (!(o.footprint || []).some(r => inRect(x, z, r, 0))) continue;
      if ((o.voids || []).some(v => inRect(x, z, v, 0.35))) return null;
      c = Math.min(c, (o.y || 0) - 0.19);
    }
    return c;
  };
  // where the camera climbs or descends: the stair run (the eye rises through this storey's ceiling there) and,
  // on the hero's storey, the hero-reveal's line of approach (it drops in front of the hero from above)
  const DEG = Math.PI / 180;
  const keepOut: Array<{ a: Pt; b: Pt; r: number }> = [];
  // (read off anchors.stairs, which structure-build.ts fills for every flight up from this storey, not off the spec's
  // levels[].stairs: S2 widens that field to an array, and this reader must not care what shape it comes in)
  for (const st of (anchors && anchors.stairs || []).filter(s => s.from === lv.id)) {
    keepOut.push({ a: { x: st.bottom[0], z: st.bottom[2] }, b: { x: st.top[0], z: st.top[2] }, r: 1.5 });
  }
  if (spec.hero && spec.hero.level === lv.id && Array.isArray(spec.hero.at)) {
    const { fwd: f, at: [hx, hz] } = heroFrame(spec.hero);
    keepOut.push({ a: { x: hx + f[0] * 0.9, z: hz + f[1] * 0.9 }, b: { x: hx + f[0] * 9, z: hz + f[1] * 9 }, r: 0.8 });
  }
  const clearOf = (p: Pt, reach: number) => keepOut.every(k => segDist(p, k.a, k.b) > k.r + reach);
  const partitions = (lv.partitions || []).map(p => ({ a: { x: p.from[0], z: p.from[1] }, b: { x: p.to[0], z: p.to[1] } }));
  const offWalls = (p: Pt, reach: number) => partitions.every(w => segDist(p, w.a, w.b) > reach);

  // what stands in each room (items the builder placed on this storey), as world boxes
  const box = new THREE.Box3();
  const roomItems = name => placed.filter(o => o.userData && o.userData.room === name && o.userData.role === 'item' && o.position.y > y - 0.05 && o.position.y < y + H)
    .map(o => { o.updateMatrixWorld(true); box.setFromObject(o); return { o, type: o.userData.itemType, box: box.clone() }; }).filter(x => !x.box.isEmpty());
  // nothing tall under a hanging thing: the top of every item whose plan box comes within `reach` of p
  const tallestNear = (items, p: Pt, reach: number) => items.reduce((t, it) => (p.x > it.box.min.x - reach && p.x < it.box.max.x + reach && p.z > it.box.min.z - reach && p.z < it.box.max.z + reach) ? Math.max(t, it.box.max.y) : t, -Infinity);

  (lv.rooms || []).forEach((room, ri) => {
    const b = room.bounds; if (!b) return;
    const area = b.w * b.d; if (area < 1.2) return;
    const kind = roomKind(room);
    if (kind === 'outdoor') return;   // an outdoor program: no ceiling, nothing hangs
    // rooms[].fixtures: { fan, pendants, ceiling: 'flush' | 'chandelier' | 'none', lamp }
    const fx = room.fixtures || {};
    const fanOk = s.fans.get(`${lv.id}#${ri}`);   // true / false, or undefined: the geometry decides (today's rule)
    const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
    const items = roomItems(room.name);
    const hung = items.filter(i => HUNG.has(i.type)).map(i => ({ x: (i.box.min.x + i.box.max.x) / 2, z: (i.box.min.z + i.box.max.z) / 2 }));
    // Placed objects stand on the storey's floor (y), whatever height their contents hang at, so the editor's
    // storey filter (it sorts by the placed object's y) files a ground-floor fan under the ground floor. Hanging
    // things are placed one fixture (or one table's pendants) at a time: the shot gate tests the eye against
    // each placed object's box, and one box round a whole room's fixtures would call every descent a clip.
    const holder = (name: string, tags: string) => { const h = new THREE.Group(); h.name = `${name} · ${room.name}`; h.userData = { category: 'Lighting', tags, fixtures: true, room: room.name }; return h; };
    const place = (h, px: number, pz: number) => { const o = put(() => h, px, pz, y, null, 'fixture'); o.userData.room = room.name; return o; };
    const g = holder('Room Light', 'fixtures, light');
    const local = (x, yy, z, ox = cx, oz = cz) => new THREE.Vector3(x - ox, yy - y, z - oz);
    const occupied: Array<Pt & { r: number }> = hung.map(p => ({ ...p, r: 0.45 }));
    const inRoom = (p: Pt, m: number) => p.x > b.x + m && p.x < b.x + b.w - m && p.z > b.z + m && p.z < b.z + b.d - m;

    // pendants over tables and islands (not where the spec already hangs something over it): the longest island
    // and the biggest table in a room — a kitchen with two islands under six pendants read as a ceiling of dots
    const span = it => Math.max(it.box.max.x - it.box.min.x, it.box.max.z - it.box.min.z);
    const over = ['island', 'dining'].map(kindOf => items.filter(i => PENDANT_OVER[i.type] && (PENDANT_OVER[i.type] === 'island') === (kindOf === 'island'))
      .sort((p, q) => span(q) - span(p))[0]).filter(Boolean);
    for (const it of fx.pendants === 0 ? [] : over) {
      const role = PENDANT_OVER[it.type];
      const c = { x: (it.box.min.x + it.box.max.x) / 2, z: (it.box.min.z + it.box.max.z) / 2 };
      if (hung.some(h => Math.hypot(h.x - c.x, h.z - c.z) < 1.3)) continue;
      const ex = it.box.max.x - it.box.min.x, ez = it.box.max.z - it.box.min.z, alongX = ex >= ez, long = Math.max(ex, ez);
      const n = typeof fx.pendants === 'number' && fx.pendants > 0 ? Math.min(6, Math.round(fx.pendants)) : role === 'island' ? (long >= 2.1 ? 3 : 2) : role === 'round' ? 1 : (long >= 2.4 ? 2 : 1);
      const step = role === 'island' ? Math.min(0.78, (long - 0.5) / Math.max(1, n - 1)) : 0.95;
      const style = role === 'island' ? 'dome' : s.diningStyle;
      const r = style === 'globe' ? 0.14 : (role === 'island' ? 0.13 : (n === 1 ? 0.24 : 0.19));
      const cluster = holder('Pendants', 'fixtures, pendant, light');
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * step, p = { x: c.x + (alongX ? off : 0), z: c.z + (alongX ? 0 : off) };
        const ceil = ceilAt(p.x, p.z);
        if (ceil === null || ceil - y < 2.35 || !clearOf(p, r) || !inRoom(p, 0.25)) continue;
        const bottom = y + Math.min(1.95, ceil - y - 0.45);
        if (tallestNear(items.filter(i => i !== it), p, r) > bottom - 0.1) continue;
        const pg = pendant(THREE, s, style, Math.max(0.2, ceil - bottom - 2 * r), r);
        pg.position.copy(local(p.x, ceil, p.z, c.x, c.z)); cluster.add(pg);
        occupied.push({ ...p, r: r + 0.25 }); s.stats.pendants++;
      }
      if (cluster.children.length) place(cluster, c.x, c.z);
    }

    // a chandelier (rooms[].fixtures.ceiling 'chandelier'): a ring of globes at the room's centre, where the fan
    // would hang; it keeps the fan off, like an authored chandelier does
    if (fx.ceiling === 'chandelier') {
      const p = { x: cx, z: cz }, ceil = ceilAt(p.x, p.z);
      if (ceil !== null && ceil - y >= 2.4 && clearOf(p, 0.45) && tallestNear(items, p, 0.45) < ceil - 1.0) {
        const ch = chandelier(THREE, s, Math.max(0.35, Math.min(0.9, ceil - y - 2.05)));
        ch.position.y = ceil - y; const hh = holder('Chandelier', 'fixtures, chandelier, light'); hh.add(ch); place(hh, p.x, p.z);
        occupied.push({ ...p, r: 1.0 }); s.stats.pendants++;
      }
    }
    // a ceiling fan in a living room, bedroom or study that is big enough, at the centre or the nearest clear spot
    // (rooms[].fixtures.fan: true / false decides; under defaults 2 only a seeded minority of rooms may: kit-rules.ts)
    const minDim = Math.min(b.w, b.d);
    const fanRule = fanOk === undefined ? FAN_KINDS.has(kind) && area >= 8 && minDim >= 2.6 : fanOk && area >= 4 && minDim >= 2.0;
    if (fanRule && fx.ceiling !== 'chandelier') {
      const R = 0.72, alongX = b.w >= b.d;
      const cands = [0, -0.18, 0.18, -0.3, 0.3].map(f => ({ x: cx + (alongX ? f * b.w : 0), z: cz + (alongX ? 0 : f * b.d) }));
      for (const p of cands) {
        const ceil = ceilAt(p.x, p.z);
        if (ceil === null || ceil - y < 2.45 || !inRoom(p, R + 0.15) || !offWalls(p, R + 0.1) || !clearOf(p, R)) continue;
        if (occupied.some(o => Math.hypot(o.x - p.x, o.z - p.z) < o.r + R)) continue;
        const drop = Math.min(1.6, Math.max(0.1, ceil - y - 2.62));   // blades ~2.45 m up under a tall ceiling
        const fan = ceilingFan(THREE, s, drop);
        if (tallestNear(items, p, R) > ceil + fan.userData.bladeY - 0.15) continue;
        fan.position.y = ceil - y; const fh = holder('Ceiling Fan', 'fixtures, fan, light'); fh.add(fan); place(fh, p.x, p.z);
        occupied.push({ ...p, r: R + 0.12 }); s.stats.fans++;
        break;
      }
    }

    // recessed cans on a grid, ~2 m apart, 0.7 m in from the walls; off the fan, the pendants and the stair.
    // Collected for the whole storey and built after the rooms (below).
    const m = 0.7, spacing = 2.0;
    const axis = (len: number) => { const span = len - 2 * m; if (span < 0.5) return [len / 2]; const n = Math.min(5, Math.max(1, Math.round(span / spacing) + 1)); return n === 1 ? [len / 2] : Array.from({ length: n }, (_, i) => m + span * i / (n - 1)); };
    if (fx.ceiling !== 'none') for (const ox of axis(b.w)) for (const oz of axis(b.d)) {
      const p = { x: b.x + ox, z: b.z + oz };
      const ceil = ceilAt(p.x, p.z);
      if (ceil === null || !clearOf(p, 0.1) || !offWalls(p, 0.3)) continue;
      if (occupied.some(o => Math.hypot(o.x - p.x, o.z - p.z) < o.r)) continue;
      if (tallestNear(items, p, 0.1) > ceil - 0.08) continue;
      cans.push({ p, ceil });
    }

    // The room's light: warm, no shadows, just under the middle of the ceiling, aimed straight down. Nothing
    // casts a shadow, so what keeps it in its room is geometry. A point light lit everything in reach whatever
    // was in the way (the roof over it, the upper storey's façade, the lawn). The first cone, sized to the floor,
    // stayed in but only ever lit a disc on the floor: to reach the walls above ~0.9 m it would have had to
    // reach the lawn and the lower roofs too, which lie at the same angle below the light as a wall's foot.
    // What does separate them is distance: every point of the room's own side walls lies within
    // hypot(drop, rs) of the light, and the lawn or a lower roof outside them lies further. So the cone is wide
    // (it takes in the side walls to ~1.9 m; its soft edge is the scallop high on the wall) and the cutoff sits
    // just past those walls' foot — three.js fades a light to 0 AT its distance, (1 − (d/D)⁴)², so the walls
    // come out brighter than the middle of the floor and the room reads as a lit box, which is how Pascal's
    // dusk cut views look. The end walls of a long room fall off; nothing outside is lit past a faint band.
    const litRoom = s.lit.get(`${lv.id}#${ri}`);
    if (litRoom) {
      const c0 = ceilAt(cx, cz) ?? (y + H - 0.02);
      const ly = Math.min(c0 - 0.25, y + 2.6), drop = Math.max(1, ly - y);
      const rs = Math.min(b.w, b.d) / 2;
      const angle = Math.min(FILL_ANGLE_MAX, Math.min(80, Math.max(50, Math.atan(rs / Math.max(0.35, drop - 1.9)) / DEG)) * DEG);
      const distance = Math.hypot(drop + 0.35, rs + 0.1);
      // intensity: set by what the floor under the light receives (room kind × area, 1.3× the first cone's: the
      // pool is smaller now), the window's loss there made up to at most 2× (a hall's walls, close to the light,
      // would otherwise glare)
      const decay = 1, win = (1 - (drop / distance) ** 4) ** 2;
      // a garage at dusk is not a living room; a hall or landing is lit for passing through, and its walls sit
      // close enough to the light that the 18 floor would blow them (and the stairwell below) out white
      const floorE = 0.26 * Math.min(36, Math.max(18, 12 + 0.8 * area)) * (kind === 'service' ? 0.6 : kind === 'hall' ? 0.45 : 1) * Math.min(1, Math.max(0.55, rs / 1.6));
      // the lamp that will pool this room's light: of the room's lamps, the head nearest its centre (ties by item order)
      const pool = litRoom.lamp ? lampHead_(items, cx, cz) : null;
      const base = (pool ? LAMP_ROOM_FILL_K : ROOM_FILL_K) * floorE * drop ** decay / Math.max(0.5, win);
      const light = new THREE.SpotLight(s.warm, base * s.gain, distance, angle, FILL_PENUMBRA, decay);
      light.name = 'Fixture light'; light.castShadow = false;
      light.position.copy(local(cx, ly, cz));
      light.target.position.copy(local(cx, y, cz));
      light.userData.fixtureLight = true;   // not `fixture`: that tag means "a mesh whose emissive the gain scales"
      light.visible = !hideOffGain() || s.gain >= FILL_ON_GAIN;
      g.add(light, light.target);
      s.lights.push({ light, base, room: room.name });
      s.stats.lights++;
      if (pool) {
        const diag = Math.hypot(b.w, b.d), pbase = LAMP_POOL_I * Math.min(LAMP_POOL_MAX, Math.sqrt(area) / 3);
        const pl = new THREE.PointLight(s.warm, pbase * s.gain, LAMP_POOL_REACH * diag, LAMP_POOL_DECAY);
        pl.name = 'Lamp pool'; pl.castShadow = false;
        pl.position.copy(local(pool.x, pool.y, pool.z));
        pl.userData.fixtureLight = true; pl.userData.lampPool = true;
        pl.visible = !hideOffGain() || s.gain >= FILL_ON_GAIN;
        g.add(pl);
        s.lights.push({ light: pl, base: pbase, room: room.name });
        s.stats.lights++; s.stats.pools++;
      }
    }

    if (g.children.length) place(g, cx, cz);
  });

  // The storey's cans: one instanced trim + lens pair per ceiling height (a storey half under a mezzanine has
  // two), registered with the page as part of the ceiling. The page hides a ceiling while the eye is above it —
  // a cut view, the descent from above — and the cans go with it. Before, each can carried a grey housing
  // above the ceiling line for the cut view to see, and every cut and exterior-from-above frame came out
  // peppered with floating grey pegs (Pascal's cut views show none: the ceiling and what is in it are gone).
  // A ceiling is passable to the shot gate, so one flat storey-wide set is safe; it is also 2 draw calls a
  // storey where the per-room sets were 3 a room.
  const heights = [...new Set(cans.map(c => Math.round(c.ceil * 100)))].sort((p, q) => p - q);
  for (const hc of heights) {
    const set = cans.filter(c => Math.round(c.ceil * 100) === hc);
    const h = new THREE.Group(); h.name = `Recessed Lights · ${lv.id} @ ${(hc / 100).toFixed(2)} m`;
    h.userData = { category: 'Lighting', tags: 'fixtures, recessed, light', fixtures: true, level: lv.id };
    const dummy = new THREE.Object3D();
    for (const [name, geo, mat, dy] of [['trim', s.G.trim, s.M.trim, -0.004], ['lens', s.G.lens, s.M.lens, -0.006]] as Array<[string, any, any, number]>) {
      const im = new THREE.InstancedMesh(geo, mat, set.length); im.name = `Recessed ${name}`;
      set.forEach(({ p, ceil }, i) => { dummy.position.set(p.x, ceil + dy - y, p.z); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingBox(); im.computeBoundingSphere();
      im.castShadow = false; im.receiveShadow = false;
      if (name === 'lens') im.userData.fixture = 'recessed';
      h.add(im);
    }
    const o = put(() => h, 0, 0, y, null, 'fixture');
    if (typeof registerCeiling === 'function') registerCeiling(o, hc / 100);
    s.stats.recessed += set.length;
  }
}
