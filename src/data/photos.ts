/**
 * One real photo per object, shown in the story panel.
 * Files live in public/photos/<object id>.jpg (built by scripts/build_photos.py from the
 * NASA Image and Video Library). `nasaId` links back to images.nasa.gov/details/<nasaId>.
 * Captions only say what NASA's own caption says.
 */
export interface Photo {
  nasaId: string
  caption: string
  credit: string
  /** 'orbit' = seen from above by a spacecraft, not from the ground */
  view?: 'orbit'
  /** CSS object-position, for photos whose subject is off-center */
  focus?: string
}

const N = 'NASA'
const JPL = 'NASA/JPL'
const LRO = 'NASA/GSFC/Arizona State University'

export const PHOTOS: Record<string, Photo> = {
  // ── Moon ─────────────────────────────────────
  'surveyor-1': { nasaId: 'PIA02976', credit: JPL, caption: 'Surveyor 1’s own shadow on the Moon, late in the lunar afternoon' },
  'surveyor-3': { nasaId: 'AS12-48-7133', credit: N, caption: 'Apollo 12 astronaut Pete Conrad visits Surveyor 3, with the lunar module Intrepid behind' },
  'surveyor-5': { nasaId: 'PIA02978', credit: JPL, caption: 'Surveyor 5’s footpad in the lunar soil, next to the trench it dug sliding to a stop' },
  'surveyor-6': { nasaId: 'PIA12978', credit: LRO, view: 'orbit', caption: 'Surveyor 6 seen from orbit by LRO, casting an 18-meter shadow' },
  'surveyor-7': { nasaId: 'PIA02977', credit: JPL, caption: 'Surveyor 7’s view near Tycho crater; the hills on the horizon are about 13 km away' },

  'a11-lm': { nasaId: 'as11-40-5927', credit: N, caption: 'Eagle on the Moon while Buzz Aldrin unpacks the science experiments' },
  'a12-lm': { nasaId: 'as12-47-6988', credit: N, caption: 'Pete Conrad at Intrepid’s equipment bay' },
  'a14-lm': { nasaId: 'as14-66-09277', credit: N, caption: 'Antares at Fra Mauro, flag already up' },
  'a15-lm': { nasaId: 'as15-086-11600', credit: N, caption: 'Falcon at Hadley, early on the first moonwalk, Hadley Delta behind' },
  'a16-lm': { nasaId: 'S72-35612', credit: N, caption: 'Orion at Descartes, seen by the rover’s TV camera' },
  'a17-lm': { nasaId: 'as17-134-20382', credit: N, caption: 'Harrison Schmitt with Challenger, the flag and the rover' },

  'a15-lrv': { nasaId: 'as15-86-11603', credit: N, caption: 'James Irwin at the rover, Mount Hadley behind', focus: '50% 60%' },
  'a16-lrv': { nasaId: 'as16-108-17622', credit: N, caption: 'John Young reaches for tools on the rover' },
  'a17-lrv': { nasaId: 'as17-147-22527', credit: N, caption: 'Gene Cernan drives the rover on the first moonwalk' },

  'a11-lrrr': { nasaId: 'as11-40-5948', credit: N, caption: 'Buzz Aldrin by the seismometer; the laser mirror sits just beyond it' },
  'a14-lrrr': { nasaId: 'as14-67-09386', credit: N, caption: 'The Apollo 14 laser mirror, set up on the surface' },
  'a15-lrrr': { nasaId: 'PIA13037', credit: LRO, view: 'orbit', caption: 'The site from orbit: the mirror is circled, with the science station, Falcon and the rover nearby' },

  'a12-alsep': { nasaId: 'as12-47-6918', credit: N, caption: 'Part of the station: the seismometer in front, the central station behind' },
  'a14-alsep': { nasaId: 'as14-67-09376', credit: N, caption: 'The central station with its antenna, and experiments around it' },
  'a15-alsep': { nasaId: 'as15-85-11471', credit: N, caption: 'Dave Scott in the rover at the science station site' },
  'a16-alsep': { nasaId: 'as16-113-18347', credit: N, caption: 'The seismometer in front, the central station behind' },
  'a17-alsep': { nasaId: 'S72-55065', credit: N, caption: 'Harrison Schmitt setting up an experiment, seen by the rover’s TV camera' },

  // ── Mars ─────────────────────────────────────
  'viking-1': { nasaId: 'PIA00565', credit: JPL, caption: 'The flag on Viking Lander 1, photographed on Mars by its own camera', focus: '50% 30%' },
  'viking-2': { nasaId: 'PIA00573', credit: JPL, caption: 'Frost on the ground around Viking Lander 2', focus: '50% 30%' },
  pathfinder: { nasaId: 'PIA00673', credit: JPL, caption: 'The Pathfinder lander and its ramp (upper left), seen by Sojourner' },
  sojourner: { nasaId: 'PIA01551', credit: JPL, caption: 'Sojourner, just rolled off the lander' },
  spirit: { nasaId: 'PIA16442', credit: 'NASA/JPL-Caltech/Cornell/ASU', caption: 'Spirit’s self-portrait, wrapped from a 360° panorama' },
  opportunity: { nasaId: 'PIA22222', credit: 'NASA/JPL-Caltech', caption: 'Opportunity’s first selfie, in Perseverance Valley' },
  phoenix: { nasaId: 'PIA12106', credit: 'NASA/JPL-Caltech/UA/Texas A&M', caption: 'Phoenix’s deck after delivering soil samples to its instruments' },
  curiosity: { nasaId: 'PIA19808', credit: 'NASA/JPL-Caltech/MSSS', caption: 'Curiosity’s low-angle selfie at the “Buckskin” drill site' },
  insight: { nasaId: 'PIA25287', credit: 'NASA/JPL-Caltech', caption: 'InSight’s final selfie, its solar panels deep in dust' },
  perseverance: { nasaId: 'PIA24542', credit: 'NASA/JPL-Caltech/MSSS', caption: 'Perseverance’s selfie with Ingenuity, about 4 meters away' },
  ingenuity: { nasaId: 'PIA26243', credit: 'NASA/JPL-Caltech', caption: 'After its 72nd and last flight, Ingenuity photographs the shadow of its damaged rotor blade' },
  'three-forks': { nasaId: 'PIA25681', credit: 'NASA/JPL-Caltech/MSSS', caption: 'Perseverance’s selfie with the sample tubes at Three Forks' },

  // ── Deep Space ───────────────────────────────
  'pioneer-10': { nasaId: 'ARC-1972-AC72-2135', credit: 'NASA Ames', caption: 'Pioneer 10 being readied at Cape Kennedy, with its plaque in place' },
  'pioneer-11': { nasaId: '9139575', credit: N, caption: 'An Atlas-Centaur rocket lifts off carrying Pioneer 11, April 1973' },
  'voyager-2': { nasaId: 'PIA01492', credit: JPL, caption: 'Neptune, from Voyager 2’s last whole-planet pictures, taken 4 days before its closest pass' },
  'voyager-1': { nasaId: 'PIA00452', credit: JPL, caption: 'The “Pale Blue Dot”: Earth seen by Voyager 1 from more than 6 billion km away' },
  ulysses: { nasaId: 's41-601-009', credit: N, caption: 'Ulysses and its booster drift away from Space Shuttle Discovery, 6 October 1990' },
  near: { nasaId: 'PIA02923', credit: 'NASA/JHU-APL', view: 'orbit', caption: 'Eros’s northern half, pieced together from NEAR’s photos' },
  stardust: { nasaId: 'PIA03188', credit: JPL, caption: 'Stardust’s aerogel dust collector' },
  spitzer: { nasaId: 'PIA23644', credit: 'NASA/JPL-Caltech', caption: 'Spitzer being readied for launch at Cape Canaveral, 2003' },
  'deep-impact': { nasaId: 'PIA02137', credit: 'NASA/JPL-Caltech/UMD', caption: 'Comet Tempel 1 lights up 67 seconds after Deep Impact’s impactor hit it' },
  'new-horizons': { nasaId: 'PIA19952', credit: 'NASA/JHU-APL/SwRI', caption: 'Pluto in enhanced color, photographed by New Horizons on 14 July 2015' },
  dawn: { nasaId: 'PIA21906', credit: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA', caption: 'Ceres seen by Dawn, centered on Occator Crater, home to its brightest spot' },
  kepler: { nasaId: 'PIA11188', credit: 'NASA/Ball Aerospace', caption: 'Kepler in a clean room at Ball Aerospace in Boulder, Colorado' },
}
