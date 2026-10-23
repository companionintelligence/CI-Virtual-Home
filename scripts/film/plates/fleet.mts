#!/usr/bin/env -S node --experimental-strip-types
// story:film:fleet. Every family and every home with no family, through the plates and the kit's wrap, one after the other, resumable, with a report. Never a video in git.
//
//   pnpm run story:film:fleet                       the draft pass (540 p plates, the kit's draft quality) over the whole queue, then the final pass (1080 p, high quality)
//        [--mode draft|final|both]   default both: every draft first (cheap, to look at), then every final
//        [--only a,b,c]     these ids (families and homes), in this order     [--order a,b,c]   these first, then the rest
//        [--gl default|nvidia|software|auto]   auto (the default): probe the first item on the Intel and the NVIDIA GL paths and keep the faster for the whole queue (recorded in the queue: a resumed run keeps it)
//        [--probe]          probe again even if the queue has a path     [--probe-only] probe, record the path in the queue and stop     [--aspect 16x9,9x16[,1x1]]   the plates' aspects (default 16x9,9x16)
//        [--kit <dir>]      the CI-Common checkout (or $CI_COMMON_KIT)   [--no-wrap] plates only    [--retry-failed] try the items that failed again   [--dry-run] print the queue
//        [--jobs 1]         one GPU process at a time on this machine: more is refused
//
// The queue is `video/queue.json` (gitignored with the rest of /video/*; $CI_QUEUE_FILE moves it): an item per family or home, and for each mode a state (pending, plates, wrapped, failed), the seconds
// each step took and, for a failure, why. A step is a child process under `nice -n 10`; its log is video/queue-logs/<id>.<mode>.<step>.log. The plates step is itself resumable and cached per beat
// (scripts/film/plates/cli.mts), so re-running the fleet after a crash or a copy change draws only what moved; the wrap step is skipped when the manifest it wrapped is still the manifest.
// The report is video/queue-report.json and .md. Order: the Brennans first (the owner's pilot homes), then the rest of the families, then the homes with no family.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, filmableSlugs, sha256 } from '../lib.mts';
import { platesRoot, kitProjectsRoot, homesWithoutFamily, homeInfo } from './lib.mts';

export type Mode = 'draft' | 'final';
export const MODES: Record<Mode, { res: number; quality: 'draft' | 'high' }> = { draft: { res: 540, quality: 'draft' }, final: { res: 1080, quality: 'high' } };
export type State = 'pending' | 'plates' | 'wrapped' | 'failed';
export type ModeState = { state: State; error?: string; seconds?: { plates?: number; wrap?: number }; manifestSha256?: string; outputs?: string[]; failedAt?: 'plates' | 'wrap' };
export type Item = { id: string; kind: 'family' | 'home'; /** the id the plates and the wrap know it by (a home's film id) */ film: string; modes: Partial<Record<Mode, ModeState>> };
export type Queue = { v: 1; gl: { chosen: string; probe: Array<{ gl: string; renderer: string; spf: number }> | null } | null; aspect: string; items: Item[] };

export const queuePath = (): string => process.env.CI_QUEUE_FILE ? path.resolve(process.env.CI_QUEUE_FILE) : path.join(ROOT, 'video', 'queue.json');
export const logsDir = (): string => path.join(path.dirname(queuePath()), 'queue-logs');
export const reportBase = (): string => path.join(path.dirname(queuePath()), 'queue-report');
export const readQueue = (): Queue | null => { try { const q = JSON.parse(fs.readFileSync(queuePath(), 'utf8')); return q && q.v === 1 ? q : null; } catch { return null; } };
export function writeQueue(q: Queue) { fs.mkdirSync(path.dirname(queuePath()), { recursive: true }); const f = queuePath(); fs.writeFileSync(`${f}.part`, JSON.stringify(q, null, 1) + '\n'); fs.renameSync(`${f}.part`, f); }

