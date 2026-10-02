#!/usr/bin/env -S node --experimental-strip-types
// The pure parts of the "frame" realism feature, without a browser: the Halton jitter (assets/viewer-composer.ts needs a GPU for the rest),
// the shader patch that clips a room's spot light to its room (assets/light-guard.ts), the box of a room, and the proof that the
// uniform slots match three's own light order. The picture itself is checked on the GPU by scripts/live-checks/frame.mts.
//
//   node --experimental-strip-types scripts/test-frame-units.mts
// @check-house quick
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { installLightGuard, spotClipInstalled, createSpotClip, roomBoxes, packBox, MAX_SPOTS } from '../assets/light-guard.js';
import { POOL } from '../assets/realism-frame.js';

let bad = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `\n    ${detail}`}`); };
const G: any = globalThis;

// ---- the jitter: viewer-composer.ts imports GPU-side addons, so its halton() is read from the source text and run here
{
  const src = (await import('node:fs')).readFileSync(new URL('../assets/viewer-composer.ts', import.meta.url), 'utf8');
  const m = src.match(/export function halton\(i: number, b: number\): number \{([\s\S]*?)\n\}/);
  const halton = new Function('i', 'b', m![1]) as (i: number, b: number) => number;
  check(halton(1, 2) === 0.5 && halton(2, 2) === 0.25 && halton(3, 2) === 0.75 && Math.abs(halton(1, 3) - 1 / 3) < 1e-12 && Math.abs(halton(2, 3) - 2 / 3) < 1e-12, 'halton(base 2 / 3) is the radical inverse', `${halton(1, 2)} ${halton(2, 2)} ${halton(3, 2)} ${halton(1, 3)} ${halton(2, 3)}`);
  const pts = Array.from({ length: 16 }, (_, k) => [halton(k + 1, 2), halton(k + 1, 3)]);
  check(pts.every(p => p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < 1), 'the jitter stays inside one pixel');
  // 16 samples must cover the 4 x 4 grid of cells without leaving one empty more than twice (low discrepancy), and never repeat
  const cells = new Set(pts.map(p => `${Math.floor(p[0] * 4)},${Math.floor(p[1] * 4)}`));
  check(cells.size >= 10 && new Set(pts.map(p => p.join())).size === 16, '16 jitter samples are distinct and spread over the pixel', `${cells.size} of 16 cells`);
  const mean = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]).map(v => v / 16);
  check(Math.abs(mean[0] - 0.5) < 0.05 && Math.abs(mean[1] - 0.5) < 0.05, 'and centred: the mean of the jitter is the pixel centre (the average does not drift the picture)', mean.join());
}

check(POOL.penumbra === 0.8 && POOL.intensity > 1 && POOL.intensity < 1.5, 'the lamp pool: penumbra 0.8, intensity regained, not blown up');

// ---- the shader patch, against the vendored three's own chunk text
G.location = { search: '?mode=view' };
const chunkBefore = (THREE as any).ShaderChunk.lights_fragment_begin as string;
check(installLightGuard(THREE) === true, 'installLightGuard patches r169\'s lights_fragment_begin');
const chunk = (THREE as any).ShaderChunk.lights_fragment_begin as string;
check(spotClipInstalled(), 'the room clip is installed when the page does not switch it off');
check(chunk !== chunkBefore && chunk.includes('if ( directLight.visible ) {'), 'the RE_Direct guard is in');
check((chunk.match(/vhClip\[ UNROLLED_LOOP_INDEX \]/g) || []).length === 1 && chunk.includes('vhB.z > 0.0') && (chunk.match(/vec3 vhW = /g) || []).length === 1 && chunk.indexOf('vec3 vhW') < chunk.indexOf('#pragma unroll_loop_start') && chunk.includes('viewMatrix'), 'the clip test is in the spot loop, once, indexed by the unrolled loop index, with the fragment\'s world position (from the draw\'s own view matrix) computed once before the loops');
const spotBlock = chunk.slice(chunk.indexOf('getSpotLightInfo'), chunk.indexOf('#pragma unroll_loop_end', chunk.indexOf('getSpotLightInfo')));
check(spotBlock.indexOf('vhClip[') > spotBlock.indexOf('getSpotLightInfo') && spotBlock.indexOf('vhClip[') < spotBlock.indexOf('RE_Direct'), 'and it runs after the cone test and before the BRDF');
// three unrolls the spot loop (WebGLProgram.unrollLoops: the loop body is pasted N times with NO braces round it, so a declaration made
// in the loop body is a redefinition from the second light on; portal:test, which compiles the shaders, caught this once)
{
  const unroll = (s: string) => s.replace(/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g, (_m, a, b, body) => { let r = ''; for (let k = parseInt(a); k < parseInt(b); k++) r += body.replace(/\[\s*i\s*\]/g, `[ ${k} ]`).replace(/UNROLLED_LOOP_INDEX/g, String(k)); return r; });
  const spotLoop = chunk.slice(chunk.indexOf('#if ( NUM_SPOT_LIGHTS > 0 )'), chunk.indexOf('#if ( NUM_DIR_LIGHTS > 0 )'));
  const flat = unroll(spotLoop.replace(/NUM_SPOT_LIGHTS/g, '3').replace(/NUM_POINT_LIGHTS/g, '0'));
  // declarations at brace depth 0 of the unrolled loop must be unique
  let depth = 0, names: string[] = [], dup = '';
  const re = /[{}]|\b(?:vec[234]|float|int|bool|mat3|SpotLight|PointLight)\s+([A-Za-z_]\w*)\s*(?:[=;,])/g;
  const inner = flat.slice(flat.indexOf('for') >= 0 ? 0 : 0);
  for (let m; (m = re.exec(inner)); ) { if (m[0] === '{') depth++; else if (m[0] === '}') depth--; else if (depth === 0 && !m[0].startsWith('SpotLight spotLight')) { if (names.includes(m[1])) dup = m[1]; names.push(m[1]); } }
  check(flat.includes('vhClip[ 2 ]') && flat.includes('vhClip[ 0 ]') && !dup, 'the clip survives three\'s loop unrolling: one block a light, no redeclared name', dup ? `'${dup}' is declared twice at the loop\'s scope` : '');
}
check(((THREE as any).ShaderChunk.lights_pars_begin as string).includes('uniform vec4 vhClip[ NUM_SPOT_LIGHTS ]'), 'the uniform arrays are declared with the spot lights');
const lib = (THREE as any).ShaderLib;
check(['lambert', 'phong', 'standard', 'physical', 'toon'].every(k => lib[k].uniforms.vhClip.value === lib.standard.uniforms.vhClip.value) && lib.standard.uniforms.vhClip.value instanceof Float32Array, 'every lit material type carries the same shared Float32Array');
// a material's own copy (three clones the uniforms when it makes its first program) must still share the Vector4s
{
  const own = THREE.UniformsUtils.clone(lib.standard.uniforms);
  check(own.vhClip.value === lib.standard.uniforms.vhClip.value, 'UniformsUtils.clone hands the typed array on by reference, so one write reaches every material and three never copies it per material');
}

