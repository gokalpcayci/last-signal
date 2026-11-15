import { useEffect, useState } from 'react'
import { deepSpaceHardware } from '../data/deepspace'

/**
 * Deep Space bottom-left panel (Moon/Mars show "Day & night now" here, src/ui/SiteClock.tsx): how long a radio message
 * takes to reach each craft that still talks. Press PING and watch your message travel in real
 * time — the countdown is the real one-way light time from today's distance.
 * Distances are the JPL snapshot in deepspace.ts (au); light covers 1 AU in 499.005 s.
 */

const SEC_PER_AU = 499.004784
const BAR = 14

const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m ${String(sec).padStart(2, '0')} s`
}
const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
const bar = (f: number) => {
  const n = Math.round(Math.min(1, f) * BAR)
  return '▓'.repeat(n) + '░'.repeat(BAR - n)
}

export default function SignalDelay({ onSelect }: { onSelect: (id: string) => void }) {
  const crafts = deepSpaceHardware.filter((h) => h.status === 'active').sort((a, b) => b.au - a.au)
  const [sent, setSent] = useState<Record<string, number>>({})
  const [now, setNow] = useState(() => Date.now())
  const anySent = Object.keys(sent).length > 0
  useEffect(() => {
    if (!anySent) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [anySent])

  return (
    <div className="panel delay">
      <div className="panel__head">
        <div className="panel__title">Message time <span className="panel__tag">[LIVE]</span></div>
      </div>
      <p className="delay__lead">Radio waves fly at the speed of light — 300,000 km every second. Ping a probe and see how long your hello takes.</p>
      <ul className="delay__rows">
        {crafts.map((h) => {
          const secs = h.au * SEC_PER_AU
          const at = sent[h.id]
          const gone = at != null ? (now - at) / 1000 : 0
          const left = secs - gone
          return (
            <li key={h.id}>
              <button className="panel__ref delay__name" onClick={() => onSelect(h.id)}>{h.name.toUpperCase()}</button>
              {at == null ? (
                <>
                  <span className="delay__time">{fmtDur(secs)} one way</span>
                  <button className="delay__ping" onClick={() => { setSent((s) => ({ ...s, [h.id]: Date.now() })); setNow(Date.now()) }}>[ PING ]</button>
                </>
              ) : left > 0 ? (
                <span className="delay__fly ok">
                  {bar(gone / secs)} ARRIVES IN {clock(left)}
                </span>
              ) : (
                <span className="delay__fly ok">MESSAGE ARRIVED · REPLY IN {clock(Math.max(0, 2 * secs - gone))}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
