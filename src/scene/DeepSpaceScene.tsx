import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Hardware } from '../data/hardware'
import { STACKED_QUERY } from '../layout'
import { isBooted, markProgress, markSceneReady, useBooted } from '../boot'

/**
 * Deep Space: a top-down solar system map in the terrain's line language. Sun in the middle,
 * planet orbits, the asteroid and Kuiper belts as stipple, and every probe's real path
 * (JPL Horizons, public/deepspace/paths.json) drawn up to the timeline playhead.
 *
 * Distances are log-squeezed by default (Voyager 1 at 172 AU and Mercury at 0.4 AU on one
 * screen); the toolbar's 1:1 button morphs to true linear scale. Each point moves along its own
 * ray from the Sun, and in the squeezed view heights above/below the planets' plane are also
 * flattened ×HEIGHT — otherwise Voyager 2 (38° below the plane) seen from above lands next to
 * Saturn. 1:1 is fully true: Voyager 1 climbs 35° above the plane, Voyager 2 dives 38° below.
 *
 * All geometry is stored in AU and squeezed in the vertex shader (uLin), so the morph costs
 * one uniform per frame. Markers/labels run the same function on the CPU (radius()).
 */

// ── data ────────────────────────────────────────────────────────────────────

interface PathObj { t0: string; known: string; pts: number[][]; now: number[]; au: number }
interface Paths { epoch: string; step: number; objects: Record<string, PathObj>; planets: Record<string, number[][]> }

let pathsPromise: Promise<Paths> | null = null
export function loadPaths() {
  return (pathsPromise ??= fetch('/deepspace/paths.json').then((r) => {
    if (!r.ok) throw new Error(`paths.json: HTTP ${r.status}`)
    return r.json() as Promise<Paths>
  }))
}

/** Orbital periods (days) — the same values build_deepspace.py sampled one orbit with. */
const PLANET_PERIOD: Record<string, number> = {
  mercury: 88, venus: 225, earth: 365, mars: 687, jupiter: 4333, saturn: 10759, uranus: 30687, neptune: 60190,
}
const PLANET_NAMES = Object.keys(PLANET_PERIOD)

const yearOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return y + (m - 1) / 12 + (d - 1) / 365
}

// ── the squeeze ─────────────────────────────────────────────────────────────

const R_OUT = 60          // scene units for the outer edge (Voyager 1 lives near it)
const AU_OUT = 175
const R0 = 1              // log knee: inside ~1 AU the map is nearly linear
const K = R_OUT / Math.log(1 + AU_OUT / R0)
const LIN = R_OUT / AU_OUT
/** AU from the Sun → scene radius. lin = 0 log-squeezed, 1 true scale. */
export const radius = (au: number, lin: number) => (1 - lin) * K * Math.log(1 + au / R0) + lin * au * LIN
/** Height flattening in the squeezed view (1 at true scale) */
const HEIGHT = 0.4
const heightK = (lin: number) => HEIGHT + (1 - HEIGHT) * lin

/** Ecliptic AU (x → equinox, y, z → north) to unsquashed scene axes (x, up = ecliptic north, z = −y). */
const axes = (p: number[], out = new THREE.Vector3()) => out.set(p[0], p[2], -p[1])
/** Squeeze a scene-axes AU vector in place. */
function squeeze(v: THREE.Vector3, lin: number) {
  const r = v.length()
  if (r > 0) v.multiplyScalar(radius(r, lin) / r)
  v.y *= heightK(lin)
  return v
}

// ── materials ───────────────────────────────────────────────────────────────

const BG = '#0d0e0d'
// ShaderMaterial writes raw values: hand it sRGB numbers (THREE.Color('#hex') is linear).
const srgb = (hex: string) => new THREE.Color(hex).convertLinearToSRGB()
const C = {
  grid: '#e6e6df', orbit: '#a39876', kuiper: '#5a7a7c', belt: '#8d7b4d', sun: '#f2e3b3',
  active: '#5fd068', silent: '#e56b47', selected: '#e6e6df',
}

