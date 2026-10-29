// assets/story/subject.ts : polymorphic adapter over family/v1 and company/v1 stories.
// Browser and Node, no THREE, no external dependencies. Pure and deterministic.
// See reference/office/office-build-contract.md section 3.

import {
  FICTIONAL_LINE,
  FICTIONAL_COMPANY_LINE,
  type Story,
  type CompanyStory,
  type VoiceKey,
} from './types.js';

export interface Subject {
  kind: 'family' | 'company';
  slug: string;
  /** home house id or office house id */
  house: string;
  narrator: VoiceKey;
  name: string;
  tagline: string;
  address: { line: string; place: string };
  place: 'home' | 'office';
  fictionalLine: string;
  fictionalId: string;
  startTitle: string;
  fromTour: string;
  endLead: string;
  nextLabel: string;
  shareLabel: string;
  canvasLabel: string;
  pageDir: 'family' | 'company';
  param: 'family' | 'company';
}

export function isCompanyStory(s: any): s is CompanyStory {
  return s?.schema === 'company/v1' || Boolean(s?.company);
}

export function subjectOf(story: Story | CompanyStory | any): Subject {
  if (isCompanyStory(story)) {
    const co = story.company;
    const name = co?.name || story.slug;
    return {
      kind: 'company',
      slug: story.slug,
      house: story.office,
      narrator: co?.narrator,
      name,
      tagline: co?.tagline || '',
      address: co?.address || { line: '', place: '' },
      place: 'office',
      fictionalLine: FICTIONAL_COMPANY_LINE,
      fictionalId: 'fictional-company',
      startTitle: name,
      fromTour: 'from the office tour',
      endLead: name,
      nextLabel: 'Next office',
      shareLabel: 'Share this office',
      canvasLabel: 'Office tour',
      pageDir: 'company',
      param: 'company',
    };
  }

  const fam = story.family;
  const surname = fam?.surname || story.slug;
  return {
    kind: 'family',
    slug: story.slug,
    house: story.house,
    narrator: fam?.narrator,
    name: surname,
    tagline: fam?.tagline || '',
    address: fam?.address || { line: '', place: '' },
    place: 'home',
    fictionalLine: FICTIONAL_LINE,
    fictionalId: 'fictional-family',
    startTitle: `The ${surname} family`,
    fromTour: 'from the tour',
    endLead: `The ${surname} family`,
    nextLabel: 'Next home',
    shareLabel: 'Share this home',
    canvasLabel: 'Family tour',
    pageDir: 'family',
    param: 'family',
  };
}

/** Returns the job title (company) or archetype word (family) for a given member id. */
export function memberLabel(story: any, memberId: string): string {
  const m = Array.isArray(story?.members) ? story.members.find((x: any) => x?.id === memberId) : null;
  if (!m) return '';
  if (isCompanyStory(story)) {
    return m.title || m.function || '';
  }
  return m.archetype || m.role || '';
}
