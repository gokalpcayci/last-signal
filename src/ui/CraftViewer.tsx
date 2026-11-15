/**
 * NASA 3D craft model shown as published: the GLB's own materials and textures, lit by a
 * neutral studio environment (RoomEnvironment, generated locally — no HDR download) plus a key light.
 * Lazy-loaded from StoryMedia (its own small r3f canvas).
 */
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const DRACO = '/draco/'
const BG = '#0d0e0d'
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Image-based lighting so metallic PBR parts (foil, panels) reflect something instead of going black */
function Studio() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    return () => { scene.environment = null; env.dispose(); room.dispose(); pmrem.dispose() }
  }, [gl, scene])
  return null
}

function Model({ src, onReady }: { src: string; onReady: () => void }) {
  const gltf = useGLTF(src, DRACO)
  const root = useMemo(() => {
    const scene = gltf.scene.clone(true)
    // centre and fit into a 2-unit box
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const k = 2 / Math.max(size.x, size.y, size.z, 1e-6)
    const root = new THREE.Group()
    scene.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-1))
    root.add(scene)
    root.scale.setScalar(k)
    return root
  }, [gltf])
  useEffect(() => { onReady() }, [root, onReady])
  return <primitive object={root} />
}

class Boundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { console.error('3D model failed to load', e); this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

export default function CraftViewer({ src, onReady, onError }: {
  src: string
  onReady: () => void
  onError: () => void
}) {
  const still = useMemo(() => reducedMotion(), [])
  return (
    <Canvas camera={{ position: [2.3, 1.3, 2.3], fov: 35, near: 0.05, far: 50 }} dpr={[1, 2]}>
      <color attach="background" args={[BG]} />
      <Studio />
      <directionalLight position={[3, 4, 2]} intensity={1} />
      <Boundary onError={onError}>
        <Suspense fallback={null}>
          <Model src={src} onReady={onReady} />
        </Suspense>
      </Boundary>
      <OrbitControls enablePan={false} minDistance={1.6} maxDistance={6} autoRotate={!still} autoRotateSpeed={1.2} />
    </Canvas>
  )
}
