import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Hardware } from '../data/hardware'
import { STACKED_QUERY } from '../layout'
import { isBooted, markProgress, markSceneReady, useBooted } from '../boot'
import './deepSpace.css'
import { CONSTELLATIONS, DESTINATIONS, eclipticOf } from '../data/stars'
import { DEEP_SKY, milkyWay } from '../data/deepSky'
import { bigText, cellOf, gridFor, led, ledLine, microText, plate, sprite, textWidth, type Ctx, type Grid } from './ledLayer'
import { livePings, PULSE_S } from './pings'
import { T, stringsFor } from '../strings'
import { up, useLang } from '../i18n'
import { deepSkySub, destination, loc, placeName } from '../data/localize'

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
 *
 * Look (user-chosen over halftone and plotter variants): the planets' plane is an LED panel like
 * the logo — ghost LEDs everywhere, lit ones for the Sun, the planets (with a fading tail along the
 * orbit behind them, so you can see which way they go), the belts' rocks (twinkling), dotted AU
 * rings and the heliopause. One disc mesh, one shader (planeMaterial); probe trails are dotted lines.
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
  far: '#34505e', near: '#a39876', ghost: '#3d3f3a',
}


// ── shared scene state (one per mount) ──────────────────────────────────────

interface Shared {
  lin: number
  reveal: number
}

// ── the plane: an LED panel ─────────────────────────────────────────────────

const AST_AU: [number, number] = [2.2, 3.3]
const KUI_AU: [number, number] = [30, 50]
// Voyager 1 crossed the heliopause at ~121.6 AU (2012), Voyager 2 at ~119 AU (2018)
const HELIO_AU = 120
const PLANE_AU = 190      // past Voyager 1 (172 AU), so interstellar space shows around it
const LED_PX = 6          // CSS px per LED (desktop)
/** Phones get finer LEDs: more map per inch, smaller sprites */
const ledPxFor = (stacked: boolean) => (stacked ? 4 : LED_PX)

function planeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uReveal: { value: 0 }, uTime: { value: 0 }, uPx: { value: Math.min(2, window.devicePixelRatio || 1) },
      uCell: { value: LED_PX }, uDim: { value: 1 },
      uOrb: { value: new Array(8).fill(0) },
      uPlanet: { value: Array.from({ length: 8 }, () => new THREE.Vector2()) },
      uAst: { value: new THREE.Vector2() }, uKui: { value: new THREE.Vector2() },
      uHelio: { value: 0 }, uAU: { value: new THREE.Vector3() }, uDisc: { value: 1 },
      cLine: { value: srgb(C.grid) }, cGhost: { value: srgb(C.ghost) }, cSun: { value: srgb(C.sun) }, cOut: { value: srgb('#4a6274') },
      cPlanet: { value: srgb(C.near) }, cAst: { value: srgb(C.belt) }, cKui: { value: srgb(C.kuiper) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uReveal, uTime, uPx, uHelio, uCell, uDim, uDisc;
      uniform float uOrb[8];
      uniform vec2 uPlanet[8];
      uniform vec2 uAst, uKui;
      uniform vec3 uAU;
      uniform vec3 cLine, cGhost, cSun, cPlanet, cAst, cKui, cOut;
      varying vec2 vXZ;

      float band(float r, vec2 b, float w) { return smoothstep(b.x - w, b.x + w, r) * (1.0 - smoothstep(b.y - w, b.y + w, r)); }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      const float TAU = 6.2831853;
      // ecliptic longitude of a map point (scene z = −y), radians 0…2π
      float lonOf(vec2 xz) { return mod(atan(-xz.y, xz.x), TAU); }

      void main() {
        // square LED cells on screen; each cell shows what is at its centre (extrapolated with derivatives)
        float cell = uCell * uPx;
        vec2 g = gl_FragCoord.xy / cell;
        vec2 id = floor(g);
        vec2 f = g - id - 0.5;
        vec2 toC = -f * cell;
        vec2 xz = vXZ + dFdx(vXZ) * toC.x + dFdy(vXZ) * toC.y;
        float r = length(xz);
        float hc = 0.5 * cell * length(fwidth(vXZ)) * 0.7071; // half a cell, in map units
        float h = hash(id);

        // LED boot: cells switch on in random order as the reveal radius sweeps out
        if (r > uReveal * (0.55 + 0.45 * h)) discard;

        float on = 0.0;
        vec3 col = cLine;
        float lon = lonOf(xz);

        // planet orbits: dim, brightest just behind each planet (a fading tail = direction of travel)
        for (int i = 0; i < 8; i++) {
          if (abs(r - uOrb[i]) < hc) {
            float behind = mod(lonOf(uPlanet[i]) - lon, TAU);         // 0 at the planet, growing backwards
            float tail = exp(-behind * 1.6);
            on = max(on, 0.08 + 0.62 * tail);   // faint ring, bright tail: planets read as moving
          }
        }
        // AU rings (1, 10, 100) and the heliopause: dotted
        float dots = step(0.5, fract((id.x + id.y) * 0.5));
        for (int k = 0; k < 3; k++) if (abs(r - uAU[k]) < hc) on = max(on, 0.2 * dots);
        if (abs(r - uHelio) < hc) on = max(on, 0.32 * step(0.4, h));
        // belt rocks: sparse, gently twinkling
        float tw = 0.7 + 0.3 * sin(uTime * 1.7 + h * 40.0);
        float ast = band(r, uAst, 0.2) * step(0.78, hash(id + 3.1));
        float kui = band(r, uKui, 0.6) * step(0.87, hash(id + 7.7));
        if (ast > 0.0) { on = max(on, 0.42 * tw); col = cAst; }
        if (kui > 0.0) { on = max(on, 0.36 * tw); col = cKui; }
        // planets: a small block of fully lit LEDs
        for (int i = 0; i < 8; i++) {
          if (length(xz - uPlanet[i]) < hc * 2.2) { on = 1.0; col = cPlanet; }
        }
        // the Sun
        float sun = smoothstep(hc * 4.0, hc * 1.5, r);
        if (sun > 0.0) { on = max(on, sun); col = cSun; }

        // rounded-square LED, ghosts where nothing is lit
        vec2 q = abs(f) - 0.2;
        float shape = 1.0 - smoothstep(0.06, 0.12, length(max(q, 0.0)));
        float ghost = 0.05;
        float rim = 1.0 - smoothstep(uHelio * 1.0, uHelio * 1.16, r);
        float a = shape * max(ghost, on * max(rim, sun) * max(uDim, sun));
        if (a < 0.004) discard;
        // outside the heliopause the unlit LEDs turn cool: interstellar space
        float outside = smoothstep(uHelio * 0.99, uHelio * 1.03, r);
        vec3 ghostCol = mix(cGhost, cOut, outside);
        if (on <= 0.0) a = shape * ghost * (1.0 + 0.6 * outside) * (1.0 - smoothstep(uDisc * 0.9, uDisc, r));
        gl_FragColor = vec4(on > 0.0 ? col : ghostCol, a);
      }
    `,
  })
}

/** Mean orbit radius (AU) per planet, from the sampled orbit. */
const meanAU = (pts: number[][]) => pts.reduce((s, p) => s + Math.hypot(p[0], p[1], p[2]), 0) / pts.length

function Plane({ paths, shared, until, focus }: { paths: Paths; shared: Shared; until: number | null; focus: boolean }) {
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 160), planeMaterial())
    m.rotation.x = -Math.PI / 2
    m.renderOrder = -1
    return m
  }, [])
  const orb = useMemo(() => PLANET_NAMES.map((n) => meanAU(paths.planets[n])), [paths])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }, [mesh])
  useFrame(({ clock, gl }) => {
    const u = (mesh.material as THREE.ShaderMaterial).uniforms, lin = shared.lin
    u.uPx.value = gl.getPixelRatio() // the LED layer uses the same ratio, so both grids line up
    u.uCell.value = ledPxFor(window.matchMedia(STACKED_QUERY).matches)
    u.uDim.value += ((focus ? 0.45 : 1) - u.uDim.value) * 0.08 // ease into / out of focus mode
    mesh.scale.setScalar(radius(PLANE_AU, lin))
    u.uReveal.value = shared.reveal
    u.uTime.value = clock.elapsedTime
    const t = until ?? yearOf(paths.epoch)
    PLANET_NAMES.forEach((n, i) => {
      u.uOrb.value[i] = radius(orb[i], lin)
      squeeze(planetPos(paths, n, t, tmp), lin)
      u.uPlanet.value[i].set(tmp.x, tmp.z)
    })
    u.uAst.value.set(radius(AST_AU[0], lin), radius(AST_AU[1], lin))
    u.uKui.value.set(radius(KUI_AU[0], lin), radius(KUI_AU[1], lin))
    u.uHelio.value = radius(HELIO_AU, lin)
    u.uDisc.value = radius(PLANE_AU, lin)
    u.uAU.value.set(radius(1, lin), radius(10, lin), radius(100, lin))
  })
  return <primitive object={mesh} />
}

/** Map scale (log ↔ true) and boot reveal, eased each frame; the plane and LED layer read them. */
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
  })
  return null
}

const BOOT_S = 2.2
const REVEAL_MAX = R_OUT * 1.6
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

// ── the LED layer: everything above the plane ──────────────────────────────

/** Markers closer than this on screen merge into one numbered cluster */
const CLUSTER_PX = 30
const MAX_CLUSTERS = 6
const SEC_PER_AU = 499.004784
/** Stars sit on a ring this far out in scene units, past the map's edge (directions are real; the distance is just "the sky") */
const SKY_R = 67
/** The far backdrop (Milky Way, nearby stars, galaxies): a much bigger sphere, only seen around the disc */
const DEEP_R = 420
const COL = {
  ok: '#5fd068', warn: '#e56b47', text: '#e6e6df', dim: '#9a9b93', faint: '#6e706a', ghost: '#3d3f3a',
  sun: '#f2e3b3', planet: '#a39876', star: '#cfd3c4',
}

interface Label { key: string; text: string; at: (t: number | null, out: THREE.Vector3) => THREE.Vector3; color?: string; alpha?: number }
export interface ClusterInfo { ids: string[]; at: THREE.Vector3 }

/** Ecliptic lon/lat (deg) → unit direction in scene axes, times au. */
function skyDir(lon: number, lat: number, au: number, out = new THREE.Vector3()) {
  const l = THREE.MathUtils.degToRad(lon), b = THREE.MathUtils.degToRad(lat)
  return out.set(Math.cos(b) * Math.cos(l) * au, Math.sin(b) * au, -Math.cos(b) * Math.sin(l) * au)
}

/** Replay of a selected craft's road, launch → today */
const TRACE_S = 3.2
/** …then a light packet runs along it again every this many seconds */
const TRACE_LOOP_S = 6
/**
 * A flyby = the path's closest approach to a planet, if nearer than this (AU). Checked against
 * history: finds Pioneer 10/11, Voyager 1/2 (incl. Uranus 1986, Neptune 1989), Ulysses, New
 * Horizons at Jupiter and Dawn at Mars (2009). Earth/inner planets are left out: craft that trail
 * Earth (Spitzer, Kepler, Deep Impact) would show fake "flybys" with 30-day samples. Mars only for
 * a very close pass, for the same reason.
 */
const FLYBY_AU: Record<string, number> = { mars: 0.03, jupiter: 0.8, saturn: 0.8, uranus: 0.8, neptune: 0.8 }
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
/** decimal year of path sample k */
const sampleYear = (o: PathObj, step: number, k: number) => yearOf(o.t0) + (k * step) / 365.25
const fmtYM = (y: number) => `${MONTHS[Math.min(11, Math.floor((y % 1) * 12))]} ${Math.floor(y)}`

/** Planet flybys along a path: local minima of the distance to each planet, below FLYBY_AU. */
function flybys(paths: Paths, o: PathObj) {
  const out: { k: number; planet: string; year: number }[] = []
  const a = new THREE.Vector3(), b = new THREE.Vector3()
  for (const name of Object.keys(FLYBY_AU)) {
    const d = o.pts.map((pt, k) => {
      const y = sampleYear(o, paths.step, k)
      return axes(pt, a).distanceTo(planetPos(paths, name, y, b))
    })
    for (let k = 1; k < d.length - 1; k++) {
      if (d[k] < FLYBY_AU[name] && d[k] <= d[k - 1] && d[k] <= d[k + 1]) out.push({ k, planet: name, year: sampleYear(o, paths.step, k) })
    }
  }
  return out.sort((x, y) => x.k - y.k)
}

interface LayerProps {
  paths: Paths; items: Hardware[]; until: number | null; shared: Shared; selectedId: string | null
  canvas: React.RefObject<HTMLCanvasElement | null>
  els: React.RefObject<Map<string, HTMLElement>>; positions: React.RefObject<Map<string, THREE.Vector3>>
  clusterEls: React.RefObject<(HTMLElement | null)[]>; clusters: React.RefObject<ClusterInfo[]>
  hovered: React.RefObject<string | null>; labels: Label[]
  /** index of the cluster button under the pointer, or -1 */
  hoverCluster: React.RefObject<number>
}

function LedLayer({ paths, items, until, shared, selectedId, canvas, els, positions, clusterEls, clusters, hovered, labels, hoverCluster }: LayerProps) {
  const { camera, size, gl } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  const buf = useMemo(() => new THREE.Vector2(), [])

  // stars (scene axes, AU on the sky ring) and the live-distance rates, computed once
  const sky = useMemo(() => CONSTELLATIONS.map((c) => ({
    name: c.name, lines: c.lines,
    stars: c.stars.map((st) => { const e = eclipticOf(st.ra, st.dec); return { ...st, p: skyDir(e.lon, e.lat, SKY_R) } }),
  })), [])
  const dest = useMemo(() => DESTINATIONS.map((d) => {
    const st = sky.flatMap((c) => c.stars).find((x) => x.name === d.star)!
    return { ...d, p: st.p }
  }), [sky])
  // beyond the solar system: Milky Way dust + signposts, on a far sphere
  const deep = useMemo(() => ({
    dust: milkyWay().map((m) => { const e = eclipticOf(m.ra, m.dec); return { p: skyDir(e.lon, e.lat, DEEP_R), w: m.w } }),
    objs: DEEP_SKY.map((o) => { const e = eclipticOf(o.ra, o.dec); return { ...o, p: skyDir(e.lon, e.lat, DEEP_R) } }),
    // faint field stars everywhere (decorative, seeded so they never move between visits)
    field: (() => {
      let sd = 7
      const rnd = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646
      return Array.from({ length: 420 }, () => {
        const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z)
        return { p: new THREE.Vector3(r * Math.cos(a) * DEEP_R, z * DEEP_R, r * Math.sin(a) * DEEP_R), w: rnd() ** 3, ph: rnd() * 6.28 }
      })
    })(),
  }), [])
  // replay state for the selected craft: when it was picked, and its flybys
  const selAt = useRef<{ id: string | null; t: number }>({ id: null, t: 0 })
  const events = useMemo(() => {
    const o = selectedId ? paths.objects[selectedId] : undefined
    return o ? flybys(paths, o) : []
  }, [selectedId, paths])

  useFrame(({ clock }) => {
    const cv = canvas.current
    if (!cv) return
    const pr = gl.getPixelRatio()
    gl.getDrawingBufferSize(buf)
    if (cv.width !== buf.x || cv.height !== buf.y) { cv.width = buf.x; cv.height = buf.y }
    const g = cv.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, cv.width, cv.height)
    const ctx: Ctx = { g, pr }
    const W = size.width, H = size.height
    const stacked = window.matchMedia(STACKED_QUERY).matches
    // phones get finer LEDs (more map per inch) and fewer kinds of labels
    const cell = ledPxFor(stacked)
    const grid: Grid = gridFor(buf.y, cell, pr)
    const lin = shared.lin, reveal = shared.reveal, t = clock.elapsedTime
    if (selAt.current.id !== selectedId) selAt.current = { id: selectedId, t }
    // focus mode: with a craft selected, everything that isn't its story steps back
    const focus = selectedId != null
    const dim = focus ? 0.3 : 1
    camera.updateMatrixWorld()

    // ── names by viewing angle: each kind of label only shows from the angle where it reads ──
    // tilt = how steeply we look down at the planets' plane (90° straight down, 0° edge-on)
    const fwd = camera.getWorldDirection(new THREE.Vector3())
    const tilt = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(-fwd.y, -1, 1)))
    const ss = THREE.MathUtils.smoothstep
    /** chart view (looking down): map labels — rings, belts, regions */
    const chartK = ss(tilt, 30, 44)
    /** planets read a bit lower too */
    const planetK = ss(tilt, 16, 28)
    /** horizon view (looking out): sky labels — constellations, deep-sky signposts */
    const skyK = 1 - ss(tilt, 40, 56)
    const fwdH = new THREE.Vector2(fwd.x, fwd.z).normalize()
    /** 1 when a sky point is straight ahead of the camera (horizontally), 0 past ~55° to the side */
    const facing = (p: THREE.Vector3) => {
      const d = new THREE.Vector2(p.x - camera.position.x, p.z - camera.position.z).normalize()
      return ss(d.dot(fwdH), Math.cos(THREE.MathUtils.degToRad(55)), Math.cos(THREE.MathUtils.degToRad(30)))
    }

    /** squeezed scene point → css px, or null off screen / not revealed yet */
    const project = (p: THREE.Vector3, needReveal = true, offscreen = false) => {
      if (needReveal && Math.hypot(p.x, p.z) > reveal) return null
      v.copy(p).project(camera)
      if (!(v.z < 1 && (offscreen || (Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15)))) return null
      return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H }
    }
    const at = (p: THREE.Vector3) => project(squeeze(p.clone(), lin))
    /** sky ring point (scene units already): only flatten its height like the map's */
    const atSky = (p: THREE.Vector3, offscreen = false) => { const q = p.clone(); q.y *= heightK(lin); return project(q, false, offscreen) }
    const ledAt = (x: number, y: number, color: string, a: number, blank = false) => {
      const [i, j] = cellOf(grid, pr, x, y); led(ctx, grid, i, j, color, a, blank)
    }

    // ── label queue: LEDs are drawn first, every label is placed at the end by priority ──
    type Box = [number, number, number, number]
    const boxes: Box[] = []
    const free = (b: Box) => !boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])
    interface Want { prio: number; w: number; h: number; cands: [number, number][]; draw: (x: number, y: number) => void; anchor?: [number, number]; color?: string }
    const queue: Want[] = []
    const want = (prio: number, w: number, h: number, cands: [number, number][], draw: (x: number, y: number) => void, anchor?: [number, number], color?: string) =>
      queue.push({ prio, w, h, cands, draw, anchor, color })
    /** candidate spots around an anchor: close ones first, then farther out (those get a leader line) */
    const around = (ax: number, ay: number, w: number, h: number, gap: number): [number, number][] => [
      [ax + gap, ay - h / 2], [ax - gap - w, ay - h / 2], [ax - w / 2, ay + gap - 2], [ax - w / 2, ay - gap - h + 2],
      [ax + gap, ay + 6], [ax - gap - w, ay + 6], [ax + gap, ay - h - 6], [ax - gap - w, ay - h - 6],
      [ax + gap + 24, ay + 22], [ax - gap - w - 24, ay + 22], [ax + gap + 24, ay - h - 22], [ax - gap - w - 24, ay - h - 22],
    ]
    /** one-line plate label; anchor = the point it names */
    const tag = (prio: number, txt: string, ax: number, ay: number, color: string, alpha = 1, gap = 9) => {
      const w = textWidth(txt) + 6
      want(prio, w, 14, around(ax, ay, w, 14, gap), (x, y) => { plate(ctx, x, y, w, 14, 0.82); microText(ctx, txt, x + 3, y + 3, color, alpha) }, [ax, ay], color)
    }
    /** two-line plate label (title + dimmer subline) */
    const tag2 = (prio: number, a: string, b: string, ax: number, ay: number, color: string, alpha = 1, gap = 9) => {
      const w = Math.max(textWidth(a), textWidth(b)) + 6
      want(prio, w, 26, around(ax, ay, w, 26, gap), (x, y) => {
        plate(ctx, x, y, w, 26, 0.84)
        microText(ctx, a, x + 3, y + 3, color, alpha)
        microText(ctx, b, x + 3, y + 15, COL.faint, Math.min(1, alpha + 0.05))
      }, [ax, ay], color)
    }

    // screen furniture is off limits for labels
    const bottomRow = stacked ? 0 : Math.min(240, Math.max(150, H * 0.25))
    if (!stacked) {
      boxes.push([0, H - bottomRow - 92, 150, H - bottomRow])                   // compass
      boxes.push([0, H - bottomRow, W, H])                                      // bottom row of panels
      const panel = Math.min(340, Math.max(250, W * 0.2))
      boxes.push([W - panel - 30, H * 0.3, W, H])                               // right column
      boxes.push([W - 300, 0, W, 130])                                          // planet discs
      boxes.push([W / 2 - 150, H - bottomRow - 40, W / 2 + 150, H - bottomRow]) // toolbar
      boxes.push([0, 0, 240, 300])                                              // logo + filter list
    } else {
      boxes.push([W / 2 - 140, H - 64, W / 2 + 140, H])                         // toolbar overlay
    }

    // 0. beyond the solar system: Milky Way dust + signposts on a far sphere, never drawn over the disc
    const skyOn = reveal > R_OUT * 0.9
    const cam = camera.position
    const discR = radius(PLANE_AU, lin) * 1.04
    /** the disc hides this far point (the line of sight crosses the planets' plane inside the disc) */
    const behindDisc = (p: THREE.Vector3) => {
      if ((cam.y > 0) === (p.y > 0)) return false
      const k = cam.y / (cam.y - p.y)
      return Math.hypot(cam.x + (p.x - cam.x) * k, cam.z + (p.z - cam.z) * k) < discR
    }
    const atDeep = (p: THREE.Vector3) => {
      const q = p.clone(); q.y *= heightK(lin)
      return behindDisc(q) ? null : project(q, false)
    }
    if (skyOn) {
      const d0 = Math.max(1, pr * 1.4)
      g.fillStyle = '#aab3c4'
      for (const m of deep.dust) {
        const q = atDeep(m.p)
        if (!q) continue
        g.globalAlpha = 0.12 + 0.36 * m.w
        g.fillRect(Math.round(q.x * pr), Math.round(q.y * pr), d0, d0)
      }
      g.fillStyle = '#d9dccf'
      for (const f of deep.field) {
        const q = atDeep(f.p)
        if (!q) continue
        g.globalAlpha = (0.12 + 0.5 * f.w) * (0.75 + 0.25 * Math.sin(t * 0.9 + f.ph))
        g.fillRect(Math.round(q.x * pr), Math.round(q.y * pr), d0, d0)
      }
      g.globalAlpha = 1
      for (const o of deep.objs) {
        const q = atDeep(o.p)
        if (!q) continue
        // small-LED glyphs: a star = plus, a galaxy = tilted smudge, the centre = a dense diamond
        const dots: [number, number, number][] = o.kind === 'star' ? [[0, 0, 1], [1, 0, 0.5], [-1, 0, 0.5], [0, 1, 0.5], [0, -1, 0.5]]
          : o.kind === 'galaxy' ? [[0, 0, 0.9], [1, 0, 0.7], [-1, 0, 0.7], [2, -1, 0.4], [-2, 1, 0.4], [1, -1, 0.5], [-1, 1, 0.5]]
          : [[0, 0, 1], [1, 0, 0.7], [-1, 0, 0.7], [0, 1, 0.7], [0, -1, 0.7], [1, 1, 0.4], [-1, -1, 0.4], [1, -1, 0.4], [-1, 1, 0.4]]
        for (const [dx, dy, a] of dots) { g.globalAlpha = a * 0.8; g.fillStyle = '#d9dccf'; g.fillRect(Math.round((q.x + dx * 2.5) * pr), Math.round((q.y + dy * 2.5) * pr), d0 * 1.6, d0 * 1.6) }
        g.globalAlpha = 1
        const k = skyK * facing(o.p)
        if (k > 0.15) tag2(1.5, up(placeName(o.name)), deepSkySub(o.name, o.sub), q.x, q.y, COL.star, 0.75 * k, 8)
      }
    }

    // 1. the sky: constellations on the rim, faint; stars twinkle
    if (skyOn) for (const c of sky) {
      const pts = c.stars.map((st) => atSky(st.p))
      for (const [a, b] of c.lines) {
        const pa = pts[a], pb = pts[b]
        if (pa && pb) ledLine(ctx, grid, pr, pa.x, pa.y, pb.x, pb.y, COL.star, () => 0.08 * dim, 2)
      }
      c.stars.forEach((st, k) => {
        const q = pts[k]
        if (!q) return
        const tw = 0.75 + 0.25 * Math.sin(t * 1.3 + k * 2.1)
        ledAt(q.x, q.y, COL.star, (st.bright ? 0.55 : 0.3) * tw * (focus ? 0.5 : 1))
      })
      const first = pts.find(Boolean)
      const k = skyK * facing(c.stars[0].p)
      if (first && !focus && k > 0.15) tag(1, up(placeName(c.name)), first.x, first.y, COL.faint, 0.75 * k)
    }

    // 2. probes: positions, trails, drop columns
    const shown: { id: string; h: Hardware; x: number; y: number; prio: number }[] = []
    const flybyPlanets = new Set<string>()
    const auNow = new Map<string, number>()
    const hov = hovered.current
    for (const h of items) {
      const o = paths.objects[h.id], el = els.current.get(h.id)
      if (!o) continue
      const p = positions.current.get(h.id) ?? new THREE.Vector3()
      const n = probeAt(o, paths.step, until, p)
      auNow.set(h.id, p.length())
      squeeze(p, lin)
      positions.current.set(h.id, p)
      const sel = h.id === selectedId
      const color = sel ? COL.text : h.status === 'active' ? COL.ok : COL.warn
      // trail: inner looping craft only when selected; newest stretch brightest (phosphor afterglow).
      // The selected craft replays its road launch → today, then a light packet keeps running along it.
      if (sel || o.au >= 5 || h.id === hov) {
        const since = t - selAt.current.t
        const replay = sel ? THREE.MathUtils.smootherstep(Math.min(1, since / TRACE_S), 0, 1) : 1
        const kEnd = Math.max(1, Math.floor(replay * (n - 1)))
        const packet = sel && since > TRACE_S ? ((since - TRACE_S) % TRACE_LOOP_S) / (TRACE_LOOP_S * 0.6) : -1
        // silent craft: the stretch after the last signal is drawn grey (drifting, no longer heard)
        const kQuiet = h.status === 'silent' && /^\d{4}-/.test(h.lastSignal)
          ? Math.round(((yearOf(h.lastSignal) - yearOf(o.t0)) * 365.25) / paths.step) : Infinity
        let prev: { x: number; y: number } | null = null
        const step = sel ? 1 : Math.max(1, Math.floor(n / 220))
        for (let k = 0; k <= kEnd; k += step) {
          const q = at(axes(o.pts[k], v.clone()))
          if (q && prev) {
            const f = k / n
            // hover lights this trail and steps the others back a little
            const hoverK = !focus && hov ? (h.id === hov ? 2.2 : 0.6) : 1
            let a = sel ? 0.55 : Math.min(0.9, (0.12 + 0.45 * THREE.MathUtils.smoothstep(f, 0.7, 1)) * (focus ? 0.35 : 1) * hoverK)
            if (packet >= 0 && packet <= 1) a = Math.max(a, 1 - Math.abs(f - packet) * 14)
            const quiet = k > kQuiet
            ledLine(ctx, grid, pr, prev.x, prev.y, q.x, q.y, quiet && !sel ? COL.faint : quiet ? COL.dim : color, () => (quiet ? a * 0.75 : a))
          }
          prev = q
        }
        // × where it went quiet (labelled when it's the craft you're looking at)
        if (kQuiet < n && kQuiet <= kEnd) {
          const q = at(axes(o.pts[kQuiet], v.clone()))
          if (q) {
            for (const [dx, dy] of [[0, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) ledAt(q.x + dx * cell, q.y + dy * cell, COL.warn, (dx || dy ? 0.55 : 0.9) * (sel || !focus ? 1 : 0.4))
            if (sel || h.id === hov) tag(8.5, T().deep.lastSignal(h.lastSignal.slice(0, 4)), q.x, q.y, COL.warn, 1, cell * 2 + 4)
          }
        }
        if (sel && replay < 1) {
          // the replay head: a bright blinking block + the date it is passing (top priority label)
          const q = at(axes(o.pts[kEnd], v.clone()))
          if (q) {
            if (Math.floor(t * 10) % 2 === 0) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) ledAt(q.x + dx * cell, q.y + dy * cell, COL.text, 1)
            tag(10, fmtYM(sampleYear(o, paths.step, kEnd)), q.x, q.y, COL.text, 1, 12)
          }
        }
        // planet flybys it has passed so far
        if (sel) for (const ev of events) {
          if (ev.k > kEnd) break
          const q = at(axes(o.pts[ev.k], v.clone()))
          if (!q) continue
          flybyPlanets.add(ev.planet)
          for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) ledAt(q.x + dx * cell, q.y + dy * cell, COL.sun, 0.95)
          tag(8, `${up(T().deep.planets[ev.planet] ?? ev.planet)} · ${Math.floor(ev.year)}`, q.x, q.y, COL.sun, 1)
        }
      }
      const s = project(p)
      if (!s || !el) { if (el) el.style.display = 'none'; continue }
      // drop column to the planets' plane
      const foot = project(new THREE.Vector3(p.x, 0, p.z))
      if (foot && Math.abs(foot.y - s.y) > cell * 3) ledLine(ctx, grid, pr, s.x, s.y, foot.x, foot.y, COL.dim, () => 0.22 * (sel ? 1 : dim), 2)
      el.style.display = ''
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`
      shown.push({ id: h.id, h, x: s.x, y: s.y, prio: sel ? 3 : h.status === 'active' ? 2 : o.au > 20 ? 1 : 0 })
    }
    for (const id of positions.current.keys()) if (!items.some((h) => h.id === id)) positions.current.delete(id)

    // 3. destination headings for the Pioneers: dotted LEDs out to their star (when idle, or for the selected Pioneer)
    for (const d0 of dest) {
      const d = { ...d0, ...destination(d0.probe, d0) }
      const pr0 = shown.find((m) => m.id === d.probe)
      if (focus && d.probe !== selectedId) continue
      const q = atSky(d.p, true) // may be off screen: the heading line still points at it
      if (!q || !skyOn) continue
      if (pr0) ledLine(ctx, grid, pr, pr0.x, pr0.y, q.x, q.y, COL.warn, (u) => 0.32 * (1 - u * 0.6), 3)
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) ledAt(q.x + dx * cell, q.y + dy * cell, COL.sun, dx || dy ? 0.55 : 0.95)
      const w = Math.max(textWidth(d.label), textWidth(d.sub)) + 6
      const cands: [number, number][] = []
      if (pr0) {
        for (const [dx, dy] of [[22, -12], [-22 - w, -12], [-w / 2, 20], [-w / 2, -44], [22, 6], [-22 - w, 6], [40, 22], [-40 - w, 22]]) cands.push([pr0.x + dx, pr0.y + dy])
        for (const u of [0.25, 0.45, 0.65, 0.85]) {
          const x = pr0.x + (q.x - pr0.x) * u, y = pr0.y + (q.y - pr0.y) * u
          cands.push([x + 10, y - 12], [x - 10 - w, y - 12])
        }
      }
      cands.push([q.x - w / 2, q.y + 12], [q.x - w / 2, q.y - 34])
      want(7, w, 27, cands, (x, y) => {
        plate(ctx, x, y, w, 27, 0.85)
        microText(ctx, d.label, x + 3, y + 3, COL.sun, 0.95)
        microText(ctx, d.sub, x + 3, y + 15, COL.dim, 0.85)
      }, pr0 ? [pr0.x, pr0.y] : [q.x, q.y], COL.sun)
    }

    // 4. merge overlapping markers into clusters (2 passes); the selected craft always stays separate
    const clusterPx = stacked ? 24 : CLUSTER_PX
    shown.sort((a, b) => b.prio - a.prio)
    const taken = new Set<string>()
    const groups: (typeof shown)[] = []
    for (const m of shown) {
      if (taken.has(m.id)) continue
      const grp = shown.filter((o) => !taken.has(o.id) && Math.hypot(o.x - m.x, o.y - m.y) < clusterPx)
      grp.forEach((o) => taken.add(o.id))
      groups.push(grp)
    }
    const centre = (gr: typeof shown) => [gr.reduce((a, o) => a + o.x, 0) / gr.length, gr.reduce((a, o) => a + o.y, 0) / gr.length]
    for (let merged = true; merged;) {
      merged = false
      outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
        const [ax, ay] = centre(groups[i]), [bx, by] = centre(groups[j])
        if (Math.hypot(ax - bx, ay - by) < clusterPx * 1.3) { groups[i] = groups[i].concat(groups[j]); groups.splice(j, 1); merged = true; break outer }
      }
    }
    const pingNow = performance.now() / 1000
    const pings = livePings(pingNow)
    const half = cell * 2.6 // sprite half-size in css px
    let ci = 0
    const infos: ClusterInfo[] = []
    for (const gr of groups) {
      const merge = gr.length > 1 ? gr.filter((o) => o.prio !== 3) : []
      const solo = merge.length >= 2 ? gr.filter((o) => o.prio === 3) : gr
      for (const m of solo) {
        const [i, j] = cellOf(grid, pr, m.x, m.y)
        const sel = m.id === selectedId, hov = hovered.current === m.id
        const arrived = pings.some((pg) => { const e = pingNow - pg.t0; return pg.id === m.id && e > PULSE_S && e < PULSE_S + 0.9 })
        const color = arrived && Math.floor(pingNow * 8) % 2 === 0 ? COL.text : sel ? COL.text : m.h.status === 'active' ? COL.ok : COL.warn
        sprite(ctx, grid, i, j, m.h.kind, color, sel || hov ? 1 : focus ? 0.4 : 0.88)
        // still talking: the signal LED above blinks
        if (m.h.status === 'active' && t % 1.6 < 0.55) led(ctx, grid, i, j - 4, COL.ok, sel || !focus ? 0.95 : 0.4)
        if (sel) for (const [di, dj] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) led(ctx, grid, i + di, j + dj, COL.text, 0.9)
        boxes.push([m.x - half, m.y - half - cell, m.x + half, m.y + half])
        const name = up(loc(m.h).name)
        const au = auNow.get(m.id) ?? 0
        const dist = `${T().deep.au(au < 10 ? +au.toFixed(1) : Math.round(au))} · ${m.h.status === 'active' ? T().deep.talking : T().deep.silent}`
        const sc = m.h.status === 'active' ? COL.ok : COL.warn
        if (sel) { if (stacked) tag(9, name, m.x, m.y, COL.text, 1, half + 4); else tag2(9, name, dist, m.x, m.y, COL.text, 1, half + 4) }
        else if (hovered.current === m.id) tag2(9, name, dist, m.x, m.y, COL.text, 1, half + 4)
        else if (!focus) {
          // far craft carry name + distance; the crowd near the Sun gets short, lower-priority name tags
          const inner = (paths.objects[m.id]?.au ?? 0) < 5
          if (stacked || inner) tag(inner ? 2.5 : 3, name, m.x, m.y, sc, 0.8, half + 4)
          else tag2(5, name, dist, m.x, m.y, sc, 0.9, half + 4)
        }
      }
      for (const m of merge) { const el = els.current.get(m.id); if (el) el.style.display = 'none' }
      if (merge.length < 2) continue
      const [x, y] = centre(merge)
      const [i, j] = cellOf(grid, pr, x, y)
      bigText(ctx, grid, i, j, String(merge.length), COL.warn, focus ? 0.45 : 0.95)
      if (hoverCluster.current === ci) {
        const lines = merge.map((o) => `${up(loc(o.h).name)} · ${T().deep.au(+(auNow.get(o.id) ?? 0).toFixed(1))}`)
        const w = Math.max(...lines.map((l) => textWidth(l))) + 6, hh = lines.length * 12 + 4
        want(9.5, w, hh, around(x, y, w, hh, cell * 3 + 6), (lx, ly) => {
          plate(ctx, lx, ly, w, hh, 0.9)
          lines.forEach((l, k) => microText(ctx, l, lx + 3, ly + 3 + k * 12, merge[k].h.status === 'active' ? COL.ok : COL.warn, 1))
        }, [x, y], COL.warn)
      }
      boxes.push([x - cell * 3, y - cell * 3, x + cell * 3, y + cell * 3])
      const cel = clusterEls.current[ci]
      if (cel && ci < MAX_CLUSTERS) {
        const c3 = new THREE.Vector3()
        merge.forEach((o) => c3.add(positions.current.get(o.id)!))
        infos[ci] = { ids: merge.map((o) => o.id), at: c3.divideScalar(merge.length) }
        cel.style.display = ''
        cel.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
        cel.title = merge.map((o) => o.h.name).join(', ')
        ci++
      }
    }
    for (let i = ci; i < MAX_CLUSTERS; i++) { const c = clusterEls.current[i]; if (c) c.style.display = 'none' }
    clusters.current = infos

    // 5. PING pulses: Earth → craft (pale), blink, craft → Earth (green); sped up and labelled so
    const tEarth = until ?? yearOf(paths.epoch)
    const earth = at(planetPos(paths, 'earth', tEarth, new THREE.Vector3()))
    for (const pg of pings) {
      const m = shown.find((o) => o.id === pg.id)
      const o = paths.objects[pg.id]
      if (!earth || !m || !o) continue
      const e = pingNow - pg.t0
      const back = e > PULSE_S
      if (e > PULSE_S && e < PULSE_S + 0.4) continue // the arrival blink
      const u = back ? Math.min(1, (e - PULSE_S - 0.4) / PULSE_S) : e / PULSE_S
      if (u >= 1 && back) continue
      const [x0, y0, x1, y1] = back ? [m.x, m.y, earth.x, earth.y] : [earth.x, earth.y, m.x, m.y]
      for (let k = 0; k < 6; k++) {
        const uu = u - k * 0.012
        if (uu < 0) break
        ledAt(x0 + (x1 - x0) * uu, y0 + (y1 - y0) * uu, back ? COL.ok : COL.sun, 1 - k / 6)
      }
      const hx = x0 + (x1 - x0) * u, hy = y0 + (y1 - y0) * u
      tag(10, T().deep.ping(back, Math.round((o.au * SEC_PER_AU) / PULSE_S)), hx, hy, back ? COL.ok : COL.sun, 1)
    }

    // 6. map labels: planets, rings, belts — fewer on phones, and only the relevant ones in focus mode
    const GIANTS = ['jupiter', 'saturn', 'uranus', 'neptune']
    for (const l of labels) {
      const isPlanet = PLANET_NAMES.includes(l.key)
      if (focus && !(l.key === 'earth' || flybyPlanets.has(l.key))) continue
      if (stacked && !(l.key === 'earth' || l.key === 'sun' || GIANTS.includes(l.key))) continue
      // rings/belts/regions only in chart view, planets down to a lower tilt; Earth always
      const k = l.key === 'earth' ? 1 : isPlanet ? planetK : chartK
      if (k < 0.15) continue
      const q = at(l.at(until, v))
      if (!q) continue
      if (l.key === 'earth') {
        const w = Math.max(textWidth(T().deep.earth), textWidth(T().deep.here)) + 6
        want(6, w, 27, [[q.x + 8, q.y - 6], [q.x - 8 - w, q.y - 6], [q.x - w / 2, q.y + 8], [q.x - w / 2, q.y - 34]], (x, y) => {
          plate(ctx, x, y, w, 27, 0.85)
          microText(ctx, T().deep.earth, x + 3, y + 3, COL.sun, 1)
          microText(ctx, t % 1 < 0.55 ? T().deep.here : T().deep.hereBlink, x + 3, y + 15, COL.sun, 0.8)
        }, [q.x, q.y], COL.sun)
        continue
      }
      tag(isPlanet ? (GIANTS.includes(l.key) ? 4 : 3) : 2, up(l.text), q.x, q.y, l.color ?? COL.dim, (l.alpha ?? 0.8) * k, 6)
    }

    // place every label, most important first
    queue.sort((a, b) => b.prio - a.prio)
    for (const q of queue) {
      for (const [x0, y] of q.cands) {
        const x = Math.min(Math.max(6, x0), W - q.w - 6)
        if (y < 6 || y + q.h > H - 6) continue
        const b: Box = [x - 2, y - 2, x + q.w + 2, y + q.h + 2]
        if (!free(b)) continue
        boxes.push(b)
        if (q.anchor) {
          // a label pushed away from what it names gets a dotted leader back to it
          const [ax, ay] = q.anchor
          const nx = Math.min(Math.max(ax, x), x + q.w), ny = Math.min(Math.max(ay, y), y + q.h)
          const len = Math.hypot(nx - ax, ny - ay)
          if (len > 16) {
            g.fillStyle = q.color ?? COL.dim
            g.globalAlpha = 0.55
            const steps = Math.floor(len / 3)
            for (let k = 2; k < steps; k++) {
              const u = k / steps
              g.fillRect(Math.round((ax + (nx - ax) * u) * pr), Math.round((ay + (ny - ay) * u) * pr), Math.max(1, pr), Math.max(1, pr))
            }
            g.globalAlpha = 1
          }
        }
        q.draw(x, y)
        break
      }
    }

    // 7. HUD (desktop): compass, bottom-left of the visible map (the key is the bottom-left panel)
    if (!stacked) {
      // compass: which way is ecliptic north (N) and longitude 0° (the vernal equinox), turning with the camera.
      // Fine dotted arms; each label sits past its arm's tip, never on it.
      const cx = 46, cy = H - bottomRow - 46
      const o0 = project(new THREE.Vector3(0, 0, 0), false), ox = project(new THREE.Vector3(10, 0, 0), false), oy = project(new THREE.Vector3(0, 10, 0), false)
      if (o0 && ox && oy) {
        const ARM = 22
        const arm = (q: { x: number; y: number }, lab: string, color: string) => {
          const dx = q.x - o0.x, dy = q.y - o0.y, l = Math.hypot(dx, dy)
          if (l < 6) return // pointing (almost) straight at us: no readable direction
          const ux = dx / l, uy = dy / l
          g.fillStyle = color
          for (let k = 2; k <= ARM; k += 3) {
            g.globalAlpha = 0.3 + 0.6 * (k / ARM)
            g.fillRect(Math.round((cx + ux * k) * pr), Math.round((cy + uy * k) * pr), Math.max(1, pr * 1.4), Math.max(1, pr * 1.4))
          }
          g.globalAlpha = 1
          // little arrowhead: two dots either side of the tip
          for (const sgn of [-1, 1]) g.fillRect(Math.round((cx + ux * (ARM - 3) - uy * 2.5 * sgn) * pr), Math.round((cy + uy * (ARM - 3) + ux * 2.5 * sgn) * pr), Math.max(1, pr * 1.4), Math.max(1, pr * 1.4))
          const w = textWidth(lab, 1.5)
          const tx = cx + ux * (ARM + 6), ty = cy + uy * (ARM + 6)
          const lx = ux < -0.35 ? tx - w : ux > 0.35 ? tx : tx - w / 2
          const ly = uy < -0.35 ? ty - 8 : uy > 0.35 ? ty : ty - 4
          microText(ctx, lab, lx, ly, color, 0.95, 1.5)
        }
        arm(ox, '0°', COL.dim)
        arm(oy, 'N', COL.text)
        g.fillStyle = COL.sun
        g.fillRect(Math.round((cx - 1.5) * pr), Math.round((cy - 1.5) * pr), Math.round(3 * pr), Math.round(3 * pr))
      }
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

/** Intro: start this many times farther out than home (the whole sky ring in view), then glide in */
const INTRO_FAR = 2.6
const INTRO_SMOOTH = 1.5
const INTRO_MAX = 560
/** After the intro, zooming out stops at this × the home distance (farther looks empty and tiny) */
const ZOOM_OUT_MAX = 1.35

/** A craft's whole road on the map: centre and radius of its bounding box (squeezed scene units). */
export interface Road { center: THREE.Vector3; radius: number }

function CameraRig({ selectedId, positions, focus, ready, roadOf }: {
  selectedId: string | null; positions: React.RefObject<Map<string, THREE.Vector3>>
  /** whole-road bounds, to frame launch → today when a far craft is picked */
  roadOf: (id: string) => Road | null
  /** a cluster was clicked: fly close enough that it splits apart */
  focus: { at: THREE.Vector3; n: number } | null
  /** paths loaded: the intro glide may start (once the page loader is gone too) */
  ready: boolean
}) {
  const controls = useRef<CameraControls>(null)
  const booted = useBooted()
  const introDone = useRef(false)
  const parked = useRef(false)
  // the intro needs room to start far out; afterwards zooming out stops a little past home
  const [maxD, setMaxD] = useState(INTRO_MAX)
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

  // intro: park far out at once, glide home when everything is ready
  useEffect(() => {
    const c = controls.current
    if (!c || introDone.current) return
    const v = portrait ? HOME_PORTRAIT : HOME
    const far = v.pos.map((x, i) => v.target[i] + (x - v.target[i]) * INTRO_FAR) as V3
    // park far out first (the canvas mounts its children late, so paths may already be ready here)
    if (!parked.current) { c.setLookAt(...far, ...v.target, false); parked.current = true }
    if (!ready || !booted) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      c.setLookAt(...v.pos, ...v.target, false); introDone.current = true
      setMaxD(new THREE.Vector3(...v.pos).distanceTo(new THREE.Vector3(...v.target)) * ZOOM_OUT_MAX)
      return
    }
    // hold the wide view while the LEDs switch on (BOOT_S), then glide in
    const hold = 250 + BOOT_S * 1000
    const t0 = setTimeout(() => { c.smoothTime = INTRO_SMOOTH; c.setLookAt(...v.pos, ...v.target, true) }, hold)
    const t1 = setTimeout(() => {
      c.smoothTime = 0.25; introDone.current = true
      setMaxD(new THREE.Vector3(...v.pos).distanceTo(new THREE.Vector3(...v.target)) * ZOOM_OUT_MAX)
    }, hold + INTRO_SMOOTH * 2400)
    return () => { clearTimeout(t0); clearTimeout(t1) }
  }, [ready, booted, portrait])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    // positions fill in on the first frames: wait one tick so a selection from the chart finds its craft
    const t = setTimeout(() => {
      const p = selectedId ? positions.current.get(selectedId) : undefined
      if (!p && !introDone.current) return // the intro is still gliding home
      const v = portrait ? HOME_PORTRAIT : HOME
      const road = selectedId ? roadOf(selectedId) : null
      if (p && road && road.radius > 12) {
        // far craft: frame its whole road (launch → today, incl. where it bent round a planet), from the home direction
        const tgt = road.center
        const dir = new THREE.Vector3(...v.pos).sub(new THREE.Vector3(...v.target)).normalize()
        const cam = tgt.clone().addScaledVector(dir, road.radius * 2.6 + 20)
        c.setLookAt(cam.x, cam.y, cam.z, tgt.x, tgt.y, tgt.z, true)
      } else if (p) c.setLookAt(p.x + 6, p.y + 9, p.z + 12, p.x, p.y, p.z, true)
      else c.setLookAt(...v.pos, ...v.target, true)
    }, 30)
    return () => clearTimeout(t)
  }, [selectedId, positions, portrait, roadOf])
  useEffect(() => {
    const c = controls.current
    if (!c || !focus) return
    const p = focus.at
    c.setLookAt(p.x - 7, p.y + 30, p.z - 22, p.x, p.y, p.z, true)
  }, [focus])
  return (
    <CameraControls
      ref={controls}
      minDistance={4}
      maxDistance={maxD}
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
  const shared = useMemo<Shared>(() => ({ lin: 0, reveal: 0 }), [])
  const els = useRef(new Map<string, HTMLElement>())
  const ledCanvas = useRef<HTMLCanvasElement>(null)
  const hovered = useRef<string | null>(null)
  const hoverCluster = useRef(-1)
  const positions = useRef(new Map<string, THREE.Vector3>())
  const clusterEls = useRef<(HTMLElement | null)[]>([])
  const clusters = useRef<ClusterInfo[]>([])
  const [focus, setFocus] = useState<{ at: THREE.Vector3; n: number } | null>(null)
  const booted = useBooted()
  const lang = useLang()

  const labels = useMemo<Label[]>(() => {
    if (!paths) return []
    const S = stringsFor(lang)
    const onRing = (au: number, deg: number) => (_: number | null, out: THREE.Vector3) => {
      const a = THREE.MathUtils.degToRad(deg)
      return out.set(au * Math.cos(a), 0, -au * Math.sin(a))
    }
    // priority order: earlier labels win when two would overlap
    return [
      { key: 'earth', text: S.deep.planets.earth, color: COL.sun, alpha: 0.9, at: (t, out) => planetPos(paths, 'earth', t ?? yearOf(paths.epoch), out) },
      { key: 'sun', text: S.deep.sun, color: COL.sun, at: (_, out) => out.set(0, 0, 0) },
      ...PLANET_NAMES.filter((n) => n !== 'earth').map((n): Label => ({
        key: n, text: S.deep.planets[n] ?? n, color: COL.planet, alpha: 0.85,
        at: (t, out) => planetPos(paths, n, t ?? yearOf(paths.epoch), out),
      })),
      { key: 'helio', text: S.deep.helio, color: COL.warn, alpha: 0.6, at: onRing(120, 140) },
      { key: 'interstellar', text: S.deep.interstellar, color: '#7f97ab', alpha: 0.75, at: onRing(150, 160) },
      { key: 'r100', text: S.deep.au(100), at: onRing(100, -30), alpha: 0.5 },
      { key: 'r10', text: S.deep.au(10), at: onRing(10, -30), alpha: 0.5 },
      { key: 'r1', text: S.deep.au(1), at: onRing(1, -30), alpha: 0.5 },
      { key: 'kuiper', text: S.deep.kuiper, at: onRing(40, 205), alpha: 0.55 },
      { key: 'belt', text: S.deep.belt, at: onRing(2.8, 250), alpha: 0.55 },
    ]
  }, [paths, lang]) // texts come from T(): rebuild on a language switch

  // whole-road bounds per craft, in the current scale (log or 1:1)
  const roadOf = useMemo(() => {
    const cache = new Map<string, Road | null>()
    return (id: string) => {
      if (cache.has(id)) return cache.get(id)!
      const o = paths?.objects[id]
      let road: Road | null = null
      if (o) {
        const box = new THREE.Box3()
        for (const pt of o.pts) box.expandByPoint(squeeze(axes(pt), trueScale ? 1 : 0))
        const sphere = box.getBoundingSphere(new THREE.Sphere())
        road = { center: sphere.center, radius: sphere.radius }
      }
      cache.set(id, road)
      return road
    }
  }, [paths, trueScale])

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
        {paths && <Plane paths={paths} shared={shared} until={until} focus={selectedId != null} />}
        {paths && <LedLayer paths={paths} items={items} until={until} shared={shared} selectedId={selectedId} canvas={ledCanvas}
          els={els} positions={positions} clusterEls={clusterEls} clusters={clusters} hovered={hovered} labels={labels} hoverCluster={hoverCluster} />}
        <CameraRig selectedId={selectedId} positions={positions} focus={focus} ready={!!paths} roadOf={roadOf} />
      </Canvas>

      {/* probes, trails, labels, stars, pulses and the HUD, drawn as LEDs on the plane's grid */}
      <canvas ref={ledCanvas} className="ds-led" aria-hidden />

      <div className={`markers${paths ? (booted ? ' is-booting' : ' is-waiting') : ''}`}>
        {items.map((h) => (
          <button
            key={h.id}
            ref={(el) => { if (el) els.current.set(h.id, el); else els.current.delete(h.id) }}
            className={`marker marker--${h.status}${h.id === selectedId ? ' is-selected' : ''}`}
            onClick={() => onSelect(h.id)}
            onPointerEnter={() => { hovered.current = h.id }}
            onPointerLeave={() => { if (hovered.current === h.id) hovered.current = null }}
            aria-label={`${loc(h).mission} — ${loc(h).name}`}
            style={{ display: 'none', '--ping-delay': `${BOOT_MARKERS_START_S + (order.get(h.id) ?? 0) * BOOT_MARKER_STEP_S}s` } as React.CSSProperties}
          >
            <span className="marker__ink" />
            <span className="marker__stem" aria-hidden />
          </button>
        ))}
        {Array.from({ length: MAX_CLUSTERS }, (_, i) => (
          <button key={`c${i}`} className="ds-cluster" style={{ display: 'none' }}
            ref={(el) => { clusterEls.current[i] = el }}
            onPointerEnter={() => { hoverCluster.current = i }}
            onPointerLeave={() => { if (hoverCluster.current === i) hoverCluster.current = -1 }}
            onClick={() => { const c = clusters.current[i]; if (c) setFocus({ at: c.at.clone(), n: Date.now() }) }}
            aria-label={T().deep.group}>
            <span />
          </button>
        ))}
      </div>

    </div>
  )
}
