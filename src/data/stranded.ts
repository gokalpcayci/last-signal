import type { PlanetId } from '../scene/planets'
import { MARS_STRANDED } from './strandedMars'

/**
 * "Stranded" — a short choice game in the bottom-left panel, one scenario per body.
 * The scenario (Leo, his lander Hopper, the rescue lander Kestrel) is made up and labelled as a
 * story in the UI. Every `fact` line must be true: keep them to things NASA has published, and
 * keep them in the app's kid-friendly voice.
 * The whole story happens at the real Apollo 15 site at Hadley, where a laser mirror, a rover,
 * a science station and a descent stage really do sit close together.
 */

export interface Choice {
  label: string
  /** what Leo says back */
  reply: string
  /** a true fact revealed by this choice */
  fact: string
  /** true = the mission moves on; false = a detour that costs oxygen, then you choose again */
  good: boolean
  /** hardware id the map flies to */
  goTo?: string
}

export interface Step {
  /** Leo's radio call that sets up the problem */
  call: string
  choices: Choice[]
}

export interface Scenario {
  /** call sign shown in the log */
  astronaut: string
  /** two short lines on the start screen */
  pitch: string[]
  /** opening log lines once the mission starts */
  intro: string[]
  /** what happens when oxygen runs out (always gentle) */
  lost: string
  steps: Step[]
}

/** oxygen: start, cost of every step, extra cost of a detour */
export const O2 = { start: 100, step: 8, detour: 12 }

const MOON_INTRO = [
  'A STORY MISSION. Leo Park was testing a new mini lander, Hopper, near the old Apollo 15 site at Hadley.',
  'Hopper landed hard. Its radio is broken, and the base is far away.',
  'You are mission control. Help Leo get home using the things astronauts left behind.',
]

