#!/usr/bin/env -S node --experimental-strip-types
// The canvas fit gate: does everything the ad cuts and the family films print hold the TYPE FLOOR and FIT its frame, for every family, with no house and no GPU.
//
//   node --experimental-strip-types scripts/film/canvas-fit.mts                     every family that has a bake lock, at 1080 (the ad cuts in all four frames, the films in both)
//        [--family brennan,adeniran]   only these     [--res 1080|540]   the short edge     [--shots <dir>]   PNGs of the end card and the card of the Brennan cuts and films, on a neutral picture, to look at
//        [--only cuts|films]           [--out <file>]  where the JSON report goes (default video/ads/fit.json; gitignored)
//
// What it checks (a failure exits 1 and says which cut, frame and element):
//   * the floor: the smallest type any overlay painted is at least 36 design px at the 1080 px short edge (`auditType` wraps fillText, so it is the pixels, not the plan): the corner mark,
//     every card's kicker, chips and note, the caption strip, the pill, every disclosure line; and the title card of a film
//   * the fit: a card has at least one way to be set (its width, tighter padding, narrower and taller, a film's phone screen left out) that is no taller than the room it may take; the
//     hook has one; the end card (the disclosures at 36 design px) sits inside the safe area and under the corner mark, in how many lines and in which of its four fits
//     (roomy, tight, run-on, no pill: layout in cut/draw.ts); a caption cue holds its two lines in the strip
//   * the name as a kicker: capitals by drawing only (the model's own string is never changed), and the glyph-by-glyph tracking agrees with `ctx.letterSpacing` to within the kerning the glyph-by-glyph path lacks (a few px on a name)
// It does NOT check a card against the SUBJECT of a beat: that needs the house's camera, so it is `story:ads -- --stills`' report (overlap in each card's placement).
// Needs `pnpm run build`, content/families/*.json and their bake locks (a family with none is skipped). Playwright resolves as story-bake does; Chromium as the cut renderer's (chromiumFor).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadPlaywright, serve } from '../portal-lib.mts';
import { buildPlans, chromiumFor, endModelOf, badgeOf, loadClaims } from './ads-lib.mts';
import { filmText } from './lib.mts';
import { CUT_KEYS } from '../../assets/story/film/cut/plan.js';
import { CANVAS_TYPE_MIN } from '../../assets/story/place.js';

const argv = process.argv.slice(2), valued = new Set(['family', 'res', 'shots', 'only', 'out']), flags: Record<string, string> = {};
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); flags[k] = valued.has(k) ? argv[++i] : 'true'; } }
const RES = +(flags.res || 1080), only = flags.only || 'all', shots = flags.shots ? path.resolve(flags.shots) : null;
const outFile = path.resolve(flags.out || path.join(ROOT, 'video', 'ads', 'fit.json')), wanted = flags.family ? flags.family.split(',') : null;

// ---- what the page is asked about ----------------------------------------------------------------------------------------------------------------
const claims = loadClaims(), built = buildPlans(undefined, claims);
const cuts: any[] = [], films: any[] = [];
for (const [slug, { fam, cuts: plans }] of built.plans) {
  if (wanted && !wanted.includes(slug)) continue;
  const rs = fam.rs; if (!rs) continue;
  for (const plan of plans) {
    if (plan.status === 'no-bake' || plan.status === 'blocked') continue;
    cuts.push({
      id: plan.id, plan, end: endModelOf(plan, claims), badge: badgeOf(claims),
      models: plan.parts.map(p => { const b = rs.beats.find(x => x.id === p.beat)!, a = b.agent ? rs.members.find(m => m.id === b.agent) : null; return { name: plan.name, companion: a && a.companion ? a.companion.name : null, title: p.card.title, chips: p.card.chips, note: p.card.note }; }),
    });
  }
  if (rs.film && rs.film.parts.length) {
    const text = filmText(rs, claims);
    films.push({
      slug, title: text.title, end: text.end, badge: text.badge,
      beats: rs.film.parts.map(p => {
        const b = rs.beats.find(x => x.id === p.id)!, m = b.member ? rs.members.find(x => x.id === b.member) : null, a = b.agent ? rs.members.find(x => x.id === b.agent) : null, ch = rs.chapters.find(c => c.id === b.chapter);
        return { id: b.id, model: { member: m ? { name: m.name, colour: m.colour } : null, companion: a && a.companion ? a.companion.name : null, chapter: ch ? ch.title : '', title: b.popup.title, chips: b.popup.chips || [], note: b.popup.note || null, phone: b.popup.kind === 'phone' && b.popup.phone ? { header: b.popup.phone.header, rows: b.popup.phone.rows } : null } };
      }),
    });
  }
}
console.log(`${only === 'films' ? 0 : cuts.length} ad cuts, ${only === 'cuts' ? 0 : films.length} family films, at ${RES}`);

