import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { hardware, type Hardware } from '../data/hardware'

/**
 * Bottom-left analytics panel: a side-scrolling telemetry printout, 1966 → today.
 * Scroll (trackpad, wheel, drag, arrow keys, swipe) and a playhead slides from the left edge
 * (1966) to the right edge (today). Behind the playhead every object is printed as text, the
 * way a line printer would have logged it (see `buildAscii` for the character set).
 * The playhead date also time-travels the map (App filters `items` by arrival).
 * Nothing moves on its own; it opens scrolled to today, so the whole story is there at first.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export const NOW = (() => { const d = new Date(); return d.getUTCFullYear() + d.getUTCMonth() / 12 + (d.getUTCDate() - 1) / 365 })()

/** ISO date → decimal year. Non-dates ("Still in use today") mean now. */
export const toYear = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? +m[1] + (+m[2] - 1) / 12 + (+m[3] - 1) / 365 : NOW
}
const ARR = new Map(hardware.map((h) => [h.id, toYear(h.arrived)]))
const END = new Map(hardware.map((h) => [h.id, toYear(h.lastSignal)]))
const byArrival = [...hardware].sort((a, b) => ARR.get(a.id)! - ARR.get(b.id)!)

/** Object ids in landing order, and how many had landed by year t (for the map's time travel). */
export const ARRIVAL_ORDER = byArrival.map((h) => h.id)
export const arrivedCount = (t: number) => byArrival.filter((h) => ARR.get(h.id)! <= t).length

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

// ── rows per mission, lanes inside a row ────────────────────────────────────
interface Row { label: string; lanes: number }
const LANE = new Map<string, { row: number; lane: number }>()
const ROWS: Row[] = (() => {
  const groups = new Map<string, Hardware[]>()
  for (const h of byArrival) {
    const k = short(h.mission)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(h)
  }
  return [...groups].map(([label, hs], row) => {
    // long traces on top; short ones share a lane only when they don't overlap
    const lanes: [number, number][][] = []
    for (const h of [...hs].sort((a, b) => END.get(b.id)! - END.get(a.id)!)) {
      const a = ARR.get(h.id)!, e = END.get(h.id)!
      let lane = lanes.findIndex((iv) => iv.every(([s, f]) => e < s - 0.05 || a > f + 0.05))
      if (lane < 0) { lane = lanes.length; lanes.push([]) }
      lanes[lane].push([a, e])
      LANE.set(h.id, { row, lane })
    }
    return { label, lanes: lanes.length }
  })
})()

/** A date when ≥3 objects went quiet together (the 1977 ALSEP shutdown). */
const CLIFF = (() => {
  const n = new Map<string, number>()
  for (const h of hardware) if (/^\d{4}-/.test(h.lastSignal)) n.set(h.lastSignal, (n.get(h.lastSignal) ?? 0) + 1)
  const hit = [...n].find(([, c]) => c >= 3)
  return hit ? { date: hit[0], t: toYear(hit[0]), count: hit[1] } : null
})()

// ── event marks for the caption row: each Apollo landing, and the first Surveyor ──
const MISSION_MARKS: { t: number; label: string }[] = (() => {
  const seen = new Set<string>(), out: { t: number; label: string }[] = []
  for (const h of byArrival) {
    if (seen.has(h.mission)) continue
    seen.add(h.mission)
    if (h.mission.startsWith('Apollo')) out.push({ t: ARR.get(h.id)!, label: short(h.mission) })
    else if (h.mission === 'Surveyor 1') out.push({ t: ARR.get(h.id)!, label: 'SURVEYORS' })
  }
  return out
})()

// ── narration: the latest event at or before the playhead ───────────────────
const EVENTS: { t: number; text: string }[] = (() => {
  const ev: { t: number; text: string }[] = []
  const missions = new Map<string, Hardware[]>()
  for (const h of byArrival) { if (!missions.has(h.mission)) missions.set(h.mission, []); missions.get(h.mission)!.push(h) }
  for (const [m, hs] of missions) {
    const t = ARR.get(hs[0].id)!
    ev.push({ t, text: m.startsWith('Surveyor') ? `${m.toUpperCase()} LANDS` : `${m.toUpperCase()} · ${hs.length} OBJECT${hs.length > 1 ? 'S' : ''} LEFT BEHIND` })
    if (m.startsWith('Surveyor')) ev.push({ t: END.get(hs[0].id)!, text: `${m.toUpperCase()} GOES QUIET` })
  }
  if (CLIFF) ev.push({ t: CLIFF.t, text: `${CLIFF.count} SCIENCE STATIONS SWITCHED OFF` })
  const live = hardware.filter((h) => h.status === 'active').length
  ev.push({ t: NOW - 0.01, text: `${live} STILL TALKING TODAY` })
  return ev.sort((a, b) => a.t - b.t)
})()

