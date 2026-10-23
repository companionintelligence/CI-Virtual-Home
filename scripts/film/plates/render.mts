// The plates' browser half: a Chromium on the machine's GPU, the house open in the EDITOR page, frames drawn by assets/story/film/plates/index.ts and piped to one ffmpeg per plate.
// Needs a GPU (or hours of SwiftShader), ffmpeg and Playwright; scripts/film/plates/lib.mts is the half that needs none of them. Owner: video-tool.
//
// The rules of a render in this repo hold here too (CLAUDE.md "Determinism"): the page's own `?lighting=` override, `await __houseComposerWarm` before any frame is kept,
// the Google Fonts stub and `document.fonts.ready`, random-access frames (a plate never reads the frame before it), a blank first or last frame stops the render, and
// `--use-angle=vulkan` is never used (blank frames on the NVIDIA here).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, loadPlaywright, serve, stubGoogleFonts, type Served } from '../../portal-lib.mts';
import { glArgs, chromiumFor } from '../ads-lib.mts';
import { BLANK_STD } from '../ads-qa.mts';
import { ASPECT_LABEL, type PlateKey } from '../../../assets/story/film/plates/format.js';
import { plateEncodeArgs, ENCODE, sha256 } from './lib.mts';

/** `default`: ANGLE picks the machine's own GPU (the Intel iGPU here). `nvidia`: the discrete GPU through ANGLE's GL backend (NVIDIA's own GL, by PRIME offload; NOT Vulkan). `software`: the repo's SwiftShader flags (the CPU: hours). */
export type PlateGl = 'default' | 'nvidia' | 'software';
export const PLATE_GLS: PlateGl[] = ['default', 'nvidia', 'software'];
export function plateGl(flag: string | undefined, env: NodeJS.ProcessEnv = process.env): PlateGl {
  const v = (flag || env.FILM_GL || env.PLATES_GL || 'default') as PlateGl;
  if (!PLATE_GLS.includes(v)) throw new Error(`--gl (or FILM_GL) must be one of ${PLATE_GLS.join(', ')}, got ${v}`);
  return v;
}
export function plateGlLaunch(mode: PlateGl, platform: string = process.platform): { args: string[]; env: Record<string, string> } {
  if (mode === 'nvidia') {
    if (platform !== 'linux') throw new Error('--gl nvidia is the Linux PRIME offload path; use --gl default elsewhere');
    return { args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-gpu-watchdog', '--no-sandbox'], env: { __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __VK_LAYER_NV_optimus: 'NVIDIA_only' } };
  }
  return { args: glArgs(mode, platform), env: {} };
}
const SOFTWARE_RE = /swiftshader|llvmpipe|software/i;

export type Rig = { pw: any; browser: any; srv: Served; gl: PlateGl; chromium: string; chromiumNote: string; ffmpeg: string };
export async function openRig(gl: PlateGl): Promise<Rig> {
  for (const t of ['ffmpeg', 'ffprobe']) if (spawnSync(t, ['-version'], { stdio: 'ignore' }).status !== 0) throw new Error(`${t} is not on PATH`);
  const pw = await loadPlaywright(), cr = chromiumFor(pw);
  if (!cr.executablePath && cr.note.startsWith('no Chromium')) throw new Error(cr.note);
  const l = plateGlLaunch(gl), srv = await serve(ROOT);
  const browser = await pw.chromium.launch({ headless: true, executablePath: cr.executablePath, args: [...l.args, '--autoplay-policy=no-user-gesture-required'], env: { ...process.env, ...l.env } as any });
  const ffmpeg = (spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).stdout || '').split('\n')[0].trim();
  const build = /chromium(?:_headless_shell)?-(\d+)/.exec(cr.executablePath || '')?.[1];
  return { pw, browser, srv, gl, chromium: `${browser.version()}${build ? ` (playwright build ${build})` : ''}`, chromiumNote: cr.note, ffmpeg };
}
export async function closeRig(r: Rig) { await r.browser.close().catch(() => {}); await r.srv.close().catch(() => {}); }