interface MatOpts { color: string; opacity: number; dash?: number; size?: number; soft?: boolean }
function spaceMaterial({ color, opacity, dash = 0, size = 1, soft = false }: MatOpts) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uLin: { value: 0 }, uK: { value: K }, uH: { value: HEIGHT }, uR0: { value: R0 }, uL: { value: LIN },
      uReveal: { value: 0 }, uColor: { value: srgb(color) }, uOpacity: { value: opacity },
      uDash: { value: dash }, uSize: { value: size }, uSoft: { value: soft ? 1 : 0 },
      uPx: { value: Math.min(2, window.devicePixelRatio || 1) },
    },
    vertexShader: /* glsl */ `
      uniform float uLin, uK, uR0, uL, uH, uSize, uPx;
      attribute float aU;          // 0–1 along a ring (dashes); 0 elsewhere
      varying float vR;
      varying float vU;
      void main() {
        float r = length(position);
        float s = r > 0.0 ? ((1.0 - uLin) * uK * log(1.0 + r / uR0) + uLin * r * uL) / r : 0.0;
        vec3 q = position * s;
        q.y *= mix(uH, 1.0, uLin);
        vR = length(q);
        vU = aU;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
        gl_PointSize = uSize * uPx;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity, uReveal, uDash, uSoft;
      varying float vR;
      varying float vU;
      void main() {
        if (vR > uReveal) discard;                                  // boot-up: grows out from the Sun
        if (uDash > 0.0 && fract(vU * uDash) > 0.5) discard;        // dashed rings
        float a = uOpacity * smoothstep(uReveal, uReveal - 6.0, vR);
        if (uSoft > 0.0) a *= smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); // round glow
        gl_FragColor = vec4(uColor, a);
      }
    `,
  })
}

/** Geometry from AU points (scene axes) with an optional 0–1 `aU` along it. */
function geom(pts: THREE.Vector3[], u?: number[]) {
  const g = new THREE.BufferGeometry().setFromPoints(pts)
  g.setAttribute('aU', new THREE.Float32BufferAttribute(u ?? pts.map(() => 0), 1))
  return g
}
const ring = (au: number, n = 256) => {
  const pts: THREE.Vector3[] = [], u: number[] = []
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * au, 0, -Math.sin(a) * au)); u.push(i / n) }
  return geom(pts, u)
}
/** Seeded random, so the belts look the same on every visit. */
function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646 }
function belt(n: number, inner: number, outer: number, tiltDeg: number, seed: number) {
  const rnd = rng(seed), pts: THREE.Vector3[] = []
  for (let i = 0; i < n; i++) {
    const r = inner + (outer - inner) * Math.sqrt(rnd()), a = rnd() * Math.PI * 2
    const lat = (rnd() - 0.5) * 2 * tiltDeg * THREE.MathUtils.DEG2RAD * rnd()
    pts.push(new THREE.Vector3(Math.cos(a) * Math.cos(lat) * r, Math.sin(lat) * r, -Math.sin(a) * Math.cos(lat) * r))
  }
  return geom(pts)
}

// ── shared scene state (one per mount) ──────────────────────────────────────

interface Shared {
  lin: number
  reveal: number
  mats: THREE.ShaderMaterial[]
}

/** Map scale (log ↔ true) and boot reveal, applied to every space material each frame. */
function Driver({ shared, trueScale }: { shared: Shared; trueScale: boolean }) {
  const skip = useMemo(() => reducedMotion(), [])
  const start = useRef<number | null>(null)
  useFrame(({ clock }, delta) => {
    const target = trueScale ? 1 : 0
    shared.lin = skip ? target : shared.lin + (target - shared.lin) * (1 - Math.exp(-delta * 3))
    if (Math.abs(shared.lin - target) < 1e-3) shared.lin = target
    markSceneReady()
    if (skip) shared.reveal = REVEAL_MAX
    else if (!isBooted()) shared.reveal = 0
    else {
      start.current ??= clock.elapsedTime
      const t = Math.min(1, (clock.elapsedTime - start.current) / BOOT_S)
      shared.reveal = REVEAL_MAX * (1 - Math.pow(1 - t, 3))
    }
    for (const m of shared.mats) { m.uniforms.uLin.value = shared.lin; m.uniforms.uReveal.value = shared.reveal }
  })
  return null
}

