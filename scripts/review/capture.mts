#!/usr/bin/env -S node --experimental-strip-types
// R1: capture the review set R24 (plan 5.1, 8.1) from the product composer path: __houseSnapshot at 1280 x 720 (GTAO, bloom, grade,
// SMAA, 2x supersample), walls up and roof on, 1.5 m eye, 60 degrees, from two opposite corners of each of 24 rooms across the nine
// audited homes; day for all of them, dusk and night too on the five bench rooms; and one NW day frame per room with the
// procedural 1.7 m mannequin standing in it (the scale reference of the sheets). Ported from the audit's
// repo-recon/interior-look/capture.mts; the camera is scripts/review/cameras.mts, a pure function of a room's bounds.
//
//   node --experimental-strip-types scripts/review/capture.mts --set before                 the frozen BEFORE (refuses unless the product code equals baseline/stage0-green)
//   node --experimental-strip-types scripts/review/capture.mts --set after-<label>          an AFTER: the same cameras (read from before.manifest.json), any product code
//   options: --out <dir> (default <REVIEW_DIR>/<set>)   --only a,b (room ids)   --no-scale   --tods day,dusk   --allow-drift (before: skip the tag check)
//            --manifest <file> (where to write the manifest; default <out>/<set>.manifest.json; for `before` it is also copied to test/review/baselines/)
//
// Exit 0 when every frame was written. The manifest has no timestamp: two captures of an unchanged tree write the same manifest
// if the renderer is deterministic (scripts/review/verify.mts compares two).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, REVIEW_DIR, BEFORE_TAG, parseArgs, productFingerprint, productKey, recordProvenance, productDiffersFromTag, round, machine, writeText } from './lib.mts';
import { R24, r24Shots, cornerCam, RES, QUALITY, SIZE, MANNEQUIN, MANNEQUIN_HEIGHT, type Cam, type Corner, type Tod } from './cameras.mts';
import { startSession, burnColdContext, roomsOf } from './page.mts';
import { BEFORE_MANIFEST, loadManifest, manifestText, type Manifest, type ManifestShot } from './manifest.mts';
import { sha256 } from './lib.mts';

const args = parseArgs(process.argv.slice(2));
const set = args.set && args.set !== 'true' ? args.set : '';
if (!set) { console.error('--set before | after-<label> is required'); process.exit(2); }
const OUT = path.resolve(args.out && args.out !== 'true' ? args.out : path.join(REVIEW_DIR, set));
const only = args.only ? new Set(args.only.split(',')) : null;
const todFilter = args.tods ? new Set(args.tods.split(',')) : null;
const withScale = args['no-scale'] !== 'true';
const isBefore = set === 'before';

// ---- provenance: a BEFORE must be the baseline tag's product code, clean
const fp = productFingerprint('HEAD');
if (fp.dirty.length) { console.error(`the product code has uncommitted changes (${fp.dirty.slice(0, 4).join('; ')}): commit or stash them first`); process.exit(2); }
if (isBefore && args['allow-drift'] !== 'true') {
  const drift = productDiffersFromTag();
  if (drift.length) { console.error(`HEAD's product code differs from ${BEFORE_TAG} in: ${drift.join(', ')}. The BEFORE is frozen from that tag (--allow-drift to override, never for the committed set).`); process.exit(2); }
}

// ---- the cameras: a BEFORE derives them from the rooms, every other set reads them from before.manifest.json (unless --derive)
const derive = isBefore || args.derive === 'true';   // --derive: cameras from the rooms, not from the manifest (probes and determinism checks)
const ref: Manifest | null = derive ? null : (fs.existsSync(BEFORE_MANIFEST) ? loadManifest(BEFORE_MANIFEST) : null);
if (!derive && !ref) { console.error(`no ${path.relative(ROOT, BEFORE_MANIFEST)}: capture the BEFORE first`); process.exit(2); }

const wanted = r24Shots().filter(s => (!only || only.has(s.room)) && (!todFilter || todFilter.has(s.tod)) && (withScale || s.kind !== 'scale'));
const houses = [...new Set(wanted.map(s => s.house))];
fs.mkdirSync(OUT, { recursive: true });

