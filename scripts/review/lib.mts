// Shared plumbing of the review rig (plan 5.1, RIG). Pure Node, no browser, no product code: the rig has to keep measuring the
// same way while the product code under it changes, so it carries its own copies of the two things it needs from the engine
// (a seeded stream and a hash) instead of importing assets/*.js.
//
// Nothing here reads a wall clock or Math.random: every file the rig writes into git is a pure function of the tree and its
// arguments, and `stableJson` is what makes two runs write the same bytes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
/** the review images live outside git (plan 5.1): hashed by a manifest that is committed under test/review/baselines/ */
export const REVIEW_DIR = process.env.REVIEW_DIR ? path.resolve(process.env.REVIEW_DIR) : '/Users/liam/devel/_staging/3dinside/_review';
export const BASELINES = path.join(ROOT, 'test', 'review', 'baselines');
export const BEFORE_TAG = 'baseline/stage0-green';

export const sha256 = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex');
export const sha256File = (f: string) => sha256(fs.readFileSync(f));

/** a seeded stream, the same recurrence as the engine's mulberry32 (assets/materials.ts) but the rig's own copy */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const fnv1a = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };

/** JSON with sorted keys at every depth, one space of indent, and arrays of plain values on one line: the bytes depend on the data and
 *  nothing else. `indent` 0 writes one line. */
export function stableJson(v: unknown, indent: number | string = 1): string {
  const sort = (x: any): any => Array.isArray(x) ? x.map(sort) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sort(x[k])])) : x;
  const sorted = sort(v);
  if (indent === 0 || indent === '') return JSON.stringify(sorted) + '\n';
  const unit = typeof indent === 'number' ? ' '.repeat(indent) : indent;
  const emit = (x: any, depth: number): string => {
    if (Array.isArray(x)) {
      if (!x.length) return '[]';
      if (x.every(e => e === null || typeof e !== 'object')) return `[${x.map(e => JSON.stringify(e)).join(', ')}]`;
      return `[\n${x.map(e => unit.repeat(depth + 1) + emit(e, depth + 1)).join(',\n')}\n${unit.repeat(depth)}]`;
    }
    if (x && typeof x === 'object') {
      const ks = Object.keys(x);
      if (!ks.length) return '{}';
      return `{\n${ks.map(k => `${unit.repeat(depth + 1)}${JSON.stringify(k)}: ${emit(x[k], depth + 1)}`).join(',\n')}\n${unit.repeat(depth)}}`;
    }
    return JSON.stringify(x);
  };
  return emit(sorted, 0) + '\n';
}
export const round = (v: number, dp = 3) => { const f = 10 ** dp; return Math.round(v * f) / f; };

/** `--key value` and bare `--flag` arguments */
export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  argv.forEach((a, i) => { if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'; });
  return out;
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function git(args: string[], cwd = ROOT): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${(r.stderr || '').trim()}`);
  return r.stdout.trim();
}

/** The product code a render was made from: the git tree ids of every path a frame depends on, at HEAD, and whether the working
 *  tree has any uncommitted change under them. Two manifests with equal `product` were rendered from the same product code,
 *  whatever else (scripts, tests, docs) differs between the commits. */
export const PRODUCT_PATHS = ['assets', 'content', 'room-creator.html', 'index.html', 'portal', 'scripts/vendor'];
export function productFingerprint(rev = 'HEAD') {
  const tree: Record<string, string> = {};
  for (const p of PRODUCT_PATHS) tree[p] = git(['rev-parse', `${rev}:${p}`]);
  const dirty = rev === 'HEAD' ? git(['status', '--porcelain', '--', ...PRODUCT_PATHS]).split('\n').filter(Boolean) : [];
  return { rev: git(['rev-parse', rev]), tree, dirty };
}
/** What a committed baseline records of the product code it was taken from: the content (the tree ids), never the commit. Two
 *  freezes from different commits with identical trees must write identical bytes, so `rev` stays out of every compared file. */
export const productKey = (fp: { tree: Record<string, string> }) => ({ tree: fp.tree });
/** `rev` is informational: which commit a baseline was last frozen from. It lives in its own file, never in the compared bytes. */
export const PROVENANCE = path.join(BASELINES, 'provenance.json');
export function recordProvenance(name: string, fp: { rev: string; tree: Record<string, string> }, file = PROVENANCE) {
  const cur = fs.existsSync(file) ? readJson<Record<string, any>>(file) : {};
  cur[name] = { rev: fp.rev, treeAtFreeze: productKeyId(fp) };
  writeText(file, stableJson({ schema: 1, what: 'informational only: the commit each baseline was last frozen from. Nothing compares this file; the baselines are keyed by product.tree (content), so a re-freeze from another commit with the same trees changes only this file.', ...cur }));
}
/** one short id for a tree map (fnv1a over its sorted entries) */
export const productKeyId = (fp: { tree: Record<string, string> }) => fnv1a(Object.keys(fp.tree).sort().map(k => `${k}=${fp.tree[k]}`).join('\n')).toString(16).padStart(8, '0');
/** HEAD against the frozen BEFORE tag: which product paths differ */
export function productDiffersFromTag(tag = BEFORE_TAG): string[] {
  const a = productFingerprint(tag).tree, b = productFingerprint('HEAD').tree;
  return PRODUCT_PATHS.filter(p => a[p] !== b[p]);
}

/** the machine a measurement was taken on: reported next to timings, never part of a hash */
export function machine() {
  return { platform: process.platform, arch: process.arch, node: process.version, load1: round(os.loadavg()[0], 1), cpus: os.cpus().length };
}

export function readJson<T = any>(f: string): T { return JSON.parse(fs.readFileSync(f, 'utf8')); }
export function writeText(f: string, text: string) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }

export const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const rel = (f: string) => path.relative(ROOT, f);
