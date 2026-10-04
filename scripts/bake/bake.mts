#!/usr/bin/env -S node --experimental-strip-types
// The bake driver: models/manifest.json + a source pack outside git -> assets/props/baked/<family>.ts, deterministically.
//
//   node --experimental-strip-types scripts/bake/bake.mts                       bake every entry (writes the modules and the manifest's outSha256 / stats)
//   node --experimental-strip-types scripts/bake/bake.mts --id box-carton,x     only those entries (their family modules are re-emitted whole)
//   node --experimental-strip-types scripts/bake/bake.mts --verify-repro        bake each entry twice, compare the two and the committed bytes; writes nothing
//   node --experimental-strip-types scripts/bake/bake.mts --check               no Blender, no sources: the committed modules against the manifest's outSha256
//   node --experimental-strip-types scripts/bake/bake.mts --swatches <id>       the role-table bootstrap: each material / palette cell with its triangle count and mean colour
//   node --experimental-strip-types scripts/bake/bake.mts --list <id>           every mesh object of the entry's source file (to choose `objects`)
//   node --experimental-strip-types scripts/bake/bake.mts --suggest <id>        the uniform scale that best matches a type's measured box (assets/props/measured.ts)
//
// Environment: BLENDER (default the macOS 4.5 app), THREEDINSIDE_ROOT (the folder holding the 22 packs, never in git; default
// /Users/liam/devel/_staging/3dinside). Blender runs as `-b --factory-startup` (a user add-on throws on load), PYTHONHASHSEED=0, and the
// version is pinned in the manifest: a different build is refused unless --allow-blender is given (its hash is part of every module's header).
// Reproducibility is a measured property: --verify-repro, and scripts/test-baked.mts when the sources are present.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { sha256, recordSha } from './canon.mts';
import { writeFamily, familyConst, familyFile, ship } from './emit-ts.mts';
import { REPO, MANIFEST, readManifest, readJson, pretty } from './lib.mts';
import { ROLES, roleIsoColor } from '../../assets/props/model-kit.ts';

const SCRIPT = path.join(import.meta.dirname, 'blender_bake.py');
const BLENDER = process.env.BLENDER || '/Applications/Blender 4.5.app/Contents/MacOS/Blender';
const SOURCE_ROOT = process.env.THREEDINSIDE_ROOT || '/Users/liam/devel/_staging/3dinside';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes('--' + n);
const opt = (n: string) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null; };

const writeManifest = (m: any) => fs.writeFileSync(MANIFEST, pretty(m) + '\n');

// ---- the tool pin --------------------------------------------------------------------------------------------------------------------
function blenderVersion(): { version: string; hash: string } {
  const r = spawnSync(BLENDER, ['--version'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`cannot run Blender at ${BLENDER} (set BLENDER): ${r.stderr || r.error}`);
  const version = (r.stdout.match(/Blender (\d+\.\d+\.\d+)/) || [])[1] || '?', hash = (r.stdout.match(/build hash: (\w+)/) || [])[1] || '?';
  return { version, hash };
}
/** The part of the Blender script that decides geometry: comments and blank lines do not count, so editing a comment does not unbake the tree. */
export function scriptDigest(): string {
  const body = fs.readFileSync(SCRIPT, 'utf8').split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim() && !l.trim().startsWith('#')).join('\n');
  return sha256(body);
}
export const toolLine = (m: any) => `blender ${m.tool.blender} (build ${m.tool.hash})`;

