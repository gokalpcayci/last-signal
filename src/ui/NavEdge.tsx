/** Stepped, pixel-grid skyline edge under the stacked nav (phones / portrait tablets).
 *  Heights snap to a 6px grid so it reads as LED-matrix pixel art, not noise.
 *  Stretches horizontally only (preserveAspectRatio none + non-scaling stroke). */
const COLS = 48
const STEP = 6 // px per height level
const LEVELS = [0, 1, 2, 3] // → 0, 6, 12, 18px

// deterministic random walk so the silhouette is identical on every render
function heights(): number[] {
  let s = 7, h = 1
  const out: number[] = []
  for (let i = 0; i < COLS; i++) {
    s = (s * 1664525 + 1013904223) >>> 0
    const r = s / 2 ** 32
    if (r < 0.34) h = Math.max(LEVELS[0], h - 1)
    else if (r > 0.66) h = Math.min(LEVELS[LEVELS.length - 1], h + 1)
    out.push(h * STEP)
  }
  return out
}

const H = heights()
const MAX = STEP * LEVELS[LEVELS.length - 1]
const EDGE = H.map((h, i) => `${i === 0 ? 'M' : 'L'}${i},${h} L${i + 1},${h}`).join(' ')

export default function NavEdge() {
  const back = H.map((h, i) => [i, h] as const).reverse().map(([i, h]) => `L${i + 1},${h} L${i},${h}`).join(' ')
  const fill = `M0,0 H${COLS} V${H[COLS - 1]} ${back} Z`
  return (
    <svg className="nav__edge" viewBox={`0 0 ${COLS} ${MAX}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={fill} className="nav__edge-fill" />
      <path d={EDGE} className="nav__edge-line" />
    </svg>
  )
}