/** The order of a first run: the Brennans (the pilot), the other families by slug, the homes with no family by id. `first` moves ids to the front. */
export function orderOf(families: string[], homes: string[], first: string[] = []): Array<{ id: string; kind: 'family' | 'home' }> {
  const brennan = families.filter(s => s === 'brennan' || s.startsWith('brennan-')).sort((a, b) => (a === 'brennan' ? -1 : b === 'brennan' ? 1 : a.localeCompare(b)));
  const all = [...brennan, ...families.filter(s => !brennan.includes(s)).sort(), ...homes.slice().sort()].map(id => ({ id, kind: (families.includes(id) ? 'family' : 'home') as 'family' | 'home' }));
  const front = first.map(id => all.find(x => x.id === id)).filter((x): x is { id: string; kind: 'family' | 'home' } => !!x);
  return [...front, ...all.filter(x => !first.includes(x.id))];
}
/** Make the queue for the families and homes there are now, keeping the state of every item already in it (a family that has gone is dropped; a new one is added at its place). */
export function mergeQueue(prev: Queue | null, order: Array<{ id: string; kind: 'family' | 'home' }>, aspect: string): Queue {
  const old = new Map((prev?.items || []).map(i => [i.id, i]));
  const items: Item[] = order.map(o => old.get(o.id) ?? { id: o.id, kind: o.kind, film: o.kind === 'home' ? homeInfo(o.id).id : o.id, modes: {} });
  return { v: 1, gl: prev?.gl ?? null, aspect: prev?.aspect ?? aspect, items };
}

type Step = { code: number; seconds: number; log: string };
const sh = (cmd: string, args: string[], log: string, env: Record<string, string> = {}): Promise<Step> => new Promise(resolve => {
  const t0 = Date.now(); fs.mkdirSync(path.dirname(log), { recursive: true });
  const out = fs.createWriteStream(log), c = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  c.stdout.pipe(out, { end: false }); c.stderr.pipe(out, { end: false });
  c.on('close', code => { out.end(); resolve({ code: code ?? 1, seconds: +((Date.now() - t0) / 1000).toFixed(1), log }); });
});
const node = (script: string, args: string[]) => ['nice', ['-n', '10', process.execPath, '--experimental-strip-types', '--no-warnings', path.join(ROOT, script), ...args]] as const;
const tail = (f: string, n = 6): string => { try { return fs.readFileSync(f, 'utf8').replace(/\r/g, '\n').trim().split('\n').filter(l => !/^\s+\S+ \S+: \d+ \/ \d+\s*$/.test(l)).slice(-n).join(' | '); } catch { return ''; } };

/** the env that puts a mode's plates and kit projects apart: a draft is never taken for the final */
export const modeEnv = (mode: Mode): Record<string, string> => mode === 'final' ? {} : { CI_PLATES_OUT: path.join(ROOT, 'video', 'plates-draft'), CI_KIT_OUT: path.join(ROOT, 'video', 'kit-draft') };

async function chooseGl(q: Queue, flag: string, force: boolean, aspect: string): Promise<void> {
  if (flag !== 'auto') { q.gl = { chosen: flag, probe: null }; return; }
  if (q.gl && !force) return;
  // (the probe draws a family's first plate: a queue of homes with no family alone has none to probe, and uses the default path)
  const first = q.items.find(i => i.kind === 'family');
  if (!first) { q.gl = { chosen: 'default', probe: null }; return; }
  const log = path.join(logsDir(), 'probe.log'), [c, a] = node('scripts/story-film.mts', [first.id, '--plates', '--probe', '1', '--gl', 'default,nvidia', '--res', '540', '--aspect', aspect.split(',')[0]]);
  console.log(`fleet: probing the GL paths on ${first.id} (default and nvidia) ...`);
  const r = await sh(c, [...a], log);
  const file = path.join(platesRoot(), 'probe', `${first.id}.probe.json`);
  if (r.code !== 0 || !fs.existsSync(file)) { console.error(`fleet: the probe failed (${tail(log)}); using the default path`); q.gl = { chosen: 'default', probe: null }; return; }
  const res = JSON.parse(fs.readFileSync(file, 'utf8')).results as Array<{ gl: string; renderer: string; spf: number }>, best = res.slice().sort((x, y) => x.spf - y.spf)[0];
  q.gl = { chosen: best.gl, probe: res.map(x => ({ gl: x.gl, renderer: x.renderer, spf: x.spf })) };
  console.log(`fleet: ${res.map(x => `${x.gl} ${x.spf.toFixed(3)} s a frame (${x.renderer})`).join('; ')}; using ${best.gl}`);
}

