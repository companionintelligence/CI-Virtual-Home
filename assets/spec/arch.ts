// HouseSpec fragment for S2 (architecture): the fields this stream adds, one interface per part of
// the spec; assets/spec/index.ts merges every fragment into HouseSpec. Every field is OPTIONAL (plan §2.0: a house
// that uses none of them renders exactly as it does today). Owned by S2: edit only this file.
//
// Planned here (plan contract):
//   - rooms[].floor | walls | ceiling: {kind: …, "double"} (C3: ceiling is always an object) | floorOffset
//   - footprint[i].material | color; facade: [...]; facade.bands; levels[].plinth | knee; levels[].rects[].h
//   - roofs[].finish | trim | gutters | gableWindow | ends | gableGlass | skylights | planted | gableCladding; dormers[].style | side; chimney: {...}
//   - openings[].shutters | box | head | surround | blinds; canopy
//   - entry.stoop; features: [...]; partitions[].style; stairs[].type L | U | closed, turn, landing, …
//   - levels[].stairs as an array (Completeness A2)

export interface ArchSpec {}
export interface ArchLot {}
export interface ArchPalette {}
export interface ArchLevel {}
export interface ArchOpening {}
export interface ArchPartition {}
export interface ArchStairs {}
export interface ArchBalustrade {}
export interface ArchRoom {}
export interface ArchRoomItem {}
export interface ArchRoof {}
export interface ArchSiteItem {}
export interface ArchHero {}
export interface ArchEntry {}
export interface ArchShot {}