const BOOT_S = 2.2
const REVEAL_MAX = R_OUT * 1.6
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Static backdrop: AU rings, heliopause, spokes, planet orbits, belts, the Sun. */
function Backdrop({ paths, shared }: { paths: Paths; shared: Shared }) {
  const objs = useMemo(() => {
    const out: { obj: THREE.Object3D; mat: THREE.ShaderMaterial }[] = []
    const add = (kind: 'line' | 'points', g: THREE.BufferGeometry, o: MatOpts) => {
      const mat = spaceMaterial(o)
      out.push({ obj: kind === 'line' ? new THREE.Line(g, mat) : new THREE.Points(g, mat), mat })
    }
    for (const au of [1, 10, 100]) add('line', ring(au), { color: C.grid, opacity: 0.16, dash: 160 })
    // Voyager 1 crossed the heliopause at ~121.6 AU (2012), Voyager 2 at ~119 AU (2018)
    add('line', ring(120), { color: C.grid, opacity: 0.3, dash: 240 })
    // ecliptic longitude spokes every 30°, from 0.5 AU to the edge
    const spokes: THREE.Vector3[] = []
    for (let d = 0; d < 360; d += 30) {
      const a = THREE.MathUtils.degToRad(d)
      spokes.push(new THREE.Vector3(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5), new THREE.Vector3(Math.cos(a) * AU_OUT, 0, -Math.sin(a) * AU_OUT))
    }
    const sg = geom(spokes)
    const sm = spaceMaterial({ color: C.grid, opacity: 0.06 })
    out.push({ obj: new THREE.LineSegments(sg, sm), mat: sm })
    for (const name of PLANET_NAMES) {
      const pts = paths.planets[name].map((p) => axes(p))
      add('line', geom([...pts, pts[0]]), { color: C.orbit, opacity: 0.32 })
    }
    add('points', belt(700, 2.2, 3.3, 10, 7), { color: C.belt, opacity: 0.45, size: 1.6 })
    add('points', belt(1400, 30, 50, 12, 11), { color: C.kuiper, opacity: 0.5, size: 1.6 })
    add('points', geom([new THREE.Vector3()]), { color: C.sun, opacity: 1, size: 18, soft: true })
    add('points', geom([new THREE.Vector3()]), { color: C.sun, opacity: 1, size: 5 })
    return out
  }, [paths])
  useEffect(() => {
    shared.mats.push(...objs.map((o) => o.mat))
    return () => {
      for (const o of objs) {
        shared.mats.splice(shared.mats.indexOf(o.mat), 1)
        o.mat.dispose(); (o.obj as THREE.Line).geometry.dispose()
      }
    }
  }, [objs, shared])
  return <>{objs.map((o, i) => <primitive key={i} object={o.obj} />)}</>
}

/** Planet dots at their real place on the playhead's date (orbits repeat, so phase = date mod period). */
function planetPos(paths: Paths, name: string, t: number, out: THREE.Vector3) {
  const pts = paths.planets[name], P = PLANET_PERIOD[name]
  const step = Math.max(1, Math.round(P / 180))
  const days = THREE.MathUtils.euclideanModulo((t - yearOf(paths.epoch)) * 365.25, P)
  const f = days / step, i = Math.min(pts.length - 1, Math.floor(f)), j = Math.min(pts.length - 1, i + 1)
  axes(pts[i], out)
  const b = axes(pts[j], new THREE.Vector3())
  return out.lerp(b, f - i)
}

/** Where a probe is at year t (null t = its latest known position), AU scene axes. Also the trail length. */
function probeAt(o: PathObj, step: number, t: number | null, out: THREE.Vector3) {
  if (t == null || t >= yearOf(o.known)) { axes(o.now, out); return o.pts.length }
  const f = Math.max(0, ((t - yearOf(o.t0)) * 365.25) / step)
  const i = Math.min(o.pts.length - 1, Math.floor(f)), j = Math.min(o.pts.length - 1, i + 1)
  axes(o.pts[i], out).lerp(axes(o.pts[j], new THREE.Vector3()), f - i)
  return i + 1
}

