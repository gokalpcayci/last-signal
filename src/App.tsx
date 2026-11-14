import { useEffect, useMemo, useRef, useState } from 'react'
import MoonScene from './scene/MoonScene'
import Globe from './ui/Globe'
import { STACKED_QUERY } from './layout'
import { hardware, kindLabel, type HardwareKind } from './data/hardware'
import {
  IconArrowRight, IconChevronDown, IconChevronLeft, IconChevronRight, IconCompass,
  IconPulse, IconSearch, IconShuffle, IconSignalOff, IconSignalOk,
} from './ui/icons'

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
const YEARS = [1966, 1967, 1968, 1969, 1970, 1971, 1972]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LABEL = (i: number) => `${MONTHS[i % 12]} ${YEARS[0] + Math.floor(i / 12)}`

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

/** Row of thin ticks; the first `share` of them lit. */
function Ticks({ share, tone }: { share: number; tone: 'ok' | 'warn' }) {
  const N = 40
  const lit = Math.round(share * N)
  return <div className={`ticks ${tone}`}>{Array.from({ length: N }, (_, i) => <i key={i} className={i < lit ? 'on' : ''} />)}</div>
}

const fmtDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : s

export default function App() {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const rightRef = useRef<HTMLElement>(null)

  // Stacked (phone) layout: the story sits below the 3D view. Let the camera fly first, then bring the story into view.
  useEffect(() => {
    if (!selectedId || !window.matchMedia(STACKED_QUERY).matches) return
    const t = setTimeout(() => rightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 900)
    return () => clearTimeout(t)
  }, [selectedId])

  const items = useMemo(() => hardware.filter((h) => filter === 'all' || h.kind === filter), [filter])
  const selected = hardware.find((h) => h.id === selectedId) ?? null
  const active = hardware.filter((h) => h.status === 'active').length
  const silent = hardware.length - active
  // 84 monthly buckets (Jan 1966 – Dec 1972) → thin histogram bars like the reference
  const perMonth = Array.from({ length: YEARS.length * 12 }, () => 0)
  for (const h of hardware) {
    const [y, m] = h.arrived.split('-').map(Number)
    perMonth[(y - YEARS[0]) * 12 + (m - 1)]++
  }
  const maxMonth = Math.max(...perMonth)

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
          <MoonScene items={items} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        {/* top-left: logo + nav */}
        <aside className="nav">
          <img className="logo" src="/brand/app-icon.svg" alt="Lostronomy" width={32} height={32} />
          <div className="nav__world"><i /> MOON / SURFACE</div>
          <ul>
            {FILTERS.map((f) => (
              <li key={f.id}>
                <button className={filter === f.id ? 'is-on' : ''} onClick={() => { setFilter(f.id); setSelectedId(null) }}>
                  {filter === f.id ? `[${f.label.toUpperCase()}]` : f.label.toUpperCase()}
                </button>
              </li>
            ))}
          </ul>
          <div className="nav__soon">MARS · DEEP SPACE — SOON</div>
        </aside>

        <div className="search">
          <label className="search__box"><IconSearch /><span>search</span></label>
          <span className="search__thumb" aria-hidden />
        </div>

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
        </div>

        {/* bottom row */}
        <section className="bottom">
          <div className="panel chart">
            <div className="chips"><span>Moon <IconChevronDown /></span><span>1966–1972 <IconChevronDown /></span></div>
            <div className="panel__title">Hardware arrivals by month</div>
            <div className="bars">
              {perMonth.map((n, i) => (
                <div key={i} className={`bar${n ? '' : ' bar--empty'}`} style={{ height: n ? `${(n / maxMonth) * 100}%` : undefined }}
                  title={n ? `${MONTH_LABEL(i)}: ${n}` : undefined} />
              ))}
            </div>
            <div className="axis">{YEARS.filter((_, i) => i % 2 === 0).map((y) => <span key={y}>{y}</span>)}<span>1973</span></div>
          </div>

          <div className="panel radar">
            <div className="blip blip--g" style={{ left: '22%', top: '25%' }} />
            <div className="blip blip--o" style={{ left: '60%', top: '58%' }} />
            <div className="signal">
              {selected ? `Last signal: ${fmtDate(selected.lastSignal)}` : 'Listening for signals…'}
              <b className={selected?.status === 'active' ? 'ok' : 'warn'}>{selected?.status === 'active' ? '●' : '▲'}</b>
            </div>
          </div>

          <div className="panel counter">
            <div className="counter__icon ok"><IconSignalOk /></div>
            <div className="counter__num">{active}<small> /{hardware.length}</small></div>
            <div className="counter__label">Still working</div>
            <Ticks share={active / hardware.length} tone="ok" />
          </div>
          <div className="panel counter">
            <div className="counter__icon warn"><IconSignalOff /></div>
            <div className="counter__num">{silent}<small> /{hardware.length}</small></div>
            <div className="counter__label">Gone silent</div>
            <Ticks share={silent / hardware.length} tone="warn" />
          </div>
        </section>
      </div>
    </div>
  )
}
