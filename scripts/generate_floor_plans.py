#!/usr/bin/env python3
"""
generate_floor_plans.py — HouseSpec v1 → CAD blueprint floor-plan sheets

Companion Intelligence — The Sims Architectural Archive

Reads every HouseSpec v1 file in content/houses/*.json (schema:
reference/HOUSE-SPEC.md) and, for each level of each spec, renders a
blueprint-style SVG sheet

    scenes/floorplans/fp-<id>-l<n>.svg   (n = 1-based level index)

plus a 1600x1000 PNG twin via `rsvg-convert` (the same tool that produced the
original sheets), then writes scenes/floorplans/floorplans.json for an interactive viewer; its
paths ("scenes/floorplans/…") are relative to the repo root.

Everything on a sheet is derived from the spec — perimeter walls come from the
union of the level's footprint rects (same rasterisation algorithm as
validate-house-spec.mts), openings sit on the perimeter edge that contains their
`at` coordinate, partitions carry their door gaps, stairs/voids/balustrades/rooms/
furniture are drawn from the catalog footprints.  Never hand-edit the outputs;
edit the spec and re-run.

Usage:
  pnpm run floorplans                                     # all specs (= python3 scripts/generate_floor_plans.py; any cwd)
  python3 scripts/generate_floor_plans.py --only aurora   # one spec (JSON still lists all)
  python3 scripts/generate_floor_plans.py --dry-run       # report only, write nothing
  python3 scripts/generate_floor_plans.py --no-png        # skip rsvg-convert
  python3 scripts/generate_floor_plans.py --fit lot       # always fit the whole lot (auto = lot when
                                                          #   legible, else zoom to building + site)
  python3 scripts/generate_floor_plans.py --specs DIR --out DIR   # specs (and their <id>.plan.json) from DIR, sheets to DIR
                                                          #   (scripts/test-twins.mts proves the twin on the fixtures)

The `arch` key of <id>.plan.json (assets/plan-export/arch.ts: what the three.js builder resolved) carries what the twin
cannot derive — L/U flights, porches, bays, balconies, chimney stacks, the stoop — so run `pnpm run plans` before this.
"""

import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # the repo root
HOUSES_DIR = ROOT / "content" / "houses"
FLOORPLAN_DIR = ROOT / "scenes" / "floorplans"
SVG_REL_DIR = "scenes/floorplans"          # path prefix as seen from the repo root

SHEET_W, SHEET_H = 1600, 1000
PLAN_BOX = (100.0, 48.0, 1500.0, 830.0)   # usable plan area (x0, y0, x1, y1) — leaves room for the footer
SQFT_PER_SQM = 10.764
MIN_LEGIBLE_SCALE = 36.0   # px per metre; below this room tags stop being readable → --fit auto zooms to content
MAX_SCALE = 70.0           # px per metre cap for the content fit (old hand-drawn sheets were ≈52 px/m)
VIEW_PAD = 2.0             # metres of breathing room around the content bbox (room for dimension lines)

# Builds that existed before the spec-driven rewrite.  They keep their position at
# the head of floorplans.json, and if a spec is missing for one of them its previous
# JSON entry is carried over verbatim so a viewer reading floorplans.json keeps working.
LEGACY_IDS = ["seraphine", "lakecabin", "mesamariposa", "valleyview", "familyhome"]

# Palette (matches the original blueprint sheets)
C_LINE = "#72ddd4"        # exterior wall / primary line colour
C_INT = "#4facbe"         # interior wall line colour
C_WALL_FILL = "#0e2c40"
C_INT_FILL = "#0a2233"
C_BG = "#06121e"
C_GOLD = "#c89d55"
C_AMBER = "#ffb900"
C_WHITE = "#ffffff"
C_MUTED = "#a4c2db"
FONT = "'Space Grotesk', sans-serif"
MONO = "'Space Grotesk', monospace"

# Furniture catalog footprints (w × d metres) — HOUSE-SPEC.md "Item catalog"
ITEM_FOOTPRINTS = {
    "sectional": (3.2, 2.0), "club-chair": (0.9, 0.9), "coffee-table": (1.2, 0.6),
    "octagonal-table": (1.2, 1.2), "dining-set": (2.0, 0.95), "dining-table": (2.1, 1.0),
    "kitchen-island": (2.4, 0.9), "kitchen-cabinetry": (3.6, 0.65), "media-credenza": (1.8, 0.45),
    "wall-tv": (1.6, 0.1), "fireplace": (1.6, 0.5), "area-rug": (3.2, 2.2),
    "sun-lounger": (0.7, 2.0), "bench": (1.8, 0.5), "platform-bed": (2.2, 2.3),
    "wardrobe": (2.2, 0.6), "crib": (1.3, 0.7), "ensuite": (2.4, 2.0), "bookshelf": (1.2, 0.35),
    "walnut-desk": (1.6, 0.8), "task-chair": (0.6, 0.6), "halo-lamp": (0.4, 0.4),
    "telescope": (0.6, 0.6), "soccer-goal": (1.8, 0.6), "low-wall": (1.2, 0.2), "column": (0.35, 0.35),
    # "on desk / credenza" items — token footprints so they still show as outlines
    "curved-monitor": (0.8, 0.15), "chalk-tower": (0.2, 0.2), "charcoal-tower": (0.2, 0.2),
    "strix-mini": (0.2, 0.2), "speakers": (0.15, 0.2),
}
ITEM_RADII = {"circular-rug": 2.0, "concentric-rug": 1.6}
PLANT_RADII = {"fiddle-leaf": 0.35, "monstera": 0.35, "bonsai": 0.2, "bamboo": 0.3, "cactus-group": 0.4}
ITEM_SHORT_LABEL = {
    "platform-bed": "BED", "sectional": "SOFA", "kitchen-island": "ISLAND", "kitchen-cabinetry": "KITCHEN",
    "dining-set": "DINING", "dining-table": "DINING", "walnut-desk": "DESK", "ensuite": "ENSUITE",
    "wardrobe": "WARDROBE", "area-rug": "RUG", "media-credenza": "CREDENZA", "fireplace": "FIRE",
    "bookshelf": "BOOKS", "crib": "CRIB", "sun-lounger": "LOUNGER", "bench": "BENCH",
    "octagonal-table": "TABLE", "coffee-table": "TABLE", "wall-tv": "TV", "telescope": "SCOPE",
}
DEFAULT_FOOTPRINT = (0.6, 0.6)

STAIR_DIMS = {"timber": (1.1, 3.36), "colonial": (1.3, 3.36)}   # width × run (room-creator defaults)
STAIR_STEPS = 14
SPIRAL_RADIUS = 0.95
FLOOR_PATTERN = {
    "oak": "woodParquet", "terrazzo": "stoneTile", "phthalo-terrazzo": "stoneTile", "marble": "stoneTile",
    "concrete": "stoneTile", "tile": "stoneTile", "deck": "deckBoards", "grass": "turfPattern", "lawn": "turfPattern",
}

_unrendered = set()   # spec features we met but could not draw (reported at the end)


# -----------------------------------------------------------------------------
# small utilities
# -----------------------------------------------------------------------------
def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def f(v):
    """compact number formatting for SVG attributes"""
    s = f"{v:.2f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


def pretty_item(t):
    words = []
    for w in str(t).split("-"):
        words.append(w.upper() if w in ("tv", "ai", "ci") else w.capitalize())
    return " ".join(words)


