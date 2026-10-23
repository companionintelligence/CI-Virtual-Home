#!/usr/bin/env -S node --experimental-strip-types
// The real app logos and screenshots (content/story/app-media.json, portal/apps/, portal/ci/) and the script that makes them:
// @check-house quick
//
//   node --experimental-strip-types scripts/test-app-media.mts       (any cwd; pnpm run story:media:test)
//
//   manifest      v1, the three pinned commits, every app's keys and every file named in portal/apps/ or portal/ci/, sorted keys and a final newline
//   files         each named file exists, is a WebP of the size the manifest says, is named by the hash of its bytes, and fits its budget
//                 (a logo 128 x 128 and at most 12 KB, a screenshot 960 px wide and at most 90 KB)
//   words         every image has alt text, every app screenshot carries the caption exactly, Hub and account page captions begin as the
//                 contract says and end "Not a recording of this family.", no dash and no exclamation mark anywhere
//   rejected      every candidate left out has its reason, and every app that has a logo or screenshot missing says why
//   tree          nothing is in portal/apps or portal/ci that the manifest does not name (and nothing else is in them)
//   rules         the manifest check catches a missing alt, a wrong caption, a missing file, a wrong size and a file that is not its hash
//   encoder       (ffmpeg with libwebp) a synthetic logo and screenshot encode to the same bytes twice, at the size and with the
//                 transparency the contract asks for; and, when CI-Marketplace, CI-Hub and CI-Portal are beside this repo at the pinned commits, the whole
//                 `story:media --check` (every file and the manifest are what the pinned sources give) and a build of a few apps and every Companion Hub and
//                 account page shot made twice into temp dirs and compared byte for byte
//   stale         an app a family or a persona pool names that has no entry in the manifest (and is not in noMedia) FAILS: the gate that keeps the manifest from
//                 falling behind the stories unnoticed. It reads the committed manifest and the stories only, so it holds in CI with no sibling repo
//                 (portal:build says the same, and fails on it under --strict-families). A capture nobody has vetted is a warning, not a failure
// Exit 0 when all hold; 1 otherwise. Needs no network, no browser and no GPU.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ROOT, MANIFEST, LOGO_BUDGET, SHOT_BUDGET, LOGO_PX, SHOT_PX, CAPTION_TAIL, UNLOOKED, appCaption, HUB_CAPTION_HEAD, PORTAL_CAPTION_HEAD,
  readMedia, checkManifest, checkPageImages, staleApps, usedAppIds, imageSize, webpHasAlpha, stable, imageTag, shotFigure, logoImg, appMedia,
  type MediaManifest,
} from './story/lib/media.mts';

