#!/usr/bin/env python3
"""
Lottie shape and animation helpers for generate_house_iso.py.

Carried over from CI-Common's generated/infographics/scripts/generate_isometric_scenes.py, cut down to exactly
what generate_house_iso.py builds its Lottie with: the composition / layer / group / path / fill / stroke
constructors, keyframes (kf, anim, const) with the LINEAR and SMOOTH easings, and the PALETTE they colour from —
every definition those reach, and nothing else. The function bodies are unchanged.

The household dioramas and Companion Core hardware Lotties that module also generated (HOUSEHOLDS_CONFIG,
build_global_scene, the build_iso_* builders, main) are CI-Common content and stay there. This is a library: it
has no entry point and writes nothing on import.
"""

# ---------------------------------------------------------------------------
# Canonical Companion Intelligence Color Palette & Architectural Materials
# ---------------------------------------------------------------------------
PALETTE = {
    # CI Brand Tokens
    "primary":       "#0a6358",
    "primary-hover": "#0d7a6e",
    "primary-deep":  "#022c2b",
    "phthalo":       "#0a6358",
    "phthalo-hover": "#0d7a6e",
    "phthalo-deep":  "#022c2b",
    "sage":          "#c5e8dc",
    "sage-light":    "#e2f4ed",
    "sage-dark":     "#9abfb2",
    "teal-mid":      "#409b9b",
    "teal-accent":   "#2c676d",
    "teal-300":      "#7fbcc2",
    "teal-500":      "#1c8791",
    "aqua":          "#00a9a7",
    "aqua-light":    "#72ddd4",
    "aqua-glow":     "#a1f2eb",
    "copper":        "#c86432",
    "copper-light":  "#e07a48",
    "copper-glow":   "#ff9d6c",
    "amber":         "#ffb900",
    "amber-light":   "#ffd359",
    "coral":         "#f54900",
    "mist":          "#f3faf7",
    "mist-deep":     "#e8f2ec",
    "navy":          "#041620",
    "navy-deep":     "#020b10",
    "navy-surface":  "#0c232f",
    "steel-charcoal":"#1a242c",
    "steel-top":     "#22303a",
    "steel-left":    "#162027",
    "steel-right":   "#10171d",
    "steel-highlight":"#4a6170",
    "chalk-white":   "#f6f9f8",
    "chalk-top":     "#ffffff",
    "chalk-left":    "#e8eeed",
    "chalk-right":   "#d2dbda",
    "white":         "#ffffff",
    # Architectural Materials
    "oak":           "#b89366",
    "oak-top":       "#cfab7e",
    "oak-left":      "#b08b5e",
    "oak-right":     "#88663c",
    "oak-pale":      "#e0c7a6",
    "walnut":        "#613e25",
    "walnut-top":    "#7d5030",
    "walnut-left":   "#57351f",
    "walnut-right":  "#3c2414",
    "walnut-dark":   "#26160b",
    "teak":          "#7a4823",
    "teak-top":      "#9b5f34",
    "teak-left":     "#6f3f1e",
    "teak-right":    "#4e2d14",
    "hinoki":        "#d5b78f",
    "hinoki-top":    "#e4cca8",
    "hinoki-left":   "#c4a378",
    "hinoki-right":  "#a6855b",
    "concrete":      "#a8b0aa",
    "concrete-top":  "#c0c7c2",
    "concrete-left": "#9fa7a1",
    "concrete-right":"#7c837e",
    "travertine":    "#ede3d2",
    "travertine-top":"#faf4ea",
    "travertine-left":"#ded2bf",
    "travertine-right":"#c2b59f",
    "marble-dark":   "#181d22",
    "marble-top":    "#242b32",
    "marble-left":   "#161a1f",
    "marble-right":  "#0f1215",
    "tatami":        "#d4caa7",
    "tatami-top":    "#e3dabb",
    "tatami-border": "#1c2b26",
    "terracotta":    "#b55331",
    "terracotta-top":"#d46c48",
    "terracotta-left":"#9e4526",
    "terracotta-right":"#7c3319",
    "brick-red":     "#8a3b2b",
    "brick-dark":    "#5c2419",
    "brick-mortar":  "#d8cec5",
    "timber-fir":    "#8c5835",
    "timber-fir-top":"#a66e46",
    "timber-fir-dark":"#5e381e",
    "brass":         "#b59247",
    "brass-top":     "#d9b467",
    "brass-left":    "#a38139",
    "brass-right":   "#755b23",
    "chrome":        "#e2ebec",
    "plaster-warm":  "#f7f3ed",
    "plaster-cool":  "#eef5f2",
    "plaster-clay":  "#d8ccbe",
    "plaster-white": "#fcfbfa",
    "glass-tint":    "#d7ebe4",
    "shadow-soft":   "#041620",
    "foundation":    "#16242c"
}

