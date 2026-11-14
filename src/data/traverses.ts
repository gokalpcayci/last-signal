/**
 * Lunar Roving Vehicle drives (Apollo 15–17), one polyline per EVA.
 * Points are [east km, north km] from the Lunar Module, traced by hand from the
 * NASA/LPI traverse maps at the main stations — the shape and reach are right,
 * individual bends are approximate.
 *
 * At map scale 1 km ≈ 0.026 world units, so the scene draws them magnified (TRAVERSE_MAG).
 */
export interface Traverse {
  mission: string
  /** hardware id of the rover */
  roverId: string
  /** hardware id the drives start from (the LM) */
  lmId: string
  totalKm: number
  evas: [number, number][][]
}

export const traverses: Traverse[] = [
  {
    mission: 'Apollo 15', roverId: 'a15-lrv', lmId: 'a15-lm', totalKm: 27.8,
    evas: [
      // EVA 1: south along Hadley Rille to Elbow and St. George crater
      [[0, 0], [-0.8, -1.2], [-1.6, -2.6], [-1.9, -3.3], [-1.6, -4.6], [-0.6, -3.0], [-0.2, -1.2], [0, 0]],
      // EVA 2: up the Apennine Front to Spur crater (Genesis Rock)
      [[0, 0], [0.4, -1.4], [0.9, -3.0], [0.4, -4.9], [-0.2, -4.4], [-0.6, -3.6], [-0.3, -1.6], [0, 0]],
      // EVA 3: west to the rim of Hadley Rille
      [[0, 0], [-0.9, 0.2], [-1.6, 0.3], [-2.1, 0.5], [-2.4, 0.1], [-1.4, -0.3], [0, 0]],
    ],
  },
  {
    mission: 'Apollo 16', roverId: 'a16-lrv', lmId: 'a16-lm', totalKm: 26.7,
    evas: [
      // EVA 1: west to Flag and Spook craters
      [[0, 0], [-0.6, -0.1], [-1.4, 0.1], [-1.1, -0.3], [-0.4, -0.3], [0, 0]],
      // EVA 2: south up Stone Mountain
      [[0, 0], [-0.3, -1.2], [-0.6, -2.6], [-0.4, -3.8], [0.2, -3.0], [0.0, -2.0], [-0.3, -1.0], [0, 0]],
      // EVA 3: north to North Ray crater and House Rock
      [[0, 0], [0.2, 1.5], [0.4, 3.0], [0.5, 4.4], [0.9, 3.6], [0.4, 1.5], [0, 0]],
    ],
  },
  {
    mission: 'Apollo 17', roverId: 'a17-lrv', lmId: 'a17-lm', totalKm: 35.9,
    evas: [
      // EVA 1: short drive south to Steno crater
      [[0, 0], [0.4, -0.7], [0.6, -1.1], [0.2, -0.4], [0, 0]],
      // EVA 2: the long drive west to the South Massif (Nansen), back past Shorty and Camelot
      [[0, 0], [-1.5, -1.2], [-3.5, -2.7], [-5.6, -4.3], [-6.4, -5.4], [-4.8, -3.9], [-3.4, -2.6], [-1.8, -0.9], [0, 0]],
      // EVA 3: north to the North Massif, east to the Sculptured Hills, Van Serg crater
      [[0, 0], [0.3, 1.6], [0.6, 3.4], [1.0, 3.5], [2.5, 3.1], [3.6, 2.5], [2.2, 1.4], [0.8, 0.6], [0, 0]],
    ],
  },
]
