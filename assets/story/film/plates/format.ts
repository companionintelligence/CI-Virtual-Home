// The plates' frame sizes: pure arithmetic, no DOM, so the page module (index.ts), the script (scripts/film/plates/) and the tests all agree on them.
//
// A plate is a family film's 3D picture with NOTHING drawn over it, in the shape the CI-Common video-kit asks for (packages/video-kit/PLATES.md):
// landscape 16:9, portrait 9:16 and, optionally, square 1:1. The page's own hook (room-creator.html recordSize) knows only the sizes below, and its
// 1:1 is as wide as the 16:9 (a 1920 square at 1080), so a square plate asks for a smaller hook size: the kit's square is 1080, and a bigger
// plate would only cost GPU time. Owner: video-tool.
import type { FilmKey } from '../layout.js';

export type PlateKey = FilmKey | '1x1';
export const PLATE_KEYS: PlateKey[] = ['16x9', '9x16', '1x1'];
/** the kit's name for each (the keys of a beat's `plates`) */
export const KIT_NAME: Record<PlateKey, 'landscape' | 'portrait' | 'square'> = { '16x9': 'landscape', '9x16': 'portrait', '1x1': 'square' };
export const PLATE_OF_KIT: Record<string, PlateKey> = { landscape: '16x9', portrait: '9x16', square: '1x1' };
/** the page's aspect label for each */
export const ASPECT_LABEL: Record<PlateKey, '16:9' | '9:16' | '1:1'> = { '16x9': '16:9', '9x16': '9:16', '1x1': '1:1' };

/** the short edges (the film's `--res`) the page's recordSize knows: 360 (640 x 360) up to 2160 (3840 x 2160) */
export const PAGE_RES = [360, 540, 720, 1080, 1440, 2160] as const;
const LONG: Record<number, number> = { 360: 640, 540: 960, 720: 1280, 1080: 1920, 1440: 2560, 2160: 3840 };

export type PlateSize = { key: PlateKey; res: number; /** what the page's hook is asked for */ pageRes: number; w: number; h: number; aspect: number };

/** The hook size a square plate asks for: the 1080 film gets a 1280 square (the kit's canvas is 1080 and scales down), the 540 draft a 960 one. */
export function squarePageRes(res: number): number {
  if (!(PAGE_RES as readonly number[]).includes(res)) throw new Error(`--res must be one of ${PAGE_RES.join(', ')} (the page's recordSize), got ${res}`);
  return res >= 1080 ? 720 : res;
}

export function plateSize(key: PlateKey, res: number): PlateSize {
  if (!(PAGE_RES as readonly number[]).includes(res)) throw new Error(`--res must be one of ${PAGE_RES.join(', ')} (the page's recordSize), got ${res}`);
  if (key === '1x1') { const pageRes = squarePageRes(res), side = LONG[pageRes]; return { key, res, pageRes, w: side, h: side, aspect: 1 }; }
  const long = LONG[res];
  return key === '16x9' ? { key, res, pageRes: res, w: long, h: res, aspect: long / res } : { key, res, pageRes: res, w: res, h: long, aspect: res / long };
}
