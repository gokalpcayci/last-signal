"""Download the story-panel photos from the NASA Image and Video Library and
shrink them into public/photos/<object id>.jpg.

The object id -> NASA id mapping is read from src/data/photos.ts, so that file is
the single source of truth. Run from the repo root:

    python3 scripts/build_photos.py            # only missing files
    python3 scripts/build_photos.py --force    # rebuild all
"""
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src/data/photos.ts'
OUT = ROOT / 'public/photos'
MAX_W = 720          # panel is ≤340 css px wide → 2× for retina
QUALITY = 74

ENTRY = re.compile(r"^\s*'?([\w-]+)'?:\s*\{\s*nasaId:\s*'([^']+)'", re.M)


def asset_url(nasa_id: str) -> str:
    with urllib.request.urlopen(f'https://images-api.nasa.gov/asset/{nasa_id}', timeout=60) as r:
        hrefs = [i['href'] for i in json.load(r)['collection']['items']]
    for size in ('~large', '~medium', '~orig'):
        for h in hrefs:
            # some old JPL entries only ship a TIFF original
            if size in h and h.lower().endswith(('.jpg', '.jpeg', '.png', '.tif', '.tiff')):
                return h.replace('http://', 'https://')
    raise RuntimeError(f'no image asset for {nasa_id}')


def main() -> None:
    force = '--force' in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    entries = ENTRY.findall(SRC.read_text())
    if not entries:
        sys.exit('no photo entries found in photos.ts')
    for obj_id, nasa_id in entries:
        dst = OUT / f'{obj_id}.jpg'
        if dst.exists() and not force:
            continue
        url = asset_url(nasa_id)
        with urllib.request.urlopen(url, timeout=120) as r:
            im = Image.open(io.BytesIO(r.read())).convert('RGB')
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        im.save(dst, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        print(f'{obj_id:14} {nasa_id:16} {im.width}x{im.height} {dst.stat().st_size // 1024} KB')
    total = sum(p.stat().st_size for p in OUT.glob('*.jpg'))
    print(f'{len(entries)} photos, {total / 1e6:.1f} MB total')


if __name__ == '__main__':
    main()
