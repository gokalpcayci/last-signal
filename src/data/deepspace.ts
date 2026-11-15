import type { Hardware } from './hardware'

// Deep Space hardware (Phase 3). Same shape as the Moon/Mars lists, but there is
// no ground: lat/lon are HELIOCENTRIC ECLIPTIC latitude/longitude (J2000, degrees,
// lon wrapped to −180…180) of where the craft is now, Sun at the center.
// The scene draws from public/deepspace/paths.json instead (real JPL Horizons
// vectors, rebuilt by scripts/build_deepspace.py); lat/lon here are a snapshot of
// that file for 2026-11-15 so lists/globe code that reads lat/lon still works.
// `au` = distance from the Sun on that date. For Stardust and Deep Impact, JPL's
// prediction ends (2011-03-12 / 2020-01-09): the position is the last one it gives.
// `arrived` = launch date (UTC); `year` = launch year.
// Fact-checked against science.nasa.gov / JPL (2026-11-15). Dawn lastSignal = NASA's
// end-of-mission date (first missed contact was 2018-10-31); Pioneer 11's last contact
// is given as 1995-11-24 (science ended 1995-09-30).
// NEAR now rides on asteroid Eros and Dawn circles Ceres: their position is the body's.

export interface DeepSpaceHardware extends Hardware {
  /** Distance from the Sun in AU (1 AU = Earth–Sun distance) */
  au: number
}

