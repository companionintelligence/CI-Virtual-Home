#!/usr/bin/env -S node --experimental-strip-types
// The inline scripts of .github/workflows/deploy.yml, run as they are (no browser, no network beyond a local server):
// @check-house quick
//
//   node --experimental-strip-types scripts/test-deploy-workflow.mts       (any cwd)
//
// deploy.yml runs no checkout and no repository script (CLAUDE.md → The portal), so what it does to the site lives in the
// workflow's own steps, and nothing else would notice if one stopped working. This pulls the `run:` text of two steps out of the
// file and runs it:
//
//   analytics  "Inject Google Analytics": with a valid id it puts gtag.js and the config snippet into every page, each script
//              tag with data-cfasync="false" (Cloudflare's Rocket Loader would otherwise hold them back), once only (a second
//              run changes nothing); with no id, or an id that is not G-XXXX, it touches nothing
//   smoke      "Smoke-test the live site": passes against a site that answers an unknown path with 404, serves robots.txt as
//              text/plain and lists URLs in sitemap.xml; fails against one that answers 200 for everything (the soft 404 a
//              site without a 404.html gets); and only warns when it is refused (a 503), because that proves nothing
// Exit 0 when all hold; 1 otherwise.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { ROOT } from './portal-lib.mts';

const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8').split('\n');
let fails = 0;
const ok = (cond: unknown, what: string): void => { if (cond) console.log(`  \x1b[32m✓\x1b[0m ${what}`); else { fails++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };

// the `run: |` block of the step with this name, dedented
function stepScript(name: string): string {
  const at = workflow.findIndex(l => l.trim() === `- name: ${name}`);
  if (at < 0) throw new Error(`deploy.yml has no step "${name}"`);
  const run = workflow.findIndex((l, i) => i > at && /^\s+run: \|\s*$/.test(l));
  if (run < 0) throw new Error(`the step "${name}" has no run: | block`);
  const indent = workflow[run].match(/^\s*/)![0].length + 2;
  const out: string[] = [];
  for (let i = run + 1; i < workflow.length; i++) {
    if (workflow[i].trim() && workflow[i].match(/^\s*/)![0].length < indent) break;
    out.push(workflow[i].slice(indent));
  }
  return out.join('\n');
}
// async: the smoke test's curl talks to a server in this very process, which a blocking spawn would never let answer
const sh = (script: string, cwd: string, env: Record<string, string>): Promise<{ status: number | null; stdout: string }> => new Promise(resolve => {
  const child = spawn('bash', ['-e', '-c', script], { cwd, env: { PATH: process.env.PATH || '', ...env } });
  let stdout = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', () => { /* curl's own noise */ });
  const timer = setTimeout(() => child.kill(), 60000);
  child.on('close', status => { clearTimeout(timer); resolve({ status, stdout }); });
});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-workflow-'));
try {
  console.log('analytics');
  const ga = stepScript('Inject Google Analytics');
  const page = (body: string): string => `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <title>t</title>\n</head>\n<body>${body}</body>\n</html>\n`;
  const site = path.join(tmp, 'site');
  const fresh = (): void => {
    fs.rmSync(site, { recursive: true, force: true });
    fs.mkdirSync(path.join(site, 'homes'), { recursive: true });
    fs.writeFileSync(path.join(site, 'index.html'), page('gallery'));
    fs.writeFileSync(path.join(site, 'homes', 'aurora.html'), page('aurora'));
    fs.writeFileSync(path.join(site, '404.html'), page('missing'));
    fs.writeFileSync(path.join(site, 'robots.txt'), 'User-agent: *\n');
  };
  const read = (f: string): string => fs.readFileSync(path.join(site, f), 'utf8');
  const files = ['index.html', 'homes/aurora.html', '404.html'];
  fresh();
  const r1 = await sh(ga, tmp, { GA_MEASUREMENT_ID: 'G-ABC123XYZ' });
  const once = files.map(read);
  ok(r1.status === 0 && files.every((f, i) => once[i].includes('googletagmanager.com/gtag/js?id=G-ABC123XYZ') && once[i].indexOf('gtag/js') < once[i].indexOf('</head>')), `a valid id is injected into every page's head (${r1.stdout.trim()})`);
  ok(once.every(t => (t.match(/<script\b[^>]*>/g) || []).length === 2 && (t.match(/<script\b[^>]*>/g) || []).every(s => /data-cfasync="false"/.test(s))), 'both tags carry data-cfasync="false" (Rocket Loader leaves them alone)');
  ok(read('robots.txt') === 'User-agent: *\n', 'a file that is not a page is left alone');
  const r2 = await sh(ga, tmp, { GA_MEASUREMENT_ID: 'G-ABC123XYZ' });
  ok(r2.status === 0 && files.every((f, i) => read(f) === once[i]), 'a second run changes nothing (no tag twice)');
  for (const bad of ['', 'UA-123', 'G-lower', 'G-X"></script><script>alert(1)</script>']) {
    fresh();
    const before = files.map(read);
    const r = await sh(ga, tmp, { GA_MEASUREMENT_ID: bad });
    ok(r.status === 0 && files.every((f, i) => read(f) === before[i]), `${JSON.stringify(bad) } is no measurement id: nothing is injected`);
  }

  console.log('\nsmoke');
  const smoke = stepScript('Smoke-test the live site').replace(/sleep 10/g, 'sleep 0');
  const serve = async (handler: http.RequestListener): Promise<{ url: string; close: () => Promise<void> }> => {
    const srv = http.createServer(handler);
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', () => r()));
    return { url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}/`, close: () => new Promise<void>(r => { srv.closeAllConnections?.(); srv.close(() => r()); }) };
  };
  const run = (url: string) => sh(smoke, tmp, { SITE_URL: url, RUNNER_TEMP: tmp, GITHUB_RUN_ID: '1' });
  const good = await serve((req, res) => {
    const p = new URL(req.url || '/', 'http://x').pathname;
    if (p === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('User-agent: *\nAllow: /\n'); }
    else if (p === '/sitemap.xml') { res.writeHead(200, { 'Content-Type': 'application/xml' }); res.end('<urlset><url><loc>https://x/</loc></url><url><loc>https://x/homes/a</loc></url></urlset>'); }
    else { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('<h1>Page not found</h1>'); }
  });
  const soft = await serve((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>the gallery</html>'); });
  const blocked = await serve((_req, res) => { res.writeHead(503, { 'Content-Type': 'text/html' }); res.end('challenge'); });
  try {
    const g = await run(good.url);
    ok(g.status === 0 && /Smoke test passed/.test(g.stdout), `a site that serves a 404 page, robots.txt and a sitemap passes (${g.stdout.trim().slice(0, 90)})`);
    const s = await run(soft.url);
    ok(s.status === 1 && /::error/.test(s.stdout) && /unknown path answered 200/.test(s.stdout) && /robots\.txt is HTML/.test(s.stdout), 'a site that answers 200 for everything fails, naming the soft 404 and the HTML robots.txt');
    const b = await run(blocked.url);
    ok(b.status === 0 && /::warning/.test(b.stdout) && !/::error/.test(b.stdout), 'a site that refuses the runner (503) is a warning, not a failure');
  } finally { await good.close(); await soft.close(); await blocked.close(); }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(fails ? `\n\x1b[31m${fails} failed\x1b[0m` : '\nall passed');
process.exit(fails ? 1 : 0);
