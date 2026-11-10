#!/usr/bin/env -S node --experimental-strip-types
/**
 * Export audited 3D home videos into CI Brand Studio.
 *
 * The default is a read-only plan. `--apply` is required before this script uploads
 * media or creates Brand Studio rows. Brand Studio remains export-only: this script
 * creates drafts and never calls a social network or Metricool publish endpoint.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export interface ExportOptions {
  root: string;
  adsDir: string;
  manifestPath: string;
  brandId: string;
  campaign: string;
  baseUrl: string;
  apiKey?: string;
  platforms: string[];
  apply: boolean;
  family?: string;
  cut?: string;
  max?: number;
}

export interface VideoExportItem {
  key: string;
  filePath: string;
  fileName: string;
  relativePath: string;
  sha256: string;
  bytes: number;
  cutId: string;
  family: string;
  house: string;
  member: string;
  name: string;
  aspect: string;
  width: number;
  height: number;
  durationS: number;
  lighting: string;
  audio: string;
  hook: string;
  captions: string[];
  cta: string;
  warnings: string[];
}

export interface ExportManifest {
  version: 1;
  generatedAt: string;
  source: { repository: string; gitSha: string };
  brandId: string;
  campaign: string;
  platforms: string[];
  items: ExportRecord[];
}

export interface ExportRecord {
  key: string;
  relativePath: string;
  sha256: string;
  cutId: string;
  family: string;
  house: string;
  aspect: string;
  assetId: string;
  duplicateOf: string | null;
  topicId: string;
  socialPostIds: string[];
  exportedAt: string;
}

interface CutPlan {
  id?: string;
  member?: string;
  name?: string;
  archetype?: string;
  hook?: { text?: string };
  captions?: string[];
  cta?: { label?: string; url?: string };
}

interface Transport {
  listCampaigns(brandId: string): Promise<any[]>;
  createCampaign(brandId: string, body: Record<string, unknown>): Promise<any>;
  uploadAsset(brandId: string, fileName: string, bytes: Buffer, mimeType: string): Promise<any>;
  patchAsset(brandId: string, assetId: string, body: Record<string, unknown>): Promise<any>;
  createTopic(brandId: string, body: Record<string, unknown>): Promise<any>;
  tagTopic(brandId: string, topicId: string, campaignId: string): Promise<void>;
  createSocial(brandId: string, body: Record<string, unknown>): Promise<any>;
}

const DEFAULT_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn'];
const now = () => new Date().toISOString();
const json = (v: unknown) => JSON.stringify(v, null, 2);
const sha256 = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const clean = (s: unknown) => String(s ?? '').trim();
const slash = (s: string) => s.split(path.sep).join('/');

function gitSha(root: string): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function manifestFor(options: ExportOptions): ExportManifest {
  const existing = readJson<ExportManifest | null>(options.manifestPath, null);
  if (existing?.version === 1 && existing.brandId === options.brandId && existing.campaign === options.campaign &&
      JSON.stringify(existing.platforms) === JSON.stringify(options.platforms)) return existing;
  return {
    version: 1,
    generatedAt: now(),
    source: { repository: 'CI-Virtual-Home', gitSha: gitSha(options.root) },
    brandId: options.brandId,
    campaign: options.campaign,
    platforms: options.platforms,
    items: [],
  };
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temp, `${json(value)}\n`);
  fs.renameSync(temp, filePath);
}

function readCutIndex(root: string): Map<string, { family: string; house: string; cut: CutPlan }> {
  const ads = readJson<{ families?: Record<string, { cuts?: CutPlan[] }> }>(path.join(root, 'content/story/ads.json'), {});
  const out = new Map<string, { family: string; house: string; cut: CutPlan }>();
  for (const [family, entry] of Object.entries(ads.families ?? {})) {
    const familyFile = readJson<{ house?: string }>(path.join(root, `content/families/${family}.json`), {});
    for (const cut of entry.cuts ?? []) if (cut.id) out.set(cut.id, { family, house: clean(familyFile.house), cut });
  }
  return out;
}

function itemFromFile(root: string, filePath: string, cutIndex: Map<string, { family: string; house: string; cut: CutPlan }>): VideoExportItem | null {
  const fileName = path.basename(filePath);
  const reportPath = filePath.replace(/\.mp4$/i, '.report.json');
  const report = readJson<any | null>(reportPath, null);
  if (!report?.cut || !report.record || !report.gates) return null;
  const errors = Array.isArray(report.gates.errors) ? report.gates.errors.map(clean).filter(Boolean) : [];
  if (errors.length) return null;
  const bytes = fs.readFileSync(filePath);
  const indexed = cutIndex.get(report.cut) ?? { family: report.cut.split('-')[0] ?? 'unknown', house: '', cut: {} as CutPlan };
  const record = report.record;
  const warnings = Array.isArray(report.gates.warnings) ? report.gates.warnings.map(clean).filter(Boolean) : [];
  const plan = indexed.cut;
  const relativePath = slash(path.relative(root, filePath));
  const fileSha = sha256(bytes);
  return {
    key: `${report.cut}|${fileName}|${fileSha}`,
    filePath,
    fileName,
    relativePath,
    sha256: fileSha,
    bytes: bytes.length,
    cutId: report.cut,
    family: indexed.family,
    house: indexed.house,
    member: clean(plan.member),
    name: clean(plan.name) || clean(plan.member) || report.cut,
    aspect: clean(report.aspect) || 'unknown',
    width: Number(record.width) || 0,
    height: Number(record.height) || 0,
    durationS: Number(record.durationS) || 0,
    lighting: clean(record.lighting),
    audio: clean(record.audio),
    hook: clean(plan.hook?.text),
    captions: Array.isArray(plan.captions) ? plan.captions.map(clean).filter(Boolean) : [],
    cta: clean(plan.cta?.label),
    warnings,
  };
}

export function discoverVideos(options: ExportOptions): VideoExportItem[] {
  const cutIndex = readCutIndex(options.root);
  const files = fs.existsSync(options.adsDir)
    ? fs.readdirSync(options.adsDir).filter((name) => name.toLowerCase().endsWith('.mp4')).sort()
    : [];
  const items = files.map((name) => itemFromFile(options.root, path.join(options.adsDir, name), cutIndex)).filter((x): x is VideoExportItem => Boolean(x));
  const filtered = items.filter((item) => (!options.family || item.family === options.family) && (!options.cut || item.cutId === options.cut));
  return options.max && options.max > 0 ? filtered.slice(0, options.max) : filtered;
}

export function socialCopy(item: VideoExportItem): string {
  const lead = item.hook || `${item.name}'s home, in motion`;
  const body = item.captions[0] || `A stylised 3D home tour from the ${item.house || item.family} scene.`;
  const cta = item.cta ? ` ${item.cta}.` : '';
  return `${lead}. ${body}${cta} Fictional family, scripted scene, stylised 3D art.`.replace(/\.\./g, '.');
}

function assetPath(brandId: string, assetId: string): string {
  return `/api/brands/${encodeURIComponent(brandId)}/assets/${encodeURIComponent(assetId)}/file`;
}

export function planKey(options: ExportOptions, item: VideoExportItem): string {
  return `${options.brandId}|${options.campaign}|${options.platforms.join(',')}|${item.key}`;
}

function assetPatch(options: ExportOptions, item: VideoExportItem): Record<string, unknown> {
  const tags = ['ci-virtual-home', '3d-home', 'marketing-video', 'social-video', item.family, item.house, item.aspect]
    .map(clean).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  return {
    tags,
    description: `Audited 3D home marketing video from ${item.relativePath}; ${item.width}x${item.height}, ${item.durationS.toFixed(2)}s, ${item.aspect}.`,
    altText: `Stylised 3D ${item.house || item.family} home video featuring ${item.name}.`,
    caption: socialCopy(item),
    licence: 'own',
    source: `CI-Virtual-Home:${gitSha(options.root)}:${item.relativePath}`,
    aiGenerated: false,
  };
}

function topicBody(item: VideoExportItem): Record<string, unknown> {
  return {
    question: `Social video: ${item.name} in the ${item.aspect} 3D home cut`,
    channel: 'social',
    type: 'social',
    notes: `Imported from ${item.relativePath}. SHA-256 ${item.sha256}. Release audit passed; ${item.warnings.length} non-blocking video warning(s).`,
    cta: item.cta || 'See the Companion Core',
    feature_tags: ['ci-virtual-home', '3d-home-video', item.family, item.house].filter(Boolean).join(', '),
  };
}

export class BrandStudioHttpTransport implements Transport {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request(pathname: string, init: RequestInit = {}): Promise<any> {
    const headers = new Headers(init.headers);
    if (this.apiKey) headers.set('x-api-key', this.apiKey);
    const response = await fetch(new URL(pathname, `${this.baseUrl.replace(/\/$/, '')}/`).toString(), { ...init, headers });
    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} → ${response.status}: ${typeof body === 'string' ? body : json(body)}`);
    return body;
  }

  listCampaigns(brandId: string) { return this.request(`/api/brands/${encodeURIComponent(brandId)}/campaigns`).then((x) => x.campaigns ?? []); }
  createCampaign(brandId: string, body: Record<string, unknown>) { return this.request(`/api/brands/${encodeURIComponent(brandId)}/campaigns`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json(body) }).then((x) => x.campaign); }
  uploadAsset(brandId: string, fileName: string, bytes: Buffer, mimeType: string) {
    return this.request(`/api/brands/${encodeURIComponent(brandId)}/assets/upload?name=${encodeURIComponent(fileName)}`, { method: 'POST', headers: { 'content-type': mimeType }, body: bytes as unknown as BodyInit });
  }
  patchAsset(brandId: string, assetId: string, body: Record<string, unknown>) {
    return this.request(`/api/brands/${encodeURIComponent(brandId)}/assets/${encodeURIComponent(assetId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: json(body) }).then((x) => x.asset);
  }
  createTopic(brandId: string, body: Record<string, unknown>) {
    return this.request(`/api/brands/${encodeURIComponent(brandId)}/brainstorm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json(body) }).then((x) => x.row);
  }
  async tagTopic(brandId: string, topicId: string, campaignId: string) {
    await this.request(`/api/brands/${encodeURIComponent(brandId)}/topics/${encodeURIComponent(topicId)}/campaign?channel=social`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: json({ campaignId }) });
  }
  createSocial(brandId: string, body: Record<string, unknown>) {
    return this.request(`/api/brands/${encodeURIComponent(brandId)}/social`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json(body) }).then((x) => x.row);
  }
}

async function ensureCampaign(transport: Transport, options: ExportOptions): Promise<any> {
  const campaigns = await transport.listCampaigns(options.brandId);
  const found = campaigns.find((c) => clean(c.name) === options.campaign);
  return found ?? transport.createCampaign(options.brandId, {
    name: options.campaign,
    status: 'planned',
    notes: 'CI-Virtual-Home audited 3D home social-video exports; Brand Studio remains export-only.',
  });
}

export async function publishBatch(options: ExportOptions, items: VideoExportItem[], transport: Transport): Promise<{ exported: ExportRecord[]; skipped: string[] }> {
  const manifest = manifestFor(options);
  const exported: ExportRecord[] = [];
  const skipped: string[] = [];
  if (!options.apply) return { exported, skipped: items.filter((i) => manifest.items.some((r) => r.key === planKey(options, i))).map((i) => i.fileName) };

  const campaign = await ensureCampaign(transport, options);
  for (const item of items) {
    const key = planKey(options, item);
    if (manifest.items.some((r) => r.key === key)) { skipped.push(item.fileName); continue; }
    const uploaded = await transport.uploadAsset(options.brandId, item.fileName, fs.readFileSync(item.filePath), 'video/mp4');
    const asset = uploaded.asset ?? uploaded;
    const assetId = clean(asset.id);
    if (!assetId) throw new Error(`Brand Studio upload returned no asset id for ${item.fileName}`);
    await transport.patchAsset(options.brandId, assetId, assetPatch(options, item));
    const topic = await transport.createTopic(options.brandId, topicBody(item));
    const topicId = clean(topic.topic_id ?? topic.id);
    if (!topicId) throw new Error(`Brand Studio topic create returned no topic id for ${item.fileName}`);
    await transport.tagTopic(options.brandId, topicId, clean(campaign.id));
    const socialPostIds: string[] = [];
    for (const platform of options.platforms) {
      const row = await transport.createSocial(options.brandId, {
        type: 'brand-product-news',
        platform,
        content: socialCopy(item),
        image: assetPath(options.brandId, assetId),
      });
      const id = clean(row.post_id ?? row.id);
      if (id) socialPostIds.push(id);
    }
    const record: ExportRecord = {
      key,
      relativePath: item.relativePath,
      sha256: item.sha256,
      cutId: item.cutId,
      family: item.family,
      house: item.house,
      aspect: item.aspect,
      assetId,
      duplicateOf: uploaded.duplicateOf ?? null,
      topicId,
      socialPostIds,
      exportedAt: now(),
    };
    manifest.items.push(record);
    manifest.generatedAt = now();
    writeJsonAtomic(options.manifestPath, manifest);
    exported.push(record);
  }
  return { exported, skipped };
}

function parseArgs(argv: string[], root: string): ExportOptions {
  const valued = new Set(['ads-dir', 'manifest', 'brand-id', 'campaign', 'base-url', 'api-key', 'platforms', 'family', 'cut', 'max']);
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    flags[key] = valued.has(key) ? (argv[++i] ?? '') : 'true';
  }
  const platforms = (flags.platforms ?? DEFAULT_PLATFORMS.join(',')).split(',').map((x) => x.trim()).filter(Boolean);
  const max = flags.max ? Number(flags.max) : undefined;
  if (max !== undefined && (!Number.isInteger(max) || max < 1)) throw new Error('--max must be a positive integer');
  return {
    root,
    adsDir: path.resolve(root, flags['ads-dir'] ?? 'video/ads'),
    manifestPath: path.resolve(root, flags.manifest ?? 'video/brand-studio/export-manifest.json'),
    brandId: flags['brand-id'] ?? process.env.BRAND_STUDIO_BRAND_ID ?? 'CI0',
    campaign: flags.campaign ?? 'Companion Home Tours 2026',
    baseUrl: flags['base-url'] ?? process.env.BRAND_STUDIO_BASE_URL ?? 'http://127.0.0.1:3858',
    apiKey: flags['api-key'] ?? process.env.BRAND_STUDIO_API_KEY,
    platforms,
    apply: flags.apply === 'true',
    family: flags.family,
    cut: flags.cut,
    max,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const root = process.cwd();
  const options = parseArgs(argv, root);
  const items = discoverVideos(options);
  if (!items.length) throw new Error('No audited MP4/report pairs matched the requested filters.');
  const manifest = manifestFor(options);
  const already = new Set(manifest.items.map((x) => x.key));
  console.log(`${items.length} audited video${items.length === 1 ? '' : 's'} found in ${slash(path.relative(root, options.adsDir))}`);
  for (const item of items) console.log(`  ${item.fileName} · ${item.width}x${item.height} · ${item.durationS.toFixed(2)}s · ${item.family}/${item.cutId}`);
  if (!options.apply) {
    const pending = items.filter((i) => !already.has(planKey(options, i)));
    console.log(`dry run: ${pending.length} would upload, create ${pending.length} topic${pending.length === 1 ? '' : 's'}, and create ${pending.length * options.platforms.length} drafted social rows`);
    console.log(`apply explicitly with: pnpm run story:brand-studio -- --apply --brand-id ${options.brandId}`);
    return 0;
  }
  const result = await publishBatch(options, items, new BrandStudioHttpTransport(options.baseUrl, options.apiKey));
  console.log(`applied: ${result.exported.length} exported, ${result.skipped.length} already recorded`);
  console.log(`manifest: ${slash(path.relative(root, options.manifestPath))}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