export async function main(argv: string[]): Promise<number> {
  const flags: Record<string, string> = {}, valued = new Set(['mode', 'only', 'order', 'gl', 'aspect', 'kit', 'jobs']);
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) flags[a.slice(2)] = valued.has(a.slice(2)) ? argv[++i] : 'true'; }
  if (+(flags.jobs || 1) > 1) { console.error('fleet: one GPU process at a time on this machine (--jobs 1); the plates are drawn one family after another'); return 2; }
  const mode = (flags.mode || 'both') as 'draft' | 'final' | 'both';
  if (!['draft', 'final', 'both'].includes(mode)) { console.error('--mode must be draft, final or both'); return 2; }
  const aspect = flags.aspect || '16x9,9x16', glFlag = flags.gl || 'auto';
  const families = filmableSlugs(), homes = homesWithoutFamily();
  let order = orderOf(families, homes, flags.order ? flags.order.split(',') : []);
  if (flags.only) { const only = flags.only.split(','); order = only.map(id => order.find(o => o.id === id)).filter((x): x is { id: string; kind: 'family' | 'home' } => !!x); if (order.length !== only.length) { console.error(`fleet: --only names ${only.filter(i => !order.some(o => o.id === i)).join(', ')}, which is neither a family with a bake lock nor a home with no family`); return 2; } }
  let q = mergeQueue(readQueue(), order, aspect);
  if (flags['dry-run'] === 'true') {
    console.log(`fleet: ${q.items.length} items (${q.items.filter(i => i.kind === 'family').length} families, ${q.items.filter(i => i.kind === 'home').length} homes without a family), modes ${mode === 'both' ? 'draft then final' : mode}; queue ${path.relative(ROOT, queuePath())}`);
    for (const i of q.items) console.log(`  ${i.id.padEnd(22)} ${i.kind.padEnd(7)} draft ${i.modes.draft?.state ?? 'pending'}, final ${i.modes.final?.state ?? 'pending'}${i.film !== i.id ? `  (film ${i.film})` : ''}`);
    return 0;
  }
  if (!q.items.length) { console.error('fleet: nothing to do'); return 2; }
  writeQueue(q);
  await chooseGl(q, glFlag, flags.probe === 'true' || flags['probe-only'] === 'true', q.aspect); writeQueue(q);
  if (flags['probe-only'] === 'true') { console.log(`fleet: GL path ${q.gl!.chosen}${q.gl!.probe ? ` (${q.gl!.probe.map(p => `${p.gl} ${p.spf.toFixed(3)} s a frame`).join(', ')})` : ''}`); return 0; }
  const gl = q.gl!.chosen, modes: Mode[] = mode === 'both' ? ['draft', 'final'] : [mode];
  const t0 = Date.now();
  for (const m of modes) {
    const { res, quality } = MODES[m], env = modeEnv(m);
    for (const item of q.items) {
      const st: ModeState = item.modes[m] ?? { state: 'pending' };
      if (st.state === 'failed' && flags['retry-failed'] !== 'true') { console.log(`fleet: ${item.id} ${m}: failed before (${st.error}); --retry-failed to try again`); continue; }
      const manifest = path.join(env.CI_PLATES_OUT || path.join(ROOT, 'video', 'plates'), item.film, 'plates.json');
      // the plates: resumable and cached per beat, so this is quick when nothing moved
      console.log(`fleet: ${item.id} ${m}: plates (${res} p, ${gl})`);
      const lp = path.join(logsDir(), `${item.id}.${m}.plates.log`), [c1, a1] = node('scripts/story-film.mts', [item.id, '--plates', '--res', String(res), '--gl', gl, '--aspect', q.aspect]);
      const p = await sh(c1, [...a1], lp, env);
      if (p.code !== 0) { item.modes[m] = { state: 'failed', failedAt: 'plates', error: tail(lp) || `exit ${p.code}`, seconds: { plates: p.seconds } }; writeQueue(q); console.error(`fleet: ${item.id} ${m}: plates failed: ${item.modes[m]!.error}`); continue; }
      item.modes[m] = { state: 'plates', seconds: { plates: p.seconds }, manifestSha256: fs.existsSync(manifest) ? sha256(fs.readFileSync(manifest)) : undefined }; writeQueue(q);
      if (flags['no-wrap'] === 'true') continue;
      // the wrap, skipped when it already wrapped this very manifest at this quality
      const project = path.join(env.CI_KIT_OUT || kitProjectsRoot(), item.film), rep = path.join(project, 'wrap-report.json');
      let prevRep: any = null; try { prevRep = JSON.parse(fs.readFileSync(rep, 'utf8')); } catch { /* none */ }
      if (prevRep && prevRep.ok && prevRep.manifestSha256 === item.modes[m]!.manifestSha256 && prevRep.quality === quality) {
        item.modes[m] = { ...item.modes[m]!, state: 'wrapped', outputs: (prevRep.outputs || []).map((o: any) => o.file) }; writeQueue(q);
        console.log(`fleet: ${item.id} ${m}: already wrapped`); continue;
      }
      console.log(`fleet: ${item.id} ${m}: wrap (${quality})`);
      const lw = path.join(logsDir(), `${item.id}.${m}.wrap.log`), [c2, a2] = node('scripts/film/wrap.mts', [item.film, '--quality', quality, ...(flags.kit ? ['--kit', flags.kit] : [])]);
      const w = await sh(c2, [...a2], lw, env);
      let r: any = null; try { r = JSON.parse(fs.readFileSync(rep, 'utf8')); } catch { /* none */ }
      if (w.code !== 0 || !r || !r.ok) { item.modes[m] = { ...item.modes[m]!, state: 'failed', failedAt: 'wrap', error: ((r?.errors || []).slice(0, 2).join(' | ')) || tail(lw) || `exit ${w.code}`, seconds: { plates: p.seconds, wrap: w.seconds } }; writeQueue(q); console.error(`fleet: ${item.id} ${m}: wrap failed: ${item.modes[m]!.error}`); continue; }
      item.modes[m] = { ...item.modes[m]!, state: 'wrapped', seconds: { plates: p.seconds, wrap: w.seconds }, outputs: (r.outputs || []).map((o: any) => o.file) }; writeQueue(q);
    }
  }
  writeReport(q, (Date.now() - t0) / 1000);
  const failed = q.items.flatMap(i => modes.filter(m => i.modes[m]?.state === 'failed').map(m => `${i.id} ${m}`));
  console.log(`fleet: ${q.items.length} items, ${failed.length ? `${failed.length} failed (${failed.join(', ')})` : 'none failed'}; report ${path.relative(ROOT, reportBase())}.md`);
  return failed.length ? 1 : 0;
}

