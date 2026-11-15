/**
 * Hover text scramble (after motion-primitives' TextScramble), installed once for the whole app.
 * Any `a`, `button` or `[data-scramble]` scrambles its short text on mouse hover and settles
 * left → right. Opt out with `data-no-scramble`. Letters stay letters (same case), digits stay
 * digits, spaces and symbols ([ ] → × ·) never move, so mono labels keep their width.
 *
 * It writes straight into React's text nodes and always puts the original back. If React changes
 * a node mid-scramble (e.g. a label updates on click), that node is dropped and React's text wins.
 */

const SEL = 'a, button, [data-scramble]'
const DURATION = 520 // ms until every character has settled
const TICK = 40      // ms between frames (motion-primitives' `speed`)
const MAX_LEN = 28   // longer text nodes (sentences) stay still: too noisy

const UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LO = 'abcdefghijklmnopqrstuvwxyz'
const DIG = '0123456789'
const pick = (s: string) => s[(Math.random() * s.length) | 0]
const randLike = (c: string) =>
  c >= 'A' && c <= 'Z' ? pick(UP) : c >= 'a' && c <= 'z' ? pick(LO) : c >= '0' && c <= '9' ? pick(DIG) : c

const running = new WeakSet<Element>()

function scramble(el: HTMLElement) {
  const nodes: { node: Text; orig: string; last: string }[] = []
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n as Text
    const s = t.nodeValue ?? ''
    if (s.trim().length > 0 && s.length <= MAX_LEN && /[A-Za-z0-9]/.test(s)) nodes.push({ node: t, orig: s, last: s })
  }
  if (!nodes.length) return
  running.add(el)

  // proportional fonts change width per glyph: hold the box still while it scrambles
  const prevMin = el.style.minWidth
  if (getComputedStyle(el).display !== 'inline') el.style.minWidth = `${el.getBoundingClientRect().width}px`

  const t0 = performance.now()
  const frame = () => {
    const p = Math.min(1, (performance.now() - t0) / DURATION)
    for (let k = nodes.length - 1; k >= 0; k--) {
      const n = nodes[k]
      if (n.node.nodeValue !== n.last) { nodes.splice(k, 1); continue } // React rewrote it
      const settled = Math.floor(p * n.orig.length)
      let out = ''
      for (let i = 0; i < n.orig.length; i++) out += i < settled ? n.orig[i] : randLike(n.orig[i])
      n.node.nodeValue = n.last = p >= 1 ? n.orig : out
    }
    if (p >= 1 || !nodes.length) {
      clearInterval(id)
      el.style.minWidth = prevMin
      running.delete(el)
    }
  }
  const id = window.setInterval(frame, TICK)
  frame()
}

export function installTextScramble() {
  const w = window as Window & { __scramble?: boolean }
  if (w.__scramble) return // HMR / double import
  w.__scramble = true
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || reduced.matches) return
    const el = (e.target as Element | null)?.closest?.(SEL) as HTMLElement | null
    if (!el || el.closest('[data-no-scramble]') || running.has(el)) return
    if (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return // moved within it
    if ((el as HTMLButtonElement).disabled) return
    scramble(el)
  })
}
