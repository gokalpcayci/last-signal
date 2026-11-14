import * as THREE from 'three'
import { PLANETS, type Planet, type PlanetId } from './planets'

/**
 * Real topography: the Moon from LRO LOLA (NASA SVS CGI Moon Kit, scripts/build_dem.py),
 * Mars from MGS MOLA (PDS, scripts/build_mars_dem.py) → public/terrain/<body>_dem.{bin,json}.
 * Per-body numbers (plateau size, degrees → units, curve, vertical scale) are in planets.ts.
 *
 * World units: x = east, z = south.
 *
 * Layout (like the reference diorama): the real DEM sits on a raised central
 * plateau (MESA) with cliff edges; around it is a flat, coarser "apron" grid.
 * The apron is a stylized frame only — every hardware site is on the plateau.
 */
export const WORLD = { width: 340, depth: 290, segX: 366, segZ: 312 }
const APRON_Y = -9

/**
 * The body being shown. Module state on purpose: lonToX & co. are used by many
 * scene modules, and App sets it before rendering (the scene is keyed by planet,
 * so everything that read the old one is rebuilt).
 */
let P: Planet = PLANETS.moon
export const activePlanet = () => P
export function setPlanet(id: PlanetId) { P = PLANETS[id] }
const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180

/**
 * Planet curvature: the surface bends down with distance from the center like a
 * slice of a sphere (radius CURVE_R world units). It gives a curved horizon and
 * drops the world edges below it, so the end of the grid is never visible.
 * Purely visual — contours, colors and the probe use the uncurved elevation.
 */
export const curvature = (x: number, z: number) => (x * x + z * z) / (2 * P.curveR)

/** Signed distance to the plateau edge (negative inside), with an irregular, natural-looking wobble. */
function mesaSdf(x: number, z: number) {
  const { hx, hz, radius } = P.mesa
  const qx = Math.abs(x) - (hx - radius)
  const qz = Math.abs(z) - (hz - radius)
  const sdf = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - radius
  const jitter = 2.2 * Math.sin(x * 0.21) + 1.6 * Math.sin(z * 0.17 + 1.3) + 1.1 * Math.sin((x + z) * 0.33)
  return sdf + jitter
}

// Rim fade width = P.edgeFade. Wide on purpose: seen at a grazing angle, a narrow
// world-space band squashes into a few pixels and reads as a hard black edge.

/** 1 on the plateau, 0 on the apron; a ~3-unit cliff. */
export function mesaMask(x: number, z: number) {
  return 1 - THREE.MathUtils.smoothstep(mesaSdf(x, z), -1.5, 1.5)
}

// World units per degree (P.xPerDeg / P.zPerDeg); x = 0 is P.lonCenter.
export const lonToX = (lon: number) => wrap180(lon - P.lonCenter) * P.xPerDeg
export const latToZ = (lat: number) => -lat * P.zPerDeg
/** Not wrapped: off the plateau x can run past ±180° from the center (only the apron is there). */
const xToLon = (x: number) => x / P.xPerDeg + P.lonCenter
const zToLat = (z: number) => -z / P.zPerDeg

/** Vertical exaggeration: real relief would be nearly flat at this map scale. */
export const unitsPerKm = () => P.unitsPerKm
/** True scale: the map's horizontal scale (xPerDeg world units per degree of a great circle). */
export const trueUnitsPerKm = () => P.xPerDeg / ((Math.PI * P.radiusKm) / 180)
export const exaggeration = () => Math.round(unitsPerKm() / trueUnitsPerKm())

interface DemMeta {
  width: number; height: number; ppd: number
  /** lonMin/lonMax are relative to this (Mars map is re-centered); 0 if absent */
  lonCenter?: number
  lonMin: number; lonMax: number; latMin: number; latMax: number
}

