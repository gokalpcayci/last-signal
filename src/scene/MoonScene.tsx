import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  activePlanet, applyVerticalScale, LAVA_OFF, latToZ, loadDem, lonToX, makeGridMaterial, REVEAL_MAX, trueUnitsPerKm,
  unitsPerKm, worldToLonLat, type Dem,
} from "./terrain"
import { subsolarLon } from './sun'
import type { Hardware } from '../data/hardware'
import { features, marsFeatures } from '../data/features'
import { STACKED_QUERY } from '../layout'
import { FeatureProjector, Traverses } from './overlays'
import { isBooted, markProgress, markSceneReady, useBooted } from '../boot'
import { statusAt, useDying } from '../ui/useDying'
import { fmtKm, heightGauge, nearestFeature, nearestSite } from './probeInfo'
import { up, useLang, num } from '../i18n'
import { loc } from '../data/localize'
import { T } from '../strings'

interface Props {
  items: Hardware[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Show relief at true vertical scale instead of exaggerated */
  trueScale: boolean
  /** Lava-flood level in km of real elevation, or null for no lava */
  lavaLevel: number | null
  /** silent objects still talking at the timeline playhead */
  talking: ReadonlySet<string>
}

type Vec3 = [number, number, number]
const MARKER_LIFT = 1.4
/**
 * Depth scaling for the marker glyphs: 1× at this camera distance (world units). The desktop
 * overview (~77) lands near 0.9×, the phone top-down view (~92) ~0.75×, a fly-to (~23) 1.1×. Clamped so far
 * marks stay readable and near ones never balloon.
 */
const MARKER_REF_DIST = 70
const MARKER_SCALE_MIN = 0.7
const MARKER_SCALE_MAX = 1.1
const BG = "#0d0e0d"

// Boot-up sequence (seconds): the grid grows out from the center, then markers
// ping in one by one in landing order (1966 → 1972).
const BOOT_GRID_S = 2.2
const BOOT_MARKERS_START_S = 1.5
const BOOT_MARKER_STEP_S = 0.09
const SCALE_MORPH_S = 1.4
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hardware at the same site sits within metres of each other — fan them out so markers don't overlap. */
function layout(items: Hardware[], dem: Dem | null, unitsPerKm: number) {
  const out = new Map<string, Vec3>()
  if (!dem) return out
  const bySite = new Map<string, Hardware[]>()
  for (const h of items) bySite.set(h.site, [...(bySite.get(h.site) ?? []), h])
  for (const group of bySite.values()) {
    const cx = lonToX(group[0].lon), cz = latToZ(group[0].lat)
    group.forEach((h, i) => {
      const a = (i / group.length) * Math.PI * 2
      const r = group.length > 1 ? 3.4 : 0
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
      out.set(h.id, [x, dem.heightAt(x, z, unitsPerKm), z])
    })
  }
  return out
}

export interface ProbeHit {
  lon: number
  lat: number
  /** real LOLA / MOLA elevation, meters */
  meters: number
  /** pointer position in canvas pixels */
  sx: number
  sy: number
}

/** Crosshair size: outer corner this many px from the center (at the probe's distance). */
const RETICLE_PX = 18
/** Click snap: corner ticks close in over SNAP_IN_S, then ease back out over SNAP_OUT_S. */
const SNAP_IN_S = 0.06
const SNAP_OUT_S = 0.28
/** A press that moves more than this (px) was a camera drag, not a click. */
const CLICK_SLOP_PX = 4

function Terrain({ dem, trueScale, lavaLevel, onProbe }: {
  dem: Dem
  trueScale: boolean
  lavaLevel: number | null
  onProbe: (hit: ProbeHit | null) => void
}) {
  const geo = useMemo(() => dem.buildGeometry(), [dem])
  const mat = useMemo(() => makeGridMaterial(BG, ...activePlanet().fog), [])
  // Uniforms are updated through this ref (per frame / per minute), never via the memoized value.
  const matRef = useRef<THREE.ShaderMaterial | null>(null)
  useEffect(() => {
    matRef.current = mat
    return () => { geo.dispose(); mat.dispose() }
  }, [geo, mat])

  // Live Sun: refresh the sub-solar longitude every minute.
  useEffect(() => {
    const update = () => {
      // the shader's longitudes are measured from the map center
      const p = activePlanet()
      const rel = THREE.MathUtils.euclideanModulo(subsolarLon(new Date(), p.id) - p.lonCenter + 180, 360) - 180
      if (matRef.current) matRef.current.uniforms.uSunLon.value = THREE.MathUtils.degToRad(rel)
    }
    update()
    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [mat])

  // Boot reveal: grow uReveal from 0 to REVEAL_MAX with an ease-out.
  const start = useRef<number | null>(null)
  const skip = useMemo(() => reducedMotion(), [])
  // True-scale morph: ease dem.unitsPerKm to the target and re-set the mesh heights each frame.
  const morph = useRef<{ from: number; to: number; t0: number | null } | null>(null)
  useEffect(() => {
    const to = trueScale ? trueUnitsPerKm() : unitsPerKm()
    if (to !== dem.unitsPerKm) morph.current = { from: dem.unitsPerKm, to, t0: null }
  }, [trueScale, dem])
  // Lava: ease the shader level toward the target, so switching on makes it rise from the
  // deepest basin, switching off drains it, and slider drags glide (frame-rate independent).
  const lavaTarget = lavaLevel ?? LAVA_OFF
  useFrame((_, delta) => {
    const m = matRef.current
    if (!m) return
    const u = m.uniforms.uLava
    if (skip) { u.value = lavaTarget; return }
    u.value += (lavaTarget - u.value) * (1 - Math.exp(-delta * 2.2))
  })

  useFrame(({ clock }) => {
    const mo = morph.current
    if (mo) {
      mo.t0 ??= clock.elapsedTime
      const t = skip ? 1 : Math.min(1, (clock.elapsedTime - mo.t0) / SCALE_MORPH_S)
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 // ease-in-out cubic
      dem.unitsPerKm = mo.from + (mo.to - mo.from) * e
      applyVerticalScale(geo, dem.unitsPerKm)
      if (t >= 1) morph.current = null
    }
    const m = matRef.current
    if (!m) return
    markSceneReady()   // first frame drawn (shaders compiled): the page loader may hand off
    if (skip) { m.uniforms.uReveal.value = REVEAL_MAX; return }
    if (!isBooted()) { m.uniforms.uReveal.value = 0; return }   // wait behind the loader
    start.current ??= clock.elapsedTime
    const t = Math.min(1, (clock.elapsedTime - start.current) / BOOT_GRID_S)
    m.uniforms.uReveal.value = REVEAL_MAX * (1 - Math.pow(1 - t, 3))
  })

  // Elevation probe: real LOLA value under the cursor (plateau only; the apron isn't real data).
  // The crosshair and live contour live in the grid shader; this only feeds its uniforms.
  const probe = useRef({ on: false, point: new THREE.Vector3(), snapAt: -1 })
  const hide = () => { probe.current.on = false; onProbe(null) }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'touch') return
    const { x, z } = e.point
    if (!dem.onMap(x, z)) { hide(); return }
    const { lon, lat } = worldToLonLat(x, z)
    probe.current.on = true
    probe.current.point.copy(e.point)
    const u = matRef.current?.uniforms
    if (u) {
      u.uProbe.value.set(x, z)
      u.uProbeKm.value = dem.kmAt(x, z)
    }
    onProbe({ lon, lat, meters: dem.metersAt(lon, lat), sx: e.nativeEvent.offsetX, sy: e.nativeEvent.offsetY })
  }
  // Click on the map (not the end of an orbit drag): snap the crosshair.
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (skip || !probe.current.on || e.delta > CLICK_SLOP_PX) return
    probe.current.snapAt = performance.now() / 1000
  }
  // Fade the probe in/out, and keep the crosshair a constant size on screen.
  useFrame(({ camera, size }, delta) => {
    const u = matRef.current?.uniforms
    if (!u) return
    const target = probe.current.on ? 1 : 0
    u.uProbeOn.value = skip ? target : u.uProbeOn.value + (target - u.uProbeOn.value) * (1 - Math.exp(-delta * 14))
    const fov = (camera as THREE.PerspectiveCamera).fov * THREE.MathUtils.DEG2RAD
    const pxWorld = (2 * Math.tan(fov / 2) * camera.position.distanceTo(probe.current.point)) / size.height
    u.uReticle.value = RETICLE_PX * pxWorld
    // snap envelope: fast linear in, ease-out cubic back
    const t = performance.now() / 1000 - probe.current.snapAt
    u.uSnap.value = probe.current.snapAt < 0 || t > SNAP_IN_S + SNAP_OUT_S ? 0
      : t < SNAP_IN_S ? t / SNAP_IN_S
      : Math.pow(1 - (t - SNAP_IN_S) / SNAP_OUT_S, 3)
  })

  // Solid surface + grid drawn in the shader: hills naturally hide the lines behind them.
  return <mesh geometry={geo} material={mat} onPointerMove={onMove} onPointerOut={hide} onClick={onClick} />
}

