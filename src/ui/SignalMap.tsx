import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Hardware } from '../data/hardware'
import type { WorldId } from '../scene/planets'
import { statusAt, useDying } from './useDying'
import { useT } from '../strings'
import { loc } from '../data/localize'
import './signalMap.css'

/**
 * Bottom-middle panel (was a placeholder "radar"): every object on this world as one LED dot at its
 * real position — lon/lat on the Moon and Mars, sky direction for Deep Space — drawn as a schematic
 * (each world's spread of sites fills the panel). The field is an LED panel: a fixed grid of ghost
 * LEDs (~7%, visual-style.md §4) and every object snaps to one cell of it. Green = still talking,
 * orange = gone quiet, ghost = filtered out or not there yet at the timeline playhead. Lit LEDs
 * bleed a faint tint into the 8 cells around them; active ones now and then do the house
 * "signal blink". No rings or sweeps. Click a dot to fly to it. No text readout (user: removed).
 */

type Props = {
  world: WorldId
  list: Hardware[]
  shown: Hardware[]          // what the map currently shows (filters + timeline)
  talking: ReadonlySet<string> // silent objects still talking at the timeline playhead
  selectedId: string | null
  onSelect: (id: string) => void
}

const PITCH = 9  // LED grid pitch (css px); a site's row of objects uses neighbouring cells
const LED = 5    // LED square size
const PAD = 1    // cells kept free along each edge

/** deterministic 0..1 from an id, so blink timing is stable between renders */
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000 }

type Cell = { c: number; r: number }

/** place every object on a cols×rows grid: same-site objects share a row, rows never touch */
function layout(list: Hardware[], cols: number, rows: number) {
  const lons = list.map((h) => h.lon), lats = list.map((h) => h.lat)
  const [x0, x1] = [Math.min(...lons), Math.max(...lons)]
  const [y0, y1] = [Math.min(...lats), Math.max(...lats)]
  const uc = Math.max(1, cols - 1 - 2 * PAD), ur = Math.max(1, rows - 1 - 2 * PAD)
  const col = (lon: number) => PAD + Math.round(uc * ((lon - x0) / (x1 - x0 || 1)))
  const row = (lat: number) => PAD + Math.round(ur * ((y1 - lat) / (y1 - y0 || 1)))
  // objects at the same site (a lander + its rover + ALSEP) land on the same or a touching cell
  const groups: { c: number; r: number; ids: string[] }[] = []
  for (const h of list) {
    const c = col(h.lon), r = row(h.lat)
    const g = groups.find((g) => Math.abs(g.c - c) <= 1 && Math.abs(g.r - r) <= 1)
    if (g) g.ids.push(h.id); else groups.push({ c, r, ids: [h.id] })
  }
  // lay each group out as a horizontal run of LEDs; if it would touch an earlier run (one empty
  // cell of gap all round), try two rows lower, then higher, alternating
  const taken = new Set<string>()
  const free = (c: number, r: number, n: number) => {
    for (let k = -1; k <= n; k++) for (let d = -1; d <= 1; d++) if (taken.has(`${c + k},${r + d}`)) return false
    return true
  }
  const out = new Map<string, Cell & { n: number }>()
  for (const g of groups) {
    const n = g.ids.length
    const c = Math.min(Math.max(0, g.c - Math.floor((n - 1) / 2)), Math.max(0, cols - n))
    let r = g.r
    for (const d of [0, 2, -2, 4, -4, 6, -6]) {
      const rr = g.r + d
      if (rr >= 0 && rr < rows && free(c, rr, n)) { r = rr; break }
    }
    g.ids.forEach((id, k) => { out.set(id, { c: c + k, r, n }); taken.add(`${c + k},${r}`) })
  }
  return out
}

