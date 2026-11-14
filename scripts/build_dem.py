"""
Crop NASA's LOLA lunar elevation map to Lostronomy's view and export a compact
binary height grid for the browser.

Source: NASA SVS CGI Moon Kit — https://svs.gsfc.nasa.gov/4720
        ldem_16_uint.tif (5760x2880, 16 px/deg, centered on 0° lon).
        Values are uint16 half-meters, offset +20000 (10 km), relative to a
        1737.4 km sphere.

Output: public/terrain/moon_dem.bin  (uint16 little-endian, row-major, north→south)
        public/terrain/moon_dem.json (grid metadata)

Usage:  python3 -I scripts/build_dem.py /path/to/ldem_16_uint.tif
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SRC_PPD = 16          # source pixels per degree
OUT_PPD = 8           # output pixels per degree
LON_MIN, LON_MAX = -56.0, 56.0
LAT_MIN, LAT_MAX = -50.0, 50.0

def main(src: str) -> None:
    Image.MAX_IMAGE_PIXELS = None
    img = np.array(Image.open(src), dtype=np.uint16)
    h, w = img.shape
    assert (w, h) == (360 * SRC_PPD, 180 * SRC_PPD), f"unexpected size {w}x{h}"

    x0 = int((LON_MIN + 180) * SRC_PPD); x1 = int((LON_MAX + 180) * SRC_PPD)
    y0 = int((90 - LAT_MAX) * SRC_PPD);  y1 = int((90 - LAT_MIN) * SRC_PPD)
    crop = img[y0:y1, x0:x1].astype(np.float64)

    # box-filter downsample (average f×f blocks)
    f = SRC_PPD // OUT_PPD
    ch, cw = crop.shape[0] // f, crop.shape[1] // f
    small = crop[: ch * f, : cw * f].reshape(ch, f, cw, f).mean(axis=(1, 3))
    out = np.round(small).astype("<u2")

    root = Path(__file__).resolve().parent.parent / "public" / "terrain"
    root.mkdir(parents=True, exist_ok=True)
    out.tofile(root / "moon_dem.bin")

    meters = (out.astype(np.int32) - 20000) / 2.0
    meta = {
        "source": "NASA SVS CGI Moon Kit (LRO LOLA), ldem_16_uint.tif — https://svs.gsfc.nasa.gov/4720",
        "width": cw, "height": ch, "ppd": OUT_PPD,
        "lonMin": LON_MIN, "lonMax": LON_MAX, "latMin": LAT_MIN, "latMax": LAT_MAX,
        "encoding": "uint16 LE, half-meters, offset 20000, row 0 = latMax",
        "minMeters": float(meters.min()), "maxMeters": float(meters.max()),
    }
    (root / "moon_dem.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(meta, indent=2))
    print("bytes:", (root / "moon_dem.bin").stat().st_size)

if __name__ == "__main__":
    main(sys.argv[1])
