import { useEffect, useMemo, useRef, useState } from 'react'
import type { Hardware } from '../data/hardware'

/** How long the "going quiet" animation runs (keep in sync with smap-die / marker-die in CSS). */
export const DYING_MS = 1100

export type Status = Hardware['status']

/** Status at the timeline playhead: silent objects still talk until the playhead passes their last signal. */
export const statusAt = (h: Hardware, talking: ReadonlySet<string>): Status => (talking.has(h.id) ? 'active' : h.status)

/**
 * Ids whose status just flipped active → silent (the playhead moved past their last signal).
 * Each stays in the set for DYING_MS so its LED / marker can play the dying flicker once.
 * Objects that only just appeared (not in the previous render) never count.
 */
export function useDying(items: Hardware[], talking: ReadonlySet<string>) {
  const status = useMemo(() => new Map(items.map((h) => [h.id, statusAt(h, talking)])), [items, talking])
  const prev = useRef(status)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const [dying, setDying] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    const died = [...status].filter(([id, s]) => s === 'silent' && prev.current.get(id) === 'active').map(([id]) => id)
    prev.current = status
    if (!died.length) return
    setDying((d) => new Set([...d, ...died]))
    // not cleared on the next change: a later death must not cancel this one's end
    const t = setTimeout(() => {
      timers.current.delete(t)
      setDying((d) => {
        const n = new Set(d)
        for (const id of died) n.delete(id)
        return n
      })
    }, DYING_MS)
    timers.current.add(t)
  }, [status])

  useEffect(() => {
    const all = timers.current
    return () => { for (const t of all) clearTimeout(t) }
  }, [])

  return dying
}
