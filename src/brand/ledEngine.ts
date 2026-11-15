import { LED_GRIDS, type LedGrid } from './ledCells'

/**
 * Canvas renderer for the animated LED-matrix Last Signal mark.
 *
 * Every mode is an *arrival order* (0..1 per pixel):
 *   random → pure per-pixel randomness
 *   boot   → depth + randomness (core first)
 *   scan   → height (top to bottom)
 * Each phase plays that order a different way:
 *   intro   → pixels flicker on as they're reached (with a bright flash)
 *   outro   → pixels flash and die as they're reached
 *   loop    → activity: random mode twinkles, the others repeat their wave
 *   ambient → slow, low-contrast loop for always-on UI
 *   still / off → static fully lit / all dark
 *
 * On top of that a glitch layer fires short signal faults (row tear, static band,
 * colour split, brownout) and keeps a few dead pixels stuttering.
 *
 * Other pictures: pass your own `grid` (e.g. a full LED panel) and call `setMask()` to
 * light a subset of it. Changing the mask morphs with the intro's flicker + flash, so
 * UI glyphs drawn on the panel feel like the same device as the logo.
 */

export type LedMode = 'random' | 'boot' | 'scan'
export type LedPhase = 'intro' | 'outro' | 'loop' | 'ambient' | 'still' | 'off'
export type GlitchKind = 'tear' | 'static' | 'split' | 'brownout'

export interface LedOptions {
  grid?: 'fine' | 'coarse' | LedGrid
  mode?: LedMode
  ink?: string       // lit LED colour
  accent?: string    // signal colour (green: still active)
  warn?: string      // second colour for the split glitch (orange: gone silent)
  signals?: boolean  // occasional green blink during loop/ambient
  glitch?: number    // 0 = off, 1 = default, 2 = chaotic
  speed?: number     // 1 = default tempo
  ghost?: number     // brightness of an unlit LED (0..1)
  ghostFade?: boolean // grid depth fades the unlit LEDs instead of shading lit ones (soft-edged UI panels)
}

interface Cell {
  x: number; y: number; row: number; base: number; depth: number; rnd: number; ghostK: number
  arrive: Record<LedMode, number>
}
interface Glitch { kind: GlitchKind; t0: number; dur: number; r0: number; r1: number; dx: number }

const INTRO_S = 1.6   // intro/outro length in seconds (at speed 1)
const MORPH_S = 0.5   // setMask() transition length
const LOOP_S: Record<LedMode, number> = { random: 1.7, boot: 1.8, scan: 2.4 }
const AMBIENT_SLOWDOWN = 2.2

const frac = (v: number) => v - Math.floor(v)
// deterministic randomness so orders are stable between plays
const hash = (i: number) => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

export class LedEngine {
  readonly opts: Required<LedOptions>
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cells: Cell[] = []
  private rows = 1
  private step = 11
  private vb = [0, 0, 1, 1]
  private phase: LedPhase = 'off'
  private t0 = 0
  private raf = 0
  private done: (() => void) | null = null
  private flashMode: LedMode | null = null
  private flashT0 = 0
  private signal = { i: -1, t0: 0, next: 0 }
  private glitches: Glitch[] = []
  private nextGlitch = Infinity
  private burstLeft = 0
  // per-frame scratch
  private bright = new Float32Array(0)
  private hot = new Float32Array(0)
  private dx = new Float32Array(0)
  // mask: per-cell brightness scale (0 = unlit ghost). Morphs from maskFrom over MORPH_S.
  private mask = new Float32Array(0)
  private maskFrom = new Float32Array(0)
  private morphT0 = -Infinity
  private morphMode: LedMode = 'boot'
  private reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  private io: IntersectionObserver | null = null
  private onScreen = true