// ---- one entry -> a job -------------------------------------------------------------------------------------------------------------
function resolveRoles(e: any): any {
  const r = e.roles || {};
  const table = r.table ? readJson(`models/roles/${r.table}.json`) : {};
  const out: any = { materials: { ...(table.materials || {}), ...(r.materials || {}) }, cells: { ...(table.cells || {}), ...(r.cells || {}) } };
  if (table.paletteMaterials) out.paletteMaterials = table.paletteMaterials;
  if (table.grid) out.grid = table.grid;
  if (table.paletteImage) out.paletteImage = path.join(SOURCE_ROOT, table.paletteImage);
  return out;
}
function jobFor(e: any, mode: string): any {
  const file = path.join(SOURCE_ROOT, e.src.file);
  const fit: any = {};
  for (const [p, f] of Object.entries(e.fit || {}) as any) fit[p] = { axis: f.axis, band: f.band };
  const pack = path.join(SOURCE_ROOT, e.src.file.split('/')[0], e.src.file.split('/')[0]);
  return {
    mode, id: e.id, src: file, objects: e.src.objects, include: e.src.include || [], exclude: e.src.exclude || [], flipObjects: e.src.flipObjects || [],
    pivotParts: e.pose && e.pose.pivotParts, pose: e.pose || {}, scale: e.scale || {}, roles: resolveRoles(e), colorParam: e.colorParam || null, open: e.open || [],
    budget: e.budget || {}, fit, hardEdge: e.hardEdge || 35, textureRoot: path.join(pack, 'Textures'),
  };
}
function runBlender(job: any): { out: any; seconds: number } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-bake-'));
  const jobPath = path.join(dir, 'job.json'), outPath = path.join(dir, 'out.json');
  fs.writeFileSync(jobPath, JSON.stringify(job));
  const t0 = process.hrtime.bigint();
  const r = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', SCRIPT, '--', jobPath, outPath], { encoding: 'utf8', env: { ...process.env, PYTHONHASHSEED: '0' }, maxBuffer: 1 << 28, timeout: 600000 });
  const seconds = Number(process.hrtime.bigint() - t0) / 1e9;
  let out: any;
  try { out = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch { throw new Error(`Blender produced no result for ${job.id} (exit ${r.status}):\n${(r.stdout || '').split('\n').filter(l => /Error|Traceback|BAKE/.test(l)).join('\n')}\n${r.stderr || ''}`); }
  fs.rmSync(dir, { recursive: true, force: true });
  if (out.error) throw new Error(`${job.id}: ${out.error}`);
  return { out, seconds };
}

