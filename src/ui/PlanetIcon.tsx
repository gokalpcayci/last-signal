import { useEffect, useId, useRef } from 'react'
import { LedEngine } from '../brand/ledEngine'
import { deepMask, discGrid, planetMask } from '../brand/planetDisc'
import type { WorldId } from '../scene/planets'

/**
 * LED planet disc for the planet switch (src/brand/planetDisc.ts): the real surface, lit by the
 * real Sun right now. Same engine as the logo and the filter toggle: ghost LEDs, boot flicker-in,
 * hover = small tear + sparkle, a split hiccup when it becomes the active world.
 * Moon prints in Regolith; Mars in a muted sandy rust (kept apart from the status orange #e56b47);
 * Deep Space shows a tiny Sun-and-orbits picture in pale sunlight (deepMask).
 */

const INK: Record<WorldId, string> = { moon: '#e6e6df', mars: '#d4875a', deep: '#f2e3b3' }
const REFRESH_MS = 5 * 60 * 1000 // the terminator creeps; Mars' moves ~1° every 4 min

/** Put it inside a button: hovering the button sparkles the disc. */
export default function PlanetIcon({ id, active, size }: { id: WorldId; active: boolean; size: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<LedEngine | null>(null)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const e = new LedEngine(c, { grid: discGrid(), mode: 'boot', ink: INK[id], signals: false, glitch: 0.6, ghost: 0.09 })
    engine.current = e
    e.resize(size)
    e.setMask([], { instant: true }) // ghost disc until the albedo arrives
    let alive = true
    const update = () => (id === 'deep' ? Promise.resolve(deepMask()) : planetMask(id)).then((m) => { if (alive) e.setMask(m, { mode: 'random' }) }).catch((err) => console.error(`PlanetIcon: ${id} albedo failed to load`, err)) // disc stays as ghost LEDs
    e.play('intro').then(() => { if (alive) e.play('ambient') })
    update()
    const t = setInterval(update, REFRESH_MS)
    const btn = c.closest('button')
    const hover = () => { e.glitch(undefined, 'tear'); e.flash('random') }
    btn?.addEventListener('mouseenter', hover)
    return () => { alive = false; clearInterval(t); btn?.removeEventListener('mouseenter', hover); e.destroy(); engine.current = null }
  }, [id, size])

  // "signal acquired" hiccup when this world is chosen
  const was = useRef(active)
  useEffect(() => {
    if (active && !was.current) { engine.current?.glitch(undefined, 'split'); engine.current?.flash('boot') }
    was.current = active
  }, [active])

  return <canvas ref={canvas} className="planet-icon" aria-hidden />
}

/**
 * The planet's name bent along an invisible orbit over the disc (no drawn ring: rings and sweeps
 * are off-style). The disc sits in the middle; the text follows the top arc, centred.
 */
export function OrbitLabel({ size, text }: { size: number; text: string }) {
  const id = useId()
  const r = size / 2 + 6          // orbit radius: just outside the disc
  const box = 2 * (r + 8)         // room for the glyphs' height
  const c = box / 2
  // left → over the top → right, so the text reads left to right
  const d = `M ${c - r} ${c} A ${r} ${r} 0 0 1 ${c + r} ${c}`
  return (
    <svg className="orbit-label" width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden>
      <path id={id} d={d} fill="none" />
      <text><textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{text}</textPath></text>
    </svg>
  )
}