/** One browser for a whole run, started the first time something has to be drawn (a run that finds every plate current never starts one). */
export class RigHolder {
  rig: Rig | null = null;
  gl: PlateGl;
  constructor(gl: PlateGl) { this.gl = gl; }
  async get(): Promise<Rig> { return (this.rig ??= await openRig(this.gl)); }
  async close() { if (this.rig) await closeRig(this.rig); this.rig = null; }
}

/** The Chromium a render would use, named by its build (`chromium-1246`), without starting it: a plate's key carries it, so a run that draws nothing can still tell whether the plates on disk are its own. */
export async function chromiumId(): Promise<string> {
  const pw = await loadPlaywright(), cr = chromiumFor(pw), m = /(chromium(?:_headless_shell)?-\d+|chrome-headless-shell-[\w.-]+)/.exec(cr.executablePath || '');
  return m ? m[1] : (cr.executablePath ? path.basename(cr.executablePath) : 'playwright-chromium');
}

async function rendererOf(page: any): Promise<string> {
  return page.evaluate(() => { const c = document.createElement('canvas'); const g: any = c.getContext('webgl2') || c.getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : 'unknown'; });
}

export type OpenHouse = { ctx: any; page: any; renderer: string; readyS: number };
/** One browser context and page with the house built in the editor page, lit as `lighting` (the page's own override, which re-lights every house whatever its spec says). */
export async function openHouse(rig: Rig, house: string, o: { res: number; lighting: string; log?: (m: string) => void }): Promise<OpenHouse> {
  const ctx = await rig.browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(0); page.on('pageerror', (e: Error) => console.error('  page error:', e.message));
  try {
    await stubGoogleFonts(page, rig.srv.origin);
    const t = Date.now();
    await page.goto(`${rig.srv.origin}/room-creator.html?house=${encodeURIComponent(house)}&shot=orbit&res=${o.res}&aspect=16:9&lighting=${o.lighting}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction((h: string) => document.documentElement.dataset.houseReady === h, house, { timeout: 300000 });
    await page.evaluate(() => (document as any).fonts.ready);
    const renderer = await rendererOf(page), lit = await page.evaluate(() => (window as any).__houseLighting && (window as any).__houseLighting.preset);
    if (lit && lit !== o.lighting) throw new Error(`the page is lit at ${lit}, not ${o.lighting}`);
    const readyS = (Date.now() - t) / 1000;
    o.log?.(`house ${house} ready in ${readyS.toFixed(0)} s, lit at ${lit}, gpu: ${renderer}`);
    if (rig.gl !== 'software' && SOFTWARE_RE.test(renderer)) o.log?.(`  warning: --gl ${rig.gl} fell back to a software rasteriser (${renderer}); this will be slow`);
    return { ctx, page, renderer, readyS };
  } catch (e) { await ctx.close().catch(() => {}); throw e; }
}

/** Warm the composer for a size (SMAA's lookups decode asynchronously: the first frame through a cold composer is another picture), then load the plates module. */
export async function warm(page: any, key: PlateKey, pageRes: number) {
  await page.evaluate(([r, a]: string[]) => (window as any).__houseComposerWarm({ res: r, aspect: a }), [String(pageRes), ASPECT_LABEL[key]]);
}

export type RangeResult = { frames: number; bytes: number; sha256: string; spreadMin: number; wallSeconds: number };
const FRAMES_PER_CALL = 12;
/**
 * Draw frames [f0, f1) of the prepared page (`window.__plates`) and encode them to ONE plate at `out` (written to `out.part` and renamed when ffmpeg is done, so a killed run leaves no half file under a good name).
 * A blank first or last frame stops it at once; more than 5 percent blank frames fail it at the end.
 */
export async function renderRange(page: any, f0: number, f1: number, out: string, o: { fps: number; label: string; onProgress?: (done: number, total: number) => void }): Promise<RangeResult> {
  const t0 = Date.now(), tmp = `${out}.part`;
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.rmSync(tmp, { force: true });
  const ff = spawn('ffmpeg', plateEncodeArgs(o.fps, tmp), { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = ''; ff.stderr.on('data', (d: any) => (err += d));
  const done = new Promise<void>((resolve, reject) => { ff.on('error', reject); ff.on('close', (code, sig) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code ?? sig}: ${err.trim()}`)))); });
  done.catch(() => {}); ff.stdin.on('error', () => {});
  const write = (b: Buffer) => new Promise<void>(r => (ff.stdin.write(b) ? r() : ff.stdin.once('drain', () => r())));
  const spread: number[] = [];
  try {
    for (let from = f0; from < f1; from += FRAMES_PER_CALL) {
      const n = Math.min(FRAMES_PER_CALL, f1 - from);
      const res: { jpgs: string[]; std: number[] } = await page.evaluate(([a, k, q]: number[]) => {
        const P = (window as any).__plates, jpgs: string[] = [], std: number[] = [];
        for (let i = a; i < a + k; i++) { jpgs.push(P.frame(i, q)); std.push(P.stats().std); }
        return { jpgs, std };
      }, [from, n, ENCODE.jpeg]);
      if (from === f0 && res.std[0] < BLANK_STD) throw new Error(`${o.label}: the first frame is blank (room spread ${res.std[0]}): the GPU path draws nothing (never use --use-angle=vulkan)`);
      spread.push(...res.std);
      for (const j of res.jpgs) await write(Buffer.from(j, 'base64'));
      o.onProgress?.(Math.min(f1, from + n) - f0, f1 - f0);
    }
    if (spread[spread.length - 1] < BLANK_STD) throw new Error(`${o.label}: the last frame is blank (room spread ${spread[spread.length - 1]})`);
    const blanks = spread.filter(v => v < BLANK_STD).length;
    if (blanks > spread.length * 0.05) throw new Error(`${o.label}: ${blanks} of ${spread.length} frames are blank`);
    ff.stdin.end(); await done;
  } catch (e) { ff.kill('SIGKILL'); fs.rmSync(tmp, { force: true }); throw e; }
  fs.renameSync(tmp, out);
  const bytes = fs.readFileSync(out);
  return { frames: f1 - f0, bytes: bytes.length, sha256: sha256(bytes), spreadMin: Math.min(...spread), wallSeconds: (Date.now() - t0) / 1000 };
}

