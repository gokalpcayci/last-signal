// Cuts the recorded shots into the 30 s launch video:  bun edit.mjs en|tr [soundtrack.wav]
// Every cut sits on a beat at 120 BPM (0.5 s); each cut gets a 4-frame LED glitch hit.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

const lang = process.argv[2] === 'tr' ? 'tr' : 'en'
const audio = process.argv[3]
const FPS = 60
// [shot, in (s of the recording), length (s of output), speed, zoom]
const EDL = [
  ['hook', 0.0, 2.0],
  ['moon_intro', 0.4, 2.4, 1.25, 1.6],  // boot loader, punched in
  ['moon_intro', 3.4, 0.6, 1],     // logo lands in the nav, full frame
  ['moon_intro', 4.6, 2.0],        // terrain reveal, markers ping in
  ['a11', 0.2, 4.0],               // fly to Apollo 11 + story + photo
  ['silent', 0.0, 1.0],
  ['play', 0.3, 4.0, 1.2],        // 1966 → now time-lapse (already 3× in the recording)
  ['talking', 0.0, 1.0],
  ['mars_intro', 0.8, 1.5, 1.4],
  ['perseverance', 0.3, 2.5],
  ['deep_intro', 2.2, 2.0, 1.5],
  ['voyager', 0.3, 4.0, 1.1],
  ['end', 0.0, 3.0],
]

const args = ['-y', '-loglevel', 'error']
const chains = []
let t = 0
const cuts = []
EDL.forEach(([shot, inS, len, speed = 1, zoom = 1], i) => {
  const dir = `frames/${lang}/${shot}`
  const total = fs.readdirSync(dir).length
  const start = Math.round(inS * FPS)
  const need = Math.ceil(len * FPS * speed) + 1
  if (start + need > total) throw new Error(`${shot}: needs frames ${start}..${start + need}, has ${total}`)
  args.push('-framerate', String(FPS * speed), '-start_number', String(start), '-i', `${dir}/%05d.jpg`)
  const z = zoom > 1 ? `crop=iw/${zoom}:ih/${zoom},scale=1920:1080:flags=lanczos,setsar=1,` : ''
  chains.push(`[${i}:v]${z}fps=${FPS},trim=duration=${len},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`)
  if (i) cuts.push(t)
  t += len
})
const glitch = cuts.map((c) => `between(t,${c.toFixed(3)},${(c + 0.067).toFixed(3)})`).join('+')
const concat = EDL.map((_, i) => `[v${i}]`).join('') + `concat=n=${EDL.length}:v=1:a=0[cat]`
const grade = [
  `rgbashift=rh=-14:bh=14:gv=4:enable='${glitch}'`,
  `noise=alls=38:allf=t:enable='${glitch}'`,
  'eq=contrast=1.08:saturation=1.18:gamma=1.06',
  'noise=alls=4:allf=t',                      // a touch of film grain everywhere
  'vignette=angle=PI/5',
  `fade=t=in:st=0:d=0.25,fade=t=out:st=${(t - 0.4).toFixed(2)}:d=0.4`,
].join(',')
const filter = [...chains, concat, `[cat]${grade}[out]`].join(';')

if (audio) args.push('-i', audio)
fs.mkdirSync('out', { recursive: true })
const out = `out/lastsignal-launch-${lang}.mp4`
args.push('-filter_complex', filter, '-map', '[out]')
if (audio) args.push('-map', `${EDL.length}:a`, '-c:a', 'aac', '-b:a', '256k', '-af',
  // the score opens with a hard hit on beat 0, so trimming leading silence lines it up with frame 0
  // then -14 LUFS / -1.5 dBTP (the Ableton render peaks at +0.1 dBFS)
  `silenceremove=start_periods=1:start_threshold=-50dB,atrim=duration=${t},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,afade=t=out:st=${t - 0.6}:d=0.6`)
args.push('-t', String(t), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out)

const r = spawnSync('ffmpeg', args, { stdio: 'inherit' })
if (r.status) process.exit(r.status)
console.log(`${out}  ${t.toFixed(1)} s, cuts at ${cuts.join(' ')}`)
