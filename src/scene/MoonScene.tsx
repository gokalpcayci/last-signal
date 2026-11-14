import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { latToZ, loadDem, lonToX, makeGridMaterial, REVEAL_MAX, worldToLonLat, type Dem } from "./terrain"
import { subsolarLon } from './sun'
import type { Hardware } from '../data/hardware'
import { STACKED_QUERY } from '../layout'

interface Props {
  items: Hardware[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

type Vec3 = [number, number, number]
const MARKER_LIFT = 1.4
const BG = "#0d0e0d"
const FOG_NEAR = 90
const FOG_FAR = 175

// Boot-up sequence (seconds): the grid grows out from the center, then markers
// ping in one by one in landing order (1966 → 1972).
const BOOT_GRID_S = 2.2
const BOOT_MARKERS_START_S = 1.5
const BOOT_MARKER_STEP_S = 0.09
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hardware at the same site sits within metres of each other — fan them out so markers don't overlap. */
function layout(items: Hardware[], dem: Dem | null) {
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
      out.set(h.id, [x, dem.heightAt(x, z), z])
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

function Terrain({ dem, onProbe }: { dem: Dem; onProbe: (hit: ProbeHit | null) => void }) {
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
  useFrame(({ clock }) => {
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

function Poles({ positions }: { positions: Vec3[] }) {
  return (
    <>
      {positions.map((p, i) => (
        <mesh key={i} position={[p[0], p[1] + MARKER_LIFT / 2, p[2]]}>
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
function Projector({ positions, els }: { positions: Map<string, Vec3>; els: React.RefObject<Map<string, HTMLElement>> }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    for (const [id, p] of positions) {
      const el = els.current.get(id)
      if (!el) continue
      v.set(p[0], p[1] + MARKER_LIFT, p[2]).project(camera)
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

export default function MoonScene({ items, selectedId, onSelect }: Props) {
  const [dem, setDem] = useState<Dem | null>(null)
  useEffect(() => {
    let alive = true
    loadDem().then((d) => { if (alive) setDem(d) }, (e) => console.error("Failed to load lunar elevation data", e))
    return () => { alive = false }
  }, [])
  const positions = useMemo(() => layout(items, dem), [items, dem])
  const els = useRef(new Map<string, HTMLElement>())
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
        {dem && <Terrain dem={dem} onProbe={onProbe} />}
        <ProbeCross crossRef={probeCross} />
        {polesOn && <Poles positions={[...positions.values()]} />}
        <Projector positions={positions} els={els} />
        <CameraRig selectedId={selectedId} positions={positions} />
      </Canvas>

      <div className="probe" ref={probeLabel} style={{ display: 'none' }} aria-hidden />

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
            <span className="marker__icon">{h.status === 'active' ? '✓' : '!'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
