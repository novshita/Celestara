"""Makes the small planet images the Home page's arc uses (frontend/public/grahas/*.webp):

  sun, moon, mars, mercury, jupiter, saturn   the photographs from frontend/public/planets,
                                              shrunk to the size they are shown at (twice it,
                                              for dense screens), so the arc is not carrying
                                              400-700px pictures for 40px planets
  venus                                       drawn here: pale cream cloud tops, lit from the
                                              upper left like every other planet
  rahu, ketu                                  drawn here: the lunar nodes are not bodies you can
                                              photograph, so each is a dark sphere in an
                                              eclipse's glowing rim - cool for Rahu, warm for Ketu

    python design/prepare_grahas.py        # needs: pip install pillow numpy
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PLANETS = ROOT / "frontend" / "public" / "planets"
OUT = ROOT / "frontend" / "public" / "grahas"
N = 192  # the drawn bodies' canvas; shown at 40px or so, so this is generously sharp
rng = np.random.default_rng(3)

# (name, longest side in px): about twice the CSS size each is shown at
PHOTOS = {"sun": 96, "moon": 80, "mars": 80, "mercury": 72, "jupiter": 96, "saturn": 124}


def noise(octaves: tuple[int, ...], weights: tuple[float, ...]) -> np.ndarray:
    """Smooth random field in [-0.5, 0.5], from random grids of several sizes scaled up and added."""
    total = np.zeros((N, N), np.float32)
    for size, weight in zip(octaves, weights):
        grid = rng.random((size, size)).astype(np.float32)
        up = Image.fromarray((grid * 255).astype(np.uint8)).resize((N, N), Image.BICUBIC)
        total += weight * (np.asarray(up, np.float32) / 255 - 0.5)
    return total


def sphere_coords() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Normalised x, y over the disc (-1..1), the height of the sphere there, and a mask."""
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    x, y = (x - N / 2 + 0.5) / (N / 2), (y - N / 2 + 0.5) / (N / 2)
    d2 = x * x + y * y
    z = np.sqrt(np.clip(1 - d2, 0, 1))
    return x, y, z, d2


def light(x: np.ndarray, y: np.ndarray, z: np.ndarray) -> np.ndarray:
    """Lit from the upper left, with a dark far side and a soft terminator."""
    return np.clip(-0.42 * x - 0.52 * y + 0.74 * z, 0, 1)


def shade(rgb: np.ndarray, x, y, z, ambient: float = 0.16) -> np.ndarray:
    lit = ambient + (1 - ambient) * light(x, y, z) ** 0.9
    return rgb * lit[..., None]


def finish(rgb: np.ndarray, alpha: np.ndarray, name: str, size: int = 96) -> None:
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha, 0, 1) * 255]).astype(np.uint8)
    img = Image.fromarray(out, "RGBA").resize((size, size), Image.LANCZOS)
    img.save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)


def venus() -> None:
    x, y, z, d2 = sphere_coords()
    # horizontal bands that drift and swirl, as the cloud tops of Venus do
    warp = noise((3, 6), (0.9, 0.5))
    bands = np.sin((y * 5.2 + warp * 3.4 + noise((4, 9), (0.8, 0.4)) * 1.6) * np.pi)
    detail = noise((8, 20, 48), (0.5, 0.3, 0.16))
    t = np.clip(0.5 + 0.28 * bands + 0.7 * detail, 0, 1)
    cream, pale, amber = np.array([246, 238, 212]), np.array([232, 210, 150]), np.array([204, 164, 98])
    rgb = np.where(t[..., None] > 0.5, cream * (t[..., None] - 0.5) * 2 + pale * (1 - (t[..., None] - 0.5) * 2),
                   pale * t[..., None] * 2 + amber * (1 - t[..., None] * 2))
    rgb = shade(rgb, x, y, z, 0.2)
    rgb += (1 - z)[..., None] ** 3 * np.array([40, 34, 18])  # a thin bright atmosphere at the limb
    alpha = np.clip((1 - np.sqrt(d2)) * N * 0.5, 0, 1)
    finish(rgb, alpha, "venus")


def node(name: str, rim: tuple[int, int, int], rim_strength: float) -> None:
    """A dark sphere in an eclipse's rim: the node is where the Moon's path crosses the Sun's."""
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    x, y = (x - N / 2 + 0.5) / (N / 2), (y - N / 2 + 0.5) / (N / 2)
    r = np.sqrt(x * x + y * y)
    body_r = 0.82
    inside = np.clip((body_r - r) / 0.025, 0, 1)
    z = np.sqrt(np.clip(1 - (r / body_r) ** 2, 0, 1))
    smoke = noise((4, 9, 22), (0.7, 0.4, 0.2))
    base = np.array([58, 52, 92]) + smoke[..., None] * np.array([90, 78, 120])
    lit = np.clip(-0.4 * x - 0.5 * y + 0.35 * z, 0, 1)  # a lit shoulder, upper left
    body = base * (0.3 + 1.0 * lit[..., None]) + (1 - z)[..., None] ** 2.2 * np.array(rim) * 0.95
    # the corona: a bright thin ring at the edge, falling away outside it
    edge = r - body_r
    glow = np.exp(-np.clip(edge, 0, None) / 0.11) * (edge >= 0) * rim_strength
    glow += np.exp(-np.clip(-edge, 0, None) / 0.05) * (edge < 0) * rim_strength * 0.7
    ring = glow[..., None] * np.array(rim)
    rgb = np.where(inside[..., None] > 0, body, 0) * inside[..., None] + ring
    alpha = np.clip(inside + glow * 1.1, 0, 1) * np.clip((1 - r) / 0.04, 0, 1)
    finish(rgb, alpha, name)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, longest in PHOTOS.items():
        img = Image.open(PLANETS / f"{name}.webp").convert("RGBA")
        w, h = img.size
        scale = longest / max(w, h)
        img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS).save(
            OUT / f"{name}.webp", "WEBP", quality=90, method=6
        )
    venus()
    node("rahu", (130, 178, 255), 1.25)
    node("ketu", (255, 160, 80), 1.25)
    for f in sorted(OUT.glob("*.webp")):
        print(f"{f.stem:8} {Image.open(f).size}  {f.stat().st_size // 1024 or '<1'} KB")


if __name__ == "__main__":
    main()