const AXIS = { x: 0, y: 1, z: 2 } as const;
/** The Blender result -> the record that ships, enforcing the entry's declared rules (budgets, closed shells, winding) on the way. */
export function recordFrom(e: any, out: any): { record: any; stats: any; changes: string[] } {
  const budget = e.budget || {};
  const maxParts = budget.parts || 6, maxTris = budget.tris || 600;
  if (out.parts.length > maxParts) throw new Error(`${e.id}: ${out.parts.length} parts (roles ${out.parts.map((p: any) => p.role).join(', ')}) over the budget of ${maxParts}`);
  if (out.tris > maxTris && !out.decimated) throw new Error(`${e.id}: ${out.tris} triangles over the budget of ${maxTris} and nothing was decimated`);
  if (out.tris > 600 && !budget.over600) throw new Error(`${e.id}: ${out.tris} triangles: a model over 600 needs budget.over600 with a written reason (PLAN 8.4)`);
  for (const p of out.parts) {
    if (!ROLES[p.role]) throw new Error(`${e.id}: role "${p.role}" is not in assets/props/model-kit.ts ROLES`);
    if (p.closed && p.vol <= 0) throw new Error(`${e.id}: part ${p.role} is a closed shell with volume ${p.vol}: inverted winding (list the object under src.flipObjects)`);
    if (!p.closed && !(e.open || []).includes(p.role)) throw new Error(`${e.id}: part ${p.role} is not a closed shell (${p.openEdges} unmatched edges) and the entry does not list it under "open" (a human signs off an open shell)`);
  }
  for (const o of out.objectReport || []) if (o.vol <= 0 && !(e.src.windingExempt || []).includes(o.name)) throw new Error(`${e.id}: source object ${o.name} has volume ${o.vol} after normalising${o.mirrored ? ' (mirrored)' : ''}${o.closed ? '' : ' (an open shell)'}: inside out (list it under src.flipObjects, or under src.windingExempt with a reason)`);
  for (const sh of out.shellReport || []) if (sh.closed && sh.vol <= 0) throw new Error(`${e.id}: ${sh.object}/${sh.role} is a closed shell with volume ${sh.vol}: inverted winding`);
  if ((e.open || []).length && !e.openReason) throw new Error(`${e.id}: "open" needs "openReason": why the source shell may stay open (PSX-family meshes drop faces nobody sees)`);
  for (const r of e.open || []) if (!out.parts.some((p: any) => p.role === r)) throw new Error(`${e.id}: "open" lists role ${r}, which the model does not have`);
  if (out.nonUniform && !(e.scale && e.scale.nonUniformReason)) throw new Error(`${e.id}: a non-uniform scale needs scale.nonUniformReason (the rule is one uniform scalar per asset)`);
  const box = out.box;
  if (!e.pose || (e.pose.pivot || 'floor-centre') !== 'ceiling') if (Math.abs(box[1]) > 0.001) throw new Error(`${e.id}: floor not at y = 0 (${box[1]})`);
  const ext = [box[3] - box[0], box[4] - box[1], box[5] - box[2]];
  const fit: any = {};
  for (const [p, f] of Object.entries(e.fit || {}) as any) {
    const native = +ext[AXIS[f.axis as 'x']].toFixed(4);
    if (f.range[0] > native * 0.75 || f.range[1] < native * 1.35) throw new Error(`${e.id}: fit.${p} range ${f.range} does not cover 0.75x..1.35x of ${native} (the catalog probes there; without it no fit line is recorded)`);
    if (!(f.band[1] - f.band[0] > 0.002)) throw new Error(`${e.id}: fit.${p} band is empty`);
    fit[p] = { axis: f.axis, native, band: f.band, range: f.range, ...(f.anchor ? { anchor: f.anchor } : {}) };
  }
  const parts = out.parts.map((p: any) => ({ role: p.role, ...(p.colorParam ? { cp: 1 } : {}), n: p.tris, nv: p.verts, iw: p.iw, bb: p.bb, pos: p.pos, idx: p.idx }));
  const record: any = {
    v: 1, id: e.id, type: e.prop_type, action: e.action, enabled: e.enabled !== false, params: e.params || [], tags: e.tags || [],
    ...(e.mountY !== undefined ? { mountY: e.mountY } : {}), ...(e.surface ? { surface: true } : {}),
    box, ...(Object.keys(fit).length ? { fit } : {}), ...((e.params || []).includes('scale') ? { scaleRange: e.scaleRange || [0.6, 1.6] } : {}),
    ...(e.action === 'add' ? { iso: parts.map((p: any) => ({ shape: 'box', box: p.bb.map((v: number) => +v.toFixed(3)), color: roleIsoColor(p.role) })) } : {}),
    parts,
  };
  const bytes = out.parts.reduce((a: number, p: any) => a + (p.pos.length * 3 / 4) + (p.idx.length * 3 / 4), 0);
  const s = out.scale[0];
  const changes = ['re-pivot', ...(Math.abs(s - 1) > 0.001 ? ['uniform rescale'] : []), ...(out.decimated ? ['decimate'] : []), ...(Object.keys(fit).length ? ['nine-slice'] : []), 'role-colouring', 'clean-up'];
  const stats = { tris: out.tris, parts: parts.length, verts: out.parts.reduce((a: number, p: any) => a + p.verts, 0), bytesRaw: Math.round(bytes), box, scale: s, nativeDims: out.nativeDims, mirroredObjects: out.mirroredObjects, objects: (out.objectReport || []).map((o: any) => ({ name: o.name, tris: o.tris, closed: o.closed, vol: o.vol, flipped: o.flipped })), shells: (out.shellReport || []).length, dropped: out.dropped, decimated: out.decimated, cutTriangles: out.cutTriangles };
  return { record, stats, changes };
}

async function committedRecords(family: string): Promise<Record<string, any>> {
  if (!fs.existsSync(familyFile(family))) return {};
  const mod = await import(pathToFileURL(familyFile(family)).href + '?t=' + Date.now());
  return JSON.parse(JSON.stringify(mod[familyConst(family)]));
}

function checkSource(e: any) {
  const file = path.join(SOURCE_ROOT, e.src.file);
  if (!fs.existsSync(file)) throw new Error(`${e.id}: source file missing: ${file} (THREEDINSIDE_ROOT=${SOURCE_ROOT})`);
  const sum = sha256(fs.readFileSync(file));
  if (e.src.sha256 && sum !== e.src.sha256) throw new Error(`${e.id}: source sha256 ${sum} is not the manifest's ${e.src.sha256}: the pack changed or moved`);
  return sum;
}

