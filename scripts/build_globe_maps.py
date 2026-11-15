"""
Build the globe view's sharper maps from NASA sources (replaces Offworld Archive's 8-bit
Trek globals for height, and the Moon's colour).

Height (both bodies) → public/globe/<body>-height.webp
    4096×2048 equirectangular, column 0 = 180° W, row 0 = 90° N.
    Normalized over the body's full elevation range to 16 bits, kept to the top BITS bits
    (11: ~10 m steps; full 16 bits tripled the file for detail nobody sees), packed into a
    lossless WebP as R = high byte, G = low byte, B = 0 (browsers decode 16-bit PNGs to 8 bits).
    Range written to public/globe/<body>-height.json (meters, for checking the relief
    constants in src/scene/globe.ts).

Moon colour → public/globe/moon-color.jpg (4096×2048, LRO WAC mosaic as is).

Sources:
  Moon height  NASA SVS CGI Moon Kit (svs.gsfc.nasa.gov/4720) ldem_16_uint.tif
               5760×2880, 16 px/deg, uint16 half-meters + 20000, centered on 0° lon
  Moon colour  same kit, lroc_color_poles_4k.tif (4096×2048, LRO WAC + polar fill)
  Mars height  MGS MOLA MEGDR megt90n000eb.img (PDS Geosciences Node, meg016)
               5760×2880, 16 px/deg, int16 big-endian meters, column 0 = 0° E

Usage:  python3 -I scripts/build_globe_maps.py <dir with the three files>
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

W, H = 4096, 2048
BITS = 11
OUT = Path(__file__).resolve().parent.parent / "public" / "globe"


def resize(meters: np.ndarray) -> np.ndarray:
    img = Image.fromarray(meters.astype(np.float32), mode="F")
    return np.asarray(img.resize((W, H), Image.Resampling.LANCZOS), dtype=np.float64)


def write_height(body: str, meters: np.ndarray) -> None:
    m = resize(meters)
    lo, hi = float(m.min()), float(m.max())
    q = np.round((m - lo) / (hi - lo) * 65535).astype(np.uint16)
    q = (q >> (16 - BITS)) << (16 - BITS)
    rgb = np.zeros((H, W, 3), np.uint8)
    rgb[..., 0] = q >> 8
    rgb[..., 1] = q & 0xFF
    Image.fromarray(rgb, "RGB").save(OUT / f"{body}-height.webp", lossless=True, quality=100, method=6)
    meta = {"width": W, "height": H, "bits": BITS, "minM": round(lo, 1), "maxM": round(hi, 1)}
    (OUT / f"{body}-height.json").write_text(json.dumps(meta) + "\n")
    print(f"{body}: {lo:.0f} … {hi:.0f} m (range {(hi - lo) / 1000:.2f} km)")


def main(src: str) -> None:
    d = Path(src)
    Image.MAX_IMAGE_PIXELS = None

    moon = np.asarray(Image.open(d / "ldem_16_uint.tif"), dtype=np.float64)
    assert moon.shape == (2880, 5760), moon.shape
    write_height("moon", (moon - 20000) / 2)            # half-meters → meters

    mars = np.fromfile(d / "megt90n000eb.img", dtype=">i2").reshape(2880, 5760).astype(np.float64)
    write_height("mars", np.roll(mars, 2880, axis=1))   # column 0: 0° E → 180° W

    col = Image.open(d / "lroc_color_poles_4k.tif").convert("RGB")
    assert col.size == (W, H), col.size
    col.save(OUT / "moon-color.jpg", quality=88, optimize=True)


if __name__ == "__main__":
    main(sys.argv[1])
