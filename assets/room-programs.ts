// Room programs — what a room is for, as the one room-type field (`rooms[].program`, plan Completeness C2).
//
// THREE-free and dependency-free, so every consumer can import it without pulling the composer in:
//   PROGRAMS            the 26 programs
//   isComposed(room)    does the builder compose this room? (a program, and not locked)
//   inferProgram(room, level?)  a program read off the room's name (the dry run, compose-house.mts, the lints);
//                       null when the name says nothing (the room is left as authored)
//   programKind(p)      the fixture kind assets/fixtures.ts dresses a room of this program as (S1's roomKind()
//                       honours an explicit program before its name regex: plan C2). In a composed room the
//                       composer places the lamps and fixtures.ts only the ceiling fixtures (plan C9).
//
// Owner: S3 (compose).

export const PROGRAMS = [
  'living', 'kitchen', 'dining', 'kitchen-dining', 'bed-primary', 'bed-kid', 'bed-guest', 'nursery',
  'bath', 'ensuite', 'powder', 'study', 'library', 'den', 'media', 'playroom', 'sunroom', 'greenhouse',
  'foyer', 'hall', 'laundry', 'studio', 'bar', 'gym', 'garage', 'outdoor',
] as const;
export type Program = typeof PROGRAMS[number];
export const isProgram = (p: unknown): p is Program => typeof p === 'string' && (PROGRAMS as readonly string[]).includes(p);

/** does the builder compose this room? A program, and not locked (a baked composition). */
export const isComposed = (room: any): boolean => !!room && isProgram(room.program) && room.lock !== true;

// program → assets/fixtures.ts kind (its KINDS: service bath bed kitchen dining living work hall, and 'room')
const KIND: Record<Program, string> = {
  living: 'living', kitchen: 'kitchen', dining: 'dining', 'kitchen-dining': 'kitchen',
  'bed-primary': 'bed', 'bed-kid': 'bed', 'bed-guest': 'bed', nursery: 'bed',
  bath: 'bath', ensuite: 'bath', powder: 'bath',
  study: 'work', library: 'work', studio: 'work',
  den: 'living', media: 'living', playroom: 'living', sunroom: 'living', greenhouse: 'living', bar: 'living',
  foyer: 'hall', hall: 'hall', laundry: 'service', gym: 'service', garage: 'service', outdoor: 'service',
};
export const programKind = (p: string): string | null => (isProgram(p) ? KIND[p] : null);

/** the programs that are bedrooms (they get a palette of their own) */
export const BEDROOMS: ReadonlySet<string> = new Set(['bed-primary', 'bed-kid', 'bed-guest', 'nursery']);

// The name → program table. Order matters: the first match wins, so the specific names come before the broad
// ones ("Kitchen & Dining" before "Kitchen", "Garden Room" before "Garden", "Primary Bath" before "Primary").
const NAMES: Array<[Program, RegExp]> = [
  ['hall', /bedroom hall|hallway|landing|corridor/i],
  ['greenhouse', /greenhouse|glasshouse|orangery/i],
  ['sunroom', /sun ?room|sun lounge|solarium|conservatory|garden room|winter garden/i],
  ['outdoor', /terrace|patio|\bdeck\b|porch|balcony|stoop|yard|garden|veranda|loggia|courtyard|chimney|pergola|\bpool\b|roof top|rooftop|carport|arcade/i],
  ['garage', /garage|workshop/i],
  ['laundry', /laundry|utility|mudroom|boot room/i],
  ['gym', /\bgym\b|fitness|yoga/i],
  ['powder', /powder|\bwc\b|cloak|half bath/i],
  ['ensuite', /ensuite|en-suite|en suite|master bath|primary bath|main bath/i],
  ['bath', /bath|shower|washroom/i],
  ['nursery', /nursery|baby/i],
  ['bed-kid', /kid|child|boy|girl|teen|bunk|youth/i],
  ['bed-primary', /master|primary|main bed|owner/i],
  ['bed-guest', /guest/i],
  ['bed-guest', /bedroom|\bbed\b|sleep|dorm/i],   // a plain bedroom (inferProgram makes the storey's biggest the primary)
  ['playroom', /play ?room|play area|toy/i],
  ['library', /library|reading/i],
  ['media', /media|cinema|theatre|theater|\btv\b|screening/i],
  ['bar', /\bbar\b|wine|lounge bar|pub\b/i],
  ['studio', /studio|atelier|\bart\b|craft|music|workroom/i],
  ['study', /study|office|\bdesk\b|work ?room|den office|home office/i],
  ['kitchen-dining', /kitchen.*(dining|breakfast|eat)|(dining|breakfast).*kitchen|eat-in/i],
  ['living', /(living|lounge|family|great).*dining|dining.*(living|lounge)/i],   // a living-dining room: its seating
  ['kitchen', /kitchen|galley|pantry|scullery/i],
  ['dining', /dining|breakfast/i],
  ['den', /\bden\b|snug|games|rec room|family room/i],
  ['living', /living|great room|lounge|salon|sitting|parlou?r|drawing|family|hearth/i],
  ['foyer', /foyer|entry|entrance|vestibule|lobby|reception/i],
  ['hall', /hall|landing|corridor|passage|stair|gallery|mezzanine|atrium/i],
];
const BED = /bed|sleep|suite|dorm|loft room/i;

/**
 * A program read off a room's name, or null. `level` (the room's storey) lets a plain "Bedroom" become the primary
 * when it is the largest bedroom-by-name on its storey, and a guest room otherwise.
 */
export function inferProgram(room: any, level?: any): Program | null {
  const name = String((room && room.name) || '');
  const hit = NAMES.find(([, re]) => re.test(name));
  if (hit && !(hit[0] === 'bed-guest' && !/guest/i.test(name))) return hit[0];
  if (hit || BED.test(name)) {
    const area = (r: any) => (r && r.bounds ? r.bounds.w * r.bounds.d : 0);
    const plain = (r: any) => { const n = String(r.name || ''); const h = NAMES.find(([, re]) => re.test(n)); return BED.test(n) && (!h || (h[0] === 'bed-guest' && !/guest/i.test(n))); };
    const beds = ((level && level.rooms) || []).filter(plain);
    const biggest = beds.reduce((a: any, r: any) => (!a || area(r) > area(a) ? r : a), null);
    return !level || biggest === room ? 'bed-primary' : 'bed-guest';
  }
  return null;
}
