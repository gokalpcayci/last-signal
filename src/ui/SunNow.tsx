import { useEffect, useState } from 'react'
import { sunAtSite } from '../scene/sun'
import type { PlanetId } from '../scene/planets'
import { useT } from '../strings'


/** Live day/night readout for the story panel: three rows + one plain note. */
export default function SunNow({ lat, lon, body = 'moon' }: { lat: number; lon: number; body?: PlanetId }) {
  const t = useT().sun
  const fmtDays = (d: number) => (d < 1 ? t.hours(Math.max(1, Math.round(d * 24))) : t.days(d))
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const s = sunAtSite(lat, lon, now, body)
  const mars = body === 'mars'
  const temp = s.isDay ? s.tempC : mars ? -80 : -170

  const note = s.isDay
    ? t.high(Math.round(s.elevation))
    : mars ? t.marsNight : t.moonNight

  return (
    <div className={`sunnow sunnow--${s.isDay ? 'day' : 'night'}`}>
      <dl>
        <dt>{t.localTime}</dt><dd className="sunnow__state">{s.isDay ? t.day : t.night}</dd>
        <dt>{t.ground}</dt><dd>≈ {temp} °C</dd>
        <dt>{s.isDay ? t.sunset : t.sunrise}</dt><dd>{t.in(fmtDays(s.daysUntilChange))}</dd>
      </dl>
      <p className="sunnow__note">{note}</p>
    </div>
  )
}
