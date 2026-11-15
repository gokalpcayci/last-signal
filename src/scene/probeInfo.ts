import type { Feature } from '../data/features'
import type { Hardware } from '../data/hardware'

const rad = Math.PI / 180

/** Great-circle distance in km between two lon/lat points (degrees) on a sphere of radius r km. */
export function distanceKm(lon1: number, lat1: number, lon2: number, lat2: number, r: number) {
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)))
}

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
/** Arrow pointing from point 1 toward point 2 on the map (north up, east right). */
export function arrowTo(lon1: number, lat1: number, lon2: number, lat2: number) {
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad)
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad)
  const bearing = (Math.atan2(y, x) / rad + 360) % 360
  return ARROWS[Math.round(bearing / 45) % 8]
}

/**
 * Rough "you're in it" radius per feature kind (km). IAU coords are center points only, so
 * inside this radius the readout just names the feature; outside it points the way.
 */
const INSIDE_KM: Record<Feature['kind'], number> = { mare: 300, mountains: 250, crater: 45 }

export interface Nearby { name: string; km: number; arrow: string; inside: boolean }

export function nearestFeature(lon: number, lat: number, feats: Feature[], r: number): Nearby | null {
  let best: Nearby | null = null
  let bestScore = Infinity
  for (const f of feats) {
    const km = distanceKm(lon, lat, f.lon, f.lat, r)
    // rank by distance past the "inside" radius, so a huge mare doesn't lose to a far crater
    const score = km - INSIDE_KM[f.kind]
    if (score >= bestScore) continue
    bestScore = score
    best = { name: f.name, km, arrow: arrowTo(lon, lat, f.lon, f.lat), inside: score <= 0 }
  }
  return best
}

export interface NearSite extends Nearby { active: boolean }

/** Nearest landing site among the visible hardware (sites group several objects). */
export function nearestSite(lon: number, lat: number, items: Hardware[], r: number): NearSite | null {
  let best: NearSite | null = null
  for (const h of items) {
    const km = distanceKm(lon, lat, h.lon, h.lat, r)
    if (best && km >= best.km) continue
    const active = items.some((o) => o.mission === h.mission && o.status === 'active')
    best = { name: h.mission, km, arrow: arrowTo(lon, lat, h.lon, h.lat), inside: km < 5, active }
  }
  return best
}

/** Text gauge: lo ··▲····· hi, marker placed by percentile (0–1). */
export function heightGauge(p: number, cells = 9) {
  const i = Math.min(cells - 1, Math.max(0, Math.round(p * (cells - 1))))
  return { before: '·'.repeat(i), after: '·'.repeat(cells - 1 - i) }
}

export const fmtKm = (km: number) => (km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('en-US'))