// ---- the page ------------------------------------------------------------------------------------------------------------------------------------
const pw = await loadPlaywright(), cr = chromiumFor(pw), srv = await serve(ROOT);
const browser = await pw.chromium.launch({ headless: true, executablePath: cr.executablePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e: Error) => console.error('page error:', e.message));
await page.route(`${srv.origin}/__fit.html`, (r: any) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><title>fit</title><style>@font-face{font-family:'Manrope';src:url('/__fonts/manrope') format('woff2');font-weight:200 800;font-display:block}</style><body>` }));
await page.goto(`${srv.origin}/__fit.html`);

const report: any = await page.evaluate(async (a: any) => {
  // (the modules are URLs in the page, not files of this script: TypeScript does not resolve them)
  // @ts-ignore
  const C: any = await import('/assets/story/film/cards.js');
  // @ts-ignore
  const D: any = await import('/assets/story/film/cut/draw.js');
  // @ts-ignore
  const P: any = await import('/assets/story/film/cut/plan.js');
  // @ts-ignore
  const L: any = await import('/assets/story/film/layout.js');
  // @ts-ignore
  const O: any = await import('/assets/story/film/overlay.js');
  await Promise.all([500, 600, 700, 800].map(w => (document as any).fonts.load(`${w} 32px Manrope`, 'Aa Hh 0123 See Companion Core')));
  await (document as any).fonts.ready;
  const FLOOR = a.floor, out: any = { floor: FLOOR, res: a.res, cuts: [], films: [], tracking: null, problems: [], shots: {} };
  const prob = (m: string) => out.problems.push(m);
  const mk = (w: number, h: number) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d', { alpha: false })!; g.fillStyle = '#8c9a94'; g.fillRect(0, 0, w, h); return { cv, g }; };
  const inside = (r: any, f: any, top = 0) => r.x >= f.safe.left - 1 && r.y >= f.safe.top + top - 1 && r.x + r.w <= f.w - f.safe.right + 1 && r.y + r.h <= f.h - f.safe.bottom + 1;
  // ---- the kicker: native tracking against glyph by glyph
  {
    const { g } = mk(400, 100), names: string[] = [...new Set<string>([...a.cuts.map((c: any) => c.plan.name), ...a.films.flatMap((f: any) => f.beats.map((b: any) => b.model.member && b.model.member.name).filter(Boolean))])];
    let max = 0, nat = C.nativeTracking(g);
    for (const n of names) { C.setManualTracking(false); const w1 = C.kickWidth(g, n, 36); C.setManualTracking(true); const w2 = C.kickWidth(g, n, 36); C.setManualTracking(false); max = Math.max(max, Math.abs(w1 - w2)); }
    out.tracking = { native: nat, names: names.length, maxDiffPx: +max.toFixed(2), caps: C.caps('Étienne') };
    if (max > 8) prob(`the glyph-by-glyph tracking differs from ctx.letterSpacing by ${max.toFixed(2)} px at 36 px`);
    if (C.caps('Étienne') !== 'ÉTIENNE') prob('caps() does not uppercase accented names');
  }
  // ---- the ad cuts
  for (const c of a.cuts) for (const key of a.keys) {
    const f = P.cutFormat(key, a.res), { cv, g } = mk(f.w, f.h), audit = C.auditType(g, f.k), cap = P.cutCaptionBox(f), bb = P.cutBadgeBox(f, 0), r: any = { id: c.id, key };
    const roomSheet = cap.y - 16 * f.k - f.safe.top, roomWide = cap.y - f.safe.top - 8 * f.k, room = f.sheet ? roomSheet : roomWide;
    D.drawCutBadge(g, f, c.badge);
    // each part's card: the widths and paddings it can take; one of them has to fit the room
    r.cards = c.models.map((m: any) => {
      const widths = f.sheet ? [f.w - f.safe.left - f.safe.right] : L.canvasCardWidths(f), vars = L.canvasVariants(widths, (w: number, tight: boolean) => D.measureCard(g, m, f, w, tight)), fits = vars.filter((v: any) => v.layout.h <= room + 0.5 && !v.layout.bad);
      if (!fits.length) prob(`${c.id} ${key}: no way to set the card "${m.title}" in the ${room.toFixed(0)} px of room (smallest ${Math.min(...vars.map((v: any) => v.layout.h)).toFixed(0)} px)`);
      const best = fits[0] || vars[0]; D.drawCard(g, best.layout, f.safe.left, Math.max(f.safe.top, cap.y - 16 * f.k - best.layout.h), 1);
      return { title: m.title, variants: vars.length, fits: fits.length, h: +(best.layout.h / f.k).toFixed(0), type: +(best.layout.type / f.k).toFixed(2) };
    });
    // the hook: at some size it fits
    {
      const hw = f.sheet ? f.w - f.safe.left - f.safe.right : Math.min(f.w - f.safe.left - f.safe.right, (key === '1x1' ? 760 : 900) * f.k), hs = D.hookSizes(f).map((s: number) => D.measureHook(g, { name: c.plan.name, text: c.plan.hook.text }, f, hw, s)), ok = hs.filter((h: any) => h.h <= room + 0.5);
      if (!ok.length) prob(`${c.id} ${key}: no size of the hook "${c.plan.hook.text}" fits ${room.toFixed(0)} px`);
      r.hook = { sizes: hs.length, h: +(Math.min(...hs.map((h: any) => h.h)) / f.k).toFixed(0), type: +(hs[0].type / f.k).toFixed(2) };
      D.drawHook(g, ok[0] || hs[hs.length - 1], f.safe.left, f.safe.top + bb.h + 14 * f.k, 1);
    }
    // the end card: inside the safe area and under the corner mark
    {
      const e = D.drawCutEnd(g, f, c.end, 1); r.end = { w: +(e.w / f.k).toFixed(0), h: +(e.h / f.k).toFixed(0), y: +(e.y / f.k).toFixed(0), fit: e.fit, lines: e.lines };
      if (!inside(e, f, bb.h + 12 * f.k - 0.01 * f.k)) prob(`${c.id} ${key}: the end card (${e.fit}, ${e.lines} lines) does not fit: y ${(e.y / f.k).toFixed(0)} to ${((e.y + e.h) / f.k).toFixed(0)} of ${(f.h / f.k).toFixed(0)}, safe ${(f.safe.top / f.k).toFixed(0)} to ${((f.h - f.safe.bottom) / f.k).toFixed(0)}`);
    }
    // the captions: every cue holds its two lines in the strip
    {
      const cues = P.cutCues(c.plan.parts, P.cutCaptionChars(key)); let worst = 0;
      for (const cue of cues) { const rc = D.drawCaption(g, f, cue, (cue.start + cue.end) / 2); if (rc) { worst = Math.max(worst, rc.h / f.k); if (rc.h > cap.h + 1 || rc.w > cap.w + 1) prob(`${c.id} ${key}: the caption "${cue.text}" is ${rc.w.toFixed(0)} x ${rc.h.toFixed(0)}, the strip ${cap.w} x ${cap.h}`); } }
      r.caption = { cues: cues.length, worstH: +worst.toFixed(0), font: +(cap.font / f.k).toFixed(0) };
    }
    r.type = { min: +audit.min.toFixed(3), text: audit.text, sizes: audit.sizes };
    if (audit.min < FLOOR - 0.01) prob(`${c.id} ${key}: ${audit.min.toFixed(2)} design px painted for "${audit.text}" (floor ${FLOOR})`);
    out.cuts.push(r);
    if (a.shots.includes(c.id)) {
      // the end card and the card with its caption, each on a fresh picture (the canvas above has every element drawn once, for the audit)
      const e1 = mk(f.w, f.h); D.drawCutBadge(e1.g, f, c.badge); D.drawCutEnd(e1.g, f, c.end, 1); out.shots[`${c.id}.${key}.end`] = e1.cv.toDataURL('image/png').slice(22);
      const e2 = mk(f.w, f.h), m0 = c.models[0], widths = f.sheet ? [f.w - f.safe.left - f.safe.right] : L.canvasCardWidths(f), v0 = L.canvasVariants(widths, (w: number, tight: boolean) => D.measureCard(e2.g, m0, f, w, tight)).filter((v: any) => v.layout.h <= room && !v.layout.bad)[0];
      D.drawCutBadge(e2.g, f, c.badge); D.drawCard(e2.g, v0.layout, f.sheet ? f.safe.left : (f.w - v0.layout.w) / 2, f.sheet ? cap.y - 16 * f.k - v0.layout.h : f.safe.top + bb.h + 30 * f.k, 1);
      D.drawCaption(e2.g, f, P.cutCues(c.plan.parts, P.cutCaptionChars(key))[1], c.plan.parts[0].narrAt + 3); out.shots[`${c.id}.${key}.card`] = e2.cv.toDataURL('image/png').slice(22);
    }
  }
  // ---- the family films
  for (const fl of a.films) for (const key of ['16x9', '9x16']) {
    const f = L.formatFor(key, a.res), { cv, g } = mk(f.w, f.h), audit = C.auditType(g, f.k), cap = L.captionBox(f), bb = L.badgeBox(f, 0), r: any = { slug: fl.slug, key };
    const room = cap.y - f.safe.top - 8 * f.k;
    O.drawBadge(g, f, fl.badge, 1);
    r.cards = fl.beats.map((b: any) => {
      const widths = f.portrait ? [f.w - f.safe.left - f.safe.right] : L.canvasCardWidths(f), vars = L.canvasVariants(widths, (w: number, tight: boolean, bare: boolean) => C.measureCard(g, b.model, f, w, tight, bare), { bare: !!b.model.phone }), fits = vars.filter((v: any) => v.layout.h <= room + 0.5 && !v.layout.bad);
      if (!fits.length) prob(`${fl.slug} film ${key}: no way to set the card of ${b.id} in ${room.toFixed(0)} px (smallest ${Math.min(...vars.map((v: any) => v.layout.h)).toFixed(0)})`);
      const best = fits[0] || vars[0]; C.drawCard(g, best.layout, f.safe.left, Math.max(f.safe.top, cap.y - 16 * f.k - best.layout.h), 1, 0.6);
      return { beat: b.id, phone: !!b.model.phone, variants: vars.length, fits: fits.length, tag: best.size.tag, h: +(best.layout.h / f.k).toFixed(0), type: +(best.layout.type / f.k).toFixed(2) };
    });
    C.drawTitle(g, f, fl.title, 5, 1);
    { const e = C.drawEnd(g, f, fl.end, 1); r.end = { w: +(e.w / f.k).toFixed(0), h: +(e.h / f.k).toFixed(0), y: +(e.y / f.k).toFixed(0) }; if (!inside(e, f)) prob(`${fl.slug} film ${key}: the end card does not fit: y ${(e.y / f.k).toFixed(0)} to ${((e.y + e.h) / f.k).toFixed(0)} of ${(f.h / f.k).toFixed(0)}`); }
    { const rc = O.drawCaption(g, f, { start: 0, end: 2, text: 'Hello there, this is a caption of two lines that the speaker says.', speaker: 'Odette', scripted: true, clip: 'x', words: 'Hello there, this is a caption of two lines that the speaker says.'.split(' ').map((t: string, i: number) => ({ text: t, s: i * 0.15, e: i * 0.15 + 0.14 })) }, 1); if (rc && (rc.h > cap.h + 1)) prob(`${fl.slug} film ${key}: the caption with its speaker row is ${rc.h.toFixed(0)} px tall, the strip ${cap.h}`); }
    r.type = { min: +audit.min.toFixed(3), text: audit.text, sizes: audit.sizes };
    if (audit.min < FLOOR - 0.01) prob(`${fl.slug} film ${key}: ${audit.min.toFixed(2)} design px painted for "${audit.text}" (floor ${FLOOR})`);
    out.films.push(r);
    if (a.shots.includes(fl.slug)) {
      const e1 = mk(f.w, f.h); C.drawTitle(e1.g, f, fl.title, 5, 1); out.shots[`${fl.slug}.film.${key}.title`] = e1.cv.toDataURL('image/png').slice(22);
      const e2 = mk(f.w, f.h); O.drawBadge(e2.g, f, fl.badge, 1); C.drawEnd(e2.g, f, fl.end, 1); out.shots[`${fl.slug}.film.${key}.end`] = e2.cv.toDataURL('image/png').slice(22);
      for (const [tag, b] of [['card', fl.beats.find((x: any) => !x.model.phone) || fl.beats[0]], ['phone', fl.beats.find((x: any) => x.model.phone)]] as any) {
        if (!b) continue;
        const e3 = mk(f.w, f.h), widths = f.portrait ? [f.w - f.safe.left - f.safe.right] : L.canvasCardWidths(f), v = L.canvasVariants(widths, (w: number, tight: boolean, bare: boolean) => C.measureCard(e3.g, b.model, f, w, tight, bare), { bare: !!b.model.phone }).filter((x: any) => x.layout.h <= room && !x.layout.bad)[0];
        O.drawBadge(e3.g, f, fl.badge, 1); C.drawCard(e3.g, v.layout, f.portrait ? f.safe.left : (f.w - v.layout.w) / 2, f.portrait ? cap.y - 16 * f.k - v.layout.h : f.safe.top + bb.h + 30 * f.k, 1, 0.55);
        out.shots[`${fl.slug}.film.${key}.${tag}`] = e3.cv.toDataURL('image/png').slice(22);
      }
    }
  }
  return out;
}, { cuts: only === 'films' ? [] : cuts, films: only === 'cuts' ? [] : films, keys: CUT_KEYS, res: RES, floor: CANVAS_TYPE_MIN, shots: shots ? ['brennan-sally', 'brennan-hollin-sally', 'brennan'] : [] });
await browser.close(); await srv.close();

if (shots) { fs.mkdirSync(shots, { recursive: true }); for (const [k, b64] of Object.entries<string>(report.shots)) fs.writeFileSync(path.join(shots, `${k}.png`), Buffer.from(b64, 'base64')); }
delete report.shots;
fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(report, null, 1));

// ---- the summary --------------------------------------------------------------------------------------------------------------------------------------
const ends = new Map<string, number>(); for (const r of report.cuts) { const k = `${r.key} ${r.end.fit}`; ends.set(k, (ends.get(k) || 0) + 1); }
const mins = [...report.cuts, ...report.films].map((r: any) => r.type.min);
console.log(`tracking: ${report.tracking.native ? 'ctx.letterSpacing' : 'glyph by glyph'}, the two differ by at most ${report.tracking.maxDiffPx} px over ${report.tracking.names} names`);
console.log(`type painted: smallest ${mins.length ? Math.min(...mins).toFixed(2) : '-'} design px over ${report.cuts.length} cut frames and ${report.films.length} film frames (floor ${report.floor})`);
console.log(`end cards: ${[...ends].sort().map(([k, n]) => `${k} x${n}`).join(', ')}`);
const tall = report.cuts.map((r: any) => ({ id: `${r.id} ${r.key}`, h: r.end.h, lines: r.end.lines })).sort((a: any, b: any) => b.h - a.h)[0];
if (tall) console.log(`tallest end card: ${tall.id}, ${tall.h} design px, ${tall.lines} lines`);
for (const p of report.problems) console.error(`✗ ${p}`);
console.log(report.problems.length ? `${report.problems.length} problem${report.problems.length === 1 ? '' : 's'}` : 'every cut and film holds the floor and fits its frame');
process.exit(report.problems.length ? 1 : 0);
