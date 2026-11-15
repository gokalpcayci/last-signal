import { useEffect, useRef } from 'react'
import { LedEngine, type LedMode, type LedPhase } from '../brand/ledEngine'

interface Props {
  width?: number
  grid?: 'fine' | 'coarse'
  mode?: LedMode
  /** Play the entrance on mount. */
  intro?: boolean
  /** What to settle into after the entrance. */
  rest?: Extract<LedPhase, 'still' | 'loop' | 'ambient'>
  /** Small tear + random sparkle on hover. */
  hoverFlash?: boolean
  /** Glitch intensity: 0 off, 1 default, 2 chaotic. */
  glitch?: number
  className?: string
}

/** Animated LED-matrix Last Signal mark (canvas). */
export function LedLogo({
  width = 96, grid = 'coarse', mode = 'random', intro = true, rest = 'ambient', hoverFlash = true, glitch = 1, className,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const engine = useRef<LedEngine | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const e = new LedEngine(canvas, { grid, mode, glitch })
    engine.current = e
    e.resize(width)
    let alive = true
    ;(async () => {
      if (intro) await e.play('intro')
      if (alive) e.play(rest)
    })()
    return () => {
      alive = false
      e.destroy()
      engine.current = null
    }
  }, [width, grid, mode, intro, rest, glitch])

  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label="Last Signal"
      onMouseEnter={hoverFlash ? () => { engine.current?.glitch(undefined, 'tear'); engine.current?.flash('random') } : undefined}
    />
  )
}
