import { useState } from 'react'
import { PHOTOS } from '../data/photos'

/** Real NASA photo for the selected object. Remount per object (key) so the load state resets. */
export function StoryPhoto({ id }: { id: string }) {
  const photo = PHOTOS[id]
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!photo || failed) return null

  return (
    <figure className="photo">
      <a
        className={`photo__frame${loaded ? ' is-loaded' : ''}`}
        href={`https://images.nasa.gov/details/${photo.nasaId}`}
        target="_blank"
        rel="noreferrer"
        title="Open on images.nasa.gov"
      >
        <img
          src={`/photos/${id}.jpg`}
          alt={photo.caption}
          decoding="async"
          style={photo.focus ? { objectPosition: photo.focus } : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
        {photo.view === 'orbit' && <span className="photo__tag">[ORBIT VIEW]</span>}
        {!loaded && <span className="photo__wait">RECEIVING IMAGE…</span>}
      </a>
      <figcaption>
        <span className="photo__id">IMG {photo.nasaId.toUpperCase()} · {photo.credit}</span>
        {photo.caption}
      </figcaption>
    </figure>
  )
}