let failures = 0, passes = 0;
const ok = (cond: unknown, what: string): void => { if (cond) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${what}`); } else { failures++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };
const note = (what: string): void => console.log(`  - ${what}`);
const SCRIPT = path.join(ROOT, 'scripts', 'story', 'build-app-media.mts');
const node = (args: string[], env: Record<string, string> = {}): { status: number | null; out: string } => {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', SCRIPT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } });
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

// ---- the manifest ---------------------------------------------------------------------------------------------------------------------
console.log('manifest');
const manifestText = fs.existsSync(path.join(ROOT, MANIFEST)) ? fs.readFileSync(path.join(ROOT, MANIFEST), 'utf8') : '';
ok(manifestText.length > 0, `${MANIFEST} is there (pnpm run story:media makes it)`);
const m: MediaManifest | null = manifestText ? readMedia(ROOT) : null;
if (!m) { console.log('\n\x1b[31mno manifest: nothing more to check\x1b[0m'); process.exit(1); }
ok(manifestText === `${stable(m)}\n`, 'the file is the manifest written the one way (sorted keys, two-space indent, a final newline), so a rerun is the same bytes');
ok(!/"(generated|date|time|timestamp|at)"/.test(manifestText) && !/\b20\d\d-\d\d-\d\d/.test(manifestText), 'no timestamp in it');
ok(m.v === 1 && Object.keys(m).sort().join() === 'apps,ci,noMedia,rejected,sources,v', `its keys are apps, ci, noMedia, rejected, sources, v (${Object.keys(m).sort().join(', ')})`);
ok(['marketplace', 'hub', 'portal'].every(k => /^[0-9a-f]{40}$/.test((m.sources as any)[k] || '')), 'three full commit shas pin the sources');
const apps = Object.entries(m.apps);
const logos = apps.filter(([, a]) => a.logo), shots = apps.filter(([, a]) => a.shot);
ok(apps.length >= 70, `${apps.length} apps have an entry (${logos.length} logos, ${shots.length} screenshots)`);
ok(Object.values(m.apps).every(a => a.logo || a.shot), 'no entry is empty (an app with neither is listed in noMedia)');
ok(m.ci.hub.length >= 3 && m.ci.hub.length <= 6, `Companion Hub has ${m.ci.hub.length} screenshots (3 to 6)`);
ok(m.ci.portal.length >= 3 && m.ci.portal.length <= 6, `the Companion account page has ${m.ci.portal.length} screenshots (3 to 6)`);

// ---- the files ------------------------------------------------------------------------------------------------------------------------
console.log('\nfiles, words, rejected');
const problems = checkManifest(m, ROOT);
ok(problems.length === 0, `every file exists, is a WebP of its size, is named by its hash and fits its budget; every alt and caption is as the contract says${problems.length ? `:\n      ${problems.slice(0, 8).join('\n      ')}` : ''}`);
const all: { file: string; w: number }[] = [...apps.flatMap(([, a]) => [a.logo, a.shot]), ...m.ci.hub, ...m.ci.portal].filter(Boolean) as any;
const sizes = all.map(i => fs.statSync(path.join(ROOT, i.file)).size);
ok(Math.max(...apps.filter(([, a]) => a.logo).map(([, a]) => fs.statSync(path.join(ROOT, a.logo!.file)).size)) <= LOGO_BUDGET, `the biggest logo is under ${LOGO_BUDGET / 1024} KB`);
ok(Math.max(...[...shots.map(([, a]) => a.shot!), ...m.ci.hub, ...m.ci.portal].map(i => fs.statSync(path.join(ROOT, i.file)).size)) <= SHOT_BUDGET, `the biggest screenshot is under ${SHOT_BUDGET / 1024} KB`);
const total = sizes.reduce((a, b) => a + b, 0);
ok(total < 9 * 1024 * 1024, `${all.length} files, ${(total / 1024).toFixed(0)} KB in all (under 9 MB)`);
ok(logos.filter(([, a]) => webpHasAlpha(fs.readFileSync(path.join(ROOT, a.logo!.file)))).length >= 10, 'logos whose source is transparent are still transparent (an alpha channel in at least ten of them)');
ok(shots.every(([id, a]) => a.shot!.caption === appCaption(a.name)), `every app screenshot's caption is exactly "${appCaption('<Name>')}"`);
ok(m.ci.hub.every(s => s.caption.startsWith(HUB_CAPTION_HEAD) && s.caption.endsWith(CAPTION_TAIL)), `every Companion Hub caption begins "${HUB_CAPTION_HEAD}" and ends "${CAPTION_TAIL}"`);
ok(m.ci.portal.every(s => s.caption.startsWith(PORTAL_CAPTION_HEAD) && s.caption.endsWith(CAPTION_TAIL)), `every account page caption begins "${PORTAL_CAPTION_HEAD}" and ends "${CAPTION_TAIL}"`);
ok(![...apps.map(([, a]) => a.logo?.alt), ...all.map(i => (i as any).alt)].some(t => !t || /[–—!]|\d{4}/.test(t)), 'no alt text is empty, has a dash or an exclamation mark, or a year');
ok(apps.every(([id, a]) => !a.logo || a.logo.alt === `${a.name} logo`), 'a logo\'s alt text is "<Name> logo"');
ok(m.rejected.length > 0 && m.rejected.every(r => r.reason.trim().length >= 12), `${m.rejected.length} candidates were left out, each with its reason`);
const withoutShot = apps.filter(([, a]) => !a.shot).map(([id]) => id);
ok(withoutShot.every(id => m.rejected.some(r => r.kind === 'shot' && r.id === id)), `every app without a screenshot says why in "rejected" (${withoutShot.join(', ') || 'none'})`);
ok(m.rejected.every(r => !/\bSims\b|Base Game|\bBG /.test(`${r.id} ${r.source} ${r.reason}`)), 'nothing in the rejected list names the build a home came from');
ok(new Set(m.rejected.map(r => `${r.kind}:${r.source}`)).size === m.rejected.length, 'no candidate is listed as rejected twice');
ok(!m.rejected.some(r => r.kind === 'shot' && m.apps[r.id]?.shot), 'no screenshot is both shipped and rejected');

// ---- the tree -------------------------------------------------------------------------------------------------------------------------
console.log('\ntree');
const named = new Set<string>(all.map(i => i.file));
const listed = (dir: string): string[] => fs.existsSync(path.join(ROOT, dir)) ? fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? listed(`${dir}/${e.name}`) : [`${dir}/${e.name}`]) : [];
const onDisk = [...listed('portal/apps'), ...listed('portal/ci')];
const extra = onDisk.filter(f => !named.has(f)), missing = [...named].filter(f => !onDisk.includes(f));
ok(extra.length === 0, `nothing in portal/apps or portal/ci is outside the manifest${extra.length ? ` (${extra.slice(0, 4).join(', ')}${extra.length > 4 ? ', ...' : ''})` : ''}`);
ok(missing.length === 0, 'every file the manifest names is in portal/apps or portal/ci');
ok(onDisk.every(f => /\.[0-9a-f]{10}\.webp$/.test(f)), 'every file there is named <name>.<hash10>.webp');
const dirs = fs.existsSync(path.join(ROOT, 'portal/apps')) ? fs.readdirSync(path.join(ROOT, 'portal/apps')) : [];
ok(dirs.every(d => m.apps[d]), 'every folder under portal/apps is an app of the manifest');

