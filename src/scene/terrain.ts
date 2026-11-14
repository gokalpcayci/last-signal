import * as THREE from 'three'

/**
 * Procedural lunar height field (placeholder until the real LRO LOLA DEM is wired in).
 * World units: x = east, z = south. 1 unit ≈ 1 degree-ish.
 */
export const WORLD = { width: 120, depth: 100, segX: 130, segZ: 108 }

export const lonToX = (lon: number) => lon * 1.15
export const latToZ = (lat: number) => -lat * 1.05

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Value noise
const rand = mulberry32(42)
const PERM = Array.from({ length: 512 }, () => rand())
const hash = (x: number, y: number) => PERM[((x * 73856093) ^ (y * 19349663)) & 511]
const smooth = (t: number) => t * t * (3 - 2 * t)
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  const u = smooth(xf), v = smooth(yf)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x: number, y: number) {
  let s = 0, amp = 1, f = 1
  for (let i = 0; i < 5; i++) { s += amp * noise(x * f, y * f); amp *= 0.5; f *= 2 }
  return s
}

interface Crater { x: number; z: number; r: number; depth: number }
const craters: Crater[] = []
const cr = mulberry32(7)
for (let i = 0; i < 70; i++) {
  const r = 1.2 + Math.pow(cr(), 2.4) * 9
  craters.push({ x: (cr() - 0.5) * WORLD.width, z: (cr() - 0.5) * WORLD.depth, r, depth: r * 0.35 })
}
// Tycho — a big named crater near Surveyor 7
craters.push({ x: lonToX(-11.2), z: latToZ(-43.3), r: 6, depth: 3 })

/** Large-scale: highlands in the south, flat dark "seas" (maria) near the equator. */
function base(x: number, z: number) {
  const highlands = THREE.MathUtils.smoothstep(z, -5, 40) * 5
  const apennines = Math.exp(-(((x - 2) * 0.25) ** 2 + ((z + 22) * 0.6) ** 2)) * 7
  const ridges = fbm(x * 0.05 + 10, z * 0.05) * 6
  return highlands + apennines + ridges
}

export function heightAt(x: number, z: number) {
  let h = base(x, z) + fbm(x * 0.35, z * 0.35) * 0.5
  for (const c of craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r
    if (d < 1) h -= c.depth * (1 - d * d)
    else if (d < 1.6) h += c.depth * 0.45 * Math.cos(((d - 1) / 0.6) * Math.PI * 0.5) ** 2
  }
  return h
}

const C_LOW = new THREE.Color('#3f8f93')
const C_MID = new THREE.Color('#c8653a')
const C_HIGH = new THREE.Color('#a6d860')

export function buildTerrainGeometry() {
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