export interface Dem {
  /** Terrain height (world units) at world x/z, at the current vertical scale (or `u` units per km) */
  heightAt: (x: number, z: number, u?: number) => number
  /** Same as heightAt but without planet curvature (real elevation, for colors/contours) */
  flatHeightAt: (x: number, z: number, u?: number) => number
  /** Current vertical scale in world units per km (animated by the true-scale toggle) */
  unitsPerKm: number
  /** Raw elevation in meters at lon/lat (degrees east) */
  metersAt: (lon: number, lat: number) => number
  /** Surface brightness 0–1 at lon/lat (dark maria ≈ low, bright highlands ≈ high); null = no map */
  albedoAt: ((lon: number, lat: number) => number) | null
  /** True where the real DEM is shown (the plateau), false on the stylized apron */
  onMap: (x: number, z: number) => boolean
  buildGeometry: () => THREE.BufferGeometry
}

export const worldToLonLat = (x: number, z: number) => ({ lon: xToLon(x), lat: zToLat(z) })

function makeDem(meta: DemMeta, raw: Uint16Array, albedo: Uint8ClampedArray | null): Dem {
  const { width: W, height: H, ppd } = meta
  const center = meta.lonCenter ?? 0
  /** Column coordinate for a longitude (wraps around the globe) */
  const col = (lon: number) => (wrap180(lon - center) - meta.lonMin) * ppd
  const px = (c: number, r: number) => {
    const ci = Math.min(W - 1, Math.max(0, c)), ri = Math.min(H - 1, Math.max(0, r))
    return (raw[ri * W + ci] - 20000) / 2 // meters
  }
  /** Bilinear sample in meters at lon/lat. Pixel centers sit at +0.5. */
  const metersAt = (lon: number, lat: number) => {
    const c = col(lon) - 0.5
    const r = (meta.latMax - lat) * ppd - 0.5
    const c0 = Math.floor(c), r0 = Math.floor(r)
    const fx = c - c0, fy = r - r0
    const top = px(c0, r0) * (1 - fx) + px(c0 + 1, r0) * fx
    const bot = px(c0, r0 + 1) * (1 - fx) + px(c0 + 1, r0 + 1) * fx
    return top * (1 - fy) + bot * fy
  }
  // The mesh has fewer vertices than the DEM has pixels. Point-sampling would alias
  // small craters into spikes, so average a 5×5 patch covering one vertex cell.
  const cellLon = xToLon(WORLD.width / WORLD.segX)
  const cellLat = Math.abs(zToLat(WORLD.depth / WORLD.segZ))
  const smoothMetersAt = (lon: number, lat: number) => {
    let s = 0
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++) s += metersAt(lon + (i / 4) * cellLon, lat + (j / 4) * cellLat)
    return s / 25
  }
  const kmAt = (x: number, z: number) => smoothMetersAt(xToLon(x), zToLat(z)) / 1000
  const flatHeightAt = (x: number, z: number, u = dem.unitsPerKm) => {
    const m = mesaMask(x, z)
    if (m <= 0) return APRON_Y
    return APRON_Y + (kmAt(x, z) * u - APRON_Y) * m
  }
  /** Nearest-pixel albedo (RGBA from canvas; gray, so read R). Same grid as the DEM. */
  const albedoAt = albedo && ((lon: number, lat: number) => {
    const c = Math.min(W - 1, Math.max(0, Math.round(col(lon) - 0.5)))
    const r = Math.min(H - 1, Math.max(0, Math.round((meta.latMax - lat) * ppd - 0.5)))
    return albedo[(r * W + c) * 4] / 255
  })
  const onMap = (x: number, z: number) => mesaMask(x, z) > 0.98
  const heightAt = (x: number, z: number, u?: number) => flatHeightAt(x, z, u) - curvature(x, z)
  const dem: Dem = {
    heightAt, flatHeightAt, metersAt, albedoAt, onMap, unitsPerKm: P.unitsPerKm,
    buildGeometry: () => buildTerrainGeometry(dem, kmAt),
  }
  return dem
}

async function loadAlbedo(url: string, w: number, h: number) {
  const img = new Image()
  img.src = url
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable for albedo decoding')
  ctx.drawImage(img, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h).data
}

