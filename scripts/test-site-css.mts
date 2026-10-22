#!/usr/bin/env -S node --experimental-strip-types
// The public site's stylesheets and the chrome the pages write, read as text (no browser, no build):
// @check-house quick
//
//   node --experimental-strip-types scripts/test-site-css.mts       (any cwd)
//
// A stray "}" once sat after the 900 px token block of portal/gallery.css and portal/site.css (the October restyle). A browser reads a closing brace at the top level as the start of a
// rule whose selector it cannot parse, so it dropped the very next rule, `*, *::before, *::after { box-sizing: border-box }`, and every page of the site laid out in content-box:
// a 69 px header on a phone, a 417 px front page on a 390 px screen, buttons wider than their column. Nothing failed: the pages still rendered. This holds the class of mistake:
//   braces     every stylesheet in portal/ is balanced (comments and strings left out), never closes more than it opened and ends at depth 0
//   box        gallery.css and site.css each have `*, *::before, *::after { box-sizing: border-box }` as a top-level rule, and every selector rule that follows a media block is reachable
//   chrome     the header is one bar on every page (the front page's, a home's page, a family's page and the 404 all offer Download and Buy as links in the bar, with the short forms a
//              phone shows: "Download" and "Buy Core"); no page has a menu button that hides them behind a tap, and portal/site.js (the menu's script) is gone
//   the 404    its own inline style is border-box too, its small links are 44 px targets and its type is no smaller than the site's floors
// Exit 0 when all hold; 1 otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { header as familyHeader } from './story/pages.mts';
import { notFoundPage, LINKS } from './portal-pages.mts';

const ROOT = path.resolve(import.meta.dirname, '..');
let failures = 0;
const ok = (cond: unknown, what: string): void => { if (cond) console.log(`  \x1b[32m✓\x1b[0m ${what}`); else { failures++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };

/** A stylesheet with its comments and its strings blanked (a brace in either is not a brace). */
const bare = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, m => `"${' '.repeat(m.length - 2)}"`);

/** Walk the braces: the depth after each, the lines where one closed more than was open, and the top-level rules' selectors (the text between one top-level close and the next open). */
export function braces(css: string): { negative: number[]; end: number; topSelectors: string[] } {
  const s = bare(css);
  const negative: number[] = [], topSelectors: string[] = [];
  let depth = 0, line = 1, last = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\n') line++;
    else if (ch === '{') { if (depth === 0) topSelectors.push(s.slice(last, i).replace(/\s+/g, ' ').trim()); depth++; }
    else if (ch === '}') { depth--; if (depth < 0) { negative.push(line); depth = 0; } if (depth === 0) last = i + 1; }
  }
  return { negative, end: depth, topSelectors };
}

console.log('\nthe site\'s stylesheets');
const files = fs.readdirSync(path.join(ROOT, 'portal')).filter(f => f.endsWith('.css')).sort();
for (const f of files) {
  const r = braces(fs.readFileSync(path.join(ROOT, 'portal', f), 'utf8'));
  ok(r.negative.length === 0 && r.end === 0, `portal/${f}: the braces are balanced${r.negative.length ? ` (a closing brace with nothing open at line ${r.negative.join(', ')})` : ''}${r.end ? ` (${r.end} left open)` : ''}`);
}
for (const f of ['gallery.css', 'site.css']) {
  const r = braces(fs.readFileSync(path.join(ROOT, 'portal', f), 'utf8'));
  const sel = r.topSelectors.findIndex(x => x === '*, *::before, *::after');
  ok(sel >= 0, `portal/${f}: \`*, *::before, *::after { box-sizing: border-box }\` is a rule of its own at the top level, so every box on the page is border-box`);
  ok(/\*, \*::before, \*::after \{ box-sizing: border-box; \}/.test(fs.readFileSync(path.join(ROOT, 'portal', f), 'utf8')), `portal/${f}: and it says border-box`);
}

console.log('\nthe chrome');
const fam = familyHeader();
const nav = (h: string, cls: string): string => (h.match(new RegExp(`<a class="${cls}"[^>]*>[\\s\\S]*?</a>`)) || [''])[0];
for (const [name, h] of [['a family\'s page', fam]] as const) {
  ok(/<a class="nav-download"[^>]*href="https:\/\/ci\.computer\/download"><span class="nav-long">Download Companion<\/span><span class="nav-short">Download<\/span><\/a>/.test(nav(h, 'nav-download')), `${name}: the header links Download Companion (a phone shows "Download")`);
  ok(/<a class="nav-buy"[^>]*href="https:\/\/ci\.computer\/core"><span class="nav-long">Buy Companion Core<\/span><span class="nav-short">Buy Core<\/span><\/a>/.test(nav(h, 'nav-buy')), `${name}: and Buy Companion Core (a phone shows "Buy Core")`);
  ok(!/menu-btn|aria-expanded|aria-controls/.test(h), `${name}: and there is no menu button that hides them`);
}
const home = fs.readFileSync(path.join(ROOT, 'scripts', 'portal-pages.mts'), 'utf8');
ok(/<a class="nav-download" href="\$\{LINKS\.download\}"><span class="nav-long">Download Companion<\/span><span class="nav-short">Download<\/span><\/a>/.test(home), 'a home\'s page: the header has the same short and long Download (the long one overlapped the lockup on a phone)');
const front = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(/class="nav-download"[^>]*><span class="nav-long">Download Companion<\/span><span class="nav-short">Download<\/span>/.test(front) && /class="nav-buy"[^>]*><span class="nav-long">Buy Companion Core<\/span><span class="nav-short">Buy Core<\/span>/.test(front), 'the front page: the same header');
ok(!fs.existsSync(path.join(ROOT, 'portal', 'site.js')), 'portal/site.js, the script of the menu that is no more, is gone');

const nf = notFoundPage('https://homes.ci.computer/', 'thirty-six');
ok(/\*, \*::before, \*::after \{ box-sizing: border-box; \}/.test(nf), 'the 404: its inline style is border-box too');
ok(/\.more a \{[^}]*min-height: 44px/.test(nf), 'the 404: its two small links ("Companion Intelligence", "Docs") are 44 px tall targets');
ok(!/font-size: 1[0-3](\.\d)?px/.test(nf.replace(/<h1[\s\S]*?<\/h1>/, '')), 'the 404: nothing in it is set below 14 px');
ok(nf.includes(LINKS.core) && nf.includes(LINKS.download) && nf.includes(LINKS.docs) && nf.includes(LINKS.site), 'the 404: and it still links the four destinations');

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nthe site\'s stylesheets and chrome hold');
