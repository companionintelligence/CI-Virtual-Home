#!/usr/bin/env python3
"""
generate_house_iso.py — HouseSpec v1 → Sims-style isometric CUTAWAY "blueprint" scenes.

Reads every HouseSpec in content/houses/*.json (schema: reference/HOUSE-SPEC.md)
and derives, from the SAME spec the Three.js room-creator and the CAD floor-plan generator consume:

    scenes/svg/house-<id>.svg            3840×2160 landscape isometric cutaway
    scenes/svg/house-<id>.mobile.svg     1080×1920 portrait isometric cutaway
    scenes/lottie-scenes/house-<id>.json 1920×1080 pure-vector lottie-web animation
                                         (house pop-in, pulsing Companion Core, spinning Sims plumbob)
    scenes/manifest.json                 "houses": [...], merged by entry id (other top-level keys are kept)

Camera: south-east isometric (the existing generate_sims_scenes.py `iso()` projection). Spec X (east) → iso x,
spec Z (south) → iso y, spec Y (up) → iso z. Perimeter walls on the N and W sides are drawn full height; walls on the
S and E sides (the ones facing the camera) are 0.85 m cutaway stubs, so the interior reads like a SimsTree cutaway.
Levels above the `hero` storey are removed (Sims floor view); roofs are drawn only for flat roofs on massing below the
hero storey (pitched roofs are always removed by the cutaway).

Reuses generate_sims_scenes.py primitives: iso/poly/line/rect_prism, render_stairs, render_platform_bed,
render_sectional_sofa, render_kitchen_island, render_coffee_table, render_botanical, and the Companion Core drawing;
and generate_isometric_scenes.py lottie helpers (path/fill/stroke/group/layer/kf/anim).

Usage:
    pnpm run iso [--only <id>] [--png] [--png-dir DIR]
    python3 scripts/generate_house_iso.py [--only <id>] [--png] [--png-dir DIR]     (any cwd — paths resolve from this file)
    python3 scripts/generate_house_iso.py --specs DIR --out DIR    specs (and their <id>.plan.json) from DIR, scenes under DIR
                                                                   (scripts/test-twins.mts proves the twin on the fixtures)

What the three.js builder resolved beyond the spec — the flights that turn or come in arrays, porches, bays, decks, chimney
stacks, the stoop, a raised storey's foundation — comes from <id>.plan.json's `arch` key (assets/plan-export/arch.ts).

Every path here is relative to the repo root; scenes/manifest.json's entries are too, so a page at the root
(a sibling of room-creator.html) can use them as they are.
"""

import argparse
import heapq
import json
import math
import random
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import generate_sims_scenes as sims          # noqa: E402  (isometric SVG primitives + furniture renderers)
import generate_isometric_scenes as lot      # noqa: E402  (lottie shape/animation helpers)

ROOT = SCRIPT_DIR.parent  # the repo root
HOUSES_DIR = ROOT / "content" / "houses"
SCENES_DIR = ROOT / "scenes"
SVG_DIR = SCENES_DIR / "svg"
LOTTIE_DIR = SCENES_DIR / "lottie-scenes"
RENDERS_DIR = SCENES_DIR / "renders"
MANIFEST_PATH = SCENES_DIR / "manifest.json"

COS30, SIN30 = sims.COS30, sims.SIN30

# ---------------------------------------------------------------------------
# Cutaway / construction constants (metres)
# ---------------------------------------------------------------------------
CUT_H = 0.85        # height of the cut-away S / E perimeter walls and interior partitions
WALL_T = 0.22       # perimeter wall thickness
PART_T = 0.12       # partition thickness
SLAB_T = 0.25       # upper-floor slab thickness
DESK_TOP = 0.77     # hero desk top (matches house-builder.js DESK_TOP)
STAIR_RUN = 3.36    # straight stair run (matches house-builder.js default)
EPS = 1e-3

# Item catalog: type -> (w, d, h). Footprints from HOUSE-SPEC.md, heights are sensible defaults.
CATALOG = {
    "sectional": (3.2, 2.0, 0.85), "club-chair": (0.9, 0.9, 0.8), "coffee-table": (1.2, 0.6, 0.4),
    "octagonal-table": (1.2, 1.2, 0.75), "dining-set": (2.0, 0.95, 0.75), "dining-table": (2.1, 1.0, 0.75),
    "kitchen-island": (2.4, 0.9, 0.9), "kitchen-cabinetry": (3.6, 0.65, 0.9), "media-credenza": (1.8, 0.45, 0.55),
    "wall-tv": (1.6, 0.1, 0.9), "fireplace": (1.6, 0.5, 1.2), "area-rug": (3.2, 2.2, 0.0), "circular-rug": (4.0, 4.0, 0.0),
    "concentric-rug": (3.2, 3.2, 0.0), "sun-lounger": (0.7, 2.0, 0.4), "bench": (1.8, 0.5, 0.45),
    "platform-bed": (2.2, 2.3, 0.6), "wardrobe": (2.2, 0.6, 2.1), "crib": (1.3, 0.7, 0.9), "ensuite": (2.4, 2.0, 0.85),
    "bookshelf": (1.2, 0.35, 2.0), "walnut-desk": (1.6, 0.8, 0.77), "task-chair": (0.6, 0.6, 0.9),
    "curved-monitor": (0.8, 0.2, 0.42), "chalk-tower": (0.232, 0.205, 0.09), "charcoal-tower": (0.232, 0.205, 0.09), "core-shelf": (0.9, 0.26, 1.0),
    "strix-mini": (0.3, 0.3, 0.15), "speakers": (0.5, 0.2, 0.3), "halo-lamp": (0.4, 0.4, 1.6),
    "fiddle-leaf": (0.8, 0.8, 1.8), "monstera": (0.9, 0.9, 1.6), "bonsai": (0.6, 0.6, 1.2), "bamboo": (0.6, 0.6, 1.5),
    "cactus-group": (0.8, 0.8, 1.5), "telescope": (0.6, 0.6, 1.5), "soccer-goal": (1.8, 0.6, 1.2), "low-wall": (2.0, 0.2, 0.9),
}
ON_SURFACE = {"curved-monitor", "chalk-tower", "charcoal-tower", "strix-mini", "speakers"}
PLANT_SPECIES = {"fiddle-leaf": "fiddle_leaf", "monstera": "monstera", "bonsai": "bonsai", "bamboo": "bamboo",
                 "cactus-group": "saguaro_agave"}

GROUND_COLS = {
    "lawn": ("#8cc46f", "#6ea355", "#55843f"), "desert": ("#dcc08a", "#c4a86f", "#a68b56"),
    "forest": ("#6f9b5c", "#557d45", "#3f6233"), "urban": ("#a9a9a3", "#8d8d87", "#6f6f6a"),
    "waterfront": ("#9dc98a", "#7aa96a", "#5d8850"),
}
FLOOR_STYLES = {  # base colour, line colour, line spacing (m), along ('x' | 'z' | 'grid' | 'speckle')
    "oak": ("#d8be9b", "#bba07e", 0.25, "x"), "terrazzo": ("#e8e6e1", "#c9c5b9", 0.0, "speckle"),
    "phthalo-terrazzo": ("#2f6e66", "#5fa39a", 0.0, "speckle"), "marble": ("#f1f0ec", "#dcdad2", 0.9, "grid"),
    "concrete": ("#b5b1a6", "#9e9a90", 1.2, "grid"), "deck": ("#a88b68", "#8a7050", 0.18, "x"),
    "tile": ("#dedad0", "#c4c0b4", 0.6, "grid"), "grass": ("#8cc46f", "#75ad5d", 0.0, "speckle"),
    "lawn": ("#8cc46f", "#75ad5d", 0.0, "speckle"),
}
LIGHTING_BG = {  # top, mid, bottom of the canvas gradient
    "pascal-daylight": ("#dbeefc", "#eef6fb", "#f6f8f5"), "ci-dark": ("#041620", "#072533", "#020e14"),
    "ci-mist": ("#e3efe9", "#f3faf7", "#e8f2ec"), "ci-biophilic": ("#d8ecdf", "#e9f5ec", "#f3faf7"),
    "ci-twilight": ("#22304a", "#4a3b5e", "#7a4f63"),
}
DEVICE_COLS = {
    "chalk": ("#ffffff", "#e8eeed", "#d2dbda"), "charcoal": ("#22303a", "#162027", "#10171d"),
    "strix": ("#3a444c", "#283036", "#1a2024"), "strix-mini": ("#3a444c", "#283036", "#1a2024"),
}
CI_TEAL, CI_AQUA, CI_AMBER, CI_COPPER = "#0a6358", "#72ddd4", "#ffb900", "#c86432"


# ---------------------------------------------------------------------------
# Fix for the upstream rect_prism: its "left" (south) face repeats vertex 0 instead of the top-left corner and so
# renders as a triangle. Same signature; patched into the sims module so the reused furniture renderers use it too.
# ---------------------------------------------------------------------------
def rect_prism(x, y, z, dx, dy, dz, cx, cy, scale, top_c, left_c, right_c, stroke="none", stroke_w=1, opacity=1.0):
    iso = sims.iso
    t = [iso(x, y, z + dz, cx, cy, scale), iso(x + dx, y, z + dz, cx, cy, scale), iso(x + dx, y + dy, z + dz, cx, cy, scale), iso(x, y + dy, z + dz, cx, cy, scale)]
    l = [iso(x, y + dy, z, cx, cy, scale), iso(x + dx, y + dy, z, cx, cy, scale), iso(x + dx, y + dy, z + dz, cx, cy, scale), iso(x, y + dy, z + dz, cx, cy, scale)]
    r = [iso(x + dx, y, z, cx, cy, scale), iso(x + dx, y + dy, z, cx, cy, scale), iso(x + dx, y + dy, z + dz, cx, cy, scale), iso(x + dx, y, z + dz, cx, cy, scale)]
    return "\n".join([
        sims.poly(r, fill=right_c, stroke=stroke, stroke_w=stroke_w, opacity=opacity),
        sims.poly(l, fill=left_c, stroke=stroke, stroke_w=stroke_w, opacity=opacity),
        sims.poly(t, fill=top_c, stroke=stroke, stroke_w=stroke_w, opacity=opacity),
    ])


sims.rect_prism = rect_prism


# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
def hex_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_hex(r, g, b):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(v)))) for v in (r, g, b))


def mix(c1, c2, t):
    a, b = hex_rgb(c1), hex_rgb(c2)
    return rgb_hex(*[a[i] + (b[i] - a[i]) * t for i in range(3)])


def shade(c, k):
    """k > 0 lightens toward white, k < 0 darkens toward black."""
    return mix(c, "#ffffff", k) if k >= 0 else mix(c, "#000000", -k)


def triplet(base, top=0.10, left=0.0, right=-0.18):
    return (shade(base, top), shade(base, left), shade(base, right))


# ---------------------------------------------------------------------------
# Plan geometry (port of assets/house-geometry.ts perimeterEdges / outlineLoops / rectArea)
# ---------------------------------------------------------------------------
def in_rect(px, pz, r, tol=0.01):
    return r["x"] - tol <= px <= r["x"] + r["w"] + tol and r["z"] - tol <= pz <= r["z"] + r["d"] + tol


def union_bounds(rects):
    return (min(r["x"] for r in rects), max(r["x"] + r["w"] for r in rects),
            min(r["z"] for r in rects), max(r["z"] + r["d"] for r in rects))


def rasterise(rects, holes=(), cell=0.1):
    min_x, max_x, min_z, max_z = union_bounds(rects)
    nx, nz = int(round((max_x - min_x) / cell)), int(round((max_z - min_z) / cell))
    grid = set()
    for i in range(nx):
        cxm = min_x + (i + 0.5) * cell
        for k in range(nz):
            czm = min_z + (k + 0.5) * cell
            if any(in_rect(cxm, czm, r, -1e-9) for r in rects) and not any(in_rect(cxm, czm, h, -1e-9) for h in holes):
                grid.add((i, k))
    return min_x, min_z, nx, nz, grid


def perimeter_edges(rects, holes=(), cell=0.1):
    """[{side, a:[x,z], b:[x,z], length}] — a→b runs +X for S/N edges and +Z for E/W edges."""
    min_x, min_z, nx, nz, grid = rasterise(rects, holes, cell)
    edges = []
    for (i, k) in grid:
        x0, z0 = min_x + i * cell, min_z + k * cell
        x1, z1 = x0 + cell, z0 + cell
        if (i, k + 1) not in grid: edges.append(("S", (x0, z1), (x1, z1)))
        if (i, k - 1) not in grid: edges.append(("N", (x0, z0), (x1, z0)))
        if (i + 1, k) not in grid: edges.append(("E", (x1, z0), (x1, z1)))
        if (i - 1, k) not in grid: edges.append(("W", (x0, z0), (x0, z1)))
    merged = []
    for side in ("S", "N", "E", "W"):
        horiz = side in ("S", "N")
        runs = sorted([e for e in edges if e[0] == side],
                      key=(lambda e: (round(e[1][1], 6), e[1][0])) if horiz else (lambda e: (round(e[1][0], 6), e[1][1])))
        cur = None
        for _, a, b in runs:
            same_line = cur and abs((cur["a"][1] - a[1]) if horiz else (cur["a"][0] - a[0])) < 1e-6
            contiguous = cur and abs((cur["b"][0] - a[0]) if horiz else (cur["b"][1] - a[1])) < 1e-6
            if same_line and contiguous:
                cur["b"] = b
            else:
                if cur: merged.append(cur)
                cur = {"side": side, "a": list(a), "b": list(b)}
        if cur: merged.append(cur)
    rnd = lambda v: round(v, 3)
    for e in merged:
        e["a"] = [rnd(e["a"][0]), rnd(e["a"][1])]; e["b"] = [rnd(e["b"][0]), rnd(e["b"][1])]
        e["length"] = rnd(math.hypot(e["b"][0] - e["a"][0], e["b"][1] - e["a"][1]))
    return merged


def edge_for_opening(edges, side, at):
    horiz = side in ("S", "N")
    for e in edges:
        if e["side"] != side: continue
        lo, hi = (e["a"][0], e["b"][0]) if horiz else (e["a"][1], e["b"][1])
        if lo - 1e-6 <= at <= hi + 1e-6: return e
    return None


def outline_loops(edges):
    """Closed loops [(x,z),...] tracing the union outline (outer loops CCW on plan, holes CW)."""
    key = lambda p: (round(p[0], 3), round(p[1], 3))
    oriented = []
    for e in edges:
        if e["side"] == "S": oriented.append((tuple(e["a"]), tuple(e["b"])))
        elif e["side"] == "N": oriented.append((tuple(e["b"]), tuple(e["a"])))
        elif e["side"] == "E": oriented.append((tuple(e["b"]), tuple(e["a"])))
        else: oriented.append((tuple(e["a"]), tuple(e["b"])))
    by_start = {}
    for e in oriented: by_start.setdefault(key(e[0]), []).append(e)
    used, loops = set(), []
    for start in oriented:
        if start in used: continue
        loop, cur = [start[0]], start
        used.add(cur)
        for _ in range(10000):
            nexts = [e for e in by_start.get(key(cur[1]), []) if e not in used]
            if not nexts: break
            d = (math.copysign(1, cur[1][0] - cur[0][0]) if cur[1][0] != cur[0][0] else 0,
                 math.copysign(1, cur[1][1] - cur[0][1]) if cur[1][1] != cur[0][1] else 0)
            nexts.sort(key=lambda e: 0 if ((math.copysign(1, e[1][0] - e[0][0]) if e[1][0] != e[0][0] else 0,
                                            math.copysign(1, e[1][1] - e[0][1]) if e[1][1] != e[0][1] else 0) == d) else 1)
            cur = nexts[0]; used.add(cur)
            if key(cur[1]) == key(loop[0]):
                loop.append(cur[0]); break
            loop.append(cur[0])
        clean = []
        n = len(loop)
        for i, p in enumerate(loop):
            prev, nxt = loop[(i - 1) % n], loop[(i + 1) % n]
            collinear = (abs(prev[0] - p[0]) < 1e-6 and abs(nxt[0] - p[0]) < 1e-6) or (abs(prev[1] - p[1]) < 1e-6 and abs(nxt[1] - p[1]) < 1e-6)
            if not collinear: clean.append(p)
        if len(clean) >= 4: loops.append(clean)
    return loops


def union_area(rects, cell=0.1):
    return len(rasterise(rects, (), cell)[4]) * cell * cell


# ---------------------------------------------------------------------------
# Draw items + isometric context
# ---------------------------------------------------------------------------
class Item:
    """One paint unit: SVG fragments + lottie shape primitives + a world bbox for painter's ordering."""
    __slots__ = ("svg", "shapes", "bbox", "prio", "name")

    def __init__(self, bbox, prio=2, name=""):
        self.svg, self.shapes, self.bbox, self.prio, self.name = [], [], tuple(bbox), prio, name

    def depth(self):
        x0, x1, y0, y1, z0, z1 = self.bbox
        return x0 + y0 + z0


def bbox_of(X, Y, Z, w, h, d):
    return (X, X + w, Y, Y + h, Z, Z + d)


class Ctx:
    def __init__(self, cx, cy, scale):
        self.cx, self.cy, self.s = cx, cy, scale
        self.lw = max(0.35, scale / 60.0)  # stroke-width factor (1.0 at 60 px/m)

    def P(self, X, Y, Z):
        """Spec (X east, Y up, Z south) → screen. iso(x=X, y=Z, z=Y)."""
        return sims.iso(X, Z, Y, self.cx, self.cy, self.s)

    def anchor(self, X, Y, Z, f=1.0):
        """(cx, cy, scale) so that a legacy cm-unit renderer draws with its local origin at world (X,Y,Z), size × f."""
        cx2, cy2 = self.P(X, Y, Z)
        return cx2, cy2, self.s * f / 100.0

    def circle_pts(self, X, Y, Z, r, n=20, rz=None):
        rz = r if rz is None else rz
        return [self.P(X + r * math.cos(2 * math.pi * i / n), Y, Z + rz * math.sin(2 * math.pi * i / n)) for i in range(n)]


def add_poly(ctx, item, pts, fill, stroke="none", sw=1.0, opacity=1.0, detail=False, svg_fill=None, extra=""):
    item.svg.append(sims.poly(pts, fill=svg_fill or fill, stroke=stroke, stroke_w=round(sw * ctx.lw, 2), opacity=opacity, extra=extra))
    if not detail and fill != "none":
        item.shapes.append(("poly", pts, fill, stroke, sw * ctx.lw, opacity))
    elif not detail:
        item.shapes.append(("poly", pts, "none", stroke, sw * ctx.lw, opacity))


def add_line(ctx, item, p0, p1, stroke, sw=1.0, opacity=1.0, detail=False):
    item.svg.append(sims.line(p0, p1, stroke=stroke, stroke_w=round(sw * ctx.lw, 2), opacity=opacity))
    if not detail:
        item.shapes.append(("line", p0, p1, stroke, sw * ctx.lw, opacity))


def add_circle(ctx, item, c, r, fill, stroke="none", sw=1.0, opacity=1.0, detail=False, cls="", extra=""):
    stk = f' stroke="{stroke}" stroke-width="{round(sw * ctx.lw, 2)}"' if stroke != "none" else ""
    op = f' opacity="{opacity}"' if opacity < 1 else ""
    cl = f' class="{cls}"' if cls else ""
    item.svg.append(f'<circle cx="{c[0]}" cy="{c[1]}" r="{round(r, 2)}" fill="{fill}"{stk}{op}{cl} {extra}/>')
    if not detail:
        item.shapes.append(("ellipse", c[0], c[1], r, r, fill, stroke, sw * ctx.lw, opacity))


def box(ctx, item, X, Y, Z, w, h, d, cols, stroke="none", sw=0.7, opacity=1.0, detail=False):
    """Axis-aligned prism with min corner (X,Y,Z) and size (w,h,d). cols = (top, south face, east face)."""
    item.svg.append(rect_prism(X, Z, Y, w, d, h, ctx.cx, ctx.cy, ctx.s, cols[0], cols[1], cols[2],
                               stroke=stroke, stroke_w=round(sw * ctx.lw, 2), opacity=opacity))
    if not detail:
        P = ctx.P
        t = [P(X, Y + h, Z), P(X + w, Y + h, Z), P(X + w, Y + h, Z + d), P(X, Y + h, Z + d)]
        l = [P(X, Y, Z + d), P(X + w, Y, Z + d), P(X + w, Y + h, Z + d), P(X, Y + h, Z + d)]
        r = [P(X + w, Y, Z), P(X + w, Y, Z + d), P(X + w, Y + h, Z + d), P(X + w, Y + h, Z)]
        for pts, c in ((r, cols[2]), (l, cols[1]), (t, cols[0])):
            item.shapes.append(("poly", pts, c, stroke, sw * ctx.lw, opacity))


