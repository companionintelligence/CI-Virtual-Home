// One family file against every rule. The rule ids are the reference validator's (reference/story/ref/ref-validate.mjs),
// which is the seed this module was ported from; the rule catalogue with fixes is reference/story/validator.md.
import type { Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import { Report } from './report.mts';
import { checkSchema } from './schema-lite.mts';
import { checkBannedPhrases } from './text.mts';
import { checkShape } from './shape.mts';
import { checkAgents, checkCasting, checkChapters, checkFtue, checkMembers } from './structure.mts';
import { checkApps } from './apps.mts';
import { checkAnchors } from './anchors.mts';
import { checkQuotas } from './quotas.mts';

export function validateStory(data: unknown, ctx: Ctx): Report {
  const slug = typeof (data as any)?.slug === 'string' ? (data as any).slug : '(no slug)';
  const out = new Report(slug, ctx.reviewed);
  for (const m of checkSchema(data, ctx.schema)) out.E('schema', '', m);
  if (out.errors.length) return out;                       // every other rule assumes the shape
  const story = data as Story;

  checkCasting(story, ctx, out);
  const members = checkMembers(story, ctx, out);
  checkChapters(story, ctx, out);
  checkBannedPhrases(story, ctx, out);
  checkShape(story, ctx, out);
  checkFtue(story, ctx, out);
  checkAgents(story, ctx, out, members);
  checkApps(story, ctx, out);
  checkAnchors(story, ctx, out);
  checkQuotas(story, ctx, out);

  for (const k of out.unusedReviewed()) out.W('reviewed', k, 'this allow-list entry matched no finding; remove it from content/story/reviewed.json');
  return out;
}
