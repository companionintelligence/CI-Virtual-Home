#!/usr/bin/env -S node --experimental-strip-types
// story:spline:sheets. The contact sheets of every home's camera in one place: for each family, one at a time, the bake with --stills and --strip (ONE GPU process, --gl default),
// then <out>/index.html, a local review page with, per family, the 16:9 and 9:16 contact sheets and film strips, the spline report's rows for that family and the beat list with ids.
//
//   pnpm run story:spline:sheets -- <slug> [<slug> ...] [--out <dir>] [--res 540] [--strip 8] [--gl default|software] [--no-render]
//
//   --out <dir>    where the files go (default video/spline-sheets, which is gitignored: sheets are for looking at, not for git)
//   --res 540      the still size (540 | 720 | 1080); 540 is a quarter of the cost of 1080 and enough to see a camera
//   --strip 8      frames across every beat in the film strip (0: none)
//   --gl           the GPU path (default; BAKE_GL): scripts/story-bake.mts --gl
//   --no-render    do not run the bake: rebuild index.html from the sheets already in <out> (and the lock as it is now)
//
// Layout of <out>:   index.html   <slug>.16x9.sheet.jpg  <slug>.9x16.sheet.jpg  <slug>.16x9.strip.jpg  <slug>.9x16.strip.jpg   <slug>/<beat>.<aspect>.jpg   <slug>.report.json
// NOTE the bake rewrites content/families/<slug>.bake.json (the bytes a re-bake of an unchanged tree gives are the same); the page says when it did change one.
// Reading the sheets: reference/story/spline.md "The vision review".
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { gradeSlug, defaultDirs, T, type FamilyReport } from './spline-report.mts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type BeatRow = { id: string; chapter: string; ask: string; got: string; tier: number | null; t0: number; t1: number; film: boolean; title: string };
export type Entry = { slug: string; house: string | null; report: FamilyReport; beats: BeatRow[]; rendered: boolean; seconds: number | null; lockChanged: boolean; note?: string; files: Record<string, boolean> };

/** the beat list of a family: what the story asked, what the camera got, and when */
export function beatRows(slug: string, dirs = defaultDirs()): BeatRow[] {
  try {
    const story = JSON.parse(fs.readFileSync(path.join(dirs.families, `${slug}.json`), 'utf8')), lock = JSON.parse(fs.readFileSync(path.join(dirs.families, `${slug}.bake.json`), 'utf8'));
    const tl = new Map<string, { t0: number; t1: number }>(lock.timeline.beats.map((b: any) => [b.id, b]));
    return story.beats.map((b: any) => {
      const p = lock.poses[b.id], t = tl.get(b.id);
      return {
        id: b.id, chapter: b.chapter, ask: `${b.anchor.role}${b.anchor.room ? `@${b.anchor.room}` : ''}${b.anchor.nth !== undefined ? `#${b.anchor.nth}` : ''}`,
        got: p ? `${p.resolved.role}/${p.resolved.type}${p.resolved.viaFallback ? ` (fallback ${p.resolved.viaFallback})` : ''}` : 'NO POSE', tier: p ? p.tier : null,
        t0: t ? t.t0 : 0, t1: t ? t.t1 : 0, film: !!b.film, title: b.popup && b.popup.title ? b.popup.title : '',
      };
    });
  } catch { return []; }
}

const IMGS = (slug: string) => ({
  sheet169: `${slug}.16x9.sheet.jpg`, sheet916: `${slug}.9x16.sheet.jpg`, strip169: `${slug}.16x9.strip.jpg`, strip916: `${slug}.9x16.strip.jpg`,
});