def rprism(ctx, item, cx, Y, cz, w, h, d, rot, cols, stroke="none", sw=0.6, opacity=1.0):
    """Prism w x d in plan, centred on (cx, cz), turned `rot` degrees as the three.js builders turn an object (a local
    (x, z) goes to (x cos + z sin, -x sin + z cos)), h tall from Y: the sides that face the camera (south and east
    of it, blended by how far they turn) and the top. cols = (top, south face, east face). S4: a fence run at 30 degrees."""
    a = math.radians(rot or 0); c, sn = math.cos(a), math.sin(a)
    pts = [(cx + x * c + z * sn, cz - x * sn + z * c) for x, z in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
    P = ctx.P
    for k in range(4):
        (x0, z0), (x1, z1) = pts[k], pts[(k + 1) % 4]
        ex, ez = x1 - x0, z1 - z0; ln = math.hypot(ex, ez) or 1.0
        nx, nz = ez / ln, -ex / ln   # outward normal (the corners run clockwise seen from above)
        if nx + nz <= 1e-6: continue   # faces away from the camera
        t = max(0.0, min(1.0, nz / (nx + nz)))
        add_poly(ctx, item, [P(x0, Y, z0), P(x1, Y, z1), P(x1, Y + h, z1), P(x0, Y + h, z0)], mix(cols[2], cols[1], t), stroke, sw, opacity)
    add_poly(ctx, item, [P(x, Y + h, z) for x, z in pts], cols[0], stroke, sw, opacity)


def cylinder(ctx, item, X, Y, Z, r, h, cols, n=20, stroke="none", sw=0.6, opacity=1.0, detail=False):
    """Vertical cylinder; visible side split into the south-facing (cols[1]) and east-facing (cols[2]) halves."""
    def arc(y, a0, a1, steps=8):
        return [ctx.P(X + r * math.cos(math.radians(a)), y, Z + r * math.sin(math.radians(a)))
                for a in [a0 + (a1 - a0) * i / steps for i in range(steps + 1)]]
    for a0, a1, c in ((-45, 45, cols[2]), (45, 135, cols[1])):
        bot, top = arc(Y, a0, a1), arc(Y + h, a0, a1)
        add_poly(ctx, item, bot + top[::-1], c, stroke, sw, opacity, detail)
    add_poly(ctx, item, ctx.circle_pts(X, Y + h, Z, r, n), cols[0], stroke, sw, opacity, detail)


def legacy_svg(item, svg_text, drop_after=None):
    """Append SVG text produced by a generate_sims_scenes renderer (optionally truncating at a marker line)."""
    if drop_after:
        lines = svg_text.split("\n")
        for i, ln in enumerate(lines):
            if drop_after in ln:
                lines = lines[:i]
                break
        svg_text = "\n".join(lines)
    item.svg.append(svg_text)


def rot_wd(w, d, rot):
    return (d, w) if int(round((rot or 0) / 90.0)) % 2 == 1 else (w, d)


def facing(rot):
    """Unit vector the item FACES (rot 0 → +Z south, 90 → +X east, 180 → -Z, 270 → -X)."""
    a = math.radians(rot or 0)
    return (round(math.sin(a), 6), round(math.cos(a), 6))


# ---------------------------------------------------------------------------
# Painter's ordering: topological sort on unambiguous "behind" relations, min-corner depth as the tie-break.
# Cycles happen (an L-shaped slab's bbox reaches around a tree that a lower-storey wall stub is "behind"); they are
# broken by releasing the node whose inverted edges are invisible or, failing that, do not stack a slab on its contents.
# ---------------------------------------------------------------------------
def behind(a, b):
    ax0, ax1, ay0, ay1, az0, az1 = a.bbox
    bx0, bx1, by0, by1, bz0, bz1 = b.bbox
    return ax1 <= bx0 + EPS or az1 <= bz0 + EPS or ay1 <= by0 + EPS


def below(a, b):
    """a sits entirely under b (a floor slab under what stands on it, a lower storey under the slab above)."""
    return a.bbox[3] <= b.bbox[2] + EPS


def overlaps_on_screen(a, b):
    """Do the projected silhouettes of the two bboxes overlap? An iso-projected box is a hexagon whose edges run along
    the three projected axes, so the separating-axis test needs only the intervals of x-z, z-y and x-y."""
    ax0, ax1, ay0, ay1, az0, az1 = a.bbox
    bx0, bx1, by0, by1, bz0, bz1 = b.bbox
    return (ax0 - az1 < bx1 - bz0 - EPS and bx0 - bz1 < ax1 - az0 - EPS
            and az0 - ay1 < bz1 - by0 - EPS and bz0 - by1 < az1 - ay0 - EPS
            and ax0 - ay1 < bx1 - by0 - EPS and bx0 - by1 < ax1 - ay0 - EPS)


def order_items(items):
    out = []
    for prio in sorted({it.prio for it in items}):
        grp = [it for it in items if it.prio == prio]
        n = len(grp)
        succ = [[] for _ in range(n)]
        pred = [[] for _ in range(n)]
        indeg = [0] * n
        for i in range(n):
            a = grp[i]
            for j in range(i + 1, n):
                b = grp[j]
                ab, ba = behind(a, b), behind(b, a)
                if ab and not ba:
                    succ[i].append(j); pred[j].append(i); indeg[j] += 1
                elif ba and not ab:
                    succ[j].append(i); pred[i].append(j); indeg[i] += 1
        heap = [(grp[i].depth(), i) for i in range(n) if indeg[i] == 0]
        heapq.heapify(heap)
        done = [False] * n
        placed = 0

        def release_cost(i):
            # Releasing i paints it before its still-pending predecessors, i.e. inverts those edges. Bboxes
            # over-approximate L-shaped slabs and round canopies, so many edges join things that never touch on
            # screen and cost nothing to invert. Of the real ones, never paint a slab over what stands on it
            # (a y-separated edge) while any other choice exists; then the historical (indeg, depth) tie-break.
            real = [p for p in pred[i] if not done[p] and overlaps_on_screen(grp[p], grp[i])]
            return (sum(1 for p in real if below(grp[p], grp[i])), len(real), indeg[i], grp[i].depth())

        while placed < n:
            if not heap:  # cycle: release the pending node whose inversion hurts least
                cand = min((i for i in range(n) if not done[i]), key=release_cost)
                indeg[cand] = 0
                heapq.heappush(heap, (grp[cand].depth(), cand))
            _, i = heapq.heappop(heap)
            if done[i]: continue
            done[i] = True; placed += 1
            out.append(grp[i])
            for j in succ[i]:
                indeg[j] -= 1
                if indeg[j] == 0 and not done[j]:
                    heapq.heappush(heap, (grp[j].depth(), j))
    return out


# ---------------------------------------------------------------------------
# The renderer: HouseSpec → items
# ---------------------------------------------------------------------------
class HouseRenderer:
    def __init__(self, spec, ctx, sid):
        self.spec, self.ctx, self.sid = spec, ctx, sid
        self.items = []
        pal = spec.get("palette", {})
        self.wall = pal.get("wall", "#f1f5f9"); self.trim = pal.get("trim", "#1e293b")
        self.roof = pal.get("roof", "#334155"); self.accent = pal.get("accent", CI_TEAL)
        self.rng = random.Random(spec.get("id", "house"))
        self.levels = sorted(spec.get("levels", []), key=lambda l: l["y"])
        self.level_by_id = {l["id"]: l for l in self.levels}
        hero = spec.get("hero", {})
        self.hero_level = self.level_by_id.get(hero.get("level"), self.levels[0] if self.levels else None)
        self.hero_y = self.hero_level["y"] if self.hero_level else 0.0
        self.visible_levels = [l for l in self.levels if l["y"] <= self.hero_y + EPS]
        self.hidden_levels = [l for l in self.levels if l["y"] > self.hero_y + EPS]
        self.skipped = []          # things we could not render faithfully (reported)
        self.arch = self._load_arch()   # S2: the builder's resolved architecture (plan.json `arch` key; {} when none)
        self._floor_items = {}
        self.hero_screen = None    # projected core position for the lottie layers
        self.core_item = None
        self.plumbob_item = None
        self.plumbob_screen = None

    # ---- helpers ---------------------------------------------------------
    def new(self, bbox, prio=2, name=""):
        it = Item(bbox, prio, name)
        self.items.append(it)
        return it

    def wall_cols(self, level):
        base = level.get("wallColor", self.wall)
        return (mix(base, "#ffffff", 0.45), shade(base, 0.04), shade(base, -0.16))

    def cut_cols(self, level):
        base = level.get("wallColor", self.wall)
        return (mix(mix(base, "#ffffff", 0.5), self.trim, 0.06), shade(base, 0.02), shade(base, -0.18))

    def level_trim(self, level):
        return level.get("trimColor", self.trim)

    # ---- site & ground ---------------------------------------------------
    def draw_ground(self):
        lotd = self.spec.get("lot", {"w": 30, "d": 24})
        w, d = lotd.get("w", 30), lotd.get("d", 24)
        ground = lotd.get("ground", "lawn")
        cols = GROUND_COLS.get(ground, GROUND_COLS["lawn"])
        it = self.new((-w / 2, w / 2, -0.4, 0.0, -d / 2, d / 2), prio=0, name="lot")
        box(self.ctx, it, -w / 2, -0.4, -d / 2, w, 0.4, d, (cols[0], shade(cols[1], -0.35), shade(cols[2], -0.45)),
            stroke=shade(cols[2], -0.4), sw=1.0)
        if ground in ("lawn", "forest", "waterfront"):
            # mown stripes (detail only)
            z = -d / 2 + 1.0
            while z < d / 2:
                add_line(self.ctx, it, self.ctx.P(-w / 2, 0.005, z), self.ctx.P(w / 2, 0.005, z), shade(cols[0], -0.06), sw=0.9, opacity=0.6, detail=True)
                z += 2.0
        if ground == "waterfront":
            wz0 = -d / 2 - 5.0
            add_poly(self.ctx, it, [self.ctx.P(-w / 2, 0.0, wz0), self.ctx.P(w / 2, 0.0, wz0), self.ctx.P(w / 2, 0.0, -d / 2), self.ctx.P(-w / 2, 0.0, -d / 2)],
                     "#5fb2e0", stroke="#3f8fc0", sw=0.8)
        if ground == "desert":
            for _ in range(24):
                x, z = self.rng.uniform(-w / 2 + 1, w / 2 - 1), self.rng.uniform(-d / 2 + 1, d / 2 - 1)
                add_circle(self.ctx, it, self.ctx.P(x, 0.01, z), 2.2 * self.ctx.lw, shade(cols[0], -0.15), detail=True)
        return it

    # Site types the three.js site kit resolves with seeded variation (assets/site.js). Their instances come
    # from <id>.plan.json (scripts/build-house-plan.mts) as world boxes + shape + colour, so this twin draws
    # exactly what the 3D built instead of re-implementing the seeded builders.
    PLAN_TYPES = {"tree", "shrub", "flowers", "rock", "bed", "path", "hedge", "scatter", "grove",
                  # S4's generators and structures: plantings, terraces, stairs, shaped water, climbers, lights
                  "planting", "terrace", "stair", "rill", "channel", "climber", "string-lights"}

    @staticmethod
    def plan_instances(plan):
        # plan.json's `site` key: a list of instances (before S4), or { instances, solids, edges }
        site = (plan or {}).get("site", [])
        return site.get("instances", []) if isinstance(site, dict) else site

    def draw_site(self):
        plan = None
        pp = HOUSES_DIR / f"{self.spec.get('id')}.plan.json"
        if pp.exists():
            try: plan = json.loads(pp.read_text())
            except Exception: plan = None
        instances = self.plan_instances(plan)
        by_site = {}
        for ins in instances: by_site.setdefault(ins.get("site"), []).append(ins)
        # what the builder recorded as standing on the lot (plan.json's site.solids), by the item that made it: the
        # fences, walls and props this twin has no drawing of its own for are drawn from these
        self.plan_solids = {}
        psite = (plan or {}).get("site")
        for q in (psite.get("solids", []) if isinstance(psite, dict) else []): self.plan_solids.setdefault(q.get("site"), []).append(q)
        for i, s in enumerate(self.spec.get("site", [])):
            self.cur_site = i
            t = s.get("type")
            # anything the builder described itself (a kit type, or an S4 item in a new form: a shaped pool, a
            # patio drawn round a polygon, a terrace) is drawn from what it built
            if t in self.PLAN_TYPES or (plan is not None and i in by_site and any(ins.get("shape") == "poly" for ins in by_site[i])):
                if plan is not None:
                    self.site_from_plan(s, by_site.get(i, []))
                    continue
                if t in ("tree", "shrub"):   # no plan: the old fixed drawings
                    getattr(self, "site_" + t)(s); continue
                self.skipped.append(f"site type '{t}' (no {pp.name}: run scripts/build-house-plan.mts)")
                continue
            fn = getattr(self, "site_" + t.replace("-", "_"), None)
            if fn is None:
                if not self.site_from_solids(s, i): self.skipped.append(f"site type '{t}'")
                continue
            # S4: an outline (`poly`) in place of `at`, w, d — a patio, a driveway, a pool — with no plan.json to draw it from
            if "at" not in s and isinstance(s.get("poly"), list) and len(s["poly"]) >= 3 and self.site_poly_flat(s): continue
            try:
                fn(s)
            except (KeyError, TypeError, ValueError, IndexError) as e:
                # one item this twin cannot draw must not lose the whole scene: say so (the S4 fixtures test fails on this note)
                self.skipped.append(f"site type '{t}' not drawn ({type(e).__name__}: {e})")

    POLY_FILLS = {"patio": "#d9d6cc", "driveway": "#a8a8a4", "pool": "#5aa9d6", "pond": "#5aa9d6", "deck": "#a47c55", "bed": "#5b4636", "terrace": "#8fae7a", "turf": "#86c46a"}

    def site_poly_flat(self, s):
        """An item drawn round a `poly`, flat on the ground, when there is no plan.json to draw its built outline from."""
        fill = self.POLY_FILLS.get(s.get("type"))
        if not fill: return False
        pts = [(p[0], p[1]) for p in s["poly"]]
        y = s.get("y", 0.0) + (s.get("h", 0.12) if s.get("type") == "deck" else 0.02)
        it = self.new((min(p[0] for p in pts), max(p[0] for p in pts), y, y, min(p[1] for p in pts), max(p[1] for p in pts)), prio=1, name=s.get("type"))
        add_poly(self.ctx, it, [self.ctx.P(x, y, z) for x, z in pts], s.get("color") or fill, stroke=shade(s.get("color") or fill, -0.25), sw=0.8)
        return True

    SOLID_LOOKS = {"furniture": ("#a8a29e", 1.0), "structure": ("#d6d3d1", 1.0), "planter": ("#8b6b4a", 1.0), "car": ("#9ca3af", 1.0), "play": ("#c2410c", 1.0), "plant": ("#4d7c3f", 1.0)}

    def site_from_solids(self, s, i):
        """A site item this twin has no drawing of its own for (an outdoor prop, a cabana …): the boxes the builder recorded
        for it (plan.json's site.solids) — its footprint and height, turned as built. False when there are none."""
        got = False
        for q in getattr(self, "plan_solids", {}).get(i, []):
            look = self.SOLID_LOOKS.get(q.get("kind"))
            if not look or q.get("yMax", 0) - q.get("yMin", 0) < 0.05: continue
            w = q["w"] if q.get("w") is not None else 2 * q.get("r", 0.3); d = q["d"] if q.get("d") is not None else w
            r = max(w, d) / 2 + 0.05
            it = self.new((q["x"] - r, q["x"] + r, q["yMin"], q["yMax"], q["z"] - r, q["z"] + r), name=s.get("type"))
            rprism(self.ctx, it, q["x"], q["yMin"], q["z"], w, q["yMax"] - q["yMin"], d, q.get("rot", 0), triplet(look[0], 0.12, 0.0, -0.2), stroke=shade(look[0], -0.4), sw=0.5)
            got = True
        return got

    def site_from_plan(self, s, instances):
        """Draw a site item from its resolved 3D instances: boxes as iso boxes, blobs/cones as shaded discs."""
        if not instances: return
        if any(ins["shape"] == "poly" for ins in instances):
            # S4: a generator's item (a planting, a pond, a terrace, a ribbon path) is flat outlines on the ground AND things
            # standing on it (plants, rocks, a terrace's faces): the outlines paint with the ground, the rest in chunks of a
            # few metres so the painter's sort keeps a plant in front of the bed behind it
            self._draw_instances(s, [i for i in instances if i["shape"] == "poly"], 1)
            cells = {}
            for ins in instances:
                if ins["shape"] != "poly": cells.setdefault((math.floor((ins["box"][0] + ins["box"][3]) / 8.0), math.floor((ins["box"][2] + ins["box"][5]) / 8.0)), []).append(ins)
            for key in sorted(cells): self._draw_instances(s, cells[key], 2)
            return
        self._draw_instances(s, instances, 1 if s.get("type") in ("path", "bed", "planting", "terrace", "rill", "channel", "patio", "driveway", "pool") else 2)

    def _draw_instances(self, s, instances, prio):
        if not instances: return
        xs = [b for ins in instances for b in (ins["box"][0], ins["box"][3])]
        zs = [b for ins in instances for b in (ins["box"][2], ins["box"][5])]
        ys = [b for ins in instances for b in (ins["box"][1], ins["box"][4])]
        it = self.new((min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)), name=s.get("type"), prio=prio)
        # paint back-to-front within the item: flat outlines (beds, water, a terrace's plateau) first, then
        # farther (smaller x+z) first, then lower
        for ins in sorted(instances, key=lambda i: (0 if i["shape"] == "poly" else 1, (i["box"][0] + i["box"][3]) + (i["box"][2] + i["box"][5]), i["box"][1])):
            x0, y0, z0, x1, y1, z1 = ins["box"]
            col = ins.get("color", "#888888")
            if ins["shape"] == "poly":   # S4: an outline in plan at its top (a bed, a pool's water, a terrace, a patio)
                P = self.ctx.P
                pts = [P(p[0], y1, p[1]) for p in ins.get("poly", [])]
                if len(pts) >= 3: add_poly(self.ctx, it, pts, col, stroke=shade(col, -0.3), sw=0.6)
            elif ins["shape"] == "box" or ins["shape"] == "cyl" and (y1 - y0) < 0.2:
                box(self.ctx, it, x0, y0, z0, x1 - x0, y1 - y0, z1 - z0, (col, shade(col, -0.18), shade(col, -0.36)), stroke=shade(col, -0.45), sw=0.5)
            elif ins["shape"] == "cyl":   # a trunk: a thin box
                box(self.ctx, it, x0, y0, z0, x1 - x0, y1 - y0, z1 - z0, (col, shade(col, -0.18), shade(col, -0.36)))
            else:   # blob / cone: a shaded disc around the box centre
                cx, cy, cz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
                rr = max(x1 - x0, z1 - z0) / 2 * (0.9 if ins["shape"] == "cone" else 1.0)
                c = self.ctx.P(cx, cy, cz)
                add_circle(self.ctx, it, c, rr * self.ctx.s, col, stroke=shade(col, -0.35), sw=0.5)
                add_circle(self.ctx, it, (c[0] - rr * 0.3 * self.ctx.s, c[1] - rr * 0.3 * self.ctx.s), rr * 0.45 * self.ctx.s, shade(col, 0.25), opacity=0.5, detail=True)

    def _flat_slab(self, s, fill, line_c, spacing, name, y=0.012, stroke=None):
        x, z = s["at"]; w, d = s.get("w", 4.0), s.get("d", 4.0)
        w, d = rot_wd(w, d, s.get("rot"))
        x0, z0 = x - w / 2, z - d / 2
        it = self.new((x0, x0 + w, y, y, z0, z0 + d), prio=1, name=name)
        P = self.ctx.P
        add_poly(self.ctx, it, [P(x0, y, z0), P(x0 + w, y, z0), P(x0 + w, y, z0 + d), P(x0, y, z0 + d)], fill, stroke=stroke or shade(fill, -0.18), sw=0.9)
        if spacing:
            g = x0 + spacing
            while g < x0 + w - 1e-6:
                add_line(self.ctx, it, P(g, y + 0.002, z0), P(g, y + 0.002, z0 + d), line_c, sw=0.6, opacity=0.8, detail=True); g += spacing
            g = z0 + spacing
            while g < z0 + d - 1e-6:
                add_line(self.ctx, it, P(x0, y + 0.002, g), P(x0 + w, y + 0.002, g), line_c, sw=0.6, opacity=0.8, detail=True); g += spacing
        return it, (x0, z0, w, d)

    def site_patio(self, s):
        self._flat_slab(s, "#d9d6cc", "#c3c0b4", 0.8, "patio")

    def site_driveway(self, s):
        self._flat_slab(s, "#a3a39d", "#93938d", 1.2, "driveway")

    def site_turf(self, s):
        it, (x0, z0, w, d) = self._flat_slab(s, "#6fb457", "#ffffff", 0, "turf")
        P = self.ctx.P
        add_poly(self.ctx, it, [P(x0 + 0.3, 0.02, z0 + 0.3), P(x0 + w - 0.3, 0.02, z0 + 0.3), P(x0 + w - 0.3, 0.02, z0 + d - 0.3), P(x0 + 0.3, 0.02, z0 + d - 0.3)], "none", stroke="#ffffff", sw=1.0)
        add_line(self.ctx, it, P(x0 + w / 2, 0.02, z0 + 0.3), P(x0 + w / 2, 0.02, z0 + d - 0.3), "#ffffff", sw=1.0)
        add_poly(self.ctx, it, self.ctx.circle_pts(x0 + w / 2, 0.02, z0 + d / 2, min(w, d) * 0.15), "none", stroke="#ffffff", sw=1.0)

    def site_deck(self, s):
        x, z = s["at"]; w, d = rot_wd(s.get("w", 4.0), s.get("d", 3.0), s.get("rot"))
        h = s.get("h", 0.1)
        x0, z0 = x - w / 2, z - d / 2
        cols = ("#b08f66", "#8e6f4c", "#6f5537")
        if h <= 0.35:
            it = self.new((x0, x0 + w, 0, h, z0, z0 + d), prio=1, name="deck")
            box(self.ctx, it, x0, 0, z0, w, h, d, cols, stroke="#5a4328", sw=0.7)
        else:  # stilted platform
            it = self.new((x0, x0 + w, 0, h, z0, z0 + d), prio=2, name="deck-raised")
            posts = [(x0 + 0.15, z0 + 0.15), (x0 + w - 0.3, z0 + 0.15), (x0 + 0.15, z0 + d - 0.3), (x0 + w - 0.3, z0 + d - 0.3)]
            px = x0 + 2.4
            while px < x0 + w - 0.5:
                posts += [(px, z0 + 0.15), (px, z0 + d - 0.3)]; px += 2.4
            for (px_, pz_) in posts:
                box(self.ctx, it, px_, 0, pz_, 0.15, h - 0.15, 0.15, ("#4a3524", "#3a2a1c", "#2a1e14"))
            box(self.ctx, it, x0, h - 0.15, z0, w, 0.15, d, cols, stroke="#5a4328", sw=0.7)
            # balustrade along the S and E edges of raised decks
            for (a, b) in (((x0, z0 + d), (x0 + w, z0 + d)), ((x0 + w, z0), (x0 + w, z0 + d))):
                self.draw_balustrade({"from": a, "to": b, "style": "timber"}, h, it)
        P = self.ctx.P
        g = x0 + 0.18
        while g < x0 + w - 1e-6:
            add_line(self.ctx, it, P(g, h + 0.003, z0), P(g, h + 0.003, z0 + d), "#8a7050", sw=0.5, opacity=0.8, detail=True); g += 0.18

    def site_pool(self, s):
        x, z = s["at"]; w, d = rot_wd(s.get("w", 6.0), s.get("d", 3.0), s.get("rot"))
        x0, z0 = x - w / 2, z - d / 2
        it = self.new((x0 - 0.4, x0 + w + 0.4, 0, 0.1, z0 - 0.4, z0 + d + 0.4), prio=1, name="pool")
        cop = ("#e9e6dd", "#cfcabd", "#b3ae9f")
        c = 0.4
        box(self.ctx, it, x0 - c, 0, z0 - c, w + 2 * c, 0.08, c, cop)
        box(self.ctx, it, x0 - c, 0, z0 + d, w + 2 * c, 0.08, c, cop)
        box(self.ctx, it, x0 - c, 0, z0 - c, c, 0.08, d + 2 * c, cop)
        box(self.ctx, it, x0 + w, 0, z0 - c, c, 0.08, d + 2 * c, cop)
        P = self.ctx.P
        add_poly(self.ctx, it, [P(x0, 0.03, z0), P(x0 + w, 0.03, z0), P(x0 + w, 0.03, z0 + d), P(x0, 0.03, z0 + d)], "#38bdf8", stroke="#0ea5e9", sw=0.8, opacity=0.95)
        add_poly(self.ctx, it, [P(x0 + 0.3, 0.031, z0 + 0.3), P(x0 + w - 0.3, 0.031, z0 + 0.3), P(x0 + w - 0.3, 0.031, z0 + d - 0.3), P(x0 + 0.3, 0.031, z0 + d - 0.3)], "#0ea5e9", opacity=0.55, detail=True)
        for i in range(1, 4):
            zz = z0 + d * i / 4
            add_line(self.ctx, it, P(x0 + 0.5, 0.035, zz), P(x0 + w - 0.5, 0.035, zz), "#bae6fd", sw=0.8, opacity=0.7, detail=True)

    def _water_ellipse(self, s, name):
        x, z = s["at"]; w, d = s.get("w", 2.0), s.get("d", s.get("w", 2.0))
        it = self.new((x - w / 2, x + w / 2, 0, 0.05, z - d / 2, z + d / 2), prio=1, name=name)
        add_poly(self.ctx, it, self.ctx.circle_pts(x, 0.02, z, w / 2, 24, d / 2), "#6b7c6a", stroke="#4d5b4c", sw=0.8)
        add_poly(self.ctx, it, self.ctx.circle_pts(x, 0.03, z, w / 2 - 0.25, 24, d / 2 - 0.25), "#3b82c4", stroke="#2c6aa5", sw=0.6)
        add_poly(self.ctx, it, self.ctx.circle_pts(x, 0.035, z, (w / 2 - 0.25) * 0.55, 20, (d / 2 - 0.25) * 0.55), "#60a5fa", opacity=0.55, detail=True)
        return it

    def site_pond(self, s):
        self._water_ellipse(s, "pond")

    def site_hottub(self, s):
        x, z = s["at"]; r = s.get("w", 2.2) / 2
        it = self.new((x - r, x + r, 0, 0.8, z - r, z + r), prio=2, name="hottub")
        cylinder(self.ctx, it, x, 0, z, r, 0.75, ("#4b4f56", "#3a3d43", "#2a2c31"))
        add_poly(self.ctx, it, self.ctx.circle_pts(x, 0.76, z, r - 0.18, 20), "#7dd3fc", stroke="#38bdf8", sw=0.6)

    FENCE_LOOKS = {"glass": (("#dbeafe", "#bfdbfe", "#93c5fd"), 0.4), "metal": (("#4b5563", "#374151", "#1f2937"), 1.0),
                   "slat-h": (("#a47c55", "#8b6b4a", "#6f543a"), 1.0), "post-rail": (("#a47c55", "#8b6b4a", "#6f543a"), 1.0),
                   "stone-wall": (("#c4bfb4", "#a8a29e", "#8b857c"), 1.0)}

    def fence_runs(self, s, kind):
        """[(x, z, length, thickness, rot, y0, y1)] for a fence or garden wall: the runs the builder laid out (plan.json's
        site.solids: curves resolved, each run at its ground) when the plan has them, else straight along its path."""
        sol = [q for q in getattr(self, "plan_solids", {}).get(getattr(self, "cur_site", None), []) if q.get("kind") == kind]
        if sol:
            return [(q["x"], q["z"], q["w"], q["d"], q.get("rot", 0), q.get("yMin", 0), q.get("yMax", q.get("yMin", 0) + 1.0)) for q in sol]
        line = s["path"] if s.get("path") else [s["from"], s["to"]]
        y0 = s.get("y", 0.0); h = s.get("h", 1.1 if kind == "fence" else 0.6); t = s.get("t", 0.25 if kind == "wall" else 0.1)
        return [((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, math.hypot(b[0] - a[0], b[1] - a[1]), t, -math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])), y0, y0 + h)
                for a, b in zip(line, line[1:]) if math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6]

    def site_fence_runs(self, s, kind):
        """S4: a fence or a garden wall as a run of turned prisms — any angle, a path (curved when smooth), a style, a colour, a y."""
        style = s.get("style", "picket")
        cols, op = self.FENCE_LOOKS.get(style, (("#f3f4f6", "#e5e7eb", "#cbd5e1"), 1.0)) if kind == "fence" else (None, 1.0)
        if kind == "fence" and s.get("color"): cols = triplet(s["color"], 0.1, 0.0, -0.18)
        if kind == "wall":
            base = s.get("color") or {"stone": "#a8a29e", "brick": "#a4553f", "concrete": "#b3b3b3", "stucco": "#d6cfc0", "render": "#d6cfc0"}.get(s.get("surface"), mix(self.wall, "#9ca3af", 0.35))
            cols = triplet(base, 0.18, 0.0, -0.2)
        for (x, z, L, t, rot, y0, y1) in self.fence_runs(s, kind):
            n = max(1, int(math.ceil(L / 3.0)))   # ≤ 3 m pieces, so the painter's sort stays compact
            a = math.radians(rot); ux, uz = math.cos(a), -math.sin(a)   # the run's direction in plan
            for k in range(n):
                off = (k + 0.5) / n * L - L / 2
                cx, cz, ll = x + ux * off, z + uz * off, L / n
                r = max(ll, t) / 2 + 0.05
                it = self.new((cx - r, cx + r, y0, y1, cz - r, cz + r), name=kind if kind == "wall" else "fence")
                rprism(self.ctx, it, cx, y0, cz, ll, y1 - y0, t, rot, cols, stroke=shade(cols[1], -0.3), sw=0.5, opacity=op)

    def site_fence(self, s):
        legacy = "from" in s and "to" in s and not s.get("path") and (abs(s["from"][0] - s["to"][0]) < 1e-6 or abs(s["from"][1] - s["to"][1]) < 1e-6) \
            and s.get("style", "picket") in ("picket", "privacy") and not any(k in s for k in ("color", "y", "smooth"))
        if not legacy: return self.site_fence_runs(s, "fence")
        (x0, z0), (x1, z1) = s["from"], s["to"]
        h = s.get("h", 1.1)
        it = self.new((min(x0, x1) - 0.05, max(x0, x1) + 0.05, 0, h, min(z0, z1) - 0.05, max(z0, z1) + 0.05), name="fence")
        L = math.hypot(x1 - x0, z1 - z0)
        n = max(1, int(L / 1.8))
        cols = ("#e5e7eb", "#d1d5db", "#b8bcc4")
        for i in range(n + 1):
            t = i / n
            px, pz = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
            box(self.ctx, it, px - 0.05, 0, pz - 0.05, 0.1, h, 0.1, cols)
        for yy in (h * 0.45, h * 0.9):
            add_line(self.ctx, it, self.ctx.P(x0, yy, z0), self.ctx.P(x1, yy, z1), "#d1d5db", sw=1.6)
        k = 0.15
        while k < L:
            t = k / L
            px, pz = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
            add_line(self.ctx, it, self.ctx.P(px, 0.05, pz), self.ctx.P(px, h * 0.95, pz), "#e5e7eb", sw=1.4, detail=True)
            k += 0.15

    def site_wall_low(self, s):
        legacy = "from" in s and "to" in s and not s.get("path") and abs(s["from"][1] - s["to"][1]) < 1e-6 or "from" in s and "to" in s and not s.get("path") and abs(s["from"][0] - s["to"][0]) < 1e-6
        if legacy and any(k in s for k in ("surface", "color", "cap", "y", "smooth", "t")): legacy = False
        if not legacy: return self.site_fence_runs(s, "wall")
        (x0, z0), (x1, z1) = s["from"], s["to"]
        h = s.get("h", 0.6); t = 0.25
        xa, xb, za, zb = min(x0, x1), max(x0, x1), min(z0, z1), max(z0, z1)
        along_x = abs(z1 - z0) < 1e-6
        if along_x: za, zb = za - t / 2, zb + t / 2
        else: xa, xb = xa - t / 2, xb + t / 2
        base = mix(self.wall, "#9ca3af", 0.35)
        # split long walls into ≤ 3 m pieces so the painter's sort stays compact
        L = (xb - xa) if along_x else (zb - za)
        n = max(1, int(math.ceil(L / 3.0)))
        for i in range(n):
            if along_x:
                px0, px1 = xa + L * i / n, xa + L * (i + 1) / n
                it = self.new((px0, px1, 0, h, za, zb), name="wall-low")
                box(self.ctx, it, px0, 0, za, px1 - px0, h, zb - za, triplet(base, 0.18, 0.0, -0.2), stroke=shade(base, -0.35), sw=0.6)
            else:
                pz0, pz1 = za + L * i / n, za + L * (i + 1) / n
                it = self.new((xa, xb, 0, h, pz0, pz1), name="wall-low")
                box(self.ctx, it, xa, 0, pz0, xb - xa, h, pz1 - pz0, triplet(base, 0.18, 0.0, -0.2), stroke=shade(base, -0.35), sw=0.6)

    def site_porch(self, s):
        x, z = s["at"]; w, d = rot_wd(s.get("w", 5.0), s.get("d", 2.5), s.get("rot")); h = s.get("h", 3.0)
        x0, z0 = x - w / 2, z - d / 2
        it = self.new((x0, x0 + w, 0, h + 0.3, z0, z0 + d), name="porch")
        box(self.ctx, it, x0, 0, z0, w, 0.15, d, ("#e5e7eb", "#d1d5db", "#b8bcc4"))
        cols = triplet(mix(self.wall, "#ffffff", 0.5), 0.08, 0.0, -0.15)
        xs = [x0 + 0.2, x0 + w - 0.5]
        if w > 4.5: xs.insert(1, x0 + w / 2 - 0.15)
        for px in xs:
            for pz in (z0 + 0.2, z0 + d - 0.5):
                box(self.ctx, it, px, 0.15, pz, 0.3, h - 0.15, 0.3, cols, stroke=shade(self.wall, -0.3), sw=0.5)
        box(self.ctx, it, x0 - 0.2, h, z0 - 0.2, w + 0.4, 0.3, d + 0.4, triplet(self.roof, 0.05, -0.08, -0.25), stroke=shade(self.roof, -0.35), sw=0.6)

    def site_pergola(self, s):
        x, z = s["at"]; w, d = rot_wd(s.get("w", 3.0), s.get("d", 3.0), s.get("rot")); h = s.get("h", 2.4)
        x0, z0 = x - w / 2, z - d / 2
        it = self.new((x0, x0 + w, 0, h + 0.2, z0, z0 + d), name="pergola")
        wood = ("#8a5a34", "#6b4426", "#4c2f19")
        for px in (x0, x0 + w - 0.15):
            for pz in (z0, z0 + d - 0.15):
                box(self.ctx, it, px, 0, pz, 0.15, h, 0.15, wood)
        box(self.ctx, it, x0 - 0.1, h, z0, w + 0.2, 0.15, 0.15, wood)
        box(self.ctx, it, x0 - 0.1, h, z0 + d - 0.15, w + 0.2, 0.15, 0.15, wood)
        g = z0 + 0.3
        while g < z0 + d - 0.2:
            add_line(self.ctx, it, self.ctx.P(x0 - 0.2, h + 0.15, g), self.ctx.P(x0 + w + 0.2, h + 0.15, g), "#6b4426", sw=2.0)
            g += 0.4

    def site_gazebo(self, s):
        x, z = s["at"]; r = s.get("w", 3.6) / 2; h = s.get("h", 2.6)
        it = self.new((x - r, x + r, 0, h + 1.2, z - r, z + r), name="gazebo")
        add_poly(self.ctx, it, self.ctx.circle_pts(x, 0.12, z, r, 6), "#d6d3d1", stroke="#a8a29e", sw=0.8)
        wood = ("#8a5a34", "#6b4426", "#4c2f19")
        for i in range(6):
            a = 2 * math.pi * i / 6
            box(self.ctx, it, x + (r - 0.15) * math.cos(a) - 0.07, 0.12, z + (r - 0.15) * math.sin(a) - 0.07, 0.14, h - 0.12, 0.14, wood)
        ring = self.ctx.circle_pts(x, h, z, r + 0.2, 6)
        apex = self.ctx.P(x, h + 1.2, z)
        for i in range(6):
            a, b = ring[i], ring[(i + 1) % 6]
            add_poly(self.ctx, it, [a, b, apex], shade(self.roof, -0.05 * (i % 3)), stroke=shade(self.roof, -0.35), sw=0.5)

    def site_greenhouse(self, s):
        x, z = s["at"]; w, d = rot_wd(s.get("w", 3.0), s.get("d", 4.0), s.get("rot")); h = s.get("h", 2.2)
        x0, z0 = x - w / 2, z - d / 2
        it = self.new((x0, x0 + w, 0, h + 1.0, z0, z0 + d), name="greenhouse")
        box(self.ctx, it, x0, 0, z0, w, 0.1, d, ("#c8ccc4", "#aeb2aa", "#94978f"))
        box(self.ctx, it, x0, 0.1, z0, w, h - 0.1, d, ("#d7f0fa", "#bfe4f7", "#a6d4ec"), stroke="#6b8fa6", sw=0.7, opacity=0.55)
        P = self.ctx.P
        ridge0, ridge1 = P(x0, h + 0.9, z + 0.0), P(x0 + w, h + 0.9, z)
        add_poly(self.ctx, it, [P(x0, h, z0), P(x0 + w, h, z0), ridge1, ridge0], "#bfe4f7", stroke="#6b8fa6", sw=0.7, opacity=0.5)
        add_poly(self.ctx, it, [P(x0, h, z0 + d), P(x0 + w, h, z0 + d), ridge1, ridge0], "#a6d4ec", stroke="#6b8fa6", sw=0.7, opacity=0.5)

    def site_garden_beds(self, s):
        x, z = s["at"]; w, d = rot_wd(s.get("w", 3.0), s.get("d", 1.2), s.get("rot"))
        x0, z0 = x - w / 2, z - d / 2
        it = self.new((x0, x0 + w, 0, 0.6, z0, z0 + d), name="garden-beds")
        box(self.ctx, it, x0, 0, z0, w, 0.32, d, ("#3f2a1d", "#8a5a34", "#6b4426"), stroke="#4c2f19", sw=0.5)
        n = max(2, int(w / 0.6))
        for i in range(n):
            px = x0 + w * (i + 0.5) / n
            for pz in (z0 + d * 0.3, z0 + d * 0.7):
                add_circle(self.ctx, it, self.ctx.P(px, 0.42, pz), 0.16 * self.ctx.s, "#4d9e5a", stroke="#2d6a4f", sw=0.5)

    def site_monkeybars(self, s):
        x, z = s["at"]; w, d = rot_wd(s.get("w", 2.4), s.get("d", 0.8), s.get("rot")); h = 2.0
        x0, z0 = x - w / 2, z - d / 2
        it = self.new((x0, x0 + w, 0, h, z0, z0 + d), name="monkeybars")
        P = self.ctx.P
        for px in (x0, x0 + w):
            for pz in (z0, z0 + d):
                add_line(self.ctx, it, P(px, 0, pz), P(px, h, pz), "#dc2626", sw=2.4)
        for pz in (z0, z0 + d):
            add_line(self.ctx, it, P(x0, h, pz), P(x0 + w, h, pz), "#dc2626", sw=2.4)
        g = x0 + 0.3
        while g < x0 + w:
            add_line(self.ctx, it, P(g, h, z0), P(g, h, z0 + d), "#facc15", sw=1.8); g += 0.3

    def site_firepit(self, s):
        x, z = s["at"]; r = s.get("w", 1.2) / 2
        it = self.new((x - r, x + r, 0, 0.9, z - r, z + r), name="firepit")
        cylinder(self.ctx, it, x, 0, z, r, 0.4, ("#6b7280", "#4b5563", "#374151"), n=12)
        add_poly(self.ctx, it, self.ctx.circle_pts(x, 0.41, z, r * 0.7, 12), "#1f2937")
        c = self.ctx.P(x, 0.55, z)
        add_circle(self.ctx, it, c, r * 0.55 * self.ctx.s, "#f97316", opacity=0.85)
        add_circle(self.ctx, it, (c[0], c[1] - 0.12 * self.ctx.s), r * 0.3 * self.ctx.s, "#fde047", opacity=0.9)

    def site_loungers(self, s):
        x, z = s["at"]
        for i, off in enumerate((-0.6, 0.6)):
            ox, oz = (off, 0) if int(round((s.get("rot") or 0) / 90)) % 2 == 0 else (0, off)
            self.item_sun_lounger({"type": "sun-lounger", "at": [x + ox, z + oz], "rot": s.get("rot", 0)}, 0.0)

    def site_bench(self, s):
        self.item_bench({"type": "bench", "at": s["at"], "rot": s.get("rot", 0)}, 0.0)

    def site_turtle_pool(self, s):          # Schnucko sea-turtle mosaic pool — same massing as a pool
        self.site_pool(dict(s, w=s.get("w", 8.0), d=s.get("d", 6.0)))

    def site_bridge(self, s):               # timber stepping bridge / boardwalk — a low deck slab
        self.site_deck(dict(s, w=s.get("w", 1.2), d=s.get("d", 2.6), h=s.get("h", 0.16)))

    def site_soccer_goal(self, s):
        x, z = s["at"]; w, d = rot_wd(1.8, 0.6, s.get("rot")); h = 1.1
        x0, z0 = x - w / 2, z - d / 2
        it = self.new((x0, x0 + w, 0, h, z0, z0 + d), name="soccer-goal")
        box(self.ctx, it, x0, 0, z0, w, h, d, ("#ffffff", "#e5e7eb", "#d1d5db"), stroke="#9ca3af", sw=0.6)

    def site_cactus(self, s):               # saguaro group — a tall shrub in cactus green
        x, z = s["at"]; r = 0.45; h = 2.2
        it = self.new((x - r, x + r, 0, h, z - r, z + r), name="cactus")
        cylinder(self.ctx, it, x, 0, z, 0.22, h, ("#5f9e58", "#3f7d3a", "#2f5f2c"), n=8)
        cylinder(self.ctx, it, x + 0.35, 0.7, z, 0.12, 0.9, ("#5f9e58", "#3f7d3a", "#2f5f2c"), n=6)

    def site_car(self, s):
        x, z = s["at"]; w, d = rot_wd(1.8, 4.4, s.get("rot")); x0, z0 = x - w / 2, z - d / 2
        it = self.new((x0, x0 + w, 0, 1.5, z0, z0 + d), name="car")
        body = triplet(s.get("color", "#1f2937"), 0.15, 0.0, -0.2)
        if d > w:  # pointing along Z
            wheels, ww, wd = [(x0 + 0.02, z0 + 0.5), (x0 + w - 0.32, z0 + 0.5), (x0 + 0.02, z0 + d - 0.9), (x0 + w - 0.32, z0 + d - 0.9)], 0.3, 0.4
            cab = (x0 + 0.15, z0 + d * 0.28, w - 0.3, d * 0.44)
        else:
            wheels, ww, wd = [(x0 + 0.5, z0 + 0.02), (x0 + w - 0.9, z0 + 0.02), (x0 + 0.5, z0 + d - 0.32), (x0 + w - 0.9, z0 + d - 0.32)], 0.4, 0.3
            cab = (x0 + w * 0.28, z0 + 0.15, w * 0.44, d - 0.3)
        for (px, pz) in wheels:
            box(self.ctx, it, px, 0, pz, ww, 0.3, wd, ("#111827", "#0b0f16", "#05070a"))
        box(self.ctx, it, x0, 0.3, z0, w, 0.55, d, body, stroke=shade(body[2], -0.3), sw=0.5)
        box(self.ctx, it, cab[0], 0.85, cab[1], cab[2], 0.55, cab[3], (body[0], "#93c5fd", "#60a5fa"), stroke=shade(body[2], -0.3), sw=0.5)

    def site_planter(self, s):
        x, z = s["at"]; w = s.get("w", 0.6)
        it = self.new((x - w / 2 - 0.2, x + w / 2 + 0.2, 0, 1.2, z - w / 2 - 0.2, z + w / 2 + 0.2), name="planter")
        box(self.ctx, it, x - w / 2, 0, z - w / 2, w, 0.5, w, ("#d97a4a", "#c86432", "#9a4a24"), stroke="#782d1e", sw=0.5)
        c = self.ctx.P(x, 0.75, z)
        add_circle(self.ctx, it, c, w * 0.75 * self.ctx.s, "#2d6a4f", stroke="#1b4332", sw=0.6)
        add_circle(self.ctx, it, (c[0] - 0.15 * w * self.ctx.s, c[1] - 0.2 * w * self.ctx.s), w * 0.42 * self.ctx.s, "#52b788", opacity=0.75)

    def site_steps(self, s):
        x, z = s["at"]; w = s.get("w", 1.2); run = s.get("d", 0.9); rise = s.get("h", 0.45); n = 3
        self.draw_straight_stairs(x, z, 0.0, s.get("rot", 0), w, run, rise, n, ("#e5e7eb", "#cbd5e1", "#94a3b8"), "steps")

    def site_tree(self, s):
        x, z = s["at"]; h = s.get("h", 7.0); r = s.get("r", 2.4)
        it = self.new((x - r, x + r, 0, h, z - r, z + r), name="tree")
        box(self.ctx, it, x - 0.22, 0, z - 0.22, 0.44, h * 0.45, 0.44, ("#7a5236", "#5c3d28", "#3f2a1c"))
        for (dy, rr, col) in ((h * 0.5, r * 0.85, "#2f6b3f"), (h * 0.66, r * 0.75, "#3f8b4f"), (h * 0.82, r * 0.55, "#5aa864")):
            c = self.ctx.P(x, dy, z)
            add_circle(self.ctx, it, c, rr * self.ctx.s, col, stroke="#1f4a2c", sw=0.6)
            add_circle(self.ctx, it, (c[0] - rr * 0.3 * self.ctx.s, c[1] - rr * 0.3 * self.ctx.s), rr * 0.45 * self.ctx.s, shade(col, 0.25), opacity=0.55, detail=True)

    def site_cypress(self, s):
        x, z = s["at"]; h = s.get("h", 5.0); r = s.get("r", 0.7)
        it = self.new((x - r, x + r, 0, h, z - r, z + r), name="cypress")
        add_line(self.ctx, it, self.ctx.P(x, 0, z), self.ctx.P(x, 0.6, z), "#5c3d28", sw=2.2)
        n = 7
        for i in range(n):
            yy = 0.5 + (h - 0.6) * i / n
            rr = r * (1.0 - i / n) + 0.12
            c = self.ctx.P(x, yy + rr * 0.6, z)
            add_circle(self.ctx, it, c, rr * self.ctx.s, "#1f5a3a" if i % 2 else "#2a6f48", stroke="#143c27", sw=0.5)
        add_circle(self.ctx, it, self.ctx.P(x, h, z), 0.12 * self.ctx.s, "#2a6f48")

    def site_palm(self, s):
        x, z = s["at"]; h = s.get("h", 6.0)
        it = self.new((x - 2.2, x + 2.2, 0, h + 0.5, z - 2.2, z + 2.2), name="palm")
        P = self.ctx.P
        base, top = P(x, 0, z), P(x + 0.35, h, z - 0.25)
        item_path = f'<path d="M {base[0]} {base[1]} Q {base[0] + 0.2 * self.ctx.s} {base[1] - h * 0.5 * self.ctx.s} {top[0]} {top[1]}" stroke="#8a6a46" stroke-width="{round(0.22 * self.ctx.s, 2)}" fill="none" stroke-linecap="round"/>'
        it.svg.append(item_path)
        it.shapes.append(("line", base, top, "#8a6a46", 0.22 * self.ctx.s, 1.0))
        for i in range(7):
            a = 2 * math.pi * i / 7 + 0.3
            tip = P(x + 0.35 + 2.0 * math.cos(a), h - 0.9, z - 0.25 + 2.0 * math.sin(a))
            midp = P(x + 0.35 + 1.1 * math.cos(a), h + 0.35, z - 0.25 + 1.1 * math.sin(a))
            it.svg.append(f'<path d="M {top[0]} {top[1]} Q {midp[0]} {midp[1]} {tip[0]} {tip[1]}" stroke="#2f8f4e" stroke-width="{round(0.16 * self.ctx.s, 2)}" fill="none" stroke-linecap="round"/>')
            it.shapes.append(("line", top, tip, "#2f8f4e", 0.16 * self.ctx.s, 1.0))
        add_circle(self.ctx, it, top, 0.22 * self.ctx.s, "#7a5236")

    def site_shrub(self, s):
        x, z = s["at"]; r = s.get("r", 0.6)
        it = self.new((x - r, x + r, 0, r * 1.6, z - r, z + r), name="shrub")
        c = self.ctx.P(x, r * 0.8, z)
        add_circle(self.ctx, it, c, r * self.ctx.s, "#3f8b4f", stroke="#1f4a2c", sw=0.5)
        add_circle(self.ctx, it, (c[0] - r * 0.3 * self.ctx.s, c[1] - r * 0.28 * self.ctx.s), r * 0.5 * self.ctx.s, "#6cc07a", opacity=0.6, detail=True)

    # ---- levels ----------------------------------------------------------
    def draw_levels(self):
        for lv in self.visible_levels:
            self.draw_level(lv)

    def draw_level(self, lv):
        y, h = lv["y"], lv["height"]
        rects = lv["footprint"]
        holes = lv.get("voids", []) if y > 0 else []
        if self.arch:
            holes = self.arch_holes(lv)
        edges = perimeter_edges(rects)
        self.draw_floor(lv, rects, holes)
        if self.arch or any(r_.get("floor") for r_ in lv.get("rooms", [])):
            self.draw_room_floors(lv)
        for e in edges:
            if e["side"] in ("N", "W"):
                self.draw_full_wall(lv, e)
            else:
                self.draw_cut_wall(lv, e)
        for p in lv.get("partitions", []):
            self.draw_partition(lv, p)
        for b in lv.get("balustrades", []):
            self.draw_balustrade(b, y)
        if lv.get("stairs"):
            self.draw_stairs(lv)
        self.draw_rooms(lv)
        self.draw_arch(lv)

    def draw_floor(self, lv, rects, holes):
        y = lv["y"]
        style = FLOOR_STYLES.get(lv.get("floor", "oak"), FLOOR_STYLES["oak"])
        base, line_c, spacing, mode = style
        x0, x1, z0, z1 = union_bounds(rects)
        it = self.new((x0, x1, y - SLAB_T, y, z0, z1), name=f"floor-{lv['id']}")
        P = self.ctx.P
        edges = perimeter_edges(rects, holes)
        loops = outline_loops(edges)
        if not loops:
            loops = [[(r["x"], r["z"]), (r["x"] + r["w"], r["z"]), (r["x"] + r["w"], r["z"] + r["d"]), (r["x"], r["z"] + r["d"])] for r in rects]
        # slab edge faces (upper levels): S-facing and E-facing perimeter runs
        if y > 0:
            for e in edges:
                (ax, az), (bx, bz) = e["a"], e["b"]
                if e["side"] == "S":
                    add_poly(self.ctx, it, [P(ax, y - SLAB_T, az), P(bx, y - SLAB_T, bz), P(bx, y, bz), P(ax, y, az)], shade(base, -0.28), stroke=shade(base, -0.45), sw=0.6)
                elif e["side"] == "E":
                    add_poly(self.ctx, it, [P(ax, y - SLAB_T, az), P(bx, y - SLAB_T, bz), P(bx, y, bz), P(ax, y, az)], shade(base, -0.42), stroke=shade(base, -0.5), sw=0.6)
        # floor top as one evenodd path (voids become real holes)
        d_parts = []
        for loop in loops:
            pts = [P(px, y, pz) for (px, pz) in loop]
            d_parts.append("M " + " L ".join(f"{u} {v}" for u, v in pts) + " Z")
            it.shapes.append(("poly", pts, base, "none", 0, 1.0))
        d_attr = " ".join(d_parts)
        clip_id = f"fp_{self.sid}_{lv['id']}"
        self._floor_items[lv["id"]] = (it, clip_id)   # S2's room floors are painted into this item, clipped to the slab (holes stay holes)
        it.svg.append(f'<path d="{d_attr}" fill="{base}" fill-rule="evenodd" stroke="{shade(base, -0.35)}" stroke-width="{round(1.0 * self.ctx.lw, 2)}"/>')
        it.svg.append(f'<defs><clipPath id="{clip_id}"><path d="{d_attr}" clip-rule="evenodd"/></clipPath></defs>')
        it.svg.append(f'<g clip-path="url(#{clip_id})">')
        if mode in ("x", "grid"):
            g = z0 + spacing
            while g < z1:
                it.svg.append(sims.line(P(x0, y + 0.003, g), P(x1, y + 0.003, g), stroke=line_c, stroke_w=round(0.55 * self.ctx.lw, 2), opacity=0.85))
                g += spacing
        if mode == "grid":
            g = x0 + spacing
            while g < x1:
                it.svg.append(sims.line(P(g, y + 0.003, z0), P(g, y + 0.003, z1), stroke=line_c, stroke_w=round(0.55 * self.ctx.lw, 2), opacity=0.85))
                g += spacing
        if mode == "speckle":
            n = int(union_area(rects) * 3)
            for _ in range(min(n, 500)):
                px, pz = self.rng.uniform(x0, x1), self.rng.uniform(z0, z1)
                if any(in_rect(px, pz, r, -0.05) for r in rects):
                    c = P(px, y + 0.003, pz)
                    it.svg.append(f'<circle cx="{c[0]}" cy="{c[1]}" r="{round(0.9 * self.ctx.lw, 2)}" fill="{line_c}" opacity="0.7"/>')
        it.svg.append("</g>")
        # hole rims: a dark lip so voids read as drops to the level below
        if y > 0 and holes:
            for hrect in holes:
                hx, hz, hw, hd = hrect["x"], hrect["z"], hrect["w"], hrect["d"]
                add_poly(self.ctx, it, [P(hx, y, hz), P(hx + hw, y, hz), P(hx + hw, y, hz + hd), P(hx, y, hz + hd)], "none", stroke=shade(base, -0.5), sw=1.0)

    # -- perimeter walls --
    def draw_full_wall(self, lv, e):
        y, h = lv["y"], lv["height"]
        if any("h" in r_ for r_ in lv["footprint"]):
            h = self.edge_height(lv, e)
        cols = self.wall_cols(lv)
        trim = self.level_trim(lv)
        (ax, az), (bx, bz) = e["a"], e["b"]
        P = self.ctx.P
        if e["side"] == "N":
            X, Z, w, d = ax, az, bx - ax, WALL_T
        else:  # W
            X, Z, w, d = ax, az, WALL_T, bz - az
        it = self.new((X, X + w, y, y + h - 0.3, Z, Z + d), name=f"wall-{e['side']}")
        box(self.ctx, it, X, y, Z, w, h, d, cols, stroke=shade(cols[2], -0.25), sw=0.6)
        # openings, drawn on the visible INTERIOR face (south face of N walls, east face of W walls)
        for op in lv.get("openings", []):
            if op.get("side") != e["side"]: continue
            lo, hi = (ax, bx) if e["side"] == "N" else (az, bz)
            if not (lo - 1e-6 <= op["at"] <= hi + 1e-6): continue
            if not self.edge_carries(e, op): continue
            self.draw_opening_face(it, lv, e, op)

    def draw_opening_face(self, it, lv, e, op):
        y = lv["y"]
        trim = self.level_trim(lv)
        P = self.ctx.P
        t = op.get("type", "window"); w = op.get("w", 1.2); h = op.get("h", 2.1 if t in ("door", "slider", "garage") else 1.3)
        sill = op.get("sill", 0.0 if t in ("door", "slider", "glass", "garage") else 0.9)
        y0, y1 = y + sill, y + sill + h
        a0, a1 = op["at"] - w / 2, op["at"] + w / 2
        if e["side"] == "N":
            zf = e["a"][1] + WALL_T + 0.01
            pt = lambda a, yy: P(a, yy, zf)
        else:
            xf = e["a"][0] + WALL_T + 0.01
            pt = lambda a, yy: P(xf, yy, a)
        quad = [pt(a0, y0), pt(a1, y0), pt(a1, y1), pt(a0, y1)]
        glass = f"url(#sky_{self.sid})"
        if t == "door":
            add_poly(self.ctx, it, quad, shade(trim, -0.05), stroke=shade(trim, -0.4), sw=1.0)
            add_poly(self.ctx, it, [pt(a0 + 0.12, y0 + 0.15), pt(a1 - 0.12, y0 + 0.15), pt(a1 - 0.12, y1 - 0.15), pt(a0 + 0.12, y1 - 0.15)], "none", stroke=shade(trim, 0.35), sw=0.7, detail=True)
            add_circle(self.ctx, it, pt(a1 - 0.18, y0 + 1.0), 2.4 * self.ctx.lw, "#c89d55")
        elif t == "garage":
            add_poly(self.ctx, it, quad, mix(trim, "#ffffff", 0.45), stroke=shade(trim, -0.3), sw=1.0)
            for k in range(1, 4):
                yy = y0 + h * k / 4
                add_line(self.ctx, it, pt(a0, yy), pt(a1, yy), shade(trim, -0.2), sw=0.8, detail=True)
        else:
            add_poly(self.ctx, it, quad, "#bfe4f7", stroke=shade(trim, -0.2), sw=1.1, opacity=0.95, svg_fill=glass)
            if t == "window":
                add_line(self.ctx, it, pt((a0 + a1) / 2, y0), pt((a0 + a1) / 2, y1), "#ffffff", sw=1.6)
                add_line(self.ctx, it, pt(a0, (y0 + y1) / 2), pt(a1, (y0 + y1) / 2), "#ffffff", sw=1.6)
            elif t == "slider":
                add_line(self.ctx, it, pt((a0 + a1) / 2, y0), pt((a0 + a1) / 2, y1), "#ffffff", sw=1.8)
                add_line(self.ctx, it, pt(a0, y0 + 0.04), pt(a1, y0 + 0.04), shade(trim, -0.2), sw=1.4)
            elif t == "glass":
                k = a0 + 1.0
                while k < a1 - 0.2:
                    add_line(self.ctx, it, pt(k, y0), pt(k, y1), "#ffffff", sw=1.4)
                    k += 1.0

    def draw_cut_wall(self, lv, e):
        y = lv["y"]
        cols = self.cut_cols(lv)
        trim = self.level_trim(lv)
        (ax, az), (bx, bz) = e["a"], e["b"]
        horiz = e["side"] == "S"
        lo, hi = (ax, bx) if horiz else (az, bz)
        ops = sorted([o for o in lv.get("openings", []) if o.get("side") == e["side"] and lo - 1e-6 <= o["at"] <= hi + 1e-6 and self.edge_carries(e, o)], key=lambda o: o["at"])
        spans, cur = [], lo
        for o in ops:
            s0, s1 = max(lo, o["at"] - o.get("w", 1.0) / 2), min(hi, o["at"] + o.get("w", 1.0) / 2)
            if s0 > cur + 1e-6: spans.append((cur, s0, None))
            spans.append((s0, s1, o)); cur = s1
        if cur < hi - 1e-6: spans.append((cur, hi, None))
        for (s0, s1, o) in spans:
            L = s1 - s0
            n = max(1, int(math.ceil(L / 2.5))) if o is None else 1
            for i in range(n):
                p0, p1 = s0 + L * i / n, s0 + L * (i + 1) / n
                self.draw_cut_piece(lv, e, p0, p1, o, cols, trim)

    def draw_cut_piece(self, lv, e, p0, p1, op, cols, trim):
        y = lv["y"]
        horiz = e["side"] == "S"
        if horiz:
            X, Z, w, d = p0, e["a"][1] - WALL_T, p1 - p0, WALL_T
        else:
            X, Z, w, d = e["a"][0] - WALL_T, p0, WALL_T, p1 - p0
        t = op.get("type") if op else None
        sill = op.get("sill", 0.9) if op else 0
        it = self.new((X, X + w, y, y + CUT_H, Z, Z + d), name=f"cut-{e['side']}")
        if t in (None,) or (t == "window" and sill >= CUT_H - 0.05):
            box(self.ctx, it, X, y, Z, w, CUT_H, d, cols, stroke=shade(cols[2], -0.25), sw=0.6)
        elif t in ("door", "garage"):
            # open leaf: only the threshold strip remains
            box(self.ctx, it, X, y, Z, w, 0.04, d, triplet(trim, 0.25, 0.0, -0.2))
        else:  # glass / slider / low-sill window → translucent glazing stub
            if t == "window" and sill > 0.05:
                box(self.ctx, it, X, y, Z, w, sill, d, cols, stroke=shade(cols[2], -0.25), sw=0.6)
            gy = y + (sill if t == "window" else 0.0)
            box(self.ctx, it, X, gy, Z, w, CUT_H - (gy - y), d, ("#e0f2fe", "#bae6fd", "#7dd3fc"), stroke="#38bdf8", sw=0.6, opacity=0.65)
            box(self.ctx, it, X, y, Z, w, 0.04, d, triplet(trim, 0.25, 0.0, -0.2))

    # -- partitions / balustrades --
    def draw_partition(self, lv, p):
        y = lv["y"]
        (x0, z0), (x1, z1) = p["from"], p["to"]
        along_x = abs(z1 - z0) < 1e-6
        h = min(p.get("height") or (lv["height"] - 0.1), CUT_H)
        base = p.get("color", mix(self.wall, "#ffffff", 0.3))
        cols = (mix(base, "#ffffff", 0.5), shade(base, 0.02), shade(base, -0.18))
        trim = self.level_trim(lv)
        L = abs((x1 - x0) if along_x else (z1 - z0))
        sgn = 1 if ((x1 - x0) if along_x else (z1 - z0)) >= 0 else -1
        segs = [(0.0, L)]
        if p.get("door") is not None:
            dw = p.get("doorW", 0.9); dc = p["door"]
            segs = [(0.0, max(0.0, dc - dw / 2)), (min(L, dc + dw / 2), L)]
            # threshold
            a, b = dc - dw / 2, dc + dw / 2
            if along_x:
                X, Z, w, d = min(x0 + sgn * a, x0 + sgn * b), z0 - PART_T / 2, abs(b - a), PART_T
            else:
                X, Z, w, d = x0 - PART_T / 2, min(z0 + sgn * a, z0 + sgn * b), PART_T, abs(b - a)
            it = self.new((X, X + w, y, y + 0.03, Z, Z + d), name="threshold")
            box(self.ctx, it, X, y, Z, w, 0.03, d, triplet(trim, 0.25, 0.0, -0.2))
        for (a, b) in segs:
            if b - a < 0.02: continue
            n = max(1, int(math.ceil((b - a) / 2.5)))
            for i in range(n):
                s0, s1 = a + (b - a) * i / n, a + (b - a) * (i + 1) / n
                if along_x:
                    X, Z, w, d = min(x0 + sgn * s0, x0 + sgn * s1), z0 - PART_T / 2, s1 - s0, PART_T
                else:
                    X, Z, w, d = x0 - PART_T / 2, min(z0 + sgn * s0, z0 + sgn * s1), PART_T, s1 - s0
                it = self.new((X, X + w, y, y + h, Z, Z + d), name="partition")
                box(self.ctx, it, X, y, Z, w, h, d, cols, stroke=shade(cols[2], -0.25), sw=0.5)

    def draw_balustrade(self, b, y, into=None):
        (x0, z0), (x1, z1) = b["from"], b["to"]
        style = b.get("style", "glass")
        h = 1.0 if style != "colonial" else 0.95
        it = into or self.new((min(x0, x1) - 0.05, max(x0, x1) + 0.05, y, y + h, min(z0, z1) - 0.05, max(z0, z1) + 0.05), name="balustrade")
        P = self.ctx.P
        L = math.hypot(x1 - x0, z1 - z0)
        if style == "glass":
            add_poly(self.ctx, it, [P(x0, y, z0), P(x1, y, z1), P(x1, y + h, z1), P(x0, y + h, z0)], "#bfe4f7", stroke="#94a3b8", sw=0.6, opacity=0.4)
            add_line(self.ctx, it, P(x0, y + h, z0), P(x1, y + h, z1), "#c89d55", sw=2.0)
            n = max(1, int(L / 1.2))
            for i in range(n + 1):
                t = i / n
                add_line(self.ctx, it, P(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t), P(x0 + (x1 - x0) * t, y + h, z0 + (z1 - z0) * t), "#c89d55", sw=1.2, detail=True)
        else:
            col = "#f5f2eb" if style == "colonial" else "#8a5a34"
            step = 0.3 if style == "colonial" else 1.2
            n = max(1, int(L / step))
            for i in range(n + 1):
                t = i / n
                add_line(self.ctx, it, P(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t), P(x0 + (x1 - x0) * t, y + h, z0 + (z1 - z0) * t), col, sw=1.6)
            add_line(self.ctx, it, P(x0, y + h, z0), P(x1, y + h, z1), "#6b3a2a" if style == "colonial" else "#5c3d28", sw=2.4)

    # -- stairs --
    def draw_stairs(self, lv):
        raw = lv["stairs"]
        if isinstance(raw, list) or raw.get("type", "timber") not in ("timber", "colonial", "spiral"):
            # S2: an array of flights, or an L, U or closed one — drawn from the builder's plan
            for idx, st in enumerate(raw if isinstance(raw, list) else [raw]):
                if isinstance(st, dict) and isinstance(st.get("at"), list):
                    if st.get("type") == "spiral":
                        to = self.level_by_id.get(st.get("to"))
                        self.draw_spiral_stairs(st["at"][0], st["at"][1], lv["y"], (to["y"] - lv["y"]) if to else 2.8, st.get("rot", 0))
                    else:
                        self.draw_arch_stairs(lv, st, idx, isinstance(raw, list))
            return
        st = raw
        to = self.level_by_id.get(st.get("to"))
        total = (to["y"] - lv["y"]) if to else 2.8
        x, z = st["at"]
        typ = st.get("type", "timber")
        if typ == "spiral":
            self.draw_spiral_stairs(x, z, lv["y"], total, st.get("rot", 0))
            return
        n = max(2, int(round(total / 0.2)))
        width = st.get("w", 1.2 if typ == "colonial" else 1.1)
        run = st.get("run", STAIR_RUN)
        cols = ("#f5f2eb", "#ffffff", "#6b3a2a") if typ == "colonial" else ("#d8be9b", "#a88b68", "#88623b")
        self.draw_straight_stairs(x, z, lv["y"], st.get("rot", 0), width, run, total, n, cols, "stairs")

    def draw_straight_stairs(self, x, z, y, rot, width, run, rise, n, cols, name):
        """Bottom step at (x,z); ascends along `rot` (0 → +Z). Uses the legacy render_stairs (cm units) via anchoring."""
        r = int(round((rot or 0) / 90.0)) % 4
        direction = {0: "+y", 1: "+x", 2: "-y", 3: "-x"}[r]
        if direction == "+y": X, Z, bb = x - width / 2, z, (x - width / 2, x + width / 2, z, z + run)
        elif direction == "-y": X, Z, bb = x - width / 2, z, (x - width / 2, x + width / 2, z - run, z)
        elif direction == "+x": X, Z, bb = x, z - width / 2, (x, x + run, z - width / 2, z + width / 2)
        else: X, Z, bb = x, z - width / 2, (x - run, x, z - width / 2, z + width / 2)
        it = self.new((bb[0], bb[1], y, y + rise, bb[2], bb[3]), name=name)
        cx2, cy2, s2 = self.ctx.anchor(X, y, Z)
        legacy_svg(it, sims.render_stairs(0, 0, 0, width * 100, run * 100, rise * 100, n, direction, cx2, cy2, s2,
                                          tread_c=cols[0], riser_c=cols[1], side_c=cols[2]))
        # lottie: treads as flat boxes
        for i in range(n):
            t0, t1 = i / n, (i + 1) / n
            yy = y + rise * t0
            if direction == "+y": box(self.ctx, it, X, yy, Z + run * t0, width, rise / n, run / n, cols)
            elif direction == "-y": box(self.ctx, it, X, yy, Z - run * t1, width, rise / n, run / n, cols)
            elif direction == "+x": box(self.ctx, it, X + run * t0, yy, Z, run / n, rise / n, width, cols)
            else: box(self.ctx, it, X - run * t1, yy, Z, run / n, rise / n, width, cols)
        # the legacy SVG already drew the stairs; drop the duplicate lottie-box SVG we just appended
        it.svg = it.svg[:1]

    def draw_spiral_stairs(self, x, z, y, total, rot):
        r = 0.95; n = max(8, int(round(total / 0.18)))
        it = self.new((x - r, x + r, y, y + total, z - r, z + r), name="spiral")
        cylinder(self.ctx, it, x, y, z, 0.08, total + 0.9, ("#334155", "#1f2937", "#111827"), n=8)
        a0 = math.radians(rot or 0)
        for i in range(n):
            yy = y + total * i / n
            ang0, ang1 = a0 + 2 * math.pi * i / n * 1.25, a0 + 2 * math.pi * (i + 1) / n * 1.25
            pts = [self.ctx.P(x, yy, z)]
            for k in range(4):
                a = ang0 + (ang1 - ang0) * k / 3
                pts.append(self.ctx.P(x + r * math.cos(a), yy, z + r * math.sin(a)))
            add_poly(self.ctx, it, pts, "#d8be9b" if i % 2 == 0 else "#cbb08a", stroke="#88623b", sw=0.6)
            tip = pts[2]
            add_line(self.ctx, it, tip, (tip[0], tip[1] - 0.9 * self.ctx.s), "#334155", sw=1.0, detail=True)

    # ---- S2 (architecture): what the builder resolved beyond walls and rooms, from <id>.plan.json's `arch` key — flights that
    # turn or come in arrays, room floors, a foundation under a raised storey, per-volume heights, and the new volumes: porches,
    # bays, balconies, terraces, loggias, chimney stacks, a stoop. The cutaway draws no roofs, so the roofs of a porch or a bay
    # are left to the 3D; posts and rails are drawn low, so they do not hide the rooms behind them. A spec with none of these
    # fields draws exactly as before.
    def _load_arch(self):
        pp = HOUSES_DIR / f"{self.spec.get('id')}.plan.json"
        if pp.exists():
            try:
                return (json.loads(pp.read_text(encoding="utf-8")) or {}).get("arch") or {}
            except Exception:  # noqa: BLE001
                return {}
        return {}

    def arch_holes(self, lv):
        """the slab openings an upper storey has: its own voids, a flight's autoVoid, the double-height rooms below, a sunken room's pit"""
        holes = list(lv.get("voids", [])) if lv["y"] > 0 else []
        if lv["y"] > 0:
            for rec in self.arch.get("voids", []):
                if rec.get("level") == lv["id"]:
                    holes += list(rec.get("auto", [])) + [{k: v[k] for k in ("x", "z", "w", "d")} for v in rec.get("double", []) + rec.get("pits", [])]
        return holes

    def edge_height(self, lv, e):
        """a perimeter wall's height: its volume's own `h` (a tower, a low wing), else the storey's"""
        rects = [r for r in lv["footprint"] if "h" in r]
        if not rects:
            return lv["height"]
        (ax, az), (bx, bz) = e["a"], e["b"]
        mx, mz = (ax + bx) / 2, (az + bz) / 2
        n = {"N": (0, 1), "S": (0, -1), "E": (-1, 0), "W": (1, 0)}[e["side"]]   # a step inside the wall
        px, pz = mx + n[0] * 0.05, mz + n[1] * 0.05
        hit = [r for r in lv["footprint"] if in_rect(px, pz, r, -1e-6)]
        return hit[-1].get("h", lv["height"]) if hit else lv["height"]

    def edge_carries(self, e, op):
        """does this perimeter edge hold this opening (`edgeZ` picks between two same-side edges that both contain `at`)"""
        line = op.get("edgeZ")
        if line is None:
            return True
        return abs((e["a"][1] if e["side"] in ("S", "N") else e["a"][0]) - line) < 0.02

    ROOM_FLOOR = {  # kind → base, line colour, line spacing (m), mode
        "honey-oak": ("#d9a866", "#bd8c4f", 0.25, "x"), "walnut": ("#8a6a4c", "#6f5238", 0.25, "x"), "cherry": ("#b56a4b", "#985238", 0.25, "x"),
        "white-oak": ("#e6d5b8", "#cdb994", 0.25, "x"), "grey-wash": ("#c4c0b6", "#aaa69c", 0.25, "x"), "herringbone": ("#c9a77a", "#a8875a", 0.4, "grid"),
        "chevron": ("#c9a77a", "#a8875a", 0.4, "grid"), "hex-tile": ("#e3e6e5", "#c3c9c8", 0.35, "grid"), "checker": ("#e9e7e2", "#3b3f45", 0.6, "grid"),
        "terracotta": ("#c98a63", "#a86d49", 0.45, "grid"), "stone": ("#b9b3a6", "#9d978a", 0.7, "grid"), "pavers": ("#b7ada0", "#9a9084", 0.5, "grid"),
        "slate": ("#7a8189", "#636a71", 0.6, "grid"), "carpet": ("#cfc4b4", "#bcb1a1", 0.0, "speckle"), "marble": ("#f1f0ec", "#dcdad2", 0.9, "grid"),
    }

    def draw_room_floors(self, lv):
        """each room's floor kind over the storey's slab: painted into the slab's own item (so it stays under whatever stands
        on it and the slab's holes stay holes), clipped to the slab, tone and lines from ROOM_FLOOR"""
        y = lv["y"]
        floor = self._floor_items.get(lv["id"])
        if floor is None:
            return
        it, clip_id = floor
        P = self.ctx.P
        yy = y + 0.004
        for room in lv.get("rooms", []):
            b = room.get("bounds")
            fl = room.get("floor")
            kind = fl if isinstance(fl, str) else (fl or {}).get("kind") if isinstance(fl, dict) else None
            if not kind:
                for r in self.arch.get("rooms", []):
                    if r.get("level") == lv["id"] and r.get("name") == room.get("name"):
                        kind = (r.get("finish") or {}).get("floor")
            if not kind or not isinstance(b, dict) or not all(k in b for k in ("x", "z", "w", "d")):
                continue
            base, line_c, spacing, mode = self.ROOM_FLOOR.get(kind) or FLOOR_STYLES.get(kind) or FLOOR_STYLES["oak"]
            it.svg.append(f'<g clip-path="url(#{clip_id})">')
            for r in lv["footprint"]:
                x0, x1 = max(b["x"], r["x"]), min(b["x"] + b["w"], r["x"] + r["w"])
                z0, z1 = max(b["z"], r["z"]), min(b["z"] + b["d"], r["z"] + r["d"])
                if x1 - x0 < 0.05 or z1 - z0 < 0.05:
                    continue
                add_poly(self.ctx, it, [P(x0, yy, z0), P(x1, yy, z0), P(x1, yy, z1), P(x0, yy, z1)], base, stroke=shade(base, -0.2), sw=0.5)
                if mode in ("x", "grid") and spacing:
                    g = z0 + spacing
                    while g < z1 - 1e-6:
                        add_line(self.ctx, it, P(x0, yy + 0.002, g), P(x1, yy + 0.002, g), line_c, sw=0.5, opacity=0.8, detail=True); g += spacing
                if mode == "grid" and spacing:
                    g = x0 + spacing
                    while g < x1 - 1e-6:
                        add_line(self.ctx, it, P(g, yy + 0.002, z0), P(g, yy + 0.002, z1), line_c, sw=0.5, opacity=0.8, detail=True); g += spacing
            it.svg.append("</g>")

    def arch_foundation(self, lv):
        """a storey standing above grade with nothing under it: its foundation, in the plinth's stone"""
        y = lv["y"]
        if y <= 0.05:
            return
        for pl in self.arch.get("plinths", []):
            if pl.get("level") != lv["id"] or not pl.get("foundation"):
                continue
            below = [o for o in self.levels if o["y"] < y - 0.3]
            for r in lv["footprint"]:
                if any(in_rect(r["x"] + r["w"] / 2, r["z"] + r["d"] / 2, q, -0.01) for q in (rr for o in below for rr in o["footprint"])):
                    continue
                it = self.new((r["x"], r["x"] + r["w"], 0, y - SLAB_T, r["z"], r["z"] + r["d"]), name="foundation")
                box(self.ctx, it, r["x"], 0, r["z"], r["w"], y - SLAB_T, r["d"], triplet(pl.get("color", "#a39c90"), 0.1, 0.0, -0.2), stroke=shade(pl.get("color", "#a39c90"), -0.35), sw=0.6)

    def _steps_rect(self, r, side, at, w, n, run):
        L = n * run
        if side == "S": return (at - w / 2, r["z"] + r["d"], w, L)
        if side == "N": return (at - w / 2, r["z"] - L, w, L)
        if side == "E": return (r["x"] + r["w"], at - w / 2, L, w)
        return (r["x"] - L, at - w / 2, L, w)

    def _steps(self, it, r, side, at, w, n, run, top, cols):
        """n − 1 steps stepping down from a deck `top` high to grade, out of side `side`"""
        rise = top / max(1, n)
        sx, sz, sw_, sd = self._steps_rect(r, side, at, w, n, run)
        for k in range(1, n):
            hh = top - rise * k
            if hh < 0.02:
                break
            if side == "S": X, Z, bw, bd = sx, sz + run * (k - 1), sw_, run
            elif side == "N": X, Z, bw, bd = sx, sz + sd - run * k, sw_, run
            elif side == "E": X, Z, bw, bd = sx + run * (k - 1), sz, run, sd
            else: X, Z, bw, bd = sx + sw_ - run * k, sz, run, sd
            box(self.ctx, it, X, 0, Z, bw, hh, bd, cols, stroke=shade(cols[2], -0.25), sw=0.5)

    DECK_COLS = ("#b08f66", "#8e6f4c", "#6f5537")

    def arch_porch(self, lv, ft):
        r, fy, side = ft["rect"], ft["floorY"], ft["side"]
        it = self.new((r["x"] - 0.1, r["x"] + r["w"] + 0.1, 0, fy + 1.2, r["z"] - 0.1, r["z"] + r["d"] + 0.1), name="porch")
        box(self.ctx, it, r["x"], 0, r["z"], r["w"], fy, r["d"], self.DECK_COLS, stroke="#5a4328", sw=0.6)
        st = ft.get("steps")
        if st:
            self._steps(it, r, side, st["at"], st["w"], st.get("n", 3), st.get("run", 0.3), fy, self.DECK_COLS)
        size = ft.get("postSize", 0.16)
        pc = triplet(mix(self.wall, "#ffffff", 0.5), 0.08, 0.0, -0.15)
        ph = max(0.3, min(1.25, ft.get("eave", fy + 2.6) - fy - 0.22))
        for px, pz in ft.get("posts", []):
            box(self.ctx, it, px - size / 2, fy, pz - size / 2, size, ph, size, pc, stroke=shade(self.wall, -0.3), sw=0.5)
        # rails along the deck's open edges (not the wall side), with a gap at the steps
        rail = ft.get("rail")
        if rail:
            style = "glass" if rail == "glass" else "timber" if rail in ("timber", "metal") else "colonial"
            x0, z0, x1, z1 = r["x"], r["z"], r["x"] + r["w"], r["z"] + r["d"]
            edges = {"S": ((x0, z1), (x1, z1)), "N": ((x0, z0), (x1, z0)), "E": ((x1, z0), (x1, z1)), "W": ((x0, z0), (x0, z1))}
            wall_side = {"S": "N", "N": "S", "E": "W", "W": "E"}[side]
            for s_, (a, b) in edges.items():
                if s_ == wall_side:
                    continue
                if s_ == side and st:
                    horiz = s_ in ("S", "N")
                    lo, hi = (a[0], b[0]) if horiz else (a[1], b[1])
                    g0, g1 = max(lo, st["at"] - st["w"] / 2), min(hi, st["at"] + st["w"] / 2)
                    segs = []
                    if g0 - lo > 0.2: segs.append((lo, g0))
                    if hi - g1 > 0.2: segs.append((g1, hi))
                    for u0, u1 in segs:
                        pa, pb = ((u0, a[1]), (u1, a[1])) if horiz else ((a[0], u0), (a[0], u1))
                        self.draw_balustrade({"from": pa, "to": pb, "style": style}, fy, it)
                else:
                    self.draw_balustrade({"from": a, "to": b, "style": style}, fy, it)

    def arch_bay(self, lv, ft):
        pts = ft["outline"]
        y, h = ft["y"], ft["h"]
        xs = [p[0] for p in pts]; zs = [p[1] for p in pts]
        it = self.new((min(xs), max(xs), y - SLAB_T, y + h, min(zs), max(zs)), name="bay")
        P = self.ctx.P
        cols = self.cut_cols(lv)
        # the floor and its skirt down to grade
        add_poly(self.ctx, it, [P(px, y, pz) for px, pz in pts], mix(FLOOR_STYLES.get(lv.get("floor", "oak"), FLOOR_STYLES["oak"])[0], "#ffffff", 0.05), stroke="#88623b", sw=0.6)
        cx, cz = sum(xs) / len(xs), sum(zs) / len(zs)
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            if i == 0 or math.hypot(b[0] - a[0], b[1] - a[1]) < 0.15:
                continue                       # the host wall's opening, and the corner returns
            ex, ez = b[0] - a[0], b[1] - a[1]
            nx, nz = ez, -ex
            if (a[0] - cx) * nx + (a[1] - cz) * nz < 0:
                nx, nz = -nx, -nz               # outward
            norm = math.hypot(nx, nz) or 1.0
            nx, nz = nx / norm, nz / norm
            facing_cam = nx > 0.05 or nz > 0.05
            hh = min(CUT_H, h) if facing_cam else h
            face = cols[1] if abs(nz) >= abs(nx) else cols[2]
            add_poly(self.ctx, it, [P(a[0], y, a[1]), P(b[0], y, b[1]), P(b[0], y + hh, b[1]), P(a[0], y + hh, a[1])], face, stroke=shade(face, -0.3), sw=0.6)
            if facing_cam and hh < h:
                add_poly(self.ctx, it, [P(a[0], y + hh * 0.35, a[1]), P(b[0], y + hh * 0.35, b[1]), P(b[0], y + hh * 0.8, b[1]), P(a[0], y + hh * 0.8, a[1])], "#bfe4f7", stroke="none", sw=0.4, opacity=0.5, detail=True)
        # the skirt on the visible (S and E) faces
        if y > 0.05:
            for i in range(len(pts)):
                a, b = pts[i], pts[(i + 1) % len(pts)]
                if i == 0:
                    continue
                if max(a[1], b[1]) >= max(zs) - 1e-6 or max(a[0], b[0]) >= max(xs) - 1e-6:
                    add_poly(self.ctx, it, [P(a[0], 0, a[1]), P(b[0], 0, b[1]), P(b[0], y, b[1]), P(a[0], y, a[1])], "#a39c90", stroke="#857f73", sw=0.5)

    def arch_deck(self, lv, ft):
        """balcony, terrace, loggia: a slab at the storey's floor (or on the roof under a terrace), its rails, a loggia's posts"""
        r, y, t = ft["rect"], ft["y"], ft["type"]
        it = self.new((r["x"], r["x"] + r["w"], y - 0.2, y + 1.0, r["z"], r["z"] + r["d"]), name=t)
        thick = 0.06 if t == "terrace" else 0.2
        box(self.ctx, it, r["x"], y - thick, r["z"], r["w"], thick, r["d"], self.DECK_COLS if t != "balcony" else ("#d9d4cb", "#c4bfb5", "#a8a399"), stroke="#5a4328", sw=0.6)
        style = {"glass": "glass", "metal": "timber", "timber": "timber", "parapet": "colonial"}.get(ft.get("rail"), "glass")
        if ft.get("rail") != "none":
            for a, b in ft.get("rails", []):
                self.draw_balustrade({"from": a, "to": b, "style": style}, y, it)
        if t == "loggia" and ft.get("posts"):
            for a, b in ft.get("rails", []):
                for k in range(int(ft["posts"]) + 1):
                    u = k / max(1, int(ft["posts"]))
                    px, pz = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
                    box(self.ctx, it, px - 0.1, y, pz - 0.1, 0.2, 1.2, 0.2, ("#f2efe9", "#e2ded6", "#c8c3ba"), stroke="#a8a399", sw=0.5)

    def arch_chimney(self, lv, ft):
        """an outside stack, from grade up as far as the cutaway shows"""
        if not ft.get("outside"):
            return
        cx, cz = ft["at"]; w, d = ft.get("w", 0.75), ft.get("d", 0.6)
        shx, shz = ft.get("shoulder") or [w + 0.4, d + 0.1]   # the stack below the top storey's head, in plan x and z (an E or W wall's is long in z)
        vis_top = self.hero_y + (self.hero_level["height"] if self.hero_level else 2.8)
        top = min(ft.get("top", vis_top), vis_top)
        col = {"stone": "#a39d92", "stucco": "#e7e2d8", "metal": "#9aa1a8"}.get(ft.get("material", "brick"), ft.get("color") or "#8a4a38")
        if ft.get("color") and ft.get("material") not in ("stone", "stucco", "metal"):
            col = ft["color"]
        it = self.new((cx - shx / 2, cx + shx / 2, 0, top, cz - shz / 2, cz + shz / 2), name="chimney")
        box(self.ctx, it, cx - shx / 2, 0, cz - shz / 2, shx, min(top, vis_top - 0.6), shz, triplet(col, 0.08, 0.0, -0.2), stroke=shade(col, -0.4), sw=0.6)

    def arch_stoop(self, lv):
        st = self.arch.get("stoop")
        if not st or st.get("level") != lv["id"]:
            return
        L, S = st["landing"], st.get("stairs")
        cols = ("#cfc9bc", "#b4ada1", "#978f83")
        it = self.new((L["x"], L["x"] + L["w"], 0, st["top"] + 0.9, L["z"], L["z"] + L["d"]), name="stoop")
        box(self.ctx, it, L["x"], 0, L["z"], L["w"], st["top"], L["d"], cols, stroke="#857f73", sw=0.6)
        if S and st.get("steps", 0) > 0:
            horiz = st["side"] in ("S", "N")
            n, run = st["steps"], st.get("run", 0.3)
            side = st["side"]
            r_ = {"x": L["x"], "z": L["z"], "w": L["w"], "d": L["d"]}
            at = L["x"] + L["w"] / 2 if horiz else L["z"] + L["d"] / 2
            self._steps(it, r_, side, at, (L["w"] if horiz else L["d"]) - 0.1, n, run, st["top"], cols)

    def draw_arch(self, lv):
        """everything S2 adds to a storey that draw_level did not draw itself"""
        if not self.arch:
            return
        self.arch_foundation(lv)
        for ft in self.arch.get("features", []):
            if ft.get("level") != lv["id"]:
                continue
            t = ft.get("type")
            if t == "porch": self.arch_porch(lv, ft)
            elif t == "bay": self.arch_bay(lv, ft)
            elif t in ("balcony", "terrace", "loggia"): self.arch_deck(lv, ft)
            elif t == "chimney": self.arch_chimney(lv, ft)
        self.arch_stoop(lv)

    def draw_arch_stairs(self, lv, st, idx, is_list):
        """a flight from its plan (arch.stairs): each flight as a straight run, the landing as a slab"""
        plan = None
        for rec in self.arch.get("stairs", []):
            if rec.get("from") == lv["id"] and rec.get("index") == idx:
                plan = rec
                break
        to = self.level_by_id.get(st.get("to"))
        total = (to["y"] - lv["y"]) if to else 2.8
        typ = st.get("type", "timber")
        if plan is None:
            # no plan: a straight flight from the spec (a turning one needs plan.json)
            if typ in ("L", "U"):
                self.skipped.append(f"{typ} stair (no plan.json arch key: run scripts/build-house-plan.mts)")
            x, z = st["at"]
            style = st.get("style", "timber") if typ in ("L", "U") else typ
            width = st.get("w", 1.2 if style == "colonial" else 1.1)
            n = max(2, int(round(total / 0.2)))
            cols = ("#f5f2eb", "#ffffff", "#6b3a2a") if style == "colonial" else ("#efe9df", "#d8d2c6", "#b9b2a4") if style == "closed" else ("#d8be9b", "#a88b68", "#88623b")
            self.draw_straight_stairs(x, z, lv["y"], st.get("rot", 0), width, st.get("run", STAIR_RUN), total, n, cols, "stairs")
            return
        for fl in plan.get("flights", []):
            style = fl.get("style", "timber")
            cols = ("#f5f2eb", "#ffffff", "#6b3a2a") if style == "colonial" else ("#efe9df", "#d8d2c6", "#b9b2a4") if style == "closed" else ("#d8be9b", "#a88b68", "#88623b")
            x, z = fl["at"]
            self.draw_straight_stairs(x, z, fl["y0"], fl["rot"], fl["w"], fl["run"], fl["rise"], fl["steps"], cols, "stairs")
        for ld in plan.get("landings", []):
            it = self.new((ld["x"], ld["x"] + ld["w"], ld["y"] - 0.15, ld["y"], ld["z"], ld["z"] + ld["d"]), name="landing")
            box(self.ctx, it, ld["x"], ld["y"] - 0.15, ld["z"], ld["w"], 0.15, ld["d"], ("#d8be9b", "#a88b68", "#88623b"), stroke="#5a4328", sw=0.6)

    # -- rooms & furniture --
    def draw_rooms(self, lv):
        hero = self.spec.get("hero", {})
        hero_here = hero.get("level") == lv["id"]
        for room in lv.get("rooms", []):
            for it_ in room.get("items", []):
                t = it_.get("type")
                if hero_here and hero.get("surface", "desk") == "desk" and t in ("walnut-desk", "task-chair", "curved-monitor", "chalk-tower", "charcoal-tower", "strix-mini", "speakers"):
                    if math.hypot(it_["at"][0] - hero["at"][0], it_["at"][1] - hero["at"][1]) < 1.3:
                        continue  # the hero desk set is drawn by draw_hero
                fn = getattr(self, "item_" + t.replace("-", "_"), None)
                if fn is None:
                    if self.item_from_catalog(it_, lv["y"]):
                        continue
                    self.skipped.append(f"item type '{t}'")
                    continue
                fn(it_, lv["y"])
        if hero_here:
            self.draw_hero(lv)

    # ---- registry props (assets/props/*.js): drawn from content/house-catalog.json — the prop's own iso parts
    # (local boxes / blobs / cylinders with role colours) or, failing that, one box of its measured size. Role
    # colours come from the house's plan.json (the material kit's picks), so the twin matches the 3D scheme.
    _catalog = None
    def item_from_catalog(self, it_, y):
        if HouseRenderer._catalog is None:
            cp = ROOT / "content" / "house-catalog.json"
            try: HouseRenderer._catalog = json.loads(cp.read_text()).get("types", {}) if cp.exists() else {}
            except Exception: HouseRenderer._catalog = {}
        entry = HouseRenderer._catalog.get(it_.get("type"))
        if not entry: return False
        roles = {}
        pp = HOUSES_DIR / f"{self.spec.get('id')}.plan.json"
        if pp.exists():
            try: roles = (json.loads(pp.read_text()).get("kit") or {}).get("colors") or {}
            except Exception: roles = {}
        def colour(c):
            if isinstance(c, str) and c.startswith("role:"):
                v = roles.get(c[5:]); return "#%06x" % v if isinstance(v, int) else "#94a3b8"
            return c or "#94a3b8"
        x, z = it_["at"]; rot = it_.get("rot", 0) or 0
        a = math.radians(rot); ca, sa = math.cos(a), math.sin(a)
        parts = entry.get("iso") or [{"shape": "box", "box": [-entry["footprint"][0] / 2, 0, -entry["footprint"][1] / 2, entry["footprint"][0] / 2, entry["height"], entry["footprint"][1] / 2], "color": "#94a3b8"}]
        # y is a fallback, not an addition to the surface offset — an explicit y REPLACES DESK_TOP, the same
        # convention as house-builder.js's `it.y ?? DESK_TOP` and this file's own dedicated hero-item methods
        # a few hundred lines down (`it_.get("y", DESK_TOP)`). Adding both floated every surface item with an
        # explicit y 0.77 m too high in the twin.
        yy = y + (it_.get("y", DESK_TOP) if entry.get("surface") else (it_.get("y") or 0))
        boxes = []
        for prt in parts:
            x0, y0, z0, x1, y1, z1 = prt["box"]
            # rotate the local footprint corners about the item origin (rot 0 faces +z; rot turns about y)
            cs = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
            wx = [x + px * ca + pz * sa for px, pz in cs]; wz = [z - px * sa + pz * ca for px, pz in cs]
            boxes.append((min(wx), max(wx), yy + y0, yy + y1, min(wz), max(wz), prt.get("shape", "box"), colour(prt.get("color"))))
        it = self.new((min(b[0] for b in boxes), max(b[1] for b in boxes), min(b[2] for b in boxes), max(b[3] for b in boxes), min(b[4] for b in boxes), max(b[5] for b in boxes)), name=it_.get("type"))
        for (bx0, bx1, by0, by1, bz0, bz1, shape, col) in sorted(boxes, key=lambda b: (b[0] + b[4], b[2])):
            if shape == "blob":
                cx, cy, cz = (bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2; rr = max(bx1 - bx0, bz1 - bz0) / 2
                add_circle(self.ctx, it, self.ctx.P(cx, cy, cz), rr * self.ctx.s, col, stroke=shade(col, -0.35), sw=0.5)
            elif shape == "cyl":
                cylinder(self.ctx, it, (bx0 + bx1) / 2, by0, (bz0 + bz1) / 2, max(bx1 - bx0, bz1 - bz0) / 2, by1 - by0, triplet(col, 0.1, 0.0, -0.25), n=10)
            else:
                box(self.ctx, it, bx0, by0, bz0, bx1 - bx0, by1 - by0, bz1 - bz0, (col, shade(col, -0.18), shade(col, -0.36)), stroke=shade(col, -0.45), sw=0.5)
        return True

    def _dims(self, it_, default):
        w, d, h = default
        w, d, h = it_.get("w", w), it_.get("d", d), it_.get("h", h)
        return rot_wd(w, d, it_.get("rot")) + (h,)

    def _origin(self, it_, w, d):
        x, z = it_["at"]
        return x - w / 2, z - d / 2

    def item_generic_box(self, it_, y, cols, dims=None, stroke=None, name=None):
        w, d, h = self._dims(it_, dims or CATALOG.get(it_["type"], (1.0, 1.0, 0.8)))
        x0, z0 = self._origin(it_, w, d)
        it = self.new(bbox_of(x0, y, z0, w, h, d), name=name or it_["type"])
        box(self.ctx, it, x0, y, z0, w, h, d, cols, stroke=stroke or shade(cols[2], -0.3), sw=0.5)
        return it, (x0, z0, w, d, h)

    def item_column(self, it_, y):
        x, z = it_["at"]; r = it_.get("r", 0.16) if not it_.get("size") else it_["size"] / 2
        h = it_.get("h", 2.6)
        it = self.new((x - r, x + r, y, y + h, z - r, z + r), name="column")
        col = it_.get("color") or {"colonial": "#f8fafc", "steel": "#1e293b"}.get(it_.get("style"), "#94a3b8")
        cylinder(self.ctx, it, x, y, z, r, h, triplet(col, 0.1, 0.0, -0.25), n=10)

    def item_sectional(self, it_, y):
        w, d, h = self._dims(it_, CATALOG["sectional"])
        x0, z0 = self._origin(it_, w, d)
        it = self.new(bbox_of(x0, y, z0, w, h, d), name="sectional")
        acc = it_.get("color", self.accent)
        cx2, cy2, s2 = self.ctx.anchor(x0, y, z0, f=w / 1.6)
        legacy_svg(it, sims.render_sectional_sofa(0, 0, 0, cx2, cy2, s2,
                                                  sofa_c=triplet(acc, 0.05, -0.05, -0.25),
                                                  cushion_c=triplet(acc, 0.18, 0.08, -0.15), pillow_c=(CI_AMBER, CI_COPPER)))
        # lottie fallback: base + backrest boxes (SVG lines dropped below)
        k = len(it.svg)
        box(self.ctx, it, x0, y, z0, w, 0.45, d * 0.45, triplet(acc, 0.18, 0.08, -0.15))
        box(self.ctx, it, x0, y, z0 + d * 0.45, w * 0.35, 0.45, d * 0.55, triplet(acc, 0.18, 0.08, -0.15))
        box(self.ctx, it, x0, y + 0.45, z0, w, 0.4, d * 0.12, triplet(acc, 0.05, -0.05, -0.25))
        it.svg = it.svg[:k]

    def item_platform_bed(self, it_, y):
        w, d, h = self._dims(it_, CATALOG["platform-bed"])
        x0, z0 = self._origin(it_, w, d)
        it = self.new(bbox_of(x0 - 0.05, y, z0 - 0.06, w + 0.1, h + 0.3, d + 0.06), name="platform-bed")
        cx2, cy2, s2 = self.ctx.anchor(x0, y, z0)
        legacy_svg(it, sims.render_platform_bed(0, 0, 0, w * 100, d * 100, 24, cx2, cy2, s2,
                                                headboard_c=triplet(self.trim, 0.1, 0.0, -0.2),
                                                linen_c=("#f5f2eb", "#dedad0", "#c4c0b4"),
                                                blanket_c=triplet(it_.get("color", self.accent), 0.05, -0.1, -0.3)))
        k = len(it.svg)
        box(self.ctx, it, x0, y, z0, w, 0.24, d, ("#88623b", "#614324", "#3d2915"))
        box(self.ctx, it, x0 + 0.06, y + 0.24, z0 + 0.06, w - 0.12, 0.18, d - 0.1, ("#f5f2eb", "#dedad0", "#c4c0b4"))
        box(self.ctx, it, x0 - 0.04, y, z0 - 0.06, w + 0.08, 0.8, 0.08, triplet(self.trim, 0.1, 0.0, -0.2))
        it.svg = it.svg[:k]

    def item_kitchen_island(self, it_, y):
        w, d, h = self._dims(it_, CATALOG["kitchen-island"])
        x0, z0 = self._origin(it_, w, d)
        it = self.new(bbox_of(x0, y, z0, w, h + 0.25, d + 0.4), name="kitchen-island")
        cx2, cy2, s2 = self.ctx.anchor(x0, y, z0)
        legacy_svg(it, sims.render_kitchen_island(0, 0, 0, w * 100, d * 100, h * 100, cx2, cy2, s2,
                                                  stone_c=("#e8e6e1", "#cfccc4", "#b5b1a6"),
                                                  cabinet_c=triplet(self.trim, 0.1, 0.0, -0.25)))
        k = len(it.svg)
        box(self.ctx, it, x0, y, z0, w, h - 0.05, d, triplet(self.trim, 0.1, 0.0, -0.25))
        box(self.ctx, it, x0, y + h - 0.05, z0, w, 0.05, d, ("#e8e6e1", "#cfccc4", "#b5b1a6"))
        it.svg = it.svg[:k]

    def item_coffee_table(self, it_, y):
        w, d, h = self._dims(it_, CATALOG["coffee-table"])
        x0, z0 = self._origin(it_, w, d)
        it = self.new(bbox_of(x0, y, z0, w, h, d), name="coffee-table")
        cx2, cy2, s2 = self.ctx.anchor(x0, y, z0)
        legacy_svg(it, sims.render_coffee_table(0, 0, 0, w * 100, d * 100, h * 100, cx2, cy2, s2, top_c="#e8e4da", base_c=shade(self.trim, 0.1)))
        k = len(it.svg)
        box(self.ctx, it, x0, y + h - 0.05, z0, w, 0.05, d, ("#e8e4da", "#d8d3c5", "#c4bea8"))
        it.svg = it.svg[:k]

    def item_plant(self, it_, y):
        t = it_["type"]
        x, z = it_["at"]
        w, d, h = CATALOG.get(t, (0.8, 0.8, 1.6))
        it = self.new(bbox_of(x - w / 2, y, z - d / 2, w, h, d), name=t)
        cx2, cy2, s2 = self.ctx.anchor(x, y, z)
        legacy_svg(it, sims.render_botanical(PLANT_SPECIES.get(t, "generic"), cx2, cy2, s2, mx=0, my=0, mz=0),
                   drop_after='fill="#fcfbf9" stroke="#0a6358"')  # strip the scene-specific desk succulent + bookshelf vine
        k = len(it.svg)
        box(self.ctx, it, x - 0.18, y + 0.28, z - 0.18, 0.36, 0.4, 0.36, ("#fcfbf9", "#e8eee9", "#cbdad3"))
        c = self.ctx.P(x, y + 1.1, z)
        add_circle(self.ctx, it, c, 0.42 * self.ctx.s, "#2d6a4f")
        add_circle(self.ctx, it, (c[0] - 0.12 * self.ctx.s, c[1] - 0.1 * self.ctx.s), 0.24 * self.ctx.s, "#52b788", opacity=0.7)
        it.svg = it.svg[:k]

    item_fiddle_leaf = item_monstera = item_bonsai = item_bamboo = item_cactus_group = item_plant

    def item_club_chair(self, it_, y):
        col = it_.get("color", "#8b6b4e")
        it, (x0, z0, w, d, h) = self.item_generic_box(it_, y, triplet(col, 0.15, 0.0, -0.2), dims=(0.9, 0.9, 0.42), name="club-chair")
        fx, fz = facing(it_.get("rot"))
        # backrest on the side opposite the facing direction
        if abs(fz) > abs(fx):
            bz = z0 if fz > 0 else z0 + d - 0.18
            box(self.ctx, it, x0, y + 0.42, bz, w, 0.4, 0.18, triplet(col, 0.05, -0.05, -0.25))
        else:
            bx = x0 if fx > 0 else x0 + w - 0.18
            box(self.ctx, it, bx, y + 0.42, z0, 0.18, 0.4, d, triplet(col, 0.05, -0.05, -0.25))
        it.bbox = bbox_of(x0, y, z0, w, 0.82, d)

    def item_octagonal_table(self, it_, y):
        x, z = it_["at"]; r = it_.get("w", 1.2) / 2
        it = self.new(bbox_of(x - r, y, z - r, 2 * r, 0.75, 2 * r), name="octagonal-table")
        cylinder(self.ctx, it, x, y, z, 0.18, 0.7, triplet("#5c3a21", 0.1, 0.0, -0.2), n=8)
        cylinder(self.ctx, it, x, y + 0.7, z, r, 0.05, ("#e8e4da", "#d8d3c5", "#c4bea8"), n=8, stroke="#9e9882", sw=0.5)

    def item_dining_table(self, it_, y):
        it, (x0, z0, w, d, h) = self.item_generic_box(it_, y, ("#cfab7e", "#b08b5e", "#88663c"), dims=(2.1, 1.0, 0.75), name="dining-table")
        it.svg.clear(); it.shapes.clear()
        for (px, pz) in ((x0 + 0.08, z0 + 0.08), (x0 + w - 0.16, z0 + 0.08), (x0 + 0.08, z0 + d - 0.16), (x0 + w - 0.16, z0 + d - 0.16)):
            box(self.ctx, it, px, y, pz, 0.08, 0.7, 0.08, ("#5c3a21", "#422814", "#28170a"))
        box(self.ctx, it, x0, y + 0.7, z0, w, 0.05, d, ("#cfab7e", "#b08b5e", "#88663c"), stroke="#6b4426", sw=0.5)
        return it, (x0, z0, w, d)

    def item_dining_set(self, it_, y):
        it, (x0, z0, w, d) = self.item_dining_table(dict(it_, type="dining-set", w=it_.get("w", 2.0), d=it_.get("d", 0.95)), y)
        chair = triplet(self.trim, 0.2, 0.05, -0.2)
        long_x = w >= d
        n = 3 if max(w, d) > 1.8 else 2
        for i in range(n):
            t = (i + 0.5) / n
            if long_x:
                for pz in (z0 - 0.5, z0 + d + 0.05):
                    box(self.ctx, it, x0 + w * t - 0.22, y, pz, 0.44, 0.45, 0.44, chair)
                    box(self.ctx, it, x0 + w * t - 0.22, y + 0.45, pz if pz < z0 else pz + 0.36, 0.44, 0.45, 0.08, chair)
            else:
                for px in (x0 - 0.5, x0 + w + 0.05):
                    box(self.ctx, it, px, y, z0 + d * t - 0.22, 0.44, 0.45, 0.44, chair)
                    box(self.ctx, it, px if px < x0 else px + 0.36, y + 0.45, z0 + d * t - 0.22, 0.08, 0.45, 0.44, chair)
        it.bbox = bbox_of(x0 - 0.5, y, z0 - 0.5, w + 1.0, 0.9, d + 1.0)

    def item_kitchen_cabinetry(self, it_, y):
        cab = triplet(self.trim, 0.1, 0.0, -0.25)
        it, (x0, z0, w, d, h) = self.item_generic_box(it_, y, cab, dims=(3.6, 0.65, 0.88), name="kitchen-cabinetry")
        box(self.ctx, it, x0, y + 0.88, z0, w, 0.04, d, ("#e8e6e1", "#cfccc4", "#b5b1a6"))
        fx, fz = facing(it_.get("rot"))
        # upper cabinets against the wall behind (opposite the facing direction)
        if abs(fz) > abs(fx):
            uz = z0 if fz > 0 else z0 + d - 0.35
            box(self.ctx, it, x0, y + 1.45, uz, w, 0.75, 0.35, cab)
        else:
            ux = x0 if fx > 0 else x0 + w - 0.35
            box(self.ctx, it, ux, y + 1.45, z0, 0.35, 0.75, d, cab)
        it.bbox = bbox_of(x0, y, z0, w, 2.2, d)

    def item_media_credenza(self, it_, y):
        it, (x0, z0, w, d, h) = self.item_generic_box(it_, y, ("#ecd7b8", "#b59468", "#88623b"), name="media-credenza")
        box(self.ctx, it, x0 + 0.15, y + h, z0 + 0.08, 0.34, 0.05, min(0.3, d - 0.16), ("#1a242c", "#10171d", "#080c0f"))

    def item_wall_tv(self, it_, y):
        w, d, h = self._dims(it_, CATALOG["wall-tv"])
        x0, z0 = self._origin(it_, w, d)
        it = self.new(bbox_of(x0, y + 1.0, z0, w, h, d), name="wall-tv")
        box(self.ctx, it, x0, y + 1.0, z0, w, h, d, ("#1a242c", "#0b1118", "#05080c"), stroke="#33424d", sw=0.5)

    def item_fireplace(self, it_, y):
        stone = ("#c9c1b4", "#a99f90", "#857b6c")
        it, (x0, z0, w, d, h) = self.item_generic_box(it_, y, stone, name="fireplace")
        fx, fz = facing(it_.get("rot"))
        P = self.ctx.P
        # firebox on the visible face if it faces the camera (south or east)
        if fz > 0.5:
            add_poly(self.ctx, it, [P(x0 + w * 0.25, y + 0.1, z0 + d + 0.01), P(x0 + w * 0.75, y + 0.1, z0 + d + 0.01), P(x0 + w * 0.75, y + 0.7, z0 + d + 0.01), P(x0 + w * 0.25, y + 0.7, z0 + d + 0.01)], "#1c1917")
            add_circle(self.ctx, it, P(x0 + w / 2, y + 0.3, z0 + d + 0.02), 0.18 * self.ctx.s, "#f97316", opacity=0.9)
        elif fx > 0.5:
            add_poly(self.ctx, it, [P(x0 + w + 0.01, y + 0.1, z0 + d * 0.25), P(x0 + w + 0.01, y + 0.1, z0 + d * 0.75), P(x0 + w + 0.01, y + 0.7, z0 + d * 0.75), P(x0 + w + 0.01, y + 0.7, z0 + d * 0.25)], "#1c1917")
            add_circle(self.ctx, it, P(x0 + w + 0.02, y + 0.3, z0 + d / 2), 0.18 * self.ctx.s, "#f97316", opacity=0.9)
        box(self.ctx, it, x0 + w * 0.3, y + h, z0 + d * 0.2, w * 0.4, 0.6, d * 0.6, stone)
        it.bbox = bbox_of(x0, y, z0, w, h + 0.6, d)

    def item_area_rug(self, it_, y):
        w, d, h = self._dims(it_, CATALOG["area-rug"])
        x0, z0 = self._origin(it_, w, d)
        it = self.new((x0, x0 + w, y, y, z0, z0 + d), name="area-rug")
        P = self.ctx.P
        col = it_.get("color", mix(self.accent, "#ffffff", 0.55))
        add_poly(self.ctx, it, [P(x0, y + 0.006, z0), P(x0 + w, y + 0.006, z0), P(x0 + w, y + 0.006, z0 + d), P(x0, y + 0.006, z0 + d)], col, stroke=shade(col, -0.3), sw=1.0)
        add_poly(self.ctx, it, [P(x0 + 0.25, y + 0.007, z0 + 0.25), P(x0 + w - 0.25, y + 0.007, z0 + 0.25), P(x0 + w - 0.25, y + 0.007, z0 + d - 0.25), P(x0 + 0.25, y + 0.007, z0 + d - 0.25)], "none", stroke=shade(col, -0.25), sw=0.8, detail=True)

    def item_circular_rug(self, it_, y):
        x, z = it_["at"]; r = it_.get("w", 4.0) / 2
        it = self.new((x - r, x + r, y, y, z - r, z + r), name="circular-rug")
        col = it_.get("color", mix(self.accent, "#ffffff", 0.55))
        add_poly(self.ctx, it, self.ctx.circle_pts(x, y + 0.006, z, r, 28), col, stroke=shade(col, -0.3), sw=1.0)

    def item_concentric_rug(self, it_, y):
        x, z = it_["at"]; r = it_.get("w", 3.2) / 2
        it = self.new((x - r, x + r, y, y, z - r, z + r), name="concentric-rug")
        col = it_.get("color", mix(self.accent, "#ffffff", 0.55))
        for i, rr in enumerate((r, r * 0.72, r * 0.44, r * 0.18)):
            add_poly(self.ctx, it, self.ctx.circle_pts(x, y + 0.006 + i * 0.001, z, rr, 28), col if i % 2 == 0 else shade(col, -0.18), stroke=shade(col, -0.3), sw=0.7, detail=i > 0)

    def item_sun_lounger(self, it_, y):
        it, (x0, z0, w, d, h) = self.item_generic_box(it_, y, ("#e8e4da", "#cfcabd", "#b3ae9f"), dims=(0.7, 2.0, 0.35), name="sun-lounger")
        if w < d: box(self.ctx, it, x0, y + 0.35, z0, w, 0.3, 0.12, ("#e8e4da", "#cfcabd", "#b3ae9f"))
        else: box(self.ctx, it, x0, y + 0.35, z0, 0.12, 0.3, d, ("#e8e4da", "#cfcabd", "#b3ae9f"))

    def item_bench(self, it_, y):
        it, (x0, z0, w, d, h) = self.item_generic_box(it_, y, ("#cfab7e", "#b08b5e", "#88663c"), dims=(1.8, 0.5, 0.45), name="bench")
        it.svg.clear(); it.shapes.clear()
        for (px, pz) in ((x0 + 0.1, z0 + 0.1), (x0 + w - 0.2, z0 + d - 0.2)):
            box(self.ctx, it, px, y, pz, 0.1, 0.4, 0.1, ("#5c3a21", "#422814", "#28170a"))
        box(self.ctx, it, x0, y + 0.4, z0, w, 0.06, d, ("#cfab7e", "#b08b5e", "#88663c"), stroke="#6b4426", sw=0.5)

    def item_wardrobe(self, it_, y):
        col = it_.get("color", mix(self.wall, self.trim, 0.25))
        it, (x0, z0, w, d, h) = self.item_generic_box(it_, y, triplet(col, 0.12, 0.0, -0.2), name="wardrobe")
        P = self.ctx.P
        if w >= d:
            add_line(self.ctx, it, P(x0 + w / 2, y + 0.05, z0 + d + 0.01), P(x0 + w / 2, y + h - 0.05, z0 + d + 0.01), shade(col, -0.4), sw=0.8, detail=True)
        else:
            add_line(self.ctx, it, P(x0 + w + 0.01, y + 0.05, z0 + d / 2), P(x0 + w + 0.01, y + h - 0.05, z0 + d / 2), shade(col, -0.4), sw=0.8, detail=True)

    def item_crib(self, it_, y):
        it, (x0, z0, w, d, h) = self.item_generic_box(it_, y, ("#f5f2eb", "#dedad0", "#c4c0b4"), name="crib")
        P = self.ctx.P
        k = x0 + 0.12
        while k < x0 + w:
            add_line(self.ctx, it, P(k, y + 0.1, z0 + d + 0.01), P(k, y + h - 0.05, z0 + d + 0.01), "#b0aba0", sw=0.7, detail=True); k += 0.12

    def item_ensuite(self, it_, y):
        w, d, h = self._dims(it_, CATALOG["ensuite"])
        x0, z0 = self._origin(it_, w, d)
        it = self.new(bbox_of(x0, y, z0, w, h, d), name="ensuite")
        white = ("#ffffff", "#eceae4", "#d5d2ca")
        wood = ("#cfab7e", "#b08b5e", "#88663c")
        if w >= d:
            box(self.ctx, it, x0, y, z0, min(1.7, w * 0.7), 0.55, min(0.8, d * 0.4), white, stroke="#b0aba0", sw=0.5)
            box(self.ctx, it, x0, y, z0 + d - 0.5, min(1.2, w * 0.5), 0.85, 0.5, wood)
            add_poly(self.ctx, it, self.ctx.circle_pts(x0 + 0.6, y + 0.86, z0 + d - 0.25, 0.18, 12), "#f8fafc", stroke="#94a3b8", sw=0.5)
            cylinder(self.ctx, it, x0 + w - 0.35, y, z0 + d - 0.35, 0.22, 0.42, white, n=12)
        else:
            box(self.ctx, it, x0, y, z0, min(0.8, w * 0.4), 0.55, min(1.7, d * 0.7), white, stroke="#b0aba0", sw=0.5)
            box(self.ctx, it, x0 + w - 0.5, y, z0, 0.5, 0.85, min(1.2, d * 0.5), wood)
            add_poly(self.ctx, it, self.ctx.circle_pts(x0 + w - 0.25, y + 0.86, z0 + 0.6, 0.18, 12), "#f8fafc", stroke="#94a3b8", sw=0.5)
            cylinder(self.ctx, it, x0 + w - 0.35, y, z0 + d - 0.35, 0.22, 0.42, white, n=12)

    def item_bookshelf(self, it_, y):
        wood = ("#cfab7e", "#b08b5e", "#88663c")
        it, (x0, z0, w, d, h) = self.item_generic_box(it_, y, wood, name="bookshelf")
        P = self.ctx.P
        cols = [CI_TEAL, CI_AMBER, CI_COPPER, "#1e293b", "#7f1d1d", "#f5f2eb"]
        for si in range(4):
            yy = y + 0.1 + si * 0.46
            if w >= d:
                add_line(self.ctx, it, P(x0, yy + 0.42, z0 + d + 0.01), P(x0 + w, yy + 0.42, z0 + d + 0.01), "#6b4426", sw=0.8, detail=True)
                k = 0.06
                while k < w - 0.12:
                    bw = self.rng.uniform(0.05, 0.11)
                    add_poly(self.ctx, it, [P(x0 + k, yy, z0 + d + 0.012), P(x0 + k + bw, yy, z0 + d + 0.012), P(x0 + k + bw, yy + self.rng.uniform(0.22, 0.36), z0 + d + 0.012), P(x0 + k, yy + self.rng.uniform(0.22, 0.36), z0 + d + 0.012)], self.rng.choice(cols), detail=True)
                    k += bw + 0.015
            else:
                add_line(self.ctx, it, P(x0 + w + 0.01, yy + 0.42, z0), P(x0 + w + 0.01, yy + 0.42, z0 + d), "#6b4426", sw=0.8, detail=True)
                k = 0.06
                while k < d - 0.12:
                    bw = self.rng.uniform(0.05, 0.11)
                    add_poly(self.ctx, it, [P(x0 + w + 0.012, yy, z0 + k), P(x0 + w + 0.012, yy, z0 + k + bw), P(x0 + w + 0.012, yy + self.rng.uniform(0.22, 0.36), z0 + k + bw), P(x0 + w + 0.012, yy + self.rng.uniform(0.22, 0.36), z0 + k)], self.rng.choice(cols), detail=True)
                    k += bw + 0.015

    def item_walnut_desk(self, it_, y):
        w, d, h = self._dims(it_, CATALOG["walnut-desk"])
        x0, z0 = self._origin(it_, w, d)
        it = self.new(bbox_of(x0, y, z0, w, h, d), name="walnut-desk")
        self._desk(it, x0, y, z0, w, d)
        return it

    def _desk(self, it, x0, y, z0, w, d):
        for (px, pz) in ((x0 + 0.05, z0 + 0.05), (x0 + w - 0.11, z0 + 0.05), (x0 + 0.05, z0 + d - 0.11), (x0 + w - 0.11, z0 + d - 0.11)):
            box(self.ctx, it, px, y, pz, 0.06, DESK_TOP - 0.05, 0.06, ("#614324", "#3d2915", "#2a1c0e"))
        box(self.ctx, it, x0, y + DESK_TOP - 0.05, z0, w, 0.05, d, ("#8b5a2b", "#6e4522", "#4f3018"), stroke="#3d2915", sw=0.5)

    def item_task_chair(self, it_, y):
        x, z = it_["at"]
        it = self.new(bbox_of(x - 0.3, y, z - 0.3, 0.6, 0.95, 0.6), name="task-chair")
        cylinder(self.ctx, it, x, y, z, 0.28, 0.05, ("#1f2937", "#111827", "#0b0f16"), n=10)
        add_line(self.ctx, it, self.ctx.P(x, y + 0.05, z), self.ctx.P(x, y + 0.42, z), "#374151", sw=2.0)
        box(self.ctx, it, x - 0.25, y + 0.42, z - 0.25, 0.5, 0.08, 0.5, ("#162028", "#101820", "#0a0e14"), stroke="#2b3d4a", sw=0.5)
        fx, fz = facing(it_.get("rot"))
        if abs(fz) >= abs(fx):
            bz = z - 0.25 if fz > 0 else z + 0.2
            box(self.ctx, it, x - 0.22, y + 0.5, bz, 0.44, 0.45, 0.05, ("#162028", "#101820", "#0a0e14"))
        else:
            bx = x - 0.25 if fx > 0 else x + 0.2
            box(self.ctx, it, bx, y + 0.5, z - 0.22, 0.05, 0.45, 0.44, ("#162028", "#101820", "#0a0e14"))

    def item_curved_monitor(self, it_, y):
        w, d, h = self._dims(it_, CATALOG["curved-monitor"])
        x0, z0 = self._origin(it_, w, d)
        yy = y + it_.get("y", DESK_TOP)
        it = self.new(bbox_of(x0, yy, z0, w, h + 0.15, d), name="curved-monitor")
        box(self.ctx, it, x0 + w / 2 - 0.08, yy, z0 + d / 2 - 0.08, 0.16, 0.12, 0.16, ("#1a242c", "#10171d", "#080c0f"))
        if w >= d: box(self.ctx, it, x0, yy + 0.12, z0 + d / 2 - 0.03, w, h, 0.06, ("#1a242c", "#0a6358", "#080c0f"), stroke="#33424d", sw=0.5)
        else: box(self.ctx, it, x0 + w / 2 - 0.03, yy + 0.12, z0, 0.06, h, d, ("#1a242c", "#10171d", "#0a6358"), stroke="#33424d", sw=0.5)

    def item_core_device(self, it_, y, device=None):
        x, z = it_["at"]
        device = device or ("charcoal" if it_["type"] == "charcoal-tower" else "strix" if it_["type"] == "strix-mini" else "chalk")
        yy = y + it_.get("y", DESK_TOP)
        return self.draw_core(x, yy, z, device, pose=it_.get("pose", "prone"), rot=it_.get("rot", 0))

    item_chalk_tower = item_charcoal_tower = item_strix_mini = item_core_device

    def item_speakers(self, it_, y):
        x, z = it_["at"]; yy = y + it_.get("y", DESK_TOP)
        it = self.new(bbox_of(x - 0.25, yy, z - 0.1, 0.5, 0.3, 0.2), name="speakers")
        for px in (x - 0.25, x + 0.1):
            box(self.ctx, it, px, yy, z - 0.08, 0.15, 0.28, 0.16, ("#1a242c", "#10171d", "#080c0f"))

    def item_halo_lamp(self, it_, y):
        x, z = it_["at"]
        it = self.new(bbox_of(x - 0.25, y, z - 0.25, 0.5, 1.7, 0.5), name="halo-lamp")
        cylinder(self.ctx, it, x, y, z, 0.16, 0.03, ("#c89d55", "#9e773a", "#7a5a22"), n=10)
        add_line(self.ctx, it, self.ctx.P(x, y + 0.03, z), self.ctx.P(x, y + 1.55, z), "#c89d55", sw=1.6)
        c = self.ctx.P(x, y + 1.58, z)
        add_circle(self.ctx, it, c, 0.32 * self.ctx.s, f"url(#lamp_{self.sid})", opacity=0.75, detail=True)
        add_poly(self.ctx, it, self.ctx.circle_pts(x, y + 1.58, z, 0.2, 16), "none", stroke="#ffdf7a", sw=2.2)

    def item_telescope(self, it_, y):
        x, z = it_["at"]
        it = self.new(bbox_of(x - 0.4, y, z - 0.4, 0.8, 1.6, 0.8), name="telescope")
        P = self.ctx.P
        for a in (0.5, 2.6, 4.7):
            add_line(self.ctx, it, P(x + 0.35 * math.cos(a), y, z + 0.35 * math.sin(a)), P(x, y + 1.1, z), "#374151", sw=1.6)
        add_line(self.ctx, it, P(x - 0.25, y + 1.0, z + 0.25), P(x + 0.3, y + 1.55, z - 0.3), "#1f2937", sw=5.0)

    def item_soccer_goal(self, it_, y):
        w, d, h = self._dims(it_, CATALOG["soccer-goal"])
        x0, z0 = self._origin(it_, w, d)
        it = self.new(bbox_of(x0, y, z0, w, h, d), name="soccer-goal")
        P = self.ctx.P
        if w >= d:
            add_line(self.ctx, it, P(x0, y, z0 + d), P(x0, y + h, z0 + d), "#ffffff", sw=2.0)
            add_line(self.ctx, it, P(x0 + w, y, z0 + d), P(x0 + w, y + h, z0 + d), "#ffffff", sw=2.0)
            add_line(self.ctx, it, P(x0, y + h, z0 + d), P(x0 + w, y + h, z0 + d), "#ffffff", sw=2.0)
            add_poly(self.ctx, it, [P(x0, y, z0), P(x0 + w, y, z0), P(x0 + w, y + h, z0 + d), P(x0, y + h, z0 + d)], "#e5e7eb", opacity=0.3)
        else:
            add_line(self.ctx, it, P(x0 + w, y, z0), P(x0 + w, y + h, z0), "#ffffff", sw=2.0)
            add_line(self.ctx, it, P(x0 + w, y, z0 + d), P(x0 + w, y + h, z0 + d), "#ffffff", sw=2.0)
            add_line(self.ctx, it, P(x0 + w, y + h, z0), P(x0 + w, y + h, z0 + d), "#ffffff", sw=2.0)
            add_poly(self.ctx, it, [P(x0, y, z0), P(x0, y, z0 + d), P(x0 + w, y + h, z0 + d), P(x0 + w, y + h, z0)], "#e5e7eb", opacity=0.3)

    def item_low_wall(self, it_, y):
        base = mix(self.wall, "#9ca3af", 0.3)
        self.item_generic_box(it_, y, triplet(base, 0.18, 0.0, -0.2), name="low-wall")

    # -- hero: Companion Core --
    def draw_core(self, x, yy, z, device, pose="prone", rot=0, hero=True):
        """The Companion Core appliance to the chassis spec (CI-Common reference/CHASSIS-INTERIOR.md a.1): 232 × 205 × 90 mm,
        prone (as marketed) or upright (stood on its side, 90 wide × 232 tall). The strix mini stays 150 × 150 × 50."""
        cols = DEVICE_COLS.get(device, DEVICE_COLS["chalk"])
        if device == "strix": w, d, h = 0.15, 0.15, 0.05
        elif pose == "upright": w, d, h = 0.09, 0.205, 0.232
        else: w, d, h = 0.232, 0.205, 0.09
        if int(rot) % 180 == 90: w, d = d, w   # front face along z instead of x
        x0, z0 = x - w / 2, z - d / 2
        it = self.new(bbox_of(x0, yy, z0, w, h, d), name="companion-core")
        box(self.ctx, it, x0, yy, z0, w, h, d, cols, stroke="#4a6170", sw=0.9)
        pwr = self.ctx.P(x0 + w - 0.06, yy + h / 2, z0 + d + 0.005)
        add_circle(self.ctx, it, pwr, 0.12 * self.ctx.s, CI_AQUA, opacity=0.4, cls="pwr-led-halo", detail=True)
        add_circle(self.ctx, it, pwr, 0.045 * self.ctx.s, "#00a9a7", stroke="#ffffff", sw=1.2)
        if hero:
            self.core_item = it
            self.hero_screen = self.ctx.P(x, yy + h / 2, z)
        return it

    def draw_hero(self, lv):
        hero = self.spec["hero"]
        # hero.rot is the heading the desk BACKS onto (rot 0 = wall/monitor side north, user south);
        # the asset convention faces the other way, so +180 — same as house-builder.js.
        x, z = hero["at"]; y = lv["y"]; rot = (hero.get("rot", 0) + 180) % 360
        surface = hero.get("surface", "desk")
        a = math.radians(rot)
        fwd = (-math.sin(a), -math.cos(a))          # where the user sits (house-builder.js convention)
        side = (fwd[1], -fwd[0])                     # to the right of the desk
        dy = 0.0
        if surface == "desk":
            w, d = rot_wd(1.6, 0.8, rot)
            it = self.new(bbox_of(x - w / 2, y, z - d / 2, w, DESK_TOP, d), name="hero-desk")
            self._desk(it, x - w / 2, y, z - d / 2, w, d)
            mon = {"type": "curved-monitor", "at": [x - fwd[0] * 0.15, z - fwd[1] * 0.15], "rot": rot}
            self.item_curved_monitor(mon, y)
            self.item_task_chair({"type": "task-chair", "at": [x + fwd[0] * 0.8, z + fwd[1] * 0.8], "rot": (rot + 180) % 360}, y)
            dy = DESK_TOP
        elif surface == "credenza":
            self.item_media_credenza({"type": "media-credenza", "at": [x, z], "rot": rot}, y)
            dy = 0.55
        elif surface == "island":
            self.item_kitchen_island({"type": "kitchen-island", "at": [x, z]}, y)
            dy = 0.92
        elif surface == "shelf":
            # headless: floating shelf on the wall the hero backs onto (hero.at is a desk centre 0.4 m off it)
            sh = hero.get("shelfHeight", 0.8)
            sx, sz = x - fwd[0] * 0.4, z - fwd[1] * 0.4
            self.draw_shelf(sx, y, sz, rot, sh)
            dy = sh
        else:
            it = self.new(bbox_of(x - 0.35, y, z - 0.3, 0.7, 0.1, 0.6), name="hero-plinth")
            box(self.ctx, it, x - 0.35, y, z - 0.3, 0.7, 0.1, 0.6, ("#e5e7eb", "#d1d5db", "#b8bcc4"))
            dy = 0.1
        cx_, cz_ = x + side[0] * 0.55, z + side[1] * 0.55
        if surface == "none":
            cx_, cz_ = x, z
        elif surface == "shelf":
            cx_, cz_ = x - fwd[0] * 0.27, z - fwd[1] * 0.27   # on the plank, 0.13 m off the wall
        self.draw_core(cx_, y + dy, cz_, hero.get("device", "chalk"), pose=hero.get("pose", "prone"), rot=hero.get("rot", 0))
        self.draw_plumbob(cx_, y + dy + 0.19 + 0.75, cz_)

    def draw_shelf(self, sx, y, sz, rot, h, w=0.9, d=0.26):
        """Floating walnut shelf: origin at the wall face, plank extending into the room (the −fwd side is the wall)."""
        a = math.radians(rot)
        fwd = (-math.sin(a), -math.cos(a))
        cx, cz = sx + fwd[0] * d / 2, sz + fwd[1] * d / 2
        pw, pd = rot_wd(w, d, rot)
        it = self.new(bbox_of(cx - pw / 2, y + h - 0.035, cz - pd / 2, pw, 0.035, pd), name="floating-shelf")
        box(self.ctx, it, cx - pw / 2, y + h - 0.035, cz - pd / 2, pw, 0.035, pd, ("#7a5535", "#5e3f25", "#3f2a18"))
        # a few books at one end
        side = (fwd[1], -fwd[0])
        bx, bz = cx - side[0] * 0.3, cz - side[1] * 0.3
        for i, col in enumerate(("#8b5e3c", "#3f5d73", "#d9c9a3")):
            bw, bd = rot_wd(0.03, 0.15, rot)
            ox, oz = bx + side[0] * i * 0.032, bz + side[1] * i * 0.032
            box(self.ctx, it, ox - bw / 2, y + h, oz - bd / 2, bw, 0.2 - i * 0.02, bd, (col, mix(col, "#000000", 0.2), mix(col, "#000000", 0.4)))
        return it

    def item_core_shelf(self, it_, y):
        x, z = it_["at"]; rot = int(it_.get("rot", 0))
        h = it_.get("h", 0.8)
        self.draw_shelf(x, y, z, (rot + 180) % 360, h, w=it_.get("w", 0.9))
        a = math.radians((rot + 180) % 360); fwd = (-math.sin(a), -math.cos(a)); side = (fwd[1], -fwd[0])
        cx, cz = x + fwd[0] * 0.13 + side[0] * 0.2, z + fwd[1] * 0.13 + side[1] * 0.2
        return self.draw_core(cx, y + h, cz, it_.get("finish", "chalk"), pose=it_.get("pose", "prone"), rot=rot, hero=False)

    def draw_plumbob(self, x, y, z):
        """The Sims plumbob hovering over the Companion Core (bob + spin via CSS in SVG, keyframes in lottie)."""
        r, hh = 0.2, 0.36
        it = self.new(bbox_of(x - r, y - hh, z - r, 2 * r, 2 * hh, 2 * r), name="plumbob")
        P = self.ctx.P
        c = P(x, y, z)
        add_circle(self.ctx, it, c, 0.55 * self.ctx.s, f"url(#pb_{self.sid})", opacity=0.9, cls="plumbob-aura", detail=True)
        t_apex, b_apex = P(x, y + hh, z), P(x, y - hh, z)
        b_left, b_right, b_back = P(x, y, z - r), P(x + r, y, z), P(x, y, z + r)
        faces = [([t_apex, b_left, b_right], CI_AQUA), ([t_apex, b_right, b_back], "#00a9a7"),
                 ([b_apex, b_left, b_right], "#1c8791"), ([b_apex, b_right, b_back], "#022c2b")]
        it.svg.append('<g class="plumbob-bob"><g class="plumbob-spin">')
        for pts, col in faces:
            add_poly(self.ctx, it, pts, col, stroke="#ffffff", sw=0.9)
        it.svg.append("</g></g>")
        self.plumbob_item = it
        self.plumbob_screen = c

    # ---- roofs ------------------------------------------------------------
    def draw_roofs(self):
        for rf in self.spec.get("roofs", []):
            t = rf.get("type", "flat")
            if t != "flat":
                self.skipped.append(f"{t} roof over ({rf['over']['x']},{rf['over']['z']}) removed by the cutaway")
                continue
            if rf["y"] > self.hero_y + 0.35:
                self.skipped.append(f"flat roof at y={rf['y']} lifted off (covers the hero storey)")
                continue
            o = rf["over"]; y = rf["y"]; par = rf.get("parapet", 0.3)
            col = rf.get("color", self.roof)
            it = self.new(bbox_of(o["x"], y, o["z"], o["w"], 0.15 + par, o["d"]), name="roof-flat")
            box(self.ctx, it, o["x"], y, o["z"], o["w"], 0.15, o["d"], triplet(col, 0.0, -0.1, -0.25), stroke=shade(col, -0.4), sw=0.6)
            pc = triplet(mix(col, self.wall, 0.35), 0.15, 0.0, -0.2)
            pt = 0.2
            box(self.ctx, it, o["x"], y + 0.15, o["z"], o["w"], par, pt, pc)
            box(self.ctx, it, o["x"], y + 0.15, o["z"] + o["d"] - pt, o["w"], par, pt, pc)
            box(self.ctx, it, o["x"], y + 0.15, o["z"], pt, par, o["d"], pc)
            box(self.ctx, it, o["x"] + o["w"] - pt, y + 0.15, o["z"], pt, par, o["d"], pc)
            # gravel/membrane hatch (detail)
            g = o["z"] + 0.6
            while g < o["z"] + o["d"] - pt:
                add_line(self.ctx, it, self.ctx.P(o["x"] + pt, y + 0.153, g), self.ctx.P(o["x"] + o["w"] - pt, y + 0.153, g), shade(col, 0.12), sw=0.5, opacity=0.5, detail=True)
                g += 0.6

    # ---- assemble --------------------------------------------------------
    def build(self):
        self.draw_ground()
        self.draw_site()
        self.draw_levels()
        self.draw_roofs()
        for lv in self.hidden_levels:
            self.skipped.append(f"level {lv['id']} (y={lv['y']}) removed — above the hero storey")
        return order_items(self.items)


# ---------------------------------------------------------------------------
# Canvas fitting
# ---------------------------------------------------------------------------
def fit_ctx(spec, W, H, portrait=False):
    """Landscape: fit the whole lot. Portrait: zoom on the house massing (+4 m apron) and let the lot bleed off."""
    lotd = spec.get("lot", {"w": 30, "d": 24})
    levels = spec.get("levels", [])
    top_h = max([lv["y"] + lv["height"] for lv in levels] + [7.0]) + 0.8
    if portrait and levels:
        rects = [r for lv in levels for r in lv["footprint"]]
        x0, x1, z0, z1 = union_bounds(rects)
        w, d = (x1 - x0) + 8.0, (z1 - z0) + 8.0
        hx, hz = (x0 + x1) / 2, (z0 + z1) / 2
        top_h = max([lv["y"] + lv["height"] for lv in levels]) + 1.5
        mx, my = 0.97, 0.86
    else:
        w, d = lotd.get("w", 30) + 1.0, lotd.get("d", 24) + 1.0
        hx, hz = 0.0, 0.0
        mx, my = 0.95, 0.93
    ext_x = (w + d) * COS30
    ext_y = (w + d) * SIN30 + top_h + 0.5
    scale = min(W * mx / ext_x, H * my / ext_y)
    cx = W / 2 - (hx - hz) * COS30 * scale
    cy = H / 2 + (top_h - 0.5) / 2 * scale - (hx + hz) * SIN30 * scale
    return Ctx(cx, cy, scale)


# ---------------------------------------------------------------------------
# SVG assembly
# ---------------------------------------------------------------------------
def lighting_name(spec):
    """The spec's lighting preset name: `lighting` is a name, or (plan S1) an object { preset, sunBearing }."""
    l = spec.get("lighting", "ci-dark")
    return (l.get("preset") or "day") if isinstance(l, dict) else l


def svg_defs(sid, lighting, scale):
    bg = LIGHTING_BG.get(lighting, LIGHTING_BG["ci-dark"])
    return f'''<defs>
  <style>
    @keyframes pwrBreath {{ 0%, 100% {{ opacity: 0.35; r: {round(0.08 * scale, 1)}px; }} 50% {{ opacity: 1.0; r: {round(0.2 * scale, 1)}px; }} }}
    @keyframes plantSway {{ 0% {{ transform: rotate(-1.5deg); }} 100% {{ transform: rotate(1.5deg); }} }}
    @keyframes plumbobSpin {{ 0% {{ transform: scaleX(1); }} 50% {{ transform: scaleX(-1); }} 100% {{ transform: scaleX(1); }} }}
    @keyframes plumbobBob {{ 0%, 100% {{ transform: translateY(0); }} 50% {{ transform: translateY({round(-0.12 * scale, 1)}px); }} }}
    @keyframes auraPulse {{ 0%, 100% {{ opacity: 0.35; }} 50% {{ opacity: 0.9; }} }}
    .pwr-led-halo {{ animation: pwrBreath 2.4s ease-in-out infinite; transform-origin: center; }}
    .plumbob-spin {{ animation: plumbobSpin 3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }}
    .plumbob-bob {{ animation: plumbobBob 2.6s ease-in-out infinite; }}
    .plumbob-aura {{ animation: auraPulse 2.6s ease-in-out infinite; }}
  </style>
  <linearGradient id="bg_{sid}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="{bg[0]}"/><stop offset="55%" stop-color="{bg[1]}"/><stop offset="100%" stop-color="{bg[2]}"/>
  </linearGradient>
  <linearGradient id="sky_{sid}" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#7fc4e8"/><stop offset="60%" stop-color="#bfe4f7"/><stop offset="100%" stop-color="#e8f5fb"/>
  </linearGradient>
  <radialGradient id="lamp_{sid}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#ffdf7a" stop-opacity="0.85"/><stop offset="60%" stop-color="#ffb900" stop-opacity="0.25"/><stop offset="100%" stop-color="#ffb900" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="pb_{sid}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#72ddd4" stop-opacity="0.75"/><stop offset="100%" stop-color="#72ddd4" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vig_{sid}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#0a6358" stop-opacity="0.16"/><stop offset="100%" stop-color="#0a6358" stop-opacity="0"/>
  </radialGradient>
</defs>'''


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def title_block(spec, W, H, portrait, area, lighting):
    dark = LIGHTING_BG.get(lighting, LIGHTING_BG["ci-dark"])
    lum = sum(hex_rgb(dark[1])) / 3
    fg, fg2 = ("#f3faf7", "#c5e8dc") if lum < 128 else ("#041620", "#0a6358")
    fs = 44 if not portrait else 30
    x, y = 64 if not portrait else 40, 92 if not portrait else 80
    style = esc(spec.get("style", ""))
    if portrait and len(style) > 64:
        style = style[:61].rstrip() + "…"
    elif len(style) > 120:
        style = style[:117].rstrip() + "…"
    lines = [
        (fs * 1.35, fg, "700", f"{esc(spec.get('emoji', ''))} {esc(spec.get('name', spec.get('id')))}"),
        (fs * 0.78, fg2, "400", f"by {esc(spec.get('author', '—'))} · {len(spec.get('levels', []))} storey{'s' if len(spec.get('levels', [])) != 1 else ''} · {area:.0f} m² · {esc(spec.get('lot', {}).get('ground', 'lawn'))} lot"),
        (fs * 0.62, fg2, "400", style),
    ]
    if not portrait:
        lines.append((fs * 0.55, fg2, "400", f"HouseSpec v1 · houses/{esc(spec.get('id'))}.json · SE isometric cutaway (N/W walls up, S/E walls cut at {CUT_H} m)"))
    out = [f'<g font-family="Abel, \'Helvetica Neue\', Arial, sans-serif" opacity="0.92">']
    yy = y
    for size, col, weight, text in lines:
        out.append(f'<text x="{x}" y="{round(yy)}" font-size="{round(size)}" font-weight="{weight}" fill="{col}">{text}</text>')
        yy += size * 1.25
    out.append("</g>")
    return "\n".join(out)


def generate_svg(spec, W, H, portrait=False):
    sid = f"house-{spec['id']}"
    ctx = fit_ctx(spec, W, H, portrait)
    r = HouseRenderer(spec, ctx, sid)
    items = r.build()
    lighting = lighting_name(spec)
    area = spec.get("areaSqm") or sum(union_area(lv["footprint"]) for lv in spec.get("levels", []))
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">', svg_defs(sid, lighting, ctx.s),
           f'<rect width="{W}" height="{H}" fill="url(#bg_{sid})"/>']
    c = ctx.P(0, 0, 0)
    out.append(f'<ellipse cx="{c[0]}" cy="{c[1]}" rx="{round(ctx.s * 34)}" ry="{round(ctx.s * 18)}" fill="url(#vig_{sid})"/>')
    for it in items:
        out.append(f"<g data-item=\"{esc(it.name)}\">")
        out.extend(it.svg)
        out.append("</g>")
    out.append(title_block(spec, W, H, portrait, area, lighting))
    out.append("</svg>")
    return "\n".join(out), r


