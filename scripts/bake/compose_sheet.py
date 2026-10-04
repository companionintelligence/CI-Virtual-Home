# Tiles with captions into one contact sheet (Pillow). usage: python3 compose_sheet.py <tiles.json> <out.jpg> <cols>
# tiles.json: [{"file": "...", "label": "..."}]; every tile is fitted into 480 x 270 on a light ground with its caption under it.
import json, sys
from PIL import Image, ImageDraw, ImageFont
tiles = json.load(open(sys.argv[1])); out = sys.argv[2]; cols = int(sys.argv[3])
W, H, CAP, GAP = 480, 270, 26, 4
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (W + GAP) + GAP, rows * (H + CAP + GAP) + GAP), (200, 200, 200))
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 15)
except Exception: font = ImageFont.load_default()
for i, t in enumerate(tiles):
    im = Image.open(t['file']).convert('RGB'); im.thumbnail((W, H), Image.LANCZOS)
    x, y = GAP + (i % cols) * (W + GAP), GAP + (i // cols) * (H + CAP + GAP)
    d.rectangle([x, y, x + W, y + H + CAP], fill=(235, 235, 235))
    sheet.paste(im, (x + (W - im.width) // 2, y + (H - im.height) // 2))
    d.text((x + 8, y + H + 5), t['label'], fill=(30, 30, 30), font=font)
sheet.save(out, quality=90)
print('sheet', out, len(tiles), 'tiles')
