import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { publishBatch, socialCopy, planKey, type ExportOptions, type VideoExportItem } from './export-brand-studio.mts';

const item: VideoExportItem = {
  key: 'brennan-steve|brennan-steve.9x16.mp4|abc',
  filePath: '', fileName: 'brennan-steve.9x16.mp4', relativePath: 'video/ads/brennan-steve.9x16.mp4', sha256: 'abc', bytes: 4,
  cutId: 'brennan-steve', family: 'brennan', house: 'seraphine', member: 'steve', name: 'Steve', aspect: '9x16', width: 1080, height: 1920,
  durationS: 17.8, lighting: 'day', audio: 'none', hook: 'The session runs in the library', captions: ['The session runs on the Core.'], cta: 'See Companion Core', warnings: [],
};

const options: ExportOptions = {
  root: process.cwd(), adsDir: 'video/ads', manifestPath: '', brandId: 'CI0', campaign: 'Test campaign', baseUrl: 'http://brand-studio.test', platforms: ['Instagram', 'LinkedIn'], apply: true,
};

test('social copy carries the audited story and disclosure', () => {
  const copy = socialCopy(item);
  assert.match(copy, /session runs in the library/);
  assert.match(copy, /Fictional family, scripted scene, stylised 3D art/);
});

test('plan keys include the Brand Studio destination and platform set', () => {
  assert.equal(planKey(options, item), 'CI0|Test campaign|Instagram,LinkedIn|brennan-steve|brennan-steve.9x16.mp4|abc');
});

test('publishes one asset, topic, campaign tag, and one social row per platform', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-vh-brand-studio-'));
  const filePath = path.join(dir, item.fileName);
  fs.writeFileSync(filePath, Buffer.from('test'));
  const calls: string[] = [];
  const transport = {
    async listCampaigns() { calls.push('campaigns:list'); return []; },
    async createCampaign() { calls.push('campaigns:create'); return { id: 'campaign-1' }; },
    async uploadAsset() { calls.push('assets:upload'); return { asset: { id: 'asset-1' }, duplicateOf: null }; },
    async patchAsset(_brand: string, id: string, body: Record<string, unknown>) { calls.push(`assets:patch:${id}`); assert.equal(body.licence, 'own'); return { id }; },
    async createTopic() { calls.push('topic:create'); return { topic_id: 'topic-1' }; },
    async tagTopic(_brand: string, topicId: string, campaignId: string) { calls.push(`topic:tag:${topicId}:${campaignId}`); },
    async createSocial(_brand: string, body: Record<string, unknown>) { calls.push(`social:${body.platform}`); assert.equal(body.type, 'brand-product-news'); assert.match(String(body.image), /asset-1\/file$/); return { post_id: `${body.platform}-1` }; },
  };
  const result = await publishBatch({ ...options, root: dir, manifestPath: path.join(dir, 'manifest.json') }, [{ ...item, filePath }], transport);
  assert.equal(result.exported.length, 1);
  assert.deepEqual(calls, ['campaigns:list', 'campaigns:create', 'assets:upload', 'assets:patch:asset-1', 'topic:create', 'topic:tag:topic-1:campaign-1', 'social:Instagram', 'social:LinkedIn']);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(saved.items[0].assetId, 'asset-1');
});