# ---------------------------------------------------------------------------
# Lottie assembly (lottie-web, 1920×1080, 180 frames @ 30 fps)
# ---------------------------------------------------------------------------
def lottie_groups(shapes):
    """Convert shape primitives → lottie groups, merging runs of same-style polygons into one compound path."""
    groups, run, run_style = [], [], None

    def flush():
        if not run: return
        fill_c, stroke_c, sw, op = run_style
        items = [lot.path([[round(p[0], 1), round(p[1], 1)] for p in pts], closed=True) for pts in run]
        if fill_c != "none": items.append(lot.fill(fill_c, opacity=round(op * 100)))
        if stroke_c != "none" and sw > 0: items.append(lot.stroke(stroke_c, width=round(max(sw, 0.5), 2), opacity=round(op * 100)))
        groups.append(lot.group(items, "P"))
        run.clear()

    for s in shapes:
        if s[0] == "poly":
            _, pts, fill_c, stroke_c, sw, op = s
            style = (fill_c, stroke_c, round(sw, 2), round(op, 3))
            if run and style != run_style: flush()
            run_style = style; run.append(pts)
        else:
            flush()
            if s[0] == "line":
                _, p0, p1, stroke_c, sw, op = s
                groups.append(lot.group([lot.path([[round(p0[0], 1), round(p0[1], 1)], [round(p1[0], 1), round(p1[1], 1)]], closed=False),
                                         lot.stroke(stroke_c, width=round(max(sw, 0.5), 2), opacity=round(op * 100))], "L"))
            elif s[0] == "ellipse":
                _, cx, cy, rx, ry, fill_c, stroke_c, sw, op = s
                if fill_c.startswith("url("): fill_c = "#ffdf7a"
                items = [{"ty": "el", "nm": "E", "d": 1, "p": lot.const([round(cx, 1), round(cy, 1)]), "s": lot.const([round(2 * rx, 1), round(2 * ry, 1)])},
                         lot.fill(fill_c, opacity=round(op * 100))]
                if stroke_c != "none": items.append(lot.stroke(stroke_c, width=round(max(sw, 0.5), 2)))
                groups.append(lot.group(items, "E"))
    flush()
    groups.reverse()  # lottie stacks the FIRST shape on top, so emit back-to-front painter order reversed
    return groups


