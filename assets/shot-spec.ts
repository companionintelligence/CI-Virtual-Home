// The plan's numbers (spline planner v2, §3.3 – §3.14), written down once. THREE-free, no logic beyond tables.
//
// WHY A MODULE OF ITS OWN. QA v2 (assets/shot-qa.ts) used to import the planner's own caps (SPEED_CAP, YAW_CAP, PITCH …) and add a
// tolerance, so a planner that loosened a cap (hero speed 0.9 against the plan's 0.4, hero yaw 30 against 15, a lens range widened
// to fit the film) loosened QA with it: the check measured the film against the numbers the planner had chosen, and could not
// fail. The planner now builds to these tables and QA holds the film to these tables, and neither imports the other's constants.
// Changing a number here changes the standard, in one visible place — and the fault-injection test (scripts/test-shot-qa.mts)
// states what each of them must catch.
//
// A DEVIATION from the plan is not a loosened number: it is named in DEVIATIONS with the reason (the plan is inconsistent with
// itself, or with the owner's brief, at that point) and the band QA holds the film to instead. There is no silent one.
//
// Owner: S5 (shot).

export const BEATS = ['establish', 'extStair', 'approach', 'threshold', 'reveal', 'route', 'stair', 'descend', 'roomReveal', 'hero', 'orbit', 'power'] as const;
export type Beat = typeof BEATS[number];

/** §3.4 cruise caps, m/s. A flight's (`stair`, `descend`, `extStair`) is along the flight in PLAN — the horizontal progress of the eye, which is what a person on a stair
 *  walks at (a flight that rises 3 m over a 4 m run is 5 m long: 1.2 m/s in plan is 1.5 along it). `threshold` is the beat's own cap away from the door
 *  plane; across the plane (± DOOR_ZONE_M) the cap is DOOR_PLANE_SPEED. `orbit` is angular, °/s: the plan has no orbit beat (the v1 orbit ran about 27°/s).
 *  `descend` is 1.0 (Completeness A2). */
export const SPEC_SPEED: Record<Beat, number> = { establish: 5.0, extStair: 1.2, approach: 2.5, threshold: 1.2, reveal: 0.8, route: 2.2, stair: 1.2, descend: 1.0, roomReveal: 0.9, hero: 0.4, orbit: 30, power: 0.1 };
/** §3.4: 0.9 m/s across the entry door's plane. The plan's zone is ±0.8 m, which at 0.9 m/s takes 1.8 s against a 0.8–1.0 s beat (Completeness D4); the zone is ±0.45 m, the other
 *  way D4 allows (the jambs are readable for 1.0 s at 0.9 m/s) */
export const DOOR_PLANE_SPEED = 0.9;
export const DOOR_ZONE_M = 0.45;
/** §3.4: an interior doorway is crossed at no more than this within ±0.6 m of its plane */
export const DOORWAY_SPEED = 1.2;
/** §3.5 yaw-rate caps, °/s, over a 0.1 s window. `extStair` has no plan value (30); `stair`/`descend` are the plan's "landing 60" (a straight flight turns far less); `orbit` has none (45: the
 *  eye circling the Core at its 30°/s cap turns the view by as much) */
export const SPEC_YAW: Record<Beat, number> = { establish: 12, extStair: 30, approach: 20, threshold: 30, reveal: 25, route: 45, stair: 60, descend: 60, roomReveal: 20, hero: 15, orbit: 45, power: 5 };
/** within this of a seam between two beats a cap is the looser of the two beats' (the speed and the yaw rate cannot step at the sample a beat changes): DEVIATIONS.seam */
export const SEAM_S = 0.35;
/** §3.14: the smoothed rate over a 0.1 s window is an error over 90°/s and a warning over 60 */
export const YAW_WARN = 60, YAW_ERROR = 90;
/** §3.5 pitch clamps, degrees. Inside the house the view is level within ±8° except on the stairs and in the finale (§3.5, "two-point perspective") */
export const SPEC_PITCH: Record<Beat, [number, number]> = { establish: [-28, -8], extStair: [-15, 8], approach: [-15, 5], threshold: [-12, 8], reveal: [-12, 8], route: [-12, 8], stair: [-10, 18], descend: [-24, -4], roomReveal: [-18, 12], hero: [-40, 5], orbit: [-40, 5], power: [-40, 5] };
/** an establishing look that is the dollhouse style's (the high three-quarter aerial) may tilt to this (§3.9 names the style, §3.5's range is for the others) */
export const DOLLHOUSE_PITCH_MIN = -40;
export const INTERIOR_LEVEL_DEG = 8;
/** §3.14 errors: the view never tilts outside this */
export const PITCH_ERROR: [number, number] = [-45, 30];

