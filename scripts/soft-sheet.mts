#!/usr/bin/env -S node --experimental-strip-types
// The SOFT prop-sheet page (PLAN 5.3 T1): each soft type built alone on the neutral floor in the repo's own renderer (room-creator.html's
// `__housePropSheet`: the three-quarter view, GTAO, the house's role colours), ONE COLUMN PER SEED, one row per type, labelled.
//
//   node --experimental-strip-types scripts/soft-sheet.mts [--types a,b] [--group beds|curtains|towels|loose|all] [--seeds a,b,c]
//        [--palette teal|warm|sage] [--params '{"curtains":{"w":2.4}}'] [--out sheet.jpg] [--root <tree>] [--tile 480] [--crop 0.25,0.2,0.75,0.8] [--plain]
// --root renders the same sheet from another served tree (the integration worktree is the BEFORE: same camera, same palette, same seeds).
// Sheets default to video/props/ (gitignored). One browser, one job; ~20 s.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from './review/lib.mts';

const args = parseArgs(process.argv.slice(2));
if (args.root) process.env.REVIEW_SERVE_ROOT = String(args.root);
const { startSession } = await import('./review/page.mts');
const ROOT = path.resolve(import.meta.dirname, '..');

const GROUPS: Record<string, string[]> = {
  beds: ['single-bed', 'upholstered-bed', 'headboard-bed', 'sleigh-bed', 'canopy-bed', 'four-poster-bed', 'toddler-bed', 'bunk-bed', 'loft-bed', 'house-bed'],
  curtains: ['curtains'],
  towels: ['towel-rail', 'heated-towel-rail', 'towel-ladder', 'towel-stack', 'towel-ring-set', 'robe-hook'],
  loose: ['cushion-set', 'throw-blanket', 'floor-cushion', 'pouf', 'ottoman', 'bean-bag', 'beanbag', 'cushioned-bench'],
};
GROUPS.all = Object.values(GROUPS).flat();
const PALETTES: Record<string, any> = {
  teal: { wall: '#f1f5f9', trim: '#1e293b', accent: '#0f766e', roof: '#334155', material: 'stucco' },
  warm: { wall: '#f5ede0', trim: '#4a3728', accent: '#b45309', roof: '#7c4a2d', material: 'stucco' },
  sage: { wall: '#eef0e8', trim: '#33402f', accent: '#5b7f5a', roof: '#44513f', material: 'stucco' },
};
const types: string[] = String(args.types || '').split(',').filter(Boolean).length ? String(args.types).split(',') : GROUPS[String(args.group || 'all')];
const seeds = String(args.seeds || 'a,b,c').split(',');
const palette = PALETTES[String(args.palette || 'teal')];
const params = args.params ? JSON.parse(String(args.params)) : {};
const OUT = String(args.out || path.join(ROOT, 'video', 'props', `soft-${args.group || 'sheet'}-${args.palette || 'teal'}.jpg`));

const session = await startSession();
const rows: any[][] = types.map(t => seeds.map(() => ({ label: t })));
const info: Record<string, string> = {};
try {
  const w = await session.openBare();
  if (args.plain) await w.page.evaluate(() => { (window as any).__housePlainRender = true; });   // no composer: shows what GTAO adds
  const shots: Array<Record<string, any>> = [];
  for (const seed of seeds) {
    shots.push(await w.page.evaluate(async ({ types, seed, palette, params }: any) => {
      const hb = (window as any).__houseBuilderRef, orig = hb.buildProp;
      hb.buildProp = (t: string, p: any, pal: any) => orig.call(hb, t, p, pal, seed);   // the seed is the only thing a sheet column changes
      try { return await (window as any).__housePropSheet(types, { res: '540', palette, params }); } finally { hb.buildProp = orig; }
    }, { types, seed, palette, params }));
  }
  if (w.errors.length) console.error(`page errors: ${w.errors.slice(0, 3).join(' | ')}`);
  await w.close();
  const tmp = fs.mkdtempSync(path.join(ROOT, 'video', 'soft-sheet-'));
  types.forEach((t, ti) => seeds.forEach((sd, si) => {
    const s = shots[si][t];
    if (!s || s.error) { rows[ti][si] = { label: `${t} / ${sd}`, sub: s ? s.error : 'no render', file: null }; return; }
    const f = path.join(tmp, `${t}-${sd}.jpg`); fs.writeFileSync(f, Buffer.from(s.jpg, 'base64'));
    rows[ti][si] = { file: f, label: `${t} / seed ${sd}`, sub: `${s.size[0]} x ${s.size[2]} x ${s.size[1]} m` };
    if (si === 0) info[t] = `${s.size.join(' x ')}`;
  }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const spec = path.join(tmp, 'spec.json');
  fs.writeFileSync(spec, JSON.stringify({ out: OUT, tile_w: Number(args.tile || 480), crop: String(args.crop || '0,0,1,1').split(',').map(Number), quality: 90, title: `soft sheet  palette ${args.palette || 'teal'}  seeds ${seeds.join(',')}  ${args.root ? 'tree ' + args.root : 'this tree'}`, rows }));
  const r = spawnSync('python3', [path.join(ROOT, 'scripts', 'soft-sheet.py'), spec], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr); process.exitCode = 1; } else console.log(r.stdout.trim());
  fs.rmSync(tmp, { recursive: true, force: true });
} finally { await session.close(); }