/** the review page: self-contained (one file, relative image links, no script, no network), light and dark */
export function renderIndex(entries: Entry[], meta: { res: string; gl: string; strip: number }): string {
  const fig = (e: Entry, key: string, label: string) => {
    const f = IMGS(e.slug)[key as keyof ReturnType<typeof IMGS>];
    return e.files[key] ? `<figure><a href="${esc(f)}"><img src="${esc(f)}" alt="${esc(label)} of ${esc(e.slug)}" loading="lazy"></a><figcaption>${esc(label)}</figcaption></figure>` : `<p class="miss">${esc(label)}: not rendered</p>`;
  };
  const sections = entries.map(e => {
    const r = e.report, s = r.stats;
    const defects = r.defects.length
      ? `<table><thead><tr><th>severity</th><th>rule</th><th>beat</th><th>what</th></tr></thead><tbody>${r.defects.slice().sort((a, b) => (a.sev === b.sev ? 0 : a.sev === 'fail' ? -1 : 1)).map(d => `<tr class="${d.sev}"><td>${d.sev}</td><td>${esc(d.rule)}</td><td>${esc(d.beat ?? '')}</td><td>${esc(d.msg)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="ok">The spline report has no defect for this home.</p>';
    const beats = `<table class="beats"><thead><tr><th>#</th><th>beat id</th><th>chapter</th><th>asked</th><th>got</th><th>tier</th><th>t0 to t1 (s)</th><th>film</th><th>title</th></tr></thead><tbody>${e.beats.map((b, i) => `<tr class="${b.tier !== null && b.tier > 0 ? 'tier' : ''}"><td>${i + 1}</td><td><code>${esc(b.id)}</code></td><td>${esc(b.chapter)}</td><td>${esc(b.ask)}</td><td>${esc(b.got)}</td><td>${b.tier ?? ''}</td><td>${b.t0.toFixed(1)} to ${b.t1.toFixed(1)}</td><td>${b.film ? 'yes' : ''}</td><td>${esc(b.title)}</td></tr>`).join('')}</tbody></table>`;
    const stats = s ? `${s.beats} beats, tour ${s.tourS} s, film ${s.filmS} s, tiers ${s.tiers.join('/')}, fallbacks ${s.fallbacks}, cuts ${s.cuts}, look ${s.lookYaw}/${s.lookPitch} deg/s, durations ${esc(s.durations)}` : 'no stats (the lock did not grade)';
    return `<section id="${esc(e.slug)}"><h2>${esc(e.slug)} <span class="badge ${r.status}">${r.status}</span></h2>
<p class="meta">home ${esc(e.house ?? '-')}. ${stats}.${e.seconds !== null ? ` Sheets took ${e.seconds} s.` : ''}${e.lockChanged ? ' <strong>The bake changed this home\'s lock file (the story moved since it was last baked): commit it with the story.</strong>' : ''}${e.note ? ` ${esc(e.note)}` : ''}</p>
<div class="grid"><div>${fig(e, 'sheet169', '16:9 contact sheet')}${fig(e, 'strip169', '16:9 film strip')}</div><div>${fig(e, 'sheet916', '9:16 contact sheet')}${fig(e, 'strip916', '9:16 film strip')}</div></div>
<h3>Spline report</h3>${defects}<h3>Beats</h3>${beats}</section>`;
  }).join('\n');
  const toc = entries.map(e => `<a href="#${esc(e.slug)}">${esc(e.slug)} <span class="badge ${e.report.status}">${e.report.status}</span></a>`).join(' ');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Camera sheets</title>
<style>
:root{--bg:#f6f8f7;--fg:#14201c;--mut:#51615b;--card:#fff;--line:#d3dcd8;--ok:#1d7a4f;--warn:#9a6700;--fail:#b3261e;--acc:#2a6f5c}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#10161c;--fg:#e6edf3;--mut:#9fb3c8;--card:#17202a;--line:#2b3744;--ok:#4cc38a;--warn:#e3b341;--fail:#ff7b72;--acc:#7ad3b8}}
:root[data-theme="dark"]{--bg:#10161c;--fg:#e6edf3;--mut:#9fb3c8;--card:#17202a;--line:#2b3744;--ok:#4cc38a;--warn:#e3b341;--fail:#ff7b72;--acc:#7ad3b8}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1500px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0}h2{font-size:19px;margin:0 0 4px}h3{font-size:15px;margin:18px 0 6px;color:var(--mut)}
.toc{display:flex;flex-wrap:wrap;gap:8px 14px;margin:8px 0 16px}.toc a{color:var(--acc);text-decoration:none}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:0 0 22px}
.meta{color:var(--mut);margin:0 0 10px}.badge{font-size:12px;border:1px solid currentColor;border-radius:99px;padding:0 8px}.badge.pass{color:var(--ok)}.badge.warn{color:var(--warn)}.badge.fail{color:var(--fail)}
.grid{display:grid;grid-template-columns:3fr 2fr;gap:14px}@media (max-width:900px){.grid{grid-template-columns:1fr}}
figure{margin:0 0 12px}img{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:6px}figcaption,.miss{font-size:12px;color:var(--mut)}
table{border-collapse:collapse;width:100%;font-size:13px;display:block;overflow-x:auto}th,td{border-bottom:1px solid var(--line);padding:3px 8px;text-align:left;vertical-align:top}
tr.fail td:first-child{color:var(--fail);font-weight:700}tr.warn td:first-child{color:var(--warn);font-weight:700}tr.tier td{background:rgba(227,179,65,.12)}.ok{color:var(--ok)}
code{font-family:ui-monospace,monospace}
</style></head><body><main>
<h1>Camera sheets</h1>
<p class="meta">${entries.length} home${entries.length === 1 ? '' : 's'}, stills at ${esc(meta.res)} px, gl ${esc(meta.gl)}, ${meta.strip} frames a beat in the strips. Tiles are outlined: green the anchor, dashed green the anchor grown 12%, orange the Core, blue where the popup card would go. How to read a sheet: reference/story/spline.md. Thresholds: ${esc(JSON.stringify({ cuts: T.maxCuts, lookCap: T.lookCapDegPerS, tier: T.maxTier }))}.</p>
<nav class="toc">${toc}</nav>
${sections}
</main></body></html>
`;
}

const sha = (f: string) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : '');

async function main() {
  const argv = process.argv.slice(2), valued = new Set(['out', 'res', 'strip', 'gl']), flags: Record<string, string> = {}, slugs: string[] = [];
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); flags[k] = valued.has(k) ? argv[++i] : 'true'; } else slugs.push(a); }
  if (!slugs.length) { console.error('usage: pnpm run story:spline:sheets -- <slug> [<slug> ...] [--out <dir>] [--res 540] [--strip 8] [--gl default|software] [--no-render]'); process.exit(2); }
  const out = path.resolve(flags.out || path.join(ROOT, 'video', 'spline-sheets')), res = flags.res || '540', strip = +(flags.strip ?? 8), gl = flags.gl || process.env.BAKE_GL || 'default';
  if (!['360', '540', '720', '1080'].includes(res)) { console.error(`--res must be 360, 540, 720 or 1080, got ${res}`); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const dirs = defaultDirs(), entries: Entry[] = []; let failed = 0;
  for (const slug of slugs) {
    const lock = path.join(dirs.families, `${slug}.bake.json`), before = sha(lock), t0 = Date.now();
    let rendered = false, note: string | undefined;
    if (flags['no-render'] !== 'true') {
      console.log(`\n== ${slug}: bake + stills (${res} px, strip ${strip}, gl ${gl}) ==`);
      // one family, one GPU process, one after the other (a shared machine: nice it from the shell). The bake exits 1 for a lost anchor and then writes nothing.
      const r = spawnSync(process.execPath, ['--experimental-strip-types', path.join(ROOT, 'scripts', 'story-bake.mts'), slug, '--stills', out, '--res', res, '--strip', String(strip), '--gl', gl], { stdio: 'inherit' });
      rendered = r.status === 0;
      if (!rendered) { failed++; note = `The bake exited ${r.status}: ${r.status === 1 ? 'a beat lost its anchor, so no lock and no sheets' : 'the render failed'}.`; }
    }
    const report = await gradeSlug(slug, dirs);
    fs.writeFileSync(path.join(out, `${slug}.report.json`), JSON.stringify(report, null, 1) + '\n');
    const imgs = IMGS(slug), files: Record<string, boolean> = {}; for (const [k, f] of Object.entries(imgs)) files[k] = fs.existsSync(path.join(out, f));
    entries.push({ slug, house: report.house, report, beats: beatRows(slug, dirs), rendered, seconds: flags['no-render'] === 'true' ? null : Math.round((Date.now() - t0) / 1000), lockChanged: before !== sha(lock) && before !== '', note, files });
    fs.writeFileSync(path.join(out, 'index.html'), renderIndex(entries, { res, gl, strip }));   // (after each family, so a long run can be looked at as it goes)
    console.log(`${slug}: ${report.status}, ${report.fails} fail, ${report.warns} warn, ${entries[entries.length - 1].seconds ?? 0} s`);
  }
  console.log(`\nwrote ${path.join(out, 'index.html')}`);
  process.exit(failed ? 1 : 0);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
