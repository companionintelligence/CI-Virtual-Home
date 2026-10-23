// What `pnpm run portal:build` ships of the home specs, and the guard that holds everything it ships to the site's credit rule.
//
// THE RULE. No builder credit and no mention of the build a home was written from is shown or shipped anywhere on the public site.
// The repository keeps both as internal records: every content/houses/<id>.json has `author`, `source` and a `name` that is
// the title the home was first filed under, and content/houses/index.json copies them. The other generators read them
// (the plans, the casting, the leak scan), so they stay. What the site serves is a redacted copy (redactSpecText, redactIndex):
//
//   author, source   removed
//   name             the portal's own name for the home (assets/home-names.ts displayName), so every reader of a shipped
//                    spec or of the list (the gallery's search and cards, the player, the editor's pickers, the shot names the
//                    planner builds from `spec.name`) gets the name the visitor already sees. displayName of a display name
//                    is itself, so a reader that still calls it is unchanged.
//
// Everything else in a spec is byte for byte what the repository holds, so a shipped home is the same home.
//
// THE GUARD (guardOutput, called at the end of build-portal.mts; also unit-tested by scripts/test-portal-redact.mts). It reads
// every text file under the output (HTML, JS, CSS, JSON, XML, text, webmanifest, SVG, and the extensionless ones: _headers, a
// licence) and reports any of:
//
//   - a builder handle: the `author` of every spec in content/houses/ (and of index.json), read from the files, never listed
//     here, matched case-insensitively; plus the handle's letters alone when that is six or more ("Schnuck01" is also "schnuck").
//     The one exception is the company's own name (scripts/own-authors.mts): a home Companion Intelligence wrote itself is credited
//     to it, and it is on every page, so it is not a builder. That is not an allowlist entry (GUARD_ALLOW stays empty)
//   - the word "Sims" (capitalised, as a word: not the lower-case identifiers a program uses), "SimsTree", "The Sims", "Sims 4"
//   - "Base Game" / "Basegame" (the pack tag a filed title carries)
//   - "BG " (that tag's abbreviation), as a word
//
// It runs on the output of the whole build, family pages and the tour's data included, so a new surface cannot start
// crediting a builder without the build failing. The allowlist below is EMPTY. An entry exempts one term in one file and says
// why; a reason that is not "this is not about a builder or a build" belongs in a conversation with the owner, not here.
import fs from 'node:fs';
import path from 'node:path';
import { displayName } from '../assets/home-names.js';
import { isOwnAuthor } from './own-authors.mts';

// ---------------------------------------------------------------------------------------------------- redaction

/** The keys of a spec and of an index entry that credit a builder or name the build; never shipped. */
export const REDACTED_KEYS = ['author', 'source'] as const;

const lineOf = (key: string): RegExp => new RegExp(`^  ${JSON.stringify(key)}: (?:"(?:[^"\\\\]|\\\\.)*"),?\\n`, 'm');

/**
 * A spec's text as shipped: its `author` and `source` lines gone and its `name` the display name. The files are pretty-printed with
 * two-space indents and these three are one-line strings, so the rest keeps its bytes (a parse and a stringify would reformat
 * the numbers); the result is parsed and compared with the source to prove it. A spec that is not shaped so is parsed and written
 * again (the same data, a different spelling of some numbers) rather than shipped with a credit in it.
 */
export function redactSpecText(text: string): { text: string; name: string; reshaped: boolean } {
  const src = JSON.parse(text);
  const name = displayName({ id: src.id, name: src.name });
  const want: any = { ...src, name };
  for (const k of REDACTED_KEYS) delete want[k];
  let out = text;
  for (const k of REDACTED_KEYS) out = out.replace(lineOf(k), '');
  const nameRe = lineOf('name');
  out = nameRe.test(out) ? out.replace(nameRe, () => `  "name": ${JSON.stringify(name)},\n`) : out;
  let ok = false;
  try { ok = JSON.stringify(JSON.parse(out)) === JSON.stringify(want); } catch { ok = false; }
  if (ok) return { text: out, name, reshaped: false };
  return { text: `${JSON.stringify(want, null, 2)}\n`, name, reshaped: true };
}

/**
 * The list of homes as shipped: each entry without `author` and `source`, its `name` the display name. An `offices` array (reference/office/office-contract-m0.md: an office is listed
 * beside the homes, never among them) is not shipped: the public site has no office, and a list that is copied as it is would tell the world the first office exists.
 */