/** The report: one table, what state each item is in for each mode, the time each step took and why one failed. */
export function writeReport(q: Queue, wallSeconds: number) {
  const row = (i: Item, m: Mode) => { const s = i.modes[m]; return s ? `${s.state}${s.seconds ? ` (${s.seconds.plates ?? 0} s plates${s.seconds.wrap !== undefined ? `, ${s.seconds.wrap} s wrap` : ''})` : ''}${s.error ? `: ${s.error.slice(0, 160)}` : ''}` : 'pending'; };
  const md = [
    '# Film fleet report', '',
    `GL path: ${q.gl ? q.gl.chosen : 'unset'}${q.gl?.probe ? ` (probe: ${q.gl.probe.map(p => `${p.gl} ${p.spf.toFixed(3)} s a frame, ${p.renderer}`).join('; ')})` : ''}. Aspects: ${q.aspect}. This run took ${(wallSeconds / 60).toFixed(1)} minutes.`, '',
    '| id | kind | draft (540 p) | final (1080 p) |', '|---|---|---|---|',
    ...q.items.map(i => `| ${i.id} | ${i.kind} | ${row(i, 'draft')} | ${row(i, 'final')} |`), '',
    'The plates are under video/plates (video/plates-draft for drafts) and the kit projects and renders under video/kit (video/kit-draft). None of it is in git.', '',
  ].join('\n');
  fs.writeFileSync(`${reportBase()}.md`, md);
  fs.writeFileSync(`${reportBase()}.json`, JSON.stringify({ v: 1, gl: q.gl, aspect: q.aspect, wallSeconds: +wallSeconds.toFixed(1), items: q.items }, null, 1) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main(process.argv.slice(2)));
