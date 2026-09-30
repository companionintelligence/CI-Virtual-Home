// <id>.plan.json's `compose` key. Owned by S3 (compose): edit only this file (index.ts beside it has the contract).
// The composed rooms (assets/rooms-build.ts anchors.compose): per room its level, number, name, program, style and
// the items the composer added — what the isometric twin draws beside the authored items, and what the fleet metrics
// count (`fleet-audit --built`). Absent (the key left out) for a house that composes nothing.
export const pick = (a: any): unknown => (a && Array.isArray(a.compose) && a.compose.length ? { rooms: a.compose } : undefined);
