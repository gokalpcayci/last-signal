import { useEffect, useMemo, useRef, useState } from 'react'
import MoonScene from './scene/MoonScene'
import Globe from './ui/Globe'
import { STACKED_QUERY } from './layout'
import SunNow from './ui/SunNow'
import { hardware, kindLabel, type HardwareKind } from './data/hardware'
import { marsHardware } from './data/mars'
import { PLANETS, type PlanetId } from './scene/planets'
import {
  IconArrowRight, IconFilter, IconChevronLeft, IconChevronRight, IconCompass,
  IconPulse, IconShuffle,
} from './ui/icons'
import NavEdge from './ui/NavEdge'
import { LedLogo } from './ui/LedLogo'
import SignalChart, { TIMELINES } from './ui/SignalChart'
import StrandedGame from './ui/StrandedGame'
import { exaggeration, setPlanet } from './scene/terrain'

// near-side LOLA elevations run −5.6 … +5.6 km (median −1.3)
const LAVA_MIN_KM = -5.6
const LAVA_MAX_KM = 1
const LAVA_DEFAULT_KM = -1.6

type Filter = 'all' | HardwareKind
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All hardware' },
  { id: 'lander', label: 'Landers' },
  { id: 'rover', label: 'Rovers' },
  { id: 'science', label: 'Science stations' },
  { id: 'reflector', label: 'Laser mirrors' },
  { id: 'robot', label: 'Robot landers' },
  { id: 'helicopter', label: 'Helicopters' },
]
const HARDWARE: Record<PlanetId, typeof hardware> = { moon: hardware, mars: marsHardware }
/** Where the "start the tour" buttons fly to */
const START: Record<PlanetId, { id: string; label: string }> = {
  moon: { id: 'a11-lm', label: 'Apollo 11' },
  mars: { id: 'viking-1', label: 'Viking 1' },
}
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
  const [planet, setPlanetId] = useState<PlanetId>('moon')
  // terrain.ts reads the active body; set it before any child renders (scene + globe are keyed by planet)
  setPlanet(planet)
  const P = PLANETS[planet]
  const list = HARDWARE[planet]
  const start = START[planet]
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
  // Lava flood (km of real elevation); null = off. −1.6 km fills roughly the maria.
  const [lava, setLava] = useState<number | null>(null)
  const currentFilter = FILTERS.find((f) => f.id === filter)?.label ?? 'All hardware'
  // only offer filters for kinds this body actually has
  const filters = FILTERS.filter((f) => f.id === 'all' || list.some((h) => h.kind === f.id))
  const switchPlanet = (id: PlanetId) => {
    if (id === planet) return
    setPlanetId(id)
    setSelectedId(null)
    setFilter('all')
    setUntil(null)
    setLava(null)
    setNavOpen(false)
  }
  const rightRef = useRef<HTMLElement>(null)

  // Stacked (phone) layout: the story sits below the 3D view. Let the camera fly first, then bring the story into view.
  useEffect(() => {
    if (!selectedId || !window.matchMedia(STACKED_QUERY).matches) return
    const t = setTimeout(() => rightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 900)
    return () => clearTimeout(t)
  }, [selectedId])

  // time travel: only what had landed by the playhead (keyed by count, so scrolling within a gap doesn't rebuild the scene)
  const timeline = TIMELINES[planet]
  const landed = until == null ? timeline.order.length : timeline.arrivedCount(until)
  const items = useMemo(() => {
    const ok = new Set(timeline.order.slice(0, landed))
    return list.filter((h) => (filter === 'all' || h.kind === filter) && ok.has(h.id))
  }, [filter, landed, list, timeline])
  const selected = list.find((h) => h.id === selectedId) ?? null
  const active = list.filter((h) => h.status === 'active').length

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
          <MoonScene key={planet} items={items} selectedId={selectedId} onSelect={setSelectedId} trueScale={trueScale} lavaLevel={lava} />
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
                {filters.map((f, i) => (
                  <li key={f.id} style={{ '--i': i } as React.CSSProperties}>
                    <button className={filter === f.id ? 'is-on' : ''} onClick={() => { setFilter(f.id); setSelectedId(null); setNavOpen(false) }}>
                      {filter === f.id ? `[${f.label.toUpperCase()}]` : f.label.toUpperCase()}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="planet-switch" role="group" aria-label="Choose a world">
                {(Object.keys(PLANETS) as PlanetId[]).map((id) => (
                  <button key={id} className={planet === id ? 'is-on' : ''} aria-pressed={planet === id} onClick={() => switchPlanet(id)}>
                    {planet === id ? `[${PLANETS[id].label.toUpperCase()}]` : PLANETS[id].label.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="nav__soon">DEEP SPACE — SOON</div>
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
              <SunNow lat={selected.lat} lon={selected.lon} name={selected.mission} body={planet} />
              <p>{selected.story}</p>
              <div className="dyk"><span>DID YOU KNOW?</span>{selected.didYouKnow}</div>
              <a href={selected.source} target="_blank" rel="noreferrer">NASA RECORD →</a>
            </div>
          ) : (
            <>
              <div className="stat">
                <div>
                  <div className="stat__num">{list.length}<small> objects</small></div>
                  <div className="stat__label">Left on {P.name}</div>
                </div>
                <Gauge value={active / list.length} />
              </div>
              <button className="view" onClick={() => setSelectedId(start.id)}>Start at {start.label} <IconArrowRight /></button>
              <Globe key={planet} items={items} selectedId={selectedId} />
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
          <button title={`Start tour at ${start.label}`} aria-label="Start tour" className={selectedId ? 'is-on' : ''} onClick={() => setSelectedId(start.id)}><IconCompass /></button>
          <button
            className={`toolbar__scale${trueScale ? ' is-on' : ''}`}
            aria-pressed={trueScale}
            title={trueScale ? `True scale: ${P.name} is really this flat` : `Mountains are stretched ×${exaggeration()} so you can see them. Click for true scale`}
            onClick={() => setTrueScale((v) => !v)}
          >{trueScale ? '1:1' : `×${exaggeration()}`}</button>
          {planet === 'moon' && <button
            className={`toolbar__scale toolbar__lava${lava !== null ? ' is-on' : ''}`}
            aria-pressed={lava !== null}
            title="Lava flood: see how the dark “seas” formed"
            onClick={() => setLava((v) => (v === null ? LAVA_DEFAULT_KM : null))}
          >LAVA</button>}
          {planet === 'moon' && lava !== null && (
            <div className="lava">
              <div className="lava__head">
                <span>LAVA LEVEL</span>
                <b>{lava < 0 ? '−' : '+'}{Math.abs(lava).toFixed(1)} km</b>
              </div>
              <input
                type="range" min={LAVA_MIN_KM} max={LAVA_MAX_KM} step={0.1} value={lava}
                aria-label="Lava level in kilometres"
                onChange={(e) => setLava(Number(e.target.value))}
              />
              <p>3–4 billion years ago, lava flooded the Moon’s low basins and froze into the dark “seas” (maria) you can still see from Earth.</p>
            </div>
          )}
        </div>

        {/* bottom row */}
        <section className="bottom">
          <StrandedGame key={planet} planet={planet} onSelect={setSelectedId} />

          <div className="panel radar">
            <div className="blip blip--g" style={{ left: '22%', top: '25%' }} />
            <div className="blip blip--o" style={{ left: '60%', top: '58%' }} />
            <div className="signal">
              {selected ? `Last signal: ${fmtDate(selected.lastSignal)}` : 'Listening for signals…'}
              <b className={selected?.status === 'active' ? 'ok' : 'warn'}>{selected?.status === 'active' ? '●' : '▲'}</b>
            </div>
          </div>

          <SignalChart key={planet} planet={planet} items={items} selectedId={selectedId} onSelect={setSelectedId} onTime={setUntil} />
        </section>
      </div>
    </div>
  )
}
