import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / ".docx_deps"))

import fitz

pdf_path = ROOT / "rendered_manual" / "GLV_Management_System_Training_and_Feature_Guide.pdf"
out_dir = ROOT / "rendered_manual" / "pages_v2"
out_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(pdf_path)
matrix = fitz.Matrix(1.5, 1.5)
for index, page in enumerate(document):
    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    pixmap.save(out_dir / f"page-{index + 1:03d}.png")

print(f"{len(document)} pages rendered to {out_dir}")
