import { useEffect, useState } from 'react'
import type { Hardware } from '../data/hardware'
import type { PlanetId } from '../scene/planets'
import { subsolarLon, sunAtSite } from '../scene/sun'
import { useT, type Strings } from '../strings'
import { up } from '../i18n'
import { loc } from '../data/localize'
import './siteClock.css'

/**
 * Bottom-left panel on the Moon and Mars: "Day & night now". One row per landing site (objects
 * grouped by mission), live from the real Sun (src/scene/sun.ts, the same model as the story
 * panel's day/night line): is the Sun up there right now, where the site is in its own day, and
 * how long until the next sunrise or sunset. Click a row to fly to that site.
 * The day strip is one full local day (sun time 00 → 24): ▓ daylight, ░ night, █ now.
 * Approximate: the Sun's latitude (seasons) is ignored, as in SunNow.
 */

type Props = {
  body: PlanetId
  list: Hardware[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const CELLS = 12 // one local day, 2 sun-hours per cell

const wrap = (h: number) => ((h % 24) + 24) % 24
const fmtWait = (days: number, c: Strings['clock']) => {
  const h = days * 24
  if (h >= 24) return `${Math.floor(days)} ${c.d} ${Math.floor(h % 24)} ${c.h}`
  return `${Math.floor(h)} ${c.h} ${String(Math.floor((h * 60) % 60)).padStart(2, '0')} ${c.m}`
}
/** row label: Moon = the mission (APOLLO 11); Mars = its main object, which is the name kids know
 *  ("Mars Science Laboratory" → CURIOSITY, "Mars 2020" → PERSEVERANCE, "Viking 1 Lander" → VIKING 1) */
const labelOf = (rep: Hardware, body: PlanetId) =>
  up(body === 'mars' ? rep.name.replace(/\s*\(.*\)$/, '').replace(/ Lander$/, '') : loc(rep).mission)

export default function SiteClock({ body, list, selectedId, onSelect }: Props) {
  const c = useT().clock
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // one row per mission, at its first-listed object (the lander)
  const sites: { rep: Hardware; ids: Set<string> }[] = []
  for (const h of list) {
    const s = sites.find((x) => x.rep.mission === h.mission)
    if (s) s.ids.add(h.id); else sites.push({ rep: h, ids: new Set([h.id]) })
  }
  const sub = subsolarLon(now, body)
  const rows = sites.map(({ rep, ids }) => {
    const sun = sunAtSite(rep.lat, rep.lon, now, body)
    const sunTime = wrap(12 + (rep.lon - sub) / 15) // local "sun time": 12 = Sun highest
    const nowCell = Math.floor((sunTime / 24) * CELLS)
    const strip = Array.from({ length: CELLS }, (_, i) => {
      const mid = ((i + 0.5) / CELLS) * 24
      return { ch: i === nowCell ? '█' : mid >= 6 && mid < 18 ? '▓' : '░', cls: i === nowCell ? 'now' : mid >= 6 && mid < 18 ? 'day' : 'night' }
    })
    return { rep, ids, sun, strip }
  })
  const lit = rows.filter((r) => r.sun.isDay).length

  return (
    <div className="panel clock">
      <div className="panel__head">
        <div className="panel__title">{c.title} <span className="panel__tag">[{useT().story.live}]</span></div>
        <span className="clock__sum"><b>☀ {lit}</b> · <span>☾ {rows.length - lit}</span></span>
      </div>
      <p className="clock__lead">{c.lead[body]}</p>
      <ul className="clock__rows">
        {rows.map(({ rep, ids, sun, strip }) => (
          <li key={rep.mission}>
            <button className={`clock__row${selectedId && ids.has(selectedId) ? ' is-on' : ''}`} onClick={() => onSelect(rep.id)}
              aria-label={c.aria(labelOf(rep, body), sun.isDay, fmtWait(sun.daysUntilChange, c))}>
              <span className="clock__name">{labelOf(rep, body)}</span>
              <span className={`clock__icon${sun.isDay ? ' is-day' : ''}`} aria-hidden>{sun.isDay ? '☀' : '☾'}</span>
              <span className="clock__strip" aria-hidden>{strip.map((c, i) => <i key={i} className={c.cls}>{c.ch}</i>)}</span>
              <span className="clock__next">{sun.isDay ? c.sunset : c.sunrise} {fmtWait(sun.daysUntilChange, c)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