export const deepSpaceHardware: DeepSpaceHardware[] = [
  // ── Pioneers (1972–73) ───────────────────────────
  {
    id: 'pioneer-10', name: 'Pioneer 10', mission: 'Pioneer 10', kind: 'probe', status: 'silent',
    lat: 3.0, lon: 80.2, au: 142.2, year: 1972, site: 'Heading toward Aldebaran',
    arrived: '1972-03-03', lastSignal: '2003-01-23',
    story: 'The first spacecraft to fly through the asteroid belt and the first to visit Jupiter. Nobody knew if it would be smashed by space rocks on the way — it made it through safely.',
    didYouKnow: 'It carries a metal plaque with a drawing of two humans and a map showing where Earth is.',
    source: 'https://science.nasa.gov/mission/pioneer-10/',
  },
  {
    id: 'pioneer-11', name: 'Pioneer 11', mission: 'Pioneer 11', kind: 'probe', status: 'silent',
    lat: 13.8, lon: -75.3, au: 118.2, year: 1973, site: 'Heading toward Aquila',
    arrived: '1973-04-06', lastSignal: '1995-11-24',
    story: 'Pioneer 11 swung past Jupiter and then became the first spacecraft ever to visit Saturn. It flew past Saturn and its rings first, helping prepare the way for the Voyagers coming after it.',
    didYouKnow: 'It carries the same plaque as Pioneer 10 — a message in a bottle for anyone who finds it.',
    source: 'https://science.nasa.gov/mission/pioneer-11/',
  },

  // ── Voyagers (1977) ──────────────────────────────
  {
    id: 'voyager-2', name: 'Voyager 2', mission: 'Voyager 2', kind: 'probe', status: 'active',
    lat: -38.5, lon: -69.3, au: 144.5, year: 1977, site: 'Interstellar space',
    arrived: '1977-08-20', lastSignal: 'Still talking today',
    story: 'The only spacecraft that has ever visited Uranus and Neptune. After its grand tour of the giant planets it kept going, and in 2018 it left the Sun’s bubble and entered interstellar space.',
    didYouKnow: 'It carries a golden record with sounds and pictures from Earth — whale songs, music and greetings in 55 languages.',
    source: 'https://science.nasa.gov/mission/voyager/voyager-2/',
  },
  {
    id: 'voyager-1', name: 'Voyager 1', mission: 'Voyager 1', kind: 'probe', status: 'active',
    lat: 35.2, lon: -103.2, au: 172.4, year: 1977, site: 'Interstellar space',
    arrived: '1977-09-05', lastSignal: 'Still talking today',
    story: 'The farthest human-made object from Earth. In 2012 it became the first spacecraft to reach interstellar space — the space between the stars. It still sends messages home today.',
    didYouKnow: 'In 1990 it turned around and took the “Pale Blue Dot” photo: Earth as a tiny speck in a sunbeam.',
    source: 'https://science.nasa.gov/mission/voyager/voyager-1/',
  },

  // ── Ulysses (1990) ───────────────────────────────
  {
    id: 'ulysses', name: 'Ulysses', mission: 'Ulysses (ESA/NASA)', kind: 'probe', status: 'silent',
    lat: 70.9, lon: 14.5, au: 2.0, year: 1990, site: 'Orbit around the Sun',
    arrived: '1990-10-06', lastSignal: '2009-06-30',
    story: 'Ulysses was the first spacecraft to fly over the top and bottom of the Sun. To get there it zoomed out to Jupiter and used its gravity like a slingshot to tip its path up and out of the planets’ flat lane.',
    didYouKnow: 'It was built by Europe and launched by NASA from a Space Shuttle.',
    source: 'https://science.nasa.gov/mission/ulysses/',
  },

  // ── NEAR Shoemaker (1996) ────────────────────────
  {
    id: 'near', name: 'NEAR Shoemaker', mission: 'NEAR Shoemaker', kind: 'lander', status: 'silent',
    lat: -3.7, lon: -75.2, au: 1.8, year: 1996, site: 'On asteroid Eros',
    arrived: '1996-02-17', lastSignal: '2001-02-28',
    story: 'NEAR circled the potato-shaped asteroid Eros for a year. It was never built to land, but at the end the team gently steered it down — and it became the first spacecraft to land on an asteroid.',
    didYouKnow: 'It went into orbit around Eros on Valentine’s Day, 2000.',
    source: 'https://science.nasa.gov/mission/near-shoemaker/',
  },

  // ── Stardust (1999) ──────────────────────────────
  {
    id: 'stardust', name: 'Stardust', mission: 'Stardust', kind: 'probe', status: 'silent',
    lat: -2.2, lon: -79.9, au: 1.6, year: 1999, site: 'Orbit around the Sun',
    arrived: '1999-02-07', lastSignal: '2011-03-24',
    story: 'Stardust flew through the dusty cloud around comet Wild 2 and caught tiny grains in a super-light foam. It dropped the samples off at Earth in a capsule, then flew on to visit a second comet.',
    didYouKnow: 'The foam that caught the dust, called aerogel, is so light it is almost all air.',
    source: 'https://science.nasa.gov/mission/stardust/',
  },

  // ── Spitzer (2003) ───────────────────────────────
  {
    id: 'spitzer', name: 'Spitzer', mission: 'Spitzer Space Telescope', kind: 'telescope', status: 'silent',
    lat: -1.1, lon: -119.0, au: 1.0, year: 2003, site: 'Trailing behind Earth',
    arrived: '2003-08-25', lastSignal: '2020-01-30',
    story: 'Spitzer saw the universe in infrared — heat light our eyes can’t see. It peeked through dust clouds to watch stars being born and helped find seven Earth-sized planets around the star TRAPPIST-1.',
    didYouKnow: 'It follows Earth around the Sun and slowly falls farther behind every year.',
    source: 'https://science.nasa.gov/mission/spitzer/',
  },

  // ── Deep Impact (2005) ───────────────────────────
  {
    id: 'deep-impact', name: 'Deep Impact', mission: 'Deep Impact / EPOXI', kind: 'probe', status: 'silent',
    lat: -2.4, lon: 47.3, au: 1.1, year: 2005, site: 'Orbit around the Sun',
    arrived: '2005-01-12', lastSignal: '2013-08-08',
    story: 'On the 4th of July, 2005, Deep Impact fired a copper probe into comet Tempel 1 and watched the crash to see what was inside. Then it flew on and visited another comet, Hartley 2.',
    didYouKnow: 'The crash threw up a cloud of fine powder, showing the comet’s surface is very soft and dusty.',
    source: 'https://science.nasa.gov/mission/deep-impact-epoxi/',
  },

  // ── New Horizons (2006) ──────────────────────────
  {
    id: 'new-horizons', name: 'New Horizons', mission: 'New Horizons', kind: 'probe', status: 'active',
    lat: 2.0, lon: -71.5, au: 66.1, year: 2006, site: 'Kuiper Belt',
    arrived: '2006-01-19', lastSignal: 'Still talking today',
    story: 'New Horizons gave us our first close-up look at Pluto in 2015 — and found a giant heart-shaped plain of ice. Then it flew past Arrokoth, the most distant world any spacecraft has ever visited.',
    didYouKnow: 'It carries some of the ashes of Clyde Tombaugh, the astronomer who discovered Pluto.',
    source: 'https://science.nasa.gov/mission/new-horizons/',
  },

  // ── Dawn (2007) ──────────────────────────────────
  {
    id: 'dawn', name: 'Dawn', mission: 'Dawn', kind: 'probe', status: 'silent',
    lat: 2.6, lon: 94.2, au: 2.6, year: 2007, site: 'Orbit around Ceres',
    arrived: '2007-09-27', lastSignal: '2018-11-01',
    story: 'Dawn was the first spacecraft to orbit two different worlds beyond Earth: the giant asteroid Vesta and the dwarf planet Ceres. It used a gentle ion engine that pushed so softly it took days to speed up a little.',
    didYouKnow: 'When its fuel ran out it stayed in orbit around Ceres, where it will keep circling for decades.',
    source: 'https://science.nasa.gov/mission/dawn/',
  },

  // ── Kepler (2009) ────────────────────────────────
  {
    id: 'kepler', name: 'Kepler', mission: 'Kepler / K2', kind: 'telescope', status: 'silent',
    lat: 0.3, lon: -70.7, au: 1.1, year: 2009, site: 'Orbit around the Sun',
    arrived: '2009-03-07', lastSignal: '2018-11-15',
    story: 'Kepler stared at stars and watched for tiny dips in their light — the shadow of a planet passing in front. It found thousands of planets and showed that planets are everywhere — there are more planets than stars in our galaxy.',
    didYouKnow: 'It found more than 2,600 confirmed planets outside our solar system.',
    source: 'https://science.nasa.gov/mission/kepler/',
  },
]
