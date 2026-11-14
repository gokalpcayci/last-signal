/**
 * Where is the Sun over the Moon right now?
 *
 * The sub-solar point (Sun directly overhead) follows the lunar phase: at new
 * moon the Sun is behind the Moon (sub-solar longitude 180°, far side lit); at
 * full moon it's over the near side (0°). In between it moves west at
 * 360° per synodic month (~12.19°/day). We use the Moon's mean elongation D
 * from Meeus, "Astronomical Algorithms" (ch. 47), and ignore libration and the
 * ±1.5° sub-solar latitude — accurate to a few degrees, plenty for a day/night line.
 */
const SYNODIC_DAYS = 29.530589
export const DEG_PER_DAY = 360 / SYNODIC_DAYS

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180
const wrap360 = (d: number) => ((d % 360) + 360) % 360

/** Sub-solar selenographic longitude in degrees (−180…180, east positive). */
export function subsolarLon(date = new Date()) {
  const jd = date.getTime() / 86400000 + 2440587.5
  const T = (jd - 2451545.0) / 36525
  const D = 297.8501921 + 445267.1114034 * T // mean elongation of the Moon (deg)
  return wrap180(180 - D)
}

export interface SunAtSite {
  isDay: boolean
  /** Sun height above the horizon, degrees (negative = below) */
  elevation: number
  /** Days until the next sunrise (if night) or sunset (if day) */
  daysUntilChange: number
  /** Rough surface temperature for kids (°C) */
  tempC: number
}

export function sunAtSite(lat: number, lon: number, date = new Date()): SunAtSite {
  const s = subsolarLon(date)
  const r = Math.PI / 180
  const sinEl = Math.cos(lat * r) * Math.cos((lon - s) * r)
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl))) / r
  const isDay = elevation > 0
  // Sub-solar longitude decreases over time. Sunrise at a site happens when it
  // reaches lon + 90°, sunset when it reaches lon − 90°.
  const target = isDay ? lon - 90 : lon + 90
  const daysUntilChange = wrap360(s - target) / DEG_PER_DAY
  // Daytime surface gets up to ~120 °C at local noon; nights drop to ~−170 °C.
  const tempC = isDay ? Math.round(-20 + 140 * Math.pow(Math.max(sinEl, 0), 0.4)) : -170
  return { isDay, elevation, daysUntilChange, tempC }
}
