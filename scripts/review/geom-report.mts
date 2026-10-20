// Shared plumbing of the two geometry detectors: where output goes, how a mesh is named in a report, which pairs are the owner's
// (house) and which are the lot's (site, world), and the small decoders for what the page sends. Pure Node.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stableJson, parseArgs, round } from './lib.mts';

export const OUT_DEFAULT = process.env.GEOM_OUT ? path.resolve(process.env.GEOM_OUT) : path.join(os.tmpdir(), 'vh-geometry');
export { parseArgs, stableJson, round };

/** one mesh of the page's registry (geo.describe) */
export interface MeshInfo {
  id: number; name: string; top: string; role: string | null; cat: string | null; itemType: string | null; room: string | null; level: number;
  chain: string; geom: string | null; size: number[] | null; tris: number; instanced: boolean; mats: any[]; unit: string | null; wallPart: string | null;
  glass: boolean; ro: number; shadow: boolean; at: [number, number, number];
}

const strip = (s: string) => s.replace(/[0-9]+(\.[0-9]+)?/g, '#').replace(/\s+/g, ' ').trim();
/** a short human label: the placed object, the unit inside it, the mesh's own geometry and size and where it is */
export function label(m: MeshInfo | undefined): string {
  if (!m) return '(none)';
  const parts = m.chain ? m.chain.split(' > ') : [];
  const unit = parts.slice(1).filter(p => !/^(Group|Object3D)$/.test(p)).slice(-2).join(' > ');
  const size = m.size ? ` ${m.size.map(v => round(v, 3)).join('x')}` : '';
  const mat = m.mats && m.mats[0] ? ` ${m.mats[0].t}${m.mats[0].c ? '#' + m.mats[0].c : ''}` : '';
  return `${m.top}${unit ? ' > ' + unit : ''} [${m.geom || '?'}${size}${mat}] #${m.id} @(${m.at.join(', ')})`;
}
/** what kind of thing: a key two runs agree on for the same mesh, with the numbers (sizes, positions, ordinals) taken out */
export function classOf(m: MeshInfo | undefined): string {
  if (!m) return 'none';
  const what = m.itemType || strip(m.top);
  return [m.role || '?', what, m.unit || '', m.wallPart || '', m.glass ? 'glass' : '', m.geom ? m.geom.replace('Geometry', '') : ''].filter(Boolean).join('/');
}
const HOUSE_ROLES = new Set(['item', 'hero', 'fixture', 'wall', 'finish', 'structure', 'floor', 'ceiling', 'roof']);
/** 'house': a thing the house is built of; 'site': the lot and the world round it */
export const scopeOf = (m: MeshInfo | undefined) => (m && m.role && HOUSE_ROLES.has(m.role) ? 'house' : 'site');
export const pairScope = (a?: MeshInfo, b?: MeshInfo) => (scopeOf(a) === 'house' && scopeOf(b) === 'house' ? 'house' : scopeOf(a) === 'house' || scopeOf(b) === 'house' ? 'house-site' : 'site');

export const decodeF32 = (b64: string) => { const b = Buffer.from(b64, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4).slice(); };
export const decodeIdx = (b64: string, bits: number) => { const b = Buffer.from(b64, 'base64'); return bits === 16 ? new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2).slice() : new Uint32Array(b.buffer, b.byteOffset, b.byteLength / 4).slice(); };

export function writePng(file: string, dataUrl: string) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')); }
/** stable key order, one space of indent; undefined fields are dropped first (stableJson would print them as the word) */
export function writeJson(file: string, v: unknown) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, stableJson(JSON.parse(JSON.stringify(v)))); }
export const fmtSec = (s: number) => `${s.toFixed(1)} s`;

/** remove the pictures an earlier run of this tool left in its own output directory (only `<prefix>-*.png`), so the listing matches the JSON */
export function clearImages(dir: string, prefix: string) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) if (f.startsWith(`${prefix}-`) && f.endsWith('.png')) fs.unlinkSync(path.join(dir, f));
}
