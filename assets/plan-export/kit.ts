// <id>.plan.json's `kit` key. Owned by S1 (kit): edit only this file (index.ts beside it has the contract).
// The role colours and the cladding (kit-build.ts kitAnchors: anchors.kit).
// Return undefined to leave the key out of the file.
export const pick = (a: any): unknown => a.kit || null;
