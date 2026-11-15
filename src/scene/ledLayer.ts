/**
 * Drawing kit for the Deep Space LED layer: a 2D canvas over the WebGL map whose LEDs sit on the
 * exact same cells as the plane shader (planeMaterial in DeepSpaceScene), so probes, trails, labels
 * and the plane read as one display.
 *
 *  - Big LEDs (one per map cell): probe sprites, trails, pulses, cluster digits.
 *  - Small LEDs (pitch MICRO css px): the 3×5 pixel font for labels, counters and the marquee.
 */

// ── 3×5 pixel font ────────────────────────────────────────────────────────────
// Each glyph: 5 rows of 3 ('#' = lit), concatenated top to bottom.
const G: Record<string, string> = {
  'A': '.#.#.#####.##.#',
  'B': '##.#.###.#.###.',
  'C': '.###..#..#...##',
  'D': '##.#.##.##.###.',
  'E': '####..##.#..###',
  'F': '####..##.#..#..',
  'G': '.###..#.##.#.##',
  'H': '#.##.#####.##.#',
  'I': '###.#..#..#.###',
  'J': '..#..#..##.#.#.',
  'K': '#.##.###.#.##.#',
  'L': '#..#..#..#..###',
  'M': '#.########.##.#',
  'N': '##.#.##.##.##.#',
  'O': '.#.#.##.##.#.#.',
  'P': '##.#.###.#..#..',
  'Q': '.#.#.##.###..##',
  'R': '##.#.###.#.##.#',
  'S': '.###...#...###.',
  'T': '###.#..#..#..#.',
  'U': '#.##.##.##.####',
  'V': '#.##.##.##.#.#.',
  'W': '#.##.########.#',
  'X': '#.##.#.#.#.##.#',
  'Y': '#.##.#.#..#..#.',
  'Z': '###..#.#.#..###',
  '0': '####.##.##.####',
  '1': '.#.##..#..#.###',
  '2': '##...#.#.#..###',
  '3': '##...#.#...###.',
  '4': '#.##.####..#..#',
  '5': '####..##...###.',
  '6': '.###..####.####',
  '7': '###..#.#..#..#.',
  '8': '####.#####.####',
  '9': '####.####..###.',
  ' ': '...............',
  '.': '.............#.',
  ',': '..........#.#..',
  ':': '....#.....#....',
  '·': '.......#.......',
  '-': '......###......',
  '+': '....#.###.#....',
  '/': '..#..#.#.#..#..',
  '~': '...#...#...#...',
  '°': '####.####......',
  '→': '#...#...#.#.#..',
  '▲': '....#.###......',
  '(': '.#.#..#..#...#.',
  ')': '.#...#..#..#.#.',
  '\'': '.#..#..........',
  '×': '...#.#.#.#.#...',
  '♈': '#.####.#..#..#.',
  '↑': '.#.###.#..#..#.',
  '%': '#.#..#.#.#..#.#',
  '?': '##...#.#.....#.',
  // Turkish: the marks have to share the 5 rows, so the letter body shrinks by a row
  'Ç': '####..#..###.#.',
  'Ö': '#.#...####.####',
  'Ü': '#.#...#.##.####',
  'İ': '.#....###.#.###',
  'Ş': '.##.#.##..#....',
  'Ğ': '###....###.####',
}
for (const [k, v] of Object.entries(G)) if (v.length !== 15) throw new Error(`ledLayer font: bad glyph ${k}`)

export const MICRO = 2           // css px between small LEDs
export const GLYPH_W = 4         // 3 columns + 1 gap, in small LEDs

export interface Ctx { g: CanvasRenderingContext2D; pr: number }

/** Width of a micro-font string in css px. */
export const textWidth = (s: string, pitch = MICRO) => s.length * GLYPH_W * pitch - pitch

/** Draw text with small LEDs; (x, y) = top-left in css px. Unlit LEDs are not drawn. */
export function microText({ g, pr }: Ctx, s: string, x: number, y: number, color: string, alpha = 1, pitch = MICRO) {
  const d = pitch * pr, dot = Math.max(1, d * 0.86) // near-solid dots: reads as a crisp pixel font
  g.fillStyle = color
  g.globalAlpha = alpha
  let cx = x * pr
  const cy = y * pr
  for (const ch of s.toUpperCase()) {
    const rows = G[ch] ?? G['?']
    for (let i = 0; i < 15; i++) {
      if (rows[i] !== '#') continue
      g.fillRect(Math.round(cx + (i % 3) * d), Math.round(cy + Math.floor(i / 3) * d), dot, dot)
    }
    cx += GLYPH_W * d
  }
  g.globalAlpha = 1
}

/** Faint unlit LEDs behind a micro-font strip (the LED-sign look). */
export function microGhost({ g, pr }: Ctx, x: number, y: number, w: number, rows = 5, pitch = MICRO, color = '#3d3f3a', alpha = 0.35) {
  const d = pitch * pr, dot = Math.max(1, d * 0.72)
  g.fillStyle = color
  g.globalAlpha = alpha
  for (let r = 0; r < rows; r++) for (let c = 0; c * d < w * pr; c++) g.fillRect(Math.round(x * pr + c * d), Math.round(y * pr + r * d), dot, dot)
  g.globalAlpha = 1
}

