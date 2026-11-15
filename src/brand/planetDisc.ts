import type { LedGrid } from './ledCells'
import { subsolarLon } from '../scene/sun'
import type { PlanetId } from '../scene/planets'

/**
 * LED planet discs for the planet switch. Each disc is the real surface, sampled from the albedo
 * maps the terrain already ships (LRO for the Moon, MGS TES for Mars), ordered-dithered into lit /
 * unlit LEDs like a halftone print, and lit by the real Sun right now (src/scene/sun.ts): the
 * day side prints bright, the night side dim (still readable, like earthshine).
 *  Moon: the near side (what we see from Earth), so the terminator is tonight's real phase.
 *  Mars: the hemisphere around Jezero / Syrtis Major, so you see whether it's day there right now.
 * Sub-solar latitude is ignored (±1.5° Moon, up to ±25° Mars by season): the line is approximate.
 */

export const DISC = 26          // LEDs across
const STEP = 16                 // design units per LED (same as the logo's coarse grid)

/** View centre (east longitude) and albedo grid per body (same grids as the DEMs). */
const VIEW: Record<PlanetId, {
  lon0: number; src: string; w: number; h: number; ppd: number
  lonCenter: number; lonMin: number; latMax: number
}> = {
  moon: { lon0: 0, src: 'terrain/moon_albedo.png', w: 752, h: 592, ppd: 4, lonCenter: 0, lonMin: -94, latMax: 74 },
  mars: { lon0: 70, src: 'terrain/mars_albedo.png', w: 752, h: 352, ppd: 2, lonCenter: -145, lonMin: -188, latMax: 88 },
}

/** Disc-shaped LED grid; depth = limb shading (bright centre, dimmer rim), so it reads as a sphere. */
export function discGrid(n = DISC): LedGrid {
  const cells: number[] = []
  const R = n / 2
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5 - R) / R, v = (y + 0.5 - R) / R
    const r2 = u * u + v * v
    if (r2 > 1) continue
    cells.push((x + 0.5) * STEP, (y + 0.5) * STEP, Math.round(100 * Math.sqrt(1 - r2)))
  }
  return { step: STEP, viewBox: [0, 0, n * STEP, n * STEP], center: [R * STEP, R * STEP], cells }
}

const albedoCache = new Map<PlanetId, Promise<Uint8ClampedArray>>()
function loadAlbedo(id: PlanetId) {
  let p = albedoCache.get(id)
  if (!p) {
    const v = VIEW[id]
    p = (async () => {
      const img = new Image()
      img.src = `${import.meta.env.BASE_URL}${v.src}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = v.w; c.height = v.h
      const g = c.getContext('2d', { willReadFrequently: true })
      if (!g) throw new Error('2D canvas unavailable for albedo decoding')
      g.drawImage(img, 0, 0)
      return g.getImageData(0, 0, v.w, v.h).data
    })()
    albedoCache.set(id, p)
  }
  return p
}

// 4×4 Bayer matrix: the classic ordered-dither (halftone-like) pattern
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((b) => (b + 0.5) / 16)
/** brightness of the night side (day = 1): readable, but clearly the dark half */
const NIGHT = 0.5
const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** Mask (one value per cell of `discGrid(n)`: 1 = day, NIGHT = night side, 0 = ghost) for the body as it looks now. */
export async function planetMask(id: PlanetId, date = new Date(), n = DISC): Promise<Float32Array> {
  const px = await loadAlbedo(id)
  const v = VIEW[id]
  const r = Math.PI / 180
  const sun = wrap180(subsolarLon(date, id) - v.lon0) * r // sun longitude relative to the view centre
  const sunV = [Math.sin(sun), 0, Math.cos(sun)]
  const R = n / 2
  const alb: number[] = [], light: number[] = [], bayer: number[] = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5 - R) / R, w = (R - y - 0.5) / R
    const r2 = u * u + w * w
    if (r2 > 1) continue
    const z = Math.sqrt(1 - r2)
    const lat = Math.asin(w) / r
    const lon = v.lon0 + Math.atan2(u, z) / r
    const col = Math.min(v.w - 1, Math.max(0, Math.floor((wrap180(lon - v.lonCenter) - v.lonMin) * v.ppd)))
    const row = Math.min(v.h - 1, Math.max(0, Math.floor((v.latMax - lat) * v.ppd)))
    alb.push(px[(row * v.w + col) * 4] / 255)
    light.push(u * sunV[0] + z * sunV[2]) // cos(sun angle) on the surface normal
    bayer.push(BAYER[(y % 4) * 4 + (x % 4)])
  }
  // stretch each body's albedo between its 8th and 92nd percentile so maria / dark plains pop
  const sorted = [...alb].sort((a, b) => a - b)
  const lo = sorted[Math.floor(sorted.length * 0.08)], hi = sorted[Math.floor(sorted.length * 0.92)]
  return Float32Array.from(alb, (a, i) => {
    // S-curve: bright ground prints solid, dark plains thin out to sparse dots (like the reference prints)
    const tone = 0.05 + 0.95 * smooth(0.12, 0.78, (a - lo) / (hi - lo || 1))
    const day = smooth(-0.06, 0.2, light[i]) // soft terminator
    // the surface pattern is always printed (so the button stays recognisable); night side runs dim
    return tone > bayer[i] ? NIGHT + (1 - NIGHT) * day : 0
  })
}

/**
 * Deep Space button: no surface to print, so the disc shows a tiny solar system instead — the Sun
 * in the middle, two orbits as dotted rings, and one probe out past the edge of the outer one.
 * Same cell order as `discGrid(n)`.
 */
export function deepMask(n = DISC): Float32Array {
  const out: number[] = []
  const R = n / 2
  const probe = { u: 0.62, v: -0.62 } // top right
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5 - R) / R, v = (y + 0.5 - R) / R
    const r2 = u * u + v * v
    if (r2 > 1) continue
    const r = Math.sqrt(r2), a = Math.atan2(v, u)
    let m = 0
    if (r < 0.17) m = 1                                                    // Sun
    else if (Math.abs(r - 0.42) < 0.05 && Math.sin(a * 9) > -0.2) m = NIGHT // inner orbit, dotted
    else if (Math.abs(r - 0.74) < 0.05 && Math.sin(a * 15) > -0.2) m = NIGHT // outer orbit, dotted
    if (Math.hypot(u - probe.u, v - probe.v) < 0.12) m = 1                  // the probe
    out.push(m)
  }
  return Float32Array.from(out)
}