const session = await startSession();
const shots: ManifestShot[] = [];
const log: any[] = [];
let failed = 0;
const skipped: string[] = [];
try {
  for (const house of houses) {
    const t0 = process.hrtime.bigint();
    await burnColdContext(session, house);
    const w = await session.open(house, { res: RES });
    const rooms = await roomsOf(w.page);
    // order: every day frame, then dusk, then night, then the scale frames (day)
    const order = (t: Tod) => ({ day: 0, golden: 1, dusk: 2, night: 3 }[t]);
    const mine = wanted.filter(x => x.house === house).sort((a, b) => (a.kind === 'scale' ? 1 : 0) - (b.kind === 'scale' ? 1 : 0) || order(a.tod) - order(b.tod));
    let curTod: string | null = null;
    for (const s of mine) {
      const def = R24.find(r => r.id === s.room)!;
      const refShot = ref?.shots.find(x => x.id === s.id);
      let room = rooms.find(r => r.name.toLowerCase() === def.room.toLowerCase());
      if (ref && refShot) room = rooms.find(r => r.name === refShot.roomName && r.lv === refShot.level) || room;
      if (!room) { console.error(`  ✗ ${s.id}: no room "${def.room}" in ${house}`); failed++; continue; }
      const cam: Cam = refShot ? refShot.camera : cornerCam(room.b, room.y, s.corner as Corner);
      if (curTod !== s.tod) { await w.page.evaluate((t: string) => (window as any).__houseSetLighting(t), s.tod); curTod = s.tod; }
      const r = await w.page.evaluate(({ cam, res, quality, scale, parts, room, height }: any) => {
        const W = window as any, d = W.__houseDebug(), c = d.camera, T = W.__THREE;
        c.position.set(...cam.pos); c.lookAt(...cam.target); c.fov = cam.fov; c.near = cam.near; c.updateProjectionMatrix();
        let figure: any = null, info: any = null;
        if (scale) {
          // where the figure stands: the free floor point in front of the eye, in view, about 3.8 m away, away from every floor item and wall
          const b = room.b, y0 = room.y; c.updateMatrixWorld(true);
          const boxes: number[][] = [];
          d.scene.traverse((o: any) => {
            const u = o.userData || {};
            if (!u.itemType || u.room !== room.name || u.onSurface || u.mounted) return;
            const bb = new T.Box3().setFromObject(o);
            if (bb.max.y - y0 < 0.08 || bb.min.y - y0 > 1.7) return;   // rugs and things hung above head height do not block
            boxes.push([bb.min.x, bb.min.z, bb.max.x, bb.max.z]);
          });
          const clear = (x: number, z: number) => { let m = 9; for (const [x0, z0, x1, z1] of boxes) m = Math.min(m, Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1))); return m; };
          let best: any = null;
          // tiers, strictest first: a small bath has no 0.35 m of clear floor 2 m from the eye, so it settles for less (recorded as `tier`)
          const TIERS = [{ d0: 2.0, cl: 0.35, ndc: 0.85, m: 0.5 }, { d0: 1.5, cl: 0.2, ndc: 0.92, m: 0.4 }, { d0: 1.1, cl: 0.08, ndc: 0.97, m: 0.3 }];
          let tier = 0;
          for (; tier < TIERS.length && !best; tier++) {
            const t = TIERS[tier];
            for (let gx = b.x + t.m; gx <= b.x + b.w - t.m + 1e-9; gx += 0.25) for (let gz = b.z + t.m; gz <= b.z + b.d - t.m + 1e-9; gz += 0.25) {
              const dx = gx - cam.pos[0], dz = gz - cam.pos[2], dist = Math.hypot(dx, dz);
              if (dist < t.d0 || dist > 5.5) continue;
              // the whole figure, feet to crown, inside the frame
              const f = new T.Vector3(gx, y0, gz).project(c), h = new T.Vector3(gx, y0 + height, gz).project(c);
              if (Math.abs(f.x) > t.ndc - 0.05 || Math.abs(h.x) > t.ndc - 0.05 || Math.abs(f.y) > t.ndc || Math.abs(h.y) > t.ndc || f.z > 1 || h.z > 1) continue;
              const cl = Math.min(clear(gx, gz), 1.0);
              if (cl < t.cl) continue;
              const score = cl - 0.08 * Math.abs(dist - 3.8);   // close enough to read, far enough to stand in the frame whole
              if (!best || score > best.score + 1e-9) best = { x: gx, z: gz, cl, score };
            }
          }
          if (best) {
            const g = new T.Group(); g.name = 'review mannequin';
            const mat = new T.MeshStandardMaterial({ color: 0xb9b3a8, roughness: 0.9, metalness: 0 });
            for (const p of parts) {
              const geo = p.shape === 'sphere' ? new T.SphereGeometry(p.dims[0], 24, 16) : p.shape === 'cyl' ? new T.CylinderGeometry(p.dims[0], p.dims[1], p.dims[2], 24) : new T.BoxGeometry(p.dims[0], p.dims[1], p.dims[2]);
              const m = new T.Mesh(geo, mat); m.position.set(...p.at); if (p.scale) m.scale.set(...p.scale); m.castShadow = true; m.receiveShadow = true; g.add(m);
            }
            const yaw = Math.atan2(cam.pos[0] - best.x, cam.pos[2] - best.z);
            g.position.set(best.x, y0, best.z); g.rotation.y = yaw; d.scene.add(g); g.updateMatrixWorld(true);
            figure = g; info = { at: [Math.round(best.x * 1000) / 1000, Math.round(best.z * 1000) / 1000], yaw: Math.round(yaw * 1000) / 1000, clearance: Math.round(best.cl * 1000) / 1000, tier };
          }
        }
        const url = W.__houseSnapshot({ res, dressing: { walls: 'up', roof: 'on' }, quality });
        if (figure) { d.scene.remove(figure); figure.traverse((o: any) => { if (o.isMesh) { o.geometry.dispose(); } }); figure.children[0] && figure.children[0].material.dispose(); }
        return { url, info };
      }, { cam, res: RES, quality: QUALITY, scale: s.kind === 'scale', parts: MANNEQUIN, room, height: MANNEQUIN_HEIGHT });
      if (s.kind === 'scale' && !r.info) { console.error(`  – ${s.id}: no free floor in view for the mannequin, frame skipped`); skipped.push(s.id); continue; }
      const buf = Buffer.from(r.url.slice(r.url.indexOf(',') + 1), 'base64');
      fs.writeFileSync(path.join(OUT, s.file), buf);
      shots.push({ id: s.id, file: s.file, house, room: s.room, roomName: room.name, level: room.lv, program: room.program, tod: s.tod, corner: s.corner, kind: s.kind, camera: cam, res: `${SIZE.w}x${SIZE.h}`, sha256: sha256(buf), bytes: buf.length, ...(s.kind === 'scale' ? { mannequin: r.info } : {}) });
      console.log(`  wrote ${s.file}  ${(buf.length / 1024).toFixed(0)} KB  ${sha256(buf).slice(0, 12)}`);
    }
    if (w.errors.length) { console.error(`  ✗ ${house}: page errors: ${w.errors.slice(0, 3).join(' | ')}`); failed++; }
    await w.close();
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;
    log.push({ house, seconds: round(secs, 1), frames: mine.length, load1: machine().load1 });
    console.log(`${house}: ${mine.length} frames in ${secs.toFixed(0)} s (load ${machine().load1})`);
  }
} finally { await session.close(); }

