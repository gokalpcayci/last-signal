import { LANGS, setLang, useLang } from '../i18n'
import { useT } from '../strings'

/** EN · TR — two mono tags; the active one gets brackets, like the nav filters. */
export default function LangSwitch({ className = '' }: { className?: string }) {
  const lang = useLang()
  const t = useT()
  return (
    <div className={`lang ${className}`} role="group" aria-label={t.nav.language}>
      {LANGS.map((l) => (
        <button key={l} className={l === lang ? 'is-on' : ''} aria-pressed={l === lang} lang={l}
          data-no-scramble onClick={() => setLang(l)}>
          {l === lang ? `[${l.toUpperCase()}]` : l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