/** §3.5 lens (vertical fov, degrees): exterior 32 (30–35), interior 56 (55–60), hero 40 (38–44); the lens eases at ≤ 4°/s */
export const LENS_EXTERIOR: [number, number] = [30, 35], LENS_INTERIOR: [number, number] = [55, 60], LENS_HERO: [number, number] = [38, 44];
export const LENS_RATE = 4;
/** the widest lens the finale may use where the room is too tight to frame the Core at 44° (DEVIATIONS.finaleLens): inside the plan's own interior lens (55–60), and QA warns (`fov-range`) on every sample of the orbit and the press above 44° */
export const LENS_HERO_MAX = 56;
/** the lens a beat may use. A beat that carries the lens from one to the other (the door, the push-in) spans both. The establishing lens is the plan's 30–35, and QA holds the opening to it (a `fov-range`
 *  warning on every film that opens wider: DEVIATIONS.establishLens says why the planner does, and by how much) — it is not widened here to what the planner chose. */
export const SPEC_FOV: Record<Beat, [number, number]> = {
  establish: LENS_EXTERIOR, extStair: [LENS_EXTERIOR[0], LENS_INTERIOR[1]], approach: [LENS_EXTERIOR[0], LENS_INTERIOR[1]], threshold: [LENS_EXTERIOR[0], LENS_INTERIOR[1]],
  reveal: LENS_INTERIOR, route: LENS_INTERIOR, stair: LENS_INTERIOR, descend: LENS_INTERIOR,
  roomReveal: [LENS_HERO[0], LENS_INTERIOR[1]], hero: [LENS_HERO[0], LENS_INTERIOR[1]], orbit: LENS_HERO, power: LENS_HERO,
};

/** §3.5: the share of a beat's look that is its subject (the rest is the look-ahead point on the eye's own path, max(1.5 m, v × 1.2 s) ahead). The establishing move, the push-in, the
 *  orbit and the press look only at their subject. `extStair` has no plan row (it is the approach's); `descend` is the stair's. */
export const SPEC_LOOK_SUBJECT: Record<Beat, number> = { establish: 1, extStair: 0.7, approach: 0.7, threshold: 0.7, reveal: 0.6, route: 0.5, stair: 0.4, descend: 0.4, roomReveal: 0.7, hero: 1, orbit: 1, power: 1 };
/** §3.14 the median look error against the beat's subject: a warning over 25° (within a beat of half a second or more); the fleet target is 10° over the film */
export const LOOK_ERROR_WARN = 25, LOOK_ERROR_STRETCH = 45;

/** the floors a beat never goes under (§3.4) */
export const BEAT_FLOOR: Partial<Record<Beat, number>> = { threshold: 0.8, stair: 1.6, descend: 1.6, power: 1.8, hero: 0.8 };

/** §3.3 beat budgets, seconds, for a film of one, two and three storeys (`extStair` for an entry on an upper level; the stair beats are per flight). The plan has no orbit
 *  beat: the owner's finale (door → Core ending in an orbit of 90° or more, the v1 orbit) is budgeted here at ORBIT_S, the sweep at 27°/s. */