/**
 * Projects each marker's 3D anchor to screen space every frame and moves the
 * matching DOM button. Plain DOM (not drei <Html>) avoids nested React roots.
 */
function Projector({ dem, positions, els }: {
  dem: Dem
  positions: Map<string, Vec3>
  els: React.RefObject<Map<string, HTMLElement>>
}) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  const base = useMemo(() => new THREE.Vector3(), [])
  const lastScale = useRef(new Map<string, string>())
  useFrame(() => {
    // CameraControls moves the camera (priority −1) but doesn't refresh its matrices — three.js
    // only does that inside render(). Without this, markers use last frame's view and lag behind.
    camera.updateMatrixWorld()
    for (const [id, p] of positions) {
      const el = els.current.get(id)
      if (!el) continue
      const ground = dem.heightAt(p[0], p[2])
      v.set(p[0], ground + MARKER_LIFT, p[2])
      // glyph scale by camera distance (--mk-s, used by .marker__ink); only touch the DOM on change
      const s = THREE.MathUtils.clamp(MARKER_REF_DIST / camera.position.distanceTo(v), MARKER_SCALE_MIN, MARKER_SCALE_MAX).toFixed(2)
      if (lastScale.current.get(id) !== s) { el.style.setProperty('--mk-s', s); lastScale.current.set(id, s) }
      v.project(camera)
      base.set(p[0], ground, p[2]).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      el.style.display = visible ? '' : 'none'
      if (visible) {
        // whole pixels: keeps the pixel stem crisp (no half-pixel blur)
        const x = Math.round((v.x * 0.5 + 0.5) * size.width)
        const y = Math.round((-v.y * 0.5 + 0.5) * size.height)
        const yBase = Math.round((-base.y * 0.5 + 0.5) * size.height)
        el.style.setProperty('--stem', `${Math.max(0, yBase - y)}px`)
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
        el.style.zIndex = String(Math.round((1 - v.z) * 10000))
      }
    }
  })
  return null
}

