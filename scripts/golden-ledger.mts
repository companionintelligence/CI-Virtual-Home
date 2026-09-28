// The golden ledger (plan Completeness I): the frames a stream branch is MEANT to move, and what each moved TO.
// Goldens and fixture hashes are never re-blessed on a stream branch; a branch declares its movers here instead, and
// scripts/test-goldens.mts and scripts/test-fixtures.mts accept exactly those.
//
//   test/goldens/expected-diffs/<stream>.json — one file per stream (s1.json … s6.json; integration.json when the
//   integration branch has to record a frame two streams both moved), so two streams never edit one file:
//
//     { "vanilla/door-to-core@1":   { "cause": "S1 monitor pole now behind the screen" },
//       "s0-seams/door-to-core@1":  { "cause": "S1 ceiling tint", "hash": { "macos-metal": "7b6ada11b0ff5504" } } }
//
//   A key is "<house>/<shot>@<t>" for a golden frame, or "<fixture>/<shot>@<t>" for a fixture's (another stream's
//   fixture — a stream re-blesses its OWN fixtures with `fixtures --update`). Several streams may list one frame;
//   each gives its own cause.
//
// What a frame moved TO is recorded, so "expected" means "moved to exactly this", not "moved somewhere": a later
// regression in a declared frame fails like any other.
//   - a golden frame: the moved render itself, test/goldens/expected-diffs/<stream>/<profile>/<house>/<shot>@<t>.png
//     (Git LFS, like the goldens), compared with the goldens' own tolerance — written by
//     `pnpm run goldens --record <stream>`;
//   - a fixture frame: its hash, per profile, in the entry — written by `pnpm run fixtures --record <stream>`.
// A declared frame passes as "expected" when it matches what one of its declaring streams recorded. It fails as
// "unmoved" when it still matches its baseline (the fix did not take, or the entry is stale), "unrecorded" when no
// declaring stream recorded it on this profile, and "elsewhere" when it moved to something else (a regression on top
// of the declared change, or two streams' changes meeting at integration — record the frame again there, in
// integration.json, with both causes). The one re-bless at integration takes the moves in and empties this folder.
import fs from 'node:fs';
import path from 'node:path';

export type LedgerEntry = { stream: string; file: string; key: string; cause: string; hash: Record<string, string> };
export type Ledger = { dir: string; entries: Map<string, LedgerEntry[]>; byStream: Map<string, Record<string, any>>; problems: string[] };

export const ledgerDir = (root: string) => path.join(root, 'test', 'goldens', 'expected-diffs');
/** s1.json → "S1"; any other name as it is ("integration") */
export const streamName = (file: string) => { const b = path.basename(file, '.json'); return /^s\d$/i.test(b) ? b.toUpperCase() : b; };
/** the stream's file stem for a name given on the command line: "S1" or "s1" → "s1" */
export const streamFile = (name: string) => /^s\d$/i.test(name) ? name.toLowerCase() : name;
export const frameKey = (id: string, shot: string, t: number | string) => `${id}/${shot}@${t}`;
/** the recorded moved golden frame for one stream and profile */
export const pendingPath = (root: string, stream: string, profile: string, key: string) => {
  const m = key.match(/^([^/]+)\/(.+)@([\d.]+)$/);
  return path.join(ledgerDir(root), streamFile(stream), profile, m![1], `${m![2]}@${m![3].replace('.', '_')}.png`);
};

/** Every stream's ledger, merged: key → the entries that declare it. `isKnown(key)` says whether a key names a real
 *  frame (a golden's or a fixture's); anything malformed or unknown is a problem, which the callers treat as exit 2. */
export function loadLedger(root: string, isKnown: (key: string) => boolean): Ledger {
  const dir = ledgerDir(root), entries = new Map<string, LedgerEntry[]>(), byStream = new Map<string, Record<string, any>>(), problems: string[] = [];
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [];
  for (const f of files) {
    const file = path.join(dir, f), stream = streamName(f), rel = path.relative(process.cwd(), file);
    let raw: Record<string, any>;
    try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { problems.push(`${rel}: ${e.message}`); continue; }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { problems.push(`${rel}: not an object`); continue; }
    byStream.set(stream, raw);
    for (const [key, v] of Object.entries(raw)) {
      if (key.startsWith('$')) continue;   // notes
      if (!/^[^/]+\/.+@[\d.]+$/.test(key) || !isKnown(key)) { problems.push(`${rel}: "${key}" is not a golden or fixture frame (<id>/<shot>@<t>, e.g. "aurora/door-to-core@0.55")`); continue; }
      if (!v || typeof v.cause !== 'string' || !v.cause.trim()) { problems.push(`${rel}: "${key}" needs { "cause": "…" }`); continue; }
      if (v.hash !== undefined && (typeof v.hash !== 'object' || Object.values(v.hash).some(h => typeof h !== 'string'))) { problems.push(`${rel}: "${key}".hash must be { "<profile>": "<hash>" }`); continue; }
      const e: LedgerEntry = { stream, file, key, cause: v.cause, hash: v.hash || {} };
      if (!entries.has(key)) entries.set(key, []);
      entries.get(key)!.push(e);
    }
  }
  return { dir, entries, byStream, problems };
}

/** "S1: cause; S4: cause" */
export const causes = (es: LedgerEntry[]) => es.map(e => `${e.stream}: ${e.cause}`).join('; ');

/** Write one stream's ledger back (keys sorted, notes first) — `fixtures --record` stores its hashes this way. */
export function writeStreamLedger(root: string, stream: string, data: Record<string, any>) {
  const notes = Object.keys(data).filter(k => k.startsWith('$')), keys = Object.keys(data).filter(k => !k.startsWith('$')).sort();
  const body = [...notes, ...keys].map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(data[k])}`).join(',\n');
  fs.mkdirSync(ledgerDir(root), { recursive: true });
  fs.writeFileSync(path.join(ledgerDir(root), `${streamFile(stream)}.json`), body ? `{\n${body}\n}\n` : '{}\n');
}
