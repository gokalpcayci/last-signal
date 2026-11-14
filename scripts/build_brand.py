"""Generate Lostronomy brand SVGs from one arm.

Run: python3 scripts/build_brand.py  → writes public/brand/*.svg and public/favicon.svg
The mark (traced from the hand sketch): four spiral bands chasing each other around
an open centre. Each band has a blunt flag-cut tail on the outside and spirals
clockwise inward to a forked, beaked head with a lens-shaped eye.
"""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "brand"

# --- arm geometry (in a -256..256 box). t: 0 = tail, 1 = head -------------
T0, SWEEP = 214.0, 132.0   # start angle (math deg, y-up) and clockwise sweep
R0, R1 = 218.0, 109.0      # tail radius -> head radius


def _theta(t: float) -> float:
    return math.radians(T0 - SWEEP * t)


def _radius(t: float) -> float:
    return R0 - (R0 - R1) * max(t, 0) ** 1.5   # stays round, then curls in


def _width(t: float) -> float:
    t = max(t, 0)
    if t < 0.14:
        return 58 - 125 * t                                   # flared tail
    if t < 0.6:
        return 40.5 - 4 * (t - 0.14)                          # body
    return 38.7 + 20 * math.sin(min(1, (t - 0.6) / 0.32) * math.pi / 2)  # head


def _pt(t: float, k: float) -> tuple[float, float]:
    """Point on the band; k = offset in half-widths (+1 outer edge, -1 inner)."""
    r = _radius(t) + k * _width(min(t, 1)) / 2
    th = _theta(t)
    return (r * math.cos(th), -r * math.sin(th))


def _f(p: tuple[float, float]) -> str:
    return f"{p[0]:.1f},{p[1]:.1f}"


