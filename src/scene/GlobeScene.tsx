import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Hardware } from '../data/hardware'
import { features, marsFeatures } from '../data/features'
import { STACKED_QUERY } from '../layout'
import { useBooted, markProgress, markSceneReady } from '../boot'
import { statusAt, useDying } from '../ui/useDying'
import { up, useLang } from '../i18n'
import { loc } from '../data/localize'
import { useT } from '../strings'
import { subsolarLon } from './sun'
import type { PlanetId } from './planets'
import { GLOBE_R, GLOBES, dirOf, loadGlobe, makeGlobeMaterial, type GlobeData } from './globe'

interface Props {
  planet: PlanetId
  items: Hardware[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  trueScale: boolean
  talking: ReadonlySet<string>
}

const BG = '#0d0e0d'
const REVEAL_S = 1.8
const RELIEF_EASE = 2.4      // 1/s
const MARKER_LIFT = 0.9      // world units above the ground
const MARKER_REF_DIST = 48   // glyph 1× at this camera distance
/** Same-site hardware fans out on a small circle (degrees of arc) so markers don't stack */
const FAN_DEG = 2.2
/** Close-up distance from the centre when a site is selected (× radius) */
const FLY_K = 2.3
/** Idle spin, rad/s, starts this long after the last drag */
const SPIN = 0.035
const SPIN_AFTER_S = 5
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Anchor { dir: THREE.Vector3; h: number }

/** Unit direction + normalized height for every marker (same-site groups fanned out) */
function anchors(items: Hardware[], g: GlobeData) {
  const out = new Map<string, Anchor>()
  const bySite = new Map<string, Hardware[]>()
  for (const h of items) bySite.set(h.site, [...(bySite.get(h.site) ?? []), h])
  for (const group of bySite.values()) {
    group.forEach((h, i) => {
      const a = (i / group.length) * Math.PI * 2
      const r = group.length > 1 ? FAN_DEG : 0
      const lat = group[0].lat + Math.sin(a) * r
      const lon = group[0].lon + (Math.cos(a) * r) / Math.max(0.2, Math.cos(THREE.MathUtils.degToRad(lat)))
      out.set(h.id, { dir: dirOf(lat, lon), h: g.heightAt(lat, lon) })
    })
  }
  return out
}

function Planet({ data, mat }: { data: GlobeData; mat: THREE.ShaderMaterial }) {
  const geo = useMemo(() => data.geometry(), [data])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={mat} />
}

/** Live uniforms: Sun, relief morph, boot reveal, selected ring, pixel ratio */
function Uniforms({ planet, mat, trueScale, relief, sel }: {
  planet: PlanetId
  mat: THREE.ShaderMaterial
  trueScale: boolean
  relief: React.RefObject<number>
  sel: Anchor | null
}) {
  const booted = useBooted()
  const skip = useMemo(() => reducedMotion(), [])
  const t0 = useRef<number | null>(null)
  useEffect(() => {
    const update = () => mat.uniforms.uSun.value.copy(dirOf(0, subsolarLon(new Date(), planet)))
    update()
    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [mat, planet])
  useEffect(() => {
    if (sel) mat.uniforms.uSel.value.copy(sel.dir)
  }, [mat, sel])
  useFrame(({ clock, gl }, delta) => {
    const u = mat.uniforms
    markSceneReady()
    u.uPx.value = gl.getPixelRatio()
    const k = skip ? 1 : 1 - Math.exp(-delta * RELIEF_EASE)
    const target = trueScale ? GLOBES[planet].trueRelief : GLOBES[planet].relief
    relief.current += (target - relief.current) * k
    u.uRelief.value = relief.current
    u.uSelOn.value += ((sel ? 1 : 0) - u.uSelOn.value) * (skip ? 1 : 1 - Math.exp(-delta * 6))
    if (skip) { u.uReveal.value = Math.PI; return }
    if (!booted) { u.uReveal.value = 0; return }
    t0.current ??= clock.elapsedTime
    const t = Math.min(1, (clock.elapsedTime - t0.current) / REVEAL_S)
    u.uReveal.value = Math.PI * (1 - Math.pow(1 - t, 3))
  })
  return null
}

const surface = (a: Anchor, relief: number, lift: number, out: THREE.Vector3) =>
  out.copy(a.dir).multiplyScalar(GLOBE_R * (1 + a.h * relief) + lift)

/** Moves the DOM marker buttons each frame; hides those beyond the horizon. */
function Projector({ pos, els, relief }: {
  pos: Map<string, Anchor>
  els: React.RefObject<Map<string, HTMLElement>>
  relief: React.RefObject<number>
}) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  const base = useMemo(() => new THREE.Vector3(), [])
  const toCam = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    camera.updateMatrixWorld()
    for (const [id, a] of pos) {
      const el = els.current.get(id)
      if (!el) continue
      surface(a, relief.current, 0, base)
      toCam.copy(camera.position).sub(base).normalize()
      const facing = a.dir.dot(toCam)
      surface(a, relief.current, MARKER_LIFT, v)
      const s = THREE.MathUtils.clamp(MARKER_REF_DIST / camera.position.distanceTo(v), 0.65, 1.1)
      v.project(camera)
      base.project(camera)
      const visible = facing > 0.08 && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      el.style.display = visible ? '' : 'none'
      if (!visible) continue
      el.style.setProperty('--mk-s', s.toFixed(2))
      const x = Math.round((v.x * 0.5 + 0.5) * size.width)
      const y = Math.round((-v.y * 0.5 + 0.5) * size.height)
      const yBase = Math.round((-base.y * 0.5 + 0.5) * size.height)
      el.style.setProperty('--stem', `${Math.max(0, yBase - y)}px`)
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
      el.style.zIndex = String(Math.round((1 - v.z) * 10000))
      // markers near the limb fade out instead of popping (a CSS variable: the marker-in
      // animation holds opacity with fill: both, which would override an inline opacity)
      el.style.setProperty('--fade', THREE.MathUtils.smoothstep(facing, 0.08, 0.3).toFixed(2))
    }
  })
  return null
}

