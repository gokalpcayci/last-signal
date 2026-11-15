import type { DeepSpaceHardware } from '../data/deepspace'

/**
 * Deep Space stand-in for the globe: every craft on one log ruler from the Sun (top) to
 * Voyager 1 (bottom), printed in the same ASCII language as the timeline.
 */
const W = 12
const MAX_AU = 200
const col = (au: number) => Math.round((Math.log10(1 + au) / Math.log10(1 + MAX_AU)) * (W - 1))

export default function DistanceLadder({ items, selectedId, onSelect }: {
  items: DeepSpaceHardware[]; selectedId: string | null; onSelect: (id: string) => void
}) {
  const rows = [...items].sort((a, b) => a.au - b.au)
  return (
    <div className="ladder" aria-label="Distance from the Sun">
      <div className="ladder__ruler" aria-hidden>{'☉' + '·'.repeat(W - 2) + '▸'}</div>
      {rows.map((h) => {
        const c = col(h.au)
        return (
          <button key={h.id} className={`ladder__row${h.id === selectedId ? ' is-on' : ''}`} onClick={() => onSelect(h.id)}>
            <span className="ladder__track" aria-hidden>
              {'·'.repeat(c)}<b className={h.status === 'active' ? 'ok' : 'warn'}>{h.status === 'active' ? '●' : '×'}</b>{' '.repeat(W - 1 - c)}
            </span>
            <span className="ladder__name">{h.name.toUpperCase()}</span>
            <span className="ladder__au">{h.au < 10 ? h.au.toFixed(1) : Math.round(h.au)} AU</span>
          </button>
        )
      })}
      <div className="ladder__note">1 AU = Earth to Sun, 150 million km</div>
    </div>
  )
}
