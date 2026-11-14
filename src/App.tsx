import { useEffect, useMemo, useRef, useState } from 'react'
import MoonScene from './scene/MoonScene'
import Globe from './ui/Globe'
import { hardware, kindLabel, type HardwareKind } from './data/hardware'

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
    if (!selectedId || !window.matchMedia('(max-width: 760px), (max-height: 520px)').matches) return
    const t = setTimeout(() => rightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 900)
    return () => clearTimeout(t)
  }, [selectedId])

  const items = useMemo(() => hardware.filter((h) => filter === 'all' || h.kind === filter), [filter])
  const selected = hardware.find((h) => h.id === selectedId) ?? null
  const active = hardware.filter((h) => h.status === 'active').length
  const silent = hardware.length - active
  const perYear = YEARS.map((y) => hardware.filter((h) => h.year === y).length)
  const maxYear = Math.max(...perYear)

  return (
    <div className="page">
      <div className="frame">

        {/* coordinate grid */}
        <div className="grid" aria-hidden>
          {COLS.map((c, i) => <span key={c} className="grid__col" style={{ left: `${(i / 5) * 100}%` }}>{c}</span>)}
          {ROWS.map((r, i) => <span key={r} className="grid__row" style={{ top: `${(i / 4) * 100}%` }}>{r}</span>)}
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
          <div className="logo">◢L</div>
          <div className="nav__world">[MOON]</div>
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

        <div className="search">⌕ LOSTRONOMY</div>

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
                <svg className="ring" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="16" />
                  <circle cx="20" cy="20" r="16" className="ring__val" strokeDasharray={`${(active / hardware.length) * 100.5} 100.5`} />
                </svg>
              </div>
              <button className="view" onClick={() => setSelectedId('a11-lm')}>Start at Apollo 11 →</button>
              <Globe items={items} selectedId={selectedId} />
            </>
          )}
        </section>

        {/* toolbar */}
        <div className="toolbar">
          <button title="Overview" onClick={() => setSelectedId(null)}>⌂</button>
          <button title="Previous" onClick={() => {
            const i = items.findIndex((h) => h.id === selectedId)
            setSelectedId(items[(i - 1 + items.length) % items.length]?.id ?? null)
          }}>‹</button>
          <button title="Next" onClick={() => {
            const i = items.findIndex((h) => h.id === selectedId)
            setSelectedId(items[(i + 1) % items.length]?.id ?? null)
          }}>›</button>
          <button title="Random" onClick={() => setSelectedId(items[Math.floor(Math.random() * items.length)]?.id ?? null)}>⚄</button>
        </div>

        {/* bottom row */}
        <section className="bottom">
          <div className="panel chart">
            <div className="chips"><span>Moon ▾</span><span>1966–1972 ▾</span></div>
            <div className="panel__title">Hardware left per year</div>
            <div className="bars">
              {perYear.map((n, i) => (
                <div key={YEARS[i]} className="bar" style={{ height: `${(n / maxYear) * 100}%` }} title={`${YEARS[i]}: ${n}`} />
              ))}
            </div>
            <div className="axis">{YEARS.filter((_, i) => i % 2 === 0).map((y) => <span key={y}>{y}</span>)}</div>
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
            <div className="counter__icon ok">✓</div>
            <div className="counter__num">{active}<small> /{hardware.length}</small></div>
            <div className="counter__label">Still working</div>
            <div className="ticks ok">{hardware.map((h, i) => <i key={i} className={h.status === 'active' ? 'on' : ''} />)}</div>
          </div>
          <div className="panel counter">
            <div className="counter__icon warn">!</div>
            <div className="counter__num">{silent}<small> /{hardware.length}</small></div>
            <div className="counter__label">Gone silent</div>
            <div className="ticks warn">{hardware.map((h, i) => <i key={i} className={h.status === 'silent' ? 'on' : ''} />)}</div>
          </div>
        </section>
      </div>
    </div>
  )
}
