import { useEffect, useState } from 'react'
import { sunAtSite } from '../scene/sun'
import type { PlanetId } from '../scene/planets'

const fmtDays = (d: number) => (d < 1 ? `${Math.max(1, Math.round(d * 24))} h` : `${d.toFixed(1)} days`)

/** Live day/night readout for the story panel: three rows + one plain note. */
export default function SunNow({ lat, lon, body = 'moon' }: { lat: number; lon: number; body?: PlanetId }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const s = sunAtSite(lat, lon, now, body)
  const mars = body === 'mars'
  const temp = s.isDay ? s.tempC : mars ? -80 : -170

  const note = s.isDay
    ? `The Sun sits ${Math.round(s.elevation)}° above the horizon here.`
    : mars
      ? 'A day on Mars, called a sol, is about 40 minutes longer than ours.'
      : 'Not fully dark: sunlight bouncing off Earth (Earthshine) lights the ground a faint blue.'

  return (
    <div className={`sunnow sunnow--${s.isDay ? 'day' : 'night'}`}>
      <dl>
        <dt>Local time</dt><dd className="sunnow__state">{s.isDay ? '☀ DAY' : '☾ NIGHT'}</dd>
        <dt>Ground</dt><dd>≈ {temp} °C</dd>
        <dt>{s.isDay ? 'Sunset' : 'Sunrise'}</dt><dd>in {fmtDays(s.daysUntilChange)}</dd>
      </dl>
      <p className="sunnow__note">{note}</p>
    </div>
  )
}
