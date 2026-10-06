#!/usr/bin/env -S node --experimental-strip-types
// Generates the one root ATTRIBUTION.md from models/packs.json (the 22 packs) and models/manifest.json (the shipped models), byte for byte:
// the format is fixed by the "About this file" section, whose text lives in scripts/bake/attribution.preamble.md.
//
//   node --experimental-strip-types scripts/bake/attribution.mts            write ATTRIBUTION.md
//   node --experimental-strip-types scripts/bake/attribution.mts --check    exit 1 when the committed file is not what would be generated (CI: scripts/test-baked.mts)
import fs from 'node:fs';
import path from 'node:path';
import { REPO, PACKS, readManifest } from './lib.mts';

export const OUT = path.join(REPO, 'ATTRIBUTION.md');
const n = (v: number) => v.toLocaleString('en-US');

const decisionLabel = (p: any): string => {
  const wave = p.first_wave && p.first_wave !== 'none' ? `, wave ${p.first_wave}` : '';
  if (p.decision === 'use') return `use${wave}`;
  if (p.decision === 'reference-only') return `reference only${wave}`;
  if (p.decision === 'outdoor-only') return 'outdoor only';
  if (p.decision === 'not-shipped') return 'not shipped';
  throw new Error(`packs.json: pack ${p.id} has unknown decision "${p.decision}"`);
};
const creatorCell = (p: any) => (p.creator_as_found ? p.creator_as_found : `creator not stated in the pack; unverified hint: ${p.creator_hint}`);
const baseName = (member: string) => member.split('/').pop();
const licenceCell = (p: any) => (p.licence_basis === 'cc0-in-pack' ? `cc0-in-pack (\`${baseName(p.evidence.archive_member)}\`)` : 'owner-asserted rights (Lifescope Inc.)');

export function generate(): string {
  const packs = JSON.parse(fs.readFileSync(PACKS, 'utf8')).packs as any[];
  const models = readManifest().models as any[];
  const of = (p: any) => models.filter(m => m.src.pack === p.id).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const m of models) if (!packs.some(p => p.id === m.src.pack)) throw new Error(`manifest entry ${m.id}: pack "${m.src.pack}" is not in models/packs.json`);
  for (const m of models) { const p = packs.find(q => q.id === m.src.pack); if (p.decision !== 'use') throw new Error(`manifest entry ${m.id}: pack ${p.id} is "${p.decision}", nothing ships from it`); }
  const out: string[] = [fs.readFileSync(path.join(import.meta.dirname, 'attribution.preamble.md'), 'utf8').replace(/\n$/, '')];
  out.push('| # | Pack | Creator as found | Licence basis | Decision | Shipped models |', '|---|---|---|---|---|---|');
  packs.forEach((p, i) => out.push(`| ${i + 1} | ${p.folder} | ${creatorCell(p)} | ${licenceCell(p)} | ${decisionLabel(p)} | ${of(p).length} |`));
  out.push('', '## Packs', '');
  packs.forEach((p, i) => {
    out.push(`### ${i + 1}. ${p.folder}`, '');
    out.push(`- Folder and archive: \`${p.folder}\` in \`${p.archive}\` (${n(p.archive_bytes)} bytes)`);
    out.push(`- Archive sha256: \`${p.archive_sha256}\``);
    out.push(p.creator_as_found ? `- Creator as found: ${p.creator_as_found} (\`${p.evidence.archive_member}\`)` : '- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one');
    out.push(`- Origin hints (unverified, not asserted): ${p.creator_hint ? `page handle \`${p.creator_hint}\`; ` : ''}download page: ${p.origin_page}`);
    out.push(`- Licence basis: ${p.licence_basis === 'cc0-in-pack' ? 'cc0-in-pack (a CC0 statement inside the pack, self-asserted by its author and not verified at the source)' : 'owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack'}`);
    if (p.evidence) {
      out.push(`- Evidence: \`${p.evidence.archive_member}\` in the archive (${n(p.evidence.bytes)} bytes, sha256 \`${p.evidence.sha256}\`), which reads:`);
      for (const q of p.evidence.quotes) out.push(`  - "${q}"`);
      if (p.evidence.caveat) out.push(`  - Limit: ${p.evidence.caveat}`);
    } else out.push('- Evidence: none in the pack');
    out.push(`- Decision: ${decisionLabel(p)}. ${p.decision_note}`);
    out.push(`- Source files committed: ${p.committed_source_bytes ? n(p.committed_source_bytes) + ' bytes' : 'none'}`);
    out.push('', '#### Shipped models', '');
    const ms = of(p);
    if (!ms.length) out.push('None yet.');
    else {
      out.push('| Model id | Prop type | Source file and object | Changes |', '|---|---|---|---|');
      for (const m of ms) out.push(`| \`${m.id}\` | \`${m.prop_type}\` | \`${m.src.display}\`: ${m.src.objects.map((o: string) => `\`${o}\``).join(', ')} | ${(m.changes || []).join(', ')} |`);
    }
    out.push('');
  });
  return out.join('\n').replace(/\n+$/, '') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const text = generate();
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (have !== text) { console.error('ATTRIBUTION.md is stale: run node --experimental-strip-types scripts/bake/attribution.mts'); process.exit(1); }
    console.log('ATTRIBUTION.md is up to date');
  } else { fs.writeFileSync(OUT, text); console.log(`ATTRIBUTION.md written (${text.split('\n').length - 1} lines)`); }
}
