import { useSyncExternalStore } from 'react'
import { track } from './analytics'

/**
 * Two languages only: English and Turkish. The choice lives in module state (so canvas / non-React
 * code can read it at draw time with `getLang()`), React reads it through `useLang()`.
 * Start value: ?lang=tr|en → saved choice → browser language → English.
 */
export type Lang = 'en' | 'tr'
export const LANGS: Lang[] = ['en', 'tr']

const KEY = 'lastsignal-lang'
const isLang = (v: unknown): v is Lang => v === 'en' || v === 'tr'

function initial(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (isLang(q)) return q
    const saved = localStorage.getItem(KEY)
    if (isLang(saved)) return saved
  } catch { /* storage blocked: fall through */ }
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

let lang: Lang = initial()
document.documentElement.lang = lang
const subs = new Set<() => void>()

export const getLang = () => lang

export function setLang(l: Lang) {
  if (l === lang) return
  track('language', { to: l })
  lang = l
  document.documentElement.lang = l
  try { localStorage.setItem(KEY, l) } catch { /* not saved, still switches */ }
  subs.forEach((f) => f())
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useLang = () => useSyncExternalStore(subscribe, getLang)
/** Re-render a non-React consumer (canvas loop) on change. */
export const onLangChange = subscribe

/**
 * Proper names from the English data (Viking, Curiosity, Mare Imbrium…) keep English caps in
 * Turkish too: "VIKING", not "VİKİNG". Filled by data/localize.ts.
 */
const keepEn = new Set<string>()
export const keepEnglishCase = (words: Iterable<string>) => { for (const w of words) keepEn.add(w) }

/** Locale-aware caps: Turkish needs i → İ (plain toUpperCase gives I), except for English proper names. */
export const up = (s: string, l: Lang = lang) => l === 'tr'
  ? s.split(/([\s()/·+—–-]+)/).map((w) => w.toLocaleUpperCase(keepEn.has(w) ? 'en-US' : 'tr-TR')).join('')
  : s.toLocaleUpperCase('en-US')
export const locale = (l: Lang = lang) => (l === 'tr' ? 'tr-TR' : 'en-GB')
/** Numbers: 26,000 vs 26.000 */
export const num = (n: number, l: Lang = lang) => n.toLocaleString(l === 'tr' ? 'tr-TR' : 'en-US')
