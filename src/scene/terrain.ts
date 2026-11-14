import * as THREE from 'three'

/**
 * Real lunar topography from NASA's Lunar Orbiter Laser Altimeter (LOLA),
 * via the NASA SVS CGI Moon Kit. Built by scripts/build_dem.py into
 * public/terrain/moon_dem.{bin,json}.
 *
 * World units: x = east, z = south. ~1.1 units per degree.
 *
 * Layout (like the reference diorama): the real DEM sits on a raised central
 * plateau (MESA) with cliff edges; around it is a flat, coarser "apron" grid.
 * The apron is a stylized frame only — every hardware site is on the plateau.
 */
export const WORLD = { width: 340, depth: 290, segX: 366, segZ: 312 }
/** Plateau half-size in world units: the whole near side, lon ±90°, lat ±70° (DEM crop has a margin) */
const MESA = { hx: 74, hz: 55, radius: 12 }
const APRON_Y = -9

/**
 * Planet curvature: the surface bends down with distance from the center like a
 * slice of a sphere (radius CURVE_R world units). It gives a curved horizon and
 * drops the world edges below it, so the end of the grid is never visible.
 * Purely visual — contours, colors and the probe use the uncurved elevation.
 */
const CURVE_R = 300
export const curvature = (x: number, z: number) => (x * x + z * z) / (2 * CURVE_R)

/** Signed distance to the plateau edge (negative inside), with an irregular, natural-looking wobble. */
function mesaSdf(x: number, z: number) {
  const qx = Math.abs(x) - (MESA.hx - MESA.radius)
  const qz = Math.abs(z) - (MESA.hz - MESA.radius)
  const sdf = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - MESA.radius
  const jitter = 2.2 * Math.sin(x * 0.21) + 1.6 * Math.sin(z * 0.17 + 1.3) + 1.1 * Math.sin((x + z) * 0.33)
  return sdf + jitter
}

/** 1 on the plateau, 0 on the apron; a ~3-unit cliff. */
export function mesaMask(x: number, z: number) {
  return 1 - THREE.MathUtils.smoothstep(mesaSdf(x, z), -1.5, 1.5)
}

// World units per degree. Slightly less in z so the near side (180° × 140°) keeps a pleasing aspect.
const X_PER_DEG = 0.8
const Z_PER_DEG = 0.76
export const lonToX = (lon: number) => lon * X_PER_DEG
export const latToZ = (lat: number) => -lat * Z_PER_DEG
const xToLon = (x: number) => x / X_PER_DEG
const zToLat = (z: number) => -z / Z_PER_DEG

/** Vertical exaggeration: real relief (~11 km) would be nearly flat at this map scale. */
const UNITS_PER_KM = 1.1

interface DemMeta {
  width: number; height: number; ppd: number
  lonMin: number; lonMax: number; latMin: number; latMax: number
}

export interface Dem {
  /** Terrain height (world units) at world x/z */
  heightAt: (x: number, z: number) => number
  /** Same as heightAt but without planet curvature (real elevation, for colors/contours) */
  flatHeightAt: (x: number, z: number) => number
  /** Raw LOLA elevation in meters at lon/lat (degrees) */
  metersAt: (lon: number, lat: number) => number
  /** LRO surface brightness 0–1 at lon/lat (dark maria ≈ low, bright highlands ≈ high) */
  albedoAt: (lon: number, lat: number) => number
  /** True where the real DEM is shown (the plateau), false on the stylized apron */
  onMap: (x: number, z: number) => boolean
  buildGeometry: () => THREE.BufferGeometry
}

export const worldToLonLat = (x: number, z: number) => ({ lon: xToLon(x), lat: zToLat(z) })