def fade_in(start, dur, total=180):
    """Layer-opacity keyframes 0 → 100. Every keyframe carries easing: lottie-web throws on a segment whose
    start keyframe lacks i/o (which is what generate_isometric_scenes.sims_opacity emits)."""
    return lot.anim([lot.kf(0, [0], lot.LINEAR), lot.kf(start, [0], lot.SMOOTH), lot.kf(start + dur, [100], lot.SMOOTH), lot.kf(total - 1, [100], lot.SMOOTH)])


CORE_SCALE_KEYS = [  # verbatim from generate_sims_scenes.build_scene_lottie (drop-in with squash/stretch), shifted by +40 frames
    {"t": 40, "s": [0, 0, 100], "e": [118, 88, 100], "i": {"x": [0.833] * 3, "y": [0.833] * 3}, "o": {"x": [0.167] * 3, "y": [0.167] * 3}},
    {"t": 125, "s": [118, 88, 100], "e": [94, 110, 100], "i": {"x": [0.833] * 3, "y": [0.833] * 3}, "o": {"x": [0.167] * 3, "y": [0.167] * 3}},
    {"t": 140, "s": [94, 110, 100], "e": [100, 100, 100], "i": {"x": [0.833] * 3, "y": [0.833] * 3}, "o": {"x": [0.167] * 3, "y": [0.167] * 3}},
    {"t": 158, "s": [100, 100, 100]},
]


