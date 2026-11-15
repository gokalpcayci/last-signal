#!/usr/bin/env python3
"""Fetch real heliocentric paths for the Deep Space hardware from JPL Horizons.

Writes public/deepspace/paths.json:
  { "epoch": "YYYY-MM-DD",
    "objects": { id: { "pts": [[x, y, z], ...], "t0": "YYYY-MM-DD", "step": days,
                       "now": [x, y, z], "au": r } } }
x/y/z are AU in the ecliptic J2000 frame, Sun at the origin (x → vernal equinox,
z → ecliptic north). One sample every STEP days from shortly after launch to
EPOCH, so the scene can draw the trail and the timeline can scrub along it.

Craft that ended up at a body (NEAR on Eros, Dawn around Ceres) switch to that
body's ephemeris after arrival, so their path keeps going to today.

Usage: python3 -I scripts/build_deepspace.py [YYYY-MM-DD]
"""
import json
import math
import re
import sys
import urllib.parse
import subprocess
from datetime import date, datetime, timedelta
from pathlib import Path

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
STEP = 30  # days between samples
OUT = Path(__file__).resolve().parent.parent / "public" / "deepspace" / "paths.json"

# id → list of (Horizons COMMAND, start, stop or None = epoch)
SEGMENTS = {
    "pioneer-10":   [("-23", "1972-03-10", None)],
    "pioneer-11":   [("-24", "1973-04-12", None)],
    "voyager-2":    [("-32", "1977-08-25", None)],
    "voyager-1":    [("-31", "1977-09-10", None)],
    "ulysses":      [("-55", "1990-10-12", None)],
    "near":         [("-93", "1996-02-24", "2001-02-12"), ("433;", "2001-02-12", None)],
    "stardust":     [("-29", "1999-02-14", None)],
    "spitzer":      [("-79", "2003-09-01", None)],
    "deep-impact":  [("-140", "2005-01-19", None)],
    "new-horizons": [("-98", "2006-01-26", None)],
    "dawn":         [("-203", "2007-10-04", "2015-03-06"), ("1;", "2015-03-06", None)],
    "kepler":       [("-227", "2009-03-14", None)],
}

# Planet orbits for the map (one full orbit each, sampled finely)
PLANETS = {
    "mercury": ("199", 88), "venus": ("299", 225), "earth": ("399", 365),
    "mars": ("499", 687), "jupiter": ("599", 4333), "saturn": ("699", 10759),
    "uranus": ("799", 30687), "neptune": ("899", 60190),
}


class EphemerisEnds(Exception):
    pass


def horizons(command: str, start: str, stop: str, step: str) -> list[list[float]]:
    params = {
        "format": "text", "COMMAND": f"'{command}'", "EPHEM_TYPE": "VECTORS",
        "CENTER": "'500@10'", "REF_PLANE": "ECLIPTIC", "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'", "STEP_SIZE": f"'{step}'", "VEC_TABLE": "1",
        "OUT_UNITS": "'AU-D'", "CSV_FORMAT": "YES", "OBJ_DATA": "NO",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    # curl, not urllib: python.org builds on macOS often lack a CA bundle
    text = subprocess.run(["curl", "-sS", "--max-time", "90", url],
                          check=True, capture_output=True, text=True).stdout
    if "$$SOE" not in text:
        # Dead craft: JPL stops predicting after the mission. Clip to the last day it covers.
        m = re.search(r"No ephemeris for target .* after A\.D\. (\d{4}-[A-Z]{3}-\d{2})", text)
        if m:
            end = datetime.strptime(m.group(1).title(), "%Y-%b-%d").date() - timedelta(days=1)
            raise EphemerisEnds(end.isoformat())
        raise RuntimeError(f"{command} {start}→{stop}: " + text[-600:])
    body = text.split("$$SOE")[1].split("$$EOE")[0]
    pts = []
    for line in body.strip().splitlines():
        f = [c.strip() for c in line.split(",")]
        pts.append([round(float(f[2]), 4), round(float(f[3]), 4), round(float(f[4]), 4)])
    return pts


def main() -> None:
    epoch = sys.argv[1] if len(sys.argv) > 1 else date.today().isoformat()
    out = {"epoch": epoch, "step": STEP, "objects": {}, "planets": {}}
    for oid, segs in SEGMENTS.items():
        pts: list[list[float]] = []
        for cmd, start, stop in segs:
            stop = stop or epoch
            try:
                seg = horizons(cmd, start, stop, f"{STEP}d")
            except EphemerisEnds as e:
                stop = str(e)
                seg = horizons(cmd, start, stop, f"{STEP}d")
            # segment boundaries share a day: drop the duplicate
            pts.extend(seg if not pts else seg[1:])
        # exact position on the last covered day (today, or where JPL's prediction ends)
        last_cmd = segs[-1][0]
        now = horizons(last_cmd, stop, (date.fromisoformat(stop) + timedelta(days=1)).isoformat(), "1d")[0]
        r = math.sqrt(sum(c * c for c in now))
        out["objects"][oid] = {"t0": segs[0][1], "known": stop, "pts": pts, "now": now, "au": round(r, 2)}
        print(f"{oid:13s} {len(pts):4d} pts  {stop}  {r:7.2f} AU")
    for name, (cmd, period) in PLANETS.items():
        step = max(1, round(period / 180))
        stop = (date.fromisoformat(epoch) + timedelta(days=period)).isoformat()
        out["planets"][name] = horizons(cmd, epoch, stop, f"{step}d")
        print(f"{name:13s} {len(out['planets'][name]):4d} pts")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
