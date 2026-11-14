import { useEffect, useMemo, useRef, useState } from 'react'
import MoonScene from './scene/MoonScene'
import Globe from './ui/Globe'
import { STACKED_QUERY } from './layout'
import SunNow from './ui/SunNow'
import { hardware, kindLabel, type HardwareKind } from './data/hardware'
import {
  IconArrowRight, IconFilter, IconChevronLeft, IconChevronRight, IconCompass,
  IconPulse, IconShuffle,
} from './ui/icons'
import NavEdge from './ui/NavEdge'
import { LedLogo } from './ui/LedLogo'
import SignalChart, { ARRIVAL_ORDER, arrivedCount } from './ui/SignalChart'
import StrandedGame from './ui/StrandedGame'
import { EXAGGERATION } from './scene/terrain'

type Filter = 'all' | HardwareKind
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All hardware' },
  { id: 'lander', label: 'Landers' },
  { id: 'rover', label: 'Rovers' },
  { id: 'science', label: 'Science stations' },
  { id: 'reflector', label: 'Laser mirrors' },
  { id: 'robot', label: 'Robot landers' },
]
const COLS = ['A', 'B', 'C', 'D', 'E', 'F']
const ROWS = ['1', '2', '3', '4', '5']

/** Thin circle gauge with a needle at the value — the reference's top-right dial. */
function Gauge({ value }: { value: number }) {
  const C = 2 * Math.PI * 16
  const a = -Math.PI / 2 + value * Math.PI * 2
  return (
    <svg className="gauge" viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="16" className="gauge__track" />
      <circle cx="20" cy="20" r="16" className="gauge__val" strokeDasharray={`${value * C} ${C}`} transform="rotate(-90 20 20)" />
      <line x1={20 + Math.cos(a) * 10} y1={20 + Math.sin(a) * 10} x2={20 + Math.cos(a) * 16} y2={20 + Math.sin(a) * 16} className="gauge__needle" />
    </svg>
  )
}

const fmtDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : s

