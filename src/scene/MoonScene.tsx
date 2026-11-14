import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  applyVerticalScale, LAVA_OFF, latToZ, loadDem, lonToX, makeGridMaterial, REVEAL_MAX, TRUE_UNITS_PER_KM, UNITS_PER_KM,
  worldToLonLat, type Dem,
} from "./terrain"
import { subsolarLon } from './sun'
import type { Hardware } from '../data/hardware'
import { features } from '../data/features'
import { STACKED_QUERY } from '../layout'
import { FeatureProjector, LaserBeams, Traverses } from './overlays'

interface Props {
  items: Hardware[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Show relief at true vertical scale instead of exaggerated */
  trueScale: boolean
  /** Lava-flood level in km of real elevation, or null for no lava */
  lavaLevel: number | null
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
const FOG_NEAR = 60
const FOG_FAR = 175

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
  text: string
  /** pointer position in canvas pixels */
  sx: number
  sy: number
  /** surface point in world units */
  point: Vec3
}

function Terrain({ dem, trueScale, lavaLevel, onProbe }: {
  dem: Dem
  trueScale: boolean
  lavaLevel: number | null
  onProbe: (hit: ProbeHit | null) => void
}) {
  const geo = useMemo(() => dem.buildGeometry(), [dem])
  const mat = useMemo(() => makeGridMaterial(BG, FOG_NEAR, FOG_FAR), [])
  // Uniforms are updated through this ref (per frame / per minute), never via the memoized value.
  const matRef = useRef<THREE.ShaderMaterial | null>(null)
  useEffect(() => {
    matRef.current = mat
    return () => { geo.dispose(); mat.dispose() }
  }, [geo, mat])

  // Live Sun: refresh the sub-solar longitude every minute.
  useEffect(() => {
    const update = () => {
      if (matRef.current) matRef.current.uniforms.uSunLon.value = THREE.MathUtils.degToRad(subsolarLon())
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
    const to = trueScale ? TRUE_UNITS_PER_KM : UNITS_PER_KM
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
    if (skip) { m.uniforms.uReveal.value = REVEAL_MAX; return }
    start.current ??= clock.elapsedTime
    const t = Math.min(1, (clock.elapsedTime - start.current) / BOOT_GRID_S)
    m.uniforms.uReveal.value = REVEAL_MAX * (1 - Math.pow(1 - t, 3))
  })

  // Elevation probe: real LOLA value under the cursor (plateau only; the apron isn't real data).
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'touch') return
    const { x, y, z } = e.point
    if (!dem.onMap(x, z)) { onProbe(null); return }
    const { lon, lat } = worldToLonLat(x, z)
    const m = Math.round(dem.metersAt(lon, lat))
    const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`
    onProbe({
      text: `LAT ${fmt(lat, 'N', 'S')}  LON ${fmt(lon, 'E', 'W')}  ELEV ${m >= 0 ? '+' : '−'}${Math.abs(m).toLocaleString('en-US')} m`,
      sx: e.nativeEvent.offsetX, sy: e.nativeEvent.offsetY, point: [x, y, z],
    })
  }

  // Solid surface + grid drawn in the shader: hills naturally hide the lines behind them.
  return <mesh geometry={geo} material={mat} onPointerMove={onMove} onPointerOut={() => onProbe(null)} />
}

/** Flat crosshair ring that follows the probe on the surface. */
function ProbeCross({ crossRef }: { crossRef: React.Ref<THREE.Mesh> }) {
  return (
    <mesh ref={crossRef} rotation-x={-Math.PI / 2} visible={false} renderOrder={2}>
      <ringGeometry args={[0.55, 0.75, 32]} />
      <meshBasicMaterial color="#e6e6df" transparent opacity={0.85} depthTest={false} />
    </mesh>
  )
}

/** Marker stems. Heights follow the live terrain (true-scale morph), so they're set per frame. */
function Poles({ dem, positions }: { dem: Dem; positions: Map<string, Vec3> }) {
  const refs = useRef(new Map<string, THREE.Mesh>())
  useFrame(() => {
    for (const [id, p] of positions) {
      const m = refs.current.get(id)
      if (m) m.position.set(p[0], dem.heightAt(p[0], p[2]) + MARKER_LIFT / 2, p[2])
    }
  })
  return (
    <>
      {[...positions].map(([id]) => (
        <mesh key={id} ref={(m) => { if (m) refs.current.set(id, m); else refs.current.delete(id) }}>
          <cylinderGeometry args={[0.03, 0.03, MARKER_LIFT]} />
          <meshBasicMaterial color="#d8d8d0" />
        </mesh>
      ))}
    </>
  )
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
  const lastScale = useRef(new Map<string, string>())
  useFrame(() => {
    // CameraControls moves the camera (priority −1) but doesn't refresh its matrices — three.js
    // only does that inside render(). Without this, markers use last frame's view and lag behind.
    camera.updateMatrixWorld()
    for (const [id, p] of positions) {
      const el = els.current.get(id)
      if (!el) continue
      v.set(p[0], dem.heightAt(p[0], p[2]) + MARKER_LIFT, p[2])
      // glyph scale by camera distance (--mk-s, used by .marker__ink); only touch the DOM on change
      const s = THREE.MathUtils.clamp(MARKER_REF_DIST / camera.position.distanceTo(v), MARKER_SCALE_MIN, MARKER_SCALE_MAX).toFixed(2)
      if (lastScale.current.get(id) !== s) { el.style.setProperty('--mk-s', s); lastScale.current.set(id, s) }
      v.project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      el.style.display = visible ? '' : 'none'
      if (visible) {
        const x = (v.x * 0.5 + 0.5) * size.width
        const y = (-v.y * 0.5 + 0.5) * size.height
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
        el.style.zIndex = String(Math.round((1 - v.z) * 10000))
      }
    }
  })
  return null
}

// Home views sit *inside* the map, framed on the hardware (sites span lon −43°…+31°, lat −41°…+26°),
// so terrain always runs past every screen edge — the end of the map is never in view.
const HOME = { pos: [-4, 50, 58] as const, target: [-4, -3, 0] as const }
const HOME_PORTRAIT = { pos: [-4, 90, 16] as const, target: [-4, 0, 2] as const }

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
    const k = portrait ? 1.2 : 1
    if (p) c.setLookAt(p[0] + 8 * k, p[1] + 14 * k, p[2] + 16 * k, p[0], p[1], p[2], true)
    else if (portrait) c.setLookAt(...HOME_PORTRAIT.pos, ...HOME_PORTRAIT.target, true)
    else c.setLookAt(...HOME.pos, ...HOME.target, true)
  }, [selectedId, positions, portrait])
  // Keep both the target AND the camera itself inside a box over the plateau (±74 × ±55),
  // so you can never pan, orbit or zoom out far enough to see where the map ends.
  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.boundaryEnclosesCamera = true
    c.setBoundary(new THREE.Box3(new THREE.Vector3(-48, -20, -46), new THREE.Vector3(48, 95, 58)))
    c.boundaryFriction = 0.15
  }, [])
  return (
    <CameraControls
      ref={controls}
      minDistance={10}
      maxDistance={95}
      // desktop can't tilt fully top-down; phones keep their top-down home view
      minPolarAngle={portrait ? 0 : Math.PI * 0.2}
      // stay above the horizon, and only swing ±40° left/right (no looking at the sides or back)
      maxPolarAngle={Math.PI * 0.42}
      minAzimuthAngle={-Math.PI * 0.22}
      maxAzimuthAngle={Math.PI * 0.22}
    />
  )
}

export default function MoonScene({ items, selectedId, onSelect, trueScale, lavaLevel }: Props) {
  const [dem, setDem] = useState<Dem | null>(null)
  useEffect(() => {
    let alive = true
    loadDem().then((d) => { if (alive) setDem(d) }, (e) => console.error("Failed to load lunar elevation data", e))
    return () => { alive = false }
  }, [])
  const positions = useMemo(
    () => layout(items, dem, trueScale ? TRUE_UNITS_PER_KM : UNITS_PER_KM),
    [items, dem, trueScale],
  )
  const els = useRef(new Map<string, HTMLElement>())
  const featureEls = useRef(new Map<string, HTMLElement>())

  // Laser beam only on the selected mirror: nothing to animate or draw otherwise.
  const reflectors = useMemo(() => items
    .filter((h) => h.kind === 'reflector' && h.id === selectedId && positions.has(h.id))
    .map((h) => { const p = positions.get(h.id)!; return { id: h.id, x: p[0], z: p[2] } }), [items, selectedId, positions])
  const rovers = useMemo(() => new Set(items.filter((h) => h.kind === 'rover').map((h) => h.id)), [items])
  const selectedMission = items.find((h) => h.id === selectedId)?.mission ?? null
  const probeLabel = useRef<HTMLDivElement>(null)
  const probeCross = useRef<THREE.Mesh>(null)
  // Probe updates go straight to the DOM / mesh (no React re-render on every mouse move).
  const onProbe = (hit: ProbeHit | null) => {
    const label = probeLabel.current, cross = probeCross.current
    if (!label || !cross) return
    if (!hit) { label.style.display = 'none'; cross.visible = false; return }
    label.textContent = hit.text
    label.style.display = ''
    label.style.transform = `translate(${hit.sx + 14}px, ${hit.sy + 14}px)`
    cross.position.set(hit.point[0], hit.point[1] + 0.08, hit.point[2])
    cross.visible = true
  }

  // Landing order (1966 → 1972) drives the marker ping-in delay.
  const order = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.arrived.localeCompare(b.arrived))
    return new Map(sorted.map((h, i) => [h.id, i]))
  }, [items])
  // Poles appear with the first markers, once the grid has mostly grown in.
  const [polesOn, setPolesOn] = useState(false)
  useEffect(() => {
    if (!dem) return
    const t = setTimeout(() => setPolesOn(true), reducedMotion() ? 0 : BOOT_MARKERS_START_S * 1000)
    return () => clearTimeout(t)
  }, [dem])

  return (
    <div className="moon">
      <Canvas
        camera={{ position: [...HOME.pos], fov: 40, near: 0.1, far: 600 }}
        onPointerMissed={() => onSelect(null)}
        dpr={[1, 2]}
      >
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, FOG_NEAR, FOG_FAR]} />
        {dem && <Terrain dem={dem} trueScale={trueScale} lavaLevel={lavaLevel} onProbe={onProbe} />}
        <ProbeCross crossRef={probeCross} />
        {dem && polesOn && <Poles dem={dem} positions={positions} />}
        {dem && polesOn && reflectors.length > 0 && <LaserBeams dem={dem} anchors={reflectors} />}
        {dem && polesOn && <Traverses dem={dem} visibleRovers={rovers} highlightMission={selectedMission} />}
        {dem && <Projector dem={dem} positions={positions} els={els} />}
        {dem && <FeatureProjector dem={dem} features={features} els={featureEls} />}
        <CameraRig selectedId={selectedId} positions={positions} />
      </Canvas>

      <div className="probe" ref={probeLabel} style={{ display: 'none' }} aria-hidden />

      <div className={`features${dem ? ' is-on' : ''}`} aria-hidden>
        {features.map((f) => (
          <span
            key={f.name}
            ref={(el) => { if (el) featureEls.current.set(f.name, el); else featureEls.current.delete(f.name) }}
            className={`feature feature--${f.kind}`}
            style={{ display: 'none' }}
          >{f.name}</span>
        ))}
      </div>

      <div className={`markers${dem ? ' is-booting' : ''}`}>
        {items.map((h) => (
          <button
            key={h.id}
            ref={(el) => { if (el) els.current.set(h.id, el); else els.current.delete(h.id) }}
            className={`marker marker--${h.status}${h.id === selectedId ? ' is-selected' : ''}`}
            onClick={() => onSelect(h.id)}
            aria-label={`${h.mission} — ${h.name}`}
            data-label={`${h.mission.toUpperCase()} · ${h.name}`}
            style={{ display: 'none', '--ping-delay': `${BOOT_MARKERS_START_S + (order.get(h.id) ?? 0) * BOOT_MARKER_STEP_S}s` } as React.CSSProperties}
          >
            <span className="marker__ping" aria-hidden />
            <span className="marker__ink" />
          </button>
        ))}
      </div>
    </div>
  )
}
