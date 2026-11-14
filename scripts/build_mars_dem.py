"""
Convert NASA's MOLA global Mars elevation map into Lostronomy's compact height
grid (same encoding as the Moon: see build_dem.py).

Source: MGS MOLA MEGDR, megt90n000cb.img (+ .lbl) — PDS Geosciences Node
        https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg004/
        1440x720, 4 px/deg, simple cylindrical, columns start at 0° E,
        int16 big-endian meters relative to the Mars areoid (3396 km sphere).

Output: public/terrain/mars_dem.bin  (uint16 LE half-meters + 20000, row 0 = latMax)
        public/terrain/mars_dem.json (grid metadata)

The whole planet is shown, centered on LON_CENTER (145° W: puts the ±180° seam
in the widest gap between landing sites, and Olympus Mons near the middle).
lonMin/lonMax in the JSON are *relative to lonCenter*; the crop wraps around the
globe for the plateau's cliff margin.

Usage:  python3 -I scripts/build_mars_dem.py /path/to/megt90n000cb.img
"""
import json
import sys
from pathlib import Path

import numpy as np

SRC_PPD = 4
OUT_PPD = 2               # the mesh has <1 vertex per degree here; 2 px/deg is plenty
LON_CENTER = -145.0
LON_MIN, LON_MAX = -188.0, 188.0   # relative to LON_CENTER
LAT_MIN, LAT_MAX = -88.0, 88.0

def main(src: str) -> None:
    img = np.fromfile(src, dtype=">i2")
    assert img.size == 360 * SRC_PPD * 180 * SRC_PPD, f"unexpected size {img.size}"
    img = img.reshape(180 * SRC_PPD, 360 * SRC_PPD).astype(np.float64)

    # columns: 0°E…360°E  →  shift so column 0 is LON_MIN (wrapping around the globe)
    cols = (np.arange(int((LON_CENTER + LON_MIN) * SRC_PPD), int((LON_CENTER + LON_MAX) * SRC_PPD)) % (360 * SRC_PPD))
    y0 = int((90 - LAT_MAX) * SRC_PPD); y1 = int((90 - LAT_MIN) * SRC_PPD)
    crop = img[y0:y1][:, cols]

    f = SRC_PPD // OUT_PPD
    ch, cw = crop.shape[0] // f, crop.shape[1] // f
    small = crop[: ch * f, : cw * f].reshape(ch, f, cw, f).mean(axis=(1, 3))
    enc = np.round(small * 2 + 20000)
    assert enc.min() >= 0 and enc.max() <= 65535, "elevation out of uint16 range"
    out = enc.astype("<u2")

    root = Path(__file__).resolve().parent.parent / "public" / "terrain"
    root.mkdir(parents=True, exist_ok=True)
    out.tofile(root / "mars_dem.bin")

    meta = {
        "source": "NASA MGS MOLA MEGDR megt90n000cb (PDS Geosciences Node) — https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/",
        "width": cw, "height": ch, "ppd": OUT_PPD,
        "lonCenter": LON_CENTER, "lonMin": LON_MIN, "lonMax": LON_MAX, "latMin": LAT_MIN, "latMax": LAT_MAX,
        "encoding": "uint16 LE, half-meters, offset 20000, row 0 = latMax",
        "minMeters": float(small.min()), "maxMeters": float(small.max()),
    }
    (root / "mars_dem.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(meta, indent=2))
    print("bytes:", (root / "mars_dem.bin").stat().st_size)

if __name__ == "__main__":
    main(sys.argv[1])
