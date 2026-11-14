import { useEffect, useRef, useState } from 'react'
import { hardware } from '../data/hardware'
import { marsHardware } from '../data/mars'
import { O2, STRANDED } from '../data/stranded'
import type { PlanetId } from '../scene/planets'

/**
 * Bottom-left panel: "Stranded", a short choice game, one scenario per body (src/data/stranded*.ts).
 * You are mission control; each choice flies the map to the real hardware the astronaut uses.
 * Detours cost extra oxygen and reveal a fact; running out is gentle (an early pickup). Key by planet.
 */

type Line = { who: 'leo' | 'you' | 'fact' | 'sys'; text: string }
type Phase = 'intro' | 'play' | 'won' | 'lost'

const O2_CELLS = 10
const o2Bar = (v: number) => {
  const lit = Math.round((Math.max(0, v) / O2.start) * O2_CELLS)
  return '▓'.repeat(lit) + '░'.repeat(O2_CELLS - lit)
}
const ALL = [...hardware, ...marsHardware]
const nameOf = (id: string) => {
  const h = ALL.find((x) => x.id === id)!
  const name = h.name.replace(/\s*\(.*\)/, '')
  return h.mission === name || h.mission.endsWith(` ${name}`) ? name : `${h.mission} ${name}`
}

export default function StrandedGame({ planet, onSelect }: { planet: PlanetId; onSelect: (id: string) => void }) {
  const { astronaut: ASTRONAUT, pitch, intro: INTRO, lost, steps: STEPS } = STRANDED[planet]
  const [phase, setPhase] = useState<Phase>('intro')
  const [step, setStep] = useState(0)
  const [o2, setO2] = useState(O2.start)
  const [log, setLog] = useState<Line[]>([])
  const [tried, setTried] = useState<number[]>([]) // detours already taken on this step
  const [visited, setVisited] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }) }, [log, phase])

  const start = () => {
    setPhase('play'); setStep(0); setO2(O2.start); setTried([]); setVisited([])
    setLog([...INTRO.map((text) => ({ who: 'sys' as const, text })), { who: 'leo', text: STEPS[0].call }])
  }

  const choose = (i: number) => {
    if (phase !== 'play' || tried.includes(i)) return
    const c = STEPS[step].choices[i]
    const lines: Line[] = [{ who: 'you', text: c.label }, { who: 'leo', text: c.reply }, { who: 'fact', text: c.fact }]
    if (c.goTo) { onSelect(c.goTo); setVisited((v) => (v.includes(c.goTo!) ? v : [...v, c.goTo!])) }
    const left = o2 - (c.good ? O2.step : O2.detour)
    setO2(left)

    if (left <= 0) {
      lines.push({ who: 'sys', text: lost })
      setPhase('lost')
    } else if (!c.good) {
      setTried((t) => [...t, i])
    } else if (step + 1 < STEPS.length) {
      lines.push({ who: 'leo', text: STEPS[step + 1].call })
      setStep(step + 1); setTried([])
    } else {
      setPhase('won')
    }
    setLog((l) => [...l, ...lines])
  }

  // number keys 1–3 pick a choice while the panel has focus
  const onKey = (e: React.KeyboardEvent) => {
    const n = Number(e.key)
    if (phase === 'play' && n >= 1 && n <= STEPS[step].choices.length) choose(n - 1)
  }

  const low = o2 <= 30
  return (
    <div className="panel game" tabIndex={-1} onKeyDown={onKey}>
      <div className="game__head">
        <div className="panel__title">Stranded <span className="game__tag">[STORY]</span></div>
        {phase !== 'intro' && (
          <span className={`game__o2 ${low ? 'warn' : 'ok'}`} aria-label={`Oxygen ${Math.max(0, o2)} percent`}>
            O₂ {o2Bar(o2)} {Math.max(0, o2)}%
          </span>
        )}
      </div>

      <div className="game__log" ref={logRef} aria-live="polite">
        {phase === 'intro' ? (
          <div className="game__intro">
            {pitch.map((t) => <p key={t}>{t}</p>)}
          </div>
        ) : log.map((l, i) => (
          <p key={i} className={`game__line game__line--${l.who}`}>
            {l.who === 'leo' && <b>{ASTRONAUT}&gt;</b>}
            {l.who === 'you' && <b>MC&gt;</b>}
            {l.who === 'fact' && <b>FACT&gt;</b>}
            {' '}{l.text}
          </p>
        ))}
        {phase === 'won' && (
          <div className="game__end">
            <p className="ok">MISSION COMPLETE · {ASTRONAUT} IS ON THE WAY HOME · O₂ LEFT {o2}%</p>
            <p>You used {visited.length} pieces of old hardware: {visited.map((id, i) => (
              <span key={id}>{i > 0 && ', '}<button className="game__ref" onClick={() => onSelect(id)}>{nameOf(id)}</button></span>
            ))}. Abandoned, but not forgotten.</p>
          </div>
        )}
      </div>

      <div className="game__choices">
        {phase === 'intro' && <button className="game__go" onClick={start}>[ START MISSION ]</button>}
        {phase === 'play' && STEPS[step].choices.map((c, i) => (
          <button key={i} onClick={() => choose(i)} disabled={tried.includes(i)}>
            <b>[{i + 1}]</b> {c.label}
          </button>
        ))}
        {(phase === 'won' || phase === 'lost') && <button className="game__go" onClick={start}>[ PLAY AGAIN ]</button>}
        {phase === 'play' && <span className="game__step">STEP {step + 1}/{STEPS.length}</span>}
      </div>
    </div>
  )
}
