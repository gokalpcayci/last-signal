/**
 * Vercel Web Analytics: cookieless page views (no consent banner needed) + a few custom events.
 * In `bun run dev` the debug script only logs to the console; nothing is sent.
 * Custom events show up in the Vercel dashboard on the Pro plan only; on Hobby `track()` is a no-op there.
 */
import { inject, track as vaTrack } from '@vercel/analytics'

export function initAnalytics() {
  inject({ mode: import.meta.env.PROD ? 'production' : 'development', framework: 'vite' })
}

type Events = {
  /** world switch (nav / phone drawer) */
  world: { to: string }
  /** toolbar GLOBE toggle */
  globe: { on: boolean; world: string }
  /** a new object selected (marker, timeline, signal map, list) */
  select: { id: string; world: string }
  /** ▶ PLAY on the timeline */
  timeline_play: { world: string }
  /** language switch */
  language: { to: string }
}

export function track<K extends keyof Events>(name: K, props: Events[K]) {
  vaTrack(name, props)
}
