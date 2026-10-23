// `pnpm run story:validate -- --kind office [<slug|file>...] [--json]`: the company files (content/offices/<slug>.json) against validateCompany. The family gate
// (scripts/validate-stories.mts) hands over here before it loads anything of its own, so its output for the families is the same bytes as without the flag.
import fs from 'node:fs';
import path from 'node:path';
import { loadCompanyContext, ROOT } from './context.mts';
import { validateCompany } from './validate.mts';
import type { Finding } from '../report.mts';

const OFFICES = path.join(ROOT, 'content', 'offices');
const NOT_AUTHORED = /(\.bake|\.voice)\.json$|^films\.json$/;

export function runCompanyValidator(argv: string[]): number {
  const args = argv.filter((a) => a !== '--');
  const json = args.includes('--json');
  for (const a of args) if (a.startsWith('--') && a !== '--json') { console.error(`unknown flag ${a}\nusage: story:validate -- --kind office [<slug|file>...] [--json]`); return 2; }
  const positional = args.filter((a) => !a.startsWith('--'));
  const authored = (): string[] => (fs.existsSync(OFFICES) ? fs.readdirSync(OFFICES).filter((f) => /^[a-z0-9][a-z0-9-]*\.json$/.test(f) && !NOT_AUTHORED.test(f)).sort().map((f) => path.join(OFFICES, f)) : []);
  const targets = positional.length ? positional.map((a) => (/\.json$/.test(a) || a.includes('/') ? path.resolve(process.cwd(), a) : path.join(OFFICES, `${a}.json`))) : authored();
  const notFound = targets.filter((t) => !fs.existsSync(t));
  const ctx = loadCompanyContext(ROOT);
  const rel = (p: string): string => path.relative(ROOT, p) || p;
  const results = targets.filter((t) => fs.existsSync(t)).map((file) => {
    try { return { file, report: validateCompany(JSON.parse(fs.readFileSync(file, 'utf8')), ctx), parseError: '' }; } catch (e) { return { file, report: null, parseError: (e as Error).message }; }
  });
  const count = (k: 'errors' | 'review' | 'warn'): number => results.reduce((n, r) => n + (r.report ? r.report[k].length : 0), 0);
  const problems = [...notFound.map((f) => `no such company file: ${rel(f)}`), ...results.filter((r) => r.parseError).map((r) => `${rel(r.file)} is not valid JSON: ${r.parseError}`)];
  const ok = count('errors') === 0 && count('review') === 0 && problems.length === 0;
  if (json) {
    const finding = (f: Finding) => ({ rule: f.rule, at: f.at, message: f.message, ...(f.fix ? { fix: f.fix } : {}) });
    console.log(JSON.stringify({ ok, totals: { companies: results.length, errors: count('errors'), review: count('review'), warnings: count('warn'), problems: problems.length },
      companies: results.map((r) => ({ slug: r.report?.slug ?? null, file: rel(r.file), errors: r.report?.errors.map(finding) ?? [], review: r.report?.review.map(finding) ?? [], warnings: r.report?.warn.map(finding) ?? [] })), problems }, null, 2));
    return ok ? 0 : 1;
  }
  if (!results.length && !positional.length) console.log('No company files yet: content/offices is empty, which is a pass. The writers add content/offices/<slug>.json with M1.');
  for (const r of results) {
    if (!r.report) continue;
    const rep = r.report;
    console.log(`${rep.slug}  (${rel(r.file)})`);
    for (const [label, list] of [['ERROR ', rep.errors], ['REVIEW', rep.review], ['warn  ', rep.warn]] as const) for (const f of list) { console.log(`  ${label} ${rep.line(f)}`); if (f.fix) console.log(`           fix: ${f.fix}`); }
    console.log(`  ${rep.errors.length || rep.review.length ? 'FAIL' : 'OK'}: ${rep.errors.length} errors, ${rep.review.length} review, ${rep.warn.length} warnings [${rep.stats.beats} beats]`);
  }
  for (const p of problems) console.log(`ERROR  ${p}`);
  console.log(`\n${ok ? 'story:validate (office) OK' : 'story:validate (office) FAILED'}: ${results.length} company file${results.length === 1 ? '' : 's'}, ${count('errors') + problems.length} errors, ${count('review')} review, ${count('warn')} warnings`);
  return ok ? 0 : 1;
}
