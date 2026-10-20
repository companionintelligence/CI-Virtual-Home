// The strings of a TypeScript source file that a visitor can read: the copy of the player (assets/viewer.ts), the tour (assets/story/*.ts) and the ad
// cards (assets/story/film). Read with the TypeScript parser, so a template's text is kept and its `${}` holes become a space, and a comment, a type, an
// import, a property name, an error message or a console line is never mistaken for copy. A string is copy when, with its tags stripped, it is two or
// more words that read like a sentence or a label; selectors, class lists, CSS, URLs and code-like text are not. This is a heuristic: the lint that uses
// it (site-copy.mts) says what it found and where, and a false positive is fixed by rewording or by an entry in its allow-list.
import fs from 'node:fs';
import ts from 'typescript';

export interface SourceString { file: string; line: number; text: string }

const decode = (s: string): string => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–');

/** One piece of text, kept when it is copy (see the header). */
function keep(t0: string): string {
  const t = decode(t0).replace(/\s+/g, ' ').trim();
  if (t.length < 6 || !/\s/.test(t) || !/[A-Za-z]{3}/.test(t)) return '';
  if (/^(?:https?:|\/|\.{1,2}\/|#|\.|\[|@|data:)/.test(t)) return '';          // a URL, path, selector or at-rule
  if (/[{};]|=>|\$\{|\bfunction\b|\breturn\b|\bconst\b|\bvar\b|[a-z]\(\)|::|\b\w+:\s*\w+\s*;/.test(t)) return '';     // code or CSS
  if (/^[a-z0-9_:.\-[\]="' >+~*,()%]+$/.test(t) && !/[A-Z]/.test(t) && !/[.?!,]/.test(t)) return '';  // a class list, a selector, a media query
  if (!/^[A-Z0-9"'“‘(]/.test(t) && !/[.?!,]/.test(t)) return '';               // lower case with no sentence marks: an identifier-ish list ("play pause seek")
  return t;
}

/**
 * The texts a visitor would read in a string's value: for markup, each text between two tags and the aria-label, title, alt and placeholder
 * attributes; for a plain string, the string. Anything that is not copy is dropped.
 */
export function copiesOf(raw: string): string[] {
  if (/<style\b|<script\b/i.test(raw)) return [];
  if (!/<[a-z/!][^>]*>/i.test(raw)) return [keep(raw)].filter(Boolean);
  const attrs = [...raw.matchAll(/\s(?:aria-label|title|alt|placeholder)="([^"]*)"/g)].map((m) => m[1]);
  return [...raw.split(/<[^>]*>/), ...attrs].map(keep).filter(Boolean);
}

// a call whose string arguments are a message for a developer: nothing in it is copy
const SKIP_ALL = /^(?:console\.\w+|assert(?:\.\w+)?|\w*Error|Error|import|require|CustomEvent|Event|RegExp|URL|URLSearchParams|JSON\.parse|performance\.\w+|(?:window\.)?gtag)$/;
// a call whose FIRST string argument names something (a selector, an attribute, an event, a key); the others can be copy, as in setAttribute('aria-label', 'Close')
const SKIP_FIRST = /^(?:querySelector(?:All)?|getElementById|closest|matches|matchMedia|addEventListener|removeEventListener|setAttribute|getAttribute|hasAttribute|removeAttribute|createElement|createElementNS|add|remove|toggle|contains|escape|fetch|getItem|setItem|removeItem|dispatchEvent|postMessage|setProperty|getPropertyValue|importScripts)$/;

export function sourceStrings(file: string, source = fs.readFileSync(file, 'utf8')): SourceString[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: SourceString[] = [];
  const add = (node: ts.Node, text: string): void => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    for (const t of copiesOf(text)) out.push({ file, line, text: t });
  };
  const calleeName = (e: ts.Expression): string => ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? `${calleeName(e.expression)}.${e.name.text}` : ts.isCallExpression(e) ? calleeName(e.expression) : '';
  const walk = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isTypeNode(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) return;
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const name = calleeName(n.expression), last = name.split('.').pop() ?? '';
      if (SKIP_ALL.test(name)) return;
      if (SKIP_FIRST.test(last)) {
        walk(n.expression);
        (n.arguments ?? []).forEach((arg, i) => { if (i > 0 || !(ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg) || ts.isTemplateExpression(arg))) walk(arg); });
        return;
      }
    }
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && /^(?:className|id|href|src|selector|type|rel|target|role|method|cursor|font|fontFamily|transition|animation|width|height|background|color|display|position|border|boxShadow)$/.test(n.name.text)) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) { add(n, n.text); return; }
    if (ts.isTemplateExpression(n)) {
      add(n, [n.head.text, ...n.templateSpans.map((s) => ` ${s.literal.text}`)].join(' '));
      n.templateSpans.forEach((s) => walk(s.expression));
      return;
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}
