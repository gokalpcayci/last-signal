import { useEffect, useMemo, useRef, useState } from 'react'
import { hardware, type Hardware } from '../data/hardware'
import { IconChevronDown } from './icons'

/**
 * Bottom-left analytics panel. Two views of the same 22 objects:
 *  - signals:  one thin trace per object from arrival to last signal (1966 → now, broken axis)
 *  - arrivals: one LED dot per object, stacked by month (1966–1972), over a ghost LED grid
 * Hover = readout, click = select (camera flies), drag = time filter for the map.
 */

export type ChartMode = 'arrivals' | 'signals'
export interface TimeRange { mode: ChartMode; t0: number; t1: number }

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const NOW = (() => { const d = new Date(); return d.getUTCFullYear() + d.getUTCMonth() / 12 + (d.getUTCDate() - 1) / 365 })()
const NOW_YEAR = new Date().getUTCFullYear()

/** ISO date → decimal year. Non-dates ("Still in use today") mean now. */
export const toYear = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? +m[1] + (+m[2] - 1) / 12 + (+m[3] - 1) / 365 : NOW
}
export const inRange = (h: Hardware, r: TimeRange) => {
  const a = toYear(h.arrived), e = toYear(h.lastSignal)
  return r.mode === 'arrivals' ? a >= r.t0 && a <= r.t1 : a <= r.t1 && e >= r.t0
}

const fmtT = (t: number) => {
  if (t >= NOW - 0.02) return 'NOW'
  const y = Math.floor(t)
  return `${MONTHS[Math.min(11, Math.floor((t - y) * 12))]} ${y}`
}
const fmtDay = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : 'NOW'
}
const span = (a: number, b: number) => {
  const d = b - a
  if (d < 0.08) { const n = Math.max(1, Math.round(d * 365)); return `${n} DAY${n > 1 ? 'S' : ''}` }
  if (d < 1) return `${Math.round(d * 12)} MO`
  return `${d.toFixed(1)} YRS`
}
const short = (mission: string) => (mission.startsWith('Surveyor') ? 'SURV' : mission.replace('Apollo ', 'A'))

const byArrival = [...hardware].sort((a, b) => toYear(a.arrived) - toYear(b.arrived))

// ── signals view: rows per mission, lanes inside a row ──────────────────────
interface Row { label: string; lanes: number; items: { h: Hardware; lane: number }[] }
const ROWS: Row[] = (() => {
  const groups = new Map<string, Hardware[]>()
  for (const h of byArrival) {
    const k = short(h.mission)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(h)
  }
  return [...groups].map(([label, hs]) => {
    // long traces on top; short ones share a lane only when they don't overlap
    const sorted = [...hs].sort((a, b) => toYear(b.lastSignal) - toYear(a.lastSignal))
    const lanes: [number, number][][] = []
    const items = sorted.map((h) => {
      const a = toYear(h.arrived), e = toYear(h.lastSignal)
      let lane = lanes.findIndex((iv) => iv.every(([s, f]) => e < s - 0.05 || a > f + 0.05))
      if (lane < 0) { lane = lanes.length; lanes.push([]) }
      lanes[lane].push([a, e])
      return { h, lane }
    })
    return { label, lanes: lanes.length, items }
  })
})()

/** A date when ≥3 objects went quiet together (the 1977 ALSEP shutdown). */
const CLIFF = (() => {
  const n = new Map<string, number>()
  for (const h of hardware) if (/^\d{4}-/.test(h.lastSignal)) n.set(h.lastSignal, (n.get(h.lastSignal) ?? 0) + 1)
  const hit = [...n].find(([, c]) => c >= 3)
  return hit ? { date: hit[0], t: toYear(hit[0]), count: hit[1] } : null
})()

// broken time axis: 1966–1978 gets most of the width, 1978–now is squeezed after a "//"
const T0 = 1966, TB = 1978, BREAK = 0.8, GAP = 0.035
const GUTTER = 30, AXIS = 15

// ── arrivals view: monthly columns ──────────────────────────────────────────
const A0 = 1966, MONTHS_N = 7 * 12
const monthIdx = (h: Hardware) => { const [y, m] = h.arrived.split('-').map(Number); return (y - A0) * 12 + m - 1 }
// LED columns are 2 months wide: big enough dots, and no two missions share a column in this data
const PER_COL = 2, LED_COLS = MONTHS_N / PER_COL
const COLUMNS: Hardware[][] = Array.from({ length: LED_COLS }, () => [])
for (const h of byArrival) COLUMNS[Math.floor(monthIdx(h) / PER_COL)]?.push(h)
// sort each stack so active objects sit on top (they read as the "still lit" ones)
for (const c of COLUMNS) c.sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? 1 : -1))

