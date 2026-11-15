import { useSyncExternalStore } from 'react'

/**
 * Page-open boot state, shared by the loader and the scene.
 *   progress → real load steps (fonts, elevation data, first rendered frame), 0..1
 *   ready    → the terrain has drawn its first frame (shaders compiled)
 *   booted   → the loader has handed off; the terrain reveal and marker ping-in may start
 *
 * The intro plays once per browser session; `?boot` in the URL forces it.
 */

const KEY = 'lastsignal.booted'

function wantsIntro(): boolean {
  if (typeof window === 'undefined') return false
  if (new URLSearchParams(location.search).has('boot')) return true
  try { return sessionStorage.getItem(KEY) !== '1' } catch { return true }
}

const state = { progress: 0, ready: false, booted: !wantsIntro() }
export const introPlays = !state.booted
// hide the nav logo until the loader's logo has flown into its place
if (introPlays) document.documentElement.classList.add('booting')

const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

export function markProgress(p: number) {
  if (p <= state.progress) return
  state.progress = Math.min(1, p)
  emit()
}

export function markSceneReady() {
  if (state.ready) return
  state.ready = true
  state.progress = 1
  emit()
}

/** Loader is leaving: let the scene start its own entrance. */
export function markBooted() {
  if (state.booted) return
  state.booted = true
  try { sessionStorage.setItem(KEY, '1') } catch { /* private mode: replay next time, harmless */ }
  emit()
}

/** Loader is gone: show the real nav logo. */
export function finishIntro() {
  document.documentElement.classList.remove('booting')
}

export const isBooted = () => state.booted
export const getProgress = () => state.progress
export const useBooted = () => useSyncExternalStore(subscribe, () => state.booted)
export const useSceneReady = () => useSyncExternalStore(subscribe, () => state.ready)
export const useProgress = () => useSyncExternalStore(subscribe, () => state.progress)