// time axis: the busy years get room, the long quiet after 1978 is squeezed 8×
const T0 = 1966, TB = 1978, SQUEEZE = 8
const GUTTER = 34, PAD = 10

// ── the printout ────────────────────────────────────────────────────────────
// One text row per mission:
//   ▪ landed   = two long traces side by side   - one   : / . the same after going silent (signal decay)
//   × went quiet, then a fading afterglow . . .  ·   (abandoned, not forgotten)
//   · not recorded yet   ▌/│ print head   ┊ the 1977 shutdown   ▼ events, printed once passed
// Fresh ink: the few columns just behind the print head print brighter.
// Colours stay status-only: green = still talking at the playhead, orange = silent by then.
const A_ROWS = ROWS.length + 2 // caption row + one per mission + ruler (the overview bar sits below, outside)
const GLOW = [1, 2, 4, 7, 11, 16, 22] // afterglow dots: columns after an object went quiet, thinning out
const INK = 5 // columns of fresh ink behind the print head

interface Run { text: string; cls: string }
interface AsciiGrid { rows: Run[][]; cols: number }

function buildAscii(o: {
  cols: number; ch: number; p: number; atNow: boolean; headCol: number
  x: (t: number) => number; tAt: (px: number) => number
  visible: Set<string>; selectedId: string | null; hoverId: string | null
}): AsciiGrid {
  const { cols, ch, p, atNow, headCol, x, tAt, visible, selectedId, hoverId } = o
  const colOf = (t: number) => Math.floor(x(t) / ch)
  const t0 = (c: number) => tAt(c * ch), t1 = (c: number) => tAt((c + 1) * ch)
  const toRuns = (chars: string[], cls: string[]) => {
    const runs: Run[] = []
    chars.forEach((c, i) => {
      const last = runs[runs.length - 1]
      if (last && last.cls === cls[i]) last.text += c
      else runs.push({ text: c, cls: cls[i] })
    })
    return runs
  }
  const mark = (ids: string[], base: string) => {
    let k = base
    if (ids.length && ids.every((id) => !visible.has(id))) k += ' out'
    if (selectedId && ids.includes(selectedId)) k += ' sel'
    else if (hoverId && ids.includes(hoverId)) k += ' hov'
    return k
  }

  // caption row: events printed once the playhead has passed them (never overlapping each other)
  const cap = Array<string>(cols).fill(' '), capC = Array<string>(cols).fill('')
  const put = (txt: string, at: number, k: string) => {
    if (at < 0 || at + txt.length > cols) return false
    for (let i = 0; i < txt.length; i++) if (cap[at + i] !== ' ') return false
    for (let i = 0; i < txt.length; i++) { cap[at + i] = txt[i]; capC[at + i] = k }
    return true
  }
  if (CLIFF && p >= CLIFF.t) { const txt = `${fmtDay(CLIFF.date)} · ${CLIFF.count} STATIONS OFF ▼`; put(txt, colOf(CLIFF.t) - txt.length + 1, 'warn') }
  if (atNow) put('TODAY ▼', cols - 7, 'ok')
  for (const m of MISSION_MARKS) if (m.t <= p) put(`▼${m.label}`, colOf(m.t), 'dim') || put('▼', colOf(m.t), 'dim')
  put('1 TICK = 10 YEARS →', colOf(TB) + 2, 'faint')
  const rows: Run[][] = [toRuns(cap, capC)]

  const cliffCol = CLIFF && p >= CLIFF.t ? colOf(CLIFF.t) : -1
  ROWS.forEach((_, ri) => {
    const objs = byArrival.filter((h) => LANE.get(h.id)!.row === ri && ARR.get(h.id)! <= p)
    // afterglow: column → strength index, from every long trace that has gone quiet
    const glow = new Map<number, number>()
    for (const h of objs) {
      if (LANE.get(h.id)!.lane > 1 || END.get(h.id)! >= p) continue
      const ec = colOf(END.get(h.id)!)
      GLOW.forEach((d, gi) => { const c = ec + d; if (!glow.has(c) || glow.get(c)! > gi) glow.set(c, gi) })
    }
    const chars: string[] = [], cls: string[] = []
    for (let c = 0; c < cols; c++) {
      const a0 = t0(c), a1 = t1(c)
      if (c > headCol) { chars.push(c % 4 === 0 ? '·' : ' '); cls.push('faint'); continue }
      // long traces live in lanes 0 and 1; short visits (3-day landers, rovers) are just their landing mark
      const cover = objs.filter((h) => LANE.get(h.id)!.lane <= 1 && ARR.get(h.id)! < a1 && Math.min(END.get(h.id)!, p) >= a0)
      const land = objs.find((h) => ARR.get(h.id)! >= a0 && ARR.get(h.id)! < a1)
      const quiet = objs.find((h) => LANE.get(h.id)!.lane <= 1 && END.get(h.id)! < p && END.get(h.id)! >= a0 && END.get(h.id)! < a1)
      const alive = (h: Hardware) => END.get(h.id)! >= p - 1e-6
      let g = ' ', k = 'faint', ids: string[] = []
      if (land) { g = '▪'; k = alive(land) ? 'ok' : 'warn'; ids = [land.id] }
      else if (quiet) { g = '×'; k = 'warn'; ids = [quiet.id] }
      else if (cover.length) {
        const live = cover.some(alive)
        g = live ? (cover.length > 1 ? '=' : '-') : (cover.length > 1 ? ':' : '.')
        k = live ? 'ok' : 'warn dim'
        ids = cover.map((h) => h.id)
      } else if (c === cliffCol) { g = '┊'; k = 'warn dim' }
      else if (glow.has(c)) { const gi = glow.get(c)!; g = gi < 3 ? '.' : '·'; k = `warn glow${Math.min(3, Math.floor(gi / 2) + 1)}` }
      // print head: the pen tip on a live trace, a thin rule elsewhere
      if (c === headCol && !atNow) {
        if (g === ' ') { g = '│'; k = 'head' }
        else { if (cover.some(alive) && !land) g = '▌'; k += ' head' }
      } else if (g !== ' ' && headCol - c <= INK && !k.includes('glow')) k += ` ink${headCol - c <= 1 ? 1 : 2}`
      chars.push(g); cls.push(mark(ids, k))
    }
    rows.push(toRuns(chars, cls))
  })

  // ruler: ·'66·····'67·· … //·· 1980 ·· … ··NOW
  const rul = Array<string>(cols).fill('·'), rulC = Array<string>(cols).fill('faint')
  const label = (txt: string, at: number, k: string) => { for (let i = 0; i < txt.length; i++) if (at + i >= 0 && at + i < cols) { rul[at + i] = txt[i]; rulC[at + i] = k } }
  for (let y = T0; y < TB; y++) label(`'${String(y).slice(2)}`, colOf(y), 'dim')
  label('//', colOf(TB) - 1, 'dim')
  for (const y of [1980, 1990, 2000, 2010, 2020]) if (y < NOW - 3) label(String(y), colOf(y) - 1, 'dim')
  label('NOW', cols - 3, 'dim')
  if (!atNow && rul[headCol] === '·') { rul[headCol] = '┴'; rulC[headCol] = 'head' } // never over a label
  rows.push(toRuns(rul, rulC))
  return { rows, cols }
}