async function main() {
  const manifest = readManifest();
  const pick = (opt('id') || opt('planes') || opt('diagnose-winding') || opt('swatches') || opt('list') || opt('suggest') || '').split(',').filter(Boolean);
  const entries = manifest.models.filter((m: any) => (!pick.length || pick.includes(m.id)) && (!opt('wave') || m.wave === opt('wave')));
  for (const id of pick) if (!manifest.models.some((m: any) => m.id === id)) throw new Error(`no manifest entry "${id}"`);

  if (flag('check')) {
    let bad = 0;
    for (const e of manifest.models) {
      const recs = await committedRecords(e.family), r = recs[e.id];
      if (!r) { console.log(`FAIL ${e.id}: not in assets/props/baked/${e.family}.ts`); bad++; continue; }
      const got = recordSha(r);
      if (got !== e.outSha256 || r.sha !== got) { console.log(`FAIL ${e.id}: module sha ${got} / recorded ${r.sha} / manifest ${e.outSha256}`); bad++; } else console.log(`ok   ${e.id} ${got.slice(0, 12)}`);
    }
    process.exit(bad ? 1 : 0);
  }

  const tool = blenderVersion();
  if ((tool.version !== manifest.tool.blender || tool.hash !== manifest.tool.hash) && !flag('allow-blender')) throw new Error(`Blender ${tool.version} (${tool.hash}) is not the pinned ${manifest.tool.blender} (${manifest.tool.hash}); set BLENDER or pass --allow-blender`);
  const load = () => os.loadavg().map(v => v.toFixed(1)).join(' ');

  if (opt('list')) { const e = entries[0]; checkSource(e); const { out } = runBlender({ ...jobFor(e, 'list'), objects: [] }); for (const o of out.objects) console.log(`${o.name.padEnd(28)} parent=${String(o.parent).padEnd(22)} tris=${String(o.tris).padStart(5)} det=${o.det}  ${o.materials.join(',')}`); return; }
  if (opt('swatches')) {
    const e = entries[0]; checkSource(e); const { out } = runBlender(jobFor(e, 'swatches'));
    console.log(`swatches of ${e.id} (role: from models/roles/${e.roles && e.roles.table}.json and the entry; the colour is for the human only)`);
    for (const s of out.swatches) console.log(`${s.key.padEnd(24)} tris=${String(s.tris).padStart(4)} mean=${s.mean || '?      '} role=${s.role || '-- MISSING --'}  ${s.objects.join(',')}`);
    return;
  }
  if (opt('diagnose-winding')) {
    const e = manifest.models.find((m: any) => m.id === opt('diagnose-winding')); checkSource(e);
    for (const noFlip of [false, true]) {
      const { out } = runBlender({ ...jobFor(e, 'bake'), noFlip });
      console.log(noFlip ? 'WITHOUT the winding flip (what the determinant rule fixes):' : 'with the winding flip (as baked):');
      for (const o of out.objectReport) console.log(`  ${o.name.padEnd(26)} tris=${String(o.tris).padStart(4)} ${o.closed ? 'closed' : `open(${o.openEdges})`.padEnd(8)} volume=${String(o.vol).padStart(9)} ${o.mirrored ? 'MIRRORED' : ''}${o.flipped ? ' flipped' : ''}${o.closed && o.vol <= 0 ? '  <-- inside out' : ''}`);
    }
    return;
  }
  if (opt('planes')) {
    // the distinct vertex planes of a baked model, per axis: band planes that sit on these cost no triangles
    const e = manifest.models.find((m: any) => m.id === opt('planes')), rec = (await committedRecords(e.family))[e.id];
    const { decodeModel } = await import(pathToFileURL(path.join(REPO, 'assets', 'props', 'model-kit.ts')).href);
    const sets = [new Set<string>(), new Set<string>(), new Set<string>()];
    for (const part of decodeModel(rec)) for (let i = 0; i < part.pos.length; i += 3) for (let a = 0; a < 3; a++) sets[a].add(part.pos[i + a].toFixed(3));
    for (const [a, n] of ['x', 'y', 'z'].entries()) console.log(n, [...sets[a]].sort((p, q) => +p - +q).join(' '));
    return;
  }
  if (opt('suggest')) {
    const e = entries[0]; checkSource(e);
    const { out } = runBlender(jobFor({ ...e, scale: { uniform: 1 }, fit: undefined, budget: {}, open: undefined }, 'bake'));
    const m = (await import(pathToFileURL(path.join(REPO, 'assets', 'props', 'measured.ts')).href)).MEASURED[e.prop_type];
    const [bx, by, bz] = [out.box[3] - out.box[0], out.box[4] - out.box[1], out.box[5] - out.box[2]];
    console.log(`native box (after yaw, y up): ${bx.toFixed(3)} x ${by.toFixed(3)} (up) x ${bz.toFixed(3)}`);
    if (m) { const [mw, md, mh] = [m.b[2] - m.b[0], m.b[3] - m.b[1], m.y[1] - m.y[0]], s = (mw / bx + md / bz) / 2; console.log(`measured ${e.prop_type}: ${mw.toFixed(3)} x ${mh.toFixed(3)} (up) x ${md.toFixed(3)}  ->  suggested uniform scale ${s.toFixed(4)} (height ${(by * s).toFixed(3)} vs ${mh.toFixed(3)}, ${(100 * (by * s / mh - 1)).toFixed(1)}%)`); }
    else console.log(`no measured row for "${e.prop_type}": it is a new type; choose scale.height`);
    return;
  }

  const verify = flag('verify-repro');
  const baked: Record<string, any[]> = {};
  let failures = 0;
  console.log(`bake: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, blender ${tool.version} (build ${tool.hash}), load ${load()}`);
  for (const e of entries) {
    const srcSha = checkSource(e);
    const runs = verify ? 2 : 1, results: any[] = [], secs: number[] = [];
    for (let i = 0; i < runs; i++) { const { out, seconds } = runBlender(jobFor(e, 'bake')); results.push({ ...recordFrom(e, out), out }); secs.push(seconds); }
    const { record, stats, changes } = results[0];
    const shaOf = (r: any) => recordSha(ship(r));
    const shas = results.map(r => shaOf(r.record));
    console.log(`  ${e.id.padEnd(16)} ${stats.tris} tris, ${stats.parts} parts [${results[0].out.parts.map((p: any) => p.role + (p.closed ? '' : `:open${p.openEdges}`)).join(' ')}], ${stats.bytesRaw} B raw, scale ${stats.scale.toFixed(4)}, ${secs.map(s => s.toFixed(1) + 's').join(' + ')}${stats.mirroredObjects.length ? `, winding flipped for ${stats.mirroredObjects.join(',')}` : ''}  sha ${shas[0].slice(0, 12)}`);
    if (verify) {
      const same = shas.every(s => s === shas[0]);
      const committed = (await committedRecords(e.family))[e.id];
      const eq = committed && recordSha(committed) === shas[0];
      console.log(`    two runs ${same ? 'IDENTICAL' : 'DIFFER'}; committed module ${committed ? (eq ? 'IDENTICAL' : 'DIFFERS') : 'absent'}; manifest outSha256 ${e.outSha256 === shas[0] ? 'IDENTICAL' : 'DIFFERS'}`);
      if (!same || !eq || e.outSha256 !== shas[0]) failures++;
      continue;
    }
    e.src.sha256 = srcSha; e.outSha256 = shas[0]; e.stats = stats; e.changes = changes;
    (baked[e.family] ||= []).push(record);
  }
  if (verify) { console.log(failures ? `verify-repro: ${failures} entr${failures === 1 ? 'y' : 'ies'} NOT reproducible` : 'verify-repro: every entry reproduces bit for bit'); process.exit(failures ? 1 : 0); }

  const script = scriptDigest();
  for (const [family, recs] of Object.entries(baked)) {
    const have = await committedRecords(family);
    const merged = { ...have }; for (const r of recs) merged[r.id] = r;
    const all = Object.values(merged);
    writeFamily(family, all, toolLine(manifest), script);
    console.log(`  wrote assets/props/baked/${family}.ts (${all.length} model${all.length === 1 ? '' : 's'})`);
  }
  manifest.tool.script = script;
  writeManifest(manifest);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(e => { console.error(String(e.message || e)); process.exit(1); });