interface Hit { h: Hardware; x1: number; x2: number; y: number }

export default function SignalChart({ items, selectedId, onSelect, range, onRange }: {
  items: Hardware[]
  selectedId: string | null
  onSelect: (id: string) => void
  range: TimeRange | null
  onRange: (r: TimeRange | null) => void
}) {
  const [mode, setMode] = useState<ChartMode>('signals')
  const [menu, setMenu] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState<{ x: number; id: string | null } | null>(null)
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

  const visible = useMemo(() => new Set(items.map((h) => h.id)), [items])
  const { w: W, h: H } = size
  const TOP = mode === 'signals' && CLIFF ? 13 : 4 // signals: a strip on top for the cliff caption
  const plotH = Math.max(10, H - AXIS - TOP)

  // ── scales ──
  const L = mode === 'signals' ? GUTTER : 2
  const PW = Math.max(10, W - L - 6)
  const x = (t: number) => mode === 'signals'
    ? (t <= TB ? L + ((t - T0) / (TB - T0)) * BREAK * PW : L + (BREAK + GAP) * PW + ((t - TB) / (NOW - TB)) * (1 - BREAK - GAP) * PW)
    : L + ((t - A0) * 12 / MONTHS_N) * PW
  const tAt = (px: number) => {
    const f = (px - L) / PW
    if (mode === 'arrivals') return A0 + Math.max(0, Math.min(1, f)) * MONTHS_N / 12
    if (f <= BREAK) return T0 + Math.max(0, f / BREAK) * (TB - T0)
    if (f < BREAK + GAP) return TB
    return TB + Math.min(1, (f - BREAK - GAP) / (1 - BREAK - GAP)) * (NOW - TB)
  }

  // ── geometry for the current mode (also used for hit-testing) ──
  const colW = PW / LED_COLS
  const cell = Math.max(2, Math.min(colW, plotH / 5))
  const ledRows = Math.max(4, Math.min(12, Math.floor(plotH / cell)))
  const base = TOP + plotH

  // 22 objects: cheap enough to rebuild every render
  const hits: Hit[] = (() => {
    if (!W) return []
    if (mode === 'signals') {
      const rowH = plotH / ROWS.length
      return ROWS.flatMap((r, ri) => {
        const gap = Math.min(4, rowH / (r.lanes + 1))
        return r.items.map(({ h, lane }) => {
          const x1 = x(toYear(h.arrived))
          return { h, x1, x2: Math.max(x1 + 2, x(toYear(h.lastSignal))), y: TOP + ri * rowH + rowH / 2 + (lane - (r.lanes - 1) / 2) * gap }
        })
      })
    }
    return COLUMNS.flatMap((c, i) => c.map((h, k) => {
      const cx = L + (i + 0.5) * colW
      return { h, x1: cx, x2: cx, y: base - (k + 0.5) * cell }
    }))
  })()

  const hitAt = (px: number, py: number): Hit | null => {
    let best: Hit | null = null, bd = mode === 'signals' ? 7 : Math.max(5, cell)
    for (const hit of hits) {
      if (!visible.has(hit.h.id)) continue
      const dx = px < hit.x1 ? hit.x1 - px : px > hit.x2 ? px - hit.x2 : 0
      const d = Math.hypot(dx, py - hit.y)
      if (d < bd) { bd = d; best = hit }
    }
    return best
  }

  // ── pointer: hover / click / drag-to-filter ──
  const local = (e: React.PointerEvent) => { const r = boxRef.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const onDown = (e: React.PointerEvent) => {
    const [px] = local(e)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setDrag({ x0: px, x1: px })
  }
  const onMove = (e: React.PointerEvent) => {
    const [px, py] = local(e)
    if (drag) setDrag({ ...drag, x1: px })
    setHover({ x: px, id: hitAt(px, py)?.h.id ?? null })
  }
  const onUp = (e: React.PointerEvent) => {
    if (!drag) return
    const [px, py] = local(e)
    if (Math.abs(px - drag.x0) > 5) {
      let t0 = tAt(Math.min(drag.x0, px)), t1 = tAt(Math.max(drag.x0, px))
      if (mode === 'arrivals') { t0 = Math.floor(t0 * 12) / 12; t1 = Math.ceil(t1 * 12) / 12 } // snap to months
      onRange({ mode, t0, t1 })
    } else {
      const hit = hitAt(px, py)
      if (hit) onSelect(hit.h.id)
      else if (range) onRange(null)
    }
    setDrag(null)
  }

  const pickMode = (m: ChartMode) => { setMenu(false); if (m !== mode) { setMode(m); onRange(null); setHover(null) } }

  // ── readout line (replaces the title while you interact) ──
  const hovered = hover?.id ? hardware.find((h) => h.id === hover.id) : null
  const shownRange = drag && Math.abs(drag.x1 - drag.x0) > 5
    ? { t0: tAt(Math.min(drag.x0, drag.x1)), t1: tAt(Math.max(drag.x0, drag.x1)) }
    : range?.mode === mode ? range : null
  let readout: React.ReactNode = mode === 'signals' ? 'How long each one kept talking' : 'Hardware arrivals by month'
  if (hovered) {
    const a = toYear(hovered.arrived), e = toYear(hovered.lastSignal)
    readout = (
      <span className="sig__read">
        <b className={hovered.status === 'active' ? 'ok' : 'warn'}>{hovered.status === 'active' ? '●' : '▲'}</b>
        {hovered.mission.toUpperCase()} · {hovered.name.toUpperCase()}
        <i>{mode === 'signals' ? `${fmtDay(hovered.arrived)} → ${fmtDay(hovered.lastSignal)} · ${span(a, e)}` : fmtDay(hovered.arrived)}</i>
      </span>
    )
  } else if (shownRange) {
    const n = hardware.filter((h) => inRange(h, { mode, ...shownRange })).length
    readout = (
      <span className="sig__read">
        {fmtT(shownRange.t0)} → {fmtT(shownRange.t1)}
        <i>{n} {mode === 'signals' ? 'TALKING' : 'ARRIVED'}{range && !drag ? ' · CLICK EMPTY SPACE TO CLEAR' : ''}</i>
      </span>
    )
  } else if (hover && hover.x >= L && hover.x <= L + PW) {
    const t = tAt(hover.x)
    if (mode === 'arrivals') {
      const c = COLUMNS[Math.floor((hover.x - L) / colW)] ?? []
      readout = c.length
        ? <span className="sig__read">{fmtT(toYear(c[0].arrived))}<i>{short(c[0].mission)} · {c.length} ARRIVED</i></span>
        : <span className="sig__read">{fmtT(t)}<i>NO ARRIVALS</i></span>
    } else {
      const n = hardware.filter((h) => toYear(h.arrived) <= t && toYear(h.lastSignal) >= t).length
      readout = <span className="sig__read">{fmtT(t)}<i>{n} STILL TALKING</i></span>
    }
  }

  const dimOf = (h: Hardware) => (!visible.has(h.id) ? ' is-out' : selectedId && selectedId !== h.id ? ' is-dim' : '')

  return (
    <div className="panel chart">
      <div className="chips">
        <span>Moon <IconChevronDown /></span>
        <div className="chip-wrap">
          <button className="chip" aria-haspopup="listbox" aria-expanded={menu}
            onPointerDown={(e) => e.stopPropagation()} onClick={() => setMenu((o) => !o)}>
            {mode === 'signals' ? `1966–${NOW_YEAR}` : '1966–1972'} <IconChevronDown />
          </button>
          {menu && (
            <ul className="chip-menu" role="listbox" onPointerDown={(e) => e.stopPropagation()}>
              <li><button role="option" aria-selected={mode === 'signals'} onClick={() => pickMode('signals')}>
                {mode === 'signals' ? '[SIGNALS]' : 'SIGNALS'}<small>1966–{NOW_YEAR}</small></button></li>
              <li><button role="option" aria-selected={mode === 'arrivals'} onClick={() => pickMode('arrivals')}>
                {mode === 'arrivals' ? '[ARRIVALS]' : 'ARRIVALS'}<small>1966–1972</small></button></li>
            </ul>
          )}
        </div>
      </div>
      <div className="panel__title">{readout}</div>

      <div className="sig" ref={boxRef}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerLeave={() => { if (!drag) setHover(null) }}>
        {W > 0 && (
          <svg key={mode} className="sig__plot" width={W} height={H} role="img"
            aria-label={mode === 'signals' ? 'Timeline of how long each object sent signals' : 'Hardware arrivals per month'}>
            <defs>
              <pattern id="sig-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" />
              </pattern>
            </defs>

            {/* brushed range */}
            {shownRange && (
              <g className="sig__range">
                <rect x={x(shownRange.t0)} y={TOP} width={Math.max(1, x(shownRange.t1) - x(shownRange.t0))} height={plotH} fill="url(#sig-hatch)" />
                <line x1={x(shownRange.t0)} x2={x(shownRange.t0)} y1={TOP} y2={base} />
                <line x1={x(shownRange.t1)} x2={x(shownRange.t1)} y1={TOP} y2={base} />
              </g>
            )}

            {/* baseline + ticks */}
            <line className="sig__base" x1={L} x2={L + PW} y1={base + 1.5} y2={base + 1.5} />

            {mode === 'signals' ? (
              <>
                {ROWS.map((r, ri) => (
                  <text key={r.label} className="sig__lab" x={0} y={TOP + (ri + 0.5) * (plotH / ROWS.length) + 3}>{r.label}</text>
                ))}
                {CLIFF && (
                  <g className="sig__cliff">
                    <line x1={x(CLIFF.t)} x2={x(CLIFF.t)} y1={2} y2={base} />
                    <text x={x(CLIFF.t) - 4} y={8} textAnchor="end">{fmtDay(CLIFF.date)} · {CLIFF.count} STATIONS OFF</text>
                  </g>
                )}
                {hits.map(({ h, x1, x2, y }) => {
                  const live = h.status === 'active'
                  return (
                    <g key={h.id} className={`sig__trace ${live ? 'ok' : 'warn'}${dimOf(h)}${selectedId === h.id ? ' is-sel' : ''}${hover?.id === h.id ? ' is-hov' : ''}`}>
                      <line x1={x1} x2={x2} y1={y} y2={y} />
                      {live
                        ? <rect className="sig__live" x={x2 - 1.5} y={y - 1.5} width={3} height={3} style={{ animationDelay: `${(x1 % 7) * 0.6}s` }} />
                        : <rect className="sig__cap" x={x2 - 1.25} y={y - 1.25} width={2.5} height={2.5} />}
                    </g>
                  )
                })}
                {/* axis break */}
                <g className="sig__break">
                  <rect x={L + (BREAK + GAP / 2) * PW - 3} y={TOP} width={6} height={plotH + 4} />
                  <line x1={L + (BREAK + GAP / 2) * PW - 4} y1={base + 5} x2={L + (BREAK + GAP / 2) * PW - 1} y2={base - 2} />
                  <line x1={L + (BREAK + GAP / 2) * PW + 1} y1={base + 5} x2={L + (BREAK + GAP / 2) * PW + 4} y2={base - 2} />
                </g>
                {(x(1968) - x(1966) < 40 ? [1966, 1970, 1974] : [1966, 1968, 1970, 1972, 1974, 1976]).map((y) => (
                  <text key={y} className="sig__tick" x={x(y)} y={H - 2} textAnchor={y === 1966 ? 'start' : 'middle'}>{y}</text>
                ))}
                <text className="sig__tick" x={L + PW} y={H - 2} textAnchor="end">NOW</text>
              </>
            ) : (
              <>
                {/* ghost LEDs */}
                {COLUMNS.map((_, i) => Array.from({ length: ledRows }, (_, k) => (
                  <rect key={`${i}-${k}`} className="sig__ghost" x={L + i * colW + (colW - cell * 0.62) / 2} y={base - (k + 1) * cell + cell * 0.19}
                    width={cell * 0.62} height={cell * 0.62} rx={cell * 0.12} />
                )))}
                {hits.map(({ h, x1, y }) => (
                  <rect key={h.id} className={`sig__led ${h.status === 'active' ? 'ok' : 'warn'}${dimOf(h)}${selectedId === h.id ? ' is-sel' : ''}${hover?.id === h.id ? ' is-hov' : ''}`}
                    x={x1 - cell * 0.36} y={y - cell * 0.36} width={cell * 0.72} height={cell * 0.72} rx={cell * 0.14} />
                ))}
                {/* mission labels above each Apollo stack, one span label for the Surveyors */}
                {(() => {
                  let prev = -99, raised = false
                  return COLUMNS.map((c, i) => {
                    if (!c.length || c[0].mission.startsWith('Surveyor')) return null
                    raised = (i - prev) * colW < 20 ? !raised : false // stagger labels that would touch
                    prev = i
                    return <text key={i} className="sig__lab" x={L + (i + 0.5) * colW} y={base - c.length * cell - 3 - (raised ? 9 : 0)} textAnchor="middle">{short(c[0].mission)}</text>
                  })
                })()}
                <text className="sig__lab" x={x(1966.4)} y={base - 2 * cell - 3}>SURVEYOR 1–7</text>
                {(x(1967) - x(1966) < 40 ? [1966, 1968, 1970, 1972] : [1966, 1967, 1968, 1969, 1970, 1971, 1972]).map((y) => (
                  <text key={y} className="sig__tick" x={x(y)} y={H - 2} textAnchor={y === 1966 ? 'start' : 'middle'}>{y}</text>
                ))}
                <text className="sig__tick" x={L + PW} y={H - 2} textAnchor="end">1973</text>
              </>
            )}

            {/* crosshair */}
            {hover && !drag && hover.x >= L && hover.x <= L + PW && (
              <line className="sig__cross" x1={hover.x} x2={hover.x} y1={TOP} y2={base} />
            )}
          </svg>
        )}
      </div>
    </div>
  )
}