export const ORBIT_S = 3.5;
export const BUDGET: Record<Beat, [number, number, number]> = {
  establish: [1.8, 1.6, 1.5], extStair: [1.6, 1.6, 1.6], approach: [1.3, 1.1, 1.0], threshold: [1.0, 0.9, 0.8], reveal: [1.4, 1.0, 0.9], route: [2.4, 1.4, 1.0],
  stair: [0, 1.9, 1.8], descend: [0, 1.9, 1.8], roomReveal: [1.1, 0.9, 0.8], hero: [1.1, 1.0, 1.0], orbit: [ORBIT_S, ORBIT_S, ORBIT_S], power: [1.9, 2.2, 2.3],
};
/** §3.0 / §3.3: the film is 12 s (13 s for three storeys) before the orbit */
export const PLAN_FILM_S = [12, 12, 13];

/** the window of seconds QA holds a beat to: from its floor (or 0.4 s) to twice its §3.3 budget for a film of `storeys` storeys. The beats whose time is the length of a path the
 *  plan does not fix (the establishing move to a house of any width, the orbit round the Core, the walk and the flights) are held by their speed caps and by the film's length instead */
export function beatWindow(b: Beat, storeys: number): [number, number] | null {
  if (b === 'establish' || b === 'route' || b === 'orbit' || b === 'stair' || b === 'descend' || b === 'extStair') return null;
  const budget = BUDGET[b][Math.min(2, Math.max(0, storeys - 1))];
  return [BEAT_FLOOR[b] || 0.4, Math.max(2 * budget, (BEAT_FLOOR[b] || 0.4) + 0.5)];
}

/** What a film of this house may run, seconds: the plan's 12 s (13 for three storeys) plus the orbit (ORBIT_S), plus the time the house's own distances need at the pace the plan's caps allow in practice —
 *  §3.3's beats are budgeted for a walk of about 5 m (its route beat is 2.4 s at the 2.2 m/s cap), an establishing move of about 6 m (1.8 s at the 5 m/s cap, accelerating) and an approach of about 3.5 m (1.3 s at
 *  2.5), and a film of a house whose door is 12 m from its Core cannot be 12 s long without breaking the caps. Each metre beyond those costs its beat's pace: 4.0 m/s outside, 2.0 on the approach, 1.6 on the walk
 *  (the 2.2 cap less its doorways, its corners and its starts), 1.2 on a flight in plan; an orbit of more than 95° costs 27°/s of the rest; an exterior stair 0.6 s (§3.3). QA's `film-length` warns over BUDGET_SLACK of it. */
export const BUDGET_SLACK = 1.15;
export function filmBudget(m: { storeys: number; ext: boolean; establishM: number; approachM: number; walkM: number; flightPlanM: number; orbitDeg: number }) {
  const base = PLAN_FILM_S[Math.min(2, Math.max(0, m.storeys - 1))] + ORBIT_S + (m.ext ? 0.6 : 0);
  const extra = { establish: Math.max(0, m.establishM - 6) / 4.0, approach: Math.max(0, m.approachM - 3.5) / 2.0, walk: Math.max(0, m.walkM - 5) / 1.6, flights: Math.max(0, m.flightPlanM - (m.storeys > 1 ? 4.5 * (m.storeys - 1) : 0)) / 1.2, orbit: Math.max(0, m.orbitDeg - 95) / 27 };
  const total = base + extra.establish + extra.approach + extra.walk + extra.flights + extra.orbit;
  return { total, base, extra };
}

/** §3.3 / §3.14 outside time (the establishing move, the approach and half the door), as a share of the film: the target, and the error line */
export const OUTSIDE_TARGET = 0.30, OUTSIDE_ERROR = 0.35;

/** things the plan states about the outside that QA holds the film to */
export const SPEC_ESTABLISH = { eyeHeight: [5, 9] as [number, number], marginShare: 0.08, sky: [0.15, 0.35] as [number, number], firstSecondM: 0.5, occluderRadiusM: 6 };

/** the deviations from the plan this planner makes, each with the reason, and what QA does about it. A deviation is not a loosened number: QA holds the film to the plan's value where it can (a `fov-range`,
 *  `film-length`, `establish-crop` … warning that says by how much, on every film that deviates), and where the plan cannot be held to without breaking another of its numbers the allowance is named here and
 *  measured (`metrics.overCapS`, the fleet's `establish-lens`, `finale-lens` and `film-length-plan` lines). There is no silent one. */
