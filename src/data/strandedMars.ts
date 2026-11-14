import type { Scenario } from './stranded'

/**
 * "Stranded" on Mars. Same rules as the Moon story (see stranded.ts): the plot (Maya, her buggy
 * Dusty, the rescue hopper Swift) is made up and labelled as a story; every `fact` must be true.
 * It all happens in Jezero Crater, where Perseverance, Ingenuity and the Three Forks sample
 * depot really are, a few kilometres apart.
 */
export const MARS_STRANDED: Scenario = {
  astronaut: 'MAYA',
  pitch: [
    'An astronaut is stuck in Jezero Crater on Mars. You are mission control.',
    'Help MAYA get home using the hardware robots brought to Mars.',
  ],
  intro: [
    'A STORY MISSION. Maya Cruz was test-driving a new buggy, Dusty, across Jezero Crater.',
    'Dusty broke down. Its little radio can’t reach Earth, and the base is far away.',
    'You are mission control. Help Maya get home using the hardware robots brought to Mars.',
  ],
  lost: 'Maya’s oxygen got too low, so the rescue hopper Swift picked her up early. She is safe, but try again and guide her there yourself!',
  steps: [
    {
      call: 'Dusty is dead and my radio is too weak to reach Earth. How do I get a message out?',
      choices: [
        {
          label: 'Walk over to Perseverance',
          goTo: 'perseverance',
          good: true,
          reply: 'In our story, the rover team lets me send a short message through Perseverance. "Mission control, this is Maya. I’m OK!"',
          fact: 'Perseverance can send its data to Earth through spacecraft orbiting Mars, which pass the messages on.',
        },
        {
          label: 'Shout as loud as I can',
          good: false,
          reply: 'HELLO? …My voice sounds tiny out here.',
          fact: 'Mars does have air, but it is very thin, so sounds are much quieter than on Earth. Perseverance’s microphones have recorded them.',
        },
        {
          label: 'Wait for Earth to call me',
          good: false,
          reply: 'I waited and waited. Even if they called, the message would take ages to get here.',
          fact: 'Earth and Mars are so far apart that a radio message takes between about 5 and 20 minutes to make the trip.',
        },
      ],
    },
    {
      call: 'Earth got my message! A rescue hopper called Swift is coming, but it needs a flat, safe place to land. How do I find one?',
      choices: [
        {
          label: 'Use Ingenuity’s photos from the air',
          goTo: 'ingenuity',
          good: true,
          reply: 'Ingenuity’s pictures show a smooth patch nearby with no big rocks. I’ll send Swift there!',
          fact: 'The Ingenuity helicopter flew 72 times and took pictures from the air that helped the Perseverance team plan where to drive.',
        },
        {
          label: 'Cut straight across the sand dunes',
          good: false,
          reply: 'My boots sink into the soft ground. Getting out took a lot of air.',
          fact: 'In 2009 the rover Spirit got stuck in soft soil on Mars. Engineers tried for months, but it never drove out.',
        },
        {
          label: 'Climb the crater wall for a view',
          good: false,
          reply: 'The wall is far away and steep. I turned back before I got anywhere.',
          fact: 'Jezero Crater is about 45 kilometres wide. Billions of years ago it held a lake.',
        },
      ],
    },
    {
      call: 'The sky is turning orange. A dust storm is rolling in! What should I do?',
      choices: [
        {
          label: 'Shelter beside Perseverance and wait',
          goTo: 'perseverance',
          good: true,
          reply: 'I’m tucked in next to the rover, saving my air. The dust is thick, but the wind barely pushes me.',
          fact: 'In 2018 a dust storm grew so big it covered the whole planet and blocked the sunlight that the rover Opportunity needed for power.',
        },
        {
          label: 'Run before the wind knocks me over',
          good: false,
          reply: 'I ran out of breath for nothing. The wind hardly moved me at all.',
          fact: 'Martian winds can be fast, but the air is so thin that even a strong wind would only feel like a gentle breeze.',
        },
        {
          label: 'Wash the dust off my visor with water',
          good: false,
          reply: 'The water fizzed and vanished almost straight away!',
          fact: 'Liquid water can’t last long on the surface of Mars today, because the air is too thin.',
        },
      ],
    },
    {
      call: 'The storm has passed. On my way to the landing spot I found a row of shiny metal tubes on the ground. Should I take one home?',
      choices: [
        {
          label: 'Leave them right where they are',
          goTo: 'three-forks',
          good: true,
          reply: 'Got it, not touching. They’re lined up like a treasure cache, waiting for their ride.',
          fact: 'Perseverance dropped 10 sealed tubes here in 2022 and 2023, as a backup in case a future mission needs to pick up samples from the ground.',
        },
        {
          label: 'Open one to peek inside',
          goTo: 'three-forks',
          good: false,
          reply: '"Negative, Maya! Opening it would spoil the sample."',
          fact: 'Each tube was sealed tight so the rock or soil inside stays just as it was on the day it was collected.',
        },
        {
          label: 'Pocket one for the scientists',
          good: false,
          reply: '"Please put it back. Those belong to a much bigger mission."',
          fact: 'Scientists want to study Mars samples on Earth, where labs have tools far too big and complex to send to Mars.',
        },
      ],
    },
    {
      call: 'I can see Swift coming down! Before I climb aboard: should I leave something behind for the next explorers?',
      choices: [
        {
          label: 'A thank-you note',
          good: true,
          reply: '"Thank you, Perseverance and Ingenuity. You got me home." Climbing aboard now!',
          fact: 'Perseverance carries a small metal plate that thanks health care workers for their work during the COVID-19 pandemic.',
        },
        {
          label: 'My name, for the record',
          good: true,
          reply: 'I scratched MAYA WAS HERE on a rock. Climbing aboard!',
          fact: 'Perseverance carries chips with the names of about 10.9 million people who signed up online before it launched.',
        },
        {
          label: 'Nothing: keep Mars clean',
          good: true,
          reply: 'Footprints only. Jezero stays just the way the robots left it. Climbing aboard!',
          fact: 'NASA cleans its Mars spacecraft very carefully before launch, so germs from Earth don’t hitch a ride to Mars.',
        },
      ],
    },
  ],
}