// ── big LEDs on the map grid ─────────────────────────────────────────────────

/** The map's LED grid in device px: cell size and the y offset that matches gl_FragCoord (bottom-up). */
export interface Grid { cell: number; oy: number }
export function gridFor(heightDev: number, ledPx: number, pr: number): Grid {
  const cell = ledPx * pr
  return { cell, oy: heightDev % cell }
}
/** Cell index for a css-px point. */
export const cellOf = (grid: Grid, pr: number, x: number, y: number) =>
  [Math.floor((x * pr) / grid.cell), Math.floor((y * pr - grid.oy) / grid.cell)] as const

/** One big LED (rounded square, same proportions as the shader's). */
export function led({ g }: Ctx, grid: Grid, i: number, j: number, color: string, alpha: number, blank = false) {
  const c = grid.cell, x = i * c, y = grid.oy + j * c
  if (blank) { g.globalAlpha = 1; g.fillStyle = '#0d0e0d'; g.fillRect(x, y, c, c) }
  const s = c * 0.58, o = (c - s) / 2
  g.globalAlpha = alpha
  g.fillStyle = color
  g.beginPath()
  g.roundRect(x + o, y + o, s, s, c * 0.12)
  g.fill()
  g.globalAlpha = 1
}

// ── probe sprites (5×5 big LEDs) ────────────────────────────────────────────
export const SPRITES: Record<string, string> = {
  // dish on top, bus, boom with the power unit
  probe: '.###.' + '#####' + '..#..' + '.###.' + '#...#',
  // tube with an open end, tilted
  telescope: '...##' + '..###' + '.###.' + '###..' + '#....',
  // body on legs (NEAR, sitting on Eros)
  lander: '.###.' + '#####' + '.###.' + '#...#' + '#...#',
}

export function sprite(ctx: Ctx, grid: Grid, ci: number, cj: number, kind: string, color: string, alpha = 1) {
  const m = SPRITES[kind] ?? SPRITES.probe
  for (let k = 0; k < 25; k++) {
    const i = ci - 2 + (k % 5), j = cj - 2 + Math.floor(k / 5)
    if (m[k] === '#') led(ctx, grid, i, j, color, alpha, true)
    else led(ctx, grid, i, j, '#3d3f3a', 0.0, true) // clear the plane behind the sprite's box
  }
}

/** Big digits (font pixel = one map LED), centred on a cell. */
export function bigText(ctx: Ctx, grid: Grid, ci: number, cj: number, s: string, color: string, alpha = 1) {
  const w = s.length * 4 - 1
  const i0 = ci - Math.floor(w / 2), j0 = cj - 2
  for (let n = 0; n < s.length; n++) {
    const rows = G[s[n]] ?? G['?']
    for (let k = 0; k < 15; k++) {
      const i = i0 + n * 4 + (k % 3), j = j0 + Math.floor(k / 3)
      led(ctx, grid, i, j, rows[k] === '#' ? color : '#3d3f3a', rows[k] === '#' ? alpha : 0.25, true)
    }
  }
}

/** LEDs along a screen-space segment (one per cell crossed), with a callback for per-step alpha. */
export function ledLine(ctx: Ctx, grid: Grid, pr: number, x0: number, y0: number, x1: number, y1: number, color: string,
  alphaAt: (t: number) => number, every = 1) {
  const n = Math.max(1, Math.ceil((Math.hypot(x1 - x0, y1 - y0) * pr) / grid.cell))
  let last = ''
  for (let s = 0; s <= n; s += every) {
    const t = s / n
    const [i, j] = cellOf(grid, pr, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
    const key = `${i},${j}`
    if (key === last) continue
    last = key
    const a = alphaAt(t)
    if (a > 0.01) led(ctx, grid, i, j, color, a)
  }
}

/** Dark plate behind a label so it reads over the busy LED field. css px. */
export function plate({ g, pr }: Ctx, x: number, y: number, w: number, h: number, alpha = 0.8) {
  g.globalAlpha = alpha
  g.fillStyle = '#0d0e0d'
  g.fillRect(Math.round(x * pr), Math.round(y * pr), Math.round(w * pr), Math.round(h * pr))
  g.globalAlpha = 1
}

/** A probe sprite at small-LED scale (for the legend). (x, y) = top-left, css px. */
export function microSprite({ g, pr }: Ctx, kind: string, x: number, y: number, color: string, pitch = MICRO) {
  const m = SPRITES[kind] ?? SPRITES.probe, d = pitch * pr, dot = Math.max(1, d * 0.86)
  g.fillStyle = color
  for (let k = 0; k < 25; k++) if (m[k] === '#') g.fillRect(Math.round(x * pr + (k % 5) * d), Math.round(y * pr + Math.floor(k / 5) * d), dot, dot)
}
