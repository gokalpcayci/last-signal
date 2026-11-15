/**
 * What lies beyond the map, drawn faintly behind the solar-system disc on the Deep Space view:
 * the Milky Way band and a few signposts at their real directions (J2000 RA/Dec, degrees).
 * Distances are NASA's rounded figures (science.nasa.gov): Alpha Centauri 4.37 ly, Sirius 8.6 ly,
 * galactic centre ~26,000 ly, Large Magellanic Cloud ~160,000 ly, Andromeda ~2.5 million ly.
 */

export interface DeepSkyObject { name: string; ra: number; dec: number; sub: string; kind: 'star' | 'galaxy' | 'center' }

export const DEEP_SKY: DeepSkyObject[] = [
  { name: 'Alpha Centauri', ra: 219.90, dec: -60.83, sub: 'NEAREST STARS · 4.4 LIGHT-YEARS', kind: 'star' },
  { name: 'Sirius', ra: 101.29, dec: -16.72, sub: 'BRIGHTEST STAR · 8.6 LIGHT-YEARS', kind: 'star' },
  { name: 'Galactic center', ra: 266.42, dec: -29.01, sub: 'HEART OF THE MILKY WAY · 26,000 LY', kind: 'center' },
  { name: 'Large Magellanic Cloud', ra: 80.89, dec: -69.76, sub: 'NEIGHBOUR GALAXY · 160,000 LY', kind: 'galaxy' },
  { name: 'Andromeda galaxy', ra: 10.68, dec: 41.27, sub: 'NEAREST BIG GALAXY · 2.5 MILLION LY', kind: 'galaxy' },
]

// Galactic → equatorial (J2000): north galactic pole and the galactic longitude of the north celestial pole
const NGP_RA = 192.85948 * (Math.PI / 180)
const NGP_DEC = 27.12825 * (Math.PI / 180)
const L_NCP = 122.93192 * (Math.PI / 180)

/** Galactic longitude/latitude (deg) → RA/Dec (deg). */
export function galacticToEquatorial(l: number, b: number) {
  const L = l * (Math.PI / 180), B = b * (Math.PI / 180)
  const sinDec = Math.sin(B) * Math.sin(NGP_DEC) + Math.cos(B) * Math.cos(NGP_DEC) * Math.cos(L_NCP - L)
  const dec = Math.asin(sinDec)
  const y = Math.cos(B) * Math.sin(L_NCP - L)
  const x = Math.sin(B) * Math.cos(NGP_DEC) - Math.cos(B) * Math.sin(NGP_DEC) * Math.cos(L_NCP - L)
  const ra = (NGP_RA + Math.atan2(y, x)) * (180 / Math.PI)
  return { ra: (ra + 360) % 360, dec: dec * (180 / Math.PI) }
}

/** Seeded points along the Milky Way: thin band, thicker and denser toward the galactic centre (l = 0). */
export function milkyWay(n = 1600, seed = 42) {
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  const out: { ra: number; dec: number; w: number }[] = []
  while (out.length < n) {
    const l = rnd() * 360
    const toCentre = Math.cos((l * Math.PI) / 180) * 0.5 + 0.5    // 1 at the centre, 0 opposite
    if (rnd() > 0.35 + 0.65 * toCentre) continue                    // denser toward the centre
    const spread = 4 + 9 * toCentre                                  // thicker bulge
    const b = (rnd() + rnd() + rnd() - 1.5) * spread
    out.push({ ...galacticToEquatorial(l, b), w: 0.4 + 0.6 * toCentre * (1 - Math.abs(b) / (spread * 1.5)) })
  }
  return out
}
