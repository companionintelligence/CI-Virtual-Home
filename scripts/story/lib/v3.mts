// Story v3 rules and the device that phases them in (decisions of 2026-10-19, reference/story/validator.md "Story v3").
//
// A family that has at least one beat with a `service` key is a v3 family and meets the v3 rules at full severity; every other
// family meets them as warnings, so the thirty families written before v3 stay valid until each one is rewritten (the same
// device `detail-missing` uses for story v2). When all families are v3, the warnings can become errors fleet-wide.
//
// Rules here: age-chat. age-companion lives in structure.mts (it replaced the under-13 test there) and app-avoid in apps.mts;
// both take their severity from v3Severity below.
import type { Beat, Member, Story } from '../../../assets/story/types.ts';
import type { Ctx } from './context.mts';
import type { Report, Severity } from './report.mts';

/** Age rule 16 (owner decision): nobody under this age has an agent companion or uses a chat model or an agent in their own beat. */
export const CHAT_MIN_AGE = 16;
/** The member who approves an agent's work is an adult. */
export const APPROVER_MIN_AGE = 18;

/** True when some beat has a `service` key: the family is told in the v3 shape. */
export const isV3Story = (story: Story): boolean => story.beats.some((b) => Object.prototype.hasOwnProperty.call(b, 'service'));

/**
 * The rules that are errors in a v3 family and warnings in every other (the phase-in): age-chat, age-companion, app-avoid (v3.mts, structure.mts, apps.mts),
 * and the story v3 rules of services.mts and apps.mts. A family written before v3 reports them as warnings, so a clean sample of such a family (the exemplar)
 * is "clean" apart from these; the tests filter on this list.
 */
export const PHASED_RULES = ['age-chat', 'age-companion', 'app-avoid', 'service-missing', 'chips-legacy', 'household-beats', 'household-doer', 'persona-band', 'pair-share', 'pair-budget'] as const;

/** `error` in a v3 family, `warn` in every other family. */
export const v3Severity = (story: Story): Severity => (isV3Story(story) ? 'error' : 'warn');

/** The catalog ids of the chat or agent apps a beat names (its `app` and its `with`). */
const chatApps = (b: Beat, ctx: Ctx): string[] => [...(b.app ? [b.app.id] : []), ...(b.with ?? [])].filter((id) => ctx.apps.get(id)?.ai === 'chat');

/**
 * age-chat. A beat whose app is a chat-model or agent app (catalog `ai: "chat"`) needs a `member` of age 16 or older. A beat with an `agent` needs the
 * agent's owner (the member whose companion acts) to be 16 or older, and the member who approves to be an adult. A child may appear in a parent-led
 * beat: the beat's `member` is the adult, the child is named in the body as the one being helped, and the child is never the actor. Beats with no
 * `member` (household beats) have no one to hold to the rule; non-chat AI tools (LibreTranslate, Whisper-WebUI, Kokoro, OCR) are not tagged.
 */
export function checkAgeChat(story: Story, ctx: Ctx, members: Map<string, Member>, out: Report): void {
  const sev = v3Severity(story);
  for (const b of story.beats) {
    const chat = chatApps(b, ctx);
    const who = b.member ? members.get(b.member) : undefined;
    if (chat.length && who && who.age < CHAT_MIN_AGE) {
      out.add(sev, 'age-chat', b.id, `${who.name} is ${who.age} and the beat uses ${chat.map((id) => ctx.apps.get(id)!.name).join(' and ')}, a chat or agent app (age ${CHAT_MIN_AGE} or older)`,
        `Make the beat a parent-led one: the beat's member is the adult and ${who.name} is named in the body as the one being helped, or give ${who.name} an app that is not a chat model.`);
    }
    if (b.agent) {
      const owner = members.get(b.agent);
      if (owner && owner.age < CHAT_MIN_AGE) out.add(sev, 'age-chat', b.id, `the agent is ${owner.name}'s and ${owner.name} is ${owner.age} (an agent needs an owner of ${CHAT_MIN_AGE} or older)`, 'Let a member of 16 or older own the agent in this beat.');
      const approver = b.approval ? members.get(b.approval) : undefined;
      if (approver && approver.age < APPROVER_MIN_AGE) out.add(sev, 'age-chat', b.id, `the approving member ${approver.name} is ${approver.age} (an agent's work is approved by an adult)`, 'Name an adult as `approval`.');
    }
  }
}
