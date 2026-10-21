#!/usr/bin/env -S node --experimental-strip-types
// .github/workflows/ci.yml keeps the gates the audit of 2026-10 found missing (W6-technical-01, -02, -04, -05, -21), and none of what CLAUDE.md keeps out of it. Reads the file as text; no
// browser, no network. (deploy.yml's own inline scripts are scripts/test-deploy-workflow.mts's.)
//   * the story gates run: story:validate, story:cast -- --check, story:cast-lint, story:services:check, story:bake -- --check --all, and the two that are not blocking yet say so
//   * the build is strict about families on a push and lenient on a pull request, and the copy lint runs over dist/ after the build
//   * every job has a timeout, every action is pinned to a commit, the token is read-only and no secret, no deploy token and no repository variable reaches this workflow
//   * a non-blocking step is one of the named ones (a new continue-on-error needs a line here)
// @check-house quick
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './portal-lib.mts';

const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
const lines = yml.split('\n');
let fails = 0;
const ok = (cond: unknown, what: string): void => { if (cond) console.log(`  \x1b[32m✓\x1b[0m ${what}`); else { fails++; console.log(`  \x1b[31m✗ ${what}\x1b[0m`); } };

// the steps: [name, the lines until the next step]
const steps: { name: string; body: string }[] = [];
lines.forEach((l, i) => {
  const m = l.match(/^\s+- name: (.+)$/);
  if (!m) return;
  let j = i + 1;
  while (j < lines.length && !/^\s+- name: /.test(lines[j])) j++;
  steps.push({ name: m[1].trim(), body: lines.slice(i, j).filter(x => !/^\s*#/.test(x)).join('\n') });
});
const run = (cmd: string): { name: string; body: string } | undefined => steps.find(s => s.body.includes(cmd));

console.log('the story gates');
for (const cmd of ['pnpm run story:validate\n', 'pnpm run story:cast -- --check', 'pnpm run story:cast-lint', 'pnpm run story:services:check', 'pnpm run story:bake -- --check --all']) {
  const s = run(cmd);
  ok(s && !/continue-on-error: true/.test(s.body), `${cmd.trim()} runs and blocks`);
}
for (const cmd of ['pnpm run story:validate -- --complete', 'pnpm run story:ads -- --check']) {
  const s = run(cmd);
  ok(s && /continue-on-error: true/.test(s.body) && /not yet blocking/.test(s.name), `${cmd} runs and says it does not block yet`);
}
const quick = steps.findIndex(s => s.body.includes('pnpm run test:node')), floor = steps.findIndex(s => s.body.includes('pnpm run test\n'));
ok(quick > floor && floor > 0, 'the quick Node tests and the floor-plan graph tests run');

console.log('the portal build and the copy lint');
const build = run('pnpm run portal:build');
ok(build && /CI_STORY_STRICT: \$\{\{ github\.event_name == 'push' && '1' \|\| '' \}\}/.test(build.body), 'the build is strict about families on a push (main) and lenient on a pull request');
const lint = run('pnpm run story:copy -- dist');
ok(lint && !/continue-on-error/.test(lint.body) && steps.indexOf(lint) > steps.indexOf(build!), 'the copy lint runs over dist/ after the build and blocks');
const keep = steps.findIndex(s => s.name.startsWith('Keep the site'));
ok(keep > steps.indexOf(lint!), 'the site is kept for deploy.yml only after the lint passed');
const browser = run('pnpm run portal:test');
ok(browser && /--dir dist/.test(browser.body) && /continue-on-error: true/.test(browser.body) && steps.indexOf(browser) > keep, 'the browser legs run on dist/ after the site is kept, and do not block yet');

console.log('what must not change');
ok(/^permissions:\n  contents: read\n/m.test(yml) && !/\n\s+(?:id-token|contents|packages|pull-requests|actions): write/.test(yml), 'the token is read-only');
ok(!/secrets\./.test(yml) && !/CLOUDFLARE|vars\./.test(yml), 'no secret, no Cloudflare token and no repository variable in this workflow');
const uses = [...yml.matchAll(/^\s+uses: (\S+)@(\S+)/gm)];
ok(uses.length >= 5 && uses.every(u => /^[0-9a-f]{40}$/.test(u[2])), `all ${uses.length} actions are pinned to a commit`);
const jobs = [...yml.matchAll(/^  ([a-z][\w-]*):\n    name:/gm)].length;
ok(jobs >= 1 && (yml.match(/^    timeout-minutes: \d+$/gm) || []).length === jobs, `all ${jobs} job(s) have a timeout`);
ok(/^name: ci$/m.test(yml), 'the workflow is still named ci (deploy.yml finds it by that name)');
ok(/path: dist\/\n/.test(yml) && /name: site\n/.test(yml), 'the artifact deploy.yml downloads is still `site`, from dist/');
const soft = steps.filter(s => /continue-on-error: true/.test(s.body)).map(s => s.name);
ok(soft.length === 4 && soft.every(n => /not yet blocking|Install Chromium|Portal browser tests/.test(n)), `exactly the four named steps are non-blocking (${soft.length})`);

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nci.yml holds');
