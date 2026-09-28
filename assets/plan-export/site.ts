// <id>.plan.json's `site` key. Owned by S4 (site): edit only this file (index.ts beside it has the contract).
//   instances  the seeded site instances (site-build.ts: anchors.siteInstances) as world boxes with shape and colour
//              — what the isometric twin draws; S4's generators add outlines (shape 'poly': a bed, a pool's water,
//              a terrace, a patio) and one box per plant of a planting
//   solids     what stands on the lot (anchors.siteSolids: trunks and crowns, posts, fences and walls, hedges,
//              structures, water, terraces and their retaining faces) — for the shot planner's nav and QA (S5)
//   edges      bed and path outlines as built, curves resolved (anchors.siteEdges) — for the fleet's
//              axis-aligned-edge metric (scripts/fleet/site.mts, fleet-audit --built)
// scripts/generate_house_iso.py reads either this object or the bare instance list the key held before.
export const pick = (a: any): unknown => ({ instances: a.siteInstances || [], solids: a.siteSolids || [], edges: a.siteEdges || [] });
