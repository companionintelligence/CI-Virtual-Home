// Shared by the portal scripts (build-thumbs.mts, build-portal.mts, test-portal.mts): the repo root, Playwright
// resolution, a static server that can mount a directory under a sub-path (the portal is tested at
// /ci-virtual-home/, not at /, so a root-relative URL cannot pass), and the Google Fonts stub every capture uses.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export const ROOT = path.resolve(import.meta.dirname, '..');

export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  argv.forEach((a, i) => { if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'; });
  return out;
}

// Playwright: the pinned devDependency first, then $PLAYWRIGHT_MODULE, then the newest copy in the npx cache —
// the same order as test-goldens.mts and render-house-shots.mts.
export async function loadPlaywright(): Promise<any> {
  try { return await import('playwright'); } catch { /* not installed here */ }
  const { pathToFileURL } = await import('node:url');
  const os = await import('node:os');
  const candidates: string[] = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) { const p = path.join(npx, d, 'node_modules', 'playwright'); if (fs.existsSync(path.join(p, 'package.json'))) candidates.push(p); }
  const ver = (p: string): string => { try { return JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8')).version; } catch { return '0'; } };
  candidates.sort((a, b) => ver(b).localeCompare(ver(a), undefined, { numeric: true }));
  for (const c of candidates) { try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch { /* try the next */ } }
  console.error('playwright is not resolvable: pnpm install && pnpm exec playwright install chromium');
  process.exit(2);
}

// The GPU is part of the render; these are test-goldens.mts's launch flags for each platform.
// PORTAL_GL=default (Linux only): the machine's own GPU through ANGLE, as render-house-shots.mts does, for a box where SwiftShader takes minutes a page (the portal
// test's player and editor legs, shot-worlds, build-thumbs). Unset, the launch is the committed one, so nothing that is already checked in depends on it.
export const LAUNCH_ARGS: string[] = process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']
  : process.env.PORTAL_GL === 'default'
    ? ['--use-gl=angle', '--use-angle=default', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--no-sandbox']
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--no-sandbox'];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.glb': 'model/gltf-binary', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
  '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8',   // (the family tour's voice-over, film and captions)
};
export const FONT_FILES: Record<string, string> = { manrope: 'manrope-latin-var.woff2', 'jetbrains-mono': 'jetbrains-mono-latin-var.woff2' };

export type Served = { port: number; origin: string; base: string; url: (p?: string) => string; close: () => Promise<void>; requests: string[]; also: string[] };

// Serve `dir` at `base` (e.g. '/ci-virtual-home/'). Anything outside `base` is a 404, so a URL that
// escapes the sub-path (a leading-slash href) fails the test instead of quietly working. A directory serves its
// index.html, and so does Cloudflare Pages' extensionless routing: /room-creator is room-creator.html and /homes/aurora is
// homes/aurora.html (the live site answers the .html address with a 308 to those; here both are served, so a test can
// follow either). A path that is no file answers 404 with the site's 404.html, as Pages does. /__fonts/<name> serves
// assets/fonts/ for the Google Fonts stub.
// ---- tailscale ---- `extraHosts` are further addresses (for the preview: this machine's Tailscale address, see tailscaleAddress) to listen on, with the same
// port as the first (127.0.0.1). The tests never pass any, so they listen on the loopback address only, as before.
export async function serve(dir: string, base = '/', listenPort = 0, extraHosts: string[] = []): Promise<Served> {
  const root = path.resolve(dir);
  if (!base.endsWith('/')) base += '/';
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
    requests.push(pathname);
    const font = pathname.startsWith('/__fonts/') && FONT_FILES[pathname.slice('/__fonts/'.length)];
    let file: string | null = null;
    if (font) file = path.join(ROOT, 'assets', 'fonts', font);
    else if (pathname.startsWith(base) || pathname + '/' === base) {
      file = path.join(root, pathname.slice(base.length));
      if (!file.startsWith(root)) file = null;
      else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      else if (!fs.existsSync(file) && !path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;   // (family/<slug> is family/<slug>.html, as for homes/<id>)
    }
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const notFound = path.join(root, '404.html');
      if (file && pathname.startsWith(base) && fs.existsSync(notFound)) { res.writeHead(404, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }); res.end(fs.readFileSync(notFound)); return; }
      res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>(r => server.listen(listenPort, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;
  // one more server for each extra address, answering with the same handler (an address that cannot be bound stops the preview with its error)
  const more: http.Server[] = [];
  for (const host of extraHosts) {
    const s2 = http.createServer(server.listeners('request')[0] as http.RequestListener);
    await new Promise<void>((res, rej) => { s2.once('error', rej); s2.listen(port, host, () => res()); });
    more.push(s2);
  }
  return {
    port, origin, base, requests, also: extraHosts.map(h => `http://${h}:${port}`),
    url: (p = '') => `${origin}${base}${p.replace(/^\//, '')}`,
    close: () => Promise.all([server, ...more].map(x => new Promise<void>(r => x.close(() => r())))).then(() => undefined),
  };
}

// This machine's Tailscale IPv4 address and MagicDNS name, read from the `tailscale` command (null when it is not installed, not running or has no address).
// `pnpm run portal:preview -- --tailscale` listens on that one address as well as the loopback one: other devices on the same tailnet reach the preview,
// the local network does not (the preview is never bound to 0.0.0.0).
export async function tailscaleAddress(): Promise<{ ip: string; dns: string | null } | null> {
  const { execFileSync } = await import('node:child_process');
  const run = (a: string[]): string => { try { return execFileSync('tailscale', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 }).trim(); } catch { return ''; } };
  const ip = run(['ip', '-4']).split('\n')[0].trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  let dns: string | null = null;
  try { dns = (JSON.parse(run(['status', '--json'])).Self?.DNSName || '').replace(/\.$/, '') || null; } catch { /* no name */ }
  return { ip, dns };
}
// ---- end tailscale ----

// room-creator.html links Google Fonts; captures serve the repo's own woff2 instead (as test-goldens.mts does),
// so a thumbnail never depends on the network. The stylesheet is fulfilled at Google's origin, hence absolute URLs.
export async function stubGoogleFonts(page: any, origin: string): Promise<void> {
  const css = `
@font-face{font-family:'Manrope';src:url('${origin}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'Plus Jakarta Sans';src:url('${origin}/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}
@font-face{font-family:'JetBrains Mono';src:url('${origin}/__fonts/jetbrains-mono') format('woff2');font-weight:100 800;font-display:block}`;
  await page.route('https://fonts.googleapis.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'text/css', body: css, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route('https://fonts.gstatic.com/**', (r: any) => r.abort());
}

export function houseIds(): string[] {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'houses', 'index.json'), 'utf8'));
  return (index.houses || []).map((h: { id: string }) => h.id);
}