/** Probe trails, drawn up to the playhead; brighter for the selected craft. */
function Trails({ paths, items, selectedId, until, shared }: {
  paths: Paths; items: Hardware[]; selectedId: string | null; until: number | null; shared: Shared
}) {
  const lines = useMemo(() => items.filter((h) => paths.objects[h.id]).map((h) => {
    const o = paths.objects[h.id]
    const mat = spaceMaterial({ color: h.status === 'active' ? C.active : C.silent, opacity: 0.5 })
    return { id: h.id, o, line: new THREE.Line(geom(o.pts.map((p) => axes(p))), mat), mat }
  }), [items, paths])
  useEffect(() => {
    shared.mats.push(...lines.map((l) => l.mat))
    return () => {
      for (const l of lines) { shared.mats.splice(shared.mats.indexOf(l.mat), 1); l.mat.dispose(); l.line.geometry.dispose() }
    }
  }, [lines, shared])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    for (const l of lines) {
      l.line.geometry.setDrawRange(0, probeAt(l.o, paths.step, until, tmp))
      const sel = l.id === selectedId
      // craft that loop round the Sun near 1–3 AU draw many laps: keep those quiet so the middle stays readable
      const base = l.o.au < 5 ? 0.2 : 0.55
      l.mat.uniforms.uOpacity.value = sel ? 1 : selectedId ? base * 0.5 : base
      l.mat.uniforms.uColor.value = srgb(sel ? C.selected : (items.find((h) => h.id === l.id)?.status === 'active' ? C.active : C.silent))
    }
  }, [lines, until, selectedId, items, paths, tmp])
  return <>{lines.map((l) => <primitive key={l.id} object={l.line} />)}</>
}

/** Dashed drop lines from each probe to the planets' plane: shows who is above or below it. */
function DropLines({ positions }: { positions: React.RefObject<Map<string, THREE.Vector3>> }) {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(2 * 3 * 32), 3))
    const m = new THREE.LineDashedMaterial({ color: C.grid, transparent: true, opacity: 0.35, dashSize: 0.5, gapSize: 0.5, depthWrite: false })
    return new THREE.LineSegments(g, m)
  }, [])
  useEffect(() => () => { line.geometry.dispose(); (line.material as THREE.Material).dispose() }, [line])
  useFrame(() => {
    const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute
    let n = 0
    for (const p of positions.current.values()) {
      if (n >= 32) break
      pos.setXYZ(n * 2, p.x, p.y, p.z)
      pos.setXYZ(n * 2 + 1, p.x, 0, p.z)
      n++
    }
    pos.needsUpdate = true
    line.geometry.setDrawRange(0, n * 2)
    line.computeLineDistances()
  })
  return <primitive object={line} />
}

// ── DOM overlays: markers + labels ──────────────────────────────────────────

const MARKER_REF_DIST = 70
interface Label { key: string; text: string; cls: string; at: (t: number | null, out: THREE.Vector3) => THREE.Vector3 }

