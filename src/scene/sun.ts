import type { PlanetId } from './planets'

/**
 * Where is the Sun over the Moon (or Mars) right now?
 *
 * The sub-solar point (Sun directly overhead) follows the lunar phase: at new
 * moon the Sun is behind the Moon (sub-solar longitude 180°, far side lit); at
 * full moon it's over the near side (0°). In between it moves west at
 * 360° per synodic month (~12.19°/day). We use the Moon's mean elongation D
 * from Meeus, "Astronomical Algorithms" (ch. 47), and ignore libration and the
 * ±1.5° sub-solar latitude — accurate to a few degrees, plenty for a day/night line.
 */
const SYNODIC_DAYS = 29.530589
/** Mean solar day on Mars ("sol") in Earth days */
const SOL_DAYS = 1.0274912517
/** How fast the sub-solar point sweeps west, degrees per Earth day */
export const degPerDay = (body: PlanetId) => 360 / (body === 'mars' ? SOL_DAYS : SYNODIC_DAYS)

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180
const wrap360 = (d: number) => ((d % 360) + 360) % 360

/**
 * Sub-solar longitude on Mars (−180…180, east positive) from NASA GISS's Mars24
 * algorithm (Allison & McEwen 2000): Coordinated Mars Time + the equation of time.
 * Small planetary perturbation terms are left out (< 0.1°).
 */
function marsSubsolarLon(date: Date) {
  const jdUT = date.getTime() / 86400000 + 2440587.5
  const dt = jdUT + (37 + 32.184) / 86400 - 2451545.0 // TT − J2000 (TAI−UTC = 37 s since 2017)
  const r = Math.PI / 180
  const M = (19.3871 + 0.52402073 * dt) * r // mean anomaly
  const alphaFMS = 270.3871 + 0.524038496 * dt
  const eoc = (10.691 + 3e-7 * dt) * Math.sin(M) + 0.623 * Math.sin(2 * M) + 0.05 * Math.sin(3 * M)
    + 0.005 * Math.sin(4 * M) + 0.0005 * Math.sin(5 * M) // ν − M, degrees
  const Ls = (alphaFMS + eoc) * r // areocentric solar longitude
  const eot = 2.861 * Math.sin(2 * Ls) - 0.071 * Math.sin(4 * Ls) + 0.002 * Math.sin(6 * Ls) - eoc
  const msd = (dt - 4.5) / SOL_DAYS + 44796.0 - 0.0009626 // Mars Sol Date
  const mtc = (((24 * msd) % 24) + 24) % 24 // Coordinated Mars Time, hours
  const westLon = mtc * 15 + eot + 180
  return wrap180(-westLon)
}

/** Sub-solar longitude in degrees (−180…180, east positive) on the given body. */
export function subsolarLon(date = new Date(), body: PlanetId = 'moon') {
  if (body === 'mars') return marsSubsolarLon(date)
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

export function sunAtSite(lat: number, lon: number, date = new Date(), body: PlanetId = 'moon'): SunAtSite {
  const s = subsolarLon(date, body)
  const r = Math.PI / 180
  const sinEl = Math.cos(lat * r) * Math.cos((lon - s) * r)
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl))) / r
  const isDay = elevation > 0
  // Sub-solar longitude decreases over time. Sunrise at a site happens when it
  // reaches lon + 90°, sunset when it reaches lon − 90°.
  const target = isDay ? lon - 90 : lon + 90
  const daysUntilChange = wrap360(s - target) / degPerDay(body)
  // Moon: daytime ground up to ~120 °C at local noon, nights ~−170 °C.
  // Mars: thin air, so the ground swings from about −80 °C at night to ~+20 °C at noon.
  const tempC = body === 'mars'
    ? (isDay ? Math.round(-60 + 80 * Math.pow(Math.max(sinEl, 0), 0.5)) : -80)
    : (isDay ? Math.round(-20 + 140 * Math.pow(Math.max(sinEl, 0), 0.4)) : -170)
  return { isDay, elevation, daysUntilChange, tempC }
}
