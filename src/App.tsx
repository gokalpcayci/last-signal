import { useEffect, useMemo, useRef, useState } from 'react'
import MoonScene from './scene/MoonScene'
import DeepSpaceScene from './scene/DeepSpaceScene'
import Globe from './ui/Globe'
import { STACKED_QUERY } from './layout'
import SunNow from './ui/SunNow'
import { hardware, type HardwareKind } from './data/hardware'
import { useT } from './strings'
import { up, useLang, locale } from './i18n'
import { useLoc } from './data/localize'
import LangSwitch from './ui/LangSwitch'
import Credits, { CREDITS_EXIT_MS, useCreditsRoute } from './ui/Credits'
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
import SignalMap from './ui/SignalMap'
import { LedLogo } from './ui/LedLogo'
import BootLoader from './ui/BootLoader'
import { introPlays } from './boot'
import SignalChart, { TIMELINES, toYear } from './ui/SignalChart'
import SiteClock from './ui/SiteClock'
import DeepKey from './ui/DeepKey'
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
const FILTER_IDS: Filter[] = ['all', 'lander', 'rover', 'science', 'reflector', 'robot', 'helicopter', 'probe', 'telescope']
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
    ? new Date(s + 'T00:00:00Z').toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : s

export default function App() {
  const [planet, setPlanetId] = useState<WorldId>('moon')
  // terrain.ts reads the active body; set it before any child renders (scene + globe are keyed by planet).
  // Deep Space has no terrain (DeepSpaceScene): terrain.ts keeps the last body, unused.
  const terrain = isPlanet(planet) ? planet : null
  if (terrain) setPlanet(terrain)
  const isDeep = planet === 'deep'
  const t = useT()
  const lang = useLang()
  const L = useLoc()
  const [creditsOpen, setCreditsOpen] = useCreditsRoute()
  // keep the sheet mounted while its power-off plays
  const [creditsShown, creditsLeaving] = usePresence(creditsOpen ? true : null, CREDITS_EXIT_MS)
  const worldLabel = t.world.label[planet]
  const where = t.world.where[planet]
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
  const currentFilter = t.filter[filter]
  // only offer filters for kinds this body actually has
  const filters = FILTER_IDS.filter((id) => id === 'all' || list.some((h) => h.kind === id)).map((id) => ({ id, label: t.filter[id] }))
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
  // objects that are silent today but still talking at the playhead (their last signal is later)
  const talkingKey = until == null ? '' : list.filter((h) => h.status === 'silent' && toYear(h.lastSignal) > until).map((h) => h.id).join(',')
  const talking = useMemo(() => new Set(talkingKey ? talkingKey.split(',') : []), [talkingKey])
  const sel = list.find((h) => h.id === selectedId)
  const selected = sel ? L(sel) : null
  // keep the story on screen while its text plays the exit
  const [story, leaving] = usePresence(selected)
  const active = list.filter((h) => h.status === 'active').length

  // LED planet discs, top-right of the map (desktop / tablet). Phones pick the world in MobileNav.
  const discSize = 40
  const planetSwitch = (
    <div className="planet-switch" role="group" aria-label={t.world.choose}>
      {(Object.keys(WORLDS) as WorldId[]).map((id) => (
        <button key={id} className={planet === id ? 'is-on' : ''} aria-pressed={planet === id} onClick={() => switchPlanet(id)}
          title={t.world.explore(t.world.where[id])}>
          <PlanetIcon id={id} active={planet === id} size={discSize} />
          <OrbitLabel size={discSize} text={up(t.world.label[id])} />
          <span className="te__sr">{t.world.label[id]}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="page">
      {introPlays && <BootLoader />}
      {creditsShown && <Credits leaving={creditsLeaving} onClose={() => setCreditsOpen(false)} />}
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
            : <MoonScene key={planet} items={items} selectedId={selectedId} onSelect={setSelectedId} trueScale={trueScale} lavaLevel={lava} talking={talking} />}
        </div>

        {/* top-right: planet switch (desktop / tablet overlay) */}
        {!stacked && planetSwitch}
        {!stacked && <div className="meta"><LangSwitch /><button className="meta__credits" onClick={() => setCreditsOpen(true)}>{t.nav.credits}</button></div>}

        {/* top-left: logo + nav */}
        <aside className={`nav${navOpen ? ' is-open' : ''}`}>
          <div className="nav__bar">
            <LedLogo className="logo" width={stacked ? 56 : 84} />
            {/* phones: where you are (world · filter); tap to open the two-step drawer */}
            {stacked && (
              <button className="nav__crumb" aria-controls="nav-filters" aria-expanded={navOpen} onClick={() => setNavOpen((o) => !o)}>
                <b>{up(worldLabel)}</b>{up(currentFilter)}
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
                  onCredits={() => { setNavOpen(false); setCreditsOpen(true) }}
                  onFilter={(id) => { setFilter(id as Filter); setSelectedId(null); setNavOpen(false) }} />
              ) : (
              <ul>
                {filters.map((f, i) => (
                  <li key={f.id} style={{ '--i': i } as React.CSSProperties}>
                    <button className={filter === f.id ? 'is-on' : ''} onClick={() => { setFilter(f.id); setSelectedId(null); setNavOpen(false) }}>
                      {filter === f.id ? `[${up(f.label)}]` : up(f.label)}
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
            <div className={`story${leaving ? ' is-leaving' : ''}`} key={`${story.id}-${lang}`}>
              <div className="story__head">
                <span className={`status status--${story.status}`}>
                  <span className="status__key">SIG</span>
                  <span className="status__trace" aria-hidden>{story.status === 'active' ? '▪=========▌' : '▪=====::..×'}</span>
                  {story.status === 'active' ? t.story.live : t.story.lost(story.lastSignal.slice(0, 4))}
                </span>
                <button className="close" aria-label={t.story.close} onClick={() => setSelectedId(null)}>×</button>
              </div>
              <TextEffect className="story__mission" trigger={!leaving}>{`${up(story.mission)} · ${up(t.kind[story.kind])}`}</TextEffect>
              <TextEffect as="h2" trigger={!leaving} delay={0.1}>{story.name}</TextEffect>
              <StoryPhoto id={story.id} />
              <div className="sec">{t.story.record}</div>
              <dl>
                <dt>{t.story.site}</dt><dd><TextEffect per="word" trigger={!leaving} delay={0.25}>{story.site}</TextEffect></dd>
                <dt>{isDeep ? t.story.launched : t.story.arrived}</dt><dd><TextEffect trigger={!leaving} delay={0.3}>{fmtDate(story.arrived)}</TextEffect></dd>
                <dt>{t.story.lastSignal}</dt><dd><TextEffect trigger={!leaving} delay={0.35}>{fmtDate(story.lastSignal)}</TextEffect></dd>
                {isDeep
                  ? <><dt>{t.story.distance}</dt><dd><TextEffect trigger={!leaving} delay={0.4}>{t.story.au(AU.get(story.id))}</TextEffect></dd></>
                  : <><dt>{t.story.coords}</dt><dd><TextEffect trigger={!leaving} delay={0.4}>{`${story.lat.toFixed(2)}°, ${story.lon.toFixed(2)}°`}</TextEffect></dd></>}
              </dl>
              {terrain && <><div className="sec">{t.story.atSite}<i>{t.story.liveTag}</i></div><SunNow lat={story.lat} lon={story.lon} body={terrain} /></>}
              <div className="sec">{t.story.story}</div>
              <TextEffect as="p" per="word" trigger={!leaving} delay={0.45}>{story.story}</TextEffect>
              <a className="story__src" href={story.source} target="_blank" rel="noreferrer">
                <span>{t.story.source}</span>{new URL(story.source).hostname.replace(/^www\./, '')}
              </a>
            </div>
          ) : (
            <>
              <div className="stat">
                <div>
                  <div className="stat__num">{list.length}<small>{t.stat.objects}</small></div>
                  <div className="stat__label">{t.stat.left(where)}</div>
                </div>
                <Gauge value={active / list.length} />
              </div>
              <button className="view" onClick={() => setSelectedId(start.id)}>{t.stat.start(start.label)} <IconArrowRight /></button>
              {isDeep
                ? <DistanceLadder items={deepSpaceHardware.filter((h) => items.includes(h))} selectedId={selectedId} onSelect={setSelectedId} />
                : <Globe key={planet} items={items} selectedId={selectedId} />}
            </>
          )}
        </section>

        {/* toolbar */}
        <div className="toolbar">
          <button title={t.toolbar.overview} aria-label={t.toolbar.overview} className={selectedId ? '' : 'is-on'} onClick={() => setSelectedId(null)}><IconPulse /></button>
          <button title={t.toolbar.prev} aria-label={t.toolbar.prev} onClick={() => {
            const i = items.findIndex((h) => h.id === selectedId)
            setSelectedId(items[(i - 1 + items.length) % items.length]?.id ?? null)
          }}><IconChevronLeft /></button>
          <button title={t.toolbar.next} aria-label={t.toolbar.next} onClick={() => {
            const i = items.findIndex((h) => h.id === selectedId)
            setSelectedId(items[(i + 1) % items.length]?.id ?? null)
          }}><IconChevronRight /></button>
          <button title={t.toolbar.random} aria-label={t.toolbar.random} onClick={() => setSelectedId(items[Math.floor(Math.random() * items.length)]?.id ?? null)}><IconShuffle /></button>
          <button title={t.toolbar.tour(start.label)} aria-label={t.toolbar.tourShort} className={selectedId ? 'is-on' : ''} onClick={() => setSelectedId(start.id)}><IconCompass /></button>
          <button
            className={`toolbar__scale${trueScale ? ' is-on' : ''}`}
            aria-pressed={trueScale}
            title={isDeep
              ? (trueScale ? t.toolbar.deepTrue : t.toolbar.deepLog)
              : (trueScale ? t.toolbar.planetTrue(worldLabel) : t.toolbar.planetX(exaggeration()))}
            onClick={() => setTrueScale((v) => !v)}
          >{trueScale ? '1:1' : isDeep ? 'LOG' : `×${exaggeration()}`}</button>
          {planet === 'moon' && <button
            className={`toolbar__scale toolbar__lava${lava !== null ? ' is-on' : ''}`}
            aria-pressed={lava !== null}
            title={t.toolbar.lavaTitle}
            onClick={() => setLava((v) => (v === null ? LAVA_DEFAULT_KM : null))}
          >{t.toolbar.lava}</button>}
          {planet === 'moon' && lava !== null && (
            <div className="lava">
              <div className="lava__head">
                <span>{t.toolbar.lavaLevel}</span>
                <b>{lava < 0 ? '−' : '+'}{Math.abs(lava).toFixed(1)} km</b>
              </div>
              <input
                type="range" min={LAVA_MIN_KM} max={LAVA_MAX_KM} step={0.1} value={lava}
                aria-label={t.toolbar.lavaAria}
                onChange={(e) => setLava(Number(e.target.value))}
              />
              <TextEffect key={lang} as="p" per="word" delay={0.1}>{t.toolbar.lavaNote}</TextEffect>
            </div>
          )}
        </div>

        {/* bottom row */}
        <section className="bottom">
          {terrain
            ? <SiteClock key={`clock-${planet}`} body={terrain} list={list} selectedId={selectedId} onSelect={setSelectedId} />
            : <DeepKey />}

          <SignalMap world={planet} list={list} shown={items} talking={talking} selectedId={selectedId} onSelect={setSelectedId} />

          <SignalChart key={`chart-${planet}`} planet={planet} items={items} selectedId={selectedId} onSelect={setSelectedId} onTime={setUntil} />
        </section>
      </div>
    </div>
  )
}
