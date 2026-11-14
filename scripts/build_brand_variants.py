"""Texture variations of the Lostronomy inkblot mark.

Run: python3 scripts/build_brand_variants.py  → public/brand/variants/*.svg
Every variant fills the same traced shape (BLOT) from build_brand.py; the
procedural ones (halftone, stipple, LED, topo) sample its signed-distance
field so the texture responds to how deep inside the blot a point is.
"""
import json
import math

import numpy as np

from build_brand import BG, BLOT, INK, ROOT, VB, field, finish_defs, textured, trace_inkblot

OUT = ROOT / "public" / "brand" / "variants"
GOLD = "#c9a95a"   # --gold
DUST = "#6e706a"   # --dim
MAX_DEPTH = 70.0   # deepest point inside the blot (design px)
X0, Y0, VW, VH = (float(v) for v in VB.split())


def svg(title: str, defs: str, body: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB}">
  <title>Lostronomy · {title}</title>
  <defs>
    <clipPath id="blot"><path d="{BLOT}"/></clipPath>{defs}
  </defs>
  {body}
</svg>
"""


def depth(x, y):
    """0 at the outline → 1 at the deepest point (clipped)."""
    return np.clip(-field(x, y) / MAX_DEPTH, 0, 1)


def lattice(step: float, angle: float):
    """Points of a square grid rotated by angle, covering the viewBox."""
    a = math.radians(angle)
    cx, cy = X0 + VW / 2, Y0 + VH / 2
    r = math.hypot(VW, VH) / 2
    n = np.arange(-r, r + step, step)
    u, v = np.meshgrid(n, n)
    x = cx + u * math.cos(a) - v * math.sin(a)
    y = cy + u * math.sin(a) + v * math.cos(a)
    keep = (x > X0) & (x < X0 + VW) & (y > Y0) & (y < Y0 + VH)
    return x[keep], y[keep]


# 1 · printed ink (the primary finish) ---------------------------------------
def v_ink() -> str:
    return svg("printed ink", finish_defs("light"), textured("light"))


# 2 · halftone: 45° dot screen, dots grow toward the centre of each lobe -------
def v_halftone() -> str:
    x, y = lattice(9.0, 45)
    d = depth(x, y)
    keep = field(x, y) < 2
    dots = "".join(
        f'<circle cx="{a:.1f}" cy="{b:.1f}" r="{1.3 + 3.6 * t ** 0.6:.2f}"/>'
        for a, b, t in zip(x[keep], y[keep], d[keep])
    )
    return svg("halftone", "", f'<g fill="{INK}" clip-path="url(#blot)">{dots}</g>')


# 3 · topographic: iso-depth contour lines, like the terrain DEM --------------
def v_topo() -> str:
    rings = []
    for i, lvl in enumerate(range(0, -66, -7)):
        path = trace_inkblot(float(lvl))
        if not path:
            continue
        w = 3.2 if i == 0 else 1.6
        op = 1 if i == 0 else 0.85 - i * 0.05
        rings.append(f'<path d="{path}" fill="none" stroke="{INK}" stroke-width="{w}" stroke-opacity="{op:.2f}"/>')
    return svg("topographic", "", "".join(rings))


# 4 · engraved: banknote-style horizontal rules, thinner toward the bottom ----
def v_engraved() -> str:
    defs = f"""
    <linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="70" x2="0" y2="480">
      <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".45"/>
    </linearGradient>
    <mask id="m"><rect x="{X0}" y="{Y0}" width="{VW}" height="{VH}" fill="url(#fade)"/></mask>"""
    rules = []
    yy = Y0
    while yy < Y0 + VH:
        t = (yy - 70) / 410                       # 0 top → 1 bottom
        rules.append(f'<rect x="{X0}" y="{yy:.1f}" width="{VW}" height="{3.4 - 1.8 * max(0, min(1, t)):.2f}"/>')
        yy += 7
    body = (f'<g fill="{INK}" clip-path="url(#blot)" mask="url(#m)">{"".join(rules)}</g>'
            f'<path d="{BLOT}" fill="none" stroke="{INK}" stroke-width="2.4"/>')
    return svg("engraved", defs, body)


# 5 · regolith: bumpy lunar-rock surface lit from the top-left -----------------
def v_regolith() -> str:
    defs = """
    <filter id="rock" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="5" seed="11" result="n"/>
      <feDiffuseLighting in="n" surfaceScale="4.5" diffuseConstant="1.15" lighting-color="#e6e6df" result="lit">
        <feDistantLight azimuth="225" elevation="48"/>
      </feDiffuseLighting>
      <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="soft"/>
      <feComposite in="SourceAlpha" in2="soft" operator="arithmetic" k2="1" k3="-1" result="rim"/>
      <feFlood flood-color="#000" flood-opacity=".55"/><feComposite in2="rim" operator="in" result="shadow"/>
      <feMerge result="m"><feMergeNode in="lit"/><feMergeNode in="shadow"/></feMerge>
      <feComposite in="m" in2="SourceAlpha" operator="in"/>
    </filter>"""
    return svg("regolith", defs, f'<path d="{BLOT}" fill="#fff" filter="url(#rock)"/>')


# 6 · risograph: gold under-print knocked off-register, grainy ink on top -----
def v_riso() -> str:
    defs = f"""
    <filter id="riso" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".22" numOctaves="3" seed="4" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.55" result="holes"/>
      <feComposite in="SourceGraphic" in2="holes" operator="in"/>
    </filter>"""
    body = (f'<path d="{BLOT}" fill="{GOLD}" transform="translate(16 11)" filter="url(#riso)"/>'
            f'<path d="{BLOT}" fill="{INK}" fill-opacity=".92" filter="url(#riso)"/>')
    return svg("risograph", defs, body)


# 7 · stipple: random pen dots, dense in the middle, sparse at the edges -------
def v_stipple() -> str:
    rng = np.random.default_rng(7)
    n = 70000
    x = rng.uniform(X0, X0 + VW, n)
    y = rng.uniform(Y0, Y0 + VH, n)
    f = field(x, y)
    d = np.clip(-f / MAX_DEPTH, 0, 1)
    keep = (f < 0) & (rng.uniform(0, 1, n) < 0.10 + 0.55 * d ** 0.8)
    dots = "".join(f'<circle cx="{a:.1f}" cy="{b:.1f}" r="1.35"/>' for a, b in zip(x[keep], y[keep]))
    return svg("stipple", "", f'<g fill="{INK}">{dots}</g>')


# 8 · LED matrix: mission-control pixel display, brightness by depth ----------
def v_led() -> str:
    step = 11.0
    xs = np.arange(X0 + step / 2, X0 + VW, step)
    ys = np.arange(Y0 + step / 2, Y0 + VH, step)
    x, y = np.meshgrid(xs, ys)
    x, y = x.ravel(), y.ravel()
    f = field(x, y)
    keep = f < 1.5
    d = np.clip(-f / MAX_DEPTH, 0, 1)
    cells = "".join(
        f'<rect x="{a - 4.2:.1f}" y="{b - 4.2:.1f}" width="8.4" height="8.4" rx="1.6" fill-opacity="{0.6 + 0.4 * t ** 0.5:.2f}"/>'
        for a, b, t in zip(x[keep], y[keep], d[keep])
    )
    return svg("led matrix", "", f'<g fill="{INK}">{cells}</g>')


def led_cells(step: float) -> dict:
    """LED grid for the animated logo: cell centres (design px) + depth 0..100."""
    xs = np.arange(X0 + step / 2, X0 + VW, step)
    ys = np.arange(Y0 + step / 2, Y0 + VH, step)
    x, y = np.meshgrid(xs, ys)
    x, y = x.ravel(), y.ravel()
    f = field(x, y)
    keep = f < step * 0.14
    d = np.clip(-f / MAX_DEPTH, 0, 1)
    flat = []
    for a, b, t in zip(x[keep], y[keep], d[keep]):
        flat += [round(float(a), 1), round(float(b), 1), int(round(float(t) * 100))]
    return {"step": step, "viewBox": [X0, Y0, VW, VH], "center": [414, 195], "cells": flat}


VARIANTS = {
    "ink": v_ink, "halftone": v_halftone, "topo": v_topo, "engraved": v_engraved,
    "regolith": v_regolith, "riso": v_riso, "stipple": v_stipple, "led": v_led,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in VARIANTS.items():
        path = OUT / f"mark-{name}.svg"
        path.write_text(fn())
        print(f"wrote {path.relative_to(ROOT)}  ({path.stat().st_size // 1024} KB)")
    data = {"fine": led_cells(11.0), "coarse": led_cells(16.0)}
    out = ROOT / "src" / "brand" / "ledCells.ts"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        "// Generated by scripts/build_brand_variants.py — do not edit by hand.\n"
        "// cells: flat [x, y, depth0to100, ...] in the mark's design space.\n"
        "export interface LedGrid { step: number; viewBox: number[]; center: number[]; cells: number[] }\n"
        f"export const LED_GRIDS: Record<'fine' | 'coarse', LedGrid> = {json.dumps(data, separators=(',', ':'))}\n"
    )
    print(f"wrote {out.relative_to(ROOT)}  ({out.stat().st_size // 1024} KB, "
          f"{len(data['fine']['cells']) // 3} + {len(data['coarse']['cells']) // 3} cells)")


if __name__ == "__main__":
    main()