/**
 * Read back the camera of a prepared home-tour shot (`window.__plates.prepareShot` has been called) at `n` frames spread over [0, frames - 1], and the Core's box. Each frame is drawn through the page's own
 * `__houseRenderFrames(i)` (a pure function of i, random access: drawing one changes no other) and the pose is the live camera's, so the pose is the one that drew the plate, not a copy of its maths.
 * Called AFTER a plate is drawn (or with none to draw), never inside it.
 */
export async function sampleShot(page: any, frames: number, n: number): Promise<{ core: number[] | null; samples: Array<{ i: number; eye: [number, number, number]; target: [number, number, number]; fov: number }> }> {
  return page.evaluate(([count, k]: number[]) => {
    const W: any = window, THREE = W.__THREE, cam = W.__houseDebug().camera, world = W.__houseShotWorld(), samples: any[] = [];
    for (let j = 0; j < k; j++) {
      const i = Math.round((count - 1) * j / Math.max(1, k - 1));
      W.__houseRenderFrames(i, 1, null);
      cam.updateMatrixWorld(true);
      const eye = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld), fwd = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld);
      samples.push({ i, eye: eye.toArray(), target: eye.clone().addScaledVector(fwd, 10).toArray(), fov: cam.fov });
    }
    return { core: world.hero && world.hero.core ? Array.from(world.hero.core as ArrayLike<number>) : null, samples };
  }, [frames, n]);
}

/** The host the numbers were made on, for the report (never for a key). */
export const machine = (): string => `${os.cpus()[0]?.model?.trim() || 'cpu'} x${os.cpus().length}, load ${fs.readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join(' ')}`;
