#!/usr/bin/env -S node --experimental-strip-types
// R6: the blind A/B generator (plan 5.1, 8.1). Pairs a BEFORE and an AFTER frame of the same camera, puts them side by side as "A" and
// "B" with the sides chosen by a seeded stream, and writes a key file the reviewer never sees. The pair images carry no room name,
// no set name, no file name of their source: only "A", "B" and the pair's number.
//
//   node --experimental-strip-types scripts/review/ab.mts generate --after <dir> [--before <dir>] [--seed s] [--out <dir>]
//        [--n 24] [--houses aurora,cutestarter] [--frames NW/day,SE/day] [--rooms a,b]
//   node --experimental-strip-types scripts/review/ab.mts score --key <key.json> --responses <responses.json> [--gate pilot|final|bed|plant|read]
//
//   generate  writes <out>/pair-01.jpg ..., <out>/key.json (pair -> which side is the AFTER, and the hashes of both source frames and of
//             the pair image), <out>/responses.template.json ({ "01": null, ... }: fill each with "A", "B" or "same"), and <out>/index.html
//             (a plain page that shows the pairs and builds the responses file; it never loads the key).
//             The default is the final review's 24 pairs: the NW day frame of each of the 24 rooms. --frames and --houses make the
//             pilot's 15 (aurora, cutestarter, seraphine), the six bedrooms of G-BED, and so on. Same arguments, same bytes.
//   score     counts how many pairs preferred the AFTER, the BEFORE, or neither, and judges the plan's gates.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REVIEW_DIR, parseArgs, readJson, sha256File, stableJson, writeText, mulberry32, fnv1a, rel } from './lib.mts';
import { BEFORE_MANIFEST, loadManifest, manifestIn, type Manifest } from './manifest.mts';
import { R24 } from './cameras.mts';

export interface KeyEntry { pair: string; room: string; frame: string; afterSide: 'A' | 'B'; beforeSha256: string; afterSha256: string; pairSha256?: string }
export interface Key { schema: 1; seed: string; before: string; after: string; pairs: KeyEntry[] }

/** the frames to pair and the order and side of each, a pure function of (rooms, frames, n, seed) */
export function planPairs(frames: string[], seed: string, n: number): Array<{ frame: string; afterSide: 'A' | 'B' }> {
  const pick = frames.slice();
  // a seeded Fisher-Yates over the ids: the order is not the room order, so position tells the reviewer nothing
  const rnd = mulberry32(fnv1a(`${seed}:order`));
  for (let i = pick.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pick[i], pick[j]] = [pick[j], pick[i]]; }
  const chosen = pick.slice(0, n);
  const side = mulberry32(fnv1a(`${seed}:sides`));
  // sides: a seeded draw per pair, then balanced so neither letter is the AFTER more than ceil(n/2) times (a reviewer who always picks B must not score)
  const sides = chosen.map(() => (side() < 0.5 ? 'A' : 'B') as 'A' | 'B');
  const cap = Math.ceil(chosen.length / 2);
  for (const L of ['A', 'B'] as const) {
    let over = sides.filter(s => s === L).length - cap;
    for (let i = sides.length - 1; over > 0 && i >= 0; i--) if (sides[i] === L) { sides[i] = L === 'A' ? 'B' : 'A'; over--; }
  }
  return chosen.map((frame, i) => ({ frame, afterSide: sides[i] }));
}

const GATES: Record<string, { need: number; of: number | null; what: string; noneWorse: boolean }> = {
  read: { need: 0, of: null, what: 'G-READ: the owner confirms the small goods read (a judgement, not a count)', noneWorse: false },
  bed: { need: 0, of: null, what: 'G-BED: owner A/B of the six bedrooms (a judgement; every pair should prefer AFTER)', noneWorse: true },
  plant: { need: 0, of: null, what: 'G-PLANT: owner looks at the plant sheets (a judgement)', noneWorse: false },
  pilot: { need: 14, of: 15, what: 'G-PILOT: at least 14 of 15 pairs prefer AFTER and no clutter defect', noneWorse: false },
  final: { need: 22, of: 24, what: 'final: at least 22 of 24 pairs prefer AFTER', noneWorse: false },
};

