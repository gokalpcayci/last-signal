import { useEffect, useMemo, useRef, useState } from 'react'
import MoonScene from './scene/MoonScene'
import DeepSpaceScene from './scene/DeepSpaceScene'
import Globe from './ui/Globe'
import { STACKED_QUERY } from './layout'
import SunNow from './ui/SunNow'
import { hardware, kindLabel, type HardwareKind } from './data/hardware'
import { marsHardware } from './data/mars'
import { deepSpaceHardware } from './data/deepspace'
import { WORLDS, isPlanet, type WorldId } from './scene/planets'
import {
  IconArrowRight, IconChevronLeft, IconChevronRight, IconCompass,
  IconPulse, IconShuffle,
} from './ui/icons'
import NavEdge from './ui/NavEdge'
import PlanetIcon, { OrbitLabel } from './ui/PlanetIcon'
import MenuButton from './ui/MenuButton'
import MobileNav from './ui/MobileNav'
import { LedLogo } from './ui/LedLogo'
import BootLoader from './ui/BootLoader'
import { introPlays } from './boot'
import SignalChart, { TIMELINES } from './ui/SignalChart'
import StrandedGame from './ui/StrandedGame'
import SignalDelay from './ui/SignalDelay'
import DistanceLadder from './ui/DistanceLadder'
import { StoryPhoto } from './ui/StoryPhoto'
import TextEffect from './ui/TextEffect'
import { usePresence } from './ui/usePresence'
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
  { id: 'probe', label: 'Space probes' },
  { id: 'telescope', label: 'Telescopes' },
]
const HARDWARE: Record<WorldId, typeof hardware> = { moon: hardware, mars: marsHardware, deep: deepSpaceHardware }
/** Where the "start the tour" buttons fly to */
const START: Record<WorldId, { id: string; label: string }> = {
  moon: { id: 'a11-lm', label: 'Apollo 11' },
  mars: { id: 'viking-1', label: 'Viking 1' },
  deep: { id: 'voyager-1', label: 'Voyager 1' },
}
const AU = new Map(deepSpaceHardware.map((h) => [h.id, h.au]))
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
  const [planet, setPlanetId] = useState<WorldId>('moon')
  // terrain.ts reads the active body; set it before any child renders (scene + globe are keyed by planet).
  // Deep Space has no terrain (DeepSpaceScene): terrain.ts keeps the last body, unused.
  const terrain = isPlanet(planet) ? planet : null
  if (terrain) setPlanet(terrain)
  const isDeep = planet === 'deep'
  const W = WORLDS[planet]
  const where = isDeep ? 'in deep space' : `on ${W.name}`
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
  /** keepOpen: the phone drawer stays open and moves on to that world's filters */
  const switchPlanet = (id: WorldId, keepOpen = false) => {
    if (id === planet) return
    setPlanetId(id)
    setSelectedId(null)
    setFilter('all')
    setUntil(null)
    setLava(null)
    if (!keepOpen) setNavOpen(false)
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
  // keep the story on screen while its text plays the exit
  const [story, leaving] = usePresence(selected)
  const active = list.filter((h) => h.status === 'active').length

  // LED planet discs, top-right of the map (desktop / tablet). Phones pick the world in MobileNav.
  const discSize = 40
  const planetSwitch = (
    <div className="planet-switch" role="group" aria-label="Choose a world">
      {(Object.keys(WORLDS) as WorldId[]).map((id) => (
        <button key={id} className={planet === id ? 'is-on' : ''} aria-pressed={planet === id} onClick={() => switchPlanet(id)}
          title={`Explore what we left ${id === 'deep' ? 'in deep space' : `on ${WORLDS[id].name}`}`}>
          <PlanetIcon id={id} active={planet === id} size={discSize} />
          <OrbitLabel size={discSize} text={WORLDS[id].label.toUpperCase()} />
          <span className="te__sr">{WORLDS[id].label}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="page">
      {introPlays && <BootLoader />}
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
          {isDeep
            ? <DeepSpaceScene key="deep" items={items} selectedId={selectedId} onSelect={setSelectedId} trueScale={trueScale} until={until} />
            : <MoonScene key={planet} items={items} selectedId={selectedId} onSelect={setSelectedId} trueScale={trueScale} lavaLevel={lava} />}
        </div>

        {/* top-right: planet switch (desktop / tablet overlay) */}
        {!stacked && planetSwitch}

        {/* top-left: logo + nav */}
        <aside className={`nav${navOpen ? ' is-open' : ''}`}>
          <div className="nav__bar">
            <LedLogo className="logo" width={stacked ? 56 : 84} />
            {/* phones: where you are (world · filter); tap to open the two-step drawer */}
            {stacked && (
              <button className="nav__crumb" aria-controls="nav-filters" aria-expanded={navOpen} onClick={() => setNavOpen((o) => !o)}>
                <b>{W.label.toUpperCase()}</b>{currentFilter.toUpperCase()}
              </button>
            )}
            {/* phones: one compact row; tap to expand the filter row */}
            <MenuButton open={navOpen} onToggle={() => setNavOpen((o) => !o)} controls="nav-filters"
              filter={filter} label={currentFilter}
              pitch={22 / 30 /* 30-LED glyph drawn 22px wide: a bit over half the logo's height (finer LEDs than the logo) */} />
          </div>
          <div className="nav__drawer" id="nav-filters">
            <div className="nav__drawer-inner">
              {stacked ? (
                <MobileNav open={navOpen} world={planet} filters={filters} filter={filter}
                  counts={{ moon: HARDWARE.moon.length, mars: HARDWARE.mars.length, deep: HARDWARE.deep.length }}
                  onWorld={(id) => switchPlanet(id, true)}
                  onFilter={(id) => { setFilter(id as Filter); setSelectedId(null); setNavOpen(false) }} />
              ) : (
              <ul>
                {filters.map((f, i) => (
                  <li key={f.id} style={{ '--i': i } as React.CSSProperties}>
                    <button className={filter === f.id ? 'is-on' : ''} onClick={() => { setFilter(f.id); setSelectedId(null); setNavOpen(false) }}>
                      {filter === f.id ? `[${f.label.toUpperCase()}]` : f.label.toUpperCase()}
                    </button>
                  </li>
                ))}
              </ul>
              )}
            </div>
          </div>
          <NavEdge />
        </aside>

        {/* right column: stat + globe, or story */}
        <section className="right" ref={rightRef}>
          {story ? (
            <div className={`story${leaving ? ' is-leaving' : ''}`} key={story.id}>
              <div className="story__head">
                <span className={`pill pill--${story.status}`}>{story.status === 'active' ? 'STILL WORKING' : 'SILENT'}</span>
                <button className="close" onClick={() => setSelectedId(null)}>×</button>
              </div>
              <TextEffect className="story__mission" trigger={!leaving}>{`${story.mission.toUpperCase()} · ${kindLabel[story.kind].toUpperCase()}`}</TextEffect>
              <TextEffect as="h2" trigger={!leaving} delay={0.1}>{story.name}</TextEffect>
              <StoryPhoto id={story.id} />
              <dl>
                <dt>Site</dt><dd><TextEffect per="word" trigger={!leaving} delay={0.25}>{story.site}</TextEffect></dd>
                <dt>{isDeep ? 'Launched' : 'Arrived'}</dt><dd><TextEffect trigger={!leaving} delay={0.3}>{fmtDate(story.arrived)}</TextEffect></dd>
                <dt>Last signal</dt><dd><TextEffect trigger={!leaving} delay={0.35}>{fmtDate(story.lastSignal)}</TextEffect></dd>
                {isDeep
                  ? <><dt>Distance</dt><dd><TextEffect trigger={!leaving} delay={0.4}>{`${AU.get(story.id)} AU from the Sun`}</TextEffect></dd></>
                  : <><dt>Coords</dt><dd><TextEffect trigger={!leaving} delay={0.4}>{`${story.lat.toFixed(2)}°, ${story.lon.toFixed(2)}°`}</TextEffect></dd></>}
              </dl>
              {terrain && <SunNow lat={story.lat} lon={story.lon} name={story.mission} body={terrain} />}
              <TextEffect as="p" per="word" trigger={!leaving} delay={0.45}>{story.story}</TextEffect>
              <div className="dyk"><span>DID YOU KNOW?</span><TextEffect per="word" trigger={!leaving} delay={0.8}>{story.didYouKnow}</TextEffect></div>
              <a href={story.source} target="_blank" rel="noreferrer">NASA RECORD →</a>
            </div>
          ) : (
            <>
              <div className="stat">
                <div>
                  <div className="stat__num">{list.length}<small> objects</small></div>
                  <div className="stat__label">Left {where}</div>
                </div>
                <Gauge value={active / list.length} />
              </div>
              <button className="view" onClick={() => setSelectedId(start.id)}>Start at {start.label} <IconArrowRight /></button>
              {isDeep
                ? <DistanceLadder items={deepSpaceHardware.filter((h) => items.includes(h))} selectedId={selectedId} onSelect={setSelectedId} />
                : <Globe key={planet} items={items} selectedId={selectedId} />}
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
            title={isDeep
              ? (trueScale ? 'True distances: the inner planets crowd into one dot next to the Sun' : 'Distances are squeezed so everything fits. Click for true scale')
              : (trueScale ? `True scale: ${W.name} is really this flat` : `Mountains are stretched ×${exaggeration()} so you can see them. Click for true scale`)}
            onClick={() => setTrueScale((v) => !v)}
          >{trueScale ? '1:1' : isDeep ? 'LOG' : `×${exaggeration()}`}</button>
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
              <TextEffect as="p" per="word" delay={0.1}>3–4 billion years ago, lava flooded the Moon’s low basins and froze into the dark “seas” (maria) you can still see from Earth.</TextEffect>
            </div>
          )}
        </div>

        {/* bottom row */}
        <section className="bottom">
          {terrain
            ? <StrandedGame key={`stranded-${planet}`} planet={terrain} onSelect={setSelectedId} />
            : <SignalDelay onSelect={setSelectedId} />}

          <div className="panel radar">
            <div className="blip blip--g" style={{ left: '22%', top: '25%' }} />
            <div className="blip blip--o" style={{ left: '60%', top: '58%' }} />
            <div className="signal">
              {selected ? `Last signal: ${fmtDate(selected.lastSignal)}` : 'Listening for signals…'}
              <b className={selected?.status === 'active' ? 'ok' : 'warn'}>{selected?.status === 'active' ? '●' : '▲'}</b>
            </div>
          </div>

          <SignalChart key={`chart-${planet}`} planet={planet} items={items} selectedId={selectedId} onSelect={setSelectedId} onTime={setUntil} />
        </section>
      </div>
    </div>
  )
}
