/**
 * Bright stars and stick figures for the Deep Space map's rim: the zodiac constellations plus
 * Aquila (where Pioneer 11 is heading). RA/Dec are J2000 degrees (standard catalogue values);
 * eclipticOf() turns them into the ecliptic longitude/latitude the map uses.
 *
 * Destinations (NASA Ames Pioneer Project guide; science.nasa.gov Pioneer pages):
 *  - Pioneer 10 heads toward Aldebaran in Taurus, ~68 light-years away: about 2 million years.
 *  - Pioneer 11 heads toward Aquila and may pass near one of its stars in about 4 million years.
 */

export interface Star { name: string; ra: number; dec: number; bright?: boolean }
export interface Constellation { name: string; stars: Star[]; lines: [number, number][] }

const OBLIQUITY = 23.4392911 * (Math.PI / 180)

/** J2000 equatorial → ecliptic, degrees. */
export function eclipticOf(ra: number, dec: number) {
  const a = ra * (Math.PI / 180), d = dec * (Math.PI / 180)
  const sinB = Math.sin(d) * Math.cos(OBLIQUITY) - Math.cos(d) * Math.sin(OBLIQUITY) * Math.sin(a)
  const lon = Math.atan2(Math.sin(a) * Math.cos(OBLIQUITY) + Math.tan(d) * Math.sin(OBLIQUITY), Math.cos(a))
  return { lon: ((lon * 180) / Math.PI + 360) % 360, lat: (Math.asin(sinB) * 180) / Math.PI }
}

export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'Taurus',
    stars: [
      { name: 'Aldebaran', ra: 68.98, dec: 16.51, bright: true }, { name: 'Elnath', ra: 81.57, dec: 28.61 },
      { name: 'Zeta Tau', ra: 84.41, dec: 21.14 }, { name: 'Gamma Tau', ra: 64.95, dec: 15.63 },
      { name: 'Delta Tau', ra: 65.73, dec: 17.54 }, { name: 'Epsilon Tau', ra: 67.15, dec: 19.18 },
      { name: 'Alcyone', ra: 56.87, dec: 24.11 },
    ],
    lines: [[3, 0], [0, 2], [3, 4], [4, 5], [5, 1], [3, 6]],
  },
  {
    name: 'Gemini',
    stars: [
      { name: 'Castor', ra: 113.65, dec: 31.89, bright: true }, { name: 'Pollux', ra: 116.33, dec: 28.03, bright: true },
      { name: 'Alhena', ra: 99.43, dec: 16.40 }, { name: 'Mebsuta', ra: 100.98, dec: 25.13 },
      { name: 'Tejat', ra: 95.74, dec: 22.51 }, { name: 'Wasat', ra: 110.03, dec: 21.98 },
    ],
    lines: [[0, 3], [3, 4], [1, 5], [5, 2], [0, 1]],
  },
  {
    name: 'Leo',
    stars: [
      { name: 'Regulus', ra: 152.09, dec: 11.97, bright: true }, { name: 'Eta Leo', ra: 151.83, dec: 16.76 },
      { name: 'Algieba', ra: 154.99, dec: 19.84 }, { name: 'Adhafera', ra: 154.17, dec: 23.42 },
      { name: 'Epsilon Leo', ra: 146.46, dec: 23.77 }, { name: 'Zosma', ra: 168.53, dec: 20.52 },
      { name: 'Chertan', ra: 168.56, dec: 15.43 }, { name: 'Denebola', ra: 177.26, dec: 14.57, bright: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 7], [7, 6], [6, 0]],
  },
  {
    name: 'Virgo',
    stars: [
      { name: 'Spica', ra: 201.30, dec: -11.16, bright: true }, { name: 'Porrima', ra: 190.42, dec: -1.45 },
      { name: 'Vindemiatrix', ra: 195.54, dec: 10.96 }, { name: 'Zavijava', ra: 177.67, dec: 1.76 },
      { name: 'Heze', ra: 203.67, dec: -0.60 },
    ],
    lines: [[3, 1], [1, 0], [1, 2], [1, 4]],
  },
  {
    name: 'Scorpius',
    stars: [
      { name: 'Antares', ra: 247.35, dec: -26.43, bright: true }, { name: 'Acrab', ra: 241.36, dec: -19.81 },
      { name: 'Dschubba', ra: 240.08, dec: -22.62 }, { name: 'Pi Sco', ra: 239.71, dec: -26.11 },
      { name: 'Tau Sco', ra: 248.97, dec: -28.22 }, { name: 'Epsilon Sco', ra: 252.54, dec: -34.29 },
      { name: 'Sargas', ra: 264.33, dec: -42.99 }, { name: 'Shaula', ra: 263.40, dec: -37.10 },
    ],
    lines: [[1, 2], [2, 3], [2, 0], [0, 4], [4, 5], [5, 6], [6, 7]],
  },
  {
    name: 'Sagittarius',
    stars: [
      { name: 'Kaus Australis', ra: 276.04, dec: -34.38, bright: true }, { name: 'Kaus Media', ra: 275.25, dec: -29.83 },
      { name: 'Kaus Borealis', ra: 276.99, dec: -25.42 }, { name: 'Nunki', ra: 283.82, dec: -26.30, bright: true },
      { name: 'Ascella', ra: 285.65, dec: -29.88 }, { name: 'Phi Sgr', ra: 281.41, dec: -26.99 },
      { name: 'Tau Sgr', ra: 286.74, dec: -27.67 }, { name: 'Alnasl', ra: 271.45, dec: -30.42 },
    ],
    lines: [[7, 1], [1, 0], [0, 4], [4, 6], [6, 3], [3, 5], [5, 2], [2, 1], [5, 4], [1, 5]],
  },
  {
    name: 'Aquila',
    stars: [
      { name: 'Altair', ra: 297.70, dec: 8.87, bright: true }, { name: 'Tarazed', ra: 296.56, dec: 10.61 },
      { name: 'Alshain', ra: 298.83, dec: 6.41 }, { name: 'Delta Aql', ra: 291.37, dec: 3.11 },
      { name: 'Lambda Aql', ra: 286.56, dec: -4.88 }, { name: 'Zeta Aql', ra: 286.35, dec: 13.86 },
      { name: 'Theta Aql', ra: 303.11, dec: -0.82 },
    ],
    lines: [[1, 0], [0, 2], [0, 3], [3, 4], [3, 5], [2, 6]],
  },
  {
    name: 'Aries',
    stars: [{ name: 'Hamal', ra: 31.79, dec: 23.46, bright: true }, { name: 'Sheratan', ra: 28.66, dec: 20.81 }, { name: 'Mesarthim', ra: 28.38, dec: 19.29 }],
    lines: [[0, 1], [1, 2]],
  },
]

/** Where the silent Pioneers are heading (a star in each target constellation). */
export const DESTINATIONS = [
  { probe: 'pioneer-10', star: 'Aldebaran', label: '→ ALDEBARAN', sub: '~2 MILLION YRS' },
  { probe: 'pioneer-11', star: 'Lambda Aql', label: '→ AQUILA', sub: '~4 MILLION YRS' },
]