const demPromises = new Map<PlanetId, Promise<Dem>>()
/** Loads (once per body) the active planet's elevation grid. */
export function loadDem(): Promise<Dem> {
  const planet = P
  let p = demPromises.get(planet.id)
  if (!p) {
    p = (async () => {
      const base = import.meta.env.BASE_URL
      const [meta, buf] = await Promise.all([
        fetch(`${base}${planet.dem}_dem.json`).then((r) => r.json() as Promise<DemMeta>),
        fetch(`${base}${planet.dem}_dem.bin`).then((r) => r.arrayBuffer()),
      ])
      const albedo = planet.albedo ? await loadAlbedo(`${base}${planet.albedo}`, meta.width, meta.height) : null
      return makeDem(meta, new Uint16Array(buf), albedo)
    })()
    demPromises.set(planet.id, p)
  }
  return p
}

// Muted elevation ramp (by elevation *rank*): deep blue-slate basins → teal-grey →
// olive → ochre/sand → pale regolith peaks. It widens *brightness* more than hue — that's
// what reads as depth, and in halftone it also drives dot size. Rule: no saturated green
// or orange in the terrain; those mean "still working" / "silent" on the markers.
// The stops are per body (P.ramp); Mars swaps the blue-green for dusty mauve → tan.
function rampAt(ramp: [number, THREE.Color][], t: number, out: THREE.Color) {
  let k = 1
  while (k < ramp.length - 1 && t > ramp[k][0]) k++
  const [t0, c0] = ramp[k - 1], [t1, c1] = ramp[k]
  return out.copy(c0).lerp(c1, THREE.MathUtils.smoothstep(t, t0, t1))
}

function buildTerrainGeometry(dem: Dem, kmAt: (x: number, z: number) => number) {
  const RAMP = P.ramp.map(([t, hex]) => [t, new THREE.Color(hex)] as [number, THREE.Color])
  // steep slopes: rust-brown, kept well away from the markers' status orange
  const C_RUST = new THREE.Color(P.rust)
  const C_CLIFF = new THREE.Color(P.cliff)
  const C_APRON = new THREE.Color(P.apron)
  const UNITS_PER_KM = P.unitsPerKm
  const EDGE_FADE = P.edgeFade
  const albedoAt = dem.albedoAt
  const g = new THREE.PlaneGeometry(WORLD.width, WORLD.depth, WORLD.segX, WORLD.segZ)
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const mesa = new Float32Array(pos.count)
  const alb = new Float32Array(pos.count)
  const km = new Float32Array(pos.count)
  const edge = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    mesa[i] = mesaMask(x, z)
    km[i] = mesa[i] > 0 ? kmAt(x, z) : 0
    // flat first, at the exaggerated scale: colors/slopes always use this relief
    pos.setY(i, APRON_Y + (km[i] * UNITS_PER_KM - APRON_Y) * mesa[i])
    alb[i] = albedoAt ? albedoAt(xToLon(x), zToLat(z)) : 0.5
  }
  const top = Array.from({ length: pos.count }, (_, i) => i).filter((i) => mesa[i] > 0.98)
  // Albedo contrast stretch (5th–95th percentile) so maria vs. highlands reads clearly.
  const sortedAlb = top.map((i) => alb[i]).sort((a, b) => a - b)
  const aLo = sortedAlb[Math.floor(sortedAlb.length * 0.05)], aHi = sortedAlb[Math.floor(sortedAlb.length * 0.95)]
  // Color the plateau by elevation *rank* (histogram equalization): lunar heights
  // cluster in the middle, so a plain min→max ramp paints nearly everything one color.
  top.sort((a, b) => pos.getY(a) - pos.getY(b))
  const rank = new Float32Array(pos.count)
  top.forEach((idx, r) => { rank[idx] = r / (top.length - 1) })
  g.computeVertexNormals()
  const nrm = g.attributes.normal as THREE.BufferAttribute
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const m = mesa[i]
    if (m > 0.98) {
      const t = rank[i]
      rampAt(RAMP, t, c)
      // steep slopes (crater walls, mountain flanks) pick up rust-brown patches
      const slope = 1 - nrm.getY(i)
      c.lerp(C_RUST, THREE.MathUtils.smoothstep(slope, 0.05, 0.22) * 0.6)
      // real LRO brightness: dark maria dim, bright highlands and crater rays lift
      // (no map → a = 0.5, the middle of the same range)
      const a = albedoAt ? THREE.MathUtils.clamp((alb[i] - aLo) / Math.max(aHi - aLo, 1e-3), 0, 1) : 0.5
      c.multiplyScalar(0.62 + 0.55 * a) // bright highlands lift, but never toward white
    } else if (m > 0.02) {
      // cliff face: darker terracotta fading down into the apron
      c.copy(C_APRON).lerp(C_CLIFF, m)
    } else {
      c.copy(C_APRON)
    }
    colors.set([c.r, c.g, c.b], i * 3)
    // The terrain never "ends": 0 deep inside the plateau → 1 at its rim (and beyond).
    // The shader fades ground, grid lines and a stipple break-up on separate curves of this.
    edge[i] = THREE.MathUtils.clamp((mesaSdf(pos.getX(i), pos.getZ(i)) + EDGE_FADE) / EDGE_FADE, 0, 1)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setAttribute("aMesa", new THREE.BufferAttribute(mesa, 1))
  g.setAttribute("aEdge", new THREE.BufferAttribute(edge, 1))
  // keep real elevation (in km, scale-independent) for contour lines
  const elev = new Float32Array(pos.count)
  const curve = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    elev[i] = pos.getY(i) / UNITS_PER_KM
    curve[i] = curvature(pos.getX(i), pos.getZ(i))
  }
  g.setAttribute("aElev", new THREE.BufferAttribute(elev, 1))
  g.userData = { km, mesa, curve } satisfies ScaleData
  applyVerticalScale(g, dem.unitsPerKm)
  g.computeVertexNormals()
  return g
}

