// Launch soundtrack score (120 BPM, D minor, 60 beats = 30 s). Prints note lists per track as JSON.
// Beat map = video cuts: 0 hook · 4 boot · 10 moon · 22 "silent" · 24 PLAY · 32 "talking" · 34 Mars · 42 deep · 54 end
const n = (pitch, start, duration, velocity = 100) => ({ pitch, start_time: start, duration, velocity: Math.round(velocity), mute: false })
const CH = { Dm: [50, 53, 57], Bb: [46, 50, 53], F: [45, 48, 53], C: [48, 52, 55] }
const ROOT = { Dm: 38, Bb: 34, F: 41, C: 36 }
const ARP = { Dm: [62, 69, 74, 65], Bb: [58, 65, 70, 62], F: [65, 72, 77, 69], C: [60, 67, 72, 64] }
// chord per bar (4 beats): bars 0..14
const BAR = ['Dm', 'Dm', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'Dm', 'Bb', 'F', 'C', 'C', 'Dm']
const chordAt = (b) => BAR[Math.min(14, Math.floor(b / 4))]
const silent = (b) => (b >= 22 && b < 24) || (b >= 32 && b < 34)
const range = (a, z, step) => { const r = []; for (let x = a; x < z - 1e-6; x += step) r.push(+x.toFixed(4)); return r }

const pad = [n(38, 0, 10, 70), n(45, 0, 10, 60)]
for (const [a, z] of [[10, 12], [12, 16], [16, 20], [20, 22], [24, 28], [28, 32], [34, 36], [36, 40], [40, 44], [44, 48], [48, 52], [52, 54]])
  CH[chordAt(a)].forEach((p) => pad.push(n(p, a, z - a, 72)))
;[50, 53, 57, 64].forEach((p) => pad.push(n(p, 54, 6, 80)))

const bass = [n(26, 0, 4, 100), n(26, 4, 6, 90)]
for (const b of range(10, 54, 0.5)) if (!silent(b)) bass.push(n(ROOT[chordAt(b)], b, 0.42, b % 1 === 0 ? 112 : 88))
bass.push(n(26, 54, 6, 120), n(38, 54, 3, 100))

const arp = []
for (const b of range(4, 54, 0.25)) {
  if (silent(b)) continue
  const k = Math.round(b * 4) % 4
  const vel = b < 10 ? 35 + (b - 4) * 6 : b < 24 ? 80 : 95
  arp.push(n(ARP[chordAt(b)][k], b, 0.2, vel))
}

const blink = (at, p = 81, v = 110) => [n(p, at, 0.2, v), n(p, at + 0.25, 0.2, v - 10), n(p, at + 0.5, 0.2, v - 20)]
const ping = [
  ...blink(0), ...blink(2),
  n(86, 4, 1, 100), n(86, 10, 1, 110),
  n(74, 22, 0.5, 110), n(69, 22.5, 0.5, 100), n(62, 23, 1, 95),          // silent: falling, orange
  ...blink(32), ...blink(33), n(86, 34, 1, 115),                        // talking: the 3-blink signal
  n(86, 42, 1, 110), ...blink(46, 86, 100),                             // deep space PING
  n(74, 54, 3, 120), n(81, 54, 3, 115), n(86, 54, 3, 110), ...blink(57, 81, 95),
]

const K = 36, SN = 38, CL = 39, HH = 42, CR = 49
const drums = []
for (const b of range(12, 54, 1)) if (!silent(b) && !(b >= 22 && b < 24)) drums.push(n(K, b, 0.25, 120))
drums.push(n(K, 22, 0.5, 127), n(K, 32, 0.5, 127), n(K, 54, 0.5, 127))
for (const b of range(24, 54, 1)) if (!silent(b) && Math.round(b) % 2 === 1) drums.push(n(CL, b, 0.25, 105))
for (const b of range(12, 22, 0.5)) if (b % 1) drums.push(n(HH, b, 0.12, 80))
for (const b of [...range(24, 32, 0.25), ...range(36, 54, 0.25)]) drums.push(n(HH, b, 0.1, b % 1 === 0.5 ? 95 : 60))
for (const b of range(20, 22, 0.25)) drums.push(n(SN, b, 0.12, 60 + (b - 20) * 30))
for (const b of range(52, 54, 0.125)) drums.push(n(SN, b, 0.1, 55 + (b - 52) * 35))
for (const b of [10, 24, 34, 42, 54]) drums.push(n(CR, b, 2, 115))

console.log(JSON.stringify({ pad, bass, arp, ping, drums }))