export default function SignalChart({ items, selectedId, onSelect, onTime }: {
  items: Hardware[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** playhead date in decimal years, or null when it sits at today */
  onTime: (t: number | null) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [scroll, setScroll] = useState({ left: 0, max: 0 })
  const [ch, setCh] = useState(0) // measured width of one character
  const [hoverId, setHoverId] = useState<string | null>(null)
  const pan = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const opened = useRef(false)
  const fracRef = useRef(1) // 0 = 1966 at the left edge, 1 = today at the right edge

  // ── geometry: viewport, time scale, character grid ──
  const VW = Math.max(10, size.w - GUTTER)
  const H = size.h
  const pxYr = Math.max(56, VW / 4) // ~4 busy years per screen
  const pxQuiet = pxYr / SQUEEZE
  const CW = PAD * 2 + (TB - T0) * pxYr + (NOW - TB) * pxQuiet
  const x = (t: number) => PAD + (t <= TB ? (t - T0) * pxYr : (TB - T0) * pxYr + (t - TB) * pxQuiet)
  const tAt = (cx: number) => {
    const d = cx - PAD
    if (d <= (TB - T0) * pxYr) return T0 + Math.max(0, d) / pxYr
    return Math.min(NOW, TB + (d - (TB - T0) * pxYr) / pxQuiet)
  }
  // text rows fill the height; the strip is a whole number of character cells wide
  const LH = Math.max(9, Math.min(14, Math.floor(H / A_ROWS)))
  const FS = Math.max(8, LH - 2)
  const cols = ch ? Math.ceil(CW / ch) : 0
  const contentW = ch ? cols * ch : CW

  useLayoutEffect(() => {
    const measure = () => { const el = measureRef.current; if (el) setCh(el.getBoundingClientRect().width / 50) }
    measure()
    document.fonts?.ready.then(measure)
  }, [FS])

  // playhead slides with the scroll: left edge at the start, right edge at the end
  const frac = scroll.max > 0 ? scroll.left / scroll.max : 1
  const headX = scroll.left + frac * VW
  const p = scroll.max > 0 ? tAt(headX) : NOW
  const atNow = p >= NOW - 0.02

  useEffect(() => {
    const el = scrollRef.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // open at today (the full picture); on resize keep the same place in time, not the same pixel
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !size.w) return
    const max = el.scrollWidth - el.clientWidth
    el.scrollLeft = opened.current ? fracRef.current * max : max
    opened.current = true
    setScroll({ left: el.scrollLeft, max })
  }, [size.w, size.h, contentW])

  // tell the map; null at today so nothing is filtered
  useEffect(() => { onTime(atNow ? null : p) }, [p, atNow, onTime])

  // vertical wheel scrolls sideways (needs a non-passive listener to stop the page)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = el.scrollWidth - el.clientWidth
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onScroll = () => {
    const el = scrollRef.current!
    const max = el.scrollWidth - el.clientWidth
    fracRef.current = max > 0 ? el.scrollLeft / max : 1
    setScroll({ left: el.scrollLeft, max })
  }

  const visible = new Set(items.map((h) => h.id))

  // hit-test on the text grid: rows are lines (caption first); upper half = lane 0, lower half = lane 1
  const pick = (cx: number, cy: number): Hardware | null => {
    const ri = Math.floor(cy / LH) - 1
    if (!ch || ri < 0 || ri >= ROWS.length) return null
    const half = cy % LH < LH / 2 ? 0 : 1
    let best: Hardware | null = null, bd = 2 * ch
    for (const h of byArrival) {
      const { row, lane } = LANE.get(h.id)!
      const a = ARR.get(h.id)!
      if (row !== ri || a > p || !visible.has(h.id)) continue
      const x1 = x(a), x2 = lane <= 1 ? x(Math.min(END.get(h.id)!, p)) : x1
      const dx = cx < x1 ? x1 - cx : cx > x2 ? cx - x2 : 0
      const d = dx + (lane <= 1 ? (lane === half ? 0 : ch / 2) : ch / 4)
      if (d < bd) { bd = d; best = h }
    }
    return best
  }

  // ── pointer: hover readout, click selects, mouse-drag pans (touch scrolls natively) ──
  const local = (e: React.PointerEvent) => {
    const el = scrollRef.current!, r = el.getBoundingClientRect()
    return [e.clientX - r.left + el.scrollLeft, e.clientY - r.top]
  }
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    pan.current = { x: e.clientX, left: scrollRef.current!.scrollLeft, moved: false }
    scrollRef.current!.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (pan.current) {
      const dx = e.clientX - pan.current.x
      if (Math.abs(dx) > 4) pan.current.moved = true
      if (pan.current.moved) { scrollRef.current!.scrollLeft = pan.current.left - dx; return }
    }
    const [cx, cy] = local(e)
    setHoverId(pick(cx, cy)?.id ?? null)
  }
  const onUp = (e: React.PointerEvent) => {
    const wasPan = pan.current?.moved
    pan.current = null
    if (wasPan) return
    const [cx, cy] = local(e)
    const hit = pick(cx, cy)
    if (hit) onSelect(hit.id)
  }

  // ── readout line ──
  const hovered = hoverId ? hardware.find((h) => h.id === hoverId) : null
  const talking = hardware.filter((h) => ARR.get(h.id)! <= p && END.get(h.id)! >= p - 1e-6).length
  const event = [...EVENTS].reverse().find((ev) => ev.t <= p)
  let readout: React.ReactNode = (
    <span className="sig__read">{event ? event.text : 'LISTENING FOR SIGNALS…'}<i>{talking} TALKING</i></span>
  )
  if (hovered) {
    const a = ARR.get(hovered.id)!, e = END.get(hovered.id)!
    readout = (
      <span className="sig__read">
        <b className={hovered.status === 'active' ? 'ok' : 'warn'}>{hovered.status === 'active' ? '●' : '▲'}</b>
        {hovered.mission.toUpperCase()} · {hovered.name.toUpperCase()}
        <i>{fmtDay(hovered.arrived)} → {fmtDay(hovered.lastSignal)} · {span(a, e)}</i>
      </span>
    )
  }

  const grid = cols && size.w
    ? buildAscii({ cols, ch, p, atNow, headCol: Math.floor(headX / ch), x, tAt, visible, selectedId, hoverId })
    : null
  const textStyle = { fontSize: FS, lineHeight: `${LH}px` }

  // overview bar: one cell per slice of the whole strip
  const barN = ch ? Math.max(0, Math.floor(VW / ch) - 2) : 0
  const bar = Array.from({ length: barN }, (_, i) => {
    const a = (i / barN) * contentW, b = ((i + 1) / barN) * contentW
    return b > scroll.left && a < scroll.left + VW ? '▓' : '░'
  }).join('')
  const onBar = (e: React.PointerEvent) => {
    const el = scrollRef.current
    if (!el) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    el.scrollLeft = ((e.clientX - r.left) / r.width) * contentW - VW / 2
  }
  const nudge = (dir: number) => scrollRef.current?.scrollBy({ left: dir * VW * 0.8, behavior: 'smooth' })

  return (
    <div className="panel chart">
      <div className="sig__head">
        <div className="panel__title">{readout}</div>
        <span className="sig__date">{fmtT(p)}</span>
      </div>

      <div className="sig">
        {/* fixed row labels; the printout scrolls under them */}
        <pre className="asc asc__labels" style={{ ...textStyle, width: GUTTER }} aria-hidden>
          {['', ...ROWS.map((r) => r.label)].join('\n')}
        </pre>
        <span ref={measureRef} className="asc asc__measure" style={{ fontSize: FS }} aria-hidden>{'0'.repeat(50)}</span>

        <div className="sig__scroll" id="sig-strip" ref={scrollRef} tabIndex={0} onScroll={onScroll}
          role="group" aria-label="Timeline 1966 to today. Scroll sideways to move through time."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
          onPointerLeave={() => { if (!pan.current) setHoverId(null) }}>
          {grid && (
            <pre className="asc" style={{ ...textStyle, width: contentW }}>
              {grid.rows.map((row, i) => (
                <div key={i}>{row.map((r, j) => <span key={j} className={r.cls}>{r.text}</span>)}</div>
              ))}
            </pre>
          )}
        </div>
      </div>

      {/* overview: the whole timeline in one line; ▓ is the slice on screen. Click or drag to jump. */}
      {barN > 0 && (
        <div className="sig__overview" style={textStyle}>
          <button className="asc" style={{ width: GUTTER }} disabled={scroll.left <= 1} aria-label="Scroll back in time" onClick={() => nudge(-1)}>◀</button>
          <pre className="asc sig__bar" onPointerDown={onBar} onPointerMove={(e) => { if (e.buttons) onBar(e) }}
            role="scrollbar" aria-controls="sig-strip" aria-orientation="horizontal" aria-valuenow={Math.round(frac * 100)} aria-label="Timeline overview">
            {bar}
          </pre>
          <button className="asc" disabled={scroll.left >= scroll.max - 1} aria-label="Scroll forward in time" onClick={() => nudge(1)}>▶</button>
        </div>
      )}
    </div>
  )
}
