import { useEffect, useMemo, useRef, useState } from 'react'
import { photosFor } from '../data/photos'

/** How long each photo stays up before the next one. */
const HOLD_MS = 2000
/** Pixel block sizes (css px) the picture breaks into, then rebuilds from. Stepped, not smooth: a weak signal. */
const STEPS = [3, 6, 11, 18, 28]
const STEP_MS = 42

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Source rect that reproduces `object-fit: cover` + `object-position` for a w×h box. */
function coverRect(im: HTMLImageElement, w: number, h: number, focus = '50% 50%') {
  const [fx, fy] = focus.split(' ').map((v) => parseFloat(v) / 100)
  const s = Math.max(w / im.naturalWidth, h / im.naturalHeight)
  const sw = w / s, sh = h / s
  return [(im.naturalWidth - sw) * (fx ?? 0.5), (im.naturalHeight - sh) * (fy ?? 0.5), sw, sh] as const
}

/** Index of the next photo after `from` that decodes; `from` itself when none does. */
async function nextLoadable(imgs: HTMLImageElement[], bad: Set<number>, from: number) {
  for (let k = 1; k < imgs.length; k++) {
    const c = (from + k) % imgs.length
    if (bad.has(c)) continue
    try {
      await imgs[c].decode()
      return c
    } catch {
      bad.add(c)
    }
  }
  return from
}

/** Break photo `from` into growing pixel blocks on the canvas, swap to `to` underneath, rebuild it. */
async function pixelSwap(
  cv: HTMLCanvasElement, frame: HTMLElement, imgs: HTMLImageElement[], photos: { focus?: string }[],
  from: number, to: number, alive: { current: boolean }, swap: (i: number) => void,
) {
  const ctx = cv.getContext('2d')
  const tiny = document.createElement('canvas')
  const tctx = tiny.getContext('2d')
  if (!ctx || !tctx) { swap(to); return }
  const w = frame.clientWidth, h = frame.clientHeight, dpr = window.devicePixelRatio || 1
  cv.width = Math.round(w * dpr)
  cv.height = Math.round(h * dpr)

  const draw = (k: number, block: number) => {
    const im = imgs[k]
    const tw = Math.max(1, Math.ceil(w / block)), th = Math.max(1, Math.ceil(h / block))
    tiny.width = tw
    tiny.height = th
    tctx.imageSmoothingEnabled = true
    tctx.drawImage(im, ...coverRect(im, w, h, photos[k].focus), 0, 0, tw, th)
    ctx.imageSmoothingEnabled = false
    // the last block may be cut off at the edge: scale by the block, not to the canvas size
    ctx.drawImage(tiny, 0, 0, tw, th, 0, 0, tw * block * dpr, th * block * dpr)
  }

  draw(from, 1)
  cv.hidden = false
  for (const s of STEPS) { if (!alive.current) return; draw(from, s); await wait(STEP_MS) }
  swap(to)
  for (const s of [...STEPS].reverse()) { if (!alive.current) return; draw(to, s); await wait(STEP_MS) }
  await wait(STEP_MS)
  cv.hidden = true
}

/**
 * Real NASA photos for the selected object. With more than one, they rotate every 2 s:
 * the picture breaks into growing pixel blocks, swaps, and rebuilds. Hover pauses it.
 * Remount per object (key) so the state resets.
 */
export function StoryPhoto({ id }: { id: string }) {
  const photos = useMemo(() => photosFor(id), [id])
  const [i, setI] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [paused, setPaused] = useState(false)
  const frameRef = useRef<HTMLAnchorElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgs = useRef<HTMLImageElement[]>([])
  const bad = useRef(new Set<number>())
  const alive = useRef(true)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const n = photos.length

  // preload every photo of this object so the swap never waits on the network
  useEffect(() => {
    alive.current = true
    imgs.current = photos.map((p) => {
      const im = new Image()
      im.src = p.src
      return im
    })
    return () => { alive.current = false }
  }, [photos])

  useEffect(() => {
    if (n < 2 || !loaded || paused || reduced) return
    const t = setTimeout(async () => {
      const to = await nextLoadable(imgs.current, bad.current, i)
      const cv = canvasRef.current, fr = frameRef.current
      if (to === i || !alive.current || !cv || !fr) return
      await pixelSwap(cv, fr, imgs.current, photos, i, to, alive, setI)
    }, HOLD_MS)
    // re-armed on every index change (setI fires mid-swap), so the next one counts from the swap
    return () => clearTimeout(t)
  }, [i, n, loaded, paused, reduced, photos])

  if (!n || failed) return null
  const photo = photos[i]

  return (
    <figure className="photo" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <a
        ref={frameRef}
        className={`photo__frame${loaded ? ' is-loaded' : ''}`}
        href={`https://images.nasa.gov/details/${photo.nasaId}`}
        target="_blank"
        rel="noreferrer"
        title="Open on images.nasa.gov"
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <img
          src={photo.src}
          alt={photo.caption}
          decoding="async"
          style={photo.focus ? { objectPosition: photo.focus } : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => { if (i === 0) setFailed(true) }}
        />
        <canvas ref={canvasRef} className="photo__px" hidden aria-hidden />
        {photo.view === 'orbit' && <span className="photo__tag">[ORBIT VIEW]</span>}
        {n > 1 && (
          <span className="photo__count" aria-hidden>
            {photos.map((p, k) => <i key={p.src} className={k === i ? 'is-on' : undefined} />)}
          </span>
        )}
        {!loaded && <span className="photo__wait">RECEIVING IMAGE…</span>}
      </a>
      {/* every caption sits in one grid cell, so the tallest sets the height and the panel never jumps */}
      <figcaption className="photo__caps">
        {photos.map((p, k) => (
          <span key={p.src} className="photo__cap" aria-hidden={k !== i} style={k === i ? undefined : { visibility: 'hidden' }}>
            <span className="photo__id">
              IMG {p.nasaId.toUpperCase()} · {p.credit}
              {n > 1 && <b>{String(k + 1).padStart(2, '0')}/{String(n).padStart(2, '0')}</b>}
            </span>
            {p.caption}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
