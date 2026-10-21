#!/usr/bin/env -S node --experimental-strip-types
// story:bake. Turns an authored family story into its camera: for every beat, a safe pose on the anchor's role in the built house, the walk
// between poses, the beat times and the whole tour's track, written beside the story as content/families/<slug>.bake.json (a BakeLock).
//
//   pnpm run story:bake -- <slug>            one family            pnpm run story:bake -- --all     every story in content/families/
//   --stills <dir>      also render every beat's rest frame through the stock offline path (__houseRenderBegin / __houseRenderFrames, ONE GPU
//                       process of this script's own) at 16:9 and 9:16 into <dir>/<slug>/ with a contact sheet per family and aspect,
//                       outlined with the anchor's rect and where the popup card would go: the human pose review (reference/story/bake.md)
//   --estimated         ignore the voice lock: draft durations at 150 words a minute (the lock says so; a release build refuses it)
//   --check             write nothing: say whether each existing bake lock is fresh (exit 1 if any is stale or missing)
//   --strip <n>         also a film strip per family: n frames across every beat (its walk and its rest), to judge the camera's moves
//   --res 540|720|1080  still size (default 540)       --aspects 16:9,9:16     (default both)
//   --gl default|software   the GPU path of the stills (BAKE_GL; default `default`): `default` is the machine's own GPU through ANGLE, `software` the repo's SwiftShader (the
//                       CPU: hours a film on this machine); the same two modes, flags and Chromium lookup as the ad-cut renderer (scripts/film/ads-lib.mts)
//
// Inputs: content/families/<slug>.json (the story), content/houses/<house>.json (the HouseSpec: its bytes are hashed, its lot list gives the zones),
// content/houses/<house>.plan.json (the world digest the planner and the page share), content/story/roles.json, and <slug>.voice.json if present.
// Exit 1 when any beat loses its anchor (no instance of its role or fallbacks can be framed). Deterministic: re-baking an unchanged tree writes the
// same bytes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadPlaywright, serve, stubGoogleFonts } from './portal-lib.mts';
import { glArgs, glMode, chromiumFor, type GlMode } from './film/ads-lib.mts';
import { createAnchorWorld, resolveChain, type Resolved } from '../assets/story/anchors.js';
import { createPoseCtx, solvePose, type Solved, type PoseCtx } from '../assets/story/poses.js';
import { bakeTrack, trackSha, trackFrameAt, type BakeBeat, type StoryTrack } from '../assets/story/track.js';
import { focusRect, placePopup, type Rect } from '../assets/story/place.js';
import { beatAudioSeconds, popupReadSeconds, inputShas, staleReasons, allClipsReal } from '../assets/story/runtime.js';
import type { Story, VoiceLock, BakeLock, Pose } from '../assets/story/types.js';
import type { RolesTable } from '../assets/story/roles.js';

const FAMILIES = path.join(ROOT, 'content', 'families'), HOUSES = path.join(ROOT, 'content', 'houses');
export const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
export const rolesTable = (): RolesTable => readJson(path.join(ROOT, 'content', 'story', 'roles.json'));

export type Baked = {
  lock: BakeLock; solved: Record<string, Solved | null>; resolved: Record<string, Resolved | null>; problems: string[]; notes: string[];
  ctx: PoseCtx; story: Story; voice: VoiceLock | null; ms: number;
};

