/**
 * The two astronauts who walked on the Moon at each Apollo landing (commander first,
 * then lunar module pilot). Source: NASA Apollo program pages; the idea of showing
 * them comes from Uygar Yıldırım's Offworld Archive. Keyed by `Hardware.mission`.
 */
export const MOONWALKERS: Record<string, [string, string]> = {
  'Apollo 11': ['Neil Armstrong', 'Buzz Aldrin'],
  'Apollo 12': ['Pete Conrad', 'Alan Bean'],
  'Apollo 14': ['Alan Shepard', 'Edgar Mitchell'],
  'Apollo 15': ['David Scott', 'James Irwin'],
  'Apollo 16': ['John Young', 'Charles Duke'],
  'Apollo 17': ['Eugene Cernan', 'Harrison Schmitt'],
}
