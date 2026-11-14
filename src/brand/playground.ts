import { LedEngine, type GlitchKind, type LedMode, type LedPhase } from './ledEngine'

// Logo lab (logo.html): try every mode/phase and record the demo-video intro.
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T
const canvas = $<HTMLCanvasElement>('#logo')
const word = $<HTMLDivElement>('#word')
const status = $<HTMLDivElement>('#status')

const engine = new LedEngine(canvas, { grid: 'fine', mode: 'random' })
let mode: LedMode = 'random'
let run = 0 // cancels an in-flight demo sequence when another action starts

const fit = () => engine.resize(Math.min(760, window.innerWidth - 32))
fit()
window.addEventListener('resize', fit)

const show = (phase: string) => { status.textContent = `MODE ${mode.toUpperCase()} · PHASE ${phase.toUpperCase()}` }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function demo() {
  const id = ++run
  word.classList.remove('on')
  engine.play('off')
  await wait(400)
  if (id !== run) return
  show('intro')
  await engine.play('intro')
  if (id !== run) return
  word.classList.add('on')
  show('ambient')
  engine.play('ambient')
}

document.querySelectorAll<HTMLButtonElement>('#modes button').forEach((b) =>
  b.addEventListener('click', () => {
    mode = b.dataset.mode as LedMode
    document.querySelectorAll('#modes button').forEach((x) => x.classList.toggle('on', x === b))
    engine.set({ mode })
    demo()
  }),
)

document.querySelectorAll<HTMLButtonElement>('#phases button').forEach((b) =>
  b.addEventListener('click', async () => {
    run++
    const phase = b.dataset.phase as LedPhase | 'flash'
    if (phase === 'flash') { engine.flash(mode); return }
    word.classList.toggle('on', phase !== 'outro')
    show(phase)
    await engine.play(phase)
  }),
)

$('#demo').addEventListener('click', demo)
window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); demo() } })

const speed = $<HTMLInputElement>('#speed')
speed.addEventListener('input', () => {
  engine.set({ speed: +speed.value })
  $('#spv').textContent = `${(+speed.value).toFixed(1)}×`
})
const glitch = $<HTMLInputElement>('#glitch')
glitch.addEventListener('input', () => {
  engine.set({ glitch: +glitch.value })
  $('#glv').textContent = (+glitch.value).toFixed(1)
})
$('#glitchNow').addEventListener('click', () => engine.glitch(performance.now(), 'tear', 1))
document.querySelectorAll<HTMLButtonElement>('[data-g]').forEach((b) =>
  b.addEventListener('click', () => engine.glitch(performance.now(), b.dataset.g as GlitchKind)),
)
$<HTMLInputElement>('#signals').addEventListener('change', (e) => engine.set({ signals: (e.target as HTMLInputElement).checked }))
$<HTMLInputElement>('#coarse').addEventListener('change', (e) => engine.set({ grid: (e.target as HTMLInputElement).checked ? 'coarse' : 'fine' }))

demo()