def _smooth(pts: list[tuple[float, float]]) -> str:
    """Catmull-Rom through pts, as cubic Béziers (path already at pts[0])."""
    d = ""
    for i in range(len(pts) - 1):
        p0, p1, p2 = pts[max(i - 1, 0)], pts[i], pts[i + 1]
        p3 = pts[min(i + 2, len(pts) - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C {_f(c1)} {_f(c2)} {_f(p2)}"
    return d


def build_arm() -> str:
    n = 30
    outer = [_pt(-0.05 + 1.03 * i / n, 1) for i in range(n + 1)]
    inner = [_pt(0.95 - 0.95 * i / n, -1) for i in range(n + 1)]
    d = f"M {_f(outer[0])}" + _smooth(outer)
    d += f" Q {_f(_pt(1.06, 0.9))} {_f(_pt(1.15, 0.35))}"    # upper prong (beak)
    d += f" Q {_f(_pt(1.04, 0.1))} {_f(_pt(0.97, -0.05))}"   # into the mouth
    d += f" L {_f(_pt(1.05, -0.55))}"                         # lower prong
    d += f" Q {_f(_pt(1.0, -1.05))} {_f(inner[0])}"           # under the jaw
    d += _smooth(inner)
    # angled, kinked flag-cut tail
    d += f" L {_f(_pt(0.0, -1.0))} L {_f(_pt(-0.035, -0.15))} L {_f(_pt(-0.075, 1.18))} Z"
    # lens eye, aligned to the band's tangent (cut out via evenodd)
    te, ke, half_len, bulge = 0.86, 0.28, 23, 15
    ex, ey = _pt(te, ke)
    a, b = _pt(te - 0.01, ke), _pt(te + 0.01, ke)
    tx, ty = b[0] - a[0], b[1] - a[1]
    m = math.hypot(tx, ty)
    ux, uy = tx / m, ty / m
    vx, vy = -uy, ux
    p1 = (ex - ux * half_len, ey - uy * half_len)
    p2 = (ex + ux * half_len, ey + uy * half_len)
    d += (f" M {_f(p1)} Q {_f((ex + vx * bulge, ey + vy * bulge))} {_f(p2)}"
          f" Q {_f((ex - vx * bulge, ey - vy * bulge))} {_f(p1)} Z")
    return d


ARM = build_arm()

INK = "#e6e6df"   # --text
BG = "#0d0e0d"    # --bg
OK = "#5fd068"    # --ok  (active hardware)
WARN = "#e56b47"  # --warn (silent hardware)


def uses(extra: str = "") -> str:
    return "".join(
        f'<use href="#arm"{extra} transform="rotate({a})"/>' for a in (0, 90, 180, 270)
    )


def arm_def() -> str:
    return f'<path id="arm" fill-rule="evenodd" d="{ARM}"/>'


CHROME_DEFS = """
    <linearGradient id="chrome" gradientUnits="userSpaceOnUse" x1="-210" y1="-240" x2="190" y2="250">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".20" stop-color="#e4e5e0"/>
      <stop offset=".38" stop-color="#a3a6a0"/>
      <stop offset=".49" stop-color="#fbfbf8"/>
      <stop offset=".60" stop-color="#b4b7b0"/>
      <stop offset=".80" stop-color="#686b66"/>
      <stop offset="1" stop-color="#d2d4ce"/>
    </linearGradient>
    <filter id="bevel" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
      <feSpecularLighting in="blur" surfaceScale="5" specularConstant="1" specularExponent="24"
                          lighting-color="#ffffff" result="spec">
        <fePointLight x="-260" y="-420" z="360"/>
      </feSpecularLighting>
      <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
      <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
    </filter>
    <filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
      <feOffset dy="18"/>
      <feComponentTransfer><feFuncA type="linear" slope=".75"/></feComponentTransfer>
    </filter>"""


def chrome_mark() -> str:
    """Chrome-finished mark centred on 0,0 (expects CHROME_DEFS in scope)."""
    return (
        f'<g filter="url(#drop)">{uses()}</g>'
        f'<g fill="url(#chrome)" filter="url(#bevel)">{uses()}</g>'
    )


def mark(fill: str = INK) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="-256 -256 512 512">
  <title>Lostronomy</title>
  <defs>{arm_def()}</defs>
  <g fill="{fill}">{uses()}</g>
</svg>
"""


def app_icon() -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <title>Lostronomy</title>
  <defs>
    {arm_def()}
    <radialGradient id="bg" cx="36%" cy="24%" r="90%">
      <stop offset="0" stop-color="#2b2d2a"/><stop offset=".55" stop-color="#141514"/><stop offset="1" stop-color="#060706"/>
    </radialGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset=".5" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity=".09"/>
    </linearGradient>
    <radialGradient id="halo" cx="0" cy="0" r="290" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{INK}" stop-opacity=".12"/><stop offset="1" stop-color="{INK}" stop-opacity="0"/>
    </radialGradient>{CHROME_DEFS}
  </defs>
  <rect width="1024" height="1024" rx="228" fill="url(#bg)"/>
  <rect width="1024" height="1024" rx="228" fill="url(#gloss)"/>
  <rect x="3" y="3" width="1018" height="1018" rx="225" fill="none" stroke="url(#rim)" stroke-width="6"/>
  <g transform="translate(512 512) scale(1.5)">
    <circle r="290" fill="url(#halo)"/>
    {chrome_mark()}
  </g>
</svg>
"""


def favicon() -> str:
    """Small sizes: flat ink mark on a dark rounded tile (filters blur at 16px)."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>Lostronomy</title>
  <defs>{arm_def()}</defs>
  <rect width="64" height="64" rx="14" fill="{BG}"/>
  <g transform="translate(32 32) scale(.112)" fill="{INK}">{uses()}</g>
</svg>
"""


def lockup() -> str:
    """Horizontal lockup: chrome mark + LOSTRONOMY wordmark + mono descriptor."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300">
  <title>Lostronomy</title>
  <defs>{arm_def()}{CHROME_DEFS}
    <linearGradient id="type" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="{INK}"/><stop offset="1" stop-color="#9a9c96"/>
    </linearGradient>
  </defs>
  <g transform="translate(150 150) scale(.5)">{chrome_mark()}</g>
  <text x="300" y="168" fill="url(#type)" font-family="Inter, system-ui, sans-serif" font-weight="600"
        font-size="104" letter-spacing="10">LOSTRONOMY</text>
  <text x="304" y="222" fill="#6e706a" font-family="'JetBrains Mono', ui-monospace, monospace"
        font-size="26" letter-spacing="7">ABANDONED · NOT FORGOTTEN</text>
  <circle cx="1132" cy="120" r="7" fill="{OK}"/>
  <circle cx="1158" cy="120" r="7" fill="{WARN}"/>
</svg>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        OUT / "mark.svg": mark(INK),
        OUT / "mark-black.svg": mark("#0d0e0d"),
        OUT / "app-icon.svg": app_icon(),
        OUT / "lockup.svg": lockup(),
        ROOT / "public" / "favicon.svg": favicon(),
    }
    for path, svg in files.items():
        path.write_text(svg)
        print("wrote", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