interface ScaleData { km: Float32Array; mesa: Float32Array; curve: Float32Array }

/**
 * Re-sets every vertex height for a vertical scale `u` (world units per km) and bends
 * it into the planet curve. Cheap enough (~115k verts) to run every frame of the
 * true-scale morph; CPU positions stay exact, so raycasts (elevation probe) keep working.
 */
export function applyVerticalScale(g: THREE.BufferGeometry, u: number) {
  const { km, mesa, curve } = g.userData as ScaleData
  const pos = g.attributes.position as THREE.BufferAttribute
  const arr = pos.array as Float32Array
  for (let i = 0; i < pos.count; i++) arr[i * 3 + 1] = APRON_Y + (km[i] * u - APRON_Y) * mesa[i] - curve[i]
  pos.needsUpdate = true
  g.computeBoundingSphere()
  g.computeBoundingBox()
}

/** Max distance from the center to a world corner — the boot reveal ends past this. */
export const REVEAL_MAX = Math.hypot(WORLD.width / 2, WORLD.depth / 2) + 10

/**
 * Draws the grid in the fragment shader instead of `wireframe: true` (which WebGL
 * always renders 1px wide). One draw call handles:
 *  - square cells with constant on-screen line width (fwidth), faint halo, fog
 *  - 1 km contour lines on the plateau (5 km lines brighter)
 *  - live day/night shading from the Sun's position (uSunLon)
 *  - the boot-up reveal: a ring that grows from the center (uReveal)
 */
/** uLava value meaning "no lava" (below the deepest near-side point, −5.6 km) */
export const LAVA_OFF = -9