def rgba(name):
    if name in PALETTE:
        hex_str = PALETTE[name].lstrip("#")
    elif isinstance(name, str) and name.startswith("#") and len(name) in (4, 7):
        hex_str = name.lstrip("#")
        if len(hex_str) == 3:
            hex_str = "".join(c*2 for c in hex_str)
    else:
        hex_str = "041620"
    r, g, b = [round(int(hex_str[i:i+2], 16) / 255.0, 4) for i in (0, 2, 4)]
    return [r, g, b, 1]

# ---------------------------------------------------------------------------
# Animation & Lottie Helpers
# ---------------------------------------------------------------------------
SMOOTH = ((0.40, 0.00), (0.60, 1.00))

LINEAR = ((0.333, 0.333), (0.667, 0.667))

def const(val):
    if isinstance(val, (list, tuple)):
        return {"a": 0, "k": list(val)}
    return {"a": 0, "k": val}

def kf(t, s, ease=SMOOTH):
    s = list(s) if isinstance(s, (list, tuple)) else [s]
    if ease is None:
        return {"t": t, "s": s}
    (ox, oy), (ix, iy) = ease
    return {"i": {"x": [ix], "y": [iy]}, "o": {"x": [ox], "y": [oy]}, "t": t, "s": s}

def anim(keyframes):
    return {"a": 1, "k": keyframes}


def fill(colour, opacity=100, name="Fill"):
    return {
        "ty": "fl",
        "nm": name,
        "c": const(rgba(colour)),
        "o": const(opacity) if not isinstance(opacity, dict) else opacity,
        "r": 1
    }

def stroke(colour, width=2, opacity=100, cap=2, join=2, name="Stroke"):
    return {
        "ty": "st",
        "nm": name,
        "c": const(rgba(colour)),
        "o": const(opacity) if not isinstance(opacity, dict) else opacity,
        "w": const(width),
        "lc": cap,
        "lj": join,
        "ml": 4
    }

def path(pts, closed=True, in_tangents=None, out_tangents=None, name="Path"):
    n = len(pts)
    in_t = in_tangents if in_tangents else [[0, 0]] * n
    out_t = out_tangents if out_tangents else [[0, 0]] * n
    return {
        "ty": "sh",
        "nm": name,
        "d": 1,
        "ks": const({
            "i": in_t,
            "o": out_t,
            "v": pts,
            "c": closed
        })
    }

def group(items, name="Group", p=(0, 0), a=(0, 0), s=(100, 100), r=0, o=100):
    tr = {
        "ty": "tr",
        "p": p if isinstance(p, dict) else const([p[0], p[1]]),
        "a": a if isinstance(a, dict) else const([a[0], a[1]]),
        "s": s if isinstance(s, dict) else const([s[0], s[1]]),
        "r": r if isinstance(r, dict) else const(r),
        "o": o if isinstance(o, dict) else const(o),
        "sk": const(0),
        "sa": const(0)
    }
    return {
        "ty": "gr",
        "nm": name,
        "np": len(items),
        "it": items + [tr]
    }

def layer(comp, idx, name, shapes, pos=(0, 0), anchor=(0, 0), scale=(100, 100), rotation=0, opacity=100):
    return {
        "ddd": 0,
        "ind": idx,
        "ty": 4,
        "nm": name,
        "sr": 1,
        "ks": {
            "o": opacity if isinstance(opacity, dict) else const(opacity),
            "r": rotation if isinstance(rotation, dict) else const(rotation),
            "p": pos if isinstance(pos, dict) else const([pos[0], pos[1], 0]),
            "a": anchor if isinstance(anchor, dict) else const([anchor[0], anchor[1], 0]),
            "s": scale if isinstance(scale, dict) else const([scale[0], scale[1], 100]),
        },
        "shapes": shapes,
        "ip": comp["ip"],
        "op": comp["op"],
        "st": 0
    }

def create_comp(name, total_frames=180, w=1280, h=720, fps=30):
    return {
        "v": "5.7.8",
        "fr": fps,
        "ip": 0,
        "op": total_frames,
        "w": w,
        "h": h,
        "nm": name,
        "ddd": 0,
        "assets": [],
        "layers": []
    }