// ---- the boxes of a house: a two-storey spec, lamps at the middle of their rooms
const house = {
  spec: { levels: [
    { id: 'ground', rooms: [{ bounds: { x: 0, z: 0, w: 4, d: 3 } }, { bounds: { x: 4, z: 0, w: 3, d: 3 } }] },
    { id: 'upper', rooms: [{ bounds: { x: 0, z: 0, w: 7, d: 3 } }] },
  ] },
  anchors: { levels: { ground: { y: 0, height: 2.8 }, upper: { y: 3.0, height: 2.8 } } },
};
const mkLamp = (x: number, y: number, z: number, o: Partial<{ castShadow: boolean; visible: boolean; parent: any }> = {}) => {
  const l = new (THREE as any).SpotLight(0xffffff, 1, 5, 1, 0.45, 1);
  l.position.set(x, y, z); l.userData.fixtureLight = true; l.castShadow = !!o.castShadow; l.visible = o.visible !== false; l.updateMatrixWorld(true);
  return l;
};
const a = mkLamp(2, 2.5, 1.5), b = mkLamp(5.5, 2.5, 1.5), c = mkLamp(3.5, 5.5, 1.5);
const boxes = roomBoxes(house, [a, b, c]);
const ba = boxes.get(a)!, bb = boxes.get(b)!, bc = boxes.get(c)!;
check(!!ba && ba.lo[0] < 0 && ba.hi[0] > 4 && ba.hi[0] < 4.2 && ba.lo[1] < 0 && ba.hi[1] > 2.8 && ba.hi[1] < 3.0, 'a ground-floor lamp gets its room: sideways a wall\'s half thickness wider, up to its ceiling and no further', JSON.stringify(ba));
check(!!bb && bb.lo[0] < 4 && bb.lo[0] > 3.8 && bb.hi[0] > 7, 'the next room gets its own box', JSON.stringify(bb));
check(!!bc && bc.lo[1] > 2.9 && bc.hi[1] > 1000, 'the top storey\'s box is open to the sky (a ceiling may vault)', JSON.stringify(bc));
check(roomBoxes(house, [mkLamp(10, 2.5, 10)]).size === 0, 'a lamp that is not at the middle of any room gets no box (and so no clip)');

