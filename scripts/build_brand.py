"""Generate the Last Signal brand SVGs.

Run: python3 scripts/build_brand.py
  → public/brand/{mark,mark-black,app-icon,lockup}.svg and public/favicon.svg

The mark is a mirror-symmetric inkblot: overlapping ellipses melted together with a
smooth union of signed-distance fields, then traced into one vector path. Edit the
ellipse lists below (left half only; it's mirrored) and re-run.
"""
from pathlib import Path

import numpy as np
from contourpy import contour_generator

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "brand"

INK = "#e6e6df"   # --text
BG = "#0d0e0d"    # --bg
OK = "#5fd068"    # --ok
WARN = "#e56b47"  # --warn

# --- inkblot geometry: (cx, cy, rx, ry, rotation°) in an 828 × 540 design space ---
W, H = 828, 540
MID = W / 2
LEFT = [
    (172, 172, 116, 70, 22),   # big upper wing
    (258, 110, 68, 34, 16),    # top ear
    (285, 262, 44, 36, 35),    # neck
    (338, 305, 30, 15, 18),    # nub pointing inward
    (160, 340, 78, 38, 6),     # lower wing
    (230, 336, 30, 10, -6),    # bridge: lower wing → hip
    (282, 328, 52, 34, 15),    # hip
    (322, 383, 34, 20, 0),     # lower link
    (364, 377, 22, 11, -8),    # small nub
    (288, 414, 57, 20, 4),     # foot
]
CENTER = [
    (414, 195, 62, 76, 0),     # head / egg
    (414, 410, 34, 9, 0),      # small dash
    (414, 462, 56, 11, 0),     # base dash
]
SMOOTH = 6.0    # smooth-union radius in design px: how much neighbouring blobs melt
RES = 2         # field samples per design px


def ellipse_sdf(x, y, cx, cy, rx, ry, rot):
    """Approximate signed distance to a rotated ellipse (negative inside)."""
    a = np.radians(rot)
    dx, dy = x - cx, y - cy
    u = dx * np.cos(a) + dy * np.sin(a)
    v = -dx * np.sin(a) + dy * np.cos(a)
    k = np.hypot(u / rx, v / ry)
    return (k - 1) * min(rx, ry)


