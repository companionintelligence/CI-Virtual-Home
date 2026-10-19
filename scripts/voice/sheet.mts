// `pnpm run story:voice -- --sheet`: a listening sample sheet, written OUTSIDE the repo.
//
// No agent can judge a voice. Four of the eight British voices are graded D by Kokoro's own model card and the engine has no
// emotion control, so before 30 families are recorded a person should listen to every voice say the same lines and say yes or no.
// Each voice reads three lines: the first-run (FTUE) line, one agent line, and a "names" line with the hard product names from
// the lexicon, so the owner can also hear whether the pronunciations are right.
import fs from 'node:fs';
import path from 'node:path';
import type { Lexicon, VoiceRegistry } from './lib.mts';
import { spokenForm } from './lib.mts';
import { finish, hashName, synthesise, scratch } from './engine.mts';
import type { EngineEnv, Item } from './engine.mts';

export const SHEET_LINES = [
  { id: 'ftue', label: 'First run (narrator)', text: "Mika plugs in the power cable and presses the button. The Core wakes and opens its own Wi-Fi network." },
  { id: 'agent', label: 'Agent line (a companion)', text: 'Here is a draft. Please read it before you send it.' },
  { id: 'names', label: 'Product names (lexicon check)', text: 'Elias keeps invoices in Odoo and Paperless-ngx, shares the bills in Spliit, and reads on Koodo Reader. Hermes and OpenClaw run an n8n flow, search with SearXNG, write in Affine, and mail through Keila.' },
] as const;

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export async function buildSheet(env: EngineEnv, reg: VoiceRegistry, lex: Lexicon, out: string): Promise<void> {
  fs.mkdirSync(out, { recursive: true });
  const tmp = scratch();
  try {
    const keys = Object.keys(reg.voices);
    const items: Item[] = [];
    for (const k of keys) for (const l of SHEET_LINES) items.push({ key: `${k}/${l.id}`, voice: reg.voices[k].kokoro, speed: reg.voices[k].speed, text: spokenForm(l.text, lex).spoken });
    console.log(`synthesising ${items.length} sample clips (${keys.length} voices x ${SHEET_LINES.length} lines) ...`);
    const res = await synthesise(env, reg, items, path.join(tmp, 'synth'));
    fs.mkdirSync(path.join(tmp, 'enc'), { recursive: true });
    const rows: string[] = [];
    const report: Record<string, unknown>[] = [];
    let n = 0;
    for (const k of keys) {
      const v = reg.voices[k];
      const cells: string[] = [];
      for (const l of SHEET_LINES) {
        const key = `${k}/${l.id}`;
        const r = finish(key, l.text, res.clips[key], path.join(tmp, 'enc'), n++);
        const file = r.ok ? hashName(`${k}.${l.id}`, r.bytes) : '';
        if (r.ok) fs.writeFileSync(path.join(out, file), r.bytes);
        report.push({ voice: k, kokoro: v.kokoro, line: l.id, ok: r.ok, why: r.why, file, durationMs: r.durationMs, loudness: r.loudness, f0Hz: res.clips[key].f0Hz ?? null, registryF0Hz: v.f0Hz ?? null });
        cells.push(`<td><div class="line">${esc(l.label)}</div>${r.ok ? `<audio controls preload="metadata" src="${file}"></audio><div class="meta">${(r.durationMs / 1000).toFixed(1)} s, ${r.loudness.I.toFixed(1)} LUFS, ${r.loudness.TP.toFixed(1)} dBTP, F0 about ${res.clips[key].f0Hz ?? '?'} Hz</div>` : `<div class="bad">failed a gate: ${esc(r.why.join('; '))}</div>`}</td>`);
      }
      rows.push(`<tr><th scope="row"><b>${esc(k)}</b><div class="meta">Kokoro ${esc(v.kokoro)}, ${v.sex === 'f' ? 'female' : 'male'}, about ${v.f0Hz} Hz<br>model card grade ${esc(String(v.grade))}, speed ${v.speed}<br>narrator for ${v.narratorFor} families<br>fits an agent who is ${esc((v.agentFits ?? []).join(', '))}</div></th>${cells.join('')}</tr>`);
    }
    const html = `<!doctype html><meta charset="utf-8"><title>Voice sample sheet</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1200px;color:#1b1b1f}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:10px;vertical-align:top;text-align:left}th{width:260px;background:#f4f4f6}.meta{font-size:12px;color:#555;margin-top:4px}.line{font-size:12px;font-weight:600;margin-bottom:4px}.bad{color:#b00020}audio{width:100%;min-width:220px}</style>
<h1>Voice sample sheet</h1>
<p>Eight voices, three lines each. Synthetic voices, made locally with Kokoro-82M. <b>An agent cannot judge these. A person should listen before 30 families are recorded.</b></p>
<ol><li>Is every voice clear at normal volume on a phone speaker, with no clipping, buzz or swallowed word?</li>
<li>Does the pace feel unhurried (about 150 words a minute) and does the end of each sentence fall?</li>
<li>On the names line: Odoo as <i>oo-doo</i>, Koodo as <i>koo-doh</i>, Spliit as <i>split</i>, SearXNG as <i>searks en-jee</i>, Keila as <i>kay-la</i>, Affine as <i>a-fine</i>, n8n as <i>en-eight-en</i>?</li>
<li>Voices graded D are listed below with their grade. Would you put any of them in front of a visitor? Which of the 8 should be retired or swapped?</li></ol>
<table><thead><tr><th>Voice</th>${SHEET_LINES.map(l => `<th>${esc(l.label)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>
<h2>The lines</h2><ul>${SHEET_LINES.map(l => `<li><b>${esc(l.label)}:</b> ${esc(l.text)}</li>`).join('')}</ul>`;
    fs.writeFileSync(path.join(out, 'index.html'), html);
    fs.writeFileSync(path.join(out, 'sheet.json'), JSON.stringify({ engine: res.engine, lines: SHEET_LINES, clips: report }, null, 2) + '\n');
    const bad = report.filter(r => !r.ok).length;
    console.log(`\nsample sheet: ${path.join(out, 'index.html')}  (${report.length - bad} of ${report.length} clips passed their gates)`);
    console.log('Open it in a browser and listen. No build step can judge a voice; this needs a person.');
    if (bad) process.exitCode = 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