/** Bake one family in memory. `storyPath` defaults to content/families/<slug>.json; pass `story` to bake an unsaved one and `housesDir` to read the house from elsewhere (the tests do). */
export async function bakeFamily(slug: string, opts: { story?: Story; estimated?: boolean; voice?: VoiceLock | null; table?: RolesTable; ftue?: boolean; housesDir?: string } = {}): Promise<Baked> {
  const t0 = Date.now();
  const story: Story = opts.story || readJson(path.join(FAMILIES, `${slug}.json`));
  const table = opts.table || rolesTable();
  const housesDir = opts.housesDir || HOUSES;                       // (the tests bake against a frozen house, so a re-lay of a shipped home cannot fail them)
  const specPath = path.join(housesDir, `${story.house}.json`), specText = fs.readFileSync(specPath, 'utf8'), spec = JSON.parse(specText);
  const world = readJson(path.join(housesDir, `${story.house}.plan.json`)).shots.world;
  const voicePath = path.join(FAMILIES, `${slug}.voice.json`);
  const voice: VoiceLock | null = opts.estimated ? null : opts.voice !== undefined ? opts.voice : fs.existsSync(voicePath) ? readJson(voicePath) : null;
  const real = allClipsReal(story, voice);
  const aw = createAnchorWorld(world, spec, table), ctx = createPoseCtx(world);
  const problems: string[] = [], notes: string[] = [];
  const kindOf = new Map(story.chapters.map(c => [c.id, c.kind]));

  // ---- poses: the anchor's role -> an instance -> a safe eye. One beat after another, so two beats on one anchor take different shots.
  const solved: Record<string, Solved | null> = {}, resolved: Record<string, Resolved | null> = {};
  const taken = new Map<string, Array<{ eye: [number, number, number]; yaw: number; level: string | null }>>();
  for (const b of story.beats) {
    const chain = resolveChain(aw, b.anchor);
    let s: Solved | null = null, used: Resolved | null = null;
    if (!chain.length) problems.push(`${b.id}: no instance of ${b.anchor.role}${b.anchor.room ? `@${b.anchor.room}` : ''} or its fallbacks in this house`);
    for (const r of chain) {
      const key = `${r.role}:${r.nth}:${r.level}`;
      s = solvePose(ctx, r, { hint: b.camera, avoid: taken.get(key) || [] });
      if (s) {
        used = r;
        const list = taken.get(key) || []; list.push({ eye: s.pose.eye, yaw: Math.atan2(s.pose.target[0] - s.pose.eye[0], s.pose.target[2] - s.pose.eye[2]), level: s.pose.level }); taken.set(key, list);
        break;
      }
    }
    if (chain.length && !s) problems.push(`${b.id}: ${chain.length} candidate(s) for ${b.anchor.role} and none can be framed`);
    solved[b.id] = s; resolved[b.id] = used;
    if (s && used && used.viaFallback > 0) notes.push(`${b.id}: ${b.anchor.role} fell back to ${used.leaf.role}${used.leaf.room ? `@${used.leaf.room}` : ''}`);
    if (s && s.aerial) notes.push(`${b.id}: framed from the air`);
    if (s && !s.fitsAll) notes.push(`${b.id}: a narrow frame cannot hold all of the anchor`);
  }

  // ---- time + camera
  const beats: BakeBeat[] = story.beats.map(b => {
    const a = beatAudioSeconds(story, b, voice);
    return { id: b.id, chapterKind: kindOf.get(b.chapter) || 'room', solved: solved[b.id], audioS: a.audioS, readS: popupReadSeconds(b), minS: b.minSeconds || 0, film: !!b.film, wake: !!b.emphasis?.wake };
  });
  const baked = bakeTrack(ctx, beats, { ftue: opts.ftue });
  problems.push(...baked.problems); notes.push(...baked.notes);

  const shas = await inputShas({ specText, world, table, story, voice, real });
  const poses: Record<string, Pose> = {};
  for (const b of story.beats) { const s = solved[b.id]; if (s) poses[b.id] = s.pose; }
  const lock: BakeLock = {
    v: 1, slug, specSha: shas.specSha, worldSha: shas.worldSha, rolesSha: shas.rolesSha, anchorsSha: shas.anchorsSha,
    durations: real ? 'voice' : 'estimated', voiceSha: shas.voiceSha, poses,
    timeline: { ...baked.timeline, trackSha: await trackSha(baked.track) },
    track: baked.track,
  };
  return { lock, solved, resolved, problems, notes, ctx, story, voice, ms: Date.now() - t0 };
}