def smooth_min(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


SHAPES = LEFT + [(2 * MID - cx, cy, rx, ry, -r) for cx, cy, rx, ry, r in LEFT] + CENTER


def field(x, y):
    """Signed distance to the inkblot outline (negative inside) at points x, y."""
    f = np.full(np.shape(x), 1e9)
    for s in SHAPES:
        f = smooth_min(f, ellipse_sdf(x, y, *s), SMOOTH)
    return f


def trace_inkblot(level: float = 0.0) -> str:
    """Vector path of the iso-line field == level (0 = the outline, <0 = inset)."""
    xs = np.linspace(0, W, W * RES + 1)
    ys = np.linspace(0, H, H * RES + 1)
    x, y = np.meshgrid(xs, ys)
    lines = contour_generator(xs, ys, field(x, y)).lines(level)
    d = []
    for line in lines:
        step = 10 if len(line) > 120 else max(1, len(line) // 12)   # ~5 design px per curve segment
        pts = line[::step]
        d.append(_smooth_closed(pts))
    return " ".join(d)


def _smooth_closed(pts: np.ndarray) -> str:
    """Closed Catmull-Rom spline through pts → cubic Bézier path."""
    p = pts[:-1] if np.allclose(pts[0], pts[-1]) else pts
    n = len(p)
    f = lambda q: f"{q[0]:.1f},{q[1]:.1f}"
    d = f"M {f(p[0])}"
    for i in range(n):
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
        d += f" C {f(p1 + (p2 - p0) / 6)} {f(p2 - (p3 - p1) / 6)} {f(p2)}"
    return d + " Z"


BLOT = trace_inkblot()
# Bounds of the blot in design space (for framing): x 40..788, y 74..474
VB = "30 40 768 460"   # tight-ish box around the blot, centred on x = 414


def blot(fill: str, finish: str = "") -> str:
    attr = f' filter="url(#{finish})"' if finish else ""
    return f'<path fill="{fill}"{attr} d="{BLOT}"/>'


# --- finish: shading + ink-pooled edges + film grain, clipped to the shape ------
# tone: (gradient top, gradient bottom, edge colour, grain strength)
TONES = {
    "light": ("#ffffff", "#7f817a", "#6a6c66", 0.36),
    "dark":  ("#3a3c39", "#000000", "#000000", 0.32),
}


def finish_defs(tone: str) -> str:
    top, bottom, edge, grain = TONES[tone]
    return f"""
    <linearGradient id="shade-{tone}" gradientUnits="userSpaceOnUse" x1="414" y1="70" x2="414" y2="480">
      <stop offset="0" stop-color="{top}"/><stop offset=".42" stop-color="{top}" stop-opacity=".0"/>
      <stop offset=".6" stop-color="{bottom}" stop-opacity=".0"/>
      <stop offset="1" stop-color="{bottom}"/>
    </linearGradient>
    <radialGradient id="glow-{tone}" gradientUnits="userSpaceOnUse" cx="414" cy="150" r="420">
      <stop offset="0" stop-color="#ffffff" stop-opacity="{.35 if tone == 'light' else .12}"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="ink-{tone}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <!-- ink pooled at the edges: a band just inside the outline -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="soft"/>
      <feComposite in="SourceAlpha" in2="soft" operator="arithmetic" k2="1" k3="-1" result="rim"/>
      <feFlood flood-color="{edge}" result="edgeCol"/>
      <feComposite in="edgeCol" in2="rim" operator="in" result="edgeBand"/>
      <feMerge result="inked"><feMergeNode in="SourceGraphic"/><feMergeNode in="edgeBand"/></feMerge>
      <!-- film grain: brightness modulated by fractal noise -->
      <feTurbulence type="fractalNoise" baseFrequency=".42" numOctaves="2" seed="7" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
      <feComposite in="inked" in2="mono" operator="arithmetic"
                   k1="{grain}" k2="{1 - grain / 2:.3f}" k3="0" k4="0" result="grained"/>
      <feComposite in="grained" in2="SourceAlpha" operator="in"/>
    </filter>"""


def textured(tone: str) -> str:
    """Base fill + shading layers, with the ink filter applied to the whole stack."""
    base = INK if tone == "light" else BG
    return (
        f'<g filter="url(#ink-{tone})">'
        f'<defs><path id="blot-{tone}" d="{BLOT}"/></defs>'
        f'<use href="#blot-{tone}" fill="{base}"/>'
        f'<use href="#blot-{tone}" fill="url(#shade-{tone})"/>'
        f'<use href="#blot-{tone}" fill="url(#glow-{tone})"/>'
        f"</g>"
    )


def mark(tone: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB}">
  <title>Last Signal</title>
  <defs>{finish_defs(tone)}
  </defs>
  {textured(tone)}
</svg>
"""


def mark_flat(fill: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB}">
  <title>Last Signal</title>
  {blot(fill)}
</svg>
"""


def placed(size: float, cx: float, cy: float, inner: str) -> str:
    """Content in blot design space, scaled so the blot width = size, centred on (cx, cy)."""
    s = size / 768
    return f'<g transform="translate({cx} {cy}) scale({s:.4f}) translate(-414 -270)">{inner}</g>'


def app_icon() -> str:
    """Square, transparent: the textured mark alone (no tile)."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <title>Last Signal</title>
  <defs>{finish_defs("light")}
  </defs>
  {placed(960, 512, 512, textured("light"))}
</svg>
"""


def favicon() -> str:
    """No tile: flat mark, dark ink on light browser chrome, light ink in dark mode."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>Last Signal</title>
  <style>path {{ fill: {BG}; }} @media (prefers-color-scheme: dark) {{ path {{ fill: {INK}; }} }}</style>
  {placed(64, 32, 32, f'<path d="{BLOT}"/>')}
</svg>
"""


def lockup() -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 300">
  <title>Last Signal</title>
  <defs>{finish_defs("light")}
  </defs>
  {placed(300, 170, 150, textured("light"))}
  <text x="360" y="168" fill="{INK}" font-family="Inter, system-ui, sans-serif" font-weight="600"
        font-size="100" letter-spacing="10">LAST SIGNAL</text>
  <text x="364" y="220" fill="#6e706a" font-family="'JetBrains Mono', ui-monospace, monospace"
        font-size="25" letter-spacing="7">ABANDONED · NOT FORGOTTEN</text>
</svg>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        OUT / "mark.svg": mark("light"),
        OUT / "mark-black.svg": mark("dark"),
        OUT / "mark-flat.svg": mark_flat(INK),
        OUT / "mark-flat-black.svg": mark_flat(BG),
        OUT / "app-icon.svg": app_icon(),
        OUT / "lockup.svg": lockup(),
        ROOT / "public" / "favicon.svg": favicon(),
    }
    for path, svg in files.items():
        path.write_text(svg)
        print("wrote", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