// ---- the mapping: a fake scene and renderer in three's own structure
const scene = new (THREE as any).Scene();
const grp = new (THREE as any).Group(); scene.add(grp);
const hidden = new (THREE as any).Group(); hidden.visible = false; scene.add(hidden);
grp.add(a); grp.add(b); hidden.add(c);
const sun = new (THREE as any).DirectionalLight(0xffffff, 1); scene.add(sun);
const caster = mkLamp(2, 2.5, 1.5, { castShadow: true }); caster.userData.fixtureLight = false; scene.add(caster);   // a shadow-casting spot sorts first
const camera = new (THREE as any).PerspectiveCamera(50, 1.7, 0.1, 100);
camera.position.set(1, 6, 9); camera.lookAt(3, 1, 1); camera.updateMatrixWorld(true);
const uniforms: any = { spotLights: { value: [] as any[] } };
const setState = (arr: any[]) => { uniforms.spotLights.value.length = 0; uniforms.spotLights.value.push(...arr); };   // three mutates its array in place
let frame = 0;
const mat = new (THREE as any).MeshStandardMaterial(); const mesh = new (THREE as any).Mesh(new (THREE as any).BufferGeometry(), mat); scene.add(mesh);
const renderer: any = { info: { render: { get frame() { return frame; } } }, properties: { get: () => ({ uniforms }) } };
const clip = createSpotClip({ scene, renderer, house: () => house })!;
check(!!clip && clip.mapped === 3, 'createSpotClip finds the room lamps and boxes them (the one in the hidden subtree too, it is just not drawn)', `mapped ${clip && clip.mapped}`);
clip.apply();
check(clip.update(camera), 'update() fills the slots');
const slots = clip.slotLights();
check(slots.length === 3 && slots[0] === caster && slots[1] === a && slots[2] === b, 'slot order is three\'s: shadow caster first, then scene order, an invisible subtree skipped', slots.map((l: any) => (l === caster ? 'caster' : l === a ? 'a' : l === b ? 'b' : 'c')).join());
const shared = (THREE as any).ShaderLib.standard.uniforms;
const D: Float32Array = shared.vhClip.value;
// decode a slot the way the shader does
const unpack = (k: number) => { const [cx, cz, z, w] = [D[k * 4], D[k * 4 + 1], D[k * 4 + 2], D[k * 4 + 3]]; const hw = Math.floor(z / 4096), hd = z - hw * 4096, yh = Math.floor(w / 4096), yl = w - yh * 4096; return { lo: [cx - hw * 0.01, yl * 0.01 - 10, cz - hd * 0.01], hi: [cx + hw * 0.01, yh * 0.01 - 10, cz + hd * 0.01], on: z > 0 }; };
const within = (u: any, bx: any) => u.on && [0, 1, 2].every(i => u.lo[i] <= bx.lo[i] + 1e-4 && u.lo[i] >= bx.lo[i] - 0.021 && u.hi[i] >= bx.hi[i] - 1e-4 && u.hi[i] <= bx.hi[i] + 0.021);
check(within(unpack(1), boxes.get(a)!) && within(unpack(2), boxes.get(b)!) && !unpack(0).on && !unpack(3).on, 'the box of slot i is in the shared array (packed, decoded to within 2 cm and never smaller), and a light without a box (the caster) or a slot past the lights is unclipped', JSON.stringify([unpack(1), boxes.get(a)]));
{
  const bx = { lo: [-3.17, -0.03, 4.41], hi: [12.5, 9.31, 20.77] }, u = (() => { const q = packBox(bx); const hw = Math.floor(q[2] / 4096), yh = Math.floor(q[3] / 4096); return { hw: hw * 0.01, hd: (q[2] - hw * 4096) * 0.01, yh: yh * 0.01 - 10, yl: (q[3] - yh * 4096) * 0.01 - 10, cx: q[0], cz: q[1] }; })();
  check(Math.abs(u.cx - 4.665) < 1e-5 && u.hw >= 7.835 - 1e-6 && u.hw <= 7.855 && u.hd >= 8.18 - 1e-6 && u.hd <= 8.2 && u.yl <= -0.03 + 1e-6 && u.yl >= -0.05 && u.yh >= 9.31 - 1e-6 && u.yh <= 9.33, 'packBox rounds outwards to the centimetre', JSON.stringify(u));
  const top = packBox({ lo: [0, 0, 0], hi: [4, 1e4, 4] });
  check(Math.floor(top[3] / 4096) === 4095 && Number.isInteger(top[2]) && top[2] < 2 ** 24 && top[3] < 2 ** 24, 'an open top is the packing\'s largest height, and both packed floats stay below 2^24 (exact in float32)');
}

