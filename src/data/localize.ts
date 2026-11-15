import { getLang, keepEnglishCase, useLang, type Lang } from '../i18n'
import { hardware, type Hardware } from './hardware'
import { marsHardware } from './mars'
import { deepSpaceHardware } from './deepspace'
import { features, marsFeatures } from './features'
import { CONSTELLATIONS } from './stars'
import { DEEP_SKY } from './deepSky'
import { DEEPSKY_SUB_TR, DESTINATIONS_TR, HARDWARE_TR, LASTSIGNAL_TR, NAME_TR, PHOTO_TR } from './tr'

/**
 * Content in the current language. The data arrays stay English and keep their identity (other
 * code compares objects and ids); display code asks for the localized copy at render time.
 * Copies are cached per language, so `loc(h)` is stable between renders.
 */
// English proper names (only words with an "i" matter) keep English caps in Turkish
keepEnglishCase(
  [
    ...[...hardware, ...marsHardware, ...deepSpaceHardware].flatMap((h) => [h.name, h.mission]),
    ...[...features, ...marsFeatures].map((f) => f.name),
    ...CONSTELLATIONS.flatMap((c) => c.stars.map((s) => s.name)),
    ...DEEP_SKY.map((o) => o.name),
  ].flatMap((s) => s.split(/[\s()/·+—–-]+/)).filter((w) => /^[A-Z]/.test(w) && /i/.test(w)),
)

const cache: Record<Lang, Map<string, Hardware>> = { en: new Map(), tr: new Map() }

export function loc<H extends Hardware>(h: H, l: Lang = getLang()): H {
  if (l === 'en') return h
  let c = cache[l].get(h.id)
  if (!c) {
    const t = HARDWARE_TR[h.id]
    const last = LASTSIGNAL_TR[h.lastSignal]
    c = t || last ? { ...h, ...t, ...(last ? { lastSignal: last } : {}) } : h
    cache[l].set(h.id, c)
  }
  return c as H
}

/** Hook form: re-renders on language switch. */
export function useLoc() {
  const l = useLang()
  return <H extends Hardware>(h: H) => loc(h, l)
}

/** Place / star / feature names that Turkish writes differently (Latin names pass through). */
export const placeName = (s: string, l: Lang = getLang()) => (l === 'tr' ? NAME_TR[s] ?? s : s)

/** Photo caption by file stem ('<id>' or '<id>-2'…). */
export const photoCaption = (stem: string, en: string, l: Lang = getLang()) => (l === 'tr' ? PHOTO_TR[stem] ?? en : en)

/** deepSky.ts sublines (keyed by object name). */
export const deepSkySub = (name: string, en: string, l: Lang = getLang()) => (l === 'tr' ? DEEPSKY_SUB_TR[name] ?? en : en)

/** stars.ts DESTINATIONS label/sub (keyed by probe id). */
export const destination = (probe: string, en: { label: string; sub: string }, l: Lang = getLang()) =>
  (l === 'tr' ? DESTINATIONS_TR[probe] ?? en : en)
