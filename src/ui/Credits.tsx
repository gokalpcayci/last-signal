import { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n'
import { useT } from '../strings'
import { LedLogo } from './LedLogo'
import LangSwitch from './LangSwitch'
import TextEffect from './TextEffect'
import './credits.css'

/**
 * Credits: a full-screen sheet over the dashboard (the map keeps running behind it), opened by
 * the CREDITS link or the #credits hash, so the page can be linked directly. Esc / × / the
 * back button close it. Printed as a mission sheet: dashed rules, mono labels, Daktilo names.
 */

const AUTHORS = ['Gökalp Çaycı', 'Uygar Yıldırım']
const HASH = '#credits'

/** open state <-> location.hash */
export function useCreditsRoute(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => location.hash === HASH)
  useEffect(() => {
    const on = () => setOpen(location.hash === HASH)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const set = (v: boolean) => {
    if (v === open) return
    if (v) location.hash = HASH
    // drop the hash without leaving a "#" behind or adding a history entry
    else history.replaceState(null, '', location.pathname + location.search)
    setOpen(v)
  }
  return [open, set]
}

export default function Credits({ onClose }: { onClose: () => void }) {
  const t = useT().credits
  const lang = useLang()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div className="credits" role="dialog" aria-modal="true" aria-labelledby="credits-title">
      <div className="credits__sheet" key={lang}>
        <header className="credits__top">
          <LedLogo className="credits__logo" width={56} />
          <div className="credits__tools">
            <LangSwitch />
            <button ref={closeRef} className="credits__close" onClick={onClose} aria-label={t.close} title={t.close}>×</button>
          </div>
        </header>

        <p className="credits__kicker"><span className="credits__dot" aria-hidden />{t.kicker}</p>
        <h1 id="credits-title" className="credits__title">
          <TextEffect>Lostronomy</TextEffect>
        </h1>
        <p className="credits__belief"><TextEffect per="word" delay={0.2}>{t.belief}</TextEffect></p>

        <section className="credits__sec">
          <h2 className="credits__label">{t.authors}</h2>
          <ol className="credits__authors">
            {AUTHORS.map((a, i) => (
              <li key={a}>
                <span className="credits__idx">{String(i + 1).padStart(2, '0')}</span>
                <TextEffect className="credits__name" delay={0.35 + i * 0.15}>{a}</TextEffect>
                <span className="credits__trace" aria-hidden>▪=========▌</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="credits__sec">
          <h2 className="credits__label">{t.team}</h2>
          <p className="credits__text">{t.about}</p>
        </section>

        <section className="credits__sec">
          <h2 className="credits__label">{t.scopeTag}</h2>
          <dl className="credits__scope">
            {t.scope.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>

        <section className="credits__sec credits__facts">
          <dl>
            <div><dt>{t.challengeTag}</dt><dd>{t.challenge}</dd></div>
            <div><dt>{t.event}</dt><dd>{t.eventValue}</dd></div>
            <div><dt>{t.dataTag}</dt><dd>{t.data}</dd></div>
          </dl>
        </section>

        <footer className="credits__end">
          <span>{t.signoff}</span><span className="credits__cursor" aria-hidden>▌</span>
        </footer>
      </div>
    </div>
  )
}