def build_lottie(spec, fps=30, total=180):
    W, H = 1920, 1080
    sid = f"house-{spec['id']}"
    ctx = fit_ctx(spec, W, H, False)
    r = HouseRenderer(spec, ctx, sid)
    items = r.build()
    comp = lot.create_comp(f"Companion_Core_{sid}", total, W, H, fps)
    layers = []
    bg = LIGHTING_BG.get(lighting_name(spec), LIGHTING_BG["ci-dark"])[1]

    ground = [s for it in items if it.prio < 2 for s in it.shapes]
    house = [s for it in items if it.prio >= 2 and it not in (r.core_item, r.plumbob_item) for s in it.shapes]
    hc = ctx.P(0, 1.5, 0)

    # 1 (top) plumbob: spin (mirrored x-scale) + bob + aura pulse
    if r.plumbob_item:
        pc = r.plumbob_screen
        faces = [s for s in r.plumbob_item.shapes if s[0] == "poly"]
        diamond = lot.group(lottie_groups(faces), "Plumbob_Diamond", p=(pc[0], pc[1]), a=(pc[0], pc[1]))
        diamond["it"][-1]["s"] = lot.anim([lot.kf(0, [100, 100], lot.SMOOTH), lot.kf(45, [8, 100], lot.SMOOTH), lot.kf(90, [-100, 100], lot.SMOOTH),
                                           lot.kf(135, [8, 100], lot.SMOOTH), lot.kf(total - 1, [100, 100], lot.SMOOTH)])
        aura = {"ty": "el", "nm": "Aura", "d": 1, "p": lot.const([pc[0], pc[1]]), "s": lot.const([1.1 * ctx.s, 1.1 * ctx.s])}
        aura_fill = lot.fill(CI_AQUA, opacity=lot.anim([lot.kf(0, [0], lot.LINEAR), lot.kf(60, [0], lot.SMOOTH), lot.kf(80, [55], lot.SMOOTH), lot.kf(110, [20], lot.SMOOTH),
                                                        lot.kf(140, [60], lot.SMOOTH), lot.kf(total - 1, [30], lot.SMOOTH)]))
        pb_layer = lot.layer(comp, 1, "Sims_Plumbob", [lot.group([aura, aura_fill], "Plumbob_Aura"), diamond],
                             pos=lot.anim([lot.kf(0, [pc[0], pc[1], 0], lot.LINEAR), lot.kf(60, [pc[0], pc[1], 0], lot.SMOOTH), lot.kf(100, [pc[0], pc[1] - 0.12 * ctx.s, 0], lot.SMOOTH),
                                           lot.kf(140, [pc[0], pc[1], 0], lot.SMOOTH), lot.kf(total - 1, [pc[0], pc[1] - 0.06 * ctx.s, 0], lot.SMOOTH)]),
                             anchor=(pc[0], pc[1]),
                             opacity=fade_in(58, 16, total))
        layers.append(pb_layer)

    # 2 Companion Core: drop-in squash/stretch + breathing LED ring
    if r.core_item:
        cc = r.hero_screen
        core_shapes = lottie_groups([s for s in r.core_item.shapes if s[0] != "ellipse"])
        led = next((s for s in r.core_item.shapes if s[0] == "ellipse"), None)
        if led:
            _, lx, ly, lr, _, _, _, _, _ = led
            rs = max(2.6 * lr, 0.16 * ctx.s)
            ring = {"ty": "el", "nm": "LED_Ring", "d": 1, "p": lot.const([lx, ly]), "s": lot.const([round(rs, 1), round(rs, 1)])}
            ring_fill = lot.fill(CI_AQUA, opacity={"a": 1, "k": [
                {"t": 0, "s": [40], "e": [100], "i": {"x": [0.833], "y": [0.833]}, "o": {"x": [0.167], "y": [0.167]}},
                {"t": 90, "s": [100], "e": [40], "i": {"x": [0.833], "y": [0.833]}, "o": {"x": [0.167], "y": [0.167]}},
                {"t": 180, "s": [40]}]})
            core_shapes.append(lot.group([ring, ring_fill], "Power_Ring_Breathing"))
            core_shapes.append(lot.group([{"ty": "el", "nm": "LED", "d": 1, "p": lot.const([lx, ly]), "s": lot.const([lr, lr])}, lot.fill("#00a9a7"), lot.stroke("white", width=1.0)], "LED_Dot"))
        core_layer = lot.layer(comp, 2, "Companion_Core_Appliance", core_shapes, pos=(cc[0], cc[1]), anchor=(cc[0], cc[1]),
                               scale={"a": 1, "k": CORE_SCALE_KEYS})
        layers.append(core_layer)

    # 3 House architecture + furniture + site props: Sims pop-in
    room_keys = [
        {"t": 0, "s": [0, 0, 100], "e": [106, 106, 100], "i": {"x": [0.833] * 3, "y": [0.833] * 3}, "o": {"x": [0.167] * 3, "y": [0.167] * 3}},
        {"t": 32, "s": [106, 106, 100], "e": [100, 100, 100], "i": {"x": [0.833] * 3, "y": [0.833] * 3}, "o": {"x": [0.167] * 3, "y": [0.167] * 3}},
        {"t": 52, "s": [100, 100, 100]},
    ]
    layers.append(lot.layer(comp, 3, "House_Cutaway", lottie_groups(house), pos=(hc[0], hc[1]), anchor=(hc[0], hc[1]), scale={"a": 1, "k": room_keys}))
    # 4 Ground & flat site slabs: fade in
    layers.append(lot.layer(comp, 4, "Lot_Ground", lottie_groups(ground), opacity=fade_in(1, 14, total)))
    # 5 Background
    layers.append(lot.layer(comp, 5, "Background", [lot.group([{"ty": "rc", "nm": "BG", "d": 1, "s": lot.const([W, H]), "p": lot.const([W / 2, H / 2]), "r": lot.const(0)}, lot.fill(bg)], "BG")]))
    comp["layers"] = layers
    return comp, r


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
def manifest_entry(spec):
    hid = f"house-{spec['id']}"
    return {
        "id": hid, "specId": spec["id"], "title": spec.get("name", spec["id"]), "author": spec.get("author", ""),
        "style": spec.get("style", ""), "emoji": spec.get("emoji", "🏠"),
        "svgLandscape": f"scenes/svg/{hid}.svg", "svgPortrait": f"scenes/svg/{hid}.mobile.svg",
        "lottie": f"scenes/lottie-scenes/{hid}.json",
        "floorplans": [f"scenes/floorplans/fp-{spec['id']}-l{n}.svg" for n in range(1, len(spec.get("levels", [])) + 1)],
        "creator3d": f"room-creator.html?house={spec['id']}",   # relative to the repo root, like every path above
    }


