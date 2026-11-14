"""
Resample NASA's MGS TES albedo map onto the Mars DEM grid (mars_dem.json) and
export a grayscale surface-brightness PNG: dark Syrtis Major / Acidalia vs.
bright dusty Tharsis / Arabia.

Source: MGS TES albedo global mosaic, Mars_MGS_TES_Albedo_mosaic_global_7410m.tif
        (USGS Astrogeology / NASA PDS — https://planetarymaps.usgs.gov/mosaic/)
        2880x1440, 8 px/deg, simple cylindrical, lon −180…180 (column 0 = 180° W),
        float32 Lambert albedo (~0.06–0.32).

Output: public/terrain/mars_albedo.png (8-bit gray, same width/height/bounds
        as public/terrain/mars_dem.json — including its lonCenter; row 0 = latMax)

Usage:  python3 -I scripts/build_mars_albedo.py /path/to/Mars_MGS_TES_Albedo_mosaic_global_7410m.tif
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ALB_MIN, ALB_MAX = 0.06, 0.32   # full TES range → 0…255 (the terrain shader stretches again)

def main(src: str) -> None:
    root = Path(__file__).resolve().parent.parent / "public" / "terrain"
    meta = json.loads((root / "mars_dem.json").read_text())
    Image.MAX_IMAGE_PIXELS = None
    img = np.array(Image.open(src), dtype=np.float64)
    h, w = img.shape
    ppd = w // 360
    assert (w, h) == (360 * ppd, 180 * ppd), f"unexpected size {w}x{h}"

    f = ppd // meta["ppd"]
    assert f * meta["ppd"] == ppd, "DEM ppd must divide the albedo ppd"
    # columns: source column 0 = −180°; output column 0 = lonCenter + lonMin (wrapping)
    lon0 = meta["lonCenter"] + meta["lonMin"]
    cols = (np.arange(meta["width"] * f) + int(round((lon0 + 180) * ppd))) % w
    r0 = int(round((90 - meta["latMax"]) * ppd))
    rows = np.arange(r0, r0 + meta["height"] * f)
    crop = img[rows][:, cols]
    small = crop.reshape(meta["height"], f, meta["width"], f).mean(axis=(1, 3))

    out = np.clip((small - ALB_MIN) / (ALB_MAX - ALB_MIN), 0, 1) * 255
    Image.fromarray(np.round(out).astype(np.uint8), "L").save(root / "mars_albedo.png", optimize=True)
    print("saved", (meta["width"], meta["height"]), (root / "mars_albedo.png").stat().st_size, "bytes")

if __name__ == "__main__":
    main(sys.argv[1])