// three's state after a draw: view-space positions, the cone of each light
const threeState = (lights: any[], cam: any) => lights.map(l => {
  const p = new (THREE as any).Vector3().setFromMatrixPosition(l.matrixWorld).applyMatrix4(cam.matrixWorldInverse);
  return { position: p, distance: l.distance, coneCos: Math.cos(l.angle) };
});
camera.updateMatrixWorld(true); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
check(clip.verify() === true, 'verify() has nothing to prove before a frame is drawn');
frame++; setState(threeState(slots, camera));
check(clip.verify() === true && clip.stats().mismatches === 0 && clip.stats().on, 'verify() accepts three\'s own order');
// a different camera drew last (a mirror): view-space positions move, the proof must not care
const other = new (THREE as any).PerspectiveCamera(70, 1, 0.1, 50); other.position.set(-8, 3, -4); other.lookAt(2, 1, 1); other.updateMatrixWorld(true); other.matrixWorldInverse.copy(other.matrixWorld).invert();
clip.update(camera); frame++; setState(threeState(clip.slotLights(), other));
check(clip.verify() === true, 'verify() holds when another camera drew last');
// the wrong order
clip.update(camera); frame++; const wrong = clip.slotLights().slice(); [wrong[1], wrong[2]] = [wrong[2], wrong[1]]; setState(threeState(wrong, camera));
b.distance = 7;   // (so that a swap of a and b shows in the cone too, not only in the geometry)
check(clip.verify() === false && clip.stats().mismatches === 1 && !clip.stats().on && /slot/.test(clip.stats().lastMismatch), 'verify() catches two slots swapped, and the clip switches itself off', clip.stats().lastMismatch);
check(D.every((v, k) => k % 4 !== 2 || v === 0), 'every half width is 0 after a failed proof (the shader clips nothing)');
b.distance = 5;
// retry after 90 frames, from clean state
let n = 0; for (; n < 100 && !clip.update(camera); n++);
check(clip.stats().strikes === 1 && n >= 80 && n <= 95, 'after 90 frames it tries again', `n ${n}`);
frame++; setState(threeState(clip.slotLights(), camera));
check(clip.verify() === true && clip.stats().on, 'and the proof, now right, keeps it on');
// a count mismatch (three dropped a light): off
clip.update(camera); frame++; setState(threeState(clip.slotLights().slice(0, 2), camera));
check(clip.verify() === false, 'a different number of spots in three is a mismatch');
clip.restore();
check(D.every((v, k) => k % 4 !== 2 || v === 0) && clip.update(camera) === false, 'restore() clears every box and update() stays out');
check(MAX_SPOTS >= 16 && D.length === MAX_SPOTS * 4, 'the array holds the 16 room lamps a house can have');

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