function FeatureLabels({ feats, data, els, relief }: {
  feats: { name: string; lat: number; lon: number }[]
  data: GlobeData
  els: React.RefObject<Map<string, HTMLElement>>
  relief: React.RefObject<number>
}) {
  const { camera, size } = useThree()
  const list = useMemo(() => feats.map((f) => ({ name: f.name, a: { dir: dirOf(f.lat, f.lon), h: data.heightAt(f.lat, f.lon) } })), [feats, data])
  const v = useMemo(() => new THREE.Vector3(), [])
  const toCam = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    for (const { name, a } of list) {
      const el = els.current.get(name)
      if (!el) continue
      surface(a, relief.current, 0.2, v)
      const facing = a.dir.dot(toCam.copy(camera.position).sub(v).normalize())
      v.project(camera)
      const visible = facing > 0.35 && v.z < 1
      el.style.display = visible ? '' : 'none'
      if (!visible) continue
      el.style.opacity = String(THREE.MathUtils.smoothstep(facing, 0.35, 0.6))
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px) translate(-50%, -50%)`
    }
  })
  return null
}

function CameraRig({ planet, sel }: { planet: PlanetId; sel: Anchor | null }) {
  const controls = useRef<CameraControls>(null)
  const get = useThree((s) => s.get)
  const { width, height } = useThree((s) => s.size)
  const stacked = window.matchMedia(STACKED_QUERY).matches
  const portrait = width / height < 1.25
  // the right panel and bottom row cover part of the canvas in the overlay layout (same clamps as MoonScene)
  const panel = stacked ? 0 : Math.min(340, Math.max(250, width * 0.2))
  const bottomRow = stacked ? 0 : Math.min(240, Math.max(150, height * 0.25))
  const fov = portrait ? 50 : 40
  // distance at which the globe's radius fills ~38% of the smaller visible side
  const fit = useMemo(() => {
    const avail = Math.min(width - panel, height - bottomRow)
    const pxPerUnitAt1 = height / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)))
    return Math.max(GLOBE_R * 1.6, (GLOBE_R * pxPerUnitAt1) / (0.38 * Math.max(avail, 1)))
  }, [width, height, panel, bottomRow, fov])
  const lastTouch = useRef(-Infinity)

  useEffect(() => {
    const camera = get().camera as THREE.PerspectiveCamera
    camera.fov = fov
    if (panel === 0) camera.clearViewOffset()
    else camera.setViewOffset(width, height, panel / 2, bottomRow / 2, width, height)
    camera.updateProjectionMatrix()
  }, [get, fov, width, height, panel, bottomRow])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.normalizeRotations()
    const { home } = GLOBES[planet]
    const p = sel
      ? sel.dir.clone().multiplyScalar(GLOBE_R * FLY_K)
      : dirOf(home.lat, home.lon).multiplyScalar(fit)
    c.setLookAt(p.x, p.y, p.z, 0, 0, 0, true)
  }, [sel, fit, planet])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const touch = () => { lastTouch.current = performance.now() / 1000 }
    c.addEventListener('controlstart', touch)
    c.addEventListener('control', touch)
    return () => { c.removeEventListener('controlstart', touch); c.removeEventListener('control', touch) }
  }, [])

  const skip = useMemo(() => reducedMotion(), [])
  useFrame((_, delta) => {
    const c = controls.current
    if (!c || sel || skip) return
    if (performance.now() / 1000 - lastTouch.current < SPIN_AFTER_S) return
    c.rotate(SPIN * delta, 0, false)
  })

  return (
    <CameraControls
      ref={controls}
      minDistance={GLOBE_R * 1.55}
      maxDistance={Math.max(fit * 1.6, GLOBE_R * 3)}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI - 0.12}
      truckSpeed={0} // orbit + zoom only: the globe stays centred
    />
  )
}

/** Key by planet. */
export default function GlobeScene({ planet, items, selectedId, onSelect, trueScale, talking }: Props) {
  const t = useT()
  useLang()
  const dying = useDying(items, talking)
  const booted = useBooted()
  const [data, setData] = useState<GlobeData | null>(null)
  useEffect(() => {
    let alive = true
    loadGlobe(planet).then((d) => { markProgress(0.85); if (alive) setData(d) }, (e) => console.error('Failed to load globe maps', e))
    return () => { alive = false }
  }, [planet])
  const mat = useMemo(() => makeGlobeMaterial(planet, BG), [planet])
  useEffect(() => () => mat.dispose(), [mat])
  const relief = useRef(trueScale ? GLOBES[planet].trueRelief : GLOBES[planet].relief)
  const pos = useMemo(() => (data ? anchors(items, data) : new Map<string, Anchor>()), [items, data])
  const sel = selectedId ? pos.get(selectedId) ?? null : null
  const els = useRef(new Map<string, HTMLElement>())
  const featureEls = useRef(new Map<string, HTMLElement>())
  const feats = planet === 'moon' ? features : marsFeatures
  const order = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.arrived.localeCompare(b.arrived))
    return new Map(sorted.map((h, i) => [h.id, i]))
  }, [items])
  const home = GLOBES[planet].home

  return (
    <div className="moon globe-view">
      <Canvas
        camera={{ position: dirOf(home.lat, home.lon).multiplyScalar(GLOBE_R * 6).toArray(), fov: 40, near: 0.1, far: 1000 }}
        onPointerMissed={() => onSelect(null)}
        dpr={[1, 2]}
      >
        <color attach="background" args={[BG]} />
        {data && <Planet data={data} mat={mat} />}
        <Uniforms planet={planet} mat={mat} trueScale={trueScale} relief={relief} sel={sel} />
        {data && <Projector pos={pos} els={els} relief={relief} />}
        {data && <FeatureLabels feats={feats} data={data} els={featureEls} relief={relief} />}
        <CameraRig planet={planet} sel={sel} />
      </Canvas>

      <div className={`features${data ? ' is-on' : ''}`} lang="la" aria-hidden>
        {feats.map((f) => (
          <span key={f.name} ref={(el) => { if (el) featureEls.current.set(f.name, el); else featureEls.current.delete(f.name) }}
            className={`feature feature--${f.kind}`} style={{ display: 'none' }}>{f.name}</span>
        ))}
      </div>

      <div className={`markers${data ? (booted ? ' is-booting' : ' is-waiting') : ''}`}>
        {items.map((h) => (
          <button
            key={h.id}
            ref={(el) => { if (el) els.current.set(h.id, el); else els.current.delete(h.id) }}
            className={`marker marker--${statusAt(h, talking)}${h.id === selectedId ? ' is-selected' : ''}${dying.has(h.id) ? ' is-dying' : ''}`}
            onClick={() => onSelect(h.id)}
            aria-label={`${loc(h).mission} — ${loc(h).name}`}
            data-label={`${up(loc(h).mission)} · ${loc(h).name}`}
            style={{ display: 'none', '--ping-delay': `${0.9 + (order.get(h.id) ?? 0) * 0.07}s` } as React.CSSProperties}
          >
            <span className="marker__ink" />
            <span className="marker__stem" aria-hidden />
          </button>
        ))}
      </div>

      <div className="globe__credit" aria-hidden>{t.globe.credit}</div>
    </div>
  )
}
