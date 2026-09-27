// Playwright is a devDependency (package.json pins the exact build the goldens were blessed on), but
// render-house-shots.mts, build-house-plan.mts, build-prop-catalog.mts, export-core-gltf.mts,
// prop-sheet.mts, test-frame-hash.mts and test-goldens.mts still resolve it dynamically at runtime —
// node_modules first, then $PLAYWRIGHT_MODULE, then the newest ~/.npm/_npx copy — so a checkout without
// `pnpm install` can still run them. When node_modules has it, tsc uses its real types; this ambient
// fallback only keeps tsc from failing on a checkout that has not installed it. The loose `any` shape
// is enough for the couple of `.chromium.launch()`/page calls these scripts make.
//
// This file must stay a "script" (no top-level import/export) — the moment one is added, TS
// treats `declare module` here as augmenting an existing module rather than declaring a new
// ambient one, and 'playwright' stops resolving. house-globals.d.ts carries the declare-global
// block instead, since that one does need `export {}` to work.
declare module 'playwright' {
  export const chromium: any;
  export const firefox: any;
  export const webkit: any;
}