export function makeGridMaterial(fogColor: string, fogNear: number, fogFar: number) {
  // THREE.Color('#hex') is stored in linear space, but this shader writes gl_FragColor as-is
  // (no colorspace conversion), so hand it the sRGB components to match the CSS/scene background.
  const bg = new THREE.Color(fogColor).convertLinearToSRGB()
  return new THREE.ShaderMaterial({
    uniforms: {
      uCells: { value: new THREE.Vector2(WORLD.segX, WORLD.segZ) },
      uWidth: { value: 0.9 },              // core line width in px
      // ground base = the background colour: the surface can only ever add light, so a
      // fading terrain never turns darker than the sky behind it (no black silhouette)
      uFill: { value: bg },
      uFog: { value: bg },
      uFogNear: { value: fogNear },
      uFogFar: { value: fogFar },
      uContourStep: { value: P.contourKm },  // aElev is in km
      uSunLon: { value: 0 },                 // sub-solar longitude, radians
      uReveal: { value: REVEAL_MAX },        // world-unit radius revealed so far
      uDegX: { value: 1 / P.xPerDeg },       // world x → degrees lon from the map center
      uDegZ: { value: -1 / P.zPerDeg },      // world z → degrees lat
      uLava: { value: LAVA_OFF },            // lava-flood level in km of real elevation
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aMesa;
      attribute float aEdge;
      varying float vEdge;
      varying vec3 vWorld;
      attribute float aElev;
      uniform float uDegX;
      uniform float uDegZ;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vDepth;
      varying float vMesa;
      varying float vHeight;
      varying vec2 vXZ;
      varying vec2 vLonLat; // radians
      void main() {
        vUv = uv;
        vColor = color;
        vMesa = aMesa;
        vEdge = aEdge;
        vWorld = position; // the terrain mesh sits at the origin: local = world
        vHeight = aElev; // real (uncurved) elevation
        vXZ = position.xz;
        vLonLat = radians(vec2(position.x * uDegX, position.z * uDegZ));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uCells;
      uniform float uWidth;
      uniform vec3 uFill;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uContourStep;
      uniform float uSunLon;
      uniform float uReveal;
      uniform float uLava;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vDepth;
      varying float vMesa;
      varying float vHeight;
      varying vec2 vXZ;
      varying vec2 vLonLat;
      varying float vEdge;
      varying vec3 vWorld;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      // One halftone dot per unit cell of hv (already rotated); dot area follows the light.
      float halftone(vec2 hv, float light) {
        float aa = max(length(fwidth(hv)), 1e-4);
        float rad = 0.5 * sqrt(light);
        return 1.0 - smoothstep(rad - aa, rad + aa, length(fract(hv) - 0.5));
      }

      float lineAA(float v, float widthPx) {
        float w = fwidth(v);
        float d = abs(fract(v - 0.5) - 0.5) / max(w, 1e-4);
        return 1.0 - smoothstep(widthPx - 0.5, widthPx + 0.5, d);
      }

      void main() {
        // ── boot-up reveal: hide everything beyond the growing ring ──
        float r = length(vXZ);
        if (r > uReveal) discard;
        float ring = exp(-abs(uReveal - r) * 0.35);

        // ── grid (apron gets every 2nd line, like the reference foreground) ──
        vec2 g = vUv * uCells * (vMesa > 0.5 ? 1.0 : 0.5);
        vec2 w = fwidth(g);
        vec2 d = abs(fract(g - 0.5) - 0.5) / max(w, 1e-4);
        float px = min(d.x, d.y);
        float core = 1.0 - smoothstep(uWidth - 0.5, uWidth + 0.5, px);
        float glow = exp(-px * 0.9) * 0.12;
        float density = clamp(1.0 - (max(w.x, w.y) - 0.2) / 0.3, 0.55, 1.0);

        // ── live day/night: Sun elevation at this point (sub-solar latitude ≈ 0) ──
        float sunDot = cos(vLonLat.y) * cos(vLonLat.x - uSunLon);
        float day = smoothstep(-0.02, 0.09, sunDot);

        // ── hillshade: facet normal from screen-space derivatives (free, and it follows the
        //    true-scale morph). Lit by the real Sun on the day side — low Sun near the
        //    terminator = long dramatic shading — and a soft NW map light on the night side. ──
        vec3 nrm = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        if (nrm.y < 0.0) nrm = -nrm;
        float dl = uSunLon - vLonLat.x;
        vec3 sunL = normalize(vec3(sin(dl), sunDot, sin(vLonLat.y) * cos(dl))); // x east, y up, z south
        vec3 L = normalize(mix(normalize(vec3(-0.6, 0.6, -0.55)), sunL, day));
        float light = clamp(0.5 + (dot(nrm, L) - L.y) * 2.5, 0.0, 1.0); // 0.5 = flat ground

        // ── halftone surface: a 45° dot screen (3 per grid cell) between the grid lines.
        //    Dot area follows the light, so lit slopes print big dots and shadowed ones
        //    almost none. LOD keeps ≥ ~6 px per dot at any distance by halving the dot
        //    frequency level by level and cross-fading between levels (like mipmaps). ──
        vec2 hv = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (vUv * uCells * 3.0);
        float lv = max(0.0, log2(length(fwidth(hv)) * 6.0));
        float l0 = floor(lv);
        float dotm = mix(halftone(hv / exp2(l0), light), halftone(hv / exp2(l0 + 1.0), light), lv - l0);
        vec3 ground = vColor * (0.03 + 0.8 * dotm);
        // grid lines; on shadowed slopes they step back and the dots carry the shading
        vec3 lines = vColor * (core * 1.7 + glow) * density * mix(0.45, 1.15, light);

        // ── edge fade: the ground goes first, the grid lines outlive it and then break up
        //    into stipple fragments (anchored to the ground, so they don't shimmer) ──
        float groundKeep = 1.0 - smoothstep(0.15, 0.7, vEdge);
        float lineKeep = 1.0 - smoothstep(0.35, 0.95, vEdge);
        float cut = smoothstep(0.4, 0.95, vEdge);
        float stipple = step(cut, hash(floor(vXZ * 2.6)) * 0.85 + 0.15 * (1.0 - cut));
        lineKeep *= mix(1.0, stipple, smoothstep(0.35, 0.55, vEdge));

        vec3 lit = ground * groundKeep + lines * lineKeep;

        // ── contour lines on the plateau: every 1 km, brighter every 5 km ──
        float onTop = smoothstep(0.9, 1.0, vMesa) * groundKeep;
        float minor = lineAA(vHeight / uContourStep, 0.6) * 0.22;
        float major = lineAA(vHeight / (uContourStep * 5.0), 0.8) * 0.4;
        lit += vec3(0.85, 0.82, 0.7) * max(minor, major) * onTop;

        // night dims the light, never the base. It isn't black: Earthshine (sunlight bounced
        // off Earth, which hangs over the near side) lights it faintly blue
        lit *= mix(vec3(0.36, 0.42, 0.58), vec3(1.0), day);
        vec3 col = uFill + lit;

        // ── lava flood, drawn in the dashboard's own language (not realistic lava): the
        //    flooded area gets the UI's diagonal hatching in the gold accent, screen-aligned
        //    like the hatched panels (even density at any distance, no shimmer), and the
        //    terrain under it is dimmed so the region reads as "covered". ──
        float flood = smoothstep(0.9, 1.0, vMesa) * groundKeep;
        float below = uLava - vHeight;
        vec3 gold = vec3(0.79, 0.66, 0.35); // --gold #c9a95a
        if (below > 0.0) {
          float hatch = lineAA((gl_FragCoord.x + gl_FragCoord.y) / 7.0, 0.75);
          col = mix(col, uFill + col * 0.3 + gold * (0.07 + hatch * 0.32), flood);
        }
        // shoreline: a thin gold line exactly at the level (like a contour, no glow)
        float shore = 1.0 - smoothstep(0.6, 1.4, abs(below) / max(fwidth(vHeight), 1e-4));
        col += gold * shore * 0.5 * flood;

        // bright leading edge while booting
        col += vec3(0.55, 0.85, 0.6) * ring * step(uReveal, ${REVEAL_MAX.toFixed(1)} - 1.0) * 0.6;

        // distance fog (eased, so the far third of the view dims steadily), and past the
        // last line fragments the surface settles to exactly the background colour
        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        fog = max(fog * fog * (3.0 - 2.0 * fog), smoothstep(0.85, 1.0, vEdge));
        // horizon: where the line of sight skims the curved surface, let it melt into the
        // background instead of ending in a bright silhouette (planet normal, relief ignored)
        vec3 planetN = normalize(vWorld - vec3(0.0, -${P.curveR.toFixed(1)}, 0.0));
        float graze = dot(planetN, normalize(cameraPosition - vWorld));
        fog = max(fog, 1.0 - smoothstep(0.02, 0.2, graze));
        gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
      }
    `,
  })
}