// ---- the rules catch what they should ---------------------------------------------------------------------------------------------------
console.log('\nrules');
const clone = (): MediaManifest => JSON.parse(JSON.stringify(m));
const [firstId] = shots[0];
const caught = (what: string, edit: (x: MediaManifest) => void, want: RegExp): void => { const x = clone(); edit(x); const p = checkManifest(x, ROOT); ok(p.some(t => want.test(t)), `${what} is caught`); };
caught('a missing alt text', x => { x.apps[firstId].logo!.alt = ''; }, /no alt text/);
caught('a dash in an alt text', x => { x.apps[firstId].logo!.alt = 'a — b'; }, /dash/);
caught('a wrong caption', x => { x.apps[firstId].shot!.caption = 'Real screenshot. Not a recording of this family.'; }, /caption is not exactly/);
caught('a Hub caption that does not end as it must', x => { x.ci.hub[0].caption = `${HUB_CAPTION_HEAD}.`; }, /does not end/);
caught('a missing file', x => { x.apps[firstId].shot!.file = `portal/apps/${firstId}/shot.0000000000.webp`; }, /does not exist/);
caught('a wrong size', x => { x.apps[firstId].shot!.h += 1; }, /the file is/);
caught('a source that is not pinned', x => { x.apps[firstId].shot!.source = 'CI-Marketplace e2e/screenshots/x.png@000000000000'; }, /source/);
caught('an entry with neither a logo nor a screenshot', x => { x.apps[firstId].logo = null; x.apps[firstId].shot = null; }, /neither a logo nor a screenshot/);
caught('a rejection with no reason', x => { x.rejected.push({ kind: 'shot', id: 'x', source: 'CI-Hub a@b', reason: ' ' }); }, /needs kind, id, source and a reason/);
{
  // a file that is not named by its hash (the same name, other bytes), in a scratch tree
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'app-media-test-'));
  try {
    const x = clone();
    const rel = x.apps[firstId].logo!.file;
    fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
    const bytes = Buffer.from(fs.readFileSync(path.join(ROOT, rel)));
    bytes[bytes.length - 1] ^= 0xff;
    fs.writeFileSync(path.join(tmp, rel), bytes);
    ok(checkManifest(x, tmp).some(t => /not named by the hash of its bytes/.test(t)), 'a file that is not named by the hash of its bytes is caught');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
{
  const a = appMedia(m, firstId);
  const tag = a ? logoImg(a, { depth: 1 }) : '';
  ok(/ src="\.\.\/portal\/apps\//.test(tag) && / alt="[^"]+"/.test(tag) && / width="128" height="128"/.test(tag) && / loading="lazy"/.test(tag), 'logoImg writes a relative src, alt, width, height and loading="lazy"');
  const fig = shotFigure(a?.shot || null);
  ok(/^<figure>.*<figcaption>Real screenshot of .* from a Companion Hub QA run\. Not a recording of this family\.<\/figcaption><\/figure>$/.test(fig), 'shotFigure writes the picture with its caption');
  ok(logoImg(null) === '' && shotFigure(null) === '' && imageTag(a!.logo!, { eager: true }).includes('loading="eager"'), 'no entry, no markup; eager only when asked');
  ok(imageSize(Buffer.from(fs.readFileSync(path.join(ROOT, a!.logo!.file))))?.w === LOGO_PX && SHOT_PX === 960, 'imageSize reads a WebP header');
}

{
  // the page check portal:build runs on every built page: a made-up page that breaks each rule in turn
  const logo = m.apps[firstId].logo!, shot = m.apps[firstId].shot!;
  const files = new Map<string, string>([[logo.file, ''], [shot.file, shot.caption]]);
  const has = (): boolean => true;
  const img = (f: string, extra = '', depth = '../'): string => `<img src="${depth}${f}" alt="x" width="128" height="128" loading="lazy"${extra}>`;
  const run = (file: string, html: string, hasFn: (f: string) => boolean = has): string[] => checkPageImages([{ file, html }], files, hasFn).problems;
  const cap = shot.caption.replace(/&/g, '&amp;');
  ok(run('family/x.html', `<p>${img(logo.file)}</p><figure>${img(shot.file)}<figcaption>${cap}</figcaption></figure>`).length === 0, 'a page with a logo and a captioned screenshot, each with alt, size and loading, passes');
  ok(run('family/x.html', '<img src="../assets/brand/mark.svg">').length === 0, 'an image that is not media is left alone');
  ok(run('family/x.html', img(logo.file).replace('alt="x"', 'alt=""')).some(p => /no alt text/.test(p)), 'an image with empty alt text fails');
  ok(run('family/x.html', img(logo.file).replace(' alt="x"', '')).some(p => /no alt text/.test(p)), 'an image with no alt attribute fails');
  ok(run('family/x.html', img(logo.file).replace(' width="128" height="128"', '')).some(p => /width and height/.test(p)), 'an image with no width and height fails');
  ok(run('family/x.html', img(logo.file).replace(' loading="lazy"', '')).some(p => /loading/.test(p)), 'an image with no loading attribute fails');
  ok(run('index.html', img(logo.file, '', './').replace('lazy', 'eager')).some(p => /above the fold/.test(p)), 'the front page loads none eagerly');
  ok(run('family/x.html', img('portal/apps/x/logo.0000000000.webp')).some(p => /is not a file/.test(p)), 'an image of a file the manifest does not name fails');
  ok(run('family/x.html', img(logo.file), () => false).some(p => /not in the output/.test(p)), 'an image whose file is not in the output fails');
  ok(run('family/x.html', img(shot.file)).some(p => /without its caption/.test(p)), 'a screenshot without its caption fails');
}

// ---- the stale warning -----------------------------------------------------------------------------------------------------------------
console.log('\nstale');
const used = usedAppIds(ROOT), stale = staleApps(m, ROOT);
ok(used.length >= 70, `${used.length} apps are used by the families, the persona pools, the plan and the first-party trio`);
// A GATE, not a warning (it was one until 2026-10: the manifest then fell 34 logos behind the stories and nothing said so). It reads only the committed
// manifest and the stories, so it runs in CI with no sibling repo: an app a family or a persona pool names must have an entry (a logo, or a screenshot) or
// be listed in noMedia (on purpose: the logo was held back, see REJECT_LOGO). The fix is `pnpm run story:media` and a look at what it made.
ok(stale.length === 0, `every app a story or a persona pool names has an entry in ${MANIFEST} or is in noMedia${stale.length ? ` (missing: ${stale.join(', ')}; run pnpm run story:media with the sibling repos beside this one)` : ''}`);
ok(m.noMedia.every(id => m.rejected.some(r => r.kind === 'logo' && r.id === id)), `every app in noMedia says why its logo is not shown in "rejected" (${m.noMedia.join(', ') || 'none'})`);
ok(m.rejected.filter(r => r.kind === 'logo').every(r => !m.apps[r.id]?.logo), 'no logo is both shipped and rejected');
const unlooked = m.rejected.filter(r => r.reason === UNLOOKED).map(r => r.id);
if (unlooked.length) note(`warning: ${unlooked.length} QA capture${unlooked.length === 1 ? '' : 's'} nobody has looked at yet (not used): ${unlooked.join(', ')}`);
{
  // the gate itself: a manifest that lost an app a story names, or never had a newly named one, is stale (and an app held in noMedia is not)
  const x = clone();
  const gone = used.find(id => x.apps[id]) as string;
  delete x.apps[gone];
  ok(staleApps(x, ROOT).includes(gone), 'an app a story names that has no entry is reported stale');
  x.noMedia.push(gone);
  ok(!staleApps(x, ROOT).includes(gone), 'an app listed in noMedia is not');
  ok(staleApps(null, ROOT).length === used.length, 'no manifest at all makes every used app stale');
}

// ---- the encoder ------------------------------------------------------------------------------------------------------------------------
console.log('\nencoder');
const ffmpegOk = (() => { const r = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' }); return r.status === 0 && /\blibwebp\b/.test(r.stdout || ''); })();
if (!ffmpegOk) note('skipped: no ffmpeg with libwebp on this machine (the committed files are checked above; the encoder is checked where ffmpeg is)');
else {
  const self = node(['--selftest']);
  ok(self.status === 0, `a synthetic logo and screenshot encode to the same bytes twice, at 128 x 128 with transparency and 960 px wide, inside their budgets${self.status === 0 ? '' : `: ${self.out.trim().slice(0, 300)}`}`);
  const sibling = (r: string): string => path.join(process.env.CI_SIBLINGS || path.join(ROOT, '..'), r);
  const have = [['CI-Marketplace', m.sources.marketplace], ['CI-Hub', m.sources.hub], ['CI-Portal', m.sources.portal]].every(([r, sha]) => fs.existsSync(path.join(sibling(r), '.git')) && spawnSync('git', ['-C', sibling(r), 'cat-file', '-e', `${sha}^{commit}`]).status === 0);
  if (!have) note('skipped: CI-Marketplace, CI-Hub and CI-Portal are not beside this repo at the pinned commits (the build twice into temp dirs runs where they are)');
  else {
    // the whole check, where the sources are: every file and the manifest are what the pinned commits give (about half a minute)
    const chk = node(['--check']);
    ok(chk.status === 0, `story:media --check: the manifest and every file are what the pinned sources give${chk.status === 0 ? '' : `: ${chk.out.split('\n').filter(l => !/nobody has looked/.test(l)).join(' | ').trim().slice(0, 400)}`}`);
    const sample = ['nextcloud', 'immich', 'pi-hole', 'code-server', 'ci-memory', 'grocy'].filter(id => m.apps[id]);
    const t1 = fs.mkdtempSync(path.join(os.tmpdir(), 'app-media-a-')), t2 = fs.mkdtempSync(path.join(os.tmpdir(), 'app-media-b-'));
    try {
      const r1 = node(['--out', t1, '--apps', sample.join(',')]), r2 = node(['--out', t2, '--apps', sample.join(',')]);
      ok(r1.status === 0 && r2.status === 0, `a build of ${sample.length} apps and every Companion Hub and account page shot runs${r1.status === 0 && r2.status === 0 ? '' : `: ${(r1.out + r2.out).trim().slice(0, 300)}`}`);
      const tree = (d: string): string[] => fs.readdirSync(d, { recursive: true }).map(String).filter(n => fs.statSync(path.join(d, n)).isFile()).sort();
      const a = tree(t1), b = tree(t2);
      ok(a.length > 10 && a.join('\n') === b.join('\n') && a.every(f => fs.readFileSync(path.join(t1, f)).equals(fs.readFileSync(path.join(t2, f)))), `built twice into two temp dirs, the ${a.length} files (and the manifest) are the same bytes`);
      const same = a.filter(f => f.startsWith('portal/')).every(f => fs.existsSync(path.join(ROOT, f)) && fs.readFileSync(path.join(ROOT, f)).equals(fs.readFileSync(path.join(t1, f))));
      if (same) ok(true, 'and they are the committed files (a rebuild reproduces what is in the tree)');
      else note('the committed files differ from what this ffmpeg makes (a different ffmpeg build): `pnpm run story:media -- --check` says which; rebuild and commit if it is yours');
      // a sample shipped build leaves nothing outside the manifest it wrote
      const mm = JSON.parse(fs.readFileSync(path.join(t1, MANIFEST), 'utf8')) as MediaManifest;
      const wrote = new Set<string>([...Object.values(mm.apps).flatMap(x => [x.logo?.file, x.shot?.file]), ...mm.ci.hub.map(s => s.file), ...mm.ci.portal.map(s => s.file)].filter(Boolean) as string[]);
      ok(a.filter(f => f.startsWith('portal/')).every(f => wrote.has(f)) && wrote.size === a.filter(f => f.startsWith('portal/')).length, 'the build writes the files the manifest names and no others');
    } finally { fs.rmSync(t1, { recursive: true, force: true }); fs.rmSync(t2, { recursive: true, force: true }); }
  }
}

console.log(`\n${failures ? `\x1b[31m${failures} failed\x1b[0m, ` : ''}${passes} passed`);
process.exit(failures ? 1 : 0);
