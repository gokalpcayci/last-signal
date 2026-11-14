/**
 * Per-body settings for the terrain diorama. Everything that used to be a Moon
 * constant in terrain.ts / MoonScene.tsx lives here, so the same scene can show
 * the Moon (near side) or the whole of Mars.
 *
 * World units: x = east, z = south. The terrain mesh (WORLD in terrain.ts) is the
 * same for every body; only the plateau size and degrees→units mapping change.
 */
export type PlanetId = 'moon' | 'mars'

type V3 = readonly [number, number, number]
interface View { pos: V3; target: V3 }

export interface Planet {
  id: PlanetId
  /** "the Moon" / "Mars" — reads naturally in sentences */
  name: string
  /** Short UI label */
  label: string
  radiusKm: number
  /** public/ path prefix: `${dem}_dem.{bin,json}` */
  dem: string
  /** Surface brightness map on the same grid as the DEM, or null (flat shading) */
  albedo: string | null
  /** Longitude shown at x = 0 (the map's center), degrees east */
  lonCenter: number
  xPerDeg: number
  zPerDeg: number
  /** Plateau half-size in world units */
  mesa: { hx: number; hz: number; radius: number }
  /** Width of the rim fade (world units); sites must sit inside its start */
  edgeFade: number
  /** Radius of the visual planet curve, world units */
  curveR: number
  /** Exaggerated vertical scale (world units per km) */
  unitsPerKm: number
  /** Contour spacing in km (major line every 5) */
  contourKm: number
  /** Elevation ramp by rank: muted, never the markers' status green/orange */
  ramp: [number, string][]
  rust: string
  cliff: string
  apron: string
  camera: {
    home: View
    portrait: View
    maxDistance: number
    /** Closest zoom, and how far the fly-to stops (× the Moon's ~23 units). Mars keeps the camera
     *  back: one mesh cell is ~99 km there, so close-ups would show the triangles. */
    minDistance: number
    flyTo: number
    /** Box the camera and target must stay in (never see the end of the map) */
    box: { min: V3; max: V3 }
  }
  fog: [near: number, far: number]
  /** Globe widget: dots where the ground is below this (maria / northern lowlands) */
  globe: { belowM: number; lonMin: number; lonMax: number; step: number }
}

export const PLANETS: Record<PlanetId, Planet> = {
  moon: {
    id: 'moon', name: 'the Moon', label: 'Moon', radiusKm: 1737.4,
    dem: 'terrain/moon', albedo: 'terrain/moon_albedo.png',
    lonCenter: 0,
    // slightly less in z so the near side (180° × 140°) keeps a pleasing aspect
    xPerDeg: 0.8, zPerDeg: 0.76,
    mesa: { hx: 74, hz: 55, radius: 12 }, // lon ±90°, lat ±70° (DEM crop has a margin)
    edgeFade: 32, // sites reach |z| ≈ 31 (Tycho)
    curveR: 300,
    unitsPerKm: 1.1,
    contourKm: 1,
    ramp: [[0, '#34505e'], [0.25, '#5a7a7c'], [0.5, '#6b7444'], [0.75, '#8d7b4d'], [1, '#a39876']],
    rust: '#74503a', cliff: '#7a4a33', apron: '#55636a',
    camera: {
      // inside the map, framed on the sites (lon −43°…+31°, lat −41°…+26°)
      home: { pos: [-4, 50, 58], target: [-4, -3, 0] },
      portrait: { pos: [-4, 90, 16], target: [-4, 0, 2] },
      maxDistance: 95,
      minDistance: 10,
      flyTo: 1,
      box: { min: [-48, -20, -46], max: [48, 95, 58] },
    },
    fog: [60, 175],
    globe: { belowM: -1700, lonMin: -90, lonMax: 90, step: 3 },
  },
  mars: {
    id: 'mars', name: 'Mars', label: 'Mars', radiusKm: 3396,
    dem: 'terrain/mars', albedo: 'terrain/mars_albedo.png', // MGS TES albedo (scripts/build_mars_albedo.py)
    // 145° W: the ±180° seam falls in the widest gap between landing sites,
    // and Olympus Mons / Tharsis sit near the middle
    lonCenter: -145,
    xPerDeg: 0.6, zPerDeg: 0.6,
    mesa: { hx: 110, hz: 52, radius: 14 }, // the whole planet, lat ±86°
    edgeFade: 14, // Phoenix (68° N) is the outlier at z ≈ −41
    curveR: 700,
    unitsPerKm: 0.45, // Olympus Mons (~21 km) would otherwise tower over the map
    contourKm: 2,
    ramp: [[0, '#3b4052'], [0.25, '#5d5662'], [0.5, '#7a6354'], [0.75, '#977a63'], [1, '#b3a08b']],
    rust: '#6c4637', cliff: '#7a4a33', apron: '#58555f',
    camera: {
      // sites span x −83…+84, z −41…+9 (mostly northern hemisphere)
      home: { pos: [0, 160, 112], target: [0, -4, -20] },
      // phones: fill the frame with the middle of the map (no visible edges); pan to reach the sides
      portrait: { pos: [0, 96, 4], target: [0, 0, -6] },
      maxDistance: 240,
      minDistance: 26,
      flyTo: 2.4,
      box: { min: [-95, -20, -80], max: [95, 230, 150] },
    },
    fog: [210, 520], // camera sits ~2.5× farther than on the Moon
    globe: { belowM: -3000, lonMin: -180, lonMax: 180, step: 4 },
  },
}