  constructor(canvas: HTMLCanvasElement, opts: LedOptions = {}) {
    this.canvas = canvas
    this.opts = {
      grid: 'fine', mode: 'random', ink: '#e6e6df', accent: '#5fd068', warn: '#e56b47',
      signals: true, glitch: 1, speed: 1, ghost: 0.07, ghostFade: false, ...opts,
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('LedEngine: 2D canvas not available')
    this.ctx = ctx
    this.load()
    // Off-screen (scrolled away, or inside a collapsed drawer) → stop drawing; resume when seen.
    // Phases are time-based, so a paused intro simply finishes on resume. Background tabs already pause rAF.
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver(([e]) => {
        this.onScreen = e.isIntersecting
        if (this.onScreen) this.kick()
      })
      this.io.observe(canvas)
    }
  }

  private load() {
    const g = typeof this.opts.grid === 'string' ? LED_GRIDS[this.opts.grid] : this.opts.grid
    this.step = g.step
    this.vb = g.viewBox
    const raw = g.cells
    const n = raw.length / 3
    let yMin = Infinity, yMax = -Infinity
    for (let i = 0; i < n; i++) {
      const y = raw[i * 3 + 1]
      yMin = Math.min(yMin, y); yMax = Math.max(yMax, y)
    }
    this.rows = Math.round((yMax - yMin) / this.step) + 1
    this.cells = []
    for (let i = 0; i < n; i++) {
      const x = raw[i * 3], y = raw[i * 3 + 1], depth = raw[i * 3 + 2] / 100
      const rnd = hash(i)
      this.cells.push({
        x, y, depth, rnd,
        row: Math.round((y - yMin) / this.step),
        base: this.opts.ghostFade ? 1 : 0.6 + 0.4 * Math.sqrt(depth),
        ghostK: this.opts.ghostFade ? depth : 1,
        arrive: {
          random: hash(i * 3.17 + 9.1),
          scan: (y - yMin) / (yMax - yMin),
          boot: 0.55 * (1 - depth) + 0.45 * rnd,
        },
      })
    }
    this.bright = new Float32Array(n)
    this.mask = new Float32Array(n).fill(1)
    this.maskFrom = new Float32Array(n).fill(1)
    this.morphT0 = -Infinity
    this.hot = new Float32Array(n)
    this.dx = new Float32Array(n)
  }

