import { useEffect, useState } from 'react'
import { sunAtSite } from '../scene/sun'
import type { PlanetId } from '../scene/planets'

const fmtDays = (d: number) => (d < 1 ? `${Math.max(1, Math.round(d * 24))} hours` : `${d.toFixed(1)} days`)

/** Live "is it day or night at this site right now?" line for the story panel. */
export default function SunNow({ lat, lon, name, body = 'moon' }: { lat: number; lon: number; name: string; body?: PlanetId }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const s = sunAtSite(lat, lon, now, body)

  if (body === 'mars') return (
    <div className={`sunnow ${s.isDay ? 'sunnow--day' : 'sunnow--night'}`}>
      <span className="sunnow__tag">{s.isDay ? '☀ MARS DAY · LIVE' : '☾ MARS NIGHT · LIVE'}</span>
      {s.isDay
        ? <>The Sun is up at the {name} site right now, about {Math.round(s.elevation)}° above the horizon. The ground is roughly {s.tempC} °C. Sunset in {fmtDays(s.daysUntilChange)}.</>
        : <>It’s night at the {name} site right now — around −80 °C. Sunrise in {fmtDays(s.daysUntilChange)}. A day on Mars (a “sol”) is only about 40 minutes longer than a day on Earth.</>}
    </div>
  )

  return (
    <div className={`sunnow ${s.isDay ? 'sunnow--day' : 'sunnow--night'}`}>
      <span className="sunnow__tag">{s.isDay ? '☀ LUNAR DAY · LIVE' : '☾ LUNAR NIGHT · LIVE'}</span>
      {s.isDay
        ? <>The Sun is up at the {name} site right now, about {Math.round(s.elevation)}° above the horizon. The ground is roughly {s.tempC} °C. Sunset in {fmtDays(s.daysUntilChange)}.</>
        : <>It’s night at the {name} site right now — about −170 °C. Sunrise in {fmtDays(s.daysUntilChange)}. It isn’t pitch black, though: sunlight bouncing off Earth — “Earthshine” — gives the ground a faint blue glow.</>}
    </div>
  )
}