function generate(args: Record<string, string>) {
  const after = loadSet(args.after, 'after'), before = loadSet(args.before, 'before');
  const seed = args.seed && args.seed !== 'true' ? args.seed : `ab:${after.m.set}`;
  const frames = (args.frames && args.frames !== 'true' ? args.frames : 'NW/day').split(',');
  const houses = args.houses ? new Set(args.houses.split(',')) : null, rooms = args.rooms ? new Set(args.rooms.split(',')) : null;
  const ids: string[] = [];
  for (const r of R24) {
    if ((houses && !houses.has(r.house)) || (rooms && !rooms.has(r.id))) continue;
    for (const f of frames) { const id = `${r.id}/${f}`; if (before.m.shots.some(s => s.id === id) && after.m.shots.some(s => s.id === id)) ids.push(id); }
  }
  const n = Number(args.n || 24);
  if (!ids.length) { console.error('no frame is in both sets'); process.exit(2); }
  const out = path.resolve(args.out && args.out !== 'true' ? args.out : path.join(REVIEW_DIR, 'ab', `${after.m.set}-${fnv1a(seed).toString(16)}`));
  fs.mkdirSync(out, { recursive: true });
  const plan = planPairs(ids, seed, n);
  const key: Key = { schema: 1, seed, before: before.m.set, after: after.m.set, pairs: [] };
  plan.forEach((p, i) => {
    const num = String(i + 1).padStart(2, '0'), b = before.m.shots.find(s => s.id === p.frame)!, a = after.m.shots.find(s => s.id === p.frame)!;
    const bf = path.join(before.dir, b.file), af = path.join(after.dir, a.file);
    const left = p.afterSide === 'A' ? af : bf, right = p.afterSide === 'A' ? bf : af;
    const spec = path.join(out, `.pair-${num}.json`), img = path.join(out, `pair-${num}.jpg`);
    writeText(spec, JSON.stringify({ out: img, tile_w: 640, quality: 92, rows: [[{ file: left, label: `A    ${num}` }, { file: right, label: `B    ${num}` }]] }));
    const r = spawnSync('python3', [path.join(import.meta.dirname, 'sheet.py'), spec], { encoding: 'utf8' });
    fs.rmSync(spec, { force: true });
    if (r.status !== 0) throw new Error(`sheet.py: ${r.stderr}`);
    key.pairs.push({ pair: num, room: p.frame.split('/')[0], frame: p.frame, afterSide: p.afterSide, beforeSha256: sha256File(bf), afterSha256: sha256File(af), pairSha256: sha256File(img) });
  });
  writeText(path.join(out, 'key.json'), stableJson(key));
  writeText(path.join(out, 'responses.template.json'), stableJson({ schema: 1, note: 'for each pair write "A", "B" or "same": the side you prefer', responses: Object.fromEntries(key.pairs.map(p => [p.pair, null])) }));
  writeText(path.join(out, 'index.html'), reviewPage(key.pairs.map(p => p.pair)));
  const aSide = key.pairs.filter(p => p.afterSide === 'A').length;
  console.log(`${key.pairs.length} pairs → ${out}`);
  console.log(`AFTER is A in ${aSide}, B in ${key.pairs.length - aSide} (seed "${seed}"); the key is ${rel(path.join(out, 'key.json'))}: do not open it before scoring`);
}

function reviewPage(pairs: string[]) {
  const rows = pairs.map(p => `<section><img src="pair-${p}.jpg" alt="pair ${p}"><label>pair ${p}: preferred <select data-p="${p}"><option value="">-</option><option>A</option><option>B</option><option>same</option></select></label></section>`).join('\n');
  return `<!doctype html><meta charset="utf-8"><title>Blind A/B review</title>
<style>body{font:15px system-ui,sans-serif;margin:16px;background:#111;color:#eee}section{margin:0 0 24px}img{max-width:100%;display:block}label{display:block;margin-top:6px}button{margin:12px 0;padding:8px 14px}</style>
<h1>Blind A/B review</h1><p>For each pair pick the picture you prefer as a home you would want to live in. Then save the responses and give the file back.</p>
${rows}
<button id="save">Save responses.json</button>
<script>document.getElementById('save').onclick=()=>{const r={};document.querySelectorAll('select').forEach(s=>r[s.dataset.p]=s.value||null);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({schema:1,responses:r},null,1)+'\\n'],{type:'application/json'}));a.download='responses.json';a.click();};</script>
`;
}

function score(args: Record<string, string>) {
  const key = readJson<Key>(path.resolve(args.key)), res = readJson(path.resolve(args.responses)).responses as Record<string, string | null>;
  let after = 0, before = 0, same = 0, blank = 0;
  const worse: string[] = [];
  for (const p of key.pairs) {
    const r = res[p.pair];
    if (!r) { blank++; continue; }
    if (r === 'same') { same++; continue; }
    if (r === p.afterSide) after++; else { before++; worse.push(`${p.pair} (${p.room})`); }
  }
  console.log(`${key.pairs.length} pairs: ${after} prefer AFTER, ${before} prefer BEFORE, ${same} same${blank ? `, ${blank} unanswered` : ''}`);
  for (const w of worse) console.log(`  BEFORE preferred: ${w}`);
  const g = args.gate && GATES[args.gate];
  if (g) {
    // a counted gate scales with the number of pairs actually reviewed; a judgement gate reads "no pair preferred BEFORE" as its pass
    const need = g.of ? Math.ceil(g.need / g.of * key.pairs.length) : 0;
    const ok = !blank && (g.of ? after >= need : before === 0);
    console.log(`${ok ? '✓' : '✗'} ${g.what}${g.of ? ` (${after} of ${key.pairs.length} prefer AFTER, need ${need})` : ` (${before} pair(s) preferred BEFORE)`}`);
    process.exit(ok ? 0 : 1);
  }
}

function loadSet(dirArg: string | undefined, role: string): { dir: string; m: Manifest } {
  if (!dirArg && role === 'before') dirArg = path.join(REVIEW_DIR, 'before');
  if (!dirArg || dirArg === 'true') { console.error(`--${role} <set directory> is required`); process.exit(2); }
  const dir = path.resolve(dirArg), set = path.basename(dir);
  const mf = fs.existsSync(manifestIn(dir, set)) ? manifestIn(dir, set) : role === 'before' ? BEFORE_MANIFEST : '';
  if (!mf) { console.error(`no ${set}.manifest.json in ${dir}`); process.exit(2); }
  return { dir, m: loadManifest(mf) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2], args = parseArgs(process.argv.slice(3));
  if (cmd === 'generate') generate(args);
  else if (cmd === 'score') score(args);
  else { console.error('usage: ab.mts generate --after <dir> [...] | score --key k.json --responses r.json [--gate final]'); process.exit(2); }
}
