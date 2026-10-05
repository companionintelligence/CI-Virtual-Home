// The camera addendum (RIG fixup). THREE-free and pure, like cameras.mts.
//
// Three of the frozen BEFORE's corner frames are obstructed, and the frozen set must not change (the BEFORE is a hashed record, the
// 92 frames and their cameras are the evidence every stream is measured against). So the alternatives are an ADDENDUM: a second,
// separate set with its own manifest (test/review/baselines/before-addendum.manifest.json) and its own BEFORE frames, captured at
// baseline/stage0-green from the same product code as the frozen set, never replacing a frozen frame:
//
//   riverbend-foyer           NW  stair rail and newel fill the foreground; the room is hardly seen
//   aurora-primary-bedroom    SE  the eye stands behind a door leaf
//   aurora-hall               NW  the eye looks straight into a wall
//
// The alternative is the same corner formula (cornerCam) from another corner of the same room: NE or SW. CANDIDATES holds both for
// each room, so a capture can show them side by side; ADDENDUM names the one chosen for each room after looking at the BEFORE
// frames (the reason is recorded next to it). A stream that shows one of the three rooms reads the addendum frame next to the frozen
// one; the frozen frame stays in the set, obstructed as it is, so the sheets and metrics of the 92 are comparable across streams.
import { shotFile, shotId, type Corner, type Shot } from './cameras.mts';

export interface AddendumRoom { room: string; house: string; replaces: Corner; corner: Corner; why: string }
export const OBSTRUCTED: Array<{ room: string; house: string; corner: Corner; what: string }> = [
  { room: 'riverbend-foyer', house: 'riverbend', corner: 'NW', what: 'stair rail and newel fill the foreground' },
  { room: 'aurora-primary-bedroom', house: 'aurora', corner: 'SE', what: 'the eye stands behind a door leaf' },
  { room: 'aurora-hall', house: 'aurora', corner: 'NW', what: 'the eye looks straight into a wall' },
];
export const ALT_CORNERS: Corner[] = ['NE', 'SW'];
export const ADDENDUM_SET = 'before-addendum';

/** the chosen alternative for each obstructed frame (filled in after looking at the candidates' BEFORE frames) */
export const ADDENDUM: AddendumRoom[] = [
  { room: 'riverbend-foyer', house: 'riverbend', replaces: 'NW', corner: 'SW', why: 'looks along the stair with the front door, the doorways to the family room and the console in view; NE also clears the rail but fills a third of the frame with the stair stringer' },
  { room: 'aurora-primary-bedroom', house: 'aurora', replaces: 'SE', corner: 'NE', why: 'the window wall: dresser, curtains and balcony door, the bed at the edge of the frame; SW would repeat the frozen NW frame (the headboard wall) from nearly the same side' },
  { room: 'aurora-hall', house: 'aurora', replaces: 'NW', corner: 'SW', why: 'a window and the bath doorway break the long run, with the console at the far end; the room is a corridor, so every corner looks down the same axis and NE puts the spiral stair in front of the lens. This one is a better frame, not a good one' },
];

const shotsOf = (rows: Array<{ room: string; house: string; corner: Corner }>): Shot[] =>
  rows.map(r => ({ id: shotId(r.room, r.corner, 'day'), file: shotFile(r.room, r.corner, 'day'), room: r.room, house: r.house, tod: 'day', corner: r.corner, kind: 'eye' }));
/** every alternative corner of the three rooms (6 frames), for choosing */
export const candidateShots = (): Shot[] => shotsOf(OBSTRUCTED.flatMap(o => ALT_CORNERS.map(corner => ({ room: o.room, house: o.house, corner }))));
/** the chosen alternatives (day only): the addendum's frames */
export const addendumShots = (): Shot[] => shotsOf(ADDENDUM);