  /** Set the CSS width; height follows the mark's aspect ratio. */
  resize(width: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const h = width * (this.vb[3] / this.vb[2])
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${h}px`
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.render(performance.now())
  }

  set(opts: LedOptions) {
    const regrid = opts.grid && opts.grid !== this.opts.grid
    Object.assign(this.opts, opts)
    if (regrid) {
      this.load()
      this.resize(parseFloat(this.canvas.style.width) || 96)
    }
    this.schedule(performance.now())
    this.kick()
  }

  /** Switch phase. Resolves when an intro/outro finishes (immediately otherwise). */
  play(phase: LedPhase): Promise<void> {
    this.done?.()            // a replaced intro/outro counts as finished
    this.done = null
    if (this.reduced && (phase === 'intro' || phase === 'loop' || phase === 'ambient')) phase = 'still'
    if (this.reduced && phase === 'outro') phase = 'off'
    const now = performance.now()
    this.phase = phase
    this.t0 = now
    this.signal.next = now + 1800
    this.glitches = []
    this.burstLeft = 0
    if (phase === 'outro') this.glitch(now, 'tear')   // signal breaks up before dying
    this.schedule(now)
    this.kick()
    if (phase !== 'intro' && phase !== 'outro') return Promise.resolve()
    return new Promise((resolve) => { this.done = resolve })
  }

  /** One-shot highlight wave over the current state (e.g. on hover). */
  flash(mode: LedMode = 'random') {
    if (this.reduced) return
    this.flashMode = mode
    this.flashT0 = performance.now()
    this.kick()
  }

  /** Fire a glitch now (random kind if omitted); burst = how many follow quickly. */
  glitch(now = performance.now(), kind?: GlitchKind, burst = 0) {
    if (this.reduced || this.opts.glitch <= 0) return
    const ambient = this.phase === 'ambient'
    const k = kind ?? pick<GlitchKind>(ambient ? ['tear', 'tear', 'static'] : ['tear', 'tear', 'tear', 'static', 'static', 'split', 'brownout'])
    const band = 1 + Math.floor(Math.random() * (ambient ? 1.2 : 2.4) * this.opts.glitch)   // 1–2 rows
    const r0 = Math.floor(Math.random() * this.rows)
    const shift = (!ambient && Math.random() < 0.15 * this.opts.glitch ? 2 : 1) * (Math.random() < 0.5 ? -1 : 1)
    this.glitches.push({
      kind: k, t0: now, r0, r1: r0 + band, dx: shift,
      dur: (k === 'brownout' ? 120 : k === 'split' ? 90 : 50 + Math.random() * 60) / this.opts.speed,
    })
    this.burstLeft = Math.max(this.burstLeft, burst)
    this.kick()
  }

  /** Light a subset of the grid (values 0..1 scale each LED; 0 = ghost). Morphs unless `instant`. */
  setMask(values: ArrayLike<number>, { instant = false, mode = 'boot' as LedMode } = {}) {
    const now = performance.now()
    const m = this.morphP(now)
    // start from what is on screen right now (handles a morph interrupted mid-way)
    for (let i = 0; i < this.mask.length; i++) {
      this.maskFrom[i] = m < 1.3 ? this.maskAt(i, m).v : this.mask[i]
      this.mask[i] = values[i] ?? 0
    }
    this.morphMode = mode
    this.morphT0 = instant || this.reduced ? -Infinity : now
    this.kick()
  }

  private morphP(now: number) {
    return (((now - this.morphT0) / 1000) * this.opts.speed / MORPH_S) * 1.15
  }

  /** Mask value of cell i at morph progress p, plus its transition flash. */
  private maskAt(i: number, p: number): { v: number; hot: number } {
    const to = this.mask[i], from = this.maskFrom[i]
    if (p >= 1.3 || to === from) return { v: to, hot: 0 }
    const c = this.cells[i]
    const since = p - c.arrive[this.morphMode]
    if (since <= 0) return { v: from, hot: 0 }
    const turningOn = to > 0 && from === 0, turningOff = to === 0 && from > 0
    let v = to
    if ((turningOn || turningOff) && since < 0.12) v = frac(since * 37 + c.rnd) > 0.45 ? Math.max(to, from) : Math.min(to, from) * 0.3
    const hot = turningOn ? Math.exp(-since / 0.07) : turningOff ? 0.6 * Math.exp(-since / 0.05) : 0
    return { v, hot }
  }

  destroy() {
    this.io?.disconnect()
    this.io = null
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.done?.()
    this.done = null
  }

  /** When the next spontaneous glitch fires, based on phase + intensity. */
  private schedule(now: number) {
    const g = this.opts.glitch
    if (this.reduced || g <= 0) { this.nextGlitch = Infinity; return }
    const sp = this.opts.speed
    switch (this.phase) {
      case 'intro': this.nextGlitch = now + (450 + Math.random() * 500) / sp; break
      case 'loop': this.nextGlitch = now + (2200 + Math.random() * 3800) / (g * sp); break
      case 'ambient': this.nextGlitch = now + (6000 + Math.random() * 7000) / (g * sp); break
      default: this.nextGlitch = Infinity
    }
  }

  private kick() {
    if (!this.raf && this.onScreen) this.raf = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    this.raf = 0
    if (this.render(now) && this.onScreen) this.raf = requestAnimationFrame(this.tick)
  }

  /** Draw one frame; returns whether another frame is needed. */
  private render(now: number): boolean {
    const { opts, cells } = this
    const sp = opts.speed
    const t = ((now - this.t0) / 1000) * sp
    const mode = opts.mode
    const ghost = opts.ghost
    const n = cells.length

    // ---- phase bookkeeping ----
    const p = (t / INTRO_S) * 1.15   // runs past 1 so the last pixels get their flash
    if ((this.phase === 'intro' || this.phase === 'outro') && p > 1.3) {
      const wasIntro = this.phase === 'intro'
      this.phase = wasIntro ? 'still' : 'off'
      if (wasIntro) this.glitch(now, 'split', 1)   // "signal acquired" hiccup
      this.done?.()
      this.done = null
      this.schedule(now)
    }
    const looping = this.phase === 'loop' || this.phase === 'ambient'
    let animating = looping || this.phase === 'intro' || this.phase === 'outro'

    // ---- glitch scheduling ----
    if (now >= this.nextGlitch) {
      this.glitch(now, undefined, Math.random() < 0.2 ? 1 : 0)
      this.schedule(now)
    }
    this.glitches = this.glitches.filter((g) => now - g.t0 < g.dur)
    if (this.burstLeft > 0 && !this.glitches.some((g) => now - g.t0 < 50)) {
      this.burstLeft--
      this.glitch(now)
    }
    if (this.glitches.length) animating = true

    const fp = this.flashMode ? (((now - this.flashT0) / 1000) * sp / INTRO_S) * 1.15 : 0
    if (this.flashMode && fp > 1.3) this.flashMode = null
    if (this.flashMode) animating = true
    const mp = this.morphP(now)
    if (mp < 1.3) animating = true

    // ---- per-pixel brightness ----
    const ambient = this.phase === 'ambient'
    const period = LOOP_S[mode] * (ambient ? AMBIENT_SLOWDOWN : 1)
    const q = t / period
    const floor = ambient ? 0.82 : mode === 'random' ? 0.55 : 0.32
    const decay = mode === 'random' || mode === 'boot' ? 0.14 : 0.42
    const hotGain = ambient ? 0.4 : 1
    const flickery = mode === 'random' || mode === 'boot'
    const deadEpoch = Math.floor(t * 0.35)

    for (let i = 0; i < n; i++) {
      const c = cells[i]
      let a = c.arrive[mode]
      let lit = 1
      let hot = 0
      switch (this.phase) {
        case 'off': lit = 0; break
        case 'still': break
        case 'intro': {
          const since = p - a
          lit = since > 0 ? 1 : 0
          if (flickery && since > 0 && since < 0.09) lit = frac(since * 37 + c.rnd) > 0.45 ? 1 : 0.2
          hot = since > 0 ? Math.exp(-since / 0.07) : 0
          break
        }
        case 'outro': {
          if (mode === 'boot') a = 1 - a   // boot shuts down from the edges in
          const since = p - a
          lit = since > 0 ? 0 : 1
          if (flickery && since > 0 && since < 0.07) lit = frac(since * 41 + c.rnd) > 0.5 ? 0.9 : 0
          hot = since > 0 ? 0.8 * Math.exp(-since / 0.05) : 0
          break
        }
        default: {
          if (mode === 'random' || mode === 'boot') {
            // activity: each pixel has its own clock; ~30% of pixels flare per cycle
            const u = q + c.rnd
            const flare = hash(i * 13.7 + Math.floor(u) * 7.1) > (ambient ? 0.8 : 0.7)
            const since = frac(u)
            lit = floor + (1 - floor) * (flare ? Math.exp(-since / decay) : 0)
            hot = flare ? hotGain * Math.exp(-since / 0.05) : 0
          } else {
            const since = frac(q - a)
            lit = floor + (1 - floor) * Math.exp(-since / decay)
            hot = hotGain * Math.exp(-since / 0.045)
          }
          // dead pixels: a rotating handful stutter between dim and dark
          if (opts.glitch > 0 && hash(i * 5.3 + deadEpoch * 17.9) > 0.996) {
            lit *= frac(t * 9 + c.rnd) > 0.4 ? 0.4 : 0.75
            hot = 0
          }
        }
      }
      if (this.flashMode) {
        const since = fp - c.arrive[this.flashMode]
        if (since > 0) hot = Math.max(hot, 0.85 * Math.exp(-since / 0.07))
      }
      const m = this.maskAt(i, mp)
      if (m.v <= 0) hot = 0   // unlit LEDs don't join intro/flash waves
      hot = Math.max(hot, m.hot)
      const g = ghost * c.ghostK
      this.bright[i] = g + (c.base - g) * lit * m.v
      this.hot[i] = hot
      this.dx[i] = 0
    }

    // ---- glitches modify the computed frame ----
    let master = 1
    let split = 0
    for (const g of this.glitches) {
      const k = (now - g.t0) / g.dur   // 0..1 through the glitch
      if (g.kind === 'brownout') master *= frac(k * 3) < 0.5 ? 0.65 : 0.92
      else if (g.kind === 'split') split = Math.max(split, 1 - k)
      else {
        for (let i = 0; i < n; i++) {
          const r = cells[i].row
          if (r < g.r0 || r >= g.r1) continue
          if (g.kind === 'tear') {
            this.dx[i] = g.dx * this.step
            this.hot[i] = Math.max(this.hot[i], 0.08)
          } else if (this.bright[i] > ghost) {
            this.bright[i] *= 0.55 + 0.45 * Math.random()   // static: soft noise, not blackout
          }
        }
      }
    }

    this.draw(master, split)
    return animating
  }

  private draw(master: number, split: number) {
    const { ctx, canvas, cells, opts, step, vb } = this
    const n = cells.length
    const s = canvas.width / vb[2]
    const size = step * 0.76
    const r = size * 0.2
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(s, 0, 0, s, -vb[0] * s, -vb[1] * s)

    const cell = (i: number, grow = 1, ox = 0) => {
      const c = cells[i]
      const z = size * grow
      ctx.beginPath()
      ctx.roundRect(c.x + this.dx[i] + ox - z / 2, c.y - z / 2, z, z, grow === 1 ? r : z * 0.4)
      ctx.fill()
    }

    // colour split: offset green/orange ghosts under the main pass
    if (split > 0) {
      ctx.globalCompositeOperation = 'lighter'
      const off = step * 0.35
      for (const [color, ox] of [[opts.accent, -off], [opts.warn, off]] as const) {
        ctx.fillStyle = color
        for (let i = 0; i < n; i++) {
          ctx.globalAlpha = this.bright[i] * 0.3 * split * master
          cell(i, 1, ox)
        }
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    // main pass
    ctx.fillStyle = opts.ink
    for (let i = 0; i < n; i++) {
      const b = this.bright[i]
      ctx.globalAlpha = Math.min(1, b + this.hot[i] * (1 - b)) * master
      cell(i)
    }

    // bloom behind the hottest pixels
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < n; i++) {
      if (this.hot[i] < 0.12) continue
      ctx.globalAlpha = this.hot[i] * 0.22 * master
      cell(i, 1.7)
    }
    ctx.globalCompositeOperation = 'source-over'

    // signal: now and then one deep pixel blinks green, like a device still transmitting
    const now = performance.now()
    const sg = this.signal
    if (opts.signals && (this.phase === 'loop' || this.phase === 'ambient')) {
      if (now > sg.next) {
        const deep = cells.map((c, i) => (c.depth > 0.35 && this.mask[i] > 0.5 ? i : -1)).filter((i) => i >= 0)
        sg.i = deep.length ? pick(deep) : -1
        sg.t0 = now
        sg.next = now + (2600 + Math.random() * 2200) / opts.speed
      }
      const age = ((now - sg.t0) / 1000) * opts.speed
      if (sg.i >= 0 && age < 1.4) {
        const blink = Math.max(0, Math.sin((age / 1.4) * Math.PI * 3)) // three soft blinks
        ctx.fillStyle = opts.accent
        ctx.globalAlpha = blink * master
        cell(sg.i)
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = blink * 0.35 * master
        cell(sg.i, 2.2)
        ctx.globalCompositeOperation = 'source-over'
      }
    }
    ctx.globalAlpha = 1
  }
}