function Projector({ paths, items, until, shared, els, labelEls, labels, positions }: {
  paths: Paths; items: Hardware[]; until: number | null; shared: Shared
  els: React.RefObject<Map<string, HTMLElement>>; labelEls: React.RefObject<Map<string, HTMLElement>>
  labels: Label[]; positions: React.RefObject<Map<string, THREE.Vector3>>
}) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  const place = (el: HTMLElement, p: THREE.Vector3, stem = false) => {
    v.copy(p).project(camera)
    const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
    el.style.display = visible ? '' : 'none'
    if (!visible) return
    const x = Math.round((v.x * 0.5 + 0.5) * size.width), y = Math.round((-v.y * 0.5 + 0.5) * size.height)
    el.style.transform = stem ? `translate(${x}px, ${y}px) translate(-50%, -100%)` : `translate(${x}px, ${y}px)`
    el.style.zIndex = String(Math.round((1 - v.z) * 10000))
  }
  useFrame(() => {
    camera.updateMatrixWorld()
    const reveal = shared.reveal
    for (const h of items) {
      const el = els.current.get(h.id), o = paths.objects[h.id]
      if (!el || !o) continue
      const p = positions.current.get(h.id) ?? new THREE.Vector3()
      probeAt(o, paths.step, until, p)
      squeeze(p, shared.lin)
      positions.current.set(h.id, p)
      el.style.setProperty('--mk-s', THREE.MathUtils.clamp(MARKER_REF_DIST / camera.position.distanceTo(p), 0.7, 1.1).toFixed(2))
      el.style.setProperty('--stem', '0px')
      if (p.length() > reveal) { el.style.display = 'none'; continue }
      place(el, p, true)
    }
    // drop positions of craft no longer shown (filters / time travel)
    for (const id of positions.current.keys()) if (!items.some((h) => h.id === id)) positions.current.delete(id)
    for (const l of labels) {
      const el = labelEls.current.get(l.key)
      if (!el) continue
      squeeze(l.at(until, v), shared.lin)
      if (v.length() > reveal) { el.style.display = 'none'; continue }
      place(el, v.clone())
    }
  })
  return null
}

// ── camera ──────────────────────────────────────────────────────────────────

type V3 = [number, number, number]
interface View { pos: V3; target: V3 }
// The far probes (Voyagers, Pioneer 11, New Horizons) all head toward ecliptic longitude
// 255°–290° (scene +z). Looking from that side would put them under the bottom panels, so the
// home view looks *toward* them: they sit up in the open sky, the Sun nearer the viewer.
const HOME: View = { pos: [-22, 178, -90], target: [0, 0, -5] }
const HOME_PORTRAIT: View = { pos: [-6, 140, -46], target: [0, 0, -9] }

function CameraRig({ selectedId, positions }: { selectedId: string | null; positions: React.RefObject<Map<string, THREE.Vector3>> }) {
  const controls = useRef<CameraControls>(null)
  const aspect = useThree((s) => s.size.width / s.size.height)
  const get = useThree((s) => s.get)
  const { width, height } = useThree((s) => s.size)
  const portrait = aspect < 1.25
  const stacked = window.matchMedia(STACKED_QUERY).matches
  // same view offset as the terrain scene: center the map in the area the panels leave free
  const panel = stacked ? 0 : Math.min(340, Math.max(250, width * 0.2))
  const bottomRow = stacked ? 0 : Math.min(240, Math.max(150, height * 0.25))
  useEffect(() => {
    const camera = get().camera as THREE.PerspectiveCamera
    camera.fov = portrait ? 55 : 40
    if (panel === 0) camera.clearViewOffset()
    else camera.setViewOffset(width, height, panel / 2, bottomRow / 2, width, height)
    camera.updateProjectionMatrix()
  }, [get, portrait, width, height, panel, bottomRow])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    // positions fill in on the first frames: wait one tick so a selection from the chart finds its craft
    const t = setTimeout(() => {
      const p = selectedId ? positions.current.get(selectedId) : undefined
      if (p) c.setLookAt(p.x + 6, p.y + 9, p.z + 12, p.x, p.y, p.z, true)
      else { const v = portrait ? HOME_PORTRAIT : HOME; c.setLookAt(...v.pos, ...v.target, true) }
    }, 30)
    return () => clearTimeout(t)
  }, [selectedId, positions, portrait])
  return (
    <CameraControls
      ref={controls}
      minDistance={4}
      maxDistance={260}
      // space has no edges: orbit all the way round, and tip slightly below the plane to see Voyager 2
      minPolarAngle={0}
      maxPolarAngle={Math.PI * 0.62}
    />
  )
}

// ── component ───────────────────────────────────────────────────────────────

