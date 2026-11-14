import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LedEngine } from '../brand/ledEngine'
import { hardware } from '../data/hardware'
import { finishIntro, markBooted, markProgress, useProgress, useSceneReady } from '../boot'

/**
 * Page-open loader: "signal acquisition".
 * The LED mark boots, the 22 objects left on the Moon wake up in landing order (green = still
 * answering, orange = gone quiet), and a mission-control log types out real load steps.
 * When the terrain has drawn its first frame, the mark flies into the nav logo's spot and the
 * terrain's own boot reveal takes over. Click or any key skips.
 */

const byArrival = [...hardware].sort((a, b) => a.arrived.localeCompare(b.arrived))
const ACTIVE = hardware.filter((h) => h.status === 'active').length
const SILENT = hardware.length - ACTIVE
const FIRST_YEAR = byArrival[0].arrived.slice(0, 4)
const LAST_YEAR = byArrival[byArrival.length - 1].arrived.slice(0, 4)

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// timeline (ms after mount)
const T_LINE = [150, 650, 1300, 2350]
const DOTS_START = 700
const DOT_STEP = 65
const MIN_SHOW = 2600     // never shorter than the logo intro + dots
const GIVE_UP = 9000      // data never came: open anyway
const ACQUIRED_HOLD = 450 // "SIGNAL ACQUIRED" stays this long before the fly-out
const FLY_MS = 750

const BAR = 12
const bar = (p: number) => {
  const n = Math.round(p * BAR)
  return `${'█'.repeat(n)}${'░'.repeat(BAR - n)} ${String(Math.round(p * 100)).padStart(3)}%`
}

type Phase = 'run' | 'acquired' | 'fly' | 'gone'

/** One typed log line: types out once, in as many steps as it has characters. */
function Line({ children }: { children: React.ReactNode }) {
  const el = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const e = el.current
    if (e && !e.style.getPropertyValue('--n')) e.style.setProperty('--n', String(e.textContent?.length ?? 0))
  })
  return <span ref={el} className="boot__line">{children}</span>
}

export default function BootLoader() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<LedEngine | null>(null)
  const [phase, setPhase] = useState<Phase>('run')
  const [lines, setLines] = useState(0)
  const [weak, setWeak] = useState(false)
  const [shown, setShown] = useState(0)   // displayed progress (eased)
  const [minDone, setMinDone] = useState(false)
  const ready = useSceneReady()
  const progress = useProgress()
  const rm = useRef(reduced()).current

  // LED mark: same coarse grid as the nav logo, so the fly-out lands pixel for pixel
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const e = new LedEngine(c, { grid: 'coarse', mode: 'boot', glitch: 1 })
    engine.current = e
    e.resize(Math.round(Math.min(220, window.innerWidth * 0.56)))
    let alive = true
    e.play('intro').then(() => { if (alive) e.play('loop') })
    return () => { alive = false; e.destroy(); engine.current = null }
  }, [])

  // log lines + minimum time + give-up timer
  useEffect(() => {
    const ts = T_LINE.map((t, i) => setTimeout(() => setLines(i + 1), rm ? 0 : t))
    ts.push(setTimeout(() => setMinDone(true), rm ? 600 : MIN_SHOW))
    ts.push(setTimeout(() => setWeak(true), GIVE_UP))
    document.fonts?.ready.then(() => markProgress(0.12))
    return () => ts.forEach(clearTimeout)
  }, [rm])

  // eased progress readout; creeps a little while waiting so it never looks frozen,
  // but never past 60% until the elevation data has actually arrived
  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    const tick = () => {
      const creep = Math.min(0.6, (performance.now() - t0) / 4000)
      const target = Math.max(progress, Math.min(creep, progress < 0.7 ? 0.6 : 1))
      setShown((s) => (Math.abs(target - s) < 0.004 ? target : s + (target - s) * 0.12))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [progress])

  // ready (or gave up) and shown long enough → "SIGNAL ACQUIRED", then fly
  useEffect(() => {
    if (phase !== 'run' || !minDone || !(ready || weak)) return
    setPhase('acquired')
  }, [phase, minDone, ready, weak])
  useEffect(() => {
    if (phase !== 'acquired') return
    const t = setTimeout(() => setPhase('fly'), rm ? 150 : ACQUIRED_HOLD)
    return () => clearTimeout(t)
  }, [phase, rm])

  // skip: click / tap / any key
  useEffect(() => {
    if (phase === 'fly' || phase === 'gone') return
    const skip = () => setPhase('fly')
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [phase])

  // fly the mark into the nav logo's box (FLIP), fade the rest, then hand off
  useEffect(() => {
    if (phase !== 'fly') return
    markBooted()   // the terrain reveal grows underneath while we leave
    const c = canvas.current
    const target = document.querySelector<HTMLElement>('.nav .logo')
    const a = c?.getBoundingClientRect()
    const b = target?.getBoundingClientRect()
    engine.current?.play('ambient')
    if (c && a && b && b.width > 0 && !rm) {
      const s = b.width / a.width
      c.style.transformOrigin = '0 0'
      c.style.transition = `transform ${FLY_MS}ms cubic-bezier(.65,0,.25,1)`
      c.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${s})`
    }
    const t = setTimeout(() => { finishIntro(); setPhase('gone') }, rm || !b?.width ? 250 : FLY_MS)
    return () => clearTimeout(t)
  }, [phase, rm])

  if (phase === 'gone') return null

  const p = phase === 'run' ? shown : 1
  const acquired = phase !== 'run'
  return (
    <div
      className={`boot boot--${phase}${rm ? ' boot--still' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={acquired ? 'Signal acquired' : 'Loading the Moon'}
      onPointerDown={() => { if (phase === 'run' || phase === 'acquired') setPhase('fly') }}
    >
      <div className="boot__center">
        <canvas ref={canvas} className="boot__logo" aria-hidden />

        <div className="boot__fade">
          <div className="boot__wake" aria-hidden>
            {byArrival.map((h, i) => (
              <span
                key={h.id}
                className={`boot__dot boot__dot--${h.status}`}
                style={{ animationDelay: `${(DOTS_START + i * DOT_STEP) / 1000}s` }}
              />
            ))}
          </div>
          <div className="boot__years" aria-hidden><span>{FIRST_YEAR}</span><span>{LAST_YEAR}</span></div>

          <pre className="boot__log">
            {lines > 0 && <Line><i>&gt;</i> POWERING UP GROUND STATION</Line>}
            {lines > 1 && <Line><i>&gt;</i> LISTENING FOR {hardware.length} THINGS LEFT ON THE MOON</Line>}
            {lines > 2 && <Line><i>&gt;</i> LOADING MOON MAP {bar(p)}</Line>}
            {lines > 3 && (
              <Line>
                <i>&gt;</i> <b className="ok">{ACTIVE} STILL ANSWER</b> · <b className="warn">{SILENT} WENT QUIET</b>
              </Line>
            )}
            {acquired && (
              <Line>
                <i>&gt;</i> {weak && !ready ? 'WEAK SIGNAL — OPENING ANYWAY' : 'SIGNAL ACQUIRED'}<span className="boot__cursor">▌</span>
              </Line>
            )}
          </pre>
        </div>
      </div>
      <div className="boot__skip boot__fade" aria-hidden>CLICK OR PRESS ANY KEY TO SKIP</div>
    </div>
  )
}
