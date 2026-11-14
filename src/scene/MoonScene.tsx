import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { latToZ, loadDem, lonToX, makeGridMaterial, type Dem } from "./terrain"
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
const FOG_NEAR = 120
const FOG_FAR = 250

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

function Terrain({ dem }: { dem: Dem }) {
  const geo = useMemo(() => dem.buildGeometry(), [dem])
  const mat = useMemo(() => makeGridMaterial(BG, FOG_NEAR, FOG_FAR), [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  // Solid surface + grid drawn in the shader: hills naturally hide the lines behind them.
  return <mesh geometry={geo} material={mat} />
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

// Low, distant view: flat apron in the foreground, cliff, then the plateau (reference framing).
const HOME = { pos: [0, 33, 158] as const, target: [0, -3, 2] as const }
// Sites span lon -43°…+31° → center the portrait view between them (x ≈ -3).
const HOME_PORTRAIT = { pos: [-4, 108, 82] as const, target: [-4, 0, -2] as const }

function CameraRig({ selectedId, positions }: { selectedId: string | null; positions: Map<string, Vec3> }) {
  const controls = useRef<CameraControls>(null)
  const aspect = useThree((s) => s.size.width / s.size.height)
  const get = useThree((s) => s.get)
  const { width, height } = useThree((s) => s.size)
  // Portrait screens are tall and narrow: a low horizon view wastes the height and
  // crowds markers. Use a wider lens and a more top-down home view instead.
  const portrait = aspect < 1
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
  return <CameraControls ref={controls} minDistance={10} maxDistance={240} maxPolarAngle={Math.PI * 0.45} />
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

  return (
    <div className="moon">
      <Canvas
        camera={{ position: [...HOME.pos], fov: 40, near: 0.1, far: 600 }}
        onPointerMissed={() => onSelect(null)}
        dpr={[1, 2]}
      >
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, FOG_NEAR, FOG_FAR]} />
        {dem && <Terrain dem={dem} />}
        <Poles positions={[...positions.values()]} />
        <Projector positions={positions} els={els} />
        <CameraRig selectedId={selectedId} positions={positions} />
      </Canvas>

      <div className="markers">
        {items.map((h) => (
          <button
            key={h.id}
            ref={(el) => { if (el) els.current.set(h.id, el); else els.current.delete(h.id) }}
            className={`marker marker--${h.status}${h.id === selectedId ? ' is-selected' : ''}`}
            onClick={() => onSelect(h.id)}
            aria-label={`${h.mission} — ${h.name}`}
            data-label={`${h.mission.toUpperCase()} · ${h.name}`}
            style={{ display: 'none' }}
          >
            <span className="marker__icon">{h.status === 'active' ? '✓' : '!'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