export default function SignalMap({ world, list, shown, talking, selectedId, onSelect }: Props) {
  const t = useT()
  const dying = useDying(shown, talking)
  const fieldRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const set = (w: number, h: number) =>
      setSize((s) => (s && s.w === Math.round(w) && s.h === Math.round(h) ? s : { w: Math.round(w), h: Math.round(h) }))
    // measure now too: hidden panes can hold back the first ResizeObserver callback
    set(el.clientWidth, el.clientHeight)
    const ro = new ResizeObserver(([e]) => set(e.contentRect.width, e.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cols = size ? Math.max(3, Math.floor(size.w / PITCH)) : 0
  const rows = size ? Math.max(3, Math.floor(size.h / PITCH)) : 0
  // centre the grid in the field so the leftover pixels split evenly
  const ox = size ? Math.floor((size.w - cols * PITCH) / 2) : 0
  const oy = size ? Math.floor((size.h - rows * PITCH) / 2) : 0
  const cells = size ? layout(list, cols, rows) : null
  const on = new Set(shown.map((h) => h.id))
  const inset = (PITCH - LED) / 2
  const sel = selectedId && cells && on.has(selectedId) ? cells.get(selectedId) : undefined

  // faint tint bleeding from each lit LED into its 8 neighbours (skipping cells that hold objects)
  const occupied = new Set(cells ? [...cells.values()].map((p) => `${p.c},${p.r}`) : [])
  const bleed = new Map<string, 'active' | 'silent'>()
  if (cells) for (const h of shown) {
    const p = cells.get(h.id)
    if (!p) continue
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const k = `${p.c + dc},${p.r + dr}`
      if (occupied.has(k) || p.c + dc < 0 || p.r + dr < 0 || p.c + dc >= cols || p.r + dr >= rows) continue
      if (bleed.get(k) !== 'active') bleed.set(k, statusAt(h, talking)) // green wins
    }
  }

  return (
    <div className="panel radar smap">
      <div className="smap__title">{t.map.title[world]}</div>
      <div className="smap__field" ref={fieldRef}>
        {size && (
          <svg className="smap__grid" width={size.w} height={size.h} aria-hidden="true">
            <defs>
              <pattern id={`smap-led-${world}`} x={ox} y={oy} width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
                <rect x={inset} y={inset} width={LED} height={LED} />
              </pattern>
              <pattern id={`smap-addr-${world}`} className="smap__addr-led" x={ox} y={oy} width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
                <rect x={inset} y={inset} width={LED} height={LED} />
              </pattern>
            </defs>
            <rect className="smap__ghost" x={ox} y={oy} width={cols * PITCH} height={rows * PITCH} fill={`url(#smap-led-${world})`} />
            {sel && (
              // selection = the LED matrix "addresses" it: its whole row and column light up faintly
              <g className="smap__addr" key={`${sel.c},${sel.r}`}>
                <rect className="smap__addr-row" x={ox} y={oy + sel.r * PITCH} width={cols * PITCH} height={PITCH} fill={`url(#smap-addr-${world})`} />
                <rect className="smap__addr-col" x={ox + sel.c * PITCH} y={oy} width={PITCH} height={rows * PITCH} fill={`url(#smap-addr-${world})`} />
              </g>
            )}
            {[...bleed].map(([k, s]) => {
              const [c, r] = k.split(',').map(Number)
              return <rect key={k} className={`smap__bleed smap__bleed--${s}`} x={ox + c * PITCH + inset} y={oy + r * PITCH + inset} width={LED} height={LED} />
            })}
          </svg>
        )}
        {cells && list.map((h) => {
          const r = hash(h.id)
          const p = cells.get(h.id)!
          const style = {
            left: `${ox + p.c * PITCH + PITCH / 2}px`, top: `${oy + p.r * PITCH + PITCH / 2}px`,
            '--hit': `${p.n > 1 ? PITCH : 24}px`,
            '--blink-delay': `${(r * 9).toFixed(2)}s`, '--blink-dur': `${(6 + r * 5).toFixed(2)}s`,
            '--in-delay': `${(r * 0.6).toFixed(2)}s`,
          } as CSSProperties
          const state = !on.has(h.id) ? 'ghost' : statusAt(h, talking)
          return (
            <button key={h.id} className={`smap__dot smap__dot--${state}${h.id === selectedId ? ' is-on' : ''}${dying.has(h.id) ? ' is-dying' : ''}`} style={style}
              onClick={() => onSelect(h.id)} disabled={state === 'ghost'}
              aria-label={`${loc(h).name}: ${state === 'active' ? t.map.still : t.map.silent}`} title={loc(h).name}>
              <i />
            </button>
          )
        })}
      </div>
    </div>
  )
}