def imperial(m):
    total_in = m * 39.3701
    ft = int(total_in // 12)
    inch = int(round(total_in - ft * 12))
    if inch == 12:
        ft, inch = ft + 1, 0
    return f"{ft}' - {inch}\" [{m:.1f}m]"


def elev_str(y):
    if abs(y) < 1e-9:
        return "±0.00m"
    return f"{y:+.2f}m"


def rot_vec(rot_deg):
    """world-space (x,z) direction of local +Z (the 'facing' axis) for a rotation, CCW seen from above"""
    t = math.radians(rot_deg or 0)
    return math.sin(t), math.cos(t)


def local_to_world(cx, cz, lx, lz, rot_deg):
    """rotate a local offset (lx, lz) by rot (Three.js rotation.y convention) and translate"""
    t = math.radians(rot_deg or 0)
    c, s = math.cos(t), math.sin(t)
    return cx + lx * c + lz * s, cz - lx * s + lz * c


# -----------------------------------------------------------------------------
# footprint union → perimeter edges (port of perimeterEdges() in validate-house-spec.mts)
# -----------------------------------------------------------------------------
def rasterise(rects, cell=0.1):
    min_x = min(r["x"] for r in rects)
    max_x = max(r["x"] + r["w"] for r in rects)
    min_z = min(r["z"] for r in rects)
    max_z = max(r["z"] + r["d"] for r in rects)
    nx = int(round((max_x - min_x) / cell))
    nz = int(round((max_z - min_z) / cell))
    filled = set()
    for r in rects:
        # cells whose centre lies inside the rect
        i0 = max(0, math.ceil((r["x"] - min_x) / cell - 0.5 - 1e-9))
        i1 = min(nx - 1, math.floor((r["x"] + r["w"] - min_x) / cell - 0.5 + 1e-9))
        k0 = max(0, math.ceil((r["z"] - min_z) / cell - 0.5 - 1e-9))
        k1 = min(nz - 1, math.floor((r["z"] + r["d"] - min_z) / cell - 0.5 + 1e-9))
        for i in range(i0, i1 + 1):
            for k in range(k0, k1 + 1):
                filled.add((i, k))
    return min_x, min_z, nx, nz, filled


def perimeter_edges(rects, cell=0.1):
    """[{side, a:(x,z), b:(x,z), length}] — merged boundary runs of the rect union, per side"""
    min_x, min_z, nx, nz, filled = rasterise(rects, cell)
    edges = []
    for (i, k) in filled:
        x0, z0 = min_x + i * cell, min_z + k * cell
        x1, z1 = x0 + cell, z0 + cell
        if (i, k + 1) not in filled:
            edges.append(("S", (x0, z1), (x1, z1)))
        if (i, k - 1) not in filled:
            edges.append(("N", (x0, z0), (x1, z0)))
        if (i + 1, k) not in filled:
            edges.append(("E", (x1, z0), (x1, z1)))
        if (i - 1, k) not in filled:
            edges.append(("W", (x0, z0), (x0, z1)))
    merged = []
    for side in ("S", "N", "E", "W"):
        horiz = side in ("S", "N")
        runs = [e for e in edges if e[0] == side]
        runs.sort(key=(lambda e: (round(e[1][1], 6), round(e[1][0], 6))) if horiz
                  else (lambda e: (round(e[1][0], 6), round(e[1][1], 6))))
        cur = None
        for _, a, b in runs:
            if cur is not None:
                same_line = abs((cur["a"][1] - a[1]) if horiz else (cur["a"][0] - a[0])) < 1e-6
                contiguous = abs((cur["b"][0] - a[0]) if horiz else (cur["b"][1] - a[1])) < 1e-6
                if same_line and contiguous:
                    cur["b"] = b
                    continue
                merged.append(cur)
            cur = {"side": side, "a": a, "b": b}
        if cur is not None:
            merged.append(cur)
    for e in merged:
        # snap away rasterisation noise
        e["a"] = (round(e["a"][0], 4), round(e["a"][1], 4))
        e["b"] = (round(e["b"][0], 4), round(e["b"][1], 4))
        e["length"] = math.hypot(e["b"][0] - e["a"][0], e["b"][1] - e["a"][1])
    return merged


def union_area(rects, cell=0.1):
    return len(rasterise(rects, cell)[4]) * cell * cell


def find_edge(edges, side, at, line=None):
    """the perimeter edge on `side` holding `at`; `line` (an opening's `edgeZ`: z for S/N, x for E/W) picks between
    two same-side edges that both hold it"""
    horiz = side in ("S", "N")
    first = None
    for e in edges:
        if e["side"] != side:
            continue
        lo, hi = (e["a"][0], e["b"][0]) if horiz else (e["a"][1], e["b"][1])
        if lo - 1e-6 <= at <= hi + 1e-6:
            if line is None:
                return e
            if abs((e["a"][1] if horiz else e["a"][0]) - line) < 0.02:
                return e
            first = first or e
    return first


def footprint_bbox(rects):
    return (min(r["x"] for r in rects), min(r["z"] for r in rects),
            max(r["x"] + r["w"] for r in rects), max(r["z"] + r["d"] for r in rects))


# -----------------------------------------------------------------------------
# sheet transform: world metres (x east, z south) → sheet pixels (x right, y DOWN)
# -----------------------------------------------------------------------------
class Sheet:
    def __init__(self, x0, z0, x1, z1, max_scale=None):
        bx0, by0, bx1, by1 = PLAN_BOX
        self.s = min((bx1 - bx0) / max(x1 - x0, 1e-6), (by1 - by0) / max(z1 - z0, 1e-6))
        if max_scale:
            self.s = min(self.s, max_scale)
        self.ox = (bx0 + bx1) / 2 - (x0 + x1) / 2 * self.s
        self.oy = (by0 + by1) / 2 - (z0 + z1) / 2 * self.s

    def px(self, x):
        return self.ox + x * self.s

    def py(self, z):
        return self.oy + z * self.s

    def pt(self, x, z):
        return self.px(x), self.py(z)

    def rect(self, r):
        """world rect → (x, y, w, h) px"""
        return self.px(r["x"]), self.py(r["z"]), r["w"] * self.s, r["d"] * self.s

    def ext_t(self):
        return max(10.0, 0.3 * self.s)     # exterior wall thickness px

    def int_t(self):
        return max(6.0, 0.15 * self.s)     # interior wall thickness px


class Frame:
    """local metre frame → page px.  origin = page px of local (0,0);
    u_hat / v_hat = page-space unit vectors of local +u / +v."""

    def __init__(self, origin, u_hat, v_hat, s):
        self.o, self.u, self.v, self.s = origin, u_hat, v_hat, s
        self.det = u_hat[0] * v_hat[1] - u_hat[1] * v_hat[0]

    def pt(self, u, v, du_px=0.0, dv_px=0.0):
        U = u * self.s + du_px
        V = v * self.s + dv_px
        return (self.o[0] + U * self.u[0] + V * self.v[0],
                self.o[1] + U * self.u[1] + V * self.v[1])

    def poly(self, pts):
        return " ".join(f"{f(x)},{f(y)}" for x, y in (self.pt(u, v) for u, v in pts))

    def line(self, u0, v0, u1, v1, du0=0.0, dv0=0.0, du1=0.0, dv1=0.0, **kw):
        x0, y0 = self.pt(u0, v0, du0, dv0)
        x1, y1 = self.pt(u1, v1, du1, dv1)
        return svg_line(x0, y0, x1, y1, **kw)

    def sweep(self, base):
        """arc sweep flag for an arc defined in the local frame (flips under reflection)"""
        return base if self.det > 0 else 1 - base


# -----------------------------------------------------------------------------
# SVG primitives (blueprint style)
# -----------------------------------------------------------------------------
def svg_line(x0, y0, x1, y1, stroke=C_LINE, width=1.2, dash=None, cap=None, opacity=None):
    extra = ""
    if dash:
        extra += f' stroke-dasharray="{dash}"'
    if cap:
        extra += f' stroke-linecap="{cap}"'
    if opacity is not None:
        extra += f' opacity="{opacity}"'
    return f'<line x1="{f(x0)}" y1="{f(y0)}" x2="{f(x1)}" y2="{f(y1)}" stroke="{stroke}" stroke-width="{f(width)}"{extra}/>'


def svg_text(x, y, text, size=10, fill=C_LINE, weight=600, anchor="middle", mono=True, extra=""):
    fam = MONO if mono else FONT
    return (f'<text x="{f(x)}" y="{f(y)}" fill="{fill}" font-family="{fam}" font-size="{size}" '
            f'font-weight="{weight}" text-anchor="{anchor}"{extra}>{esc(text)}</text>')


def svg_header(width=SHEET_W, height=SHEET_H, title="Architectural Floor Plan"):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%" class="cad-floorplan-svg">
  <title>{esc(title)}</title>
  <defs>
    <!-- Blueprint Grid -->
    <pattern id="cadGridSmall" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(114, 221, 212, 0.05)" stroke-width="0.75"/>
    </pattern>
    <pattern id="cadGridLarge" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#cadGridSmall)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(114, 221, 212, 0.12)" stroke-width="1.2"/>
    </pattern>

    <!-- Wall / Void Hatch Pattern -->
    <pattern id="wallHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(114, 221, 212, 0.35)" stroke-width="1.5" />
    </pattern>

    <!-- Wood Floor Pattern -->
    <pattern id="woodParquet" width="60" height="20" patternUnits="userSpaceOnUse">
      <rect width="60" height="20" fill="#0d2433" stroke="rgba(114, 221, 212, 0.12)" stroke-width="0.8"/>
      <line x1="30" y1="0" x2="30" y2="20" stroke="rgba(114, 221, 212, 0.08)" stroke-width="0.8"/>
    </pattern>

    <!-- Tile / Stone Floor Pattern -->
    <pattern id="stoneTile" width="30" height="30" patternUnits="userSpaceOnUse">
      <rect width="30" height="30" fill="#0a1e2c" stroke="rgba(255, 255, 255, 0.09)" stroke-width="0.8"/>
    </pattern>

    <!-- Timber Deck Boards -->
    <pattern id="deckBoards" width="12" height="60" patternUnits="userSpaceOnUse">
      <rect width="12" height="60" fill="#0f2a2c" stroke="rgba(200, 157, 85, 0.22)" stroke-width="0.8"/>
    </pattern>

    <!-- Pool Water Shimmer -->
    <linearGradient id="poolWater" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0077b6" stop-opacity="0.85"/>
      <stop offset="50%" stop-color="#0096c7" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#00b4d8" stop-opacity="0.95"/>
    </linearGradient>

    <!-- Turf Grass Pattern -->
    <pattern id="turfPattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="#133827"/>
      <rect x="0" y="0" width="40" height="20" fill="#194833" opacity="0.6"/>
    </pattern>

    <filter id="blueprintGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#72ddd4" flood-opacity="0.4"/>
    </filter>

    <!-- plan area clip (lot boundary is trimmed to it when the sheet zooms in on the building) -->
    <clipPath id="planClip"><rect x="{PLAN_BOX[0]-12}" y="{PLAN_BOX[1]-12}" width="{PLAN_BOX[2]-PLAN_BOX[0]+24}" height="{PLAN_BOX[3]-PLAN_BOX[1]+24}"/></clipPath>
  </defs>

  <!-- Background CAD Sheet -->
  <rect width="{width}" height="{height}" fill="{C_BG}"/>
  <rect width="{width}" height="{height}" fill="url(#cadGridLarge)"/>

  <!-- Outer Blueprint Border -->
  <rect x="25" y="25" width="{width-50}" height="{height-50}" fill="none" stroke="{C_LINE}" stroke-width="2.5" opacity="0.7"/>
  <rect x="33" y="33" width="{width-66}" height="{height-66}" fill="none" stroke="{C_LINE}" stroke-width="0.8" opacity="0.4"/>
'''


def draw_scale_bar(x, y, s):
    """graphic scale bar: picks 1/2/5/10/20 m so the bar is 150–360 px long"""
    total = 5.0
    for cand in (1, 2, 5, 10, 20, 50):
        if 150 <= cand * s <= 360:
            total = float(cand)
            break
    else:
        total = float(min((1, 2, 5, 10, 20, 50), key=lambda c: abs(c * s - 250)))
    L = total * s
    n = 5
    out = [f'<g class="cad-scale-bar" transform="translate({f(x)}, {f(y)})">']
    for i in range(n):
        fill = C_LINE if i % 2 == 0 else "#081e30"
        out.append(f'<rect x="{f(i * L / n)}" y="0" width="{f(L / n)}" height="8" fill="{fill}" stroke="{C_LINE}" stroke-width="1"/>')
    for i in (0, n // 2 if n % 2 == 0 else None, n):
        if i is None:
            continue
        val = total * i / n
        out.append(svg_text(i * L / n, -5, f"{val:g}" + (" m" if i == n else ""), size=10, weight=700))
    out.append(svg_text(L / 2, 24, f"SCALE  1 m = {s:.1f} px  ·  1:{1000 / (s * 0.5256):.0f} @ A1", size=9, fill=C_MUTED, weight=600))
    out.append("</g>")
    return "\n".join(out)


def svg_footer(width, height, build_name, author, sheet_no, level_title, scale_px_per_m):
    bx, by, bw, bh = width - 420, height - 160, 380, 120
    ratio = 1000 / (scale_px_per_m * 0.5256)   # 1600 px sheet ≈ A1 landscape (841 mm)
    scale_str = f"1:{ratio:.0f} @ A1"
    return f'''
  <!-- NORTH ARROW -->
  <g transform="translate(75, {height - 90})">
    <circle cx="0" cy="0" r="28" fill="#081c2d" stroke="{C_LINE}" stroke-width="1.5"/>
    <polygon points="0,-24 -7,2 0,0" fill="{C_LINE}"/>
    <polygon points="0,-24 7,2 0,0" fill="#ffffff" opacity="0.7"/>
    <polygon points="0,24 -7,2 0,0" fill="#0a2a40"/>
    <polygon points="0,24 7,2 0,0" fill="{C_BG}"/>
    <text x="0" y="-28" fill="{C_LINE}" font-family="{MONO}" font-size="13" font-weight="800" text-anchor="middle">N</text>
  </g>

  <!-- GRAPHIC SCALE -->
{draw_scale_bar(150, height - 96, scale_px_per_m)}

  <!-- ARCHITECTURAL TITLE BLOCK -->
  <g transform="translate({bx}, {by})">
    <rect x="0" y="0" width="{bw}" height="{bh}" fill="#081e30" stroke="{C_LINE}" stroke-width="1.8"/>
    <line x1="0" y1="36" x2="{bw}" y2="36" stroke="{C_LINE}" stroke-width="1"/>
    <line x1="0" y1="76" x2="{bw}" y2="76" stroke="{C_LINE}" stroke-width="1"/>
    <line x1="{bw*0.62}" y1="36" x2="{bw*0.62}" y2="{bh}" stroke="{C_LINE}" stroke-width="1"/>

    <!-- Row 1: Build Name -->
    <text x="14" y="16" fill="{C_MUTED}" font-family="{FONT}" font-size="9" letter-spacing="1">PROJECT / BUILD NAME</text>
    <text x="14" y="30" fill="#ffffff" font-family="{FONT}" font-size="13.5" font-weight="800" letter-spacing="0.5">{esc(build_name.upper())}</text>

    <!-- Row 2: Author & Scale -->
    <text x="14" y="52" fill="{C_MUTED}" font-family="{FONT}" font-size="9" letter-spacing="1">BUILD AUTHOR</text>
    <text x="14" y="68" fill="{C_LINE}" font-family="{FONT}" font-size="13" font-weight="700">{esc(author.upper())}</text>

    <text x="{bw*0.62 + 12}" y="52" fill="{C_MUTED}" font-family="{FONT}" font-size="9" letter-spacing="1">SCALE</text>
    <text x="{bw*0.62 + 12}" y="68" fill="#ffffff" font-family="{FONT}" font-size="12" font-weight="600">{esc(scale_str)}</text>

    <!-- Row 3: Sheet & Discipline -->
    <text x="14" y="92" fill="{C_MUTED}" font-family="{FONT}" font-size="9" letter-spacing="1">ARCHITECTURAL SCHEMATIC</text>
    <text x="14" y="108" fill="#e2f1f8" font-family="{FONT}" font-size="11.5">{esc(level_title.upper())}</text>

    <text x="{bw*0.62 + 12}" y="92" fill="{C_MUTED}" font-family="{FONT}" font-size="9" letter-spacing="1">SHEET NO.</text>
    <text x="{bw*0.62 + 12}" y="110" fill="{C_AMBER}" font-family="{MONO}" font-size="15" font-weight="900">{esc(sheet_no)}</text>
  </g>
</svg>
'''


def room_label_size(room_no, title, area_sqm, elev="", max_w=None):
    """(box width px, scale) for a room tag; tags shrink (to ≥0.7) when their room is narrower than the text"""
    sqft = int(round(area_sqm * 10.7639))
    line1 = f"{room_no} / {title.upper()}"
    line2 = f"{area_sqm:g} m² [{sqft} SQ FT]" + (f" · ELEV {elev}" if elev else "")
    w = max(len(line1) * 8.1, len(line2) * 6.3) + 28
    w = max(w, 120.0)
    scale = 1.0
    if max_w and w > max_w:
        scale = max(0.7, max_w / w)
    return w, scale


def draw_room_label(cx, cy, room_no, title, area_sqm, elev="", max_w=None):
    """room tag — keeps class="room-tag-group" (a viewer can highlight tags by room number)"""
    sqft = int(round(area_sqm * 10.7639))
    line1 = f"{room_no} / {title.upper()}"
    line2 = f"{area_sqm:g} m² [{sqft} SQ FT]" + (f" · ELEV {elev}" if elev else "")
    w, scale = room_label_size(room_no, title, area_sqm, elev, max_w)
    return f'''
  <g class="room-tag-group" transform="translate({f(cx)}, {f(cy)}) scale({f(scale)})">
    <rect x="{f(-w/2)}" y="-24" width="{f(w)}" height="48" rx="6" fill="rgba(8, 26, 42, 0.88)" stroke="{C_LINE}" stroke-width="1.2"/>
    <text x="0" y="-6" fill="#ffffff" font-family="{FONT}" font-size="12.5" font-weight="800" text-anchor="middle" letter-spacing="0.6">{esc(line1)}</text>
    <text x="0" y="12" fill="{C_LINE}" font-family="{MONO}" font-size="10" font-weight="600" text-anchor="middle">{esc(line2)}</text>
  </g>'''


def draw_wall_runs(segments, thickness, exterior=True):
    """segments: [(x0,y0,x1,y1)] px.  Two passes with square caps: a light outline band
    then the dark wall fill, so joints/corners close cleanly without loop tracing."""
    stroke = C_LINE if exterior else C_INT
    fill = C_WALL_FILL if exterior else C_INT_FILL
    rim = 1.6 if exterior else 1.2
    out = [f'<g class="walls-{"ext" if exterior else "int"}">']
    for x0, y0, x1, y1 in segments:
        out.append(svg_line(x0, y0, x1, y1, stroke=stroke, width=thickness + 2 * rim, cap="square"))
    for x0, y0, x1, y1 in segments:
        out.append(svg_line(x0, y0, x1, y1, stroke=fill, width=thickness, cap="square"))
    out.append("</g>")
    return "\n".join(out)


def draw_dimension(x1, y1, x2, y2, label, offset=30, is_vertical=False):
    if not is_vertical:
        dy = y1 - offset
        return f'''
  <g class="cad-dim" opacity="0.75">
    <line x1="{f(x1)}" y1="{f(y1-5)}" x2="{f(x1)}" y2="{f(dy-10)}" stroke="{C_LINE}" stroke-width="0.8"/>
    <line x1="{f(x2)}" y1="{f(y2-5)}" x2="{f(x2)}" y2="{f(dy-10)}" stroke="{C_LINE}" stroke-width="0.8"/>
    <line x1="{f(x1)}" y1="{f(dy)}" x2="{f(x2)}" y2="{f(dy)}" stroke="{C_LINE}" stroke-width="1.2"/>
    <line x1="{f(x1-4)}" y1="{f(dy-4)}" x2="{f(x1+4)}" y2="{f(dy+4)}" stroke="{C_LINE}" stroke-width="1.6"/>
    <line x1="{f(x2-4)}" y1="{f(dy-4)}" x2="{f(x2+4)}" y2="{f(dy+4)}" stroke="{C_LINE}" stroke-width="1.6"/>
    <text x="{f((x1+x2)/2)}" y="{f(dy-6)}" fill="{C_LINE}" font-family="{MONO}" font-size="11" font-weight="700" text-anchor="middle">{esc(label)}</text>
  </g>'''
    dx = x1 - offset
    return f'''
  <g class="cad-dim" opacity="0.75">
    <line x1="{f(x1-5)}" y1="{f(y1)}" x2="{f(dx-10)}" y2="{f(y1)}" stroke="{C_LINE}" stroke-width="0.8"/>
    <line x1="{f(x2-5)}" y1="{f(y2)}" x2="{f(dx-10)}" y2="{f(y2)}" stroke="{C_LINE}" stroke-width="0.8"/>
    <line x1="{f(dx)}" y1="{f(y1)}" x2="{f(dx)}" y2="{f(y2)}" stroke="{C_LINE}" stroke-width="1.2"/>
    <line x1="{f(dx-4)}" y1="{f(y1-4)}" x2="{f(dx+4)}" y2="{f(y1+4)}" stroke="{C_LINE}" stroke-width="1.6"/>
    <line x1="{f(dx-4)}" y1="{f(y2-4)}" x2="{f(dx+4)}" y2="{f(y2+4)}" stroke="{C_LINE}" stroke-width="1.6"/>
    <text x="{f(dx-8)}" y="{f((y1+y2)/2)}" fill="{C_LINE}" font-family="{MONO}" font-size="11" font-weight="700" text-anchor="middle" transform="rotate(-90 {f(dx-8)} {f((y1+y2)/2)})">{esc(label)}</text>
  </g>'''


# -----------------------------------------------------------------------------
# openings (drawn in a local frame: u along the wall from the hinge end, v = inward)
# -----------------------------------------------------------------------------
def draw_door_swing(fr, W, t):
    """hinged leaf + quarter-circle swing.  hinge at local (0,0), opening (0..W) along u, swing toward +v."""
    tip = fr.pt(0, W)
    far = fr.pt(W, 0)
    r = W * fr.s
    sweep = fr.sweep(0)
    return (fr.line(0, 0, W, 0, stroke=C_LINE, width=0.8, opacity=0.5) +                 # threshold
            fr.line(0, 0, 0, W, stroke=C_WHITE, width=2.5) +                               # leaf
            f'<path d="M {f(tip[0])} {f(tip[1])} A {f(r)} {f(r)} 0 0 {sweep} {f(far[0])} {f(far[1])}" '
            f'fill="none" stroke="{C_LINE}" stroke-dasharray="3,3" stroke-width="1.2"/>')


def draw_slider(fr, W, t):
    """two overlapping sliding panels"""
    off = t * 0.22
    return (fr.line(0, 0, W * 0.55, 0, dv0=-off, dv1=-off, stroke=C_WHITE, width=2.2) +
            fr.line(W * 0.45, 0, W, 0, dv0=off, dv1=off, stroke=C_WHITE, width=2.2) +
            fr.line(0.05, 0, W * 0.5, 0, dv0=-off, dv1=-off, stroke=C_LINE, width=0.8, opacity=0.6) +
            fr.line(W * 0.5, 0, W - 0.05, 0, dv0=off, dv1=off, stroke=C_LINE, width=0.8, opacity=0.6) +
            fr.line(0, 0, 0, 0, dv0=-t / 2, dv1=t / 2, stroke=C_LINE, width=1.4) +
            fr.line(W, 0, W, 0, dv0=-t / 2, dv1=t / 2, stroke=C_LINE, width=1.4))


def draw_garage_door(fr, W, t):
    """closed sectional leaf on the wall line + dashed up-and-over track inward"""
    depth = min(2.2, W * 0.8)
    return (fr.line(0, 0, W, 0, stroke=C_WHITE, width=2.4) +
            fr.line(0, 0, 0, depth, du0=t * 0.35, du1=t * 0.35, stroke=C_LINE, width=1, dash="4,3", opacity=0.7) +
            fr.line(W, 0, W, depth, du0=-t * 0.35, du1=-t * 0.35, stroke=C_LINE, width=1, dash="4,3", opacity=0.7) +
            fr.line(0, depth, W, depth, du0=t * 0.35, du1=-t * 0.35, stroke=C_LINE, width=1, dash="4,3", opacity=0.7) +
            fr.line(0, 0, 0, 0, dv0=-t / 2, dv1=t / 2, stroke=C_LINE, width=1.4) +
            fr.line(W, 0, W, 0, dv0=-t / 2, dv1=t / 2, stroke=C_LINE, width=1.4))


def draw_glazing(fr, W, t, full_height=False):
    """window (2 glazing lines) / glass span (3 lines + tint), with jambs"""
    out = []
    if full_height:
        pts = [fr.pt(0, 0, 0, -t / 2), fr.pt(W, 0, 0, -t / 2), fr.pt(W, 0, 0, t / 2), fr.pt(0, 0, 0, t / 2)]
        out.append(f'<polygon points="{" ".join(f"{f(x)},{f(y)}" for x, y in pts)}" fill="rgba(114, 221, 212, 0.14)" stroke="none"/>')
        out.append(fr.line(0, 0, W, 0, stroke=C_LINE, width=1.0, opacity=0.8))
    out.append(fr.line(0, 0, W, 0, dv0=-t * 0.2, dv1=-t * 0.2, stroke=C_LINE, width=1.5))
    out.append(fr.line(0, 0, W, 0, dv0=t * 0.2, dv1=t * 0.2, stroke=C_LINE, width=1.5))
    out.append(fr.line(0, 0, 0, 0, dv0=-t / 2, dv1=t / 2, stroke=C_LINE, width=1.6))
    out.append(fr.line(W, 0, W, 0, dv0=-t / 2, dv1=t / 2, stroke=C_LINE, width=1.6))
    return "".join(out)


def opening_cut(fr, W, t, rim):
    """background rect that removes the wall band (and its outline) across the opening span"""
    h = t / 2 + rim + 0.6
    pts = [fr.pt(0, 0, 0, -h), fr.pt(W, 0, 0, -h), fr.pt(W, 0, 0, h), fr.pt(0, 0, 0, h)]
    return f'<polygon points="{" ".join(f"{f(x)},{f(y)}" for x, y in pts)}" fill="{C_BG}" stroke="none"/>'


SIDE_U = {"S": (1, 0), "N": (1, 0), "E": (0, 1), "W": (0, 1)}      # page-space direction along the wall
SIDE_IN = {"S": (0, -1), "N": (0, 1), "E": (-1, 0), "W": (1, 0)}   # page-space inward normal


def draw_perimeter_opening(sh, edges, op, level_id, spec_id):
    side, at, typ = op.get("side"), op.get("at", 0), op.get("type", "window")
    W = float(op.get("w", 1.0))
    e = find_edge(edges, side, at, op.get("edgeZ"))
    if e is None:
        _unrendered.add(f"{spec_id}/{level_id}: opening {typ}@{side}:{at} has no perimeter edge on that side")
        return ""
    t = sh.ext_t()
    horiz = side in ("S", "N")
    if horiz:
        origin = sh.pt(at - W / 2, e["a"][1])
    else:
        origin = sh.pt(e["a"][0], at - W / 2)
    fr = Frame(origin, SIDE_U[side], SIDE_IN[side], sh.s)
    out = [f'<g class="opening opening-{typ}" data-side="{side}" data-at="{f(at)}">', opening_cut(fr, W, t, 1.6)]
    if typ == "door":
        out.append(draw_door_swing(fr, W, t))
    elif typ == "slider":
        out.append(draw_slider(fr, W, t))
    elif typ == "garage":
        out.append(draw_garage_door(fr, W, t))
    elif typ == "glass":
        out.append(draw_glazing(fr, W, t, full_height=True))
    elif typ == "window":
        out.append(draw_glazing(fr, W, t, full_height=False))
    else:
        _unrendered.add(f"{spec_id}/{level_id}: opening type '{typ}' unknown — drawn as window")
        out.append(draw_glazing(fr, W, t, full_height=False))
    out.append("</g>")
    return "\n".join(out)


def draw_entry_marker(sh, edges, entry):
    """amber arrow outside the front door pointing in, with an ENTRY caption"""
    side, at = entry.get("side"), entry.get("at", 0)
    e = find_edge(edges, side, at)
    if e is None:
        return ""
    horiz = side in ("S", "N")
    origin = sh.pt(at, e["a"][1]) if horiz else sh.pt(e["a"][0], at)
    fr = Frame(origin, SIDE_U[side], SIDE_IN[side], sh.s)
    out_px = sh.ext_t() / 2                      # wall face
    tip = fr.pt(0, 0, 0, -(out_px + 6))
    base_l = fr.pt(0, 0, -6, -(out_px + 18))
    base_r = fr.pt(0, 0, 6, -(out_px + 18))
    lx, ly = fr.pt(0, 0, 0, -(out_px + 28))
    ly += 4 if side in ("S", "E", "W") else 0    # keep the caption clear of the arrow head
    return (f'<g class="entry-marker"><polygon points="{f(tip[0])},{f(tip[1])} {f(base_l[0])},{f(base_l[1])} {f(base_r[0])},{f(base_r[1])}" fill="{C_AMBER}"/>'
            + svg_text(lx, ly, "ENTRY", size=9, fill=C_AMBER, weight=800) + "</g>")


# -----------------------------------------------------------------------------
# interior elements
# -----------------------------------------------------------------------------
def draw_partitions(sh, partitions, level_id, spec_id):
    t = sh.int_t()
    segs, swings = [], []
    for p in partitions:
        fr_, to_ = p.get("from"), p.get("to")
        if not (isinstance(fr_, list) and isinstance(to_, list) and len(fr_) >= 2 and len(to_) >= 2):
            _unrendered.add(f"{spec_id}/{level_id}: partition without from/to")
            continue
        dx, dz = to_[0] - fr_[0], to_[1] - fr_[1]
        L = math.hypot(dx, dz)
        if L < 1e-6:
            continue
        ux, uz = dx / L, dz / L                       # world unit along the wall
        door = p.get("door")
        door_w = float(p.get("doorW", 0.9))
        half_cap = t / 2 / sh.s                       # square caps extend t/2 px — pull segment ends back
        if door is None or door_w <= 0:
            segs.append((*sh.pt(*fr_), *sh.pt(*to_)))
            continue
        d0, d1 = max(0.0, door - door_w / 2), min(L, door + door_w / 2)
        if d0 - half_cap > 0.02:
            a = (fr_[0], fr_[1]); b = (fr_[0] + ux * (d0 - half_cap), fr_[1] + uz * (d0 - half_cap))
            segs.append((*sh.pt(*a), *sh.pt(*b)))
        if L - (d1 + half_cap) > 0.02:
            a = (fr_[0] + ux * (d1 + half_cap), fr_[1] + uz * (d1 + half_cap)); b = (to_[0], to_[1])
            segs.append((*sh.pt(*a), *sh.pt(*b)))
        # door swing: hinge at d0, swing toward the side clockwise of the wall direction on the page
        hinge = sh.pt(fr_[0] + ux * d0, fr_[1] + uz * d0)
        u_hat = (ux, uz)                              # page dir == world dir (x→right, z→down)
        v_hat = (-uz, ux)
        fr = Frame(hinge, u_hat, v_hat, sh.s)
        swings.append(draw_door_swing(fr, d1 - d0, t))
    out = [draw_wall_runs(segs, t, exterior=False)] if segs else []
    out.extend(swings)
    return "\n".join(out)


def item_rect_svg(sh, cx, cz, w, d, rot, cls="item", fill="rgba(20, 52, 77, 0.55)", stroke=C_LINE, width=1.1, rx=3,
                  dash=None, fill_opacity=None):
    """axis-aligned rotations become <rect> (rounded corners); anything else a <polygon>"""
    extra = (f' stroke-dasharray="{dash}"' if dash else "") + (f' fill-opacity="{fill_opacity}"' if fill_opacity is not None else "")
    if abs((rot or 0) % 90) < 1e-6:
        if abs((rot or 0) % 180 - 90) < 1e-6:
            w, d = d, w
        x, y = sh.pt(cx - w / 2, cz - d / 2)
        return f'<rect class="{cls}" x="{f(x)}" y="{f(y)}" width="{f(w * sh.s)}" height="{f(d * sh.s)}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"{extra}/>'
    corners = [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    pts = [sh.pt(*local_to_world(cx, cz, lx, lz, rot)) for lx, lz in corners]
    return f'<polygon class="{cls}" points="{" ".join(f"{f(x)},{f(y)}" for x, y in pts)}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"{extra}/>'


def draw_item(sh, it, level_id, spec_id):
    typ = it.get("type", "?")
    at = it.get("at")
    if not (isinstance(at, list) and len(at) >= 2):
        return ""
    cx, cz = float(at[0]), float(at[1])
    rot = float(it.get("rot", 0) or 0)
    out = [f'<g class="item item-{esc(typ)}">']
    if typ in ITEM_RADII or typ in PLANT_RADII:
        r = float(it.get("w", 0) or 0) / 2 or (ITEM_RADII.get(typ) or PLANT_RADII.get(typ))
        px, py = sh.pt(cx, cz)
        if typ in PLANT_RADII:
            out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(r * sh.s)}" fill="rgba(16, 185, 129, 0.18)" stroke="#10b981" stroke-width="1" opacity="0.85"/>')
            out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(max(1.5, r * sh.s * 0.35))}" fill="none" stroke="#10b981" stroke-width="0.8" opacity="0.7"/>')
        else:
            out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(r * sh.s)}" fill="rgba(27, 61, 82, 0.45)" stroke="{C_AMBER}" stroke-width="1.2" opacity="0.8"/>')
            if typ == "concentric-rug":
                out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(r * sh.s * 0.6)}" fill="none" stroke="{C_LINE}" stroke-width="1" opacity="0.7"/>')
        out.append("</g>")
        return "\n".join(out)
    if typ not in ITEM_FOOTPRINTS:
        _unrendered.add(f"{spec_id}/{level_id}: item type '{typ}' has no catalog footprint — drawn 0.6 × 0.6")
    w0, d0 = ITEM_FOOTPRINTS.get(typ, DEFAULT_FOOTPRINT)
    w = float(it.get("w", w0) or w0)
    d = float(it.get("d", d0) or d0)
    soft = typ in ("area-rug",)
    out.append(item_rect_svg(sh, cx, cz, w, d, rot,
                             fill="rgba(27, 61, 82, 0.35)" if soft else "rgba(20, 52, 77, 0.55)",
                             stroke=C_AMBER if soft else C_LINE, width=1.0 if soft else 1.1))
    # small flourishes for the big pieces
    if typ == "platform-bed":
        for lx in (-w * 0.25, w * 0.25):
            px, pz = local_to_world(cx, cz, lx, -d / 2 + 0.3, rot)
            out.append(item_rect_svg(sh, px, pz, w * 0.38, 0.4, rot, fill="#1b4661", stroke=C_LINE, width=0.8, rx=2))
    elif typ == "kitchen-island":
        for lx in (-0.75, -0.45, 0.45, 0.75):
            px, pz = local_to_world(cx, cz, lx, 0, rot)
            sx, sy = sh.pt(px, pz)
            out.append(f'<circle cx="{f(sx)}" cy="{f(sy)}" r="{f(0.12 * sh.s)}" fill="none" stroke="{C_LINE}" stroke-width="1"/>')
    elif typ == "ensuite":
        px, pz = local_to_world(cx, cz, -w * 0.2, 0, rot)
        out.append(item_rect_svg(sh, px, pz, w * 0.5, d * 0.7, rot, fill="#071b28", stroke=C_LINE, width=1.0, rx=8))
    elif typ in ("dining-set", "dining-table"):
        for lx in (-w * 0.3, 0, w * 0.3):
            for lz in (-d / 2 - 0.22, d / 2 + 0.22):
                px, pz = local_to_world(cx, cz, lx, lz, rot)
                out.append(item_rect_svg(sh, px, pz, 0.42, 0.36, rot, fill="#0a1f2e", stroke=C_LINE, width=0.8, rx=2))
    label = ITEM_SHORT_LABEL.get(typ)
    if label:
        wpx = (w if abs(rot % 180) < 1e-6 or abs(rot % 90) > 1e-6 else d) * sh.s
        if len(label) * 6.0 + 6 <= wpx and d * sh.s >= 14:
            px, py = sh.pt(cx, cz)
            out.append(svg_text(px, py + 3, label, size=7.5, fill=C_MUTED, weight=700))
    out.append("</g>")
    return "\n".join(out)


def stair_frame(sh, st):
    at = st.get("at")
    rot = float(st.get("rot", 0) or 0)
    dz = rot_vec(rot)                      # ascent direction (world x, z)
    v_hat = (dz[0], dz[1])                 # page == world for (x → right, z → down)
    u_hat = (math.cos(math.radians(rot)), -math.sin(math.radians(rot)))
    return Frame(sh.pt(float(at[0]), float(at[1])), u_hat, v_hat, sh.s)


def draw_stairs(sh, st, level_id, spec_id, going_down=False):
    """straight run: outline + treads + direction arrow; spiral: circle + radial treads."""
    at = st.get("at")
    if not (isinstance(at, list) and len(at) >= 2):
        _unrendered.add(f"{spec_id}/{level_id}: stairs without at")
        return ""
    typ = st.get("type", "timber")
    dash = ' stroke-dasharray="4,3"' if going_down else ""
    op = 0.7 if going_down else 1.0
    out = [f'<g class="stairs stairs-{esc(typ)} {"stairs-dn" if going_down else "stairs-up"}" opacity="{op}">']
    if typ == "spiral":
        px, py = sh.pt(float(at[0]), float(at[1]))
        r = SPIRAL_RADIUS * sh.s
        out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(r)}" fill="rgba(20, 52, 77, 0.45)" stroke="{C_LINE}" stroke-width="1.4"{dash}/>')
        rot = float(st.get("rot", 0) or 0)
        start = math.radians(90 - rot)          # page angle of the ascent direction
        for i in range(17):
            a = start + i * (1.5 * math.pi) / 16
            out.append(svg_line(px, py, px + r * math.cos(a), py + r * math.sin(a), width=0.8, opacity=0.8))
        out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(max(2.0, 0.07 * sh.s))}" fill="{C_LINE}"/>')
        out.append(svg_text(px, py - r - 4, "DN" if going_down else "UP", size=10, fill=C_AMBER, weight=800))
        out.append("</g>")
        return "\n".join(out)
    if typ not in STAIR_DIMS:
        _unrendered.add(f"{spec_id}/{level_id}: stairs type '{typ}' unknown — drawn as timber run")
    W, run = STAIR_DIMS.get(typ, STAIR_DIMS["timber"])
    fr = stair_frame(sh, st)
    out.append(f'<polygon points="{fr.poly([(-W/2, 0), (W/2, 0), (W/2, run), (-W/2, run)])}" fill="rgba(20, 52, 77, 0.45)" stroke="{C_LINE}" stroke-width="1.4"{dash}/>')
    for i in range(1, STAIR_STEPS):
        v = run * i / STAIR_STEPS
        out.append(fr.line(-W / 2, v, W / 2, v, width=0.8, opacity=0.8))
    # direction arrow along the centre line
    if going_down:
        a0, a1 = run - 0.35, 0.45
        label_v = run - 0.15
    else:
        a0, a1 = 0.35, run - 0.45
        label_v = 0.2
    out.append(fr.line(0, a0, 0, a1, stroke=C_AMBER, width=1.6))
    sgn = 1 if a1 > a0 else -1
    head = [(0, a1 + sgn * 0.3), (-0.16, a1), (0.16, a1)]
    out.append(f'<polygon points="{fr.poly(head)}" fill="{C_AMBER}"/>')
    lx, ly = fr.pt(0, label_v)
    out.append(svg_text(lx, ly + 3.5, "DN" if going_down else "UP", size=9.5, fill=C_AMBER, weight=800))
    out.append("</g>")
    return "\n".join(out)


def draw_void(sh, v):
    x, y, w, h = sh.rect(v)
    return (f'<g class="void"><rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="#040f1a"/>'
            f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="url(#wallHatch)" stroke="{C_GOLD}" stroke-dasharray="4,4" stroke-width="1.5"/></g>')


def draw_balustrade(sh, b):
    fr_, to_ = b.get("from"), b.get("to")
    if not (isinstance(fr_, list) and isinstance(to_, list)):
        return ""
    x0, y0 = sh.pt(fr_[0], fr_[1]); x1, y1 = sh.pt(to_[0], to_[1])
    style = b.get("style", "glass")
    if style == "colonial":
        return (svg_line(x0, y0, x1, y1, stroke=C_GOLD, width=3, cap="round") +
                f'<circle cx="{f(x0)}" cy="{f(y0)}" r="3" fill="{C_GOLD}"/><circle cx="{f(x1)}" cy="{f(y1)}" r="3" fill="{C_GOLD}"/>')
    return (svg_line(x0, y0, x1, y1, stroke=C_LINE, width=2.2, cap="round", opacity=0.95) +
            svg_line(x0, y0, x1, y1, stroke=C_WHITE, width=0.6, cap="round", opacity=0.6))


def draw_site_outline(sh, s):
    typ = s.get("type")
    at = s.get("at")
    if typ not in ("pool", "deck", "porch") or not (isinstance(at, list) and len(at) >= 2):
        return ""
    w = float(s.get("w", 4) or 4); d = float(s.get("d", 3) or 3); rot = float(s.get("rot", 0) or 0)
    fill = {"pool": "url(#poolWater)", "deck": "url(#deckBoards)", "porch": "none"}[typ]
    out = [f'<g class="site site-{typ}" opacity="0.85" clip-path="url(#planClip)">']
    out.append(item_rect_svg(sh, at[0], at[1], w, d, rot, cls=f"site-{typ}", fill=fill, stroke=C_LINE, width=1.2, rx=2,
                             dash="6,4", fill_opacity=None if typ == "porch" else 0.35))
    if typ == "porch":
        for lx, lz in ((-w / 2 + 0.3, -d / 2 + 0.3), (w / 2 - 0.3, -d / 2 + 0.3), (w / 2 - 0.3, d / 2 - 0.3), (-w / 2 + 0.3, d / 2 - 0.3)):
            px, pz = local_to_world(at[0], at[1], lx, lz, rot)
            sx, sy = sh.pt(px, pz)
            out.append(f'<circle cx="{f(sx)}" cy="{f(sy)}" r="{f(max(2.5, 0.18 * sh.s))}" fill="#081c2d" stroke="{C_LINE}" stroke-width="1.2"/>')
    cx, cy = sh.pt(at[0], at[1])
    out.append(svg_text(cx, cy + 3.5, typ.upper(), size=9, fill=C_MUTED, weight=700))
    out.append("</g>")
    return "\n".join(out)


def draw_hero_marker(sh, hero):
    at = hero.get("at")
    if not (isinstance(at, list) and len(at) >= 2):
        return ""
    px, py = sh.pt(at[0], at[1])
    r = 6
    return (f'<g class="hero-marker" filter="url(#blueprintGlow)">'
            f'<polygon points="{f(px)},{f(py-r)} {f(px+r)},{f(py)} {f(px)},{f(py+r)} {f(px-r)},{f(py)}" fill="{C_AMBER}" stroke="#ffffff" stroke-width="0.8"/>'
            + svg_text(px, py + r + 10, "CI CORE", size=7.5, fill=C_AMBER, weight=800) + "</g>")


# -----------------------------------------------------------------------------
# per-house view: every level of a house shares one scale + position
# -----------------------------------------------------------------------------
def site_outline_bbox(s_):
    at = s_.get("at")
    if s_.get("type") not in ("pool", "deck", "porch") or not (isinstance(at, list) and len(at) >= 2):
        return None
    w = float(s_.get("w", 4) or 4); d = float(s_.get("d", 3) or 3); rot = float(s_.get("rot", 0) or 0)
    pts = [local_to_world(at[0], at[1], lx, lz, rot) for lx, lz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
    return (min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts))


def spec_view(spec, fit="auto"):
    """(Sheet, mode).  mode: 'lot' = whole lot, 'site' = building + drawn site outlines, 'building' = footprints only.
    auto picks the widest framing that keeps ≥ MIN_LEGIBLE_SCALE px/m (lot → site → building)."""
    lot = spec.get("lot", {}) or {}
    lot_w, lot_d = float(lot.get("w", 30) or 30), float(lot.get("d", 24) or 24)
    bldg, site = [], []
    for lv in spec.get("levels", []) or []:
        rects = [r for r in lv.get("footprint", []) or [] if all(k in r for k in ("x", "z", "w", "d"))]
        if rects:
            bldg.append(footprint_bbox(rects))
    for s_ in spec.get("site", []) or []:
        b = site_outline_bbox(s_)
        if b:
            site.append(b)
    if not bldg:
        bldg.append((-lot_w / 2, -lot_d / 2, lot_w / 2, lot_d / 2))

    def padded(boxes):
        return (min(b[0] for b in boxes) - VIEW_PAD, min(b[1] for b in boxes) - VIEW_PAD,
                max(b[2] for b in boxes) + VIEW_PAD, max(b[3] for b in boxes) + VIEW_PAD)

    b_bldg = padded(bldg)
    b_site = padded(bldg + site)
    b_lot = (min(-lot_w / 2, b_site[0]), min(-lot_d / 2, b_site[1]), max(lot_w / 2, b_site[2]), max(lot_d / 2, b_site[3]))
    candidates = [("lot", Sheet(*b_lot)), ("site", Sheet(*b_site, max_scale=MAX_SCALE)), ("building", Sheet(*b_bldg, max_scale=MAX_SCALE))]
    if fit == "lot":
        return candidates[0][1], "lot"
    if fit == "content":
        return candidates[1][1], "site"
    for mode, sh in candidates:
        if sh.s >= MIN_LEGIBLE_SCALE:
            return sh, mode
    return candidates[-1][1], "building"


def place_room_labels(labels):
    """labels: [{cx, cy, w, h, room:(x0,y0,x1,y1)}] px — nudge overlapping tags apart vertically (within their room)."""
    placed = []
    for lb in labels:
        for _ in range(6):
            moved = False
            for other in placed:
                if (abs(lb["cx"] - other["cx"]) < (lb["w"] + other["w"]) / 2 + 6 and
                        abs(lb["cy"] - other["cy"]) < (lb["h"] + other["h"]) / 2 + 6):
                    shift = (lb["h"] + other["h"]) / 2 + 8 - abs(lb["cy"] - other["cy"])
                    down = lb["cy"] >= other["cy"]
                    cand = lb["cy"] + shift if down else lb["cy"] - shift
                    rx0, ry0, rx1, ry1 = lb["room"]
                    if not (ry0 + lb["h"] / 2 <= cand <= ry1 - lb["h"] / 2):
                        cand = lb["cy"] - shift if down else lb["cy"] + shift
                        if not (ry0 + lb["h"] / 2 <= cand <= ry1 - lb["h"] / 2):
                            cand = lb["cy"] + shift if down else lb["cy"] - shift   # let it overflow the room
                    lb["cy"] = cand
                    moved = True
            if not moved:
                break
        placed.append(lb)
    return labels


# -----------------------------------------------------------------------------
# S2 (architecture): what the plan draws beyond walls, doors and furniture — room finishes, flights that turn or come
# in arrays, styled partitions and partitions with several doorways, porches, bays, balconies, terraces, loggias, chimney
# stacks, a stoop, towers, double-height rooms. The resolved geometry comes from <id>.plan.json's `arch` key (the
# three.js builder wrote it: assets/plan-export/arch.ts); a spec with none of these fields draws exactly as before.
# -----------------------------------------------------------------------------
_arch_cache = {}


def load_arch(spec_id):
    """the plan.json `arch` key of a spec ({} when there is none)"""
    if spec_id not in _arch_cache:
        arch = {}
        p = HOUSES_DIR / f"{spec_id}.plan.json"
        if p.exists():
            try:
                arch = (json.loads(p.read_text(encoding="utf-8")) or {}).get("arch") or {}
            except (json.JSONDecodeError, OSError):
                arch = {}
        _arch_cache[spec_id] = arch
    return _arch_cache[spec_id]


# room floor kind → the sheet's pattern (the first four exist in svg_header; the rest are added to the sheet when used)
FLOOR_KIND_PATTERN = {
    "oak": "woodParquet", "honey-oak": "woodParquet", "walnut": "woodParquet", "cherry": "woodParquet",
    "white-oak": "woodParquet", "grey-wash": "woodParquet", "herringbone": "herringbonePlan", "chevron": "herringbonePlan",
    "tile": "stoneTile", "hex-tile": "hexTilePlan", "checker": "checkerPlan", "terracotta": "stoneTile", "stone": "stoneTile",
    "pavers": "stoneTile", "slate": "stoneTile", "concrete": "stoneTile", "marble": "stoneTile", "terrazzo": "stoneTile",
    "phthalo-terrazzo": "stoneTile", "charcoal-terrazzo": "stoneTile", "carpet": "carpetPlan", "deck": "deckBoards",
}
EXTRA_PATTERNS = {
    "herringbonePlan": ('<pattern id="herringbonePlan" width="40" height="40" patternUnits="userSpaceOnUse">'
                        '<rect width="40" height="40" fill="#0d2433"/>'
                        '<path d="M0 10 L20 0 L40 10 M0 20 L20 10 L40 20 M0 30 L20 20 L40 30 M0 40 L20 30 L40 40" fill="none" '
                        'stroke="rgba(114, 221, 212, 0.2)" stroke-width="0.9"/></pattern>'),
    "hexTilePlan": ('<pattern id="hexTilePlan" width="24" height="41.57" patternUnits="userSpaceOnUse">'
                    '<rect width="24" height="41.57" fill="#0a1e2c"/>'
                    '<path d="M12 0 L24 6.93 L24 20.78 L12 27.71 L0 20.78 L0 6.93 Z M12 27.71 L12 41.57 M0 20.78 L-12 27.71 M24 20.78 L36 27.71" '
                    'fill="none" stroke="rgba(255, 255, 255, 0.11)" stroke-width="0.8"/></pattern>'),
    "checkerPlan": ('<pattern id="checkerPlan" width="40" height="40" patternUnits="userSpaceOnUse">'
                    '<rect width="40" height="40" fill="#0a1e2c"/><rect width="20" height="20" fill="rgba(255, 255, 255, 0.09)"/>'
                    '<rect x="20" y="20" width="20" height="20" fill="rgba(255, 255, 255, 0.09)"/></pattern>'),
    "carpetPlan": ('<pattern id="carpetPlan" width="8" height="8" patternUnits="userSpaceOnUse">'
                   '<rect width="8" height="8" fill="#0c2231"/><circle cx="2" cy="2" r="0.7" fill="rgba(114, 221, 212, 0.26)"/>'
                   '<circle cx="6" cy="6" r="0.7" fill="rgba(114, 221, 212, 0.26)"/></pattern>'),
}


def _rect_ok(b):
    return isinstance(b, dict) and all(k in b for k in ("x", "z", "w", "d"))


def _clip_rect(a, b):
    x0, x1 = max(a["x"], b["x"]), min(a["x"] + a["w"], b["x"] + b["w"])
    z0, z1 = max(a["z"], b["z"]), min(a["z"] + a["d"], b["z"] + b["d"])
    return {"x": x0, "z": z0, "w": x1 - x0, "d": z1 - z0} if x1 - x0 > 0.02 and z1 - z0 > 0.02 else None


def room_finish_of(arch, level_id, room):
    for r in arch.get("rooms", []) or []:
        if r.get("level") == level_id and r.get("name") == room.get("name"):
            return r.get("finish") or {}
    return {}


def room_floor_kind(arch, level_id, room):
    """the floor kind a room draws: its own `floor` (a name or {kind}), else what the builder resolved for it (defaults: 2)"""
    fl = room.get("floor")
    kind = fl if isinstance(fl, str) else (fl or {}).get("kind") if isinstance(fl, dict) else None
    return kind or room_finish_of(arch, level_id, room).get("floor")


def draw_room_floors(sh, level, rects, arch, level_id):
    """per-room floor patterns over the slab fill, clipped to the room's bounds within the footprint; returns (svg, patterns used)"""
    used, out = set(), []
    for room in level.get("rooms", []) or []:
        b = room.get("bounds")
        kind = room_floor_kind(arch, level_id, room)
        if not kind or not _rect_ok(b):
            continue
        pat = FLOOR_KIND_PATTERN.get(kind, "stoneTile")
        used.add(pat)
        for r in rects:
            c = _clip_rect(b, r)
            if c:
                x, yy, w, h = sh.rect(c)
                out.append(f'<rect class="room-floor room-floor-{esc(kind)}" x="{f(x)}" y="{f(yy)}" width="{f(w)}" height="{f(h)}" fill="url(#{pat})"/>')
    if not out:
        return "", used
    return '<g class="room-floors">' + "".join(out) + "</g>", used


def draw_room_marks(sh, level, arch, level_id):
    """double-height rooms and floor offsets: a dotted outline and a caption in the room"""
    out = []
    for room in level.get("rooms", []) or []:
        b = room.get("bounds")
        if not _rect_ok(b):
            continue
        c = room.get("ceiling") if isinstance(room.get("ceiling"), dict) else {}
        kind = c.get("kind") or room_finish_of(arch, level_id, room).get("ceiling")
        off = room.get("floorOffset") or room_finish_of(arch, level_id, room).get("floorOffset") or 0
        caps = []
        if kind == "double":
            caps.append("DOUBLE HEIGHT")
        if off:
            caps.append(f"{'PLATFORM' if off > 0 else 'SUNKEN'} {off:+.2f} m")
        if not caps:
            continue
        x, yy, w, h = sh.rect(b)
        out.append(f'<g class="room-mark"><rect x="{f(x + 3)}" y="{f(yy + 3)}" width="{f(w - 6)}" height="{f(h - 6)}" fill="none" stroke="{C_AMBER}" stroke-width="1" stroke-dasharray="1,5" opacity="0.7"/>'
                   + svg_text(x + 9, yy + 15, " · ".join(caps), size=8.5, fill=C_AMBER, weight=700, anchor="start") + "</g>")
    return "".join(out)


def draw_slab_openings(sh, level_id, arch):
    """the storey's slab openings beyond its own `voids`: a flight's autoVoid, the room below when it is double height"""
    out = []
    for rec in arch.get("voids", []) or []:
        if rec.get("level") != level_id:
            continue
        for v in rec.get("auto", []) or []:
            out.append(draw_void(sh, v))
        for v in rec.get("double", []) or []:
            out.append(draw_void(sh, v))
            x, yy, w, h = sh.rect(v)
            out.append(svg_text(x + w / 2, yy + 12, "OPEN TO BELOW", size=8, fill=C_GOLD, weight=700))
    return "".join(out)


# ---- stairs: a storey's flights as a list, L, U and closed ------------------------------------------------------------------
V1_STAIRS = ("timber", "colonial", "spiral")


def level_stair_list(level):
    st = level.get("stairs")
    if not st:
        return []
    return [x for x in (st if isinstance(st, list) else [st]) if isinstance(x, dict)]


def _flight_svg(sh, fl, dash, going_down, label_extra=""):
    """one flight from its plan (at, rot, w, run, steps): outline, treads, an arrow up (or down) the run"""
    at, rot, w, run, steps = fl["at"], float(fl.get("rot", 0) or 0), float(fl["w"]), float(fl["run"]), max(2, int(fl.get("steps", 14)))
    a = math.radians(rot)
    fr = Frame(sh.pt(float(at[0]), float(at[1])), (math.cos(a), -math.sin(a)), (math.sin(a), math.cos(a)), sh.s)
    out = [f'<polygon points="{fr.poly([(-w / 2, 0), (w / 2, 0), (w / 2, run), (-w / 2, run)])}" fill="rgba(20, 52, 77, 0.45)" stroke="{C_LINE}" stroke-width="1.4"{dash}/>']
    for i in range(1, steps):
        v = run * i / steps
        out.append(fr.line(-w / 2, v, w / 2, v, width=0.8, opacity=0.8))
    return "".join(out), fr


def _arrow(fr, a0, a1, label):
    out = [fr.line(0, a0, 0, a1, stroke=C_AMBER, width=1.6)]
    sgn = 1 if a1 > a0 else -1
    out.append(f'<polygon points="{fr.poly([(0, a1 + sgn * 0.3), (-0.16, a1), (0.16, a1)])}" fill="{C_AMBER}"/>')
    lx, ly = fr.pt(0, a0 - sgn * 0.15)
    out.append(svg_text(lx, ly + 3.5, label, size=9.5, fill=C_AMBER, weight=800))
    return "".join(out)


def draw_flight_run(sh, plan, dash, going_down, typ, level_id):
    """a stair from its resolved plan (plan.json arch.stairs): every flight and the landing, and the arrow along its walking line"""
    op = 0.7 if going_down else 1.0
    out = [f'<g class="stairs stairs-{esc(typ)} {"stairs-dn" if going_down else "stairs-up"} stairs-{esc(plan.get("shape", "straight"))}" opacity="{op}">']
    flights = plan.get("flights", [])
    outline = plan.get("outline", [])
    # the landing (an L or U stair's second outline polygon) under the treads
    if plan.get("landings") and len(outline) >= 3:
        out.append(f'<polygon class="stair-landing" points="{_poly_pts(sh, outline[1])}" fill="rgba(20, 52, 77, 0.6)" stroke="{C_LINE}" stroke-width="1.4"{dash}/>')
    for fl in flights:
        svg, _ = _flight_svg(sh, fl, dash, going_down)
        out.append(svg)
    # the walking line: a polyline first step → last, with an arrowhead at the end that leads on
    path = plan.get("path", [])
    pts = [sh.pt(p[0], p[2]) for p in path]
    if going_down:
        pts = pts[::-1]
    if len(pts) >= 2:
        out.append('<polyline points="' + " ".join(f"{f(x)},{f(y)}" for x, y in pts) + f'" fill="none" stroke="{C_AMBER}" stroke-width="1.6"/>')
        (x0, y0), (x1, y1) = pts[-2], pts[-1]
        ang = math.atan2(y1 - y0, x1 - x0)
        hl = 8.0
        tip = (x1 + math.cos(ang) * hl * 0.6, y1 + math.sin(ang) * hl * 0.6)
        l = (x1 - math.cos(ang) * hl * 0.4 + math.sin(ang) * hl * 0.5, y1 - math.sin(ang) * hl * 0.4 - math.cos(ang) * hl * 0.5)
        r = (x1 - math.cos(ang) * hl * 0.4 - math.sin(ang) * hl * 0.5, y1 - math.sin(ang) * hl * 0.4 + math.cos(ang) * hl * 0.5)
        out.append(f'<polygon points="{f(tip[0])},{f(tip[1])} {f(l[0])},{f(l[1])} {f(r[0])},{f(r[1])}" fill="{C_AMBER}"/>')
        out.append(svg_text(pts[0][0], pts[0][1] + 3.5, "DN" if going_down else "UP", size=9.5, fill=C_AMBER, weight=800))
    out.append("</g>")
    return "\n".join(out)


def draw_level_stairs(sh, level, level_id, spec, arch, going_down=False, only_to=None):
    """every flight on a storey (or, going_down, the flights of the storeys below that arrive on it); a lone timber,
    colonial or spiral flight is v1's drawing, everything else comes from its plan"""
    out = []
    levels = spec.get("levels", []) or []
    by_id = {l.get("id"): l for l in levels}
    src = [level] if not going_down else [o for o in levels if o is not level]
    for lv in src:
        raw = lv.get("stairs")
        for idx, st in enumerate(level_stair_list(lv)):
            if going_down and st.get("to") != level_id:
                continue
            typ = st.get("type", "timber")
            if not isinstance(raw, list) and typ in V1_STAIRS:
                out.append(draw_stairs(sh, st, level_id, spec.get("id", "house"), going_down=going_down))
                continue
            plan = None
            for rec in arch.get("stairs", []) or []:
                if rec.get("from") == lv.get("id") and rec.get("index") == idx:
                    plan = rec
                    break
            dash = ' stroke-dasharray="4,3"' if going_down else ""
            if plan and plan.get("flights"):
                out.append(draw_flight_run(sh, plan, dash, going_down, typ, level_id))
                continue
            # no plan: a straight flight from the spec; a turning one cannot be drawn without it
            at = st.get("at")
            if not (isinstance(at, list) and len(at) >= 2):
                _unrendered.add(f"{spec.get('id', 'house')}/{level_id}: stairs without at")
                continue
            if typ in ("L", "U"):
                _unrendered.add(f"{spec.get('id', 'house')}/{level_id}: {typ} stair needs {spec.get('id')}.plan.json (pnpm run plans) — drawn as its first flight")
            to = by_id.get(st.get("to"), {})
            rise = float(to.get("y", 0) or 0) - float(lv.get("y", 0) or 0) if to else 2.8
            style = st.get("style", "timber") if typ in ("L", "U") else typ
            w = float(st.get("w") or (1.2 if style == "colonial" else 1.1))
            run = float(st.get("run") or STAIR_DIMS["timber"][1])
            steps = max(2, int(round(rise / 0.2)))
            svg, fr = _flight_svg(sh, {"at": at, "rot": st.get("rot", 0), "w": w, "run": run, "steps": steps}, dash, going_down)
            op = 0.7 if going_down else 1.0
            a0, a1 = (run - 0.35, 0.45) if going_down else (0.35, run - 0.45)
            out.append(f'<g class="stairs stairs-{esc(typ)} {"stairs-dn" if going_down else "stairs-up"}" opacity="{op}">{svg}'
                       + _arrow(fr, a0, a1, "DN" if going_down else "UP") + "</g>")
    return "\n".join(out)


# ---- partitions: styles and several doorways ----------------------------------------------------------------------------------
def partition_doors(p):
    """[(centre distance from `from`, width)] — `door`/`doorW` and every `doors[]` entry, in order along the wall"""
    doors = []
    if p.get("door") is not None and float(p.get("doorW", 0.9)) > 0:
        doors.append((float(p["door"]), float(p.get("doorW", 0.9))))
    for d in p.get("doors", []) or []:
        if isinstance(d, dict) and d.get("at") is not None:
            doors.append((float(d["at"]), float(d.get("w", p.get("doorW", 0.9)))))
    return sorted(doors)


def draw_partitions_s2(sh, partitions, level_id, spec_id):
    """partitions with a style (half, posts, slats, glass, arch, bookcase) or several doorways; solid single-door partitions
    are draw_partitions' own"""
    t = sh.int_t()
    out = []
    solid_segs, swings = [], []
    for p in partitions:
        fr_, to_ = p.get("from"), p.get("to")
        if not (isinstance(fr_, list) and isinstance(to_, list) and len(fr_) >= 2 and len(to_) >= 2):
            _unrendered.add(f"{spec_id}/{level_id}: partition without from/to")
            continue
        dx, dz = to_[0] - fr_[0], to_[1] - fr_[1]
        L = math.hypot(dx, dz)
        if L < 1e-6:
            continue
        ux, uz = dx / L, dz / L
        style = p.get("style") or "solid"
        doors = partition_doors(p)
        # the wall's spans between doorways
        cuts, pos = [], 0.0
        half_cap = t / 2 / sh.s
        for c, w in doors:
            d0, d1 = max(0.0, c - w / 2), min(L, c + w / 2)
            if d0 - pos > 0.02:
                cuts.append((pos, d0))
            pos = max(pos, d1)
        if L - pos > 0.02:
            cuts.append((pos, L))
        pt = lambda d: (fr_[0] + ux * d, fr_[1] + uz * d)
        for a, b in cuts:
            A, B = sh.pt(*pt(a)), sh.pt(*pt(b))
            if style in ("solid", "arch"):
                pa = pt(a + (half_cap if a > 0 else 0)); pb = pt(b - (half_cap if b < L else 0))
                solid_segs.append((*sh.pt(*pa), *sh.pt(*pb)))
            elif style == "half":
                out.append(svg_line(*A, *B, stroke=C_INT, width=t * 0.55, cap="butt"))
                out.append(svg_line(*A, *B, stroke=C_INT_FILL, width=max(1.5, t * 0.3), cap="butt"))
            elif style == "glass":
                nx, ny = -uz, ux
                for k in (-1, 1):
                    out.append(svg_line(A[0] + nx * k * 1.6, A[1] + ny * k * 1.6, B[0] + nx * k * 1.6, B[1] + ny * k * 1.6, stroke=C_LINE, width=1.0, opacity=0.9))
                out.append(svg_line(*A, *B, stroke="rgba(114, 221, 212, 0.2)", width=t * 0.5))
            elif style in ("posts", "slats"):
                step = 0.6 if style == "posts" else 0.14
                n = max(1, int((b - a) / step))
                for i in range(n + 1):
                    px, py = sh.pt(*pt(a + (b - a) * i / n))
                    if style == "posts":
                        out.append(f'<rect x="{f(px - 2.5)}" y="{f(py - 2.5)}" width="5" height="5" fill="{C_INT_FILL}" stroke="{C_INT}" stroke-width="1"/>')
                    else:
                        nx, ny = -uz, ux
                        out.append(svg_line(px - nx * t * 0.4, py - ny * t * 0.4, px + nx * t * 0.4, py + ny * t * 0.4, stroke=C_INT, width=1.0))
                out.append(svg_line(*A, *B, stroke=C_INT, width=0.8, opacity=0.6))
            elif style == "bookcase":
                out.append(svg_line(*A, *B, stroke=C_GOLD, width=t * 1.7, cap="butt", opacity=0.55))
                out.append(svg_line(*A, *B, stroke=C_INT_FILL, width=t * 1.1, cap="butt"))
                out.append(svg_line(*A, *B, stroke=C_GOLD, width=0.8, opacity=0.9, dash="2,3"))
            else:
                _unrendered.add(f"{spec_id}/{level_id}: partition style '{style}' — drawn as a solid wall")
                solid_segs.append((*A, *B))
        # doorways: a swing (hinged leaf) for a leaf door; an archway / opening draws the jambs and, for `arch`, a round head
        for c, w in doors:
            d0, d1 = max(0.0, c - w / 2), min(L, c + w / 2)
            hinge = sh.pt(*pt(d0))
            fr = Frame(hinge, (ux, uz), (-uz, ux), sh.s)
            if style in ("arch", "glass", "half") or (style in ("posts", "slats", "bookcase")):
                # no leaf: the jambs and the arch's threshold arc
                for u in (0, d1 - d0):
                    out.append(fr.line(u, 0, u, 0, dv0=-t / 2, dv1=t / 2, stroke=C_INT, width=1.6))
                if style == "arch":
                    r = (d1 - d0) / 2 * sh.s
                    a = sh.pt(*pt(d0)); b = sh.pt(*pt(d1))
                    out.append(f'<path d="M {f(a[0])} {f(a[1])} A {f(r)} {f(r)} 0 0 {fr.sweep(0)} {f(b[0])} {f(b[1])}" fill="none" stroke="{C_INT}" stroke-dasharray="2,3" stroke-width="1"/>')
            else:
                swings.append(draw_door_swing(fr, d1 - d0, t))
    if solid_segs:
        out.insert(0, draw_wall_runs(solid_segs, t, exterior=False))
    out.extend(swings)
    return "\n".join(out)


# ---- features from the builder's plan ---------------------------------------------------------------------------------------
def _poly_pts(sh, pts):
    return " ".join(f"{f(x)},{f(y)}" for x, y in (sh.pt(px, pz) for px, pz in pts))


def _rect_pts(r):
    return [(r["x"], r["z"]), (r["x"] + r["w"], r["z"]), (r["x"] + r["w"], r["z"] + r["d"]), (r["x"], r["z"] + r["d"])]


def _steps_rect(rect, side, at, w, n, run):
    """the run of steps beyond a deck's front edge (side = the way out), centred on `at`"""
    L = n * run
    if side == "S":
        return {"x": at - w / 2, "z": rect["z"] + rect["d"], "w": w, "d": L}
    if side == "N":
        return {"x": at - w / 2, "z": rect["z"] - L, "w": w, "d": L}
    if side == "E":
        return {"x": rect["x"] + rect["w"], "z": at - w / 2, "w": L, "d": w}
    return {"x": rect["x"] - L, "z": at - w / 2, "w": L, "d": w}


def _steps_lines(sh, r, side, n):
    out = []
    for i in range(1, n):
        k = i / n
        if side in ("S", "N"):
            z = r["z"] + (k if side == "S" else 1 - k) * r["d"]
            out.append(svg_line(*sh.pt(r["x"], z), *sh.pt(r["x"] + r["w"], z), width=0.8, opacity=0.8))
        else:
            x = r["x"] + (k if side == "E" else 1 - k) * r["w"]
            out.append(svg_line(*sh.pt(x, r["z"]), *sh.pt(x, r["z"] + r["d"]), width=0.8, opacity=0.8))
    return "".join(out)


RAIL_STROKE = {"glass": C_LINE, "metal": C_WHITE, "spindle": C_GOLD, "colonial": C_GOLD, "timber": C_GOLD, "parapet": C_LINE}


def draw_arch_features(sh, level_id, arch):
    """porches, bays, balconies, terraces, loggias, fireplaces, built-ins and chimney stacks on this storey's sheet"""
    out = []
    for ft in arch.get("features", []) or []:
        if ft.get("level") != level_id:
            continue
        t = ft.get("type")
        g = [f'<g class="arch-feature arch-{esc(t)}">']
        if t == "porch" and _rect_ok(ft.get("rect")):
            r = ft["rect"]
            g.append(f'<polygon points="{_poly_pts(sh, _rect_pts(r))}" fill="url(#deckBoards)" fill-opacity="0.4" stroke="{C_LINE}" stroke-width="1.2" stroke-dasharray="6,4"/>')
            st = ft.get("steps")
            if st:
                sr = _steps_rect(r, ft["side"], st["at"], st["w"], st["n"], st.get("run", 0.3))
                g.append(f'<polygon points="{_poly_pts(sh, _rect_pts(sr))}" fill="rgba(20, 52, 77, 0.45)" stroke="{C_LINE}" stroke-width="1.1"/>')
                g.append(_steps_lines(sh, sr, ft["side"], st["n"]))
            ro = ft.get("roofOver")
            if _rect_ok(ro):
                g.append(f'<polygon points="{_poly_pts(sh, _rect_pts(ro))}" fill="none" stroke="{C_MUTED}" stroke-width="0.9" stroke-dasharray="10,3,2,3" opacity="0.7"/>')
            for px, pz in ft.get("posts", []) or []:
                sx, sy = sh.pt(px, pz)
                rr = max(2.5, float(ft.get("postSize", 0.16)) / 2 * sh.s)
                g.append(f'<circle cx="{f(sx)}" cy="{f(sy)}" r="{f(rr)}" fill="#081c2d" stroke="{C_LINE}" stroke-width="1.2"/>')
            cx, cy = sh.pt(r["x"] + r["w"] / 2, r["z"] + r["d"] / 2)
            g.append(svg_text(cx, cy + 3.5, "PORCH" + (f" · {ft['roof'].upper()} ROOF" if ft.get("roof") not in (None, "none") else ""), size=8.5, fill=C_MUTED, weight=700))
        elif t == "bay" and ft.get("outline"):
            g.append(f'<polygon points="{_poly_pts(sh, ft["outline"])}" fill="rgba(20, 52, 77, 0.35)" stroke="{C_LINE}" stroke-width="{f(max(3.0, sh.ext_t() * 0.4))}" stroke-linejoin="miter"/>')
            xs = [p[0] for p in ft["outline"]]; zs = [p[1] for p in ft["outline"]]
            cx, cy = sh.pt((min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2)
            g.append(svg_text(cx, cy + 3, f"{ft.get('form', 'box').upper()} BAY", size=7.5, fill=C_MUTED, weight=700))
        elif t in ("balcony", "terrace", "loggia") and _rect_ok(ft.get("rect")):
            r = ft["rect"]
            g.append(f'<polygon points="{_poly_pts(sh, _rect_pts(r))}" fill="url(#deckBoards)" fill-opacity="0.35" stroke="{C_LINE}" stroke-width="1.1" stroke-dasharray="6,4"/>')
            col = RAIL_STROKE.get(ft.get("rail"), C_LINE)
            for a, b in ft.get("rails", []) or []:
                g.append(svg_line(*sh.pt(*a), *sh.pt(*b), stroke=col, width=2.4, cap="round", opacity=0.95))
                g.append(svg_line(*sh.pt(*a), *sh.pt(*b), stroke=C_WHITE, width=0.6, cap="round", opacity=0.55))
            if t == "loggia" and ft.get("posts"):
                for a, b in ft.get("rails", []) or []:
                    for k in range(int(ft["posts"]) + 1):
                        u = k / max(1, int(ft["posts"]))
                        sx, sy = sh.pt(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)
                        g.append(f'<rect x="{f(sx - 2.5)}" y="{f(sy - 2.5)}" width="5" height="5" fill="#081c2d" stroke="{C_LINE}" stroke-width="1"/>')
            cx, cy = sh.pt(r["x"] + r["w"] / 2, r["z"] + r["d"] / 2)
            g.append(svg_text(cx, cy + 3.5, t.upper(), size=8.5, fill=C_MUTED, weight=700))
        elif t == "chimney":
            w, d = float(ft.get("w", 0.75)), float(ft.get("d", 0.6))
            cx, cz = ft["at"]
            r = {"x": cx - w / 2, "z": cz - d / 2, "w": w, "d": d}
            dash = "" if ft.get("outside") else ' stroke-dasharray="3,3"'
            g.append(f'<polygon points="{_poly_pts(sh, _rect_pts(r))}" fill="rgba(200, 157, 85, 0.18)" stroke="{C_GOLD}" stroke-width="1.4"{dash}/>')
            a, b, c2, d2 = (sh.pt(*p) for p in _rect_pts(r))
            g.append(svg_line(*a, *c2, stroke=C_GOLD, width=0.9, opacity=0.8) + svg_line(*b, *d2, stroke=C_GOLD, width=0.9, opacity=0.8))
            sx, sy = sh.pt(cx, cz)
            g.append(svg_text(sx, sy - max(6.0, d / 2 * sh.s) - 3, "FLUE", size=7.5, fill=C_GOLD, weight=700))
        elif t == "fireplace":
            w = float(ft.get("w", 1.8)); rot = float(ft.get("rot", 0) or 0)
            bx, bz = ft.get("back") or ft["at"]
            g.append(item_rect_svg(sh, ft["at"][0], ft["at"][1], w + 0.3, 0.55, rot, cls="hearth", fill="rgba(200, 157, 85, 0.16)", stroke=C_GOLD, width=1.1))
            g.append(item_rect_svg(sh, bx, bz, w, 0.42, rot, cls="breast", fill="rgba(20, 52, 77, 0.6)", stroke=C_LINE, width=1.2))
            sx, sy = sh.pt(ft["at"][0], ft["at"][1])
            g.append(svg_text(sx, sy + 3, "FIRE", size=7.5, fill=C_GOLD, weight=700))
        elif t == "builtin":
            fr_, to_ = ft.get("from"), ft.get("to")
            if isinstance(fr_, list) and isinstance(to_, list):
                dx, dz = to_[0] - fr_[0], to_[1] - fr_[1]
                L = math.hypot(dx, dz)
                if L > 0.3:
                    ux, uz = dx / L, dz / L
                    nx, nz = (uz, -ux) if ft.get("face", "left") == "left" else (-uz, ux)
                    dep = float(ft.get("d", 0.38)); off = 0.1
                    q = [(fr_[0] + nx * off, fr_[1] + nz * off), (to_[0] + nx * off, to_[1] + nz * off), (to_[0] + nx * (off + dep), to_[1] + nz * (off + dep)), (fr_[0] + nx * (off + dep), fr_[1] + nz * (off + dep))]
                    g.append(f'<polygon points="{_poly_pts(sh, q)}" fill="rgba(200, 157, 85, 0.14)" stroke="{C_GOLD}" stroke-width="1"/>')
                    n = max(2, int(L / 0.6))
                    for i in range(1, n):
                        u = i / n
                        a = (q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[1][1] - q[0][1]) * u)
                        b = (q[3][0] + (q[2][0] - q[3][0]) * u, q[3][1] + (q[2][1] - q[3][1]) * u)
                        g.append(svg_line(*sh.pt(*a), *sh.pt(*b), stroke=C_GOLD, width=0.6, opacity=0.7))
        else:
            continue
        g.append("</g>")
        out.append("".join(g))
    return "\n".join(out)


def draw_arch_stoop(sh, level_id, arch):
    st = arch.get("stoop")
    if not st or st.get("level") != level_id or not _rect_ok(st.get("landing")):
        return ""
    out = ['<g class="arch-stoop">']
    out.append(f'<polygon points="{_poly_pts(sh, _rect_pts(st["landing"]))}" fill="url(#stoneTile)" stroke="{C_LINE}" stroke-width="1.2"/>')
    if _rect_ok(st.get("stairs")):
        out.append(f'<polygon points="{_poly_pts(sh, _rect_pts(st["stairs"]))}" fill="rgba(20, 52, 77, 0.45)" stroke="{C_LINE}" stroke-width="1.1"/>')
        out.append(_steps_lines(sh, st["stairs"], st["side"], max(2, int(st.get("steps", 3)))))
    lx, ly = sh.pt(st["landing"]["x"] + st["landing"]["w"] / 2, st["landing"]["z"] + st["landing"]["d"] / 2)
    out.append(svg_text(lx, ly + 3, "STOOP", size=7.5, fill=C_MUTED, weight=700))
    out.append("</g>")
    return "".join(out)


def draw_volume_marks(sh, level_id, arch):
    out = []
    for v in arch.get("volumes", []) or []:
        if v.get("level") != level_id or not _rect_ok(v.get("rect")):
            continue
        x, yy, w, h = sh.rect(v["rect"])
        out.append(f'<g class="arch-volume"><rect x="{f(x)}" y="{f(yy)}" width="{f(w)}" height="{f(h)}" fill="none" stroke="{C_GOLD}" stroke-width="1" stroke-dasharray="2,3" opacity="0.8"/>'
                   + svg_text(x + 5, yy + h - 6, f"H {v['h']:g} m", size=8, fill=C_GOLD, weight=700, anchor="start") + "</g>")
    return "".join(out)


# -----------------------------------------------------------------------------
# level sheet
# -----------------------------------------------------------------------------
def render_level(spec, level, n, sh=None, view_mode="lot"):
    spec_id = spec.get("id", "house")
    level_id = level.get("id", f"l{n}")
    rects = [r for r in level.get("footprint", []) if all(k in r for k in ("x", "z", "w", "d"))]
    if not rects:
        _unrendered.add(f"{spec_id}/{level_id}: no footprint rects — sheet skipped")
        return None
    lot = spec.get("lot", {}) or {}
    lot_w, lot_d = float(lot.get("w", 30) or 30), float(lot.get("d", 24) or 24)
    fx0, fz0, fx1, fz1 = footprint_bbox(rects)
    if sh is None:
        sh, view_mode = spec_view(spec)      # +Z (south) is DOWN the page
    edges = perimeter_edges(rects)
    y = float(level.get("y", 0) or 0)
    elev = elev_str(y)
    level_name = level.get("name") or f"Level {n}"
    sheet_no = level.get("sheet") or f"A-10{n}"
    title = f"{spec.get('name', spec_id)} — Level {n}: {level_name}"

    svg = [svg_header(SHEET_W, SHEET_H, title)]

    # lot boundary (clipped to the plan area when the view is zoomed to the building)
    lx, ly = sh.pt(-lot_w / 2, -lot_d / 2)
    svg.append(f'<rect class="lot" clip-path="url(#planClip)" x="{f(lx)}" y="{f(ly)}" width="{f(lot_w * sh.s)}" height="{f(lot_d * sh.s)}" fill="none" stroke="{C_LINE}" stroke-width="1" stroke-dasharray="10,6" opacity="0.35"/>')
    lot_note = f"LOT {lot_w:g} × {lot_d:g} m · {str(lot.get('ground', 'lawn')).upper()}"
    if view_mode != "lot":
        lot_note += "  ·  VIEW CROPPED TO " + ("BUILDING + SITE" if view_mode == "site" else "BUILDING")
    svg.append(svg_text(PLAN_BOX[0], PLAN_BOX[3] + 16, lot_note, size=10, fill=C_MUTED, weight=600, anchor="start"))

    # site outlines (level 1 only): pool / deck / porch
    if n == 1:
        for s_ in spec.get("site", []) or []:
            svg.append(draw_site_outline(sh, s_))

    # ghost of the level below (roof / footprint outline) on upper sheets
    levels = spec.get("levels", []) or []
    if n > 1 and n - 2 < len(levels):
        below = [r for r in levels[n - 2].get("footprint", []) or [] if all(k in r for k in ("x", "z", "w", "d"))]
        if below:
            svg.append('<g class="level-below" opacity="0.35">')
            for e in perimeter_edges(below):
                x0, y0 = sh.pt(*e["a"]); x1, y1 = sh.pt(*e["b"])
                svg.append(svg_line(x0, y0, x1, y1, stroke=C_LINE, width=1, dash="5,5"))
            svg.append("</g>")

    # floor slab fill
    pat = FLOOR_PATTERN.get(level.get("floor", "oak"), "woodParquet")
    svg.append('<g class="floor">')
    for r in rects:
        x, yy, w, h = sh.rect(r)
        svg.append(f'<rect x="{f(x)}" y="{f(yy)}" width="{f(w)}" height="{f(h)}" fill="url(#{pat})"/>')
    svg.append("</g>")

    # S2: the builder's resolved architecture (plan.json `arch`) — per-room floors over the slab fill
    arch = load_arch(spec_id)
    room_floors_svg, used_pats = draw_room_floors(sh, level, rects, arch, level_id)
    if room_floors_svg:
        extra_defs = "".join(EXTRA_PATTERNS[p_] for p_ in sorted(used_pats) if p_ in EXTRA_PATTERNS)
        if extra_defs:
            svg.append("<defs>" + extra_defs + "</defs>")
        svg.append(room_floors_svg)

    # voids (slab cut-outs)
    for v in level.get("voids", []) or []:
        if all(k in v for k in ("x", "z", "w", "d")):
            svg.append(draw_void(sh, v))
    slab_svg = draw_slab_openings(sh, level_id, arch)
    if slab_svg:
        svg.append(slab_svg)

    # room zoning outlines (faint) + furniture
    rooms = level.get("rooms", []) or []
    svg.append('<g class="rooms">')
    for room in rooms:
        b = room.get("bounds")
        if not (isinstance(b, dict) and all(k in b for k in ("x", "z", "w", "d"))):
            continue
        x, yy, w, h = sh.rect(b)
        svg.append(f'<rect x="{f(x)}" y="{f(yy)}" width="{f(w)}" height="{f(h)}" fill="none" stroke="{C_LINE}" stroke-width="0.6" stroke-dasharray="2,4" opacity="0.35"/>')
    svg.append("</g>")
    svg.append('<g class="furniture">')
    for room in rooms:
        for it in room.get("items", []) or []:
            svg.append(draw_item(sh, it, level_id, spec_id))
    svg.append("</g>")

    # S2: room marks, features (porch, bay, balcony, terrace, loggia, chimney, fireplace, built-ins), the stoop, towers
    for extra_svg in (draw_room_marks(sh, level, arch, level_id), draw_arch_features(sh, level_id, arch),
                      draw_arch_stoop(sh, level_id, arch), draw_volume_marks(sh, level_id, arch)):
        if extra_svg:
            svg.append(extra_svg)

    # stairs: UP on this level; DN where a lower level's stairs arrive here. A lone timber, colonial or spiral flight per
    # storey is v1's drawing; a list, L, U or closed flights (S2) are drawn from their plan
    levels_ = spec.get("levels", []) or []
    if any(isinstance(l_.get("stairs"), list) or (isinstance(l_.get("stairs"), dict) and l_["stairs"].get("type", "timber") not in V1_STAIRS) for l_ in levels_):
        svg.append(draw_level_stairs(sh, level, level_id, spec, arch, going_down=False))
        svg.append(draw_level_stairs(sh, level, level_id, spec, arch, going_down=True))
    else:
        if level.get("stairs"):
            svg.append(draw_stairs(sh, level["stairs"], level_id, spec_id, going_down=False))
        for other in spec.get("levels", []) or []:
            st = other.get("stairs")
            if other is not level and isinstance(st, dict) and st.get("to") == level_id:
                svg.append(draw_stairs(sh, st, level_id, spec_id, going_down=True))

    # balustrades
    for b in level.get("balustrades", []) or []:
        svg.append(draw_balustrade(sh, b))

    # interior partitions (with door gaps + swings); S2's styled partitions and partitions with several doorways are drawn apart
    parts_ = level.get("partitions", []) or []
    fancy = [p_ for p_ in parts_ if isinstance(p_, dict) and ((p_.get("style") or "solid") != "solid" or p_.get("doors"))]
    if fancy:
        svg.append(draw_partitions(sh, [p_ for p_ in parts_ if p_ not in fancy], level_id, spec_id))
        svg.append(draw_partitions_s2(sh, fancy, level_id, spec_id))
    else:
        svg.append(draw_partitions(sh, parts_, level_id, spec_id))

    # perimeter walls from the footprint union, then openings cut into them
    t_ext = sh.ext_t()
    segs = [(*sh.pt(*e["a"]), *sh.pt(*e["b"])) for e in edges]
    svg.append(draw_wall_runs(segs, t_ext, exterior=True))
    for op in level.get("openings", []) or []:
        svg.append(draw_perimeter_opening(sh, edges, op, level_id, spec_id))

    # entry + hero markers
    entry = spec.get("entry") or {}
    if entry.get("level") == level_id:
        svg.append(draw_entry_marker(sh, edges, entry))
    hero = spec.get("hero") or {}
    if hero.get("level") == level_id:
        svg.append(draw_hero_marker(sh, hero))

    # room labels (on top) — measured first so overlapping tags can be nudged apart
    labels = []
    for room in rooms:
        b = room.get("bounds")
        if not (isinstance(b, dict) and all(k in b for k in ("x", "z", "w", "d"))):
            continue
        cx, cy = sh.pt(b["x"] + b["w"] / 2, b["z"] + b["d"] / 2)
        area = round(b["w"] * b["d"], 1)
        w_px, scale = room_label_size(str(room.get("no", "")), str(room.get("name", "Room")), area, elev, b["w"] * sh.s - 8)
        rx0, ry0 = sh.pt(b["x"], b["z"]); rx1, ry1 = sh.pt(b["x"] + b["w"], b["z"] + b["d"])
        labels.append({"cx": cx, "cy": cy, "w": w_px * scale, "h": 48 * scale, "room": (rx0, ry0, rx1, ry1),
                       "no": str(room.get("no", "")), "name": str(room.get("name", "Room")), "area": area, "max_w": b["w"] * sh.s - 8})
    for lb in place_room_labels(labels):
        svg.append(draw_room_label(lb["cx"], lb["cy"], lb["no"], lb["name"], lb["area"], elev, max_w=lb["max_w"]))

    # overall dimensions (building bbox): width along the top, depth along the left
    px0, py0 = sh.pt(fx0, fz0); px1, py1 = sh.pt(fx1, fz1)
    svg.append(draw_dimension(px0, py0 - t_ext / 2, px1, py0 - t_ext / 2, imperial(fx1 - fx0), 40))
    svg.append(draw_dimension(px0 - t_ext / 2, py0, px0 - t_ext / 2, py1, imperial(fz1 - fz0), 40, True))

    svg.append(svg_footer(SHEET_W, SHEET_H, spec.get("name", spec_id), spec.get("author", "—"), sheet_no,
                          f"LEVEL {n} · {level_name}", sh.s))
    return "\n".join(svg)


# -----------------------------------------------------------------------------
# floorplans.json entry for a spec
# -----------------------------------------------------------------------------
def room_items(room):
    counts, order = {}, []
    for it in room.get("items", []) or []:
        name = pretty_item(it.get("type", "item"))
        if name not in counts:
            order.append(name)
        counts[name] = counts.get(name, 0) + 1
    return [n if counts[n] == 1 else f"{n} ×{counts[n]}" for n in order]


def build_entry(spec):
    levels = spec.get("levels", []) or []
    if "areaSqm" in spec and isinstance(spec["areaSqm"], (int, float)):
        total = float(spec["areaSqm"])
    else:
        total = sum(union_area([r for r in lv.get("footprint", []) if all(k in r for k in ("x", "z", "w", "d"))] or [])
                    for lv in levels if lv.get("footprint"))
    total = round(total, 1)
    out_levels = []
    for n, lv in enumerate(levels, start=1):
        elev = elev_str(float(lv.get("y", 0) or 0))
        rooms = []
        for room in lv.get("rooms", []) or []:
            b = room.get("bounds") or {}
            area = round(float(b.get("w", 0)) * float(b.get("d", 0)), 1) if b else 0.0
            rooms.append({"no": str(room.get("no", "")), "name": str(room.get("name", "Room")),
                          "area_sqm": area, "elev": elev, "items": room_items(room)})
        out_levels.append({"level": n, "title": lv.get("name") or f"Level {n}", "sheet": lv.get("sheet") or f"A-10{n}",
                           "svg": f"{SVG_REL_DIR}/fp-{spec['id']}-l{n}.svg", "rooms": rooms})
    return {"id": spec["id"], "title": spec.get("name", spec["id"]), "author": spec.get("author", ""),
            "style": spec.get("style", ""), "total_area_sqm": total,
            "total_area_sqft": int(round(total * SQFT_PER_SQM)), "levels": out_levels}


# -----------------------------------------------------------------------------
# main
# -----------------------------------------------------------------------------
def load_specs():
    specs = {}
    if not HOUSES_DIR.is_dir():
        print(f"WARNING: {HOUSES_DIR} does not exist — no specs to render")
        return specs
    for path in sorted(HOUSES_DIR.glob("*.json")):
        if path.name == "index.json":       # generated catalog, not a HouseSpec
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                spec = json.load(fh)
        except (json.JSONDecodeError, OSError) as e:
            print(f"WARNING: skipping {path.name}: {e}")
            continue
        if not isinstance(spec, dict) or not spec.get("id") or not isinstance(spec.get("levels"), list):
            print(f"WARNING: skipping {path.name}: not a HouseSpec (needs id + levels)")
            continue
        if spec["id"] != path.stem:
            print(f"WARNING: {path.name}: id '{spec['id']}' != file name — using the spec id")
        specs[spec["id"]] = spec
    return specs


def load_previous_json():
    p = FLOORPLAN_DIR / "floorplans.json"
    if not p.exists():
        return {}
    try:
        with open(p, encoding="utf-8") as fh:
            data = json.load(fh)
        return {b["id"]: b for b in data.get("builds", []) if isinstance(b, dict) and "id" in b}
    except (json.JSONDecodeError, OSError) as e:
        print(f"WARNING: could not read previous floorplans.json ({e}) — legacy fallback unavailable")
        return {}


def export_png(svg_path, png_path):
    tool = shutil.which("rsvg-convert")
    if not tool:
        return False, "rsvg-convert not found on PATH"
    try:
        subprocess.run([tool, "-w", str(SHEET_W), "-h", str(SHEET_H), str(svg_path), "-o", str(png_path)],
                       check=True, capture_output=True, text=True)
        return True, ""
    except subprocess.CalledProcessError as e:
        return False, (e.stderr or "").strip()


def main(argv=None):
    global HOUSES_DIR, FLOORPLAN_DIR
    ap = argparse.ArgumentParser(description="HouseSpec v1 → CAD blueprint floor-plan sheets + floorplans.json")
    ap.add_argument("--specs", metavar="DIR", help="read the specs (and their <id>.plan.json) from DIR instead of content/houses "
                                                     "(scripts/test-twins.mts proves the twins on test/fixtures/houses this way)")
    ap.add_argument("--out", metavar="DIR", help="write the sheets and floorplans.json to DIR instead of scenes/floorplans")
    ap.add_argument("--only", metavar="ID", help="render sheets for this spec id only (floorplans.json still lists every spec)")
    ap.add_argument("--dry-run", action="store_true", help="report what would be generated; write nothing")
    ap.add_argument("--no-png", action="store_true", help="skip PNG export (rsvg-convert)")
    ap.add_argument("--fit", choices=("auto", "lot", "content"), default="auto",
                    help="sheet framing: lot = whole lot; content = building + site outlines; auto = lot while ≥%g px/m else content" % MIN_LEGIBLE_SCALE)
    args = ap.parse_args(argv)
    if args.specs:
        HOUSES_DIR = Path(args.specs).resolve()
    if args.out:
        FLOORPLAN_DIR = Path(args.out).resolve()

    specs = load_specs()
    if not specs:
        print("No HouseSpec files found — nothing to do.")
        return 1
    if args.only and args.only not in specs:
        print(f"ERROR: --only {args.only}: no such spec. Known: {', '.join(sorted(specs))}")
        return 2

    previous = load_previous_json()
    if not args.dry_run:
        FLOORPLAN_DIR.mkdir(parents=True, exist_ok=True)
    print(f"{'[dry-run] ' if args.dry_run else ''}Rendering CAD sheets → {FLOORPLAN_DIR}")

    produced = []
    render_ids = [args.only] if args.only else list(specs)
    for sid in render_ids:
        spec = specs[sid]
        sh, mode = spec_view(spec, args.fit)
        print(f"  {sid}: {mode} fit, {sh.s:.1f} px/m")
        for n, level in enumerate(spec.get("levels", []), start=1):
            svg = render_level(spec, level, n, sh, mode)
            if svg is None:
                continue
            name = f"fp-{sid}-l{n}.svg"
            out_path = FLOORPLAN_DIR / name
            if args.dry_run:
                print(f"  would write {name} ({len(svg)} bytes)")
            else:
                with open(out_path, "w", encoding="utf-8") as fh:
                    fh.write(svg)
                msg = f"  --> {name} ({len(svg)} bytes)"
                if not args.no_png:
                    ok, err = export_png(out_path, out_path.with_suffix(".png"))
                    msg += "  + png" if ok else f"  (png skipped: {err})"
                print(msg)
            produced.append(name)

    # floorplans.json — every spec, legacy ids first (falling back to their previous entry)
    builds, seen = [], set()
    for lid in LEGACY_IDS:
        if lid in specs:
            builds.append(build_entry(specs[lid]))
        elif lid in previous:
            print(f"  note: no spec for legacy build '{lid}' — keeping its previous floorplans.json entry")
            builds.append(previous[lid])
        seen.add(lid)
    for sid in sorted(specs):
        if sid not in seen:
            builds.append(build_entry(specs[sid]))
    db = {"builds": builds}
    json_path = FLOORPLAN_DIR / "floorplans.json"
    if args.dry_run:
        print(f"  would write floorplans.json with {len(builds)} builds: {', '.join(b['id'] for b in builds)}")
    else:
        with open(json_path, "w", encoding="utf-8") as fh:
            json.dump(db, fh, indent=2, ensure_ascii=False)
        print(f"Saved floor plan database → {json_path} ({len(builds)} builds)")

    if _unrendered:
        print("Spec features not (fully) rendered:")
        for m in sorted(_unrendered):
            print(f"  - {m}")
    print(f"Sheets: {', '.join(produced) if produced else '(none)'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
