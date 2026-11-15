import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { latToZ, lonToX, type Dem } from './terrain'
import { hardware } from '../data/hardware'
import { traverses } from '../data/traverses'
import type { Feature } from '../data/features'

// ── 9. LRV traverse trails ──────────────────────────────────────────────────
/** World units per km for the trails (true map scale is ~0.026, so ×38): a 6 km drive spans ~6 units. */
export const TRAVERSE_MAG = 1.0
/** The mesh is linear between vertices (~0.9 units apart) while heightAt is smooth: lift clear of it. */
const TRAIL_LIFT = 0.35
const TRAIL_STEP = 0.12

export function Traverses({ dem, visibleRovers, highlightMission }: {
  dem: Dem
  visibleRovers: Set<string>
  highlightMission: string | null
}) {
  const lines = useMemo(() => traverses.flatMap((t) => {
    const lm = hardware.find((h) => h.id === t.lmId)
    if (!lm) return []
    const cx = lonToX(lm.lon), cz = latToZ(lm.lat)
    return t.evas.map((eva, i) => {
      // densify so the trail follows the terrain instead of cutting through hills
      const pts: THREE.Vector3[] = []
      for (let k = 0; k < eva.length - 1; k++) {
        const [e0, n0] = eva[k], [e1, n1] = eva[k + 1]
        const x0 = cx + e0 * TRAVERSE_MAG, z0 = cz - n0 * TRAVERSE_MAG
        const x1 = cx + e1 * TRAVERSE_MAG, z1 = cz - n1 * TRAVERSE_MAG
        const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / TRAIL_STEP))
        for (let s = 0; s < steps; s++) pts.push(new THREE.Vector3(x0 + (x1 - x0) * s / steps, 0, z0 + (z1 - z0) * s / steps))
      }
      const [eL, nL] = eva[eva.length - 1]
      pts.push(new THREE.Vector3(cx + eL * TRAVERSE_MAG, 0, cz - nL * TRAVERSE_MAG))
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      const mat = new THREE.LineDashedMaterial({ color: '#c9a95a', dashSize: 0.35, gapSize: 0.18, transparent: true, depthWrite: false })
      const line = new THREE.Line(geo, mat)
      line.computeLineDistances()
      line.renderOrder = 1
      return { key: `${t.mission}-${i}`, mission: t.mission, roverId: t.roverId, line, mat }
    })
  }), [])
  useEffect(() => () => lines.forEach(({ line, mat }) => { line.geometry.dispose(); mat.dispose() }), [lines])

  // Re-drape onto the terrain whenever the vertical scale changes (true-scale morph).
  const lastU = useRef(NaN)
  useFrame(() => {
    if (dem.unitsPerKm === lastU.current) return
    lastU.current = dem.unitsPerKm
    for (const { line } of lines) {
      const pos = line.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) pos.setY(i, dem.heightAt(pos.getX(i), pos.getZ(i)) + TRAIL_LIFT)
      pos.needsUpdate = true
      line.geometry.computeBoundingSphere()
    }
  })

  useEffect(() => {
    for (const { mission, roverId, line, mat } of lines) {
      mat.opacity = highlightMission === mission ? 0.95 : 0.5
      line.visible = visibleRovers.has(roverId)
    }
  }, [lines, highlightMission, visibleRovers])

  return <>{lines.map(({ key, line }) => <primitive key={key} object={line} />)}</>
}

// ── 10. Named feature labels (projected DOM, like the markers) ──────────────
export function FeatureProjector({ dem, features, els }: {
  dem: Dem
  features: Feature[]
  els: React.RefObject<Map<string, HTMLElement>>
}) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  const anchors = useMemo(() => features.map((f) => ({ name: f.name, x: lonToX(f.lon), z: latToZ(f.lat) })), [features])
  useFrame(() => {
    camera.updateMatrixWorld() // see Projector in MoonScene: avoid a one-frame lag while moving
    for (const a of anchors) {
      const el = els.current.get(a.name)
      if (!el) continue
      v.set(a.x, dem.heightAt(a.x, a.z) + 0.4, a.z).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05
      el.style.display = visible ? '' : 'none'
      if (visible) {
        const x = (v.x * 0.5 + 0.5) * size.width
        const y = (-v.y * 0.5 + 0.5) * size.height
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
      }
    }
  })
  return null
}
