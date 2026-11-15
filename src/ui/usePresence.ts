import { useEffect, useState } from 'react'

/** TextEffect's exit: spread + animation, rounded up */
export const TE_EXIT_MS = 480

/**
 * Keeps the last non-null value around for `ms` after it becomes null, so its exit can play.
 * Returns [value to render, leaving].
 */
export function usePresence<T>(value: T | null, ms = TE_EXIT_MS): [T | null, boolean] {
  const [kept, setKept] = useState<T | null>(value)
  if (value != null && value !== kept) setKept(value) // adjust during render (no extra frame)
  useEffect(() => {
    if (value != null || kept == null) return
    const t = setTimeout(() => setKept(null), ms)
    return () => clearTimeout(t)
  }, [value, kept, ms])
  return [value ?? kept, value == null && kept != null]
}