export default function App() {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  // smaller logo in the stacked layout so the nav takes less vertical space
  const [stacked, setStacked] = useState(() => window.matchMedia(STACKED_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(STACKED_QUERY)
    const on = () => setStacked(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  /** chart playhead (decimal year); null = today, nothing hidden */
  const [until, setUntil] = useState<number | null>(null)
  const [trueScale, setTrueScale] = useState(false)
  const currentFilter = FILTERS.find((f) => f.id === filter)?.label ?? 'All hardware'
  const rightRef = useRef<HTMLElement>(null)

  // Stacked (phone) layout: the story sits below the 3D view. Let the camera fly first, then bring the story into view.
  useEffect(() => {
    if (!selectedId || !window.matchMedia(STACKED_QUERY).matches) return
    const t = setTimeout(() => rightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 900)
    return () => clearTimeout(t)
  }, [selectedId])

  // time travel: only what had landed by the playhead (keyed by count, so scrolling within a gap doesn't rebuild the scene)
  const landed = until == null ? ARRIVAL_ORDER.length : arrivedCount(until)
  const items = useMemo(() => {
    const ok = new Set(ARRIVAL_ORDER.slice(0, landed))
    return hardware.filter((h) => (filter === 'all' || h.kind === filter) && ok.has(h.id))
  }, [filter, landed])
  const selected = hardware.find((h) => h.id === selectedId) ?? null
  const active = hardware.filter((h) => h.status === 'active').length

  return (
    <div className="page">
      <div className="frame">

        {/* coordinate grid */}
        <div className="grid" aria-hidden>
          {COLS.map((c, i) => <span key={c} className="grid__col" style={{ left: `${(i / 5) * 100}%` }}>{c}</span>)}
          {COLS.map((c, i) => <span key={`b${c}`} className="grid__col grid__col--bottom" style={{ left: `${(i / 5) * 100}%` }}>{c}</span>)}
          {ROWS.map((r, i) => <span key={r} className="grid__row" style={{ top: `${(i / 4) * 100}%` }}>{r}</span>)}
          {ROWS.map((r, i) => <span key={`r${r}`} className="grid__row grid__row--right" style={{ top: `${(i / 4) * 100}%` }}>{r}</span>)}
          {[1, 2, 3, 4].map((i) => <div key={i} className="grid__v" style={{ left: `${(i / 5) * 100}%` }} />)}
          {[1, 2, 3].map((i) => <div key={i} className="grid__h" style={{ top: `${(i / 4) * 100}%` }} />)}
          <div className="hatch hatch--a" />
          <div className="hatch hatch--b" />
        </div>

        <div className="scene">
          <MoonScene items={items} selectedId={selectedId} onSelect={setSelectedId} trueScale={trueScale} />
        </div>

        {/* top-left: logo + nav */}
        <aside className={`nav${navOpen ? ' is-open' : ''}`}>
          <div className="nav__bar">
            <LedLogo className="logo" width={stacked ? 56 : 84} />
            {/* phones: one compact row; tap to expand the filter row */}
            <button className="nav__toggle" aria-expanded={navOpen} aria-controls="nav-filters" aria-label={`Filter hardware (now: ${currentFilter})`} title={currentFilter} onClick={() => setNavOpen((o) => !o)}>
              <IconFilter />
            </button>
          </div>
          <div className="nav__drawer" id="nav-filters">
            <div className="nav__drawer-inner">
              <ul>
                {FILTERS.map((f, i) => (
                  <li key={f.id} style={{ '--i': i } as React.CSSProperties}>
                    <button className={filter === f.id ? 'is-on' : ''} onClick={() => { setFilter(f.id); setSelectedId(null); setNavOpen(false) }}>
                      {filter === f.id ? `[${f.label.toUpperCase()}]` : f.label.toUpperCase()}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="nav__soon">MARS · DEEP SPACE — SOON</div>
            </div>
          </div>
          <NavEdge />
        </aside>

        {/* right column: stat + globe, or story */}
        <section className="right" ref={rightRef}>
          {selected ? (
            <div className="story">
              <div className="story__head">
                <span className={`pill pill--${selected.status}`}>{selected.status === 'active' ? 'STILL WORKING' : 'SILENT'}</span>
                <button className="close" onClick={() => setSelectedId(null)}>×</button>
              </div>
              <div className="story__mission">{selected.mission.toUpperCase()} · {kindLabel[selected.kind].toUpperCase()}</div>
              <h2>{selected.name}</h2>
              <dl>
                <dt>Site</dt><dd>{selected.site}</dd>
                <dt>Arrived</dt><dd>{fmtDate(selected.arrived)}</dd>
                <dt>Last signal</dt><dd>{fmtDate(selected.lastSignal)}</dd>
                <dt>Coords</dt><dd>{selected.lat.toFixed(2)}°, {selected.lon.toFixed(2)}°</dd>
              </dl>
              <SunNow lat={selected.lat} lon={selected.lon} name={selected.mission} />
              <p>{selected.story}</p>
              <div className="dyk"><span>DID YOU KNOW?</span>{selected.didYouKnow}</div>
              <a href={selected.source} target="_blank" rel="noreferrer">NASA RECORD →</a>
            </div>
          ) : (
            <>
              <div className="stat">
                <div>
                  <div className="stat__num">{hardware.length}<small> objects</small></div>
                  <div className="stat__label">Left on the Moon</div>
                </div>
                <Gauge value={active / hardware.length} />
              </div>
              <button className="view" onClick={() => setSelectedId('a11-lm')}>Start at Apollo 11 <IconArrowRight /></button>
              <Globe items={items} selectedId={selectedId} />
            </>
          )}
        </section>

        {/* toolbar */}
        <div className="toolbar">
          <button title="Overview" aria-label="Overview" className={selectedId ? '' : 'is-on'} onClick={() => setSelectedId(null)}><IconPulse /></button>
          <button title="Previous" aria-label="Previous" onClick={() => {
            const i = items.findIndex((h) => h.id === selectedId)
            setSelectedId(items[(i - 1 + items.length) % items.length]?.id ?? null)
          }}><IconChevronLeft /></button>
          <button title="Next" aria-label="Next" onClick={() => {
            const i = items.findIndex((h) => h.id === selectedId)
            setSelectedId(items[(i + 1) % items.length]?.id ?? null)
          }}><IconChevronRight /></button>
          <button title="Random" aria-label="Random" onClick={() => setSelectedId(items[Math.floor(Math.random() * items.length)]?.id ?? null)}><IconShuffle /></button>
          <button title="Start tour at Apollo 11" aria-label="Start tour" className={selectedId ? 'is-on' : ''} onClick={() => setSelectedId('a11-lm')}><IconCompass /></button>
          <button
            className={`toolbar__scale${trueScale ? ' is-on' : ''}`}
            aria-pressed={trueScale}
            title={trueScale ? 'True scale: the Moon is really this flat' : `Mountains are stretched ×${EXAGGERATION} so you can see them. Click for true scale`}
            onClick={() => setTrueScale((v) => !v)}
          >{trueScale ? '1:1' : `×${EXAGGERATION}`}</button>
        </div>

        {/* bottom row */}
        <section className="bottom">
          <StrandedGame onSelect={setSelectedId} />

          <div className="panel radar">
            <div className="blip blip--g" style={{ left: '22%', top: '25%' }} />
            <div className="blip blip--o" style={{ left: '60%', top: '58%' }} />
            <div className="signal">
              {selected ? `Last signal: ${fmtDate(selected.lastSignal)}` : 'Listening for signals…'}
              <b className={selected?.status === 'active' ? 'ok' : 'warn'}>{selected?.status === 'active' ? '●' : '▲'}</b>
            </div>
          </div>

          <SignalChart items={items} selectedId={selectedId} onSelect={setSelectedId} onTime={setUntil} />
        </section>
      </div>
    </div>
  )
}
