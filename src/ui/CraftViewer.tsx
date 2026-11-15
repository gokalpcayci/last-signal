/**
 * NASA 3D craft model in our print look: a screen-space halftone dot screen lit by a key
 * light, a rim in the object's status colour, and hard edges traced as hairlines.
 * Lazy-loaded from StoryMedia (its own small r3f canvas).
 */
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const DRACO = '/draco/'
const BG = '#0d0e0d'
const INK = '#d8d2bf'                 // pale regolith, the terrain ramp's top stop family
const STATUS = { active: '#5fd068', silent: '#e56b47' } as const // --ok / --warn
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function makeMaterial(rim: string) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uFill: { value: new THREE.Color(BG).convertLinearToSRGB() },
      uInk: { value: new THREE.Color(INK).convertLinearToSRGB() },
      uRim: { value: new THREE.Color(rim).convertLinearToSRGB() },
      uPx: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFill;
      uniform vec3 uInk;
      uniform vec3 uRim;
      uniform float uPx;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 N = normalize(vN);
        if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(vV);
        // key light from the upper left, in view space (stays put while the model turns)
        float light = clamp(dot(N, normalize(vec3(-0.5, 0.75, 0.55))), 0.0, 1.0) * 0.85 + 0.12;
        // 45° dot screen, ~3.5 css px pitch; dot area follows the light
        vec2 hv = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (gl_FragCoord.xy / (3.5 * uPx));
        float rad = 0.5 * sqrt(light);
        float dotm = 1.0 - smoothstep(rad - 0.1, rad + 0.1, length(fract(hv) - 0.5));
        float rim = pow(1.0 - abs(dot(N, V)), 3.0);
        vec3 col = uFill + uInk * (0.05 + 0.85 * dotm) + uRim * rim * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
}

function Model({ src, status, onReady }: { src: string; status: keyof typeof STATUS; onReady: () => void }) {
  const gltf = useGLTF(src, DRACO)
  const gl = useThree((s) => s.gl)
  const { root, dispose } = useMemo(() => {
    const scene = gltf.scene.clone(true)
    const mat = makeMaterial(STATUS[status])
    mat.uniforms.uPx.value = gl.getPixelRatio()
    const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(STATUS[status]), transparent: true, opacity: 0.4 })
    const extra: THREE.BufferGeometry[] = []
    const meshes: THREE.Mesh[] = []
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
    for (const m of meshes) {
      if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals()
      m.material = mat
      const eg = new THREE.EdgesGeometry(m.geometry, 35)
      extra.push(eg)
      m.add(new THREE.LineSegments(eg, lineMat)) // child: inherits the mesh's transform
    }
    // centre and fit into a 2-unit box
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const k = 2 / Math.max(size.x, size.y, size.z, 1e-6)
    const root = new THREE.Group()
    scene.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-1))
    root.add(scene)
    root.scale.setScalar(k)
    return { root, dispose: () => { mat.dispose(); lineMat.dispose(); extra.forEach((g) => g.dispose()) } }
  }, [gltf, status, gl])
  useEffect(() => { onReady(); return dispose }, [dispose, onReady])
  return <primitive object={root} />
}

class Boundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { console.error('3D model failed to load', e); this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

export default function CraftViewer({ src, status, onReady, onError }: {
  src: string
  status: keyof typeof STATUS
  onReady: () => void
  onError: () => void
}) {
  const still = useMemo(() => reducedMotion(), [])
  return (
    <Canvas camera={{ position: [2.3, 1.3, 2.3], fov: 35, near: 0.05, far: 50 }} dpr={[1, 2]}>
      <color attach="background" args={[BG]} />
      <Boundary onError={onError}>
        <Suspense fallback={null}>
          <Model src={src} status={status} onReady={onReady} />
        </Suspense>
      </Boundary>
      <OrbitControls enablePan={false} minDistance={1.6} maxDistance={6} autoRotate={!still} autoRotateSpeed={1.2} />
    </Canvas>
  )
}
