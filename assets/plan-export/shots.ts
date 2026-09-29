// <id>.plan.json's `shots` key. Owned by S5 (shot): edit only this file (index.ts beside it has the contract).
// The ShotWorld planner v2 plans on (assets/shot-world.ts digestWorld: the storeys, the entry, the Core's exact box,
// the flights of stairs, and the built house's solids as boxes), so a Node harness can bake the page's track from the
// plan alone (scripts/test-shot-planner.mts). anchors.shotWorld is a getter made on first read (shot-planner-v1.ts).
// Return undefined to leave the key out of the file.
export const pick = (a: any): unknown => (a && a.shotWorld ? { world: a.shotWorld } : undefined);
