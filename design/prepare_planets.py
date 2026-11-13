"""Turns the planet photos in planets/ (JPEG on a black square) into the cut-out
WebP images the landing page uses, in frontend/public/planets/.

    python design/prepare_planets.py        # needs: pip install pillow numpy

Spheres are cropped to their disc and given a circular, anti-aliased edge, so
there is no dark box around them. Saturn keeps its rings: the black around it
becomes transparent instead. To change a planet, replace its JPEG in planets/
(keeping the file name below) and run this again.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "planets"
OUT = ROOT / "frontend" / "public" / "planets"

# name: (source file, kind, output width in px, brightness that counts as "the object",
#        pixels to trim off the edge: photos with a dark limb need more)
PLANETS = {
    "jupiter": ("Jupiter.jpeg", "sphere", 640, 22, 13),
    "mars": ("MARS.jpeg", "sphere", 512, 30, 3),
    "moon": ("the moon.jpeg", "sphere", 480, 30, 3),
    "mercury": ("photo of mercury.jpeg", "sphere", 400, 30, 2),
    "earth": ("NIKIN _ The _ecological footprint_ – what is it_.jpeg", "sphere", 512, 30, 4),
    "sun": ("_ (32).jpeg", "sphere", 640, 150, 2),  # the corona is dim; the bright disc is the sun
    "saturn": ("Saturne.jpeg", "cutout", 760, 14, 0),
    "blackhole": ("black-hole.jpeg", "blackhole", 560, 38, 0),
}


def extent(mask: np.ndarray) -> tuple[int, int, int, int]:
    """Bounding box of the object, ignoring stray specks of JPEG noise."""
    cols = np.where(mask.sum(axis=0) > 4)[0]
    rows = np.where(mask.sum(axis=1) > 4)[0]
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


def sphere(img: Image.Image, width: int, level: int, inset: float) -> Image.Image:
    a = np.asarray(img).max(axis=2)
    x0, y0, x1, y1 = extent(a > level)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = max(x1 - x0, y1 - y0) / 2 - inset  # just inside the edge, so no dark fringe
    side = round(2 * r)
    left, top = round(cx - r), round(cy - r)
    crop = img.crop((left, top, left + side, top + side))
    # Anti-aliased circle: draw at 4x and shrink.
    big = Image.new("L", (side * 4, side * 4), 0)
    ImageDraw.Draw(big).ellipse((0, 0, side * 4 - 1, side * 4 - 1), fill=255)
    crop.putalpha(big.resize((side, side), Image.LANCZOS))
    return crop.resize((width, width), Image.LANCZOS)


def cutout(img: Image.Image, width: int, level: int, inset: float) -> Image.Image:
    arr = np.asarray(img).astype(np.float32)
    bright = arr.max(axis=2)
    x0, y0, x1, y1 = extent(bright > level)
    pad = 6
    box = (max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad))
    crop = img.crop(box)
    b = np.asarray(crop).astype(np.float32).max(axis=2)
    alpha = np.clip((b - 6) / 22, 0, 1)  # black fades to transparent
    out = crop.convert("RGBA")
    out.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)))
    h = round(width * out.height / out.width)
    return out.resize((width, h), Image.LANCZOS)


def smooth(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def blackhole(img: Image.Image, width: int, level: int, inset: float) -> Image.Image:
    """The disc is a tilted ellipse of light on a starry black square. Keep the
    ellipse, fade its outer glow into transparency, drop the stars outside it,
    and keep the hole itself solid black."""
    rgb = np.asarray(img).astype(np.float32)
    bright = rgb.max(axis=2)
    soft = np.asarray(img.filter(ImageFilter.GaussianBlur(6))).max(axis=2)
    ys, xs = np.where(soft > level)
    cx, cy = xs.mean(), ys.mean()
    evals, evecs = np.linalg.eigh(np.cov(np.stack([xs - cx, ys - cy])))
    minor, major = np.sqrt(evals) * 2.3
    ux, uy = evecs[:, 1]  # direction of the long axis
    yy, xx = np.mgrid[0 : img.height, 0 : img.width].astype(np.float32)
    along = ((xx - cx) * ux + (yy - cy) * uy) / major
    across = (-(xx - cx) * uy + (yy - cy) * ux) / minor
    r = np.hypot(along, across)
    window = 1 - smooth(r, 0.78, 1.0)  # nothing, stars included, beyond the ellipse
    glow = np.clip((bright - 26) / 60, 0, 1)  # the faint outer glow fades out
    # The hole is the darkest spot; keep a solid patch around it so the sky does not show through
    hy, hx = np.unravel_index(np.argmin(np.asarray(img.filter(ImageFilter.GaussianBlur(10))).max(axis=2) + 400 * (r > 0.6)), bright.shape)
    hole = 1 - smooth(np.hypot((xx - hx) / 78, (yy - hy) / 48), 0.6, 1.0)
    alpha = np.maximum(glow, hole) * window
    out = img.convert("RGBA")
    out.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)))
    box = out.getbbox()
    if box:
        out = out.crop(box)
    h = round(width * out.height / out.width)
    return out.resize((width, h), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (file, kind, width, level, inset) in PLANETS.items():
        img = Image.open(SRC / file).convert("RGB")
        result = {"sphere": sphere, "cutout": cutout, "blackhole": blackhole}[kind](img, width, level, inset)
        target = OUT / f"{name}.webp"
        result.save(target, "WEBP", quality=86, method=6)
        print(f"{name:8} {result.width}x{result.height}  {target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