function makeDem(meta: DemMeta, raw: Uint16Array, albedo: Uint8ClampedArray): Dem {
  const { width: W, height: H, ppd } = meta
  const px = (c: number, r: number) => {
    const ci = Math.min(W - 1, Math.max(0, c)), ri = Math.min(H - 1, Math.max(0, r))
    return (raw[ri * W + ci] - 20000) / 2 // meters
  }
  /** Bilinear sample in meters at lon/lat. Pixel centers sit at +0.5. */
  const metersAt = (lon: number, lat: number) => {
    const c = (lon - meta.lonMin) * ppd - 0.5
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
  const demHeight = (x: number, z: number) => (smoothMetersAt(xToLon(x), zToLat(z)) / 1000) * UNITS_PER_KM
  const flatHeightAt = (x: number, z: number) => {
    const m = mesaMask(x, z)
    if (m <= 0) return APRON_Y
    return APRON_Y + (demHeight(x, z) - APRON_Y) * m
  }
  /** Nearest-pixel albedo (RGBA from canvas; gray, so read R). Same grid as the DEM. */
  const albedoAt = (lon: number, lat: number) => {
    const c = Math.min(W - 1, Math.max(0, Math.round((lon - meta.lonMin) * ppd - 0.5)))
    const r = Math.min(H - 1, Math.max(0, Math.round((meta.latMax - lat) * ppd - 0.5)))
    return albedo[(r * W + c) * 4] / 255
  }
  const onMap = (x: number, z: number) => mesaMask(x, z) > 0.98
  const heightAt = (x: number, z: number) => flatHeightAt(x, z) - curvature(x, z)
  const dem: Dem = { heightAt, flatHeightAt, metersAt, albedoAt, onMap, buildGeometry: () => buildTerrainGeometry(dem) }
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

let demPromise: Promise<Dem> | null = null
export function loadDem(): Promise<Dem> {
  demPromise ??= (async () => {
    const base = import.meta.env.BASE_URL
    const [meta, buf] = await Promise.all([
      fetch(`${base}terrain/moon_dem.json`).then((r) => r.json() as Promise<DemMeta>),
      fetch(`${base}terrain/moon_dem.bin`).then((r) => r.arrayBuffer()),
    ])
    const albedo = await loadAlbedo(`${base}terrain/moon_albedo.png`, meta.width, meta.height)
    return makeDem(meta, new Uint16Array(buf), albedo)
  })()
  return demPromise
}

// Muted, earthy palette matching the reference: slate lowlands, moss/olive
// heights, dusty terracotta on steep slopes. Keep saturation low so the UI
// accents (status green/orange) stay the brightest things on screen.
const C_SLATE = new THREE.Color('#6f8088')
const C_OLIVE_DARK = new THREE.Color('#56652f')
const C_MOSS = new THREE.Color("#9aab55")
const C_TERRACOTTA = new THREE.Color('#9c5636')
const C_CLIFF = new THREE.Color("#7a4a33")
const C_APRON = new THREE.Color("#55636a")

function buildTerrainGeometry(dem: Dem) {
  const g = new THREE.PlaneGeometry(WORLD.width, WORLD.depth, WORLD.segX, WORLD.segZ)
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const mesa = new Float32Array(pos.count)
  const alb = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    mesa[i] = mesaMask(x, z)
    pos.setY(i, dem.flatHeightAt(x, z)) // flat first: colors/slopes use real elevation
    alb[i] = dem.albedoAt(xToLon(x), zToLat(z))
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
      // elevation: slate lowlands → dark olive → moss heights
      if (t < 0.4) c.copy(C_SLATE).lerp(C_OLIVE_DARK, THREE.MathUtils.smoothstep(t, 0.15, 0.4))
      else c.copy(C_OLIVE_DARK).lerp(C_MOSS, (t - 0.4) / 0.6)
      // steep slopes (crater walls, mountain flanks) pick up terracotta patches
      const slope = 1 - nrm.getY(i)
      c.lerp(C_TERRACOTTA, THREE.MathUtils.smoothstep(slope, 0.05, 0.22) * 0.75)
      // real LRO brightness: dark maria dim, bright highlands and crater rays lift
      const a = THREE.MathUtils.clamp((alb[i] - aLo) / Math.max(aHi - aLo, 1e-3), 0, 1)
      c.multiplyScalar(0.6 + 0.75 * a)
    } else if (m > 0.02) {
      // cliff face: darker terracotta fading down into the apron
      c.copy(C_APRON).lerp(C_CLIFF, m)
    } else {
      c.copy(C_APRON)
    }
    // The terrain never "ends": over the plateau's last ~18 units its colors dissolve
    // into darkness, and the cliff and apron beyond stay nearly black.
    const edge = THREE.MathUtils.smoothstep(mesaSdf(pos.getX(i), pos.getZ(i)), -18, -2)
    c.multiplyScalar(1 - 0.94 * edge)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setAttribute("aMesa", new THREE.BufferAttribute(mesa, 1))
  // keep real elevation for contour lines, then bend the surface into a planet curve
  const elev = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    elev[i] = pos.getY(i)
    pos.setY(i, elev[i] - curvature(pos.getX(i), pos.getZ(i)))
  }
  g.setAttribute("aElev", new THREE.BufferAttribute(elev, 1))
  g.computeVertexNormals()
  return g
}

