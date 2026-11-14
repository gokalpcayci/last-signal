import * as THREE from 'three'

/**
 * Real lunar topography from NASA's Lunar Orbiter Laser Altimeter (LOLA),
 * via the NASA SVS CGI Moon Kit. Built by scripts/build_dem.py into
 * public/terrain/moon_dem.{bin,json}.
 *
 * World units: x = east, z = south. ~1.1 units per degree.
 */
export const WORLD = { width: 120, depth: 100, segX: 130, segZ: 108 }

export const lonToX = (lon: number) => lon * 1.15
export const latToZ = (lat: number) => -lat * 1.05
const xToLon = (x: number) => x / 1.15
const zToLat = (z: number) => -z / 1.05

/** Vertical exaggeration: real relief (~11 km) would be nearly flat at this map scale. */
const UNITS_PER_KM = 1.2

interface DemMeta {
  width: number; height: number; ppd: number
  lonMin: number; lonMax: number; latMin: number; latMax: number
}

export interface Dem {
  /** Terrain height (world units) at world x/z */
  heightAt: (x: number, z: number) => number
  buildGeometry: () => THREE.BufferGeometry
}

function makeDem(meta: DemMeta, raw: Uint16Array): Dem {
  const { width: W, height: H, ppd } = meta
  const px = (c: number, r: number) => {
    const ci = Math.min(W - 1, Math.max(0, c)), ri = Math.min(H - 1, Math.max(0, r))
    return (raw[ri * W + ci] - 20000) / 2 // meters
  }
  /** Bilinear sample in meters at lon/lat. Pixel centers sit at +0.5. */
  const metersAt = (lon: number, lat: number) => {
    const c = (lon - meta.lonMin) * ppd - 0.5
    const r = (meta.latMax - lat) * ppd - 0.5
    const c0 = Math.floor(c), r0 = Math.floor(r)
    const fx = c - c0, fy = r - r0
    const top = px(c0, r0) * (1 - fx) + px(c0 + 1, r0) * fx
    const bot = px(c0, r0 + 1) * (1 - fx) + px(c0 + 1, r0 + 1) * fx
    return top * (1 - fy) + bot * fy
  }
  // The mesh has fewer vertices than the DEM has pixels. Point-sampling would alias
  // small craters into spikes, so average a 5×5 patch covering one vertex cell.
  const cellLon = xToLon(WORLD.width / WORLD.segX)
  const cellLat = Math.abs(zToLat(WORLD.depth / WORLD.segZ))
  const smoothMetersAt = (lon: number, lat: number) => {
    let s = 0
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++) s += metersAt(lon + (i / 4) * cellLon, lat + (j / 4) * cellLat)
    return s / 25
  }
  const heightAt = (x: number, z: number) => (smoothMetersAt(xToLon(x), zToLat(z)) / 1000) * UNITS_PER_KM
  return { heightAt, buildGeometry: () => buildTerrainGeometry(heightAt) }
}

let demPromise: Promise<Dem> | null = null
export function loadDem(): Promise<Dem> {
  demPromise ??= (async () => {
    const base = import.meta.env.BASE_URL
    const [meta, buf] = await Promise.all([
      fetch(`${base}terrain/moon_dem.json`).then((r) => r.json() as Promise<DemMeta>),
      fetch(`${base}terrain/moon_dem.bin`).then((r) => r.arrayBuffer()),
    ])
    return makeDem(meta, new Uint16Array(buf))
  })()
  return demPromise
}

const C_LOW = new THREE.Color('#3f8f93')
const C_MID = new THREE.Color('#c8653a')
const C_HIGH = new THREE.Color('#a6d860')

function buildTerrainGeometry(heightAt: (x: number, z: number) => number) {
  const g = new THREE.PlaneGeometry(WORLD.width, WORLD.depth, WORLD.segX, WORLD.segZ)
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  let min = Infinity, max = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const h = heightAt(pos.getX(i), pos.getZ(i))
    pos.setY(i, h)
    min = Math.min(min, h); max = Math.max(max, h)
  }
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min) / (max - min)
    // low maria → teal, mid → orange, high highlands → green
    if (t < 0.45) c.copy(C_LOW).lerp(C_MID, t / 0.45)
    else c.copy(C_MID).lerp(C_HIGH, (t - 0.45) / 0.55)
    // fade edges into darkness
    const ex = Math.abs(pos.getX(i)) / (WORLD.width / 2)
    const ez = Math.abs(pos.getZ(i)) / (WORLD.depth / 2)
    const fade = 1 - THREE.MathUtils.smoothstep(Math.max(ex, ez), 0.75, 1)
    c.multiplyScalar(0.25 + 0.75 * fade)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}
