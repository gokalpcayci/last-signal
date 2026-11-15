import { useT } from '../strings'
import { SPRITES } from '../scene/ledLayer'
import './deepKey.css'

/**
 * Deep Space bottom-left panel: the map key, in readable text (the 3×5 LED font on the map has no
 * Turkish letters and was too small for this). Icons are the map's own LED marks, drawn as SVG.
 * Order matches T().deep.legend / keyHelp.
 */

const C = { ok: '#5fd068', warn: '#e56b47', dim: '#9a9b93', planet: '#a39876', sun: '#f2e3b3', out: '#7f97ab' }

/** A few LEDs on a 5×5 grid. cells = [col, row, alpha] */
function Leds({ cells, color }: { cells: [number, number, number?][]; color: string }) {
  return (
    <svg className="dkey__icon" viewBox="0 0 5 5" aria-hidden>
      {cells.map(([x, y, a = 1], i) => <rect key={i} x={x + 0.12} y={y + 0.12} width={0.76} height={0.76} rx={0.14} fill={color} opacity={a} />)}
    </svg>
  )
}
const sprite = (kind: string): [number, number][] =>
  [...SPRITES[kind]].flatMap((c, k) => (c === '#' ? [[k % 5, Math.floor(k / 5)] as [number, number]] : []))

const ICONS: { cells: [number, number, number?][]; color: string }[] = [
  { cells: sprite('probe'), color: C.ok },                                                              // talking
  { cells: sprite('probe'), color: C.warn },                                                            // silent
  { cells: sprite('telescope'), color: C.dim },                                                         // telescope / lander
  { cells: [[2, 2], [1, 1, 0.6], [3, 3, 0.6], [3, 1, 0.6], [1, 3, 0.6]], color: C.warn },               // last signal ×
  { cells: [[3, 1], [3, 2], [2, 1], [2, 2], [1, 2, 0.6], [0, 3, 0.35]], color: C.planet },              // planet + tail
  { cells: [[2, 2], [2, 1, 0.7], [1, 2, 0.7], [3, 2, 0.7], [2, 3, 0.7]], color: C.sun },                // flyby
  { cells: [[0, 2, 0.7], [2, 2, 0.7], [4, 2, 0.7]], color: C.warn },                                    // sun's bubble edge
  { cells: [[0, 1, 0.6], [2, 3, 0.6], [4, 1, 0.6], [1, 4, 0.4], [3, 0, 0.4]], color: C.out },           // interstellar
]
const LABEL_COLOR = [C.ok, C.warn, undefined, C.warn, undefined, C.sun, undefined, C.out]

export default function DeepKey() {
  const t = useT().deep
  return (
    <div className="panel dkey">
      <div className="panel__head">
        <div className="panel__title">{t.keyTitle}</div>
      </div>
      <ul className="dkey__list">
        {t.legend.map((label, i) => (
          <li key={label}>
            <Leds {...ICONS[i]} />
            <span className="dkey__text">
              <b style={LABEL_COLOR[i] ? { color: LABEL_COLOR[i] } : undefined}>{label}</b>
              <span>{t.keyHelp[i]}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