export const DEVIATIONS: Record<string, { plan: string; here: string; why: string }> = {
  establishLens: { plan: '§3.5 exterior lens 30–35°', here: '40–49° on the first frame (13 of 30 at 40°, none under); every film is a `fov-range` warning on its establishing beat', why: '§3.9 asks for the whole footprint and roof inside the frame with 8 % margins, §3.3 for 1.8 s of it: at 32° a 20 m house needs an eye 21 m out, a move of 17 m — 3.5 s at the 5 m/s cap, and the lens then has 4.7 s to reach the interior\'s 55° at the plan\'s 4°/s (a 38° opening cannot: QA `fov-rate`); the narrowest of 40, 42, 46 and 49° at which the house fits inside the move the outside\'s time allows, and is scored 2.5 points a degree over 35, is used' },
  finaleLens: { plan: '§3.5 hero lens 38–44° with the Core 18–25 % of the frame (§3.11) on a ring 0.75–1.6 m out', here: '38–44° wherever the Core frames inside ~24 % of the frame at 44° from a radius with a sweep of 90° or more; up to LENS_HERO_MAX (56°) where the room is too tight for that (each a `fov-range` warning on the orbit and the press; the fleet\'s `finale-lens` line counts them)', why: 'a 9 cm slab seen from 1 m fills 23–28 % of the frame at 44°; the owner\'s brief is an orbit of 90° or more, and in a tight room the sweep of 90° is at 0.85–0.95 m, not at the radius the lens wants. The radius choice trades them: a sweep of 90° is worth 150 points, a lens degree over 44° costs 10' },
  orbit: { plan: '§3.3 has no orbit beat', here: 'a sweep of 90° or more at ≤ 30°/s (26°/s on average), budgeted ORBIT_S', why: 'the owner\'s finale (door → Core ending in an orbit round it): the v1 orbit, kept' },
  filmLength: { plan: '§3.0: 12 s (13 for three storeys)', here: '17–36 s, 25 s the median; QA `film-length` holds it to filmBudget()', why: 'the plan\'s budgets are for a walk of about 5 m, an opening of about 6 m and no orbit; a door 6–20 m from its Core cannot be walked in 2.4 s at 2.2 m/s (completeness D6: a layout rule, the hero viewpoint within ~3 m of the Core room\'s door)' },
  seam: { plan: '§3.4 / §3.5: every cap holds throughout its beat', here: 'within SEAM_S (0.35 s) of a seam QA holds the film to the looser of the two beats\' caps (speed, yaw, pitch); metrics.overCapS reports how long the film is over a beat\'s own cap, seams included', why: 'the speed and the view\'s rate cannot step at the sample a beat changes (an infinite acceleration): the handover is eased over a few tenths of a second, and the plan has no number for it' },
  doorZone: { plan: '§3.4 threshold: 0.9 m/s across the door\'s plane (±0.8 m)', here: '0.9 m/s at the plane, and QA\'s `door-zone-speed` holds ±0.45 m of it (DOOR_ZONE_M); the threshold beat\'s own cap is 1.2 m/s (the plan\'s doorway number) away from the plane', why: 'completeness D4: ±0.8 m at 0.9 m/s takes 1.8 s against a threshold beat of 0.8–1.0 s; the zone is the other way D4 allows' },
  filmBudget: { plan: '§3.0 / §3.3: 12 s (13 for three storeys)', here: 'filmBudget(): the plan\'s 12 s, the orbit (ORBIT_S) and this house\'s distances at 4.0 / 2.0 / 1.6 / 1.2 m/s — QA\'s `film-length` and the fleet\'s `film-length` hold the film to it; the fleet\'s `film-length-plan` reports it against the plan\'s own 12 s + the orbit', why: 'the paces are measured from the films\' own beats (the plan gives none): a longer walk or a farther opening earns more budget, so the budget alone cannot say the film is as short as the plan wants — the plan\'s own figure is printed beside it' },
};
