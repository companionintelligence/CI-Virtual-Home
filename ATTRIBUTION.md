# ATTRIBUTION

> Private & Confidential — Property of Lifescope Inc. Do not distribute.

Attribution and licence record for the owner's 3Dinside prop collection (22 packs, licensed to Lifescope Inc.). This is the only attribution file in the repository; [THIRD_PARTY.md](THIRD_PARTY.md) points here. The policy is in [CLAUDE.md](CLAUDE.md) (Licensing): the collection may be used only as baked derivatives, never as source packs, images or textures. Derivatives contain geometry and role-named flat colours only; no texture, image or UV set from any pack is used or redistributed, so any licence terms attached to pack textures are not exercised.

## About this file

This section fixes the format (version 1), so that the generator can reproduce the file byte for byte.

- Source: `models/packs.json` (the packs) and, once it exists, `models/manifest.json` (the shipped models). Until `scripts/bake/attribution.mts` lands this file is written by hand to exactly this format; after that it is generated and never hand-edited, and `scripts/test-no-third-party-bytes.mts` also checks that every manifest entry has a row below.
- Encoding: UTF-8, LF line endings, one final newline, no trailing spaces, no tabs.
- Order: `## About this file`, `## What was changed in the derivatives`, `## Summary` (one row per pack), `## Packs` (one `### N. <folder>` section per pack). Packs are in the order of `models/packs.json`; a pack's number is its 1-based position there.
- Each pack section is the same bullet list, in this order: Folder and archive, Archive sha256, Creator as found, Origin hints, Licence basis, Evidence, Decision, Source files committed; then `#### Shipped models`.
- Shipped models: the line `None yet.`, or a table `| Model id | Prop type | Source file and object | Changes |` with one row per manifest entry of that pack, sorted by id. The first cell is the id in backticks; that cell is what the test looks for. `Changes` uses only the names defined in the next section.
- Creator as found is only what a file inside the pack states. Origin hints (the handle of the itch.io page an archive was downloaded from, and that page's address) are unverified, never evidence of authorship or of a licence, and are not asserted; account names that appear in file paths inside a pack are machine user names, not creators, and are not recorded.

## What was changed in the derivatives

Nothing from a pack ships as received. A shipped model is a derivative of one source object (or a few) of one pack, made by `scripts/bake/` from `models/manifest.json` and committed as data in `assets/props/baked/<family>.ts`: geometry and role-named flat materials only. The operations, with the names the model tables use in `Changes`:

- `re-pivot`: the origin is moved (floor centre by default; wall back or ceiling for hung pieces) and the front axis is turned to +z.
- `uniform rescale`: one scale factor on all three axes, recorded per model, to bring the object to real-world size (the packs are not authored at real size).
- `decimate`: triangles removed, part by part, where a model is over its triangle budget.
- `nine-slice`: a part cut into bands so that one baked model can be stretched to a range of widths by stretching only the middle band.
- `role-colouring`: the pack's materials, palette cells and vertex colours are replaced by named roles (wood, fabric, metal and so on) whose flat colour the house's style supplies at runtime.
- `clean-up`: zero-area triangles and duplicate vertices removed, winding corrected, hard edges split, positions quantised to 16 bits.

Always dropped: textures, images and UV coordinates (no image, texture or UV of any pack ships), stored normals (recomputed at runtime), animation and rigs, lights and cameras, and the source file itself. No photographic or branded content ships: the packs' photo atlases and retail-product textures are never used.

## Summary

Decision says what the pack is for; the wave is the first bake wave that ships something from it (B1: in-place replacements of existing prop types, B2: new prop types placed by recipes, B3: later additions after an owner look). Shipped models counts the manifest entries of the pack.

| # | Pack | Creator as found | Licence basis | Decision | Shipped models |
|---|---|---|---|---|---|
| 1 | Cooking Assets | MilkAndBanana | cc0-in-pack (`License.txt`) | use, wave B3 (optional) | 0 |
| 2 | LowPolyAssetPack_Free | creator not stated in the pack; unverified hint: flakdeau19 | cc0-in-pack (`NOTES.txt`) | use, wave B2 | 0 |
| 3 | Realistic Car Pack - Nov 2018 | Quaternius | cc0-in-pack (`License.txt`) | use, wave B2 | 0 |
| 4 | All | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | use, wave B3 | 0 |
| 5 | Armchair | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | use, wave B1 | 0 |
| 6 | Chairs | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | use, wave B3 | 0 |
| 7 | Deds_others | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | use, wave B1 | 0 |
| 8 | Bath_Hygiene | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | use, wave B2 | 0 |
| 9 | Electronics_kitchen | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | use, wave B2 | 0 |
| 10 | Entertainment | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | reference only | 0 |
| 11 | Foods | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | reference only | 0 |
| 12 | Models | creator not stated in the pack; unverified hint: brokenvector | owner-asserted rights (Lifescope Inc.) | use, wave B2 | 0 |
| 13 | Models pack psx - new | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | reference only | 0 |
| 14 | pots & plants | creator not stated in the pack; unverified hint: valsekamerplant | owner-asserted rights (Lifescope Inc.) | reference only | 0 |
| 15 | Cocina1 | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | reference only | 0 |
| 16 | MOTEL | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | reference only | 0 |
| 17 | Survival | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | reference only, wave B3 (optional) | 0 |
| 18 | Vegetation | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | outdoor only | 0 |
| 19 | Trees | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | outdoor only | 0 |
| 20 | Arboles | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | outdoor only | 0 |
| 21 | Characters | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | not shipped | 0 |
| 22 | Exploration objects | creator not stated in the pack; unverified hint: Elbolilloduro | owner-asserted rights (Lifescope Inc.) | reference only | 0 |

## Packs

### 1. Cooking Assets

- Folder and archive: `Cooking Assets` in `Cooking Assets.zip` (14,677,599 bytes)
- Archive sha256: `69a5e695087bd6ce0d30f9a9c11fc7d6e333206cebed90c37d086f82f424487d`
- Creator as found: MilkAndBanana (`Cooking Assets/License.txt`)
- Origin hints (unverified, not asserted): download page: https://milkandbanana.itch.io/cooking-assets
- Licence basis: cc0-in-pack (a CC0 statement inside the pack, self-asserted by its author and not verified at the source)
- Evidence: `Cooking Assets/License.txt` in the archive (606 bytes, sha256 `cafd7e8f80e5c8dc9d3b0ec9362913cee25e5ac76a59ccfad6a4b5d4b31c50b8`), which reads:
  - "Created/distributed by MilkAndBanana"
  - "Creation date: 01/17/2022"
  - "License: (Creative Commons Zero, CC0)"
  - "http://creativecommons.org/publicdomain/zero/1.0/"
  - "This content is free to use in personal, educational and commercial projects."
  - "Support us by crediting MilkAndBanana (this is not mandatory)"
- Decision: use, wave B3 (optional). Dimension and silhouette spec for the procedural lathe tableware (plates, bowls, glasses, mugs, pans, boards, jars); wave B3 may bake non-round pieces. Knives, strainers, graters, standalone stoves and defective meshes are skipped.
- Source files committed: none

#### Shipped models

None yet.

### 2. LowPolyAssetPack_Free

- Folder and archive: `LowPolyAssetPack_Free` in `LowPolyAssetPack_Free.zip` (35,669,716 bytes)
- Archive sha256: `71fd5d74693f40511b939279e7821fecd1064da48721aa53b458d0843f31486e`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `flakdeau19`; download page: https://flakdeau19.itch.io/low-poly-asset-pack
- Licence basis: cc0-in-pack (a CC0 statement inside the pack, self-asserted by its author and not verified at the source)
- Evidence: `LowPolyAssetPack_Free/NOTES.txt` in the archive (665 bytes, sha256 `c58119e2c5f09163ed1b45f6573e0ce05ab96e8595c8ab6a5e0db22b8d42eaa9`), which reads:
  - "CC0 1.0 Universal"
  - Limit: The note names no author and no URL, and its texture paths point at a separate `LowPolyAssetPack_Full` pack; it is not taken to cover any file outside the free pack, and the `.blend1` and `_Full` leftovers are excluded.
- Decision: use, wave B2. Narrowly: baked retro media, workshop and garage pieces and a kids chair; wave B3 chairs, tables, carts and PC gear. Trade-dress look-alikes, venue and retail gear, `.blend1` and `_Full` leftovers are excluded.
- Source files committed: none

#### Shipped models

None yet.

### 3. Realistic Car Pack - Nov 2018

- Folder and archive: `Realistic Car Pack - Nov 2018` in `Realistic Car Pack - Nov 2018.zip` (2,774,430 bytes)
- Archive sha256: `af8f45d6e2135cc53870e5d0882cc41ca329bd87b9923b4773d471f161d2bdc7`
- Creator as found: Quaternius (`Realistic Car Pack - Nov 2018/License.txt`)
- Origin hints (unverified, not asserted): download page: https://quaternius.itch.io/lowpoly-cars
- Licence basis: cc0-in-pack (a CC0 statement inside the pack, self-asserted by its author and not verified at the source)
- Evidence: `Realistic Car Pack - Nov 2018/License.txt` in the archive (364 bytes, sha256 `83d8959f9fc56353ed571fbe2dc52e4bcd64508e2399501cd45ac2ce3df0bf8c`), which reads:
  - "LowPoly Models by @Quaternius"
  - "CC0 1.0 Universal (CC0 1.0)"
  - "Public Domain Dedication"
  - "https://creativecommons.org/publicdomain/zero/1.0/"
- Decision: use, wave B2. Garage only: three parked-car models.
- Source files committed: none

#### Shipped models

None yet.

### 4. All

- Folder and archive: `All` in `All.rar` (10,591,417 bytes)
- Archive sha256: `d9ba132a1ed096a3e022621eed86f65fa11370c575121d9c2b409e2f84a457d6`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-psx-3
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: use, wave B3. Only source of four tables (coffee, farmhouse, writing desk, side) in wave B3; every other mesh is taken from the smaller sibling pack, each geometry ingested once.
- Source files committed: none

#### Shipped models

None yet.

### 5. Armchair

- Folder and archive: `Armchair` in `Armchair.rar` (2,200,223 bytes)
- Archive sha256: `a45e161a8dc5845446a45426d1fb7560303e8a10919c1f506af66f76a2b22c91`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-psx-3
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: use, wave B1. chesterfield-sofa and lounge-chair; silhouette reference for the procedural sofas and armchairs.
- Source files committed: none

#### Shipped models

None yet.

### 6. Chairs

- Folder and archive: `Chairs` in `Chairs.rar` (1,843,967 bytes)
- Archive sha256: `3578d4614e8352d4dcd2bb8c259cbbd121ace62732de619bb5c9645692be3fd8`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-psx-3
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: use, wave B3. New dormant chair types in wave B3 and silhouette reference for dining chairs; no in-place replacement of the tuned dining chairs.
- Source files committed: none

#### Shipped models

None yet.

### 7. Deds_others

- Folder and archive: `Deds_others` in `Deds_others.rar` (2,351,497 bytes)
- Archive sha256: `58641bb0d109b40af41b7dcc403c38faaee2ec32410af2f56d78a4ab952ae0fb`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-psx-3
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: use, wave B1. Nightstand, bedside table and low dresser. Beds, pillows, lamps and plants are reference only; `Paintings.jpg` and `Plants.png` never.
- Source files committed: none

#### Shipped models

None yet.

### 8. Bath_Hygiene

- Folder and archive: `Bath_Hygiene` in `Bath_Hygiene.rar` (2,899,750 bytes)
- Archive sha256: `0bbf62794b066a7093fe82c16940dee187073f45726cbcb82fbe19b287d52a3d`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-psx-3
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: use, wave B2. Mop, mop bucket and broom; reference for roll holder, towel bar and ring dimensions. Fixtures stay procedural; branded consumables and `Hygiene.jpg` never.
- Source files committed: none

#### Shipped models

None yet.

### 9. Electronics_kitchen

- Folder and archive: `Electronics_kitchen` in `Electronics_kitchen.rar` (1,799,916 bytes)
- Archive sha256: `bec678515043abfa48a8596f0c32efddf903b412de2661a0a1b546a0bd7b24f5`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-psx-3
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: use, wave B2. Mini-fridge; optional French-door fridge variant in wave B3; flat panels with generated controls only, photo fronts never.
- Source files committed: none

#### Shipped models

None yet.

### 10. Entertainment

- Folder and archive: `Entertainment` in `Entertainment.rar` (1,329,094 bytes)
- Archive sha256: `3881d0fc292a1174bf113c82c9c876da1d1c4770f3a7a3d19ad9ae904d808ee3`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-psx-3
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: reference only. Reference, plus tiny optional pieces (media player, remote) for retro sets; books and magazine covers never; the TV stays the `wall-tv` page builder.
- Source files committed: none

#### Shipped models

None yet.

### 11. Foods

- Folder and archive: `Foods` in `Foods.rar` (4,245,506 bytes)
- Archive sha256: `ffb26d7e0cbdc94eb432b84fff6622dca29b04946c61beb9853ff692ae681a21`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-psx-3
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: reference only. Shape spec for generic jars, cans and boxes only; no branded atlas ever.
- Source files committed: none

#### Shipped models

None yet.

### 12. Models

- Folder and archive: `Models` in `Models.zip` (193,787 bytes)
- Archive sha256: `4852871f6f490134b887af372c9db58273a7b1db2c9763a1d8f9bc5eb19082de`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `brokenvector`; download page: https://brokenvector.itch.io/low-poly-storage-pack
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: use, wave B2. Luggage, bags, basket, boxes, crate, wheelie bin, locker and garage rack; dimension spec for bins, pallets and barrels; palette cells map to roles and no texture ships.
- Source files committed: none

#### Shipped models

None yet.

### 13. Models pack psx - new

- Folder and archive: `Models pack psx - new` in `Models pack psx - new.rar` (8,900,115 bytes)
- Archive sha256: `9ba031ed07fbb8c106ea608125b35be60c963549e103583e03b499d6890401d4`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-low-poly-estilo-psx-2
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: reference only. Reference and quarry only: dressing and arrangement priors; no geometry now; the manifest accepts any id later after a review.
- Source files committed: none

#### Shipped models

None yet.

### 14. pots & plants

- Folder and archive: `pots & plants` in `pots & plants.zip` (1,606,372 bytes)
- Archive sha256: `3d7d17f096c1d38939cdc3053ab70149de1b1a762baee716501c4a47c05798c2`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `valsekamerplant`; download page: https://valsekamerplant.itch.io/psx-style-house-plants-and-pots
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: reference only. Reference for plant and pot silhouettes feeding the procedural plants; pots are rebuilt as lathes; a card-to-blade bake only as a fallback.
- Source files committed: none

#### Shipped models

None yet.

### 15. Cocina1

- Folder and archive: `Cocina1` in `Cocina1.rar` (209,843,699 bytes)
- Archive sha256: `7b4cc5c4495aea076f4132e12c9ae699f4c469e29cb65484bad6cc744dc12bcb`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/models-cocina1
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: reference only. Reference only (rolled rims, lids, cookware proportions); its 2048 px PBR texture sets are not usable.
- Source files committed: none

#### Shipped models

None yet.

### 16. MOTEL

- Folder and archive: `MOTEL` in `MOTEL.unitypackage` (65,593,873 bytes)
- Archive sha256: `42c607fc9b3c3ec0a625fd993ee24807ee6c86bd79eb6acf1f1df7ed4e973c0e`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-psx-3
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: reference only. Reference only (arrangement and light look); its lightmaps and HDRI are never used.
- Source files committed: none

#### Shipped models

None yet.

### 17. Survival

- Folder and archive: `Survival` in `Survival.rar` (3,851,377 bytes)
- Archive sha256: `d8d800d0338986a64cc3ab653ce1096276fa428bbaa233817cc85204f03f5bb2`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/survival-psx
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: reference only, wave B3 (optional). Reference; optional baked lantern, mug and backpack for lake-cabin mudrooms in wave B3, colours to roles, after an owner look.
- Source files committed: none

#### Shipped models

None yet.

### 18. Vegetation

- Folder and archive: `Vegetation` in `Vegetation.zip` (44,661,067 bytes)
- Archive sha256: `54e658182c1837b0f34913da695554e29eba0fdb6a646721da0cf45f9f72c99f`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/vegetation
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: outdoor only. Outdoor and site only (log-shape reference for the procedural log store).
- Source files committed: none

#### Shipped models

None yet.

### 19. Trees

- Folder and archive: `Trees` in `Trees.rar` (2,912,316 bytes)
- Archive sha256: `976615e4e2214a0d9d4c50705a843d22234c2cd1905d21d249b8c6b15db863d0`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/trees-psx
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: outdoor only. Outdoor and site only.
- Source files committed: none

#### Shipped models

None yet.

### 20. Arboles

- Folder and archive: `Arboles` in `Arboles.rar` (47,304,570 bytes)
- Archive sha256: `9bdbc4ed09e39dc40f5e7daf02e2d473134cda4e8cae8abd5da6665e669f29ba`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/arboles
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: outdoor only. Outdoor and site only (its 13k-triangle bamboo is excluded).
- Source files committed: none

#### Shipped models

None yet.

### 21. Characters

- Folder and archive: `Characters` in `Characters.rar` (6,435,241 bytes)
- Archive sha256: `082c95682237b8db558d35037ebe962b54ae92768f016c3b3976efc652c64116`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/paquete-de-modelos-psx-3
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: not shipped. Not shipped. Review sheets use a procedural mannequin; the pack is only a dimensional cross-check in the bake unit-sanity test.
- Source files committed: none

#### Shipped models

None yet.

### 22. Exploration objects

- Folder and archive: `Exploration objects` in `Exploration objects.rar` (1,299,975 bytes)
- Archive sha256: `b983ace763f3815f2034cfe6cef62d6e8a9523225e7f37a9cad79260c575ff51`
- Creator as found: creator not stated in the pack: no licence, credit or readme file in the pack names one
- Origin hints (unverified, not asserted): page handle `Elbolilloduro`; download page: https://elbolilloduro.itch.io/exploration-objects
- Licence basis: owner-asserted rights (Lifescope Inc.); no licence or credit file was found in the pack
- Evidence: none in the pack
- Decision: reference only. Reference only (photo-textured gadgets); optional curio decor later if wanted.
- Source files committed: none

#### Shipped models

None yet.
