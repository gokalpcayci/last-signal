import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { latToZ, loadDem, lonToX, type Dem } from "./terrain"
import type { Hardware } from '../data/hardware'

interface Props {
  items: Hardware[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

type Vec3 = [number, number, number]
const MARKER_LIFT = 2.4

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
  return (
    <group>
      {/* dark solid underlay hides wire lines behind hills */}
      <mesh geometry={geo}>
        <meshBasicMaterial color="#0b0c0b" polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial vertexColors wireframe transparent opacity={0.85} />
      </mesh>
    </group>
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

const HOME = { pos: [0, 26, 82] as const, target: [0, 2, 0] as const }
const HOME_PORTRAIT = { pos: [3, 88, 58] as const, target: [3, 0, -4] as const }

function CameraRig({ selectedId, positions }: { selectedId: string | null; positions: Map<string, Vec3> }) {
  const controls = useRef<CameraControls>(null)
  const aspect = useThree((s) => s.size.width / s.size.height)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  // Portrait screens are tall and narrow: a low horizon view wastes the height and
  // crowds markers. Use a wider lens and a more top-down home view instead.
  const portrait = aspect < 1
  useEffect(() => {
    camera.fov = portrait ? 55 : 40
    camera.updateProjectionMatrix()
  }, [camera, portrait])
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const p = selectedId ? positions.get(selectedId) : undefined
    const k = portrait ? 1.2 : 1
    if (p) c.setLookAt(p[0] + 8 * k, p[1] + 14 * k, p[2] + 16 * k, p[0], p[1], p[2], true)
    else if (portrait) c.setLookAt(...HOME_PORTRAIT.pos, ...HOME_PORTRAIT.target, true)
    else c.setLookAt(...HOME.pos, ...HOME.target, true)
  }, [selectedId, positions, portrait])
  return <CameraControls ref={controls} minDistance={10} maxDistance={140} maxPolarAngle={Math.PI * 0.45} />
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
        camera={{ position: [...HOME.pos], fov: 40, near: 0.1, far: 500 }}
        onPointerMissed={() => onSelect(null)}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0d0e0d']} />
        <fog attach="fog" args={['#0d0e0d', 60, 150]} />
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
            title={`${h.mission} — ${h.name}`}
            style={{ display: 'none' }}
          >
            <span className="marker__icon">{h.status === 'active' ? '✓' : '!'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
