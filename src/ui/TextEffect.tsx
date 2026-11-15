import type { CSSProperties, ElementType } from 'react'

/**
 * Entrance/exit text effect (after motion-primitives' TextEffect, "fade-in-blur" preset), pure CSS.
 * Splits a string per char or per word; each piece fades in from a small blur with a stagger.
 * `trigger={false}` plays the exit (pieces blur out in reverse); keep the element mounted for
 * TE_EXIT_MS (see `usePresence.ts`). Animations only run on mount, so re-renders don't replay them.
 * Screen readers get the plain text once. Reduced motion: shown at once (index.css).
 */

type Props = {
  children: string
  per?: 'char' | 'word'
  as?: ElementType
  className?: string
  /** seconds before the first piece starts */
  delay?: number
  /** false = play the exit */
  trigger?: boolean
}

const STEP = { char: 0.022, word: 0.045 }
const MAX_SPREAD = 0.7       // s: long text still finishes quickly
const EXIT_SPREAD = 0.22     // s

export default function TextEffect({ children, per = 'char', as: Tag = 'span', className = '', delay = 0, trigger = true }: Props) {
  const words = children.split(/(\s+)/)
  // running piece index at the start of each word
  const sizes = words.map((w) => (!w.trim() ? 0 : per === 'word' ? 1 : [...w].length))
  const starts = sizes.map((_, wi) => sizes.slice(0, wi).reduce((a, b) => a + b, 0))
  const n = sizes.reduce((a, b) => a + b, 0)
  const step = Math.min(STEP[per], MAX_SPREAD / Math.max(1, n))
  const outStep = EXIT_SPREAD / Math.max(1, n)
  const piece = (text: string, k: number, key: number) => {
    const style = { '--d': `${delay + k * step}s`, '--o': `${(n - 1 - k) * outStep}s` } as CSSProperties
    return <span key={key} className="te__p" style={style}>{text}</span>
  }
  return (
    <Tag className={`te${trigger ? '' : ' te--out'}${className ? ` ${className}` : ''}`}>
      <span className="te__sr">{children}</span>
      <span aria-hidden>
        {words.map((w, wi) =>
          !w.trim() ? w
            : per === 'word' ? piece(w, starts[wi], wi)
            : <span key={wi} className="te__w">{[...w].map((c, ci) => piece(c, starts[wi] + ci, ci))}</span>,
        )}
      </span>
    </Tag>
  )
}
