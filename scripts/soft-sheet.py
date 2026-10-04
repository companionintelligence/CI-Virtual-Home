#!/usr/bin/env python3
"""Compose scripts/soft-sheet.mts's tiles: each image cropped to its middle (the prop stands in the centre of a wide, empty frame) and
scaled to tile_w wide, under a label strip. spec = { out, tile_w, crop: [x0, y0, x1, y1] (fractions), title, rows: [[{file, label, sub}]] }"""
import json, sys
from PIL import Image, ImageDraw, ImageFont
spec = json.load(open(sys.argv[1]))
W = int(spec.get("tile_w", 480)); x0, y0, x1, y1 = spec.get("crop", [0, 0, 1, 1])
H = int(W * (y1 - y0) * 540 / ((x1 - x0) * 960)); STRIP = 22; TITLE = 30
font = ImageFont.load_default(size=13); big = ImageFont.load_default(size=16)
rows = spec["rows"]; cols = max(len(r) for r in rows)
sheet = Image.new("RGB", (W * cols, TITLE + (H + STRIP) * len(rows)), (20, 20, 20)); d = ImageDraw.Draw(sheet)
d.text((8, 7), spec["title"], fill=(235, 235, 235), font=big)
for ri, row in enumerate(rows):
    for ci, t in enumerate(row):
        x, y = ci * W, TITLE + ri * (H + STRIP)
        if t.get("file"):
            im = Image.open(t["file"]).convert("RGB"); iw, ih = im.size
            im = im.crop((int(x0 * iw), int(y0 * ih), int(x1 * iw), int(y1 * ih))).resize((W, H), Image.LANCZOS)
            sheet.paste(im, (x, y + STRIP))
        d.rectangle([x, y, x + W - 1, y + STRIP - 1], fill=(0, 0, 0)); d.text((x + 6, y + 4), t.get("label", ""), fill=(255, 255, 255), font=font)
        sub = t.get("sub", "")
        if sub: d.text((x + W - d.textlength(sub, font=font) - 6, y + 4), sub, fill=(170, 170, 170), font=font)
sheet.save(spec["out"], quality=int(spec.get("quality", 90))); print(spec["out"], sheet.size)