interface Props {
  items: Hardware[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** true linear distances instead of the log squeeze */
  trueScale: boolean
  /** timeline playhead (decimal year); null = today */
  until: number | null
}

const BOOT_MARKERS_START_S = 1.2
const BOOT_MARKER_STEP_S = 0.1

export default function DeepSpaceScene({ items, selectedId, onSelect, trueScale, until }: Props) {
  const [paths, setPaths] = useState<Paths | null>(null)
  useEffect(() => {
    let alive = true
    loadPaths().then((p) => { markProgress(0.85); if (alive) setPaths(p) }, (e) => console.error('Failed to load deep-space paths', e))
    return () => { alive = false }
  }, [])
  const shared = useMemo<Shared>(() => ({ lin: 0, reveal: 0, mats: [] }), [])
  const els = useRef(new Map<string, HTMLElement>())
  const labelEls = useRef(new Map<string, HTMLElement>())
  const positions = useRef(new Map<string, THREE.Vector3>())
  const booted = useBooted()

  const labels = useMemo<Label[]>(() => {
    if (!paths) return []
    const onRing = (au: number, deg: number) => (_: number | null, out: THREE.Vector3) => {
      const a = THREE.MathUtils.degToRad(deg)
      return out.set(au * Math.cos(a), 0, -au * Math.sin(a))
    }
    return [
      { key: 'sun', text: 'Sun', cls: 'feature--crater', at: (_, out) => out.set(0, 0, 0) },
      ...PLANET_NAMES.map((n): Label => ({
        key: n, text: n, cls: 'feature--crater',
        at: (t, out) => planetPos(paths, n, t ?? yearOf(paths.epoch), out),
      })),
      { key: 'r1', text: '1 AU', cls: 'feature--mare', at: onRing(1, -30) },
      { key: 'r10', text: '10 AU', cls: 'feature--mare', at: onRing(10, -30) },
      { key: 'r100', text: '100 AU', cls: 'feature--mare', at: onRing(100, -30) },
      { key: 'helio', text: 'Heliopause ~120 AU', cls: 'feature--mountains', at: onRing(120, 140) },
      { key: 'kuiper', text: 'Kuiper Belt', cls: 'feature--mare', at: onRing(40, 205) },
      { key: 'belt', text: 'Asteroid belt', cls: 'feature--mare', at: onRing(2.8, 250) },
    ]
  }, [paths])

  const order = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.arrived.localeCompare(b.arrived))
    return new Map(sorted.map((h, i) => [h.id, i]))
  }, [items])

  return (
    <div className="moon deep">
      <Canvas
        camera={{ position: [...HOME.pos], fov: 40, near: 0.1, far: 1000 }}
        onPointerMissed={() => onSelect(null)}
        dpr={[1, 2]}
      >
        <color attach="background" args={[BG]} />
        <Driver shared={shared} trueScale={trueScale} />
        {paths && <Backdrop paths={paths} shared={shared} />}
        {paths && <Trails paths={paths} items={items} selectedId={selectedId} until={until} shared={shared} />}
        {paths && <DropLines positions={positions} />}
        {paths && <Projector paths={paths} items={items} until={until} shared={shared} els={els} labelEls={labelEls} labels={labels} positions={positions} />}
        <CameraRig selectedId={selectedId} positions={positions} />
      </Canvas>

      <div className={`features${paths ? ' is-on' : ''}`} aria-hidden>
        {labels.map((l) => (
          <span key={l.key} ref={(el) => { if (el) labelEls.current.set(l.key, el); else labelEls.current.delete(l.key) }}
            className={`feature ${l.cls}`} style={{ display: 'none' }}>{l.text}</span>
        ))}
      </div>

      <div className={`markers${paths ? (booted ? ' is-booting' : ' is-waiting') : ''}`}>
        {items.map((h) => (
          <button
            key={h.id}
            ref={(el) => { if (el) els.current.set(h.id, el); else els.current.delete(h.id) }}
            className={`marker marker--${h.status}${h.id === selectedId ? ' is-selected' : ''}`}
            onClick={() => onSelect(h.id)}
            aria-label={`${h.mission} — ${h.name}`}
            data-label={`${h.name.toUpperCase()} · ${paths?.objects[h.id]?.au ?? '?'} AU`}
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
