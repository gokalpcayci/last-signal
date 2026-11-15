import { useEffect, useMemo, useRef, useState } from 'react'
import { photosFor } from '../data/photos'
import { photoCaption } from '../data/localize'
import { useLang } from '../i18n'
import { useT } from '../strings'

/** How long each photo stays up before the next one. */
const HOLD_MS = 2000
/** The swap: cells of the photo switch over in random order (like the LED logo's random boot). */
const SWAP_MS = 320
/** Cell size in css px. Each cell is one "LED": pixelated at this size while it switches. */
const CELL = 12
/** Share of the swap over which cells start switching; the rest is each cell's own switch. */
const SPREAD = 0.7
/** Per-cell timeline (fractions of its own switch, 0..1): old goes blocky → flash → new blocky → new sharp. */
const OLD_PX = 0.25, FLASH = 0.45, NEW_PX = 0.8

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

/** Photo `k` at full canvas resolution (cover crop), plus a copy pixelated to one colour per CELL. */
function prepare(im: HTMLImageElement, focus: string | undefined, w: number, h: number, dpr: number, cols: number, rows: number) {
  const sharp = document.createElement('canvas')
  sharp.width = Math.round(w * dpr)
  sharp.height = Math.round(h * dpr)
  sharp.getContext('2d')!.drawImage(im, ...coverRect(im, w, h, focus), 0, 0, sharp.width, sharp.height)
  // one pixel per cell: the browser's downscale averages each cell's colour
  const px = document.createElement('canvas')
  px.width = cols
  px.height = rows
  const pctx = px.getContext('2d')!
  pctx.imageSmoothingEnabled = true
  pctx.drawImage(im, ...coverRect(im, cols * CELL, rows * CELL, focus), 0, 0, cols, rows)
  return { sharp, px }
}

/**
 * Random-cell dissolve from photo `from` to `to` on the canvas. Each CELL px cell starts at a random
 * moment; in its own short window it goes blocky, flashes like an LED switching, lands as a block
 * of the new photo and then sharpens. The <img> underneath is swapped at the start (the canvas covers it).
 */
async function pixelSwap(
  cv: HTMLCanvasElement, frame: HTMLElement, imgs: HTMLImageElement[], photos: { focus?: string }[],
  from: number, to: number, alive: { current: boolean }, swap: (i: number) => void,
) {
  const ctx = cv.getContext('2d')
  // background tab: rAF is paused, so just swap
  if (!ctx || document.hidden) { swap(to); return }
  const w = frame.clientWidth, h = frame.clientHeight, dpr = window.devicePixelRatio || 1
  const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL)
  cv.width = Math.round(w * dpr)
  cv.height = Math.round(h * dpr)
  const a = prepare(imgs[from], photos[from].focus, w, h, dpr, cols, rows)
  const b = prepare(imgs[to], photos[to].focus, w, h, dpr, cols, rows)
  const start = Float32Array.from({ length: cols * rows }, () => Math.random() * SPREAD)
  const c = CELL * dpr
  const flash = getComputedStyle(frame).getPropertyValue('--text').trim() || '#e6e6df'

  const draw = (p: number) => {
    ctx.imageSmoothingEnabled = false
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const u = (p - start[r * cols + q]) / (1 - SPREAD) // this cell's own progress
      const x = q * c, y = r * c
      if (u <= 0) ctx.drawImage(a.sharp, x, y, c, c, x, y, c, c)
      else if (u < OLD_PX) ctx.drawImage(a.px, q, r, 1, 1, x, y, c, c)
      else if (u < NEW_PX) {
        ctx.drawImage(b.px, q, r, 1, 1, x, y, c, c)
        if (u < FLASH) { // the switch itself: a brief bright LED, fading out
          ctx.globalAlpha = 0.55 * (1 - (u - OLD_PX) / (FLASH - OLD_PX))
          ctx.fillStyle = flash
          ctx.fillRect(x, y, c, c)
          ctx.globalAlpha = 1
        }
      } else ctx.drawImage(b.sharp, x, y, c, c, x, y, c, c)
    }
  }

  draw(0)
  cv.hidden = false
  swap(to)
  const t0 = performance.now()
  await new Promise<void>((done) => {
    const tick = () => {
      if (!alive.current) return done()
      const p = Math.min(1, (performance.now() - t0) / SWAP_MS)
      draw(p)
      if (p < 1) requestAnimationFrame(tick)
      else done()
    }
    requestAnimationFrame(tick)
  })
  cv.hidden = true
}

/**
 * Real NASA photos for the selected object. With more than one, they rotate every 2 s:
 * the picture dissolves cell by cell, in random order, into the next. Hover pauses it.
 * Remount per object (key) so the state resets.
 */
export function StoryPhoto({ id }: { id: string }) {
  const lang = useLang()
  const t = useT().photo
  const photos = useMemo(() => photosFor(id).map((p) => ({ ...p, caption: photoCaption(p.src.replace(/^\/photos\/|\.jpg$/g, ''), p.caption, lang) })), [id, lang])
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
        title={t.open}
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
        {photo.view === 'orbit' && <span className="photo__tag">{t.orbit}</span>}
        {n > 1 && (
          <span className="photo__count" aria-hidden>
            {photos.map((p, k) => <i key={p.src} className={k === i ? 'is-on' : undefined} />)}
          </span>
        )}
        {!loaded && <span className="photo__wait">{t.wait}</span>}
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
