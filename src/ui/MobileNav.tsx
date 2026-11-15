import { useState } from 'react'
import PlanetIcon from './PlanetIcon'
import TextEffect from './TextEffect'
import { WORLDS, type WorldId } from '../scene/planets'
import LangSwitch from './LangSwitch'
import { useT } from '../strings'
import { up } from '../i18n'
import './mobileNav.css'

/**
 * Phone / stacked-layout drawer: two steps instead of everything at once.
 *   1 · worlds      — one row: small LED disc + name + how much is left there
 *   2 · filters     — "‹ MOON" back button + that world's chips in one sideways-scrolling row
 * Kept short on purpose: the drawer pushes the map down, so each step is one row (+ a header).
 * Opening the drawer always starts at step 1. Picking a world switches the map right away
 * (so you see it behind the drawer) and slides to step 2; picking a filter closes the drawer.
 * The hidden step is `inert`, so keyboard and screen readers only reach the visible one.
 */

export type NavFilter = { id: string; label: string }

type Props = {
  open: boolean
  world: WorldId
  counts: Record<WorldId, number>
  filters: NavFilter[]
  filter: string
  onWorld: (id: WorldId) => void
  onFilter: (id: string) => void
  onCredits: () => void
}

const WORLD_IDS = Object.keys(WORLDS) as WorldId[]
const DISC = 26

export default function MobileNav({ open, world, counts, filters, filter, onWorld, onFilter, onCredits }: Props) {
  const t = useT()
  const [step, setStep] = useState<1 | 2>(1)
  // every time the drawer opens, start again at step 1 (adjust during render: no extra frame)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) { setWasOpen(open); if (open) setStep(1) }

  const name = up(t.world.label[world])
  return (
    <div className={`mnav mnav--step${step}`}>
      <div className="mnav__track">
        <section className="mnav__step" inert={step !== 1} aria-label={t.nav.step1}>
          <div className="mnav__worlds">
            {WORLD_IDS.map((id, i) => (
              <button key={id} className={`mnav__world${id === world ? ' is-on' : ''}`} aria-pressed={id === world}
                style={{ '--i': i } as React.CSSProperties}
                onClick={() => { onWorld(id); setStep(2) }}>
                <PlanetIcon id={id} active={id === world} size={DISC} />
                <span className="mnav__name">
                  {up(t.world.label[id])}
                  <small>{t.nav.objects(counts[id])}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="mnav__meta">
            <LangSwitch />
            <button className="meta__credits" onClick={onCredits}>{t.nav.credits}</button>
          </div>
        </section>

        <section className="mnav__step" inert={step !== 2} aria-label={t.nav.step2(t.world.label[world])}>
          <div className="mnav__head">
            <button className="mnav__back" onClick={() => setStep(1)} aria-label={t.nav.back}>
              <span aria-hidden>‹</span> {step === 2 ? <TextEffect key={world}>{name}</TextEffect> : name}
            </button>
            <div className="mnav__label">{t.nav.whatToShow}</div>
          </div>
          <ul className="mnav__chips">
            {filters.map((f, i) => (
              <li key={f.id} style={{ '--i': i } as React.CSSProperties}>
                <button className={filter === f.id ? 'is-on' : ''} aria-pressed={filter === f.id} onClick={() => onFilter(f.id)}>
                  {up(f.label)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
