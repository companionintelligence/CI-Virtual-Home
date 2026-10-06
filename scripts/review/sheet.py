#!/usr/bin/env python3
"""Compose a labelled contact sheet from a JSON spec (scripts/review/sheets.mts writes the spec and calls this).

spec = { "out": path, "tile_w": 480, "quality": 90, "title": str, "rows": [ [ {"file": path|null, "label": str, "sub": str} , ... ], ... ] }

Every tile is the image scaled to tile_w wide (16:9), under a 22 px label strip. A tile with no file is left as a dark
placeholder with its label (a frame the other set has and this one does not). Deterministic: the same spec and the same pixels
write the same bytes (PIL's default font at a fixed size, LANCZOS, a fixed JPEG quality).
"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

spec = json.load(open(sys.argv[1]))
W = int(spec.get("tile_w", 480))
H = W * 9 // 16
STRIP = 22
TITLE = 30 if spec.get("title") else 0
font = ImageFont.load_default(size=13)
big = ImageFont.load_default(size=16)
rows = spec["rows"]
cols = max(len(r) for r in rows)
sheet = Image.new("RGB", (W * cols, TITLE + (H + STRIP) * len(rows)), (20, 20, 20))
d = ImageDraw.Draw(sheet)
if TITLE:
    d.text((8, 7), spec["title"], fill=(235, 235, 235), font=big)
for ri, row in enumerate(rows):
    for ci, t in enumerate(row):
        x, y = ci * W, TITLE + ri * (H + STRIP)
        if t.get("file"):
            im = Image.open(t["file"]).convert("RGB").resize((W, H), Image.LANCZOS)
            sheet.paste(im, (x, y + STRIP))
        else:
            d.rectangle([x + 1, y + STRIP + 1, x + W - 2, y + STRIP + H - 2], outline=(70, 70, 70))
            d.text((x + 10, y + STRIP + H // 2 - 7), "no frame", fill=(110, 110, 110), font=font)
        d.rectangle([x, y, x + W - 1, y + STRIP - 1], fill=(0, 0, 0))
        lab = t.get("label", "")
        d.text((x + 6, y + 4), lab, fill=(255, 255, 255), font=font)
        sub = t.get("sub", "")
        if sub:
            tw = d.textlength(sub, font=font)
            d.text((x + W - tw - 6, y + 4), sub, fill=(170, 170, 170), font=font)
sheet.save(spec["out"], quality=int(spec.get("quality", 90)))
print(spec["out"], sheet.size)