// ---- the file: readable (one line a beat, a segment), stable ------------------------------------------------------------------------------
export function formatLock(lock: BakeLock): string {
  const one = (x: unknown) => JSON.stringify(x);
  const t = lock.track as StoryTrack, tl = lock.timeline;
  const lines: string[] = ['{'];
  const kv = (k: string, v: unknown, last = false) => lines.push(`  ${one(k)}: ${one(v)}${last ? '' : ','}`);
  kv('v', lock.v); kv('slug', lock.slug); kv('specSha', lock.specSha); kv('worldSha', lock.worldSha); kv('rolesSha', lock.rolesSha); kv('anchorsSha', lock.anchorsSha);
  kv('durations', lock.durations); kv('voiceSha', lock.voiceSha);
  const poseIds = Object.keys(lock.poses);
  lines.push('  "poses": {', ...poseIds.map((id, i) => `    ${one(id)}: ${one(lock.poses[id])}${i + 1 < poseIds.length ? ',' : ''}`), '  },');
  lines.push('  "timeline": {', `    "duration": ${tl.duration},`, '    "beats": [', ...tl.beats.map((b, i) => `      ${one(b)}${i + 1 < tl.beats.length ? ',' : ''}`), '    ],',
    `    "filmBeats": ${one(tl.filmBeats)},`, `    "filmDuration": ${tl.filmDuration},`, `    "trackSha": ${one(tl.trackSha)}`, '  },');
  lines.push('  "track": {', `    "v": ${t.v},`, `    "duration": ${t.duration},`, '    "segs": [', ...t.segs.map((s, i) => `      ${one(s)}${i + 1 < t.segs.length ? ',' : ''}`), '    ],');
  const bk = Object.keys(t.beats);
  lines.push('    "beats": {', ...bk.map((id, i) => `      ${one(id)}: ${one(t.beats[id])}${i + 1 < bk.length ? ',' : ''}`), '    },');
  lines.push(`    "events": ${one(t.events)},`, `    "core": ${one(t.core)},`, `    "film": ${one(t.film)},`, `    "stats": ${one(t.stats)}`, '  }', '}');
  return lines.join('\n') + '\n';
}

// ---- the contact sheet ---------------------------------------------------------------------------------------------------------------------
type Tile = { id: string; label: string; sub: string; flags: string; overlay: { focus: Rect | null; grown: Rect | null; card: Rect | null; core: Rect | null }; jpg: string };

