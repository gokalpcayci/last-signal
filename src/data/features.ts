/** Named surface features shown as map labels (IAU Gazetteer of Planetary Nomenclature center coords). */
export interface Feature {
  name: string
  kind: 'mare' | 'crater' | 'mountains'  // Mars: plains/basins use 'mare', volcanoes/canyons 'mountains'
  lat: number
  lon: number
}

export const features: Feature[] = [
  { name: 'Mare Tranquillitatis', kind: 'mare', lat: 8.35, lon: 30.83 },
  { name: 'Mare Serenitatis', kind: 'mare', lat: 28.0, lon: 17.5 },
  { name: 'Mare Imbrium', kind: 'mare', lat: 32.8, lon: -15.6 },
  { name: 'Mare Nubium', kind: 'mare', lat: -21.3, lon: -16.6 },
  { name: 'Mare Crisium', kind: 'mare', lat: 17.0, lon: 59.1 },
  { name: 'Oceanus Procellarum', kind: 'mare', lat: 18.4, lon: -57.4 },
  { name: 'Montes Apenninus', kind: 'mountains', lat: 18.9, lon: -3.7 },
  { name: 'Copernicus', kind: 'crater', lat: 9.62, lon: -20.08 },
  { name: 'Tycho', kind: 'crater', lat: -43.31, lon: -11.36 },
]

/** Mars labels (IAU Gazetteer center coords, lon east −180…180). */
export const marsFeatures: Feature[] = [
  { name: 'Olympus Mons', kind: 'mountains', lat: 18.65, lon: -133.8 },
  { name: 'Valles Marineris', kind: 'mountains', lat: -13.9, lon: -59.2 },
  { name: 'Elysium Mons', kind: 'mountains', lat: 25.02, lon: 147.21 },
  { name: 'Hellas Planitia', kind: 'mare', lat: -42.4, lon: 70.5 },
  { name: 'Utopia Planitia', kind: 'mare', lat: 46.7, lon: 117.5 },
  { name: 'Argyre Planitia', kind: 'mare', lat: -49.7, lon: -44.0 },
]