export function redactIndex(index: any): any {
  const { offices: _offices, ...rest } = index;
  return {
    ...rest,
    houses: (index.houses || []).map((h: any) => {
      const out: any = { ...h, name: displayName({ id: h.id, name: h.name }) };
      for (const k of REDACTED_KEYS) delete out[k];
      return out;
    }),
  };
}

// ---------------------------------------------------------------------------------------------------- the guard

/**
 * The builder handles: the `author` of every spec file in content/houses/ and of the list, read from the files. The company's own name
 * (scripts/own-authors.mts: the apartments, which Companion Intelligence wrote itself) is not a handle: it is on every page of the site.
 */
export function builderHandles(root: string): string[] {
  const dir = path.join(root, 'content', 'houses');
  const found = new Set<string>();
  const add = (v: unknown): void => { if (typeof v === 'string' && v.trim() && !isOwnAuthor(v)) found.add(v.trim()); };
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!f.endsWith('.json') || f.endsWith('.plan.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (f === 'index.json') for (const h of j.houses || []) add(h.author);
    else add(j.author);
  }
  return [...found].sort();
}

export type GuardTerm = { label: string; re: RegExp };
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** What no shipped file may contain: the handles (and their letters alone), and the build and pack words. */
export function guardTerms(handles: string[]): GuardTerm[] {
  const terms: GuardTerm[] = [];
  const seen = new Set<string>();
  const push = (label: string, re: RegExp): void => { if (!seen.has(re.source + re.flags)) { seen.add(re.source + re.flags); terms.push({ label, re }); } };
  for (const h of handles) {
    push(`the builder handle "${h}"`, new RegExp(escapeRe(h), 'i'));
    const letters = h.replace(/[^a-z]/gi, '');
    if (letters.length >= 6 && letters.toLowerCase() !== h.toLowerCase()) push(`the builder handle "${h}" without its digits ("${letters}")`, new RegExp(escapeRe(letters), 'i'));
  }
  push('the word "Sims"', /\bSims\b/);
  push('"SimsTree"', /SimsTree/i);
  push('"The Sims"', /\bthe sims\b/i);
  push('"Sims 4"', /\bsims ?4\b/i);
  push('"Base Game"', /base ?game/i);
  push('"BG "', /\bBG /);
  return terms;
}

/** An exemption: one term, in the files whose output-relative path starts with `file`, and why. EMPTY by default. */
export type GuardAllow = { file: string; term: string; why: string };
export const GUARD_ALLOW: GuardAllow[] = [];

const BINARY = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.m4a', '.mp3', '.mp4', '.webm', '.ogg', '.wav', '.mov', '.pdf', '.zip', '.gz', '.br', '.bin', '.wasm']);

/** The findings in one file's text: each term that appears, with a few words around the first hit. */
export function scanText(file: string, text: string, terms: GuardTerm[], allow: GuardAllow[] = GUARD_ALLOW): string[] {
  const out: string[] = [];
  for (const t of terms) {
    const m = t.re.exec(text);
    if (!m) continue;
    if (allow.some(a => file.startsWith(a.file) && a.term === t.label)) continue;
    const at = m.index ?? 0;
    const around = text.slice(Math.max(0, at - 24), at + m[0].length + 24).replace(/\s+/g, ' ');
    out.push(`${file}: ${t.label} ("…${around}…")`);
  }
  return out;
}

/** Every file under `dir` (output-relative, forward slashes) that is not a picture, a font or a sound. */
export function shippedTextFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const name of fs.readdirSync(path.join(dir, rel)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      if (fs.statSync(path.join(dir, r)).isDirectory()) walk(r);
      else if (!BINARY.has(path.extname(name).toLowerCase())) out.push(r);
    }
  };
  if (fs.existsSync(dir)) walk('');
  return out;
}

/** The guard over a whole output: the problems, or none. `handles` is derived from the specs unless given. */
export function guardOutput(outDir: string, root: string, handles: string[] = builderHandles(root), allow: GuardAllow[] = GUARD_ALLOW): { problems: string[]; files: number; handles: number } {
  const terms = guardTerms(handles);
  const problems: string[] = [];
  if (!handles.length) problems.push('the guard found no builder handle in content/houses/*.json (the specs\' `author` fields), so it would guard nothing');
  const files = shippedTextFiles(outDir);
  for (const f of files) problems.push(...scanText(f, fs.readFileSync(path.join(outDir, f), 'utf8'), terms, allow));
  return { problems, files: files.length, handles: handles.length };
}
