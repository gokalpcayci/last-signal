/** Nav filter toggle drawn on the logo's own LED engine (same pitch, ghosts, flicker, glitches, signal blink):
 *  an LED picture of the current filter that flickers into a × when the drawer opens. */
import { useEffect, useRef } from 'react'
import { LedEngine } from '../brand/ledEngine'
import type { LedGrid } from '../brand/ledCells'
import './menuButton.css'

export type MenuButtonProps = {
  open: boolean
  onToggle: () => void
  /** filter id ('all', 'lander', …) */
  filter: string
  label: string
  /** CSS px per LED — pass the nav logo's pitch (logo width × 16 / 768) so both read as one display */
  pitch?: number
  controls?: string
}

export default function MenuButton(p: MenuButtonProps) {
  const engine = useRef<LedEngine | null>(null)
  return (
    <button
      className={`nav__toggle menu-btn${p.open ? ' is-open' : ''}`}
      aria-expanded={p.open} aria-controls={p.controls}
      aria-label={`Filter hardware (now: ${p.label})`} title={p.label}
      onClick={p.onToggle}
      // same hover as the logo: a small row tear + a random sparkle
      onMouseEnter={() => { engine.current?.glitch(undefined, 'tear'); engine.current?.flash('random') }}
    >
      <LedFace {...p} engineRef={engine} />
    </button>
  )
}

// ───────────────────────── LED panel ─────────────────────────

const STEP = 16 // design units per LED (same as the logo's coarse grid)

/** A full cols×rows LED panel; the mask decides which LEDs are lit. */
function panel(cols: number, rows: number): LedGrid {
  const cells: number[] = []
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    // depth = ghost visibility: full in the middle, dissolving toward a soft superellipse edge (no hard tile)
    const u = ((x + 0.5) / cols) * 2 - 1, v = ((y + 0.5) / rows) * 2 - 1
    const r = (Math.abs(u) ** 4 + Math.abs(v) ** 4) ** 0.25
    const fade = Math.max(0, Math.min(1, (1.08 - r) / 0.45))
    cells.push((x + 0.5) * STEP, (y + 0.5) * STEP, Math.round(100 * fade * fade))
  }
  return { step: STEP, viewBox: [0, 0, cols * STEP, rows * STEP], center: [cols * STEP / 2, rows * STEP / 2], cells }
}

/** Coverage (0..1 per LED) → mask with inked depth: rim LEDs a bit dimmer than the core, like the logo. */
function toMask(cov: Float32Array, cols: number, rows: number): Float32Array {
  let d = cov
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(d.length)
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let s = 0, k = 0
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j
        s += xx < 0 || yy < 0 || xx >= cols || yy >= rows ? 0 : d[yy * cols + xx]; k++
      }
      out[y * cols + x] = s / k
    }
    d = out
  }
  return cov.map((c, i) => (c >= 0.45 ? 0.55 + 0.45 * Math.sqrt(Math.min(1, d[i] * 1.15)) : 0))
}

/** Rasterize a canvas drawing (in LED units) into a mask. */
function drawMask(cols: number, rows: number, draw: (g: CanvasRenderingContext2D) => void): Float32Array {
  const SS = 4
  const cv = document.createElement('canvas')
  cv.width = cols * SS; cv.height = rows * SS
  const g = cv.getContext('2d')!
  g.scale(SS, SS)
  g.fillStyle = g.strokeStyle = '#fff'
  g.lineCap = g.lineJoin = 'round'
  draw(g)
  const px = g.getImageData(0, 0, cv.width, cv.height).data
  const cov = new Float32Array(cols * rows)
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    let a = 0
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) a += px[((y * SS + j) * cv.width + x * SS + i) * 4 + 3]
    cov[y * cols + x] = a / (255 * SS * SS)
  }
  return toMask(cov, cols, rows)
}

// ───────────────────────── pictures ─────────────────────────

/** Thick × centred in a cols×rows panel. */
function drawClose(g: CanvasRenderingContext2D, cols: number, rows: number) {
  const s = Math.min(cols, rows) * 0.3, cx = cols / 2, cy = rows / 2
  g.lineWidth = Math.max(3, Math.min(cols, rows) * 0.12)
  g.beginPath(); g.moveTo(cx - s, cy - s); g.lineTo(cx + s, cy + s); g.moveTo(cx + s, cy - s); g.lineTo(cx - s, cy + s); g.stroke()
}

