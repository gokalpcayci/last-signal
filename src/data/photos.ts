/**
 * Real photos per object, shown in the story panel (a slideshow when there are several).
 * Files live in public/photos/<object id>.jpg, extras in <object id>-2.jpg, -3.jpg (built by scripts/build_photos.py from the
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

/** More photos per object, shown after the main one (files <id>-2.jpg, <id>-3.jpg). */
export const EXTRA_PHOTOS: Record<string, Photo[]> = {
  // ── Moon ─────────────────────────────────────
  'surveyor-1': [
    { nasaId: 'PIA12910', credit: LRO, view: 'orbit', caption: 'Surveyor 1 sitting on the Ocean of Storms, seen from orbit by LRO' },
  ],
  'surveyor-3': [
    { nasaId: 'as12-48-7121', credit: N, caption: 'Surveyor 3 in its crater, photographed on the second Apollo 12 moonwalk' },
    { nasaId: 'AS12-48-7134', credit: N, caption: 'Two spacecraft on the Moon: Surveyor 3 in front, the Apollo 12 lunar module behind' },
  ],
  'surveyor-5': [
    { nasaId: 'PIA12977', credit: LRO, view: 'orbit', caption: 'Surveyor 5 inside a 10-meter crater, seen from orbit by LRO' },
  ],
  'a11-lm': [
    { nasaId: 'as11-40-5902', credit: N, caption: 'Buzz Aldrin walks near a leg of the lunar module; bootprints in front' },
    { nasaId: 'S69-39563', credit: N, caption: 'Armstrong and Aldrin by Eagle’s ladder, from the live TV broadcast' },
  ],
  'a12-lm': [
    { nasaId: 'AS12-46-6780', credit: N, caption: 'Alan Bean walks from the TV camera back toward the lunar module' },
    { nasaId: 'AS12-47-6949', credit: N, caption: 'The lunar module on the left; Surveyor 3 hides in the crater’s shadow, about 180 m away' },
  ],
  'a14-lm': [
    { nasaId: 'as14-66-09278', credit: N, caption: 'The Apollo 14 lunar module on the first moonwalk' },
    { nasaId: 'as14_66_09232', credit: N, caption: 'Alan Shepard by the flag, with the shadow of the lunar module around him' },
  ],
  'a15-lm': [
    { nasaId: '7120062', credit: N, caption: 'The Apollo 15 lunar module Falcon on the Moon' },
    { nasaId: 'S71-41511', credit: N, caption: 'Falcon seconds before its top half lifted off, seen by the rover’s TV camera' },
  ],
  'a16-lm': [
    { nasaId: 'as16-115-18549', credit: N, caption: 'Orion seen from far away, from the moving rover' },
    { nasaId: 'S72-35613', credit: N, caption: 'Orion lifting off, seen by the rover’s TV camera' },
  ],
  'a17-lm': [
    { nasaId: 'PIA12920', credit: LRO, view: 'orbit', caption: 'Challenger’s descent stage, still on the Moon, seen from orbit by LRO' },
    { nasaId: 'S72-55421', credit: N, caption: 'Challenger’s top half lifts off from Taurus-Littrow, seen by the rover’s TV camera' },
  ],
  'a15-lrv': [
    { nasaId: 'as15-86-11602', credit: N, caption: 'James Irwin at the rover; the laser mirror waits, still packed, on the lunar module' },
    { nasaId: '7022567', credit: N, caption: 'Dave Scott waits in the rover for the drive back to Falcon' },
  ],
  'a16-lrv': [
    { nasaId: 'as16-115-18559', credit: N, caption: 'John Young drives the rover to its last parking spot' },
    { nasaId: 'as16-116-18607', credit: N, caption: 'Charlie Duke at the front of the rover in a rock field near North Ray crater' },
  ],
  'a17-lrv': [
    { nasaId: 'as17-137-20979', credit: N, caption: 'Close-up of the rover with its taped-up fender repair' },
    { nasaId: 'as17-134-20476', credit: N, caption: 'Gene Cernan walks to the parked rover, South Massif behind' },
  ],
  'a11-lrrr': [
    { nasaId: 'as11-37-5551', credit: N, caption: 'The laser mirror (right) and the seismometer (far back), seen from inside the lunar module' },
    { nasaId: 'as11-40-5942', credit: N, caption: 'Buzz Aldrin carries the seismometer and, in his right hand, the laser mirror' },
  ],
  'a12-alsep': [
    { nasaId: 'as12-47-6919', credit: N, caption: 'Alan Bean sets up the science station on the first moonwalk' },
    { nasaId: 'as12-46-6807', credit: N, caption: 'Alan Bean carries the two science station packages away from the lunar module' },
  ],
  'a14-alsep': [
    { nasaId: 'as14-67-09361', credit: N, caption: 'The central station behind, a seismic experiment in front' },
    { nasaId: 'as14-67-09379', credit: N, caption: 'Close-up of the central station' },
  ],
  'a15-alsep': [
    { nasaId: 'S71-41422', credit: N, caption: 'Scientists in Mission Control study the seismometer reading from a rocket stage crashing into the Moon' },
  ],
  'a16-alsep': [
    { nasaId: 'as16-114-18388', credit: N, caption: 'John Young at the science station site, the experiments behind him' },
  ],
  'a17-alsep': [
    { nasaId: 'as17-147-22548', credit: N, caption: 'A geophone flag in front; the science station and the rover behind' },
  ],

  // ── Mars ─────────────────────────────────────
  'viking-1': [
    { nasaId: 'PIA00563', credit: JPL, caption: 'The first color picture from Viking Lander 1' },
    { nasaId: 'PIA00567', credit: JPL, caption: 'Sunset at the Viking Lander 1 site' },
  ],
  'viking-2': [
    { nasaId: 'PIA00568', credit: JPL, caption: 'The first color picture of the Viking Lander 2 site' },
  ],
  pathfinder: [
    { nasaId: 'PIA00608', credit: JPL, caption: 'Landing day: Sojourner still sitting on one of the lander’s solar panels' },
  ],
  sojourner: [
    { nasaId: 'PIA01568', credit: JPL, caption: 'Sojourner driving away from a rock' },
    { nasaId: 'PIA01137', credit: JPL, caption: 'Sojourner’s wheel tracks in the soft soil' },
  ],
  spirit: [
    { nasaId: 'PIA12007', credit: JPL, caption: 'Spirit’s wheels half buried in the soft ground where it got stuck, 2009' },
  ],
  opportunity: [
    { nasaId: 'PIA07108', credit: JPL, caption: 'Frost on Opportunity' },
    { nasaId: 'PIA08812', credit: JPL, view: 'orbit', caption: 'Opportunity at the rim of Victoria crater, seen from orbit' },
  ],
  phoenix: [
    { nasaId: 'PIA11379', credit: 'NASA/JPL-Caltech/UA/Texas A&M', caption: 'Underneath the Phoenix lander' },
  ],
  curiosity: [
    { nasaId: 'PIA23624', credit: 'NASA/JPL-Caltech/MSSS', caption: 'Curiosity’s selfie at the “Hutton” drill hole, 2020' },
    { nasaId: 'PIA22960', credit: 'NASA/JPL-Caltech/MSSS', caption: 'A dusty selfie at “Rock Hall” on Vera Rubin Ridge, during a dust storm' },
  ],
  insight: [
    { nasaId: 'PIA23301', credit: 'NASA/JPL-Caltech', caption: 'Two pits dug by InSight’s thrusters as it landed' },
    { nasaId: 'PIA22201', credit: 'NASA/JPL-Caltech/Lockheed Martin', caption: 'InSight opens its solar panels in a test on Earth, before launch' },
  ],
  perseverance: [
    { nasaId: 'KSC-20200402-PH-JPL01_0002', credit: N, caption: 'Wheels go on Perseverance at Kennedy Space Center, March 2020' },
  ],
  ingenuity: [
    { nasaId: 'PIA23882', credit: 'NASA/JPL-Caltech', caption: 'Ingenuity, the helicopter that flew on Mars, before launch' },
    { nasaId: 'PIA23969', credit: 'NASA/JPL-Caltech', caption: 'Ingenuity’s underside, with its two cameras' },
  ],
  'three-forks': [
    { nasaId: 'PIA25736', credit: 'NASA/JPL-Caltech/ASU/MSSS', caption: 'The finished sample depot, stitched from 368 pictures' },
    { nasaId: 'PIA25340', credit: 'NASA/JPL-Caltech', caption: 'The 10th and last tube, just dropped at Three Forks' },
  ],

  // ── Deep Space ───────────────────────────────
  'pioneer-10': [
    { nasaId: 'ARC-1973-AC73-9279', credit: 'NASA Ames', caption: 'Jupiter’s moon Ganymede, photographed by Pioneer 10' },
    { nasaId: 'ARC-1973-AC73-9019', credit: 'NASA Ames', caption: 'Pioneer 10 in final assembly at TRW, California' },
  ],
  'voyager-2': [
    { nasaId: 'PIA18182', credit: JPL, caption: 'Uranus, photographed by Voyager 2 in 1986' },
    { nasaId: 'PIA21736', credit: JPL, caption: 'Engineers working on Voyager 2, March 1977' },
  ],
  'voyager-1': [
    { nasaId: 'PIA17464', credit: N, caption: 'Voyager 1 launches from Cape Canaveral, 5 September 1977' },
    { nasaId: 'A79-7021', credit: N, caption: 'Jupiter’s moon Europa, photographed by Voyager 1' },
  ],
  ulysses: [
    { nasaId: '90PC-1357', credit: N, caption: 'Ulysses and its two booster stages moved into the payload canister at Kennedy' },
    { nasaId: 's90-45985', credit: N, caption: 'Ulysses being spin-balanced so its antenna can keep pointing at Earth' },
  ],
  near: [
    { nasaId: 'PIA02900', credit: 'NASA/JHU-APL', view: 'orbit', caption: 'The “saddle” on Eros, photographed from 208 km away' },
  ],
  stardust: [
    { nasaId: 'PIA13943', credit: JPL, caption: 'The three small worlds Stardust visited: asteroid Annefrank, comet Wild 2, comet Tempel 1' },
    { nasaId: 'PIA03670', credit: N, caption: 'Stardust’s capsule full of comet dust, lifted at its landing site in Utah' },
  ],
  spitzer: [
    { nasaId: 'PIA04265', credit: 'NASA/JPL-Caltech', caption: 'Final touches on the telescope before its 2003 launch' },
    { nasaId: 'PIA11796', credit: 'NASA/JPL-Caltech', caption: 'Galaxy Messier 101, seen by Spitzer in infrared light' },
  ],
  'deep-impact': [
    { nasaId: 'PIA02119', credit: 'NASA/JPL-Caltech/UMD', caption: 'The nucleus of comet Tempel 1, seen by the flyby spacecraft' },
  ],
  dawn: [
    { nasaId: 'PIA15384', credit: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA', caption: 'Sunrise on the giant asteroid Vesta, seen by Dawn' },
  ],
  kepler: [
    { nasaId: 'PIA11733', credit: 'NASA/Ball Aerospace', caption: 'Kepler at Ball Aerospace in Boulder, Colorado' },
  ],
}

/** Main photo first, then the extras, each with its file path. */
export function photosFor(id: string): (Photo & { src: string })[] {
  const main = PHOTOS[id]
  if (!main) return []
  return [
    { ...main, src: `/photos/${id}.jpg` },
    ...(EXTRA_PHOTOS[id] ?? []).map((p, i) => ({ ...p, src: `/photos/${id}-${i + 2}.jpg` })),
  ]
}
