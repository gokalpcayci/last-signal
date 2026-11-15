import { lazy, Suspense, useCallback, useState } from 'react'
import { StoryPhoto } from './StoryPhoto'
import { MODELS } from '../data/models'
import { useT } from '../strings'

const CraftViewer = lazy(() => import('./CraftViewer'))

/** Story panel media: the NASA photo slideshow, plus a 3D tab when NASA publishes a model. */
export function StoryMedia({ id }: { id: string }) {
  const t = useT().story
  const model = MODELS[id]
  const [tab, setTab] = useState<'photo' | 'model'>('photo')
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  const onError = useCallback(() => setFailed(true), [])
  if (!model || failed) return <StoryPhoto id={id} />

  return (
    <div className="media">
      <div className="media__tabs" role="tablist">
        {(['photo', 'model'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
            {tab === k ? `[${k === 'photo' ? t.photo : t.model}]` : k === 'photo' ? t.photo : t.model}
          </button>
        ))}
      </div>
      {tab === 'photo' ? <StoryPhoto id={id} /> : (
        <figure className="photo">
          <div className={`photo__frame media__model${ready ? ' is-loaded' : ''}`}>
            <Suspense fallback={null}>
              <CraftViewer src={model.src} onReady={onReady} onError={onError} />
            </Suspense>
            {!ready && <span className="photo__wait">{t.modelLoading}</span>}
          </div>
          <figcaption className="photo__caps">
            <span className="photo__cap">
              <span className="photo__id">3D · {model.credit}</span>
              {t.modelNote(!!model.representative)}{' · '}
              <a href={model.page} target="_blank" rel="noreferrer">science.nasa.gov</a>
            </span>
          </figcaption>
        </figure>
      )}
    </div>
  )
}
