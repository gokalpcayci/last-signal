import { useEffect, useState } from 'react'
import type { Hardware } from '../data/hardware'

/** Slowly rotating orthographic wireframe Moon with hardware sites. */
export default function Globe({ items, selectedId }: { items: Hardware[]; selectedId: string | null }) {
  const [rot, setRot] = useState(0)
  useEffect(() => {
    let raf = 0
    const tick = (t: number) => { setRot((t / 120) % 360); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const R = 70
  const rad = Math.PI / 180
  const project = (lat: number, lon: number) => {
    const l = (lon + rot) * rad
    return { x: R * Math.cos(lat * rad) * Math.sin(l), y: -R * Math.sin(lat * rad), front: Math.cos(l) > 0 }
  }
  const meridians = Array.from({ length: 12 }, (_, i) => i * 30)
  const parallels = [-60, -30, 0, 30, 60]

  return (
    <svg viewBox="-80 -80 160 160" className="globe">
      <circle r={R} className="globe__outline" />
      {parallels.map((lat) => (
        <ellipse key={lat} cy={-R * Math.sin(lat * rad)} rx={R * Math.cos(lat * rad)} ry={R * Math.cos(lat * rad) * 0.06} className="globe__line" />
      ))}
      {meridians.map((m) => {
        const l = ((m + rot) % 180) * rad
        return <ellipse key={m} rx={Math.abs(R * Math.cos(l))} ry={R} className="globe__line" />
      })}
      {items.map((h) => {
        const p = project(h.lat, h.lon)
        if (!p.front) return null
        return (
          <circle key={h.id} cx={p.x} cy={p.y} r={h.id === selectedId ? 3.2 : 1.8}
            className={`globe__dot globe__dot--${h.status}${h.id === selectedId ? ' is-selected' : ''}`} />
        )
      })}
    </svg>
  )
}
