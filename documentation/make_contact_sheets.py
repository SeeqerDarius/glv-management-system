import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / ".docx_deps"))

from PIL import Image, ImageDraw

pages_dir = ROOT / "rendered_manual" / "pages_v2"
out_dir = ROOT / "rendered_manual" / "contact_sheets"
out_dir.mkdir(parents=True, exist_ok=True)
pages = sorted(pages_dir.glob("page-*.png"))

thumb_w, thumb_h = 510, 660
for start in range(0, len(pages), 6):
    group = pages[start:start + 6]
    sheet = Image.new("RGB", (thumb_w * 3, (thumb_h + 28) * 2), "white")
    draw = ImageDraw.Draw(sheet)
    for offset, path in enumerate(group):
        image = Image.open(path).convert("RGB")
        image.thumbnail((thumb_w - 14, thumb_h - 14))
        x = (offset % 3) * thumb_w + (thumb_w - image.width) // 2
        y = (offset // 3) * (thumb_h + 28) + 24
        sheet.paste(image, (x, y))
        draw.text((offset % 3 * thumb_w + 8, offset // 3 * (thumb_h + 28) + 5), path.stem, fill="black")
    sheet.save(out_dir / f"contact-{start // 6 + 1:02d}.png")

print(f"{(len(pages) + 5) // 6} contact sheets created")
