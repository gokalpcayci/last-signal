import type { CSSProperties } from 'react'
import type { Hardware } from '../data/hardware'
import type { WorldId } from '../scene/planets'
import './signalMap.css'

/**
 * Bottom-middle panel (was a placeholder "radar"): every object on this world as one LED dot at its
 * real position — lon/lat on the Moon and Mars, sky direction for Deep Space — drawn as a schematic
 * (each world's spread of sites fills the panel). Green = still talking, orange = gone quiet,
 * ghost = filtered out or not there yet at the timeline playhead. Active dots now and then do the
 * house "signal blink" (three quick green blinks). No rings or sweeps (visual-style.md).
 * Click a dot to fly to it; the readout names the hovered/selected object.
 */

type Props = {
  world: WorldId
  list: Hardware[]
  shown: Hardware[]          // what the map currently shows (filters + timeline)
  selectedId: string | null
  onSelect: (id: string) => void
  fmtDate: (s: string) => string
}

const PAD = 0.12 // keep dots off the panel edge (fraction of each axis)
const SAME = 0.035 // spots closer than this (fraction of each axis) count as one site
const STEP_PX = 9  // LED spacing inside a site's row
const TITLE: Record<WorldId, string> = { moon: 'SIGNAL MAP · MOON', mars: 'SIGNAL MAP · MARS', deep: 'SIGNAL MAP · SKY' }

/** deterministic 0..1 from an id, so blink timing is stable between renders */
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000 }

export default function SignalMap({ world, list, shown, selectedId, onSelect, fmtDate }: Props) {
  const lons = list.map((h) => h.lon), lats = list.map((h) => h.lat)
  const [x0, x1] = [Math.min(...lons), Math.max(...lons)]
  const [y0, y1] = [Math.min(...lats), Math.max(...lats)]
  const fx = (lon: number) => PAD + (1 - 2 * PAD) * ((lon - x0) / (x1 - x0 || 1))
  const fy = (lat: number) => PAD + (1 - 2 * PAD) * ((y1 - lat) / (y1 - y0 || 1))
  // objects at the same site (a lander + its rover + ALSEP, or Apollo 12 next to Surveyor 3) would
  // stack: group near-identical spots and lay each group out as a short row of LEDs
  const groups: { x: number; y: number; ids: string[] }[] = []
  for (const h of list) {
    const x = fx(h.lon), y = fy(h.lat)
    const g = groups.find((g) => Math.abs(g.x - x) < SAME && Math.abs(g.y - y) < SAME)
    if (g) g.ids.push(h.id); else groups.push({ x, y, ids: [h.id] })
  }
  // neighbouring sites' rows can still touch (Apollo 12 vs 14): nudge a row down until it is clear.
  // Works in panel fractions assuming a ~250×130 px field (the panel's usual size).
  const half = (g: { ids: string[] }) => ((g.ids.length - 1) / 2) * (STEP_PX / 250) + 0.025
  groups.forEach((g, i) => {
    for (let tries = 0; tries < 4; tries++) {
      const hit = groups.slice(0, i).some((o) => Math.abs(o.x - g.x) < half(o) + half(g) && Math.abs(o.y - g.y) < 0.075)
      if (!hit) break
      g.y += 0.09
    }
  })
  const slot = new Map<string, { x: number; y: number; dx: number; n: number }>()
  for (const g of groups) g.ids.forEach((id, k) => slot.set(id, { x: g.x, y: g.y, dx: (k - (g.ids.length - 1) / 2) * STEP_PX, n: g.ids.length }))
  const on = new Set(shown.map((h) => h.id))
  const talking = shown.filter((h) => h.status === 'active').length
  const selected = list.find((h) => h.id === selectedId)

  return (
    <div className="panel radar smap">
      <div className="smap__title">{TITLE[world]}</div>
      <div className="smap__field">
        {list.map((h) => {
          const r = hash(h.id)
          const s = slot.get(h.id)!
          const style = {
            left: `calc(${s.x * 100}% + ${s.dx}px)`, top: `${s.y * 100}%`,
            '--hit': `${s.n > 1 ? STEP_PX : 24}px`,
            '--blink-delay': `${(r * 9).toFixed(2)}s`, '--blink-dur': `${(6 + r * 5).toFixed(2)}s`,
          } as CSSProperties
          const state = !on.has(h.id) ? 'ghost' : h.status
          return (
            <button key={h.id} className={`smap__dot smap__dot--${state}${h.id === selectedId ? ' is-on' : ''}`} style={style}
              onClick={() => onSelect(h.id)} disabled={state === 'ghost'}
              aria-label={`${h.name}: ${h.status === 'active' ? 'still working' : 'silent'}`} title={h.name}>
              <i />
            </button>
          )
        })}
      </div>
      <div className="smap__read" aria-live="polite">
        {selected
          ? <><b className={selected.status === 'active' ? 'ok' : 'warn'}>{selected.status === 'active' ? '●' : '▲'}</b> {selected.mission.toUpperCase()} · {/^\d{4}/.test(selected.lastSignal) ? `LAST SIGNAL ${fmtDate(selected.lastSignal).toUpperCase()}` : selected.lastSignal.toUpperCase()}</>
          : <><b className="ok">●</b> {talking} STILL TALKING <span>·</span> <b className="warn">▲</b> {shown.length - talking} QUIET</>}
      </div>
    </div>
  )
}
