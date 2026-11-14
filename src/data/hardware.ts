export type HardwareStatus = 'active' | 'silent'
export type HardwareKind = 'lander' | 'rover' | 'science' | 'reflector' | 'robot'

export interface Hardware {
  id: string
  name: string
  mission: string
  kind: HardwareKind
  status: HardwareStatus
  lat: number
  lon: number
  /** Year it was left on the Moon */
  year: number
  site: string
  arrived: string
  lastSignal: string
  /** Kid-friendly story, mission-control voice */
  story: string
  didYouKnow: string
  source: string
}

const NSSDC = 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id='

export const hardware: Hardware[] = [
  // ── Surveyor landers ─────────────────────────────
  {
    id: 'surveyor-1', name: 'Surveyor 1', mission: 'Surveyor 1', kind: 'robot', status: 'silent',
    lat: -2.47, lon: -43.34, year: 1966, site: 'Oceanus Procellarum',
    arrived: '1966-06-02', lastSignal: '1967-01-07',
    story: 'The first American spacecraft to land gently on the Moon. Before Surveyor 1, nobody knew if the ground was solid enough to stand on — some scientists worried a lander would sink into deep dust. It sent home more than 11,000 photos.',
    didYouKnow: 'Its landing proved the lunar surface could hold up a spacecraft — a big green light for Apollo.',
    source: NSSDC + '1966-045A',
  },
  {
    id: 'surveyor-3', name: 'Surveyor 3', mission: 'Surveyor 3', kind: 'robot', status: 'silent',
    lat: -3.02, lon: -23.42, year: 1967, site: 'Ocean of Storms',
    arrived: '1967-04-20', lastSignal: '1967-05-04',
    story: 'Surveyor 3 bounced twice before settling down, then used a little robotic scoop to dig trenches in the soil. Two and a half years later, Apollo 12 astronauts walked over and visited it.',
    didYouKnow: 'Astronauts cut off its camera and brought it back to Earth — it is now in a museum.',
    source: 'https://science.nasa.gov/mission/surveyor-3/',
  },
  {
    id: 'surveyor-5', name: 'Surveyor 5', mission: 'Surveyor 5', kind: 'robot', status: 'silent',
    lat: 1.41, lon: 23.18, year: 1967, site: 'Mare Tranquillitatis',
    arrived: '1967-09-11', lastSignal: '1967-12-17',
    story: 'Surveyor 5 carried a tiny chemistry lab that tested what the Moon is made of. The answer: dark volcanic rock called basalt, a lot like rock from volcanoes on Earth.',
    didYouKnow: 'It landed only about 25 km from where Apollo 11 would touch down two years later.',
    source: NSSDC + '1967-084A',
  },
  {
    id: 'surveyor-6', name: 'Surveyor 6', mission: 'Surveyor 6', kind: 'robot', status: 'silent',
    lat: 0.49, lon: -1.43, year: 1967, site: 'Sinus Medii',
    arrived: '1967-11-10', lastSignal: '1967-12-14',
    story: 'Mission control fired Surveyor 6’s engines and it hopped about 2.5 meters into the air and landed again — the first time anything ever lifted off from the Moon.',
    didYouKnow: 'That little hop let it photograph its own footprints in the soil.',
    source: NSSDC + '1967-112A',
  },
  {
    id: 'surveyor-7', name: 'Surveyor 7', mission: 'Surveyor 7', kind: 'robot', status: 'silent',
    lat: -40.97, lon: -11.44, year: 1968, site: 'Near Tycho crater',
    arrived: '1968-01-10', lastSignal: '1968-02-21',
    story: 'The last Surveyor landed in the rugged highlands near the giant crater Tycho, far from the flat “seas”. Its rock samples looked very different from the dark plains.',
    didYouKnow: 'It spotted laser beams fired from Earth — a sneak preview of laser experiments to come.',
    source: NSSDC + '1968-001A',
  },

  // ── Apollo Lunar Module descent stages ───────────
  {
    id: 'a11-lm', name: 'Eagle (descent stage)', mission: 'Apollo 11', kind: 'lander', status: 'silent',
    lat: 0.674, lon: 23.473, year: 1969, site: 'Tranquility Base',
    arrived: '1969-07-20', lastSignal: '1969-07-21',
    story: 'The bottom half of Eagle stayed behind as a launch pad when Neil Armstrong and Buzz Aldrin blasted off. It is where humans first stepped onto another world.',
    didYouKnow: 'A plaque on its leg reads: “We came in peace for all mankind.”',
    source: NSSDC + '1969-059C',
  },
  {
    id: 'a12-lm', name: 'Intrepid (descent stage)', mission: 'Apollo 12', kind: 'lander', status: 'silent',
    lat: -3.012, lon: -23.422, year: 1969, site: 'Ocean of Storms',
    arrived: '1969-11-19', lastSignal: '1969-11-20',
    story: 'Apollo 12 practiced a pinpoint landing — it set down about 180 meters from Surveyor 3, a robot that had been waiting there since 1967.',
    didYouKnow: 'This was the first time astronauts visited an earlier spacecraft on another world.',
    source: NSSDC + '1969-099C',
  },
  {
    id: 'a14-lm', name: 'Antares (descent stage)', mission: 'Apollo 14', kind: 'lander', status: 'silent',
    lat: -3.645, lon: -17.471, year: 1971, site: 'Fra Mauro',
    arrived: '1971-02-05', lastSignal: '1971-02-06',
    story: 'Apollo 14 landed in the hilly Fra Mauro region to collect rocks thrown out by a huge ancient impact.',
    didYouKnow: 'Astronaut Alan Shepard hit two golf balls here.',
    source: NSSDC + '1971-008C',
  },
  {
    id: 'a15-lm', name: 'Falcon (descent stage)', mission: 'Apollo 15', kind: 'lander', status: 'silent',
    lat: 26.132, lon: 3.634, year: 1971, site: 'Hadley–Apennine',
    arrived: '1971-07-30', lastSignal: '1971-08-02',
    story: 'Falcon landed between tall mountains and a winding canyon called Hadley Rille. The crew found the “Genesis Rock”, one of the oldest pieces of the Moon ever collected.',
    didYouKnow: 'The crew dropped a hammer and a feather at the same time — with no air, they hit the ground together.',
    source: NSSDC + '1971-063C',
  },
  {
    id: 'a16-lm', name: 'Orion (descent stage)', mission: 'Apollo 16', kind: 'lander', status: 'silent',
    lat: -8.973, lon: 15.5, year: 1972, site: 'Descartes Highlands',
    arrived: '1972-04-21', lastSignal: '1972-04-24',
    story: 'Apollo 16 was the only mission to land in the bright highlands, the oldest parts of the Moon’s crust.',
    didYouKnow: 'Astronaut Charlie Duke left a family photo on the surface.',
    source: NSSDC + '1972-031C',
  },
  {
    id: 'a17-lm', name: 'Challenger (descent stage)', mission: 'Apollo 17', kind: 'lander', status: 'silent',
    lat: 20.191, lon: 30.772, year: 1972, site: 'Taurus–Littrow',
    arrived: '1972-12-11', lastSignal: '1972-12-14',
    story: 'The last time humans stood on the Moon. Geologist-astronaut Harrison Schmitt discovered bright orange soil — tiny glass beads made by ancient volcanic fire fountains.',
    didYouKnow: 'No human has been back to the Moon’s surface since December 1972.',
    source: NSSDC + '1972-096C',
  },

  // ── Lunar Roving Vehicles ────────────────────────
  {
    id: 'a15-lrv', name: 'Lunar Roving Vehicle 1', mission: 'Apollo 15', kind: 'rover', status: 'silent',
    lat: 26.13, lon: 3.66, year: 1971, site: 'Hadley–Apennine',
    arrived: '1971-07-31', lastSignal: '1971-08-02',
    story: 'The first car on the Moon! The battery-powered buggy folded up like origami to fit on the lander, then let astronauts drive far beyond walking range.',
    didYouKnow: 'It drove about 28 km in total. Parked forever, its TV camera filmed the crew’s liftoff.',
    source: NSSDC + '1971-063C',
  },
  {
    id: 'a16-lrv', name: 'Lunar Roving Vehicle 2', mission: 'Apollo 16', kind: 'rover', status: 'silent',
    lat: -8.98, lon: 15.52, year: 1972, site: 'Descartes Highlands',
    arrived: '1972-04-21', lastSignal: '1972-04-24',
    story: 'This rover carried John Young and Charlie Duke across the dusty highlands, bouncing over craters on wire-mesh wheels instead of rubber tires.',
    didYouKnow: 'Rubber tires would crack in the Moon’s extreme cold and heat — so the wheels were made of woven piano wire.',
    source: NSSDC + '1972-031C',
  },
  {
    id: 'a17-lrv', name: 'Lunar Roving Vehicle 3', mission: 'Apollo 17', kind: 'rover', status: 'silent',
    lat: 20.19, lon: 30.80, year: 1972, site: 'Taurus–Littrow',
    arrived: '1972-12-11', lastSignal: '1972-12-14',
    story: 'The final moon buggy drove the farthest of all, about 36 km. When a fender broke, the crew fixed it with maps, duct tape and clamps.',
    didYouKnow: 'Its camera recorded the very last liftoff of humans from the Moon.',
    source: NSSDC + '1972-096C',
  },

  // ── Laser retroreflectors (still in use!) ────────
  {
    id: 'a11-lrrr', name: 'Laser Retroreflector', mission: 'Apollo 11', kind: 'reflector', status: 'active',
    lat: 0.69, lon: 23.45, year: 1969, site: 'Tranquility Base',
    arrived: '1969-07-21', lastSignal: 'Still in use today',
    story: 'A panel of 100 special mirrors that bounce light straight back to where it came from. Observatories on Earth fire lasers at it and time the echo.',
    didYouKnow: 'Thanks to these mirrors we know the Moon drifts about 3.8 cm farther from Earth every year.',
    source: NSSDC + '1969-059C',
  },
  {
    id: 'a14-lrrr', name: 'Laser Retroreflector', mission: 'Apollo 14', kind: 'reflector', status: 'active',
    lat: -3.64, lon: -17.48, year: 1971, site: 'Fra Mauro',
    arrived: '1971-02-05', lastSignal: 'Still in use today',
    story: 'Another mirror panel — more than 50 years later it still needs no power and still works. Scientists use it to test Einstein’s theory of gravity.',
    didYouKnow: 'The laser echo comes back about 2.5 seconds after it is fired.',
    source: NSSDC + '1971-008C',
  },
  {
    id: 'a15-lrrr', name: 'Laser Retroreflector', mission: 'Apollo 15', kind: 'reflector', status: 'active',
    lat: 26.14, lon: 3.63, year: 1971, site: 'Hadley–Apennine',
    arrived: '1971-07-31', lastSignal: 'Still in use today',
    story: 'The biggest Apollo mirror array, with 300 reflectors. It is the favorite target for laser stations on Earth because it sends back the strongest echo.',
    didYouKnow: 'Measurements are precise to a few millimeters — across 384,000 km!',
    source: NSSDC + '1971-063C',
  },

  // ── ALSEP science stations ───────────────────────
  {
    id: 'a12-alsep', name: 'ALSEP Science Station', mission: 'Apollo 12', kind: 'science', status: 'silent',
    lat: -3.0, lon: -23.44, year: 1969, site: 'Ocean of Storms',
    arrived: '1969-11-19', lastSignal: '1977-09-30',
    story: 'A nuclear-battery-powered science station. When the empty lunar module was crashed into the Moon on purpose, its seismometer felt the Moon “ring like a bell” for almost an hour.',
    didYouKnow: 'NASA switched off all ALSEP stations on 30 September 1977 to save money.',
    source: NSSDC + '1969-099C',
  },
  {
    id: 'a14-alsep', name: 'ALSEP Science Station', mission: 'Apollo 14', kind: 'science', status: 'silent',
    lat: -3.66, lon: -17.46, year: 1971, site: 'Fra Mauro',
    arrived: '1971-02-05', lastSignal: '1977-09-30',
    story: 'This station listened for moonquakes and measured the thin stream of particles from the Sun hitting the surface.',
    didYouKnow: 'The Moon has quakes too — some caused by Earth’s gravity squeezing it.',
    source: NSSDC + '1971-008C',
  },
  {
    id: 'a15-alsep', name: 'ALSEP Science Station', mission: 'Apollo 15', kind: 'science', status: 'silent',
    lat: 26.12, lon: 3.62, year: 1971, site: 'Hadley–Apennine',
    arrived: '1971-07-31', lastSignal: '1977-09-30',
    story: 'Besides a seismometer, this station drilled into the ground to measure heat flowing up from the Moon’s interior.',
    didYouKnow: 'Together the Apollo seismometers recorded thousands of moonquakes and meteorite hits.',
    source: NSSDC + '1971-063C',
  },
  {
    id: 'a16-alsep', name: 'ALSEP Science Station', mission: 'Apollo 16', kind: 'science', status: 'silent',
    lat: -8.99, lon: 15.49, year: 1972, site: 'Descartes Highlands',
    arrived: '1972-04-21', lastSignal: '1977-09-30',
    story: 'Part of a network of listening posts spread across the Moon, so scientists could pinpoint where each moonquake came from.',
    didYouKnow: 'Data from these stations is still being studied with modern computers today.',
    source: NSSDC + '1972-031C',
  },
  {
    id: 'a17-alsep', name: 'ALSEP Science Station', mission: 'Apollo 17', kind: 'science', status: 'silent',
    lat: 20.2, lon: 30.76, year: 1972, site: 'Taurus–Littrow',
    arrived: '1972-12-12', lastSignal: '1977-09-30',
    story: 'The last Apollo station measured gravity, the Moon’s tiny atmosphere and the heat inside the ground.',
    didYouKnow: 'The Moon does have an atmosphere — but it is so thin it is almost nothing.',
    source: NSSDC + '1972-096C',
  },
]

export const kindLabel: Record<HardwareKind, string> = {
  lander: 'Lander',
  rover: 'Rover',
  science: 'Science station',
  reflector: 'Laser mirror',
  robot: 'Robotic lander',
}
