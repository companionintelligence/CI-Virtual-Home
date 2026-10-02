// T-LAZY : XR costs nothing until it is asked for (N7). The first player load requests no assets/xr/session*.js; with ?no=xr
// nothing under assets/xr/ is requested and no Enter VR button or API exists; after the Enter VR tap exactly the XR modules load
// (and nothing from another origin); the first-load weight XR adds (entry.js) is under 2 KB gzip (entry.js + style.js, only in a browser where VR exists); the gallery page, which embeds
// no renderer, loads no platform.js and no XR code at all.
// @check-house skip — needs the built dist and a GPU browser; run pnpm run xr:test
import { defineCase } from '../xr-harness/lib.mts';
import { checkLazy, checkNoXrOnPages, WEIGHT_BUDGET_BYTES } from '../xr-harness/checks.mts';

export const lazy = defineCase({
  id: 'T-LAZY', timeoutMs: 600000, title: 'no assets/xr/session before the Enter VR tap, nothing with ?no=xr, only XR modules after the tap, first-load weight delta < 2 KB gzip',
  async run(t) {
    const tree = await t.tree('dist');
    t.needsProduct(tree);
    const r = await checkLazy(t, tree);
    t.note('firstLoadXr', r.firstLoadXr); t.note('afterTapXr', r.afterTapXr);
    t.note('deltaGzipBytes', r.deltaBytes); t.note('deltaBrotliBytes', r.deltaBrotli); t.note('budget', WEIGHT_BUDGET_BYTES);
    const pages = await checkNoXrOnPages(t, tree);
    t.note('galleryRequests', pages.gallery);
  },
});
