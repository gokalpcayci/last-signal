"""
Crop NASA's LRO color map to the same grid as moon_dem.bin and export a
grayscale albedo (surface brightness) PNG: dark maria vs. bright highlands.

Source: NASA SVS CGI Moon Kit — https://svs.gsfc.nasa.gov/4720
        lroc_color_2k.jpg (2048x1024, equirectangular, centered on 0° lon)

Output: public/terrain/moon_albedo.png (8-bit gray, same width/height/bounds
        as public/terrain/moon_dem.json; row 0 = latMax)

Usage:  python3 -I scripts/build_albedo.py /path/to/lroc_color_2k.jpg
"""
import json
import sys
from pathlib import Path

from PIL import Image

def main(src: str) -> None:
    root = Path(__file__).resolve().parent.parent / "public" / "terrain"
    meta = json.loads((root / "moon_dem.json").read_text())
    img = Image.open(src).convert("L")
    w, h = img.size
    ppd = w / 360.0
    box = (
        (meta["lonMin"] + 180) * ppd, (90 - meta["latMax"]) * ppd,
        (meta["lonMax"] + 180) * ppd, (90 - meta["latMin"]) * ppd,
    )
    out = img.resize((meta["width"], meta["height"]), Image.Resampling.LANCZOS, box=box)
    out.save(root / "moon_albedo.png", optimize=True)
    print("saved", out.size, (root / "moon_albedo.png").stat().st_size, "bytes")

if __name__ == "__main__":
    main(sys.argv[1])