const MOON_STEPS: Step[] = [
  {
    call: 'Hopper is dead. My radio is broken and nobody on Earth knows I am OK. How do I get a message out?',
    choices: [
      {
        label: 'Walk to the Apollo 15 laser mirror',
        goTo: 'a15-lrrr',
        good: true,
        reply: 'Found it! I will cover and uncover the mirror with my glove: short, short, short, long, long, long… If anyone is firing a laser at it right now, the light coming back will blink SOS.',
        fact: 'Apollo astronauts left three of these mirrors, and all three still work. Scientists on Earth bounce laser light off them to measure how far away the Moon is.',
      },
      {
        label: 'Shout into the broken radio',
        good: false,
        reply: 'HELLO? Hello…? Nothing. Not even an echo.',
        fact: 'There is no air on the Moon, so sound cannot travel. Even a shout right next to you would be silent.',
      },
      {
        label: 'Write SOS in the moon dust',
        good: false,
        reply: 'Done, big letters! …Although from Earth they would look smaller than a grain of sand.',
        fact: 'With no wind or rain, marks in moon dust can stay for a very long time. Astronaut footprints from 1969 are still there.',
      },
    ],
  },
  {
    call: 'Earth saw the blinking! A rescue lander called Kestrel is on its way. But the Sun is fierce and my suit is getting hot. Where can I cool down?',
    choices: [
      {
        label: 'Sit in the shadow of Falcon',
        goTo: 'a15-lm',
        good: true,
        reply: 'Ahh, shade. Falcon’s old bottom half makes a perfect sunshade. Suit temperature dropping.',
        fact: 'When an Apollo crew blasted off, the bottom half of their lunar module stayed behind as a launch pad. Falcon’s has stood here since 1971.',
      },
      {
        label: 'Climb down into Hadley Rille',
        good: false,
        reply: 'Whoa, the walls are steep and the rocks slide. Climbing back up used a lot of air.',
        fact: 'Hadley Rille is a long, winding canyon. Apollo 15 landed right beside it so the crew could study it.',
      },
      {
        label: 'Dig a hole and hide in it',
        good: false,
        reply: 'The dust gets into everything: my gloves, my knees, my visor. Bad idea.',
        fact: 'Moon dust is made of tiny sharp bits of rock and glass. It sticks to everything and scratched the astronauts’ suits.',
      },
    ],
  },
  {
    call: 'Kestrel wants to talk to me before it lands, but my radio battery is flat. Is there any power around here?',
    choices: [
      {
        label: 'Try the old science station',
        goTo: 'a15-alsep',
        good: true,
        reply: 'In our story, its little power unit still gives off a trickle of warmth: just enough to wake my radio. "Kestrel, Leo here. I hear you!"',
        fact: 'Each Apollo science station ran on a small nuclear power unit and sent data to Earth for years, until NASA switched them all off on 30 September 1977.',
      },
      {
        label: 'Use the rover’s batteries',
        goTo: 'a15-lrv',
        good: false,
        reply: 'Completely empty. I can’t get a spark out of them.',
        fact: 'The Apollo rovers ran on batteries that could not be recharged. They ran out decades ago.',
      },
      {
        label: 'Make a fire to warm the battery',
        good: false,
        reply: 'I struck rock on rock for ages. Not a single flame.',
        fact: 'Fire needs oxygen from the air. The Moon has no air, so nothing can burn there.',
      },
    ],
  },
  {
    call: 'Kestrel can only land on flat, clear ground, three kilometres from here. How do I find a safe way there?',
    choices: [
      {
        label: 'Follow the 1971 rover tracks',
        goTo: 'a15-lrv',
        good: true,
        reply: 'The tracks are still here, and they follow the flat ground. I just walk in the wheel marks!',
        fact: 'With no wind or rain, the rovers’ tire tracks are still on the Moon. A NASA spacecraft in orbit has photographed tracks like these at the Apollo sites.',
      },
      {
        label: 'Take a shortcut over the rocks',
        good: false,
        reply: 'Boulders everywhere. I had to turn back. That cost me air.',
        fact: 'Landing spots must be flat and clear. During Apollo 11, Neil Armstrong flew past a field of boulders to find a safe place to land.',
      },
      {
        label: 'Wait for Kestrel to come to me',
        good: false,
        reply: '"Negative, Leo. Too many rocks there. We need you at the flat ground."',
        fact: 'Apollo landers came down on four legs and needed fairly level ground. Too much slope could have tipped them over.',
      },
    ],
  },
  {
    call: 'I see Kestrel! Before I climb aboard: should I leave something behind for the next explorers?',
    choices: [
      {
        label: 'A note saying thank you',
        good: true,
        reply: '"Thank you, Apollo 15. Your mirror, your shade and your tracks got me home." Climbing aboard now!',
        fact: 'The Apollo 15 crew left a tiny statue called Fallen Astronaut and a plaque here, to remember astronauts who had died.',
      },
      {
        label: 'A family photo',
        good: true,
        reply: 'A photo of my family, propped against a rock. Now somebody is always watching over Hadley. Climbing aboard!',
        fact: 'Apollo 16 astronaut Charlie Duke really did leave a family photo on the Moon in 1972.',
      },
      {
        label: 'Nothing: leave no trace',
        good: true,
        reply: 'Footprints only. Hadley stays the way the Apollo 15 crew left it. Climbing aboard!',
        fact: 'People who plan future Moon missions want to protect the Apollo sites, because they are part of history.',
      },
    ],
  },
]

export const STRANDED: Record<PlanetId, Scenario> = {
  moon: {
    astronaut: 'LEO',
    pitch: [
      'An astronaut is stuck near the old Apollo 15 site. You are mission control.',
      'Help LEO get home using the hardware astronauts left behind.',
    ],
    intro: MOON_INTRO,
    lost: 'Leo’s oxygen got too low, so Kestrel picked him up early. He is safe, but try again and guide him there yourself!',
    steps: MOON_STEPS,
  },
  mars: MARS_STRANDED,
}