// Home views (planets.ts) sit *inside* the map, framed on the hardware, so terrain always
// runs past every screen edge — the end of the map is never in view.

function CameraRig({ selectedId, positions }: { selectedId: string | null; positions: Map<string, Vec3> }) {
  const controls = useRef<CameraControls>(null)
  const aspect = useThree((s) => s.size.width / s.size.height)
  const get = useThree((s) => s.get)
  const { width, height } = useThree((s) => s.size)
  // Portrait screens are tall and narrow: a low horizon view wastes the height and
  // crowds markers. Use a wider lens and a more top-down home view instead.
  const portrait = aspect < 1.25 // square-ish or tall (phone map section) → top-down
  // Re-evaluated on every resize render.
  const stacked = window.matchMedia(STACKED_QUERY).matches
  // In the overlay layout the right panel covers part of the canvas.
  const panel = stacked ? 0 : Math.min(340, Math.max(250, width * 0.2))
  // ...and the bottom row covers the lower part (same clamp as .bottom in index.css)
  const bottomRow = stacked ? 0 : Math.min(240, Math.max(150, height * 0.25))

  useEffect(() => {
    // Read the camera inside the effect (not from render scope) before mutating it.
    const camera = get().camera as THREE.PerspectiveCamera
    camera.fov = portrait ? 55 : 40
    // Shift the projection so the scene centers in the visible area (left of the panel, above the bottom row).
    if (panel === 0) camera.clearViewOffset()
    else camera.setViewOffset(width, height, panel / 2, bottomRow / 2, width, height)
    camera.updateProjectionMatrix()
  }, [get, portrait, width, height, panel, bottomRow])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const p = selectedId ? positions.get(selectedId) : undefined
    const k = (portrait ? 1.2 : 1) * activePlanet().camera.flyTo
    if (p) c.setLookAt(p[0] + 8 * k, p[1] + 14 * k, p[2] + 16 * k, p[0], p[1], p[2], true)
    else {
      const { home, portrait: top } = activePlanet().camera
      const v = portrait ? top : home
      c.setLookAt(...v.pos, ...v.target, true)
    }
  }, [selectedId, positions, portrait])
  // Keep both the target AND the camera itself inside a box over the plateau,
  // so you can never pan, orbit or zoom out far enough to see where the map ends.
  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.boundaryEnclosesCamera = true
    const { min, max } = activePlanet().camera.box
    c.setBoundary(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)))
    c.boundaryFriction = 0.15
  }, [])
  return (
    <CameraControls
      ref={controls}
      minDistance={activePlanet().camera.minDistance}
      maxDistance={activePlanet().camera.maxDistance}
      // desktop can't tilt fully top-down; phones keep their top-down home view
      minPolarAngle={portrait ? 0 : Math.PI * 0.2}
      // stay above the horizon, and only swing ±40° left/right (no looking at the sides or back)
      maxPolarAngle={Math.PI * 0.42}
      minAzimuthAngle={-Math.PI * 0.22}
      maxAzimuthAngle={Math.PI * 0.22}
    />
  )
}