def update_manifest(entries):
    data = {}
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    existing = {h["id"]: h for h in data.get("houses", [])}
    for e in entries:
        existing[e["id"]] = e
    data["houses"] = [existing[k] for k in sorted(existing)]
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def load_specs(only=None):
    specs = []
    for p in sorted(HOUSES_DIR.glob("*.json")):
        try:
            with open(p, "r", encoding="utf-8") as f:
                spec = json.load(f)
        except Exception as e:  # noqa: BLE001
            print(f"  [skip] {p.name}: invalid JSON ({e})"); continue
        if not isinstance(spec, dict) or "levels" not in spec or "id" not in spec:
            continue  # index.json etc.
        if only and spec["id"] != only: continue
        specs.append(spec)
    return specs


def main(argv=None):
    global HOUSES_DIR, SCENES_DIR, SVG_DIR, LOTTIE_DIR, RENDERS_DIR, MANIFEST_PATH
    ap = argparse.ArgumentParser(description="HouseSpec v1 → Sims-style isometric cutaway SVG + Lottie")
    ap.add_argument("--specs", metavar="DIR", help="read the specs (and their <id>.plan.json) from DIR instead of content/houses "
                                                     "(scripts/test-twins.mts proves the twins on test/fixtures/houses this way)")
    ap.add_argument("--out", metavar="DIR", help="write svg/, lottie-scenes/, renders/ and manifest.json under DIR instead of scenes/")
    ap.add_argument("--only", help="render a single house id")
    ap.add_argument("--png", action="store_true", help="also rasterise PNG previews with rsvg-convert")
    ap.add_argument("--png-dir", default=str(RENDERS_DIR), help="where --png previews go (default scenes/renders)")
    ap.add_argument("--no-manifest", action="store_true", help="do not touch scenes/manifest.json")
    args = ap.parse_args(argv)
    if args.specs:
        HOUSES_DIR = Path(args.specs).resolve()
    if args.out:
        SCENES_DIR = Path(args.out).resolve()
        SVG_DIR, LOTTIE_DIR, RENDERS_DIR, MANIFEST_PATH = SCENES_DIR / "svg", SCENES_DIR / "lottie-scenes", SCENES_DIR / "renders", SCENES_DIR / "manifest.json"
        if args.png_dir == str(ROOT / "scenes" / "renders"):
            args.png_dir = str(RENDERS_DIR)

    specs = load_specs(args.only)
    if not specs:
        print("No HouseSpec files found in", HOUSES_DIR); return 1
    SVG_DIR.mkdir(parents=True, exist_ok=True); LOTTIE_DIR.mkdir(parents=True, exist_ok=True)
    entries = []
    for spec in specs:
        hid = f"house-{spec['id']}"
        print(f"--> {hid}: {spec.get('name')} ({len(spec.get('levels', []))} levels)")
        svg_land, r = generate_svg(spec, 3840, 2160, False)
        (SVG_DIR / f"{hid}.svg").write_text(svg_land, encoding="utf-8")
        svg_port, _ = generate_svg(spec, 1080, 1920, True)
        (SVG_DIR / f"{hid}.mobile.svg").write_text(svg_port, encoding="utf-8")
        lottie, _ = build_lottie(spec)
        with open(LOTTIE_DIR / f"{hid}.json", "w", encoding="utf-8") as f:
            json.dump(lottie, f, separators=(",", ":"))
        n_items = len(r.items)
        print(f"    svg {len(svg_land) // 1024} KB · mobile {len(svg_port) // 1024} KB · lottie {(LOTTIE_DIR / f'{hid}.json').stat().st_size // 1024} KB · {n_items} paint items")
        for s in sorted(set(r.skipped)):
            print(f"    note: {s}")
        if args.png:
            out_dir = Path(args.png_dir); out_dir.mkdir(parents=True, exist_ok=True)
            for src, w, h, dst in ((SVG_DIR / f"{hid}.svg", 3840, 2160, out_dir / f"{hid}.png"), (SVG_DIR / f"{hid}.mobile.svg", 1080, 1920, out_dir / f"{hid}.mobile.png")):
                try:
                    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), str(src), "-o", str(dst)], check=True)
                    print(f"    png {dst}")
                except Exception as e:  # noqa: BLE001
                    print(f"    [warn] PNG render failed: {e}")
        entries.append(manifest_entry(spec))
    if not args.no_manifest:
        update_manifest(entries)
        print(f"manifest: {MANIFEST_PATH} ← houses[{len(entries)}]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