/** Hardware silhouettes on a 30×30 panel (LED units). */
const GLYPH: Record<string, (g: CanvasRenderingContext2D) => void> = {
  all(g) { // three slider tracks with ring knobs at different positions
    ;[[8, 19], [15, 10], [22, 17]].forEach(([y, k]) => {
      g.lineWidth = 2
      g.beginPath(); g.moveTo(5, y); g.lineTo(k - 4, y); g.moveTo(k + 4, y); g.lineTo(25, y); g.stroke()
      g.lineWidth = 2; g.beginPath(); g.arc(k, y, 2.6, 0, Math.PI * 2); g.stroke()
    })
  },
  lander(g) {
    g.beginPath(); g.moveTo(10, 8); g.lineTo(20, 8); g.lineTo(22, 16); g.lineTo(8, 16); g.closePath(); g.fill()
    g.lineWidth = 2.4
    g.beginPath(); g.moveTo(10, 15); g.lineTo(5, 24); g.moveTo(20, 15); g.lineTo(25, 24); g.moveTo(15, 16); g.lineTo(15, 23); g.stroke()
    g.lineWidth = 3; g.beginPath(); g.moveTo(3, 25); g.lineTo(7, 25); g.moveTo(23, 25); g.lineTo(27, 25); g.stroke()
    g.lineWidth = 2; g.beginPath(); g.moveTo(15, 8); g.lineTo(15, 4); g.stroke()
  },
  rover(g) {
    g.fillRect(6, 12, 18, 6)
    g.lineWidth = 2.2; g.beginPath(); g.moveTo(20, 12); g.lineTo(20, 6); g.moveTo(17, 6); g.lineTo(23, 6); g.stroke()
    ;[8, 15, 22].forEach((x) => { g.beginPath(); g.arc(x, 21.5, 3, 0, Math.PI * 2); g.fill() })
  },
  science(g) { // dish antenna on a mast
    g.beginPath(); g.ellipse(15, 10, 8, 5, -0.5, 0, Math.PI); g.closePath(); g.fill()
    g.lineWidth = 2.4; g.beginPath(); g.moveTo(15, 12); g.lineTo(15, 23); g.moveTo(15, 9); g.lineTo(19, 5); g.stroke()
    g.lineWidth = 3; g.beginPath(); g.moveTo(9, 25); g.lineTo(21, 25); g.stroke()
  },
  reflector(g) { // corner-cube array with a laser beam
    g.lineWidth = 2; g.beginPath(); g.moveTo(15, 2); g.lineTo(15, 9); g.stroke()
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.fillRect(6 + c * 5, 12 + r * 4.6, 3.6, 3.4)
  },
  robot(g) { // Surveyor tripod
    g.beginPath(); g.moveTo(15, 7); g.lineTo(21, 16); g.lineTo(9, 16); g.closePath(); g.fill()
    g.lineWidth = 2.2; g.beginPath(); g.moveTo(10, 15); g.lineTo(5, 24); g.moveTo(20, 15); g.lineTo(25, 24); g.moveTo(15, 16); g.lineTo(15, 25); g.stroke()
    g.lineWidth = 2; g.beginPath(); g.moveTo(15, 7); g.lineTo(23, 4); g.stroke()
    g.fillRect(21, 2, 5, 4)
  },
  helicopter(g) {
    g.lineWidth = 2.4; g.beginPath(); g.moveTo(4, 5); g.lineTo(26, 5); g.moveTo(6, 9); g.lineTo(24, 9); g.moveTo(15, 5); g.lineTo(15, 13); g.stroke()
    g.beginPath(); g.ellipse(15, 16, 5, 4, 0, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.moveTo(11, 19); g.lineTo(7, 25); g.moveTo(19, 19); g.lineTo(23, 25); g.stroke()
  },
}

// ───────────────────────── face ─────────────────────────

const COLS = 30, ROWS = 30

const maskFor = (open: boolean, filter: string) =>
  drawMask(COLS, ROWS, open ? (g) => drawClose(g, COLS, ROWS) : GLYPH[filter] ?? GLYPH.all)

function LedFace({ open, filter, pitch = 1.4, engineRef }: MenuButtonProps & { engineRef: React.RefObject<LedEngine | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const latest = useRef({ open, filter })
  latest.current = { open, filter }

  // build the engine once per size
  useEffect(() => {
    if (!canvas.current) return
    const e = new LedEngine(canvas.current, { grid: panel(COLS, ROWS), mode: 'boot', glitch: 0.8, ghost: 0.1, ghostFade: true })
    engineRef.current = e
    e.resize(COLS * pitch)
    e.setMask(maskFor(latest.current.open, latest.current.filter), { instant: true })
    let alive = true
    e.play('intro').then(() => { if (alive) e.play('ambient') })
    return () => { alive = false; e.destroy(); engineRef.current = null }
  }, [pitch, engineRef])

  // morph whenever what it shows changes (an unchanged mask is a no-op)
  useEffect(() => {
    const e = engineRef.current
    if (!e) return
    e.setMask(maskFor(open, filter), { mode: 'boot' })
  }, [open, filter, engineRef])
  // "signal acquired" hiccup on open, like the logo's intro
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open && !wasOpen.current) engineRef.current?.glitch(undefined, 'split')
    wasOpen.current = open
  }, [open, engineRef])

  return <canvas ref={canvas} aria-hidden />
}
