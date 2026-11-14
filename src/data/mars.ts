import type { Hardware } from './hardware'

// Mars hardware (Phase 2). Same shape as the Moon list in hardware.ts.
// lat: planetocentric degrees north; lon: degrees east, wrapped to −180…180
// (Mars maps usually quote 0…360 °E — subtract 360 above 180).
// `year` = year it reached Mars.
// Landing sites match NASA GISS Mars24 (giss.nasa.gov/tools/mars24/help/landers.html);
// NSSDC lists pre-landing nominal targets for some (e.g. Pathfinder 19.33 N 33.55 W).
// Ingenuity and Three Forks have no published NASA coordinates: approximate
// positions near Perseverance's landing site. Ingenuity lastSignal = final
// downlink NASA documented (mission ended 2024-01-25).

const NSSDC = 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id='

export const marsHardware: Hardware[] = [
  // ── Viking (1976) ────────────────────────────────
  {
    id: 'viking-1', name: 'Viking 1 Lander', mission: 'Viking 1', kind: 'robot', status: 'silent',
    lat: 22.27, lon: -47.95, year: 1976, site: 'Chryse Planitia',
    arrived: '1976-07-20', lastSignal: '1982-11-13',
    story: 'The first spacecraft to land safely on Mars and do its job. It took the first photo from the surface of Mars — just seconds after landing — and tested the soil for signs of tiny living things.',
    didYouKnow: 'It kept working for more than six years, far longer than its 90-day plan.',
    source: NSSDC + '1975-075C',
  },
  {
    id: 'viking-2', name: 'Viking 2 Lander', mission: 'Viking 2', kind: 'robot', status: 'silent',
    lat: 47.67, lon: 134.28, year: 1976, site: 'Utopia Planitia',
    arrived: '1976-09-03', lastSignal: '1980-04-11',
    story: 'Viking 2 landed on a flat, rocky plain much farther north than its twin. Its cameras watched the seasons change through two Martian winters.',
    didYouKnow: 'It photographed a thin layer of frost on the ground around it.',
    source: NSSDC + '1975-083C',
  },

  // ── Mars Pathfinder (1997) ───────────────────────
  {
    id: 'pathfinder', name: 'Pathfinder Lander', mission: 'Mars Pathfinder', kind: 'robot', status: 'silent',
    lat: 19.13, lon: -33.22, year: 1997, site: 'Ares Vallis',
    arrived: '1997-07-04', lastSignal: '1997-09-27',
    story: 'Pathfinder fell to Mars wrapped in giant airbags and bounced across the ground before rolling to a stop. Then it opened up like a flower and let a little rover drive out.',
    didYouKnow: 'It was renamed the Carl Sagan Memorial Station after the famous astronomer.',
    source: NSSDC + '1996-068A',
  },
  {
    id: 'sojourner', name: 'Sojourner', mission: 'Mars Pathfinder', kind: 'rover', status: 'silent',
    lat: 19.13, lon: -33.22, year: 1997, site: 'Ares Vallis',
    arrived: '1997-07-04', lastSignal: '1997-09-27',
    story: 'The first wheeled rover on another planet — about the size of a microwave oven. It drove slowly from rock to rock, sniffing out what each one was made of.',
    didYouKnow: 'It talked to Earth through the lander, so when the lander went quiet, Sojourner went quiet too.',
    source: 'https://science.nasa.gov/mission/mars-pathfinder/',
  },

  // ── Mars Exploration Rovers (2004) ───────────────
  {
    id: 'spirit', name: 'Spirit', mission: 'Mars Exploration Rover A', kind: 'rover', status: 'silent',
    lat: -14.57, lon: 175.48, year: 2004, site: 'Gusev Crater',
    arrived: '2004-01-04', lastSignal: '2010-03-22',
    story: 'Spirit explored a giant crater that may once have held a lake. Even with a broken wheel, it kept going, dragging the stuck wheel along.',
    didYouKnow: 'The stuck wheel scraped up bright white soil — proof that hot water once flowed there.',
    source: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
  },
  {
    id: 'opportunity', name: 'Opportunity', mission: 'Mars Exploration Rover B', kind: 'rover', status: 'silent',
    lat: -1.95, lon: -5.53, year: 2004, site: 'Meridiani Planum',
    arrived: '2004-01-25', lastSignal: '2018-06-10',
    story: 'Opportunity was built to drive for 90 days. It kept going for more than 14 years and rolled farther than a marathon. A huge dust storm finally blocked out the Sun that charged its batteries.',
    didYouKnow: 'It found tiny round pebbles nicknamed “blueberries” that formed in water.',
    source: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
  },

  // ── Phoenix (2008) ───────────────────────────────
  {
    id: 'phoenix', name: 'Phoenix Lander', mission: 'Phoenix', kind: 'robot', status: 'silent',
    lat: 68.22, lon: -125.75, year: 2008, site: 'Vastitas Borealis',
    arrived: '2008-05-25', lastSignal: '2008-11-02',
    story: 'Phoenix landed in the icy far north of Mars and dug with a robotic arm. White bits in its trench slowly disappeared over a few days — water ice turning straight into vapor.',
    didYouKnow: 'As the long polar winter set in, its solar panels ran out of sunlight, and it was never heard from again.',
    source: NSSDC + '2007-034A',
  },

  // ── Curiosity (2012) ─────────────────────────────
  {
    id: 'curiosity', name: 'Curiosity', mission: 'Mars Science Laboratory', kind: 'rover', status: 'active',
    lat: -4.59, lon: 137.44, year: 2012, site: 'Gale Crater',
    arrived: '2012-08-06', lastSignal: 'Still driving today',
    story: 'A rover the size of a small car, lowered to the ground on ropes by a hovering “sky crane”. It is climbing a tall mountain in the middle of Gale Crater, reading the rock layers like pages of a history book.',
    didYouKnow: 'It found that Gale Crater once had a lake where tiny life could have lived.',
    source: 'https://science.nasa.gov/mission/msl-curiosity/',
  },

  // ── InSight (2018) ───────────────────────────────
  {
    id: 'insight', name: 'InSight Lander', mission: 'InSight', kind: 'science', status: 'silent',
    lat: 4.50, lon: 135.62, year: 2018, site: 'Elysium Planitia',
    arrived: '2018-11-26', lastSignal: '2022-12-15',
    story: 'InSight did not drive or dig for life — it listened. Its super-sensitive seismometer felt “marsquakes” and helped scientists map the inside of Mars, all the way down to its core.',
    didYouKnow: 'It recorded more than 1,300 marsquakes before dust covered its solar panels.',
    source: 'https://science.nasa.gov/mission/insight/',
  },

  // ── Mars 2020 (2021) ─────────────────────────────
  {
    id: 'perseverance', name: 'Perseverance', mission: 'Mars 2020', kind: 'rover', status: 'active',
    lat: 18.44, lon: 77.45, year: 2021, site: 'Jezero Crater',
    arrived: '2021-02-18', lastSignal: 'Still driving today',
    story: 'Perseverance is exploring an old river delta inside Jezero Crater. It drills rock cores and seals them in tubes, hoping a future mission can bring them back to Earth.',
    didYouKnow: 'It carried a microphone, so we can hear the wind on Mars.',
    source: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
  },
  {
    id: 'ingenuity', name: 'Ingenuity', mission: 'Mars 2020', kind: 'helicopter', status: 'silent',
    lat: 18.47, lon: 77.39, year: 2021, site: 'Jezero Crater',
    arrived: '2021-02-18', lastSignal: '2024-04-16',
    story: 'A tiny helicopter that rode to Mars under Perseverance’s belly. It was planned to fly 5 times — it flew 72 times, until a damaged rotor blade grounded it for good.',
    didYouKnow: 'It was the first aircraft to make a powered, controlled flight on another planet.',
    source: 'https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/',
  },
  {
    id: 'three-forks', name: 'Three Forks Sample Depot', mission: 'Mars 2020', kind: 'science', status: 'active',
    lat: 18.45, lon: 77.45, year: 2023, site: 'Jezero Crater',
    arrived: '2023-01-28', lastSignal: 'Waiting for pickup',
    story: 'Perseverance dropped 10 sealed tubes on the ground — rock and soil samples, one of Martian air and one empty “witness” tube —, one by one, like a treasure cache. They are a backup in case a future mission needs to collect samples from the ground.',
    didYouKnow: 'The first sample depot ever built on another planet.',
    source: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
  },
]
