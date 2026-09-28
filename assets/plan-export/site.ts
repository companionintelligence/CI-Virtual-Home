// <id>.plan.json's `site` key. Owned by S4 (site): edit only this file (index.ts beside it has the contract).
// The seeded site instances (site-build.ts: anchors.siteInstances) as world boxes with shape and colour —
// what the isometric twin draws.
// Return undefined to leave the key out of the file.
export const pick = (a: any): unknown => a.siteInstances || [];
