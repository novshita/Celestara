"""Prepares the purple Milky Way picture that the landing page blends into the
middle of its night sky (frontend/public/sky/milkyway-purple.webp).

The source screenshot (planets/milkyway-purple.png) has two grey buttons in its
bottom-right corner, so the left part is kept and the right edge is cropped off.

    python design/prepare_sky.py        # needs: pip install pillow
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "planets" / "milkyway-purple.png"
OUT = ROOT / "frontend" / "public" / "sky" / "milkyway-purple.webp"


def main() -> None:
    img = Image.open(SRC).convert("RGB")
    w, h = img.size
    keep = img.crop((0, 0, int(w * 0.89), h))  # the buttons sit in the last ~11% on the right
    keep = keep.resize((1100, round(1100 * keep.height / keep.width)), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    keep.save(OUT, "WEBP", quality=88, method=6)
    print(f"{keep.width}x{keep.height}  {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