/** Max distance from the center to a world corner — the boot reveal ends past this. */
export const REVEAL_MAX = Math.hypot(WORLD.width / 2, WORLD.depth / 2) + 10

/**
 * Draws the grid in the fragment shader instead of `wireframe: true` (which WebGL
 * always renders 1px wide). One draw call handles:
 *  - square cells with constant on-screen line width (fwidth), faint halo, fog
 *  - 1 km contour lines on the plateau (5 km lines brighter)
 *  - live day/night shading from the Sun's position (uSunLon), with a glowing terminator
 *  - the boot-up reveal: a ring that grows from the center (uReveal)
 */
export function makeGridMaterial(fogColor: string, fogNear: number, fogFar: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCells: { value: new THREE.Vector2(WORLD.segX, WORLD.segZ) },
      uWidth: { value: 0.9 },              // core line width in px
      uFill: { value: new THREE.Color('#0a0b0a') },
      uFog: { value: new THREE.Color(fogColor) },
      uFogNear: { value: fogNear },
      uFogFar: { value: fogFar },
      uContourStep: { value: UNITS_PER_KM }, // 1 km of real elevation
      uSunLon: { value: 0 },                 // sub-solar longitude, radians
      uReveal: { value: REVEAL_MAX },        // world-unit radius revealed so far
      uDegX: { value: 1 / X_PER_DEG },       // world x → degrees lon
      uDegZ: { value: -1 / Z_PER_DEG },      // world z → degrees lat
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aMesa;
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
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vDepth;
      varying float vMesa;
      varying float vHeight;
      varying vec2 vXZ;
      varying vec2 vLonLat;

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
        vec3 col = uFill + vColor * 0.1 + vColor * (core * 1.7 + glow) * density;

        // ── contour lines on the plateau: every 1 km, brighter every 5 km ──
        // fade overlays with the vertex color so they dissolve at the map's dark edges too
        float onTop = smoothstep(0.9, 1.0, vMesa) * clamp(length(vColor) * 3.0, 0.0, 1.0);
        float minor = lineAA(vHeight / uContourStep, 0.6) * 0.22;
        float major = lineAA(vHeight / (uContourStep * 5.0), 0.8) * 0.4;
        col += vec3(0.85, 0.82, 0.7) * max(minor, major) * onTop;

        // ── live day/night: Sun elevation at this point (sub-solar latitude ≈ 0) ──
        float sunDot = cos(vLonLat.y) * cos(vLonLat.x - uSunLon);
        float day = smoothstep(-0.02, 0.09, sunDot);
        col *= mix(0.42, 1.0, day);
        float terminator = exp(-abs(sunDot) * 45.0) * onTop;
        col += vec3(0.95, 0.72, 0.38) * terminator * 0.22;

        // bright leading edge while booting
        col += vec3(0.55, 0.85, 0.6) * ring * step(uReveal, ${REVEAL_MAX.toFixed(1)} - 1.0) * 0.6;

        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
      }
    `,
  })
}
