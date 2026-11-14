import { useEffect, useState } from 'react'
import type { Hardware } from '../data/hardware'
import { activePlanet, loadDem } from '../scene/terrain'

type LatLon = [number, number]

/** Maria (dark lunar "seas") are low basins — pick DEM points well below the mean surface. */
/** Dots on low ground: the Moon's maria, Mars's northern lowlands and basins (planets.ts → globe). */
function mariaPoints(metersAt: (lon: number, lat: number) => number): LatLon[] {
  const { belowM, lonMin, lonMax, step } = activePlanet().globe
  const pts: LatLon[] = []
  for (let lat = -70; lat <= 70; lat += step)
    for (let lon = lonMin; lon <= lonMax; lon += step)
      if (metersAt(lon, lat) < belowM) pts.push([lat, lon])
  return pts
}

/** Slowly rotating orthographic wireframe globe (active planet) with low ground and hardware sites. Key it by planet. */
export default function Globe({ items, selectedId }: { items: Hardware[]; selectedId: string | null }) {
  const [rot, setRot] = useState(0)
  const [maria, setMaria] = useState<LatLon[]>([])

  useEffect(() => {
    let alive = true
    loadDem().then((d) => { if (alive) setMaria(mariaPoints(d.metersAt)) }, (e) => console.error('Globe: failed to load elevation data', e))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let raf = 0
    // gentle sway around the near side (where all Apollo/Surveyor sites are)
    const tick = (t: number) => { setRot(Math.sin(t / 9000) * 35); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const R = 70
  const rad = Math.PI / 180
  const project = (lat: number, lon: number) => {
    const l = (lon + rot) * rad
    return { x: R * Math.cos(lat * rad) * Math.sin(l), y: -R * Math.sin(lat * rad), front: Math.cos(l) > 0.05 }
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
      <g className="globe__maria">
        {maria.map(([lat, lon], i) => {
          const p = project(lat, lon)
          return p.front ? <circle key={i} cx={p.x} cy={p.y} r={0.6} /> : null
        })}
      </g>
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