/** Key this component by planet: it reads the active planet (terrain.ts) once per mount. */
export default function MoonScene({ items, selectedId, onSelect, trueScale, lavaLevel, talking }: Props) {
  const dying = useDying(items, talking)
  useLang() // marker labels re-render on a language switch
  const planet = activePlanet()
  const isMoon = planet.id === 'moon'
  const feats = isMoon ? features : marsFeatures
  const [dem, setDem] = useState<Dem | null>(null)
  useEffect(() => {
    let alive = true
    loadDem().then((d) => { markProgress(0.85); if (alive) setDem(d) }, (e) => console.error(`Failed to load elevation data for ${planet.label}`, e))
    return () => { alive = false }
  }, [planet])
  const positions = useMemo(
    () => layout(items, dem, trueScale ? trueUnitsPerKm() : unitsPerKm()),
    [items, dem, trueScale],
  )
  const els = useRef(new Map<string, HTMLElement>())
  const featureEls = useRef(new Map<string, HTMLElement>())

  const rovers = useMemo(() => new Set(items.filter((h) => h.kind === 'rover').map((h) => h.id)), [items])
  const selectedMission = items.find((h) => h.id === selectedId)?.mission ?? null
  const probeLabel = useRef<HTMLDivElement>(null)
  const parts = useRef<Record<string, HTMLElement>>({})
  const part = (k: string) => (el: HTMLElement | null) => { if (el) parts.current[k] = el }
  // Probe updates go straight to the DOM (no React re-render on every mouse move).
  const onProbe = (hit: ProbeHit | null) => {
    const label = probeLabel.current, P = parts.current
    if (!label) return
    if (!hit) { label.classList.remove('is-on'); return }
    const { lon, lat, meters, sx, sy } = hit
    const r = planet.radiusKm
    const place = nearestFeature(lon, lat, feats, r)
    P.place.textContent = place ? place.name : ''
    P.placeDir.textContent = place && !place.inside ? `${place.arrow} ${fmtKm(place.km)} km` : ''
    const m = Math.round(meters)
    P.elev.textContent = `${m >= 0 ? '+' : '−'}${num(Math.abs(m))} m`
    const g = heightGauge(dem ? dem.percentileOf(meters) : 0.5)
    P.g1.textContent = g.before
    P.g2.textContent = g.after
    const site = nearestSite(lon, lat, items, r)
    P.siteRow.style.display = site ? '' : 'none'
    if (site) {
      P.siteRow.classList.toggle('is-active', site.active)
      P.site.textContent = up(site.name)
      P.siteDir.textContent = site.inside ? T().probe.here : `${site.arrow} ${fmtKm(site.km)} km`
    }
    // the box grows toward the middle of the map, never off its edge
    const w = label.parentElement?.clientWidth ?? 0
    label.classList.toggle('is-flipx', sx > w * 0.55)
    label.classList.toggle('is-flipy', sy < 110)
    label.style.transform = `translate(${sx}px, ${sy}px)`
    label.classList.add('is-on')
  }

  // Landing order (1966 → 1972) drives the marker ping-in delay.
  const order = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.arrived.localeCompare(b.arrived))
    return new Map(sorted.map((h, i) => [h.id, i]))
  }, [items])
  // Beams and trails appear with the first markers, once the grid has mostly grown in.
  const [polesOn, setPolesOn] = useState(false)
  const booted = useBooted()
  useEffect(() => {
    if (!dem || !booted) return
    const t = setTimeout(() => setPolesOn(true), reducedMotion() ? 0 : BOOT_MARKERS_START_S * 1000)
    return () => clearTimeout(t)
  }, [dem, booted])

  return (
    <div className="moon">
      <Canvas
        camera={{ position: [...planet.camera.home.pos], fov: 40, near: 0.1, far: 600 }}
        onPointerMissed={() => onSelect(null)}
        dpr={[1, 2]}
      >
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, ...planet.fog]} />
        {dem && <Terrain dem={dem} trueScale={trueScale} lavaLevel={lavaLevel} onProbe={onProbe} />}
        {dem && polesOn && isMoon && <Traverses dem={dem} visibleRovers={rovers} highlightMission={selectedMission} />}
        {dem && <Projector dem={dem} positions={positions} els={els} />}
        {dem && <FeatureProjector dem={dem} features={feats} els={featureEls} />}
        <CameraRig selectedId={selectedId} positions={positions} />
      </Canvas>

      <div className="probe" ref={probeLabel} aria-hidden>
        <svg className="probe__lead" width="34" height="28" viewBox="0 0 34 28">
          <polyline points="10,18 22,6 34,6" />
        </svg>
        {/* two rows split by the leader line running through: place + elevation / gauge + nearest site */}
        <div className="probe__box" lang="en" /* Latin names + LO/HI: English caps, no dotted İ */>
          <span className="probe__place"><span ref={part('place')} /><span className="probe__dir" ref={part('placeDir')} /></span>
          <b className="probe__elev" ref={part('elev')} />
          <i className="probe__rule" />
          <span className="probe__gauge">lo <span ref={part('g1')} /><b>▲</b><span ref={part('g2')} /> hi</span>
          <span className="probe__site" ref={part('siteRow')}>
            <i /><span ref={part('site')} /><span className="probe__dir" ref={part('siteDir')} />
          </span>
        </div>
      </div>

      <div className={`features${dem ? ' is-on' : ''}`} lang="la" aria-hidden>
        {feats.map((f) => (
          <span
            key={f.name}
            ref={(el) => { if (el) featureEls.current.set(f.name, el); else featureEls.current.delete(f.name) }}
            className={`feature feature--${f.kind}`}
            style={{ display: 'none' }}
          >{f.name}</span>
        ))}
      </div>

      <div className={`markers${dem ? (booted ? ' is-booting' : ' is-waiting') : ''}`}>
        {items.map((h) => (
          <button
            key={h.id}
            ref={(el) => { if (el) els.current.set(h.id, el); else els.current.delete(h.id) }}
            className={`marker marker--${statusAt(h, talking)}${h.id === selectedId ? ' is-selected' : ''}${dying.has(h.id) ? ' is-dying' : ''}`}
            onClick={() => onSelect(h.id)}
            aria-label={`${loc(h).mission} — ${loc(h).name}`}
            data-label={`${up(loc(h).mission)} · ${loc(h).name}`}
            style={{ display: 'none', '--ping-delay': `${BOOT_MARKERS_START_S + (order.get(h.id) ?? 0) * BOOT_MARKER_STEP_S}s` } as React.CSSProperties}
          >
            <span className="marker__ink" />
            <span className="marker__stem" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  )
}