async function renderStills(items: Baked[], outDir: string, aspects: string[], res: string, strip = 0, gl: GlMode = 'default') {
  const pw = await loadPlaywright(), cr = chromiumFor(pw);
  if (!cr.executablePath && cr.note.startsWith('no Chromium')) { console.error(cr.note); process.exit(2); }
  console.log(`browser: ${cr.note}; gl: ${gl}${process.platform === 'linux' && gl === 'software' ? ' (SwiftShader on the CPU: slow; --gl default uses the GPU)' : ''}`);
  const srv = await serve(ROOT), browser = await pw.chromium.launch({ headless: true, executablePath: cr.executablePath, args: glArgs(gl) });
  try {
    for (const it of items) {
      const { story, lock } = it, track = lock.track as StoryTrack;
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage(); page.on('pageerror', (e: Error) => console.error('  page error:', e.message));
      await stubGoogleFonts(page, srv.origin);
      await page.goto(`${srv.origin}/room-creator.html?house=${story.house}&shot=orbit&res=${res}&aspect=16:9&lighting=${process.env.BAKE_LIGHTING || 'day'}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, story.house, { timeout: 240000 });
      if (items.indexOf(it) === 0) {   // (what the page really draws with: a `default` that fell back to the CPU is said, not hidden)
        const gpu: string = await page.evaluate(() => { const c = document.createElement('canvas'); const g: any = c.getContext('webgl2') || c.getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : 'unknown'; });
        console.log(`  renderer: ${gpu}${gl === 'default' && /swiftshader|llvmpipe|software/i.test(gpu) ? '  (WARNING: --gl default fell back to software rendering; expect hours, not minutes)' : ''}`);
      }
      for (const aspect of aspects) {
        await page.evaluate(([r, a]: string[]) => (window as any).__houseComposerWarm({ res: r, aspect: a }), [res, aspect]);
        const info = await page.evaluate(async ({ track, house, res, aspect }: any) => {
          // @ts-ignore (a URL in the page, not a module of this script)
          const W: any = window, R = await import('/assets/story/runtime.js'), dbg = W.__houseDebug();
          const key = `house:${house}:story`;
          dbg.presets[key] = R.presetFromStory(W.__THREE, track, { name: 'Family tour', world: W.__houseShotWorld() });
          W.__story = { key, duration: track.duration, ready: true };
          return W.__houseRenderBegin({ shot: key, res, aspect, fps: 30 });
        }, { track, house: story.house, res, aspect });
        const { w, h } = info, frames = info.frames, tiles: Tile[] = [];
        const vw = w, vh = h, phone = vw <= 600;
        for (const b of story.beats) {
          const bf = track.beats[b.id], rest = bf ? bf.rest : 0, t = Math.min(track.duration, rest), asp = w / h;
          const fr = trackFrameAt(track, t, asp);
          const focus = bf ? focusRect(fr.eye, fr.target, fr.fov, bf.box, vw, vh) : null;
          const core = track.core ? focusRect(fr.eye, fr.target, fr.fov, track.core, vw, vh) : null;
          const card = { w: phone ? vw - 16 : Math.round(vw * 0.27), h: phone ? Math.round(vh * 0.3) : Math.round(vh * 0.3) };
          const bars: Rect[] = [{ x: 0, y: 0, w: vw, h: Math.round(vh * 0.07) }, { x: 0, y: vh - Math.round(vh * 0.1), w: vw, h: Math.round(vh * 0.1) }];
          const place = placePopup({ vw, vh, focus, core, bars, card, side: undefined });
          const grown = focus ? { x: focus.x - focus.w * 0.06, y: focus.y - focus.h * 0.06, w: focus.w * 1.12, h: focus.h * 1.12 } : null;
          const s = it.solved[b.id], r = it.resolved[b.id];
          const frame = Math.max(0, Math.min(frames - 1, Math.round((t / track.duration) * (frames - 1))));
          const jpg: string = await page.evaluate(([i]: number[]) => (window as any).__houseRenderFrames(i, 1, 0.86)[0], [frame]);
          const flags = [place.ok ? '' : 'CARD OVERLAPS', s && !s.fitsAll ? 'PHONE CROP' : '', s && s.partial ? 'partial' : '', s && s.aerial ? 'aerial' : '', s && s.pose.tier > 0 ? `tier ${s.pose.tier}` : ''].filter(Boolean).join(' ');
          tiles.push({ id: b.id, label: `${tiles.length + 1}. ${b.id}`, sub: s ? `${s.pose.resolved.role}/${s.pose.resolved.type}${r && r.viaFallback ? ` (fallback ${r.viaFallback})` : ''} d=${s.distance} fov=${s.pose.fov}` : 'NO POSE', flags, overlay: { focus, grown, card: place.rect, core }, jpg });
          fs.mkdirSync(path.join(outDir, story.slug), { recursive: true });
          fs.writeFileSync(path.join(outDir, story.slug, `${b.id}.${aspect.replace(':', 'x')}.jpg`), Buffer.from(jpg, 'base64'));
        }
        const rows: Array<{ id: string; jpgs: string[] }> = [];
        if (strip > 0) {
          for (const bt of lock.timeline.beats) {
            const jpgs: string[] = [];
            for (let k = 0; k < strip; k++) {
              const t = bt.t0 + (bt.t1 - bt.t0) * (k + 0.5) / strip, frame = Math.max(0, Math.min(frames - 1, Math.round((t / track.duration) * (frames - 1))));
              jpgs.push(await page.evaluate(([i]: number[]) => (window as any).__houseRenderFrames(i, 1, 0.8)[0], [frame]));
            }
            rows.push({ id: bt.id, jpgs });
          }
        }
        await page.evaluate(() => (window as any).__houseRenderEnd());
        if (rows.length) {
          const strip64: string = await page.evaluate(async ({ rows, w, h, title }: any) => {
            const n = rows[0].jpgs.length, tw = Math.min(300, Math.floor(1700 / n)), th = Math.round(tw * h / w), pad = 4, lab = 14;
            const cv = document.createElement('canvas'); cv.width = n * (tw + pad) + pad; cv.height = 24 + rows.length * (th + lab + pad); const g = cv.getContext('2d')!;
            g.fillStyle = '#10161c'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#e6edf3'; g.font = '600 13px sans-serif'; g.fillText(title, pad, 16);
            for (let r = 0; r < rows.length; r++) {
              g.fillStyle = '#9fb3c8'; g.font = '11px sans-serif'; g.fillText(rows[r].id, pad + 2, 24 + r * (th + lab + pad) + 11);
              await Promise.all(rows[r].jpgs.map((j: string, k: number) => new Promise<void>(res => { const im = new Image(); im.onload = () => { g.drawImage(im, pad + k * (tw + pad), 24 + r * (th + lab + pad) + lab, tw, th); res(); }; im.src = 'data:image/jpeg;base64,' + j; })));
            }
            return cv.toDataURL('image/jpeg', 0.85).slice(23);
          }, { rows, w, h, title: `${story.slug} ${w}x${h}: ${rows[0].jpgs.length} frames across every beat` });
          const fs2 = path.join(outDir, `${story.slug}.${aspect.replace(':', 'x')}.strip.jpg`);
          fs.writeFileSync(fs2, Buffer.from(strip64, 'base64')); console.log(`  film strip ${fs2}`);
        }
        // the sheet, drawn in the page's 2D canvas (the GPU is idle)
        const sheet: string = await page.evaluate(async ({ tiles, w, h, title }: any) => {
          const cols = w > h ? 4 : 6, tw = w > h ? 360 : 200, th = Math.round(tw * h / w), pad = 6, lab = 34, rows = Math.ceil(tiles.length / cols);
          const cv = document.createElement('canvas'); cv.width = cols * (tw + pad) + pad; cv.height = 28 + rows * (th + lab + pad) + pad; const g = cv.getContext('2d')!;
          g.fillStyle = '#10161c'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#e6edf3'; g.font = '600 14px sans-serif'; g.fillText(title, pad + 2, 19);
          const imgs = await Promise.all(tiles.map((t: any) => new Promise<HTMLImageElement>(res => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/jpeg;base64,' + t.jpg; })));
          tiles.forEach((t: any, i: number) => {
            const x = pad + (i % cols) * (tw + pad), y = 28 + Math.floor(i / cols) * (th + lab + pad), k = tw / w;
            g.drawImage(imgs[i], x, y, tw, th);
            const box = (r: any, c: string, d: number[]) => { if (!r) return; g.save(); g.strokeStyle = c; g.lineWidth = 1.5; g.setLineDash(d); g.strokeRect(x + r.x * k, y + r.y * k, r.w * k, r.h * k); g.restore(); };
            box(t.overlay.focus, '#35e0b0', []); box(t.overlay.grown, '#35e0b0', [4, 3]); box(t.overlay.core, '#ffb454', [2, 2]);
            if (t.overlay.card) { g.save(); g.fillStyle = 'rgba(30,60,120,0.35)'; g.strokeStyle = '#7aa7ff'; const c = t.overlay.card; g.fillRect(x + c.x * k, y + c.y * k, c.w * k, c.h * k); g.strokeRect(x + c.x * k, y + c.y * k, c.w * k, c.h * k); g.restore(); }
            g.fillStyle = '#e6edf3'; g.font = '600 11px sans-serif'; g.fillText(t.label, x + 2, y + th + 12); g.fillStyle = '#9fb3c8'; g.font = '10px sans-serif'; g.fillText(t.sub, x + 2, y + th + 24);
            if (t.flags) { g.fillStyle = '#ff7b72'; g.font = '700 10px sans-serif'; g.fillText(t.flags, x + 2, y + th + 34); }
          });
          return cv.toDataURL('image/jpeg', 0.9).slice(23);
        }, { tiles, w, h, title: `${story.slug}  ${w}x${h}  (green: the anchor, dashed: grown 12%, orange: the Core, blue: where the card would go)` });
        const f = path.join(outDir, `${story.slug}.${aspect.replace(':', 'x')}.sheet.jpg`);
        fs.writeFileSync(f, Buffer.from(sheet, 'base64')); console.log(`  contact sheet ${f}`);
      }
      await ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
}

// ---- main ---------------------------------------------------------------------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2), flagVal = new Set(['stills', 'aspects', 'res', 'strip', 'gl']);
  const flags: Record<string, string> = {}, slugs: string[] = [];
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (flagVal.has(k)) flags[k] = argv[++i]; else flags[k] = 'true'; } else slugs.push(a); }
  let gl: GlMode; try { gl = glMode(flags.gl, { PERSONA_CUT_GL: process.env.BAKE_GL }); } catch (e: any) { console.error(String(e.message).replace('(or PERSONA_CUT_GL)', '(or BAKE_GL)')); process.exit(2); }   // (before any bake: a typo costs nothing)
  const all = flags.all === 'true' || (!slugs.length);
  const list = all ? fs.readdirSync(FAMILIES).filter(f => f.endsWith('.json') && !/\.(voice|bake)\.json$/.test(f) && f !== 'films.json').map(f => f.replace(/\.json$/, '')).sort() : slugs;
  if (!list.length) { console.log('no stories in content/families/ (a story is content/families/<slug>.json)'); process.exit(0); }
  let bad = 0; const done: Baked[] = [];
  for (const slug of list) {
    const lockPath = path.join(FAMILIES, `${slug}.bake.json`);
    let b: Baked;
    try { b = await bakeFamily(slug, { estimated: flags.estimated === 'true' }); } catch (e: any) { console.error(`✗ ${slug}: ${e.message}`); bad++; continue; }
    if (flags.check === 'true') {
      if (!fs.existsSync(lockPath)) { console.log(`✗ ${slug}: no bake lock`); bad++; continue; }
      const old: BakeLock = readJson(lockPath);
      const why = staleReasons(old, { specSha: b.lock.specSha, worldSha: b.lock.worldSha, rolesSha: b.lock.rolesSha, anchorsSha: b.lock.anchorsSha, voiceSha: b.lock.voiceSha }, b.lock.durations === 'voice');
      console.log(why.length ? `✗ ${slug}: stale: ${why.join('; ')}` : `✓ ${slug}: fresh`); if (why.length) bad++; continue;
    }
    const t = b.lock.track as StoryTrack, tiers = [0, 1, 2].map(k => Object.values(b.solved).filter(s => s && s.pose.tier === k).length);
    const viaFb = Object.values(b.resolved).filter(r => r && r.viaFallback > 0).length;
    console.log(`${b.problems.length ? '✗' : '✓'} ${slug}  ${story_n(b)} beats  ${t.duration.toFixed(1)} s (film ${b.lock.timeline.filmDuration.toFixed(1)} s)  durations ${b.lock.durations}  tiers ${tiers.join('/')}  fallbacks ${viaFb}  cuts ${t.stats.cuts}  look ${t.stats.maxYawRate.toFixed(0)} deg/s  ${b.ms} ms`);
    for (const n of b.notes) console.log(`    note: ${n}`);
    for (const p of b.problems) console.log(`    PROBLEM: ${p}`);
    if (b.problems.length) bad++;
    else fs.writeFileSync(lockPath, formatLock(b.lock));   // (a lock with a lost anchor would be a camera that holds still: none is written)
    done.push(b);
  }
  if (flags.stills && done.length) {
    const aspects = (flags.aspects || '16:9,9:16').split(','), out = path.resolve(flags.stills);
    fs.mkdirSync(out, { recursive: true });
    await renderStills(done, out, aspects, flags.res || '540', +(flags.strip || 0), gl);
  }
  process.exit(bad ? 1 : 0);
}
const story_n = (b: Baked) => b.story.beats.length;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