const order = new Map(r24Shots().map((s, i) => [s.id, i]));
shots.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
const manifest: Manifest = {
  schema: 1, set, tag: BEFORE_TAG, product: productKey(fp),
  renderer: { profile: 'macos-metal', chromium: session.version, supersample: 2, res: RES, quality: QUALITY, dressing: { walls: 'up', roof: 'on' }, size: SIZE },
  shots,
};
// a partial run (--only / --tods) is merged into what the manifest already holds, so a re-shoot of one room keeps the rest
const mfile = path.resolve(args.manifest && args.manifest !== 'true' ? args.manifest : path.join(OUT, `${set}.manifest.json`));
if ((only || todFilter || !withScale) && fs.existsSync(mfile)) {
  const old = loadManifest(mfile), keep = old.shots.filter(o => !shots.some(n => n.id === o.id));
  manifest.shots = [...keep, ...shots].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
writeText(mfile, manifestText(manifest));
console.log(`manifest: ${path.relative(process.cwd(), mfile)} (${manifest.shots.length} frames)`);
if (isBefore && !only && !todFilter && withScale && !failed) {
  writeText(BEFORE_MANIFEST, manifestText(manifest));
  recordProvenance('before.manifest.json', fp);
  console.log(`copied to ${path.relative(ROOT, BEFORE_MANIFEST)}`);
}
writeText(path.join(OUT, `${set}.capture-log.json`), JSON.stringify({ machine: machine(), houses: log, skipped }, null, 1) + '\n');
process.exit(failed ? 1 : 0);
